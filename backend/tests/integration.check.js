import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, appendFile, access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import net from 'node:net';
import { rootPath, localPath } from '../src/paths.js';
import { withConnection, createDatabasePool, inTransaction } from '../src/database.js';
import { migrate, verifySchema, migrations, schemaVersion } from '../src/schema.js';
import { checkBusinessFlows } from './business-integration.js';
import { checkBackupFlows } from './backup-integration.js';
import { checkSchemaIntegrity } from './schema-integrity.js';
import { checkAuthFlows } from './auth-integration.js';
import { checkCatalogFlows } from './catalog-integration.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function eventually(action, description, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { try { if (await action()) return; } catch { } await sleep(150); }
  throw new Error(description);
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const closed = once(child, 'exit'); child.kill(); await closed;
}

test('gerçek MySQL: şema, yetki, transaction, kesinti ve HTTP toparlanması', { timeout: 120000 }, async t => {
  const executable = path.join(process.env.ProgramFiles, 'MySQL', 'MySQL Server 8.0', 'bin', 'mysqld.exe');
  await access(executable);
  const directory = path.join(localPath, 'mysql-tests', randomUUID());
  const data = path.join(directory, 'data');
  await mkdir(directory, { recursive: true });
  const port = await freePort();
  const apiPort = await freePort();
  let mysql;
  let api;
  let pool;
  let businessFixture;
  const children = [];
  function launch(file, args, env = process.env) {
    const child = spawn(file, args, { cwd: rootPath, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', () => {});
    child.stdout.on('data', () => {});
    child.stderr.on('data', chunk => { void appendFile(path.join(directory, 'process.log'), chunk).catch(() => {}); });
    children.push(child); return child;
  }
  t.after(async () => {
    for (const child of children.reverse()) await stop(child);
    if (pool) await pool.end();
  });
  const init = launch(executable, ['--no-defaults', '--initialize-insecure', `--datadir=${data}`, '--console']);
  const [initCode] = await once(init, 'exit');
  assert.equal(initCode, 0, 'Geçici MySQL başlatılmalı');
  const startMysql = () => launch(executable, ['--no-defaults', '--no-monitor', `--datadir=${data}`, `--port=${port}`, '--bind-address=127.0.0.1', '--mysqlx=OFF', '--skip-log-bin', '--console']);
  mysql = startMysql();
  const admin = { host: '127.0.0.1', port, user: 'root', connectTimeout: 1000, supportBigNumbers: true, bigNumberStrings: true, charset: 'utf8mb4' };
  await eventually(async () => { await withConnection(admin, async () => {}); return true; }, 'Geçici MySQL erişimi');
  await withConnection(admin, connection => connection.query('CREATE DATABASE nar_cicegi CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'));
  const db = { ...admin, database: 'nar_cicegi' };
  await migrate(db); await migrate(db);
  await withConnection(db, async connection => {
    const [[row]] = await connection.query('SELECT COUNT(*) AS count FROM schema_migrations');
    assert.equal(Number(row.count), migrations.length);
    const [[business]] = await connection.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.name')) AS name FROM application_settings WHERE setting_key='business'");
    assert.equal(business.name, 'Nar Çiçeği');
    await connection.query("CREATE USER 'nar_test'@'localhost' IDENTIFIED BY 'integration-only'");
    await connection.query("GRANT SELECT, INSERT, UPDATE, DELETE ON nar_cicegi.* TO 'nar_test'@'localhost'");
  });
  await t.test('ilişkiler, tutarlar, satış geçmişi, ayrı ödeme ve stok kuralları', async () => {
    await withConnection(db, checkSchemaIntegrity, 30000);
  });
  await t.test('sürüm 1 verisini koruyarak yarım kalmış yükseltmeye devam eder', async () => {
    assert.equal(migrations[0].checksum, '2b3ff32f07ab34363f57b0b5b064c85fb71b609e2b119a05c2e7d6fa21c19914', 'Published v1 checksum must remain immutable');
    await withConnection(admin, connection => connection.query('CREATE DATABASE nar_upgrade CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'));
    const upgrade = { ...admin, database: 'nar_upgrade' };
    await withConnection(upgrade, async connection => {
      await connection.query(`CREATE TABLE schema_migrations (
        version INT NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
        applied_at_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
      for (const statement of migrations[0].statements) await connection.query(statement);
      await connection.execute('INSERT INTO schema_migrations (version, checksum) VALUES (1, ?)', [migrations[0].checksum]);
      await connection.query("UPDATE application_settings SET value_json = JSON_OBJECT('name', 'Korunan işletme', 'timeZone', 'Europe/Istanbul'), revision = 7 WHERE setting_key = 'business'");
      // Model interruption after DDL commits, before the v2 ledger is recorded.
      for (const statement of migrations[1].statements.slice(0, 3)) await connection.query(statement);
    }, 30000);
    await migrate(upgrade);
    await migrate(upgrade);
    await withConnection(upgrade, async connection => {
      await verifySchema(connection);
      const [history] = await connection.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
      assert.deepEqual(history.map(row => Number(row.version)), migrations.map(migration=>migration.version));
      assert.equal(history[0].checksum, migrations[0].checksum);
      const [[setting]] = await connection.query("SELECT JSON_UNQUOTE(JSON_EXTRACT(value_json, '$.name')) AS name, revision FROM application_settings WHERE setting_key = 'business'");
      assert.equal(setting.name, 'Korunan işletme');
      assert.equal(String(setting.revision), '7');
      const [[users]] = await connection.query('SELECT COUNT(*) AS count FROM app_users');
      assert.equal(Number(users.count), 0, 'Migrations must not seed business users or sample transactions');
    }, 30000);
  });
  await t.test('sürüm kaydı doğru olsa bile eksik benzersizlik ve CHECK kuralını reddeder', async () => {
    await withConnection(db, async connection => {
      await connection.query('ALTER TABLE business_operations DROP INDEX request_key');
      try { await assert.rejects(verifySchema(connection), { code: 'SCHEMA_MISMATCH' }); }
      finally { await connection.query('ALTER TABLE business_operations ADD UNIQUE INDEX request_key (request_key)'); }
      const [[constraint]] = await connection.query("SELECT CONSTRAINT_NAME AS name FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'units' AND constraint_type = 'CHECK' LIMIT 1");
      assert.match(constraint.name, /^[a-z0-9_]+$/i);
      await connection.query(`ALTER TABLE units DROP CHECK \`${constraint.name}\``);
      try { await assert.rejects(verifySchema(connection), { code: 'SCHEMA_MISMATCH' }); }
      finally { await connection.query(`ALTER TABLE units ADD CONSTRAINT \`${constraint.name}\` CHECK (decimal_places <= 6)`); }
      await verifySchema(connection);
    }, 30000);
  });
  const runtime = { ...db, user: 'nar_test', password: 'integration-only' };
  await t.test('v2 üzerine yarım kalan v3 masa sürümü yükseltmesini veri kaybetmeden sürdürür',async()=>{
    await withConnection(db,async connection=>{
      await connection.query("INSERT INTO dining_sections(name) VALUES ('Korunan bölüm')");
      await connection.query('DELETE FROM schema_migrations WHERE version>=3');
      await connection.query('ALTER TABLE dining_tables DROP COLUMN revision');
    });
    await migrate(db);await migrate(db);
    await withConnection(db,async connection=>{
      const [[row]]=await connection.query("SELECT revision FROM dining_sections WHERE name='Korunan bölüm'");assert.equal(String(row.revision),'1');
      await connection.query("DELETE FROM dining_sections WHERE name='Korunan bölüm'");
    });
  });
  await withConnection(runtime, verifySchema);
  await t.test('v6 yarım kalan aktarım metaverisini tamamlar ve geri alma ilişkisini denetler',async()=>{
    await withConnection(db,async connection=>{await connection.query('DELETE FROM schema_migrations WHERE version>=6');await connection.query('ALTER TABLE import_batches DROP FOREIGN KEY fk_import_reversal, DROP COLUMN reversed_operation_id');});
    await migrate(db);await migrate(db);
    await withConnection(db,async connection=>{await connection.query('ALTER TABLE import_batches DROP FOREIGN KEY fk_import_reversal');await assert.rejects(verifySchema(connection),{code:'SCHEMA_MISMATCH'});await connection.query('ALTER TABLE import_batches ADD CONSTRAINT fk_import_reversal FOREIGN KEY (reversed_operation_id) REFERENCES business_operations(id)');await verifySchema(connection);});
  });
  await t.test('v7 yarım kalan kasa devir yükseltmesini sürdürür ve teslim alan ilişkisini denetler',async()=>{
    await withConnection(db,async connection=>{await connection.query('DELETE FROM schema_migrations WHERE version>=7');await connection.query('ALTER TABLE cash_shifts DROP FOREIGN KEY fk_cash_handover_operation, DROP COLUMN handover_operation_id');});
    await migrate(db);await migrate(db);
    await withConnection(db,async connection=>{await connection.query('ALTER TABLE cash_shifts DROP FOREIGN KEY fk_cash_handover_user');await assert.rejects(verifySchema(connection),{code:'SCHEMA_MISMATCH'});await connection.query('ALTER TABLE cash_shifts ADD CONSTRAINT fk_cash_handover_user FOREIGN KEY (handover_to_user_id) REFERENCES app_users(id)');await verifySchema(connection);});
  });
  await t.test('v8 stok kontrolü alanını yarım yükseltmeden sürdürür ve bozuk türü reddeder',async()=>{
    await withConnection(db,async c=>{await c.query('DELETE FROM schema_migrations WHERE version=8');await c.query('ALTER TABLE check_lines DROP COLUMN stock_issue_json');});await migrate(db);await migrate(db);
    await withConnection(db,async c=>{await c.query('ALTER TABLE check_lines MODIFY stock_issue_json LONGTEXT NULL');await assert.rejects(verifySchema(c),{code:'SCHEMA_MISMATCH'});await c.query('ALTER TABLE check_lines MODIFY stock_issue_json JSON NULL');await verifySchema(c);});
  });
  await assert.rejects(withConnection(runtime, connection => connection.query('CREATE TABLE forbidden_test(id INT)')), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
  pool = createDatabasePool(runtime);
  await assert.rejects(inTransaction(pool, async connection => { await connection.execute("INSERT INTO application_settings(setting_key,value_json) VALUES ('rollback_test', JSON_OBJECT('ok', true))"); throw new Error('rollback'); }));
  await withConnection(runtime, async connection => {
    const [[row]] = await connection.query("SELECT COUNT(*) AS count FROM application_settings WHERE setting_key='rollback_test'");
    assert.equal(Number(row.count), 0);
  });
  await inTransaction(pool, connection => connection.query("INSERT INTO application_settings(setting_key,value_json) VALUES ('commit_test', JSON_OBJECT('ok', true))"));
  api = launch(process.execPath, ['backend/src/server.js'], { ...process.env, PORT: String(apiPort), NAR_DB_HOST: '127.0.0.1', NAR_DB_PORT: String(port), NAR_DB_NAME: 'nar_cicegi', NAR_DB_USER: 'nar_test', NAR_DB_PASSWORD: 'integration-only', NAR_DB_CHECK_MS: '500',NAR_DISABLE_BACKUPS:'1',NAR_DISABLE_NETWORK:'1' });
  const readiness = async expected => {
    if (api.exitCode !== null) throw new Error('API kapandı');
    return (await fetch(`http://127.0.0.1:${apiPort}/health/ready`, { signal: AbortSignal.timeout(2000) })).status === expected;
  };
  await eventually(() => readiness(200), 'API hazır olmalı');
  await t.test('ilk hesap yarışı, güvenli giriş, kalıcı oturum, merkezi yetki ve çıkış', async () => {
    await checkAuthFlows(`http://127.0.0.1:${apiPort}`, runtime);
  });
  await t.test('85 ürün aktarımı, Türkçe arama, fiyat geçmişi, tekrar kayıt engeli ve ürün yetkileri', async () => {
    await withConnection(admin, async connection => {
      await connection.query('CREATE DATABASE nar_catalog_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      await connection.query("GRANT SELECT, INSERT, UPDATE, DELETE ON nar_catalog_integration.* TO 'nar_test'@'localhost'");
    });
    await migrate({ ...admin, database: 'nar_catalog_integration' });
    await checkCatalogFlows({ ...runtime, database: 'nar_catalog_integration' });
  });
  await t.test('veritabanı API sınırlı uygulama hesabıyla yalnızca bilinen tablo yapısını okur', async () => {
    await withConnection(db, async connection => {
      await connection.query('CREATE TABLE inspector_private_test (private_value VARCHAR(80)) ENGINE=InnoDB');
      await connection.query("INSERT INTO inspector_private_test VALUES ('fixture-row-must-never-be-returned')");
    });
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/system/database`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.databaseName, 'nar_cicegi');
      assert.equal(result.schemaVersion, schemaVersion);
      assert.ok(Number.isFinite(Date.parse(result.checkedAtUtc)));
      assert.equal(result.tables.length, 77);
      assert.ok(result.tables.some(table => table.name === 'schema_migrations'));
      assert.ok(!result.tables.some(table => table.name === 'inspector_private_test'));
      const lines = result.tables.find(table => table.name === 'check_lines');
      assert.equal(lines.columns.find(column => column.name === 'id').isPrimaryKey, true);
      assert.equal(lines.columns.find(column => column.name === 'note').nullable, true);
      assert.equal(lines.columns.find(column => column.name === 'quantity').type, 'decimal(18,6)');
      assert.ok(lines.relationships.some(relation => relation.column === 'option_version_id'
        && relation.targetTable === 'sale_option_versions' && relation.targetColumn === 'id'
        && typeof relation.constraint === 'string'));
      const serialized = JSON.stringify(result);
      for (const hidden of ['integration-only', 'nar_test', 'fixture-row-must-never-be-returned', 'commit_test']) {
        assert.ok(!serialized.includes(hidden), `Metadata response excludes ${hidden}`);
      }
      assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/system/database`, { method: 'POST' })).status, 404);
      await withConnection(db, async connection => {
        const [[rows]] = await connection.query('SELECT COUNT(*) AS count FROM inspector_private_test');
        assert.equal(Number(rows.count), 1, 'Reading metadata does not alter rows');
        const [[payments]] = await connection.query('SELECT COUNT(*) AS count FROM payments');
        assert.equal(Number(payments.count), 0, 'Reading metadata does not create business transactions');
      });
    } finally { await withConnection(db, connection => connection.query('DROP TABLE inspector_private_test')); }
  });
  await t.test('masa, sipariş, eşzamanlı tahsilat, fiyat kopyası ve kasa ilişkileri',async()=>{
    await withConnection(admin,async connection=>{
      await connection.query('CREATE DATABASE nar_business_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      await connection.query("GRANT SELECT,INSERT,UPDATE,DELETE ON nar_business_integration.* TO 'nar_test'@'localhost'");
    });
    await migrate({...admin,database:'nar_business_integration'});
    businessFixture=await checkBusinessFlows({...runtime,database:'nar_business_integration'});
  });
  await t.test('şifreli tutarlı yedek, bozuk dosyayı reddetme ve ayrı veritabanına geri dönüş',async()=>{
    await withConnection(admin,async connection=>{
      await connection.query('CREATE DATABASE nar_restore_integration CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      await connection.query("GRANT SELECT,INSERT,UPDATE,DELETE ON nar_restore_integration.* TO 'nar_test'@'localhost'");
    });
    await migrate({...admin,database:'nar_restore_integration'});
    await checkBackupFlows({...runtime,database:'nar_business_integration'},{...runtime,database:'nar_restore_integration'},businessFixture);
  });
  await stop(mysql);
  await eventually(() => readiness(503), 'MySQL kesintisi 503 olmalı');
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/auth/status`)).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`)).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/system/database`)).status, 503);
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/health/live`)).status, 200);
  mysql = startMysql();
  await eventually(() => readiness(200), 'MySQL dönünce API yeniden başlatılmadan hazır olmalı');
  assert.equal((await fetch(`http://127.0.0.1:${apiPort}/api/system/database`)).status, 200);
  await withConnection(db, async connection => {
    await connection.query("UPDATE schema_migrations SET checksum = REPEAT('0',64)");
  });
  await assert.rejects(withConnection(runtime, verifySchema), { code: 'SCHEMA_MISMATCH' });
  await eventually(() => readiness(503), 'Uyumsuz şema hazır sayılmamalı');
});
