import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
export async function checkPcLoad({call,json,command,cookie}){
  const post=async(path,value)=>json(await call(path,command(value),cookie));
  const menu=await json(await call('/api/sales/menu?search=Cam%20Kola',undefined,cookie));const option=menu.options[0];
  let group=(await post('/api/sales/open',{tableId:null})).group;
  const order=command({revision:group.revision,items:[{optionId:option.optionId,quantity:'1'}]});
  const started=performance.now();const replies=await Promise.all(Array.from({length:16},()=>call(`/api/sales/groups/${group.id}/orders`,order,cookie)));
  assert.ok(replies.some(response=>response.status===200));assert.ok(replies.every(response=>[200,409].includes(response.status)));
  const bodies=await Promise.all(replies.filter(response=>response.status===200).map(json));for(const body of bodies)assert.deepEqual(body,bodies[0]);
  for(const response of replies.filter(response=>response.status===409))assert.equal((await response.json()).code,'BUSY');
  const replay=await json(await call(`/api/sales/groups/${group.id}/orders`,order,cookie));assert.deepEqual(replay,bodies[0]);group=replay.group;assert.equal(group.lines.length,1);
  const reads=await Promise.all(Array.from({length:24},(_,index)=>call(index%2?`/api/sales/groups/${group.id}`:'/api/dining',undefined,cookie)));assert.ok(reads.every(response=>response.status===200));await Promise.all(reads.map(response=>response.arrayBuffer()));
  const results=await Promise.all(Array.from({length:16},()=>call(`/api/sales/groups/${group.id}/request-bill`,command({revision:group.revision}),cookie)));
  assert.equal(results.filter(response=>response.status===200).length,1,'Only one stale-revision competitor may write');assert.ok(results.every(response=>[200,409].includes(response.status)));await Promise.all(results.map(response=>response.arrayBuffer()));
  console.log(`PC yük kontrolü: 16 aynı sipariş + 24 okuma + 16 yarışan komut; ${Math.round(performance.now()-started)} ms; tek sipariş, tek sürüm ilerlemesi.`);
}
