# Gider / personel / ekipman

Tarihli gider/personel/avans/ekipman; avans ve ücret kısayolları, personele göre kayıt süzme, ayrı ödeme.

## Doğrudan giriş

- [backend/public/expense-entry-guide.js](../../backend/public/expense-entry-guide.js): **mountExpenseGuide**

- [backend/public/expenses.js](../../backend/public/expenses.js): **renderExpenses**

- [backend/src/expenses/service.js](../../backend/src/expenses/service.js): **createExpenseService**

## İlgili dosyalar

- [backend/src/expenses/routes.js](../../backend/src/expenses/routes.js)

## API

- `/api/expenses`

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

## Bağlantılar

- [parties](parties.md)

- [cash](cash.md)

- [files](files.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Doğrulama durumu

29 Ekim: yeni masa/avans/birim/rapor/çıktı davranışları 48/48 birim-HTTP-UI ve 13/13 izole MySQL kontrolüyle doğrulandı. Güncel teslim ve gerçek cihaz sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
