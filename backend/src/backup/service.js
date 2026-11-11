import mysql from 'mysql2';
import { createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID } from 'node:crypto';
import { createReadStream,createWriteStream } from 'node:fs';
import { mkdir,readFile,writeFile,rename,stat,open,readdir,unlink } from 'node:fs/promises';
import { createGzip,createGunzip } from 'node:zlib';
import { Readable,Writable,PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { migrations,domainTables,verifyDomainStructure,verifySchema } from '../schema.js';
import { localPath } from '../paths.js';
import { protect,unprotect } from '../secrets.js';
import { withConnection } from '../database.js';
import { problem } from '../business/core.js';
import { attachmentsDirectory,attachmentPath } from '../files/service.js';

const magic=Buffer.from('NARBK001');const tables=['schema_migrations','application_settings',...domainTables.map(table=>table.name)];
export const backupDirectory=path.join(localPath,'yedekler');
const keyPath=path.join(localPath,'backup-key.json');
export async function backupSettings(){
  await mkdir(backupDirectory,{recursive:true});let saved;
  try{saved=JSON.parse(await readFile(keyPath,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw problem(503,'BACKUP_KEY_INVALID','Yedek şifreleme ayarı okunamadı.');
    const protectedKey=await protect(randomBytes(32).toString('base64'));
    try{await writeFile(keyPath,JSON.stringify({version:1,protectedKey}),{encoding:'utf8',flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
    saved=JSON.parse(await readFile(keyPath,'utf8'));
  }
  const key=Buffer.from(await unprotect(saved.protectedKey),'base64');if(key.length!==32)throw problem(503,'BACKUP_KEY_INVALID','Yedek şifreleme anahtarı geçersiz.');return {key,directory:backupDirectory};
}
function inside(directory,name){const resolved=path.resolve(directory,name);if(path.dirname(resolved)!==path.resolve(directory))throw problem(400,'INVALID_BACKUP','Yedek yolu geçersiz.');return resolved;}
const validName=name=>/^nar-\d{14}-[0-9a-f-]{36}\.narbak$/.test(name);
export async function createBackup(config,{key,directory=backupDirectory,actorId=null,attachmentDirectory=attachmentsDirectory}){
  if(!Buffer.isBuffer(key)||key.length!==32)throw problem(503,'BACKUP_KEY_INVALID','Yedek şifreleme anahtarı gerekli.');
  await mkdir(directory,{recursive:true});const raw=mysql.createConnection({...config,dateStrings:true});raw.on('error',()=>{});const connection=raw.promise();
  const name=`nar-${new Date().toISOString().replace(/\D/g,'').slice(0,14)}-${randomUUID()}.narbak`;const final=inside(directory,name),temporary=inside(directory,`${name}.partial`);
  let runId,locked=false;const timer=setTimeout(()=>raw.destroy(),300000);
  try{
    await connection.connect();const [[lock]]=await connection.execute('SELECT GET_LOCK(?,0) AS acquired',[`${config.database}:backup`]);if(Number(lock.acquired)!==1)throw problem(409,'BACKUP_BUSY','Yedekleme zaten sürüyor.');locked=true;
    const [history]=await connection.query('SELECT version,checksum FROM schema_migrations ORDER BY version');
    if(history.length<2||history.length>migrations.length||history.some((row,index)=>Number(row.version)!==migrations[index].version||row.checksum!==migrations[index].checksum))throw problem(409,'SCHEMA_MISMATCH','Yedeklenecek şema sürümü doğrulanamadı.');
    await verifyDomainStructure(connection);
    const [run]=await connection.execute("INSERT INTO backup_runs(initiated_by_user_id,target_label,encrypted) VALUES (?,'Proje içi .local/yedekler',TRUE)",[actorId]);runId=String(run.insertId);
    const [columnRows]=await connection.query("SELECT TABLE_NAME AS table_name,COLUMN_NAME AS name,DATA_TYPE AS type FROM information_schema.columns WHERE table_schema=DATABASE() AND (GENERATION_EXPRESSION IS NULL OR GENERATION_EXPRESSION='') ORDER BY TABLE_NAME,ORDINAL_POSITION");
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const counts={};
    async function* source(){
      yield JSON.stringify({kind:'header',format:1,history,createdAtUtc:new Date().toISOString()})+'\n';
      for(const table of tables){
        const columns=columnRows.filter(column=>column.table_name===table);if(!columns.length)throw problem(409,'SCHEMA_MISMATCH','Yedek sütunları eksik.');
        yield JSON.stringify({kind:'table',name:table,columns:columns.map(column=>({name:column.name,type:column.type}))})+'\n';counts[table]=0;
        const stream=raw.query(`SELECT ${columns.map(column=>`\`${column.name}\``).join(',')} FROM \`${table}\``).stream({highWaterMark:100});
        for await(const row of stream){
          const values=columns.map(column=>{const value=row[column.name];return Buffer.isBuffer(value)?{binary:value.toString('base64')}:column.type==='json'&&value!==null?{json:value}:value;});
          yield JSON.stringify({kind:'row',values})+'\n';counts[table]++;
        }
      }
      const [attachments]=await connection.query('SELECT storage_key,sha256,size_bytes FROM file_attachments ORDER BY id');
      for(const attachment of attachments){const bytes=await readFile(attachmentPath(attachmentDirectory,attachment.storage_key));if(bytes.length!==Number(attachment.size_bytes)||createHash('sha256').update(bytes).digest('hex')!==attachment.sha256)throw problem(409,'FILE_DAMAGED','Yedeklenecek belge doğrulanamadı.');yield JSON.stringify({kind:'attachment',key:attachment.storage_key,sha256:attachment.sha256,base64:bytes.toString('base64')})+'\n';}
      yield JSON.stringify({kind:'end',counts})+'\n';
    }
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(magic);
    const output=createWriteStream(temporary,{flags:'wx'});output.write(magic);output.write(iv);
    await pipeline(Readable.from(source()),createGzip(),cipher,output);
    const file=await open(temporary,'a');try{await file.write(cipher.getAuthTag());await file.sync();}finally{await file.close();}
    await connection.commit();await rename(temporary,final);
    const hash=createHash('sha256');for await(const chunk of createReadStream(final))hash.update(chunk);const sha256=hash.digest('hex'),size=(await stat(final)).size;
    await connection.execute("UPDATE backup_runs SET status='succeeded',includes_attachments=TRUE,size_bytes=?,sha256=?,completed_at_utc=UTC_TIMESTAMP(6) WHERE id=?",[size,sha256,runId]);
    return {id:runId,name,sizeBytes:size,sha256,counts};
  }catch(error){
    try{await connection.rollback();if(runId)await connection.execute("UPDATE backup_runs SET status='failed',error_code='BACKUP_FAILED',completed_at_utc=UTC_TIMESTAMP(6) WHERE id=?",[runId]);}catch{}
    try{await unlink(temporary);}catch{}throw problem(error.status||503,error.code==='BACKUP_BUSY'?'BACKUP_BUSY':'BACKUP_FAILED',error.code==='BACKUP_BUSY'?'Yedekleme zaten sürüyor.':'Yedek tamamlanamadı. Önceki yedekler korundu.');
  }finally{clearTimeout(timer);if(locked){try{await connection.execute('SELECT RELEASE_LOCK(?)',[`${config.database}:backup`]);}catch{}}raw.destroy();}
}
async function encryptedInfo(file,key){
  const size=(await stat(file)).size;if(size<37)throw problem(400,'INVALID_BACKUP','Yedek dosyası geçersiz.');
  const handle=await open(file,'r');const prefix=Buffer.alloc(20),tag=Buffer.alloc(16);try{await handle.read(prefix,0,20,0);await handle.read(tag,0,16,size-16);}finally{await handle.close();}
  if(!prefix.subarray(0,8).equals(magic))throw problem(400,'INVALID_BACKUP','Yedek biçimi geçersiz.');
  const decrypt=()=>{const decipher=createDecipheriv('aes-256-gcm',key,prefix.subarray(8));decipher.setAAD(magic);decipher.setAuthTag(tag);return decipher;};
  // Authenticate the complete encrypted file before any restore write is allowed.
  try{await pipeline(createReadStream(file,{start:20,end:size-17}),decrypt(),new Writable({write(_chunk,_encoding,done){done();}}));}
  catch{throw problem(400,'INVALID_BACKUP','Yedek bozuk veya şifreleme anahtarı uyuşmuyor.');}
  return {size,decrypt};
}
export async function restoreBackup(config,{key,file,attachmentDirectory=path.join(localPath,'restore-assets',config.database)}){
  if(!/^nar_restore_[a-z0-9_]{1,25}$/.test(config.database))throw problem(400,'RESTORE_TARGET','Geri dönüş yalnız ayrı nar_restore_ veritabanına yapılabilir.');
  const encrypted=await encryptedInfo(file,key);
  return withConnection({...config,dateStrings:true},async connection=>{
    await verifySchema(connection);
    for(const table of tables.filter(name=>!['schema_migrations','application_settings'].includes(name))){const [[count]]=await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);if(Number(count.count))throw problem(409,'RESTORE_NOT_EMPTY','Geri dönüş hedefi boş olmalı.');}
    await connection.query('SET FOREIGN_KEY_CHECKS=0');await connection.beginTransaction();let current=null,header=false,finished=false;const counts={};
    const plain=new PassThrough();const pumping=pipeline(createReadStream(file,{start:20,end:encrypted.size-17}),encrypted.decrypt(),createGunzip(),plain);pumping.catch(()=>{});const lines=createInterface({input:plain,crlfDelay:Infinity});
    try{
      for await(const line of lines){
        if(line.length>32*1024*1024)throw problem(400,'INVALID_BACKUP','Yedek satırı sınırı aşıyor.');const item=JSON.parse(line);
        if(item.kind==='header'){
          if(header||item.format!==1||!Array.isArray(item.history)||item.history.length>migrations.length||item.history.some((row,index)=>Number(row.version)!==migrations[index].version||row.checksum!==migrations[index].checksum))throw problem(400,'INVALID_BACKUP','Yedek şeması uyumsuz.');header=true;
        }else if(item.kind==='table'){
          if(!header||!tables.includes(item.name)||Object.hasOwn(counts,item.name)||!Array.isArray(item.columns)||item.columns.some(column=>!/^[a-z][a-z0-9_]*$/.test(column.name)))throw problem(400,'INVALID_BACKUP','Yedek tablo yapısı geçersiz.');current=item;counts[item.name]=0;
        }else if(item.kind==='row'){
          if(!current||!Array.isArray(item.values)||item.values.length!==current.columns.length)throw problem(400,'INVALID_BACKUP','Yedek satırı geçersiz.');counts[current.name]++;
          if(current.name==='schema_migrations')continue;
          if(current.name==='application_settings'&&counts[current.name]===1)await connection.query('DELETE FROM application_settings');
          const values=item.values.map(value=>value&&typeof value==='object'&&Object.hasOwn(value,'binary')?Buffer.from(value.binary,'base64'):value&&typeof value==='object'&&Object.hasOwn(value,'json')?JSON.stringify(value.json):value);
          await connection.execute(`INSERT INTO \`${current.name}\` (${current.columns.map(column=>`\`${column.name}\``).join(',')}) VALUES (${values.map(()=>'?').join(',')})`,values);
        }else if(item.kind==='attachment'){
          const bytes=Buffer.from(item.base64,'base64');if(bytes.length>5*1024*1024||createHash('sha256').update(bytes).digest('hex')!==item.sha256||!item.key.startsWith(`${item.sha256}.`))throw problem(400,'INVALID_BACKUP','Yedek belge bütünlüğü geçersiz.');
          await mkdir(attachmentDirectory,{recursive:true});try{await writeFile(attachmentPath(attachmentDirectory,item.key),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;const prior=await readFile(attachmentPath(attachmentDirectory,item.key));if(createHash('sha256').update(prior).digest('hex')!==item.sha256)throw problem(409,'FILE_EXISTS','Hedef belge zaten var ve içeriği farklı.');}
        }else if(item.kind==='end'){
          if(tables.some(table=>counts[table]!==item.counts?.[table]))throw problem(400,'INVALID_BACKUP','Yedek kayıt sayıları uyuşmuyor.');finished=true;
        }else throw problem(400,'INVALID_BACKUP','Yedek kayıt biçimi geçersiz.');
      }
      await pumping;if(!finished)throw problem(400,'INVALID_BACKUP','Yedek tamamlanmamış.');
      const [attachments]=await connection.query('SELECT storage_key,sha256,size_bytes FROM file_attachments');for(const attachment of attachments){const bytes=await readFile(attachmentPath(attachmentDirectory,attachment.storage_key));if(bytes.length!==Number(attachment.size_bytes)||createHash('sha256').update(bytes).digest('hex')!==attachment.sha256)throw problem(400,'INVALID_BACKUP','Geri dönen belge doğrulanamadı.');}
      const [foreignKeys]=await connection.query(`SELECT TABLE_NAME AS table_name,CONSTRAINT_NAME AS constraint_name,COLUMN_NAME AS column_name,REFERENCED_TABLE_NAME AS target_table,REFERENCED_COLUMN_NAME AS target_column FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL ORDER BY table_name,constraint_name,ordinal_position`);
      const groups=new Map();for(const row of foreignKeys){const key=`${row.table_name}.${row.constraint_name}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
      for(const group of groups.values()){
        const first=group[0];const [[orphans]]=await connection.query(`SELECT COUNT(*) AS count FROM \`${first.table_name}\` child WHERE ${group.map(row=>`child.\`${row.column_name}\` IS NOT NULL`).join(' AND ')} AND NOT EXISTS (SELECT 1 FROM \`${first.target_table}\` parent WHERE ${group.map(row=>`parent.\`${row.target_column}\`=child.\`${row.column_name}\``).join(' AND ')})`);if(Number(orphans.count))throw problem(400,'INVALID_BACKUP','Geri dönen ilişkiler doğrulanamadı.');
      }
      await connection.query('UPDATE user_sessions SET revoked_at_utc=UTC_TIMESTAMP(6) WHERE revoked_at_utc IS NULL');
      await connection.query("UPDATE backup_runs SET status='unknown',error_code='RESTORED_RUNNING_STATE' WHERE status='running'");
      await connection.query("UPDATE outbox_events SET status='pending',locked_until_utc=NULL,lock_owner=NULL WHERE status='processing'");
      await connection.query('SET FOREIGN_KEY_CHECKS=1');await connection.commit();await verifySchema(connection);return {counts,verified:true,attachmentDirectory};
    }catch(error){plain.destroy();lines.close();try{await connection.rollback();await connection.query('SET FOREIGN_KEY_CHECKS=1');}catch{}throw error;}
  },300000);
}
export async function listBackups(directory=backupDirectory){
  await mkdir(directory,{recursive:true});const names=(await readdir(directory)).filter(validName).sort().reverse();const result=[];
  for(const name of names){const details=await stat(inside(directory,name));result.push({name,sizeBytes:details.size,createdAtUtc:details.mtime.toISOString()});}return result;
}
export function createBackupService(config,{directory=backupDirectory,settings=backupSettings}={}){
  let running=null;
  return {
    async status(){const files=await listBackups(directory);const runs=await withConnection(config,async connection=>{const [rows]=await connection.query('SELECT id,status,size_bytes,completed_at_utc,restore_verified_at_utc,error_code FROM backup_runs ORDER BY id DESC LIMIT 30');return rows.map(row=>({id:String(row.id),status:row.status,sizeBytes:row.size_bytes,completedAtUtc:row.completed_at_utc,restoreVerifiedAtUtc:row.restore_verified_at_utc,errorCode:row.error_code}));});return {target:'.local/yedekler',encrypted:true,sameDisk:true,intervalHours:6,running:Boolean(running),files,runs};},
    async run(actorId=null){if(running)return running;running=(async()=>createBackup(config,{...await settings(),actorId}))();try{return await running;}finally{running=null;}},
    start(){let stopped=false,timer;const tick=async()=>{try{await this.run();}catch{}if(!stopped){timer=setTimeout(tick,6*60*60*1000);timer.unref();}};timer=setTimeout(tick,30000);timer.unref();return()=>{stopped=true;clearTimeout(timer);};}
  };
}
