import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { localPath } from '../src/paths.js';
import { createBackup,restoreBackup,listBackups } from '../src/backup/service.js';
import { withConnection } from '../src/database.js';
export async function checkBackupFlows(source,target,{attachmentDirectory}={}){
  assert.notEqual(source.port,3306);assert.match(target.database,/^nar_restore_/);
  const directory=path.join(localPath,'mysql-tests',randomUUID(),'backups');await mkdir(directory,{recursive:true});const key=randomBytes(32);
  const backup=await createBackup(source,{key,directory,attachmentDirectory});assert.ok(backup.sizeBytes>36);assert.equal((await listBackups(directory)).length,1);
  const file=path.join(directory,backup.name),bytes=await readFile(file);assert.equal(bytes.subarray(0,8).toString(),'NARBK001');assert.ok(!bytes.includes(Buffer.from('password_hash')));
  const corrupt=Buffer.from(bytes);corrupt[Math.floor(corrupt.length/2)]^=1;const bad=path.join(directory,'corrupt.narbak');await writeFile(bad,corrupt);
  await assert.rejects(restoreBackup(target,{key,file:bad}),{code:'INVALID_BACKUP'});
  await withConnection(target,async connection=>{const [[row]]=await connection.query('SELECT COUNT(*) AS count FROM products');assert.equal(Number(row.count),0);});
  await assert.rejects(restoreBackup(source,{key,file}),{code:'RESTORE_TARGET'});
  const restored=await restoreBackup(target,{key,file,attachmentDirectory:path.join(directory,'restored-assets')});assert.equal(restored.verified,true);
  const sourceFiles=await withConnection(source,async connection=>{const [rows]=await connection.query('SELECT storage_key FROM file_attachments');return rows;});
  for(const row of sourceFiles)assert.deepEqual(await readFile(path.join(restored.attachmentDirectory,row.storage_key)),await readFile(path.join(attachmentDirectory,row.storage_key)));
  const compare=async config=>withConnection(config,async connection=>{
    const [[row]]=await connection.query(`SELECT (SELECT COUNT(*) FROM products) AS products,(SELECT COUNT(*) FROM payments) AS payments,
      (SELECT COALESCE(SUM(amount_minor),0) FROM party_entries) AS ledger,(SELECT COALESCE(SUM(quantity_base),0) FROM stock_movements) AS stock,
      (SELECT COUNT(*) FROM check_lines) AS line_count`);return row;
  });assert.deepEqual(await compare(target),await compare(source));
  await withConnection(target,async connection=>{const [[sessions]]=await connection.query('SELECT COUNT(*) AS count FROM user_sessions WHERE revoked_at_utc IS NULL');assert.equal(Number(sessions.count),0);});
  await assert.rejects(restoreBackup(target,{key,file}),{code:'RESTORE_NOT_EMPTY'});
}
