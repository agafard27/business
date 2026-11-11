import assert from 'node:assert/strict';
export async function checkStockTracking({call,json,command,cookie,waiterCookie}){
  const post=(path,data)=>call(path,command(data),cookie).then(json),get=path=>call(path,undefined,cookie).then(json);
  const meta=await get('/api/definitions'),unit=meta.units.find(row=>row.code==='adet'),warehouse=meta.warehouses[0];
  const product=await post('/api/definitions/products',{code:'tracking-repair',name:'Takip denemesi',type:'ready',unitId:unit.id,stockMode:'none',stockTiming:'manual',trackLots:false});
  const option=await post(`/api/definitions/products/${product.id}/options`,{revision:'1',code:'one',name:'Adet',unitId:unit.id,priceMinor:'100',basisQuantity:'1',requiresWeight:false,components:[]});
  await post('/api/stock/movements',{kind:'opening',warehouseId:warehouse.id,productId:product.id,quantity:'300',totalCostMinor:'3000',reason:'Doğrulanmış başlangıç'});
  const balance=async id=>(await get('/api/stock')).balances.find(row=>row.productId===id&&row.warehouseId===warehouse.id)?.quantity||'0.000000';
  let group=(await post('/api/sales/open',{tableId:null})).group;
  for(const quantity of ['7','5'])group=(await post(`/api/sales/groups/${group.id}/orders`,{revision:group.revision,warehouseId:warehouse.id,items:[{optionId:option.id,quantity}]})).group;
  assert.equal(await balance(product.id),'300.000000');
  const repair=command({productId:product.id,warehouseId:warehouse.id,revision:'2',expectedQuantity:'300',historicalLineIds:group.lines.map(row=>row.id),reason:'Takipsiz satışları dayanaklarıyla tamamlama'});
  assert.equal((await call('/api/stock/sales-tracking',repair,waiterCookie)).status,403);
  const incomplete=await call('/api/stock/sales-tracking',{...repair,requestKey:crypto.randomUUID(),historicalLineIds:[repair.historicalLineIds[0]]},cookie);assert.equal(incomplete.status,409);assert.equal(await balance(product.id),'300.000000');
  const fixed=await json(await call('/api/stock/sales-tracking',repair,cookie));assert.equal(fixed.quantity,'288.000000');assert.deepEqual(await json(await call('/api/stock/sales-tracking',repair,cookie)),fixed);assert.equal(await balance(product.id),'288.000000');
  const order=command({revision:group.revision,warehouseId:warehouse.id,items:[{optionId:option.id,quantity:'2'}]});group=(await json(await call(`/api/sales/groups/${group.id}/orders`,order,cookie))).group;
  await json(await call(`/api/sales/groups/${group.id}/orders`,order,cookie));assert.equal(await balance(product.id),'286.000000','A replay cannot consume stock twice');
  group=(await post(`/api/sales/groups/${group.id}/orders`,{revision:group.revision,warehouseId:warehouse.id,items:[{optionId:option.id,quantity:'300'}]})).group;
  const pending=group.lines.at(-1);assert.equal(pending.stockIssue.code,'INSUFFICIENT_STOCK');assert.equal(await balance(product.id),'286.000000','A valid sale is kept without inventing negative physical stock');
  assert.ok((await get('/api/stock')).issues.some(row=>row.lineId===pending.id));
  await post('/api/stock/movements',{kind:'count',warehouseId:warehouse.id,productId:product.id,quantity:'400',expectedQuantity:'286',totalCostMinor:'1140',reason:'Doğrulanmış ek stok sayımı'});
  const retry=command({warehouseId:warehouse.id});assert.equal((await json(await call(`/api/stock/issues/${pending.id}/retry`,retry,cookie))).resolved,true);await json(await call(`/api/stock/issues/${pending.id}/retry`,retry,cookie));assert.equal(await balance(product.id),'100.000000');assert.ok(!(await get('/api/stock')).issues.some(row=>row.lineId===pending.id));
  group=(await get(`/api/sales/groups/${group.id}`)).group;
  group=(await post(`/api/sales/groups/${group.id}/orders`,{revision:group.revision,warehouseId:warehouse.id,items:[{optionId:option.id,quantity:'200'}]})).group;
  const cancelled=group.lines.at(-1);await post(`/api/sales/groups/${group.id}/lines/${cancelled.id}/cancel`,{revision:group.revision,reason:'Hazırlanmadan iptal'});assert.equal((await call(`/api/stock/issues/${cancelled.id}/retry`,command({warehouseId:warehouse.id}),cookie)).status,409);
  // The stock receipt and tracking switch form a single transaction.
  const auto=await post('/api/definitions/products',{code:'auto-stock',name:'Otomatik başlangıç takibi',type:'ready',unitId:unit.id,stockMode:'none',stockTiming:'manual',trackLots:false});
  await post(`/api/definitions/products/${auto.id}/options`,{revision:'1',code:'one',name:'Adet',unitId:unit.id,priceMinor:'100',basisQuantity:'1',requiresWeight:false,components:[]});
  await post('/api/stock/movements',{kind:'opening',warehouseId:warehouse.id,productId:auto.id,quantity:'10',totalCostMinor:'100',reason:'Başlangıç ve açık takip tercihi',trackOnSale:true});assert.equal((await get('/api/definitions')).products.find(row=>row.id===auto.id).stockMode,'direct');
  const make=async(code)=>post('/api/definitions/products',{code,name:code,type:'ingredient',unitId:unit.id,stockMode:'direct',stockTiming:'manual',trackLots:false});
  const a=await make('tost-ingredient-a'),b=await make('tost-ingredient-b');await post('/api/stock/movements',{kind:'opening',warehouseId:warehouse.id,productId:a.id,quantity:'5',totalCostMinor:'500',reason:'Malzeme sayımı'});
  const toast=await post('/api/definitions/products',{code:'made-to-order',name:'Sipariş üzerine tost',type:'prepared',unitId:unit.id,stockMode:'recipe',stockTiming:'submission',trackLots:false});
  const recipe=await post('/api/definitions/recipes',{productId:toast.id,name:'İki malzemeli deneme',outputQuantity:'1',ingredients:[{productId:a.id,quantity:'0.5'},{productId:b.id,quantity:'1'}]});
  const toastOption=await post(`/api/definitions/products/${toast.id}/options`,{revision:'1',code:'one',name:'Tost',unitId:unit.id,priceMinor:'1000',basisQuantity:'1',requiresWeight:false,recipeVersionId:recipe.versionId,components:[]});
  let made=(await post('/api/sales/open',{tableId:null})).group;made=(await post(`/api/sales/groups/${made.id}/orders`,{revision:made.revision,warehouseId:warehouse.id,items:[{optionId:toastOption.id,quantity:'1'}]})).group;
  assert.equal(made.lines[0].stockIssue.code,'INSUFFICIENT_STOCK');assert.equal(await balance(a.id),'5.000000','Failed second ingredient rolls back first ingredient only, not the sale');assert.equal(await balance(toast.id),'0.000000','Made-to-order products require no finished-product inventory');
  const paymentMeta=await get('/api/sales/payment-meta');const paid=await post(`/api/sales/groups/${made.id}/payments`,{revision:made.revision,method:'card',amountMinor:made.remainingMinor,shiftId:paymentMeta.shifts[0].id});assert.equal(paid.group.status,'closed','A pending stock issue does not block checkout');
  await post('/api/stock/movements',{kind:'opening',warehouseId:warehouse.id,productId:b.id,quantity:'5',totalCostMinor:'500',reason:'Doğrulanmış ikinci malzeme'});
  await post(`/api/stock/issues/${made.lines[0].id}/retry`,{warehouseId:warehouse.id});assert.equal(await balance(a.id),'4.500000');assert.equal(await balance(b.id),'4.000000');assert.equal(await balance(toast.id),'0.000000');

}
