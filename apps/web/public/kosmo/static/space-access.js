// space-access.js -- first-order mass, delta-v and cost model for the cheapest, lightest way to get
// to orbit, the Moon and Mars, and for sizing the vessels that make the trip. Pure functions, no DOM,
// so it runs in node (see space-access.test.mjs) and in space-access.html.
//
// This is a STUB in the engineering sense: every number is order-of-magnitude, calibrated to a few
// historical vehicles (Falcon 9, Apollo LM, Saturn V) and tagged where it is a guess. The point is
// that the structure -- rocket equation, staging, losses, lift-gas balloons, spin gravity, life
// support, shielding -- is right, so each constant can be tightened without touching the logic.
//
// Honest headline (the tests pin it): a lighter-than-air platform cannot give orbital speed. Orbit is
// ~7.8 km/s sideways; a 30 km balloon is 0 km/s sideways and saves roughly 0.5 km/s of the ~9.3. That
// is worth it only because the rocket equation is exponential, and only for small vehicles. The big
// multipliers are elsewhere: reuse, orbital propellant depots, aerobraking and making propellant at
// the destination.

import { G0, WORLDS } from './ship-sim.js';
import { BODIES, CONST } from './worlds.js';

const PI = Math.PI, TAU = 2 * PI;
export const SUN_MU = CONST.GM_SUN, AU = CONST.AU;
export const MOON = { mu: BODIES.moon.mu, R: BODIES.moon.radius, a: BODIES.moon.semiMajorAxis };
const gSurf = W => W.mu / (W.R * W.R);

/* ===================================================================== */
/* 1. Orbital mechanics: the destinations                                  */
/* ===================================================================== */

export const vCirc = (mu, r) => Math.sqrt(mu / r);
export const visViva = (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a));

/** Hohmann transfer between circular coplanar orbits: both burns and the flight time. */
export function hohmann(mu, r1, r2) {
  const a = (r1 + r2) / 2;
  return {
    dv1: vCirc(mu, r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1),
    dv2: vCirc(mu, r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2))),
    tof: PI * Math.sqrt(a ** 3 / mu),
  };
}

/** Burn from a circular parking orbit of radius r onto (or from) a hyperbola with excess speed vinf.
 *  Oberth effect included: this is far less than vinf itself. */
export const hyperbolicBurn = (vinf, mu, r) => Math.sqrt(vinf * vinf + 2 * mu / r) - vCirc(mu, r);

/** Earth parking orbit -> Mars parking orbit (Hohmann, circular coplanar planets). */
export function marsTransfer({ leoAlt = 300e3, marsOrbitAlt = 250e3, marsR = WORLDS.mars.R } = {}) {
  const h = hohmann(SUN_MU, AU, 1.523679 * AU), E = WORLDS.earth, M = WORLDS.mars;
  return {
    vinfDepart: h.dv1, vinfArrive: h.dv2, tofDays: h.tof / 86400,
    tmi: hyperbolicBurn(h.dv1, E.mu, E.R + leoAlt),                 // trans-Mars injection
    capture: hyperbolicBurn(h.dv2, M.mu, marsR + marsOrbitAlt),     // propulsive capture, circular
    tei: hyperbolicBurn(h.dv2, M.mu, marsR + marsOrbitAlt),         // trans-Earth injection (same by symmetry)
  };
}

/** Earth parking orbit -> lunar transfer orbit. */
export function moonTransfer({ leoAlt = 200e3 } = {}) {
  const E = WORLDS.earth, r = E.R + leoAlt, a = (r + MOON.a) / 2;
  return { tli: visViva(E.mu, r, a) - vCirc(E.mu, r), tofDays: PI * Math.sqrt(a ** 3 / E.mu) / 86400 };
}

/* Constants that are not worth deriving here (patched-conic detail). Source: Apollo / Artemis budgets. */
export const REF = {
  loiCapture: 800,        // lunar orbit insertion after TLI, m/s
  lunarDescent: 1900,     // 100 km circular to touchdown, incl. hover, m/s
  lunarAscent: 1870,      // surface to 100 km circular, m/s  (we also compute it in ascentBudget)
  moonTei: 900,           // trans-Earth injection from lunar orbit, m/s
  marsEdlPropulsive: 700, // supersonic retropropulsion after aeroshell, m/s (guess: 500-1000)
  aerocapture: 100,       // clean-up burn after an aerocapture pass, m/s
  midCourse: 100,
};

/* ===================================================================== */
/* 2. The rocket equation and staging                                      */
/* ===================================================================== */

export const exhaustVelocity = isp => isp * G0;
export const massRatio = (dv, isp) => Math.exp(dv / exhaustVelocity(isp));

/** One stage: m0 / m_payload for a delta-v, Isp, and structure fraction eps = m_struct / (m_struct + m_prop).
 *  Infinite when the stage cannot reach the delta-v at all (the "tyranny" limit MR >= 1 + 1/k). */
export function stagePayloadRatio(dv, isp, eps) {
  const MR = massRatio(dv, isp), k = eps / (1 - eps), den = 1 + k - MR * k;
  if (den <= 0) return Infinity;
  return 1 + (1 + k) * (MR - 1) / den;
}

/** n identical stages sharing the delta-v equally (optimal when all stages have the same Isp and eps). */
export function launchStack({ dv, isp, eps, stages = 2, payload = 1 }) {
  const per = dv / stages, out = [];
  let above = payload, prop = 0, dry = 0;
  for (let i = 0; i < stages; i++) {
    const MR = massRatio(per, isp), k = eps / (1 - eps), den = 1 + k - MR * k;
    if (den <= 0) return { feasible: false, ratio: Infinity, payloadFraction: 0, stages: [] };
    const P = above * (MR - 1) / den, ms = k * P, m0 = above + P + ms;
    out.unshift({ m0, prop: P, struct: ms, dv: per });
    prop += P; dry += ms; above = m0;
  }
  return { feasible: true, ratio: above / payload, payloadFraction: payload / above, gross: above, prop, dry, stages: out };
}

/** Fewest-mass stage count (1..6) for a delta-v. Past ~3 the extra engines and plumbing aren't worth it. */
export function bestStageCount(dv, isp, eps, max = 6) {
  let best = null;
  for (let n = 1; n <= max; n++) { const s = launchStack({ dv, isp, eps, stages: n }); if (s.feasible && (!best || s.ratio < best.ratio)) best = { n, ...s }; }
  return best;
}

/* ===================================================================== */
/* 3. Ascent budget: how much delta-v a launch really costs                */
/* ===================================================================== */

// Loss coefficients, calibrated so the three reference ascents land on the historical numbers:
//   Earth ground launch 9.3-9.4 km/s, Moon 1.85-1.9 km/s, Mars 3.9-4.1 km/s.
// grav = k * g * t_burn where t_burn = (1 - 1/MR) * Isp * g0 / (TWR * g); k is the fraction of the burn
// spent fighting gravity (higher on Earth where the climb is steep before pitch-over).
const LOSS = {
  earth: { k: 0.65, drag: 150, steer: 250 },
  mars: { k: 0.45, drag: 50, steer: 100 },
  moon: { k: 0.27, drag: 0, steer: 30 },
};

/** Delta-v credit from starting in the air instead of on the pad (altitude h, forward speed v). */
export function assistCredit(W, { alt = 0, speed = 0 } = {}, g = gSurf(W)) {
  if (alt <= 0 && speed <= 0) return { total: 0, speed: 0, drag: 0, height: 0 };
  const L = LOSS[W.id], rho0 = W.rho(0) || 1, removed = rho0 > 0 ? 1 - Math.sqrt(Math.min(1, W.rho(alt) / rho0)) : 0;
  const dragCredit = L.drag * removed, heightCredit = 0.35 * Math.sqrt(2 * g * alt); // a third of the free-fall equivalent (the flatter climb is credited via k below)
  return { total: speed + dragCredit + heightCredit, speed, drag: dragCredit, height: heightCredit };
}

/**
 * Delta-v from rest on the surface (or from an assist platform) to a circular orbit.
 * `twr0` is the thrust-to-weight at ignition in local gravity; low values mean long burns and big gravity losses --
 * that is the price of the cheap, light, vacuum-only engines a balloon launch allows.
 */
export function ascentBudget({ world = 'earth', alt = 200e3, latDeg = 28.5, twr0 = 1.3, isp = 330, assist = null, eastward = true } = {}) {
  const W = WORLDS[world], g = gSurf(W), vc = vCirc(W.mu, W.R + alt);
  // Starting high, there is no steep climb through dense air, so the trajectory is flatter: k relaxes toward the vacuum value.
  const base = LOSS[world], dense = assist && assist.alt > 0 && W.rho(0) > 0 ? Math.pow(Math.min(1, W.rho(assist.alt) / W.rho(0)), 0.25) : 1;
  const L = { ...base, k: LOSS.moon.k + (base.k - LOSS.moon.k) * dense };
  const rot = eastward ? W.w * W.R * Math.cos(latDeg * PI / 180) : 0;
  let dv = vc - rot + L.drag + L.steer, grav = 0;
  for (let i = 0; i < 6; i++) {            // t_burn depends on the mass ratio, which depends on dv
    const MR = massRatio(dv, isp), t = (1 - 1 / MR) * isp * G0 / (twr0 * g);
    grav = L.k * g * t; dv = vc - rot + L.drag + L.steer + grav;
  }
  const credit = assist ? assistCredit(W, assist, g) : { total: 0, speed: 0, drag: 0, height: 0 };
  return { world, vc, rotation: rot, gravity: grav, drag: L.drag - credit.drag, steering: L.steer, credit, dv: Math.max(vc * 0.9, dv - credit.speed - credit.drag - credit.height), dvGround: dv };
}

/* ===================================================================== */
/* 4. Lighter-than-air launch platforms                                    */
/* ===================================================================== */

const GAS_MOLAR = { hydrogen: 2.016, helium: 4.003, hot_air: 28.96 * 0.75 }; // hot air ~ 100 C above ambient is a poor lift gas
const AIR_MOLAR = 28.96;
export const GASES = Object.keys(GAS_MOLAR);

/** Net lift per m^3 at altitude h for a zero-pressure balloon (gas at ambient pressure and temperature). */
export const liftPerM3 = (h, gas = 'hydrogen') => WORLDS.earth.rho(h) * (1 - GAS_MOLAR[gas] / AIR_MOLAR);

/**
 * Size a spherical zero-pressure balloon to float `load` kg (rocket + gondola + rigging) at `alt`.
 * sigma = envelope areal density kg/m^2 (0.03-0.05 thin PE film, 0.1+ for a rugged skin).
 * Returns radius, volume, envelope mass, fill volume at the ground, and whether it's buildable (< 2e6 m^3 is flown today).
 */
export function balloonFor({ load, alt = 30e3, gas = 'hydrogen', sigma = 0.05, ballast = 0.1 }) {
  const lift = liftPerM3(alt, gas);
  if (lift <= 0) return { feasible: false };
  // lift*V = load + sigma*A  with V = 4/3 pi r^3, A = 4 pi r^2 ; solve by bisection on r
  let lo = 0.5, hi = 1e5;
  const f = r => lift * (4 / 3) * PI * r ** 3 - (load + sigma * 4 * PI * r * r) * (1 + ballast);
  if (f(hi) < 0) return { feasible: false };
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  const r = hi, V = (4 / 3) * PI * r ** 3, area = 4 * PI * r * r, envelope = sigma * area;
  const groundFill = V * lift / liftPerM3(0, gas) / 1;   // same lift mass at sea level takes this much gas
  return { feasible: true, radius: r, volume: V, envelope, envelopeFraction: envelope / (load + envelope), groundFillVolume: V * WORLDS.earth.rho(alt) / WORLDS.earth.rho(0), lift, flown: V < 2e6 };
}

/** Highest altitude a balloon of radius r and skin sigma can float itself plus a load (it needs rho >= 3 sigma / r + load). */
export function floatCeiling({ radius, sigma = 0.05, load = 0, gas = 'hydrogen' }) {
  const V = (4 / 3) * PI * radius ** 3, A = 4 * PI * radius * radius, need = (load + sigma * A) / V / (1 - GAS_MOLAR[gas] / AIR_MOLAR);
  let h = 0;
  for (let z = 0; z <= 120e3; z += 250) { if (WORLDS.earth.rho(z) >= need) h = z; else break; }
  return h;
}

/* ===================================================================== */
/* 5. Launch architectures and cost per kg                                 */
/* ===================================================================== */

// Cost inputs are order-of-magnitude (2024 dollars): dry hardware per kg, propellant per kg, fixed ops per flight.
export const PROP_COST = { kerolox: 0.35, methalox: 0.30, hydrolox: 2.5, hypergolic: 20 }; // $/kg delivered mixture (guess)

export const ARCHITECTURES = [
  { id: 'ground-exp', name: 'Ground, 2-stage expendable (Falcon-9-ish)', alt: 0, speed: 0, isp: 320, eps: 0.06, stages: 2, twr0: 1.3, flights: 1, reuseDv: 0, dryCost: 700, prop: 'kerolox', ops: 5e6, assistCost: 0 },
  { id: 'ground-reuse', name: 'Ground, 2-stage booster reused', alt: 0, speed: 0, isp: 330, eps: 0.07, stages: 2, twr0: 1.3, flights: 20, reuseDv: 350, dryCost: 700, prop: 'methalox', ops: 1.5e6, assistCost: 0, upperExpended: true },
  { id: 'ground-ssto', name: 'Ground, single stage to orbit', alt: 0, speed: 0, isp: 360, eps: 0.07, stages: 1, twr0: 1.3, flights: 100, reuseDv: 600, dryCost: 700, prop: 'methalox', ops: 1e6, assistCost: 0 },
  { id: 'air-12km', name: 'Aircraft at 12 km, Mach 0.8 (Pegasus / Stratolaunch)', alt: 12e3, speed: 250, isp: 335, eps: 0.07, stages: 2, twr0: 1.1, flights: 1, reuseDv: 0, dryCost: 900, prop: 'kerolox', ops: 3e6, assistCost: 3e5 },
  { id: 'balloon-30km', name: 'Balloon at 30 km, vacuum-bell stages (rockoon)', alt: 30e3, speed: 0, isp: 345, eps: 0.07, stages: 2, twr0: 1.1, flights: 1, reuseDv: 0, dryCost: 700, prop: 'kerolox', ops: 1e6, assistCost: 2e5, balloon: true },
  { id: 'balloon-reuse', name: 'Balloon at 30 km, reusable lower stage', alt: 30e3, speed: 0, isp: 360, eps: 0.07, stages: 2, upperExpended: true, twr0: 1.1, flights: 50, reuseDv: 300, dryCost: 700, prop: 'methalox', ops: 5e5, assistCost: 2e5, balloon: true },
  { id: 'airship-40km', name: 'Stratospheric platform at 40 km (huge, slow to build)', alt: 40e3, speed: 0, isp: 360, eps: 0.07, stages: 2, upperExpended: true, twr0: 1.05, flights: 50, reuseDv: 300, dryCost: 700, prop: 'methalox', ops: 5e5, assistCost: 5e5, balloon: true },
];

/** Evaluate an architecture: delta-v, gross mass per kg of payload, cost per kg, and the balloon needed. */
export function evaluateArchitecture(a, { payload = 1000, latDeg = 28.5, orbitAlt = 200e3, refurb = 0.05 } = {}) {
  const asc = ascentBudget({ world: 'earth', alt: orbitAlt, latDeg, twr0: a.twr0, isp: a.isp, assist: a.alt || a.speed ? { alt: a.alt, speed: a.speed } : null });
  const dv = asc.dv + (a.reuseDv || 0);
  const stack = launchStack({ dv, isp: a.isp, eps: a.eps, stages: a.stages, payload });
  if (!stack.feasible) return { ...a, dv, ascent: asc, feasible: false, ratio: Infinity, perKg: Infinity };
  // expendable parts pay for themselves in one flight; the reused ones amortise over `flights`
  const reusedDry = a.upperExpended ? stack.stages.slice(0, -1).reduce((s, x) => s + x.struct, 0) : (a.flights > 1 ? stack.dry : 0);
  const spentDry = stack.dry - reusedDry;
  const perFlight = spentDry * a.dryCost + reusedDry * a.dryCost * (1 / a.flights + refurb) + stack.prop * PROP_COST[a.prop] + a.ops + a.assistCost;
  const lift = a.balloon ? balloonFor({ load: stack.gross, alt: a.alt }) : null;
  return { ...a, ascent: asc, dv, feasible: true, ...stack, payload, costPerFlight: perFlight, perKg: perFlight / payload, balloon: lift };
}

/* ===================================================================== */
/* 6. Beyond orbit: the mission ladder                                     */
/* ===================================================================== */

/** Legs for a one-way cargo run (LEO -> destination surface) with the options that matter. */
export function missionLegs(dest, { aerocapture = false, leoAlt = 300e3 } = {}) {
  if (dest === 'moon') {
    const m = moonTransfer({ leoAlt });
    return [{ name: 'Trans-lunar injection', dv: m.tli, isp: 380 }, { name: 'Lunar orbit insertion', dv: REF.loiCapture, isp: 360 }, { name: 'Landing', dv: REF.lunarDescent, isp: 360 }];
  }
  const m = marsTransfer({ leoAlt });
  return [
    { name: 'Trans-Mars injection', dv: m.tmi + REF.midCourse, isp: 380 },
    aerocapture ? { name: 'Aerocapture clean-up', dv: REF.aerocapture, isp: 360 } : { name: 'Mars orbit insertion', dv: m.capture, isp: 360 },
    { name: 'Entry and landing', dv: REF.marsEdlPropulsive, isp: 360 },
  ];
}

/** Initial mass in LEO per kg that lands, for a chain of burns each with its own tankage (staged). */
export function chainRatio(legs, eps = 0.08) {
  let r = 1; const rows = [];
  for (let i = legs.length - 1; i >= 0; i--) { const x = stagePayloadRatio(legs[i].dv, legs[i].isp, eps); r *= x; rows.unshift({ ...legs[i], ratio: x, cumulative: r }); }
  return { imleo: r, legs: rows };
}

/** What making propellant at the destination is worth: the return ship's propellant doesn't have to ride out. */
export function isruLeverage({ dest = 'mars', returnVehicleDry = 20e3, returnDv, isp = 360, eps = 0.08, aerocapture = true }) {
  const m = dest === 'mars' ? marsTransfer() : null, dv = returnDv ?? (dest === 'mars' ? 4100 + m.tei : REF.lunarAscent + REF.moonTei);
  const prop = returnVehicleDry * (massRatio(dv, isp) - 1);
  const outbound = chainRatio(missionLegs(dest, { aerocapture }), eps).imleo;
  return { returnProp: prop, outboundRatio: outbound, imleoSavedIfMadeThere: prop * outbound, dv };
}

/* ===================================================================== */
/* 7. Vessels                                                              */
/* ===================================================================== */

const PER_DAY = { food: 0.8, o2: 0.84, water: 3.6 }; // kg per person-day (NASA baseline ~5.2 open loop)
export const consumables = ({ crew, days, recycle = 0 }) => crew * days * (PER_DAY.food + (PER_DAY.o2 + PER_DAY.water) * (1 - recycle));

/** Spin gravity: rpm and rim speed for a radius and target g. Comfort limit is ~2 rpm (4 rpm trained, higher gives vertigo). */
export function spin(radius, g = 1) {
  const w = Math.sqrt(g * G0 / radius);
  return { rpm: w * 60 / TAU, rimSpeed: w * radius, omega: w, comfortable: w * 60 / TAU <= 2, tetherRadius: radius };
}

/** Pressure hull: wall thickness and mass for a thin cylinder/sphere/torus tube of radius a at pressure P (Pa). */
export function hull({ radius, area, pressure = 101325, allowable = 250e6 / 2, density = 7850, safety = 1 }) {
  const t = pressure * radius * safety / allowable;
  return { thickness: t, massPerArea: t * density, mass: t * density * area };
}

/**
 * Size a crewed vessel from its mission: habitat + consumables + shielding + power + propulsion.
 * `spec` fields: crew, days, volPerPerson (m^3), hullDensity (kg per m^3 pressurised, 100-200 typical),
 * recycle, shield (kg/m^2 over the hab surface, 0 = none, 200 = water wall), kwPerPerson, kgPerKw,
 * cargo (kg), dv (m/s), isp, eps, spinG/spinRadius.
 */
export function sizeVessel(spec) {
  const s = { crew: 0, days: 0, volPerPerson: 0, hullDensity: 130, recycle: 0, shield: 0, kwPerPerson: 3, kgPerKw: 25, cargo: 0, dv: 0, isp: 360, eps: 0.08, spinG: 0, spinRadius: 0, ...spec };
  const vol = s.crew * s.volPerPerson, area = vol > 0 ? 4 * PI * (3 * vol / (4 * PI)) ** (2 / 3) : 0;
  const parts = {
    hab: vol * s.hullDensity,
    shielding: s.shield * area,
    life: consumables(s),
    power: s.crew * s.kwPerPerson * s.kgPerKw + (s.extraKw || 0) * s.kgPerKw,
    cargo: s.cargo,
    spinStructure: s.spinG && s.spinRadius ? 0.15 * vol * s.hullDensity : 0, // truss + counterweight, guess
  };
  const payload = Object.values(parts).reduce((a, b) => a + b, 0);
  const prop = s.dv > 0 ? stagePayloadRatio(s.dv, s.isp, s.eps) : 1;
  const gross = payload * prop;
  return { spec: s, volume: vol, area, parts, payload, gross, propulsionMass: gross - payload, ratio: prop, feasible: Number.isFinite(prop), spin: s.spinG ? spin(s.spinRadius, s.spinG) : null };
}

/** A stratospheric passenger balloon/airship: cabin + passengers + envelope -> lift gas volume. */
export function highAltitudeLiner({ pax = 8, alt = 30e3, gas = 'hydrogen', sigma = 0.05, cabinPerPax = 450 }) {
  const load = pax * cabinPerPax + 600;   // sealed cabin, seats, life support, parachute, ballast
  const b = balloonFor({ load, alt, gas, sigma });
  return { pax, alt, load, ...b };
}

/** Rotating torus habitat (Stanford torus): population, hull, shell and shield mass. */
export function torusHabitat({ majorRadius = 900, tubeRadius = 65, g = 1, shield = 4500, pressure = 50e3, allowable = 100e6, areaPerPerson = 100 }) {
  const area = 4 * PI * PI * majorRadius * tubeRadius, shellT = pressure * tubeRadius / allowable;
  const floor = 0.5 * area * 0.5, pop = floor / areaPerPerson; // half the tube skin is floor, half of that is livable
  return { spin: spin(majorRadius, g), area, shellThickness: shellT, shellMass: shellT * 7850 * area, shieldMass: shield * area, population: pop, totalMass: shellT * 7850 * area + shield * area };
}

/** Vessel catalogue: the ships the Space Access page sizes. */
export const VESSELS = [
  { id: 'rv-cislunar', kind: 'Motorhome', name: 'Cislunar motorhome', note: 'Four people, two weeks, Moon and back from LEO.', crew: 4, days: 14, volPerPerson: 25, recycle: 0.4, shield: 0, dv: 4600 + 800, isp: 380, eps: 0.08 },
  { id: 'rv-mars', kind: 'Motorhome', name: 'Mars transit motorhome', note: 'Six crew, 2 x 180 days, storm shelter only, aerocapture at Mars.', crew: 6, days: 420, volPerPerson: 30, recycle: 0.9, shield: 60, dv: 3700 + 100 + 2500, isp: 380, eps: 0.08 },
  { id: 'freight-chem', kind: 'Freight', name: 'Chemical freighter', note: '100 t to the Mars surface-orbit, aerocapture.', cargo: 100e3, dv: 3700 + 100 + 100, isp: 380, eps: 0.07, kwPerPerson: 0 },
  { id: 'freight-sep', kind: 'Freight', name: 'Solar-electric cargo tug', note: 'Slow (a year or more), Isp 3000 s, almost no propellant mass.', cargo: 100e3, dv: 5000, isp: 3000, eps: 0.25, extraKw: 400, kgPerKw: 15 },
  { id: 'personal-hopper', kind: 'Personal craft', name: 'Suborbital hopper', note: 'Two seats to 100 km and back, vertical Dv ~ sqrt(2 g h).', crew: 2, days: 0.05, volPerPerson: 2, hullDensity: 200, dv: Math.sqrt(2 * 9.81 * 100e3) + 600, isp: 300, eps: 0.12, kwPerPerson: 0.3 },
  { id: 'colony-ship', kind: 'Colony ship', name: 'Colony transit ship', note: '100 settlers, 200 days, Mars-gravity spin, water-wall shield.', crew: 100, days: 200, volPerPerson: 40, recycle: 0.95, shield: 200, dv: 3700 + 100 + 2500, isp: 450, eps: 0.1, spinG: 0.38, spinRadius: 100, kwPerPerson: 2 },
  { id: 'station', kind: 'Habitat', name: 'ISS-class orbital station', note: 'Seven crew, permanent, reboost only.', crew: 7, days: 365, volPerPerson: 130, recycle: 0.8, shield: 10, dv: 300, isp: 300, eps: 0.1, kwPerPerson: 15 },
];
