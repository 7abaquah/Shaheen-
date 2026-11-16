/**
 * Shaheen AI gateway — public contract.
 *
 * FROZEN: owned by the lead (graph.md → N1). The implementation node must satisfy this file
 * and the tests in server/tests/acceptance without editing either. Types only.
 *
 * The gateway is the only component that holds model credentials. It exists so that the
 * browser never talks to the model API directly (all four source prototypes did).
 *
 * HTTP surface
 *   POST /api/agent/<agentId>   body: {"input": <AgentInputFor<agentId>>}  → AgentResponse | ErrorResponse
 *   GET  /api/health                                                        → HealthResponse
 *   GET  /<path>                static files from `staticDir`; unknown non-file paths → index.html
 *
 * Status codes: 200 ok · 400 BAD_REQUEST · 403 FORBIDDEN_ORIGIN · 404 UNKNOWN_AGENT/NOT_FOUND ·
 * 405 METHOD_NOT_ALLOWED · 413 PAYLOAD_TOO_LARGE · 415 UNSUPPORTED_MEDIA_TYPE · 422 REFUSED ·
 * 429 RATE_LIMITED (+ Retry-After) · 502 UPSTREAM/BAD_MODEL_OUTPUT · 503 AI_UNAVAILABLE ·
 * 504 TIMEOUT · 500 INTERNAL.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AgentId, ChatMessage } from '../shared/agents.ts';
import type { ReleaseStatus } from '../shared/release.ts';
import type { Schema } from '../kernel/contract.ts';

export interface LlmRequest {
  model: string;
  /** Always built by the gateway from its own registry. */
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  /** JSON Schema for structured output, when the agent returns JSON. */
  jsonSchema?: Record<string, unknown>;
}

export interface LlmResult {
  text: string;
  stopReason: 'end_turn' | 'max_tokens' | 'refusal' | 'other';
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmClient {
  complete(request: LlmRequest, signal: AbortSignal): Promise<LlmResult>;
}

/** Never contains request or response text, headers, or credentials. */
export interface GatewayLogEvent {
  at: number;
  kind: 'agent' | 'reject' | 'error' | 'static';
  status: number;
  agentId?: string;
  code?: string;
  ms?: number;
}

export interface GatewayOptions {
  /** null when no credentials are configured → agent calls answer 503 AI_UNAVAILABLE. */
  llm: LlmClient | null;
  mode: 'live' | 'mock' | 'unconfigured';
  model: string;
  /** Directory of the built front-end, or null to serve the API only. */
  staticDir: string | null;
  /** Origins allowed in addition to the request's own origin. Never '*'. */
  allowedOrigins: readonly string[];
  rateLimit: { capacity: number; refillPerSecond: number };
  /** When true the client key is the first X-Forwarded-For hop; otherwise the socket address. */
  trustProxy: boolean;
  requestTimeoutMs: number;
  release: ReleaseStatus | null;
  now?: () => number;
  log?: (event: GatewayLogEvent) => void;
}

export interface Gateway {
  handle(req: IncomingMessage, res: ServerResponse): void;
}

export interface AgentSpec {
  id: AgentId;
  /** Persona + task framing + INTEGRITY_POLICY. Contains no user-controlled text. */
  system: string;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  output: 'text' | 'json';
  /** Present when output is 'json': validates the model's reply before it leaves the gateway. */
  resultSchema?: Schema;
}

export interface ServerConfig extends GatewayOptions {
  port: number;
  host: string;
  /** base64 ML-DSA-65 public key the release must be signed with, or null. */
  releasePublicKey: string | null;
  allowUnsigned: boolean;
}

/** Runtime exports required from server/src/index.ts. */
export interface ServerModule {
  createGateway(options: GatewayOptions): Gateway;
  /** Deterministic canned replies, clearly labelled as mock. No network. */
  createMockLlm(): LlmClient;
  /** One spec per AgentId in shared/agents.ts. */
  AGENT_REGISTRY: ReadonlyMap<AgentId, AgentSpec>;
  /** Appended to every agent's system prompt. */
  INTEGRITY_POLICY: string;
  /** Model ids the gateway accepts from configuration. */
  ALLOWED_MODELS: readonly string[];
  DEFAULT_MODEL: string;
  /**
   * Pure function of the environment (no network, no file access, no client construction).
   *   SHAHEEN_AI_MODE=mock|live           default: live when ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is set, else unconfigured
   *   SHAHEEN_MODEL                       must be in ALLOWED_MODELS, else throws
   *   PORT (8787) · HOST (127.0.0.1)
   *   SHAHEEN_ALLOWED_ORIGINS             comma separated; '*' is rejected (throws)
   *   SHAHEEN_TRUST_PROXY=1
   *   SHAHEEN_RATE_CAPACITY (20) · SHAHEEN_RATE_REFILL (0.5 per second)
   *   SHAHEEN_RELEASE_PUBKEY              base64 public key to pin
   *   SHAHEEN_ALLOW_UNSIGNED=1            permit serving a build without a valid manifest (development only)
   * `llm` and `release` are left null; main.ts fills them in.
   */
  loadConfigFromEnv(env: Record<string, string | undefined>): ServerConfig;
  /** Recomputes every hash under staticDir and checks the manifest signature (see shared/release.ts). */
  verifyRelease(staticDir: string, pinnedPublicKey?: string | null): Promise<ReleaseStatus>;
}
