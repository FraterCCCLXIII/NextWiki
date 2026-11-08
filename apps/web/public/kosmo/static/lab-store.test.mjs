// lab-store.test.mjs -- node checks for lab-store.js: design JSON for every Shipyard preset, validation errors, the saved
// designs and the share string, the flown snapshot from a real Shipyard sim, the Landing Lab vehicle built from it, and the
// landing result.  Run by run-tests.mjs (node static/lab-store.test.mjs also works).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SCHEMA_VERSION, DesignError, validateDesign, designFromJSON, designToJSON, designToState, saveDesign, listDesigns, loadDesign,
  deleteDesign, saveLast, loadLast, encodeShare, decodeShare, designHash, readDesignHash, shareURL, flightSnapshot,
  snapshotToLandingVehicle, landingLimits, landingResult, checkConstraints, describeFlown, normalizeName,
} from './lab-store.js';
import { ENGINES, VEHICLES, createLanding } from './landing-sim.js';
import { createSim } from './ship-sim.js';
import { notFlyableReason } from './engines.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };

// ---- the Shipyard's presets, read from shipyard.html itself (so this test cannot drift from the page) ----
const html = readFileSync(new URL('./shipyard.html', import.meta.url), 'utf8');
const CAPSULE = new Function(`return ${/const CAPSULE = (\{[^\n]*\});/.exec(html)[1]};`)();
const PRESETS = new Function('CAPSULE', `return ${/const PRESETS = (\{[\s\S]*?\n\});/.exec(html)[1]};`)(CAPSULE);
const clone = o => JSON.parse(JSON.stringify(o));
// exactly what the Shipyard's loadPreset() builds
function presetState(p) {
  const state = { world: p.world, stages: clone(p.stages), payload: clone(p.payload), mission: { kickDeg: 4, kickSpeed: 45, ...clone(p.mission) }, autoKick: true };
  for (const s of state.stages) s.landing = { mode: 'none', reserve: 0, site: 'downrange', engines: 1, ...s.landing };
  return state;
}
const presetKeys = Object.keys(PRESETS);
ok(presetKeys.length >= 8, 'the Shipyard has its presets');

// ---- 1. every preset round-trips ----
for (const key of presetKeys) {
  const p = PRESETS[key], state = presetState(p);
  const json = designToJSON(state, { name: p.label, pad: key, scene: 'space', createdAt: '2026-11-05T00:00:00.000Z' });
  eq(json.v, SCHEMA_VERSION, `${key}: schema version`);
  eq(json.kind, 'design', `${key}: kind`);
  const design = designFromJSON(JSON.parse(JSON.stringify(json)));          // through text, as a file or a link would
  const back = designToState(design);
  const json2 = designToJSON(back.state, back.meta);
  eq(json2, json, `${key}: design -> JSON -> state -> JSON is the same`);
  eq(back.state.stages.length, p.stages.length, `${key}: stage count`);
  p.stages.forEach((s, i) => {
    const t = back.state.stages[i];
    eq([t.name, t.engine, t.count, t.prop, t.diameter], [s.name, s.engine, s.count, s.prop, s.diameter], `${key}: stage ${i} fields`);
    eq(t.landing.mode, (s.landing?.mode) || 'none', `${key}: stage ${i} landing mode`);
    eq(!!t.craft, !!s.craft, `${key}: stage ${i} craft present`);
  });
  eq(back.state.mission.start, p.mission.start, `${key}: mission start`);
  eq(back.state.mission.dock, !!p.mission.dock, `${key}: rendezvous option maps to mission.dock`);
  eq(back.state.mission.land, !!p.mission.land, `${key}: deorbit option maps to mission.land`);
  eq(back.state.world, p.world, `${key}: world`);
  for (const s of json.stages) ok(ENGINES[s.engine], `${key}: engine ${s.engine} is in the library`);
}

// ---- 2. validation: helpful, located errors; unknown engines are reported, not replaced ----
const f9 = designToJSON(presetState(PRESETS.f9), { name: 'f9', pad: 'f9' });
const errs = obj => validateDesign(obj);
{
  const bad = clone(f9); bad.stages[0].engine = 'merlin-9000';
  const r = errs(bad);
  ok(!r.ok, 'unknown engine id is an error');
  ok(r.errors.some(e => e.includes('stages[0].engine') && e.includes('merlin-9000') && e.includes('engine library')), 'unknown engine is named and located');
  ok(bad.stages[0].engine === 'merlin-9000', 'the engine id is not silently replaced');
  let thrown = null; try { designFromJSON(bad); } catch (e) { thrown = e; }
  ok(thrown instanceof DesignError && thrown.errors.length >= 1, 'designFromJSON throws a DesignError with the list');
}
{
  const r = errs({ ...clone(f9), v: 2 });
  ok(!r.ok && r.errors.some(e => e.startsWith('v:') && e.includes('not supported')), 'a newer schema version is refused, with a reason');
  ok(!errs({ kind: 'design' }).ok && errs({ kind: 'design' }).errors.some(e => e.startsWith('v:')), 'a missing version is reported');
  ok(errs('nope').errors[0].includes('expected a JSON object'), 'a non-object is reported');
}
{
  const bad = clone(f9); bad.world = 'venus'; bad.stages[1].count = 0; bad.stages[2].diameter = 'wide'; bad.stages[0].landing.mode = 'parachute';
  const r = errs(bad);
  ok(r.errors.some(e => e.startsWith('world:')), 'unknown world');
  ok(r.errors.some(e => e.startsWith('stages[1].count:')), 'count below 1');
  ok(r.errors.some(e => e.startsWith('stages[2].diameter:') && e.includes('number')), 'diameter must be a number');
  ok(r.errors.some(e => e.startsWith('stages[0].landing.mode:')), 'unknown landing mode');
}
{
  const r = errs({ ...clone(f9), stages: [] });
  ok(r.errors.some(e => e.startsWith('stages:') && e.includes('1 to 12')), 'an empty stage list is refused');
  const r2 = errs({ ...clone(f9), flavour: 'spicy', stages: clone(f9.stages).map(s => ({ ...s, extra: 1 })) });
  ok(r2.ok && r2.warnings.some(w => w.includes('flavour')) && r2.warnings.some(w => w.includes('stages[0].extra')), 'unknown fields are warnings, not errors');
  ok(!errs({ ...clone(f9), options: { pad: 'nowhere' } }).errors.length, 'an unknown pad is a warning');
  ok(errs({ ...clone(f9), options: { pad: 'nowhere' } }).warnings.some(w => w.includes('nowhere')), 'and it is named');
}
{
  // a stage whose engine is in the library but cannot be flown: reported with the reason
  const unflyable = Object.values(ENGINES).find(e => notFlyableReason(e));
  if (unflyable) {
    const bad = clone(f9); bad.stages[0].engine = unflyable.id;
    ok(errs(bad).errors.some(e => e.includes('cannot be flown')), 'an unflyable engine is refused with the reason');
  }
}

// ---- 3. saved designs, with a memory store standing in for localStorage ----
function memoryStorage() {
  const m = new Map();
  return {
    get length() { return m.size; }, key: i => [...m.keys()][i] ?? null,
    getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m,
  };
}
const mem = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true });
{
  eq(normalizeName('  My   rocket '), 'My rocket', 'names are trimmed and collapsed');
  ok(saveDesign('Falcon test', f9).ok, 'saveDesign stores a design');
  ok(!saveDesign('', f9).ok && !saveDesign('x'.repeat(61), f9).ok, 'empty and over-long names are refused');
  ok(!saveDesign('bad', { v: 1, kind: 'design', world: 'earth', stages: [] }).ok, 'an invalid design is not stored');
  saveDesign('Second', { ...f9, name: 'Second' });
  const names = listDesigns().map(d => d.name);
  eq(names, ['Falcon test', 'Second'], 'listDesigns lists by name');
  eq(listDesigns()[0].stages, f9.stages.length, 'listDesigns counts stages');
  const got = loadDesign('Falcon test');
  eq(designToJSON(designToState(got).state, designToState(got).meta), f9, 'a saved design loads back identical');
  eq(loadDesign('missing'), null, 'a missing name gives null');
  mem.setItem('kosmo.lab.design:Broken', '{not json');
  let broken = null; try { loadDesign('Broken'); } catch (e) { broken = e; }
  ok(broken instanceof DesignError, 'a corrupt saved entry says why');
  ok(listDesigns().find(d => d.name === 'Broken')?.broken === true, 'and is listed as broken');
  ok(deleteDesign('Second') && !deleteDesign('Second'), 'deleteDesign removes once');
  ok(mem.getItem('kosmo.lab.design:Second') === null, 'the key is gone');
  ok(saveLast(f9).ok && loadLast().stages.length === f9.stages.length, 'the working design is kept as "last"');
  mem.setItem('kosmo.lab.lastDesign', 'garbage'); eq(loadLast(), null, 'a broken "last" is ignored');
}
{
  // storage refused (private mode, blocked site data): every call degrades instead of throwing
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('SecurityError'); }, configurable: true });
  eq(listDesigns(), [], 'no storage: no list');
  ok(saveDesign('Nope', f9).ok === false, 'no storage: save reports, does not throw');
  eq(loadDesign('Nope'), null, 'no storage: load gives null');
  eq(loadLast(), null, 'no storage: no last design');
  ok(deleteDesign('Nope') === false, 'no storage: delete is false');
  Object.defineProperty(globalThis, 'localStorage', { value: mem, configurable: true, writable: true });
}

// ---- 4. share strings and the #design= link ----
for (const key of presetKeys) {
  const json = designToJSON(presetState(PRESETS[key]), { name: PRESETS[key].label, pad: key, createdAt: '2026-11-05T00:00:00.000Z' });
  const share = await encodeShare(json);
  eq(await decodeShare(share), designFromJSON(json), `${key}: share string round trip`);
  ok(share.length < 2048, `${key}: share string is ${share.length} characters (under 2 KB)`);
}
{
  const json = designToJSON(presetState(PRESETS.f9), { name: 'f9', pad: 'f9', createdAt: '2026-11-05T00:00:00.000Z' });
  const z = await encodeShare(json);
  ok(z.charAt(0) === 'z', 'compressed when CompressionStream exists');
  const saved = globalThis.CompressionStream; delete globalThis.CompressionStream;
  try {
    const j = await encodeShare(json);
    ok(j.charAt(0) === 'j', 'plain base64url when there is no CompressionStream');
    eq(await decodeShare(j), designFromJSON(json), 'plain share string round trip');
  } finally { globalThis.CompressionStream = saved; }
  let e1 = null; try { await decodeShare('x!!'); } catch (e) { e1 = e; }
  ok(e1 instanceof DesignError, 'a damaged share string is a DesignError');
  let e2 = null; try { await decodeShare('j' + Buffer.from('{"v":1}').toString('base64url')); } catch (e) { e2 = e; }
  ok(e2 instanceof DesignError && e2.errors.length > 0, 'a share string of an invalid design says what is wrong');
  const url = await shareURL(json, 'https://example.test/kosmo/static/shipyard.html?x=1#old');
  ok(url.startsWith('https://example.test/kosmo/static/shipyard.html?x=1#design='), 'share URL keeps the page and replaces the hash');
  eq(readDesignHash(new URL(url).hash), await encodeShare(json), 'the hash carries the share string');
  eq(readDesignHash('#landing'), null, 'a hash without a design is null');
  eq(designHash('abc'), '#design=abc', 'the hash convention');
}

// ---- 5. the flown state of a real Shipyard booster, and the Landing Lab vehicle from it ----
// a real sim of the Falcon 9-class preset, flown until the booster separates
const f9State = presetState(PRESETS.f9);
const cfg = { world: f9State.world, stages: f9State.stages, payload: f9State.payload, mission: { ...f9State.mission, goal: 'orbit' } };
const sim = createSim(JSON.parse(JSON.stringify(cfg)));
let guard = 0;
while (sim.crafts.length < 2 && !sim.done && guard++ < 900) sim.advance(1);
ok(sim.crafts.length >= 2, 'the booster separated in the sim');
const booster = sim.crafts.find(c => c.role === 'booster');
ok(booster, 'there is a booster craft');
const snap = flightSnapshot(sim, booster, { id: 'test-1' });
eq(snap.kind, 'flight-snapshot', 'snapshot kind');
eq(snap.id, 'test-1', 'snapshot id');
eq(snap.world, 'earth', 'snapshot world');
for (const k of ['t', 'alt', 'speed', 'vUp', 'vTan', 'flightPathDeg', 'tiltDeg', 'massKg', 'propKg']) ok(Number.isFinite(snap[k]), `snapshot ${k} is a finite number`);
ok(snap.alt > 10e3, 'the booster is high when it separates');
ok(Math.abs(snap.flightPathDeg) <= 90.001, 'flight-path angle is in range');
eq(snap.stage.engine, 'merlin-1d', 'snapshot names the engine');
eq(snap.stage.count, 9, 'snapshot counts the engines');
eq(snap.config.legs, true, 'a propulsive booster has legs');
eq(JSON.parse(JSON.stringify(snap)), snap, 'the snapshot is plain JSON');
ok(Math.abs(snap.propKg - sim.crafts.find(c => c.id === booster.id).parts[0].prop) < 1, 'propellant is the sim\'s current propellant');
const built = snapshotToLandingVehicle(snap);
const v = built.vehicle;
ok(v.dry > 0 && v.prop >= 500, 'vehicle mass from the snapshot');
eq(v.start.y, snap.alt, 'start height is the flown height');
eq(v.start.vy, snap.vUp, 'start vertical speed is the flown one');
eq(v.dry + v.prop, booster.parts[0].dry + snap.propKg, 'mass at the burn is the flown dry mass plus the flown propellant');
ok(built.assumed.some(a => a.includes('wind')), 'the wind is listed as assumed');
ok(built.assumed.length >= 4, 'several assumed fields are listed');
ok(Array.isArray(built.warnings), 'warnings are returned');
ok(built.warnings.every(w => typeof w === 'string' && w.length > 0), 'warnings are readable strings');
let unknownEngine = null; try { snapshotToLandingVehicle({ ...snap, stage: { ...snap.stage, engine: 'nope' } }); } catch (e) { unknownEngine = e; }
ok(unknownEngine && /unknown engine/.test(unknownEngine.message), 'a snapshot with an unknown engine is refused');
ok(/Flown in the Shipyard/.test(describeFlown(built.flown, built.assumed)), 'the Landing Lab note names the flight');

// a landing-range snapshot (the real booster's frame, moved into the last kilometres of its descent), flown by the landing sim
const near = { ...snap, alt: 2400, speed: 150, vUp: -120, vTan: -70, tiltDeg: 3, massKg: snap.massKg, propKg: 9000 };
const nb = snapshotToLandingVehicle(near);
VEHICLES['test-shipyard'] = nb.vehicle;
const landSim = createLanding({ vehicle: 'test-shipyard', guidance: 'optimal', noise: false, dispersed: false, seed: 3 });
eq(landSim.s.y, 2400, 'the landing starts at the flown height (no default 7 km)');
const out = landSim.run(300);
const res = landingResult(out, { handoffId: near.id, stage: nb.flown.stage, vehicle: nb.vehicle.name, target: nb.vehicle.target.kind, limits: landingLimits(nb.vehicle) });
eq(res.kind, 'landing-result', 'result kind');
ok(res.ok === out.ok && res.status === (out.ok ? 'landed' : 'failed'), 'result status follows the sim');
ok(res.constraintsOk === out.ok, `the sim's own limits agree with the result (sim ok=${out.ok}, reason: ${out.reason})`);
ok(res.fuelLeftKg <= nb.vehicle.prop + 1, 'fuel left is not more than was loaded');
// the limits, applied to a made-up touchdown
const lim = landingLimits(nb.vehicle);
ok(checkConstraints({ vv: 1, vh: 0.5, tilt: 2, miss: 3 }, lim).ok, 'a gentle, centred touchdown passes');
ok(!checkConstraints({ vv: lim.vv + 1, vh: 0, tilt: 0, miss: 0 }, lim).ok, 'too fast down fails');
ok(!checkConstraints({ vv: 0, vh: 0, tilt: lim.tilt + 1, miss: 0 }, lim).ok, 'too tilted fails');
ok(!checkConstraints({ vv: 0, vh: 0, tilt: 0, miss: lim.radius + 5 }, lim).ok, 'missing the target fails');
ok(landingResult({ ok: true, vv: 1, vh: 0, tilt: 1, miss: 1, fuel: 1000, fuelUsed: 10, t: 40 }, { target: 'catch' }).status === 'caught', 'a caught stage is reported as caught');

// the real flight: the booster's landing burn below 5 km (the height the Shipyard hands over at; higher up the Landing Lab's
// terminal-descent model does not apply), flown by the landing sim with its own limits.  The result must agree with those limits.
{
  const fcfg = { world: 'earth', payload: { mass: 0, fairing: 0 }, mission: { start: 'pad', orbitAlt: 250e3, dock: true, land: true, stationAlt: 420e3, gLimit: 4.5, kickDeg: 4, kickSpeed: 45, goal: 'dock' }, stages: presetState(PRESETS.f9dock).stages };
  const flight = createSim(JSON.parse(JSON.stringify(fcfg)));
  let found = null, n = 0;
  while (!flight.done && !found && n++ < 4000) {
    flight.advance(1, 400000);
    const b = flight.crafts.find(c => c.role === 'booster' && c.parts[0]?.name === 'Booster');
    if (b && b.alive && b.ap.phase === 'landing' && flight.env(b).h <= 5000) found = flightSnapshot(flight, b, { id: 'real-1' });
    if (b && !b.alive) break;
  }
  ok(found, 'the real booster reaches a landing burn below 5 km');
  const rb = snapshotToLandingVehicle(found);
  VEHICLES['test-real'] = rb.vehicle;
  const rsim = createLanding({ vehicle: 'test-real', guidance: 'optimal', noise: false, dispersed: false, seed: 5 });
  const rout = rsim.run(300);
  const rres = landingResult(rout, { handoffId: found.id, stage: 'Booster', vehicle: rb.vehicle.name, target: rb.vehicle.target.kind, limits: landingLimits(rb.vehicle) });
  ok(rres.constraintsOk === rout.ok, `real flight: result agrees with the sim's limits (sim ok=${rout.ok}, ${rout.reason})`);
  ok(rout.ok, 'real flight: the booster lands from its flown state with the sim\'s own guidance (no noise, no wind)');
}

console.log(`lab-store ok (${checks} checks)`);
