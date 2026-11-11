using System.Collections.Generic;

namespace DukkanRevize.Core
{
    internal sealed class ModuleInfo
    {
        public readonly string Name;
        public readonly string Scope;
        public ModuleInfo(string name, string scope) { Name = name; Scope = scope; }
    }

    internal static class ModuleCatalog
    {
        public static readonly IList<ModuleInfo> All = new List<ModuleInfo>
        {
            new ModuleInfo("Masa ve sipariş", "Bölüm, masa, hızlı satış, adisyon, ürün ve servis seçimi"),
            new ModuleInfo("Hesap işlemleri", "Açma, bekletme, taşıma ve birleştirme"),
            new ModuleInfo("Ödeme ve iade", "Parçalı ödeme, veresiye, iade ve hesap çıktısı"),
            new ModuleInfo("Ürün ve fiyat", "Servis, birim, tartılı satış, paket ve fiyat tanımları"),
            new ModuleInfo("Mutfak ve bar", "Hazırlık sırası, durum ve hazırlık çıktısı"),
            new ModuleInfo("Reçete ve stok", "Üretim, parti, tüketim, sayım ve bekleyen stok işlemleri"),
            new ModuleInfo("Alış ve mal kabulü", "Mal kabulü, iade ve firma borcu"),
            new ModuleInfo("Cari hesaplar", "Müşteri, tedarikçi, borç dağıtımı ve tahsilat"),
            new ModuleInfo("Kasa", "Açılış, hareket, teslim, devir ve kapanış"),
            new ModuleInfo("Gider ve personel", "Gider, personel, avans ve ekipman"),
            new ModuleInfo("Raporlar", "Genel bakış, ayrıntı, maliyet ve işlem geçmişi"),
            new ModuleInfo("Excel ve CSV", "İçe alma, kontrol ve geri alma"),
            new ModuleInfo("Kullanıcı ve onay", "Giriş, rol, oturum, kilit ve yetkili onayı"),
            new ModuleInfo("Yedek ve belgeler", "Şifreli yedek, geri açma ve belge ekleri"),
            new ModuleInfo("Ayarlar ve rehber", "İşletme, yazıcı, yerel rehber ve isteğe bağlı AI"),
            new ModuleInfo("Telefon ve yerel ağ", "Yetkili ağ açma, güvenli bağlantı ve eşzamanlı işlemler")
        }.AsReadOnly();
    }
}

