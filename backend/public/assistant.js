import {availableGuides,scenarioHtml} from './screen-guide.js';
import {availableScreens,searchScreens} from './navigation-catalog.js';
import {html} from './business-ui.js';
export async function renderAssistant(container,context){
  const {user,request,message,isCurrent,openTab}=context;const screens=availableScreens(user).filter(row=>row.id!=='assistant');
  let status;try{status=await request('/api/assistant/status');}catch{status={configured:false};}if(!isCurrent())return;
  container.innerHTML=`<div class="assistant-workspace"><div class="catalog-heading"><div><h2>Program rehberi</h2><p>İşlemin adımlarını öğren veya ilgili ekrana geç.</p></div></div><div class="assistant-layout"><section class="panel"><h3>Kullanım adımları</h3><label>Konu ara<input id="guide-search" type="search" placeholder="Veresiye, ödeme, kasa…"></label><div id="guide-topics"></div></section><section class="panel"><h3>Yapay zekâya sor</h3><p>Programı nasıl kullanacağını sor. Soru ve yetkili ekranların kullanım bilgileri OpenAI’ya gönderilir. İşletme kayıtları asistana aktarılmaz; asistan işlem yapmaz.</p><p id="assistant-status">${status.configured?'Bağlantı ayarlı. Yanıtlar otomatik tekrarlanmaz.':'Yapay zekâ bağlantısı henüz kurulmamış. Soldaki kullanım adımlarını bağlantı olmadan kullanabilirsin.'}</p>${!status.configured&&user.permissions.includes('settings.manage')?'<button id="assistant-setup" type="button" class="secondary">Bağlantıyı ayarla</button>':''}<form id="assistant-question" class="business-form"><label>Sorun<textarea name="question" maxlength="2000" required placeholder="Kasayı patrona nasıl teslim ederim?"></textarea></label><p class="error" role="alert"></p><button type="submit" class="primary" ${status.configured?'':'disabled'}>Sor</button></form><div id="assistant-answer" role="status" aria-live="polite"></div><div id="assistant-links" class="editor-buttons"></div></section></div></div>`;
  const query=container.querySelector('#guide-search'),topics=container.querySelector('#guide-topics');
  function list(){
    const visible=query.value.trim()?searchScreens(user,query.value).filter(row=>row.id!=='assistant'):screens;
    const guides=availableGuides(user,query.value),covered=new Set(guides.map(row=>row.screenId));
    topics.innerHTML=guides.map(row=>scenarioHtml({...row,title:row.screenName+' · '+row.title,openScreen:true})).join('')+(query.value.trim()?'':visible.filter(row=>!covered.has(row.id)).map(row=>`<details><summary>${html(row.name)}</summary><p>${html(row.guide)}</p><button type="button" class="secondary" data-guide="${html(row.id)}">Ekranı aç</button></details>`) .join(''))||'<p>Bu kelimeyle konu bulunamadı.</p>';
    topics.querySelectorAll('[data-guide]').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.guide)));
  }
  query.addEventListener('input',list);list();container.querySelector('#assistant-setup')?.addEventListener('click',()=>openTab('settings'));
  const form=container.querySelector('form');form.elements.namedItem('question').value=context.assistantQuestion||'';let busy=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!status.configured)return;busy=true;const button=form.querySelector('button');button.disabled=true;button.textContent='Yanıt hazırlanıyor…';form.querySelector('.error').textContent='';container.querySelector('#assistant-links').replaceChildren();
    try{
      const result=await request('/api/assistant/ask',{method:'POST',body:JSON.stringify({question:form.elements.namedItem('question').value})});if(!isCurrent())return;
      container.querySelector('#assistant-answer').textContent=result.answer;
      for(const row of result.screens){const link=document.createElement('button');link.type='button';link.className='secondary';link.textContent=row.name;link.addEventListener('click',()=>openTab(row.id));container.querySelector('#assistant-links').append(link);}
    }catch(error){if(isCurrent())form.querySelector('.error').textContent=message(error);}
    finally{busy=false;button.disabled=false;button.textContent='Sor';}
  });
}
