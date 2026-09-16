/* MDY Solutions — „Ecosistemul MDY”: câte un clip 3D pentru fiecare zonă, care se schimbă singur.
   Fiecare zonă are un poster (webp) și o buclă video scurtă (cameră fixă). Se încarcă doar clipul
   zonei active; celelalte rămân la poster. Fără WebGL, fără dependențe. */
(function () {
  'use strict';
  var root = document.querySelector('.zones');
  if (!root) return;
  var stage = root.querySelector('.zones-stage');
  var panels = Array.prototype.slice.call(root.querySelectorAll('.zone-media'));
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.zone-tab'));
  var cards = Array.prototype.slice.call(root.querySelectorAll('.zone-card'));
  if (!panels.length || panels.length !== tabs.length) return;

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  var DUR = 7000;                      /* cât stă o zonă pe ecran */
  var idx = 0, timer = 0, startAt = 0, remaining = DUR, paused = false, visible = false, raf = 0;

  function video(p) { return p.querySelector('video'); }
  function loadZone(i) {
    var v = video(panels[i]);
    if (!v || reduceMotion || saveData || v.dataset.loaded) return;
    var src = window.innerWidth <= 900 ? v.dataset.small : v.dataset.src;
    if (!src) return;
    v.dataset.loaded = '1';
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.addEventListener('playing', function () { panels[i].classList.add('is-playing'); });
    v.addEventListener('error', function () { panels[i].classList.remove('is-playing'); });
    v.src = src;
  }
  function playZone(i) {
    var v = video(panels[i]);
    if (!v || !v.dataset.loaded || reduceMotion || paused || !visible) return;
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  function show(i, user) {
    if (i === idx && root.dataset.ready) return;
    var prev = idx;
    idx = (i + panels.length) % panels.length;
    panels.forEach(function (p, k) { p.classList.toggle('is-active', k === idx); });
    cards.forEach(function (c, k) { c.classList.toggle('is-active', k === idx); c.hidden = k !== idx; });
    tabs.forEach(function (t, k) {
      t.classList.toggle('is-active', k === idx);
      t.setAttribute('aria-selected', k === idx ? 'true' : 'false');
      t.tabIndex = k === idx ? 0 : -1;
    });
    root.dataset.ready = '1';
    if (prev !== idx) { var pv = video(panels[prev]); if (pv && !pv.paused) pv.pause(); }
    loadZone(idx); playZone(idx);
    loadZone((idx + 1) % panels.length);          /* pregătește următoarea zonă */
    restart(user);
  }
  function restart(user) {
    remaining = user ? DUR + 3000 : DUR;          /* după un click, zona aleasă stă mai mult */
    startAt = performance.now();
    clearTimeout(timer);
    if (!paused && visible && !reduceMotion) timer = setTimeout(next, remaining);
    tick();
  }
  function next() { show(idx + 1); }
  function tick() {
    cancelAnimationFrame(raf);
    if (reduceMotion) return;
    raf = requestAnimationFrame(function step() {
      var el = tabs[idx] && tabs[idx].querySelector('.zone-tab-bar');
      if (el) {
        var p = paused || !visible ? (remaining === DUR ? 0 : el._p || 0) : Math.min(1, (performance.now() - startAt) / remaining);
        el._p = p; el.style.transform = 'scaleX(' + p.toFixed(3) + ')';
      }
      if (!paused && visible) raf = requestAnimationFrame(step);
    });
  }
  function pause(v) {
    if (paused === v) return;
    paused = v;
    if (v) {
      clearTimeout(timer);
      remaining = Math.max(900, remaining - (performance.now() - startAt));
      var cur = video(panels[idx]); if (cur && !cur.paused) cur.pause();
    } else {
      startAt = performance.now();
      if (visible && !reduceMotion) timer = setTimeout(next, remaining);
      playZone(idx);
    }
    tick();
  }

  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { show(k, true); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
      if (!d) return;
      e.preventDefault();
      var n = (k + d + tabs.length) % tabs.length;
      show(n, true); tabs[n].focus();
    });
  });
  stage.addEventListener('pointerenter', function () { pause(true); });
  stage.addEventListener('pointerleave', function () { pause(false); });
  root.addEventListener('focusin', function () { pause(true); });
  root.addEventListener('focusout', function () { if (!root.contains(document.activeElement)) pause(false); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(timer); var v = video(panels[idx]); if (v && !v.paused) v.pause(); }
    else if (visible) { startAt = performance.now(); if (!paused && !reduceMotion) timer = setTimeout(next, remaining); playZone(idx); tick(); }
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible) { loadZone(idx); startAt = performance.now(); if (!paused && !reduceMotion) { clearTimeout(timer); timer = setTimeout(next, remaining); } playZone(idx); tick(); }
      else { clearTimeout(timer); var v = video(panels[idx]); if (v && !v.paused) v.pause(); cancelAnimationFrame(raf); }
    }, { rootMargin: '120px' }).observe(root);
  } else { visible = true; }
  var mq = matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', function (e) { reduceMotion = e.matches; if (reduceMotion) { clearTimeout(timer); cancelAnimationFrame(raf); } else restart(); });

  show(0);
  window.mdyZones = { show: show, next: next, pause: pause, info: function () { return { idx: idx, paused: paused, visible: visible, loaded: panels.map(function (p) { var v = video(p); return !!(v && v.dataset.loaded); }) }; } };
})();
