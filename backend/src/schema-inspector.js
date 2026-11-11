import { withConnection } from './database.js';
import { domainTables, schemaVersion } from './schema.js';

const knownNames = ['schema_migrations', 'application_settings', ...domainTables.map(table => table.name)];
const placeholders = knownNames.map(() => '?').join(',');

// Read only metadata in the configured database. Business rows, settings values,
// accounts and credentials are never part of this response.
export async function readDatabaseSchema(config) {
  return withConnection(config, async connection => {
    const [tableRows] = await connection.execute(`SELECT TABLE_NAME AS name
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME IN (${placeholders})
      ORDER BY TABLE_NAME`, knownNames);
    const tables = tableRows.map(row => ({ name: row.name, columns: [], relationships: [] }));
    const byName = new Map(tables.map(table => [table.name, table]));
    const [columnRows] = await connection.execute(`SELECT TABLE_NAME AS table_name,
      COLUMN_NAME AS name, COLUMN_TYPE AS column_type, IS_NULLABLE AS nullable, COLUMN_KEY AS column_key
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
      ORDER BY TABLE_NAME, ORDINAL_POSITION`, knownNames);
    for (const row of columnRows) {
      byName.get(row.table_name)?.columns.push({ name: row.name, type: row.column_type,
        nullable: row.nullable === 'YES', isPrimaryKey: row.column_key === 'PRI' });
    }
    const [relationRows] = await connection.execute(`SELECT TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS target_table,
      REFERENCED_COLUMN_NAME AS target_column, CONSTRAINT_NAME AS constraint_name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME IN (${placeholders})
      ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`, knownNames);
    for (const row of relationRows) {
      if (!byName.has(row.target_table)) continue;
      byName.get(row.table_name)?.relationships.push({ column: row.column_name,
        targetTable: row.target_table, targetColumn: row.target_column, constraint: row.constraint_name });
    }
    return { databaseName: config.database, schemaVersion, checkedAtUtc: new Date().toISOString(), tables };
  });
}
