import { loadConfig } from '../src/config.js';
import { backupSettings,createBackup } from '../src/backup/service.js';
try{const result=await createBackup(await loadConfig(),await backupSettings());console.log(`Şifreli yedek oluşturuldu: .local/yedekler/${result.name}`);}
catch(error){console.error(`Yedek tamamlanamadı. Kod: ${/^[A-Z_]{1,64}$/.test(error.code)?error.code:'BACKUP_FAILED'}`);process.exitCode=1;}
