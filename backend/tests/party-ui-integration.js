import assert from 'node:assert/strict';
import {renderCustomers,renderSuppliers} from '../public/party-book.js';
import {renderSales} from '../public/sales.js';
import {renderPurchases} from '../public/purchases.js';

export async function checkPartyUi({workspace,context,request,dom,eventually}){
  const post=(path,body)=>request(path,{method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),...body})});
  const register=await post('/api/finance/registers',{code:'party-ui-'+crypto.randomUUID().slice(0,8),name:'Arayüz tahsilat kasası'});
  await post('/api/finance/shifts',{registerId:register.id,openingMinor:'0'});
  async function add(renderer,name){
    await renderer(workspace,context);workspace.querySelector('#party-add').click();
    const form=workspace.querySelector('#party-create form');form.elements.namedItem('name').value=name;form.querySelector('[type=submit]').click();
    await eventually(()=>workspace.querySelector('.party-detail h3')?.textContent===name);
    return (await request('/api/finance/parties')).parties.find(row=>row.name===name);
  }
  const customer=await add(renderCustomers,'Arayüz veresiye müşterisi');assert.ok(customer.isCustomer&&!customer.isSupplier);
  assert.equal(workspace.querySelector('[name=accountType]'),null);assert.equal(workspace.querySelector('[name=kind]'),null);
  let groupId=null,preferred=null;const creditContext={...context,openCustomerGroup:(id,party)=>{groupId=id;preferred=party;}};
  await renderCustomers(workspace,creditContext);workspace.querySelector(`[data-party="${customer.id}"]`).click();await eventually(()=>workspace.querySelector('#party-sale'));
  workspace.querySelector('#party-sale').click();await eventually(()=>groupId!==null);assert.equal(preferred.id,customer.id);
  let group=(await request('/api/sales/groups/'+groupId)).group;
  const menu=await request('/api/sales/menu'),option=menu.options.find(row=>row.name==='Cam Kola');assert.ok(option);
  group=(await post(`/api/sales/groups/${groupId}/orders`,{revision:group.revision,items:[{optionId:option.optionId,quantity:'1',note:'Veresiye arayüz testi'}]})).group;
  await renderSales(workspace,{...context,groupId,paymentMode:true,creditCustomer:preferred});
  assert.equal(workspace.querySelector('[name=customerId]').value,customer.id,'The customer is selected only for the account opened from their card');
  workspace.querySelector('button[value=credit]').click();
  await eventually(()=>workspace.querySelector('.catalog-heading p')?.textContent==='Kapanmış hesap');
  await eventually(async()=>BigInt((await request('/api/finance/parties')).parties.find(row=>row.id===customer.id).receivableMinor)===BigInt(group.totalMinor));
  let dropReply=true;const receiptContext={...context,request:async(path,options)=>{const result=await request(path,options);if(path===`/api/finance/parties/${customer.id}/entries`&&dropReply){dropReply=false;throw new TypeError('Lost receipt response');}return result;}};
  await renderCustomers(workspace,receiptContext);workspace.querySelector(`[data-party="${customer.id}"]`).click();await eventually(()=>workspace.querySelector('#party-pay'));workspace.querySelector('#party-pay').click();await eventually(()=>workspace.querySelector('#party-action [name=amount]'));
  let form=workspace.querySelector('#party-action form');form.elements.namedItem('amount').value='1,00';form.querySelector('[type=submit]').click();await eventually(()=>form.querySelector('.error').textContent.includes('Sonuç doğrulanamadı'));form.querySelector('[type=submit]').click();
  await eventually(()=>workspace.querySelector('#party-action form')===null&&workspace.querySelector('#party-pay'));
  const ledger=await request(`/api/finance/parties/${customer.id}/ledger`);assert.equal(ledger.entries.filter(row=>row.type==='payment').length,1);assert.equal((await request('/api/finance/parties')).parties.find(row=>row.id===customer.id).receivableMinor,(BigInt(group.totalMinor)-100n).toString());
  const supplier=await add(renderSuppliers,'Arayüz tedarikçisi');assert.ok(!supplier.isCustomer&&supplier.isSupplier);
  assert.equal(workspace.querySelector(`[data-party="${customer.id}"]`),null,'Customer accounts do not leak into supplier list');
  form=workspace.querySelector('#party-opening form');form.elements.namedItem('amount').value='10';form.elements.namedItem('description').value='Önceki tedarikçi bakiyesi';form.querySelector('[type=submit]').click();await eventually(()=>workspace.querySelector('#party-pay'));
  workspace.querySelector('#party-pay').click();await eventually(()=>workspace.querySelector('#party-action [name=amount]'));form=workspace.querySelector('#party-action form');assert.ok(form.querySelector('[type=submit]').textContent.includes('Ödemeyi'));form.elements.namedItem('amount').value='2';form.querySelector('[type=submit]').click();
  await eventually(async()=>(await request('/api/finance/parties')).parties.find(row=>row.id===supplier.id).payableMinor==='800');
  await renderCustomers(workspace,context);assert.equal(workspace.querySelector(`[data-party="${supplier.id}"]`),null);
  const search=workspace.querySelector('#party-search');search.value='olmayan müşteri';search.dispatchEvent(new dom.window.Event('input'));assert.equal(workspace.querySelectorAll('[data-party]').length,0);
  await renderPurchases(workspace,context);assert.equal(workspace.querySelector('#new-purchase').hidden,true);workspace.querySelector('#purchase-new').click();assert.equal(workspace.querySelector('#new-purchase').hidden,false);
  const filter=workspace.querySelector('#purchase-filter');filter.value='draft';filter.dispatchEvent(new dom.window.Event('change'));assert.ok(!workspace.querySelector('#purchase-list').textContent.includes('Mal teslim alındı'));
}
