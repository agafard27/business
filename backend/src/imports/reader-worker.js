import { parentPort,workerData } from 'node:worker_threads';
import { inflateRawSync } from 'node:zlib';
import ExcelJS from 'exceljs';

// Validate and bound ZIP inflation before an OOXML parser sees the workbook.
export function checkZip(buffer){
  let end=-1;for(let pos=buffer.length-22;pos>=Math.max(0,buffer.length-65557);pos--)if(buffer.readUInt32LE(pos)===0x06054b50){end=pos;break;}
  if(end<0||buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6))throw new Error();
  const count=buffer.readUInt16LE(end+10),size=buffer.readUInt32LE(end+12),offset=buffer.readUInt32LE(end+16);
  if(count>200||!count||offset+size>end)throw new Error();let pos=offset,total=0;const names=new Set();
  for(let index=0;index<count;index++){
    if(pos+46>buffer.length||buffer.readUInt32LE(pos)!==0x02014b50)throw new Error();
    const flags=buffer.readUInt16LE(pos+8),method=buffer.readUInt16LE(pos+10),compressed=buffer.readUInt32LE(pos+20),plain=buffer.readUInt32LE(pos+24),nameLength=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32),local=buffer.readUInt32LE(pos+42);
    const name=buffer.subarray(pos+46,pos+46+nameLength).toString('utf8');total+=plain;
    if(flags&1||![0,8].includes(method)||plain>10*1024*1024||total>20*1024*1024||names.has(name)||name.includes('..')||name.startsWith('/')||/vbaProject|externalLinks/i.test(name)||local+30>buffer.length)throw new Error();names.add(name);
    if(buffer.readUInt32LE(local)!==0x04034b50||buffer.readUInt16LE(local+8)!==method)throw new Error();
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);if(start+compressed>offset)throw new Error();
    const bytes=buffer.subarray(start,start+compressed);const output=method===8?inflateRawSync(bytes,{maxOutputLength:Math.max(1,plain)}):bytes;if(output.length!==plain)throw new Error();
    pos+=46+nameLength+extra+comment;
  }
  if(pos!==offset+size||!names.has('xl/workbook.xml'))throw new Error();
}
export function csvRows(content){
  const first=content.replace(/^\ufeff/,'').split(/\r?\n/,1)[0];const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let index=0;index<content.length;index++){
    const char=content[index];if(index===0&&char==='\ufeff')continue;
    if(quoted){if(char==='"'){if(content[index+1]==='"'){cell+='"';index++;}else{quoted=false;closed=true;}}else cell+=char;}
    else if(char==='"'){if(cell||closed)throw new Error();quoted=true;}
    else if(char===delimiter){row.push(cell);cell='';closed=false;}
    else if(char==='\n'||char==='\r'){if(char==='\r'&&content[index+1]==='\n')index++;row.push(cell);if(row.some(value=>value!==''))rows.push(row);row=[];cell='';closed=false;}
    else{if(closed)throw new Error();cell+=char;}
    if(cell.length>1000||row.length>30||rows.length>501)throw new Error();
  }
  if(quoted)throw new Error();if(cell||row.length){row.push(cell);if(row.some(value=>value!==''))rows.push(row);}return rows;
}
async function read(){
  const buffer=Buffer.from(workerData.bytes);let rows;
  if(workerData.format==='xlsx'){
    checkZip(buffer);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
    if(workbook.worksheets.length!==1)throw new Error();const sheet=workbook.worksheets[0];if(sheet.rowCount>501||sheet.columnCount>30)throw new Error();
    rows=[];sheet.eachRow({includeEmpty:false},row=>{const values=[];for(let i=1;i<=sheet.columnCount;i++){
      const value=row.getCell(i).value;if(value!==null&&typeof value!=='string'&&typeof value!=='number'&&typeof value!=='boolean')throw new Error();values.push(value===null?'':String(value));
    }rows.push(values);});
  }else if(workerData.format==='csv')rows=csvRows(new TextDecoder('utf-8',{fatal:true}).decode(buffer));else throw new Error();
  if(rows.length<2||rows.length>501||rows.some(row=>row.length>30||row.some(value=>value.length>1000)))throw new Error();
  return rows;
}
if(parentPort)read().then(rows=>parentPort.postMessage({rows})).catch(()=>parentPort.postMessage({error:true}));
