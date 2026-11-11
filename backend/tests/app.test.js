import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

test('HTTP durum, hata ve statik dosya akışları', async t => {
  let ready = false;
  const app = createApp({ status: () => ({ ready }) }, { extend(app) {
    app.get('/test-error', async () => { throw new Error('DO_NOT_EXPOSE_PASSWORD'); });
    app.post('/test-body', (req, res) => res.json(req.body));
  } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = route => fetch(`http://127.0.0.1:${server.address().port}${route}`);
  assert.equal((await request('/health/live')).status, 200);
  assert.equal((await request('/health/ready')).status, 503);
  ready = true;
  assert.equal((await request('/health/ready')).status, 200);
  const page = await request('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /İşletme/);
  assert.match(await (await request('/status.html')).text(), /Sistem durumu/);
  assert.equal(page.headers.get('x-powered-by'), null);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal((await request('/.local/database.json')).status, 404);
  const error = await request('/test-error');
  assert.equal(error.status, 500);
  assert.ok(!(await error.text()).includes('DO_NOT_EXPOSE_PASSWORD'));
  assert.equal((await request('/health/live')).status, 200);
  const invalid = await fetch(`http://127.0.0.1:${server.address().port}/test-body`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(invalid.status, 400);
});

test('veritabanı görünümü yalnızca hazırken salt okunur metadata sağlar', async t => {
  let ready = false;
  let calls = 0;
  let inspectorError;
  const metadata = { databaseName: 'nar_cicegi', schemaVersion: 2,
    checkedAtUtc: '2026-10-22T12:00:00.000Z', tables: [{ name: 'products',
      columns: [{ name: 'id', type: 'bigint unsigned', nullable: false, isPrimaryKey: true }], relationships: [] }] };
  const app = createApp({ status: () => ({ ready }) }, { schemaInspector: async () => {
    calls++;
    if (inspectorError) throw inspectorError;
    return metadata;
  } });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/system/database`;
  const unavailable = await fetch(url);
  assert.equal(unavailable.status, 503);
  assert.equal(calls, 0, 'An offline request must not create more failing database connections');
  ready = true;
  const response = await fetch(`${url}?database=mysql`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), metadata, 'The client cannot select a different database');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fetch(url, { method })).status, 404);
  }
  assert.equal(calls, 1, 'Mutation methods never execute the metadata reader');
  inspectorError = new Error('DO_NOT_EXPOSE_CONNECTION_OR_SQL');
  const failed = await fetch(url);
  assert.equal(failed.status, 503, 'A connection lost after the monitor check remains a recoverable failure');
  const failureText = await failed.text();
  assert.ok(!failureText.includes(inspectorError.message));
  assert.match(failureText, /Veritabanı yapısı şu anda okunamıyor/);
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/health/live`)).status, 200);
});

test('metadata okuyucusu tanımlanmamışsa veritabanı görünümü 503 döner', async t => {
  const server = createApp({ status: () => ({ ready: true }) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/system/database`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).title, /Veritabanı yapısı/);
});
