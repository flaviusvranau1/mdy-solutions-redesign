/* MDY — studio-lit kinetic sculpture. Three.js r128; procedural assets only. */
(function () {
  "use strict";
  var root = document.documentElement,
    canvas = document.getElementById("scene"),
    stage = document.querySelector(".hero-stage");
  if (!canvas || !stage) return;
  if (!window.THREE) {
    root.classList.add("no-webgl");
    return;
  }
  var motion = matchMedia("(prefers-reduced-motion: reduce)"),
    reduced = motion.matches;
  var compact = matchMedia("(max-width: 900px)").matches;
  var renderer,
    environment,
    observer,
    frameId = 0,
    visible = false,
    lost = false,
    lastTime = 0,
    elapsed = 0;
  var intro = reduced ? 1 : 0,
    pointer = { x: 0, y: 0 },
    smooth = { x: 0, y: 0 };
  var quality = 1,
    samples = 0,
    totalTime = 0,
    TAU = Math.PI * 2,
    seed = 4821;
  var viewWidth = innerWidth, viewHeight = innerHeight, stageRect;
  var scrollPosition = window.scrollY || 0, smoothScroll = scrollPosition;
  function random() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function damp(a, b, speed, dt) {
    return a + (b - a) * (1 - Math.exp(-speed * dt));
  }
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      powerPreference: "default",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    var scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(39, 1, 0.1, 40);
    camera.position.set(0, 0.15, 8.8);
    var core = new THREE.Group();
    scene.add(core);

    // Bake softbox reflections once; the studio is never drawn per animation frame.
    function makeEnvironment() {
      var studio = new THREE.Scene();
      studio.background = new THREE.Color(0x142534);
      var geometry = new THREE.PlaneGeometry(1, 1);
      function panel(x, y, z, w, h, color, intensity) {
        var mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(color).multiplyScalar(intensity),
            side: THREE.DoubleSide,
          }),
        );
        mesh.position.set(x, y, z);
        mesh.scale.set(w, h, 1);
        mesh.lookAt(0, 0, 0);
        studio.add(mesh);
      }
      panel(-3, 4, 4, 3, 5, 0xe2faff, 3.5);
      panel(4, 1, 2, 1.2, 5, 0x36cfd5, 2.3);
      panel(0, 5, -3, 4, 2, 0xb4cddd, 2.5);
      panel(-4, -1, -2, 2, 3, 0x168b94, 1.8);
      panel(3, -2, -4, 1, 3, 0xffc487, 1.6);
      var pmrem = new THREE.PMREMGenerator(renderer),
        result = pmrem.fromScene(studio, 0.025, 0.1, 30);
      studio.children.forEach(function (mesh) {
        mesh.material.dispose();
      });
      geometry.dispose();
      pmrem.dispose();
      return result;
    }
    environment = makeEnvironment();
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight(0xc4faff, 0x071521, 0.65));
    function light(color, intensity, x, y, z) {
      var lamp = new THREE.DirectionalLight(color, intensity);
      lamp.position.set(x, y, z);
      scene.add(lamp);
    }
    light(0xd8faff, 2.4, -3, 4, 5);
    light(0x19cbd3, 1.8, 4, 0, -2);
    light(0xffba76, 0.65, -3, -2, 1);

    var glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 64;
    var ctx = glowCanvas.getContext("2d"),
      gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(0.14, "rgba(255,255,255,.85)");
    gradient.addColorStop(0.42, "rgba(255,255,255,.18)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    var sprite = new THREE.CanvasTexture(glowCanvas);
    // Machined grooves underneath a clear coated metallic surface.
    var surface = document.createElement("canvas");
    surface.width = 1024;
    surface.height = 512;
    ctx = surface.getContext("2d");
    ctx.fillStyle = "#b5b5b5";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = "#777";
    ctx.lineWidth = 1.5;
    for (var i = 1; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i * 512) / 12);
      ctx.lineTo(1024, (i * 512) / 12);
      ctx.stroke();
    }
    for (i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 1024) / 24, 0);
      ctx.lineTo((i * 1024) / 24, 512);
      ctx.stroke();
    }
    var sphereMat = new THREE.MeshPhysicalMaterial({
      color: 0x245661,
      metalness: 0.86,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.35,
      bumpMap: new THREE.CanvasTexture(surface),
      bumpScale: 0.018,
    });
    var inner = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 64, 40),
      sphereMat,
    );
    sphereMat.color.convertSRGBToLinear();
    core.add(inner);
    var scanMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x55e6e5) },
      },
      vertexShader:
        "varying vec3 vPos; varying vec3 vNormal; varying vec3 vView; void main(){vPos=position; vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vView=-mv.xyz; gl_Position=projectionMatrix*mv;}",
      fragmentShader:
        "uniform float uTime; uniform vec3 uColor; varying vec3 vPos; varying vec3 vNormal; varying vec3 vView; void main(){float f=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.5); float b=1.0-smoothstep(0.003,0.028,abs(vPos.y-sin(uTime*0.32)*0.93)); gl_FragColor=vec4(uColor,f*0.28+b*0.5);}",
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1.086, 64, 40), scanMat));
    var metal = new THREE.MeshStandardMaterial({
      color: 0x45616d,
      metalness: 0.95,
      roughness: 0.24,
      envMapIntensity: 1.6,
    });
    metal.color.convertSRGBToLinear();
    var silver = new THREE.MeshStandardMaterial({
      color: 0xb9d4dc,
      metalness: 0.9,
      roughness: 0.2,
    });
    var luminous = new THREE.MeshBasicMaterial({
      color: 0x72f7ed,
      toneMapped: false,
    });
    var badge = new THREE.Group();
    badge.position.z = 1.025;
    var hex = new THREE.Shape();
    for (i = 0; i < 6; i++) {
      var a = (i / 6) * TAU + Math.PI / 6;
      if (!i) hex.moveTo(Math.cos(a) * 0.34, Math.sin(a) * 0.34);
      else hex.lineTo(Math.cos(a) * 0.34, Math.sin(a) * 0.34);
    }
    hex.closePath();
    badge.add(
      new THREE.Mesh(
        new THREE.ExtrudeGeometry(hex, {
          depth: 0.045,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: 0.014,
          bevelThickness: 0.014,
        }),
        metal,
      ),
    );
    var mark = [
      [-0.16, -0.14],
      [-0.16, 0.13],
      [0, -0.015],
      [0.16, 0.13],
      [0.16, -0.14],
    ].map(function (p) {
      return new THREE.Vector3(p[0], p[1], 0.071);
    });
    for (i = 0; i < mark.length - 1; i++)
      badge.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.LineCurve3(mark[i], mark[i + 1]),
            1,
            0.015,
            6,
            false,
          ),
          luminous,
        ),
      );
    core.add(badge);

    var shellGeo = new THREE.IcosahedronGeometry(1.6, 1),
      edgesGeo = new THREE.EdgesGeometry(shellGeo);
    shellGeo.dispose();
    var cage = new THREE.Group();
    core.add(cage);
    cage.add(
      new THREE.LineSegments(
        edgesGeo,
        new THREE.LineBasicMaterial({
          color: 0x36aeb9,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      ),
    );
    var positions = edgesGeo.attributes.position.array,
      vertices = [],
      ids = {},
      edges = [];
    function vertex(x, y, z) {
      var id = x.toFixed(4) + "," + y.toFixed(4) + "," + z.toFixed(4);
      if (ids[id] === undefined) {
        ids[id] = vertices.length;
        vertices.push(new THREE.Vector3(x, y, z));
      }
      return ids[id];
    }
    for (i = 0; i < positions.length; i += 6)
      edges.push([
        vertex(positions[i], positions[i + 1], positions[i + 2]),
        vertex(positions[i + 3], positions[i + 4], positions[i + 5]),
      ]);
    // All solid nodes share one draw call.
    var nodes = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.032, 10, 8),
        silver,
        vertices.length,
      ),
      matrix = new THREE.Matrix4();
    vertices.forEach(function (v, index) {
      matrix.makeTranslation(v.x, v.y, v.z);
      nodes.setMatrixAt(index, matrix);
    });
    cage.add(nodes);
    cage.add(
      new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(vertices),
        new THREE.PointsMaterial({
          map: sprite,
          color: 0x68eee5,
          size: 0.085,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    var adjacency = vertices.map(function () {
      return [];
    });
    edges.forEach(function (e) {
      adjacency[e[0]].push(e[1]);
      adjacency[e[1]].push(e[0]);
    });
    var pulses = [],
      pulseCount = compact ? 7 : 12,
      trailLength = 5;
    for (i = 0; i < pulseCount; i++) {
      var edge = edges[Math.floor(random() * edges.length)];
      pulses.push({
        a: edge[0],
        b: edge[1],
        progress: random(),
        speed: 0.24 + random() * 0.25,
      });
    }
    var pulseArray = new Float32Array(pulseCount * trailLength * 3),
      pulseColors = new Float32Array(pulseArray.length),
      pulseColor = new THREE.Color(0x8ff7f7);
    for (i = 0; i < pulseCount * trailLength; i++) {
      var strength = 1 - (i % trailLength) / trailLength;
      pulseColors[i * 3] = pulseColor.r * strength;
      pulseColors[i * 3 + 1] = pulseColor.g * strength;
      pulseColors[i * 3 + 2] = pulseColor.b * strength;
    }
    var pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(pulseArray, 3).setUsage(THREE.DynamicDrawUsage),
    );
    pulseGeo.setAttribute("color", new THREE.BufferAttribute(pulseColors, 3));
    var pulsePoints = new THREE.Points(
      pulseGeo,
      new THREE.PointsMaterial({
        size: 0.11,
        map: sprite,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    pulsePoints.frustumCulled = false;
    cage.add(pulsePoints);
    var temp = new THREE.Vector3();
    function updatePulses(dt) {
      pulses.forEach(function (p, index) {
        p.progress += dt * p.speed;
        if (p.progress >= 1) {
          p.progress -= 1;
          var previous = p.a;
          p.a = p.b;
          var choices = adjacency[p.a].filter(function (v) {
            return v !== previous;
          });
          p.b = choices[Math.floor(random() * choices.length)];
        }
        for (var j = 0; j < trailLength; j++) {
          temp
            .copy(vertices[p.a])
            .lerp(vertices[p.b], Math.max(0, p.progress - j * 0.035));
          temp.toArray(pulseArray, (index * trailLength + j) * 3);
        }
      });
      pulseGeo.attributes.position.needsUpdate = true;
    }

    function makeOrbit(radius, tiltX, tiltZ, phase, speed, warm) {
      var group = new THREE.Group();
      group.rotation.set(tiltX, 0, tiltZ);
      group.add(
        new THREE.Mesh(new THREE.TorusGeometry(radius, 0.016, 8, 160), metal),
      );
      var rail = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.005, 6, 160),
        luminous,
      );
      rail.position.z = 0.016;
      group.add(rail);
      var arc = new THREE.Mesh(
        new THREE.TorusGeometry(radius + 0.047, 0.008, 6, 80, Math.PI * 0.62),
        silver,
      );
      arc.rotation.z = phase;
      group.add(arc);
      var sat = new THREE.Group();
      sat.add(new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), silver));
      var glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sprite,
          color: warm ? 0xffbe7a : 0x8ff7f7,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.scale.setScalar(0.39);
      sat.add(glow);
      group.add(sat);
      // Geometry is centered at zero; only the parent sets orbital position.
      group.userData = {
        radius: radius,
        phase: phase,
        speed: speed,
        sat: sat,
        tilt: tiltX,
        roll: tiltZ,
        arc: arc,
      };
      core.add(group);
      return group;
    }
    var orbits = [
      makeOrbit(2.03, 1.08, 0.34, 0.4, 0.42, false),
      makeOrbit(2.43, -0.73, 0.87, 3.7, -0.32, true),
    ];
    function updateOrbits(t) {
      orbits.forEach(function (o) {
        var d = o.userData,
          a = d.phase + t * d.speed;
        d.sat.position.set(Math.cos(a) * d.radius, Math.sin(a) * d.radius, 0);
        var direction = d.speed > 0 ? 1 : -1;
        o.rotation.y = t * 0.12 * direction + Math.sin(t * 0.24 + d.phase) * 0.18;
        o.rotation.x = d.tilt + Math.sin(t * 0.31 + d.phase) * 0.2;
        o.rotation.z = d.roll + Math.sin(t * 0.2 + d.phase) * 0.12;
        d.arc.rotation.z = d.phase + t * 0.16 * direction;
      });
    }
    var halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sprite,
        color: 0x1697a4,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.position.z = -2;
    halo.scale.setScalar(6.8);
    scene.add(halo);
    // The original full-page star field returns in a single GPU draw call.
    // Share this renderer with the hero: no second WebGL context or DOM particle loop.
    var atmosphere = new THREE.Scene();
    var atmosphereCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    atmosphereCamera.position.z = 9;
    var particleCount = 1600;
    var particlePositions = new Float32Array(particleCount * 3);
    var particleSizes = new Float32Array(particleCount);
    var particlePhases = new Float32Array(particleCount);
    for (i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (random() - 0.5) * 30;
      particlePositions[i * 3 + 1] = (random() - 0.5) * 18;
      particlePositions[i * 3 + 2] = -14 + random() * 16;
      particleSizes[i] = 0.6 + Math.pow(random(), 3) * 3.2;
      particlePhases[i] = random() * TAU;
    }
    var particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));
    particleGeometry.setAttribute('aPhase', new THREE.BufferAttribute(particlePhases, 1));
    var particleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uScroll: { value: 0 },
        uPixelRatio: { value: 1 }, uOpacity: { value: 1 },
        uColor: { value: new THREE.Color(0x8ff7f7) }
      },
      vertexShader: [
        'attribute float aSize; attribute float aPhase;',
        'uniform float uTime; uniform float uScroll; uniform float uPixelRatio;',
        'varying float vAlpha;',
        'void main() {',
        '  vec3 p = position;',
        '  p.x += cos(uTime * 0.12 + aPhase * 1.7) * 0.25;',
        '  p.y += sin(uTime * 0.16 + aPhase) * 0.25 + uScroll;',
        '  p.y = mod(p.y + 9.0, 18.0) - 9.0;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = min(18.0, aSize * uPixelRatio * (34.0 / -mv.z));',
        '  vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.9 + aPhase * 6.0));',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;',
        'void main() {',
        '  float d = length(gl_PointCoord - 0.5);',
        '  float a = 1.0 - smoothstep(0.05, 0.5, d); a *= a;',
        '  gl_FragColor = vec4(uColor, a * vAlpha * 0.55 * uOpacity);',
        '}'
      ].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    atmosphere.add(new THREE.Points(particleGeometry, particleMaterial));
    renderer.autoClear = false;

    function readStage() {
      stageRect = stage.getBoundingClientRect();
      scrollPosition = window.scrollY || 0;
    }

    function layout() {
      var w = stage.clientWidth,
        h = stage.clientHeight;
      if (!w || !h || lost) return;
      compact = matchMedia('(max-width: 900px)').matches;
      viewWidth = window.innerWidth;
      viewHeight = window.innerHeight;
      renderer.setPixelRatio(
        Math.min(
          devicePixelRatio || 1,
          compact ? 1.35 : 1.65,
          Math.sqrt(2400000 / (viewWidth * viewHeight)),
        ) * quality,
      );
      renderer.setSize(viewWidth, viewHeight, false);
      particleGeometry.setDrawRange(0, compact ? Math.min(850, particleCount) : particleCount);
      particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      atmosphereCamera.aspect = viewWidth / viewHeight;
      atmosphereCamera.updateProjectionMatrix();
      camera.aspect = w / h;
      camera.position.z =
        camera.aspect < 0.95 ? (8.8 * 0.95) / camera.aspect : 8.8;
      camera.updateProjectionMatrix();
      readStage();
      if (reduced || !visible) render(0);
    }
    function render(dt) {
      if (lost) return;
      var step = reduced ? 0 : dt;
      elapsed += step;
      intro = reduced ? 1 : Math.min(1, intro + step * 0.9);
      smooth.x = reduced ? 0 : damp(smooth.x, pointer.x, 4.5, dt);
      smooth.y = reduced ? 0 : damp(smooth.y, pointer.y, 4.5, dt);
      smoothScroll = reduced ? scrollPosition : damp(smoothScroll, scrollPosition, 8, dt);
      var ease = 1 - Math.pow(1 - intro, 3);
      particleMaterial.uniforms.uTime.value = elapsed;
      particleMaterial.uniforms.uScroll.value = reduced ? 0 : smoothScroll * 0.0022;
      particleMaterial.uniforms.uOpacity.value = ease;
      atmosphereCamera.position.x = smooth.x * 0.35;
      atmosphereCamera.position.y = smooth.y * 0.22;
      atmosphereCamera.lookAt(0, 0, 0);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, viewWidth, viewHeight);
      renderer.clear();
      renderer.render(atmosphere, atmosphereCamera);

      // The sculpture keeps its own responsive stage while stars span the whole page.
      // Below the hero only the single particle draw call remains active.
      if (stageRect && stageRect.bottom > 0 && stageRect.top < viewHeight) {
        core.scale.setScalar(0.83 + ease * 0.17);
        core.position.x = Math.sin(elapsed * 0.24) * 0.055 + smooth.x * 0.1;
        core.position.y = -0.2 * (1 - ease) + Math.sin(elapsed * 0.58) * 0.1;
        core.rotation.x = smooth.y * 0.25 + Math.sin(elapsed * 0.33) * 0.12 + 0.08;
        core.rotation.y = elapsed * 0.11 + smooth.x * 0.45 - 0.12;
        core.rotation.z = Math.sin(elapsed * 0.22) * 0.075;
        inner.rotation.y = elapsed * 0.045;
        cage.rotation.y = elapsed * 0.085;
        cage.rotation.x = Math.sin(elapsed * 0.26) * 0.1;
        cage.rotation.z = 0.16;
        scanMat.uniforms.uTime.value = elapsed;
        updatePulses(step);
        updateOrbits(elapsed);
        camera.position.x = smooth.x * 0.22;
        camera.position.y = 0.15 + smooth.y * 0.16;
        camera.lookAt(0, 0, 0);
        renderer.setViewport(stageRect.left, viewHeight - stageRect.bottom, stageRect.width, stageRect.height);
        renderer.setScissor(stageRect.left, viewHeight - stageRect.bottom, stageRect.width, stageRect.height);
        renderer.setScissorTest(true);
        renderer.clearDepth();
        renderer.render(scene, camera);
        renderer.setScissorTest(false);
      }
    }
    function frame(now) {
      frameId = 0;
      if (document.hidden || lost || reduced) return;
      var delta = lastTime ? (now - lastTime) / 1000 : 1 / 60;
      lastTime = now;
      render(Math.min(delta, 0.05));
      // Only reduce resolution after sustained slow rendering; no per-frame oscillation.
      if (visible && intro === 1 && quality === 1 && delta < 0.1) {
        totalTime += delta;
        samples++;
        if (samples === 120) {
          if (totalTime / samples > 1 / 43) {
            quality = 0.8;
            layout();
          }
          samples = 0;
          totalTime = 0;
        }
      }
      frameId = requestAnimationFrame(frame);
    }
    function syncLoop() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      lastTime = 0;
      if (document.hidden || lost) return;
      if (reduced) render(0);
      else frameId = requestAnimationFrame(frame);
    }
    window.addEventListener(
      "pointermove",
      function (e) {
        if (reduced || e.pointerType === "touch") return;
        pointer.x = (e.clientX / viewWidth) * 2 - 1;
        pointer.y = -((e.clientY / viewHeight) * 2 - 1);
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", function () {
      pointer.x = pointer.y = 0;
    });
    document.addEventListener("visibilitychange", syncLoop);
    window.addEventListener('scroll', function () {
      readStage();
      if (reduced && !document.hidden) render(0);
    }, { passive: true });
    window.addEventListener('resize', layout, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    motion.addEventListener("change", function (e) {
      reduced = e.matches;
      intro = 1;
      pointer.x = pointer.y = 0;
      syncLoop();
    });
    canvas.addEventListener("webglcontextlost", function (e) {
      e.preventDefault();
      lost = true;
      root.classList.remove("has-webgl");
      root.classList.add("no-webgl");
      syncLoop();
    });
    canvas.addEventListener("webglcontextrestored", function () {
      try {
        environment.dispose();
        environment = makeEnvironment();
        scene.environment = environment.texture;
        lost = false;
        layout();
        render(0);
        root.classList.remove("no-webgl");
        root.classList.add("has-webgl");
        syncLoop();
      } catch (e) {
        lost = true;
      }
    });
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
    if (window.IntersectionObserver) {
      observer = new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          syncLoop();
        },
        { rootMargin: "60px" },
      );
      observer.observe(stage);
    } else visible = true;
    layout();
    render(0);
    root.classList.remove("no-webgl");
    root.classList.add("has-webgl");
    syncLoop();
  } catch (error) {
    cancelAnimationFrame(frameId);
    if (observer) observer.disconnect();
    if (environment) environment.dispose();
    if (renderer) renderer.dispose();
    root.classList.remove("has-webgl");
    root.classList.add("no-webgl");
    console.warn("MDY: using the static scene fallback.", error);
  }
})();
