// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { describe, expect, it } from 'vitest';
import { MIN_KDF_ITERATIONS, STORAGE_KEYS, type KernelState, type VaultHeader } from '../../contract.ts';
import { PASS, OTHER_PASS, api, boot, corrupt, fresh, rejectsWith, storageLeaks, throwsWith, b64 } from './helpers.ts';

const BANK = ['vault:read:bank', 'vault:write:bank'] as const;
const SECRET = { iban: 'SA0380000000608010167519', holder: 'عبدالله الشاهين', note: 'ZX-PLAINTEXT-MARKER-91f3' };

describe('vault lifecycle', () => {
  it('reports uninitialized for empty storage and locked for an existing vault', async () => {
    const storage = api.createMemoryStorage();
    const first = await api.createKernel({ storage });
    expect(first.state).toBe('uninitialized');
    await first.selfTest();
    await first.initialize(PASS);
    expect(first.state).toBe('unlocked');

    const second = await api.createKernel({ storage });
    expect(second.state).toBe('locked');
  });

  it('refuses to initialize or unlock before a self-test has passed', async () => {
    const storage = api.createMemoryStorage();
    const kernel = await api.createKernel({ storage });
    await rejectsWith(kernel.initialize(PASS), 'SELFTEST_REQUIRED');
    expect(kernel.state).toBe('uninitialized');
    await kernel.selfTest();
    await kernel.initialize(PASS);

    const again = await api.createKernel({ storage });
    await rejectsWith(again.unlock(PASS), 'SELFTEST_REQUIRED');
  });

  it('moves unlocked → locked → unlocked and tells subscribers', async () => {
    const { kernel } = await fresh();
    const seen: KernelState[] = [];
    const stop = kernel.subscribe((s) => seen.push(s));
    await kernel.lock();
    expect(kernel.state).toBe('locked');
    await kernel.unlock(PASS);
    expect(kernel.state).toBe('unlocked');
    stop();
    await kernel.lock();
    expect(seen).toEqual(['locked', 'unlocked']);
  });

  it('rejects weak passphrases and a second initialisation', async () => {
    const kernel = await boot();
    await rejectsWith(kernel.initialize('short'), 'WEAK_PASSPHRASE');
    await rejectsWith(kernel.initialize('12345678901'), 'WEAK_PASSPHRASE');
    expect(kernel.state).toBe('uninitialized');
    await kernel.initialize(PASS);
    await rejectsWith(kernel.initialize(PASS), 'ALREADY_INITIALIZED');
  });

  it('rejects a wrong passphrase and stays locked', async () => {
    const { storage } = await fresh();
    const kernel = await boot(storage);
    await rejectsWith(kernel.unlock(OTHER_PASS), 'BAD_PASSPHRASE');
    expect(kernel.state).toBe('locked');
    await kernel.unlock(PASS);
    expect(kernel.state).toBe('unlocked');
  });

  it('rejects unlock on storage that was never initialised', async () => {
    const kernel = await boot();
    await rejectsWith(kernel.unlock(PASS), 'NOT_INITIALIZED');
  });

  it('refuses to create a vault with a KDF below the minimum', async () => {
    const kernel = await boot(api.createMemoryStorage(), { kdfIterations: MIN_KDF_ITERATIONS - 1 });
    await rejectsWith(kernel.initialize(PASS), 'KDF_TOO_WEAK');
    expect(kernel.state).toBe('uninitialized');
  });
});

describe('vault confidentiality and integrity', () => {
  it('never writes plaintext, the passphrase or encodings of them to storage', async () => {
    const { kernel, storage } = await fresh();
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'primary', SECRET);
    await kernel.lock();

    for (const needle of [SECRET.iban, SECRET.holder, SECRET.note, PASS]) {
      expect(await storageLeaks(storage, needle), `storage leaks ${needle}`).toBe(false);
    }
    // Sanity check of the detector itself.
    await storage.set('probe', `{"x":"${b64(new TextEncoder().encode('zz' + SECRET.note))}"}`);
    expect(await storageLeaks(storage, SECRET.note)).toBe(true);
  });

  it('writes a header that matches the documented format', async () => {
    const { storage } = await fresh();
    const header = JSON.parse((await storage.get(STORAGE_KEYS.header)) ?? 'null') as VaultHeader;
    expect(header.v).toBe(1);
    expect(header.kdf.name).toBe('PBKDF2-HMAC-SHA-256');
    expect(header.kdf.iterations).toBeGreaterThanOrEqual(MIN_KDF_ITERATIONS);
    expect(Buffer.from(header.kdf.salt, 'base64').length).toBeGreaterThanOrEqual(16);
    expect(Buffer.from(header.wrappedKey.iv, 'base64').length).toBe(12);
    expect(Buffer.from(header.auditPublicKey, 'base64').length).toBe(1952);
  });

  it('round-trips values across a restart', async () => {
    const { kernel, storage } = await fresh();
    await kernel.grant('wallet', BANK).vault.put('bank', 'primary', SECRET);
    await kernel.lock();

    const next = await boot(storage);
    await next.unlock(PASS);
    const h = next.grant('wallet', BANK);
    expect(await h.vault.get('bank', 'primary')).toEqual(SECRET);
    expect(await h.vault.get('bank', 'missing')).toBeNull();
  });

  it('lists ids sorted and deletes records', async () => {
    const { kernel } = await fresh();
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'b', { n: 2 });
    await h.vault.put('bank', 'a', { n: 1 });
    await h.vault.put('bank', 'c', { n: 3 });
    expect(await h.vault.list('bank')).toEqual(['a', 'b', 'c']);
    await h.vault.delete('bank', 'b');
    expect(await h.vault.list('bank')).toEqual(['a', 'c']);
    expect(await h.vault.get('bank', 'b')).toBeNull();
  });

  it('uses a fresh nonce for every write', async () => {
    const { kernel, storage } = await fresh();
    const h = kernel.grant('wallet', BANK);
    const key = `${STORAGE_KEYS.recordPrefix}bank/primary`;
    await h.vault.put('bank', 'primary', SECRET);
    const first = await storage.get(key);
    await h.vault.put('bank', 'primary', SECRET);
    const second = await storage.get(key);
    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('detects a modified record', async () => {
    const { kernel, storage } = await fresh();
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'primary', SECRET);
    const key = `${STORAGE_KEYS.recordPrefix}bank/primary`;
    const stored = await storage.get(key);
    expect(stored).not.toBeNull();
    await storage.set(key, corrupt(stored as string));
    await rejectsWith(h.vault.get('bank', 'primary'), 'INTEGRITY');
  });

  it('detects ciphertexts swapped between two records', async () => {
    const { kernel, storage } = await fresh();
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'mine', { owner: 'me' });
    await h.vault.put('bank', 'theirs', { owner: 'attacker' });
    const a = `${STORAGE_KEYS.recordPrefix}bank/mine`;
    const b = `${STORAGE_KEYS.recordPrefix}bank/theirs`;
    const [va, vb] = [await storage.get(a), await storage.get(b)];
    await storage.set(a, vb as string);
    await storage.set(b, va as string);
    await rejectsWith(h.vault.get('bank', 'mine'), 'INTEGRITY');
    await rejectsWith(h.vault.get('bank', 'theirs'), 'INTEGRITY');
  });

  it('refuses vault access while locked', async () => {
    const { kernel } = await fresh();
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'primary', SECRET);
    await kernel.lock();
    await rejectsWith(h.vault.get('bank', 'primary'), 'LOCKED');
    await rejectsWith(h.vault.put('bank', 'primary', SECRET), 'LOCKED');
    await rejectsWith(h.vault.list('bank'), 'LOCKED');
  });

  it('rejects a header downgraded to a weak KDF', async () => {
    const { storage } = await fresh();
    const header = JSON.parse((await storage.get(STORAGE_KEYS.header)) as string) as VaultHeader;
    header.kdf.iterations = 1000;
    await storage.set(STORAGE_KEYS.header, JSON.stringify(header));
    const kernel = await boot(storage);
    await rejectsWith(kernel.unlock(PASS), 'KDF_TOO_WEAK');
    expect(kernel.state).toBe('locked');
  });

  it('rejects a header whose fields were replaced, even with the right passphrase', async () => {
    const mutate = async (change: (h: VaultHeader) => void | Promise<void>) => {
      const { storage } = await fresh();
      const header = JSON.parse((await storage.get(STORAGE_KEYS.header)) as string) as VaultHeader;
      await change(header);
      await storage.set(STORAGE_KEYS.header, JSON.stringify(header));
      const kernel = await boot(storage);
      await rejectsWith(kernel.unlock(PASS), 'INTEGRITY', 'BAD_PASSPHRASE');
      expect(kernel.state).toBe('locked');
    };
    // Attacker swaps in their own audit signing key so they could re-sign a forged log.
    await mutate(async (h) => { h.auditPublicKey = b64((await api.pq.generateSigningKeys()).publicKey); });
    await mutate((h) => { h.kdf.iterations = MIN_KDF_ITERATIONS + 1; });
    await mutate((h) => { h.createdAt = h.createdAt + 1; });
    await mutate((h) => { h.wrappedKey.ct = corrupt(h.wrappedKey.ct); });
  });
});

describe('idle auto-lock', () => {
  it('locks after the idle period, on tick() and lazily on use', async () => {
    const clock = { t: 1_700_000_000_000 };
    const { kernel } = await fresh({ now: () => clock.t, idleLockMs: 1000 });
    const h = kernel.grant('wallet', BANK);
    await h.vault.put('bank', 'primary', SECRET);

    clock.t += 999;
    await kernel.tick();
    expect(kernel.state).toBe('unlocked');
    await h.vault.get('bank', 'primary'); // activity resets the idle timer

    clock.t += 999;
    await kernel.tick();
    expect(kernel.state).toBe('unlocked');

    clock.t += 2;
    await kernel.tick();
    expect(kernel.state).toBe('locked');

    await kernel.unlock(PASS);
    clock.t += 5000; // no tick: the next operation must notice by itself
    await rejectsWith(h.vault.get('bank', 'primary'), 'LOCKED');
    expect(kernel.state).toBe('locked');
  });
});

describe('names', () => {
  it('rejects malformed collection and record names', async () => {
    const { kernel } = await fresh();
    const h = kernel.grant('wallet', BANK);
    for (const id of ['', '../x', 'a/b', 'a b', '.hidden', 'x'.repeat(65)]) {
      await rejectsWith(h.vault.put('bank', id, { ok: false }), 'INVALID_NAME');
      await rejectsWith(h.vault.get('bank', id), 'INVALID_NAME');
    }
    throwsWith(() => kernel.grant('Bad Module', []), 'INVALID_NAME');
    throwsWith(() => kernel.grant('', []), 'INVALID_NAME');
  });
});
