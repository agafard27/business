import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createSalesService} from '../src/sales/service.js';
import {createApp} from '../src/app.js';

test('ilk masa siparişi yanlış girişleri bağlantı açmadan reddeder',async()=>{
  const service=createSalesService({});
  const valid={requestKey:randomUUID(),items:[{optionId:'1',quantity:'1'}]};
  await assert.rejects(service.submitForTable('0',valid,'1'),{code:'INVALID_INPUT'});
  for(const input of [{...valid,items:[]},{...valid,revision:'1'},{...valid,items:[{optionId:'1',quantity:'0'}]},{...valid,items:[{optionId:'1',quantity:'1',unexpected:true}]},{...valid,warehouseId:'-1'},{...valid,requestKey:'invalid'}])await assert.rejects(service.submitForTable('1',input,'1'),{code:'INVALID_INPUT'});
});

test('ilk masa siparişi API oturum, izin ve aynı kaynak korumalarını uygular',async t=>{
  let signedIn=true,ready=true,permissions=[],calls=0;
  const authService={authenticate:async()=>signedIn?{id:'12',permissions}:null};
  const salesService={submitForTable:async(id,input,actorId)=>{calls++;return {group:{id:'99'},tableId:id,actorId};}};
  const server=createApp({status:()=>({ready})},{authService,salesService}).listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});const base='http://127.0.0.1:'+server.address().port;
  const send=(headers={})=>fetch(base+'/api/sales/tables/4/orders',{method:'POST',headers:{'Content-Type':'application/json','X-Nar-Request':'1',Origin:base,...headers},body:JSON.stringify({requestKey:randomUUID(),items:[{optionId:'1',quantity:'1'}]})});
  assert.equal((await send()).status,403);permissions=['orders.write'];signedIn=false;assert.equal((await send()).status,401);
  signedIn=true;ready=false;assert.equal((await send()).status,503);ready=true;
  assert.equal((await send({Origin:'https://other.invalid'})).status,403);assert.equal((await send({'X-Nar-Request':''})).status,403);assert.equal(calls,0);
  const response=await send();assert.equal(response.status,200);assert.deepEqual(await response.json(),{group:{id:'99'},tableId:'4',actorId:'12'});assert.equal(calls,1);
});
