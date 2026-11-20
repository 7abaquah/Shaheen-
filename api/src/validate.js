// Input validation for every endpoint. Unknown fields are ignored; only the
// whitelisted, normalized values are returned in `data`.

import { isPlanId } from './plans.js';

export const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,63}$/;
export const PHONE_RE = /^\+[1-9]\d{7,14}$/;
export const REFERENCE_RE = /^(REQ|INV)-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

export const LANGS = Object.freeze(['ar', 'en']);
export const INTERESTS = Object.freeze(['app', 'presale', 'mining', 'staking', 'news']);
export const PAYMENT_METHODS = Object.freeze(['bank', 'card', 'usdt']);
export const INVESTOR_TYPES = Object.freeze(['individual', 'institution']);
export const TICKET_RANGES = Object.freeze(['under-10k', '10k-50k', '50k-250k', 'over-250k']);
export const INVESTOR_STATUSES = Object.freeze(['new', 'contacted', 'kyc_requested', 'approved', 'rejected']);
export const PLAN_REQUEST_STATUSES = Object.freeze(['new', 'invoiced', 'paid', 'active', 'cancelled']);

// ISO 3166-1 alpha-2 officially assigned codes (249).
export const COUNTRY_CODES = new Set(
  (
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
    'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
  ).split(' '),
);

export const MSG = Object.freeze({
  required: 'هذا الحقل مطلوب.',
  mustBeText: 'يجب أن تكون القيمة نصًا.',
  length: (min, max) => `يجب أن يكون طول النص بين ${min} و${max} حرفًا.`,
  maxLength: (max) => `يجب ألا يتجاوز النص ${max} حرفًا.`,
  controlChars: 'يحتوي النص على رموز غير مسموح بها.',
  email: 'البريد الإلكتروني غير صالح.',
  phone: 'رقم الجوال يجب أن يكون بالصيغة الدولية، مثل ‎+966500000000.',
  lang: 'اللغة يجب أن تكون ar أو en.',
  interests: 'اختر اهتمامًا واحدًا على الأقل من القائمة المتاحة.',
  consent: 'يجب الموافقة على سياسة الخصوصية ومعالجة البيانات الشخصية.',
  planId: 'الباقة المختارة غير موجودة.',
  paymentMethod: 'طريقة الدفع غير مدعومة.',
  seats: 'عدد المقاعد يجب أن يكون عددًا صحيحًا بين 1 و500.',
  country: 'رمز الدولة غير صالح (ISO 3166-1 alpha-2).',
  investorType: 'نوع المستثمر غير صالح.',
  organizationRequired: 'اسم الجهة مطلوب للمستثمر المؤسسي.',
  ticketRange: 'نطاق مبلغ الاهتمام غير صالح.',
  qualifiedDeclaration: 'يجب أن تكون قيمة الإقرار true أو false.',
  status: 'الحالة غير صالحة.',
  limit: 'قيمة limit يجب أن تكون عددًا صحيحًا بين 1 و200.',
  cursor: 'قيمة cursor غير صالحة.',
});

const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001F\u007F]/;
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function charLength(s) {
  return [...s].length;
}

function isBlank(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/**
 * Validates a text field. Returns the trimmed value, null (optional & blank),
 * or undefined after recording an error.
 */
function text(body, key, errors, { min = 0, max, required = true, multiline = false }) {
  const v = body[key];
  if (isBlank(v)) {
    if (required) errors[key] = MSG.required;
    return required ? undefined : null;
  }
  if (typeof v !== 'string') {
    errors[key] = MSG.mustBeText;
    return undefined;
  }
  const s = v.normalize('NFC').trim();
  if ((multiline ? MULTI_LINE_FORBIDDEN : SINGLE_LINE_FORBIDDEN).test(s)) {
    errors[key] = MSG.controlChars;
    return undefined;
  }
  const len = charLength(s);
  if (len < min || len > max) {
    errors[key] = min > 0 ? MSG.length(min, max) : MSG.maxLength(max);
    return undefined;
  }
  return s;
}

function email(body, key, errors) {
  const v = body[key];
  if (isBlank(v)) {
    errors[key] = MSG.required;
    return undefined;
  }
  if (typeof v !== 'string') {
    errors[key] = MSG.email;
    return undefined;
  }
  const s = v.trim().toLowerCase();
  if (s.length > 254 || !EMAIL_RE.test(s)) {
    errors[key] = MSG.email;
    return undefined;
  }
  return s;
}

function phone(body, key, errors, required) {
  const v = body[key];
  if (isBlank(v)) {
    if (required) errors[key] = MSG.required;
    return required ? undefined : null;
  }
  if (typeof v !== 'string' || !PHONE_RE.test(v.trim())) {
    errors[key] = MSG.phone;
    return undefined;
  }
  return v.trim();
}

function oneOf(body, key, errors, allowed, message) {
  const v = body[key];
  if (isBlank(v)) {
    errors[key] = MSG.required;
    return undefined;
  }
  if (typeof v !== 'string' || !allowed.includes(v)) {
    errors[key] = message;
    return undefined;
  }
  return v;
}

function consent(body, errors) {
  if (body.consent !== true) errors.consent = MSG.consent;
}

function result(data, errors) {
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** True when the honeypot field `website` carries any non-empty value. */
export function honeypotTripped(body) {
  const v = body.website;
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function validateSubscribe(body) {
  const errors = {};
  const data = {
    name: text(body, 'name', errors, { min: 2, max: 80 }),
    email: email(body, 'email', errors),
    phone: phone(body, 'phone', errors, false),
    lang: oneOf(body, 'lang', errors, LANGS, MSG.lang),
  };
  const raw = body.interests;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > INTERESTS.length * 2) {
    errors.interests = MSG.interests;
  } else if (!raw.every((i) => typeof i === 'string' && INTERESTS.includes(i))) {
    errors.interests = MSG.interests;
  } else {
    data.interests = INTERESTS.filter((i) => raw.includes(i)); // dedupe, canonical order
  }
  consent(body, errors);
  return result(data, errors);
}

export function validatePlanRequest(body) {
  const errors = {};
  const data = {
    planId: undefined,
    organization: text(body, 'organization', errors, { min: 2, max: 120 }),
    contactName: text(body, 'contactName', errors, { min: 2, max: 80 }),
    email: email(body, 'email', errors),
    phone: phone(body, 'phone', errors, true),
    paymentMethod: oneOf(body, 'paymentMethod', errors, PAYMENT_METHODS, MSG.paymentMethod),
    seats: null,
    notes: text(body, 'notes', errors, { max: 1000, required: false, multiline: true }),
  };
  if (isBlank(body.planId)) errors.planId = MSG.required;
  else if (!isPlanId(body.planId)) errors.planId = MSG.planId;
  else data.planId = body.planId;

  if (body.seats !== undefined && body.seats !== null) {
    if (Number.isInteger(body.seats) && body.seats >= 1 && body.seats <= 500) data.seats = body.seats;
    else errors.seats = MSG.seats;
  }
  consent(body, errors);
  return result(data, errors);
}

export function validateInvestor(body) {
  const errors = {};
  const data = {
    fullName: text(body, 'fullName', errors, { min: 2, max: 100 }),
    email: email(body, 'email', errors),
    phone: phone(body, 'phone', errors, true),
    country: undefined,
    investorType: oneOf(body, 'investorType', errors, INVESTOR_TYPES, MSG.investorType),
    organization: null,
    ticketRange: oneOf(body, 'ticketRange', errors, TICKET_RANGES, MSG.ticketRange),
    qualifiedDeclaration: undefined,
    message: text(body, 'message', errors, { max: 1500, required: false, multiline: true }),
    lang: oneOf(body, 'lang', errors, LANGS, MSG.lang),
  };

  if (isBlank(body.country)) errors.country = MSG.required;
  else if (typeof body.country !== 'string' || !COUNTRY_CODES.has(body.country.trim().toUpperCase())) {
    errors.country = MSG.country;
  } else data.country = body.country.trim().toUpperCase();

  if (data.investorType === 'institution') {
    if (isBlank(body.organization)) errors.organization = MSG.organizationRequired;
    else data.organization = text(body, 'organization', errors, { min: 2, max: 120 });
  } else {
    data.organization = text(body, 'organization', errors, { max: 120, required: false });
  }

  if (typeof body.qualifiedDeclaration !== 'boolean') errors.qualifiedDeclaration = MSG.qualifiedDeclaration;
  else data.qualifiedDeclaration = body.qualifiedDeclaration;

  consent(body, errors);
  return result(data, errors);
}

export function validateStatusPatch(body, allowedStatuses) {
  const errors = {};
  const data = {
    status: oneOf(body, 'status', errors, allowedStatuses, MSG.status),
    note: text(body, 'note', errors, { max: 1000, required: false, multiline: true }),
  };
  return result(data, errors);
}

/**
 * Validates admin list query parameters. Empty values are treated as absent.
 */
export function validateListQuery(searchParams, allowedStatuses) {
  const errors = {};
  const data = { limit: 50, cursor: null, status: null };

  const limit = searchParams.get('limit');
  if (limit !== null && limit !== '') {
    if (!/^\d{1,4}$/.test(limit) || Number(limit) < 1 || Number(limit) > 200) errors.limit = MSG.limit;
    else data.limit = Number(limit);
  }
  const cursor = searchParams.get('cursor');
  if (cursor !== null && cursor !== '') {
    if (!/^[1-9]\d{0,15}$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) errors.cursor = MSG.cursor;
    else data.cursor = Number(cursor);
  }
  if (allowedStatuses) {
    const status = searchParams.get('status');
    if (status !== null && status !== '') {
      if (!allowedStatuses.includes(status)) errors.status = MSG.status;
      else data.status = status;
    }
  }
  return result(data, errors);
}
