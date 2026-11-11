import {businessRouter,endpoint,businessErrors} from '../business/router.js';
import {mutationGuard,requirePermission} from '../auth/routes.js';
export function createAssistantRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);
  router.get('/status',endpoint(()=>service.status()));
  router.get('/configuration',requirePermission('settings.manage'),endpoint(()=>service.configuration()));
  router.post('/configuration',mutationGuard,requirePermission('settings.manage'),endpoint(req=>service.save(req.body,req.user)));
  router.post('/ask',mutationGuard,endpoint(req=>service.ask(req.body,req.user)));
  return businessErrors(router);
}
