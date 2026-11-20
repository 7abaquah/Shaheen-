#!/usr/bin/env node
// Local development server: serves the Worker's fetch handler on
// http://127.0.0.1:8787 using the node:sqlite D1 shim with a file database at
// .dev/dev.sqlite. Turnstile verification is disabled (TURNSTILE_DISABLED="1").
// No dependencies. Never use this in production.
//
//   ADMIN_TOKEN=$(openssl rand -hex 32) npm run dev
//
// Env: PORT (8787), HOST (127.0.0.1), ALLOWED_ORIGINS, ADMIN_TOKEN, IP_SALT, CONSENT_VERSION

import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index.js';
import { D1DatabaseShim, applyMigrations } from './d1-sqlite-shim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const devDir = join(root, '.dev');
mkdirSync(devDir, { recursive: true });

const db = new D1DatabaseShim(join(devDir, 'dev.sqlite'));
const applied = applyMigrations(db, join(root, 'migrations'));

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost',
  'https://localhost', // Android Capacitor
  'capacitor://localhost', // iOS Capacitor
].join(',');

const env = {
  DB: db,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS,
  CONSENT_VERSION: process.env.CONSENT_VERSION || '2026-11',
  TURNSTILE_DISABLED: '1',
  TURNSTILE_SECRET: '',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || '',
  IP_SALT: process.env.IP_SALT || 'local-dev-salt-not-for-production',
};

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_DEV_BODY = 1024 * 1024; // the Worker itself enforces the 8 KB contract limit
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'proxy-connection', 'te', 'trailer']);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_DEV_BODY) {
        reject(Object.assign(new Error('too large'), { tooLarge: true }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (HOP_BY_HOP.has(k) || v === undefined) continue;
      headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    }
    // Like Cloudflare: the client IP comes from the connection, not the client.
    headers.set('CF-Connecting-IP', req.socket.remoteAddress || '127.0.0.1');

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? await readBody(req) : undefined;
    const request = new Request(`http://${HOST}:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody && body.length ? body : undefined,
    });

    const response = await worker.fetch(request, env, { waitUntil() {}, passThroughOnException() {} });
    const out = Buffer.from(await response.arrayBuffer());
    const outHeaders = {};
    response.headers.forEach((v, k) => {
      outHeaders[k] = v;
    });
    res.writeHead(response.status, outHeaders);
    res.end(req.method === 'HEAD' ? undefined : out);
    console.log(`${req.method} ${req.url} → ${response.status} (${Date.now() - started} ms)`);
  } catch (err) {
    const status = err && err.tooLarge ? 413 : 500;
    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ code: status === 413 ? 'payload_too_large' : 'server_error', message: 'خطأ في خادم التطوير المحلي.' }));
    }
    console.error(`${req.method} ${req.url} → ${status}:`, err && err.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Shaheen API (dev) → http://${HOST}:${PORT}/v1/health`);
  console.log(`  database:        ${join('.dev', 'dev.sqlite')}${applied.length ? ` (applied: ${applied.join(', ')})` : ''}`);
  console.log('  turnstile:       disabled (TURNSTILE_DISABLED="1")');
  console.log(`  allowed origins: ${env.ALLOWED_ORIGINS}`);
  console.log(
    env.ADMIN_TOKEN.length >= 32
      ? '  admin:           enabled (Authorization: Bearer $ADMIN_TOKEN)'
      : '  admin:           disabled — set ADMIN_TOKEN (≥ 32 chars) to use /v1/admin/*',
  );
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
