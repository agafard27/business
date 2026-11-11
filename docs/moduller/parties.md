# Veresiye ve tedarikçi hesapları (ayrı ekranlar)

Müşteri satış → veresiye → tahsilat; tedarikçi mal alışı → borç → ödeme. Liste/arama, seçili hesap ve geçmiş; günlük işlemde alacak/borç türü seçtirilmez.

## Doğrudan giriş

- [backend/public/party-book.js](../../backend/public/party-book.js): **renderCustomers, renderSuppliers, renderPartyBook (liste/arama/ekleme)**

- [backend/public/party-detail.js](../../backend/public/party-detail.js): **renderPartyDetail (hareket, tahsilat/ödeme, bilgiler, eski bakiye)**

- [backend/src/finance/service.js](../../backend/src/finance/service.js): **parties, party, updateParty, ledger, partyEntry**

- [backend/src/finance/allocate.js](../../backend/src/finance/allocate.js): **allocatePartyPayment**

## İlgili dosyalar

- [backend/public/data-entry.js](../../backend/public/data-entry.js)

- [backend/public/party-book.css](../../backend/public/party-book.css)

- [backend/public/finance.js](../../backend/public/finance.js)

- [backend/public/account-open.js](../../backend/public/account-open.js)

- [backend/public/app.js](../../backend/public/app.js)

- [backend/src/finance/routes.js](../../backend/src/finance/routes.js)

- [backend/scripts/visual-order-check.js](../../backend/scripts/visual-order-check.js)

## API

- `GET /api/finance/parties`

- `POST /api/finance/parties`

- `PATCH /api/finance/parties/:id`

- `GET /api/finance/parties/:id/ledger`

- `POST /api/finance/parties/:id/entries`

- `GET /api/finance/payment-meta`

## İlgili doğrulama

- [backend/tests/business-integration.js](../../backend/tests/business-integration.js)

- [backend/tests/operational-integration.js](../../backend/tests/operational-integration.js)

- [backend/tests/party-ui-integration.js](../../backend/tests/party-ui-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [cash](cash.md)

- [business-core](business-core.md)

- [sales-accounts](sales-accounts.md)

- [sales-payment](sales-payment.md)

- [purchasing](purchasing.md)

## Kullanım ve sınırlar

Veresiye ve Tedarikçiler ayrı menülerdir; aynı kişi iki role sahipse iki defterde görünür, bakiyeler mahsuplaştırılmaz. Alışlar ayrı purchases.js modülündedir; stock.js uyumluluk dışa aktarımı tutar. Müşteri kartından satış açılışında adisyon bazlı müşteri önerisi yalnız mevcut tarayıcı oturumunda app.js customerGroups içindedir; sayfa tamamen yenilenirse ödeme ekranında müşteri yeniden seçilir. Borç yalnız Veresiye düğmesiyle kesinleşir. Yeni manuel borç uydurulmaz; önceki bakiye yalnız hareketsiz hesap için ayrı alandır.

Bakiye tüm kayıtları kapsar; liste API son 1000 hesabı, hareket API son 500 kaydı döndürür. Tahsilat ve ödeme commandForm ile aynı anahtar üzerinden doğrulanır. Alış/cari çift ödeme engeli backend allocatePartyPayment içinde korunur.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
