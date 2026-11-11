import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderOrderEntry,renderTableOrder} from '../public/order-entry.js';

const options=[
  {productId:'1',optionId:'11',name:'Adana Kebap',optionName:'Dürüm',categoryName:'Yemek',unitCode:'adet',unitPriceMinor:'25000',priceBasisQuantity:'1',requiresWeight:false},
  {productId:'1',optionId:'12',name:'Adana Kebap',optionName:'Porsiyon',categoryName:'Yemek',unitCode:'adet',unitPriceMinor:'50000',priceBasisQuantity:'1',requiresWeight:false},
  {productId:'2',optionId:'21',name:'Çerez',optionName:'Gram',categoryName:'Diğer',unitCode:'g',unitPriceMinor:'28000',priceBasisQuantity:'1000',requiresWeight:true},
  {productId:'2',optionId:'22',name:'Çerez',optionName:'Paket',categoryName:'Diğer',unitCode:'adet',unitPriceMinor:'10000',priceBasisQuantity:'1',requiresWeight:false}
];
let sequence=0;
const until=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI must settle');};
async function ui(action){
  const dom=new JSDOM('<section id="workspace"></section>',{url:'http://127.0.0.1'});
  const previous={document:globalThis.document,window:globalThis.window,FormData:globalThis.FormData};
  Object.assign(globalThis,{document:dom.window.document,window:dom.window,FormData:dom.window.FormData});
  try{
    const node=document.querySelector('#workspace'),writes=[];
    const context={user:{id:'order-test-'+(++sequence),permissions:['orders.write']},group:{id:'1',revision:'3',tableName:'Masa 1',lines:[],totalMinor:'0',remainingMinor:'0',settledMinor:'0'},message:error=>error.message,isCurrent:()=>true,onRefresh:()=>{},request:async(path,init)=>{
      if(path==='/api/sales/menu')return {options:options.map(option=>({...option})),warehouses:[]};
      writes.push({path,body:JSON.parse(init.body)});return {};
    }};
    await renderOrderEntry(node,context);await action({dom,node,context,writes});
  }finally{Object.assign(globalThis,previous);dom.window.close();}
}

test('servise dokunmak 1 adet taslak ekler; tekrarlar birleşir, mutfağa yalnız gönder düğmesi yazar',()=>ui(async({node,writes})=>{
  node.querySelector('[data-product="1"]').click();
  assert.equal(node.querySelector('#order-picker-form'),null);assert.equal(node.querySelector('#order-picker input'),null);
  assert.equal(node.querySelectorAll('#draft-list .order-line').length,0,'Ürün seçmek henüz servis eklemez');
  node.querySelector('[data-variant="11"]').click();node.querySelector('[data-variant="11"]').click();node.querySelector('[data-variant="12"]').click();
  assert.equal(node.querySelectorAll('#draft-list .order-line').length,2);assert.equal(writes.length,0);
  assert.match(node.querySelector('#serving-feedback').textContent,/Porsiyon eklendi/);
  node.querySelector('#order-send [type=submit]').click();await until(()=>writes.length===1);
  assert.deepEqual(writes[0].body.items,[{optionId:'11',quantity:'2',note:''},{optionId:'12',quantity:'1',note:''}]);
}));

test('taslak not ve miktarı düzenlenir; servis değiştirme güncellemeyi onaylayana kadar ürün eklemez',()=>ui(async({node})=>{
  node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();
  node.querySelector('#draft-list [data-edit]').click();let form=node.querySelector('#order-picker-form');
  form.elements.quantity.value='3';form.elements.note.value='Soğansız';
  node.querySelector('[data-variant="12"]').click();form=node.querySelector('#order-picker-form');
  assert.equal(form.elements.quantity.value,'3');assert.equal(form.elements.note.value,'Soğansız');
  assert.match(node.querySelector('#draft-list').textContent,/Dürüm/);
  form.querySelector('[type=submit]').click();assert.equal(node.querySelectorAll('#draft-list .order-line').length,1);
  assert.match(node.querySelector('#draft-list').textContent,/Porsiyon · 3 adet/);assert.match(node.querySelector('#draft-list').textContent,/Soğansız/);
  node.querySelector('[data-plus]').click();assert.match(node.querySelector('#draft-list').textContent,/Porsiyon · 4 adet/);
  node.querySelector('[data-minus]').click();assert.match(node.querySelector('#draft-list').textContent,/Porsiyon · 3 adet/);
}));

test('gramlı servis miktar ister ve kesin tutarı hesaplar; adetli servise dönüş tek adet ekler',()=>ui(async({dom,node,writes})=>{
  node.querySelector('[data-product="2"]').click();node.querySelector('[data-variant="21"]').click();
  let form=node.querySelector('#order-picker-form');assert.ok(form);assert.equal(form.elements.quantity.value,'');
  assert.equal(node.querySelectorAll('#draft-list .order-line').length,0);
  form.elements.quantity.value='250,5';form.elements.quantity.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.match(node.querySelector('#picker-price').textContent,/70,14/);
  form.querySelector('[type=submit]').click();assert.match(node.querySelector('#draft-list').textContent,/250,5 g/);
  node.querySelector('[data-product="2"]').click();node.querySelector('[data-variant="21"]').click();
  form=node.querySelector('#order-picker-form');form.elements.quantity.value='0';form.querySelector('[type=submit]').click();
  assert.match(form.querySelector('.error').textContent,/sıfırdan büyük/);assert.equal(node.querySelectorAll('#draft-list .order-line').length,1);
  node.querySelector('[data-variant="22"]').click();assert.equal(node.querySelector('#order-picker-form'),null);
  assert.match(node.querySelector('#draft-list').textContent,/Paket · 1 adet/);assert.equal(writes.length,0);
}));

test('kapatma eklemez ve son adedi yeni seçime taşımaz; belirsiz gönderim aynı komutla kontrol edilir',()=>ui(async({node,context,writes})=>{
  node.querySelector('[data-product="1"]').click();node.querySelector('#close-picker').click();assert.equal(node.querySelectorAll('#draft-list .order-line').length,0);
  node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();
  node.querySelector('#draft-list [data-edit]').click();const form=node.querySelector('#order-picker-form');form.elements.quantity.value='5';form.elements.note.value='Az pişmiş';form.querySelector('[type=submit]').click();
  node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();
  assert.equal(node.querySelectorAll('#draft-list .order-line').length,2,'Yeni hızlı ekleme önceki notu veya miktarı kullanmaz');
  const request=context.request;context.request=async(path,init)=>{if(path==='/api/sales/menu')return request(path,init);writes.push({path,body:JSON.parse(init.body)});throw new TypeError('lost reply');};
  await renderOrderEntry(node,context);node.querySelector('#order-send [type=submit]').click();await until(()=>node.querySelector('#order-send .error').textContent.includes('Sonuç doğrulanamadı'));
  assert.ok(node.querySelector('[data-product="1"]').disabled);assert.ok([...node.querySelectorAll('[data-variant]')].every(button=>button.disabled));
  await renderOrderEntry(node,context);node.querySelector('#order-send [type=submit]').click();await until(()=>writes.length===2);
  assert.deepEqual(writes[0],writes[1]);assert.deepEqual(writes[0].body.items,[{optionId:'11',quantity:'5',note:'Az pişmiş'},{optionId:'11',quantity:'1',note:''}]);
}));

test('boş masada giriş ve taslak değişikliği yazmaz; ilk gönderim hesabı açıp gerçek hesaba gider',()=>ui(async({node,context,writes})=>{
  const request=context.request,opened=[],tabs=[];context.tableDraft={id:'9',name:'Bahçe 9'};context.openGroup=id=>opened.push(id);context.openTab=id=>tabs.push(id);
  context.request=async(path,init)=>{if(!init)return request(path);writes.push({path,body:JSON.parse(init.body)});return {group:{id:'101'}};};
  await renderTableOrder(node,context);assert.match(node.querySelector('.order-kicker').textContent,/SİPARİŞ TASLAĞI/);
  assert.equal(node.querySelector('#order-payment'),null);assert.equal(node.querySelector('#order-tools').closest('details').hidden,true);
  assert.equal(node.querySelector('#order-send [type=submit]').disabled,true);
  node.querySelector('#order-tables').click();assert.deepEqual(tabs,['tables']);assert.equal(writes.length,0);
  node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();assert.equal(writes.length,0);
  await renderTableOrder(node,context);assert.equal(node.querySelectorAll('#draft-list .order-line').length,1);
  node.querySelector('#order-send [type=submit]').click();await until(()=>opened.length===1);
  assert.equal(writes[0].path,'/api/sales/tables/9/orders');assert.equal(writes[0].body.revision,undefined);assert.equal(writes.length,1);assert.deepEqual(opened,['101']);
  await renderTableOrder(node,context);assert.equal(node.querySelectorAll('#draft-list .order-line').length,0,'Başarılı gönderim yerel taslağı temizler');
}));

test('ilk siparişin kayıp yanıtı ve yönlendirme hatası aynı anahtarla kontrol edilir',()=>ui(async({node,context,writes})=>{
  const request=context.request;let failNavigation=true,opened=null;context.tableDraft={id:'10',name:'Masa 10'};
  context.openGroup=id=>{if(failNavigation){failNavigation=false;throw new Error('navigation failed');}opened=id;};
  context.request=async(path,init)=>{if(!init)return request(path);writes.push({path,body:JSON.parse(init.body)});if(writes.length===1)throw new TypeError('lost');return {group:{id:'102'}};};
  await renderTableOrder(node,context);node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();
  node.querySelector('#order-send [type=submit]').click();await until(()=>node.querySelector('#order-send .error').textContent.includes('Sonuç doğrulanamadı'));
  await renderTableOrder(node,context);assert.ok(node.querySelector('[data-product="1"]').disabled);node.querySelector('#order-send [type=submit]').click();
  await until(()=>node.querySelector('#order-send .error').textContent.includes('İşlem kaydedildi'));
  await renderTableOrder(node,context);node.querySelector('#order-send [type=submit]').click();await until(()=>opened==='102');
  assert.equal(writes.length,3);assert.deepEqual(writes[0],writes[1]);assert.deepEqual(writes[1],writes[2]);
}));

test('başka cihaz masayı doldurunca taslak korunur ve kendiliğinden tekrar gönderilmez',()=>ui(async({node,context,writes})=>{
  const request=context.request;context.tableDraft={id:'11',name:'Masa 11'};
  context.request=async(path,init)=>{if(!init)return request(path);writes.push(JSON.parse(init.body));throw Object.assign(new Error('Masa başka cihazda açıldı.'),{status:409,code:'TABLE_OCCUPIED'});};
  await renderTableOrder(node,context);node.querySelector('[data-product="1"]').click();node.querySelector('[data-variant="11"]').click();node.querySelector('#order-send [type=submit]').click();
  await until(()=>node.querySelector('#order-send .error').textContent.includes('başka cihazda'));
  assert.equal(writes.length,1);assert.equal(node.querySelector('[data-product="1"]').disabled,false);assert.equal(node.querySelectorAll('#draft-list .order-line').length,1);
  await renderTableOrder(node,context);assert.equal(node.querySelectorAll('#draft-list .order-line').length,1);assert.equal(writes.length,1);
}));
