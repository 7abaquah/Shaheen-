# موقع شاهين العام

موقع ثابت (Static) آمن لمجموعة شاهين وعملة SHN، جاهز للنشر على **Cloudflare Pages**. العربية (RTL) هي اللغة الأساسية على `/`، والنسخة الإنجليزية (LTR) على `/en/`. لا يحتاج الموقع أي خطوة بناء: الملفات تُنشر كما هي.

## البنية

```
shaheen-web/
├── index.html                 الرئيسية (عربي)
├── token/ subscribe/ investors/ privacy/ terms/ security/   صفحات عربية (index.html في كل مجلد)
├── 404.html                   صفحة الخطأ العربية
├── en/                        النسخة الإنجليزية بالبنية نفسها + en/404.html
├── css/
│   ├── tokens.css             متغيرات الهوية — نسخة طبق الأصل من دليل الهوية، لا تُعدَّل هنا
│   └── site.css               تنسيق الموقع؛ كل الألوان من متغيرات tokens.css
├── js/
│   ├── config.js              الإعدادات الوحيدة القابلة للتعديل (انظر أدناه)
│   ├── site.js                القائمة على الجوال وروابط التطبيق
│   ├── forms.js               النماذج: التحقق، Turnstile، الإرسال، رسائل الأخطاء
│   └── plans.js               تحميل الخطط من GET /v1/plans
├── assets/
│   ├── brand/                 الشعار والرمز والأيقونات والزخارف (منسوخة من حزمة الهوية، لا يُعاد رسمها)
│   └── icons.svg              أيقونات Lucide بسماكة 2px
├── _headers                   رؤوس الأمان لـ Cloudflare Pages (CSP وغيرها)
├── .well-known/security.txt   جهة الإبلاغ عن الثغرات (RFC 9116)
├── robots.txt
└── sitemap.xml
```

| الصفحة | عربي | English |
| --- | --- | --- |
| الرئيسية: التعريف، أرقام SHN، عقد الحوسبة، تنزيل التطبيق | `/` | `/en/` |
| العملة: المواصفات، التوزيع، البيع المسبق، Staking، الحوكمة، التدقيق، المخاطر | `/token/` | `/en/token/` |
| التحديثات والخطط وطلب خطة | `/subscribe/` | `/en/subscribe/` |
| تسجيل اهتمام المستثمرين | `/investors/` | `/en/investors/` |
| سياسة الخصوصية (PDPL) | `/privacy/` | `/en/privacy/` |
| شروط الاستخدام | `/terms/` | `/en/terms/` |
| الأمان والإفصاح المسؤول | `/security/` | `/en/security/` |
| صفحة 404 | `/404.html` | `/en/404.html` |

## الإعدادات: `js/config.js`

| المفتاح | الوصف | مثال |
| --- | --- | --- |
| `API_BASE` | عنوان الواجهة البرمجية مع `/v1` وبلا شرطة في النهاية | `https://api.shaheen.sa/v1` |
| `APP_URL` | رابط تطبيق الويب (PWA) بصيغة https | `https://app.shaheen.sa` |
| `TURNSTILE_SITE_KEY` | مفتاح الموقع **العام** من Cloudflare Turnstile (المفتاح السري يبقى في الخادم فقط باسم `TURNSTILE_SECRET`) | `0x4AAAAAAA...` |

- أي قيمة تنتهي بـ `.example` أو تبدأ بـ `REPLACE` تُعامل كغير مُعدّة: النماذج تعرض رسالة «غير مفعّل بعد» ولا ترسل شيئًا، وروابط التطبيق تبقى على قسم التنزيل.
- للتجربة المحلية يمكن استخدام مفتاح Turnstile التجريبي من Cloudflare `1x00000000000000000000AA` (ينجح دائمًا)، مع `TURNSTILE_DISABLED=1` في الخادم المحلي فقط.
- بعد تغيير `API_BASE` **يجب** تحديث `connect-src` في `_headers` (القسم التالي)، وإلا يمنع المتصفح الطلبات.
- في الخادم أضف أصل الموقع إلى `ALLOWED_ORIGINS` (مثل `https://shaheen.sa`) وإلا يرد بالرمز `forbidden_origin`.

## النشر على Cloudflare Pages

1. ارفع المجلد إلى مستودع Git (المجلد نفسه هو الجذر).
2. في لوحة Cloudflare: **Workers & Pages ← Create ← Pages ← Connect to Git** واختر المستودع.
3. الإعدادات: **Framework preset:** None، **Build command:** فارغ، **Build output directory:** `/` (أو مسار المجلد إن كان داخل مستودع أكبر).
4. بديل بلا Git: `npx wrangler pages deploy . --project-name shaheen-web` من داخل المجلد.
5. اربط النطاق المخصص من **Custom domains**، ثم فعّل **Always Use HTTPS**.
6. أنشئ موقع Turnstile من **Turnstile ← Add site** بالنطاق نفسه، وضع مفتاح الموقع في `config.js` والمفتاح السري في الخادم.

يطبّق Cloudflare Pages ملف `_headers` تلقائيًا، ويخدم `404.html` الأقرب للمسار (لذلك `/en/...` تعرض `en/404.html`).

## تحديث CSP عند معرفة نطاق الواجهة البرمجية

السطر في `_headers` يحتوي حاليًا العنوان المؤقت:

```
connect-src 'self' https://api.shaheen.example;
```

استبدله بأصل الواجهة البرمجية الحقيقي (البروتوكول والنطاق فقط، بلا `/v1`):

```
connect-src 'self' https://api.shaheen.sa;
```

- إن كانت الواجهة على النطاق نفسه (مثل `https://shaheen.sa/v1`) يكفي `'self'` ويمكن حذف العنوان الإضافي.
- لا تضف `'unsafe-inline'` أو `'unsafe-eval'` أبدًا: الموقع لا يستخدم أي سكربت مضمّن ولا سمة `style` ولا معالجات أحداث داخل HTML.
- عند إضافة مزود خارجي جديد (خطوط، صور، تحليلات) يجب إضافة نطاقه للتوجيه المناسب فقط، وتحديث سياسة الخصوصية.
- بعد النشر تحقق من الرؤوس: `curl -sI https://shaheen.sa/ | grep -i content-security-policy`، ومن خلو وحدة تحكم المتصفح من رسائل `Refused to`.
- `Strict-Transport-Security` يتضمن `preload`: لا تقدّم النطاق إلى hstspreload.org إلا بعد التأكد من أن كل النطاقات الفرعية تعمل بـ HTTPS.

## القيم المؤقتة التي يجب استبدالها قبل الإطلاق

| أين | القيمة الحالية | المطلوب |
| --- | --- | --- |
| `js/config.js` | `API_BASE`، `APP_URL`، `TURNSTILE_SITE_KEY` | القيم الحقيقية |
| `_headers` | `https://api.shaheen.example` في `connect-src` | أصل الواجهة البرمجية |
| كل صفحات HTML و`robots.txt` و`sitemap.xml` و`security.txt` | `https://shaheen.example` | النطاق الحقيقي، مثلًا: `grep -rl 'shaheen.example' . \| xargs sed -i 's#https://shaheen.example#https://shaheen.sa#g'` (لا يمس `api.` أو `app.` أو بريد security) |
| `.well-known/security.txt` | `security@shaheen.example`، `Expires` | بريد الإبلاغ الفعلي، وتاريخ انتهاء لا يتجاوز سنة |
| الصفحات | كل `[قيد القرار]` / `[TBD]` | القرار النهائي عند اعتماده |
| الصفحات | `[تُنشر بعد الإطلاق]` | عناوين العقود بعد النشر على BNB Chain (بخط `address` واتجاه LTR) |

ابحث عنها بالأمر: `grep -rn 'قيد القرار\|TBD\|تُنشر بعد الإطلاق\|Published after launch\|\.example' --include=*.html --include=*.js --include=*.txt --include=_headers .`

## قواعد الأمان في الشيفرة

- لا سكربتات مضمّنة، ولا معالجات أحداث داخل وسوم HTML، ولا سمات تنسيق مضمّنة: كل JS في `js/` وكل CSS في `css/`.
- بيانات المستخدم وردود الواجهة البرمجية تُكتب بـ `textContent` فقط، ولا يُحقن HTML خام في الصفحة.
- لا شيء يُحفظ في تخزين المتصفح (Web Storage) أو الكوكيز.
- حقل المصيدة `website` مخفي عن المستخدمين وقارئات الشاشة (`aria-hidden` و`tabindex="-1"`) ويُرسل فارغًا.
- زر الإرسال يبقى معطّلًا أثناء الإرسال، ويُعاد ضبط Turnstile بعد كل محاولة لأن الرمز يُستخدم مرة واحدة.
- التحقق في المتصفح يطابق عقد الواجهة البرمجية (`contract/API.md`): الأطوال، صيغة E.164 للجوال (يُقبل `05XXXXXXXX` ويحوَّل إلى `+9665XXXXXXXX`)، رموز الدول ISO-3166، الحقول الاختيارية تُحذف إذا كانت فارغة.

## الهوية

الألوان والخطوط والزخارف من دليل هوية شاهين: الأسود أساس، الذهب نادر (زر أساسي واحد في كل شاشة)، Reem Kufi للعنوان الكبير فقط، Cairo للواجهات والأرقام، Tajawal للنصوص، والأرقام لاتينية بعرض ثابت. كل صفحة تذكر العملة تحمل سطر «الأصول الرقمية عالية المخاطر. ليس نصيحة استثمارية.». لتعديل الصفحات عدّل ملفات HTML مباشرة مع الحفاظ على الهيدر والفوتر متطابقين في كل الصفحات.
