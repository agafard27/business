import {html,formatPrice} from './business-ui.js';
import {parsePrice} from './catalog.js';
import {quantityInput,quantityScaled} from './data-entry.js';
import {formatQuantity} from './quantity-format.js';

const pendingOptions=new Map();
const aliases={g:'g',gr:'g',gram:'g',kg:'kg',kilogram:'kg',ml:'ml',mililitre:'ml',l:'l',lt:'l',litre:'l',liter:'l'};
const scales={g:1n,kg:1000n,ml:1n,l:1000n};
const canonical=unit=>aliases[String(unit.code).toLowerCase()];
function factor(from,to){
  if(from.id===to.id)return 1000000n;
  const a=canonical(from),b=canonical(to);
  return a&&b&&from.dimension===to.dimension&&['mass','volume'].includes(from.dimension)?scales[a]*1000000n/scales[b]:null;
}
const decimal=value=>`${value/1000000n}${value%1000000n?'.'+(value%1000000n).toString().padStart(6,'0').replace(/0+$/,''):''}`;
export function simpleSaleOption(product,units,values){
  const base=units.find(unit=>unit.id===product.baseUnitId),unit=units.find(unit=>unit.id===values.unitId);
  if(product.stockMode==='recipe')throw new Error('Reçeteli servisleri Birimler ve reçeteler ekranında malzemeleriyle tanımla.');
  if(!base||!unit)throw new Error('Ürünün stok birimini ve satış miktarının birimini kontrol et.');
  const ratio=factor(unit,base);if(ratio===null)throw new Error('Bu birimin gerçek stok karşılığı bilinmiyor. Ürünün kendi birimini seç.');
  const amount=quantityInput(values.amount),scaled=quantityScaled(amount);
  const priceMinor=parsePrice(values.price),name=String(values.name||'').trim();
  if(!name||name.length>120)throw new Error('Satış adı 1–120 karakter olmalı.');
  if(product.options.some(option=>option.name.trim().toLocaleLowerCase('tr-TR')===name.toLocaleLowerCase('tr-TR')))throw new Error('Bu adlı satış seçeneği zaten var. Mevcut seçeneğin fiyatını değiştirebilirsin.');
  if(values.mode==='weight'){
    if(!['mass','volume'].includes(unit.dimension))throw new Error('Tartılı satışta ağırlık veya hacim birimi seç.');
    return {revision:product.revision,name,unitId:unit.id,basisQuantity:amount,contentQuantity:decimal(ratio),requiresWeight:true,priceMinor,components:[],recipeVersionId:null};
  }
  if(values.mode!=='pack')throw new Error('Satış şeklini seç.');
  const each=units.find(row=>row.code==='adet');if(!each)throw new Error('Adet birimi tanımlı değil. Birimler ekranından kontrol et.');
  if(scaled*ratio%1000000n)throw new Error('Kavanoz içeriği stok biriminde altı ondalıktan daha hassas olamaz.');
  const content=scaled*ratio/1000000n;
  if(content%(10n**BigInt(6-(base.decimalPlaces??6))))throw new Error('İçerik miktarı ürünün stok birimine uygun değil.');
  return {revision:product.revision,name,unitId:each.id,basisQuantity:'1',contentQuantity:quantityInput(decimal(content)),requiresWeight:false,priceMinor,components:[],recipeVersionId:null};
}

export function mountCatalogOptionEntry(host,{product,units,user,request,message,isCurrent,canStart,onEditing,onSaved,onReload=()=>{}}){
  const key=String(user?.id||'local')+':'+product.id;
  const base=units.find(unit=>unit.id===product.baseUnitId),compatible=base?units.filter(unit=>factor(unit,base)!==null):[];
  host.innerHTML=`${!product.options.length?'<p class="catalog-option-empty">Bu ürünün satış fiyatı henüz yok. Sipariş ekranında görünmesi için satış seçeneği ekle.</p>':''}<button type="button" class="secondary" data-new-sale-option>+ Satış seçeneği ekle</button><div data-sale-option-form></div>`;
  const trigger=host.querySelector('[data-new-sale-option]'),target=host.querySelector('[data-sale-option-form]');
  function open(restored=null){
    if(!restored&&!canStart())return;
    onEditing(true);
    if(!base||(product.stockMode==='recipe'&&!restored)){
      target.innerHTML='<p class="notice">Bu ürünün stok birimi / reçeteli servis ayrıntılarını Birimler ve reçeteler ekranından tanımla.</p><button type="button" class="text-button" data-option-cancel>Kapat</button>';
      target.querySelector('button').addEventListener('click',()=>{target.innerHTML='';onEditing(false);});return;
    }
    trigger.hidden=true;
    target.innerHTML=`<form class="catalog-edit-form catalog-option-form"><h4>Yeni satış seçeneği</h4><label>Nasıl satılıyor?<select name="mode"><option value="pack">Kavanoz / paket / adet</option>${['mass','volume'].includes(base.dimension)?'<option value="weight">Tartarak / miktar girerek</option>':''}</select></label><div class="catalog-sale-amount"><label><span data-amount-label>Bir kavanozda / pakette ne kadar var?</span><input name="amount" value="1" required inputmode="decimal"></label><label>Birim<select name="unitId">${compatible.map(unit=>`<option value="${html(unit.id)}" ${unit.id===base.id?'selected':''}>${html(unit.name)} (${html(unit.code)})</option>`).join('')}</select></label></div><label><span data-price-label>Bu kavanozun / paketin fiyatı (TL)</span><input name="price" required inputmode="decimal" placeholder="Satış fiyatını yaz"></label><label>Sipariş ekranındaki adı<input name="name" required maxlength="120"></label><p class="entry-preview" data-option-preview role="status"></p><p class="error" role="alert"></p><div class="editor-buttons"><button type="submit" class="primary">Satış seçeneğini kaydet</button><button type="button" class="secondary" data-option-cancel>Vazgeç</button></div></form>`;
    const form=target.querySelector('form'),field=name=>form.elements.namedItem(name);let lastName='',needsReload=false;
    const values=()=>Object.fromEntries(['mode','amount','unitId','price','name'].map(name=>[name,field(name).value]));
    function preview(){
      const unit=units.find(row=>row.id===field('unitId').value),weighted=field('mode').value==='weight';
      form.querySelector('[data-amount-label]').textContent=weighted?'Fiyat kaç birim için?':'Bir kavanozda / pakette ne kadar var?';
      form.querySelector('[data-price-label]').textContent=weighted?'Bu miktarın satış fiyatı (TL)':'Bu kavanozun / paketin fiyatı (TL)';
      const suggested=`${field('amount').value} ${unit?.code||''}${weighted?' fiyatı':base.dimension==='mass'?' kavanoz':' paket'}`;
      if(!field('name').value||field('name').value===lastName)field('name').value=suggested;lastName=suggested;
      try{
        const payload=simpleSaleOption(product,units,values());
        form.querySelector('[data-option-preview]').textContent=weighted?`${formatQuantity(payload.basisQuantity)} ${unit.code} = ${formatPrice(payload.priceMinor)}. Siparişte gerçek miktar girilir.`:`1 adet ${payload.name} = ${formatPrice(payload.priceMinor)}. İçerik: ${formatQuantity(payload.contentQuantity)} ${base.code}. Siparişte her dokunuş 1 adet ekler.`;
      }catch{form.querySelector('[data-option-preview]').textContent='Miktarı ve fiyatı yaz; satış özeti burada görünecek.';}
    }
    form.addEventListener('input',preview);form.addEventListener('change',preview);preview();
    form.querySelector('[data-option-cancel]').addEventListener('click',()=>{if(pendingOptions.has(key))return;target.innerHTML='';trigger.hidden=false;onEditing(false);if(needsReload)void onReload();else trigger.focus();});
    function paint(state){
      for(const view of state.views){if(!view.form.isConnected){state.views.delete(view);continue;}
        view.form.querySelectorAll('input,select,button').forEach(node=>node.disabled=true);
        const submit=view.form.querySelector('[type=submit]');submit.disabled=state.busy;submit.textContent=state.busy?'Kaydediliyor…':state.result?'Ekranı yenile':'Kaydı kontrol et';view.form.querySelector('.error').textContent=state.error||'';
      }
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();let state=pendingOptions.get(key);if(state?.busy||!isCurrent())return;
      if(!state){
        if(!form.reportValidity())return;
        try{state={payload:{requestKey:crypto.randomUUID(),code:'sale-'+crypto.randomUUID(),...simpleSaleOption(product,units,values())},values:values(),views:new Set(),busy:false,result:null,error:''};pendingOptions.set(key,state);}
        catch(error){form.querySelector('.error').textContent=message(error);return;}
      }
      state.views.add({form});state.busy=true;state.error='';paint(state);
      try{
        state.result??=await request(`/api/definitions/products/${product.id}/options`,{method:'POST',body:JSON.stringify(state.payload)});
        if(!isCurrent()||!host.isConnected)return;
        pendingOptions.delete(key);
        try{if(await onSaved()===false)pendingOptions.set(key,state);}catch(error){pendingOptions.set(key,state);throw error;}
      }catch(error){
        if(!state.result&&error.status&&error.code!=='COMMIT_UNKNOWN'){
          pendingOptions.delete(key);
          form.querySelectorAll('input,select,button').forEach(node=>node.disabled=false);form.querySelector('[type=submit]').textContent='Satış seçeneğini kaydet';form.querySelector('.error').textContent=message(error);
          if(error.code==='REVISION_CONFLICT'){needsReload=true;form.querySelector('[type=submit]').disabled=true;form.querySelector('.error').textContent+=' Vazgeç ile güncel ürünü aç.';}
        }else state.error=state.result?'Satış seçeneği kaydedildi. Ekranı yenile ile devam et.':'Sonuç doğrulanamadı. Kaydı kontrol et ile aynı isteğin sonucunu doğrula.';
      }finally{state.busy=false;if(pendingOptions.get(key)===state)paint(state);}
    });
    if(restored){for(const [name,value] of Object.entries(restored.values))field(name).value=value;preview();restored.views.add({form});paint(restored);}
  }
  trigger.addEventListener('click',()=>open());
  if(pendingOptions.has(key))open(pendingOptions.get(key));
}
