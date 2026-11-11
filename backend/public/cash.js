import {fieldHelp} from './data-entry.js';
import {html,input,select,formShell,commandForm,formatPrice,parsePrice} from './business-ui.js';
const signed=value=>BigInt(value)<0n?`−${formatPrice((-BigInt(value)).toString())}`:formatPrice(value);
const when=value=>value?new Date(value).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):'—';
const kinds={sale_receipt:'Satış tahsilatı',receivable_receipt:'Cari tahsilat',supplier_payment:'Tedarikçi ödemesi',expense_payment:'Gider ödemesi',sale_refund:'Satış iadesi',manual_in:'Para girişi',manual_out:'Para çıkışı',transfer_in:'Nakit teslim alındı',transfer_out:'Nakit teslim edildi',reversal:'Ters kayıt'};
const actionForm=(fields,label)=>formShell(fields).replace('>Kaydet</button>',`>${label}</button>`);

export async function renderCash(container,context){
  const {request,message,user,isCurrent}=context;
  const data=await request('/api/finance/cash');if(!isCurrent())return;
  const refresh=()=>renderCash(container,context);
  const open=data.shifts.filter(row=>row.status==='open'),closed=data.shifts.filter(row=>row.status==='closed');
  const free=data.registers.filter(row=>row.isActive&&!open.some(item=>item.registerId===row.id));
  container.innerHTML=`<div class="cash-workspace"><h2>Kasa ve devir</h2><p>Kasa, teslim edip kapatana kadar açık kalır. Gün değişmesi veya uygulamanın kapanması kasa hesabını kapatmaz.</p>
    <div class="business-split"><section class="panel"><h3>Açık kasalar</h3>${open.map(row=>`<article data-cash-session="${html(row.id)}"><h4>${html(row.name)} · Kayıt #${html(row.id)}</h4>
      <p>Sorumlu: <strong>${html(row.responsibleName)}</strong><br>Açan: ${html(row.openedByName)} · ${html(when(row.openedAtUtc))}</p>
      <p>Beklenen nakit: <strong>${html(signed(row.expectedMinor))}</strong> · Kayıtlı POS: ${html(signed(row.expectedPosMinor))}</p>
      <details><summary>Kasayı teslim et ve kapat</summary><p>Önce personeldeki nakdi kasaya teslim alın. Saydığınız nakdin tamamını aşağıdaki kişiye teslim ettiğinizde bu kasa kaydı kapanır. Sonraki kullanım ayrı açılış tutarıyla başlar.</p>
      ${actionForm(select('toUserId','Parayı teslim ettiğiniz kişi',[{id:'',name:'Kişi seçin'},...data.users.filter(item=>item.id!==row.responsibleId)])+input('counted','Teslim edilen / sayılan nakit','','required inputmode="decimal"')+input('pos','Kontrol edilen POS toplamı','','required inputmode="decimal"')+input('reason','Teslim açıklaması','','required maxlength="1000"'),'Teslim et ve kapat')}<p>Bu işlem, kaydı yapan kişinin teslim beyanını kaydeder.</p></details></article>`).join('')||'<p>Açık kasa yok. Kullanıma başlarken kasadaki gerçek başlangıç parasını girin.</p>'}</section>
    <section class="panel"><h3>Kasayı kullanmaya başla</h3>${free.length?`<div id="cash-open">${actionForm(select('registerId','Kasa',free)+input('opening','Kasadaki başlangıç nakdi','','required inputmode="decimal"'),'Kasayı aç')}</div>`:'<p>Kullanılabilir yeni kasa yok. Açık kasayı soldan kullanabilirsiniz.</p>'}
    ${user.permissions.includes('settings.manage')?`<details><summary>Kasa tanımla</summary><div id="register-create">${formShell(input('code','Kasa kodu','','required maxlength="40"')+input('name','Kasa adı','','required maxlength="150"'))}</div></details>`:''}
    ${open.length?`<details><summary>Diğer nakit girişi / çıkışı</summary><p>Satış tahsilatını adisyondan, veresiye tahsilatını müşteri kartından, gider ve tedarikçi ödemesini ilgili kayıttan girin. Buraya tekrar yazmak kasayı iki kez etkiler. Diğer nakit hareketi tek başına satış veya faaliyet gideri oluşturmaz.</p><div id="cash-movement">${formShell(select('shiftId','Açık kasa',open)+select('kind','Hareket',[{id:'manual_in',name:'Para girişi'},{id:'manual_out',name:'Para çıkışı'}])+input('amount','Tutar','','required inputmode="decimal"')+input('reason','Gerekçe','','required maxlength="1000"'))}</div></details>`:''}</section></div>
    ${open.length?`<section class="panel" id="cash-transfer"><details><summary>Personeldeki nakdi teslim al / personele nakit ver</summary><p>Bu işlem kasayı kapatmaz. Aynı paranın kimde olduğunu kaydeder; yeni satış veya tahsilat oluşturmaz.</p>${formShell(select('shiftId','Açık kasa',open)+select('fromUserId','Teslim eden',data.users)+select('toUserId','Teslim alan',data.users)+input('amount','Teslim tutarı','','required inputmode="decimal"')+input('reason','Teslim açıklaması','','required maxlength="1000"'))}</details></section>`:''}
    <section class="panel"><h3>Kasa devir geçmişi</h3><p>Önceki kayıtlar silinmez veya sıfırlanmaz. Sonraki kasa açılışı yeni kayıt numarası alır. Son 100 kasa kaydı gösterilir.</p>
    ${closed.map(row=>`<details data-cash-history="${html(row.id)}"><summary>${html(row.name)} · #${html(row.id)} · ${html(when(row.closedAtUtc))} · ${html(row.responsibleName)} → ${html(row.recipientName||'Eski kayıt: teslim alan belirtilmemiş')}</summary>
      <p>Kaydı açan: ${html(row.openedByName)} · ${html(when(row.openedAtUtc))}<br>Teslim / kapanış işlemini yapan: ${html(row.closedByName)}<br>Teslim kaydı: ${html(row.handoverOperationId||'Eski kapanış')}</p>
      <p>Beklenen nakit: ${html(signed(row.expectedMinor))} · Teslim edilen / sayılan: ${html(signed(row.countedMinor))} · Fark: <strong>${html(signed(row.differenceMinor))}</strong><br>Kayıtlı POS: ${html(signed(row.expectedPosMinor))} · Kontrol edilen POS: ${html(signed(row.countedPosMinor??'0'))} · POS farkı: ${html(signed((BigInt(row.countedPosMinor??'0')-BigInt(row.expectedPosMinor)).toString()))}</p><p>${html(row.reason)}</p></details>`).join('')||'<p>Henüz teslim edilmiş kasa yok.</p>'}</section>
    <section class="panel"><h3>Son 200 nakit hareketi</h3><div class="business-table-wrap"><table class="business-table"><thead><tr><th>Zaman / kasa kaydı</th><th>İşlem</th><th>Tutar</th><th>İşlemi yapan / para kimde</th><th>Açıklama</th></tr></thead><tbody>${data.movements.map(row=>`<tr><td>${html(when(row.createdAtUtc))}<br>#${html(row.shiftId)}</td><td>${html(kinds[row.kind]||row.kind)}</td><td>${html(signed(row.amountMinor))}</td><td>${html(row.actorName)}<br>${html(row.custodyName||'—')}</td><td>${html(row.reason)}</td></tr>`).join('')}</tbody></table></div></section></div>`;
  fieldHelp(container.querySelector('#cash-open [name=opening]'),'Kasayı açarken fiziksel olarak bulunan para, TL. Önceki günün satışını veya eski kasa toplamını buraya tekrar eklemeyin.');
  for(const article of container.querySelectorAll('[data-cash-session]')){fieldHelp(article.querySelector('[name=counted]'),'Kasada sayıp teslim ettiğiniz gerçek nakit, TL. Ekrandaki beklenen tutarı saymadan kopyalamayın; fark ayrıca kaydedilir.');fieldHelp(article.querySelector('[name=pos]'),'Bu açık kasa kaydına ait gerçek POS toplamı, TL. Kasaya konan nakde dahil edilmez.');}
  const bind=(selector,path,values)=>{const form=container.querySelector(`${selector} form`);if(form)commandForm(form,{request,message,path,values,success:refresh});};
  bind('#cash-open','/api/finance/shifts',form=>({registerId:form.get('registerId'),openingMinor:parsePrice(form.get('opening'))}));
  bind('#register-create','/api/finance/registers',form=>({code:form.get('code'),name:form.get('name')}));
  bind('#cash-movement','/api/finance/cash-movements',form=>({shiftId:form.get('shiftId'),kind:form.get('kind'),amountMinor:parsePrice(form.get('amount')),reason:form.get('reason')}));
  bind('#cash-transfer','/api/finance/transfers',form=>({shiftId:form.get('shiftId'),fromUserId:form.get('fromUserId'),toUserId:form.get('toUserId'),amountMinor:parsePrice(form.get('amount')),reason:form.get('reason')}));
  for(const row of open)bind(`[data-cash-session="${row.id}"]`,`/api/finance/cash-sessions/${row.id}/handover`,form=>{
    if(!form.get('toUserId'))throw new Error('Parayı teslim ettiğiniz kişiyi seçin.');
    return {revision:row.revision,toUserId:form.get('toUserId'),countedMinor:parsePrice(form.get('counted')),countedPosMinor:parsePrice(form.get('pos')),reason:form.get('reason')};
  });
}
