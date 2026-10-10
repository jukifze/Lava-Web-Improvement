import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, MessageCircle, PackageSearch, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ordersApi, settingsApi } from '../../lib/api';
import { buildTrackingSteps, isFailedStatus } from '../../features/orders/tracking';
import { cn } from '../../lib/utils';

const METHOD_LABELS = {
  dijemput: 'Dijemput kurir',
  antar_sendiri: 'Antar sendiri ke outlet',
  dikirim: 'Dikirim ke alamat',
  ambil_sendiri: 'Ambil di outlet'
};

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPrice(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function statusBadgeVariant(status) {
  if (status === 'Selesai') return 'success';
  if (isFailedStatus(status)) return 'danger';
  if (status === 'Menunggu Konfirmasi') return 'waiting';
  return 'process';
}

function StepList({ steps }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.status} className="flex gap-4" aria-current={step.state === 'active' ? 'step' : undefined}>
            <div className="flex flex-col items-center shrink-0">
              <span
                aria-hidden="true"
                className={cn(
                  'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  step.state === 'done' && 'bg-brand-900 border-brand-900 text-white',
                  step.state === 'active' && 'bg-brand-600 border-brand-600 text-white',
                  step.state === 'upcoming' && 'bg-white border-brand-200 text-slate-wet'
                )}
              >
                {step.state === 'done' ? <Check className="w-4 h-4" /> : index + 1}
              </span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn('w-0.5 flex-1 min-h-6', step.state === 'done' ? 'bg-brand-900' : 'bg-brand-200')}
                />
              )}
            </div>
            <div className={cn('flex flex-col gap-0.5 min-w-0', !isLast && 'pb-5')}>
              <span className={cn('text-sm sm:text-base font-semibold', step.state === 'upcoming' ? 'text-slate-wet' : 'text-brand-900')}>
                {step.status}
              </span>
              <span className="text-xs sm:text-sm text-slate-wet leading-relaxed">{step.description}</span>
              <span className={cn('text-xs font-semibold', step.state === 'active' ? 'text-brand-600' : 'text-slate-wet')}>
                {step.state === 'active' && 'Sedang berlangsung'}
                {step.state === 'active' && step.timestamp && ' · '}
                {step.state !== 'upcoming' && formatDateTime(step.timestamp)}
                {step.state === 'upcoming' && 'Menunggu'}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PhotoGroup({ label, urls, itemName }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-wet">{label}</span>
      {urls.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {urls.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-brand-200 focus:outline-hidden focus:ring-2 focus:ring-brand-600">
              <img
                src={url}
                alt={`Foto ${label.toLowerCase()} ${itemName} ${index + 1}`}
                loading="lazy"
                className="w-full aspect-square object-cover"
              />
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-brand-200 bg-brand-light px-3 py-6 text-center text-xs text-slate-wet">
          Belum ada foto
        </div>
      )}
    </div>
  );
}

export function TrackOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('kode') || '');
  const [phoneSuffix, setPhoneSuffix] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    settingsApi.getSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!code.trim()) nextErrors.code = 'Masukkan kode pesanan Anda.';
    if (!/^\d{4}$/.test(phoneSuffix)) nextErrors.phone = 'Masukkan tepat 4 digit angka.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const result = await ordersApi.trackOrder(code, phoneSuffix);
      setTracking(result);
      setSearchParams({ kode: code.trim() }, { replace: true });
    } catch {
      setTracking(null);
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  const steps = tracking ? buildTrackingSteps(tracking) : [];
  const rawPhone = String(settings?.outlet_whatsapp || settings?.contact_phone || '').replace(/\D/g, '');
  const waNumber = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;
  const waUrl = waNumber && tracking
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo Lave Streat, saya ingin menanyakan pesanan ${tracking.kode}.`)}`
    : null;

  return (
    <div className="bg-brand-light min-h-screen pb-24">
      <PageHeader
        title="Lacak Pesanan"
        breadcrumb={[{ label: 'Lacak Pesanan' }]}
        subtitle="Lihat tahap pengerjaan sepatu Anda beserta foto sebelum dan sesudahnya."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-6">
        <Card>
          <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
            <Input
              label="Kode pesanan"
              id="kode-pesanan"
              placeholder="Contoh: ORD-202610-1234"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={errors.code}
              helperText="Tertera di struk dan halaman konfirmasi pesanan."
              autoComplete="off"
              required
            />
            <Input
              label="4 digit terakhir nomor WhatsApp"
              id="digit-telepon"
              inputMode="numeric"
              maxLength={4}
              placeholder="Contoh: 7848"
              value={phoneSuffix}
              onChange={(e) => setPhoneSuffix(e.target.value.replace(/\D/g, '').slice(0, 4))}
              error={errors.phone}
              helperText="Nomor yang Anda pakai saat memesan."
              autoComplete="off"
              required
            />
            <Button type="submit" size="lg" disabled={loading} className="sm:mt-[26px] h-11">
              {loading ? 'Mencari…' : 'Lacak'}
            </Button>
          </form>
        </Card>

        <div aria-live="polite" className="flex flex-col gap-6">
          {searched && !loading && !tracking && (
            <EmptyState
              icon={PackageSearch}
              title="Pesanan tidak ditemukan"
              description="Periksa kembali kode pesanan dan 4 digit terakhir nomor WhatsApp Anda. Keduanya harus sesuai dengan data saat memesan."
            />
          )}

          {tracking && (
            <>
              <Card className="flex flex-col gap-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-wet">
                      Pesanan {tracking.kode}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-brand-900">
                      {tracking.nama_depan ? `Halo, ${tracking.nama_depan}` : 'Status pesanan Anda'}
                    </h2>
                  </div>
                  <Badge variant={statusBadgeVariant(tracking.status)}>{tracking.status}</Badge>
                </div>

                {isFailedStatus(tracking.status) && (
                  <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-brand-900">
                    <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Pesanan ini berstatus <strong>{tracking.status}</strong>. Hubungi admin bila Anda memerlukan penjelasan.
                    </span>
                  </div>
                )}

                <StepList steps={steps} />

                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-brand-200 pt-5">
                  {tracking.metode && (
                    <>
                      <dt className="text-slate-wet">Metode</dt>
                      <dd className="font-semibold text-brand-900 text-right">{METHOD_LABELS[tracking.metode] || tracking.metode}</dd>
                    </>
                  )}
                  {tracking.created_at && (
                    <>
                      <dt className="text-slate-wet">Tanggal pesan</dt>
                      <dd className="font-semibold text-brand-900 text-right">{formatDateTime(tracking.created_at)}</dd>
                    </>
                  )}
                  {tracking.updated_at && (
                    <>
                      <dt className="text-slate-wet">Pembaruan terakhir</dt>
                      <dd className="font-semibold text-brand-900 text-right">{formatDateTime(tracking.updated_at)}</dd>
                    </>
                  )}
                  {tracking.total_harga != null && (
                    <>
                      <dt className="text-slate-wet">Total</dt>
                      <dd className="font-semibold text-brand-900 text-right">{formatPrice(tracking.total_harga)}</dd>
                    </>
                  )}
                </dl>
              </Card>

              {tracking.items.length > 0 && (
                <Card className="flex flex-col gap-5">
                  <h2 className="text-lg font-bold font-display text-brand-900">Item &amp; foto pengerjaan</h2>
                  <ul className="flex flex-col gap-6">
                    {tracking.items.map((item, index) => (
                      <li key={`${item.nama}-${index}`} className="flex flex-col gap-3 border-t border-brand-200 pt-5 first:border-t-0 first:pt-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold text-brand-900">{item.nama || 'Item pesanan'}</span>
                          <span className="text-xs sm:text-sm text-slate-wet">
                            {[item.layanan, `${item.qty}×`].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <PhotoGroup label="Before" urls={item.foto_before} itemName={item.nama} />
                          <PhotoGroup label="After" urls={item.foto_after} itemName={item.nama} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 font-semibold rounded-md bg-success hover:bg-emerald-700 text-white px-5 h-11 text-sm transition-all duration-150 active:scale-[0.98] shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Tanya admin via WhatsApp</span>
                  </a>
                )}
                <Link
                  to="/galeri"
                  className="inline-flex items-center justify-center font-semibold rounded-md border border-brand-200 bg-white text-brand-900 hover:bg-brand-100 px-5 h-11 text-sm transition-colors"
                >
                  Lihat galeri before–after
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
