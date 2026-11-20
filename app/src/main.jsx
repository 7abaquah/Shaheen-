import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const logo = (typeof window !== 'undefined' && window.__SHN_LOGO__) || 'logo.svg';
createRoot(document.getElementById('root')).render(<App logoSrc={logo} />);

// Service Worker للنسخة المنشورة على نطاق HTTPS فقط (لا يعمل داخل إطار Claude)
// ولا داخل تطبيق الجوال (Capacitor يخدم الملفات من الحزمة نفسها)
const native = typeof window !== 'undefined' && !!window.Capacitor && window.Capacitor.isNativePlatform?.();
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !window.claude && !native && location.protocol === 'https:' && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
