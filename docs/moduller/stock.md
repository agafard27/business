# Reçete, üretim, stok, parti ve sayım

Gerçek stok/maliyet/üretim ve reçete tüketimi. Stok eksikliği satışı durdurmaz; satır tüketimi atomik bekleyen kontrol kaydı olur.

## Doğrudan giriş

- [backend/public/stock-entry-guide.js](../../backend/public/stock-entry-guide.js): **mountStockGuide**

- [backend/public/stock.js](../../backend/public/stock.js): **renderStock; renderPurchases yalnız purchases.js uyumluluk dışa aktarımı**

- [backend/src/stock/service.js](../../backend/src/stock/service.js): **createStockService**

- [backend/src/stock/core.js](../../backend/src/stock/core.js): **lockProducts, stockBalance, consume, moveStock**

- [backend/src/stock/sales.js](../../backend/src/stock/sales.js): **consumeLine, reverseUnpreparedLine**

- [backend/src/stock/tracking.js](../../backend/src/stock/tracking.js): **activateDirectSales, createStockTrackingService → enableSalesTracking, retryStockIssue**

- [backend/public/stock-status.js](../../backend/public/stock-status.js): **mountStockStatus, canTrackReadyProduct**

## İlgili dosyalar

- [backend/public/operation-labels.js](../../backend/public/operation-labels.js)

- [backend/src/stock/routes.js](../../backend/src/stock/routes.js)

- [backend/public/definitions.js](../../backend/public/definitions.js)

- [backend/src/catalog/definitions.js](../../backend/src/catalog/definitions.js)

- [backend/src/migrations/008-stock-issues.js](../../backend/src/migrations/008-stock-issues.js)

## API

- `/api/stock`

- `POST /api/definitions/recipes`

- `POST /api/stock/sales-tracking`

- `POST /api/stock/issues/:id/retry`

## İlgili doğrulama

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/stock-integration.js](../../backend/tests/stock-integration.js)

- [backend/tests/operational-integration.js](../../backend/tests/operational-integration.js)

- [backend/tests/stock-tracking-integration.js](../../backend/tests/stock-tracking-integration.js)

## Bağlantılar

- [business-core](business-core.md)

- [catalog](catalog.md)

- [quantity-display](quantity-display.md)

## Satış stok politikası — kullanıcı kararı, 29 Ekim

Geçerli sipariş ve ödeme stok eksikliğinde devam eder. consumeLine tek satırın tüketimini SAVEPOINT içinde dener; bilinen stok/reçete/birim/depo eksikliğinde bu denemeyi geri alır ve check_lines.stock_issue_json alanına neden/zaman yazar. Önceki başarılı satır tüketimleri ve sipariş kaydı korunur. DB hataları yutulmaz. Fiziksel stok uydurulmaz/negatife indirilmez; eksik maliyet varken kâr kesin hesaplanmaz. Hazırlanan tost gibi ürünler reçete malzemesini tüketir; hazır porsiyon bakiyesi aranmaz.

Stok ekranı bekleyenleri (kapalı adisyonlar dahil, iptal edilenler hariç) gösterir. Yetkili kişi eksik giderilince /issues/:id/retry ile bir kez tüketir; işlem requestKey ve satış/ürün kilitleriyle korunur. Üretim, sayım ve manuel stok çıkışlarının kendi yetersiz stok engeli devam eder. Eski none satışlara yeni reçete veya gramaj geriye doğru uygulanmaz.

## Takip açma ve doğrulanmış geçmiş düzeltmesi

Hazır ürünün başlangıç girişinde trackOnSale açıkça seçilirse aynı transaction içinde takip açılır. catalog.manage gerekir. Sadece stok birimiyle aynı satış birimi ve 1:1 içerik, reçete/ambalaj bağı olmadan hızlı açılış yapılır. Stok var ama none ürünler ekranda uyarılır.

enableSalesTracking normal kullanımda yalnız gelecek satışın direct/sale kuralını açar. Geçmiş düzeltmesi ayrıca stock.manage, beklenen stok/revision, tek başlangıç hareketi, açılış sonrası eksiksiz satır listesi, iptal edilmemiş aynı depo/birim ve hiç stok hareketi olmayan satışlar ister. Kontrol değişirse bütün işlem geri alınır. Her düzeltme stok dokümanı, satır bağlantısı, maliyet ve audit ile iz bırakır; satış anı snapshotları değiştirilmez.

Malzeme miktarları ve maliyetleri kullanıcı girişi/gerçek alış olmadan oluşturulmaz. Dilim stoklanan kaşar/sucuk için gram varsayılmaz. Paket/kilogram alışlarında gerçek dilim içeriği/dönüşüm doğrulanmalıdır.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Doğrulama durumu

29 Ekim: yeni masa/avans/birim/rapor/çıktı davranışları 48/48 birim-HTTP-UI ve 13/13 izole MySQL kontrolüyle doğrulandı. Güncel teslim ve gerçek cihaz sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
