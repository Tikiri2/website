const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.events = {}; this.value = ''; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  get lastChild() { return this.children.at(-1); }
  addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }
  async emit(name) { for (const fn of this.events[name] || []) await fn({ preventDefault() {} }); }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const fixture = () => ({ id: '33333333-3333-4333-8333-333333333333', product_name: '<script>not HTML</script>',
  colour: 'Rose', shoe_size: 38, heel_height: 5, customer_phone: '0771234567', product_price: 12900,
  courier_fee: 250, total: 13150, image_path: 'private/order.png', status: 'new', admin_notes: '',
  created_at: '2026-11-09T10:00:00Z', updated_at: '2026-11-09T10:00:00Z' });
function cms(options = {}) {
  const elements = new Map();
  const el = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const state = { queries: [], count: null, updates: [], errors: [], signs: [] };
  const client = {
    from() {
      const calls = [];
      state.queries.push(calls);
      let update;
      const query = {
        select(...args) { calls.push(['select', ...args]); return query; },
        order(...args) { calls.push(['order', ...args]); return query; },
        eq(...args) { calls.push(['eq', ...args]); return query; },
        ilike(...args) { calls.push(['ilike', ...args]); return query; },
        update(value) { update = value; state.updates.push(value); return query; },
        range(...args) { calls.push(['range', ...args]); return query; },
        then(resolve, reject) {
          const result = options.pending || Promise.resolve(update
            ? { data: options.conflict ? [] : [{ updated_at: '2026-11-09T11:00:00Z' }], error: null }
            : { data: [fixture()], count: options.count || 1, error: options.error || null });
          return result.then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from() { return { async createSignedUrl(path, expiry) {
      state.signs.push({ path, expiry });
      return { data: { signedUrl: 'https://example.test/private?token=signed' }, error: null };
    } }; } },
  };
  const context = { window: {}, document: { getElementById: el, createElement: (tag) => new Element(tag) } };
  vm.runInNewContext(fs.readFileSync('Backend/orders.js', 'utf8'), context);
  const manager = context.window.createOrdersManager(client, (text) => state.errors.push(text), (count) => { state.count = count; });
  return { manager, state, el };
}
test('CMS renders safe structured details and paginates newest-first', async () => {
  const { manager, state, el } = cms({ count: 26 });
  await manager.load();
  assert.equal(state.count, 26);
  assert.equal(el('order-list').children.length, 1);
  const summary = el('order-list').children[0].children[0];
  assert.match(summary.children[0].textContent, /<script>not HTML<\/script>/);
  assert.equal(summary.children[0].children.length, 0);
  assert.equal(el('orders-prev').disabled, true);
  assert.equal(el('orders-next').disabled, false);
  assert.equal(el('orders-page').textContent, 'Page 1 of 2');
  assert.ok(state.queries[0].some((call) => call[0] === 'range' && call[1] === 0 && call[2] === 24));
});
test('CMS applies status and phone filters on the server', async () => {
  const { manager, state, el } = cms();
  el('order-status-filter').value = 'confirmed';
  el('order-search').value = '077 123';
  await manager.load();
  assert.ok(state.queries[0].some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'confirmed'));
  assert.ok(state.queries[0].some((call) => call[0] === 'ilike' && call[2] === '%077123%'));
});
test('CMS generates fresh five-minute private preview links', async () => {
  const { manager, state, el } = cms();
  await manager.load();
  const body = el('order-list').children[0].children[1];
  await body.children[3].children[0].emit('click');
  assert.equal(state.signs[0].expiry, 300);
  assert.equal(el('cms-order-preview').open, true);
  assert.match(el('cms-order-image').src, /token=signed/);
});
test('CMS saves only status/notes and detects concurrent changes', async () => {
  for (const conflict of [false, true]) {
    const { manager, state, el } = cms({ conflict });
    await manager.load();
    const form = el('order-list').children[0].children[1].lastChild;
    form.children[0].children[0].value = 'confirmed';
    form.children[1].children[0].value = 'Customer confirmed on WhatsApp';
    await form.emit('submit');
    assert.deepEqual(Object.keys(state.updates[0]).sort(), ['admin_notes', 'status']);
    assert.equal(state.updates[0].status, 'confirmed');
    assert.match(form.lastChild.textContent, conflict ? /another session/ : /Order saved/);
    assert.ok(state.queries[1].some((call) => call[0] === 'eq' && call[1] === 'updated_at'));
  }
});
test('sign-out clears customer data and ignores in-flight responses', async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const { manager, state, el } = cms({ pending });
  const loading = manager.load();
  manager.clear();
  resolve({ data: [fixture()], count: 1, error: null });
  await loading;
  assert.equal(el('order-list').children.length, 0);
  assert.equal(state.count, 0);
  assert.equal(el('cms-order-preview').open, false);
});
