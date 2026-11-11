import {Router} from 'express';
import {createSessionGuard,requirePermission,mutationGuard} from './auth/routes.js';
import {isLocalRequest} from './network.js';
export function createNetworkRouter(manager,auth,monitor){
 const router=Router();router.use(createSessionGuard(auth,monitor),requirePermission('settings.manage'));
 const local=(req,res,next)=>isLocalRequest(req)?next():res.status(403).json({code:'NETWORK_LOCAL_ONLY',title:'Bu ayarı ana bilgisayarın kendi adresinden açın.'});
 router.get('/',(req,res)=>res.json({...manager.status(),canConfigure:isLocalRequest(req)}));
 router.get('/certificate',local,(req,res,next)=>{if(!manager.status().certificateAvailable)return res.status(409).json({code:'NETWORK_NOT_READY',title:'Önce ağı etkinleştirin.'});res.download(manager.certificate(),'Nar-Cicegi-Ag-Sertifikasi.cer',error=>{if(error)next(error);});});
 router.post('/',mutationGuard,local,(req,res,next)=>{try{res.json(manager.start(req.body,req.user));}catch(error){next(error);}});
 router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||409).json({code:error.code||'NETWORK_SETUP_FAILED',title:error.title||'Ağ kurulumu tamamlanamadı.'});});
 return router;
}
