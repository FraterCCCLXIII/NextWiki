// warp-view3d.js -- the 3D view of the Warp Drive Lab (Three.js).  Orbit/zoom/auto-spin, a warped-space terrain
// built from the engine's own curvature field, a glowing bubble wall, photon trails and dropped masses flown
// through the real metric, space-flow tracers, relativistic star streaks and a bloom pass.
//
// World mapping (all in the comoving frame, ship at the origin):  X = x (flight), Z = y, Y(up) = z,
// scaled by S = 9 / view.W so the visible window is always about 18 world units wide.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const SEG = 140, TRAIL = 56;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function dotTexture(soft) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(soft ? 0.25 : 0.6, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const FRESNEL = {
  vertex: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragment: `uniform vec3 uColor; uniform float uTime; uniform float uPow; uniform float uAlpha; varying vec3 vN; varying vec3 vV; varying vec3 vP;
    void main(){ float f = pow(1.0 - abs(dot(vN, vV)), uPow);
      float bands = 0.5 + 0.5 * sin(vP.x * 9.0 - uTime * 2.6 + sin(vP.y * 5.0 + uTime) * 1.5);
      float rim = f * (0.55 + 0.3 * bands);
      gl_FragColor = vec4(uColor * rim + uColor * 0.04, clamp(rim * uAlpha + 0.03, 0.0, 1.0)); }`,
};


/* ---- theoretical ships: procedural models, nose along +x, about 1 unit long before scaling ---- */
export const SHIPS = {
  cone: { name: 'Original cone (Alcubierre probe)', len: 10, crew: 'uncrewed', note: 'The point-like craft of the 1994 paper: a dart sitting in the flat interior. It needs no engine -- the bubble carries it.' },
  ring: { name: 'Warp-ring ship (White / IXS-style)', len: 80, crew: '12', note: 'A crew capsule threaded through a toroidal warp ring. White (2011) argued a ring with an oscillating thick wall lowers the energy; here it is one ordinary bubble around the ring.' },
  saucer: { name: 'Saucer cruiser', len: 120, crew: '200', note: 'A wide hull. The bubble must enclose the full disc radius, so the wall area (and energy ~ R^2) is set by the disc, not the length.' },
  needle: { name: 'Needle scout', len: 60, crew: '3', note: 'Long and thin: a sphere around it is mostly empty space. A prolate (stretched) bubble would be cheaper than the sphere modelled here.' },
  pod: { name: 'Pocket habitat (Van den Broeck)', len: 100, crew: '2000', note: 'A large habitat in a tiny-necked pocket: pair it with the Van den Broeck metric, where the interior is (1 + alpha) times the neck radius.' },
  wedge: { name: 'Wedge shuttle', len: 25, crew: '8', note: 'A stubby arrowhead for short hops; fits the Natario flow, which is smoothest around a streamlined body.' },
};
function makeShip(id, R) {
  const g = new THREE.Group(), hull = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.7, roughness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x4a5260, metalness: 0.6, roughness: 0.5 });
  const glowM = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 });
  const rotX = (o) => { o.rotation.z = -Math.PI / 2; return o; };
  const add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); g.add(o); return o; };
  if (id === 'ring') {
    add(rotX(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 20), hull)), 0, 0, 0); add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 12), hull), 0.4, 0, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 14, 64), glowM(0x58d0ff)); ring.rotation.y = Math.PI / 2; add(ring, -0.05, 0, 0);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 10, 64), glowM(0xaaf0ff)); ring2.rotation.y = Math.PI / 2; add(ring2, 0.05, 0, 0);
    for (const a of [0, 2.1, 4.2]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), dark); st.position.set(-0.02, Math.cos(a) * 0.15, Math.sin(a) * 0.15); st.rotation.x = a + Math.PI / 2; g.add(st); }
  } else if (id === 'saucer') {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 20), hull); d.scale.set(1, 0.17, 1); add(d); add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), glowM(0x9fd8ff)), 0.05, 0.06, 0);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.012, 8, 72), glowM(0x58d0ff)); r.rotation.x = Math.PI / 2; add(r, 0, -0.01, 0);
    for (const z of [-0.12, 0.12]) add(rotX(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 14), dark)), -0.5, 0, z);
  } else if (id === 'needle') {
    add(rotX(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.3, 14), hull))); add(rotX(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.35, 14), glowM(0xff9a4a))), 0.82, 0, 0);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.12), dark); f.position.set(-0.55, 0, 0); f.rotation.x = k * Math.PI * 2 / 3; f.geometry.translate(-0.0, 0.0, 0.08); g.add(f); }
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glowM(0x58d0ff)), -0.66, 0, 0);
  } else if (id === 'pod') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 20), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2a6a9a, emissiveIntensity: 0.8, transparent: true, opacity: 0.6 })));
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), glowM(0xffe3a0)));
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 10, 56), hull); r.rotation.y = Math.PI / 2; add(r);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 10, 56), hull); r2.rotation.x = Math.PI / 2; add(r2);
    add(rotX(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 12), glowM(0xff9a4a))), -0.42, 0, 0);
  } else if (id === 'wedge') {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 3), hull); w.rotation.z = -Math.PI / 2; w.rotation.x = Math.PI / 2; w.scale.set(1, 1, 0.3); add(w, 0.0, 0, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.12), glowM(0x9fd8ff)), 0.18, 0.045, 0);
    for (const z of [-0.14, 0.14]) add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), glowM(0xff9a4a)), -0.5, 0, z);
  } else {
    add(rotX(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.62, 18), hull))); add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glowM(0xff9a4a)), -0.32, 0, 0);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(true), color: 0xaad4ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 })); glow.scale.set(1.3, 1.3, 1); g.add(glow);
  const k = clamp(R * 0.34, 0.35, 1.7); g.scale.setScalar(k); return g;
}

export function createView3D(host, api) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x04060a);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 500); camera.position.set(-11, 6.5, 12);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotate = true; controls.autoRotateSpeed = 1.1; controls.minDistance = 2; controls.maxDistance = 60;
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.45, 0.5, 0.35); composer.addPass(bloom); composer.addPass(new OutputPass());
  const state = { bloom: true, time: 0, S: 1, layerKey: '', fieldTok: -1, ready: false };
  const soft = dotTexture(true), hard = dotTexture(false);
  scene.add(new THREE.AmbientLight(0x8aa0c0, 1.4)); const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(3, 6, 4); scene.add(sun);

  /* ---- terrain: the engine's field drawn as a warped sheet ---- */
  const N = SEG + 1, tgeo = new THREE.PlaneGeometry(18, 18, SEG, SEG); tgeo.rotateX(-Math.PI / 2);
  tgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
  const terrain = new THREE.Mesh(tgeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(terrain);
  const idx = []; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { if (x < SEG && z % 4 === 0) idx.push(z * N + x, z * N + x + 1); if (z < SEG && x % 4 === 0) idx.push(z * N + x, (z + 1) * N + x); }
  const lgeo = new THREE.BufferGeometry(); lgeo.setAttribute('position', tgeo.attributes.position); lgeo.setAttribute('color', tgeo.attributes.color); lgeo.setIndex(idx);
  const grid = new THREE.LineSegments(lgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(grid);

  /* ---- stars (streaks) ---- */
  const NS = 1400, L = 30, sBase = new Float32Array(NS * 3), sPos = new Float32Array(NS * 6), sCol = new Float32Array(NS * 6);
  for (let i = 0; i < NS; i++) { sBase[i * 3] = (Math.random() * 2 - 1) * L; sBase[i * 3 + 1] = (Math.random() * 2 - 1) * L * 0.6; sBase[i * 3 + 2] = (Math.random() * 2 - 1) * L * 0.6; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const stars = new THREE.LineSegments(sgeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); stars.frustumCulled = false; scene.add(stars);

  /* ---- space-flow tracers: Eulerian observers in the comoving frame move with (X - vs) ---- */
  const NT = 900, tPos = new Float32Array(NT * 3), tCol = new Float32Array(NT * 3), tM = new Float32Array(NT * 3);   // tM = metres (x, y, z)
  const tgeoP = new THREE.BufferGeometry(); tgeoP.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tgeoP.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  const tracers = new THREE.Points(tgeoP, new THREE.PointsMaterial({ size: 0.11, map: soft, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); tracers.frustumCulled = false; scene.add(tracers);
  function seedTracer(i, anywhere) { const Wd = api.view().W; tM[i * 3] = anywhere ? (Math.random() * 2 - 1) * Wd * 1.2 : Wd * 1.2; tM[i * 3 + 1] = (Math.random() * 2 - 1) * Wd * 0.7; tM[i * 3 + 2] = (Math.random() * 2 - 1) * Wd * 0.5; }

  /* ---- per-simulation objects ---- */
  const dyn = new THREE.Group(); scene.add(dyn);
  let shipGroup = null, rayLines = [], dustPts = null, rayPts = null, rayTrail = [], dustCount = 0, uniforms = [], shipGlow = null;
  const dispose = o => { o.traverse(c => { c.geometry?.dispose?.(); if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose?.()); }); };
  function fres(r, color, pow, alpha) {
    const u = { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uPow: { value: pow }, uAlpha: { value: alpha } }; uniforms.push(u);
    return new THREE.Mesh(new THREE.SphereGeometry(r, 72, 48), new THREE.ShaderMaterial({ uniforms: u, vertexShader: FRESNEL.vertex, fragmentShader: FRESNEL.fragment, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide }));
  }
  function ring(r, color, axis) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r; pts.push(axis === 0 ? new THREE.Vector3(0, c, s) : axis === 1 ? new THREE.Vector3(c, 0, s) : new THREE.Vector3(c, s, 0)); }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  }
  function rebuild() {
    while (dyn.children.length) { const c = dyn.children.pop(); dispose(c); }
    uniforms = []; rayLines = []; rayTrail = [];
    const sim = api.sim(), m = sim.m, Wd = api.view().W, S = state.S = 9 / Wd, R = m.R * S;
    const fast = m.vs > 1, tint = fast ? 0xff9a4a : 0x58b8ff;
    dyn.add(fres(R, tint, 2.6, 0.8));
    ['x', 'y', 'z'].forEach((_, a) => dyn.add(ring(R, tint, a)));
    if (m.cfg.model === 'vandenbroeck') { dyn.add(fres(m.Rb * S, 0xffd37a, 2.2, 0.9)); dyn.add(ring(m.Rb * S, 0xffd37a, 1)); }
    if (m.cfg.model === 'shell') dyn.add(fres(R * 1.06, 0xd9a0ff, 1.8, 0.6));
    shipGroup = makeShip(api.ship(), R); dyn.add(shipGroup);
    // rays: a point + a fading trail each
    const nr = sim.rays.length;
    rayPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.16, map: hard, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    rayPts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nr * 3), 3)); rayPts.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nr * 3), 3)); rayPts.frustumCulled = false; dyn.add(rayPts);
    sim.rays.forEach((r, i) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3)); g.setDrawRange(0, 0);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); line.frustumCulled = false; dyn.add(line); rayLines.push(line); rayTrail.push([]);
    });
    dustCount = sim.dust.length;
    dustPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.2, map: hard, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    dustPts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3)); dustPts.frustumCulled = false; dyn.add(dustPts);
    for (let i = 0; i < NT; i++) seedTracer(i, true);
    state.layerKey = ''; state.ready = false;
    controls.target.set(0, 0, 0);
  }

  /* ---- terrain values ---- */
  function lookup(f, arr, x, s, Wd) {
    const GX = f.GX, GY = f.GY, hx = 2 * Wd / GX, hy = Wd / GY, fx = clamp((x + Wd) / hx - 0.5, 0, GX - 1.001), fy = clamp(s / hy - 0.5, 0, GY - 1.001);
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, a = arr[j * GX + i], b = arr[j * GX + i + 1], c = arr[(j + 1) * GX + i], d = arr[(j + 1) * GX + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
  function updateTerrain() {
    const f = api.field(), m = api.model(), Wd = api.view().W, layer = api.layer();
    state.layerKey = layer + ':' + (f ? f.tok : 0); state.ready = !!(f && f.ready);
    const pos = tgeo.attributes.position, col = tgeo.attributes.color, vals = new Float32Array(N * N);
    const seq = layer === 'tidal' || layer === 'shift'; let mx = 1e-300;
    const h = 2 * Wd / SEG * 0.3;
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = -Wd + 2 * Wd * ix / SEG, y = -Wd + 2 * Wd * iz / SEG; let v = 0;
      if (layer === 'exp') v = (m.X(x + h, y, 0)[0] - m.X(x - h, y, 0)[0] + m.X(x, y + h, 0)[1] - m.X(x, y - h, 0)[1]) / (2 * h);
      else if (f && f.ready) v = lookup(f, layer === 'rho' ? f.rho : layer === 'nec' ? f.nec : layer === 'tidal' ? f.tid : f.sh, x, Math.abs(y), Wd);
      vals[iz * N + ix] = v; mx = Math.max(mx, Math.abs(v));
    }
    const r0 = mx * 1e-4, norm = Math.log10(1 + mx / r0), Hmax = 2.6;
    for (let k = 0; k < N * N; k++) {
      const v = vals[k], t = Math.log10(1 + Math.abs(v) / r0) / norm, sgn = v < 0 ? -1 : 1;
      pos.setY(k, (seq ? t : sgn * t) * Hmax * (layer === 'shift' ? 0.6 : 1));
      let r, g, b;
      if (seq) { r = 0.1 + 0.9 * t; g = 0.15 + 0.5 * t * t; b = 0.35 * (1 - t); if (layer === 'shift' && v >= 1) { r = 1; g = 0.75; b = 0.25; } }
      else if (v < 0) { r = 0.1 + 0.15 * t; g = 0.25 + 0.6 * t; b = 0.5 + 0.5 * t; } else { r = 0.5 + 0.5 * t; g = 0.18 + 0.3 * t; b = 0.15 + 0.1 * t; }
      const e = Math.min(1, 0.25 + t * 1.5); col.setXYZ(k, r * e, g * e, b * e);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  /* ---- frame ---- */
  const tmp = new THREE.Color();
  function frame(dt, simDt, running) {
    const sim = api.sim(); if (!sim) return;
    const m = sim.m, S = state.S, Wd = api.view().W, f = api.field();
    state.time += dt;
    const key = api.layer() + ':' + (f ? f.tok : 0);
    if (key !== state.layerKey || (f && f.ready && !state.ready)) updateTerrain();
    uniforms.forEach(u => { u.uTime.value = state.time; });
    controls.update();
    // stars
    const xsS = m.xs * S, len = 0.15 + 0.55 * Math.log10(1 + m.vs), vis = Math.min(1, 0.35 + 0.25 * Math.log10(1 + m.vs));
    for (let i = 0; i < NS; i++) {
      let x = sBase[i * 3] - xsS; x = ((x + L) % (2 * L) + 2 * L) % (2 * L) - L;
      const y = sBase[i * 3 + 1], z = sBase[i * 3 + 2], u = clamp(x / L, -1, 1), bl = clamp(0.5 + 0.5 * u, 0, 1);
      const r = (1 - bl) * 1.0 + bl * 0.55, g = 0.6 + 0.2 * (1 - Math.abs(u)), b = 0.5 + bl * 0.5;
      const o = i * 6; sPos[o] = x; sPos[o + 1] = z; sPos[o + 2] = y; sPos[o + 3] = x + len; sPos[o + 4] = z; sPos[o + 5] = y;
      sCol[o] = r * vis; sCol[o + 1] = g * vis; sCol[o + 2] = b * vis; sCol[o + 3] = r * vis * 0.04; sCol[o + 4] = g * vis * 0.04; sCol[o + 5] = b * vis * 0.04;
    }
    sgeo.attributes.position.needsUpdate = true; sgeo.attributes.color.needsUpdate = true;
    // tracers
    const sub = 4, dts = running ? simDt / sub : 0, B = Wd * 1.2, vs = m.vs; const o0 = m.xs; m.xs = 0;
    for (let i = 0; i < NT; i++) {
      let x = tM[i * 3], y = tM[i * 3 + 1], z = tM[i * 3 + 2], sp = 0;
      for (let k = 0; k < sub; k++) { const X = m.X(x, y, z); const ux = X[0] - vs, uy = X[1], uz = X[2]; x += ux * dts; y += uy * dts; z += uz * dts; sp = Math.hypot(ux, uy, uz); }
      if (x < -B || x > B * 1.02 || Math.abs(y) > Wd * 0.8 || Math.abs(z) > Wd * 0.7) { seedTracer(i, false); x = tM[i * 3]; y = tM[i * 3 + 1]; z = tM[i * 3 + 2]; } else { tM[i * 3] = x; tM[i * 3 + 1] = y; tM[i * 3 + 2] = z; }
      tPos[i * 3] = x * S; tPos[i * 3 + 1] = z * S; tPos[i * 3 + 2] = y * S;
      const q = clamp(sp / Math.max(vs, 0.3), 0, 1.2); tmp.setRGB(0.25 + 0.75 * q, 0.55 + 0.25 * (1 - q), 1.0 - 0.7 * q);
      const fade = 0.25 + 0.75 * Math.max(0, 1 - Math.abs(x) / B); tCol[i * 3] = tmp.r * fade; tCol[i * 3 + 1] = tmp.g * fade; tCol[i * 3 + 2] = tmp.b * fade;
    }
    m.xs = o0; tgeoP.attributes.position.needsUpdate = true; tgeoP.attributes.color.needsUpdate = true;
    // rays + trails
    const rp = rayPts.geometry.attributes.position, rc = rayPts.geometry.attributes.color;
    sim.rays.forEach((r, i) => {
      const wx = (r.s[0] - m.xs) * S, wy = r.s[2] * S, wz = r.s[1] * S;
      rp.setXYZ(i, wx, wy, wz); const piled = r.piled; rc.setXYZ(i, piled ? 1 : 1, piled ? 0.35 : 0.9, piled ? 0.2 : 0.45);
      const tr = rayTrail[i], last = tr[tr.length - 1];
      if (running && (!last || Math.hypot(last[0] - wx, last[1] - wy, last[2] - wz) > 0.08)) { tr.push([wx, wy, wz]); if (tr.length > TRAIL) tr.shift(); }
      const g = rayLines[i].geometry, P = g.attributes.position, C = g.attributes.color, n = tr.length;
      for (let k = 0; k < n; k++) { P.setXYZ(k, tr[k][0], tr[k][1], tr[k][2]); const a = (k / Math.max(1, n - 1)) ** 1.6 * 0.8; C.setXYZ(k, 1 * a, 0.82 * a, 0.3 * a); }
      g.setDrawRange(0, n); P.needsUpdate = true; C.needsUpdate = true;
    });
    rp.needsUpdate = true; rc.needsUpdate = true;
    const dp = dustPts.geometry.attributes.position; sim.dust.forEach((r, i) => dp.setXYZ(i, (r.s[0] - m.xs) * S, r.s[2] * S, r.s[1] * S)); dp.needsUpdate = true;
    // render
    if (state.bloom) composer.render(); else renderer.render(scene, camera);
  }
  function setShip() { if (!shipGroup) return; dyn.remove(shipGroup); dispose(shipGroup); shipGroup = makeShip(api.ship(), api.sim().m.R * state.S); dyn.add(shipGroup); }
  function resize() { const w = host.clientWidth || 800, h = host.clientHeight || 600; renderer.setSize(w, h); composer.setSize(w, h); bloom.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function preset(name) {
    const d = camera.position.length() > 5 ? 17 : 17;
    const P = { chase: [-9, 2.6, 0.01], side: [0.01, 2, 17], top: [0.01, 18, 0.01], front: [12, 4, 8], orbit: [-11, 6.5, 12] }[name] || [-11, 6.5, 12];
    camera.position.set(...P); controls.target.set(0, 0, 0); controls.update();
  }
  return { rebuild, setShip, frame, resize, preset, controls, set bloom(v) { state.bloom = v; }, set spin(v) { controls.autoRotate = v; }, invalidate() { state.layerKey = ''; }, renderer };
}
