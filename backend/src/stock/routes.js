import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createStockRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/',requirePermission('stock.manage'),endpoint(()=>service.list()));
  router.post('/sales-tracking',...writeGuards('catalog.manage'),endpoint(req=>service.enableSalesTracking(req.body,req.user.id)));
  router.post('/issues/:id/retry',...writeGuards('stock.manage'),endpoint(req=>service.retryStockIssue(req.params.id,req.body,req.user.id)));
  router.post('/warehouses',...writeGuards('stock.manage'),endpoint(req=>service.createWarehouse(req.body,req.user.id)));
  router.post('/movements',...writeGuards('stock.manage'),endpoint(req=>service.movement(req.body,req.user.id)));
  router.post('/production',...writeGuards('stock.manage'),endpoint(req=>service.produce(req.body,req.user.id)));
  router.post('/transfers',...writeGuards('stock.manage'),endpoint(req=>service.transfer(req.body,req.user.id)));
  return businessErrors(router);
}
