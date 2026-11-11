import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {rootPath} from '../src/paths.js';
const manifest=JSON.parse(await readFile(new URL('../../docs/kod-haritasi.json',import.meta.url),'utf8'));
const [id,flag]=process.argv.slice(2);
if(!id){for(const module of manifest.modules)console.log(`${module.id}: ${module.name}`);}
else{
  const module=manifest.modules.find(module=>module.id===id);
  if(!module){console.error('Modül bulunamadı. İndeks: npm.cmd run module');process.exitCode=1;}
  else{
    console.log(`${module.name}\n${module.purpose}\nKart: docs/moduller/${module.id}.md`);
    for(const [file,symbol] of Object.entries(module.entry))console.log(`${file} → ${symbol}`);
    if(flag==='--check'){
      const files=[...new Set([...Object.keys(module.entry),...module.files,...module.tests])];
      for(const file of files){const resolved=path.resolve(rootPath,file);if(!resolved.startsWith(path.resolve(rootPath)+path.sep))throw new Error('Harita yolu proje dışında.');await access(resolved);}
      console.log(`${files.length} ilgili dosyanın yolu doğrulandı. Diğer modüller taranmadı.`);
    }
  }
}
