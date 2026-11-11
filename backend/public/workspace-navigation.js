import {availableScreens,navigationGroups} from './navigation-catalog.js';
import {html} from './business-ui.js';

export function mountWorkspaceNavigation(host,{user,activeTab,openTab}){
  const allowed=availableScreens(user);
  // A shared destination appears once, unless only its other permission is available.
  const visible=allowed.filter(screen=>!screen.navigationAlias||!allowed.some(row=>row.id===screen.navigationAlias));
  const groups=navigationGroups.map(group=>({...group,screens:group.screenIds.map(id=>visible.find(screen=>screen.id===id)).filter(Boolean)})).filter(group=>group.screens.length);
  const activeScreen=allowed.find(screen=>screen.id===activeTab);
  const activeId=visible.some(screen=>screen.id===activeTab)?activeTab:activeScreen?.navigationAlias;
  const activeGroup=groups.find(group=>group.screens.some(screen=>screen.id===activeId));
  let shownGroup=activeGroup?.screens.length>1?activeGroup.id:null;
  const screenLink=screen=>`<a id="${html(screen.id)}-tab" href="#${html(screen.id)}" data-screen="${html(screen.id)}" ${screen.id===activeId?'aria-current="page"':''}>${html(screen.name)}</a>`;
  host.className='workspace-navigation';host.setAttribute('aria-label','Ana menü');
  host.innerHTML=`<div class="workspace-menu-bar"><button class="secondary" type="button" id="workspace-menu-toggle" aria-expanded="false" aria-controls="workspace-menu"><span aria-hidden="true">☰</span><span class="workspace-toggle-label"> Menü</span></button><span class="workspace-location">${html(activeScreen?.name||'Ekran seç')}</span></div><div class="workspace-menu" id="workspace-menu"><p class="workspace-menu-title">İş alanları</p>${groups.map(group=>group.screens.length===1?`<div class="workspace-direct" data-navigation-direct="${html(group.id)}">${screenLink(group.screens[0])}</div>`:`<div class="workspace-group"><button type="button" data-navigation-group="${html(group.id)}" ${group.id===activeGroup?.id?'data-current-group':''} aria-expanded="${group.id===shownGroup}" aria-controls="workspace-submenu-${html(group.id)}"><span>${html(group.name)}</span><span class="workspace-chevron" aria-hidden="true">›</span></button><div class="workspace-submenu" id="workspace-submenu-${html(group.id)}" ${group.id===shownGroup?'':'hidden'}>${group.screens.map(screenLink).join('')}</div></div>`).join('')}</div>`;
  const toggle=host.querySelector('#workspace-menu-toggle');
  function setOpen(open){toggle.setAttribute('aria-expanded',String(open));host.classList.toggle('is-open',open);toggle.querySelector('.workspace-toggle-label').textContent=open?' Menüyü kapat':' Menü';}
  function showGroup(){
    host.querySelectorAll('[data-navigation-group]').forEach(button=>{
      const expanded=button.dataset.navigationGroup===shownGroup;
      button.setAttribute('aria-expanded',String(expanded));
      host.querySelector('#'+button.getAttribute('aria-controls')).hidden=!expanded;
    });
  }
  host.querySelectorAll('[data-navigation-group]').forEach(button=>button.addEventListener('click',()=>{
    shownGroup=shownGroup===button.dataset.navigationGroup?null:button.dataset.navigationGroup;showGroup();
  }));
  host.querySelectorAll('[data-screen]').forEach(link=>link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;
    event.preventDefault();setOpen(false);
    // Selecting the current destination, including an alias, preserves the draft.
    if(link.dataset.screen!==activeId)openTab(link.dataset.screen);
  }));
  toggle.addEventListener('click',()=>{
    const opening=toggle.getAttribute('aria-expanded')!=='true';
    if(opening){shownGroup=activeGroup?.screens.length>1?activeGroup.id:null;showGroup();}
    setOpen(opening);
  });
  const outside=event=>{if(!host.contains(event.target))setOpen(false);};
  const escape=event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){event.preventDefault();setOpen(false);toggle.focus();}};
  const focusOut=event=>{if(event.relatedTarget&&!host.contains(event.relatedTarget))setOpen(false);};
  const document=host.ownerDocument;document.addEventListener('pointerdown',outside);host.addEventListener('keydown',escape);host.addEventListener('focusout',focusOut);
  return ()=>{document.removeEventListener('pointerdown',outside);host.removeEventListener('keydown',escape);host.removeEventListener('focusout',focusOut);};
}
