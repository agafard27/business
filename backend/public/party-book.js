import {fieldHelp} from './data-entry.js';
import {html,input,formShell,commandForm,formatPrice,parsePrice} from './business-ui.js';
import {renderPartyDetail} from './party-detail.js';
export const renderCustomers=(container,context)=>renderPartyBook(container,context,'customer');
export const renderSuppliers=(container,context)=>renderPartyBook(container,context,'supplier');
export async function renderPartyBook(container,context,mode,selectedId=null){
  const {request,message,isCurrent}=context,{parties}=await request('/api/finance/parties');if(!isCurrent())return;
  const customer=mode==='customer',title=customer?'Veresiye defteri':'Tedarikçiler',noun=customer?'Müşteri':'Tedarikçi';
  const field=customer?'receivableMinor':'payableMinor',all=parties.filter(row=>customer?row.isCustomer:row.isSupplier);
  const total=all.filter(row=>row.isActive&&BigInt(row[field])>0n).reduce((sum,row)=>sum+BigInt(row[field]),0n);
  const refresh=id=>renderPartyBook(container,context,mode,id??selectedId);
  container.innerHTML=`<div class="party-workspace"><div class="catalog-heading"><div><h2>${title}</h2><p>${customer?'Müşteriye satış yaz, borcunu gör, sonra tahsil et.':'Kimden mal aldık, ne kadar borcumuz kaldı, ne ödedik?'}</p></div><button type="button" class="primary" id="party-add">+ ${noun} ekle</button></div>
    <div class="party-summary"><div><span>${customer?'Müşterilerden alınacak':'Tedarikçilere ödenecek'}</span><strong>${html(formatPrice(total.toString()))}</strong></div><div><span>${customer?'Borcu olan müşteri':'Borçlu olduğumuz firma'}</span><strong>${all.filter(row=>row.isActive&&BigInt(row[field])>0n).length}</strong></div></div>
    <section id="party-create" class="panel" hidden></section><div class="party-layout"><section class="panel party-directory"><label>${noun} ara<input id="party-search" type="search" placeholder="Ad, telefon veya kod"></label><label>Göster<select id="party-filter"><option value="active">Etkin hesaplar</option><option value="balance">Bakiyesi olanlar</option><option value="all">Bütün hesaplar</option></select></label><div id="party-list"></div></section><section class="panel party-detail" id="party-detail"><p>Hesabını görmek için ${customer?'müşteri':'tedarikçi'} seç.</p></section></div></div>`;
  const byId=id=>container.querySelector('#'+id);let selected=selectedId,selection=0;
  async function choose(id){
    selected=id;selectedId=id;list();const token=++selection,node=byId('party-detail');node.innerHTML='<p role="status">Hesap getiriliyor…</p>';
    try{await renderPartyDetail(node,{...context,isCurrent:()=>isCurrent()&&selection===token},all.find(row=>row.id===id),mode,()=>refresh(id));}
    catch(error){if(isCurrent()&&selection===token)node.textContent=message(error);}
  }
  function list(){
    const search=byId('party-search').value.trim().toLocaleLowerCase('tr-TR'),filter=byId('party-filter').value;
    const rows=all.filter(row=>(filter==='all'||row.isActive)&&(filter!=='balance'||BigInt(row[field])!==0n)&&`${row.name} ${row.phone||''} ${row.code}`.toLocaleLowerCase('tr-TR').includes(search));
    byId('party-list').innerHTML=rows.map(row=>`<button type="button" class="party-person ${row.id===selected?'selected':''}" data-party="${html(row.id)}" aria-pressed="${row.id===selected}"><span><strong>${html(row.name)}</strong><small>${html(row.phone||row.code)}${row.isActive?'':' · Pasif'}</small></span><span><strong>${html(formatPrice((BigInt(row[field])<0n?-BigInt(row[field]):BigInt(row[field])).toString()))}</strong><small>${BigInt(row[field])<0n?(customer?'Müşterinin alacağı':'Bizim alacağımız'):BigInt(row[field])===0n?(customer?'Borcu yok':'Borcumuz yok'):customer?'Bize borcu':'Ödenecek'}</small></span></button>`).join('')||`<p class="party-empty">${noun} bulunamadı.</p>`;
    byId('party-list').querySelectorAll('[data-party]').forEach(button=>button.addEventListener('click',()=>void choose(button.dataset.party)));
  }
  byId('party-search').addEventListener('input',list);byId('party-filter').addEventListener('change',list);
  byId('party-add').addEventListener('click',()=>{
    const node=byId('party-create');if(!node.hidden){node.hidden=true;return;}node.hidden=false;
    const code=`${customer?'M':'T'}-${crypto.randomUUID().slice(0,8)}`;
    node.innerHTML=`<h3>${noun} ekle</h3>${formShell(input('name',`${noun} adı`,'','required maxlength="180"')+(customer?input('limit','Veresiye limiti (isteğe bağlı)','','inputmode="decimal"'):'')+`<details><summary>Hesap kodunu değiştir</summary>${input('code','Hesap kodu',code,'required maxlength="80"')}</details>`).replace('>Kaydet</button>',`>${noun} ekle</button>`)}<button type="button" class="text-button" id="cancel-party-create">Vazgeç</button>`;
    node.querySelector('#cancel-party-create').addEventListener('click',()=>node.hidden=true);
    fieldHelp(node.querySelector('[name=name]'),`${noun} adı veya ayırt edici unvanı. Aynı kişi/firma var mı diye önce listede arayın; her satışta yeni kart açmayın.`);
    fieldHelp(node.querySelector('[name=limit]'),'İzin verilen toplam açık veresiye borcu, TL. Borç bakiyesi değildir; boş bırakılırsa limitsizdir.');
    commandForm(node.querySelector('form'),{request,message,path:'/api/finance/parties',values:form=>({code:form.get('code'),name:form.get('name'),isCustomer:customer,isSupplier:!customer,creditLimitMinor:customer&&form.get('limit')?parsePrice(form.get('limit')):null}),success:result=>refresh(result.id)});
    node.querySelector('[name=name]').focus();
  });
  list();if(selected&&all.some(row=>row.id===selected))await choose(selected);
}
