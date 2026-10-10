// Shared, pure projection: never expose the raw order document to a guest.
export const TRACKING_STATUSES = ['Menunggu Konfirmasi', 'Dikonfirmasi', 'Sedang Dijemput', 'Diproses', 'Siap Diantar', 'Siap Diambil', 'Dikirim', 'Selesai', 'Ditolak', 'Dibatalkan'];

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
}

export function validTrackingCredentials(code, phone) {
  return /^(ORD|INV)-[A-Z0-9-]{4,40}$/.test(code) && /^628\d{7,11}$/.test(normalizePhone(phone));
}

export function toIso(value) {
  if (!value) return null;
  const date = typeof value.toDate === 'function' ? value.toDate()
    : typeof value === 'object' && (value.seconds ?? value._seconds) != null
      ? new Date((value.seconds ?? value._seconds) * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeImage(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' ? parsed.href : null;
  } catch { return null; }
}

function safeFraming(value) {
  if (!value || typeof value !== 'object') return null;
  const values = Object.entries(value).filter(([key, val]) =>
    ['x', 'y', 'zoom', 'pos_x', 'pos_y', 'scale', 'rotation'].includes(key) && typeof val === 'number' && Number.isFinite(val));
  return values.length ? Object.fromEntries(values) : null;
}

export function getPhotoPairs(entry = {}) {
  if (!entry || typeof entry !== 'object') return [];
  const slots = Array.isArray(entry.slots) && entry.slots.length ? entry.slots : [entry];
  return slots.slice(0, 8).flatMap((slot, index) => {
    if (!slot || typeof slot !== 'object') return [];
    const before = safeImage(slot.before_url);
    const after = safeImage(slot.after_url);
    return before && after ? [{
      slot: Number.isInteger(slot.slot) && slot.slot > 0 && slot.slot <= 8 ? slot.slot : index + 1,
      label: String(slot.label || `Sudut ${index + 1}`).slice(0, 80),
      before_url: before, after_url: after,
      framing_before: safeFraming(slot.framing_before || entry.framing_before),
      framing_after: safeFraming(slot.framing_after || entry.framing_after),
      object_position: /^\d{1,3}(\.\d+)?% \d{1,3}(\.\d+)?%$/.test(slot.object_position || entry.object_position || '') ? (slot.object_position || entry.object_position) : '50% 50%',
    }] : [];
  });
}

function itemPairs(item) {
  if (item.before_after) return getPhotoPairs(item.before_after);
  const photos = Array.isArray(item.gallery) ? item.gallery : Array.isArray(item.photos) ? item.photos : [];
  const slots = new Map();
  photos.slice(0, 32).forEach(photo => {
    if (!['before', 'after'].includes(photo.kind)) return;
    const slot = photo.slot || 1;
    slots.set(slot, { ...slots.get(slot), slot, [`${photo.kind}_url`]: photo.url });
  });
  return getPhotoPairs({ slots: [...slots.values()] });
}

export function projectTrackingOrder(order, linkedGallery = []) {
  const history = (Array.isArray(order.status_history) ? order.status_history : [])
    .filter(entry => TRACKING_STATUSES.includes(entry.status))
    .slice(-40).map(entry => ({ status: entry.status, timestamp: toIso(entry.timestamp) }));
  const code = order.invoice_number || order.invoice || order.id;
  const items = (order.items || []).slice(0, 30).map((item, index) => ({
    id: String(item.id || item.service_id || index),
    name: String(item.nama_snapshot || item.nama_layanan || item.service || 'Perawatan sepatu').slice(0, 120),
    service: String(item.service || item.service_nama || item.nama_layanan || item.nama_snapshot || '').slice(0, 120),
    quantity: Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1,
    category: ['cuci', 'repaint', 'sabun'].includes(item.kategori || item.category) ? (item.kategori || item.category) : null,
    photos: itemPairs(item),
  }));
  // Admin's existing order-detail uploader stores a pair on the order itself.
  const orderPhotos = getPhotoPairs(order.before_after || {});
  if (orderPhotos.length && items.length === 1) items[0].photos = orderPhotos;
  linkedGallery.forEach(entry => {
    const photos = getPhotoPairs(entry);
    const target = items.find(item => item.id === String(entry.item_id)) || (items.length === 1 ? items[0] : null);
    if (target && !target.photos.length) target.photos = photos;
  });
  return {
    code: String(code), status: TRACKING_STATUSES.includes(order.status) ? order.status : 'Menunggu Konfirmasi',
    method: ['dijemput', 'antar_sendiri', 'dikirim', 'ambil_sendiri'].includes(order.metode) ? order.metode : null,
    createdAt: toIso(order.created_at), updatedAt: toIso(order.updated_at),
    history, items, photos: items.length > 1 ? orderPhotos : [],
  };
}
