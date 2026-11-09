const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/delete-product-images/index.ts', 'utf8').replace(/^import .*;\r?\n/, ''));
const id = '33333333-3333-4333-8333-333333333333';
const request = (body = { ids: [id] }, auth = true) => new Request('https://example.test/delete-product-images', {
  method: 'POST', headers: auth ? { authorization: 'Bearer admin-session' } : {}, body: JSON.stringify(body),
});
function backend(options = {}) {
  const state = { claims: [], removed: [], updates: [], finished: 0 };
  const db = {
    auth: { async getUser() { return { data: { user: options.expired ? null : { id: 'admin' } }, error: null }; } },
    from(table) {
      let deleting = false;
      const q = {
        select() { return q; }, eq() { return q; },
        update(value) { state.updates.push(value); return q; }, delete() { deleting = true; return q; },
        async maybeSingle() { assert.equal(table, 'cms_admins'); return { data: options.nonAdmin ? null : { user_id: 'admin' }, error: null }; },
        then(resolve, reject) { if (deleting) state.finished++; return Promise.resolve({ error: null }).then(resolve, reject); },
      }; return q;
    },
    async rpc(name, args) {
      assert.equal(name, 'claim_product_image_trash'); state.claims.push(args.p_id);
      return { data: options.inUse ? null : { id, image_path: 'server-chosen.png', claim_token: 'lease-token' }, error: options.claimError ? { message: 'Failed' } : null };
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'product-images');
      return { async remove(paths) { state.removed.push(...paths); return { error: options.storageFails ? { message: 'Unavailable' } : null }; } };
    } },
  };
  let handler;
  vm.runInNewContext(source, { createClient: () => db, Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } }, Request, Response, Uint8Array, TextDecoder });
  return { handler, state };
}
test('trash deletion requires a valid CMS-admin session', async () => {
  const anon = backend();
  assert.equal((await anon.handler(request(undefined, false))).status, 401);
  assert.equal(anon.state.claims.length, 0);
  const expired = backend({ expired: true });
  assert.equal((await expired.handler(request())).status, 401);
  const denied = backend({ nonAdmin: true });
  assert.equal((await denied.handler(request())).status, 403);
  assert.equal(denied.state.claims.length, 0);
});
test('backend claims the trash row and only deletes the server-selected bucket/path', async () => {
  const { handler, state } = backend();
  const response = await handler(request({ ids: [id], image_path: 'do-not-trust-this.png' }));
  assert.deepEqual(await response.json(), { deleted: 1, skipped: 0, failed: 0 });
  assert.deepEqual(state.removed, ['server-chosen.png']);
  assert.equal(state.finished, 1);
});
test('referenced/already removed images are skipped without storage deletion', async () => {
  const { handler, state } = backend({ inUse: true });
  assert.deepEqual(await (await handler(request())).json(), { deleted: 0, skipped: 1, failed: 0 });
  assert.equal(state.removed.length, 0);
});
test('storage failures preserve the trash row for retry', async () => {
  const { handler, state } = backend({ storageFails: true });
  assert.deepEqual(await (await handler(request())).json(), { deleted: 0, skipped: 0, failed: 1 });
  assert.equal(state.finished, 0);
  assert.equal(state.updates[0].state, 'pending');
});
test('claim failures never reach storage and duplicate IDs are processed once', async () => {
  const failed = backend({ claimError: true });
  assert.equal((await (await failed.handler(request())).json()).failed, 1);
  assert.equal(failed.state.removed.length, 0);
  const duplicate = backend();
  await duplicate.handler(request({ ids: [id, id] }));
  assert.equal(duplicate.state.claims.length, 1);
});
test('invalid IDs and oversized batches are rejected', async () => {
  for (const body of [null, {}, { ids: [] }, { ids: ['../image.png'] }, { ids: Array(26).fill(id) }]) {
    const { handler, state } = backend();
    assert.equal((await handler(request(body))).status, 400);
    assert.equal(state.claims.length, 0);
  }
});

class Element {
  constructor() { this.children = []; this.events = {}; this.textContent = ''; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(name, fn) { this.events[name] = fn; }
  async emit(name) { return this.events[name]?.(); }
}
function ui(options = {}) {
  const elements = new Map();
  const el = (name) => { if (!elements.has(name)) elements.set(name, new Element()); return elements.get(name); };
  const state = { calls: [], status: [], removed: false };
  const client = {
    from() {
      const q = { select() { return q; }, order() { return q; }, range() { return q; },
        then(resolve, reject) { return (options.pending || Promise.resolve({
          data: state.removed ? [] : [{ id, image_path: 'old.png', created_at: '2026-11-09T10:00:00Z', state: 'pending' }],
          count: state.removed ? 0 : 1, error: options.missing ? { message: 'Table missing' } : null,
        })).then(resolve, reject); } }; return q;
    },
    storage: { from: () => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://example.test/${path}` } }) }) },
    functions: { async invoke(name, { body }) {
      assert.equal(name, 'delete-product-images'); state.calls.push(body.ids);
      if (options.notDeployed) return { error: { context: { status: 404 }, message: 'Missing' } };
      state.removed = true; return { data: { deleted: 1, skipped: 0, failed: 0 }, error: null };
    } },
  };
  const context = { window: { confirm: () => options.confirm !== false }, document: { createElement: () => new Element(), getElementById: el } };
  vm.runInNewContext(fs.readFileSync('Backend/image-trash.js', 'utf8'), context);
  const manager = context.window.createImageTrash(client, (message) => state.status.push(message));
  return { manager, el, state };
}
test('trash UI displays photos and deletes only after confirmation', async () => {
  const cancelled = ui({ confirm: false }); await cancelled.manager.load();
  await cancelled.el('image-trash-list').children[0].children[3].emit('click');
  assert.equal(cancelled.state.calls.length, 0);
  const { manager, el, state } = ui(); await manager.load();
  assert.equal(el('image-trash-count').textContent, '1 image');
  assert.equal(el('image-trash-list').children[0].children[0].src, 'https://example.test/old.png');
  await el('image-trash-list').children[0].children[3].emit('click');
  assert.equal(state.calls[0][0], id);
  assert.equal(el('image-trash-list').children.length, 0);
});
test('missing migration/function has clear setup guidance without claiming deletion', async () => {
  const missing = ui({ missing: true }); await missing.manager.load();
  assert.match(missing.el('image-trash-message').textContent, /migration/);
  const notDeployed = ui({ notDeployed: true }); await notDeployed.manager.load();
  await notDeployed.el('image-trash-list').children[0].children[3].emit('click');
  assert.match(notDeployed.el('image-trash-message').textContent, /Deploy.*delete-product-images/);
  assert.equal(notDeployed.state.removed, false);
});
test('sign-out clears trash data and ignores pending responses', async () => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const { manager, el } = ui({ pending });
  const loading = manager.load(); manager.clear();
  finish({ data: [{ id }], count: 1, error: null }); await loading;
  assert.equal(el('image-trash-list').children.length, 0);
});
