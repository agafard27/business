# İşletme yönetimi — ekran ve iş akışı planı

Durum: Yazılı ekran planı ve etkileşimli taslak hazır. 22 Ekim'de Node.js + Express + MySQL backend temeli kurulmaya başlandı. Taslak henüz backend'e bağlı değildir; örnek işlemlerle ekran akışını incelemek içindir. Güncel uygulama durumu [Altyapı](../altyapi.md) belgesindedir; bağımsız önizleme [buradadır](../../prototypes/EKRAN-ONIZLEME.html).

Kalıcı kayıt, yerel ağ, çoklu cihaz, veri büyümesi ve yedekleme ihtiyaçları [Veritabanı planı](veritabani-plani.md) belgesinde tanımlanmıştır. Güncel ana veritabanı işletme bilgisayarındaki MySQL'dir; ekranlar yetkili backend üzerinden erişecektir.

Güncel teknoloji seçimi [Altyapı](../altyapi.md) belgesindedir: backend Node.js + Express + MySQL. Önceki [Teknoloji planı](teknoloji-plani.md) tarihsel öneri olarak saklanır; anlık güncelleme yöntemi Node.js altyapısıyla ayrıca seçilecektir.

Mevcut Epson TM-U220B yazıcılar ve planlanan kasa/mutfak bağlantıları [Donanım planı](donanim-plani.md) belgesindedir. Bağlantı kartları ve çalışma durumları henüz doğrulanmamıştır.

## 1. Kapsam ve kabul edilen ihtiyaçlar

- Tek şube, bir ana depo; market, restoran ve kafe aynı işletmede.
- Yalnızca işletme içi satış ve masa servisi.
- Değiştirilebilir masa sayısı; sabit masa sınırı varsayılmayacak.
- Market ve mutfak ürünleri aynı masa hesabında bulunabilecek.
- Kasada ve yetkili garson tarafından masada ödeme alınabilecek.
- Taşınabilir POS kullanılacak. İlk aşamada kart işlemi cihazda yapılacak, tahsilat programa ayrıca kaydedilecek.
- Garsonlarda Android ve iPhone var; ortak telefon arayüzü planlanacak.
- Mevcut teraziyle tartım yapılıp miktar elle girilecek.
- Açık ürünlerde gram/kilogram, porsiyon, bardak, koçan/adet ve kova gibi birimler desteklenecek.
- Açık dondurma gram ve porsiyonla; paket dondurma barkodlu adetle satılacak.
- Ayran işletmede hazırlanıyor. Hazırlama verimi, bardak hacmi, bardak türü ve satış fiyatı değişebiliyor.
- Son kullanma tarihi, fire, personel tüketimi, ikram ve kişisel kullanım takip edilecek.
- Müşteri veresiye hesabı, tedarikçi borcu, kısmi ödeme ve gider kayıtları bulunacak.
- Başlangıç kayıtları Excel'den aktarılabilecek.
- İşletme bilgisayarı alınacak. Kullanıcıda birkaç Epson TM-U220B (bildirilen etiket: M188B) var; bağlantı ve uyumlulukları denenecek.
- İnternet kesildiğinde yerel ağ ve ana bilgisayar çalışıyorsa işletme içi işlemler devam edecek.

## 2. Ortak ekran düzeni

### Bilgisayar

- Sol: Yetkiye göre görünen ana menü.
- Üst: Ekran adı, aktif kullanıcı, işletme bağlantısı ve bildirimler.
- Orta: Ekranın ana çalışma alanı; liste, masa kartları veya işlem formu.
- Sağ: Satış ekranlarında adisyon/sepet; diğer ekranlarda gerektiğinde seçili kayıt ayrıntısı.
- Alt: İşleme göre ana düğme, toplam veya işlem özeti. Yönetim ekranlarında gereksiz sabit alt bar olmayacak.
- Tutar, miktar ve birim her yerde birlikte ve açık gösterilecek.
- Bağlantı durumunda internet bağlantısı ve işletmedeki ana cihaza erişim ayrı gösterilecek.

### Telefon

- Tek sütunlu yerleşim; dokunmaya uygun düğmeler ve sayı girişleri.
- Garsonda alt menü: Masalar, Siparişlerim, yetkiliyse Tahsilat.
- İşletme sahibinde alt menü: Özet, Uyarılar, Kayıtlar, Menü.
- Kasiyer/sorumlu telefonunda yalnızca yetkili olduğu işlemler yer alacak.
- Bilgisayardaki yoğun tablolar telefonda kısa kayıt kartlarına dönüşecek; ayrıntılar kayda dokunarak açılacak.
- Gönderilmeyen taslak, işletmede kaydedilen sipariş ve tamamlanmış ödeme farklı durumlarla gösterilecek.

### Merkezi yetki

- İşletme sahibi tam yönetim yetkisine sahip olacak.
- Sorumlu, kasiyer, garson, mutfak ve depo rolleri tanımlanacak; bir kişiye birden fazla görev verilebilecek.
- Onay gerektiren işlemler için neden ve onaylayan kişi tutulacak.
- Kullanıcı değişimi/kilit ekranı olacak; ortak kullanıcı hesabı esas alınmayacak.
- Geçmiş işlemler iz bırakmadan silinmeyecek. Tamamlanmış işlemler bağlı düzeltme/iade kayıtlarıyla değiştirilecek.

## 3. Ana menü

| Menü grubu | Ekranlar |
|---|---|
| Günlük işletme | Yönetici özeti, Masalar ve adisyon, Hızlı satış, Mutfak/bar |
| Ürün ve depo | Ürünler ve servis seçenekleri, Reçeteler ve hazırlama, Stok ve sayım, Alış ve mal kabulü |
| Para ve hesaplar | Müşteri/tedarikçi hesapları, Giderler ve ekipman, Kasa ve vardiya |
| Kontrol ve kurulum | Raporlar, Excel aktarımı, Kullanıcılar ve onaylar, İşletme ayarları |

Tahsilat, ağırlık girişi ve ürün seçimi bağımsız ana menü maddeleri olmayacak; ilgili işin içinden açılacak.

## 4. Ekranların yerleşimi ve özellikleri

### E01 — Giriş, kullanıcı değişimi ve kilit

- Yerleşim: Ortada kullanıcı ve giriş alanı; altında bağlantı durumu.
- İşlevler: Kişisel giriş, ekran kilidi, yetkili kullanıcıya geçiş ve oturum kapatma.
- İşletme bilgisayarına ulaşılamıyorsa bu durum giriş hatasından ayrı açıklanacak.
- İlk açılan ekran role göre belirlenecek: garsonda masalar, mutfakta siparişler, kasiyerde satış/masalar, sahibinde yönetici özeti.

### E02 — Yönetici özeti

- Üst: Gün/tarih aralığı seçimi ve son güncelleme zamanı.
- İlk bölüm: Satış, gerçekleşen tahsilat, gider/ödeme ve açık masa tutarları ayrı alanlarda.
- Orta: Nakit/kart dağılımı, müşteri alacakları, tedarikçi borçları ve yaklaşan vadeler.
- Alt: Kritik stoklar, yaklaşan son kullanma tarihleri, kasa farkları ve onay bekleyen işlemler.
- Her özet ilgili ayrıntı ekranına açılacak.
- Maliyet verisi tamamlanmamış ürünler kârlılık raporunda işaretlenecek.
- Uzaktan bağlantı kesildiğinde son alınan bilgiler zaman damgasıyla gösterilecek; güncel veri izlenimi verilmeyecek.

### E03 — Masalar

- Üst: Bölüm seçimi, masa arama ve yetkili kullanıcı için masa düzenleme.
- Orta: Masa adı, boş/dolu/hesap bekliyor durumu, açık hesap tutarı ve son işlem bilgisi taşıyan kartlar.
- Masa seçimi: E04 adisyon ekranını açacak.
- İşlevler: Masa açma, masa ekleme/yeniden adlandırma, bölüm değiştirme, hesabı başka masaya taşıma ve hesap birleştirme.
- Dolu masa kapatma ve hesap taşıma işlemleri yetki ve işlem geçmişine bağlı olacak.
- Masanın kullanım durumuyla mutfak sipariş durumu birbirinden ayrılacak; bir masada aynı anda farklı aşamada siparişler bulunabilir.

### E04 — Adisyon ve sipariş

- Bilgisayarda sol/orta: Ürün arama, barkod alanı, kategoriler ve ürün düğmeleri.
- Ürün seçiminin üstünde isimle anlık arama ve Tüm ürünler / Favoriler düğmeleri bulunur. Türkçe büyük/küçük harf ve klavye farkları desteklenir: cay → Çay, gozleme → Gözleme, SIKMA → Sıkma.
- Her ürünün ayrı yıldız düğmesi vardır; e-postadaki yıldız gibi tek dokunuşla açılır/kapanır. Yıldıza basmak ürün eklemez veya adedi değiştirmez. Ürünün ana düğmesi mevcut hızlı ekleme/servis seçimi işlevini korur.
- İşletme sahibinin kararı: Favoriler bütün çalışanlar için ortaktır. Gerçek uygulamada ortak tercih merkezde saklanır ve bağlı ekranlara güncellenir; fiyat, stok veya sipariş kaydı oluşturmaz.
- Arama, kategori ve favori filtresi birlikte uygulanır; etkin filtreler ve sonuç sayısı görünür. Sonuç yoksa tüm ürünlere dönüş sunulur. Filtreleme mevcut adisyonu, açık servis seçimini, gramajı ve notu değiştirmez; arama sırasında klavye odağı korunur.
- Sağ: Seçili masa, ürün satırları, miktarlar, servis seçenekleri, notlar, sipariş durumları ve hesap toplamı.
- Telefonda önce masa hesabı; ürün ekleme ayrı bir seçim görünümü olarak açılacak.
- Ürünler: Market, yemek, içecek ve açık ürünler aynı adisyona eklenebilecek.
- Ürün seçiminde gerekli olduğunda servis seçeneği, gramaj veya miktar penceresi açılacak.
- Her sipariş satırında ekleyen kişi ve zaman kaydı bulunacak.
- Ana düğme: Siparişi gönder. İkinci işlemler: Ürün ekle, not ekle, hesap özeti, yetkiliyse ödeme al.
- Hazırlık gerektiren satırlar mutfak/bar iş listesine gidecek; hazır market ürünü gereksiz hazırlık siparişi oluşturmayacak.
- Gönderilen sipariş kasada aynı masa hesabına yansıyacak. Sonradan eklenen ürünler yeni gönderim grubu olarak izlenecek.
- İptal ve ikram işlemleri gerekçe ve yetkiye bağlı olacak. Hazırlık durumuna göre stok sonucu ayrıca belirlenecek.

### E05 — Hızlı market satışı

- Üst: Barkod okutma/ürün arama.
- Sol/orta: Kategori ve sık satılan ürünler.
- Ürün araması ve ortak favori yıldızları adisyon ekranıyla aynı kuralları kullanır; favori seçimi cihaz/kullanıcıya göre ayrı listeler oluşturmaz.
- Sağ: Sepet, miktar, birim fiyat, satır tutarı ve toplam.
- Tartılı üründe ağırlık giriş penceresi açılacak; kilogram/gram açıkça gösterilecek.
- Dondurmada açık gram, açık porsiyon veya barkodlu paket seçimi ürün tanımına göre yapılacak.
- Ana işlemler: Ödeme al veya mevcut masaya ekle.
- Masaya eklenen satış için aynı anda ikinci bir bağımsız satış oluşturulmayacak.
- Stok tüketim zamanı ürün türüne göre tanımlanacak; aynı ürün ikinci kez stoktan düşmeyecek.

### E06 — Tahsilat ve hesap kapatma

- Üst: Masa veya satış numarası, hesap toplamı, önceki ödemeler ve kalan tutar.
- Hesap özeti içinde müşterinin bütün hesap ürünleri açık listelenir: Ürün adı, adet/gram ve birim, servis seçeneği, varsa hacim/gramaj ve not, satış anındaki birim fiyat ve satır tutarı. Gramla üründe birim fiyat TL/kg olarak gösterilir. Kutu/Cam Kola gibi ürün ayrımları korunur.
- Bu liste ayrı ekran/pencere veya açılması gereken ürün raporu değildir. Mevcut ödeme bölümündeki Hesap özeti alanında açık görünür; bilgisayarda Nakit/POS alanıyla yan yana, telefonda ödeme alanının önünde yer alır. Aynı ekran kasiyerle müşteri tarafından birlikte kontrol edilebilir.
- Kısmi veya tam tahsilat ürünleri listeden düşürmez. Gönderilmemiş ürünler ayrı uyarılı bölümde, iptaller ayrı açılır bölümde görünür; bu iki grubun mevcut ödenecek toplama dahil olmadığı belirtilir. İptal satırının tutarı çizili gösterilir.
- Ürün özeti satış miktarı/not/iptal düzenlemesi yapmaz; bu düzeltmeler adisyon ekranındaki yetkili işlemlerle yapılır. Fiyat güncel katalogdan yeniden alınmaz; kayıtlı satış satırı esas alınır.
- Ayrı ödeme için aynı hesap özeti üzerinde Tutar girerek öde / Ürün seçerek öde seçimi vardır. Ürün seçimi yeni ekran açmaz. Müşterinin ödeyeceği ürünler ve miktarları seçilir, toplam otomatik hesaplanır ve mevcut Nakit/POS düğmelerinden kaydedilir.
- Bir satırdaki üç tostun biri ödenebilir; sipariş satırı üç tost olarak kalır. Ödeme kaydı satır kimliği, ödenen miktar ve tutara bağlanır; ödenen/kalan miktarlar görünür. Yeni müşteri payına geçildiğinde seçim temizlenir, hesap kalan ürünlerle açık kalır. Gramla satılan üründe gram payı seçilebilir; birim fiyat kilogramla gösterilir.
- Ürün seçimiyle ödenecek tutar elle azaltılmaz; seçili miktarların tamamına karşılık gelir. Serbest tutarla kısmi ödeme ve karma Nakit/POS mevcut tutar modunda sürer. Önceden ürünlere bağlanmadan tutarla kısmi ödeme alınmışsa hangi ürünün ödendiği varsayılmaz; bu taslakta kalan tahsilat tutar moduyla sürdürülür. Önceki ödemeyi sonradan ürünlere dağıtma ayrı geliştirme işidir.
- Gram payları kümülatif yuvarlanan satır bedelinin farkıyla hesaplanır; ayrı ödemelerin toplamı asıl satır tutarını aşmaz. Ödeme kaydı olan satırın iptali, bağlı ödemenin iade/düzeltmesi ele alınmadan yapılmaz.
- Ürün bazlı veresiye payı müşteri seçimiyle kaydedilir ve nakit/karttan ayrı görünür. Taşıma/birleştirme, kayıtlı ödeme-satır bağlantılarını korur; geçici seçimler adisyon kimliğine aittir. Ödeme sırasında seçimler ve yöntem düğmeleri kilitlenir; güncel bakiye, miktar ve seçim kontrol edilir.
- Orta: Tek "Ödenecek tutar" alanı. İlk açılışta kalan hesabın tamamı otomatik gelir; kısmi ödeme için kullanıcı değiştirebilir.
- Gerekirse: Ürün bazında veya tutarla hesap bölme.
- Tutarın altında iki büyük düğme: Nakit ve POS. Seçilen düğme aynı alandaki tutarı ilgili ödeme yöntemiyle kaydeder. Nakit için girilen alan, alınan banknot miktarını değil hesaptan kapatılacak tutarı ifade eder; para üstü yardımı gerekiyorsa ayrı yardımcı işlem olarak tasarlanır.
- Veresiye, açılan "Müşteri hesabı" bölümünde aynı tutar alanını kullanır; müşteri seçimi zorunludur. Mevcut borç ve limit bilgisi burada planlanır.
- Kart seçimi fiziksel POS'ta alınan ödemenin program kaydı olacak; cihazdan otomatik tahsilat başlatıldığı izlenimi verilmeyecek.
- Ayrı bir ana "Tahsilatı kaydet" düğmesi bulunmaz. Nakit/POS doğrudan kayıt işlemini başlatır. Kısmi ödemeden sonra alan güncel kalan tutarla dolar; hesap sıfırsa ödeme düğmeleri kapanır.
- Karma ödeme sırayla kaydedilir: örneğin bir kısmı Nakit, kalan kısmı POS. Her parça kendi yöntemiyle geçmişte görünür; veresiye gerçek tahsilat toplamına eklenmez.
- Kayıt sırasında iki düğme de kilitlenir; çift tıklama ve güncelliğini kaybetmiş hesap düğmesi ikinci tahsilat oluşturmaz. Gerçek sunucu uygulamasında istek kimliği ve güncel bakiye denetimi de uygulanır.
- Kasada ve telefonda aynı hesap için çakışan tahsilat önlenecek; güncel kalan tutar esas alınacak.
- Kayıtta tahsilatı yapan kişi, yöntem, zaman ve bağlı hesap bulunacak.
- Hesap özeti/sipariş çıktısı ile ödeme kaydı ayrı işlevler olarak tutulacak.

### E07 — Mutfak ve bar

- Üst: Hazırlık alanı ve durum seçimi.
- Orta: Yeni, hazırlanıyor ve hazır sipariş grupları.
- Sipariş kartı: Masa, gönderim zamanı, ürün/servis seçeneği, adet, not ve ilgili garson.
- İşlemler: Hazırlamaya başla, hazır işaretle; düzeltme/iptal bildirimini gör.
- Garson tarafında hazır bilgisi görünecek; teslim edildi kaydı yetkiye göre girilebilecek.
- Fiyat, işletme kârı ve borç bilgileri bu ekranda bulunmayacak.
- Yazıcı kullanılacaksa hazırlık alanına göre yönlendirme yapılacak; tekrar çıktılar ayırt edilecek.
- Mutfakta ekran mı, yazıcı mı kullanılacağı donanım kontrolünden sonra kesinleşecek.

### E08 — Ürünler ve servis seçenekleri

- Liste: Ad, barkod/kod, kategori, stok/satış birimi, fiyat ve aktiflik.
- Ürün ayrıntısında sekmeler: Genel bilgiler, Satış seçenekleri, Alış/birimler, Stok kuralları, Reçete bağlantısı, Geçmiş.
- Genel alanlar: Hazır ürün/hazırlanan ürün/malzeme/sarf türü ve varsa mutfak-bar yönlendirmesi.
- Birimler: Adet, kilogram/gram, litre/mililitre, kova, koçan ve porsiyon; kontrollü dönüşümler.
- Servis seçeneği: Örneğin standart bardak ayran ve PET bardak ayran. Her biri ayrı hacim, fiyat ve ambalaj tüketimi taşıyabilecek.
- Kova gibi değişebilen ambalajlarda gerçek içerik miktarı mal kabulünde veya kullanımda belirtilebilecek; bütün kovalar aynı ağırlıkta varsayılmayacak.
- Fiyat, porsiyon veya dönüşüm değişiklikleri geçmiş satış ve tüketim kayıtlarını değiştirmeyecek.
- Gramaj gerektiren seçenek eksik tanımlıysa satış/üretim sırasında tamamlanması gereken bilgi açıkça gösterilecek.

### E09 — Reçeteler ve hazırlama/üretim

- Üst: Reçeteler ve Hazırlama kayıtları sekmeleri.
- Reçete düzeni: Malzemeler, standart miktarlar, beklenen çıktı ve servis bağlantıları.
- Yeni hazırlama formu: Ürün, kullanılan gerçek malzemeler, miktarlar, çıkan gerçek toplam miktar, hazırlayan kişi ve zaman.
- Ayran örneği: Kullanılan yoğurt miktarı/kovası ve diğer malzemeler girilir; elde edilen ayran litre olarak kaydedilir.
- Maliyet özeti: Hazırlamanın toplam malzeme maliyeti, litre/kilogram maliyeti ve tanımlı servislerin karşılığı.
- Hazırlama tamamlanınca girdiler stoktan düşer, hazırlanan ürün stoğa eklenir.
- Hazırlanan ayranın satışında ilgili hacim azalır; yoğurt tekrar düşmez. PET bardak tüketimi satışta ayrıca işlenebilir.
- Siparişe göre hazırlanan yemeklerde tüketim, belirlenen hazırlık aşamasında reçeteye göre kaydedilir; ayrıca ikinci bir üretim kaydı zorunlu tutulmaz.
- Standart miktar yerine tartılan gerçek miktar kullanılıyorsa bu bilgi işlemde saklanır.
- Hazırlama partisi, kullanım süresi ve fire ilişkileri bu ekrandan izlenir.

### E10 — Stok, partiler, sayım ve tüketim

- Üst sekmeler: Mevcut stok, Hareketler, Tarih/parti, Sayım, Fire ve tüketim.
- Liste: Ürün, miktar/birim, kritik seviye ve varsa yaklaşan tarih.
- Ürün ayrıntısı: Alış, satış, üretim, iade, fire ve düzeltme hareketleri.
- Sayım: Sistemdeki miktar, sayılan miktar ve fark; farkın gerekçesi/onayı.
- Fire formu: Ürün/parti, miktar, neden ve gerekiyorsa hazırlama kaydı.
- Ayrı tüketim türleri: Personel, ikram ve işletme sahibinin kişisel kullanımı.
- Tüketim satış oluşturmaz; stok hareketi ve maliyeti ayrı raporlanır.
- Parti takibi gereken ürünlerde farklı giriş tarihleri ve son kullanma tarihleri korunur.
- Satış/hazırlama tüketiminde kullanılan partinin nasıl seçileceği işleyişe göre belirlenir; fiziksel ürünle kayıt eşleştirilebilir olmalıdır.
- Ekipman alımları satılabilir stok gibi bu listeye karıştırılmaz.

### E11 — Alış ve mal kabulü

- Üst: Tedarikçi, tarih ve varsa belge bilgisi.
- Orta: Ürün, alış birimi, miktar, gerçek içerik miktarı, birim fiyat, parti ve tarih satırları.
- Alt: Toplam alış tutarı, ödenen, kalan borç ve vade.
- İşlemler: Taslak kaydet, mal kabulünü tamamla, tedarikçiye iade.
- Mal kabulünde stok, borç ve ödeme ilişkili kaydedilir; aynı alış gider ekranından ikinci kez sayılmaz.
- Kısmi ödeme ve sonradan ödeme müşteri/tedarikçi hesaplarından izlenir.
- Eksik stok ekranından satın alma listesi oluşturulabilir; sipariş vermek stoğa mal girişi sayılmaz.
- Satılacak ürünler, üretim malzemeleri ve peçete/temizlik malzemesi gibi sarflar uygun kayıt türüyle alınabilir.

### E12 — Müşteri ve tedarikçi hesapları

- Üst: Müşteriler/Tedarikçiler sekmeleri ve arama.
- Liste: İsim, borç/alacak bakiyesi ve vade bilgisi.
- Ayrıntı: Tarih sıralı satış/alış, ödeme, iade ve düzeltme hareketleri; bağlı kayda geçiş.
- Müşteri işlemleri: Veresiye hesabı, tam/kısmi tahsilat, limit ve hesap dökümü.
- Tedarikçi işlemleri: Alış borcu, peşinat, tam/kısmi ödeme ve iade mahsubu.
- Başlangıç bakiyeleri geçmişte yapılmış yeni satış/alış gibi kaydedilmez; ayrı açılış hareketi olur.
- Önceki veresiye borcunun tahsilatı yeni satış oluşturmaz.

### E13 — Giderler, personel ödemeleri ve ekipman

- Üst: Gider kategorileri ve tarih aralığı.
- Liste: Açıklama, kategori, tutar, ödeme durumu, yöntem ve ilgili kişi/tedarikçi.
- Gider formu: Tarih, açıklama, kategori, toplam tutar, ödenen, kalan, vade ve varsa belge eki.
- Kategoriler: Kira, elektrik, su, bakım, ulaşım, personel ödemeleri ve işletmenin ekleyeceği diğer kalemler.
- Personel için ödeme ve avans hareketleri ayrı türlerde tutulabilir; ayrıntılı bordro hesabı bu planla kesinleştirilmiş değildir.
- Ekipman sekmesi: Bilgisayar, dolap veya cihaz gibi alımların bedeli, tarihi, kimden alındığı ve ödeme durumu.
- Sarf stoğuna alınan ürünler ve stoklu alışlar ilgili alış kaydıyla bağlantılı olur; mükerrer gider yaratılmaz.
- Ekipman için ödenen tutar nakit çıkışında görünür; ürün malzeme maliyetiyle karıştırılmaz.

### E14 — Kasa ve vardiya kapanışı

- Üst: Aktif kasa/vardiya, sorumlu kullanıcı ve açılış tutarı.
- Orta: Nakit satış/tahsilat, kart tahsilatı, kasaya giriş ve kasadan çıkışlar.
- Kapanış: Beklenen nakit, sayılan nakit, fark ve açıklama.
- Kart kontrolü: Programdaki tutar ile fiziksel POS toplamını karşılaştırma alanı.
- İşlemler: Kasa aç, yetkili para giriş/çıkışı, kapanışa gönder ve sorumlu onayı.
- Masada tahsil edilen ödemeler aynı işletme kayıtlarına bağlı olur; tahsilatı yapan kişi izlenir.
- Varsa personelin üzerinde kalan nakdin kasaya teslimi ayrı gösterilir; aynı para ikinci kez satış/tahsilat sayılmaz.
- Kapanmış vardiya düzeltmeleri iz bırakır ve yetkiye bağlı olur.

### E15 — Raporlar ve işlem geçmişi

- Üst: Tarih aralığı ve rapor türü.
- Raporlar: Market/restoran satışları, ürün/servis seçeneği, ödeme yöntemi, alışlar, giderler ve tahsilatlar.
- Stok raporları: Eksikler, parti/tarih, sayım farkı, fire, personel tüketimi, ikram ve kişisel kullanım.
- Hazırlama raporları: Malzeme girdisi, gerçek çıktı, hazırlayan kişi ve birim maliyet.
- Hesap raporları: Müşteri alacakları, tedarikçi borçları ve vadeler.
- Kontrol raporları: İndirimler, iptaller, iadeler, stok düzeltmeleri ve kasa farkları.
- İşlem geçmişi: İşlemi yapan, zamanı, ilgili kayıt, değişiklik ve onay bilgisi.
- Kârlılıkta satış, malzeme maliyeti ve işletme giderleri ayrı sunulur; eksik maliyetler ve kullanılan hesap yöntemi görünür olur.
- Kullanıcı yetkisine göre maliyet/kâr bilgileri gizlenir.

### E16 — Excel aktarımı ve başlangıç kurulumu

- Üst: Aktarılacak kayıt türü seçimi.
- Türler: Ürünler/barkodlar, birimler ve fiyatlar, başlangıç stokları, müşteri/tedarikçiler ve açılış bakiyeleri.
- Akış: Şablon al → dosya seç → sütunları eşleştir → önizle → hataları düzelt → aktarım özeti → kesinleştir.
- Kontroller: Yinelenen kod/barkod, eksik alan, yanlış sayı/birim/tarih ve tanımsız referanslar.
- Önizlemede eklenecek/güncellenecek/reddedilecek satırlar açıkça ayrılır.
- Kritik hatalar çözülmeden ilgili aktarım kesinleşmez.
- Aynı dosyanın tekrar yüklenmesinde kayıt ve açılış stokları çoğaltılmaz.
- Aktarım geçmişi ve sonuç özeti saklanır. Kesinleşmiş stok/borç aktarımını geri alma yetkili ve izlenebilir işlem olur.
- Günlük satış ve sipariş ekranlarının kullanımı Excel dosyası düzenlemeye bağlı olmaz.

### E17 — Kullanıcılar, roller ve onaylar

- Sekmeler: Çalışanlar, Roller/yetkiler, Limitler, Onay bekleyenler.
- Kullanıcı kaydı: İsim, aktiflik, görevler ve kişisel giriş bilgileri.
- Yetki alanları: Görüntüleme, işlem yapma, onaylama; fiyat/maliyet ve rapor erişimleri ayrıca tanımlanır.
- Sınırlanabilecek işlemler: İndirim, iptal, iade, veresiye limit aşımı, stok düzeltme ve kasa farkı onayı.
- Masada tahsilat, garson rolüne ayrıca verilebilen yetki olur.
- Onay kuyruğunda işlem, gerekçe, tutar/miktar ve talep eden kişi görünür.
- İnternet kesintisinde işletmedeki yetkili sorumlu tanımlı sınırlar içinde işlem yapabilir; dışarıdaki sahibin bağlantısı zorunlu tutulmaz.
- Rol değişiklikleri geçmişte işlemi yapan kişinin kaydını değiştirmez.

### E18 — İşletme, bağlantı, yazıcı ve yedekleme ayarları

- Sekmeler: İşletme, Birimler/servisler, Masalar/bölümler, Yazıcılar, Bağlantı, Yedekleme.
- Ortak tanımlar: Kategoriler, ölçü birimleri, servis seçenekleri ve uyarı eşikleri.
- Yazıcılar: Model/bağlantı bilgisi, kasa/mutfak/bar yönlendirmesi, kâğıt/Türkçe karakter ayarı ve deneme çıktısı.
- Yazdırma kuyruğu: Bekleyen işler, son hata, sonucu belirsiz baskı ve yetkili "TEKRAR ÇIKTI" işlemi. Siparişin kayıt durumu ile baskı durumu ayrı gösterilir.
- Bağlantı: Yerel ana cihaz erişimi, internet durumu ve uzaktan erişimin son güncellenme zamanı.
- Yedekleme: Son başarılı yedek, yedek hedefi, otomatik çalışma durumu ve yetkili geri yükleme işlemi.
- Uzak erişim kesikken işletme içinde kaydedilen işlemler kaybolmuş veya yeniden girilmesi gereken kayıtlar gibi gösterilmez.
- Ana cihaz ve yerel ağ çalışmıyorsa yeni işlemin kaydedildiği iddia edilmez; gönderilemeyen taslak açıkça işaretlenir.
- Yazıcı ve uzaktan erişim yöntemleri donanım incelemesi sonrasında kesinleşir.

## 5. Tekrar kullanılacak işlem pencereleri

| Pencere | Açıldığı yer | Gerekli alanlar |
|---|---|---|
| Servis seçimi | Adisyon/hızlı satış | Seçenek, hacim/gramaj, fiyat |
| Tartılı ürün | Adisyon/hızlı satış | Ürün, gram veya kilogram, birim fiyat, hesaplanan tutar |
| İptal/iade/indirim | İlgili işlem | Satırlar, miktar/tutar, neden, gerekiyorsa onay |
| Müşteri/tedarikçi seçimi | Tahsilat, alış, gider | Arama, bakiye, yeni kayıt yetkisi |
| Fire/tüketim | Stok/üretim/adisyon | Ürün/parti, miktar, tür, neden |
| Masa taşıma/birleştirme | Masalar/adisyon | Kaynak, hedef, taşınacak hesap/ürünler |
| Hesap özeti/çıktı | Adisyon/tahsilat | Ürünler, toplam, ödemeler ve kalan |

## 6. Ana iş akışları

1. Garson → masa → ürün ve servis seçimi → siparişi gönder → kasa ve ilgili hazırlık alanı → hazır → teslim → tahsilat.
2. Kasiyer → barkod/ürün → gerekiyorsa tartım → doğrudan tahsilat veya mevcut masaya ekleme.
3. Mal kabulü → ürün/parti ve maliyet → stok girişi → ödeme ve varsa tedarikçi borcu.
4. Ayran hazırlama → kullanılan yoğurt ve diğer girdiler → gerçek litre çıktısı → hazırlanan ayran stoğu → bardak hacmine göre satış.
5. Fire/personel/ikram/kişisel kullanım → miktar ve neden → yetki kontrolü → stok hareketi → ayrı rapor.
6. Veresiye satış → müşteri hesabı → sonradan tahsilat → kasa/banka kaydı; ikinci satış oluşmaz.
7. Gün sonu → kasa sayımı ve POS karşılaştırması → fark açıklaması → yetkili kapanış → yönetici özeti.

## 7. Planın sonraki adımları

28 Ekim ilerlemesi: PC kapsamındaki E01–E18 iş akışları gerçek servis ve ekranlara bağlandı; canlı şema v6 oldu. Satış/tahsilat/stok/alış/cari/gider/kasa, rol/onay, XLSX/CSV ve şifreli yedek/geri dönüş test edildi. Kullanıcının kararıyla ilk kullanım yalnız PC; telefon/uzak erişim sonraki aşamadır. Fiziksel yazıcı bağlantısı henüz belirlenmediği için Windows yazdırma penceresi kullanılır. İşletmeye özgü masa, stok, reçete ve parti değerleri gerçek bilgiyle girilir. Güncel kapsam, doğrulama ve devam noktası [Proje haritası](../proje-haritasi.md) ve [PC kabul kaydı](../pc-kabul-kontrolu.md) içindedir. Aşağıdaki görsel taslak adımları ekran incelemesi için korunur.

1. Bu yazılı plandaki alan ve işlem bağlantılarının gözden geçirilmesi.
2. Önce Masalar, Adisyon, Hızlı satış ve Tahsilat ekranlarının görsel taslağı.
3. Garson telefonu ve mutfak iş akışının görsel taslağı.
4. Depo, üretim, cari, gider ve yönetici ekranlarının görsel taslağı.
5. Ekranların gerçek işletme senaryolarıyla kontrolü; ardından geliştirme iş listesi ve donanım gereksinimleri.

### İlk ekran taslağının kapsamı — 21 Ekim 2026

- İşletme sahibinin verdiği https://menu.narcicegi.com.tr adresindeki menü okunarak ürün/fiyat referansları `menu-urunleri.json` dosyasında kaydedildi. Bu kayıt güncel işletme stoğu veya kesinleşmiş ürün aktarımı değildir.
- Menü kapsamı düzeltmesi: İlk taslakta temsil edilen 11 ürün, canlı kaynaktaki beş bölümün tamamını kapsayacak şekilde 85 ürüne çıkarıldı. 94 menü fiyat seçeneği, dürüm/porsiyon ve Tam/Yarım ayrımlarıyla korundu. Ayrıntılar [Menü aktarımı kontrolü](menu-aktarim-kontrolu.md) belgesindedir.
- Çerezlerin dokuz fiyatının tamamı işletme sahibince kilogram fiyatı olarak doğrulandı; gramla satış açıldı. Kola 70 TL kutu / 40 TL cam şişe ayrımı kaynak görsellerine dayanır; hacim bilgisi eklenmedi.
- İlk akış: Masa seçimi, ortak masa hesabına ürün ekleme, servis seçeneği ve gramaj girişi, yeni sipariş gönderme, mutfak/bar hazırlığı ve teslim, nakit/kart/veresiye kaydı.
- Menüden alınan fiyatlarla örnek masa ve işlem kayıtları kullanıldı. PET ayran fiyatı, bardak hacimleri ve dondurma gram fiyatı/gramajları kesinleşmemiş örnekler olarak işaretlendi.
- Telefon görünümünde önce adisyon açılıyor; ürün ekleme ayrı görünüme geçiyor. Bilgisayarda ürünler ve hesap yan yana.
- Kullanıcı incelemesi sonrası hızlı ekleme: tek birimli ürün kartına her tıklama aynı gönderilmemiş satırı bir artırır. Servisli üründe bardak/porsiyon açıkça seçilir; o seçeneğe tekrar dokunmak bir artırır. Telefon ürün listesi eklemeden sonra açık kalır ve taslak toplamı gösterir.
- Ürün seçimine anlık isim araması, ortak favori yıldızları ve Favoriler filtresi eklendi. Kategori/arama/favori birlikte çalışır; yıldız ürün eklemez, ürünün kendisine tıklama hızlı eklemeyi sürdürür. Çay/cay, Gözleme/gozleme, Sıkma/SIKMA gibi yazımlar eşleşir.
- Favoriler taslakta aynı tarayıcının saklama imkânıyla hatırlanır; gerçek cihazlar arasında ortak senkronizasyon henüz yoktur. Saklama kapalıysa o açık oturumda çalışır. Gerçek uygulama için karar, bütün çalışanlara ortak ve veritabanında kalıcı listedir.
- Adisyon taslağında adet için +/−, ağırlık için gram düzenleme, not ekleme ve satır kaldırma bulunur. Gönderilmiş miktar hızlı eklemeyle değişmez; yeni taslak satırı oluşur. Farklı servis, fiyat veya not taşıyan satırlar birleştirilmez.
- Gramla satışta her tartım ayrıca girilir; ürün kartına tıklama kendiliğinden bir gram veya önceki tartım miktarını eklemez.
- Masa hesabı taşıma incelemesi: "Masalara dön" hesaplar arasında gezinir; ayrı "Hesabı taşı" işlemi hedef masa seçimi ve taşıma özeti açar. Boş masaya adisyon kimliği, satırlar, hazırlık durumları ve önceki ödemeler korunarak taşınır; kaynak masa boşalır.
- Dolu açık masaya taşımada iki hesabı birleştirme ayrıca seçilir. Ürünler ve önceki ödemeler korunur; birleştirmede henüz kaydedilmemiş ödeme/ürün girişlerinin sıfırlanacağı önceden gösterilir. Aynı sipariş yeniden gönderilmez ve hazırlık listesi yeni masayı gösterir.
- Eklenmemiş ürün miktarı/notu ve ödeme girişleri adisyon kimliğine göre ayrılır; başka masaya geçmek bu alanları diğer hesaba taşımaz. Masa kartında gönderilmemiş ürün tutarı ayrıca gösterilir.
- Kısmi tahsilattan sonra ek sipariş, gerekçeli örnek sorumlu iptali ve kapanan masaya yeni adisyon açılması incelenebiliyor. Önceki hazırlık siparişleri yeni adisyon açılınca kaybolmuyor.
- Ödeme ekranında aynı ürün listesinden adet/gram seçerek ayrı tahsilat eklendi. Öğrenci/grup ödemesinde seçilen ürün miktarı ödeme kaydına bağlanır; sıradaki kişinin seçimi boş başlar. Ürün bazında kalan miktar yalnızca önceki ödemelerin ürün dağılımı biliniyorsa gösterilir; tutarla alınmış dağıtımsız ödeme varsa kalan tutar esas alınır.
- Ayrı Nakit/POS ödemeleri, miktar aşımı, güncel olmayan seçim, çift kayıt engeli, gram bölmede kuruş toplamı, veresiye ayrımı, taşıma/birleştirmede ödeme bağlantıları ve ödenmiş ürünün iptal engeli `node backend/tests/prototype/odeme-paylari-kontrol.cjs` ile denetlendi. Gerçek tarayıcı/telefon görünüm denetimi bu kontrolün kapsamı değildir.
- Sipariş gönderimi ve ödemeler gerçek işletme cihazlarına, stoğa, POS'a veya muhasebe kayıtlarına yazılmıyor.
- JavaScript sözdizimi ve temel hesap/akış davranışları denetlendi. Ortamda kullanılabilir tarayıcı bulunmadığından görsel tarayıcı doğrulaması tamamlanamadı; yerleşim kullanıcı incelemesinde ayrıca doğrulanacak.
- Sıradaki kullanıcı incelemesi: Telefon görünümünde masa hesabına erişim, ürün/servis seçimi ve sipariş gönderme adımlarının günlük kullanıma uygunluğu.

## 8. Yönetim ekranlarının tasarım önizlemesi — 23 Ekim 2026

[Yönetim önizlemesi](../../prototypes/YONETIM-ONIZLEME.html) masaüstünde sol menü, telefonda açılır menü kullanır. E02, E05 ve E08–E18 ekranları örnek verilerle hazırlanmıştır. E03/E04/E06/E07 mevcut satış taslağına bağlıdır; E01 gerçek uygulamada bulunur.

- Hızlı satışta adet/gram girişi, sepet ve örnek Nakit/POS akışı; ürün düzenleme ve hazırlama çıktısı hesabı.
- Stokta parti/tarih, hareket, sayım, fire/tüketim; örnek sayım onay kuyruğuna düşer, stok miktarı değiştirilmez.
- Mal kabulünde gerçek içerik/birim, parti, tarih, alış toplamı ve kalan borç; cari hesaplarda kısmi ödeme ve döküm indirme.
- Gider/personel/ekipman, kasa nakit/POS farkı, gerekçeli kapanış ve örnek onay kuyruğu.
- Rapor dönemleri, eksik maliyet işaretleri, CSV dışa aktarma; Excel’den kaydedilen UTF-8 CSV için sütun eşleştirme ve satır doğrulama.
- Örnek çalışanlar, rol/limit tasarımı ve gerekçeli onay/red; işletme, birim, masa, yazıcı, bağlantı ve yedek planı görünümleri.

Önizlemeler gerçek backend iş kaydı oluşturmaz. Yeni taslakta değişiklikler yalnızca açık sayfa belleğinde yaşar; yenilemede sıfırlanır. Dosyalar doğrudan tarayıcıda açılır; ayrı kurulum gerekmez. 32 ekran/sekme açılışı, CSV ayrıştırma, aranan cari hesaba ödeme, bakiye aşımı, sepet/ödeme ve gramaj davranışı kod üzerinden kontrol edildi. Tarayıcı otomasyon bağlantısı bulunmadığı için görsel ve gerçek cihaz doğrulaması tamamlanamadı.

## 9. Henüz kesinleştirilmemiş ayrıntılar

- Epson TM-U220B yazıcıların kesin adedi, her cihazın bağlantı türü ve çalışma durumu; mutfakta ekran/yazıcı yerleşimi.
- Aynı anda işlem yapacak yaklaşık cihaz/kullanıcı sayısı; masa sayısı sistemde değiştirilebilir olacak.
- Gerçek ürün listesi, reçeteler, servis hacimleri, gramajlar ve kova içerikleri.
- Nakit tahsil eden personelin vardiya sonu teslim düzeni.
- Muhasebeciye sunulacak raporların biçimi ve ileride istenebilecek bağlantılar.
- Yeni bilgisayar özellikleri, yedekleme hedefi, uzak erişim yöntemi ve bunların maliyetleri.
- Ayrıntılı personel avans/alacak takibinin kapsamı; ödeme kaydı ile bordro hesabı ayrı ihtiyaçlardır.

Bu belgedeki ekran numaraları planlama içindir. Uygulamada çalışanlar iş adlarını görecektir.
