# Ortak işlem altyapısı

Transaction, requestKey, revision yardımcısı, kuruş/miktar, yetki ve güvenli hata. Alan iş kuralı burada toplanmaz.

## Doğrudan giriş

- [backend/public/data-entry.js](../../backend/public/data-entry.js): **quantityInput, quantityScaled, fieldHelp, showField, quantityRows, paymentGuide, paymentAmount, unitName**

- [backend/src/business/core.js](../../backend/src/business/core.js): **operate, assertPermission, snapshot, money, decimal**

- [backend/src/business/router.js](../../backend/src/business/router.js): **businessRouter, endpoint, writeGuards**

- [backend/public/business-ui.js](../../backend/public/business-ui.js): **commandForm, rowEditor** — /sales/tables/:id/orders onay eşlemesi sales.table.submit; id masa kimliğidir.

## İlgili dosyalar

- [backend/public/data-entry.css](../../backend/public/data-entry.css)

- [backend/src/database.js](../../backend/src/database.js)

- [backend/src/business/changes.js](../../backend/src/business/changes.js)

- [backend/public/changes.js](../../backend/public/changes.js)

## API

- `GET /api/changes`

## İlgili doğrulama

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/business.test.js](../../backend/tests/business.test.js)

- [backend/tests/database.test.js](../../backend/tests/database.test.js)

## Bağlantılar

- [auth](auth.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
