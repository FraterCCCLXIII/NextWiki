// flight-lab-shell.test.mjs -- the pure logic of the Flight Lab shell (flight-lab-shell.js): modes, routing, storage that
// is missing or blocked, telemetry and landing-result checks, the frame-of-origin rule, and the bar's formatting.
//   node static/flight-lab-shell.test.mjs
import assert from 'node:assert/strict';
import * as S from './flight-lab-shell.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; };

// ---- modes ----
ok('modes: three routable modes, Plan and Review are placeholders for M4', () => {
  const routable = S.MODES.filter(m => !m.soon).map(m => m.id);
  assert.deepEqual(routable, ['design', 'land', 'ascent']);
  assert.equal(S.modeById('plan').soon, 'M4');
  assert.equal(S.modeById('review').soon, 'M4');
});
ok('normalizeMode: names, case, legacy tab names, placeholders and junk', () => {
  assert.equal(S.normalizeMode('land'), 'land');
  assert.equal(S.normalizeMode(' LAND '), 'land');
  assert.equal(S.normalizeMode('mission'), 'design');
  assert.equal(S.normalizeMode('landing'), 'land');
  assert.equal(S.normalizeMode('concepts'), 'ascent');
  assert.equal(S.normalizeMode('plan'), null);
  assert.equal(S.normalizeMode('review'), null);
  assert.equal(S.normalizeMode('toString'), null);
  assert.equal(S.normalizeMode('__proto__'), null);
  assert.equal(S.normalizeMode(undefined), null);
  assert.equal(S.normalizeMode(42), null);
});
ok('modeForKey: 1, 2, 3 map to the routable modes; others do nothing', () => {
  assert.equal(S.modeForKey('1'), 'design');
  assert.equal(S.modeForKey('2'), 'land');
  assert.equal(S.modeForKey('3'), 'ascent');
  assert.equal(S.modeForKey('4'), null);
  assert.equal(S.modeForKey('r'), null);
});

// ---- routing ----
ok('parseRoute: ?mode= is the deep link (the query form)', () => {
  assert.deepEqual(S.parseRoute('?mode=land', ''), { mode: 'land', design: null });
  assert.deepEqual(S.parseRoute('mode=ascent', ''), { mode: 'ascent', design: null });
});
ok('parseRoute: #mode= and a bare legacy name in the hash', () => {
  assert.equal(S.parseRoute('', '#mode=land').mode, 'land');
  assert.equal(S.parseRoute('', '#landing').mode, 'land');
  assert.equal(S.parseRoute('', '#concepts').mode, 'ascent');
  assert.equal(S.parseRoute('', '#mission').mode, 'design');
  assert.equal(S.parseRoute('', '#mode=plan').mode, null);
  assert.equal(S.parseRoute('', '#nothing-here').mode, null);
});
ok('parseRoute: the query wins over the hash for the mode', () => {
  assert.equal(S.parseRoute('?mode=ascent', '#mode=land').mode, 'ascent');
});
ok('parseRoute: #design= and #mode=...&design=... carry the share string', () => {
  const share = 'z' + 'AbC-_9'.repeat(20);
  assert.deepEqual(S.parseRoute('', `#design=${share}`), { mode: null, design: share });
  assert.deepEqual(S.parseRoute('', `#mode=land&design=${share}`), { mode: 'land', design: share });
});
ok('parseRoute: a design that is not a share string is dropped', () => {
  assert.equal(S.parseRoute('', '#design=<script>').design, null);
  assert.equal(S.parseRoute('', '#design=a b').design, null);
  assert.equal(S.parseRoute('', '#design=' + 'a'.repeat(9000)).design, null);
  assert.equal(S.parseRoute('', '#design=').design, null);
});
ok('parseHash: percent-encoded names and broken encodings do not throw', () => {
  assert.equal(S.parseHash('#%6Cand').mode, 'land');
  assert.equal(S.parseHash('#%E0%A4%A').mode, null);
  assert.equal(S.parseHash(undefined).mode, null);
  assert.equal(S.parseHash('').design, null);
});
ok('resolveMode: explicit mode, then a design link opens Design, then the remembered mode, then Design', () => {
  assert.equal(S.resolveMode({ mode: 'land', design: 'x' }, 'ascent'), 'land');
  assert.equal(S.resolveMode({ mode: null, design: 'x' }, 'land'), 'design');
  assert.equal(S.resolveMode({ mode: null, design: null }, 'land'), 'land');
  assert.equal(S.resolveMode({ mode: null, design: null }, 'plan'), 'design');
  assert.equal(S.resolveMode({ mode: null, design: null }, null), 'design');
  assert.equal(S.resolveMode(null, null), 'design');
});
ok('buildHash: keeps the mode and a valid design; drops junk', () => {
  assert.equal(S.buildHash('land', null), '#mode=land');
  assert.equal(S.buildHash('land', 'zABC'), '#mode=land&design=zABC');
  assert.equal(S.buildHash('land', 'zA B'), '#mode=land');
  assert.equal(S.buildHash('plan', null), '#mode=design');
  assert.deepEqual(S.parseRoute('', S.buildHash('ascent', 'zABC')), { mode: 'ascent', design: 'zABC' });
});

// ---- remembered mode, storage unavailable or blocked ----
function fakeStore(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, _m: m };
}
ok('mode persistence: write then read back', () => {
  const s = fakeStore();
  assert.equal(S.writeStoredMode(s, 'land'), true);
  assert.equal(s._m.get(S.MODE_KEY), 'land');
  assert.equal(S.readStoredMode(s), 'land');
});
ok('mode persistence: a junk or placeholder value is not read or written', () => {
  const s = fakeStore({ [S.MODE_KEY]: 'plan' });
  assert.equal(S.readStoredMode(s), null);
  assert.equal(S.writeStoredMode(s, 'plan'), false);
  assert.equal(S.writeStoredMode(s, 'nope'), false);
  assert.equal(S.readStoredMode(fakeStore({ [S.MODE_KEY]: 'landing' })), 'land');
});
ok('mode persistence: no storage at all (null) is a no-op, not a throw', () => {
  assert.equal(S.readStoredMode(null), null);
  assert.equal(S.writeStoredMode(null, 'land'), false);
  assert.equal(S.readStoredMode(undefined), null);
});
ok('mode persistence: a blocked storage (accessor throws) is a no-op, not a throw', () => {
  const blocked = { getItem() { throw new DOMException('denied', 'SecurityError'); }, setItem() { throw new DOMException('full', 'QuotaExceededError'); } };
  assert.equal(S.readStoredMode(blocked), null);
  assert.equal(S.writeStoredMode(blocked, 'land'), false);
  // the page then falls back to the route or Design
  assert.equal(S.resolveMode(S.parseRoute('', ''), S.readStoredMode(blocked)), 'design');
});

// ---- frames ----
ok('frameOfMessage: a same-origin message from a known frame names the frame', () => {
  const land = {}, design = {};
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: land }, 'https://x.test', { design, land, ascent: null }), 'land');
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: design }, 'https://x.test', { design, land, ascent: null }), 'design');
});
ok('frameOfMessage: wrong origin, unknown source, or no windows is refused', () => {
  const land = {};
  assert.equal(S.frameOfMessage({ origin: 'https://evil.test', source: land }, 'https://x.test', { land }), null);
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: {} }, 'https://x.test', { land }), null);
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: null }, 'https://x.test', { land: null }), null);
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: land }, 'https://x.test', null), null);
  assert.equal(S.frameOfMessage({ origin: 'https://x.test', source: land }, '', { land }), null);
  assert.equal(S.frameOfMessage(null, 'https://x.test', { land }), null);
});

// ---- telemetry ----
const base = { type: 'flightlab:telemetry', v: 1, mode: 'shipyard', t: 83.4 };
ok('telemetry: a valid v1 sample is kept with its source frame', () => {
  const s = S.validateTelemetry({ ...base, phase: 'Ascent', name: 'Booster', altitude: 12000, speed: 410.5, vv: 300, apo: 250000, peri: 180000, twr: 1.4, dvStage: 3000, dvTotal: 7800, propellantPct: 62, stage: 1, stages: 2, g: 2.1, q: 18000, mach: 1.2, event: 'max-q' });
  assert.equal(s.source, 'design');
  assert.equal(s.t, 83.4);
  assert.equal(s.phase, 'Ascent');
  assert.equal(s.altitude, 12000);
  assert.equal(s.dvTotal, 7800);
  assert.equal(s.event, 'max-q');
});
ok('telemetry: the landing mode comes from the land frame', () => {
  assert.equal(S.validateTelemetry({ ...base, mode: 'landing' }).source, 'land');
});
ok('telemetry: wrong type, unknown version, unknown mode, bad time, non-objects are refused', () => {
  assert.equal(S.validateTelemetry({ ...base, type: 'flightlab:ready' }), null);
  assert.equal(S.validateTelemetry({ ...base, v: 2 }), null);
  assert.equal(S.validateTelemetry({ ...base, v: '1' }), null);
  assert.equal(S.validateTelemetry({ ...base, mode: 'constructor' }), null);
  assert.equal(S.validateTelemetry({ ...base, mode: 'toString' }), null);
  assert.equal(S.validateTelemetry({ ...base, mode: 'mars' }), null);
  assert.equal(S.validateTelemetry({ ...base, t: NaN }), null);
  assert.equal(S.validateTelemetry({ ...base, t: -1 }), null);
  assert.equal(S.validateTelemetry({ ...base, t: '83' }), null);
  assert.equal(S.validateTelemetry({ ...base, t: undefined }), null);
  assert.equal(S.validateTelemetry(null), null);
  assert.equal(S.validateTelemetry('flightlab:telemetry'), null);
  assert.equal(S.validateTelemetry([base]), null);
  assert.equal(S.validateTelemetry(undefined), null);
});
ok('telemetry: non-finite numbers become null; strings are trimmed and capped', () => {
  const s = S.validateTelemetry({ ...base, altitude: 'high', speed: Infinity, apo: NaN, phase: '  Coast\u0007 ' + 'x'.repeat(100), event: 'e'.repeat(500) });
  assert.equal(s.altitude, null);
  assert.equal(s.speed, null);
  assert.equal(s.apo, null);
  assert.equal(s.phase.startsWith('Coast'), true);
  assert.equal(s.phase.length <= 40, true);
  assert.equal(s.phase.includes('\u0007'), false);
  assert.equal(s.event.length, 80);
  assert.equal(s.dvTotal, null);
});
ok('telemetry: a message with only the required fields is valid', () => {
  const s = S.validateTelemetry(base);
  assert.equal(s.phase, null);
  assert.equal(s.altitude, null);
});
ok('telemetry: prototype keys in the object do not leak into the sample', () => {
  const s = S.validateTelemetry(JSON.parse('{"type":"flightlab:telemetry","v":1,"mode":"shipyard","t":1,"__proto__":{"x":1}}'));
  assert.equal(s.x, undefined);
});

// ---- landing result ----
const res = { v: 1, kind: 'landing-result', key: 'k1', status: 'landed', ok: true, stage: 'Booster', touchdownMs: 1.8, lateralMs: 0.2, tiltDeg: 1.1, missM: 0.9, fuelLeftKg: 4200, timeS: 61.2, constraintsOk: true, reason: '' };
ok('landing result: a valid record is kept for the card', () => {
  const r = S.validateLandingResult(res);
  assert.equal(r.status, 'landed');
  assert.equal(r.ok, true);
  assert.equal(r.touchdownMs, 1.8);
  assert.equal(r.fuelLeftKg, 4200);
  assert.equal(r.constraintsOk, true);
});
ok('landing result: a failed record keeps its reason', () => {
  const r = S.validateLandingResult({ ...res, status: 'failed', ok: false, reason: 'tipped over', touchdownMs: null });
  assert.equal(r.status, 'failed');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'tipped over');
  assert.equal(r.touchdownMs, null);
});
ok('landing result: wrong kind, version, status or shape is refused', () => {
  assert.equal(S.validateLandingResult({ ...res, kind: 'design' }), null);
  assert.equal(S.validateLandingResult({ ...res, v: 2 }), null);
  assert.equal(S.validateLandingResult({ ...res, status: 'exploded' }), null);
  assert.equal(S.validateLandingResult({ ...res, status: undefined }), null);
  assert.equal(S.validateLandingResult(null), null);
  assert.equal(S.validateLandingResult([res]), null);
});
ok('landing result: ok must be a real boolean, constraintsOk is null when absent', () => {
  assert.equal(S.validateLandingResult({ ...res, ok: 'yes' }).ok, false);
  assert.equal(S.validateLandingResult({ ...res, constraintsOk: undefined }).constraintsOk, null);
});

// ---- bar formatting ----
ok('formatting: mission time, distance, speed, mass, delta-v', () => {
  assert.equal(S.fmtMissionTime(83.4), 'T+ 00:01:23');
  assert.equal(S.fmtMissionTime(3725), 'T+ 01:02:05');
  assert.equal(S.fmtMissionTime(null), '--');
  assert.equal(S.fmtMissionTime(-5), 'T+ 00:00:00');
  assert.equal(S.fmtDistance(850), '850 m');
  assert.equal(S.fmtDistance(12400), '12 km');
  assert.equal(S.fmtDistance(3100), '3.1 km');
  assert.equal(S.fmtDistance(250000), '250 km');
  assert.equal(S.fmtDistance(undefined), '--');
  assert.equal(S.fmtSpeed(410.4), '410 m/s');
  assert.equal(S.fmtSpeed(NaN), '--');
  assert.equal(S.fmtTonnes(395700), '395.7 t');
  assert.equal(S.fmtTonnes(null), '--');
  assert.equal(S.fmtDeltaV(7800), '7.80 km/s');
  assert.equal(S.fmtDeltaV(950), '950 m/s');
  assert.equal(S.fmtDeltaV(undefined), '--');
});
ok('stripModel: no telemetry shows dashes and says it is waiting', () => {
  const m = S.stripModel(null);
  assert.equal(m.phase, '--');
  assert.equal(m.t, '--');
  assert.equal(m.apoPeri, '--');
  assert.equal(m.source, 'waiting for telemetry');
});
ok('stripModel: a sample shows phase, time, altitude, speed, apo / peri in km, and the source', () => {
  const m = S.stripModel(S.validateTelemetry({ ...base, mode: 'landing', phase: 'Burn', altitude: 3100, speed: 120, apo: 250000, peri: 180000, dvTotal: 900 }));
  assert.deepEqual(m, { phase: 'Burn', t: 'T+ 00:01:23', alt: '3.1 km', speed: '120 m/s', apoPeri: '250 / 180 km', dv: '900 m/s', source: 'Land' });
  const partial = S.stripModel(S.validateTelemetry({ ...base, apo: 250000 }));
  assert.equal(partial.apoPeri, '250 / -- km');
});
ok('isStale: no sample, or older than STALE_MS, is stale', () => {
  assert.equal(S.isStale(NaN, 1000), true);
  assert.equal(S.isStale(1000, 1000 + S.STALE_MS), false);
  assert.equal(S.isStale(1000, 1000 + S.STALE_MS + 1), true);
});
ok('summarizeDesign: name, stage count, total propellant; null-safe', () => {
  assert.deepEqual(S.summarizeDesign(null), { name: 'No design yet', stages: '--', prop: '--', propKg: null });
  const d = { name: 'Falcon test', stages: [{ prop: 395700 }, { prop: 92670 }] };
  const s = S.summarizeDesign(d);
  assert.equal(s.name, 'Falcon test');
  assert.equal(s.stages, '2 stages');
  assert.equal(s.propKg, 488370);
  assert.equal(S.summarizeDesign({ stages: [{}] }).name, 'Untitled design');
  assert.equal(S.summarizeDesign({ stages: [{}] }).stages, '1 stage');
});
ok('exportName: a safe file name from the design name', () => {
  assert.equal(S.exportName('Falcon test / v2!'), 'falcon-test-v2.kosmo-design.json');
  assert.equal(S.exportName(''), 'design.kosmo-design.json');
  assert.equal(S.exportName('../../etc'), 'etc.kosmo-design.json');
});

console.log(`flight-lab-shell ok (${n} checks)`);
