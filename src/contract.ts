/**
 * Front-end contract: how feature modules plug into the shell and reach the kernel.
 *
 * FROZEN: owned by the lead (graph.md → N1). Types and constants only.
 *
 * Rules every module follows (enforced by eslint.config.js and scripts/scan-security.mjs):
 *   • a module lives in src/modules/<id>/ and default-exports a ModuleDef from index.tsx;
 *   • it reaches the kernel, the AI gateway and navigation only through useModule();
 *   • it gets exactly the capabilities listed for it in MODULE_CAPABILITIES below;
 *   • it never touches localStorage / fetch / the model API directly;
 *   • figures that come from a 'demo' dataset are rendered with a demo marker.
 */
import type { ComponentType } from 'react';
import type { Capability, KernelHandle, KernelState } from '../kernel/contract.ts';
import type { AgentId, AgentInputFor, AgentResponse, GatewayErrorCode, HealthResponse } from '../shared/agents.ts';

export const MODULE_IDS = [
  'home', 'market', 'sovereign', 'org',
  'campaign', 'studio', 'investors', 'angels',
  'store', 'dao', 'tree', 'offers',
  'wallet', 'engineer', 'security',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleGroup = 'command' | 'growth' | 'ai' | 'commerce' | 'finance' | 'system';

/** What src/modules/<id>/index.tsx default-exports. */
export interface ModuleDef {
  id: ModuleId;
  Component: ComponentType;
}

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  command: 'القيادة',
  growth: 'النمو والتسويق',
  ai: 'الذكاء الاصطناعي',
  commerce: 'السوق والتجارة',
  finance: 'المالية',
  system: 'النظام',
};

/** Navigation metadata lives here so the shell can draw the menu without loading any module. */
export const MODULE_META: Record<ModuleId, { title: string; icon: string; group: ModuleGroup }> = {
  home: { title: 'الرئيسية', icon: '🏠', group: 'command' },
  sovereign: { title: 'السيادة', icon: '🏛️', group: 'command' },
  org: { title: 'الهيكل', icon: '🏗️', group: 'command' },
  campaign: { title: 'الحملة', icon: '🎯', group: 'growth' },
  studio: { title: 'استوديو الطاقة', icon: '☀️', group: 'growth' },
  investors: { title: 'المستثمرون', icon: '👑', group: 'growth' },
  tree: { title: 'الشجرة', icon: '🌳', group: 'growth' },
  offers: { title: 'العروض', icon: '💎', group: 'growth' },
  angels: { title: 'الملائكة', icon: '🤖', group: 'ai' },
  engineer: { title: 'المهندس', icon: '🔧', group: 'ai' },
  market: { title: 'السوق', icon: '💹', group: 'commerce' },
  store: { title: 'المتجر', icon: '🛍️', group: 'commerce' },
  dao: { title: 'الحوكمة', icon: '🗳️', group: 'commerce' },
  wallet: { title: 'المحفظة والبنك', icon: '🏦', group: 'finance' },
  security: { title: 'مركز الأمان', icon: '🛡️', group: 'system' },
};

/**
 * The access policy. Capabilities are assigned here — by the lead-owned contract — and not
 * declared by the modules themselves, so a module cannot widen its own access.
 */
export const MODULE_CAPABILITIES: Record<ModuleId, readonly Capability[]> = {
  home: [],
  market: [],
  sovereign: [],
  org: [],
  campaign: ['ai:invoke:campaign'],
  studio: ['ai:invoke:analyst', 'ai:invoke:strategy', 'ai:invoke:creative', 'ai:invoke:pitch', 'ai:invoke:outreach'],
  investors: [],
  angels: [
    'ai:invoke:angel:atlas', 'ai:invoke:angel:mercury', 'ai:invoke:angel:helios',
    'ai:invoke:angel:nexus', 'ai:invoke:angel:hermes', 'ai:invoke:angel:aegis',
    'ai:invoke:angel:aria', 'ai:invoke:angel:oracle', 'ai:invoke:angel:kronos',
  ],
  store: [],
  dao: [],
  tree: [],
  offers: [],
  wallet: ['vault:read:bank', 'vault:write:bank'],
  engineer: ['ai:invoke:engineer'],
  security: ['audit:read', 'kernel:admin'],
};

export type AiErrorCode = GatewayErrorCode | 'NETWORK' | 'DENIED' | 'BAD_RESPONSE';

/** Shape of `AiError` (a class exported by the shell). `message` is Arabic and safe to display. */
export interface AiErrorShape extends Error {
  readonly code: AiErrorCode;
}

export interface AiClient {
  /**
   * Calls the gateway. Rejects with AiError. Checks `ai:invoke:<agentId>` on the module's
   * kernel handle first, so a module can only reach agents it declared.
   */
  invoke<A extends AgentId>(agentId: A, input: AgentInputFor<A>, opts?: { signal?: AbortSignal }): Promise<AgentResponse>;
  health(): Promise<HealthResponse>;
}

export interface ModuleContext {
  moduleId: ModuleId;
  kernel: KernelHandle;
  kernelState: KernelState;
  ai: AiClient;
  navigate(to: ModuleId): void;
  /** Opens the shell's create-passphrase / unlock dialog. */
  requestUnlock(): void;
  /** Shows a counter on this module's navigation entry (null clears it). */
  setBadge(count: number | null): void;
}

/** Simulated market feed (random walk). Not real prices. */
export interface MarketSim {
  simulated: true;
  shnPrice: number;
  shnChangePct: number;
  shnHistory: { t: number; v: number }[];
  btcPrice: number;
  ethPrice: number;
  btcHistory: { t: number; v: number }[];
  ethHistory: { t: number; v: number }[];
}
