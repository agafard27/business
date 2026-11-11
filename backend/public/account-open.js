// A lost response keeps the same command even when the screen is rendered again.
const pending=new Map();
export function bindAccountOpen(button,{context,tableId=null,errorNode,scope=null}){
  const {request,message,user,isCurrent,openGroup}=context;
  const labelNode=button.querySelector('[data-account-open-label]')||button;
  const key=`${user.id}:${scope??tableId??'retail'}`,label=labelNode.textContent;
  const watch=state=>{state.buttons.set(button,{labelNode,original:label});paint(state);};
  function paint(state){
    for(const [node,{labelNode,original}] of state.buttons){
      if(!node.isConnected){state.buttons.delete(node);continue;}
      node.disabled=state.busy;
      node.setAttribute('aria-busy',String(state.busy));
      labelNode.textContent=state.busy?'Adisyon açılıyor…':state.result?'Adisyona dön':state.command?'İşlemi kontrol et':original;
    }
  }
  if(pending.has(key))watch(pending.get(key));
  button.addEventListener('click',async()=>{
    let state=pending.get(key);
    if(state?.busy)return;
    if(!user.permissions.includes('orders.write')){errorNode.textContent='Adisyon açmak için sipariş yetkisi gerekli.';return;}
    if(!state){state={command:null,result:null,busy:false,buttons:new Map()};pending.set(key,state);}
    state.buttons.set(button,{labelNode,original:label});state.busy=true;paint(state);errorNode.textContent='';
    try{
      state.command||={requestKey:crypto.randomUUID(),tableId};
      state.result||=await request('/api/sales/open',{method:'POST',body:JSON.stringify(state.command)});
      if(!isCurrent())return;
      await openGroup(state.result.group.id);
      pending.delete(key);state.command=null;state.result=null;
    }catch(error){
      if(state.result){if(isCurrent())errorNode.textContent=labelNode!==button?'Adisyon açıldı. Aynı masaya dokunarak devam edebilirsin.':'Adisyon açıldı. Adisyona dön düğmesine basarak devam edebilirsin.';}
      else if(!error.status||error.code==='COMMIT_UNKNOWN'){
        if(isCurrent())errorNode.textContent=labelNode!==button?'Sonuç doğrulanamadı. Aynı masaya tekrar dokunarak işlemi kontrol et.':'Sonuç doğrulanamadı. İşlemi kontrol et düğmesiyle aynı adisyona devam et.';
      }else{state.command=null;pending.delete(key);if(isCurrent())errorNode.textContent=message(error);}
    }finally{state.busy=false;paint(state);}
  });
}
