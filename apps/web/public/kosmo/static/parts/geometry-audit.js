/* geometry-audit.js -- does every Centauri ship fit together?

   The solver places parts from mates and never checks what it placed. This module reads the solved
   assembly of any ship in any version (v1 sail, v2 ring, v3 drive, v4 realism, v5 robotic) and asks
   the questions an integration review asks of a layout:

     interpenetration  do two bodies that are not mated share volume? Bodies are analytic: a cylinder
                       for every solid part, a TRUE torus for every ring (a box around a 112 m ring is
                       all hole), a swept disc for the bola, and an oriented box for every panel of
                       every array and radiator at several deployment fractions and sun-tracking
                       rolls, so a wing that crosses a module half-way through its unfold is caught.
                       Each body's surface is sampled and pushed through the other body's signed
                       distance; the penetration depth is the deepest sample.
     ring              is every torus coaxial with the thrust axis and centred on it; does everything
                       inside the ring plane clear its inner wall by a stated margin, and everything
                       outside clear the outer wall; do the deployables clear the ring's swept torus
                       at every pose.
     mates             every mate's two ports coincide in position with anti-parallel normals, and
                       every hardpoint stands on its part's surface (a hinge 0.4 m inside a hull is
                       a boom rooted in the crew's living room).
     floating          every body has a mate path to the root (the solver's own check) and sits
                       against its parent within a tolerance.
     scale             nothing is a slab both wider and longer than a real deployable has ever been,
                       no pressurised module is thinner than a person can stand in, every crewed ring
                       tube holds a deck.

   Pure functions over the solver output; no DOM, no three. The mesh side (does every builder return
   geometry, is its bounding box the part's envelope) lives in centauri-geometry-audit.test.mjs,
   which imports the vendored three.js. The findings are the input to CENTAURI-QA.md. */

import { measure, CLASSES, VARIANTS, PROPELLED, REALISM } from './fleet.js';
import { measureRobotic, V5_IDS } from './robotic.js';
import { accordionAngles } from './origami.js';

/* ------------------------------------------------------------------ *
 * Vector and quaternion helpers (the solver's own conventions)
 * ------------------------------------------------------------------ */

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return mul(a, 1 / l); };
function rotate(q, v) { const qv = [q[0], q[1], q[2]]; const t = mul(cross(qv, v), 2); return add(add(v, mul(t, q[3])), cross(qv, t)); }
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
const toWorld = (f, p) => add(f.position, rotate(f.quaternion, p));
const toLocal = (f, p) => rotate(conj(f.quaternion), sub(p, f.position));
const axisAngle = (axis, a) => { const u = unit(axis), s = Math.sin(a / 2); return [u[0] * s, u[1] * s, u[2] * s, Math.cos(a / 2)]; };

/* ------------------------------------------------------------------ *
 * Shapes: signed distance and surface samples, in the part's local frame
 * ------------------------------------------------------------------ */

function sdfCyl(s, p) {
  const dr = Math.hypot(p[0], p[2]) - s.r, dy = Math.max(s.y0 - p[1], p[1] - s.y1);
  return dr <= 0 && dy <= 0 ? Math.max(dr, dy) : Math.hypot(Math.max(dr, 0), Math.max(dy, 0));
}
function sdfTorus(s, p) { return Math.hypot(Math.hypot(p[0], p[2]) - s.R, p[1]) - s.tube; }
/* Annulus (a flat ring): the volume a bola's pods or spokes sweep. */
function sdfAnnulus(s, p) {
  const r = Math.hypot(p[0], p[2]);
  const dr = Math.max(r - s.rOut, s.rIn - r), dy = Math.max(s.y0 - p[1], p[1] - s.y1);
  return dr <= 0 && dy <= 0 ? Math.max(dr, dy) : Math.hypot(Math.max(dr, 0), Math.max(dy, 0));
}
/* Oriented box: centre c, unit axes ax (rows), half extents h. */
function sdfObb(s, p) {
  const d = sub(p, s.c);
  const q = [Math.abs(dot(d, s.ax[0])) - s.h[0], Math.abs(dot(d, s.ax[1])) - s.h[1], Math.abs(dot(d, s.ax[2])) - s.h[2]];
  const outside = Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0));
  return outside + Math.min(Math.max(q[0], q[1], q[2]), 0);
}
export function sdf(shape, p) {
  if (shape.type === 'cyl') return sdfCyl(shape, p);
  if (shape.type === 'torus') return sdfTorus(shape, p);
  if (shape.type === 'annulus') return sdfAnnulus(shape, p);
  return sdfObb(shape, p);
}
function samplesAnnulus(s, n) {
  const out = [], around = Math.max(16, Math.round(n / 8));
  for (const r of [s.rIn, s.rOut]) for (const y of [s.y0, (s.y0 + s.y1) / 2, s.y1]) for (let k = 0; k < around; k += 1) { const a = (k / around) * Math.PI * 2; out.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const rMid = (s.rIn + s.rOut) / 2;
  for (const y of [s.y0, s.y1]) for (let k = 0; k < around; k += 1) { const a = (k / around) * Math.PI * 2; out.push([Math.cos(a) * rMid, y, Math.sin(a) * rMid]); }
  return out;
}

function samplesCyl(s, n) {
  const out = [], rings = Math.max(3, Math.round(Math.sqrt(n) * 0.8)), around = Math.max(8, Math.round(n / rings));
  const L = s.y1 - s.y0;
  for (let i = 0; i <= rings; i += 1) {
    const y = s.y0 + (L * i) / rings;
    for (let k = 0; k < around; k += 1) { const a = (k / around) * Math.PI * 2; out.push([Math.cos(a) * s.r, y, Math.sin(a) * s.r]); }
  }
  /* caps: two radii plus the axis points */
  for (const y of [s.y0, s.y1]) { out.push([0, y, 0]); for (const f of [0.5]) for (let k = 0; k < around; k += 2) { const a = (k / around) * Math.PI * 2; out.push([Math.cos(a) * s.r * f, y, Math.sin(a) * s.r * f]); } }
  return out;
}
function samplesTorus(s, n) {
  const out = [], around = Math.max(24, Math.round(Math.sqrt(n) * 2)), tube = Math.max(8, Math.round(n / around));
  for (let i = 0; i < around; i += 1) {
    const a = (i / around) * Math.PI * 2;
    for (let k = 0; k < tube; k += 1) { const b = (k / tube) * Math.PI * 2; const r = s.R + Math.cos(b) * s.tube; out.push([Math.cos(a) * r, Math.sin(b) * s.tube, Math.sin(a) * r]); }
  }
  return out;
}
function samplesObb(s, n) {
  const out = [], g = Math.max(2, Math.round(Math.sqrt(n / 6)));
  const at = (u, v, w) => add(s.c, add(add(mul(s.ax[0], u * s.h[0]), mul(s.ax[1], v * s.h[1])), mul(s.ax[2], w * s.h[2])));
  for (let i = 0; i <= g; i += 1) for (let k = 0; k <= g; k += 1) {
    const u = -1 + (2 * i) / g, v = -1 + (2 * k) / g;
    out.push(at(u, v, 1), at(u, v, -1), at(u, 1, v), at(u, -1, v), at(1, u, v), at(-1, u, v));
  }
  return out;
}
export function samples(shape, n = 240) {
  if (shape.type === 'cyl') return samplesCyl(shape, n);
  if (shape.type === 'torus') return samplesTorus(shape, n);
  if (shape.type === 'annulus') return samplesAnnulus(shape, n);
  return samplesObb(shape, n);
}

function smallestOf(shape) {
  if (shape.type === 'cyl') return Math.min(2 * shape.r, shape.y1 - shape.y0);
  if (shape.type === 'torus') return 2 * shape.tube;
  if (shape.type === 'annulus') return Math.min(shape.rOut - shape.rIn, shape.y1 - shape.y0);
  return 2 * Math.min(...shape.h);
}

/* ------------------------------------------------------------------ *
 * Bodies from parts
 * ------------------------------------------------------------------ */

/* Kinds whose envelope is open structure, not a solid: no interpenetration test, no floating test. */
const OPEN = new Set(['rail-network', 'landing-gear', 'grid-fins', 'sail']);
/* Kinds that spin: the body is the swept volume, and nothing may enter it at any angle. */
const RINGS = new Set(['centrifuge', 'habitat-ring', 'torpor-ring']);
const PRESSURISED = (p) => (p.volume?.pressurised ?? 0) > 0 || p.crew > 0;

/** The deployed plate(s) of an array or radiator, as oriented boxes in the part frame, for a fold
 *  fraction k (1 flat, 0 packed) and a roll about the root axis. The strip is `segments` panels hinged
 *  end to end, folded by the accordion law the viewer animates; a v4 radiator part carries `panels`
 *  strips side by side. */
export function deployablePlates(p, k = 1, roll = 0, segments = 8) {
  const L = p.dims.l, rad = p.radiator, standoff = p.standoff ?? 0;
  const strips = rad?.panels != null ? rad.panels : 1;
  const W = rad?.panelW != null ? rad.panelW : p.dims.d;
  const pitch = W * 1.05, t = Math.max(0.05, W * 0.01);
  const angles = accordionAngles(k, segments), segL = L / segments;
  const out = [];
  const qRoll = axisAngle([0, 1, 0], roll);
  for (let s = 0; s < strips; s += 1) {
    const x0 = (s - (strips - 1) / 2) * pitch;
    /* chain the hinges: each pivot sits at the end of the previous panel and turns about local x; the
       first panel starts at the standoff (yoke, SADA or manifold), not at the hardpoint itself */
    let pos = [x0, standoff, 0], q = [0, 0, 0, 1];
    for (let i = 0; i < segments; i += 1) {
      if (i > 0) pos = add(pos, rotate(q, [0, segL, 0]));
      q = quatMul(q, axisAngle([1, 0, 0], angles[i]));
      const c = add(pos, rotate(q, [0, segL / 2, 0]));
      const ax = [rotate(q, [1, 0, 0]), rotate(q, [0, 1, 0]), rotate(q, [0, 0, 1])];
      out.push({ type: 'obb', c: rotate(qRoll, c), ax: ax.map((a) => rotate(qRoll, a)), h: [W / 2, segL / 2, t / 2], k, roll, strip: s, segment: i });
    }
  }
  return out;
}
function quatMul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
}

export const DEPLOY_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];
export const ROLL_ANGLES = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

/* Kinds drawn as a hull segment: barrel with end cones that narrow to 0.55 r over endH (primitives/mesh.js). */
const HULL_SEGMENTS = new Set(['pressurised-module', 'stores-module', 'node', 'cargo', 'systems-module', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault']);

/** A barrel with two end cones, as three cylinders: the cone is taken at its mean radius. */
function hullSegmentShapes(r, l, endH, scale = 1) {
  const rr = r * scale, e = Math.min(endH, l / 2), barrel = Math.max(0, l - 2 * e), rc = rr * 0.775;
  const out = [{ type: 'cyl', r: rr, y0: e, y1: e + barrel }];
  if (e > 0) out.push({ type: 'cyl', r: rc, y0: 0, y1: e }, { type: 'cyl', r: rc, y0: l - e, y1: l });
  return out;
}

/** The static body (or bodies) a placed part occupies, in its own frame. */
export function shapesOf(part) {
  const p = part, d = p.dims?.d ?? 0, l = p.dims?.l ?? 0, r = Math.max(d / 2, 1e-4);
  if (OPEN.has(p.kind)) return [];
  if (RINGS.has(p.kind)) {
    const tube = l / 2, R = p.ring?.R ?? (d - l) / 2;
    return [{ type: 'torus', R, tube }];
  }
  if (p.kind === 'spin-bola' && p.bola) {
    /* what the bola sweeps as it turns: the pods' annulus, the spokes' annulus, the hub drum */
    const b = p.bola, podR0 = b.R - b.pod.dims.l / 2, podR1 = b.R + b.pod.dims.l / 2, hw = b.truss.widthM / 2;
    return [
      { type: 'annulus', rIn: podR0, rOut: podR1, y0: -b.pod.dims.d / 2, y1: b.pod.dims.d / 2, swept: true },
      { type: 'annulus', rIn: 2.2, rOut: podR0, y0: -hw, y1: hw, swept: true },
      { type: 'cyl', r: 2.2, y0: -0.5, y1: 0.5, swept: true }
    ];
  }
  if (p.kind === 'solar-array' || p.kind === 'radiator') return deployablePlates(p, 1, 0);
  if (HULL_SEGMENTS.has(p.kind)) return hullSegmentShapes(r, l, Math.min(0.65, l * 0.1));
  if (p.kind === 'despin-hub') return hullSegmentShapes(r, l, Math.min(0.65, l * 0.1));
  if (p.kind === 'airlock') return [...hullSegmentShapes(r, l * 0.6, Math.min(0.65, l * 0.06)), { type: 'cyl', r: r * 0.6, y0: l * 0.58, y1: l }];
  if (p.kind === 'crew-capsule') return [{ type: 'cyl', r, y0: 0, y1: 0.14 * l }, { type: 'cyl', r: r * 0.75, y0: 0.14 * l, y1: 0.68 * l }, { type: 'cyl', r: r * 0.5, y0: 0.68 * l, y1: l }];
  if (p.kind === 'lander-aero') return [{ type: 'cyl', r, y0: 0, y1: l - 2.4 }, { type: 'cyl', r: r * 0.7, y0: l - 2.4, y1: l }];
  if (p.kind === 'trim-stage' && p.stage) {
    const tankL = Math.min(p.stage.tank.dims.l, l);
    return [{ type: 'cyl', r, y0: l - tankL, y1: l }, { type: 'cyl', r: r * 0.7, y0: 0, y1: l - tankL }];
  }
  if (p.kind === 'drive' && p.store) {
    /* frame cone, store, engine bay, pusher plate: the plate is wide and thin, the frame narrow */
    const frameL = Math.max(p.frame?.l ?? 0, 0), bayL = Math.max(p.bayL ?? 0, 0), L = Math.max(l, 0.05);
    const rS = Math.max(p.store.d / 2, 0.02), storeL = Math.max(Math.min(p.store.l || L, L - frameL - bayL), 0.04);
    const out = [];
    if (frameL > 0.01) out.push({ type: 'cyl', r: rS * 0.6, y0: 0, y1: frameL });
    out.push({ type: 'cyl', r: rS, y0: frameL, y1: frameL + storeL });
    if (p.store.kind === 'magazine') { const plateT = Math.max(d * 0.025, 0.02); out.push({ type: 'cyl', r: Math.max((p.plateD ?? d) / 2, rS), y0: L - plateT, y1: L }); out.push({ type: 'cyl', r: rS * 0.5, y0: frameL + storeL, y1: L - plateT }); }
    else out.push({ type: 'cyl', r: rS * 0.94, y0: frameL + storeL, y1: L });
    return out;
  }
  if (p.kind === 'reactor' || p.kind === 'reactor-fsp') {
    const out = [{ type: 'cyl', r: r * 0.95, y0: 0, y1: 0.54 * l }];
    const rad = p.reactor?.radiator;
    const wingL = rad ? rad.panelL : l * 0.5, wingW = rad ? rad.panelW * rad.perSide : r * 1.4;
    for (const s of [-1, 1]) out.push({ type: 'obb', c: [0, 0.66 * l, s * (r * 0.5 + wingW / 2)], ax: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h: [wingL / 2, Math.max(wingL * 0.006, 0.025), wingW / 2] });
    return out;
  }
  const y0 = p.origin === 'centre' ? -l / 2 : 0;
  return [{ type: 'cyl', r, y0, y1: y0 + Math.max(l, 1e-4) }];
}

/** Every body of a solved ship, with its world frame and the node it came from. */
export function bodiesOf(solved) {
  const out = [];
  for (const n of solved.nodes) {
    const p = n.part;
    const shapes = shapesOf(p);
    shapes.forEach((shape, i) => out.push({ name: n.name, kind: p.kind, node: n, shape, frame: n.world, pressurised: PRESSURISED(p), index: i, deployable: p.kind === 'solar-array' || p.kind === 'radiator' }));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The checks
 * ------------------------------------------------------------------ */

/** Penetration of body A into body B: the deepest of A's surface samples inside B (0 if none), with the
 *  point where it happens. Symmetric callers test both ways. */
export function penetration(A, B, n = 240) {
  let worst = 0, at = null;
  for (const s of samples(A.shape, n)) {
    const pw = toWorld(A.frame, s);
    const d = sdf(B.shape, toLocal(B.frame, pw));
    if (-d > worst) { worst = -d; at = pw; }
  }
  return { depth: worst, at };
}

const mateKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Audit one ship. Returns { id, version, bodies, findings }. A finding is
 * { severity: 'error'|'warn', code, parts: [names], message, value }.
 */
export function auditSolved(id, m, opts = {}) {
  const findings = [];
  const push = (severity, code, parts, message, value = null) => findings.push({ severity, code, parts, message, value });
  const solved = m.solved, nodes = solved.nodes;
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const bodies = bodiesOf(solved);
  const mated = new Set(solved.mates.map((mt) => mateKey(mt.a.name, mt.b.name)));
  /* a child on an `interior` port (a cradle, a dock, a fab cell) lives inside its parent by design */
  const portOf = (n, id) => n.part.ports.find((q) => q.id === id);
  const interior = new Set(solved.mates.filter((mt) => portOf(byName.get(mt.a.name), mt.a.port)?.interior || portOf(byName.get(mt.b.name), mt.b.port)?.interior).map((mt) => mateKey(mt.a.name, mt.b.name)));
  const insideNames = new Set(nodes.filter((n) => n.parent && interior.has(mateKey(n.name, n.parent))).map((n) => n.name));
  const tolFor = (A, B) => Math.max(0.02, 0.01 * Math.min(smallestOf(A.shape), smallestOf(B.shape)));

  /* (a) interpenetration between bodies that are not mated; mated pairs may touch but not nest */
  const solids = bodies.filter((b) => !(b.deployable && b.shape.k !== undefined && b.shape.k < 1));
  const reported = new Set();
  for (let i = 0; i < solids.length; i += 1) for (let j = i + 1; j < solids.length; j += 1) {
    const A = solids[i], B = solids[j];
    if (A.name === B.name) continue;
    const key = mateKey(A.name, B.name);
    if (reported.has(key) || interior.has(key)) continue;
    /* two fixtures inside the same container (robots in cradles) still may not share volume; a fixture
       and an unrelated outside body are tested as usual */
    const isMated = mated.has(key);
    const pAB = penetration(A, B), pBA = penetration(B, A);
    const depth = Math.max(pAB.depth, pBA.depth);
    const tol = tolFor(A, B);
    if (isMated) {
      /* a mated child may seat against its parent; it may not sit inside it */
      const allow = Math.max(0.3, 0.12 * Math.min(smallestOf(A.shape), smallestOf(B.shape)));
      if (depth > allow) { reported.add(key); push('warn', 'mated-overlap', [A.name, B.name], `${A.name} (${A.kind}) sits ${depth.toFixed(2)} m inside its mate ${B.name} (${B.kind})`, depth); }
    } else if (depth > tol) {
      reported.add(key);
      push('error', 'interpenetration', [A.name, B.name], `${A.name} (${A.kind}) and ${B.name} (${B.kind}) share volume: ${depth.toFixed(2)} m deep at [${(pAB.depth >= pBA.depth ? pAB.at : pBA.at).map((v) => v.toFixed(1)).join(', ')}]`, depth);
    }
  }

  /* (d) deployables: every panel at every fold fraction and roll must clear every pressurised body and every ring */
  const targets = bodies.filter((b) => (b.pressurised || RINGS.has(b.kind) || b.shape.swept) && !b.deployable);
  for (const n of nodes.filter((x) => x.part.kind === 'solar-array' || x.part.kind === 'radiator')) {
    const rolls = n.part.kind === 'solar-array' ? ROLL_ANGLES : [0];
    let worst = null;
    for (const k of DEPLOY_FRACTIONS) for (const roll of rolls) for (const plate of deployablePlates(n.part, k, roll)) {
      const A = { name: n.name, kind: n.part.kind, shape: plate, frame: n.world };
      for (const T of targets) {
        if (T.name === n.name || mated.has(mateKey(n.name, T.name)) && k === 1 && false) continue;
        const pen = Math.max(penetration(A, T, 96).depth, penetration(T, A, 96).depth);
        if (pen > 0.05 && (!worst || pen > worst.pen)) worst = { pen, k, roll, target: T.name, tkind: T.kind };
      }
    }
    if (worst) push('error', 'deployable-sweep', [n.name, worst.target], `${n.name} (${n.part.kind}) crosses ${worst.target} (${worst.tkind}) by ${worst.pen.toFixed(2)} m at fold ${worst.k}, roll ${Math.round((worst.roll * 180) / Math.PI)} deg`, worst.pen);
  }

  /* (b) rings: coaxial, centred, and clear inside and out */
  for (const T of bodies.filter((b) => b.shape.type === 'torus')) {
    const axis = rotate(T.frame.quaternion, [0, 1, 0]);
    const tilt = Math.acos(Math.min(1, Math.abs(axis[1]))) * (180 / Math.PI);
    if (tilt > 0.5) push('error', 'ring-tilt', [T.name], `${T.name} ring axis is ${tilt.toFixed(1)} deg off the thrust axis`, tilt);
    const off = Math.hypot(T.frame.position[0], T.frame.position[2]);
    if (off > 0.05) push('error', 'ring-offset', [T.name], `${T.name} ring centre is ${off.toFixed(2)} m off the thrust axis`, off);
    const { R, tube } = T.shape, inner = R - tube, outer = R + tube, margin = Math.max(1, 0.02 * R);
    for (const B of bodies) {
      if (B.name === T.name) continue;
      let lo = Infinity, hi = -Infinity, inBand = false;
      const shapesToTest = B.deployable ? [B.shape] : [B.shape];
      for (const s of shapesToTest) for (const pt of samples(s, 200)) {
        const q = toLocal(T.frame, toWorld(B.frame, pt));
        if (Math.abs(q[1]) <= tube + margin) { inBand = true; const r = Math.hypot(q[0], q[2]); lo = Math.min(lo, r); hi = Math.max(hi, r); }
      }
      if (!inBand) continue;
      /* a body mated to the ring itself (a rim-mounted wing) stands on the tube: no margin at its own mount */
      const own = mated.has(mateKey(T.name, B.name)) ? 0 : margin;
      const clearInside = hi <= inner - own, clearOutside = lo >= outer + own;
      if (!clearInside && !clearOutside) push('error', 'ring-clearance', [T.name, B.name], `${B.name} (${B.kind}) reaches radius ${lo.toFixed(1)}-${hi.toFixed(1)} m in the plane of ${T.name}, whose tube spans ${inner.toFixed(1)}-${outer.toFixed(1)} m (margin ${margin.toFixed(1)} m)`, Math.max(0, hi - (inner - margin)));
    }
  }

  /* (c) mates: ports coincide, normals oppose, hardpoints stand on their part's surface */
  for (const mt of solved.mates) {
    const A = byName.get(mt.a.name), B = byName.get(mt.b.name);
    const pa = A.part.ports.find((q) => q.id === mt.a.port), pb = B.part.ports.find((q) => q.id === mt.b.port);
    const wa = toWorld(A.world, pa.at), wb = toWorld(B.world, pb.at);
    const na = unit(rotate(A.world.quaternion, pa.axis)), nb = unit(rotate(B.world.quaternion, pb.axis));
    const gap = len(sub(wa, wb)), align = dot(na, nb);
    if (gap > 1e-6) push('error', 'mate-gap', [A.name, B.name], `${mt.a.name}.${mt.a.port} and ${mt.b.name}.${mt.b.port} are ${gap.toExponential(2)} m apart`, gap);
    if (align > -0.999999) push('error', 'mate-normal', [A.name, B.name], `${mt.a.name}.${mt.a.port} and ${mt.b.name}.${mt.b.port} normals are not opposed (dot ${align.toFixed(4)})`, align);
    if (pa.interior || pb.interior) continue;
    /* legs and fins wrap a body and root on its axis by convention; the hub of a ring is its spoke centre */
    if (OPEN.has(A.part.kind) || OPEN.has(B.part.kind)) continue;
    const partnerSpins = RINGS.has(A.part.kind) || RINGS.has(B.part.kind) || A.part.kind === 'spin-bola' || B.part.kind === 'spin-bola';
    for (const [N, P, port] of [[A, pa, mt.a], [B, pb, mt.b]]) {
      const own = bodiesOf({ nodes: [N] }).filter((b) => !b.deployable);
      if (!own.length || RINGS.has(N.part.kind) || N.part.kind === 'spin-bola') continue;
      /* a bearing's hub port is the spin axis at the drum's mid-plane: inside the drum by design */
      if (partnerSpins && /^(hub|hub-aft|spinhub|fore)$/.test(P.id)) continue;
      let d = Infinity;
      for (const b of own) d = Math.min(d, sdf(b.shape, P.at));
      const allow = 0.05 + 0.02 * smallestOf(own[0].shape);
      if (d < -allow) push('error', 'hardpoint-buried', [N.name], `${port.name}.${port.port} is ${(-d).toFixed(2)} m inside ${N.name}'s hull (a hinge rooted in the pressure shell)`, -d);
      if (d > allow + 0.3 && !/^(hub|hub-aft|spinhub|root|railhub)$/.test(P.id)) push('warn', 'hardpoint-floating', [N.name], `${port.name}.${port.port} stands ${d.toFixed(2)} m off ${N.name}'s surface`, d);
    }
  }

  /* (e) floating: everything placed, and every solid child seats against its parent */
  for (const e of solved.errors) push('error', `solver-${e.code}`, [], e.message);
  for (const B of bodies.filter((b) => !b.deployable && b.node.parent && b.index === 0)) {
    const P = byName.get(B.node.parent);
    const parentBodies = bodiesOf({ nodes: [P] }).filter((b) => !b.deployable);
    if (!parentBodies.length || RINGS.has(B.kind) || B.kind === 'spin-bola' || insideNames.has(B.name)) continue;
    let best = Infinity;
    const ownBodies = bodies.filter((b) => b.name === B.name && !b.deployable);
    for (const ob of ownBodies) for (const pb of parentBodies) for (const s of samples(ob.shape, 160)) best = Math.min(best, sdf(pb.shape, toLocal(pb.frame, toWorld(ob.frame, s))));
    const allow = 0.05 + 0.03 * Math.max(smallestOf(B.shape), 1);
    if (best > allow && !RINGS.has(P.part.kind) && P.part.kind !== 'spin-bola' && P.part.kind !== 'rail-network') push('error', 'floating', [B.name, P.name], `${B.name} (${B.kind}) floats ${best.toFixed(2)} m clear of its parent ${P.name}`, best);
  }

  /* (g) scale sanity */
  for (const n of nodes) {
    const p = n.part, d = p.dims?.d ?? 0, l = p.dims?.l ?? 0;
    if (p.kind === 'solar-array' || p.kind === 'radiator') {
      const W = p.radiator?.panelW != null ? p.radiator.panelW * p.radiator.panels * 1.05 : d;
      if (W > 40 && l > 60) push('error', 'giant-slab', [n.name], `${n.name} (${p.kind}) is a ${l.toFixed(0)} x ${W.toFixed(0)} m slab; the largest flown deployable is 34 x 11 m, so this needs to be panels along a spine`, W);
      else if (W > 40 || l > 120) push('warn', 'oversize-deployable', [n.name], `${n.name} (${p.kind}) is ${l.toFixed(0)} x ${W.toFixed(0)} m`, Math.max(W, l));
    }
    if (PRESSURISED(p) && !RINGS.has(p.kind) && p.kind !== 'spin-bola' && p.kind !== 'payload') {
      if (d < 2.0) push('error', 'module-too-thin', [n.name], `${n.name} (${p.kind}) is ${d.toFixed(2)} m across: a person cannot stand in it`, d);
      if (d > 12) push('warn', 'module-too-fat', [n.name], `${n.name} (${p.kind}) is ${d.toFixed(1)} m across`, d);
    }
    if (RINGS.has(p.kind) && (p.crew > 0 || p.volume?.habitable > 0) && l < 3) push('error', 'ring-tube-thin', [n.name], `${n.name} tube is ${l.toFixed(1)} m: no deck fits`, l);
  }

  return { id, version: opts.version ?? versionOf(id), bodies, findings, nodes: nodes.length };
}

export function versionOf(id) {
  if (V5_IDS.includes(id)) return 'v5';
  if (REALISM.some((c) => c.id === id)) return 'v4';
  if (PROPELLED.some((c) => c.id === id)) return 'v3';
  if (VARIANTS.some((c) => c.id === id)) return 'v2';
  return 'v1';
}

export const SHIP_IDS = {
  v1: CLASSES.map((c) => c.id), v2: VARIANTS.map((c) => c.id), v3: PROPELLED.map((c) => c.id), v4: REALISM.map((c) => c.id), v5: [...V5_IDS]
};
export const ALL_SHIP_IDS = Object.values(SHIP_IDS).flat();

export function measureAny(id) { return V5_IDS.includes(id) ? measureRobotic(id) : measure(id); }

export function auditShip(id) { return auditSolved(id, measureAny(id)); }

/** Every ship in every version. Returns { ships: [...audits], summary: { byCode, byShip, errors, warns } }. */
export function auditFleet(ids = ALL_SHIP_IDS) {
  const ships = ids.map((id) => auditShip(id));
  const byCode = {}, byShip = {};
  let errors = 0, warns = 0;
  for (const s of ships) {
    byShip[s.id] = { errors: s.findings.filter((f) => f.severity === 'error').length, warns: s.findings.filter((f) => f.severity === 'warn').length };
    for (const f of s.findings) { byCode[f.code] = (byCode[f.code] ?? 0) + 1; if (f.severity === 'error') errors += 1; else warns += 1; }
  }
  return { ships, summary: { byCode, byShip, errors, warns } };
}

/** A markdown table of the findings, for CENTAURI-QA.md. */
export function reportMarkdown(audit) {
  const lines = ['| Ship | Version | Severity | Code | Parts | Finding |', '|---|---|---|---|---|---|'];
  for (const s of audit.ships) for (const f of s.findings) lines.push(`| ${s.id} | ${s.version} | ${f.severity} | ${f.code} | ${f.parts.join(', ')} | ${f.message.replace(/\|/g, '/')} |`);
  return lines.join('\n');
}
