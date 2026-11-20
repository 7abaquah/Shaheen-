// Security primitives: CORS allowlist, response headers, Turnstile, IP hashing,
// constant-time admin token comparison.

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const MIN_ADMIN_TOKEN_LENGTH = 32;

const encoder = new TextEncoder();

/** Headers sent on every response. */
export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
});

/**
 * Parses the comma-separated ALLOWED_ORIGINS value. Wildcards and the opaque
 * "null" origin are never honoured, even if configured by mistake.
 */
export function parseAllowedOrigins(value) {
  if (typeof value !== 'string') return new Set();
  const out = new Set();
  for (const raw of value.split(',')) {
    const origin = raw.trim().replace(/\/+$/, '');
    if (!origin || origin === '*' || origin === 'null') continue;
    out.add(origin);
  }
  return out;
}

/**
 * Returns { present, allowed, origin }. A request without an Origin header is
 * not a cross-origin browser request; CORS does not apply to it.
 */
export function checkOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (origin === null) return { present: false, allowed: true, origin: null };
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS).has(origin);
  return { present: true, allowed, origin };
}

export function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Expose-Headers': 'Retry-After, Content-Disposition',
  };
}

export function preflightHeaders(origin) {
  return {
    ...corsHeaders(origin),
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };
}

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export async function sha256Hex(text) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/**
 * IPv6 clients usually control a whole /64, so rate limiting by full address is trivially
 * bypassed. IPv6 addresses are reduced to their /64 prefix; IPv4 is kept as-is.
 */
export function rateKeyIp(ip) {
  const raw = String(ip || '').trim().toLowerCase().replace(/%.*$/, '');
  if (!raw.includes(':')) return raw || 'unknown';
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(raw)) return raw.slice(7); // IPv4-mapped
  const [head, tail = ''] = raw.split('::');
  const h = head ? head.split(':') : [];
  const t = raw.includes('::') ? (tail ? tail.split(':') : []) : [];
  const full = raw.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  if (full.length !== 8 || full.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return raw;
  return full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Client IP as reported by Cloudflare (overwritten by the edge, not client-controllable), keyed for rate limiting. */
export function clientIp(request) {
  return rateKeyIp((request.headers.get('CF-Connecting-IP') || '').trim() || 'unknown');
}

/**
 * Salted SHA-256 of the client IP. The raw IP is never stored.
 * Throws when IP_SALT is missing so the deployment fails closed.
 */
export async function hashIp(ip, env) {
  const salt = env.IP_SALT;
  if (typeof salt !== 'string' || salt.length < 16) {
    throw new Error('IP_SALT secret is missing or shorter than 16 characters');
  }
  return sha256Hex(`${salt}:${ip}`);
}

/**
 * Constant-time comparison. Both values are hashed first so the comparison
 * always runs over 32 bytes regardless of input length.
 */
export async function timingSafeEqualStrings(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(String(a))),
    crypto.subtle.digest('SHA-256', encoder.encode(String(b))),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/**
 * Checks `Authorization: Bearer <ADMIN_TOKEN>`. If the configured token is
 * missing or shorter than 32 characters, every admin call is rejected.
 */
export async function isAdminAuthorized(request, env) {
  const configured = env.ADMIN_TOKEN;
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer[ \t]+(.+)$/.exec(header);
  const provided = match ? match[1].trim() : '';
  const configuredOk = typeof configured === 'string' && configured.length >= MIN_ADMIN_TOKEN_LENGTH;
  // Always run the comparison so timing does not reveal which check failed.
  const equal = await timingSafeEqualStrings(provided, configuredOk ? configured : '\u0000invalid');
  return configuredOk && provided.length > 0 && equal;
}

/**
 * Verifies a Turnstile token. Returns true only on an explicit success from
 * Cloudflare. Skipped only when TURNSTILE_DISABLED is exactly "1" (local dev).
 */
export async function verifyTurnstile(token, ip, env) {
  if (env.TURNSTILE_DISABLED === '1') return true;
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
  const secret = env.TURNSTILE_SECRET;
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error('TURNSTILE_SECRET secret is not configured');
  }
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip && ip !== 'unknown') body.set('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data !== null && typeof data === 'object' && data.success === true;
  } catch {
    // Network failure or timeout: fail closed.
    return false;
  }
}
