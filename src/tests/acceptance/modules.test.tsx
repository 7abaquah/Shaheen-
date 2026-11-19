// FROZEN evaluator (graph.md → N1) for nodes N5–N7 (feature modules). Do not edit from an implementation node.
//
// Every test title starts with "module: <id>" so a node's gate can select its own modules:
//   vitest run src/tests/acceptance/modules.test.tsx -t "module: (campaign|studio|investors) "
import { fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MODULE_IDS, type ModuleId } from '@/contract';
import { AVAILABLE_MODULES, loadModule } from '@/modules/registry';
import { AiError } from '@/shell/api';
import { renderModule, type RenderModuleOptions, type RenderedModule } from '@/shell/testing';
import { STORAGE_KEYS, maskIban, type AuditEntry } from '@kernel';
import { ANGEL_IDS, LIMITS, PIPELINE_AGENT_IDS, type AgentId, type AgentResponse, type CampaignResult } from '@shared/agents';
import { catalog } from '@shared/catalog';

const at = <T,>(list: readonly T[], i: number): T => {
  const v = list[i];
  if (v === undefined) throw new Error(`catalogue entry ${i} missing`);
  return v;
};

async function open(id: ModuleId, options?: RenderModuleOptions): Promise<RenderedModule> {
  return renderModule(await loadModule(id), options);
}

const reply = (agentId: AgentId, text: string): AgentResponse => ({
  agentId, model: 'test-model', mode: 'mock', output: { kind: 'text', text }, truncated: false, usage: { inputTokens: 1, outputTokens: 1 },
});
const campaignReply = (platforms: string[]): AgentResponse => {
  const value: CampaignResult = {
    headline: 'عنوان الاختبار', tagline: 'شعار الاختبار', summary: 'ملخص الاختبار',
    platforms: Object.fromEntries(platforms.map((p) => [p, { post: `منشور ${p}`, visual: `بصري ${p}` }])),
    cta: 'انضم', kpis: ['مؤشر أ', 'مؤشر ب', 'مؤشر ج'],
  };
  return { agentId: 'campaign', model: 'test-model', mode: 'mock', output: { kind: 'json', value }, truncated: false, usage: { inputTokens: 1, outputTokens: 1 } };
};

const MARKERS: Record<ModuleId, string[]> = {
  home: [at(catalog.dashboardStats, 0).label, 'SHN'],
  market: [at(catalog.tokenAllocation, 0).label, at(catalog.contractInfo, 0).label],
  sovereign: [at(catalog.layers, 0).labelAr, at(catalog.layers, 6).labelAr],
  org: [at(catalog.divisions, 0).title, at(at(catalog.divisions, 0).agents, 0).name, at(catalog.orgSummary, 0).label],
  campaign: [at(catalog.platforms, 0).name, at(catalog.campaignGoals, 0), at(catalog.campaignTones, 0)],
  studio: [at(catalog.sectors, 0).label, at(catalog.mediaTypes, 0).label],
  investors: [at(catalog.investorProfiles, 0).name, at(catalog.sectors, 0).market],
  angels: [at(catalog.angels, 0).name, at(catalog.angels, 8).name],
  store: [at(catalog.products, 0).name, at(catalog.products, 11).name],
  dao: [at(catalog.proposals, 0).title],
  tree: [at(catalog.referralTree.children, 0).name, at(catalog.commissionLevels, 0).level, catalog.referralCode],
  offers: [at(catalog.offerTiers, 0).tier, at(catalog.referralSteps, 0).text],
  wallet: [at(catalog.walletTransactions, 0).type, at(catalog.walletTokenStats, 0).label],
  engineer: [at(catalog.bugRegistry, 0).id, at(catalog.bugRegistry, 11).id],
  security: ['ML-KEM-768', 'ML-DSA-65', 'AES-256-GCM', 'PBKDF2'],
};

/** Modules that display illustrative figures and therefore must carry a demo marker. */
const DEMO_MODULES: ModuleId[] = ['home', 'market', 'sovereign', 'org', 'studio', 'investors', 'store', 'dao', 'tree', 'offers', 'wallet'];
/** Modules that display the simulated price feed. */
const SIM_MODULES: ModuleId[] = ['home', 'market'];

const ABSOLUTE_CLAIMS = /غير قابل(?:ة)? للاختراق|unhackable|unbreakable|آمن(?:ة)? 100%|100% آمن(?:ة)?|سليم 100%|military[- ]grade|مضمون(?:ة)? 100%/i;
const OLD_FALSE_CLAIMS = /تحويل تلقائي خلال 24 ساعة|ستصل مدفوعاتك تلقائياً/;

describe.each(MODULE_IDS)('module: %s — renders', (id) => {
  it('loads, renders its content and follows the page rules', async () => {
    const r = await open(id);
    await waitFor(() => {
      for (const marker of MARKERS[id]) expect(r.container.textContent, `missing "${marker}"`).toContain(marker);
    }, { timeout: 15000 });

    if (DEMO_MODULES.includes(id)) expect(r.queryAllByTestId('demo-badge').length, 'demo figures need a demo marker').toBeGreaterThan(0);
    if (SIM_MODULES.includes(id)) expect(r.queryAllByTestId('sim-badge').length, 'simulated prices need a simulation marker').toBeGreaterThan(0);

    expect(r.container.querySelector('style, script, iframe, object, embed')).toBeNull();
    expect(r.container.textContent ?? '').not.toMatch(ABSOLUTE_CLAIMS);
    expect(r.container.textContent ?? '').not.toMatch(OLD_FALSE_CLAIMS);
    for (const button of r.container.querySelectorAll('button')) {
      const name = (button.getAttribute('aria-label') ?? button.textContent ?? '').trim();
      expect(name.length, `a button has no accessible name: ${button.outerHTML.slice(0, 120)}`).toBeGreaterThan(0);
    }
    for (const input of r.container.querySelectorAll('input, select, textarea')) {
      const labelled = input.getAttribute('aria-label') ?? input.getAttribute('aria-labelledby') ?? (input.id ? r.container.querySelector(`label[for="${input.id}"]`)?.textContent : null);
      expect(labelled, `a form field has no label: ${input.outerHTML.slice(0, 120)}`).toBeTruthy();
    }
    expect(r.aiCalls, 'no AI call may happen just by opening a module').toEqual([]);
  });
});

// ── campaign ────────────────────────────────────────────────────────────────
describe('module: campaign — behaviour', () => {
  const goals = catalog.campaignGoals;
  const tones = catalog.campaignTones;
  const ai: RenderModuleOptions['ai'] = (_id, input) => campaignReply((input as { platforms: string[] }).platforms);

  it('sends the default selection to the campaign agent and shows the result as AI output', async () => {
    const r = await open('campaign', { ai });
    fireEvent.click(r.getByTestId('campaign-launch'));
    await waitFor(() => expect(r.getByTestId('campaign-headline').textContent).toContain('عنوان الاختبار'));
    expect(r.aiCalls).toEqual([{ agentId: 'campaign', input: { platforms: ['twitter', 'telegram'], goal: at(goals, 0), tone: at(tones, 0) } }]);
    expect(r.getByTestId('campaign-post-twitter').textContent).toContain('منشور twitter');
    expect(r.getByTestId('campaign-post-telegram').textContent).toContain('منشور telegram');
    expect(r.container.textContent).toContain('مؤشر ب');
    expect(r.queryAllByTestId('ai-badge').length).toBeGreaterThan(0);
  });

  it('uses the platforms, goal and tone the user picked', async () => {
    const r = await open('campaign', { ai });
    fireEvent.click(r.getByTestId('platform-twitter'));
    fireEvent.click(r.getByTestId('platform-youtube'));
    fireEvent.click(r.getByTestId('goal-1'));
    fireEvent.click(r.getByTestId('tone-2'));
    fireEvent.click(r.getByTestId('campaign-launch'));
    await waitFor(() => expect(r.aiCalls.length).toBe(1));
    expect(r.aiCalls[0]?.input).toEqual({ platforms: ['telegram', 'youtube'], goal: at(goals, 1), tone: at(tones, 2) });
    await r.findByTestId('campaign-post-youtube');
    expect(r.queryByTestId('campaign-post-twitter')).toBeNull();
  });

  it('cannot launch without a platform', async () => {
    const r = await open('campaign', { ai });
    fireEvent.click(r.getByTestId('platform-twitter'));
    fireEvent.click(r.getByTestId('platform-telegram'));
    expect((r.getByTestId('campaign-launch') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(r.getByTestId('campaign-launch'));
    expect(r.aiCalls).toEqual([]);
  });

  it('shows a readable error and recovers when the gateway fails', async () => {
    let fail = true;
    const r = await open('campaign', {
      ai: (id, input) => {
        if (fail) throw new AiError('RATE_LIMITED', 'تم تجاوز حد الطلبات، حاول بعد قليل');
        return ai(id, input);
      },
    });
    fireEvent.click(r.getByTestId('campaign-launch'));
    await waitFor(() => expect(r.getByRole('alert').textContent).toContain('تم تجاوز حد الطلبات'));
    expect(r.queryByTestId('campaign-headline')).toBeNull();
    fail = false;
    fireEvent.click(r.getByTestId('campaign-launch'));
    await r.findByTestId('campaign-headline');
    expect(r.queryByRole('alert')).toBeNull();
  });
});

// ── studio ──────────────────────────────────────────────────────────────────
describe('module: studio — behaviour', () => {
  const TITLE = 'مستقبل نظيف — شاهين للطاقة المتجددة';

  it('runs the five agents in order, feeding each stage from the previous one', async () => {
    const r = await open('studio', { ai: (id) => reply(id, `مخرجات ${id}`) });
    fireEvent.click(r.getByTestId('studio-launch'));
    await r.findByTestId('studio-done', {}, { timeout: 15000 });
    expect(r.aiCalls.map((c) => c.agentId)).toEqual([...PIPELINE_AGENT_IDS]);
    const sectors = ['solar', 'recycle'];
    const investors = ['inv-1', 'inv-3'];
    expect(r.aiCalls.map((c) => c.input)).toEqual([
      { sectors, investors, title: TITLE },
      { sectors, investors, analysis: 'مخرجات analyst' },
      { mediaType: 'video_script', title: TITLE, sectors, investors },
      { sectors, investors, strategy: 'مخرجات strategy' },
      { investors },
    ]);

    fireEvent.click(r.getByTestId('studio-tab-results'));
    await waitFor(() => expect(r.getByTestId('studio-output').textContent).toContain('مخرجات analyst'));
    fireEvent.click(r.getByTestId('studio-result-outreach'));
    await waitFor(() => expect(r.getByTestId('studio-output').textContent).toContain('مخرجات outreach'));
    expect(r.queryAllByTestId('ai-badge').length).toBeGreaterThan(0);
  });

  it('uses the chosen title, sectors, media type and investor groups, and caps hand-over text', async () => {
    const long = 'ت'.repeat(LIMITS.textMax + 500);
    const r = await open('studio', { ai: (id) => reply(id, id === 'analyst' ? long : `مخرجات ${id}`) });
    fireEvent.change(r.getByTestId('studio-title'), { target: { value: 'عنوان جديد' } });
    fireEvent.click(r.getByTestId('sector-wind'));
    fireEvent.click(r.getByTestId('media-press'));
    fireEvent.click(r.getByTestId('studio-tab-investors'));
    fireEvent.click(await r.findByTestId('investor-inv-2'));
    fireEvent.click(r.getByTestId('studio-tab-studio'));
    fireEvent.click(await r.findByTestId('studio-launch'));
    await r.findByTestId('studio-done', {}, { timeout: 15000 });
    const sectors = ['solar', 'recycle', 'wind'];
    const investors = ['inv-1', 'inv-3', 'inv-2'];
    expect(r.aiCalls[0]?.input).toEqual({ sectors, investors, title: 'عنوان جديد' });
    expect(r.aiCalls[1]?.input).toEqual({ sectors, investors, analysis: long.slice(0, LIMITS.textMax) });
    expect(r.aiCalls[2]?.input).toEqual({ mediaType: 'press', title: 'عنوان جديد', sectors, investors });
  });

  it('stops at the failing stage, reports it, and keeps the outputs it already has', async () => {
    const r = await open('studio', {
      ai: (id) => {
        if (id === 'creative') throw new AiError('UPSTREAM', 'تعذّر الوصول إلى خدمة الذكاء الاصطناعي');
        return reply(id, `مخرجات ${id}`);
      },
    });
    fireEvent.click(r.getByTestId('studio-launch'));
    await waitFor(() => expect(r.getByRole('alert').textContent).toContain('تعذّر الوصول'), { timeout: 15000 });
    expect(r.aiCalls.map((c) => c.agentId)).toEqual(['analyst', 'strategy', 'creative']);
    expect(r.queryByTestId('studio-done')).toBeNull();
    fireEvent.click(r.getByTestId('studio-tab-results'));
    await waitFor(() => expect(r.getByTestId('studio-output').textContent).toContain('مخرجات analyst'));
    expect((r.getByTestId('studio-tab-studio') as HTMLButtonElement).disabled).toBe(false);
  });

  it('cannot launch without a sector', async () => {
    const r = await open('studio', { ai: (id) => reply(id, 'x') });
    fireEvent.click(r.getByTestId('sector-solar'));
    fireEvent.click(r.getByTestId('sector-recycle'));
    expect((r.getByTestId('studio-launch') as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── angels ──────────────────────────────────────────────────────────────────
describe('module: angels — behaviour', () => {
  it('chats with one angel and sends only real conversation turns', async () => {
    const r = await open('angels', { ai: (id) => reply(id, `رد ${id}`) });
    fireEvent.click(r.getByTestId('angel-card-atlas'));
    const dialog = await r.findByRole('dialog');
    expect(dialog.textContent).toContain(at(catalog.angels, 0).name);
    fireEvent.change(within(dialog).getByTestId('angel-input'), { target: { value: 'ما الخطة؟' } });
    fireEvent.click(within(dialog).getByTestId('angel-send'));
    await waitFor(() => expect(dialog.textContent).toContain('رد angel:atlas'));
    expect(r.aiCalls[0]).toEqual({ agentId: 'angel:atlas', input: { messages: [{ role: 'user', content: 'ما الخطة؟' }] } });

    fireEvent.change(within(dialog).getByTestId('angel-input'), { target: { value: 'ثم ماذا؟' } });
    fireEvent.click(within(dialog).getByTestId('angel-send'));
    await waitFor(() => expect(r.aiCalls.length).toBe(2));
    expect(r.aiCalls[1]?.input).toEqual({
      messages: [
        { role: 'user', content: 'ما الخطة؟' },
        { role: 'assistant', content: 'رد angel:atlas' },
        { role: 'user', content: 'ثم ماذا؟' },
      ],
    });
    expect(within(dialog).queryAllByTestId('ai-badge').length).toBeGreaterThan(0);
  });

  it('does not send empty messages', async () => {
    const r = await open('angels', { ai: (id) => reply(id, 'x') });
    fireEvent.click(r.getByTestId('angel-card-helios'));
    const dialog = await r.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('angel-input'), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByTestId('angel-send'));
    expect(r.aiCalls).toEqual([]);
  });

  it('broadcasts to all nine angels and carries on when one fails', async () => {
    const r = await open('angels', {
      ai: (id) => {
        if (id === 'angel:mercury') throw new AiError('UPSTREAM', 'تعذّر الوصول');
        return reply(id, `رد ${id}`);
      },
    });
    fireEvent.click(r.getByTestId('angels-broadcast'));
    const dialog = await r.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('broadcast-input'), { target: { value: 'ضاعفوا التركيز على الطاقة الشمسية' } });
    fireEvent.click(within(dialog).getByTestId('broadcast-send'));
    await waitFor(() => expect(r.aiCalls.length).toBe(9), { timeout: 15000 });
    expect(r.aiCalls.map((c) => c.agentId)).toEqual(ANGEL_IDS.map((a) => `angel:${a}`));
    for (const call of r.aiCalls) {
      expect(call.input).toEqual({ messages: [{ role: 'user', content: 'ضاعفوا التركيز على الطاقة الشمسية' }], brief: true });
    }
    await waitFor(() => expect(dialog.textContent).toContain('رد angel:kronos'), { timeout: 15000 });
    expect(dialog.textContent).toContain('رد angel:atlas');
    expect(dialog.textContent).toContain('تعذّر الوصول');
  });
});

// ── wallet + bank ───────────────────────────────────────────────────────────
describe('module: wallet — behaviour', () => {
  const VALID = 'SA03 8000 0000 6080 1016 7519';
  const COMPACT = 'SA0380000000608010167519';
  const fill = (r: RenderedModule, iban: string): void => {
    fireEvent.change(r.getByTestId('bank-name'), { target: { value: at(catalog.bankOptions, 0) } });
    fireEvent.change(r.getByTestId('bank-iban'), { target: { value: iban } });
    fireEvent.change(r.getByTestId('bank-holder'), { target: { value: 'عبدالله الشاهين' } });
    fireEvent.click(r.getByTestId('bank-next'));
  };

  it('rejects an invalid IBAN and stores nothing', async () => {
    const r = await open('wallet');
    await r.findByTestId('bank-name');
    fill(r, 'SA00 0000 0000 0000 0000 0000');
    expect((await r.findByTestId('iban-error')).textContent?.length).toBeGreaterThan(0);
    expect(r.queryByTestId('bank-confirm')).toBeNull();
    expect(await r.handle.vault.list('bank')).toEqual([]);
  });

  it('encrypts the bank record in the vault and only ever shows it masked', async () => {
    const r = await open('wallet');
    await r.findByTestId('bank-name');
    fill(r, VALID);
    fireEvent.click(await r.findByTestId('bank-confirm'));
    await r.findByTestId('bank-linked', {}, { timeout: 15000 });

    const record = await r.handle.vault.get<{ bank: string; iban: string; holder: string; linkedAt: number }>('bank', 'primary');
    expect(record).toMatchObject({ bank: at(catalog.bankOptions, 0), iban: COMPACT, holder: 'عبدالله الشاهين' });
    expect(typeof record?.linkedAt).toBe('number');

    expect(r.getByTestId('bank-masked-iban').textContent).toBe(maskIban(COMPACT));
    expect((r.container.textContent ?? '').replace(/\s/g, '')).not.toContain(COMPACT);
    const stored = (await Promise.all((await r.storage.keys('')).map((k) => r.storage.get(k)))).join('\n');
    expect(stored).not.toContain(COMPACT);
    expect(stored).not.toContain('عبدالله الشاهين');
    // Payout rows are illustrative: they must sit next to a demo marker, and promise nothing.
    expect(r.queryAllByTestId('demo-badge').length).toBeGreaterThan(0);
    expect(r.container.textContent ?? '').not.toMatch(OLD_FALSE_CLAIMS);
  });

  it('shows an existing link on return and can remove it', async () => {
    const r = await open('wallet');
    await r.handle.vault.put('bank', 'primary', { bank: at(catalog.bankOptions, 1), iban: COMPACT, holder: 'س', linkedAt: 1 });
    r.unmount();
    const again = await renderModule(await loadModule('wallet'), { reuse: r });
    await again.findByTestId('bank-linked', {}, { timeout: 15000 });
    expect(again.container.textContent).toContain(at(catalog.bankOptions, 1));
    fireEvent.click(again.getByTestId('bank-unlink'));
    await again.findByTestId('bank-name');
    await waitFor(async () => expect(await again.handle.vault.list('bank')).toEqual([]));
  });

  it('asks for the vault to be unlocked instead of showing the form', async () => {
    const r = await open('wallet', { vault: 'locked' });
    await r.findByTestId('vault-locked');
    expect(r.queryByTestId('bank-iban')).toBeNull();
    fireEvent.click(r.getByTestId('vault-unlock'));
    expect(r.unlockRequests).toBe(1);
  });
});

// ── engineer ────────────────────────────────────────────────────────────────
describe('module: engineer — behaviour', () => {
  it('runs the real kernel self-test instead of a scripted scan', async () => {
    const r = await open('engineer');
    fireEvent.click(r.getByTestId('selftest-run'));
    const result = await r.findByTestId('selftest-result', {}, { timeout: 15000 });
    expect(result.getAttribute('data-ok')).toBe('true');
    for (const id of ['csprng', 'sha-256', 'aes-256-gcm', 'pbkdf2-sha-256', 'ml-kem-768-x25519', 'ml-dsa-65']) {
      expect(result.textContent).toContain(id);
    }
    expect(r.container.textContent ?? '').not.toMatch(ABSOLUTE_CLAIMS);
  });

  it('chats with the engineer agent and offers the suggested questions', async () => {
    const r = await open('engineer', { ai: (id) => reply(id, 'جواب المهندس') });
    fireEvent.click(r.getByTestId('engineer-suggestion-0'));
    expect((r.getByTestId('engineer-input') as HTMLInputElement).value).toBe(at(catalog.engineerSuggestions, 0));
    fireEvent.click(r.getByTestId('engineer-send'));
    await waitFor(() => expect(r.container.textContent).toContain('جواب المهندس'));
    expect(r.aiCalls).toEqual([{ agentId: 'engineer', input: { messages: [{ role: 'user', content: at(catalog.engineerSuggestions, 0) }] } }]);
  });
});

// ── security centre ─────────────────────────────────────────────────────────
describe('module: security — behaviour', () => {
  it('states the algorithms in use and the caveat about the post-quantum library', async () => {
    const r = await open('security');
    await waitFor(() => expect(r.getByTestId('kernel-state').getAttribute('data-state')).toBe('unlocked'));
    expect(r.getByTestId('pq-audit-caveat').textContent?.length).toBeGreaterThan(20);
    expect(r.getByTestId('security-limits').textContent?.length).toBeGreaterThan(40);
  });

  it('verifies the audit trail, signs a checkpoint and lists entries', async () => {
    const r = await open('security');
    fireEvent.click(await r.findByTestId('audit-verify'));
    await waitFor(() => expect(r.getByTestId('audit-verify-result').getAttribute('data-ok')).toBe('true'), { timeout: 15000 });
    fireEvent.click(r.getByTestId('checkpoint-run'));
    await waitFor(async () => expect((await r.storage.keys(STORAGE_KEYS.checkpointPrefix)).length).toBeGreaterThan(0), { timeout: 15000 });
    fireEvent.click(r.getByTestId('audit-verify'));
    await waitFor(() => expect(Number(r.getByTestId('audit-verify-result').getAttribute('data-signed-through'))).toBeGreaterThan(0), { timeout: 15000 });
    expect(r.queryAllByTestId('audit-entry').length).toBeGreaterThan(0);
  });

  it('reports a tampered audit trail', async () => {
    const r = await open('security');
    const key = at(await r.storage.keys(STORAGE_KEYS.auditPrefix), 0);
    const entry = JSON.parse((await r.storage.get(key)) as string) as AuditEntry;
    entry.action = 'nothing.happened';
    await r.storage.set(key, JSON.stringify(entry));
    fireEvent.click(await r.findByTestId('audit-verify'));
    await waitFor(() => expect(r.getByTestId('audit-verify-result').getAttribute('data-ok')).toBe('false'), { timeout: 15000 });
  });

  it('exports a sealed backup together with a one-time recovery key', async () => {
    const r = await open('security');
    fireEvent.click(await r.findByTestId('backup-export'));
    const envelope = await r.findByTestId('backup-envelope', {}, { timeout: 15000 });
    expect(envelope.textContent).toContain('ML-KEM-768+X25519/HKDF-SHA-256/AES-256-GCM');
    expect(r.getByTestId('backup-recovery-key').textContent?.length).toBeGreaterThan(40);
  });

  it('keeps the log readable while locked and asks to unlock for admin actions', async () => {
    const r = await open('security', { vault: 'locked' });
    await waitFor(() => expect(r.getByTestId('kernel-state').getAttribute('data-state')).toBe('locked'));
    fireEvent.click(r.getByTestId('audit-verify'));
    await waitFor(() => expect(r.getByTestId('audit-verify-result').getAttribute('data-ok')).toBe('true'), { timeout: 15000 });
    expect((r.getByTestId('checkpoint-run') as HTMLButtonElement).disabled).toBe(true);
    expect((r.getByTestId('backup-export') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(r.getByTestId('vault-unlock'));
    expect(r.unlockRequests).toBe(1);
  });
});

// ── store / dao / offers / tree / home / sovereign ──────────────────────────
describe('module: store — behaviour', () => {
  it('filters, searches, keeps a cart and reports its size to the shell', async () => {
    const r = await open('store');
    const p = catalog.products;
    fireEvent.click(r.getByTestId('category-3'));
    await waitFor(() => expect(r.container.textContent).not.toContain(at(p, 0).name));
    expect(r.container.textContent).toContain(at(p, 2).name);
    fireEvent.click(r.getByTestId('category-0'));
    fireEvent.change(r.getByTestId('store-search'), { target: { value: 'خاتم' } });
    await waitFor(() => expect(r.container.textContent).not.toContain(at(p, 2).name));
    expect(r.container.textContent).toContain(at(p, 0).name);
    expect(r.container.textContent).toContain(at(p, 10).name);
    fireEvent.change(r.getByTestId('store-search'), { target: { value: '' } });

    fireEvent.click(await r.findByTestId('add-to-cart-1'));
    fireEvent.click(r.getByTestId('add-to-cart-1'));
    fireEvent.click(r.getByTestId('add-to-cart-3'));
    await waitFor(() => expect(r.badges.at(-1)).toBe(3));
    expect(r.getByTestId('cart-total').textContent).toContain('477.00'); // 2 × 89 + 299
    fireEvent.click(r.getByTestId('cart-remove-1'));
    await waitFor(() => expect(r.badges.at(-1)).toBe(1));
    fireEvent.click(r.getByTestId('store-checkout'));
    expect((await r.findByTestId('checkout-demo-note')).textContent?.length).toBeGreaterThan(10);
    fireEvent.click(r.getByTestId('cart-remove-3'));
    await waitFor(() => expect(r.badges.at(-1)).toBeNull());
  });
});

describe('module: dao — behaviour', () => {
  it('records one vote per active proposal and adjusts the stake', async () => {
    const r = await open('dao');
    fireEvent.click(r.getByTestId('vote-for-1'));
    await r.findByTestId('voted-1');
    expect(r.queryByTestId('vote-for-1')).toBeNull();
    fireEvent.click(r.getByTestId('vote-against-2'));
    await r.findByTestId('voted-2');
    expect(r.queryByTestId('vote-for-3')).toBeNull(); // finished proposals cannot be voted on
    expect(r.getByTestId('staked-amount').textContent).toContain('10,000');
    fireEvent.click(r.getByTestId('stake-add'));
    expect(r.getByTestId('staked-amount').textContent).toContain('11,000');
    fireEvent.click(r.getByTestId('stake-remove'));
    fireEvent.click(r.getByTestId('stake-remove'));
    expect(r.getByTestId('staked-amount').textContent).toContain('9,000');
  });
});

describe('module: offers — behaviour', () => {
  it('selects a tier and sends the user to the wallet', async () => {
    const r = await open('offers');
    expect(r.queryByTestId('offer-buy')).toBeNull();
    fireEvent.click(r.getByTestId('offer-gold'));
    fireEvent.click(await r.findByTestId('offer-buy'));
    expect(r.navigations).toEqual(['wallet']);
  });
});

describe('module: tree — behaviour', () => {
  it('collapses branches and copies the referral code', async () => {
    const r = await open('tree');
    const grandchild = at(at(catalog.referralTree.children, 0).children, 0).name;
    expect(r.container.textContent).toContain(grandchild);
    fireEvent.click(r.getByTestId('tree-node-SHN-002'));
    await waitFor(() => expect(r.container.textContent).not.toContain(grandchild));
    fireEvent.click(r.getByTestId('tree-node-SHN-002'));
    await waitFor(() => expect(r.container.textContent).toContain(grandchild));
    fireEvent.click(r.getByTestId('referral-copy'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(catalog.referralCode));
  });
});

describe('module: home — behaviour', () => {
  it('navigates from quick actions and the division map', async () => {
    const r = await open('home');
    fireEvent.click(r.getByTestId('quick-campaign'));
    fireEvent.click(r.getByTestId('quick-wallet'));
    fireEvent.click(r.getByTestId('division-marketing'));
    expect(r.navigations).toEqual(['campaign', 'wallet', 'org']);
  });
});

describe('module: sovereign — behaviour', () => {
  it('shows the selected layer and the whole boot log', async () => {
    const r = await open('sovereign');
    fireEvent.click(r.getByTestId('layer-3'));
    await waitFor(() => expect(r.getByTestId('layer-detail').textContent).toContain(at(catalog.layers, 2).desc));
    expect(r.container.textContent).toContain(at(catalog.sovereignBootLog, 7).msg);
  });
});

// ── integration: selected by the N8 gate only ───────────────────────────────
describe('registry: complete', () => {
  it('has every module from the contract installed', () => {
    expect([...AVAILABLE_MODULES]).toEqual([...MODULE_IDS]);
  });
});
