import React from 'react';
import { Check, Clock, Circle, XCircle } from 'lucide-react';
import { buildProgress, formatTrackingDate, STATUS_MESSAGES } from './trackingModel';

export function OrderProgress({ order }) {
  const { terminal, stages } = buildProgress(order);
  return (
    <section aria-labelledby="progress-title" className="bg-white rounded-card border border-brand-200 p-5 sm:p-6 shadow-subtle">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 id="progress-title" className="text-lg font-semibold text-brand-900">Progres pesanan</h2>
          <p className="mt-1 text-sm text-slate-wet">Diperbarui oleh tim Lave Streat, bukan pelacakan kurir langsung.</p>
        </div>
        <Clock size={20} className="text-brand-600 shrink-0 mt-1" aria-hidden="true" />
      </div>
      {terminal && <div role="status" className="mb-6 p-4 rounded-lg border border-danger/30 bg-danger/5 text-brand-900 flex gap-3">
        <XCircle className="shrink-0 text-danger" size={20} aria-hidden="true" />
        <div><p className="font-semibold text-sm">{order.status}</p><p className="text-sm mt-1">{STATUS_MESSAGES[order.status]}</p></div>
      </div>}
      <ol className="space-y-0">
        {stages.map((stage, index) => (
          <li key={stage.status} aria-current={stage.state === 'current' ? 'step' : undefined} className="relative flex gap-4 pb-7 last:pb-0">
            {index < stages.length - 1 && <span aria-hidden="true" className={`absolute top-8 bottom-0 left-[15px] w-0.5 ${stage.state === 'done' ? 'bg-brand-600' : 'bg-brand-100'}`} />}
            <span className={`relative z-10 h-8 w-8 shrink-0 flex items-center justify-center rounded-full border-2 ${stage.state === 'done' ? 'bg-brand-600 border-brand-600 text-white' : stage.state === 'current' ? 'border-brand-600 bg-brand-light text-brand-600 ring-4 ring-brand-light' : 'bg-white border-brand-200 text-slate-wet'}`} aria-hidden="true">
              {stage.state === 'done' ? <Check size={16} /> : stage.state === 'current' ? <Clock size={16} /> : <Circle size={8} />}
            </span>
            <div className="min-w-0 pt-1">
              <p className={`text-sm font-semibold ${stage.state === 'pending' ? 'text-slate-wet' : 'text-brand-900'}`}>
                {stage.status}<span className="sr-only"> — {stage.state === 'done' ? 'Tahap terlewati' : stage.state === 'current' ? 'Tahap saat ini' : 'Belum berlangsung'}</span>
              </p>
              {stage.state === 'current' && <p className="mt-1 text-sm text-slate-wet leading-relaxed">{STATUS_MESSAGES[stage.status]}</p>}
              <p className="text-xs text-slate-wet mt-1.5">{formatTrackingDate(stage.timestamp) || (stage.state === 'pending' ? (terminal ? 'Tidak dilanjutkan' : 'Menunggu tahap sebelumnya') : 'Waktu tahap tidak tercatat')}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
