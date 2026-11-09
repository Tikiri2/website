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
  async emit(name, payload = {}) { for (const fn of this.events[name] || []) await fn({ currentTarget: this, preventDefault() {}, ...payload }); }
  focus() { this.focused = true; }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const fixture = () => ({ id: '33333333-3333-4333-8333-333333333333', product_name: '<script>not HTML</script>',
  colour: 'Rose', shoe_size: 38, heel_height: 5, customer_phone: '0771234567', product_price: 12900,
  courier_fee: 250, total: 13150, image_path: 'private/order.png', status: 'new', admin_notes: '',
  created_at: '2026-11-09T10:00:00Z', updated_at: '2026-11-09T10:00:00Z' });
const orderTab = (el, status) => el('order-status-tabs').children.find((tab) => tab.id === `order-tab-${status}`);
function cms(options = {}) {
  const elements = new Map();
  const el = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const state = { queries: [], count: null, updates: [], errors: [], signs: [], actions: [], confirmations: 0, rpcCalls: 0 };
  state.record = { ...fixture(), status: options.status || 'new' };
  const client = {
    from(table) {
      const calls = [];
      calls.table = table;
      state.queries.push(calls);
      let update;
      let statusFilter;
      let head = false;
      const query = {
        select(...args) { calls.push(['select', ...args]); head = !!args[1]?.head; return query; },
        order(...args) { calls.push(['order', ...args]); return query; },
        eq(...args) { calls.push(['eq', ...args]); if (args[0] === 'status') statusFilter = args[1]; return query; },
        ilike(...args) { calls.push(['ilike', ...args]); return query; },
        in(...args) { calls.push(['in', ...args]); if (args[0] === 'status') statusFilter = args[1]; return query; },
        update(value) { update = value; state.updates.push(value); return query; },
        range(...args) { calls.push(['range', ...args]); return query; },
        limit(...args) { calls.push(['limit', ...args]); return query; },
        then(resolve, reject) {
          const writeError = options.updateError || (options.legacyDatabase && ['processing', 'shipping'].includes(update?.status)
            ? { code: '23514', message: 'new row violates check constraint "orders_status_check"' } : null);
          if (update && !options.conflict && !writeError) Object.assign(state.record, update);
          const matches = !state.removed && (!statusFilter || (Array.isArray(statusFilter) ? statusFilter.includes(state.record.status) : state.record.status === statusFilter));
          const updateResult = { data: options.conflict ? [] : [{ id: state.record.id, status: options.wrongStatus || update?.status, updated_at: '2026-11-09T11:00:00Z' }], error: writeError };
          const result = (update && options.updateGate ? options.updateGate.then(() => updateResult) : null)
            || (table === 'orders' && options.pending) || Promise.resolve(table === 'order_image_cleanup'
            ? { count: options.cleanupCount || 0, error: null } : update
            ? updateResult
            : head ? { count: matches ? options.count || 1 : 0, error: null }
            : { data: matches ? [state.record] : [], count: matches ? options.count || 1 : 0, error: options.error || null });
          return result.then(resolve, reject);
        },
      };
      return query;
    },
    async rpc() {
      state.rpcCalls++;
      if (options.overviewMissing) return { data: null, error: { code: 'PGRST202', message: 'Function not found' } };
      if (options.overviewDenied) return { data: null, error: { code: '42501', message: 'Access denied' } };
      return { data: { total: state.removed ? 0 : options.count || 1, [state.record.status]: state.removed ? 0 : options.count || 1, order_value: 13150 }, error: null };
    },
    functions: { async invoke(name, { body }) {
      assert.equal(name, 'delete-order');
      state.actions.push(body);
      if (options.deleteNotDeployed) return { error: { message: 'Function failed', context: { status: 404 } } };
      if (options.deleteError) return { error: { message: 'Failed', context: { async json() { return { error: 'Order changed. Refresh before deleting.' }; } } } };
      if (body.action === 'delete') state.removed = true;
      return { data: { deleted: true, cleanup_pending: body.action === 'cleanup' ? 0 : options.cleanupCount || 0 }, error: null };
    } },
    storage: { from() { return { async createSignedUrl(path, expiry) {
      state.signs.push({ path, expiry });
      if (options.imageError) return { data: null, error: { message: 'Storage unavailable' } };
      return { data: { signedUrl: 'https://example.test/private?token=signed' }, error: null };
    } }; } },
  };
  const context = { window: { confirm() { state.confirmations++; return options.confirm !== false; } }, document: { getElementById: el, createElement: (tag) => new Element(tag) } };
  vm.runInNewContext(fs.readFileSync('Backend/orders.js', 'utf8'), context);
  const manager = context.window.createOrdersManager(client, (text) => state.errors.push(text), (count) => { state.count = count; }, () => {}, (count) => { state.newCount = count; });
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
  assert.ok(state.queries.some((query) => query.some((call) => call[0] === 'range' && call[1] === 0 && call[2] === 24)));
});
test('status tabs apply status filtering on the server without phone filters', async () => {
  const { manager, state } = cms();
  await manager.selectStatus('confirmed');
  assert.ok(state.queries.some((query) => query.some((call) => call[0] === 'eq' && call[1] === 'status' && call[2] === 'confirmed')));
  assert.equal(state.queries.some((query) => query.some((call) => call[0] === 'ilike')), false);
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
    assert.ok(state.queries.some((query) => query.some((call) => call[0] === 'eq' && call[1] === 'updated_at')));
  }
});
test('CMS offers Confirmed, Processing, Shipping, Cancelled and completion statuses', async () => {
  const { manager, el } = cms();
  await manager.load();
  const select = el('order-list').children[0].children[1].lastChild.children[0].children[0];
  assert.deepEqual(Array.from(select.children, (option) => option.value), ['new', 'confirmed', 'processing', 'shipping', 'completed', 'cancelled']);
});
test('order deletion is cancelled without a backend call when confirmation is declined', async () => {
  const { manager, state, el } = cms({ confirm: false });
  await manager.load();
  await el('order-list').children[0].children[1].children[3].children[2].emit('click');
  assert.equal(state.confirmations, 1);
  assert.equal(state.actions.length, 0);
  assert.equal(el('order-list').children.length, 1);
});
test('confirmed delete sends the order timestamp and refreshes the list', async () => {
  const { manager, state, el } = cms();
  await manager.load();
  await el('order-list').children[0].children[1].children[3].children[2].emit('click');
  assert.equal(state.actions[0].action, 'delete');
  assert.equal(state.actions[0].id, fixture().id);
  assert.equal(state.actions[0].updated_at, fixture().updated_at);
  assert.equal(el('order-list').children.length, 0);
  assert.equal(state.count, 0);
});
test('stale delete errors keep the record and show a recoverable error', async () => {
  const { manager, state, el } = cms({ deleteError: true });
  await manager.load();
  const body = el('order-list').children[0].children[1];
  await body.children[3].children[2].emit('click');
  assert.equal(state.removed, undefined);
  assert.match(body.lastChild.lastChild.textContent, /Refresh before deleting/);
  assert.equal(body.children[3].children[2].disabled, false);
});
test('missing delete backend shows actionable deployment guidance without claiming deletion', async () => {
  const { manager, state, el } = cms({ deleteNotDeployed: true });
  await manager.load();
  const body = el('order-list').children[0].children[1];
  await body.children[3].children[2].emit('click');
  assert.equal(state.removed, undefined);
  assert.match(body.lastChild.lastChild.textContent, /Deploy.*delete-order/);
  assert.equal(el('order-list').children.length, 1);
});
test('pending image cleanup remains visible and can be retried', async () => {
  const { manager, state, el } = cms({ cleanupCount: 1 });
  await manager.load();
  assert.equal(el('order-cleanup-notice').hidden, false);
  await el('retry-order-cleanup').emit('click');
  assert.equal(state.actions[0].action, 'cleanup');
  assert.equal(el('order-cleanup-notice').hidden, true);
});
test('dashboard loads aggregate totals and renders all six pipeline filters', async () => {
  const { manager, el } = cms();
  await manager.loadDashboard();
  assert.equal(el('dashboard-orders').textContent, '1');
  assert.equal(el('dashboard-pipeline').children.length, 6);
  assert.equal(el('dashboard-recent-orders').children.length, 1);
  await el('dashboard-pipeline').children[2].emit('click');
  assert.equal(orderTab(el, 'processing')['aria-selected'], 'true');
  manager.clear();
  assert.equal(el('dashboard-recent-orders').children.length, 0);
});
test('All orders plus six status tabs show counts and matching orders', async () => {
  const { manager, el } = cms();
  await manager.load();
  const tabs = el('order-status-tabs').children;
  assert.equal(tabs.length, 7);
  assert.equal(tabs[0].id, 'order-tab-all');
  assert.equal(orderTab(el, 'new')['aria-selected'], 'true');
  assert.equal(orderTab(el, 'new').children[1].textContent, '1');
  assert.equal(orderTab(el, 'completed').children[1].textContent, '0');
  await manager.selectStatus('shipping');
  assert.equal(orderTab(el, 'shipping')['aria-selected'], 'true');
  assert.equal(el('order-list').children.length, 0);
  assert.equal(el('orders-message').textContent, 'No shipping orders.');
  assert.equal(el('order-status-panel')['aria-labelledby'], 'order-tab-shipping');
});
test('order counts appear on tabs, not repeated above the order list', async () => {
  const { manager, state, el } = cms({ count: 26 });
  await manager.load();
  assert.equal(el('orders-message').textContent, '');
  assert.equal(orderTab(el, 'new').children[1].textContent, '26');
  assert.equal(state.newCount, 26);
});
test('main Orders badge uses New count rather than the selected status count', async () => {
  const { manager, state } = cms({ status: 'completed' });
  await manager.selectStatus('completed');
  assert.equal(state.count, 1);
  assert.equal(state.newCount, 0);
  await manager.loadDashboard();
  assert.equal(state.newCount, 0);
  manager.clear();
  assert.equal(state.newCount, null);
});
test('All orders skips status filtering and shows total without changing the New badge', async () => {
  const { manager, state, el } = cms({ status: 'completed', count: 3 });
  await manager.selectStatus('all');
  const query = state.queries.find((calls) => calls.table === 'orders' && calls.some((call) => call[0] === 'range'));
  assert.equal(query.some((call) => ['eq', 'in'].includes(call[0]) && call[1] === 'status'), false);
  assert.equal(orderTab(el, 'all').children[1].textContent, '3');
  assert.equal(orderTab(el, 'all')['aria-selected'], 'true');
  assert.equal(state.count, 3);
  assert.equal(state.newCount, 0);
  assert.equal(el('order-list').children.length, 1);
});
test('All orders stays selected when updating an order and has a clear empty state', async () => {
  const { manager, state, el } = cms();
  await manager.selectStatus('all');
  const form = el('order-list').children[0].children[1].lastChild;
  form.children[0].children[0].value = 'confirmed';
  await form.emit('submit');
  assert.equal(orderTab(el, 'all')['aria-selected'], 'true');
  assert.equal(el('order-list').children.length, 1);
  state.removed = true;
  await manager.load();
  assert.equal(el('orders-message').textContent, 'No orders.');
  assert.equal(orderTab(el, 'all').children[1].textContent, '0');
});
test('missing overview RPC falls back to exact status counts and updates main badge', async () => {
  const { manager, state, el } = cms({ overviewMissing: true, count: 7 });
  await manager.load();
  await new Promise(setImmediate);
  assert.equal(state.newCount, 7);
  assert.equal(orderTab(el, 'new').children[1].textContent, '7');
  assert.equal(orderTab(el, 'completed').children[1].textContent, '0');
  const counts = state.queries.filter((query) => query.table === 'orders' && query.some((call) => call[0] === 'select' && call[2]?.head));
  assert.equal(counts.length, 6);
  assert.ok(counts.every((query) => query.some((call) => call[0] === 'select' && call[1] === 'id')));
  await manager.loadDashboard();
  assert.equal(state.rpcCalls, 1);
  assert.equal(el('dashboard-orders').textContent, '7');
  assert.equal(el('dashboard-value').textContent, '—');
});
test('fallback includes legacy Making and Shipped statuses without double-counting', async () => {
  const { manager, el } = cms({ overviewMissing: true, status: 'making', count: 3 });
  await manager.selectStatus('processing');
  await new Promise(setImmediate);
  assert.equal(orderTab(el, 'processing').children[1].textContent, '3');
  assert.equal(orderTab(el, 'shipping').children[1].textContent, '0');
  assert.equal(el('order-list').children.length, 1);
});
test('permission failures do not trigger a fallback or show a misleading zero', async () => {
  const { manager, state, el } = cms({ overviewDenied: true });
  await manager.load();
  assert.equal(state.newCount, null);
  assert.equal(orderTab(el, 'new').children[1].textContent, '—');
  assert.equal(state.queries.some((query) => query.table === 'orders' && query.some((call) => call[0] === 'select' && call[2]?.head)), false);
});
test('expanding an order does not load images; View order image opens it on demand', async () => {
  const { manager, state, el } = cms();
  await manager.load();
  const card = el('order-list').children[0];
  assert.equal(card.children[1].children.some((child) => child.className === 'order-inline-image'), false);
  assert.equal(state.signs.length, 0);
  card.open = true;
  await card.emit('toggle');
  assert.equal(state.signs.length, 0);
  await card.children[1].children[3].children[0].emit('click');
  assert.equal(state.signs.length, 1);
  assert.equal(state.signs[0].expiry, 300);
  assert.match(el('cms-order-image').src, /token=signed/);
  assert.equal(el('cms-order-preview').open, true);
  card.open = false;
  await card.emit('toggle');
  card.open = true;
  await card.emit('toggle');
  assert.equal(state.signs.length, 1);
});
test('View order image errors are visible and the action can be retried', async () => {
  const options = { imageError: true };
  const { manager, state, el } = cms(options);
  await manager.load();
  const card = el('order-list').children[0];
  const view = card.children[1].children[3].children[0];
  await view.emit('click');
  assert.match(el('cms-order-preview-message').textContent, /Storage unavailable/);
  options.imageError = false;
  await view.emit('click');
  assert.equal(state.signs.length, 2);
  assert.equal(el('cms-order-image').hidden, false);
});
test('saving a different status opens its tab and updates counts', async () => {
  const { manager, el } = cms();
  await manager.load();
  const form = el('order-list').children[0].children[1].lastChild;
  form.children[0].children[0].value = 'confirmed';
  await form.emit('submit');
  assert.equal(el('order-list').children.length, 1);
  assert.equal(orderTab(el, 'confirmed')['aria-selected'], 'true');
  assert.equal(orderTab(el, 'new').children[1].textContent, '0');
  assert.equal(orderTab(el, 'confirmed').children[1].textContent, '1');
  await manager.selectStatus('confirmed');
  assert.equal(el('order-list').children.length, 1);
});
test('saving Completed confirms the returned status and opens Completed', async () => {
  const { manager, state, el } = cms();
  await manager.load();
  const form = el('order-list').children[0].children[1].lastChild;
  form.children[0].children[0].value = 'completed';
  await form.emit('submit');
  assert.equal(state.updates[0].status, 'completed');
  assert.equal(orderTab(el, 'completed')['aria-selected'], 'true');
  assert.equal(orderTab(el, 'completed').children[1].textContent, '1');
  assert.equal(el('order-list').children.length, 1);
  assert.ok(state.errors.includes('Order saved as Completed.'));
});
test('legacy database accepts Processing/Shipping through guarded equivalent-status retries', async () => {
  for (const [selected, stored] of [['processing', 'making'], ['shipping', 'shipped']]) {
    const { manager, state, el } = cms({ legacyDatabase: true });
    await manager.load();
    const form = el('order-list').children[0].children[1].lastChild;
    form.children[0].children[0].value = selected;
    await form.emit('submit');
    assert.deepEqual(state.updates.map((update) => update.status), [selected, stored]);
    const writes = state.queries.filter((query) => query.some((call) => call[0] === 'eq' && call[1] === 'updated_at'));
    assert.equal(writes.length, 2);
    assert.ok(writes.every((query) => query.some((call) => call[0] === 'eq' && call[1] === 'updated_at' && call[2] === fixture().updated_at)));
    assert.ok(state.errors.includes(`Order saved as ${selected[0].toUpperCase() + selected.slice(1)}.`));
  }
});
test('legacy Making orders display Processing as their selected status', async () => {
  const { manager, el } = cms({ status: 'making' });
  await manager.selectStatus('processing');
  const form = el('order-list').children[0].children[1].lastChild;
  assert.equal(form.children[0].children[0].value, 'processing');
});
test('switching tabs during a save still refreshes the visible tab after confirmation', async () => {
  let finish;
  const updateGate = new Promise((resolve) => { finish = resolve; });
  const { manager, state, el } = cms({ updateGate });
  await manager.load();
  const form = el('order-list').children[0].children[1].lastChild;
  form.children[0].children[0].value = 'completed';
  const saving = form.emit('submit');
  await manager.selectStatus('completed');
  const before = state.queries.length;
  finish();
  await saving;
  assert.ok(state.queries.length > before);
  assert.ok(state.errors.includes('Order saved as Completed.'));
});
test('server errors and unconfirmed status responses never report successful completion', async () => {
  for (const options of [{ updateError: { message: 'Access denied' } }, { wrongStatus: 'new' }]) {
    const { manager, state, el } = cms(options);
    await manager.load();
    const form = el('order-list').children[0].children[1].lastChild;
    form.children[0].children[0].value = 'completed';
    await form.emit('submit');
    assert.match(form.lastChild.textContent, /Could not save/);
    assert.equal(state.errors.includes('Order saved as Completed.'), false);
    assert.equal(form.children[2].disabled, false);
  }
});
test('completed tab supports confirmed permanent deletion and updates its count', async () => {
  const { manager, state, el } = cms({ status: 'completed' });
  await manager.selectStatus('completed');
  const remove = el('order-list').children[0].children[1].children[3].children[2];
  assert.equal(remove.textContent, 'Delete completed order');
  await remove.emit('click');
  assert.equal(state.confirmations, 1);
  assert.equal(state.actions[0].action, 'delete');
  assert.equal(el('order-list').children.length, 0);
  assert.equal(orderTab(el, 'completed').children[1].textContent, '0');
});
test('status tabs support arrow-key navigation and reset pagination', async () => {
  const { manager, state, el } = cms({ count: 26 });
  await manager.load();
  await el('orders-next').emit('click');
  await new Promise(setImmediate);
  await orderTab(el, 'new').emit('keydown', { key: 'ArrowRight' });
  await new Promise(setImmediate);
  assert.equal(orderTab(el, 'confirmed').focused, true);
  assert.equal(orderTab(el, 'confirmed')['aria-selected'], 'true');
  const lastOrderQuery = state.queries.filter((query) => query.table === 'orders').at(-1);
  assert.ok(lastOrderQuery.some((call) => call[0] === 'range' && call[1] === 0));
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
