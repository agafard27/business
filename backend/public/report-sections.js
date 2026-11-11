import {html,formatPrice} from './business-ui.js';
import {formatQuantity} from './quantity-format.js';
import {actionLabel,outcomeLabel,kindLabel,accountLabel} from './operation-labels.js';
export const reportSections=[
 {id:'summary',name:'İşletmem nasıl gidiyor?',description:'Satış, para akışı ve kazanç; seçilen dönemde ne oldu?',source:'summary'},
 {id:'products',name:'Ürün satışları',description:'Hangi üründen ne kadar satıldı?',source:'summary'},
 {id:'costs',name:'Eksik maliyetler',description:'Kazanç hesabını engelleyen ürünler ve kontrol edilecek kayıtlar',source:'details',kind:'costs'},
 {id:'sales',name:'Satış satırları',description:'Adisyonlara gönderilen ilk satır tutarları',source:'details',kind:'sales'},
 {id:'groups',name:'Masa / hesaplar',description:'Dönemde açılan hesapların son masa ve durumu',source:'details',kind:'groups'},
 {id:'payments',name:'Tahsilat / ödemeler',description:'Nakit ve POS para giriş/çıkışları',source:'details',kind:'payments'},
 {id:'purchases',name:'Mal alışları',description:'Alış belgeleri ve teslim durumları',source:'details',kind:'purchases'},
 {id:'stock',name:'Stok / sayım / fire',description:'Giriş, tüketim, sayım ve çıkışlar',source:'details',kind:'stock'},
 {id:'production',name:'Üretim',description:'Gerçek hazırlama ve çıkan miktarlar',source:'details',kind:'production'},
 {id:'expenses',name:'İşletme giderleri',description:'Personel ve ekipmandan ayrı giderler',source:'details',kind:'operating'},
 {id:'staff',name:'Personel / avans',description:'Kişiye göre ücret ve avans kayıtları',source:'details',kind:'staff'},
 {id:'equipment',name:'Ekipman',description:'Ekipman için kaydedilen giderler',source:'details',kind:'equipment'},
 {id:'receivables',name:'Veresiye',description:'Müşteri borçları ve tahsilat hareketleri',source:'details',kind:'receivables'},
 {id:'payables',name:'Tedarikçiler',description:'Firma borçları ve ödeme hareketleri',source:'details',kind:'payables'},
 {id:'cash',name:'Kasa hareketleri',description:'Nakit giriş, çıkış ve teslimler',source:'details',kind:'cash'},
 {id:'shifts',name:'Kasa devirleri',description:'Sayım, fark ve kapanış kayıtları',source:'details',kind:'shifts'},
 {id:'adjustments',name:'İndirim / ikram / iptal',description:'Gerekçeli satış düzeltmeleri',source:'details',kind:'adjustments'},
 {id:'audit',name:'İşlem geçmişi',description:'İşlemi yapan kişi, zaman ve sonuç',source:'audit'}
];
export const signed=value=>BigInt(value)<0n?'−'+formatPrice((-BigInt(value)).toString()):formatPrice(value);
const reportButton=(id,label)=>`<button type="button" class="text-button" data-report-open="${id}">${html(label)} →</button>`;
const metric=(label,value,note,action,tone='')=>`<article class="report-metric ${tone}"><h4>${html(label)}</h4><strong>${html(value)}</strong><p>${html(note)}</p>${action}</article>`;
export function summaryHtml(data,query){
 const total=(direction,method)=>data.payments.filter(row=>row.direction===direction&&(!method||row.method===method)).reduce((sum,row)=>sum+BigInt(row.amountMinor),0n);
 const incoming=total('in'),outgoing=total('out'),movement=incoming-outgoing;
 const adjustment=BigInt(data.adjustmentsMinor||'0'),cancelled=BigInt(data.cancelledMinor),gross=BigInt(data.grossSalesMinor??(BigInt(data.netSalesMinor)+adjustment+cancelled).toString());
 const money=value=>html(signed(String(value)));
 const pair=(label,value)=>`<div><dt>${html(label)}</dt><dd>${money(value)}</dd></div>`;
 const profitNote=data.profitAvailable?'Net satış − satılan ürün maliyeti − işletme ve personel giderleri.':`${data.missingCostLines} satış satırında maliyet eksik. Eksik tutarlar sıfır sayılmadı.`;
 const profitAction=data.profitAvailable?'<button type="button" class="text-button" data-report-anchor>Kazanç hesabını gör ↓</button>':reportButton('costs','Hangi ürünlerde eksik?');
 return `<div class="report-metrics">
 ${metric('Ne kadar sattım?',signed(data.netSalesMinor),'İptal, indirim ve ikram sonrası sipariş tutarıdır. Açık adisyonlar da dahildir.',reportButton('products','Ürünlere göre gör'))}
 ${metric('Ne kadar para girdi?',signed(String(incoming)),'Nakit ve kart girişleri. Önceki borçların tahsilatı da bu tutara dahildir.',reportButton('payments','Para hareketlerini gör'))}
 ${metric('Ne kadar para çıktı?',signed(String(outgoing)),'Nakit ve kart ödemeleri ile iadeler. Giderin kaydı ile ödendiği gün farklı olabilir.',reportButton('payments','Ödeme ve iadeleri gör'))}
 ${metric('Ne kadar kazandım?',data.profitAvailable?signed(data.operatingResultMinor):'Henüz hesaplanamıyor',profitNote,profitAction,!data.profitAvailable?'report-attention':BigInt(data.operatingResultMinor)<0n?'report-negative':'report-positive')}
 </div>
 ${!data.profitAvailable?`<aside class="report-attention report-explanation"><h4>Kazanç hesabını tamamlamak için</h4><p>${html(data.missingCostLines)} satış satırının maliyet dayanağı eksik veya stok tüketimi bekliyor. Ürünleri ve her biri için kontrol edilecek kaydı görebilirsiniz.</p>${reportButton('costs','Eksik maliyetleri incele')}</aside>`:''}
 <div class="report-summary-grid">
 <section class="report-explanation"><h4>Satış tutarı nasıl oluştu?</h4><dl class="report-breakdown">${pair('İlk sipariş tutarı',gross)}${pair('İptaller (düşüldü)',cancelled)}${pair('İndirim ve ikramlar (düşüldü)',adjustment)}${pair('Net sipariş / satış',data.netSalesMinor)}</dl><p>Bu dönemde veresiye yazılan: <strong>${money(data.creditSalesMinor)}</strong>. Bu bir tahsilat değildir.</p>${reportButton('adjustments','İndirim, ikram ve iptaller')}${reportButton('receivables','Veresiye hareketleri')}</section>
 <section class="report-explanation"><h4>Para neden arttı / azaldı?</h4><dl class="report-breakdown">${pair('Nakit girişleri',total('in','cash'))}${pair('Kart girişleri',total('in','card'))}${pair('Nakit çıkışları',total('out','cash'))}${pair('Kart çıkışları',total('out','card'))}${pair('Giren − çıkan',movement)}</dl><p>${movement<0n?'Bu dönemde çıkan para, giren paradan fazla. Bu tek başına zarar anlamına gelmez.':'Bu dönemde giren para, çıkan paradan az değil. Bu tek başına kazancı göstermez.'} Bu fark kasadaki mevcut bakiye değildir; diğer kasa hareketleri ve teslimler ayrıca izlenir.</p>${reportButton('payments','Tüm para hareketleri')}${reportButton('cash','Diğer kasa hareketleri')}</section>
 <section class="report-explanation"><h4>Hangi giderler kaydedildi?</h4><dl class="report-breakdown">${pair('İşletme + personel gideri',data.expensesMinor)}${pair('Personel avansı (ayrı)',data.staffAdvancesMinor)}${pair('Ekipman (ayrı)',data.equipmentMinor)}</dl><p>Gider tarihine göre gösterilir; henüz ödenmemiş kayıtlar da dahildir. Avans ve ekipman, yukarıdaki işletme + personel giderine dahil değildir.</p><div class="report-actions">${reportButton('expenses','İşletme giderleri')}${reportButton('staff','Personel ve avans')}${reportButton('equipment','Ekipman')}${reportButton('purchases','Mal alışları')}</div></section>
 <section id="report-profit" class="report-explanation" tabindex="-1"><h4>Kazanç nasıl hesaplanır?</h4>${data.profitAvailable?`<dl class="report-breakdown">${pair('Net satış',data.netSalesMinor)}${pair('Satılan ürünlerin maliyeti (düşüldü)',data.knownCostMinor)}${pair('Gider öncesi kazanç',data.grossProfitMinor)}${pair('İşletme + personel gideri (düşüldü)',data.expensesMinor)}${pair('Giderler sonrası sonuç',data.operatingResultMinor)}</dl><p>Bu sonuç nakit bakiyesi değildir. Mal alışının tamamı yerine satılan ürünlerin maliyeti düşülür; avans ve ekipman ayrı izlenir.</p>`:`<p>Satılan ürünlerin tüm maliyetleri doğrulanınca net satıştan ürün maliyeti ve işletme/personel giderleri düşülür.</p><p>Maliyet bilgileri tamamlanmadan kazanç veya zarar gösterilmez.</p>${reportButton('costs','Hangi ürünün maliyeti eksik?')}`}</section>
 <section class="report-explanation"><h4>En çok satış tutarı hangi ürünlerden?</h4>${data.products.length?`<ol class="report-product-ranking">${data.products.slice(0,5).map(row=>`<li><div><strong>${html(row.name)}</strong><span>${html(formatQuantity(row.quantity))} ${html(row.unitCode)}</span></div><strong>${money(row.amountMinor)}</strong></li>`).join('')}</ol>`:'<p>Bu dönemde satış yok.</p>'}${reportButton('products','Bütün ürünleri karşılaştır')}</section>
 <section class="report-explanation"><h4>Şu anda bekleyenler</h4><p class="report-scope-note">Güncel durumdur; seçilen dönemin sonundaki bakiye değildir.</p><dl class="report-breakdown"><div><dt>Açık hesap</dt><dd>${html(data.openGroups)} hesap</dd></div>${pair('Müşterilerden alacak',data.currentReceivableMinor)}${pair('Tedarikçilere borç',data.currentPayableMinor)}</dl>${reportButton('receivables','Müşteri hareketleri')}${reportButton('payables','Tedarikçi hareketleri')}<p>Masa / hesaplar raporu seçilen dönemde açılan hesapları listeler.</p>${reportButton('groups','Dönemde açılan hesaplar')}</section>
 </div><p><a href="/api/reports/export?${html(query)}">Ürün satışlarını CSV indir</a></p>`;
}
const costIssues={snapshot:['Satışın stok bilgisi eksik','Geçmiş satış kaydını kontrol edin; bugünkü ürün ayarı bu satışın maliyetini kendiliğinden tamamlamaz.'],tracking:['Satış anında stok takibi kapalıydı','Yeni satışlar için ürünün stok takibini kontrol edin. Geçmiş satışın maliyeti otomatik oluşmaz.'],manual:['Stok tüketimi elle izleniyordu','Satışla ilişkili stok hareketini kontrol edin. Bu satış için doğrulanmış otomatik maliyet yok.'],pending:['Stok tüketimi tamamlanmadı','Stok ekranındaki bekleyen satış tüketimlerini ve stok miktarını kontrol edin.'],cost:['Tüketilen stoğun maliyeti eksik','Alış ve stok girişlerindeki maliyetleri kontrol edin. Yeni giriş geçmiş maliyeti kendiliğinden değiştirmez.']};
const labels={id:'No',date:'Tarih',name:'Kayıt',staff:'Personel',quantity:'Miktar',unit:'Birim',amount_minor:'Tutar',unit_cost_minor:'Birim maliyeti (kuruş)',kind:'Tür / durum',method:'Yöntem',source_id:'Bağlı kayıt',target_id:'Birleştirilen hedef hesap',actor:'İşlemi yapan',reason:'Açıklama',due_date:'Vade',warehouse:'Depo',lot_code:'Parti',account_type:'Hesap',batch_code:'Hazırlama partisi',expected_amount_minor:'Beklenen nakit',counted_amount_minor:'Sayılan nakit',difference_amount_minor:'Fark',expected_pos_amount_minor:'Beklenen POS',counted_pos_amount_minor:'Sayılan POS'};
function cell(key,value,kind){
 if(value===null||value===undefined)return '—';
 if(key.endsWith('_minor')&&key!=='unit_cost_minor')return signed(value);
 if(key==='quantity'||key==='unit_cost_minor')return formatQuantity(value);
 if(key==='kind')return kindLabel(kind,value);
 if(key==='cost_issue')return costIssues[value]?.[0]||'Maliyet kaydını kontrol edin';
 if(key==='method')return ({cash:'Nakit',card:'POS'})[value]||'Tanımlanmamış yöntem ('+value+')';
 if(key==='account_type')return accountLabel(value);
 if(key==='date'||key==='due_date'){const date=new Date(value);if(!Number.isNaN(date.getTime()))return new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',...(key==='date'?{timeStyle:'short'}:{}),timeZone:'Europe/Istanbul'}).format(date);}
 return value;
}
export function detailTableHtml(data){
 if(data.kind==='costs')return data.rows.length?`<div class="report-cost-list">${data.rows.map(row=>`<article class="report-cost-row" data-report-row><h4>${html(row.name)}</h4><p class="report-cost-meta">${html(formatQuantity(row.quantity))} ${html(row.unit)} · Adisyon #${html(row.source_id)} · Satış satırı #${html(row.id)}${row.date?' · '+html(cell('date',row.date)):''}</p><p><strong>Neden eksik?</strong> ${html(cell('cost_issue',row.cost_issue))}</p>${row.reason?`<p>Kayıttaki açıklama: ${html(row.reason)}</p>`:''}<p><strong>Ne yapmalıyım?</strong> ${html(costIssues[row.cost_issue]?.[1]||'İlgili satış ve stok kaydını kontrol edin.')}</p></article>`).join('')}</div>`:'<p>Bu tarih aralığında maliyeti eksik satış satırı yok.</p>';
 const columns=Object.keys(data.rows[0]||{});
 return data.rows.length?`<div class="business-table-wrap"><table class="business-table"><thead><tr>${columns.map(key=>'<th>'+html(labels[key]||key)+'</th>').join('')}</tr></thead><tbody>${data.rows.map(row=>'<tr>'+columns.map(key=>'<td>'+html(cell(key,row[key],data.kind))+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`:'<p>Bu tarih aralığında bu alana ait kayıt yok.</p>';
}
export function productSalesHtml(data){
 return `<p>İptaller hariçtir. İkram ve indirim tutarı azaltır; ürün miktarını azaltmaz. Hazırlanan yiyeceklerin miktarı hazır ürün stoğu değildir.</p><label>Ürün ara<input id="sold-product-search" type="search" placeholder="Tost, çerez…"></label><div class="business-table-wrap"><table class="business-table"><thead><tr><th>Ürün</th><th>Satılan miktar</th><th>Birim</th><th>Net tutar</th></tr></thead><tbody>${data.products.map(row=>`<tr data-sold-name="${html(row.name.toLocaleLowerCase('tr-TR'))}"><td>${html(row.name)}</td><td>${html(formatQuantity(row.quantity))}</td><td>${html(row.unitCode)}</td><td>${html(formatPrice(row.amountMinor))}</td></tr>`).join('')||'<tr><td colspan="4">Bu dönemde satış yok.</td></tr>'}</tbody></table></div>`;
}
export const auditHtml=data=>data.events.length?`<p>En çok 500 son işlem gösterilir.</p><div class="business-table-wrap"><table class="business-table"><thead><tr><th>Zaman</th><th>İşlemi yapan</th><th>İşlem</th><th>Sonuç</th></tr></thead><tbody>${data.events.map(row=>'<tr><td>'+html(cell('date',row.createdAtUtc))+'</td><td>'+html(row.actorName||'—')+'</td><td>'+html(actionLabel(row.action))+'</td><td>'+html(outcomeLabel(row.outcome))+'</td></tr>').join('')}</tbody></table></div>`:'<p>Bu dönemde işlem kaydı yok.</p>';
