import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createKitchenRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/',requirePermission('kitchen.write'),endpoint(()=>service.list()));
  router.post('/:id/status',...writeGuards('kitchen.write'),endpoint(req=>service.transition(req.params.id,req.body,req.user.id)));return businessErrors(router);
}
