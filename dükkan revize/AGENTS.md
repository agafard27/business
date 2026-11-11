# Dükkan Revize çalışma kuralları

- Bu klasör kullanıcının sabit IBM cihazı için açıkça istediği ayrı projedir. Ana Node.js/MySQL uygulaması `../backend` altında kalır; orada teknoloji değişikliği yapılmaz.
- Hedef Windows 7 SP1 x86, Celeron M 1 GHz, 2 GB RAM ve 1024×768 ekrandır. Donanım yükseltmesini çözümün ön koşulu yapmayın.
- Bu projede C# 5 / .NET Framework 4.8 / WinForms ve resmi SQLite x86 kullanılabilir. Bu karar üst projenin eski .NET önerilerini taşımama kuralından, kullanıcının ayrıca istediği uyarlama için ayrılır. `.local` içindeki eski C# arşivini kullanmayın.
- Önce README.md içindeki devam noktasını ve PROJE-PLANI.md içindeki ilgili modülü okuyun. Modüllerin güncel kaynak davranışını ana uygulamadan hedefli doğrulayın.
- İş kuralları, veritabanı erişimi ve ekranlar ayrı tutulur. Mevcut özelliklerin aktarım listesi korunur; hazırlanmadığı hâlde çalışan satış veya kurulum varmış gibi gösterilmez.
- Şema değiştirme sürümlü ve açık kurulum/migration işlemi olacaktır; normal açılış canlı iş şeması oluşturmaz. Cihaz testi yalnız kendi geçici deneme veritabanını oluşturur.
- Paralar tam kuruş, miktarlar altı ondalık sabit ölçekle tutulur. Yetki, transaction, tekrar anahtarı ve commit belirsizliği korunur.
- Derleme: `powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File scripts/build.ps1`. Yeni proje testleri: `scripts/test.ps1`. Paketleme: `scripts/package.ps1`.
- `.local` ve `dagitim` üretilmiş yerel çıktıdır. İndirilen SQLite arşivi kilit kaydındaki SHA3-256 ile doğrulanmadan kullanılmaz.
- Yeni projedeki kod değişikliklerinde kendi testlerini çalıştırın. Ana uygulama değişirse üst AGENTS.md içindeki npm ve gerektiğinde izole MySQL kontrollerini de çalıştırın.
- Gerçek IBM cihazda denenmemiş başarıları cihaz kabulü diye raporlamayın. README.md içindeki tamamlanan işler ve devam noktasını güncelleyin.

