# İşletme ve PC ayarları

İşletme adı, ana bilgisayardan Wi-Fi ağını etkinleştirme, güncel HTTPS adresi ve cihaz sertifika kurulumu.

## Doğrudan giriş

- [backend/public/network-settings.js](../../backend/public/network-settings.js): **renderNetworkSettings**

- [backend/src/business/settings.js](../../backend/src/business/settings.js): **createSettingsService, createSettingsRouter**

- [backend/public/settings.js](../../backend/public/settings.js): **renderSettings**

## İlgili dosyalar

- [backend/public/display-mode.js](../../backend/public/display-mode.js)

- [backend/public/assistant-settings.js](../../backend/public/assistant-settings.js)

## API

- `/api/settings`

## İlgili doğrulama

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/network.test.js](../../backend/tests/network.test.js)

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [navigation](navigation.md)

- [runtime](runtime.md)

- [business-core](business-core.md)

- [assistant](assistant.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
