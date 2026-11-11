import {formatQuantity} from './quantity-format.js';
import {renderAccountTools} from './account-tools.js';
import {html,input,select,formShell,commandForm,formatPrice} from './business-ui.js';

const drafts=new Map();
const states={submitted:'Gönderildi',preparing:'Hazırlanıyor',ready:'Hazır',delivered:'Teslim edildi',cancelled:'İptal'};
const normalize=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replaceAll('ı','i');
const quantity=value=>{value=String(value).trim().replace(',','.');if(!/^(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(value))throw new Error('Miktarı en fazla altı ondalık basamakla gir.');const [whole,fraction='']=value.split('.');const result=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));if(!result)throw new Error('Miktar sıfırdan büyük olmalı.');return result;};
const decimal=value=>`${value/1000000n}${value%1000000n?'.'+(value%1000000n).toString().padStart(6,'0').replace(/0+$/,''):''}`;
const amount=(option,value)=>{const n=quantity(value)*BigInt(option.unitPriceMinor),d=quantity(option.priceBasisQuantity);return (n+d/2n)/d;};
const shortQty=formatQuantity;

export function renderTableOrder(container,context){
  const table=context.tableDraft;
  const group={id:'draft-table-'+table.id,tableId:table.id,tableName:table.name,status:'draft',lines:[],settlements:[],totalMinor:'0',settledMinor:'0',remainingMinor:'0'};
  return renderOrderEntry(container,{...context,group,onRefresh:()=>renderTableOrder(container,context)});
}

export async function renderOrderEntry(container,context){
  const {request,message,user,isCurrent,group,onPayment,onRefresh,openTab}=context;
  const menu=await request('/api/sales/menu');if(!isCurrent())return;
  document.body.classList.add('order-screen');container.classList.remove('payment-workspace');
  const key=`${user.id}:${group.id}`;
  let state=drafts.get(key);
  if(!state){state={items:[],search:'',category:'',favorites:false,picker:null,inputs:{},pending:null,locked:false,warehouseId:menu.warehouses.length===1?menu.warehouses[0].id:''};drafts.set(key,state);}
  const can=code=>user.permissions.includes(code)||user.permissionRules?.some(rule=>rule.code===code&&!rule.requiresApproval&&rule.amountLimitMinor!==null);
  const optionsFor=id=>menu.options.filter(option=>option.productId===id);
  const optionById=id=>menu.options.find(option=>option.optionId===id);
  const categories=[...new Set(menu.options.map(option=>option.categoryName||'Diğer'))];
  container.innerHTML=`<div class="order-heading"><div><span class="order-kicker">${context.tableDraft?'SİPARİŞ TASLAĞI':'ADİSYON #'+html(group.id)}</span><h2>${html(group.tableName||'Hızlı satış')}</h2>${context.creditCustomer?`<p>${html(context.creditCustomer.name)} için veresiye satış</p>`:''}</div><div class="order-toolbar"><button type="button" class="secondary" id="order-tables">Masalara dön</button><button type="button" class="secondary" id="order-refresh">Yenile</button>${!context.tableDraft&&can('payments.write')?'<button type="button" class="secondary" id="order-payment">Ödeme ekranı</button>':''}</div></div>
    <div class="order-layout"><section class="order-catalog" aria-label="Ürün ekleme"><label for="order-search">Ürün ara / barkod okut</label><div class="order-search-row"><input id="order-search" type="search" value="${html(state.search)}" maxlength="180" placeholder="Çay, gözleme veya barkod…" autocomplete="off"><button type="button" class="secondary" id="order-clear">Temizle</button></div><div class="order-filters"><div class="order-filter-buttons" role="group" aria-label="Ürün listesi"><button type="button" id="order-all" aria-pressed="${!state.favorites}">Tüm ürünler</button><button type="button" id="order-favorites" aria-pressed="${state.favorites}">★ Favoriler</button></div>${select('category','Kategori',[{id:'',name:'Bütün kategoriler'},...categories.map(name=>({id:name,name}))],state.category)}</div><p id="order-results" class="order-muted" role="status"></p><div id="order-picker"></div><div id="sale-products" class="order-products"></div><p id="order-error" class="error" role="alert"></p></section>
    <section class="order-account" aria-label="Masa hesabı"><div class="order-account-heading"><h3>Masa hesabı</h3><span id="draft-count" class="order-tag"></span></div><div class="order-account-scroll"><div id="draft-list"></div><details class="order-sent" ${group.lines.length?'open':''}><summary>Gönderilen ürünler · ${group.lines.filter(line=>line.state!=='cancelled').length} satır</summary><div class="order-sent-list">${group.lines.filter(line=>line.state!=='cancelled').map(line=>`<article class="order-line ${line.state==='cancelled'?'order-cancelled':''}"><div class="order-line-top"><strong>${html(line.productName)}</strong><span>${html(formatPrice(line.totalMinor))}</span></div><p>${html(shortQty(line.quantity))} ${html(line.unitCode)} · ${html(line.optionName)}</p>${line.note?`<p>Not: ${html(line.note)}</p>`:''}${line.stockIssue?`<p class="order-stock-notice">Satış kaydedildi · Stok kontrolü bekliyor: ${html(line.stockIssue.message)}</p>`:''}<span class="order-tag ${line.state==='ready'?'is-ready':''}">${html(states[line.state]||line.state)}</span>${line.state!=='cancelled'?`<button type="button" class="text-button" data-cancel-request="${html(line.id)}">İptal iste</button>`:''}</article>`).join('')||'<p class="order-empty">Henüz gönderilmiş ürün yok.</p>'}</div></details>${group.lines.some(line=>line.state==='cancelled')?`<details class="order-sent"><summary>İptal edilenler · ${group.lines.filter(line=>line.state==='cancelled').length}</summary>${group.lines.filter(line=>line.state==='cancelled').map(line=>`<p class="order-muted"><s>${html(line.productName)} · ${html(shortQty(line.quantity))} ${html(line.unitCode)}</s></p>`).join('')}</details>`:''}<div id="order-cancel"></div></div><div class="order-totals"><div><span>Gönderilen hesap</span><strong>${html(formatPrice(group.totalMinor))}</strong></div><div><span>Yeni eklenecekler</span><strong id="draft-total"></strong></div><div><span>Önceki ödemeler</span><strong>${html(formatPrice(group.settledMinor))}</strong></div><div class="order-grand-total"><span>Kalan + yeni sipariş</span><strong id="order-total"></strong></div></div><div id="order-send">${formShell('<p id="draft-message" class="order-muted"></p>')}</div><details class="order-tools"><summary>Diğer hesap işlemleri</summary><div id="order-tools"></div></details></section></div>`;
  const byId=id=>container.querySelector(`#${id}`);
  byId('order-tables').addEventListener('click',()=>openTab?.('tables'));
  byId('order-refresh').addEventListener('click',()=>void onRefresh());
  byId('order-payment')?.addEventListener('click',()=>{if(state.items.length){byId('order-error').textContent='Ödemeye geçmeden yeni ürünleri gönder veya taslaktan kaldır.';return;}onPayment();});
  const sendForm=byId('order-send').querySelector('form');
  sendForm.querySelector('button[type=submit]').textContent='Siparişi gönder';
  if(menu.warehouses.length>1){const settings=document.createElement('details');settings.className='order-stock-settings';settings.innerHTML='<summary>Siparişin tüketim deposu</summary>'+select('warehouseId','Depo',[{id:'',name:'Depo seç'},...menu.warehouses],state.warehouseId);byId('order-send').before(settings);settings.querySelector('select').addEventListener('change',event=>state.warehouseId=event.target.value);}

  function setLocked(locked){state.locked=locked;container.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=locked);if(!locked)drawDraft();}
  function drawDraft(){
    let total=0n;
    byId('draft-list').innerHTML=state.items.map((item,index)=>{const option=optionById(item.optionId);if(!option)return '';const sum=amount(option,item.quantity);total+=sum;return `<article class="order-line is-draft"><div class="order-line-top"><strong>${html(option.name)}</strong><strong>${html(formatPrice(sum.toString()))}</strong></div><p>${html(option.optionName)} · ${html(shortQty(item.quantity))} ${html(option.unitCode)}</p>${item.note?`<p>${html(item.note)}</p>`:''}<div class="order-line-actions"><span class="order-tag is-draft">Gönderilmedi</span>${!option.requiresWeight?`<button type="button" data-minus="${index}" aria-label="${html(option.name)} azalt">−</button><strong>${html(shortQty(item.quantity))}</strong><button type="button" data-plus="${index}" aria-label="${html(option.name)} artır">+</button>`:''}<button type="button" data-edit="${index}">Not / miktar</button><button type="button" data-remove="${index}">Kaldır</button></div></article>`;}).join('')||'<p class="order-empty">Soldan bir ürüne dokunarak siparişe ekle.</p>';
    byId('draft-total').textContent=formatPrice(total.toString());byId('order-total').textContent=formatPrice((BigInt(group.remainingMinor)+total).toString());byId('draft-count').textContent=state.items.length?`${state.items.length} yeni satır`:'Yeni sipariş yok';
    byId('draft-message').textContent=state.items.length?'Bu ürünler henüz mutfağa ve kasaya gönderilmedi.':'Ürün eklediğinde gönder düğmesi açılır.';
    const submit=sendForm.querySelector('[type=submit]');submit.disabled=state.locked||!state.items.length;submit.textContent=state.pending?'İşlemi kontrol et':state.items.length?`Siparişi gönder · ${formatPrice(total.toString())}`:'Siparişi gönder';
    byId('draft-list').querySelectorAll('button').forEach(button=>{button.disabled=state.locked;button.addEventListener('click',()=>{if(state.locked)return;const index=Number(button.dataset.remove??button.dataset.plus??button.dataset.minus??button.dataset.edit),item=state.items[index];if(button.hasAttribute('data-remove'))state.items.splice(index,1);else if(button.hasAttribute('data-edit')){openPicker(item.optionId,index);return;}else{const next=quantity(item.quantity)+(button.hasAttribute('data-plus')?1000000n:-1000000n);if(next<=0n)state.items.splice(index,1);else item.quantity=decimal(next);}drawDraft();drawProducts();});});
  }
  function add(option,value='1',note='',editIndex=null){
    if(state.locked)return;const q=quantity(value);if(option.unitCode==='adet'&&q%1000000n)throw new Error('Adet ürün için tam sayı gir.');if(note.length>1000)throw new Error('Sipariş notu çok uzun.');
    if(editIndex!==null)state.items[editIndex]={optionId:option.optionId,quantity:decimal(q),note};
    else{const existing=!option.requiresWeight&&state.items.find(item=>item.optionId===option.optionId&&item.note===note);if(existing)existing.quantity=decimal(quantity(existing.quantity)+q);else state.items.push({optionId:option.optionId,quantity:decimal(q),note});}
    byId('order-error').textContent='';drawDraft();drawProducts();
  }
  function openServings(optionId){
    const option=optionById(optionId);if(!option||state.locked)return;
    state.picker={optionId,editIndex:null,mode:'servings'};
    byId('order-picker').innerHTML=`<section class="order-picker order-quick-picker" aria-labelledby="serving-title"><div class="order-line-top"><h3 id="serving-title">${html(option.name)}</h3><button class="text-button" type="button" id="close-picker">Kapat</button></div><p class="order-muted">Servise dokunarak taslağa ekle.</p><div class="order-variants">${optionsFor(option.productId).map(variant=>`<button type="button" data-variant="${html(variant.optionId)}"><strong>${html(variant.optionName)}</strong><span>${html(formatPrice(variant.unitPriceMinor))}${Number(variant.priceBasisQuantity)===1000?' / kg':''}</span><small>${variant.requiresWeight?'Miktar gir':'+1 '+html(variant.unitCode)}</small></button>`).join('')}</div><p id="serving-feedback" class="order-muted" role="status" aria-live="polite">Adet ve notu taslak satırından değiştirebilirsin.</p></section>`;
    byId('close-picker').addEventListener('click',()=>{state.picker=null;byId('order-picker').innerHTML='';byId('sale-products').querySelector(`[data-product="${option.productId}"]`)?.focus({preventScroll:true});});
    byId('order-picker').querySelectorAll('[data-variant]').forEach(button=>button.addEventListener('click',()=>{
      if(state.locked)return;const variant=optionById(button.dataset.variant);
      if(variant.requiresWeight){openPicker(variant.optionId);return;}
      add(variant);
      const total=state.items.filter(item=>item.optionId===variant.optionId).reduce((sum,item)=>sum+quantity(item.quantity),0n);
      byId('serving-feedback').textContent=`${variant.optionName} eklendi · Taslakta ${shortQty(decimal(total))} ${variant.unitCode}. Henüz gönderilmedi.`;
    }));
  }
  function openPicker(optionId,editIndex=null,values=null){
    const option=optionById(optionId);if(!option)return;const saved=values||(editIndex!==null?state.items[editIndex]:state.inputs[option.productId]||{quantity:option.requiresWeight?'':'1',note:''});state.picker={optionId,editIndex,values:saved};
    byId('order-picker').innerHTML=`<section class="order-picker"><div class="order-line-top"><h3>${html(option.name)}</h3><button class="text-button" type="button" id="close-picker">Kapat</button></div><div class="order-variants">${optionsFor(option.productId).map(variant=>`<button type="button" data-variant="${html(variant.optionId)}" aria-pressed="${variant.optionId===optionId}"><strong>${html(variant.optionName)}</strong><span>${html(formatPrice(variant.unitPriceMinor))}${Number(variant.priceBasisQuantity)===1000?' / kg':''}</span></button>`).join('')}</div><form id="order-picker-form">${input('quantity',option.requiresWeight?'Tartılan miktar ('+option.unitCode+')':`Miktar (${option.unitCode})`,saved.quantity,'required inputmode="decimal"')}${input('note','Sipariş notu',saved.note,'maxlength="1000" placeholder="Örn. soğansız, az pişmiş"')}<p id="picker-price" class="order-muted"></p><p class="error" role="alert"></p><button type="submit" class="primary">${editIndex!==null?'Satırı güncelle':'Adisyona ekle'}</button></form></section>`;
    const form=byId('order-picker-form');const saveInput=()=>{const values={quantity:form.elements.namedItem('quantity').value,note:form.elements.namedItem('note').value};state.inputs[option.productId]=values;state.picker.values=values;};
    const preview=()=>{saveInput();try{byId('picker-price').textContent='Satır tutarı: '+formatPrice(amount(option,form.elements.namedItem('quantity').value).toString());}catch{byId('picker-price').textContent='Miktarı gir.';}};
    form.addEventListener('input',preview);preview();
    byId('close-picker').addEventListener('click',()=>{saveInput();state.picker=null;byId('order-picker').innerHTML='';});
    byId('order-picker').querySelectorAll('[data-variant]').forEach(button=>button.addEventListener('click',()=>{
      if(state.locked)return;saveInput();const variant=optionById(button.dataset.variant);
      if(editIndex===null&&!variant.requiresWeight){add(variant,'1',form.elements.namedItem('note').value);state.picker=null;byId('order-picker').innerHTML='';}
      else openPicker(variant.optionId,editIndex,state.picker.values);
    }));
    form.addEventListener('submit',event=>{event.preventDefault();try{add(option,form.elements.namedItem('quantity').value,form.elements.namedItem('note').value,editIndex);state.picker=null;byId('order-picker').innerHTML='';}catch(error){form.querySelector('.error').textContent=message(error);}});
    form.elements.namedItem('quantity').focus();
  }
  const favoriteCommands=new Map();
  function filtered(){return menu.options.filter(option=>(!state.favorites||option.favorite)&&(!state.category||(option.categoryName||'Diğer')===state.category)&&normalize(`${option.name} ${option.code} ${(option.barcodes||[]).join(' ')}`).includes(normalize(state.search.trim())));}
  function drawProducts(){
    const filteredOptions=filtered(),products=[...new Map(filteredOptions.map(option=>[option.productId,option])).values()];
    byId('order-results').textContent=`${products.length} ürün${state.favorites?' · Ortak favoriler':''}${state.category?' · '+state.category:''}`;
    byId('order-all').setAttribute('aria-pressed',String(!state.favorites));byId('order-favorites').setAttribute('aria-pressed',String(state.favorites));
    byId('sale-products').innerHTML=products.map(product=>{const options=optionsFor(product.productId),min=options.reduce((lowest,option)=>BigInt(option.unitPriceMinor)<lowest?BigInt(option.unitPriceMinor):lowest,BigInt(options[0].unitPriceMinor)),count=state.items.filter(item=>options.some(option=>option.optionId===item.optionId)).length;return `<article class="order-product-card"><button type="button" class="order-product" data-product="${html(product.productId)}"><strong>${html(product.name)}</strong><span>${html(product.categoryName||'Diğer')}${product.productType==='prepared'?' · Sipariş üzerine':''}</span><b>${html(formatPrice(min.toString()))}${product.requiresWeight?' / kg':options.length>1?'’den':''}</b><small>${count?'Taslakta · '+count+' satır':options.some(option=>option.requiresWeight)?'Tartılan gramı gir':options.length>1?'Servis seç':'Bir dokunuş = +1 '+html(product.unitCode)}</small></button><button type="button" class="order-star" data-star="${html(product.productId)}" aria-pressed="${product.favorite}" aria-label="${html(product.name)} favorisi">${product.favorite?'★':'☆'}</button></article>`;}).join('')||'<div class="order-empty">Bu filtrelere uygun ürün yok. <button type="button" class="text-button" id="reset-products">Tüm ürünleri göster</button></div>';
    byId('reset-products')?.addEventListener('click',()=>{state.search='';state.category='';state.favorites=false;byId('order-search').value='';container.querySelector('[name=category]').value='';drawProducts();});
    byId('sale-products').querySelectorAll('[data-product]').forEach(button=>{button.disabled=state.locked;button.addEventListener('click',()=>{const options=optionsFor(button.dataset.product);if(options.length>1)openServings(options[0].optionId);else if(options[0].requiresWeight)openPicker(options[0].optionId);else add(options[0]);});});
    byId('sale-products').querySelectorAll('[data-star]').forEach(button=>{button.disabled=state.locked;button.addEventListener('click',async()=>{const id=button.dataset.star,options=optionsFor(id);let command=favoriteCommands.get(id);if(!command){command={requestKey:crypto.randomUUID(),favorite:!options[0].favorite};favoriteCommands.set(id,command);}button.disabled=true;try{const result=await request('/api/sales/favorites/'+id,{method:'POST',body:JSON.stringify(command)});options.forEach(option=>option.favorite=result.favorite);favoriteCommands.delete(id);drawProducts();}catch(error){byId('order-error').textContent=message(error);if(error.status&&error.code!=='COMMIT_UNKNOWN')favoriteCommands.delete(id);button.disabled=false;}});});
  }
  byId('order-search').addEventListener('input',event=>{state.search=event.target.value;drawProducts();});
  byId('order-clear').addEventListener('click',()=>{state.search='';byId('order-search').value='';drawProducts();byId('order-search').focus();});
  container.querySelector('[name=category]').addEventListener('change',event=>{state.category=event.target.value;drawProducts();});
  byId('order-all').addEventListener('click',()=>{state.favorites=false;drawProducts();});byId('order-favorites').addEventListener('click',()=>{state.favorites=true;drawProducts();});
  byId('order-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const matches=filtered();if(matches.length===1){if(matches[0].requiresWeight)openPicker(matches[0].optionId);else add(matches[0]);}}});
  const orderPath=context.tableDraft?`/api/sales/tables/${context.tableDraft.id}/orders`:`/api/sales/groups/${group.id}/orders`;
  commandForm(sendForm,{message,path:orderPath,request:async(path,options)=>{try{return await request(path,options);}catch(error){if(error.status&&error.code!=='COMMIT_UNKNOWN'){state.pending=null;setLocked(false);}throw error;}},values:()=>{
    if(state.pending)return state.pending;if(!state.items.length)throw new Error('Önce ürün ekle.');
    state.pending={requestKey:crypto.randomUUID(),...(context.tableDraft?{}:{revision:group.revision}),warehouseId:state.warehouseId||undefined,items:state.items.map(item=>({...item}))};setLocked(true);return state.pending;
  },success:async result=>{if(context.tableDraft){await context.openGroup(result.group.id);drafts.delete(key);}else{drafts.delete(key);await onRefresh();}}});
  if(context.tableDraft)byId('order-tools').closest('details').hidden=true;
  else{
  byId('order-tools').innerHTML=`<div id="order-bill">${formShell('<p>Kasaya hesap istendi bilgisini ilet.</p>')}</div><button type="button" class="text-button" id="order-more-tools">Taşıma / birleştirme</button><div id="order-transfer"></div>`;
  const bind=(node,path,values,success=onRefresh)=>commandForm(node.querySelector('form'),{request,message,path,values,success});
  byId('order-bill').querySelector('button').textContent='Hesabı iste';bind(byId('order-bill'),`/api/sales/groups/${group.id}/request-bill`,()=>({revision:group.revision}));
  byId('order-more-tools').addEventListener('click',async()=>{try{await renderAccountTools(byId('order-transfer'),{...context,can,refresh:onRefresh,includeBill:false,beforeMutation:()=>{if(state.items.length)throw new Error('Hesabı taşımadan önce yeni ürünleri gönder veya kaldır.');}});}catch(error){byId('order-error').textContent=message(error);}});
  container.querySelectorAll('[data-cancel-request]').forEach(button=>button.addEventListener('click',()=>{const lineId=button.dataset.cancelRequest;const node=byId('order-cancel');node.innerHTML=formShell(input('reason','İptal gerekçesi','','required maxlength="500"')+select('disposition','Hazırlık durumu',[{id:'unprepared',name:'Henüz hazırlanmadı'},{id:'waste',name:'Hazırlandı; fire olarak kaydet'}]));node.querySelector('button').textContent=can('settings.manage')?'İptali kaydet':'Sorumlu onayına gönder';bind(node,can('settings.manage')?`/api/sales/groups/${group.id}/lines/${lineId}/cancel`:'/api/approvals',form=>can('settings.manage')?{revision:group.revision,reason:form.get('reason'),disposition:form.get('disposition')}:{action:'sales.cancel',reason:form.get('reason'),payload:{id:group.id,lineId,command:{revision:group.revision,reason:form.get('reason'),disposition:form.get('disposition')}}},can('settings.manage')?onRefresh:()=>{node.innerHTML='<p class="order-muted">İptal talebi sorumlu onayına gönderildi.</p>';});}));
  }
  drawProducts();drawDraft();if(state.picker){if(state.picker.mode==='servings')openServings(state.picker.optionId);else openPicker(state.picker.optionId,state.picker.editIndex,state.picker.values);}if(state.locked){setLocked(true);sendForm.querySelector('[type=submit]').disabled=false;sendForm.querySelector('[type=submit]').textContent='İşlemi kontrol et';}
}
