// lab-store.js -- one store for the vehicles and flights the labs share (see LAB-STORE.md):
//   * design files: a versioned JSON schema for a Shipyard design, validation, save / load / list / delete in localStorage,
//     and a compact URL-safe share string for the #design= link;
//   * the flown state of a craft at the moment it is handed from the Shipyard to the Landing Lab (flightSnapshot), turned
//     into a Landing Lab vehicle with the flown values (snapshotToLandingVehicle);
//   * the result of a landing, to hand back to the Shipyard (landingResult).
// ES module with no DOM access at load time, so it runs in browsers and in node (lab-store.test.mjs). Every storage access
// is guarded: storage can be missing, blocked or full, and nothing here may throw into a page because of it.
import { ENGINES, VEHICLES } from './landing-sim.js';
import { WORLDS } from './ship-sim.js';
import { notFlyableReason } from './engines.js';

export const SCHEMA_VERSION = 1;
export const DESIGN_KEY_PREFIX = 'kosmo.lab.design:';   // localStorage: one entry per saved design name
export const LAST_KEY = 'kosmo.lab.lastDesign';          // localStorage: the working design, auto-saved
export const LANDING_RESULT_KEY = 'kosmo.lab.landingResult'; // sessionStorage: the last landing, read back by the Shipyard
export const SNAPSHOT_KEY = 'kosmo.lab.handoff';         // sessionStorage: the last hand-off, for a page opened on its own
const WORLD_IDS = ['earth', 'moon', 'mars'];
const PAD_KEYS = ['f9', 'f9dock', 'f9exp', 'electron', 'capsule', 'dockship', 'moon', 'mars', 'saturn', 'blank'];
const MAX_JSON_BYTES = 200 * 1024;
const DEG = Math.PI / 180;

/* ---------------- errors and small helpers ---------------- */

/** Thrown for invalid designs; `errors` lists every problem found, `warnings` the harmless ones (unknown fields). */
export class DesignError extends Error {
  constructor(errors, warnings = []) {
    super(errors.join('; '));
    this.name = 'DesignError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const wrapRad = a => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const round = (x, d = 3) => (typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(d) : x);

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0')}`;
}

// Storage is looked up lazily and every access is wrapped: a blocked or missing localStorage must never break a page.
function storageOf(name) {
  try {
    const s = globalThis[name];
    return s && typeof s.getItem === 'function' ? s : null;
  } catch {
    return null;
  }
}
const local = () => storageOf('localStorage');
const session = () => storageOf('sessionStorage');
function readItem(store, key) {
  try { return store ? store.getItem(key) : null; } catch { return null; }
}
function writeItem(store, key, value) {
  try { if (!store) return { ok: false, error: 'browser storage is not available' }; store.setItem(key, value); return { ok: true }; }
  catch (e) { return { ok: false, error: `browser storage refused the write (${e && e.name || 'error'})` }; }
}

/* ---------------- validation ---------------- */

// The schema, field by field.  Names of the Shipyard state are kept (stage objects are the Shipyard's own).
const TOP_KEYS = ['v', 'kind', 'name', 'world', 'mission', 'stages', 'payload', 'options', 'createdAt'];
const MISSION_KEYS = ['start', 'orbitAlt', 'stationAlt', 'gLimit', 'kickDeg', 'kickSpeed', 'release'];
const STAGE_KEYS = ['name', 'engine', 'count', 'prop', 'diameter', 'length', 'dry', 'landing', 'craft'];

/** Check a design object against schema v1.  Returns { ok, errors, warnings, design } where `design` is the normalised,
 *  schema-shaped copy (every default filled in) when ok.  Engine ids are checked against the engine library: an unknown id
 *  is an error, never silently replaced.  `opts.engines` overrides the library (tests). */
export function validateDesign(obj, opts = {}) {
  const errors = [], warnings = [];
  const engines = opts.engines || ENGINES;
  if (!isObj(obj)) return { ok: false, errors: ['design: expected a JSON object'], warnings, design: null };
  if (obj.v !== SCHEMA_VERSION) errors.push(obj.v === undefined ? `v: missing schema version (this build reads v: ${SCHEMA_VERSION})` : `v: schema version ${JSON.stringify(obj.v)} is not supported (this build reads v: ${SCHEMA_VERSION})`);
  if (obj.kind !== 'design') errors.push(`kind: expected "design", got ${JSON.stringify(obj.kind)}`);
  for (const k of Object.keys(obj)) if (!TOP_KEYS.includes(k)) warnings.push(`unknown field "${k}" ignored`);

  const num = (path, v, { def, min = -Infinity, max = Infinity, int = false, nullable = false } = {}) => {
    if (v === undefined || (v === null && !nullable)) {
      if (def === undefined) errors.push(`${path}: missing`);
      return def;
    }
    if (v === null) return null;
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${path}: must be a number, got ${JSON.stringify(v)}`); return def; }
    if (int && !Number.isInteger(v)) { errors.push(`${path}: must be a whole number, got ${v}`); return def; }
    if (v < min || v > max) { errors.push(`${path}: ${v} is outside the allowed range ${min}..${max}`); return def; }
    return v;
  };
  const choice = (path, v, list, def) => {
    if (v === undefined) return def;
    if (!list.includes(v)) { errors.push(`${path}: ${JSON.stringify(v)} is not one of ${list.join(', ')}`); return def; }
    return v;
  };
  const bool = (path, v, def) => {
    if (v === undefined) return def;
    if (typeof v !== 'boolean') { errors.push(`${path}: must be true or false`); return def; }
    return v;
  };

  let name = '';
  if (obj.name !== undefined && obj.name !== null) {
    if (typeof obj.name !== 'string') errors.push('name: must be text');
    else if (obj.name.length > 80) errors.push('name: longer than 80 characters');
    else name = obj.name;
  }
  const world = choice('world', obj.world, WORLD_IDS, undefined);
  if (world === undefined && obj.world === undefined) errors.push('world: missing (earth, moon or mars)');

  // mission
  const m = isObj(obj.mission) ? obj.mission : null;
  if (!m) errors.push('mission: missing or not an object');
  for (const k of Object.keys(m || {})) if (!MISSION_KEYS.includes(k)) warnings.push(`unknown field "mission.${k}" ignored`);
  const mission = {
    start: choice('mission.start', m?.start, ['pad', 'orbit'], undefined),
    orbitAlt: num('mission.orbitAlt', m?.orbitAlt, { min: 0, max: 5e7 }),
    stationAlt: num('mission.stationAlt', m?.stationAlt, { def: 420e3, min: 0, max: 5e7 }),
    gLimit: num('mission.gLimit', m?.gLimit, { def: 4.5, min: 1, max: 20 }),
    kickDeg: num('mission.kickDeg', m?.kickDeg, { def: 4, min: 0, max: 30 }),
    kickSpeed: num('mission.kickSpeed', m?.kickSpeed, { def: 45, min: 0, max: 500 }),
  };
  if (mission.start === undefined && m?.start === undefined) errors.push('mission.start: missing (pad or orbit)');
  if (m?.release !== undefined && m.release !== null) {
    mission.release = { alt: num('mission.release.alt', m.release.alt, { def: 0, min: 0, max: 5e6 }), speed: num('mission.release.speed', m.release.speed, { def: 0, min: 0, max: 2000 }) };
  }

  // stages
  if (!Array.isArray(obj.stages)) errors.push('stages: must be a list');
  const stages = [];
  const list = Array.isArray(obj.stages) ? obj.stages : [];
  if (list.length < 1 || list.length > 12) errors.push(`stages: needs 1 to 12 stages, got ${list.length}`);
  list.forEach((s, i) => {
    const p = `stages[${i}]`;
    if (!isObj(s)) { errors.push(`${p}: must be an object`); return; }
    for (const k of Object.keys(s)) if (!STAGE_KEYS.includes(k)) warnings.push(`unknown field "${p}.${k}" ignored`);
    const engine = typeof s.engine === 'string' ? s.engine : undefined;
    if (engine === undefined) errors.push(`${p}.engine: missing engine id`);
    else if (!engines[engine]) errors.push(`${p}.engine: unknown engine "${engine}": it is not in the engine library (engines-library.json), so the design was not loaded`);
    else { const why = notFlyableReason(engines[engine]); if (why) errors.push(`${p}.engine: "${engine}" cannot be flown: ${why}`); }
    const count = num(`${p}.count`, s.count, { def: 1, min: 1, max: 40, int: true });
    const prop = num(`${p}.prop`, s.prop, { min: 0, max: 5e6 });
    const diameter = num(`${p}.diameter`, s.diameter, { min: 0.5, max: 30 });
    const length = s.length === undefined || s.length === null ? undefined : num(`${p}.length`, s.length, { min: 0.5, max: 300 });
    const dry = num(`${p}.dry`, s.dry, { def: null, min: 0, max: 5e6, nullable: true });
    const L = isObj(s.landing) ? s.landing : {};
    const landing = {
      mode: choice(`${p}.landing.mode`, L.mode, ['none', 'propulsive', 'chute'], 'none'),
      reserve: num(`${p}.landing.reserve`, L.reserve, { def: 0, min: 0, max: 5e6 }),
      site: choice(`${p}.landing.site`, L.site, ['downrange', 'rtls'], 'downrange'),
      engines: num(`${p}.landing.engines`, L.engines, { def: 1, min: 1, max: 40, int: true }),
    };
    let craft = null;
    if (s.craft !== undefined && s.craft !== null) {
      const c = s.craft;
      if (!isObj(c)) errors.push(`${p}.craft: must be an object or null`);
      else craft = {
        rcsThrust: num(`${p}.craft.rcsThrust`, c.rcsThrust, { def: 4000, min: 0, max: 1e7 }),
        rcsProp: num(`${p}.craft.rcsProp`, c.rcsProp, { def: 400, min: 0, max: 5e6 }),
        rcsIsp: num(`${p}.craft.rcsIsp`, c.rcsIsp, { def: 280, min: 1, max: 1e5 }),
        noseOffset: num(`${p}.craft.noseOffset`, c.noseOffset, { def: 2.5, min: 0, max: 100 }),
        cargo: num(`${p}.craft.cargo`, c.cargo, { def: 0, min: 0, max: 5e6 }),
        chuteArea: num(`${p}.craft.chuteArea`, c.chuteArea, { def: 0, min: 0, max: 1e6 }),
      };
    }
    let stageName = `Stage ${i + 1}`;
    if (s.name !== undefined) {
      if (typeof s.name === 'string' && s.name.length <= 40) stageName = s.name;
      else errors.push(`${p}.name: must be text up to 40 characters`);
    }
    const st = { name: stageName, engine, count: count ?? 1, prop: prop ?? 0, diameter: diameter ?? 3.7 };
    if (length !== undefined) st.length = length;
    st.dry = dry === undefined ? null : dry;
    st.landing = landing;
    st.craft = craft;
    stages.push(st);
  });

  // payload and options
  const pl = isObj(obj.payload) ? obj.payload : {};
  if (obj.payload !== undefined && !isObj(obj.payload)) errors.push('payload: must be an object');
  const payload = { mass: num('payload.mass', pl.mass, { def: 0, min: 0, max: 5e6 }), fairing: num('payload.fairing', pl.fairing, { def: 0, min: 0, max: 5e6 }) };
  const op = isObj(obj.options) ? obj.options : {};
  if (obj.options !== undefined && !isObj(obj.options)) errors.push('options: must be an object');
  let pad = op.pad === undefined || op.pad === null ? null : op.pad;
  if (pad !== null && !PAD_KEYS.includes(pad)) { warnings.push(`options.pad "${pad}" is not a known start template; using the blank pad`); pad = 'blank'; }
  const options = {
    rendezvous: bool('options.rendezvous', op.rendezvous, false),
    deorbit: bool('options.deorbit', op.deorbit, false),
    tuneAscent: bool('options.tuneAscent', op.tuneAscent, true),
    pad,
    scene: choice('options.scene', op.scene, ['space', 'black'], 'space'),
  };
  if (obj.createdAt !== undefined && typeof obj.createdAt !== 'string' && typeof obj.createdAt !== 'number') errors.push('createdAt: must be a date string or a number');

  if (errors.length) return { ok: false, errors, warnings, design: null };
  const design = { v: SCHEMA_VERSION, kind: 'design', name, world, mission, stages, payload, options, createdAt: obj.createdAt === undefined ? null : obj.createdAt };
  if (JSON.stringify(design).length > MAX_JSON_BYTES) return { ok: false, errors: ['design: larger than 200 KB'], warnings, design: null };
  return { ok: true, errors, warnings, design };
}

/** Validate and normalise a design, or throw DesignError listing every problem. */
export function designFromJSON(obj, opts) {
  const r = validateDesign(obj, opts);
  if (!r.ok) throw new DesignError(r.errors, r.warnings);
  return r.design;
}

/* ---------------- design <-> Shipyard state ---------------- */

const stageEngineId = s => (typeof s.engine === 'string' ? s.engine : typeof s.engineId === 'string' ? s.engineId : s.engine?.id);

/** The Shipyard's working state (world, stages, payload, mission, autoKick) -> schema JSON.
 *  meta: { name, pad (start template key), scene ('space' | 'black'), createdAt }. */
export function designToJSON(state, meta = {}) {
  const m = state.mission || {};
  const mission = { start: m.start, orbitAlt: m.orbitAlt, stationAlt: m.stationAlt, gLimit: m.gLimit, kickDeg: m.kickDeg, kickSpeed: m.kickSpeed };
  if (m.release) mission.release = { alt: m.release.alt || 0, speed: m.release.speed || 0 };
  const stages = (state.stages || []).map((s, i) => {
    const L = s.landing || {};
    const out = { name: s.name ?? `Stage ${i + 1}`, engine: stageEngineId(s), count: s.count, prop: s.prop, diameter: s.diameter };
    if (s.length != null) out.length = s.length;
    out.dry = s.dry == null ? null : s.dry;
    out.landing = { mode: L.mode || 'none', reserve: L.reserve || 0, site: L.site || 'downrange', engines: L.engines || 1 };
    out.craft = s.craft ? { ...s.craft } : null;
    return out;
  });
  return {
    v: SCHEMA_VERSION, kind: 'design', name: meta.name ?? '', world: state.world,
    mission, stages,
    payload: { mass: state.payload?.mass ?? 0, fairing: state.payload?.fairing ?? 0 },
    options: { rendezvous: !!m.dock, deorbit: !!m.land, tuneAscent: !!state.autoKick, pad: meta.pad ?? null, scene: meta.scene === 'black' ? 'black' : 'space' },
    createdAt: meta.createdAt ?? new Date().toISOString(),
  };
}

/** A validated design -> the Shipyard's working state, plus the meta that goes with it (name, pad, scene). */
export function designToState(design) {
  const d = design;
  const mission = { ...d.mission, dock: d.options.rendezvous, land: d.options.deorbit };
  if (!mission.release) delete mission.release;
  return {
    state: {
      world: d.world, autoKick: d.options.tuneAscent, mission,
      payload: { ...d.payload },
      stages: d.stages.map(s => {
        const o = { name: s.name, engine: s.engine, count: s.count, prop: s.prop, diameter: s.diameter, dry: s.dry, landing: { ...s.landing } };
        if (s.length !== undefined) o.length = s.length;
        o.craft = s.craft ? { ...s.craft } : null;
        return o;
      }),
    },
    meta: { name: d.name, pad: d.options.pad, scene: d.options.scene, createdAt: d.createdAt },
  };
}

/* ---------------- saved designs (localStorage) ---------------- */

/** A design name: trimmed, one line, 1..60 characters. Returns the name or throws. */
export function normalizeName(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) throw new Error('give the design a name');
  if (n.length > 60) throw new Error('the name is longer than 60 characters');
  if (/[\u0000-\u001f]/.test(n)) throw new Error('the name has control characters');
  return n;
}

/** Save a design under a name (overwrites the same name). Returns { ok, name, error }. */
export function saveDesign(name, json) {
  let n;
  try { n = normalizeName(name); } catch (e) { return { ok: false, error: e.message }; }
  const r = validateDesign(json);
  if (!r.ok) return { ok: false, error: r.errors.join('; ') };
  const text = JSON.stringify(r.design);
  const w = writeItem(local(), DESIGN_KEY_PREFIX + n, text);
  return w.ok ? { ok: true, name: n } : { ok: false, error: w.error };
}

/** The saved designs, by name: [{ name, world, stages, createdAt, broken }]. Entries that do not parse are listed as broken. */
export function listDesigns() {
  const store = local();
  if (!store) return [];
  const out = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (typeof key !== 'string' || !key.startsWith(DESIGN_KEY_PREFIX)) continue;
      const name = key.slice(DESIGN_KEY_PREFIX.length);
      try {
        const d = JSON.parse(readItem(store, key));
        out.push({ name, world: d?.world, stages: Array.isArray(d?.stages) ? d.stages.length : 0, createdAt: d?.createdAt ?? null, broken: !validateDesign(d).ok });
      } catch {
        out.push({ name, world: null, stages: 0, createdAt: null, broken: true });
      }
    }
  } catch { return []; }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A saved design, validated. Returns null when there is no such name or storage is unavailable; throws DesignError when the
 *  stored entry no longer validates (so the caller can show why). */
export function loadDesign(name) {
  let n;
  try { n = normalizeName(name); } catch { return null; }
  const text = readItem(local(), DESIGN_KEY_PREFIX + n);
  if (text == null) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { throw new DesignError([`the saved design "${n}" is not valid JSON`]); }
  return designFromJSON(obj);
}

/** Remove a saved design. Returns true when something was removed. */
export function deleteDesign(name) {
  let n;
  try { n = normalizeName(name); } catch { return false; }
  const store = local();
  if (!store) return false;
  try { if (store.getItem(DESIGN_KEY_PREFIX + n) == null) return false; store.removeItem(DESIGN_KEY_PREFIX + n); return true; }
  catch { return false; }
}

/** The working design, auto-saved on every change. */
export function saveLast(json) {
  const r = validateDesign(json);
  if (!r.ok) return { ok: false, error: r.errors.join('; ') };
  return writeItem(local(), LAST_KEY, JSON.stringify(r.design));
}
/** The working design from the last visit, or null (nothing saved, or it no longer validates). */
export function loadLast() {
  const text = readItem(local(), LAST_KEY);
  if (text == null) return null;
  try { const r = validateDesign(JSON.parse(text)); return r.ok ? r.design : null; } catch { return null; }
}

/* ---------------- share strings and the #design= link ---------------- */

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new DesignError(['the share string has characters that are not base64url']);
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(str.length / 4) * 4, '='));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
async function transform(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** A design as a compact URL-safe string. "z" + base64url(raw deflate of the JSON) when CompressionStream exists, otherwise
 *  "j" + base64url(JSON). Async because the compression streams are. */
export async function encodeShare(json) {
  const r = validateDesign(json);
  if (!r.ok) throw new DesignError(r.errors, r.warnings);
  const bytes = new TextEncoder().encode(JSON.stringify(r.design));
  if (typeof CompressionStream === 'function') {
    try {
      const z = await transform(bytes, new CompressionStream('deflate-raw'));
      if (z.length < bytes.length) return 'z' + b64urlEncode(z);
    } catch { /* fall through to plain */ }
  }
  return 'j' + b64urlEncode(bytes);
}

/** The inverse of encodeShare: a validated design, or throws DesignError. */
export async function decodeShare(str) {
  const s = String(str ?? '').trim();
  const kind = s.charAt(0), body = s.slice(1);
  let bytes;
  if (kind === 'j') bytes = b64urlDecode(body);
  else if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new DesignError(['this browser cannot open a compressed design link']);
    try { bytes = await transform(b64urlDecode(body), new DecompressionStream('deflate-raw')); }
    catch { throw new DesignError(['the design link is damaged (it does not decompress)']); }
  } else throw new DesignError(['the design link is not in a format this build knows']);
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new DesignError(['the design link does not hold a design']); }
  return designFromJSON(obj);
}

/** The hash a design link carries: "#design=<share string>". */
export const designHash = share => `#design=${share}`;
/** The share string in a location hash, or null when the hash carries no design. */
export function readDesignHash(hash) {
  const m = /^#?design=([^&]+)/.exec(String(hash ?? ''));
  return m ? m[1] : null;
}
/** A full link to this page carrying the design. */
export async function shareURL(json, base) {
  const href = String(base ?? '').split('#')[0];
  return `${href}${designHash(await encodeShare(json))}`;
}

/* ---------------- the flown state, handed Shipyard -> Landing Lab ---------------- */

/** The real state of a craft in a running Shipyard sim (ship-sim.js createSim), at this moment.  Pure: it reads the sim through
 *  its own functions (sim.env, sim.craftMass) and the craft's fields, so it works on any sim with that shape.
 *  Frame: the sim's own (metres, seconds, ship-sim conventions). `tan` is the direction of travel; `up` is radial. */
export function flightSnapshot(sim, craft, opts = {}) {
  if (!sim || !craft) throw new Error('flightSnapshot needs a sim and a craft');
  const s = craft.parts && craft.parts[0];
  if (!s) throw new Error(`craft "${craft.name}" has no stage left to snapshot`);
  const W = sim.W, env = sim.env(craft), up = env.up, tan = env.tan;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const vUp = dot(env.vgr, up), vTan = dot(env.vgr, tan);
  const tiltRad = wrapRad(craft.th - Math.atan2(up[1], up[0]));
  const downrange = wrapRad(Math.atan2(craft.pos[1], craft.pos[0]) - (sim.M?.padAngle ?? 0) * DEG) * W.R;
  const landing = { ...(s.landing || { mode: 'none' }) };
  return {
    v: SCHEMA_VERSION, kind: 'flight-snapshot', id: opts.id || newId('snap'),
    world: W.id, t: round(sim.t, 2),
    craft: { id: craft.id, role: craft.role, name: craft.name, phase: craft.ap?.phase ?? null, alive: craft.alive !== false },
    pos: [round(craft.pos[0], 2), round(craft.pos[1], 2)], vel: [round(craft.vel[0], 3), round(craft.vel[1], 3)],
    alt: round(env.h, 1), speed: round(env.speed, 2), vUp: round(vUp, 2), vTan: round(vTan, 2),
    flightPathDeg: round(Math.atan2(vUp, vTan) / DEG, 2), tiltDeg: round(tiltRad / DEG, 2), omegaDegS: round((craft.om || 0) / DEG, 3),
    downrangeM: round(downrange, 0), q: round(env.q, 1), gNow: round(craft.gNow || 0, 3),
    massKg: round(sim.craftMass(craft), 1), propKg: round(s.prop, 1), propMaxKg: round(s.propMax ?? s.prop, 1),
    stage: {
      name: s.name, engine: s.engineId ?? s.engine?.id, count: s.count, active: s.active ?? s.count,
      dry: s.dry, diameter: s.diameter, length: round(s.length, 2), landing,
      throttle: round(craft.throttleCmd || 0, 3), firing: !!s.firing,
    },
    config: { legs: landing.mode === 'propulsive', gridFins: !!(W.atmoTop && landing.mode === 'propulsive') },
  };
}

// The Shipyard's touchdown criteria for a stage handed over (the values vehicleFromStage has always used).
const STAGE_LIMITS = { vMaxV: 5.5, vMaxH: 3 };

/** The Landing Lab vehicle for a flown snapshot.  Mass, propellant, engine, height, speeds, attitude and the start of the descent
 *  come from the flight; the stage's dimensions size the legs and fins (as vehicleFromStage does); the Falcon 9 defaults fill
 *  only what no snapshot can know, and each of those is listed in `assumed`.  Returns { vehicle, assumed, warnings, flown }. */
export function snapshotToLandingVehicle(snap) {
  if (!isObj(snap) || snap.kind !== 'flight-snapshot' || snap.v !== SCHEMA_VERSION) throw new Error('not a flight snapshot (v1)');
  const st = snap.stage || {};
  const W = WORLDS[snap.world];
  if (!W) throw new Error(`snapshot: unknown world "${snap.world}"`);
  const eng = ENGINES[st.engine];
  if (!eng) throw new Error(`snapshot: unknown engine "${st.engine}" (not in the engine library)`);
  const why = notFlyableReason(eng);
  if (why) throw new Error(`snapshot: engine "${st.engine}" cannot be flown: ${why}`);
  const base = VEHICLES.falcon9;
  const warnings = [], assumed = [];
  const landN = st.landing?.engines || 1;
  const n = Math.max(1, Math.min(st.count || 1, landN));
  const dry = st.dry, prop = Math.max(500, snap.propKg || 0);
  const D = st.diameter, L = st.length;
  if (!(dry > 0) || !(D > 0) || !(L > 0)) throw new Error('snapshot: the stage has no dry mass, diameter or length');
  const earth = W.id === 'earth';
  const g = W.mu / W.R ** 2, aMax = n * eng.thrustVac / (dry + prop);
  const stopDist = snap.speed ** 2 / (2 * Math.max(0.35 * (aMax - g), 1));

  if (snap.alt < stopDist) warnings.push(`the flown height ${Math.round(snap.alt)} m is below the ${Math.round(stopDist)} m a burn at this speed needs: the stage cannot stop in time from here`);
  if (snap.alt > 30e3) warnings.push(`the flown height ${(snap.alt / 1e3).toFixed(0)} km is above the descent the Landing Lab models in detail; the landing is flown from there anyway`);
  if (Math.abs(snap.downrangeM || 0) > 1000) warnings.push(`the flown downrange offset ${((snap.downrangeM || 0) / 1e3).toFixed(1)} km is not used: the Landing Lab places the stage at its target and plans the approach`);
  if (st.landing?.mode !== 'propulsive') warnings.push(`the design did not set this stage to land with its engines; the landing is flown anyway`);

  // Landing frame (landing-sim.js): x is downrange of the target (+ upstream), th is the body angle toward +x.
  // Ship frame (ship-sim.js): tan is the direction of travel, and a positive tilt leans toward it.
  const start = { y: snap.alt, vx: -snap.vTan, vy: snap.vUp, th: -snap.tiltDeg };

  assumed.push(...(earth ? ['wind (the air-relative speed is flown, the wind is not)'] : []), 'sea state (deck heave and period)',
    'gimbal limits (not in the engine library)', 'touchdown limits (Shipyard values)', 'dispersion (spread)');
  const vehicle = {
    ...base,
    name: `${st.name} (flown in the Shipyard)`, world: W.id, engine: st.engine, engines: n, cluster: st.count,
    dry, prop, diameter: D, length: L, comHeight: Math.max(1.5, 0.3 * L),
    legRadius: 2.2 * D, gimbal: base.gimbal, gimbalRate: base.gimbalRate, finArea: earth ? 0.45 * D * D : 0, finLever: 0.55 * L,
    tiltMax: base.tiltMax, latTilt: base.latTilt, vMaxV: STAGE_LIMITS.vMaxV, vMaxH: STAGE_LIMITS.vMaxH,
    target: { kind: earth ? 'ship' : 'pad', radius: Math.max(14, 4 * D), deckY: 0, heave: earth ? base.target.heave : 0, period: base.target.period },
    wind: earth ? base.wind : 0, start,
    spread: { x: 6 * D, y: 40, vx: 2, vy: 4 },
    note: `Flown in the Shipyard at T+${Math.round(snap.t || 0)} s (${st.name}, ${snap.craft?.phase || 'flight'}): ${n} x ${eng.name}, ${(dry / 1e3).toFixed(1)} t dry, ${(prop / 1e3).toFixed(1)} t propellant.`,
  };
  const flown = {
    t: snap.t, id: snap.id, stage: st.name, craft: snap.craft?.name, phase: snap.craft?.phase ?? null,
    alt: snap.alt, speed: snap.speed, vUp: snap.vUp, vTan: snap.vTan, flightPathDeg: snap.flightPathDeg, tiltDeg: snap.tiltDeg,
    massKg: snap.massKg, propKg: snap.propKg, engine: st.engine, count: st.count, world: snap.world,
  };
  return { vehicle, assumed, warnings, flown, start };
}

/* ---------------- the landing, handed back ---------------- */

/** The limits a Landing Lab vehicle is judged by (the same numbers landing-sim.js uses at touchdown). */
export function landingLimits(vehicle) {
  return { vv: vehicle.vMaxV ?? 3, vh: vehicle.vMaxH ?? 3, tilt: vehicle.target?.kind === 'catch' ? 5 : 8, radius: vehicle.target?.radius };
}

/** Re-check a touchdown against the limits, the way landing-sim.js does (the spin limit is not carried in a result). */
export function checkConstraints(out, limits) {
  const why = [];
  if (out.vv > limits.vv) why.push(`vertical speed ${out.vv.toFixed(1)} m/s > ${limits.vv}`);
  if (out.vh > limits.vh) why.push(`lateral speed ${out.vh.toFixed(1)} m/s > ${limits.vh}`);
  if (out.tilt > limits.tilt) why.push(`tilt ${out.tilt.toFixed(1)} deg > ${limits.tilt}`);
  if (out.miss > limits.radius) why.push(`missed by ${(out.miss - limits.radius).toFixed(0)} m`);
  return { ok: why.length === 0, why };
}

/** A landing result (the `out` of createLanding().run()) as the record handed back to the Shipyard. */
export function landingResult(out, ctx = {}) {
  const ok = !!out.ok;
  const limits = ctx.limits || null;
  const caught = ctx.target === 'catch';
  const constraints = limits && out.vv !== undefined ? checkConstraints(out, limits) : null;
  return {
    v: SCHEMA_VERSION, kind: 'landing-result',
    key: `${ctx.handoffId || 'direct'}:${round(out.t, 2)}:${ok ? 1 : 0}`,
    at: ctx.at || new Date().toISOString(), handoffId: ctx.handoffId ?? null, stage: ctx.stage ?? null, vehicle: ctx.vehicle ?? null,
    target: ctx.target || 'pad',
    status: ok ? (caught ? 'caught' : 'landed') : 'failed', ok, reason: out.reason || '',
    touchdownMs: round(out.vv, 3), lateralMs: round(out.vh, 3), tiltDeg: round(out.tilt, 2), missM: round(out.miss, 2),
    fuelLeftKg: round(out.fuel, 1), fuelUsedKg: round(out.fuelUsed, 1), timeS: round(out.t, 2),
    limits, constraintsOk: constraints ? constraints.ok : null,
  };
}

/** Hand a landing result to the Shipyard: sessionStorage (shared by the frames of one tab; read back on focus and load). */
export function saveLandingResult(result) {
  return writeItem(session(), LANDING_RESULT_KEY, JSON.stringify(result));
}
/** The last landing result, or null. */
export function loadLandingResult() {
  const text = readItem(session(), LANDING_RESULT_KEY);
  if (text == null) return null;
  try { const r = JSON.parse(text); return r && r.kind === 'landing-result' ? r : null; } catch { return null; }
}
/** Keep the snapshot of the last hand-off (for a Landing Lab page opened on its own). */
export function saveHandoff(msg) {
  return writeItem(session(), SNAPSHOT_KEY, JSON.stringify(msg));
}
export function loadHandoff() {
  const text = readItem(session(), SNAPSHOT_KEY);
  if (text == null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** Plain-text summary of a snapshot for the Landing Lab note. */
export function describeFlown(flown, assumed) {
  const t = v => (v / 1e3).toFixed(1);
  return `Flown in the Shipyard: v=${Math.round(flown.speed)} m/s (vertical ${Math.round(flown.vUp)}, along track ${Math.round(flown.vTan)}), h=${Math.round(flown.alt)} m, mass=${t(flown.massKg)} t (propellant ${t(flown.propKg)} t)`
    + (assumed?.length ? `; assumed: ${assumed.join(', ')}` : '');
}
