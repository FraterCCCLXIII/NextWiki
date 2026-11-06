// Consistency checks for worlds.js (the body and constant table) and for every module that reads it.
// Run:  node worlds.test.mjs   (a few seconds, no network).  Exit code 1 on any failure.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { BODIES, CONST, makeWorld, interp } from './worlds.js';
import { WORLDS } from './ship-sim.js';
import { resolveVehicle } from './landing-sim.js';
import * as SA from './space-access.js';
import * as WS from './warp-sim.js';
import { PLANETS } from './planet-data.js';
import { UNITS } from './sim-physics.js';
import { BODIES as IAU } from './flight/bodies-iau.js';
import { BODIES as TRIPS } from './flight/trips.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const near = (name, a, b, tol) => check(name, Number.isFinite(a) && rel(a, b) <= tol, `${a} vs ${b}, rel ${(rel(a, b) * 100).toFixed(3)} %`);

const E = makeWorld('earth'), M = makeWorld('mars'), MO = makeWorld('moon');

// 1. Radii and gravity
check('every body has positive radius, mean radius and GM', Object.values(BODIES).every(b => b.radius > 0 && b.meanRadius > 0 && b.mu > 0));
check('Earth equatorial radius is WGS 84 (6378137 m)', BODIES.earth.radius === 6378137);
check('Earth mean radius is the NASA 6371 km used by the visual layers', BODIES.earth.meanRadius === 6371000);
check('Mars sims use the mean radius (3389.5 km), IAU equatorial is kept separately', BODIES.mars.radius === 3389500 && BODIES.mars.iauEquatorial === 3396190);
const gNominal = { earth: 9.80665, moon: 1.62, mars: 3.72076 };
for (const [id, g0] of Object.entries(gNominal)) {
  const g = makeWorld(id).surfaceGravity;
  check(`${id}: mu / R^2 within 0.5 % of nominal surface gravity`, rel(g, g0) < 0.005, `${g.toFixed(4)} vs ${g0}, ${(rel(g, g0) * 100).toFixed(2)} %`);
}

// 2. Earth atmosphere against the US Standard Atmosphere 1976 (SI table, https://www.pdas.com/bigtables.html, Table 1, geometric altitude)
const REF_RHO = { 0: 1.2250, 10e3: 4.1351e-1, 20e3: 8.8910e-2, 50e3: 1.0269e-3, 80e3: 1.8458e-5, 100e3: 5.6044e-7, 120e3: 2.2199e-8, 150e3: 2.0752e-9, 200e3: 2.5407e-10, 400e3: 2.8028e-12, 600e3: 1.1367e-13 };
for (const [h, r] of Object.entries(REF_RHO)) near(`Earth density at ${h / 1e3} km vs 1976 table`, E.rho(+h), r, 0.01);
const REF_C = { 0: 340.29, 10e3: 299.53, 20e3: 295.07, 50e3: 329.80, 80e3: 282.54, 100e3: 280.00, 120e3: 380.36, 150e3: 504.92, 200e3: 586.02, 400e3: 632.61, 600e3: 633.89 };
for (const [h, c] of Object.entries(REF_C)) near(`Earth sound speed at ${h / 1e3} km vs 1976 table`, E.sound(+h), c, 0.01);
near('Earth density at sea level is 1.225 kg/m^3', E.rho(0), 1.225, 0.001);
near('Earth sound speed at sea level is 340 m/s', E.sound(0), 340.3, 0.005);
const monotone = (w, top) => { let prev = Infinity, ok = true; for (let h = 0; h <= top; h += 1000) { const r = w.rho(h); if (r > prev || r < 0) { ok = false; break; } prev = r; } return ok; };
check('Earth density decreases monotonically from 0 to 600 km (1 km steps)', monotone(E, 600e3));
check('Mars density decreases monotonically from 0 to 120 km (1 km steps)', monotone(M, 120e3));
check('Earth density is zero above its 600 km table top', E.rho(600e3 + 1) === 0 && E.rho(600e3) > 0);
check('interp: log interpolation is exact at a midpoint of two decades', Math.abs(interp([[0, 1], [1, 100]], 0.5, true) - 10) < 1e-9);

// 3. Mars cut-off: one altitude for the density table and the atmosphere top
check('Mars atmoTop equals the density table top (120 km)', BODIES.mars.atmoTop === BODIES.mars.atmosphere.top && BODIES.mars.atmosphere.top === 120e3);
check('Mars density is zero just above atmoTop and positive just below it', M.rho(M.atmoTop + 1) === 0 && M.rho(M.atmoTop - 1) > 0);
check('ship-sim exports the same Mars atmoTop', WORLDS.mars.atmoTop === 120e3);
check('Earth orbit clearance (150 km) sits inside its 600 km density table', BODIES.earth.atmoTop <= BODIES.earth.atmosphere.top);
check('planet-data draws the Mars haze to the same top', PLANETS.mars.atm.top === BODIES.mars.atmoTop);

// 4. Every consumer reads the same numbers
for (const id of ['earth', 'moon', 'mars']) {
  const W = WORLDS[id], B = BODIES[id];
  check(`ship-sim WORLDS.${id} has worlds.js radius, GM and rotation`, W.R === B.radius && W.mu === B.mu && W.w === B.w, `R ${W.R}, mu ${W.mu}`);
}
const v = resolveVehicle({ vehicle: 'falcon9' });
check('landing-sim vehicles use the ship-sim WORLDS.earth object', v.W === WORLDS.earth && v.W.R === BODIES.earth.radius);
check('landing-sim gravity at the surface is mu / R^2 of worlds.js', Math.abs(v.W.mu / (v.W.R ** 2) - E.surfaceGravity) < 1e-12);
check('space-access MOON matches worlds.js moon', SA.MOON.mu === BODIES.moon.mu && SA.MOON.R === BODIES.moon.radius && SA.MOON.a === BODIES.moon.semiMajorAxis);
check('space-access AU and solar GM match CONST', SA.AU === CONST.AU && SA.SUN_MU === CONST.GM_SUN);
check('warp-sim C, G and AU match CONST', WS.C === CONST.C && WS.G === CONST.G && WS.AU === CONST.AU);
check('sim-physics standard gravity matches CONST.G0', UNITS.g0 === CONST.G0);
check('planet-data Earth radius is the mean radius', PLANETS.earth.R === BODIES.earth.meanRadius);
check('flight/bodies-iau Earth and Moon radii and GM match worlds.js', IAU.earth.a === BODIES.earth.radius && IAU.earth.gm === BODIES.earth.mu && IAU.moon.a === BODIES.moon.radius && IAU.moon.gm === BODIES.moon.mu);
check('flight/trips Earth and Mars match worlds.js', TRIPS.earth.R === BODIES.earth.radius && TRIPS.mars.R === BODIES.mars.radius && TRIPS.earth.mu === BODIES.earth.mu);

// 5. Classic-script flight files (not ES modules): read them in a sandbox and compare their own tables
const load = f => { const ctx = { module: { exports: {} }, console }; runInNewContext(readFileSync(new URL(f, import.meta.url), 'utf8'), ctx, { filename: f }); return ctx.module.exports; };
const P = load('./flight/physics.js').worlds;
for (const id of ['earth', 'moon', 'mars', 'mercury', 'venus', 'titan']) {
  const B = BODIES[id], p = P[id];
  check(`flight/physics.js ${id}: radius equals worlds.js`, p.R === B.radius, `${p.R}`);
  near(`flight/physics.js ${id}: GM within 1e-5 of worlds.js`, p.mu, B.mu, 1e-5);
  near(`flight/physics.js ${id}: rotation within 1e-5 of worlds.js`, p.w, B.w, 1e-5);
  const a = B.atmosphere;
  if (a.model === 'exp') { check(`flight/physics.js ${id}: scale-height air matches worlds.js`, p.rho === a.rho0 && p.H === a.H, `rho ${p.rho}, H ${p.H}`); }
  if (a.model === 'table') { check(`flight/physics.js ${id}: scale-height air matches worlds.js scaleHeight`, p.rho === a.scaleHeight.rho0 && p.H === a.scaleHeight.H, `rho ${p.rho}, H ${p.H}`); }
}
const MODEL = load('./flight/model.js');
near('flight/model.js: ME (km^3/s^2) is the Earth GM', MODEL.ME * 1e9, BODIES.earth.mu, 1e-9);
check('flight/model.js: RE (km) is the Earth equatorial radius', MODEL.RE * 1e3 === BODIES.earth.radius, `${MODEL.RE} km`);

// 6. Every body in the table is well formed
for (const id of Object.keys(BODIES)) {
  const w = makeWorld(id);
  check(`makeWorld(${id}) has the sim interface`, typeof w.rho === 'function' && typeof w.sound === 'function' && w.R > 0 && w.mu > 0 && w.gamma > 0);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exitCode = failed ? 1 : 0;
