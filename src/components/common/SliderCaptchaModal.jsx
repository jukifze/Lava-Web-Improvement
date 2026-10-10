import React from 'react';
import { Modal } from './Modal';
import { SliderCaptcha } from './SliderCaptcha';

export function SliderCaptchaModal({ isOpen, onClose, onSuccess, title = 'Verifikasi Keamanan' }) {
  return <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
    {isOpen && <SliderCaptcha onSuccess={() => { onClose(); onSuccess(); }} />}
  </Modal>;
}
