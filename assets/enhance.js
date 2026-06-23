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
