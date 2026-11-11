import { decimal,decimalString,roundedRatio,problem,storedDecimal } from '../business/core.js';

export async function lockProducts(connection,ids){
  const result=new Map();
  for(const id of [...new Set(ids.map(String))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
    const [[row]]=await connection.execute('SELECT * FROM products WHERE id=? FOR UPDATE',[id]);
    if(!row||!row.is_active||!row.base_unit_id)throw problem(409,'STOCK_PRODUCT_INVALID','Stok için etkin ve temel birimi tanımlı ürün seçin.');result.set(id,row);
  }return result;
}
export async function warehouse(connection,id){
  const [[row]]=await connection.execute('SELECT id FROM warehouses WHERE id=? AND is_active=TRUE FOR SHARE',[id]);
  if(!row)throw problem(400,'WAREHOUSE_INVALID','Etkin depo seçin.');
}
export async function document(connection,operation,actor,type,reason){
  const [result]=await connection.execute('INSERT INTO stock_documents(operation_id,document_type,reason,actor_user_id) VALUES (?,?,?,?)',[operation,type,reason,actor]);return String(result.insertId);
}
export async function moveStock(connection,{documentId,warehouseId,productId,lotId=null,quantity,unitCost=null,lineId=null,receiptLineId=null,batchId=null}){
  if(unitCost!==null&&!/^\d{1,14}(\.\d{1,6})?$/.test(String(unitCost)))throw problem(400,'COST_LIMIT','Birim maliyeti kayıt hassasiyetini aşıyor.');
  const [[next]]=await connection.execute('SELECT COALESCE(MAX(sequence_no),0)+1 AS seq FROM stock_movements WHERE document_id=?',[documentId]);
  await connection.execute(`INSERT INTO stock_movements(document_id,sequence_no,warehouse_id,product_id,lot_id,quantity_base,unit_cost_minor,check_line_id,receipt_line_id,production_batch_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`,[documentId,next.seq,warehouseId,productId,lotId,decimalString(quantity),unitCost,lineId,receiptLineId,batchId]);
}
export async function stockBalance(connection,warehouseId,productId,lotId=undefined){
  const [[row]]=await connection.execute(`SELECT COALESCE(SUM(quantity_base),0) AS quantity FROM stock_movements WHERE warehouse_id=? AND product_id=?${lotId===undefined?'':' AND lot_id <=> ?'}`,[warehouseId,productId,...(lotId===undefined?[]:[lotId])]);
  return storedDecimal(row.quantity);
}
export async function consume(connection,{documentId,warehouseId,productId,quantity,lineId=null,batchId=null,lotId=undefined,allowExpired=false}){
  if(quantity<=0n)throw problem(400,'INVALID_INPUT','Tüketim miktarı pozitif olmalı.');
  const [balances]=await connection.execute(`SELECT m.lot_id,l.expires_at_utc,COALESCE(SUM(m.quantity_base),0) AS quantity,
    SUM(m.quantity_base*m.unit_cost_minor)/NULLIF(SUM(m.quantity_base),0) AS unit_cost,
    SUM(m.unit_cost_minor IS NULL) AS unknown_cost FROM stock_movements m LEFT JOIN stock_lots l ON l.id=m.lot_id
    WHERE m.warehouse_id=? AND m.product_id=?${lotId===undefined?'':' AND m.lot_id <=> ?'} GROUP BY m.lot_id,l.expires_at_utc
    HAVING SUM(m.quantity_base)>0 ORDER BY l.expires_at_utc IS NULL,l.expires_at_utc,m.lot_id`,[warehouseId,productId,...(lotId===undefined?[]:[lotId])]);
  const available=balances.filter(row=>allowExpired||!row.expires_at_utc||new Date(row.expires_at_utc).getTime()>Date.now());
  if(available.reduce((sum,row)=>sum+storedDecimal(row.quantity),0n)<quantity)throw problem(409,'INSUFFICIENT_STOCK','Yeterli kullanılabilir stok yok.');
  let remaining=quantity,totalCostScaled=0n;const parts=[];
  for(const row of available){
    if(!remaining)break;
    if(Number(row.unknown_cost)||row.unit_cost===null)throw problem(409,'COST_UNKNOWN','Bu stoğun maliyet dayanağı eksik.');
    const amount=storedDecimal(row.quantity)<remaining?storedDecimal(row.quantity):remaining;
    // MySQL returns more than six fractional digits for this ratio; round once to storage precision.
    const [whole,fraction='']=String(row.unit_cost).split('.');let unitCost=BigInt(whole)*1000000n+BigInt(fraction.slice(0,6).padEnd(6,'0'));
    if(Number(fraction[6]||0)>=5)unitCost++;
    if(unitCost<0n)throw problem(409,'COST_UNKNOWN','Stok maliyeti doğrulanamadı.');
    await moveStock(connection,{documentId,warehouseId,productId,lotId:row.lot_id,quantity:-amount,unitCost:decimalString(unitCost),lineId,batchId});
    totalCostScaled+=amount*unitCost;remaining-=amount;parts.push({lotId:row.lot_id===null?null:String(row.lot_id),quantity:decimalString(amount),unitCost:decimalString(unitCost)});
  }
  return {totalCostScaled,totalCostMinor:roundedRatio(totalCostScaled,1000000000000n),parts};
}
