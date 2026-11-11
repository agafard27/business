# Garson sipariş alma

Ürün kartı, ortak favori, servis/gramaj, not ve gönderilmemiş adisyon taslağı. Tahsilat burada yapılmaz. Stok engeli siparişi iptal etmez; stockIssue satırda görünür. Hazırlanan ürün hazır porsiyon stoğu gerektirmez.

## Doğrudan giriş

- [backend/public/sales.js](../../backend/public/sales.js): **renderSales (yalnız ekran yönlendirme)**

- [backend/public/order-entry.js](../../backend/public/order-entry.js): **renderTableOrder (boş masa taslağı), renderOrderEntry → openServings (servise dokunarak +1), openPicker (gram / satır düzenleme)**

- [backend/src/sales/service.js](../../backend/src/sales/service.js): **createSalesService → menu, favorite, submit, submitForTable; submitLines ortak satır kaydı**

## İlgili dosyalar

- [backend/scripts/visual-responsive.js](../../backend/scripts/visual-responsive.js)

- [backend/public/order-entry.css](../../backend/public/order-entry.css)

- [backend/src/sales/routes.js](../../backend/src/sales/routes.js)

- [backend/src/stock/sales.js](../../backend/src/stock/sales.js)

- [backend/scripts/visual-order-check.js](../../backend/scripts/visual-order-check.js)

## API

- `GET /api/sales/menu`

- `POST /api/sales/groups/:id/orders`

- `POST /api/sales/tables/:id/orders` — ilk masa siparişi: requestKey, items, isteğe bağlı warehouseId; hesap + ilk sipariş tek transaction. Aynı anahtar aynı group sonucunu verir. Dolu/pasif masa ve hatalı satırda hesap oluşturulmaz.

- `POST /api/sales/favorites/:id`

## İlgili doğrulama

- [backend/tests/order-entry.test.js](../../backend/tests/order-entry.test.js)

- [backend/tests/table-order.test.js](../../backend/tests/table-order.test.js), [backend/tests/table-order-integration.js](../../backend/tests/table-order-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

- [backend/tests/business-integration.js](../../backend/tests/business-integration.js)

## Bağlantılar

- [business-core](business-core.md)

- [catalog](catalog.md)

- [stock](stock.md)

- [dining](dining.md)

- [quantity-display](quantity-display.md)

- [parties](parties.md)

## Satış stok politikası — kullanıcı kararı, 29 Ekim

Geçerli sipariş ve ödeme stok eksikliğinde devam eder. consumeLine tek satırın tüketimini SAVEPOINT içinde dener; bilinen stok/reçete/birim/depo eksikliğinde bu denemeyi geri alır ve check_lines.stock_issue_json alanına neden/zaman yazar. Önceki başarılı satır tüketimleri ve sipariş kaydı korunur. DB hataları yutulmaz. Fiziksel stok uydurulmaz/negatife indirilmez; eksik maliyet varken kâr kesin hesaplanmaz. Hazırlanan tost gibi ürünler reçete malzemesini tüketir; hazır porsiyon bakiyesi aranmaz.

Stok ekranı bekleyenleri (kapalı adisyonlar dahil, iptal edilenler hariç) gösterir. Yetkili kişi eksik giderilince /issues/:id/retry ile bir kez tüketir; işlem requestKey ve satış/ürün kilitleriyle korunur. Üretim, sayım ve manuel stok çıkışlarının kendi yetersiz stok engeli devam eder. Eski none satışlara yeni reçete veya gramaj geriye doğru uygulanmaz.

## Müşteri önerisi

context.creditCustomer ilgili adisyonun oturum içi müşteri önerisidir. Siparişte isim görünür; ödeme ekranında müşteri seçili gelir, borç Veresiye düğmesiyle kaydedilir.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

## Masa hesabı yerleşimi

order-entry.css hesap panelinin toplam yüksekliğini sınırlamaz; ürün alanı toplamlar yüzünden küçülmez. PC'de sağ sütun genişletildi; taslak listesi gerektiğinde kendi geniş alanında, gönderilmiş satırlar ayrı alanda kayar. Telefon görünümünde taslak normal sayfa akışındadır. visual-order-check.js responsive --only=order-short kısa PC yüksekliğinde ilk ürün satırı/düğmelerin kırpılmadığını ölçer.

## Servis seçme — 30 Ekim kullanıcı kararı

Birden fazla servisi olan ürüne dokunmak kompakt servis alanını açar; henüz taslak eklemez. Adetli servise her dokunuş 1 birim ekler; aynı servis ve nottaki gönderilmemiş miktarlar birleşir. Miktar/not formu ve otomatik klavye odağı bu hızlı seçimde yoktur. Alan tekrar eklemek için açık kalır, durum metni eklenen servisi ve taslak adedini bildirir. Not ve adet taslak satırından düzenlenir; düzenlemede servis değişikliği girilen miktar/notu korur ve Satırı güncelle ile uygulanır. Tartılı servis miktar formunu açar; fiyat ve miktar kesin hesabı korunur. Ürünler yalnız Siparişi gönder ile sunucuya kaydedilir. visual-order-check.js responsive --only=order-servings servis alanını 390/1440 px örnek veride gösterir.

## Boş masa taslağı — son kullanıcı kararı, 30 Ekim

Masaya bakıp çıkmak adisyon açmaz. context.tableDraft={id,name}, renderTableOrder ile kullanıcı/masa başına bellek içi taslağa yönlenir; ilk Siparişi gönder hesap, masa ataması ve satırları tek işlemde oluşturur. Mevcut hesaba sonraki siparişler revision kontrolüyle normal group endpoint'ine gider. İlk gönderimde masa kilitlenir; başka cihazın açtığı hesap varsa TABLE_OCCUPIED ile taslak korunarak kullanıcı güncel masaya yönlendirilir, otomatik ekleme/yeniden yazma yapılmaz. Belirsiz sonuçta aynı istek anahtarı korunur; başarılı sonuçtan gerçek hesaba yönlendirme hata alırsa tekrar aynı komut kontrol edilir. Tam sayfa yenilemesi bellek içi taslağı korumaz; ekranlar arası geçiş korur. Taslakta ödeme, hesap isteme ve taşıma/birleştirme işlemi sunulmaz. Eski boş veya ödeme/iade geçmişli hesaplar otomatik kapatılmaz.
