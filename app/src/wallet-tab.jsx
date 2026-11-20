// ============================================================================
// تبويب المحفظة: التخزين، الاستحقاق، الإيردروب، الحوكمة (DAO)، لوحة المشغّل
// كل العمليات معاملات فعلية على BNB Chain عبر محفظة المستخدم
// ============================================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TOKEN } from './config.js';
import { fmt } from './engine.js';
import {
  ECO_OPS_ABI, AIRDROP_ABI, VOTES_ABI, ERC20_ABI, DAO_ABI, PROPOSAL_STATES, ZERO,
  readWallet, sendTx, approveExact, loadProofs, encodeCall, readProposals, proposalKey,
  explainError, explorerTx, fromWei, toWei, isAddress, getAddress, keccak256, toHex,
} from './chain.js';
import { useWallet, WalletGate, short } from './wallet.jsx';
import { Icon, Card, SectionTitle, Button, Field, Notice, Progress, Pill, Toggle, INPUT, cls } from './ui.jsx';

const STEP = {
  'approve-simulate': 'التحقق من الموافقة…', 'approve-sign': 'وقّع الموافقة في المحفظة…', 'approve-wait': 'بانتظار تأكيد الموافقة…',
  simulate: 'التحقق من شروط العقد…', sign: 'وقّع المعاملة في المحفظة…', wait: 'بانتظار التأكيد على السلسلة…',
};
const DAY = 86400;
const fmtDate = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fmtLeft = (s) => {
  if (s <= 0) return 'الآن';
  const d = Math.floor(s / DAY); const h = Math.floor((s % DAY) / 3600); const m = Math.floor((s % 3600) / 60);
  return d ? `${d} يوم ${h} ساعة` : h ? `${h} ساعة ${m} دقيقة` : `${Math.max(1, m)} دقيقة`;
};

// مشغّل معاملات مشترك: يعرض الخطوة الحالية ونتيجة آخر معاملة
function useTx({ onDone }) {
  const [busy, setBusy] = useState(null); // { key, step }
  const [last, setLast] = useState(null); // { ok, text, hash }
  const run = useCallback(async (key, okText, fnc) => {
    setBusy({ key, step: 'simulate' }); setLast(null);
    try {
      const res = await fnc((step) => setBusy({ key, step }));
      setBusy(null);
      setLast({ ok: true, text: okText, hash: res?.hash });
      onDone?.(okText); // التحديث في الخلفية حتى لا تتجمد الأزرار
      return res;
    } catch (e) {
      setBusy(null);
      setLast({ ok: false, text: explainError(e) });
      return null;
    }
  }, [onDone]);
  return { busy, last, run, setLast };
}

function TxButton({ tx, k, children, variant, disabled, onClick, className }) {
  const mine = tx.busy?.key === k;
  return (
    <Button variant={variant} className={className} disabled={disabled || !!tx.busy} onClick={onClick}>
      {mine ? <><Icon name="RefreshCw" size={15} className="animate-spin" />{STEP[tx.busy.step] || '…'}</> : children}
    </Button>
  );
}

function TxResult({ tx, chainId }) {
  if (!tx.last) return null;
  const url = tx.last.hash ? explorerTx(chainId, tx.last.hash) : null;
  return (
    <Notice tone={tx.last.ok ? 'ok' : 'err'}>
      {tx.last.text}{' '}
      {tx.last.ok && tx.last.hash && (url
        ? <a className="underline" href={url} target="_blank" rel="noreferrer">عرض المعاملة</a>
        : <span className="ltr font-mono">{short(tx.last.hash)}</span>)}
    </Notice>
  );
}

function AmountInput({ id, label, value, onChange, max, disabled, unit = 'SHN' }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex gap-2">
        <input id={id} inputMode="decimal" className={cls(INPUT, 'num')} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
        {max != null && (
          <button type="button" onClick={() => onChange(String(Math.floor(max * 1e6) / 1e6))} disabled={disabled}
            className="shrink-0 rounded-xl border border-line px-3 text-xs font-bold text-gold hover:bg-gold/10">الكل</button>
        )}
      </div>
      <p className="num mt-1 text-[11px] text-mute">{max != null ? `المتاح: ${fmt(max, 2)} ${unit}` : ''}</p>
    </Field>
  );
}

// ---------------------------------------------------------------- التبويب
export function WalletTab({ cfg, act, go }) {
  const { wallet, ready, net } = useWallet();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readErr, setReadErr] = useState('');
  const [, tick] = useState(0);

  const refresh = useCallback(async () => {
    if (!ready || !wallet?.account) return;
    setLoading(true);
    try { setData(await readWallet(cfg, wallet.account)); setReadErr(''); }
    catch (e) { setReadErr(explainError(e)); }
    finally { setLoading(false); }
  }, [ready, wallet?.account, cfg]);

  useEffect(() => { refresh(); }, [refresh]);
  // تحديث المكافآت المتراكمة كل 15 ثانية أثناء فتح التبويب
  useEffect(() => {
    if (!ready) return undefined;
    const t = setInterval(() => { tick((x) => x + 1); refresh(); }, 15000);
    return () => clearInterval(t);
  }, [ready, refresh]);

  const onDone = useCallback(async (text) => {
    act.pushAudit('TOKENOMICS', `${text} (${net?.short || ''})`);
    await refresh();
  }, [act, net, refresh]);

  const chainNow = data ? data.chainNow + Math.floor((Date.now() - data.readAt) / 1000) : Math.floor(Date.now() / 1000);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <SectionTitle icon="Wallet" title="محفظتي على BNB Chain" hint="التخزين والاستحقاق والإيردروب والتصويت. كل زر هنا معاملة فعلية توقّعها من محفظتك."
          action={net && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-mute">{net.name}</span>} />
        <WalletGate go={go}>{() => (
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex flex-wrap items-center gap-2">
                <span className="ltr font-mono text-sand">{short(wallet.account)}</span>
                {data?.isOperator && <Pill status="مشغّل معتمد" />}
                {data?.isOwner && <Pill status="مالك العقد" />}
              </span>
              <button type="button" onClick={refresh} className="inline-flex items-center gap-1 text-gold hover:underline" disabled={loading}>
                <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />تحديث
              </button>
            </div>
            {readErr && <Notice tone="err">{readErr}</Notice>}
            {data && (
              <div className="num grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/60 p-3 text-xs sm:grid-cols-4">
                <div><span className="text-mute">رصيد SHN</span><div className="font-bold text-gold">{fmt(fromWei(data.shnBal), 2)}</div></div>
                <div><span className="text-mute">رصيد USDT</span><div className="font-bold">{fmt(fromWei(data.usdtBal), 2)}</div></div>
                <div><span className="text-mute">مخزّن</span><div className="font-bold">{fmt(fromWei(data.staked), 2)}</div></div>
                <div><span className="text-mute">قوة التصويت</span><div className="font-bold">{fmt(fromWei(data.votes))}</div></div>
              </div>
            )}
          </div>
        )}</WalletGate>
      </Card>

      {ready && data && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StakeCard cfg={cfg} account={wallet.account} data={data} chainNow={chainNow} onDone={onDone} />
            <VestingCard cfg={cfg} account={wallet.account} data={data} chainNow={chainNow} onDone={onDone} />
          </div>
          <AirdropCard cfg={cfg} account={wallet.account} data={data} chainNow={chainNow} onDone={onDone} />
          <DaoCard cfg={cfg} account={wallet.account} data={data} chainNow={chainNow} onDone={onDone} />
          {(data.isOperator || data.isOwner) && <OperatorCard cfg={cfg} account={wallet.account} data={data} onDone={onDone} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- التخزين
function StakeCard({ cfg, account, data, chainNow, onDone }) {
  const tx = useTx({ onDone });
  const [amt, setAmt] = useState('');
  const [outAmt, setOutAmt] = useState('');
  const bal = fromWei(data.shnBal);
  const staked = fromWei(data.staked);
  const earned = fromWei(data.earned);
  const total = fromWei(data.totalStaked);
  const active = data.periodFinish > chainNow;
  const apr = active && total > 0 ? (fromWei(data.rewardRate) * 365 * DAY / total) * 100 : null;
  const share = total > 0 ? (staked / total) * 100 : 0;

  const stake = () => tx.run('stake', `تخزين ${fmt(Number(amt), 2)} SHN`, async (step) => {
    const w = toWei(amt);
    await approveExact(account, cfg.shn, cfg.eco, w, step);
    const r = await sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName: 'stake', args: [w] }, step);
    setAmt(''); return r;
  });
  const unstake = () => tx.run('unstake', `سحب ${fmt(Number(outAmt), 2)} SHN من التخزين`, async (step) => {
    const r = await sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName: 'unstake', args: [toWei(outAmt)] }, step);
    setOutAmt(''); return r;
  });
  const claim = () => tx.run('claim', `استلام ${fmt(earned, 2)} SHN مكافآت تخزين`, (step) =>
    sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName: 'claimRewards' }, step));

  return (
    <Card>
      <SectionTitle icon="Layers" title="التخزين (Staking)" hint="المكافآت تُصرف من مجمع ممول مسبقًا في العقد، ويتغير العائد مع إجمالي المخزّن." />
      <div className="num grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-mute">مخزّن لديك</span><div className="font-bold">{fmt(staked, 2)} SHN</div></div>
        <div><span className="text-mute">مكافآت مستحقة</span><div className="font-bold text-gold">{fmt(earned, 4)} SHN</div></div>
        <div><span className="text-mute">إجمالي المخزّن</span><div className="font-bold">{fmt(total)} · حصتك <bdi>{share.toFixed(2)}%</bdi></div></div>
        <div><span className="text-mute">العائد السنوي الحالي</span><div className="font-bold">{apr === null ? 'لا توجد فترة مكافآت نشطة' : apr > 1000 ? 'أعلى من 1,000% (المخزّن قليل)' : <bdi>{apr.toFixed(1)}%</bdi>}</div></div>
      </div>
      <p className="num mt-2 text-[11px] leading-relaxed text-mute">{apr !== null && `فترة المكافآت حتى ${fmtDate(data.periodFinish)}. العائد ينخفض كلما زاد إجمالي المخزّن، وليس عائدًا مضمونًا.`}</p>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <AmountInput id="stk-in" label="كمية للتخزين" value={amt} onChange={setAmt} max={bal} disabled={!!tx.busy} />
        <TxButton tx={tx} k="stake" disabled={!(Number(amt) > 0) || Number(amt) > bal} onClick={stake}>
          <Icon name="Lock" size={15} />{data.shnAllow >= toWei(amt) ? 'تخزين' : 'موافقة ثم تخزين'}
        </TxButton>
        {staked > 0 && (
          <>
            <AmountInput id="stk-out" label="كمية للسحب" value={outAmt} onChange={setOutAmt} max={staked} disabled={!!tx.busy} />
            <TxButton tx={tx} k="unstake" variant="ghost" disabled={!(Number(outAmt) > 0) || Number(outAmt) > staked} onClick={unstake}><Icon name="Unlock" size={15} />سحب من التخزين</TxButton>
          </>
        )}
        <TxButton tx={tx} k="claim" variant="ghost" disabled={earned <= 0} onClick={claim}><Icon name="Coins" size={15} />استلام المكافآت</TxButton>
        <TxResult tx={tx} chainId={cfg.chainId} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- الاستحقاق
function VestingCard({ cfg, account, data, chainNow, onDone }) {
  const tx = useTx({ onDone });
  const v = data.vesting;
  const total = fromWei(v.total);
  if (!total) {
    return (
      <Card>
        <SectionTitle icon="Activity" title="الاستحقاق (Vesting)" />
        <p className="text-xs text-mute">لا يوجد جدول استحقاق لهذه المحفظة. جداول الاستحقاق للفريق والشركاء يضيفها المالك (خزينة DAO).</p>
      </Card>
    );
  }
  const vested = fromWei(v.vested);
  const claimed = fromWei(v.claimed);
  const claimable = Math.max(0, vested - claimed);
  const end = v.start + v.duration;
  const claim = () => tx.run('vest', `استلام ${fmt(claimable, 2)} SHN من الاستحقاق`, (step) =>
    sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName: 'claimVested' }, step));
  return (
    <Card>
      <SectionTitle icon="Activity" title="الاستحقاق (Vesting)" hint={`صرف خطي من ${fmtDate(v.start)} إلى ${fmtDate(end)}`} />
      <div className="num mb-1.5 flex justify-between text-xs"><span className="text-mute">المستحق حتى الآن</span><span className="ltr">{fmt(vested, 2)} / {fmt(total, 2)} SHN</span></div>
      <Progress value={vested} max={total} label="نسبة الاستحقاق" />
      <div className="num mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><span className="text-mute">مستلم</span><div className="font-bold">{fmt(claimed, 2)}</div></div>
        <div><span className="text-mute">متاح الآن</span><div className="font-bold text-gold">{fmt(claimable, 2)}</div></div>
        <div><span className="text-mute">ينتهي بعد</span><div className="font-bold">{fmtLeft(end - chainNow)}</div></div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        <TxButton tx={tx} k="vest" disabled={claimable < 1e-9} onClick={claim}><Icon name="Download" size={15} />استلام المستحق</TxButton>
        <TxResult tx={tx} chainId={cfg.chainId} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- الإيردروب
function AirdropCard({ cfg, account, data, chainNow, onDone }) {
  const tx = useTx({ onDone });
  const [proofs, setProofs] = useState(null);
  const [perr, setPerr] = useState('');
  const a = data.airdrop;
  useEffect(() => {
    if (!a) return;
    loadProofs(cfg.proofsUrl).then(setProofs).catch((e) => setPerr(e.message));
  }, [a?.root, cfg.proofsUrl]);
  if (!a) return null;
  const amount = fromWei(a.amount);
  const proof = proofs?.proofs?.[account.toLowerCase()];
  const rootMismatch = proofs && proofs.root?.toLowerCase() !== String(a.root).toLowerCase();
  const ended = chainNow > a.deadline;
  const claim = () => tx.run('air', `استلام ${fmt(amount)} SHN من الإيردروب`, (step) =>
    sendTx(account, { address: cfg.airdrop, abi: AIRDROP_ABI, functionName: 'claim', args: [proof] }, step));
  let status;
  if (a.claimed) status = <Notice tone="ok">استلمت حصتك من الإيردروب.</Notice>;
  else if (ended) status = <Notice tone="warn">انتهت مدة الإيردروب في {fmtDate(a.deadline)}.</Notice>;
  else if (perr) status = <Notice tone="warn">{perr}</Notice>;
  else if (rootMismatch) status = <Notice tone="err">ملف الإثباتات المنشور لا يطابق جذر العقد. أعد نشر الملف الصحيح.</Notice>;
  else if (proofs && !proof) status = <Notice>هذه المحفظة ليست ضمن قائمة الإيردروب.</Notice>;
  return (
    <Card>
      <SectionTitle icon="Sparkles" title="الإيردروب" hint={`${fmt(amount)} SHN لكل محفظة مؤهلة · ينتهي ${fmtDate(a.deadline)}`} />
      <div className="grid grid-cols-1 gap-3">
        {status}
        {!a.claimed && !ended && proof && !rootMismatch && (
          <TxButton tx={tx} k="air" onClick={claim}><Icon name="Sparkles" size={15} />استلام {fmt(amount)} SHN</TxButton>
        )}
        <TxResult tx={tx} chainId={cfg.chainId} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- الحوكمة
const PKEY = 'shaheen-dao-proposals';
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch { return []; } };
const saveSaved = (l) => { try { localStorage.setItem(PKEY, JSON.stringify(l)); } catch { /* ignore */ } };

const TEMPLATES = [
  { id: 'cap', label: 'رفع سقف البيع المسبق', fields: [['cap', 'السقف الجديد (USDT)', '3000000']] },
  { id: 'withdraw', label: 'سحب حصيلة USDT إلى خزينة DAO', fields: [] },
  { id: 'pay', label: 'صرف USDT من خزينة DAO', fields: [['to', 'العنوان المستلم', ''], ['amount', 'المبلغ (USDT)', '']] },
  { id: 'rewards', label: 'تمويل مكافآت التخزين من خزينة DAO', fields: [['amount', 'الكمية (SHN)', '5000000'], ['days', 'المدة (أيام)', '30']] },
  { id: 'operator', label: 'تغيير المشغّل', fields: [['to', 'عنوان المشغّل الجديد', '']] },
];

function buildProposal(t, v, cfg) {
  const eco = getAddress(cfg.eco);
  switch (t) {
    case 'cap': {
      if (!(Number(v.cap) > 0)) throw new Error('أدخل السقف الجديد.');
      return { title: `رفع سقف البيع المسبق إلى ${fmt(Number(v.cap))} USDT`, targets: [eco], calldatas: [encodeCall(ECO_OPS_ABI, 'raiseHardcap', [toWei(v.cap)])] };
    }
    case 'withdraw':
      return { title: 'سحب حصيلة USDT من عقد البيع إلى خزينة DAO', targets: [eco], calldatas: [encodeCall(ECO_OPS_ABI, 'withdrawUSDT', [])] };
    case 'pay': {
      if (!isAddress(v.to || '') || !(Number(v.amount) > 0)) throw new Error('أدخل عنوانًا صحيحًا ومبلغًا.');
      return { title: `صرف ${fmt(Number(v.amount), 2)} USDT من خزينة DAO إلى ${short(v.to)}`, targets: [getAddress(cfg.usdt)], calldatas: [encodeCall(VOTES_ABI, 'transfer', [getAddress(v.to), toWei(v.amount)])] };
    }
    case 'rewards': {
      if (!(Number(v.amount) > 0) || !(Number(v.days) > 0)) throw new Error('أدخل الكمية والمدة.');
      const w = toWei(v.amount);
      return {
        title: `تمويل مكافآت التخزين بـ ${fmt(Number(v.amount))} SHN لمدة ${v.days} يومًا`,
        targets: [getAddress(cfg.shn), eco],
        calldatas: [encodeCall(VOTES_ABI, 'approve', [eco, w]), encodeCall(ECO_OPS_ABI, 'fundRewards', [w, BigInt(Math.round(Number(v.days) * DAY))])],
      };
    }
    case 'operator': {
      if (!isAddress(v.to || '')) throw new Error('عنوان غير صحيح.');
      return { title: `تعيين ${short(v.to)} مشغّلًا للبيع`, targets: [eco], calldatas: [encodeCall(ECO_OPS_ABI, 'setOperator', [getAddress(v.to)])] };
    }
    default: throw new Error('قالب غير معروف');
  }
}

function DaoCard({ cfg, account, data, chainNow, onDone }) {
  const [saved, setSaved] = useState(loadSaved);
  const [rows, setRows] = useState([]);
  const [tpl, setTpl] = useState('cap');
  const [vals, setVals] = useState({});
  const [formErr, setFormErr] = useState('');
  const reload = useCallback(async () => {
    if (!data.dao) return;
    const mine = saved.filter((p) => p.chainId === cfg.chainId && p.dao.toLowerCase() === cfg.dao.toLowerCase());
    setRows(await readProposals(cfg, account, mine));
  }, [saved, cfg, account, data.dao]);
  const tx = useTx({ onDone: async (t) => { await onDone(t); await reload(); } });
  useEffect(() => { reload(); }, [reload, data]);
  if (!data.dao) return null;

  const votes = fromWei(data.votes);
  const threshold = fromWei(data.dao.threshold);
  const delegated = data.delegatee !== ZERO;
  const t = TEMPLATES.find((x) => x.id === tpl);

  const delegateSelf = () => tx.run('del', 'تفعيل قوتك التصويتية', (step) =>
    sendTx(account, { address: cfg.shn, abi: VOTES_ABI, functionName: 'delegate', args: [account] }, step));

  const propose = async () => {
    setFormErr('');
    let p;
    try { p = buildProposal(tpl, { ...Object.fromEntries(t.fields.map(([k, , d]) => [k, d])), ...vals }, cfg); } catch (e) { setFormErr(e.message); return; }
    const description = `${p.title} — ${fmtDate(Math.floor(Date.now() / 1000))}`;
    const values = p.targets.map(() => 0n);
    const res = await tx.run('prop', 'تقديم مقترح للتصويت', (step) =>
      sendTx(account, { address: cfg.dao, abi: DAO_ABI, functionName: 'propose', args: [p.targets, values, p.calldatas, description] }, step));
    if (res?.result != null) {
      const rec = { id: res.result.toString(), chainId: cfg.chainId, dao: cfg.dao, title: p.title, description, targets: p.targets, values: values.map(String), calldatas: p.calldatas, createdAt: Date.now() };
      const next = [rec, ...saved.filter((x) => proposalKey(x) !== proposalKey(rec))].slice(0, 30);
      setSaved(next); saveSaved(next); setVals({});
    }
  };
  const args4 = (p) => [p.targets, p.values.map((x) => BigInt(x)), p.calldatas, keccak256(toHex(p.description))];
  const vote = (p, support) => tx.run(`v${p.id}`, `تصويت ${['ضد', 'مع', 'امتناع'][support]} على: ${p.title}`, (step) =>
    sendTx(account, { address: cfg.dao, abi: DAO_ABI, functionName: 'castVote', args: [BigInt(p.id), support] }, step));
  const queue = (p) => tx.run(`q${p.id}`, `جدولة المقترح في Timelock: ${p.title}`, (step) =>
    sendTx(account, { address: cfg.dao, abi: DAO_ABI, functionName: 'queue', args: args4(p) }, step));
  const execute = (p) => tx.run(`x${p.id}`, `تنفيذ المقترح: ${p.title}`, (step) =>
    sendTx(account, { address: cfg.dao, abi: DAO_ABI, functionName: 'execute', args: args4(p) }, step));
  const forget = (p) => { const next = saved.filter((x) => proposalKey(x) !== proposalKey(p)); setSaved(next); saveSaved(next); };

  return (
    <Card>
      <SectionTitle icon="Scale" title="الحوكمة (Shaheen DAO)" hint={`التصويت يوم بعد التقديم ويستمر أسبوعًا · النصاب ${TOKEN.quorumPct}% · تنفيذ بعد ${TOKEN.timelockHours} ساعة في Timelock`} />
      {!data.dao.ownerIsTimelock && <div className="mb-3"><Notice tone="warn">عقد البيع لم تُنقل ملكيته إلى Timelock بعد، فالمقترحات المنفذة لن تملك صلاحية عليه.</Notice></div>}
      <div className="num grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/60 p-3 text-xs sm:grid-cols-3">
        <div><span className="text-mute">قوة تصويتك</span><div className="font-bold">{fmt(votes)} SHN</div></div>
        <div><span className="text-mute">حد تقديم مقترح</span><div className="font-bold">{fmt(threshold)} SHN</div></div>
        <div><span className="text-mute">التفويض</span><div className="font-bold">{!delegated ? 'غير مفعّل' : data.delegatee === account ? 'لنفسك' : short(data.delegatee)}</div></div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3">
        {!delegated && (
          <>
            <Notice>رصيد SHN لا يُحتسب في التصويت حتى تفعّله. التفعيل معاملة واحدة ولا ينقل عملاتك.</Notice>
            <TxButton tx={tx} k="del" onClick={delegateSelf}><Icon name="CheckCircle2" size={15} />تفعيل قوتي التصويتية</TxButton>
          </>
        )}

        <div className="rounded-xl border border-line bg-ink/40 p-3">
          <p className="mb-2 text-sm font-extrabold">مقترح جديد</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نوع المقترح" htmlFor="dao-tpl">
              <select id="dao-tpl" className={INPUT} value={tpl} onChange={(e) => { setTpl(e.target.value); setVals({}); setFormErr(''); }}>
                {TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            {t.fields.map(([k, l, d]) => (
              <Field key={k} label={l} htmlFor={`dao-${k}`}>
                <input id={`dao-${k}`} className={cls(INPUT, k === 'to' ? 'ltr text-left font-mono text-xs' : 'num')} value={vals[k] ?? d} onChange={(e) => setVals((x) => ({ ...x, [k]: e.target.value.trim() }))} placeholder={k === 'to' ? '0x…' : ''} spellCheck="false" />
              </Field>
            ))}
          </div>
          {formErr && <div className="mt-2"><Notice tone="err">{formErr}</Notice></div>}
          <div className="mt-3">
            <TxButton tx={tx} k="prop" disabled={votes < threshold} onClick={propose}><Icon name="Send" size={15} />تقديم المقترح</TxButton>
            {votes < threshold && <p className="mt-1 text-[11px] text-mute">تحتاج {fmt(threshold)} SHN مفعّلة للتصويت لتقديم مقترح.</p>}
          </div>
        </div>

        <TxResult tx={tx} chainId={cfg.chainId} />

        {rows.length > 0 && (
          <ul className="grid gap-2">
            {rows.map((p) => {
              const totalVotes = p.state >= 0 ? fromWei(p.for) + fromWei(p.against) + fromWei(p.abstain) : 0;
              return (
                <li key={proposalKey(p)} className="rounded-xl border border-line bg-ink/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-bold">{p.title}</p>
                    <Pill status={p.state >= 0 ? PROPOSAL_STATES[p.state] : 'غير موجود'} />
                  </div>
                  {p.state >= 0 && (
                    <>
                      <div className="num mt-2 grid grid-cols-3 gap-2 text-[11px]">
                        <span className="text-emerald-300">مع {fmt(fromWei(p.for))}</span>
                        <span className="text-rose-300">ضد {fmt(fromWei(p.against))}</span>
                        <span className="text-mute">امتناع {fmt(fromWei(p.abstain))}</span>
                      </div>
                      {totalVotes > 0 && <div className="mt-1.5"><Progress value={fromWei(p.for)} max={totalVotes} tone="green" label="نسبة التأييد" /></div>}
                      <p className="num mt-1.5 text-[11px] text-mute">
                        {p.state === 0 && `يبدأ التصويت خلال ${fmtLeft(p.deadline - 7 * DAY - chainNow)}`}
                        {p.state === 1 && `ينتهي التصويت بعد ${fmtLeft(p.deadline - chainNow)}${p.voted ? ' · صوّتّ' : ''}`}
                        {p.state === 5 && (p.eta > chainNow ? `قابل للتنفيذ بعد ${fmtLeft(p.eta - chainNow)}` : 'انتهت مهلة Timelock، جاهز للتنفيذ')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.state === 1 && !p.voted && [1, 0, 2].map((s) => (
                          <TxButton key={s} tx={tx} k={`v${p.id}`} variant={s === 1 ? 'gold' : 'quiet'} className="!px-3 !py-1.5 !text-xs" disabled={votes <= 0} onClick={() => vote(p, s)}>
                            {['ضد', 'مع', 'امتناع'][s]}
                          </TxButton>
                        ))}
                        {p.state === 4 && <TxButton tx={tx} k={`q${p.id}`} className="!px-3 !py-1.5 !text-xs" onClick={() => queue(p)}>جدولة في Timelock</TxButton>}
                        {p.state === 5 && <TxButton tx={tx} k={`x${p.id}`} className="!px-3 !py-1.5 !text-xs" disabled={p.eta > chainNow} onClick={() => execute(p)}>تنفيذ</TxButton>}
                        {[2, 3, 6, 7].includes(p.state) && <Button variant="quiet" className="!px-3 !py-1.5 !text-xs" onClick={() => forget(p)}>إخفاء</Button>}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-mute">تظهر هنا المقترحات المقدمة من هذا الجهاز.</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- لوحة المشغّل
function parseAddresses(text) {
  const good = []; const bad = [];
  const seen = new Set();
  text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).forEach((x) => {
    if (!isAddress(x)) { bad.push(x); return; }
    const c = getAddress(x);
    if (!seen.has(c)) { seen.add(c); good.push(c); }
  });
  return { good, bad };
}

function OperatorCard({ cfg, account, data, onDone }) {
  const tx = useTx({ onDone });
  const [list, setList] = useState('');
  const [bot, setBot] = useState('');
  const [cooldown, setCooldown] = useState(String(data.cooldown));
  const parsed = useMemo(() => parseAddresses(list), [list]);
  const canOperate = data.isOperator || data.isOwner;

  const call = (key, text, functionName, args) => tx.run(key, text, (step) =>
    sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName, args }, step));

  const bulk = (fnName, verb) => tx.run(fnName, `${verb} ${parsed.good.length} محفظة`, async (step) => {
    let last = null;
    for (let i = 0; i < parsed.good.length; i += 200) {
      last = await sendTx(account, { address: cfg.eco, abi: ECO_OPS_ABI, functionName: fnName, args: [parsed.good.slice(i, i + 200)] }, step);
    }
    setList('');
    return last;
  });

  if (!canOperate) return null;
  return (
    <Card>
      <SectionTitle icon="Settings" title="لوحة المشغّل" hint="إدارة البيع اليومية. السقف والأموال والمكافآت قرارات DAO فقط." />
      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 p-3">
          <div><p className="text-sm font-bold">البيع المسبق</p><p className="text-[11px] text-mute">{data.saleActive ? 'مفعّل الآن' : 'متوقف الآن'}</p></div>
          <Toggle id="op-sale" checked={data.saleActive} label="تفعيل البيع" onChange={(v) => !tx.busy && call('sale', v ? 'تفعيل البيع المسبق' : 'إيقاف البيع المسبق', 'setSaleActive', [v])} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 p-3">
          <div><p className="text-sm font-bold">اشتراط القائمة البيضاء</p><p className="text-[11px] text-mute">{data.wlRequired ? 'الشراء للمحافظ المضافة فقط' : 'الشراء مفتوح للجميع'}</p></div>
          <Toggle id="op-wl" checked={data.wlRequired} label="اشتراط القائمة البيضاء" onChange={(v) => !tx.busy && call('wlreq', v ? 'تفعيل اشتراط القائمة البيضاء' : 'فتح الشراء للجميع', 'setWhitelistRequired', [v])} />
        </div>

        <Field label="القائمة البيضاء: عناوين مفصولة بسطر أو فاصلة" htmlFor="op-list" hint={list ? `${parsed.good.length} عنوان صحيح${parsed.bad.length ? ` · ${parsed.bad.length} غير صحيح سيُتجاهل` : ''}${parsed.good.length > 200 ? ` · ستُرسل على ${Math.ceil(parsed.good.length / 200)} معاملات` : ''}` : undefined}>
          <textarea id="op-list" rows={4} className={cls(INPUT, 'ltr text-left font-mono text-[11px]')} value={list} onChange={(e) => setList(e.target.value)} placeholder="0x…" spellCheck="false" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <TxButton tx={tx} k="addToWhitelist" disabled={!parsed.good.length} onClick={() => bulk('addToWhitelist', 'إضافة إلى القائمة البيضاء:')}>إضافة</TxButton>
          <TxButton tx={tx} k="removeFromWhitelist" variant="danger" disabled={!parsed.good.length} onClick={() => bulk('removeFromWhitelist', 'إزالة من القائمة البيضاء:')}>إزالة</TxButton>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Field label="إيقاف محفظة مشبوهة" htmlFor="op-bot">
              <input id="op-bot" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={bot} onChange={(e) => setBot(e.target.value.trim())} placeholder="0x…" spellCheck="false" />
            </Field>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <TxButton tx={tx} k="bot1" variant="danger" className="!px-3 !py-1.5 !text-xs" disabled={!isAddress(bot)} onClick={() => call('bot1', `إيقاف ${short(bot)}`, 'setBot', [getAddress(bot), true])}>إيقاف</TxButton>
              <TxButton tx={tx} k="bot0" variant="quiet" className="!px-3 !py-1.5 !text-xs" disabled={!isAddress(bot)} onClick={() => call('bot0', `رفع الإيقاف عن ${short(bot)}`, 'setBot', [getAddress(bot), false])}>رفع الإيقاف</TxButton>
            </div>
          </div>
          <div>
            <Field label="المهلة بين عمليتي شراء (ثانية)" htmlFor="op-cd">
              <input id="op-cd" inputMode="numeric" className={cls(INPUT, 'num')} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
            </Field>
            <TxButton tx={tx} k="cd" variant="ghost" className="mt-2 w-full !py-1.5 !text-xs" disabled={!(Number(cooldown) >= 0) || Number(cooldown) > DAY || Number(cooldown) === data.cooldown} onClick={() => call('cd', `تعديل المهلة إلى ${cooldown} ثانية`, 'setTradeCooldown', [BigInt(Math.floor(Number(cooldown)))])}>حفظ المهلة</TxButton>
          </div>
        </div>
        <TxResult tx={tx} chainId={cfg.chainId} />
      </div>
    </Card>
  );
}
