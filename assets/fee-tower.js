// Fee page: "the architecture of one fee". A stone tower of the 1930s is built on the page's drafting sheet. It
// is drawn first as a blueprint in fine lines; then, as the visitor scrolls, its pieces fly in from beyond the edges
// of the view and are set in place one after another, so every movement adds something: the steps and the podium
// with its doorway (financial planning); the glass floor by floor, the rooms behind it, then the stone piers
// (investment management); the setbacks course by course, each narrower (coordination); and the crown, lowered on to
// its dark cupola (ongoing strategy). It is complete as the last line arrives; then the steps warm, top to bottom.
// A gold line tracks the way through, and a prompt to scroll appears whenever the visitor stops. One
// spring-smoothed scroll position drives every movement, and nothing moves unless the page scrolls.
// Studio light, soft shadows and ambient occlusion give it the look of a photographed model. The lines are
// ordinary HTML and read in order without this script; without WebGL a still stands in.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const sec = document.querySelector('.build');
if (sec) start();

function start() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beats = [...sec.querySelectorAll('.beat')];
  const dots = [...sec.querySelectorAll('.build__rail i')];
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const settle = (t) => t * t * t * (t * (6 * t - 15) + 10); // leaves gently and touches down gently
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); // the same model every visit

  // ---------- where each line is: its top and bottom in screen heights (1 = the foot of the screen) ----------
  const where = () => beats.map((b) => { const r = b.getBoundingClientRect(); return [r.top / innerHeight, r.bottom / innerHeight]; });
  // a line fades in as it rises into place and out as the next one arrives, with no blank stretch between
  const presence = (w, i) => Math.min(i === 0 ? 1 : clamp01((0.64 - w[i][0]) / 0.32), i === beats.length - 1 ? 1 : clamp01((w[i][1] - 0.64) / 0.32));
  const progress = () => clamp01(-sec.getBoundingClientRect().top / Math.max(1, sec.offsetHeight - innerHeight));

  // ---------- the way through: the gold line, its marks, and the prompt when the visitor stops ----------
  let idle = 0;
  const cue = (show) => sec.classList.toggle('cue', show);
  const waitForScroll = (ms) => {
    clearTimeout(idle);
    idle = setTimeout(() => {
      const r = sec.getBoundingClientRect();
      cue(r.top < innerHeight * 0.5 && r.bottom > innerHeight && progress() < 0.97); // only inside the walk, not at its end
    }, ms);
  };
  const ui = (w) => {
    beats.forEach((b, i) => { b.firstElementChild.style.opacity = presence(w, i).toFixed(3); });
    sec.style.setProperty('--p', progress().toFixed(4));
    dots.forEach((d, i) => d.classList.toggle('on', w[i + 1] && w[i + 1][0] < 0.45));
  };
  const placeMarks = () => { // each mark sits where its part lands on the way through
    const span = Math.max(1, sec.offsetHeight - innerHeight);
    dots.forEach((d, i) => d.style.setProperty('--at', `${(clamp01((beats[i + 1].offsetTop - 0.45 * innerHeight) / span) * 100).toFixed(2)}%`));
  };
  placeMarks();
  addEventListener('resize', placeMarks);
  addEventListener('scroll', () => { cue(false); waitForScroll(2200); }, { passive: true });
  waitForScroll(1200);

  const canvas = sec.querySelector('.build__gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch {
    addEventListener('scroll', () => ui(where()), { passive: true }); // no WebGL: the still stays
    ui(where());
    return;
  }
  sec.classList.add('is-gl-wait'); // the still is for browsers without WebGL: never flash it before the first frame
  const small = Math.min(screen.width, screen.height) < 700;
  renderer.setPixelRatio(Math.min(2, Math.max(small ? 1 : 1.25, devicePixelRatio || 1)));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // soft-edged shadows, as under a studio light

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.5, 400);

  // ---------- light: a soft studio room for the fill and reflections, and a warm key light from the left ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight(0xffe3c0, 3.1);
  key.position.set(-30, 34, 26);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 30, bottom: -14, near: 5, far: 140 });
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8f7a5c, 0.18));

  // ---------- textures, drawn once in the page: no image files ----------
  const canvasOf = (n, m = n) => { const c = document.createElement('canvas'); c.width = n; c.height = m; return c; };
  const texOf = (c, srgb, repeat = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y, P) => { // value noise that repeats every P, so textures tile without seams
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => hash(((a % P) + P) % P, ((b % P) + P) % P);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, P = 6, oct = 5) => { let s = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { s += amp * noise(x * f, y * f, P * f); f *= 2; amp *= 0.5; } return s; };
  // height to normals, for every relief texture below
  const normalsOf = (H, N, M, strength) => {
    const c = canvasOf(N, M), g = c.getContext('2d'), img = g.createImageData(N, M);
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
      const at = (a, b) => H[((b + M) % M) * N + ((a + N) % N)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), k = (y * N + x) * 4;
      img.data[k] = (-dx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  // the stone: travertine, warm and pale, laid in faint bands with darker streaks of sediment, clouded, and pitted
  // with the small voids of the stone
  const travertine = (() => {
    const N = small ? 384 : 512, H = new Float32Array(N * N);
    const col = canvasOf(N), cg = col.getContext('2d'), ci = cg.createImageData(N, N), rough = canvasOf(N), rg = rough.getContext('2d'), ri = rg.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x, k = i * 4;
      const cloud = clamp01((fbm(u * 3, v * 3, 3, 4) - 0.35) * 2), fine = noise(u * 96, v * 96, 96), warp = fbm(u * 2 + 9, v * 2 + 4, 2, 4);
      const band = 0.5 + 0.5 * Math.sin(Math.PI * 2 * (v * 6 + warp * 0.9)); // whole waves per tile, so it repeats without a seam
      const streak = Math.pow(1 - Math.abs(Math.sin(Math.PI * (v * 9 + warp * 1.4 + fbm(u * 6, v * 6 + 3, 6, 3) * 0.4))), 14) * clamp01((fbm(u * 4 + 2, v * 4, 4, 3) - 0.3) * 3);
      const f = (fine - 0.5) * 8;
      ci.data[k] = 233 - cloud * 26 - band * 13 - streak * 64 + f; ci.data[k + 1] = 223 - cloud * 26 - band * 13 - streak * 61 + f; ci.data[k + 2] = 204 - cloud * 21 - band * 11 - streak * 50 + f; ci.data[k + 3] = 255;
      ri.data[k] = ri.data[k + 1] = ri.data[k + 2] = 165 + cloud * 30 + fine * 25; ri.data[k + 3] = 255;
      H[i] = band * 0.06 + fine * 0.05 - streak * 0.18;
    }
    for (let p = 0; p < N * N / 450; p++) { // the pores: small voids, longer than they are tall
      const px = rand() * N, py = rand() * N, w = 1.5 + rand() * 5, h = 0.6 + rand() * 1.4, depth = 0.3 + rand() * 0.4;
      for (let yy = -Math.ceil(h); yy <= h; yy++) for (let xx = -Math.ceil(w); xx <= w; xx++) {
        const e = (xx * xx) / (w * w) + (yy * yy) / (h * h);
        if (e > 1) continue;
        const i = (((Math.round(py + yy) % N) + N) % N) * N + (((Math.round(px + xx) % N) + N) % N), k = i * 4, d = (1 - e) * depth;
        ci.data[k] -= 60 * d; ci.data[k + 1] -= 58 * d; ci.data[k + 2] -= 50 * d; H[i] -= d;
      }
    }
    cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0);
    return { map: texOf(col, true), roughnessMap: texOf(rough), normalMap: texOf(normalsOf(H, N, N, 2)) };
  })();

  // ---------- materials ----------
  const stone = (extra = {}) => new THREE.MeshStandardMaterial({ color: '#efe8dc', ...travertine, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, emissive: 0x8a6420, emissiveIntensity: 0, ...extra });
  const stoneMat = stone();
  const stepMats = [stone(), stone(), stone(), stone(), stone()]; // each step its own, so they can warm one after another
  const shade = new THREE.MeshStandardMaterial({ color: '#211c16', roughness: 1 });


  // the stone texture is laid by world size (a block twice as long shows twice the stone), each block offset
  const worldUV = (geo, tile = 1.5) => {
    const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv, ou = rand(), ov = rand();
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const [a, b] = ay >= ax && ay >= az ? [p.getX(i), p.getZ(i)] : ax >= az ? [p.getZ(i), p.getY(i)] : [p.getX(i), p.getY(i)];
      uv.setXY(i, a / tile + ou, b / tile + ov);
    }
    return geo;
  };
  const block = (w, h, d, r = 0.025) => worldUV(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 4, h / 4, d / 4)));
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; };
  // many copies of one shape in one draw: blocks, frames, chevrons, bars
  const many = (geo, mat, spots) => {
    const m = new THREE.InstancedMesh(geo, mat, spots.length), o = new THREE.Object3D();
    spots.forEach(([x, y, z, ry = 0, rz = 0, rx = 0, s = 1], i) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  };
  const group = (...kids) => { const g = new THREE.Group(); g.add(...kids); return g; };
  // a course of separate stone blocks, each turned at random, cut from one of three stones and a shade apart from its
  // neighbours, so no two match
  const blocks = (spots, w, h, d, r, mat) => group(...[0, 1, 2].map((v) => {
    const set = spots.filter((_, i) => i % 3 === v), tint = new THREE.Color();
    const m = many(block(w, h, d, r), mat, set.map(([x, y, z]) => [x, y, z, rand() < 0.5 ? 0 : Math.PI, 0, rand() < 0.5 ? 0 : Math.PI]));
    set.forEach((_, i) => { const t = 0.9 + rand() * 0.12; m.setColorAt(i, tint.setRGB(t, t * (0.985 + rand() * 0.02), t * (0.97 + rand() * 0.03))); });
    return m;
  }));

  // ---------- the ground is the page itself: an invisible floor catches the tower's shadow, and a soft
  //            darkening where it stands sets it down on the drawing ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ color: 0x3a2a14, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = (() => {
    const c = canvasOf(256), g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, 'rgba(58,42,20,.42)'); grd.addColorStop(1, 'rgba(58,42,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(17, 14.5), new THREE.MeshBasicMaterial({ map: texOf(c, true, false), transparent: true, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.002;
    scene.add(m);
    return m;
  })();

  // ---------- the pieces, in the order they are set. Each waits off screen and flies in to its place ----------
  const model = new THREE.Group();
  scene.add(model);
  const queue = { 1: [], 2: [], 3: [], 4: [] };
  const FROM = { above: [0, 34, 0], left: [-46, 3, 8], right: [58, 3, -4] }; // where each comes from, beyond the edge of the view
  const piece = (obj, line, from = 'above') => {
    model.add(obj);
    queue[line].push({ obj, home: obj.position.clone(), from: new THREE.Vector3(...FROM[from]), spin: (rand() - 0.5) * 0.8 });
    return obj;
  };
  const outline = []; // the blueprint: the main volumes, drawn in fine lines before anything is built
  const plan = (w, h, d, y, round = false) => outline.push([w, h, d, y, round]);

  // ---------- what the tower is made of, besides the stone ----------
  // the glass: polished, dark and a little green, reflecting a soft sky with clouds and a distant skyline; its panes
  // are not quite flat, so the reflection ripples a little, as it does in real glass
  const skyEnv = (() => {
    const W = 1024, Hh = 512, c = canvasOf(W, Hh), g = c.getContext('2d'), sky = g.createLinearGradient(0, 0, 0, Hh);
    sky.addColorStop(0, '#4f78ab'); sky.addColorStop(0.3, '#86a9d0'); sky.addColorStop(0.55, '#d9e3ea'); sky.addColorStop(0.6, '#f4efe4'); // the horizon a little low, so glass seen from above still shows sky
    sky.addColorStop(0.62, '#7d7262'); sky.addColorStop(1, '#2f2a24');
    g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    for (let i = 0; i < 70; i++) { // soft clouds
      const x = rand() * W, y = 30 + rand() * 200, r = 18 + rand() * 60, cl = g.createRadialGradient(x, y, 0, x, y, r);
      cl.addColorStop(0, 'rgba(255,255,255,.8)'); cl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cl; g.fillRect(x - r, y - r * 0.6, 2 * r, 1.2 * r);
    }
    g.fillStyle = 'rgba(46,54,50,.9)'; // a skyline of trees and roofs along the horizon
    for (let x = 0; x < W; x += 5 + rand() * 16) { const h = 3 + rand() * 11; g.fillRect(x, Hh * 0.6 - h, 6 + rand() * 14, h); }
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return pmrem.fromEquirectangular(t).texture;
  })();
  const ripple = (() => {
    const N = 256, H = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = fbm((x / N) * 4, (y / N) * 4, 4, 3);
    return texOf(normalsOf(H, N, N, 0.9), false);
  })();
  // the panes are never quite in one plane: each tilts a hair its own way, so each catches its own piece of sky.
  // Drawn to match a face of `faceW` with its bays (centre and width), split down the middle and in three rows
  const panesOf = (faceW, bays) => {
    const W = 1024, Hh = 256, c = canvasOf(W, Hh), g = c.getContext('2d');
    g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, W, Hh);
    for (const [x, bw] of bays) for (const left of [true, false]) for (let r = 0; r < 3; r++) {
      const nx = (rand() - 0.5) * 0.3, ny = (rand() - 0.5) * 0.22;
      g.fillStyle = `rgb(${Math.round((nx * 0.5 + 0.5) * 255)},${Math.round((ny * 0.5 + 0.5) * 255)},252)`;
      g.fillRect(((x - (left ? bw / 2 : 0) + faceW / 2) / faceW) * W, (r * Hh) / 3, (bw / 2 / faceW) * W, Hh / 3);
    }
    return texOf(c, false, false);
  };
  const glassOf = (panes) => { // and each floor's glass catches the sky at a slightly different angle again
    const m = new THREE.MeshPhysicalMaterial({ color: '#122019', metalness: 0.6, roughness: 0.04, envMap: skyEnv, envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.02,
      normalMap: panes || ripple, normalScale: panes ? new THREE.Vector2(1, 1) : new THREE.Vector2(0.32, 0.32) });
    m.envMapRotation.set((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.5, 0);
    return m;
  };
  const glass = glassOf();
  const steel = new THREE.MeshStandardMaterial({ color: '#25332d', roughness: 0.4, metalness: 0.65, envMapIntensity: 1.2 }); // dark green window frames
  const doorPaint = new THREE.MeshStandardMaterial({ color: '#2e4a3c', roughness: 0.42, metalness: 0.12 });
  const brass = new THREE.MeshStandardMaterial({ color: '#a8874f', roughness: 0.3, metalness: 1, envMapIntensity: 1.3 });
  const cupola = new THREE.MeshStandardMaterial({ color: '#2b2a27', roughness: 0.36, metalness: 0.8, envMapIntensity: 1.2 });
  // the carved band under the first setback: a double chevron between two fillets, in relief
  const chevron = (() => {
    const W = 512, Hh = 64, c = canvasOf(W, Hh), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    g.filter = 'blur(1px)'; g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 6); g.lineTo(W, 6); g.moveTo(0, Hh - 6); g.lineTo(W, Hh - 6); g.stroke();
    g.lineWidth = 5;
    for (const y0 of [16, 30]) { g.beginPath(); for (let x = -32; x <= W + 32; x += 32) { g.lineTo(x, y0); g.lineTo(x + 16, y0 + 14); } g.stroke(); }
    g.filter = 'none';
    const img = g.getImageData(0, 0, W, Hh), H = new Float32Array(W * Hh);
    for (let i = 0; i < H.length; i++) H[i] = img.data[i * 4] / 255;
    return texOf(normalsOf(H, W, Hh, 3), false);
  })();
  const bandMat = (len, h) => { // the band's own stone, laid to its length, with the chevron cut into it
    const m = travertine.map.clone(), n = chevron.clone();
    m.repeat.set(len / 1.5, h / 1.5); n.repeat.set(len / 0.9, 1);
    return stone({ map: m, roughnessMap: null, normalMap: n, normalScale: new THREE.Vector2(2.3, 2.3) });
  };
  // a bronze plaque by the door, its letters raised
  const plaque = (() => {
    const W = 512, Hh = 160, c = canvasOf(W, Hh), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(12, 12, W - 24, Hh - 24);
    g.textAlign = 'center'; g.font = '600 40px Georgia, serif'; g.fillText('MATTHEW PINDOLEY', W / 2, 68);
    g.font = '28px Georgia, serif'; g.fillText('WEALTH MANAGEMENT', W / 2, 108);
    g.font = '20px Georgia, serif'; g.fillText('TOLEDO · OHIO', W / 2, 138);
    const img = g.getImageData(0, 0, W, Hh), H = new Float32Array(W * Hh), col = canvasOf(W, Hh), cg = col.getContext('2d'), ci = cg.createImageData(W, Hh);
    for (let i = 0; i < H.length; i++) { const v = img.data[i * 4] / 255, k = i * 4; H[i] = v; ci.data[k] = 86 + v * 96; ci.data[k + 1] = 68 + v * 76; ci.data[k + 2] = 42 + v * 42; ci.data[k + 3] = 255; }
    cg.putImageData(ci, 0, 0);
    return new THREE.MeshStandardMaterial({ map: texOf(col, true, false), normalMap: texOf(normalsOf(H, W, Hh, 2.5), false, false), metalness: 0.85, roughness: 0.42, envMapIntensity: 1.2 });
  })();

  // 1. the foundation: five shallow steps, the podium course by course, then the arched doorway and the plaque
  const NS = 5, STEP = 0.22, INSET = 0.26, W = 11.4, D = 10.6, FLOOR = STEP * NS;
  for (let i = 0; i < NS; i++) {
    const w = W - 2 * INSET * i, d = D - 2 * INSET * i, nx = Math.round(w / 1.5), nz = Math.round(d / 1.3), bw = w / nx, bd = d / nz, spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-w / 2 + bw * (a + 0.5), 0, -d / 2 + bd * (b + 0.5)]);
    const step = blocks(spots, bw - 0.012, STEP, bd - 0.012, 0.022, stepMats[i]);
    step.position.y = STEP * (i + 0.5);
    piece(step, 1, i % 2 ? 'right' : 'left');
    plan(w, STEP, d, STEP * (i + 0.5));
  }
  const PW = 9.4, PD = 8.6, PH = 1.45, P0 = FLOOR, NC = 4, ch = PH / NC;
  for (let c = 0; c < NC; c++) { // smooth ashlar, the joints staggered course to course
    const nx = c % 2 ? 6 : 7, nz = c % 2 ? 5 : 6, bw = PW / nx, bd = PD / nz, spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-PW / 2 + bw * (a + 0.5), 0, -PD / 2 + bd * (b + 0.5)]);
    const course = blocks(spots, bw - 0.016, ch - 0.016, bd - 0.016, 0.02, stoneMat);
    course.position.y = P0 + ch * (c + 0.5);
    piece(course, 1, c % 2 ? 'right' : 'left');
  }
  plan(PW, PH, PD, P0 + PH / 2);
  {
    const R = 0.55, DH = 0.68, portal = new THREE.Group();
    portal.add(mesh(new THREE.BoxGeometry(2 * R + 0.04, DH + R, 0.04), shade, 0, (DH + R) / 2, -0.06)); // the dark beyond the doors
    for (const s of [-1, 1]) portal.add(mesh(block(0.32, 1.25, 0.34, 0.02), stoneMat, s * (R + 0.16), 0.625, 0.08)); // jambs
    portal.add(mesh(block(2 * R + 0.84, 0.2, 0.38, 0.02), stoneMat, 0, 1.35, 0.09)); // lintel
    const sp = new THREE.Shape([new THREE.Vector2(-R, DH), new THREE.Vector2(R, DH), new THREE.Vector2(R, 1.25), new THREE.Vector2(-R, 1.25)]);
    const hole = new THREE.Path(); hole.absarc(0, DH, R - 0.02, 0, Math.PI, false); sp.holes.push(hole);
    portal.add(mesh(worldUV(new THREE.ExtrudeGeometry(sp, { depth: 0.22, bevelEnabled: false, curveSegments: 24 })), stoneMat, 0, 0, -0.04)); // the arch
    // the fanlight: dark glass behind a wheel of bars
    const bars = [...Array(9).keys()].map((i) => { const a = ((i + 0.5) / 9) * Math.PI; return [Math.cos(a) * R * 0.48, DH + Math.sin(a) * R * 0.48, 0.0, 0, a]; });
    portal.add(mesh(new THREE.CircleGeometry(R - 0.02, 32, 0, Math.PI), glass, 0, DH, -0.01), many(new THREE.BoxGeometry(R * 0.9, 0.018, 0.02), steel, bars),
      mesh(new THREE.TorusGeometry(R * 0.2, 0.02, 6, 20, Math.PI), steel, 0, DH, 0), mesh(new THREE.BoxGeometry(2 * R, 0.04, 0.05), steel, 0, DH, 0.01));
    // the doors: two painted leaves, each with two raised panels and a brass ring
    for (const s of [-1, 1]) {
      portal.add(mesh(new RoundedBoxGeometry(R - 0.02, DH - 0.02, 0.05, 2, 0.008), doorPaint, s * R / 2, DH / 2, 0.0));
      portal.add(many(new RoundedBoxGeometry(R - 0.16, 0.24, 0.025, 2, 0.006), doorPaint, [[s * R / 2, 0.49, 0.03], [s * R / 2, 0.18, 0.03]]));
      portal.add(mesh(new THREE.TorusGeometry(0.045, 0.01, 8, 20), brass, s * 0.09, 0.4, 0.05));
    }
    portal.add(mesh(new THREE.BoxGeometry(1.5, 0.46, 0.04), plaque, 2.6, 0.78, -0.1)); // the plaque, to the right, on the wall
    portal.position.set(0, P0, PD / 2 + 0.12); // the doorway stands a little proud of the podium
    piece(portal, 1, 'right');
  }

  // 2. the shaft: the glass floor by floor, then the stone piers
  // one floor: its glass and the dark frames of its panes
  const floorOf = (y0, fh, w, d, bays) => {
    const verts = [], horiz = [], zf = d / 2 - 0.13;
    for (const [x, bw] of bays) for (const s of [-1, 1]) {
      verts.push([x, y0 + fh / 2, s * zf]);
      for (const t of [0, 1 / 3, 2 / 3]) horiz.push([x, y0 + fh * t + 0.02, s * zf, 0, 0, 0, bw]);
    }
    return group(mesh(new THREE.BoxGeometry(w - 0.3, fh, d - 0.3), glassOf(panesOf(w - 0.3, bays)), 0, y0 + fh / 2, 0),
      many(new THREE.BoxGeometry(0.035, fh, 0.05), steel, verts), many(new THREE.BoxGeometry(1, 0.035, 0.05), steel, horiz));
  };
  // a set of piers, each a stack of stone blocks, slender ones with a small capital under the cornice
  const piers = (spots, w, d, y0, h, cap) => {
    const nb = Math.max(1, Math.round(h / 0.9)), bh = h / nb, stack = [];
    for (const [x, z, ry = 0] of spots) for (let k = 0; k < nb; k++) stack.push([x, y0 + bh * (k + 0.5), z, ry]);
    const g = group(...[0, 1, 2].map((v) => many(block(w, bh - 0.012, d, 0.02), stoneMat, stack.filter((_, i) => i % 3 === v))));
    if (cap) g.add(many(block(w + 0.12, 0.14, d + 0.1, 0.015), stoneMat, spots.map(([x, z, ry = 0]) => [x, y0 + h - 0.07, z, ry])));
    return g;
  };
  const S0 = P0 + PH, SW = 8.4, SD = 7.4, SH = 5.4, NF = 4, FH = SH / NF;
  const BAYS = [-2.8, -1.68, -0.56, 0.56, 1.68, 2.8].map((x) => [x, 0.82]), SLOTS = [];
  for (let k = 0; k < 9; k++) SLOTS.push(-3.2 + 0.226 + 0.23 + k * 0.686);
  for (let f = 0; f < NF; f++) piece(floorOf(S0 + FH * f, FH, SW, SD, BAYS), 2, f % 2 ? 'right' : 'left');
  plan(SW, SH, SD, S0 + SH / 2);
  const FRONT = [-2.24, -1.12, 0, 1.12, 2.24];
  piece(piers(FRONT.map((x) => [x, -SD / 2 + 0.23]), 0.3, 0.38, S0, SH, true), 2); // the back
  for (const s of [-1, 1]) piece(piers(SLOTS.map((z) => [s * (SW / 2 - 0.23), z, Math.PI / 2]), 0.46, 0.4, S0, SH, false), 2); // the sides, slotted
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) piece(piers([[sx * (SW / 2 - 0.5), sz * (SD / 2 - 0.5)]], 1.0, 1.0, S0, SH, false), 2); // the corners
  for (const x of FRONT) piece(piers([[x, SD / 2 - 0.23]], 0.3, 0.38, S0, SH, true), 2); // the front, one at a time, last

  // 3. the setbacks, course by course: the cornice and its carved chevron, the second stage with its own glass
  //    and piers, its cornice, the third stage with its slit windows, and its cornice; each narrower
  const ledge = (w, h, d, y) => { // a cornice, cut in long blocks
    const nx = Math.max(2, Math.round(w / 2)), nz = Math.max(2, Math.round(d / 2)), spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-w / 2 + (w / nx) * (a + 0.5), y, -d / 2 + (d / nz) * (b + 0.5)]);
    plan(w, h, d, y);
    return blocks(spots, w / nx - 0.012, h, d / nz - 0.012, 0.025, stoneMat);
  };
  const C1 = S0 + SH, CH1 = 0.55;
  {
    const c1 = ledge(SW + 0.5, CH1, SD + 0.5, C1 + CH1 / 2), bh = 0.3, by = C1 + CH1 * 0.45;
    for (const s of [-1, 1]) {
      c1.add(mesh(new THREE.BoxGeometry(SW + 0.5, bh, 0.012), bandMat(SW + 0.5, bh), 0, by, s * (SD / 2 + 0.256)));
      c1.add(mesh(new THREE.BoxGeometry(0.012, bh, SD + 0.5), bandMat(SD + 0.5, bh), s * (SW / 2 + 0.256), by, 0));
    }
    piece(c1, 3);
  }
  const T2 = C1 + CH1, W2 = 6.3, D2 = 5.4, H2 = 2.0, NF2 = 2;
  const BAYS2 = [-1.98, -1.19, -0.4, 0.4, 1.19, 1.98].map((x) => [x, 0.57]), SLOTS2 = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5];
  for (let f = 0; f < NF2; f++) piece(floorOf(T2 + (H2 / NF2) * f, H2 / NF2, W2, D2, BAYS2), 3, f % 2 ? 'right' : 'left');
  plan(W2, H2, D2, T2 + H2 / 2);
  {
    const front = [-1.585, -0.795, 0, 0.795, 1.585];
    const g = group(piers([...front.map((x) => [x, D2 / 2 - 0.2]), ...front.map((x) => [x, -D2 / 2 + 0.2])], 0.26, 0.34, T2, H2, true));
    for (const s of [-1, 1]) g.add(piers(SLOTS2.map((z) => [s * (W2 / 2 - 0.2), z, Math.PI / 2]), 0.4, 0.36, T2, H2, false));
    g.add(piers([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (W2 / 2 - 0.4), sz * (D2 / 2 - 0.4)]), 0.8, 0.8, T2, H2, false));
    piece(g, 3);
  }
  const C2 = T2 + H2;
  piece(ledge(W2 + 0.36, 0.32, D2 + 0.36, C2 + 0.16), 3);
  const T3 = C2 + 0.32, W3 = 4.2, D3 = 3.6, H3 = 1.5;
  {
    const nc = 3, chh = H3 / nc, body = new THREE.Group();
    for (let c = 0; c < nc; c++) { // coursed ashlar, the joints staggered
      const nx = c % 2 ? 3 : 4, nz = c % 2 ? 2 : 3, spots = [];
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-W3 / 2 + (W3 / nx) * (a + 0.5), T3 + chh * (c + 0.5), -D3 / 2 + (D3 / nz) * (b + 0.5)]);
      body.add(blocks(spots, W3 / nx - 0.014, chh - 0.014, D3 / nz - 0.014, 0.02, stoneMat));
    }
    const slit = glassOf();
    const slits = [];
    for (const x of [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5]) for (const s of [-1, 1]) slits.push([x, T3 + H3 / 2, s * (D3 / 2 + 0.004)]);
    for (const z of [-1.0, -0.5, 0, 0.5, 1.0]) for (const s of [-1, 1]) slits.push([s * (W3 / 2 + 0.004), T3 + H3 / 2, z, Math.PI / 2]);
    body.add(many(new THREE.BoxGeometry(0.13, H3 - 0.5, 0.02), slit, slits));
    piece(body, 3);
    plan(W3, H3, D3, T3 + H3 / 2);
  }
  const C3 = T3 + H3;
  piece(ledge(W3 + 0.3, 0.22, D3 + 0.3, C3 + 0.11), 3);

  // 4. the crown, lowered on stage by stage, the round dark cupola last
  const K0 = C3 + 0.22;
  piece(ledge(3.0, 0.5, 2.6, K0 + 0.25), 4);
  piece(ledge(2.25, 0.42, 1.95, K0 + 0.5 + 0.21), 4);
  {
    const prof = [[0, 0], [0.86, 0], [0.86, 0.07], [0.78, 0.08], [0.78, 0.3], [0.88, 0.33], [0.86, 0.37], [0.76, 0.38], [0.66, 0.47], [0.48, 0.55], [0.24, 0.6], [0, 0.62]];
    const cap = mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x * 1.15, y * 1.15)), 48), cupola, 0, K0 + 0.92, 0);
    piece(cap, 4);
    plan(1.98, 0.71, 1.98, K0 + 0.92 + 0.36, true);
  }

  // the blueprint: fine lines of every main volume, there before anything is built and fading as it fills
  const ghost = (() => {
    const pts = [];
    for (const [w, h, d, y, round] of outline) {
      const e = new THREE.EdgesGeometry(round ? new THREE.CylinderGeometry(w / 2, w / 2, h, 24, 1) : new THREE.BoxGeometry(w, h, d));
      e.translate(0, y, 0);
      pts.push(...e.attributes.position.array);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x7a5820, transparent: true, opacity: 0.4, depthWrite: false }));
    scene.add(l);
    return l;
  })();

  // ---------- size: wide screens keep the building to the right of the words, tall ones above them ----------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.3, thickness: 1.4, scale: 1.35, samples: small ? 12 : 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: small ? 12 : 16 });
  gtao.blendIntensity = 1;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());

  let sizeW = 0, sizeH = 0;
  const size = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === sizeW && h === sizeH) return false; // a phone's address bar showing or hiding changes nothing here
    sizeW = w; sizeH = h;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    if (w / h > 1.05) camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.185, w, h);
    camera.updateProjectionMatrix();
    return true;
  };

  // ---------- one smoothed scroll position drives the whole drawing: a critically damped spring, so the motion
  //            carries its momentum between wheel steps and settles without overshoot or a jolt ----------
  const OMEGA = 8.5; // stiffness: most of the way in half a second
  let sy = scrollY, vel = 0, raf = 0, last = 0, visible = true, shadowKey = '';
  let lite = false; const gaps = [];
  renderer.shadowMap.autoUpdate = false; // shadows are redrawn only when a piece has moved, not for camera moves

  const frame = (now) => {
    raf = 0;
    // the spring runs on real elapsed time in small steps, so it settles as fast on a slow phone as on a fast one
    // a device that cannot keep up while the drawing moves (half its frames slower than 25 a second) gives up
    // the soft contact shading and the extra pixels, once, rather than stutter
    if (last && !lite) {
      gaps.push(now - last);
      if (gaps.length === 24) {
        if (gaps.sort((x, y) => x - y)[12] > 40) { lite = true; gtao.enabled = false; renderer.setPixelRatio(1); sizeW = 0; size(); }
        gaps.length = 0;
      }
    }
    let dt = Math.min(0.12, (now - (last || now)) / 1000); last = now;
    if (reduced) { sy = scrollY; vel = 0; }
    else while (dt > 0) { const h = Math.min(1 / 240, dt); vel += (OMEGA * OMEGA * (scrollY - sy) - 2 * OMEGA * vel) * h; sy += vel * h; dt -= h; }
    // glide on until truly at rest, so even a very slow scroll turns into continuous motion, not small steps
    const settled = reduced || (Math.abs(scrollY - sy) < 0.02 && Math.abs(vel) < 0.15);
    if (settled) { sy = scrollY; vel = 0; }
    const w = where();
    ui(w); // the words follow the page itself
    const lag = (scrollY - sy) / innerHeight; // how far the drawing trails the page, in screens
    const ws = w.map(([t, b]) => [t + lag, b + lag]); // where the lines are at the smoothed scroll

    // each line sets its pieces one after another while it rises into place and is read; the last piece of a
    // line lands just as the next line arrives
    let built = 0;
    const far = camera.aspect < 1.05 ? 2.2 : 1; // a tall screen sees further, so its pieces start further out
    for (const line of [1, 2, 3, 4]) {
      const list = queue[line], n = list.length, [top, bottom] = ws[line];
      const u = reduced ? 1 : clamp01((0.95 - top) / ((bottom - top) * 0.92));
      const dur = Math.min(0.4, 3 / n);
      list.forEach((pc, k) => {
        const p = settle(clamp01((u - (n > 1 ? (k / (n - 1)) * (1 - dur) : 0)) / dur)), q = 1 - p;
        built += p / n / 4; // each of the four lines counts the same, however many pieces it has
        pc.obj.visible = p > 0; // not yet started: off screen, and not drawn at all
        pc.obj.position.copy(pc.home).addScaledVector(pc.from, q * far);
        pc.obj.position.y += Math.sin(q * Math.PI) * 1.2; // a gentle arc on the way in
        pc.obj.rotation.set(0, pc.spin * q, pc.spin * 0.25 * q);
      });
    }
    // the last line: the steps warm one after another, top to bottom, and stay warm
    const [lt, lb] = ws[5];
    const hold = clamp01(-lt / Math.max(0.05, lb - lt - 1));
    stepMats.forEach((m, i) => { m.emissiveIntensity = reduced ? 0 : 0.16 * ease(clamp01(hold * 2.2 - (stepMats.length - 1 - i) / (stepMats.length - 1))); });
    ghost.material.opacity = 0.4 * Math.pow(1 - built, 1.5);
    contact.material.opacity = ease(clamp01(built * 4)); // the darkening underfoot arrives with the foundation

    // the camera comes in a little as the building completes, and walks a little way around it
    const viewP = clamp01((-sec.getBoundingClientRect().top - (scrollY - sy)) / Math.max(1, sec.offsetHeight - innerHeight));
    const portrait = camera.aspect < 1.05;
    const b = ease(built);
    const dist = lerp(56, 46, b) * (portrait ? 2.5 : 1); // tall screens: further back, so the tower clears the words
    const elev = THREE.MathUtils.degToRad(lerp(12, 8, b)); // low, as a person standing before it would see it
    const az = THREE.MathUtils.degToRad(reduced ? -24 : -40 + 22 * viewP); // reduced motion: a still camera
    const ty = lerp(7.4, 6.8, b) - (portrait ? 0.8 : 0);
    camera.position.set(Math.sin(az) * Math.cos(elev) * dist, ty + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    camera.lookAt(0, ty, 0);
    const key2 = built.toFixed(5);
    if (key2 !== shadowKey) { shadowKey = key2; renderer.shadowMap.needsUpdate = true; }
    composer.render();
    if (!sec.classList.contains('is-gl')) sec.classList.add('is-gl');

    // nothing moves unless the page scrolls: draw on until the drawing has caught up and settled
    if (visible && !settled) paint(); else last = 0;
  };
  const paint = () => { if (!raf) raf = requestAnimationFrame(frame); };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) paint(); }).observe(sec);
  addEventListener('scroll', paint, { passive: true });
  // a real resize redraws at once, in the same moment, so the canvas is never shown blank
  addEventListener('resize', () => { if (size()) frame(performance.now()); else paint(); });
  size();
  paint();
}
