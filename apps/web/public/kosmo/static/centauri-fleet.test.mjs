// centauri-fleet.test.mjs -- node checks for the Centauri fleet lab: the part catalogue and mate
// solver, the eight assemblies, the laser-sail closed form, the beam coupling and the orbit trade.
// Run by run-tests.mjs, or: node public/kosmo/static/centauri-fleet.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PARTS, PORT_TYPES, SAIL_AREAL, sailDiameter, sail, spinRadius } from './parts/parts.js';
import { solveAssembly, summarize, checkAssembly } from './parts/assembly.js';
import { CLASSES, VARIANTS, PROPELLED, REALISM, assemblyFor, measure, measureFleet, byId } from './parts/fleet.js';
import { MISSIONS, hullV4 } from './parts/fleet-v4.js';
import { consumablesFor, CLOSURE, deltaVBudget, VOLUME_PER_PERSON_M3 } from './parts/inventory.js';
import { G0 as G0_PRIM } from './parts/primitives/spec.js';
import {
  DRIVES, DRIVE_FOR, planFor, massRatioFor, betaForMassRatio, R_CAP,
  frameMassFor, storeFor, radiatorFor, STORE_ULLAGE, RADIATOR_FLUX
} from './parts/propulsion.js';
import {
  ringFor, ringTrade, deckLayout, radiusFor, rpmFor, decksFor, omega,
  AREA_PER_CREW_M2, COMFORT_RPM, ZONE_SHARE
} from './parts/centrifuge.js';
import { FLEET_VERSIONS, V1_IDS, V2_IDS, V3_IDS, V4_IDS } from './parts/fleet-versions.js';
import {
  FLASHER, SECTOR, LAMBDA_FOLD, LAMBDA_TWIST, SHOULDER, flasherRadius, deploy, faces, creases,
  maekawa, kawasakiResidual, solveShoulder, twistAt, buckleAt, stowedSpan, stowedEnvelope,
  foldRatio, lambdaFor, sailSquareSide, sailFoldedFootprint, accordionAngles, accordionFootprint
} from './parts/origami.js';
import {
  C, forceN, betaAtTime, distanceAtTime, requiredPowerFor, travelAtBoost,
  spotRadiusM, couplingFor, apertureForCoupling, equilibriumK, solarFlux,
  stationFor, stationMass, EARTH_ORBITS, heliocentricOrbits, DEFAULT_LAMBDA
} from './parts/beam.js';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks += 1; };
const near = (a, b, tol, message) => {
  assert.ok(Math.abs(a - b) <= Math.abs(b) * tol, `${message}: got ${a}, expected ${b} (${(tol * 100).toFixed(1)} %)`);
  checks += 1;
};

/* ---------- the sail, and the two laws that size it ---------- */

near(sailDiameter(0.001), 1.935, 0.01, 'a 1 g sail at 100 nm SiN is 1.94 m across');
near(sailDiameter(1e7) / sailDiameter(0.001), 1e5, 0.01, 'sail diameter spans 1e5 across the eight classes');
near(sailDiameter(1, SAIL_AREAL['al-1um']), 2 * Math.sqrt(1 / (Math.PI * 0.00233)), 1e-9, 'areal density sets the diameter');
ok(Math.abs(sail(0.001).sail.areaM2 - Math.PI * (sailDiameter(0.001) / 2) ** 2) < 1e-9, 'the sail part reports its true area');
ok(sail(10).mass === 10, 'the sail mass equals the payload mass (Lubin optimum)');
near(spinRadius(9.80665, 4), 55.9, 0.01, '1 g at 4 rpm is 55.9 m');
ok(sail(1e7).dims.d > 190e3 && sail(1e7).dims.d < 200e3, 'the colony sail is about 194 km');

/* ---------- photon momentum: the closed form ---------- */

const P = 2e10, m = 0.002, eta = 0.9;
near(forceN(P, eta, 0), (2 * eta * P) / C, 1e-12, 'at rest the sail thrust is 2 P eta / c');
near(forceN(P, eta, 0.1) / forceN(P, eta, 0), 1 / 1.1, 1e-12, 'at 0.1 c the thrust is 1/(1+beta) of the rest value');
near(forceN(P, eta, 0.999999) * C / (eta * P), 1, 1e-3, 'as beta -> 1 the thrust tends to P eta / c');

const tSmall = 1e-6;
const k = (2 * eta * P) / (m * C * C);
near(betaAtTime(P, m, eta, tSmall), k * tSmall, 1e-3, 'at small t the closed form is beta = 2 eta P t / (m c squared)');
near(distanceAtTime(P, m, eta, tSmall), 0.5 * (k * C) * tSmall ** 2, 1e-2, 'at small t the distance is half a t squared');

const tBoostWafer = 600;
const pWafer = requiredPowerFor({ massKg: m, tBoost: tBoostWafer, betaTarget: 0.1, etaSail: eta });
near(betaAtTime(pWafer, m, eta, tBoostWafer), 0.1, 1e-9, 'the required power reaches 0.1 c in the boost time');
near(pWafer, 17.6e9, 0.02, 'the 2 g wafer needs 17.6 GW to reach 0.1 c in 600 s (the table says 2.5 GW)');
ok(pWafer < 2e10 && pWafer > 1e10, 'that is the same order as Lubin\u2019s 20 GW array, not the table\u2019s 2.5 GW');
near(travelAtBoost(tBoostWafer, 0.1), 9.04e9, 0.02, 'the 600 s boost covers 9.0e9 m (0.06 AU)');
ok(travelAtBoost(2 * 365.25 * 86400, 0.1) > 9e14, 'a two-year boost puts the sail most of a light-year away');

/* ---------- the beam ---------- */

near(spotRadiusM(1e4, DEFAULT_LAMBDA, 1e9), (1.22 * 1.06e-6 * 1e9) / 1e4, 1e-12, 'Airy radius is 1.22 lambda L / D');
ok(couplingFor({ apertureM: 1e5, lambda: DEFAULT_LAMBDA, rangeM: 1e6, sailD: 100 }) === 1, 'a spot inside the sail couples fully');
const cD = couplingFor({ apertureM: 100, lambda: DEFAULT_LAMBDA, rangeM: 1e9, sailD: 10 });
const c2D = couplingFor({ apertureM: 200, lambda: DEFAULT_LAMBDA, rangeM: 1e9, sailD: 10 });
near(c2D / cD, 4, 1e-9, 'coupling in the halo goes as the square of the aperture');
near(couplingFor({ apertureM: apertureForCoupling({ rangeM: 1e9, sailD: 10, coupling: 0.9 }), rangeM: 1e9, sailD: 10 }), 0.9, 1e-9, 'the aperture solves back to the wanted coupling');
near(equilibriumK(1), 278.5, 1e-9, 'a flat plate at 1 AU sits at 278.5 K');
near(equilibriumK(0.25), 2 * 278.5, 1e-9, 'a quarter AU is twice as hot');
near(solarFlux(0.5) / solarFlux(1), 4, 1e-12, 'flux goes as 1/r squared');

/* ---------- the station and the orbit trade ---------- */

const orbit1 = EARTH_ORBITS.find((o) => o.id === 'sso');
const orbitHalf = { id: 'test-0.32', name: 'test 0.32 AU', rAu: 0.32, standoffM: 1.5e6, continuous: true };
const common = { deliveredW: 1.8e10, sailD: 1.935, tBoost: 600, lambda: DEFAULT_LAMBDA, etaSail: 0.9, apertureM: 1.2e4 };
const s1 = stationFor({ ...common, orbit: orbit1 });
const s32 = stationFor({ ...common, orbit: orbitHalf });
near(s1.collectorAreaM2, s1.pSolar / solarFlux(1), 1e-9, 'collector area is solar power over flux');
near(s1.collectorAreaM2 / s32.collectorAreaM2, solarFlux(0.32) / solarFlux(1), 1e-9, 'closer to the Sun, less collector');
near(s32.radiatorAreaM2 / s1.radiatorAreaM2, 1, 1e-9, 'the radiator is set by laser power, not by orbit');
ok(s1.totalMass > 0 && s32.totalMass < s1.totalMass, 'the inner orbit is the lighter station');
near(s1.collectorKg, s1.collectorAreaM2 * 1.0, 1e-12, 'collector mass is area times areal mass');

const trade = measure('wafer').trade;
ok(trade.rows.length > 5, 'the trade has rows');
ok(trade.hasFeasible, 'the wafer class closes somewhere');
ok(trade.best.feasible, 'the best row is feasible');
ok(trade.best.apertureM <= 1e5, 'the best aperture is inside the cap');
ok(trade.best.orbit.thermalK <= 500, 'the best collector is inside the thermal limit');
ok(trade.best.orbit.rAu > 0.3 && trade.best.orbit.rAu <= 1, 'the best orbit is a heliocentric one inside the trade');
ok(trade.rows.every((r) => r.totalMass > 0), 'every row has a mass');
ok(heliocentricOrbits(500).every((o) => o.thermalK <= 500), 'the heliocentric grid respects the thermal limit');

/* ---------- the eight assemblies ---------- */

for (const cls of CLASSES) {
  const def = assemblyFor(cls);
  const solved = solveAssembly(def);
  const summary = summarize(solved.nodes);
  const checks8 = checkAssembly(def, solved, { fairing: null });
  const structural = checks8.filter((c) => c.code !== 'port-overload');
  const sailNode = solved.nodes.find((n) => n.part.kind === 'sail');
  ok(structural.length === 0, `${cls.id}: the assembly solves without a structural fault (${structural.map((c) => c.code).join(', ')})`);
  ok(summary.partCount === def.parts.length, `${cls.id}: every part is placed`);
  ok(solved.mates.length === def.parts.length - 1, `${cls.id}: the mate graph is a tree`);
  ok(summary.mass >= cls.payloadKg, `${cls.id}: the vehicle is at least its payload`);
  ok(!!sailNode, `${cls.id}: it carries a sail`);
  near(sailNode.part.dims.d, sailDiameter(cls.payloadKg), 1e-6, `${cls.id}: the sail is sized from the payload`);
  ok(summary.mass > 0 && Number.isFinite(summary.mass), `${cls.id}: mass is finite`);
}

ok(PARTS['bus-6u'].mass === 12 && PARTS['array-saw'].power.gen === 31000, 'the catalogue keeps the real figures');
ok(Object.values(PARTS).every((p) => typeof p.source === 'string' && p.source.length > 8), 'every part carries a source');
ok(Object.values(PORT_TYPES).every((t) => typeof t.source !== 'undefined'), 'every port type carries a source or an explicit null');
ok(PARTS['chip-wafer'].mass === 0.001 && PARTS['lab-columbus'].mass === 10275, 'the wafer and the module rows are unchanged');

const measures = Object.fromEntries(CLASSES.map((c) => [c.id, measure(c.id)]));
ok(measures.wafer.ratios.power > 5, 'the table\u2019s wafer laser is at least 5x too low for its own boost');
ok(measures.lander.ratios.power > 4, 'the lander\u2019s table laser is several times too low as well');
ok(measures.lander.ratios.energy > 4, 'so is its energy');
ok(measures.colony.sail.dims.d > 1.9e5, 'the colony sail is about 194 km');
ok(measures.wafer.structural.length === 0, 'the wafer has no structural fault');
ok(measures.smallsat.loads.length > 0, 'the 6U dispenser is flagged for carrying more than its rating');
ok(measures.capsule.loads.length > 0, 'the 1,194 mm interface is flagged for the capsule and its sail');
ok(measures.colony.loads.length === 0, 'the ring has no interface overload');
ok(measures.lander.powerW > measures.lander.table.peakW, 'the lander needs more power than the table gives it');
ok(measures.wafer.trade.best.totalMass > 1e7, 'the wafer station is a megatonne-class structure, not a satellite');

/* ---------- sail placement ---------- */
// The film has to stand ahead of every structure on the thrust line. Before the mast existed the
// habitat's and the seed's films were mounted on a radiator hinge at the side of a stack, so the
// plane cut through the modules and the centre of pressure sat ~2 m off the CG; the colony's film
// bisected its rotating ring. These are the invariants that keep that from coming back.
for (const cls of CLASSES) {
  const m = measures[cls.id], g = m.geometry;
  ok(Number.isFinite(g.clearanceM) && Number.isFinite(g.offAxisM), `${cls.id}: the sail's placement is measured`);
  ok(g.offAxisM < 0.5, `${cls.id}: the centre of pressure is on the thrust line (${g.offAxisM.toFixed(3)} m off)`);
  if (cls.id === 'wafer') {
    ok(g.hubbed && m.def.parts.length === 2, 'the wafer rides on its own film hub: a 1 g probe cannot deploy a mast');
    continue;
  }
  ok(g.mastLenM > 0, `${cls.id}: the sail stands on a mast`);
  ok(g.clearanceM > 0, `${cls.id}: the film plane is ahead of every structure (${g.clearanceM.toFixed(2)} m)`);
  const spanY = (n) => { const b = summarize([n]).bounds; return [b.min[1], b.max[1]]; };
  const cut = m.solved.nodes
    .filter((n) => n.part.kind !== 'sail' && n.part.kind !== 'mast')
    .filter((n) => { const [lo, hi] = spanY(n); return g.sailAt[1] > lo + 1e-9 && g.sailAt[1] < hi - 1e-9; })
    .map((n) => n.name);
  ok(cut.length === 0, `${cls.id}: no structure crosses the film plane (${cut.join(', ')})`);
}
ok(measures.colony.solved.nodes.some((n) => n.part.kind === 'despin-hub'), 'the colony hangs its sail off a non-rotating hub');
ok(measures.colony.summary.power.gen > measures.colony.summary.power.load, 'the colony now generates its 2 MW hotel load');
ok(measures.capsule.solved.nodes.some((n) => n.part.kind === 'dock-adapter'), 'the capsule flies its sail as a jettisonable docked stage');
ok(measures.habitat.solved.nodes.some((n) => n.name === 'pma') && measures.seed.solved.nodes.some((n) => n.name === 'pma'), 'the stacked classes keep a docking port');

const fleet = measureFleet();
ok(fleet.rows.length === 8 && fleet.rows.every((r) => !r.error), 'all eight classes measure');
ok(fleet.rows.filter((r) => r.trade?.hasFeasible).length >= 1, 'at least one class closes');
ok(fleet.rows.some((r) => r.trade && !r.trade.hasFeasible), 'and the lab says which ones do not');
ok(fleet.rows.every((r) => r.verdict && typeof r.verdict.ok === 'boolean'), 'every class gets a verdict');
ok(byId('wafer').name === 'Wafer probe' && byId('nope') === null, 'the class lookup is exact');

/* ---------- the same eight, as spacecraft-catalogue entries ---------- */
// The catalogue shows these in spacecraft.html with a model built from the solved assembly, so the
// headline figures must be the measured ones: if the lab's physics changes, this fails rather than
// letting the catalogue drift.
const ships = JSON.parse(readFileSync(new URL('../data/vehicles/ships.json', import.meta.url), 'utf8'));
ok(ships.length === CLASSES.length + VARIANTS.length + PROPELLED.length + REALISM.length, 'ships.json holds the eight classes, the three v2 ring variants, the eight v3 driven ships and the eight v4 realism-pass ships');
for (const cls of CLASSES) {
  const v = ships.find((s) => s.id === `centauri-${cls.id}`);
  ok(!!v, `ships.json carries ${cls.id}`);
  if (!v) continue;
  ok(v.category === 'original' && v.status === 'concept' && v.built === false, `${cls.id}: an unbuilt concept of our own`);
  near(v.diameter_m, measures[cls.id].sail.dims.d, 1e-6, `${cls.id}: the catalogue sail diameter is the measured sail`);
  near(v.mass_kg, measures[cls.id].massKg, 1e-9, `${cls.id}: the catalogue mass is the measured vehicle mass`);
  ok(typeof v.source === 'string' && v.source.startsWith('http') && v.notes.length > 40, `${cls.id}: it carries a source and a note`);
  ok(v.model3d?.status === 'done', `${cls.id}: the catalogue model is marked built`);
}

/* ---------- v2: the crewed classes with a spin ring ---------- */
// The ring is sized from the crew, not drawn by eye. 1 g at 4 rpm fixes the deck radius at 55.9 m;
// the tube then grows until the decks inside it hold 30 m2 per person. The v1 hull, mast and sail are
// reused unchanged, so a variant cannot grow a different stack from its base class.
const allMeasures = Object.fromEntries([...CLASSES, ...VARIANTS].map((c) => [c.id, measure(c.id)]));
near(radiusFor(9.80665, 4), 55.9, 0.01, 'the ring radius is 1 g at 4 rpm: 55.9 m');
near(radiusFor(9.80665, 6), 24.84, 0.01, 'at 6 rpm the same gravity needs 24.8 m');
near(rpmFor(9.80665, 55.9), 4, 0.01, 'the radius solves back to 4 rpm');
near(Object.values(ZONE_SHARE).reduce((a, b) => a + b, 0), 1, 1e-12, 'the deck zones add up to the whole floor');
const trade1k = ringTrade({ crew: 1000 });
ok(trade1k.length === 4 && trade1k.every((r) => Math.abs(omega(r.rpm) ** 2 * r.radiusM - 9.80665) < 1e-9), 'every spin rate in the trade gives the same 1 g');
ok(trade1k[0].massKg > trade1k[3].massKg, 'spinning a bigger ring slower costs more structure');

for (const v of VARIANTS) {
  const ring = ringFor({ crew: v.crew, rpm: v.rpm });
  const lay = deckLayout(ring);
  ok(v.crew > 0 && v.rpm <= COMFORT_RPM.continuous, `${v.id}: a crewed ring at the comfort spin rate`);
  ok(ring.area >= v.crew * AREA_PER_CREW_M2, `${v.id}: ${Math.round(ring.areaPerCrew)} m2 of deck per person`);
  ok(ring.decks === decksFor(ring.D), `${v.id}: ${ring.decks} decks fill a ${ring.D.toFixed(1)} m tube`);
  ok(ring.rimSpeed > 10 && ring.rimSpeed < 30, `${v.id}: the rim runs at ${ring.rimSpeed.toFixed(1)} m/s`);
  const mid = lay.decks[Math.floor(lay.decks.length / 2)];
  near(mid.g, 9.80665, 0.2, `${v.id}: the middle deck sits at 1 g`);
  ok(lay.decks.every((d) => Math.abs(d.g / 9.80665 - 1) < 0.3), `${v.id}: every deck is between 0.7 and 1.3 g`);
  ok(lay.livingDecks >= 1 && lay.livingDecks + lay.workDecks === ring.decks, `${v.id}: living and working decks split the ring`);

  const m = allMeasures[v.id], b = allMeasures[v.base];
  ok(m.def.parts.some((p) => p.part.kind === 'centrifuge'), `${v.id}: the assembly carries a spin ring`);
  const hubKind = v.base === 'colony' ? 'despin-hub' : 'spin-bearing';
  ok(m.solved.nodes.some((n) => n.part.kind === hubKind), `${v.id}: the ring turns on a ${hubKind}, so the sail does not`);
  ok(m.structural.length === 0, `${v.id}: the assembly closes with no structural fault`);
  near(m.sail.dims.d, b.sail.dims.d, 1e-12, `${v.id}: the sail is the base class's sail`);
  near(m.geometry.mastLenM, b.geometry.mastLenM, 0.05, `${v.id}: the mast is cut from the same hull height (${m.geometry.mastLenM.toFixed(2)} m against ${b.geometry.mastLenM.toFixed(2)} m)`);
  ok(m.massKg !== b.massKg && m.def.parts.some((p) => p.part.kind === 'centrifuge' && p.part.mass > 0), `${v.id}: the ring is in the mass budget (${Math.round(m.massKg / 1000)} t against ${Math.round(b.massKg / 1000)} t)`);
  if (v.base !== 'colony') ok(m.massKg > b.massKg, `${v.id}: a ring added to the stack adds its mass`);
  ok(m.geometry.offAxisM < 0.05, `${v.id}: the ring keeps the CG on the thrust line (${(m.geometry.offAxisM * 1000).toFixed(1)} mm)`);
  ok(m.verdict && typeof m.verdict.ok === 'boolean', `${v.id}: the variant gets a verdict`);
}
ok(allMeasures['colony-spin'].def.mates.every((mt) => !/^ring\.mount-/.test(mt.a)), 'v2 colony hangs its arrays and radiators on the despun hub, not on the spinning ring');
ok(allMeasures.colony.def.mates.some((mt) => /^ring\.mount-/.test(mt.a)), 'v1 colony still hangs them on the ring -- that is the difference the version records');
ok(allMeasures['habitat-spin'].solved.nodes.some((n) => n.name === 'pma'), 'the spin habitat keeps a docking port');
const spinPma = allMeasures['habitat-spin'].solved.nodes.find((n) => n.name === 'pma').world.position;
ok(Math.hypot(spinPma[0], spinPma[2]) < 0.05, 'its berth moves onto the spin axis, on the despun side of the bearing, so the ring stays balanced');

/* ---------- saved versions ---------- */
// v1 is frozen. If a part's mass or a mate moves, these fail rather than letting a published ship be
// re-written by accident; a deliberate change re-cuts the version (see CENTAURI-VERSIONS.md).
ok(V1_IDS.length === CLASSES.length && V2_IDS.length === VARIANTS.length, 'both versions pin every class they claim');
for (const id of V1_IDS) {
  const p = FLEET_VERSIONS.v1.classes[id], m = allMeasures[id];
  near(m.massKg, p.massKg, 1e-9, `v1 ${id}: mass is pinned`);
  near(m.sail.dims.d, p.sailD, 1e-9, `v1 ${id}: sail is pinned`);
  near(m.geometry.clearanceM, p.clearanceM, 1e-6, `v1 ${id}: sail clearance is pinned`);
  near(m.geometry.mastLenM, p.mastLenM, 1e-9, `v1 ${id}: mast length is pinned`);
  ok(p.cgHull.every((c, i) => Math.abs(c - m.geometry.cgHull[i]) < 1e-9), `v1 ${id}: the CG is pinned`);
}
for (const id of V2_IDS) {
  const p = FLEET_VERSIONS.v2.variants[id], m = allMeasures[id];
  ok(FLEET_VERSIONS.v2.variants[id].base === byId(id).base, `${id}: the version records its base class`);
  near(m.massKg, p.massKg, 1e-9, `v2 ${id}: mass is pinned`);
  near(m.sail.dims.d, p.sailD, 1e-9, `v2 ${id}: sail is pinned`);
  near(ringFor({ crew: p.crew, rpm: p.rpm }).mass, p.ring.massKg, 1e-9, `${id}: the ring mass is pinned`);
}

for (const v of VARIANTS) {
  const s = ships.find((x) => x.id === `centauri-${v.id}`);
  ok(!!s, `ships.json carries ${v.id}`);
  if (!s) continue;
  ok(s.crew_capacity === v.crew, `${v.id}: the catalogue carries the ring's crew`);
  near(s.diameter_m, allMeasures[v.id].sail.dims.d, 1e-9, `${v.id}: the catalogue sail diameter is the measured sail`);
  near(s.mass_kg, allMeasures[v.id].massKg, 1e-9, `${v.id}: the catalogue mass is the measured variant mass`);
  ok(s.category === 'original' && s.status === 'concept' && s.model3d?.status === 'done', `${v.id}: an unbuilt concept with a built catalogue model`);
  ok(/1 g ring/.test(s.name) && s.notes.includes('CENTAURI-VERSIONS.md'), `${v.id}: the entry says it is a v2 ring build`);
}

/* ---------- v3: the same eight flown by onboard drives ---------- */
// The sail is replaced by the drive a systems engineer would pick for that mass, sized by the
// relativistic rocket equation from real drive data. Two laws hold for every entry: the mass ratio
// and the cruise speed invert, and below 0.2 c the relativistic form collapses onto Tsiolkovsky's.
for (const d of Object.values(DRIVES)) {
  /* Round-trip at a ratio every drive can actually carry: at 0.1 c the low-exhaust drives overflow a
     double, which is itself the point -- 0.1 c is not a number you can stage to with 900 s. */
  near(massRatioFor(d.ve, betaForMassRatio(d.ve, 1e6)), 1e6, 1e-6, `${d.id}: mass ratio and cruise speed invert`);
  const R = massRatioFor(d.ve, 0.1);
  ok(betaForMassRatio(d.ve, 1e6) > 0 && betaForMassRatio(d.ve, 1e6) < 1, `${d.id}: a million-to-one ship has a cruise speed between 0 and c`);
  if (Number.isFinite(R)) {
    /* Tsiolkovsky's form is the low-speed limit: the relativistic ratio is larger by exp(b^3 c / 3 ve),
       which is 1 % at 1 % c even for a 98 km/s drive and 180 % at 10 % c. Check the limit where it
       holds, and check the sign of the correction where it does not. */
    near(massRatioFor(d.ve, 0.01), Math.exp((0.01 * C) / d.ve), 0.03, `${d.id}: at 1 % c the rocket equation is Tsiolkovsky's`);
    ok(R > massRatioFor(d.ve, 0.05) && R > 1, `${d.id}: a faster cruise costs a larger mass ratio`);
    ok(R >= Math.exp((0.1 * C) / d.ve), `${d.id}: the relativistic mass ratio is never below the classical one`);
  } else {
    ok(d.ve < 0.01 * C, `${d.id}: 0.1 c overflows the mass ratio, so the drive cannot reach it at any staging`);
  }
}
ok(massRatioFor(DRIVES.daedalus.ve, 0.1) < 30, 'inertial fusion needs under 30:1 for 0.1 c -- the only studied drive that does');
ok(massRatioFor(DRIVES.ntr.ve, 0.1) > 1e15, 'and nuclear thermal needs astronomically more, so it is not an interstellar drive');
ok(DRIVE_FOR.wafer === 'pellet' && DRIVE_FOR.smallsat === 'pellet', 'the two lightest classes are beamed: an engine does not scale down to a gram');
ok(['dfd', 'daedalus', 'pulse'].includes(DRIVE_FOR.habitat) && ['daedalus', 'pulse'].includes(DRIVE_FOR.colony), 'the heavy classes carry fusion-class drives: a beam does not scale up to 10 kt');
ok(PROPELLED.length === CLASSES.length && new Set(PROPELLED.map((c) => c.base)).size === CLASSES.length, 'every class gets exactly one driven version');
ok(Object.keys(DRIVE_FOR).every((k) => CLASSES.some((c) => c.id === k)) && PROPELLED.every((c) => !!DRIVES[c.drive]), 'the drive table names only real classes and real drives');

const driven = Object.fromEntries(PROPELLED.map((c) => [c.id, measure(c.id)]));
for (const c of PROPELLED) {
  const m = driven[c.id], p = m.propulsion, d = DRIVES[c.drive];
  ok(m.sail === null && m.geometry.sailAt === null, `${c.id}: no sail and no mast -- that is the whole point of the version`);
  ok(!m.solved.nodes.some((n) => ['sail', 'mast'].includes(n.part.kind)), `${c.id}: neither the film nor its mast is in the assembly`);
  ok(m.solved.nodes.some((n) => n.part.kind === 'drive'), `${c.id}: a drive module is on the hull`);
  ok(m.structural.length === 0, `${c.id}: the driven assembly closes with no structural fault (${m.structural[0]?.message ?? 'ok'})`);
  ok(p.drive.id === c.drive && p.hullKg > 0, `${c.id}: the plan is the class's own drive`);
  if (d.kind === 'beamed') {
    near(m.massKg, p.hullKg + d.engineKg, 1e-9, `${c.id}: the beamed coil carries no propellant, so the ship is the hull plus the coil`);
    ok(p.propKg === 0 && p.streamKg > 0 && p.stationJ > 0, `${c.id}: the propellant is a pellet stream from the accelerator, not a tank`);
  } else {
    near(m.massKg, p.wetKg, 1e-9, `${c.id}: the assembly mass is the rocket equation's wet mass`);
    near(p.dryKg + p.propKg, p.wetKg, 1e-12, `${c.id}: dry plus propellant is the wet mass`);
    near(p.dryKg, (p.hullKg + d.engineKg + p.frame.kg) / (1 - d.tankFraction * (p.massRatio - 1)), 1e-9, `${c.id}: dry mass includes the engine, the thrust frame and the tanks the propellant needs`);
    ok(m.def.parts.find((q) => q.as === 'drive').part.mass > 0, `${c.id}: the propellant is in the drive module's mass`);
  }
  ok(p.beta > 0 && p.beta < 1, `${c.id}: a cruise speed comes out of the mass ratio`);
  ok(p.closes === (Number.isFinite(p.tripYears) && p.tripYears <= 100), `${c.id}: the verdict is a century to 4.37 ly, not a slogan`);
  ok(m.verdict.ok === p.closes && m.verdict.text.length > 40, `${c.id}: the lab reports the drive's own verdict`);
  ok(m.geometry.offAxisM < 0.05, `${c.id}: the drive sits on the thrust line (${(m.geometry.offAxisM * 1000).toFixed(1)} mm)`);
  const mate = m.def.mates.find((mt) => mt.b === 'drive.root');
  ok(!!mate && m.solved.nodes.length >= 2, `${c.id}: the module is mated to the hull at ${mate?.a}`);
}
/* ---------- v3 construction: the propellant, the frame, the plate, the heat ---------- */
// A drive is bolted through a thrust frame, carries its propellant at a real bulk density, and its
// radiators are sized from the heat it rejects. Before this re-cut the module hung on the sail mast's
// deployable hinge, drew a store 3.6x the propellant's volume, and read kilograms as watts, and the
// CAD hung two 25 m slabs on the flanks as "radiators".
ok(PORT_TYPES.hardpoint && PORT_TYPES.hardpoint.dof === 0, 'a hardpoint is a rigid interface with no deployed or stowed pose');
ok(/thrust/.test(PORT_TYPES.hardpoint.source), 'the hardpoint is rated the way its load is applied: thrust, not carried mass');
for (const c of PROPELLED) {
  const m = driven[c.id], p = m.propulsion, d = DRIVES[c.drive];
  const mate = m.solved.mates.find((mt) => mt.b.name === 'drive');
  ok(!!mate && mate.a.type === 'hardpoint' && mate.b.type === 'hardpoint', `${c.id}: the module is bolted to a hardpoint, not deployed on a hinge`);
  const drive0 = m.def.parts.find((q) => q.as === 'drive').part;
  ok(drive0.ports[0].type === 'hardpoint', `${c.id}: the drive's own root is a hardpoint`);
  if (d.kind === 'beamed') {
    const kTrend = (p.beta * C) / (2 * d.ve);
    near(p.streamKg, (p.hullKg * kTrend) / (1 - kTrend), 1e-9, `${c.id}: the pellet stream is sized from the mass that has to reach cruise, hull plus stream`);
    ok(p.frame.kg === 0 && p.store.kind === 'coil' && p.radiator.areaM2 === 0, `${c.id}: a coil has no tank, no thrust frame and nothing to radiate`);
    continue;
  }
  near(p.frame.kg, Math.max(50, d.thrustN / 500), 1e-9, `${c.id}: the thrust frame is sized by the thrust it carries (${Math.round(p.frame.kg)} kg)`);
  ok(p.frame.l > 0 && p.frame.l <= 12, `${c.id}: the frame is drawn between the hardpoint and the store`);
  near(p.store.volumeM3, p.propKg / d.bulk, 1e-9, `${c.id}: the store is sized from the propellant's bulk density`);
  near((Math.PI / 4) * p.store.d ** 2 * p.store.l, STORE_ULLAGE * p.store.volumeM3, 1e-9, `${c.id}: the drawing holds the propellant plus 8 % ullage, not 3.6x it`);
  ok(p.store.kind === d.store, `${c.id}: the ${d.kind} drive is drawn as the ${d.store} its propellant needs`);
  if (p.store.unitKg) near(p.store.unitCount, p.propKg / p.store.unitKg, 1e-12, `${c.id}: ${Math.round(p.store.unitCount)} pulse units of ${p.store.unitKg} kg`);
  near(p.radiator.heatW, ((d.thrustN * d.ve) / 2) * d.rejectFraction, 1e-9, `${c.id}: rejected heat is a stated share of jet power, not wet kilograms read as watts`);
  near(p.radiator.areaM2, p.radiator.heatW / RADIATOR_FLUX, 1e-9, `${c.id}: the radiator area follows from 1000 K two-sided`);
  near(p.radiator.count * p.radiator.widthM * p.radiator.lengthM, p.radiator.areaM2, 1e-9, `${c.id}: four panels of the stated width and length carry the area`);
  near(drive0.heat.rejectCapacity, p.radiator.heatW, 1e-9, `${c.id}: the module's own rejection figure is the radiator's`);
  if (p.store.kind === 'magazine') near(p.plateD, 1.45 * p.store.d, 1e-9, `${c.id}: the pusher plate is wider than the magazine it protects`);
  ok(p.dims.l > p.store.l && p.dims.d >= p.store.d, `${c.id}: the module envelope holds the frame, the store and the bay`);
}

ok(driven['seed-daedalus'].propulsion.beta > 0.09 && driven['seed-daedalus'].propulsion.closes, 'inertial fusion crosses in under a century at 9.8 % c');
ok(driven['colony-pulse'].propulsion.closes && driven['colony-pulse'].propulsion.tripYears < 100, 'the fusion-pulse colony crosses in 76 years');
ok(!driven['instrument-ion'].propulsion.closes && !driven['habitat-dfd'].propulsion.closes, 'the ion and direct-fusion ships are inner-system drives at this mass ratio, and the lab says so');
ok(PROPELLED.filter((c) => driven[c.id].propulsion.closes).length === 4, 'four of the eight close: both beamed classes, the seed and the colony');

/* ---------- v3 in the catalogue and in the pinned versions ---------- */
ok(V3_IDS.length === PROPELLED.length, 'v3 pins every driven class');
for (const c of PROPELLED) {
  const s = ships.find((x) => x.id === `centauri-${c.id}`);
  ok(!!s, `ships.json carries ${c.id}`);
  if (!s) continue;
  const m = driven[c.id];
  near(s.mass_kg, m.massKg, 1e-9, `${c.id}: the catalogue mass is the measured driven mass`);
  near(s.diameter_m, m.propulsion.dims.d, 1e-9, `${c.id}: the catalogue diameter is the drive module's tank envelope`);
  ok(s.source.startsWith('http') && s.notes.includes('CENTAURI-PROPULSION.md'), `${c.id}: the entry cites its drive and its note`);
  ok(s.model3d?.status === 'done' && s.status === 'concept' && s.built === false, `${c.id}: an unbuilt concept with a built catalogue model`);
  const p = FLEET_VERSIONS.v3.driven[c.id];
  ok(!!p && p.base === c.base && p.drive === c.drive, `v3 ${c.id}: the version records the hull and the drive`);
  near(m.massKg, p.massKg, 1e-9, `v3 ${c.id}: mass is pinned`);
  near(m.propulsion.hullKg, p.hullKg, 1e-9, `v3 ${c.id}: the hull mass is pinned`);
  if (p.wetKg !== null) near(m.propulsion.wetKg, p.wetKg, 1e-9, `v3 ${c.id}: the wet mass is pinned`);
  near(m.propulsion.beta, p.beta, 1e-9, `v3 ${c.id}: the cruise speed is pinned`);
  ok(p.closes === m.propulsion.closes, `v3 ${c.id}: the verdict is pinned`);
}

/* ---------- the fold: a hexagonal flasher ---------- */
// The sail is a six-gore rotational flasher: a hexagonal hub, a pinwheel shoulder ring whose radius
// is SOLVED for flat-foldability, and an outer hexagon. lambda is our projected-area fraction
// (parts/flasher.js says why); the stage boundaries are the ones the source figures report.
for (const cls of CLASSES) {
  const area = measures[cls.id].sail.sail.areaM2;
  const R = flasherRadius(area);
  near((3 * Math.sqrt(3) / 2) * R * R * (1 - FLASHER.hubFrac ** 2), area, 1e-12, `${cls.id}: the six gores minus the hub carry the measured film area`);
  near(measures[cls.id].sail.stowed.d, 2 * R * Math.sqrt(LAMBDA_FOLD), 1e-12, `${cls.id}: the stowed span is the flasher footprint, not an asserted 0.4 m`);
}
ok(FLASHER.sectors === 6 && faces().quads.length === 12, 'six gores, twelve facets around a hex hub');
ok(Math.abs(kawasakiResidual({ r1: SHOULDER })) < 1e-9, 'the shoulder radius is solved so Kawasaki holds exactly');
ok(Math.abs(kawasakiResidual({ r1: solveShoulder({ delta: Math.PI / 30 }), delta: Math.PI / 30 })) < 1e-9, 'and it stays solved for another pinwheel offset');
ok(maekawa().length === 6 && maekawa().every((m) => Math.abs(m.diff) === 2), 'Maekawa at all six interior vertices: three mountains, one valley');
ok(creases().filter((c) => c.kind === 'cut').length === 6, 'the hub boundary is a cut, not a fold');
const flatFilm = deploy(1, { radiusM: 1 });
near(2 * Math.hypot(flatFilm.points.O[0][0], flatFilm.points.O[0][2]), 2, 1e-12, 'deployed, the rim sits at the full radius');
near(Math.hypot(flatFilm.points.H[0][0], flatFilm.points.H[0][2]), FLASHER.hubFrac, 1e-12, 'and the hub at its fraction of it');
ok(flatFilm.twist === 0 && flatFilm.stage === 'expansion', 'deployed, the film is flat and untwisted');
near(deploy(LAMBDA_FOLD).twist, FLASHER.twistMax, 1e-12, 'stowed, the hub is wound one gore pitch');
near(deploy(LAMBDA_TWIST).twist, 0, 1e-12, 'the rotation stage ends exactly at the reported lambda');
ok(twistAt(0.064) > twistAt(LAMBDA_TWIST) && twistAt(0.402) === 0, 'rotation first, then pure radial expansion');
{
  const spans = [0.026, 0.064, 0.178, 0.402, 0.543, 1].map((l) => 2 * deploy(l, { radiusM: 1 }).radiusM);
  ok(spans.every((s, i) => i === 0 || s > spans[i - 1]), 'the six states of the source sequence are monotone in span');
}
for (const lam of [LAMBDA_FOLD, 0.064, LAMBDA_TWIST, 0.402, 0.543, 1]) {
  near(deploy(lam).scale ** 2, lam, 1e-12, `lambda ${lam} is the projected area fraction`);
}
near(foldRatio, 38.46, 0.01, '38.5 in area, 6.2 across: the figure stowed state');
near(lambdaFor(0), LAMBDA_FOLD, 1e-12, 'the slider bottoms out at the stowed state');
near(lambdaFor(1), 1, 1e-12, 'and tops out at the flat film');
ok(buckleAt(LAMBDA_FOLD, 1) > 0 && buckleAt(1, 1) === 0, 'the wound gores leave the plane, which is the twisted star; flat film, no buckle');
near(stowedEnvelope(1, 1e-7).h, FLASHER.layers * 1e-7, 1e-12, 'the pack is one film thickness per layer');
near(sailFoldedFootprint(10).w, stowedSpan(flasherRadius(10)), 1e-12, 'the footprint helper reports the flasher span');
near(sailSquareSide(4), 2, 1e-12, 'the equal-area square side is still what the beam trade uses');
{
  const packed = accordionAngles(0, 8), flat = accordionAngles(1, 8);
  ok(packed.every((a, i) => Math.abs(Math.abs(a) - Math.PI) < 1e-12 && Math.sign(a) === (i % 2 ? -1 : 1)), 'a wing packs flat with alternating hinges');
  ok(flat.every((a) => a === 0), 'a wing deploys flat');
  near(accordionFootprint(34, 8), 4.25, 1e-12, 'an ISS-class wing stows to 4.25 m of its 34 m');
}

/* ---------- v4: the realism pass ---------- */
// Every class re-cut from a stated mission with a full systems inventory (parts/fleet-v4.js,
// parts/inventory.js, CENTAURI-INVENTORY.md). The checks hold the inventory to its laws: consumables
// against crew x days, pressurised volume per person, mass closure, every inventory item placed in
// a part, the stow volume, the delta-v budget, the film's thermal limit, and the pins.
ok(REALISM.length === 8 && REALISM.every((c) => c.version === 4 && MISSIONS[c.base]), 'v4 re-cuts all eight classes from a stated mission');
const v4 = Object.fromEntries(REALISM.map((c) => [c.id, measure(c.id)]));
const aabb = (n) => { const b = summarize([n]).bounds; return { min: b.min, max: b.max, vol: b.size[0] * b.size[1] * b.size[2] }; };
const ringKinds = new Set(['centrifuge', 'spin-bola', 'habitat-ring', 'sail', 'mast', 'despin-hub', 'spin-bearing', 'radiator', 'truss', 'landing-gear', 'grid-fins']);
for (const c of REALISM) {
  const m = v4[c.id], r = m.inventory, M = c.mission, def = m.def;
  ok(m.structural.length === 0, `${c.id}: the assembly closes with no structural fault (${m.structural[0]?.message ?? 'ok'})`);
  ok(m.summary.partCount === def.parts.length && m.solved.mates.length === def.parts.length - 1, `${c.id}: every part is placed and the mate graph is a tree`);
  ok(!!r && r.mission === M, `${c.id}: the measurement carries the inventory roll-up`);
  near(m.massKg, m.solved.nodes.reduce((s, n) => s + n.part.mass, 0), 1e-12, `${c.id}: the vehicle mass is the sum of its parts (mass closure)`);
  ok(m.geometry.offAxisM < 0.5, `${c.id}: the centre of pressure stays on the thrust line (${m.geometry.offAxisM.toFixed(3)} m)`);
  ok(Number.isFinite(m.ratios.payload) && m.ratios.payload >= 1, `${c.id}: the sized ship is ${m.ratios.payload.toFixed(1)}x the source table's payload, and the lab says so`);
  /* the film: Lubin's law against everything it pushes, canister included */
  near(r.filmKg, r.hullKg + (m.geometry.hubbed ? 0 : r.systemsKg), 1e-6, `${c.id}: the film weighs what it pushes (hull plus sail systems${m.geometry.hubbed ? ', absorbed into the chip' : ''})`);
  near(m.sail.dims.d, sailDiameter(r.filmKg), 1e-9, `${c.id}: the sail diameter follows from that film mass`);
  ok(r.film && Number.isFinite(r.film.tempK), `${c.id}: the film temperature under the boost flux is measured`);
  if (c.base === 'wafer') ok(r.film.tempK < r.film.limitK * 1.05, `${c.id}: the Starshot flux puts the film within 5 % of its 1000 K limit (${r.film.tempK.toFixed(0)} K): the known constraint`);
  else ok(r.film.ok, `${c.id}: the film stays under ${r.film.limitK} K (${r.film.tempK.toFixed(0)} K)`);
  /* stow and deploy */
  ok(r.stow.fits, `${c.id}: the stowed film (${r.stow.filmM3.toExponential(2)} m3) fits its canister (${r.stow.canisterM3.toExponential(2)} m3)`);
  const canister = m.solved.nodes.find((n) => n.part.kind === 'sail-canister');
  if (canister) {
    const lo = canister.world.position[1];
    ok(lo >= m.geometry.hullTopY - 1e-9, `${c.id}: the canister (stowed state) stands clear of every structure (${(lo - m.geometry.hullTopY).toFixed(2)} m)`);
    ok(m.geometry.clearanceM > 0, `${c.id}: the deployed film plane is ahead of every structure (${m.geometry.clearanceM.toFixed(2)} m)`);
    ok(canister.part.inventory.some((i) => /canister/.test(i.item)) && canister.part.inventory.some((i) => /vane/.test(i.item)), `${c.id}: the canister part carries the deployer and the trim vanes`);
  } else ok(c.base === 'wafer' && m.geometry.hubbed, `${c.id}: only the wafer is hub-mounted without a canister`);
  /* no interpenetration: unmated pairs of solid bodies may not overlap by more than 5 % of the smaller box */
  const solids = m.solved.nodes.filter((n) => !ringKinds.has(n.part.kind));
  const mated = new Set(m.solved.mates.map((mt) => `${mt.a.name}|${mt.b.name}`));
  const overlaps = [];
  for (let i = 0; i < solids.length; i += 1) for (let j = i + 1; j < solids.length; j += 1) {
    const A = solids[i], B = solids[j];
    if (mated.has(`${A.name}|${B.name}`) || mated.has(`${B.name}|${A.name}`)) continue;
    const a = aabb(A), b = aabb(B);
    const ix = Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]));
    const iy = Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]));
    const iz = Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]));
    const v = ix * iy * iz, small = Math.min(a.vol, b.vol);
    if (small > 0 && v > 0.05 * small) overlaps.push(`${A.name}/${B.name} ${(100 * v / small).toFixed(0)} %`);
  }
  ok(overlaps.length === 0, `${c.id}: no two unmated bodies interpenetrate (${overlaps.join(', ') || 'none'})`);
  /* every inventory item the laws produced is placed in some part */
  if (r.mission.crew > 0 || def.inventory) {
    const placed = new Set(m.solved.nodes.flatMap((n) => (n.part.inventory ?? []).map((i) => i.item)));
    const missing = (def.inventory?.items ?? []).filter((i) => !placed.has(i.item) && !/^trim|^spares|magsail|^fission reactor|^hotel-load|^bow dust|^MMRTG|^high-gain|^laser comm/.test(i.item) && !['propulsion'].includes(i.group) && ![...placed].some((p) => p.startsWith(i.item.split(',')[0])));
    ok(missing.length === 0, `${c.id}: every inventory item is placed in a part (${missing.map((i) => i.item).join(', ') || 'all placed'})`);
    const stageNode = m.solved.nodes.find((n) => n.part.kind === 'trim-stage');
    if (def.inventory) {
      ok(!!stageNode && stageNode.part.propellantKg > 0, `${c.id}: a trim/braking stage with propellant is on the hull`);
      ok(m.solved.nodes.some((n) => (n.part.inventory ?? []).some((i) => /RCS quads/.test(i.item))), `${c.id}: RCS quads are placed`);
      ok(m.solved.nodes.some((n) => (n.part.inventory ?? []).some((i) => /dust shield/.test(i.item))) || m.solved.nodes.some((n) => n.part.kind === 'dust-shield'), `${c.id}: a bow dust shield is placed`);
      if (M.stop) ok(stageNode.part.inventory.some((i) => /magsail/.test(i.item)), `${c.id}: a ship that stops carries its magsail on the braking stage`);
      /* the delta-v budget closes on what the stage actually pushes: the hull after the film, mast and canister are gone */
      const dv = deltaVBudget({ years: M.years, stop: M.stop });
      const pushed = r.hullKg - stageNode.part.propellantKg;
      const needKg = pushed * (Math.exp(dv.totalMs / (M.isp * G0_PRIM)) - 1);
      ok(stageNode.part.propellantKg >= needKg * 0.85, `${c.id}: the stage's ${Math.round(stageNode.part.propellantKg)} kg of propellant covers ${dv.totalMs} m/s on the ${Math.round(pushed)} kg it pushes (needs ${Math.round(needKg)} kg)`);
    }
  }
  /* the crewed classes: life support against the people */
  if (M.crew > 0 && def.inventory) {
    const law = consumablesFor({ crew: M.crew, days: M.days, closure: CLOSURE[M.closure], pressurisedM3: def.inventory.mission.pressurisedM3 });
    near(r.consumablesKg, law.mass, 1e-9, `${c.id}: consumables are the law's answer for ${M.crew} crew x ${Math.round(M.days)} days (${Math.round(law.mass / 1e3)} t)`);
    ok(r.consumablesKg >= M.crew * M.days * 1.2 * (1 - CLOSURE[M.closure].food), `${c.id}: at least the packaged food for every person-day is aboard`);
    ok(r.pressurisedPerPerson >= (M.days > 365 ? VOLUME_PER_PERSON_M3.permanent : VOLUME_PER_PERSON_M3.long), `${c.id}: ${r.pressurisedPerPerson.toFixed(0)} m3 of pressurised volume per person`);
    ok(r.storesM3 >= r.storesNeededM3, `${c.id}: the stores modules hold the consumables (${r.storesM3.toFixed(0)} m3 for ${r.storesNeededM3.toFixed(0)} m3)`);
    ok(r.powerGenW >= r.powerLoadW, `${c.id}: power generated (${(r.powerGenW / 1e3).toFixed(0)} kW) covers the load (${(r.powerLoadW / 1e3).toFixed(0)} kW)`);
    ok(m.solved.nodes.some((n) => n.part.kind === 'reactor'), `${c.id}: a fission reactor, because there is no sunlight on this route`);
    ok(m.solved.nodes.some((n) => n.part.kind === 'radiator'), `${c.id}: radiators reject the hotel load`);
    ok(m.solved.nodes.some((n) => n.part.kind === 'airlock') && m.solved.nodes.some((n) => n.part.kind === 'pma'), `${c.id}: an EVA airlock and a docking port`);
    ok(m.solved.nodes.some((n) => ['centrifuge', 'spin-bola'].includes(n.part.kind)), `${c.id}: 1 g for a crew that lives aboard for decades`);
    ok(m.solved.nodes.some((n) => (n.part.inventory ?? []).some((i) => /storm shelter/.test(i.item))), `${c.id}: a storm shelter is aboard`);
    const ring = r.ring;
    if (ring?.rimSpeed) ok(Math.abs(ring.rimSpeed ** 2 / (ring.R ?? 55.9) - 9.80665) < 0.05, `${c.id}: the ring gives 1 g at its radius`);
  }
  if (c.base === 'capsule') ok(m.solved.nodes.find((n) => n.part.kind === 'crew-capsule').part.inventory.some((i) => /PICA/.test(i.item)), 'capsule-v4: the capsule carries a heat shield and TPS');
  if (c.base === 'lander') {
    ok(m.solved.nodes.some((n) => n.part.kind === 'landing-gear') && m.solved.nodes.some((n) => n.part.kind === 'grid-fins'), 'lander-v4: landing legs and grid fins for an atmosphere');
    ok(m.solved.nodes.find((n) => n.part.kind === 'lander-aero').part.inventory.some((i) => /TPS tiles/.test(i.item)), 'lander-v4: TPS tiles on the windward side and nose');
    ok(def.landing && def.landing.propKg > 0, 'lander-v4: the landing burn has its own propellant');
  }
}
ok(v4['habitat-v4'].massKg > 5 * 1e5 && v4['colony-v4'].massKg > 5e7, 'a six-crew fifty-year ship is hundreds of tonnes and a thousand-crew world ship tens of kilotonnes: the table payloads were an order of magnitude light');
ok(v4['capsule-v4'].massKg < 3 * 1e4, 'the 30-day capsule stays a Dragon-class stack');
ok(V4_IDS.length === REALISM.length, 'v4 pins every realism-pass class');
for (const c of REALISM) {
  const p = FLEET_VERSIONS.v4.realism[c.id], m = v4[c.id], r = m.inventory;
  ok(!!p && p.base === c.base && p.crew === r.crew, `v4 ${c.id}: the version records the base class and crew`);
  near(m.massKg, p.massKg, 1e-9, `v4 ${c.id}: mass is pinned`);
  near(r.hullKg, p.hullKg, 1e-9, `v4 ${c.id}: hull mass is pinned`);
  near(m.sail.dims.d, p.sailD, 1e-9, `v4 ${c.id}: sail is pinned`);
  near(m.geometry.mastLenM, p.mastLenM, 1e-9, `v4 ${c.id}: mast is pinned`);
  near(r.consumablesKg, p.consumablesKg, 1e-9, `v4 ${c.id}: consumables are pinned`);
  near(r.pressurisedM3, p.pressurisedM3, 1e-9, `v4 ${c.id}: pressurised volume is pinned`);
  ok(m.summary.partCount === p.partCount, `v4 ${c.id}: the part count is pinned (${p.partCount})`);
  const s = ships.find((x) => x.id === `centauri-${c.id}`);
  ok(!!s, `ships.json carries ${c.id}`);
  if (!s) continue;
  near(s.mass_kg, m.massKg, 1e-9, `${c.id}: the catalogue mass is the measured mass`);
  near(s.diameter_m, m.sail.dims.d, 1e-9, `${c.id}: the catalogue diameter is the measured sail`);
  ok(s.notes.includes('CENTAURI-INVENTORY.md') && s.model3d?.status === 'done', `${c.id}: the entry cites the inventory and has a model`);
}

console.log(`centauri fleet: ${checks} checks pass`);
