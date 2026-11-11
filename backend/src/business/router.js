import { Router } from 'express';
import { createSessionGuard, mutationGuard, requirePermission } from '../auth/routes.js';
import { log } from '../log.js';

export function businessRouter(authService, monitor) {
  const router = Router(); router.use(createSessionGuard(authService, monitor)); return router;
}
export const endpoint = action => async (req, res, next) => { try { res.json(await action(req)); } catch (error) { next(error); } };
export const requireBusinessPermission = permission => (req,res,next) => req.user?.permissions.includes(permission)||req.user?.permissionRules?.some(rule=>rule.code===permission&&!rule.requiresApproval)
  ? next():requirePermission(permission)(req,res,next);
export const writeGuards = permission => [mutationGuard, requireBusinessPermission(permission)];
export function businessErrors(router) {
  router.use((error, req, res, _next) => {
    if (res.headersSent) return res.destroy();
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.title) return res.status(error.status).json({ code:error.code,title:error.title,traceId:req.traceId });
    const code = error.code === 'COMMIT_UNKNOWN' ? 'COMMIT_UNKNOWN' : 'DATABASE_UNAVAILABLE';
    log('error','business_request_failed',{traceId:req.traceId,code});
    res.status(503).json({code,title:code === 'COMMIT_UNKNOWN' ? 'Kayıt sonucu doğrulanamadı. Aynı işlem kimliğiyle sonucu kontrol edin.' : 'Bilgilere şu anda erişilemiyor. Bağlantıyı kontrol edin.',traceId:req.traceId});
  }); return router;
}
