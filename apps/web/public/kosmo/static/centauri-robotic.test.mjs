// centauri-robotic.test.mjs -- node checks for v5, the robotic / minimal-crew Centauri ships: the trade
// study, the human and robot laws, the swarm, the five builds and their pins, and the invariants a
// robot-run ship has to hold (mass closure, consumables from crew-days, spare ratio, reach over the
// hull, nothing overlapping, the crossing closing).
// Run by run-tests.mjs, or: node public/kosmo/static/centauri-robotic.test.mjs

import assert from 'node:assert/strict';
import { PARTS, centrifugePart } from './parts/parts.js';
import { solveAssembly, summarize } from './parts/assembly.js';
import { ringFor, omega } from './parts/centrifuge.js';
import { FLEET_VERSIONS } from './parts/fleet-versions.js';
import { measure } from './parts/fleet.js';
import { R_CAP, DRIVES } from './parts/propulsion.js';
import {
  V5_IDS, DESIGNS, designById, measureRobotic, roboticAssembly, baselineBudget,
  RUBRIC, TRADE_OPTIONS, REQUIREMENT, scoreOptions, recommend,
  PER_PERSON_DAY_KG, CLOSURE, CONSUMABLES_MARGIN, netPerPersonDayKg, TORPOR, awakeFraction, ECLSS, SHIELD,
  ROBOTS, RELIABILITY, robotFleetFor, sparesFor, swarmFor, COMPUTE_NODE, CONSENSUS, NETWORK, DATA,
  COCKPIT, OBS_DECK, WAKE_TIERS, AUTONOMY_MODES, HANGAR, RAILS, humansFor, torporRingFor, BOOST_CAP_YEARS, enginesFor, clusteredDrive
} from './parts/robotic.js';
import { FLEET_VERSIONS_V5, V5_PINNED_IDS } from './parts/fleet-versions-v5.js';
import { pinned } from './parts/fleet-recuts.js';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks += 1; };
const near = (a, b, tol, message) => {
  assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-12, `${message}: got ${a}, expected ${b} (${(tol * 100).toFixed(2)} %)`);
  checks += 1;
};

/* ---------- the trade study ---------- */
near(RUBRIC.reduce((s, r) => s + r.weight, 0), 1, 1e-12, 'the rubric weights add to one');
ok(TRADE_OPTIONS.length === 6 && TRADE_OPTIONS.every((o) => RUBRIC.every((r) => Number.isInteger(o.scores[r.id]) && o.scores[r.id] >= 1 && o.scores[r.id] <= 5)), 'six options, each scored 1-5 on every criterion');
ok(TRADE_OPTIONS.every((o) => o.why.length > 80), 'every option says why it was kept or rejected');
const ranked = scoreOptions();
const rec = recommend();
ok(ranked[0].id === 'B', 'the uncrewed ship scores highest on the rubric, and the study says so instead of hiding it');
ok(rec.pick.id === 'C', 'the recommended route is the AI-swarm ship with a dormant cadre: the best option that meets the requirement that adults arrive');
ok(rec.beatenBy.length === 1 && rec.beatenBy[0].id === 'B', 'exactly one option beats it, and that one fails the requirement');
ok(REQUIREMENT.meets.B === false && REQUIREMENT.meets.C === true, 'the requirement gate is explicit');
ok(ranked.find((o) => o.id === 'C').total > ranked.find((o) => o.id === 'E').total, 'the swarm in command beats the humans in command: a plan that needs a signature cannot act in the 20 h it takes to rewarm one');
ok(ranked.find((o) => o.id === 'A').total < 3 && ranked.find((o) => o.id === 'F').total < 3, 'everyone-awake and the generation ship are rejected on mass and dose');
ok(DESIGNS.some((d) => d.humans === 0), 'the uncrewed extreme is built as a variant, not just scored');

/* ---------- the human laws ---------- */
near(netPerPersonDayKg(), 1.83 + 0.84 * 0.25 + 4.3 * 0.07, 1e-9, 'net consumables are 2.34 kg per awake person-day after 93 % water and 75 % oxygen closure');
ok(PER_PERSON_DAY_KG.oxygen === 0.84 && PER_PERSON_DAY_KG.food === 1.83, 'the BVAD per-person figures are the ones used');
near(awakeFraction(), 3 / 17, 1e-12, 'three days awake in seventeen: 17.6 % of the cadre is up at any moment');
ok(TORPOR.metabolicFraction >= 0.3 && TORPOR.metabolicFraction <= 0.5, 'torpor metabolic reduction is inside SpaceWorks’ 50-70 %');
ok(TORPOR.rewarmHours >= 10 && TORPOR.rewarmHours <= 20, 'rewarming is a clinical 0.25-0.5 C/h, 10-20 h');
ok(ECLSS.kgPerPerson === 800 && ECLSS.strings === 1.5, 'life support is sized at 800 kg per person with a redundant half string');
ok(SHIELD.arealKgM2 === 500 && SHIELD.gcrReduction === 0.5, 'the shelter is 50 g/cm2 and credited with halving the GCR rate, no more');
{
  const h6 = humansFor(designById('habitat-v5'), 46);
  near(h6.awakeAvg, 6 * 3 / 17, 1e-12, 'six sleepers: 1.06 awake on average');
  near(h6.consumablesKg, (h6.awakeAvg * netPerPersonDayKg() + h6.dormantAvg * netPerPersonDayKg() * TORPOR.metabolicFraction) * 46 * 365.25 * CONSUMABLES_MARGIN + 6 * TORPOR.medPerPodKg, 1e-9, 'consumables are crew x days x per-person, torpor-weighted, with margin and the pods’ medical stock');
  ok(h6.cockpits === Math.max(COCKPIT.minimum, Math.ceil(h6.awakeAvg * COCKPIT.perAwake) + COCKPIT.spare), 'one telepresence cockpit per two awake people plus a spare, never fewer than two');
  ok(h6.doseSv > SHIELD.careerLimitSv * 5, `the 46-year dose (${h6.doseSv.toFixed(1)} Sv) is an order of magnitude past the career limit even behind the shelter: sleeping does not shield`);
  const h0 = humansFor(designById('seed-v5-auto'), 46);
  ok(h0.consumablesKg === 0 && h0.doseSv === 0 && h0.cockpits === 0, 'no humans, no consumables, no cockpits, no dose');
}

/* ---------- the robot catalogue and laws ---------- */
ok(Object.values(ROBOTS).every((r) => r.massKg > 0 && r.dims.l > 0 && r.source.length > 40 && ['iva', 'eva'].includes(r.domain)), 'every robot has a mass, an envelope, a domain and a source');
ok(ROBOTS['humanoid-iva'].dims.l < 1.8 && ROBOTS['humanoid-eva'].dims.l < 1.95, 'the humanoids are person-sized: they stand beside the 1.8 m figure, not over it');
ok(ROBOTS['arm-dextre'].massKg === 1560 && ROBOTS['arm-era'].reachM === 11.3 && ROBOTS['free-flyer-iva'].massKg === 10, 'Dextre, ERA and Astrobee keep their real figures');
ok(ROBOTS['crawler-rail'].reachM === 2.5 && RAILS.count === 4, 'four rails, 2.5 m of reach each side of each');
ok(RELIABILITY.mtbfH === 40000 && RELIABILITY.printableShare === 0.7, 'the reliability law is stated: 40,000 h MTBF, 70 % of failures printable');
{
  const fleet = robotFleetFor(designById('habitat-v5'), { hullAreaM2: 7700, modules: 6, stackM: 172, volumeM3: 1200, humans: 6 });
  ok(fleet.total > 30 && fleet.counts['humanoid-iva'] >= 2 && fleet.counts['crawler-rail'] % RAILS.count === 0, 'the fleet law gives a few dozen robots for the habitat, with crawlers in rail sets');
  const sp = sparesFor(fleet, 46);
  near(sp.failures, fleet.mobile * 46 * 8766 / RELIABILITY.mtbfH, 1e-9, 'failures are robots x hours / MTBF');
  near(sp.feedstockKg, sp.printedKg * RELIABILITY.feedstockPerPrintedKg, 1e-9, 'feedstock is the printed mass with 30 % waste');
  ok(sp.spareRatio > 0.3 && sp.spareRatio < 0.6, `the stocked spares are ${(sp.spareRatio * 100).toFixed(0)} % of the mobile fleet’s mass over the crossing`);
  const sw = swarmFor(fleet, { hullAreaM2: 7700, modules: 6, stackM: 172 }, 46);
  ok(sw.nodes >= CONSENSUS.minNodes && sw.faultsTolerated >= CONSENSUS.faultsTolerated, 'the swarm has at least seven nodes and survives two liars');
  ok(sw.quorum === Math.floor((2 * sw.nodes) / 3) + 1, 'quorum is two thirds plus one');
  ok(sw.logicalTB > 1000 && sw.logicalTB < 1e5, `the recorded data is petabytes, not exabytes (${(sw.logicalTB / 1000).toFixed(1)} PB logical)`);
  near(sw.storedTB, sw.logicalTB * DATA.replicas, 1e-9, 'everything is kept three times');
  ok(NETWORK.inShipLatencyMs < NETWORK.hapticLimitMs, 'in-ship latency is inside the force-feedback budget');
  near(NETWORK.earthRoundTripYears, 8.74, 1e-9, 'Earth is 8.74 years away round trip: nothing is piloted from home');
}

/* ---------- wake-up logic and control stack ---------- */
ok(WAKE_TIERS.length === 5 && WAKE_TIERS.every((t, i) => t.tier === i), 'five tiers, 0 to 4');
ok(WAKE_TIERS.every((t, i) => i === 0 || t.leadH >= WAKE_TIERS[i - 1].leadH), 'lead time never falls as the tier rises');
ok(WAKE_TIERS.filter((t) => t.tier >= 2).every((t) => t.leadH >= TORPOR.rewarmHours + 8), 'any tier that wakes a sleeper allows rewarming plus eight hours of orientation');
ok(WAKE_TIERS.every((t) => t.report.length > 20 && t.examples.length > 20), 'every tier says what triggers it and what the swarm must report');
ok(AUTONOMY_MODES.length === 4 && AUTONOMY_MODES.every((m) => m.interlock.length > 40), 'four shared-autonomy modes, each with a stated interlock');
ok(AUTONOMY_MODES.some((m) => m.mode === 'handover'), 'handover is a mode with its own rule, not an afterthought');

/* ---------- the five builds ---------- */
ok(V5_IDS.length === 5 && V5_PINNED_IDS.length === 5 && V5_IDS.every((id) => V5_PINNED_IDS.includes(id)), 'five v5 designs, all pinned');
const M = Object.fromEntries(V5_IDS.map((id) => [id, measureRobotic(id)]));
const PIN = FLEET_VERSIONS_V5.designs;
for (const id of V5_IDS) {
  const m = M[id], d = designById(id), p = pinned(PIN[id], id);
  const n = m.def.parts.length;
  ok(m.structural.length === 0, `${id}: the assembly solves with no structural fault (${m.structural[0]?.message ?? 'ok'})`);
  ok(m.summary.partCount === n && m.solved.mates.length === n - 1, `${id}: every one of ${n} parts is placed and the mate graph is a tree`);
  near(m.summary.mass, m.def.parts.reduce((s, q) => s + (typeof q.part === 'string' ? PARTS[q.part].mass : q.part.mass), 0), 1e-9, `${id}: the mass is the sum of the parts (closure)`);
  ok(m.loads.length === 0, `${id}: no interface carries more than its rating`);
  ok(!m.solved.nodes.some((x) => ['sail', 'mast', 'solar-array'].includes(x.part.kind)), `${id}: no sail, no mast and no solar wing -- there is no sunlight between stars`);
  ok(m.solved.nodes.some((x) => x.part.kind === 'drive') && m.solved.nodes.some((x) => x.part.kind === 'robot-hangar') && m.solved.nodes.some((x) => x.part.kind === 'fab-bay') && m.solved.nodes.some((x) => x.part.kind === 'rail-network'), `${id}: a drive, a hangar, a fab bay and the rails are on the hull`);
  ok(m.solved.nodes.filter((x) => x.part.kind === 'compute-rack').length >= 3, `${id}: the compute is in at least three racks, not one core`);
  ok(m.geometry.offAxisM < 0.05, `${id}: the CG is on the thrust line (${(m.geometry.offAxisM * 1000).toFixed(1)} mm)`);
  ok(m.genW >= m.loadW, `${id}: the reactor covers the hotel load (${(m.genW / 1e3).toFixed(0)} kWe for ${(m.loadW / 1e3).toFixed(0)} kW)`);
  if (d.base !== 'colony') { const rb = m.solved.nodes.find((x) => x.name === 'reactorBoom'); ok(rb && rb.part.dims.l >= 10 && m.solved.nodes.find((x) => x.part.kind === 'reactor-fsp').parent === 'reactorBoom', `${id}: the fission unit stands on a ${rb?.part.dims.l.toFixed(0)} m boom, not on the pressure shell`); }

  /* pins */
  ok(p.base === d.base && p.drive === d.drive && p.humans === d.humans, `v5 ${id}: the pin records the base, the drive and the cadre`);
  near(m.massKg, p.massKg, 1e-9, `v5 ${id}: mass is pinned`);
  near(m.hullKg, p.hullKg, 1e-9, `v5 ${id}: hull mass is pinned`);
  near(m.propulsion.wetKg, p.wetKg, 1e-9, `v5 ${id}: wet mass is pinned`);
  near(m.propulsion.beta, p.beta, 1e-9, `v5 ${id}: cruise speed is pinned`);
  near(m.propulsion.tripYears, p.tripYears, 1e-9, `v5 ${id}: crossing time is pinned`);
  ok(m.robots.count === p.robots, `v5 ${id}: the robot count is pinned (${p.robots})`);
  if (p.ring) near(m.ring.totalKg, p.ring.totalKg, 1e-9, `v5 ${id}: the ring mass is pinned`);

  /* the crossing */
  ok(m.propulsion.closes && m.propulsion.tripYears <= 100, `${id}: crosses 4.37 ly in ${m.propulsion.tripYears.toFixed(1)} years`);
  near(m.propulsion.dryKg + m.propulsion.propKg, m.propulsion.wetKg, 1e-12, `${id}: dry plus propellant is wet`);
  near(m.massKg, m.propulsion.wetKg, 1e-9, `${id}: the assembly mass is the rocket equation’s wet mass`);
  ok(m.propulsion.massRatio <= R_CAP + 1e-9, `${id}: inside the 20:1 mass-ratio cap`);
  ok(m.propulsion.boostS / 3.156e7 <= BOOST_CAP_YEARS * 1.05, `${id}: the boost is held under ${BOOST_CAP_YEARS} years by clustering engines (${m.propulsion.drive.engines ?? 1})`);
  near(m.propulsion.drive.thrustN, DRIVES[d.drive].thrustN * (m.propulsion.drive.engines ?? 1), 1e-9, `${id}: thrust scales with the engine count`);

  /* consumables vs crew x duration */
  const h = m.humans;
  if (d.humans > 0) {
    const stores = m.solved.nodes.find((x) => x.part.kind === 'stores');
    ok(!!stores, `${id}: the consumables are a placed tank`);
    near(stores.part.mass, h.consumablesKg, 1e-9, `${id}: the tank holds crew x days x per-person consumables`);
    near(h.consumablesKg, (h.awakeAvg * netPerPersonDayKg() + h.dormantAvg * netPerPersonDayKg() * TORPOR.metabolicFraction) * m.propulsion.tripYears * 365.25 * CONSUMABLES_MARGIN + d.humans * TORPOR.medPerPodKg, 1e-9, `${id}: and that is the law, for ${m.propulsion.tripYears.toFixed(1)} years`);
    ok(stores.part.ports.every((q) => q.type === 'hardpoint'), `${id}: the tank is in the thrust path on hardpoints, not a 21 m can on a berthing ring`);
  }

  /* the ring */
  if (d.ring) {
    const r = m.ring;
    near(omega(r.rpm) ** 2 * r.R, 9.80665, 1e-9, `${id}: the deck sits at 1 g`);
    ok(r.rpm <= 6 && (r.rpm <= 4 || TORPOR.cycleAwakeDays <= 3), `${id}: ${r.rpm} rpm -- the short-stay limit is allowed because the awake stint is ${TORPOR.cycleAwakeDays} days`);
    ok(r.area >= h.deckM2, `${id}: ${Math.round(r.area)} m2 of deck for the ${Math.round(h.deckM2)} m2 the sleepers, the watch and the cockpits need`);
    near(r.shieldKg, r.shelterShellM2 * SHIELD.arealKgM2, 1e-9, `${id}: the shelter shield is 500 kg/m2 over the torpor bay’s shell`);
    const ringNode = m.solved.nodes.find((x) => x.part.kind === 'torpor-ring');
    ok(ringNode.part.pods === d.humans && ringNode.part.cockpits === h.cockpits, `${id}: the ring part carries ${d.humans} pods and ${h.cockpits} cockpits`);
    /* the stack passes through the ring: nothing axial reaches the ring's inner wall */
    const yRing = ringNode.world.position[1];
    const inner = r.R - r.D / 2;
    const through = m.solved.nodes.filter((x) => x.name !== 'ring' && x.part.kind !== 'rail-network' && x.part.kind !== 'radiator' && x.part.kind !== 'reactor').filter((x) => { const b = summarize([x]).bounds; return yRing > b.min[1] && yRing < b.max[1]; });
    ok(through.every((x) => Math.hypot(x.world.position[0], x.world.position[2]) + x.part.dims.d / 2 < inner), `${id}: everything in the ring’s plane is inside its ${inner.toFixed(1)} m inner radius (${through.map((x) => x.name).join(', ')})`);
    const hubKind = d.base === 'colony' ? 'despin-hub' : 'spin-bearing';
    ok(m.solved.nodes.some((x) => x.part.kind === hubKind), `${id}: the ring turns on a ${hubKind}`);
  } else {
    ok(!m.solved.nodes.some((x) => x.part.kind === 'torpor-ring'), `${id}: no ring for a ship with nobody to spin`);
  }

  /* the robots and their hangar */
  const robots = m.solved.nodes.filter((x) => x.part.kind === 'robot');
  const nonScout = Object.entries(m.fleet.counts).filter(([k]) => k !== 'scout').reduce((s, [, v]) => s + v, 0);
  ok(robots.length === nonScout, `${id}: every robot in the inventory except the racked scouts is a placed part (${robots.length})`);
  const scouts = m.solved.nodes.find((x) => x.part.kind === 'scout-rack');
  ok(scouts && scouts.part.scouts === d.scouts, `${id}: ${d.scouts} scouts in their rack`);
  const hangar = m.solved.nodes.find((x) => x.part.kind === 'robot-hangar');
  const hp = hangar.part;
  const inHangar = robots.filter((x) => x.parent === 'hangar' && /^(cradle|dock)-/.test(x.viaPort));
  ok(inHangar.length === hp.hangar.humanoids + hp.hangar.flyers, `${id}: ${inHangar.length} robots are in cradles and docks`);
  for (const x of inHangar) {
    /* the robots stand radially in their cradles (QA pass), so the test is on the solved envelope: every
       corner of the robot's box is inside the hangar's length and under its radius (a cradle's wall face
       may touch the shell) */
    const b = summarize([x]).bounds, hy = hangar.world.position[1];
    const q = x.world.quaternion, rot = (v) => { const [qx, qy, qz, qw] = q; const t = [2 * (qy * v[2] - qz * v[1]), 2 * (qz * v[0] - qx * v[2]), 2 * (qx * v[1] - qy * v[0])]; return [v[0] + qw * t[0] + qy * t[2] - qz * t[1], v[1] + qw * t[1] + qz * t[0] - qx * t[2], v[2] + qw * t[2] + qx * t[1] - qy * t[0]]; };
    const rr = x.part.dims.d / 2, corners = [];
    for (const cx of [-rr, rr]) for (const cy of [0, x.part.dims.l]) for (const cz of [-rr, rr]) { const w = rot([cx, cy, cz]); corners.push([w[0] + x.world.position[0], w[2] + x.world.position[2]]); }
    ok(b.min[1] >= hy - 1e-6 && b.max[1] <= hy + hp.dims.l + 1e-6 && corners.every(([cx, cz]) => Math.hypot(cx, cz) <= hp.dims.d / 2 + 0.12), `${id}: ${x.name} is inside the hangar envelope`);
  }
  /* and no two of them share volume: the cradle pitch is at least a robot's width */
  for (let i = 0; i < inHangar.length; i += 1) for (let j = i + 1; j < inHangar.length; j += 1) {
    const a = summarize([inHangar[i]]).bounds, c = summarize([inHangar[j]]).bounds;
    const sep = [0, 1, 2].some((k) => a.max[k] <= c.min[k] + 1e-6 || c.max[k] <= a.min[k] + 1e-6);
    ok(sep, `${id}: ${inHangar[i].name} and ${inHangar[j].name} do not share volume`);
  }
  const envelope = inHangar.reduce((s, x) => s + x.part.dims.l * x.part.dims.d ** 2, 0);
  ok(envelope < hp.volume.pressurised * 0.5, `${id}: the garaged robots take under half the hangar’s ${hp.volume.pressurised.toFixed(0)} m3`);
  ok(hp.hangar.lock.w >= hp.hangar.door.w && hp.hangar.lock.h >= hp.hangar.door.h && hp.hangar.door.l === undefined, `${id}: the lock hatch (${hp.hangar.lock.w} x ${hp.hangar.lock.h} m) passes the robot door (${hp.hangar.door.w} x ${hp.hangar.door.h} m)`);
  ok(ROBOTS['humanoid-eva'].dims.d <= hp.hangar.door.w && ROBOTS['crawler-rail'].dims.l <= hp.hangar.lock.h, `${id}: an EVA humanoid and a crawler fit through the lock`);
  ok(hp.hangar.maint === Math.max(1, Math.ceil(m.fleet.mobile / HANGAR.robotsPerMaintenanceStation)) || Math.abs(hp.hangar.maint - Math.ceil(m.fleet.mobile / HANGAR.robotsPerMaintenanceStation)) <= 1, `${id}: ${hp.hangar.maint} maintenance stations for ${m.fleet.mobile} mobile robots`);
  ok(m.solved.nodes.some((x) => x.part.kind === 'robot-lock' && x.parent === 'hangar'), `${id}: the robot lock is on the hangar`);
  /* crawlers ride outside the hull, on the rails */
  const rails = m.solved.nodes.find((x) => x.part.kind === 'rail-network');
  const crawlers = robots.filter((x) => x.parent === 'rails');
  ok(crawlers.length === (m.fleet.counts['crawler-rail'] ?? 0) + (m.fleet.counts['arm-era'] ?? 0), `${id}: every crawler and long arm is on the rails`);
  {
    const axialKinds = ['node', 'pressurised-module', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault', 'thrust-collar', 'stores', 'arrival-kit'];
    const hullAt = (y) => m.solved.nodes.filter((q) => axialKinds.includes(q.part.kind)).filter((q) => y >= q.world.position[1] - 1e-6 && y <= q.world.position[1] + q.part.dims.l + 1e-6);
    ok(crawlers.every((x) => {
      const r = Math.hypot(x.world.position[0] - rails.world.position[0], x.world.position[2] - rails.world.position[2]);
      const under = hullAt(x.world.position[1]);
      return under.length === 0 ? r >= RAILS.standoffM : under.every((q) => r >= q.part.dims.d / 2 + RAILS.standoffM - 1e-6);
    }), `${id}: every crawler sits outside the hull it rides past, at the rail standoff`);
  }
  {
    const ax = m.solved.nodes.filter((x) => ['node', 'pressurised-module', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault', 'thrust-collar', 'stores', 'arrival-kit', 'drive'].includes(x.part.kind));
    const extent = Math.max(...ax.map((x) => x.world.position[1] + x.part.dims.l)) - Math.min(...ax.map((x) => x.world.position[1]));
    near(rails.part.dims.l, extent, 0.02, `${id}: the rails run the length of the stack and the drive (${rails.part.dims.l.toFixed(0)} m)`);
    ok(rails.world.position[1] <= Math.min(...ax.map((x) => x.world.position[1])) + 1e-6, `${id}: the rails start at the aft end of the stack`);
  }

  /* reach covers the hull */
  ok(m.coverage.ratio >= 1, `${id}: rails and EVA robots cover the hull ${m.coverage.ratio.toFixed(2)}x over (${m.coverage.hullM2.toFixed(0)} m2)`);

  /* spares */
  ok(m.spares.spareRatio >= 0.3 && m.spares.spareRatio <= 0.6, `${id}: spare ratio ${(m.spares.spareRatio * 100).toFixed(0)} %`);
  const fab = m.solved.nodes.find((x) => x.part.kind === 'fab-bay');
  ok(fab.part.mass > m.spares.feedstockKg + m.spares.stockedKg + m.spares.standbyKg, `${id}: the fab bay carries the feedstock and the spares in its mass`);
  ok(m.solved.nodes.filter((x) => x.part.kind === 'robot' && x.part.robot === 'fab-cell').length === fab.part.fab.cells, `${id}: ${fab.part.fab.cells} fab cells are placed inside it`);

  /* the swarm */
  const racks = m.solved.nodes.filter((x) => x.part.kind === 'compute-rack');
  const nodesPlaced = racks.reduce((s, x) => s + x.part.nodes, 0);
  ok(nodesPlaced === m.swarm.nodes, `${id}: all ${m.swarm.nodes} compute nodes are in racks`);
  ok(new Set(racks.map((x) => x.parent)).size >= 2 && racks.every((x) => x.part.nodes <= m.swarm.nodes * 0.5), `${id}: the racks are on at least two modules and none holds half the nodes`);
  ok(m.swarm.nodes - Math.max(...racks.map((x) => x.part.nodes)) >= 2 * m.swarm.faultsTolerated + 1 || m.swarm.nodes - Math.max(...racks.map((x) => x.part.nodes)) >= CONSENSUS.minNodes - 2, `${id}: losing the biggest rack leaves a working swarm`);
  near(racks.reduce((s, x) => s + x.part.mass, 0), m.swarm.nodes * COMPUTE_NODE.massKg + racks.length * 30, 1e-9, `${id}: rack mass is nodes x ${COMPUTE_NODE.massKg} kg plus the frames`);

  /* observation deck and telepresence */
  if (d.humans > 0) {
    const obs = m.solved.nodes.find((x) => x.part.kind === 'obs-deck');
    ok(!!obs && obs.part.obs.pods === Math.max(OBS_DECK.minimumPods, Math.ceil(h.awakeAvg * OBS_DECK.podShare) + OBS_DECK.visitorPods), `${id}: the observation deck has a pod per four awake people plus ${OBS_DECK.visitorPods} for visitors`);
    ok(obs.part.obs.archiveTB > 0 && obs.part.mass > obs.part.obs.archiveKg, `${id}: the deck carries the ${(obs.part.obs.archiveTB / 1000).toFixed(1)} PB vault in its mass`);
    const bearingKind = d.base === 'colony' ? 'despin-hub' : 'spin-bearing';
    const bearing = m.solved.nodes.find((x) => x.part.kind === bearingKind);
    ok(Math.abs(obs.world.position[1] - bearing.world.position[1]) < 60, `${id}: the deck is within a spoke’s walk of the ring (${Math.abs(obs.world.position[1] - bearing.world.position[1]).toFixed(0)} m)`);
    ok(h.cockpits >= 2, `${id}: ${h.cockpits} telepresence cockpits, in the shielded ring with the sleepers`);
  } else {
    ok(!m.solved.nodes.some((x) => x.part.kind === 'obs-deck'), `${id}: no deck for nobody`);
  }

  /* the axial chain does not overlap: each module starts where the one below ends */
  const axial = m.solved.nodes.filter((x) => ['node', 'pressurised-module', 'robot-hangar', 'fab-bay', 'obs-deck', 'seed-vault', 'thrust-collar', 'stores', 'arrival-kit', 'drive'].includes(x.part.kind)).sort((a, b) => a.world.position[1] - b.world.position[1]);
  for (let i = 1; i < axial.length; i += 1) {
    const prev = axial[i - 1], cur = axial[i];
    ok(cur.world.position[1] >= prev.world.position[1] + prev.part.dims.l - 1e-6, `${id}: ${cur.name} starts where ${prev.name} ends (no overlap)`);
  }
  /* side-mounted parts do not reach into the axial parts they hang on */
  for (const x of m.solved.nodes.filter((q) => ['compute-rack', 'scout-rack', 'reactor-fsp', 'robot-lock'].includes(q.part.kind) && q.parent !== 'reactorBoom')) {
    const host = m.solved.nodes.find((q) => q.name === x.parent);
    ok(Math.hypot(x.world.position[0] - host.world.position[0], x.world.position[2] - host.world.position[2]) >= host.part.dims.d / 2 - 1e-6, `${id}: ${x.name} sits on the outside of ${host.name}`);
  }
}

/* ---------- before and after ---------- */
// v5 is compared with an honest baseline: the v2 ship plus the consumables and life support its own
// crew would need under the same laws, not with a v2 that forgot to eat.
for (const [v5, v2] of [['habitat-v5', 'habitat-spin'], ['seed-v5', 'seed-spin'], ['colony-v5-cadre', 'colony-spin']]) {
  const m = M[v5], b = measure(v2), bb = baselineBudget(v2, m.propulsion.tripYears);
  ok(m.hullKg < b.massKg + bb.totalKg, `${v5}: the v5 hull (${(m.hullKg / 1e3).toFixed(0)} t) is lighter than ${v2} with its crew fed (${((b.massKg + bb.totalKg) / 1e3).toFixed(0)} t)`);
  ok(m.ring.totalKg < FLEET_VERSIONS.v2.variants[v2].ring.massKg, `${v5}: the torpor ring (${(m.ring.totalKg / 1e3).toFixed(0)} t with its outfit and shield) is lighter than the v2 ring (${(FLEET_VERSIONS.v2.variants[v2].ring.massKg / 1e3).toFixed(0)} t)`);
  ok(m.humans.humans < FLEET_VERSIONS.v2.variants[v2].crew, `${v5}: fewer people (${m.humans.humans} against ${FLEET_VERSIONS.v2.variants[v2].crew})`);
}
ok(M['colony-v5'].hullKg > 10 * M['colony-v5-cadre'].hullKg / 3, 'scaling torpor to a thousand sleepers still costs tens of kilotonnes of food: the consumables wall the note describes');
ok(M['colony-v5'].humans.consumablesKg > M['colony-v5'].ring.totalKg * 3, 'on the thousand-sleeper colony the consumables outweigh the ring several times over');
ok(M['seed-v5-auto'].hullKg < M['seed-v5'].hullKg && M['seed-v5-auto'].massKg < M['seed-v5'].massKg, 'the uncrewed seed is the lightest seed, as option B says');
ok(M['habitat-v5'].propulsion.closes && !measure('habitat-dfd').propulsion.closes, 'the habitat closes in v5 because it takes the Daedalus drive the trade picked, where the v3 direct-fusion habitat did not');

/* ---------- v5 does not touch v1-v4 ---------- */
ok(PARTS['thrust-collar'].ports.find((q) => q.id === 'fore').type === 'hinge-1d', 'the catalogue collar keeps its hinge: v5 retypes a copy');
ok(centrifugePart(ringFor({ crew: 24, rpm: 4 })).ports[0].gender === 'active', 'the catalogue ring keeps its active hub: v5 flips a copy for the colony');
near(measure('habitat-spin').massKg, pinned(FLEET_VERSIONS.v2.variants['habitat-spin'], 'habitat-spin').massKg, 1e-9, 'v2 habitat-spin still measures to its pin (with its documented re-cut) after v5 is loaded');
near(measure('seed-daedalus').massKg, FLEET_VERSIONS.v3.driven['seed-daedalus'].massKg, 1e-9, 'v3 seed-daedalus still measures to its pin after v5 is loaded');
ok(Object.keys(FLEET_VERSIONS).join(',').indexOf('v5') === -1, 'the v5 pins live in their own file');
{
  const a = roboticAssembly('habitat-v5'), b = roboticAssembly('habitat-v5');
  near(summarize(solveAssembly(a.def).nodes).mass, summarize(solveAssembly(b.def).nodes).mass, 1e-12, 'building a v5 ship twice gives the same ship');
  ok(enginesFor(1e3, DRIVES.daedalus) === 1 && enginesFor(4e7, DRIVES.pulse) > 1, 'engines are added only when one cannot boost the ship in ten years');
  ok(clusteredDrive(DRIVES.pulse, 1) === DRIVES.pulse, 'one engine is the catalogue drive itself');
}

console.log(`centauri robotic: ${checks} checks pass`);
