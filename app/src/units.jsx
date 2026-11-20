// ============================================================================
// الوحدات التشغيلية العشر — محادثة وتقارير عبر Claude داخل التطبيق
// ============================================================================
import React, { useRef, useState, useEffect } from 'react';
import { UNITS } from './config.js';
import { platformSnapshot } from './engine.js';
import { Icon, Card, SectionTitle, Button, Notice, INPUT, cls } from './ui.jsx';

const ERROR_COPY = {
  not_granted: 'لم يُسمح للتطبيق باستخدام Claude. يمكن تفعيله من أذونات الصفحة.',
  sampling_disabled: 'Claude غير متاح لهذا الحساب.',
  rate_limited: 'عدد الطلبات كبير الآن. حاول بعد قليل.',
  session_expired: 'انتهت الجلسة. سجّل الدخول إلى Claude من جديد.',
  refused: 'تعذّر الرد على هذا الطلب. أعد صياغته.',
  prompt_too_large: 'المحادثة طويلة. ابدأ محادثة جديدة.',
  empty_completion: 'لم يصل رد. جرّب سؤالًا أقصر.',
  upstream_error: 'انقطع الاتصال. حاول مرة أخرى.',
};
const copyFor = (code) => ERROR_COPY[code] || ERROR_COPY.upstream_error;
const HARD_STOP = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

function rulesFor(unit, state) {
  return [
    `أنت ${unit.name} (${unit.code}) في مجموعة شاهين، وهي وحدة تشغيلية متخصصة ترفع تقاريرها مباشرة إلى الرئيس التنفيذي.`,
    `اختصاص الوحدة: ${unit.mandate}`,
    `مؤشرات الأداء التي تتابعها: ${unit.kpis.join('، ')}.`,
    'قواعد الرد:',
    '- اكتب بالعربية بلغة مهنية مباشرة ومصطلحات تقنية إنجليزية عند الحاجة، دون أي لغة مجازية أو ملحمية.',
    '- ابدأ بالخلاصة في سطر أو سطرين، ثم الإجراءات المقترحة مرقمة مع الجهة المسؤولة والمدة الزمنية.',
    '- استند إلى بيانات المنصة أدناه واذكر الأرقام عند الحاجة. هي بيانات محاكاة داخل نموذج أولي، فلا تقدمها كبيانات سوق حقيقية.',
    '- لا تعد بعوائد ولا تنفذ عمليات مالية. ميّز بوضوح بين التحليل والتوصية وبين التنفيذ الذي يحتاج قرار الرئيس التنفيذي.',
    '- أشر إلى المخاطر التنظيمية أو الأمنية متى كانت ذات صلة.',
    '- لا تتجاوز 220 كلمة ما لم يُطلب تفصيل.',
    '',
    'بيانات المنصة الحالية (JSON):',
    JSON.stringify(platformSnapshot(state)),
  ].join('\n');
}

export function UnitsTab({ state, sample, samplingReady, act }) {
  const [activeId, setActiveId] = useState(UNITS[0].id);
  const [threads, setThreads] = useState({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(false);
  const ctlRef = useRef(null);
  const listRef = useRef(null);
  const unit = UNITS.find((u) => u.id === activeId);
  const turns = threads[activeId] || [];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => () => ctlRef.current?.abort(), []);

  const setTurns = (id, fn) => setThreads((t) => ({ ...t, [id]: fn(t[id] || []) }));

  const ask = async (text, kind = 'chat') => {
    if (!sample || busy || !text.trim()) return;
    const id = activeId;
    const u = unit;
    setError('');
    setBusy(true);
    const ctl = new AbortController();
    ctlRef.current = ctl;
    const userTurn = { role: 'user', content: text.trim(), kind };
    const history = [...(threads[id] || []), userTurn];
    setTurns(id, () => [...history, { role: 'assistant', content: '', pending: true }]);
    setInput('');
    const msgs = [{ role: 'user', content: rulesFor(u, state) }, ...history.slice(-10).map(({ role, content }) => ({ role, content }))];
    try {
      const { text: answer, truncated } = await sample(msgs, {
        cache: false,
        signal: ctl.signal,
        onText: ({ text: t }) => setTurns(id, (prev) => [...prev.slice(0, -1), { role: 'assistant', content: t, pending: true }]),
      });
      setTurns(id, (prev) => [...prev.slice(0, -1), { role: 'assistant', content: answer + (truncated ? '\n\n(انقطع الرد لطوله)' : '') }]);
      if (kind === 'report') act.pushAudit('UNITS', `${u.code} رفع تقريرًا إلى الرئيس التنفيذي.`);
    } catch (e) {
      const partial = e?.text;
      setTurns(id, (prev) => {
        const base = prev.slice(0, -1);
        return partial ? [...base, { role: 'assistant', content: `${partial}\n\n(توقف)` }] : base;
      });
      if (e?.code !== 'cancelled') setError(copyFor(e?.code));
      if (HARD_STOP.has(e?.code)) setDisabled(true);
    } finally {
      setBusy(false);
      ctlRef.current = null;
    }
  };

  const available = sample && !disabled;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <SectionTitle icon="Bot" title="الوحدات التشغيلية" hint="عشر وحدات متخصصة، كل وحدة ترفع تقاريرها مباشرة إلى الرئيس التنفيذي." />
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/5 p-2.5 text-xs">
          <Icon name="User" size={15} className="text-gold" />
          <span className="font-bold">الرئيس التنفيذي</span>
          <span className="text-mute">← خط تقارير مباشر من جميع الوحدات</span>
        </div>
        <ul className="grid gap-2" role="listbox" aria-label="اختيار الوحدة">
          {UNITS.map((u) => (
            <li key={u.id}>
              <button type="button" role="option" aria-selected={u.id === activeId} onClick={() => { setActiveId(u.id); setError(''); }}
                className={cls('flex w-full items-start gap-3 rounded-xl border p-3 text-right transition', u.id === activeId ? 'border-gold/60 bg-gold/10' : 'border-line bg-ink/60 hover:border-gold/30')}>
                <span className={cls('grid h-9 w-9 shrink-0 place-items-center rounded-lg border', u.id === activeId ? 'border-gold/50 text-gold' : 'border-line text-mute')}><Icon name={u.icon} size={17} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2"><span className="ltr font-mono text-[10px] text-mute">{u.code}</span><span className="text-sm font-extrabold">{u.name}</span></span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-mute">{u.mandate}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex min-h-[480px] flex-col">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-line pb-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-base font-extrabold"><Icon name={unit.icon} size={18} className="text-gold" />{unit.name}</p>
            <p className="mt-0.5 text-[11px] text-mute">مؤشرات: {unit.kpis.join(' · ')}</p>
          </div>
          <Button variant="ghost" className="!px-3 !py-1.5 !text-xs" disabled={!available || busy}
            onClick={() => ask(`ارفع تقرير الحالة الدوري للرئيس التنفيذي عن نطاق ${unit.name}: الوضع الحالي بالأرقام، أهم ثلاث مخاطر، وأهم ثلاثة قرارات مطلوبة.`, 'report')}>
            <Icon name="FileText" size={14} />تقرير للرئيس التنفيذي
          </Button>
        </div>

        {!samplingReady && <Notice>جارٍ تجهيز الاتصال بـ Claude…</Notice>}
        {samplingReady && !sample && (
          <Notice tone="warn">الوحدات تعمل داخل Claude مباشرة. في النسخة المنشورة على نطاقك اضبط «خادم الوحدات الذكية» في تبويب النظام بعد نشر مجلد ai-proxy. مفتاح Claude API يبقى في الخادم ولا يصل إلى المتصفح.</Notice>
        )}
        {disabled && <Notice tone="warn">{error || 'Claude غير متاح في هذا العرض.'}</Notice>}

        <div ref={listRef} className="my-3 grid flex-1 content-start gap-3 overflow-y-auto pe-1" style={{ maxHeight: 460 }} aria-live="polite">
          {turns.length === 0 && (
            <div className="grid gap-2 text-xs text-mute">
              <p>اطرح سؤالًا على الوحدة أو اطلب تقريرها. أمثلة:</p>
              {[`ما أولويات ${unit.name} خلال الأسبوعين القادمين؟`, 'ما أكبر خطر تراه في بيانات المنصة الحالية؟', 'ما المطلوب مني كرئيس تنفيذي لاتخاذ القرار؟'].map((q) => (
                <button key={q} type="button" disabled={!available || busy} onClick={() => ask(q)} className="rounded-lg border border-line bg-ink/60 px-3 py-2 text-right text-sand/90 hover:border-gold/40 disabled:opacity-50">{q}</button>
              ))}
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i} className={cls('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-7', t.role === 'user' ? 'justify-self-start border border-gold/25 bg-gold/10 text-goldsoft' : 'justify-self-end border border-line bg-ink/80 text-sand')}>
              {t.content || (t.pending ? <span className="pulse-dot text-mute">يعمل على الرد…</span> : '')}
            </div>
          ))}
        </div>

        {error && !disabled && <Notice tone="err">{error}</Notice>}

        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          <label htmlFor="unit-input" className="sr-only">رسالتك إلى الوحدة</label>
          <input id="unit-input" className={INPUT} value={input} onChange={(e) => setInput(e.target.value)} disabled={!available} placeholder={available ? `اكتب إلى ${unit.name}…` : 'غير متاح في هذا العرض'} />
          {busy ? (
            <Button variant="quiet" onClick={() => ctlRef.current?.abort()} aria-label="إيقاف"><Icon name="Square" size={15} /></Button>
          ) : (
            <Button type="submit" disabled={!available || !input.trim()} aria-label="إرسال"><Icon name="Send" size={15} /></Button>
          )}
        </form>
      </Card>
    </div>
  );
}

// عميل الخادم الوسيط بنفس واجهة sample: (messages, {signal}) => {text, truncated}
export function makeProxySample(url) {
  return async (messages, opts = {}) => {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages }), signal: opts.signal });
    } catch (e) {
      if (e?.name === 'AbortError') throw { code: 'cancelled' };
      throw { code: 'upstream_error' };
    }
    let j = {};
    try { j = await res.json(); } catch { /* ignore */ }
    if (!res.ok || !j.text) throw { code: j.code || (res.status === 403 ? 'not_granted' : 'upstream_error') };
    opts.onText?.({ text: j.text, delta: j.text });
    return { text: j.text, truncated: !!j.truncated };
  };
}
