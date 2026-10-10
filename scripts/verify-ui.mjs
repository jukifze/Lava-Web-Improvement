// Render real JSX with Vite's SSR loader. This is a smoke test, not browser QA.
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const previousStorage = globalThis.localStorage;
const store = new Map();
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: key => store.delete(key) };
try {
  const { BeforeAfterCompare } = await vite.ssrLoadModule('/src/features/gallery/BeforeAfterCompare.jsx');
  const { OrderProgress } = await vite.ssrLoadModule('/src/features/orders/OrderProgress.jsx');
  const { TrackingPage } = await vite.ssrLoadModule('/src/pages/public/TrackingPage.jsx');
  const { StaticRouter } = await import('react-router-dom/server.js');
  const pair = renderToStaticMarkup(React.createElement(BeforeAfterCompare, { beforeUrl: 'https://res.cloudinary.com/demo/b.jpg', afterUrl: 'https://res.cloudinary.com/demo/a.jpg', caption: 'White Clean' }));
  assert.match(pair, /type="range"/); assert.match(pair, /Berdampingan/); assert.match(pair, /aria-valuetext=/);
  const incomplete = renderToStaticMarkup(React.createElement(BeforeAfterCompare, { beforeUrl: 'before' }));
  assert.match(incomplete, /Pasangan foto belum dapat ditampilkan/); assert.doesNotMatch(incomplete, /type="range"/);
  const progress = renderToStaticMarkup(React.createElement(OrderProgress, { order: { status: 'Dibatalkan', method: 'dijemput', history: [], items: [{ category: 'cuci' }] } }));
  assert.match(progress, /Tidak dilanjutkan/); assert.doesNotMatch(progress, /aria-current="step"/);
  const tracking = renderToStaticMarkup(React.createElement(StaticRouter, { location: '/lacak-pesanan?kode=ORD-TEST-1234' }, React.createElement(TrackingPage)));
  assert.match(tracking, /Lacak Pesanan/); assert.match(tracking, /value="ORD-TEST-1234"/); assert.match(tracking, /Nomor WhatsApp/);
  assert.match(tracking, /Coba contoh pelacakan/);
  console.log('UI SSR smoke tests: 4 passed (comparison, incomplete pair, canceled progress, tracking page).');
  const { ordersApi } = await vite.ssrLoadModule('/src/lib/api/ordersApi.js');
  const { trackingApi, DEMO_TRACKING } = await vite.ssrLoadModule('/src/lib/api/trackingApi.js');
  const demo = await trackingApi.lookup(DEMO_TRACKING.code, DEMO_TRACKING.phone);
  assert.equal(demo.demo, true); assert.equal(demo.items[0].photos.length > 0, true);
  await assert.rejects(trackingApi.lookup(DEMO_TRACKING.code, '081234567891'));
  const created = await ordersApi.createOrder({ pelanggan: { nama: 'Pelanggan Uji', telepon: '081234567890' }, items: [{ service_id: 'srv-white', qty: 1 }], metode: 'antar_sendiri' });
  assert.equal(created.demo, true);
  assert.equal((await trackingApi.lookup(created.id, '081234567890')).status, 'Menunggu Konfirmasi');
  await assert.rejects(ordersApi.updateStatus(created.id, 'Selesai'));
  for (const status of ['Dikonfirmasi', 'Diproses', 'Siap Diambil', 'Selesai']) await ordersApi.updateStatus(created.id, status);
  await ordersApi.saveBeforeAfter(created.id, { before_url: 'https://res.cloudinary.com/demo/b.jpg', after_url: 'https://res.cloudinary.com/demo/a.jpg', caption: 'Hasil uji' });
  const finished = await trackingApi.lookup(created.id, '081234567890');
  assert.equal(finished.status, 'Selesai'); assert.equal(finished.items[0].photos.length, 1);
  assert.doesNotMatch(JSON.stringify(finished), /Pelanggan Uji|081234567890/);
  console.log('Local API integration: demo lookup, wrong credentials, create → track → admin status → before-after → track passed. No live data was changed.');
} finally {
  if (previousStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousStorage;
  await vite.close();
}
