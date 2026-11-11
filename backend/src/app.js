import {networkHostGuard} from './network.js';
import {createNetworkRouter} from './network-routes.js';
import {createAssistantRouter} from './assistant/routes.js';
﻿import express from 'express';
import {createSettingsRouter} from './business/settings.js';
import { randomUUID } from 'node:crypto';
import { publicPath } from './paths.js';
import { log } from './log.js';
import { createAuthRouter } from './auth/routes.js';
import { createChangeRouter } from './business/changes.js';
import { createCatalogRouter } from './catalog/routes.js';
import { createDiningRouter } from './dining/routes.js';
import { createSalesRouter } from './sales/routes.js';
import { createFinanceRouter } from './finance/routes.js';
import { createDefinitionRouter } from './catalog/definition-routes.js';
import { createStockRouter } from './stock/routes.js';
import { createPurchasingRouter } from './purchasing/routes.js';
import { createKitchenRouter } from './kitchen/routes.js';
import { createExpenseRouter } from './expenses/routes.js';
import { createReportRouter } from './reports/routes.js';
import { createAuthManagementRouter } from './auth/management-routes.js';
import { createApprovalRouter } from './auth/approval-routes.js';
import { createImportRouter } from './imports/routes.js';
import { createBackupRouter } from './backup/routes.js';
import { createFileRouter } from './files/routes.js';

export function createApp(monitor, { schemaInspector, authService, catalogService, diningService, salesService, paymentService, financeService, definitionService, stockService, purchasingService, kitchenService, expenseService, reportService, authManagementService, approvalService, importService, backupService, fileService, changeService, settingsService, assistantService, networkManager, extend } = {}) {
  const app = express();
  const startedAtUtc=new Date().toISOString();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.traceId = randomUUID();
    res.set({ 'X-Request-Id': req.traceId, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    next();
  });
  app.use(networkHostGuard);
  app.use(['/api/imports/inspect','/api/imports/stage','/api/files'],express.json({limit:'8mb',strict:true}));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.get('/health/live', (_req, res) => res.json({ status: 'alive' }));
  app.get('/health/ready', (_req, res) => { const ready = monitor.status().ready; res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' }); });
  app.get('/api/system/status', (_req, res) => res.json({ application: 'Nar Çiçeği', stage: 'business-development', startedAtUtc, checkedAtUtc: new Date().toISOString(), database: monitor.status(), businessOperationsEnabled: Boolean(salesService), network:networkManager?.status()||{phase:'inactive',active:false} }));
  app.get('/api/system/database', async (req, res) => {
    const unavailable = () => res.status(503).json({ title: 'Veritabanı yapısı şu anda okunamıyor. Bağlantı durumunu kontrol edin.', traceId: req.traceId });
    if (!monitor.status().ready || typeof schemaInspector !== 'function') return unavailable();
    try { res.json(await schemaInspector()); }
    catch { unavailable(); }
  });
  app.use('/api', createAuthRouter(authService, monitor));
  app.use('/api/catalog', createCatalogRouter(catalogService, authService, monitor));
  app.use('/api/dining', createDiningRouter(diningService, authService, monitor));
  app.use('/api/sales', createSalesRouter(salesService,paymentService,authService,monitor));
  app.use('/api/finance',createFinanceRouter(financeService,authService,monitor));
  app.use('/api/definitions',createDefinitionRouter(definitionService,authService,monitor));
  app.use('/api/stock',createStockRouter(stockService,authService,monitor));
  app.use('/api/purchases',createPurchasingRouter(purchasingService,authService,monitor));
  app.use('/api/kitchen',createKitchenRouter(kitchenService,authService,monitor));
  app.use('/api/expenses',createExpenseRouter(expenseService,authService,monitor));
  app.use('/api/reports',createReportRouter(reportService,authService,monitor));
  app.use('/api/admin',createAuthManagementRouter(authManagementService,authService,monitor));
  app.use('/api/approvals',createApprovalRouter(approvalService,authService,monitor));
  app.use('/api/imports',createImportRouter(importService,authService,monitor));
  app.use('/api/backups',createBackupRouter(backupService,authService,monitor));
  app.use('/api/files',createFileRouter(fileService,authService,monitor));
  if(networkManager)app.use('/api/network',createNetworkRouter(networkManager,authService,monitor));
  app.use('/api/settings',createSettingsRouter(settingsService,authService,monitor));
  if(assistantService)app.use('/api/assistant',createAssistantRouter(assistantService,authService,monitor));
  app.use('/api/changes',createChangeRouter(changeService,authService,monitor));
  app.use(express.static(publicPath, { dotfiles: 'deny', etag: false, index: 'index.html' }));
  if (extend) extend(app);
  app.use((_req, res) => res.status(404).json({ title: 'Kayıt veya adres bulunamadı.' }));
  app.use((error, req, res, _next) => {
    if (res.headersSent) return res.destroy();
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    log('error', 'request_failed', { traceId: req.traceId, status });
    res.status(status).json({ title: status === 500 ? 'İşlem tamamlanamadı.' : 'Gönderilen veri geçersiz.', traceId: req.traceId });
  });
  return app;
}
