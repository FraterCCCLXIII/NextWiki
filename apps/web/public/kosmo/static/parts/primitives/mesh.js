/* primitives/mesh.js -- the geometry side of the component library.

   Each builder takes a spec from primitives/spec.js (or the few numbers a spec would give) and returns
   a THREE.Group built in the part's own frame: +y along the part, base at y = 0 unless the spec says
   origin 'centre'. Surfaces come from primitives/materials.js. Repeated small pieces (truss members,
   windows, tiles, rivet rows, grid-fin lattice) are InstancedMeshes, so a 112 m ring with four
   hundred windows is a handful of draw calls.

   The builders know nothing about the fleet: parts/centauri-models.js composes them per part kind, and
   the shipyard can import them for its own stages. */

import * as THREE from 'three';
import { surface, repeatFor } from './materials.js';
import { ogiveProfile, haackProfile, domeProfile } from './spec.js';

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/* ---- primitives ---- */
export const put = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
export function cyl(r, h, kind, o = {}) {
  const g = new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg ?? 32, 1, !!o.open);
  g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, surface(kind, { repeat: o.repeat ?? repeatFor(2 * Math.PI * r, h, o.bay ?? 1.6) }));
}
export const box = (w, h, d, kind, o = {}) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), surface(kind, { repeat: o.repeat ?? [Math.max(1, Math.round(w / 1.6)), Math.max(1, Math.round(h / 1.6))] }));
export const tor = (R, tube, kind, o = {}) => new THREE.Mesh(new THREE.TorusGeometry(R, tube, o.rad ?? 12, o.tseg ?? 64), surface(kind, { repeat: o.repeat ?? [1, 1] }));
export const sph = (r, kind, o = {}) => new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 24, o.rseg ?? 16), surface(kind));
/** A lathe from a [[r, y], ...] profile (base to top). */
export function lathe(profile, kind, o = {}) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-6), y));
  const g = new THREE.LatheGeometry(pts, o.seg ?? 48);
  const h = profile[profile.length - 1][1] - profile[0][1], rMax = Math.max(...profile.map((p) => p[0]));
  return new THREE.Mesh(g, surface(kind, { repeat: o.repeat ?? repeatFor(2 * Math.PI * rMax, Math.abs(h), o.bay ?? 1.6) }));
}
/** A rod from a to b. */
export function rod(g, a, b, r, kind = 'grey', o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B) || 1e-6;
  const m = cyl(r, L, kind, { seg: o.seg ?? 8, repeat: [1, 1] });
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(Y, B.clone().sub(A).normalize());
  g.add(m);
  return m;
}
/** A ring lying in the xz plane at height y (hatch frames, end rings, bands). */
export function ringXZ(R, tube, kind = 'grey', y = 0, o = {}) {
  const m = tor(R, tube, kind, o);
  m.rotation.x = Math.PI / 2; m.position.y = y;
  return m;
}
/** Instance `geometry` at a list of { p: [x,y,z], q?: Quaternion, s?: [sx,sy,sz] }. One draw call. */
export function instances(geometry, kind, list) {
  const inst = new THREE.InstancedMesh(geometry, surface(kind), list.length);
  list.forEach((it, i) => {
    _p.fromArray(it.p); _q.copy(it.q ?? new THREE.Quaternion()); _s.fromArray(it.s ?? [1, 1, 1]);
    inst.setMatrixAt(i, _m.compose(_p, _q, _s));
  });
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/* ------------------------------------------------------------------ *
 * Bodies
 * ------------------------------------------------------------------ */

/** A tank from tankSpec: lathe of its profile, MLI bands, a feed line and a vent. */
export function tankMesh(spec, kind = 'tank') {
  const g = new THREE.Group(), r = spec.dims.d / 2, L = spec.dims.l;
  g.add(lathe(spec.profile, kind));
  const nb = Math.max(1, Math.min(6, Math.round(spec.barrelL / Math.max(r, 0.3))));
  for (let i = 1; i <= nb; i += 1) g.add(ringXZ(r * 1.004, Math.max(r * 0.02, 0.004), 'gold', spec.domeH + (spec.barrelL * i) / (nb + 1)));
  rod(g, [r * 1.02, spec.domeH * 0.5, 0], [r * 1.02, L - spec.domeH * 0.5, 0], Math.max(r * 0.015, 0.004), 'grey');
  g.add(put(cyl(Math.max(r * 0.06, 0.01), Math.max(r * 0.12, 0.02), 'dark', { seg: 10 }), 0, L, 0));
  return g;
}

/** A nose or fairing from fairingSpec (profile base to tip), optionally with a cap ring. */
export function fairingMesh(spec, kind = 'white') {
  const g = new THREE.Group();
  g.add(lathe(spec.profile, kind, { seg: 56 }));
  g.add(ringXZ(spec.dims.d / 2 * 0.995, Math.max(spec.dims.d * 0.008, 0.01), 'dark', 0.02));
  return g;
}

/**
 * A pressurised hull segment: barrel with end cones or domes in the chosen skin, end rings, MLI
 * bands, instanced window frames, external racks, handrails and a cable raceway. `o.windows` is a
 * count along the barrel; `o.racks` the number of external equipment racks.
 */
export function hullSegmentMesh({ d, l, endKind = 'cone', skin = 'white', windows = 2, racks = 4, hatchSide = false, raceway = true, bands = 3 }) {
  const g = new THREE.Group(), r = d / 2, endH = endKind === 'dome' ? r * 0.707 : Math.min(0.65, l * 0.1), barrelL = Math.max(0, l - 2 * endH);
  g.add(put(cyl(r, barrelL, skin, { seg: 48 }), 0, endH, 0));
  const endProfile = endKind === 'dome' ? domeProfile(r, endH, 10) : [[r, 0], [r * 0.55, endH]];
  const top = lathe(endProfile, skin, { seg: 48 }); top.position.y = l - endH; g.add(top);
  const bottom = lathe(endProfile, skin, { seg: 48 }); bottom.rotation.x = Math.PI; bottom.position.y = endH; g.add(bottom);
  g.add(ringXZ(r * 0.99, Math.max(r * 0.025, 0.02), 'grey', endH + 0.03), ringXZ(r * 0.99, Math.max(r * 0.025, 0.02), 'grey', l - endH - 0.03));
  for (let i = 1; i <= bands; i += 1) { const b = cyl(r * 1.012, barrelL * 0.035, 'mli', { seg: 48, open: true }); b.position.y = endH + (barrelL * i) / (bands + 1); g.add(b); }
  if (windows > 0) {
    const frame = new THREE.CylinderGeometry(r * 0.09, r * 0.09, r * 0.04, 18), glass = new THREE.CylinderGeometry(r * 0.07, r * 0.07, r * 0.02, 18);
    const fr = [], gl = [];
    for (let i = 0; i < windows; i += 1) {
      const a = Math.PI * 1.5 + (i - (windows - 1) / 2) * 0.35, y = endH + barrelL * 0.5 + (i % 2 ? r * 0.3 : -r * 0.3);
      const q = new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      fr.push({ p: [Math.cos(a) * r * 0.995, y, Math.sin(a) * r * 0.995], q }); gl.push({ p: [Math.cos(a) * r * 1.0, y, Math.sin(a) * r * 1.0], q });
    }
    g.add(instances(frame, 'dark', fr), instances(glass, 'glass', gl));
  }
  for (let i = 0; i < racks; i += 1) {
    const a = (i / racks) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    const rack = box(r * 0.3, barrelL * 0.45, r * 0.55, 'offwhite'); put(rack, x * (r + r * 0.15), l / 2, z * (r + r * 0.15), 0, -a, 0); g.add(rack);
    for (const y of [l * 0.35, l * 0.65]) rod(g, [x * r * 0.8, y, z * r * 0.8], [x * (r + r * 0.1), y, z * (r + r * 0.1)], r * 0.015, 'grey');
    const rail = rod(g, [x * r * 1.03, endH + barrelL * 0.15, z * r * 1.03], [x * r * 1.03, endH + barrelL * 0.85, z * r * 1.03], r * 0.012, 'gold'); rail.userData.handrail = true;
  }
  if (raceway) { const rw = box(r * 0.08, barrelL * 0.9, r * 0.05, 'dark'); put(rw, 0, l / 2, r * 1.01); g.add(rw); for (let i = 0; i < 5; i += 1) { const clamp = box(r * 0.12, barrelL * 0.02, r * 0.07, 'grey'); put(clamp, 0, endH + barrelL * (0.1 + 0.2 * i), r * 1.01); g.add(clamp); } }
  if (hatchSide) { const h = cyl(r * 0.28, r * 0.03, 'hatch', { seg: 24 }); put(h, -r * 0.98, l / 2, 0, 0, 0, Math.PI / 2); g.add(h); g.add(put(tor(r * 0.3, r * 0.02, 'grey'), -r * 0.98, l / 2, 0, 0, Math.PI / 2, 0)); }
  return g;
}

/** A torus deck from torusDeckSpec or ring numbers: shell (with an optional cutaway arc), instanced windows, spokes, hub. */
export function torusDeckMesh({ R, D, decks = 1, arc = Math.PI * 2 * (5 / 6), windows = null, spokes = 6, skin = 'white' }) {
  const g = new THREE.Group(), tube = D / 2;
  const shellFrame = new THREE.Group(); shellFrame.rotation.x = -Math.PI / 2;
  shellFrame.add(new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, Math.max(96, Math.round(R * 2)), arc), surface(skin, { repeat: [Math.max(4, Math.round(R / 2)), Math.max(2, Math.round(D / 2))] })));
  g.add(shellFrame);
  for (let i = 0; i < decks; i += 1) {
    const floor = new THREE.Mesh(new THREE.RingGeometry(R - tube * 0.82, R + tube * 0.82, 128, 1, 0, arc), surface(i % 2 ? 'cell' : 'radiator', { repeat: [8, 1] }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -tube + 1.8 + i * 3; g.add(floor);
  }
  const nW = windows ?? Math.max(24, Math.round(2 * Math.PI * R / 4));
  const win = new THREE.BoxGeometry(Math.min(tube * 0.5, 1.6), Math.min(tube * 0.25, 0.8), tube * 0.05);
  const list = [];
  for (let i = 0; i < nW; i += 1) {
    const a = (i / nW) * arc; if (a > arc) break;
    const q = new THREE.Quaternion().setFromAxisAngle(Y, -a);
    for (let k = 0; k < decks; k += 1) list.push({ p: [Math.cos(a) * (R + tube * 0.9), -tube + 1.8 + k * 3 + 0.9, Math.sin(a) * (R + tube * 0.9)], q });
  }
  g.add(instances(win, 'glass', list));
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2;
    rod(g, [Math.cos(a) * Math.max(tube * 0.9, 0.4), 0, Math.sin(a) * Math.max(tube * 0.9, 0.4)], [Math.cos(a) * R, 0, Math.sin(a) * R], Math.max(tube * 0.06, 0.08), 'white', { seg: 12 });
  }
  g.add(put(cyl(tube * 0.85, tube * 1.1, 'white', { seg: 32 }), 0, -tube * 0.55, 0));
  g.add(ringXZ(tube * 0.6, Math.max(tube * 0.03, 0.02), 'grey', tube * 0.55));
  return g;
}

/* ------------------------------------------------------------------ *
 * Trusses, booms
 * ------------------------------------------------------------------ */

/** A square lattice truss: four longerons, battens and diagonals as one instanced cylinder each. */
export function trussMesh({ lengthM, widthM, bays = null, kind = 'grey', section = 'square' }) {
  const g = new THREE.Group(), w = widthM / 2, n = bays ?? Math.max(1, Math.round(lengthM / Math.max(widthM, 0.05))), step = lengthM / n;
  const r = Math.max(widthM * 0.03, 0.004);
  const corners = section === 'tri' ? [0, 1, 2].map((k) => [Math.cos((k / 3) * Math.PI * 2) * w, Math.sin((k / 3) * Math.PI * 2) * w]) : [[-w, -w], [w, -w], [w, w], [-w, w]];
  const unit = new THREE.CylinderGeometry(1, 1, 1, 6); unit.translate(0, 0.5, 0);
  const seg = (a, b, rr) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length(); return { p: a, q: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), s: [rr, L, rr] }; };
  const longerons = corners.map(([x, z]) => seg([x, 0, z], [x, lengthM, z], r));
  const members = [];
  for (let i = 0; i <= n; i += 1) {
    const y = i * step;
    for (let k = 0; k < corners.length; k += 1) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % corners.length];
      members.push(seg([x0, y, z0], [x1, y, z1], r * 0.6));
      if (i < n) members.push(seg([x0, y, z0], [x1, y + step, z1], r * 0.45));
    }
  }
  g.add(instances(unit, kind, longerons), instances(unit, kind, members));
  return g;
}

/* ------------------------------------------------------------------ *
 * Deployables
 * ------------------------------------------------------------------ */

/** A pleated strip: `segments` rigid panels hinged end to end. setDeploy(k): 1 flat, 0 packed. */
export function accordionStrip(len, width, thick, segments, kind, angles) {
  const g = new THREE.Group(), segL = len / segments, pivots = [];
  let host = g;
  for (let i = 0; i < segments; i += 1) {
    const pivot = new THREE.Group(); pivot.position.set(0, i ? segL : 0, 0);
    const flap = new THREE.Group(); pivot.add(flap); host.add(pivot);
    const panel = box(width, segL, thick, kind, { repeat: [Math.max(1, Math.round(width / 1.2)), Math.max(1, Math.round(segL / 1.2))] }); panel.position.set(0, segL / 2, 0); flap.add(panel);
    for (let k = 1; k < 4; k += 1) { const rib = box(width * 0.97, thick * 1.8, thick * 2.6, 'grey'); rib.position.set(0, (segL * k) / 4, 0); flap.add(rib); }
    pivots.push(pivot); host = flap;
  }
  return { group: g, setDeploy: (k) => { const a = angles(k, segments); for (let i = 0; i < pivots.length; i += 1) pivots[i].rotation.x = a[i]; } };
}

/** A radiator wing: `panels` pleated strips side by side, a fluid-loop manifold and edge booms. */
export function radiatorMesh({ panelL, panelW, panels = 1, angles, thick = null }) {
  const g = new THREE.Group(), t = thick ?? Math.max(panelW * 0.012, 0.03), W = panelW * panels * 1.05;
  const manifold = box(W, Math.max(t * 4, 0.12), Math.max(t * 4, 0.12), 'grey'); put(manifold, 0, 0.15, 0); g.add(manifold);
  const deployers = [];
  for (let i = 0; i < panels; i += 1) {
    const strip = accordionStrip(panelL, panelW, t, 8, 'radiator', angles);
    strip.group.position.set((i - (panels - 1) / 2) * panelW * 1.05, 0.3, 0); g.add(strip.group); deployers.push(strip.setDeploy);
    for (const s of [-1, 1]) rod(g, [(i - (panels - 1) / 2) * panelW * 1.05 + s * panelW * 0.49, 0.3, 0], [(i - (panels - 1) / 2) * panelW * 1.05 + s * panelW * 0.49, panelL + 0.3, 0], Math.max(panelW * 0.006, 0.02), 'dark');
  }
  return { group: g, setDeploy: (k) => deployers.forEach((d) => d(k)) };
}

/** A solar array wing: blanket box, SADA gimbal, pleated blanket of cells, edge booms. */
export function solarArrayMesh({ L, W, angles }) {
  const g = new THREE.Group();
  const boxg = box(W * 0.32, 0.7, 1.1, 'grey'); put(boxg, 0, 0.35, 0); g.add(boxg);
  const gimbal = tor(W * 0.1, W * 0.02, 'chrome'); put(gimbal, 0, 0.35, 0, Math.PI / 2); g.add(gimbal);
  const blanket = accordionStrip(L, W, Math.max(W * 0.0035, 0.02), 8, 'cell', angles); blanket.group.position.set(0, 0.7, 0); g.add(blanket.group);
  rod(g, [W * 0.5, 0.7, 0], [W * 0.5, L + 0.7, 0], Math.max(W * 0.006, 0.02), 'grey'); rod(g, [-W * 0.5, 0.7, 0], [-W * 0.5, L + 0.7, 0], Math.max(W * 0.004, 0.015), 'grey');
  return { group: g, setDeploy: blanket.setDeploy };
}

/* ------------------------------------------------------------------ *
 * Fittings
 * ------------------------------------------------------------------ */

/** A parabolic dish facing +y: reflector, feed tripod, subreflector. */
export function dishMesh({ d, fD = 0.4 }) {
  const g = new THREE.Group(), r = d / 2, f = fD * d;
  const prof = []; for (let i = 0; i <= 14; i += 1) { const x = (i / 14) * r; prof.push([x, (x * x) / (4 * f)]); }
  g.add(lathe(prof, 'white', { seg: 48, repeat: [8, 2] }));
  const back = lathe(prof.map(([x, y]) => [x * 0.98, y - r * 0.02]), 'grey', { seg: 48, repeat: [1, 1] }); g.add(back);
  const depth = (r * r) / (4 * f);
  for (let k = 0; k < 3; k += 1) { const a = (k / 3) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.75, (r * 0.75) ** 2 / (4 * f), Math.sin(a) * r * 0.75], [0, f * 0.95, 0], Math.max(r * 0.015, 0.006), 'grey'); }
  g.add(put(cyl(r * 0.12, r * 0.06, 'dark', { seg: 16 }), 0, f * 0.95, 0));
  g.add(put(cyl(r * 0.06, Math.max(depth, r * 0.1), 'grey', { seg: 12 }), 0, -Math.max(depth, r * 0.1) * 0.5, 0));
  return g;
}

/** A nozzle from bellSpec's profile: chamber at the base, bell opening toward +y. */
export function bellMesh(spec) {
  const g = new THREE.Group();
  g.add(lathe(spec.profile, 'bell', { seg: 40 }));
  const n = 5; for (let i = 1; i <= n; i += 1) { const t = i / (n + 1); const p = spec.profile[Math.floor(t * (spec.profile.length - 1))]; g.add(ringXZ(p[0] * 1.01, Math.max(p[0] * 0.03, 0.002), 'grey', p[1])); }
  return g;
}

/** An RCS quad: a pod with four small bells (two lateral, one fore, one aft). */
export function rcsQuadMesh({ d }) {
  const g = new THREE.Group(), r = d / 2;
  g.add(box(d, d * 0.8, d, 'white', { repeat: [1, 1] }));
  const bell = new THREE.CylinderGeometry(r * 0.22, r * 0.08, r * 0.45, 12, 1, true); bell.translate(0, r * 0.225, 0);
  const list = [];
  for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const v = new THREE.Vector3(...dir); list.push({ p: v.clone().multiplyScalar(r * 0.55).toArray(), q: new THREE.Quaternion().setFromUnitVectors(Y, v) }); }
  g.add(instances(bell, 'bell', list));
  return g;
}

/** Falcon-class grid fins: a lattice of instanced bars on a shaft, `count` around the body at radius R. Returns pivots for actuation. */
export function gridFinMesh({ finW, finH, finT, count = 4, R, y }) {
  const g = new THREE.Group(), pivots = [];
  const bar = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < count; i += 1) {
    const ang = (i / count) * Math.PI * 2, pivot = new THREE.Group(), fin = new THREE.Group(); fin.position.x = R * 0.02 + finW * 0.5;
    const list = [];
    const add = (sx, sy, sz, px, py, pz) => list.push({ p: [px, py, pz], s: [sx, sy, sz] });
    add(finT, finH * 0.06, finW, 0, finH / 2, 0); add(finT, finH * 0.06, finW, 0, -finH / 2, 0); add(finT, finH, finW * 0.06, 0, 0, finW / 2); add(finT, finH, finW * 0.06, 0, 0, -finW / 2);
    for (let k = 1; k < 7; k += 1) { add(finT * 0.9, finH * 0.025, finW, 0, -finH / 2 + (finH * k) / 7, 0); add(finT * 0.9, finH, finW * 0.025, 0, 0, -finW / 2 + (finW * k) / 7); }
    for (let k = 1; k < 7; k += 1) for (let j = 1; j < 7; j += 1) add(finT * 0.8, finH * 0.02, finW * 0.02, 0, -finH / 2 + (finH * k) / 7, -finW / 2 + (finW * j) / 7);
    fin.add(instances(bar, 'stainless', list));
    const shaft = cyl(finT * 0.6, R * 0.25, 'chrome', { seg: 12 }); shaft.rotation.z = -Math.PI / 2; shaft.position.x = R * 0.02; pivot.add(shaft);
    const mount = box(finT * 1.8, finH * 0.35, finW * 0.25, 'dark'); mount.position.x = R * 0.04; pivot.add(mount);
    pivot.add(fin); pivot.position.set(Math.cos(ang) * R, y, Math.sin(ang) * R); pivot.rotation.y = -ang; g.add(pivot); pivots.push(pivot);
  }
  g.userData.pivots = pivots;
  return g;
}

/**
 * Landing legs, Falcon-style (ported from the shipyard): hinged low on the body, telescoping strut,
 * brace, actuator, fairing, ball-jointed pad. `update(k)` poses them, 0 stowed along the body, 1 down.
 */
export function landingLegMesh({ count = 4, R0, hingeH, spanM, footY = 0, th = null }) {
  const g = new THREE.Group(), T = th ?? Math.max(0.05, R0 * 0.07), legs = [];
  const unit = (kind, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, seg), surface(kind));
  const link = (m, P, Q, rad) => { const d = Q.clone().sub(P), len = Math.max(d.length(), 1e-4); m.position.copy(P).addScaledVector(d, 0.5); m.scale.set(rad, len, rad); m.quaternion.setFromUnitVectors(Y, d.normalize()); };
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count, L = { a, ca: Math.cos(a), sa: Math.sin(a) };
    L.sleeve = unit('grey'); L.piston = unit('chrome'); L.brace = unit('grey'); L.aOut = unit('grey'); L.aIn = unit('chrome');
    L.fair = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surface('white', { repeat: [1, 2] })); L.hinge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), surface('dark'));
    L.pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 0.28, 24), surface('dark')); L.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), surface('chrome'));
    g.add(L.sleeve, L.piston, L.brace, L.aOut, L.aIn, L.fair, L.pad, L.ball, L.hinge); legs.push(L);
  }
  const LR = spanM / 2;
  g.userData.update = (k) => {
    for (const L of legs) {
      const { a, ca, sa } = L, A = new THREE.Vector3(ca * R0 * 1.03, hingeH, sa * R0 * 1.03), B = new THREE.Vector3(ca * R0 * 1.03, hingeH * 0.35, sa * R0 * 1.03);
      const dx = LR - R0 * 1.03, dy = footY - hingeH, len = Math.hypot(dx, dy), phi1 = Math.atan2(dx, dy), phi = 0.05 + (phi1 - 0.05) * k;
      const F = new THREE.Vector3(A.x + ca * Math.sin(phi) * len, A.y + Math.cos(phi) * len, A.z + sa * Math.sin(phi) * len), M = A.clone().lerp(F, 0.5), P2 = A.clone().lerp(F, 0.62), act = B.clone().lerp(P2, 0.5);
      link(L.sleeve, A, M, T * 1.35); link(L.piston, M.clone().lerp(A, 0.2), F, T * 0.8); link(L.brace, B, P2, T * 0.7); link(L.aOut, B, act, T * 0.6); link(L.aIn, act.clone().lerp(B, 0.15), P2, T * 0.4);
      const dir = F.clone().sub(A), fl = dir.length() * 0.55, dn = dir.clone().normalize();
      L.fair.position.copy(A).addScaledVector(dn, fl / 2).add(new THREE.Vector3(ca, 0, sa).multiplyScalar(T * 1.1)); L.fair.scale.set(T * 0.4, fl, T * 3.4); L.fair.quaternion.setFromUnitVectors(Y, dn); L.fair.rotateY(-a);
      L.pad.position.set(F.x, F.y - 0.14 * T / 0.26, F.z); L.pad.scale.set(T * 3.4, T / 0.26, T * 3.4); L.pad.quaternion.setFromUnitVectors(Y, new THREE.Vector3(-ca * Math.cos(phi), Math.sin(phi), -sa * Math.cos(phi)).normalize()).slerp(new THREE.Quaternion(), k);
      L.ball.position.copy(F); L.ball.scale.setScalar(T * 1.25); L.hinge.position.copy(A); L.hinge.scale.set(T * 2.2, T * 2.6, T * 3.2); L.hinge.rotation.y = -a;
    }
  };
  g.userData.update(1);
  return g;
}

/** A hatch: disc, frame ring, four dogs. */
export function hatchMesh(d) {
  const g = new THREE.Group(), r = d / 2;
  g.add(cyl(r * 0.92, r * 0.06, 'hatch', { seg: 28, repeat: [1, 1] }), ringXZ(r, r * 0.05, 'grey', r * 0.03));
  for (let k = 0; k < 4; k += 1) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; const dog = box(r * 0.12, r * 0.08, r * 0.3, 'dark'); put(dog, Math.cos(a) * r * 0.7, r * 0.08, Math.sin(a) * r * 0.7, 0, -a, 0); g.add(dog); }
  return g;
}

/** A visible mating ring for a structural port: ring, bolt flange and a sealing plate. */
export function portRingMesh(d, kind = 'grey') {
  const g = new THREE.Group();
  const m = tor(d / 2, Math.max(d * 0.035, 1e-4), kind); m.rotation.x = Math.PI / 2; g.add(m);
  const plate = cyl(d * 0.44, d * 0.06, 'hatch', { seg: 24, repeat: [1, 1] }); plate.position.y = -d * 0.03; g.add(plate);
  const n = Math.max(8, Math.min(24, Math.round(d * 12)));
  const bolt = new THREE.CylinderGeometry(1, 1, 1, 6);
  const list = []; for (let k = 0; k < n; k += 1) { const a = (k / n) * Math.PI * 2; list.push({ p: [Math.cos(a) * d * 0.47, d * 0.02, Math.sin(a) * d * 0.47], s: [d * 0.012, d * 0.03, d * 0.012] }); }
  g.add(instances(bolt, 'dark', list));
  return g;
}

/** Nav lights: red port, green starboard, white fore/aft strobes, as emissive spheres at the given points. */
export function navLights(points) {
  const g = new THREE.Group();
  for (const { p, kind, r } of points) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), surface(kind)); s.position.fromArray(p); g.add(s); }
  return g;
}

/** A spherical COPV cluster: n spheres in a row with a manifold. */
export function copvClusterMesh({ d, count = 4, pitch = null, kind = 'chrome' }) {
  const g = new THREE.Group(), r = d / 2, step = pitch ?? d * 1.15;
  for (let i = 0; i < count; i += 1) { const s = sph(r, kind, { seg: 20, rseg: 14 }); s.position.set((i - (count - 1) / 2) * step, r, 0); g.add(s); }
  rod(g, [-(count - 1) / 2 * step, r * 1.9, 0], [(count - 1) / 2 * step, r * 1.9, 0], Math.max(r * 0.05, 0.01), 'grey');
  return g;
}

export { ogiveProfile, haackProfile, domeProfile };
