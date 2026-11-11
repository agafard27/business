# Alış / mal kabulü / tedarikçi iadesi

Ana ekran alış listesi; yeni alış formu düğmeyle açılır. Teslim alınacak/ödemesi kalan filtreleri, mal kabulü, borç ve fatura ödemesi.

## Doğrudan giriş

- [backend/public/purchase-entry-guide.js](../../backend/public/purchase-entry-guide.js): **purchaseItems, mountPurchaseGuide**

- [backend/public/purchases.js](../../backend/public/purchases.js): **renderPurchases (arama, durum filtresi, yeni alış, teslim alma, ödeme/iade)**

- [backend/src/purchasing/service.js](../../backend/src/purchasing/service.js): **createPurchasingService**

## İlgili dosyalar

- [backend/src/purchasing/routes.js](../../backend/src/purchasing/routes.js)

- [backend/src/finance/allocate.js](../../backend/src/finance/allocate.js)

- [backend/public/stock.js](../../backend/public/stock.js)

- [backend/public/party-book.css](../../backend/public/party-book.css)

## API

- `/api/purchases`

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/stock-integration.js](../../backend/tests/stock-integration.js)

- [backend/tests/operational-integration.js](../../backend/tests/operational-integration.js)

- [backend/tests/party-ui-integration.js](../../backend/tests/party-ui-integration.js)

## Bağlantılar

- [stock](stock.md)

- [parties](parties.md)

- [cash](cash.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
