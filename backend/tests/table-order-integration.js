import assert from 'node:assert/strict';
import {withConnection} from '../src/database.js';

export async function checkDeferredTableOrders({config,call,json,command,cookie}){
  const post=(path,input,who=cookie)=>call(path,command(input),who).then(json);
  const get=path=>call(path,undefined,cookie).then(json);
  const section=await post('/api/dining/sections',{name:'İlk sipariş masaları',sortOrder:95});
  const create=name=>post('/api/dining/tables',{name,sectionId:section.id,isActive:true});
  const counts=()=>withConnection(config,async connection=>{
    const [[row]]=await connection.query('SELECT (SELECT COUNT(*) FROM settlement_groups) AS groups_count,(SELECT COUNT(*) FROM checks) AS checks_count,(SELECT COUNT(*) FROM check_lines) AS lines_count,(SELECT COUNT(*) FROM table_assignments) AS assignments_count');return row;
  });
  const option=(await get('/api/sales/menu')).options.find(row=>row.name==='Çay'&&!row.requiresWeight);assert.ok(option);
  const table=await create('Taslak masası'),before=await counts(),items=[{optionId:option.optionId,quantity:'2',note:'Açık çay'}];
  const path=`/api/sales/tables/${table.id}/orders`;
  const invalid=await call(path,command({items:[...items,{optionId:'18446744073709551615',quantity:'1'}]}),cookie);assert.equal(invalid.status,409);
  assert.deepEqual(await counts(),before,'Ürün hatasında hesap, satır veya masa ataması kalmaz');
  assert.equal((await call(path,command({items:[]}),cookie)).status,400);assert.deepEqual(await counts(),before);
  assert.equal((await call(path,command({items}),cookie,'POST',{Origin:'https://other.invalid'})).status,403);
  const payload=command({items}),replies=await Promise.all([call(path,payload,cookie),call(path,payload,cookie)]);
  const created=await json(replies[0]);assert.deepEqual(await json(replies[1]),created);assert.equal(created.group.lines.length,1);assert.equal(created.group.lines[0].quantity,'2.000000');
  assert.equal(created.group.tableId,table.id);assert.equal(created.group.status,'open');assert.ok(BigInt(created.group.totalMinor)>0n);
  const after=await counts();assert.equal(Number(after.groups_count),Number(before.groups_count)+1);assert.equal(Number(after.assignments_count),Number(before.assignments_count)+1);
  assert.deepEqual(await json(await call(path,payload,cookie)),created,'Kayıp yanıttan sonra aynı ilk sipariş sonucu döner');
  assert.equal((await call(path,{...payload,items:[{optionId:option.optionId,quantity:'3'}]},cookie)).status,409);
  assert.equal((await call(path,command({items}),cookie)).status,409);assert.deepEqual(await counts(),after);
  const race=await create('Yarış masası'),racePath=`/api/sales/tables/${race.id}/orders`,raceBefore=await counts();
  const competing=await Promise.all([call(racePath,command({items}),cookie),call(racePath,command({items}),cookie)]);
  assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
  const won=await json(competing.find(response=>response.status===200));const raceAfter=await counts();assert.equal(Number(raceAfter.groups_count),Number(raceBefore.groups_count)+1);
  const regular=await post(`/api/sales/groups/${won.group.id}/orders`,{revision:won.group.revision,items});assert.equal(regular.group.lines.length,2,'Sonraki sipariş aynı hesapta kalır');
  const inactive=await create('Kaldırılan taslak masası');await json(await call(`/api/dining/tables/${inactive.id}`,command({revision:'1',isActive:false,name:'Kaldırılan taslak masası',sectionId:section.id}),cookie,'PATCH'));
  const inactiveBefore=await counts();assert.equal((await call(`/api/sales/tables/${inactive.id}/orders`,command({items}),cookie)).status,400);assert.deepEqual(await counts(),inactiveBefore);
}
