import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function captureResponsive(executable,url,directory,name,width){
 const profile=path.join(directory,'profile-'+name+'-'+width);await mkdir(profile,{recursive:true});
 const browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let socket;const pending=new Map();let sequence=0;
 try{
  let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await pause(50);}}
  if(!port)throw Error('Chrome debugging did not start');
  const pages=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);const item=pending.get(data.id);if(item){pending.delete(data.id);clearTimeout(item.timer);data.error?item.reject(Error(data.error.message)):item.resolve(data.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timed out: '+method));},10000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
  await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width,height:name==='order-short'?650:900,deviceScaleFactor:1,mobile:width<600});
  await call('Page.navigate',{url});
  let ready=false;for(let i=0;i<100;i++){const data=await call('Runtime.evaluate',{expression:name==='login'?"document.querySelector('#remember-me')!==null":name.startsWith('shell')?"document.querySelector('#table-grid')!==null":"document.title==='VISUAL_READY'",returnByValue:true});if(data.result.value){ready=true;break;}await pause(50);}
  if(!ready)throw Error('Fixture did not finish: '+name);
  if(name==='shell-owner-menu')await call('Runtime.evaluate',{expression:"document.querySelector('#workspace-menu-toggle').click();document.querySelector('[data-navigation-group=management]').click();",returnByValue:true});
  const audit=(await call('Runtime.evaluate',{expression:'JSON.stringify({width:innerWidth,bodyWidth:document.documentElement.scrollWidth,layout:document.documentElement.dataset.layout,title:document.title})',returnByValue:true})).result.value;
  const metrics=JSON.parse(audit);
  if(name==='tables'){
    const interaction=JSON.parse((await call('Runtime.evaluate',{expression:"JSON.stringify((()=>{const entry=document.querySelector('[data-open-table]'),card=entry.closest('[data-table]'),title=card.querySelector('h3'),edit=card.querySelector('[data-edit-table]'),previousY=scrollY;card.scrollIntoView({block:'center'});const hit=node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);};const result={tableSurfaceClickable:hit(title)?.closest('[data-open-table]')===entry,managementSeparate:!edit||hit(edit)?.closest('[data-edit-table]')===edit};scrollTo(0,previousY);return result;})())",returnByValue:true})).result.value);
    Object.assign(metrics,interaction);if(!interaction.tableSurfaceClickable||!interaction.managementSeparate)throw Error('Table card hit area overlaps management controls');
  }
  if(name.startsWith('shell')){
    const shell=JSON.parse((await call('Runtime.evaluate',{expression:"JSON.stringify((()=>{const nav=document.querySelector('#workspace-navigation'),content=document.querySelector('.workspace-content'),n=nav.getBoundingClientRect(),c=content.getBoundingClientRect();return {sidebar:n.right<=c.left,stacked:n.bottom<=c.top,menuVisible:getComputedStyle(nav.querySelector('.workspace-menu')).display!=='none',expandedSections:nav.querySelectorAll('.workspace-submenu:not([hidden])').length};})())",returnByValue:true})).result.value);
    Object.assign(metrics,shell);
    if(width>1020&&metrics.layout!=='phone'&&(!shell.sidebar||!shell.menuVisible))throw Error('Desktop sidebar is not beside the workspace');
    if((width<=1020||metrics.layout==='phone')&&(!shell.stacked||shell.menuVisible!==(name==='shell-owner-menu')))throw Error('Phone menu layout is incorrect');
    if(shell.expandedSections>1)throw Error('More than one menu section is expanded');
  }
  if(name.startsWith('order')){const geometry=(await call('Runtime.evaluate',{expression:"JSON.stringify((()=>{const first=document.querySelector('#draft-list .order-line'),list=document.querySelector('.order-account-scroll');return {visibleHeight:list.clientHeight,firstRowHeight:first.getBoundingClientRect().height,clipped:getComputedStyle(list).overflowY!=='visible'&&first.getBoundingClientRect().bottom>list.getBoundingClientRect().bottom+1};})())",returnByValue:true})).result.value;Object.assign(metrics,JSON.parse(geometry));if(metrics.clipped)throw Error('Order draft row is clipped: '+geometry);}
 if(metrics.bodyWidth>metrics.width+1)throw Error('Page overflow '+name+' '+audit);
  const size=(await call('Page.getLayoutMetrics')).cssContentSize;
  const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.min(size.height,3000),scale:1}});
  const output=path.join(directory,name+'-'+width+'.png');await writeFile(output,Buffer.from(screenshot.data,'base64'));
  await writeFile(path.join(directory,name+'-'+width+'.json'),audit);
  console.log(JSON.stringify({output,...metrics}));
  await call('Browser.close').catch(()=>{});
 }finally{
  socket?.close();for(const item of pending.values())clearTimeout(item.timer);
  if(browser.exitCode===null){await pause(150);if(browser.exitCode===null)browser.kill();}
 }
}
