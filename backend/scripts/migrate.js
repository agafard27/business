import { loadConfig } from '../src/config.js';
import { migrate, schemaVersion, domainTables } from '../src/schema.js';
import { askAdminUser, askPassword } from './prompt.js';

try {
  const config = await loadConfig();
  const user = await askAdminUser();
  const password = await askPassword();
  await migrate({ ...config, user, password });
  console.log(`Şema doğrulandı / güncellendi. Sürüm: ${schemaVersion}; iş tablosu: ${domainTables.length}. Yönetici parolası kaydedilmedi.`);
} catch (error) {
  const code = /^[A-Z0-9_]{1,64}$/.test(String(error.code)) ? String(error.code) : 'MIGRATION_ERROR';
  console.error(`Şema güncellenemedi. Kod: ${code}. MySQL bağlantısını, yönetici yetkisini ve sürümü kontrol edin.`);
  process.exitCode = 1;
}
