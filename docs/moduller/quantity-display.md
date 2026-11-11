# Miktar gösterimi

Giriş: [quantity-format.js](../../backend/public/quantity-format.js) → **formatQuantity**.

MySQL DECIMAL çıktısı zaten gerçek miktardır. 1.000000 → 1; 1.250000 → 1,25; gerçek 1000000.000000 → 1.000.000. İç BigInt ölçeği ekranda tekrar uygulanmaz. Para ve birim dönüşümü bu modüle ait değildir.

İlgili test: [quantity-format.test.js](../../backend/tests/quantity-format.test.js). Çağıran alanlar: sipariş, ödeme, hesap çıktısı, mutfak, stok/alış, reçete ve rapor/özet. Kullanıcı miktar girişini biçimlendirme için değiştirmeyin; API miktarları kanonik noktalı biçimde kalır.

28 Ekim canlı kontrol: son 9 check_lines satırının quantity değeri 1.000000, unit_code değeri adet. Milyonluk kayıt yok; yalnız gösterim düzeltildi. 24 birim / 11 entegrasyon testi geçti.
