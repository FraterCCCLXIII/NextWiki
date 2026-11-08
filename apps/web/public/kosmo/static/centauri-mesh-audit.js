/* centauri-mesh-audit.js -- is everything that is drawn attached to something?

   parts/geometry-audit.js asks whether the PARTS fit together: analytic bodies from the solver's
   output, no three. This module asks the question one level down, of the meshes the builders draw
   inside each part: the racks, tanks, pallets, boxes, rings, brackets and rods that give a hull its
   equipment. The attachment review (CENTAURI-ATTACH.md) found blocks hovering off hulls with a dark
   slit under them, flat boxes tangent to a cylinder, and fittings poking through neighbouring parts;
   this is the check that keeps them out.

     fitting-floating   a mesh inside a part's frame touches neither the part's analytic body nor any
                        mesh that does (transitively: a strut on a bracket on the hull is attached);
                        the gap is reported
     underside-gap      a flat-bottomed box seated on a curved body touches it along a line only: its
                        inner-face corners stand off the skin by more than the slit tolerance (the dark
                        gap under a tangent block); it needs a saddle, a cradle or to be embedded
     fitting-poke       a mesh of one part reaches inside the analytic body of ANOTHER part (an antenna
                        through a module, a rack through a tank), beyond what a mated pair may overlap
     part-unseated      a non-root part whose own meshes never come within tolerance of its parent's
                        body: the mount it was drawn with does not reach what it is mounted on

   Attachment is tested as geometry: each mesh is sampled at its vertices (subsampled) and pushed
   through the signed distance of the analytic bodies and the oriented boxes of the already-attached
   meshes, growing the attached set to a fixed point. Instanced meshes with few instances (windows,
   legs, port bolts) are expanded; dense instancing (truss members, rivets) is skipped as neither
   anchor nor candidate. The human-scale detail layer (userData.detail) and the sail film are not
   audited here: the detail pass places on surfaces by construction, and the film is held by lines.

   Imports three. Node runs it through three-node-resolver.mjs (centauri-geometry-audit.test.mjs);
   the lab can run it on the model it shows. */

import * as THREE from 'three';
import { shapesOf, sdf, samples, deployablePlates } from './parts/geometry-audit.js';

/* Open frames the poke check does not treat as solids: a rail runs through an arrival kit's lattice between its crates. */
const FRAMES = new Set(['arrival-kit', 'truss', 'mast', 'thrust-collar', 'dock-adapter']);

const OPEN = new Set(['rail-network', 'landing-gear', 'grid-fins', 'sail', 'robot']);
const RINGS = new Set(['centrifuge', 'habitat-ring', 'torpor-ring']);
const DEPLOYABLE = new Set(['solar-array', 'radiator']);

const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

/** Oriented box of a mesh's geometry under `matrix` (into the frame): centre, unit axes, half extents. */
function obbOf(geometry, matrix) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (!Number.isFinite(bb.min.x)) return null;
  const c = bb.getCenter(new THREE.Vector3()).applyMatrix4(matrix);
  const half = bb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const ax = [], h = [];
  for (let i = 0; i < 3; i += 1) {
    const a = new THREE.Vector3().setFromMatrixColumn(matrix, i);
    const len = a.length() || 1e-12;
    ax.push([a.x / len, a.y / len, a.z / len]); h.push(Math.max(half.getComponent(i) * len, 1e-5));
  }
  return { type: 'obb', c: [c.x, c.y, c.z], ax, h };
}
/** Vertex samples of a geometry under `matrix`, at most `cap` of them (plus its box corners). */
function samplesOf(geometry, matrix, cap = 160) {
  const pos = geometry.attributes.position; if (!pos) return [];
  const out = [], step = Math.max(1, Math.ceil(pos.count / cap));
  for (let i = 0; i < pos.count; i += step) { _v.fromBufferAttribute(pos, i).applyMatrix4(matrix); if (Number.isFinite(_v.x)) out.push([_v.x, _v.y, _v.z]); }
  return out;
}
/** Samples over a box's six faces (a 3 x 3 grid each) plus its corners: face-to-face contact between two boxes has no
 *  shared vertex, so vertices alone would call a crate standing on a beam 'floating'. */
const boxSamples = (o) => { const out = corners(o); for (let f = 0; f < 3; f += 1) { const u = (f + 1) % 3, v = (f + 2) % 3; for (const sf of [-1, 1]) for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.push([0, 1, 2].map((k) => o.c[k] + sf * o.ax[f][k] * o.h[f] + a * o.ax[u][k] * o.h[u] + b * o.ax[v][k] * o.h[v])); } return out; };
const corners = (o) => { const out = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push([0, 1, 2].map((k) => o.c[k] + sx * o.ax[0][k] * o.h[0] + sy * o.ax[1][k] * o.h[1] + sz * o.ax[2][k] * o.h[2])); return out; };
const minSdf = (shapes, p) => { let d = Infinity; for (const s of shapes) d = Math.min(d, sdf(s, p)); return d; };
const describe = (mesh, o) => `${mesh.name || mesh.geometry.type.replace('Geometry', '')} ${o.h.map((x) => (2 * x).toFixed(2)).join('x')} m at [${o.c.map((x) => x.toFixed(2)).join(', ')}]`;

/** The analytic bodies of a part in its own frame, for the fitting checks. A deployable is its flat
 *  plates plus a stub at the hardpoint; a ring is its torus plus a collar stub round the hub. */
export function anchorsOf(part) {
  if (OPEN.has(part.kind)) return [];
  if (DEPLOYABLE.has(part.kind)) return [...deployablePlates(part, 1, 0), { type: 'cyl', r: Math.max(0.05, (part.dims?.d ?? 1) * 0.03), y0: -0.02, y1: Math.max(part.standoff ?? 0.6, 0.3) }];
  const shapes = shapesOf(part);
  if (RINGS.has(part.kind) && shapes[0]?.type === 'torus') {
    /* the collar round the bearing and the spokes are structure the ring stands on; the audit anchors them at the hub */
    const tube = shapes[0].tube, R = shapes[0].R;
    return [...shapes, { type: 'cyl', r: Math.max(R * 0.08, tube), y0: -tube, y1: tube, hubStub: true }];
  }
  return shapes;
}

/** Collect the meshes under a frame (not the detail layer, not lines, not the film), each with its
 *  OBB and vertex samples in the frame. Instanced meshes expand up to `instCap` instances. */
function collect(frame, instCap = 96) {
  frame.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const items = [];
  frame.traverse((o) => {
    if (!o.isMesh || o.userData.detail || o.userData.film || o.isLine) return;
    let hidden = false, cut = false; for (let p = o; p && p !== frame; p = p.parent) { if (p.visible === false && !p.userData.cutaway) hidden = true; if (p.userData.cutaway === 'cut') cut = true; }
    /* a cutaway variant is audited like the shell it replaces; anything hidden for another reason (a canister the mechanism draws) still is */
    const local = new THREE.Matrix4().copy(inv).multiply(o.matrixWorld);
    if (o.isInstancedMesh) {
      if (o.count > instCap) return;
      for (let i = 0; i < o.count; i += 1) {
        o.getMatrixAt(i, _m);
        const mtx = new THREE.Matrix4().copy(local).multiply(_m);
        const obb = obbOf(o.geometry, mtx); if (!obb) continue;
        items.push({ mesh: o, obb, pts: o.geometry.type === 'BoxGeometry' ? boxSamples(obb) : [...corners(obb), obb.c], box: o.geometry.type === 'BoxGeometry', hidden, cut, instance: i });
      }
      return;
    }
    const obb = obbOf(o.geometry, local); if (!obb) return;
    const pts = o.geometry.type === 'BoxGeometry' ? boxSamples(obb) : samplesOf(o.geometry, local);
    items.push({ mesh: o, obb, pts: pts.length ? pts : [...corners(obb), obb.c], box: o.geometry.type === 'BoxGeometry', hidden, cut });
  });
  return items;
}

/**
 * Audit one built model against its measured assembly. Returns { findings, counts, meshes, frames }.
 * `opts.tol(part)` and `opts.slitTol(part)` override the tolerances; `opts.sail` audits the sail stage's
 * hardware against the drum.
 */
export function auditModelMeshes(model, m, opts = {}) {
  const findings = [];
  const push = (code, part, message, value, severity = 'error') => findings.push({ severity, code, parts: [part], message, value });
  const nodes = m.solved.nodes, byName = new Map(nodes.map((n) => [n.name, n]));
  const portOf = (n, id) => n.part.ports.find((q) => q.id === id);
  const mateKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const mated = new Set(m.solved.mates.map((mt) => mateKey(mt.a.name, mt.b.name)));
  const interior = new Set(m.solved.mates.filter((mt) => portOf(byName.get(mt.a.name), mt.a.port)?.interior || portOf(byName.get(mt.b.name), mt.b.port)?.interior).map((mt) => mateKey(mt.a.name, mt.b.name)));
  const inside = new Set(nodes.filter((n) => n.parent && interior.has(mateKey(n.name, n.parent))).map((n) => n.name));
  const frames = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => { if (o.userData?.part && o.userData.partName) frames.push(o); });
  const sizeOf = (p) => Math.max(p.dims?.d ?? 0, p.dims?.l ?? 0, 0.05);
  const tolOf = opts.tol ?? ((p) => Math.max(0.02, 0.005 * sizeOf(p)));
  const slitOf = opts.slitTol ?? ((p) => Math.max(0.03, 0.01 * Math.max(p.dims?.d ?? 0, 0.05)));
  let meshCount = 0;
  const worldBodies = [];   // { name, kind, shapes (local), frame }

  for (const frame of frames) {
    const part = frame.userData.part, name = frame.userData.partName;
    const anchors = anchorsOf(part);
    const items = collect(frame);
    meshCount += items.length;
    worldBodies.push({ name, kind: part.kind, shapes: shapesOf(part), frame, items });
    if (!anchors.length || inside.has(name)) continue;
    const tol = tolOf(part), slit = slitOf(part);
    /* (1) attachment: grow the attached set from the analytic anchors. A candidate touches an anchor when one of its
       vertices is within tol of the anchor OR one of the anchor's surface samples lies within tol of the candidate's
       box (a blanket box round a gimbal, a rack that wraps its mount), so enclosure counts as contact. */
    const anchorPts = anchors.flatMap((a) => samples(a, 120));
    const touchesShapes = (it) => { let d = Infinity; for (const p of it.pts) { d = Math.min(d, minSdf(anchors, p)); if (d <= tol) return d; } for (const p of anchorPts) { d = Math.min(d, sdf(it.obb, p)); if (d <= tol) return d; } return d; };
    const touchesItems = (it, others) => { let d = Infinity; for (const o of others) { for (const p of it.pts) { d = Math.min(d, sdf(o.obb, p)); if (d <= tol) return d; } for (const p of o.pts) { d = Math.min(d, sdf(it.obb, p)); if (d <= tol) return d; } } return d; };
    const attached = new Array(items.length).fill(false), gaps = new Array(items.length).fill(Infinity);
    for (let i = 0; i < items.length; i += 1) { gaps[i] = touchesShapes(items[i]); if (gaps[i] <= tol) attached[i] = true; }
    let grew = true;
    while (grew) {
      grew = false;
      const anchorsNow = items.filter((_, i) => attached[i]);
      if (!anchorsNow.length) break;
      for (let i = 0; i < items.length; i += 1) {
        if (attached[i]) continue;
        const d = touchesItems(items[i], anchorsNow);
        gaps[i] = Math.min(gaps[i], d);
        if (d <= tol) { attached[i] = true; grew = true; }
      }
    }
    for (let i = 0; i < items.length; i += 1) {
      if (attached[i]) continue;
      const it = items[i];
      if (it.mesh.userData.tethered) continue;
      push('fitting-floating', name, `${name} (${part.kind}): ${describe(it.mesh, it.obb)} floats ${gaps[i].toFixed(3)} m clear of the part and everything attached to it`, gaps[i]);
    }
    /* (2) undersides: a box seated on a curved anchor whose inner-face corners stand off it */
    const curved = anchors.filter((s) => s.type === 'cyl' || s.type === 'torus');
    if (curved.length) for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      /* interior fittings (the cutaway's racks, decks and cradles) stand on the inner wall on their own standoffs: not this review's subject */
      if (!it.box || !attached[i] || it.mesh.userData.seated || it.cut) continue;
      const cs = corners(it.obb).map((p) => minSdf(curved, p)).sort((a, b) => a - b);
      const inner = cs.slice(0, 4);
      /* seated: the nearest corner touches or is embedded; a slit: a corner of that same face hangs off by more than the tolerance.
         A box whose nearest face is wholly inside the skin (all four inner corners negative) is embedded, which is a seat. */
      if (inner[0] <= tol && inner[3] > slit) push('underside-gap', name, `${name} (${part.kind}): ${describe(it.mesh, it.obb)} sits tangent to the skin with a ${inner[3].toFixed(3)} m gap under its corners`, inner[3]);
    }
    /* (4) the part's own mount reaches its parent */
    const parent = frame.userData.partName && byName.get(name)?.parent ? byName.get(byName.get(name).parent) : null;
    if (parent && !RINGS.has(part.kind) && !RINGS.has(parent.part.kind) && !OPEN.has(parent.part.kind) && parent.part.kind !== 'spin-bola' && part.kind !== 'spin-bola') {
      const pShapes = shapesOf(parent.part);
      if (pShapes.length) {
        const pf = frames.find((f) => f.userData.partName === parent.name);
        if (pf) {
          const toParent = new THREE.Matrix4().copy(pf.matrixWorld).invert().multiply(frame.matrixWorld);
          let best = Infinity;
          for (const it of items) for (const p of it.pts) { _p.fromArray(p).applyMatrix4(toParent); best = Math.min(best, minSdf(pShapes, [_p.x, _p.y, _p.z])); if (best <= tol) break; }
          const allow = Math.max(0.05, 0.01 * sizeOf(part), tol);
          if (best > allow) push('part-unseated', name, `${name} (${part.kind}) is drawn ${best.toFixed(2)} m clear of its parent ${parent.name} (${parent.part.kind}): its mount does not reach`, best);
          /* a flat foot on the parent's curved skin: the same slit test, in the parent's frame */
          const pCurved = pShapes.filter((s) => s.type === 'cyl' || s.type === 'torus');
          if (pCurved.length && !DEPLOYABLE.has(parent.part.kind)) for (const it of items) {
            if (!it.box || it.mesh.userData.seated || it.cut) continue;
            /* only a box that actually stands on the skin: its centre within its own thickness of the parent's surface */
            _p.fromArray(it.obb.c).applyMatrix4(toParent);
            if (minSdf(pCurved, [_p.x, _p.y, _p.z]) > Math.min(...it.obb.h) * 1.5 + slitOf(parent.part)) continue;
            const cs = corners(it.obb).map((p) => { _p.fromArray(p).applyMatrix4(toParent); return minSdf(pCurved, [_p.x, _p.y, _p.z]); }).sort((a, b) => a - b);
            const pSlit = slitOf(parent.part);
            if (cs[0] <= tol && cs[3] > pSlit) push('underside-gap', name, `${name} (${part.kind}): ${describe(it.mesh, it.obb)} stands on ${parent.name}'s curved skin with a ${cs[3].toFixed(3)} m gap under its corners`, cs[3]);
          }
        }
      }
    }
  }
  /* (3) pokes: a mesh of one part inside another part's body */
  for (const A of worldBodies) {
    if (inside.has(A.name)) continue;
    for (const B of worldBodies) {
      if (A === B || !B.shapes.length || inside.has(B.name) || RINGS.has(B.kind) || OPEN.has(B.kind) || DEPLOYABLE.has(B.kind) || FRAMES.has(B.kind) || B.kind === 'spin-bola') continue;
      /* a bearing's hub sits inside the ring or bola it carries by design */
      if ((RINGS.has(A.kind) || A.kind === 'spin-bola') && B.kind === 'spin-bearing') continue;
      const key = mateKey(A.name, B.name);
      if (interior.has(key)) continue;
      const toB = new THREE.Matrix4().copy(B.frame.matrixWorld).invert().multiply(A.frame.matrixWorld);
      const small = Math.min(...B.shapes.map((s) => (s.type === 'cyl' ? Math.min(2 * s.r, s.y1 - s.y0) : s.type === 'torus' ? 2 * s.tube : s.type === 'annulus' ? Math.min(s.rOut - s.rIn, s.y1 - s.y0) : 2 * Math.min(...s.h))));
      const allow = mated.has(key) ? Math.max(0.3, 0.12 * small) : Math.max(0.12, 0.05 * small);
      let worst = 0, what = null;
      for (const it of A.items) {
        if (it.hidden) continue;
        for (const p of it.pts) { _p.fromArray(p).applyMatrix4(toB); const d = minSdf(B.shapes, [_p.x, _p.y, _p.z]); if (-d > worst) { worst = -d; what = it; } }
      }
      if (worst > allow) push('fitting-poke', A.name, `${A.name} (${A.kind}): ${describe(what.mesh, what.obb)} reaches ${worst.toFixed(2)} m inside ${B.name} (${B.kind})`, worst);
    }
  }
  /* (5) the sail stage: its hardware hangs on the drum */
  const sailStage = model.userData.stages?.get(1), sail = model.userData.sail;
  if (opts.sail !== false && sailStage && sail?.drawn?.drum) {
    const filmRoot = sailStage.children[0];
    if (filmRoot) {
      const d = sail.drawn.drum, anchors = [{ type: 'cyl', r: d.r, y0: -d.l, y1: 0 }];
      const items = collect(filmRoot).filter((it) => !it.mesh.userData.film && !it.mesh.userData.tethered && !it.hidden);
      meshCount += items.length;
      const tol = Math.max(0.01, 0.01 * d.r);
      const attached = items.map((it) => it.pts.some((p) => minSdf(anchors, p) <= tol));
      let grew = true;
      while (grew) { grew = false; const now = items.filter((_, i) => attached[i]).map((it) => it.obb); for (let i = 0; i < items.length; i += 1) { if (attached[i] || !now.length) continue; if (items[i].pts.some((p) => now.some((o) => sdf(o, p) <= tol))) { attached[i] = true; grew = true; } } }
      items.forEach((it, i) => { if (!attached[i]) push('fitting-floating', 'sail', `sail mechanism: ${describe(it.mesh, it.obb)} hangs clear of the drum and its hardware`, 0); });
    }
  }
  const counts = {};
  for (const f of findings) counts[f.code] = (counts[f.code] ?? 0) + 1;
  return { findings, counts, meshes: meshCount, frames: frames.length };
}
