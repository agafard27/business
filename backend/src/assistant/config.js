import {readFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {localPath} from '../paths.js';
import {protect,unprotect} from '../secrets.js';
import {object,key,problem} from '../business/core.js';
export const assistantModel='gpt-6-luna';
export function createAssistantConfig({directory=localPath,seal=protect,unseal=unprotect}={}){
  const file=path.join(directory,'assistant.json');let queue=Promise.resolve();
  async function read(){
    try{const row=JSON.parse(await readFile(file,'utf8'));if(row.version!==1||typeof row.sealed!=='string'||typeof row.revision!=='string')throw Error();const value=JSON.parse(await unseal(row.sealed));if(typeof value.enabled!=='boolean'||typeof value.apiKey!=='string')throw Error();return {...row,...value};}
    catch(error){if(error.code==='ENOENT')return {revision:'0',enabled:false,apiKey:'',lastRequestKey:null,hash:null};throw problem(409,'ASSISTANT_CONFIG_ERROR','Yapay zekâ ayarı bu Windows hesabında okunamıyor.');}
  }
  const publicValue=row=>({revision:row.revision,enabled:row.enabled,hasKey:Boolean(row.apiKey),configured:row.enabled&&Boolean(row.apiKey),model:assistantModel,updatedAtUtc:row.updatedAtUtc??null});
  async function saveInternal(input,actorId){
    object(input,['requestKey','revision','enabled','apiKey']);key(input.requestKey);
    if(typeof input.revision!=='string'||typeof input.enabled!=='boolean'||typeof input.apiKey!=='string'||(input.apiKey&&!/^sk-[A-Za-z0-9_-]{20,500}$/.test(input.apiKey)))throw problem(400,'INVALID_INPUT','Bağlantı bilgilerini kontrol edin.');
    const hash=createHash('sha256').update(JSON.stringify([String(actorId),input.revision,input.enabled,input.apiKey])).digest('hex'),previous=await read();
    if(previous.lastRequestKey===input.requestKey){if(previous.hash!==hash)throw problem(409,'REQUEST_KEY_REUSED','İşlem kimliği başka bir ayar için kullanılmış.');return publicValue(previous);}
    if(previous.revision!==input.revision)throw problem(409,'REVISION_CONFLICT','Ayar değişti. Ekranı yenileyin.');
    const apiKey=input.apiKey||previous.apiKey;if(input.enabled&&!apiKey)throw problem(400,'API_KEY_REQUIRED','Bağlantıyı açmak için API anahtarını girin.');
    const row={version:1,revision:randomUUID(),updatedByUserId:String(actorId),updatedAtUtc:new Date().toISOString(),lastRequestKey:input.requestKey,hash,sealed:await seal(JSON.stringify({enabled:input.enabled,apiKey}))};
    await mkdir(directory,{recursive:true});const temporary=path.join(directory,`assistant-${randomUUID()}.partial`);let handle;
    try{handle=await open(temporary,'wx',0o600);await handle.writeFile(JSON.stringify(row),'utf8');await handle.sync();await handle.close();handle=null;await rename(temporary,file);}
    finally{await handle?.close();await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    return publicValue({...row,enabled:input.enabled,apiKey});
  }
  return {read,status:async()=>publicValue(await read()),save(input,actorId){const result=queue.then(()=>saveInternal(input,actorId));queue=result.catch(()=>{});return result;}};
}
