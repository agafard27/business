export const catalogError = (status, code, title) => Object.assign(new Error(), { status, code, title });
const invalid = title => catalogError(400, 'INVALID_INPUT', title);
const MAX_ID = 18446744073709551615n;

export function identifier(value, title = 'Kayıt kimliği geçersiz.') {
  if (typeof value === 'number' && Number.isSafeInteger(value)) value = String(value);
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value) || BigInt(value) > MAX_ID) throw invalid(title);
  return value;
}

export function normalizeSearch(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replaceAll('ı', 'i');
}

function object(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) {
    throw invalid('Gönderilen bilgiler geçersiz.');
  }
  return input;
}

function command(input, keys) {
  object(input, ['requestKey', 'revision', ...keys]);
  if (typeof input.requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey)) {
    throw invalid('İşlem kimliği geçersiz. Sayfayı yenileyip tekrar deneyin.');
  }
  return { requestKey: input.requestKey.toLowerCase(), revision: identifier(input.revision, 'Ürün sürümü geçersiz.') };
}

export function productInput(input) {
  const base = command(input, ['name', 'categoryId', 'isActive']);
  const name = typeof input.name === 'string' ? input.name.trim().normalize('NFC') : '';
  if (!name || [...name].length > 180 || /[\u0000-\u001f\u007f]/u.test(name)) throw invalid('Ürün adı 1–180 karakter olmalı.');
  if (typeof input.isActive !== 'boolean') throw invalid('Ürünün açık/kapalı durumu geçersiz.');
  const categoryId = input.categoryId === null ? null : identifier(input.categoryId, 'Kategori seçimi geçersiz.');
  return { ...base, name, categoryId, isActive: input.isActive };
}

export function priceInput(input) {
  const base = command(input, ['optionId', 'priceMinor']);
  if (typeof input.priceMinor !== 'string' || !/^(0|[1-9][0-9]{0,9})$/.test(input.priceMinor)) {
    throw invalid('Fiyat 0–99.999.999,99 TL aralığında, kuruş olarak tam sayı gönderilmeli.');
  }
  return { ...base, optionId: identifier(input.optionId, 'Servis seçimi geçersiz.'), priceMinor: input.priceMinor };
}

export function listingInput(input = {}) {
  object(input, ['search', 'categoryId', 'status', 'page', 'pageSize']);
  const pageValue = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9][0-9]{0,6}$/.test(value) || Number(value) > max) throw invalid('Sayfa seçimi geçersiz.');
    return Number(value);
  };
  if (input.search !== undefined && (typeof input.search !== 'string' || [...input.search].length > 180 || /[\u0000-\u001f\u007f]/u.test(input.search))) throw invalid('Arama metni en çok 180 karakter olmalı.');
  const status = input.status ?? 'all';
  if (!['all', 'active', 'inactive'].includes(status)) throw invalid('Ürün durum filtresi geçersiz.');
  return { search: normalizeSearch((input.search ?? '').trim()), categoryId: input.categoryId ? identifier(input.categoryId, 'Kategori filtresi geçersiz.') : null,
    status, page: pageValue(input.page, 1, 1000000), pageSize: pageValue(input.pageSize, 24, 100) };
}
