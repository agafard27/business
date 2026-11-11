# Dükkan Revize

Mevcut Nar Çiçeği özelliklerini sabit IBM cihazına uyarlayan ayrı proje.

**Hedef:** Windows 7 SP1 x86, Intel Celeron M 1 GHz, 2 GB RAM, 1024×768. Donanım değişimi ön koşul değildir. Ana uygulama `../backend` altında çalışmaya devam eder.

**Mevcut durum:** İlk yerel masaüstü uygulaması yazıldı. Başlangıç, cihaz denetimi ve mevcut özelliklerin aktarım kapsamı ekranları vardır. Satış, oturum, stok ve diğer iş modülleri henüz aktarılmadı. Setup.exe henüz hazırlanmadı; bu aşamada taşınabilir bir cihaz deneme paketi üretilir.

## Çalıştırma ve geliştirme

Geliştirme bilgisayarında .NET Framework 4.8 Developer Pack, Windows PowerShell 5.1 ve indirme hash denetimi için Node.js gerekir. Hedef cihazda yalnız .NET Framework 4.8 ve paket dosyaları gerekir; Node.js veya MySQL kurulmaz.

Bu klasörde:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/build.ps1
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/test.ps1 -SkipBuild
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/package.ps1 -SkipBuild
```

İlk derleme SQLite x86 arşivini resmi siteden indirir, [kilit kaydındaki](dependencies/sqlite.lock.json) SHA3-256 ile doğrular ve yerel bağımlılık dizinine çıkarır. Sonraki derlemeler aynı arşivi yeniden doğrular. Yalnız uygulama çalıştırılırken internet gerekmez.

- Uygulama: `.local/bin/DukkanRevize.exe`
- Cihaz paketi: `dagitim/DukkanRevize-CihazDenemesi-x86.zip`
- Görsel test çıktıları: `.local/test-results/home-1024.png`, `.local/test-results/diagnostics-1024.png`
- Visual Studio proje dosyası: [DukkanRevize.csproj](src/DukkanRevize/DukkanRevize.csproj). Önce bağımlılık betiğini çalıştırın; esas doğrulama yukarıdaki betiklerdir.

Hedef cihaz talimatı: [CIHAZDA-CALISTIRMA.txt](CIHAZDA-CALISTIRMA.txt).

## Kod yönlendirmesi

| Yol | Sorumluluk |
|---|---|
| [Program.cs](src/DukkanRevize/Program.cs) | x86 uygulama girişi ve güvenli hata bildirimi |
| [MainForm.cs](src/DukkanRevize/UI/MainForm.cs) | Yerel pencere, 1024×768 düzen ve üç başlangıç ekranı |
| [ModuleCatalog.cs](src/DukkanRevize/Core/ModuleCatalog.cs) | İşlev kaybı olmaması için görünür aktarım kapsamı |
| [DeviceCheck.cs](src/DukkanRevize/Diagnostics/DeviceCheck.cs) | Cihaz raporu ve yalnız geçici veride gerçek veritabanı denemesi |
| [SqliteDatabase.cs](src/DukkanRevize/Data/SqliteDatabase.cs) | SQLite UTF-8, bağlı parametreler, 64 bit tam sayı, FK ve sınırlı kilit bekleme |
| [PrintProbe.cs](src/DukkanRevize/UI/PrintProbe.cs) | Kullanıcının seçtiği yazıcıya fiziksel kontrol çıktısı |
| [CompatibilityTests.cs](tests/CompatibilityTests.cs) | x86, dosyaya yazma/geri alma, veri doğruluğu, kilit çakışması ve görünüm denemesi |
| [scripts](scripts) | Bağımlılık doğrulama, derleme, test ve cihaz paketi |

İş modülleri aktarılırken `Core`, `Data` ve `UI` sorumlulukları ayrılacak; sipariş/ödeme/hesap kodu tek ekranda toplanmayacak. Tam kapsam ve ana uygulamadaki modül kaynakları [PROJE-PLANI.md](PROJE-PLANI.md) içindedir.

## Cihaz denemesi ne yapar?

- Gerçek x86 süreç ve mevcut Windows/CLR/ekran bilgilerini gösterir.
- Geçici bir klasörde SQLite dosyası açar; Türkçe metin ve tam sayı para değerini yazar, COMMIT yapar, ikinci yazmayı ROLLBACK ile geri alır ve dosyayı yeniden açıp sonucu denetler.
- İşlem sonunda kendi geçici klasörünü temizler. Canlı işletme veritabanını açmaz ve iş şeması oluşturmaz.
- Dokunma sayacını ve isteğe bağlı yazıcı denemesini sunar; rapor kullanıcının seçtiği dosyaya kaydedilir.
- Otomatik testler FK reddi, SQL parametreleri, 64 bit tam sayı doğruluğu ve eşzamanlı yazmada çift kayıt oluşmamasını da denetler.

## Devam noktası

5 Kasım 2026 geliştirme doğrulaması: hem proje dosyası hem betik üzerinden x86 derleme başarılı; 5/5 yeni proje kontrolü geçti. Ana uygulamanın `npm.cmd test` kontrolü de 87/87 test ve ödeme taslağı denemesiyle geçti. Başlangıç ve cihaz denetimi ekranları 1024×728 pencere boyutunda çizilip görsel incelendi. Bu boyut, 1024×768 ekranda görev çubuğu için alan bırakır. Beş dosyalı yaklaşık 1,1 MB cihaz deneme ZIP paketi üretildi; paket içeriği ve 41 yerel belge bağlantısı denetlendi. IBM cihazda veya Windows 7 üzerinde henüz çalıştırılmadı; dokunmatik/yazıcı fiziksel kabulü bekliyor.

1. İlk cihaz paketi IBM makinede açılıp cihaz raporu, dokunma, ekran ve varsa yazıcı sonucu alınacak. Geliştirme bilgisayarında başarılı olması IBM kabulünün yerine geçmez.
2. Kullanıcı/rol, açık ve sürümlü SQLite migration, işlem anahtarı/revision ve hata toparlama temeli kurulacak. Normal açılışta otomatik iş şeması oluşturulmayacak.
3. Güncel ana modüllerden ürün, bölüm/masa, sipariş ve ödeme davranışı sırasıyla aktarılacak; aynı senaryolar karşılaştırılacak.
4. Kalan stok, alış, cari, kasa, personel, rapor, aktarım, yedek, rehber ve telefon işlevleri kapsam listesindeki sırayla tamamlanacak.
5. Tamamlanan işlevler ve cihaz kabulünden sonra gerçek setup/güncelleme/veri aktarımı hazırlanacak.

Telefon bağlantısı bu ilk sürümde yoktur. Bu, kapsamdan çıkarıldığı anlamına gelmez. Yerel satış ekranı için tarayıcı/sertifika gerekmeyecek; ağ erişiminin oturum, yetki ve HTTPS korumaları ayrıca korunacaktır.
