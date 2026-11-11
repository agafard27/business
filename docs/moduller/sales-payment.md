# Hesap / Nakit / POS / veresiye

Hesap özeti ve tahsilat. Açık kasa zorunluluğu, ürün/tutar payları, iade. Sipariş seçimi burada yapılmaz.

## Doğrudan giriş

- [backend/public/payment-entry.js](../../backend/public/payment-entry.js): **renderPaymentEntry**

- [backend/src/sales/payments.js](../../backend/src/sales/payments.js): **createPaymentService → meta, settle, refund, closeEmpty**

## İlgili dosyalar

- [backend/public/responsive.css](../../backend/public/responsive.css)

- [backend/public/order-entry.css](../../backend/public/order-entry.css)

- [backend/src/sales/routes.js](../../backend/src/sales/routes.js)

- [backend/public/print.js](../../backend/public/print.js): **printDocument, printAccount, printTicket**

- [backend/public/print.css](../../backend/public/print.css)

## API

- `GET /api/sales/payment-meta`

- `POST /api/sales/groups/:id/payments`

- `POST /api/sales/groups/:id/refunds`

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

- [backend/tests/business-integration.js](../../backend/tests/business-integration.js)

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

## Bağlantılar

- [business-core](business-core.md)

- [cash](cash.md)

- [parties](parties.md)

- [quantity-display](quantity-display.md)

## Müşteriden başlatılan veresiye

context.creditCustomer yalnız ilgili adisyonun oturum içi müşteri önerisidir. Siparişte isim görünür; ödeme ekranında etkin müşteri önceden seçilir, borç Veresiye düğmesine basılınca kaydedilir.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Doğrulama durumu

29 Ekim: yeni masa/avans/birim/rapor/çıktı davranışları 48/48 birim-HTTP-UI ve 13/13 izole MySQL kontrolüyle doğrulandı. Güncel teslim ve gerçek cihaz sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
