/* primitives/detail.js -- the human-scale fittings that make a hull read as engineered.

   Bolts and rivets, handrails, ladders, foot restraints, tether rings, cable runs with P-clamps, hatches
   with frames and hinges, windows with frames and glazing, access panels, vents, fill and drain ports,
   nameplates, docking targets, MMOD patches. Every size is a real one and is stated once in DETAIL with
   its source; nothing is scaled with the ship, because a handrail is 38 mm whether the hull is 4 m or
   112 m across. The builders return INSTANCES (a prototype geometry, a surface kind, and a pose), and
   buildDetailMeshes() merges every instance of the same prototype and surface into one InstancedMesh, so
   a world ship with six thousand handrails is a dozen draw calls.

   Poses are given on a surface: frameOn(normal, along) orients a prototype so its +y is the outward
   normal and its +z runs along the hull axis, and cylSurface(r) parameterises a hull segment by (theta,
   y), so the detail pass (parts/detail-pass.js) can say "a handrail every metre at four azimuths" and
   have it land on the skin. Glazing is a MeshPhysicalMaterial with transmission where the renderer has
   a DOM (node falls back to the preset). Imports three. */

import * as THREE from 'three';
import { surface } from './materials.js';

/* ------------------------------------------------------------------ *
 * The sizes, with their sources
 * ------------------------------------------------------------------ */
export const DETAIL = {
  bolt: { headAF: 0.017, headH: 0.007, pitchAlongFlange: 0.10, source: 'M10 hex head: 17 mm across flats, 7 mm high (ISO 4014); ISS CBM: 16 powered bolts on the ring' },
  rivet: { d: 0.006, h: 0.0025, pitch: 0.15, source: 'solid rivet 6 mm dome head; panel-seam pitch 150 mm (Al skin stringer practice)' },
  handrail: { d: 0.038, standoff: 0.055, length: 0.6, longLength: 1.2, pitch: 1.0, source: 'ISS EVA handrail: 38 mm tube, 55 mm standoff, 0.6 m (short) and 1.2 m (long) (NASA JSC-26626 EVA design requirements)' },
  ladder: { stileD: 0.040, rungD: 0.025, pitch: 0.28, width: 0.40, cageD: 0.70, cageFrom: 2.2, source: 'fixed ladder: 280 mm rung pitch, 400 mm wide, cage hoops above 2.2 m (EN ISO 14122-4)' },
  footRestraint: { w: 0.30, l: 0.20, t: 0.03, source: 'ISS articulating portable foot restraint plate' },
  tether: { ringD: 0.06, wireD: 0.008, baseW: 0.06, source: 'EVA tether D-ring, 60 mm, on a 60 mm base' },
  cable: { d: 0.030, clampW: 0.040, clampPitch: 0.6, source: 'ISS external harness: 30 mm bundle, P-clamp every 0.6 m' },
  hatch: {
    cbm: { w: 1.27, h: 1.27, shape: 'square', source: 'ISS CBM hatch, 1.27 x 1.27 m (50 in square)' },
    idss: { d: 0.80, shape: 'round', source: 'IDSS IDD Rev F: 800 mm passage' },
    dragon: { w: 0.80, h: 1.00, shape: 'round', source: 'Crew Dragon side hatch, ~0.8 x 1.0 m' },
    airlock: { d: 1.00, shape: 'round', source: 'ISS Quest EVA hatch, 1.0 m' },
    orion: { w: 0.74, h: 0.84, shape: 'round', source: 'Orion side hatch (29 x 33 in)' }
  },
  window: {
    cupola: { d: 0.80, source: 'ISS Cupola top window, 80 cm' },
    iss: { d: 0.51, source: 'ISS Destiny nadir window, 51 cm' },
    dragon: { d: 0.30, source: 'Crew Dragon window, ~30 cm' },
    frameW: 0.06, glassT: 0.03
  },
  panel: { w: 0.50, h: 0.40, t: 0.012, fasteners: 4, source: 'ISS ORU access panel class' },
  vent: { w: 0.20, h: 0.10, slats: 4, source: 'non-propulsive vent / purge louvre' },
  fillPort: { d: 0.10, h: 0.06, source: 'fill-and-drain quick disconnect with cap' },
  nameplate: { w: 0.40, h: 0.10, source: 'stencilled nameplate, 100 mm letters' },
  target: { d: 0.30, source: 'docking/berthing target: 30 cm base, standoff cross (CBM centreline target)' },
  mmod: { w: 0.30, h: 0.30, t: 0.02, source: 'MMOD bumper patch' },
  person: { heightM: 1.8, eyeM: 1.65, reachM: 0.9 }
};

/* ------------------------------------------------------------------ *
 * Prototypes: unit geometries every instance is a scaled copy of
 * ------------------------------------------------------------------ */
const PROTO = {
  hex: () => { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); return g; },        // bolt head: scale (AF/2, headH, AF/2)
  dome: () => { const g = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); return g; },     // rivet: scale (d/2, h, d/2)
  tube: () => { const g = new THREE.CylinderGeometry(1, 1, 1, 10); g.translate(0, 0.5, 0); return g; },        // along +y: scale (r, length, r)
  box: () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; },                  // standing on y = 0: scale (w, h, d)
  ring: () => new THREE.TorusGeometry(1, 0.12, 6, 24),                                                        // in xy: scale (R, R, R)
  disc: () => { const g = new THREE.CylinderGeometry(1, 1, 1, 32); g.translate(0, 0.5, 0); return g; },        // scale (r, t, r)
  glass: () => { const g = new THREE.CylinderGeometry(1, 1, 1, 32); g.translate(0, 0.5, 0); return g; }
};
const protoCache = new Map();
function proto(name) { if (!protoCache.has(name)) protoCache.set(name, PROTO[name]()); return protoCache.get(name); }

let glazing = null;
/** Glazing: physical glass with transmission in the browser; the lit preset in node. */
export function glazingMaterial() {
  if (glazing) return glazing;
  if (typeof document !== 'undefined' && THREE.MeshPhysicalMaterial) {
    glazing = new THREE.MeshPhysicalMaterial({ color: 0x9fc8e8, metalness: 0, roughness: 0.08, transmission: 0.72, thickness: 0.03, ior: 1.5, reflectivity: 0.6, transparent: true, opacity: 0.92, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  } else glazing = surface('glass');
  glazing.userData.surface = 'glazing';
  return glazing;
}

/* ------------------------------------------------------------------ *
 * Poses on surfaces
 * ------------------------------------------------------------------ */
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
/** A quaternion whose +y is `normal` and whose +z is `along` (projected perpendicular). */
export function frameOn(normal, along = [0, 1, 0]) {
  _y.fromArray(normal).normalize();
  _z.fromArray(along).addScaledVector(_y, -_y.dot(_z.fromArray(along))).normalize();
  if (_z.lengthSq() < 1e-6) _z.set(1, 0, 0).addScaledVector(_y, -_y.x).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

/** A hull segment surface: radius r, axis +y, base at y = 0. at(theta, y, standoff) gives the point and the
 *  outward frame; the detail pass uses it so every fitting sits on the skin, not in it. */
export function cylSurface(r, { y0 = 0, y1 = Infinity } = {}) {
  return {
    r, y0, y1,
    at(theta, y, standoff = 0) {
      const n = [Math.cos(theta), 0, Math.sin(theta)];
      return { p: [n[0] * (r + standoff), y, n[2] * (r + standoff)], q: frameOn(n, [0, 1, 0]), n };
    },
    /** a frame on the end face at height y (normal +-y), at radius rr and angle theta */
    end(theta, y, rr, up = 1) { return { p: [Math.cos(theta) * rr, y, Math.sin(theta) * rr], q: frameOn([0, up, 0], [Math.cos(theta), 0, Math.sin(theta)]) }; }
  };
}

/** A torus surface: major radius R, tube radius `tube`, ring in the xz plane. at(phi, psi) where phi runs round
 *  the ring and psi round the tube (0 = outer equator, +-pi/2 the faces). */
export function torusSurface(R, tube) {
  return {
    R, tube,
    at(phi, psi, standoff = 0) {
      const rr = R + Math.cos(psi) * (tube + standoff), p = [Math.cos(phi) * rr, Math.sin(psi) * (tube + standoff), Math.sin(phi) * rr];
      const n = [Math.cos(phi) * Math.cos(psi), Math.sin(psi), Math.sin(phi) * Math.cos(psi)];
      const along = [-Math.sin(phi), 0, Math.cos(phi)];
      return { p, q: frameOn(n, along), n };
    }
  };
}

/* ------------------------------------------------------------------ *
 * Instances
 * ------------------------------------------------------------------ */
/** One placed prototype: { proto, kind, p: [x,y,z], q: Quaternion, s: [sx,sy,sz], tag } */
const inst = (protoName, kind, p, q, s, tag) => ({ proto: protoName, kind, p, q, s, tag });
const Q0 = new THREE.Quaternion();
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion();
const turned = (q, axis, angle) => _qa.copy(q).multiply(_q.setFromAxisAngle(new THREE.Vector3(...axis), angle)).clone();
/** A point offset in a pose's own frame. */
const offset = (pose, dx, dy, dz) => { const v = new THREE.Vector3(dx, dy, dz).applyQuaternion(pose.q); return [pose.p[0] + v.x, pose.p[1] + v.y, pose.p[2] + v.z]; };

/* ---- bolts and rivets ---- */
/** A bolt circle of `count` hex heads at radius `rr` on a plane whose frame is `pose` (bolts stand along the pose's +y). */
export function boltCircle(pose, rr, count, out = []) {
  const b = DETAIL.bolt;
  for (let k = 0; k < count; k += 1) {
    const a = (k / count) * Math.PI * 2;
    out.push(inst('hex', 'dark', offset(pose, Math.cos(a) * rr, 0, Math.sin(a) * rr), pose.q, [b.headAF / 2, b.headH, b.headAF / 2], 'bolt'));
  }
  return out;
}
/** The bolt count a flange of diameter d carries: 16 for a CBM, 12 for IDSS hooks, 120 for the EELV 1575 PAF, else one per 100 mm. */
export function boltsFor(d, type = null) {
  if (type === 'cbm') return 16;
  if (type === 'idss-1200') return 12;
  if (type === 'paf-1575') return 120;
  if (type === 'lightband-12') return 24;
  return Math.max(6, Math.min(96, Math.round((Math.PI * d) / DETAIL.bolt.pitchAlongFlange)));
}
/** A rivet row round a cylinder at height y. */
export function rivetRow(surf, y, out = [], pitch = DETAIL.rivet.pitch) {
  const n = Math.max(8, Math.round((2 * Math.PI * surf.r) / pitch));
  for (let k = 0; k < n; k += 1) { const pose = surf.at((k / n) * Math.PI * 2, y); out.push(inst('dome', 'grey', pose.p, pose.q, [DETAIL.rivet.d / 2, DETAIL.rivet.h, DETAIL.rivet.d / 2], 'rivet')); }
  return out;
}
/** A straight rivet row along a hull line (a stringer) from y0 to y1 at theta. */
export function rivetLine(surf, theta, y0, y1, out = [], pitch = DETAIL.rivet.pitch) {
  const n = Math.max(2, Math.round((y1 - y0) / pitch));
  for (let k = 0; k <= n; k += 1) { const pose = surf.at(theta, y0 + ((y1 - y0) * k) / n); out.push(inst('dome', 'grey', pose.p, pose.q, [DETAIL.rivet.d / 2, DETAIL.rivet.h, DETAIL.rivet.d / 2], 'rivet')); }
  return out;
}

/* ---- handrails, ladders, restraints, tethers ---- */
/** A handrail of `length` centred on `pose`, running along the pose's +z (axial) or +x (circumferential). */
export function handrail(pose, length = DETAIL.handrail.length, out = [], dir = 'z') {
  const h = DETAIL.handrail, r = h.d / 2;
  const axis = dir === 'z' ? [0, 0, 1] : [1, 0, 0];
  const qRail = turned(pose.q, dir === 'z' ? [1, 0, 0] : [0, 0, 1], dir === 'z' ? Math.PI / 2 : -Math.PI / 2); // tube +y -> along the rail
  const start = offset(pose, axis[0] * -length / 2, h.standoff + r, axis[2] * -length / 2);
  out.push(inst('tube', 'gold', start, qRail, [r, length, r], 'handrail'));
  for (const e of [-1, 1]) {
    const foot = offset(pose, axis[0] * e * (length / 2 - 0.05), 0, axis[2] * e * (length / 2 - 0.05));
    out.push(inst('tube', 'grey', foot, pose.q, [r * 0.7, h.standoff, r * 0.7], 'handrail-post'));
  }
  return out;
}
/** A rung ladder on a hull line at theta from y0 up to y1, with cage hoops above cageFrom. */
export function ladder(surf, theta, y0, y1, out = []) {
  const L = DETAIL.ladder, half = L.width / 2, so = 0.15;
  const pose = surf.at(theta, y0, so);
  const qUp = pose.q; // tube +y is outward; we need along the hull axis: rotate so tube +y -> +z (axis)
  const qAxial = turned(pose.q, [1, 0, 0], Math.PI / 2);
  for (const s of [-1, 1]) out.push(inst('tube', 'grey', offset(pose, s * half, 0, 0), qAxial, [L.stileD / 2, y1 - y0, L.stileD / 2], 'ladder-stile'));
  const n = Math.floor((y1 - y0) / L.pitch);
  for (let k = 1; k <= n; k += 1) {
    const p = offset(pose, -half, 0, k * L.pitch);
    out.push(inst('tube', 'grey', p, turned(pose.q, [0, 0, 1], -Math.PI / 2), [L.rungD / 2, L.width, L.rungD / 2], 'ladder-rung'));
  }
  if (y1 - y0 > L.cageFrom) {
    for (let y = y0 + L.cageFrom; y < y1; y += 0.7) {
      const c = surf.at(theta, y, so + L.cageD / 2);
      out.push(inst('ring', 'grey', c.p, turned(c.q, [0, 0, 1], 0), [L.cageD / 2, L.cageD / 2, 0.2], 'ladder-cage'));
    }
  }
  /* standoff brackets every 1.2 m */
  for (let y = y0 + 0.3; y < y1; y += 1.2) for (const s of [-1, 1]) { const b = surf.at(theta, y); out.push(inst('tube', 'dark', offset(b, s * half, 0, 0), b.q, [0.015, so, 0.015], 'ladder-bracket')); }
  return out;
}
/** A foot-restraint plate on the skin. */
export function footRestraint(pose, out = []) {
  const f = DETAIL.footRestraint;
  out.push(inst('box', 'dark', pose.p, pose.q, [f.w, f.t, f.l], 'foot-restraint'));
  out.push(inst('box', 'gold', offset(pose, 0, f.t, 0), pose.q, [f.w * 0.3, 0.02, f.l * 0.9], 'foot-restraint'));
  return out;
}
/** A tether D-ring on a small base. */
export function tetherRing(pose, out = []) {
  const t = DETAIL.tether;
  out.push(inst('box', 'dark', pose.p, pose.q, [t.baseW, 0.015, t.baseW], 'tether'));
  out.push(inst('ring', 'stainless', offset(pose, 0, 0.015 + t.ringD / 2, 0), pose.q, [t.ringD / 2, t.ringD / 2, t.wireD / 0.12 / 2 * 0.5], 'tether'));
  return out;
}
/** A cable or fluid line along the hull at theta from y0 to y1, held by P-clamps. */
export function cableRun(surf, theta, y0, y1, out = [], d = DETAIL.cable.d) {
  const c = DETAIL.cable, so = 0.02;
  const pose = surf.at(theta, y0, so + d / 2);
  out.push(inst('tube', 'dark', pose.p, turned(pose.q, [1, 0, 0], Math.PI / 2), [d / 2, y1 - y0, d / 2], 'cable'));
  for (let y = y0 + 0.2; y < y1; y += c.clampPitch) { const b = surf.at(theta, y); out.push(inst('box', 'grey', b.p, b.q, [c.clampW, so + d + 0.01, c.clampW * 0.5], 'clamp')); }
  return out;
}

/* ---- hatches, windows, panels ---- */
/** A hatch at `pose` (frame +y outward): door, frame, seal, hinges, handle, bolt circle around the frame. */
export function hatch(spec, pose, out = []) {
  const round = spec.shape === 'round', w = spec.w ?? spec.d, h = spec.h ?? spec.d, so = 0.04;
  if (round) {
    const rr = Math.max(w, h) / 2;
    out.push(inst('ring', 'grey', offset(pose, 0, so * 0.5, 0), pose.q, [rr + 0.05, rr + 0.05, 0.35], 'hatch-frame'));
    out.push(inst('disc', 'hatch', pose.p, pose.q, [rr, so, rr], 'hatch-door'));
    out.push(inst('ring', 'dark', offset(pose, 0, so, 0), pose.q, [rr * 0.92, rr * 0.92, 0.12], 'hatch-seal'));
    boltCircle({ p: offset(pose, 0, so * 0.5, 0), q: pose.q }, rr + 0.09, Math.max(8, Math.round((Math.PI * 2 * rr) / 0.2)), out);
    if (h !== w) out[out.length - 1].s = [1, 1, 1]; // (elliptical hatches keep a round frame envelope)
  } else {
    out.push(inst('box', 'hatch', offset(pose, -w / 2, 0, -h / 2), pose.q, [w, so, h], 'hatch-door'));
    for (const [dx, dz, sx, sz] of [[-w / 2 - 0.06, -h / 2 - 0.06, 0.06, h + 0.12], [w / 2, -h / 2 - 0.06, 0.06, h + 0.12], [-w / 2, -h / 2 - 0.06, w, 0.06], [-w / 2, h / 2, w, 0.06]]) out.push(inst('box', 'grey', offset(pose, dx, 0, dz), pose.q, [sx, so * 1.4, sz], 'hatch-frame'));
    for (let k = 0; k < 4; k += 1) for (let i = 1; i < 5; i += 1) { const t = i / 5; const [dx, dz] = k === 0 ? [-w / 2 - 0.03, -h / 2 + t * h] : k === 1 ? [w / 2 + 0.03, -h / 2 + t * h] : k === 2 ? [-w / 2 + t * w, -h / 2 - 0.03] : [-w / 2 + t * w, h / 2 + 0.03]; out.push(inst('hex', 'dark', offset(pose, dx, so * 1.4, dz), pose.q, [DETAIL.bolt.headAF / 2, DETAIL.bolt.headH, DETAIL.bolt.headAF / 2], 'bolt')); }
  }
  /* two hinges on the -x side, a handle on the +x side */
  for (const dz of [-h * 0.3, h * 0.3]) out.push(inst('box', 'dark', offset(pose, -w / 2 - 0.02, so, dz - 0.06), pose.q, [0.08, 0.06, 0.12], 'hinge'));
  out.push(inst('tube', 'stainless', offset(pose, w * 0.32, so + 0.06, -0.12), turned(pose.q, [1, 0, 0], Math.PI / 2), [0.012, 0.24, 0.012], 'handle'));
  for (const dz of [-0.12, 0.12]) out.push(inst('tube', 'dark', offset(pose, w * 0.32, so, dz), pose.q, [0.012, 0.06, 0.012], 'handle'));
  return out;
}
/** A window of diameter d: frame ring, bolt circle, glazing disc (slightly recessed), shutter rail. */
export function windowPort(d, pose, out = []) {
  const W = DETAIL.window, rr = d / 2;
  out.push(inst('ring', 'dark', offset(pose, 0, 0.02, 0), pose.q, [rr + W.frameW * 0.5, rr + W.frameW * 0.5, 0.4], 'window-frame'));
  out.push(inst('glass', 'glazing', offset(pose, 0, -W.glassT, 0), pose.q, [rr, W.glassT, rr], 'glazing'));
  boltCircle({ p: offset(pose, 0, 0.03, 0), q: pose.q }, rr + W.frameW, Math.max(8, Math.round((Math.PI * 2 * rr) / 0.12)), out);
  out.push(inst('box', 'grey', offset(pose, -rr - W.frameW - 0.05, 0, -rr), pose.q, [0.03, 0.03, 2 * rr], 'shutter-rail'));
  return out;
}
/** An access panel with four fasteners. */
export function accessPanel(pose, out = [], w = DETAIL.panel.w, h = DETAIL.panel.h) {
  out.push(inst('box', 'offwhite', offset(pose, -w / 2, 0, -h / 2), pose.q, [w, DETAIL.panel.t, h], 'panel'));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(inst('hex', 'dark', offset(pose, sx * (w / 2 - 0.03), DETAIL.panel.t, sz * (h / 2 - 0.03)), pose.q, [0.008, 0.005, 0.008], 'bolt'));
  return out;
}
/** A louvred vent. */
export function vent(pose, out = []) {
  const v = DETAIL.vent;
  out.push(inst('box', 'dark', offset(pose, -v.w / 2, 0, -v.h / 2), pose.q, [v.w, 0.02, v.h], 'vent'));
  for (let k = 0; k < v.slats; k += 1) out.push(inst('box', 'grey', offset(pose, -v.w / 2, 0.02, -v.h / 2 + (k + 0.5) * (v.h / v.slats) - 0.006), pose.q, [v.w, 0.01, 0.012], 'vent'));
  return out;
}
/** A fill/drain port with its cap. */
export function fillPort(pose, out = []) {
  const f = DETAIL.fillPort;
  out.push(inst('disc', 'stainless', pose.p, pose.q, [f.d / 2 + 0.03, 0.01, f.d / 2 + 0.03], 'fill-port'));
  out.push(inst('tube', 'stainless', offset(pose, 0, 0.01, 0), pose.q, [f.d / 2, f.h, f.d / 2], 'fill-port'));
  out.push(inst('disc', 'accent', offset(pose, 0, 0.01 + f.h, 0), pose.q, [f.d / 2 + 0.01, 0.015, f.d / 2 + 0.01], 'fill-port'));
  boltCircle({ p: offset(pose, 0, 0.01, 0), q: pose.q }, f.d / 2 + 0.02, 6, out);
  return out;
}
/** A docking / berthing target: base disc, standoff post and cross. */
export function dockingTarget(pose, out = []) {
  const rr = DETAIL.target.d / 2;
  out.push(inst('disc', 'white', pose.p, pose.q, [rr, 0.01, rr], 'target'));
  out.push(inst('tube', 'dark', offset(pose, 0, 0.01, 0), pose.q, [0.012, 0.15, 0.012], 'target'));
  out.push(inst('box', 'dark', offset(pose, -rr * 0.6, 0.16, -0.01), pose.q, [rr * 1.2, 0.02, 0.02], 'target'));
  out.push(inst('box', 'dark', offset(pose, -0.01, 0.16, -rr * 0.6), pose.q, [0.02, 0.02, rr * 1.2], 'target'));
  return out;
}
/** An MMOD bumper patch. */
export function mmodPatch(pose, out = []) {
  const m = DETAIL.mmod;
  out.push(inst('box', 'hatch', offset(pose, -m.w / 2, 0, -m.h / 2), pose.q, [m.w, m.t, m.h], 'mmod'));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(inst('dome', 'grey', offset(pose, sx * (m.w / 2 - 0.03), m.t, sz * (m.h / 2 - 0.03)), pose.q, [0.006, 0.003, 0.006], 'rivet'));
  return out;
}

/* ---- nameplates and stencils (one mesh each: the text is unique) ---- */
const stencilCache = new Map();
function stencilTexture(text, fg = '#1a1c20', bg = '#f0f0ec') {
  const k = `${text}|${fg}|${bg}`;
  if (stencilCache.has(k)) return stencilCache.get(k);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = 'bold 88px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  g.fillStyle = fg; g.fillRect(16, 10, 480, 4); g.fillRect(16, 114, 480, 4);
  /* the plate's top face reads u along -x from outside, so the canvas is flipped to read left to right */
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;
  stencilCache.set(k, t);
  return t;
}
/** A nameplate mesh (not instanced) lying on the pose, w x h, reading `text`. */
export function nameplate(pose, text, { w = DETAIL.nameplate.w, h = DETAIL.nameplate.h, fg, bg } = {}) {
  const tex = stencilTexture(text, fg, bg);
  const mat = tex ? new THREE.MeshStandardMaterial({ map: tex, metalness: 0.2, roughness: 0.6 }) : surface('offwhite');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, h), mat);
  m.position.fromArray(offset(pose, 0, 0.005, 0)); m.quaternion.copy(pose.q);
  m.userData.detail = true; m.userData.tag = 'nameplate';
  return m;
}

/* ------------------------------------------------------------------ *
 * Merging
 * ------------------------------------------------------------------ */
const _mat4 = new THREE.Matrix4(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3();
/**
 * Merge instances into one InstancedMesh per (prototype, surface). `toWorld` (a Matrix4) carries the
 * part frame into the model. Returns a Group tagged userData.detail with userData.counts by tag.
 */
export function buildDetailMeshes(instances, toWorld = null) {
  const g = new THREE.Group(); g.userData.detail = true;
  const byKey = new Map(), counts = {};
  for (const it of instances) {
    const k = `${it.proto}|${it.kind}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(it);
    counts[it.tag] = (counts[it.tag] ?? 0) + 1;
  }
  for (const [k, list] of byKey) {
    const [protoName, kind] = k.split('|');
    const mat = kind === 'glazing' ? glazingMaterial() : surface(kind);
    const mesh = new THREE.InstancedMesh(proto(protoName), mat, list.length);
    list.forEach((it, i) => {
      _mat4.compose(_pos.fromArray(it.p), it.q ?? Q0, _scl.fromArray(it.s));
      if (toWorld) _mat4.premultiply(toWorld);
      mesh.setMatrixAt(i, _mat4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.detail = true; mesh.userData.tag = protoName;
    g.add(mesh);
  }
  g.userData.counts = counts;
  return g;
}
