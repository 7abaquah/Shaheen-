# خادم الوحدات الذكية (Cloudflare Worker)

يحمل مفتاح Claude API على الخادم، ولا يقبل إلا الطلبات القادمة من نطاق تطبيقك.

```bash
npm i -g wrangler
wrangler login
# عدّل ALLOWED_ORIGINS في wrangler.toml إلى نطاق التطبيق
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```
انسخ رابط الـ Worker (مثل `https://shaheen-ai-proxy.<حسابك>.workers.dev/v1/units`) إلى `AI_PROXY_DEFAULT` في `src/config.js` ثم أعد البناء، أو إلى «خادم الوحدات الذكية» في تبويب النظام.

الحدود: 24 رسالة و60 ألف حرف للطلب، وحد أقصى 1200 token للرد، و20 طلبًا في الدقيقة لكل IP (أو لكل /64 في IPv6)، وسقف يومي كلي `DAILY_REQUEST_CAP` (الافتراضي 500). `RATE_LIMITER` و KV باسم `USAGE` إلزاميان: أنشئ KV بالأمر `npx wrangler kv namespace create USAGE` وضع معرّفه في `wrangler.toml`، وإلا يرفض الخادم الطلبات.
