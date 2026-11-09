const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.events = {}; this.value = ''; this.style = {}; }
  append(...children) { children.forEach((child) => { child.parent = this; this.children.push(child); }); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }
  async emit(name) { for (const fn of this.events[name] || []) await fn(); }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
}
function editor() {
  const elements = new Map();
  const el = (id) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const revoked = [];
  let count = 0;
  const context = { window: {}, document: { getElementById: el, createElement: (tag) => new Element(tag) },
    URL: { createObjectURL: () => `blob:test-${++count}`, revokeObjectURL: (url) => revoked.push(url) } };
  vm.runInNewContext(fs.readFileSync('Backend/product-colours.js', 'utf8'), context);
  const api = context.window.createProductColourEditor((url) => `https://example.test/${url}`);
  const row = (index = 0) => {
    const card = el('product-colour-list').children[index];
    return { card, name: card.children[0].children[0].children[0], hex: card.children[0].children[1].children[0],
      image: card.children[1].children[0], upload: card.children[2].children[0],
      clearImage: card.children[3].children[0], remove: card.children[3].children[1], error: card.children[4] };
  };
  return { api, el, row, revoked };
}
test('existing colour photos and extra metadata survive name/hex edits', () => {
  const { api, row } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'rose.png', custom: 'keep' }]);
  row().name.value = 'Deep Rose';
  const snapshot = api.snapshot();
  assert.equal(snapshot[0].data.name, 'Deep Rose');
  assert.equal(snapshot[0].data.image, 'rose.png');
  assert.equal(snapshot[0].data.custom, 'keep');
});
test('legacy image_url is preserved as image and can be explicitly removed', async () => {
  const { api, row } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image_url: 'legacy.png' }]);
  assert.equal(api.snapshot()[0].data.image, 'legacy.png');
  await row().clearImage.emit('click');
  const data = api.snapshot()[0].data;
  assert.equal(data.image, '');
  assert.equal(data.image_url, undefined);
});
test('a new photo is previewed locally and only uploaded on save', async () => {
  const { api, row, revoked } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'old.png' }]);
  const file = new File(['png'], 'rose.png', { type: 'image/png' });
  row().upload.files = [file];
  await row().upload.emit('change');
  assert.match(row().image.src, /^blob:/);
  const calls = [];
  const result = await api.upload(api.snapshot(), async (value) => { calls.push(value); return 'https://storage.test/new.png'; });
  assert.equal(calls[0], file);
  assert.equal(result[0].image, 'https://storage.test/new.png');
  api.setValue([]);
  assert.deepEqual(revoked, ['blob:test-1']);
});
test('unchanged photo URLs never upload and multiple colour replacements are independent', async () => {
  const { api, row } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'rose.png' }, { name: 'Black', hex: '#000', image: 'black.png' }]);
  row(1).upload.files = [new File(['new'], 'black.jpg', { type: 'image/jpeg' })];
  await row(1).upload.emit('change');
  let uploads = 0;
  const result = await api.upload(api.snapshot(), async () => { uploads++; return 'new-black.jpg'; });
  assert.equal(uploads, 1);
  assert.equal(result[0].image, 'rose.png');
  assert.equal(result[1].image, 'new-black.jpg');
});
test('invalid/oversize files keep the current photo intact', async () => {
  const { api, row } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'rose.png' }]);
  for (const file of [new File(['text'], 'bad.txt', { type: 'text/plain' }), { size: 6 * 1024 * 1024, type: 'image/png' }]) {
    row().upload.files = [file];
    await row().upload.emit('change');
    assert.match(row().error.textContent, /maximum 5 MB/);
    assert.equal(api.snapshot()[0].data.image, 'rose.png');
  }
});
test('removing/replacing a local preview revokes its blob URL', async () => {
  const { api, row, revoked } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728' }]);
  row().upload.files = [new File(['image'], 'rose.png', { type: 'image/png' })];
  await row().upload.emit('change');
  await row().remove.emit('click');
  assert.equal(api.snapshot().length, 0);
  assert.deepEqual(revoked, ['blob:test-1']);
});
test('colour validation rejects empty names, invalid hex and duplicate names', () => {
  for (const colours of [[{ name: '', hex: '#000' }], [{ name: 'Rose', hex: '#badhex' }], [{ name: 'Rose', hex: '#000' }, { name: 'rose', hex: '#fff' }]]) {
    const { api } = editor(); api.setValue(colours);
    assert.throws(() => api.snapshot());
  }
});
test('old products with more than eight colours are not silently truncated', () => {
  const { api, el } = editor();
  api.setValue(Array.from({ length: 10 }, (_, index) => ({ name: `Colour ${index}`, hex: '#123456', image: `${index}.png` })));
  assert.equal(api.snapshot().length, 10);
  assert.equal(el('add-product-colour').disabled, true);
});
test('upload failures reject without mutating the editable image references', async () => {
  const { api, row } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'old.png' }]);
  row().upload.files = [new File(['new'], 'rose.png', { type: 'image/png' })];
  await row().upload.emit('change');
  await assert.rejects(api.upload(api.snapshot(), async () => { throw new Error('Upload failed'); }), /Upload failed/);
  assert.equal(api.snapshot()[0].data.image, 'old.png');
});
test('legacy product cover is preserved as the first colour photo when no colour photos exist', () => {
  const { api } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728' }], 'old-cover.jpg');
  assert.equal(api.snapshot()[0].data.image, 'old-cover.jpg');
  api.setValue([], 'old-cover.jpg');
  assert.equal(api.snapshot()[0].data.name, 'Original');
  assert.equal(api.snapshot()[0].data.image, 'old-cover.jpg');
});
test('existing colour-specific photos take precedence over a legacy cover', () => {
  const { api } = editor();
  api.setValue([{ name: 'Rose', hex: '#c93728', image: 'rose.jpg' }], 'old-cover.jpg');
  assert.equal(api.coverImage(api.snapshot().map((entry) => entry.data)), 'rose.jpg');
});
test('first available colour photo becomes the main image and a photo is mandatory', () => {
  const { api } = editor();
  assert.equal(api.coverImage([{ name: 'Rose', image: '' }, { name: 'Black', image: 'black.jpg' }, { image: 'gold.jpg' }]), 'black.jpg');
  assert.throws(() => api.coverImage([]), /at least one colour photo/);
  assert.throws(() => api.coverImage([{ image: '' }]), /at least one colour photo/);
});
