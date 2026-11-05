// Headless checks for space-access.js.  Run:  node space-access.test.mjs
import * as S from './space-access.js';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const km = x => (x / 1000).toFixed(2);

// 1. ascent budgets match history
const e = S.ascentBudget({ world: 'earth', twr0: 1.3, isp: 330 }), m = S.ascentBudget({ world: 'moon', alt: 100e3, twr0: 2.1, isp: 311, latDeg: 0 }), r = S.ascentBudget({ world: 'mars', alt: 250e3, twr0: 2, isp: 360, latDeg: 0 });
check('Earth ground ascent 9.0-9.6 km/s', e.dv > 9000 && e.dv < 9600, km(e.dv));
check('Moon ascent 1.7-2.0 km/s', m.dv > 1700 && m.dv < 2000, km(m.dv));
check('Mars ascent 3.7-4.3 km/s', r.dv > 3700 && r.dv < 4300, km(r.dv));

// 2. transfers
const mt = S.marsTransfer(), lt = S.moonTransfer();
check('TMI from 300 km LEO ~3.6 km/s', Math.abs(mt.tmi - 3600) < 100, km(mt.tmi));
check('Mars capture ~2.1 km/s', Math.abs(mt.capture - 2100) < 100, km(mt.capture));
check('Hohmann to Mars ~259 days', Math.abs(mt.tofDays - 259) < 3, mt.tofDays.toFixed(0));
check('TLI ~3.13 km/s', Math.abs(lt.tli - 3130) < 60, km(lt.tli));

// 3. rocket equation / staging
const sst = S.launchStack({ dv: 9300, isp: 360, eps: 0.07, stages: 1 });
check('SSTO is razor-thin: payload < 0.5% of gross at eps 0.07', !sst.feasible || sst.payloadFraction < 0.005, sst.payloadFraction && (sst.payloadFraction * 100).toFixed(2) + '%');
check('SSTO impossible once reuse reserve is added (9.65 km/s)', !S.launchStack({ dv: 9650, isp: 360, eps: 0.07, stages: 1 }).feasible);
const two = S.launchStack({ dv: 9300, isp: 320, eps: 0.06, stages: 2 });
check('2-stage kerolox payload fraction 3-5% (Falcon 9 expendable ~4%)', two.payloadFraction > 0.03 && two.payloadFraction < 0.05, (two.payloadFraction * 100).toFixed(1) + '%');
const s2 = S.launchStack({ dv: 9300, isp: 320, eps: 0.06, stages: 2 }).ratio, s3 = S.launchStack({ dv: 9300, isp: 320, eps: 0.06, stages: 3 }).ratio;
check('third stage gains < 20% (diminishing returns)', s3 < s2 && s3 > 0.8 * s2, `${s2.toFixed(1)} -> ${s3.toFixed(1)}`);

// 4. assist: smaller delta-v, better payload, but modest -- orbit speed is sideways
const ground = S.evaluateArchitecture(S.ARCHITECTURES[0]), bal = S.evaluateArchitecture(S.ARCHITECTURES.find(a => a.id === 'balloon-30km'));
const saved = ground.ascent.dv - bal.ascent.dv;
check('30 km balloon saves 0.3-1.0 km/s, not more', saved > 300 && saved < 1000, km(saved));
check('balloon stack lighter per kg of payload', bal.ratio < ground.ratio, `${bal.ratio.toFixed(1)} vs ${ground.ratio.toFixed(1)}`);
check('balloon launch is a small-payload game (1 t needs > 1M m^3)', bal.balloon.volume > 1e6, (bal.balloon.volume / 1e6).toFixed(2) + 'M m^3');

// 5. lift gas
check('hydrogen lifts more than helium', S.liftPerM3(30e3, 'hydrogen') > S.liftPerM3(30e3, 'helium'));
const b60 = S.balloonFor({ load: 1000, alt: 60e3 });
check('60 km float needs a balloon > 300 m radius', b60.feasible && b60.radius > 300, b60.radius?.toFixed(0));

// 6. beyond orbit
check('aerocapture roughly halves the Mars chain', S.chainRatio(S.missionLegs('mars', { aerocapture: true })).imleo < 0.7 * S.chainRatio(S.missionLegs('mars')).imleo);
const isru = S.isruLeverage({});
check('making return propellant on Mars saves hundreds of tonnes in LEO', isru.imleoSavedIfMadeThere > 2e5, (isru.imleoSavedIfMadeThere / 1e3).toFixed(0) + ' t');

// 7. vessels
check('spin: 900 m radius at 1 g is ~1 rpm', Math.abs(S.spin(900, 1).rpm - 1) < 0.05);
check('spin: 100 m radius at 1 g is not comfortable', !S.spin(100, 1).comfortable);
const sep = S.sizeVessel(S.VESSELS.find(v => v.id === 'freight-sep')), chem = S.sizeVessel(S.VESSELS.find(v => v.id === 'freight-chem'));
check('SEP tug launches far less mass than chemical freighter', sep.gross < 0.6 * chem.gross, `${(sep.gross / 1e3).toFixed(0)} t vs ${(chem.gross / 1e3).toFixed(0)} t`);
check('Stanford torus total ~ 10 Mt', S.torusHabitat({}).totalMass > 5e9 && S.torusHabitat({}).totalMass < 2e10);
check('every catalogue vessel is feasible', S.VESSELS.every(v => S.sizeVessel(v).feasible));
console.log(failed ? `${failed} FAILED` : 'all passed'); process.exit(failed ? 1 : 0);
