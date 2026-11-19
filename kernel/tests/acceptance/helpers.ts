// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import { expect } from 'vitest';
import type { Kernel, KernelErrorCode, KernelModule, KernelOptions, StorageAdapter } from '../../contract.ts';
import * as impl from '../../src/index.ts';

/** Compile-time proof that the implementation exports the whole contract. */
export const api: KernelModule = impl;
export const KernelError = impl.KernelError;
export const CapabilityError = impl.CapabilityError;

export const PASS = 'correct horse battery staple — شاهين';
export const OTHER_PASS = 'a different but equally long passphrase';

export async function boot(storage: StorageAdapter = api.createMemoryStorage(), options: Partial<KernelOptions> = {}): Promise<Kernel> {
  const kernel = await api.createKernel({ storage, ...options });
  const report = await kernel.selfTest();
  expect(report.ok, JSON.stringify(report.checks)).toBe(true);
  return kernel;
}

/** A fresh, initialised (unlocked) kernel plus its storage. */
export async function fresh(options: Partial<KernelOptions> = {}): Promise<{ kernel: Kernel; storage: StorageAdapter }> {
  const storage = api.createMemoryStorage();
  const kernel = await boot(storage, options);
  await kernel.initialize(PASS);
  return { kernel, storage };
}

export async function rejectsWith(promise: Promise<unknown>, ...codes: KernelErrorCode[]): Promise<Error & { code: KernelErrorCode }> {
  let error: unknown;
  let settled = false;
  try {
    await promise;
    settled = true;
  } catch (e) {
    error = e;
  }
  expect(settled, `expected a rejection with ${codes.join(' | ')}`).toBe(false);
  expect(error).toBeInstanceOf(KernelError);
  const code = (error as { code: KernelErrorCode }).code;
  expect(codes, `unexpected error code ${code}`).toContain(code);
  return error as Error & { code: KernelErrorCode };
}

export function throwsWith(fn: () => unknown, ...codes: KernelErrorCode[]): void {
  let error: unknown;
  let returned = false;
  try {
    fn();
    returned = true;
  } catch (e) {
    error = e;
  }
  expect(returned, `expected a throw with ${codes.join(' | ')}`).toBe(false);
  expect(error).toBeInstanceOf(KernelError);
  expect(codes).toContain((error as { code: KernelErrorCode }).code);
}

export async function dump(storage: StorageAdapter): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of await storage.keys('')) out[key] = (await storage.get(key)) ?? '';
  return out;
}

/**
 * True when `needle` occurs anywhere in storage: as text, or inside any base64 / base64url /
 * hex run once decoded. Used to show that secrets are not merely encoded.
 */
export async function storageLeaks(storage: StorageAdapter, needle: string): Promise<boolean> {
  const all = Object.entries(await dump(storage)).map(([k, v]) => `${k}\n${v}`).join('\n');
  if (all.includes(needle)) return true;
  const target = Buffer.from(needle, 'utf8');
  for (const m of all.matchAll(/[A-Za-z0-9+/_=-]{8,}/g)) {
    const run = m[0];
    for (const enc of ['base64', 'base64url', 'hex'] as const) {
      // Try every alignment so a secret embedded mid-stream is still found.
      for (let skip = 0; skip < 4; skip++) {
        if (Buffer.from(run.slice(skip), enc).includes(target)) return true;
      }
    }
  }
  return false;
}

/** Flip one character in the middle of the longest ciphertext-looking run of a stored value. */
export function corrupt(stored: string): string {
  const runs = [...stored.matchAll(/[A-Za-z0-9+/_-]{24,}/g)].sort((a, b) => b[0].length - a[0].length);
  const longest = runs[0];
  if (!longest || longest.index === undefined) throw new Error('no ciphertext-like run in stored value');
  const i = longest.index + Math.floor(longest[0].length / 2);
  const replacement = stored[i] === 'A' ? 'B' : 'A';
  return stored.slice(0, i) + replacement + stored.slice(i + 1);
}

export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);
export const b64 = (b: Uint8Array): string => Buffer.from(b).toString('base64');
export const unb64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'base64'));
