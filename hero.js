/* MDY Solutions — hero „Sentinel” v2: server modern într-un câmp de protecție, cu ecrane holografice live.
   Placa foto (Higgsfield) e randată în WebGL cu o hartă de adâncime: mouse-ul și o derivă lentă a
   camerei dau paralaxă reală între server, fundal și ecrane. Peste ea, în același shader: filamentele
   câmpului, pulsul inelului, atacuri blocate la contact, granulație fină. Video-ul (buclă, cameră fixă)
   înlocuiește fotografia când e gata. Ecranele: canvas 2D mapat exact pe sticla din imagine (matrix3d).
   Fără WebGL: rămân fotografia și ecranele. Cu reduced-motion: cadru static. */
(function () {
  'use strict';
  var root = document.documentElement;
  var hero = document.getElementById('hero');
  var plate = hero && hero.querySelector('.hero-plate');
  if (!hero || !plate) return;
  var sceneA = plate.querySelector('.hero-scene--gl') || plate;
  var world = sceneA.querySelector('.hero-world');
  var img = sceneA.querySelector('.hero-plate-img');
  var video = sceneA.querySelector('.hero-plate-video');
  var glCanvas = sceneA.querySelector('.hero-gl');
  var copy = hero.querySelector('.hero-copy');

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

  /* ---------- geometria plăcii (pixeli în imaginea sursă, măsurați pe fișier) ---------- */
  var PLATE = window.MDY_PLATE || {
    w: 2752, h: 1536,
    src: 'assets/hero/plate-2752.webp', srcSmall: 'assets/hero/plate-1600.webp', depth: 'assets/hero/plate-depth.webp', focus: 0.3815,
    video: { w: 'assets/hero/plate-loop-1920.mp4', n: 'assets/hero/plate-loop-1280.mp4', top: -6.2, height: 1535.8 },   /* potrivit pe muchiile sticlei din cadre */
    panes: {
      main: [[1098.4, 403.8], [1607.5, 351.7], [1608.3, 768.5], [1097.7, 772.9]],
      small: [[874.1, 812.4], [1159, 814.7], [1159, 1054.5], [878, 1038]]
    },
    anchor: [1700, 760],                     /* centrul de interes (originea zoom-ului lent) */
    cabinet: [1420, 200, 2000, 1240],        /* dreptunghiul serverului: x0, y0, x1, y1 */
    phoneCrop: [1040, 60, 2070, 1370],       /* ce se vede pe telefon: ecranul principal + serverul + inelul */
    subject: 0.66,                           /* înălțimea serverului ca fracțiune din hero (desktop) */
    field: { cx: 1700, hw: 230, top: 0, bottom: 1240 },          /* fasciculele de lumină de deasupra serverului */
    ring: { cx: 1720, cy: 1240, rx: 380, ry: 58 },               /* inelul de pe podea */
    lanes: { up: [[960, 60], [1470, 380]], low: [[1240, 1400], [1480, 1090]] },   /* traseele atacurilor */
    fx: { left: 1000 }                       /* efectele se calculează doar la dreapta de aici */
  };
  var IW = PLATE.w, IH = PLATE.h, PANES = PLATE.panes;
  var VIDEO_MAP = PLATE.video;

  /* ---------- celelalte scene: fotografie + buclă video, fără WebGL; textul din hero se schimbă odată cu ele ---------- */
  var SCENE_DEFS = [
    { key: 'comanda' },
    { key: 'erp',
      aria: 'Un ecran de sticlă deasupra unui pupitru, într-o sală de servere, cu un ERP demonstrativ: comenzi, facturare, stocuri și producție în timp real',
      copy: { eyebrow: 'ERP și soluții software', h1: ['Comenzi și stocuri.', 'Producție și facturi.', 'Toate într-un ERP.'],
        lead: 'Vânzări, stocuri, producție și facturare conectate într-un singur sistem, configurat pe procesele tale: fiecare comandă se urmărește de la ofertă la livrare, în timp real.' },
      plate: { w: 2752, h: 1536, src: 'assets/hero/erp-2752.webp', srcSmall: 'assets/hero/erp-1600.webp',
        video: { w: 'assets/hero/erp-loop-1920.mp4', n: 'assets/hero/erp-loop-1280.mp4', top: -6, height: 1547.4 },   /* bucla e 16:9, fotografia puțin mai lată */
        panes: { main: [[1471, 236], [2383, 132], [2387, 862], [1470, 850]] },   /* sticla ecranului, măsurată pe fișier */
        anchor: [1930, 560], cabinet: [1290, 130, 2500, 1460], phoneCrop: [1400, 90, 2460, 1240], subject: 0.78 } },
    { key: 'cloud',
      aria: 'Un server într-o sală de servere din care urcă fibre de lumină spre o rețea de noduri, ca un cloud privat',
      copy: { eyebrow: 'Infrastructură și cloud', h1: ['Servere stabile.', 'Cloud administrat.', 'Monitorizare 24/7.'],
        lead: 'Proiectăm, migrăm și administrăm servere, virtualizare, rețea și cloud hibrid, cu backup testat, monitorizare continuă și intervenție rapidă când apare o problemă.' },
      plate: { w: 2752, h: 1536, src: 'assets/hero/cloud-2752.webp', srcSmall: 'assets/hero/cloud-1600.webp',
        video: { w: 'assets/hero/cloud-loop-1920.mp4', n: 'assets/hero/cloud-loop-1280.mp4', top: -7, height: 1548 },
        lead: 1250, anchor: [1720, 640], cabinet: [1250, 55, 2520, 1260], phoneCrop: [1200, 30, 2560, 1290], subject: 0.76 } }
  ];

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

  /* ---------- layout: fotografia acoperă hero-ul; ecranul principal stă la dreapta textului ---------- */
  var L = { s: 0.5, ox: 0, oy: 0, pw: 1, ph: 1, compact: false };
  var COMPACT_MQ = matchMedia('(max-width: 639px), (max-width: 1180px) and (orientation: portrait)');
  var OVER = 1.025;                          /* rezervă pentru paralaxă, ca marginile să nu se vadă */
  function layout() {
    var pw = plate.clientWidth, ph = plate.clientHeight;
    if (!pw || !ph) return;
    fitCopy();
    var compact = COMPACT_MQ.matches, copyR = 0;
    if (!compact) copyR = copyTextRight() - plate.getBoundingClientRect().left;
    var F = fitPlate(PLATE, copyR, pw, ph, compact), s = F.s, ox = F.ox, oy = F.oy, leftL = F.leftL;
    L.s = s; L.ox = ox; L.oy = oy; L.pw = pw; L.ph = ph; L.compact = compact;
    var box = 'left:' + ox.toFixed(2) + 'px;top:' + oy.toFixed(2) + 'px;width:' + (IW * s).toFixed(2) + 'px;height:' + (IH * s).toFixed(2) + 'px';
    img.style.cssText = box;
    if (glCanvas) glCanvas.style.cssText = box;
    if (video) video.style.cssText = 'left:' + ox.toFixed(2) + 'px;top:' + (oy + VIDEO_MAP.top * s).toFixed(2) + 'px;width:' + (IW * s).toFixed(2) + 'px;height:' + (VIDEO_MAP.height * s).toFixed(2) + 'px';
    var wantSizes = Math.round(IW * s) + 'px';
    if (img.getAttribute('sizes') !== wantSizes) img.setAttribute('sizes', wantSizes);
    L.heroTop = hero.getBoundingClientRect().top + (window.scrollY || 0); L.heroH = hero.offsetHeight;
    var a = toPlate(PLATE.anchor);
    world.style.transformOrigin = a[0].toFixed(1) + 'px ' + a[1].toFixed(1) + 'px';
    L.textR = compact ? 0 : copyR;
    SC[0].vars = plateVars(F, PLATE, ph, compact);
    for (var sk = 1; sk < SC.length; sk++) layoutScene(SC[sk], copyR, pw, ph, compact);
    applyVars(SC[cur].vars);
    plate.classList.add('is-laid');
    layoutPanes();
    layoutGl();
    if (!running && bootAt >= 0) renderStatic();
  }
  function toPlate(p) { return [L.ox + p[0] * L.s, L.oy + p[1] * L.s]; }
  /* încadrarea unei plăci: subiectul ocupă „subject” din înălțime și începe la dreapta textului;
     pe telefon se vede cadrul „phoneCrop” */
  function fitPlate(P, copyR, pw, ph, compact) {
    var W = P.w, H = P.h, cab = P.cabinet, s, ox, oy;
    var mainL = P.panes ? P.panes.main[0][0] : P.lead;
    var leftL = P.panes && P.panes.small ? Math.min(mainL, P.panes.small[0][0]) : mainL;
    if (!compact) {
      s = Math.max(P.subject * ph / (cab[3] - cab[1]), 0.86 * ph / H, (pw * 0.5) / W);
      var paneL = Math.max(copyR + 28, pw * 0.4);
      ox = paneL - leftL * s;
      if (ox + cab[2] * s > pw - 16) ox = pw - 16 - cab[2] * s;          /* subiectul rămâne întreg în cadru */
      /* fotografia acoperă marginea dreaptă, cu rezervă pentru deriva camerei */
      if (ox + W * s < pw + 26) { s = Math.max(s, OVER * (pw + 26 - ox) / W); ox = Math.min(ox, paneL - leftL * s); }
      oy = H * s >= ph ? clamp(ph / 2 - P.anchor[1] * s, ph - H * s, 0) : (ph - H * s) / 2;
    } else {
      var pc = P.phoneCrop, sceneC = (pc[0] + pc[2]) / 2, sceneY = (pc[1] + pc[3]) / 2;
      if (pw < 600) {
        s = Math.min(pw / (pc[2] - pc[0]), ph / (pc[3] - pc[1]));
      } else {
        /* tabletă ținută vertical: scena aproape întreagă, subiectul la ~60% din înălțime */
        s = Math.max(0.9 * ph / H, pw / W, 0.6 * ph / (cab[3] - cab[1]));
        sceneC = (mainL + cab[2]) / 2 - 10; sceneY = P.anchor[1] - 40;
      }
      if (W * s < pw) s = OVER * pw / W;
      ox = clamp(pw / 2 - sceneC * s, pw - W * s, 0);
      oy = H * s >= ph ? clamp(ph / 2 - sceneY * s, ph - H * s, 0) : (ph - H * s) / 2;
    }
    return { s: s, ox: ox, oy: oy, leftL: leftL };
  }
  function plateVars(F, P, ph, compact) {
    return { t: Math.ceil(Math.max(0, F.oy)), b: Math.ceil(Math.max(0, ph - (F.oy + P.h * F.s))), l: Math.ceil(Math.max(0, F.ox)),
      shade: Math.round(compact ? 0 : Math.max((F.ox + F.leftL * F.s) - 24, L.textR + 26)) };
  }
  function applyVars(v) {
    if (!v) return;
    plate.style.setProperty('--edge-t', v.t + 'px'); plate.style.setProperty('--edge-t2', (v.t ? v.t + 120 : 0) + 'px');
    plate.style.setProperty('--edge-b', v.b + 'px'); plate.style.setProperty('--edge-b2', (v.b ? v.b + 120 : 0) + 'px');
    plate.style.setProperty('--edge-l', v.l + 'px'); plate.style.setProperty('--edge-l2', (v.l ? v.l + 160 : 0) + 'px');
    plate.style.setProperty('--shade-end', v.shade + 'px');
  }
  /* marginea dreaptă a textului din coloana de copy (nu a coloanei), ca ecranul să stea lângă text, nu departe */
  function copyTextRight() {
    if (!copy) return 0;
    var r = copy.getBoundingClientRect().left + 200, rg = document.createRange();
    copy.querySelectorAll('.h1-inner, .hero-lead, .hero-actions > *, .hero-meta li, .hero-eyebrow').forEach(function (el) {
      try { rg.selectNodeContents(el); var b = rg.getBoundingClientRect(); if (b.width > 0) r = Math.max(r, b.right); } catch (e) { r = Math.max(r, el.getBoundingClientRect().right); }
    });
    /* textele celorlalte scene pot fi mai late: scena rămâne la dreapta celui mai lat */
    if (copyMaxR) r = Math.max(r, copy.getBoundingClientRect().left + copyMaxR);
    return r;
  }
  /* =====================================================================
     Ecranele holografice (canvas 2D, text crocant, fixate pe sticla din imagine)
     ===================================================================== */
  var FT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  var FB = 'Inter, "Segoe UI", Arial, sans-serif';
  var C = { teal: '#19cbd3', aqua: '#8ff7f7', amber: '#ffb454', green: '#3fd68c', ink: '#eaf6fa', ink2: '#b6ccd6', muted: '#7d96a6' };
  var SCREENS = [
    { key: 'main', dw: 1000, dh: 820, q: PANES.main },
    { key: 'small', dw: 600, dh: 490, q: PANES.small }
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
      /* un ecran care ar cădea peste text (ecrane înguste) rămâne stins */
      sc.hidden = (!L.compact && L.textR && Math.min(q[0][0], q[3][0]) < L.textR + 8) || (L.compact && L.pw < 600 && sc.key !== 'main');
      sc.el.style.visibility = sc.hidden ? 'hidden' : '';
      sc.compact = w < 205; sc.medium = !sc.compact && w < 300;
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
      glassPaint(cg, dw, dh, sc.dense);
      sc.chrome = c;
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(sc.chrome, 0, 0);
    g.setTransform(W / dw, 0, 0, H / dh, 0, 0);
  }
  function glassPaint(g, dw, dh, dense) {
    rr(g, 0, 0, dw, dh, Math.min(dw, dh) * 0.03);
    var bg = g.createLinearGradient(0, 0, dw, dh);
    /* „dense”: sticlă mai opacă, pentru ecranul pus peste un dashboard deja desenat în fotografie */
    var ga = dense ? 0.12 : 0;
    bg.addColorStop(0, 'rgba(8, 34, 48, ' + (0.80 + ga) + ')'); bg.addColorStop(0.55, 'rgba(3, 14, 25, ' + (0.84 + ga) + ')'); bg.addColorStop(1, 'rgba(4, 20, 33, ' + (0.80 + ga) + ')');
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
    if (sc.medium) {
      /* ecran mediu (desktop la 1280–1600 px): mai puține rânduri, litere mai mari */
      txt(g, 'MDY · SECURITY OPERATIONS', 74, 68, C.aqua, 600, 34, FB, 'left', 4);
      var lw2 = txt(g, 'DEMO LIVE', 952, 68, C.green, 700, 30, FB, 'right', 3);
      g.fillStyle = mix(C.green, C.green, 0, 0.55 + 0.45 * pulse); g.beginPath(); g.arc(952 - lw2 - 24, 58, 9, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(143,247,247,0.16)'; g.fillRect(48, 98, 904, 2);
      txt(g, 'Amenințări blocate azi', 48, 178, C.ink2, 500, 44);
      glowTxt(sc, g, 'n', fmt(soc.shown), 42, 390, numCol, 700, 240, FT);
      var pw2 = pillTxt(g, 48, 492, 'PROTEJAT', C.teal, 48);
      txt(g, 'SOC 24/7', 48 + pw2 + 24, 480, C.muted, 500, 36);
      txt(g, 'Trafic blocat · 60 s', 48, 566, C.muted, 500, 30);
      liveLine(g, 48, 578, 904, 80, t, 2.7, C.teal, sc.on);
      g.save(); g.beginPath(); g.rect(40, 676, 920, 144); g.clip();
      var sh2 = soc.feed.length && soc.feed[0].age < 1 ? (1 - ease(soc.feed[0].age / 0.5)) : 0;
      for (var r2 = 0; r2 < Math.min(2, soc.feed.length); r2++) {
        var it2 = soc.feed[r2], y2 = 724 + (r2 - sh2) * 66;
        it2.age += dt;
        if (it2.age < 1.2) { g.fillStyle = mix(C.amber, C.teal, clamp(it2.age / 1.2, 0, 1), 0.22 * (1 - it2.age / 1.2)); g.fillRect(40, y2 - 42, 920, 62); }
        g.globalAlpha = r2 === 0 ? clamp(it2.age / 0.35, 0, 1) : 1;
        txt(g, it2.time, 48, y2, C.muted, 500, 30);
        txt(g, it2.type, 220, y2, C.ink, 600, 36);
        pillTxt(g, 952, y2 + 4, 'BLOCAT', it2.age < 0.6 ? C.amber : C.teal, 28, true);
        g.globalAlpha = 1;
      }
      g.restore();
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
    /* rând de indicatori: trafic blocat (grafic viu) + ERP */
    g.fillStyle = 'rgba(143,247,247,0.10)'; g.fillRect(48, 494, 904, 1);
    txt(g, 'Trafic blocat · 60 s', 48, 534, C.muted, 500, 24);
    liveLine(g, 48, 546, 470, 62, t, 2.7, C.teal, sc.on);
    txt(g, 'ERP · comenzi azi', 560, 534, C.muted, 500, 24);
    txt(g, fmt((1284 + Math.floor(t / 6)) * ease(sc.on * 1.3)), 560, 598, C.ink, 700, 60, FT);
    txt(g, '+12%', 560 + measure(g, fmt(1284 + Math.floor(t / 6)), 700, 60, FT) + 16, 596, C.green, 700, 30, FT);
    g.fillStyle = 'rgba(143,247,247,0.10)'; g.fillRect(48, 622, 904, 1);
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
    txt(g, 'INFRASTRUCTURĂ', 36, 66, C.aqua, 600, 30, FB, 'left', 3);
    txt(g, 'Uptime 30 zile', 36, 130, C.ink2, 500, 30);
    glowTxt(sc, g, 'n', (99.98 * ease(sc.on * 1.3)).toFixed(2).replace('.', ',') + '%', 32, 262, '#ffffff', 700, 140, FT);
    var names = ['CPU', 'RAM', 'REȚEA'], base = [0.38, 0.61, 0.47], cols = [C.teal, '#5b8cff', C.aqua];
    for (var i = 0; i < 3; i++) {
      var y = 326 + i * 48, v = clamp(base[i] + 0.12 * Math.sin(t * (0.9 + i * 0.37) + i * 2) + 0.05 * Math.sin(t * 3.1 + i), 0.05, 0.98) * ease(sc.on * 1.4 - i * 0.1);
      txt(g, names[i], 36, y, C.muted, 600, 24, FB, 'left', 2);
      rr(g, 130, y - 17, 300, 14, 7); g.fillStyle = 'rgba(143,247,247,0.10)'; g.fill();
      rr(g, 130, y - 17, Math.max(14, 300 * v), 14, 7); g.fillStyle = cols[i]; g.fill();
      txt(g, Math.round(v * 100) + '%', 564, y, C.ink2, 600, 24, FB, 'right');
    }
    g.fillStyle = C.green; g.beginPath(); g.arc(46, 454, 8, 0, 6.2832); g.fill();
    txt(g, '42/42 servere online', 66, 463, C.ink, 600, 28);
    bootClip(g, dw, dh, sc.on);
  }
  function measure(g, s, w, size, fam) { g.font = w + ' ' + size + 'px ' + fam; return g.measureText(s).width; }
  /* linie „live” care curge spre stânga (ca un monitor de trafic) */
  function liveLine(g, x, y, w, h, t, seed, col, on) {
    var n = 40, step = w / (n - 1), sh = t * 2.2, base = Math.floor(sh), fr = sh - base;
    g.save(); g.beginPath(); g.rect(x, y - 4, w, h + 8); g.clip();
    g.beginPath();
    for (var k = 0; k <= n; k++) {
      var v = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin((base + k) * 0.7 + seed)) + 0.2 * (rnd((base + k) * 3.3 + seed) - 0.5);
      var px = x + (k - fr) * step, py = y + h - h * clamp(v, 0.05, 0.98) * on;
      if (k) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.lineWidth = 3; g.strokeStyle = col; g.lineJoin = 'round'; g.stroke();
    g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath();
    var grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, 'rgba(25,203,211,0.28)'); grd.addColorStop(1, 'rgba(25,203,211,0)'); g.fillStyle = grd; g.fill();
    g.restore();
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
     Placa în WebGL: fotografie sau video cu paralaxă de adâncime + efectele, într-un singur shader.
     Coordonatele efectelor sunt pixeli în imaginea sursă, deci rămân lipite de fotografie la orice mărime.
     ===================================================================== */
  var gl = null, prog = null, U = {}, glOk = false, texStill = null, texDep = null, texVid = null, stillReady = false, depReady = false, vidTexReady = false;
  var MAXP = 4, packets = [], ripples = [], ringPulse = 0;
  var GL_FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes, uImg, uPar, uVidMap;',
    'uniform sampler2D uTex, uVid, uDep;',
    'uniform float uUseVid, uUseDep, uFocus, uTime, uOn, uPulse, uGrain, uFxLeft;',
    'uniform vec4 uField, uRing;',
    'uniform vec4 uPk[4]; uniform vec4 uRp[4];',
    'const vec3 TEAL = vec3(0.098, 0.796, 0.827); const vec3 AQUA = vec3(0.56, 0.97, 0.97); const vec3 AMBER = vec3(1.0, 0.706, 0.33);',
    'float hash(float n){ return fract(sin(mod(n, 997.0) * 12.9898) * 43758.5453); }',
    'void main(){',
    '  vec2 f = gl_FragCoord.xy / uRes;',
    '  vec2 uv = vec2(f.x, 1.0 - f.y);',
    '  float d = uUseDep > 0.5 ? texture2D(uDep, uv).r : uFocus;',
    '  vec2 duv = clamp(uv + (d - uFocus) * uPar, 0.0, 1.0);',
    '  vec3 col;',
    '  if (uUseVid > 0.5) { vec2 vv = vec2(duv.x, clamp((duv.y - uVidMap.x) / uVidMap.y, 0.0, 1.0)); col = texture2D(uVid, vv).rgb; }',
    '  else col = texture2D(uTex, duv).rgb;',
    '  vec2 p = duv * uImg;',
    '  vec3 fx = vec3(0.0);',
    '  if (p.x > uFxLeft) {',
    '    float fxn = (p.x - uField.x) / uField.y;',
    '    if (abs(fxn) < 1.02 && p.y > uField.z && p.y < uField.w) {',
    '      float edge = smoothstep(0.55, 1.0, abs(fxn)) * (1.0 - smoothstep(1.0, 1.02, abs(fxn)));',
    '      float colId = floor(p.x / 6.0); float h = hash(colId);',
    '      float streak = fract(p.y / (160.0 + 260.0 * h) + uTime * (0.25 + 0.55 * h) + h * 7.0);',
    '      float dash = smoothstep(0.0, 0.08, streak) * (1.0 - smoothstep(0.08, 0.35, streak)) * step(0.62, hash(colId + 3.1));',
    '      float fade = (1.0 - smoothstep(uField.w - 200.0, uField.w, p.y)) * 0.55 + 0.45 * smoothstep(uField.z, uField.z + 400.0, p.y);',
    '      fx += AQUA * (0.02 + 0.22 * edge) * dash * fade;',
    '    }',
    '    vec2 e = vec2((p.x - uRing.x) / uRing.z, (p.y - uRing.y) / uRing.w);',
    '    float dd = length(e); float rd0 = (dd - 1.0) * 26.0; float ring = exp(-rd0 * rd0);',
    '    float ang = atan(e.y, e.x);',
    '    float travel = pow(0.5 + 0.5 * cos(ang - uTime * 1.3), 18.0) + pow(0.5 + 0.5 * cos(ang + uTime * 0.7 + 2.0), 30.0);',
    '    fx += mix(AQUA, vec3(1.0), 0.3) * ring * (0.10 * travel + 0.75 * uPulse);',
    '    float wv = (dd - 1.0 - (1.0 - uPulse) * 0.35) * 9.0; float wave = exp(-wv * wv) * uPulse * step(0.0, e.y + 0.2);',
    '    fx += TEAL * wave * 0.45;',
    '    for (int i = 0; i < 4; i++) {',
    '      vec4 k = uPk[i]; if (k.z <= 0.0) continue;',
    '      vec2 dir = vec2(cos(k.w), sin(k.w));',
    '      vec2 rel = p - k.xy; float along = dot(rel, dir); float perp = length(rel - dir * along);',
    '      float head = exp(-dot(rel, rel) / 90.0);',
    '      float trail = step(along, 0.0) * exp(along / 140.0) * exp(-perp * perp / 18.0);',
    '      float halo = exp(-dot(rel, rel) / 1400.0) * 0.35;',
    '      fx += mix(AMBER, vec3(1.0, 0.92, 0.75), head) * (head * 1.6 + trail * 0.9 + halo) * k.z;',
    '    }',
    '    for (int i = 0; i < 4; i++) {',
    '      vec4 r = uRp[i]; if (r.w <= 0.0) continue;',
    '      float age = r.z;',
    '      vec2 q = vec2((p.x - r.x) / (26.0 + 70.0 * age), (p.y - r.y) / (70.0 + 420.0 * age));',
    '      float rd = length(q);',
    '      float bb = (rd - 1.0) * 5.0; float band = exp(-bb * bb) * (1.0 - smoothstep(0.96, 1.02, abs(fxn)));',
    '      float hex = 0.6 + 0.4 * sin(p.y * 0.22) * sin(p.x * 0.19 + p.y * 0.11);',
    '      float flash = exp(-rd * rd * 3.0) * pow(1.0 - age, 6.0);',
    '      fx += mix(AMBER, AQUA, smoothstep(0.0, 0.35, age)) * (band * hex * pow(1.0 - age, 1.6) + flash) * r.w;',
    '    }',
    '  }',
    '  col += fx * uOn;',
    '  float g = hash(floor(f.x * uRes.x) * 0.731 + floor(f.y * uRes.y) * 1.37 + fract(uTime * 0.37) * 91.0) - 0.5;',
    '  col += g * uGrain;',
    '  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);',
    '}'
  ].join('\n');
  function makeTex() {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  /* unitatea de textură se alege în onload: altfel imaginea care se încarcă ultima
     ajunge pe unitatea activă rămasă și harta de adâncime se pierde */
  function loadTex(url, tex, unit, done) {
    var im = new Image(); im.decoding = 'async';
    im.onload = function () {
      if (!gl) return;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      done(); if (!running) renderStatic();
    };
    im.src = url;
  }
  function initGl() {
    if (!glCanvas) return;
    try { gl = glCanvas.getContext('webgl', { premultipliedAlpha: false, alpha: false, antialias: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }'), fs = sh(gl.FRAGMENT_SHADER, GL_FS);
    if (!vs || !fs) { gl = null; return; }
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aP'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uImg', 'uPar', 'uVidMap', 'uTex', 'uVid', 'uDep', 'uUseVid', 'uUseDep', 'uFocus', 'uTime', 'uOn', 'uPulse', 'uGrain', 'uFxLeft', 'uField', 'uRing', 'uPk', 'uRp'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    texStill = makeTex(); texDep = makeTex(); texVid = makeTex();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texStill); gl.uniform1i(U.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texVid); gl.uniform1i(U.uVid, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texDep); gl.uniform1i(U.uDep, 2);
    gl.uniform2f(U.uImg, IW, IH);
    gl.uniform2f(U.uVidMap, VIDEO_MAP.top / IH, VIDEO_MAP.height / IH);
    gl.uniform1f(U.uFocus, PLATE.focus); gl.uniform1f(U.uFxLeft, PLATE.fx.left);
    gl.uniform4f(U.uField, PLATE.field.cx, PLATE.field.hw, PLATE.field.top, PLATE.field.bottom);
    gl.uniform4f(U.uRing, PLATE.ring.cx, PLATE.ring.cy, PLATE.ring.rx, PLATE.ring.ry);
    stillReady = depReady = vidTexReady = false;
    loadTex(coarse ? PLATE.srcSmall || PLATE.src : PLATE.src, texStill, 0, function () { stillReady = true; plate.classList.add('gl-on'); });
    loadTex(PLATE.depth, texDep, 2, function () { depReady = true; });
    glOk = true;
  }
  function layoutGl() {
    if (!glCanvas || !gl) return;
    var pr = Math.min(window.devicePixelRatio || 1, 1.25);
    var w = Math.round(IW * L.s * pr), h = Math.round(IH * L.s * pr);
    if (glCanvas.width !== w || glCanvas.height !== h) { glCanvas.width = w; glCanvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function drawGl(t, on, parX, parY) {
    if (!glOk || !stillReady) return;
    var useVid = videoLive && video.readyState >= 2 && !document.hidden;
    if (useVid) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texVid);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); vidTexReady = true; } catch (e) { useVid = false; }
    }
    gl.uniform2f(U.uRes, glCanvas.width, glCanvas.height);
    gl.uniform1f(U.uUseVid, useVid && vidTexReady ? 1 : 0); gl.uniform1f(U.uUseDep, depReady ? 1 : 0);
    gl.uniform2f(U.uPar, parX, parY);
    gl.uniform1f(U.uTime, t); gl.uniform1f(U.uOn, on); gl.uniform1f(U.uPulse, ringPulse);
    gl.uniform1f(U.uGrain, reduceMotion ? 0.0 : 0.028);
    gl.uniform4fv(U.uPk, pkBuf); gl.uniform4fv(U.uRp, rpBuf);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---------- atacuri: vin din întuneric, lovesc câmpul, sunt blocate ---------- */
  function launchAttack(lane) {
    if (packets.length >= MAXP) return;
    if (!lane) lane = Math.random() < 0.5 ? 'up' : 'low';
    var ln = PLATE.lanes[lane] || PLATE.lanes.up, up = lane === 'up';
    var from = [ln[0][0] + Math.random() * 80, ln[0][1] + Math.random() * 120], to = [ln[1][0], ln[1][1] + Math.random() * (up ? 120 : 250)];
    var ctrl = [(from[0] + to[0]) / 2 + 40, (from[1] + to[1]) / 2 + (up ? -70 : 70)];
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

  /* ---------- video: aceeași scenă, cameră fixă, buclă perfectă; devine textură în WebGL ---------- */
  var videoWanted = false, videoLive = false;
  function initVideo() {
    if (!video || reduceMotion || saveData || videoWanted) return;
    videoWanted = true;
    video.muted = true; video.loop = true; video.playsInline = true; video.setAttribute('playsinline', '');
    video.addEventListener('playing', function () { videoLive = true; plate.classList.add('video-on'); });
    video.addEventListener('pause', function () { videoLive = false; });
    video.addEventListener('error', function () { videoLive = false; videoWanted = false; plate.classList.remove('video-on'); });
    video.src = L.compact ? VIDEO_MAP.n : VIDEO_MAP.w;
    syncVideo();
  }
  function syncVideo() {
    if (!videoWanted || !video.src) return;
    if (heroVisible && !document.hidden && !reduceMotion && !userPaused && SC[0].shown) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
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
  var mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 }, nextAttack = 3.2, holoAcc = 1, lastWorld = '';
  var pageFade = reduceMotion ? 1 : 0, partAcc = 1, glAcc = 1, MIN_GAP = 1000 / 62 - 4;   /* toleranță: 75/90/144 Hz nu cad la jumătate */
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
      var still = reduceMotion || userPaused;
      var sp = clamp(((window.scrollY || 0) - (L.heroTop || 0)) / Math.max(1, L.heroH || 1), 0, 1);
      var k = 1 - Math.exp(-dt * 2.6);
      smooth.x += (mouse.x - smooth.x) * k; smooth.y += (mouse.y - smooth.y) * k;
      /* camera: derivă lentă (zoom + translație pe două frecvențe) + răspuns calm la mouse + coregrafie la scroll */
      var zoom = still ? 1 : 1.012 + 0.012 * Math.sin(t * 0.17) + 0.006 * Math.sin(t * 0.071 + 1.3);
      var wx = still ? 0 : (Math.sin(t * 0.11) * 5 + Math.sin(t * 0.043 + 2.0) * 3) * (coarse ? 1.5 : 1) + (L.compact ? 0 : -smooth.x * 10);
      var wy = (still ? 0 : Math.cos(t * 0.09) * 4 + (L.compact ? 0 : -smooth.y * 7)) + sp * 70;
      var wk = wx.toFixed(1) + ',' + wy.toFixed(1) + ',' + (zoom + sp * 0.04).toFixed(4);
      if (wk !== lastWorld) {
        lastWorld = wk;
        var tf = 'translate3d(' + wx.toFixed(1) + 'px,' + wy.toFixed(1) + 'px,0) scale(' + (zoom + sp * 0.04).toFixed(4) + ')';
        for (var wi = 0; wi < SC.length; wi++) if (SC[wi].shown) SC[wi].world.style.transform = tf;
      }
      var aOn = SC[0].shown;
      /* paralaxă de adâncime (UV): mouse + o derivă proprie, ca scena să „respire” și fără cursor */
      /* pe touch nu există mouse: deriva proprie e mai amplă, ca adâncimea să se simtă și așa */
      var dk = coarse ? 1.7 : 1;
      var parX = still ? 0 : (L.compact ? 0 : -smooth.x * 0.011) + (Math.sin(t * 0.21) * 0.0035 + Math.sin(t * 0.083 + 0.7) * 0.002) * dk;
      var parY = still ? 0 : (L.compact ? 0 : -smooth.y * 0.006) + Math.cos(t * 0.16) * 0.002 * dk;
      if (bootAt >= 0 && !still && aOn) {
        if (bt > nextAttack) { launchAttack(); nextAttack = bt + 2.4 + Math.random() * 2.2; }
        stepAttacks(dt);
      }
      /* ecranele: 30 fps sunt suficiente pentru text și cifre */
      holoAcc += dt;
      if (holoAcc >= 1 / 30 && bootAt >= 0) {
        var hdt = holoAcc; holoAcc = 0;
        drawSceneScreens(bt, hdt, still);
        if (aOn) SCREENS.forEach(function (sc, i) {
          if (!sc.ctx) return;
          sc.on = still ? 1 : clamp((bt - 0.45 - i * 0.35) / 0.9, 0, 1);
          if (sc.on <= 0) { sc.ctx.setTransform(1, 0, 0, 1, 0, 0); sc.ctx.clearRect(0, 0, sc.el.width, sc.el.height); return; }
          if (i === 0) drawMain(sc, bt, hdt); else drawSmall(sc, bt);
        });
      }
      glAcc += dt;
      tickTabs(now);
      if (aOn && (!coarse || glAcc >= 1 / 30 || !running)) { glAcc = 0; drawGl(t, (still ? 1 : ease((bt - 0.2) / 1.6)) * (1 - sp * 0.9), parX, parY); }
    }
    if (running) rafId = requestAnimationFrame(frame);
  }
  function start() {
    if (running || document.hidden) return;
    running = true; last = 0; rafId = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function sync() {
    syncVideo(); syncClips(); syncRotation();
    if (reduceMotion || userPaused) { stop(); renderStatic(); return; }
    if (document.hidden) stop(); else start();
  }
  function renderStatic() {
    var now = performance.now();
    if (reduceMotion || userPaused) { packets.length = 0; ripples.length = 0; pkBuf.fill(0); rpBuf.fill(0); ringPulse = 0; }
    last = now; SCREENS.forEach(function (sc) { sc.on = 1; });
    holoAcc = 1; frame(now);
  }

  /* click în scenă = un atac lansat de vizitator, blocat în timp real */
  function setInteractive() { plate.classList.toggle('is-interactive', !reduceMotion && !userPaused && cur === 0); if (attackBtn) attackBtn.hidden = reduceMotion || userPaused; }
  var attackBtn = hero.querySelector('[data-hero="attack"]'), pauseBtn = hero.querySelector('[data-hero="pause"]');
  function setPaused(v) {
    userPaused = v;
    try { localStorage.setItem('mdy-hero-paused', v ? '1' : '0'); } catch (e) { /* stocare indisponibilă */ }
    if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); pauseBtn.textContent = v ? 'Pornește animația' : 'Pauză animație'; }
    setInteractive(); sync();
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });
  if (attackBtn) attackBtn.addEventListener('click', function () {
    if (bootAt < 0 || reduceMotion || userPaused) return;
    /* din altă scenă: întâi revine la centrul de comandă, apoi lansează atacul */
    if (cur !== 0) { showScene(0, true); setTimeout(function () { launchAttack(); }, 1100); } else launchAttack();
  });
  plate.addEventListener('click', function (e) {
    if (reduceMotion || userPaused || bootAt < 0 || cur !== 0) return;
    var pr = plate.getBoundingClientRect(), iy = (e.clientY - pr.top - L.oy) / L.s;
    launchAttack(iy < PLATE.anchor[1] ? 'up' : 'low');
  });
  plate.addEventListener('pointerenter', function () { var c = window.mdy && window.mdy.cursor; if (c && !reduceMotion && !userPaused && cur === 0) c.set('Testează firewall-ul'); });
  plate.addEventListener('pointerleave', function () { var c = window.mdy && window.mdy.cursor; if (c) c.clear(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; syncVideo(); syncClips(); syncRotation(); if ((reduceMotion || userPaused) && heroVisible) renderStatic(); }, { rootMargin: '80px' }).observe(hero);
  }
  document.addEventListener('visibilitychange', sync);
  var rsT = 0;
  window.addEventListener('resize', function () { clearTimeout(rsT); rsT = setTimeout(function () { layout(); sizeParticles(); if (reduceMotion) renderStatic(); }, 80); });
  var mq = matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', function (e) { reduceMotion = e.matches; if (!reduceMotion) initVideo(); setInteractive(); sync(); });

  /* =====================================================================
     Scenele din deschidere: centru de comandă (WebGL) → ERP → infrastructură.
     Fiecare scenă are textul ei (eyebrow, titlu, paragraf); cea veche se retrage în adâncime,
     cea nouă vine spre cameră. Mișcarea e în styles.css (.hero-scene), aici doar se comută.
     ===================================================================== */
  var SC = [], cur = 0, rotT = 0, rotStart = 0, rotDur = 7000, rotLeft = 7000, tabsHold = false, copyTok = 0, copyAnims = [];
  var FIRST = 7000, DWELL = 6000, AFTER_CLICK = 10000, TRANS = 1750;   /* ms: prima scenă, celelalte, după un click pe tab */
  var sceneEls = Array.prototype.slice.call(plate.querySelectorAll('.hero-scene'));
  var tabEls = Array.prototype.slice.call(hero.querySelectorAll('.hero-tab'));
  var tabsBox = hero.querySelector('.hero-tabs');
  var stageEl = hero.querySelector('.hero-stage');
  var eyebrowEl = hero.querySelector('.hero-eyebrow'), leadEl = hero.querySelector('.hero-lead');
  var h1Els = Array.prototype.slice.call(hero.querySelectorAll('.h1-inner'));
  var multi = sceneA !== plate && sceneEls.length >= SCENE_DEFS.length && tabEls.length >= SCENE_DEFS.length && h1Els.length === 3 && !!eyebrowEl && !!leadEl;
  SCENE_DEFS.forEach(function (d, i) {
    if (i > 0 && !multi) return;
    var el = i === 0 ? sceneA : sceneEls[i];
    var sc = { key: d.key, el: el, world: i === 0 ? world : el.querySelector('.hero-world'), plate: d.plate || PLATE, copy: d.copy, aria: d.aria, shown: i === 0, lv: 0 };
    if (i === 0) {
      /* prima scenă păstrează textul din HTML (și pentru motoarele de căutare) */
      if (multi) sc.copy = { eyebrow: eyebrowEl.textContent, h1: h1Els.map(function (e) { return e.textContent; }), lead: leadEl.textContent };
      sc.aria = stageEl ? stageEl.getAttribute('aria-label') : '';
    } else {
      sc.img = el.querySelector('.hero-plate-img'); sc.video = el.querySelector('.hero-plate-video');
      var hc = el.querySelector('.holo-erp');
      if (hc && hc.getContext) sc.holo = { key: 'erp', dw: 1000, dh: 736, el: hc, ctx: hc.getContext('2d'), on: 0, bootT: 0, dense: true };
    }
    SC.push(sc);
  });
  if (!multi && tabsBox) tabsBox.hidden = true;

  function layoutScene(sc, copyR, pw, ph, compact) {
    var P = sc.plate, F = fitPlate(P, copyR, pw, ph, compact);
    var box = 'left:' + F.ox.toFixed(2) + 'px;top:' + F.oy.toFixed(2) + 'px;width:' + (P.w * F.s).toFixed(2) + 'px;height:' + (P.h * F.s).toFixed(2) + 'px';
    if (sc.img) sc.img.style.cssText = box;
    if (sc.video) sc.video.style.cssText = 'left:' + F.ox.toFixed(2) + 'px;top:' + (F.oy + (P.video.top || 0) * F.s).toFixed(2) + 'px;width:' + (P.w * F.s).toFixed(2) + 'px;height:' + ((P.video.height || P.h) * F.s).toFixed(2) + 'px';
    sc.world.style.transformOrigin = (F.ox + P.anchor[0] * F.s).toFixed(1) + 'px ' + (F.oy + P.anchor[1] * F.s).toFixed(1) + 'px';
    sc.vars = plateVars(F, P, ph, compact);
    if (sc.holo && P.panes) layoutHolo(sc.holo, P.panes.main, F);
  }
  /* ecranul ERP: canvas 2D fixat pe sticla din fotografie, ca ecranele din prima scenă */
  function layoutHolo(hs, quad, F) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var q = quad.map(function (p) { return [F.ox + p[0] * F.s, F.oy + p[1] * F.s]; });
    var w = Math.max(40, (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2), h = Math.max(40, (q[3][1] - q[0][1] + q[2][1] - q[1][1]) / 2);
    var over = dpr >= 2 ? 1 : 1.25, bw = Math.round(w * dpr * over), bh = Math.round(h * dpr * over);
    if (hs.el.width !== bw || hs.el.height !== bh) { hs.el.width = bw; hs.el.height = bh; }
    hs.el.style.width = w + 'px'; hs.el.style.height = h + 'px';
    hs.w = w; hs.h = h; hs.chrome = null; hs.compact = w < 340;
    hs.baseM = matrix3d(w, h, q);
    hs.el.style.transform = hs.baseM;
  }

  /* ---------- ERP demonstrativ: comenzi care intră, facturare, producție ---------- */
  var CITIES = ['Cluj-Napoca', 'Timișoara', 'Brașov', 'Iași', 'Oradea', 'Sibiu', 'Constanța', 'Arad', 'Bistrița', 'Suceava'];
  var ERP_ST = [['FACTURATĂ', C.teal], ['ÎN LUCRU', C.amber], ['LIVRATĂ', C.green]];
  var erp = { orders: 1284, revenue: 186420, shownO: 0, shownR: 0, feed: [], seq: 24816, nextAt: 2.6, flash: 0 };
  for (var ei = 0; ei < 3; ei++) erp.feed.push({ id: 'CMD-' + (erp.seq - ei), city: CITIES[(ei * 3) % CITIES.length], val: 4260 + ei * 3170, st: ei === 0 ? 0 : (ei === 1 ? 2 : 0), age: 9 });
  function erpOrder() {
    erp.seq++;
    var v = 1200 + Math.round(rnd(erp.seq * 1.37) * 2600) * 10;
    erp.orders++; erp.revenue += v; erp.flash = 1;
    if (erp.feed[0] && erp.feed[0].st === 1) erp.feed[0].st = 0;      /* comanda anterioară a fost facturată */
    erp.feed.unshift({ id: 'CMD-' + erp.seq, city: CITIES[Math.floor(rnd(erp.seq * 2.1) * CITIES.length)], val: v, st: 1, age: 0 });
    if (erp.feed.length > 4) erp.feed.length = 4;
  }
  function panel(g, x, y, w, h) {
    rr(g, x, y, w, h, 12); g.fillStyle = 'rgba(143,247,247,0.045)'; g.fill();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(143,247,247,0.16)'; g.stroke();
  }
  function drawErp(hs, t, dt, still) {
    var g = hs.ctx, dw = hs.dw, dh = hs.dh, on = hs.on, local = t - hs.bootT;
    g.setTransform(hs.el.width / dw, 0, 0, hs.el.height / dh, 0, 0);
    glass(hs, g, dw, dh);
    if (!still && on >= 1 && local > erp.nextAt) { erpOrder(); erp.nextAt = local + 3 + rnd(erp.seq * 0.7) * 1.6; }
    erp.shownO = on < 1 ? erp.orders * ease(on * 1.2) : lerp(erp.shownO, erp.orders, 1 - Math.exp(-dt * 6));
    erp.shownR = on < 1 ? erp.revenue * ease(on * 1.2) : lerp(erp.shownR, erp.revenue, 1 - Math.exp(-dt * 4));
    if (on >= 1 && Math.abs(erp.shownO - erp.orders) < 0.5) erp.shownO = erp.orders;
    erp.flash = Math.max(0, erp.flash - dt * 1.4);
    var pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
    if (hs.compact) {
      g.fillStyle = mix(C.aqua, C.aqua, 0, 0.5 + 0.5 * pulse); g.beginPath(); g.arc(56, 80, 13, 0, 6.2832); g.fill();
      txt(g, 'MDY · ERP', 88, 94, C.aqua, 600, 40, FB, 'left', 5);
      txt(g, 'DEMO', 950, 94, C.green, 700, 36, FB, 'right', 4);
      txt(g, 'Comenzi azi', 56, 214, C.ink2, 500, 50);
      glowTxt(hs, g, 'o', fmt(erp.shownO), 50, 420, erp.flash > 0.01 ? mix(C.amber, '#ffffff', Math.round((1 - erp.flash) * 8) / 8) : '#ffffff', 700, 200, FT);
      pillTxt(g, 56, 520, '+12% FAȚĂ DE IERI', C.green, 40);
      txt(g, 'Facturat azi', 56, 624, C.muted, 500, 42);
      txt(g, fmt(erp.shownR) + ' lei', 56, 700, C.ink, 700, 66, FT);
      bootClip(g, dw, dh, on);
      return;
    }
    /* antet */
    g.fillStyle = mix(C.aqua, C.aqua, 0, 0.5 + 0.5 * pulse); g.beginPath(); g.arc(42, 46, 8, 0, 6.2832); g.fill();
    txt(g, 'MDY · ERP', 60, 54, C.aqua, 600, 22, FB, 'left', 4);
    var lw = txt(g, 'DEMO LIVE', 964, 54, C.green, 700, 20, FB, 'right', 3);
    g.fillStyle = mix(C.green, C.green, 0, 0.55 + 0.45 * pulse); g.beginPath(); g.arc(964 - lw - 18, 47, 7, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(143,247,247,0.16)'; g.fillRect(36, 76, 928, 2);
    /* indicatori */
    var kpis = [
      ['Comenzi azi', fmt(erp.shownO), '+12% față de ieri', C.green],
      ['Facturat azi (lei)', fmt(erp.shownR), '+8% față de ieri', C.green],
      ['Stoc disponibil', '98,4%', '3 produse sub prag', C.amber],
      ['Livrări la timp', '97%', 'ultimele 30 de zile', C.muted]
    ];
    for (var k = 0; k < 4; k++) {
      var x = 36 + k * 238, y = 94;
      g.globalAlpha = ease(on * 1.4 - k * 0.12);
      rr(g, x, y, 222, 140, 12);
      g.fillStyle = k < 2 && erp.flash > 0.01 ? mix(C.amber, C.teal, 1 - erp.flash, 0.05 + 0.14 * erp.flash) : 'rgba(143,247,247,0.045)'; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = 'rgba(143,247,247,0.16)'; g.stroke();
      txt(g, kpis[k][0], x + 16, y + 34, C.ink2, 500, 19);
      txt(g, kpis[k][1], x + 16, y + 94, '#ffffff', 700, 48, FT);
      txt(g, kpis[k][2], x + 16, y + 124, kpis[k][3], 500, 16);
      g.globalAlpha = 1;
    }
    /* vânzări: ultimele 12 luni, luna curentă crește odată cu facturile */
    var cy = 250;
    panel(g, 36, cy, 454, 240);
    txt(g, 'Vânzări · ultimele 12 luni', 54, cy + 32, C.ink2, 500, 19);
    for (var b = 0; b < 12; b++) {
      var hv = b < 11 ? 0.34 + 0.042 * b + 0.1 * Math.sin(b * 1.7 + 0.6) : 0.8 + 0.12 * clamp((erp.shownR - 186420) / 40000, 0, 1) + 0.015 * Math.sin(t * 2.4);
      var bh = 150 * clamp(hv, 0.1, 1) * ease(on * 1.3 - b * 0.03);
      g.fillStyle = b === 11 ? C.aqua : 'rgba(25,203,211,0.5)';
      rr(g, 54 + b * 35, cy + 222 - bh, 24, Math.max(4, bh), 5); g.fill();
    }
    /* producție: planul de azi, pe etape */
    panel(g, 510, cy, 454, 240);
    txt(g, 'Producție · planul de azi', 528, cy + 32, C.ink2, 500, 19);
    var stages = ['Aprovizionare', 'Producție', 'Control calitate', 'Ambalare', 'Livrare'], pb = [0.94, 0.76, 0.58, 0.41, 0.23];
    for (var r = 0; r < 5; r++) {
      var ry = cy + 72 + r * 34, p = clamp(pb[r] + Math.max(0, local) * 0.006, 0, 1) * ease(on * 1.3 - r * 0.08);
      txt(g, stages[r], 528, ry + 6, C.muted, 500, 16);
      rr(g, 690, ry - 7, 210, 12, 6); g.fillStyle = 'rgba(143,247,247,0.10)'; g.fill();
      rr(g, 690, ry - 7, Math.max(12, 210 * p), 12, 6); g.fillStyle = r === 4 ? C.green : C.teal; g.fill();
      txt(g, Math.round(p * 100) + '%', 948, ry + 6, C.ink2, 600, 16, FB, 'right');
    }
    /* comenzi noi */
    var oy0 = 508;
    panel(g, 36, oy0, 928, 212);
    txt(g, 'Comenzi noi', 54, oy0 + 32, C.ink2, 500, 19);
    g.save(); g.beginPath(); g.rect(36, oy0 + 44, 928, 164); g.clip();
    var sh = erp.feed.length && erp.feed[0].age < 1 ? (1 - ease(erp.feed[0].age / 0.5)) : 0;
    for (var o = 0; o < Math.min(3, erp.feed.length); o++) {
      var it = erp.feed[o], yy = oy0 + 82 + (o - sh) * 46;
      if (!still) it.age += dt;
      if (it.age < 1.2) { g.fillStyle = mix(C.amber, C.teal, clamp(it.age / 1.2, 0, 1), 0.2 * (1 - it.age / 1.2)); g.fillRect(40, yy - 30, 920, 42); }
      g.globalAlpha = (o === 0 ? clamp(it.age / 0.35, 0, 1) : 1) * ease(on * 1.4 - 0.3 - o * 0.1);
      txt(g, it.id, 54, yy, C.ink, 600, 21);
      txt(g, it.city, 222, yy, C.muted, 500, 19);
      txt(g, fmt(it.val) + ' lei', 700, yy, C.ink, 600, 21, FB, 'right');
      pillTxt(g, 948, yy + 3, ERP_ST[it.st][0], ERP_ST[it.st][1], 16, true);
      g.globalAlpha = 1;
    }
    g.restore();
    bootClip(g, dw, dh, on);
  }
  function drawSceneScreens(bt, dt, still) {
    for (var i = 1; i < SC.length; i++) {
      var hs = SC[i].holo;
      if (!hs || !hs.ctx || !hs.baseM || !SC[i].shown) continue;
      hs.on = still ? 1 : clamp((bt - hs.bootT - 0.6) / 0.9, 0, 1);
      if (hs.on <= 0) { hs.ctx.setTransform(1, 0, 0, 1, 0, 0); hs.ctx.clearRect(0, 0, hs.el.width, hs.el.height); continue; }
      drawErp(hs, bt, dt, still);
    }
  }

  /* ---------- media scenelor: fotografia și bucla se încarcă abia când scena urmează ---------- */
  function prepare(sc) {
    if (!sc || !sc.img || sc.ready) return;
    sc.ready = true;
    var big = !coarse && window.innerWidth * (window.devicePixelRatio || 1) > 1800;
    sc.img.src = big ? sc.plate.src : sc.plate.srcSmall;
    var v = sc.video;
    if (!v || reduceMotion || saveData) return;
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
    v.addEventListener('playing', function () { sc.el.classList.add('is-playing'); });
    v.addEventListener('error', function () { sc.el.classList.remove('is-playing'); });
    v.preload = 'auto';
    v.src = L.compact || coarse ? sc.plate.video.n : sc.plate.video.w;
  }
  function syncClips() {
    for (var i = 1; i < SC.length; i++) {
      var v = SC[i].video;
      if (!v || !v.getAttribute('src')) continue;
      if (SC[i].shown && heroVisible && !document.hidden && !reduceMotion && !userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else if (!v.paused) v.pause();
    }
  }

  /* ---------- textul scenei: rândurile titlului ies în sus și intră de jos, pe rând ---------- */
  function setCopy(c) {
    eyebrowEl.textContent = c.eyebrow;
    h1Els.forEach(function (e, k) { e.textContent = c.h1[k]; });
    leadEl.textContent = c.lead;
  }
  function swapCopy(c) {
    if (!multi || !c) return;
    var tok = ++copyTok;
    copyAnims.forEach(function (a) { try { a.cancel(); } catch (e) { /* deja terminată */ } });
    copyAnims = [];
    if (reduceMotion || !leadEl.animate) { setCopy(c); return; }
    var els = [eyebrowEl].concat(h1Els, [leadEl]);
    var outs = els.map(function (el, k) {
      var line = k > 0 && k < 4;
      return el.animate([{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: line ? 'translate3d(0,-110%,0)' : 'translate3d(0,-10px,0)', opacity: line ? 1 : 0 }],
        { duration: line ? 440 : 340, delay: k * 50, easing: 'cubic-bezier(0.55, 0, 0.8, 0.2)', fill: 'forwards' });
    });
    copyAnims = outs;
    Promise.all(outs.map(function (a) { return a.finished; })).then(function () {
      if (tok !== copyTok) return;
      setCopy(c);
      outs.forEach(function (a) { a.cancel(); });
      copyAnims = els.map(function (el, k) {
        var line = k > 0 && k < 4;
        return el.animate([{ transform: line ? 'translate3d(0,110%,0)' : 'translate3d(0,14px,0)', opacity: line ? 1 : 0 }, { transform: 'translate3d(0,0,0)', opacity: 1 }],
          { duration: line ? 1000 : 760, delay: 80 + k * 90, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' });
      });
    }, function () { /* întreruptă de o schimbare nouă */ });
  }
  /* eyebrow-ul, titlul și paragraful țin înălțimea celui mai lung text dintre scene,
     ca butoanele și scena de dedesubt (pe telefon) să nu sară la schimbare */
  var copyMaxR = 0;
  function probeRight(p) {
    var rg = document.createRange(), r = 0, list = p.querySelectorAll('.h1-inner');
    if (!list.length) list = [p];
    for (var i = 0; i < list.length; i++) { rg.selectNodeContents(list[i]); r = Math.max(r, rg.getBoundingClientRect().right); }
    return r;
  }
  function fitCopy() {
    if (!multi || !leadEl.clientWidth) return;
    var h1 = h1Els[0].parentNode.parentNode, cl = copy.getBoundingClientRect().left, maxR = 0;
    [
      [eyebrowEl, function (p, c) { p.textContent = c.eyebrow; }],
      [h1, function (p, c) { var ins = p.querySelectorAll('.h1-inner'); for (var k = 0; k < ins.length; k++) ins[k].textContent = c.h1[k]; }],
      [leadEl, function (p, c) { p.textContent = c.lead; }]
    ].forEach(function (job) {
      var el = job[0], inline = /^inline/.test(getComputedStyle(el).display);
      var probe = el.cloneNode(job[0] === h1);
      probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;min-height:0;transform:none;' +
        (inline ? 'max-width:' + el.parentNode.clientWidth + 'px' : 'width:' + el.clientWidth + 'px');
      el.parentNode.appendChild(probe);
      var mh = 0;
      SC.forEach(function (sc) { if (sc.copy) { job[1](probe, sc.copy); mh = Math.max(mh, probe.offsetHeight); maxR = Math.max(maxR, probeRight(probe) - cl); } });
      probe.parentNode.removeChild(probe);
      var v = Math.ceil(mh) + 'px';
      if (el.style.minHeight !== v) el.style.minHeight = v;
    });
    copyMaxR = maxR;
  }

  /* ---------- rotația ---------- */
  function canRotate() { return multi && bootAt >= 0 && !reduceMotion && !userPaused && heroVisible && !document.hidden && !tabsHold; }
  function schedule(ms) {
    clearTimeout(rotT); rotT = 0;
    rotDur = rotLeft = ms; rotStart = performance.now();
    if (canRotate()) rotT = setTimeout(nextScene, ms);
  }
  function syncRotation() {
    if (!multi) return;
    if (canRotate()) { if (!rotT) { rotStart = performance.now(); rotT = setTimeout(nextScene, Math.max(400, rotLeft)); } }
    else if (rotT) { clearTimeout(rotT); rotT = 0; rotLeft = Math.max(1500, rotLeft - (performance.now() - rotStart)); }
  }
  function nextScene() { rotT = 0; rotLeft = 0; showScene(cur + 1); }
  function recede(sc) {
    clearTimeout(sc.lv);
    sc.el.classList.add('is-leaving');
    sc.lv = setTimeout(function () {
      sc.lv = 0;
      if (sc.el.classList.contains('is-active')) return;          /* a revenit între timp */
      sc.el.classList.remove('is-leaving'); sc.shown = false;
      syncVideo(); syncClips();
    }, reduceMotion ? 520 : TRANS);
  }
  function settle(sc) { clearTimeout(sc.lv); sc.lv = 0; sc.el.classList.remove('is-leaving'); }
  function showScene(i, user) {
    if (!multi) return;
    i = (i + SC.length) % SC.length;
    if (i === cur) { if (user) schedule(AFTER_CLICK); return; }
    var prev = SC[cur], next = SC[i];
    prepare(next); prepare(SC[(i + 1) % SC.length]);
    settle(next);
    next.shown = true;
    next.el.classList.add('is-active'); next.el.removeAttribute('aria-hidden');
    prev.el.classList.remove('is-active'); prev.el.setAttribute('aria-hidden', 'true');
    recede(prev);
    cur = i;
    lastWorld = '';
    plate.classList.add('is-rotating');
    applyVars(next.vars);
    if (next.holo) { next.holo.bootT = bootAt < 0 ? 0 : (performance.now() - t0) / 1000 - bootAt; erp.nextAt = 2.6; }
    swapCopy(next.copy);
    if (stageEl && next.aria) stageEl.setAttribute('aria-label', next.aria);
    tabEls.forEach(function (t, k) {
      var on = k === i;
      t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      var bar = t.querySelector('.hero-tab-bar b');
      if (bar && !on) { bar._p = 0; bar.style.transform = 'scaleX(0)'; }
    });
    setInteractive();
    var cz = window.mdy && window.mdy.cursor; if (cz && i !== 0) cz.clear();
    syncVideo(); syncClips();
    schedule(user ? AFTER_CLICK : DWELL);
    if (!running) renderStatic();
  }
  function tickTabs(now) {
    if (!multi) return;
    var bar = tabEls[cur] && tabEls[cur].querySelector('.hero-tab-bar b');
    if (!bar) return;
    var p = clamp((rotDur - rotLeft + (rotT ? now - rotStart : 0)) / rotDur, 0, 1);
    if (Math.abs(p - (bar._p || 0)) > 0.002) { bar._p = p; bar.style.transform = 'scaleX(' + p.toFixed(3) + ')'; }
  }
  if (multi) {
    tabEls.forEach(function (t, k) {
      t.addEventListener('click', function () { showScene(k, true); });
      t.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
        if (!d) return;
        e.preventDefault();
        var n = (k + d + SC.length) % SC.length;
        showScene(n, true); tabEls[n].focus();
      });
    });
    /* cât timp vizitatorul e pe tab-uri, scena nu se schimbă singură */
    tabsBox.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') { tabsHold = true; syncRotation(); } });
    tabsBox.addEventListener('pointerleave', function () { if (tabsHold) { tabsHold = false; syncRotation(); } });
    tabsBox.addEventListener('focusin', function (e) { var fv = false; try { fv = e.target.matches(':focus-visible'); } catch (x) { fv = false; } if (fv) { tabsHold = true; syncRotation(); } });
    tabsBox.addEventListener('focusout', function (e) { if (!tabsBox.contains(e.relatedTarget) && tabsHold) { tabsHold = false; syncRotation(); } });
  }

  /* ---------- pornire ---------- */
  initParticles();
  initGl();
  /* context WebGL pierdut (driver resetat, tab în fundal pe mobil): fotografia rămâne vizibilă, se reface la restaurare */
  if (glCanvas) {
    glCanvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); glOk = false; plate.classList.remove('gl-on'); });
    glCanvas.addEventListener('webglcontextrestored', function () { initGl(); layoutGl(); if (!running) renderStatic(); });
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
  if (pg || glOk) { root.classList.remove('no-webgl'); root.classList.add('has-webgl'); }
  else root.classList.add('no-webgl');
  layout();
  if (img && !img.complete) img.addEventListener('load', layout, { once: true });
  function boot() {
    if (bootAt >= 0) return;
    bootAt = (performance.now() - t0) / 1000;
    syncRotation();
    if (reduceMotion || userPaused) renderStatic();
  }
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('700 60px "Barlow Condensed"'), document.fonts.load('600 20px Inter'), document.fonts.load('500 20px Inter')]).then(boot, boot);
  }
  setTimeout(boot, 1800);
  if (document.readyState === 'complete') { setTimeout(initVideo, 900); setTimeout(function () { prepare(SC[1]); }, 2600); }
  else window.addEventListener('load', function () { setTimeout(initVideo, 900); setTimeout(function () { prepare(SC[1]); }, 2600); }, { once: true });
  sync();

  window.mdyHero = {
    attack: launchAttack, layout: layout, stop: stop, start: start,
    render: function () { frame(performance.now()); },
    scene: function (i) { showScene(i, true); }, scenes: function () { return { cur: cur, shown: SC.map(function (sc) { return !!sc.shown; }), timer: !!rotT, left: Math.round(rotLeft) }; },
    info: function () { return { s: L.s, ox: L.ox, oy: L.oy, pw: L.pw, ph: L.ph, compact: L.compact, gl: glOk, still: stillReady, depth: depReady, particles: !!pg, video: videoLive, blocked: soc.blocked, screens: SCREENS.map(function (sc) { return [sc.key, Math.round(sc.w), Math.round(sc.h), sc.on]; }) }; }
  };
})();
