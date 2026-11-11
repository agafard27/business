import {html,formatPrice} from './business-ui.js';
import {mountDiningEditor} from './dining-editor.js';
const renders=new WeakMap();
const collator=new Intl.Collator('tr',{numeric:true,sensitivity:'base'});
export async function renderDining(container,context,view={}){
  const {request,message,user,isCurrent,openGroup,openTable}=context,render=Symbol();
  renders.set(container,render);
  const data=await request('/api/dining');if(!isCurrent()||renders.get(container)!==render)return;
  const current=()=>isCurrent()&&renders.get(container)===render;
  const manage=user.permissions.includes('settings.manage');
  let managing=manage&&Boolean(view.managing||['inactive','all'].includes(view.status));
  const managementMarkup=manage?`<div class="editor-buttons dining-actions"><button class="primary" id="add-table">+ Masa ekle</button><button class="secondary" id="dining-manage" aria-pressed="${managing}">${managing?'Düzenlemeyi bitir':'Masaları düzenle'}</button></div><section id="dining-editor" class="panel dining-editor" hidden aria-labelledby="dining-editor-title"></section><section class="dining-management-tools" id="dining-management-tools" ${managing?'':'hidden'}><p>Masanın adına dokunarak adını veya bölümünü değiştir. Boş masayı Kaldır ile listeden çıkar; geçmiş hesapları korunur.</p><div class="editor-buttons"><button class="secondary" id="add-tables">Toplu masa ekle</button><button class="secondary" id="add-section">Bölüm ekle</button><button class="secondary" id="show-removed">Kaldırılan masalar</button></div><details class="dining-sections"><summary>Bölümleri düzenle</summary><div id="section-editor-list" class="editor-buttons"></div></details></section>`:'';
  container.innerHTML=`<div class="catalog-heading"><div><h2>Masalar</h2><p>Bir masa seçerek hesabını aç. Dolu masalar mevcut hesaba gider.</p></div><button id="dining-refresh" class="secondary">Yenile</button></div>${managementMarkup}<div class="catalog-filters dining-filters"><label>Masa ara<input id="table-search" type="search" placeholder="Masa adı" autocomplete="off"></label><label>Bölüm<select id="section-filter"><option value="">Bütün bölümler</option>${data.sections.map(section=>`<option value="${html(section.id)}">${html(section.name)}</option>`).join('')}</select></label><label>Göster<select id="table-status"><option value="active">Kullanımdaki masalar</option><option value="empty">Boş masalar</option><option value="occupied">Dolu masalar</option>${manage?'<option value="inactive">Kaldırılan masalar</option><option value="all">Bütün masalar</option>':''}</select></label></div><p class="dining-summary" id="dining-summary"></p><div id="dining-message" class="dining-message" role="status"></div><div class="table-grid dining-grid" id="table-grid"></div>`;
  const byId=id=>container.querySelector('#'+id);
  byId('table-search').value=view.search||'';
  if(data.sections.some(row=>row.id===view.sectionId))byId('section-filter').value=view.sectionId;
  if([...byId('table-status').options].some(row=>row.value===view.status))byId('table-status').value=view.status;
  byId('dining-message').textContent=view.notice||'';
  let locked=false,origin=null;
  function setLocked(value){
    locked=value;
    container.querySelectorAll('button').forEach(button=>{if(!button.closest('#dining-editor form'))button.disabled=value||button.hasAttribute('data-unavailable');});
  }
  const currentView=()=>({search:byId('table-search').value,sectionId:byId('section-filter').value,status:byId('table-status').value,managing});
  async function refresh(changes={}){
    if(!current())return;
    const grid=byId('table-grid');
    try{await renderDining(container,context,{...currentView(),...changes});}
    catch(error){if(isCurrent()&&grid.isConnected)renders.set(container,render);throw error;}
  }
  byId('dining-refresh').addEventListener('click',async()=>{
    if(locked)return;setLocked(true);
    try{await refresh();}
    catch(error){if(isCurrent()){renders.set(container,render);setLocked(false);byId('dining-message').textContent=message(error);}}
  });
  const editor=manage?mountDiningEditor({node:byId('dining-editor'),data,context:{...context,isCurrent:current,focusOrigin:()=>origin?.isConnected&&origin.focus()},getSection:()=>byId('section-filter').value,refresh,setLocked}):null;
  const sections=new Map(data.sections.map((section,index)=>[section.id,{...section,index}]));
  const sorted=[...data.tables].sort((a,b)=>(sections.get(a.sectionId)?.index??0)-(sections.get(b.sectionId)?.index??0)||collator.compare(a.name,b.name)||collator.compare(a.id,b.id));
  function edit(button,action){button.addEventListener('click',()=>{if(!locked){origin=button;action();}});}
  function tableCard(table){
    const editing=manage&&managing,entry=table.isActive||editing;
    return `<article class="panel table-card ${!table.isActive?'dining-inactive':''}" data-table="${html(table.id)}" tabindex="-1"><h3 id="dining-table-name-${html(table.id)}">${html(table.name)}</h3><p>${html(sections.get(table.sectionId)?.name)}</p><span class="pill ${table.groupId?'table-occupied':''}">${!table.isActive?'Kullanımdan kaldırıldı':table.state==='waiting'?'Dolu · Hesap bekliyor':table.groupId?'Dolu':'Boş'}</span>${table.groupId?`<p>Kalan: <strong>${html(formatPrice(table.remainingMinor))}</strong></p>`:''}${entry?`<button type="button" class="dining-table-entry" ${editing?'data-edit-table':'data-open-table'}="${html(table.id)}" aria-labelledby="dining-table-name-${html(table.id)} dining-table-action-${html(table.id)}"><span id="dining-table-action-${html(table.id)}" data-account-open-label>${editing?'Adını / bölümünü düzenle':table.groupId?'Hesap için dokun':'Sipariş için dokun'}</span><span aria-hidden="true">${editing?'✎':'↗'}</span></button>`:''}${editing?`<div class="editor-buttons dining-table-management"><button class="${table.isActive?'text-button dining-remove':'secondary'}" data-toggle-table="${html(table.id)}" ${table.groupId?'disabled data-unavailable title="Dolu masa kaldırılamaz; önce hesabı kapat veya taşı"':''}>${table.isActive?'Kaldır':'Geri getir'}</button>${table.groupId?'<span class="field-help">Dolu masa kaldırılamaz.</span>':''}</div>`:''}</article>`;
  }
  function setManaging(value){
    if(!manage||locked)return;managing=value;
    byId('dining-manage').setAttribute('aria-pressed',String(managing));byId('dining-manage').textContent=managing?'Düzenlemeyi bitir':'Masaları düzenle';byId('dining-management-tools').hidden=!managing;
    if(!managing){byId('dining-editor').hidden=true;byId('dining-editor').innerHTML='';if(['inactive','all'].includes(byId('table-status').value))byId('table-status').value='active';}
    list();
  }
  function list(){
    const search=byId('table-search').value.trim().toLocaleLowerCase('tr-TR'),sectionId=byId('section-filter').value,status=byId('table-status').value;
    const inSection=sorted.filter(table=>(manage||table.isActive)&&(!sectionId||table.sectionId===sectionId));
    const active=inSection.filter(table=>table.isActive),occupied=active.filter(table=>table.groupId).length;
    const filtered=inSection.filter(table=>table.name.toLocaleLowerCase('tr-TR').includes(search)&&(status==='all'||status==='inactive'&&!table.isActive||status==='active'&&table.isActive||status==='empty'&&table.isActive&&!table.groupId||status==='occupied'&&table.isActive&&table.groupId));
    byId('dining-summary').innerHTML=`<span>${active.length} kullanımda</span><span>${active.length-occupied} boş</span><span>${occupied} dolu</span>${manage?`<span>${inSection.length-active.length} kaldırılmış</span>`:''}<span>${filtered.length} gösteriliyor</span>`;
    byId('table-grid').innerHTML=filtered.map(tableCard).join('')||`<div class="panel dining-empty">${!data.sections.length?'Önce bir bölüm oluştur, ardından masalarını ekle.':!data.tables.length?'Henüz masa yok. Masa ekle veya Toplu masa ekle ile başlayabilirsin.':'Bu filtreye uygun masa yok. Aramayı, bölümü veya Göster seçimini değiştir.'}</div>`;
    byId('table-grid').querySelectorAll('[data-edit-table]').forEach(button=>edit(button,()=>editor.editTable(data.tables.find(table=>table.id===button.dataset.editTable))));
    byId('table-grid').querySelectorAll('[data-toggle-table]').forEach(button=>edit(button,()=>editor.toggleTable(data.tables.find(table=>table.id===button.dataset.toggleTable))));
    byId('table-grid').querySelectorAll('[data-open-table]').forEach(button=>{
      const table=data.tables.find(item=>item.id===button.dataset.openTable);
      let opening=false;button.addEventListener('click',()=>{
        if(locked||opening)return;
        if(!table.groupId&&!user.permissions.includes('orders.write')&&!user.permissionRules?.some(rule=>rule.code==='orders.write'&&!rule.requiresApproval)){byId('dining-message').textContent='Sipariş yetkisi gerekli.';return;}
        opening=true;button.disabled=true;
        void Promise.resolve().then(()=>table.groupId?openGroup(table.groupId):openTable({id:table.id,name:table.name})).catch(error=>{if(current())byId('dining-message').textContent=message(error);}).finally(()=>{opening=false;if(button.isConnected)button.disabled=locked;});
      });
    });
    if(locked)setLocked(true);
  }
  if(manage){
    byId('dining-manage').addEventListener('click',()=>setManaging(!managing));
    byId('show-removed').addEventListener('click',()=>{if(!locked){byId('table-status').value='inactive';list();}});
    edit(byId('add-tables'),()=>editor.addTables());edit(byId('add-section'),()=>editor.editSection());edit(byId('add-table'),()=>editor.editTable());
    byId('section-editor-list').innerHTML=data.sections.map(section=>`<button class="secondary" data-section="${html(section.id)}">${html(section.name)} · Düzenle</button>`).join('')||'<p>Henüz bölüm yok. Bölüm ekle ile başlayabilirsin.</p>';
    byId('section-editor-list').querySelectorAll('[data-section]').forEach(button=>edit(button,()=>editor.editSection(data.sections.find(section=>section.id===button.dataset.section))));
  }
  byId('table-search').addEventListener('input',list);byId('section-filter').addEventListener('change',list);byId('table-status').addEventListener('change',()=>{if(manage&&['inactive','all'].includes(byId('table-status').value))setManaging(true);else list();});list();
  if(view.focusTable)byId('table-grid').querySelector('[data-table="'+view.focusTable+'"]')?.focus({preventScroll:true});
}
