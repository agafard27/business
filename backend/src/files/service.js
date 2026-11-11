import { createHash } from 'node:crypto';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import path from 'node:path';
import { localPath } from '../paths.js';
import { identifier } from '../catalog/validation.js';
import { object,text,key,problem,operate,snapshot } from '../business/core.js';
import { importBytes } from '../imports/reader.js';
export const attachmentsDirectory=path.join(localPath,'attachments');
export function attachmentPath(directory,storageKey){if(!/^[0-9a-f]{64}\.(pdf|png|jpg)$/.test(storageKey))throw problem(400,'INVALID_FILE','Belge kimliği geçersiz.');return path.join(directory,storageKey);}
export function createFileService(config,{directory=attachmentsDirectory}={}){
  return {
    async upload(input,actorId,permission){
      object(input,['requestKey','name','fileBase64']);const name=text(input.name,255,'Dosya adı'),bytes=importBytes(input.fileBase64),sha256=createHash('sha256').update(bytes).digest('hex');
      let extension,mediaType;if(bytes.subarray(0,5).toString()==='%PDF-'){extension='pdf';mediaType='application/pdf';}else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){extension='png';mediaType='image/png';}else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){extension='jpg';mediaType='image/jpeg';}else throw problem(400,'INVALID_FILE','PDF, PNG veya JPEG belge yükleyin.');
      const storageKey=`${sha256}.${extension}`;
      return operate(config,{type:'file.upload',permission,actorId,requestKey:key(input.requestKey),payload:{name,sha256}},async(connection,_operation,actor)=>{
        await mkdir(directory,{recursive:true});try{await writeFile(attachmentPath(directory,storageKey),bytes,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;if(createHash('sha256').update(await readFile(attachmentPath(directory,storageKey))).digest('hex')!==sha256)throw problem(409,'FILE_DAMAGED','Mevcut belge bütünlüğü doğrulanamadı.');}
        const [[existing]]=await connection.execute('SELECT id FROM file_attachments WHERE storage_key=?',[storageKey]);if(existing)return {id:String(existing.id)};
        const [result]=await connection.execute('INSERT INTO file_attachments(storage_key,original_name,sha256,media_type,size_bytes,uploaded_by_user_id) VALUES (?,?,?,?,?,?)',[storageKey,name,sha256,mediaType,bytes.length,actor]);return {id:String(result.insertId)};
      });
    },
    async get(id){id=identifier(id);return snapshot(config,async connection=>{const [[row]]=await connection.execute('SELECT storage_key,media_type,size_bytes,sha256 FROM file_attachments WHERE id=?',[id]);if(!row)throw problem(404,'NOT_FOUND','Belge bulunamadı.');const bytes=await readFile(attachmentPath(directory,row.storage_key));if(bytes.length!==Number(row.size_bytes)||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw problem(409,'FILE_DAMAGED','Belge bütünlüğü doğrulanamadı.');return {bytes,mediaType:row.media_type};});}
  };
}
