import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors,requireBusinessPermission } from '../business/router.js';
export function createSalesRouter(service,payments,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/menu',requireBusinessPermission('orders.write'),endpoint(req=>service.menu(req.query)));
  router.post('/favorites/:id',...writeGuards('orders.write'),endpoint(req=>service.favorite(req.params.id,req.body,req.user.id)));
  router.get('/payment-meta',requireBusinessPermission('payments.write'),endpoint(()=>payments.meta()));
  router.get('/groups',requirePermission('tables.read'),endpoint(req=>service.list(req.query)));
  router.get('/groups/:id',requirePermission('tables.read'),endpoint(req=>service.get(req.params.id)));
  router.post('/open',...writeGuards('orders.write'),endpoint(req=>service.open(req.body,req.user.id)));
  router.post('/tables/:id/orders',...writeGuards('orders.write'),endpoint(req=>service.submitForTable(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/orders',...writeGuards('orders.write'),endpoint(req=>service.submit(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/lines/:lineId/cancel',...writeGuards('settings.manage'),endpoint(req=>service.cancelLine(req.params.id,req.params.lineId,req.body,req.user.id)));
  router.post('/groups/:id/lines/:lineId/adjust',...writeGuards('settings.manage'),endpoint(req=>service.adjust(req.params.id,req.params.lineId,req.body,req.user.id)));
  router.post('/groups/:id/move',...writeGuards('orders.write'),endpoint(req=>service.move(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/merge',...writeGuards('orders.write'),endpoint(req=>service.merge(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/request-bill',...writeGuards('orders.write'),endpoint(req=>service.requestBill(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/payments',...writeGuards('payments.write'),endpoint(req=>payments.settle(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/close',...writeGuards('orders.write'),endpoint(req=>payments.closeEmpty(req.params.id,req.body,req.user.id)));
  router.post('/groups/:id/refunds',...writeGuards('settings.manage'),endpoint(req=>payments.refund(req.params.id,req.body,req.user.id)));
  return businessErrors(router);
}
