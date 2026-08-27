/* ============================================================
   enhance.js — sitewide interaction refinement
   ============================================================ */
(function () {
  'use strict';

  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var lowBandwidth = !!(connection && (connection.saveData || /(^|-)2g/.test(connection.effectiveType || '')));

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  onReady(function () {
    document.body.classList.add('experience-ready');
    if (lowBandwidth) document.body.classList.add('low-bandwidth');

    /* A small, non-invasive reading marker helps visitors navigate long-form pages. */
    var progress = document.createElement('div');
    progress.className = 'site-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    var ticking = false;
    function updateProgress() {
      var documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      var value = documentHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / documentHeight)) : 0;
      progress.style.setProperty('--reading-progress', value.toFixed(4));
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgress);
      }
    }, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();

    /* Mobile drawer: lock the page behind the menu, restore focus, Escape, and focus trap. */
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
        mob.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) {
          lastFocus = document.activeElement;
          var f = focusables();
          if (f.length) {
            try { f[0].focus({ preventScroll: true }); } catch (e) { f[0].focus(); }
          }
        } else if (lastFocus) {
          try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
          lastFocus = null;
        }
      });
      observer.observe(mob, { attributes: true, attributeFilter: ['class'] });
      mob.setAttribute('aria-hidden', mob.classList.contains('open') ? 'false' : 'true');

      document.addEventListener('keydown', function (e) {
        if (!mob.classList.contains('open')) return;
        if (e.key === 'Escape') { mob.classList.remove('open'); return; }
        if (e.key === 'Tab') {
          var f = focusables();
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      });
    }

    /* Resource cards have mouse activation in the original markup; make them keyboard links too. */
    Array.prototype.forEach.call(document.querySelectorAll('.rs-card[onclick]'), function (card) {
      card.setAttribute('role', 'link');
      card.setAttribute('aria-label', (card.querySelector('.rs-t') || {}).textContent || 'Open resource');
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });

    /* Associate service buttons with their expandable content for assistive technology. */
    Array.prototype.forEach.call(document.querySelectorAll('.sv-row'), function (row, index) {
      var panel = row.querySelector('.sv-panel');
      if (!panel) return;
      var id = panel.id || 'service-detail-' + (index + 1);
      panel.id = id;
      row.setAttribute('aria-controls', id);
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', (row.querySelector('.sv-nm') || {}).textContent || 'Service details');
    });

    /* Highlight the current section in long-page navigation. */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('#nav a[href^="#"]'));
    if (navLinks.length && 'IntersectionObserver' in window) {
      var linkByTarget = {};
      navLinks.forEach(function (link) {
        var target = link.getAttribute('href').slice(1);
        if (target) linkByTarget[target] = link;
      });
      var sections = Object.keys(linkByTarget).map(function (id) { return document.getElementById(id); }).filter(Boolean);
      var navObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (link) {
            link.classList.remove('is-active');
            link.removeAttribute('aria-current');
          });
          var active = linkByTarget[entry.target.id];
          if (active) {
            active.classList.add('is-active');
            active.setAttribute('aria-current', 'location');
          }
        });
      }, { rootMargin: '-38% 0px -54% 0px', threshold: 0.01 });
      sections.forEach(function (section) { navObserver.observe(section); });
    }

    /* Never consume video resources in a background tab; honor motion and data-saving preferences. */
    var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
    function pauseVideos() {
      videos.forEach(function (video) { try { video.pause(); } catch (e) {} });
    }
    function resumeVideos() {
      if (reduce || lowBandwidth || document.visibilityState !== 'visible') return;
      videos.forEach(function (video) {
        if (!video.hasAttribute('autoplay')) return;
        var play = video.play();
        if (play && typeof play.catch === 'function') play.catch(function () {});
      });
    }
    if (reduce || lowBandwidth) pauseVideos();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') pauseVideos();
      else resumeVideos();
    });
  });
}());
