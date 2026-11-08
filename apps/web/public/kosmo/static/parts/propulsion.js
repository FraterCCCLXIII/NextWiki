/* propulsion.js -- the Centauri fleet flown by onboard drives instead of a laser sail.

   The v1 ships are beam-riders: the film is the engine and the power station stays home. That is the
   only way to 0.1 c for a gram, but it is a bad fit for a 10 kt colony, because the beam has to grow
   with the square of the distance and the aperture with the mass. This module answers the other
   question: what would each class fly if it carried its own engine?

   Every drive below is a real programme or a published study, with its exhaust velocity and thrust,
   and the mission is the same relativistic rocket equation the sail lab uses:

     mass ratio  R = ((1 + b) / (1 - b)) ^ (c / 2 ve)
     so          b = (R^(2 ve / c) - 1) / (R^(2 ve / c) + 1)

   with `ve` the exhaust velocity, `b` the cruise speed as a fraction of c and R the wet/dry ratio.
   At ve << c this is Tsiolkovsky; at ve comparable to c it is the relativistic form the sail classes
   are compared against.

   No drive gets an unlimited mass ratio. R is capped at 20 (95 % of the ship is propellant), which
   is already past anything ever built -- a Saturn V stage is about 0.92 -- and the honest answer for
   a drive that cannot reach 0.1 c inside that budget is that it is an inner-system drive. That is
   what the lab prints, per class, instead of pretending.

   Pure functions, no DOM. Imported by fleet.js and the node checks. */

export const C = 299792458;
export const LY = 9.4607e15;
export const ROUTE_LY = 4.37;
export const G0 = 9.80665;
/** The mass ratio every variant is allowed: 95 % propellant, i.e. 5 % dry. */
export const R_CAP = 20;

/* The drives, as flown or as studied. `ve` is exhaust velocity in m/s, `thrustN` per module,
   `engineKg` the dry engine, `tankFraction` the tank and feed structure per kg of propellant, and
   `density` the propellant's bulk density as a liquid (liquid hydrogen at 70 kg/m3 is the painful
   one).

   `store` is how the propellant is carried -- a tank of liquid, or a magazine of solid pulse units --
   and `bulk` its bulk density in that form, so the envelope the model draws comes from a density
   rather than from a drawn size. `unitKg` is one pulse unit, where the drive has discrete units.

   `rejectFraction` is the share of jet power that has to be rejected as waste heat rather than
   leaving in the exhaust; it is an assumption, stated per drive, and the radiator is sized from it at
   1000 K two-sided. A pulse drive's plate carries most of its pulse energy away with the plasma, so
   its fraction is small; a reactor drive's shielding and loop losses are not. */
export const DRIVES = {
  pellet: {
    id: 'pellet', name: 'Beamed pellet stream', short: 'pellet beam', kind: 'beamed',
    ve: 0.1 * C, isp: (0.1 * C) / G0, thrustN: null, engineKg: 0.0005, tankFraction: 0, density: 0,
    store: 'coil', bulk: 0, ldRatio: 0, unitKg: null, rejectFraction: 0,
    source: 'Beamed pellet propulsion (magnetised pellet accelerator, NASA NIAC pellet-beam study): momentum arrives as a pellet stream, so there is no sail to diffract and no onboard propellant',
    note: 'The craft carries only a catching coil; the accelerator stays at home and the stream does not spread like a laser.',
    shortNote: 'no propellant, no aperture'
  },
  ion: {
    id: 'ion', name: 'Solar-electric ion (NEXT-C class)', short: 'ion', kind: 'electric',
    ve: 41.1e3, isp: 4190, thrustN: 0.236, engineKg: 13, tankFraction: 0.06, density: 1400,
    store: 'tank', bulk: 1400, ldRatio: 3, unitKg: null, rejectFraction: 0.5,
    source: 'NASA NEXT-C gridded ion thruster: 236 mN at 4.5 kW, Isp 4190 s (flight unit, DART)',
    note: 'Needs tens of kW of arrays and years of thrusting; the propellant is xenon at 1,400 kg/m3.',
    shortNote: 'inner-system drive'
  },
  ntr: {
    id: 'ntr', name: 'Nuclear thermal (NERVA class)', short: 'NTR', kind: 'thermal',
    ve: 8.83e3, isp: 900, thrustN: 333e3, engineKg: 10500, tankFraction: 0.03, density: 70,
    store: 'tank', bulk: 70, ldRatio: 6, unitKg: null, rejectFraction: 0.02,
    source: 'NERVA NRX/XE: 333 kN at Isp 900 s, 10.5 t engine (liquid hydrogen)',
    note: 'High thrust, low exhaust velocity: the mass ratio for 0.1 c is e^3400.',
    shortNote: 'high thrust, low exhaust velocity'
  },
  orion: {
    id: 'orion', name: 'Fission-pulse (Orion class)', short: 'Orion', kind: 'pulse',
    ve: 39.2e3, isp: 4000, thrustN: 1e6, engineKg: 20000, tankFraction: 0.02, density: 70,
    store: 'magazine', bulk: 1000, ldRatio: 2, unitKg: 150, rejectFraction: 5e-4,
    source: 'Project Orion: 4,000 s class fission pulse units, thrust averaged over the pulse train',
    note: 'A magazine of pulse units, a pusher plate and a shock absorber; the plate is the structure.',
    shortNote: 'pulse units, pusher plate'
  },
  dfd: {
    id: 'dfd', name: 'Direct fusion drive', short: 'fusion', kind: 'fusion',
    ve: 98.1e3, isp: 10000, thrustN: 100, engineKg: 12000, tankFraction: 0.02, density: 70,
    store: 'tank', bulk: 100, ldRatio: 6, unitKg: null, rejectFraction: 0.2,
    source: 'Princeton PFRC direct fusion drive study: 1-10 N per MW, Isp 10,000 s, D-He3',
    note: 'Modest thrust, so the boost is decades long even though the propellant load is small.',
    shortNote: 'high Isp, low thrust'
  },
  daedalus: {
    id: 'daedalus', name: 'Inertial-fusion pulse (Daedalus class)', short: 'Daedalus fusion', kind: 'fusion',
    ve: 0.033 * C, isp: (0.033 * C) / G0, thrustN: 7.5e6, engineKg: 40000, tankFraction: 0.02, density: 70,
    store: 'magazine', bulk: 500, ldRatio: 6, unitKg: null, rejectFraction: 2e-5,
    source: 'Project Daedalus (BIS, 1978): D-He3 inertial-confinement pellets, 10,000 km/s exhaust, two stages',
    note: 'The only studied drive that reaches 0.1 c inside a 20:1 mass ratio.',
    shortNote: 'two-stage inertial fusion'
  },
  pulse: {
    id: 'pulse', name: 'Fusion-pulse (Dyson class)', short: 'fusion pulse', kind: 'pulse',
    ve: 0.03 * C, isp: (0.03 * C) / G0, thrustN: 5e6, engineKg: 60000, tankFraction: 0.02, density: 70,
    store: 'magazine', bulk: 500, ldRatio: 3, unitKg: 500, rejectFraction: 2e-5,
    source: 'Freeman Dyson, Interstellar Transport (1968): fusion pulse units, 3 % c exhaust, 10 Mt-class ships',
    note: 'Scales up by adding pulse units, which is why it suits the colony and not the capsule.',
    shortNote: 'scales with pulse units'
  }
};

/** Which drive each class would actually fly. Small payloads are beamed because a drive cannot be
 *  scaled down; the heavy classes are pulse or fusion because a beam cannot be scaled up. */
export const DRIVE_FOR = {
  wafer: 'pellet',
  smallsat: 'pellet',
  instrument: 'ion',
  lander: 'ntr',
  capsule: 'orion',
  habitat: 'dfd',
  seed: 'daedalus',
  colony: 'pulse'
};

/** Mass ratio needed to reach `beta` at exhaust velocity `ve`. */
export function massRatioFor(ve, beta) {
  if (beta <= 0 || beta >= 1) throw new Error('beta must be between 0 and 1');
  return ((1 + beta) / (1 - beta)) ** (C / (2 * ve));
}

/** Cruise speed reached with mass ratio `R` at exhaust velocity `ve`. */
export function betaForMassRatio(ve, R) {
  if (R <= 1) return 0;
  const k = R ** ((2 * ve) / C);
  return (k - 1) / (k + 1);
}

/** Tank and structure mass for a propellant load, as a fraction of it. */
export const tankMassFor = (propKg, drive) => propKg * drive.tankFraction;

/* ------------------------------------------------------------------ *
 * Everything the stage is built from, from the propellant out
 * ------------------------------------------------------------------ */

/** Ullage: the store holds 8 % more than the propellant it carries, for boil-off and expansion. */
export const STORE_ULLAGE = 1.08;
/** The radiator limit, two-sided, the same 1000 K the sail film is checked against. */
export const RADIATOR_T_K = 1000;
export const SIGMA = 5.670374419e-8;
export const RADIATOR_FLUX = 2 * SIGMA * RADIATOR_T_K ** 4;
/** The thrust frame is sized by the load it carries: 1 kg of frame per 500 N of thrust, 50 kg floor. */
export const FRAME_KG_PER_N = 1 / 500;
export function frameMassFor(drive) {
  if (drive.kind === 'beamed') return 0;
  return Math.max(50, (drive.thrustN ?? 0) * FRAME_KG_PER_N);
}

/**
 * The propellant store, from its bulk density and a stated length/diameter ratio. A cylinder of
 * diameter d and length s d holds pi s d^3 / 4, so d = cbrt(4 u V / (pi s)) for volume V and ullage
 * u. The first cut set the diameter from the volume and then made the length 1.6 d, which drew 2.4
 * to 3.6 times the volume the propellant needs; the store now holds exactly V times the ullage.
 */
export function storeFor({ propKg, drive }) {
  if (!(drive.bulk > 0) || !(propKg > 0)) return { kind: drive.store, l: 0, d: 0, volumeM3: 0, unitKg: drive.unitKg ?? null, unitCount: null };
  const volumeM3 = propKg / drive.bulk;
  const s = drive.ldRatio || 3;
  const d = Math.cbrt((4 * STORE_ULLAGE * volumeM3) / (Math.PI * s));
  return {
    kind: drive.store, l: s * d, d, volumeM3,
    unitKg: drive.unitKg ?? null,
    unitCount: drive.unitKg ? propKg / drive.unitKg : null
  };
}

/**
 * The radiator, from the heat the drive has to get rid of: `rejectFraction` of jet power F ve / 2.
 * Four panels, two per side on booms, each sized so the pair spans no more of the stage than it has
 * to. This replaces `wetKg * 2`, which read kilograms as watts.
 */
export function radiatorFor({ thrustN, ve, drive, storeD, storeL }) {
  const jetW = thrustN ? (thrustN * ve) / 2 : 0;
  const heatW = jetW * drive.rejectFraction;
  const areaM2 = heatW / RADIATOR_FLUX;
  if (!(areaM2 > 0)) return { heatW: 0, areaM2: 0, widthM: 0, lengthM: 0, count: 0, perSide: 0 };
  const widthM = Math.max(0.6, Math.min(1.4 * (storeD / 2), areaM2 / 4 / Math.max(0.45 * storeL, 1e-6)));
  return { heatW, areaM2, widthM, lengthM: areaM2 / 4 / widthM, count: 4, perSide: 2 };
}

/**
 * Size one class's drive. `hullKg` is the assembled ship without the sail, mast or drive. Dry mass
 * includes the engine and the tanks, so the propellant follows from the wet/dry ratio:
 *
 *   dry = (hull + engine) / (1 - f (R - 1)),   prop = dry (R - 1)
 *
 * which is the closed form of "tanks are a fraction of the propellant they hold" and is why a high
 * mass ratio with a heavy tank fraction has no solution at all.
 */
export function planFor({ hullKg, drive, R = R_CAP, missionBeta = 0.1, staging = 1 }) {
  if (drive.kind === 'beamed') {
    const beta = missionBeta;
    /* Momentum arrives as pellets and every pellet ends up in the craft, so the mass that has to
       reach beta c is the hull plus the stream it has not caught yet:
         stream * 2 u = (hull + stream) * beta c   ->   stream = hull k / (1 - k),  k = beta c / 2 u
       Sizing the stream from the hull alone (the first cut) understated the wafer's stream by two. */
    const u = drive.ve;
    const kTrend = (beta * C) / (2 * u);
    const streamKg = kTrend < 0.98 ? (hullKg * kTrend) / (1 - kTrend) : Infinity;
    const stationJ = Number.isFinite(streamKg) ? 0.5 * streamKg * u * u : Infinity;
    const boostS = 0; // momentum is delivered at the stream rate, not modelled here
    const dims = { l: Math.max(0.4, 6 * Math.cbrt(hullKg / 1000)), d: Math.max(0.4, 4 * Math.cbrt(hullKg / 1000)) };
    return {
      drive, beamed: true, beta, hullKg, dryKg: hullKg, propKg: 0, wetKg: hullKg,
      massRatio: 1, streamKg, stationJ, thrustN: null, boostS, coastS: (ROUTE_LY * LY) / (beta * C),
      tripYears: (ROUTE_LY * LY) / (beta * C) / 3.156e7 + boostS / 3.156e7,
      closes: beta >= missionBeta * 0.95 && Number.isFinite(streamKg) && stationJ > 0,
      needsR: 1, staging: 1,
      dims,
      store: { kind: 'coil', l: 0, d: 0, volumeM3: 0, unitKg: null, unitCount: null },
      frame: { l: 0, kg: 0 }, bayL: 0, plateD: 0,
      heatW: 0, radiator: { heatW: 0, areaM2: 0, widthM: 0, lengthM: 0, count: 0, perSide: 0 },
      verdict: Number.isFinite(streamKg)
        ? `No propellant: ${(streamKg * 1000).toPrecision(3)} g of pellets at ${(u / C).toFixed(2)} c for a ${(hullKg * 1000).toPrecision(3)} g ship (the stream is the propellant, and it doubles the mass that has to reach cruise), ${(stationJ / 1e12).toPrecision(3)} TJ from the accelerator, and the craft crosses in ${((ROUTE_LY * LY) / (beta * C) / 3.156e7).toPrecision(3)} years with no aperture to focus.`
        : `No propellant and no solution: at ${(u / C).toFixed(2)} c the stream would have to carry more momentum than it can, so the coil cannot reach ${(beta * 100).toFixed(1)} % c.`
    };
  }

  /* A high mass ratio and a heavy tank fraction cannot coexist: at 6 % of the propellant, R = 20
     needs 114 % of the dry mass in tanks. The ratio is therefore capped by what the tankage allows,
     which is why the ion class ends up at 16:1 rather than the nominal 20:1. */
  const Reff = Math.min(R, 1 + 0.9 / Math.max(drive.tankFraction, 1e-6));
  const Rtotal = Reff ** staging;
  const denom = 1 - drive.tankFraction * (Rtotal - 1);
  const beta = betaForMassRatio(drive.ve, Rtotal);
  const routeM = ROUTE_LY * LY;
  if (denom <= 0.05) {
    return {
      drive, beamed: false, beta, hullKg, dryKg: NaN, propKg: NaN, wetKg: NaN, massRatio: Rtotal,
      thrustN: drive.thrustN, boostS: Infinity, tripYears: Infinity, closes: false,
      needsR: massRatioFor(drive.ve, missionBeta), staging,
      dims: { l: 1, d: 1 },
      store: { kind: drive.store, l: 0, d: 0, volumeM3: 0, unitKg: drive.unitKg ?? null, unitCount: null },
      frame: { l: 0, kg: 0 }, bayL: 0, plateD: 0,
      heatW: 0, radiator: { heatW: 0, areaM2: 0, widthM: 0, lengthM: 0, count: 0, perSide: 0 },
      verdict: `No solution: at ${(drive.tankFraction * 100).toFixed(0)} % tank fraction a ${Rtotal}:1 mass ratio needs more tank than ship.`
    };
  }
  /* The frame is part of the dry mass: a module cannot hang on nothing, and it is what carries the
     thrust into the hull's hardpoint. */
  const frameKg = frameMassFor(drive);
  const dryKg = (hullKg + drive.engineKg + frameKg) / denom;
  const propKg = dryKg * (Rtotal - 1);
  const wetKg = dryKg + propKg;
  const thrustN = drive.thrustN;
  const boostS = (wetKg * beta * C) / thrustN;
  const boostM = 0.5 * beta * C * boostS;
  const coastS = beta > 0 ? Math.max(0, routeM - boostM) / (beta * C) : Infinity;
  const tripYears = (boostS + coastS) / 3.156e7;
  /* Where the propellant actually goes: a liquid tank or a pulse-unit magazine, sized from its bulk
     density, and the radiators from the jet power the drive cannot send out of the nozzle. */
  const store = storeFor({ propKg, drive });
  const rS = store.d / 2;
  const frameL = Math.max(0.8, Math.min(12, 0.4 * store.d));
  const bayL = drive.store === 'magazine' ? Math.max(0.6, 0.35 * store.d) : Math.max(0.35, 0.22 * store.d);
  /* A pulse drive's plate is its nozzle: the plasma hits it, so it stands off the magazine on the
     shock absorbers and it is wider than the store. */
  const plateD = drive.store === 'magazine' ? 1.45 * store.d : store.d;
  const radiator = radiatorFor({ thrustN, ve: drive.ve, drive, storeD: store.d, storeL: store.l });
  /* The criterion is a century to 4.37 ly, not exactly 0.1 c: a drive that gets there in 76 years at
     0.09 c has closed the mission, and one that takes 4,600 years has not. */
  const closes = tripYears > 0 && tripYears <= 100;
  return {
    drive, beamed: false, beta, hullKg, dryKg, propKg, wetKg, massRatio: Rtotal,
    thrustN, boostS, coastS, tripYears, closes,
    needsR: massRatioFor(drive.ve, missionBeta), staging,
    dims: { l: frameL + store.l + bayL, d: Math.max(plateD, store.d) },
    store, frame: { l: frameL, kg: frameKg }, bayL, plateD, radiator, heatW: radiator.heatW,
    volumeM3: store.volumeM3,
    verdict: closes
      ? `${drive.short} gives ${(beta * 100).toFixed(1)} % c at a ${Rtotal.toFixed(0)}:1 mass ratio: ${(wetKg / 1000).toPrecision(3)} t wet, ${(propKg / 1000).toPrecision(3)} t of ${drive.store === 'magazine' ? 'pulse units' : 'propellant'}, ${tripYears.toPrecision(3)} years to 4.37 ly.`
      : `${drive.short} gives ${(beta * 100).toPrecision(2)} % c at a ${Rtotal.toFixed(0)}:1 mass ratio, a ${tripYears.toPrecision(3)}-year crossing: an inner-system drive. 10 % c would need ${massRatioFor(drive.ve, missionBeta).toExponential(2)}:1.`
  };
}

/** The same trade for every drive on one class: used by the docs and the lab table. */
export function driveTrade({ hullKg, drives = Object.values(DRIVES), R = R_CAP }) {
  return drives.map((drive) => planFor({ hullKg, drive, R }));
}
