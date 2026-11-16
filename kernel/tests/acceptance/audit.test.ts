// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS, type AuditCheckpoint, type AuditEntry, type Kernel, type KernelHandle, type StorageAdapter } from '../../contract.ts';
import { OTHER_PASS, PASS, boot, corrupt, fresh, rejectsWith } from './helpers.ts';

const seqKey = (prefix: string, seq: number): string => prefix + String(seq).padStart(10, '0');

async function scenario(): Promise<{ kernel: Kernel; storage: StorageAdapter; wallet: KernelHandle; auditor: KernelHandle }> {
  const { kernel, storage } = await fresh();
  const wallet = kernel.grant('wallet', ['vault:read:bank', 'vault:write:bank']);
  const auditor = kernel.grant('security', ['audit:read', 'kernel:admin']);
  await wallet.vault.put('bank', 'primary', { iban: 'SA0380000000608010167519', marker: 'AUDIT-MUST-NOT-SEE-THIS' });
  await wallet.audit.log('bank.linked', { bank: 'demo' });
  await wallet.vault.put('bank', 'backup', { marker: 'AUDIT-MUST-NOT-SEE-THIS' });
  await wallet.vault.delete('bank', 'backup');
  return { kernel, storage, wallet, auditor };
}

describe('audit trail', () => {
  it('is a hash-linked chain starting at sequence 1', async () => {
    const { auditor, storage } = await scenario();
    const entries = await auditor.audit.entries();
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(entries[0]?.seq).toBe(1);
    expect(entries[0]?.prevHash).toBe('0'.repeat(64));
    entries.forEach((entry, i) => {
      expect(entry.seq).toBe(i + 1);
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
      if (i > 0) expect(entry.prevHash).toBe(entries[i - 1]?.hash);
    });
    // Stored one entry per key, in the documented layout.
    const stored = JSON.parse((await storage.get(seqKey(STORAGE_KEYS.auditPrefix, 1))) as string) as AuditEntry;
    expect(stored).toEqual(entries[0]);
    expect((await storage.keys(STORAGE_KEYS.auditPrefix)).length).toBe(entries.length);
  });

  it('records kernel lifecycle and vault events without the stored values', async () => {
    const { kernel, auditor, storage } = await scenario();
    await kernel.lock();
    const other = await boot(storage);
    await rejectsWith(other.unlock(OTHER_PASS), 'BAD_PASSPHRASE');
    await kernel.unlock(PASS);

    const entries = await auditor.audit.entries();
    const actions = entries.map((e) => e.action);
    for (const expected of ['kernel.initialized', 'kernel.selftest', 'kernel.locked', 'kernel.unlock_failed', 'kernel.unlocked', 'vault.put', 'vault.delete', 'bank.linked']) {
      expect(actions, `missing audit action ${expected}`).toContain(expected);
    }
    const put = entries.find((e) => e.action === 'vault.put');
    expect(put?.actor).toBe('wallet');
    expect(put?.detail).toMatchObject({ collection: 'bank', id: 'primary' });
    expect(entries.find((e) => e.action === 'bank.linked')?.actor).toBe('wallet');
    expect(entries.find((e) => e.action === 'kernel.initialized')?.actor).toBe('kernel');

    const text = JSON.stringify(entries);
    expect(text).not.toContain('AUDIT-MUST-NOT-SEE-THIS');
    expect(text).not.toContain('SA0380000000608010167519');
    expect(text).not.toContain(PASS);
    expect(text).not.toContain(OTHER_PASS);
  });

  it('verifies an untouched log and reports how far it is signed', async () => {
    const { kernel, auditor } = await scenario();
    const before = await auditor.audit.verify();
    expect(before.ok).toBe(true);
    expect(before.firstBadSeq).toBeNull();
    expect(before.entries).toBe((await auditor.audit.entries()).length);

    await auditor.admin.checkpoint();
    const signed = await auditor.audit.verify();
    expect(signed.ok).toBe(true);
    expect(signed.checkpoints).toBeGreaterThanOrEqual(1);
    expect(signed.signedThrough).toBeGreaterThanOrEqual(before.entries);

    // lock() also checkpoints, and the log stays verifiable while locked.
    await kernel.lock();
    const locked = await auditor.audit.verify();
    expect(locked.ok).toBe(true);
    expect(locked.signedThrough).toBeGreaterThan(signed.signedThrough);
    expect((await auditor.audit.entries()).length).toBe(locked.entries);
  });

  it('detects a modified entry', async () => {
    const { auditor, storage } = await scenario();
    const key = seqKey(STORAGE_KEYS.auditPrefix, 3);
    const entry = JSON.parse((await storage.get(key)) as string) as AuditEntry;
    entry.action = 'nothing.happened';
    await storage.set(key, JSON.stringify(entry));
    const result = await auditor.audit.verify();
    expect(result.ok).toBe(false);
    expect(result.firstBadSeq).toBe(3);
    expect(result.reason).toBeTruthy();
  });

  it('detects an entry whose detail was rewritten with a recomputed-looking hash left in place', async () => {
    const { auditor, storage } = await scenario();
    const key = seqKey(STORAGE_KEYS.auditPrefix, 2);
    const entry = JSON.parse((await storage.get(key)) as string) as AuditEntry;
    entry.detail = { ...entry.detail, forged: true };
    entry.ts += 1;
    await storage.set(key, JSON.stringify(entry));
    expect((await auditor.audit.verify()).ok).toBe(false);
  });

  it('detects a removed entry', async () => {
    const { auditor, storage } = await scenario();
    await storage.delete(seqKey(STORAGE_KEYS.auditPrefix, 2));
    const result = await auditor.audit.verify();
    expect(result.ok).toBe(false);
    expect([2, 3]).toContain(result.firstBadSeq);
  });

  it('detects truncation of entries covered by a checkpoint', async () => {
    const { auditor, storage } = await scenario();
    await auditor.admin.checkpoint();
    const keys = await storage.keys(STORAGE_KEYS.auditPrefix);
    const signedThrough = (await auditor.audit.verify()).signedThrough;
    expect(signedThrough).toBeGreaterThan(0);
    // Drop the signed tail (everything from the checkpointed entry onward).
    for (const key of keys.slice(signedThrough - 1)) await storage.delete(key);
    expect((await auditor.audit.verify()).ok).toBe(false);
  });

  it('detects a forged checkpoint', async () => {
    const { auditor, storage } = await scenario();
    await auditor.admin.checkpoint();
    const keys = await storage.keys(STORAGE_KEYS.checkpointPrefix);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const key = keys[keys.length - 1] as string;
    const cp = JSON.parse((await storage.get(key)) as string) as AuditCheckpoint;
    expect(Buffer.from(cp.signature, 'base64').length).toBe(3309);
    cp.signature = corrupt(cp.signature);
    await storage.set(key, JSON.stringify(cp));
    expect((await auditor.audit.verify()).ok).toBe(false);
  });

  it('rejects malformed audit actions from modules', async () => {
    const { wallet } = await scenario();
    await rejectsWith(wallet.audit.log('Has Spaces'), 'INVALID_NAME');
    await rejectsWith(wallet.audit.log(''), 'INVALID_NAME');
  });

  it('refuses to checkpoint while locked', async () => {
    const { kernel, auditor } = await scenario();
    await kernel.lock();
    await rejectsWith(auditor.admin.checkpoint(), 'LOCKED');
  });
});
