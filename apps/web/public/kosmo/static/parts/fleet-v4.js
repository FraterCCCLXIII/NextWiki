/* fleet-v4.js -- the realism pass: the eight Centauri classes rebuilt with a full systems inventory.

   v1-v3 are pinned and untouched. v4 re-cuts every class from a stated mission (crew x days, stop or
   fly by, closure) and sizes what the audit found missing: life support and its consumables, the
   stores modules that hold them, a storm shelter, bumpers and a bow dust shield, power (fission or
   radioisotope -- there is no sunlight on this route), radiators, CMGs or wheels, comms, RCS, a
   trim/braking stage from a delta-v budget, a magsail where the ship has to stop, and the sail's own
   canister, hub drive, beacons and vanes. Each item is a primitive from primitives/spec.js or a law
   in inventory.js with its source, and CENTAURI-INVENTORY.md is written from the same numbers.

   The design decisions, class by class (the "why" is in CENTAURI-INVENTORY.md):

     wafer       1 g StarChip: inventory on the chip, spin-deployed film, no mast
     smallsat    16U free-flyer on a lightband, RTG, laser terminal, reaction wheels, cold-gas RCS
     instrument  New Horizons-class bus: MMRTG, 2.1 m HGA, hydrazine trim stage, bow dust shield
     lander      aero-capable 2.4 m stainless lander: Haack nose, TPS, grid fins, legs, stops with a
                 magsail and lands on its own methalox
     capsule     Dragon-class 4-crew capsule, 30-day endurance, TPS and ogive nose: the destination
                 taxi, flown on its own sail as a stage demonstrator
     habitat     6 crew for 50 years at NASA Mars-class closure: Harmony node, Destiny lab, stores
                 spindle, a two-pod 1 g bola on a bearing, a 50 kWe reactor on a boom
     seed        20 crew for 50 years with a half-diet greenhouse in a 1 g ring, two labs, 300 kWe
     colony      1,000 crew for 50 years at world-ship closure: a 75 m2/person ring with the farm
                 decks, twin 12 MWe reactors on the despun hub, a stores spindle aft

   Pure functions, no DOM. fleet.js imports REALISM and assemblyV4(); the node checks do the same. */

import { PARTS, PORT_TYPES, SAIL_AREAL, sail, mastPart, centrifugePart } from './parts.js';
import { ringFor } from './centrifuge.js';
import { solveAssembly, summarize } from './assembly.js';
import { inventoryFor, sailSystemsFor, inventoryPart, CLOSURE, deltaVBudget } from './inventory.js';
import {
  hullSegmentSpec, trussSpec, reactorSpec, rtgSpec, radiatorSpec, dishSpec, landingLegSpec, gridFinSpec, tpsSpec, fairingSpec,
  kickStageSpec, dustShieldSpec, G0
} from './primitives/spec.js';
import { requiredPowerFor, CRUISE_C } from './beam.js';

const YEAR = 365.25 * 86400;
const DAY = 86400;

/* The source table's classes carry the same boost times and route as v1; the payload figure is the
   table's, and the lab prints how far the sized ship departs from it. */
const BASE = {
  wafer: { payloadKg: 0.001, boostS: 600, boostLabel: '10 min' },
  smallsat: { payloadKg: 10, boostS: DAY, boostLabel: '1 day' },
  instrument: { payloadKg: 100, boostS: YEAR / 12, boostLabel: '1 month' },
  lander: { payloadKg: 1000, boostS: YEAR, boostLabel: '1 yr' },
  capsule: { payloadKg: 1e4, boostS: 2 * YEAR, boostLabel: '2 yr' },
  habitat: { payloadKg: 1e5, boostS: 2 * YEAR, boostLabel: '2 yr' },
  seed: { payloadKg: 1e6, boostS: 3 * YEAR, boostLabel: '3 yr' },
  colony: { payloadKg: 1e7, boostS: 5 * YEAR, boostLabel: '5 yr' }
};

/* The missions. `years` is the cruise the delta-v budget covers; `days` the crewed endurance. */
export const MISSIONS = {
  wafer: { crew: 0, days: 0, stop: false, power: 'chip', years: 44, label: 'flyby probe, 44-year cruise' },
  smallsat: { crew: 0, days: 0, stop: false, power: 'none', years: 44, isp: 70, label: 'flyby free-flyer, 44-year cruise, cold-gas trim' },
  instrument: { crew: 0, days: 0, stop: false, power: 'rtg-part', years: 44, isp: 230, dishM: 2.1, laserApertureM: 0.3, label: 'flyby probe, MMRTG, hydrazine trim' },
  lander: { crew: 0, days: 0, stop: true, land: true, power: 'rtg-part', years: 44, isp: 330, dishM: 1.0, laserApertureM: 0.2, label: 'stops (magsail), aerobrakes and lands' },
  capsule: { crew: 4, days: 30, stop: false, power: 'trunk', years: 2, label: '4 crew x 30 d destination taxi, open-loop ECLSS in the capsule' },
  habitat: { crew: 6, days: 50 * 365.25, stop: true, closure: 'advanced', power: 'reactor', years: 46, isp: 320, dishM: 3, laserApertureM: 1.0, label: '6 crew x 50 yr, 98 % water / 75 % O2 closure, stored food, 1 g bola' },
  seed: { crew: 20, days: 50 * 365.25, stop: true, closure: 'greenhouse', power: 'reactor', years: 46, isp: 320, dishM: 3, laserApertureM: 1.0, label: '20 crew x 50 yr, half-diet greenhouse in a 1 g ring' },
  colony: { crew: 1000, days: 50 * 365.25, stop: true, closure: 'closed', power: 'reactor', years: 46, isp: 320, dishM: 5, laserApertureM: 2.0, label: '1,000 crew x 50 yr, world-ship closure, farm decks in a 1 g ring' }
};

export const REALISM = Object.keys(BASE).map((id) => ({
  id: `${id}-v4`, base: id, version: 4, name: `${{ wafer: 'Wafer probe', smallsat: 'Small satellite', instrument: 'Instrument probe', lander: 'Robotic lander', capsule: 'Crewed capsule', habitat: 'Crewed habitat', seed: 'Colony seed', colony: 'Full colony' }[id]}, realism pass`,
  payloadKg: BASE[id].payloadKg, payloadLabel: `${BASE[id].payloadKg >= 1e3 ? `${BASE[id].payloadKg / 1e3} t` : BASE[id].payloadKg >= 1 ? `${BASE[id].payloadKg} kg` : '1 g'} (table)`,
  energyJ: null, peakW: null, boostS: BASE[id].boostS, boostLabel: BASE[id].boostLabel, costUsd: null,
  mission: MISSIONS[id]
}));

/* ------------------------------------------------------------------ *
 * Derived parts
 * ------------------------------------------------------------------ */

const stack = (l, aft = 'paf-1194', fore = 'paf-1194') => [
  { id: 'aft', type: aft, gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] },
  { id: 'fore', type: fore, gender: 'active', at: [0, l, 0], axis: [0, 1, 0] }
];
/* A CBM chain part (aft active, fore passive, as the modules are) or a radial one hung on a node's
   active side berth (aft passive). */
const cbm = (l, radial = false) => [
  { id: 'aft', type: 'cbm', gender: radial ? 'passive' : 'active', at: [0, 0, 0], axis: [0, -1, 0] },
  { id: 'fore', type: 'cbm', gender: radial ? 'active' : 'passive', at: [0, l, 0], axis: [0, 1, 0] }
];
const hinge = (id, gender, at, axis) => ({ id, type: 'hinge-1d', gender, at, axis });

/** A copy of a catalogue part with inventory items added to its mass. */
function absorb(id, items, nameSuffix = '') {
  const p = typeof id === 'string' ? PARTS[id] : id;
  const extra = items.reduce((s, i) => s + i.kg, 0);
  return { ...p, name: p.name + nameSuffix, mass: p.mass + extra, inventory: [...(p.inventory ?? []), ...items.map((i) => ({ item: i.item, kg: i.kg, m3: i.m3 ?? null, W: i.W ?? 0, source: i.source }))], power: { gen: (p.power?.gen ?? 0) + items.reduce((s, i) => s + (i.genW ?? 0), 0), load: (p.power?.load ?? 0) + items.reduce((s, i) => s + (i.W ?? 0), 0) } };
}

/** Pressurised stores modules at a stack diameter, chained, each no longer than `maxL`. Volume from the items' own m3 at 80 % packing. */
function storesModules(items, { d = 4.5, maxL = 9, radial = false, prefix = 'stores' } = {}) {
  const V = items.reduce((s, i) => s + (i.m3 ?? i.kg / 400), 0) / 0.8;
  const area = Math.PI * (d / 2) ** 2;
  const totalL = V / area;
  const n = Math.max(1, Math.ceil(totalL / maxL));
  const l = Math.max(2, totalL / n);
  const shell = hullSegmentSpec({ d, l, fitOutKgM2: 15, name: 'stores module' });
  const perKg = items.reduce((s, i) => s + i.kg, 0) / n;
  const out = [];
  for (let k = 0; k < n; k += 1) {
    out.push({
      as: `${prefix}${k}`,
      part: inventoryPart({
        name: `Stores module ${k + 1}/${n}, ${(perKg / 1e3).toPrecision(3)} t`, kind: 'stores-module',
        items: items.map((i) => ({ ...i, kg: i.kg / n, m3: (i.m3 ?? i.kg / 400) / n })),
        dims: { l, d }, ports: cbm(l, radial), volume: { pressurised: shell.volume.pressurised, habitable: 0 },
        source: `${shell.source}; contents at 80 % packing`, extra: { shellKg: shell.mass }
      })
    });
    out[k].part.mass += shell.mass;
    out[k].part.inventory.unshift({ item: 'module shell, bumper and racks', kg: shell.mass, m3: null, W: 0, source: shell.source });
  }
  return out;
}

/** An unpressurised systems bay (GNC, CMGs, PMAD, batteries, spares) as a pallet of the items' volume. */
function systemsBay(items, { d = 2.2, ports, kind = 'systems-bay', name = 'Systems bay' }) {
  const V = Math.max(0.005, items.reduce((s, i) => s + (i.m3 ?? i.kg / 600), 0) / 0.6);
  const l = Math.max(0.3, V / (Math.PI * (d / 2) ** 2));
  return inventoryPart({ name, kind, items, dims: { l, d }, ports: ports ?? cbm(l, true) });
}

function canisterPart(sys) {
  const c = sys.canister;
  return inventoryPart({
    name: `Sail canister and hub drive, ${c.dims.d.toPrecision(3)} m drum`, kind: 'sail-canister', items: sys.items,
    dims: { l: c.dims.l, d: c.dims.d },
    ports: [hinge('aft', 'passive', [0, 0, 0], [0, -1, 0]), hinge('hub', 'active', [0, c.dims.l, 0], [0, 1, 0])],
    source: c.source, extra: { stowed: { l: c.dims.l, d: c.dims.d }, sailSystems: sys }
  });
}

function trimStagePart(stage, magItem, portType = 'cbm', foreGender = 'passive') {
  const l = stage.dims.l, d = Math.max(stage.dims.d, portType === 'cbm' ? 2.4 : 0.3);
  const items = [
    { item: `${stage.name} propellant (Isp ${stage.isp} s)`, kg: stage.propKg, m3: stage.tank.volumeM3, source: stage.source },
    { item: 'tanks, pressurant and feed', kg: stage.tankKg, source: stage.tank.source },
    { item: `engine, ${(stage.engine.thrustN / 1e3).toPrecision(3)} kN`, kg: stage.engine.mass, source: stage.engine.source }
  ];
  if (magItem) items.push(magItem);
  const ports = portType === 'cbm'
    ? [{ id: 'fore', type: 'cbm', gender: foreGender, at: [0, l, 0], axis: [0, 1, 0] }, hinge('aft', 'active', [0, 0, 0], [0, -1, 0])]
    : [{ id: 'fore', type: portType, gender: 'active', at: [0, l, 0], axis: [0, 1, 0] }, hinge('aft', 'active', [0, 0, 0], [0, -1, 0])];
  return inventoryPart({ name: `Trim and braking stage, ${stage.dvMs.toFixed(0)} m/s`, kind: 'trim-stage', items, dims: { l, d }, ports, extra: { stage, propellantKg: stage.propKg } });
}

function reactorPart(spec, name) {
  return { name: name ?? `${(spec.powerWe / 1e3).toPrecision(3)} kWe fission reactor`, kind: 'reactor', dataQuality: 'derived', source: spec.source, dims: spec.dims, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: spec.power, heat: spec.heat, reactor: spec, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0])] };
}
function boomPart(spec, name = 'Reactor boom') {
  return { name: `${name}, ${spec.dims.l.toFixed(0)} m`, kind: 'truss', dataQuality: 'derived', source: spec.source, dims: spec.dims, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null }, truss: spec, ports: [hinge('aft', 'passive', [0, 0, 0], [0, -1, 0]), hinge('fore', 'active', [0, spec.dims.l, 0], [0, 1, 0])] };
}
function radiatorPart(spec, name = 'Radiator wing', { wings = 2, layout = 'row' } = {}) {
  /* one part per wing, carrying `panels` of the spec's panels. `layout` 'row' hangs them end to end
     (the wing is long and one panel wide, like the ISS HRS); 'side' hangs them side by side. The QA
     pass moved the default from 'side' to 'row': a 16 m wide wing on a 7 m node crossed the airlock
     and the PMA beside it, and a 185 m slab on the colony hub crossed the ring. Mass is the spec's
     share, so the pinned hull masses do not move. */
  const panels = spec.panels / wings, w = spec.panelW * 1.05;
  const l = layout === 'row' ? spec.panelL * panels : spec.panelL, d = layout === 'row' ? w : w * panels;
  const rad = layout === 'row' ? { ...spec, panels: 1, panelL: l, perSide: panels } : { ...spec, panels };
  return { name: `${name}, ${(spec.areaM2 / wings).toFixed(0)} m2`, kind: 'radiator', dataQuality: 'derived', source: spec.source, dims: { l, d }, mass: spec.mass / wings, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 200 / wings }, heat: { rejectCapacity: spec.heatW / wings }, radiator: rad, layout, standoff: 0.6, stowed: { l: l / 8, d }, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0])] };
}
function rtgPart(spec) {
  return { name: `MMRTG-class radioisotope generator, ${spec.powerW.toFixed(0)} We EOL`, kind: 'rtg', dataQuality: 'derived', source: spec.source, dims: spec.dims, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: spec.power, heat: spec.heat, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0])] };
}
function dishPart(spec) {
  return { name: `High-gain antenna, ${spec.dims.d} m, ${spec.gainDbi.toFixed(0)} dBi`, kind: 'dish', dataQuality: 'derived', source: spec.source, dims: spec.dims, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 60 }, heat: { rejectCapacity: null }, dish: spec, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0])] };
}
function legsPart(spec) {
  return { name: `Landing gear, ${spec.count} legs, ${spec.spanM.toFixed(1)} m span`, kind: 'landing-gear', dataQuality: 'derived', source: spec.source, dims: { l: spec.heightM, d: spec.spanM }, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null }, legs: spec, ports: [hinge('root', 'passive', [0, 0, 0], [0, 1, 0])] };
}
function finsPart(spec) {
  return { name: `Grid fins, ${spec.count}`, kind: 'grid-fins', dataQuality: 'derived', source: spec.source, dims: spec.dims, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 200 }, heat: { rejectCapacity: null }, fins: spec, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0])] };
}
function dustShieldPart(spec, d) {
  const t = Math.max(0.02, spec.kgPerM2 / 1850 * 1.2); // beryllium at 1,850 kg/m3 plus standoff
  return { name: `Bow dust shield, ${spec.kgPerM2.toFixed(0)} kg/m2`, kind: 'dust-shield', dataQuality: 'derived', source: spec.source, dims: { l: t + 0.3, d }, mass: spec.mass, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null }, ports: cbm(t + 0.3), shield: spec };
}

/** The v4 mast: a lattice truss sized from the sail thrust it carries in compression (primitives/spec.js trussSpec), with a 1.5 kg deployer. */
function mastPartV4(lengthM, thrustN) {
  const t = trussSpec({ lengthM, widthM: Math.min(12, Math.max(0.12, lengthM * 0.04)), axialLoadN: Math.max(thrustN, 1) * 1.5, name: 'sail mast' });
  return {
    name: `Sail mast, ${lengthM >= 10 ? lengthM.toFixed(0) : lengthM.toFixed(1)} m, ${(thrustN / 1e3).toPrecision(3)} kN`, kind: 'mast', dataQuality: 'derived',
    source: `${t.source}; carries the sail thrust (2 eta P / c) in compression with a 1.5 kg deployer`,
    dims: { l: lengthM, d: t.dims.d }, mass: t.mass + 1.5, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null },
    stowed: { l: Math.min(1.4, lengthM), d: t.dims.d }, truss: t, thrustN,
    ports: [hinge('aft', 'passive', [0, 0, 0], [0, -1, 0]), hinge('fore', 'active', [0, lengthM, 0], [0, 1, 0])]
  };
}

/* The v2 bearing's dock port sat at its node-side face pointing back into the node, so the v2 PMA
   berths inside the node (a pinned v2 finding, see CENTAURI-AUDIT.md). The v4 bearing docks on its
   far face, on the spin axis, pointing aft. */
const BEARING_V4 = {
  ...PARTS['spin-bearing'], name: 'Spin-ring bearing, aft-docking (v4)',
  source: `${PARTS['spin-bearing'].source}; dock port moved to the far face so the braking stage hangs aft of the bearing`,
  ports: [
    hinge('aft', 'passive', [0, 0, 0], [0, -1, 0]),
    hinge('hub', 'passive', [0, 0.5, 0], [0, 1, 0]),
    { id: 'dock', type: 'cbm', gender: 'active', at: [0, 1.0, 0], axis: [0, 1, 0] }
  ]
};

/** A two-pod bola: two habitat pods on trusses, turning on the spin bearing at 4 rpm and 55.9 m. */
function bolaPart(crew, R = 55.9) {
  const pod = hullSegmentSpec({ d: 4.4, l: 8.5, endKind: 'dome', name: 'bola pod' });
  const podKg = pod.mass + crew * 150; // quarters fit-out is in the crew fittings; 150 kg/person of pod-specific furnishing
  const truss = trussSpec({ lengthM: R - pod.dims.d / 2 - 2.2, widthM: 1.2, axialLoadN: podKg * G0 * 1.5, name: 'bola spoke' });
  const mass = 2 * podKg + 2 * truss.mass + 1200;
  return {
    name: `1 g bola, two ${pod.dims.d} m pods at ${R.toFixed(1)} m`, kind: 'spin-bola', dataQuality: 'derived',
    source: `Derived: two ${pod.dims.l} x ${pod.dims.d} m pods (${pod.source}), two ${truss.dims.l.toFixed(0)} m trusses (${truss.source}), 1.2 t hub; 1 g at 4 rpm`,
    dims: { l: pod.dims.d, d: 2 * R + pod.dims.l }, origin: 'centre', mass,
    volume: { pressurised: 2 * pod.volume.pressurised, habitable: 2 * pod.volume.habitable },
    crew, power: { gen: 0, load: 4000 }, heat: { rejectCapacity: 5000 },
    bola: { R, pod, truss, rpm: 4, rimSpeed: (4 * 2 * Math.PI / 60) * R },
    inventory: [{ item: 'two pressurised pods', kg: 2 * podKg, source: pod.source }, { item: 'two lattice spokes', kg: 2 * truss.mass, source: truss.source }, { item: 'hub, slip rings, elevator', kg: 1200, source: 'derived' }],
    ports: [hinge('hub', 'active', [0, 0, 0], [0, 1, 0])]
  };
}

/* ------------------------------------------------------------------ *
 * The assemblies
 * ------------------------------------------------------------------ */

/** Solve a part list once and report mass, height, pressurised volume, hull area and inertia for the inventory laws. */
function hullStats(root, parts, mates) {
  const solved = solveAssembly({ root, parts, mates });
  const s = summarize(solved.nodes);
  const area = solved.nodes.reduce((a, n) => a + Math.PI * (n.part.dims.d ?? 0) * (n.part.dims.l ?? 0) * (n.part.volume?.pressurised ? 1 : 0.5), 0);
  const span = Math.max(s.bounds.size[0], s.bounds.size[2]);
  const frontal = solved.nodes.filter((n) => Math.abs(n.world.quaternion[0]) < 0.1 && Math.abs(n.world.quaternion[2]) < 0.1).reduce((a, n) => Math.max(a, Math.PI * ((n.part.dims.d ?? 0) / 2) ** 2), 0);
  return { mass: s.mass, height: s.bounds.height, pressurised: s.volumes.pressurised, area, span, frontal, inertia: s.mass * (Math.max(span, s.bounds.height) / 4) ** 2 };
}

/** The trim/braking stage sized from what it actually pushes: every placed part except itself. The
 *  inventory's own stage estimate is replaced by this second pass so the delta-v budget closes on the
 *  assembled hull, not on an estimate of it; the magsail (10 % of the pushed mass) rides on the stage. */
function stageFor(parts, M, portType, foreGender) {
  const pushed = parts.reduce((s, p) => s + (typeof p.part === 'string' ? PARTS[p.part].mass : p.part.mass), 0);
  const dv = deltaVBudget({ years: M.years, stop: M.stop });
  const magKg = M.stop ? 0.10 * pushed : 0;
  const stage = kickStageSpec({ shipDryKg: pushed + magKg, dvMs: dv.totalMs, isp: M.isp, name: 'trim and braking stage' });
  const magItem = M.stop ? { item: 'magsail deceleration loop and coil drum', kg: magKg, source: 'Derived: 10 % of decelerated mass (Zubrin & Andrews 1991; Perakis & Hein 2016)' } : null;
  return trimStagePart(stage, magItem, portType, foreGender);
}

/** Everything a v4 class is, before the sail: parts, mates, the mount the mast stands on, the inventory. */
export function hullV4(cls) {
  const M = cls.mission, id = cls.base;
  const closure = CLOSURE[M.closure] ?? CLOSURE.advanced;

  if (id === 'wafer') {
    const chip = {
      ...PARTS['chip-wafer'], name: 'Wafer-scale probe (StarChip), inventoried', dataQuality: 'derived',
      source: 'Breakthrough Starshot StarChip budget (Lubin 2016; Parkin 2018 system model): processor, camera, laser comm, RTG/battery, photon thrusters, dust shield in 1 g',
      inventory: [
        { item: 'processor and memory', kg: 0.00020, source: 'Starshot: sub-gram SoC' },
        { item: '4 cameras (sub-gram CMOS)', kg: 0.00010, source: 'Starshot' },
        { item: '1 W laser transmitter and 0.1 m2 film-as-aperture receiver electronics', kg: 0.00020, source: 'Starshot comms (Parkin 2018)' },
        { item: 'Pu-238 / Am-241 RTG, 0.1 W, and battery', kg: 0.00015, source: 'Starshot: radioisotope power ~0.15 g' },
        { item: '4 photon thrusters (LED) for attitude', kg: 0.00010, source: 'Starshot' },
        { item: 'leading-edge Be-Cu dust shield', kg: 0.00015, source: 'Starshot: Be/Cu coating against ISM dust at 0.2 c' },
        { item: 'retroreflector and beacon', kg: 0.00010, source: 'derived' }
      ]
    };
    return { root: 'chip', parts: [{ as: 'chip', part: chip }], mates: [], mount: null, inventory: null, systems: null, stats: null };
  }

  if (id === 'smallsat') {
    const bus = PARTS['bus-16u'];
    const stats0 = hullStats('bus', [{ as: 'bus', part: bus }], []);
    const inv = inventoryFor({ crew: 0, days: 0, stop: false, power: 'none', years: M.years, isp: M.isp, dryHardwareKg: stats0.mass, hullAreaM2: stats0.area, frontalAreaM2: stats0.frontal, inertiaKgM2: stats0.inertia, beta: CRUISE_C, busW: 5 });
    const stageItem = inv.items.find((i) => i.group === 'propulsion' && i.spec?.primitive === 'kick-stage');
    const bayItems = [...inv.items.filter((i) => i !== stageItem), { group: 'structure', item: '11.7 in motorised lightband, separation half', kg: 3.3, source: 'Planetary Systems Corp. MLB 11.732 in' }];
    const bay = systemsBay(bayItems, { d: 0.33, kind: 'systems-bay', name: 'Systems bay (wheels, PMAD, shields, lightband, spares)', ports: [{ id: 'aft', type: 'lightband-12', gender: 'passive', at: [0, 0, 0], axis: [0, -1, 0] }, { id: 'fore', type: 'lightband-12', gender: 'active', at: [0, 0.2, 0], axis: [0, 1, 0] }] });
    bay.dims.l = Math.max(bay.dims.l, 0.2); bay.ports[1].at = [0, bay.dims.l, 0];
    const stage = stageFor([{ as: 'bay', part: bay }, { as: 'bus', part: bus }], M, 'lightband-12');
    return {
      root: 'stage',
      parts: [{ as: 'stage', part: stage }, { as: 'bay', part: bay }, { as: 'bus', part: bus }],
      mates: [{ a: 'stage.fore', b: 'bay.aft' }, { a: 'bay.fore', b: 'bus.aft' }],
      mount: { name: 'bus', port: 'hub' }, inventory: inv
    };
  }

  if (id === 'instrument') {
    const bus = PARTS['bus-probe'];
    const rtg = rtgPart(rtgSpec({ powerW: 110, yearsToEOL: M.years, name: 'MMRTG' }));
    const hga = dishPart(dishSpec({ d: M.dishM }));
    const stats0 = hullStats('bus', [{ as: 'bus', part: bus }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }], [{ a: 'bus.rtg', b: 'rtg.root' }, { a: 'bus.hga', b: 'hga.root' }]);
    const inv = inventoryFor({ crew: 0, days: 0, stop: false, power: 'none', years: M.years, isp: M.isp, laserApertureM: M.laserApertureM, dryHardwareKg: stats0.mass, hullAreaM2: stats0.area, frontalAreaM2: stats0.frontal, inertiaKgM2: stats0.inertia, beta: CRUISE_C, busW: 150 });
    const stageItem = inv.items.find((i) => i.spec?.primitive === 'kick-stage');
    const bay = systemsBay(inv.items.filter((i) => i !== stageItem), { d: 1.6, name: 'Systems bay (wheels, laser terminal, PMAD, shields, spares)', ports: stack(0.5, 'paf-937', 'paf-937') });
    bay.ports[1].at = [0, bay.dims.l, 0];
    const stage = stageFor([{ as: 'bay', part: bay }, { as: 'bus', part: bus }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }], M, 'paf-937');
    return {
      root: 'stage',
      parts: [{ as: 'stage', part: stage }, { as: 'bay', part: bay }, { as: 'bus', part: bus }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }],
      mates: [{ a: 'stage.fore', b: 'bay.aft' }, { a: 'bay.fore', b: 'bus.aft' }, { a: 'bus.rtg', b: 'rtg.root' }, { a: 'bus.hga', b: 'hga.root' }],
      mount: { name: 'bus', port: 'sailmount' }, inventory: inv
    };
  }

  if (id === 'lander') {
    const base = PARTS['lander-aero'];
    const tps = tpsSpec({ areaM2: Math.PI * base.dims.d * base.dims.l * 0.5 + fairingSpec({ d: base.dims.d, l: 2.4 }).areaM2, kind: 'tile' });
    const rtg = rtgPart(rtgSpec({ powerW: 110, yearsToEOL: M.years, name: 'MMRTG' }));
    const hga = dishPart(dishSpec({ d: M.dishM }));
    /* the landing burn is the lander's own: 1,000 m/s of methalox after an aerobraking entry (Mars-class terminal descent) */
    const landedDry = base.mass + tps.mass + 400;
    const landing = kickStageSpec({ shipDryKg: landedDry, dvMs: 1000, isp: 330, tankFraction: 0.08, bulkKgM3: 800, name: 'landing propellant' });
    const legs = legsPart(landingLegSpec({ landedKg: landedDry + landing.propKg * 0.1, bodyD: base.dims.d, bodyL: base.dims.l, g: 1.1 * G0 }));
    const fins = finsPart(gridFinSpec({ bodyD: base.dims.d }));
    const lander = absorb({ ...base, ports: [...base.ports, hinge('rtg', 'active', [1.2, 2.2, 0], [1, 0, 0]), hinge('hga', 'active', [-1.2, 2.2, 0], [-1, 0, 0])] }, [
      { item: `TPS tiles, windward half and nose (${tps.areaM2.toFixed(1)} m2)`, kg: tps.mass, source: tps.source },
      { item: 'landing propellant, methalox, 1,000 m/s', kg: landing.propKg, m3: landing.propKg / 800, source: landing.source },
      { item: 'landing tankage margin and pressurant', kg: landing.tankKg, source: landing.tank.source }
    ]);
    const stats0 = hullStats('lander', [{ as: 'lander', part: lander }, { as: 'legs', part: legs }, { as: 'fins', part: fins }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }], [{ a: 'lander.legmount', b: 'legs.root' }, { a: 'lander.finmount', b: 'fins.root' }, { a: 'lander.rtg', b: 'rtg.root' }, { a: 'lander.hga', b: 'hga.root' }]);
    const inv = inventoryFor({ crew: 0, days: 0, stop: true, power: 'none', years: M.years, isp: M.isp, laserApertureM: M.laserApertureM, dryHardwareKg: stats0.mass, hullAreaM2: stats0.area, frontalAreaM2: stats0.frontal, inertiaKgM2: stats0.inertia, beta: CRUISE_C, busW: 300 });
    const stageItem = inv.items.find((i) => i.spec?.primitive === 'kick-stage');
    const magItem = inv.items.find((i) => /magsail/.test(i.item));
    const bayItems = inv.items.filter((i) => i !== stageItem && i !== magItem);
    const landerFull = absorb(lander, bayItems, '');
    const stage = stageFor([{ as: 'lander', part: landerFull }, { as: 'legs', part: legs }, { as: 'fins', part: fins }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }], M, 'paf-1575');
    return {
      root: 'stage',
      parts: [{ as: 'stage', part: stage }, { as: 'lander', part: landerFull }, { as: 'legs', part: legs }, { as: 'fins', part: fins }, { as: 'rtg', part: rtg }, { as: 'hga', part: hga }],
      mates: [{ a: 'stage.fore', b: 'lander.aft' }, { a: 'lander.legmount', b: 'legs.root' }, { a: 'lander.finmount', b: 'fins.root' }, { a: 'lander.rtg', b: 'rtg.root' }, { a: 'lander.hga', b: 'hga.root' }],
      mount: { name: 'lander', port: 'sailmount' }, inventory: inv, landing
    };
  }

  if (id === 'capsule') {
    return {
      root: 'trunk',
      parts: [{ as: 'trunk', part: 'trunk-solar' }, { as: 'capsule', part: 'capsule-tps' }, { as: 'stage', part: 'sail-stage' }],
      mates: [{ a: 'trunk.fore', b: 'capsule.aft' }, { a: 'capsule.dock', b: 'stage.dock' }],
      mount: { name: 'stage', port: 'hub' }, inventory: null
    };
  }

  /* ---- the three crewed long-duration classes ---- */
  const crew = M.crew, days = M.days;
  if (id === 'habitat' || id === 'seed') {
    const node = PARTS['node-harmony'];
    const ring = id === 'habitat' ? bolaPart(crew) : centrifugePart(ringFor({ crew, rpm: 4, areaPerCrew: 30 + 50 * closure.food }), { name: `${cls.name} ring` });
    const labs = id === 'habitat' ? [{ as: 'lab', part: 'module-destiny' }] : [{ as: 'lab', part: 'module-destiny' }, { as: 'lab2', part: 'lab-columbus' }, { as: 'node1', part: 'node-harmony' }];
    const pressurised0 = node.volume.pressurised + labs.reduce((s, l) => s + (PARTS[l.part].volume.pressurised ?? 0), 0) + ring.volume.pressurised + PARTS['airlock-quest'].volume.pressurised;
    const dry0 = node.mass + labs.reduce((s, l) => s + PARTS[l.part].mass, 0) + ring.mass + PARTS['airlock-quest'].mass + PARTS.pma.mass + PARTS['thrust-collar'].mass;
    const inv = inventoryFor({ crew, days, closure, stop: true, power: 'reactor', years: M.years, isp: M.isp, dishM: M.dishM, laserApertureM: M.laserApertureM, pressurisedM3: pressurised0, dryHardwareKg: dry0, hullAreaM2: Math.PI * 4.5 * (7.2 + 8.5 * labs.length) + ring.dims.d * 4, frontalAreaM2: Math.PI * 2.25 ** 2, inertiaKgM2: (dry0 + 2e5) * 30 ** 2, beta: CRUISE_C });
    const by = (g) => inv.items.filter((i) => i.group === g);
    const stageItem = inv.items.find((i) => i.spec?.primitive === 'kick-stage');
    const magItem = inv.items.find((i) => /magsail/.test(i.item));
    const reactorItem = inv.items.find((i) => i.spec?.primitive === 'reactor');
    const radItem = inv.items.find((i) => i.spec?.primitive === 'radiator');
    const ghItem = inv.items.find((i) => /greenhouse/.test(i.item));
    const shelterItem = inv.items.find((i) => i.spec?.primitive === 'storm-shelter');
    /* where things live */
    const labItems = [...by('life support').filter((i) => i !== ghItem), ...by('crew fittings'), shelterItem, ...by('gas storage'), ...by('water storage')].filter(Boolean);
    const lab0 = absorb('module-destiny', labItems, ' (ECLSS, quarters, shelter)');
    /* QA pass: the radiators hang on the lab's flanks at mid-length, not on the node's fore cone, where
       a wing wider than 2.8 m crossed the airlock and the PMA on the node's radial berths */
    const lab = { ...lab0, ports: [...lab0.ports, { ...hinge('mount-5', 'active', [0, lab0.dims.l / 2, lab0.dims.d / 2], [0, 0, 1]), clock: [0, 1, 0] }, { ...hinge('mount-6', 'active', [0, lab0.dims.l / 2, -lab0.dims.d / 2], [0, 0, -1]), clock: [0, 1, 0] }] };
    const storesItems = [...by('consumables'), ...by('spares')];
    const stores = storesModules(storesItems, id === 'seed' ? { d: 6.6, maxL: 12 } : { d: 4.4, maxL: 9 });
    const bayItems = [...by('power').filter((i) => i !== reactorItem), ...by('GNC'), ...by('comms'), ...by('RCS'), ...by('MMOD').filter((i) => !/dust/.test(i.item)), ...by('thermal').filter((i) => i !== radItem)];
    const bay = systemsBay(bayItems, { d: 4.4, kind: 'systems-module', name: 'Systems module (CMGs, PMAD, batteries, comms, RCS, bumpers)' });
    const ringFull = ghItem ? { ...ring, mass: ring.mass + ghItem.kg, inventory: [...(ring.inventory ?? []), { item: ghItem.item, kg: ghItem.kg, source: ghItem.source }], power: { gen: 0, load: ring.power.load + ghItem.W } } : ring;
    const reactor = reactorPart(reactorItem.spec);
    const boom = boomPart(trussSpec({ lengthM: Math.max(25, reactor.dims.l * 2.5), widthM: 1.5, axialLoadN: reactor.mass * 0.5 }));
    const rad = radItem.spec;
    const radA = radiatorPart(rad), radB = radiatorPart(rad);
    const dust = dustShieldPart(inv.items.find((i) => /dust/.test(i.item)).spec, id === 'seed' ? 6.6 : 4.4);
    const chain = ['node', ...labs.map((l) => l.as), ...stores.map((s) => s.as), 'dust', 'collar'];
    const mates = [];
    for (let i = 0; i < chain.length - 1; i += 1) mates.push({ a: `${chain[i]}.fore`, b: `${chain[i + 1]}.aft` });
    const parts = [
      { as: 'node', part: node }, { as: 'lab', part: lab }, ...labs.slice(1), ...stores, { as: 'dust', part: dust }, { as: 'collar', part: 'thrust-collar' },
      { as: 'bay', part: bay }, { as: 'airlock', part: 'airlock-quest' }, { as: 'pma', part: 'pma' },
      { as: 'bearing', part: BEARING_V4 }, { as: 'ring', part: ringFull },
      { as: 'boom', part: boom }, { as: 'reactor', part: reactor }, { as: 'radA', part: radA }, { as: 'radB', part: radB }
    ];
    const stage = stageFor(parts, M, 'cbm');
    parts.push({ as: 'stage', part: stage });
    mates.push(
      { a: 'node.port', b: 'bay.aft' }, { a: 'node.nadir', b: 'airlock.root' }, { a: 'node.zenith', b: 'pma.root' },
      { a: 'node.spinhub', b: 'bearing.aft' }, { a: 'bearing.hub', b: 'ring.hub' }, { a: 'bearing.dock', b: 'stage.fore' },
      { a: 'node.mount-7', b: 'boom.aft' }, { a: 'boom.fore', b: 'reactor.root' },
      { a: 'lab.mount-5', b: 'radA.root' }, { a: 'lab.mount-6', b: 'radB.root' }
    );
    return { root: 'node', parts, mates, mount: { name: 'collar', port: 'fore' }, inventory: inv, ring: ringFull };
  }

  if (id === 'colony') {
    /* the stores live under the farm and living decks, as in every torus study: the ring's deck area
       grows by the stores volume at a 2.4 m ceiling, so the only bodies on the aft spindle are the
       systems module and the braking stage */
    const probe = inventoryFor({ crew, days, closure, stop: true, power: 'reactor', years: M.years, isp: M.isp, pressurisedM3: 1e5, dryHardwareKg: 3e7, hullAreaM2: 3e4, frontalAreaM2: 100, inertiaKgM2: 1e11, beta: CRUISE_C });
    const storesM3 = (probe.items.filter((i) => i.group === 'consumables' || i.group === 'spares').reduce((s, i) => s + (i.m3 ?? i.kg / 400), 0)) / 0.8;
    const storesAreaPerCrew = storesM3 / 2.4 / crew;
    const ring0 = centrifugePart(ringFor({ crew, rpm: 4, areaPerCrew: 30 + 50 * closure.food + storesAreaPerCrew, tubeMax: 60 }), { name: `${cls.name} ring` });
    ring0.storesM3 = storesM3;
    const despin = { ...PARTS['despin-hub'], mass: Math.round(4200 * Math.sqrt(ring0.mass / 1e7)), source: `${PARTS['despin-hub'].source}; bearing mass scaled by sqrt(ring mass / 10 kt): the ring is self-supporting in hoop tension, the bearing carries thrust, imbalance and spin-up torque`, ports: [...PARTS['despin-hub'].ports, { id: 'berth-1', type: 'cbm', gender: 'active', at: [0, 6.5, 5], axis: [0, 0, 1], clock: [0, 1, 0] }, { id: 'berth-2', type: 'cbm', gender: 'active', at: [0, 6.5, -5], axis: [0, 0, -1], clock: [0, 1, 0] }] };
    const despinAft = { ...despin, name: 'Despun aft hub (stores spindle bearing)', ports: despin.ports.filter((p) => ['root', 'fore'].includes(p.id)) };
    const dry0 = ring0.mass + 2 * despin.mass;
    const inv = inventoryFor({ crew, days, closure, stop: true, power: 'reactor', years: M.years, isp: M.isp, dishM: M.dishM, laserApertureM: M.laserApertureM, pressurisedM3: ring0.volume.pressurised, dryHardwareKg: dry0, hullAreaM2: ring0.shellArea ?? 2 * Math.PI * 55.9 * Math.PI * ring0.dims.l, frontalAreaM2: Math.PI * 6 ** 2, inertiaKgM2: dry0 * 56 ** 2, beta: CRUISE_C });
    const by = (g) => inv.items.filter((i) => i.group === g);
    const stageItem = inv.items.find((i) => i.spec?.primitive === 'kick-stage');
    const magItem = inv.items.find((i) => /magsail/.test(i.item));
    const reactorItem = inv.items.find((i) => i.spec?.primitive === 'reactor');
    const radItem = inv.items.find((i) => i.spec?.primitive === 'radiator');
    const ringItems = [...by('life support'), ...by('crew fittings'), ...by('radiation'), ...by('gas storage'), ...by('water storage'), ...by('consumables'), ...by('spares')];
    const ring = { ...ring0, mass: ring0.mass + ringItems.reduce((s, i) => s + i.kg, 0), inventory: ringItems.map((i) => ({ item: i.item, kg: i.kg, m3: i.m3 ?? null, source: i.source })), power: { gen: 0, load: ring0.power.load + ringItems.reduce((s, i) => s + (i.W ?? 0), 0) } };
    const stores = [];
    const bay = systemsBay([...by('power').filter((i) => i !== reactorItem), ...by('GNC'), ...by('comms'), ...by('RCS'), ...by('MMOD').filter((i) => !/dust/.test(i.item)), ...by('thermal').filter((i) => i !== radItem)], { d: 6, kind: 'systems-module', name: 'Systems module (CMGs, PMAD, batteries, comms, RCS, bumpers)' });
    /* first body of the aft spindle: a chain module (aft active, fore passive). QA pass: it also carries
       the utilities that used to hang on the despun hub inside the ring's plane -- the two reactor booms
       at +-x and eight radiator vanes at 45 degree stations -- all of them aft of the ring tube by more
       than the audit margin, where a 60 m boom and an 88 m vane clear a 34.5 m tube. */
    const bayL = bay.dims.l, bayR = bay.dims.d / 2, nVanes = 16, stations = 2, perStation = nVanes / stations;
    const vaneW = radItem.spec.panelW * 1.05;
    /* two stations of eight one-panel vanes at 45 degree steps (none at +-x, where the booms are), the
       first aft of the ring tube and its margin, the second a panel further aft; booms between them */
    const aftOfRing = ring0.ring.D / 2 + 1.2 + 0.02 * ring0.ring.R - 9.5;
    const stationY = Array.from({ length: stations }, (_, j) => Math.max(aftOfRing, 1) + vaneW / 2 + j * (vaneW + 5.0));
    const boomY = Math.min(bayL - 4, stationY[0] + vaneW / 2 + 2.5); // the 3 m boom sits in the 5 m gap between the two vane stations
    bay.ports = [
      ...cbm(bayL, false),
      { ...hinge('mount-a', 'active', [bayR, boomY, 0], [1, 0, 0]), clock: [0, 1, 0] }, { ...hinge('mount-b', 'active', [-bayR, boomY, 0], [-1, 0, 0]), clock: [0, 1, 0] },
      ...Array.from({ length: nVanes }, (_, k) => { const a = (Math.PI / 8) + ((k % perStation) * Math.PI) / 4; return { ...hinge(`vane-${k}`, 'active', [Math.cos(a) * bayR, stationY[Math.floor(k / perStation)], Math.sin(a) * bayR], [Math.cos(a), 0, Math.sin(a)]), clock: [0, 1, 0] }; })
    ];
    /* two reactors share the load: each half the power on its own boom */
    const half = reactorSpec({ powerWe: reactorItem.spec.powerWe / 2 });
    const reactorA = reactorPart(half), reactorB = reactorPart(half);
    const boomA = boomPart(trussSpec({ lengthM: Math.max(60, half.dims.l * 2.5), widthM: 3, axialLoadN: half.mass * 0.5 })), boomB = boomPart(trussSpec({ lengthM: Math.max(60, half.dims.l * 2.5), widthM: 3, axialLoadN: half.mass * 0.5 }));
    /* sixteen one-panel vanes, each 88 m long and 23 m along the spindle, on the bay's two stations */
    const vanes = Array.from({ length: 16 }, (_, k) => ({ as: `rad${k}`, part: radiatorPart(radItem.spec, 'Radiator vane', { wings: 16, layout: 'side' }) }));
    const dust = dustShieldPart(inv.items.find((i) => /dust/.test(i.item)).spec, 12);
    const parts = [
      { as: 'ring', part: ring }, { as: 'despin', part: despin }, { as: 'despinAft', part: despinAft },
      { as: 'dust', part: dust }, { as: 'collar', part: 'thrust-collar' },
      { as: 'bay', part: bay }, { as: 'airlock', part: 'airlock-quest' }, { as: 'pma', part: 'pma' },
      { as: 'boomA', part: boomA }, { as: 'boomB', part: boomB }, { as: 'reactorA', part: reactorA }, { as: 'reactorB', part: reactorB },
      ...vanes,
      ...stores
    ];
    /* the despun hub's `fore` is a hinge; the sail collar wants a CBM, so the hub carries a collar-root adapter: the dust shield's CBM chain starts at an adapter ring */
    const adapter = { name: 'Hub-to-stack adapter ring', kind: 'adapter', dataQuality: 'derived', source: 'Derived: 10 m hub face to a 4.6 m CBM ring, 1.5 t frame', dims: { l: 1.5, d: 10 }, mass: 1500, volume: { pressurised: null, habitable: null }, crew: 0, power: { gen: 0, load: 0 }, heat: { rejectCapacity: null }, ports: [hinge('root', 'passive', [0, 0, 0], [0, -1, 0]), { id: 'fore', type: 'cbm', gender: 'passive', at: [0, 1.5, 0], axis: [0, 1, 0] }] };
    const adapterAft = { ...adapter, name: 'Aft hub-to-spindle adapter ring' };
    parts.push({ as: 'adapter', part: adapter }, { as: 'adapterAft', part: adapterAft });
    const stage = stageFor(parts, M, 'cbm', 'active');
    parts.push({ as: 'stage', part: stage });
    const mates = [
      { a: 'ring.hub', b: 'despin.root' }, { a: 'ring.hub-aft', b: 'despinAft.root' },
      { a: 'despin.fore', b: 'adapter.root' }, { a: 'adapter.fore', b: 'dust.aft' }, { a: 'dust.fore', b: 'collar.aft' },
      { a: 'despin.berth-1', b: 'pma.root' }, { a: 'despin.berth-2', b: 'airlock.root' },
      { a: 'bay.mount-a', b: 'boomA.aft' }, { a: 'boomA.fore', b: 'reactorA.root' }, { a: 'bay.mount-b', b: 'boomB.aft' }, { a: 'boomB.fore', b: 'reactorB.root' },
      ...vanes.map((v, k) => ({ a: `bay.vane-${k}`, b: `${v.as}.root` })),
      { a: 'despinAft.fore', b: 'adapterAft.root' }, { a: 'adapterAft.fore', b: 'bay.aft' }
    ];
    /* stores spindle: bay (radial-genders: aft passive, fore active) then the CBM chain of stores and the braking stage */
    const spindle = ['bay', ...stores.map((s) => s.as)];
    for (let i = 0; i < spindle.length - 1; i += 1) mates.push({ a: `${spindle[i]}.fore`, b: `${spindle[i + 1]}.aft` });
    mates.push({ a: `${spindle[spindle.length - 1]}.fore`, b: 'stage.fore' });
    return { root: 'ring', parts, mates, mount: { name: 'collar', port: 'fore' }, inventory: inv, ring };
  }
  throw new Error(`No v4 assembly for "${id}"`);
}

/**
 * The full v4 assembly: hull, mast, sail canister and film. The mast is 1.15 x the hull height as in
 * v1; the canister sits at the mast head and the film hub on the canister, so the film plane clears
 * everything by the mast and the drum. The film is sized by Lubin's law from everything it pushes.
 */
export function assemblyV4(cls, opts = {}) {
  const arealKgM2 = opts.arealKgM2 ?? SAIL_AREAL['sin-100nm'];
  const spec = hullV4(cls);
  const hullSolved = solveAssembly({ root: spec.root, parts: spec.parts, mates: spec.mates });
  const hullSum = summarize(hullSolved.nodes);
  const hullKg = hullSum.mass;
  /* sail mass = payload mass, where the payload is everything the film pushes, canister included;
     the canister is a function of the film, so iterate to the fixed point (it converges in a few steps) */
  let filmKg = hullKg, sys = null;
  const powerW = (m) => requiredPowerFor({ massKg: m, tBoost: cls.boostS, betaTarget: CRUISE_C, etaSail: 0.9 });
  for (let k = 0; k < 8; k += 1) {
    const sailPart = sail(filmKg, { arealKgM2 });
    const P = powerW(hullKg + filmKg + (sys?.mass ?? 0));
    sys = sailSystemsFor({ filmKg, areaM2: sailPart.sail.areaM2, thrustN: (2 * 0.9 * P) / 299792458, deliveredW: P, hubbed: !spec.mount });
    filmKg = hullKg + sys.mass;
  }
  const sailPart = sail(filmKg, { arealKgM2 });
  if (!spec.mount) {
    const chip = { ...spec.parts[0].part };
    chip.mass += sys.mass;
    chip.inventory = [...chip.inventory, ...sys.items.map((i) => ({ item: i.item, kg: i.kg, source: i.source }))];
    return { root: 'chip', parts: [{ as: 'chip', part: chip }, { as: 'sail', part: sailPart }], mates: [{ a: 'chip.hub', b: 'sail.hub' }], inventory: spec.inventory, sailSystems: sys, mission: cls.mission, hullKg };
  }
  const canister = canisterPart(sys);
  /* The mast stands the film clear of the structure FORWARD of its mount by 15 %, with a floor of a
     tenth of the whole hull so the hub gimbal has a lever arm: the v1 law measured the whole hull, so
     an aft stores spindle would have bought the colony a 900 m mast it does not need. The mast is a
     truss sized from the sail thrust it carries in compression (audit F8), not 0.6 kg/m of lattice. */
  const mountNode = hullSolved.nodes.find((n) => n.name === spec.mount.name);
  const mountPort = mountNode.part.ports.find((q) => q.id === spec.mount.port);
  const mountY = mountNode.world.position[1] + (mountPort?.at?.[1] ?? 0);
  const forwardH = Math.max(0, hullSum.bounds.max[1] - mountY);
  const mastLen = Math.max(0.8, 1.15 * Math.max(forwardH, 0.1 * hullSum.bounds.size[1]));
  const thrustN = (2 * 0.9 * powerW(hullKg + filmKg + sys.mass)) / 299792458;
  const mast = mastPartV4(mastLen, thrustN);
  return {
    root: spec.root,
    parts: [...spec.parts, { as: 'mast', part: mast }, { as: 'canister', part: canister }, { as: 'sail', part: sailPart }],
    mates: [...spec.mates, { a: `${spec.mount.name}.${spec.mount.port}`, b: 'mast.aft' }, { a: 'mast.fore', b: 'canister.aft' }, { a: 'canister.hub', b: 'sail.hub' }],
    inventory: spec.inventory, sailSystems: sys, mission: cls.mission, ring: spec.ring ?? null, landing: spec.landing ?? null, hullKg
  };
}

/** The roll-up the lab prints and the checks hold: consumables against crew x days, volume per person, mass closure, the stow and film limits. */
export function rollupV4(def, solved, summary) {
  const inv = def.inventory, M = def.mission, sys = def.sailSystems;
  const nodes = solved.nodes;
  const hull = nodes.filter((n) => !['sail', 'mast', 'sail-canister'].includes(n.part.kind));
  const hullKg = hull.reduce((s, n) => s + n.part.mass, 0);
  const inventoried = nodes.reduce((s, n) => s + (n.part.inventory ? n.part.inventory.reduce((a, i) => a + i.kg, 0) : 0), 0);
  const stores = nodes.filter((n) => n.part.kind === 'stores-module');
  const crewNodes = nodes.filter((n) => n.part.volume?.pressurised);
  const pressurised = crewNodes.reduce((s, n) => s + n.part.volume.pressurised, 0) - stores.reduce((s, n) => s + n.part.volume.pressurised, 0);
  const canister = nodes.find((n) => n.part.kind === 'sail-canister');
  const film = nodes.find((n) => n.part.kind === 'sail');
  const filmM3 = film ? film.part.mass / 3400 : 0;
  return {
    mission: M,
    crew: M.crew, days: M.days,
    consumablesKg: inv?.consumables?.mass ?? 0,
    consumablesPerPersonDay: inv?.consumables ? inv.consumables.mass / Math.max(inv.consumables.personDays, 1) : null,
    storesM3: stores.reduce((s, n) => s + Math.PI * (n.part.dims.d / 2) ** 2 * n.part.dims.l, 0) * 0.8 + nodes.reduce((s, n) => s + (n.part.storesM3 ?? 0), 0),
    storesNeededM3: inv?.consumables?.storesM3 ?? 0,
    pressurisedM3: pressurised, pressurisedPerPerson: M.crew > 0 ? pressurised / M.crew : null, volumeNeededM3: inv?.volumeNeededM3 ?? 0,
    hullKg, filmKg: film?.part.mass ?? 0, canisterKg: canister?.part.mass ?? 0, systemsKg: sys?.mass ?? 0, inventoriedKg: inventoried,
    powerGenW: summary.power.gen, powerLoadW: summary.power.load, hotelW: inv?.hotelW ?? null,
    deltaV: inv?.deltaV ?? null, trimPropKg: nodes.find((n) => n.part.kind === 'trim-stage')?.part.propellantKg ?? 0,
    stow: canister ? { canisterM3: Math.PI * (canister.part.dims.d / 2) ** 2 * canister.part.dims.l, filmM3, fits: Math.PI * (canister.part.dims.d / 2) ** 2 * canister.part.dims.l >= filmM3 * 1.001 } : { canisterM3: 0, filmM3, fits: true },
    film: sys ? { fluxWm2: sys.fluxWm2, tempK: sys.filmK, limitK: sys.limitK, ok: sys.filmOk } : null,
    ring: def.ring ? (def.ring.ring ?? def.ring.bola ?? null) : null
  };
}
