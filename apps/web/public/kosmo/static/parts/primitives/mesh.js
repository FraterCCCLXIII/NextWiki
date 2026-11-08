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
  const lineR = Math.max(r * 0.015, 0.004);
  rod(g, [r * 1.0 + lineR, spec.domeH * 0.5, 0], [r * 1.0 + lineR, L - spec.domeH * 0.5, 0], lineR, 'grey');
  /* P-clamps hold the line to the skin; the vent is on the barrel flank (the end faces are mating planes) */
  for (let i = 0; i <= 3; i += 1) { const c = box(lineR * 3, lineR * 2.6, lineR * 2.6, 'dark'); c.position.set(r + lineR * 0.9, spec.domeH * 0.5 + ((L - spec.domeH) * i) / 3, 0); g.add(c); }
  const vent = cyl(Math.max(r * 0.05, 0.008), Math.max(r * 0.12, 0.02), 'dark', { seg: 10 }); onCylinder(vent, r, Math.PI * 0.6, spec.domeH + spec.barrelL * 0.7, -Math.max(r * 0.02, 0.004)); g.add(vent);
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
  const g = new THREE.Group(), r = d / 2;
  /* 'cone' is the ISS end cone (0.55 r over 0.65 m); 'dome' the sqrt-2 ellipsoid; 'round' a shallow blended
     dome (0.3 r high) for the chunky rounded module the livery references draw, with a flat mating face */
  const endH = endKind === 'dome' ? r * 0.707 : endKind === 'round' ? Math.min(r * 0.3, l * 0.12) : Math.min(0.65, l * 0.1), barrelL = Math.max(0, l - 2 * endH);
  g.add(put(cyl(r, barrelL, skin, { seg: 48 }), 0, endH, 0));
  const endProfile = endKind === 'dome' ? domeProfile(r, endH, 10) : endKind === 'round' ? [...domeProfile(r, endH, 8).filter(([x]) => x > r * 0.62), [r * 0.62, endH]] : [[r, 0], [r * 0.55, endH]];
  g.userData.hull = { r, l, endH, barrelL, endKind };
  const top = lathe(endProfile, skin, { seg: 48 }); top.position.y = l - endH; g.add(top);
  const bottom = lathe(endProfile, skin, { seg: 48 }); bottom.rotation.x = Math.PI; bottom.position.y = endH; g.add(bottom);
  /* a rounded module ends in a flat mating face: the disc the adapter, node or hub stands on */
  if (endKind === 'round') { g.add(put(cyl(r * 0.625, 0.04, skin, { seg: 48, repeat: [2, 1] }), 0, l - 0.04, 0)); g.add(put(cyl(r * 0.625, 0.04, skin, { seg: 48, repeat: [2, 1] }), 0, 0, 0)); }
  g.add(ringXZ(r * 0.99, Math.max(r * 0.025, 0.02), 'grey', endH + 0.03), ringXZ(r * 0.99, Math.max(r * 0.025, 0.02), 'grey', l - endH - 0.03));
  for (let i = 1; i <= bands; i += 1) { const b = cyl(r * 1.012, barrelL * 0.035, 'mli', { seg: 48, open: true }); b.position.y = endH + (barrelL * i) / (bands + 1); g.add(b); }
  /* flange rings at the barrel's bay joints (the module is built of ring-stiffened bays; Tiangong's show as raised hoops) */
  const bayN = Math.max(1, Math.round(barrelL / 1.6));
  for (let i = 1; i < bayN; i += 1) g.add(ringXZ(r * 1.004, Math.max(r * 0.012, 0.012), 'grey', endH + (barrelL * i) / bayN, { rad: 8, tseg: 96 }));
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
  /* external equipment rides on pallets seated on saddles (ExPRESS / Tiangong style), not on boxes tangent to the skin */
  for (let i = 0; i < racks; i += 1) {
    const a = (i / racks) * Math.PI * 2 + Math.PI / 4;
    const pal = palletMesh({ r, w: Math.min(r * 0.55, 1.6), l: Math.min(barrelL * 0.45, 4.2), h: Math.min(r * 0.3, 0.9), boxes: 3 });
    onCylinder(pal, r, a, l / 2); g.add(pal);
  }
  if (raceway) { const tray = cableTrayMesh({ l: barrelL * 0.9, w: Math.max(0.12, Math.min(0.2, r * 0.08)) }); onCylinder(tray, r, Math.PI / 2, l / 2); g.add(tray); }
  if (hatchSide) { const h = cyl(r * 0.28, r * 0.03, 'hatch', { seg: 24 }); put(h, -r * 0.98, l / 2, 0, 0, 0, Math.PI / 2); g.add(h); g.add(put(tor(r * 0.3, r * 0.02, 'grey'), -r * 0.98, l / 2, 0, 0, Math.PI / 2, 0)); }
  return g;
}

/** A torus deck from torusDeckSpec or ring numbers: shell (with an optional cutaway arc), instanced windows, spokes, hub. */
export function torusDeckMesh({ R, D, decks = 1, arc = Math.PI * 2 * (5 / 6), windows = null, spokes = 6, skin = 'white', hubR = null, hubL = null }) {
  const g = new THREE.Group(), tube = D / 2;
  /* The full shell, and a cutaway shell (the `arc`) with its decks: the viewer's cutaway toggle swaps them
     through userData.cutaway; the ship is drawn whole by default. (The QA pass: a ring with a sixth missing
     read as an incomplete mesh.) */
  const shellFrame = new THREE.Group(); shellFrame.rotation.x = -Math.PI / 2;
  const segs = Math.max(96, Math.round(R * 2)), rep = [Math.max(4, Math.round(R / 2)), Math.max(2, Math.round(D / 2))];
  const full = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, segs), surface(skin, { repeat: rep })); full.userData.cutaway = 'full'; shellFrame.add(full);
  const cut = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 24, segs, arc), surface(skin, { repeat: rep })); cut.userData.cutaway = 'cut'; cut.visible = false; shellFrame.add(cut);
  g.add(shellFrame);
  for (let i = 0; i < decks; i += 1) {
    const floor = new THREE.Mesh(new THREE.RingGeometry(R - tube * 0.82, R + tube * 0.82, 128, 1, 0, arc), surface(i % 2 ? 'cell' : 'radiator', { repeat: [8, 1] }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -tube + 1.8 + i * 3; floor.userData.cutaway = 'cut'; floor.visible = false; g.add(floor);
  }
  const nW = windows ?? Math.max(24, Math.round(2 * Math.PI * R / 4));
  const win = new THREE.BoxGeometry(Math.min(tube * 0.5, 1.6), Math.min(tube * 0.25, 0.8), tube * 0.05);
  const list = [];
  for (let i = 0; i < nW; i += 1) {
    const a = (i / nW) * Math.PI * 2;
    const q = new THREE.Quaternion().setFromAxisAngle(Y, -a);
    for (let k = 0; k < decks; k += 1) list.push({ p: [Math.cos(a) * (R + tube * 0.9), -tube + 1.8 + k * 3 + 0.9, Math.sin(a) * (R + tube * 0.9)], q });
  }
  g.add(instances(win, 'glass', list));
  /* The hub is the collar the ring turns on: it sits round the bearing or despun hub it is mated to (hubR is
     that body's radius), and the spokes run from the collar to the tube's inner wall, not from a drawn drum
     of arbitrary size to the tube's centreline. */
  const rc = hubR ?? Math.max(tube * 0.5, 0.6), collarT = Math.max(0.25, Math.min(0.9, rc * 0.12)), collarL = hubL ?? Math.max(1.0, Math.min(tube * 0.8, rc * 0.8));
  /* a spoke is a pressurised transit tube with a lift: 1.5 m across at the least, up to 3 m on a fat ring */
  /* 1.1 m at most: a fatter spoke in the ring plane runs into the reactors on the hub's flank */
  const spokeR = Math.max(0.75, Math.min(tube * 0.35, 1.1));
  for (let i = 0; i < spokes; i += 1) {
    const a = (i / spokes) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
    const r0 = rc + collarT, r1 = R - tube * 0.98;
    rod(g, [c * r0, 0, sn * r0], [c * r1, 0, sn * r1], spokeR, 'white', { seg: 12 });
    /* a spoke is a pressurised tube with a lift: its foot flares into the collar, its head into the deck */
    /* the foot flare stays inside the collar's width (a flare wider than the bearing ran into the stage behind it and the hub's mounts) */
    const footR = Math.min(spokeR * 1.25, collarL * 0.5);
    const foot = cyl(footR, Math.max(spokeR * 1.5, 0.4), 'grey', { seg: 12 }); foot.position.set(c * r0, 0, sn * r0); foot.quaternion.setFromUnitVectors(Y, new THREE.Vector3(c, 0, sn)); g.add(foot);
    const head = cyl(spokeR * 1.4, Math.max(spokeR * 2, 0.4), 'grey', { seg: 12 }); head.position.set(c * (r1 - Math.max(spokeR * 2, 0.4)), 0, sn * (r1 - Math.max(spokeR * 2, 0.4))); head.quaternion.setFromUnitVectors(Y, new THREE.Vector3(c, 0, sn)); g.add(head);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(rc + collarT, rc + collarT, collarL, 48, 1, true), surface('white', { repeat: [8, 1] })); g.add(collar);
  g.add(ringXZ(rc + collarT, Math.max(collarT * 0.4, 0.05), 'grey', collarL / 2), ringXZ(rc + collarT, Math.max(collarT * 0.4, 0.05), 'grey', -collarL / 2));
  g.add(ringXZ(rc + collarT * 0.5, Math.max(collarT * 0.3, 0.04), 'gold', collarL / 2 + collarT * 0.2), ringXZ(rc + collarT * 0.5, Math.max(collarT * 0.3, 0.04), 'gold', -collarL / 2 - collarT * 0.2));
  g.userData.ring = { R, tube, hubR: rc, collarT, collarL, spokes, decks };
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
export function radiatorMesh({ panelL, panelW, panels = 1, angles, thick = null, standoff = 0.6, seatR = null, seatRot = 0 }) {
  const g = new THREE.Group(), t = thick ?? Math.max(panelW * 0.012, 0.03), W = panelW * panels * 1.05, s0 = Math.max(standoff, 0.3);
  /* the root: a saddle on the hull, a hinge bracket on it, the rotary fluid joint, and the manifold the panels hang
     from at the standoff, so the first panel stands clear of the hull it is mounted on */
  const bw = Math.min(W * 0.3, 1.2);
  const foot = saddleMesh({ r: seatR, w: bw * 1.3, l: bw * 0.9, kind: 'grey' }); foot.rotation.y = seatRot; g.add(foot);
  const bracket = box(bw, s0 * 0.5, bw * 0.6, 'grey'); put(bracket, 0, foot.userData.top + s0 * 0.25, 0); bracket.userData.seated = true; g.add(bracket);
  const joint = cyl(Math.min(W * 0.12, 0.45), s0 * 0.45, 'stainless', { seg: 20 }); put(joint, 0, s0 * 0.5, 0); g.add(joint);
  const manifold = box(W, Math.max(t * 2, 0.12), Math.max(t * 2, 0.12), 'grey'); put(manifold, 0, s0 - 0.05, 0); g.add(manifold);
  for (const sx of [-1, 1]) rod(g, [sx * Math.min(W * 0.12, 0.4), s0 * 0.5, 0], [sx * W * 0.45, s0 - 0.05, 0], Math.max(t, 0.03), 'grey');
  const deployers = [];
  for (let i = 0; i < panels; i += 1) {
    const strip = accordionStrip(panelL, panelW, t, 8, 'radiator', angles);
    strip.group.position.set((i - (panels - 1) / 2) * panelW * 1.05, s0, 0); g.add(strip.group); deployers.push(strip.setDeploy);
    for (const s of [-1, 1]) rod(g, [(i - (panels - 1) / 2) * panelW * 1.05 + s * panelW * 0.49, s0, 0], [(i - (panels - 1) / 2) * panelW * 1.05 + s * panelW * 0.49, panelL + s0, 0], Math.max(panelW * 0.006, 0.02), 'dark');
  }
  return { group: g, setDeploy: (k) => deployers.forEach((d) => d(k)) };
}

/** A solar array wing: blanket box, SADA gimbal, pleated blanket of cells, edge booms. */
export function solarArrayMesh({ L, W, angles, standoff = 1.2, seatR = null, seatRot = 0 }) {
  const g = new THREE.Group(), s0 = Math.max(standoff, 0.7);
  /* the standoff boom: saddle on the hull, SADA, lattice yoke, beta gimbal and blanket box, the wing's root at the standoff */
  g.add(solarBoomMesh({ r: seatR, length: s0, W, kind: 'grey', seatRot }).group);
  const blanket = accordionStrip(L, W, Math.max(W * 0.0035, 0.02), 8, 'cell', angles); blanket.group.position.set(0, s0, 0); g.add(blanket.group);
  rod(g, [W * 0.5, s0, 0], [W * 0.5, L + s0, 0], Math.max(W * 0.006, 0.02), 'grey'); rod(g, [-W * 0.5, s0, 0], [-W * 0.5, L + s0, 0], Math.max(W * 0.004, 0.015), 'grey');
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

/* ------------------------------------------------------------------ *
 * Mounts: how a block, a tank or a pallet sits on a curved hull
 *
 * The attachment review (CENTAURI-ATTACH.md) found equipment drawn tangent to cylinders -- a flat box
 * touching the skin along one line with a dark slit under its corners -- and tanks hovering off the
 * hull. Real hardware sits on a saddle (a plate cut to the hull radius), a cradle (saddle blocks and
 * strap bands round a tank), an adapter plate on standoff feet, or a pallet frame; these are those,
 * built in a SURFACE frame: +y the outward normal at the mount's centre, x across the hull, z along
 * its axis. `onCylinder()` poses a surface-frame group on a body of revolution, `onSurfaceY()` on a
 * flat face. Every box a mount seats is tagged `userData.seated` so the mesh audit knows the saddle
 * carries it.
 * ------------------------------------------------------------------ */

/** The sagitta of a chord of width w on a circle of radius r: how far the skin falls away under a flat foot. */
export const sagitta = (r, w) => r - Math.sqrt(Math.max(r * r - (w / 2) * (w / 2), 0));

/** Pose a surface-frame group on a cylinder of radius r whose axis is +y: at angle theta round it, height y,
 *  lifted `lift` off the skin. Local +y becomes the outward radial, local +z the cylinder axis. */
export function onCylinder(obj, r, theta, y, lift = 0) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const x = new THREE.Vector3(-s, 0, c), yv = new THREE.Vector3(c, 0, s), z = new THREE.Vector3(0, 1, 0);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, yv, z));
  obj.position.set(c * (r + lift), y, s * (r + lift));
  return obj;
}
/** Pose a surface-frame group on a flat face whose outward normal is `normal` (unit), at point p. */
export function onFace(obj, p, normal, along = null) {
  const n = new THREE.Vector3(...normal).normalize();
  const a = along ? new THREE.Vector3(...along) : (Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0));
  const x = new THREE.Vector3().crossVectors(a, n).normalize(), z = new THREE.Vector3().crossVectors(x, n).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, n, z));
  obj.position.set(p[0], p[1], p[2]);
  return obj;
}

/**
 * A saddle: a shell sector at the hull radius r spanning chord width w (across, x) and length l (along, z),
 * thickness t, two cheeks at the chord ends and a flat deck on top, so a flat-bottomed block seats at
 * `userData.top` above the skin with nothing under its corners. On a flat face (r = null) it is a plain plate.
 */
export function saddleMesh({ r = null, w, l, t = null, kind = 'grey', deck = true }) {
  const g = new THREE.Group();
  const tt = t ?? Math.max(0.02, Math.min(0.08, (r ?? w) * 0.012));
  if (r == null || w >= 1.9 * r) {
    const plate = box(w, tt, l, kind, { repeat: [1, 1] }); plate.position.y = tt / 2; plate.userData.seated = true; g.add(plate);
    g.userData.top = tt;
    return g;
  }
  const half = Math.asin(Math.min(0.999, (w / 2) / r)), sag = sagitta(r, w);
  /* the sector: a cylinder of radius r + t with its axis along z, centred r below the skin, the arc centred on +y */
  const sector = new THREE.Mesh(new THREE.CylinderGeometry(r + tt, r + tt, l, Math.max(8, Math.round(half * 24)), 1, true, -half, 2 * half), surface(kind, { repeat: [1, 1] }));
  /* CylinderGeometry's theta is measured from +z toward +x round the y axis: turn the arc so it is centred on +y round z */
  sector.geometry.rotateX(-Math.PI / 2); sector.position.set(0, -r, 0); sector.userData.seated = true; g.add(sector);
  const deckT = Math.max(0.015, tt * 0.6), deckY = tt;
  for (const sx of [-1, 1]) { const cheek = box(tt, sag + tt, l, kind, { repeat: [1, 1] }); cheek.position.set(sx * (w / 2 - tt / 2), -sag + (sag + tt) / 2, 0); cheek.userData.seated = true; g.add(cheek); }
  if (deck) { const plate = box(w, deckT, l, kind, { repeat: [1, 1] }); plate.position.y = deckY + deckT / 2; plate.userData.seated = true; g.add(plate); }
  g.userData.top = deck ? deckY + deckT : deckY; g.userData.sagitta = sag;
  return g;
}

/** Four bolt heads at the corners of a w x l footprint at height y. */
function cornerBolts(g, w, l, y, inset = 0.06, size = 0.03) {
  const bolt = new THREE.CylinderGeometry(1, 1, 1, 6);
  const list = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) list.push({ p: [sx * (w / 2 - inset), y, sz * (l / 2 - inset)], s: [size / 2, size * 0.5, size / 2] });
  g.add(instances(bolt, 'dark', list));
}

/**
 * A block seated on a hull: the box w (across) x h (radial) x l (along) on a saddle, corner bolts, an
 * optional cable stub into the hull. Surface frame. `r` null seats it on a flat face.
 */
export function seatedBlock({ r = null, w, h, l, kind = 'offwhite', saddleKind = 'grey', stub = true }) {
  const g = new THREE.Group();
  const saddle = saddleMesh({ r, w: w * 1.08, l: l * 1.08, kind: saddleKind }); g.add(saddle);
  const top = saddle.userData.top;
  const b = box(w, h, l, kind, { repeat: [Math.max(1, Math.round(w / 0.8)), Math.max(1, Math.round(h / 0.8))] }); b.position.y = top + h / 2; b.userData.seated = true; g.add(b);
  cornerBolts(g, w * 1.08, l * 1.08, top, Math.max(0.04, w * 0.04), Math.max(0.02, Math.min(0.05, w * 0.03)));
  if (stub) { const c = cyl(Math.max(0.015, Math.min(0.06, w * 0.03)), top + h * 0.3, 'dark', { seg: 8 }); c.position.set(w * 0.35, -0.02, l * 0.3); g.add(c); }
  g.userData.top = top; g.userData.height = top + h;
  return g;
}

/**
 * A cylinder (tank, drum, COPV) cradled on a hull with its axis along z: a saddle on the skin, two
 * cradle blocks cut to the tank radius, two strap bands over it, a manifold stub. Surface frame; the tank
 * body is drawn in `kind` (null draws cradle and straps only, for a body drawn elsewhere, and the caller
 * reads `userData.axisY` for the tank's axis height).
 */
export function cradledCylinder({ r = null, tankR, tankL, kind = 'tank', cradleKind = 'grey', strapKind = 'stainless', straps = 2, across = false }) {
  const g = new THREE.Group();
  const w = Math.min(tankR * 1.7, tankL * 0.9);
  const saddle = saddleMesh({ r, w: across ? tankL * 0.92 : w, l: across ? w : tankL * 0.92, kind: cradleKind }); g.add(saddle);
  const top = saddle.userData.top, blockT = Math.max(0.04, tankR * 0.12), lift = tankR * 0.08;
  const axisY = top + lift + tankR;
  /* the tank's axis along z (or x when `across`) */
  const tankFrame = new THREE.Group(); if (across) tankFrame.rotation.y = Math.PI / 2; g.add(tankFrame);
  for (const sz of [-1, 1]) {
    const zc = sz * (tankL * 0.5 - blockT * 2 - 0.02);
    /* a cradle block: the annular sector the tank rests in, from the saddle up to its equator, plus its base */
    const blk = new THREE.Mesh(new THREE.CylinderGeometry(tankR * 1.05, tankR * 1.05, blockT, 24, 1, false, -Math.PI * 0.4, Math.PI * 0.8), surface(cradleKind, { repeat: [1, 1] }));
    blk.geometry.rotateX(Math.PI / 2); blk.position.set(0, axisY, zc); tankFrame.add(blk);
    const base = box(tankR * 1.9, lift + tankR * 0.3, blockT, cradleKind, { repeat: [1, 1] }); base.position.set(0, top + (lift + tankR * 0.3) / 2, zc); base.userData.seated = true; tankFrame.add(base);
    if (straps > 0) { const strap = new THREE.Mesh(new THREE.CylinderGeometry(tankR * 1.015, tankR * 1.015, blockT * 0.7, 32, 1, true, Math.PI * 0.45, Math.PI * 1.1), surface(strapKind, { repeat: [1, 1] })); strap.geometry.rotateX(Math.PI / 2); strap.position.set(0, axisY, zc); tankFrame.add(strap); }
  }
  if (kind) { const body = cyl(tankR, tankL, kind, { seg: 32 }); body.geometry.translate(0, -tankL / 2, 0); body.geometry.rotateX(Math.PI / 2); body.position.set(0, axisY, 0); tankFrame.add(body); const dome = sph(tankR, kind, { seg: 24, rseg: 12 }); dome.scale.set(1, 1, 0.3); dome.position.set(0, axisY, tankL / 2); tankFrame.add(dome); const dome2 = dome.clone(); dome2.position.z = -tankL / 2; tankFrame.add(dome2); }
  const stub = cyl(Math.max(0.012, tankR * 0.08), lift + tankR * 0.5, 'dark', { seg: 8 }); stub.position.set(tankR * 0.5, top, 0); g.add(stub);
  g.userData.axisY = axisY; g.userData.top = top;
  return g;
}

/**
 * A sphere (COPV) cradled on a hull: a saddle, a cradle ring the sphere sits in, two crossed straps, a
 * manifold stub. Surface frame. Returns the group; `userData.centreY` is the sphere's centre height.
 */
export function cradledSphere({ r = null, ballR, kind = 'chrome', cradleKind = 'grey', strapKind = 'stainless' }) {
  const g = new THREE.Group();
  const saddle = saddleMesh({ r, w: ballR * 1.6, l: ballR * 1.6, kind: cradleKind }); g.add(saddle);
  const top = saddle.userData.top, lift = ballR * 0.1, cY = top + lift + ballR;
  /* a cradle cup: a short cone from the saddle to the sphere's lower latitude */
  const cup = lathe([[ballR * 0.5, top], [ballR * 0.85, top + lift + ballR * 0.45]], cradleKind, { seg: 24 }); g.add(cup);
  const ball = sph(ballR, kind, { seg: 24, rseg: 16 }); ball.position.y = cY; g.add(ball);
  for (const rot of [0, Math.PI / 2]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(ballR * 1.02, ballR * 0.03, 6, 32, Math.PI), surface(strapKind, { repeat: [1, 1] })); strap.rotation.set(0, rot, 0); strap.position.y = cY; g.add(strap); }
  const stub = cyl(Math.max(0.01, ballR * 0.07), top + lift + ballR * 0.3, 'dark', { seg: 8 }); stub.position.set(ballR * 0.55, 0, ballR * 0.55); g.add(stub);
  g.userData.centreY = cY; g.userData.top = top;
  return g;
}

/**
 * An adapter plate on standoff feet: a w x l plate at `standoff` above the skin on four struts that reach
 * the curved hull (each foot its own length, so none hangs in the air). Surface frame; whatever stands on the
 * plate goes at `userData.top`.
 */
export function standoffPlate({ r = null, w, l, standoff, kind = 'grey', plateT = null }) {
  const g = new THREE.Group(), t = plateT ?? Math.max(0.02, Math.min(0.08, w * 0.03));
  const plate = box(w, t, l, kind, { repeat: [1, 1] }); plate.position.y = standoff + t / 2; plate.userData.seated = true; g.add(plate);
  const inset = Math.min(w, l) * 0.08, legR = Math.max(0.012, Math.min(0.06, w * 0.025));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset), z = sz * (l / 2 - inset);
    /* the skin under this foot is lower by the sagitta at x (the hull curves across x) */
    const skinY = r == null ? 0 : -(r - Math.sqrt(Math.max(r * r - x * x, 0)));
    rod(g, [x, skinY - 0.01, z], [x, standoff, z], legR, kind, { seg: 8 });
    const foot = cyl(legR * 2.2, Math.max(0.01, legR), kind, { seg: 10 }); foot.position.set(x, skinY - 0.005, z); g.add(foot);
  }
  g.userData.top = standoff + t;
  return g;
}

/**
 * An ExPRESS-class pallet: a frame of longerons and cross beams on saddle feet, carrying `boxes` ORU boxes
 * on top, a keel and a grapple fixture. Surface frame; the pallet runs along z. Tiangong and the ISS carry
 * their external payloads this way, so the same pallet fits any hull.
 */
export function palletMesh({ r = null, w, l, h = null, boxes = 3, kind = 'grey', boxKind = 'offwhite' }) {
  const g = new THREE.Group(), hh = h ?? Math.min(w, l) * 0.6, beam = Math.max(0.04, Math.min(0.12, w * 0.06));
  const feetL = Math.min(l * 0.3, Math.max(0.4, w * 0.5));
  let top = 0;
  for (const sz of [-1, 1]) { const foot = saddleMesh({ r, w: w * 0.95, l: feetL, kind }); foot.position.z = sz * (l / 2 - feetL / 2); g.add(foot); top = foot.userData.top; }
  const deckY = top + beam;
  for (const sx of [-1, 1]) { const lon = box(beam, beam, l, kind, { repeat: [1, 1] }); lon.position.set(sx * (w / 2 - beam / 2), top + beam / 2, 0); lon.userData.seated = true; g.add(lon); }
  const nCross = Math.max(2, Math.round(l / Math.max(w * 0.6, 0.5)));
  for (let i = 0; i <= nCross; i += 1) { const cb = box(w, beam, beam, kind, { repeat: [1, 1] }); cb.position.set(0, top + beam / 2, -l / 2 + (l * i) / nCross); cb.userData.seated = true; g.add(cb); }
  const step = l / boxes;
  for (let i = 0; i < boxes; i += 1) {
    const bw = w * (0.7 + 0.2 * ((i * 7) % 3) / 2), bl = step * 0.82, bh = hh * (0.7 + 0.3 * ((i * 5) % 2));
    const b = box(bw, bh, bl, i % 3 === 1 ? 'mli' : boxKind, { repeat: [1, 1] }); b.position.set(0, deckY + bh / 2, -l / 2 + (i + 0.5) * step); b.userData.seated = true; g.add(b);
    const handle = rod(g, [-bw * 0.4, deckY + bh + 0.05, -l / 2 + (i + 0.5) * step], [bw * 0.4, deckY + bh + 0.05, -l / 2 + (i + 0.5) * step], Math.max(0.012, bw * 0.02), 'gold', { seg: 6 });
    for (const sx of [-1, 1]) rod(g, [sx * bw * 0.4, deckY + bh, -l / 2 + (i + 0.5) * step], [sx * bw * 0.4, deckY + bh + 0.05, -l / 2 + (i + 0.5) * step], Math.max(0.008, bw * 0.012), 'gold', { seg: 6 });
    void handle;
  }
  const grapple = cyl(Math.max(0.05, w * 0.06), beam * 1.5, 'dark', { seg: 12 }); grapple.position.set(w * 0.35, deckY, l * 0.44); g.add(grapple);
  g.userData.top = deckY; g.userData.height = deckY + hh;
  return g;
}

/**
 * A cable tray along a hull: a shallow channel on standoff clips with three cable bundles in it, the
 * outer two orange (the harness colour every station photograph shows), clamps at `pitch`. Surface frame,
 * running along z for `l`.
 */
export function cableTrayMesh({ l, w = 0.16, pitch = 0.6, kind = 'dark' }) {
  const g = new THREE.Group(), clip = 0.04, trayT = 0.012;
  const tray = box(w, trayT, l, kind, { repeat: [1, 1] }); tray.position.y = clip + trayT / 2; tray.userData.seated = true; g.add(tray);
  for (const sx of [-1, 1]) { const lip = box(trayT, w * 0.35, l, kind, { repeat: [1, 1] }); lip.position.set(sx * (w / 2 - trayT / 2), clip + trayT + w * 0.175, 0); g.add(lip); }
  const n = Math.max(2, Math.round(l / pitch));
  const clipGeo = new THREE.BoxGeometry(w * 0.9, clip, 0.05);
  const clips = []; for (let i = 0; i <= n; i += 1) clips.push({ p: [0, clip / 2, -l / 2 + (l * i) / n] });
  g.add(instances(clipGeo, 'grey', clips));
  const cableR = w * 0.14;
  for (const [x, k] of [[-w * 0.3, 'accent'], [0, 'dark'], [w * 0.3, 'accent']]) { const c = cyl(cableR, l, k, { seg: 10 }); c.geometry.translate(0, -l / 2, 0); c.geometry.rotateX(Math.PI / 2); c.position.set(x, clip + trayT + cableR, 0); g.add(c); }
  const clampGeo = new THREE.BoxGeometry(w * 1.05, cableR * 2.6, 0.04);
  const clamps = []; for (let i = 0; i <= n; i += 1) clamps.push({ p: [0, clip + trayT + cableR, -l / 2 + (l * i) / n] });
  g.add(instances(clampGeo, 'grey', clamps));
  return g;
}

/**
 * A docking port (IDSS-class) on a face: the tunnel, the passive hard-capture ring with its hooks, three
 * guide petals, a soft-capture ring on its struts, a docking target. Built along +y from the face at y = 0,
 * `d` the mating-plane diameter; `depth` how far the tunnel stands off the face.
 */
export function dockingPortMesh(d, { depth = null, kind = 'grey' } = {}) {
  const g = new THREE.Group(), r = d / 2, h = depth ?? d * 0.3;
  g.add(cyl(r * 0.92, h, 'white', { seg: 40, repeat: [4, 1] }));
  g.add(ringXZ(r * 0.96, r * 0.045, kind, h * 0.95), ringXZ(r * 0.96, r * 0.04, kind, h * 0.08));
  const hook = new THREE.BoxGeometry(r * 0.08, r * 0.07, r * 0.14);
  const hooks = []; for (let k = 0; k < 12; k += 1) { const a = (k / 12) * Math.PI * 2; hooks.push({ p: [Math.cos(a) * r * 0.96, h, Math.sin(a) * r * 0.96], q: new THREE.Quaternion().setFromAxisAngle(Y, -a) }); }
  g.add(instances(hook, 'dark', hooks));
  for (let i = 0; i < 3; i += 1) { const a = (i / 3) * Math.PI * 2; const petal = box(r * 0.3, r * 0.05, r * 0.42, 'hatch'); put(petal, Math.cos(a) * r * 0.62, h + r * 0.03, Math.sin(a) * r * 0.62, 0, -a, 0); g.add(petal); }
  const soft = ringXZ(r * 0.66, r * 0.03, 'stainless', h + r * 0.18); g.add(soft);
  for (let i = 0; i < 6; i += 1) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; rod(g, [Math.cos(a) * r * 0.8, h, Math.sin(a) * r * 0.8], [Math.cos(a) * r * 0.66, h + r * 0.18, Math.sin(a) * r * 0.66], r * 0.02, 'grey', { seg: 6 }); }
  g.add(put(cyl(r * 0.72, r * 0.03, 'hatch', { seg: 32, repeat: [1, 1] }), 0, h - r * 0.02, 0));
  const target = box(r * 0.04, r * 0.02, r * 0.3, 'dark'); put(target, 0, h + r * 0.02, 0); g.add(target);
  const target2 = box(r * 0.3, r * 0.02, r * 0.04, 'dark'); put(target2, 0, h + r * 0.02, 0); g.add(target2);
  g.userData.depth = h;
  return g;
}

/**
 * A standoff solar boom: a lattice arm from a saddle on the hull out to the SADA drum, the beta gimbal and the
 * blanket box, so the wing turns clear of the habitable volume. Along +y from the hull hardpoint; `length` is
 * the standoff (catalogue `standoff`), `W` the blanket width the fittings scale with. Returns { group, tip }
 * with `tip` the y where the blanket's root hinge sits.
 */
export function solarBoomMesh({ r = null, length, W, kind = 'grey', seatRot = 0 }) {
  const g = new THREE.Group(), s0 = Math.max(length, 0.7), bw = Math.min(W * 0.08, 0.5);
  const foot = saddleMesh({ r, w: Math.max(bw * 2.4, 0.5), l: Math.max(bw * 2.4, 0.5), kind }); foot.rotation.y = seatRot; g.add(foot);
  const top = foot.userData.top;
  const sada = cyl(Math.min(W * 0.06, 0.35), s0 * 0.22, 'stainless', { seg: 24 }); sada.position.y = top; g.add(sada);
  g.add(ringXZ(Math.min(W * 0.06, 0.35) * 1.02, Math.min(W * 0.012, 0.05), 'gold', top + s0 * 0.11));
  const yoke = trussMesh({ lengthM: s0 * 0.48, widthM: bw, bays: 2, kind }); yoke.position.y = top + s0 * 0.22; g.add(yoke);
  const gimbal = tor(Math.min(W * 0.1, 0.6), Math.min(W * 0.02, 0.1), 'chrome'); put(gimbal, 0, top + s0 * 0.74, 0, Math.PI / 2); g.add(gimbal);
  /* the gimbal's trunnion: a short drum that joins the yoke head to the gimbal ring */
  g.add(put(cyl(bw * 0.5, s0 * 0.08, 'dark', { seg: 12 }), 0, top + s0 * 0.68, 0));
  const boxg = box(W * 0.32, s0 * 0.26, Math.max(0.5, Math.min(1.1, W * 0.1)), kind); put(boxg, 0, top + s0 * 0.87, 0); boxg.userData.seated = true; g.add(boxg);
  return { group: g, tip: s0 };
}

/** A spherical COPV cluster: n spheres in a row, each in its cradle on a common saddle, with the manifold between them. Surface frame, along x. */
export function copvClusterMesh({ d, count = 4, pitch = null, kind = 'chrome', r = null, maxSpan = Infinity, rows = 1 }) {
  const g = new THREE.Group(), br = d / 2, cols = Math.ceil(count / rows);
  const step = Math.min(pitch ?? d * 1.15, cols > 1 ? Math.max(d * 1.02, (maxSpan - d * 1.6) / (cols - 1)) : d), span = (cols - 1) * step + d * 1.6;
  const rowPitch = d * 1.15;
  const saddle = saddleMesh({ r, w: (rows - 1) * rowPitch + d * 1.7, l: span, kind: 'grey' }); g.add(saddle);
  const top = saddle.userData.top;
  let cY = top + br;
  for (let i = 0; i < count; i += 1) { const c = cradledSphere({ r: null, ballR: br, kind }); c.position.set((Math.floor(i / cols) - (rows - 1) / 2) * rowPitch, top, ((i % cols) - (cols - 1) / 2) * step); g.add(c); cY = top + c.userData.centreY; }
  const man = cyl(Math.max(br * 0.06, 0.012), (cols - 1) * step + br, 'grey', { seg: 10 }); man.geometry.translate(0, -((cols - 1) * step + br) / 2, 0); man.geometry.rotateX(Math.PI / 2); man.position.set(-(rows - 1) * rowPitch / 2 - br * 0.98, cY, 0); g.add(man);
  g.userData.centreY = cY; g.userData.top = top;
  return g;
}

/** A conformal panel: a shell sector at radius r (axis +y) from angle a0 over `arc`, height h, in `kind` --
 *  a body-mounted radiator, a magazine door, a garage door, a solar strip. Sits on the skin everywhere. */
export function shellPanel({ r, h, a0, arc, y = 0, kind, t = null, seg = null }) {
  const geo = new THREE.CylinderGeometry(r, r, h, seg ?? Math.max(6, Math.round(arc * 12)), 1, true, a0, arc);
  geo.translate(0, h / 2 + y, 0);
  const m = new THREE.Mesh(geo, surface(kind, { repeat: [Math.max(1, Math.round((arc * r) / 1.6)), Math.max(1, Math.round(h / 1.6))] }));
  m.userData.seated = true;
  if (t) { const back = new THREE.Mesh(new THREE.CylinderGeometry(r - t, r - t, h, geo.parameters.radialSegments, 1, true, a0, arc).translate(0, h / 2 + y, 0), surface('dark', { repeat: [1, 1] })); back.userData.seated = true; const g = new THREE.Group(); g.add(m, back); return g; }
  return m;
}

export { ogiveProfile, haackProfile, domeProfile };
