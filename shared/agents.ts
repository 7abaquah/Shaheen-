/**
 * AI agent catalogue shared by the browser client and the gateway.
 * FROZEN: owned by the lead (graph.md → N1). Types and constants only.
 *
 * The browser sends an agent id plus typed parameters. Prompts live on the server; the
 * browser can never supply a system prompt, a model name, or a free-form prompt template.
 */

export const PIPELINE_AGENT_IDS = ['analyst', 'strategy', 'creative', 'pitch', 'outreach'] as const;
export type PipelineAgentId = (typeof PIPELINE_AGENT_IDS)[number];

export const ANGEL_IDS = ['atlas', 'mercury', 'helios', 'nexus', 'hermes', 'aegis', 'aria', 'oracle', 'kronos'] as const;
export type AngelId = (typeof ANGEL_IDS)[number];

export type AgentId = 'campaign' | PipelineAgentId | `angel:${AngelId}` | 'engineer';

export const AGENT_IDS: readonly AgentId[] = [
  'campaign',
  ...PIPELINE_AGENT_IDS,
  ...ANGEL_IDS.map((id): AgentId => `angel:${id}`),
  'engineer',
];

export const LIMITS = {
  /** Campaign title. */
  titleMax: 120,
  /** Free text passed between pipeline stages (analysis, strategy). */
  textMax: 4000,
  chatMessages: 16,
  chatMessageMax: 2000,
  /** Whole request body, bytes. */
  maxBodyBytes: 32 * 1024,
  selectionMax: 12,
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** `sectors`, `investors`, `platforms`, `mediaType` are ids from shared/catalog.json; `goal` / `tone` are exact catalogue strings. */
export interface AgentInputs {
  campaign: { platforms: string[]; goal: string; tone: string };
  analyst: { sectors: string[]; investors: string[]; title: string };
  strategy: { sectors: string[]; investors: string[]; analysis: string };
  creative: { mediaType: string; title: string; sectors: string[]; investors: string[] };
  pitch: { sectors: string[]; investors: string[]; strategy: string };
  outreach: { investors: string[] };
  engineer: { messages: ChatMessage[] };
  /** `brief: true` asks for the short "broadcast" reply. */
  angel: { messages: ChatMessage[]; brief?: boolean };
}

export type AgentInputFor<A extends AgentId> = A extends `angel:${string}` ? AgentInputs['angel'] : A extends keyof AgentInputs ? AgentInputs[A] : never;

export interface CampaignResult {
  headline: string;
  tagline: string;
  summary: string;
  /** Keyed by platform id; only requested platforms. */
  platforms: Record<string, { post: string; visual: string }>;
  cta: string;
  kpis: string[];
}

export type AgentOutput = { kind: 'text'; text: string } | { kind: 'json'; value: CampaignResult };

export interface AgentResponse {
  agentId: AgentId;
  model: string;
  /** 'mock' responses are canned text, not model output. */
  mode: 'live' | 'mock';
  output: AgentOutput;
  /** True when the model stopped at the token limit. */
  truncated: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

export type GatewayErrorCode =
  | 'BAD_REQUEST'
  | 'UNKNOWN_AGENT'
  | 'METHOD_NOT_ALLOWED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'FORBIDDEN_ORIGIN'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'REFUSED'
  | 'BAD_MODEL_OUTPUT'
  | 'UPSTREAM'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'INTERNAL';

export interface ErrorResponse {
  error: { code: GatewayErrorCode; message: string };
}

export interface HealthResponse {
  ok: true;
  mode: 'live' | 'mock' | 'unconfigured';
  agents: number;
  release: { verified: boolean; signed: boolean; dev: boolean };
}
