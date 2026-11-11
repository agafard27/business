const byId = id => document.getElementById(id);
const formatDate = value => value ? new Intl.DateTimeFormat('tr-TR', {dateStyle:'short', timeStyle:'medium', timeZone:'Europe/Istanbul'}).format(new Date(value)) : '—';
let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  byId('refresh').disabled = true;
  try {
    const response = await fetch('/api/system/status', {cache:'no-store', signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('status');
    const {database} = await response.json();
    const fresh = database.checkedAtUtc && Date.now() - Date.parse(database.checkedAtUtc) < 45000;
    const ready = database.ready && fresh;
    byId('badge').textContent = ready ? 'Hazır' : 'Hazır değil';
    byId('badge').className = 'badge' + (ready ? ' ready' : '');
    byId('message').textContent = !fresh && database.checkedAtUtc ? 'Durum kontrolü gecikti. Güncel bağlantı doğrulanamadı.' : database.message;
    byId('checked').textContent = formatDate(database.checkedAtUtc);
    byId('success').textContent = formatDate(database.lastSuccessAtUtc);
    byId('schema').textContent = database.schemaVersion ?? '—';
    byId('latency').textContent = database.latencyMs == null ? '—' : `${database.latencyMs} ms`;
    byId('updated').textContent = 'Ekran güncellendi: ' + formatDate(new Date().toISOString());
  } catch {
    byId('badge').textContent = 'Hizmete ulaşılamıyor';
    byId('badge').className = 'badge';
    byId('message').textContent = 'Uygulama bağlantısı kurulamadı. Son bilgiler güncel olmayabilir. Yeniden kontrol edilecek.';
  } finally { loading = false; byId('refresh').disabled = false; }
}
byId('refresh').addEventListener('click', refresh);
refresh();
setInterval(refresh, 5000);
