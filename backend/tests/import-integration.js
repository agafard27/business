import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { withConnection } from '../src/database.js';
export async function checkImportFlows({config,call,json,command,cookie,waiterCookie}){
  const post=async(path,input)=>json(await call(path,command(input),cookie));
  const fileBase64=Buffer.from('Kod;Ad;Tür;Birim\r\nimport-one;Aktarılan ürün;ready;adet\r\nimport-two;İkinci ürün;ready;adet','utf8').toString('base64');
  const input={kind:'products',format:'csv',fileBase64,mapping:{code:0,name:1,type:2,unitCode:3}};
  assert.equal((await call('/api/imports/stage',command(input),waiterCookie)).status,403);
  const before=await withConnection(config,async connection=>{const [[row]]=await connection.query('SELECT COUNT(*) AS count FROM products');return Number(row.count);});
  const staged=await post('/api/imports/stage',input);assert.equal(staged.invalidCount,0);
  const stageCount=await withConnection(config,async connection=>{const [[row]]=await connection.query('SELECT COUNT(*) AS count FROM products');return Number(row.count);});assert.equal(stageCount,before,'Staging does not change products');
  const applied=command({});const first=await json(await call(`/api/imports/${staged.id}/apply`,applied,cookie));assert.equal(first.rows,2);
  assert.deepEqual(await json(await call(`/api/imports/${staged.id}/apply`,applied,cookie)),first);
  const replay=await post('/api/imports/stage',input);assert.equal(replay.completed,true);assert.equal(replay.id,staged.id);
  const after=await withConnection(config,async connection=>{const [[row]]=await connection.query('SELECT COUNT(*) AS count FROM products');return Number(row.count);});assert.equal(after,before+2);
  const undo=command({reason:'Deneme aktarımını geri al'});const reversed=await json(await call(`/api/imports/${staged.id}/reverse`,undo,cookie));assert.equal(reversed.reversed,true);assert.deepEqual(await json(await call(`/api/imports/${staged.id}/reverse`,undo,cookie)),reversed);
  assert.equal((await call(`/api/imports/${staged.id}/apply`,command({}),cookie)).status,409);
  await withConnection(config,async connection=>{const [rows]=await connection.query("SELECT is_active FROM products WHERE code IN ('import-one','import-two')");assert.equal(rows.length,2);assert.ok(rows.every(row=>!row.is_active));});
  const bad=await post('/api/imports/stage',{...input,fileBase64:Buffer.from('Kod;Ad;Tür;Birim\r\ninvalid;Kötü;ready;bilinmeyen','utf8').toString('base64')});assert.equal(bad.invalidCount,1);
  assert.equal((await call(`/api/imports/${bad.id}/apply`,command({}),cookie)).status,409);
  await post(`/api/imports/${bad.id}/discard`,{});
  const template=await call('/api/imports/template/parties',undefined,cookie);assert.equal(template.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await template.arrayBuffer()));
  workbook.worksheets[0].addRow(['import-party','Aktarılan müşteri','evet','hayır','500']);
  const partyStage=await post('/api/imports/stage',{kind:'parties',format:'xlsx',fileBase64:Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64'),mapping:{code:0,name:1,isCustomer:2,isSupplier:3,creditLimit:4}});assert.equal(partyStage.invalidCount,0);await post(`/api/imports/${partyStage.id}/apply`,{});
  const balanceStage=await post('/api/imports/stage',{kind:'opening_balances',format:'csv',fileBase64:Buffer.from('Cari;Hesap;Tutar\r\nimport-party;receivable;100','utf8').toString('base64'),mapping:{partyCode:0,accountType:1,amount:2}});await post(`/api/imports/${balanceStage.id}/apply`,{});
  assert.equal((await call(`/api/imports/${partyStage.id}/reverse`,command({reason:'Bağımlı cari korunmalı'}),cookie)).status,409);
  await post(`/api/imports/${balanceStage.id}/reverse`,{reason:'Başlangıç bakiyesi düzeltmesi'});
  const stockStage=await post('/api/imports/stage',{kind:'opening_stock',format:'csv',fileBase64:Buffer.from('Ürün;Depo;Miktar;Maliyet;Parti\r\nimport-one;main;1.25;10;IMPORT-LOT','utf8').toString('base64'),mapping:{productCode:0,warehouseCode:1,quantity:2,totalCost:3,lotCode:4}});
  // Reversed inserts remain inactive, so they cannot silently re-enter stock.
  assert.equal(stockStage.invalidCount,1);
  const meta=await json(await call('/api/definitions',undefined,cookie)),unit=meta.units.find(row=>row.code==='g');
  const product=await post('/api/definitions/products',{code:'import-stock-undo',name:'Geri alınacak başlangıç ürünü',unitId:unit.id,type:'ready',stockMode:'none',stockTiming:'sale',stationId:null,trackLots:false});
  const opening=await post('/api/imports/stage',{kind:'opening_stock',format:'csv',fileBase64:Buffer.from('Ürün;Depo;Miktar;Maliyet;Parti\r\nimport-stock-undo;main;1.25;10;UNDO-LOT','utf8').toString('base64'),mapping:{productCode:0,warehouseCode:1,quantity:2,totalCost:3,lotCode:4}});assert.equal(opening.invalidCount,0);await post(`/api/imports/${opening.id}/apply`,{});await post(`/api/imports/${opening.id}/reverse`,{reason:'Kesirli başlangıç stoğunu ters kaydet'});
  await withConnection(config,async connection=>{const [[row]]=await connection.execute('SELECT SUM(quantity_base) AS amount,COUNT(*) AS count FROM stock_movements WHERE product_id=?',[product.id]);assert.equal(row.amount,'0.000000');assert.equal(Number(row.count),2,'Both original and reversal remain');});
  const prices=price=>({kind:'units_prices',format:'csv',fileBase64:Buffer.from(`Ürün;Kod;Ad;Birim;Fiyat;Dayanak\r\nimport-stock-undo;gram;Gram;g;${price};1`,'utf8').toString('base64'),mapping:{productCode:0,optionCode:1,optionName:2,unitCode:3,price:4,basisQuantity:5}});
  const initial=await post('/api/imports/stage',prices('2'));await post(`/api/imports/${initial.id}/apply`,{});
  const updated=await post('/api/imports/stage',prices('3'));await post(`/api/imports/${updated.id}/apply`,{});await post(`/api/imports/${updated.id}/reverse`,{reason:'Önceki fiyatı yeni sürümle geri getir'});
  await withConnection(config,async connection=>{const [rows]=await connection.execute('SELECT v.unit_price_minor FROM sale_options o JOIN sale_option_versions v ON v.sale_option_id=o.id WHERE o.product_id=? ORDER BY v.version',[product.id]);assert.deepEqual(rows.map(row=>String(row.unit_price_minor)),['200','300','200']);});
}
