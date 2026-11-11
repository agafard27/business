# Bölüm ve masalar

Tek tık adisyon; filtreli ve doğal sıralı masa listesi; bölüm/masa düzenleme, kaldırma/geri açma ve önizlemeli toplu ekleme.

## Doğrudan giriş

- [dining.js](../../backend/public/dining.js): **renderDining → setManaging, tableCard** — günlük masalar/düzenleme modu; günlükte openTable/openGroup, düzenlemede karttan form; filtre ve mod yenilemede korunur.
- [dining-editor.js](../../backend/public/dining-editor.js): **mountDiningEditor, nextTableNumber → addMode, editTable, addTables** — aynı alanda tek/toplu ekleme ve bölüm koruması; gelişmiş ad/numara, düzenle/kaldır/geri getir; belirsiz sonucu korur.
- [service.js](../../backend/src/dining/service.js): **createDiningService → list, saveSection, saveTable, createTables** — yetkili ve sürümlü yazmalar; 1–100 masayı atomik oluşturur.

## Doğrudan bağımlılıklar

- [routes.js](../../backend/src/dining/routes.js): oturum, izin ve istek koruması.
- [order-entry.js](../../backend/public/order-entry.js): renderTableOrder; ilk siparişten önce gerçek adisyon oluşturmaz.
- [dining.css](../../backend/public/dining.css): bu ekranın yerleşimi; [business.css](../../backend/public/business.css) ortak kart/form stilleri.
- [index.html](../../backend/public/index.html): stil bağlantısı.

## API

- `GET /api/dining`
- `POST /api/dining/sections`, `PATCH /api/dining/sections/:id`
- `POST /api/dining/tables`, `PATCH /api/dining/tables/:id`
- `POST /api/dining/tables/batch`

## Korunacak davranış

Masa kartına dokunmak doğrudan sipariş ekranına götürür; ayrı Adisyon aç/Hesabı aç düğmesi yoktur. Boş masada yalnız yerel taslak açılır; ilk Siparişi gönder işleminde hesap oluşur. Dolu masa mevcut hesaba gider. Boş masaya girip çıkmak veritabanına yazmaz ve masayı dolu göstermez.
Kartın tam yüzeyi native button üzerinden fare/dokunma ve Enter/Space ile çalışır. Günlük görünümde yönetim düğmeleri kartlarda yoktur. Masaları düzenle modunda kart, sipariş yerine ad/bölüm formunu açar; ayrı Kaldır/Geri getir eylemi onay formuna gider. Düzenlemeyi bitir günlük görünüme döner. Kaldırılan masada sipariş girişi yoktur.
Masa ekle formunda Tek masa / Birden fazla masa geçişi bölüm seçimini korur. Toplu eklemede bölüm/adet yeterlidir; önek ve başlangıç İsim ve numarayı değiştir altında düzenlenir. Önizleme ve ad çakışması denetimi sürer. Belirsiz yazmada mod değiştirme ve ekleme biçimi düğmeleri de kilitlenir.
Yönetim yalnız settings.manage iznindedir. Kaldırma mevcut isActive=false yazmasıdır; fiziksel silme yapılmaz, hesap geçmişi korunur.
Dolu masa kaldırılamaz; önce hesabı kapat veya başka masaya taşı. Kaldırılanlar ayrı filtrede geri açılır ve adları yeniden eklemede de çakışır.
Yazma revision ve requestKey kullanır. Belirsiz yönetim işlemi ekranlar arasında aynı komutla kontrol edilir; başarılı yazmadan sonra yenileme başarısızsa yalnız ekran tekrar yüklenir.
Bu geçici durum aynı tarayıcı oturumundaki bellek içindedir; tam sayfa yenilemesinden sonra korunacağı varsayılmaz.

## İlgili doğrulama

- [dining-management.test.js](../../backend/tests/dining-management.test.js): filtre/rol, ilk bölüm, numara/önizleme, düzenle/kaldır/geri aç, çift basma, kayıp yanıt ve yenileme hatası.
- [new-features-integration.js](../../backend/tests/new-features-integration.js): toplu yarış/tekrar, kaldırılan ad çakışması, sürüm/izin, dolu masa koruması, bölüm/ad değişimi ve geçmiş hesap.
- [business-integration.js](../../backend/tests/business-integration.js), [ui-integration.js](../../backend/tests/ui-integration.js): iş akışları ve gerçek API ile tek dokunuş.
- [visual-order-check.js](../../backend/scripts/visual-order-check.js): tables/table-editor/table-batch/table-remove örnekleri; 390/1440 px.

## Bağlantılar ve güncel kayıt

[business-core](business-core.md), [sales-accounts](sales-accounts.md), [sales-order](sales-order.md).
30 Ekim son ekran kontrolü: 80/80 birim/HTTP/UI ve ödeme taslağı geçti. DB davranışı bu ekran işinde değişmedi; aynı günün ilk sipariş işi 13/13 izole MySQL kaydıyla doğrulandı. Görsel/canlı varlık doğrulaması ve teslim sınırı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).
