import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import worker from '../src/index.js';
import { D1DatabaseShim, applyMigrations } from '../scripts/d1-sqlite-shim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = join(root, 'migrations');

export const ORIGIN = 'https://shaheen.example';
export const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef-XYZ'; // ≥ 32 chars
export const TURNSTILE_SECRET = 'test-turnstile-secret';
export const VALID_TOKEN = 'valid-turnstile-token';

/** Mocked Turnstile: succeeds only for VALID_TOKEN with the right secret. */
export const turnstileCalls = [];
globalThis.fetch = async (url, init = {}) => {
  const params = new URLSearchParams(String(init.body ?? ''));
  turnstileCalls.push({ url: String(url), method: init.method, params });
  if (String(url) !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    throw new Error(`Unexpected fetch to ${url}`);
  }
  const success = params.get('secret') === TURNSTILE_SECRET && params.get('response') === VALID_TOKEN;
  return new Response(JSON.stringify({ success, 'error-codes': success ? [] : ['invalid-input-response'] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export function makeEnv(overrides = {}) {
  const db = new D1DatabaseShim(':memory:');
  applyMigrations(db, MIGRATIONS_DIR);
  return {
    DB: db,
    ALLOWED_ORIGINS: `${ORIGIN}, https://localhost ,capacitor://localhost`,
    CONSENT_VERSION: '2026-11',
    TURNSTILE_SECRET,
    ADMIN_TOKEN,
    IP_SALT: 'test-ip-salt-0123456789',
    ...overrides,
  };
}

let ipCounter = 0;
/** A fresh client IP so rate limits never leak between test cases. */
export function freshIp() {
  ipCounter += 1;
  return `10.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}.1`;
}

/**
 * Calls the Worker's fetch handler.
 * opts: { method, body (object|string), origin (null = no header), ip, headers, token }
 */
export async function call(env, path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin !== null) headers.set('Origin', origin);
  headers.set('CF-Connecting-IP', opts.ip || '198.51.100.7');
  if (opts.token !== undefined) headers.set('Authorization', `Bearer ${opts.token}`);
  let body;
  if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  const req = new Request(`https://api.shaheen.example${path}`, { method: opts.method || 'GET', headers, body });
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const res = await worker.fetch(req, env, ctx);
  // Read raw bytes and keep a leading BOM (Response.text() would strip it).
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { res, status: res.status, headers: res.headers, bytes, text, json };
}

export const validSubscribe = (over = {}) => ({
  name: 'عبدالله',
  email: 'User@Example.com',
  phone: '+966500000001',
  lang: 'ar',
  interests: ['app', 'news'],
  consent: true,
  turnstileToken: VALID_TOKEN,
  website: '',
  ...over,
});

export const validPlanRequest = (over = {}) => ({
  planId: 'pro-fleet',
  organization: 'شركة الاختبار',
  contactName: 'محمد',
  email: 'sales@example.sa',
  phone: '+966500000002',
  paymentMethod: 'bank',
  seats: 10,
  notes: 'ملاحظة',
  consent: true,
  turnstileToken: VALID_TOKEN,
  website: '',
  ...over,
});

export const validInvestor = (over = {}) => ({
  fullName: 'سارة أحمد',
  email: 'investor@example.com',
  phone: '+971500000003',
  country: 'ae',
  investorType: 'individual',
  ticketRange: '10k-50k',
  qualifiedDeclaration: true,
  message: 'مهتم',
  lang: 'ar',
  consent: true,
  turnstileToken: VALID_TOKEN,
  website: '',
  ...over,
});

export function count(env, table) {
  return env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
}
