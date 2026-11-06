// Headless checks for the engine library (engines-library.json, engines.js) and its generated and catalogue copies.  Run:  node engines-library.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINES, resolveEngine, notFlyableReason } from './engines.js';
import { buildEnginesBlock } from './tools/build-engine-library.mjs';
import { VEHICLES } from './landing-sim.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
const LIB_TEXT = read('engines-library.json');
const LIB = JSON.parse(LIB_TEXT).engines;
const CATALOGUE = join(here, '..', 'data', 'vehicles');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };

// 1. every engine a preset uses resolves to a library engine that can be flown
{
  const shipyard = read('shipyard.html');
  const presetIds = [...new Set([...shipyard.matchAll(/engine: '([^']+)'/g)].map(m => m[1]))];
  const landingIds = Object.values(VEHICLES).map(v => v.engine);
  const flight = JSON.parse(read('flight-data.json'));
  const flightIds = Object.values(flight.landingVehicles || {}).map(v => v.engine).filter(Boolean);
  const all = [...new Set([...presetIds, ...landingIds, ...flightIds])];
  const missing = all.filter(id => { try { resolveEngine(id); return false; } catch { return true; } });
  check('every preset engine id (shipyard PRESETS, landing VEHICLES, flight-data landingVehicles) resolves', missing.length === 0, missing.join(', ') || `${all.length} ids`);
  const notFly = all.filter(id => notFlyableReason(ENGINES[resolveEngine(id)]));
  check('every preset engine is flyable', notFly.length === 0, notFly.join(', ') || '');
}

// 2. no duplicate ids or aliases
{
  const keyCount = (LIB_TEXT.match(/^    "[^"]+": \{/gm) || []).length;
  check('no duplicate engine ids in engines-library.json', keyCount === Object.keys(LIB).length, `${keyCount} keys, ${Object.keys(LIB).length} after parse`);
  const idMismatch = Object.entries(LIB).filter(([k, e]) => e.id !== k).map(([k]) => k);
  check('each row carries its own key as id', idMismatch.length === 0, idMismatch.join(', '));
  const names = Object.values(LIB).flatMap(e => [e.id, ...(e.aliases || [])]);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  check('no duplicate ids or aliases across rows', dup.length === 0, [...new Set(dup)].join(', '));
}

// 3. the catalogue strings map to the library (A4 engine has no library entry and must stay unresolved)
{
  const expect = {
    'NK-15': 'nk-15', 'F-1': 'f-1', 'J-2': 'j-2', 'Merlin 1D': 'merlin-1d', 'Merlin 1D Vacuum': 'merlin-vac',
    'Raptor': 'raptor-2', 'Raptor 3': 'raptor-3', 'Rutherford': 'rutherford', 'Rutherford Vacuum': 'rutherford-vac',
  };
  const bad = Object.entries(expect).filter(([s, id]) => { try { return resolveEngine(s) !== id; } catch { return true; } }).map(([s]) => s);
  check('catalogue engine strings map to their library ids (9 single-engine strings)', bad.length === 0, bad.join(', '));
  const mixed = ['Raptor', 'Raptor Vacuum'].map(resolveEngine);
  check('"Raptor / Raptor Vacuum" is the two library ids raptor-2 and raptor-vac', mixed.join() === 'raptor-2,raptor-vac');
  let a4 = true; try { resolveEngine('A4 engine'); } catch { a4 = false; }
  check('"A4 engine" is not in the library (no sourced Isp), so it stays unresolved', !a4);
}

// 4. unknown ids throw (no silent Merlin fallback)
{
  let threw = false; try { resolveEngine('no-such-engine', 'test'); } catch (e) { threw = /unknown engine/.test(e.message); }
  check('unknown engine id throws', threw);
}

// 5. thrust, Isp, mass and limits are sane
{
  const bad = [];
  for (const [id, e] of Object.entries(LIB)) {
    const pos = ['thrustSL', 'thrustVac', 'ispSL', 'ispVac', 'mass'].filter(k => typeof e[k] !== 'number' || e[k] < 0);
    if (pos.length) bad.push(`${id}: ${pos.join('/')} not a non-negative number`);
    if (!(e.ispVac > 0)) bad.push(`${id}: ispVac must be positive`);
    if (e.ispVac < e.ispSL) bad.push(`${id}: ispVac ${e.ispVac} < ispSL ${e.ispSL}`);
    if (e.vacOnly && e.thrustSL !== 0) bad.push(`${id}: vacOnly but thrustSL ${e.thrustSL}`);
    if (!e.vacOnly && !(e.thrustSL > 0)) bad.push(`${id}: not vacOnly but thrustSL is 0`);
    if (e.thrustVac > 0 && e.thrustSL > e.thrustVac * 1.05) bad.push(`${id}: thrustSL ${e.thrustSL} well above thrustVac ${e.thrustVac}`);
    if (e.minThrottle != null && !(e.minThrottle > 0 && e.minThrottle <= 1)) bad.push(`${id}: minThrottle ${e.minThrottle} outside (0,1]`);
    if (e.ignitions != null && !(Number.isInteger(e.ignitions) && e.ignitions >= 1)) bad.push(`${id}: ignitions must be an integer >= 1 or null`);
    if (e.gimbalDeg != null && !(e.gimbalDeg >= 0 && e.gimbalDeg <= 30)) bad.push(`${id}: gimbalDeg ${e.gimbalDeg} out of range`);
  }
  check('thrust, Isp, mass, throttle, starts and gimbal fields are sane', bad.length === 0, bad.join('; '));
  check('the Raptor 2 sea-level Isp is the sourced 347 s (was 327 s)', LIB['raptor-2'].ispSL === 347);
  check('J-2 and J-2S are two engines (vacuum thrust and Isp differ)', LIB['j-2'] && LIB['j-2s'] && LIB['j-2'].ispVac !== LIB['j-2s'].ispVac && LIB['j-2'].thrustVac !== LIB['j-2s'].thrustVac);
}

// 6. the library, the sim table and the generated copies agree
{
  const sim = Object.keys(ENGINES).filter(id => LIB[id]);
  const same = sim.every(id => ENGINES[id].thrustVac === LIB[id].thrustVac && ENGINES[id].ispVac === LIB[id].ispVac && ENGINES[id].ispSL === LIB[id].ispSL);
  check('engines.js table holds the library figures', same && sim.length === Object.keys(LIB).length, `${sim.length} engines`);
  const flight = JSON.parse(read('flight-data.json'));
  const generated = buildEnginesBlock(JSON.parse(LIB_TEXT));
  check('flight-data.json engines block equals the generated block', JSON.stringify(flight.engines) === JSON.stringify(generated),
    'run: node static/tools/build-engine-library.mjs');
}

// 7. catalogue links point at library ids; engine rows are linked
{
  const launch = JSON.parse(readFileSync(join(CATALOGUE, 'launch-vehicles.json'), 'utf8'));
  const engines = JSON.parse(readFileSync(join(CATALOGUE, 'engines.json'), 'utf8'));
  const ids = [...launch.flatMap(v => (v.stages || []).map(s => s.engine_id)), ...engines.map(e => e.engine_id)].flat();
  const unknown = ids.filter(id => id != null && !LIB[id]);
  check('every catalogue engine_id is a library id', unknown.length === 0, unknown.join(', '));
  const unlinked = launch.flatMap(v => (v.stages || []).filter(s => !('engine_id' in s))).length + engines.filter(e => !('engine_id' in e)).length;
  check('every catalogue stage and engine row carries engine_id', unlinked === 0, `${unlinked} without`);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall checks passed');
process.exit(failed ? 1 : 0);
