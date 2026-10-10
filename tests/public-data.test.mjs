import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { publicGalleryEntry, publicDemoDataPlugin } from '../scripts/public-demo-data.mjs';

test('public gallery keeps photos and framing, not customer/order metadata', () => {
  const result = publicGalleryEntry({ id: 'g1', before_url: 'before', after_url: 'after', customer_phone: 'secret-phone', customer_name: 'Secret', order_id: 'secret-order', invoice: 'secret-invoice', framing_before: { zoom: 2 }, slots: [{ slot: 1, before_url: 'before', after_url: 'after', customer_phone: 'secret-phone' }] });
  assert.equal(result.framing_before.zoom, 2);
  assert.equal(result.slots[0].before_url, 'before');
  assert.doesNotMatch(JSON.stringify(result), /secret|Secret|customer|invoice|order_id/);
});
test('production build transform removes imported orders before bundling', () => {
  const source = readFileSync(new URL('../src/lib/api/mockData.js', import.meta.url), 'utf8');
  const plugin = publicDemoDataPlugin();
  const transformed = plugin.transform(source, 'C:/project/src/lib/api/mockData.js');
  const sanitized = vm.runInNewContext(transformed.code.replace(/export const /g, 'const ') + '\n({initialOrders, initialGallery, initialSettings, initialServices})');
  assert.equal(sanitized.initialOrders.length, 0);
  assert.ok(sanitized.initialGallery.length > 0);
  assert.ok(sanitized.initialGallery.every(item => item.tampil_di_home));
  assert.doesNotMatch(transformed.code, /customer_phone|customer_name|"pelanggan"|"alamat_jemput"/);
  assert.equal(plugin.transform('export const test = 1;', 'C:/project/src/lib/other.js'), null);
  assert.ok(sanitized.initialSettings.outlet.koordinat.lat);
});
