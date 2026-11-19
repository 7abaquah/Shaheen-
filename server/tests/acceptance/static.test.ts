// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { start, type Running } from './helpers.ts';

let root = '';
let dist = '';
const SECRET = 'TOP-SECRET-OUTSIDE-STATIC-DIR';

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'shaheen-static-'));
  dist = path.join(root, 'dist');
  await mkdir(path.join(dist, 'assets'), { recursive: true });
  await writeFile(path.join(root, 'secret.txt'), SECRET);
  await writeFile(path.join(dist, 'index.html'), '<!doctype html><html lang="ar" dir="rtl"><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>');
  await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log("app")');
  await writeFile(path.join(dist, 'assets', 'app.css'), 'body{margin:0}');
  await writeFile(path.join(dist, 'assets', 'font.woff2'), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
  await writeFile(path.join(dist, '.env'), 'ANTHROPIC_API_KEY=sk-ant-should-never-be-served');
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

let running: Running | null = null;
afterEach(async () => {
  await running?.close();
  running = null;
});
async function up(): Promise<Running> {
  running = await start({ staticDir: dist });
  return running;
}

function directives(csp: string): Map<string, string[]> {
  return new Map(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...values] = d.split(/\s+/);
    return [name as string, values];
  }));
}

describe('static files', () => {
  it('serves the app with a strict Content-Security-Policy', async () => {
    const r = await up();
    const res = await fetch(`${r.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<div id="root">');

    const csp = res.headers.get('content-security-policy') ?? '';
    const d = directives(csp);
    expect(d.get('default-src')).toEqual(["'none'"]);
    expect(d.get('script-src')).toEqual(["'self'"]);
    expect(d.get('style-src')).toEqual(["'self'"]);
    expect(d.get('connect-src')).toEqual(["'self'"]);
    expect(d.get('font-src')).toEqual(["'self'"]);
    expect(d.get('img-src')).toEqual(["'self'", 'data:']);
    expect(d.get('base-uri')).toEqual(["'none'"]);
    expect(d.get('form-action')).toEqual(["'none'"]);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('object-src')).toEqual(["'none'"]);
    for (const forbidden of ['unsafe-inline', 'unsafe-eval', '*', 'https:', 'http:', 'blob:']) {
      expect(csp, `CSP must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('sends the hardening headers on every response', async () => {
    const r = await up();
    for (const p of ['/', '/assets/app.js', '/api/health', '/assets/missing.js']) {
      const res = await fetch(`${r.url}${p}`);
      const h = res.headers;
      expect(h.get('x-content-type-options'), p).toBe('nosniff');
      expect(h.get('x-frame-options'), p).toBe('DENY');
      expect(h.get('referrer-policy'), p).toBe('no-referrer');
      expect(h.get('cross-origin-opener-policy'), p).toBe('same-origin');
      expect(h.get('cross-origin-resource-policy'), p).toBe('same-origin');
      expect(h.get('permissions-policy'), p).toContain('camera=()');
      expect(h.get('permissions-policy'), p).toContain('geolocation=()');
      const hsts = h.get('strict-transport-security') ?? '';
      expect(Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0), p).toBeGreaterThanOrEqual(15552000);
      expect(h.get('content-security-policy'), p).toBeTruthy();
      expect(h.get('x-powered-by'), p).toBeNull();
      expect(h.get('server'), p).toBeNull();
    }
  });

  it('serves assets with correct types and falls back to index.html for app routes', async () => {
    const r = await up();
    const js = await fetch(`${r.url}/assets/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toMatch(/^(text|application)\/javascript/);
    expect((await fetch(`${r.url}/assets/app.css`)).headers.get('content-type')).toContain('text/css');
    expect((await fetch(`${r.url}/assets/font.woff2`)).headers.get('content-type')).toBe('font/woff2');

    const route = await fetch(`${r.url}/wallet`);
    expect(route.status).toBe(200);
    expect(await route.text()).toContain('<div id="root">');

    const missing = await fetch(`${r.url}/assets/missing.js`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain('<div id="root">');

    const head = await fetch(`${r.url}/`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await fetch(`${r.url}/`, { method: 'POST', body: 'x' })).status).toBe(405);
    expect((await fetch(`${r.url}/`, { method: 'DELETE' })).status).toBe(405);
  });

  it('never serves files outside the static directory, nor dotfiles', async () => {
    const r = await up();
    const attempts = [
      '/../secret.txt', '/..%2fsecret.txt', '/%2e%2e/secret.txt', '/%2e%2e%2fsecret.txt', '/assets/../../secret.txt',
      '/assets/..%2f..%2fsecret.txt', '/..%5csecret.txt', '/assets/..\\..\\secret.txt', '//secret.txt', '/%00/../secret.txt',
      '/assets/%2e%2e/%2e%2e/secret.txt', `/${encodeURIComponent(path.join(root, 'secret.txt'))}`, '/.env', '/%2eenv', '/assets/../.env',
    ];
    for (const attempt of attempts) {
      const res = await r.raw('GET', attempt);
      expect(res.body, attempt).not.toContain(SECRET);
      expect(res.body, attempt).not.toContain('sk-ant-should-never-be-served');
      expect([200, 400, 403, 404], `${attempt} → ${res.status}`).toContain(res.status);
      if (res.status === 200) expect(res.body, attempt).toContain('<div id="root">'); // SPA fallback only
    }
    expect((await r.raw('GET', '/.env')).status).toBe(404);
  });

  it('answers 404 JSON when no front-end is configured', async () => {
    running = await start({ staticDir: null });
    const res = await fetch(`${running.url}/`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    expect((await fetch(`${running.url}/api/nope`)).status).toBe(404);
  });
});
