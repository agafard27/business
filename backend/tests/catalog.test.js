import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createCatalogService } from '../src/catalog/service.js';
import { identifier, listingInput, normalizeSearch, priceInput, productInput } from '../src/catalog/validation.js';

test('menü fiyatları kayan nokta ve belirsiz sayı biçimlerini reddeder', () => {
  const base = { requestKey: randomUUID(), revision: '1', optionId: '10' };
  for (const priceMinor of [1.23, 123, '1.23', '1e3', '-1', '+1', '01', '', ' 10', '10000000000', null]) {
    assert.throws(() => priceInput({ ...base, priceMinor }), { code: 'INVALID_INPUT' });
  }
  for (const priceMinor of ['0', '1', '9999999999']) {
    assert.equal(priceInput({ ...base, priceMinor }).priceMinor, priceMinor);
  }
  assert.throws(() => priceInput({ ...base, requestKey: 'not-a-uuid', priceMinor: '1' }), { code: 'INVALID_INPUT' });
  assert.throws(() => priceInput({ ...base, priceMinor: '1', unexpected: true }), { code: 'INVALID_INPUT' });
});

test('ürün kimlikleri, düzenleme sürümü ve ad uzunluğu veri kaybına yol açmadan doğrulanır', () => {
  assert.equal(identifier('18446744073709551615'), '18446744073709551615');
  for (const id of ['18446744073709551616', 9007199254740992, '0', '-1', '01', '1 OR 1=1', null]) {
    assert.throws(() => identifier(id), { code: 'INVALID_INPUT' });
  }
  const input = { requestKey: randomUUID(), revision: '1', name: '  Çay  ', categoryId: null, isActive: true };
  assert.equal(productInput(input).name, 'Çay');
  for (const invalid of [{ name: '' }, { name: 'a'.repeat(181) }, { name: 'a\nb' }, { isActive: 'true' }, { revision: 0 }, { categoryId: undefined }]) {
    assert.throws(() => productInput({ ...input, ...invalid }), { code: 'INVALID_INPUT' });
  }
});

test('Türkçe arama ve sayfalama sınırsız veya yanlış tipli istek kabul etmez', () => {
  assert.equal(normalizeSearch('ÇAY ŞALGAM IŞIK İçecek'), 'cay salgam isik icecek');
  assert.equal(listingInput({ search: '  ŞALGAM  ' }).search, 'salgam');
  assert.deepEqual(listingInput({ status: 'inactive', page: '2', pageSize: '7' }), {
    search: '', categoryId: null, status: 'inactive', page: 2, pageSize: 7
  });
  for (const query of [{ pageSize: '101' }, { page: '0' }, { page: '-1' }, { page: '1e6' }, { search: ['x', 'y'] }, { status: 'unknown' }, { categoryId: '1; DROP' }]) {
    assert.throws(() => listingInput(query), { code: 'INVALID_INPUT' });
  }
});

test('geçersiz menü komutları veritabanı bağlantısı denenmeden reddedilir', async () => {
  const service = createCatalogService({});
  await assert.rejects(service.getProduct('../bad'), { code: 'INVALID_INPUT' });
  await assert.rejects(service.listProducts({ pageSize: '1000' }), { code: 'INVALID_INPUT' });
  await assert.rejects(service.updateProduct('1', {}, '1'), { code: 'INVALID_INPUT' });
  await assert.rejects(service.updatePrice('1', { requestKey: randomUUID(), revision: '1', optionId: '2', priceMinor: 10.5 }, '1'), { code: 'INVALID_INPUT' });
  for (const input of [undefined, [], { actorId: '1' }, { products: [] }]) {
    await assert.rejects(service.importReferenceMenu(input, '1'), { code: 'INVALID_INPUT' });
  }
});

test('ürün API yetkiyi sunucuda denetler, çapraz kaynak yazmalarını engeller ve hataları gizler', async t => {
  let ready = true;
  let permissions = [];
  let signedIn = true;
  let calls = 0;
  let failure;
  const catalogService = {
    async meta() { calls++; if (failure) throw failure; return { categories: [], units: [] }; },
    async referenceMenu() { calls++; return { productCount: 85, optionCount: 94 }; },
    async importReferenceMenu(input, actorId) { calls++; if (failure) throw failure; return { actorId }; },
    async updateProduct(id, input, actorId) { calls++; return { product: { id, actorId, name: input.name } }; }
  };
  const authService = { async authenticate() { return signedIn ? { id: '12', permissions } : null; } };
  const server = createApp({ status: () => ({ ready }) }, { authService, catalogService }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = () => fetch(`${base}/api/catalog/meta`);
  const preview = () => fetch(`${base}/api/catalog/reference-menu`);
  const importMenu = (headers = {}) => fetch(`${base}/api/catalog/reference-menu/import`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: base, ...headers }, body: '{}'
  });
  assert.equal((await get()).status, 403);
  assert.equal((await preview()).status, 403);
  assert.equal((await importMenu()).status, 403);
  permissions = ['users.manage'];
  assert.equal((await get()).status, 403);
  permissions = ['catalog.manage'];
  signedIn = false;
  assert.equal((await get()).status, 401);
  assert.equal((await importMenu()).status, 401);
  signedIn = true;
  ready = false;
  assert.equal((await get()).status, 503);
  assert.equal(calls, 0);
  ready = true;
  assert.equal((await get()).status, 200);
  assert.equal((await preview()).status, 200);
  assert.equal((await importMenu({ 'X-Nar-Request': '' })).status, 403);
  assert.equal((await importMenu({ Origin: 'https://other.invalid' })).status, 403);
  assert.equal((await importMenu({ 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await (await importMenu()).json()).actorId, '12');
  const change = headers => fetch(`${base}/api/catalog/products/7`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'Çay' }) });
  assert.equal((await change({ 'Content-Type': 'application/json' })).status, 403);
  assert.equal((await change({ 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: 'https://other.invalid' })).status, 403);
  const updated = await change({ 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: base });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).product.actorId, '12');
  failure = Object.assign(new Error('DO_NOT_EXPOSE_SQL_OR_CREDENTIALS'), { code: 'ER_ACCESS_DENIED_ERROR' });
  const failed = await get();
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes('DO_NOT_EXPOSE_SQL_OR_CREDENTIALS'));
  failure = Object.assign(new Error('DO_NOT_EXPOSE_SQL_OR_CREDENTIALS'), { code: 'COMMIT_UNKNOWN' });
  const unknown = await get();
  assert.equal((await unknown.json()).code, 'COMMIT_UNKNOWN');
  const unknownImport = await importMenu();
  assert.equal(unknownImport.status, 503);
  const importError = await unknownImport.json();
  assert.equal(importError.code, 'COMMIT_UNKNOWN');
  assert.match(importError.title, /ürünler ikinci kez eklenmez/);
});
