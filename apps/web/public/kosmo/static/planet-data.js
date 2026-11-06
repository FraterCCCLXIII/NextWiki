// planet-data.js — physical parameters for the planet layers. Radii in metres, B_eq is the equatorial surface field in tesla,
// scale heights in metres. Sources: NASA planetary fact sheets, Connerney (Jupiter, Saturn), Ness 1986/89 (Uranus, Neptune), Anderson 2011 (Mercury).
// `tint` and `kind` are starting points for the shaders, not measurements.
// Radii of the bodies in worlds.js are the NASA mean radii (BODIES.*.meanRadius): the visual planet layers draw spheres of that radius.
// The Earth `top` and the atmosphere `top` values below are drawing shells (haze height), not the sims' density cut-offs (worlds.js).
import { BODIES } from './worlds.js';

export const PLANETS = {
  mercury: { R: BODIES.mercury.meanRadius, mag: { Beq: 2.0e-7, tilt: 0, offset: 0.2 } },
  venus:   { R: BODIES.venus.meanRadius, atm: { kind: 'venus', H: 15.9e3, top: 90e3, tint: [0.95, 0.82, 0.5], pressureBar: 92, deck: { base: 48e3, top: 70e3 } } },   // induced magnetosphere only: not drawn as a dipole
  earth:   { R: BODIES.earth.meanRadius, atm: { kind: 'earth', H: 8.5e3, top: 100e3, tint: [0.35, 0.55, 1.0], pressureBar: 1.0, rayleigh: [5.8e-6, 13.5e-6, 33.1e-6], mie: 21e-6, mieG: 0.76 },
             mag: { Beq: 3.12e-5, tilt: 9.4, offset: 0, belts: { inner: [1.3, 2.6], outer: [3.6, 6.5] }, aurora: { oval: 67, color: [0.2, 1.0, 0.45], color2: [0.8, 0.2, 0.6] } } },
  mars:    { R: BODIES.mars.meanRadius, atm: { kind: 'mars', H: 11.1e3, top: BODIES.mars.atmoTop, tint: [0.85, 0.6, 0.4], pressureBar: 0.006, dust: 1, clouds: { type: 'ice', cover: 0.12 } } },
  jupiter: { R: 71492e3, atm: { kind: 'giant', H: 27e3, top: 500e3, tint: [0.85, 0.75, 0.6] },
             mag: { Beq: 4.28e-4, tilt: 9.6, offset: 0.1, belts: { inner: [1.5, 3.5], outer: [4, 12] }, aurora: { oval: 72, color: [0.55, 0.45, 1.0], color2: [0.9, 0.5, 1.0] } } },
  saturn:  { R: 60268e3, atm: { kind: 'giant', H: 59.5e3, top: 700e3, tint: [0.9, 0.8, 0.55] },
             mag: { Beq: 2.1e-5, tilt: 0, offset: 0.04, aurora: { oval: 75, color: [0.5, 0.6, 1.0], color2: [0.8, 0.5, 1.0] } } },
  uranus:  { R: 25559e3, atm: { kind: 'giant', H: 27.7e3, top: 600e3, tint: [0.55, 0.85, 0.9] },
             mag: { Beq: 2.28e-5, tilt: 58.6, offset: 0.3, aurora: { oval: 60, color: [0.4, 0.8, 1.0], color2: [0.7, 0.6, 1.0] } } },
  neptune: { R: 24764e3, atm: { kind: 'giant', H: 19.7e3, top: 600e3, tint: [0.3, 0.45, 1.0] },
             mag: { Beq: 1.42e-5, tilt: 46.9, offset: 0.55, aurora: { oval: 55, color: [0.4, 0.6, 1.0], color2: [0.6, 0.5, 1.0] } } },
  titan:   { R: 2574.7e3, atm: { kind: 'titan', H: 21e3, top: 600e3, tint: [0.95, 0.65, 0.25], pressureBar: 1.45 } },
};
// the layer profile for a model spec; unknown giants get a generic hydrogen atmosphere, unknown rocky bodies get none
export function profileFor(spec, kind) {
  const p = PLANETS[String(spec.name || '').toLowerCase()];
  if (p) return p;
  if (kind === 'gasgiant') return { R: spec.radius_m || 7e7, atm: { kind: 'giant', H: 30e3, top: 500e3, tint: [0.7, 0.75, 0.9] } };
  return null;
}
