import {fieldHelp,showField,unitName,quantityInput,quantityScaled} from './data-entry.js';
import {formatQuantity} from './quantity-format.js';
export function mountStockGuide(form,data,meta){
  const control=name=>form.elements.namedItem(name),lotSelect=control('lotId');
  const preview=form.ownerDocument.createElement('p');preview.className='entry-preview';preview.setAttribute('role','status');form.append(preview);form.append(form.querySelector('[type=submit]'));
  control('expectedQuantity').readOnly=true;
  fieldHelp(control('expectedQuantity'),'Miktar sistemden alınır. İşlem sırasında stok değişirse sayım kaydedilmez; güncel stokla yeniden kontrol edin.');
  fieldHelp(control('reason'),'Sayım farkının veya çıkışın nedenini yazın. Örnek: kırılan 2 şişe, personel yemeği, açılışta sayılan stok.');
  const label=(name,text)=>{control(name).closest('label').firstChild.textContent=text;};
  function update(event){
    const product=meta.products.find(row=>row.id===control('productId').value),warehouseId=control('warehouseId').value,kind=control('kind').value,opening=kind==='opening',count=kind==='count';
    if(!event||['productId','warehouseId'].includes(event.target?.name)){
      const prior=event?null:lotSelect.value;
      const option=(name,value)=>{const node=form.ownerDocument.createElement('option');node.textContent=name;node.value=value;return node;};
      lotSelect.replaceChildren(option('Ürünün bütün stoğu',''),...data.lots.filter(lot=>lot.productId===product?.id&&lot.warehouseId===warehouseId).map(lot=>option(`${lot.code} · ${formatQuantity(lot.quantity)}`,lot.id)));
      if(prior)lotSelect.value=prior;
    }
    showField(lotSelect,!opening);lotSelect.required=count&&Boolean(product?.trackLots);
    const lot=data.lots.find(row=>row.id===lotSelect.value&&row.productId===product?.id&&row.warehouseId===warehouseId);
    const before=lot?.quantity||data.balances.find(row=>row.productId===product?.id&&row.warehouseId===warehouseId)?.quantity||'0';
    control('expectedQuantity').value=before;
    showField(control('expectedQuantity'),count);
    let counted=null;try{counted=quantityScaled(quantityInput(control('quantity').value,{zero:count}));}catch{}
    const needsCost=opening||(count&&counted!==null&&counted>quantityScaled(before));
    showField(control('cost'),needsCost);control('cost').required=needsCost;
    for(const name of ['lotCode','expiresDate'])showField(control(name),opening);
    label('quantity',count?`Fiziksel sayım sonucu (${unitName(meta,product?.id)})`:`${opening?'Eklenecek':'Stoktan çıkacak'} miktar (${unitName(meta,product?.id)})`);
    label('cost',opening?'Eklenecek stoğun toplam alış maliyeti (TL)':'Yalnız sayım fazlasının toplam maliyeti (TL)');
    fieldHelp(control('quantity'),count?'Rafta saydığınız son miktarı yazın; fark miktarını yazmayın. Sıfır da girilebilir. Ondalık için 0,5; binlik ayırıcı kullanmayın.':'Ürünün yukarıda yazan stok birimini kullanın. Ondalık için 0,5; binlik ayırıcı kullanmayın.');
    fieldHelp(control('cost'),opening?'Bütün başlangıç miktarının toplam maliyeti; tek ürün fiyatı değildir. Bilmediğiniz maliyeti sıfır veya tahmin olarak girmeyin.':`Yeni bulunan fazla miktarın maliyeti. Mevcut ${formatQuantity(before)} birimin maliyetini tekrar dahil etmeyin.`);
    preview.textContent=opening?'Başlangıç stoğu yalnız program öncesinden kalan ilk stok içindir. Yeni satın alınan malı Alış / mal kabulü ekranından girin; böylece stok ve tedarikçi borcu birlikte izlenir. Bu işlem ödeme veya satış oluşturmaz.':count?`Sistemde: ${formatQuantity(before)} ${unitName(meta,product?.id)}. Fiziksel son miktarı girince yalnız fark stok hareketi olarak kaydedilir. Satış veya tahsilat oluşmaz.${product?.trackLots?' Partili ürün: sayacağınız partiyi seçin.':''}`:'Bu işlem seçilen miktarı stoktan çıkarır ve gerekçesini saklar. Müşteriye yapılan satışı adisyondan girin; burada tekrar çıkış yapmayın.';
  }
  for(const event of ['change','input'])form.addEventListener(event,update);update();form.querySelector('[type=submit]').textContent='Stok işlemini kaydet';
}
