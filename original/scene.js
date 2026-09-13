/* MDY Solutions — scenă WebGL persistentă (Three.js r128, global THREE)
   Nucleu-scut (sferă fresnel) + carcasă icosaedrică cu noduri și impulsuri
   care circulă pe muchii + inele orbitale cu sateliți + câmp de particule.
   Parallax la mouse, dizolvare la scroll, fallback CSS fără WebGL. */
(function () {
  'use strict';
  var canvas = document.getElementById('scene');
  if (!canvas) return;
  var root = document.documentElement;
  if (!window.THREE) { root.classList.add('no-webgl'); return; }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = getComputedStyle(root);
  function cssColor(name, fallback) {
    var v = css.getPropertyValue(name).trim();
    return new THREE.Color(v || fallback);
  }
  var C_ACCENT = cssColor('--accent', '#4f7cff');
  var C_GLOW   = cssColor('--glow',   '#7fe0ff');
  var C_SIGNAL = cssColor('--signal', '#ffb454');

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { root.classList.add('no-webgl'); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  root.classList.add('has-webgl');

  var scene  = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* ---------- sprite radial generat procedural (fără imagini externe) ---------- */
  function makeSprite() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var sprite = makeSprite();

  /* ---------- nucleul: grup ---------- */
  var core = new THREE.Group();
  scene.add(core);
  var fadeables = []; /* { mat, base } */
  function track(mat, base) { fadeables.push({ mat: mat, base: base }); return mat; }

  /* sferă interioară — shader fresnel + linie de scanare + meridiane fine */
  var innerMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColorA: { value: C_ACCENT },
      uColorB: { value: C_GLOW }
    },
    vertexShader: [
      'varying vec3 vNormal; varying vec3 vPos; varying vec3 vView;',
      'void main(){',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vView = normalize(-mv.xyz);',
      '  vPos = position;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime; uniform float uOpacity; uniform vec3 uColorA; uniform vec3 uColorB;',
      'varying vec3 vNormal; varying vec3 vPos; varying vec3 vView;',
      'void main(){',
      '  float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);',
      '  float scanY = sin(uTime * 0.55) * 0.95;',
      '  float band = 1.0 - smoothstep(0.0, 0.05, abs(vPos.y - scanY));',
      '  float lat = 1.0 - smoothstep(0.0, 0.06, abs(fract(vPos.y * 5.0 + 0.5) - 0.5));',
      '  float lon = 1.0 - smoothstep(0.0, 0.06, abs(fract(atan(vPos.z, vPos.x) * 2.5 + 0.5) - 0.5));',
      '  vec3 base = vec3(0.016, 0.03, 0.07);',
      '  vec3 col = mix(base, uColorA, fres * 0.85);',
      '  col += uColorA * (lat + lon) * 0.08 * (0.4 + fres);',
      '  col += uColorB * band * 1.6;',
      '  float alpha = (0.55 + fres * 0.45) * uOpacity;',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: true
  });
  var inner = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 4), innerMat);
  core.add(inner);

  /* carcasă: muchii + noduri */
  var shellGeo = new THREE.IcosahedronGeometry(1.75, 1);
  var edgesGeo = new THREE.EdgesGeometry(shellGeo);
  var shellMat = track(new THREE.LineBasicMaterial({ color: C_ACCENT, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }), 0.32);
  core.add(new THREE.LineSegments(edgesGeo, shellMat));

  var ep = edgesGeo.attributes.position.array;
  var verts = [], vIndex = {}, edges = [];
  function key(x, y, z) { return x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3); }
  function addV(x, y, z) {
    var k = key(x, y, z);
    if (vIndex[k] === undefined) { vIndex[k] = verts.length; verts.push(new THREE.Vector3(x, y, z)); }
    return vIndex[k];
  }
  for (var i = 0; i < ep.length; i += 6) {
    edges.push([addV(ep[i], ep[i + 1], ep[i + 2]), addV(ep[i + 3], ep[i + 4], ep[i + 5])]);
  }
  var adj = verts.map(function () { return []; });
  edges.forEach(function (e, idx) { adj[e[0]].push(idx); adj[e[1]].push(idx); });

  var nodeGeo = new THREE.BufferGeometry().setFromPoints(verts);
  var nodeMat = track(new THREE.PointsMaterial({ size: 0.11, map: sprite, color: C_GLOW, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0.9);
  core.add(new THREE.Points(nodeGeo, nodeMat));

  /* impulsuri care circulă pe muchii (semnalul în rețea) */
  var PULSES = 16, pulses = [];
  function newPulse(fromV) {
    var e, ed, a, b;
    if (fromV === undefined) {
      e = Math.floor(Math.random() * edges.length); ed = edges[e];
      if (Math.random() < 0.5) { a = ed[0]; b = ed[1]; } else { a = ed[1]; b = ed[0]; }
      return { a: a, b: b, t: Math.random(), speed: 0.45 + Math.random() * 0.55 };
    }
    var list = adj[fromV]; e = list[Math.floor(Math.random() * list.length)]; ed = edges[e];
    a = fromV; b = (ed[0] === a) ? ed[1] : ed[0];
    return { a: a, b: b, t: 0, speed: 0.45 + Math.random() * 0.55 };
  }
  for (i = 0; i < PULSES; i++) pulses.push(newPulse());
  var pulseArr = new Float32Array(PULSES * 3);
  var pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulseArr, 3));
  var pulseMat = track(new THREE.PointsMaterial({ size: 0.2, map: sprite, color: C_GLOW, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }), 1);
  core.add(new THREE.Points(pulseGeo, pulseMat));
  var tmpV = new THREE.Vector3();
  function updatePulses(dt) {
    for (var k = 0; k < PULSES; k++) {
      var p = pulses[k]; p.t += dt * p.speed;
      if (p.t >= 1) { pulses[k] = p = newPulse(p.b); }
      tmpV.copy(verts[p.a]).lerp(verts[p.b], p.t);
      pulseArr[k * 3] = tmpV.x; pulseArr[k * 3 + 1] = tmpV.y; pulseArr[k * 3 + 2] = tmpV.z;
    }
    pulseGeo.attributes.position.needsUpdate = true;
  }

  /* halou moale în spate */
  var haloMat = track(new THREE.SpriteMaterial({ map: sprite, color: C_ACCENT, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }), 0.28);
  var halo = new THREE.Sprite(haloMat); halo.scale.setScalar(7.5); halo.position.z = -0.5;
  core.add(halo);

  /* inele orbitale cu sateliți */
  function makeRing(radius, tiltX, tiltZ, color, opacity, satColor) {
    var g = new THREE.Group();
    var ringMat = track(new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false }), opacity);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.011, 8, 260), ringMat));
    var sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute([radius, 0, 0], 3));
    var sMat = track(new THREE.PointsMaterial({ size: 0.26, map: sprite, color: satColor, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }), 1);
    var sat = new THREE.Points(sGeo, sMat);
    g.add(sat);
    g.rotation.x = tiltX; g.rotation.z = tiltZ;
    g.userData = { sat: sat, radius: radius, phase: Math.random() * 6.283, speed: 0.22 + Math.random() * 0.18, dir: Math.random() < 0.5 ? 1 : -1 };
    return g;
  }
  var ringA = makeRing(2.35, 1.25, 0.35, C_ACCENT, 0.55, C_GLOW);
  var ringB = makeRing(2.75, -0.55, 1.0, C_ACCENT, 0.35, C_SIGNAL);
  core.add(ringA); core.add(ringB);
  function updateRing(g, t) {
    var u = g.userData, a = u.phase + t * u.speed * u.dir;
    u.sat.position.set(Math.cos(a) * u.radius, Math.sin(a) * u.radius, 0);
    g.rotation.y += 0.0006 * u.dir;
  }

  function setFade(f) {
    for (var k = 0; k < fadeables.length; k++) fadeables[k].mat.opacity = fadeables[k].base * f;
    innerMat.uniforms.uOpacity.value = f;
  }

  /* ---------- câmp de particule ambientale (toată pagina) ---------- */
  var N = 1600, pPos = new Float32Array(N * 3), pSize = new Float32Array(N), pPhase = new Float32Array(N);
  for (i = 0; i < N; i++) {
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
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }, uColor: { value: C_GLOW }, uOpacity: { value: 1 } },
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
      '  gl_FragColor = vec4(uColor, a * vAlpha * 0.55 * uOpacity);',
      '}'
    ].join('\n'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.Points(pGeo, pMat));

  /* ---------- layout / input ---------- */
  var baseX = 2.4, baseScale = 0.85, baseOpacity = 1, heroH = 800;
  var mouse = { x: 0, y: 0 }, smooth = { x: 0, y: 0 };
  function layout() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    var narrow = w < 900;
    baseX = narrow ? 0 : 2.35 * Math.min(Math.max(camera.aspect / 1.6, 0.7), 1.15);
    baseScale = narrow ? 0.58 : (camera.aspect < 1.3 ? 0.72 : 0.85);
    baseOpacity = narrow ? 0.6 : 1;
    var hero = document.getElementById('hero');
    heroH = hero ? hero.offsetHeight : h;
    pMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  window.addEventListener('resize', layout);
  layout();
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  /* ---------- buclă ---------- */
  var clock = new THREE.Clock();
  var pageFade = 0; /* intro: nucleul se asamblează */
  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (pageFade < 1) pageFade = Math.min(1, pageFade + dt * 0.7);
    smooth.x += (mouse.x - smooth.x) * 0.045;
    smooth.y += (mouse.y - smooth.y) * 0.045;
    var sy = window.scrollY || window.pageYOffset || 0;
    var p = Math.min(Math.max(sy / (heroH * 0.9), 0), 1);
    var fade = (1 - p) * pageFade;
    core.visible = fade > 0.01;
    if (core.visible) {
      var ease = 1 - Math.pow(1 - pageFade, 3);
      core.position.set(baseX, p * 2.4 - (1 - ease) * 0.6, 0);
      core.scale.setScalar(baseScale * (0.7 + 0.3 * ease) * (1 - 0.3 * p));
      core.rotation.y = t * 0.11 + smooth.x * 0.45;
      core.rotation.x = smooth.y * 0.28 + Math.sin(t * 0.3) * 0.05;
      setFade(fade * baseOpacity);
      innerMat.uniforms.uTime.value = t;
      updatePulses(dt);
      updateRing(ringA, t); updateRing(ringB, t);
    }
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uScroll.value = sy * 0.0022;
    pMat.uniforms.uOpacity.value = pageFade;
    camera.position.x += (smooth.x * 0.35 - camera.position.x) * 0.05;
    camera.position.y += (smooth.y * 0.22 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  if (reduceMotion) {
    pageFade = 1;
    frame();
    window.addEventListener('scroll', frame, { passive: true });
    window.addEventListener('resize', frame);
  } else {
    renderer.setAnimationLoop(frame);
  }
})();
