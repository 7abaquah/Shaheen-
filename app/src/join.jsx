// ============================================================================
// الاشتراك والمستثمرون: تحديثات الجمهور، باقات الأعمال، تسجيل اهتمام المستثمرين
// يتصل بخادم الاشتراكات وفق contract/API.md — لا تُجمع بيانات بطاقات ولا تُقبل أموال
// ============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Card, SectionTitle, Button, Field, Notice, INPUT, Icon, cls } from './ui.jsx';
import { insideClaude } from './chain.js';
import { PAY_METHODS, TICKETS, normalizePhone, validateSubscribe, validatePlanRequest, validateInvestor } from './forms.js';

const CONSENT_TEXT = 'أوافق على معالجة بياناتي لهذا الغرض وفق سياسة الخصوصية ونظام حماية البيانات الشخصية في المملكة.';

const INTERESTS = [
  { id: 'app', label: 'التطبيق' },
  { id: 'presale', label: 'البيع المسبق' },
  { id: 'mining', label: 'التعدين (عقد الحوسبة)' },
  { id: 'staking', label: 'التخزين' },
  { id: 'news', label: 'الأخبار والإعلانات' },
];

const COUNTRIES = [
  ['SA', 'السعودية'], ['AE', 'الإمارات'], ['KW', 'الكويت'], ['QA', 'قطر'], ['BH', 'البحرين'], ['OM', 'عُمان'],
  ['EG', 'مصر'], ['JO', 'الأردن'], ['MA', 'المغرب'], ['TR', 'تركيا'], ['PK', 'باكستان'], ['MY', 'ماليزيا'],
  ['ID', 'إندونيسيا'], ['GB', 'المملكة المتحدة'], ['DE', 'ألمانيا'], ['FR', 'فرنسا'], ['CH', 'سويسرا'],
  ['US', 'الولايات المتحدة'], ['CA', 'كندا'], ['SG', 'سنغافورة'],
];

const ERR_TEXT = {
  invalid: 'بعض الحقول تحتاج تصحيحًا.',
  captcha_failed: 'تعذّر التحقق من أنك لست برنامجًا آليًا. أعد المحاولة.',
  forbidden_origin: 'هذا التطبيق غير مسموح له بالاتصال بالخادم. تواصل مع الدعم.',
  rate_limited: 'محاولات كثيرة من هذا الجهاز. حاول بعد ساعة.',
  payload_too_large: 'الرسالة أطول من المسموح.',
  server_error: 'خطأ مؤقت في الخادم. حاول لاحقًا.',
  network: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت.',
};

// ---------------------------------------------------------------- الاتصال
async function apiCall(base, path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(base.replace(/\/+$/, '') + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: 'omit',
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const code = (data && data.code) || (res.status === 429 ? 'rate_limited' : 'server_error');
      return { ok: false, code, message: (data && data.message) || ERR_TEXT[code] || ERR_TEXT.server_error, fields: (data && data.fields) || {} };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, code: 'network', message: ERR_TEXT.network, fields: {} };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- Turnstile
let turnstileLoading = null;
function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoading) {
    turnstileLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')));
      s.onerror = () => { turnstileLoading = null; reject(new Error('turnstile blocked')); };
      document.head.appendChild(s);
    });
  }
  return turnstileLoading;
}

function Turnstile({ siteKey, onToken, resetKey, websiteUrl }) {
  const box = useRef(null);
  const widget = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) return undefined;
    let alive = true;
    loadTurnstile().then((ts) => {
      if (!alive || !box.current) return;
      widget.current = ts.render(box.current, {
        sitekey: siteKey,
        theme: 'dark',
        language: 'ar',
        callback: (t) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setFailed(true); },
      });
    }).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      try { if (widget.current && window.turnstile) window.turnstile.remove(widget.current); } catch { /* ignore */ }
      widget.current = null;
    };
  }, [siteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // إعادة ضبط بعد كل إرسال (الرمز يُستخدم مرة واحدة)
  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) {
      try { window.turnstile.reset(widget.current); } catch { /* ignore */ }
      onToken('');
    }
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!siteKey) {
    return <p className="text-[11px] text-mute">التحقق الآلي غير مُعدّ في هذه النسخة — يقبل الطلب خادم التطوير فقط.</p>;
  }
  return (
    <div className="min-w-0">
      <div ref={box} className="min-h-[65px]" />
      {failed && (
        <Notice tone="warn">
          تعذّر تحميل التحقق داخل هذا التطبيق.
          {websiteUrl ? <> أكمل الطلب من الموقع الرسمي: <a className="ltr font-mono text-gold underline" href={websiteUrl} target="_blank" rel="noopener noreferrer">{websiteUrl.replace(/^https:\/\//, '')}</a></> : ' أعد المحاولة لاحقًا.'}
        </Notice>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- عناصر النموذج
function Err({ id, msg }) {
  return msg ? <p id={id} className="mt-1 text-[11px] font-bold text-rose-300">{msg}</p> : null;
}

function Input({ id, label, value, onChange, error, hint, ltr, ...rest }) {
  return (
    <Field label={label} htmlFor={id} hint={error ? undefined : hint}>
      <input
        id={id} value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className={cls(INPUT, ltr && 'ltr text-left', error && 'border-rose-400/60')}
        {...rest}
      />
      <Err id={`${id}-err`} msg={error} />
    </Field>
  );
}

function Consent({ id, checked, onChange, error }) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-sand/90">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#F0A028]" aria-invalid={!!error} />
        <span>{CONSENT_TEXT}</span>
      </label>
      <Err id={`${id}-err`} msg={error} />
    </div>
  );
}

// حقل فخ للبرامج الآلية — مخفي عن البشر وقارئات الشاشة
function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-px w-px overflow-hidden opacity-0 [clip:rect(0,0,0,0)]">
      <label>اترك هذا الحقل فارغًا<input tabIndex={-1} autoComplete="off" name="website" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

function useSubmit(api) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ok, reference?} | {ok:false, message}
  const [serverFields, setServerFields] = useState({});
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const blocked = insideClaude();

  const submit = async (path, body) => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setServerFields({});
    const r = await apiCall(api.apiBase, path, { method: 'POST', body: { ...body, turnstileToken: api.turnstileSiteKey ? token : 'dev-disabled' } });
    setBusy(false);
    setToken(''); // رمز Turnstile يُستخدم مرة واحدة: لا يُعاد استعماله في الإرسال التالي
    setResetKey((k) => k + 1);
    if (r.ok) setResult({ ok: true, reference: r.data && r.data.reference });
    else { setResult({ ok: false, message: r.message }); setServerFields(r.fields || {}); }
    return r.ok;
  };
  const needToken = !!api.turnstileSiteKey && !token;
  return { busy, result, setResult, serverFields, submit, setToken, resetKey, needToken, blocked };
}

function SubmitRow({ s, label, api }) {
  return (
    <div className="grid gap-3">
      <Turnstile siteKey={api.turnstileSiteKey} onToken={s.setToken} resetKey={s.resetKey} websiteUrl={api.websiteUrl} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={s.busy || s.blocked || !api.apiBase || s.needToken}>
          <Icon name={s.busy ? 'RefreshCw' : 'Send'} size={15} className={s.busy ? 'animate-spin' : ''} />
          {s.busy ? 'جارٍ الإرسال…' : label}
        </Button>
        {s.needToken && <span className="text-[11px] text-mute">أكمل التحقق أولًا.</span>}
      </div>
      {s.result && !s.result.ok && <Notice tone="err">{s.result.message}</Notice>}
    </div>
  );
}

function Success({ title, reference, children, onAgain }) {
  return (
    <div className="grid gap-3">
      <Notice tone="ok">
        <strong className="block text-sm">{title}</strong>
        {reference && <span className="mt-1 block">رقم المرجع: <span className="num ltr font-mono font-bold">{reference}</span> — احتفظ به للمتابعة.</span>}
        {children}
      </Notice>
      <div><Button variant="quiet" onClick={onAgain}>إرسال طلب آخر</Button></div>
    </div>
  );
}

// ---------------------------------------------------------------- 1) تحديثات الجمهور
function PublicForm({ api }) {
  const empty = { name: '', email: '', phone: '', interests: ['app', 'news'], consent: false, website: '' };
  const [f, setF] = useState(empty);
  const [errs, setErrs] = useState({});
  const s = useSubmit(api);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const fe = { ...errs, ...s.serverFields };

  if (s.result && s.result.ok) {
    return (
      <Success title="تم تسجيل اشتراكك في تحديثات شاهين." onAgain={() => { setF(empty); s.setResult(null); }}>
        <span className="mt-1 block">إذا كان بريدك مسجّلًا من قبل فلن يتكرر الاشتراك.</span>
      </Success>
    );
  }
  const onSubmit = (e) => {
    e.preventDefault();
    const v = validateSubscribe(f);
    setErrs(v);
    if (Object.keys(v).length) return;
    s.submit('/subscribe', {
      name: f.name.trim(), email: f.email.trim(), ...(f.phone.trim() ? { phone: normalizePhone(f.phone) } : {}),
      lang: 'ar', interests: f.interests, consent: true, website: f.website,
    });
  };
  const toggle = (id) => setF((x) => ({ ...x, interests: x.interests.includes(id) ? x.interests.filter((i) => i !== id) : [...x.interests, id] }));
  return (
    <form className="relative grid gap-3.5" onSubmit={onSubmit} noValidate>
      <Honeypot value={f.website} onChange={set('website')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input id="pub-name" label="الاسم" value={f.name} onChange={set('name')} error={fe.name} autoComplete="name" maxLength={80} />
        <Input id="pub-email" label="البريد الإلكتروني" type="email" ltr value={f.email} onChange={set('email')} error={fe.email} autoComplete="email" inputMode="email" />
        <Input id="pub-phone" label="الجوال (اختياري)" ltr value={f.phone} onChange={set('phone')} error={fe.phone} autoComplete="tel" inputMode="tel" placeholder="+9665XXXXXXXX" />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs font-bold text-mute">ما الذي يهمك؟</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = f.interests.includes(i.id);
            return (
              <label key={i.id} className={cls('cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition', on ? 'border-gold/60 bg-gold/15 text-gold' : 'border-line text-mute hover:text-sand')}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(i.id)} />
                {i.label}
              </label>
            );
          })}
        </div>
        <Err id="pub-int-err" msg={fe.interests} />
      </fieldset>
      <Consent id="pub-consent" checked={f.consent} onChange={set('consent')} error={fe.consent} />
      <SubmitRow s={s} api={api} label="اشترك في التحديثات" />
    </form>
  );
}

// ---------------------------------------------------------------- 2) باقات الأعمال
function PlansSection({ api }) {
  const [plans, setPlans] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const blocked = insideClaude();
  useEffect(() => {
    if (!api.apiBase || blocked) return undefined;
    let alive = true;
    apiCall(api.apiBase, '/plans').then((r) => {
      if (!alive) return;
      if (r.ok && r.data && Array.isArray(r.data.plans)) setPlans(r.data.plans);
      else setLoadErr(r.message || ERR_TEXT.server_error);
    });
    return () => { alive = false; };
  }, [api.apiBase, blocked]);

  const empty = { planId: '', organization: '', contactName: '', email: '', phone: '', paymentMethod: 'bank', seats: '', notes: '', consent: false, website: '' };
  const [f, setF] = useState(empty);
  const [errs, setErrs] = useState({});
  const s = useSubmit(api);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const fe = { ...errs, ...s.serverFields };
  const ids = (plans || []).map((p) => p.id);

  const onSubmit = (e) => {
    e.preventDefault();
    const v = validatePlanRequest(f, ids);
    setErrs(v);
    if (Object.keys(v).length) return;
    s.submit('/plan-requests', {
      planId: f.planId, organization: f.organization.trim(), contactName: f.contactName.trim(), email: f.email.trim(),
      phone: normalizePhone(f.phone), paymentMethod: f.paymentMethod,
      ...(f.seats !== '' ? { seats: Number(f.seats) } : {}), ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
      consent: true, website: f.website,
    });
  };

  return (
    <div className="grid gap-4">
      {loadErr && <Notice tone="err">{loadErr}</Notice>}
      {!plans && !loadErr && api.apiBase && !blocked && <p className="text-xs text-mute">جارٍ تحميل الباقات…</p>}
      {plans && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {plans.map((p) => {
            const on = f.planId === p.id;
            return (
              <button key={p.id} type="button" onClick={() => set('planId')(p.id)} aria-pressed={on}
                className={cls('min-w-0 rounded-2xl border p-4 text-right transition', on ? 'border-gold/70 bg-gold/10' : 'border-line bg-panel hover:border-gold/40')}>
                <div className="font-display text-base font-extrabold text-sand">{p.nameAr}</div>
                <div className="num mt-1 font-display text-2xl font-black text-gold">{Number(p.priceSar).toLocaleString('en-US')} <span className="text-xs font-bold text-mute">ر.س / شهريًا</span></div>
                <ul className="mt-3 grid gap-1.5 text-xs text-sand/85">
                  {(p.featuresAr || []).map((x) => <li key={x} className="flex items-start gap-1.5"><Icon name="CheckCircle2" size={13} className="mt-0.5 shrink-0 text-gold" />{x}</li>)}
                </ul>
              </button>
            );
          })}
        </div>
      )}
      {plans && <p className="text-[11px] text-mute">الأسعار قبل ضريبة القيمة المضافة، وتُؤكَّد في الفاتورة.</p>}

      {s.result && s.result.ok ? (
        <Success title="استلمنا طلب الاشتراك." reference={s.result.reference} onAgain={() => { setF(empty); s.setResult(null); }}>
          <span className="mt-1 block">يتواصل معك فريق المبيعات ويُصدر الفاتورة بطريقة الدفع التي اخترتها. لا يُطلب منك إدخال بيانات بطاقة في التطبيق.</span>
        </Success>
      ) : (
        <form className="relative grid gap-3.5" onSubmit={onSubmit} noValidate>
          <Honeypot value={f.website} onChange={set('website')} />
          <Err id="plan-id-err" msg={fe.planId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input id="plan-org" label="اسم الجهة" value={f.organization} onChange={set('organization')} error={fe.organization} autoComplete="organization" maxLength={120} />
            <Input id="plan-contact" label="اسم المسؤول" value={f.contactName} onChange={set('contactName')} error={fe.contactName} autoComplete="name" maxLength={80} />
            <Input id="plan-email" label="البريد الإلكتروني" type="email" ltr value={f.email} onChange={set('email')} error={fe.email} autoComplete="email" inputMode="email" />
            <Input id="plan-phone" label="الجوال" ltr value={f.phone} onChange={set('phone')} error={fe.phone} autoComplete="tel" inputMode="tel" placeholder="+9665XXXXXXXX" />
            <Input id="plan-seats" label="عدد المستخدمين (اختياري)" ltr value={f.seats} onChange={set('seats')} error={fe.seats} inputMode="numeric" placeholder="1 – 500" />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-mute">طريقة الدفع المفضلة</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PAY_METHODS.map((m) => (
                <label key={m.id} className={cls('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold', f.paymentMethod === m.id ? 'border-gold/60 bg-gold/10 text-gold' : 'border-line text-sand/80')}>
                  <input type="radio" name="plan-pay" value={m.id} checked={f.paymentMethod === m.id} onChange={() => set('paymentMethod')(m.id)} className="accent-[#F0A028]" />
                  {m.label}
                </label>
              ))}
            </div>
            <Err id="plan-pay-err" msg={fe.paymentMethod} />
          </fieldset>
          <Field label="ملاحظات (اختياري)" htmlFor="plan-notes">
            <textarea id="plan-notes" rows={3} maxLength={1000} value={f.notes} onChange={(e) => set('notes')(e.target.value)} className={cls(INPUT, fe.notes && 'border-rose-400/60')} />
            <Err id="plan-notes-err" msg={fe.notes} />
          </Field>
          <Consent id="plan-consent" checked={f.consent} onChange={set('consent')} error={fe.consent} />
          <SubmitRow s={s} api={api} label="أرسل طلب الاشتراك" />
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- 3) المستثمرون
function InvestorForm({ api }) {
  const empty = { fullName: '', email: '', phone: '', country: 'SA', countryOther: '', investorType: 'individual', organization: '', ticketRange: '', qualifiedDeclaration: false, message: '', consent: false, website: '' };
  const [f, setF] = useState(empty);
  const [errs, setErrs] = useState({});
  const s = useSubmit(api);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const fe = { ...errs, ...s.serverFields };

  const onSubmit = (e) => {
    e.preventDefault();
    const v = validateInvestor(f);
    setErrs(v);
    if (Object.keys(v).length) return;
    const country = (f.country === 'OTHER' ? f.countryOther : f.country).trim().toUpperCase();
    s.submit('/investors', {
      fullName: f.fullName.trim(), email: f.email.trim(), phone: normalizePhone(f.phone), country,
      investorType: f.investorType, ...(f.organization.trim() ? { organization: f.organization.trim() } : {}),
      ticketRange: f.ticketRange, qualifiedDeclaration: !!f.qualifiedDeclaration,
      ...(f.message.trim() ? { message: f.message.trim() } : {}), lang: 'ar', consent: true, website: f.website,
    });
  };

  return (
    <div className="grid gap-4">
      <Notice tone="warn">
        <strong className="block">تسجيل اهتمام فقط</strong>
        هذا النموذج ليس عرضًا لأوراق مالية ولا دعوة للاكتتاب، ولا نقبل عبره أي أموال. أي استثمار في مجموعة شاهين لا يتم إلا بعد اكتمال الهيكل النظامي والتراخيص اللازمة، والتحقق من الهوية (KYC)، وتوقيع مستندات رسمية. لن يطلب منك أحد من فريقنا تحويل أموال أو مشاركة المفتاح الخاص لمحفظتك.
      </Notice>
      {s.result && s.result.ok ? (
        <Success title="سُجّل اهتمامك." reference={s.result.reference} onAgain={() => { setF(empty); s.setResult(null); }}>
          <span className="mt-1 block">يراجع فريق علاقات المستثمرين الطلب ويتواصل معك عبر البريد الإلكتروني الرسمي للمجموعة.</span>
        </Success>
      ) : (
        <form className="relative grid gap-3.5" onSubmit={onSubmit} noValidate>
          <Honeypot value={f.website} onChange={set('website')} />
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold text-mute">نوع المستثمر</legend>
            <div className="flex flex-wrap gap-2">
              {[['individual', 'فرد'], ['institution', 'مؤسسة']].map(([id, label]) => (
                <label key={id} className={cls('flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold', f.investorType === id ? 'border-gold/60 bg-gold/10 text-gold' : 'border-line text-sand/80')}>
                  <input type="radio" name="inv-type" checked={f.investorType === id} onChange={() => set('investorType')(id)} className="accent-[#F0A028]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input id="inv-name" label="الاسم الكامل" value={f.fullName} onChange={set('fullName')} error={fe.fullName} autoComplete="name" maxLength={100} />
            <Input id="inv-org" label={f.investorType === 'institution' ? 'اسم المؤسسة' : 'جهة العمل (اختياري)'} value={f.organization} onChange={set('organization')} error={fe.organization} autoComplete="organization" maxLength={120} />
            <Input id="inv-email" label="البريد الإلكتروني" type="email" ltr value={f.email} onChange={set('email')} error={fe.email} autoComplete="email" inputMode="email" />
            <Input id="inv-phone" label="الجوال" ltr value={f.phone} onChange={set('phone')} error={fe.phone} autoComplete="tel" inputMode="tel" placeholder="+9665XXXXXXXX" />
            <Field label="الدولة" htmlFor="inv-country">
              <select id="inv-country" value={f.country} onChange={(e) => set('country')(e.target.value)} className={cls(INPUT, fe.country && 'border-rose-400/60')}>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                <option value="OTHER">دولة أخرى…</option>
              </select>
              {f.country !== 'OTHER' && <Err id="inv-country-err" msg={fe.country} />}
            </Field>
            {f.country === 'OTHER' && (
              <Input id="inv-country-other" label="رمز الدولة (حرفان)" ltr value={f.countryOther} onChange={(v) => set('countryOther')(v.slice(0, 2))} error={fe.country} placeholder="NG" autoComplete="country" />
            )}
            <Field label="نطاق الاهتمام (بالدولار)" htmlFor="inv-ticket">
              <select id="inv-ticket" value={f.ticketRange} onChange={(e) => set('ticketRange')(e.target.value)} className={cls(INPUT, fe.ticketRange && 'border-rose-400/60')}>
                <option value="">اختر…</option>
                {TICKETS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <Err id="inv-ticket-err" msg={fe.ticketRange} />
            </Field>
          </div>
          <label htmlFor="inv-qualified" className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-sand/90">
            <input id="inv-qualified" type="checkbox" checked={f.qualifiedDeclaration} onChange={(e) => set('qualifiedDeclaration')(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#F0A028]" />
            <span>أُقرّ بأنني مستثمر مؤهل أو محترف وفق أنظمة بلدي (إقرار ذاتي يُتحقق منه لاحقًا).</span>
          </label>
          <Field label="رسالة (اختياري)" htmlFor="inv-msg">
            <textarea id="inv-msg" rows={3} maxLength={1500} value={f.message} onChange={(e) => set('message')(e.target.value)} className={cls(INPUT, fe.message && 'border-rose-400/60')} />
            <Err id="inv-msg-err" msg={fe.message} />
          </Field>
          <Consent id="inv-consent" checked={f.consent} onChange={set('consent')} error={fe.consent} />
          <SubmitRow s={s} api={api} label="سجّل اهتمامك" />
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- التبويب
const SECTIONS = [
  { id: 'public', label: 'الجمهور', icon: 'Megaphone' },
  { id: 'plans', label: 'باقات الأعمال', icon: 'Layers' },
  { id: 'investors', label: 'المستثمرون', icon: 'Landmark' },
];

export function JoinTab({ api }) {
  const [sec, setSec] = useState('public');
  const blocked = insideClaude();
  return (
    <div className="grid gap-4">
      <Card>
        <SectionTitle icon="Handshake" title="الاشتراك والمستثمرون" hint="ثلاث قنوات: تحديثات عامة للجمهور، طلب باقة تشغيلية للجهات، وتسجيل اهتمام للمستثمرين." />
        {blocked && <Notice tone="info">النماذج ترسل إلى خادم شاهين، وتعمل في التطبيق المنشور وتطبيق الجوال. داخل Claude تظهر للمعاينة فقط.</Notice>}
        {!blocked && !api.apiBase && <Notice tone="warn">خادم الاشتراكات غير مضبوط بعد. يضبطه المالك من تبويب «النظام».</Notice>}
        <div role="tablist" aria-label="أقسام الاشتراك" className="mt-3 grid grid-cols-3 gap-1.5 rounded-2xl border border-line bg-ink p-1">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={sec === x.id} onClick={() => setSec(x.id)}
              className={cls('flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-extrabold transition sm:text-xs', sec === x.id ? 'bg-gold text-ink' : 'text-mute hover:text-sand')}>
              <Icon name={x.icon} size={14} className="shrink-0" /><span className="truncate">{x.label}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        {sec === 'public' && <PublicForm api={api} />}
        {sec === 'plans' && <PlansSection api={api} />}
        {sec === 'investors' && <InvestorForm api={api} />}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- إعدادات المالك
export function ApiSettings({ api, onSave }) {
  const [v, setV] = useState(api);
  const [msg, setMsg] = useState('');
  const httpsOk = (u) => !u || /^https:\/\/[^\s]+$/.test(u.trim()) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(u.trim());
  const valid = httpsOk(v.apiBase) && httpsOk(v.websiteUrl) && httpsOk(v.appUrl) && /^[\w-]*$/.test(v.turnstileSiteKey.trim());
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const test = async () => {
    setMsg('جارٍ الفحص…');
    const r = await apiCall(v.apiBase.trim(), '/health');
    setMsg(r.ok ? 'الخادم يعمل ويقبل هذا النطاق.' : r.message);
  };
  return (
    <Card>
      <SectionTitle icon="Handshake" title="خادم الاشتراكات" hint="Cloudflare Worker + D1. أضف نطاق التطبيق و https://localhost و capacitor://localhost إلى ALLOWED_ORIGINS في الخادم." />
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (!valid) return; onSave({ apiBase: v.apiBase.trim(), turnstileSiteKey: v.turnstileSiteKey.trim(), websiteUrl: v.websiteUrl.trim(), appUrl: v.appUrl.trim() }); setMsg('حُفظ.'); }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="رابط الخادم" htmlFor="api-base" hint="مثال: https://api.نطاقك/v1">
            <input id="api-base" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={v.apiBase} onChange={set('apiBase')} spellCheck="false" placeholder="https://…/v1" />
          </Field>
          <Field label="مفتاح Turnstile العام" htmlFor="api-ts" hint="المفتاح العام فقط؛ السري يبقى في الخادم.">
            <input id="api-ts" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={v.turnstileSiteKey} onChange={set('turnstileSiteKey')} spellCheck="false" placeholder="0x4AAAA…" />
          </Field>
          <Field label="الموقع الرسمي" htmlFor="api-web">
            <input id="api-web" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={v.websiteUrl} onChange={set('websiteUrl')} spellCheck="false" placeholder="https://…" />
          </Field>
          <Field label="رابط التطبيق العام" htmlFor="api-app" hint="تستخدمه روابط المحافظ في تطبيق الجوال.">
            <input id="api-app" className={cls(INPUT, 'ltr text-left font-mono text-xs')} value={v.appUrl} onChange={set('appUrl')} spellCheck="false" placeholder="https://app.…" />
          </Field>
        </div>
        {!valid && <Notice tone="err">الروابط يجب أن تبدأ بـ https:// (أو http://localhost للتطوير).</Notice>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!valid}>حفظ</Button>
          <Button variant="quiet" disabled={!v.apiBase || !valid || insideClaude()} onClick={test}>فحص الاتصال</Button>
          {msg && <span className="text-xs text-mute">{msg}</span>}
        </div>
      </form>
    </Card>
  );
}
