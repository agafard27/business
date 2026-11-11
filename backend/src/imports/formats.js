export const importFormats={
  products:{name:'Ürünler / barkodlar',permission:'catalog.manage',columns:{code:'Ürün kodu',name:'Ürün adı',type:'Tür (ready/prepared/ingredient/consumable)',unitCode:'Temel birim kodu',barcode:'Barkod (isteğe bağlı)'}},
  units_prices:{name:'Servis ve fiyatlar',permission:'catalog.manage',columns:{productCode:'Ürün kodu',optionCode:'Servis kodu',optionName:'Servis adı',unitCode:'Satış birim kodu',price:'Fiyat (TL)',basisQuantity:'Fiyatın ait olduğu miktar'}},
  opening_stock:{name:'Başlangıç stokları',permission:'stock.manage',columns:{warehouseCode:'Depo kodu',productCode:'Ürün kodu',quantity:'Temel miktar',totalCost:'Toplam maliyet (TL)',lotCode:'Parti kodu (isteğe bağlı)'}},
  parties:{name:'Müşteri ve tedarikçiler',permission:'parties.manage',columns:{code:'Cari kodu',name:'Cari adı',isCustomer:'Müşteri (evet/hayır)',isSupplier:'Tedarikçi (evet/hayır)',creditLimit:'Veresiye limiti (TL; isteğe bağlı)'}},
  opening_balances:{name:'Başlangıç borç/alacakları',permission:'parties.manage',columns:{partyCode:'Cari kodu',accountType:'Hesap türü (receivable/payable)',amount:'Başlangıç tutarı (TL)'}}
};
