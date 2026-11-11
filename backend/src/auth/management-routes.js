import { requirePermission } from './routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createAuthManagementRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/policy',requirePermission('users.manage'),endpoint(()=>service.policy()));
  router.patch('/users/:id',...writeGuards('users.manage'),endpoint(req=>service.updateUser(req.params.id,req.body,req.user.id)));
  router.post('/users/:id/revoke',...writeGuards('users.manage'),endpoint(req=>service.revoke(req.params.id,req.body,req.user.id)));
  router.post('/users/:id/password',...writeGuards('users.manage'),endpoint(req=>service.resetPassword(req.params.id,req.body,req.user.id)));
  router.post('/roles/:id',...writeGuards('users.manage'),endpoint(req=>service.updateRole(req.params.id,req.body,req.user.id)));return businessErrors(router);
}
