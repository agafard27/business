# Proje haritası — Nar Çiçeği

Son belge doğrulaması: **29 Ekim 2026**. Bu dosya mevcut kısa ana haritadır; ayrıca PROJECT_MAP.md oluşturulmaz.
Amaç: restoran, kafe ve markette satış, hazırlık, stok, alış, cari, kasa ve işletme yönetimi.
Bu harita yönlendirir; değişiklikten önce ilgili güncel kaynak ve doğrudan bağımlılıklar doğrulanır.

## Başlangıç ve belge görevleri

1. Görev kuralları: [AGENTS.md](../AGENTS.md).
2. Dosya/hata konumu belliyse oradan başla; belirsizse buradan özellik/modül seç, gerektiğinde ilgili kartı aç.
3. Alternatif konu indeksi: [kod-haritasi.md](kod-haritasi.md); makine kaydı: [kod-haritasi.json](kod-haritasi.json).
4. Güncel bekleyen işler: [29 Ekim devam notları](planlama/2026-10-29-devam-notlari.md).
5. Mimari ve işletim kararları: [altyapi.md](altyapi.md); iş kuralları: [ekran-plani.md](planlama/ekran-plani.md).
6. Tarihli test/saha kanıtı: [pc-kabul-kontrolu.md](pc-kabul-kontrolu.md); tablo ilişkileri: [veritabani.md](veritabani.md).
Kart ve JSON aynı modül yollarını tanımlar; iş geçmişi ana indekse veya kartlara kopyalanmaz.
Eski plan/kabul tarihleri güncel durum sayılmaz; güncel kaynak çelişkisi yalnız ilgili alandan doğrulanır.

## Çalışma alanı ve Git sınırı

- 29 Ekim doğrulaması: proje `C:/Users/agafard/Desktop/Projeler/dükkan`; gerçek Git kökü `C:/Users/agafard`, proje öneki `Desktop/Projeler/dükkan/`.
- [dukkan.code-workspace](../dukkan.code-workspace) yalnız `.` proje klasörünü açar; [.vscode/settings.json](../.vscode/settings.json) aramayı sınırlar. Bu ayarlar Git kökünü değiştirmez.
- Çalışma alanında otomatik Git keşfi kapalı; klasör ayarında üst depo açma `never`. Git sorgularını proje klasöründen `git status --short -- .` / `git diff -- <ilgili-yol>` ile sınırla.
- Bu doğrulamada proje üst depoda izlenmeyen klasör göründü; `.git` ve geçmiş korunur. Bağımsız depo istenirse ayrı karar gerekir. VS Code penceresinin bu çalışma alanını yüklediği doğrulanmadı.

## Teknoloji ve klasörler

- Tek bağımlılık manifesti: [package.json](../package.json); kilitli sürümler package-lock.json içindedir.
- Node.js **24.15+ / 24.x**, ES modülleri; Express **5**, mysql2, MySQL **8**.
- exceljs XLSX aktarımı; jsdom ekran testleri içindir. Kesin paket sürümü gerekince manifesti aç.
- backend/src: sunucu, API, iş servisleri ve migrations; backend/public: gerçek tarayıcı ekranları.
- backend/scripts: kurulum/başlatma/migration/yedek/denetim; backend/tests: birim ve entegrasyon.
- docs/moduller: kısa modül kartları; docs/planlama: iş planı ve devam notları.
- prototypes: bağımsız ekran taslakları; uygulama ekranı veya canlı iş verisi kaynağı değildir.
- .local: gizli yerel ayar, önbellek, yedek, test çıktısı ve eski arşiv; rutin okunmaz, repoya eklenmez.
- node_modules, kilit dosyası, büyük loglar ve üretilmiş çıktılar yalnız görev gerektiriyorsa incelenir.

## Giriş noktaları ve veri akışı

- npm start → backend/scripts/start.js → backend/src/server.js → backend/src/app.js.
- server.js servisleri ve seçime bağlı HTTPS LAN yöneticisini bağlar; app.js korumaları, API ve statik ekranları sunar.
- backend/public/index.html → app.js → navigation-catalog.js → ilgili ekranın render fonksiyonu.
- Ekran → oturum/izin ve istek koruması → route → service → transaction → MySQL → ekran yenileme.
- config.js + secrets.js yerel bağlantıyı yükler; database.js mysql2 erişimini sağlar.
- monitor.js hazır olmayı izler; şema uygun değilken iş API'leri yazmayı reddeder.
- schema.js sürümleri listeler; DDL yalnız backend/scripts/migrate.js üzerinden işletilir.
- Kaynak ve son canlı doctor doğrulamasında şema **v8**; bu işte şema değişmedi.

## Özellik → başlangıç dosyaları

Yollar proje köküne göredir. Her satırın kartında ilgili fonksiyon, API, test ve bağlı modüller bulunur.

| Özellik / modül kartı | Ekran / ortak giriş | Backend / ikinci giriş |
|---|---|---|
| [Sipariş](moduller/sales-order.md) | backend/public/order-entry.js | backend/src/sales/service.js |
| [Ödeme / iade / hesap çıktısı](moduller/sales-payment.md) | backend/public/payment-entry.js; backend/public/print.js | backend/src/sales/payments.js |
| [Hesap aç / taşı / birleştir](moduller/sales-accounts.md) | backend/public/account-list.js; backend/public/account-tools.js | backend/src/sales/service.js |
| [Bölüm / masa ekle–düzenle–kaldır](moduller/dining.md) | backend/public/dining.js; backend/public/dining-editor.js | backend/src/dining/service.js |
| [Ürün / servis / fiyat / birim](moduller/catalog.md) | backend/public/catalog.js; backend/public/definitions.js | backend/src/catalog/service.js; backend/src/catalog/definitions.js |
| [Mutfak / bar](moduller/kitchen.md) | backend/public/kitchen.js | backend/src/kitchen/service.js |
| [Reçete / üretim / stok / sayım](moduller/stock.md) | backend/public/stock.js; backend/public/stock-status.js | backend/src/stock/service.js; backend/src/stock/sales.js |
| [Alış / mal kabulü / iade](moduller/purchasing.md) | backend/public/purchases.js | backend/src/purchasing/service.js |
| [Kasa / teslim / devir](moduller/cash.md) | backend/public/cash.js | backend/src/finance/cash.js |
| [Veresiye / tedarikçi](moduller/parties.md) | backend/public/party-book.js; backend/public/party-detail.js | backend/src/finance/service.js; backend/src/finance/allocate.js |
| [Gider / personel / avans / ekipman](moduller/expenses.md) | backend/public/expenses.js | backend/src/expenses/service.js |
| [Özet / rapor / işlem geçmişi](moduller/reports.md) | backend/public/overview.js; backend/public/reports.js; backend/public/report-sections.js | backend/src/reports/service.js; backend/src/reports/details.js |
| [Excel / CSV](moduller/imports.md) | backend/public/imports.js | backend/src/imports/service.js; backend/src/imports/reverse.js |
| [Giriş / beni hatırla / çalışan / rol](moduller/auth.md) | backend/public/app.js; backend/public/administration.js | backend/src/auth/service.js; backend/src/auth/management.js |
| [Yetkili onayı](moduller/approvals.md) | backend/public/administration.js (renderApprovals) | backend/src/auth/approvals.js; backend/src/auth/approval-actions.js |
| [Yedek / geri dönüş](moduller/backup.md) | backend/public/backups.js | backend/src/backup/service.js |
| [Belge ekleri](moduller/files.md) | backend/public/business-ui.js (uploadAttachment) | backend/src/files/service.js |
| [İşlem / istek / form altyapısı](moduller/business-core.md) | backend/public/business-ui.js; backend/public/data-entry.js | backend/src/business/core.js; backend/src/business/router.js |
| [İşletme ayarları](moduller/settings.md) | backend/public/settings.js | backend/src/business/settings.js |
| [Şema / migration](moduller/schema.md) | backend/scripts/migrate.js | backend/src/schema.js; backend/src/schema-inspector.js |
| [Miktar gösterimi](moduller/quantity-display.md) | backend/public/quantity-format.js | Hesaplama ve saklama ölçeğini değiştirmez |
| [Ana menü / ekran arama](moduller/navigation.md) | backend/public/workspace-navigation.js; backend/public/navigation-catalog.js | backend/public/app.js (renderHome) |
| [Program rehberi / isteğe bağlı AI](moduller/assistant.md) | backend/public/assistant.js; backend/public/assistant-settings.js | backend/src/assistant/service.js; backend/src/assistant/config.js |
| [Başlatma / bağlantı / HTTPS ağ](moduller/runtime.md) | backend/scripts/start.js; backend/scripts/doctor.js | backend/src/server.js; backend/src/app.js |

## Ortak bağımlılıklar ve korunacak sınırlar

- sales.js yalnız yönlendirir; sipariş, ödeme, hesap listesi ve masa araçları kendi ekran dosyalarında kalır.
- business/core.js: yetki + transaction + requestKey + revision; commit belirsizse yeni anahtarla kör yazma tekrarı yapılmaz.
- auth/routes.js korumaları bütün iş route'larında kullanılır; tarayıcıdaki düğme/rol filtresi yetkilendirmenin yerine geçmez.
- Para tam kuruş, miktar altı ondalıklı BigInt; quantity-format.js yalnız gösterimi değiştirir.
- Satış anındaki ürün/fiyat/birim/reçete/stok kuralı kopyaları korunur; düzenleme eski satışları değiştirmez.
- Sipariş → stock/sales.js → gerçek malzeme tüketimi; eksiklikte satış/ödeme sürer, tüketim kontrol bekler.
- Hazır ayran satışı ayran ve bardağı tüketir; yoğurt üretimde tüketilir. Hazırlanmış iptal stok iadesi değildir.
- Mal kabulü stok ve firma borcu oluşturur; ödeme ayrı olaydır. finance/allocate.js aynı borcun çift ödenmesini engeller.
- Rapor satış, tahsilat, gider, avans ve ekipmanı ayırır; maliyet eksikken kesin kâr üretmez.
- Runtime hesabı yalnız DML kullanır; yayımlanmış migration/checksum değişmez, yeni şema tekrar başlatılabilir sürümdür.
- Parolalar kaynak/ayar/günlük/hata yanıtına yazılmaz; DPAPI ve şifreli yedek kuralları altyapı belgesindedir.
- Gerçek kullanıcı, stok, maliyet, reçete ve bakiye uydurulmaz; testler canlı iş verisi oluşturmaz.

## Çalıştırma ve doğrulama — proje kökünden

| Komut | Ne zaman / neyi doğrular |
|---|---|
| npm.cmd run module | Kayıtlı modül kimliklerini listeler |
| npm.cmd run module -- sales-order | Seçilen modülün giriş dosyası/fonksiyonunu gösterir |
| npm.cmd run module -- sales-order --check | Yalnız seçilen modülün tanımlı yollarının varlığını denetler; test çalıştırmaz |
| npm.cmd start | Terminalde sunucuyu başlatır; başlangıç görevi zaten çalışıyorsa ikinci sunucu açma |
| npm.cmd run doctor | Ayar, bağlantı, şema ve çalışan uygulama durumu |
| npm.cmd run desktop:install | Proje başlangıç görevini kurar ve başlatır |
| npm.cmd run desktop:restart | Güncelleme sonrası yalnız proje görevini yeniden başlatır |
| npm.cmd run desktop:remove | Yalnız proje başlangıç görevini kaldırır |
| npm.cmd test | Kod değişikliği sonunda zorunlu birim/HTTP ve prototip ödeme kontrolleri |
| npm.cmd run test:integration | DB davranışı değişince; ayrı MySQL portu/veri dizini, mevcut servisi durdurmadan |
| npm.cmd run check | Tüm backend JavaScript sözdizimi; yalnız gerektiğinde geniş denetim |
| npm.cmd run db:migrate | Ayrı yetkili migration işlemi; uygulama başlangıcında otomatik çalışmaz |
| npm.cmd run backup | Şifreli yedek oluşturur |
| npm.cmd run backup:restore-check -- DOSYA nar_restore_DENEME | Yeni, ayrı hedefte geri açma doğrulaması |
| npm.cmd run setup | Ayrı kurulum; rutin doğrulama değildir |
| npm.cmd run menu:import | Açıkça yetkilendirilmiş referans menü aktarımı |

Önce ilgili testlerden başla; ortak bileşen etkileniyorsa kapsamı genişlet. AGENTS.md zorunlu kontrolleri korunur.
Yalnız belge değişikliğinde yol/bağlantı/komut tutarlılığı denetlenir; bu, uygulama testinin geçtiği anlamına gelmez.

## Güncel çalışma durumu ve devam noktası

- 12 maddelik listenin uygulaması tamamlandı; ayrıntı ve sınırlar [devam notlarının son teslim kaydında](planlama/2026-10-29-devam-notlari.md).
- 30 Ekim son rapor doğrulaması: 87/87 birim/HTTP/UI ve ödeme taslağı kontrolü, 13/13 izole MySQL entegrasyonu geçti. Raporun eksik maliyet listesi ve özetindeki eksik satır sayısı karşılaştırıldı; ayrıntı aynı tarih aralığını korur.
- Ana menü PC'de solda tek açık bölüm düzenindedir: Satış, Para işleri, Ürün ve stok, Yönetim; Genel bakış/Raporlar/Program rehberi doğrudan açılır. Telefonda aç/kapat, aktif ekran, yetki filtresi ve Ctrl+K korunur. Başlık seçmek açık iş ekranını veya taslağı yeniden yüklemez.
- Girişte Beni hatırla varsayılan kapalı: normal oturum çerezi/sunucuda 12 saat; seçilirse çerez ve MySQL 30 gün. Çıkış ve kullanıcı iptalleri geçerli.
- 390/1440 px örnek veri kontrollerinde sayfa taşmıyor; ilgili ekranlar görsel incelendi. Gerçek telefon saha kabulü yapılmadı.
- Masa hesabında ürün satırı kırpılması giderildi. Raporlar satış/para girişi/para çıkışı/kazanç özetiyle açılır; 18 alan Bütün rapor alanları altında seçilir. Eksik maliyetlerde ürün, neden ve yapılacak kontrol görünür. Personel avansı, masa işlemleri, birimler ve 33 senaryolu rehber korunur.
- Çok servisli üründe adetli servise dokunmak doğrudan taslağa 1 ekler; tekrarlar miktarı artırır. Not/adet taslak satırından düzenlenir; tartılı serviste miktar formu kalır. Siparişi gönder ayrı işlemdir.
- Masa kartına dokunmak sipariş ekranını açar; boş masada yalnız taslak vardır. İlk Siparişi gönder işleminde hesap ve sipariş tek transaction ile oluşur; bakıp çıkmak açık hesap bırakmaz. Dolu masada mevcut hesap açılır. Önceden açık hesaplar otomatik kapatılmaz.
- Masa ekleme tek formda Tek masa/Birden fazla masa seçimidir. Masaları düzenle modunda karta dokunmak ad/bölüm formunu açar; Kaldır/Geri getir burada görünür. Düzenlemeyi bitir günlük sipariş görünümüne döner.
- Ürünler ve fiyatlar ekranında ürünün kendi sayfasından kavanoz/paket veya tartılı satış seçeneği eklenebilir; gerçek miktar, birim ve fiyat girilir. 1 kg/2 kg kavanozlar ayrı fiyatlanır. Reçeteli servislerin gelişmiş tanımları Birimler ve reçeteler ekranındadır.
- Varsayılan PC erişimi loopback. Ağ, ana bilgisayarda Ayarlar → Ağda etkinleştir ile o anki Wi-Fi/IP'ye HTTPS üzerinden açılır; Windows izni gerekir.
- İlk telefonda CA sertifika güveni cihaz üzerinde kurulur. Gerçek UAC/firewall etkinleştirmesi ve fiziksel telefon bağlantısı bu oturumda yapılmadı.
- Şifreli canlı yedek sonrası yalnız eksik dört birim tanımı eklendi; test satışı/stok/bakiye oluşturulmadı, şema v8 değişmedi.
- 30 Ekim kullanıcı MySQL'i kendisinin kapattığını belirtti; isteğiyle MySQL80 başlatıldı. Son doctor: şifreli bağlantı/şema v8/uygulama hazır. Yerel ağ kapalı, yeniden etkinleştirme bekliyor; telefonun CA kurulumu doğrulanmadı.

## Haritayı sürdürme

Yalnız yönlendirme bilgisi (yol, sorumluluk, giriş veya komut) değişince ilgili satırı, kartı ve JSON kaydını düzelt.
Her küçük değişiklikte haritanın tamamını yeniden üretme; yeni ayrıntı belgesinden önce mevcut kartı kullan.
Aramayı dosya/yoldan başlat, ilgili klasörde metin ara, gerekirse kademeli genişlet; gerekli doğruluk okumalarını atlama.
Mevcut bağlamı değişiklik ihtimalini kontrol ederek kullan; bütün projeyi, bağımlılıkları ve .local arşivini rutin tarama.
