import {formatQuantity} from './quantity-format.js';
import {html,input,select,formShell,commandForm,formatPrice,parsePrice} from './business-ui.js';
import {printAccount} from './print.js';
import {renderAccountTools} from './account-tools.js';
const scaled=value=>{const [a,b='']=String(value).split('.');if(!/^\d+$/.test(a)||!/^\d{0,6}$/.test(b))throw new Error('Miktarı nokta ile, en fazla altı ondalık basamakla yaz.');return BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));};
const ratio=(n,d)=>(n+d/2n)/d;
const stateName={submitted:'Gönderildi',preparing:'Hazırlanıyor',ready:'Hazır',delivered:'Teslim',cancelled:'İptal'};
export async function renderPaymentEntry(container,context){
  const {request,message,user,isCurrent,group,refresh,onOrder,openGroup}=context;
  const can=permission=>user.permissions.includes(permission)||user.permissionRules?.some(rule=>rule.code===permission&&!rule.requiresApproval&&rule.amountLimitMinor!==null);
  document.body.classList.remove('order-screen');container.classList.add('payment-workspace');
  const meta=(can('payments.write')&&group.status==='open')||(can('settings.manage')&&group.settlements.length)?await request('/api/sales/payment-meta'):null;
  if(!isCurrent())return;
  container.innerHTML=`<div class="catalog-heading"><div><h2>${html(group.tableName||`Hesap #${group.id}`)}</h2><p>${group.status==='open'?'Açık hesap':group.status==='closed'?'Kapanmış hesap':'Birleştirilmiş hesap'}</p></div><button class="secondary" id="sale-refresh">Yenile</button></div><div class="business-split"><section class="panel"><h3>Hesap özeti</h3><p class="mobile-table-hint">Tüm sütunları görmek için tabloyu sağa kaydırın.</p><div class="business-table-wrap"><table class="business-table"><thead><tr><th>Ürün / servis</th><th>Miktar</th><th>Birim fiyat</th><th>Tutar</th><th>Durum</th></tr></thead><tbody>${group.lines.filter(line=>line.state!=='cancelled').map(line=>`<tr><td>${html(line.productName)}<br><small>${html(line.optionName)}${line.note?` · ${html(line.note)}`:''}</small>${can('settings.manage')&&group.status==='open'&&line.state!=='cancelled'?`<br><button class="text-button" data-cancel-line="${html(line.id)}">İptal et</button>`:''}</td><td>${html(formatQuantity(line.quantity))} ${html(line.unitCode)}${group.itemPaymentsAvailable?`<br><small>Ödenen: ${html(formatQuantity(line.paidQuantity))}</small>`:''}</td><td>${html(formatPrice(line.unitPriceMinor))}${Number(line.priceBasisQuantity)===1000?' / kg':''}</td><td>${line.state==='cancelled'?`<s>${html(formatPrice(line.totalMinor))}</s>`:html(formatPrice(line.totalMinor))}</td><td>${html(stateName[line.state]||line.state)}</td></tr>`).join('')||'<tr><td colspan="5">Ödenecek aktif ürün yok.</td></tr>'}</tbody></table></div>${group.lines.some(line=>line.state==='cancelled')?`<details class="cancelled-summary"><summary>İptal edilenler · ${group.lines.filter(line=>line.state==='cancelled').length} satır</summary>${group.lines.filter(line=>line.state==='cancelled').map(line=>`<p><s>${html(line.productName)} · ${html(formatQuantity(line.quantity))} ${html(line.unitCode)} · ${html(formatPrice(line.totalMinor))}</s></p>`).join('')}</details>`:''}<p>Toplam: <strong>${html(formatPrice(group.totalMinor))}</strong> · Kapatılan: ${html(formatPrice(group.settledMinor))}</p><h3>Kalan: ${html(formatPrice(group.remainingMinor))}</h3><div id="line-action"></div><details><summary>Ödeme geçmişi (${group.settlements.length})</summary>${group.settlements.map(item=>`<p>${item.direction==='refund'?'İade · ':''}${item.method==='cash'?'Nakit':item.method==='card'?'POS':'Veresiye'} · ${html(formatPrice(item.amountMinor))}</p>`).join('')}</details></section><section id="payment-area" class="panel"></section></div><section id="order-area" class="panel"></section><section id="account-tools" class="panel"></section>`;
  const byId=id=>container.querySelector(`#${id}`);
  const print=document.createElement('button');print.className='secondary';print.textContent='Hesap özeti yazdır';print.addEventListener('click',()=>printAccount(group));byId('sale-refresh').before(print);
  byId('sale-refresh').addEventListener('click',()=>void refresh());
  const bind=(element,path,values,success=refresh)=>commandForm(element.querySelector('form'),{request,message,path,values,success});
  container.querySelectorAll('[data-cancel-line]').forEach(button=>button.addEventListener('click',()=>{
    byId('line-action').innerHTML=formShell(input('reason','İptal gerekçesi','','required maxlength="500"')+select('disposition','Stok sonucu',[{id:'unprepared',name:'Hazırlanmadı; uygun stok geri döner'},{id:'waste',name:'Hazırlandı / tüketilemedi; stok geri eklenmez'}]));
    bind(byId('line-action'),`/api/sales/groups/${group.id}/lines/${button.dataset.cancelLine}/cancel`,form=>({revision:group.revision,reason:form.get('reason'),disposition:form.get('disposition')}));
  }));
  container.querySelectorAll('[data-cancel-line]').forEach(button=>{
    const adjust=document.createElement('button');adjust.className='text-button';adjust.textContent='İndirim / ikram';button.after(adjust);
    adjust.addEventListener('click',()=>{byId('line-action').innerHTML=formShell(select('kind','İşlem',[{id:'discount',name:'İndirim'},{id:'complimentary',name:'Satırın tamamı ikram'}])+input('amount','İndirim tutarı (TL)','','inputmode="decimal"')+input('reason','Gerekçe','','required maxlength="500"'));
      bind(byId('line-action'),`/api/sales/groups/${group.id}/lines/${button.dataset.cancelLine}/adjust`,form=>({revision:group.revision,kind:form.get('kind'),amountMinor:form.get('kind')==='discount'?parsePrice(form.get('amount')):undefined,reason:form.get('reason')}));});
  });
  if(can('settings.manage')&&group.settlements.some(item=>item.direction==='settle')){
    const node=document.createElement('section');node.className='panel';node.innerHTML=`<h3>Tahsilat / veresiye payı iadesi</h3><p>Seçilen ödeme parçası bütünüyle geri alınır. Sipariş ve stok ayrı kalır; hesap yeniden açılır. POS iadesini fiziksel cihazda ayrıca yap.</p>${formShell(select('settlementId','İade edilecek parça',group.settlements.filter(item=>item.direction==='settle').map(item=>({id:item.id,name:`#${item.id} · ${item.method==='credit'?'Veresiye':item.method==='cash'?'Nakit':'POS'} · ${formatPrice(item.amountMinor)}`})))+select('shiftId','İade kasası',[{id:'',name:'Veresiye geri alımında boş bırakılabilir'},...(meta?.shifts||[])])+input('reason','İade gerekçesi','','required maxlength="500"'))}`;container.append(node);
    bind(node,`/api/sales/groups/${group.id}/refunds`,form=>({revision:group.revision,settlementId:form.get('settlementId'),shiftId:form.get('shiftId')||null,reason:form.get('reason')}));
  }
  if(group.status==='merged'){
    byId('payment-area').innerHTML=`<p>Bu hesap başka hesaba birleştirilmiş.</p><button id="merged-target" class="primary">Birleşik hesabı aç</button>`;
    byId('merged-target').addEventListener('click',()=>openGroup(group.mergedIntoId));return;
  }
  if(group.status!=='open'){byId('payment-area').textContent='Hesap tamamlandı.';return;}
  if(meta){
    let mode='amount';
    byId('payment-area').innerHTML=`<h3>Ödeme al</h3><p>POS düğmesi, fiziksel cihazda alınan kart ödemesini kaydeder.</p><label>Ödeme biçimi<select id="payment-mode"><option value="amount">Tutar girerek öde</option>${group.itemPaymentsAvailable?'<option value="items">Ürün seçerek öde</option>':''}</select></label>${formShell(`<div id="payment-items" hidden>${group.lines.filter(line=>line.state!=='cancelled').map(line=>input(`line-${line.id}`,`${line.productName} · ${line.optionName} (${line.unitCode})`,'0','inputmode="decimal"')).join('')}</div>${input('amount','Ödenecek tutar',`${BigInt(group.remainingMinor)/100n},${(BigInt(group.remainingMinor)%100n).toString().padStart(2,'0')}`,'inputmode="decimal" required')}${select('shiftId','Açık kasa',[{id:'',name:'Kasa seç'},...meta.shifts])}${select('customerId','Veresiye için müşteri',[{id:'',name:'Müşteri seç'},...meta.customers])}<p id="pay-selection" role="status"></p><div class="editor-buttons"><button type="submit" name="method" value="cash" class="primary">Nakit</button><button type="submit" name="method" value="card" class="primary">POS</button><button type="submit" name="method" value="credit" class="secondary">Veresiye</button></div>`)}`;
    const form=byId('payment-area').querySelector('form');form.lastElementChild.remove();
    if(context.creditCustomer&&meta.customers.some(row=>row.id===context.creditCustomer.id)){form.elements.namedItem('customerId').value=context.creditCustomer.id;const note=document.createElement('p');note.textContent=context.creditCustomer.name+' için veresiye satış: borca yazmak için Veresiye düğmesini kullan.';form.before(note);}
    if(meta.shifts.length===1)form.elements.namedItem('shiftId').value=meta.shifts[0].id;
    if(!meta.shifts.length){const notice=document.createElement('div');notice.className='payment-notice';notice.innerHTML='<strong>Kasa henüz açılmamış.</strong><p>Nakit / POS tahsilatı için önce kasa açılmalı.</p>'+(can('cash.manage')?'<button type="button" class="secondary" id="open-payment-cash">Kasayı aç</button>':'<p>Kasa sorumlusundan kasayı açmasını iste.</p>');form.before(notice);notice.querySelector('button')?.addEventListener('click',()=>context.openTab?.('cash'));form.querySelectorAll('button[name=method]').forEach(button=>{if(button.value!=='credit'){button.disabled=true;button.dataset.unavailable='1';}});}
    let method='cash';form.querySelectorAll('button[name=method]').forEach(button=>button.addEventListener('click',()=>method=button.value));
    function selected(){
      const items=[];let total=0n;
      for(const line of group.lines){const field=form.elements.namedItem(`line-${line.id}`);if(!field)continue;const quantity=scaled(field.value||'0');if(quantity===0n)continue;
        const paid=scaled(line.paidQuantity);const sold=scaled(line.quantity);if(quantity+paid>sold)throw new Error('Seçim kalan ürün miktarını aşıyor.');
        total+=ratio((paid+quantity)*BigInt(line.totalMinor),sold)-BigInt(line.paidMinor);items.push({lineId:line.id,quantity:field.value});}
      return {items,total};
    }
    byId('payment-mode').addEventListener('change',event=>{mode=event.target.value;byId('payment-items').hidden=mode!=='items';form.elements.namedItem('amount').readOnly=mode==='items';});
    byId('payment-items').addEventListener('input',()=>{try{const {total}=selected();form.elements.namedItem('amount').value=`${total/100n},${(total%100n).toString().padStart(2,'0')}`;byId('pay-selection').textContent='';}catch(error){byId('pay-selection').textContent=message(error);}});
    commandForm(form,{request,message,path:`/api/sales/groups/${group.id}/payments`,values:fields=>{if(method!=='credit'&&!fields.get('shiftId'))throw new Error('Nakit / POS için açık kasa seç. Kasa yoksa önce Kasayı aç düğmesini kullan.');if(method==='credit'&&!fields.get('customerId'))throw new Error('Veresiye için müşteri seç.');return {revision:group.revision,method,amountMinor:parsePrice(fields.get('amount')),shiftId:fields.get('shiftId'),customerId:fields.get('customerId'),...(mode==='items'?{items:selected().items}:{})};},success:refresh});
  }else byId('payment-area').textContent='Tahsilat için ödeme yetkisi gerekli.';
  if(can('orders.write')){byId('order-area').innerHTML='<button type="button" class="secondary" id="back-to-order">Ürün ekle / adisyona dön</button>';byId('back-to-order').addEventListener('click',onOrder);}
  await renderAccountTools(byId('account-tools'),{...context,can,refresh});
}
