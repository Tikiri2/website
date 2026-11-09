const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/order-image/index.ts', 'utf8')
  .replace(/^import .*;\r?\n/, ''));
const token = 'a'.repeat(32);
function setup(options = {}) {
  const calls = { signs: [], lookups: 0 };
  const db = {
    async rpc() { return { data: options.allowed !== false, error: null }; },
    from() {
      const query = {
        select(fields) { assert.equal(fields, 'image_path, image_share_expires_at'); return query; },
        eq(field, value) { assert.equal(field, 'image_share_token'); assert.equal(value, token); return query; },
        async maybeSingle() {
          calls.lookups++;
          return { data: options.missing ? null : {
            image_path: options.noImage ? null : 'private/order.png',
            image_share_expires_at: new Date(Date.now() + (options.remaining ?? 600) * 1000).toISOString(),
          }, error: null };
        },
      }; return query;
    },
    storage: { from(bucket) {
      assert.equal(bucket, 'order-images');
      return { async createSignedUrl(path, expiry) {
        calls.signs.push({ path, expiry });
        return { data: { signedUrl: 'https://example.test/private-image?token=signed' }, error: null };
      } };
    } },
  };
  let handler;
  vm.runInNewContext(source, {
    createClient: () => db, Deno: { env: { get: () => 'server-only' }, serve: (fn) => { handler = fn; } },
    Request, Response, Uint8Array, TextEncoder, TextDecoder, crypto,
  });
  return { handler, calls };
}
const request = (value = token) => new Request('https://example.test/order-image', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: value }),
});
test('short link resolves only to a temporary image URL, never customer details', async () => {
  const { handler, calls } = setup();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { image_url: 'https://example.test/private-image?token=signed' });
  assert.equal(calls.signs[0].expiry, 300);
});
test('temporary image URL cannot outlive the short link', async () => {
  const { handler, calls } = setup({ remaining: 40 });
  assert.equal((await handler(request())).status, 200);
  assert.ok(calls.signs[0].expiry > 0 && calls.signs[0].expiry <= 40);
});
test('expired, nonexistent and incomplete image links expose no order', async () => {
  for (const options of [{ remaining: -1 }, { missing: true }, { noImage: true }]) {
    const { handler, calls } = setup(options);
    assert.equal((await handler(request())).status, 404);
    assert.equal(calls.signs.length, 0);
  }
});
test('rejects missing/invalid tokens before database lookup', async () => {
  for (const value of ['', 'order-id', null, 'a'.repeat(33)]) {
    const { handler, calls } = setup();
    assert.equal((await handler(request(value))).status, 400);
    assert.equal(calls.lookups, 0);
  }
});
test('viewer endpoint rejects oversized streamed input and rate-limits requests', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(1025) }))).status, 400);
  assert.equal(calls.lookups, 0);
  const limited = setup({ allowed: false });
  assert.equal((await limited.handler(request())).status, 429);
  assert.equal(limited.calls.lookups, 0);
});
test('viewer permits CORS preflight but not GET token enumeration', async () => {
  const { handler } = setup();
  assert.equal((await handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handler(new Request('https://example.test'))).status, 405);
});

function viewer(hash, response = { image_url: 'https://example.test/image' }, ok = true) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, events: {}, addEventListener(name, fn) { this.events[name] = fn; } });
    return elements.get(id);
  };
  const calls = [];
  const context = {
    window: { location: { hash }, SHUES_CMS_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' } },
    document: { getElementById: get },
    async fetch(url, options) { calls.push({ url, options }); return { ok, async json() { return response; } }; },
  };
  vm.runInNewContext(fs.readFileSync('order-view.js', 'utf8'), context);
  return { get, calls };
}
test('viewer sends fragment capability in POST body, not request URL', async () => {
  const { get, calls } = viewer(`#${token}`);
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].url.includes(token));
  assert.equal(JSON.parse(calls[0].options.body).token, token);
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(get('order-view-image').src, 'https://example.test/image');
  get('order-view-image').events.load();
  assert.equal(get('order-view-image').hidden, false);
});
test('viewer handles invalid and expired links safely', async () => {
  const invalid = viewer('#bad');
  assert.equal(invalid.calls.length, 0);
  assert.match(invalid.get('order-view-message').textContent, /invalid/);
  const expired = viewer(`#${token}`, { error: 'Link expired' }, false);
  await new Promise(setImmediate);
  assert.equal(expired.get('order-view-message').textContent, 'Link expired');
  assert.equal(expired.get('order-view-retry').hidden, false);
});
