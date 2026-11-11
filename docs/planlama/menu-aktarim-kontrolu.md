# Menü aktarımı kontrolü

Kontrol: 21 Ekim 2026. Kaynak: [Nar Çiçeği menüsü](https://menu.narcicegi.com.tr/), sayfanın kullandığı `/assets/index-e54bccf5.js` dosyasındaki fiyatlı menü kayıtları. Kaynak kod çalıştırılmadan okunmuştur.

## Kapsam

| Menü bölümü | Ürün kaydı | Fiyat seçeneği |
|---|---:|---:|
| Yemekler | 5 | 9 |
| İçecekler | 36 | 36 |
| Çerezler | 9 | 9 |
| Aparatifler | 4 | 4 |
| Dondurmalar | 31 | 36 |
| Toplam | 85 | 94 |

İlk ekran taslağında yalnızca 11 ürün temsil ediliyordu. Güncellenen taslakta 85 kaydın tamamı vardır. Dürüm/porsiyon ve Tam/Yarım fiyatları aynı ürünün ayrı seçenekleri olarak korunmuştur. Aynı isimli iki Kola kaydı ayrı kimliklerle tutulur; ürünler adlarına göre birleştirilmez.

Kaynak adları, kategorileri, fiyat metinleri, kaynak kimlikleri ve kuruş cinsinden fiyat seçenekleri `menu-urunleri.json` dosyasındadır. Her taslak ürünü bu dosyadaki bir kaynağa `sourceId` ile bağlanır. Menü fiyatıyla karşılaştırmada örnek seçenekler ayrı değerlendirilir.

## Doğrulanan bilgiler ve yorumlar

- İşletme sahibi Çerezler bölümündeki dokuz fiyatın tamamını kilogram fiyatı olarak doğruladı. Taslak bu ürünleri gram girilerek sattırır; hesap, kilogram fiyatı × gram / 1000 üzerinden yapılır. Örneğin 175 TL/kg üründen 200 g = 35 TL.
- Kaynak görsellerine göre 70 TL Kola kutu, 40 TL Kola cam şişe olarak ayırt edildi; işletme sahibi de kutu/cam ayrımını doğruladı. Hacim bilgisi eklenmedi. Kaynaktaki iki ürün adı da Kola olarak korunur; ekranda Kutu Kola ve Cam Kola adları kullanılır.
- Kaynakta yazan 500 ml, 1,5 L, 1 L ve 2,5 L gibi seçenekler adları ve fiyatlarıyla ayrı tutulur.
- Açık dondurmada kaynakta bulunan Tam/Yarım fiyatları korunur; bu adlar kesin gramaj bilgisi sayılmaz.
- Önceki taslaktaki PET ayran 30 TL, örnek bardak hacimleri ve Sade gramla dondurma 500 TL/kg ile 200/100 g örnek gramajları menüden alınmış fiyat/ölçü değildir. Örnek oldukları ekranda işaretlidir. Diğer ürünlere bu örnekler yayılmaz.
- Hazırlık bölümü ve menüde açıkça belirtilmeyen satış birimi etiketleri ekran taslağı içindir; gerçek reçete, stok, barkod veya maliyet kaydı aktarılmış değildir.

## İşleyiş

Arama ve ortak favoriler 85 kaydın tamamında çalışır. Önceki 11 ürünün kimlikleri korunmuştur. Örnek adisyonlar ürün sırasına bağlı dizi indisleri yerine sabit ürün kimliğiyle oluşturulur. Böylece tüm menünün eklenmesi başlangıç hesaplarını başka ürünlere dönüştürmez.

Bu dosya menü aktarımının kapsamını tanımlar; canlı menüyle otomatik ve sürekli fiyat eşitlemesi kurulmamıştır. Gerçek işletme stoğu, alış fiyatları ve reçeteler ayrıca girilecektir.

## Yapılan kontroller

85 kaynak kaydı ve 94 kaynak fiyatı taslaktaki ürünlerle karşılaştırıldı; eksik veya farklı fiyat bulunmadı. İki Kola araması, kategori/favori süzmesi, dokuz çerezin gram hesabı ve örnek adisyon başlangıcı denetlendi. JavaScript sözdizimi ve tek dosya önizleme eşitliği kontrol edildi. Kullanılabilir tarayıcı yüzeyi bulunmadığından gerçek tarayıcıda görsel denetim tamamlanamadı.
