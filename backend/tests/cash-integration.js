import assert from 'node:assert/strict';
import {withConnection} from '../src/database.js';

export async function checkCashHandover({config,call,json,command,cookie,ownerId,waiterId}){
  const post=async(path,payload)=>json(await call(path,command(payload),cookie));
  const data=async()=>json(await call('/api/finance/cash',undefined,cookie));
  const register=await post('/api/finance/registers',{code:'handover',name:'Devir testi'});
  const period=await post('/api/finance/shifts',{registerId:register.id,openingMinor:'25000'});
  assert.equal((await call('/api/finance/shifts',command({registerId:register.id,openingMinor:'0'}),cookie)).status,409,'An open cash register cannot be reset by opening it again');
  await withConnection(config,connection=>connection.execute('UPDATE cash_shifts SET created_at_utc=UTC_TIMESTAMP(6)-INTERVAL 3 DAY WHERE id=?',[period.id]));
  let row=(await data()).shifts.find(item=>item.id===period.id);assert.equal(row.status,'open','Date change does not close the cash register');
  const closing={revision:row.revision,countedMinor:'24900',countedPosMinor:'0',reason:'Patrona nakit teslimi'};
  const missing=await call(`/api/finance/shifts/${period.id}/close`,command(closing),cookie);assert.equal(missing.status,400);assert.equal((await missing.json()).code,'HANDOVER_REQUIRED');
  for(const recipient of [ownerId,'999999999999'])assert.equal((await call(`/api/finance/cash-sessions/${period.id}/handover`,command({...closing,toUserId:recipient}),cookie)).status,400);
  const cmd=command({...closing,toUserId:waiterId});
  const saved=await json(await call(`/api/finance/cash-sessions/${period.id}/handover`,cmd,cookie));
  assert.equal(saved.differenceMinor,'-100');assert.equal(saved.handedOverMinor,'24900');
  assert.deepEqual(await json(await call(`/api/finance/shifts/${period.id}/close`,cmd,cookie)),saved,'Lost response retry reuses the exact handover');
  row=(await data()).shifts.find(item=>item.id===period.id);
  assert.equal(row.status,'closed');assert.equal(row.recipientId,waiterId);assert.ok(row.closedByName);assert.ok(row.closedAtUtc);assert.equal(row.handoverOperationId,saved.operationId);assert.equal(row.reason,closing.reason);
  const archived=structuredClone(row);
  assert.equal((await call(`/api/finance/cash-sessions/${period.id}/handover`,command({...closing,toUserId:waiterId}),cookie)).status,409,'A second new handover cannot replace the first');
  assert.equal((await call('/api/finance/cash-movements',command({shiftId:period.id,kind:'manual_in',amountMinor:'100',reason:'Kapalı kaydı değiştirme denemesi'}),cookie)).status,409);
  const next=await post('/api/finance/shifts',{registerId:register.id,openingMinor:'0'});assert.notEqual(next.id,period.id);
  await post('/api/finance/cash-movements',{shiftId:next.id,kind:'manual_in',amountMinor:'500',reason:'Yeni kasa girişi'});
  const history=await data();assert.deepEqual(history.shifts.find(item=>item.id===period.id),archived,'Next opening and cash movements preserve previous closure');
  assert.equal(history.shifts.find(item=>item.id===next.id).expectedMinor,'500');
  assert.ok(history.movements.find(item=>item.shiftId===next.id).actorName);
  await withConnection(config,async connection=>{
    const [[audit]]=await connection.execute("SELECT COUNT(*) AS count FROM audit_events WHERE operation_id=? AND actor_user_id=? AND action_code='cash.handover'",[saved.operationId,ownerId]);assert.equal(Number(audit.count),1);
    const [[link]]=await connection.execute('SELECT closed_by_user_id,handover_to_user_id FROM cash_shifts WHERE id=?',[period.id]);assert.equal(String(link.closed_by_user_id),ownerId);assert.equal(String(link.handover_to_user_id),waiterId);
  });
}
