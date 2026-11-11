import {renderAssistant} from '../public/assistant.js';
import {checkPartyUi} from './party-ui-integration.js';
import {renderCash} from '../public/cash.js';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderDining } from '../public/dining.js';
import { renderSales } from '../public/sales.js';
import { renderStock,renderPurchases } from '../public/stock.js';
import { renderKitchen } from '../public/kitchen.js';
import { renderDefinitions } from '../public/definitions.js';
import { renderExpenses } from '../public/expenses.js';
import { renderReports } from '../public/reports.js';
import { renderAdministration,renderApprovals } from '../public/administration.js';
import { renderImports } from '../public/imports.js';
import { renderBackups } from '../public/backups.js';
import {renderSettings} from '../public/settings.js';
import {renderOverview} from '../public/overview.js';
import { renderCatalog } from '../public/catalog.js';
const eventually=async action=>{const until=Date.now()+5000;while(Date.now()<until){if(await action())return;await new Promise(resolve=>setTimeout(resolve,25));}assert.fail('Ekran işlemi tamamlanmalı');};
export async function checkUiFlows({call,cookie}){
  const dom=new JSDOM('<!doctype html><html><body><div id="workspace"></div></body></html>',{url:'http://127.0.0.1'});
  const originalDocument=globalThis.document,originalFormData=globalThis.FormData;globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;
  const request=async(path,options={})=>{const response=await call(path,options.body===undefined?undefined:JSON.parse(options.body),cookie,options.method||'POST');const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.title),{status:response.status,code:data.code});return data;};
  try{
    const {user}=await request('/api/auth/me');const workspace=dom.window.document.getElementById('workspace');
    const context={request,user,message:error=>error.message,isCurrent:()=>workspace.isConnected,openTab:()=>{},openGroup:()=>{},onUnauthorized:()=>{throw new Error('Unexpected logout');}};
    for(const renderer of [renderAssistant,renderCash,renderOverview,renderSettings,renderDining,renderStock,renderPurchases,renderKitchen,renderDefinitions,renderExpenses,renderReports,renderAdministration,renderApprovals,renderImports,renderBackups,renderCatalog]){
      await renderer(workspace,context);assert.ok(workspace.textContent.length>10,renderer.name);assert.ok(![...workspace.querySelectorAll('.error')].some(node=>node.textContent.trim()),`${renderer.name}: ${workspace.textContent}`);
    }
    await renderCash(workspace,context);assert.ok(!/vardiya/i.test(workspace.textContent));assert.ok(workspace.querySelector('[data-cash-history]'));assert.ok(workspace.textContent.includes('Patrona nakit teslimi'));assert.ok(workspace.querySelector('[name=toUserId]'));assert.ok(!workspace.querySelector('[data-close-shift]'));
    await renderAssistant(workspace,context);assert.equal(workspace.querySelector('#assistant-question button').disabled,true);assert.ok(workspace.querySelector('#guide-topics').textContent.includes('Veresiye'));let aiCalls=0;
    await renderAssistant(workspace,{...context,request:async(path,options)=>{if(path==='/api/assistant/status')return {configured:true};if(path==='/api/assistant/ask'){aiCalls++;return {answer:'<img src=x> Masalar ekranını aç.',screens:[{id:'tables',name:'Masalar'}]};}return request(path,options);}});
    workspace.querySelector('[name=question]').value='Adisyon nasıl açılır?';workspace.querySelector('#assistant-question button').click();workspace.querySelector('#assistant-question button').click();await eventually(()=>workspace.querySelector('#assistant-answer').textContent.includes('<img src=x>'));assert.equal(workspace.querySelector('#assistant-answer img'),null);assert.equal(aiCalls,1);
    await checkPartyUi({workspace,context,request,dom,eventually});
    // Entering an empty table only opens a local draft; first submission creates it.
    const section=await request('/api/dining/sections',{method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),name:'Tek dokunuş testi',sortOrder:0})});
    const table=await request('/api/dining/tables',{method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),name:'Tek dokunuş masası',sectionId:section.id,isActive:true})});
    let openedId=null,openCalls=0,tableDraft=null;
    const tableContext={...context,openTable:table=>{tableDraft=table;},openGroup:id=>{openedId=id;},request:async(path,options)=>{if(path==='/api/sales/open'||path===`/api/sales/tables/${table.id}/orders`)openCalls++;return request(path,options);}};
    const beforeDraft=(await request('/api/sales/groups')).groups.length;
    await renderDining(workspace,tableContext);const tableButton=workspace.querySelector('[data-open-table="'+table.id+'"]');
    tableButton.click();tableButton.click();await eventually(()=>tableDraft!==null);assert.equal(openCalls,0);assert.equal((await request('/api/sales/groups')).groups.length,beforeDraft);
    await renderSales(workspace,{...tableContext,tableDraft});const firstMenu=await request('/api/sales/menu'),firstOption=firstMenu.options.find(option=>option.name==='Cam Kola'&&!option.requiresWeight);assert.ok(firstOption);
    workspace.querySelector(`[data-product="${firstOption.productId}"]`).click();if(workspace.querySelector(`[data-variant="${firstOption.optionId}"]`))workspace.querySelector(`[data-variant="${firstOption.optionId}"]`).click();
    workspace.querySelector('#order-send [type=submit]').click();await eventually(()=>openedId!==null);assert.equal(openCalls,1);
    await renderDining(workspace,tableContext);workspace.querySelector('[data-open-table="'+table.id+'"]').click();await eventually(()=>!workspace.querySelector('[data-open-table="'+table.id+'"]').disabled);assert.equal(openCalls,1,'Occupied table navigates to its existing account');
    // Lost retail reply + a re-render must retry the same account, not open another.
    const beforeRetail=(await request('/api/sales/groups')).groups.length;let loseRetailReply=true,failNavigation=true,retailId=null;const openingCommands=[];
    const retailContext={...context,openGroup:id=>{if(failNavigation){failNavigation=false;throw new Error('Simulated navigation failure');}retailId=id;},request:async(path,options)=>{if(path==='/api/sales/open')openingCommands.push(JSON.parse(options.body));const result=await request(path,options);if(path==='/api/sales/open'&&loseRetailReply){loseRetailReply=false;throw new TypeError('Simulated lost opening reply');}return result;}};
    await renderSales(workspace,retailContext);const retailButton=workspace.querySelector('#open-retail');assert.ok(retailButton);assert.equal(workspace.querySelector('#new-retail form'),null);
    retailButton.click();retailButton.click();await eventually(()=>workspace.querySelector('#retail-message')?.textContent.includes('Sonuç doğrulanamadı'));
    await renderSales(workspace,retailContext);assert.equal(workspace.querySelector('#open-retail').textContent,'İşlemi kontrol et');workspace.querySelector('#open-retail').click();
    await eventually(()=>workspace.querySelector('#retail-message')?.textContent.includes('Adisyon açıldı'));assert.equal(workspace.querySelector('#open-retail').textContent,'Adisyona dön');workspace.querySelector('#open-retail').click();await eventually(()=>retailId!==null);
    assert.equal(openingCommands.length,2);assert.deepEqual(openingCommands[0],openingCommands[1]);assert.equal((await request('/api/sales/groups')).groups.length,beforeRetail+1);
    await renderSales(workspace,context);assert.ok(workspace.textContent.includes('Adisyon'));
    const groups=await request('/api/sales/groups');let group;
    for(const item of groups.groups){const data=await request(`/api/sales/groups/${item.id}`);if(BigInt(data.group.remainingMinor)>100n){group=data.group;break;}}
    assert.ok(group);let dropOrderReply=true;
    const orderContext={...context,groupId:group.id,request:async(path,options={})=>{const result=await request(path,options);if(path.endsWith('/orders')&&options.method==='POST'&&dropOrderReply){dropOrderReply=false;throw new TypeError('Simulated lost response');}return result;}};
    await renderSales(workspace,orderContext);
    assert.ok(workspace.querySelector('.order-layout>.order-catalog'));assert.ok(workspace.querySelector('.order-layout>.order-account'));assert.equal(workspace.querySelector('#payment-area'),null);
    const star=workspace.querySelector('[data-star]');assert.ok(star);const productId=star.dataset.star,wasFavorite=star.getAttribute('aria-pressed');star.click();
    await eventually(()=>workspace.querySelector(`[data-star="${productId}"]`)?.getAttribute('aria-pressed')!==wasFavorite);
    assert.equal(workspace.querySelectorAll('#draft-list .order-line').length,0,'Favorite star cannot add an order');
    const menu=await request('/api/sales/menu'),quick=menu.options.find(option=>option.name==='Cam Kola');assert.ok(quick);
    workspace.querySelector(`[data-product="${quick.productId}"]`).click();workspace.querySelector(`[data-product="${quick.productId}"]`).click();assert.equal(workspace.querySelectorAll('#draft-list .order-line').length,1,'Quick taps combine the same unsent item');
    workspace.querySelector('#draft-list [data-edit]').click();const picker=workspace.querySelector('#order-picker-form');picker.elements.namedItem('quantity').value='2';picker.elements.namedItem('note').value='Korunan not';
    const search=workspace.querySelector('#order-search');search.value='eşleşmeyen ürün';search.dispatchEvent(new dom.window.Event('input'));
    assert.equal(picker.elements.namedItem('quantity').value,'2');assert.equal(picker.elements.namedItem('note').value,'Korunan not');picker.querySelector('[type=submit]').click();
    const previousLines=group.lines.length;workspace.querySelector('#order-send [type=submit]').click();
    await eventually(()=>workspace.querySelector('#order-send .error')?.textContent.includes('Sonuç doğrulanamadı'));
    await renderSales(workspace,orderContext);assert.equal(workspace.querySelector('#order-send [type=submit]').textContent,'İşlemi kontrol et');workspace.querySelector('#order-send [type=submit]').click();
    await eventually(()=>workspace.querySelector('#draft-count')?.textContent==='Yeni sipariş yok');group=(await request(`/api/sales/groups/${group.id}`)).group;assert.equal(group.lines.length,previousLines+1,'Lost response and re-render cannot submit the order twice');assert.equal(group.lines.at(-1).quantity,'2.000000');assert.equal(group.lines.at(-1).note,'Korunan not');
    await renderSales(workspace,{...context,groupId:group.id,paymentMode:true,request:async(path,options)=>path==='/api/sales/payment-meta'?{shifts:[],customers:[]}:request(path,options)});
    assert.ok(workspace.querySelector('#open-payment-cash'));assert.ok(workspace.querySelector('button[value=cash]').disabled);assert.ok(workspace.querySelector('button[value=card]').disabled);assert.match(workspace.textContent,/Kasa henüz açılmamış/);
    await renderSales(workspace,{...context,groupId:group.id,paymentMode:true});
    assert.ok(!workspace.querySelector('.business-table tbody').textContent.includes('.000000'),'User quantities must not show the MySQL storage format');
    const buttons=[...workspace.querySelectorAll('#payment-area button[type=submit]')];assert.deepEqual(buttons.map(button=>button.textContent),['Nakit','POS','Veresiye']);
    const form=workspace.querySelector('#payment-area form');form.elements.namedItem('amount').value='1,00';form.elements.namedItem('shiftId').selectedIndex=1;
    buttons[1].click();
    await eventually(async()=>{const data=await request(`/api/sales/groups/${group.id}`);return data.group.settlements.length===group.settlements.length+1;});
    const after=(await request(`/api/sales/groups/${group.id}`)).group;assert.equal(after.settlements.at(-1).method,'card');assert.equal(after.settlements.at(-1).amountMinor,'100');
  }finally{globalThis.document=originalDocument;globalThis.FormData=originalFormData;dom.window.close();}
}
