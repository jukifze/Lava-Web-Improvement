import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg'
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault(); closeRef.current();
      }
      if (e.key === 'Tab') {
        const targets = [...(panelRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex="0"]') || [])].filter(node => node.getClientRects().length);
        const first = targets[0]; const last = targets.at(-1);
        if (!first) { e.preventDefault(); panelRef.current?.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      panelRef.current?.querySelector('button')?.focus();
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-brand-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} className={cn("relative w-full bg-white rounded-card shadow-xl border border-brand-200 p-6 z-10 max-h-[90vh] flex flex-col", maxWidth)}>
        <div className="flex items-center justify-between pb-4 border-b border-brand-200 shrink-0">
          <h3 id={titleId} className="text-xl font-semibold text-brand-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-wet hover:text-brand-900 p-1.5 rounded-full hover:bg-brand-100 transition-colors"
            aria-label="Tutup jendela modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-4 overflow-y-auto grow">
          {children}
        </div>
      </div>
    </div>
  );
}
