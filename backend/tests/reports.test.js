import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderReports} from '../public/reports.js';
import {reportSections,summaryHtml,detailTableHtml} from '../public/report-sections.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const summary={range:{from:'2026-10-29',to:'2026-10-29'},netSalesMinor:'12500',payments:[],expensesMinor:'0',operatingResultMinor:null,grossProfitMinor:null,cancelledMinor:'0',creditSalesMinor:'0',staffAdvancesMinor:'0',equipmentMinor:'0',profitAvailable:false,missingCostLines:1,knownCostMinor:'0',openGroups:0,currentReceivableMinor:'0',currentPayableMinor:'0',products:[{name:'Tost',quantity:'2',unitCode:'adet',amountMinor:'12500'},{name:'Çay',quantity:'1',unitCode:'adet',amountMinor:'2000'}]};
async function ui(action){const dom=new JSDOM('<div id="workspace"></div>',{url:'http://127.0.0.1'}),saved={document:globalThis.document,FormData:globalThis.FormData};Object.assign(globalThis,{document:dom.window.document,FormData:dom.window.FormData});const node=document.querySelector('#workspace');try{await action(dom,node);}finally{Object.assign(globalThis,saved);dom.window.close();}}
const context=(node,request)=>({request,isCurrent:()=>node.isConnected,message:error=>error.message});
test('rapor alanları ayrıdır; yalnız seçilen alan yüklenir ve ürünler süzülebilir',()=>ui(async(dom,node)=>{
 const calls=[];const request=async path=>{calls.push(path);if(path.includes('/summary'))return summary;const kind=new URL(path,'http://test').searchParams.get('kind');return {kind,rows:[{id:'1',staff:'Ayşe',kind:'staff_advance',amount_minor:'0',name:'Avans'}],nextCursor:null};};
 await renderReports(node,context(node,request));assert.equal(node.querySelectorAll('[data-report]').length,18);assert.equal(calls.length,1);assert.match(calls[0],/summary/);assert.equal(node.querySelector('#report-areas-panel').open,false);
 node.querySelector('[data-report=staff]').click();await tick();assert.match(calls.at(-1),/kind=staff/);assert.equal(node.querySelector('.report-view h3').textContent,'Personel / avans');assert.match(node.querySelector('#report-details').textContent,/Ayşe/);assert.match(node.querySelector('#report-details').textContent,/0,00/);
 node.querySelector('[data-report=products]').click();await tick();assert.equal(node.querySelector('.report-view h3').textContent,'Ürün satışları');
 const search=node.querySelector('#sold-product-search');search.value='tost';search.dispatchEvent(new dom.window.Event('input'));assert.equal(node.querySelector('[data-sold-name="çay"]').hidden,true);
 assert.equal(node.querySelectorAll('[data-report][aria-pressed=true]').length,1);
}));
test('eski rapor ve eski devam sayfası yeni alanı veya tarihi ezemez',()=>ui(async(dom,node)=>{
 let resolveStaff,resolveMore;const calls=[];
 const request=async path=>{calls.push(path);if(path.includes('/summary'))return summary;const query=new URL(path,'http://test').searchParams,kind=query.get('kind');if(kind==='staff')return new Promise(resolve=>{resolveStaff=resolve;});if(query.has('before'))return new Promise(resolve=>{resolveMore=resolve;});return {kind,rows:[{id:'300',name:'Stok ilk sayfa'}],nextCursor:'200'};};
 await renderReports(node,context(node,request));
 node.querySelector('[data-report=staff]').click();node.querySelector('[data-report=stock]').click();await tick();
 resolveStaff({kind:'staff',rows:[{id:'1',name:'Eski avans'}],nextCursor:null});await tick();assert.equal(node.querySelector('.report-view h3').textContent,'Stok / sayım / fire');assert.doesNotMatch(node.textContent,/Eski avans/);
 const more=node.querySelector('[data-more]');more.click();more.click();assert.equal(calls.filter(path=>path.includes('before=200')).length,1);
 const from=node.querySelector('[name=from]');from.value='2026-10-28';from.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(node.querySelector('#report-details').textContent,'');
 resolveMore({kind:'stock',rows:[{id:'100',name:'Eski devam'}],nextCursor:null});await tick();assert.doesNotMatch(node.textContent,/Eski devam/);assert.match(node.querySelector('#report-content').textContent,/Tarih değişti/);
 node.querySelector('#report-filters').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.match(calls.at(-1),/from=2026-10-28/);assert.ok(!calls.at(-1).includes('before='));
}));
test('tahsilat, personel, cari ve masa raporu hücreleri Türkçedir; metin HTML çalıştırmaz',()=>{
 const html=detailTableHtml({kind:'payments',rows:[{kind:'out',method:'card',amount_minor:'100',reason:'<img src=x>'}]});assert.match(html,/Para çıkışı/);assert.match(html,/POS/);assert.match(html,/&lt;img/);assert.ok(!html.includes('<img'));
 assert.ok(reportSections.some(row=>row.id==='groups'));assert.ok(reportSections.some(row=>row.id==='receivables'));assert.ok(reportSections.some(row=>row.id==='payables'));
 const costs=detailTableHtml({kind:'costs',rows:[{id:'1',name:'<img src=x>',quantity:'1',unit:'kg',source_id:'2',cost_issue:'cost',reason:'<script>bad</script>'}]});assert.match(costs,/Tüketilen stoğun maliyeti eksik/);assert.match(costs,/&lt;script/);assert.ok(!costs.includes('<img'));assert.ok(!costs.includes('<script>'));
});
test('özet para girişini, çıkışını ve kazancı ayırır; eksik maliyeti sıfır saymaz',()=>{
 const data={...summary,grossSalesMinor:'25000',cancelledMinor:'2500',adjustmentsMinor:'10000',payments:[{method:'cash',direction:'in',amountMinor:'20000'},{method:'card',direction:'in',amountMinor:'30000'},{method:'cash',direction:'out',amountMinor:'60000'},{method:'card',direction:'out',amountMinor:'10000'}],products:[{name:'<img src=x>',quantity:'1.25',unitCode:'kg',amountMinor:'12500'}]};
 const dom=new JSDOM(summaryHtml(data,'from=2026-10-01&to=2026-10-30')),doc=dom.window.document;
 const cards=[...doc.querySelectorAll('.report-metric')];assert.equal(cards.length,4);
 assert.match(cards[0].textContent,/125,00/);assert.match(cards[1].textContent,/500,00/);assert.match(cards[2].textContent,/700,00/);assert.match(cards[3].textContent,/Henüz hesaplanamıyor/);
 assert.match(doc.body.textContent,/−200,00/);assert.match(doc.body.textContent,/tek başına zarar anlamına gelmez/);assert.equal(doc.querySelector('#report-profit dl'),null);
 assert.equal(doc.querySelectorAll('img').length,0);assert.match(doc.body.textContent,/1,25 kg/);assert.match(doc.body.textContent,/Güncel durumdur/);assert.match(doc.querySelector('a').href,/from=2026-10-01&to=2026-10-30/);dom.window.close();
 const complete=new JSDOM(summaryHtml({...data,profitAvailable:true,knownCostMinor:'7500',grossProfitMinor:'5000',expensesMinor:'10000',operatingResultMinor:'-5000'},''));
 assert.match(complete.window.document.querySelector('.report-negative').textContent,/−50,00/);assert.match(complete.window.document.querySelector('#report-profit').textContent,/75,00/);assert.equal(complete.window.document.querySelector('[href="#report-profit"]'),null);complete.window.close();
});
test('özetten ayrıntıya ve geriye tarih korunur; maliyet nedenleri ve yapılacaklar gösterilir',()=>ui(async(dom,node)=>{
 const calls=[];const request=async path=>{calls.push(path);return path.includes('/summary')?summary:{kind:'costs',rows:[{id:'5',name:'Bal',quantity:'2',unit:'adet',cost_issue:'tracking',source_id:'3'},{id:'6',name:'Tost',quantity:'1',unit:'adet',cost_issue:'pending',source_id:'4'}],nextCursor:null};};
 await renderReports(node,context(node,request));
 node.querySelector('[name=from]').value='2026-10-11';node.querySelector('#report-filters').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();
 node.querySelector('[data-report-open=costs]').click();await tick();
 assert.match(calls.at(-1),/from=2026-10-11/);assert.match(calls.at(-1),/kind=costs/);assert.ok(!calls.at(-1).includes('before='));
 assert.match(node.querySelector('#report-details').textContent,/Satış anında stok takibi kapalıydı/);assert.match(node.querySelector('#report-details').textContent,/Geçmiş satışın maliyeti otomatik oluşmaz/);assert.match(node.querySelector('#report-details').textContent,/Stok tüketimi tamamlanmadı/);
 const search=node.querySelector('#report-row-search');search.value='Bal';search.dispatchEvent(new dom.window.Event('input'));assert.equal(node.querySelectorAll('[data-report-row]')[1].hidden,true);
 node.querySelector('[data-report-open=summary]').click();await tick();assert.match(calls.at(-1),/summary\?from=2026-10-11/);assert.match(node.querySelector('.report-view h3').textContent,/İşletmem nasıl gidiyor/);
 node.querySelector('[data-report-back]').click();assert.equal(node.querySelector('#report-areas-panel').open,true);
}));
