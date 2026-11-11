import {html,input} from './business-ui.js';
import {reportSections,summaryHtml,productSalesHtml,detailTableHtml,auditHtml} from './report-sections.js';
export async function renderReports(container,context){
 const {request,message,isCurrent}=context;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
 let selected='summary',version=0,loadedRows=0;
 container.classList.add('reports-workspace');
 container.innerHTML=`<h2>Raporlar</h2><p>Önce işletmenin durumunu görün; tutarların altından ilgili kayıtlara ulaşın.</p><form id="report-filters" class="business-form">${input('from','Başlangıç',today,'type="date" required')}${input('to','Bitiş',today,'type="date" required')}<button type="submit" class="primary">Göster</button><p class="error" role="alert"></p></form><p class="report-range-note">Başlangıç ve bitiş günleri dahildir; saat dilimi Türkiye. Ayrıntılara geçince tarih aralığı korunur.</p><details id="report-areas-panel"><summary>Bütün rapor alanları</summary><nav id="report-areas" class="report-category-grid" aria-label="Rapor alanları">${reportSections.map(section=>`<button type="button" data-report="${section.id}" aria-pressed="${section.id===selected}"><strong>${html(section.name)}</strong><span>${html(section.description)}</span></button>`).join('')}</nav></details><div id="report-content" aria-live="polite"></div>`;
 const form=container.querySelector('#report-filters'),content=container.querySelector('#report-content');
 const current=()=>reportSections.find(section=>section.id===selected);
 function frame(notice=''){
  const section=current();
  content.innerHTML=`<section class="panel report-view"><div class="report-view-heading"><div><h3 tabindex="-1">${html(section.name)}</h3><p>${html(form.elements.from.value)} — ${html(form.elements.to.value)}</p></div><div class="report-actions">${selected!=='summary'?'<button type="button" class="text-button" data-report-open="summary">← Genel özete dön</button>':''}<button type="button" class="text-button" data-report-back>Bütün rapor alanları</button></div></div><p>${html(section.description)}</p>${selected==='costs'?'<p class="notice">Yalnız kazanç hesabını engelleyen, iptal edilmemiş satış satırları gösterilir. Satış tarihindeki stok kuralı esas alınır; bugünkü ayarlar geçmiş satışları değiştirmez.</p>':''}<p id="report-notice" role="status">${html(notice)}</p><p class="error report-error" role="alert"></p>${section.source==='details'?'<label>Yüklenen hareketlerde ara<input id="report-row-search" type="search" placeholder="Personel, ürün, açıklama…"></label><p id="report-row-count"></p>':''}<div id="report-details"></div><div id="report-more"></div></section>`;
  content.querySelector('[data-report-back]').addEventListener('click',()=>{const areas=container.querySelector('#report-areas-panel');areas.open=true;areas.scrollIntoView?.({block:'start',behavior:'smooth'});areas.querySelector('summary').focus();});
  content.querySelector('#report-row-search')?.addEventListener('input',filterRows);
 }
 function filterRows(){const query=content.querySelector('#report-row-search')?.value.trim().toLocaleLowerCase('tr-TR')||'';content.querySelectorAll('#report-details tbody tr,#report-details [data-report-row]').forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase('tr-TR').includes(query));}
 async function load(append=false,before=null){
  const section=current(),run=++version;
  if(!form.reportValidity())return;
  form.querySelector('.error').textContent='';
  if(!append){loadedRows=0;frame('Rapor getiriliyor…');}
  const oldMore=content.querySelector('[data-more]');if(oldMore)oldMore.disabled=true;
  try{
   const query=new URLSearchParams(new FormData(form));let path;
   if(section.source==='details'){query.set('kind',section.kind);if(before)query.set('before',before);path='/api/reports/details?'+query;}
   else path='/api/reports/'+section.source+'?'+query;
   const data=await request(path);
   if(!isCurrent()||run!==version||section.id!==selected)return;
   const body=content.querySelector('#report-details');content.querySelector('#report-notice').textContent='';
   if(section.id==='summary')body.innerHTML=summaryHtml(data,query.toString());
   else if(section.id==='products'){
    body.innerHTML=productSalesHtml(data);
    body.querySelector('#sold-product-search').addEventListener('input',event=>{const query=event.target.value.trim().toLocaleLowerCase('tr-TR');body.querySelectorAll('[data-sold-name]').forEach(row=>row.hidden=!row.dataset.soldName.includes(query));});
   }else if(section.source==='audit')body.innerHTML=auditHtml(data);
   else{
    const table=detailTableHtml(data);if(append)body.insertAdjacentHTML('beforeend',table);else body.innerHTML=table;
    loadedRows+=data.rows.length;content.querySelector('#report-row-count').textContent=(selected==='costs'?'Gösterilen satış satırı: ':'Gösterilen hareket: ')+loadedRows+(data.nextCursor?' · Devamı var.':'');
    const more=content.querySelector('#report-more');more.innerHTML='';
    if(data.nextCursor){const button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.more='1';button.textContent='Sonraki 200 hareket';const cursor=data.nextCursor;button.addEventListener('click',()=>{if(button.isConnected&&!button.disabled)void load(true,cursor);});more.append(button);}
    filterRows();
   }
  }catch(error){if(isCurrent()&&run===version){content.querySelector('#report-notice').textContent='';content.querySelector('.report-error').textContent=message(error);if(oldMore)oldMore.disabled=false;}}
 }
 function choose(id){
  if(!reportSections.some(section=>section.id===id))return;
  if(!form.reportValidity())return;
  selected=id;version++;
  container.querySelector('#report-areas-panel').open=false;
  container.querySelectorAll('[data-report]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.report===id)));
  void load();content.scrollIntoView?.({block:'start',behavior:'smooth'});content.querySelector('h3')?.focus({preventScroll:true});
 }
 content.addEventListener('click',event=>{const button=event.target.closest('[data-report-open]');if(button&&content.contains(button))choose(button.dataset.reportOpen);const anchor=event.target.closest('[data-report-anchor]');if(anchor){const target=content.querySelector('#report-profit');target?.scrollIntoView?.({block:'start',behavior:'smooth'});target?.focus({preventScroll:true});}});
 container.querySelectorAll('[data-report]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.report)));
 form.addEventListener('input',()=>{version++;loadedRows=0;frame('Tarih değişti. Seçili dönemi görmek için Göster düğmesine basın.');});
 form.addEventListener('submit',event=>{event.preventDefault();void load();});
 await load();
}
