import {loadConfig} from '../src/config.js';
import {withConnection} from '../src/database.js';
import {verifySchema,schemaVersion} from '../src/schema.js';
import {backupDirectory} from '../src/backup/service.js';
const safe=error=>typeof error.code==='string'&&/^[A-Z_]{1,64}$/.test(error.code)?error.code:'WINDOWS_SECRET_UNAVAILABLE';
console.log(`Node.js ${process.versions.node}; hedef şema v${schemaVersion}; PC adresi: 127.0.0.1:5080`);
let config;
try{config=await loadConfig();console.log('Şifreli bağlantı ayarı: OK');}catch(error){console.error(`Bağlantı ayarı: ${safe(error)}`);process.exitCode=1;}
if(config){try{await withConnection(config,verifySchema);console.log('Veritabanı ve şema: OK');}catch(error){console.error(`Veritabanı ve şema: ${safe(error)}${error.code==='SCHEMA_MISMATCH'?' — npm.cmd run db:migrate gerekli.':''}`);process.exitCode=1;}}
console.log(`Yedek hedefi: ${backupDirectory}`);
try{const response=await fetch('http://127.0.0.1:5080/health/ready',{signal:AbortSignal.timeout(3000)});console.log(`Çalışan uygulama: ${response.ok?'hazır':'hazır değil'}`);}catch{console.log('Çalışan uygulama: erişilemiyor; npm.cmd start ile başlatın.');}
try{const response=await fetch('http://127.0.0.1:5080/api/system/status',{signal:AbortSignal.timeout(3000)});if(response.ok){const data=await response.json();console.log(`Yerel ağ: ${data.network?.active?data.network.address:'kapalı / '+(data.network?.phase||'etkin değil')}`);}}catch{}

