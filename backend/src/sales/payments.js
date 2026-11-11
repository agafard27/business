import { identifier } from '../catalog/validation.js';
import { object,text,key,money,decimal,decimalString,roundedRatio,problem,operate,snapshot } from '../business/core.js';
import { readGroup,lockGroup,bump } from './service.js';

export async function closePaid(connection,id){
  await connection.execute("UPDATE checks c JOIN settlement_group_memberships m ON m.check_id=c.id SET c.status='closed',c.closed_at_utc=UTC_TIMESTAMP(6),c.revision=c.revision+1 WHERE m.group_id=? AND m.left_at_utc IS NULL",[id]);
  await connection.execute("UPDATE settlement_groups SET status='closed',closed_at_utc=UTC_TIMESTAMP(6) WHERE id=?",[id]);
  await connection.execute('UPDATE table_assignments SET released_at_utc=UTC_TIMESTAMP(6) WHERE group_id=? AND released_at_utc IS NULL',[id]);
}
export async function lockShift(connection,id){
  const [[shift]]=await connection.execute("SELECT id FROM cash_shifts WHERE id=? AND status='open' FOR UPDATE",[id]);
  if(!shift)throw problem(409,'SHIFT_REQUIRED','Açık kasa seçin.');
  await connection.execute('UPDATE cash_shifts SET revision=revision+1 WHERE id=?',[id]);return shift;
}
export async function recordCash(connection,{operation,shiftId,actor,custodyId=actor,paymentId,amount,kind,reason}){
  const [movement]=await connection.execute(`INSERT INTO cash_movements(operation_id,cash_shift_id,actor_user_id,custody_user_id,movement_kind,amount_minor,reason) VALUES (?,?,?,?,?,?,?)`,
    [operation,shiftId,actor,custodyId,kind,amount,reason]);
  if(paymentId)await connection.execute('INSERT INTO cash_payment_links(payment_id,cash_movement_id) VALUES (?,?)',[paymentId,movement.insertId]);
}
export function createPaymentService(config){
  return {
    async meta(){return snapshot(config,async connection=>{
      const [shifts]=await connection.query("SELECT s.id,r.name FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id WHERE s.status='open' ORDER BY r.name");
      const [parties]=await connection.query('SELECT id,name FROM parties WHERE is_customer=TRUE AND is_active=TRUE ORDER BY name LIMIT 500');
      return {shifts:shifts.map(row=>({id:String(row.id),name:row.name})),customers:parties.map(row=>({id:String(row.id),name:row.name}))};
    });},
    async settle(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','method','amountMinor','items','shiftId','customerId']);
      const revision=identifier(input.revision),amount=money(input.amountMinor);
      if(!['cash','card','credit'].includes(input.method))throw problem(400,'INVALID_INPUT','Ödeme yöntemi geçersiz.');
      if(input.method!=='credit'&&!input.shiftId)throw problem(409,'SHIFT_REQUIRED','Nakit veya POS ödemesi için önce kasayı açın.');
      if(input.method==='credit'&&!input.customerId)throw problem(400,'CUSTOMER_REQUIRED','Veresiye için müşteri seçin.');
      const method=input.method,shiftId=method==='credit'?null:identifier(input.shiftId),customerId=method==='credit'?identifier(input.customerId):null;
      let items=null;
      if(input.items!==undefined&&input.items!==null){
        if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw problem(400,'INVALID_INPUT','Ödenecek ürünleri seçin.');
        items=input.items.map(item=>{object(item,['lineId','quantity']);return {lineId:identifier(item.lineId),quantity:decimalString(decimal(item.quantity))};});
        if(new Set(items.map(item=>item.lineId)).size!==items.length)throw problem(400,'INVALID_INPUT','Aynı satır bir kez seçilebilir.');
      }
      return operate(config,{type:'sales.settle',permission:'payments.write',actorId,requestKey:key(input.requestKey),payload:{id,revision,method,amount,shiftId,customerId,items}},async(connection,operation,actor)=>{
        await lockGroup(connection,id,revision);const group=await readGroup(connection,id);
        if(BigInt(amount)>BigInt(group.remainingMinor))throw problem(409,'BALANCE_EXCEEDED','Ödeme kalan hesap tutarını aşıyor.');
        let allocations=[];
        if(items){
          if(!group.itemPaymentsAvailable)throw problem(409,'UNALLOCATED_PAYMENT','Önceki tutar ödemesinden sonra ürün payı varsayılamaz. Tutarla devam edin.');
          let total=0n;
          for(const item of items){
            const line=group.lines.find(line=>line.id===item.lineId&&line.state!=='cancelled');if(!line)throw problem(409,'LINE_UNAVAILABLE','Ödenecek ürün bulunamadı.');
            const quantity=decimal(item.quantity),paid=decimal(String(line.paidQuantity),{zero:true}),sold=decimal(line.quantity);
            if(paid+quantity>sold)throw problem(409,'QUANTITY_EXCEEDED','Seçilen miktar ürünün kalan miktarını aşıyor.');
            if(line.unitCode==='adet'&&quantity%1000000n!==0n)throw problem(400,'INVALID_QUANTITY','Adet ürün tam sayı seçilmeli.');
            const part=roundedRatio((paid+quantity)*BigInt(line.totalMinor),sold)-BigInt(line.paidMinor);
            if(part<0n)throw problem(409,'ALLOCATION_CONFLICT','Önceki ödeme dağılımını kontrol edin.');
            total+=part;allocations.push({lineId:line.id,checkId:line.checkId,quantity:item.quantity,amount:part.toString()});
          }
          if(total!==BigInt(amount))throw problem(409,'AMOUNT_MISMATCH','Seçilen ürünlerin tutarı değişti. Hesabı yenileyin.');
        } else {
          let remaining=BigInt(amount);
          for(const check of group.checks){
            const checkTotal=group.lines.filter(line=>line.checkId===check.id&&line.state!=='cancelled').reduce((sum,line)=>sum+BigInt(line.totalMinor),0n);
            const [[paid]]=await connection.execute(`SELECT COALESCE(SUM(IF(s.direction='settle',a.amount_minor,-CAST(a.amount_minor AS SIGNED))),0) AS amount
              FROM settlement_allocations a JOIN bill_settlements s ON s.id=a.settlement_id WHERE a.check_id=?`,[check.id]);
            const outstanding=checkTotal-BigInt(paid.amount);const part=outstanding<remaining?outstanding:remaining;
            if(part>0n){allocations.push({lineId:null,checkId:check.id,quantity:null,amount:part.toString()});remaining-=part;}
          }
          if(remaining!==0n)throw problem(409,'ALLOCATION_CONFLICT','Hesap ödeme dağılımı doğrulanamadı.');
        }
        let paymentId=null,creditEntries=null;
        if(method==='credit'){
          const [[customer]]=await connection.execute('SELECT id,credit_limit_minor FROM parties WHERE id=? AND is_customer=TRUE AND is_active=TRUE FOR UPDATE',[customerId]);
          if(!customer)throw problem(400,'INVALID_CUSTOMER','Etkin müşteri seçin.');
          await connection.execute("INSERT INTO party_accounts(party_id,account_type) VALUES (?,'receivable') ON DUPLICATE KEY UPDATE party_id=party_accounts.party_id",[customerId]);
          const [[account]]=await connection.execute("SELECT id FROM party_accounts WHERE party_id=? AND account_type='receivable' AND currency='TRY'",[customerId]);
          const [[balance]]=await connection.execute('SELECT COALESCE(SUM(amount_minor),0) AS amount FROM party_entries WHERE account_id=?',[account.id]);
          if(customer.credit_limit_minor!==null&&BigInt(balance.amount)+BigInt(amount)>BigInt(customer.credit_limit_minor))throw problem(409,'CREDIT_LIMIT','Müşterinin veresiye limiti aşılıyor.');
          creditEntries=[];
          for(const checkId of new Set(allocations.map(item=>item.checkId))){
            const parts=allocations.filter(item=>item.checkId===checkId);const partAmount=parts.reduce((sum,item)=>sum+BigInt(item.amount),0n);
            if(partAmount===0n)throw problem(400,'ZERO_SHARE','Sıfır kuruşluk ürün payını diğer miktarlarla birlikte seçin.');
            const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,?,'sale_credit',?,'Adisyon veresiye payı')",[account.id,operation,creditEntries.length+1,partAmount.toString()]);
            await connection.execute('INSERT INTO party_entry_sources(party_entry_id,check_id) VALUES (?,?)',[entry.insertId,checkId]);
            creditEntries.push({entryId:String(entry.insertId),amount:partAmount.toString(),allocations:parts});
          }
        }else{
          await lockShift(connection,shiftId);
          const [payment]=await connection.execute("INSERT INTO payments(operation_id,sequence_no,method,direction,amount_minor,received_by,shift_id) VALUES (?,1,?,'in',?,?,?)",[operation,method,amount,actor,shiftId]);paymentId=String(payment.insertId);
          if(method==='cash')await recordCash(connection,{operation,shiftId,actor,paymentId,amount,kind:'sale_receipt',reason:'Adisyon nakit tahsilatı'});
        }
        for(const chunk of creditEntries||[{entryId:null,amount,allocations}]){
          const [settlement]=await connection.execute("INSERT INTO bill_settlements(group_id,payment_id,credit_entry_id,direction,amount_minor) VALUES (?,?,?,'settle',?)",[id,paymentId,chunk.entryId,chunk.amount]);
          for(const allocation of chunk.allocations){
            const membership=group.checks.find(check=>check.id===allocation.checkId);
            await connection.execute(`INSERT INTO settlement_allocations(settlement_id,group_id,membership_id,check_id,check_line_id,quantity,amount_minor) VALUES (?,?,?,?,?,?,?)`,[settlement.insertId,id,membership.membershipId,allocation.checkId,allocation.lineId,allocation.quantity,allocation.amount]);
          }
        }
        await bump(connection,id);if(BigInt(group.remainingMinor)===BigInt(amount))await closePaid(connection,id);
        return {group:await readGroup(connection,id)};
      });
    },
    async closeEmpty(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision']);const revision=identifier(input.revision);
      return operate(config,{type:'sales.close.empty',permission:'orders.write',actorId,requestKey:key(input.requestKey),payload:{id,revision}},async connection=>{
        await lockGroup(connection,id,revision);const group=await readGroup(connection,id);
        if(group.remainingMinor!=='0')throw problem(409,'BALANCE_REMAINS','Hesapta ödenmemiş tutar var.');
        await bump(connection,id);await closePaid(connection,id);return {group:await readGroup(connection,id)};
      });
    },
    async refund(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','settlementId','shiftId','reason']);const payload={id,revision:identifier(input.revision),settlementId:identifier(input.settlementId),shiftId:input.shiftId?identifier(input.shiftId):null,reason:text(input.reason,500,'İade gerekçesi')};
      return operate(config,{type:'sales.refund',permission:'settings.manage',actorId,requestKey:key(input.requestKey),payload},async(connection,operation,actor)=>{
        const [[root]]=await connection.execute('SELECT status,revision FROM settlement_groups WHERE id=? FOR UPDATE',[id]);
        if(!root||!['open','closed'].includes(root.status)||String(root.revision)!==payload.revision)throw problem(409,'REVISION_CONFLICT','Güncel hesabı yükleyin.');
        const group=await readGroup(connection,id),listed=group.settlements.find(item=>item.id===payload.settlementId&&item.direction==='settle');if(!listed)throw problem(400,'INVALID_SETTLEMENT','İade edilecek tahsilat bulunamadı.');
        const [[source]]=await connection.execute('SELECT * FROM bill_settlements WHERE id=? FOR UPDATE',[payload.settlementId]);
        let paymentId=null,creditEntryId=null;
        if(source.payment_id){
          const [[original]]=await connection.execute('SELECT * FROM payments WHERE id=? FOR UPDATE',[source.payment_id]);
          const [[existing]]=await connection.execute('SELECT COUNT(*) AS count FROM payments WHERE reversal_of_id=?',[original.id]);if(Number(existing.count))throw problem(409,'ALREADY_REFUNDED','Tahsilat zaten iade edilmiş.');
          if(!payload.shiftId)throw problem(400,'SHIFT_REQUIRED','İade için açık kasa seçin.');await lockShift(connection,payload.shiftId);
          const [payment]=await connection.execute("INSERT INTO payments(operation_id,sequence_no,method,direction,amount_minor,received_by,shift_id,reversal_of_id,reason) VALUES (?,1,?,'out',?,?,?,?,?)",[operation,original.method,source.amount_minor,actor,payload.shiftId,original.id,payload.reason]);paymentId=String(payment.insertId);
          if(original.method==='cash')await recordCash(connection,{operation,shiftId:payload.shiftId,actor,paymentId,amount:(-BigInt(source.amount_minor)).toString(),kind:'sale_refund',reason:payload.reason});
        }else{
          const [[original]]=await connection.execute('SELECT * FROM party_entries WHERE id=? FOR UPDATE',[source.credit_entry_id]);
          const [[existing]]=await connection.execute('SELECT COUNT(*) AS count FROM party_entries WHERE reversal_of_id=?',[original.id]);if(Number(existing.count))throw problem(409,'ALREADY_REFUNDED','Veresiye payı zaten geri alınmış.');
          const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[original.account_id]);await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);
          const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,reversal_of_id,description) VALUES (?,?,1,'return',?,?,?)",[original.account_id,operation,(-BigInt(source.amount_minor)).toString(),original.id,payload.reason]);creditEntryId=String(entry.insertId);
          await connection.execute('INSERT INTO party_entry_sources(party_entry_id,check_id,purchase_id,expense_id) SELECT ?,check_id,purchase_id,expense_id FROM party_entry_sources WHERE party_entry_id=?',[creditEntryId,original.id]);
        }
        const [settlement]=await connection.execute("INSERT INTO bill_settlements(group_id,payment_id,credit_entry_id,direction,amount_minor) VALUES (?,?,?,'refund',?)",[id,paymentId,creditEntryId,source.amount_minor]);
        const [allocations]=await connection.execute('SELECT * FROM settlement_allocations WHERE settlement_id=?',[source.id]);
        for(const allocation of allocations){
          const membership=group.checks.find(check=>check.id===String(allocation.check_id));if(!membership)throw problem(409,'ALLOCATION_CONFLICT','İade adisyon bağlantısı bulunamadı.');
          await connection.execute('INSERT INTO settlement_allocations(settlement_id,group_id,membership_id,check_id,check_line_id,quantity,amount_minor) VALUES (?,?,?,?,?,?,?)',[settlement.insertId,id,membership.membershipId,allocation.check_id,allocation.check_line_id,allocation.quantity,allocation.amount_minor]);
        }
        await connection.execute("UPDATE settlement_groups SET status='open',closed_at_utc=NULL,revision=revision+1 WHERE id=?",[id]);
        await connection.execute("UPDATE checks c JOIN settlement_group_memberships m ON m.check_id=c.id SET c.status='open',c.closed_at_utc=NULL,c.revision=c.revision+1 WHERE m.group_id=? AND m.left_at_utc IS NULL",[id]);
        return {group:await readGroup(connection,id)};
      });
    }
  };
}
