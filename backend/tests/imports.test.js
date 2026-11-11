import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { importBytes,readSpreadsheet } from '../src/imports/reader.js';
test('dosya okuyucu CSV tırnaklarını ve gerçek XLSX hücrelerini korur; formülü ve bozuk dosyayı reddeder',async()=>{
  const rows=await readSpreadsheet(Buffer.from('Kod;Ad\r\na;"Bir; ürün"\r\nb;"Çift ""tırnak"""','utf8'),'csv');assert.equal(rows[1][1],'Bir; ürün');assert.equal(rows[2][1],'Çift "tırnak"');
  const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Veri');sheet.addRows([['Kod','Ad'],['abc','Çay']]);
  const bytes=Buffer.from(await workbook.xlsx.writeBuffer());assert.deepEqual(await readSpreadsheet(bytes,'xlsx'),[['Kod','Ad'],['abc','Çay']]);
  sheet.getCell('B2').value={formula:'1+1',result:2};await assert.rejects(readSpreadsheet(Buffer.from(await workbook.xlsx.writeBuffer()),'xlsx'),{code:'INVALID_FILE'});
  await assert.rejects(readSpreadsheet(Buffer.from('not a zip'),'xlsx'),{code:'INVALID_FILE'});
  assert.throws(()=>importBytes('%%%'),{code:'INVALID_FILE'});assert.throws(()=>importBytes(Buffer.alloc(6*1024*1024).toString('base64')),{code:'INVALID_FILE'});
});
