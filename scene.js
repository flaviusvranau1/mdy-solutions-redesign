/* MDY Solutions — scenă WebGL (Three.js 0.180, module ES)
   Eroul: „Centrul de comandă MDY” — un ecran de sticlă plutitor cu dashboard-ul ERP viu,
   șase module (ERP, Producție, Curierat & Depozit, BI & Analytics, Infrastructură & Cloud,
   Cyber Security) ca plăci de sticlă în jurul lui, fluxuri de lumină care converg spre ecran
   și o reflexie pe suprafața întunecată de dedesubt. Iluminare fizică (mediu de studio, cheie
   caldă + contur rece, ACES), fără linii neon. Fără WebGL2: posterul static din pagină. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function main() {
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  const root = document.documentElement;
  const stage = document.querySelector('.hero-stage');
  const noGL = () => { root.classList.remove('has-webgl'); root.classList.add('no-webgl'); };

  let reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowTier = coarse || (navigator.hardwareConcurrency || 8) <= 4;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { noGL(); return; }
  let quality = 1;                 /* scade la 0.8 doar după randare lentă susținută */
  const compactVp = () => window.innerWidth <= 900;
  function applyPixelRatio() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compactVp() ? 2 : 1.5,
      Math.sqrt(2400000 / Math.max(1, window.innerWidth * window.innerHeight))) * quality);
  }
  applyPixelRatio();
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.classList.remove('no-webgl');
  root.classList.add('has-webgl');

  const FOV = 32, CAM_Z = 9.5;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  /* ---------- utilitare ---------- */
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth01 = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  function makeSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.65)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const sprite = makeSprite();
  const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  function glow(color, opacity, sx, sy, x, y, z) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    s.scale.set(sx, sy, 1); s.position.set(x, y, z); s.userData.base = opacity; return s;
  }

  /* =====================================================================
     1. Lumină: mediu de studio (PMREM) + cheie caldă, contur rece, umplere albastră
     ===================================================================== */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.7;
  const keyLight = new THREE.DirectionalLight(0xffe9d6, 2.6); keyLight.position.set(-5, 5, 5); scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xb8f1f4, 2.6); rimLight.position.set(5, 3, -6); scene.add(rimLight);
  const fillLight = new THREE.DirectionalLight(0x2f5bd8, 0.6); fillLight.position.set(3, -4, 5); scene.add(fillLight);

  /* =====================================================================
     2. Câmp de particule ambientale (toată pagina)
     ===================================================================== */
  const N = lowTier ? 700 : 1400;
  const pPos = new Float32Array(N * 3), pSize = new Float32Array(N), pPhase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 30;
    pPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
    pPos[i * 3 + 2] = -14 + Math.random() * 16;
    pSize[i] = 0.6 + Math.pow(Math.random(), 3) * 3.2;
    pPhase[i] = Math.random() * 6.283;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute('aPhase', new THREE.BufferAttribute(pPhase, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color('#8ff7f7') }, uOpacity: { value: 0 } },
    vertexShader: `
      attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uScroll; uniform float uPixelRatio;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        p.x += cos(uTime * 0.12 + aPhase * 1.7) * 0.25;
        p.y += sin(uTime * 0.16 + aPhase) * 0.25 + uScroll;
        p.y = mod(p.y + 9.0, 18.0) - 9.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (34.0 / -mv.z);
        vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 6.0));
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d); a *= a;
        float k = a * vAlpha * 0.5 * uOpacity;
        gl_FragColor = vec4(uColor * k, k);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.renderOrder = -1;
  scene.add(particles);

  /* =====================================================================
     3. Ecranul: dashboard-ul ERP desenat în canvas (dashboard.js) pe o placă de sticlă
     ===================================================================== */
  const hero = new THREE.Group();          /* urmărește .hero-stage */
  const tilt = new THREE.Group();          /* mouse + respirație + coregrafie la scroll */
  const content = new THREE.Group();       /* compoziția, centrată */
  scene.add(hero); hero.add(tilt); tilt.add(content);
  content.position.y = 0.14;

  const SLAB_W = 3.2, SLAB_H = 2.0, SLAB_D = 0.08, FLOOR_Y = -1.62;
  const DASH_W = compactVp() ? 1152 : 1536, DASH_H = Math.round(DASH_W * 0.625);
  let dash = null;
  if (typeof window.createDashboard === 'function') {
    try { dash = window.createDashboard({ width: DASH_W, height: DASH_H, module: 'erp', fps: lowTier ? 20 : 30 }); } catch (e) { dash = null; }
  }
  const screenCanvas = dash ? dash.canvas : (function () {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640;
    const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 1024, 640);
    grd.addColorStop(0, '#0a1f38'); grd.addColorStop(1, '#05111d'); g.fillStyle = grd; g.fillRect(0, 0, 1024, 640);
    g.fillStyle = '#8ff7f7'; g.font = '700 120px "Barlow Condensed", Arial'; g.fillText('MDY', 80, 200);
    return c;
  })();
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = Math.min(8, maxAniso);
  screenTex.generateMipmaps = true;
  screenTex.minFilter = THREE.LinearMipmapLinearFilter;
  screenTex.magFilter = THREE.LinearFilter;

  const slab = new THREE.Group();
  slab.rotation.set(0.03, -0.14, 0);
  content.add(slab);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1626, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.1, transparent: true });
  const bodyGeo = new RoundedBoxGeometry(SLAB_W, SLAB_H, SLAB_D, 4, 0.05);
  const body = new THREE.Mesh(bodyGeo, bodyMat); slab.add(body);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  screenMat.color.setScalar(0);
  const screenGeo = new THREE.PlaneGeometry(SLAB_W - 0.12, SLAB_H - 0.12);
  const screen = new THREE.Mesh(screenGeo, screenMat); screen.position.z = SLAB_D / 2 + 0.002; slab.add(screen);
  /* sticla de deasupra ecranului: doar reflexiile mediului, adunate peste imagine */
  const coverMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 2.4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W - 0.08, SLAB_H - 0.08), coverMat); cover.position.z = SLAB_D / 2 + 0.006; slab.add(cover);
  /* lumina ecranului se răsfrânge în spate și pe „podea”; un strop cald jos-dreapta */
  const backGlow = glow(0x1a6fd6, 0.3, 6.0, 4.2, 0, 0, -0.6); content.add(backGlow);
  const pool = glow(0x19cbd3, 0.16, 5.4, 0.9, 0.1, FLOOR_Y - 0.05, 0.3); content.add(pool);
  const warm = glow(0xffb454, 0.07, 3.2, 2.4, 1.9, -1.1, -0.9); content.add(warm);

  /* =====================================================================
     4. Modulele: plăci de sticlă cu text (canvas) și iconițe 3D procedurale
     ===================================================================== */
  const FAM_T = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  const FAM_B = 'Inter, "Segoe UI", Arial, sans-serif';
  const CARD_W = 1.0, CARD_H = 0.42, CARD_D = 0.04, LBL_W = 640, LBL_H = 269;
  const CARDS = [
    { id: 'erp', label: 'ERP operațional', sub: 'Comenzi · Facturi · Stoc', pos: [-2.0, 0.92, 0.5], yaw: 0.26, icon: 'erp', svc: 'software' },
    { id: 'productie', label: 'Producție & MES', sub: 'Planificare · OEE · Trasabilitate', pos: [-2.12, -0.12, 0.72], yaw: 0.26, icon: 'gear', svc: 'software' },
    { id: 'curierat', alt: 'depozit', label: 'Curierat & Depozit', sub: 'AWB · Rute · WMS', pos: [-1.18, -1.1, 0.95], yaw: 0.14, icon: 'box', svc: 'software' },
    { id: 'bi', label: 'BI & Analytics', sub: 'Rapoarte · KPI · Decizii', pos: [2.0, 0.96, 0.45], yaw: -0.26, icon: 'bars', svc: 'software' },
    { id: 'infra', label: 'Infrastructură & Cloud', sub: 'Servere · Rețea · Backup', pos: [2.12, -0.08, 0.68], yaw: -0.26, icon: 'server', svc: 'infra' },
    { id: 'security', label: 'Cyber Security', sub: 'SOC · Firewall · Audit', pos: [1.22, -1.1, 0.95], yaw: -0.14, icon: 'shield', svc: 'security' }
  ];
  const iconMats = [];
  function std(opts) { opts.transparent = true; const m = new THREE.MeshStandardMaterial(opts); iconMats.push(m); return m; }
  const M = {
    body: std({ color: 0x1d5fe0, metalness: 0.5, roughness: 0.3, envMapIntensity: 1.1, emissive: 0x0b2f7a, emissiveIntensity: 0.22 }),
    dark: std({ color: 0x0d2140, metalness: 0.6, roughness: 0.34, envMapIntensity: 1.0, emissive: 0x06142e, emissiveIntensity: 0.3 }),
    cyan: std({ color: 0x19cbd3, metalness: 0.3, roughness: 0.24, envMapIntensity: 1.1, emissive: 0x19cbd3, emissiveIntensity: 0.28 }),
    metal: std({ color: 0x1a2530, metalness: 0.9, roughness: 0.36, envMapIntensity: 1.2 }),
    glass: std({ color: 0x8fe9f2, metalness: 0.1, roughness: 0.1, envMapIntensity: 1.3, emissive: 0x2adce5, emissiveIntensity: 0.2, opacity: 0.92 })
  };
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x8ff7f7, transparent: true, toneMapped: false });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xffb454, transparent: true, toneMapped: false });
  iconMats.push(glowMat, amberMat);

  function rrect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function extrude(shape, depth, bevel) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 12 });
    g.center();
    return g;
  }
  function gearShape(rO, rI, teeth, hole) {
    const s = new THREE.Shape(), p = Math.PI * 2 / teeth;
    for (let t = 0; t < teeth; t++) {
      const a = t * p, pts = [[a, rI], [a + p * 0.16, rO], [a + p * 0.46, rO], [a + p * 0.62, rI]];
      for (let j = 0; j < 4; j++) {
        const x = Math.cos(pts[j][0]) * pts[j][1], y = Math.sin(pts[j][0]) * pts[j][1];
        if (t === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
    }
    s.closePath();
    const hp = new THREE.Path(); hp.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(hp);
    return s;
  }
  function shieldShape(k) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.34 * k);
    s.bezierCurveTo(0.1 * k, 0.29 * k, 0.2 * k, 0.27 * k, 0.28 * k, 0.26 * k);
    s.lineTo(0.28 * k, 0.02 * k);
    s.bezierCurveTo(0.28 * k, -0.18 * k, 0.14 * k, -0.3 * k, 0, -0.38 * k);
    s.bezierCurveTo(-0.14 * k, -0.3 * k, -0.28 * k, -0.18 * k, -0.28 * k, 0.02 * k);
    s.lineTo(-0.28 * k, 0.26 * k);
    s.bezierCurveTo(-0.2 * k, 0.27 * k, -0.1 * k, 0.29 * k, 0, 0.34 * k);
    return s;
  }
  const ICONS = {
    erp() {
      const g = new THREE.Group(), cubes = [];
      const geo = new RoundedBoxGeometry(0.3, 0.3, 0.3, 3, 0.05);
      [[-0.14, -0.1, 0, M.dark], [0.14, -0.1, 0.05, M.body], [0, 0.18, 0.02, M.cyan]].forEach((c, i) => {
        const m = new THREE.Mesh(geo, c[3]); m.position.set(c[0], c[1], c[2]); m.rotation.set(0.2, 0.5 + i * 0.3, 0); g.add(m); cubes.push(m);
      });
      g.userData.update = (t, hov) => { cubes.forEach((c, i) => { c.rotation.y = 0.5 + i * 0.3 + t * (0.25 + hov * 0.6) * (i % 2 ? -1 : 1); }); cubes[2].position.y = 0.18 + Math.sin(t * 1.3) * 0.02; };
      return g;
    },
    gear() {
      const g = new THREE.Group();
      const big = new THREE.Mesh(extrude(gearShape(0.3, 0.23, 10, 0.08), 0.08, 0.015), M.cyan); g.add(big);
      const small = new THREE.Mesh(extrude(gearShape(0.17, 0.125, 8, 0.045), 0.07, 0.012), M.body); small.position.set(0.26, 0.3, 0.06); g.add(small); big.position.x = -0.06;
      g.userData.update = (t, hov) => { big.rotation.z = -t * (0.5 + hov * 1.6); small.rotation.z = t * (0.5 + hov * 1.6) * 1.25 + 0.2; };
      return g;
    },
    box() {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.34, 0.36, 3, 0.03), M.body); g.add(b);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.06, 0.37), M.cyan); band.position.y = 0.05; g.add(band);
      const band2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.37), M.cyan); g.add(band2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.008, 6, 64), glowMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.2; g.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), glowMat); g.add(dot);
      g.rotation.set(0.35, -0.6, 0);
      g.userData.update = (t, hov) => { const a = t * (0.9 + hov * 1.5); dot.position.set(Math.cos(a) * 0.4, -0.2, Math.sin(a) * 0.4); b.rotation.y = band.rotation.y = band2.rotation.y = Math.sin(t * 0.6) * 0.15; };
      return g;
    },
    bars() {
      const g = new THREE.Group(), bars = [];
      const barGeo = new THREE.BoxGeometry(0.1, 1, 0.1); barGeo.translate(0, 0.5, 0);
      for (let b = 0; b < 5; b++) { const bar = new THREE.Mesh(barGeo, b % 2 ? M.cyan : M.body); bar.position.set(-0.28 + b * 0.14, -0.26, 0); g.add(bar); bars.push(bar); }
      const line = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.006, 6, 48, Math.PI * 0.9), glowMat); line.position.set(0, -0.2, 0.1); line.rotation.z = 0.1; g.add(line);
      g.rotation.set(0.15, -0.45, 0);
      g.userData.update = (t, hov) => { bars.forEach((bar, q) => { bar.scale.y = (0.16 + 0.09 * (q + 1)) * (0.8 + 0.2 * Math.sin(t * (1.6 + hov * 3) + q * 1.3)); }); };
      return g;
    },
    server() {
      /* rack cu proporții reale: dulap îngust și înalt, 8 unități, LED-uri discrete */
      const g = new THREE.Group(), leds = [];
      const cab = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.86, 0.34, 3, 0.02), M.metal); g.add(cab);
      const unitGeo = new RoundedBoxGeometry(0.36, 0.08, 0.06, 2, 0.01);
      for (let s = 0; s < 8; s++) {
        const y = -0.36 + s * 0.1;
        const u = new THREE.Mesh(unitGeo, s % 3 === 1 ? M.body : M.dark); u.position.set(0, y, 0.17); g.add(u);
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: s === 5 ? 0xffb454 : 0x8ff7f7, transparent: true, toneMapped: false }));
        led.position.set(0.13, y, 0.205); g.add(led); leds.push(led); iconMats.push(led.material);
        const led2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3fd68c, transparent: true, toneMapped: false }));
        led2.position.set(0.1, y, 0.205); g.add(led2); leds.push(led2); iconMats.push(led2.material);
      }
      g.rotation.set(0.1, -0.5, 0);
      g.userData.update = (t, hov) => { leds.forEach((l, q) => { const on = 0.5 + 0.5 * Math.sin(t * (1.3 + hov * 3) + q * 2.3); l.material.opacity = gFade * (0.3 + 0.7 * (on > 0.5 ? 1 : 0.3)); }); };
      return g;
    },
    shield() {
      const g = new THREE.Group();
      const sh = new THREE.Mesh(extrude(shieldShape(0.95), 0.07, 0.02), M.cyan); g.add(sh);
      const inner = new THREE.Mesh(extrude(shieldShape(0.62), 0.03, 0.01), M.dark); inner.position.z = 0.05; g.add(inner);
      const lock = new THREE.Group(); lock.position.set(0, -0.02, 0.09); g.add(lock);
      lock.add(new THREE.Mesh(extrude(rrect(0.13, 0.1, 0.025), 0.035, 0.006), M.body));
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 8, 22, Math.PI), glowMat); shackle.position.y = 0.05; lock.add(shackle);
      /* graf de noduri în jurul scutului: un nod „amenințare” se stinge când e neutralizat */
      const nodes = [], ang = [0.3, 1.2, 2.1, 3.0, 3.9, 4.9, 5.7];
      ang.forEach((a, i) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), i === 3 ? amberMat : glowMat); n.position.set(Math.cos(a) * 0.46, Math.sin(a) * 0.4, 0.02); g.add(n); nodes.push(n); });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.005, 6, 64), glowMat); ring.scale.y = 0.87; g.add(ring);
      g.userData.update = (t, hov) => {
        sh.rotation.y = inner.rotation.y = lock.rotation.y = Math.sin(t * 0.8) * 0.22;
        ring.rotation.set(Math.sin(t * 0.5) * 0.3, t * (0.3 + hov), 0); ring.material.opacity = gFade * (0.3 + hov * 0.4);
        const phase = (t * 0.35) % 1;
        nodes[3].material.opacity = gFade * (phase < 0.5 ? 0.9 : 0.25);
        nodes[3].scale.setScalar(phase < 0.5 ? 1.35 : 0.8);
      };
      return g;
    }
  };

  const cardGeo = new RoundedBoxGeometry(CARD_W, CARD_H, CARD_D, 3, 0.05);
  const labelGeo = new THREE.PlaneGeometry(CARD_W, CARD_H);
  function drawLabel(cd, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    const x0 = w * 0.385, maxW = w * 0.57, cy = h * 0.5;
    const fit = (weight, size, fam, str) => { let px = size; g.font = `${weight} ${px}px ${fam}`; const mw = g.measureText(str).width; if (mw > maxW) { px = Math.floor(px * maxW / mw); g.font = `${weight} ${px}px ${fam}`; } return px; };
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    fit(700, Math.round(h * 0.25), FAM_T, cd.label);
    g.fillText(cd.label, x0, cy + h * 0.02);
    g.fillStyle = 'rgba(160, 214, 224, 0.92)';
    fit(500, Math.round(h * 0.12), FAM_B, cd.sub);
    g.fillText(cd.sub, x0, cy + h * 0.22);
    g.fillStyle = '#3fd68c'; g.beginPath(); g.arc(w - h * 0.13, h * 0.17, h * 0.03, 0, Math.PI * 2); g.fill();
    return c;
  }
  const hitMeshes = [];
  CARDS.forEach((cd, i) => {
    const g = new THREE.Group();
    g.position.set(cd.pos[0], cd.pos[1], cd.pos[2]);
    g.rotation.y = cd.yaw;
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0c1c2f, metalness: 0.2, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2, transparent: true, opacity: 0.88, sheen: 0.4, sheenColor: new THREE.Color(0x19cbd3), sheenRoughness: 0.6 });
    const bodyM = new THREE.Mesh(cardGeo, mat); bodyM.userData.card = i; g.add(bodyM); hitMeshes.push(bodyM);
    const labelTex = new THREE.CanvasTexture(drawLabel(cd, LBL_W, LBL_H));
    labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = Math.min(8, maxAniso);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, depthWrite: false });
    const label = new THREE.Mesh(labelGeo, labelMat); label.position.z = CARD_D / 2 + 0.004; g.add(label);
    /* bara de stare de la baza plăcii, se aprinde pe modulul activ */
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W - 0.16, 0.012), new THREE.MeshBasicMaterial({ color: 0x8ff7f7, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    bar.position.set(0, -CARD_H / 2 + 0.05, CARD_D / 2 + 0.005); g.add(bar);
    const icon = ICONS[cd.icon](); icon.scale.setScalar(cd.icon === 'server' ? 0.26 : 0.29); icon.position.set(-CARD_W / 2 + 0.18, 0.0, CARD_D / 2 + 0.1); g.add(icon);
    content.add(g);
    Object.assign(cd, { group: g, body: bodyM, mat, labelMat, bar, icon, hover: 0, active: 0, phase: i * 1.37, base: new THREE.Vector3(cd.pos[0], cd.pos[1], cd.pos[2]) });
  });

  /* =====================================================================
     5. Fluxurile de lumină: tuburi subțiri de la fiecare modul spre ecran
     ===================================================================== */
  CARDS.forEach((cd, i) => {
    const sx = Math.sign(cd.pos[0]), low = cd.pos[1] < -0.6;
    const a = low ? new THREE.Vector3(cd.pos[0] - sx * 0.2, cd.pos[1] + CARD_H / 2, cd.pos[2] - 0.02) : new THREE.Vector3(cd.pos[0] - sx * CARD_W * 0.46, cd.pos[1], cd.pos[2] - 0.02);
    const b = low ? new THREE.Vector3(cd.pos[0] * 0.55, -SLAB_H / 2 + 0.02, 0.02) : new THREE.Vector3(sx * (SLAB_W / 2 - 0.02), cd.pos[1] * 0.6, 0.02);
    const mid = new THREE.Vector3().lerpVectors(a, b, 0.5).add(new THREE.Vector3(0, low ? -0.06 : 0.08, 0.3));
    const curve = new THREE.CatmullRomCurve3([a, mid, b], false, 'centripetal', 0.5);
    const geo = new THREE.TubeGeometry(curve, lowTier ? 28 : 48, 0.008, 6, false);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 }, uReveal: { value: 0 }, uBoost: { value: 0 }, uOffset: { value: i * 0.37 }, uColor: { value: new THREE.Color('#5fc9d0') }, uHot: { value: new THREE.Color('#dffdff') } },
      vertexShader: `
        varying vec2 vUv; varying float vNV;
        void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vNV = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform float uTime, uFade, uReveal, uBoost, uOffset; uniform vec3 uColor, uHot;
        varying vec2 vUv; varying float vNV;
        void main(){
          float x = vUv.x;
          float ends = smoothstep(0.0, 0.1, x) * smoothstep(1.0, 0.86, x);
          float rev = smoothstep(x - 0.03, x + 0.03, uReveal);
          float p = fract(x - uTime * (0.3 + uBoost * 0.45) + uOffset);
          float pulse = smoothstep(0.0, 0.1, p) * smoothstep(0.34, 0.1, p);
          float p2 = fract(x - uTime * 0.19 + uOffset + 0.5);
          float pulse2 = smoothstep(0.0, 0.08, p2) * smoothstep(0.26, 0.08, p2) * 0.4;
          float core = pow(vNV, 1.3);
          float a = (0.12 + 0.2 * uBoost + pulse * (0.65 + 0.5 * uBoost) + pulse2) * ends * rev * core * uFade;
          vec3 c = mix(uColor, uHot, pulse * 0.8);
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    });
    content.add(new THREE.Mesh(geo, mat));
    cd.stream = mat;
  });

  /* =====================================================================
     6. Reflexia pe suprafața întunecată (copie oglindită, se stinge cu înălțimea)
     ===================================================================== */
  const refl = new THREE.Group();
  refl.position.y = 2 * FLOOR_Y; refl.scale.y = -1;
  content.add(refl);
  const REFL_VS = `uniform float uCenterH; varying vec2 vUv; varying float vH;
    void main(){ vUv = uv; vH = uCenterH + position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const REFL_FS = `uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform float uAlpha, uFade;
    varying vec2 vUv; varying float vH;
    void main(){
      vec3 c = uColor; float a = 1.0;
      if (uHasMap > 0.5) { vec4 s = texture2D(uMap, vUv); c = s.rgb * uColor; a = s.a; }
      float f = smoothstep(1.5, 0.0, vH);
      gl_FragColor = vec4(c, uAlpha * f * f * a * uFade);
    }`;
  function reflMat(map, color, alpha) {
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map || null }, uHasMap: { value: map ? 1 : 0 }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uFade: { value: 1 }, uCenterH: { value: 0 } },
      vertexShader: REFL_VS, fragmentShader: REFL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    });
  }
  const reflPairs = [];
  (function buildReflections() {
    const sg = new THREE.Group();
    const rb = new THREE.Mesh(bodyGeo, reflMat(null, 0x16283f, 0.3)); sg.add(rb);
    const rs = new THREE.Mesh(screenGeo, reflMat(screenTex, 0xffffff, 0.2)); rs.position.z = SLAB_D / 2 + 0.002; sg.add(rs);
    refl.add(sg);
    reflPairs.push({ src: slab, dst: sg, mats: [rb.material, rs.material] });
    CARDS.forEach(cd => {
      const cg = new THREE.Group();
      const b = new THREE.Mesh(cardGeo, reflMat(null, 0x14263c, 0.14)); cg.add(b);
      refl.add(cg);
      reflPairs.push({ src: cd.group, dst: cg, mats: [b.material], card: cd });
    });
  })();
  function syncReflections(fade) {
    for (const p of reflPairs) {
      p.dst.position.copy(p.src.position); p.dst.rotation.copy(p.src.rotation); p.dst.scale.copy(p.src.scale);
      const h = p.src.position.y - FLOOR_Y;
      for (const m of p.mats) { m.uniforms.uCenterH.value = h; m.uniforms.uFade.value = fade * (p.card ? (1 - p.card.hover * 0.3) : 1); }
    }
    reflPairs[0].mats[1].uniforms.uColor.value.setScalar(screenMat.color.r);
  }

  /* =====================================================================
     7. Layout: compoziția urmărește elementul .hero-stage din pagină
     ===================================================================== */
  const MODEL_W = 5.35, MODEL_H = 3.4, FIT = 0.98;
  let vw = 1, vh = 1, stageRect = null, pxPerUnit = 100, compactMode = false;
  const ppu = () => vh / (2 * CAM_Z * Math.tan(FOV * Math.PI / 360));
  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    applyPixelRatio();
    renderer.setSize(vw, vh, false);
    pGeo.setDrawRange(0, vw <= 900 ? Math.min(N, 800) : N);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  function applyLayout(compact) {
    compactMode = compact;
    CARDS.forEach(cd => {
      cd.base.set(cd.pos[0] * (compact ? 0.64 : 1), cd.pos[1] * (compact ? 1.04 : 1), cd.pos[2]);
    });
  }
  function placeRoot() {
    if (!stage) { hero.visible = false; return false; }
    const r = stage.getBoundingClientRect();
    stageRect = r;
    if (r.width < 10 || r.height < 10) { hero.visible = false; return false; }
    const k = ppu();
    const compact = r.width < 560;
    if (compact !== compactMode) applyLayout(compact);
    const mw = compact ? 4.0 : MODEL_W;
    hero.position.set((r.left + r.width / 2 - vw / 2) / k, -(r.top + r.height / 2 - vh / 2) / k, 0);
    const s = Math.min(r.width / mw, r.height / MODEL_H) * (compact ? 1.0 : FIT);
    pxPerUnit = s;
    hero.scale.setScalar(s / k);
    return true;
  }
  window.addEventListener('resize', () => { resize(); placeRoot(); if (reduceMotion) frame(); });
  resize();
  applyLayout(false);

  /* ---------- interacțiune ---------- */
  const mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  const pointer = { x: -9999, y: -9999, fine: false };
  window.addEventListener('pointermove', e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.fine = e.pointerType !== 'touch';
    if (e.pointerType === 'touch') return;
    mouse.x = (e.clientX / vw) * 2 - 1;
    mouse.y = -((e.clientY / vh) * 2 - 1);
  }, { passive: true });
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(x, y) {
    if (!stageRect) return -1;
    const mx = stageRect.width * 0.14, my = stageRect.height * 0.14;
    if (x < stageRect.left - mx || x > stageRect.right + mx || y < stageRect.top - my || y > stageRect.bottom + my) return -1;
    ndc.set((x / vw) * 2 - 1, -(y / vh) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitMeshes, false);
    return hit.length ? hit[0].object.userData.card : -1;
  }
  const clock = new THREE.Clock();
  let hovered = -1, stageHover = 0, activeIdx = 0, cycleAt = 0;
  function setModule(i, byUser) {
    const cd = CARDS[i];
    if (dash) {
      let id = cd.id;
      if (cd.alt && activeIdx === i) id = dash.getModule() === cd.id ? cd.alt : cd.id;
      dash.setModule(id);
    }
    activeIdx = i;
    cycleAt = clock.elapsedTime + (byUser ? 9 : 5.5);
  }
  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    const api = window.mdy && window.mdy.cursor;
    if (api) { if (i >= 0) api.set('Vezi soluția'); else api.clear(); }
    if (stage) stage.style.cursor = i >= 0 ? 'pointer' : '';
    if (i >= 0) setModule(i, true);
  }
  if (stage) {
    stage.addEventListener('click', e => {
      const i = pickAt(e.clientX, e.clientY);
      if (i < 0) { setModule((activeIdx + 1) % CARDS.length, true); return; }
      setModule(i, true);
      const svc = document.querySelector('.svc-card[data-svc="' + CARDS[i].svc + '"]');
      if (window.mdy && window.mdy.scrollTo) window.mdy.scrollTo('#solutii');
      if (svc && !svc.classList.contains('is-active')) setTimeout(() => svc.click(), 350);
    });
    stage.addEventListener('pointerleave', () => setHover(-1));
  }

  /* =====================================================================
     8. Pornire: fonturi -> texturi -> intro
     ===================================================================== */
  let introStart = -1, fontsLoaded = false;
  function redrawLabels() {
    CARDS.forEach(cd => { cd.labelMat.map.image = drawLabel(cd, LBL_W, LBL_H); cd.labelMat.map.needsUpdate = true; });
  }
  function begin() {
    if (fontsLoaded) return;
    fontsLoaded = true;
    redrawLabels();
    placeRoot();
    if (introStart < 0) introStart = clock.getElapsedTime();
    cycleAt = introStart + 6.5;
    if (reduceMotion) frame();
  }
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load('700 40px "Barlow Condensed"'),
      document.fonts.load('600 40px "Barlow Condensed"'),
      document.fonts.load('500 20px Inter'),
      document.fonts.load('400 20px Inter')
    ]).then(begin, begin);
    document.fonts.ready.then(() => { if (fontsLoaded) redrawLabels(); });
  } else {
    begin();
  }
  setTimeout(begin, 2200);

  /* =====================================================================
     9. Buclă
     ===================================================================== */
  let pageFade = reduceMotion ? 1 : 0, gFade = 1;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    let t = clock.elapsedTime;
    if (reduceMotion) t = 12;
    if (pageFade < 1) pageFade = Math.min(1, pageFade + dt * 0.7);
    const damp = 1 - Math.exp(-3.6 * dt);          /* netezire independentă de rata de cadre */
    smooth.x += (mouse.x - smooth.x) * damp;
    smooth.y += (mouse.y - smooth.y) * damp;
    const sy = window.scrollY || window.pageYOffset || 0;

    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uScroll.value = sy * 0.0022;
    pMat.uniforms.uOpacity.value = pageFade;

    /* coregrafia depinde de poziția scenei pe ecran, nu de scroll-ul paginii */
    const placed = placeRoot();
    let p = 0;
    if (placed && stageRect) {
      const cyS = stageRect.top + stageRect.height / 2;
      p = clamp((vh * 0.5 - cyS) / (vh * 0.5 + stageRect.height * 0.5), 0, 1);
    }
    const pe = p * p * (3 - 2 * p);
    const visible = placed && p < 0.999;
    hero.visible = visible;
    if (visible) {
      const it = introStart < 0 ? 0 : (reduceMotion ? 99 : t - introStart);
      const fade = 1 - smooth01(0.35, 0.92, p);
      gFade = fade;

      /* dashboard viu + rotirea automată a modulelor când nimeni nu interacționează */
      if (dash && dash.tick(performance.now())) screenTex.needsUpdate = true;
      if (!reduceMotion && it > 3 && t > cycleAt && hovered < 0) {
        const ac = CARDS[activeIdx];
        if (ac.alt && dash && dash.getModule() === ac.id) setModule(activeIdx, false);
        else setModule((activeIdx + 1) % CARDS.length, false);
      }

      /* intro: ecranul urcă și se aprinde, modulele sosesc pe rând, fluxurile se desenează */
      const sIn = easeOut(clamp(it / 1.3, 0, 1));
      const screenOn = easeInOut(clamp((it - 0.55) / 0.95, 0, 1));
      slab.scale.setScalar(0.94 + 0.06 * sIn);
      slab.position.y = (1 - sIn) * -0.25;
      bodyMat.opacity = sIn * fade;
      screenMat.color.setScalar(screenOn * (0.15 + 0.85 * fade));
      coverMat.opacity = screenOn * fade * 0.9;
      backGlow.material.opacity = backGlow.userData.base * screenOn * fade;
      pool.material.opacity = pool.userData.base * screenOn * fade;
      warm.material.opacity = warm.userData.base * sIn * fade;

      const inStage = pointer.fine && stageRect && pointer.x >= stageRect.left && pointer.x <= stageRect.right && pointer.y >= stageRect.top && pointer.y <= stageRect.bottom;
      stageHover += ((inStage && p < 0.2 ? 1 : 0) - stageHover) * damp;

      /* mișcare proprie lentă (mai multe frecvențe, fără ritm vizibil) + răspuns calm la mouse */
      const idleY = reduceMotion ? 0 : Math.sin(t * 0.21) * 0.05 + Math.sin(t * 0.083 + 1.7) * 0.03;
      const idleX = reduceMotion ? 0 : Math.sin(t * 0.17 + 0.6) * 0.025 + Math.sin(t * 0.061 + 2.4) * 0.012;
      const gain = 0.09 + 0.03 * stageHover;
      tilt.rotation.y = smooth.x * gain + idleY - pe * 0.35;
      tilt.rotation.x = -smooth.y * gain * 0.6 + idleX + pe * 0.55;
      tilt.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.14) * 0.008;
      tilt.position.y = (reduceMotion ? 0 : Math.sin(t * 0.47) * 0.035) - pe * 0.4;
      tilt.position.z = -pe * 1.4 + stageHover * 0.04;

      /* hover pe module */
      if (pointer.fine && it > 2.2 && p < 0.2) { scene.updateMatrixWorld(); setHover(pickAt(pointer.x, pointer.y)); }
      else if (hovered >= 0) setHover(-1);

      /* modulele: plutire individuală, paralaxă după adâncime, evidențiere */
      for (let i = 0; i < CARDS.length; i++) {
        const cd = CARDS[i];
        const cIn = easeOut(clamp((it - 0.9 - i * 0.13) / 0.9, 0, 1));
        cd.hover = lerp(cd.hover, hovered === i ? 1 : 0, damp * 2.2);
        cd.active = lerp(cd.active, activeIdx === i ? 1 : 0, damp * 1.6);
        const fx = reduceMotion ? 0 : Math.sin(t * 0.6 + cd.phase) * 0.035;
        const fz = reduceMotion ? 0 : Math.sin(t * 0.45 + cd.phase * 1.3) * 0.03;
        const depth = cd.base.z / 0.84;
        const spread = 1 + pe * 0.55 + (1 - cIn) * 0.5;
        cd.group.position.set(
          cd.base.x * spread + smooth.x * 0.05 * depth,
          cd.base.y * spread + fx + smooth.y * 0.03 * depth + (1 - cIn) * -0.2,
          cd.base.z + fz + cd.hover * 0.14 + cd.active * 0.05 + pe * 0.4
        );
        cd.group.rotation.y = cd.yaw + smooth.x * 0.04 + (reduceMotion ? 0 : Math.sin(t * 0.33 + cd.phase) * 0.03) - cd.hover * 0.06 * Math.sign(cd.yaw || 1);
        cd.group.rotation.x = (reduceMotion ? 0 : Math.sin(t * 0.29 + cd.phase * 0.7) * 0.025) + cd.hover * 0.03;
        const sc = (compactMode ? 0.84 : 1) * (0.9 + 0.1 * easeBack(cIn)) * (1 + cd.hover * 0.06 + cd.active * 0.02);
        cd.group.scale.setScalar(Math.max(0.0001, sc));
        const cf = cIn * fade;
        cd.mat.opacity = 0.88 * cf;
        cd.mat.sheen = 0.4 + cd.hover * 0.6;
        cd.labelMat.opacity = cf * (0.86 + 0.14 * Math.max(cd.hover, cd.active));
        cd.bar.material.opacity = cf * (0.15 + 0.85 * Math.max(cd.hover, cd.active * (0.55 + 0.25 * Math.sin(t * 2.2))));
        cd.icon.userData.update(t, Math.max(cd.hover, cd.active * 0.6, stageHover * 0.3));
        cd.icon.rotation.y = (reduceMotion ? 0 : Math.sin(t * 0.5 + cd.phase) * 0.12) + cd.hover * 0.2;
        cd.icon.position.y = 0.01 + (reduceMotion ? 0 : Math.sin(t * 0.9 + cd.phase) * 0.012);
        const st = cd.stream.uniforms;
        st.uTime.value = t; st.uFade.value = fade;
        st.uReveal.value = easeInOut(clamp((it - 1.5 - i * 0.1) / 1.1, 0, 1));
        st.uBoost.value = Math.max(cd.hover, cd.active * 0.8);
      }
      for (const m of iconMats) m.opacity = fade * (m === M.glass ? 0.92 : 1);

      syncReflections(fade);
    }

    camera.position.x += (smooth.x * 0.14 - camera.position.x) * 0.05;
    camera.position.y += (smooth.y * 0.09 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  /* ---------- ciclul de viață al buclei ---------- */
  let lost = false, samples = 0, slowTime = 0, lastNow = 0;
  function tick(now) {
    const delta = lastNow ? (now - lastNow) / 1000 : 1 / 60;
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
  window.addEventListener('scroll', () => { if (reduceMotion && !lost) frame(); }, { passive: true });
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', e => { reduceMotion = e.matches; syncLoop(); });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    lost = true;
    noGL();
    syncLoop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    resize(); placeRoot();
    root.classList.remove('no-webgl'); root.classList.add('has-webgl');
    syncLoop();
  });

  /* cârlig de depanare: oprește/pornește bucla (util pentru capturi de ecran) */
  window.mdyScene = {
    stop: () => renderer.setAnimationLoop(null),
    start: syncLoop,
    render: frame,
    capture: pr => { renderer.setPixelRatio(pr); renderer.setSize(vw, vh, false); frame(); const p = new Promise(r => canvas.toBlob(r, 'image/png')); applyPixelRatio(); renderer.setSize(vw, vh, false); return p; },
    setModule: i => setModule(typeof i === 'number' ? i : Math.max(0, CARDS.findIndex(c => c.id === i)), true),
    info: () => ({ pxPerUnit, compact: compactMode, active: CARDS[activeIdx].id, hovered, stage: stageRect && [stageRect.left, stageRect.top, stageRect.width, stageRect.height], root: hero.position.toArray(), scale: hero.scale.x, pr: renderer.getPixelRatio(), vw, vh, dash: !!dash })
  };

  syncLoop();
})();
