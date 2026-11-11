# Yedek / ayrı geri dönüş

Şifreli tutarlı veritabanı ve ek belge yedeği; kaynak üzerine yazmadan doğrulama.

## Doğrudan giriş

- [backend/src/backup/service.js](../../backend/src/backup/service.js): **backupSettings, createBackup, restoreBackup, createBackupService**

- [backend/public/backups.js](../../backend/public/backups.js): **renderBackups**

## İlgili dosyalar

- [backend/src/backup/routes.js](../../backend/src/backup/routes.js)

- [backend/scripts/backup.js](../../backend/scripts/backup.js)

- [backend/scripts/restore-check.js](../../backend/scripts/restore-check.js)

## API

- `/api/backups`

## İlgili doğrulama

- [backend/tests/backup-integration.js](../../backend/tests/backup-integration.js)

## Bağlantılar

- [schema](schema.md)

- [files](files.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
