import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {randomUUID} from 'node:crypto';
import {renderCatalog} from '../public/catalog.js';
import {simpleSaleOption,mountCatalogOptionEntry} from '../public/catalog-option-entry.js';

const units=[{id:'1',name:'Adet',code:'adet',dimension:'count',decimalPlaces:0},{id:'2',name:'Kilogram',code:'kg',dimension:'mass',decimalPlaces:6},{id:'3',name:'Gram',code:'g',dimension:'mass',decimalPlaces:3},{id:'4',name:'Litre',code:'l',dimension:'volume',decimalPlaces:6}];
const product=()=>({id:'90',revision:'1',name:'Bal',code:'BAL',baseUnitId:'2',stockMode:'none',categoryId:'6',categoryName:'Gıda Ürünleri',isActive:true,options:[]});
const values={mode:'pack',amount:'1',unitId:'2',price:'550',name:'1 kg kavanoz'};
const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI must settle');};

test('kavanoz ağırlığı stok içeriği, sipariş birimi adet olur; fiyatlar bağımsız ve kesin kuruştur',()=>{
  const one=simpleSaleOption(product(),units,values),two=simpleSaleOption(product(),units,{...values,amount:'2',name:'2 kg kavanoz',price:'999,90'});
  assert.equal(one.unitId,'1');assert.equal(one.basisQuantity,'1');assert.equal(one.contentQuantity,'1');assert.equal(one.requiresWeight,false);assert.equal(one.priceMinor,'55000');
  assert.equal(two.contentQuantity,'2');assert.equal(two.priceMinor,'99990');
  assert.equal(simpleSaleOption(product(),units,{...values,amount:'1000',unitId:'3'}).contentQuantity,'1');
  assert.equal(simpleSaleOption({...product(),baseUnitId:'3',stockMode:'direct'},units,values).contentQuantity,'1000');
});

test('tartılı satış fiyat miktarını korur; boyut karışımı, kesirli adet ve aynı adlı seçenek reddedilir',()=>{
  const weight=simpleSaleOption(product(),units,{...values,mode:'weight',amount:'1000',unitId:'3'});
  assert.equal(weight.unitId,'3');assert.equal(weight.basisQuantity,'1000');assert.equal(weight.contentQuantity,'0.001');assert.equal(weight.requiresWeight,true);
  assert.throws(()=>simpleSaleOption(product(),units,{...values,unitId:'4'}),/karşılığı bilinmiyor/);
  assert.throws(()=>simpleSaleOption({...product(),baseUnitId:'1'},units,{...values,unitId:'1',amount:'1,5'}),/stok birimine uygun/);
  assert.throws(()=>simpleSaleOption({...product(),options:[{name:'1 KG KAVANOZ'}]},units,values),/zaten var/);
  assert.throws(()=>simpleSaleOption({...product(),stockMode:'recipe'},units,values),/Reçeteli/);
});

async function ui(action){
  const dom=new JSDOM('<main id="host"></main>',{url:'http://127.0.0.1'}),previous={document:globalThis.document,matchMedia:globalThis.matchMedia};
  globalThis.document=dom.window.document;globalThis.matchMedia=()=>({matches:false});
  try{await action(dom,document.querySelector('#host'));}finally{Object.assign(globalThis,previous);dom.window.close();}
}
function fill(dom,host,entries){for(const [name,value] of Object.entries(entries)){const node=host.querySelector(`[name=${name}]`);node.value=value;node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}}

test('ürünün kendi sayfasında satış seçeneği oluşturulur ve güncel ürün/fiyat listesi yüklenir',()=>ui(async(dom,host)=>{
  const item=product(),writes=[];
  const request=async(path,init)=>{
    if(path==='/api/catalog/meta')return {units,categories:[{id:'6',name:'Gıda Ürünleri',isActive:true}]};
    if(path.startsWith('/api/catalog/products?'))return {products:[structuredClone(item)],total:1};
    if(path==='/api/catalog/products/90')return {product:structuredClone(item)};
    assert.equal(path,'/api/definitions/products/90/options');const command=JSON.parse(init.body);writes.push(command);
    item.revision='2';item.options=[{id:'91',name:command.name,isActive:true,currentVersion:{id:'92',unitPriceMinor:command.priceMinor,priceBasisQuantity:'1',saleUnitCode:'adet',requiresWeight:false},versions:[]}];return {id:'91'};
  };
  await renderCatalog(host,{request,message:error=>error.message,isCurrent:()=>true,onUnauthorized:()=>{},user:{id:randomUUID()}});
  host.querySelector('[data-new-sale-option]').click();assert.equal(host.querySelector('[name=price]').value,'','Örnek fiyat canlı forma kendiliğinden yazılmaz');
  fill(dom,host,{price:'550'});assert.match(host.querySelector('[data-option-preview]').textContent,/550,00/);
  host.querySelector('.catalog-option-form [type=submit]').click();await until(()=>host.querySelector('[data-edit-price="91"]'));
  assert.equal(writes.length,1);assert.equal(writes[0].contentQuantity,'1');assert.equal(writes[0].priceMinor,'55000');assert.equal(writes[0].unitId,'1');assert.match(host.querySelector('#catalog-detail').textContent,/1 kg kavanoz/);
}));

test('kayıp yanıtta aynı servis komutu korunur; başarılı kayıttan sonra yalnız ekran yenilenir',()=>ui(async(dom,host)=>{
  const item=product(),user={id:randomUUID()},writes=[];let saved=0;
  const context={product:item,units,user,isCurrent:()=>true,canStart:()=>true,onEditing:()=>{},message:error=>error.message,onSaved:async()=>{saved++;if(saved===1)throw new Error('refresh failed');return true;},request:async(path,init)=>{writes.push(JSON.parse(init.body));if(writes.length===1)throw new TypeError('lost reply');return {id:'91'};}};
  mountCatalogOptionEntry(host,context);host.querySelector('[data-new-sale-option]').click();fill(dom,host,{amount:'2',price:'1000'});
  host.querySelector('[type=submit]').click();await until(()=>host.querySelector('.error').textContent.includes('Sonuç doğrulanamadı'));
  item.stockMode='recipe'; // A concurrent product edit must not hide the uncertain command.
  mountCatalogOptionEntry(host,context);assert.equal(host.querySelector('[name=amount]').value,'2');assert.ok(host.querySelector('[name=price]').disabled);host.querySelector('[type=submit]').click();
  await until(()=>host.querySelector('.error').textContent.includes('Satış seçeneği kaydedildi'));
  mountCatalogOptionEntry(host,context);host.querySelector('[type=submit]').click();await until(()=>saved===2);
  assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
}));

test('eski revision yeni anahtarla otomatik yazılmaz; Vazgeç güncel ürünü yükler',()=>ui(async(dom,host)=>{
  let reloaded=0,writes=0;
  mountCatalogOptionEntry(host,{product:product(),units,user:{id:randomUUID()},isCurrent:()=>true,canStart:()=>true,onEditing:()=>{},onSaved:()=>{},onReload:()=>reloaded++,message:error=>error.message,request:async()=>{writes++;throw Object.assign(new Error('Kayıt değişti.'),{status:409,code:'REVISION_CONFLICT'});}});
  host.querySelector('[data-new-sale-option]').click();fill(dom,host,{price:'550'});host.querySelector('[type=submit]').click();await until(()=>host.querySelector('.error').textContent.includes('Vazgeç ile'));
  assert.equal(host.querySelector('[type=submit]').disabled,true);host.querySelector('[data-option-cancel]').click();assert.equal(reloaded,1);assert.equal(writes,1);
}));
