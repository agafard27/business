# Excel / CSV aktarımı

Eşleştirme, önizleme, atomik uygulama ve bağımlılık denetimli ters kayıt.

## Doğrudan giriş

- [backend/public/imports.js](../../backend/public/imports.js): **renderImports**

- [backend/src/imports/service.js](../../backend/src/imports/service.js): **createImportService**

- [backend/src/imports/reverse.js](../../backend/src/imports/reverse.js): **reverseImport**

## İlgili dosyalar

- [backend/src/imports/routes.js](../../backend/src/imports/routes.js)

- [backend/src/imports/reader.js](../../backend/src/imports/reader.js)

- [backend/src/imports/reader-worker.js](../../backend/src/imports/reader-worker.js)

- [backend/src/imports/formats.js](../../backend/src/imports/formats.js)

## API

- `/api/imports`

## İlgili doğrulama

- [backend/tests/imports.test.js](../../backend/tests/imports.test.js)

- [backend/tests/import-integration.js](../../backend/tests/import-integration.js)

## Bağlantılar

- [catalog](catalog.md)

- [stock](stock.md)

- [parties](parties.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
