import { pathToFileURL } from 'node:url';
import { loadConfig } from '../src/config.js';
import { withConnection } from '../src/database.js';
import { applyReferenceMenu } from '../src/catalog/reference.js';

export async function runMenuImport(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 2 || args[0] !== '--actor' || !/^[1-9][0-9]{0,19}$/.test(args[1]))) {
    throw Object.assign(new Error(), { code: 'IMPORT_ARGUMENTS', title: 'Kullanım: npm.cmd run menu:import -- [--actor kullanıcı_no]' });
  }
  const config = await loadConfig();
  let actorId = args[1];
  if (!actorId) {
    const owners = await withConnection(config, async connection => {
      const [rows] = await connection.query(`SELECT DISTINCT u.id FROM app_users u
        JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
        WHERE u.is_active = TRUE AND r.code = 'owner' ORDER BY u.id LIMIT 2`);
      return rows;
    });
    if (owners.length !== 1) throw Object.assign(new Error(), { code: 'IMPORT_ACTOR_REQUIRED',
      title: 'Tek bir etkin işletme sahibi bulunamadı. --actor kullanıcı_no ile yetkili hesabı belirtin.' });
    actorId = String(owners[0].id);
  }
  const result = await applyReferenceMenu(config, actorId);
  console.log(result.replayed
    ? `Menü daha önce aktarılmış: ${result.productCount} ürün, ${result.optionCount} satış seçeneği. Mevcut düzenlemeler korundu.`
    : `Menü aktarıldı: ${result.productCount} ürün, ${result.optionCount} satış seçeneği. Kaynak tarihi: ${result.sourceDate}.`);
  console.log('Başlangıç stoğu ve reçete oluşturulmadı.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runMenuImport(); }
  catch (error) {
    // No raw SQL, connection values, exception text or secrets in terminal output.
    const code = /^[A-Z0-9_]{1,64}$/.test(String(error.code)) ? String(error.code) : 'IMPORT_ERROR';
    const safeTitles = new Set(['IMPORT_ARGUMENTS', 'IMPORT_ACTOR_REQUIRED', 'FORBIDDEN', 'REFERENCE_IMPORT_CONFLICT', 'REFERENCE_IMPORT_BUSY']);
    const title = safeTitles.has(code) ? error.title : code === 'COMMIT_UNKNOWN'
      ? 'Sonucun doğrulanması gerekiyor. Aynı aktarımı yeniden çalıştırmak kayıtları çoğaltmaz.'
      : 'Menü aktarılamadı. Uygulama bağlantısını ve sistem durumunu kontrol edin.';
    console.error(`${title} Kod: ${code}.`);
    process.exitCode = 1;
  }
}
