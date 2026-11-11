// Static examples only. Reading a scenario never creates business data.
export const guideTopics=[
  {
    "id": "first-day",
    "screenId": "overview",
    "title": "İlk kurulumdan ilk satışa",
    "steps": [
      "Kendi yönetici hesabınla giriş yap. Çalışanlar bölümünden her kişi için ayrı hesap ve görev oluştur.",
      "İşletme ayarlarını, menü fiyatlarını, bölüm/masaları ve gerçek depoları kontrol et.",
      "Stok takibi istiyorsan doğrulanmış birim, servis içeriği ve reçeteleri tanımla; başlangıç stoğunu yalnız gerçek sayım ve maliyetle gir.",
      "Kasa sorumlusu gerçek başlangıç nakdiyle kasayı açsın. İlk sipariş ve ödemeyi ilgili ekranlardan kaydet."
    ],
    "result": "Satış, tahsilat ve stok birbirine bağlı fakat ayrı kayıtlardır.",
    "note": "Bu örnekler eğitim içindir; rehberi okumak iş kaydı oluşturmaz."
  },
  {
    "id": "daily-close",
    "screenId": "overview",
    "title": "Günün sonunda neyi kontrol ederim?",
    "steps": [
      "Raporlarda bugün için satış tutarını, nakit/POS girişlerini, giderleri ve açık hesapları ayrı kontrol et.",
      "Stok ekranındaki bekleyen satış tüketimlerini yetkili kişiyle incele. Gerçek malzeme veya maliyet eksikse tahmin girme.",
      "Personeldeki nakdi teslim al; fiziksel nakit ile POS toplamını say.",
      "Kasayı teslim et ve kapat işlemini gerçek teslim gerçekleştiğinde yap. Yedekleme ekranında son başarılı yedeği kontrol et."
    ],
    "result": "Gün değişmesi kasayı otomatik kapatmaz; geçmiş kayıtlar korunur."
  },
  {
    "id": "staff-create",
    "screenId": "team",
    "title": "Bir çalışanı işe başlatma",
    "steps": [
      "Adı soyadı alanına çalışanın adını, kullanıcı adına Türkçe harfsiz benzersiz ad yaz; örnek: ayse.garson.",
      "Kişisel parolayı ve gerçekten yapacağı görevleri seç. Hesabı oluştur; parolayı yalnız o kişiyle paylaş.",
      "Çalışanın kendi hesabıyla giriş yaparak ihtiyaç duyduğu ekranları gördüğünü kontrol et.",
      "İşten ayrılma veya görev değişikliğini Roller / limitler bölümünden uygula."
    ],
    "result": "Her işlem kişisel oturumla kaydedilir; ortak yönetici hesabı kullanılmaz."
  },
  {
    "id": "menu-price",
    "screenId": "products",
    "title": "Menüde fiyatı değiştirme",
    "steps": [
      "Ürünü adından veya kodundan bul; doğru satış servisini seç.",
      "Satış seçeneği yoksa aynı ürün sayfasında + Satış seçeneği ekle kullan. Kavanoz/pakette gerçek içeriği ve bu paketin fiyatını yaz; örneğin 1 kg kavanoz ve 2 kg kavanoz ayrı seçeneklerdir. Tartılı satış da seçilebilir.",
      "Yeni fiyatı TL olarak yaz: örnek 125,50. Fiyatın ait olduğu miktarı kontrol et; gramla satışta 1000 g fiyatı kilogram fiyatıdır.",
      "Fiyatı kaydet; sipariş ekranında doğru servis ve yeni tutarı kontrol et."
    ],
    "result": "Yeni satışlar yeni fiyatı kullanır; eski adisyonların fiyat kopyası değişmez."
  },
  {
    "id": "table-sale",
    "screenId": "tables",
    "title": "Masada sipariş alma",
    "steps": [
      "Masa kartına dokunarak sipariş ekranına gir. Boş masada yalnız taslak açılır; ilk Siparişi gönder işleminde adisyon oluşur. Dolu masada mevcut hesap açılır.",
      "Ürünü seç; adetli servise dokununca taslağa 1 eklenir. Adet ve notu taslak satırından düzenle. Tartılı üründe miktarı gir. Yıldız düğmesi ürünü siparişe eklemez.",
      "Siparişi gönder ile taslağı kaydet. Gönderilmemiş taslak mutfakta görünmez.",
      "Ödeme zamanı ilgili hesapta Ödeme ekranını aç; kasa sorumlusu gerçek alınan parayı kaydetsin."
    ],
    "result": "Masanın doluluğu ve kalan tutarı güncellenir.",
    "note": "Sonuç doğrulanamadı mesajında aynı düğmeyle kontrol et; yeni adisyon veya yeni sipariş başlatma."
  },
  {
    "id": "batch-tables",
    "screenId": "tables",
    "title": "40 masayı toplu oluşturma",
    "steps": [
      "Masalar ekranında Masa ekle seç. Bölüm yoksa önce bölüm oluştur; varsa Bölüm listesinden seç.",
      "Tek masa veya Birden fazla masa seç. Toplu eklemede masa adedini 40 yaz; numaralar kaldığı yerden devam eder. Özel ad veya başlangıç için İsim ve numarayı değiştir alanını aç.",
      "Önizlemedeki ilk/son adı kontrol edip Masaları oluştur düğmesine bas. Boş bölümde başlangıç 1 ise Masa 1–Masa 40 oluşur.",
      "Masaları düzenle seç; masa kartına dokunarak adını veya bölümünü değiştir. Vazgeç kaydetmeden kapatır. Bölümleri düzenle bu modun üst alanındadır.",
      "Düzenleme modunda boş masanın Kaldır işlemini onayla. Dolu masada önce hesabı kapat veya başka masaya taşı.",
      "Kaldırılan masalar düğmesine bas; Geri getir ile masayı yeniden aç. İşin bitince Düzenlemeyi bitir seç. Geçmiş hesaplar ve kaldırılan masa adları korunur."
    ],
    "result": "Tamamı oluşturulur veya hata durumunda hiçbiri eklenmez; aynı işlemin tekrarı masa çoğaltmaz."
  },
  {
    "id": "table-move",
    "screenId": "sales",
    "title": "Hesabı başka masaya taşıma",
    "steps": [
      "Taşınacak hesabı aç; Diğer işlemler altında Masa taşı seç.",
      "Görsel listeden boş hedef masayı seç. Dolu masa taşımada seçilemez.",
      "Taşıma gerekçesini yaz ve Masaya taşı düğmesine bas. Hedef o sırada dolarsa listeyi yenile."
    ],
    "result": "Sipariş ve ödeme geçmişi aynı hesapta kalır; güncel masa çıktı üzerinde görünür."
  },
  {
    "id": "table-merge",
    "screenId": "sales",
    "title": "İki dolu masanın hesaplarını birleştirme",
    "steps": [
      "Kaynak hesabı aç; Diğer işlemler altında Masa birleştir seç.",
      "Birleşecek dolu hedef masayı seç. Bu işlem boş masaya taşıma değildir.",
      "Birleştirme gerekçesini yaz; Hesapları birleştir düğmesine bas. Hedef hesabı ve kalan tutarı kontrol et."
    ],
    "result": "Kaynak siparişler hedef hesapta toplanır; önceden yapılmış ödeme ve borç geçmişi korunur.",
    "note": "Başka biri hesabı değiştirdiyse güncel bilgileri yükle; eski tutarla yeni ödeme oluşturma."
  },
  {
    "id": "cash-sale",
    "screenId": "sales",
    "title": "Nakit / POS ve parçalı ödeme",
    "steps": [
      "Adisyon ürünlerini gönder; Ödeme ekranında kalan tutarı kontrol et.",
      "Açık kasa yoksa kasa sorumlusundan kasayı açmasını iste.",
      "Gerçekte alınan tutarı yaz. Örnek: 300 TL hesabın 100 TL kısmı nakit alındıysa 100 yazıp Nakit seç.",
      "Kalan 200 TL karttan alındığında 200 yazıp POS seç. Ürün bazında ödeme uygunsa ürün/miktar paylarını kullan."
    ],
    "result": "Tahsil edilen tutar kadar bakiye azalır; tam ödeme hesabı kapatır.",
    "note": "POS kaydı fiziksel cihazdan para çekmez. Başarılı kayıttan sonra ekran yenilenmezse yalnız Ekranı yenile kullan."
  },
  {
    "id": "print-account",
    "screenId": "sales",
    "title": "Hesap özeti yazdırma",
    "steps": [
      "Hesabı Ödeme ekranında aç; masa ve ürünleri kontrol et.",
      "Hesap özeti yazdır ile tarayıcı/Windows yazdırma penceresini aç.",
      "Masalı hesapta güncel masa, kapanmış hesapta son masa; masasız hesapta Masasız adisyon açıklaması görünür."
    ],
    "result": "Bu bir hesap bilgilendirme çıktısıdır; fiziksel yazdırma başarısı otomatik doğrulanmaz."
  },
  {
    "id": "credit-sale",
    "screenId": "parties",
    "title": "Veresiye satış ve sonradan tahsilat",
    "steps": [
      "Veresiye ekranında müşteriyi oluştur veya seç; gerekiyorsa gerçek kredi limitini TL olarak belirle.",
      "Veresiye satış başlat ile adisyonu aç, ürünleri gönder. Ödeme ekranında müşteriyi yeniden kontrol edip Veresiye seç.",
      "Müşteri daha sonra 150 TL ödediğinde müşteri kartındaki Tahsilat al bölümüne 150, yöntem ve açık kasa gir."
    ],
    "result": "Veresiye müşterinin borcunu artırır; sonraki tahsilat borcu azaltır, yeni satış oluşturmaz.",
    "note": "Sayfa tamamen yenilendiyse ödeme ekranında müşteri yeniden seçilir. Aynı tahsilatı Diğer nakit girişi olarak tekrar yazma."
  },
  {
    "id": "supplier-pay",
    "screenId": "suppliers",
    "title": "Tedarikçi borcu ve ödeme",
    "steps": [
      "Tedarikçiyi ekle veya seç. Yeni gelen malı Mal alışları ekranından kaydet ve fiziksel olarak teslim al.",
      "Tedarikçi kartında kalan borcumuzu kontrol et. Ödeme yap ile gerçek ödenen tutarı, yöntemi, kasayı ve açıklamayı gir.",
      "Alış ekranından ödeme yaptıysan aynı ödemeyi tekrar oluşturma; güncel kalan borcu kontrol et."
    ],
    "result": "Ödeme mevcut borcu azaltır; mal kabulü veya yeni gider oluşturmaz.",
    "note": "Önceden kalan bakiyeyi aktar yalnız uygulamadan önceki bakiyeyi ilk defa girmek içindir."
  },
  {
    "id": "purchase-bulk",
    "screenId": "purchases",
    "title": "Açık çerez: kg ile alış, gramla satış",
    "steps": [
      "Ürün tanımında temel stok birimi Gram olsun. Alışta tedarikçi ve belgeyi seç.",
      "Örnek: 2 kg çerez, kg başına 300 TL. Alış birimi Kilogram, alış miktarı 2, toplam gerçek stok içeriği 2000 g, birim fiyat 300 yaz. Toplam 600 TL olmalı.",
      "Alış taslağını kaydet. Fiziksel mal gelince depoyu seçip Malı teslim al kullan; 2000 g stok ve 600 TL firma borcu oluşur. Ödeme ayrıca kaydedilir.",
      "Satış servisinde birim Gram, fiyat miktarı 1000, örnek satış fiyatı 500 TL, tartılı satış seçili olsun. Siparişte 250 g gir; tutar 125 TL olur.",
      "Otomatik takip açık ve tüketim deposu doğruysa 250 g tüketilir, başka hareket yoksa 1750 g kalır. Rapor miktarı 250 g ve satış tutarı 125 TL gösterir."
    ],
    "result": "Alış birimi fiyatı ile satılan gram miktarı birbirine karıştırılmaz.",
    "note": "Rakamlar yalnız örnektir. Gerçek alış miktarı, satış fiyatı ve içerik işletmeden alınır."
  },
  {
    "id": "purchase-bucket",
    "screenId": "purchases",
    "title": "Kovayla alış: içeriği gerçek miktarla yazma",
    "steps": [
      "Ürünün temel birimini kontrol et: örneğin yoğurt kilogram ile stoklanıyor.",
      "Alış birimi Kova, miktar 2 gir. Gerçekte her kova 5 kg ise toplam stok içeriği 10 kg yaz.",
      "Tek kova fiyatı 400 TL ise birim fiyata 400 yaz; önizleme 800 TL ve +10 kg göstermeli.",
      "Kaydet taslak oluşturur. Mal geldiğinde teslim al; firma borcunu ve depodaki stoğu kontrol et."
    ],
    "result": "Kova adı kendi başına litre/kg miktarı belirlemez.",
    "note": "Yoğunluğu bilinmeyen malda kg ile litre çevrilmez; dilim–gram oranı tahmin edilmez."
  },
  {
    "id": "purchase-return",
    "screenId": "purchases",
    "title": "Mal kabulü, ödeme ve tedarikçi iadesi",
    "steps": [
      "Önce belge, ürünler, gerçek miktar ve fiyatları kontrol ederek taslağı kaydet.",
      "Fiziksel teslim gerçekleştiğinde doğru depoya Malı teslim al işlemini yap. Parti kodu ve son kullanma tarihini gerçek belgeden gir.",
      "Ödemede gerçek tutarı ve açık kasayı seç. Geri verilecek malı iade bölümünde temel stok birimiyle yaz."
    ],
    "result": "İade stok ve ilgili borcu etkiler; taslak kaydı henüz teslim veya ödeme değildir."
  },
  {
    "id": "unit-service",
    "screenId": "definitions",
    "title": "Stok birimi, satış birimi ve fiyat miktarı",
    "steps": [
      "Ölçü birimlerinde Standart birimleri tamamla ile eksik gram, kilogram, mililitre, litre ve kovayı ekle. Var olanlar çoğaltılmaz.",
      "Ürünü seç: temel stok birimi rafta takip edeceğin birimdir; satış birimi müşteriye sattığın miktarın birimidir.",
      "Gramla satışta kilogram fiyatı için satış birimi Gram, fiyat miktarı 1000 yaz. Adet satışta fiyat miktarı genellikle 1 olur.",
      "Paket/bardak/porsiyon için Bir satış birimindeki gerçek temel miktar alanına doğrulanmış içeriği gir. Kova içeriği değişkense alışta gerçek toplam içeriği kullan."
    ],
    "result": "Standart kg–g ve litre–ml aynı fiziksel boyuttadır; ambalaj ve porsiyon içeriği ayrıca doğrulanır."
  },
  {
    "id": "recipe-toast",
    "screenId": "recipes",
    "title": "Sipariş üzerine tost ve reçete",
    "steps": [
      "Önce ekmek, kaşar, sucuk gibi gerçek malzemelerin stok birimlerini tanımla. Kaşar dilimle sayılıyorsa gram uydurma.",
      "Yeni reçete sürümünde bütün partinin çıktı miktarını ve o partinin bütün malzemelerini yaz.",
      "Örnek: doğrulanmış reçete 10 tostluksa çıktı 10; her malzemeye 10 tostun toplam miktarını yaz.",
      "Satış servisinde bu reçeteyi seç; 1 tost bir partinin onda biriyse reçete çarpanı 0,1 yaz. Ürün kuralını Reçete malzemelerini tüket yap."
    ],
    "result": "Sipariş gerçek reçete malzemelerini tüketir; rafta hazır tost bakiyesi zorunlu değildir.",
    "note": "Çıktı miktarı otomatik bölünmez. Aynı tost için ayrıca üretim kaydı girerek malzemeyi ikinci kez tüketme."
  },
  {
    "id": "stock-count",
    "screenId": "stock",
    "title": "Sayım farkı ve fire",
    "steps": [
      "Depo, ürün ve varsa partiyi seç. Sistemdeki eski miktar otomatik gelir.",
      "Örnek: sistem 20 adet, rafta 18 adet saydın. Fiziksel sayım sonucu alanına 18 yaz; fark olan 2 yazma.",
      "Sayım fazlası varsa yalnız yeni bulunan fazlanın gerçek maliyetini gir; eski stoğun maliyetini tekrar ekleme.",
      "Kırılma/dökülme için Fire seçip çıkan miktarı ve gerekçeyi yaz. Satılmış ürünü burada tekrar stoktan düşme."
    ],
    "result": "Sayım yalnız fark kadar stok hareketi oluşturur; satış ve tahsilat oluşmaz."
  },
  {
    "id": "stock-pending",
    "screenId": "stock",
    "title": "Satış oldu ama stok neden bekliyor?",
    "steps": [
      "Satış ve stok kontrolü bölümünde bekleyen satırın nedenini oku: depo, reçete, birim, maliyet veya kullanılabilir stok eksik olabilir.",
      "Gerçek malı teslim al veya doğrulanmış eksik tanımı tamamla. Fiziksel stok ve maliyet uydurma.",
      "Aynı satırın tüketimini tekrar kontrol et. Bir kez tüketilen satır yeniden düşmez."
    ],
    "result": "Geçerli sipariş ve ödeme durmaz; satırın bütün malzemeleri birlikte tüketilir veya kontrol bekler.",
    "note": "Hazırlanmış iptal stoğa iade değildir; maliyet eksikse rapor kârı kesin göstermez."
  },
  {
    "id": "stock-production",
    "screenId": "stock",
    "title": "Ayran üretimi ve depo transferi",
    "steps": [
      "Gerçek hazırlama / üretimde çıkan ürünü, depoyu, kullanılan gerçek malzemeleri ve çıkan gerçek miktarı temel birimleriyle yaz.",
      "Yoğurttan ayran üretiminde yoğurt üretimde tüketilir; ayran satışında hazır ayran ve tanımlı bardak tüketilir.",
      "Depolar arası taşımada kaynak/hedef depoyu, ürünü, varsa partiyi ve gerçek miktarı seç."
    ],
    "result": "Üretim ve transfer satış veya ödeme değildir; aynı malzemeyi iki kez tüketme."
  },
  {
    "id": "expense-staff",
    "screenId": "expenses",
    "title": "Personele avans verme",
    "steps": [
      "Personel avansı kaydet düğmesine bas. Personeli, kategoriyi, tarihi, açıklamayı ve tutarı seç. Örnek: Ekim avansı, 500 TL.",
      "Gider/personel kaydını oluştur. Bu adım henüz kasadan para çıkarmaz.",
      "Gerçekte 500 TL verildiğinde aynı kaydın ödeme alanına 500, yöntem ve açık kasayı gir.",
      "Personel filtresiyle avans ve ücret kayıtlarını birlikte incele."
    ],
    "result": "Avans faaliyet giderinden ayrı raporlanır. Personel ödemesi farklı türdür.",
    "note": "Avans maaştan otomatik mahsup edilmez; aynı para çıkışını ayrıca diğer nakit hareketi olarak girme."
  },
  {
    "id": "expense-bill",
    "screenId": "expenses",
    "title": "Elektrik faturası veya ekipman alımı",
    "steps": [
      "Gider kategorisini ve doğru türü seç: işletme gideri, ekipman, personel ödemesi veya avans.",
      "Açıklama, gerçekleşme tarihi ve toplam TL tutarını gir. Vade son ödeme günüdür. Ekipmansa adını ve varsa seri numarasını yaz.",
      "Belgeyi ekleyip kaydı oluştur; gerçek ödeme yapıldığında aynı kaydın ödemesini ayrıca gir."
    ],
    "result": "Gider tarihi raporu, ödeme tarihi kasa çıkışını etkiler. Ekipman ayrı envanter ve rapor oluşturur.",
    "note": "Stoklanacak mal alışını gider olarak tekrar kaydetme."
  },
  {
    "id": "cash-open",
    "screenId": "cash",
    "title": "Kasayı açma ve başlangıç parası",
    "steps": [
      "Kullanılacak kasayı seç; Açılış / başlangıç alanına kasadaki gerçek başlangıç nakdini TL olarak yaz.",
      "Örnek: fiziksel bozuk para 1000 TL ise 1000 gir. Bu tutar günün satış geliri değildir.",
      "Kasayı aç; nakit/POS ödemeleri ve gider ödemeleri bu açık kasa üzerinden kaydedilir."
    ],
    "result": "Kasa teslim edilene kadar açık kalır; uygulama veya gün kapanışı kasayı otomatik kapatmaz."
  },
  {
    "id": "cash-delivery",
    "screenId": "cash",
    "title": "Nakit teslimi ve kasayı devretme",
    "steps": [
      "Kasada çalışanların üzerinde kalan nakdi kontrol et; teslimi gerçek veren ve alan kişiyi seçerek kaydet.",
      "Kasayı teslim et ve kapat bölümünde alıcıyı seç, fiziksel nakdi ve POS cihazı toplamını yaz.",
      "Beklenen tutardan fark varsa gerçek gerekçesini yaz; tutarı sıfırlamak için hayali hareket ekleme.",
      "Gerçek teslimde kaydet. Sonraki kullanım yeni kasa açılışı ve yeni gerçek başlangıç parasıyla başlar."
    ],
    "result": "Teslim kaydı yeni gelir değildir; eski hareketler ve fark korunur.",
    "note": "Bu kayıt teslim beyanıdır, alıcının kendi oturumundan ayrıca kabul ettiği anlamına gelmez."
  },
  {
    "id": "kitchen-flow",
    "screenId": "kitchen",
    "title": "Siparişi hazırlama ve teslim",
    "steps": [
      "Hazırlık alanını seçip gönderilmiş siparişleri aç. Ürün ve özel notları oku.",
      "Gerçek işe başlayınca Hazırlanıyor, bitince Hazır, müşteriye ulaşınca Teslim durumuna ilerlet.",
      "Stok uyarısı varsa yöneticiye bildir; sipariş hazırlama devam edebilir."
    ],
    "result": "Hazırlık durumları izlenir; mutfak çıktısında fiyat bulunmaz."
  },
  {
    "id": "report-read",
    "screenId": "reports",
    "title": "Satış, tahsilat, adet ve kârı okuma",
    "steps": [
      "Başlangıç ve bitiş günlerini seçip Göster kullan; iki gün de Türkiye saatine göre aralığa dahildir.",
      "İşletmem nasıl gidiyor? özetinde satış, giren para, çıkan para ve kazancı ayrı oku. Ürünlere göre gör ile tostun adet, çerezin gram miktarını karşılaştır. Bu değer hazır ürün stoğu değildir.",
      "İptaller miktar ve net satıştan çıkar. İkram ve indirim tutarı azaltır; gönderilen ürün miktarını azaltmaz.",
      "Nakit/POS tahsilatı satıştan ayrı oku; geçmiş veresiye tahsilatı bugün yeni satış değildir.",
      "Kazanç hesaplanamıyorsa Hangi ürünlerde eksik? ile ürünleri, nedeni ve yapılacak kontrolü aç. Geçmiş satışın maliyeti bugünkü ürün ayarıyla kendiliğinden tamamlanmaz. Ayrıntılarda tarih korunur; Genel özete dön ile geri gel.",
      "Bütün rapor alanları menüsünden Personel / avans, Mal alışları, Kasa veya diğer alanları seç. Gerekiyorsa Sonraki 200 hareket kullan; ürün satışlarının CSV çıktısı özetin altındadır."
    ],
    "result": "Şu anki cari bakiyeler seçilen dönemin kapanış bakiyesi değildir. Kâr yalnız doğrulanmış maliyetle hesaplanır."
  },
  {
    "id": "role-limit",
    "screenId": "management",
    "title": "Görev, limit ve parola değişikliği",
    "steps": [
      "Çalışanı seçip etkinlik, görev ve kişisel işlem yetkilerini kontrol et.",
      "Gerektiğinde tutar limiti veya onay zorunluluğunu ayarla; kullanıcının gerçek göreviyle sınırla.",
      "Parola yenileme veya oturumları kapatma işlemini ilgili çalışan için uygula."
    ],
    "result": "Rol, aktiflik veya parola değişikliği oturumları kapatabilir; son etkin işletme sahibi kaldırılamaz."
  },
  {
    "id": "approval-work",
    "screenId": "approvals",
    "title": "Onay isteyen işlemi tamamlama",
    "steps": [
      "İşlemde Yetkili onayı gerekli mesajı varsa doğru gerekçeyle onay iste.",
      "Onaylar bölümünde kendi talebinin durumunu takip et. Yetkili kişi ayrıntıları inceleyip onaylar veya reddeder.",
      "Karar ve işlem sonucu kesinleşmeden aynı işi başka yoldan tekrar kaydetme."
    ],
    "result": "Onay yetki sınırını iz bırakmadan atlamaz; uygulanan onay işlemi bir kez çalışır."
  },
  {
    "id": "import-data",
    "screenId": "imports",
    "title": "Excel dosyasını güvenli aktarma",
    "steps": [
      "Doğru aktarım türünün şablonunu indir. Gerçek veriyi istenen birim ve sütunlarla doldur.",
      "XLSX veya CSV dosyasını seç; sütunları eşleştir ve önizlemeyi aç.",
      "Hatalı satırları düzelt. Önizleme iş kaydı değildir; doğrulanınca kesinleştir.",
      "Geri alma gerekiyorsa ilgili aktarımın Geri al işlemini kullan; sonradan kullanılmış kayıtlar varsa bağımlılık engelini incele."
    ],
    "result": "Kesinleştirme atomiktir; aynı dosya tekrar stok veya bakiye üretmez.",
    "note": "Dosya en çok 5 MB ve 500 satır; formül, makro veya dış bağlantı kullanma."
  },
  {
    "id": "backup-safe",
    "screenId": "backups",
    "title": "Yedek oluşturma ve geri dönüş",
    "steps": [
      "Son yedeğin başarılı durumunu kontrol et; gerektiğinde yetkili yedek oluşturma düğmesini kullan.",
      "Şifreli yedeği ve onu açan korumalı anahtarı birlikte koru. Aynı diskteki kopya disk arızasına karşı yeterli değildir.",
      "Geri dönüş doğrulaması ayrı, yeni bir veritabanına işletim komutuyla yapılır; mevcut iş verisinin üzerine yazılmaz."
    ],
    "result": "Yedek durumu başarılı olmadıkça korunmuş sayma. Anahtarın başka Windows hesabında otomatik çalışacağını varsayma."
  },
  {
    "id": "wifi-activate",
    "screenId": "settings",
    "title": "Yeni Wi-Fi’de uygulamayı ağda etkinleştirme",
    "steps": [
      "Ana bilgisayarı kullanacağın güvenilir dükkân Wi-Fi ağına bağla; ana bilgisayarda yönetici olarak oturum aç.",
      "Ayarlar → Yerel ağ bölümünde güvenilir ağ onayını seç ve Ağda etkinleştir kullan. IP adresi otomatik bulunur; Windows ağ/izin penceresi açılırsa işlemi tamamla.",
      "Ekrandaki HTTPS adresini aynı Wi-Fi’deki telefonda aç. İlk cihaz kurulumunda işletmenin güven sertifikasını ana bilgisayardan indirip telefona kur; parolayı veya özel anahtarı paylaşma.",
      "Çalışanlar kendi kullanıcı bilgileriyle giriş yapar. Wi-Fi/IP değişirse ana bilgisayarda yeniden Ağda etkinleştir kullan."
    ],
    "result": "Ana bilgisayar açık olmalı; telefonlar aynı uygulama ve ortak veriyi kullanır. MySQL veya dış internet açılmaz.",
    "note": "Misafir Wi-Fi cihazları birbirinden ayırıyorsa ağ yöneticisi istemci yalıtımını kontrol etsin. Genel ağda güven onayı olmadan erişim açılmaz."
  },
  {
    "id": "display-mode",
    "screenId": "settings",
    "title": "Otomatik / Telefon / PC görünümü",
    "steps": [
      "Üstteki Görünüm alanından Otomatik, Telefon veya PC seç. Seçim bu tarayıcıda saklanır.",
      "Otomatik ekran genişliğine uyum sağlar. Telefon tek sütun ve dokunmaya uygun kontroller; PC geniş ekran düzenini kullanır.",
      "Dar ekranda büyük tabloları kendi içinde yatay kaydır; sayfanın tamamını taşımadan tutarlar okunur."
    ],
    "result": "Görünüm seçimi yetkileri, kullanıcıyı ve iş kayıtlarını değiştirmez."
  },
  {
    "id": "connection-help",
    "screenId": "assistant",
    "title": "Bağlantı ve sonuç belirsizliği",
    "steps": [
      "İşletme bilgisayarına ulaşılamıyorsa ana bilgisayarın açık ve aynı Wi-Fi’de olduğunu kontrol et; Ayarlar’daki güncel adresi kullan.",
      "Oturum süresi dolduysa kendi hesabınla yeniden giriş yap. Yetki yoksa sorumludan doğru görevi iste.",
      "Sonuç doğrulanamadı mesajında aynı düğmeyle işlemi kontrol et; yeni anahtarla tekrar kayıt oluşturma.",
      "İşlem kaydedildi, ekran yenilenemedi mesajında yalnız ekranı yenile."
    ],
    "result": "Rehber çevrim içi AI bağlantısı olmadan kullanılabilir; AI soru bölümü isteğe bağlıdır."
  }
];
