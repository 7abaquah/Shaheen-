// ============================================================================
// منطق المنظومة: دوال نقية قابلة للاختبار + التخزين المحلي + الصوت
// ============================================================================
import {
  TOKEN, PRESALE_PRICE_USDT, SAR_PER_USDT, CHAIN_DEFAULT, AI_PROXY_DEFAULT, API_DEFAULT,
  HITL_VALUE_THRESHOLD_SAR, HITL_RISK_THRESHOLD, MIN_MARGIN_THRESHOLD,
  INITIAL_DEALS, INITIAL_NODES, INITIAL_SUBSCRIBERS, INITIAL_PAYMENTS,
  INITIAL_ASKS, INITIAL_BIDS,
} from './config.js';

// ---------- تنسيق ----------
export const fmt = (n, d = 0) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPrice = (p) => Number(p || 0).toFixed(6);
export const fmtSar = (n) => `${fmt(n)} ر.س`;
export const fmtCompact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n);
};
export const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);
export const clockTime = () => new Date().toTimeString().slice(0, 5);
export const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
export const usdtToSar = (u) => u * SAR_PER_USDT;
export const sarToUsdt = (s) => s / SAR_PER_USDT;

// ---------- بوابة الحوكمة ----------
// معامل الخطورة Rc كما صُمم في Nexus (لم يُغيَّر منطق العمل).
export function evaluateDealGovernance(deal) {
  const value = Math.max(1, Number(deal.estimatedValueSar) || 0);
  const direct = Math.max(0, Number(deal.directCostSar) || 0);
  const contingency = Math.max(0, Number(deal.contingencySar) || 0);
  const volatility = Math.min(1, Math.max(0, Number(deal.volatilityIndex) || 0.1));
  const totalCost = direct + contingency;
  const netProfit = value - totalCost;
  const grossMarginPercent = Number(((netProfit / value) * 100).toFixed(2));
  const rawRc = (totalCost / value) * (1 - grossMarginPercent / 100) * (1 + volatility * 0.25);
  const riskCoefficient = Number(Math.max(0, Math.min(1, rawRc)).toFixed(4));
  const reasons = [];
  if (value > HITL_VALUE_THRESHOLD_SAR) reasons.push('القيمة تتجاوز 500 ألف');
  if (riskCoefficient >= HITL_RISK_THRESHOLD) reasons.push(`Rc ≥ ${HITL_RISK_THRESHOLD}`);
  if (grossMarginPercent < MIN_MARGIN_THRESHOLD) reasons.push(`الهامش أقل من ${MIN_MARGIN_THRESHOLD}%`);
  return { totalCost, netProfit, grossMarginPercent, riskCoefficient, requiresHitl: reasons.length > 0, reasons };
}

// ---------- محرك مطابقة بسيط للسوق الثانوي ----------
// أمر الشراء يُملأ من أرخص عروض البيع ما دام سعره >= سعر العرض، والباقي يبقى أمرًا معلقًا.
export function matchOrder({ asks, bids }, side, limitPrice, qty) {
  let remaining = qty;
  const fills = [];
  const sortAsc = (a, b) => a.price - b.price;
  const sortDesc = (a, b) => b.price - a.price;
  let book = side === 'buy' ? [...asks].sort(sortAsc) : [...bids].sort(sortDesc);
  const crosses = (lvl) => (side === 'buy' ? limitPrice >= lvl.price : limitPrice <= lvl.price);
  const next = [];
  for (const lvl of book) {
    if (remaining > 0 && crosses(lvl)) {
      const take = Math.min(remaining, lvl.amount);
      fills.push({ price: lvl.price, amount: take });
      remaining -= take;
      if (lvl.amount - take > 0) next.push({ ...lvl, amount: lvl.amount - take });
    } else next.push(lvl);
  }
  let newAsks = side === 'buy' ? next : [...asks];
  let newBids = side === 'sell' ? next : [...bids];
  if (remaining > 0) {
    const resting = { id: uid(side === 'buy' ? 'B' : 'A'), price: limitPrice, amount: remaining, mine: true };
    if (side === 'buy') newBids = [...newBids, resting];
    else newAsks = [...newAsks, resting];
  }
  const filled = fills.reduce((s, f) => s + f.amount, 0);
  const notional = fills.reduce((s, f) => s + f.amount * f.price, 0);
  return {
    asks: newAsks.sort(sortAsc).slice(0, 8),
    bids: newBids.sort(sortDesc).slice(0, 8),
    fills, filled, notional, rested: remaining,
    lastPrice: fills.length ? fills[fills.length - 1].price : null,
    avgPrice: filled ? notional / filled : null,
  };
}

// ---------- البيع المسبق وفق عقد EcoSystem ----------
export function quotePresale(usdt, { soldUsdt, walletSpentUsdt }) {
  const amount = Number(usdt) || 0;
  const errors = [];
  if (amount < TOKEN.minBuyUsdt) errors.push(`الحد الأدنى ${TOKEN.minBuyUsdt} USDT`);
  if (walletSpentUsdt + amount > TOKEN.maxBuyUsdt)
    errors.push(`يتجاوز حد المحفظة ${fmt(TOKEN.maxBuyUsdt)} USDT (المتبقي ${fmt(TOKEN.maxBuyUsdt - walletSpentUsdt)})`);
  if (soldUsdt + amount > TOKEN.hardcapUsdt)
    errors.push(`يتجاوز السقف ${fmt(TOKEN.hardcapUsdt)} USDT (المتبقي ${fmt(TOKEN.hardcapUsdt - soldUsdt)})`);
  const gross = amount * TOKEN.presaleRate;
  const burned = gross * (TOKEN.burnOnPurchasePct / 100);
  const received = gross - burned;
  const referral = gross * (TOKEN.referralPct / 100);
  return { amount, gross, burned, received, referral, errors, ok: errors.length === 0 };
}

// ---------- الحالة الأولية ----------
function seedHistory(base, n = 48) {
  const walk = [];
  let p = 1;
  for (let i = 0; i < n; i++) {
    p = p * (1 + (Math.random() - 0.47) * 0.012);
    walk.push(p);
  }
  const k = base / walk[walk.length - 1]; // ينتهي المنحنى عند السعر الحالي بلا قفزة
  return walk.map((v) => Number((v * k).toFixed(7)));
}

export function initialState() {
  return {
    version: 3,
    simRunning: true,
    deals: INITIAL_DEALS,
    resourceSpendUsd: 4.85,
    market: {
      priceUsdt: PRESALE_PRICE_USDT,
      sessionOpen: PRESALE_PRICE_USDT,
      history: seedHistory(PRESALE_PRICE_USDT),
      circulating: 420000000,
      burned: 1250000,
      liquidityUsdt: 180000,
      asks: INITIAL_ASKS,
      bids: INITIAL_BIDS,
      trades: [],
    },
    // مراجع للعرض فقط: لا يوجد اتصال مباشر بسوق BTC/ETH داخل التطبيق
    reference: { btcUsd: 94000, ethUsd: 3400 },
    presale: { soldUsdt: 612400, buyers: 1840, walletSpentUsdt: 0, purchases: [] },
    nodes: INITIAL_NODES,
    subscribers: INITIAL_SUBSCRIBERS,
    payments: INITIAL_PAYMENTS,
    settings: { sound: true, receiveAddress: '', companyIban: '', companyName: 'Shaheen Group', chain: CHAIN_DEFAULT, aiProxyUrl: AI_PROXY_DEFAULT, api: API_DEFAULT },
    localProfile: null,
    audit: [
      { id: 'ev-1', time: '02:45', tag: 'GOVERNANCE', msg: 'بوابة الحوكمة نشطة؛ سقف الموارد اليومي 15.00$ محروس.' },
      { id: 'ev-2', time: '02:50', tag: 'TOKENOMICS', msg: 'تحميل مواصفات SHN (BEP-20): 238 SHN/USDT، حرق 1% عند الشراء.' },
      { id: 'ev-3', time: '02:55', tag: 'COMPUTE', msg: 'عقدتا مكة وجدة تعملان؛ عقدة الرياض متوقفة.' },
    ],
  };
}

// خطوة محاكاة واحدة (كل 3.5 ثانية): مكافآت العقد + الحرق + حركة سعر خفيفة
export function simulationTick(state) {
  const running = state.nodes.filter((n) => n.running);
  const STEP = 1 / 360; // كل نبضة = 10 ثوانٍ من وقت التشغيل
  let produced = 0;
  let burned = 0;
  const nodes = state.nodes.map((n) => {
    if (!n.running) return n;
    const p = n.shnPerHour * STEP;
    const b = (p * n.burnRatePercent) / 100;
    produced += p;
    burned += b;
    return { ...n, totalRewardShn: n.totalRewardShn + p, totalBurnedShn: n.totalBurnedShn + b };
  });
  const m = state.market;
  const drift = (Math.random() - 0.5) * 0.006;
  const priceUsdt = Math.max(0.000001, m.priceUsdt * (1 + drift));
  return {
    ...state,
    nodes,
    market: {
      ...m,
      priceUsdt,
      history: [...m.history.slice(-59), Number(priceUsdt.toFixed(7))],
      circulating: m.circulating + produced - burned,
      burned: m.burned + burned,
    },
    reference: {
      btcUsd: state.reference.btcUsd * (1 + (Math.random() - 0.5) * 0.002),
      ethUsd: state.reference.ethUsd * (1 + (Math.random() - 0.5) * 0.003),
    },
    _tickRunningCount: running.length,
  };
}

// ---------- التخزين المحلي (لكل مستخدم على جهازه) ----------
const KEY = 'shaheen-platform-v3';
// القيم المحفوظة الفارغة لا تُلغي القيم المضبوطة في البناء
function mergeFilled(base, saved) {
  const out = { ...base };
  for (const k of Object.keys(base)) if (saved && typeof saved[k] === 'string' && saved[k].trim()) out[k] = saved[k].trim();
  return out;
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 3) return null;
    const base = initialState();
    // ترحيل: حقل المعالجة القديم (وحدة إثبات العمل) إلى TFLOPS
    if (Array.isArray(parsed.nodes)) {
      parsed.nodes = parsed.nodes.map((n) => {
        const { hashRateThs, ...rest } = n || {};
        return { ...rest, computeTflops: Number(rest.computeTflops ?? hashRateThs) || 0 };
      });
    }
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings, chain: { ...CHAIN_DEFAULT, ...(parsed.settings?.chain || {}) }, api: mergeFilled(API_DEFAULT, parsed.settings?.api) } };
  } catch {
    return null;
  }
}
export function saveState(state) {
  try {
    const { _tickRunningCount, ...rest } = state;
    window.localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* التخزين غير متاح: نكمل بدون حفظ */
  }
}
export function clearState() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ---------- التحقق ----------
export const isBep20Address = (a) => /^0x[a-fA-F0-9]{40}$/.test(String(a || '').trim());
export const isSaudiIban = (s) => /^SA\d{22}$/.test(String(s || '').replace(/\s+/g, '').toUpperCase());

// ---------- الهوية السمعية: صرخة الصقر ----------
let audioCtx = null;
export function playFalconCry() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.5, t);
    master.connect(ctx.destination);

    // ضربة حادة هابطة
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(1850, t);
    o1.frequency.exponentialRampToValueAtTime(420, t + 0.38);
    g1.gain.setValueAtTime(0.45, t);
    g1.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o1.connect(g1); g1.connect(master);
    o1.start(t); o1.stop(t + 0.4);

    // خشونة الصرخة: ضجيج مرشّح
    const len = Math.floor(ctx.sampleRate * 0.62);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(1250, t + 0.05);
    bp.frequency.exponentialRampToValueAtTime(560, t + 0.6);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.28, t + 0.05);
    gn.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
    noise.connect(bp); bp.connect(gn); gn.connect(master);
    noise.start(t + 0.05); noise.stop(t + 0.65);

    // ذيل الصدى
    const o3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(500, t + 0.18);
    o3.frequency.exponentialRampToValueAtTime(190, t + 0.78);
    g3.gain.setValueAtTime(0.0001, t);
    g3.gain.setValueAtTime(0.18, t + 0.18);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.78);
    o3.connect(g3); g3.connect(master);
    o3.start(t + 0.18); o3.stop(t + 0.8);
  } catch {
    /* الصوت غير متاح */
  }
}

// ---------- ملخص الحالة لوحدات الذكاء ----------
export function platformSnapshot(state) {
  const deals = state.deals.map((d) => ({ ...d, m: evaluateDealGovernance(d) }));
  const active = state.subscribers.filter((s) => s.status.startsWith('نشط'));
  return {
    token: { symbol: 'SHN', standard: 'BEP-20', chain: 'BNB Chain', rate: '238 SHN/USDT', burnOnPurchase: '1%', referral: '5%', walletLimits: '50–10,000 USDT', hardcapUsdt: 2400000, daoTimelock: '48h', quorum: '4%' },
    market: {
      priceUsdt: Number(state.market.priceUsdt.toFixed(7)),
      priceSar: Number(usdtToSar(state.market.priceUsdt).toFixed(6)),
      circulating: Math.round(state.market.circulating),
      burned: Math.round(state.market.burned),
      liquidityUsdt: Math.round(state.market.liquidityUsdt),
      bestAsk: state.market.asks[0]?.price ?? null,
      bestBid: state.market.bids[0]?.price ?? null,
    },
    presale: { soldUsdt: state.presale.soldUsdt, progressPct: Number(((state.presale.soldUsdt / 2400000) * 100).toFixed(1)), buyers: state.presale.buyers },
    governance: {
      resourceSpendUsd: state.resourceSpendUsd,
      dailyCapUsd: 15,
      deals: deals.map((d) => ({ id: d.id, title: d.title, valueSar: d.estimatedValueSar, marginPct: d.m.grossMarginPercent, rc: d.m.riskCoefficient, status: d.status })),
    },
    compute: state.nodes.map((n) => ({ id: n.id, region: n.region, running: n.running, ths: n.computeTflops, green: n.greenPowerRatio, burnPct: n.burnRatePercent })),
    subscribers: { total: state.subscribers.length, active: active.length, mrrSar: active.reduce((s, x) => s + x.monthlySar, 0), pending: state.subscribers.filter((s) => s.status.includes('بانتظار')).map((s) => s.name) },
    note: 'All figures are simulation data inside the Shaheen platform prototype, not live market or customer data.',
  };
}
