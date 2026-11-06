// Fee page: "the architecture of one fee". A marble model of a classical temple stands on the page's
// drafting sheet. Drawn first as an exploded axonometric, it is set in place piece by
// piece as the visitor scrolls, so every movement adds something: the steps and floor (financial planning); the
// inner room, its bronze doors and the columns one at a time (investment management); the beam course by course
// (coordination); and the roof, edge by edge, tiles to the gold finials (ongoing strategy). It is complete as
// the last line arrives, and then the steps warm, top to bottom: as wealth climbs, the rate steps down.
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
  Object.assign(key.shadow.camera, { left: -17, right: 17, top: 22, bottom: -12, near: 5, far: 120 });
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

  // the stone: a warm cream marble, clouded with grey-beige, crossed by fine wandering veins and lightly
  // speckled, polished just enough to hold a soft sheen, as on the model in the photographs
  const marble = (() => {
    const N = small ? 384 : 512, H = new Float32Array(N * N);
    const col = canvasOf(N), cg = col.getContext('2d'), ci = cg.createImageData(N, N), rough = canvasOf(N), rg = rough.getContext('2d'), ri = rg.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, i = y * N + x, k = i * 4;
      const cloud = clamp01((fbm(u * 4, v * 4, 4, 4) - 0.4) * 2.2), fine = noise(u * 96, v * 96, 96);
      const warp = fbm(u * 3 + 11, v * 3 + 5, 3, 4), fade = clamp01((fbm(u * 2 + 7, v * 2 + 1, 2, 3) - 0.36) * 3.5);
      // the veins: thin crests of a warped wave (whole waves per tile, so the stone repeats without a seam)
      const v1 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (2 * u + v + warp * 2.4))), 9) * fade;
      const v2 = Math.pow(1 - Math.abs(Math.sin(Math.PI * (u - 3 * v + warp * 1.7))), 26) * 0.6;
      const vein = Math.min(1, v1 + v2), f = (fine - 0.5) * 7;
      ci.data[k] = 232 - cloud * 40 + f - vein * 58; ci.data[k + 1] = 223 - cloud * 39 + f - vein * 58; ci.data[k + 2] = 204 - cloud * 30 + f - vein * 50; ci.data[k + 3] = 255;
      ri.data[k] = ri.data[k + 1] = ri.data[k + 2] = 138 + cloud * 40 + vein * 50 + fine * 22; ri.data[k + 3] = 255;
      H[i] = cloud * 0.12 + fine * 0.06 - vein * 0.25;
    }
    for (let p = 0; p < N * N / 700; p++) { // specks, and the odd small pit
      const px = Math.floor(rand() * N), py = Math.floor(rand() * N), r = rand() < 0.85 ? 1 : 2, dark = 26 + rand() * 46;
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r) continue;
        const i = ((py + yy + N) % N) * N + ((px + xx + N) % N), k = i * 4;
        ci.data[k] -= dark; ci.data[k + 1] -= dark; ci.data[k + 2] -= dark * 0.85; H[i] -= 0.25;
      }
    }
    cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0);
    return { map: texOf(col, true), roughnessMap: texOf(rough), normalMap: texOf(normalsOf(H, N, N, 2)) };
  })();

  // terracotta: rows of clay pan tiles, each fired a little differently, each course overlapping the next
  const terracotta = (() => {
    const N = 256, H = new Float32Array(N * N), col = canvasOf(N), cg = col.getContext('2d'), ci = cg.createImageData(N, N);
    const rows = 4, cols = 4;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = Math.floor((y / N) * rows), c = Math.floor((x / N) * cols), t = ((y / N) * rows) % 1, s = ((x / N) * cols) % 1;
      const tone = hash(r, c) * 0.18 - 0.09, grain = noise(x / 6, y / 6, N / 6) * 0.1;
      const lip = t > 0.9 ? (t - 0.9) * 6 : 0; // each course's lower edge, in shadow under the next
      const k = (y * N + x) * 4, sh = 1 - lip * 0.55 - (s < 0.04 || s > 0.96 ? 0.18 : 0);
      ci.data[k] = (176 + tone * 255 * 0.4 + grain * 100) * sh; ci.data[k + 1] = (104 + tone * 255 * 0.22 + grain * 56) * sh; ci.data[k + 2] = (66 + tone * 255 * 0.16 + grain * 40) * sh; ci.data[k + 3] = 255;
      H[y * N + x] = t * 0.6 + grain;
    }
    cg.putImageData(ci, 0, 0);
    return { map: texOf(col, true), normalMap: texOf(normalsOf(H, N, N, 1.4)) };
  })();

  // the gold disc in the pediment: plain gold, hammered by hand, its edge turned up
  const hammered = (() => {
    const N = 256, H = new Float32Array(N * N);
    for (let p = 0; p < 70; p++) {
      const cx = rand() * N, cy = rand() * N, r = 18 + rand() * 22;
      for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(N, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(N, cx + r); x++) {
        const q = 1 - ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
        if (q > 0) H[y * N + x] -= q * q * 0.12;
      }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - N / 2, y - N / 2) / (N / 2); if (d > 0.86) H[y * N + x] = Math.max(H[y * N + x], 0) + Math.sin(clamp01((d - 0.86) / 0.14) * Math.PI) * 1.2; }
    return texOf(normalsOf(H, N, N, 2.6), false, false);
  })();

  // ---------- materials ----------
  const stone = (extra = {}) => new THREE.MeshStandardMaterial({ color: '#fbf1e0', ...marble, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, emissive: 0x8a6420, emissiveIntensity: 0, ...extra });
  const stoneMat = stone();
  const shaftMat = stone({ vertexColors: true }); // weathering painted in at the foot
  const stepMats = [stone(), stone(), stone()]; // each step its own, so they can warm one after another
  const tileMat = new THREE.MeshStandardMaterial({ ...terracotta, roughness: 0.82, normalScale: new THREE.Vector2(0.8, 0.8) });
  const coverMat = new THREE.MeshStandardMaterial({ color: '#ad6544', roughness: 0.7 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8ae64', roughness: 0.3, metalness: 1, envMapIntensity: 1.6 });
  const coin = new THREE.MeshStandardMaterial({ color: '#d6aa5e', roughness: 0.28, metalness: 1, envMapIntensity: 1.7, normalMap: hammered, normalScale: new THREE.Vector2(0.5, 0.5) });
  const bronze = new THREE.MeshStandardMaterial({ color: '#5b4a35', roughness: 0.45, metalness: 0.9, envMapIntensity: 1.1 });
  const shade = new THREE.MeshStandardMaterial({ color: '#211c16', roughness: 1 });
  const doorBronze = new THREE.MeshStandardMaterial({ color: '#4d5f53', roughness: 0.46, metalness: 0.6, envMapIntensity: 1.6 }); // dark, green with age


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
  // many copies of one shape in one draw: slabs, triglyphs, guttae, tiles, studs, antefixes
  const many = (geo, mat, spots) => {
    const m = new THREE.InstancedMesh(geo, mat, spots.length), o = new THREE.Object3D();
    spots.forEach(([x, y, z, ry = 0, rz = 0, rx = 0, s = 1], i) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  };
  const group = (...kids) => { const g = new THREE.Group(); g.add(...kids); return g; };
  // a course of separate stone blocks, each turned at random and cut from one of three stones, so no two neighbours match
  const blocks = (spots, w, h, d, r, mat) => group(...[0, 1, 2].map((v) => many(block(w, h, d, r), mat,
    spots.filter((_, i) => i % 3 === v).map(([x, y, z]) => [x, y, z, rand() < 0.5 ? 0 : Math.PI, 0, rand() < 0.5 ? 0 : Math.PI]))));

  // ---------- the ground is the page itself: an invisible floor catches the temple's shadow, and a soft
  //            darkening where it stands sets it down on the drawing ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ color: 0x3a2a14, opacity: 0.24 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  {
    const c = canvasOf(256), g = c.getContext('2d'), grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, 'rgba(58,42,20,.42)'); grd.addColorStop(1, 'rgba(58,42,20,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(17, 14.5), new THREE.MeshBasicMaterial({ map: texOf(c, true, false), transparent: true, depthWrite: false, toneMapped: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.002;
    scene.add(contact);
  }

  // ---------- the pieces, in the order they are set ----------
  const temple = new THREE.Group();
  scene.add(temple);
  const queue = { 1: [], 2: [], 3: [], 4: [] };
  const LIFT = { 1: 1.0, 2: 3.1, 3: 5.6, 4: 7.4 };
  const piece = (obj, line) => { temple.add(obj); queue[line].push({ obj, home: obj.position.y, lift: LIFT[line], turn: (rand() - 0.5) * 0.06 }); return obj; };

  const STEP = 0.34, INSET = 0.38, W = 12.8, D = 10.4, PAVE = 0.04, FLOOR = STEP * 3 + PAVE;
  const ROW = 4.0, SIDE = [-2.4, -0.8, 0.8, 2.4];
  const COLS = [];
  for (const x of [-5, -3, -1, 1, 3, 5]) COLS.push([x, -ROW]); // back row
  for (const z of SIDE) COLS.push([-5, z], [5, z]); // the sides
  for (const x of [-5, -3, -1, 1, 3, 5]) COLS.push([x, ROW]); // the front row, last
  const R0 = 0.4, R1 = 0.33, H_BASE = 0.24, H_SHAFT = 4.62, H_CAP = 0.42;
  const COL_H = H_BASE + H_SHAFT + H_CAP, BEAM_Y = FLOOR + COL_H;

  // 1. the foundation: three steps, bottom first, then the floor slabs
  for (let i = 0; i < 3; i++) {
    // each step laid as separate blocks, their joints showing on the tread and the face
    const w = W - 2 * INSET * i, d = D - 2 * INSET * i, nx = Math.round(w / 1.6), nz = Math.round(d / 1.3), bw = w / nx, bd = d / nz, spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-w / 2 + bw * (a + 0.5), 0, -d / 2 + bd * (b + 0.5)]);
    const step = blocks(spots, bw - 0.012, STEP, bd - 0.012, 0.03, stepMats[i]);
    step.position.y = STEP * (i + 0.5);
    piece(step, 1);
  }
  {
    const nx = 10, nz = 8, slabs = [], sw = (W - 6 * INSET) / nx, sd = (D - 6 * INSET) / nz;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) slabs.push([-(W - 6 * INSET) / 2 + sw * (a + 0.5), 0, -(D - 6 * INSET) / 2 + sd * (b + 0.5)]);
    const pave = blocks(slabs, sw - 0.03, PAVE, sd - 0.03, 0.012, stoneMat);
    pave.position.y = STEP * 3 + PAVE / 2;
    piece(pave, 1);
  }

  // 2. the inner room, its doors, then the columns one at a time
  const CX = 3.3, CZ = 2.9, T = 0.32, CH = COL_H, DW = 1.7, DH = 3.3;
  const wall = (w, h, d, x, y, z) => piece(mesh(block(w, h, d, 0.02), stoneMat, x, FLOOR + y, z), 2);
  wall(2 * CX, CH, T, 0, CH / 2, -CZ);
  wall(T, CH, 2 * CZ, -CX, CH / 2, 0);
  wall(T, CH, 2 * CZ, CX, CH / 2, 0);
  wall(CX - DW / 2, CH, T, -(CX + DW / 2) / 2, CH / 2, CZ);
  wall(CX - DW / 2, CH, T, (CX + DW / 2) / 2, CH / 2, CZ);
  {
    const overDoor = group(mesh(block(DW, CH - DH, T, 0.02), stoneMat, 0, DH + (CH - DH) / 2, 0), mesh(block(DW + 0.34, 0.16, T + 0.18, 0.02), stoneMat, 0, DH + 0.08, 0),
      ...[-1, 1].map((s) => mesh(block(0.16, DH, T + 0.12, 0.016), stoneMat, s * (DW / 2 + 0.02), DH / 2, 0))); // lintel and jambs
    overDoor.position.set(0, FLOOR, CZ);
    piece(overDoor, 2);
  }
  {
    const doors = group(mesh(new THREE.BoxGeometry(DW, DH, 0.05), shade, 0, DH / 2, -0.22));
    const studs = [], bosses = [], petals = [], LW = DW / 2 - 0.12, PW = LW - 0.2;
    for (const s of [-1, 1]) {
      const cx = s * (DW / 4 - 0.02);
      doors.add(mesh(new RoundedBoxGeometry(LW, DH - 0.04, 0.06, 2, 0.012), doorBronze, cx, DH / 2, -0.07));
      // three raised panels a leaf, a rosette in the top and bottom ones
      for (const [py, ph, rose] of [[0.52, 0.62, true], [1.6, 1.3, false], [2.7, 0.62, true]]) {
        doors.add(mesh(new RoundedBoxGeometry(PW, ph, 0.04, 2, 0.012), doorBronze, cx, py, -0.035));
        if (!rose) continue;
        doors.add(mesh(new THREE.TorusGeometry(0.17, 0.014, 8, 40), bronze, cx, py, -0.012));
        bosses.push([cx, py, -0.012]);
        for (let a = 0; a < 8; a++) petals.push([cx + Math.cos(a * Math.PI / 4) * 0.1, py + Math.sin(a * Math.PI / 4) * 0.1, -0.012, 0, a * Math.PI / 4 + Math.PI / 2]);
      }
      for (const ex of [-1, 1]) for (let y = 0.18; y < DH - 0.1; y += 0.2) studs.push([cx + ex * (PW / 2 + 0.05), y, -0.035]);
      doors.add(mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 28), bronze, cx - s * 0.2, 1.5, 0), mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16).rotateX(Math.PI / 2), bronze, cx - s * 0.2, 1.585, -0.01)); // ring knocker
    }
    doors.add(many(new THREE.SphereGeometry(0.028, 10, 8), bronze, studs), many(new THREE.SphereGeometry(0.045, 12, 10), bronze, bosses),
      many(new THREE.SphereGeometry(1, 10, 8).scale(0.028, 0.055, 0.016), bronze, petals));
    doors.position.set(0, FLOOR, CZ);
    piece(doors, 2);
  }
  // a column: a moulded base, a fluted shaft of four stone drums (their rounded ends draw the joints) with a
  // slight swell and weathering at the foot, three rings at the neck, a cushion capital and a square abacus
  const JOINTS = [0, 0.26, 0.51, 0.76, 1];
  const drum = (t0, t1) => {
    const h = (t1 - t0) * H_SHAFT, e = 0.024;
    const profile = [[0, 0.962], [e * 0.5, 0.99], [e, 1], [h / 2, 1], [h - e, 1], [h - e * 0.5, 0.99], [h, 0.962]];
    const g = new THREE.LatheGeometry(profile.map(([y, k]) => new THREE.Vector2(k, y)), small ? 72 : 100);
    const p = g.attributes.position, uv = g.attributes.uv, col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i), k0 = Math.hypot(x, z), t = t0 + y / H_SHAFT, a = Math.atan2(z, x);
      const r = (lerp(R0, R1, t) + 0.016 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * k0; // taper and entasis
      const k = r * (1 - 0.058 * (0.5 + 0.5 * Math.cos(20 * a))); // twenty flutes
      p.setX(i, Math.cos(a) * k); p.setZ(i, Math.sin(a) * k);
      uv.setXY(i, uv.getX(i) * 1.6 + t0 * 7.3, t * H_SHAFT / 1.5);
      const c = (0.84 + 0.16 * clamp01(t / 0.12)) * (0.97 + 0.03 * noise(a * 3, t * 20, 64)); // weathering at the foot
      col.push(c, c * 0.985, c * 0.965);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g.translate(0, t0 * H_SHAFT - H_SHAFT / 2, 0);
  };
  const echinus = new THREE.LatheGeometry([...Array(11).keys()].map((i) => new THREE.Vector2(R1 + 0.015 + 0.25 * Math.pow(Math.sin((i / 10) * Math.PI / 2), 0.8), (i / 10) * 0.22)), 64);
  const colParts = [
    [block(2 * R0 + 0.3, 0.08, 2 * R0 + 0.3, 0.014), stoneMat, 0.04],
    [new THREE.TorusGeometry(R0 + 0.07, 0.07, 10, 44).rotateX(Math.PI / 2), stoneMat, 0.14],
    [new THREE.TorusGeometry(R0 + 0.02, 0.045, 8, 44).rotateX(Math.PI / 2), stoneMat, 0.22],
    ...JOINTS.slice(0, -1).map((t0, i) => [drum(t0, JOINTS[i + 1]), shaftMat, H_BASE + H_SHAFT / 2]),
    ...[0, 1, 2].map((i) => [new THREE.TorusGeometry(R1 + 0.012, 0.016, 6, 44).rotateX(Math.PI / 2), stoneMat, H_BASE + H_SHAFT - 0.05 - i * 0.045]),
    [worldUV(echinus, 0.8), stoneMat, H_BASE + H_SHAFT],
    [block(2 * (R1 + 0.29), 0.2, 2 * (R1 + 0.29), 0.022), stoneMat, H_BASE + H_SHAFT + 0.22 + 0.1],
  ];
  const colMeshes = colParts.map(([geo, mat]) => {
    const m = new THREE.InstancedMesh(geo, mat, COLS.length);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    temple.add(m);
    return m;
  });
  const colDrop = COLS.map(() => LIFT[2]);
  const placeColumns = () => {
    const o = new THREE.Matrix4();
    colMeshes.forEach((m, k) => {
      COLS.forEach(([x, z], j) => { o.makeTranslation(x, FLOOR + colParts[k][2] + colDrop[j], z); m.setMatrixAt(j, o); });
      m.instanceMatrix.needsUpdate = true;
    });
  };
  COLS.forEach((_, j) => queue[2].push({ col: j, lift: LIFT[2] }));

  // 3. the beam, course by course: architrave, gold band, frieze, its triglyphs and guttae, mutules and cornice, crown
  const SW = 11.3, SD = 2 * ROW + 1.3;
  const course = (obj, y) => { obj.position.y = BEAM_Y + y; return piece(obj, 3); };
  course(mesh(block(SW, 0.6, SD, 0.025), stoneMat), 0.3);
  course(group(...[-1, 1].flatMap((k) => [ // the gold band: a frame round the edge, so no bare gold plate shows as it is set
    mesh(new THREE.BoxGeometry(SW + 0.05, 0.07, 0.08), gold, 0, 0, k * (SD / 2 - 0.015)),
    mesh(new THREE.BoxGeometry(0.08, 0.07, SD + 0.05), gold, k * (SW / 2 - 0.015), 0, 0)])), 0.635);
  course(mesh(block(SW - 0.1, 0.62, SD - 0.1, 0.02), stoneMat), 0.98);
  {
    const faces = []; // [x, z, facing] for every triglyph, on all four faces
    for (let x = -5; x <= 5.01; x += 1) faces.push([x, SD / 2 - 0.05, 0], [x, -SD / 2 + 0.05, Math.PI]);
    for (let z = -ROW + 0.8; z <= ROW - 0.79; z += 0.8) faces.push([SW / 2 - 0.05, z, Math.PI / 2], [-SW / 2 + 0.05, z, -Math.PI / 2]);
    const along = (x, z, ry, u, w) => [x + Math.cos(ry) * u + Math.sin(ry) * w, z - Math.sin(ry) * u + Math.cos(ry) * w];
    const bars = [], drops = [], regulae = [], mutules = [];
    for (const [x, z, ry] of faces) {
      for (const u of [-0.11, 0, 0.11]) { const [px, pz] = along(x, z, ry, u, 0.04); bars.push([px, 0.68, pz, ry]); }
      const [rx, rz] = along(x, z, ry, 0, 0.06); regulae.push([rx, 0.26, rz, ry]);
      for (let g = 0; g < 6; g++) { const [gx, gz] = along(x, z, ry, -0.125 + g * 0.05, 0.07); drops.push([gx, 0.2, gz]); }
      const [mx, mz] = along(x, z, ry, 0, 0.32); mutules.push([mx, 0.98, mz, ry]);
    }
    course(group(many(block(0.08, 0.52, 0.08, 0.012), stoneMat, bars), many(block(0.32, 0.05, 0.05, 0.01), stoneMat, regulae),
      many(new THREE.CylinderGeometry(0.018, 0.022, 0.07, 10), stoneMat, drops)), 0.3);
    course(group(many(block(0.36, 0.045, 0.42, 0.01), stoneMat, mutules), mesh(block(SW + 0.9, 0.26, SD + 0.9, 0.035), stoneMat, 0, 1.12, 0)), 0.3);
  }
  course(mesh(block(SW + 1.02, 0.08, SD + 1.02, 0.025), stoneMat), 1.59);

  // 4. the roof, edge by edge: cornice, pediment, the gold disc, the raking edges, each slope with its
  //    terracotta tiles, the ridge, the gold antefixes, the gold palmettes and last the bronze griffin at the apex
  const RW = SW + 1.0, RH = 1.75, RD = SD + 1.0, ang = Math.atan2(RH, RW / 2), L = Math.hypot(RW / 2, RH), ROOF_Y = BEAM_Y + 1.63;
  const part = (obj, x = 0, y = 0, z = 0) => { obj.position.set(x, ROOF_Y + y, z); return piece(obj, 4); };
  part(mesh(block(RW, 0.2, RD, 0.03), stoneMat), 0, 0.1, 0);
  const prism = (w, h, d) => worldUV(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2));
  part(mesh(prism(RW - 0.5, RH - 0.18, RD - 0.5), stoneMat), 0, 0.2, 0);
  part(group(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 64).rotateX(Math.PI / 2), coin), mesh(new THREE.TorusGeometry(0.47, 0.03, 12, 64), gold),
    many(new THREE.SphereGeometry(0.024, 10, 8), gold, [...Array(44).keys()].map((i) => [Math.cos(i / 44 * Math.PI * 2) * 0.54, Math.sin(i / 44 * Math.PI * 2) * 0.54, 0]))), 0, 0.2 + RH * 0.36, (RD - 0.5) / 2 + 0.03); // the disc, its rim and a ring of gold beads
  for (const zf of [RD / 2 - 0.25, -RD / 2 + 0.25]) for (const s of [-1, 1]) {
    const rake = part(mesh(block(L + 0.15, 0.26, 0.55, 0.03), stoneMat), s * RW / 4, RH / 2 + 0.05, zf);
    rake.rotation.z = -s * ang;
  }
  const PANS = 25, PANW = (RD + 0.1) / PANS, BL = L + 0.3;
  for (const s of [-1, 1]) {
    // the pans as a sloping tiled bed, the covers as half-round tiles over every seam, ridge to eave, each a little askew
    const bedGeo = new THREE.BoxGeometry(BL, 0.12, RD + 0.1);
    { const uv = bedGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * PANS / 4, uv.getX(i) * BL / 1.4); } // pans across, courses down
    const bed = mesh(bedGeo, tileMat, s * RW / 4, RH / 2 + 0.2, 0);
    bed.rotation.z = -s * ang;
    const dx = Math.cos(ang), dy = -s * Math.sin(ang), ox = s * Math.sin(ang) * 0.06, oy = Math.cos(ang) * 0.06; // along the slope; up off the bed
    const tiles = [], n = Math.round(BL / 0.4), seg = BL / n;
    for (let j = 1; j < PANS; j++) for (let k = 0; k < n; k++) {
      const l = -BL / 2 + seg * (k + 0.5);
      tiles.push([s * RW / 4 + dx * l + ox, RH / 2 + 0.2 + dy * l + oy, -(RD + 0.1) / 2 + PANW * j + (rand() - 0.5) * 0.012, 0, -s * ang + (rand() - 0.5) * 0.02, 0, 0.97 + rand() * 0.06]);
    }
    const cover = new THREE.CylinderGeometry(0.075, 0.085, seg * 1.04, 12, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    const covers = many(cover, coverMat, tiles), tint = new THREE.Color();
    tiles.forEach((_, i) => { const v = 0.88 + rand() * 0.14; covers.setColorAt(i, tint.setRGB(v, v * (0.96 + rand() * 0.06), v * (0.94 + rand() * 0.08))); });
    part(group(bed, covers));
  }
  part(mesh(new THREE.CylinderGeometry(0.14, 0.14, RD - 0.2, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), coverMat), 0, RH + 0.32, 0);
  {
    const beads = [];
    for (const s of [-1, 1]) for (let z = -RD / 2 + 0.42; z <= RD / 2 - 0.41; z += 0.84) beads.push([s * (RW / 2 + 0.06), 0.3, z]);
    part(many(new THREE.SphereGeometry(0.1, 16, 12), gold, beads));
  }
  {
    // a gold palmette on each corner: a fan of leaves over two small scrolls
    const leaves = [], scrolls = [];
    for (const [x, z] of [[-RW / 2, RD / 2], [RW / 2, RD / 2], [-RW / 2, -RD / 2], [RW / 2, -RD / 2]]) {
      for (let i = -3; i <= 3; i++) { const a = i * 0.3; leaves.push([x + Math.sin(a) * 0.15, 0.42 + Math.cos(a) * 0.15, z, 0, -a]); }
      for (const s of [-1, 1]) scrolls.push([x + s * 0.08, 0.3, z]);
    }
    part(group(many(new THREE.SphereGeometry(1, 12, 8).scale(0.036, 0.15, 0.024), gold, leaves), many(new THREE.TorusGeometry(0.05, 0.02, 8, 20), gold, scrolls)));
  }
  {
    // a seated bronze griffin at the apex, wings raised
    const gr = new THREE.Group();
    const ball = (sx, sy, sz, x, y, z) => { const b = mesh(new THREE.SphereGeometry(1, 20, 14), bronze, x, y, z); b.scale.set(sx, sy, sz); return b; };
    gr.add(mesh(block(0.42, 0.08, 0.36, 0.015), bronze, 0, 0.04, 0));
    gr.add(ball(0.15, 0.13, 0.2, 0, 0.2, -0.05), ball(0.11, 0.18, 0.11, 0, 0.34, 0.08), ball(0.075, 0.075, 0.085, 0, 0.56, 0.11));
    gr.add(mesh(new THREE.ConeGeometry(0.03, 0.1, 10).rotateX(Math.PI / 2 + 0.6), bronze, 0, 0.53, 0.21));
    for (const s of [-1, 1]) {
      gr.add(mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.24, 8), bronze, s * 0.06, 0.16, 0.13), ball(0.012, 0.05, 0.03, s * 0.05, 0.64, 0.08)); // forelegs, ears
      const w = new THREE.Shape();
      w.moveTo(0, 0); w.quadraticCurveTo(-0.07, 0.3, 0.02, 0.54); w.lineTo(0.1, 0.46); w.lineTo(0.12, 0.38); w.lineTo(0.18, 0.33);
      w.lineTo(0.17, 0.25); w.lineTo(0.23, 0.2); w.lineTo(0.2, 0.12); w.quadraticCurveTo(0.1, 0, 0, 0);
      const wing = mesh(new THREE.ExtrudeGeometry(w, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }).translate(0, 0, -0.015), bronze);
      wing.rotation.y = Math.PI / 2;
      const hinge = group(wing);
      hinge.position.set(s * 0.1, 0.3, 0.02);
      hinge.rotation.z = -s * 0.38;
      gr.add(hinge);
    }
    gr.scale.setScalar(1.3);
    part(gr, 0, RH + 0.36, RD / 2 - 0.4);
  }

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
  const ALL = Object.values(queue).reduce((a, q) => a + q.length, 0);

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
    for (const line of [1, 2, 3, 4]) {
      const list = queue[line], n = list.length, [top, bottom] = ws[line];
      const u = reduced ? 1 : clamp01((0.95 - top) / ((bottom - top) * 0.92));
      const dur = Math.min(0.4, 3 / n);
      list.forEach((pc, k) => {
        const p = settle(clamp01((u - (n > 1 ? (k / (n - 1)) * (1 - dur) : 0)) / dur));
        built += p;
        if (pc.col !== undefined) { colDrop[pc.col] = pc.lift * (1 - p); return; }
        pc.obj.position.y = pc.home + pc.lift * (1 - p);
        pc.obj.rotation.y = pc.turn * (1 - p);
      });
    }
    built /= ALL;
    placeColumns();
    // the last line: the steps warm one after another, top to bottom, and stay warm
    const [lt, lb] = ws[5];
    const hold = clamp01(-lt / Math.max(0.05, lb - lt - 1));
    stepMats.forEach((m, i) => { m.emissiveIntensity = reduced ? 0 : 0.16 * ease(clamp01(hold * 2.2 - (2 - i) * 0.5)); });

    // the camera comes down and in as the building completes, and walks a little way around it
    const viewP = clamp01((-sec.getBoundingClientRect().top - (scrollY - sy)) / Math.max(1, sec.offsetHeight - innerHeight));
    const portrait = camera.aspect < 1.05;
    const b = ease(built);
    const dist = lerp(68, 46, b) * (portrait ? lerp(1.8, 2.04, b) : 1);
    const elev = THREE.MathUtils.degToRad(lerp(16, 11, b));
    const az = THREE.MathUtils.degToRad(reduced ? -24 : -40 + 22 * viewP); // reduced motion: a still camera
    const ty = lerp(7.4, 3.5, b);
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
  placeColumns();
  paint();
}
