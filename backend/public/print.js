import {formatQuantity} from './quantity-format.js';
import {html,formatPrice} from './business-ui.js';
export function printDocument(title,content){
  const existing=document.getElementById('nar-print');if(existing)existing.remove();
  const node=document.createElement('section');node.id='nar-print';node.innerHTML=`<h1>${html(title)}</h1><p>${html(new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date()))}</p>${content}`;
  document.body.append(node);try{window.print();}finally{node.remove();}
}
export function printAccount(group){
  printDocument(`Hesap özeti #${group.id}`,`<p class="print-table"><strong>Masa: ${html(group.tableName||'Masasız adisyon')}</strong></p><table>${group.lines.map(line=>`<tr><td>${html(line.productName)} · ${html(line.optionName)}<br>${html(formatQuantity(line.quantity))} ${html(line.unitCode)} ${line.state==='cancelled'?'· İPTAL':''}</td><td>${html(formatPrice(line.totalMinor))}</td></tr>`).join('')}</table><p>Toplam: ${html(formatPrice(group.totalMinor))}</p><p>Kapatılan: ${html(formatPrice(group.settledMinor))}</p><p>Kalan: ${html(formatPrice(group.remainingMinor))}</p><p>Hesap bilgilendirme çıktısı</p>`);
}
export function printTicket(ticket){printDocument(`Hazırlık #${ticket.id}`,`<p>${html(ticket.tableName||`Hesap #${ticket.groupId}`)}</p><h2>${html(ticket.productName)}</h2><p>${html(ticket.optionName)} · ${html(formatQuantity(ticket.quantity))} ${html(ticket.unitCode)}</p><p>${html(ticket.note||'')}</p>`);}
