# checks.md — تقرير التحقق

يُعاد توليد هذا الملف بـ `npm run verify`. الأحكام: `pass` / `fail` / `unresolved`.
ما لا دليل عليه يبقى ظاهراً كـ `unresolved`.

| العقدة | المتطلب | الحكم | الدليل |
|---|---|---|---|
| N0 | بصمات المصادر تطابق ملفات الرفع | pass | `sources/SHA256SUMS` — 4/4 مطابقة لـ `.saved-uploads.jsonl` |
| N0 | الجرد والدمج حتميّان | pass | `scripts/inventory.mjs` + `scripts/build-catalog.mjs` — 37 مجموعة بيانات، 30 تعارضاً مُسجَّلاً |
| N1 | العقود سليمة الأنواع | pass | `tsc --noEmit`: الأخطاء الوحيدة هي استيرادات تنفيذ لم يُكتب بعد |
| N1 | ملكية العقد غير متقاطعة | pass | `node scripts/gate.mjs --check-map` → «ownership map is disjoint» |
| N2 | C3 النواة | unresolved | لم تُنفَّذ بعد |
| N3 | C4 البوابة | unresolved | لم تُنفَّذ بعد |
| N4 | الهيكل وعُدّة الواجهة | unresolved | لم تُنفَّذ بعد |
| N5–N7 | الوحدات الخمس عشرة | unresolved | لم تُنفَّذ بعد |
| N8 | C1 C2 C5 C6 | unresolved | لم تُنفَّذ بعد |
| N9 | C9 المراجعة المستقلة | unresolved | لم تُنفَّذ بعد |
| N10 | C7 التشغيل الشامل | unresolved | لم تُنفَّذ بعد |
