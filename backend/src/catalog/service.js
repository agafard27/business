import { createHash } from 'node:crypto';
import { dbError, withConnection } from '../database.js';
import { catalogError, identifier, listingInput, priceInput, productInput } from './validation.js';
import { applyReferenceMenu, loadReferenceMenu } from './reference.js';

const notFound = () => catalogError(404, 'PRODUCT_NOT_FOUND', 'Ürün bulunamadı.');
const revisionConflict = () => catalogError(409, 'REVISION_CONFLICT', 'Bu ürün başka bir işlemde değişti. Güncel bilgileri yükleyip yeniden düzenleyin.');
const productSelect = `SELECT p.id, p.code, p.name, p.category_id, c.name AS category_name,
  p.product_type, p.stock_mode, p.base_unit_id, p.is_active, p.revision
  FROM products p LEFT JOIN product_categories c ON c.id = p.category_id`;

function productDto(row) {
  return { id: String(row.id), code: row.code, name: row.name,
    categoryId: row.category_id === null ? null : String(row.category_id), categoryName: row.category_name,
    productType: row.product_type, stockMode: row.stock_mode,
    baseUnitId: row.base_unit_id === null ? null : String(row.base_unit_id),
    isActive: Boolean(row.is_active), revision: String(row.revision), options: [] };
}

function versionDto(row) {
  return { id: String(row.version_id), version: Number(row.version), unitPriceMinor: String(row.unit_price_minor),
    priceBasisQuantity: String(row.price_basis_quantity), contentQuantityBase: row.content_quantity_base === null ? null : String(row.content_quantity_base),
    requiresWeight: Boolean(row.requires_weight), saleUnitId: String(row.sale_unit_id), saleUnitCode: row.unit_code,
    saleUnitName: row.unit_name, validFromUtc: row.valid_from_utc instanceof Date ? row.valid_from_utc.toISOString() : row.valid_from_utc };
}

async function attachOptions(connection, products, history = false) {
  if (!products.length) return products;
  const params = products.map(product => product.id);
  const [rows] = await connection.execute(`SELECT o.id, o.product_id, o.code, o.name, o.is_active,
    v.id AS version_id, v.version, v.unit_price_minor, v.price_basis_quantity, v.content_quantity_base,
    v.requires_weight, v.sale_unit_id, u.code AS unit_code, u.name AS unit_name, v.valid_from_utc,
    (v.valid_from_utc <= UTC_TIMESTAMP(6)) AS is_currently_valid
    FROM sale_options o LEFT JOIN sale_option_versions v ON ${history ? 'v.sale_option_id = o.id' : `v.id =
      (SELECT cv.id FROM sale_option_versions cv WHERE cv.sale_option_id = o.id
        AND cv.valid_from_utc <= UTC_TIMESTAMP(6) ORDER BY cv.version DESC LIMIT 1)`}
    LEFT JOIN units u ON u.id = v.sale_unit_id WHERE o.product_id IN (${params.map(() => '?').join(',')})
    ORDER BY o.product_id, o.id, v.version DESC`, params);
  const owners = new Map(products.map(product => [product.id, product]));
  const options = new Map();
  for (const row of rows) {
    const optionId = String(row.id);
    let option = options.get(optionId);
    if (!option) {
      option = { id: optionId, code: row.code, name: row.name, isActive: Boolean(row.is_active), currentVersion: null };
      if (history) option.versions = [];
      options.set(optionId, option);
      owners.get(String(row.product_id)).options.push(option);
    }
    if (row.version_id !== null) {
      const version = versionDto(row);
      if (history) option.versions.push(version);
      if (!option.currentVersion && Number(row.is_currently_valid) === 1) option.currentVersion = version;
    }
  }
  return products;
}

async function readProduct(connection, id) {
  const [rows] = await connection.execute(`${productSelect} WHERE p.id = ?`, [id]);
  if (!rows.length) throw notFound();
  return (await attachOptions(connection, [productDto(rows[0])], true))[0];
}

// Reads use one consistent snapshot so revision and price cannot come from different commits.
async function snapshot(config, action) {
  return withConnection(config, async connection => {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    try {
      const result = await action(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try { await connection.rollback(); } catch { }
      throw error;
    }
  });
}

export function createCatalogService(config) {
  const read = action => snapshot(config, action);

  async function transaction(action) {
    let commitStarted = false;
    try {
      return await withConnection(config, async connection => {
        try {
          await connection.beginTransaction();
          const result = await action(connection);
          commitStarted = true;
          await connection.commit();
          return result;
        } catch (error) {
          if (commitStarted) throw dbError('COMMIT_UNKNOWN');
          try { await connection.rollback(); } catch { }
          throw error;
        }
      }, 12000);
    } catch (error) {
      if (commitStarted) throw dbError('COMMIT_UNKNOWN');
      throw error;
    }
  }

  async function operate(type, productId, values, actorId, action) {
    const { requestKey, ...payload } = values;
    const hash = createHash('sha256').update(JSON.stringify({ type, productId, actorId, payload })).digest();
    return transaction(async connection => {
      let operationId;
      try {
        const [created] = await connection.execute(`INSERT INTO business_operations(request_key, request_hash, operation_type, actor_user_id)
          VALUES (?, ?, ?, ?)`, [requestKey, hash, type, actorId]);
        operationId = String(created.insertId);
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        // The UNIQUE request key serializes concurrent duplicate requests through commit.
        const [[existing]] = await connection.execute(`SELECT request_hash, status, result_json FROM business_operations
          WHERE request_key = ? FOR UPDATE`, [requestKey]);
        if (!existing || !Buffer.from(existing.request_hash).equals(hash)) {
          throw catalogError(409, 'REQUEST_KEY_REUSED', 'Bu işlem kimliği farklı bir kayıt için kullanılmış. Güncel bilgileri yükleyin.');
        }
        if (existing.status !== 'completed' || existing.result_json === null) {
          throw catalogError(409, 'OPERATION_PENDING', 'Bu işlemin sonucu henüz hazır değil. Ürünü yenileyerek kontrol edin.');
        }
        return typeof existing.result_json === 'string' ? JSON.parse(existing.result_json) : existing.result_json;
      }
      const [[product]] = await connection.execute('SELECT id, revision, name, category_id, is_active FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (!product) throw notFound();
      if (String(product.revision) !== values.revision) throw revisionConflict();
      const metadata = await action(connection, product);
      await connection.execute('UPDATE products SET revision = revision + 1 WHERE id = ?', [productId]);
      await connection.execute(`INSERT INTO audit_events(operation_id, actor_user_id, action_code, outcome, metadata_json)
        VALUES (?, ?, ?, 'succeeded', ?)`, [operationId, actorId, type, JSON.stringify({ productId, ...metadata })]);
      const result = { product: await readProduct(connection, productId) };
      await connection.execute('INSERT INTO outbox_events(operation_id,event_type,payload_json) VALUES (?,?,?)',[operationId,type,JSON.stringify({productId})]);
      await connection.execute(`UPDATE business_operations SET status = 'completed', result_json = ?, completed_at_utc = UTC_TIMESTAMP(6)
        WHERE id = ?`, [JSON.stringify(result), operationId]);
      return result;
    });
  }

  return {
    async referenceMenu() {
      const menu = await loadReferenceMenu();
      return { sourceDate: menu.sourceDate, productCount: menu.products.length,
        optionCount: menu.products.reduce((sum, product) => sum + product.options.length, 0),
        categories: menu.categories.map(category => ({ name: category.name,
          productCount: menu.products.filter(product => product.categoryCode === category.code).length })) };
    },
    async importReferenceMenu(input, actorId) {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) {
        throw catalogError(400, 'INVALID_INPUT', 'Menü aktarımı isteği geçersiz.');
      }
      return applyReferenceMenu(config, identifier(actorId));
    },
    async meta() {
      return read(async connection => {
        const [categories] = await connection.query('SELECT id, name, is_active FROM product_categories ORDER BY sort_order, name, id');
        const [units] = await connection.query('SELECT id, code, name, dimension, decimal_places FROM units ORDER BY name, id');
        return { categories: categories.map(row => ({ id: String(row.id), name: row.name, isActive: Boolean(row.is_active) })),
          units: units.map(row => ({ id: String(row.id), code: row.code, name: row.name, dimension: row.dimension, decimalPlaces: Number(row.decimal_places) })) };
      });
    },
    async listProducts(query) {
      const values = listingInput(query);
      return read(async connection => {
        const where = [];
        const params = [];
        if (values.status !== 'all') { where.push('p.is_active = ?'); params.push(values.status === 'active' ? 1 : 0); }
        if (values.categoryId) { where.push('p.category_id = ?'); params.push(values.categoryId); }
        if (values.search) {
          // MySQL accent-insensitive collation handles ç/ğ/ö/ş/ü; explicitly fold dotless ı too.
          const pattern = `%${values.search.replaceAll('=', '==').replaceAll('%', '=%').replaceAll('_', '=_')}%`;
          where.push(`(LOWER(REPLACE(p.name COLLATE utf8mb4_0900_ai_ci, 'ı', 'i')) LIKE ? ESCAPE '=' OR
            LOWER(REPLACE(p.code COLLATE utf8mb4_0900_ai_ci, 'ı', 'i')) LIKE ? ESCAPE '=')`);
          params.push(pattern, pattern);
        }
        const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
        const [[count]] = await connection.execute(`SELECT COUNT(*) AS total FROM products p${filter}`, params);
        // LIMIT values are validated integers, avoiding server/prepared-statement integer coercion differences.
        const [rows] = await connection.execute(`${productSelect}${filter} ORDER BY c.sort_order, p.name, p.id
          LIMIT ${values.pageSize} OFFSET ${(values.page - 1) * values.pageSize}`, params);
        return { products: await attachOptions(connection, rows.map(productDto)), total: Number(count.total), page: values.page, pageSize: values.pageSize };
      });
    },
    async getProduct(id) {
      id = identifier(id);
      return read(async connection => ({ product: await readProduct(connection, id) }));
    },
    async updateProduct(id, input, actorId) {
      id = identifier(id); actorId = identifier(actorId);
      const values = productInput(input);
      return operate('catalog.product.update', id, values, actorId, async (connection, current) => {
        if (values.categoryId !== null) {
          const [[category]] = await connection.execute('SELECT id, is_active FROM product_categories WHERE id = ? FOR SHARE', [values.categoryId]);
          if (!category || (!category.is_active && String(current.category_id) !== values.categoryId)) {
            throw catalogError(400, 'INVALID_CATEGORY', 'Seçilen kategori kullanımda değil veya bulunamadı.');
          }
        }
        await connection.execute('UPDATE products SET name = ?, category_id = ?, is_active = ? WHERE id = ?',
          [values.name, values.categoryId, values.isActive, id]);
        return { before: { name: current.name, categoryId: current.category_id === null ? null : String(current.category_id), isActive: Boolean(current.is_active) },
          after: { name: values.name, categoryId: values.categoryId, isActive: values.isActive } };
      });
    },
    async updatePrice(id, input, actorId) {
      id = identifier(id); actorId = identifier(actorId);
      const values = priceInput(input);
      return operate('catalog.price.update', id, values, actorId, async connection => {
        const [[option]] = await connection.execute('SELECT id FROM sale_options WHERE id = ? AND product_id = ? FOR UPDATE', [values.optionId, id]);
        if (!option) throw catalogError(400, 'INVALID_OPTION', 'Servis seçeneği bu ürüne ait değil veya bulunamadı.');
        const [[latest]] = await connection.execute(`SELECT id, version, valid_from_utc <= UTC_TIMESTAMP(6) AS is_currently_valid
          FROM sale_option_versions WHERE sale_option_id = ? ORDER BY version DESC LIMIT 1 FOR UPDATE`, [values.optionId]);
        if (!latest) throw catalogError(409, 'OPTION_VERSION_MISSING', 'Servisin fiyat tanımı bulunamadı. Önce servis tanımını kontrol edin.');
        if (Number(latest.is_currently_valid) !== 1) throw catalogError(409, 'FUTURE_PRICE_EXISTS', 'Bu servis için ileri tarihli fiyat var. Önce fiyat geçmişini kontrol edin.');
        if (Number(latest.version) >= 4294967295) throw catalogError(409, 'VERSION_LIMIT', 'Servis fiyat sürüm sınırına ulaştı.');
        const [created] = await connection.execute(`INSERT INTO sale_option_versions(sale_option_id, product_id, version, sale_unit_id,
          unit_price_minor, price_basis_quantity, content_quantity_base, requires_weight, valid_from_utc, created_by)
          SELECT sale_option_id, product_id, version + 1, sale_unit_id, ?, price_basis_quantity, content_quantity_base,
            requires_weight, GREATEST(UTC_TIMESTAMP(6), TIMESTAMPADD(MICROSECOND, 1, valid_from_utc)), ?
          FROM sale_option_versions WHERE id = ?`, [values.priceMinor, actorId, latest.id]);
        const newVersionId = String(created.insertId);
        // Recipes and components belong to an immutable price version. Copy every link before publishing it.
        await connection.execute(`INSERT INTO sale_option_components(option_version_id, component_product_id, quantity_base)
          SELECT ?, component_product_id, quantity_base FROM sale_option_components WHERE option_version_id = ?`, [newVersionId, latest.id]);
        await connection.execute(`INSERT INTO sale_option_recipes(option_version_id, recipe_version_id, product_id, recipe_multiplier)
          SELECT ?, recipe_version_id, product_id, recipe_multiplier FROM sale_option_recipes WHERE option_version_id = ?`, [newVersionId, latest.id]);
        return { optionId: values.optionId, previousVersionId: String(latest.id), versionId: newVersionId, priceMinor: values.priceMinor };
      });
    }
  };
}
