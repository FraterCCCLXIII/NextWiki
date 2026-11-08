/* fleet.js -- the eight Centauri classes, rebuilt as assemblies of real parts.

   The source table (SpaceRadio, centauri-fleet/fleet.mjs) gives a payload, a cruise speed, a boost
   time, a peak laser power, an energy and a cost per class. Everything here is measured from the
   parts instead: the mass is the sum of the assembly, the sail is sized from the payload at a stated
   areal density, and the laser power is what photon momentum demands for that mass and boost time.

   Two results follow from doing it that way, and the lab prints them rather than hiding them:

     * the table's peak power is several times too low for its own boost time, because a laser sail
       gets F = 2P/c, not P (the wafer needs ~18 GW, not 2.5 GW, to reach 0.1 c in ten minutes);
     * a multi-year boost cannot be focused: the sail is light-years away by the end, and the
       aperture needed grows with range. Only the short-boost classes close with a real aperture.

   Pure functions, no DOM. The page imports measure(); the node checks do the same. */

import { PARTS, PORT_TYPES, SAIL_AREAL, cargoPart, sail, mastPart, centrifugePart, drivePart, formatMass } from './parts.js';
import { ringFor } from './centrifuge.js';
import { DRIVES, DRIVE_FOR, planFor, R_CAP } from './propulsion.js';
import { solveAssembly, summarize, checkAssembly } from './assembly.js';
import {
  CRUISE_C, requiredPowerFor, kineticEnergy, travelAtBoost, orbitTrade, fmtPower, fmtEnergy, fmtLength, fmtArea
} from './beam.js';

export const ROUTE_LY = 4.37;
export const COAST_YR = ROUTE_LY / CRUISE_C;
export const GAMMA = 1 / Math.sqrt(1 - CRUISE_C * CRUISE_C);

const YEAR = 365.25 * 24 * 3600;
const DAY = 24 * 3600;
const MINUTE = 60;

/* The source table, verbatim, so the comparison cannot drift from the page it came from. */
export const CLASSES = [
  { id: 'wafer', name: 'Wafer probe', payloadKg: 0.001, payloadLabel: '1 g', energyJ: 1.51e12, peakW: 2.5e9, boostS: 10 * MINUTE, boostLabel: '10 min', costUsd: 12.6e6 },
  { id: 'smallsat', name: 'Small satellite', payloadKg: 10, payloadLabel: '10 kg', energyJ: 1.51e16, peakW: 175e9, boostS: DAY, boostLabel: '1 day', costUsd: 8.9e9 },
  { id: 'instrument', name: 'Instrument probe', payloadKg: 100, payloadLabel: '100 kg', energyJ: 1.51e17, peakW: 58e9, boostS: YEAR / 12, boostLabel: '1 month', costUsd: 31e9 },
  { id: 'lander', name: 'Robotic lander', payloadKg: 1000, payloadLabel: '1 t', energyJ: 1.51e18, peakW: 48e9, boostS: YEAR, boostLabel: '1 yr', costUsd: 69e9 },
  { id: 'capsule', name: 'Crewed capsule', payloadKg: 1e4, payloadLabel: '10 t', energyJ: 1.51e19, peakW: 240e9, boostS: 2 * YEAR, boostLabel: '2 yr', costUsd: 1.4e12 },
  { id: 'habitat', name: 'Crewed habitat', payloadKg: 1e5, payloadLabel: '100 t', energyJ: 1.51e20, peakW: 2.4e12, boostS: 2 * YEAR, boostLabel: '2 yr', costUsd: 14.1e12 },
  { id: 'seed', name: 'Colony seed', payloadKg: 1e6, payloadLabel: '1,000 t', energyJ: 1.51e21, peakW: 16e12, boostS: 3 * YEAR, boostLabel: '3 yr', costUsd: 101e12 },
  { id: 'colony', name: 'Full colony', payloadKg: 1e7, payloadLabel: '10,000 t', energyJ: 1.51e22, peakW: 94e12, boostS: 5 * YEAR, boostLabel: '5 yr', costUsd: 683e12 }
];

/* v2: the same hulls and sails with a 1 g spin ring for the living and working quarters. `base`
   names the v1 class each variant is built from, so a variant cannot drift from its hull, its sail
   or its boost table. */
export const VARIANTS = [
  { id: 'habitat-spin', base: 'habitat', crew: 24, rpm: 4 },
  { id: 'seed-spin', base: 'seed', crew: 110, rpm: 4 },
  { id: 'colony-spin', base: 'colony', crew: 1000, rpm: 4 }
].map((v) => {
  const b = CLASSES.find((c) => c.id === v.base);
  return {
    ...v,
    name: `${b.name}, 1 g ring`,
    payloadKg: b.payloadKg,
    payloadLabel: b.payloadLabel,
    energyJ: b.energyJ,
    peakW: b.peakW,
    boostS: b.boostS,
    boostLabel: b.boostLabel,
    costUsd: b.costUsd * 1.35
  };
});

/* v3: the same hulls flown by their own engines instead of a beam. The drive is the one a system
   engineer would pick for that mass (propulsion.js), and the sail and mast come off. */
export const PROPELLED = Object.entries(DRIVE_FOR).map(([baseId, driveId]) => {
  const b = CLASSES.find((c) => c.id === baseId);
  return {
    id: `${baseId}-${driveId}`,
    base: baseId,
    drive: driveId,
    name: `${b.name}, ${DRIVES[driveId].short}`,
    payloadKg: b.payloadKg,
    payloadLabel: b.payloadLabel,
    energyJ: b.energyJ,
    peakW: b.peakW,
    boostS: b.boostS,
    boostLabel: b.boostLabel,
    costUsd: b.costUsd
  };
});

export function byId(id) {
  return CLASSES.find((c) => c.id === id)
    ?? VARIANTS.find((c) => c.id === id)
    ?? PROPELLED.find((c) => c.id === id)
    ?? null;
}

/* ------------------------------------------------------------------ *
 * Assemblies
 * ------------------------------------------------------------------ */

/* The habitat and seed carry their payload as real modules plus a cargo allowance; the sail mass is
   the payload mass (Lubin's optimum), so a 100 t habitat flies a 100 t sail. */
function chain(list) {
  const mates = [];
  for (let i = 0; i < list.length - 1; i += 1) mates.push({ a: `${list[i]}.fore`, b: `${list[i + 1]}.aft` });
  return mates;
}

/* The sail is never bolted to a radiator hinge on the side of a stack: that is what put the film
   through the modules and the centre of pressure two metres off the thrust line. Every class hangs
   its film off an AXIAL mount through a deployable mast, and the colony hangs it off a non-rotating
   despin hub, because a sail must not be spun with the ring.

   The mast length is measured, not chosen: 1.15 x the hull's height along the thrust axis, so the film
   plane clears the tallest structure by 15 %. That needs the hull solved before the mast exists, so
   the hull is solved once on its own -- the same door the lab opens twice anyway. */
function hullFor(cls, p) {
  if (cls.id === 'wafer') {
    /* A 1 g chip cannot deploy a mast, and it does not need one: the film is attached at its hub and
       the chip rides at the centre of the sheet, which is how a StarChip is drawn in the first place. */
    return { root: 'chip', parts: [{ as: 'chip', part: 'chip-wafer' }], mates: [], mount: null };
  }

  if (cls.id === 'smallsat') {
    return {
      root: 'dispenser',
      parts: [{ as: 'dispenser', part: 'dispenser-6u' }, { as: 'bus', part: 'bus-6u' }],
      mates: [{ a: 'dispenser.fore', b: 'bus.aft' }],
      mount: { name: 'bus', port: 'hub' }
    };
  }

  if (cls.id === 'instrument') {
    return { root: 'bus', parts: [{ as: 'bus', part: 'bus-150' }], mates: [], mount: { name: 'bus', port: 'sailmount' } };
  }

  if (cls.id === 'lander') {
    return {
      root: 'lander',
      parts: [{ as: 'lander', part: 'lander-1000' }, { as: 'legs', part: 'legs-4' }],
      mates: [{ a: 'lander.legmount', b: 'legs.root' }],
      mount: { name: 'lander', port: 'sailmount' }
    };
  }

  if (cls.id === 'capsule') {
    /* The sail is a jettisonable stage docked to the capsule's nose on an IDSS ring, so the crew can
       still undock at arrival. The mast root is on the stage, not on the capsule. */
    return {
      root: 'service',
      parts: [
        { as: 'service', part: 'service-4m' },
        { as: 'capsule', part: 'capsule-4m' },
        { as: 'stage', part: 'sail-stage' }
      ],
      mates: [{ a: 'service.fore', b: 'capsule.aft' }, { a: 'capsule.dock', b: 'stage.dock' }],
      mount: { name: 'stage', port: 'hub' }
    };
  }

  if (cls.id === 'habitat') {
    const cargo = cargoPart(p - 2 * PARTS['lab-columbus'].mass, { portType: 'cbm', name: 'Habitat fit-out and stores' });
    return {
      root: 'node',
      parts: [
        { as: 'node', part: 'node-unity' },
        { as: 'lab1', part: 'lab-columbus' },
        { as: 'lab2', part: 'lab-columbus' },
        { as: 'cargo', part: cargo },
        { as: 'arrayA', part: 'array-saw' },
        { as: 'arrayB', part: 'array-saw' },
        { as: 'radA', part: 'radiator-pvr' },
        { as: 'radB', part: 'radiator-pvr' },
        { as: 'collar', part: 'thrust-collar' },
        { as: 'pma', part: 'pma' }
      ],
      mates: [
        ...chain(['node', 'lab1', 'lab2', 'cargo']),
        { a: 'cargo.fore', b: 'collar.aft' },
        /* The mounts come in symmetric pairs -- 1/2 at the upper station, 3/4 at the lower one -- and a
           wing or a radiator hung on the odd one out sat higher on one side than the other. Pair them
           on opposite sides of the same station instead, and dock at the aft face where nothing else
           is mounted. */
        { a: 'node.mount-1', b: 'arrayA.root' },
        { a: 'node.mount-2', b: 'arrayB.root' },
        { a: 'node.mount-5', b: 'radA.root' },
        { a: 'node.mount-6', b: 'radB.root' },
        { a: 'node.aft', b: 'pma.root' }
      ],
      mount: { name: 'collar', port: 'fore' }
    };
  }

  if (cls.id === 'seed') {
    const modules = 20;
    const nodeMass = PARTS['node-unity'].mass;
    const cargoKg = p - modules * PARTS['lab-columbus'].mass - 4 * nodeMass;
    const seq = [];
    for (let i = 0; i < 4; i += 1) {
      seq.push(`node${i}`);
      for (let k = 0; k < modules / 4; k += 1) seq.push(`lab${i * (modules / 4) + k}`);
    }
    const parts = seq.map((as) => ({ as, part: as.startsWith('node') ? 'node-unity' : 'lab-columbus' }));
    parts.push(
      { as: 'cargo', part: cargoPart(cargoKg, { portType: 'cbm', name: 'Seed cargo, workshops and stores' }) },
      { as: 'arrayA', part: 'array-saw' },
      { as: 'arrayB', part: 'array-saw' },
      { as: 'radA', part: 'radiator-pvr' },
      { as: 'radB', part: 'radiator-pvr' },
      { as: 'collar', part: 'thrust-collar' },
      { as: 'pma', part: 'pma' }
    );
    return {
      root: 'node0',
      parts,
      mates: [
        ...chain([...seq, 'cargo']),
        { a: 'cargo.fore', b: 'collar.aft' },
        { a: 'node0.mount-1', b: 'arrayA.root' },
        { a: 'node0.mount-2', b: 'arrayB.root' },
        { a: 'node0.mount-5', b: 'radA.root' },
        { a: 'node0.mount-6', b: 'radB.root' },
        { a: 'node0.aft', b: 'pma.root' }
      ],
      mount: { name: 'collar', port: 'fore' }
    };
  }

  if (cls.id === 'colony') {
    /* The ring turns for gravity, so the sail, the mast and the reactors all hang off the despun hub.
       Two 1.1 MWe reactors close the 2 MW hotel load the 62 kW of blankets were never going to carry. */
    return {
      root: 'ring',
      parts: [
        { as: 'ring', part: 'ring-1g' },
        { as: 'despin', part: 'despin-hub' },
        { as: 'reactorA', part: 'reactor-1mw' },
        { as: 'reactorB', part: 'reactor-1mw' },
        { as: 'arrayA', part: 'array-saw' },
        { as: 'arrayB', part: 'array-saw' },
        { as: 'radA', part: 'radiator-pvr' },
        { as: 'radB', part: 'radiator-pvr' }
      ],
      mates: [
        { a: 'ring.hub', b: 'despin.root' },
        { a: 'despin.mount-a', b: 'reactorA.root' },
        { a: 'despin.mount-b', b: 'reactorB.root' },
        { a: 'ring.mount-1', b: 'arrayA.root' },
        { a: 'ring.mount-2', b: 'arrayB.root' },
        { a: 'ring.mount-3', b: 'radA.root' },
        { a: 'ring.mount-4', b: 'radB.root' }
      ],
      mount: { name: 'despin', port: 'fore' }
    };
  }

  throw new Error(`No assembly for class "${cls.id}"`);
}

/* v2 colony: the arrays and radiators come off the spinning ring and go onto the despun hub, where
   they were always meant to be. Ring mounts 1-4 are remapped to the hub's four utility hardpoints. */
const COLONY_UTILITY = { 'ring.mount-1': 'despin.mount-c', 'ring.mount-2': 'despin.mount-d', 'ring.mount-3': 'despin.mount-e', 'ring.mount-4': 'despin.mount-f' };

/* A v2 hull is the v1 hull plus a ring. On the colony the ring replaces the 10 kt v1 ring it already
   carried; on the habitat and the seed it hangs off the node's aft face on a bearing, so the stack
   passes through its own ring and the sail, mast and arrays stay de-spun. The docking port moves from
   the aft face to the zenith berth to make room for the bearing. */
function variantHull(v) {
  const base = byId(v.base);
  const hull = hullFor(base, base.payloadKg);
  const ring = centrifugePart(ringFor({ crew: v.crew, rpm: v.rpm }), { name: `${v.name} ring` });
  const node = v.base === 'habitat' ? 'node' : 'node0';
  const parts = hull.parts.map((p) => (p.as === 'ring' ? { as: 'ring', part: ring } : p));
  if (v.base !== 'colony') parts.push({ as: 'bearing', part: 'spin-bearing' }, { as: 'ring', part: ring });
  const mates = hull.mates.map((m) => {
    if (v.base === 'colony') {
      const a = COLONY_UTILITY[m.a] ?? m.a;
      return { a, b: m.b };
    }
    if (m.a === `${node}.aft` && m.b === 'pma.root') return { a: 'bearing.dock', b: m.b };
    return m;
  });
  if (v.base !== 'colony') {
    mates.push({ a: `${node}.spinhub`, b: 'bearing.aft' }, { a: 'bearing.hub', b: 'ring.hub' });
  }
  return { root: hull.root, parts, mates, mount: hull.mount, payloadKg: base.payloadKg };
}

/* A driven class is the base hull with the sail and mast off and a drive module on the same axial
   mount. The drive's mass is the rocket equation's answer for that hull, so a heavy drive grows the
   ship that carries it -- which is why the hull is measured first, before the drive exists. */
/* A hull row holds a catalogue id or a generated part; the id has to be resolved before its kind or
   its ports can be read, which is the mistake that left the capsule's drive floating unattached. */
const resolved = (p) => (typeof p.part === 'string' ? PARTS[p.part] : p.part);

function propelledAssembly(cls) {
  const sailDef = assemblyFor(byId(cls.base));
  const keep = sailDef.parts.filter((p) => !['sail', 'mast'].includes(resolved(p).kind) && p.as !== 'stage');
  const keepIds = new Set(keep.map((p) => p.as));
  const mates = sailDef.mates.filter((m) => keepIds.has(m.a.split('.')[0]) && keepIds.has(m.b.split('.')[0]));
  const hullKg = summarize(solveAssembly({ root: sailDef.root, parts: keep, mates }).nodes).mass;
  const plan = planFor({ hullKg, drive: DRIVES[cls.drive], R: R_CAP });

  /* Where the mast root was is the mount the drive takes. The capsule flew its sail on a jettisonable
     stage, which is gone, so its drive docks to the capsule's own IDSS ring instead. */
  const mountMate = sailDef.mates.find((m) => m.b === 'mast.aft') ?? sailDef.mates.find((m) => m.b === 'sail.hub');
  let mount = mountMate?.a ?? 'chip.hub';
  if (!keepIds.has(mount.split('.')[0])) mount = keep.flatMap((p) => (resolved(p).ports ?? []).filter((q) => q.type === 'idss-1200').map((q) => `${p.as}.${q.id}`))[0] ?? mount;
  const [mountPart, mountPort] = mount.split('.');
  const hostEntry = keep.find((p) => p.as === mountPart);
  const hostPart = resolved(hostEntry);
  const hostPort = hostPart?.ports?.find((q) => q.id === mountPort);
  /* A drive is bolted through a thrust frame, not deployed: the host's mount is retyped to `hardpoint`
     on a copy, so the catalogue part keeps its hinge for the sail versions (which are pinned) while the
     driven assembly presents a rigid, moment-carrying interface. */
  if (hostPort) {
    const rigid = { ...hostPort, type: 'hardpoint' };
    keep[keep.indexOf(hostEntry)] = { ...hostEntry, part: { ...hostPart, ports: hostPart.ports.map((q) => (q.id === mountPort ? rigid : q)) } };
  }
  const driveP = drivePart(plan, {
    interfaceD: PORT_TYPES[hostPort?.type]?.mateD ?? Math.min(1.2, plan.dims.d),
    gender: hostPort?.gender === 'passive' ? 'active' : 'passive'
  });

  return {
    root: sailDef.root,
    parts: [...keep, { as: 'drive', part: driveP }],
    mates: [...mates, { a: mount, b: 'drive.root' }],
    hullKg,
    plan
  };
}

export function assemblyFor(cls, opts = {}) {
  const arealKgM2 = opts.arealKgM2 ?? SAIL_AREAL['sin-100nm'];
  if (cls.drive) return propelledAssembly(cls);
  const spec = cls.base ? variantHull(cls) : hullFor(cls, cls.payloadKg);
  const sailPart = sail(spec.payloadKg ?? cls.payloadKg, { arealKgM2 });

  if (!spec.mount) {
    return { root: spec.root, parts: [...spec.parts, { as: 'sail', part: sailPart }], mates: [{ a: 'chip.hub', b: 'sail.hub' }] };
  }

  const hullSolved = solveAssembly({ root: spec.root, parts: spec.parts, mates: spec.mates });
  const hullHeight = summarize(hullSolved.nodes).bounds.size[1];
  const mastLen = Math.max(0.8, 1.15 * hullHeight);
  return {
    root: spec.root,
    parts: [...spec.parts, { as: 'mast', part: mastPart(mastLen) }, { as: 'sail', part: sailPart }],
    mates: [
      ...spec.mates,
      { a: `${spec.mount.name}.${spec.mount.port}`, b: 'mast.aft' },
      { a: 'mast.fore', b: 'sail.hub' }
    ]
  };
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

/**
 * Everything the lab prints for one class. `opts` can override the sail areal density, the boost
 * time, the target speed, the sail reflectivity, the laser wavelength and the collector thermal
 * limit, so the page's sliders and the tests exercise the same path.
 */
export function measure(id, opts = {}) {
  const cls = byId(id);
  if (!cls) throw new Error(`Unknown class "${id}"`);
  const arealKgM2 = opts.arealKgM2 ?? SAIL_AREAL['sin-100nm'];
  const betaTarget = opts.betaTarget ?? CRUISE_C;
  const tBoost = opts.tBoost ?? cls.boostS;
  const etaSail = opts.etaSail ?? 0.9;
  const lambda = opts.lambda ?? 1.06e-6;
  const thermalLimitK = opts.thermalLimitK ?? 500;

  const def = assemblyFor(cls, { arealKgM2 });
  const solved = solveAssembly(def);
  const summary = summarize(solved.nodes);
  const checks = checkAssembly(def, solved, { fairing: null });
  const sailNode = solved.nodes.find((n) => n.part.kind === 'sail');
  const sailPart = sailNode?.part ?? { dims: { d: 0 }, sail: { areaM2: 0 }, mass: 0 };

  /* A driven class has no film, no mast and no beam trade: its numbers come from the rocket equation
     and the only verdict that matters is whether the drive reaches the mission speed. */
  if (cls.drive) {
    const massKg = summary.mass;
    return {
      cls, def, solved, summary,
      sail: null,
      geometry: {
        sailAt: null,
        hullTopY: summary.bounds.max[1],
        clearanceM: 0,
        offAxisM: Math.hypot(summary.cg[0], summary.cg[2]),
        cgHull: summary.cg,
        mastLenM: 0,
        hubbed: false
      },
      propulsion: def.plan,
      mission: { beta: def.plan.beta },
      massKg,
      powerW: 0,
      energyJ: 0,
      travelM: 0,
      kineticJ: kineticEnergy(massKg, def.plan.beta),
      trade: null,
      structural: checks.filter((c) => c.code !== 'port-overload'),
      loads: checks.filter((c) => c.code === 'port-overload'),
      table: { peakW: cls.peakW, energyJ: cls.energyJ, boostS: cls.boostS, costUsd: cls.costUsd },
      ratios: { power: 0, energy: 0 },
      verdict: { ok: def.plan.closes, text: def.plan.verdict }
    };
  }

  /* Sail placement, measured rather than assumed: how far the film plane stands ahead of the tallest
     structure, and how far the centre of pressure sits from the centre of mass. Both were wrong while
     every film hung off a side hinge at the hull's fore face, and both are invariants the checks hold. */
  const hullSummary = summarize(solved.nodes.filter((n) => n.part.kind !== 'sail' && n.part.kind !== 'mast'));
  const sailAt = sailNode?.world.position ?? [0, 0, 0];
  const geometry = {
    sailAt,
    hullTopY: hullSummary.bounds.max[1],
    clearanceM: sailAt[1] - hullSummary.bounds.max[1],
    offAxisM: Math.hypot(hullSummary.cg[0] - sailAt[0], hullSummary.cg[2] - sailAt[2]),
    cgHull: hullSummary.cg,
    mastLenM: solved.nodes.find((n) => n.part.kind === 'mast')?.part.dims.l ?? 0,
    hubbed: !solved.nodes.some((n) => n.part.kind === 'mast')
  };

  const massKg = summary.mass;
  const powerW = requiredPowerFor({ massKg, tBoost, betaTarget, etaSail });
  const energyJ = powerW * tBoost;
  const travelM = travelAtBoost(tBoost, betaTarget);
  const trade = orbitTrade({ deliveredW: powerW, sailD: sailPart.dims.d, tBoost, lambda, betaTarget, etaSail, thermalLimitK });

  const structural = checks.filter((c) => c.code !== 'port-overload');
  const loads = checks.filter((c) => c.code === 'port-overload');

  return {
    cls, def, solved, summary, sail: sailPart, geometry,
    mission: { betaTarget, tBoost, etaSail, lambda, thermalLimitK, arealKgM2 },
    massKg, powerW, energyJ, travelM, kineticJ: kineticEnergy(massKg, betaTarget),
    trade, structural, loads,
    table: { peakW: cls.peakW, energyJ: cls.energyJ, boostS: cls.boostS, costUsd: cls.costUsd },
    ratios: { power: powerW / cls.peakW, energy: energyJ / cls.energyJ },
    verdict: verdictFor({ massKg, powerW, energyJ, trade, sail: sailPart, structural })
  };
}

function verdictFor({ massKg, powerW, energyJ, trade, sail, structural }) {
  if (structural.length) return { ok: false, text: `The assembly does not close: ${structural[0].message}` };
  const best = trade.best;
  if (!trade.hasFeasible) return { ok: false, text: 'No orbit in the trade closes: the beam cannot be focused on this sail at the end of this boost.' };
  const notes = [];
  if (sail.dims.d > 1e4) notes.push(`the sail is ${fmtLength(sail.dims.d)} across`);
  return {
    ok: true,
    text: `Closes with a ${fmtPower(best.pLaser)} driver on ${best.orbit.name.toLowerCase()}, ${fmtArea(best.collectorAreaM2)} of collector, a ${fmtLength(best.apertureM)} aperture and ${formatMass(best.totalMass)} of station${notes.length ? `; ${notes.join(', ')}` : ''}.`
  };
}

/* ------------------------------------------------------------------ *
 * Fleet summary
 * ------------------------------------------------------------------ */

export function measureFleet(opts = {}) {
  const rows = CLASSES.map((cls) => {
    try { return measure(cls.id, opts); }
    catch (error) { return { cls, error }; }
  });
  const closing = rows.filter((r) => !r.error && r.trade?.hasFeasible);
  return {
    rows,
    closing: closing.length,
    best: rows.find((r) => r.cls.id === 'wafer') ?? null
  };
}

export { fmtPower, fmtEnergy, fmtLength, fmtArea, formatMass };
