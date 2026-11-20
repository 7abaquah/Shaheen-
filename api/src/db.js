// Data access layer over the D1 binding `env.DB`.

const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars: no 0/O/1/I
export const RATE_LIMIT_PER_HOUR = 10;
const HOUR_MS = 3600 * 1000;

/** REQ-/INV- + 8 characters from crypto.getRandomValues (unbiased: 256 % 32 === 0). */
export function generateReference(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `${prefix}-${out}`;
}

function isUniqueViolation(err, column) {
  const msg = String(err && err.message ? err.message : err);
  return /UNIQUE constraint failed/i.test(msg) && (!column || msg.includes(column));
}

/**
 * Fixed-window counter keyed by route + ipHash + hour bucket.
 * Returns { limited, count, retryAfter } where retryAfter is in seconds.
 */
export async function hitRateLimit(db, route, ipHash, now = Date.now()) {
  const bucket = Math.floor(now / HOUR_MS);
  const [, row] = await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(bucket - 1),
    db
      .prepare(
        `INSERT INTO rate_limits (route, ip_hash, bucket, count) VALUES (?, ?, ?, 1)
         ON CONFLICT (route, ip_hash, bucket) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .bind(route, ipHash, bucket),
  ]);
  const count = Number(row.results?.[0]?.count ?? 1);
  const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * HOUR_MS - now) / 1000));
  return { limited: count > RATE_LIMIT_PER_HOUR, count, retryAfter };
}

/** Inserts a subscriber; silently does nothing if the email already exists. */
export async function insertSubscriber(db, s, meta) {
  await db
    .prepare(
      `INSERT INTO subscribers (name, email, phone, lang, interests, consent_version, consent_at, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (email) DO NOTHING`,
    )
    .bind(s.name, s.email, s.phone, s.lang, JSON.stringify(s.interests), meta.consentVersion, meta.now, meta.ipHash, meta.now)
    .run();
}

async function insertWithReference(prefix, insertFn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = generateReference(prefix);
    try {
      await insertFn(reference);
      return reference;
    } catch (err) {
      if (isUniqueViolation(err, 'reference')) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique reference');
}

export function insertPlanRequest(db, r, meta) {
  return insertWithReference('REQ', (reference) =>
    db
      .prepare(
        `INSERT INTO plan_requests (reference, plan_id, organization, contact_name, email, phone, payment_method, seats, notes,
           status, consent_version, consent_at, ip_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
      )
      .bind(
        reference, r.planId, r.organization, r.contactName, r.email, r.phone, r.paymentMethod, r.seats, r.notes,
        meta.consentVersion, meta.now, meta.ipHash, meta.now, meta.now,
      )
      .run(),
  );
}

export function insertInvestor(db, v, meta) {
  return insertWithReference('INV', (reference) =>
    db
      .prepare(
        `INSERT INTO investors (reference, full_name, email, phone, country, investor_type, organization, ticket_range,
           qualified_declaration, message, lang, status, consent_version, consent_at, ip_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)`,
      )
      .bind(
        reference, v.fullName, v.email, v.phone, v.country, v.investorType, v.organization, v.ticketRange,
        v.qualifiedDeclaration ? 1 : 0, v.message, v.lang, meta.consentVersion, meta.now, meta.ipHash, meta.now, meta.now,
      )
      .run(),
  );
}

// ---- Admin -----------------------------------------------------------------

const MAPPERS = {
  subscribers: (r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    lang: r.lang,
    interests: safeJsonArray(r.interests),
    consentVersion: r.consent_version,
    consentAt: r.consent_at,
    createdAt: r.created_at,
  }),
  plan_requests: (r) => ({
    id: r.id,
    reference: r.reference,
    planId: r.plan_id,
    organization: r.organization,
    contactName: r.contact_name,
    email: r.email,
    phone: r.phone,
    paymentMethod: r.payment_method,
    seats: r.seats,
    notes: r.notes,
    status: r.status,
    adminNote: r.admin_note,
    consentVersion: r.consent_version,
    consentAt: r.consent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
  investors: (r) => ({
    id: r.id,
    reference: r.reference,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    country: r.country,
    investorType: r.investor_type,
    organization: r.organization,
    ticketRange: r.ticket_range,
    qualifiedDeclaration: r.qualified_declaration === 1,
    message: r.message,
    lang: r.lang,
    status: r.status,
    adminNote: r.admin_note,
    consentVersion: r.consent_version,
    consentAt: r.consent_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
};

const COLUMNS = {
  subscribers: 'id, name, email, phone, lang, interests, consent_version, consent_at, created_at',
  plan_requests:
    'id, reference, plan_id, organization, contact_name, email, phone, payment_method, seats, notes, status, admin_note, consent_version, consent_at, created_at, updated_at',
  investors:
    'id, reference, full_name, email, phone, country, investor_type, organization, ticket_range, qualified_declaration, message, lang, status, admin_note, consent_version, consent_at, created_at, updated_at',
};

function safeJsonArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Cursor pagination by id descending. `table` is one of the fixed keys above. */
export async function listRecords(db, table, { limit, cursor, status }) {
  if (!Object.hasOwn(COLUMNS, table)) throw new Error(`Unknown table ${table}`);
  const where = [];
  const params = [];
  if (cursor !== null) {
    where.push('id < ?');
    params.push(cursor);
  }
  if (status !== null && table !== 'subscribers') {
    where.push('status = ?');
    params.push(status);
  }
  const sql = `SELECT ${COLUMNS[table]} FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
  params.push(limit + 1);
  const { results } = await db.prepare(sql).bind(...params).all();
  const rows = results || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: page.map(MAPPERS[table]),
    nextCursor: hasMore ? String(page[page.length - 1].id) : null,
  };
}

export async function listAllInvestors(db, status) {
  const sql = `SELECT ${COLUMNS.investors} FROM investors${status ? ' WHERE status = ?' : ''} ORDER BY id DESC`;
  const stmt = status ? db.prepare(sql).bind(status) : db.prepare(sql);
  const { results } = await stmt.all();
  return (results || []).map(MAPPERS.investors);
}

/**
 * Updates the status of a plan request / investor and appends to audit_log in
 * one atomic batch. Returns false when the reference does not exist.
 */
export async function updateStatusWithAudit(db, table, reference, status, note, action, now) {
  if (table !== 'plan_requests' && table !== 'investors') throw new Error(`Unknown table ${table}`);
  const current = await db.prepare(`SELECT status FROM ${table} WHERE reference = ?`).bind(reference).first();
  if (!current) return false;
  const detail = JSON.stringify({ from: current.status, to: status, note: note ?? null });
  await db.batch([
    db
      .prepare(`UPDATE ${table} SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = ? WHERE reference = ?`)
      .bind(status, note, now, reference),
    db
      .prepare('INSERT INTO audit_log (actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?)')
      .bind('admin', action, reference, detail, now),
  ]);
  return true;
}

export async function appendAudit(db, action, target, detail, now) {
  await db
    .prepare('INSERT INTO audit_log (actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?)')
    .bind('admin', action, target, detail === null ? null : JSON.stringify(detail), now)
    .run();
}
