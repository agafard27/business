import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rootPath } from '../src/paths.js';

const entry = fileURLToPath(new URL('../src/server.js', import.meta.url));
let child;
let stopped = false;
let timer;
let failures = [];
function start() {
  child = spawn(process.execPath, [entry], { cwd: rootPath, stdio: 'inherit', windowsHide: true });
  child.on('error', () => { console.error('Node.js işlemi başlatılamadı.'); process.exitCode = 1; });
  child.on('exit', (code) => {
    if (stopped || code === 0) return;
    if (code === 78) { console.error('Başlangıç ayarı veya port uygun değil. Tekrar deneme durduruldu.'); process.exitCode = 1; return; }
    failures = failures.filter(time => Date.now() - time < 60000);
    failures.push(Date.now());
    if (failures.length >= 5) { console.error('Art arda hatalar nedeniyle tekrar başlatma durduruldu.'); process.exitCode = 1; return; }
    console.error('Backend kapandı; 3 saniye sonra yeniden başlatılacak.');
    timer = setTimeout(start, 3000);
  });
}
function stop() { stopped = true; clearTimeout(timer); child?.kill('SIGTERM'); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
start();
