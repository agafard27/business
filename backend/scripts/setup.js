import { access, mkdir, writeFile, rename } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { configPath, localPath } from '../src/paths.js';
import { loadConfig } from '../src/config.js';
import { withConnection, dbError } from '../src/database.js';
import { migrate, verifySchema } from '../src/schema.js';
import { protect } from '../src/secrets.js';
import { askAdminUser, askPassword } from './prompt.js';

async function exists(file) { try { await access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
let stage = 'settings';
try {
  if (await exists(configPath)) {
    await withConnection(await loadConfig(), verifySchema);
    console.log('Yerel bağlantı zaten kurulu ve doğrulandı. Mevcut kullanıcı değiştirilmedi.');
  } else {
    if (await exists(configPath + '.pending')) throw dbError('RECOVERY_FILE_EXISTS');
    const config = await loadConfig();
    const adminUser = await askAdminUser();
    const adminPassword = await askPassword();
    const adminConfig = { ...config, user: adminUser, password: adminPassword, database: undefined };
    stage = 'admin_connection';
    await withConnection(adminConfig, async admin => {
      if (process.argv.includes('--inspect')) {
        const [tables] = await admin.execute('SELECT table_name FROM information_schema.tables WHERE table_schema = ?', [config.database]);
        const [columns] = await admin.execute("SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'schema_migrations'", [config.database]);
        console.log(JSON.stringify({ tables: tables.map(row => row.TABLE_NAME ?? row.table_name), migrationColumns: columns.map(row => row.COLUMN_NAME ?? row.column_name) }));
        return;
      }
      const [[existing]] = await admin.execute("SELECT COUNT(*) AS count FROM mysql.user WHERE User = ? AND Host = 'localhost'", [config.user]);
      if (Number(existing.count) !== 0) throw dbError('APP_USER_EXISTS');
      stage = 'database';
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
      stage = 'schema';
      await migrate({ ...adminConfig, database: config.database });
      const password = randomBytes(32).toString('hex');
      stage = 'protect_password';
      const protectedPassword = await protect(password);
      await mkdir(localPath, { recursive: true });
      const local = { host: config.host, port: config.port, database: config.database, user: config.user, protectedPassword };
      await writeFile(configPath + '.pending', JSON.stringify(local, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      stage = 'create_user';
      await admin.query("CREATE USER ?@'localhost' IDENTIFIED BY ?", [config.user, password]);
      stage = 'grant_user';
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${config.database}\`.* TO ?@'localhost'`, [config.user]);
      stage = 'verify_user';
      await withConnection({ ...config, password }, verifySchema);
      stage = 'save_config';
      await rename(configPath + '.pending', configPath);
    }, 90000);
    if (!process.argv.includes('--inspect')) {
      console.log('MySQL veritabanı, şema ve sınırlı uygulama kullanıcısı hazır.');
      console.log('Yönetici parolası kaydedilmedi. Uygulamanın ayrı parolası Windows hesabınızla şifrelendi.');
    }
  }
} catch (error) {
  const safeCode = /^[A-Z0-9_]{1,64}$/.test(String(error.code)) ? String(error.code) : 'SETUP_ERROR';
  console.error(`Kurulum tamamlanamadı. Aşama: ${stage}; kod: ${safeCode}`);
  console.error('Önceden var olan hesaplar değiştirilmedi/silinmedi. .pending dosyası oluştuysa korumalı kurtarma kaydıdır; silmeyin.');
  process.exitCode = 1;
}
