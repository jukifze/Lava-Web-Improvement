export const STATUS_MESSAGES = {
  'Menunggu Konfirmasi': 'Pesanan diterima. Tim kami akan mengonfirmasi jadwal dan detail perawatan.',
  Dikonfirmasi: 'Pesanan sudah dikonfirmasi dan masuk antrean pengerjaan.',
  'Sedang Dijemput': 'Tim kami sedang menjemput sepatu sesuai jadwal yang dikonfirmasi.',
  Diproses: 'Sepatu sedang ditangani oleh tim perawatan kami.',
  'Siap Diantar': 'Perawatan selesai. Sepatu siap diantar ke alamat Anda.',
  'Siap Diambil': 'Pesanan sudah siap. Silakan ambil di outlet sesuai jam operasional.',
  Dikirim: 'Pesanan sedang dalam pengiriman ke alamat Anda.',
  Selesai: 'Pesanan selesai. Terima kasih sudah merawat sepatu bersama Lave Streat.',
  Ditolak: 'Pesanan belum dapat kami terima. Hubungi tim kami untuk informasi lebih lanjut.',
  Dibatalkan: 'Pesanan dibatalkan. Hubungi tim kami bila membutuhkan bantuan.',
};

export function buildProgress(order) {
  const actual = new Map((order.history || []).map(entry => [entry.status, entry.timestamp]));
  const soapOnly = order.items?.length > 0 && order.items.every(item => item.category === 'sabun');
  const deliveryStatus = actual.has('Siap Diantar') || order.status === 'Siap Diantar' ? 'Siap Diantar'
    : actual.has('Siap Diambil') || order.status === 'Siap Diambil' ? 'Siap Diambil'
      : actual.has('Dikirim') || order.status === 'Dikirim' ? 'Dikirim'
        : order.method === 'dijemput' ? 'Siap Diantar'
          : order.method === 'dikirim' ? 'Dikirim' : 'Siap Diambil';
  const stages = ['Menunggu Konfirmasi', 'Dikonfirmasi'];
  if ((order.method === 'dijemput' && !soapOnly) || actual.has('Sedang Dijemput') || order.status === 'Sedang Dijemput') stages.push('Sedang Dijemput');
  if (!soapOnly || actual.has('Diproses') || order.status === 'Diproses') stages.push('Diproses');
  stages.push(deliveryStatus, 'Selesai');
  const terminal = ['Ditolak', 'Dibatalkan'].includes(order.status);
  let currentIndex = stages.indexOf(order.status);
  if (terminal) currentIndex = Math.max(-1, ...stages.map((stage, index) => actual.has(stage) ? index : -1));
  return { terminal, stages: stages.map((status, index) => ({
    status, timestamp: actual.get(status) || (status === 'Menunggu Konfirmasi' ? order.createdAt : null),
    state: terminal ? (actual.has(status) ? 'done' : 'pending')
      : index === currentIndex ? (status === 'Selesai' ? 'done' : 'current')
        : index < currentIndex ? 'done' : 'pending',
    // A past stage without a recorded timestamp is not a fabricated event.
    recorded: actual.has(status),
  })) };
}

export function formatTrackingDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(date) + ' WIB';
}
