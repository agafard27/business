import {html,input,select,formShell,commandForm} from './business-ui.js';
export async function renderImports(container,context){
  const {request,message,isCurrent}=context;const [formats,history]=await Promise.all([request('/api/imports/formats'),request('/api/imports')]);if(!isCurrent())return;
  const refresh=()=>renderImports(container,context);
  container.innerHTML=`<h2>Excel / CSV aktarımı</h2><section class="panel"><p>Önce şablonu doldur veya dosyanın sütunlarını eşleştir. Önizleme kesinleşmeden iş kayıtları değişmez. Tek sayfa, en fazla 500 satır ve 5 MB; formüller yerine değerler kullan.</p>${select('importKind','Kayıt türü',formats.formats.map(format=>({id:format.kind,name:format.name})))}<p><a id="import-template" class="quiet-link">Excel şablonunu indir</a></p><label>Dosya seç<input id="import-file" type="file" accept=".xlsx,.csv"></label><button id="inspect-file" class="secondary">Sütunları oku</button><p id="import-error" class="error" role="alert"></p><div id="import-mapping"></div></section><section class="panel"><h3>Aktarım geçmişi</h3>${history.batches.map(batch=>`<p><button class="text-button" data-batch="${html(batch.id)}">#${html(batch.id)} · ${html(formats.formats.find(format=>format.kind===batch.kind)?.name)} · ${batch.reversed?'Geri alındı':html(batch.status)}</button></p>`).join('')}<div id="batch-preview"></div></section>`;
  const byId=id=>container.querySelector(`#${id}`);const kind=()=>container.querySelector('[name=importKind]').value;
  const updateTemplate=()=>byId('import-template').href=`/api/imports/template/${kind()}`;updateTemplate();container.querySelector('[name=importKind]').addEventListener('change',()=>{updateTemplate();byId('import-mapping').innerHTML='';});
  byId('inspect-file').addEventListener('click',async()=>{
    const button=byId('inspect-file');button.disabled=true;
    try{
      const file=byId('import-file').files[0];if(!file||file.size>5*1024*1024)throw new Error('En fazla 5 MB Excel veya CSV dosyası seç.');
      const format=file.name.toLowerCase().endsWith('.xlsx')?'xlsx':file.name.toLowerCase().endsWith('.csv')?'csv':null;if(!format)throw new Error('Excel veya CSV dosyası seç.');
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));const fileBase64=btoa(binary);
      const inspected=await request('/api/imports/inspect',{method:'POST',body:JSON.stringify({fileBase64,format})});if(!isCurrent())return;
      const selected=kind();const spec=formats.formats.find(item=>item.kind===selected);
      byId('import-mapping').innerHTML=`<h3>${inspected.rowCount} veri satırı</h3>${formShell(Object.entries(spec.columns).map(([column,label],index)=>select(column,label,[{id:'',name:'Eşleşmedi'},...inspected.headers.map((header,index)=>({id:String(index),name:header||`Sütun ${index+1}`}))],inspected.headers[index]===label?String(index):'')).join(''))}`;
      commandForm(byId('import-mapping').querySelector('form'),{request,message,path:'/api/imports/stage',values:form=>({kind:selected,format,fileBase64,mapping:Object.fromEntries(Object.keys(spec.columns).map(column=>[column,form.get(column)===''?null:Number(form.get(column))]))}),success:result=>showBatch(result.id)});
    }catch(error){byId('import-error').textContent=message(error);}finally{button.disabled=false;}
  });
  async function showBatch(id){
    try{
      const preview=await request(`/api/imports/${id}`);if(!isCurrent())return;
      const node=byId('batch-preview');node.innerHTML=`<h3>Aktarım #${html(id)}</h3><div class="business-table-wrap"><table class="business-table"><thead><tr><th>Satır</th><th>İşlem</th><th>Kayıt</th><th>Kontrol</th></tr></thead><tbody>${preview.rows.map(row=>`<tr><td>${row.rowNumber}</td><td>${row.action==='insert'?'Eklenecek':row.action==='update'?'Güncellenecek':'Reddedildi'}</td><td>${html(row.input.name||row.input.productCode||row.input.partyCode||row.input.code)}</td><td>${html(row.errors.join(' · ')||row.status)}</td></tr>`).join('')}</tbody></table></div>${preview.batch.status==='validated'?`<div id="import-confirm">${formShell('<p>Yukarıdaki satırların tamamını kesinleştir.</p>')}</div>`:''}${['staged','validated'].includes(preview.batch.status)?`<div id="import-discard">${formShell('<p>Önizlemeyi kaldır; dosyayı düzelterek yeniden yükle.</p>')}</div>`:''}`;
      if(preview.batch.status==='completed'&&!preview.batch.reversed){const reversal=document.createElement('div');reversal.id='import-reverse';reversal.innerHTML=formShell(input('reason','Geri alma gerekçesi','','required maxlength="500"')+'<p>Bağlı işlemler yoksa ters kayıt oluşturulur. Geçmiş silinmez.</p>');node.append(reversal);}
      if(node.querySelector('#import-reverse'))commandForm(node.querySelector('#import-reverse form'),{request,message,path:`/api/imports/${id}/reverse`,values:form=>({reason:form.get('reason')}),success:refresh});
      if(node.querySelector('#import-confirm'))commandForm(node.querySelector('#import-confirm form'),{request,message,path:`/api/imports/${id}/apply`,values:()=>({}),success:refresh});
      if(node.querySelector('#import-discard'))commandForm(node.querySelector('#import-discard form'),{request,message,path:`/api/imports/${id}/discard`,values:()=>({}),success:refresh});
    }catch(error){byId('import-error').textContent=message(error);}
  }
  container.querySelectorAll('[data-batch]').forEach(button=>button.addEventListener('click',()=>void showBatch(button.dataset.batch)));
}
