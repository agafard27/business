import {createStockTrackingService,activateDirectSales} from './tracking.js';
import { randomUUID } from 'node:crypto';
import { identifier } from '../catalog/validation.js';
import { object,text,key,money,decimal,decimalString,roundedRatio,problem,operate,snapshot,expiryDate } from '../business/core.js';
import { lockProducts,warehouse,document,moveStock,stockBalance,consume } from './core.js';

export function createStockService(config){
  const write=(type,input,actorId,payload,action)=>operate(config,{type,permission:'stock.manage',actorId,requestKey:key(input.requestKey),payload},action);
  return {
    ...createStockTrackingService(config),
    async list(){return snapshot(config,async connection=>{
      const [issues]=await connection.query(`SELECT l.id,l.product_name,l.quantity,l.unit_code,l.stock_issue_json,m.group_id FROM check_lines l JOIN settlement_group_memberships m ON m.check_id=l.check_id AND m.left_at_utc IS NULL WHERE l.stock_issue_json IS NOT NULL AND (SELECT e.event_type FROM order_line_events e WHERE e.check_line_id=l.id ORDER BY e.id DESC LIMIT 1)<>'cancelled' ORDER BY l.id DESC LIMIT 200`);
      const [warehouses]=await connection.query('SELECT id,code,name FROM warehouses WHERE is_active=TRUE ORDER BY name');
      const [balances]=await connection.query(`SELECT m.warehouse_id,m.product_id,p.name,u.code AS unit_code,COALESCE(SUM(m.quantity_base),0) AS quantity,p.reorder_quantity
        FROM stock_movements m JOIN products p ON p.id=m.product_id LEFT JOIN units u ON u.id=p.base_unit_id GROUP BY m.warehouse_id,m.product_id,p.name,u.code,p.reorder_quantity ORDER BY p.name`);
      const [lots]=await connection.query(`SELECT l.id,l.product_id,l.lot_code,l.expires_at_utc,m.warehouse_id,SUM(m.quantity_base) AS quantity FROM stock_lots l
        JOIN stock_movements m ON m.lot_id=l.id GROUP BY l.id,l.product_id,l.lot_code,l.expires_at_utc,m.warehouse_id HAVING SUM(m.quantity_base)<>0 ORDER BY l.expires_at_utc IS NULL,l.expires_at_utc LIMIT 500`);
      const [movements]=await connection.query(`SELECT m.id,p.name,m.warehouse_id,m.quantity_base,d.document_type,d.reason,m.created_at_utc FROM stock_movements m JOIN products p ON p.id=m.product_id JOIN stock_documents d ON d.id=m.document_id ORDER BY m.id DESC LIMIT 300`);
      return {issues:issues.map(row=>({lineId:String(row.id),groupId:String(row.group_id),name:row.product_name,quantity:row.quantity,unitCode:row.unit_code,issue:typeof row.stock_issue_json==='string'?JSON.parse(row.stock_issue_json):row.stock_issue_json})),warehouses:warehouses.map(row=>({id:String(row.id),code:row.code,name:row.name})),balances:balances.map(row=>({warehouseId:String(row.warehouse_id),productId:String(row.product_id),name:row.name,unitCode:row.unit_code,quantity:row.quantity,reorderQuantity:row.reorder_quantity})),
        lots:lots.map(row=>({id:String(row.id),productId:String(row.product_id),code:row.lot_code,warehouseId:String(row.warehouse_id),quantity:row.quantity,expiresAtUtc:row.expires_at_utc})),
        movements:movements.map(row=>({id:String(row.id),name:row.name,warehouseId:String(row.warehouse_id),quantity:row.quantity_base,type:row.document_type,reason:row.reason,createdAtUtc:row.created_at_utc}))};
    });},
    async createWarehouse(input,actorId){
      object(input,['requestKey','code','name']);const payload={code:text(input.code,40,'Depo kodu'),name:text(input.name,120,'Depo adı')};
      return write('stock.warehouse.create',input,actorId,payload,async connection=>{const [result]=await connection.execute('INSERT INTO warehouses(code,name) VALUES (?,?)',[payload.code,payload.name]);return {id:String(result.insertId)};});
    },
    async movement(input,actorId){
      object(input,['requestKey','warehouseId','productId','kind','quantity','totalCostMinor','lotCode','lotId','expiresDate','reason','expectedQuantity','trackOnSale']);
      const payload={warehouseId:identifier(input.warehouseId),productId:identifier(input.productId),kind:input.kind,quantity:decimalString(decimal(input.quantity,{zero:input.kind==='count'})),
        reason:text(input.reason,500,'Gerekçe'),lotCode:input.lotCode?text(input.lotCode,100,'Parti kodu'):null,lotId:input.lotId?identifier(input.lotId):undefined,expiresAt:expiryDate(input.expiresDate),
        totalCostMinor:input.totalCostMinor!==undefined?money(input.totalCostMinor,{zero:true}):null,expectedQuantity:input.kind==='count'?decimalString(decimal(input.expectedQuantity,{zero:true})):null};
      if(input.trackOnSale!==undefined)payload.trackOnSale=input.trackOnSale;
      if((payload.trackOnSale!==undefined&&typeof payload.trackOnSale!=='boolean')||(payload.trackOnSale&&payload.kind!=='opening'))throw problem(400,'INVALID_INPUT','Otomatik takip yalnız başlangıç girişiyle açılır.');
      if(!['opening','waste','staff','complimentary','personal','count'].includes(payload.kind))throw problem(400,'INVALID_INPUT','Stok hareketi türü geçersiz.');
      return write('stock.movement',input,actorId,payload,async(connection,operation,actor)=>{
        await warehouse(connection,payload.warehouseId);const products=await lockProducts(connection,[payload.productId]);const product=products.get(payload.productId);
        const before=await stockBalance(connection,payload.warehouseId,payload.productId,payload.lotId);const quantity=decimal(payload.quantity,{zero:true});
        if(payload.lotId){const [[lot]]=await connection.execute('SELECT id FROM stock_lots WHERE id=? AND product_id=?',[payload.lotId,payload.productId]);if(!lot)throw problem(400,'INVALID_LOT','Seçilen parti ürüne ait değil.');}
        if(payload.kind==='opening'){
          if(payload.trackOnSale)await activateDirectSales(connection,product,actor);
          const [[prior]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE warehouse_id=? AND product_id=?',[payload.warehouseId,payload.productId]);
          if(Number(prior.count))throw problem(409,'OPENING_EXISTS','Hareketi olan ürün/depo için tekrar başlangıç stoğu girilemez.');
        }
        if(payload.kind==='count'&&decimal(payload.expectedQuantity,{zero:true})!==before)throw problem(409,'STOCK_CHANGED','Stok sayım sırasında değişti. Güncel miktarı yükleyin.');
        const documentId=await document(connection,operation,actor,payload.kind,payload.reason);
        if(payload.kind==='count'){
          if(product.track_lots&&!payload.lotId)throw problem(409,'LOT_COUNT_REQUIRED','Partili ürün için sayılacak partiyi seçin.');
          const [count]=await connection.execute("INSERT INTO stock_counts(warehouse_id,counted_by,status,stock_document_id) VALUES (?,?,'posted',?)",[payload.warehouseId,actor,documentId]);
          await connection.execute('INSERT INTO stock_count_lines(count_id,product_id,lot_id,expected_quantity_base,counted_quantity_base,reason) VALUES (?,?,?,?,?,?)',[count.insertId,payload.productId,payload.lotId||null,decimalString(before),payload.quantity,payload.reason]);
          if(quantity<before)await consume(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.productId,quantity:before-quantity,lotId:payload.lotId,allowExpired:true});
          if(quantity>before){if(payload.totalCostMinor===null)throw problem(409,'COUNT_COST_REQUIRED','Fazla miktarın doğrulanmış toplam maliyetini girin.');const cost=roundedRatio(BigInt(payload.totalCostMinor)*1000000000000n,quantity-before);await moveStock(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.productId,lotId:payload.lotId||null,quantity:quantity-before,unitCost:decimalString(cost)});}
        }else if(payload.kind==='opening'){
          let lotId=null;
          if(payload.totalCostMinor===null)throw problem(400,'COST_REQUIRED','Başlangıç stoğunun toplam maliyetini girin.');
          if(product.track_lots||payload.lotCode||payload.expiresAt){const [lot]=await connection.execute('INSERT INTO stock_lots(product_id,lot_code,operation_id,expires_at_utc) VALUES (?,?,?,?)',[payload.productId,payload.lotCode||`O-${randomUUID()}`,operation,payload.expiresAt]);lotId=String(lot.insertId);}
          const cost=roundedRatio(BigInt(payload.totalCostMinor)*1000000000000n,quantity);
          await moveStock(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.productId,lotId,quantity,unitCost:decimalString(cost)});
        }else await consume(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.productId,quantity,lotId:payload.lotId,allowExpired:true});
        return {documentId,quantity:decimalString(await stockBalance(connection,payload.warehouseId,payload.productId))};
      });
    },
    async produce(input,actorId){
      object(input,['requestKey','warehouseId','outputProductId','outputQuantity','recipeVersionId','inputs','reason','expiresDate']);
      if(!Array.isArray(input.inputs)||!input.inputs.length||input.inputs.length>100)throw problem(400,'INVALID_INPUT','Gerçek üretim girdilerini belirtin.');
      const payload={warehouseId:identifier(input.warehouseId),outputProductId:identifier(input.outputProductId),outputQuantity:decimalString(decimal(input.outputQuantity)),recipeVersionId:input.recipeVersionId?identifier(input.recipeVersionId):null,
        inputs:input.inputs.map(item=>{object(item,['productId','quantity']);return {productId:identifier(item.productId),quantity:decimalString(decimal(item.quantity))};}),reason:text(input.reason,500,'Üretim açıklaması'),expiresAt:expiryDate(input.expiresDate)};
      if(payload.inputs.some(item=>item.productId===payload.outputProductId))throw problem(400,'INVALID_INPUT','Üretim girdisi ve çıktısı aynı ürün olamaz.');
      return write('stock.production',input,actorId,payload,async(connection,operation,actor)=>{
        await warehouse(connection,payload.warehouseId);await lockProducts(connection,[payload.outputProductId,...payload.inputs.map(item=>item.productId)]);
        const documentId=await document(connection,operation,actor,'production',payload.reason);
        const [batch]=await connection.execute("INSERT INTO production_batches(batch_code,recipe_version_id,output_product_id,warehouse_id,status,actual_output_quantity_base,prepared_by,operation_id) VALUES (?,?,?,?,'posted',?,?,?)",[`P-${randomUUID()}`,payload.recipeVersionId,payload.outputProductId,payload.warehouseId,payload.outputQuantity,actor,operation]);
        let total=0n;
        for(const item of payload.inputs){
          const consumed=await consume(connection,{documentId,warehouseId:payload.warehouseId,productId:item.productId,quantity:decimal(item.quantity),batchId:String(batch.insertId)});total+=consumed.totalCostScaled;
          for(const part of consumed.parts)await connection.execute('INSERT INTO production_inputs(batch_id,product_id,lot_id,quantity_base,unit_cost_minor) VALUES (?,?,?,?,?)',[batch.insertId,item.productId,part.lotId,part.quantity,part.unitCost]);
        }
        const outputCost=roundedRatio(total,decimal(payload.outputQuantity));const totalMinor=roundedRatio(total,1000000000000n);
        const [lot]=await connection.execute('INSERT INTO stock_lots(product_id,lot_code,production_batch_id,operation_id,expires_at_utc) VALUES (?,?,?,?,?)',[payload.outputProductId,`P-${batch.insertId}`,batch.insertId,operation,payload.expiresAt]);
        await connection.execute('INSERT INTO production_outputs(batch_id,product_id,lot_id,quantity_base,unit_cost_minor) VALUES (?,?,?,?,?)',[batch.insertId,payload.outputProductId,lot.insertId,payload.outputQuantity,decimalString(outputCost)]);
        await moveStock(connection,{documentId,warehouseId:payload.warehouseId,productId:payload.outputProductId,lotId:String(lot.insertId),quantity:decimal(payload.outputQuantity),unitCost:decimalString(outputCost),batchId:String(batch.insertId)});
        await connection.execute('UPDATE production_batches SET total_cost_minor=? WHERE id=?',[totalMinor.toString(),batch.insertId]);
        return {id:String(batch.insertId),totalCostMinor:totalMinor.toString(),outputQuantity:payload.outputQuantity};
      });
    },
    async transfer(input,actorId){
      object(input,['requestKey','fromWarehouseId','toWarehouseId','productId','quantity','reason']);const payload={fromWarehouseId:identifier(input.fromWarehouseId),toWarehouseId:identifier(input.toWarehouseId),productId:identifier(input.productId),quantity:decimalString(decimal(input.quantity)),reason:text(input.reason,500,'Transfer gerekçesi')};if(payload.fromWarehouseId===payload.toWarehouseId)throw problem(400,'INVALID_INPUT','Kaynak ve hedef depo farklı olmalı.');
      return write('stock.transfer',input,actorId,payload,async(connection,operation,actor)=>{
        await warehouse(connection,payload.fromWarehouseId);await warehouse(connection,payload.toWarehouseId);await lockProducts(connection,[payload.productId]);const documentId=await document(connection,operation,actor,'transfer',payload.reason);
        const taken=await consume(connection,{documentId,warehouseId:payload.fromWarehouseId,productId:payload.productId,quantity:decimal(payload.quantity),allowExpired:true});
        for(const part of taken.parts)await moveStock(connection,{documentId,warehouseId:payload.toWarehouseId,productId:payload.productId,lotId:part.lotId,quantity:decimal(part.quantity),unitCost:part.unitCost});return {documentId};
      });
    }
  };
}
