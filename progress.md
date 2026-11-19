# progress.md — حالة التنفيذ

آخر تحديث: بعد N1 (العقود والمقيِّمات) — قبل إطلاق N2.

## المخطط

| العقدة | الحالة |
|---|---|
| N0 جرد ودمج البيانات | ✅ منجزة |
| N1 العقود والمقيِّمات | ✅ منجزة |
| N2 نواة الأمان | ⏳ التالية |
| N3 بوابة الذكاء الاصطناعي | ⏸ تنتظر N2 |
| N4 الهيكل وعُدّة الواجهة | ⏸ تنتظر N2 |
| N5 / N6 / N7 الوحدات | ⏸ تنتظر N4 |
| N8 التكامل | ⏸ |
| N9 المراجعة الأمنية | ⏸ |
| N10 التشغيل الشامل والتقرير | ⏸ |

## المخرجات الحالية (مسارات محفوظة)

- `sources/` — المصادر الأربعة + `SHA256SUMS` (مطابقة لبصمات الرفع)
- `graph/inventory.json` — 26 ميزة، 15 موضع استدعاء، 4 استدعاءات مباشرة من المتصفح لواجهة النموذج
- `shared/catalog.json` — 37 مجموعة بيانات (20 توضيحية `demo`، 17 إعدادات)
- `graph/catalog-report.json` — 30 تعارضاً بين النسخ + مجموعتان لم تُنقلا مع السبب
- `kernel/contract.ts` · `server/contract.ts` · `src/contract.ts` · `shared/*.ts`
- اختبارات القبول المجمَّدة: `kernel/tests/acceptance/` (5) · `server/tests/acceptance/` (3) · `src/tests/acceptance/` (2)
- `graph/graph.json` · `graph/specs/` · `scripts/gate.mjs`

## القرارات

انظر `graph.md` القسم 8 (D1–D10).

## مسائل مفتوحة

- اختبارات القبول كُتبت قبل وجود أي تنفيذ؛ عيب في المقيِّم نفسه وارد. العقد مأمورة بالإبلاغ لا بالالتفاف.
- مكتبة `@noble/post-quantum` 0.7.1 **غير مدقَّقة من طرف مستقل** وليست ثابتة الزمن (JavaScript). يُذكر ذلك في الواجهة و`SECURITY.md`.
- بقي على القائد: `scripts/scan-security.mjs` · `scripts/coverage.mjs` · `graph/feature-map.json` · `scripts/sign-release.mjs` · `scripts/verify.mjs` · `e2e/run.mjs` · مواصفات N3–N9 · `SECURITY.md` · `README.md`.

## الإجراء التالي

إطلاق N2 بمواصفتها `graph/specs/N2-kernel.md`، ثم `node scripts/gate.mjs N2`.
