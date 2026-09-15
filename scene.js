/* MDY Solutions — scenă WebGL (Three.js r128, global THREE)
   Eroul: ecosistemul MDY (Soluții Software · Arhitectură & Integrare · Date & Tehnologie)
   construit în 3D real ca panglică triunghiulară pliată de trei ori — o bandă Möbius cu
   plieri rulate, conținut pe fiecare panou, iconițe 3D și logo-ul MDY în centru.
   Plus câmpul de particule pe toată pagina. Fără WebGL: imaginea originală a clientului. */
(function () {
  'use strict';
  var canvas = document.getElementById('scene');
  if (!canvas) return;
  var root = document.documentElement;
  var stage = document.querySelector('.hero-stage');
  function noGL() { root.classList.add('no-webgl'); }
  if (!window.THREE) { noGL(); return; }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { noGL(); return; }
  var quality = 1;                 /* scade la 0.8 doar după randare lentă susținută */
  function applyPixelRatio() {
    var compactVp = window.innerWidth <= 900;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactVp ? 1.35 : 1.65,
      Math.sqrt(2400000 / Math.max(1, window.innerWidth * window.innerHeight))) * quality);
  }
  applyPixelRatio();
  renderer.setClearColor(0x000000, 0);
  root.classList.add('has-webgl');

  var FOV = 38, CAM_Z = 9;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  /* ---------- utilitare ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth01(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function roundRectPath(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function makeSprite() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var sprite = makeSprite();
  var maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;

  /* =====================================================================
     1. Câmp de particule ambientale (toată pagina)
     ===================================================================== */
  var N = 1600, pPos = new Float32Array(N * 3), pSize = new Float32Array(N), pPhase = new Float32Array(N);
  for (var i = 0; i < N; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 30;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pPos[i * 3 + 2] = -14 + Math.random() * 16;
    pSize[i] = 0.6 + Math.pow(Math.random(), 3) * 3.2;
    pPhase[i] = Math.random() * 6.283;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
  var pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color('#8ff7f7') }, uOpacity: { value: 0 } },
    vertexShader: [
      'attribute float aSize; attribute float aPhase;',
      'uniform float uTime; uniform float uScroll; uniform float uPixelRatio;',
      'varying float vAlpha;',
      'void main(){',
      '  vec3 p = position;',
      '  p.x += cos(uTime * 0.12 + aPhase * 1.7) * 0.25;',
      '  p.y += sin(uTime * 0.16 + aPhase) * 0.25 + uScroll;',
      '  p.y = mod(p.y + 9.0, 18.0) - 9.0;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '  gl_PointSize = aSize * uPixelRatio * (34.0 / -mv.z);',
      '  vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 6.0));',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;',
      'void main(){',
      '  float d = length(gl_PointCoord - 0.5);',
      '  float a = smoothstep(0.5, 0.05, d); a *= a;',
      '  gl_FragColor = vec4(uColor, a * vAlpha * 0.5 * uOpacity);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  var particles = new THREE.Points(pGeo, pMat);
  particles.renderOrder = -1;
  scene.add(particles);

  /* =====================================================================
     2. Panglica: bandă Möbius triunghiulară, 3 plieri rulate la 60°
        Coordonate de material (a lungime, b lățime) -> spațiu 3D prin
        reflexii succesive față de liniile de pliere (simetrie C3).
     ===================================================================== */
  var RIB_W = 1, RHO = 0.1, SIGMA = -1;          /* lățime bandă, raza plierii, plierea merge în spate */
  var RB = (function () {
    var PI = Math.PI;
    function rot(p, t) { var c = Math.cos(t), s = Math.sin(t); return { x: c * p.x - s * p.y, y: s * p.x + c * p.y }; }
    function refl(d, c) { var k = 2 * (d.x * c.x + d.y * c.y); return { x: k * c.x - d.x, y: k * c.y - d.y }; }
    var yc = 2 - PI * RHO / 2;
    var creases = [0, 1, 2].map(function (k) {
      var t = -k * 2 * PI / 3;
      return { C: rot({ x: 0, y: yc }, t), c: rot({ x: 1, y: 0 }, t), n: rot({ x: 0, y: 1 }, t) };
    });
    var A1 = { x: 0.5, y: Math.sqrt(3) / 2 }, B1 = { x: -A1.y, y: A1.x };
    var cfg = [{ O: { x: B1.x, y: B1.y }, A: A1, B: B1, z0: 0, F: 1 }];
    for (var k = 0; k < 3; k++) {
      var cf = cfg[k], cr = creases[k];
      var ox = cf.O.x - cr.C.x, oy = cf.O.y - cr.C.y;
      var tc = ox * cr.c.x + oy * cr.c.y, dn = ox * cr.n.x + oy * cr.n.y - PI * RHO;
      cfg.push({
        O: { x: cr.C.x + cr.c.x * tc - cr.n.x * dn, y: cr.C.y + cr.c.y * tc - cr.n.y * dn },
        A: refl(cf.A, cr.c), B: refl(cf.B, cr.c), z0: cf.z0 + 2 * SIGMA * RHO, F: -cf.F
      });
    }
    var last = cfg[3];
    var L = (cfg[0].O.x - last.O.x) * last.A.x + (cfg[0].O.y - last.O.y) * last.A.y;
    var slope = -last.z0 / L;
    function flat(cf, k, px, py, a, o) {
      o.x = px; o.y = py; o.z = cf.z0 + slope * a;
      o.nx = -slope * cf.B.y; o.ny = slope * cf.B.x; o.nz = cf.F;
      o.seg = k;
      return o;
    }
    function map(a, b, o) {
      var cf = cfg[0];
      for (var k = 0; k < 3; k++) {
        var px = cf.O.x + a * cf.A.x + b * cf.B.x, py = cf.O.y + a * cf.A.y + b * cf.B.y;
        var cr = creases[k], dx = px - cr.C.x, dy = py - cr.C.y;
        var d = dx * cr.n.x + dy * cr.n.y;
        if (d <= 0) return flat(cf, k, px, py, a, o);
        if (d < PI * RHO) {
          var t = dx * cr.c.x + dy * cr.c.y, ph = d / RHO, sp = Math.sin(ph), cp = Math.cos(ph);
          o.x = cr.C.x + cr.c.x * t + cr.n.x * RHO * sp;
          o.y = cr.C.y + cr.c.y * t + cr.n.y * RHO * sp;
          o.z = cf.z0 + slope * a + SIGMA * RHO * (1 - cp);
          o.nx = cf.F * (-SIGMA * cr.n.x * sp); o.ny = cf.F * (-SIGMA * cr.n.y * sp); o.nz = cf.F * cp;
          o.seg = k + ph / PI;
          return o;
        }
        cf = cfg[k + 1];
      }
      return flat(cf, 3, cf.O.x + a * cf.A.x + b * cf.B.x, cf.O.y + a * cf.A.y + b * cf.B.y, a, o);
    }
    function zOn(k, x, y) {
      var cf = cfg[k], a = (x - cf.O.x) * cf.A.x + (y - cf.O.y) * cf.A.y;
      return cf.z0 + slope * a;
    }
    return { L: L, map: map, zOn: zOn };
  })();

  function ribbonGeometry(NA, NB) {
    var o = {}, n = (NA + 1) * (NB + 1);
    var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), seg = new Float32Array(n);
    var v = 0;
    for (var i = 0; i <= NA; i++) {
      var a = RB.L * i / NA;
      for (var j = 0; j <= NB; j++) {
        RB.map(a, -RIB_W / 2 + RIB_W * j / NB, o);
        pos[v * 3] = o.x; pos[v * 3 + 1] = o.y; pos[v * 3 + 2] = o.z;
        nor[v * 3] = o.nx; nor[v * 3 + 1] = o.ny; nor[v * 3 + 2] = o.nz;
        uv[v * 2] = i / NA; uv[v * 2 + 1] = j / NB; seg[v] = o.seg; v++;
      }
    }
    var idx = [];
    for (i = 0; i < NA; i++) for (j = 0; j < NB; j++) {
      var p0 = i * (NB + 1) + j, p1 = p0 + NB + 1;
      idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aSeg', new THREE.BufferAttribute(seg, 1));
    g.setIndex(idx);
    return g;
  }
  function haloGeometry(NA, gw) {
    var o = {}, pos = [], glow = [], along = [], idx = [];
    [-1, 1].forEach(function (side) {
      var base = pos.length / 3;
      for (var i = 0; i <= NA; i++) {
        var a = RB.L * i / NA;
        for (var r = 0; r < 2; r++) {
          RB.map(a, side * (RIB_W / 2 + r * gw), o);
          pos.push(o.x, o.y, o.z); glow.push(1 - r); along.push(i / NA);
        }
      }
      for (i = 0; i < NA; i++) {
        var q0 = base + i * 2, q1 = q0 + 2;
        idx.push(q0, q1, q0 + 1, q0 + 1, q1, q1 + 1);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    g.setIndex(idx);
    return g;
  }

  var ribbonMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uReveal: { value: 0 }, uFade: { value: 1 },
      uHover: { value: new THREE.Vector3() }, uDots: { value: Math.floor(RB.L * 16) }
    },
    vertexShader: [
      'attribute float aSeg;',
      'varying vec2 vUv; varying float vSeg; varying vec3 vN; varying vec3 vViewPos; varying vec3 vLocal;',
      'void main(){',
      '  vUv = uv; vSeg = aSeg; vLocal = position;',
      '  vN = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vViewPos = mv.xyz;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime; uniform float uReveal; uniform float uFade; uniform vec3 uHover; uniform float uDots;',
      'varying vec2 vUv; varying float vSeg; varying vec3 vN; varying vec3 vViewPos; varying vec3 vLocal;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
      /* 0 = Soluții Software (cyan), 1 = Arhitectură & Integrare (indigo), 2 = Date & Tehnologie (albastru regal) */
      'vec3 panelColor(float k, vec2 p){',
      '  if (k < 0.5) {',
      '    float g = clamp(0.34 + 0.34 * dot(p, vec2(0.5, 0.866)) + 0.1 * (dot(p, vec2(-0.866, 0.5)) - 1.0), 0.0, 1.0);',
      '    return mix(vec3(0.03, 0.30, 0.74), vec3(0.15, 0.86, 0.93), g);',
      '  } else if (k < 1.5) {',
      '    float g = clamp(0.42 + 0.34 * (dot(p, vec2(0.866, 0.5)) - 1.0) - 0.16 * dot(p, vec2(0.5, -0.866)), 0.0, 1.0);',
      '    return mix(vec3(0.03, 0.05, 0.19), vec3(0.22, 0.24, 0.62), g);',
      '  }',
      '  float g = clamp(0.55 - 0.22 * p.x + 0.25 * (p.y + 1.0), 0.0, 1.0);',
      '  return mix(vec3(0.03, 0.11, 0.42), vec3(0.14, 0.47, 0.97), g);',
      '}',
      'void main(){',
      '  if (vUv.x > uReveal) discard;',
      '  if (uFade < 0.999 && hash(floor(gl_FragCoord.xy)) > uFade) discard;',
      '  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;',
      '  vec3 V = normalize(-vViewPos);',
      '  float ndv = clamp(dot(N, V), 0.0, 1.0);',
      '  float fres = pow(1.0 - ndv, 2.2);',
      '  float k0 = floor(vSeg + 0.0001);',
      '  float f = smoothstep(0.1, 0.9, vSeg - k0);',
      '  vec3 base = mix(panelColor(mod(k0, 3.0), vLocal.xy), panelColor(mod(k0 + 1.0, 3.0), vLocal.xy), f);',
      '  float sm = mod(vSeg, 3.0);',
      '  float hov = dot(uHover, vec3(max(0.0, 1.0 - min(sm, 3.0 - sm)), max(0.0, 1.0 - abs(sm - 1.0)), max(0.0, 1.0 - abs(sm - 2.0))));',
      '  vec3 Lk = normalize(vec3(-0.45, 0.65, 0.62));',
      '  float diff = 0.64 + 0.36 * max(dot(N, Lk), 0.0);',
      '  vec3 H = normalize(Lk + V);',
      '  float spec = pow(max(dot(N, H), 0.0), 42.0);',
      '  vec3 col = base * diff * (1.0 + hov * 0.28);',
      '  col += vec3(0.7, 0.95, 1.0) * spec * 0.45;',
      '  col += vec3(0.3, 0.88, 1.0) * fres * 0.55;',
      '  float sweep = mod(uTime * 0.55, 13.0) - 4.5;',
      '  float sw = exp(-pow((dot(vLocal.xy, vec2(0.75, 0.66)) - sweep) * 1.5, 2.0));',
      '  col += vec3(0.5, 0.92, 1.0) * sw * 0.14;',
      '  vec2 gp = vec2(vUv.x * uDots, abs(vUv.y - 0.5) * 16.0);',
      '  float dotg = 1.0 - smoothstep(0.07, 0.15, length(fract(gp) - 0.5));',
      '  col += vec3(0.6, 0.95, 1.0) * dotg * 0.03;',
      '  float e = min(vUv.y, 1.0 - vUv.y);',
      '  float aa = fwidth(vUv.y);',
      '  float line = 1.0 - smoothstep(0.005, 0.005 + aa * 1.6, e);',
      '  float inner = exp(-e * 30.0);',
      '  float ph = fract(vUv.x * 3.0 - uTime * 0.085);',
      '  float pulse = smoothstep(0.0, 0.012, ph) * (1.0 - smoothstep(0.012, 0.08, ph));',
      '  vec3 glowC = vec3(0.56, 0.97, 0.97);',
      '  col += glowC * inner * (0.26 + 1.35 * pulse + 0.4 * hov);',
      '  col = mix(col, vec3(0.82, 1.0, 1.0), line * 0.85);',
      '  float head = (1.0 - smoothstep(0.0, 0.03, uReveal - vUv.x)) * (1.0 - step(0.9995, uReveal));',
      '  col += glowC * head * 2.4;',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n'),
    side: THREE.DoubleSide,
    extensions: { derivatives: true }
  });
  var haloMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uFade: { value: 1 } },
    vertexShader: [
      'attribute float aGlow; attribute float aAlong;',
      'varying float vGlow; varying float vAlong;',
      'void main(){ vGlow = aGlow; vAlong = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime; uniform float uReveal; uniform float uFade;',
      'varying float vGlow; varying float vAlong;',
      'void main(){',
      '  if (vAlong > uReveal) discard;',
      '  float ph = fract(vAlong * 3.0 - uTime * 0.085);',
      '  float pulse = smoothstep(0.0, 0.012, ph) * (1.0 - smoothstep(0.012, 0.08, ph));',
      '  float g = vGlow * vGlow;',
      '  gl_FragColor = vec4(vec3(0.42, 0.93, 1.0), g * (0.5 + pulse * 0.9) * uFade);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });

  /* ---------- ierarhie: root (poziționat pe .hero-stage) > tilt > content ---------- */
  var ribbonRoot = new THREE.Group();
  var tilt = new THREE.Group();
  var content = new THREE.Group();
  ribbonRoot.add(tilt); tilt.add(content);
  content.position.y = -0.2;
  scene.add(ribbonRoot);
  var ribbonMesh = new THREE.Mesh(ribbonGeometry(coarse ? 640 : 900, coarse ? 18 : 24), ribbonMat);
  var haloMesh = new THREE.Mesh(haloGeometry(coarse ? 640 : 900, 0.075), haloMat);
  haloMesh.renderOrder = 2;
  content.add(ribbonMesh); content.add(haloMesh);

  var backGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x1a6fd6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  backGlow.scale.set(6.4, 6.4, 1); backGlow.position.set(0, 0.2, -0.9);
  content.add(backGlow);

  /* =====================================================================
     3. Iconițe 3D (materiale lucioase cu mediu de lumină propriu)
     ===================================================================== */
  scene.add(new THREE.AmbientLight(0x6fa8ff, 0.35));
  var keyLight = new THREE.DirectionalLight(0xffffff, 1.05); keyLight.position.set(-3, 5, 8); scene.add(keyLight);
  var rimLight = new THREE.DirectionalLight(0x19cbd3, 0.9); rimLight.position.set(6, -2, 4); scene.add(rimLight);

  var envMap = (function () {
    var env = new THREE.Scene();
    env.background = new THREE.Color(0x040a16);
    var geo = new THREE.PlaneGeometry(1, 1);
    function former(hex, k, w, h, x, y, z) {
      var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide });
      var p = new THREE.Mesh(geo, m); p.scale.set(w, h, 1); p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
    }
    former('#ffffff', 3.2, 10, 3, 0, 7, 2);
    former('#8ff7f7', 2.4, 1.6, 9, -7, 0, 3);
    former('#3a6bff', 2.2, 1.4, 8, 7, -1, 2);
    former('#19cbd3', 1.3, 8, 5, 0, -2, -8);
    var pm = new THREE.PMREMGenerator(renderer);
    var tex = pm.fromScene(env, 0.04).texture;
    pm.dispose();
    return tex;
  })();

  var iconMats = [], gFade = 1;
  function std(opts) { opts.envMap = envMap; opts.transparent = true; var m = new THREE.MeshStandardMaterial(opts); iconMats.push(m); return m; }
  var M = {
    body: std({ color: 0x1d5fe0, metalness: 0.55, roughness: 0.24, envMapIntensity: 1.25, emissive: 0x0b2f7a, emissiveIntensity: 0.45 }),
    dark: std({ color: 0x0c1f44, metalness: 0.6, roughness: 0.3, envMapIntensity: 1.1, emissive: 0x06142e, emissiveIntensity: 0.5 }),
    cyan: std({ color: 0x19cbd3, metalness: 0.35, roughness: 0.2, envMapIntensity: 1.2, emissive: 0x19cbd3, emissiveIntensity: 0.5 }),
    glass: std({ color: 0x7fe9f2, metalness: 0.1, roughness: 0.08, envMapIntensity: 1.4, emissive: 0x2adce5, emissiveIntensity: 0.35, opacity: 0.92 })
  };
  var glowMat = new THREE.MeshBasicMaterial({ color: 0x8ff7f7, transparent: true });
  var lineMat = new THREE.LineBasicMaterial({ color: 0x8ff7f7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  iconMats.push(glowMat, lineMat);

  function rrect(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function extrude(shape, depth, bevel) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    g.center();
    return g;
  }
  function neon(geo, angle) { return new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle || 30), lineMat); }
  function gearShape(rO, rI, teeth, hole) {
    var s = new THREE.Shape(), p = Math.PI * 2 / teeth;
    for (var t = 0; t < teeth; t++) {
      var a = t * p, pts = [[a, rI], [a + p * 0.16, rO], [a + p * 0.46, rO], [a + p * 0.62, rI]];
      for (var j = 0; j < 4; j++) {
        var x = Math.cos(pts[j][0]) * pts[j][1], y = Math.sin(pts[j][0]) * pts[j][1];
        if (t === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
    }
    s.closePath();
    var hp = new THREE.Path(); hp.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(hp);
    return s;
  }
  function cloudShape(k) {
    var s = new THREE.Shape();
    s.moveTo(-0.22 * k, -0.13 * k);
    s.lineTo(0.3 * k, -0.12 * k);
    s.absarc(0.3 * k, 0, 0.12 * k, -Math.PI / 2, Math.PI / 2, false);
    s.absarc(0.06 * k, 0.1 * k, 0.2 * k, 0.1, Math.PI - 0.35, false);
    s.absarc(-0.22 * k, 0.01 * k, 0.14 * k, 1.0, Math.PI * 1.5, false);
    return s;
  }
  function shieldShape(k) {
    var s = new THREE.Shape();
    s.moveTo(0, 0.34 * k);
    s.bezierCurveTo(0.1 * k, 0.29 * k, 0.2 * k, 0.27 * k, 0.28 * k, 0.26 * k);
    s.lineTo(0.28 * k, 0.02 * k);
    s.bezierCurveTo(0.28 * k, -0.18 * k, 0.14 * k, -0.3 * k, 0, -0.38 * k);
    s.bezierCurveTo(-0.14 * k, -0.3 * k, -0.28 * k, -0.18 * k, -0.28 * k, 0.02 * k);
    s.lineTo(-0.28 * k, 0.26 * k);
    s.bezierCurveTo(-0.2 * k, 0.27 * k, -0.1 * k, 0.29 * k, 0, 0.34 * k);
    return s;
  }

  var screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 320;
  var screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.generateMipmaps = false; screenTex.minFilter = THREE.LinearFilter;
  function drawScreen() {
    var g = screenCanvas.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 512, 320); grd.addColorStop(0, '#0b2a5c'); grd.addColorStop(1, '#061530');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = 'rgba(143,247,247,0.6)'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 312);
    g.save();
    g.fillStyle = '#8ff7f7'; g.shadowColor = '#19cbd3'; g.shadowBlur = 26;
    g.font = '800 150px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('</>', 44, 168);
    g.restore();
    [[292, 78, 160], [292, 124, 118], [292, 170, 176], [292, 216, 96], [292, 262, 138]].forEach(function (b, i) {
      g.fillStyle = i % 2 ? 'rgba(143,247,247,0.9)' : 'rgba(42,220,229,0.6)';
      roundRectPath(g, b[0], b[1] - 9, b[2], 18, 9); g.fill();
    });
    screenTex.needsUpdate = true;
  }

  function iconSoftware() {
    var g = new THREE.Group();
    var frameGeo = extrude(rrect(0.9, 0.6, 0.07), 0.05, 0.018);
    var frame = new THREE.Mesh(frameGeo, M.body); g.add(frame); frame.add(neon(frameGeo, 35));
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.49), new THREE.MeshBasicMaterial({ map: screenTex, transparent: true }));
    iconMats.push(screen.material);
    screen.position.z = 0.046; g.add(screen);
    var neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.05), M.dark); neck.position.set(0, -0.36, -0.01); g.add(neck);
    var baseGeo = extrude(rrect(0.36, 0.05, 0.02), 0.14, 0.01);
    var base = new THREE.Mesh(baseGeo, M.body); base.position.set(0, -0.44, 0); g.add(base);
    var gearGeo = extrude(gearShape(0.17, 0.125, 10, 0.05), 0.05, 0.012);
    var gear = new THREE.Mesh(gearGeo, M.cyan); gear.position.set(0.4, -0.2, 0.14); g.add(gear); gear.add(neon(gearGeo, 40));
    var cloudGeo = extrude(cloudShape(0.95), 0.07, 0.02);
    var cloud = new THREE.Mesh(cloudGeo, M.glass); cloud.position.set(0.34, 0.44, 0.08); g.add(cloud); cloud.add(neon(cloudGeo, 55));
    var px = [];
    for (var k = 0; k < 4; k++) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), M.cyan);
      c.position.set(-0.56 + k * 0.1, 0.34 + (k % 2) * 0.09, 0.1); g.add(c); px.push(c);
    }
    g.userData.update = function (t, hov) {
      gear.rotation.z = -t * (0.7 + hov * 2.4);
      cloud.position.y = 0.44 + Math.sin(t * 1.3) * 0.03;
      for (var q = 0; q < px.length; q++) {
        px[q].position.y = 0.34 + (q % 2) * 0.09 + Math.sin(t * 1.7 + q) * 0.025;
        px[q].rotation.x = t * (0.6 + q * 0.2); px[q].rotation.y = t * 0.5;
      }
    };
    return g;
  }
  function iconArch() {
    var g = new THREE.Group(), stack = new THREE.Group(); g.add(stack);
    var slabGeo = extrude(rrect(0.62, 0.15, 0.035), 0.36, 0.015);
    var leds = [];
    for (var s = 0; s < 3; s++) {
      var y = -0.24 + s * 0.2;
      var slab = new THREE.Mesh(slabGeo, s === 1 ? M.body : M.dark); slab.position.y = y; stack.add(slab); slab.add(neon(slabGeo, 35));
      var strip = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.026), glowMat); strip.position.set(-0.11, y, 0.2); stack.add(strip);
      for (var k = 0; k < 3; k++) {
        var led = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8ff7f7, transparent: true }));
        led.position.set(0.12 + k * 0.058, y, 0.2); stack.add(led); leds.push(led);
      }
    }
    stack.rotation.set(0.3, -0.5, 0);
    var cloudGeo = extrude(cloudShape(1.05), 0.09, 0.02);
    var cloud = new THREE.Mesh(cloudGeo, M.glass); cloud.position.set(0, 0.36, 0.02); g.add(cloud); cloud.add(neon(cloudGeo, 55));
    var nodes = [[-0.66, 0.1], [-0.62, -0.3], [0.66, 0.12], [0.62, -0.28]], pulses = [];
    nodes.forEach(function (nd, q) {
      var from = new THREE.Vector3(nd[0] < 0 ? -0.26 : 0.26, nd[1] * 0.4, 0.05), to = new THREE.Vector3(nd[0], nd[1], 0.05);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), lineMat));
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), M.cyan); dot.position.copy(to); g.add(dot);
      var pul = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), glowMat); g.add(pul);
      pulses.push({ m: pul, a: from, b: to, o: q * 0.25 });
    });
    g.userData.update = function (t, hov) {
      cloud.position.y = 0.36 + Math.sin(t * 1.1) * 0.03;
      for (var q = 0; q < leds.length; q++) leds[q].material.opacity = gFade * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (3 + hov * 5) + q * 1.7)));
      for (q = 0; q < pulses.length; q++) {
        var pp = pulses[q], f = (t * (0.55 + hov) + pp.o) % 1;
        pp.m.position.lerpVectors(pp.a, pp.b, f);
      }
    };
    return g;
  }
  function iconData() {
    var g = new THREE.Group(), db = new THREE.Group(); g.add(db);
    var cylGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 40, 1);
    var rimGeo = new THREE.TorusGeometry(0.25, 0.009, 8, 64);
    for (var s = 0; s < 3; s++) {
      var c = new THREE.Mesh(cylGeo, s === 1 ? M.dark : M.body); c.position.y = -0.2 + s * 0.15; db.add(c);
      var rim = new THREE.Mesh(rimGeo, glowMat); rim.rotation.x = Math.PI / 2; rim.position.y = c.position.y + 0.06; db.add(rim);
    }
    db.rotation.x = 0.38; db.position.set(-0.16, 0.02, -0.12);
    var shieldGeo = extrude(shieldShape(0.62), 0.06, 0.02);
    var shield = new THREE.Mesh(shieldGeo, M.cyan); shield.position.set(0.1, -0.14, 0.26); g.add(shield); shield.add(neon(shieldGeo, 40));
    var lock = new THREE.Group(); lock.position.set(0.1, -0.16, 0.33); g.add(lock);
    var lockGeo = extrude(rrect(0.15, 0.12, 0.03), 0.04, 0.008);
    lock.add(new THREE.Mesh(lockGeo, M.dark));
    var shackle = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.013, 10, 24, Math.PI), glowMat); shackle.position.y = 0.06; lock.add(shackle);
    var hole = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16), glowMat); hole.position.z = 0.03; lock.add(hole);
    var bars = [], barGeo = new THREE.BoxGeometry(0.06, 1, 0.06); barGeo.translate(0, 0.5, 0);
    for (var b = 0; b < 4; b++) {
      var bar = new THREE.Mesh(barGeo, b % 2 ? M.cyan : M.body); bar.position.set(0.3 + b * 0.09, -0.18, -0.24); g.add(bar); bars.push(bar);
    }
    g.userData.update = function (t, hov) {
      for (var q = 0; q < bars.length; q++) bars[q].scale.y = (0.16 + 0.1 * (q + 1)) * (0.78 + 0.22 * Math.sin(t * (1.8 + hov * 3) + q * 1.3));
      shield.rotation.y = Math.sin(t * 0.9) * 0.18;
      lock.rotation.y = shield.rotation.y;
    };
    return g;
  }

  /* =====================================================================
     4. Panourile: text desenat în canvas (fonturile clientului) + iconițe
     ===================================================================== */
  var FAM_T = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  var FAM_B = 'Inter, "Segoe UI", Arial, sans-serif';
  var U = 512;
  var measure = document.createElement('canvas').getContext('2d');
  function font(weight, size, fam) { return weight + ' ' + Math.round(size * U) + 'px ' + fam; }
  function tw(f, s) { measure.font = f; return measure.measureText(s).width / U; }
  function wrap(f, text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (tw(f, t) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }

  var PANELS = [
    { title: ['Soluții', 'Software'], desc: 'Dezvoltăm și implementăm soluții software adaptate nevoilor tale.', tags: ['ERP', 'CRM', 'WMS', 'Portale'],
      cfg: 0, x: -1.05, top: 0.98, slant: -0.577, descW: 0.94, cols: 2, icon: { x: -0.55, y: 1.36, s: 0.5, build: iconSoftware } },
    { title: ['Arhitectură', '& Integrare'], desc: 'Conectăm sisteme, procese și echipe pentru un ecosistem unitar și sigur.', tags: ['Cloud', 'API', 'Securitate', 'Infrastructură'],
      cfg: 1, x: 0.2, top: 0.84, slant: 0.577, descW: 0.92, cols: 2, icon: { x: 0.63, y: 1.2, s: 0.46, build: iconArch } },
    { title: ['Date &', 'Tehnologie'], desc: 'Transformăm datele în decizii inteligente și rezultate reale.', tags: ['BI & Analytics', 'AI', 'Automatizare', 'Monitoring'],
      cfg: 2, x: -0.42, top: -0.55, slant: 0, descW: 1.34, cols: 4, tagsX: -1.28, icon: { x: -0.95, y: -0.9, s: 0.48, build: iconData } }
  ];

  function layoutPanel(pn, compact) {
    var ops = [], y = pn.top, S = compact ? 0.21 : 0.17;
    function xAt(yy) { return pn.x + pn.slant * (pn.top - yy); }
    var tf = font(700, S, FAM_T);
    pn.title.forEach(function (line) {
      ops.push({ t: 'text', font: tf, text: line.toUpperCase(), x: xAt(y - S * 0.5), y: y - S * 0.82, size: S, color: '#f3fbff' });
      y -= S * 0.95;
    });
    y -= 0.04;
    ops.push({ t: 'bar', x: xAt(y), y: y, w: compact ? 0.42 : 0.36, h: 0.014 });
    y -= 0.07;
    if (!compact) {
      var df = font(400, 0.07, FAM_B);
      wrap(df, pn.desc, pn.descW).forEach(function (line) {
        ops.push({ t: 'text', font: df, text: line, x: xAt(y - 0.05), y: y - 0.068, size: 0.07, color: 'rgba(228,245,252,0.95)' });
        y -= 0.1;
      });
      y -= 0.05;
      var gf = font(600, 0.054, FAM_B), padX = 0.05, ph = 0.112, gap = 0.035;
      var widths = pn.tags.map(function (tg) { return tw(gf, tg) + padX * 2; });
      if (pn.cols === 2) {
        var c0 = Math.max(widths[0], widths[2]), c1 = Math.max(widths[1], widths[3]);
        for (var r = 0; r < 2; r++) {
          var yy = y - r * (ph + gap), bx = xAt(yy - ph / 2);
          ops.push({ t: 'pill', font: gf, text: pn.tags[r * 2], x: bx, y: yy, w: c0, h: ph });
          ops.push({ t: 'pill', font: gf, text: pn.tags[r * 2 + 1], x: bx + c0 + gap, y: yy, w: c1, h: ph });
        }
      } else {
        var px = pn.tagsX;
        pn.tags.forEach(function (tg, q) { ops.push({ t: 'pill', font: gf, text: tg, x: px, y: y - 0.02, w: widths[q], h: ph }); px += widths[q] + gap; });
      }
    }
    var b = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
    ops.forEach(function (o) {
      var w = o.t === 'text' ? tw(o.font, o.text) : o.w;
      var top = o.t === 'text' ? o.y + o.size * 0.92 : o.y;
      var bot = o.t === 'text' ? o.y - o.size * 0.28 : o.y - o.h;
      b.minX = Math.min(b.minX, o.x); b.maxX = Math.max(b.maxX, o.x + w); b.maxY = Math.max(b.maxY, top); b.minY = Math.min(b.minY, bot);
    });
    b.ops = ops;
    return b;
  }

  var textMatTpl = {
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D uMap; uniform float uReveal; uniform float uFade;',
      'varying vec2 vUv;',
      'void main(){',
      '  vec4 t = texture2D(uMap, vUv);',
      '  float yd = 1.0 - vUv.y;',
      '  float front = uReveal * 1.25 - 0.12;',
      '  float m = 1.0 - smoothstep(front - 0.1, front, yd);',
      '  float scan = exp(-pow((yd - front + 0.05) * 22.0, 2.0)) * (1.0 - step(0.999, uReveal));',
      '  vec3 c = t.rgb + vec3(0.5, 0.97, 1.0) * scan * 0.9;',
      '  gl_FragColor = vec4(c, t.a * m * uFade);',
      '}'
    ].join('\n')
  };
  var hitMeshes = [];
  var hitMat = new THREE.MeshBasicMaterial({ visible: false });
  PANELS.forEach(function (pn, idx) {
    pn.group = new THREE.Group();
    content.add(pn.group);
    pn.canvas = document.createElement('canvas'); pn.canvas.width = pn.canvas.height = 64;
    pn.tex = new THREE.CanvasTexture(pn.canvas);
    pn.tex.anisotropy = maxAniso;
    pn.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: pn.tex }, uReveal: { value: 0 }, uFade: { value: 1 } },
      vertexShader: textMatTpl.vertexShader, fragmentShader: textMatTpl.fragmentShader,
      transparent: true, depthWrite: false
    });
    pn.text = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pn.mat);
    pn.text.renderOrder = 4;
    pn.group.add(pn.text);
    pn.icon = pn.icon.build ? (function (ic) { var obj = ic.build(); obj.userData.base = ic; return obj; })(pn.icon) : null;
    var ib = pn.icon.userData.base;
    pn.icon.position.set(ib.x, ib.y, RB.zOn(pn.cfg, ib.x, ib.y) + 0.34);
    pn.icon.rotation.set(0.16, idx === 1 ? 0.3 : -0.32, 0);
    pn.icon.scale.setScalar(0.0001);
    pn.group.add(pn.icon);
    pn.hit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hitMat);
    pn.hit.userData.panel = idx;
    pn.group.add(pn.hit);
    hitMeshes.push(pn.hit);
    pn.hover = 0; pn.lift = 0;
  });

  function drawPanel(pn, compact) {
    var lay = layoutPanel(pn, compact), pad = 0.06;
    var bw = lay.maxX - lay.minX + pad * 2, bh = lay.maxY - lay.minY + pad * 2;
    var cw = 64, ch = 64;
    while (cw < bw * U && cw < 2048) cw *= 2;
    while (ch < bh * U && ch < 2048) ch *= 2;
    var c = pn.canvas; c.width = cw; c.height = ch;
    var g = c.getContext('2d');
    g.clearRect(0, 0, cw, ch);
    var ox = lay.minX - pad, oy = lay.maxY + pad;
    function X(x) { return (x - ox) * U; }
    function Y(y) { return (oy - y) * U; }
    lay.ops.forEach(function (o) {
      g.save();
      if (o.t === 'text') {
        g.font = o.font; g.fillStyle = o.color; g.textBaseline = 'alphabetic';
        g.shadowColor = 'rgba(2, 12, 30, 0.8)'; g.shadowBlur = 0.036 * U; g.shadowOffsetY = 0.007 * U;
        g.fillText(o.text, X(o.x), Y(o.y));
      } else if (o.t === 'bar') {
        var grd = g.createLinearGradient(X(o.x), 0, X(o.x + o.w), 0);
        grd.addColorStop(0, 'rgba(143,247,247,1)'); grd.addColorStop(1, 'rgba(143,247,247,0)');
        g.shadowColor = 'rgba(143,247,247,0.9)'; g.shadowBlur = 0.03 * U;
        g.fillStyle = grd; g.fillRect(X(o.x), Y(o.y), o.w * U, o.h * U);
      } else {
        var px = X(o.x), py = Y(o.y), pw = o.w * U, phh = o.h * U;
        roundRectPath(g, px, py, pw, phh, phh / 2);
        g.fillStyle = 'rgba(5, 24, 58, 0.6)'; g.fill();
        g.lineWidth = Math.max(2, 0.0065 * U); g.strokeStyle = 'rgba(143,247,247,0.8)';
        g.shadowColor = 'rgba(42,220,229,0.85)'; g.shadowBlur = 0.022 * U; g.stroke();
        g.shadowBlur = 0; g.font = o.font; g.fillStyle = '#ecffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(o.text, px + pw / 2, py + phh / 2 + 0.004 * U);
      }
      g.restore();
    });
    pn.tex.needsUpdate = true;
    var pw2 = cw / U, ph2 = ch / U;
    var cx = (lay.minX + lay.maxX) / 2, cy = (lay.minY + lay.maxY) / 2;
    pn.zText = RB.zOn(pn.cfg, cx, cy) + 0.14;
    pn.text.scale.set(pw2, ph2, 1);
    pn.text.position.set(ox + pw2 / 2, oy - ph2 / 2, pn.zText);
    var ib = pn.icon.userData.base, r = 0.36;
    var hx0 = Math.min(lay.minX, ib.x - r), hx1 = Math.max(lay.maxX, ib.x + r);
    var hy0 = Math.min(lay.minY, ib.y - r), hy1 = Math.max(lay.maxY, ib.y + r);
    pn.hit.scale.set(hx1 - hx0, hy1 - hy0, 1);
    pn.hit.position.set((hx0 + hx1) / 2, (hy0 + hy1) / 2, pn.zText);
    pn.center = { x: (hx0 + hx1) / 2, y: (hy0 + hy1) / 2 };
    var len = Math.sqrt(pn.center.x * pn.center.x + pn.center.y * pn.center.y) || 1;
    pn.dir = { x: pn.center.x / len, y: pn.center.y / len };
  }
  var compactMode = null;
  function drawAll(compact) {
    compactMode = compact;
    PANELS.forEach(function (pn) { drawPanel(pn, compact); });
    drawScreen();
  }

  /* =====================================================================
     5. Logo MDY în centru (straturile decupate din imaginea clientului)
     ===================================================================== */
  var logo = new THREE.Group();
  logo.position.set(-0.02, 0.03, 0.2);
  content.add(logo);
  var LW = 0.98, LH = LW * 232 / 258, logoReady = 0;
  var loader = new THREE.TextureLoader();
  function logoLayer(url) {
    var mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: null }, uOpacity: { value: 0 }, uTime: { value: 0 }, uReveal: { value: 0 } },
      vertexShader: textMatTpl.vertexShader,
      fragmentShader: [
        'uniform sampler2D uMap; uniform float uOpacity; uniform float uTime; uniform float uReveal;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec4 t = texture2D(uMap, vUv);',
        '  float sy = fract(uTime * 0.2) * 1.6 - 0.3;',
        '  float scan = exp(-pow((vUv.y - sy) * 12.0, 2.0));',
        '  float m = smoothstep(vUv.x - 0.06, vUv.x, uReveal * 1.12 - 0.06);',
        '  gl_FragColor = vec4(t.rgb * (1.0 + scan * 0.55), t.a * uOpacity * m);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false
    });
    loader.load(url, function (tex) {
      tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
      mat.uniforms.uMap.value = tex; logoReady++;
    });
    return mat;
  }
  var emblemMat = logoLayer('assets/img/mdy-logo-emblem.png');
  var wordMat = logoLayer('assets/img/mdy-logo-wordmark.png');
  var emblemGeo = new THREE.PlaneGeometry(LW, LH); emblemGeo.translate(0.023 * LW, -0.235 * LH, 0);
  var emblem = new THREE.Mesh(emblemGeo, emblemMat);
  emblem.position.set(-0.023 * LW, 0.235 * LH, 0.16); emblem.renderOrder = 5;
  var wordmark = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), wordMat); wordmark.renderOrder = 5;
  var logoHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x19cbd3, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  logoHalo.scale.set(1.5, 1.5, 1); logoHalo.position.set(-0.02, 0.2, -0.05);
  logo.add(logoHalo); logo.add(wordmark); logo.add(emblem);

  /* =====================================================================
     6. Layout: panglica urmărește elementul .hero-stage din pagină
     ===================================================================== */
  var MODEL_W = 4.15, MODEL_H = 3.66;
  var vw = 1, vh = 1, stageRect = null, heroH = 800, pxPerUnit = 100;
  function ppu() { return vh / (2 * CAM_Z * Math.tan(FOV * Math.PI / 360)); }
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    applyPixelRatio();
    renderer.setSize(vw, vh, false);
    pGeo.setDrawRange(0, vw <= 900 ? 850 : N);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    var hero = document.getElementById('hero');
    heroH = hero ? hero.offsetHeight : vh;
  }
  function placeRoot() {
    if (!stage) { ribbonRoot.visible = false; return false; }
    var r = stage.getBoundingClientRect();
    stageRect = r;
    if (r.width < 10 || r.height < 10) { ribbonRoot.visible = false; return false; }
    var k = ppu();
    ribbonRoot.position.set((r.left + r.width / 2 - vw / 2) / k, -(r.top + r.height / 2 - vh / 2) / k, 0);
    var s = Math.min(r.width / MODEL_W, r.height / MODEL_H);
    pxPerUnit = s;
    ribbonRoot.scale.setScalar(s / k);
    return true;
  }
  window.addEventListener('resize', function () { resize(); placeRoot(); maybeRedraw(); if (reduceMotion) frame(); });
  resize();

  var fontsLoaded = false;
  function maybeRedraw() {
    if (!fontsLoaded) return;
    var want = pxPerUnit < 118;
    if (want !== compactMode) drawAll(want);
  }

  /* ---------- interacțiune ---------- */
  var mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  var pointer = { x: -9999, y: -9999, fine: false };
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.fine = e.pointerType !== 'touch';
    if (e.pointerType === 'touch') return;
    mouse.x = (e.clientX / vw) * 2 - 1;
    mouse.y = -((e.clientY / vh) * 2 - 1);
  }, { passive: true });
  var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(x, y) {
    if (!stageRect || x < stageRect.left || x > stageRect.right || y < stageRect.top || y > stageRect.bottom) return -1;
    ndc.set((x / vw) * 2 - 1, -(y / vh) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    var hit = raycaster.intersectObjects(hitMeshes, false);
    return hit.length ? hit[0].object.userData.panel : -1;
  }
  var hovered = -1;
  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    var api = window.mdy && window.mdy.cursor;
    if (api) { if (i >= 0) api.set('Soluții'); else api.clear(); }
    if (stage) stage.style.cursor = i >= 0 ? 'pointer' : '';
  }
  if (stage) {
    stage.addEventListener('click', function (e) {
      if (pickAt(e.clientX, e.clientY) >= 0 && window.mdy && window.mdy.scrollTo) window.mdy.scrollTo('#solutii');
    });
    stage.addEventListener('pointerleave', function () { setHover(-1); });
  }

  /* =====================================================================
     7. Pornire: fonturi -> texturi -> intro
     ===================================================================== */
  var clock = new THREE.Clock();
  var introStart = -1;
  function begin() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    placeRoot();
    drawAll(pxPerUnit < 118);
    if (introStart < 0) introStart = clock.getElapsedTime();
    if (reduceMotion) frame();
  }
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('700 40px "Barlow Condensed"'),
      document.fonts.load('800 40px "Barlow Condensed"'),
      document.fonts.load('400 20px Inter'),
      document.fonts.load('600 20px Inter')
    ]).then(begin, begin);
    document.fonts.ready.then(function () { if (fontsLoaded) drawAll(compactMode); });
  } else {
    begin();
  }
  setTimeout(begin, 2200);

  /* =====================================================================
     8. Buclă
     ===================================================================== */
  var pageFade = reduceMotion ? 1 : 0;
  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (reduceMotion) t = 12;
    if (pageFade < 1) pageFade = Math.min(1, pageFade + dt * 0.7);
    var damp = 1 - Math.exp(-4.5 * dt);          /* netezire independentă de rata de cadre */
    smooth.x += (mouse.x - smooth.x) * damp;
    smooth.y += (mouse.y - smooth.y) * damp;
    var sy = window.scrollY || window.pageYOffset || 0;

    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uScroll.value = sy * 0.0022;
    pMat.uniforms.uOpacity.value = pageFade;

    var p = clamp(sy / (heroH * 0.8), 0, 1), pe = p * p * (3 - 2 * p);
    var visible = placeRoot() && p < 0.999;
    ribbonRoot.visible = visible;
    if (visible) {
      var it = introStart < 0 ? 0 : (reduceMotion ? 99 : t - introStart);
      var rev = easeInOut(clamp((it - 0.1) / 2.0, 0, 1));
      var fade = 1 - smooth01(0.4, 0.95, p);
      gFade = fade;
      ribbonMat.uniforms.uTime.value = t; haloMat.uniforms.uTime.value = t;
      ribbonMat.uniforms.uReveal.value = introStart < 0 ? 0 : rev * 1.001;
      haloMat.uniforms.uReveal.value = ribbonMat.uniforms.uReveal.value;
      ribbonMat.uniforms.uFade.value = fade; haloMat.uniforms.uFade.value = fade;
      backGlow.material.opacity = 0.32 * easeOut(clamp(it / 2.2, 0, 1)) * fade;

      /* înclinare: mouse + respirație + coregrafie la scroll */
      /* mișcare continuă, vizibilă, dar cu textul mereu lizibil */
      var idleY = reduceMotion ? 0 : Math.sin(t * 0.3) * 0.12 + Math.sin(t * 0.11 + 2.0) * 0.05;
      var idleX = reduceMotion ? 0 : Math.sin(t * 0.25 + 1.0) * 0.05;
      tilt.rotation.y = smooth.x * 0.26 + idleY - pe * 0.6;
      tilt.rotation.x = -smooth.y * 0.16 + idleX + pe * 0.85;
      tilt.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.18) * 0.02;
      tilt.position.y = reduceMotion ? 0 : Math.sin(t * 0.55) * 0.05;
      tilt.position.z = -pe * 0.6;

      /* hover pe panouri */
      if (pointer.fine && it > 2.4 && p < 0.2) { scene.updateMatrixWorld(); setHover(pickAt(pointer.x, pointer.y)); }
      else if (hovered >= 0) setHover(-1);

      /* logo */
      var lt = clamp((it - 1.0) / 0.8, 0, 1);
      var logoOn = logoReady >= 2 ? 1 : 0;
      emblemMat.uniforms.uOpacity.value = logoOn * clamp(lt * 1.6, 0, 1) * fade;
      wordMat.uniforms.uOpacity.value = logoOn * fade;
      wordMat.uniforms.uReveal.value = easeOut(clamp((it - 1.35) / 0.8, 0, 1));
      emblemMat.uniforms.uReveal.value = 1;
      emblemMat.uniforms.uTime.value = t; wordMat.uniforms.uTime.value = t + 0.4;
      emblem.scale.setScalar(0.6 + 0.4 * easeBack(lt));
      emblem.rotation.y = reduceMotion ? 0 : Math.sin(t * 0.7) * 0.22;
      logoHalo.material.opacity = (0.28 + 0.1 * Math.sin(t * 1.4)) * lt * fade;
      logo.position.z = 0.2 + pe * 0.9;

      /* panouri: text + iconițe */
      for (var q = 0; q < PANELS.length; q++) {
        var pn = PANELS[q];
        var tt = clamp((it - 1.45 - q * 0.2) / 0.85, 0, 1);
        pn.mat.uniforms.uReveal.value = fontsLoaded ? easeOut(tt) : 0;
        pn.mat.uniforms.uFade.value = fade;
        pn.hover = lerp(pn.hover, hovered === q ? 1 : 0, 0.12);
        var ic = clamp((it - 1.3 - q * 0.2) / 0.95, 0, 1);
        var ib = pn.icon.userData.base;
        pn.icon.scale.setScalar(Math.max(0.0001, ib.s * easeBack(ic) * (1 + pn.hover * 0.12)));
        pn.icon.position.z = RB.zOn(pn.cfg, ib.x, ib.y) + 0.34 + pn.hover * 0.12;
        pn.icon.rotation.y = (q === 1 ? 0.3 : -0.32) + (reduceMotion ? 0 : Math.sin(t * 0.55 + q * 2.1) * 0.22) + pn.hover * 0.25;
        pn.icon.userData.update(t, pn.hover);
        var d = pn.dir || { x: 0, y: 0 };
        pn.group.position.set(d.x * pe * 1.1, d.y * pe * 1.1, pn.hover * 0.1 + pe * 0.7);
      }
      for (q = 0; q < iconMats.length; q++) iconMats[q].opacity = fade * (iconMats[q] === lineMat ? 0.85 : (iconMats[q] === M.glass ? 0.92 : 1));
      ribbonMat.uniforms.uHover.value.set(PANELS[0].hover, PANELS[1].hover, PANELS[2].hover);
    }

    camera.position.x += (smooth.x * 0.3 - camera.position.x) * 0.05;
    camera.position.y += (smooth.y * 0.18 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  /* ---------- ciclul de viață al buclei ---------- */
  var lost = false, samples = 0, slowTime = 0, lastNow = 0;
  function tick(now) {
    var delta = lastNow ? (now - lastNow) / 1000 : 1 / 60;
    lastNow = now;
    frame();
    /* rezoluție adaptivă: doar după 120 de cadre lente consecutive, fără oscilații */
    if (quality === 1 && introStart >= 0 && clock.elapsedTime - introStart > 4 && delta < 0.1) {
      slowTime += delta; samples++;
      if (samples === 120) {
        if (slowTime / samples > 1 / 43) { quality = 0.8; resize(); }
        samples = 0; slowTime = 0;
      }
    }
  }
  function syncLoop() {
    lastNow = 0;
    if (document.hidden || lost || reduceMotion) {
      renderer.setAnimationLoop(null);
      if (reduceMotion && !document.hidden && !lost) frame();
      return;
    }
    renderer.setAnimationLoop(tick);
  }
  document.addEventListener('visibilitychange', syncLoop);
  window.addEventListener('scroll', function () { if (reduceMotion && !lost) frame(); }, { passive: true });
  loader.manager.onLoad = function () { if (reduceMotion && !lost) frame(); };
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', function (e) { reduceMotion = e.matches; syncLoop(); });
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    lost = true;
    root.classList.remove('has-webgl'); root.classList.add('no-webgl');
    syncLoop();
  });
  canvas.addEventListener('webglcontextrestored', function () {
    lost = false;
    resize(); placeRoot();
    if (fontsLoaded) drawAll(compactMode);
    root.classList.remove('no-webgl'); root.classList.add('has-webgl');
    syncLoop();
  });

  /* cârlig de depanare: oprește/pornește bucla (util pentru capturi de ecran) */
  window.mdyScene = {
    stop: function () { renderer.setAnimationLoop(null); },
    start: syncLoop,
    render: frame
  };

  syncLoop();
})();
