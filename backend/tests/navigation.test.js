import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {screens,navigationGroups,searchScreens,availableScreens} from '../public/navigation-catalog.js';
import {mountNavigationSearch} from '../public/navigation-search.js';
import {mountWorkspaceNavigation} from '../public/workspace-navigation.js';
const owner={id:'1',permissions:[...new Set(screens.map(row=>row.permission))]};
test('ekran araması Türkçe/ASCII eşleşir ve yetkisiz sonuçları göstermez',()=>{
  assert.equal(searchScreens(owner,'VERESİYE')[0].id,'parties');
  assert.equal(searchScreens(owner,'tedarikci')[0].id,'suppliers');
  assert.ok(searchScreens(owner,'fatura').some(row=>row.id==='purchases'));
  assert.ok(searchScreens(owner,'siparis').some(row=>row.id==='sales'));
  const waiter={id:'2',permissions:['tables.read','orders.write']};
  assert.equal(searchScreens(waiter,'veresiye').length,0);assert.equal(searchScreens(waiter,'kasa').length,0);
  assert.deepEqual(availableScreens(waiter).map(row=>row.id).sort(),['approvals','assistant','sales','tables']);
});

test('bölümler tek tek açılır; menüde gezinmek veya açık ekranı seçmek taslağı değiştirmez',()=>{
  const ids=new Set(navigationGroups.map(group=>group.id));assert.equal(ids.size,navigationGroups.length);assert.ok(screens.every(screen=>ids.has(screen.group)));
  const orderedIds=navigationGroups.flatMap(group=>group.screenIds);assert.equal(new Set(orderedIds).size,screens.length);assert.equal(orderedIds.length,screens.length);
  assert.ok(screens.every(screen=>navigationGroups.find(group=>group.id===screen.group).screenIds.includes(screen.id)));
  const dom=new JSDOM('<nav id="navigation"></nav><section id="draft">Kaydedilmemiş sipariş</section>'),host=dom.window.document.querySelector('nav'),opened=[];
  const dispose=mountWorkspaceNavigation(host,{user:owner,activeTab:'tables',openTab:id=>opened.push(id)});
  try{
    assert.equal(host.querySelectorAll('[data-navigation-group]').length,4);assert.equal(host.querySelectorAll('.workspace-direct').length,3);assert.equal(host.querySelector('[aria-current=page]').dataset.screen,'tables');
    assert.equal(host.querySelectorAll('.workspace-submenu:not([hidden])').length,1);
    assert.deepEqual([...host.querySelectorAll('#workspace-submenu-daily [data-screen]')].map(node=>node.dataset.screen),['tables','sales','kitchen']);
    host.querySelector('[data-navigation-group=management]').click();assert.deepEqual(opened,[]);assert.equal(dom.window.document.querySelector('#draft').textContent,'Kaydedilmemiş sipariş');
    assert.equal(host.querySelector('#workspace-submenu-daily').hidden,true);assert.equal(host.querySelector('#workspace-submenu-management').hidden,false);
    host.querySelector('[data-navigation-group=management]').click();assert.equal(host.querySelectorAll('.workspace-submenu:not([hidden])').length,0);
    host.querySelector('[data-navigation-group=management]').click();
    host.querySelector('[data-screen=settings]').click();assert.deepEqual(opened,['settings']);
    host.querySelector('[data-navigation-group=daily]').click();host.querySelector('[data-screen=tables]').click();assert.deepEqual(opened,['settings'],'Açık ekranı tekrar seçmek taslağı silmemeli');
  }finally{dispose();dom.window.close();}
});

test('menü rolü ve tutar sınırlı izinleri korur; boş bölümler gizli, tek ekranlar doğrudan erişilir',()=>{
  const dom=new JSDOM('<nav></nav>'),host=dom.window.document.querySelector('nav'),opened=[];
  let dispose=mountWorkspaceNavigation(host,{user:{id:'2',permissions:['tables.read','orders.write']},activeTab:'tables',openTab:id=>opened.push(id)});
  try{
    assert.deepEqual([...host.querySelectorAll('[data-navigation-group]')].map(node=>node.dataset.navigationGroup),['daily']);assert.equal(host.querySelector('[data-navigation-direct=accounts]'),null);assert.equal(host.querySelector('[data-screen=cash]'),null);
    assert.ok(host.querySelector('[data-navigation-direct=management] [data-screen=approvals]'));
    host.querySelector('[data-screen=assistant]').click();assert.deepEqual(opened,['assistant']);dispose();
    dispose=mountWorkspaceNavigation(host,{user:{id:'3',permissions:['tables.read'],permissionRules:[{code:'payments.write',amountLimitMinor:'1000',requiresApproval:false},{code:'cash.manage',amountLimitMinor:'1000',requiresApproval:false}]},activeTab:'tables',openTab:id=>opened.push(id)});
    assert.ok(host.querySelector('[data-screen=cash]'),'Sınırlı yetki önceki ekran erişim kuralını korur');
    dispose();dispose=mountWorkspaceNavigation(host,{user:{id:'4',permissions:['kitchen.write']},activeTab:'kitchen',openTab:id=>opened.push(id)});
    assert.equal(host.querySelectorAll('[data-navigation-group]').length,0);assert.equal(host.querySelectorAll('[data-screen]').length,3);
    assert.equal(host.querySelector('[data-screen=kitchen]').getAttribute('aria-current'),'page');
    host.querySelector('[data-screen=approvals]').click();assert.equal(opened.at(-1),'approvals');
  }finally{dispose();dom.window.close();}
});

test('ortak reçete hedefi bir kez gösterilir; depo yetkisi ve eski bağlantının aktifliği korunur',()=>{
  const dom=new JSDOM('<nav></nav>'),host=dom.window.document.querySelector('nav'),opened=[];
  let dispose=mountWorkspaceNavigation(host,{user:owner,activeTab:'recipes',openTab:id=>opened.push(id)});
  try{
    assert.ok(host.querySelector('[data-screen=definitions]'));assert.equal(host.querySelector('[data-screen=recipes]'),null);
    assert.equal(host.querySelector('[aria-current=page]').dataset.screen,'definitions');
    host.querySelector('[data-screen=definitions]').click();assert.deepEqual(opened,[]);
    dispose();dispose=mountWorkspaceNavigation(host,{user:{id:'5',permissions:['stock.manage']},activeTab:'recipes',openTab:id=>opened.push(id)});
    assert.equal(host.querySelector('[data-screen=definitions]'),null);assert.equal(host.querySelector('[aria-current=page]').dataset.screen,'recipes');
    assert.ok(host.querySelector('[data-screen=stock]'));
    dispose();dispose=mountWorkspaceNavigation(host,{user:owner,activeTab:'overview',openTab:id=>opened.push(id)});
    assert.equal(host.querySelectorAll('.workspace-submenu:not([hidden])').length,0);
    host.querySelector('[data-screen=reports]').click();assert.deepEqual(opened,['reports']);
  }finally{dispose();dom.window.close();}
});

test('telefon menüsü açılır/kapanır; Escape odağı döndürür ve eski belge dinleyicisi kaldırılır',()=>{
  const dom=new JSDOM('<nav></nav><button id="outside">Dışarısı</button>'),host=dom.window.document.querySelector('nav'),opened=[];
  const dispose=mountWorkspaceNavigation(host,{user:owner,activeTab:'tables',openTab:id=>opened.push(id)});
  try{
    const toggle=host.querySelector('#workspace-menu-toggle');toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
    host.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(dom.window.document.activeElement,toggle);
    toggle.click();host.querySelector('[data-navigation-group=accounts]').click();host.querySelector('[data-screen=cash]').click();assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.deepEqual(opened,['cash']);
    toggle.click();assert.equal(host.querySelector('#workspace-submenu-daily').hidden,false);assert.equal(host.querySelector('#workspace-submenu-accounts').hidden,true);
    dom.window.document.querySelector('#outside').focus();toggle.focus();host.dispatchEvent(new dom.window.FocusEvent('focusout',{relatedTarget:dom.window.document.querySelector('#outside'),bubbles:true}));assert.equal(toggle.getAttribute('aria-expanded'),'false');
    toggle.click();dom.window.document.querySelector('#outside').dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));assert.equal(toggle.getAttribute('aria-expanded'),'false');
    toggle.click();dispose();dom.window.document.querySelector('#outside').dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));assert.equal(toggle.getAttribute('aria-expanded'),'true','Eski menünün belge dinleyicisi temizlenir');
  }finally{dispose();dom.window.close();}
});
test('arama tek seçimle ekran açar, klavyeyi ve temizlenen Ctrl+K bağlantısını destekler',()=>{
  const dom=new JSDOM('<main><div id="search"></div><input id="other"></main>');const previous=globalThis.document;globalThis.document=dom.window.document;
  let dispose;try{
    const opened=[],help=[];dispose=mountNavigationSearch(document.querySelector('#search'),{user:owner,openTab:id=>opened.push(id),onHelp:text=>help.push(text)});
    const input=document.querySelector('#screen-search');input.value='veresiye';input.dispatchEvent(new dom.window.Event('input'));
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.deepEqual(opened,['parties']);assert.equal(input.getAttribute('aria-expanded'),'false');
    input.value='zzzzzz';input.dispatchEvent(new dom.window.Event('input'));input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));assert.equal(opened.length,1);
    document.querySelector('#screen-help').click();assert.deepEqual(help,['zzzzzz']);
    document.querySelector('#other').focus();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true,cancelable:true}));assert.equal(document.activeElement,input);
    input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(document.querySelector('#screen-results').hidden,true);
    dispose();document.querySelector('#other').focus();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true}));assert.equal(document.activeElement.id,'other');
    dispose=mountNavigationSearch(document.querySelector('#search'),{user:owner,openTab:id=>opened.push(id),onHelp:()=>{},showHelp:false});assert.equal(document.querySelector('#screen-help'),null);
    const compact=document.querySelector('#screen-search');compact.value='kasa';compact.dispatchEvent(new dom.window.Event('input'));compact.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));assert.equal(opened.at(-1),'cash');
  }finally{dispose?.();globalThis.document=previous;dom.window.close();}
});
