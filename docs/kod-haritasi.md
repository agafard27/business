# Kod haritası — önce modülü seç

Komutla doğrudan açılacak yolları gör: `npm.cmd run module -- sales-order`; yalnız ilgili yolları denetle: `npm.cmd run module -- sales-order --check`.

Kısa başlangıç ve güncel durum: [Proje haritası](proje-haritasi.md). Bu belge özellikten modüle geçiş indeksidir; ilerleme raporu değildir. **Hangi değişiklik için hangi dosya/fonksiyon/test açılacağını** gösterir. Makine tarafından okunabilir kayıt: [kod-haritasi.json](kod-haritasi.json).

| Sorun / alan | Açılacak modül kartı |
|---|---|
| Garson sipariş alma | [sales-order](moduller/sales-order.md) |
| Hesap / Nakit / POS / veresiye | [sales-payment](moduller/sales-payment.md) |
| Hesap listesi / taşıma / birleştirme | [sales-accounts](moduller/sales-accounts.md) |
| Bölüm ve masalar | [dining](moduller/dining.md) |
| Ürün, servis, fiyat, barkod ve birimler | [catalog](moduller/catalog.md) |
| Mutfak / bar | [kitchen](moduller/kitchen.md) |
| Reçete, üretim, stok, parti ve sayım | [stock](moduller/stock.md) |
| Alış / mal kabulü / tedarikçi iadesi | [purchasing](moduller/purchasing.md) |
| Kasa / devir / nakit teslim | [cash](moduller/cash.md) |
| Veresiye / Tedarikçiler (ayrı ekranlar) | [parties](moduller/parties.md) |
| Gider / personel / ekipman | [expenses](moduller/expenses.md) |
| Yönetici özeti ve raporlar | [reports](moduller/reports.md) |
| Excel / CSV aktarımı | [imports](moduller/imports.md) |
| Giriş / oturum / kullanıcı / rol | [auth](moduller/auth.md) |
| Yetkili onay kuyruğu | [approvals](moduller/approvals.md) |
| Yedek / ayrı geri dönüş | [backup](moduller/backup.md) |
| Belge ekleri | [files](moduller/files.md) |
| Ortak işlem altyapısı | [business-core](moduller/business-core.md) |
| İşletme / Wi-Fi ağını etkinleştirme | [settings](moduller/settings.md) |
| Şema / sürümlü migration | [schema](moduller/schema.md) |
| Miktar gösterimi | [quantity-display](moduller/quantity-display.md) |
| Solda açılır ana menü / ekran bul | [navigation](moduller/navigation.md) |
| Program rehberi / yapay zekâ | [assistant](moduller/assistant.md) |
| Başlatma / bağlantı / HTTPS ağ | [runtime](moduller/runtime.md) |

## Her değişiklikte çalışma kuralı

1. Bu indeksten ilgili modülü seç; yalnız o kartı ve kartın giriş dosyasını oku.
2. Arama gerekiyorsa karttaki dosya/klasörlerde rg kullan. node_modules, .local ve bütün proje rutin taranmaz.
3. Sipariş görünümü için payment, stok veya migration dosyaları açılmaz. Ödeme hatası için önce payment modülü açılır; kasa durumu gerekiyorsa cash kartına geçilir.
4. Paylaşılan dosyalarda yalnız kartın adını verdiği fonksiyon üzerinde çalış. Mevcut ortak dosyalar açıkça kartta belirtilmiştir; başka fonksiyonlar o modüle dahil değildir.
5. Yeni dosya kendi alanının altında durur. sales.js gibi giriş dosyası yalnız ekran yönlendirir; ekranların bütün kodu tekrar oraya yığılmaz.
6. İş sonunda yalnız değişen kartı/JSON kaydını ve proje-haritasi.md devam noktasını güncelle.

## Devam ve bakım

- Güncel işin sınırı ve doğrulama durumu [proje haritasında](proje-haritasi.md); ayrıntılı bekleyen işler oradan bağlı devam notlarındadır.
- Yeni işe ilgili kart ve güncel giriş dosyasından başla; doğrudan bağımlılıklar için gerektiğinde bağlı karta geç.
- Aramayı dosya/yoldan ilgili klasöre, gerekliyse proje geneline kademeli genişlet. Doğruluk için gerekli okumaları atlama.
- Yol/sorumluluk/giriş/komut değişirse yalnız ilgili satır, kart ve JSON kaydı güncellenir; bütün indeks yeniden üretilmez.
