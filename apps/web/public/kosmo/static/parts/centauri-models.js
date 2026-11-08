/* centauri-models.js -- the Centauri craft, as CAD built from their solved assemblies.

   Nothing here is posed by hand. parts/fleet.js solves the assembly from its mates and this module
   draws what the solver placed: one builder per part kind, each a thin composition of the primitives
   in parts/primitives/mesh.js (hull segments, tanks, lofted noses, trusses, radiators, dishes, legs,
   grid fins, hatches, port rings, instanced windows) in the PBR surfaces of parts/primitives/materials.js
   (painted steel with panel lines, brushed stainless, black TPS tiles, gold MLI, solar cells, lit
   glazing). A mating ring stands at every structural port so the berthing planes are visible, and the
   origami film from parts/origami.js is what the viewer's unfold control drives.

   Two scales are in the same picture and both are printed on the label:
     hull   true size, always
     sail   true size while that stays legible, otherwise 3 hull spans, and the label says by how much
            it was drawn down -- a colony's film is hundreds of km across against a 142 m ring.

   Axes: parts are built in their own frame, +y along the part, base at y = 0, except where the
   catalogue says origin: 'centre'. The solver's quaternion then turns each part onto the craft's
   thrust axis, so the assembly is the same one the lab measures. */

import * as THREE from 'three';
import { measure } from './fleet.js';
import { sailSquareSide, accordionAngles, FLASHER, SECTOR, flasherRadius, deploy, faces, creases, lambdaFor } from './origami.js';
import { surface } from './primitives/materials.js';
import {
  put, cyl, box, tor, sph, lathe, rod, ringXZ, instances, tankMesh, fairingMesh, hullSegmentMesh, torusDeckMesh, trussMesh,
  accordionStrip, radiatorMesh, solarArrayMesh, dishMesh, bellMesh, rcsQuadMesh, gridFinMesh, landingLegMesh, hatchMesh, portRingMesh, navLights, copvClusterMesh,
  onCylinder, saddleMesh, seatedBlock, palletMesh, shellPanel, dockingPortMesh, standoffPlate, cableTrayMesh
} from './primitives/mesh.js';
import { haackProfile, domeProfile, bellSpec } from './primitives/spec.js';
import { driveRadiatorPanels } from './geometry-audit.js';
import { liveryFor } from './primitives/livery.js';
import { mechanismsFor } from './sail-mechanics.js';
import { sailMechanismMesh } from './primitives/sail-mesh.js';

const Y = new THREE.Vector3(0, 1, 0);

/** A visible mating plane at every structural port. Hinges and service connectors are not hatches. */
const PORT_D = { 'paf-937': 0.937, 'paf-1194': 1.194, 'paf-1575': 1.575, 'idss-1200': 1.2, cbm: 1.27, 'lightband-12': 0.298 };
function addPortRing(g, port) {
  const d = PORT_D[port.type];
  if (!d || /^(mount|hub|root|sailmount|rtg|hga|bay|berth|legmount|finmount|spinhub)/.test(port.id)) return;
  const ring = portRingMesh(d);
  ring.position.fromArray(port.at);
  ring.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...port.axis).normalize());
  g.add(ring);
}

/* RCS quads around a body at height y, radius r: four pods at 45 degrees. */
function quadsAround(g, r, y, n = 4, size = null) {
  const d = size ?? Math.max(0.12, Math.min(0.5, r * 0.18));
  for (let i = 0; i < n; i += 1) { const a = (i / n) * Math.PI * 2 + Math.PI / 4; const q = rcsQuadMesh({ d }); put(q, Math.cos(a) * (r + d * 0.3), y, Math.sin(a) * (r + d * 0.3), 0, -a, 0); g.add(q); }
}

/* ------------------------------------------------------------------ *
 * Part builders: one per catalogue kind
 * ------------------------------------------------------------------ */

/** Azimuths round a part (its +y axis) that stay clear of its radial ports: where a pallet or a cable tray can run
 *  without lying under a berth. `n` of them, the farthest from any port first, at least 50 degrees apart. */
function freeAzimuths(p, n) {
  const radial = (p.ports ?? []).filter((q) => Math.abs(q.axis[1]) < 0.5 && !q.interior).map((q) => Math.atan2(q.axis[2], q.axis[0]));
  const dist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const cands = []; for (let i = 0; i < 24; i += 1) { const a = (i / 24) * Math.PI * 2 + Math.PI / 24; cands.push({ a, score: radial.length ? Math.min(...radial.map((r) => dist(a, r))) : 1 }); }
  cands.sort((x, y) => y.score - x.score);
  const out = []; for (const c of cands) { if (out.length >= n) break; if (out.every((o) => dist(o, c.a) > 0.87)) out.push(c.a); }
  return out;
}

/* ISS-class laboratory or stores module: pressure hull, pallets, MLI, windows, cable tray. */
function moduleCAD(p) {
  const stores = p.kind === 'stores-module';
  const az = freeAzimuths(p, stores ? 3 : 5);
  const g = hullSegmentMesh({ d: p.dims.d, l: p.dims.l, endKind: 'round', skin: stores ? 'offwhite' : 'white', windows: stores ? 0 : 2, racks: 0, hatchSide: stores, raceway: false });
  const r = p.dims.d / 2, barrelL = g.userData.hull.barrelL;
  const tray = cableTrayMesh({ l: barrelL * 0.9, w: Math.max(0.12, Math.min(0.2, r * 0.08)) }); onCylinder(tray, r, az[0], p.dims.l / 2); g.add(tray);
  for (const a of az.slice(1, stores ? 2 : 5)) { const pal = palletMesh({ r, w: Math.min(r * 0.55, 1.6), l: Math.min(barrelL * 0.45, 4.2), h: Math.min(r * 0.3, 0.9), boxes: 3 }); onCylinder(pal, r, a, p.dims.l / 2); g.add(pal); }
  return { group: g };
}

/* Node: short drum, four radial CBM berths with hatches and rings, grapple fixture. */
function nodeCAD(p) {
  const g = new THREE.Group(), r = p.dims.d / 2, L = p.dims.l;
  g.add(hullSegmentMesh({ d: p.dims.d, l: L, endKind: 'cone', skin: 'white', windows: 0, racks: 0, bands: 2, raceway: false }));
  { const tray = cableTrayMesh({ l: L * 0.6, w: Math.max(0.12, Math.min(0.2, r * 0.08)) }); onCylinder(tray, r, freeAzimuths(p, 1)[0] ?? Math.PI / 4, L / 2); g.add(tray); }
  for (const port of p.ports.filter((q) => q.type === 'cbm' && !/aft|fore/.test(q.id))) {
    const dir = new THREE.Vector3(...port.axis).normalize(), q = new THREE.Quaternion().setFromUnitVectors(Y, dir);
    const stub = cyl(0.75, 0.5, 'white', { seg: 28, repeat: [2, 1] }); stub.quaternion.copy(q); stub.position.set(dir.x * r * 0.8, port.at[1], dir.z * r * 0.8); g.add(stub);
    const hatch = hatchMesh(1.27); hatch.quaternion.copy(q); hatch.position.copy(dir.clone().multiplyScalar(r * 0.8 + 0.5)).setY(port.at[1]); g.add(hatch);
  }
  put(cyl(r * 0.05, L * 0.1, 'grey', { seg: 8 }), 0, L, 0);
  g.add(navLights([{ p: [r * 1.02, L * 0.5, 0], kind: 'navGreen', r: r * 0.03 }, { p: [-r * 1.02, L * 0.5, 0], kind: 'navRed', r: r * 0.03 }]));
  return { group: g };
}

/* Quest-class airlock: equipment lock (large drum) and crew lock (smaller), EVA hatch, four HPGTs. */
function airlockCAD(p, ctx = {}) {
  const g = new THREE.Group(), r = p.dims.d / 2, L = p.dims.l;
  g.add(hullSegmentMesh({ d: p.dims.d, l: L * 0.6, endKind: 'cone', skin: 'white', windows: 1, racks: 0, bands: 2 }));
  const crewLock = hullSegmentMesh({ d: p.dims.d * 0.6, l: L * 0.42, endKind: 'cone', skin: 'white', windows: 0, racks: 0, bands: 1, raceway: false }); crewLock.position.y = L * 0.58; g.add(crewLock);
  const eva = hatchMesh(1.0); put(eva, 0, L, 0); g.add(eva);
  /* the gas tanks ride the flank that faces away from the stack the lock hangs beside, inside the equipment lock's length */
  const tanks = copvClusterMesh({ d: r * 0.45, count: 4, rows: 2, kind: 'chrome', r, maxSpan: L * 0.5 }); onCylinder(tanks, r, (ctx.alongAz ?? -Math.PI / 2) + Math.PI, L * 0.3); g.add(tanks);
  return { group: g };
}

/* ISS SAW class array and PVR radiator: pleated deployables that fold on the viewer's control. */
function arrayCAD(p, ctx = {}) { return solarArrayMesh({ L: p.dims.l, W: p.dims.d, angles: accordionAngles, standoff: p.standoff ?? 1.2, seatR: ctx.seatR ?? null, seatRot: ctx.seatRot ?? 0 }); }
function radiatorCAD(p, ctx = {}) {
  const rad = p.radiator;
  const panels = rad?.panels ?? 1, panelW = rad ? rad.panelW : p.dims.d, panelL = rad ? rad.panelL : p.dims.l;
  return radiatorMesh({ panelL, panelW, panels, angles: accordionAngles, standoff: p.standoff ?? 0.6, seatR: ctx.seatR ?? null, seatRot: ctx.seatRot ?? 0 });
}

/* 100 kg class bus (v1) and the 16U / New Horizons buses (v4). */
function busCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2;
  if (/16U/.test(p.name)) {
    g.add(box(0.23, L, 0.24, 'mli', { repeat: [1, 2] }).translateY(L / 2));
    for (const [x, z] of [[0.118, 0], [-0.118, 0]]) { const panel = box(0.004, L * 0.9, 0.22, 'cell', { repeat: [1, 2] }); put(panel, x, L / 2, z); g.add(panel); }
    const st = box(0.05, 0.05, 0.05, 'dark'); put(st, 0.08, L * 0.95, 0.09); g.add(st);
    const rtg = cyl(0.045, 0.14, 'dark', { seg: 12 }); put(rtg, -0.09, L * 0.1, -0.14, Math.PI / 2); g.add(rtg);
    const laser = cyl(0.05, 0.08, 'grey', { seg: 16 }); put(laser, 0, L, 0.06); g.add(laser);
    g.add(navLights([{ p: [0.12, L * 0.5, 0.12], kind: 'navGreen', r: 0.008 }, { p: [-0.12, L * 0.5, 0.12], kind: 'navRed', r: 0.008 }]));
    return { group: g };
  }
  if (p.kind === 'bus' && /New Horizons/.test(p.name)) {
    /* a triangular box bus under an MLI tent, a star-tracker pair and an instrument deck on the +y face */
    const tri = new THREE.CylinderGeometry(r, r, L, 3); tri.translate(0, L / 2, 0);
    g.add(new THREE.Mesh(tri, surface('mli', { repeat: [3, 1] })));
    for (let k = 0; k < 2; k += 1) { const st = cyl(0.06, 0.18, 'dark', { seg: 12 }); put(st, r * 0.5, L, -0.3 + 0.2 * k, -0.4); g.add(st); }
    const deck = box(r * 0.9, 0.06, r * 0.7, 'white'); put(deck, -r * 0.2, L + 0.03, 0.3); g.add(deck);
    const cam = cyl(0.12, 0.5, 'dark', { seg: 16 }); put(cam, -r * 0.3, L + 0.06, 0.3); g.add(cam);
    const spec = cyl(0.09, 0.3, 'grey', { seg: 12 }); put(spec, r * 0.05, L + 0.06, 0.55); g.add(spec);
    quadsAround(g, r * 0.95, L * 0.5, 4, 0.16);
    return { group: g };
  }
  const oct = cyl(r, L, 'mli', { seg: 8 }); g.add(oct);
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2, panel = box(r * 1.5, L * 0.78, r * 0.04, 'cell'); put(panel, Math.cos(a) * r * 0.94, L / 2, Math.sin(a) * r * 0.94, 0, -a, 0); g.add(panel); }
  put(cyl(r * 0.42, r * 0.12, 'gold'), 0, L, 0);
  const dish = dishMesh({ d: r * 1.2 }); put(dish, r * 0.36, L * 0.72, 0); g.add(dish);
  quadsAround(g, r * 0.7, -r * 0.04, 4, r * 0.18);
  /* the octagon's flat is at the apothem (0.924 r): the body-mounted radiator sits on it */
  const rad = box(r * 0.5, L * 0.5, r * 0.03, 'radiator'); put(rad, 0, L * 0.5, r * 0.924 + r * 0.015); rad.userData.seated = true; g.add(rad);
  return { group: g };
}

/* StarChip: a 1 g wafer with its cell grid, four photon thrusters and a leading-edge shield stripe. */
function chipCAD(p) {
  const g = new THREE.Group(), S = p.dims.d, t = Math.max(p.dims.l, S * 0.1);
  const wafer = box(S, t, S, 'gold', { repeat: [1, 1] }); wafer.position.y = t / 2; g.add(wafer);
  for (let i = 1; i < 4; i += 1) { const line = box(S * 0.98, t * 1.2, S * 0.02, 'dark'); put(line, 0, t / 2, (i / 4 - 0.5) * S); g.add(line); }
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const pad = box(S * 0.16, t * 2.2, S * 0.16, 'accent'); put(pad, x * S * 0.4, t / 2, z * S * 0.4); g.add(pad); }
  const shield = box(S, t * 1.4, S * 0.08, 'copper'); put(shield, 0, t / 2, S * 0.5); g.add(shield);
  return { group: g };
}

/* 6U deployer (v1). */
function dispenserCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2, t = D * 0.03;
  for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) rod(g, [x * r, 0, z * r], [x * r, L, z * r], t, 'grey', { seg: 6 });
  g.add(put(box(D, t * 1.6, D, 'grey'), 0, 0, 0), put(box(D, t * 1.6, D, 'grey'), 0, L - t * 1.6, 0));
  for (let i = 0; i < 6; i += 1) { const bay = box(D * 0.86, (L / 6) * 0.86, D * 0.86, 'dark'); put(bay, 0, ((i + 0.5) * L) / 6, 0); g.add(bay); }
  return { group: g };
}

/* Generic adapter ring/cone (lightband, hub adapters). */
function adapterCAD(p, ctx = {}) {
  const g = new THREE.Group(), L = p.dims.l;
  /* an adapter on a round-ended hub (the colony's despun hub) can only stand on the hub's flat end face, 0.62 of its
     radius across: the cone starts there, not at the hub's full diameter out over the dome */
  const r = ctx.parentEnd === 'round' && ctx.parentD ? Math.min(p.dims.d / 2, ctx.parentD * 0.5 * 0.62) : p.dims.d / 2;
  const fore = p.ports.find((q) => q.id === 'fore'), rF = (PORT_D[fore?.type] ?? p.dims.d) / 2;
  g.add(lathe([[r, 0], [r, L * 0.15], [Math.max(rF, r * 0.3), L * 0.85], [Math.max(rF, r * 0.3), L]], 'stainless', { seg: 40 }));
  g.add(ringXZ(r, Math.max(r * 0.03, 0.01), 'dark', 0.01));
  return { group: g };
}

/* 1 t class lander (v1): octagonal deck, tanks, bell, lockers. */
function landerCAD(p) {
  const g = new THREE.Group(), D = p.dims.d, L = p.dims.l, r = D / 2.7;
  g.add(put(cyl(r, L * 0.4, 'mli', { seg: 8 }), 0, L * 0.3, 0), put(cyl(r * 0.82, L * 0.28, 'white', { seg: 8 }), 0, L * 0.7, 0));
  const bell = bellMesh(bellSpec({ thrustN: 6000, chamberPa: 1.5e6, expansion: 60 })); bell.rotation.x = Math.PI; bell.position.y = L * 0.3; g.add(bell);
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a); const tank = sph(r * 0.27, 'tank'); put(tank, x * r * 0.86, L * 0.58, z * r * 0.86); g.add(tank); }
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2, locker = box(r * 0.34, L * 0.3, r * 0.14, 'white'); put(locker, Math.cos(a) * r * 0.95, L * 0.55, Math.sin(a) * r * 0.95, 0, -a, 0); g.add(locker); }
  g.add(put(hatchMesh(r * 0.44), 0, L * 0.98, 0));
  return { group: g };
}

/* v4 aero lander: stainless cylinder, Haack nose, windward TPS, header tanks, two bells, RCS. */
function landerAeroCAD(p) {
  const g = new THREE.Group(), D = p.dims.d, r = D / 2, L = p.dims.l, noseL = 2.4, bodyL = L - noseL;
  g.add(cyl(r, bodyL, 'tpsHalf', { seg: 56, repeat: [1, Math.max(1, Math.round(bodyL / 1.6))] }));
  const nose = lathe(haackProfile(r, noseL, 28), 'tpsHalf', { seg: 56, repeat: [1, 2] }); nose.position.y = bodyL; g.add(nose);
  g.add(ringXZ(r * 0.995, r * 0.02, 'dark', bodyL), ringXZ(r * 0.995, r * 0.02, 'dark', 0.04));
  const skirt = cyl(r * 1.0, r * 0.35, 'dark', { seg: 48, open: true }); g.add(skirt);
  for (const s of [-1, 1]) { const bell = bellMesh(bellSpec({ thrustN: 10000, chamberPa: 3e6, expansion: 40 })); bell.rotation.x = Math.PI; bell.position.set(s * r * 0.35, r * 0.4, 0); g.add(bell); }
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const t = sph(r * 0.22, 'chrome'); put(t, Math.cos(a) * r * 0.55, r * 0.7, Math.sin(a) * r * 0.55); g.add(t); }
  quadsAround(g, r, bodyL * 0.85, 4, 0.3);
  const hatch = hatchMesh(0.8); put(hatch, r * 0.98, bodyL * 0.45, 0, 0, 0, -Math.PI / 2); g.add(hatch);
  g.add(navLights([{ p: [0, bodyL * 0.95, r * 1.01], kind: 'navWhite', r: 0.04 }, { p: [r * 1.01, bodyL * 0.3, 0], kind: 'navGreen', r: 0.04 }, { p: [-r * 1.01, bodyL * 0.3, 0], kind: 'navRed', r: 0.04 }]));
  return { group: g };
}

/* Landing gear: v1 A-frames, or the Falcon-style legs for the v4 lander (posed deployed). */
function legsCAD(p, ctx = {}) {
  if (p.legs) {
    const s = p.legs, R0 = s.spanM / 2.45 / 2;
    const g = landingLegMesh({ count: s.count, R0, hingeH: s.hingeHM, spanM: s.spanM, footY: -s.heightM * 0.05 });
    /* legs hang from the hinge; the part's datum is the hinge plane, so shift so the pads sit at y = -heightM */
    g.position.y = -s.hingeHM + s.heightM * 0.1;
    return { group: g };
  }
  const g = new THREE.Group(), span = p.dims.d / 2, h = p.dims.l;
  /* the A-frames root on the lander's skin (its octagon is drawn at D / 2.7), not inside its tanks */
  const root = ctx.parentD ? Math.min(span * 0.9, (ctx.parentD / 2.7) * 0.92) : span * 0.16;
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a), z = Math.sin(a);
    rod(g, [x * root, h, z * root], [x * span, h * 0.02, z * span], span * 0.014, 'grey');
    rod(g, [x * root, h * 0.4, z * root], [x * span * 0.72, h * 0.02, z * span * 0.72], span * 0.008, 'grey');
    const pad = cyl(span * 0.09, h * 0.04, 'dark', { seg: 16 }); pad.position.set(x * span, 0, z * span); g.add(pad);
  }
  return { group: g };
}

/* Grid fins (v4 lander). */
function finsCAD(p) {
  const s = p.fins, R = (s.dims.d - 2 * s.finW) / 2;
  return { group: gridFinMesh({ finW: s.finW, finH: s.finH, finT: s.finT, count: s.count, R, y: 0 }) };
}

/* Crewed capsule: ablative heat shield, frustum in painted steel or TPS quilt, windows, hatch, docking tunnel; the v4 capsule adds the hinged ogive nose cone. */
function capsuleCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2, v4 = /TPS/.test(p.name);
  const shield = lathe([[r * 0.2, 0], [r * 0.85, L * 0.02], [r, L * 0.08]], 'tps', { seg: 48 }); g.add(shield);
  g.add(ringXZ(r * 0.995, r * 0.025, 'dark', L * 0.08));
  const body = lathe([[r, L * 0.08], [r * 0.98, L * 0.14], [r * 0.52, L * 0.68], [r * 0.5, L * 0.72]], 'white', { seg: 48 }); g.add(body);
  if (v4) {
    const cone = lathe(haackProfile(r * 0.5, L * 0.28, 20), 'white', { seg: 48, repeat: [4, 1] }); cone.position.y = L * 0.72; g.add(cone);
    g.add(ringXZ(r * 0.5, r * 0.015, 'dark', L * 0.72));
    quadsAround(g, r * 0.9, L * 0.2, 4, 0.3);
    quadsAround(g, r * 0.62, L * 0.58, 4, 0.25);
  } else {
    g.add(put(cyl(r * 0.3, L * 0.16, 'white', { seg: 24 }), 0, L * 0.78, 0), ringXZ(r * 0.32, r * 0.02, 'grey', L * 0.94));
  }
  const frame = new THREE.CylinderGeometry(r * 0.09, r * 0.09, r * 0.03, 16), glass = new THREE.CylinderGeometry(r * 0.075, r * 0.075, r * 0.02, 16);
  const fr = [], gl = [];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, y = L * 0.34 + (i % 2) * L * 0.1, rr = r * (1 - 0.52 * ((y - L * 0.14) / (L * 0.54)));
    const n = new THREE.Vector3(Math.cos(a), 0.45, Math.sin(a)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(Y, n);
    fr.push({ p: [Math.cos(a) * rr * 0.99, y, Math.sin(a) * rr * 0.99], q }); gl.push({ p: [Math.cos(a) * rr * 1.0, y, Math.sin(a) * rr * 1.0], q });
  }
  g.add(instances(frame, 'dark', fr), instances(glass, 'glass', gl));
  const hatch = hatchMesh(r * 0.4); const n = new THREE.Vector3(-0.6, 0.45, 0.76).normalize(); hatch.quaternion.setFromUnitVectors(Y, n); hatch.position.set(-r * 0.5, L * 0.32, r * 0.62); g.add(hatch);
  return { group: g };
}

/* Service module / trunk: open shell with body-mounted cells on one half and radiator on the other. */
function serviceCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2, solar = /solar/.test(p.name);
  g.add(cyl(r, L, solar ? 'white' : 'white', { seg: 40, open: true }));
  if (solar) {
    const half = new THREE.CylinderGeometry(r * 1.005, r * 1.005, L * 0.9, 24, 1, true, 0, Math.PI); half.translate(0, L / 2, 0);
    g.add(new THREE.Mesh(half, surface('cell', { repeat: [6, 2] })));
    const rad = new THREE.CylinderGeometry(r * 1.005, r * 1.005, L * 0.9, 24, 1, true, Math.PI, Math.PI); rad.translate(0, L / 2, 0);
    g.add(new THREE.Mesh(rad, surface('radiator', { repeat: [6, 2] })));
  } else {
    for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const tank = sph(r * 0.3, 'tank'); put(tank, Math.cos(a) * r * 0.6, L * 0.45, Math.sin(a) * r * 0.6); g.add(tank); }
    quadsAround(g, r * 0.96, L * 0.5, 4, r * 0.15);
    const engine = bellMesh(bellSpec({ thrustN: 25000, chamberPa: 1e6, expansion: 150 })); engine.rotation.x = Math.PI; engine.position.y = L * 0.25; g.add(engine);
    for (const s of [-1, 1]) g.add(shellPanel({ r: r * 1.004, h: L * 0.7, a0: (s > 0 ? Math.PI / 2 : -Math.PI / 2) - 0.45, arc: 0.9, y: L * 0.15, kind: 'radiator' }));
  }
  g.add(ringXZ(r * 0.99, r * 0.02, 'dark', 0.03), ringXZ(r * 0.99, r * 0.02, 'dark', L - 0.03));
  return { group: g };
}

/* 1 g habitat ring (v1) and the sized spin ring (v2/v4): a torus deck with a cutaway, floors, windows, spokes, hub. */
function ringCAD(p, ctx = {}) {
  const R = (p.dims.d) / 2, deck = p.dims.l, tube = deck / 2;
  return { group: torusDeckMesh({ R: R - tube, D: deck, decks: Math.max(1, Math.floor((deck - 1.2) / 3)), arc: Math.PI * 2 * (5 / 6), spokes: 6, hubR: ctx.hubD ? ctx.hubD / 2 + 0.1 : null, hubL: ctx.hubL ?? null }) };
}
function centrifugeCAD(p, ctx = {}) {
  const D = Math.max(p.dims.l, 1), tube = D / 2, R = Math.max((p.dims.d - D) / 2, tube);
  return { group: torusDeckMesh({ R, D, decks: Math.max(1, Math.floor((D - 1.2) / 3)), arc: Math.PI * 2 * (5 / 6), spokes: 6, hubR: ctx.hubD ? ctx.hubD / 2 + 0.1 : null, hubL: ctx.hubL ?? null }) };
}

/* v4 bola: two domed pods on lattice spokes around a hub. */
function bolaCAD(p) {
  const g = new THREE.Group(), b = p.bola, R = b.R, pod = b.pod;
  for (const s of [-1, 1]) {
    const pm = hullSegmentMesh({ d: pod.dims.d, l: pod.dims.l, endKind: 'dome', skin: 'white', windows: 4, racks: 0, bands: 2 });
    pm.rotation.z = Math.PI / 2; pm.position.set(s * (R + pod.dims.l / 2) * (s > 0 ? 1 : 1) - (s > 0 ? pod.dims.l / 2 : -pod.dims.l / 2) * 0, 0, 0);
    /* hullSegmentMesh grows along +y; turned to lie along the spoke with its inner end at R - l/2 */
    pm.position.set(s * (R - pod.dims.l / 2) * 1, 0, 0); pm.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(pm);
    const spoke = trussMesh({ lengthM: b.truss.dims.l, widthM: b.truss.widthM, kind: 'grey' }); spoke.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; spoke.position.set(s * 2.2, 0, 0); g.add(spoke);
    const elevator = box(0.6, 0.6, 0.6, 'white'); elevator.position.set(s * R * 0.5, 0, 0); g.add(elevator);
  }
  g.add(put(cyl(2.2, 1.0, 'white', { seg: 32 }), 0, -0.5, 0), ringXZ(2.0, 0.08, 'grey', 0.5), ringXZ(2.0, 0.08, 'grey', -0.5));
  return { group: g };
}

/* Cargo can (v1). */
function cargoCAD(p) { return { group: hullSegmentMesh({ d: p.dims.d, l: p.dims.l, skin: 'offwhite', windows: 0, racks: 2, hatchSide: true }) }; }

/* Deployable sail mast: triangular lattice (v1 law) or the thrust-sized square truss (v4), with the deployer can at the base. */
function mastCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, w = Math.max(p.dims.d / Math.SQRT2, 0.02);
  g.add(cyl(w * 1.2, Math.min(L * 0.07, 0.6), 'stainless', { seg: 16 }));
  g.add(trussMesh({ lengthM: L, widthM: w, bays: Math.max(3, Math.min(60, Math.round(L / Math.max(w, 0.05)))), kind: 'grey', section: p.truss ? 'square' : 'tri' }));
  return { group: g };
}

/* Sail canister (v4): stainless drum with MLI lid, hub ring and six winding motors. */
function canisterCAD(p) {
  const g = new THREE.Group(), r = p.dims.d / 2, L = p.dims.l;
  g.add(cyl(r, L, 'stainless', { seg: 48 }));
  const lid = lathe(domeProfile(r, r * 0.15, 8), 'mli', { seg: 48 }); lid.position.y = L; g.add(lid);
  g.add(ringXZ(r * 0.99, Math.max(r * 0.03, 0.004), 'dark', 0.02), ringXZ(r * 0.99, Math.max(r * 0.03, 0.004), 'dark', L - 0.02));
  g.add(put(cyl(r * 0.5, r * 0.15, 'dark', { seg: 32 }), 0, L, 0));
  g.add(ringXZ(r * 0.5, Math.max(r * 0.04, 0.004), 'gold', L + r * 0.15));
  for (let k = 0; k < 6; k += 1) { const a = (k / 6) * Math.PI * 2; const m = cyl(r * 0.08, r * 0.2, 'dark', { seg: 10 }); put(m, Math.cos(a) * r * 0.7, L + r * 0.1, Math.sin(a) * r * 0.7); g.add(m); }
  for (let k = 0; k < 3; k += 1) { const a = (k / 3) * Math.PI * 2; const latch = box(r * 0.1, L * 0.5, r * 0.06, 'grey'); put(latch, Math.cos(a) * r * 1.02, L / 2, Math.sin(a) * r * 1.02, 0, -a, 0); g.add(latch); }
  return { group: g };
}

/* Thrust collar: ring frame, struts, bolted mast root. */
function collarCAD(p) {
  const g = new THREE.Group(), D = p.dims.d, L = p.dims.l, r = D / 2;
  g.add(ringXZ(r, Math.max(D * 0.03, 0.02), 'grey', L * 0.92), ringXZ(r * 0.99, Math.max(D * 0.02, 0.015), 'gold', L * 0.02));
  g.add(put(cyl(r * 0.13, L, 'stainless', { seg: 16 }), 0, 0, 0));
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; rod(g, [0, L * 0.92, 0], [Math.cos(a) * r * 0.95, L * 0.12, Math.sin(a) * r * 0.95], D * 0.012, 'grey'); }
  return { group: g };
}

/* Despun hub: non-rotating core with bearing lands, slip-ring bands and berths. */
function despinCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2;
  /* QA pass: the hull is the catalogue's full diameter (it was drawn at 0.82 D, so the mounts on its surface
     floated 0.9 m off it); the bearing lands and slip-ring bands stand slightly proud */
  g.add(hullSegmentMesh({ d: D, l: L, endKind: 'round', skin: 'white', windows: 0, racks: 0, bands: 2 }));
  g.add(ringXZ(r * 1.01, r * 0.045, 'gold', 0.12 + L * 0.06), ringXZ(r * 1.01, r * 0.045, 'gold', L - 0.12 - L * 0.06));
  for (let i = 1; i <= 3; i += 1) g.add(ringXZ(r * 1.01, r * 0.028, 'grey', (L * i) / 4));
  for (const port of p.ports.filter((q) => q.type === 'cbm')) { const h = hatchMesh(1.27); h.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...port.axis)); h.position.fromArray(port.at); g.add(h); }
  return { group: g };
}

/* Fission reactor: shadow shield cone, core drum, conversion, heat-pipe radiator wings sized from the spec. */
function reactorCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2, rad = p.reactor?.radiator;
  const shield = lathe([[r * 0.3, 0], [r * 0.95, L * 0.2], [r * 0.95, L * 0.24]], 'dark', { seg: 32 }); g.add(shield);
  g.add(put(cyl(r * 0.5, L * 0.3, 'stainless', { seg: 24 }), 0, L * 0.24, 0), put(cyl(r * 0.34, L * 0.1, 'accent', { seg: 18 }), 0, L * 0.54, 0));
  const wingL = rad ? rad.panelL : L * 0.5, wingW = rad ? rad.panelW * rad.perSide : r * 1.4;
  /* the wings hang on a transverse beam through a drum on the conversion stack, with the heat pipes along it */
  g.add(put(cyl(r * 0.3, L * 0.1, 'grey', { seg: 20 }), 0, L * 0.61, 0));
  const beam = box(Math.max(wingL * 0.12, r * 0.3), Math.max(L * 0.03, 0.05), r * 1.1, 'grey'); put(beam, 0, L * 0.66, 0); g.add(beam);
  for (const s of [-1, 1]) {
    const wing = box(wingL, Math.max(wingL * 0.012, 0.05), wingW, 'radiator', { repeat: [Math.max(1, Math.round(wingL / 2)), Math.max(1, Math.round(wingW / 2))] });
    put(wing, 0, L * 0.66, s * (r * 0.5 + wingW / 2)); g.add(wing);
    for (let i = 1; i < 6; i += 1) { const pipe = cyl(Math.max(r * 0.012, 0.01), wingW, 'gold', { seg: 6 }); put(pipe, (i / 6 - 0.5) * wingL, L * 0.66, s * r * 0.5, Math.PI / 2 * (s > 0 ? 1 : -1), 0, 0); g.add(pipe); }
  }
  rod(g, [0, L * 0.64, 0], [0, L, 0], Math.max(r * 0.05, 0.03), 'grey');
  return { group: g };
}

/* MMRTG: finned cylinder on a short boom. */
function rtgCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, r = p.dims.d / 2;
  g.add(cyl(r * 0.45, L, 'dark', { seg: 16 }));
  const fin = new THREE.BoxGeometry(r * 1.1, L * 0.9, r * 0.03);
  const list = []; for (let k = 0; k < 8; k += 1) list.push({ p: [0, L / 2, 0], q: new THREE.Quaternion().setFromAxisAngle(Y, (k / 8) * Math.PI) });
  g.add(instances(fin, 'grey', list));
  return { group: g };
}

/* HGA: dish facing +y of the part (the mount axis). */
function dishCAD(p) { return { group: dishMesh({ d: p.dims.d, fD: p.dish?.fD ?? 0.4 }) }; }

/* Bow dust shield: beryllium disc with ribs and a standoff frame. */
function dustShieldCAD(p) {
  const g = new THREE.Group(), r = p.dims.d / 2, L = p.dims.l;
  g.add(put(cyl(r, Math.max(L - 0.3, 0.02), 'copper', { seg: 48 }), 0, 0.3, 0));
  for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.9, 0.02, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.9, 0.3, Math.sin(a) * r * 0.9], Math.max(r * 0.02, 0.01), 'grey'); }
  g.add(ringXZ(r * 0.98, Math.max(r * 0.02, 0.01), 'dark', L - 0.01));
  return { group: g };
}

/* PMA: CBM ring at the base, docking tunnel, IDSS petals. */
function pmaCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2;
  g.add(lathe([[r, 0], [r, L * 0.4], [r * 0.62, L * 0.86]], 'mli', { seg: 32 }));
  g.add(ringXZ(r * 0.96, D * 0.035, 'grey', 0.04), ringXZ(r * 0.62, D * 0.03, 'grey', L * 0.9));
  const port = dockingPortMesh(Math.min(1.2, D * 1.24), { depth: L * 0.14 }); port.position.y = L * 0.86; g.add(port);
  return { group: g };
}

/* Jettisonable sail stage: IDSS ring, three struts, mast root. */
function sailStageCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2;
  g.add(ringXZ(r * 0.95, D * 0.04, 'grey', 0.02), ringXZ(r * 0.34, D * 0.05, 'gold', L));
  for (let i = 0; i < 3; i += 1) { const a = (i / 3) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.9, 0.02, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.3, L, Math.sin(a) * r * 0.3], D * 0.02, 'grey'); const petal = box(D * 0.14, D * 0.04, D * 0.1, 'hatch'); put(petal, Math.cos(a) * r * 0.86, 0.04, Math.sin(a) * r * 0.86, 0, -a, 0); g.add(petal); }
  return { group: g };
}

/* Spin bearing: fixed hub, rotating collar, slip-ring band. */
function spinBearingCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, D = p.dims.d, r = D / 2;
  g.add(cyl(r * 0.55, L, 'stainless', { seg: 32 }), ringXZ(r * 0.95, D * 0.04, 'gold', L * 0.5), ringXZ(r * 0.7, D * 0.03, 'dark', L * 0.05), ringXZ(r * 0.7, D * 0.03, 'dark', L * 0.95));
  /* the outer race rides on a web from the drum, and the end rings on short flanges */
  g.add(put(cyl(r * 0.93, Math.max(L * 0.08, 0.05), 'grey', { seg: 48 }), 0, L * 0.5 - Math.max(L * 0.04, 0.025), 0));
  for (const y of [L * 0.05, L * 0.95]) g.add(put(cyl(r * 0.68, Math.max(L * 0.04, 0.02), 'grey', { seg: 32 }), 0, y - Math.max(L * 0.02, 0.01), 0));
  return { group: g };
}

/* Truss boom (v4). */
function trussCAD(p) { return { group: trussMesh({ lengthM: p.dims.l, widthM: p.truss?.widthM ?? p.dims.d / Math.SQRT2, kind: 'grey' }) }; }

/* Systems bay / module (v4): a pallet or drum with CMG spheres, battery boxes, antennas and quads. */
function systemsCAD(p) {
  const g = new THREE.Group(), r = p.dims.d / 2, L = p.dims.l, pressurised = p.kind === 'systems-module';
  if (pressurised) g.add(hullSegmentMesh({ d: p.dims.d, l: L, skin: 'offwhite', windows: 0, racks: 4, bands: 2 }));
  else { g.add(cyl(r, L, 'white', { seg: 24 })); g.add(ringXZ(r * 0.99, Math.max(r * 0.03, 0.005), 'dark', 0.01), ringXZ(r * 0.99, Math.max(r * 0.03, 0.005), 'dark', L - 0.01)); }
  const n = Math.min(4, Math.max(1, Math.round(r * 2)));
  for (let k = 0; k < n; k += 1) { const a = (k / n) * Math.PI * 2; const cmg = sph(r * 0.18, 'chrome'); put(cmg, Math.cos(a) * r * 0.75, L * 0.5, Math.sin(a) * r * 0.75); g.add(cmg); }
  quadsAround(g, r, L * 0.5, 4, Math.max(0.1, Math.min(0.6, r * 0.25)));
  const st = cyl(r * 0.08, r * 0.3, 'dark', { seg: 10 }); put(st, 0, L, r * 0.5, -0.5); g.add(st);
  return { group: g };
}

/* Trim/braking stage (v4): a tank from its spec, the engine bell, a magsail coil drum where the ship stops. */
function trimStageCAD(p) {
  const g = new THREE.Group(), s = p.stage, L = p.dims.l, r = p.dims.d / 2;
  const tank = tankMesh(s.tank, 'tank'); tank.position.y = L - s.tank.dims.l; g.add(tank);
  const bell = bellMesh(s.engine); bell.rotation.x = Math.PI; bell.position.y = L - s.tank.dims.l; g.add(bell);
  const skirt = lathe([[Math.max(r * 0.6, s.engine.dims.d * 0.6), 0], [r, L * 0.3], [r, L - s.tank.dims.l]], 'stainless', { seg: 40 }); g.add(skirt);
  if (p.inventory.some((i) => /magsail/.test(i.item))) {
    const coil = tor(r * 1.15, Math.max(r * 0.08, 0.02), 'copper'); coil.rotation.x = Math.PI / 2; coil.position.y = L * 0.55; g.add(coil);
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.97, L * 0.55, Math.sin(a) * r * 0.97], [Math.cos(a) * r * 1.1, L * 0.55, Math.sin(a) * r * 1.1], Math.max(r * 0.025, 0.006), 'grey', { seg: 6 }); }
  }
  quadsAround(g, r, L * 0.8, 4, Math.max(0.1, Math.min(0.5, r * 0.2)));
  return { group: g };
}

/* Drive module (v3): thrust frame, tank or magazine, bells or pusher plate, radiator panels -- all read from the plan. */
function driveCAD(p) {
  const g = new THREE.Group();
  const L = Math.max(p.dims?.l ?? 1, 0.05), D = Math.max(p.dims?.d ?? 1, 0.05);
  const store = p.store ?? { kind: 'tank', l: L, d: D };
  const magazine = store.kind === 'magazine', frameL = Math.max(p.frame?.l ?? 0, 0), bayL = Math.max(p.bayL ?? 0, 0);
  const rS = Math.max(store.d / 2, 0.02), rI = Math.max((p.interfaceD ?? Math.min(1.2, D)) / 2, 0.015);
  const storeL = Math.max(Math.min(store.l || L, L - frameL - bayL), 0.04), yS = frameL, yE = frameL + storeL;
  if (p.driveKind === 'beamed') {
    const coilR = Math.max(D / 2, 0.02), coilY = L * 0.72;
    g.add(ringXZ(coilR, Math.max(coilR * 0.07, 0.002), 'copper', coilY), ringXZ(coilR * 0.76, Math.max(coilR * 0.04, 0.0015), 'grey', coilY - coilR * 0.14));
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; rod(g, [Math.cos(a) * coilR * 0.2, coilY, Math.sin(a) * coilR * 0.2], [Math.cos(a) * coilR * 0.92, coilY, Math.sin(a) * coilR * 0.92], Math.max(coilR * 0.02, 0.001), 'grey', { seg: 5 }); }
    g.add(put(cyl(coilR * 0.2, L * 0.7, 'dark', { seg: 18 }), 0, 0, 0));
    return { group: g };
  }
  if (frameL > 0.01) {
    g.add(put(lathe([[rI, 0], [rS * 0.94, frameL]], 'grey', { seg: 28 }), 0, 0, 0));
    g.add(ringXZ(rI, Math.max(rI * 0.12, 0.008), 'gold', 0.01));
    const tr = trussMesh({ lengthM: frameL, widthM: rS * 1.2, bays: 2, kind: 'grey' }); g.add(tr);
  }
  if (magazine) {
    g.add(put(cyl(rS, storeL, 'stainless', { seg: 40 }), 0, yS, 0));
    const ribs = Math.max(2, Math.min(10, Math.round(storeL / Math.max(rS, 0.4))));
    for (let i = 1; i < ribs; i += 1) g.add(ringXZ(rS * 1.004, Math.max(rS * 0.018, 0.004), 'dark', yS + (storeL * i) / ribs));
    for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; g.add(shellPanel({ r: rS * 1.008, h: storeL * 0.6, a0: Math.PI / 2 - a - 0.34, arc: 0.68, y: yS + storeL * 0.2, kind: 'hatch' })); }
  } else {
    const dome = Math.min(rS * 0.6, storeL * 0.16);
    g.add(put(cyl(rS, storeL - 2 * dome, 'tank', { seg: 40 }), 0, yS + dome, 0));
    const d1 = lathe(domeProfile(rS, dome, 10), 'tank', { seg: 40 }); d1.position.y = yE - dome; g.add(d1);
    const d0 = lathe(domeProfile(rS, dome, 10), 'tank', { seg: 40 }); d0.rotation.x = Math.PI; d0.position.y = yS + dome; g.add(d0);
    for (let i = 1; i <= 3; i += 1) g.add(ringXZ(rS * 1.006, Math.max(rS * 0.022, 0.005), 'gold', yS + dome + ((storeL - 2 * dome) * i) / 4));
  }
  if (magazine) {
    const plateR = Math.max((p.plateD ?? D) / 2, rS * 1.02), plateT = Math.max(D * 0.025, 0.02), yPlate = L - plateT;
    g.add(put(cyl(plateR, plateT, 'dark', { seg: 48 }), 0, yPlate, 0));
    for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2; rod(g, [Math.cos(a) * rS * 0.82, yE, Math.sin(a) * rS * 0.82], [Math.cos(a) * plateR * 0.7, yPlate, Math.sin(a) * plateR * 0.7], Math.max(rS * 0.03, 0.006), 'chrome', { seg: 8 }); }
    rod(g, [0, yE, 0], [0, yPlate, 0], Math.max(rS * 0.07, 0.01), 'grey', { seg: 12 });
  } else {
    g.add(put(cyl(rS * 0.94, Math.max(bayL * 0.55, 0.04), 'white', { seg: 32 }), 0, yE, 0));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4, bell = bellMesh(bellSpec({ thrustN: Math.max(100, (p.thrustN ?? 1e5) / 4), chamberPa: 3e6, expansion: 100 }));
      /* the bell stays inside the engine bay: the drawn height is scaled to what is left of the bay behind the thrust structure */
      bell.children[0].geometry.computeBoundingBox();
      const bellH = bell.children[0].geometry.boundingBox.max.y, room = Math.max(bayL * 0.42, 0.02), sc = Math.min(1, room / Math.max(bellH, 1e-6));
      bell.scale.setScalar(sc); bell.position.set(Math.cos(a) * rS * 0.44, yE + Math.max(bayL * 0.55, 0.04), Math.sin(a) * rS * 0.44); g.add(bell);
    }
  }
  /* the radiator panels: the same layout the geometry audit tests (parts/geometry-audit.js driveRadiatorPanels), so the
     drawing and the plume check cannot disagree. Each panel hangs on a manifold along its root edge and three struts. */
  for (const pn of driveRadiatorPanels(p)) {
    const c = Math.cos(pn.az), sn = Math.sin(pn.az), xm = (pn.rIn + pn.rOut) / 2;
    /* one radiator tile is about 3 m of flow tubes: the texture repeats at that pitch so the ribs read at every scale */
    const panel = box(pn.pWid, pn.pLen, pn.thick, 'radiator', { repeat: [Math.max(1, Math.round(pn.pWid / 3)), Math.max(1, Math.round(pn.pLen / 3))] }); panel.position.set(c * xm, pn.yc, sn * xm); panel.rotation.y = -pn.az; panel.userData.seated = true; g.add(panel);
    rod(g, [c * pn.rIn, pn.yc - pn.pLen * 0.49, sn * pn.rIn], [c * pn.rIn, pn.yc + pn.pLen * 0.49, sn * pn.rIn], Math.min(0.2, Math.max(pn.pWid * 0.015, 0.005)), 'grey', { seg: 8 });
    for (const f of [-0.4, 0, 0.4]) rod(g, [c * rS * 0.96, pn.yc + f * pn.pLen, sn * rS * 0.96], [c * xm, pn.yc + f * pn.pLen * 0.9, sn * xm], Math.max(pn.pWid * 0.012, 0.004), 'grey', { seg: 5 });
  }
  return { group: g };
}

/** A cylinder with an end ring: the honest fallback for a kind with no builder of its own. */
function genericCAD(p) {
  const g = new THREE.Group(), r = Math.max((p.dims?.d ?? 0) / 2, 1e-4), L = Math.max(p.dims?.l ?? 0, 1e-4);
  const body = cyl(r, L, 'white', { seg: 24 }); if (p.origin === 'centre') body.position.y = -L / 2; g.add(body);
  return { group: g };
}

const BUILDERS = {
  'pressurised-module': moduleCAD, 'stores-module': moduleCAD, node: nodeCAD, airlock: airlockCAD, radiator: radiatorCAD, 'solar-array': arrayCAD,
  bus: busCAD, payload: chipCAD, adapter: (p, ctx) => (/6U/.test(p.name) ? dispenserCAD(p) : adapterCAD(p, ctx)), lander: landerCAD, 'lander-aero': landerAeroCAD,
  'landing-gear': legsCAD, 'grid-fins': finsCAD, 'crew-capsule': capsuleCAD, 'service-module': serviceCAD, 'habitat-ring': ringCAD, cargo: cargoCAD,
  mast: mastCAD, 'sail-canister': canisterCAD, 'thrust-collar': collarCAD, 'despin-hub': despinCAD, reactor: reactorCAD, rtg: rtgCAD, dish: dishCAD,
  'dust-shield': dustShieldCAD, pma: pmaCAD, 'dock-adapter': sailStageCAD, centrifuge: centrifugeCAD, 'spin-bola': bolaCAD, 'spin-bearing': spinBearingCAD,
  truss: trussCAD, 'systems-bay': systemsCAD, 'systems-module': systemsCAD, 'trim-stage': trimStageCAD, drive: driveCAD
};

/** Build one part. `ctx` carries what the builder cannot know from the part alone: `hubD`, the diameter of
 *  the bearing or hub a ring is mated to, so its collar fits round it. */
function centauriPart(p, ctx = {}) { return (BUILDERS[p.kind] ?? genericCAD)(p, ctx); }

/** What a side-mounted part sits on: the radius of its parent's body where the mate is radial (so the builder can
 *  cut its saddle), the parent's kind, and whether the parent's ends are rounded (an adapter on a despun hub can only
 *  stand on the flat of the dome). `seatR` is null for an end mount or a parent that is not a body of revolution. */
export function mountContextFor(solved, name) {
  const n = solved.nodes.find((x) => x.name === name);
  if (!n?.parent) return {};
  const parent = solved.nodes.find((x) => x.name === n.parent);
  const mt = solved.mates.find((m) => (m.a.name === name && m.b.name === n.parent) || (m.b.name === name && m.a.name === n.parent));
  if (!parent || !mt) return {};
  const pPort = parent.part.ports.find((q) => q.id === (mt.a.name === n.parent ? mt.a.port : mt.b.port));
  const radial = pPort && Math.abs(pPort.axis[1]) < 0.5 && !['centrifuge', 'habitat-ring', 'torpor-ring', 'spin-bola', 'rail-network', 'truss', 'mast'].includes(parent.part.kind);
  const round = ['despin-hub', 'pressurised-module', 'stores-module'].includes(parent.part.kind) ? 'round' : 'cone';
  /* the parent's +y axis in the child's frame: a saddle's length runs along it, and a fitting that must stay clear of the
     stack goes to the opposite azimuth */
  const rot = (q, v) => { const x = q[0], y = q[1], z = q[2], w = q[3]; const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
  const axisW = rot(parent.world.quaternion, [0, 1, 0]), qc = n.world.quaternion, axisL = rot([-qc[0], -qc[1], -qc[2], qc[3]], axisW);
  const seatRot = Math.atan2(axisL[0], axisL[2]), alongAz = Math.atan2(axisL[2], axisL[0]);
  return { seatR: radial ? parent.part.dims.d / 2 : null, seatRot: Number.isFinite(seatRot) ? seatRot : 0, alongAz: Number.isFinite(alongAz) ? alongAz : 0, parentKind: parent.part.kind, parentEnd: round, parentD: parent.part.dims.d };
}

/** The diameter (and length) of the body a ring's hub port is mated to, from the solved assembly. */
export function hubContextFor(solved, name) {
  const mt = solved.mates.find((m) => (m.a.name === name && /^hub/.test(m.a.port)) || (m.b.name === name && /^hub/.test(m.b.port)));
  if (!mt) return {};
  const other = mt.a.name === name ? mt.b.name : mt.a.name;
  const n = solved.nodes.find((x) => x.name === other);
  /* the collar is a bearing's width, not the hub's length: the hub's flank carries mounts the collar must not cover */
  return n ? { hubD: n.part.dims.d, hubL: Math.min(n.part.dims.l, Math.max(1, Math.min(1.5, n.part.dims.l * 0.6))) } : {};
}

/** Show or hide the cutaway variants (ring shells, hangar wedges) a model carries. */
export function setCutaway(root, on) {
  root.traverse((o) => { if (o.userData.cutaway === 'cut') o.visible = !!on; else if (o.userData.cutaway === 'full') o.visible = !on; });
}

/* ------------------------------------------------------------------ *
 * The origami sail film
 * ------------------------------------------------------------------ */

/** The film as a hexagonal flasher: six gores, a pinwheel shoulder ring, a hub opening and six rim
 *  tip masses. `setDeploy(k)` recomputes the vertices from parts/flasher.js. */
function sailFilm(side, opts = {}) {
  const g = new THREE.Group(), detail = opts.detail !== false, R = flasherRadius(side * side);
  const filmMat = surface('film');
  const creaseMat = new THREE.LineBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.32 });
  const pattern = faces();
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(pattern.vertices.length * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tri = []; for (const q of pattern.quads) { const c = q.corners; tri.push(c[0], c[1], c[2], c[0], c[2], c[3]); }
  geo.setIndex(tri);
  const film = new THREE.Mesh(geo, filmMat); film.frustumCulled = false; g.add(film);
  const creaseList = creases().filter((c) => c.kind !== 'cut');
  const lp = new Float32Array(creaseList.length * 6), lgeo = new THREE.BufferGeometry();
  lgeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lines = new THREE.LineSegments(lgeo, creaseMat); lines.frustumCulled = false; if (detail) g.add(lines);
  const hub = tor(Math.max(R * FLASHER.hubFrac, 1e-6), Math.max(side * 0.0015, 1e-8), 'grey'); hub.rotation.x = Math.PI / 2; g.add(hub);
  const arms = new THREE.Group();
  for (let i = 0; i < FLASHER.sectors; i += 1) {
    const arm = new THREE.Group(); arm.rotation.y = -(SECTOR * i);
    const tip = sph(Math.max(side * 0.004, 1e-8), 'gold'); tip.position.set(R * 0.98, 0, 0); arm.add(tip);
    const vane = box(Math.max(side * 0.03, 1e-7), Math.max(side * 0.0015, 1e-9), Math.max(side * 0.008, 1e-8), 'gold'); put(vane, R * 0.94, 0, Math.max(side * 0.006, 1e-8)); arm.add(vane);
    arms.add(arm);
  }
  if (detail) g.add(arms);
  let n = 0;
  const write = (k) => {
    const lam = lambdaFor(k), d = deploy(lam, { radiusM: R }), idx = pattern.index;
    for (let i = 0; i < FLASHER.sectors; i += 1) for (const ring of ['H', 'S', 'O']) { const v = idx[ring][i], p = d.points[ring][i]; pos[v * 3] = p[0]; pos[v * 3 + 1] = p[1]; pos[v * 3 + 2] = p[2]; }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    n = 0;
    for (const c of creaseList) { const p = d.points[c.a[0]][c.a[1]], q = d.points[c.b[0]][c.b[1]]; lp[n] = p[0]; lp[n + 1] = p[1]; lp[n + 2] = p[2]; lp[n + 3] = q[0]; lp[n + 4] = q[1]; lp[n + 5] = q[2]; n += 6; }
    lgeo.attributes.position.needsUpdate = true;
    arms.scale.set(d.scale, 1, d.scale);
    g.userData.lambda = lam; g.userData.stage = d.stage;
  };
  g.userData.setDeploy = write;
  write(1);
  return g;
}

/* ------------------------------------------------------------------ *
 * The craft
 * ------------------------------------------------------------------ */

const span = (v) => { const n = (x) => String(Number(x.toPrecision(3))); if (v >= 1000) return `${n(v / 1000)} km`; if (v >= 1) return `${n(v)} m`; return `${n(v * 100)} cm`; };

/** Build one class from its solved assembly. Returns a Group with the viewer's hooks:
 *  fitAxis null (true size), label, setDeploy, and a two-stage explode map.
 *  `opts.sailArchitecture` overrides the class's sail mechanism (parts/sail-mechanics.js);
 *  `opts.sailMechanism: false` draws the old flasher film instead. */
export function buildCentauriModel(id, opts = {}) {
  const m = measure(id, {});
  const useMech = opts.sailMechanism !== false && m.solved.nodes.some((n) => n.part.kind === 'sail');
  const g = new THREE.Group(), hullStage = new THREE.Group(), sailStage = new THREE.Group();
  hullStage.userData.stage = 0; sailStage.userData.stage = 1; g.add(hullStage, sailStage);
  const deployers = [], box3 = new THREE.Box3();
  for (const n of m.solved.nodes) {
    const p = n.part;
    if (p.kind === 'sail') continue;
    const built = centauriPart(p, { ...hubContextFor(m.solved, n.name), ...mountContextFor(m.solved, n.name) });
    /* the sail mechanism draws the canister itself (the drum wall is its door petals, with the core, reels and
       latches); the catalogue canister keeps its frame so the audit sees every placed part, but draws hidden */
    if (p.kind === 'sail-canister' && useMech) { built.group.visible = false; built.group.userData.drawnBy = 'sail-mechanism'; }
    for (const port of p.ports ?? []) addPortRing(built.group, port);
    const frame = new THREE.Group();
    frame.position.fromArray(n.world.position); frame.quaternion.fromArray(n.world.quaternion);
    frame.userData.partName = n.name; frame.userData.kind = p.kind; frame.userData.part = p;
    frame.add(built.group); hullStage.add(frame);
    if (built.setDeploy) deployers.push(built.setDeploy);
    frame.updateMatrixWorld(true);
    if (p.kind !== 'mast') box3.expandByObject(frame);
  }
  const span3 = box3.getSize(new THREE.Vector3()), hullSpan = Math.max(span3.x, span3.y, span3.z, 1e-6);
  const sailNode = m.solved.nodes.find((n) => n.part.kind === 'sail');
  const trueSide = sailNode ? sailSquareSide(sailNode.part.sail.areaM2) : 0;
  const drawnSide = sailNode ? Math.min(trueSide, Math.max(3 * hullSpan, 5)) : 0;
  const ratio = sailNode ? trueSide / drawnSide : 1;
  let film = null, sailInfo = null;
  if (sailNode) {
    if (useMech) {
      const mm = mechanismsFor(m, { hullSpan, architecture: opts.sailArchitecture ?? null, segCap: opts.sailSegCap ?? 400 });
      const sm = sailMechanismMesh(mm.drawn, { trueMech: mm.true, ratio: mm.ratio, iridescent: !!opts.iridescent });
      film = sm.group;
      sailInfo = { architecture: mm.architecture, why: mm.choice.why, boomClosure: mm.choice.boomClosure, mechanism: mm.true, drawn: mm.drawn, ratio: mm.ratio, readout: sm.readout, setJettison: sm.setJettison, canRefold: mm.true.canRefold, retract: mm.true.retract };
    } else film = sailFilm(drawnSide, { detail: ratio < 2 });
    film.position.fromArray(sailNode.world.position);
    const q = new THREE.Quaternion().fromArray(sailNode.world.quaternion);
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q).projectOnPlane(normal).normalize();
    const ref = new THREE.Vector3(1, 0, 0).projectOnPlane(normal); if (ref.lengthSq() < 1e-9) ref.set(0, 0, 1).projectOnPlane(normal); ref.normalize();
    const roll = Math.atan2(new THREE.Vector3().crossVectors(ref, edge).dot(normal), ref.dot(edge));
    film.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(normal, -roll));
    sailStage.add(film);
  }
  g.rotation.set(-Math.PI / 2, -0.42, 0);
  const setDeploy = (k) => { if (film) film.userData.setDeploy(k); for (const d of deployers) d(k); };
  setDeploy(1);
  const datum = new THREE.Group();
  const cgMark = sph(Math.max(hullSpan * 0.012, 1e-4), 'accent'); cgMark.position.fromArray(m.geometry.cgHull); datum.add(cgMark);
  if (m.geometry.sailAt) rod(datum, [m.geometry.sailAt[0], m.geometry.hullTopY, m.geometry.sailAt[2]], [m.geometry.sailAt[0], m.geometry.sailAt[1], m.geometry.sailAt[2]], Math.max(hullSpan * 0.002, 1e-5), 'accent', { seg: 5 });
  hullStage.add(datum);
  g.userData.fitAxis = null; g.userData.top = hullSpan;
  g.userData.stages = new Map([[0, hullStage], [1, sailStage]]);
  g.userData.setDeploy = setDeploy;
  g.userData.setCutaway = (on) => setCutaway(g, on);
  g.userData.setJettison = sailInfo?.setJettison ?? null;
  g.userData.sail = sailInfo;
  g.userData.measure = m;
  g.userData.livery = liveryFor(id);
  const pc = m.propulsion ? m.propulsion.beta * 100 : 0;
  const inv = m.inventory;
  const sailWord = sailInfo ? `${span(2 * sailInfo.mechanism.R)} ${sailInfo.architecture}` : `${span(2 * flasherRadius(trueSide * trueSide))} flasher`;
  g.userData.label = m.propulsion
    ? `stack ${span(hullSpan)} · ${m.propulsion.drive.short} · ${pc >= 1 ? pc.toFixed(1) : pc.toPrecision(2)} % c · ${m.propulsion.closes ? `${m.propulsion.tripYears.toFixed(0)} yr` : 'no route'}`
    : `hull ${span(hullSpan)}${m.geometry.mastLenM > 0 ? ` · mast ${span(m.geometry.mastLenM)}` : ' · hub-mounted'} · sail ${sailWord}${ratio > 1.02 ? ` · drawn 1:${Math.round(ratio)}` : ' · true size'}${inv && inv.crew ? ` · ${inv.crew} crew x ${(inv.days / 365.25).toFixed(0)} yr` : ''}`;
  return g;
}

/* The part builders, for other model files (parts/robotic-models.js draws the v5 ships with these and
   adds its own kinds; its colour-keyed helpers live in primitives/legacy.js); nothing here changes
   what buildCentauriModel draws. */
export { centauriPart, addPortRing, BUILDERS, span, freeAzimuths };

