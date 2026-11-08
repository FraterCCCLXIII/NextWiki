// flight-lab-shell.js -- the pure logic of the Flight Lab shell (flight-lab.html), as far as it can be kept out of the DOM:
// the modes and their names, the routing from the URL (?mode=, #mode=, #design=), the remembered mode, the checks on the
// messages that come from the frames, and the formatting of the vehicle bar. No DOM access at load time, so node runs it
// (flight-lab-shell.test.mjs). The page code (flight-lab.html) does the DOM work; see FLIGHT-LAB.md for the contracts.

export const SHELL_VERSION = 1;
export const TELEMETRY_TYPE = 'flightlab:telemetry';
export const LANDING_RESULT_TYPE = 'flightlab:landing-result';
export const MODE_KEY = 'kosmo.flightlab.mode';          // localStorage: the last mode shown
export const STALE_MS = 5000;                            // telemetry older than this is shown as stale

// The modes of the lab, in tab order. Plan and Review are placeholders until M4 (no route, no shortcut).
// frame: the iframe that shows the mode (its id is f-<frame>). key: the keyboard shortcut.
export const MODES = [
  { id: 'design', label: 'Design / Launch', short: 'Design', long: 'Design and launch', key: '1', frame: 'design', src: 'shipyard.html', icon: 'launch',
    hint: 'Launch, stage, rendezvous, return -- and tune any booster\'s landing in detail.' },
  { id: 'land', label: 'Land', long: 'Landing', key: '2', frame: 'land', src: 'landing-lab.html', icon: 'land',
    hint: 'Terminal descent: guidance algorithms, noise, wind, Monte Carlo, neural policy.' },
  { id: 'ascent', label: 'Micro Ascent', short: 'Ascent', key: '3', frame: 'ascent', src: 'micro-ascent/index.html', icon: 'orbit',
    hint: 'Micro Ascent: boosters, engines, stations, balloons -- a 3D concept explorer (illustrative, not for flight).' },
  { id: 'plan', label: 'Plan', soon: 'M4', icon: 'plan' },
  { id: 'review', label: 'Review', soon: 'M4', icon: 'review' },
];

// Earlier names of the modes (the old tabs and hashes: #mission, #landing, #concepts) still route.
const LEGACY = { mission: 'design', landing: 'land', concepts: 'ascent' };

export const modeById = id => MODES.find(m => m.id === id) || null;

/** A routable mode id for a name (or a legacy name), or null. Placeholder modes are not routable. */
export function normalizeMode(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  const id = Object.hasOwn(LEGACY, v) ? LEGACY[v] : v;
  const m = modeById(id);
  return m && !m.soon ? m.id : null;
}

/** The mode for a keyboard key ('1' to '3'), or null. */
export function modeForKey(key) {
  const m = MODES.find(x => !x.soon && x.key === key);
  return m ? m.id : null;
}

// A design link carries a share string (lab-store.js: 'z' or 'j' plus base64url), never anything else.
export const DESIGN_RE = /^[A-Za-z0-9_-]{1,8000}$/;
const safeDecode = s => { try { return decodeURIComponent(s); } catch { return s; } };

/** The route in a location hash: "#mode=land&design=<share>", "#design=<share>", or a legacy bare name ("#landing"). */
export function parseHash(hash) {
  let s = String(hash ?? '');
  if (s.startsWith('#')) s = s.slice(1);
  if (!s) return { mode: null, design: null };
  if (!s.includes('=')) return { mode: normalizeMode(safeDecode(s)), design: null };
  const q = new URLSearchParams(s);
  const design = q.get('design');
  return { mode: normalizeMode(q.get('mode')), design: design && DESIGN_RE.test(design) ? design : null };
}

/** The whole route: ?mode= in the query, then the hash. Unknown or placeholder modes give null (the stored mode decides). */
export function parseRoute(search, hash) {
  const q = new URLSearchParams(String(search ?? '').replace(/^\?/, ''));
  const h = parseHash(hash);
  return { mode: normalizeMode(q.get('mode')) || h.mode, design: h.design };
}

/** The mode to show: the route's mode; a link that carries a design opens Design; else the remembered mode; else Design. */
export function resolveMode(route, stored) {
  return (route && route.mode) || (route && route.design ? 'design' : null) || normalizeMode(stored) || 'design';
}

/** The hash the shell keeps for a mode (and the design it was opened with, if any). */
export function buildHash(mode, design) {
  const m = normalizeMode(mode) || 'design';
  return `#mode=${m}` + (design && DESIGN_RE.test(design) ? `&design=${design}` : '');
}

/** The remembered mode. Storage may be missing, blocked or hold junk: then null, and nothing throws. */
export function readStoredMode(store) {
  try { return normalizeMode(store ? store.getItem(MODE_KEY) : null); } catch { return null; }
}
/** Remember a mode. Returns true when it was written. */
export function writeStoredMode(store, mode) {
  try {
    if (!store || !normalizeMode(mode)) return false;
    store.setItem(MODE_KEY, normalizeMode(mode));
    return true;
  } catch { return false; }
}

/* ---------------- messages from the frames ---------------- */

/** The frame a message came from, or null. Only same-origin messages whose source is one of this shell's frames count.
 *  windows: { design: <window>, land: <window>, ascent: <window> } (the frames' contentWindow). */
export function frameOfMessage(event, origin, windows) {
  if (!event || !origin || event.origin !== origin || !windows) return null;
  for (const [name, win] of Object.entries(windows)) if (win && event.source === win) return name;
  return null;
}

const finite = x => (Number.isFinite(x) ? x : null);
const text = (x, n = 80) => (typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : null);
const TELEMETRY_NUMBERS = ['altitude', 'speed', 'vv', 'apo', 'peri', 'period', 'twr', 'dvStage', 'dvTotal', 'propellantPct', 'stage', 'stages', 'g', 'q', 'mach'];
// the frame each telemetry mode comes from
const TELEMETRY_SOURCE = { shipyard: 'design', landing: 'land' };

/** A telemetry message (schema v1, LAB-STORE/FLIGHT-LAB.md) checked and cleaned, or null when it is not one we can use:
 *  wrong type, unknown version, unknown mode, or no finite mission time. Numbers that are not finite become null. Units: m, m/s, s, kg. */
export function validateTelemetry(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.type !== TELEMETRY_TYPE || data.v !== 1) return null;
  if (typeof data.mode !== 'string' || !Object.hasOwn(TELEMETRY_SOURCE, data.mode)) return null;
  if (!Number.isFinite(data.t) || data.t < 0) return null;
  const out = { mode: data.mode, source: TELEMETRY_SOURCE[data.mode], t: data.t, phase: text(data.phase, 40), name: text(data.name, 60), event: text(data.event, 80) };
  for (const k of TELEMETRY_NUMBERS) out[k] = finite(data[k]);
  return out;
}

/** A landing result record (lab-store.js landingResult) checked for display, or null. */
export function validateLandingResult(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (r.kind !== 'landing-result' || r.v !== 1) return null;
  if (!['landed', 'caught', 'failed'].includes(r.status)) return null;
  return {
    status: r.status, ok: r.ok === true, stage: text(r.stage, 80), reason: text(r.reason, 200), at: text(r.at, 40), key: text(r.key, 120),
    touchdownMs: finite(r.touchdownMs), lateralMs: finite(r.lateralMs), tiltDeg: finite(r.tiltDeg), missM: finite(r.missM),
    fuelLeftKg: finite(r.fuelLeftKg), timeS: finite(r.timeS), constraintsOk: typeof r.constraintsOk === 'boolean' ? r.constraintsOk : null,
  };
}

/* ---------------- the vehicle bar ---------------- */

const dash = '--';
/** Mission time as T+ hh:mm:ss ('--' when unknown). */
export function fmtMissionTime(t) {
  if (!Number.isFinite(t)) return dash;
  const s = Math.floor(Math.max(0, t));
  const p = n => String(n).padStart(2, '0');
  return `T+ ${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
/** A distance in metres as m or km ('--' when unknown). */
export function fmtDistance(m) {
  if (!Number.isFinite(m)) return dash;
  const a = Math.abs(m);
  if (a >= 10000) return `${Math.round(m / 1000)} km`;
  if (a >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
/** A speed in m/s ('--' when unknown). */
export const fmtSpeed = ms => (Number.isFinite(ms) ? `${Math.round(ms)} m/s` : dash);
/** A mass in kg as tonnes ('--' when unknown). */
export const fmtTonnes = kg => (Number.isFinite(kg) ? `${(kg / 1000).toFixed(kg >= 1e6 ? 0 : 1)} t` : dash);
/** A delta-v in m/s as m/s or km/s ('--' when unknown). */
export const fmtDeltaV = ms => (Number.isFinite(ms) ? (Math.abs(ms) >= 1000 ? `${(ms / 1000).toFixed(2)} km/s` : `${Math.round(ms)} m/s`) : dash);

/** The strip's text for a telemetry sample (or none). Apo/peri in km. */
export function stripModel(sample) {
  if (!sample) return { phase: dash, t: dash, alt: dash, speed: dash, apoPeri: dash, dv: dash, source: 'waiting for telemetry' };
  const km = m => (Number.isFinite(m) ? `${Math.round(m / 1000)}` : dash);
  return {
    phase: sample.phase || dash,
    t: fmtMissionTime(sample.t),
    alt: fmtDistance(sample.altitude),
    speed: fmtSpeed(sample.speed),
    apoPeri: sample.apo == null && sample.peri == null ? dash : `${km(sample.apo)} / ${km(sample.peri)} km`,
    dv: fmtDeltaV(sample.dvTotal),
    source: sample.source === 'land' ? 'Land' : 'Design',
  };
}

/** True when the last telemetry is older than STALE_MS (or there is none). */
export const isStale = (lastAt, now) => !Number.isFinite(lastAt) || now - lastAt > STALE_MS;

/** The summary of a design for the bar: its name, stage count and total propellant. Null-safe. */
export function summarizeDesign(design) {
  if (!design || !Array.isArray(design.stages)) return { name: 'No design yet', stages: dash, prop: dash, propKg: null };
  const propKg = design.stages.reduce((s, st) => s + (Number.isFinite(st?.prop) ? st.prop : 0), 0);
  const n = design.stages.length;
  return {
    name: design.name || 'Untitled design',
    stages: `${n} stage${n === 1 ? '' : 's'}`,
    prop: fmtTonnes(propKg),
    propKg,
  };
}

/** A file name for an exported design. */
export function exportName(name) {
  const slug = String(name || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${slug || 'design'}.kosmo-design.json`;
}
