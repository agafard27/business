# Program rehberi / yapay zekâ

Anahtarsız, rol filtreli 33 kullanım senaryosu ve tam metin arama; isteğe bağlı AI yalnız aynı izinli rehberi kullanır.

## Doğrudan giriş

- [backend/src/assistant/service.js](../../backend/src/assistant/service.js): **createAssistantService → status, ask, configuration, save**

- [backend/src/assistant/config.js](../../backend/src/assistant/config.js): **createAssistantConfig (DPAPI + atomik ayar, revision/requestKey)**

- [backend/public/assistant.js](../../backend/public/assistant.js): **renderAssistant (yerel rehber ve soru)**

- [backend/public/assistant-settings.js](../../backend/public/assistant-settings.js): **renderAssistantSettings (anahtar yalnız giriş, geri gösterilmez)**

## İlgili dosyalar

- [backend/public/responsive.css](../../backend/public/responsive.css)

- [backend/public/screen-guide.js](../../backend/public/screen-guide.js)

- [backend/public/guide-scenarios.js](../../backend/public/guide-scenarios.js)

- [backend/src/assistant/routes.js](../../backend/src/assistant/routes.js)

- [backend/src/server.js](../../backend/src/server.js)

- [backend/src/app.js](../../backend/src/app.js)

- [backend/public/navigation-catalog.js](../../backend/public/navigation-catalog.js)

- [backend/public/navigation-search.css](../../backend/public/navigation-search.css)

- [backend/public/settings.js](../../backend/public/settings.js)

- [backend/src/secrets.js](../../backend/src/secrets.js)

## API

- `GET /api/assistant/status`

- `POST /api/assistant/ask`

- `GET /api/assistant/configuration (settings.manage)`

- `POST /api/assistant/configuration (settings.manage)`

## İlgili doğrulama

- [backend/tests/new-features.test.js](../../backend/tests/new-features.test.js)

- [backend/tests/assistant.test.js](../../backend/tests/assistant.test.js)

- [backend/tests/ui-integration.js](../../backend/tests/ui-integration.js)

## Bağlantılar

- [navigation](navigation.md)

- [auth](auth.md)

- [settings](settings.md)

- [runtime](runtime.md)

## Sınırlar ve ayar

Kapsam kullanıcının seçimiyle yalnız kullanım rehberi. Hiçbir SQL/iş verisi veya yazma aracı modele verilmez. Soru ve kullanıcının izinli rehber metinleri OpenAI Responses API’ye gönderilir; store:false, reasoning none, 1000 çıktı token sınırı, 20 saniye zaman aşımı ve kullanıcı başına 5 istek/dakika. Yanıt metin olarak gösterilir; HTML/URL çalıştırılmaz. Otomatik dış API tekrarı yok.

Varsayılan model gpt-6-luna. Gerçek API anahtarı henüz girilmedi; canlı model yanıtı doğrulanmadı. Ayarlar içinden yönetici anahtarı girip etkinleştirir. .local/assistant.json DPAPI kapalı içeriği, revision, son komut özeti, güncelleyen kullanıcı ve zaman taşır; kaynak/parola/günlüğe açık anahtar yazılmaz. Dosya yedek içeriğine dahil değildir; yeniden kurulumda API anahtarı tekrar girilir. Test ayarları ayrı dizindedir.

Resmî kaynaklar (29 Ekim 2026): [Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses), [kimlik doğrulama](https://developers.openai.com/api/reference/overview), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız bağlı davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
