import {guideTopics} from './guide-scenarios.js';
// Shared static screen guide. Contains no business records or secrets.
export const screens=[
  {
    "id": "overview",
    "group": "overview",
    "name": "Genel bakış",
    "permission": "dashboard.read",
    "keywords": "özet ozet durum ciro bugün",
    "guide": "Dönem satış ve tahsilat özetini kontrol et. Müşteri alacağı ve tedarikçi borcu ilgili hesap ekranına gider."
  },
  {
    "id": "team",
    "group": "management",
    "name": "Çalışanlar",
    "permission": "users.manage",
    "keywords": "çalışan calisan personel kullanıcı kullanici ekle hesap",
    "guide": "Çalışan ekle bölümünde ad, kullanıcı adı, kişisel parola ve görevleri seç. Her çalışan kendi hesabıyla giriş yapmalı."
  },
  {
    "id": "products",
    "group": "inventory",
    "name": "Ürünler ve fiyatlar",
    "permission": "catalog.manage",
    "keywords": "ürün urun menü menu fiyat servis favori",
    "guide": "Ürünü ara veya ekle. Satış servislerini ve fiyatlarını düzenle. Siparişteki yıldız ortak favoriyi değiştirir; adisyona ürün eklemez."
  },
  {
    "id": "settings",
    "group": "management",
    "name": "Ayarlar",
    "permission": "settings.read",
    "module": "/settings.js",
    "render": "renderSettings",
    "keywords": "ayar işletme pc bağlantı yazıcı wifi wi-fi wlan ağ ag mobil telefon görünüm otomatik",
    "guide": "İşletme adını bu ekranda düzenle. Yedek hedefi ve PC bağlantısını buradan kontrol et."
  },
  {
    "id": "tables",
    "group": "daily",
    "name": "Masalar",
    "permission": "tables.read",
    "module": "/dining.js",
    "render": "renderDining",
    "keywords": "masa salon bölüm garson boş dolu",
    "guide": "Masa kartına dokunarak sipariş ekranına gir. Boş masada ilk Siparişi gönder işlemine kadar yalnız taslak vardır; bakıp çıkmak açık adisyon bırakmaz. Dolu masada mevcut hesap açılır."
  },
  {
    "id": "sales",
    "group": "daily",
    "name": "Adisyon / hızlı satış",
    "permission": "orders.write",
    "module": "/sales.js",
    "render": "renderSales",
    "keywords": "sipariş siparis adisyon satış satis ödeme odeme nakit pos kart",
    "guide": "Masalı satış için Masalar ekranından başla. Masasız satışta Yeni adisyon aç düğmesine bas. Ürünleri seç, Siparişi gönder ile kaydet. Ödeme ekranında Nakit, POS veya Veresiye seç. POS kaydı fiziksel cihazdan para çekmez. Stok eksikse sipariş ve ödeme devam eder; stok tüketimi yönetici kontrolü için bekler."
  },
  {
    "id": "cash",
    "group": "accounts",
    "name": "Kasa / devir",
    "permission": "cash.manage",
    "module": "/cash.js",
    "render": "renderCash",
    "keywords": "kasa kasayı kasayi devir devret teslim sayım vardiya",
    "guide": "Kasa teslim edilene kadar açık kalır; gün değişince kapanmaz. Personeldeki nakdi önce teslim al. Kasayı teslim et ve kapat alanında teslim alan kişiyi, sayılan nakdi, POS toplamını ve açıklamayı gir. Geçmiş kayıtlar silinmez."
  },
  {
    "id": "parties",
    "group": "accounts",
    "name": "Veresiye",
    "permission": "parties.manage",
    "module": "/party-book.js",
    "render": "renderCustomers",
    "keywords": "veresiye borç borc müşteri musteri alacak cari tahsilat",
    "guide": "Müşteri ekle veya listeden müşteriyi seç. Veresiye satış başlat ile adisyon aç, ürünleri gönder. Ödeme ekranında müşteriyi kontrol edip Veresiye düğmesine bas. Para geldiğinde müşteri kartından Tahsilat al kullan. Tam sayfa yenilemesinde müşteri önerisi yeniden seçilmelidir."
  },
  {
    "id": "suppliers",
    "group": "accounts",
    "name": "Tedarikçi hesapları",
    "permission": "parties.manage",
    "module": "/party-book.js",
    "render": "renderSuppliers",
    "keywords": "tedarikçi tedarikci firma cari borç borc ödeme odeme",
    "guide": "Tedarikçi ekle veya firmayı seç. Kalan borcumuz ve hareketleri kontrol et. Ödeme yap ile tutar, yöntem ve kasayı seç. Mal alışları ayrı ekrandadır; yalnız eski bakiye için Önceden kalan bakiyeyi aktar kullanılır."
  },
  {
    "id": "stock",
    "group": "inventory",
    "name": "Stok / üretim",
    "permission": "stock.manage",
    "module": "/stock.js",
    "render": "renderStock",
    "keywords": "stok depo sayım sayim fire üretim uretim transfer",
    "guide": "Mevcut stokları kontrol et. Sayımda ürün, depo ve varsa partiyi seç; yalnız fiziksel son miktarı gir. Eski miktar sistemden gelir. Miktarları stok birimiyle, ondalıkları 0,5 gibi yaz. Yeni satın alınan mal için Alış / mal kabulü kullan. Üretimde gerçek kullanılan malzemeleri ve gerçek çıkan miktarı kaydet. Depolar arası transfer ayrı işlemdir. Satış stok eksikliği nedeniyle durmaz; Satış ve stok kontrolü bölümünde bekleyen tüketimleri izle. Gerçek stok/maliyet tamamlanınca aynı satırın tüketimini tekrar kontrol et. Hazır ürünlerin başlangıç girişinde otomatik satış takibini açabilirsin; tost gibi ürünlerde reçete malzemeleri tüketilir."
  },
  {
    "id": "purchases",
    "group": "inventory",
    "name": "Mal alışları",
    "permission": "purchases.manage",
    "module": "/purchases.js",
    "render": "renderPurchases",
    "keywords": "alış alis fatura fiş fis mal kabul teslim iade tedarikçi",
    "guide": "Yeni mal alışı ile tedarikçi, belge, kaç alış birimi aldığını, stoğa girecek toplam gerçek miktarı ve tek alış biriminin fiyatını gir. Örneğin 2 koli, toplam 48 adet; fiyat koli başına olmalı. Önizlemeyi kontrol et; Kaydet yalnız taslak oluşturur. Mal geldiğinde Malı teslim al kullan. Ödemesi kalanları filtrele. Alıştan veya tedarikçi hesabından ödeme kaydedebilirsin; aynı borç iki kez ödenmez."
  },
  {
    "id": "definitions",
    "group": "inventory",
    "name": "Birimler ve reçeteler",
    "permission": "catalog.manage",
    "module": "/definitions.js",
    "render": "renderDefinitions",
    "keywords": "birim gram kilogram servis barkod tanım tanim ürün",
    "guide": "Ürün ve birimleri bu ekranda yönet. Temel stok birimi, satış birimi ve servis içeriği ayrıdır. Reçete malzemelerini bütün partinin miktarı olarak gir; satış servisinde birim başına reçete partisi oranını kontrol et. Yeni fiyat/servis değişiklikleri önceki satış kayıtlarını değiştirmez."
  },
  {
    "id": "kitchen",
    "group": "daily",
    "name": "Mutfak / bar",
    "permission": "kitchen.write",
    "module": "/kitchen.js",
    "render": "renderKitchen",
    "keywords": "mutfak bar hazırlık hazirlik sipariş hazır teslim",
    "guide": "Gönderilen siparişleri aç. Hazırlanıyor, Hazır ve Teslim durumlarını gerçek duruma göre ilerlet. Hazırlanmış ürün iptali stok iadesi sayılmaz. Hazır porsiyon stoğu zorunlu değildir. Reçete malzemelerinin stoğu eksikse hazırlık devam eder, stok kontrolü uyarısı kalır."
  },
  {
    "id": "recipes",
    "group": "inventory",
    "navigationAlias": "definitions",
    "name": "Reçeteler",
    "permission": "stock.manage",
    "module": "/definitions.js",
    "render": "renderDefinitions",
    "keywords": "reçete recete malzeme içerik icerik",
    "guide": "Ürün tanımlarında reçete/bileşenleri aç. Gerçek kullanılan temel birimleri kontrol et. Üretimi Stok / üretim ekranında kaydet."
  },
  {
    "id": "expenses",
    "group": "accounts",
    "name": "Gider ve personel ödemeleri",
    "permission": "expenses.manage",
    "module": "/expenses.js",
    "render": "renderExpenses",
    "keywords": "gider masraf personel avans maaş ekipman",
    "guide": "Gider kategorisini ve türünü seç. Faaliyet gideri, ekipman ve personel avansını doğru türde kaydet. Ödemeyi ayrıca kaydet; borca yazılan gider ödenmiş sayılmaz."
  },
  {
    "id": "reports",
    "group": "reports",
    "name": "Raporlar",
    "permission": "reports.read",
    "module": "/reports.js",
    "render": "renderReports",
    "keywords": "rapor ciro satış kar kâr kazanç geçmiş csv",
    "guide": "Tarih aralığını seç. Satış ile tahsilatın farklı olduğunu dikkate al. Maliyet eksikse kâr sonucu hesaplanmaz. Ayrıntılar ve CSV çıktısını rapordan aç."
  },
  {
    "id": "management",
    "group": "management",
    "name": "Roller / limitler",
    "permission": "users.manage",
    "module": "/administration.js",
    "render": "renderAdministration",
    "keywords": "rol yetki limit kullanıcı kullanici personel",
    "guide": "Kullanıcıların rollerini ve işlem limitlerini kontrol et. Yetki değişikliği oturumu kapatabilir. Son etkin işletme sahibi kaldırılamaz."
  },
  {
    "id": "approvals",
    "group": "management",
    "name": "Onaylar",
    "permission": "*",
    "module": "/administration.js",
    "render": "renderApprovals",
    "keywords": "onay izin bekleyen talep",
    "guide": "Yetki sınırı nedeniyle oluşan talepleri burada izle. Yalnız yetkili kişi onaylayabilir. Onay durumu kesinleşmeden işlemi tamamlanmış sayma."
  },
  {
    "id": "imports",
    "group": "management",
    "name": "Excel / CSV aktarımı",
    "permission": "settings.manage",
    "module": "/imports.js",
    "render": "renderImports",
    "keywords": "excel csv aktarım aktarim içe yükle",
    "guide": "Dosyayı seç, sütunları eşleştir ve önizlemedeki hataları düzelt. Hatalı satırlar varken kesinleştirme yapılamaz. Geri alma yalnız bağlı kayıtlar uygunsa ters kayıtla yapılır."
  },
  {
    "id": "backups",
    "group": "management",
    "name": "Yedekleme",
    "permission": "settings.manage",
    "module": "/backups.js",
    "render": "renderBackups",
    "keywords": "yedek yedekleme geri dön kurtarma",
    "guide": "Şifreli yedekleri ve son durumunu kontrol et. Yedek hedefi proje içindeki .local/yedekler klasörüdür. Geri dönüş mevcut veritabanının üstüne yazılmaz; ayrı doğrulama hedefi kullanılır."
  },
  {
    "id": "assistant",
    "group": "help",
    "name": "Program rehberi",
    "permission": "*",
    "module": "/assistant.js",
    "render": "renderAssistant",
    "keywords": "yardım yardim asistan yapay zeka nasıl nasil rehber",
    "guide": "Yetkili olduğun ekranların kullanım adımlarını oku. Yapay zekâ bağlantısı yönetici tarafından kurulursa programı kullanmak için soru sorabilirsin; asistan işlem yapmaz."
  }
];
export const navigationGroups=[
  {id:'overview',name:'Genel bakış',screenIds:['overview']},
  {id:'daily',name:'Satış',screenIds:['tables','sales','kitchen']},
  {id:'accounts',name:'Para işleri',screenIds:['cash','parties','suppliers','expenses']},
  {id:'inventory',name:'Ürün ve stok',screenIds:['products','stock','purchases','definitions','recipes']},
  {id:'reports',name:'Raporlar',screenIds:['reports']},
  {id:'management',name:'Yönetim',screenIds:['team','management','approvals','settings','backups','imports']},
  {id:'help',name:'Program rehberi',screenIds:['assistant']}
];
for(const screen of screens){
 const topics=guideTopics.filter(row=>row.screenId===screen.id);
 screen.keywords+=' '+topics.map(row=>row.title).join(' ');
 screen.guide+='\n'+topics.map(row=>row.title+': '+row.steps.map((step,index)=>(index+1)+'. '+step).join(' ')+' Sonuç: '+row.result+(row.note?' Dikkat: '+row.note:'')).join('\n');
}
export const businessTabs=screens.filter(screen=>screen.module);
export const canAccessScreen=(user,screen)=>Boolean(user)&&(screen.permission==='*'||user.permissions?.includes(screen.permission)||user.permissionRules?.some(rule=>rule.code===screen.permission&&!rule.requiresApproval&&rule.amountLimitMinor!==null));
export const availableScreens=user=>screens.filter(screen=>canAccessScreen(user,screen));
export const normalizeNavigation=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('tr-TR').replaceAll('ı','i').replace(/\bwi[\s-]*fi\b/g,'wifi').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function searchScreens(user,query){const terms=normalizeNavigation(query).split(' ').filter(Boolean);return availableScreens(user).map(screen=>{const name=normalizeNavigation(screen.name),words=normalizeNavigation(screen.name+' '+screen.keywords).split(' ');const score=terms.reduce((sum,term)=>sum+(name===term?100:words.some(word=>word===term)?30:words.some(word=>word.startsWith(term)||(term.length>3&&term.startsWith(word)&&word.length>3))?10:0),0);return {screen,score};}).filter(row=>!terms.length||row.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(row=>row.screen);}
