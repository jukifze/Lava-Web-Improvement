import React, { useState, useEffect, useRef, useId } from 'react';
import { ChevronsLeftRight, ImageOff } from 'lucide-react';
import { getImageFramingStyle } from '../../lib/framing';
import { Button } from '../../components/common/Button';

export function BeforeAfterCompare({
  beforeUrl, afterUrl, beforeFraming, afterFraming, beforeStyle, afterStyle,
  caption = '', serviceTag = '', className = '',
  imageClassName = 'aspect-[4/3] sm:aspect-[16/10] min-h-[260px]',
  objectPosition = '50% 50%', showHint = true, header, footer, children,
}) {
  const [position, setPosition] = useState(50);
  const [mode, setMode] = useState('slider');
  const [failed, setFailed] = useState(false);
  const dragging = useRef(false);
  const container = useRef(null);
  const id = useId();
  useEffect(() => { setPosition(50); setFailed(false); }, [beforeUrl, afterUrl]);

  function updatePosition(event) {
    const rect = container.current?.getBoundingClientRect();
    if (rect?.width) setPosition(Math.round(Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100))));
  }
  const before = beforeStyle || (beforeFraming ? getImageFramingStyle({ framing_before: beforeFraming }, 'before') : { objectPosition });
  const after = afterStyle || (afterFraming ? getImageFramingStyle({ framing_after: afterFraming }, 'after') : { objectPosition });
  const renderImage = (url, type, style) => <img src={url} alt={`${caption || 'Sepatu'} — ${type === 'before' ? 'sebelum' : 'sesudah'} perawatan`} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={style} />;
  const unavailable = failed || !beforeUrl || !afterUrl;

  return (
    <div className={`bg-white rounded-card border border-brand-200 overflow-hidden shadow-subtle flex flex-col ${className}`}>
      {unavailable ? <div role="status" className={`bg-brand-light flex flex-col items-center justify-center p-5 gap-3 text-slate-wet ${imageClassName}`}><ImageOff size={24} aria-hidden="true" /><p className="text-sm text-center">Pasangan foto belum dapat ditampilkan.</p>{beforeUrl && afterUrl && <Button variant="secondary" size="sm" onClick={() => setFailed(false)}>Coba muat ulang</Button>}</div> : <>
        {mode === 'slider' ? <div id={`${id}-images`} ref={container}
          onPointerDown={event => { if (event.button !== 0) return; dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); updatePosition(event); }}
          onPointerMove={event => { if (dragging.current) updatePosition(event); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}
          className={`relative w-full overflow-hidden select-none bg-brand-light cursor-ew-resize touch-pan-y ${imageClassName}`}>
          {renderImage(afterUrl, 'after', after)}
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>{renderImage(beforeUrl, 'before', before)}</div>
          <div aria-hidden="true" className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${position}%` }}><span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full border-2 border-brand-600 shadow-lg flex items-center justify-center text-brand-600"><ChevronsLeftRight size={20} /></span></div>
          <span className="absolute top-3 left-3 rounded-md bg-brand-900/90 text-white text-xs font-semibold px-2 py-1 pointer-events-none">Sebelum</span>
          <span className="absolute top-3 right-3 rounded-md bg-brand-600 text-white text-xs font-semibold px-2 py-1 pointer-events-none">Sesudah</span>
        </div> : <div id={`${id}-images`} className="grid grid-cols-2 gap-0.5 bg-white">
          {[['before', beforeUrl, before], ['after', afterUrl, after]].map(([type, url, style]) => <div key={type} className={`relative overflow-hidden bg-brand-light ${imageClassName}`}>{renderImage(url, type, style)}<span className={`absolute bottom-0 inset-x-0 px-2 py-2 text-center text-xs font-semibold text-white ${type === 'before' ? 'bg-brand-900/90' : 'bg-brand-600/95'}`}>{type === 'before' ? 'Sebelum' : 'Sesudah'}</span></div>)}
        </div>}
      </>}
      <div className="p-4 space-y-3 flex-1 border-t border-brand-100">
        {header}
        {caption && <p className="text-sm font-semibold text-brand-900 leading-snug">{caption}</p>}
        {serviceTag && <p className="text-xs text-slate-wet">{serviceTag}</p>}
        {!unavailable && <>
          <div className="flex gap-2" aria-label="Mode perbandingan foto">
            <Button size="sm" variant={mode === 'slider' ? 'primary' : 'secondary'} aria-pressed={mode === 'slider'} onClick={() => setMode('slider')}>Geser</Button>
            <Button size="sm" variant={mode === 'side' ? 'primary' : 'secondary'} aria-pressed={mode === 'side'} onClick={() => setMode('side')}>Berdampingan</Button>
          </div>
          {mode === 'slider' && <div className="space-y-1">
            <label htmlFor={`${id}-range`} className="text-xs text-slate-wet">{showHint ? 'Geser foto atau gunakan tombol panah pada slider.' : 'Posisi pembanding foto'}</label>
            <input id={`${id}-range`} type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} aria-label={`Perbandingan sebelum dan sesudah${caption ? `: ${caption}` : ''}`} aria-controls={`${id}-images`} aria-valuetext={`${position}% foto sebelum, ${100 - position}% foto sesudah`} className="block w-full h-5 accent-brand-600 cursor-ew-resize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 rounded" />
          </div>}
        </>}
        {children}{footer}
      </div>
    </div>
  );
}
