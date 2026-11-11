# Ana menü ve ekran arama

Yetkiye göre solda açılır bölümler, telefon menüsü, ekran arama, ekran rehberi ve Otomatik/Telefon/PC görünümü.

## Doğrudan giriş

- [backend/public/workspace-navigation.js](../../backend/public/workspace-navigation.js): **mountWorkspaceNavigation** — tek açık bölüm, doğrudan ekranlar, ortak hedefi tek gösterme, aktif ekran, telefonda aç-kapat ve dinleyici temizliği.

- [backend/public/display-mode.js](../../backend/public/display-mode.js): **mountDisplayMode**

- [backend/public/screen-guide.js](../../backend/public/screen-guide.js): **availableGuides, scenarioHtml, mountScreenGuide**

- [backend/public/guide-scenarios.js](../../backend/public/guide-scenarios.js): **guideTopics (33 statik örnek)**

- [backend/public/navigation-catalog.js](../../backend/public/navigation-catalog.js): **screens, businessTabs, availableScreens, canAccessScreen, searchScreens**

- [backend/public/navigation-search.js](../../backend/public/navigation-search.js): **mountNavigationSearch**

- [backend/public/app.js](../../backend/public/app.js): **renderHome → workspace-shell / workspace-content yerleşimi, arama aboneliği temizleme**

## İlgili dosyalar

- [backend/public/workspace-navigation.css](../../backend/public/workspace-navigation.css): yalnız uygulama kabuğu menü/başlık yerleşimi.

- [backend/scripts/visual-responsive.js](../../backend/scripts/visual-responsive.js)

- [backend/public/responsive.css](../../backend/public/responsive.css)

- [backend/public/navigation-search.css](../../backend/public/navigation-search.css)

- [backend/public/index.html](../../backend/public/index.html)

- [backend/scripts/visual-order-check.js](../../backend/scripts/visual-order-check.js)

## API

- İş API çağrısı yapmaz.

## İlgili doğrulama

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/navigation.test.js](../../backend/tests/navigation.test.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [auth](auth.md)

- [assistant](assistant.md)

## Ekran ekleme

Görünen işletme sekmeleri app.js içinden navigation-catalog.js dosyasına alındı. Yeni ekranın id, isim, group, izin, module/render, keywords ve guide kaydını tek yerde güncelle; ilgili navigationGroups.screenIds sırasına ekle. navigationGroups bölüm adı/sırasını ve alt ekran sırasını tutar; boş gruplar gösterilmez. navigationAlias ortak hedefi yalnız hedefe de erişilebiliyorsa menüden gizler; ekranın kendi izinleri, eski bağlantısı ve arama kaydı kalır. Başlık araması iş kaydı aramaz. Backend iş yetki kontrolleri kendi route/service katmanlarında kalır. app.js ES modülüdür; index.html type=module içerir. renderHome aramayı yeniden bağlamadan önce eski document dinleyicilerini temizler.

## Menü davranışı

- PC'de 1020 px üzerinde menü solda, içerik sağdadır. Telefon tercihi veya dar ekranda menü içerikten önce düğmeyle açılır; içerik dar bir yan sütuna sıkışmaz.
- Genel bakış, Raporlar ve Program rehberi doğrudan açılır. Diğer bölümler: Satış; Para işleri; Ürün ve stok; Yönetim. Yetkiye göre tek ekran kalan bölüm de doğrudan açılır.
- Aynı anda yalnız bir bölüm açıktır; aynı başlığa tekrar basmak kapatır. Bölüm seçmek mevcut iş ekranını yeniden çizmez. Açık ekranı tekrar seçmek taslağı silmez; eski recipes bağlantısında ortak definitions bağlantısını seçmek de yeniden çizmez. Gerçek ekran seçimi mevcut openTab yönlendirmesidir.
- Kasa Para işleri, Onaylar Yönetim içindedir. Birimler ve reçeteler ortak definitions hedefidir; yalnız stock.manage yetkisi olan kişide recipes bağlantısı korunur.
- Telefon menüsü başlangıçta kapalı; seçim, dış tıklama veya Escape ile kapanır. Escape odağı menü düğmesine döndürür.
- Ekran arama/Ctrl+K korunur; kabukta showHelp=false ile tekrarlanan rehber düğmesi gösterilmez. Rehber ana menüde bulunur.
- Yetki kaynağı aynı canAccessScreen kuralıdır; izinli/tutar sınırlı ekranlar süzülür. Backend yetkileri değiştirilmez.
- renderHome ve renderEntry eski arama/menü aboneliklerini temizler. Workspace etiketini sabit current-screen-title başlığından alır; düz tablist üretilmez.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
