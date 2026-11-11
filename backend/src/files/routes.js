import { mutationGuard } from '../auth/routes.js';
import { businessRouter,businessErrors } from '../business/router.js';
export function createFileRouter(service,auth,monitor){
  const router=businessRouter(auth,monitor);const permission=req=>['settings.manage','expenses.manage','purchases.manage'].find(permission=>req.user.permissions.includes(permission));
  router.use((req,res,next)=>permission(req)?next():res.status(403).json({code:'PERMISSION_DENIED',title:'Belgelere erişim yetkiniz yok.'}));
  router.post('/',mutationGuard,async(req,res,next)=>{try{res.json(await service.upload(req.body,req.user.id,permission(req)));}catch(error){next(error);}});
  router.get('/:id',async(req,res,next)=>{try{const file=await service.get(req.params.id);res.set({'Content-Type':file.mediaType,'Content-Disposition':'attachment; filename="belge"'}).send(file.bytes);}catch(error){next(error);}});return businessErrors(router);
}
