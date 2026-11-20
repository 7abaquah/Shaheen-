// Shaheen API v1 — Cloudflare Worker entry point (router + handlers).
// Contract: contract/API.md. No framework; plain ES modules.

import { PLANS } from './plans.js';
import {
  SECURITY_HEADERS,
  checkOrigin,
  clientIp,
  corsHeaders,
  hashIp,
  isAdminAuthorized,
  preflightHeaders,
  verifyTurnstile,
} from './security.js';
import {
  INVESTOR_STATUSES,
  PLAN_REQUEST_STATUSES,
  REFERENCE_RE,
  honeypotTripped,
  isPlainObject,
  validateInvestor,
  validateListQuery,
  validatePlanRequest,
  validateStatusPatch,
  validateSubscribe,
} from './validate.js';
import {
  appendAudit,
  hitRateLimit,
  insertInvestor,
  insertPlanRequest,
  insertSubscriber,
  listAllInvestors,
  listRecords,
  updateStatusWithAudit,
} from './db.js';
import { toCsv } from './csv.js';

const API_VERSION = '1.0.0';
const MAX_BODY_BYTES = 8 * 1024;
const DEFAULT_CONSENT_VERSION = '2026-11';

const MESSAGES = Object.freeze({
  invalid: 'تعذّر قبول الطلب، يرجى مراجعة الحقول المحددة.',
  invalid_json: 'صيغة البيانات المرسلة غير صحيحة.',
  invalid_content_type: 'يجب إرسال البيانات بصيغة JSON.',
  invalid_query: 'معاملات الاستعلام غير صحيحة.',
  captcha_failed: 'تعذّر التحقق من أنك لست روبوتًا، يرجى إعادة المحاولة.',
  forbidden_origin: 'مصدر الطلب غير مسموح به.',
  unauthorized: 'غير مصرّح لك بالوصول.',
  not_found: 'المورد المطلوب غير موجود.',
  rate_limited: 'تجاوزت الحد المسموح من الطلبات، يرجى المحاولة بعد قليل.',
  payload_too_large: 'حجم البيانات المرسلة يتجاوز الحد المسموح (8 كيلوبايت).',
  server_error: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقًا.',
});

const STATUS_BY_CODE = Object.freeze({
  invalid: 400,
  unauthorized: 401,
  captcha_failed: 403,
  forbidden_origin: 403,
  not_found: 404,
  payload_too_large: 413,
  rate_limited: 429,
  server_error: 500,
});

class HttpError extends Error {
  constructor(code, message, { fields, headers } = {}) {
    super(code);
    this.code = code;
    this.userMessage = message || MESSAGES[code];
    this.fields = fields;
    this.headers = headers;
  }
}

// ---- Responses -------------------------------------------------------------

function baseHeaders(cors, extra) {
  return { ...SECURITY_HEADERS, Vary: 'Origin', ...cors, ...extra };
}

function json(status, body, cors = {}, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: baseHeaders(cors, { 'Content-Type': 'application/json; charset=utf-8', ...extra }),
  });
}

function errorResponse(err, cors) {
  const body = { code: err.code, message: err.userMessage };
  if (err.fields && Object.keys(err.fields).length) body.fields = err.fields;
  return json(STATUS_BY_CODE[err.code] || 500, body, cors, err.headers || {});
}

// ---- Request body ----------------------------------------------------------

async function readJsonBody(request) {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) throw new HttpError('payload_too_large');

  let bytes = new Uint8Array(0);
  if (request.body) {
    const reader = request.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw new HttpError('payload_too_large');
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
  }

  const contentType = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!/^application\/json\s*(;|$)/.test(contentType)) {
    throw new HttpError('invalid', MESSAGES.invalid_content_type);
  }

  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError('invalid', MESSAGES.invalid_json);
  }
  if (!isPlainObject(parsed)) throw new HttpError('invalid', MESSAGES.invalid_json);
  return parsed;
}

// ---- Public handlers -------------------------------------------------------

function consentVersion(env) {
  return typeof env.CONSENT_VERSION === 'string' && env.CONSENT_VERSION.trim()
    ? env.CONSENT_VERSION.trim()
    : DEFAULT_CONSENT_VERSION;
}

/**
 * Shared pipeline for public POSTs:
 * rate limit → body (size, JSON) → honeypot → validation → Turnstile → store.
 */
async function publicPost(request, env, cors, route, validator, store) {
  const ip = clientIp(request);
  const ipHash = await hashIp(ip, env);

  const rl = await hitRateLimit(env.DB, route, ipHash);
  if (rl.limited) throw new HttpError('rate_limited', null, { headers: { 'Retry-After': String(rl.retryAfter) } });

  const body = await readJsonBody(request);

  // Bots that fill the hidden field get a success response and nothing is stored.
  if (honeypotTripped(body)) return json(201, { ok: true }, cors);

  const v = validator(body);
  if (!v.ok) throw new HttpError('invalid', null, { fields: v.errors });

  if (!(await verifyTurnstile(body.turnstileToken, ip, env))) throw new HttpError('captcha_failed');

  const meta = { ipHash, consentVersion: consentVersion(env), now: new Date().toISOString() };
  const extra = await store(env.DB, v.data, meta);
  return json(201, { ok: true, ...extra }, cors);
}

const PUBLIC_POSTS = {
  '/v1/subscribe': {
    validator: validateSubscribe,
    store: async (db, data, meta) => {
      // Same response whether or not the email already exists (no enumeration).
      await insertSubscriber(db, data, meta);
      return {};
    },
  },
  '/v1/plan-requests': {
    validator: validatePlanRequest,
    store: async (db, data, meta) => ({ reference: await insertPlanRequest(db, data, meta) }),
  },
  '/v1/investors': {
    validator: validateInvestor,
    store: async (db, data, meta) => ({ reference: await insertInvestor(db, data, meta) }),
  },
};

// ---- Admin handlers --------------------------------------------------------

const ADMIN_LISTS = {
  '/v1/admin/subscribers': { table: 'subscribers', statuses: null },
  '/v1/admin/plan-requests': { table: 'plan_requests', statuses: PLAN_REQUEST_STATUSES },
  '/v1/admin/investors': { table: 'investors', statuses: INVESTOR_STATUSES },
};

const ADMIN_PATCHES = [
  { re: /^\/v1\/admin\/investors\/([^/]+)$/, table: 'investors', prefix: 'INV', statuses: INVESTOR_STATUSES, action: 'investor.status_update' },
  { re: /^\/v1\/admin\/plan-requests\/([^/]+)$/, table: 'plan_requests', prefix: 'REQ', statuses: PLAN_REQUEST_STATUSES, action: 'plan_request.status_update' },
];

const INVESTOR_CSV_COLUMNS = [
  { key: 'reference', header: 'reference' },
  { key: 'createdAt', header: 'created_at' },
  { key: 'status', header: 'status' },
  { key: 'fullName', header: 'full_name' },
  { key: 'email', header: 'email' },
  { key: 'phone', header: 'phone' },
  { key: 'country', header: 'country' },
  { key: 'investorType', header: 'investor_type' },
  { key: 'organization', header: 'organization' },
  { key: 'ticketRange', header: 'ticket_range_usd' },
  { key: 'qualifiedDeclaration', header: 'qualified_declaration' },
  { key: 'message', header: 'message' },
  { key: 'lang', header: 'lang' },
  { key: 'consentVersion', header: 'consent_version' },
  { key: 'consentAt', header: 'consent_at' },
  { key: 'adminNote', header: 'admin_note' },
  { key: 'updatedAt', header: 'updated_at' },
];

async function handleAdmin(request, env, cors, url) {
  if (!(await isAdminAuthorized(request, env))) throw new HttpError('unauthorized');
  const path = url.pathname;
  const method = request.method;

  if (method === 'GET' && Object.hasOwn(ADMIN_LISTS, path)) {
    const { table, statuses } = ADMIN_LISTS[path];
    const q = validateListQuery(url.searchParams, statuses);
    if (!q.ok) throw new HttpError('invalid', MESSAGES.invalid_query, { fields: q.errors });
    return json(200, await listRecords(env.DB, table, q.data), cors);
  }

  if (method === 'GET' && path === '/v1/admin/export/investors.csv') {
    const q = validateListQuery(url.searchParams, INVESTOR_STATUSES);
    if (!q.ok) throw new HttpError('invalid', MESSAGES.invalid_query, { fields: q.errors });
    const rows = await listAllInvestors(env.DB, q.data.status);
    const now = new Date().toISOString();
    await appendAudit(env.DB, 'investors.export', 'investors.csv', { rows: rows.length, status: q.data.status }, now);
    return new Response(toCsv(INVESTOR_CSV_COLUMNS, rows), {
      status: 200,
      headers: baseHeaders(cors, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="shaheen-investors-${now.slice(0, 10)}.csv"`,
      }),
    });
  }

  if (method === 'PATCH') {
    for (const p of ADMIN_PATCHES) {
      const m = p.re.exec(path);
      if (!m) continue;
      let reference;
      try {
        reference = decodeURIComponent(m[1]);
      } catch {
        throw new HttpError('not_found');
      }
      if (!REFERENCE_RE.test(reference) || !reference.startsWith(`${p.prefix}-`)) throw new HttpError('not_found');
      const body = await readJsonBody(request);
      const v = validateStatusPatch(body, p.statuses);
      if (!v.ok) throw new HttpError('invalid', null, { fields: v.errors });
      const now = new Date().toISOString();
      const found = await updateStatusWithAudit(env.DB, p.table, reference, v.data.status, v.data.note, p.action, now);
      if (!found) throw new HttpError('not_found');
      return json(200, { ok: true }, cors);
    }
  }

  throw new HttpError('not_found');
}

// ---- Router ----------------------------------------------------------------

async function route(request, env, cors, url) {
  const { pathname: path } = url;
  const method = request.method;

  if (method === 'GET' && path === '/v1/health') return json(200, { ok: true, version: API_VERSION }, cors);
  if (method === 'GET' && path === '/v1/plans') return json(200, { plans: PLANS }, cors);

  if (method === 'POST' && Object.hasOwn(PUBLIC_POSTS, path)) {
    const { validator, store } = PUBLIC_POSTS[path];
    return publicPost(request, env, cors, path, validator, store);
  }

  if (path === '/v1/admin' || path.startsWith('/v1/admin/')) return handleAdmin(request, env, cors, url);

  throw new HttpError('not_found');
}

export default {
  async fetch(request, env, ctx) {
    let cors = {};
    try {
      const origin = checkOrigin(request, env);
      if (!origin.allowed) throw new HttpError('forbidden_origin');
      cors = corsHeaders(origin.origin);

      if (request.method === 'OPTIONS') {
        if (!origin.present) throw new HttpError('forbidden_origin');
        return new Response(null, { status: 204, headers: baseHeaders({}, preflightHeaders(origin.origin)) });
      }

      return await route(request, env, cors, new URL(request.url));
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err, cors);
      // Never leak internals: log server-side only, return a generic message.
      console.error('[shaheen-api] unhandled error:', err && err.message ? err.message : String(err));
      return errorResponse(new HttpError('server_error'), cors);
    }
  },
};
