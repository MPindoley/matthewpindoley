/* ============================================================
   nav.js — behaviour for the shared site navigation (nav.css)
   ------------------------------------------------------------
   Sticky state, the Resources menu (hover, click, keyboard) and
   the phone menu button. enhance.js already gives the phone menu
   its scroll lock, focus handling, Escape key and focus trap.
   ============================================================ */
(function () {
  'use strict';
  var nav = document.getElementById('nav');
  if (!nav) return;

  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var reduceMotion = mq('(prefers-reduced-motion: reduce)');

  /* ── Sticky bar ───────────────────────────────────────────── */
  function onScroll() { nav.classList.toggle('stk', window.scrollY > 60); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Resources menu ───────────────────────────────────────── */
  Array.prototype.forEach.call(nav.querySelectorAll('.nav-drop'), function (drop) {
    var trigger = drop.querySelector('.nav-drop-trigger');
    var panel = drop.querySelector('.nav-drop-panel');
    if (!trigger || !panel) return;
    var closeTimer = null, openedByHover = false;

    function items() { return Array.prototype.slice.call(panel.querySelectorAll('a[href]')); }
    function isOpen() { return drop.classList.contains('open'); }
    function setOpen(open) {
      clearTimeout(closeTimer);
      drop.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      // out of the tab order the moment it closes, even while it fades out
      panel.inert = !open;
      if (!open) openedByHover = false;
    }
    panel.inert = true;

    drop.addEventListener('mouseenter', function () {
      if (!finePointer.matches) return;
      if (!isOpen()) openedByHover = true;
      setOpen(true);
    });
    drop.addEventListener('mouseleave', function () {
      if (!finePointer.matches) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () { setOpen(false); }, 160);
    });
    // A click right after hovering keeps the menu open instead of closing it.
    trigger.addEventListener('click', function () {
      if (openedByHover) { openedByHover = false; setOpen(true); return; }
      setOpen(!isOpen());
    });
    drop.addEventListener('keydown', function (e) {
      var list = items(), i = list.indexOf(document.activeElement);
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault(); setOpen(false); trigger.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen()) setOpen(true);
        (list[i + 1] || list[0]).focus();
      } else if (e.key === 'ArrowUp' && i > -1) {
        e.preventDefault();
        (list[i - 1] || trigger).focus();
      }
    });
    drop.addEventListener('focusout', function (e) {
      if (!drop.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (isOpen() && !drop.contains(e.target)) setOpen(false);
    });
  });

  /* ── Book a Consultation: gentle magnetic pull (mouse only) ─ */
  var btn = nav.querySelector('.nav-btn');
  if (btn && finePointer.matches && !reduceMotion.matches) {
    btn.addEventListener('mousemove', function (e) {
      var r = btn.getBoundingClientRect();
      var x = (e.clientX - r.left - r.width / 2) * 0.22;
      var y = (e.clientY - r.top - r.height / 2) * 0.22;
      btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    });
    btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
  }

  /* ── Phone menu ───────────────────────────────────────────── */
  var mob = document.getElementById('mob');
  var hbg = document.getElementById('hbg');
  var mobX = document.getElementById('mob-x');
  if (mob && hbg) {
    var setMob = function (open) {
      mob.classList.toggle('open', open);
      hbg.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    hbg.addEventListener('click', function () { setMob(true); });
    if (mobX) mobX.addEventListener('click', function () { setMob(false); });
    Array.prototype.forEach.call(mob.querySelectorAll('a[href]'), function (a) {
      a.addEventListener('click', function () { setMob(false); });
    });
    // keep aria-expanded right when enhance.js closes the menu with Escape
    new MutationObserver(function () {
      hbg.setAttribute('aria-expanded', mob.classList.contains('open') ? 'true' : 'false');
    }).observe(mob, { attributes: true, attributeFilter: ['class'] });
  }
}());
