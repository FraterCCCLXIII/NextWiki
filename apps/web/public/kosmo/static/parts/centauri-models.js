/* centauri-models.js -- the eight Centauri craft, as CAD built from their solved assemblies.

   Nothing here is posed by hand. parts/fleet.js solves the assembly from its mates and this module
   draws what the solver placed: a builder per part kind (a Columbus module is a pressure shell with
   end cones, external racks, MLI bands and handrails; a 1 g ring is a torus with window strips,
   spokes and a pressurised hub; a 6U deployer is a four-rail cage with six bays), a mating ring at
   every structural port so the berthing planes are visible, and the origami deployment from
   parts/origami.js, which the viewer drives with its unfold control.

   Two scales are in the same picture and both are printed on the label:
     hull   true size, always
     sail   true size while that stays legible, otherwise 12 hull spans, and the label says by how
            much it was drawn down -- a colony's film is 171 km on a side against a 1.02 km ring,
            and scaling the ring up to make the sail "fit" would be a lie about the ring.

   Axes: parts are built in their own frame, +y along the part, base at y = 0, except where the
   catalogue says origin: 'centre'. The solver's quaternion then turns each part onto the craft's
   thrust axis, so the assembly is the same one the lab measures. */

import * as THREE from 'three';
import { measure } from './fleet.js';
import {
  sailSquareSide, accordionAngles, FLASHER, SECTOR, flasherRadius, deploy, faces, creases, lambdaFor
} from './origami.js';

const CO = {
  shell: 0xe9edf2, mli: 0xd9cfae, metal: 0xc3c8cf, dark: 0x4a4f57, glass: 0x27435f,
  film: 0x9fd0ff, array: 0x1d2c55, rad: 0xe4e0d6, gold: 0xc9a24b, grey: 0x9aa3ad,
  tank: 0xb9c0c8, accent: 0xc4642a, hatch: 0x8d959e
};

const cache = new Map();
function mat(c, o = {}) {
  const k = `${c}|${o.metal ?? ''}|${o.rough ?? ''}|${o.emissive ?? ''}|${o.alpha ?? ''}`;
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({
    color: c, metalness: o.metal ?? 0.18, roughness: o.rough ?? 0.5, emissive: o.emissive ?? 0x000000,
    side: THREE.DoubleSide, transparent: o.alpha != null, opacity: o.alpha ?? 1
  }));
  return cache.get(k);
}
const mesh = (g, c, o) => new THREE.Mesh(g, mat(c, o));

/* ---- primitives, metres, +y up, base at y = 0 ---- */
const cyl = (r, h, c, o = {}) => { const g = new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg ?? 24, 1, !!o.open); g.translate(0, h / 2, 0); return mesh(g, c, o.mat); };
const box = (w, h, d, c, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), c, o.mat);
const tor = (r, tube, c, o = {}) => mesh(new THREE.TorusGeometry(r, tube, o.rad ?? 10, o.tseg ?? 48), c, o.mat);
const sph = (r, c, o = {}) => mesh(new THREE.SphereGeometry(r, o.seg ?? 20, o.rseg ?? 14), c, o.mat);
const put = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

function rod(g, a, b, r, c, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B) || 1e-6;
  const m = cyl(r, L, c, { seg: o.seg ?? 8, mat: o.mat });
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.add(m);
  return m;
}

/* A ring lying in the part's xz plane (normal +y): end domes, hatch frames, ribs. */
function ringXZ(r, tube, c, y = 0) {
  const m = tor(r, tube, c, { metal: 0.55, rough: 0.35 });
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}

/** A visible mating plane at every structural port: CBM, IDSS and the PAF classes. Hinges and
 *  service connectors are not hatches, so they get nothing. */
const PORT_D = { 'paf-937': 0.937, 'paf-1194': 1.194, 'paf-1575': 1.575, 'idss-1200': 1.2, cbm: 1.27 };
function addPortRing(g, port) {
  const d = PORT_D[port.type];
  if (!d || /^(mount|hub|root|sailmount)/.test(port.id)) return;
  const m = tor(d / 2, Math.max(d * 0.035, 1e-4), CO.metal, { metal: 0.6, rough: 0.3 });
  m.position.fromArray(port.at);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...port.axis).normalize());
  g.add(m);
  const plate = cyl(d * 0.44, d * 0.06, CO.hatch, { seg: 20 });
  plate.position.set(0, -d * 0.03, 0);
  const frame = new THREE.Group();
  frame.add(plate);
  frame.position.fromArray(port.at);
  frame.quaternion.copy(m.quaternion);
  g.add(frame);
}

/* ------------------------------------------------------------------ *
 * Part builders: one per catalogue kind
 * ------------------------------------------------------------------ */

/* Columbus-class laboratory: pressure shell, fore cone, CBM rings, four external racks, MLI
   bands, handrails, nadir windows. */
function moduleCAD(p) {
  const g = new THREE.Group(), r = (p.dims.d ?? 4.5) / 2, L = p.dims.l ?? 6.9, end = Math.min(0.65, L * 0.1);
  g.add(cyl(r, L, CO.mli, { seg: 36 }));
  put(cyl(r * 0.52, end, CO.shell, { r2: r, seg: 36 }), 0, L - end, 0);
  g.add(ringXZ(r, Math.max(r * 0.03, 0.02), CO.metal, 0.05));
  g.add(ringXZ(r, Math.max(r * 0.03, 0.02), CO.metal, L - 0.05));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    const rack = box(r * 0.32, L * 0.5, r * 0.62, CO.shell);
    put(rack, x * (r + r * 0.16), L * 0.5, z * (r + r * 0.16), 0, -a, 0);
    g.add(rack);
    for (const y of [L * 0.3, L * 0.7]) rod(g, [x * r * 0.75, y, z * r * 0.75], [x * (r + r * 0.1), y, z * (r + r * 0.1)], r * 0.02, CO.metal);
    const rail = rod(g, [x * r * 1.03, L * 0.22, z * r * 1.03], [x * r * 1.03, L * 0.78, z * r * 1.03], r * 0.018, CO.metal);
    rail.userData.handrail = true;
  }
  for (let i = 1; i <= 3; i += 1) {
    const band = cyl(r * 1.012, L * 0.045, CO.gold, { seg: 36, open: true });
    band.position.y = (L * i) / 4;
    g.add(band);
  }
  for (let i = 0; i < 2; i += 1) {
    const w = cyl(r * 0.1, r * 0.05, CO.glass, { seg: 16 });
    put(w, r * 0.34, L * 0.42 + i * r * 0.5, -r * 0.93, Math.PI / 2);
    g.add(w);
  }
  return { group: g };
}

/* Unity-class node: six berths on a short pressurised drum, plus the grapple fixture. */
function nodeCAD(p) {
  const g = new THREE.Group(), r = (p.dims.d ?? 4.6) / 2, L = p.dims.l ?? 5.5, mid = L / 2;
  g.add(cyl(r, L, CO.mli, { seg: 32 }));
  g.add(ringXZ(r * 0.98, r * 0.035, CO.metal, 0.04), ringXZ(r * 0.98, r * 0.035, CO.metal, L - 0.04));
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const dir = new THREE.Vector3(ax, 0, az).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const stub = cyl(0.635, 0.42, CO.shell, { seg: 22 });
    stub.quaternion.copy(q);
    stub.position.set(ax * r * 0.82, mid, az * r * 0.82);
    g.add(stub);
    const ring = tor(0.635, 0.05, CO.metal, { metal: 0.6, rough: 0.3 });
    ring.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir));
    ring.position.set(ax * (r * 0.82 + 0.42), mid, az * (r * 0.82 + 0.42));
    g.add(ring);
    const hatch = cyl(0.55, 0.04, CO.hatch, { seg: 20 });
    hatch.quaternion.copy(ring.quaternion);
    hatch.position.copy(ring.position).addScaledVector(dir, -0.02);
    g.add(hatch);
  }
  put(cyl(r * 0.06, L * 0.12, CO.metal, { seg: 8 }), 0, L, 0);
  const cup = tor(r * 0.14, r * 0.02, CO.metal, { metal: 0.6 });
  put(cup, 0, L + L * 0.12, 0, Math.PI / 2);
  g.add(cup);
  return { group: g };
}

/** A pleated strip: `segments` rigid panels hinged end to end, alternating sign, so k = 1 is flat
 *  and k = 0 is a map fold one panel deep. Used by the solar wings and the radiators. */
function accordionStrip(len, width, thick, segments, colour, opts = {}) {
  const g = new THREE.Group(), segL = len / segments, pivots = [];
  let host = g;
  for (let i = 0; i < segments; i += 1) {
    const pivot = new THREE.Group();
    pivot.position.set(0, i ? segL : 0, 0);
    const flap = new THREE.Group();
    pivot.add(flap);
    host.add(pivot);
    const panel = box(width, segL, thick, colour, { mat: opts.mat ?? { metal: 0.4, rough: 0.35 } });
    panel.position.set(0, segL / 2, 0);
    flap.add(panel);
    for (let k = 1; k < 4; k += 1) {
      const rib = box(width * 0.97, thick * 1.8, thick * 2.6, CO.metal, { metal: 0.6, rough: 0.3 });
      rib.position.set(0, (segL * k) / 4, 0);
      flap.add(rib);
    }
    if (opts.cells) {
      for (let k = 1; k < 4; k += 1) {
        const seam = box(width, thick * 0.4, thick * 1.4, CO.gold, { metal: 0.5 });
        seam.position.set(0, (segL * k) / 4, 0);
        flap.add(seam);
      }
    }
    pivots.push(pivot);
    host = flap;
  }
  return {
    group: g,
    setDeploy: (k) => { const a = accordionAngles(k, segments); for (let i = 0; i < pivots.length; i += 1) pivots[i].rotation.x = a[i]; }
  };
}

/* ISS SAW class: blanket box, gimbal, mast and a 34 m blanket that folds to 4.25 m. */
function arrayCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 34, W = p.dims.d ?? 11;
  const boxg = box(W * 0.32, 0.7, 1.1, CO.metal, { metal: 0.5, rough: 0.4 });
  put(boxg, 0, 0.35, 0);
  g.add(boxg);
  const gimbal = tor(W * 0.1, W * 0.02, CO.metal, { metal: 0.6 });
  put(gimbal, 0, 0.35, 0, Math.PI / 2);
  g.add(gimbal);
  const blanket = accordionStrip(L, W, Math.max(W * 0.0035, 0.02), 8, CO.array, { cells: true });
  blanket.group.position.set(0, 0.7, 0);
  g.add(blanket.group);
  /* The blanket spans x, so its edge booms run at x = +/- W/2. On z they stood 11 m off the panel and
     gave the wing a false 11 m depth, which is what swallowed the radiator and read as a second panel. */
  rod(g, [W * 0.5, 0.7, 0], [W * 0.5, L + 0.7, 0], Math.max(W * 0.006, 0.02), CO.metal);
  rod(g, [-W * 0.5, 0.7, 0], [-W * 0.5, L + 0.7, 0], Math.max(W * 0.004, 0.015), CO.metal);
  return { group: g, setDeploy: blanket.setDeploy };
}

/* Deployable radiator: eight pleated panels on a fluid loop, folding to 1.9 m. */
function radiatorCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 15.2, W = p.dims.d ?? 6.1;
  const loop = tor(W * 0.08, W * 0.014, CO.metal, { metal: 0.6 });
  put(loop, 0, 0.15, 0, Math.PI / 2);
  g.add(loop);
  const strip = accordionStrip(L, W, Math.max(W * 0.012, 0.03), 8, CO.rad, { mat: { metal: 0.35, rough: 0.55 } });
  strip.group.position.set(0, 0.3, 0);
  g.add(strip.group);
  for (const s of [-1, 1]) rod(g, [s * W * 0.48, 0.3, 0], [s * W * 0.48, L + 0.3, 0], Math.max(W * 0.006, 0.02), CO.dark);
  return { group: g, setDeploy: strip.setDeploy };
}

/* 100 kg class bus: octagonal structure, four body-mounted panels, dish, thruster quads. */
function busCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 1.2, D = p.dims.d ?? 1.0, r = D / 2;
  const oct = cyl(r, L, CO.mli, { seg: 8 });
  g.add(oct);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2, panel = box(r * 1.5, L * 0.78, r * 0.04, CO.array, { metal: 0.4, rough: 0.3 });
    put(panel, Math.cos(a) * r * 0.94, L / 2, Math.sin(a) * r * 0.94, 0, -a, 0);
    g.add(panel);
  }
  put(cyl(r * 0.42, r * 0.12, CO.gold), 0, L, 0);
  const dish = mesh(new THREE.SphereGeometry(r * 0.6, 24, 10, 0, Math.PI * 2, 0, 0.85), CO.shell, { metal: 0.45, rough: 0.3 });
  put(dish, r * 0.36, L * 0.72, 0);
  g.add(dish);
  rod(g, [0, L, 0], [0, L + L * 0.4, 0], r * 0.03, CO.metal);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const n = mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.13, r * 0.12, 12, 1, true), CO.dark, { metal: 0.6 });
    put(n, Math.cos(a) * r * 0.7, -r * 0.04, Math.sin(a) * r * 0.7, Math.PI);
    g.add(n);
  }
  const rad = box(r * 0.5, L * 0.5, r * 0.03, CO.rad, { metal: 0.3 });
  put(rad, 0, L * 0.5, r * 0.98);
  g.add(rad);
  return { group: g };
}

/* StarChip: a 1 g wafer, 1 cm across, with its grid of cells and four photon-thruster pads. */
function chipCAD(p) {
  const g = new THREE.Group(), S = p.dims.d ?? 0.01, t = Math.max(p.dims.l ?? 0.001, S * 0.1);
  const wafer = box(S, t, S, CO.gold, { metal: 0.75, rough: 0.25 });
  wafer.position.y = t / 2;
  g.add(wafer);
  for (let i = 1; i < 4; i += 1) {
    const line = box(S * 0.98, t * 1.2, S * 0.02, CO.dark);
    put(line, 0, t / 2, (i / 4 - 0.5) * S);
    g.add(line);
  }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const pad = box(S * 0.16, t * 2.2, S * 0.16, CO.accent, { metal: 0.5 });
    put(pad, x * S * 0.4, t / 2, z * S * 0.4);
    g.add(pad);
  }
  return { group: g };
}

/* 6U deployer: four rails, two end plates and six bays, one per unit. */
function dispenserCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 0.6, D = p.dims.d ?? 0.4, r = D / 2, t = D * 0.03;
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) rod(g, [x * r, 0, z * r], [x * r, L, z * r], t, CO.metal, { seg: 6 });
  put(box(D, t * 1.6, D, CO.metal), 0, 0, 0);
  put(box(D, t * 1.6, D, CO.metal), 0, L - t * 1.6, 0);
  for (let i = 0; i < 6; i += 1) {
    const bay = box(D * 0.86, (L / 6) * 0.86, D * 0.86, CO.dark);
    put(bay, 0, ((i + 0.5) * L) / 6, 0);
    g.add(bay);
  }
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    rod(g, [Math.cos(a) * r * 0.7, L * 0.02, Math.sin(a) * r * 0.7], [Math.cos(a) * r * 0.7, -L * 0.14, Math.sin(a) * r * 0.7], t * 0.5, CO.gold);
  }
  return { group: g };
}

/* 1 t class lander: octagonal deck, four propellant tanks, engine, instrument lockers, hatch. */
function landerCAD(p) {
  const g = new THREE.Group(), D = p.dims.d ?? 3.6, L = p.dims.l ?? 2.5, r = D / 2.7;
  g.add(put(cyl(r, L * 0.5, CO.gold, { seg: 8 }), 0, L * 0.34, 0));
  g.add(put(cyl(r * 0.82, L * 0.32, CO.shell, { seg: 8 }), 0, L * 0.84, 0));
  const bell = mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.16, L * 0.3, 22, 1, true), CO.dark, { metal: 0.65, rough: 0.35 });
  put(bell, 0, L * 0.17, 0);
  g.add(bell);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    const tank = sph(r * 0.27, CO.tank, { metal: 0.45, rough: 0.4 });
    put(tank, x * r * 0.86, L * 0.58, z * r * 0.86);
    g.add(tank);
    rod(g, [x * r * 0.86, L * 0.34, z * r * 0.86], [x * r * 0.86, L * 0.48, z * r * 0.86], r * 0.035, CO.metal);
  }
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2, locker = box(r * 0.34, L * 0.3, r * 0.14, CO.shell);
    put(locker, Math.cos(a) * r * 0.95, L * 0.55, Math.sin(a) * r * 0.95, 0, -a, 0);
    g.add(locker);
  }
  const hatch = cyl(r * 0.22, r * 0.03, CO.hatch, { seg: 18 });
  put(hatch, 0, L * 1.16, 0);
  g.add(hatch);
  for (let i = 0; i < 2; i += 1) rod(g, [r * 1.05, L * 0.3, (i ? 1 : -1) * r * 0.4], [r * 1.05, L * 0.95, (i ? 1 : -1) * r * 0.4], r * 0.02, CO.metal);
  return { group: g };
}

/* Landing gear: four A-frame legs and footpads on the 4.3 m footprint. */
function legsCAD(p) {
  const g = new THREE.Group(), span = (p.dims.d ?? 4.3) / 2, h = p.dims.l ?? 1;
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    rod(g, [x * span * 0.16, h, z * span * 0.16], [x * span, h * 0.02, z * span], span * 0.014, CO.metal);
    rod(g, [x * span * 0.16, h, z * span * 0.16], [x * span, h * 0.02, z * span], span * 0.014, CO.metal);
    rod(g, [x * span * 0.22, h * 0.4, z * span * 0.22], [x * span * 0.72, h * 0.02, z * span * 0.72], span * 0.008, CO.metal);
    const pad = cyl(span * 0.09, h * 0.04, CO.dark, { seg: 16 });
    pad.position.set(x * span, 0, z * span);
    g.add(pad);
    rod(g, [x * span * 0.3, h * 0.55, z * span * 0.3], [x * span * 0.62, h * 0.1, z * span * 0.62], span * 0.006, CO.gold);
  }
  return { group: g };
}

/* Crewed capsule: heat shield, frustum shell, windows, hatch and docking tunnel. */
function capsuleCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 4.4, D = p.dims.d ?? 4.0, r = D / 2;
  const shield = mesh(new THREE.CylinderGeometry(r, r * 0.8, L * 0.08, 34), CO.dark, { metal: 0.4, rough: 0.7 });
  put(shield, 0, L * 0.04, 0);
  g.add(shield);
  g.add(put(mesh(new THREE.CylinderGeometry(r * 0.5, r, L * 0.6, 34), CO.shell), 0, L * 0.08, 0));
  g.add(put(cyl(r * 0.5, L * 0.1, CO.shell, { seg: 28 }), 0, L * 0.08 + L * 0.6, 0));
  const tunnel = cyl(r * 0.3, L * 0.16, CO.shell, { seg: 22 });
  put(tunnel, 0, L * 0.78, 0);
  g.add(tunnel);
  g.add(put(ringXZ(r * 0.32, r * 0.02, CO.metal), 0, L * 0.94, 0));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const w = cyl(r * 0.075, r * 0.02, CO.glass, { seg: 14 });
    const y = L * 0.34 + (i % 2) * L * 0.1;
    put(w, Math.cos(a) * r * 0.46, y, Math.sin(a) * r * 0.46, 0, -a, Math.PI / 2.6);
    g.add(w);
  }
  const hatch = cyl(r * 0.09, r * 0.03, CO.hatch, { seg: 16 });
  put(hatch, -r * 0.28, L * 0.3, r * 0.36, Math.PI / 2.4);
  g.add(hatch);
  return { group: g };
}

/* Service module / trunk: shell, four spherical tanks, RCS quads, main engine, body radiator. */
function serviceCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 3.7, D = p.dims.d ?? 4.0, r = D / 2;
  g.add(cyl(r, L, CO.shell, { seg: 30, open: true }));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const tank = sph(r * 0.3, CO.tank, { metal: 0.5, rough: 0.35 });
    put(tank, Math.cos(a) * r * 0.6, L * 0.45, Math.sin(a) * r * 0.6);
    g.add(tank);
  }
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2, nozzle = mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.06, r * 0.08, 10, 1, true), CO.dark, { metal: 0.6 });
    put(nozzle, Math.cos(a) * r * 0.96, L * (i % 2 ? 0.75 : 0.25), Math.sin(a) * r * 0.96, Math.PI / 2, 0, -a);
    g.add(nozzle);
  }
  const engine = mesh(new THREE.CylinderGeometry(r * 0.26, r * 0.1, L * 0.22, 22, 1, true), CO.dark, { metal: 0.65 });
  put(engine, 0, L * 0.03, 0, Math.PI);
  g.add(engine);
  for (const s of [-1, 1]) {
    const rad = box(r * 0.12, L * 0.7, r * 0.9, CO.rad, { metal: 0.3, rough: 0.55 });
    put(rad, s * r * 1.02, L * 0.5, 0);
    g.add(rad);
  }
  return { group: g };
}

/* 1 g habitat ring: torus deck, window strips on the outer face, six spokes and a hub. */
function ringCAD(p) {
  const g = new THREE.Group(), R = (p.dims.d ?? 111.8) / 2, deck = p.dims.l ?? 20, tube = deck / 2;
  const belt = mesh(new THREE.TorusGeometry(R, tube, 20, 160), CO.shell, { metal: 0.25, rough: 0.5 });
  belt.rotation.x = -Math.PI / 2;
  g.add(belt);
  const win = Math.max(deck * 0.05, 0.4);
  for (let i = 0; i < 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    const glass = box(tube * 0.5, win, tube * 0.06, CO.glass);
    put(glass, Math.cos(a) * (R + tube * 0.86), 0, Math.sin(a) * (R + tube * 0.86), 0, -a, 0);
    g.add(glass);
  }
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    rod(g, [Math.cos(a) * R * 0.97, 0, Math.sin(a) * R * 0.97], [Math.cos(a) * R * 0.3, 0, Math.sin(a) * R * 0.3], tube * 0.16, CO.metal);
  }
  const hub = cyl(tube * 0.95, tube * 1.3, CO.shell, { seg: 28 });
  put(hub, 0, -tube * 0.65, 0);
  g.add(hub);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const port = tor(tube * 0.22, tube * 0.03, CO.metal, { metal: 0.6 });
    port.rotation.x = Math.PI / 2;
    port.position.y = tube * 0.65;
    g.add(port);
    break;
  }
  return { group: g };
}

/* Pressurised cargo can: ribbed shell, cargo door, CBM rings at both ends. */
function cargoCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 5, D = p.dims.d ?? 5, r = D / 2;
  g.add(cyl(r, L, CO.mli, { seg: 26 }));
  for (let i = 1; i < 5; i += 1) g.add(ringXZ(r * 0.995, Math.max(D * 0.008, 0.02), CO.metal, (L * i) / 5));
  const door = cyl(r * 0.55, D * 0.02, CO.hatch, { seg: 20 });
  put(door, 0, L * 0.5, r * 0.98, Math.PI / 2);
  g.add(door);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pallet = box(r * 0.5, L * 0.25, r * 0.1, CO.shell);
    put(pallet, Math.cos(a) * r * 1.02, L * 0.28, Math.sin(a) * r * 1.02, 0, -a, 0);
    g.add(pallet);
  }
  return { group: g };
}

/* Deployable sail mast: three CFRP longerons on a triangular section, battens and diagonals, and the
   deployer can at the base. Stations are capped at 40 so a 215 m mast does not become 500 meshes. */
function mastCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 1, r = Math.max((p.dims.d ?? 0.3) / 2, 0.02);
  g.add(cyl(r * 1.7, Math.min(L * 0.07, 0.6), CO.metal, { seg: 16 }));
  const n = Math.max(3, Math.min(40, Math.round(L / Math.max(1.2, L / 40))));
  const step = L / n;
  for (let k = 0; k < 3; k += 1) {
    const a = (k / 3) * Math.PI * 2;
    rod(g, [Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * r, L, Math.sin(a) * r], r * 0.11, CO.metal, { seg: 6 });
  }
  for (let i = 1; i <= n; i += 1) {
    const y = i * step;
    for (let k = 0; k < 3; k += 1) {
      const a0 = (k / 3) * Math.PI * 2, a1 = ((k + 1) / 3) * Math.PI * 2;
      rod(g, [Math.cos(a0) * r, y, Math.sin(a0) * r], [Math.cos(a1) * r, y, Math.sin(a1) * r], r * 0.07, CO.grey, { seg: 4 });
      if (i < n) rod(g, [Math.cos(a0) * r, y, Math.sin(a0) * r], [Math.cos(a1) * r, y + step, Math.sin(a1) * r], r * 0.045, CO.grey, { seg: 4 });
    }
  }
  return { group: g };
}

/* Sail-mast thrust collar: ring frame on the berthing plane, four struts up to the bolted mast root. */
function collarCAD(p) {
  const g = new THREE.Group(), D = p.dims.d ?? 4.6, L = p.dims.l ?? 1.2, r = D / 2;
  g.add(ringXZ(r, Math.max(D * 0.03, 0.02), CO.metal, L * 0.92));
  g.add(ringXZ(r * 0.99, Math.max(D * 0.02, 0.015), CO.gold, L * 0.02));
  g.add(put(cyl(r * 0.13, L, CO.metal, { seg: 16 }), 0, 0, 0));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(g, [0, L * 0.92, 0], [Math.cos(a) * r * 0.95, L * 0.12, Math.sin(a) * r * 0.95], D * 0.012, CO.metal);
  }
  return { group: g };
}

/* Despun hub: the non-rotating core the ring turns on -- bearing lands, slip-ring bands, conduits. */
function despinCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 8, D = p.dims.d ?? 10, r = D / 2;
  g.add(cyl(r * 0.82, L, CO.shell, { seg: 32 }));
  g.add(ringXZ(r * 0.86, r * 0.045, CO.gold, 0.12), ringXZ(r * 0.86, r * 0.045, CO.gold, L - 0.12));
  for (let i = 1; i <= 3; i += 1) g.add(ringXZ(r * 0.9, r * 0.028, CO.metal, (L * i) / 4));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    rod(g, [Math.cos(a) * r * 0.82, 0.2, Math.sin(a) * r * 0.82], [Math.cos(a) * r * 0.82, L - 0.2, Math.sin(a) * r * 0.82], r * 0.02, CO.metal, { seg: 5 });
  }
  put(cyl(r * 0.2, L * 0.25, CO.dark, { seg: 18 }), 0, L, 0);
  return { group: g };
}

/* Fission surface power module: shield cone, core drum, heat-pipe radiator wings. */
function reactorCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 14, D = p.dims.d ?? 6, r = D / 2;
  const cone = mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.95, L * 0.22, 26), CO.dark, { metal: 0.4, rough: 0.6 });
  put(cone, 0, L * 0.11, 0);
  g.add(cone);
  g.add(put(cyl(r * 0.5, L * 0.34, CO.metal, { seg: 20 }), 0, L * 0.22, 0));
  g.add(put(cyl(r * 0.34, L * 0.1, CO.accent, { seg: 18 }), 0, L * 0.56, 0));
  for (const s of [-1, 1]) {
    const wing = box(L * 0.5, Math.max(L * 0.012, 0.05), r * 1.4, CO.rad, { metal: 0.35, rough: 0.5 });
    put(wing, 0, L * 0.66, s * r * 0.8);
    g.add(wing);
    for (let i = 1; i < 4; i += 1) {
      const pipe = cyl(Math.max(r * 0.012, 0.01), L * 0.5, CO.gold, { seg: 6 });
      put(pipe, (i / 4 - 0.5) * r * 1.2, L * 0.66, s * r * 0.8, Math.PI / 2, 0, 0);
      g.add(pipe);
    }
  }
  rod(g, [0, L * 0.56, 0], [0, L, 0], Math.max(r * 0.05, 0.03), CO.metal);
  return { group: g };
}

/* Pressurised mating adapter: CBM ring at the base, docking tunnel and IDSS petals at the top. */
function pmaCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 2, D = p.dims.d ?? 2.2, r = D / 2;
  g.add(cyl(r, L * 0.86, CO.mli, { seg: 26 }));
  g.add(ringXZ(r * 0.96, Math.max(D * 0.035, 0.02), CO.metal, 0.04));
  g.add(ringXZ(r * 0.62, Math.max(D * 0.03, 0.02), CO.metal, L * 0.9));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const petal = box(D * 0.1, D * 0.05, D * 0.26, CO.hatch);
    put(petal, Math.cos(a) * D * 0.28, L * 0.93, Math.sin(a) * D * 0.28, 0, -a, 0);
    g.add(petal);
  }
  return { group: g };
}

/* Jettisonable sail stage: IDSS ring on the capsule side, mast root on the other, three struts. */
function sailStageCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 0.9, D = p.dims.d ?? 1.6, r = D / 2;
  g.add(ringXZ(r * 0.95, Math.max(D * 0.04, 0.015), CO.metal, 0.02));
  g.add(ringXZ(r * 0.34, Math.max(D * 0.05, 0.02), CO.gold, L));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    rod(g, [Math.cos(a) * r * 0.9, 0.02, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.3, L, Math.sin(a) * r * 0.3], Math.max(D * 0.02, 0.01), CO.metal);
    const petal = box(D * 0.14, D * 0.04, D * 0.1, CO.hatch);
    put(petal, Math.cos(a) * r * 0.86, 0.04, Math.sin(a) * r * 0.86, 0, -a, 0);
    g.add(petal);
  }
  return { group: g };
}

/* Drive module: the stage a driven class carries instead of a sail. It is bolted to the hull through a
   conical thrust frame, carries its propellant in a tank or a pulse-unit magazine sized from its bulk
   density, and ends in an engine bay -- nozzle bells for a rocket, a pusher plate on its shock
   absorbers for a pulse drive -- with four radiator panels on booms for the heat the drive cannot send
   out of the nozzle. Every dimension is read from the plan, so the drawing cannot disagree with the
   rocket equation. The first cut drew a tank 3.6x the propellant's volume with two 25 m slabs on its
   flanks, which is what those plates were. */
function driveCAD(p) {
  const g = new THREE.Group();
  const L = Math.max(p.dims?.l ?? 1, 0.05), D = Math.max(p.dims?.d ?? 1, 0.05);
  const store = p.store ?? { kind: 'tank', l: L, d: D, unitKg: null, unitCount: null };
  const magazine = store.kind === 'magazine';
  const frameL = Math.max(p.frame?.l ?? 0, 0);
  const bayL = Math.max(p.bayL ?? 0, 0);
  const rS = Math.max(store.d / 2, 0.02);
  const rI = Math.max((p.interfaceD ?? Math.min(1.2, D)) / 2, 0.015);
  const storeL = Math.max(Math.min(store.l || L, L - frameL - bayL), 0.04);
  const yS = frameL, yE = frameL + storeL;

  if (p.driveKind === 'beamed') {
    /* No propellant and no engine: the accelerator stays home, so the craft carries a catching coil,
       its struts and a beacon, and nothing that burns. */
    const coilR = Math.max(D / 2, 0.02), coilY = L * 0.72;
    g.add(ringXZ(coilR, Math.max(coilR * 0.07, 0.002), CO.gold, coilY));
    g.add(ringXZ(coilR * 0.76, Math.max(coilR * 0.04, 0.0015), CO.metal, coilY - coilR * 0.14));
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      rod(g, [Math.cos(a) * coilR * 0.2, coilY, Math.sin(a) * coilR * 0.2], [Math.cos(a) * coilR * 0.92, coilY, Math.sin(a) * coilR * 0.92], Math.max(coilR * 0.02, 0.001), CO.metal, { seg: 5 });
    }
    g.add(put(cyl(coilR * 0.2, L * 0.7, CO.dark, { seg: 18 }), 0, 0, 0));
    g.add(ringXZ(coilR * 0.52, Math.max(coilR * 0.03, 0.001), CO.grey, L * 0.05));
    return { group: g };
  }

  /* 1. Thrust frame: the mount ring on the hull's face, a cone out to the store's fore ring, five
     longerons carrying the compression, and a load-spreading ring at the store end. */
  if (frameL > 0.01) {
    g.add(put(mesh(new THREE.CylinderGeometry(rS * 0.94, rI, frameL, 28, 1, true), CO.metal, { metal: 0.5, rough: 0.4 }), 0, frameL / 2, 0));
    g.add(ringXZ(rI, Math.max(rI * 0.12, 0.008), CO.gold, 0.01));
    g.add(ringXZ(rS * 0.96, Math.max(rS * 0.035, 0.008), CO.metal, frameL - Math.max(rS * 0.02, 0.004)));
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      rod(g, [Math.cos(a) * rI * 1.05, 0.01, Math.sin(a) * rI * 1.05], [Math.cos(a) * rS * 0.92, frameL, Math.sin(a) * rS * 0.92], Math.max(rS * 0.012, 0.004), CO.grey, { seg: 5 });
    }
  }

  /* 2. The store. A tank is a barrel with two domes, MLI bands and a feed line; a magazine is a ribbed
     drum with bays and doors, because its contents are discrete. */
  if (magazine) {
    g.add(put(cyl(rS, storeL, CO.mli, { seg: 30 }), 0, yS, 0));
    const ribs = Math.max(2, Math.min(10, Math.round(storeL / Math.max(rS, 0.4))));
    for (let i = 1; i < ribs; i += 1) g.add(ringXZ(rS * 1.004, Math.max(rS * 0.018, 0.004), CO.metal, yS + (storeL * i) / ribs));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const door = box(rS * 0.05, storeL * 0.6, rS * 0.68, CO.hatch, { metal: 0.45, rough: 0.5 });
      put(door, Math.cos(a) * rS * 1.02, yS + storeL * 0.5, Math.sin(a) * rS * 1.02, 0, -a, 0);
      g.add(door);
      rod(g, [Math.cos(a) * rS * 1.03, yS, Math.sin(a) * rS * 1.03], [Math.cos(a) * rS * 1.03, yE, Math.sin(a) * rS * 1.03], Math.max(rS * 0.012, 0.004), CO.metal, { seg: 5 });
    }
  } else {
    const dome = Math.min(rS * 0.6, storeL * 0.16);
    g.add(put(cyl(rS, storeL - 2 * dome, CO.tank, { seg: 34 }), 0, yS + dome, 0));
    g.add(put(cyl(rS * 0.42, dome, CO.tank, { r2: rS, seg: 34 }), 0, yS, 0));
    g.add(put(cyl(rS, dome, CO.tank, { r2: rS * 0.42, seg: 34 }), 0, yE - dome, 0));
    for (let i = 1; i <= 3; i += 1) g.add(ringXZ(rS * 1.006, Math.max(rS * 0.022, 0.005), CO.gold, yS + dome + ((storeL - 2 * dome) * i) / 4));
    for (const s of [-1, 1]) {
      rod(g, [s * rS * 1.02, yS + dome * 0.6, 0], [s * rS * 1.02, yE - dome * 0.6, 0], Math.max(rS * 0.014, 0.005), CO.metal, { seg: 5 });
    }
  }

  /* 3. The aft end. A magazine needs no nozzle: its plate is the structure the pulses act on, so it
     stands off the store on eight shock absorbers. Anything else ends in a thrust structure and a
     cluster of bells that open away from the hull. */
  if (magazine) {
    const plateR = Math.max((p.plateD ?? D) / 2, rS * 1.02);
    const plateT = Math.max(D * 0.025, 0.02);
    const yPlate = L - plateT;
    g.add(put(cyl(plateR, plateT, CO.dark, { seg: 40 }), 0, yPlate, 0));
    const rim = tor(plateR * 0.97, Math.max(plateR * 0.025, 0.008), CO.metal, { metal: 0.5, rough: 0.45 });
    put(rim, 0, yPlate + plateT * 0.5, 0, Math.PI / 2);
    g.add(rim);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      rod(g, [Math.cos(a) * rS * 0.82, yE, Math.sin(a) * rS * 0.82], [Math.cos(a) * plateR * 0.7, yPlate, Math.sin(a) * plateR * 0.7], Math.max(rS * 0.03, 0.006), CO.metal, { seg: 6 });
    }
    rod(g, [0, yE, 0], [0, yPlate, 0], Math.max(rS * 0.07, 0.01), CO.grey, { seg: 10 });
  } else {
    g.add(put(cyl(rS * 0.94, Math.max(bayL * 0.55, 0.04), CO.shell, { seg: 30 }), 0, yE, 0));
    const nR = Math.max(rS * 0.2, 0.008), yExit = L - Math.max(bayL * 0.05, 0.008);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, rr = rS * 0.44;
      const bell = mesh(new THREE.CylinderGeometry(nR, nR * 0.45, Math.max(bayL * 0.7, 0.03), 18, 1, true), CO.dark, { metal: 0.6, rough: 0.4 });
      put(bell, Math.cos(a) * rr, yExit - Math.max(bayL * 0.35, 0.015), Math.sin(a) * rr);
      g.add(bell);
    }
    g.add(ringXZ(rS * 0.72, Math.max(rS * 0.028, 0.005), CO.gold, Math.min(yE + rS * 0.06, L - 0.01)));
  }

  /* 4. Radiators on booms, two panels a side, sized from the heat the drive rejects. They hang in the
     plane of the stack like a solar wing rather than standing off it as a slab. */
  const rad = p.radiator;
  if (rad && rad.areaM2 > 0.02 && storeL > 0.1) {
    const half = rad.areaM2 / 4;
    let pLen = Math.min(rad.lengthM, 0.46 * storeL);
    let pWid = Math.max(half / Math.max(pLen, 1e-6), 0.3);
    if (pWid > rS * 1.8) { pWid = rS * 1.8; pLen = half / pWid; }
    const thick = Math.max(pWid * 0.012, 0.006);
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) {
        const yc = yS + storeL / 2 + k * (pLen / 2 + storeL * 0.03);
        const xIn = s * rS * 1.02, xOut = s * (rS * 1.02 + pWid);
        const panel = box(pWid, pLen, thick, CO.rad, { mat: { metal: 0.3, rough: 0.55 } });
        put(panel, (xIn + xOut) / 2, yc, 0);
        g.add(panel);
        for (let i = 1; i < 4; i += 1) {
          const rib = box(pWid * 0.98, thick * 1.6, thick * 2.2, CO.metal, { metal: 0.6, rough: 0.3 });
          put(rib, (xIn + xOut) / 2, yc - pLen / 2 + (pLen * i) / 4, 0);
          g.add(rib);
        }
        rod(g, [xOut, yc - pLen / 2, 0], [xOut, yc + pLen / 2, 0], Math.max(pWid * 0.02, 0.004), CO.metal, { seg: 5 });
        rod(g, [xIn, yc, 0], [xOut, yc, 0], Math.max(pWid * 0.03, 0.005), CO.metal, { seg: 5 });
      }
    }
  }
  return { group: g };
}

/* Spin ring: a 300 degree shell so the interior shows, one annular floor per deck alternating living
   (warm) and working (blue), six spokes and the de-spun hub. This is the drawing that carries the
   internal layout: the wedge that is missing is the cutaway. */
function centrifugeCAD(p) {
  const g = new THREE.Group();
  const D = Math.max(p.dims.l ?? 10, 1), tube = D / 2;
  const R = Math.max(((p.dims.d ?? 40) - D) / 2, tube);
  const arc = Math.PI * 2 * (5 / 6), gap = Math.PI * 2 - arc;
  /* The cutaway is a missing 60 degree wedge, not a tilt: the ring has to stay in its own plane or
     it stands up out of the deck and the hull envelope swallows it (a 114.8 m ring read 144 m). The
     torus lies in its own xy plane with the wedge at the end of the arc, so one -90 degree turn
     about x lays it flat and nothing else may be rotated at the same time. */
  const shellFrame = new THREE.Group();
  shellFrame.rotation.x = -Math.PI / 2;
  shellFrame.add(mesh(new THREE.TorusGeometry(R, tube, 16, 96, arc), CO.shell, { metal: 0.25, rough: 0.5 }));
  g.add(shellFrame);
  const decks = Math.max(1, Math.floor((D - 1.2) / 3));
  for (let i = 0; i < decks; i += 1) {
    const floor = mesh(new THREE.RingGeometry(R - tube * 0.82, R + tube * 0.82, 96, 1, 0, arc), i % 2 ? CO.array : CO.rad, { metal: 0.2, rough: 0.7 });
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -tube + 1.8 + i * 3;
    g.add(floor);
  }
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    rod(g, [Math.cos(a) * Math.max(tube * 0.9, 0.4), 0, Math.sin(a) * Math.max(tube * 0.9, 0.4)], [Math.cos(a) * R, 0, Math.sin(a) * R], Math.max(tube * 0.05, 0.08), CO.metal);
  }
  g.add(put(cyl(tube * 0.85, tube * 1.1, CO.shell, { seg: 24 }), 0, -tube * 0.55, 0));
  g.add(ringXZ(tube * 0.55, Math.max(tube * 0.03, 0.02), CO.metal, tube * 0.55));
  return { group: g };
}

/* Spin-ring bearing: fixed hub, rotating collar, slip-ring band between them. */
function spinBearingCAD(p) {
  const g = new THREE.Group(), L = p.dims.l ?? 1, D = p.dims.d ?? 4, r = D / 2;
  g.add(cyl(r * 0.55, L, CO.metal, { seg: 26 }));
  g.add(ringXZ(r * 0.95, Math.max(D * 0.04, 0.02), CO.gold, L * 0.5));
  g.add(ringXZ(r * 0.7, Math.max(D * 0.03, 0.015), CO.dark, L * 0.05));
  g.add(ringXZ(r * 0.7, Math.max(D * 0.03, 0.015), CO.dark, L * 0.95));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    rod(g, [Math.cos(a) * r * 0.5, L * 0.05, Math.sin(a) * r * 0.5], [Math.cos(a) * r * 0.5, L * 0.95, Math.sin(a) * r * 0.5], Math.max(D * 0.012, 0.01), CO.grey, { seg: 5 });
  }
  return { group: g };
}

/** A cylinder with an end ring: the honest fallback for a kind with no builder of its own. */
function genericCAD(p) {
  const g = new THREE.Group(), r = Math.max((p.dims?.d ?? 0) / 2, 1e-4), L = Math.max(p.dims?.l ?? 0, 1e-4);
  const body = cyl(r, L, p.kind === 'radiator' ? CO.rad : CO.shell, { seg: 24 });
  if (p.origin === 'centre') body.position.y = -L / 2;
  g.add(body);
  return { group: g };
}

const BUILDERS = {
  'pressurised-module': moduleCAD,
  node: nodeCAD,
  radiator: radiatorCAD,
  'solar-array': arrayCAD,
  bus: busCAD,
  payload: chipCAD,
  adapter: dispenserCAD,
  lander: landerCAD,
  'landing-gear': legsCAD,
  'crew-capsule': capsuleCAD,
  'service-module': serviceCAD,
  'habitat-ring': ringCAD,
  cargo: cargoCAD,
  mast: mastCAD,
  'thrust-collar': collarCAD,
  'despin-hub': despinCAD,
  reactor: reactorCAD,
  pma: pmaCAD,
  'dock-adapter': sailStageCAD,
  centrifuge: centrifugeCAD,
  'spin-bearing': spinBearingCAD,
  drive: driveCAD
};

function centauriPart(p) {
  const build = BUILDERS[p.kind] ?? genericCAD;
  return build(p);
}

/* ------------------------------------------------------------------ *
 * The origami sail film
 * ------------------------------------------------------------------ */

/** The film as a hexagonal flasher carrying `side * side` of area: six gores, a pinwheel shoulder
 *  ring, a hub opening and six rim booms. `setDeploy(k)` recomputes the vertex positions from
 *  parts/flasher.js, so the drawn film is the fold law rather than a decoration of it. */
function sailFilm(side, opts = {}) {
  const g = new THREE.Group();
  const detail = opts.detail !== false;
  const R = flasherRadius(side * side);
  const filmMat = mat(0xa8d4ff, { metal: 0.45, rough: 0.34, emissive: 0x2b4c70, alpha: 0.5 });
  const creaseMat = new THREE.LineBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.32 });
  const pattern = faces();

  /* 18 vertices (hub, shoulder, rim per sector) and 24 triangles: the film mesh is one buffer that
     the deployment rewrites, because a flasher is a mechanism, not a set of hinges on pivots. */
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(pattern.vertices.length * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tri = [];
  for (const q of pattern.quads) { const c = q.corners; tri.push(c[0], c[1], c[2], c[0], c[2], c[3]); }
  geo.setIndex(tri);
  const film = new THREE.Mesh(geo, filmMat);
  film.frustumCulled = false;
  g.add(film);

  const creaseList = creases().filter((c) => c.kind !== 'cut');
  const lp = new Float32Array(creaseList.length * 6);
  const lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lines = new THREE.LineSegments(lgeo, creaseMat);
  lines.frustumCulled = false;
  if (detail) g.add(lines);

  /* The hub is the interface the film winds onto, so it stays put while the film contracts to it:
     at full stow the pack is 0.161 R across and the hub is 0.14 R, which is the tight fit the fold
     law predicts rather than a coincidence. */
  const hub = tor(Math.max(R * FLASHER.hubFrac, 1e-6), Math.max(side * 0.0015, 1e-8), CO.metal, { metal: 0.6, rough: 0.3 });
  hub.rotation.x = Math.PI / 2;
  g.add(hub);

  /* Six rim booms to the corners with a steering vane at each: a 100 nm film cannot hold its own
     shape, and a beam-rider trims with vanes rather than thrusters. They scale with the film. */
  const arms = new THREE.Group();
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = -(SECTOR * i);
    rod(arm, [R * FLASHER.hubFrac, 0, 0], [R, 0, 0], Math.max(side * 0.0022, 1e-8), CO.metal, { seg: 5 });
    const vane = box(Math.max(side * 0.03, 1e-7), Math.max(side * 0.0015, 1e-9), Math.max(side * 0.008, 1e-8), CO.gold, { metal: 0.75, rough: 0.2 });
    put(vane, R * 0.94, 0, Math.max(side * 0.006, 1e-8));
    arm.add(vane);
    arms.add(arm);
  }
  if (detail) g.add(arms);

  const write = (k) => {
    const lam = lambdaFor(k);
    const d = deploy(lam, { radiusM: R });
    const idx = pattern.index;
    for (let i = 0; i < FLASHER.sectors; i += 1) {
      for (const ring of ['H', 'S', 'O']) {
        const v = idx[ring][i], p = d.points[ring][i];
        pos[v * 3] = p[0]; pos[v * 3 + 1] = p[1]; pos[v * 3 + 2] = p[2];
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    n = 0;
    for (const c of creaseList) {
      const p = d.points[c.a[0]][c.a[1]], q = d.points[c.b[0]][c.b[1]];
      lp[n] = p[0]; lp[n + 1] = p[1]; lp[n + 2] = p[2];
      lp[n + 3] = q[0]; lp[n + 4] = q[1]; lp[n + 5] = q[2];
      n += 6;
    }
    lgeo.attributes.position.needsUpdate = true;
    arms.scale.set(d.scale, 1, d.scale);
    g.userData.lambda = lam;
    g.userData.stage = d.stage;
  };
  let n = 0;
  g.userData.setDeploy = write;
  write(1);
  return g;
}

/* ------------------------------------------------------------------ *
 * The eight craft
 * ------------------------------------------------------------------ */

const span = (v) => {
  const n = (x) => String(Number(x.toPrecision(3)));
  if (v >= 1000) return `${n(v / 1000)} km`;
  if (v >= 1) return `${n(v)} m`;
  return `${n(v * 100)} cm`;
};

/** Build one class from its solved assembly. Returns a Group with the viewer's hooks:
 *  fitAxis null (true size), label, setDeploy, and a two-stage explode map. */
export function buildCentauriModel(id) {
  const m = measure(id, {});
  const g = new THREE.Group();
  const hullStage = new THREE.Group();
  const sailStage = new THREE.Group();
  hullStage.userData.stage = 0;
  sailStage.userData.stage = 1;
  g.add(hullStage, sailStage);

  const deployers = [];
  const box3 = new THREE.Box3();
  for (const n of m.solved.nodes) {
    const p = n.part;
    if (p.kind === 'sail') continue;
    const built = centauriPart(p);
    for (const port of p.ports ?? []) addPortRing(built.group, port);
    const frame = new THREE.Group();
    frame.position.fromArray(n.world.position);
    frame.quaternion.fromArray(n.world.quaternion);
    frame.add(built.group);
    hullStage.add(frame);
    if (built.setDeploy) deployers.push(built.setDeploy);
    frame.updateMatrixWorld(true);
    /* The mast is structure, not hull: counting it made the capsule read "hull 19.9 m" for a 9 m
       craft and squeezed the drawn sail against a length that is mostly standoff. */
    if (p.kind !== 'mast') box3.expandByObject(frame);
  }

  const span3 = box3.getSize(new THREE.Vector3());
  const hullSpan = Math.max(span3.x, span3.y, span3.z, 1e-6);

  /* The driven versions have no film at all: same hull, no sail stage, and the label reports the
     drive and its cruise instead of the sail and its draw-down ratio. */
  const sailNode = m.solved.nodes.find((n) => n.part.kind === 'sail');
  const trueSide = sailNode ? sailSquareSide(sailNode.part.sail.areaM2) : 0;
  /* Three hull spans keeps the craft itself a third of the picture -- at twelve it was a dot in the
     middle of a grey square, at five barely better; the 5 m floor keeps the wafer's 1.71 m film at
     true size next to the 1.8 m person, which is the point of that model. The ratio is on the label. */
  const drawnSide = sailNode ? Math.min(trueSide, Math.max(3 * hullSpan, 5)) : 0;
  const ratio = sailNode ? trueSide / drawnSide : 1;
  let film = null;
  if (sailNode) {
    film = sailFilm(drawnSide, { detail: ratio < 2 });
    film.position.fromArray(sailNode.world.position);
    /* The mate solver leaves the roll of a one-axis hinge free, so a square film comes out diamond-wise
       to the craft. That roll is a free degree of freedom -- the film turns on its hub -- so it is taken
       out about the sail's own normal and the square sits square to the frame. */
    const q = new THREE.Quaternion().fromArray(sailNode.world.quaternion);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q).projectOnPlane(normal).normalize();
    const ref = new THREE.Vector3(1, 0, 0).projectOnPlane(normal);
    if (ref.lengthSq() < 1e-9) ref.set(0, 0, 1).projectOnPlane(normal);
    ref.normalize();
    const roll = Math.atan2(new THREE.Vector3().crossVectors(ref, edge).dot(normal), ref.dot(edge));
    film.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(normal, -roll));
    sailStage.add(film);
  }

  /* The assembly's thrust axis is +y and the film's normal is +y; turn the craft so the film faces
     the default camera, then a little off-axis so the hull is not hidden behind its own disc. */
  g.rotation.set(-Math.PI / 2, -0.42, 0);

  const setDeploy = (k) => {
    if (film) film.userData.setDeploy(k);
    for (const d of deployers) d(k);
  };
  setDeploy(1);

  /* CG, thrust axis and hub datum: the three annotations a real drawing carries, drawn at the hull's
     own scale. The axis runs from the aft face through the film's hub, so a mis-mounted sail shows. */
  const datum = new THREE.Group();
  const cgMark = sph(Math.max(hullSpan * 0.012, 1e-4), CO.accent, { metal: 0.2, rough: 0.4 });
  cgMark.position.fromArray(m.geometry.cgHull);
  datum.add(cgMark);
  const axisR = Math.max(hullSpan * 0.002, 1e-5);
  /* The thrust-axis annotation runs from the mast root to the film hub. It used to start a mast
     length below the hull's top, which drew a line straight through the craft and out the bottom. */
  if (m.geometry.sailAt) rod(datum, [m.geometry.sailAt[0], m.geometry.hullTopY, m.geometry.sailAt[2]], [m.geometry.sailAt[0], m.geometry.sailAt[1], m.geometry.sailAt[2]], axisR, CO.accent, { seg: 5 });
  hullStage.add(datum);

  g.userData.fitAxis = null;
  g.userData.top = hullSpan;
  g.userData.stages = new Map([[0, hullStage], [1, sailStage]]);
  g.userData.setDeploy = setDeploy;
  /* A percent with one decimal is right for 9.9 % and useless for the ion ship's 0.039 %, which came
     out of the first cut as "0.0 % c". Below one percent the label switches to two significant digits. */
  const pc = m.propulsion ? m.propulsion.beta * 100 : 0;
  g.userData.label = m.propulsion
    ? `stack ${span(hullSpan)} · ${m.propulsion.drive.short} · ${pc >= 1 ? pc.toFixed(1) : pc.toPrecision(2)} % c · ${m.propulsion.closes ? `${m.propulsion.tripYears.toFixed(0)} yr` : 'no route'}`
    : `hull ${span(hullSpan)}${m.geometry.mastLenM > 0 ? ` · mast ${span(m.geometry.mastLenM)}` : ' · hub-mounted'} · sail ${span(2 * flasherRadius(trueSide * trueSide))} flasher${ratio > 1.02 ? ` · drawn 1:${Math.round(ratio)}` : ' · true size'}`;
  return g;
}

/* The part builders and the primitives, for other model files (parts/robotic-models.js draws the v5
   ships with these and adds its own kinds); nothing here changes what buildCentauriModel draws. */
export { centauriPart, addPortRing, BUILDERS, CO, mat, mesh, cyl, box, tor, sph, put, rod, ringXZ, span };
