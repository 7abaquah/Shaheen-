-- Shaheen API v1 — initial schema (Cloudflare D1 / SQLite)
-- Timestamps are ISO-8601 UTC strings. IPs are stored only as salted SHA-256.

CREATE TABLE IF NOT EXISTS subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL,
  phone           TEXT,
  lang            TEXT    NOT NULL CHECK (lang IN ('ar', 'en')),
  interests       TEXT    NOT NULL,              -- JSON array
  consent_version TEXT    NOT NULL,
  consent_at      TEXT    NOT NULL,
  ip_hash         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscribers_email ON subscribers (email);
CREATE INDEX IF NOT EXISTS ix_subscribers_created_at ON subscribers (created_at);

CREATE TABLE IF NOT EXISTS plan_requests (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  reference       TEXT    NOT NULL UNIQUE,
  plan_id         TEXT    NOT NULL,
  organization    TEXT    NOT NULL,
  contact_name    TEXT    NOT NULL,
  email           TEXT    NOT NULL,
  phone           TEXT    NOT NULL,
  payment_method  TEXT    NOT NULL CHECK (payment_method IN ('bank', 'card', 'usdt')),
  seats           INTEGER CHECK (seats IS NULL OR (seats BETWEEN 1 AND 500)),
  notes           TEXT,
  status          TEXT    NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'invoiced', 'paid', 'active', 'cancelled')),
  admin_note      TEXT,
  consent_version TEXT    NOT NULL,
  consent_at      TEXT    NOT NULL,
  ip_hash         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_plan_requests_status_id ON plan_requests (status, id);
CREATE INDEX IF NOT EXISTS ix_plan_requests_created_at ON plan_requests (created_at);

CREATE TABLE IF NOT EXISTS investors (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  reference             TEXT    NOT NULL UNIQUE,
  full_name             TEXT    NOT NULL,
  email                 TEXT    NOT NULL,
  phone                 TEXT    NOT NULL,
  country               TEXT    NOT NULL CHECK (length(country) = 2),
  investor_type         TEXT    NOT NULL CHECK (investor_type IN ('individual', 'institution')),
  organization          TEXT,
  ticket_range          TEXT    NOT NULL CHECK (ticket_range IN ('under-10k', '10k-50k', '50k-250k', 'over-250k')),
  qualified_declaration INTEGER NOT NULL CHECK (qualified_declaration IN (0, 1)),
  message               TEXT,
  lang                  TEXT    NOT NULL CHECK (lang IN ('ar', 'en')),
  status                TEXT    NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'contacted', 'kyc_requested', 'approved', 'rejected')),
  admin_note            TEXT,
  consent_version       TEXT    NOT NULL,
  consent_at            TEXT    NOT NULL,
  ip_hash               TEXT    NOT NULL,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,
  CHECK (investor_type = 'individual' OR organization IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ix_investors_status_id ON investors (status, id);
CREATE INDEX IF NOT EXISTS ix_investors_created_at ON investors (created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  route   TEXT    NOT NULL,
  ip_hash TEXT    NOT NULL,
  bucket  INTEGER NOT NULL,                       -- floor(epoch_ms / 3600000)
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (route, ip_hash, bucket)
);
CREATE INDEX IF NOT EXISTS ix_rate_limits_bucket ON rate_limits (bucket);

CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,                                    -- JSON
  at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_log_at ON audit_log (at);
CREATE INDEX IF NOT EXISTS ix_audit_log_target ON audit_log (target);
