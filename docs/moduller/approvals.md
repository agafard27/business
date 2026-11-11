# Yetkili onay kuyruğu

Talep, karar ve aynı onay eyleminin bir kez uygulanması.

## Doğrudan giriş

- [backend/src/auth/approvals.js](../../backend/src/auth/approvals.js): **createApprovalService**

- [backend/src/auth/approval-actions.js](../../backend/src/auth/approval-actions.js): **createDefaultApprovalService** — sales.table.submit ilk masa siparişini onaylayan yetkili adına aynı anahtarla uygular; payload.id masa kimliğidir.

- [backend/public/administration.js](../../backend/public/administration.js): **yalnız renderApprovals**

## İlgili dosyalar

- [backend/src/auth/approval-routes.js](../../backend/src/auth/approval-routes.js)

## API

- `/api/approvals`

## İlgili doğrulama

- [backend/tests/management-integration.js](../../backend/tests/management-integration.js)

## Bağlantılar

- [auth](auth.md)

- [business-core](business-core.md)

## Çalışma sınırı

Önce bu modülün girişini ve ilgili testini oku. Diğer modüle yalnız yukarıdaki bağlantıdaki davranış değişecekse geç. Yeni dosya/fonksiyon/API eklenirse bu kartı ve docs/kod-haritasi.json kaydını güncelle. Parola, oturum veya yerel iş verisi haritaya yazılmaz.
