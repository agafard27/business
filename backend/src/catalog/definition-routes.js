import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createDefinitionRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/',(req,res,next)=>req.user.permissions.some(code=>['catalog.manage','stock.manage','purchases.manage'].includes(code))?next():requirePermission('catalog.manage')(req,res,next),endpoint(()=>service.meta()));
  for(const [path,method] of [['categories','category'],['units','unit'],['stations','station'],['products','product']])router.post(`/${path}`,...writeGuards('catalog.manage'),endpoint(req=>service[method](req.body,req.user.id)));
  router.post('/products/:id/options',...writeGuards('catalog.manage'),endpoint(req=>service.option(req.params.id,req.body,req.user.id)));
  router.post('/products/:id/stock-rule',...writeGuards('catalog.manage'),endpoint(req=>service.stockRule(req.params.id,req.body,req.user.id)));
  router.post('/products/:id/barcodes',...writeGuards('catalog.manage'),endpoint(req=>service.barcode(req.params.id,req.body,req.user.id)));
  router.post('/products/:id/conversions',...writeGuards('catalog.manage'),endpoint(req=>service.conversion(req.params.id,req.body,req.user.id)));
  router.post('/units/standard',...writeGuards('catalog.manage'),endpoint(req=>service.standardUnits(req.body,req.user.id)));
  router.post('/recipes',...writeGuards('stock.manage'),endpoint(req=>service.recipe(req.body,req.user.id)));
  return businessErrors(router);
}
