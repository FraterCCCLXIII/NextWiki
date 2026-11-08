/* inventory.js -- the systems inventory a Centauri class has to carry, sized from the mission.

   A ship is crew x days, a cruise speed and a route. From those this module sizes everything the
   audit (CENTAURI-AUDIT.md F6) said was missing: life support and its consumables, the stores to
   hold them, shielding, power, thermal, attitude control, communications, the RCS and a trim/braking
   stage from a delta-v budget, and -- for the sail versions -- the deployment canister, booms,
   shroud lines, beacons and the film's own thermal limit. Each item is a primitive from
   primitives/spec.js or a stated law with its source, and every figure is written down in
   CENTAURI-INVENTORY.md with the same numbers this file produces.

   The per-person-day rates are NASA's: NASA-STD-3001 Vol 2 and the Baseline Values and Assumptions
   Document (NASA/TP-2015-218570, BVAD 2018). Closure figures are the ISS as flown (water ~90 %, O2
   from CO2 ~50 %) and NASA's stated targets for Mars-class missions (98 % water, 75 % O2).

   Pure functions, no DOM. Imported by fleet.js and the node checks. */

import {
  tankSpec, copvSpec, radiatorSpec, solarArraySpec, rtgSpec, reactorSpec, powerStoreSpec, rcsQuadSpec, kickStageSpec,
  whippleSpec, dustShieldSpec, stormShelterSpec, dishSpec, laserCommSpec, attitudeStoreSpec, gncSpec, crewFittingsSpec,
  sailCanisterSpec, filmTemperatureK, beaconSpec, massOf, G0
} from './primitives/spec.js';
import { flasherRadius, stowedEnvelope } from './flasher.js';

export const C = 299792458;
const DAY = 86400;

/* ------------------------------------------------------------------ *
 * Per person-day rates (kg) and closures
 * ------------------------------------------------------------------ */
export const RATES = {
  o2: 0.84, // kg/person-day, NASA-STD-3001 Vol 2 / BVAD Table 3.2
  co2: 1.04, // produced
  waterTotal: 3.6, // drink 2.0 + food prep 0.5 + hygiene 1.1 (BVAD, reduced hygiene allocation)
  foodDry: 0.62, // dry food mass; packaged dehydrated food is taken as 1.2 kg/pd incl. packaging
  foodPackaged: 1.2,
  crewSupplies: 0.3, // clothing, hygiene consumables, wipes (BVAD 0.2-0.5)
  wasteStored: 0.12, // dried faeces, brine residue, trash after compaction
  n2LeakPerM3Day: 0.0005 // kg of N2 per m3 of pressurised volume per day (ISS ~0.1 kg/d over ~900 m3)
};

export const CLOSURE = {
  iss: { water: 0.90, o2: 0.50, food: 0, label: 'ISS as flown (WRS ~90 %, Sabatier ~50 %)' },
  advanced: { water: 0.98, o2: 0.75, food: 0, label: 'NASA Mars targets (98 % water, 75 % O2)' },
  greenhouse: { water: 0.98, o2: 0.90, food: 0.5, label: '98 % water, 90 % O2 with a half-diet greenhouse' },
  closed: { water: 0.99, o2: 0.95, food: 0.9, supplies: 0.8, label: 'world-ship closure: 99 % water, 95 % O2, 90 % of diet grown, 80 % of textiles and consumables remanufactured' }
};

/* ECLSS hardware: ISS US segment life support is about four racks (OGA, CDRA, WRS x2, TCCS) ~2.5 t for
   6 crew plus ducting and sensors. 1.5 t fixed + 500 kg/person; power ~1.4 kW/person (ISS ECLSS ~8 kW
   for 6 including heaters). Greenhouse: BVAD plant chamber ~50 m2/person for a full diet, 100 kg/m2
   wet with trays, lighting 0.35 kW/m2 of LED. */
export const ECLSS_HW = { fixedKg: 1500, perCrewKg: 500, perCrewW: 1400, greenhouseM2PerPersonFullDiet: 50, greenhouseKgM2: 100, greenhouseWm2: 350 };
export const VOLUME_PER_PERSON_M3 = { short: 2.3, long: 25, permanent: 30 }; // NASA-STD-3001 Vol 2: Orion gives 2.3 m3/person habitable for 21 d; the Celentano curve asymptote is ~20-25 m3 and 30 is taken for years
export const HOTEL_W_PER_PERSON = 2000; // lighting, galley, hygiene, avionics, comms share (ISS ~84 kW / 6 incl. science; transit hab ~ 2-3 kW/p)
export const SPARES = { base: 0.10, perYearBeyond10: 0.01, max: 0.30 }; // 10 % of dry hardware, +1 %/yr past a decade, capped at 30 % where a workshop remanufactures (ISS ORU replacement ~1-2 %/yr)

/** Consumables for `crew` over `days` at a closure, as kg and the stores volume they need. */
export function consumablesFor({ crew, days, closure = CLOSURE.advanced, pressurisedM3 = 0 }) {
  const pd = crew * days;
  const water = RATES.waterTotal * pd * (1 - closure.water);
  const o2 = RATES.o2 * pd * (1 - closure.o2);
  const food = RATES.foodPackaged * pd * (1 - closure.food);
  const supplies = RATES.crewSupplies * pd * (1 - (closure.supplies ?? 0));
  const waste = RATES.wasteStored * pd;
  const n2 = RATES.n2LeakPerM3Day * pressurisedM3 * days;
  /* Initial charge: the loops have to be primed. Water 50 kg/person in the loop, O2 and N2 for one
     cabin fill plus a 10 % reserve on the make-up. */
  const primeWater = 50 * crew;
  const cabinO2 = pressurisedM3 * 0.28, cabinN2 = pressurisedM3 * 0.95;
  /* On a mission longer than a year the O2 make-up is carried as water and electrolysed (1 kg of water
     gives 0.89 kg of O2), because a gas tank weighs half its contents and a water bladder 8 %. The
     gas tanks then hold one cabin fill plus 30 days of make-up. */
  const longHaul = days > 365;
  const o2AsWater = longHaul ? (o2 * 1.1 * Math.max(0, days - 30)) / days / 0.89 : 0;
  const o2Gas = longHaul ? (o2 * 1.1 * 30) / days + cabinO2 : o2 * 1.1 + cabinO2;
  const items = [
    { item: 'water make-up' + (longHaul ? ' (incl. water electrolysed for O2 make-up)' : ''), kg: water + primeWater + o2AsWater, m3: (water + primeWater + o2AsWater) / 1000, source: `${RATES.waterTotal} kg/pd x (1 - ${closure.water}) + 50 kg/person loop charge${longHaul ? ' + O2 make-up as water (0.89 kg O2 per kg)' : ''}` },
    { item: 'oxygen gas: cabin charge' + (longHaul ? ' and 30 days of make-up' : ' and make-up'), kg: o2Gas, m3: null, source: `${RATES.o2} kg/pd x (1 - ${closure.o2}) x 1.1 ${longHaul ? 'for 30 d' : ''} + one cabin fill` },
    { item: 'nitrogen leakage make-up and charge', kg: n2 * 1.1 + cabinN2, m3: null, source: `${RATES.n2LeakPerM3Day} kg/m3/d leakage x 1.1 + one cabin fill` },
    { item: 'food, packaged', kg: food, m3: food / 400, source: `${RATES.foodPackaged} kg/pd packaged dehydrated x (1 - ${closure.food} grown)` },
    { item: 'crew supplies', kg: supplies, m3: supplies / 250, source: `${RATES.crewSupplies} kg/pd (clothing, hygiene, wipes)` },
    { item: 'waste storage allowance', kg: 0, m3: waste / 600, source: `${RATES.wasteStored} kg/pd stored, volume only (mass is the food and supplies already counted)` }
  ];
  return { crew, days, personDays: pd, closure: closure.label, items, mass: items.reduce((s, i) => s + i.kg, 0), gasKg: { o2: o2Gas, n2: n2 * 1.1 + cabinN2 }, waterKg: water + primeWater + o2AsWater, foodKg: food, storesM3: items.reduce((s, i) => s + (i.m3 ?? 0), 0) };
}

/** Life-support hardware and the greenhouse (if the closure grows food). */
export function eclssFor({ crew, closure = CLOSURE.advanced }) {
  const hw = ECLSS_HW.fixedKg + ECLSS_HW.perCrewKg * crew;
  const ghArea = closure.food > 0 ? crew * ECLSS_HW.greenhouseM2PerPersonFullDiet * closure.food : 0;
  return {
    hardwareKg: hw, hardwareW: ECLSS_HW.perCrewW * crew,
    greenhouse: ghArea > 0 ? { areaM2: ghArea, mass: ghArea * ECLSS_HW.greenhouseKgM2, powerW: ghArea * ECLSS_HW.greenhouseWm2, source: `${ECLSS_HW.greenhouseM2PerPersonFullDiet} m2/person full diet x ${closure.food}, ${ECLSS_HW.greenhouseKgM2} kg/m2, ${ECLSS_HW.greenhouseWm2} W/m2 LED (BVAD)` } : null,
    items: ['O2 generation (electrolysis)', 'CO2 removal (4-bed/amine) and reduction (Sabatier)', 'trace contaminant control', 'water recovery and urine processor', 'humidity and ventilation', 'fire detection and suppression', 'waste management'],
    source: `${ECLSS_HW.fixedKg} kg + ${ECLSS_HW.perCrewKg} kg/person (ISS US-segment OGA/CDRA/WRS/TCCS racks ~2.5 t for 6), ${ECLSS_HW.perCrewW} W/person`
  };
}

/* ------------------------------------------------------------------ *
 * Delta-v budget for a sail (or beam) ship
 * ------------------------------------------------------------------ */

/** The manoeuvres the sail cannot do. Departure trim, mid-course corrections over the coast,
 *  terminal attitude and (where the mission stops) an arrival that the sail cannot provide. */
export function deltaVBudget({ years, stop = false, approachStop = false }) {
  const rows = [
    { leg: 'post-boost trim and sail jettison separation', dv: 15 },
    { leg: 'mid-course corrections', dv: 2 * Math.max(1, years), note: '2 m/s per cruise year (New Horizons: ~20 m/s over 9 years)' },
    { leg: 'terminal pointing and flyby targeting', dv: 20 },
    { leg: 'station-keeping / attitude propellant equivalent', dv: 1 * Math.max(1, years) }
  ];
  if (stop) rows.push({ leg: 'orbit insertion at the destination (magsail-assisted, chemical residual)', dv: approachStop ? 2500 : 400, note: 'a chemical stage cannot shed 0.1 c; a magsail/drag sail sheds the bulk and this is the residual' });
  return { rows, totalMs: rows.reduce((s, r) => s + r.dv, 0) };
}

/* ------------------------------------------------------------------ *
 * Sail systems
 * ------------------------------------------------------------------ */

/**
 * Everything the film needs beyond itself: canister and deployer from the fold law's stowed pack,
 * six rim booms, shroud lines from the hub hardpoint to the rim carrying the sail thrust, edge
 * beacons/retroreflectors for beam tracking, the film's equilibrium temperature under the boost
 * flux, and the power the winding motors draw.
 */
export function sailSystemsFor({ filmKg, areaM2, thrustN, deliveredW, filmThicknessM = 1e-7, filmDensity = 3400, absorptance = 1e-5, emissivity = 0.5, hubbed = false }) {
  const R = flasherRadius(areaM2);
  const planar = stowedEnvelope(R, filmThicknessM);
  const canister = sailCanisterSpec({ filmKg, filmDensity });
  const beacons = beaconSpec({ radiusM: R });
  const fluxWm2 = deliveredW / Math.max(areaM2, 1e-12);
  const filmK = filmTemperatureK({ fluxWm2, absorptance, emissivity });
  const limitK = 1000; // silicon nitride / dielectric metasurface films are taken to 1000 K (Lubin, Atwater et al.)
  const motorW = Math.max(hubbed ? 0.001 : 2, 0.5 * canister.motorKg * 100);
  const vaneKg = Math.max(hubbed ? 1e-5 : 0.0002, 0.02 * filmKg);
  const items = hubbed
    ? [
      { item: 'hub ring and spin-deployment release', kg: Math.max(1e-5, 0.03 * filmKg), source: 'Derived: 3 % of film (Starshot-class hub-attached film, spin-deployed, no canister)' },
      { item: 'rim retroreflective patches and tip masses (in the film)', kg: 0.01 * filmKg, source: 'Derived: 1 % of film (Starshot: edge features patterned into the film)' },
      { item: 'tip vanes (photon-pressure trim)', kg: vaneKg, source: 'Derived: 2 % of film mass' }
    ]
    : [
      { item: 'sail canister and hub deployer', kg: canister.mass, m3: canister.volumeM3, source: canister.source },
      { item: 'rim tip masses, beacons and retroreflectors', kg: beacons.mass, source: beacons.source },
      { item: 'tension actuators and tip vanes', kg: vaneKg, source: 'Derived: 2 % of film mass (six vane actuators and six hub tension winches)' },
      { item: 'hub-to-mast gimbal, release nuts and shroud', kg: Math.max(0.05, 0.01 * filmKg), source: 'Derived: 1 % of film; the hub gimbal is the load path and the jettison plane' }
    ];
  return {
    radiusM: R, planarPack: planar, canister: hubbed ? null : canister, beacons, fluxWm2, filmK, limitK, filmOk: filmK <= limitK, motorW, items, mass: items.reduce((s, i) => s + i.kg, 0),
    spinStabilised: true,
    notes: [
      'the film is a spin-stabilised hexagonal flasher: the fold law gives the planar intermediate (1/sqrt(lambda) across), the gores are then rolled onto the hub drum, whose volume is the film volume times a packing factor',
      'the film is refolded onto the hub before planetary approach and for dust storms; the canister is the stowed-state envelope the stow check uses',
      'the load path is film -> hub ring -> gimbal -> mast -> thrust collar/hardpoint; the resultant is on the thrust axis, and the hub gimbal is also the jettison plane',
      'the sail shadows the payload during the boost: arrays on a sail version are not counted at full flux while the beam is on',
      'beam pointing: six rim retroreflectors and beacons give the station the film edge; the station tracks the sail, not the hull'
    ]
  };
}

/* ------------------------------------------------------------------ *
 * The inventory of one class
 * ------------------------------------------------------------------ */

/**
 * Size a ship's systems. `mission` is { crew, days, stop, closure, pressurisedM3, dryHardwareKg,
 * hotelW, beta, frontalAreaM2, hullAreaM2, inertiaKgM2, isp, dishM, laserApertureM, power: 'rtg'|'reactor'|'solar'|'battery', solarAu }.
 * Returns the item list (kg, m3, W, source) and roll-ups the checks compare against the laws.
 */
export function inventoryFor(mission) {
  const m = { closure: CLOSURE.advanced, stop: false, pressurisedM3: 0, hotelW: null, isp: 320, dishM: 0, laserApertureM: 0, power: 'rtg', solarAu: 1, inertiaKgM2: 1, frontalAreaM2: 0.01, hullAreaM2: 0.1, dryHardwareKg: 0, years: 46, beta: 0.1, ...mission };
  const crew = m.crew ?? 0;
  const items = [];
  const push = (group, spec, extra = {}) => { if (!spec) return; items.push({ group, item: spec.name ?? spec.item, kg: spec.mass ?? spec.kg ?? 0, m3: spec.volumeM3 ?? spec.m3 ?? null, W: spec.power?.load ?? spec.powerW ?? spec.W ?? 0, genW: spec.power?.gen ?? 0, source: spec.source, spec, ...extra }); };

  /* crew systems */
  let consumables = null, eclss = null, shelter = null, fittings = null;
  if (crew > 0) {
    consumables = consumablesFor({ crew, days: m.days, closure: m.closure, pressurisedM3: m.pressurisedM3 });
    eclss = eclssFor({ crew, closure: m.closure });
    for (const c of consumables.items) items.push({ group: 'consumables', item: c.item, kg: c.kg, m3: c.m3, W: 0, source: c.source });
    items.push({ group: 'life support', item: 'ECLSS hardware (' + eclss.items.length + ' functions)', kg: eclss.hardwareKg, m3: eclss.hardwareKg / 300, W: eclss.hardwareW, source: eclss.source });
    if (eclss.greenhouse) items.push({ group: 'life support', item: `greenhouse, ${eclss.greenhouse.areaM2.toFixed(0)} m2`, kg: eclss.greenhouse.mass, m3: eclss.greenhouse.areaM2 * 2.4, W: eclss.greenhouse.powerW, source: eclss.greenhouse.source });
    push('gas storage', copvSpec({ gasKg: consumables.gasKg.o2, gasKind: 'O2', name: 'O2 high-pressure tanks' }));
    push('gas storage', copvSpec({ gasKg: consumables.gasKg.n2, gasKind: 'N2', name: 'N2 high-pressure tanks' }));
    push('water storage', tankSpec({ volumeM3: consumables.waterKg / 1000, pressurePa: 150e3, ldRatio: 1.2, name: 'water tanks (bladder, also the storm-shelter wall)', contentsKg: consumables.waterKg }));
    fittings = crewFittingsSpec({ crew, days: m.days });
    for (const f of fittings.items) items.push({ group: 'crew fittings', item: f.item, kg: f.kg, m3: f.kg / 250, W: 0, source: f.source });
    shelter = stormShelterSpec({ crew, waterFromStores: true });
    push('radiation', shelter);
  }

  /* power */
  const hotelW = m.hotelW ?? (crew > 0 ? crew * HOTEL_W_PER_PERSON + (eclss?.hardwareW ?? 0) + (eclss?.greenhouse?.powerW ?? 0) : m.busW ?? 20);
  let powerSpec = null;
  if (m.power === 'none') powerSpec = null;
  else if (m.power === 'reactor') powerSpec = reactorSpec({ powerWe: hotelW * 1.25 });
  else if (m.power === 'rtg') powerSpec = rtgSpec({ powerW: hotelW * 1.2, yearsToEOL: m.years });
  else if (m.power === 'solar') powerSpec = solarArraySpec({ powerW: hotelW * 1.3, fluxWm2: 1361 / m.solarAu ** 2 });
  if (powerSpec) push('power', powerSpec);
  push('power', powerStoreSpec({ energyWh: hotelW * (m.power === 'solar' ? 1.5 : 0.5), busW: hotelW }));

  /* thermal: everything the hotel load dissipates leaves through radiators at 300 K (crew) or the reactor's own */
  { const est = hotelW / 600; push('thermal', radiatorSpec({ heatW: hotelW, tempK: crew > 0 ? 290 : 320, maxLengthM: Math.min(120, Math.max(15, Math.sqrt(est) / 2)), maxWidthM: Math.min(30, Math.max(6, Math.sqrt(est) / 8)), name: 'hotel-load radiators' })); }
  push('thermal', { name: 'MLI over the hull', mass: m.hullAreaM2 * 0.5, source: '20-layer MLI, 0.5 kg/m2' });

  /* shielding */
  push('MMOD', whippleSpec({ areaM2: m.hullAreaM2, kind: crew > 0 ? 'stuffed' : 'plain' }));
  push('MMOD', dustShieldSpec({ areaM2: m.frontalAreaM2, beta: m.beta }));

  /* GNC, attitude, comms */
  push('GNC', gncSpec({ crewed: crew > 0, scale: Math.min(5, Math.max(0.15, Math.cbrt(Math.max(m.dryHardwareKg, 1) / 1000))) }));
  push('GNC', attitudeStoreSpec({ inertiaKgM2: m.inertiaKgM2 }));
  if (m.dishM > 0) push('comms', dishSpec({ d: m.dishM }));
  if (m.laserApertureM > 0) push('comms', laserCommSpec({ apertureM: m.laserApertureM }));

  /* RCS + trim/braking stage from the delta-v budget */
  const dv = deltaVBudget({ years: m.years, stop: m.stop });
  const hwKg = items.reduce((s, i) => s + i.kg, 0) + m.dryHardwareKg;
  /* RCS authority: 5 mN per kg of ship in total (ISS ~0.3 mN/kg, Dragon ~700 mN/kg), split over quads
     of at most 25 kN (large bipropellant thrusters), never fewer than two quads. */
  const totalRcsN = Math.max(0.5, hwKg * 0.005);
  const rcsQuads = Math.max(2, Math.min(16, 2 * Math.ceil(totalRcsN / 25e3 / 2)));
  const quad = rcsQuadSpec({ thrustN: totalRcsN / rcsQuads });
  items.push({ group: 'RCS', item: `${rcsQuads} RCS quads, ${(quad.thrustN).toPrecision(2)} N each`, kg: quad.mass * rcsQuads, W: 20 * rcsQuads, source: quad.source, spec: quad, count: rcsQuads });
  /* A magsail sheds the cruise speed where the mission stops: a superconducting loop that brakes on
     the interstellar medium and the destination's wind, 10 % of the decelerated mass (Zubrin &
     Andrews 1991 magsail; Perakis & Hein 2016 magsail + electric sail deceleration). The chemical
     stage then does the residual. */
  if (m.stop) items.push({ group: 'propulsion', item: 'magsail deceleration loop and coil drum', kg: 0.10 * (hwKg + quad.mass * rcsQuads), W: 0, source: 'Derived: 10 % of decelerated mass (Zubrin & Andrews 1991; Perakis & Hein 2016)' });
  const magKg = m.stop ? 0.10 * (hwKg + quad.mass * rcsQuads) : 0;
  const stage = kickStageSpec({ shipDryKg: hwKg + quad.mass * rcsQuads + magKg, dvMs: dv.totalMs, isp: m.isp });
  items.push({ group: 'propulsion', item: `trim/braking stage, ${dv.totalMs.toFixed(0)} m/s`, kg: stage.mass, m3: stage.tank?.envelopeM3 ?? null, W: 0, source: stage.source, spec: stage, propellantKg: stage.propKg });

  /* spares */
  const yrs = m.days / 365.25;
  const sparesFrac = Math.min(SPARES.max, SPARES.base + Math.max(0, yrs - 10) * SPARES.perYearBeyond10);
  const dryHw = items.filter((i) => i.group !== 'consumables' && i.group !== 'propulsion').reduce((s, i) => s + i.kg, 0) + m.dryHardwareKg;
  items.push({ group: 'spares', item: `spares and maintenance stock, ${(sparesFrac * 100).toFixed(0)} % of dry hardware`, kg: dryHw * sparesFrac, m3: (dryHw * sparesFrac) / 400, W: 0, source: `${SPARES.base * 100} % of dry hardware + ${SPARES.perYearBeyond10 * 100} %/yr beyond 10 years (ISS ORU experience 1-2 %/yr), capped at ${SPARES.max * 100} %` });

  const mass = items.reduce((s, i) => s + i.kg, 0);
  const loadW = items.reduce((s, i) => s + (i.W ?? 0), 0);
  const genW = items.reduce((s, i) => s + (i.genW ?? 0), 0);
  return {
    mission: m, crew, items, mass, consumables, eclss, shelter, fittings, hotelW, loadW, genW, deltaV: dv, stage, powerSpec,
    volumePerPersonM3: crew > 0 ? m.pressurisedM3 / crew : null,
    volumeNeededM3: crew > 0 ? crew * (m.days > 365 ? VOLUME_PER_PERSON_M3.permanent : m.days > 60 ? VOLUME_PER_PERSON_M3.long : VOLUME_PER_PERSON_M3.short) : 0,
    storesM3: consumables?.storesM3 ?? 0
  };
}

/** A derived part for a group of inventory items that physically occupy one body (stores module, systems bay). */
export function inventoryPart({ name, kind, items, dims, origin, ports, volume, power, heat, source, extra = {} }) {
  const mass = items.reduce((s, i) => s + i.kg, 0);
  return {
    name, kind, dataQuality: 'derived', source: source ?? 'Derived: parts/inventory.js, see items',
    dims, origin, mass,
    volume: volume ?? { pressurised: null, habitable: null },
    crew: 0,
    power: power ?? { gen: items.reduce((s, i) => s + (i.genW ?? 0), 0), load: items.reduce((s, i) => s + (i.W ?? 0), 0) },
    heat: heat ?? { rejectCapacity: null },
    inventory: items.map((i) => ({ item: i.item, kg: i.kg, m3: i.m3 ?? null, W: i.W ?? 0, source: i.source })),
    ports,
    ...extra
  };
}

export { massOf, G0, DAY };
