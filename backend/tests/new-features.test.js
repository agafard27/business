import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderAccountTools} from '../public/account-tools.js';
import {printAccount} from '../public/print.js';
import {availableGuides,mountScreenGuide} from '../public/screen-guide.js';
import {guideTopics} from '../public/guide-scenarios.js';
import {mountDisplayMode} from '../public/display-mode.js';
import {standardFactor} from '../src/catalog/units.js';
import {actionLabel,outcomeLabel,kindLabel} from '../public/operation-labels.js';
import {renderExpenses} from '../public/expenses.js';
import {renderNetworkSettings} from '../public/network-settings.js';
const until=async action=>{for(let i=0;i<100;i++){if(action())return;await new Promise(resolve=>setTimeout(resolve,5));}assert.fail('UI must settle');};
async function ui(action){const dom=new JSDOM('<header></header><div id="workspace"></div>',{url:'http://127.0.0.1'});const saved={document:globalThis.document,window:globalThis.window,FormData:globalThis.FormData};Object.assign(globalThis,{document:dom.window.document,window:dom.window,FormData:dom.window.FormData});try{await action(dom,document.querySelector('#workspace'));}finally{Object.assign(globalThis,saved);dom.window.close();}}
const dining={sections:[{id:'1',name:'Salon'}],tables:[{id:'1',name:'Masa 1',sectionId:'1',isActive:true,groupId:'1',groupRevision:'3',remainingMinor:'100'},{id:'2',name:'Masa 2',sectionId:'1',isActive:true,groupId:null},{id:'3',name:'Masa 3',sectionId:'1',isActive:true,groupId:'2',groupRevision:'4',remainingMinor:'200'}]};
test('masa taşıma boş hedef ister; belirsiz yanıtta hedef ve aynı komut korunur',()=>ui(async(dom,node)=>{
 const commands=[];let refreshed=0;
 const request=async(path,options)=>{if(path==='/api/dining')return dining;commands.push(JSON.parse(options.body));if(commands.length===1)throw new TypeError('lost');return {group:{id:'1'}};};
 await renderAccountTools(node,{request,group:{id:'1',revision:'3',remainingMinor:'100'},message:error=>error.message,isCurrent:()=>true,can:()=>true,refresh:()=>{refreshed++;},openGroup:()=>{}});
 node.querySelector('#choose-move').click();assert.equal(node.querySelector('[data-target="3"]').disabled,true);assert.equal(node.querySelector('[data-target="1"]').disabled,true);assert.equal(node.querySelector('[data-target="2"]').disabled,false);
 node.querySelector('[data-target="2"]').click();node.querySelector('[name=reason]').value='Yer değişimi';node.querySelector('#table-action-form [type=submit]').click();
 await until(()=>node.querySelector('#table-action-form .error').textContent.includes('Sonuç doğrulanamadı'));assert.equal(node.querySelector('#choose-merge').disabled,true);
 node.querySelector('#table-action-form [type=submit]').click();await until(()=>refreshed===1);assert.deepEqual(commands[0],commands[1]);assert.equal(commands[0].tableId,'2');
}));
test('birleştirme dolu hedef ve revision kullanır; kesin hatadan sonra işlem değiştirilebilir',()=>ui(async(dom,node)=>{
 let opened=null,payload;
 await renderAccountTools(node,{request:async(path,options)=>{if(path==='/api/dining')return dining;payload=JSON.parse(options.body);if(path.endsWith('/move'))throw Object.assign(new Error('Masa doldu'),{status:409,code:'TABLE_OCCUPIED'});return {group:{id:'2'}};},group:{id:'1',revision:'3',remainingMinor:'100'},message:error=>error.message,isCurrent:()=>true,can:()=>true,refresh:()=>{},openGroup:id=>{opened=id;}});
 node.querySelector('#choose-move').click();node.querySelector('[data-target="2"]').click();node.querySelector('[name=reason]').value='Taşı';node.querySelector('#table-action-form [type=submit]').click();await until(()=>node.querySelector('#table-action-form .error').textContent==='Masa doldu');
 assert.equal(node.querySelector('#choose-merge').disabled,false);node.querySelector('#choose-merge').click();assert.equal(node.querySelector('[data-target="2"]').disabled,true);assert.equal(node.querySelector('[data-target="3"]').disabled,false);
 node.querySelector('[data-target="3"]').click();node.querySelector('[name=reason]').value='Birlikte ödeme';node.querySelector('#table-action-form [type=submit]').click();await until(()=>opened==='2');assert.equal(payload.targetRevision,'4');assert.equal(payload.targetId,'2');
}));
test('hesap çıktısı masa adını kaçırarak basar; masasız açıklaması kaybolmaz',()=>ui(async(dom,node)=>{
 const group={id:'3',tableName:'Masa <8>',lines:[],totalMinor:'0',settledMinor:'0',remainingMinor:'0'};let captured='';
 dom.window.print=()=>{captured=document.querySelector('#nar-print').innerHTML;};printAccount(group);assert.match(captured,/Masa: Masa &lt;8&gt;/);assert.equal(document.querySelector('#nar-print'),null);
 printAccount({...group,tableName:null});assert.match(captured,/Masasız adisyon/);
}));
test('rehber senaryoları rolü süzer; kg/kova/avans bulunur ve örnekler kayıt oluşturmaz',()=>ui(async(dom,node)=>{
 const owner={permissions:['catalog.manage','purchases.manage','expenses.manage','stock.manage','settings.read']};
 assert.ok(availableGuides(owner,'wifi').some(row=>row.id==='wifi-activate'));assert.ok(availableGuides(owner,'kova').some(row=>row.id==='purchase-bucket'));assert.ok(availableGuides(owner,'kg gram').some(row=>row.id==='purchase-bulk'));assert.ok(availableGuides(owner,'personel avansı').length>0);
 const waiter={permissions:['tables.read','orders.write']};assert.ok(!availableGuides(waiter).some(row=>row.screenId==='expenses'));assert.ok(availableGuides(waiter).some(row=>row.id==='table-move'));
 mountScreenGuide(node,waiter,'tables');assert.match(node.textContent,/40 masayı/);assert.equal(node.querySelector('form'),null);assert.ok(guideTopics.every(row=>row.steps.length>=3&&row.result));assert.equal(new Set(guideTopics.map(row=>row.id)).size,guideTopics.length);
}));
test('görünüm tercihi tarayıcıda saklanır, otomatik genişliğe uyar ve yetki değiştirmez',()=>ui(async(dom)=>{
 const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},media={matches:true,addEventListener(type,fn){this.update=fn;},removeEventListener(){}};
 const dispose=mountDisplayMode(document.querySelector('header'),{storage,media});assert.equal(document.documentElement.dataset.layout,'phone');
 const select=document.querySelector('select');select.value='pc';select.dispatchEvent(new dom.window.Event('change'));assert.equal(store.get('nar.displayMode'),'pc');assert.equal(document.documentElement.dataset.layout,'pc');
 select.value='auto';select.dispatchEvent(new dom.window.Event('change'));media.matches=false;media.update();assert.equal(document.documentElement.dataset.layout,'pc');dispose();
 const clean=mountDisplayMode(document.querySelector('header'),{storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},media});assert.equal(document.querySelector('select').value,'auto');clean();
}));
test('standart fiziksel oranlar kesindir; kova, porsiyon ve farklı boyutlar tahmin edilmez',()=>{
 const unit=(code,dimension)=>({code,dimension});assert.equal(standardFactor(unit('kg','mass'),unit('g','mass')),1000000000n);assert.equal(standardFactor(unit('g','mass'),unit('kg','mass')),1000n);
 assert.equal(standardFactor(unit('l','volume'),unit('ml','volume')),1000000000n);assert.equal(standardFactor(unit('kova','package'),unit('l','volume')),null);assert.equal(standardFactor(unit('kg','mass'),unit('l','volume')),null);assert.equal(standardFactor(unit('dilim','count'),unit('g','mass')),null);
 assert.equal(actionLabel('sales.line.cancel'),'Sipariş satırı iptal edildi');assert.equal(outcomeLabel('succeeded'),'Başarılı');assert.equal(kindLabel('stock','receipt'),'Mal kabulü');assert.match(actionLabel('future.unknown'),/Tanımlanmamış işlem/);
});
test('avans kısayolu personeli zorunlu tutar ve kayıtları personele göre süzer',()=>ui(async(dom,node)=>{
 const staff=[{id:'5',name:'Ayşe'},{id:'6',name:'Mehmet'}],data={categories:[{id:'1',name:'Personel'}],staff,suppliers:[],shifts:[],equipment:[],expenses:staff.map(person=>({id:person.id,staffId:person.id,description:person.name+' avans',type:'staff_advance',categoryName:'Personel',incurredAtUtc:'2026-10-29T08:00:00Z',totalMinor:'50000',remainingMinor:'0'}))};
 await renderExpenses(node,{request:async()=>data,message:error=>error.message,isCurrent:()=>true});
 node.querySelector('#staff-advance-shortcut').click();assert.equal(node.querySelector('[name=type]').value,'staff_advance');assert.equal(node.querySelector('[name=staffId]').required,true);
 const filter=node.querySelector('#expense-staff-filter');filter.value='5';filter.dispatchEvent(new dom.window.Event('change'));assert.equal(node.querySelector('[data-staff-record="6"]').hidden,true);assert.equal(node.querySelector('[data-staff-record="5"]').hidden,false);
 node.querySelector('#staff-payment-shortcut').click();assert.equal(node.querySelector('[name=type]').value,'staff_payment');
}));
test('ağ etkinleştirme IP girdisi istemez, güven onayı ve güncel revision gönderir',()=>ui(async(dom,node)=>{
 let sent;const context={isCurrent:()=>true,message:error=>error.message,request:async(path,options)=>{if(options){sent=JSON.parse(options.body);return {phase:'inactive'};}return {phase:'inactive',revision:'7',active:false,canConfigure:true};}};
 await renderNetworkSettings(node,context);assert.equal(node.querySelector('[name=address]'),null);const form=node.querySelector('#network-activate form');form.querySelector('[type=submit]').click();assert.equal(sent,undefined);
 form.querySelector('[name=trustedNetwork]').checked=true;form.querySelector('[type=submit]').click();await until(()=>Boolean(sent));assert.equal(sent.revision,'7');assert.equal(sent.trustedNetwork,true);assert.equal(sent.action,'activate');
 await renderNetworkSettings(node,{...context,request:async()=>({phase:'inactive',active:false,canConfigure:false})});assert.equal(node.querySelector('#network-activate'),null);
}));
