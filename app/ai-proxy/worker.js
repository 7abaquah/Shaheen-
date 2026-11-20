// ============================================================================
// Shaheen AI Proxy — Cloudflare Worker
// يشغّل الوحدات التشغيلية العشر في نسخة PWA المنشورة دون وضع مفتاح Claude API في المتصفح.
// المتغيرات (wrangler secret / vars):
//   ANTHROPIC_API_KEY  (secret)  مفتاح Claude API
//   ALLOWED_ORIGINS    (var)     النطاقات المسموح لها، مفصولة بفاصلة: https://app.shaheen.sa,https://shaheen.pages.dev
//   MODEL              (var)     اختياري، الافتراضي claude-sonnet-5-5
//   MAX_TOKENS         (var)     اختياري، الافتراضي 1200
//   RATE_LIMITER       (binding) إلزامي: Cloudflare Rate Limiting لكل عنوان IP
//   USAGE              (binding) إلزامي: KV لعدّاد الاستهلاك اليومي
//   DAILY_REQUEST_CAP  (var)     الحد اليومي الكلي للطلبات، الافتراضي 500
// بدون RATE_LIMITER و USAGE يرفض الخادم الخدمة: رأس Origin يمكن تزويره خارج المتصفح،
// فالحماية الفعلية للتكلفة هي الحد لكل IP والسقف اليومي.
// ============================================================================

const LIMITS = { messages: 24, chars: 60000 };

// IPv6 تُجمع على بادئة /64 حتى لا يتجاوز العميل الحد بتغيير العنوان
export function rateKey(ip) {
  const raw = String(ip || '').trim().toLowerCase();
  if (!raw.includes(':')) return raw || 'anon';
  const [head, tail = ''] = raw.split('::');
  const h = head ? head.split(':') : [];
  const t = raw.includes('::') ? (tail ? tail.split(':') : []) : [];
  const full = raw.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

// عدّاد يومي تقريبي في KV (قد يتجاوز السقف بهامش صغير بسبب الاتساق النهائي)
async function underDailyCap(env) {
  const cap = Math.max(1, Number(env.DAILY_REQUEST_CAP) || 500);
  const key = `day:${new Date().toISOString().slice(0, 10)}`;
  const used = Number(await env.USAGE.get(key)) || 0;
  if (used >= cap) return false;
  await env.USAGE.put(key, String(used + 1), { expirationTtl: 172800 });
  return true;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...(origin ? cors(origin) : {}) } });
}

export function validate(body) {
  const msgs = body && body.messages;
  if (!Array.isArray(msgs) || msgs.length === 0) return 'messages مطلوبة';
  if (msgs.length > LIMITS.messages) return 'prompt_too_large';
  let chars = 0;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) return 'صيغة الرسائل غير صحيحة';
    if (i > 0 && msgs[i - 1].role === m.role) return 'يجب أن تتناوب الرسائل';
    chars += m.content.length;
  }
  if (msgs[0].role !== 'user' || msgs[msgs.length - 1].role !== 'user') return 'يجب أن تبدأ المحادثة وتنتهي برسالة مستخدم';
  if (chars > LIMITS.chars) return 'prompt_too_large';
  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: ok ? cors(origin) : {} });
    if (url.pathname === '/health') return json({ ok: true }, 200, ok ? origin : null);
    if (url.pathname !== '/v1/units' || request.method !== 'POST') return json({ code: 'not_found' }, 404, ok ? origin : null);
    if (!ok) return json({ code: 'forbidden_origin' }, 403, null);
    if (!env.ANTHROPIC_API_KEY) return json({ code: 'upstream_error', message: 'المفتاح غير مضبوط في الخادم' }, 500, origin);

    if (!env.RATE_LIMITER || !env.USAGE) return json({ code: 'upstream_error', message: 'حدود الاستخدام غير مضبوطة في الخادم' }, 500, origin);
    const { success } = await env.RATE_LIMITER.limit({ key: rateKey(request.headers.get('CF-Connecting-IP')) });
    if (!success) return json({ code: 'rate_limited' }, 429, origin);

    let body;
    try { body = await request.json(); } catch { return json({ code: 'bad_request' }, 400, origin); }
    const bad = validate(body);
    if (bad) return json({ code: bad === 'prompt_too_large' ? 'prompt_too_large' : 'bad_request', message: bad }, 400, origin);

    if (!(await underDailyCap(env))) return json({ code: 'rate_limited', message: 'بلغ الاستخدام اليومي حده. حاول غدًا.' }, 429, origin);

    const maxTokens = Math.min(Number(env.MAX_TOKENS) || 1200, Math.max(64, Number(body.max_tokens) || 1200));
    let upstream;
    try {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, messages: body.messages.map(({ role, content }) => ({ role, content })) }),
      });
    } catch {
      return json({ code: 'upstream_error' }, 502, origin);
    }
    if (upstream.status === 429) return json({ code: 'rate_limited' }, 429, origin);
    if (!upstream.ok) return json({ code: 'upstream_error', status: upstream.status }, 502, origin);
    const data = await upstream.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (data.stop_reason === 'refusal') return json({ code: 'refused' }, 200, origin);
    if (!text) return json({ code: 'empty_completion' }, 200, origin);
    return json({ text, truncated: data.stop_reason === 'max_tokens' }, 200, origin);
  },
};
