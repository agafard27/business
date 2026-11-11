import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {quantityInput,paymentAmount} from '../public/data-entry.js';
import {renderPurchases} from '../public/purchases.js';
import {renderStock} from '../public/stock.js';
import {renderExpenses} from '../public/expenses.js';
import {renderDefinitions} from '../public/definitions.js';
import {renderReports} from '../public/reports.js';
const meta={products:[{id:'1',name:'Cam Kola',type:'ready',unitId:'1',stockMode:'direct',revision:'1'},{id:'2',name:'Dilim kaşar',type:'ingredient',unitId:'3',stockMode:'direct',trackLots:true,revision:'1'}],units:[{id:'1',name:'Adet'},{id:'2',name:'Koli'},{id:'3',name:'Dilim'}],suppliers:[{id:'1',name:'Firma'}],warehouses:[{id:'1',name:'Ana depo'},{id:'2',name:'Diğer depo'}],stations:[],options:[],recipes:[]};
const stock={warehouses:meta.warehouses,balances:[{warehouseId:'1',productId:'1',name:'Cam Kola',quantity:'10.000000',unitCode:'adet',reorderQuantity:null}],lots:[{id:'1',productId:'2',warehouseId:'1',quantity:'6.000000',code:'KASAR-A'},{id:'2',productId:'2',warehouseId:'2',quantity:'20.000000',code:'KASAR-B'}],movements:[],issues:[]};
const expenses={categories:[{id:'1',name:'Genel'}],staff:[{id:'5',name:'Çalışan'}],suppliers:meta.suppliers,shifts:[],expenses:[{id:'1',description:'Elektrik',type:'operating',categoryName:'Genel',totalMinor:'10000',remainingMinor:'10000',incurredAtUtc:'2026-10-29T09:00:00Z'}],equipment:[]};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function ui(action){
  const dom=new JSDOM('<div id="workspace"></div>',{url:'http://127.0.0.1'}),previous={document:globalThis.document,FormData:globalThis.FormData};
  globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;
  const container=dom.window.document.querySelector('#workspace'),writes=[];
  const context={user:{permissions:['catalog.manage','stock.manage','cash.manage']},message:error=>error.message,isCurrent:()=>true,openTab:()=>{},request:async(path,options)=>{
    if(options?.method==='POST'){writes.push({path,body:JSON.parse(options.body)});return {id:'50'};}
    if(path==='/api/definitions')return structuredClone(meta);
    if(path==='/api/stock')return structuredClone(stock);
    if(path==='/api/purchases')return {purchases:[],shifts:[]};
    if(path==='/api/expenses')return structuredClone(expenses);
    throw new Error('Unexpected path: '+path);
  }};
  const change=(control,value,event='change')=>{control.value=value;control.dispatchEvent(new dom.window.Event(event,{bubbles:true}));};
  try{await action({dom,container,context,writes,change});}finally{globalThis.document=previous.document;globalThis.FormData=previous.FormData;dom.window.close();}
}
test('Türkçe miktarları kayıpsız çevirir; binlik, bilimsel gösterim ve taşan hassasiyet reddedilir',()=>{
  assert.equal(quantityInput('0,5'),'0.5');assert.equal(quantityInput('999999999,123456'),'999999999.123456');
  assert.equal(quantityInput('0',{zero:true}),'0');assert.equal(quantityInput('1.000000'),'1.000000');
  for(const value of ['0','-1','1.000,5','1,000.5','1 000','1e6','0,0000001','1000000000'])assert.throws(()=>quantityInput(value));
  assert.equal(paymentAmount('1,25','125'),'125');assert.throws(()=>paymentAmount('0','100'));assert.throws(()=>paymentAmount('1,26','125'));
});
test('alışta paket, gerçek stok içeriği ve birim fiyat ayrı önizlenir; boş satır yazılmaz',()=>ui(async({container,context,writes,change})=>{
  await renderPurchases(container,context);container.querySelector('#purchase-new').click();const form=container.querySelector('#purchase-create form');
  const field=name=>form.querySelector(`[name^="${name}-"]`);
  form.elements.number.value='F-42';change(form.elements.supplierId,'1');
  change(field('productId'),'1');change(field('unitId'),'2');change(field('quantity'),'2','input');change(field('actualBaseQuantity'),'48','input');change(field('price'),'300','input');
  assert.match(form.querySelector('.entry-preview').textContent,/600,00/);assert.match(form.querySelector('.entry-preview').textContent,/\+48 Adet/);
  assert.ok(form.querySelector('[name^=price-]').getAttribute('aria-describedby'));
  const savedPreview=form.querySelector('.entry-preview').textContent;
  form.querySelector('.add-row').click();assert.notEqual(form.querySelector('.entry-preview').textContent,savedPreview);
  form.querySelectorAll('.editable-row')[1].querySelector('button').click();assert.equal(form.querySelector('.entry-preview').textContent,savedPreview);
  change(field('quantity'),'1,5','input');form.querySelector('[type=submit]').click();await tick();
  assert.equal(writes.length,1);assert.equal(writes[0].body.items[0].quantity,'1.5');assert.equal(writes[0].body.items[0].actualBaseQuantity,'48');assert.equal(writes[0].body.items[0].unitPriceMinor,'30000');
}));
test('sayım eski miktarı sistemden alır, yalnız fazla stokta maliyet ister; parti depo/ürüne göre süzülür',()=>ui(async({container,context,change,writes})=>{
  await renderStock(container,context);const form=container.querySelector('#stock-move form'),field=name=>form.elements.namedItem(name);
  change(field('kind'),'count');change(field('quantity'),'12,5','input');
  assert.equal(field('expectedQuantity').value,'10.000000');assert.ok(field('expectedQuantity').readOnly);assert.ok(field('cost').required);assert.ok(!field('cost').disabled);
  change(field('quantity'),'0','input');assert.ok(field('cost').disabled);assert.equal(field('cost').required,false);
  change(field('productId'),'2');assert.ok(field('lotId').required);assert.equal(field('lotId').options.length,2);assert.ok(![...field('lotId').options].some(row=>row.textContent.includes('KASAR-B')));
  change(field('lotId'),'1');assert.equal(field('expectedQuantity').value,'6.000000');
  change(field('kind'),'waste');change(field('quantity'),'0,5','input');field('reason').value='Düşen dilimler';form.querySelector('[type=submit]').click();await tick();
  assert.equal(writes.length,1);assert.equal(writes[0].body.quantity,'0.5');assert.equal(writes[0].body.expectedQuantity,undefined);assert.equal(writes[0].body.totalCostMinor,undefined);assert.equal(writes[0].body.lotId,'1');
}));
test('gider türü gereksiz alanları göndermez; personel zorunludur, kapalı kasada ödeme engellenir',()=>ui(async({container,context,change,writes})=>{
  await renderExpenses(container,context);let form=container.querySelector('#expense-create form'),field=name=>form.elements.namedItem(name);
  assert.ok(field('staffId').disabled);assert.ok(field('equipmentName').disabled);
  assert.ok(container.querySelector('[data-expense] button').disabled);
  change(field('supplierId'),'1');change(field('type'),'staff_advance');assert.ok(field('staffId').required);assert.ok(field('supplierId').disabled);
  change(field('categoryId'),'1');field('description').value='Ekim avansı';field('total').value='100';form.querySelector('[type=submit]').click();await tick();assert.equal(writes.length,0);
  change(field('staffId'),'5');form.querySelector('[type=submit]').click();await tick();
  assert.equal(writes.length,1);assert.equal(writes[0].body.staffId,'5');assert.equal(writes[0].body.supplierId,null);assert.equal(writes[0].body.equipmentName,null);
  form=container.querySelector('#expense-create form');change(form.elements.type,'equipment');assert.ok(form.elements.equipmentName.required);assert.ok(!form.elements.equipmentName.disabled);assert.ok(form.elements.staffId.disabled);
}));
test('reçete malzemesi Türkçe kesirle girilir; kullanılmayan ambalaj alanı servisi engellemez',()=>ui(async({container,context,change,writes})=>{
  await renderDefinitions(container,context);const optionForm=container.querySelector('#definition-option form');
  assert.ok(optionForm.elements.recipeMultiplier.disabled);assert.ok([...optionForm.querySelectorAll('#option-components input,#option-components select')].every(row=>row.disabled));
  const form=container.querySelector('#definition-recipe form');change(form.elements.productId,'1');form.elements.name.value='Bir porsiyon';form.elements.outputQuantity.value='1';
  change(form.querySelector('[name^=productId-]'),'2');form.querySelector('[name^=quantity-]').value='0,5';form.querySelector('[type=submit]').click();await tick();
  assert.equal(writes.length,1);assert.equal(writes[0].body.ingredients[0].quantity,'0.5');
}));
test('belirsiz stok komutu aynı veri/anahtarla kontrol edilir; görünmeyen alanlar kesin hatadan sonra da kapalı kalır',()=>ui(async({container,context,change})=>{
  const writes=[];let unknown=true;
  context.request=async(path,options)=>{
    if(path==='/api/stock'&&!options)return stock;if(path==='/api/definitions')return meta;
    const body=JSON.parse(options.body);writes.push(body);if(unknown){unknown=false;throw new TypeError('Lost reply');}throw Object.assign(new Error('Stock changed'),{status:409});
  };
  await renderStock(container,context);const form=container.querySelector('#stock-move form');change(form.elements.kind,'waste');form.elements.quantity.value='0,5';form.elements.reason.value='Fire';form.querySelector('[type=submit]').click();await tick();
  assert.equal(form.querySelector('[type=submit]').textContent,'İşlemi kontrol et');form.querySelector('[type=submit]').click();await tick();assert.deepEqual(writes[0],writes[1]);assert.ok(form.elements.cost.disabled);assert.ok(form.elements.expectedQuantity.disabled);assert.ok(!form.elements.quantity.disabled);
}));
const reportData=amount=>({range:{from:'2026-10-29',to:'2026-10-29'},netSalesMinor:amount,cancelledMinor:'0',creditSalesMinor:'0',payments:[],expensesMinor:'0',staffAdvancesMinor:'0',currentReceivableMinor:'0',currentPayableMinor:'0',openGroups:0,equipmentMinor:'0',knownCostMinor:'0',profitAvailable:false,missingCostLines:1,products:[]});
test('raporda eski yanıt yeni tarihi ezmez, tarih değişince önceki dönem detayları temizlenir',()=>ui(async({container,context,dom,change})=>{
  let delayed=false;const waiting=[];context.request=async path=>{
    if(path.includes('/summary'))return delayed?new Promise(resolve=>waiting.push(resolve)):reportData('100');
    if(path.includes('/audit'))return {events:[]};if(path.includes('/details'))return {rows:[{id:'1',quantity:'0',name:'Eski dönem'}],nextCursor:'1'};throw new Error(path);
  };
  await renderReports(container,context);const form=container.querySelector('#report-filters');
  container.querySelector('[data-report=sales]').click();await tick();assert.match(container.querySelector('#report-details').textContent,/Eski dönem/);
  change(form.elements.from,'2026-10-28','input');assert.equal(container.querySelector('#report-details').textContent,'');assert.match(container.querySelector('#report-content').textContent,/Tarih değişti/);
  container.querySelector('[data-report=summary]').click();await tick();
  delayed=true;form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(waiting.length,2);
  waiting[1](reportData('200'));await tick();waiting[0](reportData('100'));await tick();assert.match(container.querySelector('#report-content').textContent,/2,00/);assert.doesNotMatch(container.querySelector('#report-content').textContent,/1,00/);
}));
