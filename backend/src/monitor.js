import { withConnection } from './database.js';
import { verifySchema } from './schema.js';
import { log } from './log.js';

export const messages = {
  ER_ACCESS_DENIED_ERROR: ['access_denied', 'MySQL kullanıcı adı, parola veya erişim yetkisi doğrulanamadı.'],
  ER_BAD_DB_ERROR: ['database_missing', 'Veritabanı bulunamadı. İlk kurulum gerekiyor.'],
  ER_NO_SUCH_TABLE: ['schema_required', 'Veritabanı şeması eksik. Şema kurulumu gerekiyor.'],
  ER_BAD_FIELD_ERROR: ['schema_required', 'Veritabanı şeması uygulamayla uyumlu değil.'],
  SCHEMA_MISMATCH: ['schema_required', 'Veritabanı şeması uygulamayla uyumlu değil.'],
  CONFIG_ERROR: ['configuration_error', 'Yerel veritabanı ayarları okunamadı. Kurulumu kontrol edin.']
};

export function createMonitor(probe, { intervalMs = 10000, staleMs = 20000, now = () => Date.now(), logger = log } = {}) {
  let current = { state: 'starting', ready: false, message: 'Veritabanı kontrol ediliyor.', checkedAtUtc: null, lastSuccessAtUtc: null, schemaVersion: null, latencyMs: null };
  let running = false;
  let stopped = true;
  let timer;
  const status = () => {
    const stale = current.ready && now() - Date.parse(current.checkedAtUtc) > staleMs;
    return stale ? { ...current, state: 'stale', ready: false, message: 'Veritabanı kontrolü gecikti. Güncel bağlantı doğrulanamadı.' } : { ...current };
  };
  async function check() {
    if (running) return;
    running = true;
    const started = now();
    const previous = current;
    try {
      const version = await probe();
      current = { state: 'ready', ready: true, message: 'MySQL bağlantısı ve şema hazır.', checkedAtUtc: new Date(now()).toISOString(), lastSuccessAtUtc: new Date(now()).toISOString(), schemaVersion: version, latencyMs: now() - started };
    } catch (error) {
      const [state, message] = messages[error.code] ?? ['unavailable', 'MySQL bağlantısı kullanılamıyor. Otomatik yeniden kontrol edilecek.'];
      current = { state, ready: false, message, checkedAtUtc: new Date(now()).toISOString(), lastSuccessAtUtc: previous.lastSuccessAtUtc, schemaVersion: null, latencyMs: null };
    } finally { running = false; }
    if (previous.state !== current.state) logger('info', 'database_state', { state: current.state });
  }
  async function tick() { await check(); if (!stopped) timer = setTimeout(tick, intervalMs); }
  return { status, check, start() { if (!stopped) return; stopped = false; void tick(); }, stop() { stopped = true; clearTimeout(timer); } };
}

export function databaseProbe(config) { return () => withConnection(config, verifySchema); }
