/*
 * Shaheen website — public forms (subscribe, plan request, investor interest).
 * Mirrors the API v1 contract. All text is written with textContent; nothing is stored in browser web storage.
 */
(function () {
  'use strict';

  var CFG = window.SHAHEEN_CONFIG || {};
  var LANG = document.documentElement.lang === 'en' ? 'en' : 'ar';
  var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var REQUEST_TIMEOUT_MS = 20000;
  var MAX_BODY_BYTES = 8 * 1024;

  var MSG = {
    ar: {
      required: 'هذا الحقل مطلوب.',
      length: 'اكتب من {min} إلى {max} حرفًا.',
      maxLength: 'الحد الأقصى {max} حرف.',
      email: 'اكتب بريدًا إلكترونيًا صحيحًا، مثل name@example.com.',
      phone: 'اكتب الرقم بالصيغة الدولية، مثل ‎+966501234567‎.',
      choose: 'اختر أحد الخيارات.',
      interests: 'اختر اهتمامًا واحدًا على الأقل.',
      consent: 'الموافقة على سياسة الخصوصية مطلوبة لإرسال النموذج.',
      seats: 'اكتب عددًا صحيحًا من 1 إلى 500، أو اترك الحقل فارغًا.',
      orgRequired: 'اسم الجهة مطلوب عند اختيار «جهة / مؤسسة».',
      serverField: 'راجع قيمة هذا الحقل.',
      summary: 'راجع الحقول المحددة ({n}) ثم أعد الإرسال.',
      sending: 'جارٍ الإرسال…',
      tsLoading: 'جارٍ تحميل أداة التحقق من Cloudflare…',
      tsReady: 'أكمل التحقق أعلاه قبل الإرسال.',
      tsDone: 'تم التحقق.',
      tsNeeded: 'أكمل التحقق من Cloudflare Turnstile قبل الإرسال.',
      tsLoadFailed: 'تعذّر تحميل أداة التحقق (Cloudflare Turnstile). قد يكون السبب مانع محتوى أو اتصالًا ضعيفًا. عطّل مانع المحتوى لهذا الموقع أو حدّث الصفحة ثم حاول مجددًا.',
      tsError: 'تعذّر إكمال التحقق. حدّث الصفحة ثم حاول مجددًا.',
      tsExpired: 'انتهت صلاحية التحقق. أكمله مرة أخرى.',
      tsNotConfigured: 'أداة التحقق غير مُعدّة بعد على هذا الموقع، لذلك الإرسال متوقف مؤقتًا.',
      notConfigured: 'استقبال النماذج غير مفعّل بعد على هذا الموقع. تابع قنواتنا الرسمية لمعرفة موعد التفعيل.',
      tooLarge: 'حجم البيانات أكبر من المسموح. اختصر نص الرسالة أو الملاحظات ثم أعد الإرسال.',
      network: 'تعذّر الاتصال بالخادم. تحقّق من اتصالك ثم أعد المحاولة.',
      timeout: 'استغرق الخادم وقتًا أطول من المعتاد. أعد المحاولة بعد قليل.',
      codes: {
        invalid: 'بعض البيانات غير مقبولة. راجع الحقول المحددة ثم أعد الإرسال.',
        captcha_failed: 'لم ينجح التحقق من Cloudflare. أكمل التحقق مرة أخرى ثم أرسل.',
        forbidden_origin: 'هذا الموقع غير مخوّل بإرسال الطلبات حاليًا. تواصل معنا عبر القنوات الرسمية.',
        unauthorized: 'الطلب غير مصرّح به. حدّث الصفحة ثم أعد المحاولة.',
        not_found: 'الخدمة المطلوبة غير متاحة حاليًا. أعد المحاولة لاحقًا.',
        rate_limited: 'تجاوزت عدد المحاولات المسموح لهذا النموذج. أعد المحاولة بعد ساعة.',
        payload_too_large: 'حجم البيانات أكبر من المسموح. اختصر نص الرسالة أو الملاحظات ثم أعد الإرسال.',
        server_error: 'حدث خطأ في الخادم. أعد المحاولة بعد قليل.'
      }
    },
    en: {
      required: 'This field is required.',
      length: 'Enter {min} to {max} characters.',
      maxLength: 'Maximum {max} characters.',
      email: 'Enter a valid email address, e.g. name@example.com.',
      phone: 'Enter the number in international format, e.g. +966501234567.',
      choose: 'Choose one of the options.',
      interests: 'Choose at least one interest.',
      consent: 'You must accept the privacy policy to send this form.',
      seats: 'Enter a whole number from 1 to 500, or leave it empty.',
      orgRequired: 'Organisation name is required for institutional investors.',
      serverField: 'Please check this value.',
      summary: 'Please fix the highlighted fields ({n}) and send again.',
      sending: 'Sending…',
      tsLoading: 'Loading the Cloudflare verification…',
      tsReady: 'Complete the verification above before sending.',
      tsDone: 'Verified.',
      tsNeeded: 'Complete the Cloudflare Turnstile verification before sending.',
      tsLoadFailed: 'The verification widget (Cloudflare Turnstile) could not load. A content blocker or a weak connection may be the cause. Allow this site in your blocker or reload the page, then try again.',
      tsError: 'Verification could not be completed. Reload the page and try again.',
      tsExpired: 'The verification expired. Please complete it again.',
      tsNotConfigured: 'Verification is not configured on this site yet, so sending is paused.',
      notConfigured: 'Form submission is not enabled on this site yet. Follow our official channels for the launch date.',
      tooLarge: 'The submission is too large. Shorten the message or notes and send again.',
      network: 'Could not reach the server. Check your connection and try again.',
      timeout: 'The server took too long to respond. Please try again shortly.',
      codes: {
        invalid: 'Some values were not accepted. Check the highlighted fields and send again.',
        captcha_failed: 'Cloudflare verification failed. Complete the verification again, then send.',
        forbidden_origin: 'This site is not currently authorised to send requests. Please contact us through official channels.',
        unauthorized: 'The request was not authorised. Reload the page and try again.',
        not_found: 'The requested service is not available right now. Try again later.',
        rate_limited: 'Too many attempts for this form. Try again in an hour.',
        payload_too_large: 'The submission is too large. Shorten the message or notes and send again.',
        server_error: 'A server error occurred. Please try again shortly.'
      }
    }
  };

  function t(key, params) {
    var s = MSG[LANG][key];
    if (typeof s !== 'string') s = MSG.ar[key] || '';
    if (params) {
      Object.keys(params).forEach(function (k) { s = s.split('{' + k + '}').join(String(params[k])); });
    }
    return s;
  }

  /* ---------- value helpers ---------- */

  function toLatinDigits(v) {
    return String(v).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 0x06F0); });
  }

  function normalizePhone(v) {
    var s = toLatinDigits(v).replace(/[\s\-().‎‏]/g, '');
    if (s.indexOf('00') === 0) s = '+' + s.slice(2);
    if (/^05\d{8}$/.test(s)) s = '+966' + s.slice(1);
    else if (/^5\d{8}$/.test(s)) s = '+966' + s;
    return s;
  }

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var RE_E164 = /^\+[1-9]\d{7,14}$/;
  var RE_ISO2 = /^[A-Z]{2}$/;

  function charLen(s) { return Array.from(s).length; }

  /* ---------- form schemas (mirror contract/API.md) ---------- */

  var SCHEMAS = {
    subscribe: {
      path: '/subscribe',
      fields: {
        name: { type: 'text', required: true, min: 2, max: 80 },
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: false },
        lang: { type: 'radio', required: true, values: ['ar', 'en'] },
        interests: { type: 'checkboxes', values: ['app', 'presale', 'mining', 'staking', 'news'], minChecked: 1, msg: 'interests' },
        consent: { type: 'consent' }
      }
    },
    plan: {
      path: '/plan-requests',
      fields: {
        planId: { type: 'select', required: true },
        organization: { type: 'text', required: true, min: 2, max: 120 },
        contactName: { type: 'text', required: true, min: 2, max: 80 },
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: true },
        paymentMethod: { type: 'radio', required: true, values: ['bank', 'card', 'usdt'] },
        seats: { type: 'int', required: false, min: 1, max: 500 },
        notes: { type: 'textarea', required: false, max: 1000 },
        consent: { type: 'consent' }
      }
    },
    investor: {
      path: '/investors',
      fields: {
        fullName: { type: 'text', required: true, min: 2, max: 100 },
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: true },
        country: { type: 'country', required: true },
        investorType: { type: 'radio', required: true, values: ['individual', 'institution'] },
        organization: { type: 'text', required: false, max: 120, minWhenRequired: 2, requiredWhen: { field: 'investorType', value: 'institution' } },
        ticketRange: { type: 'select', required: true, values: ['under-10k', '10k-50k', '50k-250k', 'over-250k'] },
        qualifiedDeclaration: { type: 'boolean' },
        message: { type: 'textarea', required: false, max: 1500 },
        lang: { type: 'fixed', value: LANG },
        consent: { type: 'consent' }
      }
    }
  };

  /* ---------- DOM helpers ---------- */

  function controls(form, name) {
    return form.querySelectorAll('[name="' + name + '"]');
  }

  function rawValue(form, name, spec) {
    var els = controls(form, name);
    if (!els.length) return null;
    if (spec.type === 'radio') {
      for (var i = 0; i < els.length; i++) if (els[i].checked) return els[i].value;
      return '';
    }
    if (spec.type === 'checkboxes') {
      var out = [];
      for (var j = 0; j < els.length; j++) if (els[j].checked) out.push(els[j].value);
      return out;
    }
    if (spec.type === 'consent' || spec.type === 'boolean') return !!els[0].checked;
    return String(els[0].value || '').trim();
  }

  function fieldBox(form, name) {
    return form.querySelector('[data-field="' + name + '"]');
  }

  function errorEl(form, name) {
    var box = fieldBox(form, name);
    return box ? box.querySelector('.field-error') : null;
  }

  function invalidTarget(form, name) {
    var box = fieldBox(form, name);
    if (!box) return null;
    if (box.tagName === 'FIELDSET') return box;
    return box.querySelector('[name="' + name + '"]');
  }

  function focusTarget(form, name) {
    var box = fieldBox(form, name);
    if (!box) return null;
    return box.querySelector('input:not([type="hidden"]), select, textarea');
  }

  function setFieldError(form, name, message) {
    var err = errorEl(form, name);
    var target = invalidTarget(form, name);
    if (err) {
      err.textContent = message;
      err.hidden = false;
    }
    if (target) target.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(form, name) {
    var err = errorEl(form, name);
    var target = invalidTarget(form, name);
    if (err) {
      err.textContent = '';
      err.hidden = true;
    }
    if (target) target.removeAttribute('aria-invalid');
  }

  function setStatus(state, tone, text) {
    var box = state.status;
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    box.classList.remove('notice', 'notice--err', 'notice--ok', 'notice--info', 'notice--warn');
    if (!text) return;
    box.classList.add('notice', 'notice--' + tone);
    var p = document.createElement('p');
    p.textContent = text;
    box.appendChild(p);
  }

  /* ---------- validation ---------- */

  function isRequired(form, spec) {
    if (spec.required) return true;
    if (spec.requiredWhen) {
      var other = rawValue(form, spec.requiredWhen.field, { type: 'radio' });
      return other === spec.requiredWhen.value;
    }
    return false;
  }

  function validateField(form, name, spec) {
    var v = rawValue(form, name, spec);
    if (v === null && spec.type !== 'fixed') return null; // control not on page
    var required = isRequired(form, spec);
    switch (spec.type) {
      case 'text':
      case 'textarea': {
        if (!v) return required ? (spec.requiredWhen ? t('orgRequired') : t('required')) : null;
        var n = charLen(v);
        if (spec.min && (n < spec.min || n > spec.max)) return t('length', { min: spec.min, max: spec.max });
        if (spec.minWhenRequired && required && n < spec.minWhenRequired) return t('length', { min: spec.minWhenRequired, max: spec.max });
        if (spec.max && n > spec.max) return t('maxLength', { max: spec.max });
        return null;
      }
      case 'email':
        if (!v) return required ? t('required') : null;
        if (v.length > 254 || !RE_EMAIL.test(v)) return t('email');
        return null;
      case 'phone': {
        if (!v) return required ? t('required') : null;
        return RE_E164.test(normalizePhone(v)) ? null : t('phone');
      }
      case 'radio':
        if (!v) return required ? t('choose') : null;
        return spec.values.indexOf(v) === -1 ? t('choose') : null;
      case 'select':
        if (!v) return required ? t('choose') : null;
        if (spec.values && spec.values.indexOf(v) === -1) return t('choose');
        return null;
      case 'country':
        if (!v) return required ? t('choose') : null;
        return RE_ISO2.test(v) ? null : t('choose');
      case 'checkboxes': {
        var bad = v.some(function (x) { return spec.values.indexOf(x) === -1; });
        if (bad || v.length < (spec.minChecked || 0)) return t(spec.msg || 'choose');
        return null;
      }
      case 'int': {
        var s = toLatinDigits(v);
        if (!s) return required ? t('required') : null;
        if (!/^\d{1,3}$/.test(s)) return t('seats');
        var num = parseInt(s, 10);
        return (num < spec.min || num > spec.max) ? t('seats') : null;
      }
      case 'consent':
        return v ? null : t('consent');
      default:
        return null;
    }
  }

  function validate(form, schema) {
    var errors = {};
    Object.keys(schema.fields).forEach(function (name) {
      var msg = validateField(form, name, schema.fields[name]);
      if (msg) errors[name] = msg;
    });
    return errors;
  }

  function buildPayload(form, schema, token) {
    var body = {};
    Object.keys(schema.fields).forEach(function (name) {
      var spec = schema.fields[name];
      var v = spec.type === 'fixed' ? spec.value : rawValue(form, name, spec);
      if (v === null) return;
      switch (spec.type) {
        case 'phone': if (v) body[name] = normalizePhone(v); break;
        case 'int': if (v) body[name] = parseInt(toLatinDigits(v), 10); break;
        case 'consent': body[name] = v === true; break;
        case 'boolean': body[name] = v === true; break;
        case 'checkboxes': body[name] = v.slice(); break;
        case 'fixed': body[name] = v; break;
        default:
          if (v !== '') body[name] = v;
      }
    });
    if (schema === SCHEMAS.investor && body.investorType !== 'institution' && !body.organization) {
      delete body.organization;
    }
    body.turnstileToken = token;
    var hp = form.querySelector('input[name="website"]');
    body.website = hp ? String(hp.value || '') : '';
    return body;
  }

  /* ---------- Turnstile ---------- */

  var turnstilePromise = null;

  function siteKeyConfigured() {
    var k = CFG.TURNSTILE_SITE_KEY;
    return typeof k === 'string' && k.length > 0 && !/^REPLACE/i.test(k);
  }

  function loadTurnstile() {
    if (window.turnstile && typeof window.turnstile.render === 'function') return Promise.resolve(window.turnstile);
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = TURNSTILE_SRC;
      script.async = true;
      var timer = setTimeout(function () { reject(new Error('turnstile-timeout')); }, 15000);
      script.addEventListener('load', function () {
        clearTimeout(timer);
        if (window.turnstile && typeof window.turnstile.render === 'function') resolve(window.turnstile);
        else reject(new Error('turnstile-missing'));
      });
      script.addEventListener('error', function () {
        clearTimeout(timer);
        reject(new Error('turnstile-load'));
      });
      document.head.appendChild(script);
    });
    return turnstilePromise;
  }

  function setTsMessage(state, key, isError) {
    if (!state.tsMsg) return;
    state.tsMsg.textContent = t(key);
    state.tsMsg.classList.toggle('is-error', !!isError);
  }

  function initTurnstile(state) {
    if (!state.tsBox) return;
    if (!siteKeyConfigured()) {
      state.tsBlocked = 'tsNotConfigured';
      setTsMessage(state, 'tsNotConfigured', true);
      return;
    }
    setTsMessage(state, 'tsLoading', false);
    loadTurnstile().then(function (ts) {
      try {
        state.widgetId = ts.render(state.tsBox, {
          sitekey: CFG.TURNSTILE_SITE_KEY,
          theme: 'dark',
          language: LANG,
          callback: function (token) {
            state.token = token;
            state.tsBlocked = null;
            setTsMessage(state, 'tsDone', false);
          },
          'expired-callback': function () {
            state.token = null;
            setTsMessage(state, 'tsExpired', true);
          },
          'error-callback': function () {
            state.token = null;
            setTsMessage(state, 'tsError', true);
            return true;
          }
        });
        if (!state.token) setTsMessage(state, 'tsReady', false);
      } catch (e) {
        state.tsBlocked = 'tsLoadFailed';
        setTsMessage(state, 'tsLoadFailed', true);
      }
    }).catch(function () {
      state.tsBlocked = 'tsLoadFailed';
      setTsMessage(state, 'tsLoadFailed', true);
    });
  }

  function currentToken(state) {
    if (state.token) return state.token;
    if (window.turnstile && state.widgetId != null && typeof window.turnstile.getResponse === 'function') {
      try { return window.turnstile.getResponse(state.widgetId) || null; } catch (e) { return null; }
    }
    return null;
  }

  function resetTurnstile(state) {
    state.token = null;
    if (window.turnstile && state.widgetId != null && typeof window.turnstile.reset === 'function') {
      try { window.turnstile.reset(state.widgetId); } catch (e) { /* ignore */ }
    }
  }

  /* ---------- submission ---------- */

  function apiConfigured() {
    var base = CFG.API_BASE;
    if (typeof base !== 'string' || !base) return false;
    try {
      var u = new URL(base);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) return false;
      return !/\.example$/i.test(u.hostname);
    } catch (e) {
      return false;
    }
  }

  function apiUrl(path) {
    return String(CFG.API_BASE).replace(/\/+$/, '') + path;
  }

  function setSending(state, sending) {
    state.sending = sending;
    var btn = state.submit;
    if (!btn) return;
    btn.disabled = sending;
    if (sending) {
      btn.setAttribute('aria-busy', 'true');
      state.submitLabel.textContent = t('sending');
    } else {
      btn.removeAttribute('aria-busy');
      state.submitLabel.textContent = state.submitText;
    }
  }

  function showErrors(state, errors, focus) {
    var names = Object.keys(errors);
    names.forEach(function (n) { setFieldError(state.form, n, errors[n]); });
    if (focus && names.length) {
      // focus the first invalid control in document order
      var first = null;
      var boxes = state.form.querySelectorAll('[data-field]');
      for (var i = 0; i < boxes.length && !first; i++) {
        var name = boxes[i].getAttribute('data-field');
        if (errors[name]) first = focusTarget(state.form, name);
      }
      if (first) first.focus();
    }
  }

  function clearAllErrors(state) {
    Object.keys(state.schema.fields).forEach(function (n) { clearFieldError(state.form, n); });
    setStatus(state, null, '');
  }

  function handleApiError(state, status, data) {
    var code = data && typeof data.code === 'string' ? data.code : null;
    if (!code) {
      if (status === 429) code = 'rate_limited';
      else if (status === 413) code = 'payload_too_large';
      else if (status === 403) code = 'forbidden_origin';
      else if (status === 400) code = 'invalid';
      else code = 'server_error';
    }
    var fieldErrors = {};
    var extra = [];
    if (data && data.fields && typeof data.fields === 'object') {
      Object.keys(data.fields).forEach(function (name) {
        var reason = data.fields[name];
        var known = Object.prototype.hasOwnProperty.call(state.schema.fields, name) && fieldBox(state.form, name);
        var text = (LANG === 'ar' && typeof reason === 'string' && reason.length <= 300) ? reason : t('serverField');
        if (known) fieldErrors[name] = text;
        else if (typeof reason === 'string' && LANG === 'ar') extra.push(reason);
      });
    }
    showErrors(state, fieldErrors, true);
    var msg = MSG[LANG].codes[code] || MSG[LANG].codes.server_error;
    if (extra.length) msg += ' ' + extra.join(' ');
    setStatus(state, 'err', msg);
    if (code === 'captcha_failed') setTsMessage(state, 'tsExpired', true);
    if (!Object.keys(fieldErrors).length && state.status) state.status.focus();
  }

  function showSuccess(state, data) {
    state.form.hidden = true;
    var panel = state.success;
    if (!panel) return;
    var ref = panel.querySelector('[data-ref]');
    var refWrap = panel.querySelector('[data-ref-wrap]');
    if (ref && data && typeof data.reference === 'string' && data.reference.length <= 64) {
      ref.textContent = data.reference;
      if (refWrap) refWrap.hidden = false;
    }
    panel.hidden = false;
    panel.focus();
  }

  function onSubmit(state, ev) {
    ev.preventDefault();
    if (state.sending) return;
    clearAllErrors(state);

    var errors = validate(state.form, state.schema);
    var n = Object.keys(errors).length;
    if (n) {
      showErrors(state, errors, true);
      setStatus(state, 'err', t('summary', { n: n }));
      return;
    }

    if (!apiConfigured()) {
      setStatus(state, 'err', t('notConfigured'));
      state.status.focus();
      return;
    }

    var token = currentToken(state);
    if (!token) {
      var key = state.tsBlocked || 'tsNeeded';
      setTsMessage(state, key, true);
      setStatus(state, 'err', t(key));
      state.status.focus();
      return;
    }

    var payload = buildPayload(state.form, state.schema, token);
    var json = JSON.stringify(payload);
    if (new TextEncoder().encode(json).length > MAX_BODY_BYTES) {
      setStatus(state, 'err', t('tooLarge'));
      state.status.focus();
      return;
    }

    setSending(state, true);
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, REQUEST_TIMEOUT_MS);

    fetch(apiUrl(state.schema.path), {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'strict-origin-when-cross-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: json,
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { status: res.status, ok: res.ok, data: data };
      });
    }).then(function (r) {
      if (r.ok && r.data && r.data.ok === true) {
        showSuccess(state, r.data);
      } else {
        handleApiError(state, r.status, r.data);
      }
    }).catch(function (err) {
      setStatus(state, 'err', err && err.name === 'AbortError' ? t('timeout') : t('network'));
      state.status.focus();
    }).then(function () {
      clearTimeout(timer);
      setSending(state, false);
      resetTurnstile(state);
    });
  }

  /* ---------- per-form extras ---------- */

  var PRIORITY_COUNTRIES = ['SA', 'AE', 'BH', 'KW', 'OM', 'QA'];
  var ISO_COUNTRIES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
    'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
    'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');

  function fillCountries(form) {
    var select = form.querySelector('select[name="country"]');
    if (!select) return;
    var names = null;
    try { names = new Intl.DisplayNames([LANG], { type: 'region' }); } catch (e) { names = null; }
    function label(code) {
      var n = null;
      try { n = names ? names.of(code) : null; } catch (e) { n = null; }
      return n && n !== code ? n + ' (' + code + ')' : code;
    }
    var collator = typeof Intl.Collator === 'function' ? new Intl.Collator(LANG) : null;
    var rest = ISO_COUNTRIES.filter(function (c) { return PRIORITY_COUNTRIES.indexOf(c) === -1; })
      .map(function (c) { return { code: c, label: label(c) }; });
    rest.sort(function (a, b) { return collator ? collator.compare(a.label, b.label) : (a.label < b.label ? -1 : 1); });

    var g1 = document.createElement('optgroup');
    g1.label = LANG === 'ar' ? 'دول الخليج' : 'Gulf countries';
    PRIORITY_COUNTRIES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = label(c);
      g1.appendChild(o);
    });
    var g2 = document.createElement('optgroup');
    g2.label = LANG === 'ar' ? 'كل الدول' : 'All countries';
    rest.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.code;
      o.textContent = c.label;
      g2.appendChild(o);
    });
    select.appendChild(g1);
    select.appendChild(g2);
  }

  function initInvestorType(form) {
    var orgBox = fieldBox(form, 'organization');
    if (!orgBox) return;
    var input = orgBox.querySelector('input');
    var reqMark = orgBox.querySelector('[data-req-when]');
    function sync() {
      var inst = rawValue(form, 'investorType', { type: 'radio' }) === 'institution';
      if (reqMark) reqMark.hidden = !inst;
      if (input) {
        if (inst) input.setAttribute('aria-required', 'true');
        else input.removeAttribute('aria-required');
      }
      if (!inst) clearFieldError(form, 'organization');
    }
    var radios = controls(form, 'investorType');
    for (var i = 0; i < radios.length; i++) radios[i].addEventListener('change', sync);
    sync();
  }

  /* ---------- init ---------- */

  function initForm(form) {
    var kind = form.getAttribute('data-form');
    var schema = SCHEMAS[kind];
    if (!schema) return;
    var submit = form.querySelector('button[type="submit"]');
    var submitLabel = submit ? (submit.querySelector('[data-label]') || submit) : null;
    var state = {
      form: form,
      schema: schema,
      submit: submit,
      submitLabel: submitLabel,
      submitText: submitLabel ? submitLabel.textContent : '',
      status: form.querySelector('[data-status]'),
      success: document.getElementById(form.getAttribute('data-success')),
      tsBox: form.querySelector('[data-turnstile]'),
      tsMsg: form.querySelector('[data-turnstile-msg]'),
      token: null,
      widgetId: null,
      tsBlocked: null,
      sending: false
    };
    form.setAttribute('novalidate', '');
    if (submit) submit.disabled = false; // rendered disabled so the form cannot be sent without JS
    if (kind === 'investor') {
      fillCountries(form);
      initInvestorType(form);
    }
    // clear a field's error as soon as the user fixes it
    form.addEventListener('change', function (ev) {
      var box = ev.target.closest ? ev.target.closest('[data-field]') : null;
      if (!box) return;
      var name = box.getAttribute('data-field');
      if (schema.fields[name] && !validateField(form, name, schema.fields[name])) clearFieldError(form, name);
    });
    form.addEventListener('submit', function (ev) { onSubmit(state, ev); });
    initTurnstile(state);
  }

  function init() {
    var forms = document.querySelectorAll('form[data-form]');
    for (var i = 0; i < forms.length; i++) initForm(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
