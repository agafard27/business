import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once, EventEmitter } from 'node:events';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword, passwordIsValid } from '../src/auth/password.js';
import { createRateLimiter, mutationGuard } from '../src/auth/routes.js';
import { createAuthService, REMEMBER_SESSION_MS } from '../src/auth/service.js';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

test('parola türetme tuzlu, sabit maliyetli ve eşzamanlı iş sayısı sınırlı', async () => {
  const password = randomBytes(20).toString('base64url');
  const first = hashPassword(password);
  const second = hashPassword(password);
  await assert.rejects(hashPassword(password), { code: 'AUTH_BUSY' });
  const [one, two] = await Promise.all([first, second]);
  assert.notEqual(one, two);
  assert.ok(!one.includes(password));
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword(randomBytes(20).toString('base64url'), one), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(passwordIsValid('a'.repeat(5)), false);
  assert.equal(passwordIsValid('a'.repeat(6)), true);
  assert.equal(passwordIsValid('a'.repeat(129)), false);
});

test('kimlik API kapalı bağlantıda güvenli hata verir, tarayıcı dışı çapraz istekleri engeller', async t => {
  let setupCalls = 0;
  const app = createApp({ status: () => ({ ready: true }) }, { authService: {
    setup: async () => { setupCalls++; throw new Error('DO_NOT_EXPOSE_DATABASE'); }
  } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = headers => fetch(`${base}/api/auth/setup`, { method: 'POST', headers, body: '{}' });
  assert.equal((await post({ 'Content-Type': 'application/json' })).status, 403);
  assert.equal((await post({ 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: 'https://other.invalid' })).status, 403);
  assert.equal((await post({ 'Content-Type': 'application/json', 'X-Nar-Request': '1', 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  let hostRejected;
  mutationGuard({ get: key => ({ host: 'other.invalid', 'x-nar-request': '1' })[key], protocol: 'http' },
    { status(code) { hostRejected = code; return this; }, json() {} }, () => assert.fail('Foreign host must be rejected'));
  assert.equal(hostRejected, 403);
  assert.equal((await post({ 'Content-Type': 'text/plain', 'X-Nar-Request': '1' })).status, 415);
  assert.equal(setupCalls, 0);
  const failure = await post({ 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: base });
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes('DO_NOT_EXPOSE_DATABASE'));
  assert.equal(setupCalls, 1);
});

test('kimlik sağlayıcısı eksikse durum adresi 503 döner', async t => {
  const server = createApp({ status: () => ({ ready: true }) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/status`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'DATABASE_UNAVAILABLE');
});

test('giriş sınırı beş denemeden sonra bekletir ve pencere dolunca açılır', () => {
  let time = 10000;
  const limit = createRateLimiter({ now: () => time });
  let passed = 0;
  let status;
  let retry;
  const req = { socket: { remoteAddress: '127.0.0.1' } };
  const res = Object.assign(new EventEmitter(), { statusCode: 401,
    set: (_key, value) => { retry = value; }, status(value) { status = value; return this; }, json() { return this; } });
  for (let index = 0; index < 6; index++) {
    limit(req, res, () => { passed++; });
    res.emit('finish');
  }
  assert.equal(passed, 5); assert.equal(status, 429); assert.equal(retry, '300');
  time += 5 * 60 * 1000;
  limit(req, res, () => { passed++; });
  assert.equal(passed, 6);
});

test('başarılı girişler hatalı giriş sınırını tüketmez', () => {
  const limit = createRateLimiter();
  let passed = 0;
  const req = { socket: { remoteAddress: '127.0.0.1' } };
  for (let index = 0; index < 10; index++) {
    const res = Object.assign(new EventEmitter(), { statusCode: 200,
      status() { assert.fail('Successful staff logins must not exhaust the failure limit'); }, set() {} });
    limit(req, res, () => { passed++; }); res.emit('finish');
  }
  assert.equal(passed, 10);
});

test('beni hatırla yalnız boolean kabul eder; geçersiz seçim DB bağlantısından önce reddedilir', async()=>{
  const auth=createAuthService({});
  for(const rememberMe of ['true','false',1,null,{}])await assert.rejects(auth.login({loginName:'owner',password:'example-only',rememberMe}),{status:400,code:'INVALID_INPUT'});
});

test('normal giriş oturum çerezi, hatırlanan giriş 30 günlük HttpOnly çerez verir; çıkış siler', async t=>{
  const app=createApp({status:()=>({ready:true})},{authService:{login:async input=>({token:randomBytes(32).toString('base64url'),user:{id:'1'},rememberMe:input.rememberMe===true}),logout:async()=>{}}});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`,post=(route,data)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Nar-Request':'1',Origin:base},body:JSON.stringify(data)});
  for(const rememberMe of [undefined,false,true]){
    const response=await post('/api/auth/login',{rememberMe}),cookie=response.headers.get('set-cookie');assert.equal(response.status,200);assert.match(cookie,/HttpOnly; SameSite=Strict/);
    if(rememberMe){assert.match(cookie,/Max-Age=2592000/);const expiry=/Expires=([^;]+)/.exec(cookie)[1];assert.ok(Math.abs(Date.parse(expiry)-Date.now()-REMEMBER_SESSION_MS)<2000);}
    else assert.doesNotMatch(cookie,/Max-Age|Expires=/);
  }
  const logout=await post('/api/auth/logout',{});assert.equal(logout.status,204);assert.match(logout.headers.get('set-cookie'),/nar_session=;.*Max-Age=0/);
});

test('giriş formu beni hatırla seçimini gönderir; parola veya token tarayıcı depolamasına yazılmaz', async()=>{
  const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  for(const setupRequired of [false,true]){
    const dom=new JSDOM('<header class="site-header"></header><main id="main"></main>',{url:'http://127.0.0.1',runScripts:'outside-only'}),calls=[];
    dom.window.AbortSignal=globalThis.AbortSignal;
    dom.window.fetch=async(url,options)=>{if(url==='/api/auth/status')return {status:200,ok:true,json:async()=>({setupRequired,user:null})};calls.push(JSON.parse(options.body));return {status:401,ok:false,json:async()=>({title:'Deneme girişi',code:'INVALID_CREDENTIALS'})};};
    try{
      dom.window.eval('const mountDisplayMode=()=>{};const businessTabs=[];const canAccessScreen=()=>false;'+source);
      await new Promise(resolve=>setImmediate(resolve));const doc=dom.window.document;
      if(setupRequired){assert.equal(doc.querySelector('#remember-me'),null);continue;}
      const choice=doc.querySelector('#remember-me');assert.equal(choice.checked,false);assert.equal(doc.querySelector('label[for=remember-me]').textContent,'Beni hatırlaBu cihazda 30 gün girişimi açık tut.');
      doc.querySelector('#login-name').value='owner';doc.querySelector('#entry-password').value='example-only';
      for(const rememberMe of [false,true]){choice.checked=rememberMe;doc.querySelector('#entry-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.at(-1).rememberMe,rememberMe);}
      assert.equal(dom.window.localStorage.length,0);assert.equal(dom.window.sessionStorage.length,0);
    }finally{dom.window.close();}
  }
});
