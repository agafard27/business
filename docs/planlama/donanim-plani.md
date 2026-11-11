# Donanım ve yazdırma planı

Durum: 21 Ekim 2026. İşletme sahibinin bildirdiği cihazlar ve önerilen kullanım düzeni kaydedilmiştir. Fiziksel kontrol, bağlantı denemesi veya sürücü kurulumu yapılmamıştır.

## 1. Mevcut cihazlar

| Cihaz | Bilinen durum | Netleştirilecek bilgi |
|---|---|---|
| Fiş/sipariş yazıcıları | Birkaç Epson TM-U220B; kullanıcı etiket bilgisini M188B olarak bildirdi | Kesin adet, her cihazın bağlantı kartı, kabloları, adaptörü ve çalışma durumu |
| Ana bilgisayar | Alınacak | Windows sürümü, bağlantı gereksinimi, yerleşim ve yedekleme hedefi |
| Garson telefonları | Android ve iPhone | İşletme Wi-Fi kapsaması ve eşzamanlı cihaz sayısı |
| Yerel ağ | Wi-Fi var | Ana bilgisayar ve yazıcı noktalarına kablo erişimi, router/switch bağlantıları |
| Terazi | Mevcut; ağ/fiş entegrasyonu bulunmadığı bildirildi | Tartım elle girilecek; ilk kapsamda cihaz bağlantısı yok |

TM-U220B, Epson'un belgelerinde şerit kullanan iğneli baskı modeli olarak yer alır. Seri, paralel, USB ve Ethernet bağlantılı seçenekler listelenmiştir. Model adı veya M188B etiketi, eldeki cihazın takılı bağlantı kartını tek başına kesinleştirmez. Desteklenen kâğıt genişlikleri 57,5 / 69,5 / 76 mm ve şerit tipi ERC-38 olarak belirtilir; her cihazdaki mevcut düzen kontrol edilmeden sarf malzemesi alınmaz. Kaynak: [Epson TM-U220B özellikleri](https://www.epson.com.au/products/receipt-printers/kitchen-printers/TM-U220B).

## 2. Önerilen görev dağılımı

Çalışır cihaz sayısı ve bağlantılar doğrulandıktan sonra:

- Kasa: müşterinin hesap özeti ve yetkili tekrar çıktıları.
- Mutfak: mutfak hazırlığı gerektiren yeni siparişler ve bunlara ait değişiklikler.
- Bar/içecek alanı: ayrı hazırlık noktası ve yeterli cihaz varsa ilgili içecek siparişleri.
- Ek cihaz: sayıya ve fiziksel duruma göre yedek olarak değerlendirilebilir.

Ürünlerin hazırlık bölümü katalogda tanımlanır. Paket ürün gibi hazırlık gerektirmeyen kalemler hesapta bulunur; gereksiz mutfak çıktısı oluşturmaz. Tek hazırlık noktası varsa mutfak ve bar aynı yazıcıya yönlendirilebilir.

Sipariş fişinde masa, adisyon/sipariş kimliği, saat, garson, ürün, miktar, servis seçeneği ve not bulunur. Yeni eklenen siparişte yalnızca yeni gönderilen kalemler basılır. Önceden gönderilen siparişte iptal/değişiklik veya masa taşıma olduğunda ilgili hazırlık alanına ayırt edilebilir bildirim hazırlanır; bu bildirim yeni ürün siparişi oluşturmaz.

## 3. Bağlantı kararı

- Ethernet bağlantısı varsa yazıcı yerel ağa kabloyla bağlanarak konumlandırılabilir. Ağ kartı, adresleme ve ana hizmetten erişim denenir.
- USB bağlantısı varsa bilgisayar konumu ve kablo mesafesi birlikte değerlendirilir.
- Seri veya paralel bağlantı varsa bilgisayar portu, doğru kablo, arayüz ayarı ve sürücü uyumluluğu doğrulanır. Dönüştürücü gereksinimi bağlantı belirlendikten sonra kararlaştırılır.

Mevcut işletme Wi-Fi'si, yazıcılarda kablosuz bağlantı bulunduğu anlamına gelmez. Telefonlar siparişi yerel uygulama hizmetine gönderir; baskıyı ana bilgisayar yönetir. Android/iPhone üzerinde her yazıcı için ayrı sürücü kurulması planlanmaz. Kullanılacak Windows sürümü ve mimarisi için resmi sürücü desteği kurulum öncesinde kontrol edilir.

## 4. Kalıcı yazdırma kuyruğu

- Sipariş ve ilgili baskı görevi aynı veritabanı işlemi içinde kaydedilir. Baskı hatası sipariş kaydını silmez.
- Her görevin sipariş kimliği, hedef yazıcısı, baskı içeriği, oluşturulma zamanı, durumu ve deneme geçmişi bulunur.
- Durumlar bekliyor, gönderiliyor, bağlantı/sarf hatası ve sonucu belirsiz gibi ayrıntıları ayırır. Sürücüye gönderilmiş olması, kâğıtta okunaklı çıktı görüldüğünü kanıtlamaz.
- Bilgisayar yeniden açıldığında bekleyen görevler bulunur. Bir yazıcının hatası diğer yazıcıların kuyruğunu durdurmaz.
- Sonucu belirsiz baskılar körlemesine tekrar edilmez. Yetkili tekrar çıktısı, ilk sipariş kimliğiyle ve görünür "TEKRAR ÇIKTI" ibaresiyle kaydedilir. Yeni satış veya stok tüketimi oluşturmaz.
- İnternet kesintisinde yerel bilgisayar, ağ ve gerekli yazıcı bağlantıları çalışıyorsa bu yol yerelde devam eder.

## 5. Ekrandaki kontroller

E18 Yazıcılar sekmesine cihaz adı, model, bağlantı, görev bölümü, kâğıt genişliği, Türkçe karakter ayarı ve deneme çıktısı eklenir. Ayrı kuyruk görünümünde bekleyen iş sayısı, en eski bekleme süresi, son hata ve yetkili tekrar çıktı işlemi bulunur. Kasa/mutfak ekranında ilgili yazıcı sorunu görünür; siparişin kayıt durumu ile baskı durumu ayrı gösterilir.

## 6. Kurulum öncesi deneme sırası

1. Her farklı bağlantı türü için arka portların, takılı kabloların ve arayüz etiketinin fotoğrafıyla envanter çıkarılır.
2. Adaptör, şerit ve kâğıt kontrol edilir; Epson kılavuzuna göre bilgisayarsız öz sınama çıktısı alınır. Okunaklı baskı, kâğıt besleme ve kesici denenir.
3. Seçilen Windows bilgisayarda resmi sürücüyle test çıktısı alınır; Türkçe karakterler, uzun ürün/not satırları ve kesme düzeni doğrulanır.
4. Kasa/mutfak/bar yönlendirmesi; ek sipariş, değişiklik ve masa taşıma bildirimleri denenir.
5. Yazıcı kapalıyken sipariş, bağlantı geri gelmesi, bilgisayar yeniden başlatma ve belirsiz baskı/tekrar çıktı senaryoları kontrol edilir.

Bu kontroller tamamlanmadan mevcut yazıcıların tamamının kullanılabilir olduğu veya ek donanım maliyetinin sıfır olduğu kabul edilmez. Şimdiki adım bağlantıları belirlemektir; yeni yazıcı veya dönüştürücü alımı kararlaştırılmamıştır.

## Resmi kaynaklar

- [Epson TM-U220B teknik özellikleri ve bağlantı seçenekleri](https://www.epson.com.au/products/receipt-printers/kitchen-printers/TM-U220B)
- [Epson TM-U220 teknik başvuru kılavuzu — öz sınama ve kurulum](https://files.support.epson.com/pdf/pos/bulk/tm-u220_trg_en_std_revh.pdf)
- [TM-U220B resmi yazılım ve sürücü listesi](https://support.epson.net/terms/pos/?LG2=EN&MKN=TM-U220B&PINF=swlist)
- [TM-U220 için desteklenen ESC/POS komutları](https://download4.epson.biz/sec_pubs/pos/reference_en/escpos/tmu220.html)
