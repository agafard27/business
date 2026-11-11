import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createExpenseRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/',requirePermission('expenses.manage'),endpoint(()=>service.list()));
  router.post('/categories',...writeGuards('expenses.manage'),endpoint(req=>service.category(req.body,req.user.id)));
  router.post('/equipment/:id/retire',...writeGuards('expenses.manage'),endpoint(req=>service.retire(req.params.id,req.body,req.user.id)));
  router.post('/',...writeGuards('expenses.manage'),endpoint(req=>service.create(req.body,req.user.id)));
  router.post('/:id/payments',...writeGuards('expenses.manage'),endpoint(req=>service.pay(req.params.id,req.body,req.user.id)));return businessErrors(router);
}
