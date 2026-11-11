import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const fkError = { code: 'ER_NO_REFERENCED_ROW_2' };
const duplicateError = { code: 'ER_DUP_ENTRY' };
const checkError = { code: 'ER_CHECK_CONSTRAINT_VIOLATED' };

// Fixtures exist only inside a rolled-back transaction in the disposable server.
// This exercises database guarantees without seeding the real business database.
export async function checkSchemaIntegrity(connection) {
  const insert = async (name, values) => {
    const columns = Object.keys(values);
    assert.match(name, /^[a-z_]+$/);
    for (const column of columns) assert.match(column, /^[a-z_]+$/);
    const [result] = await connection.execute(
      `INSERT INTO \`${name}\` (${columns.map(column => `\`${column}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      Object.values(values)
    );
    return result.insertId;
  };
  await connection.beginTransaction();
  try {
    const user = await insert('app_users', { login_name: 'test_operator', display_name: 'Test operator' });
    const operationKey = randomUUID();
    const operationValues = { request_key: operationKey, request_hash: Buffer.alloc(32, 1), operation_type: 'test-fixture', actor_user_id: user };
    const operation = await insert('business_operations', operationValues);
    await assert.rejects(insert('business_operations', operationValues), duplicateError, 'A repeated request cannot create a second operation');
    const unit = await insert('units', { code: 'test_g', name: 'Test gram', dimension: 'mass', decimal_places: 6 });
    const warehouse = await insert('warehouses', { code: 'test_store', name: 'Test warehouse' });
    const productValues = { code: 'test_product', name: 'Original product', product_type: 'ready', stock_mode: 'direct', stock_timing: 'sale', base_unit_id: unit };
    const product = await insert('products', productValues);
    const otherProduct = await insert('products', { ...productValues, code: 'test_other', name: 'Other product' });
    await assert.rejects(insert('products', { ...productValues, code: 'test_invalid_unit', base_unit_id: '999999999999' }), fkError);
    await assert.rejects(insert('products', { ...productValues, code: 'test_no_unit', base_unit_id: null }), checkError);
    const option = await insert('sale_options', { product_id: product, code: 'test_weight', name: 'Original option' });
    const optionValues = { sale_option_id: option, product_id: product, version: 1, sale_unit_id: unit, unit_price_minor: 33333, price_basis_quantity: '1000', requires_weight: true, valid_from_utc: '2026-01-01 00:00:00', created_by: user };
    const version = await insert('sale_option_versions', optionValues);
    const nextOptionValues = { ...optionValues, version: 2, valid_from_utc: '2026-02-01 00:00:00' };
    await assert.rejects(insert('sale_option_versions', { ...nextOptionValues, product_id: otherProduct }), fkError, 'Option versions must belong to their product');
    await assert.rejects(insert('sale_option_versions', { ...nextOptionValues, price_basis_quantity: 0 }), checkError);
    await assert.rejects(insert('sale_option_versions', { ...nextOptionValues, unit_price_minor: -1 }), { code: 'ER_WARN_DATA_OUT_OF_RANGE' });

    const section = await insert('dining_sections', { name: 'Test section' });
    const table = await insert('dining_tables', { section_id: section, name: 'Test table 1' });
    const secondTable = await insert('dining_tables', { section_id: section, name: 'Test table 2' });
    const group = await insert('settlement_groups', { opened_by: user });
    const otherGroup = await insert('settlement_groups', { opened_by: user });
    const check = await insert('checks', { check_number: 'test_check_1', check_type: 'table', opened_by: user });
    const otherCheck = await insert('checks', { check_number: 'test_check_2', check_type: 'table', opened_by: user });
    const membership = await insert('settlement_group_memberships', { group_id: group, check_id: check, operation_id: operation });
    const otherMembership = await insert('settlement_group_memberships', { group_id: otherGroup, check_id: otherCheck, operation_id: operation });
    await assert.rejects(insert('settlement_group_memberships', { group_id: otherGroup, check_id: check, operation_id: operation }), duplicateError, 'One check has only one active group');
    const assignment = await insert('table_assignments', { table_id: table, group_id: group, operation_id: operation });
    await assert.rejects(insert('table_assignments', { table_id: table, group_id: otherGroup, operation_id: operation }), duplicateError, 'One table has only one active account');
    await assert.rejects(insert('table_assignments', { table_id: secondTable, group_id: group, operation_id: operation }), duplicateError, 'One account occupies only one active table');

    const lineValues = { check_id: check, product_id: product, option_version_id: version, product_name: 'Original product', option_name: 'Original option', unit_code: 'test_g', quantity: '300.000000', unit_price_minor: 33333, price_basis_quantity: '1000', subtotal_minor: 10000, total_minor: 10000, added_by: user };
    const line = await insert('check_lines', lineValues);
    const otherLine = await insert('check_lines', { ...lineValues, check_id: otherCheck });
    await assert.rejects(insert('check_lines', { ...lineValues, quantity: '-1' }), checkError);
    await assert.rejects(insert('check_lines', { ...lineValues, total_minor: 9999 }), checkError, 'Line totals and discounts must reconcile');
    await assert.rejects(insert('order_line_events', { check_line_id: line, operation_id: operation, event_type: 'cancelled', actor_user_id: user, reason: null }), checkError, 'Cancellation needs an actual reason, including under SQL NULL semantics');

    const paymentValues = { operation_id: operation, sequence_no: 1, method: 'cash', direction: 'in', amount_minor: 3333, received_by: user };
    const cash = await insert('payments', paymentValues);
    const card = await insert('payments', { ...paymentValues, sequence_no: 2, method: 'card' });
    await assert.rejects(insert('payments', paymentValues), duplicateError, 'Payment sequence is idempotent within an operation');
    await assert.rejects(insert('payments', { ...paymentValues, sequence_no: 3, amount_minor: 0 }), checkError);
    await assert.rejects(insert('payments', { ...paymentValues, sequence_no: 3, amount_minor: -1 }), { code: 'ER_WARN_DATA_OUT_OF_RANGE' });
    await assert.rejects(insert('payments', { ...paymentValues, sequence_no: 3, method: 'credit' }), error => error.errno === 1265, 'Credit is not cash or card collection');
    const party = await insert('parties', { code: 'test_customer', name: 'Test customer', is_customer: true });
    const account = await insert('party_accounts', { party_id: party, account_type: 'receivable' });
    const credit = await insert('party_entries', { account_id: account, operation_id: operation, sequence_no: 1, entry_type: 'sale_credit', amount_minor: 3334, description: 'Test sale credit' });
    await insert('party_entry_sources', { party_entry_id: credit, check_id: check });
    const cashSettlement = await insert('bill_settlements', { group_id: group, payment_id: cash, direction: 'settle', amount_minor: 3333 });
    const cardSettlement = await insert('bill_settlements', { group_id: group, payment_id: card, direction: 'settle', amount_minor: 3333 });
    const creditSettlement = await insert('bill_settlements', { group_id: group, credit_entry_id: credit, direction: 'settle', amount_minor: 3334 });
    await assert.rejects(insert('bill_settlements', { group_id: group, direction: 'settle', amount_minor: 1 }), checkError);
    const otherCredit = await insert('party_entries', { account_id: account, operation_id: operation, sequence_no: 2, entry_type: 'sale_credit', amount_minor: 1, description: 'Test credit exclusivity' });
    await assert.rejects(insert('bill_settlements', { group_id: otherGroup, payment_id: card, credit_entry_id: otherCredit, direction: 'settle', amount_minor: 1 }), checkError);

    const allocationValues = { settlement_id: cashSettlement, group_id: group, membership_id: membership, check_id: check, check_line_id: line, quantity: '100.000000', amount_minor: 3333 };
    await insert('settlement_allocations', allocationValues);
    await insert('settlement_allocations', { ...allocationValues, settlement_id: cardSettlement });
    await insert('settlement_allocations', { ...allocationValues, settlement_id: creditSettlement, amount_minor: 3334 });
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, group_id: otherGroup, membership_id: otherMembership, check_id: otherCheck, check_line_id: otherLine }), fkError, 'Allocation cannot switch a settlement into another account group');
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, membership_id: otherMembership }), fkError, 'Membership and check must match');
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, check_line_id: otherLine }), fkError, 'The selected product must belong to the selected check');
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, quantity: null }), checkError, 'A selected item requires quantity, including under SQL NULL semantics');
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, quantity: '-1' }), checkError);
    await assert.rejects(insert('settlement_allocations', { ...allocationValues, check_line_id: null }), checkError, 'Amount-only payment cannot invent product quantities');
    const [[splits]] = await connection.query('SELECT SUM(quantity) AS quantity, SUM(amount_minor) AS amount FROM settlement_allocations WHERE check_line_id = ?', [line]);
    assert.equal(splits.quantity, '300.000000');
    assert.equal(String(splits.amount), '10000', 'Split rounding preserves every kuruş');
    const [[collected]] = await connection.query('SELECT SUM(amount_minor) AS amount FROM payments');
    const [[settled]] = await connection.query('SELECT SUM(amount_minor) AS amount FROM bill_settlements');
    assert.equal(String(collected.amount), '6666', 'Credit does not inflate actual cash/card collection');
    assert.equal(String(settled.amount), '10000');

    await connection.execute('UPDATE products SET name = ? WHERE id = ?', ['Changed current product', product]);
    await insert('sale_option_versions', { ...nextOptionValues, unit_price_minor: 66666 });
    const [[snapshot]] = await connection.execute('SELECT product_name, option_name, unit_price_minor, quantity, total_minor FROM check_lines WHERE id = ?', [line]);
    assert.equal(snapshot.product_name, 'Original product');
    assert.equal(snapshot.option_name, 'Original option');
    assert.equal(String(snapshot.unit_price_minor), '33333');
    assert.equal(snapshot.quantity, '300.000000');
    assert.equal(String(snapshot.total_minor), '10000');
    await assert.rejects(connection.execute('DELETE FROM products WHERE id = ?', [product]), { code: 'ER_ROW_IS_REFERENCED_2' }, 'Referenced history cannot silently disappear');
    await connection.execute('UPDATE table_assignments SET released_at_utc = UTC_TIMESTAMP(6) WHERE id = ?', [assignment]);
    await insert('table_assignments', { table_id: secondTable, group_id: group, operation_id: operation });
    const [[preserved]] = await connection.query('SELECT COUNT(*) AS count FROM settlement_allocations WHERE check_line_id = ?', [line]);
    assert.equal(Number(preserved.count), 3, 'A table move retains original line and payment links');

    const lot = await insert('stock_lots', { product_id: otherProduct, lot_code: 'test_lot', operation_id: operation });
    const document = await insert('stock_documents', { operation_id: operation, document_type: 'opening', reason: 'Test opening', actor_user_id: user });
    const movement = { document_id: document, sequence_no: 1, warehouse_id: warehouse, product_id: product, quantity_base: '300', unit_cost_minor: '12.345678' };
    await assert.rejects(insert('stock_movements', { ...movement, lot_id: lot }), fkError, 'A lot cannot belong to a different product');
    await assert.rejects(insert('stock_movements', { ...movement, quantity_base: '0' }), checkError);
    await assert.rejects(insert('stock_movements', { ...movement, unit_cost_minor: '-0.000001' }), checkError);
    await insert('stock_movements', movement);
    await insert('stock_movements', { ...movement, sequence_no: 2, quantity_base: '-100', check_line_id: line });
    const [[stock]] = await connection.query('SELECT SUM(quantity_base) AS balance FROM stock_movements WHERE product_id = ?', [product]);
    assert.equal(stock.balance, '200.000000', 'Stock balance is recoverable from signed movements');

    const register = await insert('cash_registers', { code: 'test_register', name: 'Test register' });
    const shiftValues = { cash_register_id: register, responsible_user_id: user, opened_by_user_id: user };
    const shift = await insert('cash_shifts', shiftValues);
    await assert.rejects(insert('cash_shifts', shiftValues), duplicateError, 'A register has only one active shift');
    const cashMovementValues = { operation_id: operation, cash_shift_id: shift, actor_user_id: user, movement_kind: 'sale_receipt', amount_minor: 3333, reason: 'Test receipt' };
    await assert.rejects(insert('cash_movements', { ...cashMovementValues, amount_minor: -1 }), checkError);
    const cashMovement = await insert('cash_movements', cashMovementValues);
    await insert('cash_payment_links', { payment_id: cash, cash_movement_id: cashMovement });
    await assert.rejects(insert('cash_payment_links', { payment_id: card, cash_movement_id: cashMovement }), duplicateError, 'One cash movement cannot be attributed to two collections');
    await assert.rejects(insert('cash_movements', { ...cashMovementValues, movement_kind: 'transfer_in' }), checkError, 'Custody transfers require a separate transfer identity');
  } finally {
    await connection.rollback();
  }
  for (const table of ['app_users', 'business_operations', 'products', 'checks', 'payments', 'party_entries', 'stock_movements', 'cash_movements']) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    assert.equal(Number(row.count), 0, `Fixture rollback leaves ${table} empty`);
  }
}
