# Şema / sürümlü migration

Yayımlanmış migration değişmez; yeni sürüm ayrı dosyadır. Runtime DDL çalıştırmaz.

## Doğrudan giriş

- [backend/src/schema.js](../../backend/src/schema.js): **migrate, verifySchema, migrations**

## İlgili dosyalar

- [backend/scripts/migrate.js](../../backend/scripts/migrate.js)

- [backend/src/migrations/003-dining-revisions.js](../../backend/src/migrations/003-dining-revisions.js)

- [backend/src/migrations/004-sale-stock-snapshots.js](../../backend/src/migrations/004-sale-stock-snapshots.js)

- [backend/src/migrations/005-operational-fields.js](../../backend/src/migrations/005-operational-fields.js)

- [backend/src/migrations/006-import-reversal.js](../../backend/src/migrations/006-import-reversal.js)

- [backend/src/migrations/007-cash-handover.js](../../backend/src/migrations/007-cash-handover.js)

- [backend/src/migrations/008-stock-issues.js](../../backend/src/migrations/008-stock-issues.js)

## API

- HTTP modülü değildir.

## İlgili doğrulama

- [backend/tests/schema-integrity.js](../../backend/tests/schema-integrity.js)

- [backend/tests/integration.check.js](../../backend/tests/integration.check.js)

## Bağlantılar

## V8

008-stock-issues.js yalnız check_lines.stock_issue_json JSON NULL alanını ekler. Yeniden başlatılabilir; sütun türü/null/default doğrulanır. 75 iş + 2 altyapı tablosu değişmez; eski migration SQL/checksumları korunur.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
