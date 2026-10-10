import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, isFirebaseConfigured } from '../firebase';
import { initialOrders } from './mockData';
import { servicesApi } from './servicesApi';
import { galleryApi } from './galleryApi';
import { getNextOrderStatuses } from '../constants';
import { toIso, normalizePhone } from '../../../firebase-functions/tracking-model.mjs';

const STORAGE_KEY = 'lavestreat_orders_data_v16';

function getLocalOrders() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(data)) return data;
  } catch {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialOrders));
  return [...initialOrders];
}
function saveLocalOrders(orders) { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)); }
function normalizeOrder(order, id) {
  return { ...order, id: id || order.id, created_at: toIso(order.created_at), updated_at: toIso(order.updated_at),
    status_history: (order.status_history || []).map(entry => ({ ...entry, timestamp: toIso(entry.timestamp) })) };
}
function ensureDemo() {
  if (!import.meta.env.DEV) throw new Error('Layanan pesanan belum dikonfigurasi. Silakan hubungi tim Lave Streat.');
}

export const ordersApi = {
  async saveBeforeAfter(orderId, before_after) {
    if (isFirebaseConfigured) {
      const result = await httpsCallable(functions, 'updateOrderBeforeAfter')({ orderId, before_after, publishGallery: true });
      return normalizeOrder(result.data, orderId);
    }
    ensureDemo();
    const updated = await ordersApi.updateOrder(orderId, { before_after });
    const existing = (await galleryApi.getGallery(false)).find(entry => entry.order_id === orderId);
    const payload = { ...before_after, order_id: orderId, tampil_di_home: true };
    if (existing) await galleryApi.updateGalleryItem(existing.id, payload);
    else await galleryApi.createGalleryItem(payload);
    return updated;
  },
  async getOrders() {
    if (isFirebaseConfigured) {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('created_at', 'desc')));
      return snap.docs.map(item => normalizeOrder(item.data(), item.id));
    }
    ensureDemo();
    return getLocalOrders().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  async getOrderById(id) {
    if (isFirebaseConfigured) {
      const snap = await getDoc(doc(db, 'orders', id));
      return snap.exists() ? normalizeOrder(snap.data(), snap.id) : null;
    }
    ensureDemo();
    return getLocalOrders().find(order => [order.id, order.order_id, order.invoice, order.invoice_number, order.original_id].includes(id)) || null;
  },
  async createOrder(payload) {
    if (isFirebaseConfigured) {
      // Never persist a fake success locally or write an order directly from the browser.
      const result = await httpsCallable(functions, 'verifyCaptchaAndCreateOrder')(payload);
      return normalizeOrder(result.data);
    }
    ensureDemo();
    if (!payload.items?.length) throw new Error('Pesanan harus berisi minimal satu item.');
    if (!/^628\d{7,11}$/.test(normalizePhone(payload.pelanggan?.telepon))) throw new Error('Nomor WhatsApp tidak valid.');
    const address = payload.metode === 'dijemput' ? payload.alamat_jemput : payload.alamat_antar;
    if (['dijemput', 'dikirim'].includes(payload.metode) && (!address?.teks?.trim() || !Number.isFinite(address.lat) || !Number.isFinite(address.lng))) throw new Error('Alamat dan pin lokasi wajib diisi.');
    const services = await servicesApi.getServices(true);
    const items = payload.items.map(item => {
      const master = services.find(service => service.id === item.service_id && service.aktif);
      if (!master) throw new Error('Layanan tidak tersedia.');
      if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) throw new Error('Jumlah item tidak valid.');
      return { service_id: master.id, nama_snapshot: master.nama, harga_snapshot: master.harga, kategori: master.kategori, qty: item.qty };
    });
    const hasTreatment = items.some(item => item.kategori !== 'sabun');
    if (!(hasTreatment ? ['dijemput', 'antar_sendiri'] : ['dikirim', 'ambil_sendiri']).includes(payload.metode)) throw new Error('Metode tidak sesuai dengan jenis pesanan.');
    const now = new Date().toISOString();
    const id = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const order = { ...payload, id, items, pelanggan: { ...payload.pelanggan }, customer: { ...payload.pelanggan },
      total_harga: items.reduce((total, item) => total + item.harga_snapshot * item.qty, 0),
      status: 'Menunggu Konfirmasi', status_history: [{ status: 'Menunggu Konfirmasi', timestamp: now }],
      created_at: now, updated_at: now, captcha_verified: false, demo: true,
      jadwal: { tanggal: payload.jadwal_tanggal, slot: payload.jadwal_slot } };
    const orders = getLocalOrders();
    orders.unshift(order); saveLocalOrders(orders);
    return order;
  },
  async updateStatus(orderId, newStatus, catatan = '', adminName = 'Admin') {
    if (isFirebaseConfigured) {
      const result = await httpsCallable(functions, 'updateOrderStatus')({ orderId, newStatus, catatan });
      return normalizeOrder(result.data, orderId);
    }
    ensureDemo();
    const orders = getLocalOrders();
    const index = orders.findIndex(order => [order.id, order.invoice, order.invoice_number, order.original_id].includes(orderId));
    if (index < 0) throw new Error('Pesanan tidak ditemukan.');
    if (!getNextOrderStatuses(orders[index]).includes(newStatus)) throw new Error(`Tidak dapat mengubah status dari "${orders[index].status}" menjadi "${newStatus}".`);
    const now = new Date().toISOString();
    orders[index] = { ...orders[index], status: newStatus, updated_at: now,
      status_history: [...(orders[index].status_history || []), { status: newStatus, timestamp: now, catatan: catatan || `Status diubah oleh ${adminName}` }] };
    saveLocalOrders(orders); return orders[index];
  },
  async updateOrder(orderId, patch) {
    if (!patch.before_after || Object.keys(patch).some(key => key !== 'before_after')) throw new Error('Perubahan pesanan ini tidak didukung.');
    if (isFirebaseConfigured) {
      const result = await httpsCallable(functions, 'updateOrderBeforeAfter')({ orderId, before_after: patch.before_after });
      return normalizeOrder(result.data, orderId);
    }
    ensureDemo();
    if (!patch.before_after.before_url || !patch.before_after.after_url) throw new Error('Kedua foto wajib diisi.');
    const orders = getLocalOrders();
    const index = orders.findIndex(order => order.id === orderId);
    if (index < 0) throw new Error('Pesanan tidak ditemukan.');
    orders[index] = { ...orders[index], ...patch, updated_at: new Date().toISOString() };
    saveLocalOrders(orders); return orders[index];
  },
};
