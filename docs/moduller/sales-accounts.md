# Hesap listesi / taşıma / birleştirme

Tek tık hesap açma, ayrı görsel masa taşı/birleştir; boş/dolu hedef, revision ve ödeme geçmişi koruması.

## Doğrudan giriş

- [backend/public/account-list.js](../../backend/public/account-list.js): **renderAccountList**

- [backend/public/account-tools.js](../../backend/public/account-tools.js): **renderAccountTools**

- [backend/src/sales/service.js](../../backend/src/sales/service.js): **list, get, move, merge, requestBill**

- [backend/public/account-open.js](../../backend/public/account-open.js): **bindAccountOpen (tek tık, çift tık kilidi, aynı anahtarla tekrar; müşteri açılışında scope; kartta data-account-open-label ile yalnız durum etiketini günceller)**

## İlgili dosyalar

- [backend/public/business.css](../../backend/public/business.css)

- [backend/public/sales.js](../../backend/public/sales.js)

- [backend/src/sales/routes.js](../../backend/src/sales/routes.js)

## API

- `POST /api/sales/open`

- `GET /api/sales/groups`

- `POST /api/sales/groups/:id/move`

- `POST /api/sales/groups/:id/merge`

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/business-integration.js](../../backend/tests/business-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [dining](dining.md)

- [business-core](business-core.md)

## Açılış davranışı

Ek Kaydet/onay formu yok. account-open.js masasız ve müşteri kartından açılışı yürütür; eski /open tableId sözleşmesi korunur. Yeni masa ekranı boş masada bu endpoint'i çağırmaz: ilk sipariş [sales-order](sales-order.md) modülünde hesapla birlikte kaydedilir. scope müşteri açılışını genel masasız açılıştan ayırır. Belirsiz yanıt ekran yeniden çizilse de aynı requestKey ile kontrol edilir; yönlendirme hatasında açılmış adisyona geri dönülür.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Doğrulama durumu

29 Ekim: yeni masa/avans/birim/rapor/çıktı davranışları 48/48 birim-HTTP-UI ve 13/13 izole MySQL kontrolüyle doğrulandı. Güncel teslim ve gerçek cihaz sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
