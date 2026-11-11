import { identifier } from '../catalog/validation.js';
import { object,text,key,money,decimal,decimalString,roundedRatio,problem,operate,snapshot,dateOnly,expiryDate } from '../business/core.js';
import { lockShift,recordCash } from '../sales/payments.js';
import { lockProducts,warehouse,document,moveStock,consume } from '../stock/core.js';

export function createPurchasingService(config){
  const write=(type,input,actorId,payload,action)=>operate(config,{type,permission:'purchases.manage',actorId,requestKey:key(input.requestKey),payload},action);
  return {
    async list(){return snapshot(config,async connection=>{
      const [purchases]=await connection.query(`SELECT p.id,p.document_number,p.status,p.total_minor,p.created_at_utc,p.due_date,party.name AS supplier_name,
        COALESCE((SELECT SUM(a.amount_minor) FROM purchase_payment_allocations a WHERE a.purchase_id=p.id),0) AS paid,
        COALESCE((SELECT SUM(r.total_minor) FROM purchase_returns r WHERE r.purchase_id=p.id),0) AS returned FROM purchases p JOIN party_accounts a ON a.id=p.supplier_account_id JOIN parties party ON party.id=a.party_id ORDER BY p.id DESC LIMIT 200`);
      const [shifts]=await connection.query("SELECT s.id,r.name FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id WHERE s.status='open' ORDER BY r.name");
      return {shifts:shifts.map(row=>({id:String(row.id),name:row.name})),purchases:purchases.map(row=>({id:String(row.id),number:row.document_number,status:row.status,totalMinor:String(row.total_minor),paidMinor:String(row.paid),returnedMinor:String(row.returned),remainingMinor:(BigInt(row.total_minor)-BigInt(row.paid)-BigInt(row.returned)).toString(),dueDate:row.due_date,supplierName:row.supplier_name,createdAtUtc:row.created_at_utc}))};
    });},
    async get(id){id=identifier(id);return snapshot(config,async connection=>{
      const [[purchase]]=await connection.execute('SELECT id,document_number,status,total_minor,attachment_id,due_date FROM purchases WHERE id=?',[id]);if(!purchase)throw problem(404,'NOT_FOUND','Alış bulunamadı.');
      const [lines]=await connection.execute(`SELECT l.id,l.product_id,l.product_name,l.quantity,l.actual_base_quantity,l.total_minor,COALESCE((SELECT SUM(r.quantity_base) FROM purchase_return_lines r WHERE r.purchase_line_id=l.id),0) AS returned_quantity FROM purchase_lines l WHERE l.purchase_id=? ORDER BY l.id`,[id]);
      return {purchase:{id,number:purchase.document_number,status:purchase.status,totalMinor:String(purchase.total_minor),attachmentId:purchase.attachment_id===null?null:String(purchase.attachment_id),dueDate:purchase.due_date},lines:lines.map(row=>({id:String(row.id),productId:String(row.product_id),name:row.product_name,quantity:row.quantity,baseQuantity:row.actual_base_quantity,totalMinor:String(row.total_minor),returnedQuantity:row.returned_quantity}))};
    });},
    async create(input,actorId){
      object(input,['requestKey','number','supplierId','items','attachmentId','dueDate']);if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw problem(400,'INVALID_INPUT','Alış satırlarını girin.');
      const payload={number:text(input.number,80,'Belge numarası'),supplierId:identifier(input.supplierId),attachmentId:input.attachmentId?identifier(input.attachmentId):null,dueDate:dateOnly(input.dueDate),items:input.items.map(item=>{object(item,['productId','unitId','quantity','actualBaseQuantity','unitPriceMinor']);return {productId:identifier(item.productId),unitId:identifier(item.unitId),quantity:decimalString(decimal(item.quantity)),actualBaseQuantity:decimalString(decimal(item.actualBaseQuantity)),unitPriceMinor:money(item.unitPriceMinor,{zero:true})};})};
      return write('purchase.create',input,actorId,payload,async(connection,operation,actor)=>{
        const [[supplier]]=await connection.execute('SELECT id FROM parties WHERE id=? AND is_supplier=TRUE AND is_active=TRUE FOR UPDATE',[payload.supplierId]);if(!supplier)throw problem(400,'INVALID_SUPPLIER','Etkin tedarikçi seçin.');
        await connection.execute("INSERT INTO party_accounts(party_id,account_type) VALUES (?,'payable') ON DUPLICATE KEY UPDATE party_id=party_accounts.party_id",[payload.supplierId]);
        const [[account]]=await connection.execute("SELECT id FROM party_accounts WHERE party_id=? AND account_type='payable'",[payload.supplierId]);
        const products=await lockProducts(connection,payload.items.map(item=>item.productId));
        const amounts=payload.items.map(item=>roundedRatio(decimal(item.quantity)*BigInt(item.unitPriceMinor),1000000n));const total=amounts.reduce((sum,value)=>sum+value,0n);
        if(total>9999999999999n)throw problem(400,'AMOUNT_LIMIT','Alış tutarı sınırı aşıyor.');
        const [purchase]=await connection.execute('INSERT INTO purchases(document_number,supplier_account_id,total_minor,operation_id,created_by,attachment_id,due_date) VALUES (?,?,?,?,?,?,?)',[payload.number,account.id,total.toString(),operation,actor,payload.attachmentId,payload.dueDate]);
        for(let i=0;i<payload.items.length;i++){
          const item=payload.items[i];await connection.execute('INSERT INTO purchase_lines(purchase_id,product_id,purchase_unit_id,product_name,quantity,actual_base_quantity,unit_price_minor,total_minor) VALUES (?,?,?,?,?,?,?,?)',[purchase.insertId,item.productId,item.unitId,products.get(item.productId).name,item.quantity,item.actualBaseQuantity,item.unitPriceMinor,amounts[i].toString()]);
        }
        return {id:String(purchase.insertId),totalMinor:total.toString()};
      });
    },
    async receive(id,input,actorId){
      id=identifier(id);object(input,['requestKey','warehouseId','lots']);const warehouseId=identifier(input.warehouseId);if(input.lots!==undefined&&(!Array.isArray(input.lots)||input.lots.length>100))throw problem(400,'INVALID_INPUT','Parti bilgileri geçersiz.');
      const lots=(input.lots||[]).map(item=>{object(item,['lineId','code','expiresDate']);return {lineId:identifier(item.lineId),code:item.code?text(item.code,100,'Parti kodu'):null,expiresAt:expiryDate(item.expiresDate)};});
      return write('purchase.receive',input,actorId,{id,warehouseId,lots},async(connection,operation,actor)=>{
        const [[purchase]]=await connection.execute('SELECT * FROM purchases WHERE id=? FOR UPDATE',[id]);if(!purchase)throw problem(404,'NOT_FOUND','Alış bulunamadı.');if(purchase.status!=='draft')throw problem(409,'PURCHASE_POSTED','Alış zaten kesinleştirilmiş.');
        await warehouse(connection,warehouseId);const [lines]=await connection.execute('SELECT * FROM purchase_lines WHERE purchase_id=? ORDER BY id',[id]);await lockProducts(connection,lines.map(line=>line.product_id));
        if(new Set(lots.map(lot=>lot.lineId)).size!==lots.length||lots.some(lot=>!lines.some(line=>String(line.id)===lot.lineId)))throw problem(400,'INVALID_LOT','Parti bilgileri alış satırlarıyla eşleşmiyor.');
        const [receipt]=await connection.execute('INSERT INTO goods_receipts(purchase_id,warehouse_id,operation_id,received_by) VALUES (?,?,?,?)',[id,warehouseId,operation,actor]);
        const documentId=await document(connection,operation,actor,'receipt','Alış mal kabulü');
        for(const line of lines){
          const [receiptLine]=await connection.execute('INSERT INTO goods_receipt_lines(receipt_id,purchase_id,purchase_line_id,product_id,quantity_base,total_cost_minor) VALUES (?,?,?,?,?,?)',[receipt.insertId,id,line.id,line.product_id,line.actual_base_quantity,line.total_minor]);
          const details=lots.find(item=>item.lineId===String(line.id));const [lot]=await connection.execute('INSERT INTO stock_lots(product_id,lot_code,receipt_line_id,operation_id,expires_at_utc) VALUES (?,?,?,?,?)',[line.product_id,details?.code||`A-${id}-${line.id}`,receiptLine.insertId,operation,details?.expiresAt||null]);
          const unitCost=roundedRatio(BigInt(line.total_minor)*1000000000000n,decimal(line.actual_base_quantity));
          await moveStock(connection,{documentId,warehouseId,productId:String(line.product_id),lotId:String(lot.insertId),quantity:decimal(line.actual_base_quantity),unitCost:decimalString(unitCost),receiptLineId:String(receiptLine.insertId)});
        }
        const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[purchase.supplier_account_id]);
        await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);
        if(BigInt(purchase.total_minor)>0n){
          const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description,due_date) VALUES (?,?,1,'purchase',?,?,?)",[purchase.supplier_account_id,operation,purchase.total_minor,`Alış ${purchase.document_number}`,purchase.due_date]);
          await connection.execute('INSERT INTO party_entry_sources(party_entry_id,purchase_id) VALUES (?,?)',[entry.insertId,id]);
        }
        await connection.execute("UPDATE purchases SET status='posted' WHERE id=?",[id]);return {id,receiptId:String(receipt.insertId)};
      });
    },
    async returnGoods(id,input,actorId){
      id=identifier(id);object(input,['requestKey','warehouseId','lineId','quantity','reason']);const payload={id,warehouseId:identifier(input.warehouseId),lineId:identifier(input.lineId),quantity:decimalString(decimal(input.quantity)),reason:text(input.reason,500,'İade gerekçesi')};
      return write('purchase.return',input,actorId,payload,async(connection,operation,actor)=>{
        const [[purchase]]=await connection.execute("SELECT * FROM purchases WHERE id=? AND status='posted' FOR UPDATE",[id]);if(!purchase)throw problem(409,'PURCHASE_UNAVAILABLE','Kesinleşmiş alış seçin.');
        const [[line]]=await connection.execute('SELECT * FROM purchase_lines WHERE id=? AND purchase_id=?',[payload.lineId,id]);if(!line)throw problem(400,'INVALID_LINE','Alış satırı bulunamadı.');
        await warehouse(connection,payload.warehouseId);await lockProducts(connection,[line.product_id]);
        const [[prior]]=await connection.execute('SELECT COALESCE(SUM(quantity_base),0) AS quantity,COALESCE(SUM(amount_minor),0) AS amount FROM purchase_return_lines WHERE purchase_line_id=?',[line.id]);
        const cumulative=decimal(prior.quantity,{zero:true})+decimal(payload.quantity);if(cumulative>decimal(line.actual_base_quantity))throw problem(409,'QUANTITY_EXCEEDED','İade miktarı alınan miktarı aşıyor.');
        const amount=roundedRatio(cumulative*BigInt(line.total_minor),decimal(line.actual_base_quantity))-BigInt(prior.amount);
        const [[lot]]=await connection.execute('SELECT l.id FROM stock_lots l JOIN goods_receipt_lines r ON r.id=l.receipt_line_id WHERE r.purchase_line_id=?',[line.id]);if(!lot)throw problem(409,'LOT_MISSING','Alış partisi bulunamadı.');
        const documentId=await document(connection,operation,actor,'supplier_return',payload.reason);
        await consume(connection,{documentId,warehouseId:payload.warehouseId,productId:String(line.product_id),quantity:decimal(payload.quantity),lotId:String(lot.id),allowExpired:true});
        const [returned]=await connection.execute('INSERT INTO purchase_returns(purchase_id,stock_document_id,total_minor,reason) VALUES (?,?,?,?)',[id,documentId,amount.toString(),payload.reason]);
        await connection.execute('INSERT INTO purchase_return_lines(return_id,purchase_id,purchase_line_id,quantity_base,amount_minor) VALUES (?,?,?,?,?)',[returned.insertId,id,line.id,payload.quantity,amount.toString()]);
        if(amount>0n){
          const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[purchase.supplier_account_id]);await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);
          const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,1,'return',?,?)",[purchase.supplier_account_id,operation,(-amount).toString(),payload.reason]);await connection.execute('INSERT INTO party_entry_sources(party_entry_id,purchase_id) VALUES (?,?)',[entry.insertId,id]);
        }
        return {id:String(returned.insertId),amountMinor:amount.toString()};
      });
    },
    async pay(id,input,actorId){
      id=identifier(id);object(input,['requestKey','amountMinor','method','shiftId']);const payload={id,amountMinor:money(input.amountMinor),method:input.method,shiftId:identifier(input.shiftId)};if(!['cash','card'].includes(payload.method))throw problem(400,'INVALID_INPUT','Ödeme yöntemi geçersiz.');
      return write('purchase.pay',input,actorId,payload,async(connection,operation,actor)=>{
        const [[purchase]]=await connection.execute("SELECT * FROM purchases WHERE id=? AND status='posted' FOR UPDATE",[id]);if(!purchase)throw problem(409,'PURCHASE_UNAVAILABLE','Kesinleşmiş alış seçin.');
        const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[purchase.supplier_account_id]);await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);
        const [[totals]]=await connection.execute('SELECT (SELECT COALESCE(SUM(amount_minor),0) FROM purchase_payment_allocations WHERE purchase_id=?) AS paid,(SELECT COALESCE(SUM(total_minor),0) FROM purchase_returns WHERE purchase_id=?) AS returned',[id,id]);
        if(BigInt(payload.amountMinor)>BigInt(purchase.total_minor)-BigInt(totals.paid)-BigInt(totals.returned))throw problem(409,'BALANCE_EXCEEDED','Ödeme alışın kalan borcunu aşıyor.');
        await lockShift(connection,payload.shiftId);const [payment]=await connection.execute("INSERT INTO payments(operation_id,sequence_no,method,direction,amount_minor,received_by,shift_id) VALUES (?,1,?,'out',?,?,?)",[operation,payload.method,payload.amountMinor,actor,payload.shiftId]);
        await allocatePartyPayment(connection,{accountId:purchase.supplier_account_id,paymentId:payment.insertId,amount:payload.amountMinor,purchaseId:id});
        const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,1,'payment',?,?)",[purchase.supplier_account_id,operation,(-BigInt(payload.amountMinor)).toString(),`Alış ödemesi ${purchase.document_number}`]);
        await connection.execute('INSERT INTO party_entry_sources(party_entry_id,purchase_id) VALUES (?,?)',[entry.insertId,id]);
        if(payload.method==='cash')await recordCash(connection,{operation,shiftId:payload.shiftId,actor,paymentId:String(payment.insertId),amount:(-BigInt(payload.amountMinor)).toString(),kind:'supplier_payment',reason:`Alış ${purchase.document_number}`});
        return {id,remainingMinor:(BigInt(purchase.total_minor)-BigInt(totals.paid)-BigInt(totals.returned)-BigInt(payload.amountMinor)).toString()};
      });
    },
    async cancelDraft(id,input,actorId){id=identifier(id);object(input,['requestKey']);return write('purchase.cancel',input,actorId,{id},async connection=>{const [[row]]=await connection.execute('SELECT status FROM purchases WHERE id=? FOR UPDATE',[id]);if(!row||row.status!=='draft')throw problem(409,'PURCHASE_POSTED','Yalnız taslak alış iptal edilebilir.');await connection.execute("UPDATE purchases SET status='cancelled' WHERE id=?",[id]);return {id};});}
  };
}
import { allocatePartyPayment } from '../finance/allocate.js';
