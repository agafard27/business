import {mountCatalogOptionEntry} from './catalog-option-entry.js';
// Amounts cross the API as integer kuruş strings. No floating-point conversion.
export function formatPrice(value) {
  if (!/^\d+$/.test(String(value))) return '—';
  const amount = BigInt(value);
  const whole = (amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${whole},${(amount % 100n).toString().padStart(2, '0')} ₺`;
}

export function parsePrice(value) {
  const match = /^(\d{1,8})(?:[,.](\d{1,2}))?$/.exec(String(value).trim());
  if (!match) throw new Error('Fiyatı 150 veya 150,50 gibi yaz. En fazla iki ondalık basamak kullan.');
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (minor > 9999999999n) throw new Error('Girilen fiyat izin verilen üst sınırı aşıyor.');
  return minor.toString();
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const editablePrice = value => `${BigInt(value) / 100n},${(BigInt(value) % 100n).toString().padStart(2, '0')}`;
const dateLabel = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('tr-TR', {dateStyle:'short', timeStyle:'short', timeZone:'Europe/Istanbul'}).format(date);
};
const basisLabel = version => version?.saleUnitCode === 'g' && Number(version.priceBasisQuantity) === 1000 ? ' / kg' : '';

export async function renderCatalog(container, {request, message, isCurrent, onUnauthorized,user}) {
  const active = () => isCurrent() && container.isConnected;
  let meta;
  let page = 1;
  let selectedId = null;
  let product = null;
  let editor = null;
  let debounce;
  let listSequence = 0;
  let detailSequence = 0;
  let busy = false;
  let pending = null;
  container.innerHTML = '<p class="loading" role="status">Ürünler getiriliyor…</p>';
  try { meta = await request('/api/catalog/meta'); }
  catch (error) {
    if (!active()) return;
    if (error.status === 401) return onUnauthorized();
    container.innerHTML = `<p class="error" role="alert">${escape(message(error))}</p><button id="catalog-retry" class="secondary">Yeniden dene</button>`;
    container.querySelector('#catalog-retry').addEventListener('click', () => renderCatalog(container, {request,message,isCurrent,onUnauthorized,user}));
    return;
  }
  if (!active()) return;
  container.innerHTML = `<div class="catalog-heading"><div><span class="small-label">ÜRÜN YÖNETİMİ</span><h2>Ürünler ve menü</h2><p>Fiyatları ve servis seçeneklerini buradan kontrol edebilirsin.</p></div><button id="catalog-refresh" class="secondary">Listeyi yenile</button></div><div class="catalog-filters"><label for="catalog-search">Ürün ara<input id="catalog-search" type="search" placeholder="Çay, gözleme, kola…" autocomplete="off" maxlength="100"></label><label for="catalog-category">Kategori<select id="catalog-category"><option value="">Tüm kategoriler</option>${meta.categories.map(category => `<option value="${escape(category.id)}">${escape(category.name)}</option>`).join('')}</select></label><label for="catalog-status">Görünüm<select id="catalog-status"><option value="all">Bütün ürünler</option><option value="active">Aktif ürünler</option><option value="inactive">Pasif ürünler</option></select></label></div><p id="catalog-notice" class="success" role="status"></p><div class="catalog-layout"><section aria-label="Ürün listesi"><p id="catalog-count" class="catalog-count" role="status"></p><div id="catalog-list" class="catalog-list"></div><nav id="catalog-pages" class="catalog-pages" aria-label="Ürün sayfaları"></nav></section><section id="catalog-detail" class="panel catalog-detail" aria-label="Seçili ürün"><p class="empty">Ayrıntılarını görmek için bir ürün seç.</p></section></div><p class="notice">Menü fiyatları 21 Ekim tarihli kayıttan alındı. Stok miktarları, reçeteler ve kesin servis gramajları ayrıca tanımlanacak.</p>`;
  const byId = id => container.querySelector(`#${id}`);
  const notice = text => { if (active()) byId('catalog-notice').textContent = text; };
  const importPanel = document.createElement('section');
  importPanel.className = 'panel catalog-import';
  importPanel.setAttribute('aria-label', 'Başlangıç menüsü aktarımı');
  importPanel.hidden = true;
  container.querySelector('.catalog-filters').before(importPanel);
  let importPreview = null;
  let importBusy = false;
  async function showImport(sequence) {
    try {
      importPreview ||= await request('/api/catalog/reference-menu');
      if (!active() || sequence !== listSequence) return;
      const sourceDate = new Intl.DateTimeFormat('tr-TR', {dateStyle:'long',timeZone:'Europe/Istanbul'}).format(new Date(`${importPreview.sourceDate}T12:00:00Z`));
      importPanel.innerHTML = `<h3>Başlangıç menüsünü yükle</h3><p>${escape(sourceDate)} tarihli kayıttan ${escape(importPreview.productCount)} ürün ve ${escape(importPreview.optionCount)} satış seçeneği eklenecek.</p><ul>${importPreview.categories.map(category => `<li>${escape(category.name)}: ${escape(category.productCount)} ürün</li>`).join('')}</ul><p>Aktarımdan sonra fiyatları kontrol edip düzenleyebilirsin. Bu işlem stok, reçete veya servis gramajı oluşturmaz. Tekrar aktarım mevcut ürün ve fiyat düzenlemelerini korur.</p><p class="error" id="catalog-import-error" role="alert"></p><button class="primary" id="catalog-import-button" type="button">${escape(importPreview.productCount)} ürünü içe aktar</button>`;
      importPanel.hidden = false;
      byId('catalog-import-button').addEventListener('click', async () => {
        if (importBusy) return;
        importBusy = true;
        clearTimeout(debounce); ++listSequence; ++detailSequence;
        const button = byId('catalog-import-button');
        button.disabled = true; button.textContent = 'Menü aktarılıyor…';
        byId('catalog-import-error').textContent = '';
        const controls = container.querySelectorAll('.catalog-filters input, .catalog-filters select, #catalog-refresh');
        controls.forEach(control => { control.disabled = true; });
        try {
          const result = await request('/api/catalog/reference-menu/import', {method:'POST',body:'{}'});
          if (!active()) return;
          await renderCatalog(container, {request,message,isCurrent,onUnauthorized,user});
          if (active() && byId('catalog-notice')) notice(result.replayed
            ? 'Menü daha önce aktarılmış. Mevcut ürün ve fiyat düzenlemeleri korundu.'
            : `${result.productCount} ürün ve ${result.optionCount} satış seçeneği aktarıldı. Fiyatları kontrol edebilirsin.`);
        } catch (error) {
          if (!active()) return;
          if (error.status === 401) return onUnauthorized();
          byId('catalog-import-error').textContent = !error.status || error.code === 'COMMIT_UNKNOWN'
            ? 'Aktarım sonucu doğrulanamadı. Aynı düğmeyle kontrol edebilirsin; ürünler ikinci kez eklenmez.' : message(error);
          button.disabled = false; button.textContent = 'Aktarımı yeniden kontrol et';
          controls.forEach(control => { control.disabled = false; });
        } finally { importBusy = false; }
      });
    } catch (error) {
      if (!active() || sequence !== listSequence) return;
      if (error.status === 401) return onUnauthorized();
      notice(message(error));
    }
  }
  function canLeaveEditor() {
    if (!editor) return true;
    notice('Önce açık düzenlemeyi kaydet veya Vazgeç düğmesine bas.');
    return false;
  }
  async function loadList(selectFirst = false) {
    if (!active()) return;
    const sequence = ++listSequence;
    const query = new URLSearchParams({search:byId('catalog-search').value.trim(),categoryId:byId('catalog-category').value,status:byId('catalog-status').value,page:String(page),pageSize:'20'});
    byId('catalog-count').textContent = 'Liste güncelleniyor…';
    try {
      const result = await request(`/api/catalog/products?${query}`);
      if (!active() || sequence !== listSequence) return;
      if (!result.products.length && result.total > 0 && page > 1) { page = Math.max(1, Math.ceil(result.total / 20)); return loadList(selectFirst); }
      byId('catalog-count').textContent = `${result.total} ürün${result.total ? ` · ${page}. sayfa` : ''}`;
      importPanel.hidden = true;
      if (!result.total && !query.get('search') && !query.get('categoryId') && query.get('status') === 'all') void showImport(sequence);
      byId('catalog-list').innerHTML = result.products.length ? result.products.map(item => {
        const prices = item.options.filter(option => option.currentVersion).map(option => `${option.name === 'Standart' ? '' : `${option.name}: `}${formatPrice(option.currentVersion.unitPriceMinor)}${basisLabel(option.currentVersion)}`);
        return `<button class="catalog-item${selectedId === item.id ? ' selected' : ''}" data-product="${escape(item.id)}" type="button" aria-pressed="${selectedId === item.id}"><span class="catalog-item-head"><strong>${escape(item.name)}</strong><span class="product-state${item.isActive ? '' : ' inactive'}">${item.isActive ? 'Aktif' : 'Pasif'}</span></span><span class="catalog-category-name">${escape(item.categoryName || 'Kategori yok')}</span><span class="catalog-price">${escape(prices.join(' · ') || 'Fiyat henüz tanımlı değil')}</span></button>`;
      }).join('') : '<div class="panel"><p class="empty">Bu aramada ürün bulunamadı. Aramayı veya filtreleri değiştirebilirsin.</p></div>';
      byId('catalog-list').querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => { if (canLeaveEditor()) void selectProduct(button.dataset.product, true); }));
      const pages = Math.max(1, Math.ceil(result.total / 20));
      byId('catalog-pages').innerHTML = `<button class="secondary" id="catalog-prev" ${page <= 1 ? 'disabled' : ''}>← Önceki</button><span>${page} / ${pages}</span><button class="secondary" id="catalog-next" ${page >= pages ? 'disabled' : ''}>Sonraki →</button>`;
      byId('catalog-prev').addEventListener('click', () => { if (canLeaveEditor()) { page--; void loadList(true); } });
      byId('catalog-next').addEventListener('click', () => { if (canLeaveEditor()) { page++; void loadList(true); } });
      if (selectFirst && !editor) {
        if (result.products.length) await selectProduct(result.products[0].id);
        else { selectedId = null; product = null; byId('catalog-detail').innerHTML = '<p class="empty">Seçili ürün yok.</p>'; }
      }
    } catch (error) {
      if (!active() || sequence !== listSequence) return;
      if (error.status === 401) return onUnauthorized();
      byId('catalog-count').textContent = 'Liste şu anda alınamadı.';
      notice(message(error));
    }
  }
  async function selectProduct(id, scroll = false) {
    const sequence = ++detailSequence;
    byId('catalog-detail').innerHTML = '<p role="status">Ürün açılıyor…</p>';
    try {
      const result = await request(`/api/catalog/products/${id}`);
      if (!active() || sequence !== detailSequence) return;
      selectedId = id; product = result.product; editor = null; pending = null; renderDetail();
      byId('catalog-list').querySelectorAll('[data-product]').forEach(button => { const selected = button.dataset.product === id; button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',String(selected)); });
      if (scroll && matchMedia('(max-width: 820px)').matches) byId('catalog-detail').scrollIntoView({block:'start',behavior:'auto'});
    } catch (error) {
      if (!active() || sequence !== detailSequence) return;
      if (error.status === 401) return onUnauthorized();
      byId('catalog-detail').innerHTML = `<p class="error" role="alert">${escape(message(error))}</p>`;
    }
  }
  function versionHistory(option) {
    const older = (option.versions || []).filter(version => version.id !== option.currentVersion?.id);
    return older.length ? `<details class="price-history"><summary>Önceki fiyatlar (${older.length})</summary><ul>${older.map(version => `<li><strong>${escape(formatPrice(version.unitPriceMinor))}${escape(basisLabel(version))}</strong><span>${escape(dateLabel(version.validFromUtc))}</span></li>`).join('')}</ul></details>` : '';
  }
  function renderDetail() {
    byId('catalog-detail').innerHTML = `<div class="catalog-detail-heading"><div><span class="small-label">ÜRÜN AYRINTISI</span><h2>${escape(product.name)}</h2><p>${escape(product.categoryName || 'Kategori yok')}</p></div><span class="product-state${product.isActive ? '' : ' inactive'}">${product.isActive ? 'Aktif' : 'Pasif'}</span></div><div id="product-editor"></div><div class="product-tools"><button class="text-button" id="edit-product">Ürün bilgisini düzenle</button><span class="muted">${escape(product.code)}</span></div><h3 class="option-heading">Satış seçenekleri</h3><div id="catalog-option-entry"></div><div class="option-list">${product.options.map(option => `<article class="option-card"><div class="option-top"><div><strong>${escape(option.name)}</strong><p>${escape(option.currentVersion?.requiresWeight ? 'Gram girilerek satılır' : 'Adet / servis olarak satılır')}</p></div><div class="option-amount">${escape(formatPrice(option.currentVersion?.unitPriceMinor))}<small>${escape(basisLabel(option.currentVersion).trim())}</small></div></div><div id="price-editor-${escape(option.id)}"></div><button class="text-button" data-edit-price="${escape(option.id)}">Fiyatı değiştir</button>${versionHistory(option)}</article>`).join('')}</div>`;
    byId('edit-product').addEventListener('click', () => { if (canLeaveEditor()) openEditor('product'); });
    byId('catalog-detail').querySelectorAll('[data-edit-price]').forEach(button => button.addEventListener('click', () => { if (canLeaveEditor()) openEditor(button.dataset.editPrice); }));
    mountCatalogOptionEntry(byId('catalog-option-entry'),{product,units:meta.units,user,request,message,isCurrent:active,canStart:canLeaveEditor,onEditing:value=>{editor=value?'new-option':null;},onReload:()=>selectProduct(product.id),onSaved:async()=>{
      const id=product.id,result=await request(`/api/catalog/products/${id}`);
      if(!active()||product.id!==id)return false;
      product=result.product;editor=null;renderDetail();notice('Satış seçeneği kaydedildi. Masa sipariş ekranını yenileyince görünür.');void loadList();return true;
    }});
  }
  function openEditor(type) {
    editor = type; pending = null;
    const option = type === 'product' ? null : product.options.find(item => item.id === type);
    const target = type === 'product' ? byId('product-editor') : byId(`price-editor-${type}`);
    target.innerHTML = `<form id="catalog-edit-form" class="catalog-edit-form">${option ? `<label for="edit-price">Yeni fiyat${basisLabel(option.currentVersion)}</label><input id="edit-price" inputmode="decimal" value="${escape(editablePrice(option.currentVersion.unitPriceMinor))}" maxlength="11" required><p class="field-hint">Örn. 150,50. Eski satışlar ve önceki fiyatlar korunur.</p>` : `<label for="edit-name">Ürün adı</label><input id="edit-name" value="${escape(product.name)}" maxlength="180" required><label for="edit-category">Kategori</label><select id="edit-category"><option value="">Kategori yok</option>${meta.categories.map(category => `<option value="${escape(category.id)}" ${category.id === product.categoryId ? 'selected' : ''}>${escape(category.name)}</option>`).join('')}</select><label class="active-choice"><input id="edit-active" type="checkbox" ${product.isActive ? 'checked' : ''}> Ürün aktif</label><p class="field-hint">Pasif ürünün kaydı ve geçmişi silinmez.</p>`}<p class="error" id="catalog-edit-error" role="alert"></p><div class="editor-buttons"><button class="primary" id="catalog-save" type="submit">Kaydet</button><button class="secondary" id="catalog-cancel" type="button">Vazgeç</button></div></form>`;
    document.getElementById(option ? 'edit-price' : 'edit-name').focus();
    byId('catalog-cancel').addEventListener('click', () => { if (busy) return; editor = null; pending = null; notice(''); renderDetail(); });
    byId('catalog-edit-form').addEventListener('submit', event => { event.preventDefault(); void saveEditor(option); });
  }
  async function saveEditor(option) {
    if (busy) return;
    const errorNode = byId('catalog-edit-error'); errorNode.textContent = '';
    if (!pending) {
      try {
        pending = {requestKey:crypto.randomUUID(),revision:product.revision,...(option ? {optionId:option.id,priceMinor:parsePrice(byId('edit-price').value)} : {name:byId('edit-name').value.trim(),categoryId:byId('edit-category').value || null,isActive:byId('edit-active').checked})};
        if (!option && !pending.name) { pending = null; throw new Error('Ürün adı boş bırakılamaz.'); }
      } catch (error) { errorNode.textContent = message(error); return; }
    }
    busy = true;
    const form = byId('catalog-edit-form');
    form.querySelectorAll('input, select, button').forEach(field => { field.disabled = true; });
    byId('catalog-save').textContent = 'Kaydediliyor…';
    try {
      const result = await request(`/api/catalog/products/${product.id}${option ? '/prices' : ''}`, {method:option ? 'POST' : 'PATCH',body:JSON.stringify(pending)});
      if (!active()) return;
      product = result.product; editor = null; pending = null; busy = false;
      renderDetail(); notice(option ? 'Yeni fiyat kaydedildi. Önceki fiyat geçmişte korundu.' : 'Ürün bilgileri kaydedildi.');
      void loadList();
    } catch (error) {
      if (!active()) return;
      busy = false;
      if (error.status === 401) return onUnauthorized();
      const uncertain = !error.status || error.code === 'COMMIT_UNKNOWN';
      errorNode.textContent = uncertain ? 'Kayıt sonucu doğrulanamadı. Aynı düğmeyle yeniden kontrol edebilirsin.' : message(error);
      byId('catalog-save').disabled = false;
      byId('catalog-save').textContent = uncertain ? 'Kaydı kontrol et' : 'Kaydet';
      if (!uncertain) { pending = null; form.querySelectorAll('input, select, button').forEach(field => { field.disabled = false; }); }
      if (error.status === 409 && error.code !== 'COMMIT_UNKNOWN') {
        errorNode.textContent += ' Güncel ürünü yeniden açıp değişikliği tekrar yap.';
        byId('catalog-save').disabled = true; byId('catalog-cancel').textContent = 'Güncel ürünü aç';
        byId('catalog-cancel').addEventListener('click', () => void selectProduct(product.id), {once:true});
      }
    }
  }
  byId('catalog-search').addEventListener('input', () => {
    clearTimeout(debounce); debounce = setTimeout(() => { page = 1; void loadList(false); },250);
  });
  for (const id of ['catalog-category','catalog-status']) byId(id).addEventListener('change', () => { page = 1; void loadList(false); });
  byId('catalog-refresh').addEventListener('click', () => { if (canLeaveEditor()) void loadList(true); });
  await loadList(true);
}
