import {createNetworkManager} from './network.js';
import {createAssistantService} from './assistant/service.js';
import { loadConfig } from './config.js';
import { createMonitor, databaseProbe } from './monitor.js';
import { createApp } from './app.js';
import { log, recordStartupFailure } from './log.js';
import { readDatabaseSchema } from './schema-inspector.js';
import { createAuthService } from './auth/service.js';
import { createCatalogService } from './catalog/service.js';
import { createDiningService } from './dining/service.js';
import { createSalesService } from './sales/service.js';
import { createPaymentService } from './sales/payments.js';
import { createFinanceService } from './finance/service.js';
import { createDefinitionService } from './catalog/definitions.js';
import { createStockService } from './stock/service.js';
import { createPurchasingService } from './purchasing/service.js';
import { createKitchenService } from './kitchen/service.js';
import { createExpenseService } from './expenses/service.js';
import { createReportService } from './reports/service.js';
import { createAuthManagementService } from './auth/management.js';
import { createDefaultApprovalService } from './auth/approval-actions.js';
import { createImportService } from './imports/service.js';
import { createBackupService } from './backup/service.js';
import { createFileService } from './files/service.js';
import {createSettingsService} from './business/settings.js';
import { createChangeService } from './business/changes.js';

let server;
let networkManager;
let monitor;
let stopBackups;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  monitor?.stop();
  stopBackups?.();
  await networkManager?.close();
  const force = setTimeout(() => process.exit(code), 8000);
  force.unref();
  if (server?.listening) { await new Promise(resolve => server.close(resolve)); }
  clearTimeout(force);
  process.exit(code);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
process.on('uncaughtException', () => { void recordStartupFailure('UNCAUGHT_EXCEPTION').finally(() => shutdown(1)); });
process.on('unhandledRejection', () => { void recordStartupFailure('UNHANDLED_REJECTION').finally(() => shutdown(1)); });

try {
  let config;
  try { config = await loadConfig(); }
  catch { config = null; }
  const intervalMs = Number(process.env.NAR_DB_CHECK_MS ?? 10000);
  if (!Number.isInteger(intervalMs) || intervalMs < 500 || intervalMs > 60000) throw Object.assign(new Error(), { code: 'CONFIG_ERROR' });
  monitor = createMonitor(config ? databaseProbe(config) : async () => { throw Object.assign(new Error(), { code: 'CONFIG_ERROR' }); }, { intervalMs, staleMs: intervalMs + 10000 });
  const port = Number(process.env.PORT ?? 5080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error(), { code: 'CONFIG_ERROR' });
  const backups=config?createBackupService(config):undefined;
  networkManager=config&&process.env.NAR_DISABLE_NETWORK!=='1'?createNetworkManager():undefined;
  const app = createApp(monitor, { schemaInspector: config ? () => readDatabaseSchema(config) : undefined,
    authService: config ? createAuthService(config) : undefined,
    catalogService: config ? createCatalogService(config) : undefined,
    diningService: config ? createDiningService(config) : undefined,
    salesService: config ? createSalesService(config) : undefined,
    financeService: config ? createFinanceService(config) : undefined,
    definitionService: config ? createDefinitionService(config) : undefined,
    stockService: config ? createStockService(config) : undefined,
    purchasingService: config ? createPurchasingService(config) : undefined,
    kitchenService: config ? createKitchenService(config) : undefined,
    expenseService: config ? createExpenseService(config) : undefined,
    reportService: config ? createReportService(config) : undefined,
    authManagementService: config ? createAuthManagementService(config) : undefined,
    approvalService: config ? createDefaultApprovalService(config) : undefined,
    importService: config ? createImportService(config) : undefined,
    backupService: backups,
    fileService: config ? createFileService(config) : undefined,
    assistantService:config?createAssistantService():undefined,
    settingsService:config?createSettingsService(config):undefined,
    changeService: config ? createChangeService(config) : undefined,
    paymentService: config ? createPaymentService(config) : undefined, networkManager });
  server=app.listen({host:'127.0.0.1',port});
  server.headersTimeout = 10000;
  server.requestTimeout = 15000;
  server.keepAliveTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  server.on('error', () => void shutdown(1));
  await networkManager?.initialize(app);
  monitor.start();
  if(backups&&process.env.NAR_DISABLE_BACKUPS!=='1')stopBackups=backups.start();
  log('info', 'listening', { url: `http://127.0.0.1:${port}` });
} catch (error) {
  await recordStartupFailure(['EADDRINUSE', 'EACCES', 'CONFIG_ERROR'].includes(error.code) ? error.code : 'STARTUP_ERROR');
  await shutdown(78);
}
