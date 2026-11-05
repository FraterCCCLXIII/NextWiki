// engines.js -- the one engine table shared by the Shipyard (ship-sim.js) and the Landing Lab (landing-sim.js).
// Defaults live here so both simulators work offline and in node; flight-data.json (served from the database as the dataset
// "flight-data.json") overrides or adds rows at run time through loadEngines().
// Figures are approximate public numbers: thrust (N), Isp (s), mass (kg), minimum throttle (fraction), restarts.
import { UNITS } from './sim-physics.js';

export const P0 = 101325;
export const ENGINES = {
  'merlin-1d': { name: 'Merlin 1D', thrustSL: 845e3, thrustVac: 914e3, ispSL: 282, ispVac: 311, mass: 470, minThrottle: 0.39, ignitions: 5, prop: 'kerolox' },
  'merlin-vac': { name: 'Merlin 1D Vacuum', thrustSL: 0, thrustVac: 981e3, ispSL: 0, ispVac: 348, mass: 500, minThrottle: 0.39, ignitions: 4, prop: 'kerolox', vacOnly: true },
  'raptor-2': { name: 'Raptor 2', thrustSL: 2.26e6, thrustVac: 2.5e6, ispSL: 327, ispVac: 350, mass: 1600, minThrottle: 0.4, ignitions: 6, prop: 'methalox' },
  'raptor-vac': { name: 'Raptor Vacuum', thrustSL: 0, thrustVac: 2.5e6, ispSL: 0, ispVac: 380, mass: 1700, minThrottle: 0.4, ignitions: 6, prop: 'methalox', vacOnly: true },
  'be-4': { name: 'BE-4', thrustSL: 2.4e6, thrustVac: 2.6e6, ispSL: 310, ispVac: 335, mass: 2000, minThrottle: 0.5, ignitions: 3, prop: 'methalox' },
  'rs-25': { name: 'RS-25', thrustSL: 1.86e6, thrustVac: 2.279e6, ispSL: 366, ispVac: 452, mass: 3527, minThrottle: 0.67, ignitions: 1, prop: 'hydrolox' },
  'f-1': { name: 'F-1', thrustSL: 6.77e6, thrustVac: 7.77e6, ispSL: 263, ispVac: 304, mass: 8400, minThrottle: 1, ignitions: 1, prop: 'kerolox' },
  'j-2': { name: 'J-2', thrustSL: 0, thrustVac: 1.033e6, ispSL: 0, ispVac: 421, mass: 1788, minThrottle: 0.8, ignitions: 3, prop: 'hydrolox', vacOnly: true },
  'rl10': { name: 'RL10', thrustSL: 0, thrustVac: 110e3, ispSL: 0, ispVac: 465, mass: 190, minThrottle: 0.2, ignitions: 6, prop: 'hydrolox', vacOnly: true },
  'rutherford': { name: 'Rutherford', thrustSL: 24e3, thrustVac: 26e3, ispSL: 311, ispVac: 343, mass: 35, minThrottle: 0.5, ignitions: 1, prop: 'kerolox' },
  'rutherford-vac': { name: 'Rutherford Vacuum', thrustSL: 0, thrustVac: 25.8e3, ispSL: 0, ispVac: 343, mass: 35, minThrottle: 0.5, ignitions: 2, prop: 'kerolox', vacOnly: true },
  'aj10-oms': { name: 'AJ10 OMS', thrustSL: 0, thrustVac: 26.7e3, ispSL: 0, ispVac: 316, mass: 118, minThrottle: 0.98, ignitions: 1000, prop: 'hypergolic', vacOnly: true },
  'draco-cluster': { name: 'Draco cluster (4 kN)', thrustSL: 0, thrustVac: 4e3, ispSL: 0, ispVac: 300, mass: 40, minThrottle: 0.05, ignitions: 1000, prop: 'hypergolic', vacOnly: true },
  'solid-motor': { name: 'Solid motor', thrustSL: 1.2e6, thrustVac: 1.3e6, ispSL: 242, ispVac: 262, mass: 800, minThrottle: 1, ignitions: 1, prop: 'solid' },
  'be-3pm': { name: 'BE-3PM (deep throttle)', thrustSL: 490e3, thrustVac: 520e3, ispSL: 320, ispVac: 350, mass: 450, minThrottle: 0.2, ignitions: 6, prop: 'hydrolox' },
  'be-7': { name: 'BE-7', thrustSL: 0, thrustVac: 44.5e3, ispSL: 0, ispVac: 453, mass: 120, minThrottle: 0.2, ignitions: 10, prop: 'hydrolox', vacOnly: true },
};

/** Derived numbers every consumer needs: exit-area term of the thrust-vs-pressure model and the vacuum mass flow per engine. */
export function finishEngine(e) { e.Ae = (e.thrustVac - e.thrustSL) / P0; e.mdot1 = e.thrustVac / (e.ispVac * UNITS.g0); return e; }
for (const e of Object.values(ENGINES)) finishEngine(e);

/** Merge rows from flight-data.json into the shared table (existing keys are updated in place, so imports elsewhere see the change). */
export function loadEngines(rows) {
  if (!rows || typeof rows !== 'object') return 0;
  let n = 0;
  for (const [k, e] of Object.entries(rows)) { if (k.startsWith('_')) continue; ENGINES[k] = finishEngine(Object.assign(ENGINES[k] || {}, e)); n++; }
  return n;
}
