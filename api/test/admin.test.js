import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_TOKEN, call, count, freshIp, makeEnv, validInvestor, validPlanRequest, validSubscribe } from './helpers.js';

async function createInvestor(env, over = {}) {
  const r = await call(env, '/v1/investors', { method: 'POST', body: validInvestor(over), ip: freshIp() });
  assert.equal(r.status, 201, r.text);
  return r.json.reference;
}

async function createPlanRequest(env, over = {}) {
  const r = await call(env, '/v1/plan-requests', { method: 'POST', body: validPlanRequest(over), ip: freshIp() });
  assert.equal(r.status, 201, r.text);
  return r.json.reference;
}

const admin = (env, path, opts = {}) => call(env, path, { token: ADMIN_TOKEN, ...opts });

describe('admin authentication', () => {
  const paths = [
    ['GET', '/v1/admin/subscribers'],
    ['GET', '/v1/admin/plan-requests'],
    ['GET', '/v1/admin/investors'],
    ['GET', '/v1/admin/export/investors.csv'],
    ['PATCH', '/v1/admin/investors/INV-ABCDEFGH'],
    ['PATCH', '/v1/admin/plan-requests/REQ-ABCDEFGH'],
    ['GET', '/v1/admin/does-not-exist'],
  ];

  test('missing Authorization header → 401 on every admin route', async () => {
    const env = makeEnv();
    for (const [method, path] of paths) {
      const r = await call(env, path, { method, body: method === 'PATCH' ? { status: 'contacted' } : undefined });
      assert.equal(r.status, 401, `${method} ${path}`);
      assert.equal(r.json.code, 'unauthorized');
      assert.match(r.json.message, /[؀-ۿ]/);
    }
  });

  test('wrong token of the same length → 401', async () => {
    const wrong = ADMIN_TOKEN.slice(0, -1) + (ADMIN_TOKEN.endsWith('Z') ? 'Y' : 'Z');
    const r = await call(makeEnv(), '/v1/admin/subscribers', { token: wrong });
    assert.equal(r.status, 401);
  });

  test('wrong scheme or empty bearer → 401', async () => {
    const env = makeEnv();
    assert.equal((await call(env, '/v1/admin/subscribers', { headers: { Authorization: `Basic ${ADMIN_TOKEN}` } })).status, 401);
    assert.equal((await call(env, '/v1/admin/subscribers', { headers: { Authorization: 'Bearer ' } })).status, 401);
    assert.equal((await call(env, '/v1/admin/subscribers', { headers: { Authorization: ADMIN_TOKEN } })).status, 401);
  });

  test('configured token shorter than 32 chars → every admin call 401, even with the matching token', async () => {
    const short = 'short-token-123';
    const env = makeEnv({ ADMIN_TOKEN: short });
    for (const [method, path] of paths) {
      const r = await call(env, path, { method, token: short, body: method === 'PATCH' ? { status: 'contacted' } : undefined });
      assert.equal(r.status, 401, `${method} ${path}`);
    }
    const env31 = makeEnv({ ADMIN_TOKEN: 'a'.repeat(31) });
    assert.equal((await call(env31, '/v1/admin/subscribers', { token: 'a'.repeat(31) })).status, 401);
  });

  test('missing ADMIN_TOKEN → 401', async () => {
    const env = makeEnv({ ADMIN_TOKEN: undefined });
    assert.equal((await call(env, '/v1/admin/subscribers', { token: 'undefined' })).status, 401);
    assert.equal((await call(env, '/v1/admin/subscribers', { token: '' })).status, 401);
  });

  test('valid token → 200; disallowed origin is rejected before auth', async () => {
    const env = makeEnv();
    const ok = await admin(env, '/v1/admin/subscribers');
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.json, { items: [], nextCursor: null });
    const bad = await admin(env, '/v1/admin/subscribers', { origin: 'https://evil.example' });
    assert.equal(bad.status, 403);
    assert.equal(bad.json.code, 'forbidden_origin');
    // Admin tools like curl send no Origin header.
    assert.equal((await admin(env, '/v1/admin/subscribers', { origin: null })).status, 200);
  });

  test('unknown admin route with a valid token → 404', async () => {
    assert.equal((await admin(makeEnv(), '/v1/admin/does-not-exist')).status, 404);
  });
});

describe('admin lists', () => {
  test('subscribers: cursor pagination by id descending covers every row exactly once', async () => {
    const env = makeEnv();
    for (let i = 0; i < 5; i++) {
      const r = await call(env, '/v1/subscribe', { method: 'POST', body: validSubscribe({ email: `p${i}@example.com` }), ip: freshIp() });
      assert.equal(r.status, 201);
    }
    const seen = [];
    let cursor = null;
    const pages = [];
    do {
      const q = `/v1/admin/subscribers?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
      const r = await admin(env, q);
      assert.equal(r.status, 200, r.text);
      pages.push(r.json.items.length);
      for (const item of r.json.items) seen.push(item.id);
      cursor = r.json.nextCursor;
      if (cursor !== null) assert.equal(typeof cursor, 'string');
    } while (cursor);
    assert.deepEqual(pages, [2, 2, 1]);
    assert.deepEqual(seen, [5, 4, 3, 2, 1]);

    const first = (await admin(env, '/v1/admin/subscribers?limit=1')).json.items[0];
    assert.equal(first.email, 'p4@example.com');
    assert.deepEqual(first.interests, ['app', 'news']);
    assert.equal(first.consentVersion, '2026-11');
    assert.ok(!('ip_hash' in first) && !('ipHash' in first));
  });

  test('default limit is 50 and exact-fit page has null nextCursor', async () => {
    const env = makeEnv();
    for (let i = 0; i < 3; i++) await createInvestor(env, { email: `i${i}@example.com` });
    const r = await admin(env, '/v1/admin/investors');
    assert.equal(r.json.items.length, 3);
    assert.equal(r.json.nextCursor, null);
    const r3 = await admin(env, '/v1/admin/investors?limit=3');
    assert.equal(r3.json.nextCursor, null);
    // Empty status/cursor values as in `?status=&limit=&cursor=` are treated as absent.
    const empty = await admin(env, '/v1/admin/investors?status=&limit=&cursor=');
    assert.equal(empty.status, 200);
    assert.equal(empty.json.items.length, 3);
  });

  test('invalid limit / cursor / status → 400 invalid', async () => {
    const env = makeEnv();
    for (const q of ['limit=0', 'limit=201', 'limit=abc', 'limit=-1', 'cursor=abc', 'cursor=0', 'cursor=1.5', 'status=bogus']) {
      const r = await admin(env, `/v1/admin/investors?${q}`);
      assert.equal(r.status, 400, q);
      assert.equal(r.json.code, 'invalid');
    }
    assert.equal((await admin(env, '/v1/admin/plan-requests?status=approved')).status, 400);
    assert.equal((await admin(env, '/v1/admin/plan-requests?status=invoiced')).status, 200);
  });

  test('status filter on plan-requests and investors', async () => {
    const env = makeEnv();
    const refA = await createPlanRequest(env);
    await createPlanRequest(env);
    assert.equal((await admin(env, `/v1/admin/plan-requests/${refA}`, { method: 'PATCH', body: { status: 'invoiced' } })).status, 200);
    const inv = await admin(env, '/v1/admin/plan-requests?status=invoiced');
    assert.deepEqual(inv.json.items.map((i) => i.reference), [refA]);
    assert.equal(inv.json.items[0].status, 'invoiced');
    assert.equal((await admin(env, '/v1/admin/plan-requests?status=new')).json.items.length, 1);

    const invRef = await createInvestor(env);
    await createInvestor(env, { email: 'b@example.com' });
    await admin(env, `/v1/admin/investors/${invRef}`, { method: 'PATCH', body: { status: 'kyc_requested' } });
    const k = await admin(env, '/v1/admin/investors?status=kyc_requested&limit=10');
    assert.deepEqual(k.json.items.map((i) => i.reference), [invRef]);
    assert.equal(k.json.items[0].qualifiedDeclaration, true);
  });
});

describe('admin PATCH', () => {
  test('investor status change → 200 and appends an audit_log row', async () => {
    const env = makeEnv();
    const ref = await createInvestor(env);
    const r = await admin(env, `/v1/admin/investors/${ref}`, { method: 'PATCH', body: { status: 'contacted', note: 'تم الاتصال', extra: 1 } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { ok: true });
    const row = env.DB.raw.prepare('SELECT status, admin_note, updated_at, created_at FROM investors WHERE reference = ?').get(ref);
    assert.equal(row.status, 'contacted');
    assert.equal(row.admin_note, 'تم الاتصال');
    assert.ok(row.updated_at >= row.created_at);
    const audit = env.DB.raw.prepare('SELECT * FROM audit_log').all();
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor, 'admin');
    assert.equal(audit[0].action, 'investor.status_update');
    assert.equal(audit[0].target, ref);
    assert.ok(!Number.isNaN(Date.parse(audit[0].at)));
    assert.deepEqual(JSON.parse(audit[0].detail), { from: 'new', to: 'contacted', note: 'تم الاتصال' });
  });

  test('plan-request status change → 200 and audit row', async () => {
    const env = makeEnv();
    const ref = await createPlanRequest(env);
    for (const status of ['invoiced', 'paid', 'active']) {
      assert.equal((await admin(env, `/v1/admin/plan-requests/${ref}`, { method: 'PATCH', body: { status } })).status, 200);
    }
    const audit = env.DB.raw.prepare("SELECT action, detail FROM audit_log WHERE target = ? ORDER BY id").all(ref);
    assert.deepEqual(audit.map((a) => JSON.parse(a.detail).to), ['invoiced', 'paid', 'active']);
    assert.ok(audit.every((a) => a.action === 'plan_request.status_update'));
  });

  test('invalid status → 400 with fields.status and no audit row', async () => {
    const env = makeEnv();
    const inv = await createInvestor(env);
    const req = await createPlanRequest(env);
    for (const [path, status] of [
      [`/v1/admin/investors/${inv}`, 'paid'],
      [`/v1/admin/investors/${inv}`, 'APPROVED'],
      [`/v1/admin/investors/${inv}`, undefined],
      [`/v1/admin/plan-requests/${req}`, 'approved'],
    ]) {
      const r = await admin(env, path, { method: 'PATCH', body: { status } });
      assert.equal(r.status, 400, `${path} ${status}`);
      assert.equal(r.json.code, 'invalid');
      assert.ok(r.json.fields.status);
    }
    const long = await admin(env, `/v1/admin/investors/${inv}`, { method: 'PATCH', body: { status: 'approved', note: 'x'.repeat(1001) } });
    assert.equal(long.status, 400);
    assert.ok(long.json.fields.note);
    assert.equal(count(env, 'audit_log'), 0);
    assert.equal(env.DB.raw.prepare('SELECT status FROM investors').get().status, 'new');
  });

  test('unknown, malformed or mismatched reference → 404 and no audit row', async () => {
    const env = makeEnv();
    const req = await createPlanRequest(env);
    for (const path of [
      '/v1/admin/investors/INV-ZZZZZZZZ',
      '/v1/admin/investors/not-a-ref',
      '/v1/admin/investors/INV-abcdefgh',
      `/v1/admin/investors/${req}`,
      '/v1/admin/investors/%E0%A4%A',
    ]) {
      const r = await admin(env, path, { method: 'PATCH', body: { status: 'contacted' } });
      assert.equal(r.status, 404, path);
      assert.equal(r.json.code, 'not_found');
    }
    assert.equal(count(env, 'audit_log'), 0);
  });

  test('PATCH body over 8 KB → 413', async () => {
    const env = makeEnv();
    const ref = await createInvestor(env);
    const r = await admin(env, `/v1/admin/investors/${ref}`, { method: 'PATCH', body: { status: 'contacted', pad: 'x'.repeat(9000) } });
    assert.equal(r.status, 413);
    assert.equal(r.json.code, 'payload_too_large');
  });
});

describe('investors CSV export', () => {
  test('UTF-8 BOM, headers, quoting and formula-injection protection', async () => {
    const env = makeEnv();
    await createInvestor(env, {
      fullName: '=HYPERLINK("http://evil.example","اضغط")',
      email: 'csv1@example.com',
      message: '@SUM(1+1)\nسطر ثانٍ "مقتبس"',
      investorType: 'institution',
      organization: '+cmd|calc',
    });
    await createInvestor(env, { fullName: '-2+3', email: 'csv2@example.com', message: 'عادي' });

    const r = await admin(env, '/v1/admin/export/investors.csv');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('Content-Type'), /^text\/csv; charset=utf-8$/);
    assert.match(r.headers.get('Content-Disposition'), /^attachment; filename="shaheen-investors-\d{4}-\d{2}-\d{2}\.csv"$/);
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');

    assert.deepEqual([...r.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'must start with UTF-8 BOM bytes');
    assert.equal(r.text.charCodeAt(0), 0xfeff);

    const body = r.text.slice(1);
    const lines = body.split('\r\n');
    assert.ok(lines[0].startsWith('"reference","created_at","status","full_name","email","phone"'));
    // Newest first.
    assert.ok(body.indexOf('csv2@example.com') < body.indexOf('csv1@example.com'));

    assert.ok(body.includes(`"'=HYPERLINK(""http://evil.example"",""اضغط"")"`), body);
    assert.ok(body.includes(`"'@SUM(1+1)\nسطر ثانٍ ""مقتبس"""`));
    assert.ok(body.includes(`"'+cmd|calc"`));
    assert.ok(body.includes(`"'-2+3"`));
    assert.ok(body.includes(`"'+971500000003"`), 'phones starting with + are neutralised too');
    assert.ok(body.includes('"عادي"'));
    assert.ok(body.includes('"true"'));

    // No cell may start with a raw formula trigger.
    const cells = body.match(/"(?:[^"]|"")*"/g);
    for (const c of cells) assert.ok(!/^"[=+\-@]/.test(c), `unsafe cell ${c}`);

    const audit = env.DB.raw.prepare("SELECT * FROM audit_log WHERE action = 'investors.export'").all();
    assert.equal(audit.length, 1);
    assert.equal(JSON.parse(audit[0].detail).rows, 2);
  });

  test('export supports ?status= filter and rejects invalid status', async () => {
    const env = makeEnv();
    const ref = await createInvestor(env);
    await createInvestor(env, { email: 'other@example.com' });
    await admin(env, `/v1/admin/investors/${ref}`, { method: 'PATCH', body: { status: 'approved' } });
    const r = await admin(env, '/v1/admin/export/investors.csv?status=approved');
    assert.equal(r.text.trimEnd().split('\r\n').length, 2);
    assert.ok(r.text.includes(ref));
    assert.equal((await admin(env, '/v1/admin/export/investors.csv?status=nope')).status, 400);
  });

  test('export with no rows still has BOM and header', async () => {
    const r = await admin(makeEnv(), '/v1/admin/export/investors.csv');
    assert.equal(r.status, 200);
    assert.deepEqual([...r.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(r.text.charCodeAt(0), 0xfeff);
    assert.equal(r.text.slice(1).trimEnd().split('\r\n').length, 1);
  });
});
