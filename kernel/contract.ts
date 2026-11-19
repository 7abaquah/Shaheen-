/**
 * Shaheen security kernel — public contract.
 *
 * FROZEN: owned by the lead (graph.md → N1). Implementation nodes must satisfy this file and
 * the tests in kernel/tests/acceptance without editing either. Types only (erasable syntax).
 *
 * What the kernel is: a small, framework-free core that owns key material, encrypts data at
 * rest, enforces least-privilege access between first-party modules, keeps a tamper-evident
 * audit trail, and validates untrusted input.
 *
 * What it is not: a sandbox. Code running in the same JavaScript realm as an unlocked kernel
 * (for example an XSS payload) is inside the trust boundary. See SECURITY.md.
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Layout of the (untrusted) persistent storage. Every value is JSON text. */
export const STORAGE_KEYS = {
  header: 'shaheen/v1/header',
  /** + `${collection}/${id}` */
  recordPrefix: 'shaheen/v1/rec/',
  /** + sequence number, zero-padded to 10 digits. Value is an AuditEntry. */
  auditPrefix: 'shaheen/v1/audit/',
  /** + sequence number, zero-padded to 10 digits. Value is an AuditCheckpoint. */
  checkpointPrefix: 'shaheen/v1/cp/',
} as const;

export const MIN_KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 12;
export const DEFAULT_IDLE_LOCK_MS = 5 * 60 * 1000;

/** Names are validated before they are used in a storage key or a capability. */
export const NAME_RULES = {
  /** Vault collection. Names starting with '_' are reserved for the kernel and never grantable. */
  collection: /^[a-z][a-z0-9-]{0,31}$/,
  recordId: /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/,
  moduleId: /^[a-z][a-z0-9-]{0,31}$/,
  agentId: /^[a-z][a-z0-9:-]{0,47}$/,
  auditAction: /^[a-z][a-z0-9._:-]{0,63}$/,
} as const;

/**
 * Stored at STORAGE_KEYS.header. Every field is bound into the key wrap (as AEAD associated
 * data), so changing any of them makes unlock() fail rather than silently weakening the vault.
 */
export interface VaultHeader {
  v: 1;
  kdf: { name: 'PBKDF2-HMAC-SHA-256'; iterations: number; /** base64 */ salt: string };
  /** The data key, wrapped with the passphrase-derived key (AES-256-GCM). base64 fields. */
  wrappedKey: { iv: string; ct: string };
  /** base64 ML-DSA-65 public key that signs audit checkpoints. */
  auditPublicKey: string;
  createdAt: number;
}

/** Persistence the kernel does not trust: anything read back may have been modified. */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** All keys starting with `prefix`, sorted ascending. */
  keys(prefix: string): Promise<string[]>;
}

export type KernelState = 'uninitialized' | 'locked' | 'unlocked';

/**
 * Capabilities are exact strings — no wildcards.
 *   vault:read:<collection> / vault:write:<collection>
 *   ai:invoke:<agentId>
 *   audit:read
 *   kernel:admin
 */
export type Capability =
  | `vault:read:${string}`
  | `vault:write:${string}`
  | `ai:invoke:${string}`
  | 'audit:read'
  | 'kernel:admin';

export type KernelErrorCode =
  | 'SELFTEST_REQUIRED'
  | 'SELFTEST_FAILED'
  | 'ALREADY_INITIALIZED'
  | 'NOT_INITIALIZED'
  | 'WEAK_PASSPHRASE'
  | 'BAD_PASSPHRASE'
  | 'LOCKED'
  | 'INTEGRITY'
  | 'KDF_TOO_WEAK'
  | 'INVALID_NAME'
  | 'INVALID_CAPABILITY'
  | 'SEALED'
  | 'DUPLICATE_MODULE'
  | 'NOT_EMPTY'
  | 'BAD_ENVELOPE'
  | 'DENIED';

/** Shape of `KernelError` (a class exported by the implementation). */
export interface KernelErrorShape extends Error {
  readonly code: KernelErrorCode;
}

/** Shape of `CapabilityError` (extends KernelError, code 'DENIED'). */
export interface CapabilityErrorShape extends KernelErrorShape {
  readonly code: 'DENIED';
  readonly moduleId: string;
  readonly capability: string;
}

export interface KernelOptions {
  storage: StorageAdapter;
  /** Injectable clock (ms since epoch). Defaults to Date.now. */
  now?: () => number;
  /** PBKDF2 iterations for a new vault. Values below MIN_KDF_ITERATIONS are rejected (KDF_TOO_WEAK). */
  kdfIterations?: number;
  /**
   * Auto-lock after this much inactivity. Defaults to DEFAULT_IDLE_LOCK_MS. Inactivity is measured
   * from the last unlock/initialize or successful vault/admin operation. It is applied by tick()
   * and, lazily, at the start of every vault/admin operation (which then rejects LOCKED).
   */
  idleLockMs?: number;
}

export type SelfTestId =
  | 'csprng'
  | 'sha-256'
  | 'aes-256-gcm'
  | 'pbkdf2-sha-256'
  | 'ml-kem-768-x25519'
  | 'ml-dsa-65';

export interface SelfTestCheck {
  id: SelfTestId;
  ok: boolean;
  ms: number;
  detail: string;
}

export interface SelfTestReport {
  ok: boolean;
  ranAt: number;
  checks: SelfTestCheck[];
}

export type AuditDetail = Record<string, string | number | boolean>;

export interface AuditEntry {
  seq: number;
  ts: number;
  /** 'kernel' or the moduleId that caused the event. */
  actor: string;
  action: string;
  detail: AuditDetail;
  /** `hash` of the previous entry; 64 zeros for seq 1. */
  prevHash: string;
  /** Lower-case hex SHA-256 over the canonical encoding of all fields above. */
  hash: string;
}

export interface AuditCheckpoint {
  seq: number;
  /** `hash` of the entry at `seq`. */
  hash: string;
  /** base64 ML-DSA-65 signature over the checkpoint. */
  signature: string;
}

export interface AuditVerification {
  ok: boolean;
  entries: number;
  checkpoints: number;
  /** Highest seq covered by a valid checkpoint signature (0 when none). */
  signedThrough: number;
  /** First sequence number at which verification failed, or null. */
  firstBadSeq: number | null;
  reason: string | null;
}

/** Hybrid post-quantum sealed message. All byte fields are base64. JSON-serialisable. */
export interface SealedEnvelope {
  v: 1;
  alg: 'ML-KEM-768+X25519/HKDF-SHA-256/AES-256-GCM';
  kemCt: string;
  iv: string;
  ct: string;
}

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Stateless post-quantum helpers. Also used by the server and the release scripts. */
export interface PqApi {
  generateRecipientKeys(): Promise<KeyPair>;
  seal(recipientPublicKey: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Promise<SealedEnvelope>;
  /** Rejects with KernelError('BAD_ENVELOPE') on any failure (wrong key, tampering, aad mismatch, malformed). */
  open(recipientSecretKey: Uint8Array, envelope: SealedEnvelope, aad?: Uint8Array): Promise<Uint8Array>;
  generateSigningKeys(): Promise<KeyPair>;
  sign(secretKey: Uint8Array, message: Uint8Array): Promise<Uint8Array>;
  /** Resolves false (never rejects) for a bad signature, key or message. */
  verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean>;
}

export interface KernelInfo {
  version: string;
  state: KernelState;
  kdf: { name: 'PBKDF2-HMAC-SHA-256'; iterations: number };
  aead: 'AES-256-GCM';
  kem: 'ML-KEM-768+X25519';
  signature: 'ML-DSA-65';
  /** Stated so the UI can show it: the post-quantum library has no independent audit. */
  pqLibrary: { name: '@noble/post-quantum'; version: string; independentlyAudited: false };
  records: number;
  auditEntries: number;
  idleLockMs: number;
}

export interface VaultApi {
  /** Requires vault:write:<collection>. */
  put(collection: string, id: string, value: JsonValue): Promise<void>;
  /** Requires vault:read:<collection>. Resolves null when absent; rejects INTEGRITY when tampered. */
  get<T extends JsonValue = JsonValue>(collection: string, id: string): Promise<T | null>;
  /** Requires vault:read:<collection>. Record ids, sorted. */
  list(collection: string): Promise<string[]>;
  /** Requires vault:write:<collection>. */
  delete(collection: string, id: string): Promise<void>;
}

/**
 * Events the kernel records on its own (actor 'kernel' unless noted):
 *   kernel.initialized · kernel.unlocked · kernel.unlock_failed · kernel.locked · kernel.selftest {ok}
 *   capability.denied {capability}   (actor = module)
 *   vault.put / vault.delete {collection, id}   (actor = module) — never the value
 * Entries are not encrypted and can be read and verified while the kernel is locked.
 */
export interface AuditApi {
  /** Open to every module. `actor` is the calling module. Never pass secrets in `detail`. */
  log(action: string, detail?: AuditDetail): Promise<void>;
  /** Requires audit:read. */
  entries(): Promise<AuditEntry[]>;
  /** Requires audit:read. */
  verify(): Promise<AuditVerification>;
}

/** Every method requires kernel:admin. */
export interface AdminApi {
  info(): Promise<KernelInfo>;
  /** Signs the current head of the audit chain. Requires an unlocked kernel. */
  checkpoint(): Promise<void>;
  auditPublicKey(): Promise<Uint8Array>;
  /** Seals a copy of all kernel storage to `recipientPublicKey`. */
  exportBackup(recipientPublicKey: Uint8Array): Promise<SealedEnvelope>;
}

/** A module's view of the kernel. Frozen; holds no key material. */
export interface KernelHandle {
  readonly moduleId: string;
  readonly capabilities: readonly Capability[];
  can(capability: Capability): boolean;
  /** Rejects with CapabilityError and records `capability.denied` when not granted. */
  authorize(capability: Capability): Promise<void>;
  /** Same report as Kernel.selfTest(). Read-only; open to every module. */
  selfTest(): Promise<SelfTestReport>;
  readonly vault: VaultApi;
  readonly audit: AuditApi;
  readonly admin: AdminApi;
}

export interface Kernel {
  readonly state: KernelState;
  /** Known-answer tests. initialize()/unlock() reject until a self-test has passed in this instance. */
  selfTest(): Promise<SelfTestReport>;
  /** First run: creates the vault. Rejects ALREADY_INITIALIZED / WEAK_PASSPHRASE. Leaves the kernel unlocked. */
  initialize(passphrase: string): Promise<void>;
  /** Rejects BAD_PASSPHRASE, NOT_INITIALIZED, KDF_TOO_WEAK or INTEGRITY. */
  unlock(passphrase: string): Promise<void>;
  /** Signs a checkpoint (when unlocked) and drops all key material. */
  lock(): Promise<void>;
  /** Applies the idle auto-lock. Call periodically. */
  tick(): Promise<void>;
  /** Mint a module handle. One per moduleId (DUPLICATE_MODULE). Rejects malformed capabilities. */
  grant(moduleId: string, capabilities: readonly Capability[]): KernelHandle;
  /** After seal(), grant() throws SEALED. */
  seal(): void;
  subscribe(listener: (state: KernelState) => void): () => void;
}

export type IbanResult =
  | { ok: true; iban: string; country: string }
  | { ok: false; reason: 'empty' | 'chars' | 'country' | 'length' | 'checksum' };

export type TextResult =
  | { ok: true; value: string }
  | { ok: false; reason: 'type' | 'too_short' | 'too_long' };

/** Minimal schema language for validating model output and other untrusted JSON. */
export type Schema =
  | { type: 'string'; max: number; min?: number }
  | { type: 'number'; min?: number; max?: number }
  | { type: 'boolean' }
  | { type: 'array'; items: Schema; max: number; min?: number }
  | { type: 'object'; fields: Record<string, Schema>; optional?: readonly string[] }
  /** Object whose keys must come from `keys` (any subset). */
  | { type: 'record'; keys: readonly string[]; values: Schema };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Runtime exports required from kernel/src/index.ts.
 * `KernelError` and `CapabilityError` must also be exported as classes.
 */
export interface KernelModule {
  /** Reads storage to decide between 'uninitialized' and 'locked'. */
  createKernel(options: KernelOptions): Promise<Kernel>;
  createMemoryStorage(): StorageAdapter;
  /** Restores a backup into EMPTY storage (rejects NOT_EMPTY, BAD_ENVELOPE). */
  restoreBackup(storage: StorageAdapter, recipientSecretKey: Uint8Array, envelope: SealedEnvelope): Promise<void>;
  pq: PqApi;
  randomBytes(length: number): Uint8Array;
  sha256Hex(data: Uint8Array | string): Promise<string>;
  /** Accepts spaces and lower case. Checks country length and the ISO 13616 mod-97 checksum. */
  validateIban(input: string): IbanResult;
  /** First 2 and last 4 characters kept, everything between replaced by '•', grouped in fours. */
  maskIban(iban: string): string;
  /** Trims, removes control characters except \n and \t, then enforces the length bounds. */
  boundedText(input: unknown, opts: { max: number; min?: number }): TextResult;
  /**
   * Parses JSON produced by a model: tolerates a surrounding ```json fence, never throws,
   * drops unknown keys, and never copies __proto__ / constructor / prototype.
   */
  parseModelJson<T>(text: string, schema: Schema): ParseResult<T>;
}
