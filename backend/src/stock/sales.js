import { decimal,decimalString,problem } from '../business/core.js';
import { lockProducts,warehouse,document,consume,moveStock } from './core.js';

async function consumeConfiguredLine(connection,{lineId,warehouseId,operation,actor}){
  const [[line]]=await connection.execute(`SELECT l.*,COALESCE(l.stock_mode_snapshot,p.stock_mode) AS stock_mode,COALESCE(l.base_unit_id_snapshot,p.base_unit_id) AS base_unit_id,p.preparation_station_id,v.sale_unit_id,COALESCE(l.stock_timing_snapshot,p.stock_timing) AS stock_timing
    FROM check_lines l JOIN products p ON p.id=l.product_id JOIN sale_option_versions v ON v.id=l.option_version_id WHERE l.id=?`,[lineId]);
  const [[prior]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE check_line_id=?',[lineId]);if(Number(prior.count))return;
  if(line.stock_mode!=='none'&&line.stock_timing==='manual')throw problem(409,'STOCK_RULE_REQUIRED','Satış için otomatik stok aşaması tanımlanmalı.');
  if(line.stock_timing==='preparation'&&!line.preparation_station_id)throw problem(409,'STATION_REQUIRED','Hazırlık alanı tanımlanmalı.');
  const required=[];const quantity=decimal(line.quantity);
  if(line.stock_mode==='direct'){
    let factor;
    if(line.content_quantity_base!==null)factor=decimal(line.content_quantity_base);
    else if(String(line.sale_unit_id)===String(line.base_unit_id))factor=1000000n;
    else{
      const [[conversion]]=await connection.execute('SELECT base_quantity FROM product_unit_conversions WHERE product_id=? AND from_unit_id=? AND is_active=TRUE',[line.product_id,line.sale_unit_id]);
      if(!conversion)throw problem(409,'CONVERSION_REQUIRED','Ürünün doğrulanmış servis içeriğini veya birim dönüşümünü tanımlayın.');factor=decimal(conversion.base_quantity);
    }
    if(quantity*factor%1000000n)throw problem(400,'QUANTITY_PRECISION','Tüketim miktarı altı ondalık basamağa sığmıyor.');
    required.push({productId:String(line.product_id),quantity:quantity*factor/1000000n});
  }else if(line.stock_mode==='recipe'){
    const [[recipe]]=await connection.execute('SELECT recipe_version_id,recipe_multiplier FROM sale_option_recipes WHERE option_version_id=?',[line.option_version_id]);
    if(!recipe)throw problem(409,'RECIPE_REQUIRED','Servise doğrulanmış reçete bağlayın.');
    const [ingredients]=await connection.execute('SELECT product_id,quantity_base FROM recipe_ingredients WHERE recipe_version_id=?',[recipe.recipe_version_id]);
    if(!ingredients.length)throw problem(409,'RECIPE_REQUIRED','Reçete malzemeleri eksik.');
    for(const item of ingredients){const numerator=quantity*decimal(recipe.recipe_multiplier)*decimal(item.quantity_base);if(numerator%1000000000000n)throw problem(400,'QUANTITY_PRECISION','Reçete tüketimi altı ondalık basamağa sığmıyor.');required.push({productId:String(item.product_id),quantity:numerator/1000000000000n});}
  }
  const [components]=await connection.execute('SELECT component_product_id,quantity_base FROM sale_option_components WHERE option_version_id=?',[line.option_version_id]);
  for(const item of components){const amount=quantity*decimal(item.quantity_base);if(amount%1000000n)throw problem(400,'QUANTITY_PRECISION','Ambalaj tüketimi altı ondalık basamağa sığmıyor.');required.push({productId:String(item.component_product_id),quantity:amount/1000000n});}
  if(!required.length)return;
  if(line.warehouse_id_snapshot!==null){if(warehouseId&&String(line.warehouse_id_snapshot)!==String(warehouseId))throw problem(409,'WAREHOUSE_CHANGED','Siparişin kayıtlı tüketim deposunu kullanın.');warehouseId=String(line.warehouse_id_snapshot);}
  if(!warehouseId)throw problem(409,'WAREHOUSE_REQUIRED','Stok tüketimi için depo seçin.');
  await warehouse(connection,warehouseId);await lockProducts(connection,required.map(item=>item.productId));
  const [[existing]]=await connection.execute('SELECT id FROM stock_documents WHERE operation_id=?',[operation]);
  const documentId=existing?String(existing.id):await document(connection,operation,actor,'sale','Sipariş stok tüketimi');
  for(const item of required)await consume(connection,{documentId,warehouseId,productId:item.productId,quantity:item.quantity,lineId});
}
export async function reverseUnpreparedLine(connection,{lineId,operation,actor}){
  const [movements]=await connection.execute('SELECT * FROM stock_movements WHERE check_line_id=? ORDER BY id',[lineId]);
  if(!movements.length)return;
  await lockProducts(connection,movements.map(item=>item.product_id));
  const documentId=await document(connection,operation,actor,'correction','Hazırlanmamış sipariş iptali');
  for(const movement of movements){
    if(!String(movement.quantity_base).startsWith('-'))throw problem(409,'STOCK_REVERSAL_EXISTS','Satır stok düzeltmesini kontrol edin.');
    await moveStock(connection,{documentId,warehouseId:String(movement.warehouse_id),productId:String(movement.product_id),lotId:movement.lot_id,quantity:decimal(String(movement.quantity_base).slice(1)),unitCost:movement.unit_cost_minor,lineId});
    const [[last]]=await connection.execute('SELECT MAX(id) AS id FROM stock_movements WHERE document_id=?',[documentId]);
    await connection.execute('UPDATE stock_movements SET reversal_of_id=? WHERE id=?',[movement.id,last.id]);
  }
}

// Stock setup/availability must not block a valid customer order. A complete line
// is consumed or its attempt is rolled back and left visible for the manager.
const pendingCodes=new Set(['INSUFFICIENT_STOCK','COST_UNKNOWN','COST_LIMIT','RECIPE_REQUIRED','CONVERSION_REQUIRED','WAREHOUSE_REQUIRED','WAREHOUSE_INVALID','STOCK_PRODUCT_INVALID','STOCK_RULE_REQUIRED','STATION_REQUIRED']);
export async function consumeLine(connection,values){
  await connection.query('SAVEPOINT sale_stock_attempt');
  try{
    await consumeConfiguredLine(connection,values);
    await connection.execute('UPDATE check_lines SET stock_issue_json=NULL WHERE id=?',[values.lineId]);
    await connection.query('RELEASE SAVEPOINT sale_stock_attempt');return {resolved:true};
  }catch(error){
    await connection.query('ROLLBACK TO SAVEPOINT sale_stock_attempt');await connection.query('RELEASE SAVEPOINT sale_stock_attempt');
    if(!pendingCodes.has(error.code))throw error;
    const issue={code:error.code,message:error.title,recordedAtUtc:new Date().toISOString()};
    await connection.execute('UPDATE check_lines SET stock_issue_json=? WHERE id=?',[JSON.stringify(issue),values.lineId]);
    return {resolved:false,issue};
  }
}
