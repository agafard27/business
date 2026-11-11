import { randomUUID } from 'node:crypto';
import { identifier, normalizeSearch } from '../catalog/validation.js';
import { object,text,key,problem,conflict,operate,snapshot,decimal,decimalString,roundedRatio,money } from '../business/core.js';
import { consumeLine,reverseUnpreparedLine } from '../stock/sales.js';
import {dateRange} from '../reports/service.js';

const notFound=()=>problem(404,'NOT_FOUND','Hesap bulunamadı.');
async function groupIds(connection,id){
  const [rows]=await connection.execute(`WITH RECURSIVE family AS (SELECT id FROM settlement_groups WHERE id=?
    UNION ALL SELECT g.id FROM settlement_groups g JOIN family f ON g.merged_into_id=f.id) SELECT id FROM family`,[id]);
  return rows.map(row=>String(row.id));
}
export async function readGroup(connection,id){
  const [[row]]=await connection.execute(`SELECT g.*,t.name AS table_name,t.id AS table_id FROM settlement_groups g
    LEFT JOIN table_assignments a ON a.id=(SELECT ta.id FROM table_assignments ta WHERE ta.group_id=g.id
      AND (ta.released_at_utc IS NULL OR g.status<>'open') ORDER BY (ta.released_at_utc IS NULL) DESC,ta.id DESC LIMIT 1)
    LEFT JOIN dining_tables t ON t.id=a.table_id WHERE g.id=?`,[id]);
  if(!row)throw notFound();
  const [checks]=await connection.execute(`SELECT c.*,m.id AS membership_id FROM settlement_group_memberships m JOIN checks c ON c.id=m.check_id
    WHERE m.group_id=? AND m.left_at_utc IS NULL ORDER BY c.id`,[id]);
  const [lines]=await connection.execute(`SELECT l.*,
    (SELECT e.event_type FROM order_line_events e WHERE e.check_line_id=l.id ORDER BY e.id DESC LIMIT 1) AS state,
    (SELECT COALESCE(SUM(a.amount_minor),0) FROM sale_adjustments a WHERE a.check_line_id=l.id AND a.adjustment_type IN ('discount','complimentary')) AS adjustments,
    (SELECT COALESCE(SUM(IF(s.direction='settle',a.quantity,-a.quantity)),0) FROM settlement_allocations a JOIN bill_settlements s ON s.id=a.settlement_id WHERE a.check_line_id=l.id) AS paid_quantity,
    (SELECT COALESCE(SUM(IF(s.direction='settle',a.amount_minor,-CAST(a.amount_minor AS SIGNED))),0) FROM settlement_allocations a JOIN bill_settlements s ON s.id=a.settlement_id WHERE a.check_line_id=l.id) AS paid_minor
    FROM check_lines l JOIN settlement_group_memberships m ON m.check_id=l.check_id AND m.left_at_utc IS NULL WHERE m.group_id=? ORDER BY l.id`,[id]);
  const ids=await groupIds(connection,id);const placeholders=ids.map(()=>'?').join(',');
  const [settlements]=await connection.execute(`SELECT s.id,s.group_id,s.direction,s.amount_minor,s.created_at_utc,p.id AS payment_id,p.method,p.received_by,
    s.credit_entry_id,(SELECT COUNT(*) FROM settlement_allocations a WHERE a.settlement_id=s.id AND a.check_line_id IS NULL) AS unallocated
    FROM bill_settlements s LEFT JOIN payments p ON p.id=s.payment_id WHERE s.group_id IN (${placeholders}) ORDER BY s.id`,ids);
  const mapped=lines.map(line=>({id:String(line.id),checkId:String(line.check_id),productId:String(line.product_id),optionVersionId:String(line.option_version_id),
    productName:line.product_name,optionName:line.option_name,unitCode:line.unit_code,quantity:line.quantity,unitPriceMinor:String(line.unit_price_minor),
    priceBasisQuantity:line.price_basis_quantity,totalMinor:(BigInt(line.total_minor)-BigInt(line.adjustments)).toString(),originalTotalMinor:String(line.total_minor),
    paidQuantity:line.paid_quantity,paidMinor:String(line.paid_minor),note:line.note,stockIssue:typeof line.stock_issue_json==='string'?JSON.parse(line.stock_issue_json):line.stock_issue_json,state:line.state||'submitted',addedBy:String(line.added_by),createdAtUtc:line.created_at_utc}));
  const total=mapped.reduce((sum,line)=>sum+(line.state==='cancelled'?0n:BigInt(line.totalMinor)),0n);
  const settled=settlements.reduce((sum,s)=>sum+(s.direction==='settle'?1n:-1n)*BigInt(s.amount_minor),0n);
  return {id:String(row.id),revision:String(row.revision),status:row.status,mergedIntoId:row.merged_into_id===null?null:String(row.merged_into_id),
    tableId:row.table_id===null?null:String(row.table_id),tableName:row.table_name,openedAtUtc:row.opened_at_utc,billRequestedAtUtc:row.bill_requested_at_utc,
    checks:checks.map(check=>({id:String(check.id),number:check.check_number,type:check.check_type,status:check.status,membershipId:String(check.membership_id)})),
    lines:mapped,totalMinor:total.toString(),settledMinor:settled.toString(),remainingMinor:(total-settled).toString(),
    itemPaymentsAvailable:!settlements.some(s=>Number(s.unallocated)>0),settlements:settlements.map(s=>({id:String(s.id),groupId:String(s.group_id),direction:s.direction,amountMinor:String(s.amount_minor),
      method:s.credit_entry_id===null?s.method:'credit',paymentId:s.payment_id===null?null:String(s.payment_id),createdAtUtc:s.created_at_utc}))};
}
export async function lockGroup(connection,id,revision){
  const [[group]]=await connection.execute('SELECT id,status,revision FROM settlement_groups WHERE id=? FOR UPDATE',[id]);
  if(!group)throw notFound();if(group.status!=='open')throw problem(409,'GROUP_CLOSED','Hesap kapalı veya başka hesaba birleştirilmiş.');
  if(String(group.revision)!==revision)throw conflict();return group;
}
export async function bump(connection,id){await connection.execute('UPDATE settlement_groups SET revision=revision+1 WHERE id=?',[id]);}

async function submitLines(connection,operation,actor,id,items,warehouseId){
  const [[check]]=await connection.execute(`SELECT c.id FROM settlement_group_memberships m JOIN checks c ON c.id=m.check_id WHERE m.group_id=? AND m.left_at_utc IS NULL AND c.status='open' ORDER BY c.id LIMIT 1 FOR UPDATE`,[id]);
  if(!check)throw conflict('Açık adisyon bulunamadı.');
  const [batch]=await connection.execute('INSERT INTO order_batches(check_id,operation_id,submitted_by) VALUES (?,?,?)',[check.id,operation,actor]);
  // Lock products in a deterministic order; a price/catalog edit cannot change a line midway.
  for(const optionId of [...new Set(items.map(item=>item.optionId))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
    await connection.execute('SELECT p.id FROM products p JOIN sale_options o ON o.product_id=p.id WHERE o.id=? FOR UPDATE',[optionId]);
  }
  for(const item of items){
    const [[option]]=await connection.execute(`SELECT o.id,o.name AS option_name,o.is_active,p.id AS product_id,p.name,p.is_active AS product_active,p.product_type,p.stock_mode,p.stock_timing,p.base_unit_id,p.preparation_station_id,
      v.id AS version_id,v.sale_unit_id,v.unit_price_minor,v.price_basis_quantity,v.content_quantity_base,v.requires_weight,u.code AS unit_code,u.decimal_places
      FROM sale_options o JOIN products p ON p.id=o.product_id JOIN sale_option_versions v ON v.id=(SELECT cv.id FROM sale_option_versions cv WHERE cv.sale_option_id=o.id
        AND cv.valid_from_utc<=UTC_TIMESTAMP(6) ORDER BY cv.version DESC LIMIT 1) JOIN units u ON u.id=v.sale_unit_id WHERE o.id=?`,[item.optionId]);
    if(!option||!option.is_active||!option.product_active)throw problem(409,'OPTION_UNAVAILABLE','Seçilen ürün veya servis satışa açık değil.');
    const quantity=decimal(item.quantity);
    if(quantity%(10n**BigInt(6-Number(option.decimal_places)))!==0n)throw problem(400,'INVALID_QUANTITY','Miktar satış biriminin hassasiyetine uymuyor.');
    
    
    const total=roundedRatio(quantity*BigInt(option.unit_price_minor),decimal(option.price_basis_quantity));
    let contentQuantity=option.content_quantity_base;
    if(option.stock_mode==='direct'&&contentQuantity===null){
      if(String(option.sale_unit_id)===String(option.base_unit_id))contentQuantity='1.000000';
      else{const [[conversion]]=await connection.execute('SELECT base_quantity FROM product_unit_conversions WHERE product_id=? AND from_unit_id=? AND is_active=TRUE',[option.product_id,option.sale_unit_id]);if(!conversion)throw problem(409,'CONVERSION_REQUIRED','Servisin gerçek temel miktarını tanımlayın.');contentQuantity=conversion.base_quantity;}
    }
    if(total>9999999999999n)throw problem(400,'AMOUNT_LIMIT','Sipariş tutarı sınırı aşıyor.');
    const [line]=await connection.execute(`INSERT INTO check_lines(check_id,batch_id,product_id,option_version_id,product_name,option_name,unit_code,quantity,unit_price_minor,
      price_basis_quantity,content_quantity_base,subtotal_minor,total_minor,note,added_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [check.id,batch.insertId,option.product_id,option.version_id,option.name,option.option_name,option.unit_code,item.quantity,option.unit_price_minor,option.price_basis_quantity,
        contentQuantity,total.toString(),total.toString(),item.note,actor]);
    await connection.execute('UPDATE check_lines SET stock_mode_snapshot=?,stock_timing_snapshot=?,base_unit_id_snapshot=?,warehouse_id_snapshot=? WHERE id=?',[option.stock_mode,option.stock_timing,option.base_unit_id,warehouseId,line.insertId]);
    await connection.execute("INSERT INTO order_line_events(check_line_id,operation_id,event_type,actor_user_id) VALUES (?,?,'submitted',?)",[line.insertId,operation,actor]);
    const [[recipeLink]]=await connection.execute('SELECT recipe_version_id FROM sale_option_recipes WHERE option_version_id=?',[option.version_id]);
    if(recipeLink)await connection.execute('UPDATE check_lines SET recipe_version_id=? WHERE id=?',[recipeLink.recipe_version_id,line.insertId]);
    if(option.stock_timing!=='preparation'||!option.preparation_station_id)await consumeLine(connection,{lineId:String(line.insertId),warehouseId,operation,actor});
    if(option.product_type==='prepared'&&option.preparation_station_id)await connection.execute('INSERT INTO preparation_tickets(check_line_id,station_id) VALUES (?,?)',[line.insertId,option.preparation_station_id]);
  }
  await bump(connection,id);return {group:await readGroup(connection,id)};
}

export function createSalesService(config){
  const write=(type,permission,input,actorId,payload,action)=>operate(config,{type,permission,requestKey:key(input.requestKey),actorId,payload},action);
  return {
    async list(query={}){object(query,['status','before','from','to']);const status=query.status||'open';if(!['open','closed','merged','all'].includes(status))throw problem(400,'INVALID_INPUT','Hesap durumu geçersiz.');const before=query.before?identifier(query.before):null,range=query.from||query.to?dateRange({from:query.from,to:query.to}):null;return snapshot(config,async connection=>{
      const conditions=[],values=[];if(status!=='all'){conditions.push('status=?');values.push(status);}if(before){conditions.push('id<?');values.push(before);}if(range){conditions.push('opened_at_utc>=? AND opened_at_utc<?');values.push(range.start,range.end);}
      const [rows]=await connection.execute(`SELECT id,status,revision,opened_at_utc FROM settlement_groups ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY id DESC LIMIT 201`,values);
      return {nextCursor:rows.length>200?String(rows[199].id):null,groups:rows.slice(0,200).map(row=>({id:String(row.id),revision:String(row.revision),status:row.status,openedAtUtc:row.opened_at_utc}))};
    });},
    async get(id){id=identifier(id);return snapshot(config,async connection=>({group:await readGroup(connection,id)}));},
    async menu(query={}){
      object(query,['search','favorites']);
      if(query.search!==undefined&&(typeof query.search!=='string'||[...query.search].length>180))throw problem(400,'INVALID_INPUT','Arama en fazla 180 karakter olmalı.');
      const search=normalizeSearch(query.search?.trim()||'');
      if(query.favorites!==undefined&&!['true','false'].includes(query.favorites))throw problem(400,'INVALID_INPUT','Favori filtresi geçersiz.');
      return snapshot(config,async connection=>{
        const [rows]=await connection.query(`SELECT p.id,p.name,p.code,p.category_id,c.name AS category_name,p.product_type,p.stock_mode,p.stock_timing,
          f.product_id IS NOT NULL AS favorite,o.id AS option_id,o.name AS option_name,v.unit_price_minor,v.price_basis_quantity,v.requires_weight,u.code AS unit_code
          FROM products p JOIN sale_options o ON o.product_id=p.id AND o.is_active=TRUE
          JOIN sale_option_versions v ON v.id=(SELECT cv.id FROM sale_option_versions cv WHERE cv.sale_option_id=o.id AND cv.valid_from_utc<=UTC_TIMESTAMP(6) ORDER BY cv.version DESC LIMIT 1)
          JOIN units u ON u.id=v.sale_unit_id LEFT JOIN product_categories c ON c.id=p.category_id LEFT JOIN product_favorites f ON f.product_id=p.id
          WHERE p.is_active=TRUE ORDER BY c.sort_order,p.name,p.id,o.id`);
        const [warehouses]=await connection.query('SELECT id,name FROM warehouses WHERE is_active=TRUE ORDER BY name');
        const [barcodes]=await connection.query('SELECT barcode,product_id,sale_option_id FROM product_barcodes');
        return {warehouses:warehouses.map(row=>({id:String(row.id),name:row.name})),options:rows.filter(row=>(query.favorites!=='true'||row.favorite)&&(!search||normalizeSearch(`${row.name} ${row.code}`).includes(search)||barcodes.some(barcode=>normalizeSearch(barcode.barcode)===search&&String(barcode.product_id)===String(row.id)&&(barcode.sale_option_id===null||String(barcode.sale_option_id)===String(row.option_id))))).map(row=>({productId:String(row.id),name:row.name,code:row.code,categoryName:row.category_name,
          stockMode:row.stock_mode,productType:row.product_type,stockTiming:row.stock_timing,favorite:Boolean(row.favorite),optionId:String(row.option_id),optionName:row.option_name,unitPriceMinor:String(row.unit_price_minor),priceBasisQuantity:row.price_basis_quantity,requiresWeight:Boolean(row.requires_weight),unitCode:row.unit_code,
          barcodes:barcodes.filter(barcode=>String(barcode.product_id)===String(row.id)&&(barcode.sale_option_id===null||String(barcode.sale_option_id)===String(row.option_id))).map(barcode=>barcode.barcode)}))};
      });
    },
    async favorite(id,input,actorId){
      id=identifier(id);object(input,['requestKey','favorite']);if(typeof input.favorite!=='boolean')throw problem(400,'INVALID_INPUT','Favori seçimi geçersiz.');
      return write('sales.favorite','orders.write',input,actorId,{id,favorite:input.favorite},async(connection,_operation,actor)=>{
        const [[product]]=await connection.execute('SELECT id FROM products WHERE id=? FOR SHARE',[id]);if(!product)throw problem(404,'NOT_FOUND','Ürün bulunamadı.');
        if(input.favorite)await connection.execute('INSERT INTO product_favorites(product_id,marked_by) VALUES (?,?) ON DUPLICATE KEY UPDATE marked_by=?',[id,actor,actor]);
        else await connection.execute('DELETE FROM product_favorites WHERE product_id=?',[id]);return {favorite:input.favorite};
      });
    },
    async open(input,actorId){
      object(input,['requestKey','tableId']);const tableId=input.tableId===null?null:identifier(input.tableId);
      return write('sales.open','orders.write',input,actorId,{tableId},async(connection,operation,actor)=>{
        if(tableId){
          const [[table]]=await connection.execute('SELECT is_active FROM dining_tables WHERE id=? FOR UPDATE',[tableId]);
          if(!table||!table.is_active)throw problem(400,'INVALID_TABLE','Masa bulunamadı veya pasif.');
          const [[assigned]]=await connection.execute('SELECT group_id FROM table_assignments WHERE table_id=? AND released_at_utc IS NULL',[tableId]);
          if(assigned)throw problem(409,'TABLE_OCCUPIED','Masanın açık hesabı var. Masa listesini yenileyin.');
        }
        const [group]=await connection.execute('INSERT INTO settlement_groups(opened_by) VALUES (?)',[actor]);const id=String(group.insertId);
        const [check]=await connection.execute('INSERT INTO checks(check_number,check_type,opened_by) VALUES (?,?,?)',[`N-${randomUUID()}`,tableId?'table':'retail',actor]);
        await connection.execute('INSERT INTO settlement_group_memberships(group_id,check_id,operation_id) VALUES (?,?,?)',[id,check.insertId,operation]);
        if(tableId)await connection.execute('INSERT INTO table_assignments(table_id,group_id,operation_id) VALUES (?,?,?)',[tableId,id,operation]);
        return {group:await readGroup(connection,id)};
      });
    },
    async submitForTable(tableId,input,actorId){
      tableId=identifier(tableId);object(input,['requestKey','items','warehouseId']);const warehouseId=input.warehouseId?identifier(input.warehouseId):null;
      if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw problem(400,'INVALID_INPUT','Sipariş 1–100 ürün satırı içermeli.');
      const items=input.items.map(item=>{object(item,['optionId','quantity','note']);return {optionId:identifier(item.optionId),quantity:decimalString(decimal(item.quantity)),note:item.note?text(item.note,1000,'Not'):null};});
      return write('sales.table.submit','orders.write',input,actorId,{tableId,items,warehouseId},async(connection,operation,actor)=>{
        const [[table]]=await connection.execute('SELECT is_active FROM dining_tables WHERE id=? FOR UPDATE',[tableId]);
        if(!table||!table.is_active)throw problem(400,'INVALID_TABLE','Masa bulunamadı veya pasif.');
        const [[assigned]]=await connection.execute('SELECT group_id FROM table_assignments WHERE table_id=? AND released_at_utc IS NULL',[tableId]);
        if(assigned)throw problem(409,'TABLE_OCCUPIED','Masada başka bir hesap açıldı. Taslak gönderilmedi; Masalar ekranından güncel hesabı açın.');
        const [group]=await connection.execute('INSERT INTO settlement_groups(opened_by) VALUES (?)',[actor]);const id=String(group.insertId);
        const [check]=await connection.execute('INSERT INTO checks(check_number,check_type,opened_by) VALUES (?,?,?)',[`N-${randomUUID()}`,'table',actor]);
        await connection.execute('INSERT INTO settlement_group_memberships(group_id,check_id,operation_id) VALUES (?,?,?)',[id,check.insertId,operation]);
        await connection.execute('INSERT INTO table_assignments(table_id,group_id,operation_id) VALUES (?,?,?)',[tableId,id,operation]);
        return submitLines(connection,operation,actor,id,items,warehouseId);
      });
    },
    async submit(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','items','warehouseId']);const revision=identifier(input.revision);const warehouseId=input.warehouseId?identifier(input.warehouseId):null;
      if(!Array.isArray(input.items)||!input.items.length||input.items.length>100)throw problem(400,'INVALID_INPUT','Sipariş 1–100 ürün satırı içermeli.');
      const items=input.items.map(item=>{object(item,['optionId','quantity','note']);return {optionId:identifier(item.optionId),quantity:decimalString(decimal(item.quantity)),note:item.note?text(item.note,1000,'Not'):null};});
      return write('sales.submit','orders.write',input,actorId,{id,revision,items,warehouseId},async(connection,operation,actor)=>{
        await lockGroup(connection,id,revision);
        return submitLines(connection,operation,actor,id,items,warehouseId);
      });
    },
    async cancelLine(id,lineId,input,actorId){
      id=identifier(id);lineId=identifier(lineId);object(input,['requestKey','revision','reason','disposition']);const revision=identifier(input.revision);const reason=text(input.reason,500,'İptal gerekçesi');const disposition=input.disposition||'unprepared';
      if(!['unprepared','waste'].includes(disposition))throw problem(400,'INVALID_INPUT','İptal stok sonucu geçersiz.');
      return write('sales.line.cancel','settings.manage',input,actorId,{id,lineId,revision,reason,disposition},async(connection,operation,actor)=>{
        await lockGroup(connection,id,revision);const group=await readGroup(connection,id);const line=group.lines.find(item=>item.id===lineId);
        if(!line||line.state==='cancelled')throw problem(409,'LINE_UNAVAILABLE','Satır bulunamadı veya zaten iptal.');
        if(group.settledMinor!=='0')throw problem(409,'PAYMENT_EXISTS','Tahsilat bulunan hesapta önce iade/düzeltme yapılmalı.');
        const [[ticket]]=await connection.execute("SELECT id FROM preparation_tickets WHERE check_line_id=? AND status<>'new' AND status<>'cancelled' LIMIT 1",[lineId]);
        if(ticket&&disposition!=='waste')throw problem(409,'PREPARATION_STARTED','Hazırlığı başlamış ürün için fire sonucunu seçin. Stok geri eklenmez.');
        if(disposition==='unprepared')await reverseUnpreparedLine(connection,{lineId,operation,actor});
        await connection.execute("INSERT INTO order_line_events(check_line_id,operation_id,event_type,actor_user_id,reason) VALUES (?,?,'cancelled',?,?)",[lineId,operation,actor,reason]);
        await connection.execute("INSERT INTO sale_adjustments(check_line_id,operation_id,adjustment_type,quantity,amount_minor,reason,actor_user_id) VALUES (?,?,'cancel',?,?,?,?)",[lineId,operation,line.quantity,line.totalMinor,reason,actor]);
        await connection.execute("UPDATE preparation_tickets SET status='cancelled',revision=revision+1 WHERE check_line_id=?",[lineId]);
        await bump(connection,id);return {group:await readGroup(connection,id)};
      });
    },
    async adjust(id,lineId,input,actorId){
      id=identifier(id);lineId=identifier(lineId);object(input,['requestKey','revision','kind','amountMinor','reason']);const revision=identifier(input.revision),reason=text(input.reason,500,'Düzeltme gerekçesi');
      if(!['discount','complimentary'].includes(input.kind))throw problem(400,'INVALID_INPUT','Düzeltme türü geçersiz.');const kind=input.kind,amountMinor=kind==='discount'?money(input.amountMinor):null;
      return write('sales.line.adjust','settings.manage',input,actorId,{id,lineId,revision,kind,amountMinor,reason},async(connection,operation,actor)=>{
        await lockGroup(connection,id,revision);const group=await readGroup(connection,id),line=group.lines.find(item=>item.id===lineId&&item.state!=='cancelled');
        if(!line)throw problem(409,'LINE_UNAVAILABLE','Ürün satırı bulunamadı.');if(group.settledMinor!=='0')throw problem(409,'PAYMENT_EXISTS','Ödeme bulunan hesapta önce iade/düzeltme yapılmalı.');
        const amount=kind==='complimentary'?line.totalMinor:amountMinor;if(BigInt(amount)<=0n||BigInt(amount)>BigInt(line.totalMinor))throw problem(400,'INVALID_INPUT','İndirim kalan satır tutarını aşamaz.');
        await connection.execute('INSERT INTO sale_adjustments(check_line_id,operation_id,adjustment_type,amount_minor,reason,actor_user_id) VALUES (?,?,?,?,?,?)',[lineId,operation,kind,amount,reason,actor]);
        await bump(connection,id);return {group:await readGroup(connection,id)};
      });
    },
    async move(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','tableId','reason']);const revision=identifier(input.revision),tableId=identifier(input.tableId),reason=text(input.reason,500,'Taşıma gerekçesi');
      return write('sales.move','orders.write',input,actorId,{id,revision,tableId,reason},async(connection,operation)=>{
        await lockGroup(connection,id,revision);
        const [[table]]=await connection.execute('SELECT id,is_active FROM dining_tables WHERE id=? FOR UPDATE',[tableId]);
        if(!table||!table.is_active)throw problem(400,'INVALID_TABLE','Hedef masa bulunamadı veya pasif.');
        const [[occupied]]=await connection.execute('SELECT id FROM table_assignments WHERE table_id=? AND released_at_utc IS NULL',[tableId]);
        if(occupied)throw problem(409,'TABLE_OCCUPIED','Hedef masa dolu. Birleştirme işlemini kullanın.');
        await connection.execute('UPDATE table_assignments SET released_at_utc=UTC_TIMESTAMP(6) WHERE group_id=? AND released_at_utc IS NULL',[id]);
        await connection.execute('INSERT INTO table_assignments(table_id,group_id,operation_id) VALUES (?,?,?)',[tableId,id,operation]);
        await bump(connection,id);return {group:await readGroup(connection,id)};
      });
    },
    async requestBill(id,input,actorId){id=identifier(id);object(input,['requestKey','revision']);const revision=identifier(input.revision);return write('sales.bill.request','orders.write',input,actorId,{id,revision},async connection=>{await lockGroup(connection,id,revision);await connection.execute('UPDATE settlement_groups SET bill_requested_at_utc=UTC_TIMESTAMP(6),revision=revision+1 WHERE id=?',[id]);return {group:await readGroup(connection,id)};});},
    async merge(id,input,actorId){
      id=identifier(id);object(input,['requestKey','revision','targetId','targetRevision','reason']);const revision=identifier(input.revision),targetId=identifier(input.targetId),targetRevision=identifier(input.targetRevision),reason=text(input.reason,500,'Birleştirme gerekçesi');
      if(id===targetId)throw problem(400,'INVALID_INPUT','Hesap kendisiyle birleştirilemez.');
      return write('sales.merge','orders.write',input,actorId,{id,revision,targetId,targetRevision,reason},async(connection,operation,actor)=>{
        for(const groupId of [id,targetId].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await lockGroup(connection,groupId,groupId===id?revision:targetRevision);
        const [members]=await connection.execute('SELECT id,check_id FROM settlement_group_memberships WHERE group_id=? AND left_at_utc IS NULL FOR UPDATE',[id]);
        for(const member of members){
          await connection.execute('UPDATE settlement_group_memberships SET left_at_utc=UTC_TIMESTAMP(6) WHERE id=?',[member.id]);
          await connection.execute('INSERT INTO settlement_group_memberships(group_id,check_id,operation_id) VALUES (?,?,?)',[targetId,member.check_id,operation]);
        }
        await connection.execute('UPDATE table_assignments SET released_at_utc=UTC_TIMESTAMP(6) WHERE group_id=? AND released_at_utc IS NULL',[id]);
        await connection.execute("UPDATE settlement_groups SET status='merged',merged_into_id=?,revision=revision+1 WHERE id=?",[targetId,id]);
        await connection.execute('INSERT INTO group_merges(source_group_id,target_group_id,operation_id,merged_by,reason) VALUES (?,?,?,?,?)',[id,targetId,operation,actor,reason]);
        await bump(connection,targetId);return {group:await readGroup(connection,targetId)};
      });
    }
  };
}
