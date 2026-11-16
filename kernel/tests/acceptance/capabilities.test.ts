// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { describe, expect, it } from 'vitest';
import type { Capability } from '../../contract.ts';
import { CapabilityError, fresh, rejectsWith, throwsWith } from './helpers.ts';

async function denied(promise: Promise<unknown>, moduleId: string, capability: string): Promise<void> {
  const error = await rejectsWith(promise, 'DENIED');
  expect(error).toBeInstanceOf(CapabilityError);
  expect((error as unknown as { moduleId: string }).moduleId).toBe(moduleId);
  expect((error as unknown as { capability: string }).capability).toBe(capability);
}

describe('capabilities', () => {
  it('denies vault access that was not granted, and records the denial', async () => {
    const { kernel } = await fresh();
    const wallet = kernel.grant('wallet', ['vault:read:bank', 'vault:write:bank']);
    const store = kernel.grant('store', []);
    const auditor = kernel.grant('security', ['audit:read']);
    await wallet.vault.put('bank', 'primary', { iban: 'SA0380000000608010167519' });

    await denied(store.vault.get('bank', 'primary'), 'store', 'vault:read:bank');
    await denied(store.vault.list('bank'), 'store', 'vault:read:bank');
    await denied(store.vault.put('bank', 'primary', { hijacked: true }), 'store', 'vault:write:bank');
    await denied(store.vault.delete('bank', 'primary'), 'store', 'vault:write:bank');

    expect(await wallet.vault.get('bank', 'primary')).toEqual({ iban: 'SA0380000000608010167519' });
    const denials = (await auditor.audit.entries()).filter((e) => e.action === 'capability.denied');
    expect(denials.length).toBeGreaterThanOrEqual(4);
    expect(denials.every((e) => e.actor === 'store')).toBe(true);
    expect(denials.map((e) => e.detail.capability)).toContain('vault:read:bank');
  });

  it('treats read and write as separate grants', async () => {
    const { kernel } = await fresh();
    const writer = kernel.grant('writer', ['vault:write:notes']);
    const reader = kernel.grant('reader', ['vault:read:notes']);
    await writer.vault.put('notes', 'n1', { text: 'hello' });
    expect(await reader.vault.get('notes', 'n1')).toEqual({ text: 'hello' });
    await denied(writer.vault.get('notes', 'n1'), 'writer', 'vault:read:notes');
    await denied(reader.vault.put('notes', 'n1', { text: 'x' }), 'reader', 'vault:write:notes');
  });

  it('isolates collections from each other', async () => {
    const { kernel } = await fresh();
    const a = kernel.grant('mod-a', ['vault:read:alpha', 'vault:write:alpha']);
    const b = kernel.grant('mod-b', ['vault:read:beta', 'vault:write:beta']);
    await a.vault.put('alpha', 'x', { v: 'a' });
    await b.vault.put('beta', 'x', { v: 'b' });
    expect(await a.vault.get('alpha', 'x')).toEqual({ v: 'a' });
    expect(await b.vault.get('beta', 'x')).toEqual({ v: 'b' });
    await denied(a.vault.get('beta', 'x'), 'mod-a', 'vault:read:beta');
    await denied(b.vault.get('alpha', 'x'), 'mod-b', 'vault:read:alpha');
  });

  it('gates AI agents one by one through authorize()', async () => {
    const { kernel } = await fresh();
    const h = kernel.grant('campaign', ['ai:invoke:campaign', 'ai:invoke:angel:atlas']);
    expect(h.can('ai:invoke:campaign')).toBe(true);
    expect(h.can('ai:invoke:angel:atlas')).toBe(true);
    expect(h.can('ai:invoke:engineer')).toBe(false);
    await h.authorize('ai:invoke:campaign');
    await h.authorize('ai:invoke:angel:atlas');
    await denied(h.authorize('ai:invoke:engineer'), 'campaign', 'ai:invoke:engineer');
    await denied(h.authorize('ai:invoke:angel:mercury'), 'campaign', 'ai:invoke:angel:mercury');
  });

  it('rejects wildcard, malformed and reserved capabilities when granting', async () => {
    const { kernel } = await fresh();
    const bad = [
      'vault:read:*', 'vault:*:bank', '*', 'vault:read:', 'vault:read:Bank', 'vault:read:a b',
      'vault:read:_kernel', 'vault:write:__audit', 'ai:invoke:', 'ai:invoke:*', 'root', 'audit:write', '',
    ];
    for (const cap of bad) {
      throwsWith(() => kernel.grant(`m${bad.indexOf(cap)}`, [cap as Capability]), 'INVALID_CAPABILITY');
    }
  });

  it('mints one handle per module and none after seal()', async () => {
    const { kernel } = await fresh();
    kernel.grant('wallet', ['vault:read:bank']);
    throwsWith(() => kernel.grant('wallet', ['vault:read:bank', 'vault:write:bank']), 'DUPLICATE_MODULE');
    kernel.seal();
    throwsWith(() => kernel.grant('late', []), 'SEALED');
  });

  it('hands out frozen handles that carry no key material', async () => {
    const { kernel } = await fresh();
    const caps: Capability[] = ['vault:read:bank'];
    const h = kernel.grant('wallet', caps);
    caps.push('kernel:admin'); // mutating the caller's array must not widen the grant
    expect(h.can('kernel:admin')).toBe(false);
    expect(h.capabilities).toEqual(['vault:read:bank']);

    expect(Object.isFrozen(h)).toBe(true);
    expect(Object.isFrozen(h.capabilities)).toBe(true);
    expect(Object.isFrozen(h.vault)).toBe(true);
    expect(Object.isFrozen(h.audit)).toBe(true);
    expect(Object.isFrozen(h.admin)).toBe(true);
    expect(() => { (h as unknown as { moduleId: string }).moduleId = 'security'; }).toThrow();
    expect(() => { (h.capabilities as Capability[]).push('kernel:admin'); }).toThrow();

    const seen = new Set<unknown>();
    const walk = (value: unknown, depth: number): void => {
      if (value === null || typeof value !== 'object' || seen.has(value) || depth > 6) return;
      seen.add(value);
      expect(value instanceof Uint8Array, 'handle exposes raw bytes').toBe(false);
      expect(value instanceof CryptoKey, 'handle exposes a CryptoKey').toBe(false);
      for (const key of Reflect.ownKeys(value)) {
        const v = (value as Record<PropertyKey, unknown>)[key];
        if (typeof v === 'string') expect(v.length, `long string on handle.${String(key)}`).toBeLessThan(200);
        walk(v, depth + 1);
      }
    };
    walk(h, 0);
  });

  it('gates the audit reader and the admin API', async () => {
    const { kernel } = await fresh();
    const plain = kernel.grant('store', []);
    const auditor = kernel.grant('auditor', ['audit:read']);
    const admin = kernel.grant('security', ['audit:read', 'kernel:admin']);

    await plain.audit.log('cart.add', { items: 1 }); // logging is open to everyone
    await denied(plain.audit.entries(), 'store', 'audit:read');
    await denied(plain.audit.verify(), 'store', 'audit:read');
    await denied(plain.admin.info(), 'store', 'kernel:admin');
    await denied(plain.admin.checkpoint(), 'store', 'kernel:admin');
    await denied(plain.admin.auditPublicKey(), 'store', 'kernel:admin');
    await denied(auditor.admin.info(), 'auditor', 'kernel:admin');

    const info = await admin.admin.info();
    expect(info.state).toBe('unlocked');
    expect(info.aead).toBe('AES-256-GCM');
    expect(info.kem).toBe('ML-KEM-768+X25519');
    expect(info.signature).toBe('ML-DSA-65');
    expect(info.kdf.iterations).toBeGreaterThanOrEqual(600_000);
    expect(info.pqLibrary.independentlyAudited).toBe(false);
    expect((await auditor.audit.entries()).some((e) => e.actor === 'store' && e.action === 'cart.add')).toBe(true);
  });

  it('lets every module run the read-only self-test', async () => {
    const { kernel } = await fresh();
    const report = await kernel.grant('engineer', []).selfTest();
    expect(report.ok).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(6);
  });
});
