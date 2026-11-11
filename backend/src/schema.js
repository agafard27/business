import { stockIssues } from './migrations/008-stock-issues.js';
import { createHash } from 'node:crypto';
import { withConnection, dbError } from './database.js';
import { coreCatalogTables } from './migrations/002-core-catalog.js';
import { operationsTables } from './migrations/002-operations.js';
import { salesFinanceTables } from './migrations/002-sales-finance.js';
import { stockPurchasingTables } from './migrations/002-stock-purchasing.js';
import { diningRevisions } from './migrations/003-dining-revisions.js';
import { saleStockSnapshots } from './migrations/004-sale-stock-snapshots.js';
import { operationalFields } from './migrations/005-operational-fields.js';
import { importReversal } from './migrations/006-import-reversal.js';
import { cashHandover } from './migrations/007-cash-handover.js';

export const schemaVersion = 8;
const statements = [
  `CREATE TABLE IF NOT EXISTS application_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    value_json JSON NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1,
    updated_at_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `INSERT INTO application_settings (setting_key, value_json)
    VALUES ('business', JSON_OBJECT('name', 'Nar Çiçeği', 'timeZone', 'Europe/Istanbul'))
    ON DUPLICATE KEY UPDATE setting_key = setting_key`
];
const checksum = sql => createHash('sha256').update(sql.join('\n')).digest('hex');
export const domainTables = [...coreCatalogTables, ...operationsTables, ...salesFinanceTables, ...stockPurchasingTables];
export const migrations = [
  { version: 1, statements, checksum: checksum(statements) },
  { version: 2, statements: domainTables.map(table => table.sql), checksum: checksum(domainTables.map(table => table.sql)) },
  { version: 3, statements: diningRevisions.map(step => step.sql), checksum: checksum(diningRevisions.map(step => step.sql)) },
  { version: 4, statements: saleStockSnapshots.map(step => step.sql), checksum: checksum(saleStockSnapshots.map(step => step.sql)) },
  { version: 5, statements: operationalFields.map(step=>step.sql),checksum:checksum(operationalFields.map(step=>step.sql)) },
  { version: 6, statements: importReversal.map(step=>step.sql),checksum:checksum(importReversal.map(step=>step.sql)) },
  { version: 7, statements: cashHandover.map(step=>step.sql),checksum:checksum(cashHandover.map(step=>step.sql)) },
  { version: 8, statements:stockIssues.map(step=>step.sql),checksum:checksum(stockIssues.map(step=>step.sql)) }
];
export const schemaChecksum = migrations.at(-1).checksum;

function verifyHistory(versions, requireLatest = false) {
  if (versions.length > migrations.length || (requireLatest && versions.length !== migrations.length)) throw dbError('SCHEMA_MISMATCH');
  for (let index = 0; index < versions.length; index++) {
    if (versions[index].version !== migrations[index].version || versions[index].checksum !== migrations[index].checksum) throw dbError('SCHEMA_MISMATCH');
  }
}

export async function migrate(config) {
  return withConnection(config, async connection => {
    const lock = `nar_schema:${config.database}`;
    const [[row]] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lock]);
    if (Number(row.acquired) !== 1) throw dbError('MIGRATION_LOCKED');
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
        applied_at_utc DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
      const [versions] = await connection.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
      verifyHistory(versions);
      for (const migration of migrations.slice(versions.length)) {
        // DDL implicitly commits. IF NOT EXISTS permits resuming after a partial run.
        // Check the completed structure BEFORE recording the domain version.
        for (const statement of migration.statements) {
          const step = migration.version === 3 ? diningRevisions.find(item => item.sql === statement) : migration.version===4?saleStockSnapshots.find(item=>item.sql===statement):migration.version===5?operationalFields.find(item=>item.sql===statement):migration.version===6?importReversal.find(item=>item.sql===statement):migration.version===7?cashHandover.find(item=>item.sql===statement):migration.version===8?stockIssues.find(item=>item.sql===statement):null;
          if (step) {
            const [[present]] = await connection.execute('SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?', [step.table,step.column]);
            if (Number(present.count)) continue;
          }
          await connection.query(statement);
        }
        if (migration.version === 2) await verifyDomainStructure(connection);
        if (migration.version === 3) await verifyDiningRevisions(connection);
        if (migration.version === 4) await verifySaleStockSnapshots(connection);
        if (migration.version === 5) await verifyOperationalFields(connection);
        if (migration.version === 6) await verifyImportReversal(connection);
        if (migration.version === 7) await verifyCashHandover(connection);
        if (migration.version === 8) await verifyStockIssues(connection);
        await connection.execute('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)', [migration.version, migration.checksum]);
      }
      await verifySchema(connection);
    } finally { await connection.execute('SELECT RELEASE_LOCK(?)', [lock]); }
  }, 60000);
}

export async function verifySchema(connection) {
  const [versions] = await connection.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
  verifyHistory(versions, true);
  await connection.query('SELECT setting_key, value_json, revision, updated_at_utc FROM application_settings LIMIT 0');
  const [tables] = await connection.query(`SELECT ENGINE FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('schema_migrations', 'application_settings')`);
  if (tables.length !== 2 || tables.some(table => table.ENGINE !== 'InnoDB')) throw dbError('SCHEMA_MISMATCH');
  await verifyDomainStructure(connection);
  await verifyDiningRevisions(connection);
  await verifySaleStockSnapshots(connection);
  await verifyOperationalFields(connection);
  await verifyImportReversal(connection);
  await verifyCashHandover(connection);
  await verifyStockIssues(connection);
  return schemaVersion;
}

async function verifyDiningRevisions(connection) {
  for (const step of diningRevisions) {
    const [[column]] = await connection.execute(`SELECT COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS default_value
      FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`, [step.table,step.column]);
    if (!column || column.type !== 'bigint unsigned' || column.nullable !== 'NO' || String(column.default_value) !== '1') throw dbError('SCHEMA_MISMATCH');
  }
}
async function verifySaleStockSnapshots(connection){
  for(const step of saleStockSnapshots){const [[column]]=await connection.execute('SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[step.table,step.column]);if(!column||column.type!==step.type||column.nullable!=='YES')throw dbError('SCHEMA_MISMATCH');}
}
async function verifyOperationalFields(connection){for(const step of operationalFields){const [[column]]=await connection.execute('SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS default_value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[step.table,step.column]);if(!column||column.type!==step.type||column.nullable!==step.nullable||(step.defaultValue===null?column.default_value!==null:String(column.default_value)!==step.defaultValue))throw dbError('SCHEMA_MISMATCH');}}
async function verifyImportReversal(connection){for(const step of importReversal){const [[column]]=await connection.execute('SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[step.table,step.column]);if(!column||column.type!==step.type||column.nullable!=='YES')throw dbError('SCHEMA_MISMATCH');}const [[relation]]=await connection.query("SELECT COUNT(*) AS count FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name='import_batches' AND column_name='reversed_operation_id' AND referenced_table_name='business_operations' AND referenced_column_name='id'");if(Number(relation.count)!==1)throw dbError('SCHEMA_MISMATCH');}

export async function verifyDomainStructure(connection) {
  const [tables] = await connection.query('SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.tables WHERE table_schema = DATABASE()');
  const engines = new Map(tables.map(table => [table.name, table.engine]));
  const [columns] = await connection.query('SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.columns WHERE table_schema = DATABASE()');
  const presentColumns = new Set(columns.map(column => `${column.table_name}.${column.column_name}`));
  const [foreignKeys] = await connection.query(`SELECT TABLE_NAME AS table_name, CONSTRAINT_NAME AS constraint_name, COLUMN_NAME AS column_name,
    REFERENCED_TABLE_NAME AS target_table, REFERENCED_COLUMN_NAME AS target_column
    FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND referenced_table_name IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`);
  const keyGroups = new Map();
  for (const key of foreignKeys) {
    const keyName = `${key.table_name}.${key.constraint_name}`;
    if (!keyGroups.has(keyName)) keyGroups.set(keyName, { table: key.table_name, target: key.target_table, columns: [], targets: [] });
    keyGroups.get(keyName).columns.push(key.column_name);
    keyGroups.get(keyName).targets.push(key.target_column);
  }
  const presentKeys = new Set([...keyGroups.values()].map(key => `${key.table}.${key.columns.join(',')}->${key.target}.${key.targets.join(',')}`));
  const [indexes] = await connection.query(`SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name, COLUMN_NAME AS column_name
    FROM information_schema.statistics WHERE table_schema = DATABASE() AND non_unique = 0 ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
  const indexGroups = new Map();
  for (const index of indexes) {
    const key = `${index.table_name}.${index.index_name}`;
    if (!indexGroups.has(key)) indexGroups.set(key, { table: index.table_name, columns: [] });
    indexGroups.get(key).columns.push(index.column_name);
  }
  const presentUniqueKeys = new Set([...indexGroups.values()].map(index => `${index.table}.${index.columns.join(',')}`));
  const [checks] = await connection.query(`SELECT TABLE_NAME AS table_name, COUNT(*) AS count FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND constraint_type = 'CHECK' AND enforced = 'YES' GROUP BY TABLE_NAME`);
  const checkCounts = new Map(checks.map(check => [check.table_name, Number(check.count)]));
  for (const table of domainTables) {
    if (engines.get(table.name) !== 'InnoDB') throw dbError('SCHEMA_MISMATCH');
    for (const match of table.sql.matchAll(/^\s+([a-z][a-z0-9_]*)\s+(?:BIGINT|INT|TINYINT|VARCHAR|CHAR|BINARY|BOOLEAN|DATETIME|DATE|DECIMAL|ENUM|JSON)\b/gm)) {
      if (!presentColumns.has(`${table.name}.${match[1]}`)) throw dbError('SCHEMA_MISMATCH');
    }
    for (const match of table.sql.matchAll(/FOREIGN KEY \(([^)]+)\) REFERENCES ([a-z_]+)\(([^)]+)\)/g)) {
      const columns = match[1].split(',').map(value => value.trim());
      const targets = match[3].split(',').map(value => value.trim());
      if (!presentKeys.has(`${table.name}.${columns.join(',')}->${match[2]}.${targets.join(',')}`)) throw dbError('SCHEMA_MISMATCH');
    }
    const requiredUniqueKeys = [...table.sql.matchAll(/(?:UNIQUE(?: KEY [a-z_]+)?|PRIMARY KEY)\s*\(([^)]+)\)/gi)]
      .map(match => match[1].split(',').map(value => value.trim()).join(','));
    for (const match of table.sql.matchAll(/^\s+([a-z][a-z0-9_]*)\s+[^\n]+\b(?:UNIQUE|PRIMARY KEY)\s*,?\s*$/gm)) requiredUniqueKeys.push(match[1]);
    for (const key of requiredUniqueKeys) if (!presentUniqueKeys.has(`${table.name}.${key}`)) throw dbError('SCHEMA_MISMATCH');
    if ((checkCounts.get(table.name) ?? 0) < [...table.sql.matchAll(/\bCHECK\s*\(/g)].length) throw dbError('SCHEMA_MISMATCH');
  }
}

async function verifyCashHandover(connection){
  for(const step of cashHandover){
    const [[column]]=await connection.execute("SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS default_value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?",[step.table,step.column]);
    if(!column||column.type!==step.type||column.nullable!=="YES"||column.default_value!==null)throw dbError("SCHEMA_MISMATCH");
    const [[relation]]=await connection.execute("SELECT COUNT(*) AS count FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND column_name=? AND referenced_table_name=? AND referenced_column_name='id'",[step.table,step.column,step.target]);
    if(Number(relation.count)!==1)throw dbError("SCHEMA_MISMATCH");
  }
}

async function verifyStockIssues(connection){const [[column]]=await connection.query("SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS default_value FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='check_lines' AND column_name='stock_issue_json'");if(!column||column.type!=='json'||column.nullable!=='YES'||column.default_value!==null)throw dbError('SCHEMA_MISMATCH');}
