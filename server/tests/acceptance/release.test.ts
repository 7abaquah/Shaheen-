// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pq } from '../../../kernel/src/index.ts';
import { MANIFEST_NAME, canonicalManifestBytes, type ReleaseManifest } from '../../../shared/release.ts';
import { api, start } from './helpers.ts';

let dist = '';
let keys: Awaited<ReturnType<typeof pq.generateSigningKeys>>;
const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');
const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

async function sign(dev: boolean): Promise<ReleaseManifest> {
  const files: Record<string, string> = {};
  for (const rel of ['index.html', 'assets/app.js', 'assets/app.css']) files[rel] = sha(await readFile(path.join(dist, rel)));
  const unsigned = { v: 1 as const, createdAt: '2026-11-16T00:00:00.000Z', files, signer: { alg: 'ML-DSA-65' as const, publicKey: b64(keys.publicKey), dev } };
  const manifest: ReleaseManifest = { ...unsigned, signature: b64(await pq.sign(keys.secretKey, canonicalManifestBytes(unsigned))) };
  await writeFile(path.join(dist, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return manifest;
}

beforeEach(async () => {
  dist = await mkdtemp(path.join(tmpdir(), 'shaheen-release-'));
  await mkdir(path.join(dist, 'assets'));
  await writeFile(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
  await writeFile(path.join(dist, 'assets', 'app.css'), 'body{}');
  keys = await pq.generateSigningKeys();
});
afterEach(async () => {
  await rm(dist, { recursive: true, force: true });
});

describe('verifyRelease', () => {
  it('accepts an intact, signed build', async () => {
    await sign(false);
    expect(await api.verifyRelease(dist)).toEqual({ ok: true, signed: true, dev: false, files: 3, reason: null });
    expect(await api.verifyRelease(dist, b64(keys.publicKey))).toMatchObject({ ok: true, signed: true });
    await sign(true);
    expect(await api.verifyRelease(dist)).toMatchObject({ ok: true, signed: true, dev: true });
  });

  it('rejects a build signed by a key other than the pinned one', async () => {
    await sign(false);
    const stranger = await pq.generateSigningKeys();
    const status = await api.verifyRelease(dist, b64(stranger.publicKey));
    expect(status.ok).toBe(false);
    expect(status.reason).toBeTruthy();
  });

  it('rejects modified, added and removed files', async () => {
    await sign(false);
    await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1);fetch("https://evil.example")');
    expect((await api.verifyRelease(dist)).ok).toBe(false);

    await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
    expect((await api.verifyRelease(dist)).ok).toBe(true);

    await writeFile(path.join(dist, 'assets', 'injected.js'), 'alert(1)');
    expect((await api.verifyRelease(dist)).ok).toBe(false);
    await unlink(path.join(dist, 'assets', 'injected.js'));

    await unlink(path.join(dist, 'assets', 'app.css'));
    expect((await api.verifyRelease(dist)).ok).toBe(false);
  });

  it('rejects a manifest that was edited after signing', async () => {
    const manifest = await sign(false);
    const tampered: ReleaseManifest = { ...manifest, files: { ...manifest.files, 'assets/app.js': sha('console.log(2)') } };
    await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(2)');
    await writeFile(path.join(dist, MANIFEST_NAME), JSON.stringify(tampered));
    expect((await api.verifyRelease(dist)).ok).toBe(false);

    await writeFile(path.join(dist, 'assets', 'app.js'), 'console.log(1)');
    await writeFile(path.join(dist, MANIFEST_NAME), JSON.stringify({ ...manifest, signer: { ...manifest.signer, dev: true } }));
    expect((await api.verifyRelease(dist)).ok).toBe(false);

    await writeFile(path.join(dist, MANIFEST_NAME), JSON.stringify({ ...manifest, signature: b64(new Uint8Array(3309)) }));
    expect((await api.verifyRelease(dist)).ok).toBe(false);
  });

  it('reports a missing or unreadable manifest without throwing', async () => {
    expect(await api.verifyRelease(dist)).toMatchObject({ ok: false, signed: false });
    await writeFile(path.join(dist, MANIFEST_NAME), 'not json');
    expect(await api.verifyRelease(dist)).toMatchObject({ ok: false, signed: false });
    expect(await api.verifyRelease(path.join(dist, 'does-not-exist'))).toMatchObject({ ok: false, signed: false });
  });

  it('is reported by /api/health', async () => {
    await sign(true);
    const status = await api.verifyRelease(dist);
    const r = await start({ staticDir: dist, release: status });
    try {
      const health = (await (await fetch(`${r.url}/api/health`)).json()) as { release: unknown };
      expect(health.release).toEqual({ verified: true, signed: true, dev: true });
    } finally {
      await r.close();
    }
    const none = await start({ release: null });
    try {
      const health = (await (await fetch(`${none.url}/api/health`)).json()) as { release: unknown };
      expect(health.release).toEqual({ verified: false, signed: false, dev: false });
    } finally {
      await none.close();
    }
  });
});
