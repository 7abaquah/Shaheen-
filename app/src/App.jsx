// ============================================================================
// منظومة شاهين المتكاملة v3.0 — الحالة المركزية والهيكل والتنقل
// ============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TABS, TOKEN, DAILY_RESOURCE_CAP_USD, PAYMENT_RAILS } from './config.js';
import {
  initialState, loadState, saveState, clearState, simulationTick, evaluateDealGovernance,
  matchOrder, quotePresale, playFalconCry, uid, clockTime, nowStamp, fmt, fmtPrice,
  sarToUsdt, usdtToSar,
} from './engine.js';
import { Icon, Button, SimBadge, INPUT, Field, Notice, cls } from './ui.jsx';
import { HomeTab, GovernanceTab, MarketTab, ComputeTab, SubscribersTab, PaymentsTab, SystemTab } from './tabs.jsx';
import { UnitsTab, makeProxySample } from './units.jsx';
import { WalletProvider } from './wallet.jsx';
import { WalletTab } from './wallet-tab.jsx';
import { JoinTab } from './join.jsx';

const TAB_IDS = TABS.map((t) => t.id);
const readHash = () => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace('#', '');
  return TAB_IDS.includes(h) ? h : 'home';
};
const plusDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function App({ logoSrc = 'logo.svg', markSrc = 'mark.svg' }) {
  const [state, setState] = useState(() => loadState() || initialState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const [tab, setTab] = useState(readHash);
  const [caps, setCaps] = useState({ ready: false, sample: null, user: null, me: null });
  const [installEvt, setInstallEvt] = useState(null);

  // حفظ محلي مؤجل
  useEffect(() => {
    const t = setTimeout(() => saveState(state), 400);
    return () => clearTimeout(t);
  }, [state]);

  // مؤقت محاكاة واحد ثابت (B019)
  useEffect(() => {
    if (!state.simRunning) return undefined;
    const t = setInterval(() => setState((s) => simulationTick(s)), 3500);
    return () => clearInterval(t);
  }, [state.simRunning]);

  // قدرات Claude: الهوية والوحدات الذكية
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = typeof window !== 'undefined' ? window.claude : null;
      if (!c || typeof c.use !== 'function') {
        if (alive) setCaps({ ready: true, sample: null, user: null, me: null });
        return;
      }
      const [s, u] = await Promise.all([c.use('sample').catch(() => null), c.use('user').catch(() => null)]);
      let me = null;
      if (u) { try { me = await u.me(); } catch { me = null; } }
      if (alive) setCaps({ ready: true, sample: s, user: u, me });
    })();
    return () => { alive = false; };
  }, []);

  // التنقل عبر الرابط
  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((id) => {
    setTab(id);
    try { if (location.hash !== `#${id}`) location.hash = id; } catch { /* ignore */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // تثبيت PWA
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  const install = {
    canPrompt: !!installEvt,
    prompt: async () => {
      if (!installEvt) return;
      installEvt.prompt();
      try { await installEvt.userChoice; } catch { /* ignore */ }
      setInstallEvt(null);
    },
  };

  const viewer = useMemo(() => {
    if (caps.user && caps.me) {
      return { source: 'claude', name: caps.me.name, avatarUrl: caps.me.avatarUrl, isOwner: !!caps.me.isOwner };
    }
    if (state.localProfile) return { source: 'local', name: state.localProfile.name, avatarUrl: null, isOwner: true };
    return { source: 'none', name: '', avatarUrl: null, isOwner: false };
  }, [caps, state.localProfile]);
  const canGovern = viewer.source === 'claude' ? viewer.isOwner : true;

  // ---------------------------------------------------------------- الإجراءات
  const act = useMemo(() => {
    const ding = () => { if (stateRef.current.settings.sound) playFalconCry(); };
    const pushAudit = (tag, msg) =>
      setState((s) => ({ ...s, audit: [{ id: uid('ev'), time: clockTime(), tag, msg }, ...s.audit].slice(0, 60) }));

    return {
      pushAudit,
      setSim: (v) => {
        setState((s) => ({ ...s, simRunning: !!v }));
        pushAudit('SYSTEM', v ? 'تشغيل المحاكاة الحية.' : 'إيقاف المحاكاة الحية.');
      },
      updateSettings: (patch) => {
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        if ('receiveAddress' in patch || 'companyIban' in patch) pushAudit('SYSTEM', 'تحديث إعدادات الاستلام.');
        if ('chain' in patch) pushAudit('SYSTEM', `ربط عقود SHN على الشبكة ${patch.chain.chainId}.`);
      },
      resetAll: () => {
        clearState();
        const fresh = initialState();
        setState({ ...fresh, localProfile: stateRef.current.localProfile });
      },
      signInLocal: (profile) => {
        setState((s) => ({ ...s, localProfile: profile }));
        pushAudit('SYSTEM', `دخول محلي: ${profile.name}.`);
      },
      signOutLocal: () => setState((s) => ({ ...s, localProfile: null })),

      // الحوكمة
      toggleHitl: (dealId) => {
        const d = stateRef.current.deals.find((x) => x.id === dealId);
        if (!d) return;
        const next = !d.hitlApproved;
        setState((s) => ({ ...s, deals: s.deals.map((x) => (x.id === dealId ? { ...x, hitlApproved: next, status: next ? 'معتمد عبر HITL' : 'معلق بانتظار HITL' } : x)) }));
        pushAudit('HITL', `${next ? 'اعتماد' : 'تعليق'} الصفقة ${dealId} بقرار المالك.`);
        if (next) ding();
      },
      addDeal: ({ title, value, cost, cont, vol }) => {
        const candidate = {
          id: uid('SHN'),
          title: (title || '').trim() || 'مبادرة تشغيلية جديدة',
          sector: 'حوكمة ذكية',
          estimatedValueSar: Math.max(1000, Number(value) || 0),
          directCostSar: Math.max(0, Number(cost) || 0),
          contingencySar: Math.max(0, Number(cont) || 0),
          volatilityIndex: Math.min(1, Math.max(0, Number(vol) || 0.1)),
        };
        const ev = evaluateDealGovernance(candidate);
        candidate.hitlApproved = !ev.requiresHitl;
        candidate.status = ev.requiresHitl ? 'معلق بانتظار HITL' : 'معتمد تلقائيًا';
        setState((s) => ({ ...s, deals: [candidate, ...s.deals] }));
        pushAudit('GOVERNANCE', `تقييم ${candidate.id} (Rc=${ev.riskCoefficient}، هامش ${ev.grossMarginPercent}%) ← ${candidate.status}.`);
      },
      spendResource: () => {
        const step = 0.65;
        const cur = stateRef.current.resourceSpendUsd;
        if (cur + step > DAILY_RESOURCE_CAP_USD) {
          pushAudit('BUDGET_GUARD', `رُفض الاستهلاك: بلوغ السقف اليومي ${DAILY_RESOURCE_CAP_USD.toFixed(2)}$.`);
          return;
        }
        setState((s) => ({ ...s, resourceSpendUsd: Number((s.resourceSpendUsd + step).toFixed(2)) }));
        pushAudit('BUDGET_GUARD', `استهلاك ${step.toFixed(2)}$ ضمن السقف اليومي.`);
      },

      // السوق الثانوي (B020)
      trade: (side, price, qty) => {
        if (!(price > 0) || !(qty > 0)) return { tone: 'warn', text: 'أدخل سعرًا وكمية أكبر من صفر.' };
        const m = stateRef.current.market;
        const r = matchOrder(m, side, price, qty);
        const burn = side === 'buy' ? r.filled * (TOKEN.burnOnPurchasePct / 100) : 0;
        const trade = r.filled ? { id: uid('T'), side, amount: r.filled, price: r.avgPrice, time: clockTime() } : null;
        setState((s) => ({
          ...s,
          market: {
            ...s.market,
            asks: r.asks,
            bids: r.bids,
            priceUsdt: r.lastPrice ?? s.market.priceUsdt,
            history: r.lastPrice ? [...s.market.history.slice(-59), r.lastPrice] : s.market.history,
            liquidityUsdt: Math.max(0, s.market.liquidityUsdt + (side === 'buy' ? r.notional : -r.notional)),
            burned: s.market.burned + burn,
            circulating: s.market.circulating - burn,
            trades: trade ? [trade, ...s.market.trades].slice(0, 20) : s.market.trades,
          },
        }));
        const label = side === 'buy' ? 'شراء' : 'بيع';
        const parts = [];
        if (r.filled) parts.push(`نُفذ ${fmt(r.filled)} SHN بمتوسط ${fmtPrice(r.avgPrice)} USDT`);
        if (burn) parts.push(`حُرق ${fmt(burn)} SHN`);
        if (r.rested) parts.push(`بقي ${fmt(r.rested)} SHN أمرًا معلقًا عند ${fmtPrice(price)}`);
        const text = `أمر ${label}: ${parts.join(' · ')}.`;
        pushAudit('TOKENOMICS', text);
        if (r.filled) ding();
        return { tone: r.filled ? 'ok' : 'info', text };
      },

      // البيع المسبق
      presaleBuy: (usdt, referral) => {
        const s0 = stateRef.current;
        const q = quotePresale(usdt, s0.presale);
        if (!q.ok) return { tone: 'warn', text: q.errors.join(' · ') };
        const refBonus = referral ? q.referral : 0;
        setState((s) => ({
          ...s,
          presale: {
            ...s.presale,
            soldUsdt: s.presale.soldUsdt + q.amount,
            buyers: s.presale.buyers + (s.presale.walletSpentUsdt === 0 ? 1 : 0),
            walletSpentUsdt: s.presale.walletSpentUsdt + q.amount,
            purchases: [{ id: uid('PS'), usdt: q.amount, shn: q.received, ref: referral || null, at: nowStamp() }, ...s.presale.purchases].slice(0, 30),
          },
          market: { ...s.market, burned: s.market.burned + q.burned, circulating: s.market.circulating + q.received + refBonus },
        }));
        const text = `شراء مسبق ${fmt(q.amount)} USDT ← ${fmt(q.received)} SHN، حرق ${fmt(q.burned)}${refBonus ? `، مكافأة إحالة ${fmt(refBonus)}` : ''}.`;
        pushAudit('PRESALE', text);
        ding();
        return { tone: 'ok', text };
      },

      // عقد الحوسبة
      toggleNode: (nodeId) => {
        const n = stateRef.current.nodes.find((x) => x.id === nodeId);
        if (!n) return;
        setState((s) => ({ ...s, nodes: s.nodes.map((x) => (x.id === nodeId ? { ...x, running: !x.running } : x)) }));
        pushAudit('COMPUTE', `${n.running ? 'إيقاف' : 'تشغيل'} ${n.id} (${n.region}).`);
      },
      setNodeBurn: (nodeId, v) => {
        const clean = Math.min(40, Math.max(1, Number(v) || 1));
        setState((s) => ({ ...s, nodes: s.nodes.map((x) => (x.id === nodeId ? { ...x, burnRatePercent: clean } : x)) }));
      },

      // المشتركون
      addSubscriber: ({ name, plan, monthlySar }) => {
        const sub = { id: uid('SUB'), name, plan, status: 'بانتظار السداد', shnBalance: 0, monthlySar: Math.max(100, Number(monthlySar) || 0), paymentMethod: '—', renewalDate: plusDays(7) };
        setState((s) => ({ ...s, subscribers: [sub, ...s.subscribers] }));
        pushAudit('SUBSCRIBERS', `إضافة ${name} على باقة ${plan}.`);
      },

      // الدفع
      processPayment: ({ subId, railId, totalSar, parts }) => {
        const s0 = stateRef.current;
        const sub = s0.subscribers.find((x) => x.id === subId);
        const rail = PAYMENT_RAILS.find((r) => r.id === railId);
        if (!sub || !rail || !(totalSar > 0)) return { tone: 'warn', text: 'بيانات الدفعة غير مكتملة.' };
        const isSplit = railId === 'split';
        const n = Math.max(2, Number(parts) || 2);
        const chargeNow = isSplit ? totalSar / n : totalSar;
        let balanceDelta = 0;
        let burn = 0;
        let impact;
        if (railId === 'shn') {
          const required = chargeNow / usdtToSar(s0.market.priceUsdt);
          if (sub.shnBalance < required) return { tone: 'err', text: `رصيد SHN غير كافٍ: المطلوب ${fmt(required)}.` };
          balanceDelta = -required;
          impact = `−${fmt(required)} SHN من رصيد المشترك`;
        } else {
          const credit = sarToUsdt(chargeNow) * TOKEN.presaleRate;
          burn = credit * (TOKEN.burnOnPurchasePct / 100);
          balanceDelta = credit - burn;
          impact = `+${fmt(balanceDelta)} SHN (حرق ${fmt(burn)})`;
        }
        const record = {
          id: uid('PAY'),
          subscriber: sub.name,
          amountSar: Number(chargeNow.toFixed(2)),
          rail: isSplit ? `${rail.label} (قسط 1 من ${n})` : rail.label,
          shnImpact: impact,
          status: 'مؤكد',
          timestamp: nowStamp(),
        };
        setState((s) => ({
          ...s,
          subscribers: s.subscribers.map((x) => (x.id === subId ? {
            ...x,
            status: isSplit ? `نشط (قسط 1 من ${n})` : 'نشط',
            shnBalance: Math.max(0, x.shnBalance + balanceDelta),
            paymentMethod: rail.label,
            renewalDate: plusDays(30),
          } : x)),
          payments: [record, ...s.payments].slice(0, 50),
          market: {
            ...s.market,
            burned: s.market.burned + burn,
            circulating: s.market.circulating + (balanceDelta > 0 ? balanceDelta : 0),
          },
        }));
        const text = `تأكيد ${record.id}: ${fmt(record.amountSar)} ر.س عبر ${record.rail} لصالح ${sub.name}.`;
        pushAudit('PAYMENTS', text);
        ding();
        return { tone: 'ok', text };
      },
    };
  }, []);

  const proxyUrl = state.settings.aiProxyUrl;
  const unitSample = useMemo(() => caps.sample || (proxyUrl ? makeProxySample(proxyUrl) : null), [caps.sample, proxyUrl]);
  // تبويب الاشتراك والمستثمرين مفتوح للجمهور دون حساب
  const needsGate = caps.ready && viewer.source === 'none' && tab !== 'join';
  const m = state.market;
  const active = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <WalletProvider cfg={state.settings.chain} appUrl={state.settings.api.appUrl}>
    <div dir="rtl" lang="ar" className="min-h-screen bg-ink text-sand">
      {needsGate && <AuthGate logoSrc={logoSrc} onEnter={act.signInLocal} onPublic={() => go('join')} />}

      <header className="sticky-top sticky z-40 border-b border-line bg-[#070502]/95 backdrop-blur-md">
        <div className="gutter mx-auto flex max-w-7xl items-center gap-3 py-2.5">
          <img src={markSrc} alt="شعار شاهين" className="h-10 w-10 shrink-0 object-contain" />
          <div className="min-w-0">
            <h1 className="truncate font-kufi text-lg font-bold text-gold sm:text-xl">منظومة شاهين</h1>
            <div className="flex items-center gap-2">
              <SimBadge />
              <p className="num ltr truncate text-right text-[11px] text-mute">SHN {fmtPrice(m.priceUsdt)} USDT</p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2">
            <button type="button" onClick={playFalconCry} className="grid h-9 w-9 place-items-center rounded-xl border border-gold/30 text-gold hover:bg-gold/10" aria-label="تشغيل صرخة الصقر" title="الهوية السمعية">
              <Icon name="Volume2" size={17} />
            </button>
            <button type="button" onClick={() => go('system')} className="flex items-center gap-2 rounded-xl border border-line px-2 py-1.5 hover:border-gold/40" aria-label="الحساب والنظام">
              {viewer.avatarUrl
                ? <img src={viewer.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                : <span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-gold"><Icon name="User" size={14} /></span>}
              <span className="hidden max-w-[110px] truncate text-xs font-bold sm:inline">{viewer.name || 'زائر'}</span>
            </button>
          </div>
        </div>
        <nav className="gutter mx-auto max-w-7xl" aria-label="أقسام المنظومة">
          <ul className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <li key={t.id} className="shrink-0">
                <button type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                  className={cls('flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-extrabold transition sm:text-sm', tab === t.id ? 'border-gold text-gold' : 'border-transparent text-mute hover:text-sand')}>
                  <Icon name={t.icon} size={15} />{t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="gutter mx-auto max-w-7xl pb-16 pt-5">
        <h2 className="sr-only">{active.label}</h2>
        {tab === 'home' && <HomeTab state={state} go={go} />}
        {tab === 'join' && <JoinTab api={state.settings.api} />}
        {tab === 'governance' && <GovernanceTab state={state} act={act} canGovern={canGovern} />}
        {tab === 'market' && <MarketTab state={state} act={act} go={go} />}
        {tab === 'wallet' && <WalletTab cfg={state.settings.chain} act={act} go={go} />}
        {tab === 'compute' && <ComputeTab state={state} act={act} />}
        {tab === 'subscribers' && <SubscribersTab state={state} act={act} />}
        {tab === 'payments' && <PaymentsTab state={state} act={act} />}
        {tab === 'units' && <UnitsTab state={state} act={act} sample={unitSample} samplingReady={caps.ready} />}
        {tab === 'system' && <SystemTab state={state} act={act} viewer={viewer} install={install} />}
      </main>

      <footer className="gutter mx-auto max-w-7xl border-t border-line pb-10 pt-5 text-[11px] leading-relaxed text-mute">
        نموذج تشغيلي أولي لمجموعة شاهين. جميع الأسعار والأرصدة والمشتركين والمدفوعات بيانات محاكاة على هذا الجهاز، ولا تُنفَّذ أي عملية مالية حقيقية. SHN عملة {TOKEN.standard} على {TOKEN.chain}.
      </footer>
    </div>
    </WalletProvider>
  );
}

// ---------------------------------------------------------------- بوابة الدخول (النسخة المستقلة)
function strength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function AuthGate({ logoSrc, onEnter, onPublic }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', phone: '', pass: '', pass2: '', terms: false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const st = strength(f.pass);
  const stLabel = ['', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'][st];
  const stColor = ['bg-white/10', 'bg-rose-500', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-400'][st];

  const submit = (e) => {
    e.preventDefault();
    const email = f.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr('البريد الإلكتروني غير صحيح.');
    if (f.pass.length < 8) return setErr('كلمة المرور 8 أحرف على الأقل.');
    if (mode === 'register') {
      if (!f.name.trim()) return setErr('أدخل الاسم.');
      if (f.pass !== f.pass2) return setErr('كلمتا المرور غير متطابقتين.');
      if (!f.terms) return setErr('يلزم الموافقة على شروط الاستخدام.');
    }
    // لا تُحفظ كلمة المرور إطلاقًا (B017)
    onEnter({ name: mode === 'register' ? f.name.trim() : email.split('@')[0], email });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="pointer-events-none fixed inset-0 grid-bg" />
      <div className="gutter relative mx-auto flex min-h-full max-w-md flex-col justify-center py-10">
        <div className="mb-6 text-center">
          <img src={logoSrc} alt="شعار شاهين" className="mx-auto h-24 w-24 object-contain" />
          <h1 id="auth-title" className="mt-3 font-kufi text-3xl font-bold text-gold">منظومة شاهين</h1>
          <p className="mt-1 text-xs text-mute">SHN · BEP-20 على BNB Chain</p>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel p-1" role="tablist">
          {[['login', 'تسجيل الدخول'], ['register', 'حساب جديد']].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setErr(''); }}
              className={cls('rounded-lg py-2.5 text-sm font-extrabold', mode === k ? 'bg-gold/15 text-gold' : 'text-mute')}>{l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-panel p-5">
          <Notice tone="warn">وضع عرض محلي: لا يوجد خادم مصادقة في هذه النسخة، ولا تُحفظ كلمة المرور. الدخول الحقيقي يحتاج خدمة مصادقة (مثل Supabase أو Firebase).</Notice>
          {mode === 'register' && (
            <Field label="الاسم الكامل" htmlFor="au-name"><input id="au-name" className={INPUT} value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          )}
          <Field label="البريد الإلكتروني" htmlFor="au-email"><input id="au-email" type="email" className={cls(INPUT, 'ltr text-left')} value={f.email} onChange={set('email')} autoComplete="email" /></Field>
          {mode === 'register' && (
            <Field label="الجوال (اختياري)" htmlFor="au-phone"><input id="au-phone" type="tel" className={cls(INPUT, 'ltr text-left')} value={f.phone} onChange={set('phone')} placeholder="+966 5x xxx xxxx" autoComplete="tel" /></Field>
          )}
          <Field label="كلمة المرور" htmlFor="au-pass">
            <input id="au-pass" type="password" className={cls(INPUT, 'ltr text-left')} value={f.pass} onChange={set('pass')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </Field>
          {mode === 'register' && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={cls('h-1.5 flex-1 rounded-full', i <= st ? stColor : 'bg-white/10')} />)}</div>
                <span className="w-14 text-left text-[11px] text-mute">{stLabel}</span>
              </div>
              <Field label="تأكيد كلمة المرور" htmlFor="au-pass2"><input id="au-pass2" type="password" className={cls(INPUT, 'ltr text-left')} value={f.pass2} onChange={set('pass2')} autoComplete="new-password" /></Field>
              <label className="flex items-start gap-2 text-xs text-mute">
                <input type="checkbox" checked={f.terms} onChange={set('terms')} className="mt-0.5 accent-[#F0A028]" />
                أوافق على شروط الاستخدام وسياسة الخصوصية
              </label>
            </>
          )}
          {err && <Notice tone="err">{err}</Notice>}
          <Button type="submit" className="mt-1 w-full">{mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</Button>
        </form>
        <div className="mt-4 rounded-2xl border border-gold/25 bg-gold/5 p-4 text-center">
          <p className="text-xs leading-relaxed text-sand/85">تريد متابعة الأخبار، أو طلب باقة لجهتك، أو تسجيل اهتمامك كمستثمر؟</p>
          <Button variant="ghost" className="mt-2 w-full" onClick={onPublic}><Icon name="Handshake" size={16} />الاشتراك والمستثمرون — بدون حساب</Button>
        </div>
      </div>
    </div>
  );
}
