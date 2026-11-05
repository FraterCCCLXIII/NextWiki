// ship-sim.js -- planar rocket flight simulation for the Shipyard page. No Three.js, no DOM,
// so it runs in node (see ship-sim.test.mjs).
//
// What is simulated
//   * a launch vehicle of stacked stages with real engine data (sea-level and vacuum thrust,
//     Isp, minimum throttle, restarts), propellant burn, mass and staging;
//   * gravity, a tabulated atmosphere (Earth, 1976 standard), Mach-dependent drag, dynamic
//     pressure and stagnation heating; the Moon and Mars are also available;
//   * the planet's rotation, so a launch gains the eastward surface speed and a pad moves;
//   * separated stages as independent bodies that can fly their own boostback, entry and
//     propulsive landing, or parachute descents for capsules;
//   * orbital insertion by apoapsis targeting, a Hohmann rendezvous with a station on a
//     circular orbit, a closed-loop proximity-operations controller in the station's rotating
//     frame (Clohessy-Wiltshire), and a docking contact check (closing speed, offset, attitude);
//   * deorbit and landing, with a predictive suicide-burn ignition.
//
// What is simplified, on purpose
//   * Motion is planar (equatorial orbit, x-y plane). Attitude is a tracked angle with a rate
//     and acceleration limit, not a full rigid-body model; there is no aerodynamic torque.
//   * Thrust acts along the body axis; steering losses and angle-of-attack drag are included.
//   * Parallel (strap-on) staging is not modelled yet.
//   * `mission.release = { alt, speed }` starts a launch from a balloon or aircraft instead of the pad.
//
// Conventions: SI. Position x,y from the body centre, orbits are counter-clockwise.
// `th` is the angle of the body axis n (from engine to nose); thrust pushes the craft along +n.
// To slow down, point the nose backwards (n = -v) and burn.

import { UNITS } from './sim-physics.js';
import { ENGINES } from './engines.js';

export const G0 = UNITS.g0;
const TAU = Math.PI * 2, P0 = 101325, DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const wrap2 = a => { a %= TAU; return a < 0 ? a + TAU : a; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = a => Math.hypot(a[0], a[1]);
const unit = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const rot = (a, t) => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
const ang = a => Math.atan2(a[1], a[0]);
const fromAng = t => [Math.cos(t), Math.sin(t)];

/* ---------------- worlds and atmospheres ---------------- */
const EARTH_RHO = [[0, 1.225], [5e3, 0.7364], [10e3, 0.4135], [15e3, 0.1948], [20e3, 0.08891], [25e3, 0.04008], [30e3, 0.01841], [40e3, 0.003996], [50e3, 0.001027], [60e3, 3.097e-4], [70e3, 8.283e-5], [80e3, 1.846e-5], [90e3, 3.416e-6], [100e3, 5.604e-7], [120e3, 2.222e-8], [150e3, 2.076e-9], [200e3, 2.541e-10], [300e3, 1.916e-11], [500e3, 5.215e-13]];
const EARTH_A = [[0, 340.3], [11e3, 295.1], [20e3, 295.1], [32e3, 303.2], [47e3, 329.8], [51e3, 329.8], [71e3, 314.1], [86e3, 284], [120e3, 340], [1e6, 1000]];
function interp(tab, h, log) {
  if (h <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (h <= tab[i][0]) {
    const [h0, y0] = tab[i - 1], [h1, y1] = tab[i], f = (h - h0) / (h1 - h0);
    return log ? Math.exp(Math.log(y0) + f * (Math.log(y1) - Math.log(y0))) : y0 + f * (y1 - y0);
  }
  return log ? 0 : tab[tab.length - 1][1];
}
export const WORLDS = {
  earth: { id: 'earth', name: 'Earth', R: 6378137, mu: 3.986004418e14, w: 7.292115e-5, rho: h => h > 600e3 ? 0 : interp(EARTH_RHO, h, true), sound: h => interp(EARTH_A, h, false), gamma: 1.4, atmoTop: 150e3 },
  moon: { id: 'moon', name: 'Moon', R: 1737400, mu: 4.9028e12, w: 2.6617e-6, rho: () => 0, sound: () => 300, gamma: 1.4, atmoTop: 0 },
  mars: { id: 'mars', name: 'Mars', R: 3389500, mu: 4.28284e13, w: 7.0882e-5, rho: h => h > 120e3 ? 0 : 0.020 * Math.exp(-h / 11100), sound: () => 240, gamma: 1.29, atmoTop: 80e3 },
};
const pressure = (W, h) => { const rho = W.rho(h); return rho * W.sound(h) ** 2 / W.gamma; };

/* ---------------- engines ---------------- */
export { ENGINES };
const STRUCT = { kerolox: 0.045, methalox: 0.06, hydrolox: 0.07, hypergolic: 0.06, solid: 0.10 };
const DENSITY = { kerolox: 1030, methalox: 830, hydrolox: 360, hypergolic: 1200, solid: 1800 };

/* ---------------- vehicle assembly ---------------- */
/** Fill in every derived number for a stage definition. */
export function completeStage(s, i = 0) {
  const e = ENGINES[s.engine] || ENGINES['merlin-1d'], n = Math.max(1, s.count | 0 || 1), prop = s.prop ?? 0;
  const engineMass = n * e.mass, kit = s.landing?.mode === 'propulsive' ? 0.1 : s.landing?.mode === 'chute' ? 0.04 : 0;
  const bare = s.dry != null ? s.dry : engineMass + prop * STRUCT[e.prop] + 150 + (s.craft ? 400 : 0);
  const dry = bare * (1 + kit);
  const d = s.diameter ?? 3.7, vol = prop / DENSITY[e.prop] * 1.12;
  const length = s.length ?? Math.max(2, vol / (Math.PI * (d / 2) ** 2) + 2.5);
  return {
    name: s.name || `Stage ${i + 1}`, engineId: s.engine, engine: e, count: n, prop, propMax: prop, dry, diameter: d, length,
    landing: { mode: 'none', reserve: 0, site: 'downrange', engines: 1, ...(s.landing || {}) },
    craft: s.craft ? { rcsThrust: 4000, rcsProp: 150, rcsIsp: 280, noseOffset: 2.0, cargo: 0, chuteArea: 0, ...s.craft } : null,
    ignitions: 0, firing: false, throttle: 0, active: n,
  };
}
export const stageMass = s => s.dry + s.prop + (s.craft ? s.craft.cargo + s.craft.rcsProp : 0);

/** Static analysis of a configuration: per-stage mass, Δv, thrust-to-weight. */
export function analyze(cfg) {
  const stages = cfg.stages.map(completeStage), payload = cfg.payload?.mass ?? 0, fairing = cfg.payload?.fairing ?? 0;
  let above = payload, out = [], total = 0;
  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i], usable = s.prop - (s.landing.reserve || 0), m0 = above + stageMass(s) + (i === 0 ? fairing : 0) + (i === stages.length - 1 ? 0 : 0);
    const m1 = m0 - usable, dvVac = s.engine.ispVac * G0 * Math.log(m0 / m1);
    const thrustSL = s.count * s.engine.thrustSL, thrustVac = s.count * s.engine.thrustVac;
    out[i] = { ...s, m0, m1, dv: dvVac, thrustSL, thrustVac, twrSL: thrustSL / (m0 * G0), twrVac: thrustVac / (m0 * G0), burn: usable / (s.count * s.engine.mdot1) };
    above = m0 - 0;
    above = m0 - (i === 0 ? fairing : 0);
  }
  total = out.reduce((a, s) => a + s.dv, 0);
  return { stages: out, dvTotal: total, liftoffMass: out[0].m0, twr0: out[0].twrSL };
}

/* ---------------- orbital helpers ---------------- */
export function elements(W, r, v) {
  const R = len(r), V2 = dot(v, v), eps = V2 / 2 - W.mu / R, h = r[0] * v[1] - r[1] * v[0];
  const rv = dot(r, v), ev = [((V2 - W.mu / R) * r[0] - rv * v[0]) / W.mu, ((V2 - W.mu / R) * r[1] - rv * v[1]) / W.mu];
  const e = len(ev), a = eps < 0 ? -W.mu / (2 * eps) : Infinity, rp = eps < 0 ? a * (1 - e) : (h * h / W.mu) / (1 + e), ra = eps < 0 ? a * (1 + e) : Infinity;
  let tApo = Infinity, period = Infinity;
  if (eps < 0) {
    const n = Math.sqrt(W.mu / a ** 3); period = TAU / n;
    const cosE = clamp((1 - R / a) / Math.max(e, 1e-9), -1, 1), sinE = rv / (Math.max(e, 1e-9) * Math.sqrt(W.mu * a));
    const E = Math.atan2(sinE, cosE), M = wrap2(E - e * Math.sin(E));
    tApo = wrap2(Math.PI - M) / n;
  }
  return { a, e, rp, ra, hz: h, eps, tApo, period, perigeeAlt: rp - W.R, apogeeAlt: ra - W.R };
}

/* ---------------- aerodynamics ---------------- */
const cdNose = M => M < 0.8 ? 0.30 : M < 1.2 ? 0.30 + (M - 0.8) / 0.4 * 0.35 : M < 2.5 ? 0.65 - (M - 1.2) / 1.3 * 0.30 : Math.max(0.25, 0.35 - (M - 2.5) * 0.03);
const cdTail = M => M < 0.8 ? 0.85 : M < 1.2 ? 0.85 + (M - 0.8) * 0.5 : 1.05;

/* ---------------- the simulation ---------------- */
let NEXT_ID = 1;
export function createSim(cfg0) {
  const cfg = JSON.parse(JSON.stringify(cfg0));
  const W = WORLDS[cfg.world || 'earth'];
  const M = { world: W.id, goal: 'orbit', start: 'pad', orbitAlt: 250e3, dock: false, land: false, padAngle: 0, stationAlt: 420e3, stationPhase: null, gLimit: 4.5, kickDeg: 2.0, kickSpeed: 45, landingPeriAlt: null, minOrbitPeri: null, ...(cfg.mission || {}) };
  M.minOrbitPeri ??= W.atmoTop ? Math.max(W.atmoTop * 1.05, M.orbitAlt - 100e3) : M.orbitAlt * 0.9;
  const sim = { cfg, W, M, t: 0, crafts: [], station: null, events: [], samples: [], done: false, outcome: { orbit: null, docked: null, landings: [], failure: null }, focus: null, lastSample: -1 };
  const log = (text, kind = 'info') => sim.events.push({ t: sim.t, text, kind });
  sim.log = log;

  /* the launch vehicle */
  const stages = cfg.stages.map(completeStage);
  const main = newCraft('main', 'Vehicle', stages, cfg.payload?.mass ?? 0, cfg.payload?.fairing ?? 0);
  sim.crafts.push(main); sim.focus = main;
  const padPos = fromAng(M.padAngle * DEG).map(x => x * W.R);
  if (M.start === 'pad') {
    main.padH = 0.35 * geom(main).L; main.pos = padPos.map(x => x * (W.R + main.padH) / W.R); main.vel = [-W.w * main.pos[1], W.w * main.pos[0]]; main.th = ang(unit(main.pos)); main.onPad = true; main.ap.phase = 'pad';
    // Released from a balloon or carrier aircraft: start in the air, co-moving with the rotating atmosphere
    // plus any forward speed, and light the engines on release. M.release = { alt (m), speed (m/s) }.
    if (M.release && M.release.alt > 0) {
      const r = W.R + M.release.alt, up = unit(padPos), east = [-up[1], up[0]];
      main.pos = up.map(x => x * r); main.vel = [-W.w * main.pos[1] + east[0] * (M.release.speed || 0), W.w * main.pos[0] + east[1] * (M.release.speed || 0)];
      main.onPad = false; main.released = true; log(`Released at ${(M.release.alt / 1e3).toFixed(0)} km${M.release.speed ? `, ${M.release.speed} m/s` : ''}`, 'stage');
    }
  } else {
    const r = W.R + M.orbitAlt, v = Math.sqrt(W.mu / r), a0 = (M.padAngle) * DEG;
    main.pos = fromAng(a0).map(x => x * r); main.vel = rot([v, 0], a0 + Math.PI / 2).map((_, i) => i === 0 ? -Math.sin(a0) * v : Math.cos(a0) * v);
    main.th = a0 + Math.PI / 2; main.ap.phase = 'orbit'; main.stageBurnDone = true;
    sim.outcome.orbit = { perigee: M.orbitAlt, apogee: M.orbitAlt, t: 0 };
    for (const s of main.parts) s.landing = { ...s.landing };
    if (M.dock) startDock(main); else if (M.land) { main.ap.phase = 'deorbit-orient'; log(`In ${Math.round(M.orbitAlt / 1e3)} km orbit; preparing to land`); }
    else main.ap.phase = 'orbit';
  }
  if (M.dock || M.goal === 'dock') { M.dock = true; makeStation(); }

  function newCraft(role, name, parts, payload, fairing) {
    return { id: NEXT_ID++, role, name, parts, payload, fairing, pos: [0, 0], vel: [0, 0], th: 0, om: 0, mass: 0, onPad: false, alive: true,
      ap: { phase: 'idle', t: 0 }, thrust: 0, throttleCmd: 0, uCmd: null, cdOverride: null, heat: 0, peakHeat: 0, peakG: 0, peakQ: 0, gNow: 0, q: 0, mach: 0, trail: [], chute: 0, chuteDeployed: false, rcsAcc: [0, 0], rcsUsed: 0, docked: false, dvUsed: 0 };
  }
  function craftMass(c) { let m = c.payload + c.fairing; for (const s of c.parts) m += stageMass(s); return m; }
  function geom(c) { let L = 0, D = 0; for (const s of c.parts) { L += s.length; D = Math.max(D, s.diameter); } return { L: L + 1, D: D || 1 }; }

  function makeStation() {
    const r = W.R + M.stationAlt, n = Math.sqrt(W.mu / r ** 3);
    sim.station = { r, n, phase: M.stationPhase ?? Math.PI * 0.6, portOffset: M.stationPortOffset ?? 9.8, name: M.stationName || 'Station', mass: 4.2e5 };
  }
  sim.stationState = () => { const s = sim.station, p = s.phase + s.n * sim.t; const u = fromAng(p); return { pos: [u[0] * s.r, u[1] * s.r], vel: [-Math.sin(p) * s.r * s.n, Math.cos(p) * s.r * s.n], ur: u, ut: [-u[1], u[0]], angle: p }; };

  function startDock(c) { c.ap.phase = 'phasing'; log('Rendezvous: waiting for the phasing window'); }

  /* ---- environment ---- */
  function env(c) {
    const r = len(c.pos), h = r - W.R, up = [c.pos[0] / r, c.pos[1] / r];
    const vgr = [c.vel[0] + W.w * c.pos[1], c.vel[1] - W.w * c.pos[0]];          // velocity relative to the rotating air
    const rho = W.rho(h), speed = len(vgr), q = 0.5 * rho * speed * speed, mach = speed / W.sound(h);
    return { r, h, up, tan: [-up[1], up[0]], vgr, rho, speed, q, mach, p: pressure(W, h), g: W.mu / (r * r) };
  }

  /* ---- attitude ---- */
  function steer(c, uCmd, dt, agile = 0.14) {
    if (!uCmd) return;
    const err = wrap(ang(uCmd) - c.th), kp = 1.6, wmax = agile, amax = agile * 1.6;
    const wCmd = clamp(kp * err, -wmax, wmax);
    c.om += clamp(wCmd - c.om, -amax * dt, amax * dt); c.th = wrap(c.th + c.om * dt);
  }
  const agility = c => c.parts[0]?.craft ? 0.30 : c.role === 'booster' ? 0.25 : 0.14;

  /* ---- engine ---- */
  function active(c) { return c.parts[0]; }
  function thrustOf(c, thr, e) {
    const s = active(c); if (!s || thr <= 0 || s.prop <= 0) return { F: 0, mdot: 0 };
    const eng = s.engine, n = s.active, mdot = n * thr * eng.mdot1, F = Math.max(0, mdot * eng.ispVac * G0 - n * e.p * eng.Ae);
    return { F, mdot };
  }
  const maxAccel = (c, e) => { const s = active(c); if (!s) return 0; const { F } = thrustOf(c, 1, e); return F / craftMass(c); };
  function setThrottle(c, want, e, dt) {
    const s = active(c); if (!s || s.prop <= 0) { c.throttleCmd = 0; return; }
    let thr = clamp(want, 0, 1);
    if (thr > 0 && thr < s.engine.minThrottle) thr = s.engine.minThrottle;
    if (thr > 0 && !s.firing) {                         // ignition
      if (s.ignitions >= s.engine.ignitions) { thr = 0; }
      else if (s.engine.vacOnly && e.p > 0.02 * P0) { thr = 0; }
      else { s.ignitions++; s.firing = true; }
    }
    if (thr === 0) s.firing = false;
    c.throttleCmd = thr;
  }

  /* ---- predictions ---- */
  function aeroForce(c, e, vrel, nHat) {
    // drag acceleration (m/s^2) on craft c for relative velocity vrel and axis nHat
    const speed = len(vrel); if (speed < 1e-3 || e.rho <= 0) return [0, 0];
    const g = geom(c), A = Math.PI * (g.D / 2) ** 2, Aside = g.D * g.L, vh = [vrel[0] / speed, vrel[1] / speed], cosA = dot(nHat, vh), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const mach = speed / W.sound(e.h);
    let cdAx = c.cdOverride ?? (cosA >= 0 ? cdNose(mach) : cdTail(mach));
    let CdA = A * cdAx * cosA * cosA + Aside * 1.1 * sinA * sinA;
    if (c.chute > 0) CdA += c.chute * (c.parts.find(s => s.craft)?.craft.chuteArea || 0) * 1.5;
    const m = craftMass(c), f = 0.5 * e.rho * speed * speed * CdA / m;
    return [-vh[0] * f, -vh[1] * f];
  }
  /** Coast the craft forward (no thrust) and report where and how fast it reaches the ground. */
  function predictImpact(c, dtp = 0.5, tMax = 1500) {
    let pos = c.pos.slice(), vel = c.vel.slice(), t = 0; const cc = { ...c, parts: c.parts, chute: c.chute };
    const nHat = unit([-vel[0], -vel[1]]);
    while (t < tMax) {
      const r = len(pos), h = r - W.R; if (h <= 0) break;
      const e = { h, rho: W.rho(h), p: 0 }, vrel = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]];
      const a = aeroForce({ ...cc }, e, vrel, unit([-vrel[0], -vrel[1]]));
      const gm = -W.mu / (r * r * r);
      vel = [vel[0] + (gm * pos[0] + a[0]) * dtp, vel[1] + (gm * pos[1] + a[1]) * dtp];
      pos = [pos[0] + vel[0] * dtp, pos[1] + vel[1] * dtp]; t += dtp;
    }
    return { t, pos, vel, angle: ang(pos) };
  }
  /** The landing guidance law. Vertical channel follows a deceleration-limited speed profile; the horizontal
      channel removes ground-relative drift over the time left to fall; vertical thrust has priority. */
  function landingLaw(S, pos, vel, mass, nEng, vac) {
    const r = len(pos), up = [pos[0] / r, pos[1] / r], t = [-up[1], up[0]], h = r - W.R, g = W.mu / (r * r);
    const vr = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]], vz = dot(vr, up), vh = dot(vr, t), sp = len(vr);
    const hb = Math.max(h - S.hCg, 0), eng = S.engine, p = pressure(W, h);
    const Fmax = Math.max(0, nEng * eng.mdot1 * eng.ispVac * G0 - nEng * p * eng.Ae), Tmax = Fmax / mass;
    const aV = 0.85 * Math.max(Tmax - g, 0.5), vzDes = -(Math.sqrt(2 * aV * hb) * Math.min(1, 0.3 + hb / 30) + 0.5);
    let Tz = g + aV * clamp(vz / vzDes, 0, 1.2) + 0.8 * (vzDes - vz), tgo = Math.min(hb / Math.max(-vz, 3), 25), Th = -vh / Math.max(tgo, 2);
    Tz = clamp(Tz, 0, Tmax); const Thmax = Math.sqrt(Math.max(Tmax * Tmax - Tz * Tz, 0)); Th = clamp(Th, -Thmax, Thmax);
    if (hb < 60) Th = 0;                                     // no sideways corrections in the last 60 m
    const cut = hb < 1.2 && sp < 8;                           // final metre: shut down and let the legs take it
    // While a lot of horizontal speed remains, burn full throttle against the velocity (a gravity-turn landing).
    if (Math.abs(vh) > 60 && hb > 300 && sp > 20) { const d = unit([-vr[0], -vr[1]]); return { T: d.map(x => x * Tmax), Tmag: Tmax, vz, vh, sp, hb, Tmax, vzDes, retro: true, cut: false }; }
    return { T: [t[0] * Th + up[0] * Tz, t[1] * Th + up[1] * Tz], Tmag: Math.hypot(Th, Tz), vz, vh, sp, hb, Tmax, vzDes, Th, cut };
  }
  /** Fewest engines that can still stop the vehicle in the height left (more while braking hard, one at the end). */
  function pickEngines(S, pos, vel, mass, nMax) {
    const r = len(pos), up = [pos[0] / r, pos[1] / r], vr = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]], g = W.mu / (r * r);
    const hb = Math.max(r - W.R - S.hCg, 0.5), vz = Math.min(0, dot(vr, up)), sp = len(vr);
    if (Math.abs(dot(vr, [-up[1], up[0]])) > 60 && hb > 300 && sp > 20) return nMax;
    for (let k = 1; k <= nMax; k++) { const L = landingLaw(S, pos, vel, mass, k, false); if (L.Tmax * 0.9 >= g + (vz * vz) / (2 * hb) * 1.2) return k; }
    return nMax;
  }
  /** Direction to point the engine: against the velocity while braking hard, otherwise near-vertical so a late call for thrust needs no big turn. */
  function landingDir(L, pos) {
    if (L.retro) return unit(L.T);
    const up = unit(pos), t = [-up[1], up[0]], th = dot(L.T, t), tz = Math.max(dot(L.T, up), 0.6 * (W.mu / len(pos) ** 2));
    return unit([t[0] * th + up[0] * tz, t[1] * th + up[1] * tz]);
  }
  /** Fly the landing law forward from the current state (after `delay` seconds of coasting) and report the touchdown. */
  function simulateLanding(c, delay, nMax, trace) {
    const s = active(c), eng = s.engine; let pos = c.pos.slice(), vel = c.vel.slice(), m = craftMass(c), prop = s.prop;
    const S = { engine: eng, hCg: Math.max(1.5, s.length * 0.35) }, dtp = 0.25, agile = agility(c); let t = 0, thp = c.th, om = c.om;
    for (let i = 0; i < 5000; i++) {
      const r = len(pos), h = r - W.R; if (h - S.hCg <= 0) break;
      const vr = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]];
      const gm = -W.mu / (r * r * r), ae = aeroForce({ ...c, parts: c.parts, chute: 0 }, { h, rho: W.rho(h) }, vr, unit([-vr[0], -vr[1]]));
      let a = [gm * pos[0] + ae[0], gm * pos[1] + ae[1]], used = 0;
      if (t >= delay) {
        const n = pickEngines(S, pos, vel, m, nMax), L = landingLaw(S, pos, vel, m, n, true);
        const Fn = Math.max(1e-9, L.Tmax * m), thr = clamp(L.Tmag / L.Tmax, 0, 1), eff = Math.max(thr, eng.minThrottle), mdot = n * eff * eng.mdot1;
        const floorUp = L.cut || (eff * L.Tmax > L.Tmag * 1.0001 && L.vz > L.vzDes && Math.abs(L.Th || 0) < 0.25 * eff * L.Tmax);   // cannot throttle low enough: coast
        const want = landingDir(L, pos), err = wrap(ang(want) - thp), wm = agile;
        om = clamp(om + clamp(clamp(1.6 * err, -wm, wm) - om, -wm * 1.6 * dtp, wm * 1.6 * dtp), -wm, wm); thp = wrap(thp + om * dtp);
        const F = floorUp ? 0 : Math.max(0, mdot * eng.ispVac * G0 - n * pressure(W, h) * eng.Ae), d = [Math.cos(thp), Math.sin(thp)];
        if (trace && i % 8 === 0) trace.push([t.toFixed(0), (h/1e3).toFixed(2), L.vz.toFixed(0), L.vh.toFixed(0), L.Tmag.toFixed(1), L.Tmax.toFixed(1), n, L.retro ? 'R' : 'D', floorUp ? 'coast' : '', Math.round(prop)].join(' '));
        if (!floorUp && prop > 0) { a = [a[0] + d[0] * F / m, a[1] + d[1] * F / m]; used = mdot * dtp; } else if (prop <= 0) return { ok: false, v: 1e3, fuel: 0 };
      }
      vel = [vel[0] + a[0] * dtp, vel[1] + a[1] * dtp]; pos = [pos[0] + vel[0] * dtp, pos[1] + vel[1] * dtp]; t += dtp;
      if (used) { prop -= used; m -= used; if (prop < 0) return { ok: false, v: 1e3, fuel: 0 }; }
    }
    const vr = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]], up = unit(pos), v = len(vr), hs = Math.abs(dot(vr, [-up[1], up[0]]));
    return { ok: v <= 9 && hs <= 5, v, hs, fuel: s.prop - prop, t };
  }

  /* ---- burn to a target velocity (orbital manoeuvres): steer along dv, throttle to finish exactly ---- */
  function burnTo(c, vt, e, dt, tol = 0.3) {
    const dv = [vt[0] - c.vel[0], vt[1] - c.vel[1]], mag = len(dv);
    if (mag < tol) { return { done: true, dv: mag }; }
    c.uCmd = unit(dv);
    const aim = Math.abs(wrap(ang(c.uCmd) - c.th)) < 6 * DEG;
    const m = craftMass(c), s = active(c), { F } = thrustOf(c, 1, e);
    let thr = 1; if (F > 0) thr = clamp(mag * m / (F * Math.max(dt, 1e-3)), 0, 1);
    setThrottle(c, aim ? Math.max(thr, 0.001) : 0, e, dt);
    if (thr < (s?.engine.minThrottle ?? 0) * 0.5 && mag < 1.5) { c.throttleCmd = 0; if (s) s.firing = false; return { done: true, dv: mag }; }
    return { done: false, dv: mag };
  }
  const burnTime = (c, dv, e) => { const s = active(c); if (!s) return 1; const { F, mdot } = thrustOf(c, 1, e); if (F <= 0) return 1; const m0 = craftMass(c), ve = F / mdot; return ve * m0 / F * (1 - Math.exp(-dv / ve)); };
  const vCirc = r => Math.sqrt(W.mu / r);

  /* ---- staging ---- */
  function separate(c, e) {
    const s = c.parts.shift(); s.firing = false; s.throttle = 0;
    const b = newCraft('booster', `${s.name}`, [s], 0, 0);
    b.pos = c.pos.slice(); b.vel = [c.vel[0] - 0.8 * Math.cos(c.th), c.vel[1] - 0.8 * Math.sin(c.th)]; b.th = c.th; b.om = 0;
    b.ap.phase = 'sep'; b.ap.t0 = sim.t; b.launchAngle = M.padAngle * DEG; b.onGround = false;
    sim.crafts.push(b); log(`${s.name} separated at ${(e.h / 1e3).toFixed(1)} km, ${len(e.vgr).toFixed(0)} m/s`, 'stage');
    c.vel = [c.vel[0] + 0.1 * Math.cos(c.th), c.vel[1] + 0.1 * Math.sin(c.th)];
    return b;
  }

  /* ---- guidance by role ---- */
  function guideMain(c, e, dt) {
    const ap = c.ap, s = active(c);
    const T = sim.t - (ap.t0 ?? 0);
    const final = c.parts.length === 1, el = elements(W, c.pos, c.vel);
    const ht = M.orbitAlt;
    c.uCmd = null;
    switch (ap.phase) {
      case 'pad': {
        if (!ap.started) { ap.started = true; ap.t0 = sim.t; log('Ignition sequence start'); }
        setThrottle(c, clamp(T / 2.0, 0.01, 1), e, dt); c.uCmd = e.up;
        const tw = maxAccel(c, e) / e.g;
        if (T > 3.0) { if (tw > 1.0) { ap.phase = 'ascent'; ap.t0 = sim.t; c.onPad = false; log(`Liftoff, thrust-to-weight ${tw.toFixed(2)}`, 'stage'); } else { sim.done = true; sim.outcome.failure = `Cannot lift off: thrust-to-weight ${tw.toFixed(2)} is below 1.`; log(sim.outcome.failure, 'bad'); } }
        break;
      }
      case 'ascent': {
        if (!s) break;
        const vrel = e.speed;
        let u;
        if (!ap.kickAt) { u = e.up; if (vrel >= M.kickSpeed || (e.h > 600 && !c.released)) { ap.kickAt = sim.t; log(`Pitch kick ${M.kickDeg.toFixed(1)}°`); } }
        const kt = sim.t - (ap.kickAt ?? 1e9);
        if (ap.kickAt) {
          if (kt < 6) { const d = M.kickDeg * DEG * Math.min(1, kt / 2); u = rot(e.up, d); }
          else u = e.h > 80e3 || e.rho < 1e-5 ? unit(c.vel) : unit(e.vgr);
        }
        c.uCmd = u;
        // throttle: g limit
        const aFull = maxAccel(c, e); let thr = 1; if (aFull > 0) thr = clamp(M.gLimit * G0 / aFull, 0, 1);
        // stage logic
        const reserve = s.landing.reserve || 0;
        const isFinal = c.parts.length === 1 || c.parts.slice(1).every(p => p.craft);   // the last stage below any spacecraft does the insertion
        if (isFinal) {
          const vz = dot(c.vel, e.up);
          if (!ap.level && el.eps < 0 && el.apogeeAlt >= ht) {
            if (s.engine.ignitions > 1 && vz > 0) { setThrottle(c, 0, e, dt); ap.phase = 'coast-apo'; ap.t0 = sim.t; log(`Apoapsis ${(el.apogeeAlt / 1e3).toFixed(0)} km reached; coasting to circularise`, 'stage'); break; }
            ap.level = true; log('Switching to level steering to raise the periapsis', 'info');
          }
          if (ap.level) c.uCmd = levelSteer(c, e, el, ht);
          if (el.perigeeAlt >= ht - 3000 && el.eps < 0) { setThrottle(c, 0, e, dt); ap.phase = 'orbit-done'; break; }
        }
        setThrottle(c, thr, e, dt);
        if (s.prop <= reserve + 0.5) {
          setThrottle(c, 0, e, dt); ap.phase = 'meco'; ap.t0 = sim.t;
          if (isFinal) { ap.phase = 'orbit-done'; log('Final stage propellant exhausted', 'bad'); }
          else log(`${s.name} burnout (MECO)`, 'stage');
        }
        break;
      }
      case 'meco': {
        c.uCmd = unit(c.vel); setThrottle(c, 0, e, dt);
        if (T > 1.2) { separate(c, e); ap.phase = 'ullage'; ap.t0 = sim.t; }
        break;
      }
      case 'ullage': {
        c.uCmd = unit(c.vel); setThrottle(c, 0, e, dt);
        if (T > 2.5) {
          ap.phase = 'ascent'; ap.t0 = sim.t; ap.kickAt = ap.kickAt || sim.t - 100;
          const n = active(c); log(`${n.name} ignition`, 'stage');
        }
        break;
      }
      case 'coast-apo': {
        c.uCmd = unit(c.vel); setThrottle(c, 0, e, dt);
        const vNeed = vCirc(el.ra), dv = Math.max(0, vNeed - Math.sqrt(W.mu * (2 / el.ra - 1 / el.a))), tb = burnTime(c, dv, e);
        if (el.tApo <= tb / 2 + 0.5) { ap.phase = 'circularize'; ap.t0 = sim.t; log(`Circularisation burn (Δv ≈ ${dv.toFixed(0)} m/s)`, 'stage'); }
        break;
      }
      case 'circularize': {
        const rr = len(c.pos), t = unit([-c.pos[1], c.pos[0]]), vt = t.map(x => x * vCirc(rr));
        const r = burnTo(c, vt, e, dt, 1.5);
        if (r.done || !active(c) || active(c).prop <= (active(c).landing.reserve || 0) + 0.5) { setThrottle(c, 0, e, dt); ap.phase = 'orbit-done'; }
        break;
      }
      case 'orbit-done': {
        setThrottle(c, 0, e, dt); c.uCmd = unit(c.vel);
        const pe = el.perigeeAlt, ok = el.eps < 0 && pe >= M.minOrbitPeri - 1 && el.apogeeAlt <= ht * 1.35 + 50e3;
        sim.outcome.orbit = { perigee: pe, apogee: el.apogeeAlt, t: sim.t, ok };
        if (ok) { log(`Orbit achieved: ${(pe / 1e3).toFixed(0)} × ${(el.apogeeAlt / 1e3).toFixed(0)} km`, 'good'); }
        else { sim.outcome.failure = `Did not reach orbit: ${(pe / 1e3).toFixed(0)} × ${isFinite(el.apogeeAlt) ? (el.apogeeAlt / 1e3).toFixed(0) : '∞'} km.`; log(sim.outcome.failure, 'bad'); ap.phase = 'ballistic'; break; }
        ap.t0 = sim.t;
        if (c.parts.length > 1) { separate(c, e); log('Spacecraft released into orbit', 'good'); }
        if (M.dock) { startDock(c); }
        else if (M.land) { ap.phase = 'deorbit-orient'; log('Orbit held; starting deorbit sequence'); }
        else { ap.phase = 'orbit'; ap.finishAt = sim.t + 2; }
        break;
      }
      case 'orbit': { c.uCmd = unit(c.vel); setThrottle(c, 0, e, dt); if (ap.finishAt != null && sim.t > ap.finishAt && !sim.crafts.some(b => b.role === 'booster' && b.alive && !b.settled)) { sim.done = true; } break; }
      case 'phasing': guideRendezvous(c, e, dt, el); break;
      case 'hoh1': case 'transfer': case 'hoh2': case 'approach': guideRendezvous(c, e, dt, el); break;
      case 'docked': { setThrottle(c, 0, e, dt); break; }
      case 'undock': case 'deorbit-orient': case 'deorbit-burn': case 'coast-entry': case 'descent': case 'landing': guideReturn(c, e, dt, el); break;
      case 'ballistic': setThrottle(c, 0, e, dt); c.uCmd = unit(c.vel); break;
      default: setThrottle(c, 0, e, dt);
    }
    // fairing
    if (c.fairing > 0 && e.h > 105e3 && ap.phase !== 'pad') { log(`Fairing jettisoned (${c.fairing} kg)`, 'stage'); c.fairing = 0; }
  }
  /** Hold altitude: thrust vector chosen so vertical speed goes to zero at the target altitude. */
  function levelSteer(c, e, el, ht) {
    const vh = dot(c.vel, e.tan), vz = dot(c.vel, e.up), s = active(c), a = Math.max(1, maxAccel(c, e));
    const geff = W.mu / (e.r * e.r) - vh * vh / e.r, vzDes = clamp((W.R + ht - e.r) * 0.01, -30, 80);
    const sin = clamp((geff + 0.6 * (vzDes - vz)) / a, -0.35, 0.9);
    const cs = Math.sqrt(1 - sin * sin);
    return [e.tan[0] * cs + e.up[0] * sin, e.tan[1] * cs + e.up[1] * sin];
  }

  /* ---- rendezvous and docking ---- */
  function guideRendezvous(c, e, dt, el) {
    const ap = c.ap, st = sim.stationState(), S = sim.station, rs = S.r, ns = S.n;
    const rc = len(c.pos), phiC = ang(c.pos), phiS = st.angle;
    c.uCmd = unit(c.vel); setThrottle(c, 0, e, dt);
    const alpha = wrap(phiS - phiC);
    if (ap.phase === 'phasing') {
      if (!isFinite(el.a) || el.e > 0.03) { /* need a near-circular orbit first */ }
      const aT = (rc + rs) / 2, tH = Math.PI * Math.sqrt(aT ** 3 / W.mu), aReq = Math.PI - ns * tH;
      const n1 = Math.sqrt(W.mu / rc ** 3), rate = ns - n1;
      if (Math.abs(rate) < 1e-7 || Math.abs(rc - rs) < 2000) { ap.phase = 'approach'; log('Already co-orbital; beginning proximity operations'); return; }
      const dvEst = Math.abs(Math.sqrt(W.mu * (2 / rc - 1 / aT)) - Math.sqrt(W.mu / rc)), lead = burnTime(c, dvEst, e) / 2 + 2;
      const err = wrap(alpha - aReq); ap.err = err;
      const going = -rate;               // d(err)/dt
      // simple trigger: within lead time of crossing zero
      const tToZero = going !== 0 ? -err / going : Infinity; ap.tToZero = tToZero;
      if (tToZero >= -1 && tToZero <= lead) { ap.phase = 'hoh1'; ap.t0 = sim.t; ap.hohTarget = rs; log(`Transfer burn: ${(rc - W.R) / 1e3 | 0} → ${(rs - W.R) / 1e3 | 0} km`, 'stage'); }
    }
    if (ap.phase === 'hoh1') {
      const aT = (rc + ap.hohTarget) / 2, vT = Math.sqrt(W.mu * (2 / rc - 1 / aT));
      const dir = unit(e.vgr.map((_, i) => c.vel[i])); const vt = dir.map(x => x * vT);
      const r = burnTo(c, vt, e, dt, 0.3);
      if (r.done) { ap.phase = 'transfer'; ap.t0 = sim.t; log('Transfer orbit established', 'stage'); }
    } else if (ap.phase === 'transfer') {
      c.uCmd = unit(c.vel);
      const dv = Math.max(0, vCirc(el.ra) - Math.sqrt(W.mu * (2 / el.ra - 1 / el.a))), tb = burnTime(c, Math.abs(dv), e);
      if (el.tApo <= tb / 2 + 0.5 || (sim.t - ap.t0) > el.period) { ap.phase = 'hoh2'; ap.t0 = sim.t; log('Arrival burn to match the station orbit', 'stage'); }
    } else if (ap.phase === 'hoh2') {
      const t = unit([-c.pos[1], c.pos[0]]), vt = t.map(x => x * vCirc(rc));
      const r = burnTo(c, vt, e, dt, 0.3);
      if (r.done) { ap.phase = 'approach'; ap.t0 = sim.t; ap.hold = 0; const d = len([c.pos[0] - st.pos[0], c.pos[1] - st.pos[1]]); log(`Rendezvous burns complete; range ${(d / 1e3).toFixed(1)} km`, 'stage'); }
    } else if (ap.phase === 'approach') proximity(c, e, dt, st, S);
  }
  function proximity(c, e, dt, st, S) {
    const ap = c.ap, sc = c.parts[c.parts.length - 1], cr = sc.craft;
    if (!cr) { sim.outcome.failure = 'The top stage has no spacecraft systems (RCS and docking port) to dock with.'; sim.done = true; return; }
    const n = S.n, m = craftMass(c), aMax = Math.max(0.01, cr.rcsThrust / m);
    const dS = S.portOffset, dC = cr.noseOffset;
    const D = [c.pos[0] - st.pos[0], c.pos[1] - st.pos[1]];
    const x = dot(D, st.ur), y = dot(D, st.ut);
    const vr = [c.vel[0] - st.vel[0] + n * D[1], c.vel[1] - st.vel[1] - n * D[0]];   // relative velocity in the rotating frame
    const vx = dot(vr, st.ur), vy = dot(vr, st.ut);
    // Approach along the station's orbit, from whichever side the chaser is on; the station has a port at each end.
    if (ap.side == null) ap.side = y < 0 ? 1 : -1;
    const sgn = ap.side, yS = sgn * y, vS = sgn * vy, goalS = -(dS + dC), gap = goalS - yS;    // gap > 0 while short of the port
    const range = Math.hypot(x, y);
    ap.range = range; ap.gapY = gap; ap.lat = x; ap.closing = vS;
    const uAx = [st.ut[0] * sgn, st.ut[1] * sgn];
    c.uCmd = uAx;
    const attErr = wrap(c.th - ang(uAx));
    const g = Math.max(gap, 0);
    let vsDes = Math.max(0.12, Math.min(0.5 * Math.sqrt(2 * aMax * Math.max(g - 2, 0)), 0.01 * g + 0.3));
    if (g < 0.4) vsDes = 0.12;
    const lateralTol = 0.02 * g + 0.15;
    const factor = clamp(1.3 - Math.abs(x) / lateralTol, 0, 1) * clamp(1.5 - Math.abs(attErr) / (4 * DEG), 0, 1);
    if (g > 300) vsDes = Math.max(0.1, vsDes * Math.max(factor, 0.3)); else if (g > 20) vsDes = Math.max(0.08, vsDes * Math.max(factor, 0.15)); else vsDes *= factor;
    const vxLim = clamp(0.003 * g + 0.3, 0.3, 4), vxDes = clamp(-0.04 * x, -vxLim, vxLim), kd = 0.45;
    let ux = kd * (vxDes - vx) - 3 * n * n * x - 2 * n * vy;
    let uy = kd * (sgn * vsDes - vy) + 2 * n * vx;
    ux = clamp(ux, -aMax, aMax); uy = clamp(uy, -aMax, aMax);
    c.rcsAcc = [st.ur[0] * ux + st.ut[0] * uy, st.ur[1] * ux + st.ut[1] * uy];
    // contact
    if (gap <= 0.0) {
      const angDeg = Math.abs(attErr) / DEG, rateDeg = Math.abs(c.om) / DEG;
      const res = { lateral: Math.abs(x), closing: vS, attitude: angDeg, rate: rateDeg, t: sim.t };
      const ok = res.lateral <= 0.3 && vS >= 0.02 && vS <= 0.35 && angDeg <= 6 && rateDeg <= 1.0;
      sim.outcome.docked = { ok, ...res };
      if (ok) {
        c.docked = true; ap.phase = 'docked'; c.rcsAcc = [0, 0];
        log(`DOCKED: closing ${vS.toFixed(3)} m/s, lateral ${res.lateral.toFixed(2)} m, attitude ${angDeg.toFixed(1)}°`, 'good');
        if (M.land) { ap.phase = 'undock'; ap.t0 = sim.t; log('Dwell complete; undocking for return'); }
        else sim.done = true;
      } else {
        const why = vS > 0.35 ? `closing speed ${vS.toFixed(2)} m/s is too high` : vS < 0.02 ? 'closing speed too low to latch' : res.lateral > 0.3 ? `lateral offset ${res.lateral.toFixed(2)} m` : angDeg > 6 ? `attitude error ${angDeg.toFixed(1)}°` : `rotation rate ${rateDeg.toFixed(1)}°/s`;
        sim.outcome.failure = `Docking failed: ${why}.`; log(sim.outcome.failure, 'bad'); sim.done = true;
      }
    }
  }

  /* ---- deorbit and landing ---- */
  function guideReturn(c, e, dt, el) {
    const ap = c.ap, s = active(c), periT = (M.landingPeriAlt ?? (W.id === 'earth' ? 40e3 : W.id === 'mars' ? 10e3 : 15e3));
    switch (ap.phase) {
      case 'undock': {
        const st = sim.stationState(); c.rcsAcc = [-st.ut[0] * 0.15, -st.ut[1] * 0.15]; c.uCmd = st.ut; setThrottle(c, 0, e, dt);
        const D = [c.pos[0] - st.pos[0], c.pos[1] - st.pos[1]], y = dot(D, st.ut);
        c.docked = false;
        if (-y > 150 || sim.t - ap.t0 > 1500) { c.rcsAcc = [0, 0]; ap.phase = 'deorbit-orient'; ap.t0 = sim.t; log('Clear of the station; deorbit sequence'); }
        break;
      }
      case 'deorbit-orient': {
        c.uCmd = unit(c.vel).map(x => -x); setThrottle(c, 0, e, dt);
        if (Math.abs(wrap(c.th - ang(c.uCmd))) < 3 * DEG && Math.abs(c.om) < 0.01) { ap.phase = 'deorbit-burn'; ap.t0 = sim.t; log(`Deorbit burn: lowering periapsis to ${(periT / 1e3).toFixed(0)} km`, 'stage'); }
        break;
      }
      case 'deorbit-burn': {
        const rp = W.R + periT, r = len(c.pos), vT = Math.sqrt(2 * W.mu * rp / (r * (r + rp)));
        const dir = unit(c.vel), vt = dir.map(x => x * vT);
        const res = burnTo(c, vt, e, dt, 0.5);
        if (res.done || !active(c) || active(c).prop <= 0.5) { setThrottle(c, 0, e, dt); ap.phase = 'coast-entry'; ap.t0 = sim.t; log('Deorbit burn complete; coasting to entry', 'stage'); }
        break;
      }
      case 'coast-entry': case 'descent': {
        c.uCmd = unit(e.h > 20e3 || e.rho < 1e-4 ? c.vel : e.vgr).map(x => -x);
        setThrottle(c, 0, e, dt);
        if (s?.craft?.chuteArea > 0 && W.atmoTop && !c.chuteDeployed && e.h < 9e3 && e.speed < 400 && e.rho > 0) { c.chuteDeployed = true; c.chuteT = sim.t; log(`Parachutes deployed at ${(e.h / 1e3).toFixed(1)} km, ${e.speed.toFixed(0)} m/s`, 'stage'); }
        if (c.chuteDeployed) { c.chute = clamp((sim.t - c.chuteT) / 6, 0, 1); c.cdOverride = 1.3; }
        else if (s?.craft?.chuteArea > 0) c.cdOverride = 1.3;
        if (!c.chuteDeployed && s && s.landing.mode === 'propulsive' || (s && !s.craft?.chuteArea)) {
          if (e.h < 120e3 || !W.atmoTop) landingCheck(c, e, ap);
        }
        break;
      }
      case 'landing': landingBurn(c, e, dt); break;
    }
  }
  function landingCheck(c, e, ap) {
    ap.chk = (ap.chk || 0) + 1; const s = active(c); if (!s) return;
    if (ap.chk % 12) return;                          // about every 0.5 s
    if (e.speed < 20 && e.h > 5000) return;
    const nMax = Math.min(s.count, s.landing.engines || 1);
    const now = simulateLanding(c, 0, nMax);
    const later = simulateLanding(c, 4, nMax);
    const elp = elements(W, c.pos, c.vel), nearPeri = elp.perigeeAlt >= 0 && e.h <= elp.perigeeAlt + 6000;   // on a periapsis above ground, start there
    if ((now.ok && (!later.ok || nearPeri)) || (!now.ok && e.h < 3000)) { ap.phase = 'landing'; ap.t0 = sim.t; log(`Landing burn ignition at ${(e.h / 1e3).toFixed(2)} km, ${e.speed.toFixed(0)} m/s${now.ok ? '' : ' (late)'}`, 'stage'); }
  }
  function landingBurn(c, e, dt) {
    const s = active(c); if (!s) return;
    const hCg = Math.max(1.5, s.length * 0.35), m = craftMass(c), nMax = Math.min(s.count, s.landing.engines || 1), S = { engine: s.engine, hCg };
    const n = pickEngines(S, c.pos, c.vel, m, nMax), L = landingLaw(S, c.pos, c.vel, m, n, false);
    s.active = n; c.uCmd = L.sp < 4 ? e.up : landingDir(L, c.pos);
    const thr = L.Tmax > 0 ? clamp(L.Tmag / L.Tmax, 0, 1) : 0;
    if (L.cut || (thr < s.engine.minThrottle && L.vz > L.vzDes && Math.abs(L.Th || 0) < 0.25 * s.engine.minThrottle * L.Tmax)) { c.throttleCmd = 0; s.active = n; if (!s.firing) { /* idle */ } }
    else setThrottleKeep(c, thr, e, dt);
    if (e.h - hCg <= 0) touchdown(c, e);
  }
  /** Landing-phase throttle: the burn is counted as one ignition however many times it modulates. */
  function setThrottleKeep(c, want, e, dt) {
    const s = active(c); if (!s || s.prop <= 0) { c.throttleCmd = 0; return; }
    if (!s.landingLit) { if (s.ignitions >= s.engine.ignitions) { c.throttleCmd = 0; return; } s.ignitions++; s.landingLit = true; }
    s.firing = true; c.throttleCmd = Math.max(clamp(want, 0, 1), s.engine.minThrottle);
  }
  function touchdown(c, e) {
    const sp = len(e.vgr), tilt = Math.abs(wrap(c.th - ang(e.up))) / DEG, hs = Math.abs(dot(e.vgr, e.tan));
    const ok = sp <= 6.5 && tilt <= 12 && hs <= 3;
    const s = c.parts[0];
    c.alive = false; c.settled = true; c.landed = ok; c.throttleCmd = 0; if (s) s.firing = false;
    c.vel = [-W.w * c.pos[1], W.w * c.pos[0]];
    const res = { name: c.name, ok, speed: sp, tilt, horizontal: hs, prop: s ? s.prop : 0, t: sim.t, peakG: c.peakG, peakHeat: c.peakHeat, lat: ((ang(c.pos) - (M.padAngle * DEG + W.w * sim.t)) % TAU) };
    const dr = wrap(ang(c.pos) - (M.padAngle * DEG + W.w * sim.t)) * W.R; res.downrange = dr;
    sim.outcome.landings.push(res);
    log(ok ? `${c.name} LANDED: ${sp.toFixed(1)} m/s, tilt ${tilt.toFixed(1)}°, ${(dr / 1e3).toFixed(1)} km from the pad, ${(res.prop).toFixed(0)} kg propellant left` : `${c.name} CRASHED: ${sp.toFixed(1)} m/s (limit 6.5), tilt ${tilt.toFixed(1)}°`, ok ? 'good' : 'bad');
  }

  function guideBooster(c, e, dt) {
    const ap = c.ap, s = active(c), T = sim.t - ap.t0, land = s.landing;
    c.uCmd = null; c.throttleCmd = 0;
    const pad = (M.padAngle * DEG + W.w * sim.t);
    switch (ap.phase) {
      case 'sep':
        c.uCmd = unit(c.vel);
        if (land.mode !== 'propulsive') { if (T > 5) ap.phase = 'ballistic'; break; }
        if (T > 3) { ap.phase = land.site === 'rtls' ? 'flip' : 'coast'; ap.t0 = sim.t; log(`${c.name}: ${land.site === 'rtls' ? 'flip for boostback' : 'orienting for descent'}`); }
        break;
      case 'flip': {
        const dirH = unit(e.vgr), horiz = (() => { const vh2 = dot(e.vgr, e.tan); return e.tan.map(x => -Math.sign(vh2) * x); })();
        c.uCmd = horiz; const aimed = Math.abs(wrap(c.th - ang(horiz))) < 8 * DEG;
        if (aimed) { ap.phase = 'boostback'; ap.t0 = sim.t; s.active = Math.min(s.count, Math.max(1, land.engines || 1)); log(`${c.name}: boostback burn`, 'stage'); }
        break;
      }
      case 'boostback': {
        const vh2 = dot(e.vgr, e.tan), horiz = e.tan.map(x => -Math.sign(vh2) * x);
        c.uCmd = unit([horiz[0] * 0.97 + e.up[0] * 0.2, horiz[1] * 0.97 + e.up[1] * 0.2]);
        const aim = Math.abs(wrap(c.th - ang(c.uCmd))) < 10 * DEG;
        setThrottle(c, (aim || s.firing) ? 1 : 0, e, dt);
        ap.chk = (ap.chk || 0) + 1;
        if (ap.chk % 3 === 0 || s.prop <= (land.reserve || 0)) {
          const pr = predictImpact(c, 1.0), miss = wrap(pr.angle - (M.padAngle * DEG + W.w * (sim.t + pr.t))) * W.R;
          ap.miss = miss;
          if (miss <= 1500 || s.prop <= (land.reserve || 0) * 0.22 + 0.5 || T > 200) { setThrottle(c, 0, e, dt); ap.phase = 'coast'; ap.t0 = sim.t; log(`${c.name}: boostback cutoff, predicted miss ${(miss / 1e3).toFixed(1)} km`, 'stage'); }
        }
        break;
      }
      case 'coast': case 'descent': {
        c.uCmd = unit(e.h > 20e3 || e.rho < 1e-4 ? c.vel : e.vgr).map(x => -x); c.cdOverride = null;
        s.active = Math.min(s.count, Math.max(1, land.engines || 1));
        if (e.h < 100e3 || !W.atmoTop) landingCheck(c, e, ap);
        if (e.h < 0) { c.alive = false; }
        break;
      }
      case 'landing': landingBurn(c, e, dt); break;
      case 'ballistic': c.uCmd = unit(e.vgr.map((_, i) => c.vel[i])); break;
    }
    // loss of an unpowered stage
    if (c.alive && e.h <= 0) {
      c.alive = false; c.settled = true;
      if (ap.phase !== 'landing') { sim.outcome.landings.push({ name: c.name, ok: false, expended: land.mode !== 'propulsive', speed: len(e.vgr), t: sim.t, downrange: wrap(ang(c.pos) - pad) * W.R }); log(`${c.name} ${land.mode === 'propulsive' ? 'impacted without landing' : 'expended into the sea'} (${len(e.vgr).toFixed(0)} m/s)`, land.mode === 'propulsive' ? 'bad' : 'info'); }
    }
  }

  /* ---- one physics step for one craft ---- */
  function stepCraft(c, dt) {
    const e = env(c);
    c.uCmd = null; c.rcsAcc = c.rcsAcc || [0, 0];
    if (c.role === 'main') { c.rcsAcc = [0, 0]; guideMain(c, e, dt); } else guideBooster(c, e, dt);
    if (!c.alive && c.role === 'booster') return;
    { const s0 = active(c); if (s0 && c.throttleCmd <= 0) s0.firing = false; }
    if (c.docked) { const st = sim.stationState(); c.pos = [st.pos[0] - st.ut[0] * (sim.station.portOffset + 3), st.pos[1] - st.ut[1] * (sim.station.portOffset + 3)]; c.vel = st.vel.slice(); return; }
    steer(c, c.uCmd, dt, agility(c));
    const s = active(c), m = craftMass(c);
    let F = 0, mdot = 0;
    if (s && c.throttleCmd > 0 && s.prop > 0) { const t = thrustOf(c, c.throttleCmd, e); F = t.F; mdot = t.mdot; if (mdot * dt > s.prop) { const f = s.prop / (mdot * dt); F *= f; mdot *= f; } }
    c.thrust = F; c.mdotNow = mdot;
    const nHat = [Math.cos(c.th), Math.sin(c.th)];
    // RCS translation
    let rcs = [0, 0];
    if (c.role === 'main' && (c.rcsAcc[0] || c.rcsAcc[1])) {
      const cr = c.parts[c.parts.length - 1].craft;
      if (cr && cr.rcsProp > 0) {
        // body-axis limit: each axis independently limited
        const aMax = cr.rcsThrust / m, along = dot(c.rcsAcc, nHat), lat = dot(c.rcsAcc, [-nHat[1], nHat[0]]);
        const a1 = clamp(along, -aMax, aMax), a2 = clamp(lat, -aMax, aMax);
        rcs = [nHat[0] * a1 - nHat[1] * a2, nHat[1] * a1 + nHat[0] * a2];
        const use = (Math.abs(a1) + Math.abs(a2)) * m / (cr.rcsIsp * G0) * dt; cr.rcsProp = Math.max(0, cr.rcsProp - use); c.rcsUsed += use;
      }
    }
    const aThr = F / m;
    // kick-drift-kick (gravity), drag evaluated at the half step
    const acc = (pos, vel) => {
      const r = len(pos), g = -W.mu / (r * r * r), eh = { h: r - W.R, rho: W.rho(r - W.R) };
      const vrel = [vel[0] + W.w * pos[1], vel[1] - W.w * pos[0]];
      const ad = eh.rho > 0 ? aeroForce(c, eh, vrel, nHat) : [0, 0];
      return [g * pos[0] + ad[0] + nHat[0] * aThr + rcs[0], g * pos[1] + ad[1] + nHat[1] * aThr + rcs[1]];
    };
    const a1 = acc(c.pos, c.vel), vh = [c.vel[0] + a1[0] * dt / 2, c.vel[1] + a1[1] * dt / 2];
    c.pos = [c.pos[0] + vh[0] * dt, c.pos[1] + vh[1] * dt];
    const a2 = acc(c.pos, vh); c.vel = [vh[0] + a2[0] * dt / 2, vh[1] + a2[1] * dt / 2];
    if (s && mdot > 0) { s.prop -= mdot * dt; if (s.prop <= 0) { s.prop = 0; s.firing = false; } c.dvUsed += F / m * dt; }
    // pad hold
    const r2 = len(c.pos);
    if (c.onPad && r2 <= W.R + c.padH + 0.01) {
      const up = unit(c.pos), vv = dot(c.vel, up);
      if (vv < 0.5 || a1[0] * up[0] + a1[1] * up[1] < 0) { c.pos = up.map(x => x * (W.R + c.padH)); c.vel = [-W.w * c.pos[1], W.w * c.pos[0]]; }
    }
    // telemetry
    const e2 = env(c); c.gNow = (aThr + 0) / G0; c.q = e2.q; c.mach = e2.mach; c.peakQ = Math.max(c.peakQ, e2.q);
    c.heat = e2.rho > 0 ? 1.7415e-4 * Math.sqrt(e2.rho / Math.max(0.3, geom(c).D / 2)) * e2.speed ** 3 : 0; c.peakHeat = Math.max(c.peakHeat, c.heat);
    const aTot = Math.hypot(a2[0] + W.mu * c.pos[0] / r2 ** 3, a2[1] + W.mu * c.pos[1] / r2 ** 3) / G0; c.gNow = aTot; c.peakG = Math.max(c.peakG, aTot);
    // ground contact for everything that is not mid-landing
    if (!c.onPad && c.alive && r2 < W.R - 0.5 && c.role === 'main' && c.ap.phase !== 'pad') {
      if (!['landing', 'descent', 'coast-entry', 'deorbit-orient', 'deorbit-burn', 'undock', 'ballistic', 'ascent', 'meco', 'ullage', 'circularize', 'coast-apo', 'phasing', 'hoh1', 'transfer', 'hoh2', 'approach'].includes(c.ap.phase)) return;
      c.alive = false;
      if (c.chuteDeployed) {
        const sp = len(env(c).vgr), vv = sp; // splashdown/landing under canopy
        const ok = vv <= 12; sim.outcome.landings.push({ name: c.name, ok, speed: vv, tilt: 0, prop: 0, t: sim.t, chute: true, peakG: c.peakG, peakHeat: c.peakHeat, downrange: wrap(ang(c.pos) - M.padAngle * DEG) * W.R });
        log(ok ? `${c.name} LANDED under parachutes at ${vv.toFixed(1)} m/s` : `${c.name} hit the ground at ${vv.toFixed(1)} m/s`, ok ? 'good' : 'bad');
      } else { const sp = len(env(c).vgr); sim.outcome.landings.push({ name: c.name, ok: false, speed: sp, t: sim.t, peakG: c.peakG }); sim.outcome.failure = sim.outcome.failure || `Impact at ${sp.toFixed(0)} m/s.`; log(`${c.name} impacted at ${sp.toFixed(0)} m/s`, 'bad'); }
      c.settled = true; sim.done = true;
    }
    if (c.role === 'main' && c.landed) sim.done = true;
  }

  /* ---- time stepping ---- */
  sim.step = function (dt) {
    for (const c of sim.crafts) if (c.alive || c.onPad) stepCraft(c, dt);
    sim.t += dt;
    // main craft landing/finish
    if (main.settled && !sim.done) sim.done = true;
    // finish when main and all boosters have settled (or are non-recoverable debris)
    if (!sim.done && ['orbit'].includes(main.ap.phase) && !M.dock && !M.land) { if (sim.t > (main.ap.finishAt ?? 0)) { const pend = sim.crafts.some(b => b.role === 'booster' && b.alive && !b.settled && b.parts[0].landing.mode === 'propulsive'); if (!pend) sim.done = true; } }
    if (sim.t - sim.lastSample >= 0.5) { sim.lastSample = sim.t; sample(); }
    for (const c of sim.crafts) if (sim.t % 1 < dt) { c.trail.push([c.pos[0], c.pos[1]]); if (c.trail.length > 4000) c.trail.shift(); }
  };
  function sample() {
    const c = sim.focus; if (!c) return; const e = env(c), el = elements(W, c.pos, c.vel);
    sim.samples.push({ t: sim.t, alt: e.h, speed: e.speed, vOrb: len(c.vel), g: c.gNow, q: e.q, mach: e.mach, mass: craftMass(c), prop: c.parts.reduce((a, s) => a + s.prop, 0), heat: c.heat, thrust: c.thrust, pe: el.perigeeAlt, ap: isFinite(el.apogeeAlt) ? el.apogeeAlt : null });
    if (sim.samples.length > 20000) sim.samples.splice(0, 5000);
  }
  /** Choose a step size from what the craft is doing. */
  sim.dtFor = function () {
    let dt = 0.5;
    for (const c of sim.crafts) {
      if (!c.alive && !c.onPad) continue;
      const e = env(c), busy = c.throttleCmd > 0 || e.rho > 1e-9 || ['pad', 'ullage', 'meco', 'deorbit-orient', 'approach', 'landing', 'flip', 'boostback', 'sep', 'hoh1', 'hoh2', 'circularize', 'undock', 'descent', 'coast'].includes(c.ap.phase);
      if (busy) dt = Math.min(dt, c.ap.phase === 'approach' ? 0.1 : c.ap.phase === 'landing' ? 0.02 : 0.04);
      if (c.ap.phase === 'coast-apo' || c.ap.phase === 'transfer' || c.ap.phase === 'phasing') { const el = elements(W, c.pos, c.vel); if (el.tApo < 60) dt = Math.min(dt, 0.1); }
      if (c.ap.phase === 'phasing' && c.ap.tToZero != null && c.ap.tToZero < 40) dt = Math.min(dt, 0.1);
    }
    return dt;
  };
  sim.advance = function (seconds, maxSteps = 200000) {
    const end = sim.t + seconds; let n = 0;
    while (sim.t < end && !sim.done && n++ < maxSteps) { sim.step(Math.min(sim.dtFor(), end - sim.t) || 0.01); }
    // when the main craft has finished but a booster is still flying, keep going; otherwise done
    return sim;
  };
  sim.run = function (tMax = 40000) { while (!sim.done && sim.t < tMax) sim.advance(60); if (!sim.done) { sim.outcome.failure = sim.outcome.failure || 'Timed out.'; } return sim; };
  sim._simLanding = simulateLanding; sim.env = env; sim.craftMass = craftMass; sim.elementsOf = c => elements(W, c.pos, c.vel); sim.geom = geom;
  return sim;
}

/* ---------------- tools built on the simulation ---------------- */
/** Run only until the launch reaches (or fails to reach) orbit. */
export function runAscent(cfg, tMax = 2500) {
  const sim = createSim({ ...cfg, mission: { ...cfg.mission, start: 'pad', dock: false, land: false, goal: 'orbit' } });
  while (!sim.done && !sim.outcome.orbit && sim.t < tMax) sim.advance(10);
  return sim;
}
/** Search the pitch-over angle that reaches orbit with the most propellant left. */
export function tuneAscent(cfg, { lo = 1, hi = 14 } = {}) {
  const score = k => {
    const sim = runAscent({ ...cfg, mission: { ...cfg.mission, kickDeg: k } }), o = sim.outcome.orbit;
    const left = sim.crafts[0].parts.reduce((a, s) => a + s.prop, 0);
    if (o && o.ok && o.perigee >= (cfg.mission?.orbitAlt ?? 250e3) - 40e3) return { k, ok: true, score: left, o };
    return { k, ok: false, score: -1e9 + (o ? Math.max(o.perigee, -6e6) : -6e6), o };
  };
  let best = null; const tried = [];
  for (let k = lo; k <= hi; k += 1) { const r = score(k); tried.push(r); if (!best || r.score > best.score) best = r; }
  for (const d of [0.5, 0.25]) for (const k of [best.k - d, best.k + d]) { if (k < 0.2) continue; const r = score(k); tried.push(r); if (r.score > best.score) best = r; }
  return { kickDeg: best.k, ok: best.ok, orbit: best.o, propLeft: best.ok ? best.score : 0, tried };
}

/** Choose the station's starting phase so a Hohmann rendezvous window opens shortly after orbit insertion. */
export function planDock(cfg, wait = 0.4) {
  const W = WORLDS[cfg.world || 'earth'], M = cfg.mission || {}, hs = M.stationAlt ?? 420e3;
  let tI = 0, aI, r1;
  if ((M.start || 'pad') === 'pad') {
    const sim = runAscent({ ...cfg, mission: { ...M, dock: false } });
    const c = sim.crafts[0];
    if (!sim.outcome.orbit?.ok) return { ...cfg, mission: { ...M, dock: true } };
    tI = sim.t; aI = Math.atan2(c.pos[1], c.pos[0]); r1 = Math.hypot(c.pos[0], c.pos[1]);
  } else { aI = (M.padAngle || 0) * DEG; r1 = W.R + (M.orbitAlt ?? 250e3); }
  const r2 = W.R + hs, n1 = Math.sqrt(W.mu / r1 ** 3), n2 = Math.sqrt(W.mu / r2 ** 3), aT = (r1 + r2) / 2, tH = Math.PI * Math.sqrt(aT ** 3 / W.mu);
  const tb = tI + wait * TAU / n1, phiC = aI + n1 * (tb - tI);
  return { ...cfg, mission: { ...M, dock: true, stationPhase: wrap2(phiC + Math.PI - n2 * tH - n2 * tb) } };
}
