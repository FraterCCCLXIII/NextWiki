// centauri-recut.mjs -- measure every pinned ship and print what moved against its pin.
//   node centauri-recut.mjs            (table of every pinned field that no longer reproduces)
//   node centauri-recut.mjs --json     (the { id: { field: { was, now } } } object for parts/fleet-recuts.js)
//
// The pins in parts/fleet-versions.js and parts/fleet-versions-v5.js are never edited. When a fix moves a
// pinned number on purpose, the move is recorded in parts/fleet-recuts.js (old value, new value, why) and
// the checks compare against the pin WITH its re-cut applied. This script is how that record is produced.

import { FLEET_VERSIONS } from './parts/fleet-versions.js';
import { FLEET_VERSIONS_V5 } from './parts/fleet-versions-v5.js';
import { measure } from './parts/fleet.js';
import { measureRobotic } from './parts/robotic.js';
import { ringFor } from './parts/centrifuge.js';

/** The same shape as the pin, measured now. Fields the pin has that are not measured are copied through. */
export function currentPin(version, id) {
  if (version === 'v1') {
    const m = measure(id);
    return { massKg: m.massKg, sailD: m.sail.dims.d, mastLenM: m.geometry.mastLenM, clearanceM: m.geometry.clearanceM, cgHull: m.geometry.cgHull };
  }
  if (version === 'v2') {
    const m = measure(id), p = FLEET_VERSIONS.v2.variants[id], ring = ringFor({ crew: p.crew, rpm: p.rpm });
    return { ...p, massKg: m.massKg, sailD: m.sail.dims.d, mastLenM: m.geometry.mastLenM, clearanceM: m.geometry.clearanceM, offAxisM: m.geometry.offAxisM, ring: { ...p.ring, massKg: ring.mass } };
  }
  if (version === 'v3') {
    const m = measure(id), p = FLEET_VERSIONS.v3.driven[id];
    return { ...p, massKg: m.massKg, hullKg: m.propulsion.hullKg, wetKg: p.wetKg === null ? null : m.propulsion.wetKg, beta: m.propulsion.beta, closes: m.propulsion.closes };
  }
  if (version === 'v4') {
    const m = measure(id), p = FLEET_VERSIONS.v4.realism[id], r = m.inventory;
    return { ...p, massKg: m.massKg, hullKg: r.hullKg, filmKg: r.filmKg, sailD: m.sail.dims.d, mastLenM: m.geometry.mastLenM, consumablesKg: r.consumablesKg, pressurisedM3: r.pressurisedM3, partCount: m.summary.partCount };
  }
  if (version === 'v5') {
    const m = measureRobotic(id), p = FLEET_VERSIONS_V5.designs[id];
    return {
      ...p, robots: m.robots.count, massKg: m.massKg, hullKg: m.hullKg, wetKg: m.propulsion.wetKg, propKg: m.propulsion.propKg, beta: m.propulsion.beta,
      boostYears: m.propulsion.boostS / (365.25 * 86400), tripYears: m.propulsion.tripYears, consumablesKg: m.humans.consumablesKg, robotsKg: m.robots.massKg, sparesKg: m.spares.totalKg,
      ring: m.ring ? { ...p.ring, totalKg: m.ring.totalKg, shieldKg: m.ring.shieldKg } : p.ring, pressurisedM3: m.summary.volumes.pressurised, loadW: m.loadW, genW: m.genW,
      swarm: { ...p.swarm, nodes: m.swarm.nodes }, coverage: m.coverage.ratio, engines: m.propulsion.drive.engines ?? 1
    };
  }
  throw new Error(version);
}

function leaves(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, key, out);
    else out[key] = v;
  }
  return out;
}
const same = (a, b) => {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.abs(b) * 1e-9 + 1e-12;
  return a === b;
};

export function diffAll() {
  const sets = [['v1', FLEET_VERSIONS.v1.classes], ['v2', FLEET_VERSIONS.v2.variants], ['v3', FLEET_VERSIONS.v3.driven], ['v4', FLEET_VERSIONS.v4.realism], ['v5', FLEET_VERSIONS_V5.designs]];
  const out = {};
  for (const [version, pins] of sets) for (const id of Object.keys(pins)) {
    const was = leaves(pins[id]), now = leaves(currentPin(version, id));
    const moved = {};
    for (const k of Object.keys(was)) if (!same(was[k], now[k])) moved[k] = { was: was[k], now: now[k] };
    if (Object.keys(moved).length) out[id] = { version, fields: moved };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const d = diffAll();
  if (process.argv.includes('--json')) console.log(JSON.stringify(d, null, 2));
  else {
    for (const [id, r] of Object.entries(d)) for (const [k, v] of Object.entries(r.fields)) console.log(`${r.version.padEnd(3)} ${id.padEnd(18)} ${k.padEnd(18)} ${String(v.was).padEnd(26)} -> ${v.now}`);
    if (!Object.keys(d).length) console.log('every pin reproduces');
  }
}
