import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {localPath} from '../src/paths.js';
import {createAssistantConfig} from '../src/assistant/config.js';
import {createAssistantService} from '../src/assistant/service.js';
import {createAssistantRouter} from '../src/assistant/routes.js';
import express from 'express';
import {once} from 'node:events';
const fakeKey='sk-TEST_ONLY_NOT_A_REAL_KEY_1234567890';
test('asistan ayarı gizli değer döndürmez; tekrar ve eşzamanlı güncellemeyi denetler',async()=>{
  await mkdir(localPath,{recursive:true});const directory=await mkdtemp(path.join(localPath,'assistant-test-'));
  // Encryption is injected here; live Windows uses DPAPI, never this test codec.
  const config=createAssistantConfig({directory,seal:async text=>Buffer.from(text).toString('base64'),unseal:async text=>Buffer.from(text,'base64').toString()});
  try{
    assert.equal((await config.status()).configured,false);
    const command={requestKey:randomUUID(),revision:'0',enabled:true,apiKey:fakeKey};const saved=await config.save(command,'1');
    assert.equal(saved.configured,true);assert.ok(!JSON.stringify(saved).includes(fakeKey));assert.ok(!(await readFile(path.join(directory,'assistant.json'),'utf8')).includes(fakeKey));
    assert.deepEqual(await config.save(command,'1'),saved);await assert.rejects(config.save({...command,enabled:false},'1'),{code:'REQUEST_KEY_REUSED'});
    const updates=await Promise.allSettled([false,true].map(enabled=>config.save({requestKey:randomUUID(),revision:saved.revision,enabled,apiKey:''},'1')));assert.equal(updates.filter(row=>row.status==='fulfilled').length,1);assert.equal(updates.find(row=>row.status==='rejected').reason.code,'REVISION_CONFLICT');
    assert.equal((await config.read()).apiKey,fakeKey);
  }finally{const resolved=path.resolve(directory);assert.ok(resolved.startsWith(path.resolve(localPath)+path.sep)&&path.basename(resolved).startsWith('assistant-test-'));await rm(resolved,{recursive:true,force:true});}
});
test('yapay zekâ yalnız yetkili kullanım rehberini gönderir; kayıt/araç erişimi ve otomatik tekrar yoktur',async()=>{
  const user={id:'2',permissions:['tables.read','orders.write']};let calls=0,body;
  const service=createAssistantService({config:{read:async()=>({enabled:true,apiKey:fakeKey})},fetcher:async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.redirect,'error');body=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Masalar ekranında Adisyon aç düğmesine bas.'}]}]})};}});
  const result=await service.ask({question:'Adisyon nasıl açılır?'},user);assert.ok(result.answer);assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.instructions.includes('Kasa teslim edilene'),false);assert.equal(body.instructions.includes('Müşteri ekle veya'),false);assert.ok(result.screens.every(row=>['tables','sales','assistant'].includes(row.id)));
  await assert.rejects(service.ask({question:'kasa',screenId:'cash'},user),{status:403});assert.equal(calls,1);
  for(let i=0;i<4;i++)await service.ask({question:'sipariş'},user);await assert.rejects(service.ask({question:'sipariş'},user),{status:429});assert.equal(calls,5);
  let failures=0;const offline=createAssistantService({config:{read:async()=>({enabled:true,apiKey:fakeKey})},fetcher:async()=>{failures++;throw Error(fakeKey);}});await assert.rejects(offline.ask({question:'yardım'},user),error=>error.code==='ASSISTANT_CONNECTION'&&!JSON.stringify(error).includes(fakeKey));assert.equal(failures,1);
  const unconfigured=createAssistantService({config:{read:async()=>({enabled:false,apiKey:''})},fetcher:()=>assert.fail('No external request before setup')});await assert.rejects(unconfigured.ask({question:'yardım'},user),{code:'ASSISTANT_NOT_CONFIGURED'});
});
test('asistan HTTP oturum, yönetici yetkisi ve çapraz istek denetimlerini uygular',async t=>{
  let user=null;const service={status:async()=>({configured:false}),configuration:async()=>({hasKey:false}),save:async()=>({saved:true}),ask:async()=>({answer:'test',screens:[]})};
  const app=express();app.use(express.json());app.use('/api/assistant',createAssistantRouter(service,{authenticate:async()=>user},{status:()=>({ready:true})}));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/api/assistant/status')).status,401);user={id:'2',permissions:['orders.write']};assert.equal((await fetch(base+'/api/assistant/configuration')).status,403);
  const options={method:'POST',headers:{'Content-Type':'application/json','X-Nar-Request':'1',Origin:base},body:'{}'};
  assert.equal((await fetch(base+'/api/assistant/configuration',options)).status,403);assert.equal((await fetch(base+'/api/assistant/ask',{...options,headers:{...options.headers,Origin:'https://other.invalid'}})).status,403);
  assert.equal((await fetch(base+'/api/assistant/ask',options)).status,200);user={id:'1',permissions:['settings.manage']};assert.equal((await fetch(base+'/api/assistant/configuration',options)).status,200);
});
