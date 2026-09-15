/* MDY Solutions — dashboard animat desenat în canvas.
   Textura ecranului din scena 3D: ERP, Producție, Curierat, Depozit, BI, Infrastructură, Securitate.
   window.createDashboard({ width, height, module, fps }) -> { canvas, setModule, getModule, tick, invalidate, destroy } */
(function () {
  'use strict';
  var DW = 1536, DH = 960;
  var C = { bg: '#06101b', side: '#07131f', line: 'rgba(143,247,247,0.10)', teal: '#19cbd3', aqua: '#8ff7f7', amber: '#ffb454', green: '#3fd68c', red: '#ff6b6b', blue: '#4f7cff', ink: '#e8f3f7', ink2: '#b9ccd6', muted: '#7f97a8' };
  var FT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  var FB = 'Inter, "Segoe UI", Arial, sans-serif';
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function rnd(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function wave(s, seed) { return 0.5 + 0.22 * Math.sin(s * 0.7 + seed) + 0.14 * Math.sin(s * 1.9 + seed * 2.1) + 0.08 * Math.sin(s * 3.7 + seed * 3.3); }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function text(g, s, x, y, col, w, size, fam, align) { g.font = w + ' ' + size + 'px ' + (fam || FB); g.fillStyle = col; g.textAlign = align || 'left'; g.fillText(s, x, y); return g.measureText(s).width; }
  function card(g, x, y, w, h, title, right) {
    var grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, '#0b1c2e'); grd.addColorStop(1, '#08131e');
    rr(g, x, y, w, h, 12); g.fillStyle = grd; g.fill();
    g.lineWidth = 1; g.strokeStyle = C.line; rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 12); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(x + 16, y + 1.5); g.lineTo(x + w - 16, y + 1.5); g.stroke();
    if (title) text(g, title, x + 20, y + 34, C.ink2, 600, 14);
    if (right) text(g, right, x + w - 20, y + 34, C.muted, 500, 12, FB, 'right');
  }
  function pill(g, x, y, label, col, alignRight) {
    g.font = '600 12px ' + FB; var w = g.measureText(label).width + 32;
    if (alignRight) x -= w;
    rr(g, x, y - 16, w, 24, 12); g.fillStyle = hexA(col, 0.14); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x + 12, y - 4, 3, 0, 6.2832); g.fill();
    g.textAlign = 'left'; g.fillText(label, x + 21, y); return w;
  }
  function bar(g, x, y, w, h, f, col, track) {
    rr(g, x, y, w, h, h / 2); g.fillStyle = track || 'rgba(143,247,247,0.08)'; g.fill();
    if (f > 0.001) { rr(g, x, y, Math.max(h, w * clamp(f, 0, 1)), h, h / 2); g.fillStyle = col; g.fill(); }
  }
  function spark(g, x, y, w, h, seed, t, col) {
    var n = 22, s = t * 0.6, i, px, py;
    g.beginPath();
    for (i = 0; i <= n; i++) { px = x + w * i / n; py = y + h - h * wave(i * 0.55 + s, seed); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.lineWidth = 2; g.strokeStyle = col; g.lineJoin = 'round'; g.stroke();
    g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath();
    var grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, hexA(col, 0.22)); grd.addColorStop(1, hexA(col, 0)); g.fillStyle = grd; g.fill();
  }
  function wrap(g, s, maxW) {
    var words = s.split(' '), lines = [], line = '';
    for (var i = 0; i < words.length; i++) { var tst = line ? line + ' ' + words[i] : words[i]; if (g.measureText(tst).width > maxW && line) { lines.push(line); line = words[i]; } else line = tst; }
    if (line) lines.push(line); return lines;
  }
  /* rânduri care intră pe rând în listă (cel nou apare sus și împinge restul) */
  function feed(g, x, y, w, rows, rowH, period, t, drawRow) {
    var ph = t / period, base = Math.floor(ph), fr = ease((ph - base) / 0.22);
    g.save(); g.beginPath(); g.rect(x, y, w, rows * rowH); g.clip();
    for (var r = 0; r <= rows; r++) {
      var ry = y + (r - 1 + fr) * rowH;
      g.globalAlpha = r === 0 ? fr : 1;
      drawRow(base - r + 1000, ry, r === 0 ? 1 - fr : 0, r);
    }
    g.restore(); g.globalAlpha = 1;
  }

  /* ---------- cadrul aplicației: meniu lateral + bara de sus ---------- */
  var NAV = [['erp', 'ERP operațional'], ['productie', 'Producție & MES'], ['curierat', 'Curierat'], ['depozit', 'Depozit & WMS'], ['bi', 'BI & Analytics'], ['infra', 'Infrastructură'], ['security', 'Cyber Security']];
  var TITLES = { erp: ['Panou ERP', 'Compania Demo SRL'], productie: ['Producție', 'Fabrica Cluj · Hala 2'], curierat: ['Curierat', 'MDY Courier Manager'], depozit: ['Depozit', 'WMS · Hala B'], bi: ['BI & Analytics', 'Raport T3 2026'], infra: ['Infrastructură', 'Monitorizare 24/7'], security: ['Cyber Security', 'SOC · MDY'] };
  function icon(g, id, x, y, col) {
    g.save(); g.translate(x, y); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath();
    if (id === 'erp') { g.rect(-7, -7, 6, 6); g.rect(1, -7, 6, 6); g.rect(-7, 1, 6, 6); g.rect(1, 1, 6, 6); }
    else if (id === 'productie') { g.arc(0, 0, 4, 0, 6.2832); for (var a = 0; a < 6; a++) { var c = Math.cos(a * 1.047), s = Math.sin(a * 1.047); g.moveTo(c * 5.5, s * 5.5); g.lineTo(c * 8, s * 8); } }
    else if (id === 'curierat') { g.rect(-8, -5, 10, 8); g.moveTo(2, -2); g.lineTo(6, -2); g.lineTo(8, 1); g.lineTo(8, 3); g.lineTo(2, 3); g.moveTo(-3.5, 6.5); g.arc(-5, 6.5, 1.5, 0, 6.2832); g.moveTo(6.5, 6.5); g.arc(5, 6.5, 1.5, 0, 6.2832); }
    else if (id === 'depozit') { g.moveTo(-8, -3); g.lineTo(0, -8); g.lineTo(8, -3); g.lineTo(8, 7); g.lineTo(-8, 7); g.closePath(); g.moveTo(-4, 7); g.lineTo(-4, 1); g.lineTo(4, 1); g.lineTo(4, 7); }
    else if (id === 'bi') { g.moveTo(-7, 7); g.lineTo(-7, 0); g.moveTo(-2, 7); g.lineTo(-2, -6); g.moveTo(3, 7); g.lineTo(3, -2); g.moveTo(8, 7); g.lineTo(8, -8); }
    else if (id === 'infra') { g.rect(-8, -8, 16, 6); g.rect(-8, 2, 16, 6); g.moveTo(-4, -5); g.lineTo(-3, -5); g.moveTo(-4, 5); g.lineTo(-3, 5); }
    else if (id === 'security') { g.moveTo(0, -8); g.lineTo(7, -5); g.lineTo(7, 0); g.quadraticCurveTo(6, 6, 0, 9); g.quadraticCurveTo(-6, 6, -7, 0); g.lineTo(-7, -5); g.closePath(); g.moveTo(-3, 0); g.lineTo(-1, 2.5); g.lineTo(3.5, -2.5); }
    g.stroke(); g.restore();
  }
  function drawChrome(g, id) {
    g.fillStyle = C.bg; g.fillRect(0, 0, DW, DH);
    var rg = g.createRadialGradient(1180, 60, 0, 1180, 60, 980); rg.addColorStop(0, 'rgba(25,203,211,0.07)'); rg.addColorStop(1, 'rgba(25,203,211,0)');
    g.fillStyle = rg; g.fillRect(0, 0, DW, DH);
    g.fillStyle = 'rgba(143,247,247,0.045)';
    for (var yy = 96; yy < DH; yy += 24) for (var xx = 216; xx < DW; xx += 24) g.fillRect(xx, yy, 1.5, 1.5);
    /* meniu lateral */
    g.fillStyle = C.side; g.fillRect(0, 0, 196, DH); g.fillStyle = C.line; g.fillRect(196, 0, 1, DH);
    var mw = text(g, 'MDY', 28, 56, C.ink, 800, 34, FT);
    text(g, 'SOLUTIONS', 34 + mw, 56, C.teal, 600, 14, FT);
    text(g, 'MODULE', 28, 106, C.muted, 600, 11);
    for (var i = 0; i < NAV.length; i++) {
      var iy = 142 + i * 46, on = NAV[i][0] === id;
      if (on) { rr(g, 14, iy - 25, 168, 38, 9); g.fillStyle = 'rgba(25,203,211,0.12)'; g.fill(); g.fillStyle = C.teal; g.fillRect(14, iy - 17, 3, 22); }
      icon(g, NAV[i][0], 42, iy - 6, on ? C.aqua : C.muted);
      text(g, NAV[i][1], 62, iy - 1, on ? C.ink : C.ink2, on ? 600 : 500, 14);
    }
    rr(g, 14, 852, 168, 76, 10); g.fillStyle = 'rgba(63,214,140,0.07)'; g.fill();
    g.fillStyle = C.green; g.beginPath(); g.arc(34, 880, 4, 0, 6.2832); g.fill();
    text(g, 'Toate sistemele', 46, 885, C.ink, 600, 13); text(g, 'operaționale · 42/42', 28, 910, C.muted, 500, 12);
    /* bara de sus */
    g.fillStyle = C.line; g.fillRect(197, 76, DW - 197, 1);
    var tw = text(g, TITLES[id][0], 228, 50, C.ink, 700, 30, FT);
    text(g, '/  ' + TITLES[id][1], 244 + tw, 49, C.muted, 500, 14);
    rr(g, 1000.5, 22.5, 262, 32, 16); g.fillStyle = 'rgba(255,255,255,0.03)'; g.fill(); g.strokeStyle = C.line; g.stroke();
    g.strokeStyle = C.muted; g.lineWidth = 1.6; g.beginPath(); g.arc(1022, 37, 5.5, 0, 6.2832); g.moveTo(1026, 41); g.lineTo(1030, 45); g.stroke();
    text(g, 'Caută comenzi, clienți, AWB…', 1040, 43, C.muted, 500, 13);
    text(g, '15 sep 2026', 1448, 43, C.ink2, 500, 13, FB, 'right');
    var ag = g.createLinearGradient(1452, 20, 1488, 56); ag.addColorStop(0, C.teal); ag.addColorStop(1, '#2a58d8');
    g.fillStyle = ag; g.beginPath(); g.arc(1486, 38, 18, 0, 6.2832); g.fill();
    text(g, 'AD', 1486, 43, '#04121d', 700, 13, FB, 'center');
  }
  function liveBadge(g, t) {
    var a = 0.55 + 0.45 * Math.sin(t * 3);
    rr(g, 1290, 23, 52, 30, 15); g.fillStyle = 'rgba(63,214,140,0.10)'; g.fill();
    g.fillStyle = hexA(C.green, a); g.beginPath(); g.arc(1306, 38, 4, 0, 6.2832); g.fill();
    text(g, 'Live', 1315, 43, C.green, 600, 12);
  }

  var MODS = {};
  function flashRow(g, x, ry, w, h, f, col) { if (f > 0.01) { g.fillStyle = hexA(col, 0.10 * f); g.fillRect(x, ry, w, h); } }

  /* ---------- ERP ---------- */
  var CLIENTS = ['Agro Nord SRL', 'Profil Metal SA', 'Vitalis Pharma', 'Construct Expert', 'Delta Logistic', 'Nova Food Industries', 'TehnoMob SRL', 'Carpați Distribuție', 'Alpha Retail', 'Clinica Sana'];
  var CITIES = ['Cluj-Napoca', 'Iași', 'București', 'Timișoara', 'Brașov', 'Constanța', 'Oradea', 'Sibiu', 'Craiova', 'Suceava'];
  var ORD_ST = [['Livrat', C.green], ['În tranzit', C.teal], ['Facturat', C.aqua], ['În așteptare', C.amber]];
  var MONTHS = ['Oct', 'Nov', 'Dec', 'Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep'];
  var REV = [], COST = [];
  for (var mm = 0; mm < 12; mm++) { REV.push(4.6 + 0.33 * mm + 0.45 * Math.sin(mm * 1.3)); COST.push(3.8 + 0.17 * mm + 0.28 * Math.sin(mm * 0.9 + 1)); }
  var CH = { x: 288, y: 330, w: 736, h: 236 };
  function chartPt(arr, k, max, ch) { ch = ch || CH; return [ch.x + ch.w * k / (arr.length - 1), ch.y + ch.h - ch.h * arr[k] / max]; }
  function curve(g, arr, max, ch) {
    g.beginPath();
    for (var k = 0; k < arr.length; k++) {
      var q = chartPt(arr, k, max, ch);
      if (k) { var q0 = chartPt(arr, k - 1, max, ch), mx = (q0[0] + q[0]) / 2; g.bezierCurveTo(mx, q0[1], mx, q[1], q[0], q[1]); } else g.moveTo(q[0], q[1]);
    }
  }
  function gridY(g, steps, min, max, dec, ch) {
    ch = ch || CH;
    for (var k = 0; k <= steps; k++) {
      var gy = Math.round(ch.y + ch.h - ch.h * k / steps);
      g.fillStyle = 'rgba(143,247,247,0.06)'; g.fillRect(ch.x, gy, ch.w, 1);
      text(g, (min + (max - min) * k / steps).toFixed(dec).replace('.', ','), ch.x - 12, gy + 4, C.muted, 500, 11, FB, 'right');
    }
  }
  MODS.erp = {
    frame: function (g) {
      var L = ['Comenzi azi', 'Facturi emise', 'Stoc critic', 'Cash-flow 30 zile'];
      for (var i = 0; i < 4; i++) card(g, 228 + i * 323, 100, 307, 132, L[i]);
      card(g, 228, 248, 820, 380, 'Venituri vs. costuri', 'Ultimele 12 luni · mil. lei');
      gridY(g, 4, 0, 10, 1);
      for (var k = 0; k < 12; k++) text(g, MONTHS[k], CH.x + CH.w * k / 11, CH.y + CH.h + 30, C.muted, 500, 11, FB, 'center');
      g.fillStyle = C.teal; g.fillRect(248, 304, 12, 3); text(g, 'Venituri', 266, 310, C.ink2, 500, 12);
      g.fillStyle = C.blue; g.fillRect(338, 304, 12, 3); text(g, 'Costuri', 356, 310, C.ink2, 500, 12);
      card(g, 1064, 248, 440, 380, 'Flux comenzi', 'Azi');
      g.fillStyle = C.line; g.fillRect(1084, 580, 400, 1);
      text(g, 'Timp mediu de procesare', 1084, 606, C.muted, 500, 12); text(g, '3 h 12 min', 1484, 607, C.ink2, 600, 13, FB, 'right');
      card(g, 228, 644, 1276, 284, 'Comenzi recente', 'Actualizat live');
      var H = [['NR. COMANDĂ', 248, 'left'], ['CLIENT', 420, 'left'], ['ORAȘ', 720, 'left'], ['VALOARE', 1040, 'right'], ['STATUS', 1120, 'left'], ['ACTUALIZAT', 1484, 'right']];
      for (k = 0; k < H.length; k++) text(g, H[k][0], H[k][1], 706, C.muted, 600, 11, FB, H[k][2]);
      g.fillStyle = C.line; g.fillRect(248, 720, 1236, 1);
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var e = ease(lt / 0.9), i;
      var vals = [fmt((1284 + Math.floor(t / 2.8)) * e), fmt((946 + Math.floor(t / 4.3)) * e), fmt(23 * e), (4.82 * e).toFixed(2).replace('.', ',')];
      var dl = [['+12,4% față de ieri', C.green], ['+8,1% săptămâna aceasta', C.green], ['−5 față de ieri', C.amber], ['+3,6% față de august', C.green]];
      for (i = 0; i < 4; i++) {
        var x = 228 + i * 323, w = text(g, vals[i], x + 20, 190, C.ink, 700, 42, FT);
        if (i === 3) text(g, 'mil. lei', x + 28 + w, 190, C.muted, 500, 13);
        text(g, dl[i][0], x + 20, 216, dl[i][1], 600, 12);
        spark(g, x + 198, 150, 90, 42, i * 1.7 + 0.4, t, i === 2 ? C.amber : C.teal);
      }
      var p = ease(lt / 1.4);
      g.save(); g.beginPath(); g.rect(CH.x - 4, CH.y - 24, (CH.w + 8) * p, CH.h + 28); g.clip();
      [[COST, C.blue, 0.08], [REV, C.teal, 0.26]].forEach(function (s) {
        curve(g, s[0], 10); g.lineWidth = 2.5; g.strokeStyle = s[1]; g.lineJoin = 'round'; g.stroke();
        g.lineTo(CH.x + CH.w, CH.y + CH.h); g.lineTo(CH.x, CH.y + CH.h); g.closePath();
        var grd = g.createLinearGradient(0, CH.y, 0, CH.y + CH.h); grd.addColorStop(0, hexA(s[1], s[2])); grd.addColorStop(1, hexA(s[1], 0)); g.fillStyle = grd; g.fill();
      });
      g.restore();
      if (lt > 1.5) {
        var u = ((t * 0.07) % 1) * 11, k0 = Math.floor(u), f = u - k0, k1 = Math.min(11, k0 + 1), sm = f * f * (3 - 2 * f);
        var a = chartPt(REV, k0, 10), b = chartPt(REV, k1, 10), cx = a[0] + (b[0] - a[0]) * f, cy = a[1] + (b[1] - a[1]) * sm;
        g.strokeStyle = 'rgba(143,247,247,0.25)'; g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(Math.round(cx) + 0.5, CH.y); g.lineTo(Math.round(cx) + 0.5, CH.y + CH.h); g.stroke(); g.setLineDash([]);
        g.fillStyle = hexA(C.aqua, 0.18); g.beginPath(); g.arc(cx, cy, 11, 0, 6.2832); g.fill();
        g.fillStyle = C.aqua; g.beginPath(); g.arc(cx, cy, 4.5, 0, 6.2832); g.fill();
        var val = REV[k0] + (REV[k1] - REV[k0]) * sm, bx = clamp(cx - 72, CH.x, CH.x + CH.w - 144), by = cy - 66 < CH.y - 24 ? cy + 18 : cy - 66;
        rr(g, bx + 0.5, by + 0.5, 144, 48, 8); g.fillStyle = 'rgba(6,16,27,0.94)'; g.fill(); g.strokeStyle = C.line; g.stroke();
        var mi = Math.round(u);
        text(g, MONTHS[mi] + (mi < 3 ? ' 2025' : ' 2026'), bx + 12, by + 19, C.muted, 500, 11);
        text(g, val.toFixed(2).replace('.', ',') + ' mil. lei', bx + 12, by + 39, C.ink, 700, 18, FT);
      }
      var FL = [['Primite', 312, C.aqua], ['În procesare', 148, C.teal], ['Pregătite de livrare', 96, C.blue], ['Livrate', 728, C.green]];
      for (i = 0; i < 4; i++) {
        var fy = 322 + i * 64, fv = FL[i][1] + Math.round(3 * Math.sin(t * 0.6 + i * 2));
        text(g, FL[i][0], 1084, fy, C.ink2, 500, 14);
        text(g, fmt(fv * ease(lt / 1)), 1484, fy + 2, C.ink, 700, 24, FT, 'right');
        bar(g, 1084, fy + 14, 400, 6, fv / 800 * ease((lt - i * 0.1) / 1), FL[i][2]);
      }
      feed(g, 228, 724, 1276, 5, 40, 2.6, t, function (idx, ry, flash, r) {
        var y = ry + 26, st = ORD_ST[Math.floor(rnd(idx * 7.3) * 4)];
        flashRow(g, 229, ry, 1274, 40, flash, C.teal);
        text(g, 'CMD-' + (47210 + idx), 248, y, C.ink2, 600, 13);
        text(g, CLIENTS[Math.floor(rnd(idx * 3.1) * 10)], 420, y, C.ink, 500, 14);
        text(g, CITIES[Math.floor(rnd(idx * 5.7) * 10)], 720, y, C.ink2, 500, 13);
        text(g, fmt(1200 + rnd(idx * 9.1) * 48000) + ' lei', 1040, y, C.ink, 600, 14, FB, 'right');
        pill(g, 1120, y + 1, st[0], st[1]);
        text(g, r <= 1 ? 'acum' : 'acum ' + (r - 1) * 3 + ' min', 1484, y, C.muted, 500, 12, FB, 'right');
        g.fillStyle = 'rgba(143,247,247,0.05)'; g.fillRect(248, Math.round(ry + 40), 1236, 1);
      });
    }
  };

  /* ---------- Producție ---------- */
  var LINES = [['Linia 1 · Extrudare', 'Profil aluminiu 6063', 1200, 0.7, 'Rulează', C.green], ['Linia 2 · Debitare CNC', 'Panou compozit 4 mm', 860, 0.42, 'Schimbare format', C.amber], ['Linia 3 · Asamblare', 'Carcasă tablou electric', 320, 0.88, 'Rulează', C.green]];
  var WORK = [['CL-0412', 'Profil aluminiu 6063', '1.200 buc', 0.64], ['CL-0413', 'Panou compozit 4 mm', '860 buc', 0.38], ['CL-0415', 'Carcasă tablou electric', '320 buc', 0.91], ['CL-0416', 'Suport metalic M8', '4.500 buc', 0.22], ['CL-0418', 'Ramă fereastră PVC', '640 buc', 0.07]];
  MODS.productie = {
    frame: function (g) {
      card(g, 228, 100, 400, 380, 'OEE general', 'Liniile 1–3');
      g.lineCap = 'round'; g.lineWidth = 14; g.strokeStyle = 'rgba(143,247,247,0.08)';
      g.beginPath(); g.arc(428, 292, 108, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); g.lineCap = 'butt';
      var sub = ['Disponibilitate', 'Performanță', 'Calitate'];
      for (var i = 0; i < 3; i++) text(g, sub[i], 300 + i * 128, 432, C.muted, 500, 12, FB, 'center');
      card(g, 644, 100, 860, 380, 'Linii de producție', 'Schimbul II · 14:00–22:00');
      for (i = 0; i < 3; i++) { var ry = 172 + i * 98; text(g, LINES[i][0], 664, ry, C.ink, 600, 15); text(g, LINES[i][1], 664, ry + 22, C.muted, 500, 13); }
      card(g, 228, 496, 820, 432, 'Comenzi de lucru', 'Azi · 5 active');
      for (i = 0; i < 5; i++) {
        var wy = 580 + i * 68;
        text(g, WORK[i][0], 248, wy, C.ink2, 600, 13); text(g, WORK[i][1], 360, wy, C.ink, 500, 14); text(g, WORK[i][2], 720, wy, C.muted, 500, 13, FB, 'right');
        if (i) { g.fillStyle = 'rgba(143,247,247,0.05)'; g.fillRect(248, wy - 40, 780, 1); }
      }
      card(g, 1064, 496, 440, 432, 'Încărcare pe schimburi', 'ore');
      var sh = ['Schimb I', 'Schimb II', 'Schimb III'];
      for (i = 0; i < 3; i++) text(g, sh[i], 1084, 606 + i * 84, C.ink2, 500, 13);
      for (var c = 0; c < 8; c++) text(g, String((6 + c * 2) % 24).padStart(2, '0'), 1175 + c * 40 + 16, 832, C.muted, 500, 11, FB, 'center');
      g.fillStyle = C.line; g.fillRect(1084, 856, 400, 1);
      text(g, 'Încărcare medie', 1084, 890, C.muted, 500, 12);
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var oee = 87 * ease(lt / 1.3) + 0.4 * Math.sin(t * 0.8), a0 = Math.PI * 0.75, a1 = a0 + Math.PI * 1.5 * oee / 100;
      var grd = g.createLinearGradient(320, 0, 536, 0); grd.addColorStop(0, C.teal); grd.addColorStop(1, C.aqua);
      g.lineCap = 'round'; g.lineWidth = 14; g.strokeStyle = grd; g.beginPath(); g.arc(428, 292, 108, a0, a1); g.stroke(); g.lineCap = 'butt';
      var kx = 428 + Math.cos(a1) * 108, ky = 292 + Math.sin(a1) * 108;
      g.fillStyle = hexA(C.aqua, 0.22); g.beginPath(); g.arc(kx, ky, 15, 0, 6.2832); g.fill();
      g.fillStyle = '#eaffff'; g.beginPath(); g.arc(kx, ky, 6, 0, 6.2832); g.fill();
      text(g, Math.round(oee) + '%', 428, 306, C.ink, 700, 60, FT, 'center');
      text(g, 'țintă 85%', 428, 334, C.green, 600, 12, FB, 'center');
      var sv = [94, 95, 97];
      for (var i = 0; i < 3; i++) text(g, Math.round(sv[i] * ease(lt / 1.1)) + '%', 300 + i * 128, 462, C.ink, 700, 24, FT, 'center');
      for (i = 0; i < 3; i++) {
        var L = LINES[i], ry = 172 + i * 98, prog = clamp(L[3] + ((t * 0.006 + i * 0.1) % 0.12), 0, 1) * ease((lt - i * 0.12) / 1.1);
        pill(g, 1484, ry, L[4], L[5], true);
        text(g, fmt(prog * L[2]) + ' / ' + fmt(L[2]) + ' buc', 1484, ry + 24, C.ink2, 500, 13, FB, 'right');
        bar(g, 664, ry + 40, 820, 8, prog, i === 1 ? C.amber : C.teal);
        if (i !== 1) {
          var sx = 664 + 820 * prog * ((t * 0.35 + i * 0.3) % 1);
          var sg = g.createLinearGradient(sx - 60, 0, sx, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,0.45)');
          g.save(); rr(g, 664, ry + 40, Math.max(8, 820 * prog), 8, 4); g.clip(); g.fillStyle = sg; g.fillRect(sx - 60, ry + 40, 60, 8); g.restore();
        }
      }
      for (i = 0; i < 5; i++) {
        var wy = 580 + i * 68, wp = clamp(WORK[i][3] + (i === 0 ? (t * 0.004) % 0.2 : 0), 0, 1) * ease((lt - i * 0.08) / 1);
        bar(g, 760, wy - 6, 200, 6, wp, WORK[i][3] > 0.85 ? C.green : C.teal);
        text(g, Math.round(wp * 100) + '%', 1028, wy, C.ink, 600, 13, FB, 'right');
      }
      var tot = 0;
      for (var r = 0; r < 3; r++) for (var c = 0; c < 8; c++) {
        var v = clamp(0.3 + 0.62 * rnd(r * 8 + c + 3) + 0.06 * Math.sin(t * 1.1 + r * 2 + c), 0, 1) * ease((lt - c * 0.05) / 0.8);
        tot += v;
        rr(g, 1175 + c * 40, 566 + r * 84, 34, 64, 6); g.fillStyle = hexA(C.teal, 0.1 + 0.72 * v); g.fill();
        if (r === 1 && c === 4) { g.strokeStyle = C.aqua; g.lineWidth = 1.5; rr(g, 1175.5 + c * 40, 566.5 + r * 84, 33, 63, 6); g.stroke(); }
      }
      text(g, Math.round(tot / 24 * 100) + '%', 1484, 892, C.ink, 700, 26, FT, 'right');
    }
  };

  /* ---------- Curierat ---------- */
  var MAP = { x: 300, y: 150, w: 690, h: 470 };
  var RO = [[0.05, 0.36], [0.15, 0.2], [0.3, 0.13], [0.45, 0.06], [0.6, 0.02], [0.73, 0.07], [0.8, 0.2], [0.86, 0.36], [0.95, 0.52], [1.0, 0.63], [0.94, 0.72], [0.85, 0.74], [0.8, 0.86], [0.62, 0.92], [0.46, 0.96], [0.3, 0.92], [0.18, 0.8], [0.08, 0.66], [0.0, 0.52]];
  var HUBS = [['București', 0.72, 0.78], ['Cluj-Napoca', 0.36, 0.31], ['Iași', 0.84, 0.22], ['Timișoara', 0.09, 0.56], ['Constanța', 0.93, 0.76], ['Brașov', 0.6, 0.55], ['Craiova', 0.39, 0.84], ['Oradea', 0.14, 0.29], ['Suceava', 0.7, 0.1]];
  function mp(u, v) { return [MAP.x + MAP.w * u, MAP.y + MAP.h * v]; }
  function route(j) {
    var a = mp(HUBS[0][1], HUBS[0][2]), b = mp(HUBS[j][1], HUBS[j][2]);
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = (j % 2 ? 1 : -1) * len * 0.18;
    return [a, [mx - dy / len * k, my + dx / len * k], b];
  }
  function qpt(r, u) { var v = 1 - u; return [v * v * r[0][0] + 2 * v * u * r[1][0] + u * u * r[2][0], v * v * r[0][1] + 2 * v * u * r[1][1] + u * u * r[2][1]]; }
  var AWB_ST = [['Ridicat', C.aqua], ['În tranzit', C.teal], ['Livrat', C.green], ['Livrat', C.green], ['În livrare', C.amber]];
  var COURIERS = ['A. Pop', 'M. Ionescu', 'R. Dumitru', 'I. Stan', 'C. Marin', 'D. Georgescu', 'L. Matei'];
  MODS.curierat = {
    frame: function (g) {
      card(g, 228, 100, 820, 560, 'Hartă livrări', 'Live · 58 curieri pe traseu');
      var path = new Path2D(), i;
      for (i = 0; i < RO.length; i++) { var q = mp(RO[i][0], RO[i][1]); if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]); }
      path.closePath();
      g.fillStyle = 'rgba(143,247,247,0.3)'; var sk = g.getTransform ? g.getTransform().a : 1;
      for (var yy = MAP.y; yy <= MAP.y + MAP.h; yy += 11) for (var xx = MAP.x; xx <= MAP.x + MAP.w; xx += 11) if (g.isPointInPath(path, xx * sk, yy * sk)) g.fillRect(xx - 1.2, yy - 1.2, 2.6, 2.6);
      g.lineWidth = 1.5;
      for (i = 1; i < HUBS.length; i++) { var r = route(i); g.strokeStyle = 'rgba(25,203,211,0.22)'; g.beginPath(); g.moveTo(r[0][0], r[0][1]); g.quadraticCurveTo(r[1][0], r[1][1], r[2][0], r[2][1]); g.stroke(); }
      for (i = 0; i < HUBS.length; i++) {
        var h = mp(HUBS[i][1], HUBS[i][2]);
        g.fillStyle = i ? C.teal : C.amber; g.beginPath(); g.arc(h[0], h[1], i ? 4 : 6, 0, 6.2832); g.fill();
        text(g, HUBS[i][0], h[0] + (HUBS[i][1] > 0.85 ? -10 : 10), h[1] - 10, i ? C.ink2 : C.ink, i ? 500 : 700, i ? 12 : 13, FB, HUBS[i][1] > 0.85 ? 'right' : 'left');
      }
      card(g, 1064, 100, 440, 172, 'AWB livrate azi');
      card(g, 1064, 288, 440, 172, 'Livrare la timp');
      card(g, 1064, 476, 440, 184, 'Colete în tranzit');
      card(g, 228, 676, 1276, 252, 'Status live', 'Actualizări în timp real');
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var i, m, rev = ease(lt / 1.2);
      for (i = 1; i < HUBS.length; i++) {
        var r = route(i);
        for (m = 0; m < 2; m++) {
          var u = (t * 0.07 + i * 0.13 + m * 0.5) % 1; if (m) u = 1 - u;
          if (u > rev) continue;
          var q = qpt(r, u);
          g.fillStyle = hexA(C.aqua, 0.2); g.beginPath(); g.arc(q[0], q[1], 8, 0, 6.2832); g.fill();
          g.fillStyle = '#dffcff'; g.beginPath(); g.arc(q[0], q[1], 3, 0, 6.2832); g.fill();
        }
      }
      for (i = 0; i < HUBS.length; i++) {
        var h = mp(HUBS[i][1], HUBS[i][2]), ph = (t * 0.45 + i * 0.37) % 1;
        g.strokeStyle = hexA(i ? C.teal : C.amber, (1 - ph) * 0.6); g.lineWidth = 1.5;
        g.beginPath(); g.arc(h[0], h[1], 6 + ph * (i ? 20 : 30), 0, 6.2832); g.stroke();
      }
      var e = ease(lt / 0.9);
      text(g, fmt((1842 + Math.floor(t / 1.7)) * e), 1084, 214, C.ink, 700, 56, FT);
      text(g, '+9% față de ieri · 1.690', 1084, 246, C.green, 600, 13);
      spark(g, 1330, 170, 154, 56, 2.2, t, C.teal);
      text(g, (96.4 * e).toFixed(1).replace('.', ',') + '%', 1084, 402, C.ink, 700, 56, FT);
      bar(g, 1084, 424, 400, 8, 0.964 * e, C.green);
      var tr = 416 + Math.round(4 * Math.sin(t * 0.5));
      text(g, fmt(tr * e), 1084, 590, C.ink, 700, 56, FT);
      var reg = [['Nord-Vest', 128, C.teal], ['Sud', 97, C.blue], ['Est', 191, C.aqua]], bx = 1084;
      for (i = 0; i < 3; i++) { var bw = 400 * reg[i][1] / 416 * e - 4; rr(g, bx, 612, Math.max(4, bw), 8, 4); g.fillStyle = reg[i][2]; g.fill(); text(g, reg[i][0] + ' ' + reg[i][1], bx, 644, C.muted, 500, 11); bx += bw + 4; }
      feed(g, 228, 716, 1276, 4, 50, 2.2, t, function (idx, ry, flash) {
        var y = ry + 31, st = AWB_ST[Math.floor(rnd(idx * 4.1) * 5)];
        flashRow(g, 229, ry, 1274, 50, flash, C.aqua);
        text(g, 'MDY-' + (7781204 + idx * 37), 248, y, C.ink2, 600, 13);
        text(g, CITIES[Math.floor(rnd(idx * 2.3) * 10)] + ' → ' + CITIES[Math.floor(rnd(idx * 6.1) * 10)], 430, y, C.ink, 500, 14);
        text(g, 'Curier: ' + COURIERS[Math.floor(rnd(idx * 8.7) * 7)], 760, y, C.ink2, 500, 13);
        pill(g, 980, y + 1, st[0], st[1]);
        text(g, 'ETA ' + (13 + Math.floor(rnd(idx) * 6)) + ':' + String(Math.floor(rnd(idx * 1.9) * 6) * 10).padStart(2, '0'), 1484, y, C.muted, 500, 13, FB, 'right');
        g.fillStyle = 'rgba(143,247,247,0.05)'; g.fillRect(248, Math.round(ry + 50), 1236, 1);
      });
    }
  };

  /* ---------- Depozit (WMS) ---------- */
  var PICK = [['PK-2291', 'CMD-48231 · 14 linii', 'M. Ionescu', 0.72], ['PK-2292', 'CMD-48236 · 6 linii', 'A. Pop', 0.35], ['PK-2294', 'CMD-48240 · 22 linii', 'I. Stan', 0.12], ['PK-2295', 'CMD-48244 · 3 linii', 'C. Marin', 0], ['PK-2297', 'CMD-48251 · 9 linii', 'L. Matei', 0]];
  var ZONES = [['Recepție', 184], ['Zona A · Rapidă', 612], ['Zona B · Paletizat', 948], ['Zona C · Frig', 236], ['Expediție', 298]];
  MODS.depozit = {
    frame: function (g) {
      card(g, 228, 100, 820, 500, 'Ocupare rafturi', 'Hala B · rândurile A–F');
      for (var c = 0; c < 6; c++) {
        var rx = 262 + c * 128;
        for (var l = 0; l < 8; l++) for (var b = 0; b < 3; b++) { rr(g, rx + b * 36 + 0.5, 150 + l * 46 + 0.5, 32, 38, 4); g.strokeStyle = 'rgba(143,247,247,0.09)'; g.lineWidth = 1; g.stroke(); }
        text(g, 'Rând ' + 'ABCDEF'[c], rx + 52, 530, C.ink2, 600, 12, FB, 'center');
      }
      g.fillStyle = hexA(C.teal, 0.6); g.fillRect(262, 562, 10, 10); text(g, 'Ocupat', 278, 572, C.muted, 500, 12);
      g.fillStyle = C.amber; g.fillRect(350, 562, 10, 10); text(g, 'Picking', 366, 572, C.muted, 500, 12);
      g.fillStyle = C.aqua; g.fillRect(436, 562, 10, 10); text(g, 'Recepție', 452, 572, C.muted, 500, 12);
      card(g, 1064, 100, 440, 500, 'Coadă picking', '5 sarcini active');
      for (var i = 0; i < 5; i++) {
        var py = 172 + i * 84;
        text(g, PICK[i][0], 1084, py, C.ink, 600, 14); text(g, PICK[i][2], 1484, py, C.ink2, 500, 13, FB, 'right');
        text(g, PICK[i][1], 1084, py + 22, C.muted, 500, 12);
      }
      card(g, 228, 616, 1276, 312, 'Stoc pe zone', 'paleți');
      for (i = 0; i < 5; i++) text(g, ZONES[i][0], 248, 690 + i * 46, C.ink2, 500, 14);
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var occ = 0, pickCell = Math.floor(t / 1.4);
      for (var c = 0; c < 6; c++) for (var l = 0; l < 8; l++) for (var b = 0; b < 3; b++) {
        var id = c * 100 + l * 10 + b, x = 262 + c * 128 + b * 36, y = 150 + l * 46;
        var full = rnd(id + 0.5) < 0.8, e = ease((lt - (7 - l) * 0.06 - c * 0.03) / 0.5);
        var isPick = Math.floor(rnd(pickCell * 3 + c) * 6) === c && (l * 3 + b) === Math.floor(rnd(pickCell + c * 7) * 24);
        var isIn = (Math.floor(t / 2.3) % 144) === (c * 24 + l * 3 + b) % 144;
        if (full) occ++;
        if (!full && !isIn) continue;
        rr(g, x + 2, y + 2 + 34 * (1 - e), 28, 34 * e, 3);
        g.fillStyle = isPick ? hexA(C.amber, 0.55 + 0.4 * Math.sin(t * 8)) : (isIn ? hexA(C.aqua, 0.5 + 0.4 * Math.sin(t * 6)) : hexA(C.teal, 0.28 + 0.3 * rnd(id * 1.7)));
        g.fill();
      }
      text(g, Math.round(occ / 144 * 100 * ease(lt / 1)) + '%', 1028, 572, C.ink, 700, 30, FT, 'right');
      text(g, 'ocupare', 1028 - 58, 572, C.muted, 500, 12, FB, 'right');
      for (var i = 0; i < 5; i++) {
        var py = 172 + i * 84, pv = i === 0 ? clamp(PICK[0][3] + (t * 0.02) % 0.28, 0, 1) : (i === 1 ? PICK[1][3] + (t * 0.01) % 0.3 : PICK[i][3]);
        bar(g, 1084, py + 38, 340, 6, pv * ease((lt - i * 0.1) / 0.9), pv > 0.9 ? C.green : C.amber);
        text(g, pv > 0 ? Math.round(pv * 100) + '%' : 'În așteptare', 1484, py + 45, pv > 0 ? C.ink : C.muted, 600, 12, FB, 'right');
      }
      for (i = 0; i < 5; i++) {
        var v = ZONES[i][1] + Math.round(3 * Math.sin(t * 0.4 + i));
        bar(g, 460, 680 + i * 46, 880, 10, v / 1000 * ease((lt - i * 0.08) / 1), i === 3 ? C.blue : (i === 2 ? C.aqua : C.teal));
        text(g, fmt(v) + ' paleți', 1484, 691 + i * 46, C.ink, 600, 14, FB, 'right');
      }
    }
  };

  /* ---------- BI & Analytics ---------- */
  var CHAN = [['Distribuție', 0.46, C.teal], ['Online', 0.28, C.aqua], ['Retail', 0.16, C.blue], ['Export', 0.10, C.amber]];
  var REG = [['Nord-Vest', [1.6, 1.8, 2.1]], ['Centru', [1.4, 1.5, 1.7]], ['Nord-Est', [1.1, 1.4, 1.8]], ['Sud-Est', [1.2, 1.3, 1.4]], ['Sud', [0.9, 1.0, 1.2]], ['București', [2.4, 2.6, 2.9]], ['Vest', [1.3, 1.4, 1.6]]];
  var MARG = [14.2, 14.8, 14.1, 15.3, 15.9, 15.6, 16.4, 16.8, 17.3, 17.1, 17.9, 18.6];
  var CM = { x: 290, y: 600, w: 720, h: 250 };
  var BARS = { x: 690, y: 170, w: 790, h: 270 };
  MODS.bi = {
    frame: function (g) {
      card(g, 228, 100, 400, 400, 'Vânzări pe canale', 'T3 2026');
      g.lineWidth = 26; g.strokeStyle = 'rgba(143,247,247,0.06)'; g.beginPath(); g.arc(428, 272, 94, 0, 6.2832); g.stroke();
      for (var i = 0; i < 4; i++) {
        var lx = 256 + (i % 2) * 190, ly = 424 + Math.floor(i / 2) * 32;
        g.fillStyle = CHAN[i][2]; g.beginPath(); g.arc(lx, ly - 4, 5, 0, 6.2832); g.fill();
        text(g, CHAN[i][0], lx + 14, ly, C.ink2, 500, 13); text(g, Math.round(CHAN[i][1] * 100) + '%', lx + 160, ly, C.ink, 600, 13, FB, 'right');
      }
      card(g, 644, 100, 860, 400, 'Venituri pe regiuni', 'mil. lei');
      var LG = [['T1', '#2a5aa8'], ['T2', C.teal], ['T3', C.aqua]];
      for (i = 0; i < 3; i++) { g.fillStyle = LG[i][1]; g.fillRect(1260 + i * 60, 124, 10, 10); text(g, LG[i][0], 1276 + i * 60, 134, C.ink2, 500, 12); }
      gridY(g, 3, 0, 3, 0, BARS);
      for (i = 0; i < REG.length; i++) text(g, REG[i][0], BARS.x + BARS.w * (i + 0.5) / REG.length, BARS.y + BARS.h + 28, C.muted, 500, 12, FB, 'center');
      card(g, 228, 516, 820, 412, 'Marja operațională', '12 luni · %');
      gridY(g, 4, 12, 20, 0, CM);
      for (i = 0; i < 12; i++) text(g, MONTHS[i], CM.x + CM.w * i / 11, CM.y + CM.h + 28, C.muted, 500, 11, FB, 'center');
      card(g, 1064, 516, 440, 412, 'Insight', 'generat acum 2 min');
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var sweep = ease(lt / 1.3), a = -Math.PI / 2, hi = Math.floor(t / 2.2) % 4, i;
      for (i = 0; i < 4; i++) {
        var da = CHAN[i][1] * Math.PI * 2 * sweep;
        g.lineWidth = hi === i ? 34 : 26; g.strokeStyle = CHAN[i][2];
        g.beginPath(); g.arc(428, 272, 94, a + 0.02, a + da - 0.02); g.stroke(); a += da;
      }
      text(g, (12.6 * ease(lt / 1)).toFixed(1).replace('.', ','), 428, 280, C.ink, 700, 42, FT, 'center');
      text(g, 'mil. lei', 428, 304, C.muted, 500, 12, FB, 'center');
      var bw = BARS.w / REG.length, cols = ['#2a5aa8', C.teal, C.aqua];
      for (i = 0; i < REG.length; i++) for (var q = 0; q < 3; q++) {
        var v = REG[i][1][q] * ease((lt - i * 0.06 - q * 0.05) / 0.9) * (q === 2 ? 1 + 0.015 * Math.sin(t * 1.5 + i) : 1);
        var h = BARS.h * v / 3, x = BARS.x + i * bw + bw * 0.2 + q * bw * 0.21;
        rr(g, x, BARS.y + BARS.h - h, bw * 0.18, Math.max(2, h), 3); g.fillStyle = cols[q]; g.fill();
      }
      var p = ease(lt / 1.5);
      g.save(); g.beginPath(); g.rect(CM.x - 6, CM.y - 40, (CM.w + 12) * p, CM.h + 46); g.clip();
      g.save(); g.translate(0, 0);
      var norm = MARG.map(function (m) { return m - 12; });
      curve(g, norm, 8, CM); g.lineWidth = 3; g.strokeStyle = C.aqua; g.stroke();
      g.lineTo(CM.x + CM.w, CM.y + CM.h); g.lineTo(CM.x, CM.y + CM.h); g.closePath();
      var grd = g.createLinearGradient(0, CM.y, 0, CM.y + CM.h); grd.addColorStop(0, hexA(C.aqua, 0.2)); grd.addColorStop(1, hexA(C.aqua, 0)); g.fillStyle = grd; g.fill();
      g.restore();
      for (i = 0; i < 12; i++) { var pt = chartPt(norm, i, 8, CM); g.fillStyle = '#06101b'; g.beginPath(); g.arc(pt[0], pt[1], 4, 0, 6.2832); g.fill(); g.strokeStyle = C.aqua; g.lineWidth = 2; g.stroke(); }
      g.restore();
      if (lt > 1.4) {
        var last = chartPt(norm, 11, 8, CM), pr = 0.5 + 0.5 * Math.sin(t * 3);
        g.fillStyle = hexA(C.aqua, 0.15 + 0.15 * pr); g.beginPath(); g.arc(last[0], last[1], 12 + 4 * pr, 0, 6.2832); g.fill();
        rr(g, last[0] - 74, last[1] - 50, 70, 30, 8); g.fillStyle = C.aqua; g.fill();
        text(g, '18,6%', last[0] - 39, last[1] - 29, '#04121d', 700, 18, FT, 'center');
      }
      g.fillStyle = C.teal; g.save(); g.translate(1100, 590);
      g.beginPath(); for (i = 0; i < 8; i++) { var rad = i % 2 ? 4 : 12, an = i * Math.PI / 4 + t * 0.4; g.lineTo(Math.cos(an) * rad, Math.sin(an) * rad); } g.closePath(); g.fill(); g.restore();
      text(g, 'Analiză automată', 1124, 596, C.teal, 600, 13);
      g.font = '600 21px ' + FB;
      var s1 = 'Marja operațională a crescut cu 2,3 pp după automatizarea facturării.', n = Math.floor(s1.length * ease((lt - 0.4) / 1.6));
      var lines = wrap(g, s1, 390), used = 0;
      for (i = 0; i < lines.length; i++) { var part = lines[i].slice(0, Math.max(0, n - used)); used += lines[i].length + 1; text(g, part, 1084, 650 + i * 32, C.ink, 600, 21); }
      g.font = '500 15px ' + FB;
      var l2 = wrap(g, 'Nord-Est are cel mai rapid ritm de creștere: +18% față de T2. Recomandare: stoc suplimentar în depozitul Iași.', 390);
      g.globalAlpha = ease((lt - 2.0) / 0.6);
      for (i = 0; i < l2.length; i++) text(g, l2[i], 1084, 770 + i * 24, C.ink2, 500, 15);
      rr(g, 1084, 866, 150, 36, 18); g.fillStyle = 'rgba(25,203,211,0.14)'; g.fill();
      text(g, 'Vezi raportul  →', 1159, 889, C.aqua, 600, 13, FB, 'center');
      g.globalAlpha = 1;
    }
  };

  /* ---------- Infrastructură & Cloud ---------- */
  var UNITS = ['fw-edge-01', 'sw-core-01', 'sw-core-02', 'srv-erp-01', 'srv-erp-02', 'srv-db-01', 'srv-db-02', 'srv-app-01', 'srv-app-02', 'srv-bi-01', 'srv-mail-01', 'srv-file-01', 'backup-nas-01', 'backup-nas-02', 'ups-01'];
  var EVENTS = [['Backup incremental finalizat', 'srv-db-01', C.green], ['Patch de securitate aplicat pe 12 servere', 'WSUS', C.teal], ['Failover testat cu succes', 'srv-erp-02', C.green], ['Certificat SSL reînnoit', 'portal.mdy', C.aqua], ['Alertă CPU rezolvată automat', 'srv-bi-01', C.amber], ['Replicare offsite sincronizată', 'backup-nas-02', C.green]];
  var RES = { x: 784, y: 330, w: 700, h: 250 };
  MODS.infra = {
    frame: function (g) {
      card(g, 228, 100, 520, 828, 'Rack principal', 'DC București · R-04');
      rr(g, 256, 146, 464, 760, 10); g.fillStyle = '#060e17'; g.fill(); g.strokeStyle = 'rgba(143,247,247,0.12)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(143,247,247,0.08)'; g.fillRect(272, 158, 2, 736); g.fillRect(702, 158, 2, 736);
      for (var i = 0; i < UNITS.length; i++) {
        var uy = 164 + i * 49;
        var ug = g.createLinearGradient(0, uy, 0, uy + 40); ug.addColorStop(0, '#12212f'); ug.addColorStop(1, '#0c1823');
        rr(g, 282, uy, 412, 40, 5); g.fillStyle = ug; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.05)'; g.stroke();
        text(g, UNITS[i], 344, uy + 25, C.ink2, 500, 13);
        g.fillStyle = 'rgba(255,255,255,0.05)'; for (var v = 0; v < 9; v++) g.fillRect(468 + v * 7, uy + 12, 3, 16);
      }
      var T = ['Uptime 30 zile', 'Ultimul backup', 'Servere active'];
      for (i = 0; i < 3; i++) card(g, 764 + i * 252, 100, 236, 132, T[i]);
      card(g, 764, 248, 740, 360, 'Resurse în timp real');
      gridY(g, 4, 0, 100, 0, RES);
      card(g, 764, 624, 740, 304, 'Evenimente', 'Ultima oră');
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var i, e = ease(lt / 0.9);
      for (i = 0; i < UNITS.length; i++) {
        var uy = 164 + i * 49, on = rnd(i * 13 + Math.floor(t * (6 + rnd(i) * 10))) > 0.35;
        g.fillStyle = C.green; g.beginPath(); g.arc(300, uy + 20, 3.5, 0, 6.2832); g.fill();
        g.fillStyle = on ? C.aqua : 'rgba(143,247,247,0.18)'; g.beginPath(); g.arc(316, uy + 20, 3, 0, 6.2832); g.fill();
        var load = clamp(wave(t * 0.25 + i * 1.3, i) * 0.9, 0.05, 1) * e;
        bar(g, 548, uy + 17, 130, 6, load, load > 0.75 ? C.amber : C.teal);
      }
      var sy = 164 + ((t * 90) % 740);
      var sg = g.createLinearGradient(0, sy - 40, 0, sy); sg.addColorStop(0, 'rgba(143,247,247,0)'); sg.addColorStop(1, 'rgba(143,247,247,0.06)');
      g.fillStyle = sg; g.fillRect(282, sy - 40, 412, 40);
      text(g, (99.98 * e).toFixed(2).replace('.', ',') + '%', 784, 190, C.ink, 700, 40, FT); text(g, 'SLA garantat 99,9%', 784, 216, C.green, 600, 12);
      text(g, '03:00', 1036, 190, C.ink, 700, 40, FT); text(g, 'Verificat · 1,2 TB', 1036, 216, C.green, 600, 12);
      text(g, Math.round(42 * e) + ' / 42', 1288, 190, C.ink, 700, 40, FT); text(g, 'Toate online', 1288, 216, C.green, 600, 12);
      var S = [['CPU', C.teal, 0.4, 34], ['RAM', C.blue, 1.9, 61], ['Rețea', C.amber, 3.1, 48]], n = 48, step = RES.w / (n - 1), sh = t * 3, base = Math.floor(sh), fr = sh - base, lx = 1484;
      g.save(); g.beginPath(); g.rect(RES.x, RES.y - 10, RES.w, RES.h + 12); g.clip();
      for (var s = 0; s < 3; s++) {
        g.beginPath();
        for (var k = 0; k <= n; k++) {
          var val = S[s][3] / 100 + 0.2 * (wave((base + k) * 0.35, S[s][2]) - 0.5) + 0.05 * (rnd((base + k) * 7 + s) - 0.5);
          var px = RES.x + (k - fr) * step, py = RES.y + RES.h - RES.h * clamp(val, 0.02, 0.98);
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.lineWidth = 2; g.strokeStyle = S[s][1]; g.stroke();
      }
      g.restore();
      for (s = 2; s >= 0; s--) {
        var cur = S[s][3] + Math.round(6 * (wave(t * 0.4, S[s][2]) - 0.5));
        var lab = S[s][0] + ' ' + (s === 2 ? cur * 4 + ' Mb/s' : cur + '%');
        var w = text(g, lab, lx, 282, C.ink2, 600, 13, FB, 'right');
        g.fillStyle = S[s][1]; g.beginPath(); g.arc(lx - w - 10, 278, 4, 0, 6.2832); g.fill(); lx -= w + 30;
      }
      feed(g, 764, 664, 740, 5, 50, 3, t, function (idx, ry, flash, r) {
        var ev = EVENTS[idx % EVENTS.length], y = ry + 31;
        flashRow(g, 765, ry, 738, 50, flash, ev[2]);
        text(g, r <= 1 ? 'acum' : (r - 1) * 7 + ' min', 784, y, C.muted, 500, 12);
        g.fillStyle = ev[2]; g.beginPath(); g.arc(868, y - 4, 4, 0, 6.2832); g.fill();
        text(g, ev[0], 884, y, C.ink, 500, 14);
        text(g, ev[1], 1484, y, C.muted, 500, 12, FB, 'right');
      });
    }
  };

  /* ---------- Cyber Security ---------- */
  var THREATS = ['Brute force SSH', 'Scanare porturi', 'Link de phishing', 'SQL injection', 'Atașament malware', 'Autentificare suspectă', 'DDoS L7'];
  var TARGETS = ['fw-edge-01', 'portal.mdy', 'mail-gw', 'srv-erp-01', 'vpn-gw', 'srv-app-02'];
  function shield(g, cx, cy, k) {
    g.beginPath(); g.moveTo(cx, cy - 70 * k); g.bezierCurveTo(cx + 22 * k, cy - 58 * k, cx + 44 * k, cy - 54 * k, cx + 58 * k, cy - 52 * k);
    g.lineTo(cx + 58 * k, cy); g.bezierCurveTo(cx + 58 * k, cy + 40 * k, cx + 30 * k, cy + 62 * k, cx, cy + 78 * k);
    g.bezierCurveTo(cx - 30 * k, cy + 62 * k, cx - 58 * k, cy + 40 * k, cx - 58 * k, cy); g.lineTo(cx - 58 * k, cy - 52 * k);
    g.bezierCurveTo(cx - 44 * k, cy - 54 * k, cx - 22 * k, cy - 58 * k, cx, cy - 70 * k); g.closePath();
  }
  MODS.security = {
    frame: function (g) {
      card(g, 228, 100, 400, 380, 'Stare securitate');
      card(g, 644, 100, 420, 180, 'Atacuri blocate (24h)');
      card(g, 644, 296, 420, 184, 'Patch compliance');
      card(g, 1080, 100, 424, 380, 'Nivel alertă SOC');
      var seg = [C.green, C.teal, C.amber, '#ff8a4c', C.red];
      for (var i = 0; i < 5; i++) { rr(g, 1100 + i * 78, 190, 72, 12, 6); g.fillStyle = hexA(seg[i], 0.75); g.fill(); }
      text(g, 'Scăzut', 1100, 226, C.muted, 500, 11); text(g, 'Critic', 1484, 226, C.muted, 500, 11, FB, 'right');
      var L = ['Endpoint-uri protejate', 'Reguli firewall active', 'MFA activ', 'Incidente deschise'];
      for (i = 0; i < 4; i++) { text(g, L[i], 1100, 280 + i * 50, C.ink2, 500, 14); if (i) { g.fillStyle = 'rgba(143,247,247,0.06)'; g.fillRect(1100, 250 + i * 50, 384, 1); } }
      card(g, 228, 496, 1276, 432, 'Flux amenințări live', 'Blocate automat de SOC');
      var H = [['ORA', 248], ['SURSĂ', 370], ['TIP ATAC', 580], ['ȚINTĂ', 860], ['ACȚIUNE', 1080], ['SEVERITATE', 1484]];
      for (i = 0; i < H.length; i++) text(g, H[i][0], H[i][1], 562, C.muted, 600, 11, FB, i === 5 ? 'right' : 'left');
      g.fillStyle = C.line; g.fillRect(248, 576, 1236, 1);
    },
    live: function (g, t, lt) {
      liveBadge(g, t);
      var e = ease(lt / 0.9), i, pr = 0.5 + 0.5 * Math.sin(t * 2.2);
      var sg = g.createLinearGradient(0, 180, 0, 340); sg.addColorStop(0, hexA(C.teal, 0.42)); sg.addColorStop(1, hexA(C.teal, 0.08));
      shield(g, 428, 262, 1.05 * (0.9 + 0.1 * e)); g.fillStyle = sg; g.fill(); g.lineWidth = 2.5; g.strokeStyle = C.aqua; g.stroke();
      g.lineCap = 'round'; g.lineWidth = 7; g.strokeStyle = '#eaffff'; g.beginPath(); g.moveTo(400, 266); g.lineTo(420, 288); g.lineTo(458, 244); g.stroke(); g.lineCap = 'butt';
      g.strokeStyle = hexA(C.aqua, 0.5); g.lineWidth = 2; g.setLineDash([6, 10]); g.lineDashOffset = -t * 30;
      g.beginPath(); g.arc(428, 266, 116, 0, 6.2832); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
      g.strokeStyle = hexA(C.teal, 0.35 * (1 - pr)); g.beginPath(); g.arc(428, 266, 124 + 16 * pr, 0, 6.2832); g.stroke();
      text(g, 'Protejat', 428, 424, C.green, 700, 34, FT, 'center');
      text(g, 'Ultima scanare: acum 4 min', 428, 452, C.muted, 500, 13, FB, 'center');
      text(g, fmt((12480 + Math.floor(t * 1.3)) * e), 664, 204, C.ink, 700, 52, FT);
      text(g, '+18% față de media săptămânii', 664, 240, C.amber, 600, 12);
      for (i = 0; i < 12; i++) { var h = 12 + 70 * wave(i * 0.7 + t * 0.8, 4.2); rr(g, 900 + i * 12, 226 - h, 8, h, 2); g.fillStyle = hexA(C.teal, 0.35 + 0.5 * (i / 11)); g.fill(); }
      text(g, Math.round(98 * e) + '%', 664, 386, C.ink, 700, 48, FT);
      bar(g, 664, 408, 380, 8, 0.98 * e, C.green);
      text(g, '1.224 / 1.248 endpoint-uri actualizate', 664, 450, C.muted, 500, 12);
      text(g, 'Scăzut', 1100, 164, C.green, 700, 30, FT);
      var mx = 1100 + 36 + 10 * Math.sin(t * 0.7);
      g.fillStyle = '#eaffff'; g.beginPath(); g.moveTo(mx, 186); g.lineTo(mx - 7, 176); g.lineTo(mx + 7, 176); g.closePath(); g.fill();
      var V = [fmt(1248 * e), fmt(312 * e), Math.round(100 * e) + '%', '0'];
      for (i = 0; i < 4; i++) text(g, V[i], 1484, 282 + i * 50, i === 3 ? C.green : C.ink, 700, 22, FT, 'right');
      feed(g, 228, 584, 1276, 6, 55, 1.6, t, function (idx, ry, flash, r) {
        var y = ry + 34, sev = 1 + Math.floor(rnd(idx * 2.9) * 3), quar = rnd(idx * 5.3) > 0.8;
        flashRow(g, 229, ry, 1274, 55, flash, C.red);
        var secs = 50400 + ((idx * 11) % 7200), tm = [Math.floor(secs / 3600), Math.floor(secs / 60) % 60, secs % 60].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
        text(g, tm, 248, y, C.muted, 500, 13);
        text(g, Math.floor(45 + rnd(idx) * 150) + '.' + Math.floor(rnd(idx * 1.3) * 255) + '.' + Math.floor(rnd(idx * 1.7) * 255) + '.' + Math.floor(rnd(idx * 2.1) * 255), 370, y, C.ink2, 500, 13);
        text(g, THREATS[Math.floor(rnd(idx * 3.7) * THREATS.length)], 580, y, C.ink, 500, 14);
        text(g, TARGETS[Math.floor(rnd(idx * 4.9) * TARGETS.length)], 860, y, C.ink2, 500, 13);
        pill(g, 1080, y + 1, quar ? 'Carantină' : 'Blocat', quar ? C.amber : C.green);
        for (var d = 0; d < 3; d++) { g.fillStyle = d < sev ? (sev === 3 ? C.red : C.amber) : 'rgba(143,247,247,0.12)'; g.beginPath(); g.arc(1484 - (2 - d) * 16 - 4, y - 4, 5, 0, 6.2832); g.fill(); }
        g.fillStyle = 'rgba(143,247,247,0.05)'; g.fillRect(248, Math.round(ry + 55), 1236, 1);
      });
    }
  };

  /* ---------- fabrica: pânză, straturi statice în cache, tranziție între module ---------- */
  function createDashboard(opts) {
    opts = opts || {};
    var W = opts.width || DW, H = opts.height || Math.round(W * DH / DW), fps = opts.fps || 30, k = W / DW;
    var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var cache = {}, snap = null;
    var cur = MODS[opts.module] ? opts.module : 'erp', curAt = 0, switchAt = -1, last = 0, t0 = performance.now(), dead = false;
    function layer(id) {
      if (cache[id]) return cache[id];
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
      drawChrome(g, id); MODS[id].frame(g);
      return (cache[id] = c);
    }
    function paint(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
      ctx.drawImage(layer(cur), 0, 0);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.save(); MODS[cur].live(ctx, t, t - curAt); ctx.restore();
      if (snap && switchAt >= 0) {
        var f = (t - switchAt) / 0.38;
        if (f < 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - ease(f); ctx.drawImage(snap, 0, 0); ctx.globalAlpha = 1; }
        else switchAt = -1;
      }
    }
    function now() { return (performance.now() - t0) / 1000; }
    function setModule(id) {
      if (!MODS[id] || id === cur || dead) return;
      if (!snap) { snap = document.createElement('canvas'); snap.width = W; snap.height = H; }
      var sg = snap.getContext('2d'); sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, W, H); sg.drawImage(canvas, 0, 0);
      cur = id; curAt = switchAt = now(); last = 0;
    }
    function tick(ms) {
      if (dead) return false;
      ms = ms || performance.now();
      if (last && ms - last < 1000 / fps - 2) return false;
      last = ms; paint(now()); return true;
    }
    function invalidate() { cache = {}; last = 0; }
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', invalidate);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate);
    paint(0);
    return {
      canvas: canvas, ctx: ctx, tick: tick, setModule: setModule, invalidate: invalidate,
      getModule: function () { return cur; },
      modules: Object.keys(MODS),
      destroy: function () { dead = true; cache = {}; snap = null; if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', invalidate); }
    };
  }
  window.createDashboard = createDashboard;
})();
