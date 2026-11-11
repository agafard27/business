import {html,input,formShell,commandForm,formatPrice} from './business-ui.js';
export async function renderAccountTools(container,context){
  const {request,message,group,isCurrent,can,refresh,openGroup,includeBill=true,beforeMutation=()=>{}}=context;
  const byId=id=>container.querySelector('#'+id);
  const bind=(element,path,values,success=refresh)=>commandForm(element.querySelector('form'),{request:async(...args)=>{try{return await request(...args);}catch(error){if(error.status&&error.code!=='COMMIT_UNKNOWN'){byId('choose-move').disabled=false;const button=byId('choose-merge');if(button)button.disabled=false;}throw error;}},message,path,values:form=>{beforeMutation();return values(form);},success});
  const dining=await request('/api/dining');if(!isCurrent())return;
  container.innerHTML=`<h3>Hesap işlemleri</h3><div class="editor-buttons"><button type="button" class="secondary" id="choose-move">Masa taşı</button>${can('orders.write')?'<button type="button" class="secondary" id="choose-merge">Masa birleştir</button>':''}</div><div id="table-action"></div>${can('orders.write')&&includeBill?`<div id="request-bill">${formShell('<p>Kasaya hesap istendi bilgisini ilet.</p>')}</div>`:''}${group.remainingMinor==='0'?`<div id="close-empty">${formShell('<p>Bakiyesi sıfır olan hesabı kapat.</p>')}</div>`:''}`;
  function choose(mode){
    const merge=mode==='merge',area=byId('table-action');
    area.innerHTML=`<h4>${merge?'Masa birleştir':'Masa taşı'}</h4><p>${merge?'Bu hesabı seçtiğin dolu masanın hesabına ekler. Sipariş ve ödeme geçmişi korunur.':'Hesabı boş bir masaya taşır. Dolu masalar seçilemez.'}</p><div class="table-grid table-picker" role="group" aria-label="Hedef masa">${dining.tables.filter(table=>table.isActive).map(table=>{
      const unavailable=table.groupId===group.id||(merge?!table.groupId:!!table.groupId);
      return `<button type="button" class="secondary table-choice" data-target="${html(table.id)}" ${unavailable?'disabled data-unavailable':''} aria-pressed="false"><strong>${html(table.name)}</strong><span>${html(dining.sections.find(section=>section.id===table.sectionId)?.name||'')}</span><span class="pill ${table.groupId?'table-occupied':''}">${table.groupId===group.id?'Bu hesap':table.groupId?'Dolu':'Boş'}</span>${table.groupId?`<span>${html(formatPrice(table.remainingMinor))}</span>`:''}</button>`;
    }).join('')}</div><div id="table-action-form">${formShell('<p id="selected-table" role="status">Hedef masa seç.</p><input name="tableId" type="hidden">'+input('reason',merge?'Birleştirme gerekçesi':'Taşıma gerekçesi','','required maxlength="500"'))}</div>`;
    const form=area.querySelector('form'),submit=form.querySelector('[type=submit]');submit.textContent=merge?'Hesapları birleştir':'Masaya taşı';submit.disabled=true;submit.dataset.unavailable='';
    area.querySelectorAll('[data-target]:not([disabled])').forEach(button=>button.addEventListener('click',()=>{
      if(form.querySelector('[name=reason]').disabled)return;
      area.querySelectorAll('[data-target]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
      form.elements.namedItem('tableId').value=button.dataset.target;
      area.querySelector('#selected-table').textContent=`Seçilen masa: ${dining.tables.find(table=>table.id===button.dataset.target).name}`;
      submit.disabled=false;delete submit.dataset.unavailable;
    }));
    bind(byId('table-action-form'),`/api/sales/groups/${group.id}/${mode}`,form=>{
      const target=dining.tables.find(table=>table.id===form.get('tableId'));if(!target)throw new Error('Hedef masa seç.');
      return merge?{revision:group.revision,targetId:target.groupId,targetRevision:target.groupRevision,reason:form.get('reason')}:{revision:group.revision,tableId:target.id,reason:form.get('reason')};
    },merge?result=>openGroup(result.group.id):refresh);
    form.addEventListener('submit',()=>{if(!form.elements.namedItem('tableId').value||!form.checkValidity())return;byId('choose-move').disabled=true;const mergeButton=byId('choose-merge');if(mergeButton)mergeButton.disabled=true;});
  }
  byId('choose-move').addEventListener('click',()=>choose('move'));
  byId('choose-merge')?.addEventListener('click',()=>choose('merge'));
  if(can('orders.write')&&includeBill)bind(byId('request-bill'),`/api/sales/groups/${group.id}/request-bill`,()=>({revision:group.revision}));
  if(group.remainingMinor==='0')bind(byId('close-empty'),`/api/sales/groups/${group.id}/close`,()=>({revision:group.revision}));
}
