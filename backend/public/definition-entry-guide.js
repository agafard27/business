import {fieldHelp,unitName,quantityRows,quantityInput,showField} from './data-entry.js';
import {formatQuantity} from './quantity-format.js';
export function optionGuide(node,meta,product){
  const form=node.querySelector('form'),control=name=>form.elements.namedItem(name);
  fieldHelp(control('code'),'Servis için benzersiz kısa kod. Ürün kodu ile servis kodu ayrıdır; örnek: TOST-TEK.');
  fieldHelp(control('name'),'Sipariş alan kişinin göreceği servis adı; örnek: Tek porsiyon veya Yarım ekmek.');
  fieldHelp(control('basisQuantity'),'Fiyatın kaç SATIŞ BİRİMİ için olduğu. Adet satışta genellikle 1; satış birimi gram, fiyat kilogram başına ise 1000.');
  fieldHelp(control('contentQuantity'),`Bir satış birimi başına gerçek stok içeriği (${unitName(meta,product.id)}). Paket satıyorsanız paketin gerçek içeriği gerekir. Reçeteli üründe bu alan malzeme reçetesinin yerine geçmez.`);
  fieldHelp(control('price'),'Yukarıdaki fiyat miktarının tamamına ait satış fiyatı, TL. Örnek: fiyat miktarı 1000 g ise kilogram fiyatını yazın.');
  fieldHelp(control('recipeMultiplier'),'Bir satış biriminin tükettiği REÇETE PARTİSİ oranı. Reçete 1 porsiyonluksa 1; 10 porsiyonluk reçeteden 1 porsiyon satılıyorsa 0,1. Çıktı miktarı otomatik bölünmez.');
  quantityRows(node.querySelector('#option-components'),meta);
  const preview=form.ownerDocument.createElement('p');preview.className='entry-preview';preview.setAttribute('role','status');form.append(preview);form.append(form.querySelector('[type=submit]'));form.querySelector('[type=submit]').textContent='Servis sürümünü kaydet';
  function update(){
    const hasComponents=control('hasComponents').checked;
    const components=node.querySelector('#option-components');components.hidden=!hasComponents;
    for(const field of components.querySelectorAll('input,select,button')){field.disabled=!hasComponents;field.toggleAttribute('data-unavailable',!hasComponents);}
    const recipe=meta.recipes.find(row=>row.versionId===control('recipeVersionId').value);
    showField(control('recipeMultiplier'),Boolean(recipe));
    preview.textContent=recipe?`Seçili reçete: ${recipe.name}, v${recipe.version}; bir partinin çıktısı ${formatQuantity(recipe.outputQuantity)} ${unitName(meta,product.id)}. Bir satış birimi, girdiğiniz çarpan kadar partinin bütün malzemelerini tüketir. Yeni servis sürümü eski satışları değiştirmez.`:product.stockMode==='recipe'?'Bu ürün reçeteden tüketir. Bu servise doğrulanmış reçete seçmeden yapılan satışın malzeme tüketimi kontrol bekler.':'Stok tüketimini ürünün stok kuralı belirler. Servis içeriğini ve satış birimini kontrol edin. Yeni sürüm eski satışları değiştirmez.';
  }
  for(const event of ['change','rowschange'])node.addEventListener(event,update);update();
}
export function recipeGuide(node,meta){
  const form=node.querySelector('form');quantityRows(node.querySelector('#recipe-inputs'),meta);
  const update=()=>fieldHelp(form.elements.namedItem('outputQuantity'),`Bu reçetede yazacağınız BÜTÜN malzemelerden çıkan toplam ${unitName(meta,form.elements.namedItem('productId').value)} miktarı. Örnek: reçete 10 tostluksa 10 yazın ve malzemelerin 10 tostluk toplamını girin. Satış servisine bağlarken birim başına parti oranını ayrıca kontrol edin.`);
  node.addEventListener('change',update);update();form.querySelector('[type=submit]').textContent='Reçete sürümünü kaydet';
}
export const normalizedRows=rows=>rows.map(row=>({...row,quantity:quantityInput(row.quantity,{label:'Malzeme miktarı'})}));
export function stockRuleGuide(form){
  fieldHelp(form.elements.namedItem('unitId'),'Bütün stok giriş, sayım ve reçetelerinde kullanılacak ana birim. Örnek: ekmek için adet, dilimle sayılan kaşar için dilim. Gram ile dilim aynı şey değildir.');
  fieldHelp(form.elements.namedItem('stockMode'),'Hazır şişe: ürünün kendisi. Sipariş üzerine tost: reçete malzemeleri. Takip yok: satış miktarı kaydolur, malzeme tüketimi oluşmaz.');
  fieldHelp(form.elements.namedItem('stockTiming'),'Sipariş kaydı/gönderimi ödeme anı değildir. Hazırlamaya başlayınca seçimi mutfak aşamasını bekler. Elle hareket otomatik satış tüketimi yapmaz.');
}
