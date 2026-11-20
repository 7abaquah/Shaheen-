// Business subscription plans returned by GET /v1/plans.
// Prices (SAR / month) are defaults and remain business decisions to confirm.
// No card data is ever collected: sales issues an invoice after a plan request.

export const PLANS = Object.freeze([
  Object.freeze({
    id: 'pro-fleet',
    nameAr: 'تشغيلي متقدم',
    nameEn: 'Pro Fleet',
    priceSar: 1800,
    period: 'month',
    featuresAr: Object.freeze([
      'لوحة تشغيل موحدة للوحدات التشغيلية',
      'تقارير أداء أسبوعية',
      'دعم فني في أيام العمل',
      'حتى 25 مستخدمًا',
    ]),
    featuresEn: Object.freeze([
      'Unified operations dashboard',
      'Weekly performance reports',
      'Business-day technical support',
      'Up to 25 users',
    ]),
  }),
  Object.freeze({
    id: 'node-partner',
    nameAr: 'شريك عقدة حوسبة',
    nameEn: 'Node Partner',
    priceSar: 2900,
    period: 'month',
    featuresAr: Object.freeze([
      'كل مزايا الباقة التشغيلية المتقدمة',
      'استضافة عقدة حوسبة مخصصة لجهتكم',
      'تقارير تشغيل العقدة واستهلاك الطاقة',
      'مدير حساب مخصص',
    ]),
    featuresEn: Object.freeze([
      'Everything in Pro Fleet',
      'Dedicated compute node hosting',
      'Node operations and energy usage reports',
      'Dedicated account manager',
    ]),
  }),
  Object.freeze({
    id: 'enterprise',
    nameAr: 'مؤسسي',
    nameEn: 'Enterprise',
    priceSar: 4500,
    period: 'month',
    featuresAr: Object.freeze([
      'كل مزايا باقة شريك العقدة',
      'تكاملات مخصصة مع أنظمة الجهة',
      'اتفاقية مستوى خدمة (SLA) ودعم على مدار الساعة',
      'عدد مستخدمين غير محدود',
    ]),
    featuresEn: Object.freeze([
      'Everything in Node Partner',
      'Custom integrations with your systems',
      'SLA with 24/7 support',
      'Unlimited users',
    ]),
  }),
]);

export const PLAN_IDS = Object.freeze(PLANS.map((p) => p.id));

export function isPlanId(value) {
  return typeof value === 'string' && PLAN_IDS.includes(value);
}
