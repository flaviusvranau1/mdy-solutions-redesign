/* MDY Solutions — hero „Sentinel”: server modern într-un câmp de protecție, cu ecrane holografice live.
   Placa foto (Higgsfield: Nano Banana Pro + Veo 3.1 Lite, upscale 2K) stă în spate; peste ea:
   - trei ecrane transparente cu date live (canvas 2D mapat exact pe sticla din imagine prin matrix3d)
   - un strat WebGL cu filamentele câmpului, pulsul inelului, atacuri care sunt blocate la contact
   - câmpul de particule al paginii (canvas #scene)
   Fără WebGL: rămân placa, video-ul și ecranele. Cu reduced-motion: cadru static. */
(function () {
  'use strict';
  var root = document.documentElement;
  var hero = document.getElementById('hero');
  var plate = hero && hero.querySelector('.hero-plate');
  if (!hero || !plate) return;
  var world = plate.querySelector('.hero-world');
  var img = plate.querySelector('.hero-plate-img');
  var video = plate.querySelector('.hero-plate-video');
  var fxCanvas = plate.querySelector('.hero-fx');
  var copy = hero.querySelector('.hero-copy');
  var stage = hero.querySelector('.hero-stage');

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  var userPaused = false;
  try { userPaused = localStorage.getItem('mdy-hero-paused') === '1'; } catch (e) { userPaused = false; }
  var measureCtx = document.createElement('canvas').getContext('2d');

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function rnd(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* ---------- geometria plăcii (pixeli în imaginea 2752×1536, măsurați pe fișier) ---------- */
  var IW = 2752, IH = 1536;
  var PANES = {
    main: [[1229, 457.6], [1771, 426.4], [1771, 879.2], [1229, 872.6]],
    mid: [[1825, 495.6], [2116, 469.1], [2116, 805.8], [1825, 810.2]],
    small: [[2170, 533], [2312, 526.4], [2312, 765.8], [2170, 766.9]]
  };
  var VIDEO_MAP = { top: -4.7, height: 1543.7 };           /* cadrul video în unități de imagine (potrivit pe 12 muchii, 2 cadre) */
  var FIELD = { cx: 1890, left: 1350, right: 2430, ringY: 1296, ringRx: 548, ringRy: 48 };

  /* omografie: pătratul unitate -> patrulater (pentru matrix3d) */
  function solve8(A, b) {
    var n = 8, i, j, k;
    for (i = 0; i < n; i++) {
      var p = i; for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
      var tA = A[i]; A[i] = A[p]; A[p] = tA; var tb = b[i]; b[i] = b[p]; b[p] = tb;
      for (j = i + 1; j < n; j++) { var f = A[j][i] / A[i][i]; for (k = i; k < n; k++) A[j][k] -= f * A[i][k]; b[j] -= f * b[i]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = b[i]; for (j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  }
  function matrix3d(w, h, q) {
    var src = [[0, 0], [w, 0], [w, h], [0, h]], A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = q[i][0], v = q[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var H = solve8(A, b);
    var m = [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, 1];
    return 'matrix3d(' + m.map(function (v) { return +v.toFixed(8); }).join(',') + ')';
  }

  /* ---------- layout: unde stă placa în hero (desktop) sau în scenă (telefon) ---------- */
  var L = { s: 0.5, ox: 0, oy: 0, pw: 1, ph: 1, compact: false };
  function layout() {
    var pw = plate.clientWidth, ph = plate.clientHeight;
    if (!pw || !ph) return;
    var compact = matchMedia('(max-width: 900px)').matches, s, ox, oy;
    if (!compact) {
      var pr = plate.getBoundingClientRect(), cr = copy ? copy.getBoundingClientRect() : { right: pr.left + pw * 0.45 };
      var paneL = Math.max(cr.right - pr.left + 44, pw * 0.47);
      s = Math.min((pw - 18 - paneL) / (2330 - 1229), ph / 1230);
      ox = paneL - 1229 * s;
      oy = ph / 2 - 760 * s;
    } else {
      s = Math.min(pw / 1150, ph / 1280);
      ox = pw / 2 - 1770 * s;
      oy = ph / 2 - 770 * s;
    }
    L.s = s; L.ox = ox; L.oy = oy; L.pw = pw; L.ph = ph; L.compact = compact;
    var box = 'left:' + ox.toFixed(2) + 'px;top:' + oy.toFixed(2) + 'px;width:' + (IW * s).toFixed(2) + 'px;height:' + (IH * s).toFixed(2) + 'px';
    img.style.cssText = box;
    var wantSizes = Math.round(IW * s) + 'px';
    if (img.getAttribute('sizes') !== wantSizes) img.setAttribute('sizes', wantSizes);
    L.heroTop = hero.getBoundingClientRect().top + (window.scrollY || 0); L.heroH = hero.offsetHeight;
    if (video) video.style.cssText = 'left:' + ox.toFixed(2) + 'px;top:' + (oy + VIDEO_MAP.top * s).toFixed(2) + 'px;width:' + (IW * s).toFixed(2) + 'px;height:' + (VIDEO_MAP.height * s).toFixed(2) + 'px';
    plate.style.setProperty('--shade-end', Math.round((compact ? 0 : paneL - 30)) + 'px');
    /* dacă fotografia nu acoperă o margine (ecrane foarte late sau scurte), marginea se topește în fundal */
    var eT = Math.max(0, oy), eB = Math.max(0, ph - (oy + IH * s)), eR = Math.max(0, pw - (ox + IW * s));
    plate.style.setProperty('--edge-t', eT ? Math.ceil(eT) + 'px' : '0px'); plate.style.setProperty('--edge-t2', eT ? Math.ceil(eT + 140) + 'px' : '0px');
    plate.style.setProperty('--edge-b', eB ? Math.ceil(eB) + 'px' : '0px'); plate.style.setProperty('--edge-b2', eB ? Math.ceil(eB + 140) + 'px' : '0px');
    plate.style.setProperty('--edge-r', eR ? Math.ceil(eR) + 'px' : '0px'); plate.style.setProperty('--edge-r2', eR ? Math.ceil(eR + 160) + 'px' : '0px');
    plate.classList.add('is-laid');
    layoutPanes();
    layoutFx();
    if (!running && bootAt >= 0) renderStatic();
  }
  function toPlate(p) { return [L.ox + p[0] * L.s, L.oy + p[1] * L.s]; }

  /* =====================================================================
     Ecranele holografice (canvas 2D, text crocant, fixate pe sticla din imagine)
     ===================================================================== */
  var FT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  var FB = 'Inter, "Segoe UI", Arial, sans-serif';
  var C = { teal: '#19cbd3', aqua: '#8ff7f7', amber: '#ffb454', green: '#3fd68c', ink: '#eaf6fa', ink2: '#b6ccd6', muted: '#7d96a6' };
  var SCREENS = [
    { key: 'main', dw: 1000, dh: 800, q: PANES.main },
    { key: 'mid', dw: 580, dh: 650, q: PANES.mid },
    { key: 'small', dw: 300, dh: 500, q: PANES.small }
  ];
  SCREENS.forEach(function (sc) {
    sc.el = plate.querySelector('.holo-' + sc.key);
    sc.ctx = sc.el ? sc.el.getContext('2d') : null;
    sc.on = 0;
  });
  function layoutPanes() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    SCREENS.forEach(function (sc) {
      if (!sc.el) return;
      var q = sc.q.map(toPlate);
      var w = Math.max(40, (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2), h = Math.max(40, (q[3][1] - q[0][1] + q[2][1] - q[1][1]) / 2);
      var over = dpr >= 2 ? 1 : 1.25, bw = Math.round(w * dpr * over), bh = Math.round(h * dpr * over);
      if (sc.el.width !== bw || sc.el.height !== bh) { sc.el.width = bw; sc.el.height = bh; }
      sc.el.style.width = w + 'px'; sc.el.style.height = h + 'px';
      sc.baseQ = q; sc.w = w; sc.h = h; sc.baseM = matrix3d(w, h, q); sc.chrome = null;
      sc.compact = w < 250;
      placeScreen(sc, 0, 0);
    });
  }
  function placeScreen(sc, dx, dy) {
    if (!sc.baseM) return;
    sc.el.style.transform = (dx || dy ? 'translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0) ' : '') + sc.baseM;
  }

  /* ---------- starea „SOC”: numărătoare, flux de amenințări, grafic ---------- */
  var THREATS = ['Brute force SSH', 'Scanare porturi', 'Link de phishing', 'SQL injection', 'Atașament malware', 'Login suspect', 'DDoS L7'];
  var TARGETS = ['fw-edge-01', 'portal.mdy', 'mail-gw', 'srv-erp-01', 'vpn-gw', 'srv-app-02'];
  var soc = { blocked: 12480, shown: 0, flash: 0, feed: [], spark: [], seq: 7 };
  for (var si = 0; si < 24; si++) soc.spark.push(0.35 + 0.5 * rnd(si * 3.1));
  function clockStr(offsetSec) {
    var d = new Date(Date.now() - offsetSec * 1000);
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }
  for (var fi = 0; fi < 3; fi++) soc.feed.push({ time: clockStr(40 + fi * 95), type: THREATS[(fi * 3) % 7], target: TARGETS[fi % 6], age: 9 });
  function socBlocked() {
    soc.seq++;
    soc.blocked++;
    soc.flash = 1;
    soc.spark[soc.spark.length - 1] = Math.min(1, soc.spark[soc.spark.length - 1] + 0.08);
    soc.feed.unshift({ time: clockStr(0), type: THREATS[Math.floor(rnd(soc.seq * 1.7) * 7)], target: TARGETS[Math.floor(rnd(soc.seq * 2.3) * 6)], age: 0 });
    if (soc.feed.length > 4) soc.feed.length = 4;
  }

  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function txt(g, s, x, y, col, w, size, fam, align, spacing) {
    g.font = w + ' ' + size + 'px ' + (fam || FB); g.fillStyle = col; g.textAlign = align || 'left';
    if ('letterSpacing' in g) g.letterSpacing = (spacing || 0) + 'px';
    g.fillText(s, x, y);
    var m = g.measureText(s).width;
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return m;
  }
  /* sticla: fum închis, reflex fin, linii de scanare, margine luminoasă */
  /* sticla se desenează o singură dată pe layout și se refolosește la fiecare cadru */
  function glass(sc, g, dw, dh) {
    var W = sc.el.width, H = sc.el.height;
    if (!sc.chrome || sc.chrome.width !== W || sc.chrome.height !== H) {
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var cg = c.getContext('2d'); cg.setTransform(W / dw, 0, 0, H / dh, 0, 0);
      glassPaint(cg, dw, dh);
      sc.chrome = c;
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(sc.chrome, 0, 0);
    g.setTransform(W / dw, 0, 0, H / dh, 0, 0);
  }
  function glassPaint(g, dw, dh) {
    rr(g, 0, 0, dw, dh, Math.min(dw, dh) * 0.03);
    var bg = g.createLinearGradient(0, 0, dw, dh);
    bg.addColorStop(0, 'rgba(8, 34, 48, 0.80)'); bg.addColorStop(0.55, 'rgba(3, 14, 25, 0.84)'); bg.addColorStop(1, 'rgba(4, 20, 33, 0.80)');
    g.fillStyle = bg; g.fill();
    g.save(); g.clip();
    var sh = g.createLinearGradient(0, 0, dw * 0.7, dh);
    sh.addColorStop(0, 'rgba(143,247,247,0.10)'); sh.addColorStop(0.35, 'rgba(143,247,247,0.02)'); sh.addColorStop(0.36, 'rgba(143,247,247,0)');
    g.fillStyle = sh; g.fillRect(0, 0, dw, dh);
    g.fillStyle = 'rgba(143,247,247,0.035)';
    for (var y = 0; y < dh; y += 6) g.fillRect(0, y, dw, 1.5);
    g.restore();
    g.lineWidth = Math.max(2, dw * 0.003); g.strokeStyle = 'rgba(143,247,247,0.32)';
    rr(g, 1, 1, dw - 2, dh - 2, Math.min(dw, dh) * 0.03); g.stroke();
  }
  /* apariție: o linie de scanare coboară și „desenează” ecranul */
  function bootClip(g, dw, dh, on) {
    if (on >= 1) return;
    var y = dh * on;
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000'; g.fillRect(0, 0, dw, y);
    g.globalCompositeOperation = 'source-over';
    var gr = g.createLinearGradient(0, y - 40, 0, y);
    gr.addColorStop(0, 'rgba(143,247,247,0)'); gr.addColorStop(1, 'rgba(200,255,255,0.9)');
    g.fillStyle = gr; g.fillRect(0, y - 40, dw, 40);
  }

  function drawMain(sc, t, dt) {
    var g = sc.ctx, dw = sc.dw, dh = sc.dh;
    g.setTransform(sc.el.width / dw, 0, 0, sc.el.height / dh, 0, 0);
    glass(sc, g, dw, dh);
    soc.shown = soc.shown < 1 ? soc.blocked * ease(sc.on * 1.2) : lerp(soc.shown, soc.blocked, 1 - Math.exp(-dt * 6));
    if (sc.on >= 1 && soc.shown > soc.blocked - 0.5) soc.shown = soc.blocked;
    soc.flash = Math.max(0, soc.flash - dt * 1.6);
    var pulse = 0.5 + 0.5 * Math.sin(t * 3.2), numCol = soc.flash > 0.01 ? mix(C.amber, '#ffffff', Math.round((1 - soc.flash) * 8) / 8) : '#ffffff';
    g.fillStyle = 'rgba(143,247,247,' + (0.5 + 0.5 * pulse).toFixed(3) + ')'; g.beginPath(); g.arc(52, sc.compact ? 70 : 56, sc.compact ? 12 : 9, 0, 6.2832); g.fill();
    if (sc.compact) {
      txt(g, 'SOC · DEMO', 78, 84, C.aqua, 600, 46, FB, 'left', 5);
      txt(g, 'Amenințări blocate azi', 48, 250, C.ink2, 500, 60);
      glowTxt(sc, g, 'n', fmt(soc.shown), 44, 520, numCol, 700, 300, FT);
      pillTxt(g, 48, 640, 'PROTEJAT', C.teal, 64);
      bootClip(g, dw, dh, sc.on);
      return;
    }
    txt(g, 'MDY · SECURITY OPERATIONS', 74, 66, C.aqua, 600, 28, FB, 'left', 4);
    var lw = txt(g, 'DEMO LIVE', 952, 66, C.green, 700, 26, FB, 'right', 3);
    g.fillStyle = mix(C.green, C.green, 0, 0.55 + 0.45 * pulse); g.beginPath(); g.arc(952 - lw - 22, 56, 8, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(143,247,247,0.16)'; g.fillRect(48, 94, 904, 2);
    txt(g, 'Amenințări blocate azi', 48, 166, C.ink2, 500, 36);
    glowTxt(sc, g, 'n', fmt(soc.shown), 42, 350, numCol, 700, 210, FT);
    var pw = pillTxt(g, 48, 452, 'PROTEJAT', C.teal, 40);
    txt(g, 'Firewall · EDR · SOC 24/7', 48 + pw + 22, 440, C.muted, 500, 30);
    /* grafic: blocări pe ultimele 24 de ore */
    var bw = 904 / 24;
    for (var i = 0; i < 24; i++) {
      var v = soc.spark[i] * (0.85 + 0.15 * Math.sin(t * 1.4 + i)) * ease(sc.on * 1.5 - i * 0.02), h = 86 * v;
      rr(g, 48 + i * bw + 3, 606 - h, bw - 6, h, 3);
      g.fillStyle = i === 23 ? C.aqua : 'rgba(25,203,211,' + (0.28 + 0.4 * (i / 23)).toFixed(3) + ')'; g.fill();
    }
    /* fluxul de amenințări blocate */
    g.save(); g.beginPath(); g.rect(40, 626, 920, 170); g.clip();
    var shift = soc.feed.length && soc.feed[0].age < 1 ? (1 - ease(soc.feed[0].age / 0.5)) : 0;
    for (var r = 0; r < Math.min(3, soc.feed.length); r++) {
      var it = soc.feed[r], y = 668 + (r - shift) * 58;
      it.age += dt;
      if (it.age < 1.2) { g.fillStyle = mix(C.amber, C.teal, clamp(it.age / 1.2, 0, 1), 0.22 * (1 - it.age / 1.2)); g.fillRect(40, y - 36, 920, 54); }
      g.globalAlpha = r === 0 ? clamp(it.age / 0.35, 0, 1) : 1;
      txt(g, it.time, 48, y, C.muted, 500, 26);
      txt(g, it.type, 190, y, C.ink, 600, 30);
      txt(g, it.target, 560, y, C.muted, 500, 26);
      pillTxt(g, 952, y + 4, 'BLOCAT', it.age < 0.6 ? C.amber : C.teal, 24, true);
      g.globalAlpha = 1;
    }
    g.restore();
    bootClip(g, dw, dh, sc.on);
  }
  function drawMid(sc, t) {
    var g = sc.ctx, dw = sc.dw, dh = sc.dh;
    g.setTransform(sc.el.width / dw, 0, 0, sc.el.height / dh, 0, 0);
    glass(sc, g, dw, dh);
    txt(g, 'INFRASTRUCTURĂ', 44, 76, C.aqua, 600, 40, FB, 'left', 3);
    txt(g, 'Uptime 30 zile', 44, 160, C.ink2, 500, 42);
    glowTxt(sc, g, 'n', (99.98 * ease(sc.on * 1.3)).toFixed(2).replace('.', ',') + '%', 40, 330, '#ffffff', 700, 190, FT);
    var names = ['CPU', 'RAM', 'REȚEA'], base = [0.38, 0.61, 0.47], cols = [C.teal, '#5b8cff', C.aqua];
    for (var i = 0; i < 3; i++) {
      var y = 410 + i * 72, v = clamp(base[i] + 0.12 * Math.sin(t * (0.9 + i * 0.37) + i * 2) + 0.05 * Math.sin(t * 3.1 + i), 0.05, 0.98) * ease(sc.on * 1.4 - i * 0.1);
      txt(g, names[i], 44, y, C.muted, 600, 30, FB, 'left', 2);
      rr(g, 180, y - 22, 356, 18, 9); g.fillStyle = 'rgba(143,247,247,0.10)'; g.fill();
      rr(g, 180, y - 22, Math.max(18, 356 * v), 18, 9); g.fillStyle = cols[i]; g.fill();
    }
    g.fillStyle = C.green; g.beginPath(); g.arc(56, 612, 10, 0, 6.2832); g.fill();
    txt(g, '42/42 servere online', 80, 624, C.ink, 600, 38);
    bootClip(g, dw, dh, sc.on);
  }
  function drawSmall(sc, t) {
    var g = sc.ctx, dw = sc.dw, dh = sc.dh;
    g.setTransform(sc.el.width / dw, 0, 0, sc.el.height / dh, 0, 0);
    glass(sc, g, dw, dh);
    txt(g, 'ERP', 30, 70, C.aqua, 700, 46, FB, 'left', 4);
    glowTxt(sc, g, 'n', fmt((1284 + Math.floor(t / 6)) * ease(sc.on * 1.3)), 26, 206, '#ffffff', 700, 120, FT);
    txt(g, 'comenzi azi', 30, 256, C.ink2, 500, 36);
    for (var i = 0; i < 6; i++) {
      var h = 120 * (0.35 + 0.55 * rnd(i * 5.3)) * (0.88 + 0.12 * Math.sin(t * 1.2 + i)) * ease(sc.on * 1.4 - i * 0.06);
      rr(g, 30 + i * 42, 420 - h, 30, h, 4); g.fillStyle = i === 5 ? C.aqua : 'rgba(25,203,211,0.55)'; g.fill();
    }
    txt(g, '+12%', 30, 474, C.green, 700, 52, FT);
    bootClip(g, dw, dh, sc.on);
  }
  /* cifrele mari cu strălucire: randate o dată în cache, refolosite până se schimbă textul */
  function glowTxt(sc, g, slot, s, x, y, col, w, size, fam) {
    var kx = sc.el.width / sc.dw, ky = sc.el.height / sc.dh, key = s + '|' + col + '|' + size + '|' + kx.toFixed(3) + '|' + ky.toFixed(3);
    var cache = sc.glows || (sc.glows = {}), c = cache[slot], pad = 40;
    if (!c || c.key !== key) {
      measureCtx.font = w + ' ' + size + 'px ' + fam;
      var tw = measureCtx.measureText(s).width;
      c = c || document.createElement('canvas');
      c.width = Math.ceil((tw + pad * 2) * kx); c.height = Math.ceil((size * 1.3 + pad * 2) * ky); c.key = key;
      var cg = c.getContext('2d'); cg.setTransform(kx, 0, 0, ky, 0, 0);
      cg.font = measureCtx.font; cg.textAlign = 'left'; cg.fillStyle = col;
      cg.shadowColor = 'rgba(25,203,211,0.75)'; cg.shadowBlur = 26 * kx; cg.fillText(s, pad, pad + size);
      cg.shadowBlur = 0; cg.fillText(s, pad, pad + size);
      cache[slot] = c;
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(c, Math.round((x - pad) * kx), Math.round((y - size - pad) * ky));
    g.restore();
  }
  function pillTxt(g, x, y, label, col, size, alignRight) {
    g.font = '700 ' + size + 'px ' + FT;
    if ('letterSpacing' in g) g.letterSpacing = (size * 0.08) + 'px';
    var w = g.measureText(label).width + size * 1.1, h = size * 1.45;
    if (alignRight) x -= w;
    rr(g, x, y - h * 0.78, w, h, h / 2); g.fillStyle = mix(col, col, 0, 0.18); g.fill();
    g.lineWidth = 2; g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.textAlign = 'left'; g.fillText(label, x + size * 0.55, y);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    return w;
  }
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t, alpha) {
    var A = hexRgb(a), B = hexRgb(b);
    return 'rgba(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ',' + (alpha === undefined ? 1 : alpha) + ')';
  }

  /* =====================================================================
     Stratul de efecte (WebGL brut): filamentele câmpului, inelul, atacuri și unde de impact
     Lucrează în coordonatele imaginii, deci rămâne lipit de fotografie la orice mărime.
     ===================================================================== */
  var FX_REGION = { x0: 980, y0: 0, x1: IW, y1: IH };
  var gl = null, fxProg = null, fxU = {}, fxOk = false;
  var MAXP = 4, packets = [], ripples = [], ringPulse = 0;
  var FX_FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes; uniform vec4 uReg; uniform float uTime, uOn, uPulse;',
    'uniform vec4 uPk[4]; uniform vec4 uRp[4];',
    'const vec3 TEAL = vec3(0.098, 0.796, 0.827); const vec3 AQUA = vec3(0.56, 0.97, 0.97); const vec3 AMBER = vec3(1.0, 0.706, 0.33);',
    'float hash(float n){ return fract(sin(mod(n, 997.0) * 12.9898) * 43758.5453); }',
    'void main(){',
    '  vec2 f = gl_FragCoord.xy / uRes;',
    '  vec2 p = vec2(mix(uReg.x, uReg.z, f.x), mix(uReg.w, uReg.y, f.y));',   /* pixeli în imagine, y în jos */
    '  vec3 col = vec3(0.0); float a = 0.0;',
    '  float fx = (p.x - 1890.0) / 540.0;',
    '  if (abs(fx) < 1.02 && p.y < 1296.0) {',
    '    float edge = smoothstep(0.55, 1.0, abs(fx)) * (1.0 - smoothstep(1.0, 1.02, abs(fx)));',
    '    float colId = floor(p.x / 6.0); float h = hash(colId);',
    '    float streak = fract(p.y / (160.0 + 260.0 * h) + uTime * (0.25 + 0.55 * h) + h * 7.0);',
    '    float dash = smoothstep(0.0, 0.08, streak) * (1.0 - smoothstep(0.08, 0.35, streak)) * step(0.62, hash(colId + 3.1));',
    '    float fade = (1.0 - smoothstep(1100.0, 1296.0, p.y)) * 0.55 + 0.45 * smoothstep(0.0, 400.0, p.y);',
    '    float k = (0.02 + 0.22 * edge) * dash * fade * uOn;',
    '    col += AQUA * k; a += k;',
    '  }',
    '  vec2 e = vec2((p.x - 1890.0) / 548.0, (p.y - 1296.0) / 48.0);',
    '  float d = length(e);',
    '  float rd0 = (d - 1.0) * 26.0; float ring = exp(-rd0 * rd0);',
    '  float ang = atan(e.y, e.x);',
    '  float travel = pow(0.5 + 0.5 * cos(ang - uTime * 1.3), 18.0) + pow(0.5 + 0.5 * cos(ang + uTime * 0.7 + 2.0), 30.0);',
    '  float rk = ring * (0.10 * travel + 0.75 * uPulse) * uOn;',
    '  col += mix(AQUA, vec3(1.0), 0.3) * rk; a += rk;',
    '  float wv = (d - 1.0 - (1.0 - uPulse) * 0.35) * 9.0; float wave = exp(-wv * wv) * uPulse * step(0.0, e.y + 0.2);',
    '  col += TEAL * wave * 0.45; a += wave * 0.45;',
    '  for (int i = 0; i < 4; i++) {',
    '    vec4 k = uPk[i]; if (k.z <= 0.0) continue;',
    '    vec2 dir = vec2(cos(k.w), sin(k.w));',
    '    vec2 rel = p - k.xy; float along = dot(rel, dir); float perp = length(rel - dir * along);',
    '    float head = exp(-dot(rel, rel) / 90.0);',
    '    float trail = step(along, 0.0) * exp(along / 140.0) * exp(-perp * perp / 18.0);',
    '    float halo = exp(-dot(rel, rel) / 1400.0) * 0.35;',
    '    float pk = (head * 1.6 + trail * 0.9 + halo) * k.z;',
    '    col += mix(AMBER, vec3(1.0, 0.92, 0.75), head) * pk; a += pk;',
    '  }',
    '  for (int i = 0; i < 4; i++) {',
    '    vec4 r = uRp[i]; if (r.w <= 0.0) continue;',
    '    float age = r.z;',
    '    vec2 q = vec2((p.x - r.x) / (26.0 + 70.0 * age), (p.y - r.y) / (70.0 + 420.0 * age));',
    '    float rd = length(q);',
    '    float bb = (rd - 1.0) * 5.0; float band = exp(-bb * bb) * (1.0 - smoothstep(0.96, 1.02, abs(fx)));',
    '    float hex = 0.6 + 0.4 * sin(p.y * 0.22) * sin(p.x * 0.19 + p.y * 0.11);',
    '    float flash = exp(-rd * rd * 3.0) * pow(1.0 - age, 6.0);',
    '    float rk2 = (band * hex * pow(1.0 - age, 1.6) + flash) * r.w;',
    '    col += mix(AMBER, AQUA, smoothstep(0.0, 0.35, age)) * rk2; a += rk2;',
    '  }',
    '  a = clamp(a, 0.0, 1.0);',
    '  gl_FragColor = vec4(min(col, vec3(1.0)), a);',
    '}'
  ].join('\n');
  function initFx() {
    if (!fxCanvas) return;
    try { gl = fxCanvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }'), fs = sh(gl.FRAGMENT_SHADER, FX_FS);
    if (!vs || !fs) { gl = null; return; }
    fxProg = gl.createProgram(); gl.attachShader(fxProg, vs); gl.attachShader(fxProg, fs); gl.linkProgram(fxProg);
    if (!gl.getProgramParameter(fxProg, gl.LINK_STATUS)) { gl = null; return; }
    gl.useProgram(fxProg);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(fxProg, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uReg', 'uTime', 'uOn', 'uPulse', 'uPk', 'uRp'].forEach(function (n) { fxU[n] = gl.getUniformLocation(fxProg, n); });
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    fxOk = true;
  }
  function layoutFx() {
    if (!fxCanvas) return;
    var a = toPlate([FX_REGION.x0, FX_REGION.y0]), b = toPlate([FX_REGION.x1, FX_REGION.y1]);
    var l = Math.max(0, a[0]), t = Math.max(0, a[1]), r = Math.min(L.pw, b[0]), btm = Math.min(L.ph, b[1]);
    var w = Math.max(1, r - l), h = Math.max(1, btm - t);
    var pr = Math.min(window.devicePixelRatio || 1, 1.25);
    fxCanvas.style.cssText = 'left:' + l + 'px;top:' + t + 'px;width:' + w + 'px;height:' + h + 'px';
    var fw = Math.round(w * pr), fh = Math.round(h * pr);
    if (fxCanvas.width !== fw || fxCanvas.height !== fh) { fxCanvas.width = fw; fxCanvas.height = fh; }
    L.fxReg = [(l - L.ox) / L.s, (t - L.oy) / L.s, (r - L.ox) / L.s, (btm - L.oy) / L.s];
    if (gl) gl.viewport(0, 0, fxCanvas.width, fxCanvas.height);
  }

  /* ---------- atacuri: vin din întuneric, lovesc câmpul, sunt blocate ---------- */
  function launchAttack(lane) {
    if (packets.length >= MAXP) return;
    if (!lane) lane = Math.random() < 0.5 ? 'up' : 'low';
    var from, to;
    if (lane === 'up') { from = [1060 + Math.random() * 80, 20 + Math.random() * 120]; to = [1356, 250 + Math.random() * 120]; }
    else { from = [1180 + Math.random() * 60, 1240 + Math.random() * 150]; to = [1352, 950 + Math.random() * 250]; }
    var ctrl = [(from[0] + to[0]) / 2 + 40, (from[1] + to[1]) / 2 + (lane === 'up' ? -70 : 70)];
    packets.push({ from: from, to: to, ctrl: ctrl, t: 0, dur: 0.95 + Math.random() * 0.4 });
  }
  var pkBuf = new Float32Array(16), rpBuf = new Float32Array(16);
  function stepAttacks(dt) {
    pkBuf.fill(0); rpBuf.fill(0);
    for (var i = packets.length - 1; i >= 0; i--) {
      var k = packets[i]; k.t += dt / k.dur;
      if (k.t >= 1) {
        ripples.push({ x: k.to[0], y: k.to[1], age: 0 });
        if (ripples.length > 4) ripples.shift();
        ringPulse = 1; socBlocked();
        packets.splice(i, 1); continue;
      }
      var u = k.t * k.t * (1.6 - 0.6 * k.t), v = 1 - u;
      var x = v * v * k.from[0] + 2 * v * u * k.ctrl[0] + u * u * k.to[0];
      var y = v * v * k.from[1] + 2 * v * u * k.ctrl[1] + u * u * k.to[1];
      var dx = 2 * v * (k.ctrl[0] - k.from[0]) + 2 * u * (k.to[0] - k.ctrl[0]), dy = 2 * v * (k.ctrl[1] - k.from[1]) + 2 * u * (k.to[1] - k.ctrl[1]);
      k.x = x; k.y = y; k.ang = Math.atan2(dy, dx);
    }
    for (i = 0; i < packets.length && i < 4; i++) { pkBuf[i * 4] = packets[i].x; pkBuf[i * 4 + 1] = packets[i].y; pkBuf[i * 4 + 2] = Math.min(1, packets[i].t * 5); pkBuf[i * 4 + 3] = packets[i].ang; }
    for (i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt / 1.15; if (ripples[i].age >= 1) ripples.splice(i, 1); }
    for (i = 0; i < ripples.length; i++) { rpBuf[i * 4] = ripples[i].x; rpBuf[i * 4 + 1] = ripples[i].y; rpBuf[i * 4 + 2] = ripples[i].age; rpBuf[i * 4 + 3] = 1; }
    ringPulse = Math.max(0, ringPulse - dt * 1.4);
  }
  function drawFx(t, on) {
    if (!fxOk || !L.fxReg) return;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(fxU.uRes, fxCanvas.width, fxCanvas.height);
    gl.uniform4f(fxU.uReg, L.fxReg[0], L.fxReg[1], L.fxReg[2], L.fxReg[3]);
    gl.uniform1f(fxU.uTime, t); gl.uniform1f(fxU.uOn, on); gl.uniform1f(fxU.uPulse, ringPulse);
    gl.uniform4fv(fxU.uPk, pkBuf); gl.uniform4fv(fxU.uRp, rpBuf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- video: aceeași scenă, cu fluxuri de date și ceață (buclă perfectă, cameră fixă) ---------- */
  var videoWanted = false, imgHideT = 0;
  function initVideo() {
    if (!video || reduceMotion || saveData) return;
    videoWanted = true;
    video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', '');
    video.addEventListener('playing', function () { plate.classList.add('video-on'); clearTimeout(imgHideT); imgHideT = setTimeout(function () { plate.classList.add('video-ready'); }, 1700); });
    video.addEventListener('error', function () { clearTimeout(imgHideT); plate.classList.remove('video-on', 'video-ready'); videoWanted = false; });
    video.src = window.innerWidth > 900 ? 'assets/hero/plate-loop-1920.mp4' : 'assets/hero/plate-loop-1280.mp4';
    syncVideo();
  }
  function syncVideo() {
    if (!videoWanted || !video.src) return;
    if (heroVisible && !document.hidden && !reduceMotion && !userPaused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    else if (!video.paused) video.pause();
  }

  /* ---------- câmpul de particule al paginii (#scene, în spatele conținutului) ---------- */
  var pg = null, pgU = {}, pgN = 0, sceneCanvas = document.getElementById('scene');
  function initParticles() {
    if (!sceneCanvas) return;
    try { pg = sceneCanvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { pg = null; }
    if (!pg) return;
    var VS = 'attribute vec3 aP; attribute float aS; attribute float aPh; uniform float uT, uScroll, uAsp, uPR; varying float vA;' +
      'void main(){ vec3 p = aP; p.x += cos(uT * 0.12 + aPh * 1.7) * 0.25; p.y += sin(uT * 0.16 + aPh) * 0.25 + uScroll; p.y = mod(p.y + 9.0, 18.0) - 9.0;' +
      ' float z = p.z - 9.0; float f = 2.904; gl_Position = vec4(p.x * f / uAsp, p.y * f, 0.0, -z);' +
      ' gl_PointSize = aS * uPR * (34.0 / -z); vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uT * 0.9 + aPh * 6.0)); }';
    var FS = 'precision mediump float; uniform float uO; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); a *= a; float k = a * vA * 0.5 * uO; gl_FragColor = vec4(vec3(0.56, 0.97, 0.97) * k, k); }';
    function sh(type, src) { var s = pg.createShader(type); pg.shaderSource(s, src); pg.compileShader(s); return pg.getShaderParameter(s, pg.COMPILE_STATUS) ? s : null; }
    var vs = sh(pg.VERTEX_SHADER, VS), fs = sh(pg.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { pg = null; return; }
    var prog = pg.createProgram(); pg.attachShader(prog, vs); pg.attachShader(prog, fs); pg.linkProgram(prog);
    if (!pg.getProgramParameter(prog, pg.LINK_STATUS)) { pg = null; return; }
    pg.useProgram(prog);
    pgN = coarse ? 650 : 1300;
    var data = new Float32Array(pgN * 5);
    for (var i = 0; i < pgN; i++) {
      data[i * 5] = (Math.random() - 0.5) * 30; data[i * 5 + 1] = (Math.random() - 0.5) * 18; data[i * 5 + 2] = -14 + Math.random() * 16;
      data[i * 5 + 3] = 0.6 + Math.pow(Math.random(), 3) * 3.2; data[i * 5 + 4] = Math.random() * 6.283;
    }
    var buf = pg.createBuffer(); pg.bindBuffer(pg.ARRAY_BUFFER, buf); pg.bufferData(pg.ARRAY_BUFFER, data, pg.STATIC_DRAW);
    [['aP', 3, 0], ['aS', 1, 12], ['aPh', 1, 16]].forEach(function (a) { var l = pg.getAttribLocation(prog, a[0]); pg.enableVertexAttribArray(l); pg.vertexAttribPointer(l, a[1], pg.FLOAT, false, 20, a[2]); });
    ['uT', 'uScroll', 'uAsp', 'uPR', 'uO'].forEach(function (n) { pgU[n] = pg.getUniformLocation(prog, n); });
    pg.enable(pg.BLEND); pg.blendFunc(pg.ONE, pg.ONE_MINUS_SRC_ALPHA);
    sizeParticles();
  }
  function sizeParticles() {
    if (!pg) return;
    var pr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.25);
    var cw = Math.round(window.innerWidth * pr), ch = Math.round(window.innerHeight * pr);
    if (cw !== sceneCanvas.width || Math.abs(ch - sceneCanvas.height) > 120 * pr) { sceneCanvas.width = cw; sceneCanvas.height = ch; }
    pg.viewport(0, 0, sceneCanvas.width, sceneCanvas.height);
    pg.uniform1f(pgU.uAsp, window.innerWidth / window.innerHeight); pg.uniform1f(pgU.uPR, pr);
  }
  function drawParticles(t, fade) {
    if (!pg) return;
    pg.clearColor(0, 0, 0, 0); pg.clear(pg.COLOR_BUFFER_BIT);
    pg.uniform1f(pgU.uT, t); pg.uniform1f(pgU.uScroll, (window.scrollY || 0) * 0.0022); pg.uniform1f(pgU.uO, fade);
    pg.drawArrays(pg.POINTS, 0, pgN);
  }

  /* =====================================================================
     Buclă, interacțiune, ciclu de viață
     ===================================================================== */
  var heroVisible = true, running = false, rafId = 0, last = 0, t0 = performance.now(), bootAt = -1;
  var mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 }, nextAttack = 3.2, holoAcc = 1, lastPar = '';
  var pageFade = reduceMotion ? 1 : 0, partAcc = 1, fxAcc = 1, MIN_GAP = 1000 / 62;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX / window.innerWidth * 2 - 1; mouse.y = e.clientY / window.innerHeight * 2 - 1;
  }, { passive: true });

  function frame(now) {
    if (running && last && now - last < MIN_GAP) { rafId = requestAnimationFrame(frame); return; }
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    var t = (now - t0) / 1000;
    if (pageFade < 1) pageFade = Math.min(1, pageFade + dt * 0.7);
    partAcc += dt;
    if (partAcc >= 1 / 30 || !running) { partAcc = 0; drawParticles(t, pageFade); }
    if (heroVisible) {
      var bt = bootAt < 0 ? 0 : t - bootAt;
      var sp = clamp(((window.scrollY || 0) - (L.heroTop || 0)) / Math.max(1, L.heroH || 1), 0, 1);
      var k = 1 - Math.exp(-dt * 3.2);
      smooth.x += (mouse.x - smooth.x) * k; smooth.y += (mouse.y - smooth.y) * k;
      var px = L.compact ? 0 : -smooth.x * 12, py = (L.compact ? 0 : -smooth.y * 8) + sp * 70;
      var par = px.toFixed(2) + ',' + py.toFixed(2) + ',' + sp.toFixed(3);
      if (par !== lastPar) {
        lastPar = par;
        world.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0) scale(' + (1 + sp * 0.04).toFixed(4) + ')';
        var hx = L.compact ? 0 : -smooth.x * 3, hy = L.compact ? 0 : -smooth.y * 2;
        SCREENS.forEach(function (sc) { placeScreen(sc, hx, hy); });
      }
      if (bootAt >= 0 && !reduceMotion) {
        if (bt > nextAttack) { launchAttack(); nextAttack = bt + 2.8 + Math.random() * 2.6; }
        stepAttacks(dt);
      }
      /* ecranele: 30 fps sunt suficiente pentru text și cifre */
      holoAcc += dt;
      if (holoAcc >= 1 / 30 && bootAt >= 0) {
        var hdt = holoAcc; holoAcc = 0;
        SCREENS.forEach(function (sc, i) {
          if (!sc.ctx) return;
          sc.on = reduceMotion ? 1 : clamp((bt - 0.45 - i * 0.35) / 0.9, 0, 1);
          if (sc.on <= 0) { sc.ctx.setTransform(1, 0, 0, 1, 0, 0); sc.ctx.clearRect(0, 0, sc.el.width, sc.el.height); return; }
          if (i === 0) drawMain(sc, bt, hdt); else if (i === 1) drawMid(sc, bt); else drawSmall(sc, bt);
        });
      }
      fxAcc += dt;
      if (!coarse || fxAcc >= 1 / 30 || !running) { fxAcc = 0; drawFx(t, (reduceMotion ? 1 : ease((bt - 0.2) / 1.6)) * (1 - sp * 0.9)); }
    }
    if (running) rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running || document.hidden) return;
    running = true; last = 0; rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function sync() {
    syncVideo();
    if (reduceMotion || userPaused) { stop(); renderStatic(); return; }
    if (document.hidden) stop(); else start();
  }
  function renderStatic() {
    var now = performance.now();
    if (reduceMotion) { packets.length = 0; ripples.length = 0; pkBuf.fill(0); rpBuf.fill(0); ringPulse = 0; }
    last = now; SCREENS.forEach(function (sc) { sc.on = 1; });
    holoAcc = 1; frame(now);
  }

  /* click în scenă = un atac lansat de vizitator, blocat în timp real */
  function setInteractive() { plate.classList.toggle('is-interactive', !reduceMotion && !userPaused); if (attackBtn) attackBtn.hidden = reduceMotion || userPaused; }
  var attackBtn = hero.querySelector('[data-hero="attack"]'), pauseBtn = hero.querySelector('[data-hero="pause"]');
  function setPaused(v) {
    userPaused = v;
    try { localStorage.setItem('mdy-hero-paused', v ? '1' : '0'); } catch (e) { /* stocare indisponibilă */ }
    if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); pauseBtn.textContent = v ? 'Pornește animația' : 'Pauză animație'; }
    setInteractive(); sync();
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });
  if (attackBtn) attackBtn.addEventListener('click', function () { if (bootAt >= 0 && !reduceMotion && !userPaused) launchAttack(); });
  plate.addEventListener('click', function (e) {
    if (reduceMotion || userPaused || bootAt < 0) return;
    var pr = plate.getBoundingClientRect(), iy = (e.clientY - pr.top - L.oy) / L.s;
    launchAttack(iy < 700 ? 'up' : 'low');
  });
  plate.addEventListener('pointerenter', function () { var c = window.mdy && window.mdy.cursor; if (c && !reduceMotion) if (!userPaused) c.set('Testează firewall-ul'); });
  plate.addEventListener('pointerleave', function () { var c = window.mdy && window.mdy.cursor; if (c) c.clear(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; syncVideo(); if ((reduceMotion || userPaused) && heroVisible) renderStatic(); }, { rootMargin: '80px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', sync);
  var rsT = 0;
  window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(function () { layout(); sizeParticles(); if (reduceMotion) renderStatic(); }, 80); });
  var mq = matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', function (e) { reduceMotion = e.matches; if (!reduceMotion && !videoWanted) initVideo(); setInteractive(); sync(); });

  /* ---------- pornire ---------- */
  initParticles();
  initFx();
  /* context WebGL pierdut (driver resetat, tab în fundal pe mobil): se reface la restaurare */
  if (fxCanvas) {
    fxCanvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fxOk = false; });
    fxCanvas.addEventListener('webglcontextrestored', function () { initFx(); layoutFx(); if (!running) renderStatic(); });
  }
  if (sceneCanvas) {
    sceneCanvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); pg = null; });
    sceneCanvas.addEventListener('webglcontextrestored', function () { initParticles(); if (!running) renderStatic(); });
  }
  if ('ResizeObserver' in window) {
    var roT = 0, ro = new ResizeObserver(function () { clearTimeout(roT); roT = setTimeout(layout, 60); });
    ro.observe(plate); if (copy) ro.observe(copy);
  }
  if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false'); pauseBtn.textContent = userPaused ? 'Pornește animația' : 'Pauză animație'; }
  setInteractive();
  if (pg || fxOk) { root.classList.remove('no-webgl'); root.classList.add('has-webgl'); }
  else root.classList.add('no-webgl');
  layout();
  if (img && !img.complete) img.addEventListener('load', layout, { once: true });
  function boot() {
    if (bootAt >= 0) return;
    bootAt = (performance.now() - t0) / 1000;
    if (reduceMotion || userPaused) renderStatic();
  }
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 60px "Barlow Condensed"'), document.fonts.load('600 20px Inter'), document.fonts.load('500 20px Inter')]).then(boot, boot);
  }
  setTimeout(boot, 1800);
  if (document.readyState === 'complete') setTimeout(initVideo, 900);
  else window.addEventListener('load', function () { setTimeout(initVideo, 900); }, { once: true });
  sync();

  window.mdyHero = {
    attack: launchAttack, layout: layout, stop: stop, start: start,
    render: function () { frame(performance.now()); },
    info: function () { return { s: L.s, ox: L.ox, oy: L.oy, pw: L.pw, ph: L.ph, compact: L.compact, fx: fxOk, particles: !!pg, video: videoWanted && !video.paused, blocked: soc.blocked, screens: SCREENS.map(function (sc) { return [sc.key, Math.round(sc.w), Math.round(sc.h), sc.on]; }) }; }
  };
})();
