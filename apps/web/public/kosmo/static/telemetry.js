// telemetry.js -- the one telemetry stream for the Shipyard and the Landing Lab. Pure ES module (no DOM), so it runs in node
// (telemetry.test.mjs) and in both pages.
//
//   formatters        fmt.km / kmps / minsec / pct / deg / clock: the units every readout uses (km, km/s, min:s, '--' when undefined)
//   orbitFromState    apoapsis, periapsis, period, eccentricity, time to apoapsis and periapsis from a position and velocity
//   stageDeltaV       rocket-equation delta-v per attached stage (est.: the sims do not track a live delta-v budget)
//   attitude          pitch and flight-path angle of a craft
//   telemetryPayload  the fixed-key payload for one sim object (Shipyard craft or Landing Lab run)
//   postTelemetry     posts { type:'flightlab:telemetry', v:1, mode, ...payload } to window.parent, at most 4 Hz, only when framed
//
// The payload schema and units are documented in TELEMETRY.md next to this file. The field names are a contract with the Flight
// Lab shell: do not rename them.

import { elements, stageMass, G0 } from './ship-sim.js';

export const TELEMETRY_TYPE = 'flightlab:telemetry';
export const TELEMETRY_VERSION = 1;
export const TELEMETRY_MIN_INTERVAL_MS = 250;                       // 4 Hz at most
export const TELEMETRY_FIELDS = Object.freeze(['t', 'phase', 'name', 'altitude', 'speed', 'vv', 'apo', 'peri', 'period', 'twr', 'dvStage',
  'dvTotal', 'propellantPct', 'stage', 'stages', 'g', 'q', 'mach', 'event']);

const DASH = '--';
const RAD = 180 / Math.PI;
const fin = x => typeof x === 'number' && Number.isFinite(x);
const pad2 = n => String(n).padStart(2, '0');
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

/* ---------------- formatters ---------------- */
export const fmt = {
  /** Metres to km: 0 decimals from 100 km, 1 from 10 km, 2 below. */
  km(m) {
    if (!fin(m)) return DASH;
    const k = m / 1e3, a = Math.abs(k), d = a >= 100 ? 0 : a >= 10 ? 1 : 2;
    return `${k.toFixed(d)} km`;
  },
  /** m/s to km/s, two decimals. */
  kmps(v) { return fin(v) ? `${(v / 1e3).toFixed(2)} km/s` : DASH; },
  /** Seconds to min:s (minutes are not wrapped at an hour: a 91-minute orbit reads 91:24). */
  minsec(s) { return fin(s) && s >= 0 ? `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}` : DASH; },
  /** Fraction (0..1) or percent to a whole percent. */
  pct(p) { return fin(p) ? `${Math.round(p)}%` : DASH; },
  deg(d) { return fin(d) ? `${d.toFixed(1)}°` : DASH; },
  /** Mission clock: m:ss, or h:mm:ss from an hour on (the Shipyard's T+ format). */
  clock(t) {
    if (!fin(t)) return DASH;
    const s = Math.max(0, Math.floor(t)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + ':' + pad2(m) : m) + ':' + pad2(ss);
  },
};

/* ---------------- orbit ---------------- */
/** Orbital elements of a state, as the HUDs show them. Altitudes are above the surface (m). Suborbital (bound, periapsis under the
 *  surface): the periapsis is negative and flagged `belowSurface`; apoapsis and period are the real values. Escape: apoapsis and period
 *  null, `escape` true. */
export function orbitFromState(W, r, v) {
  const el = elements(W, r, v), bound = el.eps < 0;
  const peri = fin(el.perigeeAlt) ? el.perigeeAlt : null;
  const period = bound && fin(el.period) ? el.period : null;
  const tApo = bound && fin(el.tApo) ? el.tApo : null;
  return {
    apo: bound && fin(el.apogeeAlt) ? el.apogeeAlt : null,
    peri,
    period,
    ecc: fin(el.e) ? el.e : null,
    tApo,
    tPeri: period != null && tApo != null ? (tApo + period / 2) % period : null,   // periapsis is half an orbit from apoapsis
    escape: !bound,
    belowSurface: peri != null && peri < 0,
  };
}

/* ---------------- delta-v (est.) ---------------- */
/** Rocket-equation delta-v of every stage still attached to a Shipyard craft (craft.parts[0] is the active stage). Same convention as
 *  ship-sim analyze(): the usable propellant is prop minus the landing reserve, and the vacuum Isp is used. Each stage's mass
 *  includes everything above it, the payload and the fairing while it is attached. Values are estimates from the live masses. */
export function stageDeltaV(craft) {
  const parts = craft.parts || [], per = new Array(parts.length);
  let above = (craft.payload || 0) + (craft.fairing || 0), total = 0;
  for (let k = parts.length - 1; k >= 0; k--) {
    const s = parts[k], m0 = above + stageMass(s), usable = Math.max(0, s.prop - (s.landing?.reserve || 0)), m1 = m0 - usable;
    const dv = usable > 0 && m1 > 0 ? s.engine.ispVac * G0 * Math.log(m0 / m1) : 0;
    per[k] = { dv, usable, burnTime: usable > 0 ? usable / ((s.active || s.count) * s.engine.mdot1) : 0 };
    above = m0; total += dv;
  }
  return { perStage: per, total };
}

/* ---------------- attitude ---------------- */
/** Pitch: the body axis above the local horizontal (90 = straight up). Flight-path angle: the surface-relative velocity above the local
 *  horizontal. `env` is sim.env(craft). */
export function attitude(craft, env) {
  const n = [Math.cos(craft.th), Math.sin(craft.th)], up = env.up, tan = env.tan;
  const pitch = Math.atan2(dot(n, up), dot(n, tan)) * RAD;
  const sp = Math.hypot(env.vgr[0], env.vgr[1]);
  const fpa = sp > 1e-6 ? Math.atan2(dot(env.vgr, up), dot(env.vgr, tan)) * RAD : null;
  return { pitch, fpa };
}

/** Largest dynamic pressure up to time t, from a sim's samples (sorted by t), and the current value `now` = { q, t } (the samples are
 *  0.5 s apart, so the current value is included). Returns { q, t } (t null before any sample). */
export function maxQFromSamples(samples, t, now = null) {
  let best = { q: 0, t: null };
  for (const s of samples || []) { if (s.t > t + 1e-9) break; if (s.q > best.q) best = { q: s.q, t: s.t }; }
  if (now && now.q > best.q) best = { q: now.q, t: now.t };
  return best;
}

/* ---------------- payload ---------------- */
const lastText = evs => (evs && evs.length ? (evs[evs.length - 1].text ?? evs[evs.length - 1].txt ?? null) : null);
const nz = x => (fin(x) ? x : null);

/** Shipyard: the main vehicle of a running sim (sim.crafts[0]). `stage` is the design's stage number of the stage being flown (1 =
 *  bottom), `stages` the number designed. */
export function shipyardTelemetry(sim, craft = sim.crafts[0]) {
  const c = craft, e = sim.env(c), o = orbitFromState(sim.W, c.pos, c.vel);
  const twr = c.thrust > 0 ? c.thrust / (sim.craftMass(c) * e.g) : 0;
  const dv = stageDeltaV(c), N = sim.cfg?.stages?.length ?? c.parts.length;
  const propMax = c.parts.reduce((a, s) => a + s.propMax, 0), prop = c.parts.reduce((a, s) => a + s.prop, 0);
  return {
    t: sim.t, phase: c.ap.phase, name: c.name, altitude: Math.max(e.h, 0), speed: e.speed, vv: dot(e.vgr, e.up),
    apo: o.apo, peri: o.peri, period: o.period, twr: nz(twr), dvStage: nz(dv.perStage[0]?.dv ?? null), dvTotal: nz(dv.total),
    propellantPct: propMax > 0 ? prop / propMax * 100 : null, stage: N - c.parts.length + 1, stages: N,
    g: nz(c.gNow), q: nz(e.q), mach: nz(e.mach), event: lastText(sim.events),
  };
}

/** Landing Lab: the one stage being landed (createLanding's api). Orbit fields are null; delta-v is the rocket-equation estimate
 *  from the live mass down to the dry mass. */
export function landingTelemetry(sim) {
  const s = sim.s, v = sim.veh, W = v.W, h = Math.max(s.y - v.yf, 0), sp = Math.hypot(s.vx, s.vy);
  const g = W.mu / (W.R + h) ** 2, dv = s.m > v.dry ? v.eng.ispVac * G0 * Math.log(s.m / v.dry) : 0;
  return {
    t: s.t, phase: sim.phase, name: v.name, altitude: h, speed: sp, vv: s.vy,
    apo: null, peri: null, period: null, twr: nz(s.thrust / (s.m * g)), dvStage: nz(dv), dvTotal: nz(dv),
    propellantPct: sim.prop0 > 0 ? s.prop / sim.prop0 * 100 : null, stage: 1, stages: 1,
    g: nz(s.gload || 0), q: nz(s.q || 0), mach: nz(sp / W.sound(h)), event: lastText(sim.events),
  };
}

/** The payload for either sim: a Shipyard sim has `crafts`, a Landing Lab run has `veh`. Keys are always TELEMETRY_FIELDS, in order. */
export function telemetryPayload(sim) {
  const mode = sim.crafts ? 'shipyard' : 'landing';
  const p = mode === 'shipyard' ? shipyardTelemetry(sim) : landingTelemetry(sim);
  const out = {}; for (const k of TELEMETRY_FIELDS) out[k] = p[k] ?? null;
  return { mode, ...out };
}

/** The status line for screen readers: 'Stage 1 burning, T+1:30', or the phase label while nothing burns. */
export function statusLine(p, phaseLabel = '') {
  const burning = p.mode === 'shipyard' && p.twr > 0;
  return `${burning ? `Stage ${p.stage} burning` : phaseLabel || p.phase || 'Ready'}, T+${fmt.clock(p.t)}`;
}

/** Post the message to the parent frame, at most every TELEMETRY_MIN_INTERVAL_MS, and only when this page is framed. `gate` is an
 *  object the caller keeps between calls ({ last }). Returns true when a message was posted. */
export function postTelemetry(win, payload, now, gate = { last: -Infinity }) {
  if (!win || !win.parent || win.parent === win) return false;
  const origin = win.location?.origin;
  if (!origin || origin === 'null') return false;                  // no real origin to target: post nothing
  if (now - gate.last < TELEMETRY_MIN_INTERVAL_MS) return false;
  gate.last = now;
  try { win.parent.postMessage({ type: TELEMETRY_TYPE, v: TELEMETRY_VERSION, ...payload }, origin); return true; } catch { return false; }
}

/** The stage index a hand-off request names: a 0-based index, or a stage name. Returns -1 when it names no stage (never throws). */
export function handoffIndex(stages, stage) {
  if (!Array.isArray(stages)) return -1;
  if (typeof stage === 'number' && Number.isInteger(stage) && stage >= 0 && stage < stages.length) return stage;
  if (typeof stage === 'string') return stages.findIndex(s => s && s.name === stage);
  return -1;
}
/** Whether a window message is a hand-off request from our own parent frame: same origin, from the parent, with a known type. */
export function isHandoffRequest(ev, self) {
  return !!ev && !!ev.data && typeof ev.data === 'object' && ev.data.type === 'flightlab:request-handoff'
    && ev.origin === self.location.origin && !!self.parent && self.parent !== self && ev.source === self.parent;
}
