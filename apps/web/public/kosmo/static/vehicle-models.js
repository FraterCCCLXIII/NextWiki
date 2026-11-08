/* Vehicle model library.

   Every model is procedural: built from lathe, cylinder, box and extrusion
   primitives, in metres, nose pointing +y, so it can be shown at true scale next
   to any other model and later swapped for an authored mesh without touching the
   viewer. Three tiers, reported to the viewer so the library shows its own gaps:

     detailed     a hand-written spec for that vehicle (SPECS below)
     generic      built from the vehicle's category and its catalogue dimensions
     placeholder  nothing known to draw yet: a ghost capsule at the right size

   Adding a vehicle: write a spec in SPECS keyed by its id in data/vehicles/*.json.
   A rocket spec is a bottom-to-top list of segments plus optional boosters and fins.

     segment  { t:'cyl'|'cone'|'ogive'|'dome'|'bell', l, r, r2?, c?, st? }
              l = length (m), r = base radius, r2 = top radius, st = stage index
              (used by the explode slider), c = colour from C.
*/
import * as THREE from 'three';
import { buildCentauriModel } from './parts/centauri-models.js';   // the solved Centauri assemblies, drawn as CAD

export const C = { white: 0xe9edf2, off: 0xd2d7de, black: 0x1c1e22, orange: 0xc4642a, grey: 0x9aa3ad, dark: 0x4a4f57, steel: 0xc3c8cf, gold: 0xc9a24b, red: 0xb5352d, blue: 0x2a4f8f, green: 0x5c7547, panel: 0x1d2c55, tan: 0xd6b88a, cream: 0xe6dcc3 };

const cache = new Map();
function mat(c, o = {}) {
  const k = `${c}|${o.metal ?? ''}|${o.rough ?? ''}|${o.emissive ?? ''}|${o.alpha ?? ''}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color: c, metalness: o.metal ?? 0.15, roughness: o.rough ?? 0.55, emissive: o.emissive ?? 0x000000, side: THREE.DoubleSide, transparent: o.alpha != null, opacity: o.alpha ?? 1 }));
  return cache.get(k);
}
const mesh = (g, c, o) => new THREE.Mesh(g, mat(c, o));
const V2 = (r, y) => new THREE.Vector2(r, y);

/* A segment's base sits at its local y = 0 and it rises l metres. */
function seg(s) {
  const { t = 'cyl', l, r, c = C.white } = s;
  let g;
  if (t === 'cyl') g = new THREE.CylinderGeometry(s.r2 ?? r, r, l, 40);
  else if (t === 'cone') g = new THREE.CylinderGeometry(s.r2 ?? 0, r, l, 40);
  else if (t === 'bell') g = new THREE.CylinderGeometry(r, s.r2 ?? r * 2, l, 24, 1, true);
  else if (t === 'ogive') {
    const rho = (r * r + l * l) / (2 * r), pts = [];
    for (let i = 0; i <= 18; i++) { const x = (i / 18) * l; pts.push(V2(Math.max(0, Math.sqrt(Math.max(0, rho * rho - (l - x) * (l - x))) + r - rho), l - x)); }
    g = new THREE.LatheGeometry(pts, 40);
  } else if (t === 'dome') {
    const pts = []; for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI / 2; pts.push(V2(r * Math.cos(a), l * Math.sin(a))); }
    g = new THREE.LatheGeometry(pts, 36);
  }
  if (t === 'cyl' || t === 'cone' || t === 'bell') g.translate(0, l / 2, 0);
  return mesh(g, c, s.mat);
}

function finShape(span, chord, sweep) {
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(span, -sweep); sh.lineTo(span, -sweep - chord * 0.45); sh.lineTo(0, -chord); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: span * 0.04, bevelEnabled: false }); g.translate(0, 0, -span * 0.02); return g;
}

/* ---- rockets ---- */
function rocket(spec) {
  const root = new THREE.Group(); root.userData.stages = new Map();
  const stageGroup = n => { if (!root.userData.stages.has(n)) { const g = new THREE.Group(); g.userData.stage = n; root.add(g); root.userData.stages.set(n, g); } return root.userData.stages.get(n); };
  let y = 0, R0 = spec.core[0].r;
  for (const s of spec.core) { const m = seg(s); m.position.y = y; stageGroup(s.st ?? 0).add(m); y += s.l; }
  root.userData.top = y;
  if (spec.engines) {
    const e = spec.engines, n = e.n ?? 1, rr = e.r ?? R0 * 0.18, l = e.l ?? R0 * 0.5;
    const pos = n === 1 ? [[0, 0]] : n <= 9 && n > 1 ? [[0, 0], ...Array.from({ length: n - 1 }, (_, i) => { const a = i / (n - 1) * Math.PI * 2; return [Math.cos(a) * R0 * 0.62, Math.sin(a) * R0 * 0.62]; })] : Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [Math.cos(a) * R0 * 0.7, Math.sin(a) * R0 * 0.7]; });
    for (const [x, z] of pos) { const b = seg({ t: 'bell', l, r: rr * 0.5, r2: rr, c: C.dark }); b.position.set(x, -l * 0.6, z); stageGroup(e.st ?? 0).add(b); }
  }
  if (spec.boosters) {
    const b = spec.boosters, bg = new THREE.Group(); bg.userData.boosters = true; root.add(bg);
    for (let i = 0; i < b.n; i++) {
      const a = (b.start ?? 0) + (i / b.n) * Math.PI * 2, one = new THREE.Group();
      let by = 0; for (const s of b.segs) { const m = seg({ c: b.c ?? C.white, ...s }); m.position.y = by; one.add(m); by += s.l; }
      one.position.set(Math.cos(a) * b.off, b.y ?? 0, Math.sin(a) * b.off); one.userData.dir = [Math.cos(a), Math.sin(a)]; bg.add(one);
    }
  }
  if (spec.fins) {
    const f = spec.fins;
    for (let i = 0; i < f.n; i++) { const a = (i / f.n) * Math.PI * 2 + (f.start ?? 0), m = mesh(finShape(f.span, f.chord, f.sweep ?? 0), f.c ?? C.dark); m.position.set(Math.cos(a) * (f.r ?? R0), f.y ?? f.chord, Math.sin(a) * (f.r ?? R0)); m.rotation.y = -a; stageGroup(0).add(m); }
  }
  if (spec.extra) spec.extra(root, stageGroup);
  root.userData.fitAxis = 'y'; return root;
}

/* The standard stack, repeated by many specs: cylinders of given length stacked bottom-up, then a nose. */
const stack = (parts, opts = {}) => ({ core: parts, ...opts });

/* ---- winged vehicles ---- */
function plane(o) {
  const g = new THREE.Group(), L = o.len, R = o.r ?? L * 0.075, col = o.c ?? C.white, bottom = o.bottom ?? C.black;
  const prof = []; const N = 24;
  for (let i = 0; i <= N; i++) { const t = i / N, y = t * L; let r;
    if (t < 0.22) r = R * Math.sin((t / 0.22) * Math.PI / 2) ** 0.8; else if (t < 0.82) r = R; else r = R * (1 - 0.35 * (t - 0.82) / 0.18);
    prof.push(V2(Math.max(r, 0.001), L - y)); }
  g.add(mesh(new THREE.LatheGeometry(prof, 32), col));
  const wing = new THREE.Shape(), s = o.span / 2;
  const pts = o.wing ?? [[R * 0.7, 0.58 * L], [s, 0.12 * L], [s, 0.08 * L], [R * 0.7, 0.04 * L]];
  wing.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) wing.lineTo(p[0], p[1]); wing.closePath();
  const wg = new THREE.ExtrudeGeometry(wing, { depth: L * 0.012, bevelEnabled: false }); wg.translate(0, 0, -L * 0.006 - R * 0.3);
  g.add(mesh(wg, col)); const wl = new THREE.Mesh(wg.clone().scale(-1, 1, 1), mat(col)); g.add(wl);
  if (o.tail !== false) {
    const t = new THREE.Shape(); t.moveTo(0.78 * L, 0); t.lineTo(0.9 * L, R * 3.2); t.lineTo(0.93 * L, R * 3.2); t.lineTo(0.95 * L, 0); t.closePath();
    const tg = new THREE.ExtrudeGeometry(t, { depth: L * 0.01, bevelEnabled: false }); tg.translate(0, 0, -L * 0.005);
    tg.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    tg.translate(0, -L * 0.77 + L * 0.01 + 0 * L, R * 0.85); g.add(mesh(tg, col));
  }
  if (o.engines) for (let i = 0; i < o.engines; i++) { const e = seg({ t: 'bell', l: R * 0.7, r: R * 0.18, r2: R * 0.34, c: C.dark }); const a = o.engines === 1 ? 0 : (i / o.engines) * Math.PI * 2; e.position.set(o.engines === 1 ? 0 : Math.cos(a) * R * 0.4, -R * 0.2, o.engines === 1 ? 0 : Math.sin(a) * R * 0.4 + R * 0.1); g.add(e); }
  g.userData.fitAxis = 'y'; return g;
}

/* ---- crew capsules and service modules ---- */
function capsule(o) {
  const g = new THREE.Group(); let y = 0;
  for (const s of o.parts) { const m = seg(s); m.position.y = y; g.add(m); y += s.l; }
  if (o.panels) for (const p of o.panels) { const m = mesh(new THREE.BoxGeometry(p.w, p.l, p.l * 0.02), C.panel, { metal: 0.4, rough: 0.35 }); m.position.set(p.x ?? 0, p.y, p.z ?? 0); g.add(m); }
  if (o.panelsXZ) for (let i = 0; i < o.panelsXZ.n; i++) { const a = i / o.panelsXZ.n * Math.PI * 2; const m = mesh(new THREE.BoxGeometry(o.panelsXZ.l, o.panelsXZ.w * 0.04, o.panelsXZ.w), C.panel, { metal: 0.4, rough: 0.35 }); m.position.set(Math.cos(a) * (o.panelsXZ.off + o.panelsXZ.l / 2), o.panelsXZ.y, Math.sin(a) * (o.panelsXZ.off + o.panelsXZ.l / 2)); m.rotation.y = -a; g.add(m); }
  if (o.extra) o.extra(g);
  g.userData.fitAxis = 'y'; return g;
}

function lander(o) {
  const g = new THREE.Group(), r = o.r ?? 1.2, h = o.h ?? 1;
  { const hull = mesh(new THREE.CylinderGeometry(r * 0.9, r, h, o.sides ?? 8), o.c ?? C.gold, { metal: 0.5, rough: 0.35 }); hull.position.set(0, h * 0.5 + (o.legH ?? r), 0); g.add(hull); }   // (was Object.assign(..., { position }), which throws: Object3D.position is read-only)
  if (o.top) { const t = mesh(new THREE.CylinderGeometry(o.top.r, o.top.r * 1.05, o.top.h, o.top.sides ?? 6), o.top.c ?? C.grey, { metal: 0.4, rough: 0.4 }); t.position.y = (o.legH ?? r) + h + o.top.h / 2; g.add(t); }
  const n = o.legs ?? 4, lh = o.legH ?? r;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / n, leg = mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.03, lh * 1.6, 6), C.dark); leg.position.set(Math.cos(a) * r * 1.35, lh * 0.5, Math.sin(a) * r * 1.35); leg.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55); g.add(leg);
    const pad = mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.12, r * 0.03, 12), C.dark); pad.position.set(Math.cos(a) * r * 1.65, r * 0.015, Math.sin(a) * r * 1.65); g.add(pad); }
  g.userData.fitAxis = 'y'; return g;
}

function rover(o) {
  const g = new THREE.Group(), w = o.w ?? 2.7, l = o.l ?? 3, wr = o.wr ?? 0.26;
  const body = mesh(new THREE.BoxGeometry(w * 0.6, w * 0.22, l * 0.7), o.c ?? C.off); body.position.y = wr + w * 0.2; g.add(body);
  const mast = mesh(new THREE.CylinderGeometry(w * 0.015, w * 0.015, w * 0.55, 8), C.dark); mast.position.set(w * 0.18, wr + w * 0.5, -l * 0.25); g.add(mast);
  const head = mesh(new THREE.BoxGeometry(w * 0.16, w * 0.1, w * 0.08), C.dark); head.position.set(w * 0.18, wr + w * 0.78, -l * 0.25); g.add(head);
  for (let i = 0; i < 6; i++) { const wh = mesh(new THREE.CylinderGeometry(wr, wr, w * 0.1, 18), C.dark); wh.rotation.z = Math.PI / 2; wh.position.set((i % 2 ? 1 : -1) * w * 0.5, wr, (Math.floor(i / 2) - 1) * l * 0.38); g.add(wh); }
  if (o.arm) { const a = mesh(new THREE.CylinderGeometry(w * 0.02, w * 0.02, w * 0.7, 8), C.grey); a.rotation.x = Math.PI / 2; a.position.set(-w * 0.1, wr + w * 0.15, l * 0.55); g.add(a); }
  g.userData.fitAxis = null; return g;
}

function probe(o) {
  const g = new THREE.Group(), s = o.s ?? 1, bus = o.bus ?? [s, s * 0.8, s];
  const b = o.round ? mesh(new THREE.CylinderGeometry(bus[0] / 2, bus[0] / 2, bus[1], o.round), o.busC ?? C.gold, { metal: 0.5, rough: 0.35 }) : mesh(new THREE.BoxGeometry(bus[0], bus[1], bus[2]), o.busC ?? C.gold, { metal: 0.5, rough: 0.35 });
  g.add(b);
  if (o.dish) { const r = o.dish, Rs = r * 1.2, ang = Math.asin(r / Rs), d = mesh(new THREE.SphereGeometry(Rs, 36, 10, 0, Math.PI * 2, Math.PI - ang, ang), C.off); d.position.y = bus[1] / 2 + Rs * Math.cos(ang) + r * 0.05; g.add(d); }
  for (const p of o.panels ?? []) { const side = p.side ?? 1, m = mesh(new THREE.BoxGeometry(p.l, p.t ?? p.w * 0.02, p.w), C.panel, { metal: 0.4, rough: 0.35 }); m.position.set(side * (bus[0] / 2 + p.l / 2 + (p.gap ?? 0)), p.y ?? 0, p.z ?? 0); g.add(m); }
  for (const bm of o.booms ?? []) { const m = mesh(new THREE.CylinderGeometry(bm.r ?? Math.max(s * 0.03, 0.05), bm.r ?? Math.max(s * 0.03, 0.05), bm.l, 8), C.grey); const dir = new THREE.Vector3(...bm.dir).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.position.copy(dir.clone().multiplyScalar(bm.l / 2 + (bm.from ?? bus[0] / 2))); g.add(m);
    if (bm.tip) { const t = mesh(new THREE.BoxGeometry(bm.tip, bm.tip, bm.tip), C.dark); t.position.copy(dir.clone().multiplyScalar(bm.l + (bm.from ?? bus[0] / 2))); g.add(t); } }
  for (const a of o.antennas ?? []) { const m = mesh(new THREE.CylinderGeometry(a.r ?? 0.004, a.r ?? 0.004, a.l, 6), C.steel); const dir = new THREE.Vector3(...a.dir).normalize(); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); m.position.copy(dir.clone().multiplyScalar(a.l / 2)); g.add(m); }
  g.userData.fitAxis = null; return g;
}

function station(o) {
  const g = new THREE.Group(), L = o.truss ?? 100, r = o.r ?? 2;
  const tr = mesh(new THREE.BoxGeometry(L, 1.6, 1.6), C.steel, { metal: 0.4 }); g.add(tr);
  for (let i = 0; i < (o.modules ?? 6); i++) { const m = mesh(new THREE.CylinderGeometry(r, r, o.modLen ?? 12, 24), i % 2 ? C.off : C.white); m.rotation.z = Math.PI / 2; m.rotation.y = 0; m.position.set(-(o.modules - 1) * (o.modLen ?? 12) / 2 + i * (o.modLen ?? 12) - 0, 0, 0); m.rotation.set(0, 0, Math.PI / 2); m.position.z = o.stagger ? (i % 2 ? 6 : -6) : 0; g.add(m); }
  for (let i = 0; i < (o.arrays ?? 4); i++) { const x = (i / ((o.arrays ?? 4) - 1) - 0.5) * L * 0.92; for (const s of [-1, 1]) { const m = mesh(new THREE.BoxGeometry(o.panelW ?? 12, 0.15, o.panelL ?? 35), C.panel, { metal: 0.4, rough: 0.35 }); m.position.set(x, 0, s * ((o.panelL ?? 35) / 2 + 1.5)); g.add(m); } }
  g.userData.fitAxis = 'x'; return g;
}

/* ---- specs for named vehicles ---- */
const bands = (r, l, n, c1, c2, st = 0) => Array.from({ length: n }, (_, i) => ({ t: 'cyl', l: l / n, r, c: i % 2 ? c2 : c1, st }));
const SRB = (r, l, nose, c = C.white) => [{ t: 'cyl', l, r, c }, { t: 'ogive', l: nose, r, c }];

export const SPECS = {
  'v-2': () => rocket(stack([{ t: 'cyl', l: 3.6, r: 0.82, c: C.black }, { t: 'cyl', l: 4.2, r: 0.82, c: C.white }, { t: 'cone', l: 2.6, r: 0.82, r2: 0.82, c: C.black }, { t: 'ogive', l: 3.6, r: 0.82, c: C.white }], { engines: { n: 1, r: 0.55, l: 1.2 }, fins: { n: 4, span: 1.7, chord: 2.8, sweep: 0.5, y: 3.0, r: 0.8 } })),
  'saturn-v': () => rocket(stack([...bands(5.05, 42.1, 6, C.white, C.black), { t: 'cone', l: 2.6, r: 5.05, r2: 5.05, c: C.white, st: 1 }, { t: 'cyl', l: 24.9, r: 5.05, c: C.white, st: 1 }, { t: 'cone', l: 3.3, r: 5.05, r2: 3.3, c: C.white, st: 2 }, { t: 'cyl', l: 17.8, r: 3.3, c: C.white, st: 2 }, { t: 'cyl', l: 0.9, r: 3.3, c: C.black, st: 3 }, { t: 'cone', l: 8.5, r: 3.3, r2: 1.95, c: C.white, st: 3 }, { t: 'cyl', l: 7.5, r: 1.95, c: C.white, st: 4 }, { t: 'cone', l: 3.5, r: 1.95, r2: 0.5, c: C.off, st: 4 }, { t: 'cyl', l: 4.5, r: 0.45, c: C.white, st: 5 }, { t: 'cone', l: 2.2, r: 0.45, r2: 0, c: C.white, st: 5 }].map((s, i) => (i < 6 ? { ...s, st: 0 } : s)), { engines: { n: 5, r: 1.3, l: 3.2 }, fins: { n: 4, span: 3.6, chord: 8, sweep: 1, y: 8.5, r: 5.0, c: C.black } })),
  'space-shuttle-stack': () => {
    const ET = 4.2, rk = rocket(stack([{ t: 'cyl', l: 40.9, r: ET, c: C.orange }, { t: 'ogive', l: 6.0, r: ET, c: C.orange }], { boosters: { n: 2, off: ET + 1.85, start: Math.PI / 2, segs: SRB(1.85, 41.5, 4.0), c: C.white }, engines: { n: 3, r: 1.2, l: 2.6, st: 0 } }));
    const o = plane({ len: 37.2, span: 23.8, r: 2.6, c: C.white, engines: 3 }); o.position.set(0, 4.5, ET + 2.8); o.userData.orbiter = true; rk.add(o); return rk;
  },
  'falcon-9-block-5': () => rocket(stack([{ t: 'cyl', l: 41.2, r: 1.83, c: C.white, st: 0 }, { t: 'cyl', l: 1.4, r: 1.83, c: C.black, st: 1 }, { t: 'cyl', l: 12.2, r: 1.83, c: C.white, st: 1 }, { t: 'cyl', l: 0.6, r: 1.83, r2: 2.6, c: C.white, st: 2 }, { t: 'cyl', l: 6.4, r: 2.6, c: C.white, st: 2 }, { t: 'ogive', l: 7.4, r: 2.6, c: C.white, st: 2 }], { engines: { n: 9, r: 0.34, l: 0.9 }, fins: { n: 4, span: 1.4, chord: 1.6, y: 40, r: 1.83, c: C.black } })),
  'falcon-heavy': () => rocket(stack([{ t: 'cyl', l: 41.2, r: 1.83, c: C.white, st: 0 }, { t: 'cyl', l: 1.4, r: 1.83, c: C.black, st: 1 }, { t: 'cyl', l: 12.2, r: 1.83, c: C.white, st: 1 }, { t: 'cyl', l: 0.6, r: 1.83, r2: 2.6, c: C.white, st: 2 }, { t: 'cyl', l: 6.4, r: 2.6, c: C.white, st: 2 }, { t: 'ogive', l: 7.4, r: 2.6, c: C.white, st: 2 }], { boosters: { n: 2, off: 3.9, segs: [{ t: 'cyl', l: 41.2, r: 1.83 }, { t: 'ogive', l: 5, r: 1.83 }] }, engines: { n: 9, r: 0.34, l: 0.9 } })),
  starship: () => rocket(stack([{ t: 'cyl', l: 71, r: 4.5, c: C.steel, st: 0, mat: { metal: 0.8, rough: 0.3 } }, { t: 'cyl', l: 2.4, r: 4.5, c: C.black, st: 1 }, { t: 'cyl', l: 38.6, r: 4.5, c: C.steel, st: 1, mat: { metal: 0.8, rough: 0.3 } }, { t: 'ogive', l: 9.0, r: 4.5, c: C.steel, st: 1, mat: { metal: 0.8, rough: 0.3 } }], { engines: { n: 33, r: 0.55, l: 1.2 }, fins: { n: 4, span: 5.5, chord: 6, y: 74, r: 4.5, c: C.black, start: Math.PI / 4 } })),
  'sls-block-1': () => rocket(stack([{ t: 'cyl', l: 64.6, r: 4.2, c: C.orange, st: 0 }, { t: 'cone', l: 4, r: 4.2, r2: 2.5, c: C.white, st: 1 }, { t: 'cyl', l: 13.7, r: 2.5, c: C.white, st: 1 }, { t: 'cone', l: 2.5, r: 2.5, r2: 1.5, c: C.off, st: 2 }, { t: 'cyl', l: 4.9, r: 2.5, r2: 2.5, c: C.off, st: 2 }, { t: 'cone', l: 3.3, r: 2.5, r2: 0.5, c: C.white, st: 3 }, { t: 'cyl', l: 6, r: 0.4, c: C.white, st: 4 }, { t: 'cone', l: 2, r: 0.4, r2: 0, c: C.white, st: 4 }], { boosters: { n: 2, off: 6.0, start: 0, segs: SRB(1.85, 49.0, 5.0) }, engines: { n: 4, r: 0.9, l: 2.4 } })),
  'soyuz-2-1a': () => rocket(stack([{ t: 'cyl', l: 27.1, r: 1.5, c: C.off, st: 0 }, { t: 'cyl', l: 6.7, r: 1.2, c: C.white, st: 1 }, { t: 'cone', l: 1.8, r: 1.2, r2: 1.65, c: C.white, st: 2 }, { t: 'cyl', l: 4.7, r: 1.65, c: C.white, st: 2 }, { t: 'ogive', l: 5.2, r: 1.65, c: C.white, st: 2 }], { boosters: { n: 4, off: 2.0, start: Math.PI / 4, segs: [{ t: 'cyl', l: 17.6, r: 1.0 }, { t: 'cone', l: 2.8, r: 1.0, r2: 0.1 }], c: C.off }, engines: { n: 1, r: 0.9, l: 1.2 } })),
  'atlas-v': () => rocket(stack([{ t: 'cyl', l: 32.5, r: 1.9, c: C.white, st: 0 }, { t: 'cyl', l: 12.7, r: 1.52, c: C.off, st: 1 }, { t: 'cone', l: 1.2, r: 1.52, r2: 2.7, c: C.white, st: 2 }, { t: 'cyl', l: 7.5, r: 2.7, c: C.white, st: 2 }, { t: 'ogive', l: 5.4, r: 2.7, c: C.white, st: 2 }], { boosters: { n: 5, off: 2.7, start: 0.6, y: 5.5, segs: [{ t: 'cyl', l: 17.3, r: 0.78, c: C.off }, { t: 'cone', l: 1.5, r: 0.78, r2: 0.1 }] }, engines: { n: 1, r: 0.8, l: 1.4 } })),
  'delta-iv-heavy': () => rocket(stack([{ t: 'cyl', l: 40.8, r: 2.5, c: C.tan, st: 0 }, { t: 'cyl', l: 12.2, r: 2.5, c: C.white, st: 1 }, { t: 'cyl', l: 8.5, r: 2.5, c: C.white, st: 2 }, { t: 'ogive', l: 7, r: 2.5, c: C.white, st: 2 }], { boosters: { n: 2, off: 5.0, segs: [{ t: 'cyl', l: 40.8, r: 2.5, c: C.tan }, { t: 'cone', l: 4, r: 2.5, r2: 0.1, c: C.tan }] }, engines: { n: 1, r: 1.2, l: 1.8 } })),
  'ariane-5': () => rocket(stack([{ t: 'cyl', l: 28.8, r: 2.7, c: C.off, st: 0 }, { t: 'cyl', l: 4.8, r: 2.7, r2: 2.7, c: C.white, st: 1 }, { t: 'cyl', l: 7.0, r: 2.7, c: C.white, st: 2 }, { t: 'ogive', l: 9.9, r: 2.7, c: C.white, st: 2 }], { boosters: { n: 2, off: 4.2, segs: SRB(1.5, 27.5, 3.5), c: C.white }, engines: { n: 1, r: 1.0, l: 2.0 } })),
  'long-march-5': () => rocket(stack([{ t: 'cyl', l: 33.2, r: 2.5, c: C.white, st: 0 }, { t: 'cyl', l: 10.5, r: 2.5, c: C.white, st: 1 }, { t: 'cyl', l: 0.5, r: 2.5, r2: 2.6, c: C.white, st: 2 }, { t: 'cyl', l: 6.5, r: 2.6, c: C.white, st: 2 }, { t: 'ogive', l: 6.3, r: 2.6, c: C.white, st: 2 }], { boosters: { n: 4, off: 4.15, start: Math.PI / 4, segs: [{ t: 'cyl', l: 25, r: 1.675, c: C.white }, { t: 'cone', l: 3.2, r: 1.675, r2: 0.15 }] }, engines: { n: 2, r: 0.8, l: 1.8 } })),
  'new-glenn': () => rocket(stack([{ t: 'cyl', l: 57.5, r: 3.5, c: C.white, st: 0 }, { t: 'cyl', l: 1.3, r: 3.5, c: C.black, st: 1 }, { t: 'cyl', l: 17.5, r: 3.5, c: C.white, st: 1 }, { t: 'cyl', l: 8.0, r: 3.5, c: C.blue, st: 2 }, { t: 'ogive', l: 13.7, r: 3.5, c: C.blue, st: 2 }], { engines: { n: 7, r: 0.8, l: 1.8 }, fins: { n: 4, span: 3, chord: 3.5, y: 53, r: 3.5, c: C.black } })),
  'proton-m': () => rocket(stack([{ t: 'cyl', l: 21.2, r: 1.95, c: C.off, st: 0 }, { t: 'cyl', l: 14.0, r: 2.05, c: C.off, st: 1 }, { t: 'cyl', l: 6.5, r: 2.05, c: C.off, st: 2 }, { t: 'cone', l: 3, r: 2.05, r2: 2.0, c: C.white, st: 2 }, { t: 'cyl', l: 4.5, r: 2.0, c: C.white, st: 2 }, { t: 'ogive', l: 6, r: 2.0, c: C.white, st: 2 }], { boosters: { n: 6, off: 2.6, segs: [{ t: 'cyl', l: 21, r: 0.75, c: C.off }, { t: 'cone', l: 1.5, r: 0.75, r2: 0.1 }] }, engines: { n: 6, r: 0.4, l: 1.0 } })),
  n1: () => rocket(stack([{ t: 'cone', l: 30.1, r: 8.5, r2: 5.5, c: C.white, st: 0 }, { t: 'cone', l: 20.5, r: 5.5, r2: 3.9, c: C.white, st: 1 }, { t: 'cone', l: 11.5, r: 3.9, r2: 2.4, c: C.white, st: 2 }, { t: 'cone', l: 7.5, r: 2.4, r2: 2.4, c: C.white, st: 3 }, { t: 'cone', l: 3, r: 2.4, r2: 0.6, c: C.off, st: 3 }, { t: 'cyl', l: 6, r: 0.55, c: C.white, st: 4 }, { t: 'cone', l: 2, r: 0.55, r2: 0, c: C.white, st: 4 }], { engines: { n: 30, r: 0.42, l: 1.0 } })),
  energia: () => rocket(stack([{ t: 'cyl', l: 58.8, r: 4.0, c: C.orange, st: 0 }], { boosters: { n: 4, off: 5.6, segs: [{ t: 'cyl', l: 38, r: 1.95, c: C.white }, { t: 'cone', l: 3.5, r: 1.95, r2: 0.2 }] }, engines: { n: 4, r: 0.9, l: 1.8 } })),
  'saturn-ib': () => rocket(stack([...bands(3.26, 25.0, 4, C.white, C.black), { t: 'cone', l: 2, r: 3.26, r2: 3.26, c: C.white, st: 0 }, { t: 'cyl', l: 17.8, r: 3.3, c: C.white, st: 1 }, { t: 'cyl', l: 0.9, r: 3.3, c: C.black, st: 2 }, { t: 'cone', l: 8.5, r: 3.3, r2: 1.95, c: C.white, st: 2 }, { t: 'cyl', l: 7.5, r: 1.95, c: C.white, st: 3 }, { t: 'cone', l: 3.5, r: 1.95, r2: 0.5, c: C.off, st: 3 }, { t: 'cyl', l: 4.5, r: 0.45, c: C.white, st: 4 }, { t: 'cone', l: 2.2, r: 0.45, r2: 0, c: C.white, st: 4 }], { engines: { n: 8, r: 0.5, l: 1.4 }, fins: { n: 8, span: 2.4, chord: 5, y: 5, r: 3.2, c: C.black } })),
  redstone: () => rocket(stack([{ t: 'cyl', l: 12.0, r: 0.89, c: C.white, st: 0 }, { t: 'cyl', l: 3.6, r: 0.89, c: C.black, st: 0 }, { t: 'cone', l: 1.4, r: 0.89, r2: 0.66, c: C.white, st: 1 }, { t: 'cyl', l: 1.0, r: 0.66, c: C.white, st: 1 }, { t: 'cone', l: 1.5, r: 0.66, r2: 0.3, c: C.white, st: 1 }, { t: 'cyl', l: 2.5, r: 0.3, c: C.white, st: 2 }, { t: 'cone', l: 1.5, r: 0.3, r2: 0, c: C.white, st: 2 }], { engines: { n: 1, r: 0.45, l: 1.0 }, fins: { n: 4, span: 1.4, chord: 2.4, y: 2.6, r: 0.88, c: C.black } })),
  electron: () => rocket(stack([{ t: 'cyl', l: 12.1, r: 0.6, c: C.black, st: 0 }, { t: 'cyl', l: 2.2, r: 0.6, c: C.black, st: 1 }, { t: 'cyl', l: 2.2, r: 0.6, c: C.black, st: 2 }, { t: 'ogive', l: 1.5, r: 0.6, c: C.black, st: 2 }], { engines: { n: 9, r: 0.1, l: 0.3 } })),

  /* spacecraft */
  'apollo-csm': () => capsule({ parts: [{ t: 'bell', l: 2.8, r: 0.45, r2: 1.1, c: C.dark }, { t: 'cyl', l: 7.5, r: 1.95, c: C.white }, { t: 'cone', l: 3.2, r: 1.95, r2: 0.5, c: C.off }, { t: 'dome', l: 0.35, r: 0.5, c: C.off }] }),
  'apollo-lm': () => lander({ r: 2.2, h: 1.65, sides: 8, legH: 2.3, c: C.gold, legs: 4, top: { r: 1.4, h: 2.7, sides: 6, c: C.cream } }),
  'mercury-capsule': () => capsule({ parts: [{ t: 'cone', l: 0.55, r: 0.95, r2: 0.95, c: C.black }, { t: 'cone', l: 1.8, r: 0.95, r2: 0.33, c: C.grey, mat: { metal: 0.7, rough: 0.3 } }, { t: 'cyl', l: 0.8, r: 0.33, c: C.grey }] }),
  gemini: () => capsule({ parts: [{ t: 'cyl', l: 2.3, r: 1.52, r2: 1.52, c: C.white }, { t: 'cone', l: 3.2, r: 1.52, r2: 0.45, c: C.white }] }),
  'vostok-3ka': () => capsule({ parts: [{ t: 'bell', l: 1.6, r: 0.4, r2: 1.0, c: C.dark }, { t: 'cyl', l: 2.25, r: 1.2, c: C.off }, { t: 'dome', l: 1.15, r: 1.15, c: C.grey }] }),
  'soyuz-ms': () => capsule({ parts: [{ t: 'bell', l: 0.5, r: 0.3, r2: 0.5, c: C.dark }, { t: 'cyl', l: 2.3, r: 1.1, c: C.gold }, { t: 'cyl', l: 0.5, r: 1.1, r2: 1.1, c: C.off }, { t: 'cone', l: 1.9, r: 1.1, r2: 0.7, c: C.off }, { t: 'dome', l: 1.0, r: 1.1, c: C.white }, { t: 'cyl', l: 0.3, r: 0.4, c: C.dark }], panels: [{ w: 4.2, l: 2.1, y: 1.3, x: -3.4 }, { w: 4.2, l: 2.1, y: 1.3, x: 3.4 }] }),
  'crew-dragon': () => capsule({ parts: [{ t: 'cyl', l: 3.6, r: 2.0, c: C.white, mat: { metal: 0.3 } }, { t: 'cone', l: 4.2, r: 2.0, r2: 0.9, c: C.white }, { t: 'dome', l: 0.5, r: 0.9, c: C.black }], panelsXZ: { n: 2, off: 2.0, l: 4.5, w: 1.1, y: 0.9 } }),
  'orion-mpcv': () => capsule({ parts: [{ t: 'bell', l: 1.2, r: 0.5, r2: 1.1, c: C.dark }, { t: 'cyl', l: 4.0, r: 2.0, c: C.off }, { t: 'cone', l: 3.3, r: 2.5, r2: 0.9, c: C.white }, { t: 'dome', l: 0.5, r: 0.9, c: C.white }], panelsXZ: { n: 4, off: 2.0, l: 7.4, w: 2.0, y: 1.5 } }),
  starliner: () => capsule({ parts: [{ t: 'cyl', l: 2.5, r: 2.2, c: C.white }, { t: 'cone', l: 3.0, r: 2.28, r2: 1.2, c: C.white }, { t: 'dome', l: 0.6, r: 1.2, c: C.blue }] }),
  shenzhou: () => capsule({ parts: [{ t: 'bell', l: 0.5, r: 0.4, r2: 0.7, c: C.dark }, { t: 'cyl', l: 2.9, r: 1.4, c: C.off }, { t: 'cone', l: 2.5, r: 1.4, r2: 0.9, c: C.white }, { t: 'cyl', l: 2.5, r: 1.1, c: C.gold }, { t: 'dome', l: 0.9, r: 1.1, c: C.white }], panels: [{ w: 7, l: 2.2, y: 1.5, x: -5.0 }, { w: 7, l: 2.2, y: 1.5, x: 5.0 }] }),

  /* planes */
  'space-shuttle-orbiter': () => plane({ len: 37.2, span: 23.8, r: 2.6, c: C.white, engines: 3 }),
  buran: () => plane({ len: 36.4, span: 23.9, r: 2.6, c: C.white, engines: 0 }),
  'x-15': () => plane({ len: 15.45, span: 6.8, r: 0.7, c: C.black, wing: [[0.5, 0.6 * 15.45 * 0.6], [3.4, 0.2 * 15.45], [3.4, 0.1 * 15.45], [0.5, 0.07 * 15.45]], engines: 1 }),
  spaceshipone: () => plane({ len: 8.5, span: 5.0, r: 0.8, c: C.white, wing: [[0.8, 5.5], [2.5, 1.5], [2.5, 0.6], [0.8, 0.3]], engines: 1 }),
  'x-37b': () => plane({ len: 8.9, span: 4.5, r: 0.55, c: C.white, engines: 1 }),
  'dream-chaser': () => plane({ len: 9.0, span: 7.0, r: 1.1, c: C.white, engines: 0 }),

  /* probes, observatories, stations, rovers */
  'sputnik-1': () => probe({ s: 0.58, round: 1, bus: [0.58, 0.58, 0.58], busC: C.steel, antennas: [{ l: 2.9, dir: [1, 0.4, 0] }, { l: 2.9, dir: [-1, 0.4, 0] }, { l: 2.4, dir: [0, 0.4, 1] }, { l: 2.4, dir: [0, 0.4, -1] }] }),
  'voyager-1': () => voyager(), 'voyager-2': () => voyager(),
  hubble: () => capsule({ parts: [{ t: 'cyl', l: 4.2, r: 2.1, c: C.steel, mat: { metal: 0.6 } }, { t: 'cyl', l: 8.0, r: 2.1, c: C.white }, { t: 'cyl', l: 1.0, r: 2.1, c: C.off }], panels: [{ w: 7.6, l: 2.6, y: 6, x: -4.9, z: 0 }, { w: 7.6, l: 2.6, y: 6, x: 4.9 }] }),
  iss: () => station({ truss: 109, modules: 7, modLen: 11, r: 2.2, arrays: 4, panelW: 11.5, panelL: 34, stagger: true }),
  tiangong: () => station({ truss: 37, modules: 3, modLen: 17.9, r: 2.1, arrays: 2, panelW: 8, panelL: 28, stagger: false }),
  perseverance: () => rover({ w: 2.7, l: 3.0, wr: 0.26, arm: true }),
  curiosity: () => rover({ w: 2.8, l: 3.0, wr: 0.25, arm: true }),
  'spirit-mer-a': () => rover({ w: 2.3, l: 1.6, wr: 0.13, c: C.gold }),
  'opportunity-mer-b': () => rover({ w: 2.3, l: 1.6, wr: 0.13, c: C.gold }),

  /* the eight Centauri classes: the measured assembly, at true size (see parts/fleet.js) */
  'centauri-wafer': () => buildCentauriModel('wafer'),
  'centauri-smallsat': () => buildCentauriModel('smallsat'),
  'centauri-instrument': () => buildCentauriModel('instrument'),
  'centauri-lander': () => buildCentauriModel('lander'),
  'centauri-capsule': () => buildCentauriModel('capsule'),
  'centauri-habitat': () => buildCentauriModel('habitat'),
  'centauri-seed': () => buildCentauriModel('seed'),
  'centauri-colony': () => buildCentauriModel('colony'),
  /* v2: the crewed classes with a 1 g spin ring (see CENTAURI-VERSIONS.md) */
  'centauri-habitat-spin': () => buildCentauriModel('habitat-spin'),
  'centauri-seed-spin': () => buildCentauriModel('seed-spin'),
  'centauri-colony-spin': () => buildCentauriModel('colony-spin'),
  /* v3: the same hulls flown by their own engines (see CENTAURI-PROPULSION.md) */
  'centauri-wafer-pellet': () => buildCentauriModel('wafer-pellet'),
  'centauri-smallsat-pellet': () => buildCentauriModel('smallsat-pellet'),
  'centauri-instrument-ion': () => buildCentauriModel('instrument-ion'),
  'centauri-lander-ntr': () => buildCentauriModel('lander-ntr'),
  'centauri-capsule-orion': () => buildCentauriModel('capsule-orion'),
  'centauri-habitat-dfd': () => buildCentauriModel('habitat-dfd'),
  'centauri-seed-daedalus': () => buildCentauriModel('seed-daedalus'),
  'centauri-colony-pulse': () => buildCentauriModel('colony-pulse'),
};

function voyager() {
  return probe({ s: 1.78, round: 10, bus: [1.78, 0.47, 1.78], busC: C.gold, dish: 1.85, booms: [{ l: 13, dir: [-1, 0, 0], tip: 0.2 }, { l: 3.5, dir: [1, 0, 0.0], tip: 0.5 }, { l: 2.5, dir: [0, -0.3, -1], tip: 0.5 }], antennas: [{ l: 10, dir: [0, 0.1, 1], r: 0.015 }] });
}

/* ---- generic builders, from catalogue dimensions ---- */
const ACCENT = [[/USSR|Russia/, C.green], [/China/, C.red], [/Europe|France/, C.blue], [/Japan/, C.red], [/India/, 0xe09a2b], [/USA/, C.blue]];
const accent = country => { const s = Array.isArray(country) ? country.join(' ') : country || ''; for (const [re, c] of ACCENT) if (re.test(s)) return c; return C.grey; };

function genericRocket(v) {
  const H = v.height_m || 20, D = v.diameter_m && v.diameter_m < H ? v.diameter_m : Math.max(H / 11, 0.4), r = D / 2;
  const n = Math.max(1, Math.min(3, v.stages?.length || 2)), w = n === 1 ? [1] : n === 2 ? [0.72, 0.28] : [0.5, 0.3, 0.2];
  const noseL = Math.min(H * 0.14, r * 4.5), body = H - noseL, parts = [];
  w.forEach((f, i) => { parts.push({ t: 'cyl', l: body * f * 0.97, r, c: i % 2 ? C.off : C.white, st: i }); if (i < n - 1) parts.push({ t: 'cyl', l: body * f * 0.03, r, c: accent(v.country), st: i }); });
  parts.push({ t: 'ogive', l: noseL, r, c: C.white, st: n - 1 });
  return rocket({ core: parts, engines: { n: r > 2 ? 5 : r > 0.8 ? 3 : 1, r: r * 0.28, l: r * 0.5 }, fins: v.orbital === false ? { n: 4, span: r * 1.6, chord: H * 0.14, y: H * 0.14, r } : undefined });
}
function genericCapsule(v) {
  const d = v.diameter_m || 3, r = d / 2, h = v.height_m || d * 1.6;
  return capsule({ parts: [{ t: 'cyl', l: h * 0.4, r, c: C.off }, { t: 'cone', l: h * 0.45, r, r2: r * 0.3, c: C.white }, { t: 'dome', l: h * 0.15, r: r * 0.3, c: C.white }] });
}
function genericProbe(v) {
  const m = v.mass_kg || 500, s = 0.19 * Math.cbrt(m);
  return probe({ s, bus: [s, s * 0.8, s], dish: s * 0.55, panels: [{ l: s * 1.8, w: s * 0.9, side: 1 }, { l: s * 1.8, w: s * 0.9, side: -1 }] });
}
function genericStation(v) {
  const L = v.length_m || 30, n = Math.max(2, Math.min(6, Math.round(L / 12)));
  return station({ truss: L, modules: n, modLen: L / n * 0.9, r: Math.max(1.2, L / 20), arrays: 2, panelW: L * 0.12, panelL: L * 0.35 });
}
function placeholder(v) {
  const H = v.height_m || v.length_m || 5, r = Math.max(H * 0.08, 0.3);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, H * 0.8, 24).translate(0, H * 0.4, 0), 0x6f8fb8, { alpha: 0.35 }));
  const n = seg({ t: 'ogive', l: H * 0.2, r, c: 0x6f8fb8, mat: { alpha: 0.35 } }); n.position.y = H * 0.8; g.add(n);
  g.userData.fitAxis = 'y'; return g;
}

const PLANES = new Set(['spaceplane']);
function genericFor(v) {
  if (v.category === 'launch_vehicle' && v.height_m) return () => genericRocket(v);
  if (v.category === 'crewed_spacecraft') return () => genericCapsule(v);
  if (v.category === 'engine' && v.diameter_m) return () => { const g = new THREE.Group(), b = seg({ t: 'bell', l: v.height_m ?? v.diameter_m * 2.4, r: v.diameter_m * 0.12, r2: v.diameter_m / 2, c: C.dark }); g.add(b); g.userData.fitAxis = 'y'; return g; };   // procedural stand-in: a plain bell, nozzle down
  if (v.category === 'lander') return () => lander({ r: 1.3, h: 1.0 });
  if (v.category === 'uncrewed_spacecraft' && v.mass_kg) return () => genericProbe(v);
  if (v.category === 'space_station') return () => genericStation(v);
  if (PLANES.has(v.category) && v.length_m) return () => plane({ len: v.length_m, span: v.wingspan_m || v.length_m * 0.6 });
  if (v.category === 'experimental' && v.height_m && v.diameter_m) return () => genericRocket(v);
  return null;
}
export function tierOf(v) { return SPECS[v.id] ? 'detailed' : genericFor(v) ? 'generic' : 'placeholder'; }
let glbFor = null;   // optional: (catalogueId) => normalised real model or null (see vehicle-glb.js / models/spacex/manifest.json); set by the page after it has preloaded the files
export function useGlbModels(fn) { glbFor = fn; }
export function buildModel(v) {
  let tier = 'detailed', g = null, real = null;
  try { real = glbFor?.(v.id) ?? null; } catch { real = null; }
  if (real) { g = real; if (!('fitAxis' in g.userData)) g.userData.fitAxis = 'y'; }   // engines and `noFit` models set fitAxis = null: they are already scaled to their real size
  else g = SPECS[v.id]?.() ?? null;
  if (!g) { const f = genericFor(v); if (f) { tier = 'generic'; g = f(); } }
  if (!g) { tier = 'placeholder'; g = placeholder(v); }
  /* Fit to the catalogue's headline dimension so the scale is true even where the sketch is loose. */
  const target = v.height_m ?? v.length_m, axis = g.userData.fitAxis;
  if (target && axis) {
    const bb = new THREE.Box3().setFromObject(g), size = axis === 'x' ? bb.max.x - bb.min.x : bb.max.y - bb.min.y;
    if (size > 0) g.scale.multiplyScalar(target / size);
  }
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g); g.position.y -= bb.min.y;   // stand on the ground plane
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData = { tier, inner: g, box: new THREE.Box3().setFromObject(wrap), glb: real ? real.userData.id : null, label: g.userData?.label ?? null, setDeploy: g.userData?.setDeploy ?? null };
  return wrap;
}

/* A 1.8 m figure for scale. */
export function person() {
  const g = new THREE.Group(), c = 0xffb86b;
  g.add(Object.assign(mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.35, 12).translate(0, 0.68, 0), c), {}));
  const head = mesh(new THREE.SphereGeometry(0.13, 16, 12), c); head.position.y = 1.67; g.add(head);
  return g;
}
