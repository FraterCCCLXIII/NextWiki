// centauri-primitives.test.mjs -- node checks for the parametric component library
// (parts/primitives/spec.js) and the mission inventory laws (parts/inventory.js), each primitive in
// isolation: sized from physical inputs, mass and volume closed, mates where a part can attach.
// Run by run-tests.mjs, or: node public/kosmo/static/centauri-primitives.test.mjs

import assert from 'node:assert/strict';
import {
  MATERIALS, ogiveProfile, haackProfile, domeProfile, tankSpec, copvSpec, hullSegmentSpec, torusDeckSpec, trussSpec, thrustFrameSpec,
  radiatorSpec, mliSpec, solarArraySpec, rtgSpec, reactorSpec, powerStoreSpec, bellSpec, rcsQuadSpec, kickStageSpec, fairingSpec, tpsSpec, TPS_KIND,
  gridFinSpec, landingLegSpec, parachuteSpec, whippleSpec, dustShieldSpec, stormShelterSpec, dishSpec, laserCommSpec, attitudeStoreSpec, gncSpec,
  DOCKING, dockingSpec, hatchSpec, windowSpec, crewFittingsSpec, shroudLinesSpec, sailBoomSpec, sailCanisterSpec, filmTemperatureK, beaconSpec, massOf, G0, SIGMA_SB
} from './parts/primitives/spec.js';
import { RATES, CLOSURE, ECLSS_HW, VOLUME_PER_PERSON_M3, SPARES, consumablesFor, eclssFor, deltaVBudget, sailSystemsFor, inventoryFor, inventoryPart } from './parts/inventory.js';
import { flasherRadius } from './parts/flasher.js';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks += 1; };
const near = (a, b, tol, message) => { assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-12, `${message}: got ${a}, expected ${b} (${(tol * 100).toFixed(1)} %)`); checks += 1; };
const hasMates = (spec, ids) => ids.every((id) => spec.mates.some((m) => m.id === id && m.at.length === 3 && m.axis.length === 3));

/* ---------- profiles ---------- */
{
  const og = ogiveProfile(1, 3, 10);
  near(og[0][0], 1, 1e-12, 'an ogive starts at the base radius');
  near(og[10][0], 0, 1e-9, 'and closes to a point at the tip');
  ok(og.every((p, i) => i === 0 || p[0] <= og[i - 1][0] + 1e-12), 'the ogive radius never grows toward the tip');
  const hk = haackProfile(1, 3, 10);
  near(hk[0][0], 1, 1e-9, 'a Haack profile starts at the base radius');
  near(hk[10][0], 0, 1e-9, 'and closes to a point');
  ok(hk[5][0] < og[5][0], 'the von Karman nose is slimmer than the tangent ogive at mid-length (minimum drag)');
  const dm = domeProfile(2, 1.414, 8);
  near(dm[0][0], 2, 1e-12, 'a dome starts at the base radius');
  near(dm[8][1], 1.414, 1e-12, 'and reaches its height on the axis');
}

/* ---------- tanks ---------- */
{
  const t = tankSpec({ volumeM3: 10, ldRatio: 2.5, pressurePa: 300e3 });
  const r = t.dims.d / 2;
  const V = Math.PI * r * r * t.barrelL + 2 * ((2 / 3) * Math.PI * r * r * t.domeH);
  near(V, 10 * 1.05, 1e-6, 'a cylindrical tank holds its volume plus ullage: barrel plus two elliptical domes');
  near(t.dims.l / t.dims.d, 2.5, 1e-9, 'at the stated length/diameter ratio');
  ok(t.gaugeM >= 0.0015, 'the wall never falls below minimum gauge');
  ok(t.mass > 0 && t.mass < 10 * 1000, 'a 10 m3 tank weighs less than the water it could hold');
  ok(hasMates(t, ['aft', 'fore']) && t.mates[1].at[1] === t.dims.l, 'tank mates sit on the aft and fore datum');
  ok(t.profile[0][1] === 0 && Math.abs(t.profile[t.profile.length - 1][1] - t.dims.l) < 1e-9, 'the lathe profile runs base to top');
  const sp = tankSpec({ volumeM3: 1, kind: 'sphere', ullage: 1 });
  near((Math.PI / 6) * sp.dims.d ** 3, 1, 1e-9, 'a spherical tank holds its volume');
  const hp = tankSpec({ volumeM3: 1, pressurePa: 30e6 });
  ok(hp.gaugeM > tankSpec({ volumeM3: 1, pressurePa: 300e3 }).gaugeM, 'a hundred times the pressure needs a thicker wall');
  const lh2 = tankSpec({ volumeM3: 100, insulationKgM2: 2 });
  ok(lh2.mass > tankSpec({ volumeM3: 100 }).mass, 'insulation adds mass by area');
  const c = copvSpec({ gasKg: 100, gasKind: 'O2' });
  near(c.volumeM3, (100 * 259.8 * 293) / 30e6, 1e-9, 'a COPV volume is the ideal-gas volume at its pressure');
  ok(c.mass / c.contentsKg > 0.3 && c.mass / c.contentsKg < 0.8, 'an oxygen COPV weighs about half its contents at 150 kJ/kg');
}

/* ---------- hulls, decks, trusses ---------- */
{
  const h = hullSegmentSpec({ d: 4.5, l: 6.9 });
  ok(h.volume.pressurised > 70 && h.volume.pressurised < 110, 'a Columbus-sized segment holds 70-110 m3');
  ok(h.mass > 8000 && h.mass < 14000, 'and weighs 8-14 t fitted (Columbus is 10.3 t)');
  ok(hasMates(h, ['aft', 'fore']), 'a hull segment has stack mates');
  const t = torusDeckSpec({ R: 55.9, D: 3, decks: 1, areaM2: 843 });
  near(t.mass, 843 * 250 + 2 * Math.PI * 55.9 * Math.PI * 3 * 60, 1e-9, 'a torus deck is floor plus shell by area');
  ok(t.origin === 'centre' && t.dims.d === 2 * 55.9 + 3, 'a torus is centred and spans 2R + D');
  const tr = trussSpec({ lengthM: 50, widthM: 1, axialLoadN: 1e5 });
  ok(tr.kgPerM > 0.5 && tr.kgPerM < 50, 'a 1 m lattice truss is kilograms per metre, not a tenth or hundreds');
  ok(trussSpec({ lengthM: 50, widthM: 1, axialLoadN: 1e7 }).kgPerM > tr.kgPerM * 10, 'a hundred times the load needs a far heavier truss');
  near(trussSpec({ lengthM: 100, widthM: 1, axialLoadN: 1e5 }).mass, 2 * tr.mass, 1e-9, 'truss mass is linear in length');
  ok(tr.bays === 50, 'bays are one width long');
  const f = thrustFrameSpec({ dAft: 1, dFore: 4, lengthM: 2, thrustN: 1e6 });
  near(f.mass, 2000, 1e-9, 'a thrust frame is F / 500 N per kg (1 MN -> 2 t)');
  near(thrustFrameSpec({ dAft: 1, dFore: 1, lengthM: 1, thrustN: 10 }).mass, 50, 1e-9, 'with a 50 kg floor');
}

/* ---------- thermal and power ---------- */
{
  const r = radiatorSpec({ heatW: 7500, tempK: 300 });
  near(r.fluxWm2, 2 * 0.9 * 0.85 * SIGMA_SB * 300 ** 4, 1e-9, 'radiator flux is two-sided grey body at the root temperature');
  near(r.areaM2 * r.fluxWm2, 7500, 1e-9, 'area times flux is the heat');
  near(r.panels * r.panelL * r.panelW, r.areaM2, 1e-9, 'the panels carry the whole area');
  ok(r.panels % 2 === 0 && r.perSide === r.panels / 2, 'panels come in pairs, one per side');
  near(r.mass, r.areaM2 * 8.8, 1e-9, 'at 8.8 kg/m2 (ISS PVR class)');
  ok(radiatorSpec({ heatW: 7500, tempK: 600 }).areaM2 < r.areaM2 / 10, 'doubling the temperature cuts the area sixteenfold');
  ok(radiatorSpec({ heatW: 0 }).areaM2 === 0 && radiatorSpec({ heatW: 0 }).mass === 0, 'no heat, no radiator');
  near(mliSpec({ areaM2: 100 }).mass, 50, 1e-12, 'MLI is 0.5 kg/m2');
  const a = solarArraySpec({ powerW: 31000 });
  ok(a.areaM2 > 80 && a.areaM2 < 100, 'a 31 kW wing at 30 % cells is 80-100 m2 at 1 AU');
  ok(solarArraySpec({ powerW: 31000, fluxWm2: 1361 / 25 }).areaM2 > a.areaM2 * 24, 'at 5 AU the array is 25x larger');
  const g = rtgSpec({ powerW: 110 });
  near(g.mass, 110 / 2.4, 1e-9, 'an MMRTG-class generator is 2.4 We/kg');
  ok(rtgSpec({ powerW: 110, yearsToEOL: 44 }).mass > g.mass * 1.3, 'forty-four years of Pu-238 decay need a bigger generator at launch');
  const re = reactorSpec({ powerWe: 40e3 });
  ok(re.mass > 4000 && re.mass < 9000, 'a 40 kWe fission unit is 4-9 t (NASA FSP ~6 t)');
  ok(reactorSpec({ powerWe: 20e6 }).mass / 20e3 < re.mass / 40, 'the MW class is lighter per kWe than the 40 kWe class');
  ok(re.radiator.areaM2 > 0 && re.coreKg + re.shieldKg + re.convKg + re.radiator.mass === re.mass, 'a reactor is core, shield, conversion and its own radiator');
  const ps = powerStoreSpec({ energyWh: 30000, busW: 20000 });
  near(ps.battKg, 200, 1e-9, '30 kWh at 150 Wh/kg is 200 kg (ISS Li-ion ORU class)');
  near(ps.pmadKg, 100, 1e-9, 'PMAD at 5 kg/kW');
}

/* ---------- propulsion fittings ---------- */
{
  const b = bellSpec({ thrustN: 1e5, chamberPa: 7e6, expansion: 100 });
  near(Math.PI * (b.dThroat / 2) ** 2, 1e5 / (1.85 * 7e6), 1e-9, 'throat area is F / (Cf pc)');
  near((b.dExit / b.dThroat) ** 2, 100, 1e-9, 'exit area is the expansion ratio times the throat');
  near(b.mass, 1e5 / (60 * G0), 1e-9, 'engine mass from thrust to weight');
  ok(b.profile[0][1] === 0 && b.profile[b.profile.length - 1][1] <= b.dims.l + 1e-9, 'the bell profile runs from the chamber to the exit');
  const q = rcsQuadSpec({ thrustN: 490 });
  near(q.thrusterKg, 3.675, 1e-9, 'a 490 N thruster is R-4D class (3.7 kg)');
  near(q.mass, 4 * 3.675 * 6, 1e-9, 'a quad is four thrusters times six for pod, valves, lines and heaters');
  ok(rcsQuadSpec({ thrustN: 0.5 }).thrusterKg === 0.03, 'a cold-gas microthruster bottoms at 30 g');
  const k = kickStageSpec({ shipDryKg: 1000, dvMs: 500, isp: 320 });
  near(k.massRatio, Math.exp(500 / (320 * G0)), 1e-12, 'the kick stage uses the rocket equation');
  near((1000 + k.engine.mass + k.tankKg) * (k.massRatio - 1), k.propKg, 1e-9, 'propellant is dry (ship, tanks, engine) times (R - 1)');
  near(k.tankKg, 0.1 * k.propKg, 1e-12, 'tanks are the stated fraction of the propellant');
  ok(k.closes && Number.isFinite(k.mass), 'a 500 m/s storable stage closes');
  ok(!kickStageSpec({ shipDryKg: 1000, dvMs: 20000, isp: 320, tankFraction: 0.1 }).closes, 'a 20 km/s chemical stage does not: the tanks outweigh the ship');
  ok(kickStageSpec({ shipDryKg: 1000, dvMs: 1e-9, isp: 320 }).propKg < 1e-6, 'no delta-v, no propellant');
}

/* ---------- aero and landing ---------- */
{
  const f = fairingSpec({ d: 2.4, fineness: 2 });
  near(f.dims.l, 4.8, 1e-12, 'a fineness-2 nose is two diameters long');
  near(f.mass, f.areaM2 * 12, 1e-9, 'fairing mass is shell area times 12 kg/m2');
  ok(fairingSpec({ d: 2.4, fineness: 2, tpsKgM2: 10 }).mass > f.mass, 'TPS on the nose adds mass by area');
  ok(f.profile.length > 10 && f.profile[0][1] === 0, 'the fairing profile is a loft from the base');
  near(tpsSpec({ areaM2: 100, kind: 'tile' }).mass, 100 * TPS_KIND.tile.kgPerM2, 1e-12, 'tiles at 10 kg/m2');
  ok(tpsSpec({ areaM2: 1, kind: 'ablator' }).mass > tpsSpec({ areaM2: 1, kind: 'quilt' }).mass, 'an ablator is heavier than a quilt');
  const gf = gridFinSpec({ bodyD: 3.66 });
  near(gf.mass, 1200, 1e-9, 'four Falcon 9 titanium fins are 1.2 t');
  near(gridFinSpec({ bodyD: 7.32 }).mass, 4800, 1e-9, 'fin mass scales with body area');
  const legs = landingLegSpec({ landedKg: 25000, bodyD: 3.66, bodyL: 42 });
  near(legs.spanM, 2.45 * 3.66, 1e-12, 'legs span 2.45 body diameters');
  near(legs.mass, 1000, 1e-9, '4 % of the landed mass at 1 g');
  ok(landingLegSpec({ landedKg: 25000, bodyD: 3.66, g: 0.38 * G0 }).mass < legs.mass, 'Mars gravity needs lighter legs');
  near(parachuteSpec({ landedKg: 9500 }).mass, 332.5, 1e-9, 'chutes are 3.5 % of landed mass');
}

/* ---------- shielding ---------- */
{
  near(whippleSpec({ areaM2: 10, kind: 'stuffed' }).mass, 100, 1e-12, 'stuffed Whipple at 10 kg/m2');
  near(whippleSpec({ areaM2: 10, kind: 'plain' }).mass, 50, 1e-12, 'plain bumper at 5 kg/m2');
  const d = dustShieldSpec({ areaM2: 10, beta: 0.12 });
  near(d.kgPerM2, 60, 1e-9, 'the Daedalus shield is 60 kg/m2 at 0.12 c');
  near(dustShieldSpec({ areaM2: 10, beta: 0.06 }).kgPerM2, 15, 1e-9, 'half the speed, a quarter of the shield');
  ok(dustShieldSpec({ areaM2: 10, beta: 0.001 }).kgPerM2 === 5, 'with a 5 kg/m2 floor');
  const s = stormShelterSpec({ crew: 6 });
  near(s.volumeM3, 9, 1e-12, 'a 6-crew shelter is 1.5 m3 per person');
  near(s.waterKg, s.areaM2 * 200, 1e-9, '20 g/cm2 of water is 200 kg/m2');
  ok(s.mass < s.waterKg * 0.1, 'the water is counted in the stores; the shelter carries only bladders and plumbing');
  ok(stormShelterSpec({ crew: 6, waterFromStores: false }).mass > s.waterKg, 'unless the shelter carries its own water');
}

/* ---------- avionics, comms, docking, fittings ---------- */
{
  const d = dishSpec({ d: 2.1 });
  near(d.gainDbi, 10 * Math.log10(0.6 * (Math.PI * 2.1 / (0.299792458 / 8.4)) ** 2), 1e-9, 'dish gain is the aperture law at X band');
  ok(d.gainDbi > 40 && d.gainDbi < 45, 'a 2.1 m X-band dish is 40-45 dBi (New Horizons 42)');
  ok(d.mass > 20 && d.mass < 30, 'and weighs 20-30 kg');
  ok(laserCommSpec({ apertureM: 0.22 }).mass > 10 && laserCommSpec({ apertureM: 0.22 }).mass < 40, 'a DSOC-class terminal is 10-40 kg');
  const rw = attitudeStoreSpec({ inertiaKgM2: 1000 });
  ok(rw.kind === 'reaction wheels' && rw.mass > 0.3, 'a small body gets reaction wheels');
  const cmg = attitudeStoreSpec({ inertiaKgM2: 1e8 });
  ok(cmg.kind === 'CMG' && cmg.mass >= 160, 'a station-class body gets CMGs, at least 40 kg each');
  ok(attitudeStoreSpec({ inertiaKgM2: 1e11 }).mass < 1e6, 'a world ship slews slowly enough that its CMGs stay under a kilotonne');
  ok(gncSpec({ crewed: true }).mass === 60 && gncSpec({ crewed: false }).mass === 6, 'GNC suites by class');
  ok(gncSpec({ crewed: true }).items.includes('rendezvous lidar'), 'a crewed suite carries rendezvous sensors');
  ok(dockingSpec({ kind: 'idss-active' }).mass === 341 && DOCKING['cbm-active'].mass === 500, 'docking mechanisms carry their flown masses');
  near(hatchSpec({ d: 1.27 }).mass, 90, 1e-12, 'a CBM hatch is 90 kg');
  near(windowSpec({ d: 0.5, count: 4 }).mass, 100, 1e-12, 'four 0.5 m windows with shutters');
  const cf = crewFittingsSpec({ crew: 6, days: 1000 });
  ok(cf.items.length === 6 && cf.mass === cf.items.reduce((s, i) => s + i.kg, 0), 'crew fittings sum their items');
  ok(cf.items.find((i) => /exercise/.test(i.item)).kg === 1300, 'a long mission carries ARED and a treadmill');
  ok(crewFittingsSpec({ crew: 4, days: 30 }).items.find((i) => /exercise/.test(i.item)).kg === 100, 'a short one an ergometer');
}

/* ---------- sail systems ---------- */
{
  const sl = shroudLinesSpec({ radiusM: 100, lengthM: 110, loadN: 6000 });
  ok(sl.lineDiameterM >= 2e-4 && sl.mass > 0, 'shroud lines have a minimum diameter and a mass');
  ok(shroudLinesSpec({ radiusM: 100, lengthM: 110, loadN: 6e6 }).mass > sl.mass * 100, 'a thousand times the load, far heavier lines');
  const bm = sailBoomSpec({ radiusM: 7, filmKg: 1 });
  near(bm.kgPerM, 0.1, 1e-9, 'NEA Scout booms are 0.1 kg/m at 7 m');
  near(bm.mass, 6 * 7 * 0.1, 1e-9, 'six booms of the film radius');
  const can = sailCanisterSpec({ filmKg: 10 });
  near(can.volumeM3, (10 / 3400) * 8, 1e-9, 'the canister holds the film volume times the packing factor');
  near(can.dims.l, can.dims.d, 1e-12, 'as a drum with l = d');
  ok(can.mass > can.drumKg && can.motorKg > 0 && can.latchKg > 0, 'drum, motors and latches');
  ok(sailCanisterSpec({ filmKg: 4e7 }).wallM === 0.03, 'a world-ship drum caps its wall at 30 mm');
  const T = filmTemperatureK({ fluxWm2: 1e6 });
  near(T, Math.pow((1e6 * 1e-5) / (2 * 0.5 * SIGMA_SB), 0.25), 1e-12, 'film temperature is two-sided grey-body equilibrium at the stated absorptance');
  ok(filmTemperatureK({ fluxWm2: 6e9 }) > 1000 && filmTemperatureK({ fluxWm2: 6e9 }) < 1100, 'the Starshot flux (6 GW/m2) sits right at the 1000 K limit, which is the known constraint');
  ok(beaconSpec({ radiusM: 10 }).mass === 6 * 0.02, 'six 20 g beacons at 10 m');
  near(massOf([{ mass: 1 }, { mass: 2 }, null, { mass: 3 }]), 6, 1e-12, 'massOf sums and skips nulls');
}

/* ---------- the inventory laws ---------- */
{
  ok(RATES.o2 === 0.84 && RATES.waterTotal === 3.6 && RATES.foodDry === 0.62, 'the per person-day rates are NASA-STD-3001 / BVAD');
  ok(CLOSURE.iss.water === 0.9 && CLOSURE.iss.o2 === 0.5 && CLOSURE.advanced.water === 0.98, 'closures are the ISS as flown and the Mars targets');
  const open = consumablesFor({ crew: 4, days: 30, closure: { water: 0, o2: 0, food: 0 }, pressurisedM3: 10 });
  near(open.items.find((i) => /food/.test(i.item)).kg, 4 * 30 * 1.2, 1e-12, 'open loop: 1.2 kg of packaged food per person-day');
  near(open.items.find((i) => /^water/.test(i.item)).kg, 4 * 30 * 3.6 + 200, 1e-12, 'open loop: 3.6 kg of water per person-day plus the loop charge');
  const adv = consumablesFor({ crew: 6, days: 365.25 * 50, closure: CLOSURE.advanced, pressurisedM3: 300 });
  ok(adv.mass < consumablesFor({ crew: 6, days: 365.25 * 50, closure: CLOSURE.iss, pressurisedM3: 300 }).mass, 'better closure, fewer consumables');
  ok(adv.items.find((i) => /^water/.test(i.item)).kg > 6 * 365.25 * 50 * 3.6 * 0.02, 'long haul: the O2 make-up is carried as water');
  ok(adv.gasKg.o2 < 1000, 'and the oxygen gas tanks hold only a cabin fill and 30 days');
  near(consumablesFor({ crew: 1, days: 1000, closure: CLOSURE.closed, pressurisedM3: 0 }).items.find((i) => /supplies/.test(i.item)).kg, 1000 * 0.3 * 0.2, 1e-9, 'world-ship closure remanufactures 80 % of crew supplies');
  const e = eclssFor({ crew: 6, closure: CLOSURE.greenhouse });
  near(e.hardwareKg, ECLSS_HW.fixedKg + 6 * ECLSS_HW.perCrewKg, 1e-12, 'ECLSS hardware is fixed plus per-person');
  near(e.greenhouse.areaM2, 6 * 50 * 0.5, 1e-12, 'a half-diet greenhouse is 25 m2 per person');
  ok(eclssFor({ crew: 6, closure: CLOSURE.advanced }).greenhouse === null, 'no greenhouse unless the closure grows food');
  ok(e.items.length === 7, 'seven life-support functions are listed');
  ok(VOLUME_PER_PERSON_M3.permanent === 30 && VOLUME_PER_PERSON_M3.short === 2.3, 'volume per person: 30 m3 for years, Orion-class 2.3 for weeks');
  const dv = deltaVBudget({ years: 44, stop: false });
  near(dv.totalMs, 15 + 88 + 20 + 44, 1e-12, 'a 44-year flyby budget is trim, corrections, terminal pointing and attitude');
  ok(deltaVBudget({ years: 44, stop: true }).totalMs === dv.totalMs + 400, 'stopping adds the chemical residual after the magsail');
  ok(SPARES.max === 0.3, 'spares cap at 30 %');
}

/* ---------- sail systems and the inventory of one ship ---------- */
{
  const s = sailSystemsFor({ filmKg: 100, areaM2: 100 / 0.00034, thrustN: 1000, deliveredW: 1e9 });
  near(s.radiusM, flasherRadius(100 / 0.00034), 1e-12, 'the film radius is the flasher radius for the area');
  ok(s.canister.volumeM3 >= (100 / 3400) * 8 - 1e-9, 'the canister holds the rolled film');
  ok(s.planarPack.d > s.canister.dims.d, 'the planar flasher pack is wider than the drum the gores are rolled onto');
  ok(s.items.length === 4 && s.mass === s.items.reduce((a, i) => a + i.kg, 0), 'four sail-system items that sum');
  ok(s.spinStabilised && s.notes.length >= 5, 'the film is spin-stabilised and the design notes travel with it');
  near(s.filmK, filmTemperatureK({ fluxWm2: 1e9 / (100 / 0.00034) }), 1e-12, 'the film temperature follows the flux');
  const hub = sailSystemsFor({ filmKg: 0.001, areaM2: 0.001 / 0.00034, thrustN: 0.1, deliveredW: 1.8e10, hubbed: true });
  ok(hub.canister === null && hub.items.length === 3 && hub.mass < 0.001, 'a hub-mounted wafer film needs no canister and its systems are a fraction of the film');

  const inv = inventoryFor({ crew: 6, days: 365.25 * 50, closure: CLOSURE.advanced, stop: true, power: 'reactor', years: 46, pressurisedM3: 400, dryHardwareKg: 60000, hullAreaM2: 400, frontalAreaM2: 16, inertiaKgM2: 1e8, dishM: 3, laserApertureM: 1 });
  ok(inv.items.every((i) => Number.isFinite(i.kg) && i.kg >= 0 && typeof i.source === 'string' && i.source.length > 8), 'every inventory item has a finite mass and a source');
  near(inv.mass, inv.items.reduce((a, i) => a + i.kg, 0), 1e-9, 'the inventory mass is the sum of its items');
  const groups = new Set(inv.items.map((i) => i.group));
  for (const g of ['consumables', 'life support', 'gas storage', 'water storage', 'crew fittings', 'radiation', 'power', 'thermal', 'MMOD', 'GNC', 'comms', 'RCS', 'propulsion', 'spares']) ok(groups.has(g), `a crewed inventory covers ${g}`);
  ok(inv.items.some((i) => /magsail/.test(i.item)), 'a ship that stops carries a magsail');
  ok(!inventoryFor({ crew: 0, days: 0, stop: false, power: 'none', years: 44, dryHardwareKg: 100, busW: 10 }).items.some((i) => /magsail/.test(i.item)), 'a flyby does not');
  ok(inv.powerSpec.primitive === 'reactor' && inv.genW >= inv.hotelW, 'a reactor covers the hotel load');
  near(inv.hotelW, 6 * 2000 + 6 * 1400, 1e-9, 'the hotel load is 2 kW/person plus the ECLSS');
  ok(inv.stage.closes && inv.stage.propKg > 0, 'the trim stage closes its delta-v');
  near(inv.volumeNeededM3, 180, 1e-12, 'six crew for years need 180 m3');
  const bay = inventoryPart({ name: 'bay', kind: 'systems-bay', items: inv.items.slice(0, 3), dims: { l: 1, d: 1 }, ports: [] });
  near(bay.mass, inv.items.slice(0, 3).reduce((a, i) => a + i.kg, 0), 1e-12, 'an inventory part weighs its items');
  ok(bay.inventory.length === 3 && bay.dataQuality === 'derived', 'and carries them as its inventory');
}

console.log(`centauri primitives: ${checks} checks pass`);
