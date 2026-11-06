// Fee page: "the architecture of one fee". A stone model of a 1930s tower stands on the page's drafting sheet.
// Drawn first in pieces, floating apart, it is set in place piece by piece as the visitor scrolls, so every movement
// adds something: the steps and the podium (financial planning); the glass floor by floor and the stone piers one at
// a time (investment management); the setbacks course by course, each stage narrower (coordination); and the crown,
// lowered on stage by stage to its dark stone cap (ongoing strategy). It is complete as the last line arrives; then
// the steps warm and the windows light, floor by floor from the ground up.
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

  // ---------- materials ----------
  const stone = (extra = {}) => new THREE.MeshStandardMaterial({ color: '#e4ddd3', ...marble, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, emissive: 0x8a6420, emissiveIntensity: 0, ...extra });
  const stoneMat = stone();
  const stepMats = [stone(), stone(), stone()]; // each step its own, so they can warm one after another
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
  // many copies of one shape in one draw: blocks, frames, chevrons, bars
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

  // ---------- the ground is the page itself: an invisible floor catches the tower's shadow, and a soft
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
  const model = new THREE.Group();
  scene.add(model);
  const queue = { 1: [], 2: [], 3: [], 4: [] };
  const LIFT = { 1: 1.0, 2: 2.4, 3: 3.6, 4: 4.6 }; // how far each line's pieces float above their place before they are set
  const piece = (obj, line) => { model.add(obj); queue[line].push({ obj, home: obj.position.y, lift: LIFT[line], turn: (rand() - 0.5) * 0.06 }); return obj; };

  // ---------- the tower: a stone tower of the 1930s, stepping back as it rises to a dark stone cap. It is set
  //            piece by piece, the crown lowered on last, and when it is complete its windows light, floor by floor
  //            from the ground up ----------
  const carve = stone({ color: '#b6aa98' }); // the stone in shadow, for carved lines
  const steel = new THREE.MeshStandardMaterial({ color: '#b4b5b1', roughness: 0.38, metalness: 0.6, envMapIntensity: 1.3 }); // silver window frames
  const slate = new THREE.MeshStandardMaterial({ color: '#4a4c4e', roughness: 0.42, metalness: 0.55, envMapIntensity: 1.1 });
  const lights = []; // every floor's glass, ground up: each lights in turn at the end
  const roomGlow = (() => { // the light of a room behind each bay: warm in the middle, falling off to the frames
    const c = canvasOf(128), g = c.getContext('2d'), r = g.createRadialGradient(64, 76, 6, 64, 70, 78);
    r.addColorStop(0, '#fff'); r.addColorStop(0.55, '#8a8a8a'); r.addColorStop(1, '#262626');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = texOf(c, true);
    t.repeat.set(6, 1);
    return t;
  })();
  const glassFloor = () => { const m = new THREE.MeshStandardMaterial({ color: '#6c7673', roughness: 0.05, metalness: 0.6, envMapIntensity: 1.6, emissive: 0xffad5c, emissiveMap: roomGlow, emissiveIntensity: 0 }); lights.push(m); return m; };
  const STEP = 0.34, INSET = 0.38, W = 12.2, D = 10.6, FLOOR = STEP * 3;

  // 1. the foundation: three steps, the podium course by course, then its bronze doors, fanlight and grille
  for (let i = 0; i < 3; i++) {
    const w = W - 2 * INSET * i, d = D - 2 * INSET * i, nx = Math.round(w / 1.6), nz = Math.round(d / 1.3), bw = w / nx, bd = d / nz, spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-w / 2 + bw * (a + 0.5), 0, -d / 2 + bd * (b + 0.5)]);
    const step = blocks(spots, bw - 0.012, STEP, bd - 0.012, 0.03, stepMats[i]);
    step.position.y = STEP * (i + 0.5);
    piece(step, 1);
  }
  const PW = 10.2, PD = 8.6, PH = 1.8, P0 = FLOOR, ch = PH / 3;
  for (let c = 0; c < 3; c++) { // rusticated courses, their joints staggered
    const nx = c % 2 ? 6 : 7, nz = c % 2 ? 5 : 6, bw = PW / nx, bd = PD / nz, spots = [];
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) spots.push([-PW / 2 + bw * (a + 0.5), 0, -PD / 2 + bd * (b + 0.5)]);
    const course = blocks(spots, bw - 0.025, ch - 0.025, bd - 0.025, 0.05, stoneMat);
    course.position.y = P0 + ch * (c + 0.5);
    piece(course, 1);
  }
  {
    const DW = 1.5, DH = 1.15, R = DW / 2, portal = new THREE.Group(), f = 0.012;
    portal.add(mesh(new THREE.BoxGeometry(DW + 0.1, DH + R + 0.05, 0.02), shade, 0, (DH + R) / 2, f)); // the dark of the opening
    for (const s of [-1, 1]) {
      portal.add(mesh(block(0.2, DH + R + 0.12, 0.3, 0.02), stoneMat, s * (DW / 2 + 0.1), (DH + R + 0.12) / 2, 0.05)); // jambs
      portal.add(mesh(new RoundedBoxGeometry(DW / 2 - 0.03, DH, 0.05, 2, 0.01), doorBronze, s * DW / 4, DH / 2, 0.05));
      portal.add(many(new THREE.BoxGeometry(0.025, DH - 0.2, 0.025), bronze, [-0.12, 0.12].map((u) => [s * DW / 4 + u, DH / 2, 0.085])));
      portal.add(mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), bronze, s * DW / 4, DH * 0.62, 0.085));
    }
    portal.add(mesh(block(DW + 0.6, 0.18, 0.32, 0.02), stoneMat, 0, DH + R + 0.15, 0.06)); // the lintel
    // the fanlight: a half wheel of bronze bars over the doors
    const spokes = [...Array(7).keys()].map((i) => { const a = ((i + 1) / 8) * Math.PI; return [Math.cos(a) * R * 0.5, DH + Math.sin(a) * R * 0.5, 0.04, 0, a]; });
    portal.add(many(new THREE.BoxGeometry(R, 0.02, 0.02), bronze, spokes), mesh(new THREE.TorusGeometry(R - 0.02, 0.025, 6, 32, Math.PI), bronze, 0, DH, 0.04),
      mesh(new THREE.BoxGeometry(DW, 0.04, 0.04), bronze, 0, DH + 0.01, 0.05));
    // a bronze grille in the podium to the right of the doors
    portal.add(mesh(new THREE.BoxGeometry(1.7, 0.36, 0.02), shade, 2.2, 1.12, f), mesh(block(1.82, 0.48, 0.1, 0.015), stoneMat, 2.2, 1.12, 0.0),
      many(new THREE.BoxGeometry(1.6, 0.025, 0.04), bronze, [0, 1, 2, 3, 4].map((i) => [2.2, 0.98 + i * 0.07, 0.03])));
    portal.position.set(0, P0, PD / 2);
    piece(portal, 1);
  }

  // 2. the shaft: the glass floor by floor, its steel frames, then the stone piers one at a time
  const S0 = P0 + PH, SW = 8.4, SD = 6.8, SH = 6.0, NF = 5, FH = SH / NF;
  for (let i = 0; i < NF; i++) piece(mesh(new THREE.BoxGeometry(SW - 0.3, FH - 0.01, SD - 0.3), glassFloor(), 0, S0 + FH * (i + 0.5), 0), 2);
  {
    const zf = SD / 2 - 0.12, xf = SW / 2 - 0.12, verts = [];
    for (const x of [-2.95, -1.8, -0.6, 0.6, 1.8, 2.95]) for (const s of [-1, 1]) verts.push([x, S0 + SH / 2, s * zf]);
    for (const z of [-1.95, -0.6, 0.6, 1.95]) for (const s of [-1, 1]) verts.push([s * xf, S0 + SH / 2, z, Math.PI / 2]);
    piece(group(many(new THREE.BoxGeometry(SW - 0.22, 0.12, SD - 0.22), steel, [1, 2, 3, 4].map((i) => [0, S0 + FH * i, 0])),
      many(new THREE.BoxGeometry(0.05, SH, 0.06), steel, verts)), 2);
  }
  const pier = (x, z, w, d, cap) => piece(group(mesh(block(w, SH + 0.1, d, 0.03), stoneMat, x, S0 + (SH + 0.1) / 2, z),
    ...(cap ? [mesh(block(w + 0.14, 0.16, d + 0.12, 0.02), stoneMat, x, S0 + SH + 0.04, z)] : [])), 2);
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) pier(x, -SD / 2, 0.32, 0.4, true); // the back
  for (const z of [-1.2, 0, 1.2]) for (const s of [-1, 1]) pier(s * SW / 2, z, 0.4, 0.32, true); // the sides
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pier(sx * (SW / 2 - 0.25), sz * (SD / 2 - 0.25), 0.9, 0.9, false); // the corners
  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) pier(x, SD / 2, 0.32, 0.4, true); // the front, last

  // 3. the setbacks, course by course: the cornice and its carved chevron, the second stage, the third, each narrower
  const C1 = S0 + SH + 0.12;
  piece(mesh(block(SW + 0.5, 0.42, SD + 0.5, 0.04), stoneMat, 0, C1 + 0.21, 0), 3);
  {
    const chev = [], cy = C1 + 0.2;
    for (const [len, off, alongX] of [[SW + 0.4, SD / 2 + 0.252, true], [SD + 0.4, SW / 2 + 0.252, false]]) {
      const n = Math.floor(len / 0.2);
      for (let i = 0; i < n; i++) {
        const u = -len / 2 + 0.1 + i * 0.2, tilt = (i % 2 ? 1 : -1) * 0.7;
        for (const s of [-1, 1]) chev.push(alongX ? [u, cy, s * off, 0, tilt] : [s * off, cy, u, Math.PI / 2, tilt]);
      }
    }
    piece(many(new THREE.BoxGeometry(0.21, 0.028, 0.012), carve, chev), 3);
  }
  const T2 = C1 + 0.42, W2 = 6.2, D2 = 5.0, H2 = 2.6;
  for (let i = 0; i < 2; i++) piece(mesh(new THREE.BoxGeometry(W2 - 0.3, H2 / 2 - 0.01, D2 - 0.3), glassFloor(), 0, T2 + (H2 / 2) * (i + 0.5), 0), 3);
  {
    const along = [], corners = [], verts = [];
    for (const x of [-1.9, -0.95, 0, 0.95, 1.9]) for (const s of [-1, 1]) along.push([x, T2 + H2 / 2, s * D2 / 2]);
    for (const z of [-0.95, 0, 0.95]) for (const s of [-1, 1]) along.push([s * W2 / 2, T2 + H2 / 2, z, Math.PI / 2]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) corners.push([sx * (W2 / 2 - 0.2), T2 + H2 / 2, sz * (D2 / 2 - 0.2)]);
    for (const x of [-1.42, -0.48, 0.48, 1.42]) for (const s of [-1, 1]) verts.push([x, T2 + H2 / 2, s * (D2 / 2 - 0.12)]);
    piece(group(many(block(0.3, H2 + 0.05, 0.38, 0.03), stoneMat, along), many(block(0.7, H2 + 0.05, 0.7, 0.03), stoneMat, corners),
      mesh(new THREE.BoxGeometry(W2 - 0.22, 0.1, D2 - 0.22), steel, 0, T2 + H2 / 2, 0), many(new THREE.BoxGeometry(0.05, H2, 0.06), steel, verts)), 3);
  }
  const C2 = T2 + H2;
  piece(mesh(block(W2 + 0.4, 0.3, D2 + 0.4, 0.035), stoneMat, 0, C2 + 0.15, 0), 3);
  const T3 = C2 + 0.3, W3 = 4.4, D3 = 3.6, H3 = 1.8;
  {
    const slits = [], glow = glassFloor();
    for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) for (const s of [-1, 1]) slits.push([x, T3 + H3 / 2, s * (D3 / 2 + 0.004)]);
    for (const z of [-0.9, 0, 0.9]) for (const s of [-1, 1]) slits.push([s * (W3 / 2 + 0.004), T3 + H3 / 2, z, Math.PI / 2]);
    piece(group(mesh(block(W3, H3, D3, 0.03), stoneMat, 0, T3 + H3 / 2, 0), many(new THREE.BoxGeometry(0.15, H3 - 0.55, 0.02), glow, slits)), 3);
  }
  const C3 = T3 + H3;
  piece(mesh(block(W3 + 0.3, 0.25, D3 + 0.3, 0.03), stoneMat, 0, C3 + 0.125, 0), 3);

  // 4. the crown, lowered on stage by stage, the dark stone cap last
  const K0 = C3 + 0.25;
  piece(mesh(block(3.3, 0.62, 2.7, 0.03), stoneMat, 0, K0 + 0.31, 0), 4);
  piece(mesh(block(2.4, 0.52, 1.95, 0.03), stoneMat, 0, K0 + 0.62 + 0.26, 0), 4);
  {
    const cap = mesh(new THREE.CylinderGeometry(0.62, 0.92, 0.5, 4, 1), slate, 0, K0 + 1.22 + 0.25, 0);
    cap.rotation.y = Math.PI / 4;
    piece(group(mesh(block(1.5, 0.08, 1.5, 0.01), slate, 0, K0 + 1.18, 0), cap), 4);
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
        built += p / n / 4; // each of the four lines counts the same, however many pieces it has
        pc.obj.position.y = pc.home + pc.lift * (1 - p);
        pc.obj.rotation.y = pc.turn * (1 - p);
      });
    }
    // the last line: the steps warm, top to bottom, and the windows light, floor by floor from the ground up
    const [lt, lb] = ws[5];
    const hold = clamp01(-lt / Math.max(0.05, lb - lt - 1));
    stepMats.forEach((m, i) => { m.emissiveIntensity = reduced ? 0 : 0.16 * ease(clamp01(hold * 2.2 - (2 - i) * 0.5)); });
    lights.forEach((m, i) => { m.emissiveIntensity = reduced ? 0.55 : 0.55 * ease(clamp01(hold * 2.4 - (i / lights.length) * 1.4)); });

    // the camera comes down and in as the building completes, and walks a little way around it
    const viewP = clamp01((-sec.getBoundingClientRect().top - (scrollY - sy)) / Math.max(1, sec.offsetHeight - innerHeight));
    const portrait = camera.aspect < 1.05;
    const b = ease(built);
    const dist = lerp(92, 58, b) * (portrait ? lerp(2.0, 2.2, b) : 1); // tall screens: further back, so the tall tower clears the words
    const elev = THREE.MathUtils.degToRad(lerp(16, 11, b));
    const az = THREE.MathUtils.degToRad(reduced ? -24 : -40 + 22 * viewP); // reduced motion: a still camera
    const ty = lerp(11.5, 7.7, b) - (portrait ? 1.2 * b : 0);
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
