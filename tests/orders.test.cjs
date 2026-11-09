const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/create-order/index.ts', 'utf8')
  .replace(/^import .*;\r?\n/, ''));
const productId = '11111111-1111-4111-8111-111111111111';
const requestKey = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const details = () => ({ request_key: requestKey, product_id: productId, phone: '0771234567',
  colour: 'Rose', size: 38, heel: 5, expected_price: 12900 });
function png(valid = true) {
  const bytes = new Uint8Array(24);
  bytes.set(valid ? [137, 80, 78, 71, 13, 10, 26, 10] : [0]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 900); view.setUint32(20, 1280);
  return new File([bytes], 'order.png', { type: 'image/png' });
}
function request(input = details(), image = png()) {
  const body = new FormData();
  body.append('order', JSON.stringify(input)); body.append('image', image);
  return new Request('https://example.test/create-order', { method: 'POST', body });
}
function backend(options = {}) {
  const state = { order: options.order || null, inserts: 0, uploads: 0, signs: [], limits: [] };
  const db = {
    async rpc(name, input) {
      state.limits.push(input);
      return { data: options.allowed !== false, error: null };
    },
    from(table) {
      let mode = 'select'; let payload;
      const query = {
        select() { return query; }, eq() { return query; },
        insert(value) { mode = 'insert'; payload = value; return query; },
        update(value) { mode = 'update'; payload = value; return query; },
        async maybeSingle() {
          return { data: table === 'products'
            ? { id: productId, name: 'Golden Hour Heel', price: options.price || 12900, published: options.published !== false }
            : state.order, error: null };
        },
        async single() {
          if (mode === 'insert') {
            state.inserts++;
            state.order = { id: orderId, ...payload, image_path: null };
          }
          return { data: state.order, error: null };
        },
        then(resolve, reject) {
          if (mode === 'update') Object.assign(state.order, payload);
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'order-images');
      return {
        async upload(path, bytes, settings) {
          state.uploads++;
          assert.equal(settings.contentType, 'image/png');
          return { error: options.uploadFails ? new Error('Unavailable') : null };
        },
        async createSignedUrl(path, expiry) {
          state.signs.push({ path, expiry });
          return { data: { signedUrl: 'https://example.test/private-image?token=signed' }, error: null };
        },
      };
    } },
  };
  let handler;
  vm.runInNewContext(source, {
    createClient: () => db, Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } },
    Request, Response, FormData, File, Blob, Uint8Array, DataView, TextEncoder, crypto,
    console: { error() {} },
  });
  return { handler, state };
}

test('preflight supports anonymous storefront requests, GET is rejected', async () => {
  const { handler, state } = backend();
  const response = await handler(new Request('https://example.test', { method: 'OPTIONS' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
  assert.equal(state.limits.length, 0);
});
test('saves authoritative product pricing and a private expiring image link', async () => {
  const { handler, state } = backend();
  const response = await handler(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.id, orderId);
  assert.match(result.image_url, /token=signed/);
  assert.equal(result.request_key, undefined);
  assert.equal(state.order.product_price, 12900);
  assert.equal(state.order.courier_fee, 250);
  assert.equal(state.uploads, 1);
  assert.equal(state.signs[0].expiry, 604800);
  assert.equal(state.limits.length, 2);
  assert.ok(state.limits.every((limit) => /^[a-f0-9]{64}$/.test(limit.p_key)));
});
test('same request key retries reuse order and image', async () => {
  const { handler, state } = backend();
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 200);
  assert.equal(state.inserts, 1);
  assert.equal(state.uploads, 1);
  assert.equal(state.signs.length, 2);
});
test('an upload failure remains recoverable with the same request key', async () => {
  const { handler, state } = backend({ uploadFails: true });
  assert.equal((await handler(request())).status, 500);
  assert.equal(state.inserts, 1);
  assert.equal(state.order.image_path, null);
  const retry = backend({ order: state.order });
  assert.equal((await retry.handler(request())).status, 200);
  assert.equal(retry.state.inserts, 0);
  assert.equal(retry.state.uploads, 1);
});
test('rejects a changed submission using an existing request key', async () => {
  const { handler, state } = backend();
  await handler(request());
  assert.equal((await handler(request({ ...details(), size: 39 }))).status, 409);
  assert.equal(state.inserts, 1);
  assert.equal(state.uploads, 1);
});
test('rejects stale/tampered pricing and unpublished products', async () => {
  const stale = backend({ price: 15000 });
  assert.equal((await stale.handler(request())).status, 409);
  assert.equal(stale.state.inserts, 0);
  const hidden = backend({ published: false });
  assert.equal((await hidden.handler(request())).status, 400);
  assert.equal(hidden.state.inserts, 0);
});
test('rejects invalid phone, local preview ID, size and heel values', async () => {
  for (const patch of [{ phone: '077' }, { product_id: 'fallback' }, { size: 500 }, { heel: -1 }, { heel: 4.3 }]) {
    const { handler, state } = backend();
    assert.equal((await handler(request({ ...details(), ...patch }))).status, 400);
    assert.equal(state.inserts, 0);
  }
});
test('malformed and null submissions receive validation errors, not server errors', async () => {
  const { handler } = backend();
  assert.equal((await handler(request(null))).status, 400);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: 'not multipart' }))).status, 400);
});
test('rejects non-PNG bytes and incorrect image dimensions', async () => {
  const { handler, state } = backend();
  assert.equal((await handler(request(details(), png(false)))).status, 400);
  const wrong = new Uint8Array(await png().arrayBuffer());
  new DataView(wrong.buffer).setUint32(16, 1);
  assert.equal((await handler(request(details(), new File([wrong], 'bad.png', { type: 'image/png' })))).status, 400);
  assert.equal(state.uploads, 0);
});
test('rate-limits before order reads or uploads', async () => {
  const { handler, state } = backend({ allowed: false });
  assert.equal((await handler(request())).status, 429);
  assert.equal(state.inserts, 0);
  assert.equal(state.uploads, 0);
});
test('rejects oversized payloads even without Content-Length', async () => {
  const { handler, state } = backend();
  const response = await handler(new Request('https://example.test', { method: 'POST', body: new Uint8Array(3300001) }));
  assert.equal(response.status, 413);
  assert.equal(state.inserts, 0);
});
