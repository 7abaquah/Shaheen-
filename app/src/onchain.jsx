// ============================================================================
// البيع المسبق على BNB Chain — شراء فعلي عبر المحفظة من عقد SHN_EcoSystem v2
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { TOKEN, PRESALE_ENABLED } from './config.js';
import { fmt, quotePresale } from './engine.js';
import {
  NETWORKS, readSale, buyPresale, explainError, explorerTx, referralFromUrl, fromWei, toWei, isAddress,
} from './chain.js';
import { useWallet, WalletGate, short } from './wallet.jsx';
import { Icon, Card, SectionTitle, Button, Field, Notice, Progress, Pill, INPUT, cls, copyText } from './ui.jsx';

const STEP_LABEL = {
  approve: 'وقّع موافقة USDT في المحفظة…',
  'approve-wait': 'بانتظار تأكيد الموافقة على السلسلة…',
  simulate: 'التحقق من شروط العقد…',
  buy: 'وقّع معاملة الشراء في المحفظة…',
  'buy-wait': 'بانتظار تأكيد الشراء على السلسلة…',
};

export function OnchainPresale({ cfg, act, go }) {
  const { wallet, wrongChain, configured, net, setErr: setGateErr } = useWallet();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('100');
  const [ref, setRef] = useState(referralFromUrl);
  const [step, setStep] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [ack, setAck] = useState(false);


  const refresh = useCallback(async (account) => {
    if (!configured) return;
    setLoading(true);
    try {
      setSale(await readSale(cfg, account));
      setErr('');
    } catch (e) {
      setErr(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [cfg, configured]);

  useEffect(() => {
    if (wallet?.account && !wrongChain) refresh(wallet.account);
  }, [wallet?.account, wallet?.chainId, wrongChain, refresh]);

  // فحص مسبق محلي يطابق شروط العقد
  const q = quotePresale(amount, { soldUsdt: sale ? fromWei(sale.totalRaised) : 0, walletSpentUsdt: sale?.spent ? fromWei(sale.spent) : 0 });
  const usdtBal = sale?.usdtBal != null ? fromWei(sale.usdtBal) : null;
  // زمن السلسلة وقت القراءة + ما مضى منذها (لا نعتمد ساعة الجهاز)
  const wall = Math.floor(Date.now() / 1000);
  const chainNow = sale?.chainNow ? Math.max(sale.chainNow + Math.floor((Date.now() - sale.readAt) / 1000), wall) : wall;
  const cooldownLeft = sale?.lastBuy ? Math.max(0, Number(sale.lastBuy) + Number(sale.cooldown) - chainNow) : 0;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [cooldownLeft > 0]);
  const issues = [];
  if (sale?.version === 'v2' && wallet) {
    if (!sale.saleActive) issues.push('البيع غير مفعّل حاليًا.');
    if (sale.wlRequired && !sale.wl) issues.push('محفظتك ليست في القائمة البيضاء.');
    if (sale.bot) issues.push('المحفظة موقوفة عن الشراء.');
    if (usdtBal !== null && Number(amount) > usdtBal) issues.push(`رصيد USDT غير كافٍ (${fmt(usdtBal, 2)}).`);
    if (cooldownLeft > 0) issues.push(`انتظر ${cooldownLeft} ثانية قبل الشراء التالي.`);
    if (ref && !isAddress(ref)) issues.push('عنوان المُحيل غير صحيح.');
  }
  const canBuy = PRESALE_ENABLED && ack && wallet && !wrongChain && sale?.version === 'v2' && q.ok && issues.length === 0 && !step;
  const effectiveRef = sale?.referrer && sale.referrer !== '0x0000000000000000000000000000000000000000' ? sale.referrer : ref;

  const buy = async () => {
    setErr(''); setResult(null);
    try {
      const out = await buyPresale(cfg, wallet.account, amount, ref, (s, hash) => setStep({ s, hash }));
      setResult(out);
      act.pushAudit('PRESALE', `شراء على ${net.short}: ${amount} USDT ← ${out.purchased ? fmt(fromWei(out.purchased.shn)) : '?'} SHN · ${short(out.hash)}`);
      await refresh(wallet.account);
    } catch (e) {
      setErr(explainError(e));
    } finally {
      setStep(null);
    }
  };

  const myRefLink = wallet && typeof location !== 'undefined' ? `${location.origin}${location.pathname}?ref=${wallet.account}#market` : '';

  return (
    <Card>
      <SectionTitle icon="Wallet" title="البيع المسبق على BNB Chain" hint={`شراء فعلي من عقد SHN_EcoSystem v2 · ${TOKEN.presaleRate} SHN لكل USDT · حرق 1% · إحالة 5%`}
        action={net && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-mute">{net.name}</span>} />

      <WalletGate go={go} blockedText="الشراء الفعلي لا يعمل داخل Claude حفاظًا على أموال المشترين. يعمل في نسخة PWA المنشورة على نطاقك، وتجد أدناه نسخة المحاكاة لتجربة التدفق.">{() => (
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="ltr font-mono text-sand">{short(wallet.account)}</span>
            <button type="button" onClick={() => refresh(wallet.account)} className="inline-flex items-center gap-1 text-gold hover:underline" disabled={loading}>
              <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />تحديث
            </button>
          </div>

          {sale?.version === 'unsupported' && (
            <Notice tone="err">العنوان المضبوط ليس عقد SHN_EcoSystem v2. نسخة العقد v1 تصرف للمشتري كمية خاطئة (400 USDT ← 0.000000000000094 SHN)، لذلك الشراء منها معطّل في التطبيق.</Notice>
          )}
          {sale?.addressMismatch && <Notice tone="err">عنوانا USDT أو SHN المضبوطان لا يطابقان ما في العقد. راجع الإعدادات.</Notice>}

          {sale?.version === 'v2' && (
            <>
              <div>
                <div className="num mb-1.5 flex flex-wrap justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 font-bold">المجموع على السلسلة <Pill status={sale.saleActive ? 'نشط' : 'متوقف'} /></span>
                  <span className="ltr text-mute">{fmt(fromWei(sale.totalRaised))} / {fmt(fromWei(sale.hardcap))} USDT</span>
                </div>
                <Progress value={fromWei(sale.totalRaised)} max={fromWei(sale.hardcap)} label="تقدم البيع المسبق على السلسلة" />
              </div>
              <div className="num grid grid-cols-2 gap-2 rounded-xl border border-line bg-ink/60 p-3 text-xs sm:grid-cols-4">
                <div><span className="text-mute">رصيد USDT</span><div className="font-bold">{fmt(usdtBal, 2)}</div></div>
                <div><span className="text-mute">رصيد SHN</span><div className="font-bold text-gold">{fmt(fromWei(sale.shnBal))}</div></div>
                <div><span className="text-mute">مشترياتك</span><div className="ltr text-right font-bold">{fmt(fromWei(sale.spent))} / {fmt(TOKEN.maxBuyUsdt)}</div></div>
                <div><span className="text-mute">القائمة البيضاء</span><div className={cls('font-bold', sale.wl || !sale.wlRequired ? 'text-emerald-300' : 'text-rose-300')}>{sale.wl ? 'مضافة' : sale.wlRequired ? 'غير مضافة' : 'غير مطلوبة'}</div></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="المبلغ (USDT)" htmlFor="oc-amount"><input id="oc-amount" inputMode="decimal" className={cls(INPUT, 'num')} value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!!step} /></Field>
                <Field label="المُحيل" htmlFor="oc-ref" hint={sale.referrer && sale.referrer !== '0x0000000000000000000000000000000000000000' ? 'مُحيلك مسجل في العقد ولا يتغير.' : undefined}>
                  <input id="oc-ref" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={effectiveRef} onChange={(e) => setRef(e.target.value.trim())} placeholder="0x… (اختياري)" disabled={!!step || (sale.referrer && sale.referrer !== '0x0000000000000000000000000000000000000000')} spellCheck="false" />
                </Field>
              </div>
              <div className="num grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-mute">تستلم</span><div className="font-bold text-gold">{fmt(q.received)} SHN</div></div>
                <div><span className="text-mute">يُحرق</span><div className="font-bold text-rose-300">{fmt(q.burned)}</div></div>
                <div><span className="text-mute">للمُحيل</span><div className="font-bold">{effectiveRef ? fmt(q.referral) : '—'}</div></div>
              </div>
              {(!q.ok || issues.length > 0) && Number(amount) > 0 && <Notice tone="warn">{[...q.errors, ...issues].join(' · ')}</Notice>}

              {!PRESALE_ENABLED ? (
                <Notice tone="warn">الشراء على السلسلة غير مفعّل في هذه النسخة إلى حين اكتمال الهيكل النظامي والتراخيص اللازمة. يمكنك متابعة الأرقام أعلاه والاشتراك في التحديثات من تبويب «الاشتراك والمستثمرون».</Notice>
              ) : (
                <>
                  <Notice tone="warn">
                    <strong className="block">قبل الشراء</strong>
                    SHN رمز رقمي عالي المخاطر وقد تفقد قيمته كاملة. هذا ليس عرض أوراق مالية ولا وعدًا بعائد، ومكافآت التخزين متغيرة وغير مضمونة. التدقيق المستقل للعقود لم يكتمل بعد. تأكد أن الشراء مسموح في بلدك، ولا تشترِ بما لا تحتمل خسارته.
                  </Notice>
                  <label htmlFor="oc-ack" className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-sand/90">
                    <input id="oc-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={!!step} className="mt-0.5 h-4 w-4 shrink-0 accent-[#F0A028]" />
                    <span>قرأت المخاطر أعلاه وأتحمل مسؤولية قراري.</span>
                  </label>
                </>
              )}
              <Button onClick={buy} disabled={!canBuy}>
                {step ? <><Icon name="RefreshCw" size={16} className="animate-spin" />{STEP_LABEL[step.s]}</> : <><Icon name="Coins" size={16} />{sale.allowance >= toWei(amount) ? 'شراء SHN' : 'موافقة USDT ثم الشراء'}</>}
              </Button>
              <p className="text-[11px] leading-relaxed text-mute">تُمنح الموافقة على المبلغ نفسه فقط وليس على رصيدك كاملًا. تُدفع رسوم الشبكة بعملة {net.symbol}.</p>

              {result && (
                <Notice tone="ok">
                  تم الشراء{result.purchased ? `: ${fmt(fromWei(result.purchased.shn))} SHN، وحُرق ${fmt(fromWei(result.purchased.burned))}` : ''}.{' '}
                  {explorerTx(cfg.chainId, result.hash)
                    ? <a className="underline" href={explorerTx(cfg.chainId, result.hash)} target="_blank" rel="noreferrer">عرض المعاملة</a>
                    : <span className="ltr font-mono">{short(result.hash)}</span>}
                </Notice>
              )}

              <div className="rounded-xl border border-line bg-ink/60 p-3 text-xs">
                <p className="font-bold">رابط الإحالة الخاص بك · مكافأتك {fmt(fromWei(sale.referralEarned))} SHN</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="ltr min-w-0 flex-1 truncate text-left font-mono text-[11px] text-mute">{myRefLink}</span>
                  <Button variant="quiet" className="!px-2.5 !py-1 !text-[11px]" onClick={async () => { setCopied(await copyText(myRefLink)); setTimeout(() => setCopied(false), 1800); }}>
                    <Icon name="Copy" size={13} />{copied ? 'نُسخ' : 'نسخ'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}</WalletGate>
      {err && <div className="mt-3"><Notice tone="err">{err}</Notice></div>}
    </Card>
  );
}

// إعداد عناوين العقود (تبويب النظام)
export function ChainSettings({ cfg, onSave }) {
  const [f, setF] = useState(cfg);
  const [saved, setSaved] = useState(false);
  const ok = (a) => !a || isAddress(a);
  const valid = ok(f.eco) && ok(f.shn) && ok(f.usdt) && ok(f.airdrop) && ok(f.dao);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: k === 'chainId' ? Number(e.target.value) : e.target.value.trim() }));
  return (
    <Card>
      <SectionTitle icon="Blocks" title="ربط عقود SHN v2" hint="الصق محتوى deployments/<chainId>-app-config.json بعد النشر، أو أدخل العناوين يدويًا. التطبيق يرفض العقد القديم v1." />
      <PasteConfig onParsed={(c) => setF((x) => ({ ...x, ...c }))} />
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!valid) return; onSave(f); setSaved(true); setTimeout(() => setSaved(false), 2200); }}>
        <Field label="الشبكة" htmlFor="ch-net">
          <select id="ch-net" className={INPUT} value={f.chainId} onChange={set('chainId')}>
            {Object.values(NETWORKS).map((n) => <option key={n.id} value={n.id}>{n.name} ({n.id})</option>)}
          </select>
        </Field>
        {[['eco', 'SHN_EcoSystem'], ['shn', 'SHN (BEP-20)'], ['usdt', 'USDT'], ['airdrop', 'SHN_Airdrop (اختياري)'], ['dao', 'SHN_DAO (اختياري)']].map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`ch-${k}`} hint={!ok(f[k]) ? 'عنوان غير صحيح.' : k === 'usdt' && f.chainId === 56 ? 'USDT الرسمي على BNB Chain: 0x55d3…7955' : undefined}>
            <input id={`ch-${k}`} className={cls(INPUT, 'ltr text-left font-mono text-xs', !ok(f[k]) && 'border-rose-400/60')} value={f[k] || ''} onChange={set(k)} placeholder="0x…" spellCheck="false" />
          </Field>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!valid}>حفظ</Button>
          {saved && <span className="text-xs text-emerald-300">حُفظ الربط.</span>}
        </div>
      </form>
    </Card>
  );
}

function PasteConfig({ onParsed }) {
  const [txt, setTxt] = useState('');
  const [msg, setMsg] = useState('');
  const apply = () => {
    try {
      const j = JSON.parse(txt);
      const c = j.contracts ? { chainId: j.chainId, eco: j.contracts.EcoSystem, shn: j.contracts.SHN, usdt: j.contracts.USDT, airdrop: j.contracts.Airdrop, dao: j.contracts.DAO } : j;
      const keep = {};
      ['chainId', 'eco', 'shn', 'usdt', 'airdrop', 'dao'].forEach((k) => { if (c[k] != null) keep[k] = k === 'chainId' ? Number(c[k]) : String(c[k]); });
      if (!keep.eco) throw new Error();
      onParsed(keep); setMsg('عُبّئت الحقول. راجعها ثم احفظ.'); setTxt('');
    } catch { setMsg('النص ليس ملف إعداد صالحًا.'); }
  };
  return (
    <div className="mb-3 grid gap-2">
      <label htmlFor="ch-paste" className="sr-only">لصق ملف الإعداد</label>
      <textarea id="ch-paste" rows={2} className={cls(INPUT, 'ltr text-left font-mono text-[11px]')} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder='{"chainId":97,"eco":"0x…", …}' spellCheck="false" />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="quiet" className="!px-3 !py-1.5 !text-xs" onClick={apply} disabled={!txt.trim()}>تعبئة من الملف</Button>
        {msg && <span className="text-[11px] text-mute">{msg}</span>}
      </div>
    </div>
  );
}
