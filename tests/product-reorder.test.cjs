const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor() {
    this.children = []; this.events = {}; this.classes = new Set();
    this.classList = { add: (...names) => names.forEach((name) => this.classes.add(name)), remove: (...names) => names.forEach((name) => this.classes.delete(name)) };
  }
  prepend(child) { this.children.unshift(child); }
  addEventListener(name, fn) { this.events[name] = fn; }
  setAttribute(name, value) { this[name] = value; }
  getBoundingClientRect() { return { top: 100, height: 60 }; }
  async emit(name, extras = {}) {
    return this.events[name]?.({ preventDefault() {}, dataTransfer: { setData() {}, setDragImage() {} }, ...extras });
  }
}
const fixture = () => ['a', 'b', 'c'].map((id, index) => ({ id, name: id.toUpperCase(), price: 500, display_order: index + 1 }));
function setup(options = {}) {
  const state = { renders: [], writes: [], saved: 0, errors: [], busy: [], rows: [] };
  const context = { window: {}, document: { createElement: () => new Element(), getElementById: () => null } };
  vm.runInNewContext(fs.readFileSync('Backend/product-reorder.js', 'utf8'), context);
  let manager;
  const render = (items) => {
    state.renders.push(items.map((item) => item.id));
    state.rows = items.map((item) => { const row = new Element(); row.product = item; manager.decorate(row, item); return row; });
  };
  manager = context.window.createProductReorder({
    render,
    async persist(items) {
      state.writes.push(items.map((item) => item.id));
      if (options.pending) await options.pending;
      if (options.fail) throw new Error('Save failed');
      return items.map((item, index) => ({ ...item, display_order: index + 1 }));
    },
    onSaved: () => state.saved++, onError: async (error) => { state.errors.push(error.message); manager.setProducts(fixture()); },
    onBusy: (value) => state.busy.push(value),
  });
  manager.setProducts(fixture()); render(fixture());
  return { manager, state, persist: context.window.persistProductOrder };
}
test('dragging a product after another saves the new order', async () => {
  const { state } = setup();
  await state.rows[0].children[0].emit('dragstart');
  await state.rows[2].emit('dragover', { clientY: 145 });
  assert.equal(state.rows[2].classes.has('drop-after'), true);
  await state.rows[2].emit('drop', { clientY: 145 });
  assert.deepEqual(Array.from(state.writes[0]), ['b', 'c', 'a']);
  assert.equal(state.saved, 1);
  assert.equal(state.busy.at(-1), false);
});
test('dragging before a product and keyboard movement both work', async () => {
  const first = setup();
  await first.state.rows[2].children[0].emit('dragstart');
  await first.state.rows[0].emit('drop', { clientY: 105 });
  assert.deepEqual(Array.from(first.state.writes[0]), ['c', 'a', 'b']);
  const second = setup();
  await second.state.rows[1].children[0].emit('keydown', { key: 'ArrowUp' });
  assert.deepEqual(Array.from(second.state.writes[0]), ['b', 'a', 'c']);
});
test('dropping at the same position does not make database writes', async () => {
  const { state } = setup();
  await state.rows[0].children[0].emit('dragstart');
  await state.rows[1].emit('drop', { clientY: 105 });
  assert.equal(state.writes.length, 0);
});
test('failed saves restore server-loaded order and never report success', async () => {
  const { state } = setup({ fail: true });
  await state.rows[0].children[0].emit('keydown', { key: 'ArrowDown' });
  assert.equal(state.saved, 0);
  assert.deepEqual(Array.from(state.renders.at(-1)), ['a', 'b', 'c']);
  assert.equal(state.errors[0], 'Save failed');
});
test('another drag is blocked while saving, and sign-out suppresses stale UI updates', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { manager, state } = setup({ pending });
  const saving = state.rows[0].children[0].emit('keydown', { key: 'ArrowDown' });
  assert.equal(manager.busy, true);
  assert.equal(state.rows[0].children[0].disabled, true);
  await state.rows[1].children[0].emit('keydown', { key: 'ArrowDown' });
  assert.equal(state.writes.length, 1);
  manager.clear();
  finish(); await saving;
  assert.equal(state.saved, 0);
  assert.equal(manager.busy, false);
});
test('persistence writes only display_order and keeps a concurrency guard', async () => {
  const { persist } = setup();
  const updates = [];
  const client = { from(table) {
    assert.equal(table, 'products');
    const call = { filters: [] }; updates.push(call);
    const query = { update(value) { call.value = value; return query; }, eq(...args) { call.filters.push(args); return query; },
      async select() { return { data: [{ id: 'ok' }], error: null }; } };
    return query;
  } };
  const items = fixture();
  const saved = await persist(client, [items[2], items[0], items[1]]);
  assert.equal(updates.length, 3);
  assert.deepEqual(Object.keys(updates[0].value), ['display_order']);
  assert.equal(updates[0].filters.find(([name]) => name === 'display_order')[1], 3);
  assert.equal(saved[0].display_order, 1);
  assert.equal(saved[0].price, 500);
});
test('concurrent edits stop persistence instead of silently overwriting positions', async () => {
  const { persist } = setup();
  const query = { update() { return query; }, eq() { return query; }, async select() { return { data: [], error: null }; } };
  await assert.rejects(persist({ from: () => query }, [...fixture()].reverse()), /changed in another session/);
});
