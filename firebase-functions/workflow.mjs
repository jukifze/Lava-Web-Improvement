export const STATUS_TRANSITIONS = {
  'Menunggu Konfirmasi': ['Dikonfirmasi', 'Ditolak', 'Dibatalkan'],
  Dikonfirmasi: ['Sedang Dijemput', 'Diproses', 'Dikirim', 'Siap Diambil', 'Dibatalkan'],
  'Sedang Dijemput': ['Diproses', 'Dibatalkan'],
  Diproses: ['Siap Diantar', 'Siap Diambil', 'Dikirim', 'Dibatalkan'],
  'Siap Diantar': ['Selesai', 'Dibatalkan'],
  'Siap Diambil': ['Selesai', 'Dibatalkan'],
  Dikirim: ['Selesai', 'Dibatalkan'], Selesai: [], Ditolak: [], Dibatalkan: [],
};

export function getNextOrderStatuses(order) {
  const fallback = STATUS_TRANSITIONS[order.status] || [];
  // Historical imported orders have no method/category; don't invent one.
  if (!order.metode || !order.items?.length || order.items.some(item => !item.kategori)) return fallback;
  const soapOnly = order.items.every(item => item.kategori === 'sabun');
  if (order.status === 'Dikonfirmasi') {
    const next = soapOnly ? (order.metode === 'dikirim' ? 'Dikirim' : 'Siap Diambil')
      : order.metode === 'dijemput' ? 'Sedang Dijemput' : 'Diproses';
    return [next, 'Dibatalkan'];
  }
  if (order.status === 'Diproses') return [order.metode === 'dijemput' ? 'Siap Diantar' : order.metode === 'dikirim' ? 'Dikirim' : 'Siap Diambil', 'Dibatalkan'];
  return fallback;
}
