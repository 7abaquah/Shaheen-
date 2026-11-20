// ============================================================================
// منظومة شاهين — الإعدادات الثابتة والبيانات التجريبية الأولية
// كل الأرقام هنا بيانات محاكاة، وليست أرصدة أو عملاء حقيقيين.
// ============================================================================

// مواصفات عملة SHN كما اعتُمدت في عقود BNB Chain
export const TOKEN = {
  name: 'Shaheen Coin',
  symbol: 'SHN',
  chain: 'BNB Chain',
  standard: 'BEP-20',
  presaleRate: 238, // SHN لكل 1 USDT
  burnOnPurchasePct: 1,
  referralPct: 5,
  minBuyUsdt: 50,
  maxBuyUsdt: 10000, // الحد الأعلى لكل محفظة
  hardcapUsdt: 2400000,
  timelockHours: 48,
  quorumPct: 4,
  contracts: [
    'ERC20 + ERC20Votes + Permit',
    'EcoSystem: البيع والتخزين والإحالة والاستحقاق ومكافحة الحيتان',
    'Merkle Airdrop',
    'DAO Governor + TimelockController',
  ],
  // المعروض المسكوك في سكربت النشر: 600M EcoSystem · 100M خزينة DAO · 10M Airdrop · 290M لدى المالك
  totalSupplySim: 1000000000,
};

export const SAR_PER_USDT = 3.75;

// عناوين عقود SHN v2 المنشورة. املأها بعد النشر (deployments/<chainId>.json) لتظهر لكل مستخدمي النسخة المنشورة.
// يمكن تجاوزها محليًا من تبويب النظام للاختبار.
export const CHAIN_DEFAULT = { chainId: 97, eco: '', shn: '', usdt: '', airdrop: '', dao: '', proofsUrl: 'airdrop-proofs.json' };

// خادم الوحدات الذكية للنسخة المنشورة (Cloudflare Worker في مجلد ai-proxy). فارغ = الوحدات تعمل داخل Claude فقط.
export const AI_PROXY_DEFAULT = '';

// خادم الاشتراكات (Cloudflare Worker + D1) — العقد في contract/API.md
// تُضبط القيم الافتراضية للنسخة المنشورة هنا قبل البناء، ويمكن للمالك تعديلها من تبويب النظام.
// القيم تأتي من ملف config.js المولَّد عند البناء (متغيرات SHN_* في scripts/assemble.mjs).
const RUNTIME = (typeof window !== 'undefined' && window.__SHN_CONFIG__) || {};
const str = (v) => (typeof v === 'string' ? v.trim() : '');
// الشراء على السلسلة معطّل افتراضيًا حتى اكتمال المتطلبات النظامية (SHN_PRESALE_ENABLED=1 عند البناء)
export const PRESALE_ENABLED = RUNTIME.presaleEnabled === true;
export const API_DEFAULT = {
  apiBase: str(RUNTIME.apiBase),                   // مثال: https://api.shaheen.example/v1
  turnstileSiteKey: str(RUNTIME.turnstileSiteKey), // مفتاح Cloudflare Turnstile العام (ليس السري)
  websiteUrl: str(RUNTIME.websiteUrl),             // الموقع الرسمي، بديل عند تعذّر التحقق داخل التطبيق
  appUrl: str(RUNTIME.appUrl),                     // رابط التطبيق العام (لروابط المحافظ من تطبيق الجوال)
};
export const PRESALE_PRICE_USDT = 1 / TOKEN.presaleRate;

// بوابة الحوكمة
export const DAILY_RESOURCE_CAP_USD = 15.0;
export const MIN_MARGIN_THRESHOLD = 18.5;
export const HITL_VALUE_THRESHOLD_SAR = 500000;
export const HITL_RISK_THRESHOLD = 0.15;

export const TABS = [
  { id: 'home', label: 'الرئيسية', icon: 'LayoutDashboard' },
  { id: 'join', label: 'الاشتراك والمستثمرون', icon: 'Handshake' },
  { id: 'governance', label: 'الحوكمة', icon: 'Shield' },
  { id: 'market', label: 'السوق والبيع المسبق', icon: 'Coins' },
  { id: 'wallet', label: 'المحفظة', icon: 'Wallet' },
  { id: 'compute', label: 'التعدين', icon: 'Cpu' },
  { id: 'subscribers', label: 'المشتركون', icon: 'Users' },
  { id: 'payments', label: 'الدفع', icon: 'CreditCard' },
  { id: 'units', label: 'الوحدات التشغيلية', icon: 'Bot' },
  { id: 'system', label: 'النظام', icon: 'Settings' },
];

export const INITIAL_DEALS = [
  { id: 'SHN-1795028400000', title: 'مناقصة الطاقة النظيفة والمدن الذكية — مكة وجدة', sector: 'الطاقة النظيفة', estimatedValueSar: 145000, directCostSar: 102000, contingencySar: 10375, volatilityIndex: 0.06, hitlApproved: true, status: 'معتمد ونشط' },
  { id: 'SHN-LOG-1795031295000', title: 'شراكات ميناء جدة الإسلامي اللوجستية والنقل', sector: 'اللوجستيات', estimatedValueSar: 350000, directCostSar: 258000, contingencySar: 23750, volatilityIndex: 0.08, hitlApproved: true, status: 'معتمد ونشط' },
  { id: 'SHN-INV-2500K', title: 'توسعة البنية التحتية الاستراتيجية والربط الطاقي', sector: 'الاستثمار الاستراتيجي', estimatedValueSar: 2500000, directCostSar: 1850000, contingencySar: 150000, volatilityIndex: 0.12, hitlApproved: true, status: 'معتمد عبر HITL' },
  { id: 'SHN-CMP-820K', title: 'مجمع حوسبة موزعة وطاقة شمسية إقليمي', sector: 'الحوسبة والطاقة', estimatedValueSar: 820000, directCostSar: 580000, contingencySar: 65000, volatilityIndex: 0.18, hitlApproved: false, status: 'معلق بانتظار HITL' },
];

// المكافآت تُصرف من مخصص EcoSystem ولا تُنشئ عملة جديدة على الشبكة
export const INITIAL_NODES = [
  { id: 'NODE-MKH-01', name: 'عقدة مكة للطاقة الشمسية والحوسبة', region: 'مكة المكرمة', running: true, computeTflops: 420, shnPerHour: 18500, burnRatePercent: 12, greenPowerRatio: 94, totalRewardShn: 4820500, totalBurnedShn: 578460 },
  { id: 'NODE-JED-02', name: 'عقدة جدة اللوجستية للتحليل الموزع', region: 'جدة', running: true, computeTflops: 310, shnPerHour: 13200, burnRatePercent: 15, greenPowerRatio: 82, totalRewardShn: 3190000, totalBurnedShn: 478500 },
  { id: 'NODE-RUH-03', name: 'عقدة الرياض للنماذج والذكاء الاصطناعي', region: 'الرياض', running: false, computeTflops: 560, shnPerHour: 24000, burnRatePercent: 10, greenPowerRatio: 76, totalRewardShn: 6150250, totalBurnedShn: 615020 },
];

export const PLANS = ['مؤسسي (Enterprise)', 'تشغيلي متقدم (Pro Fleet)', 'شريك عقدة حوسبة (Node Partner)'];

export const INITIAL_SUBSCRIBERS = [
  { id: 'SUB-1001', name: 'شركة الأفق الأخضر للطاقة', plan: PLANS[0], status: 'نشط', shnBalance: 3391500, monthlySar: 4500, paymentMethod: 'تحويل بنكي', renewalDate: '2026-12-20' },
  { id: 'SUB-1002', name: 'مؤسسة مسارات البحر الأحمر للنقل', plan: PLANS[1], status: 'نشط', shnBalance: 1618400, monthlySar: 1800, paymentMethod: 'بطاقة / Apple Pay', renewalDate: '2026-12-05' },
  { id: 'SUB-1003', name: 'مجموعة النخبة للاستثمار الرقمي', plan: PLANS[0], status: 'بانتظار السداد', shnBalance: 5212200, monthlySar: 4500, paymentMethod: 'فاتورة مقسمة', renewalDate: '2026-11-22' },
  { id: 'SUB-1004', name: 'مركز التقنية المستدامة', plan: PLANS[2], status: 'نشط', shnBalance: 2249100, monthlySar: 2900, paymentMethod: 'USDT (BEP-20)', renewalDate: '2026-12-15' },
];

// قنوات الدفع. لا يُجمع رقم بطاقة داخل التطبيق: البطاقات تمر عبر بوابة دفع مرخصة.
export const PAYMENT_RAILS = [
  { id: 'card', label: 'بطاقة / مدى / Apple Pay', note: 'عبر بوابة دفع مرخصة (Moyasar أو HyperPay أو Tap). غير مربوطة في هذه النسخة.', icon: 'CreditCard' },
  { id: 'bank', label: 'تحويل بنكي', note: 'يظهر IBAN الشركة بعد ضبطه من تبويب النظام.', icon: 'Landmark' },
  { id: 'split', label: 'فاتورة مقسمة', note: 'تحصيل القسط الأول الآن والباقي على دفعات.', icon: 'SplitSquareHorizontal' },
  { id: 'usdt', label: 'USDT (BEP-20)', note: 'تحويل على BNB Chain إلى عنوان الاستلام المضبوط في تبويب النظام.', icon: 'Wallet' },
  { id: 'shn', label: 'رصيد SHN', note: 'خصم من رصيد المشترك داخل المنصة.', icon: 'Coins' },
];

export const INITIAL_PAYMENTS = [
  { id: 'PAY-90841', subscriber: 'شركة الأفق الأخضر للطاقة', amountSar: 4500, rail: 'تحويل بنكي', shnImpact: '+285,600 SHN (حرق 2,856)', status: 'مؤكد', timestamp: '2026-11-19 21:14' },
  { id: 'PAY-90842', subscriber: 'مؤسسة مسارات البحر الأحمر للنقل', amountSar: 1800, rail: 'بطاقة / مدى / Apple Pay', shnImpact: '+114,240 SHN (حرق 1,142)', status: 'مؤكد', timestamp: '2026-11-20 01:40' },
];

// دفتر أوامر تجريبي للسوق الثانوي (الأسعار بـ USDT)
export const INITIAL_ASKS = [
  { id: 'A-1', price: 0.00422, amount: 900000 },
  { id: 'A-2', price: 0.00425, amount: 1400000 },
  { id: 'A-3', price: 0.00429, amount: 2100000 },
];
export const INITIAL_BIDS = [
  { id: 'B-1', price: 0.00418, amount: 1100000 },
  { id: 'B-2', price: 0.00415, amount: 1600000 },
  { id: 'B-3', price: 0.00411, amount: 2500000 },
];

// قنوات الإدراج — كلها خطط، ولا يوجد إدراج فعلي حتى الآن
export const LISTING_TARGETS = [
  { name: 'PancakeSwap', kind: 'منصة لامركزية على BNB Chain', stage: 'الأولوية الأولى بعد البيع المسبق' },
  { name: 'CoinMarketCap / CoinGecko', kind: 'منصات تتبع الأسعار', stage: 'بعد توفر سيولة وتداول فعلي' },
  { name: 'منصات مركزية (CEX)', kind: 'Gate.io، MEXC، وغيرها', stage: 'تتطلب تدقيق عقود وامتثال' },
];

// الوحدات التشغيلية العشر — جميعها ترفع تقاريرها مباشرة إلى الرئيس التنفيذي
export const UNITS = [
  { id: 'security', code: 'U-01', name: 'وحدة الأمن وتدقيق العقود', icon: 'ShieldCheck', mandate: 'تدقيق عقود SHN الأربعة، إدارة مفاتيح الخزينة متعددة التوقيع، رصد الثغرات والتهديدات.', kpis: ['نتائج التدقيق المفتوحة', 'حالة Timelock', 'حوادث الأمن'] },
  { id: 'market', code: 'U-02', name: 'وحدة تحليل السوق', icon: 'LineChart', mandate: 'تحليل سعر SHN ودفتر الأوامر وتأثير حركة BTC وETH وسيولة BNB Chain على الطلب.', kpis: ['السعر والفارق', 'حجم التداول', 'عمق الدفتر'] },
  { id: 'chain', code: 'U-03', name: 'وحدة هندسة البلوكتشين', icon: 'Blocks', mandate: 'تطوير وصيانة عقود BEP-20 وEcoSystem وAirdrop وGovernor، وتكامل تطبيق المحفظة.', kpis: ['إصدارات العقود', 'تكلفة الغاز', 'التكاملات'] },
  { id: 'treasury', code: 'U-04', name: 'وحدة الاستثمار والخزينة', icon: 'Landmark', mandate: 'إدارة حصيلة البيع المسبق، تقييم الصفقات، توزيع رأس المال وفق بوابة الحوكمة.', kpis: ['حصيلة البيع المسبق', 'هامش المحفظة', 'الصفقات المعلقة'] },
  { id: 'liquidity', code: 'U-05', name: 'وحدة السيولة وصناعة السوق', icon: 'Droplets', mandate: 'تجهيز مجمع سيولة PancakeSwap، ضبط الفارق السعري، حماية السعر من الحيتان.', kpis: ['مجمع السيولة', 'الفارق السعري', 'الانزلاق'] },
  { id: 'compliance', code: 'U-06', name: 'وحدة الامتثال والشؤون القانونية', icon: 'Scale', mandate: 'متطلبات KYC/AML، الهيكل القانوني الدولي، متابعة تنظيمات الأصول الرقمية في المملكة ومناطق التشغيل.', kpis: ['حالة الكيان القانوني', 'متطلبات KYC', 'المخاطر التنظيمية'] },
  { id: 'marketing', code: 'U-07', name: 'وحدة التسويق والعلامة', icon: 'Megaphone', mandate: 'حملات البيع المسبق، المحتوى عبر حسابات التواصل، الهوية البصرية والسمعية لشاهين.', kpis: ['الوصول', 'التحويل', 'تكلفة الاستحواذ'] },
  { id: 'crm', code: 'U-08', name: 'وحدة علاقات المشتركين', icon: 'Handshake', mandate: 'إدارة المشتركين والتجديد والتحصيل، وبرنامج الإحالة 5%، ومجتمع حاملي العملة.', kpis: ['المشتركون النشطون', 'الإيراد الشهري', 'المتأخرات'] },
  { id: 'risk', code: 'U-09', name: 'وحدة إدارة المخاطر', icon: 'AlertTriangle', mandate: 'نمذجة التقلب ومعامل الخطورة Rc، خطط الطوارئ، مراقبة سقف الموارد اليومي.', kpis: ['معامل الخطورة', 'سقف الموارد', 'التعرض'] },
  { id: 'energy', code: 'U-10', name: 'وحدة الطاقة والحوسبة', icon: 'Zap', mandate: 'تشغيل عقد الحوسبة في مكة وجدة والرياض، نسب الطاقة النظيفة، مكافآت العقد.', kpis: ['معدل المعالجة', 'نسبة الطاقة الخضراء', 'المكافآت'] },
];

// سجل الأعطال — يكمل ترقيم Nexus السابق (B001–B010)
export const BUG_REGISTRY = [
  { id: 'B011', area: 'الهوية', fix: 'توحيد مواصفات SHN على BEP-20 / BNB Chain بدل الادعاء السابق بشبكة مستقلة وخوارزمية SHA-256 ومعروض 21 مليون.' },
  { id: 'B012', area: 'السعر', fix: 'توحيد سعر SHN بالـ USDT (238 SHN لكل USDT) بدل سعرين متعارضين (0.0042$ و4.85 ر.س).' },
  { id: 'B013', area: 'الحرق', fix: 'الحرق 1% عند الشراء كما في العقد، بدل 10% و12% في النسخ السابقة.' },
  { id: 'B014', area: 'الدفع', fix: 'حذف IBAN وعناوين محافظ وهمية ورمز QR عشوائي غير قابل للمسح؛ العناوين تُضبط من المالك ويُولَّد QR حقيقي.' },
  { id: 'B015', area: 'الدفع', fix: 'إزالة حقول رقم البطاقة وCVV من التطبيق؛ البطاقات تمر عبر بوابة دفع مرخصة فقط.' },
  { id: 'B016', area: 'الإدراج', fix: 'إزالة ادعاء الإدراج في Binance وCoinbase وغيرها، واستبداله بخطة إدراج.' },
  { id: 'B017', area: 'الدخول', fix: 'شاشة الدخول السابقة تقبل أي كلمة مرور؛ أصبحت الهوية من حساب Claude، وفي النسخة المستقلة وضع عرض محلي لا يحفظ كلمات مرور.' },
  { id: 'B018', area: 'الوحدات', fix: 'الوكلاء كانوا يستدعون API مباشرة من المتصفح بلا مفتاح؛ أصبحوا يعملون عبر Claude داخل التطبيق.' },
  { id: 'B019', area: 'المحاكاة', fix: 'دورة التعدين كانت تعيد إنشاء المؤقت كل نبضة وتقرأ حالة قديمة؛ أصبحت مؤقتًا واحدًا بمرجع ثابت.' },
  { id: 'B020', area: 'السوق', fix: 'أي أمر كان يغيّر السعر فورًا لسعر المستخدم؛ أصبح هناك محرك مطابقة يملأ من الدفتر ويترك الباقي أمرًا معلقًا.' },
  { id: 'B021', area: 'React', fix: 'إخراج تسجيل التدقيق من داخل دوال تحديث الحالة لتجنب التكرار.' },
  { id: 'B022', area: 'PWA', fix: 'Service Worker لا يُسجَّل من رابط blob؛ أصبح ملف sw.js وmanifest حقيقيين في حزمة النشر.' },
  { id: 'B023', area: 'الصوت', fix: 'توقيت صرخة الصقر أصبح نسبيًا لساعة الصوت بدل أزمنة مطلقة.' },
  { id: 'B024', area: 'العقد', fix: 'buy() في v1 يقسم على 1e18 فيصرف 94,248 wei مقابل 400 USDT. v2 يصرف 94,248 SHN.' },
  { id: 'B025', area: 'العقد', fix: 'الاستحقاق في v1 يستمر بالصرف بعد انتهاء المدة ويستنزف العقد. v2 يتوقف عند المخصص.' },
  { id: 'B026', area: 'العقد', fix: 'مكافآت التخزين في v1 صفر دائمًا وتعتمد mint غير مسموح. v2 يصرف من مجمع ممول.' },
  { id: 'B027', area: 'العقد', fix: 'السقف في v1 ثابت 5M. v2 يبدأ بـ 2.4M ويرفعه DAO فقط.' },
  { id: 'B028', area: 'العقد', fix: 'حدود maxTx/maxWallet في v1 كانت ستمنع أي شراء فوق ~424 USDT بعد إصلاح الخانات. v2 يعتمد حد 10,000 USDT للمحفظة.' },
  { id: 'B030', area: 'الواجهة', fix: 'أزرار المحفظة كانت تتجاهل النقر أثناء تحديث البيانات بعد كل معاملة؛ أصبح التحديث في الخلفية.' },
  { id: 'B031', area: 'الواجهة', fix: 'العائد السنوي للتخزين كان يظهر رقمًا فلكيًا عند قلة المخزّنين؛ أصبح يُعرض بحد أعلى مع توضيح أنه غير مضمون.' },
  { id: 'B029', area: 'العقد', fix: 'مدد DAO في v1 بالكتل لا بالأيام. v2 يعتمد ساعة زمنية، وأضيف دور مشغّل للقائمة البيضاء بدل انتظار Timelock لكل مشترٍ.' },
  { id: 'B032', area: 'الواجهة', fix: 'حقل الفخ المخفي في النماذج كان يُزاح يسارًا فيسبب تمريرًا أفقيًا في الواجهة العربية؛ أصبح مقصوصًا في مكانه.' },
  { id: 'B033', area: 'الوصول', fix: 'بوابة الدخول كانت تحجب نماذج الاشتراك عن الجمهور؛ أصبح تبويب الاشتراك والمستثمرين مفتوحًا دون حساب.' },
  { id: 'B034', area: 'الجوال', fix: 'روابط المحافظ في تطبيق الجوال كانت تشير إلى localhost؛ أصبحت تستخدم رابط التطبيق العام.' },
  { id: 'B036', area: 'الامتثال', fix: 'وحدة TH/s في التعدين (وحدة إثبات العمل) استُبدلت بـ TFLOPS، ووُسمت مكافآت الساعة بأنها محاكاة غير مضمونة.' },
  { id: 'B037', area: 'الاشتراك', fix: 'رمز التحقق كان يُعاد استخدامه بعد «إرسال طلب آخر» فيرفضه الخادم؛ أصبح يُمسح بعد كل إرسال.' },
  { id: 'B038', area: 'الاشتراك', fix: 'أرقام الجوال الملصقة من جهات الاتصال بعلامات اتجاه أو بأرقام فارسية كانت تُرفض؛ أصبحت تُنظَّف.' },
  { id: 'B039', area: 'التطبيق', fix: 'التطبيق المثبت كان يبقى على النسخة القديمة بعد التحديث؛ أصبح اسم التخزين مرتبطًا بالبناء، وملفا index و config يُجلبان من الشبكة أولًا.' },
  { id: 'B035', area: 'الإعدادات', fix: 'إعداد محفوظ فارغ كان يلغي قيمة الخادم المضبوطة في البناء؛ أصبحت القيم الفارغة تُتجاهل.' },
];

export const AUDIT_TAGS = {
  GOVERNANCE: 'text-amber-300 border-amber-300/30',
  HITL: 'text-orange-300 border-orange-300/30',
  BUDGET_GUARD: 'text-rose-300 border-rose-300/30',
  TOKENOMICS: 'text-gold border-gold/30',
  PRESALE: 'text-gold border-gold/30',
  COMPUTE: 'text-sky-300 border-sky-300/30',
  SUBSCRIBERS: 'text-emerald-300 border-emerald-300/30',
  PAYMENTS: 'text-emerald-300 border-emerald-300/30',
  UNITS: 'text-violet-300 border-violet-300/30',
  SYSTEM: 'text-stone-300 border-stone-300/30',
};
