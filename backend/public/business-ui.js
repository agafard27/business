export const html = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export { formatPrice,parsePrice } from './catalog.js';
export const input = (name,label,value='',extra='') => `<label>${html(label)}<input name="${html(name)}" value="${html(value)}" ${extra}></label>`;
export const select = (name,label,options,value='',extra='') => `<label>${html(label)}<select name="${html(name)}" ${extra}>${options.map(option=>`<option value="${html(option.id)}" ${String(option.id)===String(value)?'selected':''}>${html(option.name)}</option>`).join('')}</select></label>`;
export const formShell = fields => `<form class="business-form">${fields}<p class="error" role="alert"></p><button type="submit" class="primary">Kaydet</button></form>`;
export function rowEditor(node,columns,initialRows=[{}]){
  let count=0;
  node.innerHTML='<div class="editable-rows"></div><button class="secondary add-row" type="button">Satır ekle</button>';
  function add(values={}){
    const row=document.createElement('div');row.className='editable-row';const index=count++;
    row.innerHTML=columns.map(column=>column.options?select(`${column.name}-${index}`,column.label,column.options,values[column.name]??column.value,column.extra||'required'):input(`${column.name}-${index}`,column.label,values[column.name]??column.value??'',column.extra||'required')).join('')+'<button type="button" class="text-button">Satırı çıkar</button>';
    const changed=()=>node.dispatchEvent(new node.ownerDocument.defaultView.Event('rowschange',{bubbles:true}));
    row.querySelector('button').addEventListener('click',()=>{row.remove();changed();});node.querySelector('.editable-rows').append(row);changed();
  }
  node.querySelector('.add-row').addEventListener('click',()=>add());for(const row of initialRows)add(row);
  return ()=>[...node.querySelectorAll('.editable-row')].map(row=>Object.fromEntries(columns.map(column=>[column.name,row.querySelector(`[name^="${column.name}-"]`).value])));
}
export function commandForm(form,{request,path,method='POST',values,success,message}) {
  let pending=null,busy=false,completed=null;
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(busy)return;
    if(!pending&&completed===null&&!form.reportValidity())return;
    const errorNode=form.querySelector('.error'); const submit=form.querySelector('[type=submit]');const originalText=submit.dataset.originalText||submit.textContent;submit.dataset.originalText=originalText;
    if(completed!==null){busy=true;try{await success(completed);}catch(error){errorNode.textContent=`İşlem kaydedildi. Ekran yenilenemedi: ${message(error)}`;}finally{busy=false;}return;}
    busy=true;
    try { pending ||= {requestKey:crypto.randomUUID(),...await values(new FormData(form))}; }
    catch(error){errorNode.textContent=message(error);busy=false;return;}
    busy=true; errorNode.textContent=''; form.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=true);
    try { const result=await request(path,{method,body:JSON.stringify(pending)});completed=result; if(form.isConnected)await success(result); }
    catch(error){
      if(!form.isConnected)return;
      if(completed!==null){errorNode.textContent=`İşlem kaydedildi. Ekran yenilenemedi: ${message(error)}`;submit.disabled=false;submit.textContent='Ekranı yenile';return;}
      const unknown=!error.status||error.code==='COMMIT_UNKNOWN';
      errorNode.textContent=unknown?'Sonuç doğrulanamadı. Aynı düğmeyle kontrol et; aynı işlem ikinci kez uygulanmaz.':message(error);
      if(error.code==='APPROVAL_REQUIRED'&&pending){
        const matchers=[[/^\/api\/sales\/tables\/(\d+)\/orders$/ ,'sales.table.submit'],[/^\/api\/sales\/groups\/(\d+)\/orders$/,'sales.submit'],[/^\/api\/sales\/groups\/(\d+)\/payments$/,'sales.settle'],[/^\/api\/sales\/groups\/(\d+)\/lines\/(\d+)\/cancel$/,'sales.cancel'],[/^\/api\/stock\/movements$/,'stock.movement'],[/^\/api\/expenses$/,'expense.create'],[/^\/api\/expenses\/(\d+)\/payments$/,'expense.pay'],[/^\/api\/finance\/cash-movements$/,'cash.movement'],[/^\/api\/purchases$/,'purchase.create'],[/^\/api\/purchases\/(\d+)\/receive$/,'purchase.receive']];
        const found=matchers.find(([pattern])=>pattern.test(path));
        if(found){
          const match=found[0].exec(path),payload={command:{...pending},...(match[1]?{id:match[1]}:{}),...(match[2]?{lineId:match[2]}:{})};delete payload.command.requestKey;
          const existing=form.querySelector('[data-approval-request]');if(existing)existing.remove();const node=document.createElement('div');node.dataset.approvalRequest='1';
          node.innerHTML='<label>Onay gerekçesi<textarea maxlength="1000"></textarea></label><button class="secondary" type="button">Yetkili onayı iste</button><p role="status"></p>';form.append(node);
          const requestKey=crypto.randomUUID();node.querySelector('button').addEventListener('click',async()=>{
            const button=node.querySelector('button');button.disabled=true;try{const result=await request('/api/approvals',{method:'POST',body:JSON.stringify({requestKey,action:found[1],payload,reason:node.querySelector('textarea').value})});node.querySelector('p').textContent=`Onay talebi #${result.id} oluşturuldu. Onaylar bölümünden izleyebilirsin.`;}catch(error){node.querySelector('p').textContent=message(error);button.disabled=false;}
          });
        }
      }
      if(!unknown){pending=null;form.querySelectorAll('input,select,textarea,button').forEach(node=>node.disabled=node.hasAttribute('data-unavailable'));}
      submit.disabled=false;submit.textContent=unknown?'İşlemi kontrol et':originalText;
    } finally{busy=false;}
  });
}
export async function uploadAttachment(file,request){
  if(!file?.size)return null;if(file.size>5*1024*1024)throw new Error('Belge en fazla 5 MB olabilir.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let index=0;index<bytes.length;index+=16384)binary+=String.fromCharCode(...bytes.subarray(index,index+16384));
  return (await request('/api/files',{method:'POST',body:JSON.stringify({requestKey:crypto.randomUUID(),name:file.name,fileBase64:btoa(binary)})})).id;
}
