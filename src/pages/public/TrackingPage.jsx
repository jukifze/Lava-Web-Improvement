import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search, RefreshCw, ShieldCheck, Images } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Input } from '../../components/common/Input';
import { Button, buttonVariants } from '../../components/common/Button';
import { OrderProgress } from '../../features/orders/OrderProgress';
import { BeforeAfterCompare } from '../../features/gallery/BeforeAfterCompare';
import { formatTrackingDate, STATUS_MESSAGES } from '../../features/orders/trackingModel';
import { trackingApi, isTrackingDemo, DEMO_TRACKING } from '../../lib/api/trackingApi';

const METHOD_LABELS = { dijemput: 'Dijemput & diantar', antar_sendiri: 'Antar sendiri ke outlet', dikirim: 'Dikirim ke alamat', ambil_sendiri: 'Ambil di outlet' };

export function TrackingPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('kode') || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const credentials = useRef(null);
  const requestId = useRef(0);
  const resultRef = useRef(null);
  useEffect(() => () => { requestId.current++; }, []);

  async function lookup(values, refresh = false) {
    const request = ++requestId.current;
    setBusy(true);
    setError('');
    if (!refresh) setOrder(null);
    try {
      const result = await trackingApi.lookup(values.code, values.phone);
      if (request !== requestId.current) return;
      credentials.current = values;
      setOrder(result);
      if (!refresh) requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err) {
      if (request === requestId.current) setError(err.message);
    } finally { if (request === requestId.current) setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-brand-light page-smooth-enter">
      <PageHeader title="Lacak Pesanan" breadcrumb={[{ label: 'Lacak Pesanan' }]} subtitle="Cek tahap perawatan dan lihat hasil sebelum–sesudah sepatu Anda. Tanpa perlu membuat akun." bgImage="/services/white-clean.jpg" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <aside className="bg-white rounded-card border border-brand-200 p-5 sm:p-6 shadow-subtle">
            <h2 className="text-lg font-semibold text-brand-900">Temukan pesanan Anda</h2>
            <p className="text-sm text-slate-wet mt-2 mb-6 leading-relaxed">Gunakan kode pada struk dan nomor WhatsApp yang dipakai saat memesan.</p>
            <form onSubmit={event => { event.preventDefault(); lookup({ code, phone }); }} className="space-y-4" aria-busy={busy}>
              <Input label="Kode pesanan" id="tracking-code" placeholder="Contoh: ORD-202610-1234" value={code} maxLength={44} autoCapitalize="characters" autoComplete="off" required disabled={busy} onChange={event => { setCode(event.target.value.toUpperCase()); setOrder(null); setError(''); }} />
              <Input label="Nomor WhatsApp" id="tracking-phone" type="tel" inputMode="tel" placeholder="08xx atau +628xx" value={phone} maxLength={22} autoComplete="tel" required disabled={busy} onChange={event => { setPhone(event.target.value); setOrder(null); setError(''); }} />
              <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}><Search size={18} aria-hidden="true" />{busy ? 'Mencari pesanan…' : 'Lacak Pesanan'}</Button>
              {error && <p role="alert" className="text-sm text-danger leading-relaxed">{error}</p>}
            </form>
            <div className="flex gap-2 mt-5 pt-5 border-t border-brand-100 text-xs text-slate-wet leading-relaxed"><ShieldCheck size={18} className="text-brand-600 shrink-0" aria-hidden="true" /><p>Nomor Anda hanya untuk mencocokkan pesanan. Alamat dan catatan internal tidak ditampilkan.</p></div>
            {isTrackingDemo && <div className="mt-5 p-3 rounded-lg bg-brand-light border border-brand-200">
              <p className="text-xs text-brand-900 leading-relaxed">Mode pengembangan: data contoh, bukan pesanan pelanggan asli.</p>
              <Button variant="ghost" className="mt-2 px-0 gap-2" disabled={busy} onClick={() => { setCode(DEMO_TRACKING.code); setPhone(DEMO_TRACKING.phone); lookup(DEMO_TRACKING); }}>Coba contoh pelacakan <ArrowRight size={15} /></Button>
            </div>}
          </aside>
          <div className="min-w-0">
            {busy && !order ? <div role="status" className="bg-white rounded-card border border-brand-200 p-8 space-y-5"><p className="text-sm text-slate-wet">Mencocokkan pesanan…</p>{[1, 2, 3].map(n => <div key={n} className="h-12 rounded-lg bg-brand-light animate-pulse" />)}</div> : order ? <div ref={resultRef} tabIndex={-1} className="space-y-6 focus:outline-none" aria-label={`Hasil pelacakan ${order.code}`}>
              <section className="bg-white rounded-card border border-brand-200 p-5 sm:p-6 shadow-subtle">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><p className="text-xs text-slate-wet mb-1">{order.demo ? 'Pesanan contoh' : 'Kode pesanan'}</p><h2 className="text-xl sm:text-2xl font-semibold text-brand-900 break-all">{order.code}</h2></div>
                  <Button variant="secondary" size="sm" disabled={busy} onClick={() => lookup(credentials.current, true)} className="gap-2"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{busy ? 'Memperbarui…' : 'Perbarui'}</Button>
                </div>
                <p className={`mt-4 inline-flex rounded-md px-3 py-1 text-sm font-semibold text-brand-900 ${['Ditolak', 'Dibatalkan'].includes(order.status) ? 'bg-danger/10' : order.status === 'Selesai' ? 'bg-success/10' : 'bg-brand-light'}`}>{order.status}</p>
                <p className="text-sm text-slate-wet leading-relaxed mt-3">{STATUS_MESSAGES[order.status]}</p>
                <div className="mt-4 pt-4 border-t border-brand-100 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-wet"><span>{METHOD_LABELS[order.method] || 'Metode belum tercatat'}</span><span>Update terakhir: {formatTrackingDate(order.updatedAt) || 'Belum tercatat'}</span></div>
              </section>
              <OrderProgress order={order} />
              <section aria-labelledby="order-photos-title" className="bg-white rounded-card border border-brand-200 p-5 sm:p-6 shadow-subtle">
                <h2 id="order-photos-title" className="text-lg font-semibold text-brand-900">Before–After pesanan Anda</h2><p className="text-sm text-slate-wet mt-1 mb-5">Dokumentasi ditambahkan oleh tim setelah perawatan.</p>
                {!!order.photos?.length && <div className="mb-6 space-y-3"><h3 className="text-sm font-semibold text-brand-900">Dokumentasi umum pesanan</h3><div className="grid sm:grid-cols-2 gap-4">{order.photos.map(pair => <BeforeAfterCompare key={pair.slot} beforeUrl={pair.before_url} afterUrl={pair.after_url} beforeFraming={pair.framing_before} afterFraming={pair.framing_after} objectPosition={pair.object_position} caption={pair.label} imageClassName="aspect-[4/3]" />)}</div></div>}
                <div className="space-y-6">{order.items.map((item, index) => <article key={`${item.id}-${index}`} className="space-y-3">
                  <h3 className="text-sm font-semibold text-brand-900">{item.name} <span className="font-normal text-slate-wet">× {item.quantity}</span></h3>
                  {item.photos.length ? <div className="grid sm:grid-cols-2 gap-4">{item.photos.map(pair => <BeforeAfterCompare key={pair.slot} beforeUrl={pair.before_url} afterUrl={pair.after_url} beforeFraming={pair.framing_before} afterFraming={pair.framing_after} objectPosition={pair.object_position} caption={pair.label} imageClassName="aspect-[4/3]" />)}</div> : <div className="rounded-lg border border-dashed border-brand-200 bg-brand-light/50 p-4 flex gap-3 items-start"><Images size={20} className="text-brand-600 shrink-0" aria-hidden="true" /><p className="text-sm text-slate-wet">{item.category === 'sabun' ? 'Produk perawatan tidak memerlukan foto before–after.' : 'Foto before–after untuk item ini belum tersedia. Foto akan tampil setelah pasangan foto diunggah oleh tim.'}</p></div>}
                </article>)}</div>
              </section>
              <p className="text-sm text-slate-wet">Ada pertanyaan tentang pesanan? <Link to="/kontak" className="font-semibold text-brand-600 underline underline-offset-4">Hubungi tim Lave Streat</Link>.</p>
            </div> : <section className="bg-white rounded-card border border-brand-200 p-7 sm:p-10 shadow-subtle">
              <Search size={28} className="text-brand-600 mb-5" aria-hidden="true" /><h2 className="text-xl font-semibold text-brand-900">Dari masuk workshop sampai kembali ke Anda.</h2><p className="text-sm text-slate-wet leading-relaxed mt-3 max-w-lg">Status pengerjaan, waktu pembaruan, dan dokumentasi hasil perawatan tersedia dalam satu halaman. Masukkan data pesanan untuk mulai.</p>
              <div className="mt-6 pt-6 border-t border-brand-100 flex flex-wrap gap-3"><Link to="/galeri" className={buttonVariants({ variant: 'secondary' })}>Lihat Before–After</Link><Link to="/pesan" className={buttonVariants({ variant: 'ghost' })}>Belum punya pesanan?</Link></div>
            </section>}
          </div>
        </div>
      </div>
    </div>
  );
}
