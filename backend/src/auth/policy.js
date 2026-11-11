export const permissions = [
  ['dashboard.read', 'Yönetici özetini görüntüleme'], ['tables.read', 'Masaları görüntüleme'],
  ['orders.write', 'Sipariş oluşturma'], ['payments.write', 'Tahsilat yapma'],
  ['kitchen.write', 'Hazırlık durumunu güncelleme'], ['catalog.manage', 'Ürün ve fiyat yönetimi'],
  ['stock.manage', 'Stok ve üretim yönetimi'], ['purchases.manage', 'Alış yönetimi'],
  ['parties.manage', 'Cari hesap yönetimi'], ['expenses.manage', 'Gider yönetimi'],
  ['cash.manage', 'Kasa ve vardiya yönetimi'], ['reports.read', 'Raporları görüntüleme'],
  ['users.manage', 'Kullanıcı yönetimi'], ['settings.read', 'İşletme ayarlarını görüntüleme'],
  ['settings.manage', 'İşletme ayarlarını yönetme']
];
export const roles = [
  { code: 'owner', name: 'İşletme sahibi', permissions: permissions.map(([code]) => code) },
  { code: 'manager', name: 'Sorumlu', permissions: ['dashboard.read', 'tables.read', 'orders.write', 'payments.write', 'kitchen.write', 'catalog.manage', 'stock.manage', 'purchases.manage', 'parties.manage', 'expenses.manage', 'cash.manage', 'reports.read', 'settings.read'] },
  { code: 'cashier', name: 'Kasiyer', permissions: ['tables.read', 'orders.write', 'payments.write', 'cash.manage'] },
  { code: 'waiter', name: 'Garson', permissions: ['tables.read', 'orders.write'] },
  { code: 'kitchen', name: 'Mutfak/bar', permissions: ['kitchen.write'] },
  { code: 'stock', name: 'Depo', permissions: ['stock.manage', 'purchases.manage'] }
];

// Bootstrap data is explicitly installed with the first owner's transaction.
// Startup and login never rewrite role assignments or business data.
export async function installPolicy(connection) {
  for (const [code, description] of permissions) {
    await connection.execute('INSERT INTO permissions(code, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = ?', [code, description, description]);
  }
  for (const role of roles) {
    await connection.execute('INSERT INTO roles(code, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = ?', [role.code, role.name, role.name]);
    for (const permission of role.permissions) {
      await connection.execute(`INSERT INTO role_permissions(role_id, permission_id)
        SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ? WHERE r.code = ?
        ON DUPLICATE KEY UPDATE role_id = role_permissions.role_id`, [permission, role.code]);
    }
  }
}
