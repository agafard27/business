import { Router } from 'express';
import { createSessionGuard, mutationGuard, requirePermission } from '../auth/routes.js';
import { log } from '../log.js';

export function createCatalogRouter(service, authService, monitor) {
  const router = Router();
  router.use(createSessionGuard(authService, monitor), requirePermission('catalog.manage'));
  const handler = action => async (req, res, next) => {
    try {
      if (!service) throw Object.assign(new Error(), { code: 'DATABASE_UNAVAILABLE' });
      res.json(await action(req));
    } catch (error) { next(error); }
  };
  router.get('/meta', handler(() => service.meta()));
  router.get('/reference-menu', handler(() => service.referenceMenu()));
  router.post('/reference-menu/import', mutationGuard, handler(req => service.importReferenceMenu(req.body, req.user.id)));
  router.get('/products', handler(req => service.listProducts(req.query)));
  router.get('/products/:id', handler(req => service.getProduct(req.params.id)));
  router.patch('/products/:id', mutationGuard, handler(req => service.updateProduct(req.params.id, req.body, req.user.id)));
  router.post('/products/:id/prices', mutationGuard, handler(req => service.updatePrice(req.params.id, req.body, req.user.id)));
  router.use((error, req, res, _next) => {
    if (res.headersSent) return res.destroy();
    if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500 && error.title) {
      return res.status(error.status).json({ code: error.code, title: error.title, traceId: req.traceId });
    }
    const code = error.code === 'COMMIT_UNKNOWN' ? 'COMMIT_UNKNOWN' : 'DATABASE_UNAVAILABLE';
    log('error', 'catalog_request_failed', { traceId: req.traceId, code });
    res.status(503).json({ code, title: code === 'COMMIT_UNKNOWN'
      ? req.path === '/reference-menu/import'
        ? 'Menü aktarımının sonucu doğrulanamadı. Listeyi yenileyin veya aktarımı aynı düğmeyle kontrol edin; ürünler ikinci kez eklenmez.'
        : 'Kaydın sonucu henüz doğrulanamadı. Sayfayı yenileyerek ürünü kontrol edin; aynı işlemi yinelerseniz mevcut işlem kimliği kullanılmalı.'
      : 'Ürün bilgilerine şu anda erişilemiyor. Bağlantı düzelince tekrar deneyin.', traceId: req.traceId });
  });
  return router;
}
