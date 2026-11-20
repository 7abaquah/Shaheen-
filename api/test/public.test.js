import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORIGIN,
  VALID_TOKEN,
  TURNSTILE_SECRET,
  call,
  count,
  freshIp,
  makeEnv,
  turnstileCalls,
  validInvestor,
  validPlanRequest,
  validSubscribe,
} from './helpers.js';

const ARABIC = /[؀-ۿ]/;

function assertError(r, status, code) {
  assert.equal(r.status, status, r.text);
  assert.equal(r.json.code, code);
  assert.match(r.json.message, ARABIC, 'error message must be Arabic');
}

function assertSecurityHeaders(headers) {
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('Cache-Control'), 'no-store');
  assert.equal(headers.get('Referrer-Policy'), 'no-referrer');
  assert.ok(headers.get('Content-Type'));
}

describe('basic endpoints', () => {
  test('GET /v1/health', async () => {
    const r = await call(makeEnv(), '/v1/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true, version: '1.0.0' });
    assert.match(r.headers.get('Content-Type'), /^application\/json/);
    assertSecurityHeaders(r.headers);
  });

  test('GET /v1/plans returns the three default plans', async () => {
    const r = await call(makeEnv(), '/v1/plans');
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.json.plans.map((p) => [p.id, p.priceSar, p.period]),
      [
        ['pro-fleet', 1800, 'month'],
        ['node-partner', 2900, 'month'],
        ['enterprise', 4500, 'month'],
      ],
    );
    assert.equal(r.json.plans[0].nameAr, 'تشغيلي متقدم');
    assert.equal(r.json.plans[0].nameEn, 'Pro Fleet');
    for (const p of r.json.plans) {
      assert.ok(p.featuresAr.length > 0 && p.featuresEn.length > 0);
    }
  });

  test('unknown route and wrong method → 404 not_found', async () => {
    const env = makeEnv();
    assertError(await call(env, '/v1/nope'), 404, 'not_found');
    assertError(await call(env, '/v1/subscribe'), 404, 'not_found');
    assertError(await call(env, '/v1/health', { method: 'POST', body: {} }), 404, 'not_found');
  });
});

describe('CORS', () => {
  test('rejects an origin not in ALLOWED_ORIGINS', async () => {
    const r = await call(makeEnv(), '/v1/health', { origin: 'https://evil.example' });
    assertError(r, 403, 'forbidden_origin');
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
    assertSecurityHeaders(r.headers);
  });

  test('rejects a disallowed origin on POST before touching the database', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(), origin: 'https://evil.example', ip: freshIp() });
    assertError(r, 403, 'forbidden_origin');
    assert.equal(count(env, 'subscribers'), 0);
    assert.equal(count(env, 'rate_limits'), 0);
  });

  test('accepts allowed website and mobile origins and echoes them', async () => {
    const env = makeEnv();
    for (const origin of [ORIGIN, 'https://localhost', 'capacitor://localhost']) {
      const r = await call(env, '/v1/health', { origin });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('Access-Control-Allow-Origin'), origin);
      assert.match(r.headers.get('Vary'), /Origin/);
    }
  });

  test('preflight for an allowed origin → 204 with allowed methods and headers', async () => {
    const r = await call(makeEnv(), '/v1/subscribe', {
      method: 'OPTIONS',
      origin: 'capacitor://localhost',
      headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'capacitor://localhost');
    assert.match(r.headers.get('Access-Control-Allow-Methods'), /POST/);
    assert.match(r.headers.get('Access-Control-Allow-Methods'), /PATCH/);
    assert.match(r.headers.get('Access-Control-Allow-Headers'), /Content-Type/);
    assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
    assert.equal(r.text, '');
  });

  test('preflight for a disallowed or missing origin → 403', async () => {
    const env = makeEnv();
    assertError(await call(env, '/v1/subscribe', { method: 'OPTIONS', origin: 'https://evil.example' }), 403, 'forbidden_origin');
    assertError(await call(env, '/v1/subscribe', { method: 'OPTIONS', origin: null }), 403, 'forbidden_origin');
  });

  test('wildcard and "null" entries in ALLOWED_ORIGINS are never honoured; trailing slash normalized', async () => {
    const env = makeEnv({ ALLOWED_ORIGINS: '*, null, https://site.example/' });
    assertError(await call(env, '/v1/health', { origin: 'null' }), 403, 'forbidden_origin');
    assertError(await call(env, '/v1/health', { origin: 'https://other.example' }), 403, 'forbidden_origin');
    assert.equal((await call(env, '/v1/health', { origin: 'https://site.example' })).status, 200);
  });

  test('requests without an Origin header (server-to-server) get no CORS headers', async () => {
    const r = await call(makeEnv(), '/v1/health', { origin: null });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  });
});

describe('POST /v1/subscribe', () => {
  test('stores a normalized subscriber with consent metadata and hashed IP', async () => {
    const env = makeEnv();
    const ip = freshIp();
    const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: '  User@Example.COM ', interests: ['news', 'app', 'news'] }), ip });
    assert.equal(r.status, 201);
    assert.deepEqual(r.json, { ok: true });
    assertSecurityHeaders(r.headers);
    const row = env.DB.raw.prepare('SELECT * FROM subscribers').get();
    assert.equal(row.email, 'user@example.com');
    assert.equal(row.name, 'عبدالله');
    assert.equal(row.lang, 'ar');
    assert.deepEqual(JSON.parse(row.interests), ['app', 'news']);
    assert.equal(row.consent_version, '2026-11');
    assert.ok(!Number.isNaN(Date.parse(row.consent_at)));
    assert.match(row.ip_hash, /^[0-9a-f]{64}$/);
    assert.ok(!row.ip_hash.includes(ip));
  });

  test('CONSENT_VERSION defaults to 2026-11 when unset', async () => {
    const env = makeEnv({ CONSENT_VERSION: undefined });
    assert.equal((await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(), ip: freshIp() })).status, 201);
    assert.equal(env.DB.raw.prepare('SELECT consent_version FROM subscribers').get().consent_version, '2026-11');
  });

  test('phone is optional', async () => {
    const env = makeEnv();
    const body = validSubscribe();
    delete body.phone;
    assert.equal((await call(env, '/v1/subscribe', { method: 'POST', body, ip: freshIp() })).status, 201);
    assert.equal(env.DB.raw.prepare('SELECT phone FROM subscribers').get().phone, null);
  });

  test('duplicate email returns the identical 201 response and does not overwrite', async () => {
    const env = makeEnv();
    const a = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(), ip: freshIp() });
    const b = await call(env, '/v1/subscribe', {
      method: 'POST',
      body: validSubscribe({ name: 'Attacker', email: 'USER@example.com ', interests: ['presale'] }),
      ip: freshIp(),
    });
    assert.equal(a.status, 201);
    assert.equal(b.status, a.status);
    assert.equal(b.text, a.text);
    assert.equal(b.headers.get('Content-Type'), a.headers.get('Content-Type'));
    assert.equal(count(env, 'subscribers'), 1);
    assert.equal(env.DB.raw.prepare('SELECT name FROM subscribers').get().name, 'عبدالله');
  });

  const cases = [
    ['name', { name: 'ع' }],
    ['name', { name: 'x'.repeat(81) }],
    ['name', { name: 123 }],
    ['name', { name: 'line\nbreak' }],
    ['email', { email: 'not-an-email' }],
    ['email', { email: 'a@b' }],
    ['email', { email: '' }],
    ['phone', { phone: '0500000000' }],
    ['phone', { phone: '+0123456789' }],
    ['phone', { phone: '+9665' }],
    ['phone', { phone: '+96650000000000000' }],
    ['lang', { lang: 'fr' }],
    ['interests', { interests: [] }],
    ['interests', { interests: ['app', 'casino'] }],
    ['interests', { interests: 'app' }],
    ['consent', { consent: false }],
    ['consent', { consent: 'true' }],
  ];
  for (const [field, override] of cases) {
    test(`invalid ${field}: ${JSON.stringify(override)} → 400 with fields.${field}`, async () => {
      const env = makeEnv();
      const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(override), ip: freshIp() });
      assertError(r, 400, 'invalid');
      assert.ok(r.json.fields[field], `expected fields.${field} in ${r.text}`);
      assert.match(r.json.fields[field], ARABIC);
      assert.equal(count(env, 'subscribers'), 0);
    });
  }

  test('missing required fields are all reported at once', async () => {
    const r = await call(makeEnv(), '/v1/subscribe', { method: 'POST', body: { turnstileToken: VALID_TOKEN }, ip: freshIp() });
    assertError(r, 400, 'invalid');
    assert.deepEqual(Object.keys(r.json.fields).sort(), ['consent', 'email', 'interests', 'lang', 'name']);
  });

  test('validation runs before Turnstile (token is not burned on invalid input)', async () => {
    const before = turnstileCalls.length;
    await call(makeEnv(), '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: 'bad' }), ip: freshIp() });
    assert.equal(turnstileCalls.length, before);
  });

  test('unknown fields are ignored', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ id: 999, isAdmin: true, created_at: 'x' }), ip: freshIp() });
    assert.equal(r.status, 201);
    const row = env.DB.raw.prepare('SELECT id, created_at FROM subscribers').get();
    assert.equal(row.id, 1);
    assert.notEqual(row.created_at, 'x');
  });
});

describe('anti-abuse', () => {
  test('honeypot filled → 201 {ok:true}, nothing stored, Turnstile not called', async () => {
    const env = makeEnv();
    const before = turnstileCalls.length;
    for (const [path, body] of [
      ['/v1/subscribe', validSubscribe({ website: 'http://spam.example' })],
      ['/v1/plan-requests', validPlanRequest({ website: 'x' })],
      ['/v1/investors', validInvestor({ website: 'y', email: 'invalid' })],
    ]) {
      const r = await call(env, path, { method: 'POST', body, ip: freshIp() });
      assert.equal(r.status, 201);
      assert.deepEqual(r.json, { ok: true });
    }
    assert.equal(count(env, 'subscribers'), 0);
    assert.equal(count(env, 'plan_requests'), 0);
    assert.equal(count(env, 'investors'), 0);
    assert.equal(turnstileCalls.length, before);
  });

  test('11th POST in the same hour from the same IP on the same route → 429', async () => {
    const env = makeEnv();
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: `u${i}@example.com` }), ip });
      assert.equal(r.status, 201, `request ${i + 1}`);
    }
    const r11 = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: 'u10@example.com' }), ip });
    assertError(r11, 429, 'rate_limited');
    const retry = Number(r11.headers.get('Retry-After'));
    assert.ok(retry >= 1 && retry <= 3600);
    assert.equal(count(env, 'subscribers'), 10);

    // Other routes and other IPs are unaffected.
    assert.equal((await call(env, '/v1/plan-requests', { method: 'POST', body: validPlanRequest(), ip })).status, 201);
    assert.equal((await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: 'other@example.com' }), ip: freshIp() })).status, 201);

    // Stored key is the salted hash, never the raw IP.
    const keys = env.DB.raw.prepare('SELECT DISTINCT ip_hash FROM rate_limits').all();
    for (const k of keys) {
      assert.match(k.ip_hash, /^[0-9a-f]{64}$/);
    }
  });

  test('invalid requests also count toward the rate limit', async () => {
    const env = makeEnv();
    const ip = freshIp();
    for (let i = 0; i < 10; i++) {
      assert.equal((await call(env, '/v1/investors', { method: 'POST', body: { bad: true }, ip })).status, 400);
    }
    assertError(await call(env, '/v1/investors', { method: 'POST', body: validInvestor(), ip }), 429, 'rate_limited');
  });

  test('Turnstile failure → 403 captcha_failed, nothing stored', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ turnstileToken: 'forged' }), ip: freshIp() });
    assertError(r, 403, 'captcha_failed');
    assert.equal(count(env, 'subscribers'), 0);
    const last = turnstileCalls.at(-1);
    assert.equal(last.method, 'POST');
    assert.equal(last.params.get('secret'), TURNSTILE_SECRET);
    assert.equal(last.params.get('response'), 'forged');
    assert.ok(last.params.get('remoteip'));
  });

  test('missing Turnstile token → 403 captcha_failed', async () => {
    const env = makeEnv();
    const body = validInvestor();
    delete body.turnstileToken;
    assertError(await call(env, '/v1/investors', { method: 'POST', body, ip: freshIp() }), 403, 'captcha_failed');
    assert.equal(count(env, 'investors'), 0);
  });

  test('Turnstile network failure fails closed', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('network down');
    };
    try {
      const r = await call(makeEnv(), '/v1/subscribe', { method: 'POST', body: validSubscribe(), ip: freshIp() });
      assertError(r, 403, 'captcha_failed');
    } finally {
      globalThis.fetch = original;
    }
  });

  test('TURNSTILE_DISABLED="1" skips verification (local dev)', async () => {
    const env = makeEnv({ TURNSTILE_DISABLED: '1', TURNSTILE_SECRET: undefined });
    const before = turnstileCalls.length;
    const body = validSubscribe();
    delete body.turnstileToken;
    assert.equal((await call(env, '/v1/subscribe', { method: 'POST', body, ip: freshIp() })).status, 201);
    assert.equal(turnstileCalls.length, before);
  });

  test('TURNSTILE_DISABLED other than "1" does not skip verification', async () => {
    const env = makeEnv({ TURNSTILE_DISABLED: 'true' });
    assertError(await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ turnstileToken: 'nope' }), ip: freshIp() }), 403, 'captcha_failed');
  });
});

describe('request body handling', () => {
  test('body over 8 KB → 413 payload_too_large', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ pad: 'x'.repeat(9000) }), ip: freshIp() });
    assertError(r, 413, 'payload_too_large');
    assert.equal(count(env, 'subscribers'), 0);
  });

  test('declared Content-Length over 8 KB → 413', async () => {
    const r = await call(makeEnv(), '/v1/investors', {
      method: 'POST',
      body: validInvestor(),
      headers: { 'Content-Length': '100000' },
      ip: freshIp(),
    });
    assertError(r, 413, 'payload_too_large');
  });

  test('a body of exactly 8 KB is accepted', async () => {
    const base = JSON.stringify(validSubscribe({ pad: '' }));
    const body = JSON.stringify(validSubscribe({ pad: 'x'.repeat(8192 - Buffer.byteLength(base)) }));
    assert.equal(Buffer.byteLength(body), 8192);
    assert.equal((await call(makeEnv(), '/v1/subscribe', { method: 'POST', body, ip: freshIp() })).status, 201);
  });

  test('malformed JSON, non-object JSON and wrong content type → 400 invalid', async () => {
    const env = makeEnv();
    assertError(await call(env, '/v1/subscribe', { method: 'POST', body: '{"name":', ip: freshIp() }), 400, 'invalid');
    assertError(await call(env, '/v1/subscribe', { method: 'POST', body: '[1,2]', ip: freshIp() }), 400, 'invalid');
    assertError(
      await call(env, '/v1/subscribe', { method: 'POST', body: JSON.stringify(validSubscribe()), headers: { 'Content-Type': 'text/plain' }, ip: freshIp() }),
      400,
      'invalid',
    );
  });
});

describe('POST /v1/plan-requests', () => {
  test('creates a request with a REQ- reference and status new', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/plan-requests', { method: 'POST', body: validPlanRequest({ email: ' Sales@Example.SA' }), ip: freshIp() });
    assert.equal(r.status, 201);
    assert.equal(r.json.ok, true);
    assert.match(r.json.reference, /^REQ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    const row = env.DB.raw.prepare('SELECT * FROM plan_requests WHERE reference = ?').get(r.json.reference);
    assert.equal(row.status, 'new');
    assert.equal(row.email, 'sales@example.sa');
    assert.equal(row.seats, 10);
    assert.equal(row.consent_version, '2026-11');
  });

  test('seats and notes are optional', async () => {
    const body = validPlanRequest();
    delete body.seats;
    delete body.notes;
    assert.equal((await call(makeEnv(), '/v1/plan-requests', { method: 'POST', body, ip: freshIp() })).status, 201);
  });

  const cases = [
    ['planId', { planId: 'gold' }],
    ['planId', { planId: undefined }],
    ['organization', { organization: 'x' }],
    ['organization', { organization: 'x'.repeat(121) }],
    ['contactName', { contactName: '' }],
    ['email', { email: 'nope@' }],
    ['phone', { phone: undefined }],
    ['phone', { phone: '966500000000' }],
    ['paymentMethod', { paymentMethod: 'cash' }],
    ['seats', { seats: 0 }],
    ['seats', { seats: 501 }],
    ['seats', { seats: 2.5 }],
    ['seats', { seats: '5' }],
    ['notes', { notes: 'x'.repeat(1001) }],
    ['consent', { consent: undefined }],
  ];
  for (const [field, override] of cases) {
    test(`invalid ${field}: ${JSON.stringify(override).slice(0, 60)} → 400`, async () => {
      const r = await call(makeEnv(), '/v1/plan-requests', { method: 'POST', body: validPlanRequest(override), ip: freshIp() });
      assertError(r, 400, 'invalid');
      assert.ok(r.json.fields[field], `expected fields.${field} in ${r.text}`);
    });
  }
});

describe('POST /v1/investors', () => {
  test('creates an INV- reference with status new and normalized country', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/investors', { method: 'POST', body: validInvestor({ status: 'approved' }), ip: freshIp() });
    assert.equal(r.status, 201);
    assert.match(r.json.reference, /^INV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    const row = env.DB.raw.prepare('SELECT * FROM investors').get();
    assert.equal(row.status, 'new'); // client-supplied status is ignored
    assert.equal(row.country, 'AE');
    assert.equal(row.qualified_declaration, 1);
    assert.equal(row.organization, null);
  });

  test('institution requires organization', async () => {
    const env = makeEnv();
    const r = await call(env, '/v1/investors', { method: 'POST', body: validInvestor({ investorType: 'institution' }), ip: freshIp() });
    assertError(r, 400, 'invalid');
    assert.match(r.json.fields.organization, ARABIC);
    assert.deepEqual(Object.keys(r.json.fields), ['organization']);

    const ok = await call(env, '/v1/investors', {
      method: 'POST',
      body: validInvestor({ investorType: 'institution', organization: 'صندوق الأفق' }),
      ip: freshIp(),
    });
    assert.equal(ok.status, 201);
    assert.equal(env.DB.raw.prepare('SELECT organization FROM investors').get().organization, 'صندوق الأفق');
  });

  test('qualifiedDeclaration false is accepted', async () => {
    assert.equal((await call(makeEnv(), '/v1/investors', { method: 'POST', body: validInvestor({ qualifiedDeclaration: false }), ip: freshIp() })).status, 201);
  });

  const cases = [
    ['fullName', { fullName: 'a' }],
    ['fullName', { fullName: 'x'.repeat(101) }],
    ['email', { email: 'x@y.' }],
    ['phone', { phone: '+1 555 0100' }],
    ['country', { country: 'XX' }],
    ['country', { country: 'SAU' }],
    ['country', { country: undefined }],
    ['investorType', { investorType: 'fund' }],
    ['organization', { organization: 'x'.repeat(121) }],
    ['ticketRange', { ticketRange: '1m+' }],
    ['qualifiedDeclaration', { qualifiedDeclaration: 'true' }],
    ['qualifiedDeclaration', { qualifiedDeclaration: undefined }],
    ['message', { message: 'x'.repeat(1501) }],
    ['lang', { lang: 'AR' }],
    ['consent', { consent: 1 }],
  ];
  for (const [field, override] of cases) {
    test(`invalid ${field}: ${JSON.stringify(override).slice(0, 60)} → 400`, async () => {
      const r = await call(makeEnv(), '/v1/investors', { method: 'POST', body: validInvestor(override), ip: freshIp() });
      assertError(r, 400, 'invalid');
      assert.ok(r.json.fields[field], `expected fields.${field} in ${r.text}`);
    });
  }
});

describe('error handling', () => {
  test('unexpected errors → 500 server_error without leaking internals', async () => {
    const env = makeEnv({
      DB: {
        prepare() {
          throw new Error('SECRET_INTERNAL_DETAIL at /src/db.js:42');
        },
        batch() {
          throw new Error('SECRET_INTERNAL_DETAIL at /src/db.js:42');
        },
      },
    });
    const original = console.error;
    console.error = () => {};
    try {
      const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(), ip: freshIp() });
      assertError(r, 500, 'server_error');
      assert.ok(!r.text.includes('SECRET_INTERNAL_DETAIL'));
      assert.ok(!r.text.includes('db.js'));
      assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
      assertSecurityHeaders(r.headers);
    } finally {
      console.error = original;
    }
  });

  test('missing IP_SALT fails closed with 500', async () => {
    const env = makeEnv({ IP_SALT: undefined });
    const original = console.error;
    console.error = () => {};
    try {
      assertError(await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe(), ip: freshIp() }), 500, 'server_error');
      assert.equal(count(env, 'subscribers'), 0);
    } finally {
      console.error = original;
    }
  });
});
