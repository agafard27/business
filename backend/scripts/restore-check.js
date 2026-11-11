import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import { loadConfig } from '../src/config.js';
import { backupSettings,restoreBackup } from '../src/backup/service.js';
import { askAdminUser,askPassword } from './prompt.js';
import { withConnection } from '../src/database.js';
import { migrate } from '../src/schema.js';
const [name,target]=process.argv.slice(2);
try{
  if(!/^nar-\d{14}-[0-9a-f-]{36}\.narbak$/.test(name||'')||!/^nar_restore_[a-z0-9_]{1,25}$/.test(target||''))throw Object.assign(new Error(),{code:'RESTORE_ARGUMENTS'});
  const local=await loadConfig(),settings=await backupSettings();const user=await askAdminUser(),password=await askPassword();const admin={...local,database:undefined,user,password};
  // CREATE without IF NOT EXISTS: an existing database can never be overwritten.
  await withConnection(admin,connection=>connection.query(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`));
  const config={...admin,database:target};await migrate(config);
  const result=await restoreBackup(config,{key:settings.key,file:path.join(settings.directory,name)});
  const hash=createHash('sha256');for await(const chunk of createReadStream(path.join(settings.directory,name)))hash.update(chunk);
  await withConnection(local,connection=>connection.execute("UPDATE backup_runs SET restore_verified_at_utc=UTC_TIMESTAMP(6) WHERE sha256=? AND status='succeeded'",[hash.digest('hex')]));
  console.log(`Geri dönüş doğrulandı: ${target}; ${Object.keys(result.counts).length} tablo. Kaynak veritabanı değiştirilmedi.`);
}catch(error){console.error(`Geri dönüş tamamlanamadı. Kod: ${/^[A-Z_]{1,64}$/.test(error.code)?error.code:'RESTORE_FAILED'}. Kullanım: npm.cmd run backup:restore-check -- yedek_dosyasi nar_restore_deneme`);process.exitCode=1;}
