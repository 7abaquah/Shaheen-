// ============================================================================
// تحقق نماذج الاشتراك — مطابق لعقد الخادم contract/API.md (يُختبر في test/forms.test.mjs)
// ============================================================================
export const PAY_METHODS = [
  { id: 'bank', label: 'تحويل بنكي (فاتورة)' },
  { id: 'card', label: 'بطاقة (رابط دفع من بوابة مرخّصة)' },
  { id: 'usdt', label: 'USDT على BNB Chain (فاتورة بعنوان الاستلام)' },
];

export const TICKETS = [
  { id: 'under-10k', label: 'أقل من 10,000 دولار' },
  { id: '10k-50k', label: '10,000 – 50,000 دولار' },
  { id: '50k-250k', label: '50,000 – 250,000 دولار' },
  { id: 'over-250k', label: 'أكثر من 250,000 دولار' },
];

// ---------------------------------------------------------------- التحقق
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

// يقبل 05XXXXXXXX و 5XXXXXXXX و 9665XXXXXXXX و 00… ويحوّلها إلى E.164.
// يزيل علامات الاتجاه (تضيفها لوحات المفاتيح وجهات الاتصال في الواجهة العربية) ويحوّل الأرقام العربية والفارسية.
export function normalizePhone(raw) {
  let p = String(raw || '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\s\-().]/g, '');
  if (/^05\d{8}$/.test(p)) p = '+966' + p.slice(1);
  else if (/^5\d{8}$/.test(p)) p = '+966' + p;
  else if (/^9665\d{8}$/.test(p)) p = '+' + p;
  else if (/^00[1-9]/.test(p)) p = '+' + p.slice(2);
  return p;
}

// الطول بعدد المحارف (code points) بعد NFC، مثل الخادم
const len = (v, a, b) => { const n = [...String(v || '').trim().normalize('NFC')].length; return n >= a && n <= b; };
const over = (v, max) => [...String(v || '').normalize('NFC')].length > max;

export function validateSubscribe(f) {
  const e = {};
  if (!len(f.name, 2, 80)) e.name = 'الاسم من 2 إلى 80 حرفًا.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'بريد إلكتروني غير صحيح.';
  if (f.phone && !E164_RE.test(normalizePhone(f.phone))) e.phone = 'اكتب الرقم بالصيغة الدولية مثل ‎+9665XXXXXXXX.';
  if (!f.interests.length) e.interests = 'اختر اهتمامًا واحدًا على الأقل.';
  if (!f.consent) e.consent = 'الموافقة مطلوبة.';
  return e;
}

export function validatePlanRequest(f, planIds) {
  const e = {};
  if (!planIds.includes(f.planId)) e.planId = 'اختر باقة.';
  if (!len(f.organization, 2, 120)) e.organization = 'اسم الجهة من 2 إلى 120 حرفًا.';
  if (!len(f.contactName, 2, 80)) e.contactName = 'اسم المسؤول من 2 إلى 80 حرفًا.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'بريد إلكتروني غير صحيح.';
  if (!E164_RE.test(normalizePhone(f.phone))) e.phone = 'اكتب الرقم بالصيغة الدولية مثل ‎+9665XXXXXXXX.';
  if (!PAY_METHODS.some((m) => m.id === f.paymentMethod)) e.paymentMethod = 'اختر طريقة الدفع.';
  if (f.seats !== '' && !(Number.isInteger(Number(f.seats)) && Number(f.seats) >= 1 && Number(f.seats) <= 500)) e.seats = 'عدد صحيح من 1 إلى 500.';
  if (over(f.notes, 1000)) e.notes = 'الحد 1000 حرف.';
  if (!f.consent) e.consent = 'الموافقة مطلوبة.';
  return e;
}

export function validateInvestor(f) {
  const e = {};
  if (!len(f.fullName, 2, 100)) e.fullName = 'الاسم الكامل من 2 إلى 100 حرف.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'بريد إلكتروني غير صحيح.';
  if (!E164_RE.test(normalizePhone(f.phone))) e.phone = 'اكتب الرقم بالصيغة الدولية مثل ‎+9665XXXXXXXX.';
  const c = (f.country === 'OTHER' ? f.countryOther : f.country).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) e.country = 'اختر الدولة أو اكتب رمزها من حرفين.';
  if (!['individual', 'institution'].includes(f.investorType)) e.investorType = 'اختر نوع المستثمر.';
  if (f.investorType === 'institution' && !len(f.organization, 2, 120)) e.organization = 'اسم المؤسسة مطلوب.';
  if (over(f.organization, 120)) e.organization = 'الحد 120 حرفًا.';
  if (!TICKETS.some((t) => t.id === f.ticketRange)) e.ticketRange = 'اختر نطاق الاهتمام.';
  if (over(f.message, 1500)) e.message = 'الحد 1500 حرف.';
  if (!f.consent) e.consent = 'الموافقة مطلوبة.';
  return e;
}

