// يجمع ملفات البناء في: صفحة Artifact واحدة + حزمة PWA قابلة للنشر
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const css = readFileSync('dist/app.css', 'utf8');
const js = readFileSync('dist/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@400;500;700;800&display=swap">';

// 1) صفحة Artifact (الغلاف يضاف عند النشر)
writeFileSync('dist/artifact.html',
`<title>منظومة شاهين</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#070502">
${fonts}
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`);

// 2) حزمة PWA
mkdirSync('dist/pwa/icons', { recursive: true });
writeFileSync('dist/pwa/app.css', css);
writeFileSync('dist/pwa/app.js', readFileSync('dist/app.js', 'utf8'));

// إعدادات التشغيل من متغيرات البيئة (لا أسرار هنا: كلها قيم عامة)
const env = (k) => {
  const v = (process.env[k] || '').trim();
  if (v && k !== 'SHN_TURNSTILE_SITE_KEY' && !/^https:\/\/[^\s"'<>]+$/.test(v)) throw new Error(`${k} must be an https:// URL`);
  if (k === 'SHN_TURNSTILE_SITE_KEY' && !/^[\w-]*$/.test(v)) throw new Error('SHN_TURNSTILE_SITE_KEY has invalid characters');
  return v;
};
const runtime = {
  apiBase: env('SHN_API_BASE'),
  turnstileSiteKey: env('SHN_TURNSTILE_SITE_KEY'),
  websiteUrl: env('SHN_WEBSITE_URL'),
  appUrl: env('SHN_APP_URL'),
  presaleEnabled: process.env.SHN_PRESALE_ENABLED === '1',
};
writeFileSync('dist/pwa/config.js', `window.__SHN_CONFIG__ = ${JSON.stringify(runtime)};\n`);
for (const f of ['logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-64.png', 'mark.svg']) {
  if (existsSync(`public/${f}`)) copyFileSync(`public/${f}`, `dist/pwa/${f}`);
}
writeFileSync('dist/pwa/index.html',
`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>منظومة شاهين</title>
<meta name="description" content="منظومة شاهين المتكاملة: حوكمة، عملة SHN (BEP-20)، عقد الحوسبة، المشتركون، الدفع، والوحدات التشغيلية.">
<meta name="theme-color" content="#070502">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="شاهين">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
${fonts}
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="config.js"></script>
<script src="app.js" defer></script>
</body>
</html>
`);
writeFileSync('dist/pwa/manifest.webmanifest', JSON.stringify({
  name: 'منظومة شاهين',
  short_name: 'شاهين',
  description: 'منظومة شاهين المتكاملة — SHN على BNB Chain',
  lang: 'ar', dir: 'rtl',
  start_url: './', scope: './', id: './',
  display: 'standalone', orientation: 'portrait',
  background_color: '#070502', theme_color: '#070502',
  categories: ['finance', 'business', 'productivity'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'الاشتراك والمستثمرون', url: './#join' },
    { name: 'الحوكمة', url: './#governance' },
    { name: 'السوق والبيع المسبق', url: './#market' },
    { name: 'الدفع', url: './#payments' },
  ],
}, null, 2));
// اسم التخزين مرتبط بمحتوى البناء: أي تغيير في الكود أو الإعدادات يحدّث التطبيق المثبت
const buildHash = createHash('sha256')
  .update(readFileSync('dist/pwa/app.js')).update(readFileSync('dist/pwa/app.css')).update(readFileSync('dist/pwa/config.js'))
  .digest('hex').slice(0, 12);
writeFileSync('dist/pwa/sw.js',
`// Service Worker: تخزين الواجهة للعمل دون اتصال
const CACHE = 'shaheen-${buildHash}';
const ASSETS = ['./', 'index.html', 'config.js', 'app.js', 'app.css', 'logo.svg', 'mark.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // الخطوط والخادم وأي طرف خارجي من الشبكة مباشرة
  const fresh = e.request.mode === 'navigate' || /\\/(index\\.html|config\\.js)?$/.test(url.pathname);
  const save = (res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  };
  // الصفحة والإعدادات: من الشبكة أولًا ثم التخزين عند انقطاع الاتصال
  if (fresh) {
    e.respondWith(fetch(e.request).then(save).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then(save).catch(() => caches.match('index.html'))));
});
`);
console.log('assembled: dist/artifact.html + dist/pwa/');
