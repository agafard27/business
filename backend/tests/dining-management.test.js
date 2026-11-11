import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderDining} from '../public/dining.js';
import {nextTableNumber} from '../public/dining-editor.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const until=async action=>{for(let i=0;i<100;i++){if(action())return;await tick();}assert.fail('Masa işlemi tamamlanmalı');};
const manageTables=node=>{const button=node.querySelector('#dining-manage');if(button.getAttribute('aria-pressed')!=='true')button.click();};
const fixtures=()=>({sections:[{id:'1',name:'Salon',sortOrder:0,revision:'1'},{id:'2',name:'Bahçe',sortOrder:1,revision:'1'}],tables:[
  {id:'10',name:'Masa 10',sectionId:'1',isActive:false,revision:'1',groupId:null},
  {id:'2',name:'Masa 2',sectionId:'1',isActive:true,revision:'3',groupId:'7',remainingMinor:'15000'},
  {id:'1',name:'Masa 1',sectionId:'1',isActive:true,revision:'1',groupId:null},
  {id:'3',name:'Masa 3',sectionId:'1',isActive:true,revision:'1',groupId:null},
  {id:'4',name:'Masa 4',sectionId:'2',isActive:true,revision:'1',groupId:null}
]});
async function ui(action){
  const dom=new JSDOM('<div id="workspace"></div>',{url:'http://127.0.0.1'}),saved={document:globalThis.document,FormData:globalThis.FormData};
  Object.assign(globalThis,{document:dom.window.document,FormData:dom.window.FormData});
  const node=document.querySelector('#workspace'),data=fixtures(),commands=[];
  const context={user:{id:crypto.randomUUID(),permissions:['tables.read','orders.write','settings.manage']},isCurrent:()=>true,message:error=>error.message,openGroup:()=>{},request:async(path,options)=>{
    if(!options)return structuredClone(data);
    const command=JSON.parse(options.body);commands.push({path,method:options.method,...command});
    if(path==='/api/dining/sections'){data.sections.push({id:'9',name:command.name,sortOrder:command.sortOrder,revision:'1'});return {id:'9'};}
    if(options.method==='PATCH'){const table=data.tables.find(row=>path.endsWith('/'+row.id));Object.assign(table,command,{revision:String(Number(table.revision)+1)});return {id:table.id};}
    return {id:'99',count:command.count};
  }};
  const change=(selector,value)=>{const input=node.querySelector(selector);input.value=value;input.dispatchEvent(new dom.window.Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));};
  try{await action({dom,node,data,context,commands,change});}finally{Object.assign(globalThis,saved);dom.window.close();}
}
test('masa listesi doğal sıralanır; dolu/boş/kaldırılan filtreleri ve rol sınırı korunur',()=>ui(async({node,context,change})=>{
  await renderDining(node,context);assert.deepEqual([...node.querySelectorAll('[data-table]')].map(row=>row.dataset.table),['1','2','3','4']);
  assert.equal(node.querySelector('[data-toggle-table]'),null);manageTables(node);
  assert.equal(node.querySelector('[data-toggle-table="2"]').disabled,true);
  change('#table-status','occupied');assert.equal(node.querySelectorAll('[data-table]').length,1);assert.ok(node.querySelector('[data-edit-table="2"]'));
  change('#table-status','inactive');assert.ok(node.querySelector('[data-toggle-table="10"]'));assert.equal(node.querySelector('[data-open-table]'),null);
  change('#table-status','all');assert.deepEqual([...node.querySelectorAll('[data-table]')].map(row=>row.dataset.table),['1','2','3','10','4']);
  await renderDining(node,{...context,user:{...context.user,permissions:['tables.read','orders.write']}});
  assert.equal(node.querySelector('#add-table'),null);assert.equal(node.querySelector('[value=inactive]'),null);assert.equal(node.querySelector('[data-table="10"]'),null);
}));

test('boş masa tek dokunuşla yalnız taslağa gider; dolu masa mevcut hesaptır',()=>ui(async({node,context,commands})=>{
  const opened=[],drafts=[];context.openGroup=id=>opened.push(id);context.openTable=table=>drafts.push(table);
  await renderDining(node,context);const empty=node.querySelector('[data-open-table="1"]');
  assert.equal(empty.tagName,'BUTTON');assert.equal(empty.type,'button');assert.equal(empty.classList.contains('primary'),false);
  assert.equal(empty.querySelector('button'),null);assert.match(empty.getAttribute('aria-labelledby'),/dining-table-name-1/);
  assert.equal(node.querySelector('[data-table="1"]').textContent.includes('Adisyon aç'),false);
  empty.click();empty.click();await until(()=>drafts.length===1);
  assert.equal(commands.length,0);assert.deepEqual(drafts[0],{id:'1',name:'Masa 1'});
  assert.equal(node.querySelector('[data-table="1"] h3').textContent,'Masa 1');
  const occupied=node.querySelector('[data-open-table="2"]');occupied.click();occupied.click();await until(()=>opened.length===1);
  assert.deepEqual(opened,['7']);assert.equal(commands.length,0,'Dolu masaya yeni adisyon açılmaz');
}));

test('masa yönetimi adisyon açmaz; kaldırılan masa ve yetkisiz boş masa yazamaz',()=>ui(async({node,context,commands,change})=>{
  let opens=0;const request=context.request;context.request=async(path,options)=>{if(path==='/api/sales/open')opens++;return request(path,options);};
  await renderDining(node,context);manageTables(node);node.querySelector('[data-edit-table="1"]').click();
  assert.ok(node.querySelector('#dining-editor [name=name]'));assert.equal(opens,0);assert.equal(commands.length,0);
  [...node.querySelectorAll('#dining-editor button')].find(button=>button.textContent==='Vazgeç').click();
  node.querySelector('[data-toggle-table="1"]').click();assert.equal(opens,0);assert.equal(commands.length,0);
  change('#table-status','inactive');assert.equal(node.querySelector('[data-table="10"] [data-open-table]'),null);
  await renderDining(node,{...context,user:{...context.user,permissions:['tables.read']}});
  node.querySelector('[data-open-table="1"]').click();assert.equal(opens,0);assert.match(node.querySelector('#dining-message').textContent,/Sipariş yetkisi/);
}));

test('taslak ekranına yönlendirme hatası boş hesap bırakmaz ve yeniden denenebilir',()=>ui(async({node,context,commands})=>{
  let navigationFails=true,opened=null;
  context.openTable=table=>{if(navigationFails){navigationFails=false;throw new Error('navigation failed');}opened=table.id;};
  await renderDining(node,context);node.querySelector('[data-open-table="1"]').click();
  await until(()=>node.querySelector('#dining-message').textContent.includes('navigation failed'));
  await renderDining(node,context);let entry=node.querySelector('[data-open-table="1"]');
  assert.equal(entry.querySelector('[data-account-open-label]').textContent,'Sipariş için dokun');assert.equal(entry.querySelector('[aria-hidden]').textContent.trim(),'↗');
  assert.equal(node.querySelector('[data-table="1"] h3').textContent,'Masa 1');entry.click();
  await until(()=>opened==='1');assert.equal(commands.length,0);
}));
test('ilk kurulumda masa ekle bölüm formuna götürür; bölüm ve filtre yenilemede korunur',()=>ui(async({node,data,context,change,commands})=>{
  data.sections=[];data.tables=[];await renderDining(node,context);node.querySelector('#add-table').click();
  assert.match(node.querySelector('#dining-editor').textContent,/önce bir bölüm/);change('[name=name]','Teras');node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#section-filter')?.value==='9');assert.equal(commands[0].path,'/api/dining/sections');
  node.querySelector('#add-table').click();assert.equal(node.querySelector('[name=sectionId]').value,'9');assert.equal(node.querySelector('[name=name]').value,'Masa 1');
  [...node.querySelectorAll('#dining-editor button')].find(button=>button.textContent==='Vazgeç').click();assert.equal(node.querySelector('#dining-editor').hidden,true);
  change('#table-search','aradığım');node.querySelector('#dining-refresh').click();await until(()=>!node.querySelector('#dining-refresh').disabled);
  assert.equal(node.querySelector('#table-search').value,'aradığım');assert.equal(node.querySelector('#section-filter').value,'9');
}));
test('numara önerisi kaldırılan masaları da sayar; özel isim korunur, toplu aralık çakışması yazılmaz',()=>ui(async({node,data,context,change,commands})=>{
  assert.equal(nextTableNumber(data.tables,'1'),11);await renderDining(node,context);change('#section-filter','1');node.querySelector('#add-table').click();
  assert.equal(node.querySelector('[name=name]').value,'Masa 11');change('[name=sectionId]','2');assert.equal(node.querySelector('[name=name]').value,'Masa 5');
  change('[name=name]','Pencere önü');change('[name=sectionId]','1');assert.equal(node.querySelector('[name=name]').value,'Pencere önü');
  node.querySelector('#add-tables').click();assert.equal(node.querySelector('[name=start]').value,'11');change('[name=count]','40');assert.match(node.querySelector('#table-batch-preview').textContent,/Masa 11 → Masa 50 · 40/);
  change('[name=start]','1');node.querySelector('#dining-editor [type=submit]').click();assert.equal(commands.length,0);assert.match(node.querySelector('#dining-editor .error').textContent,/isimde masa/);
  change('[name=start]','99990');change('[name=count]','20');node.querySelector('#dining-editor [type=submit]').click();assert.equal(commands.length,0);assert.match(node.querySelector('#table-batch-preview').textContent,/99999/);
}));
test('masa düzenleme, kaldırma ve yeniden kullanma açık onay ve revision ile çalışır',()=>ui(async({node,context,change,commands})=>{
  await renderDining(node,context);manageTables(node);node.querySelector('[data-edit-table="1"]').click();change('[name=name]','Pencere <1>');change('[name=sectionId]','2');node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#dining-message')?.textContent==='Masa güncellendi.');assert.equal(commands[0].revision,'1');assert.equal(node.querySelector('#section-filter').value,'2');assert.equal(node.querySelector('[data-table="1"] h3').textContent,'Pencere <1>');assert.equal(node.querySelector('[data-table="1"] h3 img'),null);
  node.querySelector('[data-toggle-table="1"]').click();assert.equal(commands.length,1);assert.match(node.querySelector('#dining-editor').textContent,/Geçmiş hesaplar korunur/);node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#table-status')?.value==='inactive');assert.equal(commands[1].isActive,false);assert.equal(commands[1].revision,'2');assert.equal(node.querySelector('[data-open-table="1"]'),null);
  node.querySelector('[data-toggle-table="1"]').click();node.querySelector('#dining-editor [type=submit]').click();await until(()=>node.querySelector('#table-status')?.value==='active');
  assert.equal(commands[2].isActive,true);assert.equal(commands[2].revision,'3');assert.ok(node.querySelector('[data-edit-table="1"]'));
}));
test('kayıp yanıtta ekran yeniden açılsa da aynı komut kontrol edilir; çift basma çoğaltmaz',()=>ui(async({node,context,commands})=>{
  let drop=true,applied=0;const request=context.request;context.request=async(path,options)=>{if(!options)return request(path);commands.push(JSON.parse(options.body));if(drop){drop=false;applied++;throw new TypeError('lost');}return {id:'99'};};
  await renderDining(node,context);node.querySelector('#add-table').click();const submit=node.querySelector('#dining-editor [type=submit]');submit.click();submit.click();
  await until(()=>node.querySelector('#dining-editor .error').textContent.includes('Sonuç doğrulanamadı'));assert.equal(node.querySelector('#add-table').disabled,true);assert.equal(node.querySelector('#dining-refresh').disabled,true);
  await renderDining(node,context);assert.match(node.querySelector('#dining-editor').textContent,/Sonuç kontrolü/);node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#dining-message')?.textContent==='Masa oluşturuldu.');assert.equal(commands.length,2);assert.deepEqual(commands[0],commands[1]);assert.equal(applied,1);
}));
test('yazma sonrası yenileme hatasında yalnız ekran yenilenir; eski revision kesin hatada kilidi açar',()=>ui(async({node,context,change,commands})=>{
  const request=context.request;let failRead=false,writes=0;
  context.request=async(path,options)=>{if(options){writes++;failRead=true;return request(path,options);}if(failRead){failRead=false;throw new Error('refresh failed');}return request(path);};
  await renderDining(node,context);manageTables(node);node.querySelector('[data-edit-table="1"]').click();change('[name=name]','Yeni masa');node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#dining-editor .error').textContent.includes('İşlem kaydedildi'));assert.equal(node.querySelector('#dining-editor [type=submit]').textContent,'Ekranı yenile');node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#dining-message')?.textContent==='Masa güncellendi.');assert.equal(writes,1);assert.equal(commands.length,1);
  context.request=async(path,options)=>{if(options)throw Object.assign(new Error('Kayıt değişti. Güncel bilgileri yükleyin.'),{status:409,code:'REVISION_CONFLICT'});return request(path);};
  await renderDining(node,context);
  manageTables(node);
  node.querySelector('[data-edit-table="1"]').click();node.querySelector('#dining-editor [type=submit]').click();await until(()=>!node.querySelector('#add-table').disabled);
  assert.match(node.querySelector('#dining-editor .error').textContent,/Kayıt değişti/);assert.equal(node.querySelector('[name=name]').disabled,false);
}));
test('işlem sürerken ekran yeniden açılırsa kesin hata yeni ekranın kilidini de kaldırır',()=>ui(async({node,context})=>{
  const request=context.request;let rejectWrite;
  context.request=(path,options)=>options?new Promise((resolve,reject)=>{rejectWrite=reject;}):request(path);
  await renderDining(node,context);node.querySelector('#add-table').click();node.querySelector('#dining-editor [type=submit]').click();
  await renderDining(node,context);assert.equal(node.querySelector('#dining-editor [type=submit]').disabled,true);
  rejectWrite(Object.assign(new Error('Yetkiniz yok.'),{status:403,code:'PERMISSION_DENIED'}));
  await until(()=>!node.querySelector('#add-table').disabled);assert.match(node.querySelector('#dining-editor .error').textContent,/Yetkiniz yok/);
  node.querySelector('#add-table').click();assert.ok(node.querySelector('[name=name]'));
}));

test('düzenleme modu masaya dokununca yalnız form açar; yenilemede korunur ve bitirince siparişe döner',()=>ui(async({node,context,commands})=>{
  let opened=0;context.openTable=()=>opened++;context.openGroup=()=>opened++;
  await renderDining(node,context);assert.equal(node.querySelector('[data-edit-table]'),null);assert.equal(node.querySelector('#dining-management-tools').hidden,true);
  manageTables(node);node.querySelector('[data-edit-table="1"]').click();assert.equal(opened,0);assert.equal(commands.length,0);assert.equal(node.querySelector('[name=name]').value,'Masa 1');
  [...node.querySelectorAll('#dining-editor button')].find(button=>button.textContent==='Vazgeç').click();
  node.querySelector('#dining-refresh').click();await until(()=>!node.querySelector('#dining-refresh').disabled);assert.equal(node.querySelector('#dining-manage').getAttribute('aria-pressed'),'true');
  node.querySelector('#show-removed').click();assert.equal(node.querySelector('#table-status').value,'inactive');assert.ok(node.querySelector('[data-toggle-table="10"]'));
  node.querySelector('#dining-manage').click();assert.equal(node.querySelector('#table-status').value,'active');assert.equal(node.querySelector('[data-edit-table]'),null);assert.ok(node.querySelector('[data-open-table="1"]'));assert.equal(node.querySelector('#dining-management-tools').hidden,true);
}));

test('tek ve toplu ekleme arasında bölüm korunur; toplu varsayılanlar doğru komuta dönüşür',()=>ui(async({node,context,commands,change})=>{
  await renderDining(node,context);node.querySelector('#add-table').click();change('[name=sectionId]','2');
  node.querySelector('[data-add-mode=batch]').click();assert.equal(node.querySelector('[name=sectionId]').value,'2');assert.equal(node.querySelector('.dining-extra').open,false);assert.equal(node.querySelector('[name=start]').value,'5');
  node.querySelector('[data-add-mode=single]').click();assert.equal(node.querySelector('[name=sectionId]').value,'2');assert.equal(node.querySelector('[name=name]').value,'Masa 5');
  node.querySelector('[data-add-mode=batch]').click();change('[name=count]','3');assert.match(node.querySelector('#table-batch-preview').textContent,/Masa 5 → Masa 7/);
  node.querySelector('#dining-editor [type=submit]').click();await until(()=>commands.length===1);
  assert.equal(commands[0].path,'/api/dining/tables/batch');assert.equal(commands[0].sectionId,'2');assert.equal(commands[0].prefix,'Masa');assert.equal(commands[0].start,5);assert.equal(commands[0].count,3);
}));

test('belirsiz eklemede ekleme biçimi ve yönetim modu kilitlenir',()=>ui(async({node,context})=>{
  const request=context.request;context.request=async(path,options)=>{if(options)throw new TypeError('lost');return request(path);};
  await renderDining(node,context);node.querySelector('#add-table').click();node.querySelector('#dining-editor [type=submit]').click();
  await until(()=>node.querySelector('#dining-editor .error').textContent.includes('Sonuç doğrulanamadı'));
  assert.equal(node.querySelector('#dining-manage').disabled,true);assert.ok([...node.querySelectorAll('[data-add-mode]')].every(button=>button.disabled));
  assert.equal(node.querySelector('#dining-editor [type=submit]').disabled,false);
}));
