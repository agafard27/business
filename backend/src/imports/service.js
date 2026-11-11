import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
import { identifier } from '../catalog/validation.js';
import { object,text,key,decimal,decimalString,roundedRatio,problem,operate,snapshot,assertPermission } from '../business/core.js';
import { document,moveStock,lockProducts } from '../stock/core.js';
import { importBytes,readSpreadsheet } from './reader.js';
import { reverseImport } from './reverse.js';
import { importFormats } from './formats.js';
const parse=value=>typeof value==='string'?JSON.parse(value):value;
function amount(value,{zero=false}={}){const match=/^(\d{1,10})(?:[,.](\d{1,2}))?$/.exec(String(value).trim());if(!match)throw problem(400,'INVALID_INPUT','Tutarı iki ondalık basamakla yazın.');const result=(BigInt(match[1])*100n+BigInt((match[2]||'').padEnd(2,'0'))).toString();if(!zero&&result==='0')throw problem(400,'INVALID_INPUT','Tutar sıfırdan büyük olmalı.');return result;}
const quantity=value=>decimalString(decimal(String(value).replace(',','.')));
function boolean(value){const normalized=String(value).trim().toLocaleLowerCase('tr-TR');if(['evet','true','1'].includes(normalized))return true;if(['hayır','hayir','false','0'].includes(normalized))return false;throw problem(400,'INVALID_INPUT','Evet veya hayır yazın.');}
function kindOf(kind){if(!Object.hasOwn(importFormats,kind))throw problem(400,'INVALID_INPUT','Aktarım türü geçersiz.');return importFormats[kind];}
async function validate(connection,kind,raw){
  const result={...raw};let action='insert';
  if(kind==='products'){
    result.code=text(raw.code,80,'Ürün kodu');result.name=text(raw.name,180,'Ürün adı');if(!['ready','prepared','ingredient','consumable'].includes(raw.type))throw problem(400,'INVALID_INPUT','Ürün türü geçersiz.');
    const [[unit]]=await connection.execute('SELECT id FROM units WHERE code=?',[raw.unitCode]);if(!unit)throw problem(400,'INVALID_INPUT','Temel birim kodu bulunamadı.');result.unitId=String(unit.id);
    const [[current]]=await connection.execute('SELECT id,revision,product_type,base_unit_id FROM products WHERE code=?',[raw.code]);
    if(current){if(current.product_type!==raw.type||String(current.base_unit_id)!==result.unitId)throw problem(400,'INVALID_INPUT','Mevcut ürünün türü veya temel birimi dosyadan değiştirilemez.');action='update';result.id=String(current.id);result.revision=String(current.revision);}
    result.barcode=raw.barcode?text(raw.barcode,100,'Barkod'):null;
    if(result.barcode){if(!/^[\x21-\x7e]+$/.test(result.barcode))throw problem(400,'INVALID_INPUT','Barkod yalnız ASCII karakterlerden oluşmalı.');const [[used]]=await connection.execute('SELECT product_id FROM product_barcodes WHERE barcode=?',[result.barcode]);if(used&&String(used.product_id)!==result.id)throw problem(400,'INVALID_INPUT','Barkod başka ürüne ait.');result.barcodeExists=Boolean(used);}
  }else if(kind==='units_prices'){
    result.optionCode=text(raw.optionCode,80,'Servis kodu');result.optionName=text(raw.optionName,120,'Servis adı');result.priceMinor=amount(raw.price,{zero:true});result.basisQuantity=quantity(raw.basisQuantity);
    const [[product]]=await connection.execute('SELECT id,revision FROM products WHERE code=? AND is_active=TRUE',[raw.productCode]);const [[unit]]=await connection.execute('SELECT id FROM units WHERE code=?',[raw.unitCode]);if(!product||!unit)throw problem(400,'INVALID_INPUT','Ürün veya satış birimi bulunamadı.');result.productId=String(product.id);result.revision=String(product.revision);result.unitId=String(unit.id);
    const [[option]]=await connection.execute('SELECT id FROM sale_options WHERE product_id=? AND code=?',[product.id,raw.optionCode]);if(option){
      const [[version]]=await connection.execute('SELECT id,version,sale_unit_id,price_basis_quantity,valid_from_utc<=UTC_TIMESTAMP(6) AS valid FROM sale_option_versions WHERE sale_option_id=? ORDER BY version DESC LIMIT 1',[option.id]);
      if(!version||!version.valid||String(version.sale_unit_id)!==result.unitId||decimal(version.price_basis_quantity)!==decimal(result.basisQuantity))throw problem(400,'INVALID_INPUT','Mevcut servisin birimi/fiyat dayanağı değiştirilemez veya ileri tarihli fiyat var.');action='update';result.optionId=String(option.id);result.versionId=String(version.id);
    }
  }else if(kind==='opening_stock'){
    result.quantity=quantity(raw.quantity);result.totalCostMinor=amount(raw.totalCost,{zero:true});result.lotCode=raw.lotCode?text(raw.lotCode,100,'Parti kodu'):null;
    const [[product]]=await connection.execute('SELECT id,base_unit_id FROM products WHERE code=? AND is_active=TRUE',[raw.productCode]);const [[warehouse]]=await connection.execute('SELECT id FROM warehouses WHERE code=? AND is_active=TRUE',[raw.warehouseCode]);
    if(!product?.base_unit_id||!warehouse)throw problem(400,'INVALID_INPUT','Birimli ürün veya depo bulunamadı.');result.productId=String(product.id);result.warehouseId=String(warehouse.id);
    const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM stock_movements WHERE warehouse_id=? AND product_id=?',[warehouse.id,product.id]);if(Number(used.count))throw problem(400,'INVALID_INPUT','Ürün/depo için stok hareketi zaten var.');
  }else if(kind==='parties'){
    result.code=text(raw.code,80,'Cari kodu');result.name=text(raw.name,180,'Cari adı');result.isCustomer=boolean(raw.isCustomer);result.isSupplier=boolean(raw.isSupplier);if(!result.isCustomer&&!result.isSupplier)throw problem(400,'INVALID_INPUT','Müşteri veya tedarikçi seçilmeli.');result.creditLimitMinor=raw.creditLimit?amount(raw.creditLimit,{zero:true}):null;
    const [[existing]]=await connection.execute('SELECT id FROM parties WHERE code=?',[result.code]);if(existing)throw problem(400,'INVALID_INPUT','Cari kodu zaten kullanılıyor.');
  }else{
    result.amountMinor=amount(raw.amount);if(!['receivable','payable'].includes(raw.accountType))throw problem(400,'INVALID_INPUT','Hesap türü receivable veya payable olmalı.');
    const [[party]]=await connection.execute('SELECT id,is_customer,is_supplier FROM parties WHERE code=? AND is_active=TRUE',[raw.partyCode]);if(!party||(raw.accountType==='receivable'?!party.is_customer:!party.is_supplier))throw problem(400,'INVALID_INPUT','Cari hesap türü uygun değil.');result.partyId=String(party.id);
    const [[used]]=await connection.execute('SELECT COUNT(*) AS count FROM party_accounts a JOIN party_entries e ON e.account_id=a.id WHERE a.party_id=? AND a.account_type=?',[party.id,raw.accountType]);if(Number(used.count))throw problem(400,'INVALID_INPUT','Bu hesapta zaten hareket var.');
  }
  return {input:result,action};
}
export function createImportService(config){
  return {
    async formats(){return {formats:Object.entries(importFormats).map(([kind,format])=>({kind,name:format.name,columns:format.columns}))};},
    async template(kind){const format=kindOf(kind);const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Aktarım');sheet.columns=Object.entries(format.columns).map(([key,header])=>({key,header,width:28}));sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315C47'}};return Buffer.from(await workbook.xlsx.writeBuffer());},
    async inspect(input){object(input,['fileBase64','format']);const rows=await readSpreadsheet(importBytes(input.fileBase64),input.format);return {headers:rows[0],rowCount:rows.length-1,preview:rows.slice(1,11)};},
    async stage(input,actorId){
      object(input,['requestKey','kind','fileBase64','format','mapping']);const format=kindOf(input.kind);const bytes=importBytes(input.fileBase64),rows=await readSpreadsheet(bytes,input.format);
      object(input.mapping,Object.keys(format.columns));const mapping={};for(const column of Object.keys(format.columns)){const index=input.mapping[column];if(index==null&&['lotCode','creditLimit','barcode'].includes(column)){mapping[column]=null;continue;}if(!Number.isInteger(index)||index<0||index>=rows[0].length)throw problem(400,'INVALID_INPUT',`${format.columns[column]} sütununu eşleştirin.`);mapping[column]=index;}
      const sourceHash=createHash('sha256').update(bytes).digest('hex');
      return operate(config,{type:'import.stage',permission:'settings.manage',actorId,requestKey:key(input.requestKey),payload:{kind:input.kind,sourceHash,mapping}},async(connection,operation,actor)=>{
        await assertPermission(connection,actor,format.permission);
        const [[existing]]=await connection.execute('SELECT id,status,mapping_json FROM import_batches WHERE import_kind=? AND source_sha256=? FOR UPDATE',[input.kind,sourceHash]);
        if(existing){if(existing.status==='completed')return {id:String(existing.id),completed:true};throw problem(409,'IMPORT_EXISTS','Bu dosya zaten önizleme alanında. Aktarım geçmişinden açın.');}
        const [batch]=await connection.execute("INSERT INTO import_batches(import_kind,source_sha256,requested_by_user_id,status,mapping_json) VALUES (?,?,?,'staged',?)",[input.kind,sourceHash,actor,JSON.stringify(mapping)]);
        const seen=new Set(),barcodes=new Set();let invalidCount=0;
        for(let index=1;index<rows.length;index++){
          const raw=Object.fromEntries(Object.entries(mapping).map(([field,col])=>[field,col===null?'':String(rows[index][col]??'').trim()]));let planned='reject',normalized=raw,errors=[];
          const duplicateKey=input.kind==='units_prices'?`${raw.productCode}:${raw.optionCode}`:input.kind==='opening_stock'?`${raw.warehouseCode}:${raw.productCode}`:input.kind==='opening_balances'?`${raw.partyCode}:${raw.accountType}`:raw.code;
          try{const canonical=duplicateKey.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll('ı','i');if(seen.has(canonical)||raw.barcode&&barcodes.has(raw.barcode))throw problem(400,'INVALID_INPUT','Dosyada aynı kod/barkod birden fazla kez var.');seen.add(canonical);if(raw.barcode)barcodes.add(raw.barcode);const validated=await validate(connection,input.kind,raw);planned=validated.action;normalized=validated.input;}
          catch(error){errors=[error.title||'Satır doğrulanamadı.'];invalidCount++;}
          await connection.execute('INSERT INTO import_rows(import_batch_id,source_row_number,planned_action,status,input_json,validation_errors_json) VALUES (?,?,?,?,?,?)',[batch.insertId,index+1,planned,errors.length?'invalid':'valid',JSON.stringify(normalized),JSON.stringify(errors)]);
        }
        await connection.execute('UPDATE import_batches SET status=? WHERE id=?',[invalidCount?'staged':'validated',batch.insertId]);return {id:String(batch.insertId),rows:rows.length-1,invalidCount};
      });
    },
    async list(){return snapshot(config,async connection=>{const [rows]=await connection.query('SELECT id,import_kind,status,reversed_operation_id,created_at_utc,completed_at_utc FROM import_batches ORDER BY id DESC LIMIT 100');return {batches:rows.map(row=>({id:String(row.id),kind:row.import_kind,status:row.status,reversed:Boolean(row.reversed_operation_id),createdAtUtc:row.created_at_utc,completedAtUtc:row.completed_at_utc}))};});},
    async get(id){id=identifier(id);return snapshot(config,async connection=>{const [[batch]]=await connection.execute('SELECT id,import_kind,status,reversed_operation_id FROM import_batches WHERE id=?',[id]);if(!batch)throw problem(404,'NOT_FOUND','Aktarım bulunamadı.');const [rows]=await connection.execute('SELECT source_row_number,planned_action,status,input_json,validation_errors_json FROM import_rows WHERE import_batch_id=? ORDER BY source_row_number',[id]);return {batch:{id,kind:batch.import_kind,status:batch.status,reversed:Boolean(batch.reversed_operation_id)},rows:rows.map(row=>({rowNumber:row.source_row_number,action:row.planned_action,status:row.status,input:parse(row.input_json),errors:parse(row.validation_errors_json)}))};});},
    async discard(id,input,actorId){id=identifier(id);object(input,['requestKey']);return operate(config,{type:'import.discard',permission:'settings.manage',actorId,requestKey:key(input.requestKey),payload:{id}},async connection=>{const [[batch]]=await connection.execute('SELECT status FROM import_batches WHERE id=? FOR UPDATE',[id]);if(!batch||!['staged','validated'].includes(batch.status))throw problem(409,'IMPORT_LOCKED','Yalnız kesinleştirilmemiş önizleme kaldırılabilir.');await connection.execute('DELETE FROM import_rows WHERE import_batch_id=?',[id]);await connection.execute('DELETE FROM import_batches WHERE id=?',[id]);return {discarded:true};});},
    async reverse(id,input,actorId){
      id=identifier(id);object(input,['requestKey','reason']);const reason=text(input.reason,500,'Geri alma gerekçesi');
      return operate(config,{type:'import.reverse',permission:'settings.manage',actorId,requestKey:key(input.requestKey),payload:{id,reason}},async(connection,operation,actor)=>{
        const [[batch]]=await connection.execute('SELECT * FROM import_batches WHERE id=? FOR UPDATE',[id]);
        if(!batch||batch.status!=='completed')throw problem(409,'IMPORT_LOCKED','Yalnız tamamlanmış aktarım geri alınabilir.');
        if(batch.reversed_operation_id)return {id,reversed:true};
        await assertPermission(connection,actor,kindOf(batch.import_kind).permission);
        return reverseImport(connection,batch,operation,actor,reason);
      });
    },
    async apply(id,input,actorId){
      id=identifier(id);object(input,['requestKey']);return operate(config,{type:'import.apply',permission:'settings.manage',actorId,requestKey:key(input.requestKey),payload:{id}},async(connection,operation,actor)=>{
        const [[batch]]=await connection.execute('SELECT * FROM import_batches WHERE id=? FOR UPDATE',[id]);if(!batch)throw problem(404,'NOT_FOUND','Aktarım bulunamadı.');
        if(batch.reversed_operation_id)throw problem(409,'IMPORT_REVERSED','Bu aktarım geri alınmış.');
        if(batch.status==='completed')return {id,completed:true};if(batch.status!=='validated')throw problem(409,'IMPORT_INVALID','Hatalı satırlar varken aktarım kesinleştirilemez.');
        await assertPermission(connection,actor,kindOf(batch.import_kind).permission);
        const [rows]=await connection.execute('SELECT * FROM import_rows WHERE import_batch_id=? ORDER BY source_row_number FOR UPDATE',[id]);
        const savedRows=rows.map(row=>parse(row.input_json));
        for(const productId of [...new Set(savedRows.flatMap(value=>value.productId?[value.productId]:value.id&&batch.import_kind==='products'?[value.id]:[]))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await connection.execute('SELECT id FROM products WHERE id=? FOR UPDATE',[productId]);
        for(const partyId of [...new Set(savedRows.flatMap(value=>value.partyId?[value.partyId]:[]))].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1))await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[partyId]);
        const validatedRows=[];
        for(let index=0;index<rows.length;index++){
          const row=rows[index],saved=savedRows[index];let checked;
          try{checked=await validate(connection,batch.import_kind,saved);}catch{throw problem(409,'IMPORT_STALE',`Satır ${row.source_row_number}: kayıtlar önizlemeden sonra değişti. Yeni önizleme hazırlayın.`);}
          if(row.planned_action!==checked.action||(row.planned_action==='update'&&(checked.input.revision!==saved.revision||checked.input.versionId!==saved.versionId)))throw problem(409,'IMPORT_STALE','Ürün/fiyat önizlemeden sonra değişti. Yeni önizleme hazırlayın.');
          validatedRows.push(checked.input);
        }
        let stockDocument=null;
        for(let index=0;index<rows.length;index++){
          const row=rows[index],saved=savedRows[index],value=validatedRows[index];let undo;
          if(batch.import_kind==='products'){
            if(row.planned_action==='update'){const [[previous]]=await connection.execute('SELECT name FROM products WHERE id=?',[value.id]);await connection.execute('UPDATE products SET name=?,revision=revision+1 WHERE id=? AND revision=?',[value.name,value.id,saved.revision]);undo={id:value.id,name:previous.name,revision:(BigInt(saved.revision)+1n).toString()};}
            else{const [created]=await connection.execute("INSERT INTO products(code,name,product_type,base_unit_id,stock_mode,stock_timing) VALUES (?,?,?,?,'none','sale')",[value.code,value.name,value.type,value.unitId]);undo={id:String(created.insertId),revision:'1'};}
            if(value.barcode&&!value.barcodeExists){await connection.execute('INSERT INTO product_barcodes(barcode,product_id) VALUES (?,?)',[value.barcode,undo.id]);undo.barcode=value.barcode;}
          }else if(batch.import_kind==='parties'){const [created]=await connection.execute('INSERT INTO parties(code,name,is_customer,is_supplier,credit_limit_minor) VALUES (?,?,?,?,?)',[value.code,value.name,value.isCustomer,value.isSupplier,value.creditLimitMinor]);undo={id:String(created.insertId),revision:'1'};}
          else if(batch.import_kind==='opening_balances'){
            await connection.execute('SELECT id FROM parties WHERE id=? FOR UPDATE',[value.partyId]);
            await connection.execute('INSERT INTO party_accounts(party_id,account_type) VALUES (?,?) ON DUPLICATE KEY UPDATE party_id=party_accounts.party_id',[value.partyId,value.accountType]);
            const [[account]]=await connection.execute('SELECT id FROM party_accounts WHERE party_id=? AND account_type=?',[value.partyId,value.accountType]);
            const [created]=await connection.execute("INSERT INTO party_entries(account_id,operation_id,sequence_no,entry_type,amount_minor,description) VALUES (?,?,?,'opening',?,'Dosyadan başlangıç bakiyesi')",[account.id,operation,row.source_row_number,value.amountMinor]);undo={entryId:String(created.insertId),partyId:value.partyId};
          }else if(batch.import_kind==='opening_stock'){
            await lockProducts(connection,[value.productId]);stockDocument ||= await document(connection,operation,actor,'opening','Dosyadan başlangıç stoğu');
            let lotId=null;if(value.lotCode){const [lot]=await connection.execute('INSERT INTO stock_lots(product_id,lot_code,operation_id) VALUES (?,?,?)',[value.productId,value.lotCode,operation]);lotId=String(lot.insertId);}
            const cost=roundedRatio(BigInt(value.totalCostMinor)*1000000000000n,decimal(value.quantity));await moveStock(connection,{documentId:stockDocument,warehouseId:value.warehouseId,productId:value.productId,lotId,quantity:decimal(value.quantity),unitCost:decimalString(cost)});undo={productId:value.productId,warehouseId:value.warehouseId,documentId:stockDocument};
          }else{
            await connection.execute('SELECT id FROM products WHERE id=? FOR UPDATE',[value.productId]);
            let optionId=value.optionId;
            if(!optionId){const [option]=await connection.execute('INSERT INTO sale_options(product_id,code,name) VALUES (?,?,?)',[value.productId,value.optionCode,value.optionName]);optionId=String(option.insertId);}
            let version;
            if(value.versionId){const [created]=await connection.execute(`INSERT INTO sale_option_versions(sale_option_id,product_id,version,sale_unit_id,unit_price_minor,price_basis_quantity,content_quantity_base,requires_weight,valid_from_utc,created_by)
              SELECT sale_option_id,product_id,version+1,sale_unit_id,?,price_basis_quantity,content_quantity_base,requires_weight,GREATEST(UTC_TIMESTAMP(6),TIMESTAMPADD(MICROSECOND,1,valid_from_utc)),? FROM sale_option_versions WHERE id=?`,[value.priceMinor,actor,value.versionId]);version=String(created.insertId);
              await connection.execute('INSERT INTO sale_option_components(option_version_id,component_product_id,quantity_base) SELECT ?,component_product_id,quantity_base FROM sale_option_components WHERE option_version_id=?',[version,value.versionId]);
              await connection.execute('INSERT INTO sale_option_recipes(option_version_id,recipe_version_id,product_id,recipe_multiplier) SELECT ?,recipe_version_id,product_id,recipe_multiplier FROM sale_option_recipes WHERE option_version_id=?',[version,value.versionId]);
            }else{const [created]=await connection.execute('INSERT INTO sale_option_versions(sale_option_id,product_id,version,sale_unit_id,unit_price_minor,price_basis_quantity,requires_weight,valid_from_utc,created_by) VALUES (?,?,1,?,?,?,FALSE,UTC_TIMESTAMP(6),?)',[optionId,value.productId,value.unitId,value.priceMinor,value.basisQuantity,actor]);version=String(created.insertId);}
            await connection.execute('UPDATE products SET revision=revision+1 WHERE id=?',[value.productId]);
            undo={optionId,versionId:version,previousVersionId:value.versionId??null,productId:value.productId};
          }
          await connection.execute("UPDATE import_rows SET status='applied',applied_operation_id=?,undo_json=? WHERE id=?",[operation,JSON.stringify(undo),row.id]);
        }
        await connection.execute("UPDATE import_batches SET status='completed',approved_by_user_id=?,completed_at_utc=UTC_TIMESTAMP(6) WHERE id=?",[actor,id]);return {id,completed:true,rows:rows.length};
      });
    }
  };
}
