const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createHash, timingSafeEqual, randomBytes } = require('node:crypto');
const trackingModel = import('./tracking-model.mjs');
const workflow = import('./workflow.mjs');

admin.initializeApp();

async function verifyRecaptcha(token) {
  if (!token) return false;
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return false;

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: secretKey, response: token }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return Boolean(data.success) && (!process.env.RECAPTCHA_HOSTNAME || data.hostname === process.env.RECAPTCHA_HOSTNAME);
  } catch (error) {
    return false;
  }
}

exports.verifyCaptchaAndCreateOrder = functions.https.onCall(async (data, context) => {
  if (!data || !data.pelanggan || typeof data.pelanggan.nama !== 'string' || !data.pelanggan.nama.trim() || data.pelanggan.nama.length > 120) {
    throw new functions.https.HttpsError('invalid-argument', 'Data pemesan tidak valid.');
  }
  const { normalizePhone } = await trackingModel;
  if (!/^628\d{7,11}$/.test(normalizePhone(data.pelanggan.telepon))) {
    throw new functions.https.HttpsError('invalid-argument', 'Nomor WhatsApp tidak valid.');
  }
  const isCaptchaValid = await verifyRecaptcha(data.captchaToken);
  if (!isCaptchaValid) {
    throw new functions.https.HttpsError('failed-precondition', 'Verifikasi keamanan tidak valid.');
  }

  if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 30) {
    throw new functions.https.HttpsError('invalid-argument', 'Pesanan harus berisi minimal satu item.');
  }

  if (!['dijemput', 'antar_sendiri', 'dikirim', 'ambil_sendiri'].includes(data.metode)) {
    throw new functions.https.HttpsError('invalid-argument', 'Metode pesanan tidak valid.');
  }
  const address = data.metode === 'dijemput' ? data.alamat_jemput : data.alamat_antar;
  if (['dijemput', 'dikirim'].includes(data.metode) && (typeof address?.teks !== 'string' || !address.teks.trim() || address.teks.length > 1000 || !Number.isFinite(address.lat) || !Number.isFinite(address.lng) || Math.abs(address.lat) > 90 || Math.abs(address.lng) > 180)) {
    throw new functions.https.HttpsError('invalid-argument', 'Alamat dan pin lokasi wajib diisi.');
  }

  if (data.metode === 'dijemput' && (!data.alamat_jemput || !data.alamat_jemput.teks)) {
    throw new functions.https.HttpsError('invalid-argument', 'Alamat penjemputan wajib diisi.');
  }

  const db = admin.firestore();
  const servicesSnap = await db.collection('services').where('aktif', '==', true).get();
  const serviceMap = new Map();
  servicesSnap.forEach(docSnap => {
    serviceMap.set(docSnap.id, docSnap.data());
  });

  const snappedItems = data.items.map(item => {
    const master = serviceMap.get(item.service_id);
    if (!master) {
      throw new functions.https.HttpsError('not-found', `Layanan tidak ditemukan atau sedang tidak aktif.`);
    }
    const qty = item.qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 99 || !Number.isInteger(master.harga) || master.harga < 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Jumlah atau harga layanan tidak valid.');
    }
    return {
      service_id: item.service_id,
      nama_snapshot: master.nama,
      harga_snapshot: master.harga,
      kategori: master.kategori,
      qty: qty
    };
  });
  const hasTreatment = snappedItems.some(item => item.kategori !== 'sabun');
  if (!(hasTreatment ? ['dijemput', 'antar_sendiri'] : ['dikirim', 'ambil_sendiri']).includes(data.metode)) {
    throw new functions.https.HttpsError('invalid-argument', 'Metode tidak sesuai dengan jenis pesanan.');
  }

  const totalHarga = snappedItems.reduce((sum, item) => sum + (item.harga_snapshot * item.qty), 0);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const orderNumber = 'ORD-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + randomBytes(5).toString('hex').toUpperCase();

  const orderData = {
    id: orderNumber,
    pelanggan: {
      nama: data.pelanggan.nama.trim(),
      telepon: normalizePhone(data.pelanggan.telepon),
      email: String(data.pelanggan.email || '').slice(0, 254)
    },
    items: snappedItems,
    metode: data.metode,
    alamat_jemput: data.alamat_jemput || null,
    alamat_antar: data.alamat_antar || data.alamat_jemput || null,
    jadwal_tanggal: data.jadwal_tanggal || '',
    jadwal_slot: data.jadwal_slot || 'pagi',
    catatan: String(data.catatan || '').slice(0, 2000),
    total_harga: totalHarga,
    status: 'Menunggu Konfirmasi',
    status_history: [
      {
        status: 'Menunggu Konfirmasi',
        timestamp: new Date().toISOString(),
        catatan: 'Pesanan baru dibuat'
      }
    ],
    captcha_verified: true,
    created_at: now,
    updated_at: now
  };

  const docRef = db.collection('orders').doc(orderNumber);
  await docRef.create(orderData);
  return { ...orderData, id: orderNumber, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
});

exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Hanya admin yang dapat mengubah status pesanan.');
  }

  const { orderId, newStatus, catatan } = data;
  if (typeof orderId !== 'string' || !orderId || orderId.includes('/') || typeof newStatus !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Data status pesanan tidak valid.');
  }
  const db = admin.firestore();
  const orderRef = db.collection('orders').doc(orderId);
  return db.runTransaction(async transaction => {
  const snap = await transaction.get(orderRef);

  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pesanan tidak ditemukan.');
  }

  const currentOrder = snap.data();
  const currentStatus = currentOrder.status;

  const { getNextOrderStatuses } = await workflow;
  if (!getNextOrderStatuses(currentOrder).includes(newStatus)) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Tidak dapat mengubah status dari "${currentStatus}" menjadi "${newStatus}".`
    );
  }

  const nowIso = new Date().toISOString();
  const historyEntry = {
    status: newStatus,
    timestamp: nowIso,
    catatan: String(catatan || `Status diubah menjadi ${newStatus} oleh admin`).slice(0, 2000),
    oleh: context.auth.uid,
  };

  transaction.update(orderRef, {
    status: newStatus,
    status_history: admin.firestore.FieldValue.arrayUnion(historyEntry),
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ...currentOrder, id: orderId, status: newStatus, status_history: [...(currentOrder.status_history || []), historyEntry], updated_at: nowIso };
  });
});

// Public guests get only the allowlisted projection after two matching credentials.
// The private rate-limit collection is denied by Firestore rules; set TTL on expiresAt.
exports.getOrderProgress = functions.https.onCall(async (data, context) => {
  const { normalizePhone, validTrackingCredentials, projectTrackingOrder } = await trackingModel;
  const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : '';
  const phone = typeof data?.phone === 'string' ? normalizePhone(data.phone) : '';
  if (!validTrackingCredentials(code, phone)) throw new functions.https.HttpsError('invalid-argument', 'Data pelacakan tidak valid.');
  const db = admin.firestore();
  const key = createHash('sha256').update(context.rawRequest?.ip || 'unknown').digest('hex');
  const limiter = db.collection('tracking_rate_limits').doc(key);
  const now = Date.now();
  await db.runTransaction(async transaction => {
    const snap = await transaction.get(limiter);
    const previous = snap.exists ? snap.data() : null;
    const active = previous && now - previous.start < 15 * 60 * 1000;
    if (active && previous.count >= 12) throw new functions.https.HttpsError('resource-exhausted', 'Terlalu banyak percobaan.');
    transaction.set(limiter, { start: active ? previous.start : now, count: active ? previous.count + 1 : 1, expiresAt: admin.firestore.Timestamp.fromMillis(now + 15 * 60 * 1000) });
  });
  const orders = db.collection('orders');
  const candidates = new Map();
  const direct = await orders.doc(code).get();
  if (direct.exists) candidates.set(direct.id, direct);
  if (!direct.exists) {
    const results = await Promise.all(['id', 'invoice', 'invoice_number'].map(field => orders.where(field, '==', code).limit(2).get()));
    results.forEach(result => result.docs.forEach(doc => candidates.set(doc.id, doc)));
  }
  const hash = value => createHash('sha256').update(value).digest();
  const match = [...candidates.values()].find(doc => {
    const order = doc.data();
    const storedPhone = order.pelanggan?.telepon || order.customer?.telepon || order.customer_phone;
    return storedPhone && timingSafeEqual(hash(normalizePhone(storedPhone)), hash(phone));
  });
  if (!match) throw new functions.https.HttpsError('not-found', 'Pesanan tidak ditemukan.');
  const order = match.data();
  const orderKeys = [...new Set([match.id, order.id, order.invoice, order.invoice_number].filter(key => typeof key === 'string' && key.length <= 128))];
  const galleries = await Promise.all(orderKeys.map(key => db.collection('gallery').where('order_id', '==', key).limit(30).get()));
  const linked = new Map();
  galleries.forEach(result => result.docs.forEach(doc => linked.set(doc.id, doc.data())));
  return projectTrackingOrder(order, [...linked.values()]);
});

exports.updateOrderBeforeAfter = functions.https.onCall(async (data, context) => {
  if (context.auth?.token?.role !== 'admin') throw new functions.https.HttpsError('permission-denied', 'Hanya admin.');
  const { getPhotoPairs } = await trackingModel;
  const photos = getPhotoPairs(data?.before_after || {});
  if (!photos.length || typeof data.orderId !== 'string' || !data.orderId || data.orderId.includes('/')) {
    throw new functions.https.HttpsError('invalid-argument', 'Pasangan foto Cloudinary dan kode pesanan wajib diisi.');
  }
  const beforeAfter = { ...photos[0], slots: photos, caption: String(data.before_after.caption || '').slice(0, 200), layanan_terkait: String(data.before_after.layanan_terkait || '').slice(0, 120) };
  const db = admin.firestore();
  const ref = db.collection('orders').doc(data.orderId);
  await db.runTransaction(async transaction => {
    const order = await transaction.get(ref);
    if (!order.exists) throw new functions.https.HttpsError('not-found', 'Pesanan tidak ditemukan.');
    transaction.update(ref, { before_after: beforeAfter, updated_at: admin.firestore.FieldValue.serverTimestamp() });
    if (data.publishGallery === true) {
      // Stable ID makes retries update the same entry; save both sides atomically.
      transaction.set(db.collection('gallery').doc(`order-${data.orderId}`), {
        ...beforeAfter, order_id: data.orderId, tampil_di_home: true,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  const saved = await ref.get();
  return { ...saved.data(), id: saved.id };
});
