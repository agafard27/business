import {fieldHelp,unitName,quantityInput,quantityScaled} from './data-entry.js';
import {formatPrice,parsePrice} from './catalog.js';
import {formatQuantity} from './quantity-format.js';
export function purchaseItems(rows){
  if(!rows.length)throw new Error('Alışa en az bir ürün satırı ekleyin.');
  return rows.map(({price,...row},index)=>{
    if(!row.productId||!row.unitId)throw new Error(`${index+1}. satırın ürününü ve alış birimini seçin.`);
    return {...row,quantity:quantityInput(row.quantity,{label:`${index+1}. satır alış miktarı`}),actualBaseQuantity:quantityInput(row.actualBaseQuantity,{label:`${index+1}. satır stok miktarı`}),unitPriceMinor:parsePrice(price)};
  });
}
export function mountPurchaseGuide(form,meta){
  const preview=form.ownerDocument.createElement('div');preview.className='entry-preview';preview.setAttribute('role','status');form.querySelector('[type=submit]').before(preview);
  fieldHelp(form.elements.namedItem('number'),'Elinizdeki alış faturasının veya fişin numarası. Belge yoksa sonradan bulabileceğiniz benzersiz bir referans yazın.');
  fieldHelp(form.elements.namedItem('dueDate'),'Borcu ödemeyi planladığınız son gün. Malın son kullanma tarihi değildir.');
  function update(){
    let total=0n,valid=true,count=0;const summaries=[];
    for(const row of form.querySelectorAll('#purchase-items .editable-row')){
      count++;const value=name=>row.querySelector(`[name^="${name}-"]`);
      const product=meta.products.find(item=>item.id===value('productId').value),unit=meta.units.find(item=>item.id===value('unitId').value);
      fieldHelp(value('quantity'),`Kaç ${unit?.name||'alış birimi'} aldınız? Örnek: 2 koli için 2.`);
      fieldHelp(value('actualBaseQuantity'),`${product?.name||'Seçilecek ürün'} stok birimi: ${unitName(meta,product?.id)}. Bütün paketlerin toplam gerçek içeriğini yazın. 2 koli × 24 adet = 48 adet; gramdan dilime tahmin yapılmaz.`);
      fieldHelp(value('price'),`Tek bir ${unit?.name||'alış birimi'} fiyatı, TL. Örnek: koli başına 300 TL ise 300. Belgenin satır toplamını buraya yazmayın.`);
      try{
        if(!product||!unit)throw new Error();
        const quantity=quantityInput(value('quantity').value),base=quantityInput(value('actualBaseQuantity').value),price=BigInt(parsePrice(value('price').value));
        const amount=(quantityScaled(quantity)*price+500000n)/1000000n;total+=amount;
        summaries.push(`${product.name}: ${formatPrice(amount.toString())}; teslim alınınca +${formatQuantity(base)} ${unitName(meta,product.id)}.`);
      }catch{valid=false;}
    }
    preview.textContent=valid&&count?`${summaries.join(' ')} Alış toplamı: ${formatPrice(total.toString())}. Kaydet taslak oluşturur; stok ve tedarikçi borcu Malı teslim al ile oluşur. Ödeme ayrıca kaydedilir.`:'Ürün, alış birimi, miktar, toplam stok içeriği ve birim fiyatı tamamlandığında burada kayıt özeti görünür. Kaydet yalnız alış taslağı oluşturur.';
  }
  for(const event of ['input','change','rowschange'])form.addEventListener(event,update);update();
  form.append(form.querySelector('[type=submit]'));
  form.querySelector('[type=submit]').textContent='Alış taslağını kaydet';
}
