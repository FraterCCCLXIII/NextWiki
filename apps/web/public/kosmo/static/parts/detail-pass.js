/* detail-pass.js -- put the human-scale fittings on every ship, from data, on the real surfaces.

   The pass walks the built model's part frames (each carries the catalogue part it was built from) and
   decides from the part's KIND what a well-engineered craft of that kind carries, at what density, and
   where on its surface: handrail rows along a pressurised module's barrel at four azimuths, bolt circles
   on every structural port ring at the connector's real bolt count, rivet rows on the panel seams, hatch
   frames with hinges and handles at every open berth, windows with frames and glazing, access panels,
   vents, fill ports on tanks, a cable run with P-clamps beside the raceway, tether rings along the EVA
   paths, foot restraints by the hatches, a nameplate with the ship's registration, docking targets by the
   berths, MMOD patches; ladders on landers; servicing fittings (bolts, fiducials, a tether ring) on probes.
   Nothing is placed by hand: the positions come from the hull segment's (theta, y) parameterisation and
   the torus's (phi, psi), so the fittings sit on the skin at the ship's true scale.

   Everything is merged into instanced meshes (primitives/detail.js) under one group tagged userData.detail,
   which the viewers toggle as the "detail" layer. Imports three. */

import * as THREE from 'three';
import {
  DETAIL, cylSurface, torusSurface, frameOn, boltCircle, boltsFor, rivetRow, rivetLine, handrail, ladder, footRestraint, tetherRing,
  cableRun, hatch, windowPort, accessPanel, vent, fillPort, dockingTarget, mmodPatch, nameplate, buildDetailMeshes
} from './primitives/detail.js';

const PORT_D = { 'paf-937': 0.937, 'paf-1194': 1.194, 'paf-1575': 1.575, 'idss-1200': 1.2, cbm: 1.27, 'lightband-12': 0.298, hardpoint: null, 'hinge-1d': null };
const HULL = new Set(['pressurised-module', 'stores-module', 'node', 'cargo', 'systems-module', 'despin-hub', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault', 'service-module', 'airlock']);
const CREWED = new Set(['pressurised-module', 'node', 'obs-deck', 'robot-hangar', 'fab-bay', 'airlock', 'crew-capsule']);
const TANKS = new Set(['stores', 'trim-stage', 'sail-canister', 'cargo']);
const RINGS = new Set(['centrifuge', 'habitat-ring', 'torpor-ring']);
const SERVICE = new Set(['bus', 'systems-bay', 'adapter', 'dock-adapter', 'pma', 'thrust-collar', 'spin-bearing', 'dust-shield', 'rtg', 'dish', 'lander', 'reactor', 'reactor-fsp', 'compute-rack', 'scout-rack', 'robot-lock', 'arrival-kit']);
const NONE = new Set(['sail', 'mast', 'payload', 'solar-array', 'radiator', 'landing-gear', 'grid-fins', 'robot', 'rail-network', 'truss', 'spin-bola']);

/** Deterministic pseudo-random in [0,1) from a string and an index, so patches land in the same place every build. */
function seeded(str, i) { let h = 2166136261 ^ i; for (let k = 0; k < str.length; k += 1) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

/** The end height a hull kind is drawn with (primitives/mesh.js hullSegmentMesh, robotic-models.js cutawayShell). */
function endHeight(kind, r, l) {
  if (['pressurised-module', 'stores-module', 'cargo', 'despin-hub', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault'].includes(kind)) return Math.min(r * 0.3, l * 0.12);
  if (kind === 'service-module') return 0.03;
  return Math.min(0.65, l * 0.1);
}

/** The registration stencil for a part: ship registration plus a short part code. */
function codeFor(registration, name, kind) {
  const code = { 'pressurised-module': 'LAB', 'stores-module': 'STO', node: 'NOD', cargo: 'CGO', 'systems-module': 'SYS', 'crew-capsule': 'CAP', 'service-module': 'SVC', 'robot-hangar': 'HGR', 'fab-bay': 'FAB', 'obs-deck': 'OBS', 'seed-vault': 'VLT', stores: 'TNK', 'trim-stage': 'TRM', drive: 'DRV', 'lander-aero': 'LDR', lander: 'LDR', airlock: 'ALK', bus: 'BUS', 'despin-hub': 'HUB' }[kind] ?? kind.slice(0, 3).toUpperCase();
  const n = (name.match(/\d+/) ?? ['1'])[0];
  return `${registration} ${code}-${String(n).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * Per-kind placement
 * ------------------------------------------------------------------ */

function hullFittings(p, name, reg, out, extras) {
  const r = p.dims.d / 2, l = p.dims.l, kind = p.kind;
  const endH = endHeight(kind, r, l), y0 = endH + 0.3, y1 = (kind === 'airlock' ? l * 0.6 : l) - endH - 0.3, barrel = y1 - y0;
  const surf = cylSurface(r), crewed = CREWED.has(kind) || (p.volume?.habitable ?? 0) > 0;
  if (barrel < 0.8) return;
  /* handrails: four rows clear of the racks (45 deg stations) and the raceway (+z), one every metre */
  if (r >= 0.8) {
    const rows = [0.0, 1.75, Math.PI, Math.PI + 1.75];
    for (const th of rows) {
      const n = Math.max(1, Math.floor(barrel / DETAIL.handrail.pitch));
      for (let k = 0; k < n; k += 1) { const y = y0 + (k + 0.5) * (barrel / n); handrail(surf.at(th, y), k % 3 === 2 ? DETAIL.handrail.longLength : DETAIL.handrail.length, out, 'z'); if (k % 2 === 1) tetherRing(surf.at(th + 0.12, y), out); }
    }
    /* circumferential rails round each end, where the crew works the berth */
    for (const y of [y0 + 0.15, y1 - 0.15]) for (let k = 0; k < 4; k += 1) handrail(surf.at(Math.PI / 4 + (k * Math.PI) / 2, y), DETAIL.handrail.length, out, 'x');
    footRestraint(surf.at(0.35, y1 - 0.3), out); footRestraint(surf.at(Math.PI + 0.35, y1 - 0.3), out);
    /* a cable run beside the raceway, clamped */
    cableRun(surf, Math.PI / 2 + 0.3, y0, y1, out);
    if (crewed) cableRun(surf, Math.PI / 2 + 0.42, y0 + 0.2, y1 - 0.2, out, 0.02);
  }
  /* rivet rows on the panel seams (one bay is ~1.6 m, as the painted skin) and stringers between them */
  if (r >= 0.6 && barrel >= 1.2) {
    const bays = Math.max(1, Math.round(barrel / 1.6));
    for (let k = 0; k <= bays; k += 1) rivetRow(surf, y0 + (barrel * k) / bays, out);
    const stringers = Math.max(6, Math.min(16, Math.round((2 * Math.PI * r) / 1.6)));
    for (let k = 0; k < stringers; k += 1) rivetLine(surf, ((k + 0.5) / stringers) * Math.PI * 2, y0, y1, out);
  }
  /* access panels, vents, MMOD patches, a nameplate */
  if (r >= 0.8) {
    for (let k = 0; k < 4; k += 1) accessPanel(surf.at(0.6 + (k * Math.PI) / 2, y0 + barrel * (0.25 + 0.5 * (k % 2))), out);
    vent(surf.at(2.4, y0 + barrel * 0.5), out); vent(surf.at(2.4 + Math.PI, y0 + barrel * 0.5), out);
    for (let k = 0; k < 2; k += 1) mmodPatch(surf.at(seeded(name, k) * Math.PI * 2, y0 + 0.4 + seeded(name, k + 7) * Math.max(barrel - 0.8, 0.1)), out);
    extras.push(nameplate(surf.at(0.25, y1 - 0.4), codeFor(reg, name, kind), { w: Math.min(1.0, r * 0.45), h: Math.min(0.25, r * 0.11) }));
  }
  /* windows on the crewed hulls: ISS-class 51 cm ports with frames and glazing, where the skin has them */
  if (crewed && r >= 1.2 && ['pressurised-module', 'obs-deck', 'airlock'].includes(kind)) {
    const n = kind === 'airlock' ? 1 : 2;
    for (let i = 0; i < n; i += 1) { const a = Math.PI * 1.5 + (i - (n - 1) / 2) * 0.35, y = endH + barrel * 0.5 + (i % 2 ? r * 0.3 : -r * 0.3); windowPort(DETAIL.window.iss.d, surf.at(a, y + 0.3), out); }
  }
}

/** Structural ports: a bolt circle on every mating ring at its connector's bolt count; a hatch frame with
 *  hinges, handle and a docking target at every crew berth left open. */
function portFittings(p, mated, out, extras) {
  for (const port of p.ports ?? []) {
    const d = PORT_D[port.type];
    if (!d) continue;
    const n = new THREE.Vector3(...port.axis).normalize();
    const along = Math.abs(n.y) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const pose = { p: port.at, q: frameOn(n.toArray(), along) };
    boltCircle(pose, d * 0.47, boltsFor(d, port.type), out);
    const isCrewPort = port.type === 'cbm' || port.type === 'idss-1200';
    if (isCrewPort && !mated.has(port.id) && !/^(hub|spinhub|root)/.test(port.id)) {
      const spec = port.type === 'cbm' ? DETAIL.hatch.cbm : DETAIL.hatch.idss;
      hatch(spec, { p: [port.at[0] + n.x * 0.02, port.at[1] + n.y * 0.02, port.at[2] + n.z * 0.02], q: pose.q }, out);
      const side = new THREE.Vector3(...along).cross(n).normalize().multiplyScalar(d * 0.75);
      dockingTarget({ p: [port.at[0] + side.x, port.at[1] + side.y, port.at[2] + side.z], q: pose.q }, out);
    }
  }
}

function tankFittings(p, name, reg, out, extras) {
  const kind = p.kind;
  let r = p.dims.d / 2, yA = 0, yB = p.dims.l;
  if (kind === 'trim-stage' && p.stage) { yA = p.dims.l - Math.min(p.stage.tank.dims.l, p.dims.l); }
  if (kind === 'drive' && p.store) { r = p.store.d / 2; yA = p.frame?.l ?? 0; yB = yA + Math.min(p.store.l, p.dims.l); }
  if (r < 0.4 || yB - yA < 1) return;
  const surf = cylSurface(r), dome = Math.min(r * 0.5, (yB - yA) * 0.12), y0 = yA + dome + 0.2, y1 = yB - dome - 0.2;
  for (const y of [y0, y1]) rivetRow(surf, y, out, r > 10 ? 0.6 : DETAIL.rivet.pitch);
  for (let k = 0; k < 4; k += 1) { handrail(surf.at((k * Math.PI) / 2 + 0.3, y1 - 0.5), DETAIL.handrail.length, out, 'x'); tetherRing(surf.at((k * Math.PI) / 2 + 0.6, y1 - 0.5), out); }
  fillPort(surf.at(0.5, y0 + 0.4), out); fillPort(surf.at(0.5 + Math.PI, y0 + 0.4), out);
  accessPanel(surf.at(1.4, y0 + (y1 - y0) * 0.5), out); accessPanel(surf.at(1.4 + Math.PI, y0 + (y1 - y0) * 0.5), out);
  cableRun(surf, 2.2, y0, y1, out);
  extras.push(nameplate(surf.at(0.2, y1 - 0.9), codeFor(reg, name, kind), { w: Math.min(1.6, r * 0.5), h: Math.min(0.4, r * 0.125) }));
  if (r > 3) for (let k = 0; k < 3; k += 1) mmodPatch(surf.at(seeded(name, k) * Math.PI * 2, y0 + seeded(name, k + 3) * (y1 - y0)), out);
}

function ringFittings(p, name, reg, out, extras) {
  const tube = p.dims.l / 2, R = p.ring?.R ?? (p.dims.d - p.dims.l) / 2;
  const surf = torusSurface(R, tube), circ = 2 * Math.PI * R;
  /* EVA handrails round the outer skin: at the equator and 35 degrees above and below, 1.2 m apart */
  for (const psi of [0, 0.6, -0.6]) {
    const n = Math.max(12, Math.round(circ / 1.2));
    for (let k = 0; k < n; k += 1) { const pose = surf.at((k / n) * Math.PI * 2, psi); handrail(pose, DETAIL.handrail.longLength, out, 'z'); if (k % 3 === 0 && psi === 0) tetherRing(surf.at(((k + 0.5) / n) * Math.PI * 2, 0.25), out); }
  }
  /* a hatch, a target and a bolted flange at every spoke head on the inner wall */
  const spokes = 6;
  for (let i = 0; i < spokes; i += 1) {
    const phi = (i / spokes) * Math.PI * 2, pose = surf.at(phi, Math.PI, 0.02);
    hatch(DETAIL.hatch.idss, pose, out);
    boltCircle(surf.at(phi, Math.PI, 0.01), Math.max(tube * 0.06, 0.5) + 0.15, 24, out);
    dockingTarget(surf.at(phi + 0.8 / R, Math.PI, 0.02), out);
    accessPanel(surf.at(phi + Math.PI / spokes, Math.PI - 0.5), out);
  }
  /* a line of rivets along the outer seam, and the registration on the outer skin */
  const seams = Math.max(16, Math.round(circ / 1.6));
  for (let k = 0; k < seams; k += 1) for (let j = 0; j <= 6; j += 1) { const pose = surf.at((k / seams) * Math.PI * 2, -0.9 + j * 0.3); out.push({ proto: 'dome', kind: 'grey', p: pose.p, q: pose.q, s: [DETAIL.rivet.d / 2, DETAIL.rivet.h, DETAIL.rivet.d / 2], tag: 'rivet' }); }
  for (let k = 0; k < 4; k += 1) extras.push(nameplate(surf.at((k / 4) * Math.PI * 2 + 0.3, 0.05), `${reg} RING`, { w: Math.min(3, tube * 0.6), h: Math.min(0.75, tube * 0.15) }));
}

function landerFittings(p, name, reg, out, extras) {
  const r = p.dims.d / 2, L = p.dims.l, aero = p.kind === 'lander-aero', bodyL = aero ? L - 2.4 : L;
  const surf = cylSurface(aero ? r : r / 1.35);
  /* a rung ladder from the hatch down the hull to the foot, caged above head height, and rails by the hatch */
  const hatchY = aero ? bodyL * 0.45 : L * 0.9;
  ladder(surf, 0, 0.05, hatchY - 0.3, out);
  if (aero) { hatch(DETAIL.hatch.dragon, surf.at(0, hatchY, 0.02), out); for (const dy of [-0.8, 0.8]) handrail(surf.at(0.35, hatchY + dy), DETAIL.handrail.length, out, 'z'); }
  for (let k = 0; k < 4; k += 1) { tetherRing(surf.at(0.4 + (k * Math.PI) / 2, hatchY + 0.4), out); handrail(surf.at(Math.PI / 4 + (k * Math.PI) / 2, bodyL * 0.8), DETAIL.handrail.length, out, 'x'); }
  if (aero) { rivetRow(surf, 0.1, out); rivetRow(surf, bodyL - 0.05, out); for (let k = 0; k < 8; k += 1) rivetLine(surf, ((k + 0.5) / 8) * Math.PI * 2, 0.2, bodyL - 0.2, out); }
  fillPort(surf.at(Math.PI, 0.6), out); fillPort(surf.at(Math.PI + 0.5, 0.6), out);
  accessPanel(surf.at(Math.PI - 0.7, bodyL * 0.3), out); vent(surf.at(2.0, bodyL * 0.6), out);
  extras.push(nameplate(surf.at(Math.PI / 2, bodyL * 0.7), codeFor(reg, name, p.kind), { w: Math.min(0.9, r * 0.6), h: 0.22 }));
}

function capsuleFittings(p, name, reg, out, extras) {
  const r = p.dims.d / 2, L = p.dims.l;
  /* four Dragon-class windows on the frustum, with frames and glazing, and the side hatch */
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, y = L * 0.34 + (i % 2) * L * 0.1, rr = r * (1 - 0.52 * ((y - L * 0.14) / (L * 0.54)));
    const n = [Math.cos(a), 0.45, Math.sin(a)];
    windowPort(DETAIL.window.dragon.d, { p: [Math.cos(a) * rr * 1.005, y, Math.sin(a) * rr * 1.005], q: frameOn(n, [0, 1, 0]) }, out);
  }
  const hn = [-0.6, 0.45, 0.76];
  hatch(DETAIL.hatch.dragon, { p: [-r * 0.5 * 1.02, L * 0.32, r * 0.62 * 1.02], q: frameOn(hn, [0, 1, 0]) }, out);
  const surf = cylSurface(r * 0.98);
  for (let k = 0; k < 4; k += 1) handrail(surf.at((k * Math.PI) / 2 + 0.2, L * 0.11), DETAIL.handrail.length, out, 'x');
  extras.push(nameplate(surf.at(1.2, L * 0.12), codeFor(reg, name, p.kind), { w: 0.8, h: 0.2 }));
}

/** Servicing fittings on an uncrewed body: bolts on its rings, a fiducial pair, a tether ring, one handrail if there is room for a hand. */
function serviceFittings(p, name, reg, out, extras) {
  const r = p.dims.d / 2, L = p.dims.l;
  if (r < 0.12 || L < 0.1) return;
  const surf = cylSurface(r);
  if (r >= 0.3) { dockingTarget(surf.at(0.3, L * 0.5), out); dockingTarget(surf.at(0.3 + Math.PI, L * 0.5), out); tetherRing(surf.at(1.9, L * 0.5), out); }
  if (r >= 0.5 && L >= 0.9) { handrail(surf.at(Math.PI + 0.4, L * 0.5), DETAIL.handrail.length, out, 'z'); accessPanel(surf.at(2.2, L * 0.5), out, Math.min(DETAIL.panel.w, r * 0.6), Math.min(DETAIL.panel.h, L * 0.4)); }
  if (r >= 0.15) extras.push(nameplate(surf.at(0.9, L * 0.55), codeFor(reg, name, p.kind), { w: Math.min(0.4, r * 0.8), h: Math.min(0.1, r * 0.2) }));
}

/* ------------------------------------------------------------------ *
 * The pass
 * ------------------------------------------------------------------ */

/**
 * Add the human-scale detail layer to a built model. `registration` is the ship's stencil (from the
 * livery). Returns the group (already added to the hull stage) with userData.counts by tag.
 */
export function addHumanDetail(model, { registration = 'KSM', mates = null } = {}) {
  const hullStage = model.userData.stages?.get(0) ?? model;
  hullStage.updateMatrixWorld(true);
  const frames = [];
  hullStage.traverse((o) => { if (o.userData?.part && o.userData.kind) frames.push(o); });
  const all = [], extrasAll = [];
  const matedPorts = new Map();
  for (const mt of mates ?? model.userData.measure?.solved?.mates ?? []) { for (const side of [mt.a, mt.b]) { if (!matedPorts.has(side.name)) matedPorts.set(side.name, new Set()); matedPorts.get(side.name).add(side.port); } }
  const inv = new THREE.Matrix4().copy(hullStage.matrixWorld).invert();
  for (const f of frames) {
    const p = f.userData.part, name = f.userData.partName ?? p.name, kind = p.kind;
    if (NONE.has(kind)) continue;
    const out = [], extras = [];
    const mated = matedPorts.get(name) ?? new Set();
    if (HULL.has(kind)) hullFittings(p, name, registration, out, extras);
    else if (RINGS.has(kind)) ringFittings(p, name, registration, out, extras);
    else if (kind === 'lander-aero' || kind === 'lander') landerFittings(p, name, registration, out, extras);
    else if (kind === 'crew-capsule') capsuleFittings(p, name, registration, out, extras);
    else if (TANKS.has(kind) || kind === 'drive') tankFittings(p, name, registration, out, extras);
    else if (SERVICE.has(kind)) serviceFittings(p, name, registration, out, extras);
    if (!NONE.has(kind) && kind !== 'drive') portFittings(p, mated, out, extras);
    const toStage = new THREE.Matrix4().copy(inv).multiply(f.matrixWorld);
    for (const it of out) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...it.p), it.q, new THREE.Vector3(1, 1, 1)).premultiply(toStage); it.p = new THREE.Vector3().setFromMatrixPosition(m).toArray(); it.q = new THREE.Quaternion().setFromRotationMatrix(m); all.push(it); }
    for (const e of extras) { e.applyMatrix4(toStage); extrasAll.push(e); }
  }
  const group = buildDetailMeshes(all);
  group.name = 'human-detail';
  for (const e of extrasAll) { group.add(e); group.userData.counts.nameplate = (group.userData.counts.nameplate ?? 0) + 1; }
  hullStage.add(group);
  model.userData.detailGroup = group;
  return group;
}

export { DETAIL };
