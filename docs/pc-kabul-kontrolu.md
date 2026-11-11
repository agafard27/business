# PC uygulaması kabul ve işletime alma kaydı

Bu belgenin ilk bölümü **28 Ekim 2026 tarihli kabul kaydıdır**; aşağıdaki şema/test/ağ ifadeleri o tarihe aittir. Güncel durum ve henüz doğrulanmamış değişiklikler için [proje haritasını](proje-haritasi.md) kullanın. Telefon/LAN güncel hedef olarak eklenmiştir; burada tamamlanmış sayılmaz.

28 Ekim 2026. Güncel giriş: [Proje haritası](proje-haritasi.md). Bu kayıt, yazılımın doğrulanmış kapsamını fiziksel işletme hazırlığından ayırır. Telefon/uzaktan erişim kullanıcının ilk aşama kararına dahil değildir. Kullanıcı ayrıca yazıcı kullanılmayacağını, ekranlardan devam edileceğini doğruladı.

| Plan | Uygulanan akış | Kanıt |
|---|---|---|
| E01 | Kişisel giriş, kilit/oturum iptali, role göre başlangıç | auth testleri ve yönetim entegrasyonu |
| E02 | Tarih aralığı, satış/tahsilat/gider ayrımı, cari/açık hesap ve stok/vade uyarıları | dashboard API + DOM kontrolü |
| E03 | Bölüm/masa, boş/dolu/hesap bekliyor, arama, aktiflik, taşıma/birleştirme | business-integration |
| E04–E06 | Servis/gram/barcode/favori, gönderim, ayrı ürün veya tutar ödemesi, Nakit/POS/veresiye, iptal/indirim/ikram/iade | ödeme/sipariş yarışları, fiyat kopyası, HTTP ve DOM |
| E07 | Alanlara yönlendirme, hazırlanıyor/hazır/teslim, fiyat içermeyen hazırlık ekranı | stock-integration |
| E08 | Ürün/kategori/birim, sürümlü servis/fiyat, barkod, kontrollü dönüşüm/stok kuralı | katalog/operasyon entegrasyonları |
| E09 | Reçete sürümü, gerçek girdiler/çıktı, maliyetli üretim, çifte tüketim engeli | ayran/yoğurt/bardak senaryosu |
| E10 | Başlangıç, parti/tarih, stok yetersizliği, sayım/fark, fire/personel/ikram/kişisel kullanım, depo transferi | stok/operasyon testleri |
| E11 | Alış taslağı, gerçek içerik, vade/ek, mal kabulü, parti, iade, kısmi ödeme | stok/operasyon testleri |
| E12 | Müşteri/tedarikçi, limit, bakiye/defter, açılış, borç tahsilatı/ödeme, düzenleme/pasiflik | cari ve fatura çifte ödeme engeli |
| E13 | Faaliyet gideri/ekipman/personel/avans, tarih/vade/ek, kısmi ödeme, envanterden çıkarma | gider/ek belge entegrasyonu |
| E14 | Kasa açılışı, nakit/POS sayımı, açıklamalı kapanış, nakit teslimi | dengeli transfer ve teslim edilmemiş nakit engeli |
| E15 | İstanbul tarih aralığı, net satış, doğrulanmış maliyet/kâr, 9 ayrıntılı hareket raporu, CSV/geçmiş | rapor/yetki testleri |
| E16 | Gerçek XLSX/CSV, şablon/eşleştirme/önizleme, atomik kesinleştirme, tekrar dosya engeli, bağımlılık denetimli ters kayıt | import-integration ve ayrıştırıcı testleri |
| E17 | Kullanıcı/rol/limit, parola sıfırlama, oturum iptali, onay ve tek seferlik çalıştırma | yönetim/limit/onay entegrasyonu |
| E18 | İşletme adı, PC erişimi, Windows çıktı penceresi, otomatik şifreli yedek, ayrı geri dönüş, oturum açılışında gizli başlatma | doctor + gerçek migration/yedek/görev kurulumu |

## Son test sonucu

- **24/24** birim/HTTP testi ve ödeme taslağı kontrolü geçti.
- **11/11** gerçek MySQL entegrasyon testi geçti. Son koşu yaklaşık 66 saniye sürdü.
- Son değişiklikte **19 ilgili JavaScript dosyası** sözdizimi kontrolünden geçti.
- 16 aynı sipariş isteği, 24 eşzamanlı okuma ve 16 yarışan komutluk yük denemesinde tek sipariş ve tek revision ilerlemesi doğrulandı. Kilit çakışmaları kontrollü BUSY/409'dur; kör yazma tekrarı yapılmaz. Bu kısa deneme uzun süreli saha dayanıklılığı iddiası değildir.
- jsdom, özet ve ayarlar dahil 15 ekran modülünü gerçek API ile açtı; POS düğmesinin gerçek kart kaydı oluşturduğunu doğruladı. Garson ve ödeme düzeni ayrıca ayrı başsız Chrome profiliyle 1440×1000 boyutta, canlı veriye bağlanmayan test verisi üzerinde görsel kontrol edildi. Canlı kullanıcı oturumunda son kabul ayrıca yapılır.

## Canlı kurulum

- Mevcut MySQL80 servisi korunarak kaynak veritabanı **v6**'ya geçirildi.
- Runtime sınırlı hesapla bağlanıyor; doctor sonucu **hazır**.
- Başlangıç görevi **NarCicegi-97CD03141CBD**, Windows kullanıcısı **AGAFARD/agafard**. Görev kuruldu ve uygulama gizli başlatıldı. Yeniden Windows oturumu açma olayı bu oturumda denenmedi; görev başlatma ve planlı yeniden başlatma, yeni süreç başlangıç zamanı ve sağlık 200 yanıtıyla doğrulandı.
- Kullanıcının seçtiği **admin1234** hesabı adına **21 Ekim 2026 kaynaklı 85 ürün / 94 seçenek** aktarıldı. Test satışları canlı kayda yazılmadı. Başlangıç stoğu/reçete/bakiye uydurulmadı.
- Yükseltme öncesi şifreli yedek ayrı **nar_restore_20261028_pc** veritabanında 77 tabloyla geri açıldı.
- Son şifreli yedek: .local/yedekler/nar-20261028200613-a2f016fb-4b9f-4fa1-a2a2-550a4944bedc.narbak. Hedef kullanıcının kararıyla proje içindedir. Son yedek de ayrı nar_restore_20261028_menu veritabanında 77 tabloyla başarıyla geri açıldı.

## İlk gerçek kullanımda işletmeden alınacak bilgiler

1. Kaynak menü tarihli olduğu için güncel fiyatları ürün ekranından kontrol edin.
2. Gerçek bölümleri/masa adlarını, depoları, stok sayımını ve maliyetlerini girin. Reçete, bardak hacmi ve değişken ambalaj içeriği doğrulanmış olmalıdır.
3. Gerçek kasa için açılış tutarı ve sorumlu seçerek vardiya açın.
4. İlk aşama yazıcısızdır. Daha sonra yazıcı kullanılacaksa model/bağlantı, kâğıt ve Türkçe karakter denemesi yapın. Mevcut Windows çıktı penceresinin fiziksel baskıyı tamamladığı varsayılmaz. Doğrudan kasa/mutfak yazıcı kuyruğu ilk PC kapsamı dışındadır; model/bağlantı seçilince ayrıca uygulanacak.
5. İlk gerçek sipariş/tahsilatı işletmeciyle kontrol edin. Gerçek tarayıcıda görsel kabul ve uzun süreli saha denemesi henüz yapılmadı.

Bu işletme/donanım bilgileri olmadan planın tamamına yüzde 100 ve saha onayı verilmiş denmez. PC yazılım akışları uygulanmış ve otomatik testleri geçmiştir; donanım/gerçek işletme kabulü yukarıdaki kapsamda açıktır.

## 29 Ekim geçmiş doğrulamalar — ana haritadan taşındı

Aşağıdaki sonuçlar ait oldukları kaynak anının kaydıdır. 29 Ekimde başlanıp henüz test edilmemiş masa/avans/rapor/birim değişikliklerini kapsamaz. Bu belge düzenlemesinde testler yeniden çalıştırılmadı.

### Önceki kaynak ve canlı durum kayıtları

- 29 Ekim stok canlı son kontrol: desktop:restart sonrası doctor şema v8/bağlantı/uygulama hazır. Altı güncel stok/sipariş/mutfak/rehber varlığı HTTP 200 ve kaynak eşleşmesiyle doğrulandı. Gerçek düzeltmenin tüm satış satırlarına tek hareket bağladığı ve reçete fiyatını koruduğu salt okunur denetlendi. Yeni malzeme stok hareketi oluşturulmadığı doğrulandı. Son durum ayrıca şifreli yedeklendi.

- 29 Ekim stok politikası: npm.cmd test **29/29 + ödeme taslağı**, npm.cmd run test:integration **13/13** geçti. V8 yarım migration/tür kontrolü; takipsiz geçmiş satırların tam listesi/depo/birim/stok/revision mutabakatı, tekrarında çift düşmeme, başlangıç ve takip açmanın tek transaction olması doğrulandı.
- Stok yetmezken sipariş ve ödeme kaydedilmesi, iki malzemeden ikincisi eksikse ilkinin geri alınması, hazır tost bakiyesi olmadan reçete tüketimi, kesirli malzeme, stok tamamlanınca tek tüketim, iptal satırının tekrar tüketilememesi sınandı. Eski tarihli parti tüketilmez; satış kontrol bekler. Üretim/manüel stok korumaları sürer.
- Gerçek veri: önce şifreli yedek, sonra v8 migration, kaynak başlangıç görevi restart. Hedef hazır ürünün açılış sonrası satış satırları tam listesiyle düzeltilip gelecek satış takibi açıldı; doğrulanmış tost reçetesi yalnız kullanıcının seçtiği ürüne bağlandı. Miktar/fiyat/gramaj uydurulmadı. Gerçek test satışı eklenmedi.
- Stok ekranı ayrı Chrome örnek verisiyle incelendi; önce mevcut stoklar, sonra takip/eksik tüketim kontrolü görünür. Yeni kod için stock, sales-order, kitchen ve schema kartları güncel. Diğer yemeklerin malzeme takibi kendi doğrulanmış reçetesini gerektirir.

- 29 Ekim canlı devreye alma: başlangıç görevi yeniden başlatıldı; doctor ayar/şema v7/uygulama hazır. 8 güncel arama/asistan/ayar varlığı HTTP 200 ve kaynak eşleşmesiyle doğrulandı. Yeni asistan status/configuration adresleri oturumsuz istekte 401 döndürüyor. Gerçek API anahtarı girilmediğinden yerel rehber kullanılabilir, canlı yapay zekâ henüz etkin değil.

- 29 Ekim ekran araması/asistan: npm.cmd test **29/29 + ödeme taslağı**, npm.cmd run test:integration **12/12** geçti. Türkçe/ASCII arama, yetki filtresi, klavye/abonelik temizliği, asistan oturum/CSRF/yönetici sınırı, ayar gizliliği/atomik sürüm/idempotence, yalnız izinli rehber gönderimi, dış API tekrar yapmama ve hız sınırı doğrulandı. UI rehberinin anahtarsız çalışması ve model metninin HTML olarak çalıştırılmaması kontrol edildi.
- Başsız Chrome örnek verisiyle arama, rehber ve gerçek app.js kabuğu incelendi. Windows hesabında rastgele deneme değeriyle DPAPI şifrele/çöz kontrolü geçti. Gerçek API anahtarı kaydedilmedi; dış model çağrısı yapılmadı. Sağlayıcı testleri sahte HTTP yanıtıyla yapıldı.
- Yeni devam noktası: kullanım rehberi ve arama hazır; canlı yapay zekâ için yönetici Ayarlar → Yapay zekâ bağlantısı alanına kendi API anahtarını girip etkinleştirir. Anahtar sohbete istenmez. Kod kartları navigation ve assistant; toplam 24 modül. Şema v7 değişmedi.

- 29 Ekim veresiye/tedarikçi: npm.cmd test **24/24 + ödeme taslağı**, npm.cmd run test:integration **12/12** geçti. party-ui-integration gerçek HTTP/jsdom ile müşteri/tedarikçi ayrı oluşturma, ayrık listeler, müşteriden satış açma, adisyona özel müşteri önerisi, veresiye satış, kayıp tahsilat yanıtının tek kayda dönmesi, tedarikçi eski bakiye/ödeme ve alış formu/filtrelerini doğruladı.
- Başsız Chrome ayrı örnek verileriyle Veresiye, Tedarikçiler ve Mal alışları görüntüleri incelendi. Yeni statik dosyalar çalışan uygulamada HTTP 200/kaynak eşleşmesiyle doğrulandı; şema ve iş API davranışı değişmedi. Gerçek veriye test satış/tahsilat/tedarikçi eklenmedi.
- Devam noktası: kullanıcı bu yeni ekranları işletmede deneyerek değerlendirir. İlgili kod kartları parties ve purchasing. Müşteri önerisi yalnız mevcut tarayıcı oturumunda adisyona bağlıdır; tam sayfa yenilemede müşteri yeniden seçilir.

- 29 Ekim tek tık adisyon açılışı: npm.cmd test **24/24 + ödeme taslağı**, npm.cmd run test:integration **12/12** geçti. Gerçek HTTP/jsdom ile tek tık masa açılışı, çift tık kilidi, dolu masada mevcut hesaba gitme, masasız kayıp yanıt sonrası aynı anahtarla tekrar ve yönlendirme hatasında ek adisyon açmadan devam doğrulandı. Canlı dining.js/account-list.js/account-open.js kaynakla aynı ve HTTP 200; uygulama hazır. Canlı test adisyonu oluşturulmadı. Modül kartları dining ve sales-accounts güncellendi.

- 29 Ekim canlı geçiş tamamlandı: v7 migration başarılı, proje başlangıç görevi yeniden başlatıldı; doctor şifreli ayar/şema/uygulama hazır kontrolü geçti. /health/ready, /cash.js, /cash.css ve /app.js HTTP 200. Güncel kasa kartı: docs/moduller/cash.md. Gerçek teslim/kapanış yapılmadı; kullanıcının fiilî teslimine bırakıldı.

- 29 Ekim kasa/devir: npm.cmd test **24/24 + ödeme taslağı**, npm.cmd run test:integration **12/12** geçti. V7 yarım migration, FK denetimi, alıcısız/self/geçersiz kapanış, eşzamanlı kasa açma, eski tarihli açık kasa, aynı devir tekrarı, farkın korunması, kapalı kasaya yazma ve yeni açılışın eski geçmişi değiştirmemesi doğrulandı.
- Kasa ekranı ayrı başsız Chrome profili ve örnek verilerle görsel kontrol edildi; gerçek işletme kasa kaydı test için oluşturulmadı. Yükseltme öncesi şifreli yedek alındı.

- npm.cmd test: **24/24 test + ödeme taslağı kontrolü geçti**.
- npm.cmd run test:integration: **12/12 gerçek MySQL testi geçti**; son koşu 65 saniye. Yeni sipariş taslağı, yanıt kaybı + ekran yeniden çizimi sonrası tek kayıt, yıldız/filtrelerin not-miktarı koruması, vardiyasız ödeme ve miktar görünümü dahil.
- Son değişiklikte **19 ilgili JavaScript dosyası** sözdizimi kontrolünden geçti. Modül komutu yalnız seçilen karttaki yolları kontrol eder; rutin tüm proje taraması yoktur.
- PC yük denemesi: 16 aynı sipariş isteği + 24 okuma + 16 yarışan komut; tek sipariş ve tek revision ilerlemesi. BUSY/409 çakışması geri alınmış işlemdir; yeni yazma kör tekrarlanmaz. Bu kısa deneme uzun süreli saha testi değildir.
- jsdom gerçek HTTP ile ekranları, yeni sipariş akışını ve POS kaydını doğruladı. Ayrı Chrome profili ve izole test verisiyle sipariş/ödeme düzeni 1440×1000 görsel olarak kontrol edildi; canlı kullanıcı oturumunun görsel saha kabulü ayrıca yapılır. Örnek çıktı: .local/ui-checks/e649f9e0-6805-419e-9016-c433a8bafc6c/order.png.
- Canlı doctor: Node 24.21.0, bağlantı/şema **OK**, uygulama **hazır**. Yalnız 127.0.0.1:5080.
- Windows başlangıç görevi **NarCicegi-97CD03141CBD**, kurulum hesabıyla oluşturuldu ve gizli başlatıldı. Görevden çalışan HTTP sağlık kontrolü geçti; planlı yeniden başlatma da denendi. Son ekran/ödeme düzeltmeleriyle yeniden başlatıldı; hazır yanıtı 200. Yeniden oturum açma denenmedi. Görev Windows servisi değildir.
- Kullanıcının seçtiği **admin1234** hesabı (id 5) adına **85 ürün / 94 seçenek** referans menü aktarıldı. Kaynak 21 Ekim 2026; güncel fiyat kontrolü işletmeciye aittir. Canlı test satışı, stok/reçete/bakiye seed'i yapılmadı.
- Yükseltme öncesi gerçek yedek nar_restore_20261028_pc, son v6/menü yedeği nar_restore_20261028_menu adlı **ayrı** veritabanlarına 77 tabloyla başarıyla geri açıldı. Kaynak işletme verisi değiştirilmedi; yedek doğrulama zamanı kaydedildi.
- Son gerçek şifreli yedek: **.local/yedekler/nar-20261028200613-a2f016fb-4b9f-4fa1-a2a2-550a4944bedc.narbak**. .local/backup-key.json DPAPI korumalı anahtardır; kaybedilirse yedek açılamaz.
- Mevcut MySQL80 servisi durdurulmadı. Testler ayrı port/veri dizini kullandı. Gerçek yönetici parolası kaynak/ayar/günlüğe yazılmadı.

## 29 Ekim — yeni iş listesi doğrulaması

48/48 birim/HTTP/UI, ödeme taslağı ve 13/13 izole MySQL kontrolü geçti; 166 JavaScript ve iki PowerShell betiği sözdizimi kontrolünden geçti. 390/1440 px ekranlar örnek veride görsel incelendi. Son kapsam ve cihaz sınırı [devam notlarının son teslim kaydında](planlama/2026-10-29-devam-notlari.md). Fiziksel telefon/sertifika kurulumu ve Windows UAC/firewall etkinleştirmesi kullanıcı adımıdır; bu testlerin yerine geçmiş sayılmaz.
