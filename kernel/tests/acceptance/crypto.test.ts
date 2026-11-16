// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SealedEnvelope, SelfTestId } from '../../contract.ts';
import { PASS, api, boot, corrupt, fresh, fromUtf8, rejectsWith, unb64, utf8 } from './helpers.ts';

afterEach(() => vi.restoreAllMocks());

describe('self-test', () => {
  it('covers every required primitive and passes', async () => {
    const kernel = await boot();
    const report = await kernel.selfTest();
    const required: SelfTestId[] = ['csprng', 'sha-256', 'aes-256-gcm', 'pbkdf2-sha-256', 'ml-kem-768-x25519', 'ml-dsa-65'];
    expect(report.ok).toBe(true);
    expect(report.ranAt).toBeGreaterThan(0);
    for (const id of required) {
      const check = report.checks.find((c) => c.id === id);
      expect(check, `self-test is missing ${id}`).toBeDefined();
      expect(check?.ok, `${id}: ${check?.detail}`).toBe(true);
      expect(typeof check?.detail).toBe('string');
    }
  });

  it('fails closed when a primitive misbehaves', async () => {
    // A digest that returns zeros breaks the SHA-256 known-answer test (and anything built on it).
    const kernel = await api.createKernel({ storage: api.createMemoryStorage() });
    const spy = vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(new ArrayBuffer(32));
    const report = await kernel.selfTest();
    spy.mockRestore();
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.id === 'sha-256')?.ok).toBe(false);
    await rejectsWith(kernel.initialize(PASS), 'SELFTEST_FAILED');
    expect(kernel.state).toBe('uninitialized');
  });
});

describe('hybrid post-quantum sealing', () => {
  it('round-trips with ML-KEM-768 + X25519 keys', async () => {
    const keys = await api.pq.generateRecipientKeys();
    expect(keys.publicKey.length).toBe(1216); // 1184 (ML-KEM-768) + 32 (X25519)
    const envelope = await api.pq.seal(keys.publicKey, utf8('نسخة احتياطية سرّية'), utf8('backup-v1'));
    expect(envelope.v).toBe(1);
    expect(envelope.alg).toBe('ML-KEM-768+X25519/HKDF-SHA-256/AES-256-GCM');
    expect(unb64(envelope.kemCt).length).toBe(1120); // 1088 + 32
    expect(unb64(envelope.iv).length).toBe(12);
    expect(JSON.stringify(envelope)).not.toContain('نسخة');
    const roundTripped = JSON.parse(JSON.stringify(envelope)) as SealedEnvelope;
    expect(fromUtf8(await api.pq.open(keys.secretKey, roundTripped, utf8('backup-v1')))).toBe('نسخة احتياطية سرّية');
  });

  it('is randomised', async () => {
    const keys = await api.pq.generateRecipientKeys();
    const a = await api.pq.seal(keys.publicKey, utf8('same'));
    const b = await api.pq.seal(keys.publicKey, utf8('same'));
    expect(a.kemCt).not.toBe(b.kemCt);
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
  });

  it('rejects the wrong key, tampering and a different context', async () => {
    const keys = await api.pq.generateRecipientKeys();
    const other = await api.pq.generateRecipientKeys();
    const envelope = await api.pq.seal(keys.publicKey, utf8('secret'), utf8('ctx'));
    await rejectsWith(api.pq.open(other.secretKey, envelope, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, envelope, utf8('other-ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, envelope), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, { ...envelope, ct: corrupt(envelope.ct) }, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, { ...envelope, kemCt: corrupt(envelope.kemCt) }, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, { ...envelope, iv: 'AAAA' }, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, { ...envelope, alg: 'RSA' } as unknown as SealedEnvelope, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.open(keys.secretKey, { v: 1 } as unknown as SealedEnvelope, utf8('ctx')), 'BAD_ENVELOPE');
    await rejectsWith(api.pq.seal(new Uint8Array(10), utf8('x')), 'BAD_ENVELOPE');
  });
});

describe('ML-DSA-65 signatures', () => {
  it('verify and reject tampering', async () => {
    const keys = await api.pq.generateSigningKeys();
    expect(keys.publicKey.length).toBe(1952);
    const message = utf8('release manifest');
    const signature = await api.pq.sign(keys.secretKey, message);
    expect(signature.length).toBe(3309);
    expect(await api.pq.verify(keys.publicKey, message, signature)).toBe(true);
    expect(await api.pq.verify(keys.publicKey, utf8('release manifesT'), signature)).toBe(false);
    const flipped = signature.slice();
    flipped[100] = (flipped[100] ?? 0) ^ 1;
    expect(await api.pq.verify(keys.publicKey, message, flipped)).toBe(false);
    const stranger = await api.pq.generateSigningKeys();
    expect(await api.pq.verify(stranger.publicKey, message, signature)).toBe(false);
  });

  it('resolves false instead of throwing on garbage', async () => {
    const keys = await api.pq.generateSigningKeys();
    expect(await api.pq.verify(new Uint8Array(3), utf8('m'), new Uint8Array(5))).toBe(false);
    expect(await api.pq.verify(keys.publicKey, utf8('m'), new Uint8Array(0))).toBe(false);
  });
});

describe('primitives', () => {
  it('sha256Hex matches the standard vectors', async () => {
    expect(await api.sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await api.sha256Hex(utf8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await api.sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('randomBytes returns distinct output of the requested size', () => {
    const a = api.randomBytes(32);
    const b = api.randomBytes(32);
    expect(a).toBeInstanceOf(Uint8Array);
    expect(a.length).toBe(32);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    expect(a.some((x) => x !== 0)).toBe(true);
    expect(api.randomBytes(0).length).toBe(0);
  });

  it('never falls back to Math.random', async () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for anything in the kernel');
    });
    const { kernel } = await fresh();
    const h = kernel.grant('wallet', ['vault:read:bank', 'vault:write:bank']);
    await h.vault.put('bank', 'primary', { ok: true });
    expect(await h.vault.get('bank', 'primary')).toEqual({ ok: true });
    const keys = await api.pq.generateRecipientKeys();
    await api.pq.open(keys.secretKey, await api.pq.seal(keys.publicKey, utf8('x')));
    const signing = await api.pq.generateSigningKeys();
    await api.pq.sign(signing.secretKey, utf8('x'));
    api.randomBytes(16);
    await kernel.lock();
  });
});

describe('sealed backups', () => {
  it('export and restore a whole vault', async () => {
    const { kernel, storage } = await fresh();
    const wallet = kernel.grant('wallet', ['vault:read:bank', 'vault:write:bank']);
    const admin = kernel.grant('security', ['audit:read', 'kernel:admin']);
    await wallet.vault.put('bank', 'primary', { iban: 'SA0380000000608010167519' });
    const recovery = await api.pq.generateRecipientKeys();
    const envelope = await admin.admin.exportBackup(recovery.publicKey);
    expect(JSON.stringify(envelope)).not.toContain('SA0380000000608010167519');
    const originalKeys = await storage.keys('shaheen/');

    const target = api.createMemoryStorage();
    await api.restoreBackup(target, recovery.secretKey, envelope);
    // The backup is a snapshot taken at export time (the export itself may be audited afterwards).
    expect((await target.keys('shaheen/')).length).toBeGreaterThanOrEqual(originalKeys.length - 2);

    const restored = await boot(target);
    expect(restored.state).toBe('locked');
    await restored.unlock(PASS);
    const again = restored.grant('wallet', ['vault:read:bank']);
    expect(await again.vault.get('bank', 'primary')).toEqual({ iban: 'SA0380000000608010167519' });
    const check = await restored.grant('security', ['audit:read']).audit.verify();
    expect(check.ok).toBe(true);
  });

  it('refuses non-empty storage and the wrong recovery key', async () => {
    const { kernel } = await fresh();
    const admin = kernel.grant('security', ['kernel:admin']);
    const recovery = await api.pq.generateRecipientKeys();
    const stranger = await api.pq.generateRecipientKeys();
    const envelope = await admin.admin.exportBackup(recovery.publicKey);

    const occupied = api.createMemoryStorage();
    await occupied.set('shaheen/v1/header', '{}');
    await rejectsWith(api.restoreBackup(occupied, recovery.secretKey, envelope), 'NOT_EMPTY');

    const empty = api.createMemoryStorage();
    await rejectsWith(api.restoreBackup(empty, stranger.secretKey, envelope), 'BAD_ENVELOPE');
    expect(await empty.keys('')).toEqual([]);
  });

  it('refuses to export while locked', async () => {
    const { kernel } = await fresh();
    const admin = kernel.grant('security', ['kernel:admin']);
    const recovery = await api.pq.generateRecipientKeys();
    await kernel.lock();
    await rejectsWith(admin.admin.exportBackup(recovery.publicKey), 'LOCKED');
  });
});
