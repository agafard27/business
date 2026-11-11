import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));let count=0;
async function check(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await check(file);else if(/\.(?:js|cjs)$/.test(entry.name)){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});if(result.status!==0){process.stderr.write(result.stderr||'Syntax check failed');process.exitCode=1;}count++;}}}
for(const directory of ['backend/src','backend/public','backend/scripts','backend/tests'])await check(path.join(root,directory));
console.log(`${count} JavaScript dosyası kontrol edildi.`);
