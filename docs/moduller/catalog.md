# Ürün, servis, fiyat, barkod ve birimler

Ürün, sürümlü servis/fiyat, birim/barkod/reçete; standart birimleri çoğaltmadan tamamlama ve doğrulanmış fiziksel oranlar.

## Doğrudan giriş

- [backend/src/catalog/units.js](../../backend/src/catalog/units.js): **standardUnits, standardFactor**

- [backend/public/definition-entry-guide.js](../../backend/public/definition-entry-guide.js): **optionGuide, recipeGuide, normalizedRows, stockRuleGuide**

- [backend/public/catalog.js](../../backend/public/catalog.js): **renderCatalog**

- [backend/public/catalog-option-entry.js](../../backend/public/catalog-option-entry.js): **simpleSaleOption, mountCatalogOptionEntry** — ürün sayfasında kavanoz/paket veya tartılı satış; miktar/birim/fiyat, kesin stok karşılığı ve belirsiz yazma kontrolü.

- [backend/public/definitions.js](../../backend/public/definitions.js): **renderDefinitions**

- [backend/src/catalog/service.js](../../backend/src/catalog/service.js): **createCatalogService**

- [backend/src/catalog/definitions.js](../../backend/src/catalog/definitions.js): **createDefinitionService**

## İlgili dosyalar

- [backend/src/catalog/routes.js](../../backend/src/catalog/routes.js)

- [backend/src/catalog/definition-routes.js](../../backend/src/catalog/definition-routes.js)

- [backend/src/catalog/validation.js](../../backend/src/catalog/validation.js)

- [backend/src/catalog/reference.js](../../backend/src/catalog/reference.js)

- [backend/public/catalog.css](../../backend/public/catalog.css)

## API

- `POST /api/definitions/units/standard`

- `/api/catalog`

- `/api/definitions`

- `POST /api/definitions/products/:id/options` — mevcut servis sürümü API'si; ürün sayfasındaki basit form aynı sözleşmeyi kullanır.

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/catalog.test.js](../../backend/tests/catalog.test.js)

- [backend/tests/catalog-option-entry.test.js](../../backend/tests/catalog-option-entry.test.js)

- [backend/tests/catalog-integration.js](../../backend/tests/catalog-integration.js)

- [backend/tests/reference.test.js](../../backend/tests/reference.test.js)

## Bağlantılar

- [auth](auth.md)

- [business-core](business-core.md)

## Ürün sayfasında satış tanımlama — 30 Ekim

Ürünler ve fiyatlar → ürün → Satış seçenekleri → + Satış seçeneği ekle. Kavanoz/pakette miktar ve içerik birimi seçilir; bu paketin tamamına ait fiyat yazılır. Sipariş birimi adet, fiyat miktarı 1, contentQuantity gerçek stok karşılığıdır. Örneğin 1 kg/2 kg kavanozlar bağımsız fiyatlanır; 2 kg fiyatı 1 kg fiyatından tahmin edilmez. Tartılı satış fiyat miktarı ve fiziksel birimiyle kaydedilir. Yalnız aynı birim veya doğrulanmış g–kg/ml–l dönüşümü yapılır; ambalaj/ürüne bağlı dönüşüm uydurulmaz. Reçeteli yeni servis ayrıntıları gelişmiş Birimler ve reçeteler ekranında tanımlanır; mevcut servislerin reçete/bileşenleri bu formda değiştirilmez.

Form servis kodunu kendi üretir, fiyatı boş başlatır. Ürün revision'ı, aynı adlı seçeneği yanlışlıkla tekrar oluşturmayı engelleyen UI kontrolü ve mevcut API yetkisi korunur. Belirsiz sonuç kullanıcı/ürün başına aynı payload/anahtarla kontrol edilir; başarılı yazma sonrası yalnız ekran yenilenir. Tam sayfa yenilemesinde bellek içi bekleyen komutun korunacağı varsayılmaz. Ürün stok kuralı veya geçmiş satış değiştirilmez.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Doğrulama durumu

29 Ekim: yeni masa/avans/birim/rapor/çıktı davranışları 48/48 birim-HTTP-UI ve 13/13 izole MySQL kontrolüyle doğrulandı. Güncel teslim ve gerçek cihaz sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
