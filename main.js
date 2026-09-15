/* MDY Solutions — interacțiuni: scroll lin, cursor, magnetism, tilt 3D,
   reveal-uri (SplitText), traseu orizontal pinned, navigare, formular. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;
  var G = window.gsap || null;
  var ST = (G && window.ScrollTrigger) ? window.ScrollTrigger : null;
  var SPLIT = (G && window.SplitText) ? window.SplitText : null;
  if (G && ST) G.registerPlugin(ST);
  if (G && SPLIT) G.registerPlugin(SPLIT);

  /* ---------- scroll lin (Lenis) ---------- */
  var lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false });
    if (G && ST) {
      lenis.on('scroll', ST.update);
      G.ticker.add(function (t) { lenis.raf(t * 1000); });
      G.ticker.lagSmoothing(0);
    } else {
      var rafLenis = function (t) { lenis.raf(t); requestAnimationFrame(rafLenis); };
      requestAnimationFrame(rafLenis);
    }
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.3 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }
  /* API mică folosită de scena 3D (click pe panouri, eticheta cursorului) */
  window.mdy = window.mdy || {};
  window.mdy.scrollTo = function (target) { scrollToEl(typeof target === 'string' ? document.querySelector(target) : target); };
  window.mdy.cursor = { set: function () {}, clear: function () {} };

  /* ---------- navigare ---------- */
  var nav = document.querySelector('.nav');
  var burger = document.querySelector('.nav-burger');
  function closeMenu() {
    root.classList.remove('menu-open');
    if (burger) burger.setAttribute('aria-expanded', 'false');
    if (burger) burger.setAttribute('aria-label', 'Deschide meniul');
    if (lenis) lenis.start();
  }
  if (burger) {
    burger.addEventListener('click', function () {
      var open = root.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
      if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function () { if (window.innerWidth > 900 && root.classList.contains('menu-open')) closeMenu(); }, { passive: true });
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      closeMenu();
      scrollToEl(el);
    });
  });
  function onScrollNav() { if (nav) nav.classList.toggle('is-scrolled', (window.scrollY || 0) > 24); }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ---------- cursor custom ---------- */
  if (fine && !reduce) {
    root.classList.add('has-cursor');
    var cur = document.createElement('div');
    cur.className = 'cursor';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="cursor-dot"></div><div class="cursor-ring"><span class="cursor-label"></span></div>';
    document.body.appendChild(cur);
    var dot = cur.children[0], ring = cur.children[1], label = ring.children[0];
    window.mdy.cursor = {
      set: function (text) { cur.classList.add('is-hover'); if (text) { label.textContent = text; cur.classList.add('has-label'); } },
      clear: function () { cur.classList.remove('is-hover'); cur.classList.remove('has-label'); label.textContent = ''; }
    };
    var mx = -100, my = -100, rx = -100, ry = -100, shown = false, cursorFrame = 0, cursorTime = 0;
    function cursorLoop(time) {
      cursorFrame = 0;
      if (!shown || document.hidden) { cursorTime = 0; return; }
      var dt = cursorTime ? Math.min((time - cursorTime) / 1000, 0.05) : 1 / 60;
      cursorTime = time;
      var blend = 1 - Math.exp(-12 * dt);
      rx += (mx - rx) * blend; ry += (my - ry) * blend;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      if (Math.abs(mx - rx) + Math.abs(my - ry) > 0.1) cursorFrame = requestAnimationFrame(cursorLoop);
      else cursorTime = 0;
    }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; cur.classList.add('is-visible'); }
      if (!cursorFrame) cursorFrame = requestAnimationFrame(cursorLoop);
    }, { passive: true });
    document.addEventListener('mouseleave', function () { cur.classList.remove('is-visible'); shown = false; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(cursorFrame); cursorFrame = 0; cursorTime = 0; }
    });
    var hoverSel = 'a, button, [data-cursor], .tilt, input, textarea, select, label';
    document.addEventListener('pointerover', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(hoverSel) : null;
      if (!t) return;
      cur.classList.add('is-hover');
      var l = t.getAttribute('data-cursor');
      if (l) { label.textContent = l; cur.classList.add('has-label'); }
    });
    document.addEventListener('pointerout', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(hoverSel) : null;
      if (!t) return;
      cur.classList.remove('is-hover'); cur.classList.remove('has-label'); label.textContent = '';
    });
    document.addEventListener('pointerdown', function () { cur.classList.add('is-down'); });
    document.addEventListener('pointerup', function () { cur.classList.remove('is-down'); });
  }

  /* ---------- butoane magnetice ---------- */
  if (fine && !reduce && G) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-strength') || '0.18');
      var bounds = null;
      var moveX = G.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      var moveY = G.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
      el.addEventListener('pointerenter', function () { bounds = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', function (e) {
        var r = bounds || el.getBoundingClientRect();
        var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        moveX(x * strength); moveY(y * strength);
      });
      el.addEventListener('pointerleave', function () {
        moveX(0); moveY(0); bounds = null;
      });
    });
  }

  /* ---------- carduri cu tilt 3D + reflex ---------- */
  if (fine && !reduce) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      var r = null, tiltFrame = 0, tiltTime = 0, active = false;
      var targetX = 0, targetY = 0, currentX = 0, currentY = 0, mx = 50, my = 50;
      var max = Math.min(parseFloat(card.getAttribute('data-tilt') || '6'), 7);
      function drawTilt(time) {
        tiltFrame = 0;
        var dt = tiltTime ? Math.min((time - tiltTime) / 1000, 0.05) : 1 / 60;
        tiltTime = time;
        var blend = 1 - Math.exp(-13 * dt);
        currentX += (targetX - currentX) * blend; currentY += (targetY - currentY) * blend;
        card.style.setProperty('--mx', mx.toFixed(2) + '%'); card.style.setProperty('--my', my.toFixed(2) + '%');
        card.style.setProperty('--rx', currentX.toFixed(3) + 'deg'); card.style.setProperty('--ry', currentY.toFixed(3) + 'deg');
        /* parallax în poza cardului, legat de înclinarea netezită */
        card.style.setProperty('--px', (currentY / max).toFixed(3)); card.style.setProperty('--py', (-currentX / max).toFixed(3));
        if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.008) tiltFrame = requestAnimationFrame(drawTilt);
        else { tiltTime = 0; if (!active) card.classList.remove('is-tilting'); }
      }
      card.addEventListener('pointerenter', function () { r = card.getBoundingClientRect(); active = true; card.classList.add('is-tilting'); });
      card.addEventListener('pointermove', function (e) {
        if (!r) r = card.getBoundingClientRect();
        var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        mx = px * 100; my = py * 100;
        targetX = (0.5 - py) * max; targetY = (px - 0.5) * max;
        if (!tiltFrame) tiltFrame = requestAnimationFrame(drawTilt);
      });
      card.addEventListener('pointerleave', function () {
        active = false; targetX = targetY = 0; r = null;
        if (!tiltFrame) tiltFrame = requestAnimationFrame(drawTilt);
      });
    });
  }

  /* ---------- servicii: card activ -> panou de detalii ---------- */
  var svcCards = document.querySelectorAll('.svc-card');
  var svcPanels = document.querySelectorAll('.svc-detail');
  function activateSvc(key, focusPanel) {
    svcCards.forEach(function (c) {
      var on = c.getAttribute('data-svc') === key;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    svcPanels.forEach(function (p) {
      var on = p.getAttribute('data-svc') === key;
      p.classList.toggle('is-open', on);
      p.hidden = !on;
    });
    if (focusPanel && ST) ST.refresh();
  }
  svcCards.forEach(function (c) {
    c.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); }
    });
    c.addEventListener('click', function () {
      var key = c.getAttribute('data-svc');
      var already = c.classList.contains('is-active');
      activateSvc(already ? '' : key, true);
      if (!already) {
        var panel = document.querySelector('.svc-detail[data-svc="' + key + '"]');
        if (panel && window.innerWidth < 900) setTimeout(function () { scrollToEl(panel); }, 60);
      }
    });
  });
  document.querySelectorAll('.svc-detail-close').forEach(function (b) {
    b.addEventListener('click', function () { activateSvc('', true); });
  });

  /* ---------- formular -> email precompletat ---------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 4200);
  }
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var to = form.getAttribute('data-to') || '';
      var subject = '[mdysolutions.ro] ' + (fd.get('subject') || 'Solicitare ofertă') + ' — ' + (fd.get('company') || fd.get('name') || '');
      var body = 'Nume: ' + (fd.get('name') || '') + '\nCompanie: ' + (fd.get('company') || '') +
        '\nEmail: ' + (fd.get('email') || '') + '\nTelefon: ' + (fd.get('phone') || '') +
        '\nSubiect: ' + (fd.get('subject') || '') + '\n\n' + (fd.get('message') || '');
      window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      toast('Se deschide clientul tău de email cu mesajul precompletat.');
    });
  }

  /* ---------- linkuri care preselectează subiectul din formular ---------- */
  var subjectSel = document.getElementById('f-subject');
  if (subjectSel) {
    document.querySelectorAll('[data-subject]').forEach(function (a) {
      a.addEventListener('click', function () {
        var want = a.getAttribute('data-subject');
        for (var i = 0; i < subjectSel.options.length; i++) {
          if (subjectSel.options[i].text === want) { subjectSel.selectedIndex = i; break; }
        }
      });
    });
  }

  /* ---------- an în footer ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* ---------- animații (GSAP) ---------- */
  if (!G || !ST || reduce) { root.classList.add('no-anim'); return; }

  /* bară de progres */
  var bar = document.querySelector('.progress');
  if (bar) ST.create({ start: 0, end: 'max', onUpdate: function (self) { bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; } });

  /* link activ în navigare */
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (link) {
    var sec = document.querySelector(link.getAttribute('href'));
    if (!sec) return;
    ST.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: function (self) { link.classList.toggle('is-active', self.isActive); } });
  });

  /* reveal-uri generice */
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    var delay = parseFloat(el.getAttribute('data-reveal') || '0');
    G.from(el, { y: 28, opacity: 0, duration: 0.9, delay: delay, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  document.querySelectorAll('[data-reveal-group]').forEach(function (grp) {
    G.from(grp.children, { y: 30, opacity: 0, duration: 0.9, stagger: 0.075, ease: 'power3.out', clearProps: 'transform', scrollTrigger: { trigger: grp, start: 'top 86%', once: true } });
  });
  document.querySelectorAll('[data-line]').forEach(function (el) {
    G.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power3.inOut', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  /* contoare (format românesc: 1.842 / 95,3) */
  function fmtNum(v, dec) {
    var parts = v.toFixed(dec).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return parts.join(',');
  }
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var obj = { v: 0 };
    el.textContent = fmtNum(0, dec);
    G.to(obj, { v: target, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: function () { el.textContent = fmtNum(obj.v, dec); } });
  });

  /* grafice demonstrative: bare și bare de progres */
  document.querySelectorAll('[data-bars]').forEach(function (g) {
    G.from(g.children, { scaleY: 0, transformOrigin: 'bottom', duration: 1.1, stagger: 0.04, ease: 'power3.out', scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
  });
  document.querySelectorAll('[data-fills]').forEach(function (g) {
    G.from(g.querySelectorAll('.fill'), { scaleX: 0, transformOrigin: 'left', duration: 1.3, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
  });

  /* titluri: reveal pe linii cu mască */
  function splitReveal(el, opts) {
    if (!SPLIT) {
      G.from(el, { y: 30, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: opts.st ? { trigger: el, start: 'top 88%', once: true } : null, delay: opts.delay || 0 });
      return;
    }
    SPLIT.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true, linesClass: 'split-line',
      onSplit: function (self) {
        return G.from(self.lines, { yPercent: 115, duration: 1.15, stagger: 0.085, ease: 'power4.out', delay: opts.delay || 0,
          scrollTrigger: opts.st ? { trigger: el, start: 'top 88%', once: true } : null });
      }
    });
  }
  function initSplits() {
    document.querySelectorAll('[data-split]').forEach(function (el) {
      el.style.visibility = '';
      splitReveal(el, { st: true, delay: 0 });
    });
  }
  document.querySelectorAll('[data-split]').forEach(function (el) { el.style.visibility = 'hidden'; });

  /* intro hero */
  var intro = G.timeline({ defaults: { ease: 'power4.out' } });
  intro.from('.nav-inner', { y: -18, opacity: 0, duration: 0.9 }, 0.1)
    .from('.hero-eyebrow', { y: 18, opacity: 0, duration: 0.8 }, 0.2)
    .from('.h1-inner', { yPercent: 115, duration: 1.25, stagger: 0.11, ease: 'power4.out' }, 0.3)
    .from('.hero-lead', { y: 24, opacity: 0, duration: 0.9 }, 0.75)
    .from('.hero-actions > *', { y: 20, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.9)
    .from('.hero-meta > *', { y: 16, opacity: 0, duration: 0.8, stagger: 0.07 }, 1.05)
    .from('.hero-scroll', { opacity: 0, duration: 1 }, 1.4);

  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  var started = false;
  function startSplits() { if (started) return; started = true; initSplits(); ST.refresh(); }
  fontsReady.then(startSplits);
  setTimeout(startSplits, 1800);

  /* traseu orizontal pinned (desktop) */
  var mm = G.matchMedia();
  mm.add('(min-width: 1024px)', function () {
    var pin = document.querySelector('.process-pin'), track = document.querySelector('.process-track');
    if (!pin || !track) return;
    function dist() { return Math.max(0, track.scrollWidth - window.innerWidth); }
    var tween = G.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: {
        trigger: '.process', start: 'top top',
        end: function () { return '+=' + (dist() + window.innerHeight * 0.25); },
        scrub: 0.65, pin: pin, anticipatePin: 1, invalidateOnRefresh: true
      }
    });
    // Keep step numbers visible when arriving directly at #proces or restoring scroll.
    return function () { tween.kill(); };
  });
  mm.add('(max-width: 1023px)', function () {
    document.querySelectorAll('.process .step').forEach(function (s) {
      G.from(s, { y: 36, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
    });
  });

  /* parallax discret pe elementele marcate */
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var amt = parseFloat(el.getAttribute('data-parallax') || '40');
    G.fromTo(el, { y: amt }, { y: -amt, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
})();
