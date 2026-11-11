import {searchScreens} from './navigation-catalog.js';
export function mountNavigationSearch(host,{user,openTab,onHelp,showHelp=true}){
  host.className='navigation-search';
  host.innerHTML='<label for="screen-search">Programda ara <span>Ctrl + K</span></label><div class="navigation-search-row"><input id="screen-search" type="search" placeholder="Ekran veya işlem ara: veresiye, kasa, fatura…" autocomplete="off" maxlength="160" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="screen-results">'+(showHelp?'<button type="button" class="secondary" id="screen-help">Program rehberi</button>':'')+'</div><div id="screen-results" role="listbox" aria-label="Bulunan ekranlar" hidden></div>';
  const input=host.querySelector('input'),results=host.querySelector('#screen-results');let rows=[],selected=-1;
  function close(){results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');selected=-1;}
  function mark(){for(const [index,node] of [...results.querySelectorAll('[role=option]')].entries())node.setAttribute('aria-selected',String(index===selected));if(selected>=0)input.setAttribute('aria-activedescendant','screen-option-'+selected);else input.removeAttribute('aria-activedescendant');}
  function show(){
    rows=searchScreens(user,input.value);selected=-1;results.replaceChildren();
    for(const [index,row] of rows.entries()){
      const button=document.createElement('button');button.type='button';button.id='screen-option-'+index;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.tabIndex=-1;
      const title=document.createElement('strong'),hint=document.createElement('small');title.textContent=row.name;hint.textContent=row.guide.split('. ')[0]+'.';button.append(title,hint);button.addEventListener('click',()=>{close();openTab(row.id);});results.append(button);
    }
    if(!rows.length){const empty=document.createElement('p');empty.textContent='Ekran bulunamadı. Başka bir kelime deneyebilir veya Program rehberini açabilirsin.';results.append(empty);}
    results.hidden=false;input.setAttribute('aria-expanded','true');
  }
  input.addEventListener('input',show);input.addEventListener('focus',show);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(results.hidden)show();if(rows.length){selected=selected<0?(event.key==='ArrowDown'?0:rows.length-1):(selected+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length;mark();}}
    if(event.key==='Enter'){event.preventDefault();if(!results.hidden&&rows.length){const row=rows[selected<0?0:selected];close();openTab(row.id);}}
  });
  host.querySelector('#screen-help')?.addEventListener('click',()=>onHelp(input.value.trim()));
  const outside=event=>{if(!host.contains(event.target))close();};
  const shortcut=event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.focus();input.select();}};
  const focusOut=event=>{if(!host.contains(event.relatedTarget))close();};host.addEventListener('focusout',focusOut);
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',shortcut);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',shortcut);};
}
