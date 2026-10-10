import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as tracking from '../firebase-functions/tracking-model.mjs';
import * as workflow from '../firebase-functions/workflow.mjs';

const require = createRequire(import.meta.url);
const orderId = 'ORD-202610-TEST123';
const order = { id: orderId, status: 'Menunggu Konfirmasi', metode: 'antar_sendiri', pelanggan: { nama: 'Private Name', telepon: '+6281234567890' }, items: [{ kategori: 'cuci', qty: 1, nama_snapshot: 'White Clean' }], status_history: [], catatan: 'Private Note' };
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }

function harness() {
  const documents = new Map([['orders/' + orderId, structuredClone(order)], ['services/cuci', { nama: 'White Clean', harga: 35000, kategori: 'cuci', aktif: true }]]);
  const snapshot = (id, data) => ({ id, exists: data !== undefined, data: () => structuredClone(data) });
  function patch(path, values) {
    const data = documents.get(path) || {};
    for (const [key, value] of Object.entries(values)) data[key] = value?.union ? [...(data[key] || []), value.union] : value;
    documents.set(path, data);
  }
  function collection(name) {
    function selection(filters = [], max = Infinity) {
      return { where: (field, op, value) => selection([...filters, [field, value]], max), limit: n => selection(filters, n), get: async () => {
        const docs = [...documents.entries()].filter(([path, value]) => path.startsWith(name + '/') && filters.every(([key, expected]) => value[key] === expected)).slice(0, max).map(([path, value]) => snapshot(path.split('/')[1], value));
        return { docs, empty: !docs.length, forEach: callback => docs.forEach(callback) };
      } };
    }
    return { ...selection(), doc: id => ({ path: name + '/' + id, get: async () => snapshot(id, documents.get(name + '/' + id)), update: async values => patch(name + '/' + id, values), create: async values => { if (documents.has(name + '/' + id)) throw new Error('duplicate'); documents.set(name + '/' + id, values); } }) };
  }
  const db = { collection, runTransaction: async callback => {
    const writes = [];
    const result = await callback({ get: ref => ref.get(), set: (ref, value) => writes.push(() => documents.set(ref.path, value)), update: (ref, value) => writes.push(() => patch(ref.path, value)) });
    writes.forEach(write => write()); return result;
  } };
  const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp: () => ({ seconds: 1000 }), arrayUnion: value => ({ union: value }) }, Timestamp: { fromMillis: value => ({ seconds: value / 1000 }) } });
  const admin = { initializeApp() {}, firestore };
  const exports = {};
  const source = readFileSync(new URL('../firebase-functions/index.js', import.meta.url), 'utf8')
    .replace("import('./tracking-model.mjs')", 'Promise.resolve(tracking)')
    .replace("import('./workflow.mjs')", 'Promise.resolve(workflowStub)');
  const sandbox = { require: name => name === 'firebase-admin' ? admin : name === 'firebase-functions' ? { https: { onCall: callback => callback, HttpsError } } : require(name), exports, tracking, workflowStub: workflow, process: { env: {} }, URLSearchParams, AbortSignal, fetch: async () => ({ json: async () => ({ success: true }) }) };
  vm.runInNewContext(source, sandbox, { filename: 'firebase-functions/index.js' });
  return { handlers: exports, documents, sandbox };
}
const guest = { rawRequest: { ip: '127.0.0.1' } };
const adminContext = { auth: { uid: 'admin', token: { role: 'admin' } } };
const isError = code => error => error.code === code;

test('guest must match both code and phone; payload contains no PII', async () => {
  const { handlers } = harness();
  await assert.rejects(handlers.getOrderProgress({ code: orderId, phone: '081234567891' }, guest), isError('not-found'));
  const result = await handlers.getOrderProgress({ code: orderId, phone: '081234567890' }, guest);
  assert.equal(result.code, orderId);
  assert.doesNotMatch(JSON.stringify(result), /Private|6281234567890/);
});
test('invoice lookup supports legacy auto-ID order documents', async () => {
  const { handlers, documents } = harness();
  documents.delete('orders/' + orderId);
  documents.set('orders/legacy-doc', { ...order, id: 'legacy-doc', invoice_number: orderId });
  documents.set('gallery/legacy-gallery', { order_id: orderId, before_url: 'https://res.cloudinary.com/demo/b.jpg', after_url: 'https://res.cloudinary.com/demo/a.jpg' });
  const result = await handlers.getOrderProgress({ code: orderId, phone: '081234567890' }, guest);
  assert.equal(result.code, orderId); assert.equal(result.items[0].photos.length, 1);
});
test('wrong code and wrong phone use the same failure code', async () => {
  const { handlers } = harness();
  for (const credentials of [{ code: orderId, phone: '081234567891' }, { code: 'ORD-NOTFOUND-1234', phone: '081234567890' }]) await assert.rejects(handlers.getOrderProgress(credentials, guest), isError('not-found'));
});
test('rate limit applies to successful and failed attempts', async () => {
  const { handlers } = harness();
  for (let i = 0; i < 12; i++) await handlers.getOrderProgress({ code: orderId, phone: '081234567890' }, guest);
  await assert.rejects(handlers.getOrderProgress({ code: orderId, phone: '081234567890' }, guest), isError('resource-exhausted'));
});
test('guest and non-admin cannot change status or order photos', async () => {
  const { handlers } = harness();
  for (const context of [guest, { auth: { uid: 'user', token: {} } }]) {
    await assert.rejects(handlers.updateOrderStatus({ orderId, newStatus: 'Dikonfirmasi' }, context), isError('permission-denied'));
    await assert.rejects(handlers.updateOrderBeforeAfter({ orderId }, context), isError('permission-denied'));
  }
});
test('invalid transition leaves status/history unchanged; valid transition returns full order', async () => {
  const { handlers, documents } = harness();
  await assert.rejects(handlers.updateOrderStatus({ orderId, newStatus: 'Selesai' }, adminContext), isError('failed-precondition'));
  assert.equal(documents.get('orders/' + orderId).status, 'Menunggu Konfirmasi');
  const result = await handlers.updateOrderStatus({ orderId, newStatus: 'Dikonfirmasi' }, adminContext);
  assert.equal(result.id, orderId); assert.equal(result.status, 'Dikonfirmasi'); assert.equal(result.items.length, 1);
  assert.equal(result.status_history.at(-1).oleh, 'admin');
});
test('server denies missing captcha secret instead of silently passing verification', async () => {
  const { handlers, documents } = harness();
  await assert.rejects(handlers.verifyCaptchaAndCreateOrder({ pelanggan: { nama: 'Test', telepon: '081234567890' }, captchaToken: 'fake', items: [{ service_id: 'cuci', qty: 1 }] }, guest), isError('failed-precondition'));
  assert.equal([...documents.keys()].filter(key => key.startsWith('orders/')).length, 1);
});
test('server recomputes prices and creates a trackable order ID', async () => {
  const { handlers, sandbox, documents } = harness();
  sandbox.process.env.RECAPTCHA_SECRET_KEY = 'test-only';
  const result = await handlers.verifyCaptchaAndCreateOrder({ pelanggan: { nama: 'Test', telepon: '081234567890' }, captchaToken: 'valid', items: [{ service_id: 'cuci', qty: 2, harga: 1 }], total_harga: 2, metode: 'antar_sendiri' }, guest);
  assert.equal(result.total_harga, 70000);
  assert.ok(documents.has('orders/' + result.id));
  assert.equal((await handlers.getOrderProgress({ code: result.id, phone: '081234567890' }, guest)).code, result.id);
});
test('incomplete or foreign-host photo uploads are refused', async () => {
  const { handlers } = harness();
  for (const before_after of [{ before_url: 'https://res.cloudinary.com/demo/a.jpg' }, { before_url: 'data:image/png;base64,abc', after_url: 'https://evil.test/a.jpg' }]) await assert.rejects(handlers.updateOrderBeforeAfter({ orderId, before_after }, adminContext), isError('invalid-argument'));
});

test('before-after publishing saves the order and gallery together without duplicate entries', async () => {
  const { handlers, documents } = harness();
  const data = { orderId, publishGallery: true, before_after: { before_url: 'https://res.cloudinary.com/demo/b.jpg', after_url: 'https://res.cloudinary.com/demo/a.jpg', caption: 'Hasil perawatan', customer_name: 'Private Name' } };
  await handlers.updateOrderBeforeAfter(data, adminContext);
  await handlers.updateOrderBeforeAfter(data, adminContext);
  assert.ok(documents.get('orders/' + orderId).before_after);
  assert.equal([...documents.keys()].filter(key => key.startsWith('gallery/')).length, 1);
  assert.doesNotMatch(JSON.stringify(documents.get('gallery/order-' + orderId)), /Private Name|customer_name/);
});
test('cannot publish before-after for a nonexistent order', async () => {
  const { handlers, documents } = harness();
  await assert.rejects(handlers.updateOrderBeforeAfter({ orderId: 'ORD-MISSING-1234', publishGallery: true, before_after: { before_url: 'https://res.cloudinary.com/demo/b.jpg', after_url: 'https://res.cloudinary.com/demo/a.jpg' } }, adminContext), isError('not-found'));
  assert.equal([...documents.keys()].filter(key => key.startsWith('gallery/')).length, 0);
});
