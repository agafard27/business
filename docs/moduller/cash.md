# Kasa / devir / nakit teslim

Süreye bağlı vardiya yok. Kasa teslim edilene kadar açık kalır; alıcı, sayım, fark, kaydı yapan ve zaman korunur. Yeni açılış eski kayıtları sıfırlamaz.

## Doğrudan giriş

- [backend/public/cash.js](../../backend/public/cash.js): **renderCash**

- [backend/src/finance/cash.js](../../backend/src/finance/cash.js): **createCashService → cash, register, openShift, closeShift (devir), cashMovement, transfer**

## İlgili dosyalar

- [backend/public/data-entry.js](../../backend/public/data-entry.js)

- [backend/public/cash.css](../../backend/public/cash.css)

- [backend/public/finance.js](../../backend/public/finance.js)

- [backend/src/finance/service.js](../../backend/src/finance/service.js)

- [backend/src/finance/routes.js](../../backend/src/finance/routes.js)

- [backend/src/sales/payments.js](../../backend/src/sales/payments.js)

- [backend/src/migrations/007-cash-handover.js](../../backend/src/migrations/007-cash-handover.js)

- [backend/scripts/visual-order-check.js](../../backend/scripts/visual-order-check.js)

## API

- `GET /api/finance/cash`

- `POST /api/finance/shifts`

- `POST /api/finance/cash-sessions/:id/handover`

- `POST /api/finance/shifts/:id/close (uyumluluk; alıcı zorunlu)`

- `POST /api/finance/transfers`

## İlgili doğrulama

- [backend/tests/business-integration.js](../../backend/tests/business-integration.js)

- [backend/tests/operational-integration.js](../../backend/tests/operational-integration.js)

- [backend/tests/cash-integration.js](../../backend/tests/cash-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [business-core](business-core.md)

- [schema](schema.md)

- [sales-payment](sales-payment.md)

## Devir kuralları

Tek işlem sayım + teslim alan + kapanış kaydeder. Alıcının kendi oturumundan kabulü değildir; kaydı yapanın teslim beyanıdır. Kapanış eski hareketleri değiştirmez; sonraki başlangıç nakdi ayrıca girilir. Personelde nakit varken devir engellenir. Yeni API ile eski close adresi aynı idempotent işlemi kullanır. cash_shifts adı yalnız iç şema/API uyumluluğu için korunur.

Son 100 kasa ve 200 hareket ekranda; daha eski veriler veritabanında kalır. Açan, sorumlu, kapatan, alıcı kimlikleri ve devir operation/audit bağlantısı saklanır.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
