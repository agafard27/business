import {fieldHelp,showField} from './data-entry.js';
const guidance={
  operating:'İşletmenin günlük gideri (ör. elektrik veya kira). Gider tarihi faaliyet sonucunu etkiler. Stoklanacak mal alımını Alış / mal kabulü ekranından girin.',
  equipment:'İşletmede kullanılacak cihaz veya demirbaş. Ekipman envanterine eklenir; faaliyet giderinden ayrı raporlanır.',
  staff_payment:'Personele ait ücret/gider kaydı. Personel seçimi zorunludur; faaliyet giderine dahil edilir. Para çıkışı için kaydın ödemesini ayrıca yapın.',
  staff_advance:'Personele verilen avans. Personel seçimi zorunludur; faaliyet giderinden ayrı gösterilir. Kaydı oluşturduktan sonra ödemesini kaydedin.'
};
export function mountExpenseGuide(form){
  const info=form.ownerDocument.createElement('p');info.className='entry-preview';info.setAttribute('role','status');form.elements.namedItem('type').closest('label').after(info);
  const control=name=>form.elements.namedItem(name);
  fieldHelp(control('date'),'Giderin gerçekleştiği gün; dönem raporu bu tarihi kullanır. Ödeme günü ayrıca ödeme kaydıyla oluşur. Boş bırakırsanız bugün kaydedilir.');
  fieldHelp(control('dueDate'),'Ödemenin son günü; giderin gerçekleştiği tarihi değiştirmez.');
  fieldHelp(control('total'),'Kaydın tamamının tutarı, TL (ör. 150,50). Bu form henüz kasadan para çıkarmaz.');
  fieldHelp(control('description'),'Neye ait olduğunu ve dönemini yazın. Örnek: Ekim elektrik faturası veya Ekim personel avansı.');
  fieldHelp(control('supplierId'),'Seçerseniz tutar bu firmanın borç hesabına da yazılır. Aynı belgeyi ayrıca mal alışı veya eski bakiye olarak tekrar girmeyin.');
  fieldHelp(control('categoryId'),'Sonradan aynı giderleri bulmak için uygun başlığı seçin; giderin türünü aşağıdaki seçim belirler.');
  function update(){const type=control('type').value,staff=type.startsWith('staff_'),equipment=type==='equipment';
    showField(control('staffId'),staff);control('staffId').required=staff;
    showField(control('supplierId'),!staff);
    for(const name of ['equipmentName','serialNumber'])showField(control(name),equipment);
    control('equipmentName').required=equipment;
    info.textContent=guidance[type];
  }
  control('type').addEventListener('change',update);update();form.querySelector('[type=submit]').textContent='Gider kaydını oluştur';
}
