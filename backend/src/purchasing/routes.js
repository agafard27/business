import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createPurchasingRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/',requirePermission('purchases.manage'),endpoint(()=>service.list()));
  router.get('/:id',requirePermission('purchases.manage'),endpoint(req=>service.get(req.params.id)));
  router.post('/',...writeGuards('purchases.manage'),endpoint(req=>service.create(req.body,req.user.id)));
  router.post('/:id/receive',...writeGuards('purchases.manage'),endpoint(req=>service.receive(req.params.id,req.body,req.user.id)));
  router.post('/:id/return',...writeGuards('purchases.manage'),endpoint(req=>service.returnGoods(req.params.id,req.body,req.user.id)));
  router.post('/:id/payments',...writeGuards('purchases.manage'),endpoint(req=>service.pay(req.params.id,req.body,req.user.id)));
  router.post('/:id/cancel',...writeGuards('purchases.manage'),endpoint(req=>service.cancelDraft(req.params.id,req.body,req.user.id)));
  return businessErrors(router);
}
