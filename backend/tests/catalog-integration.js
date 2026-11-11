import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { createAuthService } from '../src/auth/service.js';
import { createCatalogService } from '../src/catalog/service.js';
import { loadReferenceMenu } from '../src/catalog/reference.js';
import { withConnection } from '../src/database.js';

// Called only after integration.check.js has created/migrated a dedicated database
// on its temporary MySQL instance. Never read local credentials or touch the shop DB.
export async function checkCatalogFlows(config) {
  assert.equal(config.database, 'nar_catalog_integration');
  assert.equal(config.host, '127.0.0.1');
  assert.notEqual(config.port, 3306);
  const authService = createAuthService(config);
  const monitor = { status: () => ({ ready: true }) };
  const app = createApp(monitor, { authService, catalogService: createCatalogService(config) });
  const server = app.listen({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Nar-Request': '1', Origin: base };
  const request = (route, { cookie, data, extraHeaders = {}, method } = {}) => fetch(`${base}${route}`, {
    method: method ?? (data === undefined ? 'GET' : 'POST'),
    headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...extraHeaders },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: AbortSignal.timeout(20000)
  });
  const json = async response => {
    assert.equal(response.status, 200, await response.clone().text());
    return response.json();
  };
  const detail = async (id, cookie) => (await json(await request(`/api/catalog/products/${id}`, { cookie }))).product;
  const countState = () => withConnection(config, async connection => {
    const [[state]] = await connection.query(`SELECT
      (SELECT COUNT(*) FROM sale_option_versions) AS versions,
      (SELECT COUNT(*) FROM business_operations) AS operations,
      (SELECT COUNT(*) FROM audit_events) AS events,
      (SELECT SUM(revision) FROM products) AS revisions`);
    return state;
  });
  try {
    assert.equal((await request('/api/catalog/products')).status, 401);
    assert.equal((await request('/api/catalog/meta')).status, 401);
    assert.equal((await request('/api/catalog/reference-menu')).status, 401);
    assert.equal((await request('/api/catalog/reference-menu/import', { data: {} })).status, 401);
    const password = randomBytes(12).toString('base64url');
    const setup = await request('/api/auth/setup', { data: { loginName: 'catalog_owner', displayName: 'Katalog deneme yöneticisi', password } });
    assert.equal(setup.status, 201, await setup.clone().text());
    const owner = (await setup.json()).user;
    const ownerCookie = setup.headers.get('set-cookie').split(';')[0];
    const employee = await request('/api/users', { cookie: ownerCookie, data: {
      loginName: 'catalog_waiter', displayName: 'Katalog deneme garsonu', password, roleCodes: ['waiter']
    } });
    assert.equal(employee.status, 201, await employee.clone().text());
    const login = await request('/api/auth/login', { data: { loginName: 'catalog_waiter', password } });
    assert.equal(login.status, 200);
    const waiterCookie = login.headers.get('set-cookie').split(';')[0];
    for (const route of ['/api/catalog/products', '/api/catalog/meta', '/api/catalog/products/1', '/api/catalog/reference-menu']) {
      assert.equal((await request(route, { cookie: waiterCookie })).status, 403, 'Catalog reads require the server-side management permission');
    }
    assert.equal((await request('/api/catalog/reference-menu/import', { cookie: waiterCookie, data: {} })).status, 403);
    assert.equal((await request('/api/catalog/reference-menu/import', { cookie: ownerCookie, data: {}, extraHeaders: { Origin: 'https://other.invalid' } })).status, 403);
    const beforePreview = await countState();
    const preview = await json(await request('/api/catalog/reference-menu', { cookie: ownerCookie }));
    assert.equal(preview.productCount, 85); assert.equal(preview.optionCount, 94);
    assert.equal(preview.sourceDate, '2026-10-21');
    assert.equal(preview.categories.reduce((sum, category) => sum + category.productCount, 0), 85);
    assert.deepEqual(await countState(), beforePreview, 'Preview never creates business data');
    assert.equal((await request('/api/catalog/reference-menu/import', { cookie: ownerCookie, data: { actorId: owner.id } })).status, 400);
    assert.deepEqual(await countState(), beforePreview, 'Client cannot select an import actor or supply a different menu');

    const source = await loadReferenceMenu();
    assert.equal(source.products.length, 85);
    assert.equal(source.products.reduce((sum, product) => sum + product.options.length, 0), 94);
    const imports = await Promise.all([0, 1].map(() => request('/api/catalog/reference-menu/import', { cookie: ownerCookie, data: {} })));
    const importResults = await Promise.all(imports.map(json));
    assert.deepEqual(importResults.map(result => result.replayed).sort(), [false, true], 'Concurrent HTTP imports apply the source exactly once');
    const imported = importResults.find(result => !result.replayed);
    assert.equal(imported.productCount, 85);
    assert.equal(imported.optionCount, 94);
    assert.equal(imported.replayed, false);
    assert.equal(imported.sourceDate, '2026-10-21');
    await withConnection(config, async connection => {
      const [[totals]] = await connection.query(`SELECT (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM sale_options) AS options, (SELECT COUNT(*) FROM sale_option_versions) AS versions`);
      assert.deepEqual([Number(totals.products), Number(totals.options), Number(totals.versions)], [85, 94, 94]);
      const [snacks] = await connection.query(`SELECT p.code, p.stock_mode, u.code AS sale_unit, v.requires_weight,
        v.price_basis_quantity, v.content_quantity_base FROM products p JOIN sale_options o ON o.product_id=p.id
        JOIN sale_option_versions v ON v.sale_option_id=o.id JOIN units u ON u.id=v.sale_unit_id
        WHERE p.code LIKE 'menu:snacks-%' ORDER BY p.code`);
      assert.equal(snacks.length, 9);
      for (const row of snacks) {
        assert.equal(row.stock_mode, 'none'); assert.equal(row.sale_unit, 'g');
        assert.equal(Number(row.requires_weight), 1); assert.equal(Number(row.price_basis_quantity), 1000);
        assert.equal(row.content_quantity_base, null, 'An unverified serving size must not become a stock conversion');
      }
      const [colas] = await connection.query(`SELECT p.id, p.name, v.unit_price_minor FROM products p
        JOIN sale_options o ON o.product_id=p.id JOIN sale_option_versions v ON v.sale_option_id=o.id
        WHERE p.code IN ('menu:drinks-14','menu:drinks-17') ORDER BY p.code`);
      assert.equal(colas.length, 2); assert.notEqual(String(colas[0].id), String(colas[1].id));
      assert.deepEqual(colas.map(row => Number(row.unit_price_minor)), [7000, 4000]);
      assert.match(colas[0].name, /Kutu/); assert.match(colas[1].name, /Cam/);
      const [[invented]] = await connection.query(`SELECT
        (SELECT COUNT(*) FROM sale_option_versions WHERE content_quantity_base IS NOT NULL) AS measures,
        (SELECT COUNT(*) FROM products WHERE stock_mode <> 'none' OR preparation_station_id IS NOT NULL) AS tracking,
        (SELECT COUNT(*) FROM product_unit_conversions) AS conversions,
        (SELECT COUNT(*) FROM stock_movements) AS movements,
        (SELECT COUNT(*) FROM stock_lots) AS lots,
        (SELECT COUNT(*) FROM recipes) AS recipes,
        (SELECT COUNT(*) FROM sale_option_components) AS components`);
      for (const value of Object.values(invented)) assert.equal(Number(value), 0, 'Reference import seeds no unverified quantities, stock or recipes');
      const [rows] = await connection.query(`SELECT p.code, o.code AS option_code, v.unit_price_minor
        FROM products p JOIN sale_options o ON o.product_id=p.id JOIN sale_option_versions v ON v.sale_option_id=o.id`);
      for (const product of source.products) for (const option of product.options) {
        const row = rows.find(item => item.code === product.code && item.option_code === option.code);
        assert.ok(row, `Missing source option ${product.code}/${option.code}`);
        assert.equal(Number(row.unit_price_minor), Number(option.unitPriceMinor));
      }
    });

    const meta = await json(await request('/api/catalog/meta', { cookie: ownerCookie }));
    assert.equal(meta.categories.length, 5);
    const page1 = await json(await request('/api/catalog/products?status=all&pageSize=7&page=1', { cookie: ownerCookie }));
    const page2 = await json(await request('/api/catalog/products?status=all&pageSize=7&page=2', { cookie: ownerCookie }));
    assert.equal(page1.total, 85); assert.equal(page1.products.length, 7); assert.equal(page1.page, 1); assert.equal(page1.pageSize, 7);
    assert.equal(page2.total, 85); assert.equal(page2.products.length, 7);
    assert.ok(page2.products.every(product => !page1.products.some(previous => previous.id === product.id)), 'Pagination must have a stable unique order');
    const tea = await json(await request(`/api/catalog/products?search=${encodeURIComponent('çay')}&status=all`, { cookie: ownerCookie }));
    assert.ok(tea.products.some(product => product.name === 'Çay'), 'Turkish lower-case search finds Çay');
    const turnip = await json(await request(`/api/catalog/products?search=${encodeURIComponent('ŞALGAM')}&status=all`, { cookie: ownerCookie }));
    assert.ok(turnip.products.some(product => product.name === 'Şalgam'));
    const kola = await json(await request('/api/catalog/products?search=kola&status=all', { cookie: ownerCookie }));
    assert.ok(kola.products.some(product => product.name === 'Kutu Kola'));
    assert.ok(kola.products.some(product => product.name === 'Cam Kola'));
    const category = meta.categories.find(item => item.name === 'Çerezler');
    assert.ok(category);
    const nuts = await json(await request(`/api/catalog/products?categoryId=${category.id}&status=all`, { cookie: ownerCookie }));
    assert.equal(nuts.total, 9);
    assert.ok(nuts.products.every(product => String(product.categoryId) === String(category.id)));

    const chosen = await withConnection(config, async connection => {
      const [[product]] = await connection.query("SELECT id FROM products WHERE code='menu:foods-01'"); return String(product.id);
    });
    let product = await detail(chosen, ownerCookie);
    const option = product.options[0];
    assert.ok(option.currentVersion && option.versions.length === 1);
    const previousVersion = option.currentVersion;
    const oldRevision = product.revision;
    const priceRoute = `/api/catalog/products/${chosen}/prices`;
    const priceData = { requestKey: randomUUID(), revision: product.revision, optionId: option.id, priceMinor: String(Number(previousVersion.unitPriceMinor) + 123) };
    assert.equal((await request(priceRoute, { data: priceData })).status, 401);
    assert.equal((await request(priceRoute, { cookie: waiterCookie, data: priceData })).status, 403);
    assert.equal((await request(priceRoute, { cookie: ownerCookie, data: priceData, extraHeaders: { 'X-Nar-Request': '' } })).status, 403);
    assert.equal((await request(priceRoute, { cookie: ownerCookie, data: priceData, extraHeaders: { Origin: 'https://example.invalid' } })).status, 403);
    assert.equal((await request(`/api/catalog/products/${chosen}`, { cookie: ownerCookie, method: 'PATCH',
      data: { requestKey: randomUUID(), revision: product.revision, name: product.name, categoryId: product.categoryId, isActive: true },
      extraHeaders: { 'X-Nar-Request': '' } })).status, 403);

    // Existing recipes/components are immutable parts of a sale version. A pure
    // price edit must preserve them without making a new recipe or changing history.
    const links = await withConnection(config, async connection => {
      const [[component]] = await connection.query("SELECT id FROM products WHERE code='menu:drinks-01'");
      await connection.execute('INSERT INTO sale_option_components(option_version_id,component_product_id,quantity_base) VALUES (?,?,?)', [previousVersion.id, component.id, '2.500000']);
      const [recipe] = await connection.execute('INSERT INTO recipes(product_id,name) VALUES (?,?)', [chosen, 'Yalnızca test reçetesi']);
      const [version] = await connection.execute('INSERT INTO recipe_versions(recipe_id,product_id,version,output_quantity_base,created_by) VALUES (?,?,1,1,?)', [recipe.insertId, chosen, owner.id]);
      await connection.execute('INSERT INTO sale_option_recipes(option_version_id,recipe_version_id,product_id,recipe_multiplier) VALUES (?,?,?,?)', [previousVersion.id, version.insertId, chosen, '0.500000']);
      return { componentId: String(component.id), recipeVersionId: String(version.insertId) };
    });
    const beforePrice = await countState();
    const [change, simultaneousReplay] = await Promise.all([
      request(priceRoute, { cookie: ownerCookie, data: priceData }), request(priceRoute, { cookie: ownerCookie, data: priceData })
    ]);
    const changed = await json(change);
    assert.deepEqual(await json(simultaneousReplay), changed, 'Concurrent repeat with the same key returns the stored result');
    product = changed.product;
    assert.equal(BigInt(product.revision), BigInt(oldRevision) + 1n);
    const changedOption = product.options.find(item => item.id === option.id);
    assert.equal(changedOption.currentVersion.unitPriceMinor, priceData.priceMinor);
    assert.equal(changedOption.currentVersion.version, previousVersion.version + 1);
    assert.equal(changedOption.versions.length, 2);
    assert.equal(changedOption.versions.find(item => item.id === previousVersion.id).unitPriceMinor, previousVersion.unitPriceMinor);
    const afterPrice = await countState();
    assert.equal(Number(afterPrice.versions), Number(beforePrice.versions) + 1);
    assert.equal(Number(afterPrice.operations), Number(beforePrice.operations) + 1);
    assert.equal(Number(afterPrice.events), Number(beforePrice.events) + 1);
    await withConnection(config, async connection => {
      const [components] = await connection.execute('SELECT component_product_id,quantity_base FROM sale_option_components WHERE option_version_id=?', [changedOption.currentVersion.id]);
      assert.equal(components.length, 1); assert.equal(String(components[0].component_product_id), links.componentId); assert.equal(Number(components[0].quantity_base), 2.5);
      const [[recipe]] = await connection.execute('SELECT recipe_version_id,recipe_multiplier FROM sale_option_recipes WHERE option_version_id=?', [changedOption.currentVersion.id]);
      assert.equal(String(recipe.recipe_version_id), links.recipeVersionId); assert.equal(Number(recipe.recipe_multiplier), 0.5);
    });
    const replay = await json(await request(priceRoute, { cookie: ownerCookie, data: priceData }));
    assert.deepEqual(replay, changed);
    const reused = await request(priceRoute, { cookie: ownerCookie, data: { ...priceData, priceMinor: '999' } });
    assert.equal(reused.status, 409); assert.equal((await reused.json()).code, 'REQUEST_KEY_REUSED');
    const stale = await request(priceRoute, { cookie: ownerCookie, data: { ...priceData, requestKey: randomUUID() } });
    assert.equal(stale.status, 409); assert.equal((await stale.json()).code, 'REVISION_CONFLICT');
    assert.deepEqual(await countState(), afterPrice, 'Replay, key conflict and stale revision leave no extra writes');

    const reimported = await json(await request('/api/catalog/reference-menu/import', { cookie: ownerCookie, data: {} }));
    assert.equal(reimported.replayed, true);
    assert.deepEqual(await countState(), afterPrice, 'Repeating the source import never overwrites an operator price edit');
    assert.equal((await detail(chosen, ownerCookie)).options.find(item => item.id === option.id).currentVersion.unitPriceMinor, priceData.priceMinor);

    const updateRoute = `/api/catalog/products/${chosen}`;
    const updateData = { requestKey: randomUUID(), revision: product.revision, name: `${product.name} Deneme`, categoryId: product.categoryId, isActive: false };
    const deactivated = await json(await request(updateRoute, { cookie: ownerCookie, method: 'PATCH', data: updateData }));
    assert.equal(deactivated.product.isActive, false); assert.equal(deactivated.product.name, updateData.name);
    assert.equal(BigInt(deactivated.product.revision), BigInt(product.revision) + 1n);
    assert.deepEqual(await json(await request(updateRoute, { cookie: ownerCookie, method: 'PATCH', data: updateData })), deactivated);
    const inactive = await json(await request('/api/catalog/products?status=inactive', { cookie: ownerCookie }));
    assert.equal(inactive.total, 1); assert.equal(inactive.products[0].id, chosen);
    const active = await json(await request('/api/catalog/products?status=active', { cookie: ownerCookie }));
    assert.equal(active.total, 84); assert.ok(active.products.every(item => item.id !== chosen));
    const staleName = await request(updateRoute, { cookie: ownerCookie, method: 'PATCH', data: { ...updateData, requestKey: randomUUID(), name: 'Eski ekrandan gelen ad' } });
    assert.equal(staleName.status, 409); assert.equal((await staleName.json()).code, 'REVISION_CONFLICT');

    const beforeInvalid = await countState();
    for (const bad of ['-1', '1.5', '1e3', '10000000000', true, null]) {
      const response = await request(priceRoute, { cookie: ownerCookie, data: {
        requestKey: randomUUID(), revision: deactivated.product.revision, optionId: option.id, priceMinor: bad
      } });
      assert.equal(response.status, 400, `Reject invalid price ${String(bad)}`);
    }
    for (const data of [
      { ...updateData, requestKey: randomUUID(), revision: deactivated.product.revision, name: '' },
      { ...updateData, requestKey: randomUUID(), revision: deactivated.product.revision, categoryId: '999999999999' },
      { ...updateData, requestKey: randomUUID(), revision: deactivated.product.revision, isActive: 'false' }
    ]) {
      const response = await request(updateRoute, { cookie: ownerCookie, method: 'PATCH', data });
      assert.equal(response.status, 400, await response.clone().text());
    }
    assert.deepEqual(await countState(), beforeInvalid, 'Invalid input rolls back the operation, audit, product and price as one unit');
    assert.equal((await detail(chosen, ownerCookie)).name, deactivated.product.name);
    const notFound = await request('/api/catalog/products/999999999999', { cookie: ownerCookie });
    assert.equal(notFound.status, 404);
    for (const query of ['page=0', 'pageSize=10000', 'status=unexpected', 'categoryId=invalid']) {
      assert.equal((await request(`/api/catalog/products?${query}`, { cookie: ownerCookie })).status, 400);
    }

    // Future prices are history until their validity time. They must neither
    // replace today's display nor be silently superseded by another price edit.
    const futureVersionId = await withConnection(config, async connection => {
      const [future] = await connection.execute(`INSERT INTO sale_option_versions(sale_option_id, product_id, version,
        sale_unit_id, unit_price_minor, price_basis_quantity, content_quantity_base, requires_weight, valid_from_utc, created_by)
        SELECT sale_option_id, product_id, version + 1, sale_unit_id, ?, price_basis_quantity,
          content_quantity_base, requires_weight, TIMESTAMPADD(DAY, 1, UTC_TIMESTAMP(6)), ?
        FROM sale_option_versions WHERE id = ?`, ['77777', owner.id, changedOption.currentVersion.id]);
      return String(future.insertId);
    });
    const futureDetail = await detail(chosen, ownerCookie);
    const futureOption = futureDetail.options.find(item => item.id === option.id);
    assert.equal(futureOption.currentVersion.id, changedOption.currentVersion.id);
    assert.equal(futureOption.currentVersion.unitPriceMinor, priceData.priceMinor);
    assert.equal(futureOption.versions[0].id, futureVersionId);
    assert.equal(futureOption.versions[0].unitPriceMinor, '77777');
    const futureListing = await json(await request(`/api/catalog/products?search=${encodeURIComponent('menu:foods-01')}&status=all`, { cookie: ownerCookie }));
    const listedFutureOption = futureListing.products.find(item => item.id === chosen).options.find(item => item.id === option.id);
    assert.equal(listedFutureOption.currentVersion.id, changedOption.currentVersion.id);
    assert.equal(listedFutureOption.currentVersion.unitPriceMinor, priceData.priceMinor);
    const beforeFutureEdit = await countState();
    const futureEdit = await request(priceRoute, { cookie: ownerCookie, data: {
      requestKey: randomUUID(), revision: futureDetail.revision, optionId: option.id, priceMinor: '88888'
    } });
    assert.equal(futureEdit.status, 409);
    assert.equal((await futureEdit.json()).code, 'FUTURE_PRICE_EXISTS');
    assert.deepEqual(await countState(), beforeFutureEdit, 'A scheduled latest version blocks edits without creating an operation or price version');

    const serialized = JSON.stringify({ meta, changed, deactivated });
    for (const hidden of [password, ownerCookie.split('=')[1], 'password_hash', 'nar_test']) assert.ok(!serialized.includes(hidden));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
