# Nar Çiçeği — sabit donanıma uyarlama projesi

Tarih: 5 Kasım 2026

Güncel geliştirme klasörü kullanıcının istediği adla **dükkan revize** olarak oluşturuldu. Çalışan ilk cihaz denemesinin kodu, komutları, doğrulaması ve devam noktası [README.md](README.md) içindedir. Aşağıdaki kapsam, bütün özelliklerin aktarımı için temel kayıttır.

## Kullanıcının kesin talebi

Mevcut Nar Çiçeği yazılımı esas alınarak, eldeki IBM cihazda çalışacak ayrı bir proje geliştirilecek. Donanım ve işletim sistemi sabittir. Özellikler kendiliğinden azaltılmayacak; iş akışları ve veri doğruluğu korunarak uygulama altyapısı ve ekranlar uyarlanacak.

Bu klasör ayrı projenin başlangıcıdır. İlk cihaz denemesi geliştirilmiştir; iş modüllerinin tamamı veya Setup.exe henüz üretilmemiştir. Ana uygulamanın kaynakları ve canlı verileri bu çalışma kapsamında değiştirilmez.

## Sabit hedef cihaz

Kullanıcının sağladığı iki sistem bilgisi fotoğrafından:

| Alan | Hedef |
|---|---|
| Cihaz | IBM, model 4852E26 |
| İşletim sistemi | Windows 7 Ultimate SP1, 32 bit; yapı 7601 |
| İşlemci | Intel Celeron M, yaklaşık 1 GHz |
| Bellek | 2048 MB RAM |
| Görüntü | 1024 × 768, 60 Hz |
| Grafik | Intel 915GM/GMS, 910GML ailesi |
| Kurulum | Cihaza kurulabilen setup paketi ve masaüstü kısayolu |

Disk kapasitesi, boş alan, disk sağlığı, kurulu .NET sürümü, yazıcı modeli, dokunmatik sürücüsü ve ağ bağdaştırıcısı fotoğraflardan kesinleşmiyor. Bunlar cihaz üzerinde okunarak doğrulanacak; yeni donanım alınması ön koşul olmayacak.

## Mevcut uygulamadan alınacak temel

Güncel kaynak Node.js 24 + Express 5 + MySQL 8 kullanır. Bu altyapı hedef Windows 7 / 32 bit sisteme doğrudan taşınamaz. Uyarlama, yalnız mevcut klasörü kopyalayıp setup içine koymakla tamamlanmış sayılmaz.

Kaynak yönlendirmesi: [proje haritası](../docs/proje-haritasi.md), [ekran planı](../docs/planlama/ekran-plani.md) ve [güncel iş kuralları](../docs/altyapi.md). Eski tarihli ekran planı ile çalışan kaynak çelişirse ilgili güncel modül doğrulanır.

### Korunacak özellikler ve kaynakları

| Alan | Uyarlamada korunacak işler | Kaynak modül |
|---|---|---|
| Sipariş | Masa siparişi, servis seçimi, miktar, not, taslak, gönderme | [sales-order](../docs/moduller/sales-order.md) |
| Hesaplar | Hesap açma, bekletme, taşıma, birleştirme | [sales-accounts](../docs/moduller/sales-accounts.md) |
| Ödeme | Parçalı ödeme, tahsilat, veresiye, iade, hesap çıktısı | [sales-payment](../docs/moduller/sales-payment.md) |
| Bölüm ve masa | Bölüm/masa tanımlama, düzenleme, kaldırma ve geri getirme | [dining](../docs/moduller/dining.md) |
| Ürünler | Ürün, servis, fiyat, birim, paket ve tartılı satış tanımları | [catalog](../docs/moduller/catalog.md) |
| Mutfak ve bar | Hazırlık listesi ve durum takibi | [kitchen](../docs/moduller/kitchen.md) |
| Stok | Reçete, üretim, parti, tüketim, sayım, eksik tüketimi tamamlama | [stock](../docs/moduller/stock.md) |
| Alış | Mal kabulü, iade, stok ve firma borcu ilişkisi | [purchasing](../docs/moduller/purchasing.md) |
| Kasa | Açılış, hareket, teslim, devir, sayım ve kapanış | [cash](../docs/moduller/cash.md) |
| Cari | Müşteri veresiye ve tedarikçi borç/ödeme hesapları | [parties](../docs/moduller/parties.md) |
| Gider ve personel | Gider, personel ödemesi, avans ve ekipman | [expenses](../docs/moduller/expenses.md) |
| Rapor | Genel bakış, ayrıntılar, eksik maliyet ve işlem geçmişi | [reports](../docs/moduller/reports.md) |
| Aktarım | Excel/CSV içe alma, doğrulama ve geri alma | [imports](../docs/moduller/imports.md) |
| Yetkilendirme | Giriş, çalışan, rol, oturum ve kullanıcı değişimi | [auth](../docs/moduller/auth.md) |
| Onay | Yetkili onayı ve onaylanan işlemin kaydı | [approvals](../docs/moduller/approvals.md) |
| Yedek | Şifreli yedek, doğrulama ve ayrı hedefte geri açma | [backup](../docs/moduller/backup.md) |
| Belgeler | İş kayıtlarının belge ekleri | [files](../docs/moduller/files.md) |
| İşlem altyapısı | Yetki, transaction, tekrar anahtarı ve sürüm kontrolü | [business-core](../docs/moduller/business-core.md) |
| Ayarlar | İşletme, bağlantı ve yazıcı ayarları | [settings](../docs/moduller/settings.md) |
| Şema | Sürümlü, yeniden başlatılabilir veri yapısı güncellemeleri | [schema](../docs/moduller/schema.md) |
| Miktar | Mevcut hesaplama hassasiyeti ve okunabilir gösterim | [quantity-display](../docs/moduller/quantity-display.md) |
| Menü | Ekran arama, yetkiye uygun menü ve gezinti | [navigation](../docs/moduller/navigation.md) |
| Rehber | Yerel kullanım rehberi ve isteğe bağlı AI yardımının kapsamı | [assistant](../docs/moduller/assistant.md) |
| Çalıştırma ve ağ | Kurulum, başlatma, sağlık kontrolü, telefon/yerel ağ erişimi | [runtime](../docs/moduller/runtime.md) |

Her alan kendi uygulama, doğrulama ve cihaz kabulü tamamlanınca aktarılmış sayılacak. Uygulama sırasının sonuna alınması, özelliğin kapsamdan çıkarıldığı anlamına gelmez.

## Donanıma uygun teknik yaklaşım

İlk uygulama temeli 32 bit yerel Windows masaüstü uygulaması ve cihaz içinde çalışan veritabanıdır. C# / .NET Framework 4.8 / WinForms ile SQLite x86 kullanılmıştır. Bu seçim yalnız yeni proje içindir; ana uygulamanın teknoloji kararını değiştirmez. Hedef IBM cihazda uyumluluk kabulü ayrıca yapılacaktır.

- İş ekranları yerel masaüstü kontrolleriyle kurulacak; satış ekranının çalışması güncel Chrome veya Electron'a bağlı olmayacak.
- İş kuralları ekranlardan ayrı servislerde tutulacak. Modüller tek dosyada birleştirilmeyecek.
- SQLite erişimi tek uygulama hizmeti üzerinden düzenlenecek. Telefonlar veritabanı dosyasını ağ paylaşımından açmayacak.
- Çok cihazlı sipariş ve mutfak erişimi ayrı ağ katmanı olarak korunacak. Eşzamanlı yazma, tekrar istek ve çakışma davranışı ayrıca sınanacak.
- Yerel masaüstü kullanımı için telefon sertifikası gerekmeyecek. Telefon HTTPS erişimindeki güven kurulumu ayrı konudur; sertifika denetimi veya oturum/yetki kontrolleri kaldırılmayacak.
- Mevcut MySQL tabloları SQLite'a körlemesine çevrilmeyecek. Veri tipleri, para/miktar aralıkları, ilişkiler ve transaction davranışı her modülde doğrulanacak.
- Önceki C# arşivi çalıştırılmayacak veya hazır, doğrulanmış çözüm kabul edilmeyecek. Kaynak alınacak davranış güncel uygulamadır.

Teknik dayanaklar: [Microsoft .NET Framework 4.8 ve Windows 7 SP1 bilgisi](https://support.microsoft.com/en-us/servicing/dotnetframework/2019/10/microsoft-net-framework-4-8-offline-installer-for-windows), [SQLite x86 dağıtımı](https://www.sqlite.org/download.html). Paket ve sürücülerin hedef işlemciyle çalışması ayrıca sınanacaktır.

Windows 7'nin üretici desteği bitmiştir. Hedefte çalışabilirlik testi bu işletim sistemini yeniden desteklenen bir sistem hâline getirmez. [Microsoft yaşam döngüsü](https://learn.microsoft.com/en-gb/lifecycle/products/windows-7)

## Ekran ve kaynak kullanımı

- Gerçek çalışma alanı görev çubuğu ve pencere kenarlıkları çıkarılarak ölçülecek. Formlar 1024 × 768 içine sığacak.
- Masa, ürün ve ödeme düğmeleri dokunarak kullanılacak; önemli işlemler yatay kaydırmaya bağlı olmayacak.
- Aynı anda yalnız aktif ekranın verisi yüklenecek. Büyük listeler sayfalı sorgulanacak; tüm geçmiş belleğe alınmayacak.
- Raporlar tarih ve kayıt sınırıyla açılacak. Uzun sorgu, aktarım ve yedekleme arayüzü kilitlemeyecek.
- Görsel efektler ve sürekli tüm ekranı yenileme kullanılmayacak. Liste güncellemeleri değişen kayıtlarla sınırlanacak.
- Para tam kuruş, miktar altı ondalık ölçekle işlenecek. Taşma kontrolleriyle mevcut aralık korunacak; binary kayan nokta para hesabı yapılmayacak.
- Bellek ve işlemci tüketimi gerçek veri hacmiyle ölçülecek. Fotoğrafa bakarak hız veya bellek tüketimi garantisi verilmeyecek.

## Aktarımda değişmeyecek iş kuralları

1. İlk sipariş hesabı ve siparişi aynı işlem içinde oluşturur; boş masaya bakmak hesap açmaz.
2. Satış anındaki fiyat, birim, servis ve reçete bilgileri geçmiş işlemde korunur.
3. Eksik stok satış ve ödemeyi kaybettirmez; bekleyen tüketim sonradan bir kez tamamlanır.
4. Ödeme, veresiye, borç dağıtımı, kasa teslimi ve iade aynı hareketi iki kez üretmez.
5. Yazma sonucu belirsizse yeni işlem kimliğiyle kör tekrar yapılmaz; aynı komutun sonucu doğrulanır.
6. Yetki uygulama hizmetinde denetlenir; düğmenin gizlenmesi yetkilendirme yerine geçmez.
7. Şema yükseltmeleri sürümlüdür; mevcut kayıtlar sessizce silinmez veya baştan oluşturulmaz.
8. Gerçek satış, stok ve bakiye uydurulmaz. Geliştirme ve testler canlı iş verisine yazmaz.
9. Parolalar ve anahtarlar kaynak, düz metin ayar, günlük veya kurulum argümanlarına konmaz.
10. Veri aktarımı doğrulanmış yedek/kopya üzerinden yapılır; ilk deneme canlı verinin üstüne yazmaz.

## Uygulama sırası ve tamamlanma ölçütleri

| Sıra | İş | Tamamlanma kanıtı |
|---|---|---|
| 1 | Cihaz uyumluluk denemesi | x86 uygulama açılır; dokunmatik giriş, Türkçe metin, yerel DB transaction ve yazıcı denemesi sonuçları kaydedilir |
| 2 | Ortak uygulama temeli | Kullanıcı/rol, işlem anahtarı, sürümlü şema ve hata toparlama izole veride doğrulanır |
| 3 | Ürün, masa, sipariş ve ödeme | Mevcut uygulamayla aynı girdiler aynı sipariş/ödeme sonuçlarını verir; çift dokunma çift kayıt üretmez |
| 4 | Mutfak, stok ve alış | Hazırlık, reçete, eksik tüketim, mal kabulü ve iade senaryoları karşılaştırılır |
| 5 | Cari, kasa, gider ve personel | Borç/ödeme dağıtımı, kasa teslimi, kapanış ve bakiye kontrolleri geçer |
| 6 | Rapor, aktarım, ekler ve rehber | Rapor toplamları, Excel/CSV, ek belgeler, yerel rehber ve isteğe bağlı yardım kapsamı doğrulanır |
| 7 | Telefon ve yerel ağ | Hedef cihazda güvenli ağ açma, rol kontrolleri, eşzamanlı sipariş ve kesinti sonrası toparlama denenir |
| 8 | Setup, veri aktarımı ve kabul | Temiz kurulum, güncelleme, şifreli yedek/geri dönüş, cihazda uzun kullanım ve ölçüm kayıtları tamamlanır |

Setup, hedefte gereken ve uyumluluğu doğrulanmış çalışma bileşenlerini denetleyecek; uygulama dosyaları ile iş verisini ayıracak. Güncelleme ve kaldırma iş verisini varsayılan olarak silmeyecek. İlk çalıştırma gerçek işletme/kullanıcı kurulumu isteyecek; ortak varsayılan parola dağıtılmayacak.

## İlk geliştirme durumu ve devam noktası

- Ayrı proje klasörü ve kapsam dosyası oluşturuldu.
- Mevcut modül kartları ve güncel iş kuralları başlangıç kaynağı olarak eşlendi.
- İlk x86 uyumluluk uygulamasının kaynakları, denetim ekranı ve testleri yazıldı. Canlı veri değişikliği yapılmadı; tam ürün setup'ı henüz yoktur.
- Cihaz paketi ve gelişim kaydı için [README.md](README.md) kullanılır. Sıradaki adım gerçek IBM uyumluluk denemesiyle birlikte kullanıcı/rol ve sürümlü şema temelinin geliştirilmesidir. Tam uyarlama, yukarıdaki özellik ve kabul listeleri bitmeden tamamlandı sayılmayacak.
