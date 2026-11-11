export function mountDisplayMode(container,{storage,media=globalThis.matchMedia?.('(max-width: 820px)'),root=container.ownerDocument.documentElement}={}){
 let mode='auto';try{storage ??= globalThis.localStorage;const stored=storage?.getItem('nar.displayMode');if(['auto','phone','pc'].includes(stored))mode=stored;}catch{}
 const node=container.ownerDocument.createElement('label');node.className='display-mode';node.textContent='Görünüm';
 const select=container.ownerDocument.createElement('select');select.setAttribute('aria-label','Görünüm');
 for(const [id,name] of [['auto','Otomatik'],['phone','Telefon'],['pc','PC']]){const option=container.ownerDocument.createElement('option');option.value=id;option.textContent=name;select.append(option);}
 select.value=mode;node.append(select);container.append(node);
 function apply(){root.dataset.viewMode=mode;root.dataset.layout=mode==='auto'?(media?.matches?'phone':'pc'):mode;}
 select.addEventListener('change',()=>{mode=select.value;try{storage?.setItem('nar.displayMode',mode);}catch{}apply();});
 media?.addEventListener?.('change',apply);apply();
 return ()=>{media?.removeEventListener?.('change',apply);node.remove();};
}
