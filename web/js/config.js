/*
 * إعدادات موقع شاهين — الملف الوحيد الذي يُعدَّل عند النشر.
 * Shaheen website configuration — the only file to edit at deploy time.
 *
 * API_BASE            عنوان الواجهة البرمجية مع /v1 بلا شرطة في النهاية.
 *                     After changing it, add the same origin to connect-src in /_headers.
 * APP_URL             رابط تطبيق الويب (PWA) بصيغة https.
 * TURNSTILE_SITE_KEY  مفتاح الموقع العام من Cloudflare Turnstile (ليس المفتاح السري).
 *
 * القيم التي تنتهي بـ .example أو تبدأ بـ REPLACE تُعامل كغير مُعدّة: النماذج تعرض رسالة واضحة ولا ترسل.
 */
window.SHAHEEN_CONFIG = Object.freeze({
  API_BASE: 'https://api.shaheen.example/v1',
  APP_URL: 'https://app.shaheen.example',
  TURNSTILE_SITE_KEY: 'REPLACE_WITH_TURNSTILE_SITE_KEY'
});
