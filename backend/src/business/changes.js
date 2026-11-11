import { snapshot,object,problem } from './core.js';
import { businessRouter,endpoint,businessErrors } from './router.js';
export function createChangeRouter(service,auth,monitor){const router=businessRouter(auth,monitor);router.get('/',endpoint(req=>service.read(req.query,req.user)));return businessErrors(router);}
export function createChangeService(config){
  return {async read(query,user){
    object(query,['after']);const after=query.after;
    if(after!==undefined&&(typeof after!=='string'||!/^\d{1,20}$/.test(after)||BigInt(after)>18446744073709551615n))throw problem(400,'INVALID_INPUT','Güncelleme konumu geçersiz.');
    const has=permission=>user.permissions.includes(permission);const prefixes=[];
    if(has('tables.read'))prefixes.push('dining.','sales.');if(has('orders.write')||has('catalog.manage'))prefixes.push('catalog.');
    if(has('kitchen.write'))prefixes.push('kitchen.','sales.');if(has('stock.manage'))prefixes.push('stock.');if(has('cash.manage'))prefixes.push('cash.');
    if(has('parties.manage'))prefixes.push('party.');if(has('expenses.manage'))prefixes.push('expense.');if(has('purchases.manage'))prefixes.push('purchase.');
    if(has('users.manage'))prefixes.push('users.','approval.');if(has('settings.manage'))prefixes.push('import.');
    return snapshot(config,async connection=>{
      if(after===undefined||!prefixes.length){const [[latest]]=await connection.query('SELECT COALESCE(MAX(id),0) AS id FROM outbox_events');return {cursor:String(latest.id),changed:false};}
      const [rows]=await connection.execute(`SELECT id FROM outbox_events WHERE id>? AND (${[...new Set(prefixes)].map(()=> 'event_type LIKE ?').join(' OR ')}) ORDER BY id LIMIT 200`,[after,...[...new Set(prefixes)].map(prefix=>`${prefix}%`)]);
      const [[latest]]=await connection.query('SELECT COALESCE(MAX(id),0) AS id FROM outbox_events');return {cursor:rows.length===200?String(rows.at(-1).id):String(latest.id),changed:rows.length>0};
    });
  }};
}
