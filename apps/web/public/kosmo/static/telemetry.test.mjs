// telemetry.test.mjs -- node checks for telemetry.js: the formatters, the orbit and delta-v derivations against the real Shipyard
// sim (the f9exp preset, read from shipyard.html), the Landing Lab payload from a real descent, and the throttled, framed-only post.
// Run by run-tests.mjs (node static/telemetry.test.mjs also works).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSim, analyze, elements, WORLDS } from './ship-sim.js';
import { createLanding, stopHeight } from './landing-sim.js';
import {
  TELEMETRY_FIELDS, TELEMETRY_MIN_INTERVAL_MS, fmt, orbitFromState, stageDeltaV, attitude, maxQFromSamples, telemetryPayload,
  statusLine, postTelemetry, handoffIndex, isHandoffRequest,
} from './telemetry.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); checks++; };
const near = (a, b, rel, msg) => { ok(Math.abs(a - b) <= rel * Math.max(Math.abs(b), 1e-9), `${msg}: ${a} vs ${b}`); };

// ---- formatters ----
eq(fmt.km(null), '--', 'undefined altitude shows --');
eq(fmt.km(NaN), '--', 'NaN shows --');
eq(fmt.km(Infinity), '--', 'infinite apoapsis shows --');
eq(fmt.km(400e3), '400 km', 'km, no decimals from 100 km');
eq(fmt.km(-84.3e3), '-84.3 km', 'negative altitude keeps its sign');
eq(fmt.km(3.5e3), '3.50 km', 'km with two decimals below 10 km');
eq(fmt.kmps(7790), '7.79 km/s', 'km/s');
eq(fmt.minsec(5484), '91:24', 'min:s of a 91-minute orbit');
eq(fmt.minsec(59.9), '0:59', 'min:s rounds down to whole seconds');
eq(fmt.minsec(undefined), '--', 'undefined time shows --');
eq(fmt.minsec(-5), '--', 'negative time shows --');
eq(fmt.pct(62.4), '62%', 'percent');
eq(fmt.clock(90), '1:30', 'mission clock m:ss');
eq(fmt.clock(3723), '1:02:03', 'mission clock h:mm:ss');
eq(statusLine({ mode: 'shipyard', twr: 1.4, stage: 1, t: 90 }), 'Stage 1 burning, T+1:30', 'status line while a stage burns');
eq(statusLine({ mode: 'shipyard', twr: 0, stage: 2, t: 90 }, 'In orbit'), 'In orbit, T+1:30', 'status line with the phase label while coasting');

// ---- orbit from state, analytic cases ----
{
  const W = WORLDS.earth, R = W.R + 400e3, v = Math.sqrt(W.mu / R);
  const o = orbitFromState(W, [R, 0], [0, v]);
  near(o.apo, 400e3, 1e-9, 'circular apoapsis is 400 km');
  near(o.peri, 400e3, 1e-9, 'circular periapsis is 400 km');
  near(o.ecc, 0, 1e-6, 'circular eccentricity is 0');
  near(o.period, 2 * Math.PI * Math.sqrt(R ** 3 / W.mu), 1e-9, 'period from Kepler');
  const sub = orbitFromState(W, [W.R + 50e3, 0], [0, 5000]);   // 5 km/s sideways at 50 km: the orbit dips into the planet
  ok(sub.peri < 0 && sub.belowSurface, 'a suborbital periapsis is negative and flagged below the surface');
  ok(Number.isFinite(sub.apo) && sub.period > 0, 'a suborbital (bound) trajectory still has an apoapsis and a period');
  const esc = orbitFromState(W, [W.R + 400e3, 0], [0, 1.2 * Math.sqrt(2 * W.mu / (W.R + 400e3))]);
  ok(esc.escape && esc.apo === null && esc.period === null, 'an escape trajectory has no apoapsis or period');
}

// ---- the Shipyard's f9exp preset, read from shipyard.html (so this test cannot drift from the page) ----
const html = readFileSync(new URL('./shipyard.html', import.meta.url), 'utf8');
const CAPSULE = new Function(`return ${/const CAPSULE = (\{[^\n]*\});/.exec(html)[1]};`)();
const PRESETS = new Function('CAPSULE', `return ${/const PRESETS = (\{[\s\S]*?\n\});/.exec(html)[1]};`)(CAPSULE);
const clone = o => JSON.parse(JSON.stringify(o));
function presetCfg(p) {   // what the Shipyard's buildCfg() gives for an untouched preset (goal orbit, no tuning)
  const stages = clone(p.stages).map(s => ({ landing: { mode: 'none', reserve: 0, site: 'downrange', engines: 1 }, ...s }));
  return { world: p.world, stages, payload: clone(p.payload), mission: { kickDeg: 4, kickSpeed: 45, ...clone(p.mission), goal: 'orbit' } };
}
const cfg = presetCfg(PRESETS.f9exp);
const sim = createSim(cfg);
const sy = telemetryPayload(sim);

// delta-v at liftoff against the sim's own design analysis (analyze), stage by stage
{
  const own = analyze(cfg).stages, est = stageDeltaV(sim.crafts[0]).perStage;
  eq(est.length, own.length, 'one delta-v per stage');
  own.forEach((s, i) => near(est[i].dv, s.dv, 0.05, `stage ${i + 1} delta-v (est.) within 5% of analyze()`));
  const tot = stageDeltaV(sim.crafts[0]).total, ownTot = analyze(cfg).dvTotal;
  near(tot, ownTot, 0.05, 'total delta-v (est.) within 5% of analyze()');
}

// a flight: checkpoints, then orbit insertion
const seen = [];
const snap = label => { const p = telemetryPayload(sim), own = sim.elementsOf(sim.crafts[0]); seen.push({ label, p, own }); return p; };
for (const t of [30, 120]) { while (sim.t < t && !sim.done) sim.advance(1); snap(`t${t}`); }
const at30 = seen[0].p, own = seen[0].own, c = sim.crafts[0];
ok(at30.stage === 1 && at30.stages === 2, 'before separation the vehicle is stage 1 of 2');
eq(at30.apo, own.apogeeAlt, 'apoapsis in the payload is the sim\'s own apogee (exact)');
eq(at30.peri, own.perigeeAlt, 'periapsis in the payload is the sim\'s own perigee (exact)');
ok(at30.dvStage > 0 && at30.dvTotal > at30.dvStage, 'at t=30 the stage delta-v is positive and the total (two stages) is larger');
// fly to the orbit insertion, watching for the stage separation on the way
let n = 0; while (!sim.outcome.orbit && !sim.done && n++ < 20000) sim.advance(1);
ok(sim.outcome.orbit && sim.outcome.orbit.ok, 'the f9exp preset reaches orbit (precondition)');
const ins = telemetryPayload(sim);
const insOrbit = sim.outcome.orbit;
near(ins.apo, insOrbit.apogee, 0.01, 'apoapsis at insertion within 1% of the sim\'s outcome');
near(ins.peri, insOrbit.perigee, 0.01, 'periapsis at insertion within 1% of the sim\'s outcome');
ok(ins.period > 80 * 60 && ins.period < 100 * 60, `a 400 km orbit has a period near 92 min (got ${fmt.minsec(ins.period)})`);
ok(ins.event === null || typeof ins.event === 'string', 'event is a string or null');
ok(ins.dvTotal < at30.dvTotal, 'delta-v left goes down as propellant is burned');
ok(ins.propellantPct < at30.propellantPct && ins.propellantPct >= 0, 'propellant percent goes down');
ok(ins.stage === 2 || ins.stage === 1, 'stage is a valid stage number');
const mq = maxQFromSamples(sim.samples, sim.t, { q: sim.env(sim.crafts[0]).q, t: sim.t });
ok(mq.q > 0 && mq.t > 0 && mq.t <= sim.t, 'max-Q is found in the sim samples, at a time before now');
eq(maxQFromSamples([], 5, { q: 7, t: 5 }), { q: 7, t: 5 }, 'max-Q includes the current value before any sample');
// attitude: pitch and flight-path angle are in degrees, and pitch is near 90 on the way up
{
  const a = attitude(sim.crafts[0], sim.env(sim.crafts[0]));
  ok(Number.isFinite(a.pitch) && a.pitch >= -180 && a.pitch <= 180, 'pitch is an angle');
}
// the payload has every key, and only those
{
  const keys = Object.keys(ins);
  eq(keys.slice().sort(), ['mode', ...TELEMETRY_FIELDS].sort(), 'Shipyard payload has every schema key and no others');
  eq(keys.filter(k => k !== 'mode'), TELEMETRY_FIELDS, 'keys are in schema order');
  ok(ins.mode === 'shipyard', 'mode is shipyard');
  for (const k of TELEMETRY_FIELDS) ok(ins[k] === null || typeof ins[k] === 'number' || typeof ins[k] === 'string', `${k} is a number, string or null`);
  eq(JSON.parse(JSON.stringify(ins)), ins, 'payload survives structured-clone-like JSON round trip');
}

// ---- the Landing Lab: a real descent from the default Falcon 9 vehicle ----
{
  const L = createLanding({ vehicle: 'falcon9', guidance: 'optimal', noise: false, wind: 0, seed: 3 });
  const p0 = telemetryPayload(L);
  eq(p0.mode, 'landing', 'landing payload mode');
  eq(p0.apo, null, 'no orbit in the Landing Lab');
  eq(p0.period, null, 'no period in the Landing Lab');
  eq(p0.stage, 1, 'one stage');
  ok(p0.altitude > 0 && p0.speed > 0 && p0.dvStage > 0, 'altitude, speed and delta-v are positive at the start');
  ok(p0.propellantPct > 99 && p0.propellantPct <= 100.01, 'full propellant at the start');
  for (let i = 0; i < 4000 && !L.E.on && !L.done; i++) L.advance(0.1);
  ok(L.E.on, 'the engine lights on this descent (precondition)');
  L.advance(1);
  const p1 = telemetryPayload(L);
  ok(p1.twr > 0, 'thrust-to-weight is positive while the engine burns');
  ok(p1.propellantPct < p0.propellantPct, 'propellant falls during the burn');
  ok(Number.isFinite(stopHeight(L.veh, L.est, 0.97)), 'the ignition helper is exported and finite');
  eq(Object.keys(p1).filter(k => k !== 'mode').length, TELEMETRY_FIELDS.length, 'landing payload has every schema key');
  ok(p1.event === null || typeof p1.event === 'string', 'landing event is a string or null');
}

// ---- posting: framed only, at most 4 Hz ----
{
  const sent = [];
  const parent = { postMessage: (m, origin) => sent.push({ m, origin }) };
  const framed = { parent, location: { origin: 'http://localhost:3001' } };
  const gate = { last: -Infinity };
  const msg = { mode: 'shipyard', t: 1, phase: 'ascent' };
  eq(postTelemetry(framed, msg, 0, gate), true, 'the first message is posted');
  eq(postTelemetry(framed, msg, 100, gate), false, 'a message 100 ms later is held back');
  eq(postTelemetry(framed, msg, TELEMETRY_MIN_INTERVAL_MS - 1, gate), false, 'just under 250 ms is held back');
  eq(postTelemetry(framed, msg, TELEMETRY_MIN_INTERVAL_MS + 10, gate), true, 'after 250 ms it is posted again');
  eq(sent.length, 2, 'two messages in 260 ms of calls');
  eq(sent[0].origin, 'http://localhost:3001', 'posted with the page\'s own origin, never *');
  eq(postTelemetry({ parent, location: { origin: 'null' } }, msg, 1e6, { last: -Infinity }), false, 'no real origin: nothing is posted');
  eq(sent[0].m.type, 'flightlab:telemetry', 'message type');
  eq(sent[0].m.v, 1, 'message version');
  eq(sent[0].m.mode, 'shipyard', 'mode is carried in the message');
  const top = { parent: undefined }; top.parent = top;
  eq(postTelemetry(top, msg, 1e6, { last: -Infinity }), false, 'a page that is not framed posts nothing');
  eq(postTelemetry({ parent: null }, msg, 1e6, { last: -Infinity }), false, 'no parent posts nothing');
  eq(handoffIndex([{ name: 'Booster' }, { name: 'Upper' }], 1), 1, 'hand-off by index');
  eq(handoffIndex([{ name: 'Booster' }, { name: 'Upper' }], 'Upper'), 1, 'hand-off by name');
  eq(handoffIndex([{ name: 'Booster' }], 5), -1, 'an index out of range names no stage');
  eq(handoffIndex([{ name: 'Booster' }], -1), -1, 'a negative index names no stage');
  eq(handoffIndex([{ name: 'Booster' }], 0.5), -1, 'a fractional index names no stage');
  eq(handoffIndex([{ name: 'Booster' }], 'Nope'), -1, 'an unknown name names no stage');
  eq(handoffIndex([{ name: 'Booster' }], { x: 1 }), -1, 'an object names no stage');
  eq(handoffIndex(null, 0), -1, 'no stages list names no stage');
  const self = { location: { origin: 'http://localhost:3001' } }; self.parent = { id: 'parent' }; self.self = self;
  const good = { data: { type: 'flightlab:request-handoff', stage: 0 }, origin: 'http://localhost:3001', source: self.parent };
  eq(isHandoffRequest(good, self), true, 'a request from our parent frame is accepted');
  eq(isHandoffRequest({ ...good, origin: 'https://evil.example' }, self), false, 'a request from another origin is refused');
  eq(isHandoffRequest({ ...good, source: {} }, self), false, 'a request not from the parent window is refused');
  eq(isHandoffRequest({ ...good, data: { type: 'other' } }, self), false, 'another message type is refused');
  eq(isHandoffRequest({ ...good, data: null }, self), false, 'a null payload is refused');
  eq(isHandoffRequest(good, { location: self.location, parent: self }), false, 'an unframed page accepts nothing');
  const throwing = { parent: { postMessage() { throw new Error('closed'); } }, location: { origin: 'http://localhost:3001' } };
  eq(postTelemetry(throwing, msg, 1e6, { last: -Infinity }), false, 'a failing parent never throws into the page');
}

console.log(`telemetry ok (${checks} checks)`);
