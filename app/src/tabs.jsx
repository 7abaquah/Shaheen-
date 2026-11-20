// ============================================================================
// تبويبات المنظومة: الرئيسية، الحوكمة، السوق، الحوسبة، المشتركون، الدفع، النظام
// ============================================================================
import React, { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  TOKEN, SAR_PER_USDT, DAILY_RESOURCE_CAP_USD, PLANS, PAYMENT_RAILS,
  LISTING_TARGETS, BUG_REGISTRY, AUDIT_TAGS,
} from './config.js';
import {
  fmt, fmtPrice, fmtSar, fmtCompact, usdtToSar, sarToUsdt, evaluateDealGovernance,
  quotePresale, isBep20Address, isSaudiIban,
} from './engine.js';
import { OnchainPresale, ChainSettings } from './onchain.jsx';
import { ApiSettings } from './join.jsx';
import {
  Icon, Card, SectionTitle, Button, Stat, Pill, Progress, Sparkline, Toggle, Field,
  Notice, INPUT, cls, copyText,
} from './ui.jsx';

// ---------------------------------------------------------------- الرئيسية
export function HomeTab({ state, go }) {
  const m = state.market;
  const change = ((m.priceUsdt - m.sessionOpen) / m.sessionOpen) * 100;
  const up = change >= 0;
  const pendingDeals = state.deals.filter((d) => evaluateDealGovernance(d).requiresHitl && !d.hitlApproved);
  const pendingSubs = state.subscribers.filter((s) => s.status.includes('بانتظار'));
  const active = state.subscribers.filter((s) => s.status.startsWith('نشط'));
  const mrr = active.reduce((s, x) => s + x.monthlySar, 0);
  const ths = state.nodes.filter((n) => n.running).reduce((s, n) => s + n.computeTflops, 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-60" />
        <div className="relative">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-mute">سعر SHN مقابل USDT · BEP-20 على BNB Chain</p>
              <div className="num ltr mt-1 text-right font-display text-3xl font-black text-gold sm:text-4xl">{fmtPrice(m.priceUsdt)}</div>
              <p className="num mt-1 text-xs text-mute">≈ {usdtToSar(m.priceUsdt).toFixed(5)} ر.س · سعر البيع المسبق {TOKEN.presaleRate} SHN لكل USDT</p>
            </div>
            <span className={cls('num inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold', up ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/40 bg-rose-400/10 text-rose-300')}>
              <Icon name={up ? 'TrendingUp' : 'TrendingDown'} size={14} />
              <span className="ltr">{up ? '+' : ''}{change.toFixed(2)}%</span>
              <span className="font-bold opacity-80">منذ فتح الجلسة</span>
            </span>
          </div>
          <div className="mt-3"><Sparkline data={m.history} height={130} /></div>
          <div className="mt-3">
            <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs">
              <span className="font-bold text-sand">البيع المسبق</span>
              <span className="num ltr text-mute">{fmt(state.presale.soldUsdt)} / {fmt(TOKEN.hardcapUsdt)} USDT · {((state.presale.soldUsdt / TOKEN.hardcapUsdt) * 100).toFixed(1)}%</span>
            </div>
            <Progress value={state.presale.soldUsdt} max={TOKEN.hardcapUsdt} label="تقدم البيع المسبق" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="Layers" label="المعروض المتداول" value={fmtCompact(m.circulating)} sub="SHN" />
        <Stat icon="Flame" label="إجمالي المحروق" value={fmtCompact(m.burned)} sub="SHN" tone="red" />
        <Stat icon="Users" label="الإيراد الشهري المتكرر" value={fmtSar(mrr)} sub={`${active.length} مشترك نشط`} tone="green" />
        <Stat icon="Cpu" label="معالجة العقد النشطة" value={`${fmt(ths)} TFLOPS`} sub={`${state.nodes.filter((n) => n.running).length} من ${state.nodes.length} عقد`} tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon="AlertTriangle" title="بانتظار قرارك" hint="عناصر تحتاج اعتماد المالك أو متابعة التحصيل." />
          {pendingDeals.length === 0 && pendingSubs.length === 0 && (
            <Notice tone="ok">لا توجد عناصر معلقة الآن.</Notice>
          )}
          <ul className="grid gap-2">
            {pendingDeals.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{d.title}</p>
                  <p className="num text-[11px] text-mute">{fmtSar(d.estimatedValueSar)} · اعتماد HITL</p>
                </div>
                <Button variant="ghost" className="shrink-0 !px-3 !py-1.5 !text-xs" onClick={() => go('governance')}>مراجعة</Button>
              </li>
            ))}
            {pendingSubs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="num text-[11px] text-mute">{fmtSar(s.monthlySar)} · تجديد {s.renewalDate}</p>
                </div>
                <Button variant="ghost" className="shrink-0 !px-3 !py-1.5 !text-xs" onClick={() => go('payments')}>تحصيل</Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle icon="LineChart" title="مرجع السوق" hint="أسعار BTC وETH هنا قيم مرجعية للعرض داخل المحاكاة، وليست تغذية حية." />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Bitcoin (BTC)" value={`$${fmt(state.reference.btcUsd)}`} sub="مرجع محاكاة" tone="sand" />
            <Stat label="Ethereum (ETH)" value={`$${fmt(state.reference.ethUsd)}`} sub="مرجع محاكاة" tone="sky" />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mute">
            SHN عملة BEP-20 تُسعَّر بالـ USDT على BNB Chain. ارتباطها بـ BTC وETH ارتباط سوقي عبر السيولة والطلب العام، وليس ربطًا تقنيًا بخوارزمياتهما. الربط بسعر حي يحتاج مزود بيانات (مثل CoinGecko) عبر خادم وسيط.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- الحوكمة
export function GovernanceTab({ state, act, canGovern }) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('640000');
  const [cost, setCost] = useState('430000');
  const [cont, setCont] = useState('45000');
  const [vol, setVol] = useState('0.14');

  const evaluated = useMemo(() => state.deals.map((d) => ({ ...d, m: evaluateDealGovernance(d) })), [state.deals]);
  const preview = evaluateDealGovernance({ estimatedValueSar: value, directCostSar: cost, contingencySar: cont, volatilityIndex: vol });
  const portfolio = evaluated.reduce((s, d) => s + d.estimatedValueSar, 0);
  const avgMargin = evaluated.length ? evaluated.reduce((s, d) => s + d.m.grossMarginPercent, 0) / evaluated.length : 0;
  const pending = evaluated.filter((d) => d.m.requiresHitl && !d.hitlApproved).length;
  const spendPct = (state.resourceSpendUsd / DAILY_RESOURCE_CAP_USD) * 100;

  const submit = (e) => {
    e.preventDefault();
    act.addDeal({ title, value, cost, cont, vol });
    setTitle('');
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {!canGovern && <Notice tone="warn">قرارات الاعتماد متاحة لمالك المنصة فقط. يمكنك الاطلاع على الصفقات وتقييمها.</Notice>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="Layers" label="قيمة المحفظة" value={fmtCompact(portfolio)} sub="ر.س" />
        <Stat icon="Activity" label="متوسط الهامش" value={`${avgMargin.toFixed(1)}%`} tone={avgMargin >= 18.5 ? 'green' : 'red'} />
        <Stat icon="Lock" label="بانتظار HITL" value={pending} tone={pending ? 'red' : 'green'} sub="قرار بشري مطلوب" />
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-mute"><Icon name="DollarSign" size={13} />سقف الموارد اليومي</div>
          <div className="num mt-1.5 font-display text-lg font-black text-sand">${state.resourceSpendUsd.toFixed(2)} <span className="text-xs text-mute">/ ${DAILY_RESOURCE_CAP_USD.toFixed(2)}</span></div>
          <div className="mt-2"><Progress value={state.resourceSpendUsd} max={DAILY_RESOURCE_CAP_USD} tone={spendPct > 85 ? 'red' : 'gold'} label="استهلاك الموارد" /></div>
          <button type="button" onClick={act.spendResource} className="mt-2 text-[11px] font-bold text-gold hover:underline">تسجيل استهلاك 0.65$</button>
        </div>
      </div>

      <Card>
        <SectionTitle icon="Plus" title="تقييم صفقة جديدة" hint="تُحسب المؤشرات قبل الإرسال. الصفقات التي تتجاوز العتبات تنتظر اعتماد المالك (HITL)." />
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-5">
            <Field label="عنوان الصفقة" htmlFor="deal-title">
              <input id="deal-title" className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عقد نقل حاويات جدة — البحرين" />
            </Field>
          </div>
          <Field label="القيمة التقديرية (ر.س)" htmlFor="deal-value"><input id="deal-value" inputMode="numeric" className={cls(INPUT, 'num')} value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="التكلفة المباشرة (ر.س)" htmlFor="deal-cost"><input id="deal-cost" inputMode="numeric" className={cls(INPUT, 'num')} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          <Field label="الاحتياطي (ر.س)" htmlFor="deal-cont"><input id="deal-cont" inputMode="numeric" className={cls(INPUT, 'num')} value={cont} onChange={(e) => setCont(e.target.value)} /></Field>
          <Field label="مؤشر التقلب (0–1)" htmlFor="deal-vol"><input id="deal-vol" inputMode="decimal" className={cls(INPUT, 'num')} value={vol} onChange={(e) => setVol(e.target.value)} /></Field>
          <div className="flex items-end"><Button type="submit" className="w-full"><Icon name="Send" size={16} />تقييم وإضافة</Button></div>
        </form>
        <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-line bg-ink/60 px-3 py-2 text-xs text-mute">
          <span>صافي الربح: <b className="text-sand">{fmtSar(preview.netProfit)}</b></span>
          <span>الهامش: <b className={preview.grossMarginPercent >= 18.5 ? 'text-emerald-300' : 'text-rose-300'}>{preview.grossMarginPercent}%</b></span>
          <span>Rc: <b className="text-sand">{preview.riskCoefficient}</b></span>
          <span>{preview.requiresHitl ? `يتطلب HITL: ${preview.reasons.join('، ')}` : 'اعتماد تلقائي'}</span>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="Shield" title="سجل الصفقات" hint={`القرار البشري مطلوب عند: القيمة > 500 ألف ر.س، أو Rc ≥ 0.15، أو الهامش < 18.5%.`} />
        <ul className="grid gap-3">
          {evaluated.map((d) => (
            <li key={d.id} className="rise rounded-xl border border-line bg-ink/60 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold leading-snug">{d.title}</p>
                  <p className="num ltr mt-0.5 text-right font-mono text-[11px] text-mute">{d.id} · {d.sector}</p>
                </div>
                <Pill status={d.status} />
              </div>
              <div className="num mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-mute">القيمة</span><div className="font-bold">{fmtSar(d.estimatedValueSar)}</div></div>
                <div><span className="text-mute">التكلفة الكلية</span><div className="font-bold">{fmtSar(d.m.totalCost)}</div></div>
                <div><span className="text-mute">الهامش</span><div className={cls('font-bold', d.m.grossMarginPercent >= 18.5 ? 'text-emerald-300' : 'text-rose-300')}>{d.m.grossMarginPercent}%</div></div>
                <div><span className="text-mute">Rc</span><div className={cls('font-bold', d.m.riskCoefficient >= 0.15 ? 'text-amber-300' : 'text-emerald-300')}>{d.m.riskCoefficient}</div></div>
              </div>
              {d.m.requiresHitl && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[11px] text-mute">أسباب HITL: {d.m.reasons.join('، ')}</span>
                  <Button variant={d.hitlApproved ? 'danger' : 'gold'} className="!px-3 !py-1.5 !text-xs" disabled={!canGovern} onClick={() => act.toggleHitl(d.id)}>
                    <Icon name={d.hitlApproved ? 'Lock' : 'Unlock'} size={14} />
                    {d.hitlApproved ? 'تعليق الاعتماد' : 'اعتماد المالك'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <AuditFeed audit={state.audit} limit={12} />
    </div>
  );
}

export function AuditFeed({ audit, limit = 15 }) {
  return (
    <Card>
      <SectionTitle icon="FileText" title="سجل التدقيق" hint="كل قرار وعملية في المنظومة يُسجَّل هنا." />
      <ol className="grid gap-1.5">
        {audit.slice(0, limit).map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-xs leading-relaxed">
            <span className="num ltr mt-0.5 shrink-0 font-mono text-mute">{e.time}</span>
            <span className={cls('mt-0.5 shrink-0 rounded border px-1.5 font-mono text-[10px]', AUDIT_TAGS[e.tag] || 'text-mute border-line')}>{e.tag}</span>
            <span className="min-w-0 text-sand/90">{e.msg}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ---------------------------------------------------------------- السوق والبيع المسبق
export function MarketTab({ state, act, go }) {
  const m = state.market;
  const [usdt, setUsdt] = useState('250');
  const [ref, setRef] = useState('');
  const [side, setSide] = useState('buy');
  const [qty, setQty] = useState('500000');
  const [price, setPrice] = useState(() => (m.asks[0]?.price ?? m.priceUsdt).toFixed(5));
  const [notice, setNotice] = useState(null);

  const quote = quotePresale(usdt, state.presale);
  const bestAsk = m.asks[0]?.price;
  const bestBid = m.bids[0]?.price;
  const spread = bestAsk && bestBid ? ((bestAsk - bestBid) / bestAsk) * 100 : null;
  const total = m.circulating + m.burned;
  const maxDepth = Math.max(...m.asks.map((a) => a.amount), ...m.bids.map((b) => b.amount), 1);

  const buyPresale = (e) => {
    e.preventDefault();
    setNotice(act.presaleBuy(Number(usdt), ref.trim()));
  };
  const placeOrder = (e) => {
    e.preventDefault();
    setNotice(act.trade(side, Number(price), Number(qty)));
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <OnchainPresale cfg={state.settings.chain} act={act} go={go} />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon="Coins" title="محاكاة البيع المسبق" hint={`${TOKEN.presaleRate} SHN لكل USDT · حرق ${TOKEN.burnOnPurchasePct}% عند الشراء · إحالة ${TOKEN.referralPct}% · من ${TOKEN.minBuyUsdt} إلى ${fmt(TOKEN.maxBuyUsdt)} USDT للمحفظة`} />
          <form onSubmit={buyPresale} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="المبلغ (USDT)" htmlFor="ps-usdt"><input id="ps-usdt" inputMode="decimal" className={cls(INPUT, 'num')} value={usdt} onChange={(e) => setUsdt(e.target.value)} /></Field>
              <Field label="رمز الإحالة (اختياري)" htmlFor="ps-ref"><input id="ps-ref" className={cls(INPUT, 'ltr text-left font-mono')} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="0x… أو رمز" /></Field>
            </div>
            <div className="num grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/60 p-3 text-xs sm:grid-cols-4">
              <div><span className="text-mute">الإجمالي</span><div className="font-bold">{fmt(quote.gross)}</div></div>
              <div><span className="text-mute">المحروق 1%</span><div className="font-bold text-rose-300">{fmt(quote.burned)}</div></div>
              <div><span className="text-mute">تستلم</span><div className="font-bold text-gold">{fmt(quote.received)}</div></div>
              <div><span className="text-mute">مكافأة المُحيل</span><div className="font-bold">{ref ? fmt(quote.referral) : '—'}</div></div>
            </div>
            {!quote.ok && Number(usdt) > 0 && <Notice tone="warn">{quote.errors.join(' · ')}</Notice>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="num text-[11px] text-mute">مشترياتك في هذه الجلسة: {fmt(state.presale.walletSpentUsdt)} / {fmt(TOKEN.maxBuyUsdt)} USDT</span>
              <Button type="submit" disabled={!quote.ok}><Icon name="Wallet" size={16} />شراء (محاكاة)</Button>
            </div>
          </form>
        </Card>

        <Card>
          <SectionTitle icon="ArrowUpDown" title="أمر في السوق الثانوي" hint="يُنفَّذ الأمر من دفتر الأوامر بأفضل سعر متاح، والكمية غير المنفذة تبقى أمرًا معلقًا." />
          <form onSubmit={placeOrder} className="grid gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink p-1" role="radiogroup" aria-label="نوع الأمر">
              {[['buy', 'شراء'], ['sell', 'بيع']].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={side === k} onClick={() => { setSide(k); setPrice(((k === 'buy' ? bestAsk : bestBid) ?? m.priceUsdt).toFixed(5)); }}
                  className={cls('rounded-lg py-2 text-sm font-extrabold transition', side === k ? (k === 'buy' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300') : 'text-mute')}>{l}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="السعر الحدّي (USDT)" htmlFor="ob-price"><input id="ob-price" inputMode="decimal" className={cls(INPUT, 'num ltr text-left')} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <Field label="الكمية (SHN)" htmlFor="ob-qty"><input id="ob-qty" inputMode="numeric" className={cls(INPUT, 'num')} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            </div>
            <div className="num text-[11px] text-mute">القيمة التقريبية: {fmt(Number(price) * Number(qty), 2)} USDT {side === 'buy' && `· حرق ${TOKEN.burnOnPurchasePct}% من الكمية المنفذة`}</div>
            <Button type="submit" variant={side === 'buy' ? 'gold' : 'ghost'}>{side === 'buy' ? 'إرسال أمر شراء' : 'إرسال أمر بيع'}</Button>
          </form>
        </Card>
      </div>

      <Card>
        <SectionTitle icon="Activity" title="دفتر الأوامر" hint={spread !== null ? `الفارق السعري ${spread.toFixed(2)}% · السيولة ${fmt(m.liquidityUsdt)} USDT` : 'الدفتر فارغ من أحد الجانبين'} />
        <div className="grid gap-4 sm:grid-cols-2">
          {[['عروض البيع', m.asks, 'rose'], ['طلبات الشراء', m.bids, 'emerald']].map(([title, rows, tone]) => (
            <div key={title} className="min-w-0">
              <div className="mb-1.5 flex justify-between text-[11px] font-bold text-mute"><span>{title}</span><span>الكمية SHN</span></div>
              <ul className="grid gap-1">
                {rows.length === 0 && <li className="text-xs text-mute">لا توجد أوامر.</li>}
                {rows.map((r) => (
                  <li key={r.id} className="num relative flex justify-between overflow-hidden rounded-md px-2 py-1 text-xs">
                    <span className={cls('absolute inset-y-0 right-0', tone === 'rose' ? 'bg-rose-400/10' : 'bg-emerald-400/10')} style={{ width: `${(r.amount / maxDepth) * 100}%` }} />
                    <span className={cls('relative ltr font-mono font-bold', tone === 'rose' ? 'text-rose-300' : 'text-emerald-300')}>{r.price.toFixed(5)}{r.mine ? ' •' : ''}</span>
                    <span className="relative text-sand/80">{fmt(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {m.trades.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-bold text-mute">آخر الصفقات المنفذة</p>
            <ul className="grid gap-1">
              {m.trades.slice(0, 5).map((t) => (
                <li key={t.id} className="num flex justify-between text-xs">
                  <span className={t.side === 'buy' ? 'text-emerald-300' : 'text-rose-300'}>{t.side === 'buy' ? 'شراء' : 'بيع'} {fmt(t.amount)} SHN</span>
                  <span className="ltr font-mono text-mute">@ {t.price.toFixed(5)} · {t.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle icon="Flame" title="المعروض والحرق" hint={`إجمالي المعروض ${fmtCompact(TOKEN.totalSupplySim)} SHN حسب سكربت النشر. أرقام التداول هنا محاكاة.`} />
          <div className="num mb-2 flex justify-between text-xs"><span className="text-mute">المتداول {fmtCompact(m.circulating)}</span><span className="text-rose-300">المحروق {fmtCompact(m.burned)}</span></div>
          <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
            <div className="bg-gradient-to-l from-gold to-gold2" style={{ width: `${(m.circulating / TOKEN.totalSupplySim) * 100}%` }} />
            <div className="bg-rose-500/70" style={{ width: `${Math.max(0.6, (m.burned / TOKEN.totalSupplySim) * 100)}%` }} />
          </div>
          <p className="num mt-2 text-[11px] text-mute">غير المتداول (خزينة واستحقاق ومخصصات): {fmtCompact(TOKEN.totalSupplySim - total)} SHN</p>
        </Card>
        <Card>
          <SectionTitle icon="Layers" title="خطة الإدراج" hint="لا يوجد إدراج فعلي حتى الآن. هذه المراحل المستهدفة." />
          <ol className="grid gap-2">
            {LISTING_TARGETS.map((l, i) => (
              <li key={l.name} className="flex items-start gap-3 rounded-xl border border-line bg-ink/60 p-3">
                <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gold/30 text-[11px] font-bold text-gold">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{l.name} <span className="text-[11px] font-normal text-mute">· {l.kind}</span></p>
                  <p className="text-[11px] text-mute">{l.stage}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- عقد الحوسبة
export function ComputeTab({ state, act }) {
  const running = state.nodes.filter((n) => n.running);
  const ths = running.reduce((s, n) => s + n.computeTflops, 0);
  const rewards = state.nodes.reduce((s, n) => s + n.totalRewardShn, 0);
  const burned = state.nodes.reduce((s, n) => s + n.totalBurnedShn, 0);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Notice>التعدين في شاهين يعني عقد حوسبة تعمل بالطاقة النظيفة، ومكافآتها تُصرف من مخصص عقد EcoSystem ولا تُنشئ عملة جديدة. SHN عملة BEP-20 ولا تُعدَّن بإثبات العمل. الأرقام في هذا التبويب محاكاة تشغيلية، والمكافآت متغيرة وغير مضمونة.</Notice>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="Cpu" label="المعالجة النشطة" value={`${fmt(ths)} TFLOPS`} tone="sky" />
        <Stat icon="Coins" label="مكافآت مصروفة" value={fmtCompact(rewards)} sub="SHN" />
        <Stat icon="Flame" label="محروق من المكافآت" value={fmtCompact(burned)} sub="SHN" tone="red" />
        <div className="min-w-0 rounded-2xl border border-line bg-panel p-3.5">
          <div className="text-[11px] font-bold text-mute">المحاكاة الحية</div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{state.simRunning ? 'تعمل' : 'متوقفة'}</span>
            <Toggle id="sim-toggle-compute" checked={state.simRunning} onChange={act.setSim} label="تشغيل المحاكاة" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {state.nodes.map((n) => (
          <Card key={n.id} className={n.running ? '' : 'opacity-75'}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-extrabold leading-snug"><img src="mark.svg" alt="" aria-hidden="true" className="h-8 w-8 shrink-0 object-contain" />{n.name}</p>
                <p className="num ltr text-right font-mono text-[11px] text-mute">{n.id} · {n.region}</p>
              </div>
              <Pill status={n.running ? 'يعمل' : 'متوقف'} />
            </div>
            <div className="num grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-mute">المعالجة</span><div className="font-bold">{fmt(n.computeTflops)} TFLOPS</div></div>
              <div><span className="text-mute">مكافأة محاكاة / ساعة</span><div className="font-bold">{fmt(n.shnPerHour)} SHN</div></div>
              <div><span className="text-mute">مكافآت مصروفة</span><div className="font-bold text-gold">{fmtCompact(n.totalRewardShn)}</div></div>
              <div><span className="text-mute">محروق</span><div className="font-bold text-rose-300">{fmtCompact(n.totalBurnedShn)}</div></div>
            </div>
            <div className="mt-3">
              <div className="num mb-1 flex justify-between text-[11px]"><span className="text-mute">الطاقة النظيفة</span><span className="text-emerald-300">{n.greenPowerRatio}%</span></div>
              <Progress value={n.greenPowerRatio} max={100} tone="green" label="نسبة الطاقة النظيفة" />
            </div>
            <div className="mt-3">
              <label htmlFor={`burn-${n.id}`} className="num mb-1 flex justify-between text-[11px]"><span className="text-mute">نسبة حرق المكافأة</span><span className="text-sand">{n.burnRatePercent}%</span></label>
              <input id={`burn-${n.id}`} type="range" min="1" max="40" value={n.burnRatePercent} onChange={(e) => act.setNodeBurn(n.id, e.target.value)} className="w-full accent-[#F0A028]" />
            </div>
            <Button variant={n.running ? 'quiet' : 'ghost'} className="mt-3 w-full" onClick={() => act.toggleNode(n.id)}>
              <Icon name={n.running ? 'Pause' : 'Play'} size={15} />{n.running ? 'إيقاف العقدة' : 'تشغيل العقدة'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- المشتركون
export function SubscribersTab({ state, act }) {
  const [filter, setFilter] = useState('all');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState(PLANS[1]);
  const [sar, setSar] = useState('1800');
  const rows = state.subscribers.filter((s) => (filter === 'active' ? s.status.startsWith('نشط') : filter === 'pending' ? s.status.includes('بانتظار') : true));
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    act.addSubscriber({ name: name.trim(), plan, monthlySar: Number(sar) });
    setName('');
  };
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <SectionTitle icon="Plus" title="إضافة مشترك" hint="يبدأ المشترك بحالة «بانتظار السداد» حتى تُسجَّل أول دفعة." />
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><Field label="اسم الجهة" htmlFor="sub-name"><input id="sub-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الشركة أو المؤسسة" /></Field></div>
          <Field label="الباقة" htmlFor="sub-plan"><select id="sub-plan" className={INPUT} value={plan} onChange={(e) => setPlan(e.target.value)}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="الاشتراك الشهري (ر.س)" htmlFor="sub-sar"><input id="sub-sar" inputMode="numeric" className={cls(INPUT, 'num')} value={sar} onChange={(e) => setSar(e.target.value)} /></Field>
          <div className="sm:col-span-4"><Button type="submit" disabled={!name.trim()}><Icon name="Plus" size={16} />إضافة</Button></div>
        </form>
      </Card>
      <Card>
        <SectionTitle icon="Users" title="المشتركون" hint="بيانات تجريبية للمحاكاة." action={
          <div className="flex gap-1 rounded-xl border border-line bg-ink p-1" role="radiogroup" aria-label="تصفية المشتركين">
            {[['all', 'الكل'], ['active', 'نشط'], ['pending', 'بانتظار']].map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cls('rounded-lg px-3 py-1 text-xs font-bold', filter === k ? 'bg-gold/15 text-gold' : 'text-mute')}>{l}</button>
            ))}
          </div>
        } />
        <ul className="grid gap-2.5">
          {rows.map((s) => (
            <li key={s.id} className="rounded-xl border border-line bg-ink/60 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{s.name}</p>
                  <p className="text-[11px] text-mute">{s.plan} · <span className="ltr font-mono">{s.id}</span></p>
                </div>
                <Pill status={s.status} />
              </div>
              <div className="num mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><span className="text-mute">شهريًا</span><div className="font-bold">{fmtSar(s.monthlySar)}</div></div>
                <div><span className="text-mute">رصيد SHN</span><div className="font-bold text-gold">{fmt(s.shnBalance)}</div></div>
                <div><span className="text-mute">طريقة الدفع</span><div className="truncate font-bold">{s.paymentMethod}</div></div>
                <div><span className="text-mute">التجديد</span><div className="font-bold">{s.renewalDate}</div></div>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="text-sm text-mute">لا يوجد مشتركون في هذا التصنيف.</li>}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- الدفع
export function PaymentsTab({ state, act }) {
  const subs = state.subscribers;
  const [subId, setSubId] = useState(() => (subs.find((s) => s.status.includes('بانتظار')) || subs[0])?.id);
  const sub = subs.find((s) => s.id === subId) || subs[0];
  const [rail, setRail] = useState('card');
  const [amount, setAmount] = useState(() => String(sub?.monthlySar ?? 0));
  const [parts, setParts] = useState(2);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState('');

  const total = Number(amount) || 0;
  const chargeNow = rail === 'split' ? total / Math.max(2, parts) : total;
  const usdtDue = sarToUsdt(chargeNow);
  const shnCredit = usdtDue * TOKEN.presaleRate;
  const addr = state.settings.receiveAddress;
  const iban = state.settings.companyIban;
  const railInfo = PAYMENT_RAILS.find((r) => r.id === rail);
  const shnRequired = chargeNow / usdtToSar(state.market.priceUsdt);

  const qrUrl = useMemo(() => {
    if (rail !== 'usdt' || !isBep20Address(addr)) return null;
    try {
      const q = qrcode(0, 'M');
      q.addData(addr.trim());
      q.make();
      return q.createDataURL(6, 12);
    } catch { return null; }
  }, [rail, addr]);

  const blocked = (rail === 'usdt' && !isBep20Address(addr)) || (rail === 'bank' && !isSaudiIban(iban)) || (rail === 'shn' && sub && sub.shnBalance < shnRequired) || !sub || total <= 0;

  const submit = (e) => {
    e.preventDefault();
    setNotice(act.processPayment({ subId: sub.id, railId: rail, totalSar: total, parts }));
  };
  const doCopy = async (text, key) => {
    const ok = await copyText(text);
    setCopied(ok ? key : 'fail');
    setTimeout(() => setCopied(''), 1800);
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <Card>
        <SectionTitle icon="CreditCard" title="تسجيل دفعة مشترك" hint="المبالغ بالريال، وتُحتسب مكافأة SHN بسعر البيع المسبق مع حرق 1%. هذه عملية محاكاة لا تحرك أموالًا." />
        <form onSubmit={submit} className="grid grid-cols-1 gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="المشترك" htmlFor="pay-sub">
              <select id="pay-sub" className={INPUT} value={sub?.id} onChange={(e) => { setSubId(e.target.value); const s = subs.find((x) => x.id === e.target.value); if (s) setAmount(String(s.monthlySar)); }}>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.status}</option>)}
              </select>
            </Field>
            <Field label="المبلغ الإجمالي (ر.س)" htmlFor="pay-amount"><input id="pay-amount" inputMode="decimal" className={cls(INPUT, 'num')} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          </div>

          <fieldset>
            <legend className="mb-2 text-xs font-bold text-mute">قناة الدفع</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PAYMENT_RAILS.map((r) => (
                <button key={r.id} type="button" onClick={() => setRail(r.id)} aria-pressed={rail === r.id}
                  className={cls('flex flex-col items-start gap-1.5 rounded-xl border p-3 text-right transition last:col-span-2 sm:last:col-span-1', rail === r.id ? 'border-gold/60 bg-gold/10' : 'border-line bg-ink/60 hover:border-gold/30')}>
                  <Icon name={r.icon} size={18} className={rail === r.id ? 'text-gold' : 'text-mute'} />
                  <span className="text-xs font-extrabold leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-mute">{railInfo?.note}</p>
          </fieldset>

          {rail === 'split' && (
            <Field label="عدد الأقساط" htmlFor="pay-parts">
              <select id="pay-parts" className={INPUT} value={parts} onChange={(e) => setParts(Number(e.target.value))}>{[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n} أقساط</option>)}</select>
            </Field>
          )}

          {rail === 'bank' && (
            isSaudiIban(iban) ? (
              <div className="rounded-xl border border-line bg-ink/60 p-3 text-xs">
                <p className="text-mute">حوّل إلى حساب {state.settings.companyName}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="num ltr font-mono font-bold text-sand">{iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()}</span>
                  <Button variant="quiet" className="!px-2.5 !py-1 !text-[11px]" onClick={() => doCopy(iban.replace(/\s+/g, ''), 'iban')}><Icon name="Copy" size={13} />{copied === 'iban' ? 'نُسخ' : 'نسخ'}</Button>
                </div>
              </div>
            ) : <Notice tone="warn">لم يُضبط IBAN الشركة بعد. اضبطه من تبويب النظام قبل قبول التحويلات.</Notice>
          )}

          {rail === 'usdt' && (
            isBep20Address(addr) ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-ink/60 p-4 sm:flex-row sm:items-start">
                {qrUrl && <img src={qrUrl} alt="رمز QR لعنوان الاستلام" className="h-36 w-36 shrink-0 rounded-lg bg-white p-1.5" />}
                <div className="min-w-0 flex-1 text-xs">
                  <p className="text-mute">أرسل USDT على شبكة BNB Chain (BEP-20) فقط إلى:</p>
                  <p className="ltr mt-1 break-all text-left font-mono text-[11px] text-gold">{addr}</p>
                  <Button variant="quiet" className="mt-2 !px-2.5 !py-1 !text-[11px]" onClick={() => doCopy(addr, 'addr')}><Icon name="Copy" size={13} />{copied === 'addr' ? 'نُسخ' : copied === 'fail' ? 'حدد النص وانسخه' : 'نسخ العنوان'}</Button>
                  <p className="num mt-2 font-bold text-sand">المبلغ المطلوب: {usdtDue.toFixed(2)} USDT</p>
                  <p className="mt-1 text-[11px] text-rose-300">الإرسال عبر شبكة أخرى يؤدي لفقدان المبلغ.</p>
                </div>
              </div>
            ) : <Notice tone="warn">لم يُضبط عنوان استلام BEP-20 بعد. اضبطه من تبويب النظام قبل قبول الدفع بالعملات الرقمية.</Notice>
          )}

          {rail === 'shn' && sub && (
            <Notice tone={sub.shnBalance >= shnRequired ? 'info' : 'err'}>
              المطلوب {fmt(shnRequired)} SHN بسعر السوق الحالي · رصيد المشترك {fmt(sub.shnBalance)} SHN
            </Notice>
          )}

          <div className="num grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/60 p-3 text-xs sm:grid-cols-4">
            <div><span className="text-mute">يُحصَّل الآن</span><div className="font-bold">{fmtSar(chargeNow)}</div></div>
            <div><span className="text-mute">ما يعادل</span><div className="font-bold">{usdtDue.toFixed(2)} USDT</div></div>
            <div><span className="text-mute">مكافأة SHN</span><div className="font-bold text-gold">{rail === 'shn' ? '—' : fmt(shnCredit * 0.99)}</div></div>
            <div><span className="text-mute">حرق 1%</span><div className="font-bold text-rose-300">{rail === 'shn' ? '—' : fmt(shnCredit * 0.01)}</div></div>
          </div>
          <Button type="submit" disabled={blocked}><Icon name="CheckCircle2" size={16} />تسجيل الدفعة (محاكاة)</Button>
        </form>
      </Card>

      <Card>
        <SectionTitle icon="FileText" title="سجل المدفوعات" />
        <ul className="grid gap-2">
          {state.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-ink/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{p.subscriber}</p>
                <p className="num text-[11px] text-mute"><span className="ltr font-mono">{p.id}</span> · {p.rail} · {p.timestamp}</p>
                <p className="num text-[11px] text-gold/90">{p.shnImpact}</p>
              </div>
              <div className="text-left">
                <div className="num text-sm font-extrabold text-emerald-300">{fmtSar(p.amountSar)}</div>
                <Pill status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- النظام
export function SystemTab({ state, act, viewer, install }) {
  const [addr, setAddr] = useState(state.settings.receiveAddress);
  const [iban, setIban] = useState(state.settings.companyIban);
  const [saved, setSaved] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const addrOk = !addr || isBep20Address(addr);
  const ibanOk = !iban || isSaudiIban(iban);

  const save = (e) => {
    e.preventDefault();
    if (!addrOk || !ibanOk) return;
    act.updateSettings({ receiveAddress: addr.trim(), companyIban: iban.replace(/\s+/g, '').toUpperCase() });
    setSaved('حُفظت إعدادات الاستلام.');
    setTimeout(() => setSaved(''), 2500);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <SectionTitle icon="User" title="الحساب" />
        <div className="flex items-center gap-3">
          {viewer.avatarUrl ? <img src={viewer.avatarUrl} alt="" className="h-11 w-11 rounded-full border border-gold/30" /> : <span className="grid h-11 w-11 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold"><Icon name="User" size={20} /></span>}
          <div className="min-w-0">
            <p className="truncate font-extrabold">{viewer.name || 'زائر'}</p>
            <p className="text-[11px] text-mute">{viewer.source === 'claude' ? (viewer.isOwner ? 'مالك المنصة · الهوية من حساب Claude' : 'مشاهد · الهوية من حساب Claude') : 'وضع عرض محلي على هذا الجهاز'}</p>
          </div>
          {viewer.source === 'local' && <Button variant="quiet" className="mr-auto !px-3 !py-1.5 !text-xs" onClick={act.signOutLocal}><Icon name="LogOut" size={14} />خروج</Button>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
          <div><p className="text-sm font-bold">الهوية السمعية</p><p className="text-[11px] text-mute">صرخة الصقر عند العمليات الناجحة</p></div>
          <Toggle id="sound-toggle" checked={state.settings.sound} onChange={(v) => act.updateSettings({ sound: v })} label="الصوت" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div><p className="text-sm font-bold">المحاكاة الحية</p><p className="text-[11px] text-mute">حركة السعر ومكافآت العقد</p></div>
          <Toggle id="sim-toggle" checked={state.simRunning} onChange={act.setSim} label="المحاكاة" />
        </div>
      </Card>

      <Card>
        <SectionTitle icon="Wallet" title="إعدادات الاستلام" hint="تظهر للعملاء في تبويب الدفع. لا يوجد أي عنوان أو حساب افتراضي." />
        <form onSubmit={save} className="grid gap-3">
          <Field label="عنوان استلام USDT / BNB (BEP-20)" htmlFor="set-addr" hint={addrOk ? 'محفظة تملكها الشركة على BNB Chain، ويفضل أن تكون متعددة التوقيع.' : 'صيغة العنوان غير صحيحة: 0x متبوعة بـ 40 خانة.'}>
            <input id="set-addr" className={cls(INPUT, 'ltr text-left font-mono', !addrOk && 'border-rose-400/60')} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" spellCheck="false" />
          </Field>
          <Field label="IBAN الشركة (سعودي)" htmlFor="set-iban" hint={ibanOk ? 'يبدأ بـ SA ويتكون من 24 خانة.' : 'صيغة IBAN غير صحيحة.'}>
            <input id="set-iban" className={cls(INPUT, 'ltr text-left font-mono', !ibanOk && 'border-rose-400/60')} value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" spellCheck="false" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!addrOk || !ibanOk}>حفظ</Button>
            {saved && <span className="text-xs text-emerald-300">{saved}</span>}
          </div>
        </form>
      </Card>

      <ChainSettings cfg={state.settings.chain} onSave={(c) => act.updateSettings({ chain: c })} />
      <ProxySettings url={state.settings.aiProxyUrl} onSave={(u) => act.updateSettings({ aiProxyUrl: u })} />
      <ApiSettings api={state.settings.api} onSave={(api) => act.updateSettings({ api })} />

      <Card>
        <SectionTitle icon="Coins" title="مواصفات SHN" hint="مأخوذة من عقود المشروع على BNB Chain." />
        <dl className="num grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {[
            ['المعيار', `${TOKEN.standard} · ${TOKEN.chain}`], ['سعر البيع المسبق', `${TOKEN.presaleRate} SHN / USDT`],
            ['الحرق عند الشراء', `${TOKEN.burnOnPurchasePct}%`], ['الإحالة', `${TOKEN.referralPct}%`],
            ['حدود المحفظة', `${TOKEN.minBuyUsdt} – ${fmt(TOKEN.maxBuyUsdt)} USDT`], ['سقف البيع المسبق', `${fmt(TOKEN.hardcapUsdt)} USDT`],
            ['Timelock الحوكمة', `${TOKEN.timelockHours} ساعة`], ['نصاب التصويت', `${TOKEN.quorumPct}%`],
            ['الريال مقابل USDT', `${SAR_PER_USDT}`], ['إجمالي المعروض', `${fmtCompact(TOKEN.totalSupplySim)} SHN`],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-mute">{k}</dt><dd className="font-bold text-sand">{v}</dd></div>
          ))}
        </dl>
        <ul className="mt-3 grid gap-1 border-t border-line pt-3 text-[11px] text-mute">
          {TOKEN.contracts.map((c) => <li key={c}>• {c}</li>)}
        </ul>
      </Card>

      <Card>
        <SectionTitle icon="Download" title="تثبيت التطبيق" hint="نسخة PWA تُثبَّت على أندرويد وآيفون من المتصفح بعد نشرها على نطاقك." />
        {install.canPrompt ? (
          <Button onClick={install.prompt}><Icon name="Download" size={16} />تثبيت الآن</Button>
        ) : (
          <div className="grid gap-2 text-xs leading-relaxed text-mute">
            <p><b className="text-sand">أندرويد (Chrome):</b> القائمة ⋮ ثم «إضافة إلى الشاشة الرئيسية».</p>
            <p><b className="text-sand">آيفون (Safari):</b> زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».</p>
            <p>داخل Claude يعمل التطبيق كصفحة تفاعلية. للتثبيت كتطبيق انشر حزمة PWA المرفقة على نطاقك (HTTPS).</p>
          </div>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <SectionTitle icon="ShieldCheck" title="سجل الأعطال المعالجة" hint="يكمل ترقيم سجل Nexus السابق (B001–B010)." />
        <ul className="grid gap-2 sm:grid-cols-2">
          {BUG_REGISTRY.map((b) => (
            <li key={b.id} className="flex gap-2.5 rounded-xl border border-line bg-ink/60 p-3 text-xs leading-relaxed">
              <span className="ltr shrink-0 font-mono font-bold text-gold">{b.id}</span>
              <span className="min-w-0"><b className="text-sand">{b.area}:</b> <span className="text-sand/80">{b.fix}</span></span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="lg:col-span-2"><AuditFeed audit={state.audit} limit={40} /></div>

      <Card className="lg:col-span-2">
        <SectionTitle icon="RotateCcw" title="إعادة ضبط المحاكاة" hint="يعيد كل البيانات التجريبية إلى حالتها الأولى على هذا الجهاز." />
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-amber-300">سيُحذف كل ما سجلته في المحاكاة. هل تريد المتابعة؟</span>
            <Button variant="danger" onClick={() => { act.resetAll(); setConfirmReset(false); }}>نعم، إعادة الضبط</Button>
            <Button variant="quiet" onClick={() => setConfirmReset(false)}>إلغاء</Button>
          </div>
        ) : <Button variant="danger" onClick={() => setConfirmReset(true)}><Icon name="RotateCcw" size={15} />إعادة الضبط</Button>}
      </Card>
    </div>
  );
}

function ProxySettings({ url, onSave }) {
  const [v, setV] = useState(url || '');
  const [msg, setMsg] = useState('');
  const valid = !v || /^https:\/\/[^\s]+$/.test(v.trim());
  const test = async () => {
    setMsg('جارٍ الفحص…');
    try {
      const r = await fetch(v.trim().replace(/\/v1\/units\/?$/, '') + '/health');
      setMsg(r.ok ? 'الخادم يعمل ويقبل هذا النطاق.' : `رد الخادم ${r.status}.`);
    } catch { setMsg('تعذّر الوصول. تحقق من الرابط ومن ALLOWED_ORIGINS في الخادم.'); }
  };
  return (
    <Card>
      <SectionTitle icon="Bot" title="خادم الوحدات الذكية" hint="للنسخة المنشورة على نطاقك. داخل Claude تعمل الوحدات بدونه." />
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!valid) return; onSave(v.trim()); setMsg('حُفظ.'); }}>
        <Field label="رابط الخادم (Cloudflare Worker)" htmlFor="set-proxy" hint={valid ? 'مثال: https://shaheen-ai-proxy.حسابك.workers.dev/v1/units' : 'يجب أن يبدأ الرابط بـ https://'}>
          <input id="set-proxy" className={cls(INPUT, 'ltr text-left font-mono text-xs', !valid && 'border-rose-400/60')} value={v} onChange={(e) => setV(e.target.value)} placeholder="https://…/v1/units" spellCheck="false" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!valid}>حفظ</Button>
          <Button variant="quiet" disabled={!v || !valid} onClick={test}>فحص الاتصال</Button>
          {msg && <span className="text-xs text-mute">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}
