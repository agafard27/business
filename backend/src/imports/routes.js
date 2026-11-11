import { requirePermission } from '../auth/routes.js';
import { businessRouter,endpoint,writeGuards,businessErrors } from '../business/router.js';
export function createImportRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);router.use(requirePermission('settings.manage'));
  router.get('/formats',endpoint(()=>service.formats()));router.get('/',endpoint(()=>service.list()));
  router.get('/template/:kind',async(req,res,next)=>{try{const buffer=await service.template(req.params.kind);res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="aktarim-sablonu.xlsx"'}).send(buffer);}catch(error){next(error);}});
  router.post('/inspect',...writeGuards('settings.manage'),endpoint(req=>service.inspect(req.body)));
  router.post('/stage',...writeGuards('settings.manage'),endpoint(req=>service.stage(req.body,req.user.id)));
  router.get('/:id',endpoint(req=>service.get(req.params.id)));
  router.post('/:id/apply',...writeGuards('settings.manage'),endpoint(req=>service.apply(req.params.id,req.body,req.user.id)));
  router.post('/:id/reverse',...writeGuards('settings.manage'),endpoint(req=>service.reverse(req.params.id,req.body,req.user.id)));
  router.post('/:id/discard',...writeGuards('settings.manage'),endpoint(req=>service.discard(req.params.id,req.body,req.user.id)));return businessErrors(router);
}
