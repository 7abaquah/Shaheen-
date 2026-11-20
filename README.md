# منظومة شاهين الموحدة · Shaheen Unified System

مستودع واحد يضم كل مكوّنات منظومة شاهين. One repository for every part of the Shaheen system.

| المجلد · Folder | المحتوى · Contents | الفحص · Check |
|---|---|---|
| `app/` | التطبيق (PWA + Android + iOS عبر Capacitor 8): الحوكمة، SHN، المحفظة، التعدين، الدفع، الوحدات التشغيلية، الاشتراك والمستثمرون · The app | `npm test && npm run build` |
| `api/` | خادم الاشتراكات (Cloudflare Worker + D1) وفق `docs/API.md` · Subscriptions API | `npm test` |
| `web/` | الموقع الرسمي الآمن عربي/إنجليزي (Cloudflare Pages، CSP صارم) · Secure public website | فحص الأمان في `ci.yml` |
| `contracts/` | عقود SHN v2 على BNB Chain (Hardhat) · Smart contracts | `npm test` |
| `design-system/` | هوية شاهين: الرموز والمكوّنات ودليل العلامة · Brand design system | — |
| `brand/` | الشعار الرسمي ومشتقاته وسكربتات التحويل · Official logo assets | — |
| `docs/API.md` | العقد المشترك بين التطبيق والموقع والخادم · Shared API contract | — |

## التشغيل الآلي · Automation (`.github/`)
- `ci.yml` — كل دفع وطلب دمج: اختبارات وبناء المكوّنات الأربعة، وفحص أمان الموقع. Tests and builds on every push/PR.
- `deploy.yml` — نشر التطبيق على GitHub Pages، والموقع والخادم على Cloudflare عند توفر `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID`. Deployment.
- `release.yml` — الوسم `v*` يبني حزمة PWA و Android (APK/AAB) و iOS (IPA) ويرفقها بالإصدار دفعة واحدة. Release builds attached in one step.
- `maintenance.yml` — صيانة دورية يومية الساعة 2:17 صباحًا بتوقيت مكة: إعادة كل الفحوص، ثغرات الحزم، صحة الخادم وترويسات أمان الموقع، وفتح بلاغ تلقائي عند الفشل. Daily maintenance at 02:17 Makkah time with auto-filed issues.
- `dependabot.yml` — تحديثات الحزم الأمنية. Dependency updates.

## الإعداد قبل الإطلاق · Before launch
**متغيرات المستودع · Repository variables:**
- `SHN_API_BASE`، `SHN_TURNSTILE_SITE_KEY`، `SHN_WEBSITE_URL`، `SHN_APP_URL`: تُكتب تلقائيًا في التطبيق وفي إعدادات الموقع وفي سياسة CSP عند النشر. Written into the app, the website config and the CSP at deploy time.
- `CF_PAGES_PROJECT` (اختياري · optional).
- `SHN_PRESALE_ENABLED=1`: لا تضبطه إلا بعد اكتمال التراخيص. الشراء على السلسلة معطّل بدونه. Set only after licensing; on-chain purchase stays disabled otherwise.

**GitHub Pages:** فعّلها بمصدر «GitHub Actions» من إعدادات المستودع. Enable Pages with the "GitHub Actions" source.

**الأسرار · Secrets:**
- Cloudflare: `CLOUDFLARE_API_TOKEN`، `CLOUDFLARE_ACCOUNT_ID`.
- توقيع أندرويد · Android signing: `ANDROID_*`.
- توقيع iOS · iOS signing: `IOS_*`. انظر · see `app/README.md`.

**أسرار الخادم · Worker secrets** (عبر · via `wrangler secret put`): `TURNSTILE_SECRET`، `ADMIN_TOKEN`، `IP_SALT`. انظر · see `api/README.md`.

**الموقع · Website:** يضبطه `deploy.yml` من المتغيرات أعلاه عبر `.github/scripts/configure-web.mjs`. يبقى يدويًا بريد الإبلاغ الأمني وتاريخ `Expires` في `web/.well-known/security.txt`. Configured automatically from the variables above; set the security contact email and `Expires` in `security.txt` by hand.

**العقود · Contracts:** النشر بمفتاحك الخاص على جهازك فقط، ثم إدخال العناوين في التطبيق. Deploy with your own key on your own machine, then enter the addresses in the app.

## حدود الامتثال · Compliance boundaries
- نموذج المستثمرين تسجيل اهتمام فقط. لا يعرض أوراقًا مالية، ولا يقبل أي أموال قبل اكتمال الهيكل النظامي والتراخيص والتحقق من الهوية (KYC). Investor form is an expression of interest only: no securities offer and no funds accepted.
- لا تُجمع بيانات بطاقات في أي مكوّن؛ المبيعات تصدر فاتورة. No card data is collected anywhere; sales issue invoices.
- مكافآت التخزين متغيرة وغير مضمونة. Staking rewards are variable and not guaranteed.
- التدقيق المستقل للعقود لم يُجرَ بعد. The independent contract audit has not been done yet.
