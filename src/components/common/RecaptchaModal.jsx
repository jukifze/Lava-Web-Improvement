import React, { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';

let scriptPromise;
function loadRecaptcha() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit&hl=id';
    script.async = true;
    const timeout = setTimeout(() => reject(new Error('Verifikasi belum dapat dimuat. Tutup dan coba lagi.')), 15000);
    script.onload = () => { clearTimeout(timeout); window.grecaptcha.ready(() => resolve(window.grecaptcha)); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Verifikasi gagal dimuat. Periksa koneksi Anda.')); };
    document.head.appendChild(script);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}

function RecaptchaWidget({ onSuccess }) {
  const element = useRef(null);
  const success = useRef(onSuccess);
  const [error, setError] = useState('');
  success.current = onSuccess;
  useEffect(() => {
    let active = true;
    let widget;
    const sitekey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!sitekey) { setError('Verifikasi keamanan belum dikonfigurasi. Pesanan online belum tersedia. Silakan hubungi tim kami.'); return; }
    loadRecaptcha().then(api => {
      if (!active || !element.current) return;
      widget = api.render(element.current, { sitekey, size: 'compact',
        callback: token => { if (active) success.current(token); },
        'expired-callback': () => { if (active) setError('Verifikasi kedaluwarsa. Silakan centang kembali.'); },
        'error-callback': () => { if (active) setError('Verifikasi gagal. Tutup dan coba lagi.'); },
      });
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; if (widget != null) window.grecaptcha?.reset(widget); };
  }, []);
  return <div className="space-y-4"><p className="text-sm text-slate-wet">Centang verifikasi berikut untuk mengirim pesanan dengan aman.</p><div ref={element} className="flex justify-center" />{error && <p role="alert" className="text-sm text-danger">{error}</p>}</div>;
}

export function RecaptchaModal({ isOpen, onClose, onSuccess }) {
  return <Modal isOpen={isOpen} onClose={onClose} title="Verifikasi Keamanan" maxWidth="max-w-sm">{isOpen && <RecaptchaWidget onSuccess={onSuccess} />}</Modal>;
}
