import {formatPrice,parsePrice} from './catalog.js';

// User input uses Turkish decimals; API quantities remain canonical decimal strings.
// A dot is also accepted as a decimal mark, never as a thousands separator.
export function quantityInput(value,{zero=false,label='Miktar'}={}){
  const source=String(value??'').trim();
  if(!/^(0|[1-9][0-9]{0,8})([,.][0-9]{1,6})?$/.test(source))throw new Error(`${label}: 2 veya 0,5 gibi yazın. Binlik ayırıcı kullanmayın; en fazla 6 ondalık basamak girin.`);
  const canonical=source.replace(',','.');
  if(!zero&&quantityScaled(canonical)===0n)throw new Error(`${label} sıfırdan büyük olmalı.`);
  return canonical;
}
export function quantityScaled(value){const [whole,fraction='']=String(value).split('.');return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));}
export const unitName=(meta,productId)=>{const product=meta.products.find(row=>row.id===productId);return meta.units.find(row=>row.id===product?.unitId)?.name||product?.unitCode||'birim tanımlanmamış';};
let helpSequence=0;
export function fieldHelp(control,text){
  if(!control)return;
  let help=control.closest('label').querySelector('.field-help');
  if(!help){help=control.ownerDocument.createElement('small');help.className='field-help';help.id=`entry-help-${++helpSequence}`;control.closest('label').append(help);control.setAttribute('aria-describedby',[control.getAttribute('aria-describedby'),help.id].filter(Boolean).join(' '));}
  help.textContent=text;
}
export function showField(control,visible){
  control.closest('label').hidden=!visible;control.disabled=!visible;
  control.toggleAttribute('data-unavailable',!visible);
}
export function quantityRows(node,meta){
  const update=()=>node.querySelectorAll('.editable-row').forEach(row=>{
    const product=row.querySelector('[name^=productId-]');
    const amount=row.querySelector('[name^=quantity-]');
    if(product&&amount)fieldHelp(amount,`Seçili malzemenin stok birimi: ${unitName(meta,product.value)}. Örnek: yarım birim için 0,5. Gram veya paket içeriğini tahmin etmeyin.`);
  });
  for(const event of ['change','rowschange'])node.addEventListener(event,update);update();
}
export function paymentGuide(form,shifts,remainingMinor){
  fieldHelp(form.elements.namedItem('amount'),`Tutar TL olarak girilir (ör. 150,50). Kalan: ${formatPrice(remainingMinor)}. Kısmi ödeme yapabilirsiniz.`);
  const info=form.ownerDocument.createElement('p');info.className='notice';
  info.textContent=shifts.length?'Bu işlem mevcut borcu azaltır. Nakit seçimi kasadan çıkış kaydeder. POS seçimi kart ödemesini kaydeder; cihazdan para çekmez.':'Ödeme kaydetmek için önce Kasa / devir ekranından bir kasa açın.';
  form.prepend(info);form.querySelector('[type=submit]').textContent='Ödemeyi kaydet';
  if(!shifts.length)for(const control of form.querySelectorAll('input,select,button')){control.disabled=true;control.setAttribute('data-unavailable','');}
}
export function paymentAmount(value,remainingMinor){const amount=parsePrice(value);if(BigInt(amount)<=0n||BigInt(amount)>BigInt(remainingMinor))throw new Error(`Ödeme sıfırdan büyük olmalı ve kalan ${formatPrice(remainingMinor)} tutarını aşmamalı.`);return amount;}
