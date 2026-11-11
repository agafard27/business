import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createServer} from 'node:https';
import {createSecureContext} from 'node:tls';
import {networkInterfaces} from 'node:os';
import {X509Certificate,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {localPath,rootPath} from './paths.js';
import {unprotect} from './secrets.js';
import {object,key,problem} from './business/core.js';
const exec=promisify(execFile);
const fail=(code='NETWORK_SETUP_FAILED')=>problem(409,code,({NETWORK_BUSY:'Ağ kurulumu sürüyor. Durumu kontrol edin.',NETWORK_LOCAL_ONLY:'Ağ ayarını ana bilgisayarın kendi adresinden açın.',NETWORK_SETUP_FAILED:'Ağ kurulumu tamamlanamadı. Windows izin penceresini, güvenilir Wi-Fi bağlantısını ve ağ durumunu kontrol edin.',NETWORK_NOT_READY:'Ağ henüz etkin değil. Ana bilgisayardan Ağda etkinleştir kullanın.'})[code]||'Ağ ayarı geçersiz.');
export const isPrivateIPv4=value=>{if(typeof value!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(value))return false;const parts=value.split('.').map(Number);return parts.every(n=>n<=255)&&(parts[0]===10||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168));};
export function isLocalRequest(req){const ip=req.socket?.remoteAddress;return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)&&/^(127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(req.get('host')||'');}
export function allowedRequestHost(req,policy=req.app?.locals?.networkPolicy){
 const host=req.get('host')||'';
 const local=/^(127\.0\.0\.1|localhost)(?::([0-9]{1,5}))?$/.exec(host);
 if(local){const port=local[2]?Number(local[2]):req.secure?443:80;return port>0&&port<=65535&&(!req.socket?.localPort||port===req.socket.localPort)&&(!req.socket?.remoteAddress||isLocalRequest(req));}
 return Boolean(policy?.active&&req.secure&&host===policy.authority&&req.socket?.localPort===policy.port);
}
export function networkHostGuard(req,res,next){if(!allowedRequestHost(req))return res.status(403).json({code:'REQUEST_REJECTED',title:'Uygulamayı kendi etkin adresinden açın.'});next();}
async function atomicJson(file,value){await mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value),{encoding:'utf8',mode:0o600});await rename(temporary,file);}
const psQuote=value=>"'"+String(value).replaceAll("'","''")+"'";
export async function prepareWindowsNetwork({directory}){
 const script=path.join(rootPath,'backend/scripts/network-setup.ps1');
 const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',script,'-Mode','Prepare','-Directory',directory],{windowsHide:true,timeout:45000,maxBuffer:128*1024});
 const prepared=JSON.parse(stdout.replace(/^\uFEFF/,'').trim());
 if(!isPrivateIPv4(prepared.address)||!Number.isSafeInteger(prepared.interfaceIndex)||prepared.interfaceIndex<1)throw fail();
 const firewall=path.join(rootPath,'backend/scripts/network-firewall.ps1');
 // Fixed script, validated address/index, and PowerShell literals; never user supplied shell text.
 const argumentsText=['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File','"'+firewall+'"','-Address',prepared.address,'-InterfaceIndex',String(prepared.interfaceIndex),'-NodePath','"'+process.execPath+'"'].join(' ');
 const command="$ErrorActionPreference='Stop'; try {$p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList "+psQuote(argumentsText)+"; exit $p.ExitCode} catch {exit 1}";
 await exec('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{windowsHide:true,timeout:180000,maxBuffer:16384});
 return prepared;
}
export async function loadNetworkTLS(directory,record,decrypt=unprotect){
  const [pfx,cert,root]=await Promise.all([readFile(path.join(directory,'server.pfx')),readFile(path.join(directory,'server.cer')),readFile(path.join(directory,'root.cer'))]);
  const certificate=new X509Certificate(cert),rootCert=new X509Certificate(root);
  if(!certificate.checkIP(record.address)||Date.parse(certificate.validTo)<=Date.now()||!rootCert.ca||!certificate.verify(rootCert.publicKey)||Date.parse(rootCert.validTo)<=Date.now())throw fail();
  const passphrase=await decrypt(record.protectedPassphrase);
  const options={pfx,passphrase,minVersion:'TLSv1.2'};createSecureContext(options);

 return {options,certificateSha256:rootCert.fingerprint256,expiresAtUtc:new Date(certificate.validTo).toISOString()};
}
export function createNetworkManager({directory=path.join(localPath,'network'),prepare=prepareWindowsNetwork,decrypt=unprotect,addresses=()=>Object.values(networkInterfaces()).flat().filter(Boolean).map(row=>row.address),listen=createServer,readTLS=loadNetworkTLS}={}){
 const configFile=path.join(directory,'state.json');
 let app,server,policy={active:false},state={phase:'inactive',active:false},busy=false,last=null,revision=1,pendingPhase=null;
 const status=()=>({...state,phase:busy?pendingPhase:state.phase,revision:String(revision),active:policy.active,address:policy.active?'https://'+policy.authority:null,port:5443,certificateAvailable:Boolean(state.certificateSha256)});
 async function close(){if(server){const closing=server;server=null;closing.closeAllConnections();await new Promise(resolve=>closing.close(resolve));}policy={active:false};if(app)app.locals.networkPolicy=policy;}
 async function enable(record){
  if(!isPrivateIPv4(record.address)||!addresses().includes(record.address))throw fail('NETWORK_NOT_READY');
  const {options,certificateSha256,expiresAtUtc}=await readTLS(directory,record,decrypt);
  const next=listen(options,app);next.headersTimeout=10000;next.requestTimeout=15000;next.keepAliveTimeout=5000;
  try{await new Promise((resolve,reject)=>{next.once('error',reject);next.listen(5443,record.address,resolve);});}catch{next.close();throw fail();}
  server=next;policy={active:true,address:record.address,port:5443,authority:record.address+':5443'};app.locals.networkPolicy=policy;
  next.on('error',()=>{void close().then(()=>{state={...state,phase:'failed',code:'NETWORK_SETUP_FAILED'};});});
  state={phase:'active',active:true,certificateSha256,expiresAtUtc};
 }
 async function initialize(target){app=target;app.locals.networkPolicy=policy;let record;try{record=JSON.parse(await readFile(configFile,'utf8'));last=record.lastCommand||null;revision=Number.isSafeInteger(record.revision)?record.revision:1;}catch(error){if(error.code!=='ENOENT')state={phase:'failed',active:false,code:'NETWORK_SETUP_FAILED'};return;}
  if(!record.enabled)return;try{const tls=JSON.parse(await readFile(path.join(directory,'tls.json'),'utf8'));await enable({...record,...tls});}catch{state={phase:'needs-activation',active:false,code:'NETWORK_NOT_READY'};}
 }
 function start(input,user){
  object(input,['requestKey','revision','action','trustedNetwork']);const requestKey=key(input.requestKey);
  if(!['activate','deactivate'].includes(input.action)||(input.action==='activate'&&input.trustedNetwork!==true))throw problem(400,'INVALID_INPUT','Bağlandığınız ağa güvendiğinizi onaylayın.');
  const signature=JSON.stringify({actorId:user.id,revision:input.revision,action:input.action,trustedNetwork:input.trustedNetwork===true});
  if(last?.requestKey===requestKey){if(last.signature!==signature)throw problem(409,'REQUEST_KEY_REUSED','İşlem kimliği başka bir istekte kullanılmış.');return status();}
  if(busy)throw fail('NETWORK_BUSY');if(input.revision!==String(revision))throw problem(409,'REVISION_CONFLICT','Ağ ayarı değişti. Güncel durumu yükleyin.');revision++;last={requestKey,signature};busy=true;pendingPhase=input.action==='activate'?'activating':'deactivating';state={...state,phase:input.action==='activate'?'activating':'deactivating',code:null};
  void (async()=>{
   try{
    await close();await atomicJson(configFile,{enabled:false,revision,lastCommand:last});
    if(input.action==='deactivate'){state={phase:'inactive',active:false};return;}
    const prepared=await prepare({directory});const tls=JSON.parse(await readFile(path.join(directory,'tls.json'),'utf8'));
    await enable({...prepared,...tls});await atomicJson(configFile,{enabled:true,address:prepared.address,revision,lastCommand:last});
   }catch{await close();state={phase:'failed',active:false,code:'NETWORK_SETUP_FAILED'};}
   finally{busy=false;}
  })();
  return status();
 }
 return {initialize,status,start,close,certificate:()=>path.join(directory,'root.cer')};
}
