# Shaheen API v1 — shared contract (website, mobile app, backend)

Base URL is configurable: `API_BASE` (e.g. `https://api.shaheen.example/v1`). All bodies JSON UTF-8, max 8 KB.
Every error: `{ "code": "<code>", "message": "<Arabic text>", "fields"?: { "<field>": "<Arabic reason>" } }`.
Codes: `invalid` (400), `captcha_failed` (403), `forbidden_origin` (403), `unauthorized` (401), `not_found` (404), `rate_limited` (429), `payload_too_large` (413), `server_error` (500).

CORS: only origins in `ALLOWED_ORIGINS` (comma list). The mobile app's origins `https://localhost` (Android Capacitor) and `capacitor://localhost` (iOS) are added there by the operator.

Anti-abuse on every public POST: Cloudflare Turnstile token in `turnstileToken` (verified server-side with `TURNSTILE_SECRET`; when the env var `TURNSTILE_DISABLED` is `"1"` verification is skipped — local dev only), per-IP rate limit (10 POSTs / hour / route, IP stored only as salted SHA-256), honeypot field `website` must be empty.

Consent: `consent: true` required (Saudi PDPL). Server stores `consentVersion` (env `CONSENT_VERSION`, default `"2026-11"`) and timestamp.

## Public

### GET /v1/health → 200 `{ "ok": true, "version": "1.0.0" }`

### GET /v1/plans → 200
`{ "plans": [ { "id": "pro-fleet", "nameAr": "تشغيلي متقدم", "nameEn": "Pro Fleet", "priceSar": 1800, "period": "month", "featuresAr": [..], "featuresEn": [..] }, { "id": "node-partner", ... 2900 }, { "id": "enterprise", ... 4500 } ] }`
Prices are defaults from config and are business decisions to confirm.

### POST /v1/subscribe — public updates / waitlist
Body: `{ "name": string 2–80, "email": string, "phone"?: E.164 string, "lang": "ar"|"en", "interests": array subset of ["app","presale","mining","staking","news"] (≥1), "consent": true, "turnstileToken": string, "website": "" }`
→ 201 `{ "ok": true }` — the SAME response when the email already exists (no account enumeration).

### POST /v1/plan-requests — business subscription request (sales issues invoice; no card data ever)
Body: `{ "planId": one of plan ids, "organization": 2–120, "contactName": 2–80, "email", "phone": E.164, "paymentMethod": "bank"|"card"|"usdt", "seats"?: int 1–500, "notes"?: ≤1000, "consent": true, "turnstileToken", "website": "" }`
→ 201 `{ "ok": true, "reference": "REQ-XXXXXXXX" }`

### POST /v1/investors — investor expression of interest (NOT an offer, no funds accepted)
Body: `{ "fullName": 2–100, "email", "phone": E.164, "country": ISO-3166 alpha-2, "investorType": "individual"|"institution", "organization"?: ≤120 (required, 2–120, when institution), "ticketRange": "under-10k"|"10k-50k"|"50k-250k"|"over-250k" (USD), "qualifiedDeclaration": boolean (self-declares qualified/professional investor status), "message"?: ≤1500, "lang": "ar"|"en", "consent": true, "turnstileToken", "website": "" }`
→ 201 `{ "ok": true, "reference": "INV-XXXXXXXX" }`; new records have `status: "new"`.

## Admin (header `Authorization: Bearer <ADMIN_TOKEN>`, constant-time compare, token ≥ 32 chars or every admin call returns 401)

- `GET /v1/admin/subscribers?limit=50&cursor=<id>` → `{ "items": [...], "nextCursor": string|null }`
- `GET /v1/admin/plan-requests?status=&limit=&cursor=` → same shape
- `GET /v1/admin/investors?status=&limit=&cursor=` → same shape
- `PATCH /v1/admin/investors/:reference` body `{ "status": "new"|"contacted"|"kyc_requested"|"approved"|"rejected", "note"?: ≤1000 }` → `{ "ok": true }`
- `PATCH /v1/admin/plan-requests/:reference` body `{ "status": "new"|"invoiced"|"paid"|"active"|"cancelled", "note"? }` → `{ "ok": true }`
- `GET /v1/admin/export/investors.csv` → text/csv (UTF-8 with BOM for Excel Arabic)
Every admin change appends to `audit_log` (actor "admin", action, target, at).
