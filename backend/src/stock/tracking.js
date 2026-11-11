import {identifier} from '../catalog/validation.js';
import {object,key,text,decimal,decimalString,problem,conflict,operate,assertPermission} from '../business/core.js';
import {lockProducts,warehouse,document,stockBalance,consume} from './core.js';
import {consumeLine} from './sales.js';

export async function activateDirectSales(connection,product,actor){
  await assertPermission(connection,actor,'catalog.manage');
  if(!['ready','prepared'].includes(product.product_type)||product.stock_mode!=='none')throw problem(409,'TRACKING_REVIEW_REQUIRED','Bu ürünün mevcut reçete/stok kuralını tanımlardan kontrol edin.');
  const [options]=await connection.execute(`SELECT v.sale_unit_id,v.content_quantity_base,v.id,
    (SELECT COUNT(*) FROM sale_option_recipes r WHERE r.option_version_id=v.id) AS recipes,
    (SELECT COUNT(*) FROM sale_option_components c WHERE c.option_version_id=v.id) AS components
    FROM sale_options o JOIN sale_option_versions v ON v.id=(SELECT id FROM sale_option_versions WHERE sale_option_id=o.id ORDER BY version DESC LIMIT 1)
    WHERE o.product_id=? AND o.is_active=TRUE`,[product.id]);
  if(!options.length||options.some(row=>String(row.sale_unit_id)!==String(product.base_unit_id)||(row.content_quantity_base!==null&&decimal(row.content_quantity_base)!==1000000n)||Number(row.recipes)||Number(row.components)))throw problem(409,'TRACKING_REVIEW_REQUIRED','Servis birimi, içeriği veya reçetesi farklı. Ürünün stok kuralını ayrıntılı tanımlayın.');
  await connection.execute("UPDATE products SET stock_mode='direct',stock_timing='sale',revision=revision+1 WHERE id=?",[product.id]);
}

export function createStockTrackingService(config){return {
  async enableSalesTracking(input,actorId){
    object(input,['requestKey','productId','warehouseId','revision','expectedQuantity','historicalLineIds','reason']);
    if(input.historicalLineIds!==undefined&&!Array.isArray(input.historicalLineIds))throw problem(400,'INVALID_INPUT','Satış satırları liste olmalı.');
    const payload={productId:identifier(input.productId),warehouseId:identifier(input.warehouseId),revision:identifier(input.revision),reason:text(input.reason,500,'Gerekçe'),expectedQuantity:decimalString(decimal(input.expectedQuantity,{zero:true})),historicalLineIds:(input.historicalLineIds||[]).map(identifier)};
    if(!Array.isArray(input.historicalLineIds??[])||payload.historicalLineIds.length>100||new Set(payload.historicalLineIds).size!==payload.historicalLineIds.length)throw problem(400,'INVALID_INPUT','Düzeltilecek satış satırlarını kontrol edin.');
    return operate(config,{type:'stock.sales-tracking.enable',permission:'catalog.manage',actorId,requestKey:key(input.requestKey),payload},async(connection,operation,actor)=>{
      // Match cancellation lock order: affected account, then product.
      for(const lineId of [...payload.historicalLineIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await connection.execute('SELECT g.id FROM settlement_groups g JOIN settlement_group_memberships m ON m.group_id=g.id AND m.left_at_utc IS NULL JOIN check_lines l ON l.check_id=m.check_id WHERE l.id=? FOR UPDATE',[lineId]);
      const product=(await lockProducts(connection,[payload.productId])).get(payload.productId);if(String(product.revision)!==payload.revision)throw conflict();await warehouse(connection,payload.warehouseId);
      const before=await stockBalance(connection,payload.warehouseId,payload.productId);if(before!==decimal(payload.expectedQuantity,{zero:true}))throw problem(409,'STOCK_CHANGED','Stok değişti. Güncel miktarı kontrol edin.');
      const lines=[];
      if(payload.historicalLineIds.length){
        await assertPermission(connection,actor,'stock.manage');
        // Historical repair is deliberately limited to an unambiguous opening.
        const [history]=await connection.execute('SELECT m.*,d.document_type FROM stock_movements m JOIN stock_documents d ON d.id=m.document_id WHERE m.product_id=? AND m.warehouse_id=? ORDER BY m.id',[payload.productId,payload.warehouseId]);
        if(history.length!==1||history[0].document_type!=='opening'||decimal(history[0].quantity_base)<=0n)throw problem(409,'STOCK_REVIEW_REQUIRED','Ara hareket/sayım var. Geçmiş satış için stok incelemesi gerekir.');
        const [pending]=await connection.execute("SELECT l.id FROM check_lines l WHERE l.product_id=? AND l.warehouse_id_snapshot=? AND l.stock_mode_snapshot='none' AND l.created_at_utc>? AND (SELECT event_type FROM order_line_events WHERE check_line_id=l.id ORDER BY id DESC LIMIT 1)<>'cancelled' AND NOT EXISTS(SELECT 1 FROM stock_movements WHERE check_line_id=l.id) ORDER BY l.id",[payload.productId,payload.warehouseId,history[0].created_at_utc]);
        const supplied=[...payload.historicalLineIds].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);if(JSON.stringify(pending.map(row=>String(row.id)))!==JSON.stringify(supplied))throw problem(409,'STOCK_CHANGED','Takipsiz satış listesi değişti. Satışları yeniden kontrol edin.');
        for(const id of payload.historicalLineIds){
          const [[line]]=await connection.execute('SELECT l.*,v.sale_unit_id FROM check_lines l JOIN sale_option_versions v ON v.id=l.option_version_id WHERE l.id=? FOR UPDATE',[id]);
          const [[last]]=await connection.execute('SELECT event_type FROM order_line_events WHERE check_line_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE',[id]);
          const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE check_line_id=?',[id]);
          const [[related]]=await connection.execute('SELECT (SELECT COUNT(*) FROM sale_option_components WHERE option_version_id=?)+(SELECT COUNT(*) FROM sale_option_recipes WHERE option_version_id=?) AS count',[line?.option_version_id||'0',line?.option_version_id||'0']);
          if(!line||String(line.product_id)!==payload.productId||line.stock_mode_snapshot!=='none'||String(line.warehouse_id_snapshot)!==payload.warehouseId||String(line.base_unit_id_snapshot)!==String(product.base_unit_id)||String(line.sale_unit_id)!==String(product.base_unit_id)||(line.content_quantity_base!==null&&decimal(line.content_quantity_base)!==1000000n)||new Date(line.created_at_utc)<=new Date(history[0].created_at_utc)||last?.event_type==='cancelled'||Number(used.count)||Number(related.count))throw problem(409,'LINE_REVIEW_REQUIRED','Satışın birimi, deposu, zamanı veya stok geçmişi düzeltmeye uygun değil.');
          lines.push(line);
        }
      }
      await activateDirectSales(connection,product,actor);
      if(lines.length){const documentId=await document(connection,operation,actor,'correction',payload.reason);for(const line of lines)await consume(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.productId,quantity:decimal(line.quantity),lineId:String(line.id)});}
      return {productId:payload.productId,beforeQuantity:decimalString(before),quantity:decimalString(await stockBalance(connection,payload.warehouseId,payload.productId)),repairedLineIds:payload.historicalLineIds,stockMode:'direct',stockTiming:'sale'};
    });
  },
  async retryStockIssue(id,input,actorId){
    id=identifier(id);object(input,['requestKey','warehouseId']);const payload={id,warehouseId:input.warehouseId?identifier(input.warehouseId):null};
    return operate(config,{type:'stock.sale.retry',permission:'stock.manage',actorId,requestKey:key(input.requestKey),payload},async(connection,operation,actor)=>{
      await connection.execute('SELECT g.id FROM settlement_groups g JOIN settlement_group_memberships m ON m.group_id=g.id AND m.left_at_utc IS NULL JOIN check_lines l ON l.check_id=m.check_id WHERE l.id=? FOR UPDATE',[id]);
      const [[line]]=await connection.execute('SELECT stock_issue_json FROM check_lines WHERE id=? FOR UPDATE',[id]);
      const [[event]]=await connection.execute('SELECT event_type FROM order_line_events WHERE check_line_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE',[id]);
      if(!line||event?.event_type==='cancelled')throw problem(409,'LINE_UNAVAILABLE','İptal edilmiş veya bulunamayan satış kontrol edilemez.');
      if(!line.stock_issue_json)return {resolved:true};
      return consumeLine(connection,{lineId:id,warehouseId:payload.warehouseId,operation,actor});
    });
  }
};}
