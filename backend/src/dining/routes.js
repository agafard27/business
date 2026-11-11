import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createDiningRouter(service,auth,monitor) {
  const router=businessRouter(auth,monitor);
  router.get('/',requirePermission('tables.read'),endpoint(()=>service.list()));
  router.post('/sections',...writeGuards('settings.manage'),endpoint(req=>service.saveSection(null,req.body,req.user.id)));
  router.patch('/sections/:id',...writeGuards('settings.manage'),endpoint(req=>service.saveSection(req.params.id,req.body,req.user.id)));
  router.post('/tables',...writeGuards('settings.manage'),endpoint(req=>service.saveTable(null,req.body,req.user.id)));
  router.post('/tables/batch',...writeGuards('settings.manage'),endpoint(req=>service.createTables(req.body,req.user.id)));
  router.patch('/tables/:id',...writeGuards('settings.manage'),endpoint(req=>service.saveTable(req.params.id,req.body,req.user.id)));
  return businessErrors(router);
}
