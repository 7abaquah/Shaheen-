// ============================================================================
// مكوّنات واجهة مشتركة
// ============================================================================
import React from 'react';
import {
  LayoutDashboard, Shield, ShieldCheck, Coins, Cpu, Users, CreditCard, Bot, Settings,
  CheckCircle2, AlertTriangle, Play, Pause, Flame, ArrowUpDown, Lock, Unlock, Activity,
  DollarSign, Layers, Send, RefreshCw, FileText, Sparkles, LineChart, Blocks, Landmark,
  Droplets, Scale, Megaphone, Handshake, Zap, Wallet, SplitSquareHorizontal, Copy, Volume2,
  VolumeX, Square, TrendingUp, TrendingDown, Plus, RotateCcw, Info, User, LogOut, Download, X,
} from 'lucide-react';

const ICONS = {
  LayoutDashboard, Shield, ShieldCheck, Coins, Cpu, Users, CreditCard, Bot, Settings,
  CheckCircle2, AlertTriangle, Play, Pause, Flame, ArrowUpDown, Lock, Unlock, Activity,
  DollarSign, Layers, Send, RefreshCw, FileText, Sparkles, LineChart, Blocks, Landmark,
  Droplets, Scale, Megaphone, Handshake, Zap, Wallet, SplitSquareHorizontal, Copy, Volume2,
  VolumeX, Square, TrendingUp, TrendingDown, Plus, RotateCcw, Info, User, LogOut, Download, X,
};

export function Icon({ name, size = 18, className = '', ...rest }) {
  const C = ICONS[name] || Info;
  return <C size={size} className={className} aria-hidden="true" {...rest} />;
}

export const cls = (...a) => a.filter(Boolean).join(' ');

export const INPUT =
  'w-full rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-sand placeholder:text-mute/50 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/15';
export const LABEL = 'mb-1.5 block text-xs font-bold text-mute';

export function Card({ children, className = '', as: Tag = 'section' }) {
  return (
    <Tag className={cls('min-w-0 rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-4 sm:p-5', className)}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ icon, title, hint, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
            <Icon name={icon} size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold text-sand sm:text-lg">{title}</h2>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-mute">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Button({ variant = 'gold', className = '', children, ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40';
  const styles = {
    gold: 'bg-gradient-to-l from-gold to-gold2 text-ink hover:brightness-110',
    ghost: 'border border-gold/30 text-gold hover:bg-gold/10',
    quiet: 'border border-line text-sand/80 hover:bg-white/5',
    danger: 'border border-rose-400/40 text-rose-300 hover:bg-rose-400/10',
  };
  return (
    <button type="button" className={cls(base, styles[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function Stat({ icon, label, value, sub, tone = 'gold' }) {
  const toneCls = { gold: 'text-gold', green: 'text-emerald-300', red: 'text-rose-300', sky: 'text-sky-300', sand: 'text-sand' }[tone];
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-panel p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-mute">
        {icon && <Icon name={icon} size={13} />}
        <span className="truncate">{label}</span>
      </div>
      <div className={cls('num mt-1.5 truncate font-display text-lg font-black sm:text-xl', toneCls)}>{value}</div>
      {sub && <div className="num mt-0.5 truncate text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

export function Pill({ status }) {
  const s = String(status || '');
  let tone = 'border-stone-400/30 bg-stone-400/10 text-stone-300';
  if (/معلق|بانتظار|قيد/.test(s)) tone = 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  else if (/مرفوض|متوقف|فشل/.test(s)) tone = 'border-rose-400/40 bg-rose-400/10 text-rose-300';
  else if (/معتمد|نشط|مؤكد|يعمل|منفذ/.test(s)) tone = 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
  else if (/جارٍ|ناجح|Timelock/.test(s)) tone = 'border-sky-400/40 bg-sky-400/10 text-sky-300';
  return <span className={cls('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold', tone)}>{s}</span>;
}

export function Progress({ value, max, tone = 'gold', label }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1e-9)) * 100));
  const bar = { gold: 'from-gold to-gold2', red: 'from-rose-400 to-rose-600', green: 'from-emerald-300 to-emerald-600', sky: 'from-sky-300 to-sky-600' }[tone];
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cls('h-full rounded-full bg-gradient-to-l transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Sparkline({ data, height = 120, className = '' }) {
  if (!data || data.length < 2) return null;
  const w = 600;
  const h = height;
  const pad = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || max * 0.01 || 1;
  const x = (i) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const up = data[data.length - 1] >= data[0];
  const stroke = up ? '#F0A028' : '#FB7185';
  const lx = x(data.length - 1);
  const ly = y(data[data.length - 1]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cls('block w-full', className)} style={{ height }} role="img" aria-label="منحنى سعر SHN">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={w - pad} y1={pad + g * (h - pad * 2)} y2={pad + g * (h - pad * 2)} stroke="rgba(240,160,40,0.07)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="4.5" fill={stroke} />
      <circle cx={lx} cy={ly} r="9" fill={stroke} fillOpacity="0.18" />
    </svg>
  );
}

export function Toggle({ checked, onChange, label, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cls('relative h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-gold/60 bg-gold/30' : 'border-line bg-white/5')}
    >
      <span className={cls('absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all', checked ? 'right-0.5 bg-gold' : 'right-[22px] bg-mute/60')} />
    </button>
  );
}

export function Field({ label, htmlFor, children, hint }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className={LABEL}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-mute">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  const t = {
    info: 'border-gold/25 bg-gold/5 text-sand/90',
    ok: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    err: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
  }[tone];
  return <div className={cls('rounded-xl border px-3 py-2.5 text-xs leading-relaxed', t)} role="status">{children}</div>;
}

export function SimBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-300" />
      وضع المحاكاة
    </span>
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
