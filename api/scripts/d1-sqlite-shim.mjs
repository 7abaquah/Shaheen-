// Minimal Cloudflare D1-compatible binding over node:sqlite (DatabaseSync).
// Used by the tests and the local dev server. Not used in production.
//
// Supported: db.prepare(sql).bind(...).run() / .first(col?) / .all() / .raw(),
//            db.batch([...]) (atomic), db.exec(sql).

import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function toSqliteValue(v, index) {
  if (v === undefined) {
    throw new TypeError(`D1_TYPE_ERROR: Type 'undefined' not supported for value at index ${index}`);
  }
  if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return v;
  throw new TypeError(`D1_TYPE_ERROR: Type '${typeof v}' not supported for value at index ${index}`);
}

class D1PreparedStatementShim {
  #db;
  #sql;
  #params;

  constructor(db, sql, params = []) {
    this.#db = db;
    this.#sql = sql;
    this.#params = params;
  }

  bind(...values) {
    return new D1PreparedStatementShim(this.#db, this.#sql, values.map(toSqliteValue));
  }

  _execute() {
    const started = performance.now();
    let rows;
    try {
      rows = this.#db.raw.prepare(this.#sql).all(...this.#params);
    } catch (err) {
      const e = new Error(`D1_ERROR: ${err.message}`);
      e.cause = err;
      throw e;
    }
    const info = this.#db.raw.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get();
    return {
      success: true,
      results: rows.map((r) => ({ ...r })),
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.last_row_id),
        duration: performance.now() - started,
        rows_read: rows.length,
        rows_written: Number(info.changes),
      },
    };
  }

  async run() {
    return this._execute();
  }

  async all() {
    return this._execute();
  }

  async first(column) {
    const { results } = this._execute();
    if (results.length === 0) return null;
    const row = results[0];
    if (column === undefined) return row;
    if (!Object.hasOwn(row, column)) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`);
    return row[column];
  }

  async raw({ columnNames = false } = {}) {
    const { results } = this._execute();
    const rows = results.map((r) => Object.values(r));
    if (columnNames) rows.unshift(results.length ? Object.keys(results[0]) : []);
    return rows;
  }
}

export class D1DatabaseShim {
  constructor(filename = ':memory:') {
    this.raw = new DatabaseSync(filename);
    this.raw.exec('PRAGMA foreign_keys = ON;');
  }

  prepare(sql) {
    return new D1PreparedStatementShim(this, sql);
  }

  /** Executes all statements in one transaction; rolls back everything on failure. */
  async batch(statements) {
    this.raw.exec('BEGIN');
    try {
      const out = statements.map((s) => s._execute());
      this.raw.exec('COMMIT');
      return out;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }

  async exec(sql) {
    const started = performance.now();
    this.raw.exec(sql);
    return { count: sql.split(';').filter((s) => s.trim()).length, duration: performance.now() - started };
  }

  close() {
    this.raw.close();
  }
}

/**
 * Applies migrations/*.sql in filename order, tracking applied files in the
 * same `d1_migrations` table wrangler uses. Returns the names applied now.
 */
export function applyMigrations(db, migrationsDir) {
  db.raw.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const done = new Set(db.raw.prepare('SELECT name FROM d1_migrations').all().map((r) => r.name));
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.raw.exec('BEGIN');
    try {
      db.raw.exec(sql);
      db.raw.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(file);
      db.raw.exec('COMMIT');
    } catch (err) {
      db.raw.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
    applied.push(file);
  }
  return applied;
}
