// Headless regression checks for landing-sim.js.  Run:  node landing-sim.test.mjs   (about 30 s)
import { createLanding, monteCarlo, solveBurn, resolveVehicle, analyzeVehicle, trainPolicy, vehicleFromStage, VEHICLES } from './landing-sim.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const fly = (cfg) => { const s = createLanding({ noise: false, seed: 3, ...cfg }); const o = s.run(); return { s, o }; };

// 1. vehicles: who can hover?
{ const a = id => analyzeVehicle(resolveVehicle({ vehicle: id }));
  check('Falcon 9 cannot hover (one Merlin, 39 % minimum throttle)', !a('falcon9').canHover, 'T/W min ' + a('falcon9').twrMin.toFixed(2));
  check('New Shepard can hover (deep-throttle BE-3PM)', a('newshepard').canHover, 'T/W min ' + a('newshepard').twrMin.toFixed(2));
  check('every vehicle has more thrust than weight', Object.keys(VEHICLES).every(id => a(id).twrMax > 1.5)); }

// 2. the burn solver finds the last feasible plan: a vehicle too high has no plan, one at the right height has
{ const v = resolveVehicle({ vehicle: 'falcon9' });
  const state = (y, vy) => ({ x: 0, y, vx: 0, vy, th: 0, om: 0, m: v.dry + 4000 });
  const high = solveBurn(v, state(6000, -250)), right = solveBurn(v, state(1400, -210)), late = solveBurn(v, state(300, -210));
  check('solver: from 6 km the stage must not light yet (min throttle would stop it in the air)', !high.feasible);
  check('solver: from ~1.4 km at 210 m/s a feasible plan exists', right.feasible, 'tgo ' + right.tgo.toFixed(1) + ' s');
  check('solver: from 300 m at 210 m/s no plan is feasible (too late)', !late.feasible); }

// 3. nominal landings, no sensor noise, with the fuel-optimal guidance
for (const id of ['falcon9', 'falcon9lz', 'newshepard', 'moonlander']) {
  const { o } = fly({ vehicle: id, guidance: 'optimal' });
  check(`${id}: lands within limits`, o.ok, o.ok ? `${o.vv.toFixed(1)} m/s down, ${o.vh.toFixed(1)} m/s sideways, ${o.miss.toFixed(1)} m off` : o.reason);
}

// 4. propellant accounting
{ const { s, o } = fly({ vehicle: 'falcon9', guidance: 'optimal' });
  check('propellant is conserved: mass = dry + remaining', Math.abs(s.s.m - (s.veh.dry + s.s.prop)) < 1e-6 && o.fuelUsed > 1000 && o.fuelUsed < s.prop0, o.fuelUsed.toFixed(0) + ' kg used'); }

// 5. an engine that does not light cannot land
{ const { o } = fly({ vehicle: 'falcon9', guidance: 'optimal', prop: 0.2 });
  check('with no propellant the stage crashes', !o.ok && o.vv > 50, o.vv?.toFixed(0) + ' m/s'); }

// 6. Monte Carlo with sensor noise, wind, dispersions and thrust error
{ const rate = (id, g, n = 16) => monteCarlo({ vehicle: id, guidance: g, noise: true }, n, 200).rate;
  const f9 = rate('falcon9', 'optimal'), f9z = rate('falcon9', 'zemzev'), ns = rate('newshepard', 'optimal'), moon = rate('moonlander', 'optimal');
  check('Falcon 9 drone ship: optimal guidance succeeds in over half of the dispersed, noisy flights', f9 >= 0.5, (f9 * 100).toFixed(0) + ' %');
  check('Falcon 9: the fuel-optimal solver beats plain ZEM/ZEV (which ignores the throttle floor)', f9 > f9z + 0.2, `${(f9 * 100).toFixed(0)} % vs ${(f9z * 100).toFixed(0)} %`);
  check('New Shepard: success rate above 80 %', ns >= 0.8, (ns * 100).toFixed(0) + ' %');
  check('Lunar lander: success rate above 80 %', moon >= 0.8, (moon * 100).toFixed(0) + ' %'); }

// 6b. a Shipyard booster handed to the Landing Lab becomes a flyable vehicle that lands
{ const st = { name: 'Booster', engine: 'merlin-1d', count: 9, prop: 395700, diameter: 3.7, landing: { mode: 'propulsive', reserve: 55000, site: 'downrange', engines: 3 } };
  VEHICLES.fromShipyard = vehicleFromStage(st);
  const o = fly({ vehicle: 'fromShipyard', guidance: 'optimal' }).o, mc = monteCarlo({ vehicle: 'fromShipyard', guidance: 'optimal', noise: true }, 12, 500);
  check('Shipyard stage -> Landing Lab vehicle: 3 engines, 55 t of landing propellant, sensible mass', VEHICLES.fromShipyard.engines === 3 && VEHICLES.fromShipyard.prop === 55000 && VEHICLES.fromShipyard.dry > 15000 && VEHICLES.fromShipyard.dry < 40000);
  check('Shipyard stage lands in the nominal case', o.ok, o.ok ? o.vv.toFixed(1) + ' m/s' : o.reason);
  check('Shipyard stage lands in about half of dispersed flights', mc.rate >= 0.4, (mc.rate * 100).toFixed(0) + ' %'); }

// 7. learned policy: imitation of the solver must fly the stage down (small training run)
{ const p = await trainPolicy('falcon9lz', { episodes: 14, rounds: 3, epochs: 12, seed: 5 });
  const nom = fly({ vehicle: 'falcon9lz', guidance: 'neural', policy: p.toJSON() }).o;
  const mc = monteCarlo({ vehicle: 'falcon9lz', guidance: 'neural', noise: true, policy: p.toJSON() }, 16, 300);
  check('neural policy: reaches the ground near the pad without a solver', nom.miss < 80 && nom.vv < 25, `${nom.vv.toFixed(1)} m/s, ${nom.miss.toFixed(0)} m off`);
  check('neural policy: lands some dispersed flights', mc.rate >= 0.25, (mc.rate * 100).toFixed(0) + ' %'); }

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
