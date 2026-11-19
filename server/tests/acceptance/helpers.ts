// FROZEN evaluator (graph.md → N1). Do not edit from an implementation node.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { catalog } from '../../../shared/catalog.ts';
import type { AgentId, AgentInputs } from '../../../shared/agents.ts';
import type { GatewayLogEvent, GatewayOptions, LlmClient, LlmRequest, LlmResult, ServerModule } from '../../contract.ts';
import * as impl from '../../src/index.ts';

/** Compile-time proof that the implementation exports the whole contract. */
export const api: ServerModule = impl;

export type Reply = Partial<LlmResult> | ((request: LlmRequest, signal: AbortSignal) => Partial<LlmResult> | Promise<Partial<LlmResult>>);

export function stubLlm(reply: Reply = {}): { llm: LlmClient; calls: LlmRequest[]; signals: AbortSignal[] } {
  const calls: LlmRequest[] = [];
  const signals: AbortSignal[] = [];
  const llm: LlmClient = {
    async complete(request, signal) {
      calls.push(structuredClone(request));
      signals.push(signal);
      const partial = typeof reply === 'function' ? await reply(request, signal) : reply;
      return { text: 'نص من النموذج', stopReason: 'end_turn', model: request.model, usage: { inputTokens: 11, outputTokens: 22 }, ...partial };
    },
  };
  return { llm, calls, signals };
}

export interface Running {
  url: string;
  origin: string;
  calls: LlmRequest[];
  signals: AbortSignal[];
  events: GatewayLogEvent[];
  close(): Promise<void>;
  post(agentId: string, input: unknown, init?: { headers?: Record<string, string>; extra?: Record<string, unknown>; rawBody?: string }): Promise<Response>;
  /** Raw request: the path is sent exactly as given (no client-side normalisation). */
  raw(method: string, path: string, headers?: Record<string, string>): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>;
}

export async function start(over: Partial<GatewayOptions> = {}, reply: Reply = {}): Promise<Running> {
  const stub = stubLlm(reply);
  const events: GatewayLogEvent[] = [];
  const options: GatewayOptions = {
    llm: stub.llm,
    mode: 'live',
    model: api.DEFAULT_MODEL,
    staticDir: null,
    allowedOrigins: [],
    rateLimit: { capacity: 1000, refillPerSecond: 1000 },
    trustProxy: false,
    requestTimeoutMs: 5000,
    release: null,
    log: (e) => events.push(e),
    ...over,
  };
  const gateway = api.createGateway(options);
  const server = http.createServer((req, res) => gateway.handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    origin: url,
    calls: stub.calls,
    signals: stub.signals,
    events,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); }),
    post: (agentId, input, init = {}) =>
      fetch(`${url}/api/agent/${agentId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
        body: init.rawBody ?? JSON.stringify({ input, ...(init.extra ?? {}) }),
      }),
    raw: (method, path, headers = {}) =>
      new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end();
      }),
  };
}

const sectors = catalog.sectors.slice(0, 2).map((s) => s.id);
const investors = catalog.investorProfiles.slice(0, 2).map((p) => p.id);
const platforms = catalog.platforms.slice(0, 2).map((p) => p.id);

/** A valid input for every agent kind. */
export const VALID: { [K in keyof AgentInputs]: AgentInputs[K] } = {
  campaign: { platforms, goal: catalog.campaignGoals[0] as string, tone: catalog.campaignTones[0] as string },
  analyst: { sectors, investors, title: 'مستقبل نظيف — شاهين للطاقة المتجددة' },
  strategy: { sectors, investors, analysis: 'خلاصة تحليل السوق.' },
  creative: { mediaType: catalog.mediaTypes[0]?.id as string, title: 'مستقبل نظيف', sectors, investors },
  pitch: { sectors, investors, strategy: 'خلاصة الخطة.' },
  outreach: { investors },
  engineer: { messages: [{ role: 'user', content: 'كيف أمنع تسرب الذاكرة في useEffect؟' }] },
  angel: { messages: [{ role: 'user', content: 'ما أولويات هذا الأسبوع؟' }] },
};

export function validFor(agentId: AgentId): unknown {
  if (agentId.startsWith('angel:')) return VALID.angel;
  return VALID[agentId as keyof AgentInputs];
}

export const CAMPAIGN_JSON = {
  headline: 'عنوان الحملة',
  tagline: 'شعار',
  summary: 'ملخص من ثلاث جمل.',
  platforms: Object.fromEntries(platforms.map((p) => [p, { post: `منشور ${p}`, visual: 'فكرة بصرية' }])),
  cta: 'انضم الآن',
  kpis: ['مؤشر 1', 'مؤشر 2', 'مؤشر 3'],
};

export async function errorCode(res: Response): Promise<string> {
  const body = (await res.json()) as { error?: { code?: string; message?: string } };
  if (!body.error?.code || typeof body.error.message !== 'string') throw new Error(`not an ErrorResponse: ${JSON.stringify(body)}`);
  return body.error.code;
}
