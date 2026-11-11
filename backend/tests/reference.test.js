import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadReferenceMenu } from '../src/catalog/reference.js';

const source = JSON.parse(await readFile(new URL('../../docs/planlama/menu-urunleri.json', import.meta.url), 'utf8'));

test('referans menü 85 kimliği ve 94 gerçek kaynak fiyatını kayıpsız korur', async () => {
  const menu = await loadReferenceMenu();
  assert.equal(menu.sourceDate, '2026-10-21');
  assert.equal(menu.products.length, 85);
  assert.equal(menu.products.flatMap(product => product.options).length, 94);
  assert.equal(new Set(menu.products.map(product => product.code)).size, 85);
  const counts = Object.fromEntries(menu.categories.map(category => [category.name,
    menu.products.filter(product => product.categoryCode === category.code).length]));
  assert.deepEqual(counts, { Yemekler: 5, İçecekler: 36, Çerezler: 9, Aparatifler: 4, Dondurmalar: 31 });
  for (const original of source.urunler) {
    const product = menu.products.find(item => item.sourceId === original.kaynakKimligi);
    assert.ok(product);
    assert.equal(product.sourceName, original.ad);
    assert.deepEqual(product.options.map(option => option.unitPriceMinor), original.fiyatSecenekleri.map(option => option.fiyatKurus));
    assert.equal(new Set(product.options.map(option => option.code)).size, product.options.length);
    assert.ok(product.options.every(option => Number.isSafeInteger(option.unitPriceMinor) && option.unitPriceMinor >= 0));
  }
  assert.match(menu.sourceHash, /^[0-9a-f]{64}$/);
  assert.match(menu.requestKey, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const again = await loadReferenceMenu();
  assert.equal(again.sourceHash, menu.sourceHash);
  assert.equal(again.requestKey, menu.requestKey);
});

test('çerez fiyatları kilogram fiyatı olarak korunur; satış gram üzerinden hesaplanır', async () => {
  const menu = await loadReferenceMenu();
  const nuts = menu.products.filter(product => product.categoryCode === 'snacks');
  assert.equal(nuts.length, 9);
  assert.ok(nuts.every(product => product.baseUnitCode === 'g' && product.options.every(option =>
    option.unitCode === 'g' && option.requiresWeight && option.priceBasisQuantity === 1000)));
  const corn = nuts.find(product => product.sourceId === 'snacks-08').options[0];
  assert.equal(corn.unitPriceMinor, 17500);
  assert.equal(corn.unitPriceMinor * 200 / corn.priceBasisQuantity, 3500);
  assert.ok(menu.products.filter(product => product.categoryCode !== 'snacks').every(product =>
    product.options.every(option => !option.requiresWeight && option.priceBasisQuantity === 1)));
});

test('Kola kimlikleri, servis adları ve kaynakta bulunan boyutlar korunur; örnekler eklenmez', async () => {
  const menu = await loadReferenceMenu();
  const can = menu.products.find(product => product.sourceId === 'drinks-14');
  const glass = menu.products.find(product => product.sourceId === 'drinks-17');
  assert.equal(can.name, 'Kutu Kola'); assert.equal(can.options[0].unitPriceMinor, 7000);
  assert.equal(glass.name, 'Cam Kola'); assert.equal(glass.options[0].unitPriceMinor, 4000);
  assert.notEqual(can.code, glass.code);
  assert.deepEqual(menu.products.find(product => product.sourceId === 'foods-01').options.map(option => option.name), ['Dürüm', 'Porsiyon']);
  assert.deepEqual(menu.products.find(product => product.sourceId === 'dondurma-01').options.map(option => option.name), ['Tam', 'Yarım']);
  assert.equal(menu.products.find(product => product.sourceId === 'drinks-02').name, 'Nar Suyu (500ml)');
  assert.equal(menu.products.find(product => product.sourceId === 'drinks-03').name, 'Nar Suyu (1.5L)');
  assert.ok(!menu.products.some(product => product.name.includes('PET') || product.name.includes('gramla')));
  assert.ok(menu.products.every(product => product.stockMode === 'none'));
});
