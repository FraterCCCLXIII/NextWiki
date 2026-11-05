// Headless regression checks for ship-sim.js.  Run:  node ship-sim.test.mjs   (about 30 s)
import { createSim, tuneAscent, planDock, analyze } from './ship-sim.js';

const CAP = { rcsThrust: 4000, rcsProp: 400, rcsIsp: 280, noseOffset: 2.5, cargo: 3000, chuteArea: 1500 };
const booster = (landing = { mode: 'none' }) => ({ name: 'Booster', engine: 'merlin-1d', count: 9, prop: 395700, diameter: 3.7, landing });
const second = { name: 'Second stage', engine: 'merlin-vac', count: 1, prop: 92670, diameter: 3.7 };
const capsuleStage = (over = {}) => ({ name: 'Capsule', engine: 'aj10-oms', count: 1, prop: 1500, diameter: 3.7, length: 7, landing: { mode: 'chute' }, craft: { ...CAP, ...over } });

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const flight = (cfg, tMax = 60000) => { const s = createSim(cfg); s.run(tMax); return s; };

// 1. static analysis
{ const a = analyze({ stages: [booster(), second], payload: { mass: 10000, fairing: 1900 } });
  check('two-stage analysis: liftoff thrust-to-weight above 1.3', a.twr0 > 1.3, a.twr0.toFixed(2));
  check('two-stage analysis: total Δv above 9 km/s', a.dvTotal > 9000, (a.dvTotal / 1e3).toFixed(1) + ' km/s'); }

// 2. expendable launch to orbit
{ const cfg = { world: 'earth', stages: [booster(), second], payload: { mass: 10000, fairing: 1900 }, mission: { orbitAlt: 300e3 } };
  const t = tuneAscent(cfg, { lo: 2, hi: 9 }); cfg.mission.kickDeg = t.kickDeg;
  const s = createSim(cfg); while (!s.done && !s.outcome.orbit && s.t < 2500) s.advance(10);
  const o = s.outcome.orbit;
  check('expendable launch reaches a near-circular 300 km orbit', !!o && o.ok && Math.abs(o.perigee - 300e3) < 40e3 && Math.abs(o.apogee - 300e3) < 40e3, o ? `${(o.perigee / 1e3).toFixed(0)}×${(o.apogee / 1e3).toFixed(0)} km` : 'none'); }

// 3. booster landing, return to launch site and downrange
for (const [site, reserve] of [['rtls', 90000], ['downrange', 55000]]) {
  const cfg = { world: 'earth', stages: [booster({ mode: 'propulsive', reserve, site, engines: 3 }), second], payload: { mass: 10000, fairing: 1900 }, mission: { orbitAlt: 250e3 } };
  cfg.mission.kickDeg = tuneAscent(cfg, { lo: 2, hi: 9 }).kickDeg;
  const s = flight(cfg, 3000), l = s.outcome.landings.find(x => x.name === 'Booster');
  check(`booster lands (${site})`, !!l && l.ok && l.speed < 6.5, l ? `${l.speed.toFixed(1)} m/s, ${(l.downrange / 1e3).toFixed(0)} km` : 'no landing');
  if (site === 'rtls') check('RTLS booster lands within 5 km of the pad', !!l && Math.abs(l.downrange) < 5e3);
  check(`${site}: payload still reaches orbit`, !!s.outcome.orbit?.ok);
}

// 4. rendezvous and docking from orbit
{ let cfg = { world: 'earth', stages: [{ name: 'Spacecraft', engine: 'aj10-oms', count: 1, prop: 2500, diameter: 3, craft: { ...CAP, chuteArea: 0 } }], payload: { mass: 0 }, mission: { start: 'orbit', orbitAlt: 250e3, stationAlt: 420e3 } };
  cfg = planDock(cfg); const s = flight(cfg), d = s.outcome.docked;
  check('spacecraft rendezvouses and docks', !!d && d.ok, d ? `${d.closing.toFixed(2)} m/s, ${d.lateral.toFixed(2)} m` : 'no contact'); }

// 5. landings from orbit
{ const moon = { world: 'moon', stages: [{ name: 'Lander', engine: 'rl10', count: 1, prop: 8000, diameter: 4, length: 6, landing: { mode: 'propulsive', engines: 1 }, craft: { ...CAP, chuteArea: 0 } }], payload: { mass: 0 }, mission: { start: 'orbit', orbitAlt: 100e3, land: true } };
  const l = flight(moon).outcome.landings[0]; check('lunar landing', !!l && l.ok, l ? l.speed.toFixed(1) + ' m/s' : 'none');
  const earth = { world: 'earth', stages: [capsuleStage({ chuteArea: 1900 })], payload: { mass: 0 }, mission: { start: 'orbit', orbitAlt: 300e3, land: true } };
  const c = flight(earth).outcome.landings[0]; check('capsule returns on parachutes', !!c && c.ok && c.speed < 9, c ? c.speed.toFixed(1) + ' m/s' : 'none'); }

// 6. the whole mission in one flight
{ let cfg = { world: 'earth', stages: [booster({ mode: 'propulsive', reserve: 55000, site: 'downrange', engines: 3 }), second, capsuleStage()], payload: { mass: 0 }, mission: { orbitAlt: 250e3, dock: true, land: true, stationAlt: 420e3 } };
  cfg.mission.kickDeg = tuneAscent(cfg, { lo: 1, hi: 12 }).kickDeg; cfg = planDock(cfg);
  const s = flight(cfg), L = s.outcome.landings;
  check('full mission: orbit, booster landing, dock, return, capsule landing', !!s.outcome.orbit?.ok && !!s.outcome.docked?.ok && L.length === 2 && L.every(x => x.ok), L.map(x => `${x.name} ${x.speed.toFixed(1)} m/s`).join(', ')); }

// 7. release from a balloon at 30 km carries a payload the pad launch cannot
{ const mk = release => ({ world: 'earth', stages: [{ name: 'S1', engine: 'merlin-1d', count: 1, prop: 40000, diameter: 2 }, { name: 'S2', engine: 'merlin-vac', count: 1, prop: 8000, diameter: 2 }], payload: { mass: 2400, fairing: 60 }, mission: { orbitAlt: 250e3, release, kickSpeed: release ? 15 : 45 } });
  const run = release => { const c = mk(release); c.mission.kickDeg = tuneAscent(c, { lo: 1, hi: 14 }).kickDeg; return flight(c, 3000).outcome.orbit?.ok; };
  check('2.4 t: pad launch fails, 30 km balloon release reaches orbit', !run(null) && !!run({ alt: 30e3, speed: 0 })); }

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
