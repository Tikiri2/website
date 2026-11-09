const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/delete-order/index.ts', 'utf8')
  .replace(/^import .*;\r?\n/, ''));
const id = '33333333-3333-4333-8333-333333333333';
const updated = '2026-11-09T10:00:00Z';
const request = (body = { action: 'delete', id, updated_at: updated }, auth = true) => new Request('https://example.test/delete-order', {
  method: 'POST', headers: auth ? { authorization: 'Bearer test-session' } : {}, body: JSON.stringify(body),
});
function setup(options = {}) {
  const state = { removed: false, jobs: [], calls: [], rpc: [] };
  const db = {
    auth: { async getUser(token) {
      assert.equal(token, 'test-session');
      return { data: { user: options.invalidSession ? null : { id: 'admin-user' } }, error: null };
    } },
    async rpc(name, args) {
      state.rpc.push({ name, args });
      if (options.conflict) return { error: { code: '40001' } };
      state.removed = true;
      state.jobs = [{ id, image_path: `${id}/order.png` }];
      return { data: { deleted: true }, error: null };
    },
    from(table) {
      state.calls.push(table);
      let deleting = false;
      let head = false;
      const query = {
        select(fields, settings) { head = settings?.head; return query; },
        eq() { return query; }, order() { return query; }, limit() { return query; },
        delete() { deleting = true; return query; },
        async maybeSingle() { return { data: options.nonAdmin ? null : { user_id: 'admin-user' }, error: null }; },
        then(resolve, reject) {
          if (deleting) state.jobs = [];
          return Promise.resolve(head ? { count: state.jobs.length, error: null } : { data: state.jobs, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'order-images');
      return { async remove(paths) {
        assert.deepEqual(Array.from(paths), [`${id}/order.png`]);
        return { error: options.storageFails ? { message: 'Storage unavailable' } : null };
      } };
    } },
  };
  let handler;
  vm.runInNewContext(source, {
    createClient: () => db, Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } },
    Request, Response, Uint8Array, TextDecoder,
  });
  return { handler, state };
}
test('order deletion rejects anonymous and invalid sessions before touching orders', async () => {
  const anonymous = setup();
  assert.equal((await anonymous.handler(request(undefined, false))).status, 401);
  assert.equal(anonymous.state.calls.length, 0);
  const invalid = setup({ invalidSession: true });
  assert.equal((await invalid.handler(request())).status, 401);
  assert.equal(invalid.state.rpc.length, 0);
});
test('signed-in users not on CMS allowlist cannot delete or clean up images', async () => {
  const { handler, state } = setup({ nonAdmin: true });
  assert.equal((await handler(request())).status, 403);
  assert.equal((await handler(request({ action: 'cleanup' }))).status, 403);
  assert.equal(state.rpc.length, 0);
  assert.deepEqual(state.jobs, []);
});
test('admin delete uses transactional timestamp-checked RPC then removes image and cleanup job', async () => {
  const { handler, state } = setup();
  const result = await handler(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { deleted: true, cleanup_pending: 0 });
  assert.equal(state.rpc[0].name, 'delete_order_record');
  assert.equal(state.rpc[0].args.p_id, id);
  assert.equal(state.rpc[0].args.p_updated_at, updated);
  assert.equal(state.removed, true);
  assert.equal(state.jobs.length, 0);
});
test('stale delete cannot remove an order edited by another admin', async () => {
  const { handler, state } = setup({ conflict: true });
  assert.equal((await handler(request())).status, 409);
  assert.equal(state.removed, false);
});
test('storage failures preserve durable cleanup job for a later retry', async () => {
  const { handler, state } = setup({ storageFails: true });
  const result = await handler(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).cleanup_pending, 1);
  assert.equal(state.removed, true);
  assert.equal(state.jobs.length, 1);
});
test('cleanup action removes pending images without invoking order deletion', async () => {
  const { handler, state } = setup();
  state.jobs = [{ id, image_path: `${id}/order.png` }];
  assert.equal((await handler(request({ action: 'cleanup' }))).status, 200);
  assert.equal(state.jobs.length, 0);
  assert.equal(state.rpc.length, 0);
});
test('invalid IDs/actions/timestamps are rejected', async () => {
  for (const body of [{ action: 'delete', id: 'bad', updated_at: updated }, { action: 'delete', id, updated_at: 'bad' }, { action: 'publish' }, null]) {
    const { handler, state } = setup();
    assert.equal((await handler(request(body))).status, 400);
    assert.equal(state.rpc.length, 0);
  }
});
