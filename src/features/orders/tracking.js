import { ORDER_METHODS } from '../../lib/constants';

const TERMINAL_FAILED = ['Ditolak', 'Dibatalkan'];
const READY_STATUSES = ['Siap Diantar', 'Siap Diambil', 'Dikirim'];

const STEP_DESCRIPTIONS = {
  'Menunggu Konfirmasi': 'Pesanan sudah masuk dan menunggu konfirmasi admin.',
  'Dikonfirmasi': 'Pesanan dikonfirmasi dan dijadwalkan.',
  'Sedang Dijemput': 'Kurir sedang menjemput sepatu ke alamat Anda.',
  'Diproses': 'Pesanan sedang dikerjakan di workshop.',
  'Siap Diantar': 'Pengerjaan selesai, pesanan siap diantar ke alamat Anda.',
  'Siap Diambil': 'Pengerjaan selesai, pesanan siap diambil di outlet.',
  'Dikirim': 'Pesanan sedang dalam pengiriman.',
  'Selesai': 'Pesanan sudah diterima pelanggan.'
};

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidPhoneSuffix(value) {
  return /^\d{4}$/.test(String(value || ''));
}

export function orderMatchesCode(order, code) {
  const target = normalizeCode(code);
  if (!target) return false;
  return [order.id, order.order_id, order.invoice, order.invoice_number, order.original_id]
    .some((candidate) => normalizeCode(candidate) === target);
}

export function orderMatchesPhone(order, phoneSuffix) {
  if (!isValidPhoneSuffix(phoneSuffix)) return false;
  const phone = digitsOnly(order.pelanggan?.telepon || order.customer?.telepon || order.customer_phone);
  return phone.length >= 4 && phone.endsWith(phoneSuffix);
}

// Hanya field yang aman ditampilkan ke pelanggan: tanpa telepon, email,
// alamat, koordinat, maupun catatan internal admin.
export function toPublicTracking(order) {
  const fullName = order.pelanggan?.nama || order.customer?.nama || order.customer_name || '';
  return {
    kode: order.invoice_number || order.invoice || order.id,
    nama_depan: fullName.trim().split(/\s+/)[0] || '',
    status: order.status,
    metode: order.metode || null,
    jadwal_tanggal: order.jadwal_tanggal || order.jadwal?.tanggal || null,
    total_harga: order.total_harga ?? null,
    created_at: order.created_at || null,
    updated_at: order.updated_at || null,
    status_history: (order.status_history || []).map((entry) => ({
      status: entry.status,
      timestamp: entry.timestamp
    })),
    items: (order.items || []).map((item) => ({
      nama: item.nama_snapshot || item.nama || '',
      layanan: item.service_nama || item.nama_layanan || '',
      qty: item.qty || 1,
      foto_before: (item.gallery || []).filter((g) => g.kind === 'before').map((g) => g.url),
      foto_after: (item.gallery || []).filter((g) => g.kind === 'after').map((g) => g.url)
    }))
  };
}

function resolveReadyStatus(tracking) {
  const seen = [tracking.status, ...tracking.status_history.map((h) => h.status)];
  const fromHistory = READY_STATUSES.find((status) => seen.includes(status));
  if (fromHistory) return fromHistory;
  if (tracking.metode === ORDER_METHODS.DIJEMPUT) return 'Siap Diantar';
  if (tracking.metode === ORDER_METHODS.DIKIRIM) return 'Dikirim';
  return 'Siap Diambil';
}

export function isFailedStatus(status) {
  return TERMINAL_FAILED.includes(status);
}

// Menyusun tahapan sesuai alur status PRD; tahap opsional hanya muncul bila relevan.
export function buildTrackingSteps(tracking) {
  const history = tracking.status_history || [];
  const seen = history.map((h) => h.status);
  const flow = ['Menunggu Konfirmasi', 'Dikonfirmasi'];
  if (tracking.metode === ORDER_METHODS.DIJEMPUT || seen.includes('Sedang Dijemput') || tracking.status === 'Sedang Dijemput') {
    flow.push('Sedang Dijemput');
  }
  flow.push('Diproses', resolveReadyStatus({ ...tracking, status_history: history }), 'Selesai');

  const failed = isFailedStatus(tracking.status);
  const currentIndex = flow.indexOf(tracking.status);

  const timestampFor = (status, index) => {
    const entry = [...history].reverse().find((h) => h.status === status);
    if (entry) return entry.timestamp;
    if (history.length === 0) {
      if (index === 0) return tracking.created_at;
      if (index === currentIndex) return tracking.updated_at;
    }
    return null;
  };

  return flow.map((status, index) => {
    let state = 'upcoming';
    if (failed) {
      state = seen.includes(status) ? 'done' : 'upcoming';
    } else if (tracking.status === 'Selesai' || index < currentIndex) {
      state = 'done';
    } else if (index === currentIndex) {
      state = 'active';
    }
    return {
      status,
      description: STEP_DESCRIPTIONS[status] || '',
      state,
      timestamp: state === 'upcoming' ? null : timestampFor(status, index)
    };
  });
}
