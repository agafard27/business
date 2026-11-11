import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer,request as httpsRequest} from 'node:https';
import {createApp} from '../src/app.js';
import {allowedRequestHost,isPrivateIPv4,createNetworkManager,loadNetworkTLS} from '../src/network.js';
import {mutationGuard} from '../src/auth/routes.js';
const exec=promisify(execFile);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settled(manager){for(let i=0;i<250;i++){if(!['activating','deactivating'].includes(manager.status().phase))return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('Network job must settle');}
async function temporary(t){const directory=await mkdtemp(path.join(tmpdir(),'nar-network-'));t.after(async()=>{const resolved=path.resolve(directory);assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep+'nar-network-'));await rm(resolved,{recursive:true,force:true});});return directory;}
const requestFor=(host,{secure=true,remote='192.168.7.4',port=5443,origin='https://'+host,extra={}}={})=>({secure,protocol:secure?'https':'http',socket:{remoteAddress:remote,localPort:port},app:{locals:{networkPolicy:{active:true,authority:'192.168.7.5:5443',port:5443}}},get:name=>({host,origin,'x-nar-request':'1',...extra})[name],is:type=>type==='application/json'});
function guarded(req){let status=200;mutationGuard(req,{status(code){status=code;return this;},json(){}},()=>{});return status;}
test('LAN yalnız kayıtlı HTTPS host/port ve aynı kaynakla kabul edilir; proxy başlıkları yetki vermez',()=>{
 assert.equal(isPrivateIPv4('192.168.7.5'),true);for(const ip of ['127.0.0.1','8.8.8.8','192.168.999.1','172.32.1.1','192.168.01.x'])assert.equal(isPrivateIPv4(ip),false);
 const valid=requestFor('192.168.7.5:5443');assert.equal(allowedRequestHost(valid),true);assert.equal(guarded(valid),200);
 assert.equal(guarded(requestFor('192.168.7.5:5443',{origin:null})),403);
 assert.equal(guarded(requestFor('192.168.7.5:5443',{origin:'https://other.invalid'})),403);
 assert.equal(guarded(requestFor('192.168.7.6:5443')),403);
 assert.equal(guarded(requestFor('192.168.7.5:5443',{secure:false,extra:{'x-forwarded-proto':'https'}})),403);
 assert.equal(guarded(requestFor('127.0.0.1:5443')),403);
 assert.equal(guarded(requestFor('192.168.7.5:5443',{extra:{'sec-fetch-site':'cross-site'}})),403);
});
test('ağ etkinleştirme tekrar anahtarı, revision, ip değişimi, iptal ve yeniden açılışı korur',async t=>{
 const directory=await temporary(t),servers=[];let prepared=0,ip='192.168.7.5';
 const listen=()=>{const server=new EventEmitter();server.closeAllConnections=()=>{};server.close=callback=>{server.closed=true;callback?.();};server.listen=(port,address,callback)=>{server.address=address;servers.push(server);callback();};return server;};
 const options={directory,listen,addresses:()=>[ip],readTLS:async()=>({options:{},certificateSha256:'test-public-fingerprint',expiresAtUtc:'2030-01-01T00:00:00Z'}),prepare:async()=>{prepared++;await writeFile(path.join(directory,'tls.json'),'{}');return {address:ip};}};
 const manager=createNetworkManager(options);await manager.initialize({locals:{}});
 const command={requestKey:randomUUID(),revision:'1',action:'activate',trustedNetwork:true};
 manager.start(command,{id:'1'});assert.equal(manager.start(command,{id:'1'}).phase,'activating');
 assert.throws(()=>manager.start({...command,requestKey:randomUUID()},{id:'1'}),{code:'NETWORK_BUSY'});
 await settled(manager);assert.equal(prepared,1);assert.equal(manager.status().active,true);
 manager.start(command,{id:'1'});assert.equal(prepared,1);
 assert.throws(()=>manager.start(command,{id:'2'}),{code:'REQUEST_KEY_REUSED'});
 assert.throws(()=>manager.start({...command,requestKey:randomUUID()},{id:'1'}),{code:'REVISION_CONFLICT'});
 ip='192.168.8.5';manager.start({...command,requestKey:randomUUID(),revision:manager.status().revision},{id:'1'});await settled(manager);
 assert.equal(servers[0].closed,true);assert.equal(servers[1].address,ip);
 await manager.close();const restored=createNetworkManager(options);await restored.initialize({locals:{}});assert.equal(restored.status().active,true);
 restored.start({requestKey:randomUUID(),revision:restored.status().revision,action:'deactivate'},{id:'1'});await settled(restored);assert.equal(restored.status().active,false);await restored.close();
 const disabled=createNetworkManager(options);await disabled.initialize({locals:{}});assert.equal(disabled.status().active,false);await disabled.close();
 const cancelled=createNetworkManager({...options,prepare:async()=>{throw new Error('private OS detail');}});await cancelled.initialize({locals:{}});cancelled.start({...command,requestKey:randomUUID(),revision:cancelled.status().revision},{id:'1'});await settled(cancelled);assert.equal(cancelled.status().phase,'failed');assert.ok(!JSON.stringify(cancelled.status()).includes('private OS detail'));await cancelled.close();
});
test('ağ API oturum/yetki, yerel ana bilgisayar ve CSRF ister',async t=>{
 const token=randomBytes(32).toString('base64url');let user={id:'1',permissions:['settings.manage']},calls=0;
 const manager={status:()=>({phase:'inactive',active:false,revision:'1'}),start:()=>{calls++;return {phase:'activating'};}};
 const app=createApp({status:()=>({ready:true})},{networkManager:manager,authService:{authenticate:async value=>value===token?user:null}});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port,cookie='nar_session='+token;
 assert.equal((await fetch(base+'/api/network')).status,401);
 user={...user,permissions:[]};assert.equal((await fetch(base+'/api/network',{headers:{Cookie:cookie}})).status,403);user={...user,permissions:['settings.manage']};
 assert.equal((await fetch(base+'/api/network',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-Nar-Request':'1',Origin:'https://other.invalid'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/network',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-Nar-Request':'1',Origin:base},body:'{}'})).status,200);assert.equal(calls,1);
});
test('gerçek TLS el sıkışması Secure çerezi ve LAN kaynak kuralını doğrular',async t=>{
 const directory=await temporary(t),secret=randomBytes(32).toString('base64url');
 const openssl=process.platform==='win32'?path.join(process.env.ProgramFiles,'Git','usr','bin','openssl.exe'):'openssl';
 try{await exec(openssl,['version'],{windowsHide:true});}catch{t.skip('Bu TLS denemesi sistem OpenSSL aracını gerektirir.');return;}
 const run=args=>exec(openssl,args,{cwd:directory,windowsHide:true,env:{...process.env,NAR_TEST_TLS_SECRET:secret},maxBuffer:65536});
 await run(['req','-x509','-newkey','rsa:2048','-keyout','root.key','-out','root.cer','-days','1','-subj','/CN=Isolated-Network-Test-CA','-addext','basicConstraints=critical,CA:TRUE','-passout','env:NAR_TEST_TLS_SECRET']);
 await run(['req','-new','-newkey','rsa:2048','-keyout','server.key','-out','server.csr','-subj','/CN=127.0.0.1','-passout','env:NAR_TEST_TLS_SECRET']);
 await writeFile(path.join(directory,'ext.cnf'),'subjectAltName=IP:127.0.0.1,IP:192.168.7.5\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n');
 await run(['x509','-req','-in','server.csr','-CA','root.cer','-CAkey','root.key','-CAcreateserial','-out','server.cer','-days','1','-extfile','ext.cnf','-passin','env:NAR_TEST_TLS_SECRET']);
 await run(['pkcs12','-export','-inkey','server.key','-in','server.cer','-certfile','root.cer','-out','server.pfx','-passin','env:NAR_TEST_TLS_SECRET','-passout','env:NAR_TEST_TLS_SECRET']);
 const material=await loadNetworkTLS(directory,{address:'192.168.7.5',protectedPassphrase:'test'},async()=>secret);
 await assert.rejects(loadNetworkTLS(directory,{address:'192.168.7.6',protectedPassphrase:'test'},async()=>secret));
 const app=createApp({status:()=>({ready:true})},{authService:{login:async input=>({token:randomBytes(32).toString('base64url'),user:{id:'1'},rememberMe:input.rememberMe===true})}});
 const server=createServer(material.options,app);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const port=server.address().port,host='192.168.7.5:'+port;app.locals.networkPolicy={active:true,authority:host,port};
 const ca=await readFile(path.join(directory,'root.cer'));
 const call=(origin,rememberMe=false)=>new Promise((resolve,reject)=>{const req=httpsRequest({hostname:'127.0.0.1',port,path:'/api/auth/login',method:'POST',ca,headers:{Host:host,'Content-Type':'application/json','X-Nar-Request':'1',...(origin?{Origin:origin}:{})}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,cookie:res.headers['set-cookie']}));});req.on('error',reject);req.end(JSON.stringify({rememberMe}));});
 const success=await call('https://'+host,true);assert.equal(success.status,200);assert.match(success.cookie[0],/; Secure/);assert.match(success.cookie[0],/HttpOnly; SameSite=Strict/);assert.match(success.cookie[0],/Max-Age=2592000/);
 const ordinary=await call('https://'+host);assert.equal(ordinary.status,200);assert.match(ordinary.cookie[0],/; Secure/);assert.doesNotMatch(ordinary.cookie[0],/Max-Age|Expires=/);
 assert.equal((await call(null)).status,403);assert.equal((await call('https://other.invalid')).status,403);
});
