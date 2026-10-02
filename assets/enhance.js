/* ============================================================
   enhance.js — sitewide behavioural refinements
   ------------------------------------------------------------
   Loaded with `defer` after each page's own scripts. It only
   ADDS behaviour; it never rebinds or fights the existing code.
   Everything is guarded so a missing element is a no-op.
   ============================================================ */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── Mobile drawer: scroll-lock, focus, Esc, focus-trap ─────
     We watch the #mob element's class rather than re-binding the
     hamburger, so this cooperates with each page's own handler. */
  var mob = document.getElementById('mob');
  if (mob) {
    var lastFocus = null;

    function focusables() {
      return Array.prototype.filter.call(
        mob.querySelectorAll('a[href],button:not([disabled])'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    var observer = new MutationObserver(function () {
      var open = mob.classList.contains('open');
      document.body.classList.toggle('menu-open', open);

      if (open) {
        lastFocus = document.activeElement;
        var f = focusables();
        if (f.length) { try { f[0].focus({ preventScroll: true }); } catch (e) { f[0].focus(); } }
      } else if (lastFocus) {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
        lastFocus = null;
      }
    });
    observer.observe(mob, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('keydown', function (e) {
      if (!mob.classList.contains('open')) return;

      if (e.key === 'Escape') { mob.classList.remove('open'); return; }

      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }

  /* ── Skip link: first Tab stop on every page ─────────────── */
  (function () {
    if (document.querySelector('.skip-link')) return;
    var target = document.querySelector('main, #hero, #wrap, section');
    if (!target) return;
    if (!target.id) target.id = 'main-content';
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    var a = document.createElement('a');
    a.className = 'skip-link';
    a.href = '#' + target.id;
    a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
  }());

  /* ── Checklist items: keyboard + screen-reader support ────── */
  Array.prototype.forEach.call(document.querySelectorAll('.sb-ck-item'), function (item) {
    item.setAttribute('role', 'checkbox');
    item.setAttribute('tabindex', '0');
    function sync() { item.setAttribute('aria-checked', item.classList.contains('done') ? 'true' : 'false'); }
    sync();
    new MutationObserver(sync).observe(item, { attributes: true, attributeFilter: ['class'] });
    item.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); item.click(); }
    });
  });

  /* ── Floating pills step aside while reading ────────────────
     Shown on load, on scroll up, and near the top/bottom of the page. */
  if (document.querySelector('#disc-pill, #finra-pill')) {
    var lastY = window.pageYOffset, ticking = false;
    var update = function () {
      ticking = false;
      var y = window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var away = document.body.classList.contains('pills-away');
      if (y < 160 || y > max - 240 || y < lastY - 6) { if (away) document.body.classList.remove('pills-away'); }
      else if (y > lastY + 6) { if (!away) document.body.classList.add('pills-away'); }
      if (Math.abs(y - lastY) > 6) lastY = y;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
  }

  /* ── Reduced motion: calm media the stylesheet can't reach ──
     Freeze autoplaying background videos on their first frame.  */
  if (reduce) {
    Array.prototype.forEach.call(document.querySelectorAll('video'), function (v) {
      try {
        v.removeAttribute('autoplay');
        v.autoplay = false;
        v.pause();
      } catch (e) {}
    });
  }
}());
