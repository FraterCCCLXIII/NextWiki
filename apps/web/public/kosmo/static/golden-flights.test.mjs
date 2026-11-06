// Golden-flight regression checks: fixed launch and landing scenarios whose results are pinned in
// golden-flights.json. If a change to engines, planet data or the sim constants moves a flight
// beyond its window, this fails.  Run:  node golden-flights.test.mjs
//   node golden-flights.test.mjs --record   re-measures the current tree and rewrites golden-flights.json
//                                           (only do this deliberately, after reviewing the change).
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, tuneAscent } from './ship-sim.js';
import { createLanding } from './landing-sim.js';

const here = dirname(fileURLToPath(import.meta.url));
const GOLD = join(here, 'golden-flights.json');
const RECORD = process.argv.includes('--record');
const CAP = { rcsThrust: 4000, rcsProp: 400, rcsIsp: 280, noseOffset: 2.5, cargo: 3000, chuteArea: 1500 };

// Same stage data as the Shipyard PRESETS (static/shipyard.html); the mission is flown from the pad.
const SHIP = {
  f9exp: { world: 'earth', payload: { mass: 15000, fairing: 1900 }, mission: { start: 'pad', orbitAlt: 400e3, dock: false, land: false, stationAlt: 420e3, gLimit: 4.5 },
    stages: [
      { name: 'Stage 1', engine: 'merlin-1d', count: 9, prop: 395700, diameter: 3.7, landing: { mode: 'none' } },
      { name: 'Stage 2', engine: 'merlin-vac', count: 1, prop: 92670, diameter: 3.7, landing: { mode: 'none' } }] },
  electron: { world: 'earth', payload: { mass: 250, fairing: 44 }, mission: { start: 'pad', orbitAlt: 500e3, dock: false, land: false, stationAlt: 420e3, gLimit: 6 },
    stages: [
      { name: 'Stage 1', engine: 'rutherford', count: 9, prop: 9250, diameter: 1.2, landing: { mode: 'none' } },
      { name: 'Stage 2', engine: 'rutherford-vac', count: 1, prop: 2050, diameter: 1.2, landing: { mode: 'none' } }] },
  saturn: { world: 'earth', payload: { mass: 45000, fairing: 0 }, mission: { start: 'pad', orbitAlt: 185e3, dock: false, land: false, stationAlt: 420e3, gLimit: 4.5 },
    stages: [
      { name: 'S-IC', engine: 'f-1', count: 5, prop: 2169000, diameter: 10.1, landing: { mode: 'none' }, dry: 131000 },
      { name: 'S-II', engine: 'j-2', count: 5, prop: 451000, diameter: 10.1, landing: { mode: 'none' }, dry: 36000 },
      { name: 'S-IVB', engine: 'j-2', count: 1, prop: 107000, diameter: 6.6, landing: { mode: 'none' }, dry: 10500 }] },
};

// Landing scenarios: fixed seeds, so every run is repeatable.
const LAND = {
  falcon9_nominal: { vehicle: 'falcon9', guidance: 'optimal', noise: false, seed: 3 },
  newshepard_nominal: { vehicle: 'newshepard', guidance: 'optimal', noise: false, seed: 3 },
  moonlander_nominal: { vehicle: 'moonlander', guidance: 'optimal', noise: false, seed: 3 },
  falcon9_dispersed: { vehicle: 'falcon9', guidance: 'optimal', noise: true, dispersed: true, seed: 103 },
};

// Tolerances. A window is [value - d, value + d] with d = max(abs, rel * |value|).
const TOL = {
  perigee: { rel: 0.03 }, apogee: { rel: 0.03 },
  propRemaining: { rel: 0.02 }, peakQ: { rel: 0.05 }, peakG: { rel: 0.05 },
  eventT: { abs: 2 },
  vv: { abs: 0.3, rel: 0.1 }, vh: { abs: 0.3, rel: 0.1 }, miss: { abs: 2, rel: 0.1 },
  fuel: { rel: 0.02 }, landT: { abs: 2 },
};
const win = (value, t) => { const d = Math.max(t.abs ?? 0, (t.rel ?? 0) * Math.abs(value)); return { value, lo: value - d, hi: value + d }; };
const inWin = (x, w) => Number.isFinite(x) && x >= w.lo && x <= w.hi;

// The event texts carry numbers (Δv, altitudes); compare the words and the order, and check times separately.
const normText = s => s.replace(/\(.*?\)/g, '').replace(/[-+]?\d[\d.,]*/g, '#').replace(/\s+/g, ' ').trim();

function flyShip(id, kickDeg) {
  const p = SHIP[id];
  const cfg = { world: p.world, stages: JSON.parse(JSON.stringify(p.stages)), payload: { ...p.payload },
    mission: { kickDeg, kickSpeed: 45, goal: 'orbit', ...JSON.parse(JSON.stringify(p.mission)) } };
  const sim = createSim(cfg);
  sim.run(60000);
  return { sim, cfg };
}

function measureShip(id, kickDeg) {
  const { sim } = flyShip(id, kickDeg), main = sim.crafts[0], o = sim.outcome.orbit;
  const propRemaining = sim.crafts.reduce((a, c) => a + c.parts.reduce((b, p) => b + p.prop, 0), 0);
  const events = sim.events.filter(e => ['stage', 'good', 'bad'].includes(e.kind)).map(e => ({ kind: e.kind, text: e.text, t: e.t }));
  return { done: sim.done, t: sim.t, orbitOk: !!o?.ok, perigee: o?.perigee ?? null, apogee: o?.apogee ?? null, propRemaining, peakQ: main.peakQ, peakG: main.peakG, events };
}

function measureLand(cfg) {
  const sim = createLanding(cfg), o = sim.run();
  return { landed: o.ok, t: o.t, vv: o.vv, vh: o.vh, miss: o.miss, fuel: o.fuel, reason: o.reason };
}

function gitHead() {
  try { return execFileSync('git', ['-C', here, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}
function gitDirty() {
  try {
    return execFileSync('git', ['-C', here, 'status', '--short', '--', 'ship-sim.js', 'landing-sim.js', 'engines.js', 'sim-physics.js', 'planet-data.js', 'flight-data.json', '../data/vehicles'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch { return []; }
}

if (RECORD) {
  const kicks = {};
  const ship = {};
  for (const id of Object.keys(SHIP)) {
    const cfg = { world: SHIP[id].world, stages: JSON.parse(JSON.stringify(SHIP[id].stages)), payload: { ...SHIP[id].payload },
      mission: { kickDeg: 4, kickSpeed: 45, goal: 'orbit', ...JSON.parse(JSON.stringify(SHIP[id].mission)) } };
    const tuned = tuneAscent(cfg, { lo: 1, hi: 12 });
    kicks[id] = tuned.kickDeg;
    const m = measureShip(id, tuned.kickDeg);
    ship[id] = {
      kickDeg: tuned.kickDeg, orbitOk: m.orbitOk, done: m.done,
      perigee: win(m.perigee, TOL.perigee), apogee: win(m.apogee, TOL.apogee), propRemaining: win(m.propRemaining, TOL.propRemaining),
      peakQ: win(m.peakQ, TOL.peakQ), peakG: win(m.peakG, TOL.peakG), endT: win(m.t, TOL.eventT),
      events: m.events.map(e => ({ kind: e.kind, text: normText(e.text), t: win(e.t, TOL.eventT) })),
    };
  }
  const landing = {};
  for (const [id, cfg] of Object.entries(LAND)) {
    const m = measureLand(cfg);
    landing[id] = { landed: m.landed, touchdownT: win(m.t, TOL.landT), vv: win(m.vv, TOL.vv), vh: win(m.vh, TOL.vh), miss: win(m.miss, TOL.miss), fuel: win(m.fuel, TOL.fuel) };
  }
  const out = {
    recorded: new Date().toISOString().slice(0, 10),
    gitHead: gitHead(),
    uncommittedSimFiles: gitDirty(),
    note: 'Windows are [lo, hi] around the value measured when recorded. Ship event times are seconds of mission time; landing vv/vh in m/s, fuel in kg.',
    tolerances: TOL,
    ship, landing,
  };
  writeFileSync(GOLD, JSON.stringify(out, null, 2) + '\n');
  console.log(`recorded ${GOLD}`);
  for (const id of Object.keys(ship)) console.log(id, 'kick', kicks[id].toFixed(3), JSON.stringify({ ...ship[id], events: undefined }));
  process.exit(0);
}

const gold = JSON.parse(readFileSync(GOLD, 'utf8'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const near = (name, x, w, unit = '') => check(name, inWin(x, w), `${fmt(x)}${unit} in [${fmt(w.lo)}, ${fmt(w.hi)}]`);

console.log(`golden flights recorded ${gold.recorded} at ${gold.gitHead.slice(0, 12)}`);

// (a) ship-sim presets flown from the pad to orbit, with the pitch kick pinned in the golden file
for (const id of Object.keys(gold.ship)) {
  const g = gold.ship[id], m = measureShip(id, g.kickDeg);
  check(`${id}: reaches orbit = ${g.orbitOk}`, m.orbitOk === g.orbitOk, `orbit ${m.orbitOk}`);
  near(`${id}: perigee`, m.perigee, g.perigee, ' m');
  near(`${id}: apogee`, m.apogee, g.apogee, ' m');
  near(`${id}: propellant remaining at the end`, m.propRemaining, g.propRemaining, ' kg');
  near(`${id}: max dynamic pressure`, m.peakQ, g.peakQ, ' Pa');
  near(`${id}: max g`, m.peakG, g.peakG, ' g');
  near(`${id}: mission ends`, m.t, g.endT, ' s');
  const want = g.events, got = m.events;
  const sameSeq = want.length === got.length && want.every((w, i) => w.kind === got[i].kind && normText(got[i].text) === w.text);
  check(`${id}: staging events, same order and words (${want.length})`, sameSeq,
    sameSeq ? '' : `want ${want.map(e => e.text).join(' | ')}; got ${got.map(e => normText(e.text)).join(' | ')}`);
  if (sameSeq) want.forEach((w, i) => near(`${id}: event ${i + 1} "${w.text}" time`, got[i].t, w.t, ' s'));
}

// (b) landing-sim: fixed seeds, three vehicles nominal plus one dispersed seeded flight
for (const id of Object.keys(gold.landing)) {
  const g = gold.landing[id], m = measureLand(LAND[id]);
  check(`${id}: landed = ${g.landed}`, m.landed === g.landed, m.landed ? 'landed' : m.reason);
  near(`${id}: touchdown time`, m.t, g.touchdownT, ' s');
  near(`${id}: vertical speed at touchdown`, m.vv, g.vv, ' m/s');
  near(`${id}: lateral speed at touchdown`, m.vh, g.vh, ' m/s');
  near(`${id}: miss distance`, m.miss, g.miss, ' m');
  near(`${id}: fuel remaining`, m.fuel, g.fuel, ' kg');
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
