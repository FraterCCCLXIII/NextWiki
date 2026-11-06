// Deterministic checks for the Orbital Flight Deck physics (static/flight/physics.js and
// bodies-iau.js). Run:  node flight-physics.test.mjs
//
// physics.js is a browser script that ends with `if (typeof module !== 'undefined') module.exports = API;
// else root.OrbitalPhysics = API`. Under this package's ESM setting `module` is undefined, so the
// test evaluates the file with a local `module` object. Nothing in the module is changed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as IAU from './flight/bodies-iau.js';

const here = dirname(fileURLToPath(import.meta.url));
const loadPhysics = () => {
  const module = { exports: {} };
  new Function('module', 'exports', readFileSync(join(here, 'flight', 'physics.js'), 'utf8'))(module, module.exports);
  return module.exports;
};
const P = loadPhysics();

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const norm = a => Math.hypot(...a);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const AU = 149597870700, SUN = 1.32712440018e20, DAY = 86400, G0 = 9.80665;
const EARTH = P.worlds.earth;

// 1. circular orbit period: integrate a circular heliocentric orbit and find the first return to the start angle
{
  const T = 2 * Math.PI * Math.sqrt(AU ** 3 / SUN);
  const r0 = [AU, 0, 0], v0 = [0, Math.sqrt(SUN / AU), 0];
  const run = P.propagate(r0, v0, 1.01 * T, undefined, 20000);
  let prev = null, unwrapped = 0, Tnum = NaN;
  for (const s of run.trace) {
    const th = Math.atan2(s.r[1], s.r[0]);
    if (prev) {
      let d = th - prev.th; if (d < -Math.PI) d += 2 * Math.PI; if (d > Math.PI) d -= 2 * Math.PI;
      const before = unwrapped; unwrapped += d;
      if (before < 2 * Math.PI && unwrapped >= 2 * Math.PI) { Tnum = prev.t + (s.t - prev.t) * (2 * Math.PI - before) / d; break; }
    }
    prev = { th, t: s.t };
  }
  const rel = Math.abs(Tnum - T) / T;
  check('circular orbit: integrated period matches 2π√(a³/μ) within 0.1 %', rel < 1e-3, `${(T / DAY).toFixed(4)} d expected, ${(Tnum / DAY).toFixed(4)} d integrated, ${(rel * 100).toExponential(2)} %`);
  check('circular orbit: after one period the radius is unchanged', Math.abs(norm(run.r) - AU) / AU < 1e-6, `|r| drift ${(Math.abs(norm(run.r) - AU) / AU).toExponential(2)}`);
}

// 2. vis-viva and energy conservation over one orbit of an eccentric heliocentric ellipse
{
  const r0 = [AU, 0, 0], vmag = 1.15 * Math.sqrt(SUN / AU), v0 = [0, vmag, 0];
  const el = P.orbitalElements(r0, v0, { mu: SUN, R: 0 });
  const T = 2 * Math.PI * Math.sqrt(el.a ** 3 / SUN);
  const run = P.propagate(r0, v0, T, undefined, 20000);
  const E = (r, v) => norm(v) ** 2 / 2 - SUN / norm(r);
  const E0 = E(r0, v0);
  let worst = 0, visViva = 0;
  for (const s of run.trace) {
    worst = Math.max(worst, Math.abs(E(s.r, s.v) - E0) / Math.abs(E0));
    const rv = norm(s.r), expect = Math.sqrt(SUN * (2 / rv - 1 / el.a));
    visViva = Math.max(visViva, Math.abs(norm(s.v) - expect) / expect);
  }
  check('vis-viva: specific energy conserved over one orbit to 1e-4', worst < 1e-4, `worst ${worst.toExponential(2)}`);
  check('vis-viva: v² = μ(2/r − 1/a) holds along the orbit to 1e-4', visViva < 1e-4, `worst ${visViva.toExponential(2)}`);
  const aExact = AU / (2 - 1.15 ** 2), eExact = Math.abs(1.15 ** 2 - 1);
  check('vis-viva: elements of the 1.15 v_circ ellipse match the analytic a and e', Math.abs(el.a - aExact) / aExact < 1e-9 && Math.abs(el.e - eExact) < 1e-9, `a ${(el.a / AU).toFixed(5)} AU vs ${(aExact / AU).toFixed(5)}, e ${el.e.toFixed(5)} vs ${eExact.toFixed(5)}`);
}

// 3. Lambert solver reproduces a Hohmann transfer (Earth to Mars, heliocentric, 1 AU to 1.523679 AU)
{
  const r1 = AU, r2 = 1.523679 * AU, a = (r1 + r2) / 2;
  const tH = Math.PI * Math.sqrt(a ** 3 / SUN);
  const vc1 = Math.sqrt(SUN / r1), vc2 = Math.sqrt(SUN / r2);
  const v1h = Math.sqrt(SUN * (2 / r1 - 1 / a)), v2h = Math.sqrt(SUN * (2 / r2 - 1 / a));
  const dv1 = v1h - vc1, dv2 = vc2 - v2h;
  check('Hohmann: transfer time is 259 days (known Earth-Mars value)', Math.abs(tH / DAY - 259) < 1, `${(tH / DAY).toFixed(2)} d`);
  check('Hohmann: Δv1 + Δv2 = 5.6 km/s (known Earth-Mars value)', Math.abs((dv1 + dv2) / 1e3 - 5.59) < 0.1, `${((dv1 + dv2) / 1e3).toFixed(3)} km/s`);
  // 179.9 degrees: a Lambert geometry needs a non-zero cross product, so a true 180 degree transfer is singular
  const th = 179.9 * Math.PI / 180;
  const L = P.lambert([r1, 0, 0], [r2 * Math.cos(th), r2 * Math.sin(th), 0], tH);
  const v1 = norm(L.v1), v2 = norm(L.v2);
  check('Lambert: departure speed on the Hohmann transfer ellipse (1e-4)', Math.abs(v1 - v1h) / v1h < 1e-4, `${v1.toFixed(2)} vs ${v1h.toFixed(2)} m/s`);
  check('Lambert: arrival speed on the Hohmann transfer ellipse (1e-4)', Math.abs(v2 - v2h) / v2h < 1e-4, `${v2.toFixed(2)} vs ${v2h.toFixed(2)} m/s`);
  check('Lambert: residual time of flight below 1 s', Math.abs(L.residualSeconds) < 1, `${L.residualSeconds.toExponential(2)} s`);
}

// 4. 3D ascent of a simple two-stage vehicle, then a coast with gravity only (no thrust, no drag)
const vehicle = { bodyId: 'earth', latitude: 28.5, longitude: -80.6, elevation: 0, azimuth: 90, targetAltitude: 200e3,
  pitchStart: 1000, pitchEnd: 60000, throttle: 1, minThrottle: 0.4, qLimit: 1e9, heatLimit: 1e12, gLimit: 100, turnRate: 3, engineLag: 0.5,
  payload: 1000, stages: [{ thrust: 1500, isp: 300, dry: 3000, prop: 40000 }, { thrust: 300, isp: 350, dry: 1000, prop: 9000 }],
  maxTime: 1500, dt: 0.25, seed: 1, cd: 0.3, area: 10, densityScale: 1, wind: 0, failureTime: -1, failureFraction: 0, navPosition: 0, latency: 0 };
{
  const r = P.ascent(vehicle);
  const vCirc = Math.sqrt(EARTH.mu / (EARTH.R + vehicle.targetAltitude));
  const speed = norm(r.final.v), perigee = r.orbit.perigee;
  check('ascent: reaches orbit-like speed (0.95 to 1.10 of circular at 200 km)', speed > 0.95 * vCirc && speed < 1.10 * vCirc, `${(speed / 1e3).toFixed(2)} km/s vs ${(vCirc / 1e3).toFixed(2)} km/s circular`);
  check('ascent: resulting orbit has perigee above 150 km and is bound', perigee > 150e3 && r.orbit.e < 0.5 && r.orbit.energy < 0, `perigee ${(perigee / 1e3).toFixed(0)} km, e ${r.orbit.e.toFixed(3)}`);
  check('ascent: mass bookkeeping closes (propellant burned = sum of prop)', Math.abs(r.mass - (1000 + 1000)) < 1e-3, `final mass ${r.mass.toFixed(3)} kg`);

  // coast: gravity only (densityScale 0 removes drag; the module's environment() gives gravity and drag)
  const noDrag = { ...vehicle, densityScale: 0 };
  let rr = r.final.r.slice(), vv = r.final.v.slice(), h0 = cross(rr, vv);
  const E0 = norm(vv) ** 2 / 2 - EARTH.mu / norm(rr);
  const acc = (x) => P.environment(x.r, x.v, 1000, noDrag, EARTH).accel;
  const step = (x, dt) => {
    const k1 = { r: x.v, v: acc(x) };
    const k2 = { r: x.v.map((q, i) => q + k1.v[i] * dt / 2), v: acc({ r: x.r.map((q, i) => q + k1.r[i] * dt / 2), v: x.v }) };
    const k3 = { r: x.v.map((q, i) => q + k2.v[i] * dt / 2), v: acc({ r: x.r.map((q, i) => q + k2.r[i] * dt / 2), v: x.v.map((q, i) => q + k2.v[i] * dt / 2) }) };
    const k4 = { r: x.v.map((q, i) => q + k3.v[i] * dt), v: acc({ r: x.r.map((q, i) => q + k3.r[i] * dt), v: x.v.map((q, i) => q + k3.v[i] * dt) }) };
    return { r: x.r.map((q, i) => q + dt / 6 * (k1.r[i] + 2 * k2.r[i] + 2 * k3.r[i] + k4.r[i])), v: x.v.map((q, i) => q + dt / 6 * (k1.v[i] + 2 * k2.v[i] + 2 * k3.v[i] + k4.v[i])) };
  };
  let x = { r: rr, v: vv }, hMax = 0, eMax = 0;
  for (let i = 0; i < 4000; i++) {
    x = step(x, 1);
    hMax = Math.max(hMax, norm(sub(cross(x.r, x.v), h0)) / norm(h0));
    eMax = Math.max(eMax, Math.abs((norm(x.v) ** 2 / 2 - EARTH.mu / norm(x.r)) - E0) / Math.abs(E0));
  }
  check('ascent coast: angular momentum conserved without thrust or drag (1e-9)', hMax < 1e-9, `max relative change ${hMax.toExponential(2)}`);
  check('ascent coast: orbital energy conserved without thrust or drag (1e-7)', eMax < 1e-7, `max relative change ${eMax.toExponential(2)}`);
}

// 5. mass flow: a constant thrust burn loses mass at thrust / (Isp g0)
{
  const thrust = 1e6, isp = 300, t = 10, m0 = 10000;
  const burn = P.propagate([AU, 0, 0], [0, 3e4, 0], t, { dv: [0, 0, 3000], thrust, isp, mass: m0 });
  const expected = m0 - thrust / (isp * G0) * t;
  check('mass flow: m_dot = thrust / (Isp g0) over a 10 s burn', Math.abs(burn.mass - expected) < 1e-6, `${burn.mass.toFixed(6)} kg vs ${expected.toFixed(6)} kg`);
}

// 6. bodies-iau (Flight Deck rotation model): equatorial surface speed of Earth from the spin rate
{
  const bonus = IAU.groundSpeedBonus('earth', 0, 90, 2451545.0);
  const expect = 7.292115e-5 * EARTH.R;
  check('IAU: Earth equatorial eastward surface speed = ω R (about 465 m/s)', Math.abs(bonus - expect) / expect < 2e-3, `${bonus.toFixed(2)} vs ${expect.toFixed(2)} m/s`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
