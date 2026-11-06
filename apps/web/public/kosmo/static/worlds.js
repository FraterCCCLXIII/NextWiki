// worlds.js -- the one table of body and physical constants for the Kosmographica sims (M0).
// ES module: loads in the browser (import, or <script type="module">) and in node (import './worlds.js').
// Sources, radius convention and how to add a body: see WORLDS.md next to this file.
//
// Radius convention (read before using a radius):
//   radius      the sphere radius the point-mass sims use: ship-sim, landing-sim, space-access, flight/physics,
//               flight/trips, flight/map3d, flight/bodies-iau. Earth: WGS 84 equatorial. Mars and Mercury: mean.
//   meanRadius  the mean radius of the NASA fact sheets. Visual planet layers only (planet-data.js, universe-timeline).
//   iauEquatorial  IAU 2015 equatorial radius where it differs from `radius` (orientation only, not used for gravity).
// Changing a radius changes g = mu / R^2 and every altitude, so a change here is a physics change: run the tests.

/** Fundamental and defined constants (SI). */
export const CONST = {
  G: 6.67430e-11,            // m^3 kg^-1 s^-2, CODATA 2018
  G0: 9.80665,               // m/s^2, standard gravity (defined value)
  C: 299792458,              // m/s, speed of light (defined)
  AU: 1.495978707e11,        // m, astronomical unit (IAU 2012, defined)
  GM_SUN: 1.32712440018e20,  // m^3/s^2, solar GM (IAU 2015 nominal)
  P_SL: 101325,              // Pa, standard sea-level pressure (defined)
  RHO_AIR_SL: 1.225,         // kg/m^3, sea-level air density (US Std 1976)
  R_AIR: 287.05287,          // J/(kg K), specific gas constant of dry air (US Std 1976)
  GAMMA_AIR: 1.4,            // ratio of specific heats of air below about 90 km
};

/**
 * US Standard Atmosphere 1976, geometric altitude (m) -> density (kg/m^3) and speed of sound (m/s).
 * Density rows: the sim's original table (1976 values, NOAA-S/T 76-1562) with the 400 km and 600 km rows added.
 * Checked against the 1976 SI table (https://www.pdas.com/bigtables.html, Table 1): every row agrees within 1 %
 * except 90 km, which is 0.7 % low. Speed of sound c = sqrt(gamma R T) from the 1976 temperature profile
 * (Table 1 c column for 0 to 600 km). The old sim rows at 71, 86 and 120 km were wrong (314, 284, 340 m/s).
 */
const US76_RHO = [[0, 1.225], [5e3, 0.7364], [10e3, 0.4135], [15e3, 0.1948], [20e3, 0.08891], [25e3, 0.04008], [30e3, 0.01841],
  [40e3, 0.003996], [50e3, 1.027e-3], [60e3, 3.097e-4], [70e3, 8.283e-5], [80e3, 1.846e-5], [90e3, 3.416e-6], [100e3, 5.604e-7],
  [120e3, 2.222e-8], [150e3, 2.076e-9], [200e3, 2.541e-10], [300e3, 1.916e-11], [400e3, 2.803e-12], [500e3, 5.215e-13], [600e3, 1.137e-13]];
const US76_C = [[0, 340.3], [10e3, 299.5], [11e3, 295.1], [20e3, 295.1], [32e3, 303.2], [47e3, 329.8], [51e3, 329.8], [71e3, 293.7],
  [80e3, 282.5], [85e3, 275.5], [90e3, 274.0], [100e3, 280.0], [120e3, 380.4], [150e3, 504.9], [200e3, 586.0], [400e3, 632.6],
  [600e3, 633.9], [1000e3, 634.0]];

/**
 * The body table. Every number a sim reads about a body comes from here.
 * Atmosphere models: 'table' (US76_RHO/US76_C, log-interpolated density, top = density cut-off),
 * 'exp' (rho0 exp(-h/H), cut off above `top` if given), 'none'.
 * atmoTop is the orbit-insertion clearance altitude used by ship-sim (and shipyard for drawing the air shell).
 */
export const BODIES = {
  earth: {
    name: 'Earth', mu: 3.986004418e14, w: 7.292115e-5, J2: 1.08262668e-3,   // GM (WGS 84 / EGM2008), sidereal rate
    radius: 6378137, meanRadius: 6371000, polarRadius: 6356752,              // WGS 84 equatorial; NASA mean; IAU polar
    surfaceGravityNominal: 9.80665,
    atmosphere: { model: 'table', rho: US76_RHO, sound: US76_C, gamma: 1.4, top: 600e3, scaleHeight: { rho0: 1.225, H: 8500 } },
    atmoTop: 150e3,   // orbit clearance, not the density cut-off (density is 2e-9 kg/m^3 here, see atmosphere.top)
    textures: 'Earth',
  },
  moon: {
    name: 'Moon', mu: 4.9028001e12, w: 2 * Math.PI / (27.321661 * 86400), J2: 2.032e-4,
    radius: 1737400, meanRadius: 1737400, polarRadius: 1737400,
    surfaceGravityNominal: 1.62,
    semiMajorAxis: 384400e3,        // mean Earth-Moon distance (space-access transfers)
    atmosphere: { model: 'none' },  // sound 300 m/s is nominal only; density is zero
    atmoTop: 0,
    textures: 'Moon',
  },
  mars: {
    name: 'Mars', mu: 4.282837e13, w: 7.0882e-5, J2: 1.96045e-3,
    radius: 3389500, meanRadius: 3389500, polarRadius: 3376200, iauEquatorial: 3396190,
    surfaceGravityNominal: 3.72076,
    // Exponential model, density cut off above 120 km. atmoTop is the same 120 km (it was 80 km: density at 80 km is
    // 1.5e-5 kg/m^3 and at 100 km 2.5e-6, so the old 80 km clearance sat inside a model that still had air).
    atmosphere: { model: 'exp', rho0: 0.020, H: 11100, top: 120e3, sound: 240, gamma: 1.29 },
    atmoTop: 120e3,
    textures: 'Mars',
  },
  // Data only: not simulated by ship-sim or landing-sim. Used by flight/physics.js and flight/trips.js.
  mercury: {
    name: 'Mercury', mu: 2.20319e13, w: 2 * Math.PI / (58.646 * 86400),
    radius: 2439700, meanRadius: 2439700, polarRadius: 2438260, iauEquatorial: 2440530,
    atmosphere: { model: 'none' }, atmoTop: 0, textures: 'Mercury',
  },
  venus: {
    name: 'Venus', mu: 3.24859e14, w: -2 * Math.PI / (243.025 * 86400),
    radius: 6051800, meanRadius: 6051800, polarRadius: 6051800,
    atmosphere: { model: 'exp', rho0: 65, H: 15900, sound: 300, gamma: 1.29 }, atmoTop: 0, textures: 'Venus',
  },
  titan: {
    name: 'Titan', mu: 8.9781e12, w: 2 * Math.PI / (15.945 * 86400),
    radius: 2574700, meanRadius: 2574700, polarRadius: 2574700,
    atmosphere: { model: 'exp', rho0: 5.3, H: 20000, sound: 200, gamma: 1.4 }, atmoTop: 0, textures: null,
  },
};

/** Linear or log-linear interpolation in a sorted [x, y] table; below the first row the first value, above the last zero (log) or last value. */
export function interp(tab, x, log) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) {
    const [x0, y0] = tab[i - 1], [x1, y1] = tab[i], f = (x - x0) / (x1 - x0);
    return log ? Math.exp(Math.log(y0) + f * (Math.log(y1) - Math.log(y0))) : y0 + f * (y1 - y0);
  }
  return log ? 0 : tab[tab.length - 1][1];
}

/**
 * The sim view of a body: { id, name, R, mu, w, rho(h), sound(h), gamma, atmoTop, surfaceGravity }.
 * This is the object ship-sim exports as WORLDS.<id>; the pages and tests read W.R, W.mu, W.w, W.rho, W.sound, W.gamma, W.atmoTop.
 */
export function makeWorld(id) {
  const b = BODIES[id];
  if (!b) throw new Error(`worlds.js: unknown body "${id}"`);
  const a = b.atmosphere;
  let rho, sound;
  if (a.model === 'table') {
    rho = h => (h > a.top ? 0 : interp(a.rho, h, true));
    sound = h => interp(a.sound, h, false);
  } else if (a.model === 'exp') {
    rho = h => (a.top != null && h > a.top ? 0 : a.rho0 * Math.exp(-h / a.H));
    sound = () => a.sound;
  } else {
    rho = () => 0;
    sound = () => 300;
  }
  return {
    id, name: b.name, R: b.radius, mu: b.mu, w: b.w, rho, sound,
    gamma: a.gamma ?? CONST.GAMMA_AIR, atmoTop: b.atmoTop,
    surfaceGravity: b.mu / (b.radius * b.radius),
  };
}
