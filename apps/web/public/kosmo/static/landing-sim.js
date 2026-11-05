// landing-sim.js -- propulsive rocket-landing simulator: vehicles, flight physics, navigation
// filter, four guidance algorithms and a learned (neural) policy.  No DOM, no Three.js, so it
// runs in node (see landing-sim.test.mjs) and in landing-lab.html.
//
// The problem
//   A booster (or lander) falls toward a pad.  After the entry phase it must light one or a few
//   engines at exactly the right moment, steer onto a target a few metres wide and arrive with
//   almost no speed -- on engines that cannot throttle below ~40 % of full thrust, so the
//   vehicle cannot hover and cannot stop high up: it must arrive at zero speed exactly at zero
//   altitude ("hoverslam").  Blue Origin's New Shepard has deep-throttle engines and can hover;
//   that is why the two companies' landings look different.
//
// What is simulated (planar: x downrange, y up; the target is at x = 0)
//   * point-mass translation plus a pitch angle `th` (0 = vertical, + = nose toward +x), with
//     engine thrust that follows throttle and spool-up lag, a start delay, a gimbal with
//     angle and rate limits, cold-gas / grid-fin torque, tabulated atmosphere, Mach-dependent
//     drag, normal (lift) force on the body and on the grid fins, wind with altitude shear and
//     gusts, a moving ship deck (heave), propellant burn, touchdown criteria;
//   * a navigation filter: radar altimeter, GNSS-Doppler and a biased IMU fused by a Kalman
//     filter (switchable noise), so guidance flies on an estimate, never on the truth.
//
// Guidance (all closed-loop at 10 Hz, re-solved from the current estimate)
//   hoverslam  suicide-burn: ignite at the stopping distance, hold a constant-deceleration
//              profile, steer the thrust against the lateral velocity.
//   zemzev     Zero-Effort-Miss / Zero-Effort-Velocity (E-guidance): the energy-optimal
//              closed form  a = 6(rf - r - v tgo)/tgo^2 - 2(vf - v)/tgo.
//   optimal    fuel-optimal time-of-flight search in the spirit of SpaceX's G-FOLD / lossless
//              convexification: every cycle it solves the ZEM/ZEV profile for a grid of
//              times-to-go and keeps the cheapest one whose thrust stays inside the engine's
//              throttle window, the tilt cone and above the ground; ignition is the last
//              instant at which such a profile still exists.
//   neural     a small network trained by imitation of `optimal` (DAgger) -- the learned
//              policy replaces the solver in the burn phase.
//
// Conventions: SI.  th = angle of the body axis b = (sin th, cos th) from vertical.  Thrust
// pushes along b rotated by the gimbal angle; the engine sits behind the centre of mass.

import { ENGINES as SHIP_ENGINES, WORLDS, G0 } from './ship-sim.js';

const DEG = Math.PI / 180, P0 = 101325;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hyp = Math.hypot;

/* ---------------- engines ---------------- */
const mk = e => { e.Ae = (e.thrustVac - e.thrustSL) / P0; return e; };
export const ENGINES = {
  'merlin-1d': SHIP_ENGINES['merlin-1d'],
  'raptor-2': SHIP_ENGINES['raptor-2'],
  'be-4': SHIP_ENGINES['be-4'],
  'be-3pm': mk({ name: 'BE-3PM (deep throttle)', thrustSL: 490e3, thrustVac: 520e3, ispSL: 320, ispVac: 350, minThrottle: 0.2, prop: 'hydrolox' }),
  'be-7': mk({ name: 'BE-7', thrustSL: 0, thrustVac: 44.5e3, ispSL: 0, ispVac: 453, minThrottle: 0.2, prop: 'hydrolox', vacOnly: true }),
};

/* ---------------- vehicles ----------------
   Public, approximate figures; the point is the right regime (can it hover? how big is the
   stopping distance?), not a certified model of any one stage.                              */
export const VEHICLES = {
  falcon9: {
    name: 'Falcon 9 booster -- drone ship', world: 'earth', engine: 'merlin-1d', engines: 1,
    dry: 25600, prop: 4300, diameter: 3.7, length: 41.2, comHeight: 12, legRadius: 9, gimbal: 5, gimbalRate: 12,
    finArea: 6, finLever: 24, tiltMax: 28, latTilt: 26, vMaxV: 5.5,
    target: { kind: 'ship', radius: 14, deckY: 0, heave: 0.8, period: 9 }, wind: 6,
    start: { y: 7000, vx: -90, vy: -310, th: 0 }, spread: { x: 90, y: 40, vx: 2, vy: 4 },
    note: 'One Merlin, throttle 39-100 %: thrust-to-weight never drops below ~1.3 so it cannot hover.',
  },
  falcon9lz: {
    name: 'Falcon 9 booster -- landing zone', world: 'earth', engine: 'merlin-1d', engines: 1,
    dry: 25600, prop: 3600, diameter: 3.7, length: 41.2, comHeight: 12, legRadius: 9, gimbal: 5, gimbalRate: 12,
    finArea: 6, finLever: 24, tiltMax: 28, latTilt: 26, vMaxV: 5.5,
    target: { kind: 'pad', radius: 20, deckY: 0, heave: 0, period: 9 }, wind: 6,
    start: { y: 5500, vx: -60, vy: -280, th: 0 }, spread: { x: 80, y: 40, vx: 2, vy: 4 },
    note: 'Return-to-launch-site: a fixed concrete pad, tighter geometry, no sea state.',
  },
  newshepard: {
    name: 'New Shepard booster', world: 'earth', engine: 'be-3pm', engines: 1,
    dry: 19000, prop: 2600, diameter: 3.7, length: 15, comHeight: 5.5, legRadius: 4.5, gimbal: 6, gimbalRate: 10,
    finArea: 3, finLever: 8, tiltMax: 20, vMaxV: 4.0,
    target: { kind: 'pad', radius: 25, deckY: 0, heave: 0, period: 9 }, wind: 5,
    start: { y: 3500, vx: -25, vy: -190, th: 0 }, spread: { x: 50, y: 30, vx: 1.5, vy: 3 },
    note: 'Deep-throttle BE-3PM (down to ~20 %): thrust-to-weight can drop below 1, so it can hover and ease down.',
  },
  newglenn: {
    name: 'New Glenn booster (3 engines)', world: 'earth', engine: 'be-4', engines: 3,
    dry: 250000, prop: 55000, diameter: 7, length: 57, comHeight: 20, legRadius: 14, gimbal: 5, gimbalRate: 20,
    finArea: 80, finLever: 32, tiltMax: 20, vMaxV: 5.5,
    target: { kind: 'ship', radius: 22, deckY: 0, heave: 0.7, period: 10 }, wind: 6,
    start: { y: 5000, vx: -50, vy: -190, th: 0 }, spread: { x: 60, y: 40, vx: 1.5, vy: 4 },
    note: 'Seven-engine stage landing on three BE-4s with strakes and flaps (modelled here as grid-fin-class control).',
  },
  superheavy: {
    name: 'Super Heavy -- tower catch', world: 'earth', engine: 'raptor-2', engines: 3,
    dry: 275000, prop: 60000, diameter: 9, length: 71, comHeight: 22, legRadius: 0, gimbal: 12, gimbalRate: 25,
    finArea: 80, finLever: 40, tiltMax: 18, vMaxV: 2.5, vMaxH: 2.0,
    target: { kind: 'catch', radius: 6, deckY: 70, heave: 0, period: 9 }, wind: 5,
    start: { y: 3600, vx: -30, vy: -130, th: 0 }, spread: { x: 40, y: 30, vx: 1.5, vy: 3 },
    note: 'Three Raptors can nearly hover; instead of legs it is caught by the tower arms at ~70 m, so the box is a few metres wide. Experimental: the catch is still unreliable (about one flight in five).',
  },
  moonlander: {
    name: 'Lunar lander (BE-7 class)', world: 'moon', engine: 'be-7', engines: 1,
    dry: 3600, prop: 1900, diameter: 3.1, length: 8, comHeight: 3.2, legRadius: 4, gimbal: 6, gimbalRate: 8,
    finArea: 0, finLever: 0, tiltMax: 30, latTilt: 28, vMaxV: 3.0, vMaxH: 1.5,
    target: { kind: 'pad', radius: 15, deckY: 0, heave: 0, period: 9 }, wind: 0,
    start: { y: 2500, vx: -35, vy: -45, th: 0 }, spread: { x: 50, y: 25, vx: 1, vy: 2 },
    note: 'No atmosphere: no drag, no fins, no wind -- pure thrust control, as on the Moon.',
  },
};

/** Replace the built-in engines and vehicles with rows from landing-data.json (served from the database).  Anything missing keeps its built-in value. */
export function loadLandingData(d) {
  if (!d || typeof d !== 'object') return false;
  for (const [k, e] of Object.entries(d.engines || {})) ENGINES[k] = mk({ ...ENGINES[k], ...e });
  for (const [k, v] of Object.entries(d.vehicles || {})) VEHICLES[k] = { ...VEHICLES[k], ...v, target: { ...VEHICLES[k]?.target, ...v.target }, start: { ...VEHICLES[k]?.start, ...v.start }, spread: { ...VEHICLES[k]?.spread, ...v.spread } };
  return true;
}

/* ---------------- small helpers ---------------- */
export function rng(seed) { let a = (seed | 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
const pressure = (W, h) => W.rho(h) * W.sound(h) ** 2 / W.gamma;

export function resolveVehicle(cfg = {}) {
  const base = VEHICLES[cfg.vehicle || 'falcon9'];
  if (!base) throw new Error('unknown vehicle ' + cfg.vehicle);
  const v = { ...base, ...(cfg.override || {}) };
  v.id = cfg.vehicle || 'falcon9';
  v.target = { ...base.target, ...(cfg.override?.target || {}) };
  v.eng = ENGINES[v.engine];
  v.W = WORLDS[v.world];
  v.inertia = (m) => m * v.length * v.length / 12;
  v.sideArea = v.diameter * v.length; v.refArea = Math.PI * (v.diameter / 2) ** 2;
  v.yf = v.target.deckY + v.comHeight + 0.2;          // altitude of the centre of mass at touchdown
  // Aim at a small descent rate just below the touchdown plane.  An engine that cannot throttle down below weight cannot hover: it has
  // to arrive with some speed, in the middle of what the legs can take, so a metre of height error never leaves it stopped in the air.
  const hover = v.engines * v.eng.minThrottle * thrustAt(v, 0) < v.dry * gravAt(v, 0) * 1.05;
  v.vtd = v.target.kind === 'catch' ? 0.7 : hover ? 1.0 : 2.6; v.yAim = v.yf - (v.target.kind === 'catch' ? 0.5 : hover ? 0.8 : 0.2);
  return v;
}
const thrustAt = (v, h) => Math.max(0, v.eng.thrustVac - v.eng.Ae * pressure(v.W, h));
const ispAt = (v, h) => { const e = v.eng; return Math.max(0.6 * e.ispVac, e.ispVac + (e.ispSL - e.ispVac) * pressure(v.W, h) / P0); };
const gravAt = (v, h) => v.W.mu / (v.W.R + h) ** 2;

/** Static numbers a pilot would want before flying. */
export function analyzeVehicle(v) {
  const m0 = v.dry + v.prop, T = v.engines * thrustAt(v, 0), Tv = v.engines * v.eng.thrustVac, g = gravAt(v, 0);
  return {
    m0, twrMax: Tv / (m0 * g), twrMin: v.engines * v.eng.minThrottle * thrustAt(v, 0) / (v.dry * g) || 0,
    twrMinWet: v.engines * v.eng.minThrottle * thrustAt(v, 0) / (m0 * g),
    canHover: v.engines * v.eng.minThrottle * thrustAt(v, 0) < v.dry * g * 1.05,
    dv: v.eng.ispVac * G0 * Math.log(m0 / v.dry), T,
  };
}

/* ---------------- aerodynamic model (also used by guidance predictors) ---------------- */
const machMul = M => 1 + 0.6 * Math.exp(-(((M - 1.0) / 0.45) ** 2));
function aero(v, s, windX) {
  const W = v.W, h = Math.max(s.y - v.comHeight, 0), rho = W.rho(h);
  if (rho <= 0) return { Fx: 0, Fy: 0, thetaDD: 0, q: 0, M: 0 };
  const wx = -(s.vx - windX), wy = -s.vy, wv = hyp(wx, wy) || 1e-6;
  const bx = Math.sin(s.th), by = Math.cos(s.th), nx = Math.cos(s.th), ny = -Math.sin(s.th);
  const wa = wx * bx + wy * by, wn = wx * nx + wy * ny;
  const M = wv / W.sound(h), sinA = Math.abs(wn) / wv;
  const q = 0.5 * rho * wv * wv;
  const Fa = 0.5 * rho * wv * 1.1 * machMul(M) * v.refArea * wa;
  const Fn = 0.5 * rho * wv * wn * (2 * v.refArea + 0.8 * v.sideArea * sinA);
  const I = v.inertia(s.m), dcp = 0.22 * v.length;
  const damp = -0.5 * (q / (q + 3000)) * s.om;
  return { Fx: Fa * bx + Fn * nx, Fy: Fa * by + Fn * ny, thetaDD: dcp * Fn / I + damp, q, M, wv };
}

/** Drag deceleration (no wind) at a given altitude and velocity -- the solver evaluates it along each candidate profile. */
function dragAcc(v, y, vx, vy, m) {
  const h = Math.max(y - v.comHeight, 0), rho = v.W.rho(h);
  if (rho <= 0) return [0, 0];
  const sp = hyp(vx, vy), k = 0.5 * rho * sp * 1.1 * machMul(sp / v.W.sound(h)) * v.refArea / m;
  return [-k * vx, -k * vy];
}

/** Where would the vehicle hit the ground if it only fell (flow-aligned, engine off)? */
function coastPredict(v, e, T, windFn = 0, yStop = null) {
  let x = e.x, y = e.y, vx = e.vx, vy = e.vy, t = 0;
  const m = e.m, W = v.W, dt = 0.25;
  while (t < (T ?? 400)) {
    const h = Math.max(y - v.comHeight, 0), g = gravAt(v, h), rho = W.rho(h);
    const wx = vx - (typeof windFn === 'function' ? windFn(h) : windFn), wv = hyp(wx, vy) || 1e-6;
    const k = rho > 0 ? 0.5 * rho * wv * 1.15 * machMul(wv / W.sound(h)) * v.refArea / m : 0;
    const ax = -k * wx, ay = -g - k * vy;
    const yTarget = yStop ?? v.yf;
    if ((T == null || yStop != null) && y + vy * dt + 0.5 * ay * dt * dt <= yTarget) {
      // linear step to the target altitude
      const f = clamp((yTarget - y) / ((vy * dt + 0.5 * ay * dt * dt) || -1e-6), 0, 1);
      return { x: x + (vx * dt + 0.5 * ax * dt * dt) * f, y: yTarget, t: t + dt * f, vy: vy + ay * dt * f, vx: vx + ax * dt * f };
    }
    x += vx * dt + 0.5 * ax * dt * dt; y += vy * dt + 0.5 * ay * dt * dt; vx += ax * dt; vy += ay * dt; t += dt;
    if (T == null && t > 400) break;
  }
  return { x, y, vx, vy, t, m };
}

/* ---------------- guidance ---------------- */
const PLAN_FRAC = 0.72, IGN_FRAC = 0.62;   // share of the engine's net (thrust - gravity) acceleration a plan / the ignition test may use

/** Acceleration profile that carries (r,v) to (rf,vf) in T.  Vertical: linear in time (ZEM/ZEV).  Lateral: quadratic with
 *  zero acceleration at the end, so the vehicle is upright when it touches down.  Each axis is [c0, c1, c2]. */
function profile(r, v, rf, vf, T) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const dv = vf[i] - v[i], dr = rf[i] - r[i] - v[i] * T;
    if (i === 0) out.push([-6 * dv / T + 12 * dr / (T * T), 30 * dv / (T * T) - 48 * dr / (T * T * T), (36 * dr - 24 * dv * T) / (T ** 4)]);
    else out.push([6 * dr / (T * T) - 2 * dv / T, 6 * dv / (T * T) - 12 * dr / (T * T * T), 0]);
  }
  return out;
}
/** Acceleration, velocity and position of one axis of a profile at time t. */
function axisAt(c, v0, r0, t) {
  return [c[0] + c[1] * t + c[2] * t * t, v0 + c[0] * t + c[1] * t * t / 2 + c[2] * t * t * t / 3, r0 + v0 * t + c[0] * t * t / 2 + c[1] * t * t * t / 6 + c[2] * t ** 4 / 12];
}

/** Thrust-acceleration limits for the burn that is about to start. */
function limits(v, e) {
  const n = v.engines, h = Math.max(e.y - v.comHeight, 0);
  const Tmax = n * thrustAt(v, h), TmaxSL = n * thrustAt(v, 0), Tmin = n * v.eng.minThrottle * thrustAt(v, h);
  return { Tmax, TmaxSL, Tmin, aMax: Tmax / e.m, aMin: Tmin / e.m, g: gravAt(v, h), isp: ispAt(v, h) };
}

/** Lateral channel: a critically damped PD law on the lateral miss (independent of the vertical time-to-go, so it never
 *  blows up near the ground); tilt-limited so the vehicle is upright when it arrives. */
function lateralAccel(v, e, ay) {
  const hh = e.y - v.yf, wf = clamp(hh / 80, 0, 1), kv = 0.8, kp = 0.02;   // near the ground: mostly a velocity damper
  const wn = 0.45, zt = 1.4, ax = wf * (-wn * wn * (e.x - (v.target.xt ?? 0)) - 2 * zt * wn * e.vx) + (1 - wf) * (-kp * (e.x - (v.target.xt ?? 0)) - kv * e.vx);
  const lim = Math.tan(clamp(0.005 * (e.y - v.yf) + 0.015, 0.02, (v.latTilt ?? 14) * DEG));
  return clamp(ax, -lim * ay, lim * ay);
}

/** Vertical burn: search the time-to-go.  Every candidate is the ZEM/ZEV profile for that T; the cheapest one whose thrust
 *  stays inside the engine's throttle window (and above the ground) wins -- G-FOLD's fuel-optimal landing in one dimension,
 *  with the lateral channel handled by lateralAccel.  If none is feasible the least-violating one is flown. */
export function solveBurn(v, e, opts = {}) {
  const L = limits(v, e), g = L.g;
  const rf = v.yAim, vf = -v.vtd, y0 = e.y, v0 = e.vy;
  const evalT = T => {
    const dv = vf - v0, dr = rf - y0 - v0 * T;
    const c0 = 6 * dr / (T * T) - 2 * dv / T, c1 = 6 * dv / (T * T) - 12 * dr / (T * T * T);
    let dvSum = 0, peak = 0, low = Infinity, below = false, prev = 0;
    const N = 10;
    for (let j = 0; j <= N; j++) {
      const t = T * j / N, yt = y0 + v0 * t + 0.5 * c0 * t * t + c1 * t * t * t / 6, vt = v0 + c0 * t + 0.5 * c1 * t * t;
      const dg = dragAcc(v, yt, 0, vt, e.m);
      const a = c0 + c1 * t + g - dg[1];
      peak = Math.max(peak, a); low = Math.min(low, a);
      if (j) dvSum += 0.5 * (a + prev) * T / N; prev = a;
      if (yt < v.yAim - 0.5 && j < N) below = true;
    }
    const mEnd = e.m * Math.exp(-dvSum / (L.isp * G0));
    const aMinEnd = L.Tmin / mEnd, aMaxHere = g + (opts.maxFrac ?? PLAN_FRAC) * (Math.min(L.aMax, L.TmaxSL / e.m * 1.06) - g);
    const viol = Math.max(0, peak / aMaxHere - 1) + Math.max(0, aMinEnd / Math.max(low, 0.1) - 1) + (below ? 1 : 0);
    return { T, c0, c1, viol, cost: dvSum };
  };
  let best = null;
  for (let k = 0; k < 96; k++) {
    const c = evalT(0.5 * Math.pow(1.06, k));
    if (c.viol <= 0.025) { if (!best || !best.feasible || c.cost < best.cost) best = { ...c, feasible: true }; }
    else if (!best || (!best.feasible && c.viol < best.viol)) best = { ...c, feasible: false };
  }
  // keep flying the previous plan while it stays (nearly) feasible and not much dearer: it removes the knife-edge flip between neighbouring plans
  if (opts.prefer && opts.prefer > 0.4) { const c = evalT(opts.prefer); if (c.viol <= 0.1 && (!best.feasible || c.cost <= best.cost * 1.12)) best = { ...c, feasible: true }; }
  const dg0 = dragAcc(v, e.y, 0, e.vy, e.m), ay = best.c0 + g - dg0[1];
  // lateral: the same time-to-go, quadratic profile ending with zero acceleration; PD near the end
  const Tl = Math.max(best.T, 5), dvx = -e.vx, drx = (v.target.xt ?? 0) - e.x - e.vx * Tl;
  const axP = -6 * dvx / Tl + 12 * drx / (Tl * Tl), limP = Math.tan(clamp(0.005 * (e.y - v.yf) + 0.015, 0.02, (v.latTilt ?? 14) * DEG));
  const hh = e.y - v.yf, blend = clamp((hh - 40) / 60, 0, 1);       // below ~40 m the lateral channel is a plain damper
  const axL = clamp(blend * axP + (1 - blend) * lateralAccel(v, e, ay), -limP * ay, limP * ay);
  return { aThrust: [axL, ay], tgo: best.T, feasible: best.feasible, viol: best.viol, fuel: best.cost, L, c0: best.c0, c1: best.c1, y0, v0 };
}

/** Is any profile feasible from this state?  Used to find the last moment to light the engine. */
function burnFeasible(v, e, drag, maxFrac = PLAN_FRAC) { return solveBurn(v, e, { drag, maxFrac }).feasible; }

/** Scan the coast trajectory for the last instant at which a landing burn would still be feasible (the "window" closes as the
 *  stage falls).  Returns the time from now, and the predicted state there.  Used both to light the engine and to steer the
 *  coast so that the stage is over the pad, at rest sideways, when the engine lights. */
function ignitionForecast(v, est, windFn) {
  const feasAt = st => st.y > v.yAim + 8 && burnFeasible(v, { ...est, x: st.x, y: st.y, vx: st.vx, vy: st.vy }, null, IGN_FRAC);
  const at = t => (t === 0 ? { x: est.x, y: est.y, vx: est.vx, vy: est.vy } : coastPredict(v, est, t, windFn));
  let prev = null;
  for (let t = 0; t <= 120; t += 1) {
    const st = at(t);
    if (st.y < v.yAim + 8) return prev ? { t: prev.t, st: prev.st, window: true } : { t, st, window: false };
    const f = feasAt(st);
    if (f) prev = { t, st };
    else if (prev) {                                  // window closed between prev.t and t: bisect
      let lo = prev.t, hi = t, sl = prev.st;
      for (let k = 0; k < 4; k++) { const mid = (lo + hi) / 2, sm = at(mid); if (feasAt(sm)) { lo = mid; sl = sm; } else hi = mid; }
      return { t: lo, st: sl, window: true };
    }
  }
  return prev ? { t: prev.t, st: prev.st, window: true } : { t: 120, st: at(120), window: false };
}

/** Classic zero-effort-miss/velocity guidance. */
function zemzev(v, e, drag) {
  const L = limits(v, e), h = e.y - v.yAim, vv = Math.max(-e.vy, 1);
  const T = clamp(2 * h / (vv + v.vtd), 1.2, 60);
  const [px, py] = profile([e.x, e.y], [e.vx, e.vy], [v.target.xt ?? 0, v.yAim], [0, -v.vtd], T);
  return { aThrust: [px[0] - drag[0], py[0] + L.g - drag[1]], tgo: T };
}

/** Suicide burn: constant-deceleration profile, thrust opposes the lateral velocity. */
function hoverslam(v, e, drag) {
  const L = limits(v, e), h = Math.max(e.y - v.yAim, 0.3), vy = Math.min(e.vy, -v.vtd);
  const adec = Math.max((vy * vy - v.vtd * v.vtd) / (2 * h), 0);
  const ay = L.g + adec - drag[1];
  const vxDes = clamp(0.08 * ((v.target.xt ?? 0) - e.x), -25, 25) * clamp(h / 300, 0, 1);
  const ax = clamp(0.7 * (vxDes - e.vx), -0.4 * ay, 0.4 * ay);
  return { aThrust: [ax, ay], tgo: h / Math.max(-vy, 1) * 2 };
}

/** How far below the engine's ceiling do we stop?  Used by the simple ignition rule. */
function stopHeight(v, e, margin) {
  const L = limits(v, e), speed = hyp(e.vx, e.vy);
  const aNet = margin * L.aMax - L.g;
  if (aNet <= 0.5) return Infinity;
  return speed * speed / (2 * aNet) * Math.abs(e.vy) / Math.max(speed, 1) + 0.9 * Math.abs(e.vy) + v.yf;
}

/* ---------------- neural policy ---------------- */
const asinhs = (x, s) => Math.asinh(x / s) / 3;
export function features(v, e) {
  const L = limits(v, e), g = L.g;
  return [asinhs(e.x - (v.target.xt ?? 0), 120), asinhs(e.y - v.yf, 120), asinhs(e.vx, 10), asinhs(e.vy, 30), e.th * 3, e.om * 3,
    Math.log(L.aMax / g) / 2, Math.log(Math.max(L.aMin, 0.05 * g) / g) / 2];
}
export class Policy {
  constructor(sizes = [8, 40, 40, 2], seed = 1, weights) {
    this.sizes = sizes; const r = rng(seed);
    this.W = []; this.b = [];
    for (let l = 1; l < sizes.length; l++) {
      const n = sizes[l - 1], m = sizes[l], s = Math.sqrt(2 / n);
      this.W.push(Float64Array.from({ length: n * m }, () => gauss(r) * s)); this.b.push(new Float64Array(m));
    }
    if (weights) { this.W = weights.W.map(a => Float64Array.from(a)); this.b = weights.b.map(a => Float64Array.from(a)); }
  }
  forward(x, keep) {
    const acts = [Float64Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const n = this.sizes[l], m = this.sizes[l + 1], a = acts[l], out = new Float64Array(m), W = this.W[l];
      for (let j = 0; j < m; j++) { let s = this.b[l][j]; for (let i = 0; i < n; i++) s += W[j * n + i] * a[i]; out[j] = l < this.W.length - 1 ? Math.tanh(s) : s; }
      acts.push(out);
    }
    return keep ? acts : acts[acts.length - 1];
  }
  toJSON() { return { sizes: this.sizes, W: this.W.map(a => Array.from(a)), b: this.b.map(a => Array.from(a)) }; }
  static fromJSON(j) { return new Policy(j.sizes, 1, j); }
}
/** Adam on a dataset of {x, y, w}.  Returns the final mean squared error. */
export function fit(policy, data, { epochs = 30, batch = 128, lr = 2e-3, seed = 7 } = {}) {
  const r = rng(seed), L = policy.W.length;
  const mW = policy.W.map(a => new Float64Array(a.length)), vW = policy.W.map(a => new Float64Array(a.length));
  const mb = policy.b.map(a => new Float64Array(a.length)), vb = policy.b.map(a => new Float64Array(a.length));
  let step = 0, mse = 0;
  const idx = Array.from({ length: data.length }, (_, i) => i);
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    mse = 0;
    for (let s = 0; s < idx.length; s += batch) {
      const gW = policy.W.map(a => new Float64Array(a.length)), gb = policy.b.map(a => new Float64Array(a.length));
      const bs = Math.min(batch, idx.length - s);
      for (let q = 0; q < bs; q++) {
        const d = data[idx[s + q]], acts = policy.forward(d.x, true), out = acts[L];
        let delta = Float64Array.from(out, (o, k) => 2 * (o - d.y[k]) * (d.w ?? 1) / bs);
        mse += out.reduce((a, o, k) => a + (o - d.y[k]) ** 2, 0);
        for (let l = L - 1; l >= 0; l--) {
          const n = policy.sizes[l], m = policy.sizes[l + 1], a = acts[l], nd = new Float64Array(n);
          for (let j = 0; j < m; j++) { gb[l][j] += delta[j]; for (let i = 0; i < n; i++) { gW[l][j * n + i] += delta[j] * a[i]; nd[i] += delta[j] * policy.W[l][j * n + i]; } }
          if (l > 0) for (let i = 0; i < n; i++) nd[i] *= 1 - acts[l][i] * acts[l][i];
          delta = nd;
        }
      }
      step++; const c1 = 1 - 0.9 ** step, c2 = 1 - 0.999 ** step;
      for (let l = 0; l < L; l++) {
        for (const [P, G, M, V] of [[policy.W[l], gW[l], mW[l], vW[l]], [policy.b[l], gb[l], mb[l], vb[l]]])
          for (let i = 0; i < P.length; i++) { M[i] = 0.9 * M[i] + 0.1 * G[i]; V[i] = 0.999 * V[i] + 0.001 * G[i] * G[i]; P[i] -= lr * (M[i] / c1) / (Math.sqrt(V[i] / c2) + 1e-8); }
      }
    }
    mse /= data.length;
  }
  return mse;
}

/* ---------------- navigation filter ---------------- */
function makeKF(p, v, sp, sv) { return { x: [p, v], P: [[sp * sp, 0], [0, sv * sv]] }; }
function kfPredict(k, a, dt, qa) {
  const [p, v] = k.x; k.x = [p + v * dt + 0.5 * a * dt * dt, v + a * dt];
  const P = k.P, q = qa * qa, d2 = dt * dt;
  const p00 = P[0][0] + dt * (P[1][0] + P[0][1]) + d2 * P[1][1] + q * d2 * d2 / 4;
  const p01 = P[0][1] + dt * P[1][1] + q * d2 * dt / 2, p10 = P[1][0] + dt * P[1][1] + q * d2 * dt / 2, p11 = P[1][1] + q * d2;
  k.P = [[p00, p01], [p10, p11]];
}
function kfUpdate(k, i, z, R) {
  const P = k.P, S = P[i][i] + R, K = [P[0][i] / S, P[1][i] / S], inn = z - k.x[i];
  k.x = [k.x[0] + K[0] * inn, k.x[1] + K[1] * inn];
  const r0 = [P[i][0], P[i][1]];
  k.P = [[P[0][0] - K[0] * r0[0], P[0][1] - K[0] * r0[1]], [P[1][0] - K[1] * r0[0], P[1][1] - K[1] * r0[1]]];
}

/* ---------------- the simulation ---------------- */
export const GUIDANCE = {
  hoverslam: 'Hoverslam (suicide burn)',
  zemzev: 'ZEM/ZEV (E-guidance)',
  optimal: 'Fuel-optimal time-of-flight (G-FOLD style)',
  neural: 'Neural policy (learned from the optimal solver)',
};

export function createLanding(cfg = {}) {
  const v = resolveVehicle(cfg), W = v.W, eng = v.eng, rand = rng(cfg.seed ?? 1);
  const guidance = cfg.guidance || 'optimal', noisy = cfg.noise !== false;
  const policy = cfg.policy ? (cfg.policy instanceof Policy ? cfg.policy : Policy.fromJSON(cfg.policy)) : null;
  const mode = guidance === 'neural' && !policy ? 'optimal' : guidance;
  const windMean = (cfg.wind ?? v.wind) * (cfg.windSign ?? 1);
  const gustSigma = cfg.gust ?? (v.wind ? 0.35 * Math.abs(v.wind) : 0);
  const sea = { heave: cfg.sea ?? v.target.heave, period: v.target.period, phase: rand() * 6.28 };
  const tgt = v.target;
  const prop0 = Math.min(cfg.prop ?? v.prop, v.prop * 4);

  // initial state: back out the downrange start so that a coasting vehicle would reach the target
  const st = { ...v.start, ...(cfg.start || {}) };
  const disp = cfg.dispersed ? v.spread : { x: 0, y: 0, vx: 0, vy: 0 };
  const s = { t: 0, x: 0, y: st.y + gauss(rand) * disp.y, vx: st.vx + gauss(rand) * disp.vx, vy: st.vy + gauss(rand) * disp.vy, th: 0, om: 0,
    m: v.dry + prop0, prop: prop0, thrust: 0, lvl: 0, gimbal: 0, fin: 0 };
  s.th = (st.th ?? 0) * DEG;
  const imp = coastPredict(v, { x: 0, y: s.y, vx: s.vx, vy: s.vy, m: s.m }, null, h => windMean * Math.min(1.8, Math.pow(Math.max(h, 10) / 10, 0.143)));
  s.x = -imp.x + (cfg.dispersed ? gauss(rand) * disp.x : 0);
  tgt.xt = 0;
  const m0 = s.m;

  // engine
  const E = { on: false, startAt: 0, ignitions: 0, cut: false };
  let windGust = 0;
  // navigation
  const sig = noisy ? { radar: 1.2, radarRel: 0.002, gnss: 1.6, dop: 0.12, accel: 0.06, bias: 0.04, gyro: 0.002 } : { radar: 0, radarRel: 0, gnss: 0, dop: 0, accel: 0, bias: 0, gyro: 0 };
  const bias = [gauss(rand) * sig.bias, gauss(rand) * sig.bias];
  const kx = makeKF(s.x, s.vx, 3, 1), ky = makeKF(s.y, s.vy, 3, 1);
  const est = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, th: s.th, om: s.om, m: s.m };
  let specF = [0, 0], nextMeas = 0;
  // guidance state
  const G = { next: 0, ctl: null, igniteAt: null, phase: 'coast', drag: [0, 0], lastTgo: 0, feasible: true };
  const events = [], log = [];
  const out = { landed: false, ok: false, reason: '', t: 0 };
  const ev = (txt, kind = '') => events.push({ t: s.t, txt, kind });
  let logNext = 0, peakQ = 0, peakG = 0;
  const hook = cfg.onGuidance || null;       // training hook: (features, expert accel)
  const mixBeta = cfg.mixExpert ?? 1;        // probability the expert flies during DAgger rollouts

  const deck = t => tgt.deckY + (sea.heave ? sea.heave * Math.sin(2 * Math.PI * t / sea.period + sea.phase) : 0);
  const deckV = t => (sea.heave ? sea.heave * 2 * Math.PI / sea.period * Math.cos(2 * Math.PI * t / sea.period + sea.phase) : 0);
  const windAt = h => windMean * Math.min(1.8, Math.pow(Math.max(h, 10) / 10, 0.143)) + windGust * Math.min(1, h / 300);

  function navStep(dt, aero, thrustVec) {
    // truth -> sensors
    specF = [(thrustVec[0] + aero.Fx + fAx) / s.m, (thrustVec[1] + aero.Fy + fAy) / s.m];
    if (!noisy) { Object.assign(est, { x: s.x, y: s.y, vx: s.vx, vy: s.vy, th: s.th, om: s.om, m: s.m }); return; }
    const g = gravAt(v, Math.max(s.y - v.comHeight, 0));
    const am = [specF[0] + bias[0] + gauss(rand) * sig.accel, specF[1] + bias[1] + gauss(rand) * sig.accel];
    kfPredict(kx, am[0], dt, sig.accel + 0.02); kfPredict(ky, am[1] - g, dt, sig.accel + 0.02);
    if (s.t >= nextMeas) {
      nextMeas = s.t + 0.1;
      const rR = sig.radar + sig.radarRel * Math.max(s.y, 0);
      kfUpdate(ky, 0, s.y + gauss(rand) * rR, rR * rR); kfUpdate(ky, 1, s.vy + gauss(rand) * sig.dop, sig.dop ** 2);
      kfUpdate(kx, 0, s.x + gauss(rand) * sig.gnss, sig.gnss ** 2); kfUpdate(kx, 1, s.vx + gauss(rand) * sig.dop, sig.dop ** 2);
    }
    est.x = kx.x[0]; est.vx = kx.x[1]; est.y = ky.x[0]; est.vy = ky.x[1];
    est.th = s.th + gauss(rand) * sig.gyro; est.om = s.om + gauss(rand) * sig.gyro * 2; est.m = s.m;
  }
  let fAx = 0, fAy = 0;

  /* ----- one guidance cycle (10 Hz) ----- */
  function guide() {
    const h = est.y - v.yf, L = limits(v, est);
    // drag acceleration felt: specific force minus thrust, from the filtered accelerometer
    const thrAcc = s.thrust / s.m;
    const meas = [specF[0] - Math.sin(s.th + s.gimbal) * thrAcc, specF[1] - Math.cos(s.th + s.gimbal) * thrAcc];
    G.drag = [0.7 * G.drag[0] + 0.3 * meas[0], 0.7 * G.drag[1] + 0.3 * meas[1]];
    const drag = E.on ? [G.drag[0] * 0, G.drag[1] * 0] : G.drag;     // engine on: the solver re-measures every cycle
    const dragNow = [G.drag[0], G.drag[1]];
    let ctl = { burn: false };
    if (!E.on && !E.cut) {
      // ---------- coast: grid-fin steering toward the target, decide when to light ----------
      const wx = windAt(h);
      const fall = coastPredict(v, est, null, h2 => windMean * Math.min(1.8, Math.pow(Math.max(h2, 10) / 10, 0.143)));
      const e = fall.x - (tgt.xt ?? 0);
      // lateral acceleration that would cancel the predicted miss in the time that is left, turned into an
      // angle of attack with the vehicle's own normal-force model (grid fins hold the angle)
      // aim to be over the pad and at rest laterally when the engine will light (not when the stage would hit the ground)
      const windFn = h2 => windMean * Math.min(1.8, Math.pow(Math.max(h2, 10) / 10, 0.143));
      if (s.t >= (G.fcNext ?? 0) || (G.fc && G.fc.t < 4)) { G.fc = ignitionForecast(v, est, windFn); G.fcAt = s.t; G.fcNext = s.t + (G.fc.t < 6 ? 0.1 : 0.5); }
      const fcT = G.fc.t - (s.t - G.fcAt), atIgn = G.fc.window ? G.fc.st : null;
      const tI = Math.max(G.fc.window ? fcT : fall.t, 3);
      const aReq = clamp(atIgn ? (-6 * (atIgn.x - (tgt.xt ?? 0)) / (tI * tI) - 4 * atIgn.vx / tI) : -2 * e / (tI * tI), -6, 6) * est.m;
      const qd = Math.max(0.5 * W.rho(Math.max(est.y - v.comHeight, 0)) * (est.vx * est.vx + est.vy * est.vy), 600);
      const a0 = Math.abs(aReq) / (qd * 2 * v.refArea), aoa = Math.abs(aReq) / (qd * (2 * v.refArea + 0.8 * v.sideArea * Math.min(a0, 0.3)));
      const steer = Math.sign(aReq) * Math.min(aoa, v.finArea > 0 ? 0.3 : 0);
      ctl = { burn: false, steer, miss: e, impactT: fall.t };
      let ignite = false;
      const horizon = 1.3;                                                // start delay + spool-up
      if (mode === 'hoverslam' || mode === 'zemzev') {
        ignite = h <= stopHeight(v, est, mode === 'hoverslam' ? 0.9 : 0.88);
      } else {
        ignite = (G.fc.window && fcT <= horizon) || h <= stopHeight(v, est, 0.97);
      }
      if (ignite && s.prop > 0.5) { E.on = true; E.startAt = s.t + 0.5; E.ignitions++; G.phase = 'ignition'; ev(`engine start at ${Math.round(h)} m, ${(-est.vy).toFixed(0)} m/s down`, 'stage'); }
    }
    if (E.on) {
      // ---------- burn ----------
      let sol;
      const ad = dragNow;
      if (mode === 'hoverslam') sol = hoverslam(v, est, dragAcc(v, est.y, est.vx, est.vy, est.m));
      else if (mode === 'zemzev') sol = zemzev(v, est, dragAcc(v, est.y, est.vx, est.vy, est.m));
      else {
        const prefer = G.lastSolve ? G.lastSolve.T - (s.t - G.lastSolve.t) : 0;
        sol = solveBurn(v, est, { prefer });
        G.lastSolve = { T: sol.tgo, t: s.t };
        if (!sol.feasible) { const z = zemzev(v, est, [0, 0]); if (sol.viol > 0.6) { sol.aThrust = z.aThrust; } }
        G.feasible = sol.feasible;
        if (mode === 'neural') {
          const f = features(v, est), net = policy.forward(f), aref = L.aMax;
          const nn = [net[0] * aref, net[1] * aref];
          if (hook) hook(f, [clamp(sol.aThrust[0] / aref, -1.5, 1.5), clamp(sol.aThrust[1] / aref, -1.5, 1.5)]);
          if (rand() > mixBeta) sol.aThrust = nn;
        }
      }
      if (mode !== 'neural' && hook) hook(features(v, est), [clamp(sol.aThrust[0] / L.aMax, -1.5, 1.5), clamp(sol.aThrust[1] / L.aMax, -1.5, 1.5)]);
      ctl = { burn: true, a: sol.aThrust, tgo: sol.tgo, feasible: sol.feasible !== false };
      G.lastTgo = sol.tgo ?? 0;
      if (G.phase === 'ignition' && s.t >= E.startAt) G.phase = 'burn';
    }
    G.ctl = ctl;
  }

  /* ----- control, actuators, dynamics (50 Hz) ----- */
  function step(dt) {
    if (out.landed) return;
    if (s.t >= G.next) { G.next = s.t + 0.1; guide(); }
    const ctl = G.ctl || { burn: false, steer: 0 };
    const hAbove = Math.max(s.y - v.comHeight, 0), P = pressure(W, hAbove), g = gravAt(v, hAbove);
    windGust += (-windGust / 6 * dt) + gustSigma * Math.sqrt(2 / 6 * dt) * gauss(rand);
    const wx = W.rho(hAbove) > 0 ? windAt(hAbove) : 0;
    const A = aero(v, s, wx);
    const I = v.inertia(s.m);

    // desired attitude
    let thCmd = 0, uCmd = 0;
    if (ctl.burn) {
      let [ax, ay] = ctl.a;
      ay = Math.max(ay, 0.15 * g);
      const tiltLim = clamp(0.005 * (est.y - v.yf) + 0.015, 0.02, v.tiltMax * DEG);
      thCmd = clamp(Math.atan2(ax, ay), -tiltLim, tiltLim);
      const aMag = hyp(ax, ay) / Math.cos(Math.min(Math.abs(thCmd) + 0.0, 1.2)) * Math.cos(Math.atan2(ax, ay) - thCmd);
      const Tn = v.engines * thrustAt(v, Math.max(est.y - v.comHeight, 0));
      uCmd = clamp(hyp(ax, ay) * est.m / Tn, eng.minThrottle, 1);
    } else {
      const vrx = est.vx - wx, flow = Math.atan2(-vrx, -est.vy);
      thCmd = A.q > 150 ? clamp(flow - (ctl.steer || 0), -0.9, 0.9) : (A.q > 20 ? flow : s.th);
      if (A.q <= 20 && Math.abs(est.vy) < 1e-3) thCmd = 0;
    }
    // attitude loop: PD -> angular acceleration -> gimbal, then fins, then cold gas
    const haveThrust = s.lvl > 0.02 && s.thrust > 1;
    // rate-command loop: slew toward the target angle as fast as the available torque allows, then settle
    const authority = Math.max(0.1, (haveThrust ? v.comHeight * s.thrust * Math.sin(v.gimbal * DEG) / I : 0) + (v.finArea > 0 && A.q > 100 ? A.q * v.finArea * 1.2 * v.finLever / I : 0) + 0.12);
    const errTh = thCmd - est.th, omDes = clamp(Math.sign(errTh) * Math.min(Math.sqrt(2 * 0.55 * authority * Math.abs(errTh)), 1.8 * Math.abs(errTh)), -0.6, 0.6);
    let alphaCmd = 3.0 * (omDes - est.om) - A.thetaDD * 0.9;
    let aGim = 0;
    if (haveThrust) {
      const sinD = clamp(-alphaCmd * I / (v.comHeight * s.thrust), -Math.sin(v.gimbal * DEG), Math.sin(v.gimbal * DEG));
      s.gimCmd = Math.asin(sinD);
    } else s.gimCmd = 0;
    const dMax = v.gimbalRate * DEG * dt;
    s.gimbal += clamp(s.gimCmd - s.gimbal, -dMax, dMax);
    if (haveThrust) aGim = -v.comHeight * s.thrust * Math.sin(s.gimbal) / I;
    let rest = alphaCmd - aGim, aFin = 0, finF = 0;
    if (v.finArea > 0 && A.q > 100) {
      const k = A.q * v.finArea * 1.2 * v.finLever / I;
      const f = clamp(rest / k, -1, 1);
      const dF = 2.5 * dt; s.fin += clamp(f - s.fin, -dF, dF);
      aFin = k * s.fin; finF = A.q * v.finArea * 1.2 * s.fin; rest -= aFin;
    } else s.fin *= 0.9;
    const aRcs = clamp(rest, -0.12 * (1 + 0.5 * (v.diameter < 5)), 0.12 * (1 + 0.5 * (v.diameter < 5)));
    const thetaDD = aGim + aFin + aRcs + A.thetaDD;

    // engine
    let F = 0, mdot = 0;
    if (E.on && s.t >= E.startAt && s.prop > 0) {
      if (s.lvl === 0) s.lvl = eng.minThrottle;
      s.lvl += (uCmd - s.lvl) * (1 - Math.exp(-dt / 0.3));
      F = s.lvl * v.engines * thrustAt(v, hAbove) * (1 + (cfg.thrustErr ?? 0));
      mdot = F / (ispAt(v, hAbove) * G0);
      s.prop = Math.max(0, s.prop - mdot * dt); s.m = v.dry + s.prop;
      if (s.prop <= 0) { E.on = false; E.cut = true; ev('out of propellant', 'bad'); F = 0; }
    } else s.lvl = 0;
    s.thrust = F;
    const dirA = s.th + s.gimbal;
    const Tx = F * Math.sin(dirA), Ty = F * Math.cos(dirA);
    const nx = Math.cos(s.th), ny = -Math.sin(s.th);
    fAx = finF * nx; fAy = finF * ny;
    const ax = (Tx + A.Fx + fAx) / s.m, ay = (Ty + A.Fy + fAy) / s.m - g;
    navStep(dt, A, [Tx, Ty]);
    s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    s.om += thetaDD * dt; s.th += s.om * dt;
    s.t += dt;
    s.q = A.q; s.gload = hyp(ax, ay + g) / 9.80665; peakQ = Math.max(peakQ, A.q); peakG = Math.max(peakG, s.gload);

    // engine cut-off when the vehicle has stopped just above the pad (an engine that cannot throttle down would only lift it off again)
    if (E.on && s.t >= E.startAt && s.vy > -0.4 && s.y - v.yf > 0.15 && s.y - v.yf < 3 && eng.minThrottle * v.engines * thrustAt(v, 0) > s.m * g * 0.98) {
      E.on = false; E.cut = true; s.lvl = 0; ev('engine cut: the stage has stopped above the pad and cannot hover', 'bad');
    }

    // contact
    const foot = s.y - v.comHeight * Math.cos(s.th) - v.legRadius * Math.abs(Math.sin(s.th));
    if (foot <= deck(s.t)) touchdown();
    if (s.t >= logNext) { logNext += 0.1; log.push({ t: s.t, x: s.x, y: s.y, vx: s.vx, vy: s.vy, th: s.th, u: s.lvl, F, m: s.m, q: A.q, ex: est.x - s.x, ey: est.y - s.y }); }
    if (!out.landed && (s.t > 400 || s.y > st.y * 1.6 + 500 || Math.abs(s.x) > 60000)) { out.landed = true; out.reason = 'flew away / timed out'; out.ok = false; ev('lost: ' + out.reason, 'bad'); }
  }

  function touchdown() {
    out.landed = true; E.on = false; s.thrust = 0; s.lvl = 0;
    const vv = -(s.vy - deckV(s.t)), vh = Math.abs(s.vx), tilt = Math.abs(s.th) / DEG;
    const miss = Math.abs(s.x - (tgt.xt ?? 0));
    const lims = { vv: v.vMaxV ?? 3, vh: v.vMaxH ?? 3.0, tilt: v.target.kind === 'catch' ? 5 : 8, rate: 15 };
    const why = [];
    if (vv > lims.vv) why.push(`vertical speed ${vv.toFixed(1)} m/s > ${lims.vv}`);
    if (vh > lims.vh) why.push(`lateral speed ${vh.toFixed(1)} m/s > ${lims.vh}`);
    if (tilt > lims.tilt) why.push(`tilt ${tilt.toFixed(1)}° > ${lims.tilt}°`);
    if (Math.abs(s.om) / DEG > lims.rate) why.push(`spinning ${(s.om / DEG).toFixed(1)}°/s`);
    if (miss > tgt.radius) why.push(`missed the ${tgt.kind === 'ship' ? 'deck' : tgt.kind === 'catch' ? 'catch arms' : 'pad'} by ${(miss - tgt.radius).toFixed(0)} m`);
    Object.assign(out, { t: s.t, vv, vh, tilt, miss, fuel: s.prop, fuelUsed: prop0 - s.prop, ok: why.length === 0, why, maxQ: peakQ, maxG: peakG, mode });
    out.reason = out.ok ? 'landed' : why.join('; ');
    ev(out.ok ? `${tgt.kind === 'catch' ? 'caught' : 'touchdown'}: ${vv.toFixed(2)} m/s down, ${vh.toFixed(2)} m/s sideways, ${miss.toFixed(1)} m from centre, ${s.prop.toFixed(0)} kg left` : `FAILED: ${out.reason}`, out.ok ? 'good' : 'bad');
  }

  const api = {
    veh: v, s, est, out, events, log, cfg, E, G, prop0, tgt, deck, deckV, mode, windAt: h => windAt(h), policy,
    get done() { return out.landed; },
    advance(T, dt = 0.02) { const end = s.t + T; while (!out.landed && s.t < end - 1e-9) step(Math.min(dt, end - s.t)); },
    run(tMax = 300) { while (!out.landed && s.t < tMax) step(0.02); if (!out.landed) { out.landed = true; out.reason = 'timed out'; } return out; },
    get phase() { return out.landed ? (out.ok ? 'landed' : 'crashed') : (E.on ? (G.phase) : 'descent'); },
    analysis: analyzeVehicle(v), m0,
  };
  return api;
}

/* ---------------- batch tools ---------------- */
/** One dispersed flight of a Monte Carlo set: random winds, sensor noise, start dispersion and thrust error. */
export function mcRun(cfg, i, seed0 = 100) {
  const r = rng(seed0 + i * 977);
  const c = { ...cfg, seed: seed0 + i, dispersed: true, windSign: r() < 0.5 ? -1 : 1, wind: (cfg.wind ?? VEHICLES[cfg.vehicle || 'falcon9'].wind) * (0.3 + 1.4 * r()), thrustErr: 0.02 * gauss(r) };
  const sim = createLanding(c), o = sim.run();
  return { i, ok: o.ok, x: sim.s.x - (sim.tgt.xt ?? 0), vv: o.vv, vh: o.vh, fuel: o.fuel, reason: o.reason, miss: o.miss, why: o.why };
}
export function summarizeMC(rows) {
  const reasons = {}, good = rows.filter(r => r.ok), mean = (a, f) => a.length ? a.reduce((s, r) => s + f(r), 0) / a.length : 0;
  for (const r of rows) if (!r.ok) { const k = (r.why?.[0] || r.reason || '?').replace(/[0-9.]+/g, '#'); reasons[k] = (reasons[k] || 0) + 1; }
  return { n: rows.length, ok: good.length, rate: rows.length ? good.length / rows.length : 0, rows, reasons, meanFuel: mean(good, r => r.fuel), meanSpeed: mean(good, r => r.vv), meanMiss: mean(rows, r => r.miss || 0) };
}
/** Monte Carlo over initial dispersions, wind, sensor noise and thrust error. */
export function monteCarlo(cfg, n = 50, seed0 = 100) {
  const rows = []; for (let i = 0; i < n; i++) rows.push(mcRun(cfg, i, seed0));
  return summarizeMC(rows);
}

/** Train a policy by imitation (DAgger): fly the learner, label every state with the solver. */
export async function trainPolicy(vehicleId, { episodes = 40, rounds = 4, seed = 11, epochs = 25, onProgress, yieldFn, override } = {}) {
  const data = []; let policy = new Policy([8, 40, 40, 2], seed);
  const base = { vehicle: vehicleId, override, noise: true, dispersed: true };
  for (let rd = 0; rd < rounds; rd++) {
    for (let k = 0; k < episodes; k++) {
      const batch = [];
      const sim = createLanding({ ...base, guidance: rd === 0 ? 'optimal' : 'neural', policy: rd === 0 ? null : policy, mixExpert: rd === 0 ? 1 : 0.25, seed: seed * 1000 + rd * 200 + k,
        windSign: k % 2 ? 1 : -1, onGuidance: (x, y) => batch.push({ x, y, w: 1 }) });
      sim.run();
      // drop labels from the fall-through-the-ground phase and keep every sample from healthy runs
      for (const b of batch) data.push(b);
      if (yieldFn && k % 5 === 4) await yieldFn();
    }
    const mse = fit(policy, data, { epochs, seed: seed + rd });
    onProgress?.({ round: rd + 1, rounds, samples: data.length, mse });
    if (yieldFn) await yieldFn();
  }
  return policy;
}
