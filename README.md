# Nar Çiçeği

Market, restoran ve kafe için aynı PC'de çalışan işletme uygulaması. Node.js **24.15+ / 24.x**, Express 5, mysql2 ve MySQL 8 kullanır. Gerçek ekranlar, API'ler ve kalıcı işlem kayıtları hazırdır; kaynak şema **v8**. Mevcut erişim yalnız bu PC'dedir ve yazıcısız kullanım esas alınır. PC ve telefon görünümü desteklenir. Dükkân ağına erişim Ayarlar → Ağda etkinleştir ile açılır; o anki yerel IP otomatik bulunur ve HTTPS adresi gösterilir.

Dosya veya hata konumu belliyse oradan başlayın; konum belirsizse [Proje haritasının](docs/proje-haritasi.md) ilgili bölümünden modülü seçin. Fonksiyon/API/test ayrıntısı gerektiğinde bağlı modül kartını açın.

VS Code için [dukkan.code-workspace](dukkan.code-workspace) dosyasını açın: tek kök proje klasörüdür. Mevcut `.vscode` görevleri ve ayarları korunur; arama dışlamaları klasör ayarında, otomatik Git depo keşfi çalışma alanı ayarındadır. Gerektiğinde aramanın dışlama/ignore düğmesini kapatarak dışlanan dosyaları araştırabilirsiniz. Git kökü ve doğrulanan sınır [proje haritasındadır](docs/proje-haritasi.md).

Çalışmaya giriş: [Proje haritası](docs/proje-haritasi.md). Modül adresleri ve güncel devam noktası burada tutulur; ayrıntılı test geçmişi ve bekleyen işlere buradan bağlantı verilir. İş kuralları: [Ekran planı](docs/planlama/ekran-plani.md). İşletim ve kurtarma: [Altyapı](docs/altyapi.md).

## Kullanım

Proje kökünde:

~~~powershell
npm.cmd start
~~~

Uygulama: **http://127.0.0.1:5080** · Durum: **http://127.0.0.1:5080/status.html**.

İlk açılışta kişisel yönetici hesabını oluşturun. Uygulama hesabı MySQL yöneticisinden ayrıdır; hazır kullanıcı/parola yoktur. Kurulum ekranı tamamlanmadan iş kaydı açılamaz. Göreve göre masalar, satış veya mutfak ekranı açılır. Kilitle/kullanıcı değiştir işlemi mevcut oturumu kapatır.

Masalar ve adisyonlar, nakit/POS/veresiye ve ayrı ödeme, mutfak, ürün/servis/barkod/reçete, üretim/parti/sayım/transfer, alış/kabul/iade, cari, kasa/vardiya, gider/ekipman, raporlar, gerçek XLSX/CSV aktarımı ve onaylar uygulama menüsündedir. POS düğmesi fiziksel cihazda alınan ödemeyi kaydeder. Hesap ve hazırlık çıktıları Windows yazdırma penceresini açar; fiziksel cihazdan otomatik baskı/ödeme başlatmaz.

Görünüm seçimi üstteki Otomatik / Telefon / PC alanındadır. Program rehberinde 33 örnek senaryo aranabilir; ilgili ekranlarda Bu ekranı nasıl kullanırım? bölümü vardır. Örnekleri okumak kayıt oluşturmaz.

## İşletim komutları

| Komut | İşlev |
|---|---|
| npm.cmd start | Terminalde çalıştırma; Ctrl+C ile durdurma |
| npm.cmd run doctor | Bağlantı, şema ve çalışan uygulama kontrolü |
| npm.cmd run desktop:install | Bu Windows kullanıcısı oturum açınca gizli başlatma görevini kurar ve başlatır |
| npm.cmd run desktop:restart | Yalnız bu projenin görevini durdurur ve güncel kodla yeniden başlatır |
| npm.cmd run desktop:remove | Yalnız bu proje için oluşturulan başlangıç görevini durdurur/kaldırır |
| npm.cmd run db:migrate | Gizli yönetici istemiyle sürümlü şema yükseltmesi; parolayı kaydetmez |
| npm.cmd run backup | Proje içindeki .local/yedekler klasörüne şifreli yedek |
| npm.cmd run backup:restore-check -- DOSYA nar_restore_DENEME | Yeni ve ayrı veritabanına doğrulamalı geri açma; mevcut hedefi reddeder |
| npm.cmd run menu:import | Tarihli 85 ürün / 94 seçenek referans menüsünü yetkili hesap adına aktarır |
| npm.cmd run check | Bütün kaynak/ekran/komut/test JavaScript dosyalarını denetler |
| npm.cmd test | Birim/HTTP/ayrıştırıcı ve ödeme taslağı kontrolleri |
| npm.cmd run test:integration | Ayrı MySQL'de gerçek iş akışları, eşzamanlılık, yedek/geri dönüş ve kesinti |

Başlangıç görevi kurulduysa ikinci kez npm start çalıştırmayın; aynı portta ikinci sunucu açılmaz. Başlangıç görevi Windows servisi değildir; ilgili kullanıcı oturumu açıkken çalışır. Ağ erişimi varsayılan olarak kapalıdır; ana bilgisayardaki yetkili kişi güvenilir ağ onayıyla etkinleştirir. Windows izin penceresi tamamlanır; telefonda ilk kullanımda işletmenin CA sertifikası kurulur. Her çalışan kendi hesabıyla giriş yapar.

## Yeni bilgisayara kurulum

~~~powershell
npm.cmd ci --ignore-scripts
npm.cmd run setup
npm.cmd run doctor
npm.cmd start
~~~

setup yönetici parolasını gizli terminalden alır, MySQL veritabanını ve ayrı sınırlı uygulama hesabını kurar. .local/database.json yalnız DPAPI korumalı uygulama bağlantısıdır; yönetici parolası içermez. Başka Windows hesabına kopyalamak bağlantıyı veya yedek anahtarını taşımaz. Yarım kurulumdaki .pending kaydını silmeden altyapı belgesini okuyun.

## Yedek ve dosyalar

Yedek hedefi kullanıcının seçimiyle **proje içindeki .local/yedekler**. Uygulama çalışırken açılıştan 30 saniye sonra ve altı saatte bir otomatik denenir. Yedekler AES-GCM ile şifrelenir; belge ekleri dahildir. Anahtar .local/backup-key.json içinde Windows DPAPI korumasındadır. Anahtar kaybolursa yalnız yedek dosyasıyla geri dönüş yapılamaz. Aynı diskteki yedek disk arızasına karşı koruma sağlamaz.

backend/src iş servisleri; backend/public gerçek ekranlar; backend/scripts işletim araçları; backend/tests testler; docs/planlama iş kurallarıdır. prototypes örnek verili taslaklar içerir, gerçek satış kaydetmez. .local yerel ayar/yedek/ek/test çıktısı içindir, repoya eklenmez. Eski C# arşivi çalıştırılmaz.
