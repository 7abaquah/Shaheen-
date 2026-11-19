// FROZEN evaluator (graph.md → N1) for node N4 (shell + UI kit). Do not edit from an implementation node.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { MODULE_META, type ModuleDef } from '@/contract';
import { AVAILABLE_MODULES } from '@/modules/registry';
import * as shell from '@/shell/api';
import { createBrowserStorage } from '@/shell/storage';
import { renderModule } from '@/shell/testing';
import * as ui from '@/ui';
import { STORAGE_KEYS } from '@kernel';
import { catalog } from '@shared/catalog';

const PASS = 'correct horse battery staple — شاهين';

describe('UI kit (@/ui)', () => {
  it('exports the shared building blocks', () => {
    for (const name of ['Card', 'SectionTitle', 'Chip', 'Button', 'TextInput', 'SelectInput', 'StatBox', 'TypeWriter', 'DemoBadge', 'AiBadge', 'LogPanel', 'Modal', 'CopyButton', 'ProgressBar', 'ErrorNote']) {
      expect(typeof (ui as Record<string, unknown>)[name], `@/ui is missing ${name}`).toBe('function');
    }
    expect(typeof ui.T.gold).toBe('string');
    expect(typeof ui.T.font).toBe('string');
  });

  it('Button and Chip are real buttons that forward data attributes', () => {
    const onClick = vi.fn();
    render(
      <>
        <ui.Button data-testid="go" onClick={onClick}>انطلق</ui.Button>
        <ui.Button data-testid="off" onClick={onClick} disabled>معطّل</ui.Button>
        <ui.Chip data-testid="chip" active onClick={onClick}>خيار</ui.Chip>
      </>,
    );
    expect(screen.getByTestId('go').tagName).toBe('BUTTON');
    expect(screen.getByTestId('chip').tagName).toBe('BUTTON');
    expect(screen.getByTestId('chip').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('go'));
    fireEvent.click(screen.getByTestId('off'));
    fireEvent.click(screen.getByTestId('chip'));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('TextInput and SelectInput are labelled, controlled fields', () => {
    function Form() {
      const [text, setText] = useState('');
      const [bank, setBank] = useState('');
      return (
        <>
          <ui.TextInput data-testid="t" label="رقم IBAN" value={text} onChange={setText} placeholder="SA.." />
          <ui.SelectInput data-testid="s" label="البنك" value={bank} onChange={setBank} options={['أ', 'ب']} placeholder="اختر" />
          <output data-testid="o">{text}|{bank}</output>
        </>
      );
    }
    render(<Form />);
    expect(screen.getByLabelText('رقم IBAN')).toBe(screen.getByTestId('t'));
    expect(screen.getByLabelText('البنك')).toBe(screen.getByTestId('s'));
    fireEvent.change(screen.getByTestId('t'), { target: { value: 'SA03' } });
    fireEvent.change(screen.getByTestId('s'), { target: { value: 'ب' } });
    expect(screen.getByTestId('o').textContent).toBe('SA03|ب');
  });

  it('marks demo and AI content', () => {
    render(
      <>
        <ui.DemoBadge />
        <ui.AiBadge mode="live" />
        <ui.AiBadge mode="mock" />
      </>,
    );
    expect(screen.getByTestId('demo-badge').textContent).toContain('تجريبي');
    const badges = screen.getAllByTestId('ai-badge');
    expect(badges[0]?.textContent).toContain('الذكاء الاصطناعي');
    expect(badges[1]?.textContent).toContain('تجريبي');
    expect(badges[0]?.getAttribute('data-mode')).toBe('live');
    expect(badges[1]?.getAttribute('data-mode')).toBe('mock');
  });

  it('TypeWriter shows the whole text at once under reduced motion', () => {
    render(<div data-testid="tw"><ui.TypeWriter text="نص كامل يظهر فوراً" /></div>);
    expect(screen.getByTestId('tw').textContent).toContain('نص كامل يظهر فوراً');
  });

  it('Modal is an accessible dialog that closes on Escape', () => {
    const onClose = vi.fn();
    render(<ui.Modal title="حوار" onClose={onClose}><p>محتوى</p></ui.Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('محتوى')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ErrorNote is announced; StatBox, ProgressBar, LogPanel and CopyButton render', () => {
    render(
      <>
        <ui.ErrorNote>تعذّر الاتصال</ui.ErrorNote>
        <ui.StatBox label="حملات" value="17" />
        <ui.ProgressBar pct={40} />
        <ui.LogPanel lines={[{ text: 'سطر أول' }, { text: 'سطر ثان', color: '#fff', time: '10:00' }]} busy />
        <ui.CopyButton text="انسخني" />
        <ui.Card><ui.SectionTitle>عنوان</ui.SectionTitle></ui.Card>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('تعذّر الاتصال');
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('سطر ثان')).toBeTruthy();
    expect(screen.getByText('عنوان')).toBeTruthy();
  });
});

describe('browser storage adapter', () => {
  it('implements the kernel StorageAdapter over localStorage', async () => {
    const a = createBrowserStorage();
    await a.set('shaheen/v1/rec/x/2', 'two');
    await a.set('shaheen/v1/rec/x/1', 'one');
    await a.set('shaheen/v1/header', 'h');
    expect(await a.get('shaheen/v1/rec/x/1')).toBe('one');
    expect(await a.get('missing')).toBeNull();
    expect(await a.keys('shaheen/v1/rec/')).toEqual(['shaheen/v1/rec/x/1', 'shaheen/v1/rec/x/2']);
    expect((await a.keys('')).length).toBe(3);
    await a.delete('shaheen/v1/rec/x/1');
    expect(await a.keys('shaheen/v1/rec/')).toEqual(['shaheen/v1/rec/x/2']);
    // A second adapter sees the same data; unrelated localStorage keys are invisible to it.
    localStorage.setItem('someone-else', '1');
    const b = createBrowserStorage();
    expect(await b.get('shaheen/v1/header')).toBe('h');
    expect(await b.keys('')).not.toContain('someone-else');
  });
});

describe('module host (renderModule)', () => {
  const probe = (Component: ModuleDef['Component']): ModuleDef => ({ id: 'home', Component });

  it('gives a module its context', async () => {
    const r = await renderModule(probe(() => {
      const m = shell.useModule();
      return <p data-testid="ctx">{m.moduleId}|{m.kernelState}|{m.kernel.moduleId}</p>;
    }));
    expect(r.getByTestId('ctx').textContent).toBe('home|unlocked|home');
    expect(r.kernel.state).toBe('unlocked');
  });

  it('can start locked or uninitialised and counts unlock requests', async () => {
    const Probe = () => {
      const m = shell.useModule();
      return <button data-testid="ask" onClick={m.requestUnlock}>{m.kernelState}</button>;
    };
    const locked = await renderModule(probe(Probe), { vault: 'locked' });
    expect(locked.getByTestId('ask').textContent).toBe('locked');
    fireEvent.click(locked.getByTestId('ask'));
    expect(locked.unlockRequests).toBe(1);
    locked.unmount();
    const empty = await renderModule(probe(Probe), { vault: 'uninitialized' });
    expect(empty.getByTestId('ask').textContent).toBe('uninitialized');
  });

  it('refuses AI agents the module was not granted, before any request is made', async () => {
    const Probe = () => {
      const m = shell.useModule();
      const [out, setOut] = useState('');
      const call = () => {
        m.ai.invoke('campaign', { platforms: ['twitter'], goal: catalog.campaignGoals[0] as string, tone: catalog.campaignTones[0] as string })
          .then((res) => setOut(`ok:${res.agentId}:${res.mode}`))
          .catch((e: unknown) => setOut(`err:${e instanceof shell.AiError ? e.code : 'not-an-AiError'}`));
      };
      return <button data-testid="call" onClick={call}>{out}</button>;
    };
    const denied = await renderModule(probe(Probe), { capabilities: [] });
    fireEvent.click(denied.getByTestId('call'));
    await waitFor(() => expect(denied.getByTestId('call').textContent).toBe('err:DENIED'));
    expect(denied.aiCalls).toEqual([]);
    denied.unmount();

    const allowed = await renderModule(probe(Probe), { capabilities: ['ai:invoke:campaign'] });
    fireEvent.click(allowed.getByTestId('call'));
    await waitFor(() => expect(allowed.getByTestId('call').textContent).toBe('ok:campaign:mock'));
    expect(allowed.aiCalls.length).toBe(1);
    expect(allowed.aiCalls[0]?.agentId).toBe('campaign');
  });

  it('routes vault access through the module handle', async () => {
    const Probe = () => {
      const m = shell.useModule();
      const [out, setOut] = useState('');
      const run = () => {
        void (async () => {
          try {
            await m.kernel.vault.put('bank', 'primary', { iban: 'SA0380000000608010167519' });
            setOut(JSON.stringify(await m.kernel.vault.get('bank', 'primary')));
          } catch (e) {
            setOut(`err:${(e as { code?: string }).code ?? 'unknown'}`);
          }
        })();
      };
      return <button data-testid="run" onClick={run}>{out}</button>;
    };
    const ok = await renderModule(probe(Probe), { capabilities: ['vault:read:bank', 'vault:write:bank'] });
    fireEvent.click(ok.getByTestId('run'));
    await waitFor(() => expect(ok.getByTestId('run').textContent).toContain('SA0380000000608010167519'));
    expect(await ok.handle.vault.get('bank', 'primary')).toEqual({ iban: 'SA0380000000608010167519' });
    ok.unmount();

    const no = await renderModule(probe(Probe), { capabilities: [] });
    fireEvent.click(no.getByTestId('run'));
    await waitFor(() => expect(no.getByTestId('run').textContent).toBe('err:DENIED'));
  });

  it('records navigation and badges, and keeps session state', async () => {
    const Probe = () => {
      const m = shell.useModule();
      const [n, setN] = shell.useSessionState<number>('count', 0);
      return (
        <>
          <button data-testid="nav" onClick={() => m.navigate('wallet')}>nav</button>
          <button data-testid="badge" onClick={() => m.setBadge(3)}>badge</button>
          <button data-testid="inc" onClick={() => setN((v) => v + 1)}>{n}</button>
        </>
      );
    };
    const r = await renderModule(probe(Probe));
    fireEvent.click(r.getByTestId('nav'));
    fireEvent.click(r.getByTestId('badge'));
    fireEvent.click(r.getByTestId('inc'));
    fireEvent.click(r.getByTestId('inc'));
    expect(r.navigations).toEqual(['wallet']);
    expect(r.badges).toEqual([3]);
    expect(r.getByTestId('inc').textContent).toBe('2');
  });

  it('contains a crashing module instead of taking the app down', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await renderModule(probe(() => {
      throw new Error('boom: secret-internal-detail');
    }));
    expect(r.getByTestId('module-error')).toBeTruthy();
    expect(r.container.textContent).not.toContain('secret-internal-detail');
    spy.mockRestore();
  });

  it('exposes the simulated market feed, labelled as simulated', async () => {
    const r = await renderModule(probe(() => {
      const sim = shell.useMarketSim();
      return <p data-testid="sim">{String(sim.simulated)}|{sim.shnHistory.length >= 2 ? 'h' : ''}|{sim.shnPrice > 0 && sim.btcPrice > 0 && sim.ethPrice > 0 ? 'p' : ''}</p>;
    }));
    expect(r.getByTestId('sim').textContent).toBe('true|h|p');
  });
});

describe('App shell', () => {
  it('boots the kernel, shows the demo notice and one nav entry per installed module', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('kernel-status').getAttribute('data-state')).toBe('uninitialized'), { timeout: 15000 });
    expect(screen.getByTestId('demo-notice').textContent).toMatch(/تجريبي|محاكاة/);
    expect(document.documentElement.querySelector('style')).toBeNull();
    for (const id of AVAILABLE_MODULES) {
      expect(screen.getByTestId(`nav-${id}`).textContent).toContain(MODULE_META[id].title);
    }
    expect(screen.queryAllByTestId(/^nav-/).length).toBe(AVAILABLE_MODULES.length);
  });

  it('creates, locks and unlocks the vault from the top bar', async () => {
    render(<App />);
    const status = () => screen.getByTestId('kernel-status').getAttribute('data-state');
    await waitFor(() => expect(status()).toBe('uninitialized'), { timeout: 15000 });

    fireEvent.click(screen.getByTestId('vault-control'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('passphrase-input'), { target: { value: 'short' } });
    fireEvent.change(within(dialog).getByTestId('passphrase-confirm'), { target: { value: 'short' } });
    fireEvent.click(within(dialog).getByTestId('passphrase-submit'));
    expect((await screen.findByTestId('passphrase-error')).textContent?.length).toBeGreaterThan(0);
    expect(status()).toBe('uninitialized');

    fireEvent.change(screen.getByTestId('passphrase-input'), { target: { value: PASS } });
    fireEvent.change(screen.getByTestId('passphrase-confirm'), { target: { value: PASS + 'x' } });
    fireEvent.click(screen.getByTestId('passphrase-submit'));
    await screen.findByTestId('passphrase-error');
    expect(status()).toBe('uninitialized');

    fireEvent.change(screen.getByTestId('passphrase-confirm'), { target: { value: PASS } });
    fireEvent.click(screen.getByTestId('passphrase-submit'));
    await waitFor(() => expect(status()).toBe('unlocked'), { timeout: 15000 });
    expect(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith(STORAGE_KEYS.header)) ?? '')).toBeTruthy();
    expect(JSON.stringify({ ...localStorage })).not.toContain(PASS);

    fireEvent.click(screen.getByTestId('vault-control'));
    await waitFor(() => expect(status()).toBe('locked'), { timeout: 15000 });

    fireEvent.click(screen.getByTestId('vault-control'));
    const again = await screen.findByRole('dialog');
    expect(within(again).queryByTestId('passphrase-confirm')).toBeNull();
    fireEvent.change(within(again).getByTestId('passphrase-input'), { target: { value: 'the wrong passphrase!!' } });
    fireEvent.click(within(again).getByTestId('passphrase-submit'));
    await screen.findByTestId('passphrase-error');
    expect(status()).toBe('locked');

    fireEvent.change(screen.getByTestId('passphrase-input'), { target: { value: PASS } });
    fireEvent.click(screen.getByTestId('passphrase-submit'));
    await waitFor(() => expect(status()).toBe('unlocked'), { timeout: 15000 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
