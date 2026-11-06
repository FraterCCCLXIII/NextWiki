// engines.js -- the one engine table shared by the Shipyard (ship-sim.js) and the Landing Lab (landing-sim.js).
// The data is in engines-library.json (single source of truth; format in ENGINES.md). It is imported here with an import
// attribute, so it loads synchronously in browsers and in node. flight-data.json carries a generated copy of the engines block
// (static/tools/build-engine-library.mjs); the copy served from the database overrides rows at run time through loadEngines().
// Unknown engine ids or catalogue aliases are errors: resolveEngine() throws, there is no fallback engine.
import { UNITS } from './sim-physics.js';
import LIB from './engines-library.json' with { type: 'json' };

export const P0 = 101325;
export const ENGINES = {};
const ALIAS = new Map();      // alias or id -> id, for every engine loaded (catalogue strings such as "Raptor / Raptor Vacuum" are not in it)

/** Derived numbers every consumer needs: exit-area term of the thrust-vs-pressure model and the vacuum mass flow per engine. */
export function finishEngine(e) { e.Ae = (e.thrustVac - e.thrustSL) / P0; e.mdot1 = e.thrustVac / (e.ispVac * UNITS.g0); return e; }

function indexEngine(id, e) {
  ALIAS.set(id, id);
  for (const a of e.aliases || []) {
    const prev = ALIAS.get(a);
    if (prev && prev !== id) throw new Error(`engines: alias "${a}" is used by both ${prev} and ${id}`);
    ALIAS.set(a, id);
  }
}
for (const [id, row] of Object.entries(LIB.engines)) { ENGINES[id] = finishEngine({ ...row }); indexEngine(id, row); }

/** Resolve an engine id or a catalogue alias to its library id. Anything unknown throws: no silent Merlin fallback. */
export function resolveEngine(ref, where = 'engine') {
  if (typeof ref === 'string' && ENGINES[ref]) return ref;
  const id = typeof ref === 'string' ? ALIAS.get(ref) : undefined;
  if (!id) throw new Error(`${where}: unknown engine "${ref}" (not in engines-library.json; add it there or fix the id/alias)`);
  return id;
}
/** The engine object for an id or alias (throws if unknown). */
export function engineOf(ref, where) { return ENGINES[resolveEngine(ref, where)]; }
/** Why an engine cannot be flown by the sims, or null when it can. Unsourced starts or throttle make it listed but not flyable. */
export function notFlyableReason(e) {
  if (e.minThrottle == null) return 'no minimum throttle in the library';
  if (e.ignitions == null) return 'no start count in the library';
  return null;
}
/** Throws if an engine cannot be flown (the caller passes the stage or vehicle name for the message). */
export function requireFlyable(e, where = 'engine') {
  const why = notFlyableReason(e);
  if (why) throw new Error(`${where}: engine "${e.id ?? e.name}" cannot be flown: ${why}`);
  return e;
}
for (const e of Object.values(ENGINES)) finishEngine(e);

/** Merge rows from flight-data.json into the shared table (existing keys are updated in place, so imports elsewhere see the change). */
export function loadEngines(rows) {
  if (!rows || typeof rows !== 'object') return 0;
  let n = 0;
  for (const [k, e] of Object.entries(rows)) { if (k.startsWith('_')) continue; ENGINES[k] = finishEngine(Object.assign(ENGINES[k] || {}, e)); indexEngine(k, ENGINES[k]); n++; }
  return n;
}
