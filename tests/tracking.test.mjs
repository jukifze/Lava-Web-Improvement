import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, validTrackingCredentials, toIso, getPhotoPairs, projectTrackingOrder } from '../firebase-functions/tracking-model.mjs';
import { getNextOrderStatuses } from '../firebase-functions/workflow.mjs';
import { buildProgress, formatTrackingDate } from '../src/features/orders/trackingModel.js';

const before = 'https://res.cloudinary.com/demo/image/upload/before.jpg';
const after = 'https://res.cloudinary.com/demo/image/upload/after.jpg';
const item = { service_id: 'cuci', nama_snapshot: 'White Clean', kategori: 'cuci', qty: 2 };
const base = { id: 'ORD-202610-ABCDEF', metode: 'dijemput', status: 'Diproses', items: [item],
  created_at: '2026-10-10T01:00:00Z', status_history: [{ status: 'Diproses', timestamp: '2026-10-10T04:00:00Z', catatan: 'Internal only', oleh: 'admin-secret' }] };

test('normalizes Indonesian phone formats without changing international prefix', () => {
  assert.equal(normalizePhone('0812 3456 7890'), '6281234567890');
  assert.equal(normalizePhone('+62 812-3456-7890'), '6281234567890');
});
test('validates both credentials and refuses document path injection', () => {
  assert.ok(validTrackingCredentials(base.id, '081234567890'));
  for (const code of ['../orders', 'ORD-../../private', '', 'X-1234']) assert.equal(validTrackingCredentials(code, '081234567890'), false);
  for (const phone of ['', '1234', '+1234567890']) assert.equal(validTrackingCredentials(base.id, phone), false);
});
test('converts Firestore timestamps and never fabricates malformed timestamps', () => {
  assert.equal(toIso({ seconds: 0 }), '1970-01-01T00:00:00.000Z');
  assert.equal(toIso({ _seconds: 0 }), '1970-01-01T00:00:00.000Z');
  assert.equal(toIso({ toDate: () => new Date(0) }), '1970-01-01T00:00:00.000Z');
  assert.equal(toIso('bad date'), null);
  assert.equal(formatTrackingDate(null), null);
  assert.match(formatTrackingDate('2026-10-10T01:00:00Z'), /08\.00 WIB/);
});
test('whitelist strips all personal data, internal notes and unknown statuses', () => {
  const projected = projectTrackingOrder({ ...base, pelanggan: { nama: 'Secret', telepon: '0812', alamat: 'Secret Road' }, customer_phone: 'secret-phone', alamat_jemput: { lat: 1, lng: 2 }, catatan: 'secret-note', total_harga: 90000 });
  assert.deepEqual(Object.keys(projected).sort(), ['code', 'createdAt', 'history', 'items', 'method', 'photos', 'status', 'updatedAt'].sort());
  assert.deepEqual(projected.history[0], { status: 'Diproses', timestamp: '2026-10-10T04:00:00.000Z' });
  assert.doesNotMatch(JSON.stringify(projected), /Secret|secret-|Internal|admin-secret/);
});
test('only complete Cloudinary pairs are published to tracking', () => {
  assert.equal(getPhotoPairs({ before_url: before }).length, 0);
  assert.equal(getPhotoPairs({ before_url: 'javascript:alert(1)', after_url: after }).length, 0);
  assert.equal(getPhotoPairs({ before_url: 'https://res.cloudinary.com.evil.test/a', after_url: after }).length, 0);
  assert.equal(getPhotoPairs({ before_url: before, after_url: after }).length, 1);
});
test('pairs imported photos by angle, not array order', () => {
  const projected = projectTrackingOrder({ ...base, items: [{ ...item, gallery: [{ kind: 'after', slot: 2, url: after }, { kind: 'before', slot: 1, url: before }, { kind: 'before', slot: 2, url: before }] }] });
  assert.equal(projected.items[0].photos.length, 1);
  assert.equal(projected.items[0].photos[0].slot, 2);
});
test('supports existing order-detail upload and linked gallery item', () => {
  assert.equal(projectTrackingOrder({ ...base, before_after: { before_url: before, after_url: after } }).items[0].photos.length, 1);
  assert.equal(projectTrackingOrder(base, [{ before_url: before, after_url: after }]).items[0].photos.length, 1);
});
test('does not attach another item photo to a multi-item order', () => {
  const projected = projectTrackingOrder({ ...base, items: [item, { ...item, service_id: 'other' }] }, [{ item_id: 'no-match', before_url: before, after_url: after }]);
  assert.ok(projected.items.every(entry => !entry.photos.length));
});
test('order-level photos on a multi-item order are labeled as general, not assigned to the first shoe', () => {
  const projected = projectTrackingOrder({ ...base, items: [item, { ...item, service_id: 'other' }], before_after: { before_url: before, after_url: after } });
  assert.equal(projected.photos.length, 1);
  assert.ok(projected.items.every(entry => !entry.photos.length));
});
test('malformed slot metadata cannot bypass the primitive allowlist', () => {
  assert.equal(getPhotoPairs(null).length, 0);
  const pairs = getPhotoPairs({ slots: [null, { before_url: before, after_url: after, slot: { private: 'phone' }, framing_before: { private: 'phone' } }] });
  assert.equal(pairs.length, 1); assert.equal(pairs[0].slot, 2);
  assert.equal(pairs[0].framing_before, null);
  assert.doesNotMatch(JSON.stringify(pairs), /private|phone/);
});
test('pickup timeline follows the existing six-step workflow', () => {
  const result = buildProgress(projectTrackingOrder(base));
  assert.deepEqual(result.stages.map(stage => stage.status), ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Sedang Dijemput', 'Diproses', 'Siap Diantar', 'Selesai']);
  assert.equal(result.stages[3].state, 'current');
  assert.equal(result.stages[1].timestamp, null);
});
test('soap shipping has no fictional pickup or treatment step', () => {
  const order = { ...base, status: 'Dikirim', metode: 'dikirim', items: [{ ...item, kategori: 'sabun' }], status_history: [] };
  assert.deepEqual(buildProgress(projectTrackingOrder(order)).stages.map(stage => stage.status), ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Dikirim', 'Selesai']);
  assert.deepEqual(getNextOrderStatuses({ ...order, status: 'Dikonfirmasi' }), ['Dikirim', 'Dibatalkan']);
});
test('outlet order skips pickup and uses ready-for-collection stage', () => {
  const order = { ...base, metode: 'antar_sendiri' };
  assert.equal(buildProgress(projectTrackingOrder(order)).stages.some(stage => stage.status === 'Sedang Dijemput'), false);
  assert.deepEqual(getNextOrderStatuses(order), ['Siap Diambil', 'Dibatalkan']);
});
test('terminal orders stop without marking remaining stages complete', () => {
  const result = buildProgress(projectTrackingOrder({ ...base, status: 'Dibatalkan' }));
  assert.equal(result.terminal, true);
  assert.equal(result.stages.find(stage => stage.status === 'Selesai').state, 'pending');
  assert.equal(result.stages.some(stage => stage.state === 'current'), false);
});
test('current delivery stage is recognized even with missing historic method', () => {
  const result = buildProgress(projectTrackingOrder({ ...base, status: 'Siap Diantar', metode: undefined, status_history: [] }));
  assert.equal(result.stages.find(stage => stage.status === 'Siap Diantar').state, 'current');
});
test('prevents status skipping and does not reopen final orders', () => {
  assert.deepEqual(getNextOrderStatuses({ ...base, status: 'Dikonfirmasi' }), ['Sedang Dijemput', 'Dibatalkan']);
  for (const status of ['Selesai', 'Dibatalkan', 'Ditolak']) assert.deepEqual(getNextOrderStatuses({ ...base, status }), []);
});
