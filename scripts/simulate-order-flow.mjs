// Runs real React pages/events in an isolated DOM, not a visual browser.
// Captcha, PDF, maps and Cloudinary transport are test doubles. No live writes.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer, loadEnv } from 'vite';
import reactPlugin from '@vitejs/plugin-react';
import React, { act } from 'react';

const env = loadEnv('development', process.cwd(), 'VITE_');
assert.ok(!env.VITE_FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY === 'demo-api-key' || !env.VITE_FIREBASE_PROJECT_ID,
  'Simulasi hanya untuk mode demo tanpa Firebase. Jangan jalankan terhadap data produksi.');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/', pretendToBeVisual: true,
});
const originalGlobals = new Map();
function setGlobal(key, value) {
  originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'File', 'FileReader', 'FormData', 'localStorage', 'Event', 'MouseEvent', 'KeyboardEvent']) {
  setGlobal(key, dom.window[key]);
}
setGlobal('requestAnimationFrame', dom.window.requestAnimationFrame.bind(dom.window));
setGlobal('cancelAnimationFrame', dom.window.cancelAnimationFrame.bind(dom.window));
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
// ToastProvider uses Node timers in SSR-loaded code; cancel its pending timers
// before removing the DOM so an unmounted toast cannot access a restored window.
const toastTimers = new Set();
const nodeSetTimeout = globalThis.setTimeout;
setGlobal('setTimeout', (callback, delay, ...args) => {
  const timer = nodeSetTimeout(callback, delay, ...args);
  if (delay === 4000) toastTimers.add(timer);
  return timer;
});
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
localStorage.setItem('lavestreat_orders_data_v16', '[]');
localStorage.setItem('lavestreat_gallery_data_v16', '[]');

const beforeUrl = 'https://res.cloudinary.com/demo/image/upload/simulation-before.jpg';
const afterUrl = 'https://res.cloudinary.com/demo/image/upload/simulation-after.jpg';
let rejectUpload = false;
let uploadCount = 0;
setGlobal('fetch', async (url, options) => {
  assert.match(String(url), /^https:\/\/api\.cloudinary\.com\/v1_1\/[^/]+\/image\/upload$/,
    'Simulasi menolak semua request eksternal selain transport upload yang dimock.');
  uploadCount++;
  if (rejectUpload) throw new Error('Simulated connection failure');
  const file = options.body.get('file');
  return { ok: true, json: async () => ({ secure_url: file.name.includes('before') ? beforeUrl : afterUrl }) };
});

const testDoubles = {
  name: 'simulation-only-boundaries', enforce: 'pre',
  load(id) {
    const path = id.replaceAll('\\', '/');
    if (path.endsWith('/components/common/SliderCaptchaModal.jsx')) return `
      import React from 'react';
      import { Modal } from '/src/components/common/Modal.jsx';
      export function SliderCaptchaModal({ isOpen, onClose, onSuccess, title }) {
        return React.createElement(Modal, { isOpen, onClose, title },
          React.createElement('button', { type: 'button', onClick: () => onSuccess() }, 'Lanjutkan simulasi captcha'));
      }`;
    if (path.endsWith('/lib/orderReceiptPdf.js')) return `
      export async function downloadOrderReceiptPdf() {}
      export function printOrderReceipt() {}`;
    if (path.endsWith('/components/map/LocationPicker.jsx')) return `
      import React from 'react';
      export function LocationPicker() { return React.createElement('div', null, 'Peta tidak diuji dalam simulasi DOM'); }`;
    if (path.endsWith('/components/map/RouteMap.jsx')) return `
      import React from 'react';
      export function RouteMap() { return React.createElement('div', null, 'Rute tidak diuji dalam simulasi DOM'); }`;
  },
};

let vite;
let root;
let passed = 0;
function pass(name) {
  passed++;
  console.log(`PASS ${String(passed).padStart(2, '0')} ${name}`);
}

try {
  vite = await createServer({ configFile: false, plugins: [testDoubles, reactPlugin()],
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const load = path => vite.ssrLoadModule(`/src/${path}`);
  const { isFirebaseConfigured } = await load('lib/firebase.js');
  assert.equal(isFirebaseConfigured, false, 'Firebase nyata tidak boleh aktif dalam simulasi.');
  const { AuthProvider } = await load('context/AuthContext.jsx');
  const { ToastProvider } = await load('context/ToastContext.jsx');
  const { ordersApi, trackingApi, galleryApi, servicesApi } = {
    ...(await load('lib/api/index.js')), ...(await load('lib/api/trackingApi.js')),
  };
  const { OrderPage } = await load('pages/public/OrderPage.jsx');
  const { TrackingPage } = await load('pages/public/TrackingPage.jsx');
  const { GalleryPage } = await load('pages/public/GalleryPage.jsx');
  const { GalleryDetailPage } = await load('pages/public/GalleryDetailPage.jsx');
  const { LoginPage } = await load('pages/admin/LoginPage.jsx');
  const { AdminLayout } = await load('pages/admin/AdminLayout.jsx');
  const { DashboardPage } = await load('pages/admin/DashboardPage.jsx');
  const { OrdersManagePage } = await load('pages/admin/OrdersManagePage.jsx');
  const { OrderDetailPage } = await load('pages/admin/OrderDetailPage.jsx');
  const h = React.createElement;
  const container = document.getElementById('root');
  const text = () => container.textContent.replace(/\s+/g, ' ');
  const all = selector => [...container.querySelectorAll(selector)];
  const button = name => {
    const matches = all('button').filter(node => node.textContent.trim().replace(/\s+/g, ' ') === name);
    assert.equal(matches.length, 1, `Expected one button: ${name}; found ${matches.length}`);
    return matches[0];
  };
  const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); };
  async function until(predicate, label) {
    for (let i = 0; i < 50; i++) { if (predicate()) return; await flush(); }
    throw new Error(`Tidak mencapai hasil: ${label}. Teks halaman: ${text().slice(0, 600)}`);
  }
  async function click(node) {
    assert.ok(node, 'Target klik harus ada');
    assert.equal(node.disabled, false, 'Tombol tidak boleh disabled saat diklik');
    await act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
    await flush();
  }
  async function fill(node, value) {
    assert.ok(node, 'Input harus ada');
    const prototype = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
      node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
  }
  async function submit(form) {
    assert.ok(form, 'Form harus ada');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await flush();
  }
  async function mount(path) {
    if (root) await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(h(AuthProvider, null, h(ToastProvider, null,
      h(MemoryRouter, { initialEntries: [path], future: { v7_startTransition: true, v7_relativeSplatPath: true } },
        h(Routes, null,
          h(Route, { path: '/pesan', element: h(OrderPage) }),
          h(Route, { path: '/lacak-pesanan', element: h(TrackingPage) }),
          h(Route, { path: '/galeri', element: h(GalleryPage) }),
          h(Route, { path: '/galeri/:id', element: h(GalleryDetailPage) }),
          h(Route, { path: '/admin/login', element: h(LoginPage) }),
          h(Route, { path: '/admin', element: h(AdminLayout) },
            h(Route, { index: true, element: h(DashboardPage) }),
            h(Route, { path: 'orders', element: h(OrdersManagePage) }),
            h(Route, { path: 'orders/:id', element: h(OrderDetailPage) })),
        ))))));
    await flush();
  }
  async function findOrder(code, phone = '081234567890') {
    await fill(document.getElementById('tracking-code'), code);
    await fill(document.getElementById('tracking-phone'), phone);
    await submit(document.getElementById('tracking-code').closest('form'));
  }

  await mount('/pesan?service=srv-white');
  await until(() => text().includes('White Clean') && all('button').some(node => node.textContent.trim() === 'Lanjutkan'), 'Katalog pemesanan');
  await click(button('Lanjutkan'));
  await click(all('button').find(node => node.textContent.includes('Antar Sendiri ke Outlet')));
  await click(button('Lanjutkan'));
  await click(button('Lanjutkan'));
  assert.match(text(), /Nama lengkap pemesan wajib diisi/);
  assert.ok(document.getElementById('nama-lengkap'));
  pass('Pelanggan tidak dapat melanjutkan formulir tanpa identitas.');

  await fill(document.getElementById('nama-lengkap'), 'Pelanggan Simulasi');
  await fill(document.getElementById('nomor-whatsapp'), '081234567890');
  await click(button('Lanjutkan'));
  await click(button('Pesan Sekarang'));
  assert.match(document.querySelector('[role="dialog"]').textContent, /Verifikasi Pesanan Contoh/);
  await click(button('Lanjutkan simulasi captcha'));
  await until(() => text().includes('Nomor Tiket Pesanan'), 'Konfirmasi pesanan');
  const created = (await ordersApi.getOrders())[0];
  assert.equal(created.demo, true);
  assert.equal(created.metode, 'antar_sendiri');
  assert.equal(created.status, 'Menunggu Konfirmasi');
  assert.match(text(), /Pesanan contoh disimpan di browser ini/);
  const trackingLink = all('a').find(node => node.textContent.includes('Lacak Progres Pesanan'));
  assert.equal(new URL(trackingLink.href).searchParams.get('kode'), created.id);
  assert.equal(new URL(trackingLink.href).searchParams.has('phone'), false);
  pass('Form pelanggan membuat order demo dan CTA memakai kode order yang tersimpan. Captcha/PDF dimock.');

  // Links do not have a disabled property, unlike buttons.
  await act(async () => trackingLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  await flush();
  assert.equal(document.getElementById('tracking-code').value, created.id);
  assert.equal(document.getElementById('tracking-phone').value, '');
  await findOrder(created.id);
  assert.match(text(), /Menunggu Konfirmasi/);
  assert.match(text(), /Foto before–after untuk item ini belum tersedia/);
  assert.match(container.querySelector('[aria-current="step"]').textContent, /Menunggu Konfirmasi/);
  pass('Pelanggan membuka CTA tracking, mencocokkan WhatsApp, dan melihat status awal/foto kosong.');

  await findOrder(created.id, '081234567891');
  assert.match(container.querySelector('[role="alert"]').textContent, /tidak cocok/);
  assert.equal(container.querySelector('[aria-label^="Hasil pelacakan"]'), null);
  pass('WhatsApp salah menolak pelacakan dan membersihkan hasil sebelumnya.');

  await mount(`/admin/orders/${created.id}`);
  await until(() => text().includes('Masuk Panel Admin'), 'Guard admin');
  assert.doesNotMatch(text(), /Perbarui Status Pesanan/);
  pass('Pengunjung tanpa login dialihkan dari detail order ke login admin.');

  await fill(document.getElementById('alamat-email'), 'admin@lavestreat.com');
  await fill(document.getElementById('kata-sandi'), 'wrong-demo-password');
  await submit(document.querySelector('form'));
  assert.match(text(), /Email atau password tidak sesuai/);
  assert.equal(localStorage.getItem('lavestreat_auth_user'), null);
  await fill(document.getElementById('kata-sandi'), 'admin123');
  await submit(document.querySelector('form'));
  await until(() => Boolean(container.querySelector('[data-admin-ui]')) && !text().includes('Masuk Panel Admin'), 'Login demo admin');
  assert.equal(JSON.parse(localStorage.getItem('lavestreat_auth_user')).role, 'admin');
  pass('Login demo menolak password salah, menerima akun demo, dan membuka panel admin.');

  await mount('/admin/orders');
  await until(() => text().includes(created.id), 'Daftar pesanan admin');
  assert.match(text(), /Pelanggan Simulasi/);
  const detailLink = all('a').find(node => node.getAttribute('href') === `/admin/orders/${created.id}`);
  assert.ok(detailLink);
  await act(async () => detailLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  await until(() => text().includes('Perbarui Status Pesanan'), 'Detail pesanan admin');
  pass('Pesanan pelanggan muncul di daftar admin dan link membuka detail yang sama.');

  const beforeSkip = await ordersApi.getOrderById(created.id);
  await assert.rejects(ordersApi.updateStatus(created.id, 'Selesai'));
  assert.deepEqual((await ordersApi.getOrderById(created.id)).status_history, beforeSkip.status_history);
  const expectedStages = ['Dikonfirmasi', 'Diproses', 'Siap Diambil', 'Selesai'];
  for (const status of expectedStages.slice(0, 2)) {
    const select = container.querySelector('select');
    assert.ok([...select.options].some(option => option.value === status));
    assert.equal([...select.options].some(option => option.value === 'Selesai'), false);
    await fill(select, status);
    await submit(select.closest('form'));
    assert.equal((await ordersApi.getOrderById(created.id)).status, status);
  }
  pass('Form admin mengonfirmasi lalu memproses; lompat langsung ke Selesai ditolak tanpa mutasi history.');

  await mount(`/lacak-pesanan?kode=${created.id}`);
  await findOrder(created.id, '+62 812 3456 7890');
  assert.match(container.querySelector('[aria-current="step"]').textContent, /Diproses/);
  pass('Pelanggan melihat progres Diproses; format 08 dan +628 dicocokkan.');

  await mount(`/admin/orders/${created.id}`);
  await until(() => all('input[type="file"]').length === 2, 'Form dokumentasi before-after');
  assert.equal(button('Simpan ke Galeri & Pesanan').disabled, true);
  async function chooseFile(index, name) {
    const input = all('input[type="file"]')[index];
    assert.ok(input);
    const file = new File(['simulated-image-payload'], name, { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await flush();
  }
  await chooseFile(0, 'simulation-before.jpg');
  await until(() => all('img[alt="Preview"]').length === 1, 'Preview foto before');
  assert.equal(button('Simpan ke Galeri & Pesanan').disabled, true);
  assert.equal((await ordersApi.getOrderById(created.id)).before_after, undefined);
  await chooseFile(1, 'simulation-after.jpg');
  await until(() => all('img[alt="Preview"]').length === 2, 'Preview kedua foto');
  assert.equal(button('Simpan ke Galeri & Pesanan').disabled, false);
  pass('Form before-after hanya bisa disimpan setelah dua foto dipilih dan dipreview.');

  rejectUpload = true;
  await submit(button('Simpan ke Galeri & Pesanan').closest('form'));
  await until(() => text().includes('Upload gagal.'), 'Error upload');
  assert.equal((await ordersApi.getOrderById(created.id)).before_after, undefined);
  assert.equal((await galleryApi.getGallery(true)).length, 0);
  rejectUpload = false;
  await submit(button('Simpan ke Galeri & Pesanan').closest('form'));
  await until(() => text().includes('Dokumentasi Before-After berhasil disimpan'), 'Publikasi dokumentasi');
  const photographed = await ordersApi.getOrderById(created.id);
  assert.equal(photographed.before_after.before_url, beforeUrl);
  assert.equal(photographed.before_after.after_url, afterUrl);
  assert.ok(uploadCount >= 3);
  const galleryEntry = (await galleryApi.getGallery(true))[0];
  assert.ok(galleryEntry);
  assert.doesNotMatch(JSON.stringify(galleryEntry), /Pelanggan Simulasi|081234567890/);
  pass('Upload gagal tidak memberi sukses palsu; retry menyimpan dua URL dan menerbitkan galeri. Transport dimock.');

  await mount(`/lacak-pesanan?kode=${created.id}`);
  await findOrder(created.id);
  assert.equal(container.querySelector(`img[src="${beforeUrl}"]`) !== null, true);
  assert.equal(container.querySelector(`img[src="${afterUrl}"]`) !== null, true);
  assert.doesNotMatch(text(), /Pelanggan Simulasi/);
  await click(button('Berdampingan'));
  assert.equal(button('Berdampingan').getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelector('input[type="range"]'), null);
  await click(button('Geser'));
  const range = container.querySelector('input[type="range"]');
  await fill(range, '75');
  assert.equal(range.getAttribute('aria-valuetext'), '75% foto sebelum, 25% foto sesudah');
  const comparator = document.getElementById(range.getAttribute('aria-controls'));
  comparator.getBoundingClientRect = () => ({ left: 100, top: 0, width: 400, height: 300 });
  await act(async () => {
    comparator.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 200 }));
    comparator.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  });
  assert.equal(range.value, '25');
  assert.match(comparator.querySelector('[style*="clip-path"]').style.clipPath, /75%/);
  pass('Pelanggan melihat foto sendiri; mode berdampingan, input slider, dan pointer mengubah pembanding.');

  await mount('/galeri');
  await until(() => all('a').some(node => node.getAttribute('href') === `/galeri/${galleryEntry.id}`), 'Galeri publik');
  assert.doesNotMatch(text(), /Pelanggan Simulasi|081234567890/);
  const galleryLink = all('a').find(node => node.getAttribute('href') === `/galeri/${galleryEntry.id}`);
  await act(async () => galleryLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
  await until(() => all('button').some(node => node.textContent.trim() === 'Perbesar sebelum'), 'Detail galeri');
  await click(button('Perbesar sebelum'));
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(dialog.querySelector('img').src, beforeUrl);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  pass('Galeri publik membuka detail; zoom memakai foto benar dan Escape menutup modal.');

  await mount(`/admin/orders/${created.id}`);
  await until(() => text().includes('Perbarui Status Pesanan'), 'Detail admin untuk penyelesaian');
  for (const status of expectedStages.slice(2)) {
    const select = container.querySelector('select');
    await fill(select, status);
    await submit(select.closest('form'));
    assert.equal((await ordersApi.getOrderById(created.id)).status, status);
  }
  assert.match(text(), /tahap akhir/);
  assert.equal(container.querySelector('select'), null);
  await assert.rejects(ordersApi.updateStatus(created.id, 'Diproses'));
  const completed = await ordersApi.getOrderById(created.id);
  assert.deepEqual(completed.status_history.map(entry => entry.status), ['Menunggu Konfirmasi', ...expectedStages]);
  assert.ok(completed.status_history.every(entry => !Number.isNaN(Date.parse(entry.timestamp))));
  pass('Admin menyelesaikan order sesuai urutan; timestamp tercatat dan order selesai tidak bisa dibuka ulang.');

  await mount(`/lacak-pesanan?kode=${created.id}`);
  await findOrder(created.id);
  await click(button('Perbarui'));
  assert.match(text(), /Pesanan selesai\./);
  assert.equal(container.querySelector('[aria-current="step"]'), null);
  const completedStages = [...container.querySelectorAll('[aria-labelledby="progress-title"] li')];
  assert.equal(completedStages.length, 5);
  assert.ok(completedStages.every(stage => stage.textContent.includes('Tahap terlewati')));
  assert.ok(container.querySelector(`img[src="${afterUrl}"]`));
  pass('Pelanggan menekan Perbarui dan melihat status Selesai beserta dokumentasi yang tetap tersimpan.');

  await ordersApi.saveBeforeAfter(created.id, completed.before_after);
  const published = await galleryApi.getGallery(true);
  assert.equal(published.length, 1);
  await galleryApi.updateGalleryItem(galleryEntry.id, { tampil_di_home: false });
  assert.equal((await galleryApi.getGallery(true)).length, 0);
  await mount(`/galeri/${galleryEntry.id}`);
  await until(() => text().includes('Dokumentasi tidak tersedia'), 'Galeri disembunyikan');
  assert.equal(container.querySelector(`img[src="${beforeUrl}"]`), null);
  assert.equal((await trackingApi.lookup(created.id, '081234567890')).items[0].photos.length, 1);
  await galleryApi.updateGalleryItem(galleryEntry.id, { tampil_di_home: true });
  pass('Simpan ulang tidak menggandakan galeri; galeri tersembunyi ditolak publik, foto order tetap bisa dilacak pemilik.');

  const services = await servicesApi.getServices(true);
  const treatment = services.find(item => item.kategori === 'cuci');
  const soap = services.find(item => item.kategori === 'sabun');
  assert.ok(treatment && soap);
  const sample = (service, method) => ({ pelanggan: { nama: 'Simulasi Tambahan', telepon: '081234567890' },
    items: [{ service_id: service.id, qty: 1 }], metode: method,
    alamat_jemput: { teks: 'Alamat fiktif untuk simulasi', lat: -7.4, lng: 112.7 },
    alamat_antar: { teks: 'Alamat fiktif untuk simulasi', lat: -7.4, lng: 112.7 } });
  for (const [service, method, stages] of [
    [treatment, 'dijemput', ['Dikonfirmasi', 'Sedang Dijemput', 'Diproses', 'Siap Diantar', 'Selesai']],
    [soap, 'dikirim', ['Dikonfirmasi', 'Dikirim', 'Selesai']],
    [soap, 'ambil_sendiri', ['Dikonfirmasi', 'Siap Diambil', 'Selesai']],
  ]) {
    const extra = await ordersApi.createOrder(sample(service, method));
    for (const status of stages) {
      await ordersApi.updateStatus(extra.id, status);
      assert.equal((await trackingApi.lookup(extra.id, '081234567890')).status, status);
    }
    assert.deepEqual((await ordersApi.getOrderById(extra.id)).status_history.map(entry => entry.status), ['Menunggu Konfirmasi', ...stages]);
    pass(`API: metode ${method} mengikuti alur yang benar sampai Selesai.`);
  }
  const canceled = await ordersApi.createOrder(sample(treatment, 'antar_sendiri'));
  await ordersApi.updateStatus(canceled.id, 'Dibatalkan');
  await mount(`/lacak-pesanan?kode=${canceled.id}`);
  await findOrder(canceled.id);
  assert.match(text(), /Tidak dilanjutkan/);
  assert.equal(container.querySelector('[aria-current="step"]'), null);
  await assert.rejects(ordersApi.updateStatus(canceled.id, 'Dikonfirmasi'));
  pass('Pesanan dibatalkan menampilkan timeline terminal dan tidak dapat diaktifkan kembali.');

  const refreshing = await ordersApi.createOrder(sample(treatment, 'antar_sendiri'));
  await mount(`/lacak-pesanan?kode=${refreshing.id}`);
  await findOrder(refreshing.id);
  assert.match(container.querySelector('[aria-current="step"]').textContent, /Menunggu Konfirmasi/);
  await ordersApi.updateStatus(refreshing.id, 'Dikonfirmasi');
  await click(button('Perbarui'));
  assert.match(container.querySelector('[aria-current="step"]').textContent, /Dikonfirmasi/);
  pass('Perbarui mengambil status baru setelah perubahan admin tanpa reload atau isi ulang kredensial.');

  await mount('/admin/orders');
  await until(() => Boolean(container.querySelector('[aria-label="Keluar dari akun admin"]')), 'Tombol logout admin');
  await click(container.querySelector('[aria-label="Keluar dari akun admin"]'));
  await until(() => text().includes('Masuk Panel Admin'), 'Logout dan guard admin');
  assert.equal(localStorage.getItem('lavestreat_auth_user'), null);
  pass('Admin dapat logout; sesi dibersihkan dan panel kembali terkunci.');

  console.log(`\n${passed} skenario lolos. Order utama: ${created.id} (isolated, tidak tersimpan di browser pengguna).`);
  console.log('Batas: DOM/events dan API demo teruji. Layout visual, gambar nyata, captcha nyata, PDF, peta, Cloudinary/Firebase live tidak diuji.');
} finally {
  if (root) await act(async () => root.unmount());
  for (const timer of toastTimers) clearTimeout(timer);
  if (vite) await vite.close();
  dom.window.close();
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}
