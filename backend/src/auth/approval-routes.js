import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
import { mutationGuard } from './routes.js';
export function createApprovalRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/',endpoint(req=>service.list(req.user.id,req.user.permissions.includes('users.manage'))));
  router.post('/',mutationGuard,endpoint(req=>service.request(req.body,req.user.id)));
  router.post('/:id/decision',...writeGuards('users.manage'),endpoint(req=>service.decide(req.params.id,req.body,req.user.id)));
  router.post('/:id/execute',...writeGuards('users.manage'),endpoint(req=>service.execute(req.params.id,req.user.id)));return businessErrors(router);
}
