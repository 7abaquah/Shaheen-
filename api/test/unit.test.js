import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, toCsv, UTF8_BOM } from '../src/csv.js';
import { generateReference } from '../src/db.js';
import { COUNTRY_CODES, EMAIL_RE, PHONE_RE } from '../src/validate.js';
import { parseAllowedOrigins, timingSafeEqualStrings, hashIp } from '../src/security.js';
import { D1DatabaseShim, applyMigrations } from '../scripts/d1-sqlite-shim.mjs';
import { MIGRATIONS_DIR } from './helpers.js';

test('csvCell quotes, escapes and neutralises formula prefixes', () => {
  assert.equal(csvCell('plain'), '"plain"');
  assert.equal(csvCell('a "b" c'), '"a ""b"" c"');
  assert.equal(csvCell('=1+1'), `"'=1+1"`);
  assert.equal(csvCell('+1'), `"'+1"`);
  assert.equal(csvCell('-1'), `"'-1"`);
  assert.equal(csvCell('@x'), `"'@x"`);
  assert.equal(csvCell('\t=x'), `"'\t=x"`);
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(undefined), '""');
  assert.equal(csvCell(false), '"false"');
  assert.equal(csvCell(42), '"42"');
  assert.equal(csvCell('a,b\nc'), '"a,b\nc"');
});

test('toCsv prepends BOM and uses CRLF', () => {
  const out = toCsv([{ key: 'a', header: 'A' }], [{ a: 'x' }]);
  assert.ok(out.startsWith(UTF8_BOM));
  assert.equal(out, `${UTF8_BOM}"A"\r\n"x"\r\n`);
});

test('generateReference uses the unambiguous alphabet and is random', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const ref = generateReference('INV');
    assert.match(ref, /^INV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    assert.ok(!/[01OI]/.test(ref.slice(4)));
    seen.add(ref);
  }
  assert.equal(seen.size, 2000);
  assert.match(generateReference('REQ'), /^REQ-/);
});

test('ISO 3166-1 alpha-2 list has 249 codes', () => {
  assert.equal(COUNTRY_CODES.size, 249);
  for (const c of ['SA', 'AE', 'BH', 'EG', 'US', 'GB', 'PS']) assert.ok(COUNTRY_CODES.has(c), c);
});

test('phone and email patterns', () => {
  for (const p of ['+966500000000', '+12025550123', '+4420712345']) assert.ok(PHONE_RE.test(p), p);
  for (const p of ['966500000000', '+0966500000', '+1234567', '+1234567890123456', '+966 50']) assert.ok(!PHONE_RE.test(p), p);
  for (const e of ['a@b.co', 'first.last+tag@sub.example.sa', 'x_y@domain-name.com']) assert.ok(EMAIL_RE.test(e), e);
  for (const e of ['a@b', 'a@@b.com', 'a b@c.com', '@b.com', 'a@b.c', 'a@-b.com', 'a@b..com']) assert.ok(!EMAIL_RE.test(e), e);
});

test('parseAllowedOrigins trims, strips trailing slashes, drops * and null', () => {
  assert.deepEqual(
    [...parseAllowedOrigins(' https://a.example/ ,capacitor://localhost,,*,null,https://localhost')],
    ['https://a.example', 'capacitor://localhost', 'https://localhost'],
  );
  assert.equal(parseAllowedOrigins(undefined).size, 0);
});

test('timingSafeEqualStrings', async () => {
  assert.equal(await timingSafeEqualStrings('abc', 'abc'), true);
  assert.equal(await timingSafeEqualStrings('abc', 'abd'), false);
  assert.equal(await timingSafeEqualStrings('abc', 'abcd'), false);
  assert.equal(await timingSafeEqualStrings('', ''), true);
});

test('hashIp is salted and deterministic', async () => {
  const a = await hashIp('1.2.3.4', { IP_SALT: 'salt-one-0123456789' });
  const b = await hashIp('1.2.3.4', { IP_SALT: 'salt-one-0123456789' });
  const c = await hashIp('1.2.3.4', { IP_SALT: 'salt-two-0123456789' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
  await assert.rejects(() => hashIp('1.2.3.4', {}));
});

test('D1 shim: bind/run/first/all/batch semantics and atomic batch rollback', async () => {
  const db = new D1DatabaseShim(':memory:');
  assert.deepEqual(applyMigrations(db, MIGRATIONS_DIR), ['0001_init.sql']);
  assert.deepEqual(applyMigrations(db, MIGRATIONS_DIR), [], 'migrations are tracked and not re-applied');

  const ins = db.prepare('INSERT INTO audit_log (actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?)');
  const r = await ins.bind('admin', 'a', 't', null, 'now').run();
  assert.equal(r.success, true);
  assert.equal(r.meta.changes, 1);
  assert.equal(r.meta.last_row_id, 1);
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n'), 1);
  assert.equal(await db.prepare('SELECT * FROM audit_log WHERE id = ?').bind(99).first(), null);
  assert.equal((await db.prepare('SELECT * FROM audit_log').all()).results.length, 1);
  assert.throws(() => ins.bind(undefined, 'a', 't', null, 'now'), /D1_TYPE_ERROR/);

  await assert.rejects(() =>
    db.batch([
      ins.bind('admin', 'b', 't', null, 'now'),
      db.prepare('INSERT INTO nope VALUES (1)'),
    ]),
  );
  assert.equal(await db.prepare('SELECT COUNT(*) AS n FROM audit_log').first('n'), 1, 'batch must roll back');

  // Unique email constraint exists on subscribers.
  const sub = db.prepare(
    `INSERT INTO subscribers (name, email, phone, lang, interests, consent_version, consent_at, ip_hash, created_at)
     VALUES ('n', 'dup@example.com', NULL, 'ar', '[]', 'v', 't', 'h', 't')`,
  );
  await sub.run();
  await assert.rejects(() => sub.run(), /UNIQUE constraint failed/);
  db.close();
});

import { rateKeyIp } from '../src/security.js';

test('rateKeyIp groups IPv6 by /64 and keeps IPv4', () => {
  assert.equal(rateKeyIp('203.0.113.7'), '203.0.113.7');
  assert.equal(rateKeyIp('2001:db8:abcd:12:1:2:3:4'), '2001:db8:abcd:12::/64');
  assert.equal(rateKeyIp('2001:db8:abcd:12::99'), '2001:db8:abcd:12::/64');
  assert.equal(rateKeyIp('2001:0DB8:ABCD:0012:ffff::1'), '2001:db8:abcd:12::/64');
  assert.equal(rateKeyIp('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(rateKeyIp('::ffff:198.51.100.4'), '198.51.100.4');
  assert.equal(rateKeyIp(''), 'unknown');
});
