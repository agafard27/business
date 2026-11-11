import {problem,decimal,decimalString} from '../business/core.js';
import {document} from '../stock/core.js';
const parse=value=>typeof value==='string'?JSON.parse(value):value;
const blocked=()=>problem(409,'IMPORT_HAS_DEPENDENCIES','Aktarımdan sonra bu kayıtlar değişmiş veya kullanılmış. Bağlı işlemleri korumak için toplu geri alma yapılmadı.');

// Append compensating records. Historical orders, prices and balances are never deleted.
export async function reverseImport(connection,batch,operation,actor,reason){
  const [rows]=await connection.execute('SELECT * FROM import_rows WHERE import_batch_id=? ORDER BY id FOR UPDATE',[batch.id]);
  const saved=rows.map(row=>({row,undo:parse(row.undo_json)}));
  if(saved.some(item=>!item.undo))throw problem(409,'IMPORT_UNDO_UNAVAILABLE','Bu eski aktarım geri alma bilgisi içermiyor.');
  const productIds=saved.flatMap(({undo})=>undo.productId?[undo.productId]:batch.import_kind==='products'?[undo.id]:[]);
  const partyIds=saved.flatMap(({undo})=>undo.partyId?[undo.partyId]:batch.import_kind==='parties'?[undo.id]:[]);
  for(const [table,ids] of [['products',productIds],['parties',partyIds]])for(const id of [...new Set(ids)].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await connection.execute(`SELECT id FROM ${table} WHERE id=? FOR UPDATE`,[id]);
  let stockDocument;
  for(const {row,undo} of saved){
    if(batch.import_kind==='products'){
      const [[current]]=await connection.execute('SELECT revision FROM products WHERE id=?',[undo.id]);if(!current||String(current.revision)!==undo.revision)throw blocked();
      if(row.planned_action==='insert'){
        const [[used]]=await connection.execute(`SELECT EXISTS(SELECT 1 FROM sale_options WHERE product_id=?) OR EXISTS(SELECT 1 FROM stock_movements WHERE product_id=?) OR EXISTS(SELECT 1 FROM purchase_lines WHERE product_id=?) OR EXISTS(SELECT 1 FROM recipe_ingredients WHERE product_id=?) AS used`,[undo.id,undo.id,undo.id,undo.id]);if(Number(used.used))throw blocked();
        await connection.execute('UPDATE products SET is_active=FALSE,revision=revision+1 WHERE id=?',[undo.id]);
      }else await connection.execute('UPDATE products SET name=?,revision=revision+1 WHERE id=?',[undo.name,undo.id]);
      if(undo.barcode)await connection.execute('DELETE FROM product_barcodes WHERE barcode=? AND product_id=?',[undo.barcode,undo.id]);
    }else if(batch.import_kind==='parties'){
      const [[current]]=await connection.execute('SELECT revision FROM parties WHERE id=?',[undo.id]);
      const [[used]]=await connection.execute('SELECT EXISTS(SELECT 1 FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=?) OR EXISTS(SELECT 1 FROM purchases p JOIN party_accounts a ON a.id=p.supplier_account_id WHERE a.party_id=?) OR EXISTS(SELECT 1 FROM expenses e JOIN party_accounts a ON a.id=e.supplier_account_id WHERE a.party_id=?) AS used',[undo.id,undo.id,undo.id]);
      if(!current||String(current.revision)!==undo.revision||Number(used.used))throw blocked();
      await connection.execute('UPDATE parties SET is_active=FALSE,revision=revision+1 WHERE id=?',[undo.id]);
    }else if(batch.import_kind==='opening_balances'){
      const [[entry]]=await connection.execute('SELECT * FROM party_entries WHERE id=? FOR UPDATE',[undo.entryId]);
      const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM party_entries WHERE account_id=? AND id<>?',[entry.account_id,entry.id]);if(Number(used.count))throw blocked();
      await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,reversal_of_id,description) VALUES (?,?,?,'correction',?,?,?)",[entry.account_id,operation,row.source_row_number,(-BigInt(entry.amount_minor)).toString(),entry.id,reason]);
    }else if(batch.import_kind==='opening_stock'){
      const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE product_id=? AND warehouse_id=? AND document_id<>?',[undo.productId,undo.warehouseId,undo.documentId]);if(Number(used.count))throw blocked();
      stockDocument ||= await document(connection,operation,actor,'correction',reason);
      const [originals]=await connection.execute('SELECT * FROM stock_movements WHERE document_id=? AND product_id=? AND warehouse_id=?',[undo.documentId,undo.productId,undo.warehouseId]);
      for(const original of originals){const [[next]]=await connection.execute('SELECT COALESCE(MAX(sequence_no),0)+1 AS seq FROM stock_movements WHERE document_id=?',[stockDocument]);await connection.execute('INSERT INTO stock_movements(document_id,sequence_no,warehouse_id,product_id,lot_id,quantity_base,unit_cost_minor,reversal_of_id) VALUES (?,?,?,?,?,?,?,?)',[stockDocument,next.seq,original.warehouse_id,original.product_id,original.lot_id,decimalString(-decimal(original.quantity_base)),original.unit_cost_minor,original.id]);}
    }else{
      const [[current]]=await connection.execute('SELECT * FROM sale_option_versions WHERE sale_option_id=? ORDER BY version DESC LIMIT 1 FOR UPDATE',[undo.optionId]);
      if(!current||String(current.id)!==undo.versionId)throw blocked();
      if(!undo.previousVersionId)await connection.execute('UPDATE sale_options SET is_active=FALSE WHERE id=?',[undo.optionId]);
      else{
        if(Number(current.version)>=4294967295)throw blocked();
        const [created]=await connection.execute(`INSERT INTO sale_option_versions(sale_option_id,product_id,version,sale_unit_id,unit_price_minor,price_basis_quantity,content_quantity_base,requires_weight,valid_from_utc,created_by)
          SELECT sale_option_id,product_id,?,sale_unit_id,unit_price_minor,price_basis_quantity,content_quantity_base,requires_weight,GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,?)),? FROM sale_option_versions WHERE id=?`,[Number(current.version)+1,current.valid_from_utc,actor,undo.previousVersionId]);
        await connection.execute('INSERT INTO sale_option_components(option_version_id,component_product_id,quantity_base) SELECT ?,component_product_id,quantity_base FROM sale_option_components WHERE option_version_id=?',[created.insertId,undo.previousVersionId]);
        await connection.execute('INSERT INTO sale_option_recipes(option_version_id,recipe_version_id,product_id,recipe_multiplier) SELECT ?,recipe_version_id,product_id,recipe_multiplier FROM sale_option_recipes WHERE option_version_id=?',[created.insertId,undo.previousVersionId]);
      }
      await connection.execute('UPDATE products SET revision=revision+1 WHERE id=?',[undo.productId]);
    }
  }
  await connection.execute('UPDATE import_batches SET reversed_operation_id=? WHERE id=?',[operation,batch.id]);
  return {id:String(batch.id),reversed:true,rows:rows.length};
}
