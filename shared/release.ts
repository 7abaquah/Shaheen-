/**
 * Release manifest format shared by scripts/sign-release.mjs and the gateway's verifier.
 * FROZEN: owned by the lead (graph.md → N1). Erasable syntax only.
 *
 * `npm run build` hashes every file in dist/ and signs the list with ML-DSA-65. The gateway
 * recomputes the hashes at start-up and refuses to serve a build that does not match.
 */

export const MANIFEST_NAME = 'release-manifest.json';

export interface ReleaseManifest {
  v: 1;
  createdAt: string;
  /** Path relative to dist/ (forward slashes) → lower-case hex SHA-256. Excludes the manifest. */
  files: Record<string, string>;
  signer: {
    alg: 'ML-DSA-65';
    /** base64 */
    publicKey: string;
    /** True when signed with an ephemeral key generated at build time. Proves consistency, not origin. */
    dev: boolean;
  };
  /** base64 signature over canonicalManifestBytes(). */
  signature: string;
}

export interface ReleaseStatus {
  /** Hashes match, nothing missing or extra, signature valid, and (when pinned) signer is the pinned key. */
  ok: boolean;
  signed: boolean;
  dev: boolean;
  files: number;
  reason: string | null;
}

/** The exact bytes that are signed: v, createdAt, signer identity and the sorted file list. */
export function canonicalManifestBytes(m: Pick<ReleaseManifest, 'v' | 'createdAt' | 'files' | 'signer'>): Uint8Array {
  const files = Object.fromEntries(Object.entries(m.files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const text = JSON.stringify({ v: m.v, createdAt: m.createdAt, files, signer: { alg: m.signer.alg, publicKey: m.signer.publicKey, dev: m.signer.dev } });
  return new TextEncoder().encode(text);
}
