# Giriş / oturum / kullanıcı / rol

Kimlik, oturum, yetki ve yönetim. Ekran düğmesi yetki kontrolünün yerini tutmaz.

Normal giriş tarayıcı oturum çerezi + en fazla 12 saat; Beni hatırla seçiliyse çerez/MySQL 30 gün. Varsayılan kapalı; çıkış/kilitleme ve mevcut kullanıcı iptal kuralları devam eder. Parola/token tarayıcı depolamasına yazılmaz.

## Doğrudan giriş

- [backend/public/app.js](../../backend/public/app.js): **renderEntry** — giriş formu ve rememberMe seçimi.

- [backend/public/app.css](../../backend/public/app.css): **entry-remember** — giriş seçeneği yerleşimi.

- [backend/src/auth/service.js](../../backend/src/auth/service.js): **createAuthService**

- [backend/src/auth/management.js](../../backend/src/auth/management.js): **createAuthManagementService**

- [backend/public/administration.js](../../backend/public/administration.js): **renderAdministration**

## İlgili dosyalar

- [backend/src/network.js](../../backend/src/network.js)

- [backend/src/auth/routes.js](../../backend/src/auth/routes.js)

- [backend/src/auth/management-routes.js](../../backend/src/auth/management-routes.js)

- [backend/src/auth/policy.js](../../backend/src/auth/policy.js)

- [backend/src/auth/password.js](../../backend/src/auth/password.js)

## API

- `/api/auth`

- `/api/users`

- `/api/admin`

## İlgili doğrulama

- [backend/scripts/visual-order-check.js](../../backend/scripts/visual-order-check.js): **login** örneği.

- [backend/scripts/visual-responsive.js](../../backend/scripts/visual-responsive.js): giriş formunun 390/1440 px kontrolü.

- [backend/tests/network.test.js](../../backend/tests/network.test.js)

- [backend/tests/auth.test.js](../../backend/tests/auth.test.js)

- [backend/tests/auth-integration.js](../../backend/tests/auth-integration.js)

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

## Bağlantılar

- [runtime](runtime.md)

- Dış iş modülü bağımlılığı yok.

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
