# Güncel altyapı ve PC işletimi — 29 Ekim 2026

Giriş noktası: [Proje haritası](proje-haritasi.md). Güncel karar Node.js 24.15+ (24.x), Express 5, mysql2, MySQL 8. Önceki .NET/PostgreSQL önerileri uygulanmaz. Bağımlılık sürümleri package-lock.json ile sabittir.

## Çalışma ve erişim

Varsayılan PC adresi **127.0.0.1:5080** korunur. Ayarlar → Ağda etkinleştir, ana bilgisayardaki yetkili oturumdan güvenilir ağ onayıyla çalışır. O anki fiziksel ağ adresi otomatik bulunur; HTTPS ayrı olarak yalnız seçilen özel IPv4 adresinde 5443 portunda dinler. Windows izin penceresi, yalnız o arayüzün ağ profilini Özel yapar ve proje adına bağlı Node programı/yerel adres/5443/LocalSubnet/Private kuralını kurar. Dış internet, modem yönlendirmesi, 0.0.0.0 veya MySQL ağı açılmaz. Wi-Fi/IP değişince aynı düğmeyle yeniden etkinleştirilir; ağ kapalıyken PC kullanımı sürer. MySQL80 mevcut servistir; testler bu servisi durdurmaz. Entegrasyon ayrı boş port ve .local/mysql-tests altında ayrı veri dizini kullanır.

Gerçek iş ekranları backend/public, servisleri backend/src altında durur. Prototipler gerçek iş kaydı oluşturmaz. /health/live HTTP yanıtını, /health/ready güncel MySQL/şema kontrolünü gösterir. Hazır değilse iş API'leri yazmayı reddeder. Veritabanı geri geldiğinde uygulamayı yeniden başlatmadan hazır duruma döner. /status.html kontrol zamanını gösterir. /api/system/database yalnız bilinen tablo metaverisini döndürür.

## Şema ve işlem güvenliği

Canlı şema **v8**: 75 iş + 2 altyapı tablosu. v1/v2 yayımlanmış SQL/checksum korunur. v3 masa/bölüm revision, v4 satış stok kopyaları, v5 hesap bekleme/cari revision, v6 aktarım geri alma metaverisi, v7 kasa teslim alıcısı ve devir işlem bağlantısı, v8 satışın bekleyen stok tüketimi alanını ekler. DDL uygulama açılışında çalışmaz. Migration adımları eksik sütunu ekler, mevcut yapıyı doğrular ve ancak sonra sürümü kaydeder. Yeniden çalıştırma veri çoğaltmaz.

İş yazmaları transaction + güncel kullanıcı/yetki + requestKey kullanır. Masa/adisyon/ürün gibi düzenlemeler revision da denetler. Aynı anahtar aynı komutun sonucunu verir; başka komuta kullanılırsa reddedilir. Paralar tam kuruş, miktarlar altı basamaklı BigInt hesabıdır. Satış anındaki ad/fiyat/birim/içerik/reçete/stok kuralı saklanır. Yeni fiyat ve reçete eski kayıtları değiştirmez.

Commit yanıtı belirsizse COMMIT_UNKNOWN döner; otomatik yeni yazma denenmez. Ekran komutu ve anahtarını dondurur, aynı düğmeyle sonucu doğrular. Başarılı kayıt sonrası ekran yenilemesi başarısızsa yalnız yenileme tekrarlanır. Yük altında kilit çakışması BUSY/409 ile güvenli biçimde geri döner; bilinmeyen işlem sonucu gibi sessiz başarı sayılmaz.

30 Ekim masa açılış kararı: boş masaya giriş yalnız kullanıcı/masa başına bellek içi sipariş taslağı oluşturur. POST /api/sales/tables/:id/orders, masa satırı kilidi altında hesap/masa ataması/ilk siparişi tek transaction ile kaydeder; hatada tümü geri alınır. Başka hesapla dolmuş masaya sessiz ekleme yapılmaz. Sonraki siparişler hesap revision kontrolüyle devam eder. Şema değişmez; eski /sales/open masasız/müşteri ve uyumlu eski istemciler için korunur. Daha önce oluşmuş açık hesaplar otomatik kapatılmaz.

Stok ürün kilidiyle seri hesaplanır. Kullanıcının 29 Ekim kararıyla geçerli satış stok eksikliği nedeniyle durmaz; negatif fiziksel stok veya bilinmeyen maliyet oluşturmak yerine satır tüketimi kontrol bekler. Üretim/manüel çıkışta yetersiz stok reddedilir. Kullanılabilir partiler son kullanma tarihine göre seçilir; süresi geçmiş parti satış/üretime tüketilmez, fire/transfer/sayımda açıkça işlenebilir. Üretimde gerçek girdiler düşer ve gerçek çıktı maliyeti oluşur. Satış hazır ürünü ve ambalajı düşürür; ham malzeme ikinci kez düşmez. Hazırlanmış iptal stoğa iade sayılmaz.

Cari ödeme asıl borç hareketine dağıtılır; cari ekrandan ödenen fatura yeniden tam borç gibi ödenemez. Nakit teslimi dengeli iki hareketle kaydedilir, yeni tahsilat yaratmaz. Kapanış nakit/POS sayımını ve gerekçesini korur. Personeldeki nakit teslim edilmeden kasa kapatılamaz. Süreye bağlı vardiya yoktur; açık kasa gün veya uygulama kapanışıyla kapanmaz. Teslim et ve kapat işleminde alıcı, sayılan nakit/POS, fark, sorumlu, işlemi yapan, zaman ve açıklama kalır. Bu kayıt teslim beyanıdır; alıcının oturumundan kabul anlamına gelmez. Sonraki kasa kullanımı yeni açılış kaydı ve gerçek başlangıç nakdiyle başlar; geçmiş sıfırlanmaz. Kasa backend/UI finance/cash.js ve public/cash.js/css içindedir.

## Kimlik ve gizli bilgiler

Kişisel parolalar rastgele tuzlu scrypt özetidir. Oturum tokenının yalnız SHA-256 özeti veritabanındadır. Çerez HttpOnly/SameSite=Strict; HTTPS üzerinde Secure kullanır. Normal giriş tarayıcı oturum çerezi ve sunucuda en fazla 12 saattir. Beni hatırla seçilirse hem çerez hem MySQL oturumu 30 gün sürer; varsayılan kapalıdır. Çıkış/kilitleme oturumu iptal eder; parola veya token localStorage/sessionStorage içine yazılmaz. Her istekte aktiflik ve güncel roller okunur. Kullanıcı pasife alındığında, parola sıfırlandığında ve rolü değiştiğinde oturumları iptal edilir. Son etkin işletme sahibi kaldırılamaz. Paylaşılan varsayılan uygulama hesabı yoktur.

.local/database.json uygulama bağlantısını DPAPI ile korur; yönetici parolasını içermez. Kurulum/migration/geri dönüş komutları yönetici parolasını yalnız gizli terminal isteminden alır. Parola komut argümanı, kaynak, hata veya günlüğe yazılmaz. Runtime hesabı kendi veritabanında yalnız SELECT/INSERT/UPDATE/DELETE kullanır.

DPAPI aynı Windows hesabını gerektirir. Kısıtlı otomasyon hesabı çözemiyorsa şifrelemeyi kaldırmayın; kurulumun yapıldığı Windows kullanıcısıyla çalıştırın. Gerçek yönetici parolasını .env içine koymayın. Günlükler seçilmiş hata kodu/zaman/iz kimliği içerir; istek gövdesi veya SQL hatası içermez.

## Başlangıç ve kapatma

npm.cmd start terminalde çalışır, Ctrl+C ile kapanır. Backend olağan dışı kapanırsa üç saniyede bir sınırlı yeniden başlatılır; bir dakikada beş hata veya ayar/port hatası döngüyü durdurur.

npm.cmd run desktop:install bu projeye özgü NarCicegi-97CD03141CBD görevini mevcut Windows kullanıcısının oturum açılışına kurar ve başlatır. Task Scheduler içinde tek kopya çalışır. run-hidden.ps1 Node'u gizli pencereyle başlatır; .local/startup/stdout.log ve stderr.log başlangıç çıktılarıdır. Görev Limited/Interactive çalışır, kullanıcı parolası kaydetmez. Windows servisi değildir; Windows kullanıcısının oturumu gerekir. Güncelleme sonrası planlı yeniden başlatma: npm.cmd run desktop:restart. Kaldırma: npm.cmd run desktop:remove. Bu işlem yalnız beklenen proje eylemine sahip görevi hedefler. Restart/remove komutları yürütülebilir ve tam giriş yolu eşleşen proje Node süreçlerini de durdurur; diğer Node veya MySQL süreçleri hedeflenmez. Task Scheduler üzerinden tek başına durdurma alt süreci bırakabildiği için bu komutları kullanın.

Port doluysa önce npm.cmd run doctor ile kontrol edin. Aynı PC'de ikinci backend başlatmayın. Uygulama klasörü taşınırsa eski görev kaldırılarak yeni konumdan yeniden kurulmalıdır.

## Yedek ve geri dönüş

Kullanıcının seçtiği hedef **.local/yedekler**. Çalışan uygulama açılıştan 30 saniye sonra, ardından altı saatte bir yedek dener; ayrıca yetkili ekrandan veya npm.cmd run backup ile başlatılabilir. Bu hedef aynı disktedir, disk kaybından koruma sağlamaz.

Tutarlı MySQL snapshot'ı ve ek belgeler gzip + AES-256-GCM akışıyla yazılır. Düz metin döküm üretilmez. Önce .partial dosyası, bütünlük/fsync ardından son ad oluşturulur. SHA-256, boyut ve sonuç backup_runs içinde tutulur. Başarısız deneme önceki yedekleri değiştirmez. .local/backup-key.json DPAPI korumalı anahtardır; anahtarı koruyun. Anahtarın başka hesapta kendiliğinden çalışacağı varsayılmaz.

Geri açma komutu:

~~~powershell
npm.cmd run backup:restore-check -- YEDEK_DOSYASI.narbak nar_restore_deneme
~~~

Komut yönetici parolasını gizli ister. Yalnız yeni, ayrı nar_restore_* veritabanı oluşturur; mevcut veritabanını reddeder. Şifreli dosyanın tamamını yazmadan önce doğrular; tabloları transaction içinde açar, kayıt sayılarını/FK ilişkilerini/belge hash'lerini doğrular. Geri açılan oturumları kapatır. Kaynak veritabanını işletme verisiyle değiştirmez; başarılı kaynak yedek kaydına geri dönüş doğrulama zamanı ekler. Başarısız hedef inceleme için bırakılır; kaynak otomatik silinmez/değiştirilmez.

28 Ekim gerçek doğrulama: yükseltme öncesi şifreli yedek nar_restore_20261028_pc adlı ayrı veritabanında **77 tabloyla başarıyla açıldı**. Kaynak canlı şema ayrıca v6'ya geçirildi. Son v6/menü yedeği nar_restore_20261028_menu ayrı hedefinde de 77 tabloyla geri açıldı. Gerçek satış/test fişi canlı veritabanına eklenmedi.

## Yarım kalan ilk kurulum

.local/database.json.pending varsa silmeyin. Yöneticiyle uygulama hesabının oluşup oluşmadığını ve yalnız hedef veritabanına sınırlı yetkisini inceleyin. Hesap/GRANT tamamlanmışsa aynı Windows kullanıcısında bağlantıyı doğrulayıp pending kaydını database.json olarak yeniden adlandırın. Otomatik parola sıfırlama veya veritabanını silip kurma kurtarma yöntemi değildir.

## Aktarım, rapor ve çıktı

Kod navigasyonu docs/kod-haritasi.md → docs/moduller/<alan>.md kartıdır. sales.js yalnız yönlendirme, order-entry.js sipariş, payment-entry.js ödeme, account-list.js liste ve account-tools.js hesap bağlantılarıdır.

XLSX/CSV önce sütun eşleştirme ve önizlemeye girer. 5 MB/500 satır/tek sayfa sınırı vardır; formüller, makrolar, dış bağlantılar ve aşırı ZIP açılımı reddedilir. Hatalı satırla kesinleştirme yapılmaz; tamamı tek transaction'dır. Aynı dosya tekrar stok/bakiye üretmez. Yetkili geri alma önce bağımlılıkları denetler; stok/bakiye ters hareket, fiyat eski değeri taşıyan yeni sürüm, yeni kayıt pasifleştirme yoluyla iz bırakır. Sonradan kullanılmış stoğu/borcu körlemesine silmez.

Raporlar Europe/Istanbul tarih aralığı kullanır. Satış, tahsilat, veresiye, faaliyet gideri, ekipman ve avans ayrıdır. Tüketim maliyeti eksikse kâr hesaplanmaz. Maliyet tamam ise doğrulanmış tüketim maliyeti, brüt kâr ve faaliyet sonucu ayrı görünür. CSV hücreleri formül olarak çalışmayacak biçimde kaçırılır. Ayrıntılı raporlar 200'lük devam sayfaları kullanır.

Hesap/hazırlık çıktıları Windows yazdırma penceresidir; kasa ve mutfak içeriği ayrıdır, mutfakta fiyat yoktur. Fiziksel model, Türkçe karakter ve kâğıt denemesi henüz yapılmadı. Donanım bilgisi geldiğinde doğrudan yazıcı kuyruğu ayrı kurulur. Baskı/pos kaydı fiziksel başarı diye varsayılmaz.

## Doğrulama sınırı

npm.cmd test, npm.cmd run check ve npm.cmd run test:integration kullanılır. Gerçek MySQL entegrasyonu şema yükseltme, kişisel hesap/yetki, sipariş/ayrı ödeme, stok/üretim, alış/cari, Excel geri alma, onay, ek belgeler, şifreli geri dönüş ve kesinti/toparlanmayı sınar. jsdom ekran kontrolleri gerçek HTTP kullanır; gerçek tarayıcı görsel denemesi ve uzun süreli saha kullanımı yerine geçmez. Canlı pencere denetimi bu oturumda kullanılamadı; sipariş ve ödeme düzeni ayrı başsız Chrome profili + izole test verisiyle görsel kontrol edildi. Kesin son test sonucu proje haritasında tutulur.

## Veresiye ve tedarikçi ekranları — 29 Ekim

Veresiye, müşteri satışını sonradan tahsil etme akışıdır; Tedarikçiler firma borcu ve ödeme akışıdır. party-book.js listeleri, party-detail.js seçili hesabın işlemlerini yönetir. Mal alışları purchases.js içinde, stok stock.js içinde durur. finance.js ve stock.js eski içe aktarımlar için uyumluluk dışa aktarımı tutar. Mevcut borç/tahsilat ve stok servisleri, şema v7 ve kayıtlar korunur. Müşteri kartından başlatılan adisyon için müşteri önerisi tarayıcı oturumunda adisyon kimliğiyle taşınır; tam sayfa yenilemesinde yeniden seçilir. Bu öneri kendi başına borç oluşturmaz; ödeme ekranındaki Veresiye işlemi oluşturur.

## Ekran araması ve yapay zekâ kullanım rehberi — 29 Ekim

navigation-catalog.js ekran isim/izin/anahtar kelime/rehber için ortak statik kayıttır. navigation-search.js program içi ekran aramasıdır; iş kaydı aramaz, backend yetkisi yerine geçmez. app.js ES modülü olarak yüklenir.

Program rehberi yerel adımları bağlantısız gösterir. İsteğe bağlı yapay zekâ yalnız kullanım sorularını yanıtlar; işletme verisi okuma/yazma aracı yoktur. OpenAI Responses API, gpt-6-luna, store:false kullanılır. Soru ve izinli rehber gönderilir. Anahtar yönetici tarafından uygulama ayarından girilir, .local/assistant.json içinde Windows DPAPI ile korunur; yanıtlarda geri dönmez. Ayar değişiklikleri atomik/revision/requestKey ve güncelleyen kişi/zaman içerir. Anahtar ayrıca yedek paketine eklenmez. Dış istek otomatik tekrarlanmaz; kullanıcı başına dakika sınırı ve süre/çıktı sınırı vardır. Gerçek anahtar bulunmadığından model yanıtı henüz canlı denenmedi.

## Sipariş üzerine hazırlama ve stok eksikliği — 29 Ekim

Hazırlanan ürün için hazır porsiyon stoğu zorunlu değildir. Tanımlı reçete malzemeleri tüketilir. Bir satırın tüm malzemeleri tüketilemiyorsa SAVEPOINT denemesi geri alınır, sipariş ve ödeme devam eder, stock_issue_json neden/zamanı tutar. Stok ekranında yetkili kişi eksik giderilince aynı satırı bir kez tamamlar. Kısmi malzeme düşüp satışı kaybetme veya yeniden denemede iki kez düşme engellenir. Başlangıç stok formunda hazır ürün için açık otomatik takip seçimi vardır; stok var fakat takip kapalı ürünler uyarılır. Reçetesiz yemeklerde malzeme miktarı varsayılmaz.

## Wi-Fi etkinleştirme ve mobil görünüm — 29 Ekim

- network.js HTTPS yaşam döngüsünü, network-routes.js settings.manage + loopback sınırını yönetir. CSRF için kayıtlı host/gerçek port ve LAN'da tam aynı Origin gerekir; proxy başlıklarına güvenilmez. HTTPS çerezi Secure/HttpOnly/SameSite=Strict olur.
- Etkinleştirme requestKey, revision, tek çalışan iş ve kalıcı son komut kaydı kullanır. Windows onayı uzun sürerse API hızlıca iş durumunu döndürür; ekran durumu sorgular. Yanıt kaybında aynı anahtar yeni Windows işi başlatmaz; eski revision tekrar açma/kapatma yapamaz.
- .local/network altında şifreli server.pfx, yalnız DPAPI korumalı parola içeren tls.json, açık kök/sunucu sertifikası, authority.json ve state.json bulunur. Kök CA özel anahtarı Windows CurrentUser/My deposunda dışa aktarılamazdır; HTTP ile özel anahtar sunulmaz. Runtime DDL veya yönetici parolası kullanmaz.
- network-setup.ps1 ağ/TLS hazırlığını normal kullanıcıda; network-firewall.ps1 yalnız açık etkinleştirmede Windows yükseltmesiyle yapar. Güvenlik duvarının başka kurallarını değiştirmez. Ağ kapatma HTTPS dinleyicisini kapatır; PC HTTP sürer.
- Telefonun işletme CA sertifikasına güvenmesi cihaz üzerinde bir kez yapılır; sertifika ana bilgisayardaki yetkili indirme alanından aktarılır ve SHA-256 parmak izi karşılaştırılır. Uygulama telefona uzaktan güven sertifikası kurmaz. Fiziksel telefon ve gerçek UAC/firewall etkinleştirmesi bu oturumda yapılmadı.
- display-mode.js tarayıcıda Otomatik/Telefon/PC seçimini saklar; responsive.css ortak mobil düzeni uygular. İş yetkileri değişmez. Büyük ödeme tablosu kendi alanında kayar.
- guide-scenarios.js tek statik 33 senaryo kaynağıdır; screen-guide.js ekran içi ve rol filtreli tam metin rehber aramasını sağlar. Aynı senaryolar navigation-catalog.js üzerinden AI rehberine dahil edilir; iş verisi veya örnek kayıt oluşturulmaz.
- İzole entegrasyon sunucusu NAR_DISABLE_NETWORK=1 kullanır; gerçek LAN ayarını yüklemez. Gerçek TLS testi geçici sertifika üretimi için sistem/Git OpenSSL aracını kullanır; araç yoksa o test açıkça atlanır. Bu oturumda atlanan test yoktur.
- Kaynak: [Node HTTPS/TLS](https://nodejs.org/api/https.html), [Windows sertifika üretimi](https://learn.microsoft.com/en-us/powershell/module/pki/new-selfsignedcertificate), [Windows güvenlik duvarı kuralı](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule).
