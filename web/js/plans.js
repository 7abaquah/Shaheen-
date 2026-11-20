/* Shaheen website — loads GET /v1/plans and fills the plan cards and the plan-request select. textContent only. */
(function () {
  'use strict';

  var CFG = window.SHAHEEN_CONFIG || {};
  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ar';
  var TIMEOUT_MS = 15000;

  var TXT = {
    ar: {
      loading: 'جارٍ تحميل الخطط…',
      failed: 'تعذّر تحميل الخطط الآن. أعد المحاولة بعد قليل.',
      notConfigured: 'عرض الخطط غير مفعّل بعد على هذا الموقع.',
      empty: 'لا توجد خطط معروضة حاليًا.',
      retry: 'إعادة تحميل الخطط',
      request: 'طلب هذه الخطة',
      currency: 'ر.س',
      periods: { month: 'شهريًا', year: 'سنويًا' },
      choose: 'اختر الخطة'
    },
    en: {
      loading: 'Loading plans…',
      failed: 'Plans could not be loaded right now. Please try again shortly.',
      notConfigured: 'Plans are not enabled on this site yet.',
      empty: 'No plans are listed at the moment.',
      retry: 'Reload plans',
      request: 'Request this plan',
      currency: 'SAR',
      periods: { month: 'per month', year: 'per year' },
      choose: 'Choose a plan'
    }
  }[LANG];

  var RE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  var numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

  function apiConfigured() {
    var base = CFG.API_BASE;
    if (typeof base !== 'string' || !base) return false;
    try {
      var u = new URL(base);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return false;
      return !/\.example$/i.test(u.hostname);
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function cleanPlan(p) {
    if (!p || typeof p !== 'object') return null;
    if (typeof p.id !== 'string' || !RE_ID.test(p.id)) return null;
    var name = LANG === 'en' ? p.nameEn : p.nameAr;
    if (typeof name !== 'string' || !name) name = typeof p.nameAr === 'string' ? p.nameAr : p.id;
    var feats = LANG === 'en' ? p.featuresEn : p.featuresAr;
    if (!Array.isArray(feats)) feats = [];
    feats = feats.filter(function (f) { return typeof f === 'string' && f.length <= 200; }).slice(0, 12);
    var price = typeof p.priceSar === 'number' && isFinite(p.priceSar) && p.priceSar >= 0 ? p.priceSar : null;
    var period = typeof p.period === 'string' ? p.period.slice(0, 20) : '';
    return { id: p.id, name: name.slice(0, 80), features: feats, price: price, period: period };
  }

  function showState(list, text, withRetry, onRetry) {
    clear(list);
    var box = el('div', 'notice ' + (withRetry ? 'notice--err' : 'notice--info'));
    var wrap = el('div');
    wrap.appendChild(el('p', null, text));
    if (withRetry) {
      var b = el('button', 'btn btn--quiet btn--sm', TXT.retry);
      b.type = 'button';
      b.addEventListener('click', onRetry);
      wrap.appendChild(b);
    }
    box.appendChild(wrap);
    list.appendChild(box);
  }

  function selectPlan(id) {
    var select = document.querySelector('form[data-form="plan"] select[name="planId"]');
    if (!select) return;
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    var target = document.getElementById('plan-request');
    if (target) target.scrollIntoView({ block: 'start' });
    select.focus({ preventScroll: true });
  }

  function render(list, plans) {
    clear(list);
    var select = document.querySelector('form[data-form="plan"] select[name="planId"]');
    if (select) {
      clear(select);
      var ph = el('option', null, TXT.choose);
      ph.value = '';
      select.appendChild(ph);
    }
    if (!plans.length) {
      showState(list, TXT.empty, false);
      return;
    }
    plans.forEach(function (p) {
      var card = el('article', 'card plan-card');
      var h = el('h3', null, p.name);
      card.appendChild(h);
      if (p.price !== null) {
        var price = el('p', 'plan-price');
        price.appendChild(document.createTextNode(numberFmt.format(p.price) + ' ' + TXT.currency + ' '));
        var per = TXT.periods[p.period] || p.period;
        if (per) price.appendChild(el('small', null, per));
        card.appendChild(price);
      }
      if (p.features.length) {
        var ul = el('ul', 'talon-list');
        p.features.forEach(function (f) { ul.appendChild(el('li', null, f)); });
        card.appendChild(ul);
      }
      var btn = el('button', 'btn btn--ghost', TXT.request);
      btn.type = 'button';
      btn.addEventListener('click', function () { selectPlan(p.id); });
      card.appendChild(btn);
      list.appendChild(card);

      if (select) {
        var o = el('option', null, p.price !== null ? p.name + ' — ' + numberFmt.format(p.price) + ' ' + TXT.currency : p.name);
        o.value = p.id;
        select.appendChild(o);
      }
    });
  }

  function load(list) {
    if (!apiConfigured()) {
      showState(list, TXT.notConfigured, false);
      return;
    }
    list.setAttribute('aria-busy', 'true');
    showState(list, TXT.loading, false);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);
    fetch(String(CFG.API_BASE).replace(/\/+$/, '') + '/plans', {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('status ' + res.status);
      return res.json();
    }).then(function (data) {
      var raw = data && Array.isArray(data.plans) ? data.plans : [];
      render(list, raw.map(cleanPlan).filter(Boolean).slice(0, 12));
    }).catch(function () {
      showState(list, TXT.failed, true, function () { load(list); });
    }).then(function () {
      clearTimeout(timer);
      list.removeAttribute('aria-busy');
    });
  }

  function init() {
    var list = document.getElementById('plans-list');
    if (list) load(list);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
