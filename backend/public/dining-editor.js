import {html,input,select,formShell} from './business-ui.js';

// Keep an uncertain write across screen navigation; only the same command may be retried.
const pendingByUser=new Map();
const collator=new Intl.Collator('tr',{sensitivity:'base'});
const sameName=(a,b)=>collator.compare(a.trim().normalize('NFC'),b.trim().normalize('NFC'))===0;
export function nextTableNumber(tables,sectionId,prefix='Masa'){
  let largest=0;
  for(const table of tables.filter(row=>row.sectionId===sectionId)){
    const match=/^(.*) (\d+)$/.exec(table.name);
    if(match&&sameName(match[1],prefix)&&Number(match[2])<=99999)largest=Math.max(largest,Number(match[2]));
  }
  return largest+1;
}
export function mountDiningEditor({node,data,context,getSection,refresh,setLocked}){
  const {request,message,user,isCurrent}=context,key=String(user.id);
  let currentForm=null;
  function show(title,fields,submitText,definition){
    if(pendingByUser.has(key))return;
    node.hidden=false;
    node.innerHTML=`<h3 id="dining-editor-title">${html(title)}</h3>${formShell(fields)}`;
    const form=node.querySelector('form');currentForm=form;
    const submit=form.querySelector('[type=submit]');submit.textContent=submitText;
    const cancel=node.ownerDocument.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Vazgeç';submit.after(cancel);
    cancel.addEventListener('click',()=>{if(!pendingByUser.has(key)){node.hidden=true;node.innerHTML='';context.focusOrigin?.();}});
    bind(form,{...definition,title});
    node.scrollIntoView?.({block:'nearest'});(form.querySelector('input:not([type=hidden]),select')||submit).focus({preventScroll:true});
  }
  function paint(state){
    for(const view of state.views){
      if(!view.form.isConnected){state.views.delete(view);continue;}
      view.lock(true);
      view.form.querySelectorAll('input,select,textarea,button').forEach(field=>field.disabled=true);
      const submit=view.form.querySelector('[type=submit]');submit.disabled=state.busy;
      submit.textContent=state.busy?'İşlem sürüyor…':state.result?'Ekranı yenile':'İşlemi kontrol et';
      view.form.querySelector('.error').textContent=state.error||'';
    }
  }
  function bind(form,definition,restored=null){
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!isCurrent())return;
      let state=pendingByUser.get(key);
      if(state?.busy)return;
      if(!state){
        if(!form.reportValidity())return;
        try{const values=definition.values(new FormData(form));state={...definition,command:{requestKey:crypto.randomUUID(),...values},views:new Set(),result:null,busy:false,error:''};}
        catch(error){form.querySelector('.error').textContent=message(error);return;}
        pendingByUser.set(key,state);
      }
      if(![...state.views].some(view=>view.form===form))state.views.add({form,lock:setLocked,current:isCurrent,restored:Boolean(restored),submitText:definition.submitText,duplicateMessage:definition.duplicateMessage});
      state.busy=true;state.error='';paint(state);
      try{
        state.result??=await request(state.path,{method:state.method,body:JSON.stringify(state.command)});
        if(!isCurrent())return;
        // Remove only while refreshing. A failed refresh must not write a second time.
        pendingByUser.delete(key);
        try{await refresh({...((typeof state.view==='function'?state.view(state.command,state.result):state.view)||{}),notice:typeof state.notice==='function'?state.notice(state.result):state.notice,focusTable:state.result.id});}
        catch(error){pendingByUser.set(key,state);throw error;}
      }catch(error){
        const definite=!state.result&&error.status&&error.code!=='COMMIT_UNKNOWN';
        if(definite){
          pendingByUser.delete(key);
          for(const view of state.views){
            if(!view.form.isConnected||!view.current())continue;
            view.lock(false);view.form.querySelectorAll('input,select,textarea,button').forEach(field=>field.disabled=field.hasAttribute('data-unavailable'));
            const submit=view.form.querySelector('[type=submit]');submit.textContent=view.submitText;
            if(view.restored){submit.disabled=true;submit.dataset.unavailable='';}
            view.form.querySelector('.error').textContent=(error.code==='DUPLICATE_RECORD'?view.duplicateMessage:message(error))+(view.restored?' Güncel bilgileri Yenile ile yükle.':'');
          }
        }else state.error=state.result?`İşlem kaydedildi. Ekran yenilenemedi: ${message(error)}`:'Sonuç doğrulanamadı. İşlemi kontrol et ile aynı işlemin sonucunu doğrula; yeniden ekleme yapılmaz.';
      }finally{state.busy=false;if(pendingByUser.get(key)===state)paint(state);}
    });
    if(restored){restored.views.add({form,lock:setLocked,current:isCurrent,restored:true,submitText:definition.submitText,duplicateMessage:definition.duplicateMessage});paint(restored);}
  }
  function sectionId(){return getSection()||data.sections[0]?.id;}
  function requireSection(){if(data.sections.length)return true;editSection();node.querySelector('.error').textContent='Masa eklemek için önce bir bölüm oluştur.';return false;}
  function checkTableName(name,sectionId,id=null){
    if(data.tables.some(table=>table.id!==id&&table.sectionId===sectionId&&sameName(table.name,name)))throw new Error('Bu bölümde bu isimde masa zaten var. Kullanımdan kaldırılan masaları da kontrol et veya başka ad seç.');
  }
  function editSection(section){
    const submitText=section?'Bölümü kaydet':'Bölüm oluştur';
    show(section?'Bölümü düzenle':'Bölüm ekle',input('name','Bölüm adı',section?.name||'','required maxlength="100"')+input('sortOrder','Görünme sırası (küçük sayı önce)',section?.sortOrder??0,'type="number" min="-100000" max="100000" required'),submitText,{
      path:`/api/dining/sections${section?`/${section.id}`:''}`,method:section?'PATCH':'POST',submitText,notice:section?'Bölüm güncellendi.':'Bölüm oluşturuldu. Artık bu bölüme masa ekleyebilirsin.',duplicateMessage:'Bu isimde bir bölüm zaten var.',
      view:(_,result)=>({sectionId:result.id}),
      values:form=>{const name=form.get('name').trim();if(data.sections.some(row=>row.id!==section?.id&&sameName(row.name,name)))throw new Error('Bu isimde bir bölüm zaten var.');return {name,sortOrder:Number(form.get('sortOrder')),...(section?{revision:section.revision}:{})};}
    });
  }
  function addMode(active){
    const form=currentForm;if(!form?.isConnected)return;
    const tabs=node.ownerDocument.createElement('div');tabs.className='dining-add-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Masa ekleme biçimi');
    tabs.innerHTML=`<button type="button" data-add-mode="single" aria-pressed="${active==='single'}">Tek masa</button><button type="button" data-add-mode="batch" aria-pressed="${active==='batch'}">Birden fazla masa</button>`;
    form.before(tabs);tabs.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
      if(pendingByUser.has(key)||button.dataset.addMode===active)return;
      const selected=form.elements.sectionId.value;
      if(button.dataset.addMode==='single')editTable(null,selected);else addTables(selected);
    }));
  }
  function editTable(table,selectedSection=null){
    if(!requireSection())return;
    const selected=table?.sectionId||selectedSection||sectionId(),suggested=nextTableNumber(data.tables,selected),submitText=table?'Değişiklikleri kaydet':'Masa oluştur';
    show(table?`${table.name} · Düzenle`:'Masa ekle',input('name','Masa adı',table?.name||(suggested<=99999?`Masa ${suggested}`:''),'required maxlength="80"')+select('sectionId','Bölüm',data.sections,selected)+`<p class="field-help">${table?.groupId?'Bu masada açık hesap var. Adı veya bölümü değişebilir; hesabı kapanana veya başka masaya taşınana kadar kullanımdan kaldırılamaz.':'Aynı bölümde masa adları farklı olmalı. Kullanımdan kaldırma ayrı düğmeyle yapılır.'}</p>`,submitText,{
      path:`/api/dining/tables${table?`/${table.id}`:''}`,method:table?'PATCH':'POST',submitText,notice:table?'Masa güncellendi.':'Masa oluşturuldu.',duplicateMessage:'Bu bölümde bu isimde masa zaten var. Kullanımdan kaldırılan masaları da kontrol et.',
      view:command=>({sectionId:command.sectionId,status:command.isActive?'active':'inactive',search:''}),
      values:form=>{const name=form.get('name').trim(),sectionId=form.get('sectionId');checkTableName(name,sectionId,table?.id);return {name,sectionId,isActive:table?.isActive??true,...(table?{revision:table.revision}:{})};}
    });
    currentForm?.elements.name?.select();
    if(!table){
      addMode('single');
      const form=currentForm;let last=form.elements.name.value;
      form.elements.sectionId.addEventListener('change',()=>{if(form.elements.name.value===last){const n=nextTableNumber(data.tables,form.elements.sectionId.value);last=n<=99999?`Masa ${n}`:'';form.elements.name.value=last;}});
    }
  }
  function addTables(selectedSection=null){
    if(!requireSection())return;
    const selected=selectedSection||sectionId(),start=nextTableNumber(data.tables,selected),submitText='Masaları oluştur';
    show('Toplu masa ekle','<p>Bölümü ve kaç masa ekleyeceğini seç. Masa numaraları kaldığı yerden devam eder.</p>'+select('sectionId','Bölüm',data.sections,selected)+input('count','Kaç masa eklensin?','10','type="number" min="1" max="100" required')+'<details class="dining-extra"><summary>İsim ve numarayı değiştir</summary>'+input('prefix','Ad öneki','Masa','required maxlength="70"')+input('start','Başlangıç numarası',String(Math.min(start,99999)),'type="number" min="1" max="99999" required')+'</details><p class="entry-preview" id="table-batch-preview" role="status"></p>',submitText,{
      path:'/api/dining/tables/batch',method:'POST',submitText,notice:result=>`${result.count} masa oluşturuldu.`,view:command=>({sectionId:command.sectionId,status:'active',search:''}),duplicateMessage:'Seçilen aralıkta aynı adlı masa var. Hiçbir masa eklenmedi; numarayı veya öneki değiştir.',
      values:form=>{const values={sectionId:form.get('sectionId'),prefix:form.get('prefix').trim(),start:Number(form.get('start')),count:Number(form.get('count'))};validateBatch(values);return values;}
    });
    addMode('batch');
    const form=currentForm;let last=Number(form.elements.start.value);
    function preview(){
      const values={sectionId:form.elements.sectionId.value,prefix:form.elements.prefix.value.trim(),start:Number(form.elements.start.value),count:Number(form.elements.count.value)},area=node.querySelector('#table-batch-preview');
      try{validateBatch(values);area.textContent=`${data.sections.find(row=>row.id===values.sectionId)?.name}: ${values.prefix} ${values.start} → ${values.prefix} ${values.start+values.count-1} · ${values.count} yeni masa`;}
      catch(error){area.textContent=message(error);}
    }
    for(const name of ['sectionId','prefix'])form.elements[name].addEventListener('change',()=>{if(Number(form.elements.start.value)===last){last=Math.min(nextTableNumber(data.tables,form.elements.sectionId.value,form.elements.prefix.value),99999);form.elements.start.value=String(last);}preview();});
    form.addEventListener('input',preview);preview();
  }
  function validateBatch(values){
    if(!values.prefix||!Number.isInteger(values.start)||values.start<1||!Number.isInteger(values.count)||values.count<1||values.count>100||values.start+values.count-1>99999)throw new Error('Başlangıç 1–99999, adet 1–100 olmalı; son numara 99999 değerini aşamaz.');
    for(let i=0;i<values.count;i++)checkTableName(`${values.prefix} ${values.start+i}`,values.sectionId);
  }
  function toggleTable(table){
    if(table.groupId)return;
    const active=!table.isActive,submitText=active?'Masayı yeniden kullan':'Kullanımdan kaldır';
    show(`${table.name} · ${active?'Yeniden kullan':'Kullanımdan kaldır'}`,`<p><strong>${html(table.name)}</strong> · ${html(data.sections.find(row=>row.id===table.sectionId)?.name)}</p><p>${active?'Masa tekrar adisyon açılabilen masalar arasında görünür.':'Masa günlük listeden çıkarılır. Geçmiş hesaplar korunur; “Kaldırılan masalar” filtresinden yeniden kullanabilirsin.'}</p>`,submitText,{
      path:`/api/dining/tables/${table.id}`,method:'PATCH',submitText,notice:active?'Masa yeniden kullanıma açıldı.':'Masa kullanımdan kaldırıldı. Geçmiş hesaplar korundu.',view:{status:active?'active':'inactive',sectionId:table.sectionId,search:''},duplicateMessage:'Bu bölümde aynı isimde masa var.',
      values:()=>({name:table.name,sectionId:table.sectionId,isActive:active,revision:table.revision})
    });
  }
  const pending=pendingByUser.get(key);
  if(pending){
    node.hidden=false;node.innerHTML=`<h3 id="dining-editor-title">${html(pending.title)} · Sonuç kontrolü</h3>${formShell('<p>Önceki isteğin sonucu kontrol edilmeli. Yeni işlem başlatmadan aynı düğmeyle devam et.</p>')}`;
    bind(node.querySelector('form'),pending,pending);
  }
  return {editTable,editSection,addTables,toggleTable};
}
