/* beam.js -- laser-sail physics and the power station that drives it.

   No DOM, no Three.js: node checks import this (centauri-fleet.test.mjs) and the lab page uses the
   same functions, so the number on screen is the number under test.

   The sail model is the ideal retroreflector in one dimension. A mirror receding at beta reflects
   with a Doppler factor (1-beta)/(1+beta), so the momentum it takes per second is

       F = 2 P eta / (c (1 + beta))

   which gives F = 2P/c at rest and P/c as beta -> 1 (the photon-rocket limit). Energy closes:
   reflected power plus dE/dt equals the incoming power exactly. Integrating the equation of motion
   with d(beta)/dt = F / (m c gamma^3) has a closed form with k = 2 eta P / (m c^2):

       beta(t) = ((1 + k t)^2 - 1) / ((1 + k t)^2 + 1)
       x(t)    = (c/k) [ k t - 2 ( atan(1 + k t) - pi/4 ) ]
       t(beta) = [ sqrt((1+beta)/(1-beta)) - 1 ] / k

   so the time to a target speed fixes k and therefore the laser power. That is the measurement the
   fleet table is checked against.

   The station is sized from the power that has to arrive at the sail: beam coupling from diffraction,
   then laser wall-plug, PV efficiency and packing, collector areal mass, radiator at 450 K, and a
   phased-array aperture. The orbit trade scans solar distance and aperture and reports the minimum
   mass, which is what "optimal orbit" means here. */

export const C = 299792458; // m/s
export const AU = 1.495978707e11; // m
export const SOLAR_1AU = 1361; // W/m2, total solar irradiance
export const CRUISE_C = 0.1; // the fleet's cruise speed, fraction of c

/* Station assumptions. Each is a number a reviewer can argue with, so it is named here and printed
   on the page rather than buried in a formula. */
export const ETA_LASER = 0.5; // wall-plug of a diode-pumped solid-state / fibre amplifier chain
export const ETA_PV = 0.3; // space triple-junction, beginning of life
export const PACKING = 0.9; // cell packing and wiring on the collector
export const COLLECTOR_KG_M2 = 1.0; // gossamer concentrator + PV + harness, per m2 of collector
export const RADIATOR_KG_M2 = 8.8; // NASA CR-19940020352 (PVR class, with loop)
export const RADIATOR_W_M2 = 4200; // two-sided, emissivity 0.9, 450 K: 2 e sigma T^4
export const TX_KG_M2 = 5.0; // phased-array aperture incl. emitters and cooling, per m2
export const TX_MAX_D = 1e5; // 100 km aperture: the buildability cap this lab applies
export const AREA_MAX = 1e9; // m2 of any one structure (1,000 km2) before it is called infeasible
export const COUPLING_MIN = 1e-3; // a spot more than ~30x the sail is not a driver
export const DEFAULT_LAMBDA = 1.06e-6; // m, Nd:YAG / Yb:YAG class

/* ------------------------------------------------------------------ *
 * Sail dynamics
 * ------------------------------------------------------------------ */

/** Thrust of an ideal retroreflecting sail receding at beta. At rest this is 2P/c; as beta -> 1 it
 *  tends to P/c, the photon-rocket limit. */
export function forceN(powerW, eta, beta) {
  return (2 * eta * powerW) / (C * (1 + beta));
}

/** k = 2 eta P / (m c^2), the rate constant of the closed form. */
export function kOf(powerW, massKg, eta = 0.9) {
  return (2 * eta * powerW) / (massKg * C * C);
}

/** The rate constant that reaches `betaTarget` in `t` seconds. */
export function kForBeta(betaTarget, t) {
  return (Math.sqrt((1 + betaTarget) / (1 - betaTarget)) - 1) / t;
}

/** Speed after t seconds at constant laser power. */
export function betaAtTime(powerW, massKg, eta, t) {
  const u = 1 + kOf(powerW, massKg, eta) * t;
  return (u * u - 1) / (u * u + 1);
}

/** Distance travelled while accelerating from rest to beta(t).
 *  The closed form subtracts two nearly equal numbers when k t is tiny, so for k t < 1e-3 the
 *  series x = c (k t^2 / 2 - k^2 t^3 / 6) is used instead; both come from the same integral. */
export function distanceAtTime(powerW, massKg, eta, t) {
  const k = kOf(powerW, massKg, eta);
  const u = k * t;
  if (u < 1e-3) return C * ((k * t * t) / 2 - (k * k * t * t * t) / 6);
  return (C / k) * (u - 2 * (Math.atan(1 + u) - Math.PI / 4));
}

/** Distance covered in a boost that ends at `betaTarget` after `t` seconds. Independent of power:
 *  the target sets k t, and the profile depends only on k t. */
export function travelAtBoost(t, betaTarget = CRUISE_C) {
  const k = kForBeta(betaTarget, t);
  return (C / k) * (k * t - 2 * (Math.atan(1 + k * t) - Math.PI / 4));
}

/** Laser power that reaches betaTarget in t seconds with a total mass m. */
export function requiredPowerFor({ massKg, tBoost, betaTarget = CRUISE_C, etaSail = 0.9 }) {
  return (kForBeta(betaTarget, tBoost) * massKg * C * C) / (2 * etaSail);
}

/** Kinetic energy at beta, which is what the beam had to deliver to the vehicle. */
export function kineticEnergy(massKg, betaTarget = CRUISE_C) {
  const gamma = 1 / Math.sqrt(1 - betaTarget * betaTarget);
  return (gamma - 1) * massKg * C * C;
}

/** The whole acceleration, sampled. Used for the plots and the checks. */
export function boostProfile({ powerW, massKg, etaSail = 0.9, tBoost, samples = 240, betaTarget = CRUISE_C }) {
  const out = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = (tBoost * i) / samples;
    out.push({
      t,
      beta: betaAtTime(powerW, massKg, etaSail, t),
      x: distanceAtTime(powerW, massKg, etaSail, t)
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Beam: diffraction, coupling, aperture
 * ------------------------------------------------------------------ */

/** Airy radius of a filled circular aperture, 1.22 lambda L / D. */
export function spotRadiusM(apertureM, lambda = DEFAULT_LAMBDA, rangeM) {
  return (1.22 * lambda * rangeM) / apertureM;
}

/** Fraction of the beam that lands inside the sail disc. A spot smaller than the sail is capped at 1
 *  (the rest of the beam misses the sail and is simply lost). */
export function couplingFor({ apertureM, lambda = DEFAULT_LAMBDA, rangeM, sailD }) {
  const sailR = sailD / 2;
  const spotR = spotRadiusM(apertureM, lambda, rangeM);
  if (!(spotR > 0) || !(sailR > 0)) return 0;
  if (spotR <= sailR) return 1;
  return (sailR / spotR) ** 2;
}

/** Aperture that puts `coupling` of the beam on a sail of diameter sailD at rangeM. */
export function apertureForCoupling({ lambda = DEFAULT_LAMBDA, rangeM, sailD, coupling = 0.9 }) {
  const sailR = sailD / 2;
  const wanted = sailR / Math.sqrt(Math.min(1, Math.max(coupling, 1e-12)));
  return (1.22 * lambda * rangeM) / wanted;
}

/* ------------------------------------------------------------------ *
 * Orbits
 * ------------------------------------------------------------------ */

/** Blackbody equilibrium temperature of a flat plate at r AU, from 278.5 K at 1 AU. Solar flux falls
 *  as 1/r^2 and radiative loss as T^4, so T falls as 1/sqrt(r). */
export function equilibriumK(rAu) {
  return 278.5 / Math.sqrt(rAu);
}

export function solarFlux(rAu) {
  return SOLAR_1AU / (rAu * rAu);
}

/** Orbits around Earth: the sail is launched from here, so the beam range is short at release. */
export const EARTH_ORBITS = [
  {
    id: 'sso', name: 'Dawn-dusk Sun-synchronous LEO', rAu: 1, standoffM: 1.5e6, continuous: true,
    note: 'Always in sunlight, 800 km up, short range to a sail released from Earth.'
  },
  {
    id: 'geo', name: 'Geostationary', rAu: 1, standoffM: 3.6e7, continuous: false,
    note: 'Continuous power except eclipse seasons, up to 70 min a day; 36,000 km of range.'
  },
  {
    id: 'l1', name: 'Earth-Sun L1 halo', rAu: 0.99, standoffM: 1.5e9, continuous: true,
    note: 'Never eclipsed, but 1.5 million km from a sail released at Earth.'
  }
];

/** Heliocentric candidates that respect a collector thermal limit. The sail is staged at the station,
 *  so the range is the standoff plus the boost track, not a trip from Earth. */
export function heliocentricOrbits(thermalLimitK = 500, step = 0.01) {
  const out = [];
  for (let r = 0.3; r <= 1.0001; r += step) {
    const rr = Number(r.toFixed(3));
    const thermalK = equilibriumK(rr);
    if (thermalK > thermalLimitK) continue;
    out.push({
      id: `helio-${rr.toFixed(2)}`, name: `Heliocentric ${rr.toFixed(2)} AU`, rAu: rr,
      standoffM: 1.5e6, continuous: true, thermalK,
      note: 'Sail staged at the station; the collector runs near its thermal limit.'
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Station sizing
 * ------------------------------------------------------------------ */

export function stationMass({ collectorAreaM2, radiatorAreaM2, apertureM }) {
  const collector = collectorAreaM2 * COLLECTOR_KG_M2;
  const radiator = radiatorAreaM2 * RADIATOR_KG_M2;
  const transmitter = Math.PI * (apertureM / 2) ** 2 * TX_KG_M2;
  const bus = 0.05 * (collector + radiator + transmitter);
  return { collectorKg: collector, radiatorKg: radiator, transmitterKg: transmitter, busKg: bus, totalMass: collector + radiator + transmitter + bus };
}

/**
 * One station on one orbit with one aperture. `deliveredW` is the power that must arrive at the
 * sail; everything upstream is sized from it.
 */
export function stationFor({
  deliveredW, sailD, tBoost, lambda = DEFAULT_LAMBDA, betaTarget = CRUISE_C, etaSail = 0.9,
  orbit, apertureM, thermalLimitK = 500
}) {
  const travelM = travelAtBoost(tBoost, betaTarget);
  const rangeM = orbit.standoffM + travelM;
  const coupling = couplingFor({ apertureM, lambda, rangeM, sailD });
  const pLaser = deliveredW / Math.max(coupling, 1e-12);
  const pElec = pLaser / ETA_LASER;
  const pSolar = pElec / (ETA_PV * PACKING);
  const flux = solarFlux(orbit.rAu);
  const collectorAreaM2 = pSolar / flux;
  const radiatorAreaM2 = Math.max(0, pSolar - pLaser) / RADIATOR_W_M2;
  const thermalK = equilibriumK(orbit.rAu);
  const mass = stationMass({ collectorAreaM2, radiatorAreaM2, apertureM });

  const reasons = [];
  if (thermalK > thermalLimitK) reasons.push(`collector at ${Math.round(thermalK)} K is above the ${thermalLimitK} K limit`);
  if (!orbit.continuous) reasons.push('power is interrupted by eclipses');
  if (coupling < COUPLING_MIN) reasons.push('the beam spot is more than ~30x the sail at the end of boost, so almost nothing lands on it');
  if (collectorAreaM2 > AREA_MAX) reasons.push(`collector is ${fmtArea(collectorAreaM2)}, above the ${fmtArea(AREA_MAX)} cap`);
  if (radiatorAreaM2 > AREA_MAX) reasons.push(`radiators are ${fmtArea(radiatorAreaM2)}, above the ${fmtArea(AREA_MAX)} cap`);
  if (apertureM > TX_MAX_D) reasons.push(`aperture is ${fmtLength(apertureM)}, above the 100 km cap`);

  return {
    orbit, apertureM, rangeM, travelM, coupling, pLaser, pElec, pSolar, flux, collectorAreaM2, radiatorAreaM2, thermalK,
    ...mass,
    feasible: reasons.length === 0,
    reasons
  };
}

/**
 * Scan solar distance and aperture for the cheapest station that still lands the beam. The aperture
 * has an optimum: a bigger one wastes structure, a smaller one wastes laser power and therefore
 * collector and radiator. The orbit has one too: solar flux sets collector area, but the thermal
 * limit stops you going closer than ~0.3 AU, and the radiator (set by laser power) does not care
 * where you are. Returns every row plus the best feasible one.
 */
export function orbitTrade(opts) {
  const thermalLimitK = opts.thermalLimitK ?? 500;
  const orbits = [...EARTH_ORBITS, ...heliocentricOrbits(thermalLimitK)];
  const rows = [];

  for (const orbit of orbits) {
    let best = null;
    for (let i = 0; i <= 96; i += 1) {
      const apertureM = 0.5 * Math.pow(TX_MAX_D / 0.5, i / 96);
      const station = stationFor({ ...opts, orbit, apertureM, thermalLimitK });
      if (!best || station.totalMass < best.totalMass) best = station;
    }
    rows.push(best);
  }

  rows.sort((a, b) => a.totalMass - b.totalMass);
  const feasible = rows.filter((r) => r.feasible);
  return { rows, best: feasible[0] ?? rows[0], hasFeasible: feasible.length > 0 };
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

function trim(v) {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return String(Number(v.toFixed(digits)));
}

export function fmtLength(m) {
  const a = Math.abs(m);
  if (a >= 1.495978707e11) return `${trim(m / AU)} AU`;
  if (a >= 1e3) return `${trim(m / 1e3)} km`;
  if (a >= 1) return `${trim(m)} m`;
  if (a >= 1e-2) return `${trim(m * 100)} cm`;
  return `${trim(m * 1e3)} mm`;
}

export function fmtArea(m2) {
  const a = Math.abs(m2);
  if (a >= 1e6) return `${trim(m2 / 1e6)} km2`;
  if (a >= 1) return `${trim(m2)} m2`;
  return `${trim(m2 * 1e4)} cm2`;
}

export function fmtPower(w) {
  const a = Math.abs(w);
  if (a >= 1e15) return `${trim(w / 1e15)} PW`;
  if (a >= 1e12) return `${trim(w / 1e12)} TW`;
  if (a >= 1e9) return `${trim(w / 1e9)} GW`;
  if (a >= 1e6) return `${trim(w / 1e6)} MW`;
  if (a >= 1e3) return `${trim(w / 1e3)} kW`;
  return `${trim(w)} W`;
}

export function fmtEnergy(j) {
  const a = Math.abs(j);
  if (a >= 1e21) return `${trim(j / 1e21)} ZJ`;
  if (a >= 1e18) return `${trim(j / 1e18)} EJ`;
  if (a >= 1e15) return `${trim(j / 1e15)} PJ`;
  if (a >= 1e12) return `${trim(j / 1e12)} TJ`;
  if (a >= 1e9) return `${trim(j / 1e9)} GJ`;
  if (a >= 1e6) return `${trim(j / 1e6)} MJ`;
  if (a >= 1e3) return `${trim(j / 1e3)} kJ`;
  return `${trim(j)} J`;
}

export function fmtMass(kg) {
  const a = Math.abs(kg);
  if (a >= 1e12) return `${trim(kg / 1e12)} Gt`;
  if (a >= 1e9) return `${trim(kg / 1e9)} Mt`;
  if (a >= 1e6) return `${trim(kg / 1e6)} kt`;
  if (a >= 1e3) return `${trim(kg / 1e3)} t`;
  if (a >= 1) return `${trim(kg)} kg`;
  if (a >= 1e-3) return `${trim(kg * 1e3)} g`;
  return `${trim(kg * 1e6)} mg`;
}
