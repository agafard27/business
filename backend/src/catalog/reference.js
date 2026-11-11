import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { withConnection, dbError } from '../database.js';

const sourcePath = new URL('../../../docs/planlama/menu-urunleri.json', import.meta.url);
const conflict = () => Object.assign(new Error(), { status: 409, code: 'REFERENCE_IMPORT_CONFLICT',
  title: 'Menü aktarımı mevcut kayıtlarla çakışıyor. Hiçbir ürün değiştirilmedi.' });
const forbidden = () => Object.assign(new Error(), { status: 403, code: 'FORBIDDEN',
  title: 'Menü aktarımı için etkin bir yetkili hesap gerekir.' });

function deterministicUuid(hex) {
  const bytes = Buffer.from(hex.slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x80; // UUID v8: application-defined SHA-256 payload.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = bytes.toString('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

// Only verified source prices are normalized. Count means one sale choice;
// it does not assert a cup volume, serving mass, recipe or stock conversion.
export async function loadReferenceMenu() {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const categories = source.kategoriler.map((category, index) => ({
    code: category.yol.slice(1), name: category.ad, sortOrder: index * 10
  }));
  const categoryCodes = new Map(categories.map(category => [category.name, category.code]));
  // Preparation is an initial classification only; no station or recipe is asserted.
  const preparedDrinks = new Set(['drinks-04', 'drinks-09', 'drinks-10', 'drinks-11', 'drinks-12', 'drinks-13', 'drinks-16']);
  const products = source.urunler.map(product => {
    const sourceId = product.kaynakKimligi;
    const weighted = product.kaynakYolu === '/snacks' && product.satisBirimi === 'kg';
    const categoryCode = categoryCodes.get(product.kategori);
    if (!categoryCode || !new RegExp(`^${categoryCode}-[0-9]{2}$`).test(sourceId)
      || !product.ad || !product.fiyatSecenekleri?.length
      || (product.kaynakYolu === '/snacks' && !weighted)) throw new Error('INVALID_REFERENCE_MENU');
    return {
      sourceId, code: `menu:${sourceId}`, sourceName: product.ad,
      name: sourceId === 'drinks-14' ? 'Kutu Kola' : sourceId === 'drinks-17' ? 'Cam Kola' : product.ad,
      categoryCode,
      productType: ['foods', 'aperatifs'].includes(categoryCode) || preparedDrinks.has(sourceId) ? 'prepared' : 'ready',
      stockMode: 'none', baseUnitCode: weighted ? 'g' : 'adet',
      options: product.fiyatSecenekleri.map((option, index) => {
        if (!Number.isSafeInteger(option.fiyatKurus) || option.fiyatKurus < 0) throw new Error('INVALID_REFERENCE_PRICE');
        return { code: `option-${String(index + 1).padStart(2, '0')}`, name: option.ad || 'Standart',
          unitCode: weighted ? 'g' : 'adet', unitPriceMinor: option.fiyatKurus,
          priceBasisQuantity: weighted ? 1000 : 1, requiresWeight: weighted };
      })
    };
  });
  if (products.length !== 85 || products.flatMap(product => product.options).length !== 94
    || new Set(products.map(product => product.sourceId)).size !== 85 || categories.length !== 5
    || source.kontrolTarihi !== '2026-10-21') throw new Error('INVALID_REFERENCE_MENU');
  const normalized = { sourceDate: source.kontrolTarihi, sourceUrl: source.kaynak, categories,
    units: [{ code: 'adet', name: 'Adet', dimension: 'count', decimalPlaces: 0 },
      { code: 'g', name: 'Gram', dimension: 'mass', decimalPlaces: 0 }], products };
  const sourceHash = createHash('sha256').update('nar-cicegi:reference-menu:v1\n').update(JSON.stringify(normalized)).digest('hex');
  return { ...normalized, sourceHash, requestKey: deterministicUuid(sourceHash) };
}

async function assertActor(connection, actorUserId) {
  if (!/^[1-9][0-9]{0,19}$/.test(String(actorUserId))) throw forbidden();
  const [users] = await connection.execute('SELECT id FROM app_users WHERE id = ? AND is_active = TRUE FOR UPDATE', [String(actorUserId)]);
  if (!users.length) throw forbidden();
  const [access] = await connection.execute(`SELECT r.code AS role_code, p.code AS permission_code,
    rp.requires_approval, rp.amount_limit_minor FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = ?`, [String(actorUserId)]);
  if (!access.some(row => row.role_code === 'owner' || (row.permission_code === 'catalog.manage'
    && !Number(row.requires_approval) && row.amount_limit_minor === null))) throw forbidden();
}

// Explicit command only: runtime startup never imports or edits business data.
// The named lock serializes import attempts and the complete write is atomic.
// Replaying a completed import never resets later user changes or price versions.
export async function applyReferenceMenu(config, actorUserId) {
  const menu = await loadReferenceMenu();
  let commitStarted = false;
  try {
    return await withConnection(config, async connection => {
      let locked = false;
      try {
        const lockName = `${config.database}:reference-menu`;
        const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
        if (Number(lock.acquired) !== 1) throw Object.assign(new Error(), { status: 409, code: 'REFERENCE_IMPORT_BUSY',
          title: 'Menü aktarımı başka bir işlemde sürüyor.' });
        locked = true;
        await connection.beginTransaction();
        await assertActor(connection, actorUserId);
        const [operations] = await connection.execute(`SELECT request_hash, operation_type, status, result_json
          FROM business_operations WHERE request_key = ? FOR UPDATE`, [menu.requestKey]);
        if (operations.length) {
          const operation = operations[0];
          const saved = typeof operation.result_json === 'string' ? JSON.parse(operation.result_json) : operation.result_json;
          if (operation.operation_type !== 'catalog.reference_import' || operation.status !== 'completed'
            || !Buffer.from(operation.request_hash).equals(Buffer.from(menu.sourceHash, 'hex'))
            || saved?.productCount !== 85 || saved?.optionCount !== 94 || saved?.sourceDate !== menu.sourceDate) throw conflict();
          await connection.rollback();
          return { ...saved, replayed: true };
        }
        // A matching product without this import's completed operation is not owned
        // by the importer. Reject even a partial collision rather than skip records.
        const codes = menu.products.map(product => product.code);
        const [collisions] = await connection.execute(`SELECT id FROM products WHERE code IN (${codes.map(() => '?').join(',')}) LIMIT 1`, codes);
        if (collisions.length) throw conflict();
        const [operation] = await connection.execute(`INSERT INTO business_operations
          (request_key, request_hash, operation_type, actor_user_id) VALUES (?, ?, 'catalog.reference_import', ?)`,
        [menu.requestKey, Buffer.from(menu.sourceHash, 'hex'), String(actorUserId)]);
        const unitIds = new Map();
        for (const unit of menu.units) {
          await connection.execute(`INSERT INTO units(code, name, dimension, decimal_places) VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE id = units.id`, [unit.code, unit.name, unit.dimension, unit.decimalPlaces]);
          const [[saved]] = await connection.execute('SELECT id, dimension, decimal_places FROM units WHERE code = ?', [unit.code]);
          if (saved.dimension !== unit.dimension || Number(saved.decimal_places) !== unit.decimalPlaces) throw conflict();
          unitIds.set(unit.code, saved.id);
        }
        const categoryIds = new Map();
        for (const category of menu.categories) {
          await connection.execute(`INSERT INTO product_categories(name, sort_order) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE id = product_categories.id`, [category.name, category.sortOrder]);
          const [[saved]] = await connection.execute('SELECT id FROM product_categories WHERE name = ?', [category.name]);
          categoryIds.set(category.code, saved.id);
        }
        for (const product of menu.products) {
          const [inserted] = await connection.execute(`INSERT INTO products
            (code, name, category_id, product_type, stock_mode, stock_timing, base_unit_id)
            VALUES (?, ?, ?, ?, 'none', 'manual', ?)`,
          [product.code, product.name, categoryIds.get(product.categoryCode), product.productType, unitIds.get(product.baseUnitCode)]);
          for (const option of product.options) {
            const [saleOption] = await connection.execute('INSERT INTO sale_options(product_id, code, name) VALUES (?, ?, ?)',
              [inserted.insertId, option.code, option.name]);
            await connection.execute(`INSERT INTO sale_option_versions
              (sale_option_id, product_id, version, sale_unit_id, unit_price_minor, price_basis_quantity, requires_weight, valid_from_utc, created_by)
              VALUES (?, ?, 1, ?, ?, ?, ?, UTC_TIMESTAMP(6), ?)`,
            [saleOption.insertId, inserted.insertId, unitIds.get(option.unitCode), option.unitPriceMinor,
              option.priceBasisQuantity, option.requiresWeight, String(actorUserId)]);
          }
        }
        const result = { productCount: menu.products.length, optionCount: menu.products.reduce((count, product) => count + product.options.length, 0),
          replayed: false, sourceDate: menu.sourceDate };
        await connection.execute(`UPDATE business_operations SET status = 'completed', result_json = ?,
          completed_at_utc = UTC_TIMESTAMP(6) WHERE id = ?`, [JSON.stringify(result), operation.insertId]);
        await connection.execute(`INSERT INTO audit_events(operation_id, actor_user_id, action_code, outcome, metadata_json)
          VALUES (?, ?, 'catalog.reference_import', 'succeeded', ?)`,
        [operation.insertId, String(actorUserId), JSON.stringify({ sourceDate: menu.sourceDate, sourceHash: menu.sourceHash,
          productCount: result.productCount, optionCount: result.optionCount })]);
        await connection.execute("INSERT INTO outbox_events(operation_id,event_type,payload_json) VALUES (?,'catalog.reference_import',?)",[operation.insertId,JSON.stringify({sourceDate:menu.sourceDate})]);
        commitStarted = true;
        await connection.commit();
        return result;
      } catch (error) {
        if (commitStarted) throw dbError('COMMIT_UNKNOWN');
        try { await connection.rollback(); } catch { /* Discarded connection. */ }
        if (error.code === 'ER_DUP_ENTRY') throw conflict();
        throw error;
      } finally {
        if (locked) {
          try { await connection.execute('SELECT RELEASE_LOCK(?)', [`${config.database}:reference-menu`]); } catch { }
        }
      }
    }, 30000);
  } catch (error) {
    if (commitStarted && !error.status) throw dbError('COMMIT_UNKNOWN');
    throw error;
  }
}
