const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync(path.join(__dirname, '../../..', 'prototypes/satis-akisi.html'), 'utf8');
const raw = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(raw);
const anchor = '  render();\n  if(globalThis.Tweak)';
assert(raw.includes(anchor));
const source = raw.replace(anchor, '  globalThis.api={state,products,go,render,paymentInput,selectedPaymentItems,selectionKey,recordPayment,remaining,total,allocated,openQty,settledQty,unassignedPayment,lineFrom,productById,paymentProductsHtml,moveAccount,accountKey};\n' + anchor);
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function makeNode() {
  return { dataset: {}, value: '', id: '', name: '', checked: false, disabled: false, textContent: '', readOnly: false,
    setAttribute(k, v) { this[k] = v; }, focus() {},
    closest(s) { return s === '#nc-payment-form' && this.inForm ? this.form : null; } };
}
function boot() {
  const handlers = {}, timers = [], layout = makeNode(), live = makeNode();
  let elements = [], markup = '', form;
  const content = {
    get innerHTML() { return markup; },
    set innerHTML(value) {
      markup = value; elements = []; form = { elements: {} };
      for (const match of value.matchAll(/<(button|input|select|div|h4|span)\b([^>]*)>/g)) {
        const attrs = {};
        for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] === undefined ? true : decode(a[2]);
        const el = makeNode();
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith('data-')) el.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
          else if (k === 'readonly') el.readOnly = true;
          else el[k] = v;
        }
        if (el.name) { form.elements[el.name] = el; el.inForm = true; el.form = form; }
        elements.push(el);
      }
    },
    querySelector(s) {
      if (s === '#nc-payment-form') return markup.includes('id="nc-payment-form"') ? form : null;
      if (s.startsWith('#')) return elements.find(e => e.id === s.slice(1)) || null;
      const m = s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
      if (!m) return null;
      const k = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return elements.find(e => m[2] === undefined ? e.dataset[k] !== undefined : e.dataset[k] === m[2]) || null;
    },
    querySelectorAll(s) {
      const m = s.match(/^\[data-([\w-]+)\]$/); if (!m) return [];
      const k = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return elements.filter(e => e.dataset[k] !== undefined);
    }
  };
  const root = { dataset: {}, querySelector: s => s === '#nc-content' ? content : s === '#nc-live' ? live : layout,
    querySelectorAll: () => [], addEventListener: (name, fn) => { handlers[name] = fn; } };
  const ctx = vm.createContext({ window: { addEventListener() {}, localStorage: { getItem: () => null, setItem() {} } },
    document: { getElementById: () => root }, Intl, setTimeout: fn => timers.push(fn) });
  vm.runInContext(source, ctx);
  const api = ctx.api;
  const get = s => { const el = content.querySelector(s); assert(el, 'missing ' + s); return el; };
  function click(s, force = false) {
    const button = typeof s === 'string' ? get(s) : s;
    if (button.disabled && !force) return false;
    handlers.click({ target: { closest: q => q === 'button' ? button : null }, detail: 1 }); return true;
  }
  function check(id, value = true) {
    const el = get('[data-pay-line="' + id + '"]'); assert(!el.disabled); el.checked = value; handlers.change({ target: el });
  }
  function quantity(id, value) { const el = get('[data-pay-qty="' + id + '"]'); el.value = String(value); handlers.input({ target: el }); }
  function amount(value) { const el = form.elements.amount; el.value = String(value); handlers.input({ target: el }); }
  function settle(method) {
    const button = get('[data-pay-method="' + method + '"]'); assert(!button.disabled, 'payment disabled');
    const table = api.state.tables.find(t => t.id === api.state.table), count = table.payments.length;
    click(button); assert.equal(table.payments.length, count + 1);
    while (timers.length) timers.shift()();
  }
  return { api, content, get, click, check, quantity, amount, settle, timers, handlers, form: () => form };
}

// Two customers pay different products from one bill; the order itself is unchanged.
let a = boot(), t = a.api, table = t.state.tables[2]; t.go('payment');
const originalLines = JSON.stringify(table.lines);
a.click('[data-payment-mode="items"]'); assert(a.form().elements.amount.readOnly); assert(a.get('[data-pay-method="cash"]').disabled);
a.check(table.lines[0].id); a.check(table.lines[1].id); assert.equal(a.form().elements.amount.value, '200,00');
a.settle('cash'); assert.equal(t.remaining(table), 25000); assert.equal(t.settledQty(table, table.lines[0]), 1); assert.equal(t.openQty(table, table.lines[0]), 1);
assert.equal(JSON.stringify(table.lines), originalLines); assert(a.get('[data-pay-line="' + table.lines[1].id + '"]').disabled);
a.check(table.lines[0].id); a.check(table.lines[2].id); assert.equal(a.form().elements.amount.value, '250,00');
a.settle('card'); assert.equal(t.remaining(table), 0); assert.equal(table.payments[0].items.length, 2); assert.equal(table.payments[1].items.length, 2);

// Invalid quantities, stale selection, amount edits and double submission cannot settle extra items.
a = boot(); t = a.api; table = t.state.tables[2]; t.go('payment'); a.click('[data-payment-mode="items"]');
a.quantity(table.lines[0].id, 3); assert(a.get('[data-pay-method="cash"]').disabled);
a.quantity(table.lines[0].id, 0.5); assert(a.get('[data-pay-method="cash"]').disabled);
a.quantity(table.lines[0].id, 1); const stale = { ...a.get('[data-pay-method="cash"]').dataset };
a.quantity(table.lines[0].id, 2); assert.equal(t.recordPayment('cash', stale), false); assert.equal(table.payments.length, 0);
a.form().elements.amount.value = '1,00'; assert.equal(t.recordPayment('cash', a.get('[data-pay-method="cash"]').dataset), false); t.render();
const expected = { ...a.get('[data-pay-method="cash"]').dataset };
assert(t.recordPayment('cash', expected)); assert.equal(t.recordPayment('card', expected), false); assert.equal(table.payments.length, 1);
while (a.timers.length) a.timers.shift()();

// Unassigned amount payments do not imply which items were paid.
a = boot(); t = a.api; table = t.state.tables[2]; t.go('payment'); a.amount('100'); a.settle('cash');
assert.equal(t.remaining(table), 35000); assert(a.get('[data-payment-mode="items"]').disabled);
a.click('[data-payment-mode="items"]', true); assert.equal(t.paymentInput().mode, 'amount'); a.settle('card'); assert.equal(t.remaining(table), 0);
assert(!t.paymentProductsHtml(table).includes('Ürün payı kalan'));
a = boot(); t = a.api; table = t.state.tables[2]; table.lines = [t.lineFrom(t.productById('tost'), null, 2, 'new')]; t.go('payment');
a.click('[data-payment-mode="items"]'); a.check(table.lines[0].id); a.settle('cash'); a.click('[data-payment-mode="amount"]'); a.amount('50'); a.settle('cash');
assert(!t.paymentProductsHtml(table).includes('Ürün payı kalan')); a.settle('card'); assert.equal(t.remaining(table), 0);
assert(!t.paymentProductsHtml(table).includes('Ürün payı kalan'));

// Three separate grams preserve the rounded original total: 18 + 17 + 18 = 53 cents.
a = boot(); t = a.api; table = t.state.tables[2]; const snack = t.products.find(p => p.sourceId === 'snacks-08');
table.lines = [t.lineFrom(snack, snack.variants[0], 3, 'delivered')]; t.go('payment'); a.click('[data-payment-mode="items"]');
for (let i = 0; i < 3; i++) { a.quantity(table.lines[0].id, 1); a.settle('cash'); }
assert.equal(t.total(table), 53); assert.equal(t.allocated(table), 53); assert.deepEqual(Array.from(table.payments, p => p.cash), [18, 17, 18]); assert.equal(t.remaining(table), 0);

// Credit remains separate from collected cash; the final full amount settles the remaining items.
a = boot(); t = a.api; table = t.state.tables[2]; t.go('payment'); a.click('[data-payment-mode="items"]'); a.check(table.lines[0].id);
a.form().elements.customer.value = 'Example customer'; a.settle('debt'); assert.equal(table.payments[0].cash, 0); assert.equal(table.payments[0].debt, 15000);
assert.equal(t.settledQty(table, table.lines[0], true), 1); a.click('[data-payment-mode="amount"]'); a.settle('card');
assert.equal(t.remaining(table), 0); assert.equal(t.unassignedPayment(table), 0); assert.equal(t.openQty(table, table.lines[0]), 0);

// Moving and merging preserve item links, and paid lines cannot be cancelled without refund handling.
a = boot(); t = a.api; table = t.state.tables[2]; t.go('payment'); a.click('[data-payment-mode="items"]'); a.check(table.lines[0].id); a.settle('cash');
const paidLine = table.lines[0], ref = table.ref; t.state.transfer = { source: 3, ref, target: 1, merge: false }; assert(t.moveAccount());
let dest = t.state.tables[0]; assert.equal(dest.ref, ref); assert.equal(t.settledQty(dest, paidLine), 1);
t.state.transfer = { source: 1, ref, target: 6, merge: true }; assert(t.moveAccount()); dest = t.state.tables[5]; assert.equal(t.settledQty(dest, paidLine), 1);
t.go('order'); a.click('[data-cancel="' + paidLine.id + '"]'); a.get('#nc-cancel-reason').value = 'test'; a.click('[data-approve-cancel="' + paidLine.id + '"]'); assert.equal(paidLine.status, 'new');

// Legacy payment records and unfinished drafts keep the appropriate selection restrictions.
a = boot(); t = a.api; table = t.state.tables[2]; table.payments = [{ cash: 1000, card: 0, debt: 0 }]; t.go('payment'); assert(a.get('[data-payment-mode="items"]').disabled);
table.payments = []; table.lines[0].status = 'draft'; t.render(); assert(a.get('[data-payment-mode="items"]').disabled);

console.log('PASS: separate item/count payments, sequential cash/card, unchanged orders, invalid/stale/double guards, legacy and mixed amount payments, gram rounding, item credit, moving/merging and cancellation.');
