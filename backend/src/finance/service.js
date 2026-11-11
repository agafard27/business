import { createCashService } from './cash.js';
import { identifier } from '../catalog/validation.js';
import { object,text,key,money,problem,conflict,operate,snapshot } from '../business/core.js';
import { lockShift,recordCash } from '../sales/payments.js';
import { allocatePartyPayment } from './allocate.js';

export function createFinanceService(config){
  const write=(type,permission,input,actorId,payload,action)=>operate(config,{type,permission,actorId,requestKey:key(input.requestKey),payload},action);
  return {
    ...createCashService(config),
    async parties(){return snapshot(config,async connection=>{
      const [rows]=await connection.query(`SELECT p.*,COALESCE((SELECT SUM(e.amount_minor) FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=p.id AND a.account_type='receivable'),0) AS receivable,
        COALESCE((SELECT SUM(e.amount_minor) FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=p.id AND a.account_type='payable'),0) AS payable FROM parties p ORDER BY p.name LIMIT 1000`);
      return {parties:rows.map(row=>({id:String(row.id),code:row.code,name:row.name,isCustomer:Boolean(row.is_customer),isSupplier:Boolean(row.is_supplier),isActive:Boolean(row.is_active),
        revision:String(row.revision),phone:row.phone,creditLimitMinor:row.credit_limit_minor===null?null:String(row.credit_limit_minor),receivableMinor:String(row.receivable),payableMinor:String(row.payable)}))};
    });},
    async party(input,actorId){
      object(input,['requestKey','code','name','isCustomer','isSupplier','creditLimitMinor']);const payload={code:text(input.code,80,'Cari kodu'),name:text(input.name,180,'Cari adı'),isCustomer:input.isCustomer,isSupplier:input.isSupplier,
        creditLimitMinor:input.creditLimitMinor===null?null:money(input.creditLimitMinor,{zero:true})};
      if(typeof payload.isCustomer!=='boolean'||typeof payload.isSupplier!=='boolean'||(!payload.isCustomer&&!payload.isSupplier))throw problem(400,'INVALID_INPUT','Müşteri veya tedarikçi seçin.');
      return write('party.create','parties.manage',input,actorId,payload,async connection=>{const [result]=await connection.execute('INSERT INTO parties(code,name,is_customer,is_supplier,credit_limit_minor) VALUES (?,?,?,?,?)',[payload.code,payload.name,payload.isCustomer,payload.isSupplier,payload.creditLimitMinor]);return {id:String(result.insertId)};});
    },
    async updateParty(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','name','phone','creditLimitMinor','isActive']);
      const payload={id,revision:identifier(input.revision),name:text(input.name,180,'Cari adı'),phone:input.phone?text(input.phone,40,'Telefon'):null,creditLimitMinor:input.creditLimitMinor===null?null:money(input.creditLimitMinor,{zero:true}),isActive:input.isActive};
      if(typeof payload.isActive!=='boolean')throw problem(400,'INVALID_INPUT','Etkinlik seçimi geçersiz.');
      return write('party.update','parties.manage',input,actorId,payload,async connection=>{
        const [[party]]=await connection.execute('SELECT revision FROM parties WHERE id=? FOR UPDATE',[id]);if(!party)throw problem(404,'NOT_FOUND','Cari bulunamadı.');if(String(party.revision)!==payload.revision)throw conflict();
        const [balances]=await connection.execute('SELECT SUM(e.amount_minor) AS amount FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=? GROUP BY a.id',[id]);
        if(!payload.isActive&&balances.some(row=>BigInt(row.amount)!==0n))throw problem(409,'PARTY_BALANCE_REMAINS','Bakiyesi olan cari pasife alınamaz.');
        await connection.execute('UPDATE parties SET name=?,phone=?,credit_limit_minor=?,is_active=?,revision=revision+1 WHERE id=?',[payload.name,payload.phone,payload.creditLimitMinor,payload.isActive,id]);return {id};
      });
    },
    async paymentMeta(){return snapshot(config,async connection=>{const [shifts]=await connection.query("SELECT s.id,r.name FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id WHERE s.status='open' ORDER BY r.name");return {shifts:shifts.map(row=>({id:String(row.id),name:row.name,status:'open'}))};});},
    async ledger(id){id=identifier(id);return snapshot(config,async connection=>{
      const [rows]=await connection.execute('SELECT e.id,a.account_type,e.entry_type,e.amount_minor,e.description,e.created_at_utc,e.due_date FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=? ORDER BY e.id DESC LIMIT 500',[id]);
      return {entries:rows.map(row=>({id:String(row.id),accountType:row.account_type,type:row.entry_type,amountMinor:String(row.amount_minor),description:row.description,createdAtUtc:row.created_at_utc,dueDate:row.due_date}))};
    });},
    async partyEntry(id,input,actorId){
      id=identifier(id);object(input,['requestKey','accountType','kind','amountMinor','method','shiftId','description']);const payload={id,accountType:input.accountType,kind:input.kind,amountMinor:money(input.amountMinor),description:text(input.description,500,'Açıklama'),method:input.method??null,shiftId:input.kind==='payment'?identifier(input.shiftId):null};
      if(!['receivable','payable'].includes(payload.accountType)||!['opening','payment'].includes(payload.kind)||(payload.kind==='payment'&&!['cash','card'].includes(payload.method)))throw problem(400,'INVALID_INPUT','Cari hareket seçimi geçersiz.');
      return write('party.entry','parties.manage',input,actorId,payload,async(connection,operation,actor)=>{
        const [[party]]=await connection.execute('SELECT * FROM parties WHERE id=? AND is_active=TRUE FOR UPDATE',[id]);
        if(!party||(payload.accountType==='receivable'?!party.is_customer:!party.is_supplier))throw problem(400,'INVALID_PARTY','Cari hesap türü uygun değil.');
        await connection.execute('INSERT INTO party_accounts(party_id,account_type) VALUES (?,?) ON DUPLICATE KEY UPDATE party_id=party_accounts.party_id',[id,payload.accountType]);
        const [[account]]=await connection.execute('SELECT id FROM party_accounts WHERE party_id=? AND account_type=?',[id,payload.accountType]);
        const [[balance]]=await connection.execute('SELECT COALESCE(SUM(amount_minor),0) AS amount FROM party_entries WHERE account_id=?',[account.id]);
        if(payload.kind==='payment'&&BigInt(payload.amountMinor)>BigInt(balance.amount))throw problem(409,'BALANCE_EXCEEDED','Ödeme cari bakiyesini aşıyor.');
        if(payload.kind==='opening'){
          const [[existing]]=await connection.execute('SELECT COUNT(*) AS count FROM party_entries WHERE account_id=?',[account.id]);if(Number(existing.count))throw problem(409,'OPENING_EXISTS','Hareketi olan hesaba yeniden açılış bakiyesi girilemez.');
        }
        const amount=payload.kind==='payment'?-BigInt(payload.amountMinor):BigInt(payload.amountMinor);
        const [entry]=await connection.execute('INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,1,?,?,?)',[account.id,operation,payload.kind,amount.toString(),payload.description]);
        if(payload.kind==='payment'){
          await lockShift(connection,payload.shiftId);const direction=payload.accountType==='receivable'?'in':'out';
          const [payment]=await connection.execute('INSERT INTO payments(operation_id,sequence_no,method,direction,amount_minor,received_by,shift_id) VALUES (?,1,?,?,?,?,?)',[operation,payload.method,direction,payload.amountMinor,actor,payload.shiftId]);
          await allocatePartyPayment(connection,{accountId:account.id,paymentId:payment.insertId,amount:payload.amountMinor});
          if(payload.method==='cash')await recordCash(connection,{operation,shiftId:payload.shiftId,actor,paymentId:String(payment.insertId),amount:(direction==='in'?BigInt(payload.amountMinor):-BigInt(payload.amountMinor)).toString(),kind:direction==='in'?'receivable_receipt':'supplier_payment',reason:payload.description});
        }
        return {id:String(entry.insertId),balanceMinor:(BigInt(balance.amount)+amount).toString()};
      });
    }
  };
}
