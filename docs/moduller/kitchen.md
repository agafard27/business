# Mutfak / bar

Fiyatsız hazırlık listesi; hazırlanıyor, hazır ve teslim geçişleri. Hazırlık tüketimi eksikse aşama ilerler, stok kontrolü uyarısı korunur.

## Doğrudan giriş

- [backend/public/kitchen.js](../../backend/public/kitchen.js): **renderKitchen**

- [backend/src/kitchen/service.js](../../backend/src/kitchen/service.js): **createKitchenService**

## İlgili dosyalar

- [backend/src/kitchen/routes.js](../../backend/src/kitchen/routes.js)

- [backend/src/stock/sales.js](../../backend/src/stock/sales.js)

## API

- `/api/kitchen`

## İlgili doğrulama

- [backend/tests/stock-integration.js](../../backend/tests/stock-integration.js)

## Bağlantılar

- [sales-order](sales-order.md)

- [stock](stock.md)

- [quantity-display](quantity-display.md)

## Satış stok politikası — kullanıcı kararı, 29 Ekim

Geçerli sipariş ve ödeme stok eksikliğinde devam eder. consumeLine tek satırın tüketimini SAVEPOINT içinde dener; bilinen stok/reçete/birim/depo eksikliğinde bu denemeyi geri alır ve check_lines.stock_issue_json alanına neden/zaman yazar. Önceki başarılı satır tüketimleri ve sipariş kaydı korunur. DB hataları yutulmaz. Fiziksel stok uydurulmaz/negatife indirilmez; eksik maliyet varken kâr kesin hesaplanmaz. Hazırlanan tost gibi ürünler reçete malzemesini tüketir; hazır porsiyon bakiyesi aranmaz.

Stok ekranı bekleyenleri (kapalı adisyonlar dahil, iptal edilenler hariç) gösterir. Yetkili kişi eksik giderilince /issues/:id/retry ile bir kez tüketir; işlem requestKey ve satış/ürün kilitleriyle korunur. Üretim, sayım ve manuel stok çıkışlarının kendi yetersiz stok engeli devam eder. Eski none satışlara yeni reçete veya gramaj geriye doğru uygulanmaz.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
