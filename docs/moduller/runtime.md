# Başlatma / bağlantı / sağlık

PC HTTP yaşam döngüsü, açıkça etkinleştirilen HTTPS LAN, otomatik ağ adresi, DPAPI/TLS ve Windows özel ağ izinleri.

## Doğrudan giriş

- [backend/src/network-routes.js](../../backend/src/network-routes.js): **createNetworkRouter**

- [backend/src/network.js](../../backend/src/network.js): **createNetworkManager → initialize, status, start, close; prepareWindowsNetwork, loadNetworkTLS, allowedRequestHost, networkHostGuard**

- [backend/src/server.js](../../backend/src/server.js): **sunucu yaşam döngüsü**

- [backend/src/app.js](../../backend/src/app.js): **createApp**

- [backend/src/monitor.js](../../backend/src/monitor.js): **createMonitor**

## İlgili dosyalar

- [backend/scripts/network-firewall.ps1](../../backend/scripts/network-firewall.ps1)

- [backend/scripts/network-setup.ps1](../../backend/scripts/network-setup.ps1)

- [backend/src/config.js](../../backend/src/config.js)

- [backend/src/secrets.js](../../backend/src/secrets.js)

- [backend/scripts/doctor.js](../../backend/scripts/doctor.js)

- [backend/scripts/start.js](../../backend/scripts/start.js)

- [backend/scripts/install-startup.ps1](../../backend/scripts/install-startup.ps1)

- [backend/scripts/run-hidden.ps1](../../backend/scripts/run-hidden.ps1)

- [backend/public/app.js](../../backend/public/app.js)

## API

- `GET /api/network/certificate (settings.manage + loopback)`

- `POST /api/network (activate/deactivate; settings.manage + loopback + requestKey/revision)`

- `GET /api/network`

- `/health/live`

- `/health/ready`

- `/api/system/status`

## İlgili doğrulama

- [backend/tests/network.test.js](../../backend/tests/network.test.js)

- [backend/tests/app.test.js](../../backend/tests/app.test.js)

- [backend/tests/monitor.test.js](../../backend/tests/monitor.test.js)

## Bağlantılar

- [settings](settings.md)

- [auth](auth.md)

- [schema](schema.md)

- [navigation](navigation.md)

- [assistant](assistant.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
