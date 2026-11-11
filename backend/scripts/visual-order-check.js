// Isolated visual fixture. Serves current UI assets, never connects to MySQL or
// authenticates as a real user. A separate headless browser profile is used.
import {captureResponsive} from './visual-responsive.js';
import {screens as navigationScreens} from '../public/navigation-catalog.js';
import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localPath,publicPath} from '../src/paths.js';
const directory=path.join(localPath,'ui-checks',randomUUID());await mkdir(directory,{recursive:true});
const script=`
import {renderOrderEntry,renderTableOrder} from '/order-entry.js';
import {renderReports} from '/reports.js';
import {renderDining} from '/dining.js';
import {renderAccountTools} from '/account-tools.js';
import {renderNetworkSettings} from '/network-settings.js';
import {mountDisplayMode} from '/display-mode.js';
import {renderPaymentEntry} from '/payment-entry.js';
import {renderCash} from '/cash.js';
import {renderCustomers,renderSuppliers} from '/party-book.js';
import {renderPurchases} from '/purchases.js';
import {mountNavigationSearch} from '/navigation-search.js';
import {screens} from '/navigation-catalog.js';
import {renderAssistant} from '/assistant.js';
import {renderStock} from '/stock.js';
import {renderExpenses} from '/expenses.js';
import {renderDefinitions} from '/definitions.js';
import {renderCatalog} from '/catalog.js';
const names=['Adana Kebap','Tavuk Şiş','Çay','Ayran','Kutu Kola','Cam Kola','Şalgam','Tost','Gözleme','Su','Türk Kahvesi','Çerez'];
const options=names.map((name,index)=>({productId:String(index+1),optionId:String(index+1),name,code:'visual-'+index,optionName:index===11?'Gram':'Standart',categoryName:index<2?'Yemekler':index<7?'İçecekler':'Diğer',unitCode:index===11?'g':'adet',priceBasisQuantity:index===11?'1000':'1',unitPriceMinor:String([25000,22000,1500,3000,7000,4000,3000,11000,10000,1500,6000,28000][index]),favorite:[2,3,7].includes(index),requiresWeight:index===11,barcodes:[]}));
const group={id:'17',revision:'2',tableName:'Masa 1',status:'open',lines:[{id:'1',productName:'Adana Kebap',optionName:'Porsiyon',quantity:'1.000000',paidQuantity:'0.000000',unitCode:'adet',unitPriceMinor:'25000',priceBasisQuantity:'1',totalMinor:'25000',state:'preparing',note:'Soğansız'},{id:'2',productName:'Ayran',optionName:'Standart bardak',quantity:'2.000000',paidQuantity:'0.000000',unitCode:'adet',unitPriceMinor:'3000',priceBasisQuantity:'1',totalMinor:'6000',state:'submitted',note:''}],totalMinor:'31000',settledMinor:'0',remainingMinor:'31000',settlements:[],itemPaymentsAvailable:true};
const user={id:'visual-fixture',permissions:['parties.manage','purchases.manage','orders.write','tables.read','payments.write','cash.manage']};
const cash={users:[{id:'1',name:'Kasiyer'},{id:'2',name:'Patron'}],registers:[{id:'1',name:'Ana kasa',isActive:true}],shifts:[{id:'19',registerId:'1',name:'Ana kasa',responsibleId:'1',responsibleName:'Kasiyer',status:'open',revision:'1',openedByName:'Kasiyer',openedAtUtc:'2026-10-27T08:00:00Z',expectedMinor:'657500',expectedPosMinor:'940000',differenceMinor:null},{id:'18',registerId:'1',name:'Ana kasa',responsibleId:'1',responsibleName:'Kasiyer',status:'closed',revision:'2',openedByName:'Kasiyer',openedAtUtc:'2026-10-25T08:00:00Z',closedByName:'Kasiyer',closedAtUtc:'2026-10-27T07:45:00Z',recipientName:'Patron',handoverOperationId:'41',expectedMinor:'458000',expectedPosMinor:'820000',countedMinor:'457500',countedPosMinor:'820000',differenceMinor:'-500',reason:'Nakit patrona teslim edildi.'}],movements:[{shiftId:'19',actorName:'Kasiyer',custodyName:'Kasiyer',createdAtUtc:'2026-10-28T13:35:00Z',kind:'sale_receipt',amountMinor:'25000',reason:'Masa 1 hesabı'}]};
const people={parties:[{id:'1',name:'Ahmet Yılmaz',code:'M-001',isCustomer:true,isSupplier:false,isActive:true,revision:'1',phone:'0555 000 00 00',creditLimitMinor:'500000',receivableMinor:'145000',payableMinor:'0'},{id:'2',name:'Ayşe Demir',code:'M-002',isCustomer:true,isSupplier:false,isActive:true,revision:'1',phone:null,creditLimitMinor:null,receivableMinor:'65000',payableMinor:'0'},{id:'3',name:'Mehmet Kaya',code:'M-003',isCustomer:true,isSupplier:false,isActive:true,revision:'1',phone:null,creditLimitMinor:null,receivableMinor:'0',payableMinor:'0'},{id:'4',name:'Bereket Gıda',code:'T-001',isCustomer:false,isSupplier:true,isActive:true,revision:'1',phone:'0212 000 00 00',creditLimitMinor:null,receivableMinor:'0',payableMinor:'1245000'},{id:'5',name:'Güven Et',code:'T-002',isCustomer:false,isSupplier:true,isActive:true,revision:'1',phone:null,creditLimitMinor:null,receivableMinor:'0',payableMinor:'845000'}]};
const movements={entries:[{id:'17',accountType:'receivable',type:'payment',amountMinor:'-50000',description:'Nakit tahsilat',createdAtUtc:'2026-10-28T17:40:00Z',dueDate:null},{id:'16',accountType:'receivable',type:'sale_credit',amountMinor:'75000',description:'Adisyon #42 · akşam yemeği',createdAtUtc:'2026-10-28T16:15:00Z',dueDate:null},{id:'15',accountType:'receivable',type:'sale_credit',amountMinor:'120000',description:'Adisyon #36',createdAtUtc:'2026-10-27T13:20:00Z',dueDate:null},{id:'14',accountType:'payable',type:'payment',amountMinor:'-300000',description:'Kısmi ödeme',createdAtUtc:'2026-10-28T08:30:00Z',dueDate:null},{id:'13',accountType:'payable',type:'purchase',amountMinor:'1545000',description:'Fatura BG-1024',createdAtUtc:'2026-10-27T08:00:00Z',dueDate:'2026-11-05'}]};
const purchases={shifts:[{id:'19',name:'Ana kasa'}],purchases:[{id:'24',number:'BG-1024',supplierName:'Bereket Gıda',status:'posted',totalMinor:'1545000',paidMinor:'300000',returnedMinor:'0',remainingMinor:'1245000',dueDate:'2026-11-05'},{id:'25',number:'GE-127',supplierName:'Güven Et',status:'draft',totalMinor:'845000',paidMinor:'0',returnedMinor:'0',remainingMinor:'845000',dueDate:null}]};
const stockProducts=[{id:'22',name:'Cam Kola',stockMode:'direct',type:'ready',unitId:'1',revision:'2'},{id:'86',name:'Sucuklu Tost',stockMode:'recipe',type:'prepared',unitId:'1',revision:'5'},{id:'87',name:'Sütaş kaşar (dilim)',stockMode:'direct',type:'ingredient',unitId:'3',revision:'1'},{id:'23',name:'Şalgam',stockMode:'none',type:'ready',unitId:'1',revision:'1'}];
const stockMeta={products:stockProducts,options:[{id:'100',productId:'23',isActive:true,unitId:'1',contentQuantity:null,recipeVersionId:null,components:[]}],stations:[],recipes:[],units:[{id:'2',code:'koli',name:'Koli'},{id:'1',code:'adet',name:'Adet'},{id:'3',code:'dilim',name:'Dilim'}],warehouses:[{id:'1',name:'Ana depo'}],suppliers:people.parties.filter(row=>row.isSupplier)};
const stock={warehouses:[{id:'1',name:'Ana depo'}],balances:[{productId:'22',name:'Cam Kola',warehouseId:'1',quantity:'285.000000',unitCode:'adet',reorderQuantity:null},{productId:'23',name:'Şalgam',warehouseId:'1',quantity:'20.000000',unitCode:'adet',reorderQuantity:null}],lots:[],movements:[],issues:[{lineId:'100',groupId:'31',name:'Sucuklu Tost',quantity:'1.000000',unitCode:'adet',issue:{code:'INSUFFICIENT_STOCK',message:'Yeterli kullanılabilir stok yok.'}}]};
const expenses={categories:[{id:'1',name:'Kira / faturalar'},{id:'2',name:'Personel'}],staff:[{id:'1',name:'Kasiyer'}],suppliers:people.parties.filter(row=>row.isSupplier),shifts:cash.shifts.filter(row=>row.status==='open'),expenses:[{id:'1',type:'operating',description:'Ekim elektrik faturası',categoryName:'Kira / faturalar',incurredAtUtc:'2026-10-28T12:00:00Z',totalMinor:'350000',remainingMinor:'350000'}],equipment:[]};
const dining={sections:[{id:'1',name:'İç salon',revision:'1',sortOrder:0}],tables:Array.from({length:11},(_,i)=>({id:String(i+1),name:'Masa '+(i+1),sectionId:'1',revision:'1',isActive:i!==8,groupId:i===0?'17':i===2?'18':null,groupRevision:'2',state:i===0||i===2?'occupied':'empty',remainingMinor:i===0?'31000':'18000'}))};
const reportSummary={range:{from:'2026-10-29',to:'2026-10-29'},netSalesMinor:'215000',payments:[{method:'cash',direction:'in',amountMinor:'120000'},{method:'card',direction:'in',amountMinor:'70000'}],expensesMinor:'18000',cancelledMinor:'5000',creditSalesMinor:'25000',staffAdvancesMinor:'50000',equipmentMinor:'0',knownCostMinor:'80000',profitAvailable:true,grossProfitMinor:'135000',operatingResultMinor:'117000',missingCostLines:0,currentReceivableMinor:'145000',currentPayableMinor:'1245000',openGroups:4,products:[{name:'Adana Kebap',quantity:'5',unitCode:'adet',amountMinor:'125000'},{name:'Tost',quantity:'6',unitCode:'adet',amountMinor:'90000'}]};
const costRows=[{id:'51',date:'2026-10-29T09:30:00Z',name:'Bal',quantity:'2',unit:'adet',source_id:'24',reason:null,cost_issue:'tracking'},{id:'50',date:'2026-10-29T09:20:00Z',name:'Sucuklu tost',quantity:'1',unit:'adet',source_id:'23',reason:'Yeterli kullanılabilir stok yok.',cost_issue:'pending'}];
const request=async url=>url.startsWith('/api/reports/summary')?reportSummary:url.startsWith('/api/reports/details')?{kind:new URL(url,'http://test').searchParams.get('kind'),rows:url.includes('kind=costs')?costRows:[{id:'42',date:'2026-10-29T09:30:00Z',staff:'Ayşe Yılmaz',name:'Ekim avansı',kind:'staff_advance',amount_minor:'50000',due_date:null,actor:'İşletme sahibi'},{id:'41',date:'2026-10-29T08:00:00Z',staff:'Mehmet Kaya',name:'Ekim ücret ödemesi',kind:'staff_payment',amount_minor:'150000',due_date:null,actor:'İşletme sahibi'}],nextCursor:null}:url==='/api/network'?{phase:'inactive',revision:'1',active:false,canConfigure:true}:url==='/api/expenses'?expenses:url==='/api/stock'?stock:url==='/api/definitions'?stockMeta:url==='/api/assistant/status'?{configured:false}:url==='/api/finance/parties'?people:(url.startsWith('/api/finance/parties/')&&url.endsWith('/ledger'))?movements:url==='/api/purchases'?purchases:url==='/api/definitions'?{products:[],units:[],warehouses:[],suppliers:people.parties.filter(row=>row.isSupplier)}:url==='/api/finance/payment-meta'?{shifts:[{id:'19',name:'Ana kasa',status:'open'}]}:url==='/api/finance/cash'?cash:url==='/api/sales/menu'?{options,warehouses:[]}:url==='/api/sales/payment-meta'?{shifts:[],customers:[]}:url==='/api/dining'?dining:Promise.reject(new Error('Visual fixture does not write business data'));
const context={request,user,group,message:error=>error.message,isCurrent:()=>true,openTab:()=>{},openGroup:()=>{},refresh:()=>{},can:()=>true,onRefresh:()=>{},onOrder:()=>{},onPayment:()=>{}};
mountDisplayMode(document.querySelector('.site-header'));
const workspace=document.querySelector('#workspace');
const mode=new URL(import.meta.url).searchParams.get('mode');
if(mode?.startsWith('reports')){
 if(mode==='reports-missing'||mode==='reports-costs')Object.assign(reportSummary,{profitAvailable:false,missingCostLines:2,operatingResultMinor:null,grossProfitMinor:null,payments:[{method:'cash',direction:'in',amountMinor:'120000'},{method:'card',direction:'in',amountMinor:'70000'},{method:'cash',direction:'out',amountMinor:'350000'}]});
 await renderReports(workspace,context);if(mode==='reports-staff'||mode==='reports-costs'){workspace.querySelector('[data-report='+ (mode==='reports-staff'?'staff':'costs') +']').click();await new Promise(resolve=>setTimeout(resolve,30));}window.scrollTo(0,0);
}
else if(['tables','table-management','table-editor','table-batch','table-remove'].includes(mode)){user.permissions=screens.map(row=>row.permission);await renderDining(workspace,context);if(['table-management','table-editor','table-remove'].includes(mode))workspace.querySelector('#dining-manage').click();if(mode==='table-editor')workspace.querySelector('[data-edit-table="2"]').click();if(mode==='table-batch'){workspace.querySelector('#add-table').click();workspace.querySelector('[data-add-mode=batch]').click();const count=workspace.querySelector('[name=count]');count.value='40';count.dispatchEvent(new Event('input',{bubbles:true}));}if(mode==='table-remove')workspace.querySelector('[data-toggle-table="2"]').click();window.scrollTo(0,0);}
else if(mode==='table-move'){await renderAccountTools(workspace,context);workspace.querySelector('#choose-move').click();}
else if(mode==='network'){await renderNetworkSettings(workspace,context);}
else if(mode==='purchase-entry'){await renderPurchases(workspace,context);workspace.querySelector('#purchase-new').click();const form=workspace.querySelector('#purchase-create form');form.elements.number.value='BG-1026';form.elements.supplierId.value='4';for(const [field,value] of Object.entries({productId:'22',unitId:'2',quantity:'2',actualBaseQuantity:'48',price:'300'})){const input=form.querySelector('[name^='+field+'-]');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}workspace.querySelector('[name=number]').blur();window.scrollTo(0,0);}
else if(mode==='expenses-entry'){await renderExpenses(workspace,context);}
else if(mode==='definitions-entry'){user.permissions=screens.map(row=>row.permission);await renderDefinitions(workspace,context);}
else if(mode==='stock-count'){user.permissions=screens.map(row=>row.permission);await renderStock(workspace,context);const form=workspace.querySelector('#stock-move form');form.elements.kind.value='count';form.elements.quantity.value='300';form.elements.quantity.dispatchEvent(new Event('input',{bubbles:true}));workspace.querySelectorAll(':scope>section.panel').forEach(node=>node.hidden=true);window.scrollTo(0,0);}
else if(mode==='stock'){user.permissions=screens.map(row=>row.permission);await renderStock(workspace,context);workspace.querySelector('[data-stock-issue]').open=true;}
else if(mode==='navigation'){user.permissions=screens.map(row=>row.permission);workspace.innerHTML='<div id="search"></div><section class="panel"><h2>Masalar</h2><p>İstediğin ekrana yukarıdaki aramadan ulaş.</p></section>';mountNavigationSearch(workspace.querySelector('#search'),{user,openTab:()=>{},onHelp:()=>{}});const input=workspace.querySelector('#screen-search');input.value='veresiye';input.focus();input.dispatchEvent(new Event('input'));}
else if(mode==='assistant'){user.permissions=screens.map(row=>row.permission);await renderAssistant(workspace,context);workspace.querySelector('#guide-topics details').open=true;}
else if(mode==='customer'||mode==='supplier'){await (mode==='customer'?renderCustomers:renderSuppliers)(workspace,context);workspace.querySelector('[data-party]').click();}
else if(mode==='purchases')await renderPurchases(workspace,context);
else if(mode==='cash'){await renderCash(workspace,context);document.querySelector('[data-cash-session] details').open=true;document.querySelector('[data-cash-history]').open=true;}
else if(mode==='payment')await renderPaymentEntry(workspace,context);
else if(mode==='order-servings'){
  options[0].optionName='Dürüm';options.push({...options[0],optionId:'101',optionName:'Porsiyon',unitPriceMinor:'50000'});
  await renderOrderEntry(workspace,context);workspace.querySelector('[data-product="1"]').click();workspace.querySelector('[data-variant="1"]').click();
}
else if(mode==='order-table-draft'){
  await renderTableOrder(workspace,{...context,tableDraft:{id:'2',name:'Masa 2'}});workspace.querySelector('[data-product="3"]').click();
}
else if(mode==='catalog-option'){
  const saleUnits=[{id:'1',code:'adet',name:'Adet',dimension:'count',decimalPlaces:0},{id:'2',code:'kg',name:'Kilogram',dimension:'mass',decimalPlaces:6},{id:'3',code:'g',name:'Gram',dimension:'mass',decimalPlaces:3}];
  const sample={id:'90',revision:'1',name:'Bal',code:'BAL-ORNEK',categoryId:'6',categoryName:'Gıda Ürünleri',baseUnitId:'2',stockMode:'none',isActive:true,options:[]};
  const catalogRequest=async path=>path==='/api/catalog/meta'?{units:saleUnits,categories:[{id:'6',name:'Gıda Ürünleri',isActive:true}]}:path.startsWith('/api/catalog/products?')?{products:[sample],total:1}:path==='/api/catalog/products/90'?{product:sample}:Promise.reject(new Error('Visual catalog does not write'));
  await renderCatalog(workspace,{...context,request:catalogRequest,onUnauthorized:()=>{}});workspace.querySelector('[data-new-sale-option]').click();const price=workspace.querySelector('[name=price]');price.value='550';price.dispatchEvent(new Event('input',{bubbles:true}));
}
else{await renderOrderEntry(workspace,context);document.querySelector('[data-product="3"]').click();document.querySelector('[data-product="3"]').click();document.querySelector('[data-product="5"]').click();}
document.title='VISUAL_READY';
`;
const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:script,encoding:'utf8',windowsHide:true});if(syntax.status!==0)throw new Error(syntax.stderr||'Visual script syntax failed');
const index=await readFile(path.join(publicPath,'index.html'),'utf8');
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/status'){res.setHeader('Content-Type','application/json');if(new URL(req.headers.referer||'/', 'http://127.0.0.1').searchParams.get('mode')?.startsWith('shell-owner'))return res.end(JSON.stringify({user:{id:'qa-owner',displayName:'Örnek işletme sahibi',roles:['owner'],permissions:[...new Set(navigationScreens.map(row=>row.permission))]}}));if(new URL(req.headers.referer||'/', 'http://127.0.0.1').searchParams.get('mode')==='login')return res.end(JSON.stringify({setupRequired:false,user:null}));return res.end(JSON.stringify({user:{id:'qa-shell',displayName:'Örnek garson',roles:['waiter'],permissions:['tables.read','orders.write']}}));}
  if(url.pathname==='/api/dining'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({sections:[],tables:[]}));}
  if(url.pathname==='/api/changes'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({cursor:'0',changed:false}));}
  if(url.pathname==='/'&&(url.searchParams.get('mode')?.startsWith('shell')||url.searchParams.get('mode')==='login'))return res.end(index);
  if(url.pathname==='/qa.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(script);}
  if(url.pathname==='/')return res.end(index.replace('<script src="/app.js" defer type="module"></script>',`<script src="/qa.js?mode=${url.searchParams.get('mode')||'order'}" type="module"></script>`).replace(/<main id="main">[\s\S]*?<\/main>/,'<main id="main"><nav class="tabs"><button>Masalar</button><button aria-selected="true">Adisyon / sipariş</button><button>Mutfak</button></nav><section id="workspace"></section></main>'));
  if(!/^\/[a-z][a-z0-9-]*\.(js|css)$/.test(url.pathname)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.end(await readFile(path.join(publicPath,url.pathname.slice(1))));
}catch{res.statusCode=404;res.end();}});
server.listen(0,'127.0.0.1');await once(server,'listening');
const executable=path.join(process.env.ProgramFiles,'Google','Chrome','Application','chrome.exe');
try{
  const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
  for(const mode of (process.argv.includes('responsive')?['order','order-short','order-servings','order-table-draft','reports','reports-missing','reports-costs','reports-staff','payment','tables','table-management','table-editor','table-batch','table-remove','table-move','assistant','network','purchase-entry','expenses-entry','stock-count','definitions-entry','catalog-option','shell','shell-owner','shell-owner-menu','login']:process.argv.includes('entry')?['purchase-entry','expenses-entry','stock-count','definitions-entry']:process.argv.includes('stock')?['stock']:process.argv.includes('navigation')?['navigation','assistant','shell']:process.argv.includes('books')?['customer','supplier','purchases']:process.argv.includes('cash')?['cash']:['order','payment'])){
    if(only&&!only.includes(mode))continue;
    if(process.argv.includes('responsive')){for(const width of [1440,390])await captureResponsive(executable,`http://127.0.0.1:${server.address().port}/?mode=${mode}${mode.startsWith('shell-owner')?'#tables':''}`,directory,mode,width);continue;}
    const output=path.join(directory,`${mode}.png`);
    const browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${path.join(directory,'profile-'+mode)}`,'--window-size=1440,1000','--hide-scrollbars','--dump-dom','--virtual-time-budget=4000',`--screenshot=${output}`,`http://127.0.0.1:${server.address().port}/?mode=${mode}`],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    let rendered='';browser.stdout.setEncoding('utf8');browser.stdout.on('data',chunk=>{rendered+=chunk;});
    const timeout=setTimeout(()=>browser.kill(),25000);let code;
    try{[code]=await once(browser,'exit');}finally{clearTimeout(timeout);}
    if(!mode.startsWith('shell')&&mode!=='login'&&!rendered.includes('<title>VISUAL_READY</title>'))throw new Error('Visual fixture did not finish: '+mode);
    if(code!==0||(await stat(output)).size<1000)throw new Error('Headless visual capture failed');
    console.log(output);
  }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
