import {mountScreenGuide} from './screen-guide.js';
import {mountDisplayMode} from './display-mode.js';
import {screens,businessTabs,canAccessScreen} from './navigation-catalog.js';
import {mountNavigationSearch} from './navigation-search.js';
import {mountWorkspaceNavigation} from './workspace-navigation.js';
mountDisplayMode(document.querySelector('.site-header'));
const main = document.getElementById('main');
const roleNames = {owner:'İşletme sahibi',manager:'Sorumlu',cashier:'Kasiyer',waiter:'Garson',kitchen:'Mutfak / bar',stock:'Depo'};
let currentUser = null;
let activeTab = ['overview','team','products','tables','sales','kitchen','management','cash','parties','suppliers','stock','purchases','definitions','recipes','expenses','reports','approvals','imports','backups','settings','assistant'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
const tabAllowed=tab=>canAccessScreen(currentUser,tab);
let selectedGroup=null,selectedTable=null;
let disposeNavigationSearch=null,disposeWorkspaceNavigation=null,assistantQuestion='';
const customerGroups=new Map();
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const manageUsers = () => currentUser?.permissions?.includes('users.manage');
const manageCatalog = () => currentUser?.permissions?.includes('catalog.manage');
const landingTab=user=>user.permissions.includes('dashboard.read')?'overview':user.permissions.includes('tables.read')?'tables':user.permissions.includes('kitchen.write')?'kitchen':user.permissions.includes('stock.manage')?'stock':'approvals';

async function request(url, options = {}) {
  const response = await fetch(url, {cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(25000),...options,
    headers:{...(options.body ? {'Content-Type':'application/json','X-Nar-Request':'1'} : {}),...options.headers}});
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.title || 'İşlem tamamlanamadı. Lütfen yeniden dene.'); error.status = response.status; error.code = data.code; throw error; }
  return data;
}
const message = error => error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Yanıt biraz gecikti. Bağlantıyı kontrol edip yeniden dene.' : error instanceof TypeError ? 'İşletme bilgisayarına şu anda ulaşılamıyor. Biraz sonra yeniden dene.' : error.message;

async function boot() {
  try { const status = await request('/api/auth/status'); currentUser = status.user; if (currentUser) renderHome(); else renderEntry(status.setupRequired); }
  catch (error) {
    disposeNavigationSearch?.();disposeWorkspaceNavigation?.();
    main.innerHTML = `<section class="unavailable"><p class="eyebrow">İŞLETME BAĞLANTISI</p><h1>Bağlantıyı kontrol edelim.</h1><p>${html(message(error))}</p><button class="primary" id="retry">Yeniden dene</button><p><a href="/status.html">Bağlantı durumunu göster</a></p></section>`;
    document.getElementById('retry').addEventListener('click', boot);
  }
}
function passwordField(id, autocomplete) {
  return `<label for="${id}">Şifre</label><div class="password-wrap"><input id="${id}" type="password" autocomplete="${autocomplete}" minlength="6" maxlength="128" required><button class="show-password" type="button" data-reveal="${id}" aria-label="Şifreyi göster" aria-pressed="false">Göster</button></div>`;
}
function bindReveal(container) {
  container.querySelectorAll('[data-reveal]').forEach(button => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.reveal); const show = input.type === 'password';
    input.type = show ? 'text' : 'password'; button.textContent = show ? 'Gizle' : 'Göster'; button.setAttribute('aria-pressed',String(show)); button.setAttribute('aria-label',show ? 'Şifreyi gizle' : 'Şifreyi göster');
  }));
}
function renderEntry(setup) {
  selectedTable=null;
  disposeNavigationSearch?.();disposeNavigationSearch=null;disposeWorkspaceNavigation?.();disposeWorkspaceNavigation=null;
  document.body.classList.remove('order-screen');
  main.innerHTML = `<div class="entry-layout"><section class="welcome"><p class="eyebrow">${setup ? 'İLK ADIM' : 'YENİ BİR GÜN'}</p><h1>${setup ? 'İşletmemizi<br>birlikte hazırlayalım.' : 'İşinin başına,<br>kolayca dön.'}</h1><p>${setup ? 'Önce sana ait yönetici hesabını oluşturalım. Çalışanlarının hesaplarını daha sonra buradan ekleyebilirsin.' : 'Kendi hesabınla giriş yap. Kullanabileceğin alanlar hesabına göre gösterilir.'}</p><div class="entry-note">✓ Bilgilerin işletme bilgisayarında tutulur.<br>Bu ekranda başka bir programa ihtiyacın yok.</div></section><section class="form-card" aria-labelledby="entry-title"><h2 id="entry-title">${setup ? 'Yönetici hesabın' : 'Hoş geldin'}</h2><p class="intro">${setup ? 'Bu hesabın sahibi işletmenin bütün alanlarını yönetebilir.' : 'Devam etmek için kullanıcı adını ve şifreni gir.'}</p><form id="entry-form">${setup ? '<label for="display-name">Adın soyadın</label><input id="display-name" autocomplete="name" maxlength="160" required>' : ''}<label for="login-name">Kullanıcı adı</label><input id="login-name" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.\\-]{3,80}" placeholder="Örn. yonetici" required>${setup ? '<p class="field-hint">Türkçe harf ve boşluk kullanmadan bir ad seç.</p>' : ''}${passwordField('entry-password',setup ? 'new-password' : 'current-password')}${setup ? '<p class="field-hint">En az 6 karakter kullan. Bu şifreyi yalnızca sen bilmelisin.</p><label for="confirm-password">Şifreyi tekrar yaz</label><input id="confirm-password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required>' : '<label class="entry-remember" for="remember-me"><input id="remember-me" type="checkbox"><span>Beni hatırla<small>Bu cihazda 30 gün girişimi açık tut.</small></span></label>'}<div id="entry-error" class="error" role="alert"></div><button class="primary" id="entry-submit" type="submit">${setup ? 'Hesabımı oluştur' : 'Giriş yap'}</button></form><p class="form-footer">${setup ? 'Şifreni sohbete yazmana gerek yok. Kendin buraya gir.' : 'Ortak hesap yerine kendi kişisel hesabını kullan.'}</p></section></div>`;
  bindReveal(main);
  document.getElementById('entry-form').addEventListener('submit', async event => {
    event.preventDefault(); const button = document.getElementById('entry-submit'); if (button.disabled) return;
    const error = document.getElementById('entry-error'); error.textContent = '';
    const password = document.getElementById('entry-password').value;
    if (setup && password !== document.getElementById('confirm-password').value) { error.textContent = 'İki şifre aynı değil. Lütfen tekrar kontrol et.'; return; }
    button.disabled = true; button.textContent = setup ? 'Hesabın oluşturuluyor…' : 'Giriş yapılıyor…';
    const body = {loginName:document.getElementById('login-name').value.trim().toLowerCase(),password};
    if (setup) body.displayName = document.getElementById('display-name').value.trim();
    else body.rememberMe = document.getElementById('remember-me').checked;
    try { const result = await request(`/api/auth/${setup ? 'setup' : 'login'}`,{method:'POST',body:JSON.stringify(body)}); currentUser = result.user; activeTab = landingTab(currentUser); renderHome(); }
    catch (failure) {
      error.textContent = message(failure); button.disabled = false; button.textContent = setup ? 'Hesabımı oluştur' : 'Giriş yap';
      if (failure.status === 409 && setup) { error.textContent = 'Yönetici hesabı zaten oluşturulmuş. Giriş ekranına geçiliyor.'; setTimeout(boot,1500); }
    }
  });
}
function renderHome() {
  disposeNavigationSearch?.();disposeWorkspaceNavigation?.();
  document.body.classList.remove('order-screen');
  const businessTab=businessTabs.find(tab=>tab.id===activeTab);
  if ((activeTab === 'team' && !manageUsers()) || (activeTab === 'products' && !manageCatalog()) || (businessTab&&!tabAllowed(businessTab)) || (activeTab==='overview'&&!currentUser.permissions.includes('dashboard.read'))) activeTab = landingTab(currentUser);
  const screen=screens.find(item=>item.id===activeTab);
  main.innerHTML = `<div class="workspace-shell"><nav id="workspace-navigation"></nav><div class="workspace-content"><div class="page-top app-top"><div><h1 id="current-screen-title">${html(screen?.name||'İşletme')}</h1><p>Merhaba, ${html(currentUser.displayName)}.</p></div><div class="account-controls"><span class="user-label">${html(currentUser.roles.map(role => roleNames[role] || role).join(' · '))}</span><button class="text-button" id="logout">Çıkış yap</button></div></div><div id="screen-search-host"></div><div id="screen-guide"></div><section id="workspace" role="region" aria-labelledby="current-screen-title"></section></div></div>`;
  disposeWorkspaceNavigation=mountWorkspaceNavigation(document.getElementById('workspace-navigation'),{user:currentUser,activeTab,openTab});
  mountScreenGuide(document.getElementById('screen-guide'),currentUser,activeTab);
  disposeNavigationSearch=mountNavigationSearch(document.getElementById('screen-search-host'),{user:currentUser,showHelp:false,openTab:id=>{if(id!==activeTab)openTab(id);},onHelp:question=>{assistantQuestion=question;openTab('assistant');}});
  const changes=document.createElement('p');changes.className='muted';changes.setAttribute('role','status');main.querySelector('.page-top').after(changes);
  void import('/changes.js').then(module=>{if(changes.isConnected)return module.watchChanges(changes,{request,refresh:renderHome,onUnauthorized:boot});});
  const lockButton=document.createElement('button');lockButton.className='text-button';lockButton.textContent='Kilitle / kullanıcı değiştir';lockButton.addEventListener('click',()=>document.getElementById('logout').click());main.querySelector('.account-controls').append(lockButton);
  document.getElementById('logout').addEventListener('click', async event => {
    event.target.disabled = true;
    try { await request('/api/auth/logout',{method:'POST',body:'{}'}); currentUser = null; await boot(); }
    catch (error) { event.target.disabled = false; document.getElementById('workspace').innerHTML = `<p class="error" role="alert">${html(message(error))}</p>`; }
  });
  if(businessTabs.some(tab=>tab.id===activeTab&&tabAllowed(tab)))void renderBusiness();
  else if (activeTab === 'products' && manageCatalog()) void renderProducts();
  else if (activeTab === 'team' && manageUsers()) void renderTeam();
  else renderOverview();
}
function openTab(tab) {
  activeTab = tab; history.replaceState(null,'',`#${tab}`); renderHome();
}
async function renderBusiness(){
  const workspace=document.getElementById('workspace');const tab=businessTabs.find(tab=>tab.id===activeTab);
  const isCurrent=()=>workspace.isConnected&&activeTab===tab.id&&!!currentUser;
  workspace.innerHTML='<p role="status">Bilgiler getiriliyor…</p>';
  try{
    const module=await import(tab.module);if(!isCurrent())return;
    await module[tab.render](workspace,{request,message,user:currentUser,isCurrent,groupId:selectedGroup,tableDraft:selectedTable,openTab,assistantQuestion,creditCustomer:customerGroups.get(`${currentUser.id}:${selectedGroup}`),
      openCustomerGroup:(id,customer)=>{customerGroups.set(`${currentUser.id}:${id}`,customer);selectedTable=null;selectedGroup=id;openTab('sales');},
      openTable:table=>{selectedTable=table;selectedGroup=null;openTab('sales');},
      openGroup:id=>{selectedTable=null;selectedGroup=id;openTab('sales');}});
  }catch(error){
    if(!isCurrent())return;if(error.status===401)return boot();
    workspace.innerHTML=`<p class="error" role="alert">${html(message(error))}</p><button id="retry-business" class="secondary">Yeniden dene</button>`;
    document.getElementById('retry-business').addEventListener('click',renderBusiness);
  }
}
function renderOverview() {
  const workspace=document.getElementById('workspace');
  const isCurrent=()=>workspace.isConnected&&activeTab==='overview'&&!!currentUser;
  void import('/overview.js').then(module=>{if(isCurrent())return module.renderOverview(workspace,{request,message,user:currentUser,isCurrent,openTab});}).catch(error=>{if(isCurrent())workspace.textContent=message(error);});
}
async function renderProducts() {
  const workspace = document.getElementById('workspace');
  const isCurrent = () => workspace.isConnected && activeTab === 'products' && !!currentUser && manageCatalog();
  workspace.innerHTML = '<p class="loading" role="status">Ürünler getiriliyor…</p>';
  try {
    const {renderCatalog} = await import('/catalog.js');
    if (isCurrent()) await renderCatalog(workspace,{request,message,isCurrent,onUnauthorized:boot,user:currentUser});
  } catch (error) {
    if (!isCurrent()) return;
    workspace.innerHTML = `<p class="error" role="alert">${html(message(error))}</p><button id="retry-products" class="secondary">Yeniden dene</button>`;
    document.getElementById('retry-products').addEventListener('click',renderProducts);
  }
}
async function renderTeam() {
  const workspace = document.getElementById('workspace'); workspace.innerHTML = '<p class="loading" role="status">Çalışanlar getiriliyor…</p>';
  try {
    const {users,roles} = await request('/api/users'); if (activeTab !== 'team' || !currentUser) return;
    workspace.innerHTML = `<div class="team-layout"><section class="panel"><span class="small-label">EKİBİN</span><h2>Çalışan hesapları</h2><p>Her kişi kendi hesabıyla giriş yapar. Bir çalışana birden fazla görev verebilirsin.</p><div class="team-list">${users.map(user => `<article class="person"><span class="avatar" aria-hidden="true">${html(user.displayName.trim().slice(0,1).toLocaleUpperCase('tr-TR'))}</span><div><strong>${html(user.displayName)}</strong><small>${html(user.loginName)} · ${user.isActive ? 'Aktif' : 'Kapalı'}</small><small>${html(user.roles.map(role => roleNames[role] || role).join(' · '))}</small></div></article>`).join('') || '<p class="empty">Henüz çalışan eklenmemiş.</p>'}</div></section><section class="form-card"><h2>Çalışan ekle</h2><p class="intro">Kişinin kullanacağı adı, şifreyi ve görevini belirle.</p><form id="team-form"><label for="staff-name">Adı soyadı</label><input id="staff-name" autocomplete="off" maxlength="160" required><label for="staff-login">Kullanıcı adı</label><input id="staff-login" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.\\-]{3,80}" required><p class="field-hint">Türkçe harf ve boşluk kullanma.</p>${passwordField('staff-password','new-password')}<p class="field-hint">En az 6 karakter. Şifreyi bu çalışana doğrudan ilet.</p><span class="roles-label" id="role-label">Görevleri</span><div class="roles-grid" role="group" aria-labelledby="role-label">${roles.map(role => `<label class="role-choice"><input type="checkbox" name="roleCodes" value="${html(role.code)}"><span>${html(role.name || roleNames[role.code] || role.code)}</span></label>`).join('')}</div><div id="team-error" class="error" role="alert"></div><div id="team-success" class="success" role="status"></div><button class="primary" id="team-submit" type="submit">Çalışanı ekle</button></form></section></div>`;
    bindReveal(workspace);
    document.getElementById('team-form').addEventListener('submit',async event => {
      event.preventDefault(); const button = document.getElementById('team-submit'); if (button.disabled) return;
      const error = document.getElementById('team-error'); error.textContent = '';
      const roleCodes = [...event.target.querySelectorAll('[name=roleCodes]:checked')].map(input => input.value);
      if (!roleCodes.length) { error.textContent = 'En az bir görev seçmelisin.'; return; }
      button.disabled = true; button.textContent = 'Çalışan ekleniyor…';
      try {
        const displayName = document.getElementById('staff-name').value.trim();
        await request('/api/users',{method:'POST',body:JSON.stringify({displayName,loginName:document.getElementById('staff-login').value.trim().toLowerCase(),password:document.getElementById('staff-password').value,roleCodes})});
        await renderTeam(); const success = document.getElementById('team-success'); if (success) success.textContent = `${displayName} için hesap oluşturuldu.`;
      } catch (failure) { if (failure.status === 401) { await boot(); return; } error.textContent = message(failure); button.disabled = false; button.textContent = 'Çalışanı ekle'; }
    });
  } catch (error) {
    if (error.status === 401) { await boot(); return; }
    workspace.innerHTML = `<p class="error" role="alert">${html(message(error))}</p><button id="retry-team" class="secondary">Yeniden dene</button>`;
    document.getElementById('retry-team').addEventListener('click',renderTeam);
  }
}
void boot();
