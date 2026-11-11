# Yönetici özeti ve raporlar

18 ayrı rapor alanı; anlaşılır işletme özeti, tutardan ayrıntıya geçiş, eksik maliyet nedenleri, ortak tarih, personel/ekipman/cari ayrımı ve devam sayfaları.

## Doğrudan giriş

- [backend/public/report-sections.js](../../backend/public/report-sections.js): **reportSections, summaryHtml, detailTableHtml, productSalesHtml, auditHtml**

- [backend/public/operation-labels.js](../../backend/public/operation-labels.js): **actionLabel, outcomeLabel, kindLabel, accountLabel**

- [backend/public/overview.js](../../backend/public/overview.js): **renderOverview**

- [backend/public/reports.js](../../backend/public/reports.js): **renderReports**

- [backend/src/reports/service.js](../../backend/src/reports/service.js): **createReportService**

- [backend/src/reports/details.js](../../backend/src/reports/details.js): **reportDetails**

## İlgili dosyalar

- [backend/public/reports.css](../../backend/public/reports.css)

- [backend/public/index.html](../../backend/public/index.html)

- [backend/src/reports/routes.js](../../backend/src/reports/routes.js)

## API

- `/api/reports/dashboard`

- `/api/reports/summary`

- `/api/reports/details`

- `/api/reports/details?kind=costs` — yalnız kazanç hesabını engelleyen satış satırları, satış anındaki stok kuralı ve kayıtlı stok açıklaması; aynı tarih/cursor/yetki kuralları.

## İlgili doğrulama

- [backend/tests/reports.test.js](../../backend/tests/reports.test.js)

- [backend/tests/new-features-integration.js](../../backend/tests/new-features-integration.js)

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/data-entry.test.js](../../backend/tests/data-entry.test.js)

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [auth](auth.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.

Miktar gösterimi için ortak modül: [quantity-display](quantity-display.md). Kanonik MySQL miktarı kullanıcıya ham basılmaz.

## Özet ekranı hesap bağlantıları

renderOverview müşteri alacağını parties (Veresiye), tedarikçi borcunu suppliers (Tedarikçiler) sekmesine yönlendirir.

## Doğrulama durumu

30 Ekim düzenlemesi: satış/para girişi/para çıkışı/kazanç özeti, neden dökümleri ve eksik maliyet kartları. Güncel test ve teslim kanıtı [devam notlarında](../planlama/2026-10-29-devam-notlari.md).

## Ayrı rapor alanları

İşletmem nasıl gidiyor? özeti, ürün satışları, eksik maliyetler, satış satırları, masa/hesaplar, tahsilat/ödemeler, mal alışları, stok/sayım/fire, üretim, işletme giderleri, personel/avans, ekipman, veresiye, tedarikçiler, kasa hareketleri/devirleri, indirim/ikram/iptal ve işlem geçmişi ayrı seçilir. Bütün rapor alanları başlangıçta kapalıdır. reports.js yalnız seçili alanı çağırır; tarih/alan değişimi eski async yanıtı ve cursor'u geçersiz kılar. data-report-open bağlantıları aynı tarih aralığıyla ayrıntıya ve özete döner; kazanç hesabı düğmesi uygulama URL hash'ini değiştirmeden bölümüne kaydırır.

Yeni salt okunur details türleri: groups, payments, operating, staff, equipment, receivables, payables. expenses/accounts eski kapsamı korur; yeni alanlar sunucuda süzülür. Personel raporu gider tarihli ücret/avans kaydıdır; nakit çıkışı ayrı Tahsilat/ödemeler raporundadır. Satış satırları ilk tutarları, ürün satışları net miktar/tutarı gösterir. Stok/üretim miktarı stok birimiyle gösterilir.

summaryHtml mevcut özet verisinden giriş/çıkışları BigInt ile ayrı toplar; satış oluşumunu, nakit/kart kırılımını, kayıtlı gideri, kazanç hesabını, ilk beş ürün satırını ve güncel bakiyeleri açıklar. Para hareketi kasa bakiyesi veya kâr diye sunulmaz. Gider toplamı işletme + personel ödemesidir; avans/ekipman ayrıdır. Güncel bakiyeler dönem sonu bakiyesi değildir.

costs türünün eksiklik koşulu summary maliyet koşuluyla aynıdır: iptaller hariç, tüketim pozitif, bütün maliyetler biliniyor, satış anındaki stok kuralı direct/recipe ve otomatik aşama olması gerekir. Eksik snapshot, kapalı takip, elle tüketim, bekleyen tüketim ve bilinmeyen maliyet ayrı açıklanır. detailTableHtml costs verisini taşan tablo yerine aranabilir kartlara döker. Rapor iş kaydını veya maliyeti değiştirmez; eksik maliyet sıfır sayılmaz.
