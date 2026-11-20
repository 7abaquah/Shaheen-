/* Shaheen website — shared page behaviour (navigation, app links). No inline scripts are used anywhere. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var CFG = window.SHAHEEN_CONFIG || {};

  function isUsableHttpsUrl(value) {
    if (typeof value !== 'string' || !value) return false;
    try {
      var u = new URL(value);
      if (u.protocol !== 'https:') return false;
      if (/\.example$/i.test(u.hostname)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  window.ShaheenUtil = Object.freeze({ isUsableHttpsUrl: isUsableHttpsUrl });

  function initNav() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      nav.classList.toggle('is-open', !open);
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        toggle.focus();
      }
    });
  }

  function initAppLinks() {
    var links = document.querySelectorAll('[data-app-link]');
    if (!links.length) return;
    var ok = isUsableHttpsUrl(CFG.APP_URL);
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (ok) {
        a.setAttribute('href', CFG.APP_URL);
        a.setAttribute('rel', 'noopener');
      }
    }
  }

  function init() {
    initNav();
    initAppLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
