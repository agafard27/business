import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createBackupRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.get('/',requirePermission('settings.manage'),endpoint(()=>service.status()));
  router.post('/run',...writeGuards('settings.manage'),endpoint(req=>service.run(req.user.id)));return businessErrors(router);
}
