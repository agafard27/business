# Proje çalışma kuralları

- Kullanıcı dosya veya açık hata konumu verdiyse oradan başlayın. Konum belirsizse `docs/proje-haritasi.md` içindeki ilgili bölümden modülü belirleyin; gerektiğinde `docs/kod-haritasi.md` ve ilgili `docs/moduller/<modül>.md` kartını kullanın. Her görevde bütün belgeleri okumayın. Kart giriş/fonksiyon/API/bağımlılık/testleri, `docs/kod-haritasi.json` makine kaydını tutar; `npm.cmd run module -- sales-order --check` yalnız seçilen modülün yollarını kontrol eder.
- Önceki işe devam ederken durum ve devam noktası için `docs/proje-haritasi.md` içindeki ilgili bölümü ve bağlı devam notunu kullanın. Kod haritası ile kaynak çelişirse yalnız ilgili modülden doğrulayın. Ortak dosyalarda kartın belirttiği fonksiyonla sınırlı kalın.
- Yeni ekran/iş kodunu kendi modülüne koyun. `backend/public/sales.js` yalnız ekran yönlendirir; garson siparişi `order-entry.js`, ödeme `payment-entry.js`, hesap listesi `account-list.js`, taşıma/birleştirme `account-tools.js` içindedir. Bu alanları yeniden tek dosyada toplamayın.
- Yönlendirme bilgisi (yol, sorumluluk, giriş, API veya komut) değişince yalnız ilgili harita bölümünü, modül kartını ve JSON kaydını güncelleyin; işin devam/doğrulama sonucunu gerekiyorsa mevcut devam notuna yazın. Mimari/işletim kararı değişirse `docs/altyapi.md` belgesini de güncelleyin; haritaya parola veya yerel bağlantı ayrıntısı yazmayın.
- Backend Node.js 24 + Express 5 + mysql2; veritabanı MySQL 8. Mimari/işletim kararı gerekiyorsa `docs/altyapi.md` içindeki ilgili bölümü okuyun. Önceki planlardaki .NET/PostgreSQL önerilerini yeni uygulamaya taşımayın.
- Backend kodu `backend/src`, işletim komutları `backend/scripts`, testler `backend/tests`, çalışan durum sayfası `backend/public`, planlar `docs/planlama`, ekran taslakları `prototypes` altında durur.
- `.local` yalnızca yerel ayar, önbellek, test çıktısı ve arşiv içindir; repoya eklenmez. Buradaki eski C# arşivini çalıştırmayın.
- Parolaları kaynak koda, düz metin ayara, günlüğe veya hata yanıtına yazmayın. Mevcut yönetici parolasını saklamayın; uygulama sınırlı hesap kullanır.
- MySQL şema değişikliği sürümlü ve tekrar başlatılabilir olmalı. Runtime otomatik şema değiştirmez. Yazmaları körlemesine yeniden denemeyin; commit sonucu belirsizliğini ayrı ele alın.
- Varsayılan PC erişimi loopback üzerinde kalır. Yerel ağ yalnız yetkili kişinin ana bilgisayardaki Ağda etkinleştir işlemiyle HTTPS ve özel ağ güvenlik duvarı üzerinden açılır. İş API oturum/izin ve kaynak kontrollerini koruyun; ağa açılmayı doğrudan 0.0.0.0 dinleme olarak uygulamayın.
- Anlamlı doğrulama: `npm.cmd test`; veritabanı davranışı değiştiyse `npm.cmd run test:integration`. Entegrasyon denemesi ayrı port/veri dizini kullanmalı; mevcut MySQL servisini durdurmayın.

## Sonraki görevlerde hedefli inceleme

- İlgili dosyaların gerekli bölümlerini ve doğrudan bağımlılıklarını inceleyin; kesilmiş çıktıyı dosyanın tamamı sanmayın. Harita yönlendirir; değişiklikten önce ilgili kodun güncelliğini doğrulayın.
- Aramada önce dosya adlarını/yollarını (`rg --files <ilgili-klasör>`), sonra ilgili klasörde hedefli metin aramasını (`rg <aranan> <ilgili-yol>`) kullanın.
- Sonuç yetersizse veya bağımlılıklar gerektiriyorsa kapsamı kademeli genişletin; doğruluk için gerekliyse proje genelinde arayın. Bütün projeyi veya .local arşivini rutin taramayın; gerekli okumaları atlamayın.
- Bağımlılık klasörlerini, derleme çıktılarını, üretilmiş dosyaları, büyük logları ve kilit dosyalarını görev gerektirmedikçe okumayın.
- Mevcut bağlamdaki dosyaları, değişmiş olma ihtimalini kontrol ederek kullanın; gereksiz yere tekrar okumayın.
- Önce ilgili testleri çalıştırın; ortak bileşenler etkileniyorsa doğrulamayı gerektiği kadar genişletin. Yukarıdaki zorunlu kod/DB kontrolleri korunur; yalnız belge değişikliğinde yol, bağlantı ve komut tutarlılığını denetleyin.
- Her görevde haritayı yeniden üretmeyin; yeni belge açmadan önce mevcut eşdeğer haritayı veya modül kartını kullanın.
- Git kökü ile çalışma/arama kapsamını ayrı doğrulayın. Git durum/fark sorgularını proje klasöründen `-- <ilgili-proje-yolları>` ile sınırlandırın; üst klasör ağacını taramayın.
- Görev dışı refaktör, ek özellik, belge veya kapsamlı analiz üretmeyin. Basit görevlerde gereksiz paralel ajan ve tekrar inceleme başlatmayın.
- Sonucu kısa bildirin: yapılan değişiklik, doğrulama ve kalan sorun.
