import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ImageOff, Maximize2 } from 'lucide-react';
import { Button, buttonVariants } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { BeforeAfterCompare } from '../../features/gallery/BeforeAfterCompare';
import { galleryApi } from '../../lib/api';
import { getImageFramingStyle } from '../../lib/framing';

const ANGLES = { 1: 'Sudut depan', 2: 'Samping luar', 3: 'Samping dalam', 4: 'Belakang / sol' };

export function GalleryDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [angle, setAngle] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setAngle(0); setPhoto(null);
    galleryApi.getGallery(true).then(all => {
      if (!active) return;
      setItem(all.find(entry => String(entry.id) === String(id)) || null);
      setRelated(all.filter(entry => String(entry.id) !== String(id)).slice(0, 3));
    }).catch(() => { if (active) setError('Dokumentasi belum dapat dimuat. Periksa koneksi dan coba lagi.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  const slots = item ? (item.slots?.length ? item.slots : [{ slot: 1, before_url: item.before_url, after_url: item.after_url }]).filter(slot => slot.before_url && slot.after_url) : [];
  const selected = slots[angle] || slots[0];
  const framing = (slot, type) => getImageFramingStyle({ ...item, ...slot, [`framing_${type}`]: slot[`framing_${type}`] || (slot.slot === (item.featured_slot || 1) ? item[`framing_${type}`] : null) }, type);

  return <div className="bg-brand-light min-h-screen pt-28 sm:pt-32 pb-14 page-smooth-enter">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <Link to="/galeri" className="inline-flex gap-1 items-center text-sm font-semibold text-brand-600 hover:underline mb-6"><ChevronLeft size={17} />Kembali ke Before–After</Link>
      {loading ? <div role="status" className="space-y-4"><p className="text-sm text-slate-wet">Memuat dokumentasi…</p><div className="aspect-[16/10] rounded-card bg-brand-100 animate-pulse" /></div> : error || !item ? <section className="bg-white rounded-card border border-brand-200 p-10 text-center"><ImageOff className="mx-auto text-brand-600 mb-4" /><h1 className="text-xl font-semibold text-brand-900">{error ? 'Galeri belum dapat dimuat' : 'Dokumentasi tidak tersedia'}</h1><p className="text-sm text-slate-wet mt-3">{error || 'Dokumentasi ini belum dipublikasikan atau sudah tidak tersedia.'}</p>{error && <Button className="mt-5" onClick={() => setRetry(value => value + 1)}>Coba lagi</Button>}</section> : <>
        <header className="mb-6 sm:mb-8"><p className="text-sm text-brand-600 font-semibold mb-2">{item.layanan_terkait || 'Perawatan sepatu'}</p><h1 className="font-display font-bold text-3xl sm:text-4xl text-brand-900 leading-tight">{item.caption || 'Hasil perawatan sepatu'}</h1><p className="text-sm text-slate-wet mt-3">Sepatu yang sama, sebelum dan setelah perawatan. Pilih sudut untuk melihat detail hasilnya.</p></header>
        {slots.length > 1 && <div className="flex flex-wrap gap-2 mb-5" aria-label="Pilih sudut dokumentasi">{slots.map((slot, index) => <Button key={slot.slot || index} variant={angle === index ? 'primary' : 'secondary'} aria-pressed={angle === index} onClick={() => setAngle(index)}>{slot.label || ANGLES[slot.slot] || `Sudut ${index + 1}`}</Button>)}</div>}
        {selected ? <BeforeAfterCompare key={`${id}-${selected.slot}`} beforeUrl={selected.before_url} afterUrl={selected.after_url} beforeStyle={framing(selected, 'before')} afterStyle={framing(selected, 'after')} imageClassName="aspect-[4/3] sm:aspect-[16/10]" caption={selected.label || ANGLES[selected.slot] || 'Sudut utama'} footer={<div className="flex flex-wrap gap-2 pt-2"><Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setPhoto({ url: selected.before_url, label: 'Sebelum perawatan' })}><Maximize2 size={14} />Perbesar sebelum</Button><Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setPhoto({ url: selected.after_url, label: 'Sesudah perawatan' })}><Maximize2 size={14} />Perbesar sesudah</Button></div>} /> : <p className="p-6 bg-white border border-brand-200 rounded-card text-sm text-slate-wet">Pasangan foto belum tersedia.</p>}
        <section className="bg-white rounded-card border border-brand-200 mt-6 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-lg font-semibold text-brand-900">Sudah memesan perawatan?</h2><p className="text-sm text-slate-wet mt-1">Cek progres dan dokumentasi sepatu Anda sendiri.</p></div><Link to="/lacak-pesanan" className={buttonVariants({ variant: 'secondary', className: 'gap-2' })}>Lacak Pesanan <ChevronRight size={16} /></Link></section>
        {!!related.length && <section className="mt-12"><h2 className="text-xl font-semibold text-brand-900 mb-5">Hasil perawatan lainnya</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{related.map(entry => <BeforeAfterCompare key={entry.id} beforeUrl={entry.before_url} afterUrl={entry.after_url} beforeStyle={getImageFramingStyle(entry, 'before')} afterStyle={getImageFramingStyle(entry, 'after')} caption={entry.caption} serviceTag={entry.layanan_terkait} imageClassName="aspect-[4/3]" footer={<Link to={`/galeri/${entry.id}`} className="text-sm font-semibold text-brand-600 hover:underline">Lihat detail</Link>} />)}</div></section>}
      </>}
    </div>
    <Modal isOpen={Boolean(photo)} onClose={() => setPhoto(null)} title={photo?.label || 'Dokumentasi'} maxWidth="max-w-4xl">{photo && <img src={photo.url} alt={photo.label} className="w-full max-h-[70vh] object-contain rounded-lg" />}</Modal>
  </div>;
}
