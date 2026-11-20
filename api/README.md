# خادم واجهة شاهين البرمجية — Shaheen API v1

خادم خلفي على **Cloudflare Workers** مع قاعدة بيانات **D1**، ينفّذ العقد المشترك في `contract/API.md` بين الموقع وتطبيق الجوال والخادم:

| المسار | الوصف |
|---|---|
| `GET /v1/health` | فحص الحالة |
| `GET /v1/plans` | باقات الاشتراك للجهات (الأسعار افتراضية وتحتاج اعتمادًا تجاريًا — `src/plans.js`) |
| `POST /v1/subscribe` | الاشتراك في التحديثات / قائمة الانتظار |
| `POST /v1/plan-requests` | طلب اشتراك جهة (يصدر فريق المبيعات فاتورة؛ لا تُجمع بيانات بطاقات إطلاقًا) |
| `POST /v1/investors` | إبداء اهتمام استثماري (ليس عرضًا ولا تُقبل أي أموال) |
| `GET /v1/admin/subscribers` · `plan-requests` · `investors` | قوائم الإدارة مع ترقيم بالمؤشر `cursor` |
| `PATCH /v1/admin/investors/:reference` · `plan-requests/:reference` | تغيير الحالة مع تسجيل في `audit_log` |
| `GET /v1/admin/export/investors.csv` | تصدير المستثمرين CSV بترميز UTF-8 مع BOM ليفتح في Excel بالعربية |

بلا أي حزم خارجية: JavaScript (ES Modules) فقط.

## بنية المشروع

```
src/index.js        الموجّه والمعالجات
src/validate.js     التحقق من المدخلات ورسائل الأخطاء العربية
src/security.js     CORS، Turnstile، تجزئة IP، مقارنة رمز الإدارة بزمن ثابت، ترويسات الأمان
src/db.js           الوصول إلى D1 (الإدخال، الترقيم، حد الطلبات، سجل التدقيق)
src/plans.js        الباقات والأسعار الافتراضية
src/csv.js          توليد CSV مع الحماية من حقن الصيغ
migrations/0001_init.sql
scripts/d1-sqlite-shim.mjs   محاكي D1 فوق node:sqlite (للاختبارات والتطوير المحلي فقط)
scripts/dev-server.mjs       خادم تطوير محلي على http://127.0.0.1:8787
test/                        اختبارات node:test
```

## المتطلبات

- Node.js 22.5 أو أحدث (للاختبارات وخادم التطوير؛ يستخدم `node:sqlite` المدمج).
- حساب Cloudflare (الخطة المجانية تكفي: حد الطلبات مبني على D1 ولا يحتاج خدمات مدفوعة).

## خطوات النشر

نفّذ الأوامر داخل مجلد `shaheen-api`.

### 1) تسجيل الدخول إلى Cloudflare

```bash
npx wrangler@4 login
```

### 2) إنشاء قاعدة البيانات D1

```bash
npx wrangler@4 d1 create shaheen-db
```

انسخ قيمة `database_id` الظاهرة في المخرجات وضعها في `wrangler.toml` مكان `REPLACE_WITH_ID_FROM_wrangler_d1_create`.

### 3) تطبيق ملفات الترحيل (إنشاء الجداول)

```bash
npx wrangler@4 d1 migrations apply shaheen-db --remote
```

ينشئ الجداول: `subscribers` (بريد فريد)، `plan_requests`، `investors`، `rate_limits`، `audit_log` مع الفهارس.

### 4) ضبط الأسرار

لا تُكتب الأسرار في `wrangler.toml` ولا في المستودع. أنشئ قيمًا عشوائية قوية:

```bash
# مفتاح Turnstile السري: من لوحة Cloudflare ← Turnstile ← أضف موقعًا (Widget)
# ضع "Site Key" في الموقع والتطبيق، والمفتاح السري هنا:
npx wrangler@4 secret put TURNSTILE_SECRET

# رمز الإدارة: 32 حرفًا على الأقل، وإلا رُفضت كل طلبات الإدارة بالرمز 401
openssl rand -hex 32 | npx wrangler@4 secret put ADMIN_TOKEN

# ملح تجزئة عناوين IP: 16 حرفًا على الأقل (لا يُخزَّن عنوان IP خامًا أبدًا)
openssl rand -hex 32 | npx wrangler@4 secret put IP_SALT
```

> احفظ `ADMIN_TOKEN` في مدير كلمات مرور. إن لم يُضبط `IP_SALT` يرفض الخادم كل طلبات POST العامة بخطأ 500 (فشل آمن)، وإن لم يُضبط `TURNSTILE_SECRET` ترفض كذلك.

في إعدادات أداة Turnstile أضف نطاق الموقع. تطبيق الجوال (Capacitor) يعرض الأداة من `localhost`، لذا تأكّد أن إعدادات الأداة تقبل هذا المضيف (بإضافة `localhost` إلى قائمة النطاقات) وجرّب التحقق من داخل التطبيق قبل الإطلاق. الخادم يتحقق من الرمز بالمفتاح السري فقط، فإن استخدمت أداة مستقلة للتطبيق بمفتاح سري مختلف فسيلزم تعديل الكود لقبول مفتاحين.

### 5) ضبط النطاقات المسموح بها `ALLOWED_ORIGINS`

راجع القسم التالي، ثم:

### 6) النشر

```bash
npx wrangler@4 deploy
```

ثم تحقّق:

```bash
curl https://shaheen-api.<حسابك>.workers.dev/v1/health
# {"ok":true,"version":"1.0.0"}
```

ضع العنوان الأساسي (مثل `https://api.your-domain.sa/v1`) في إعداد `API_BASE` لدى الموقع والتطبيق. لربط نطاق مخصص فعّل سطر `routes` في `wrangler.toml`.

## إضافة نطاق الموقع ونطاقات تطبيق الجوال إلى `ALLOWED_ORIGINS`

المتغير `ALLOWED_ORIGINS` في قسم `[vars]` داخل `wrangler.toml` قائمة مفصولة بفواصل. أي طلب من متصفح بأصل (Origin) غير موجود فيها يُرفض بالرمز `403 forbidden_origin`.

قواعد الكتابة:

- الأصل = البروتوكول + النطاق + المنفذ إن وُجد، **بدون مسار** (`https://shaheen.sa` وليس `https://shaheen.sa/ar`).
- المطابقة حرفية: إن كان الموقع يعمل على `www` وبدونها فأضف الاثنين.
- القيمتان `*` و `null` تُتجاهلان دائمًا لأسباب أمنية.

مثال لموقع على `shaheen.sa` مع تطبيق الجوال:

```toml
[vars]
ALLOWED_ORIGINS = "https://shaheen.sa,https://www.shaheen.sa,https://localhost,capacitor://localhost"
```

- `https://localhost` هو أصل تطبيق Capacitor على **أندرويد**.
- `capacitor://localhost` هو أصله على **iOS**.

بعد التعديل أعد النشر: `npx wrangler@4 deploy`.

> يمكن أيضًا تعديل المتغير من لوحة Cloudflare (Workers ← shaheen-api ← Settings ← Variables)، لكن أي `wrangler deploy` لاحق يستبدله بقيمة `wrangler.toml`. اجعل `wrangler.toml` المرجع الوحيد.

الطلبات بدون ترويسة `Origin` (مثل `curl` وأدوات الإدارة من الخادم) لا تخضع لـ CORS ويُسمح بها، وتبقى طلبات POST العامة محمية بـ Turnstile وحد الطلبات.

## الحماية من الإساءة

- **Turnstile**: كل POST عام يتطلب `turnstileToken` ويُتحقق منه لدى Cloudflare. أي فشل (بما فيه انقطاع الشبكة) يُرجع `403 captcha_failed`.
- **حد الطلبات**: 10 طلبات POST لكل ساعة لكل مسار لكل عنوان IP، مخزّن في جدول `rate_limits` بمفتاح (المسار + تجزئة IP + رقم الساعة). الطلب الحادي عشر يُرجع `429` مع `Retry-After`. الطلبات غير الصالحة تُحتسب أيضًا.
- **فخ الروبوتات**: إن وصل الحقل المخفي `website` بقيمة غير فارغة يُرجع الخادم `201 {"ok":true}` ولا يخزّن شيئًا.
- **عدم كشف الحسابات**: الاشتراك ببريد مسجّل مسبقًا يُرجع الاستجابة نفسها حرفيًا ولا يعدّل البيانات القديمة.
- **الحجم**: أقصى حجم للجسم 8 كيلوبايت (`413 payload_too_large`)، ويجب أن يكون `Content-Type: application/json`.
- **الموافقة (نظام حماية البيانات الشخصية PDPL)**: `consent: true` إلزامي، ويُخزَّن `CONSENT_VERSION` ووقت الموافقة. عند تغيير سياسة الخصوصية غيّر `CONSENT_VERSION` في `wrangler.toml`.
- لا يُرجع الخادم تفاصيل الأخطاء الداخلية أبدًا؛ تُسجَّل في سجلات Cloudflare فقط.

## استخدام واجهة الإدارة

```bash
API=https://api.your-domain.sa
TOKEN=...   # قيمة ADMIN_TOKEN

curl -H "Authorization: Bearer $TOKEN" "$API/v1/admin/investors?status=new&limit=50"
# الصفحة التالية: أضف cursor=<nextCursor>

curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"contacted","note":"تم التواصل هاتفيًا"}' \
  "$API/v1/admin/investors/INV-XXXXXXXX"

curl -H "Authorization: Bearer $TOKEN" -o investors.csv "$API/v1/admin/export/investors.csv"
```

كل تغيير حالة يُضاف إلى `audit_log` (الفاعل `admin`، الإجراء، المرجع، التفاصيل من/إلى، الوقت)، ويُسجَّل التصدير أيضًا. خلايا CSV التي تبدأ بـ `=` أو `+` أو `-` أو `@` تُسبق بعلامة `'` لمنع حقن الصيغ في Excel (لذلك تظهر أرقام الجوال بالشكل `'+966…`).

## التطوير المحلي

```bash
ADMIN_TOKEN=$(openssl rand -hex 32) npm run dev
```

- يعمل على `http://127.0.0.1:8787` بقاعدة بيانات ملف `.dev/dev.sqlite` مع تطبيق الترحيلات عند البدء.
- التحقق من Turnstile معطّل (`TURNSTILE_DISABLED="1"`) — **للتطوير المحلي فقط ولا يُضبط في الإنتاج أبدًا**.
- `ALLOWED_ORIGINS` يُقرأ من متغير البيئة، والافتراضي يشمل منافذ localhost الشائعة (5173، 4173، 3000، 8080) و`https://localhost` و`capacitor://localhost`.
- متغيرات اختيارية: `PORT`، `HOST`، `IP_SALT`، `CONSENT_VERSION`.

بديل يستخدم بيئة Workers الفعلية: انسخ `.dev.vars.example` إلى `.dev.vars` ثم
`npx wrangler@4 d1 migrations apply shaheen-db --local` ثم `npx wrangler@4 dev`.

## الاختبارات

```bash
npm test
```

تشغّل الاختبارات معالج `fetch` الخاص بالـ Worker داخل Node 22 فوق محاكي D1 مبني على `node:sqlite` مع تطبيق ملف الترحيل الحقيقي، وتحاكي خدمة Turnstile.

## ملاحظات للمشغّل

- أسعار الباقات وميزاتها في `src/plans.js` افتراضية وتحتاج اعتمادًا تجاريًا.
- حدّد سياسة الاحتفاظ بالبيانات وحذفها وفق نظام حماية البيانات الشخصية؛ الخادم لا يحذف السجلات تلقائيًا (عدا عدّادات حد الطلبات القديمة).
- صفحة الاستثمار لجمع الاهتمام فقط؛ راجع متطلبات هيئة السوق المالية والجهات التنظيمية قبل أي طرح.
