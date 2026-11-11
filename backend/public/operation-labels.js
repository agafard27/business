// Display labels only: stored operation codes and technical logs remain stable.
const actions={
'sales.table.submit':'Adisyon ve ilk sipariş kaydedildi',
'auth.setup':'İlk yönetici hesabı oluşturuldu','auth.login':'Oturum açıldı','auth.logout':'Oturum kapatıldı','users.create':'Çalışan hesabı oluşturuldu','users.update':'Çalışan bilgileri güncellendi','users.sessions.revoke':'Çalışan oturumları kapatıldı','users.password.reset':'Çalışan parolası yenilendi','users.role.update':'Rol ve yetkiler güncellendi',
'dining.section.save':'Bölüm kaydedildi','dining.table.save':'Masa kaydedildi','dining.tables.create':'Toplu masalar oluşturuldu',
'sales.line.cancel':'Sipariş satırı iptal edildi','sales.line.adjust':'İndirim veya ikram kaydedildi','sales.bill.request':'Hesap istendi',
'sales.close.empty':'Bakiyesiz hesap kapatıldı','purchase.cancel':'Alış taslağı iptal edildi','stock.sale.retry':'Bekleyen stok tüketimi kontrol edildi','stock.sales-tracking.enable':'Satış stok takibi açıldı',
'sales.open':'Adisyon açıldı','sales.submit':'Sipariş gönderildi','sales.favorite':'Favori ürün değiştirildi','sales.cancel':'Sipariş satırı iptal edildi','sales.adjust':'İndirim veya ikram kaydedildi','sales.move':'Hesap başka masaya taşındı','sales.merge':'Hesaplar birleştirildi','sales.bill':'Hesap istendi','sales.request-bill':'Hesap istendi','sales.close':'Bakiyesiz hesap kapatıldı','sales.close-empty':'Bakiyesiz hesap kapatıldı','sales.settle':'Hesap ödemesi kaydedildi','sales.refund':'Ödeme iadesi kaydedildi',
'cash.register.create':'Kasa tanımlandı','cash.shift.open':'Kasa açıldı','cash.shift.close':'Kasa kapatıldı','cash.handover':'Kasa teslim edildi ve kapatıldı','cash.movement':'Diğer nakit hareketi kaydedildi','cash.transfer':'Nakit teslimi kaydedildi',
'party.create':'Müşteri veya tedarikçi oluşturuldu','party.update':'Hesap bilgileri güncellendi','party.entry':'Cari hesap hareketi kaydedildi',
'purchase.create':'Alış taslağı oluşturuldu','purchase.receive':'Mal teslim alındı','purchase.pay':'Alış ödemesi kaydedildi','purchase.return':'Tedarikçi iadesi kaydedildi',
'expense.create':'Gider veya personel kaydı oluşturuldu','expense.pay':'Gider veya personel ödemesi kaydedildi','expense.category.create':'Gider kategorisi oluşturuldu','expense.equipment.retire':'Ekipman envanterden çıkarıldı',
'stock.recipe.create':'Reçete sürümü oluşturuldu','stock.warehouse.create':'Depo oluşturuldu','stock.movement':'Stok hareketi kaydedildi','stock.production':'Gerçek üretim kaydedildi','stock.transfer':'Depolar arası transfer kaydedildi','stock.sales-tracking':'Satış stok takibi açıldı','stock.issue.retry':'Bekleyen stok tüketimi kontrol edildi',
'catalog.unit.create':'Ölçü birimi oluşturuldu','catalog.units.standard':'Standart ölçü birimleri tamamlandı','catalog.category.create':'Ürün kategorisi oluşturuldu','catalog.station.create':'Hazırlık alanı oluşturuldu','catalog.product.create':'Ürün oluşturuldu','catalog.stock.rule':'Ürünün stok kuralı güncellendi','catalog.option.save':'Satış servisi sürümü kaydedildi','catalog.barcode.create':'Barkod eklendi','catalog.conversion.save':'Birim dönüşümü kaydedildi','catalog.product.update':'Ürün bilgileri güncellendi','catalog.price.update':'Fiyat sürümü kaydedildi','catalog.reference_import':'Referans menü aktarıldı','catalog.reference.import':'Referans menü aktarıldı',
'kitchen.transition':'Hazırlık durumu değiştirildi','approval.request':'Yetkili onayı istendi','approval.decide':'Onay talebi değerlendirildi','import.stage':'Dosya aktarımı önizlendi','import.apply':'Dosya aktarımı kesinleştirildi','import.discard':'Aktarım önizlemesi kaldırıldı','import.reverse':'Dosya aktarımı ters kayıtla geri alındı','settings.business.save':'İşletme ayarları kaydedildi','file.upload':'Belge eki yüklendi'
};
const outcomes={succeeded:'Başarılı',failed:'Başarısız',denied:'Reddedildi',pending:'Bekliyor',completed:'Tamamlandı'};
const kinds={
sales:{table:'Masalı satış',retail:'Masasız satış'},
purchases:{draft:'Teslim bekleyen taslak',posted:'Teslim alındı',cancelled:'İptal'},
stock:{receipt:'Mal kabulü',return:'Tedarikçi iadesi',opening:'Başlangıç stoğu',count:'Fiziksel sayım',waste:'Fire / dökülme',staff:'Personel tüketimi',complimentary:'İkram',personal:'Kişisel kullanım',sale:'Satış tüketimi',purchase:'Mal kabulü',purchase_return:'Tedarikçi iadesi',production:'Üretim',transfer:'Depolar arası transfer',correction:'Stok düzeltmesi'},
expenses:{operating:'İşletme gideri',equipment:'Ekipman',staff_payment:'Personel ödemesi',staff_advance:'Personel avansı'},
accounts:{opening:'Önceki bakiye',sale_credit:'Veresiye satış',purchase:'Mal alışı',expense:'Gider',payment:'Tahsilat / ödeme',return:'İade',correction:'Düzeltme',advance:'Avans'},
cash:{sale_receipt:'Satış tahsilatı',sale_refund:'Satış iadesi',party_receipt:'Veresiye tahsilatı',party_payment:'Cari hesap ödemesi',expense_payment:'Gider ödemesi',purchase_payment:'Mal alışı ödemesi',manual_in:'Diğer nakit girişi',manual_out:'Diğer nakit çıkışı',transfer_in:'Teslim alınan nakit',transfer_out:'Teslim edilen nakit',opening:'Başlangıç nakdi'},
shifts:{open:'Açık',closed:'Teslim edildi / kapalı'},
adjustments:{cancel:'İptal',discount:'İndirim',complimentary:'İkram',cancelled:'İptal'}
};
kinds.groups={open:'Açık',closed:'Kapalı',merged:'Birleştirildi'};
kinds.payments={in:'Para girişi',out:'Para çıkışı'};
kinds.operating=kinds.equipment=kinds.staff=kinds.expenses;
kinds.receivables=kinds.payables=kinds.accounts;
export const actionLabel=code=>actions[code]||`Tanımlanmamış işlem (${code})`;
export const outcomeLabel=code=>outcomes[code]||`Tanımlanmamış sonuç (${code})`;
export const kindLabel=(kind,code)=>kinds[kind]?.[code]||`Tanımlanmamış tür (${code})`;
export const accountLabel=code=>({receivable:'Müşteri alacağı',payable:'Tedarikçi borcu'})[code]||`Tanımlanmamış hesap (${code})`;
