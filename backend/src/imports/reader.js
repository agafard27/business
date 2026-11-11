import { Worker } from 'node:worker_threads';
import { problem } from '../business/core.js';
let active=0;
export function importBytes(value){
  if(typeof value!=='string'||value.length>7*1024*1024||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw problem(400,'INVALID_FILE','Dosya içeriği geçersiz.');
  const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length>5*1024*1024)throw problem(400,'FILE_SIZE','Dosya en fazla 5 MB olabilir.');if(bytes.toString('base64')!==value)throw problem(400,'INVALID_FILE','Dosya kodlaması geçersiz.');return bytes;
}
export async function readSpreadsheet(bytes,format){
  if(active>=2)throw problem(429,'IMPORT_BUSY','Başka bir dosya okunuyor. Biraz sonra deneyin.');active++;
  try{return await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./reader-worker.js',import.meta.url),{workerData:{bytes,format},resourceLimits:{maxOldGenerationSizeMb:192}});
    const timer=setTimeout(()=>{void worker.terminate();reject(problem(400,'INVALID_FILE','Dosyanın okunması zaman sınırını aştı.'));},10000);
    const fail=()=>{clearTimeout(timer);void worker.terminate();reject(problem(400,'INVALID_FILE','Tek sayfalı, en fazla 500 veri satırlı Excel veya UTF-8 CSV dosyası kullanın. Formül ve bağlantılı hücreler kabul edilmez.'));};
    worker.once('message',result=>{if(result.error)return fail();clearTimeout(timer);void worker.terminate();resolve(result.rows);});worker.once('error',fail);worker.once('exit',code=>{if(code!==0)fail();});
  });}finally{active--;}
}
