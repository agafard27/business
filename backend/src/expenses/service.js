import { identifier } from '../catalog/validation.js';
import { object,text,key,money,problem,operate,snapshot,dateOnly } from '../business/core.js';
import { lockShift,recordCash } from '../sales/payments.js';
import { allocatePartyPayment } from '../finance/allocate.js';

export function createExpenseService(config){
  const write=(type,input,actorId,payload,action)=>operate(config,{type,permission:'expenses.manage',actorId,requestKey:key(input.requestKey),payload},action);
  return {
    async list(){return snapshot(config,async connection=>{
      const [categories]=await connection.query('SELECT id,name FROM expense_categories WHERE is_active=TRUE ORDER BY name');
      const [staff]=await connection.query('SELECT id,display_name AS name FROM app_users WHERE is_active=TRUE ORDER BY display_name');
      const [shifts]=await connection.query("SELECT s.id,r.name FROM cash_shifts s JOIN cash_registers r ON r.id=s.cash_register_id WHERE s.status='open' ORDER BY r.name");
      const [suppliers]=await connection.query('SELECT id,name FROM parties WHERE is_active=TRUE AND is_supplier=TRUE ORDER BY name LIMIT 1000');
      const [rows]=await connection.query(`SELECT e.id,e.description,e.expense_type,e.total_minor,e.incurred_at_utc,e.attachment_id,e.staff_user_id,c.name AS category_name,
        COALESCE((SELECT SUM(a.amount_minor) FROM expense_payment_allocations a WHERE a.expense_id=e.id),0) AS paid FROM expenses e JOIN expense_categories c ON c.id=e.category_id ORDER BY e.id DESC LIMIT 300`);
      const [equipment]=await connection.query('SELECT id,name,serial_number,acquired_at,retired_at,expense_id FROM equipment ORDER BY id DESC LIMIT 300');
      const ids=rows=>rows.map(row=>({id:String(row.id),name:row.name}));
      return {categories:ids(categories),staff:ids(staff),shifts:ids(shifts),suppliers:ids(suppliers),expenses:rows.map(row=>({id:String(row.id),description:row.description,type:row.expense_type,staffId:row.staff_user_id===null?null:String(row.staff_user_id),categoryName:row.category_name,totalMinor:String(row.total_minor),paidMinor:String(row.paid),remainingMinor:(BigInt(row.total_minor)-BigInt(row.paid)).toString(),attachmentId:row.attachment_id===null?null:String(row.attachment_id),incurredAtUtc:row.incurred_at_utc})),equipment:equipment.map(row=>({id:String(row.id),name:row.name,serialNumber:row.serial_number,expenseId:String(row.expense_id),acquiredAt:row.acquired_at,retiredAt:row.retired_at}))};
    });},
    async category(input,actorId){object(input,['requestKey','name']);const name=text(input.name,100,'Gider kategorisi');return write('expense.category.create',input,actorId,{name},async connection=>{const [result]=await connection.execute('INSERT INTO expense_categories(name) VALUES (?)',[name]);return {id:String(result.insertId)};});},
    async retire(id,input,actorId){id=identifier(id);object(input,['requestKey','reason','date']);const payload={id,reason:text(input.reason,500,'Envanterden çıkarma gerekçesi'),date:dateOnly(input.date)};if(!payload.date)throw problem(400,'INVALID_INPUT','Çıkarma tarihini girin.');return write('expense.equipment.retire',input,actorId,payload,async connection=>{const [[row]]=await connection.execute('SELECT acquired_at,retired_at FROM equipment WHERE id=? FOR UPDATE',[id]);if(!row||row.retired_at||new Date(row.acquired_at).toISOString().slice(0,10)>payload.date)throw problem(409,'EQUIPMENT_UNAVAILABLE','Ekipmanı ve çıkarma tarihini kontrol edin.');await connection.execute('UPDATE equipment SET retired_at=? WHERE id=?',[payload.date,id]);return {id};});},
    async create(input,actorId){
      object(input,['requestKey','categoryId','type','description','totalMinor','staffId','supplierId','equipmentName','serialNumber','attachmentId','date','dueDate']);
      const payload={categoryId:identifier(input.categoryId),type:input.type,description:text(input.description,500,'Gider açıklaması'),totalMinor:money(input.totalMinor),staffId:input.staffId?identifier(input.staffId):null,supplierId:input.supplierId?identifier(input.supplierId):null,
        equipmentName:input.type==='equipment'?text(input.equipmentName,180,'Ekipman adı'):null,serialNumber:input.serialNumber?text(input.serialNumber,120,'Seri numarası'):null,attachmentId:input.attachmentId?identifier(input.attachmentId):null,date:dateOnly(input.date),dueDate:dateOnly(input.dueDate)};
      if(!['operating','equipment','staff_payment','staff_advance'].includes(payload.type)||(['staff_payment','staff_advance'].includes(payload.type)&&!payload.staffId))throw problem(400,'INVALID_INPUT','Gider türünü ve personeli kontrol edin.');
      return write('expense.create',input,actorId,payload,async(connection,operation,actor)=>{
        let accountId=null;
        if(payload.supplierId){
          const [[supplier]]=await connection.execute('SELECT id FROM parties WHERE id=? AND is_supplier=TRUE AND is_active=TRUE FOR UPDATE',[payload.supplierId]);if(!supplier)throw problem(400,'INVALID_SUPPLIER','Etkin tedarikçi seçin.');
          await connection.execute("INSERT INTO party_accounts(party_id,account_type) VALUES (?,'payable') ON DUPLICATE KEY UPDATE party_id=party_accounts.party_id",[payload.supplierId]);
          const [[account]]=await connection.execute("SELECT id FROM party_accounts WHERE party_id=? AND account_type='payable'",[payload.supplierId]);accountId=String(account.id);
        }
        const incurredAt=payload.date?new Date(`${payload.date}T12:00:00+03:00`).toISOString().slice(0,19).replace('T',' '):null;
        const [expense]=await connection.execute('INSERT INTO expenses(category_id,expense_type,supplier_account_id,staff_user_id,description,total_minor,operation_id,created_by,incurred_at_utc,attachment_id,due_date) VALUES (?,?,?,?,?,?,?,?,COALESCE(?,UTC_TIMESTAMP(6)),?,?)',[payload.categoryId,payload.type,accountId,payload.staffId,payload.description,payload.totalMinor,operation,actor,incurredAt,payload.attachmentId,payload.dueDate]);
        if(accountId){const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description,due_date) VALUES (?,?,1,'expense',?,?,?)",[accountId,operation,payload.totalMinor,payload.description,payload.dueDate]);await connection.execute('INSERT INTO party_entry_sources(party_entry_id,expense_id) VALUES (?,?)',[entry.insertId,expense.insertId]);}
        if(payload.type==='equipment')await connection.execute('INSERT INTO equipment(expense_id,name,serial_number,acquired_at) VALUES (?,?,?,COALESCE(?,UTC_DATE()))',[expense.insertId,payload.equipmentName,payload.serialNumber,payload.date]);
        return {id:String(expense.insertId)};
      });
    },
    async pay(id,input,actorId){
      id=identifier(id);object(input,['requestKey','amountMinor','method','shiftId']);const payload={id,amountMinor:money(input.amountMinor),method:input.method,shiftId:identifier(input.shiftId)};
      if(!['cash','card'].includes(payload.method))throw problem(400,'INVALID_INPUT','Ödeme yöntemi geçersiz.');
      return write('expense.pay',input,actorId,payload,async(connection,operation,actor)=>{
        const [[expense]]=await connection.execute('SELECT * FROM expenses WHERE id=? FOR UPDATE',[id]);if(!expense)throw problem(404,'NOT_FOUND','Gider bulunamadı.');
        if(expense.supplier_account_id){const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[expense.supplier_account_id]);await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);}
        const [[paid]]=await connection.execute('SELECT COALESCE(SUM(amount_minor),0) AS amount FROM expense_payment_allocations WHERE expense_id=?',[id]);if(BigInt(paid.amount)+BigInt(payload.amountMinor)>BigInt(expense.total_minor))throw problem(409,'BALANCE_EXCEEDED','Ödeme giderin kalan tutarını aşıyor.');
        await lockShift(connection,payload.shiftId);
        const [payment]=await connection.execute("INSERT INTO payments(operation_id,sequence_no,method,direction,amount_minor,received_by,shift_id) VALUES (?,1,?,'out',?,?,?)",[operation,payload.method,payload.amountMinor,actor,payload.shiftId]);
        if(expense.supplier_account_id)await allocatePartyPayment(connection,{accountId:expense.supplier_account_id,paymentId:payment.insertId,amount:payload.amountMinor,expenseId:id});
        else await connection.execute('INSERT INTO expense_payment_allocations(expense_id,payment_id,amount_minor) VALUES (?,?,?)',[id,payment.insertId,payload.amountMinor]);
        if(payload.method==='cash')await recordCash(connection,{operation,shiftId:payload.shiftId,actor,paymentId:String(payment.insertId),amount:(-BigInt(payload.amountMinor)).toString(),kind:'expense_payment',reason:expense.description});
        if(expense.supplier_account_id){
          const [[account]]=await connection.execute('SELECT party_id FROM party_accounts WHERE id=?',[expense.supplier_account_id]);await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[account.party_id]);
          const [entry]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,1,'payment',?,?)",[expense.supplier_account_id,operation,(-BigInt(payload.amountMinor)).toString(),expense.description]);
          await connection.execute('INSERT INTO party_entry_sources(party_entry_id,expense_id) VALUES (?,?)',[entry.insertId,id]);
        }
        return {id,remainingMinor:(BigInt(expense.total_minor)-BigInt(paid.amount)-BigInt(payload.amountMinor)).toString()};
      });
    }
  };
}
