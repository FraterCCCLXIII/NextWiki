// centauri-sail.test.mjs -- node checks for the sail mechanism (parts/sail-mechanics.js).
//
// For every sail class in v1, v2 and v4, over k from 0 to 1 and back: the film's area is conserved,
// its pleats share their fold lines, no two panels cross, the stowed pack is inside the drum, the
// extension is monotone and within spec, the deployment time follows the rates, the lines are never
// stretched and are taut when deployed, retraction returns to the stowed geometry, the trim authority
// covers the centre-of-pressure offset, and the spin deployment balances angular momentum.
//
// The geometric checks run on the drawn-scale configuration (the real drum, the film scaled to the
// viewer's drawn side, a fold gap that fills the drum), because a true-size film wraps its drum
// thousands of times and the geometry model would need millions of slices to say nothing new; the
// numbers (pack volume, spin, time, authority) are the true sail's.
//
// Run by run-tests.mjs, or: node public/kosmo/static/centauri-sail.test.mjs

import assert from 'node:assert/strict';
import { measure, CLASSES, VARIANTS, REALISM } from './parts/fleet.js';
import {
  FILM, BOOMS, ALLOWABLE_PA, rimRadius, boomClosure, architectureFor, sailMechanism, mechanismsFor, drawnSideFor, hullSpanOf,
  selfIntersections, foldClosure, insideDrum, readout, trianglesIntersect
} from './parts/sail-mechanics.js';
import { filmTemperatureK } from './parts/primitives/spec.js';
import { shapesOf, sdf } from './parts/geometry-audit.js';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks += 1; };
const near = (a, b, tol, message) => { assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-12, `${message}: got ${a}, expected ${b} (${(tol * 100).toFixed(2)} %)`); checks += 1; };
const KS = [0, 0.05, 0.1, 0.2, 0.25, 0.35, 0.5, 0.62, 0.66, 0.7, 0.8, 0.85, 0.92, 0.96, 1];

/* ---------- the laws ---------- */
{
  near(rimRadius(Math.PI, 1e6), 1, 1e-4, 'a million-gon of unit circumradius carries pi of area');
  near(rimRadius(2, 4), 1, 1e-12, 'a square of area 2 has unit circumradius');
  const bc = boomClosure(1.386e5, 47);
  ok(bc.boomLengthM > 250 && bc.ratio > 10, `four booms for the smallsat film weigh ${bc.ratio.toFixed(0)}x the film: booms do not close at 0.34 g/m2`);
  ok(!bc.closes, 'and the closure flag says so');
  ok(boomClosure(32, 0.011).ratio > 1 && boomClosure(32, 0.011).family === 'TRAC', 'a LightSail-size film gets TRAC booms (and even there the booms outweigh a 100 nm film)');
  ok(architectureFor('wafer').id === 'starchip-disc', 'the wafer is a released disc');
  ok(architectureFor('smallsat').id === 'spin-square' && architectureFor('instrument').id === 'spin-square', 'the flyby classes spin-deploy one-shot');
  for (const b of ['lander', 'capsule', 'habitat', 'seed', 'colony']) ok(architectureFor(b).id === 'reeled-gore', `${b} refolds on reels`);
  ok(/booms.*weigh/.test(architectureFor('habitat', { areaM2: 1e9, filmKg: 3.4e5 }).why), 'the rationale states the boom penalty');
  ok(ALLOWABLE_PA === FILM.ultimatePa / FILM.safety, 'the allowable is the ultimate over the safety factor');
  ok(BOOMS.trac.rate > 0.01 && BOOMS.trac.rate < 0.05 && BOOMS.lattice.rate > BOOMS.trac.rate, 'TRAC extends at cm/s, a coilable mast faster');
  /* the triangle test: crossing, touching, sharing */
  ok(trianglesIntersect([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0.2, 0.2, -1], [0.3, 0.2, 1], [0.2, 0.3, 1]], 1e-9), 'a triangle piercing another is an intersection');
  ok(!trianglesIntersect([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [1, 0, 0], [0, 0, 1]], 1e-9), 'two triangles sharing an edge are not');
  ok(!trianglesIntersect([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0.2, 0.2, 1e-12], [1.2, 0.2, 1e-12], [0.2, 1.2, 1e-12]], 1e-9), 'nor are two layers touching face to face');
}

/* ---------- every sail class ---------- */
const sailClasses = [...CLASSES, ...VARIANTS, ...REALISM];
const measures = Object.fromEntries(sailClasses.map((c) => [c.id, measure(c.id, {})]));
const fullGeometry = new Set(['smallsat-v4', 'habitat-v4', 'wafer-v4', 'smallsat']);   // the heavy intersection sweep: one per architecture and a v1

for (const cls of sailClasses) {
  const m = measures[cls.id];
  const heavy = fullGeometry.has(cls.id);
  const mm = mechanismsFor(m, { pleatCap: 24, segCap: heavy ? 1200 : 400 });
  const T = mm.true, D = mm.drawn;
  const tag = `${cls.id} (${mm.architecture})`;

  /* the architecture is the class's */
  ok(T.architecture === architectureFor(cls.base ?? cls.id).id, `${tag}: the fleet assignment is the architecture law's`);
  ok(mm.drawnSide <= mm.trueSide + 1e-9 && mm.drawnSide >= Math.min(mm.trueSide, 5) - 1e-9, `${tag}: the drawn side is the viewer's`);

  /* stages and time */
  ok(T.stages[0].k0 === 0 && T.stages[T.stages.length - 1].k1 === 1, `${tag}: the stages tile k from 0 to 1`);
  near(T.timeAt(1), T.totalSeconds, 1e-9, `${tag}: the time at k = 1 is the sum of the stage durations`);
  ok(T.timeAt(0) === 0, `${tag}: and zero at k = 0`);
  { let prev = -1; for (const k of KS) { const t = T.timeAt(k); ok(t >= prev - 1e-9, `${tag}: time is monotone in k (k = ${k})`); prev = t; } }
  if (T.architecture === 'reeled-gore' || T.architecture === 'spin-square') {
    const pay = T.stages.find((s) => s.id === 'payout');
    near(pay.seconds, T.stripL / T.rates.payoutMs, 1e-9, `${tag}: the payout takes strip length over reel rate`);
    ok(T.rates.payoutMs >= 0.02 && T.rates.payoutMs <= 1, `${tag}: the reel rate is between 2 cm/s and 1 m/s`);
  }
  if (T.architecture === 'boom-square') near(T.stages.find((s) => s.id === 'extend').seconds, T.booms.lengthM / T.booms.rateMs, 1e-9, `${tag}: boom extension time is length over rate`);

  /* pack: the true film in the true drum */
  if (T.architecture !== 'starchip-disc') {
    ok(T.pack.fits, `${tag}: the folded film (${T.pack.volumeM3.toExponential(2)} m3 at ${((T.thicknessM + FILM.foldGapM) / T.thicknessM).toFixed(0)}x) fits the drum annulus (${T.pack.annulusM3.toExponential(2)} m3)`);
    near(T.pack.volumeM3, T.areaM2 * (T.thicknessM + FILM.foldGapM), 1e-12, `${tag}: pack volume is area x (thickness + fold gap)`);
    if (T.pack.bandHeightM) ok(T.pack.bandHeightM <= T.drum.l + 1e-9, `${tag}: the wrapped band is no taller than the drum`);
    if (T.pack.outerRadiusM) ok(T.pack.outerRadiusM <= T.drum.r + 1e-9, `${tag}: the wound pack stays inside the drum radius`);
    ok(T.drum.derived === !m.solved.nodes.some((n) => n.part.kind === 'sail-canister'), `${tag}: the drum is the canister part where there is one, derived (and only drawn) where there is not`);
  }

  /* geometry over k and back */
  const areaRef = D.discretisedAreaM2;
  let prevExt = -1, firstGeo = null;
  const ks = heavy ? KS : [0, 0.1, 0.25, 0.5, 0.66, 0.85, 1];
  for (const k of ks) {
    const g = D.geometry(k);
    ok(g.panels.length > 0 && g.panels.every((p) => p.v.every((v) => v.every(Number.isFinite))), `${tag}: finite geometry at k = ${k}`);
    /* area: exact while the film is a rigid fold, up to the chord error of the wound arcs (the heavy sweep resolves
       them to 0.35 %, the light one at 400 slices to 0.6 %); the trim stage draws the billow as a deflected shape,
       which the real film takes from its edge catenaries, so up to 3 % there */
    const tol = g.stage.id === 'trim' || g.stage.id === 'dish' ? 0.03 : heavy ? 0.0035 : 0.006;
    near(g.filmAreaM2, areaRef, tol, `${tag}: film area conserved at k = ${k} (${g.stage.id})`);
    const fc = foldClosure(g);
    ok(fc.ok, `${tag}: pleats share their fold lines at k = ${k} (worst gap ${fc.worst.toExponential(1)} m over ${fc.checked} edges)`);
    const ind = insideDrum(g, D.drum);
    ok(ind.ok, `${tag}: nothing floats outside the drum at k = ${k} (r +${ind.worstR.toExponential(1)}, y +${ind.worstY.toExponential(1)})`);
    ok(g.extensionM >= prevExt - 1e-9, `${tag}: extension is monotone (k = ${k})`); prevExt = g.extensionM;
    ok(g.extensionM <= (T.architecture === 'boom-square' ? D.booms.lengthM : T.architecture === 'starchip-disc' ? 4 * D.R : D.stripL) + 1e-9, `${tag}: extension within spec at k = ${k}`);
    for (const L of g.lines) ok(L.geomM <= L.paidM * (1 + 1e-3) + 1e-9, `${tag}: line ${L.id} is never stretched at k = ${k} (${L.geomM.toFixed(3)} of ${L.paidM.toFixed(3)} m)`);
    if (heavy) { const si = selfIntersections(g, { limit: 1 }); ok(si.hits === 0, `${tag}: no two film panels cross at k = ${k}`); }
    if (k === 0) firstGeo = g;
  }
  /* deployed */
  const g1 = D.geometry(1);
  near(g1.deployedAreaM2, D.areaM2, T.architecture === 'starchip-disc' ? 0.01 : 0.01, `${tag}: at k = 1 the projected area is the sail area`);
  ok(g1.lines.every((l) => l.state === 'taut'), `${tag}: every line is taut when deployed`);
  if (T.architecture !== 'starchip-disc') {
    const g0 = D.geometry(0);
    ok(g0.deployedAreaM2 < 0.01 * D.areaM2, `${tag}: stowed, almost no film faces the beam`);
    ok(g0.panels.every((p) => p.wrapped), `${tag}: stowed, every panel is in the drum`);
    ok(g0.hardware.doors.every((d) => d.angle === 0) && D.geometry(0.12).hardware.doors.every((d) => d.angle > 0.5), `${tag}: the doors open at latch release`);
  }
  /* retraction: the same path backwards returns to the stowed geometry */
  if (T.canRefold) {
    const back = D.geometry(0);
    let worst = 0;
    firstGeo.panels.forEach((p, i) => p.v.forEach((v, j) => { worst = Math.max(worst, Math.hypot(v[0] - back.panels[i].v[j][0], v[1] - back.panels[i].v[j][1], v[2] - back.panels[i].v[j][2])); }));
    ok(worst <= 1e-9 * D.R, `${tag}: retraction (k back to 0) returns to the stowed geometry (worst ${worst.toExponential(1)} m)`);
    ok(/rewind|reel/.test(T.retract), `${tag}: the retraction path is stated`);
  } else {
    ok(T.oneShot && /cannot/.test(T.retract), `${tag}: a one-shot mechanism says it cannot refold`);
    const J = T.jettison(1);
    ok(J.separationM >= 0 && (T.architecture === 'starchip-disc' ? J.separationM === 0 : J.separationM > T.R), `${tag}: the cut-away path is modelled`);
    if (T.architecture !== 'starchip-disc') ok(T.jettison(0.5).separationM < J.separationM && T.jettison(1).seconds === J.separationM / J.dvMs, `${tag}: separation grows with the cut-away parameter at the stated delta-v`);
  }
  /* loads and pointing */
  near(T.thrustN, (2 * 0.9 * m.powerW) / 299792458, 1e-9, `${tag}: thrust is 2 eta P / c`);
  ok(T.pointing.ok, `${tag}: trim authority ${T.pointing.totalNm.toExponential(2)} N m covers the CP-CM offset torque ${T.pointing.neededNm.toExponential(2)} N m (margin ${T.pointing.margin.toFixed(1)}x)`);
  near(T.filmK, filmTemperatureK({ fluxWm2: m.powerW / T.areaM2 }), 1e-9, `${tag}: the film temperature is the two-sided grey-body equilibrium at the lab's delivered flux`);
  if (m.inventory?.film) near(T.filmK, m.inventory.film.tempK, 0.03, `${tag}: and within 3 % of the inventory's (which uses the fixed-point iteration's power)`);
  /* spin */
  if (T.spin) {
    ok(T.spin.hoopStressPa <= ALLOWABLE_PA + 1e-6, `${tag}: the spin never exceeds the allowable hoop stress`);
    near(T.spin.rimSpeedMs, Math.sqrt(T.spin.hoopStressPa / T.densityKgM3), 1e-9, `${tag}: rim speed is sqrt(sigma / rho)`);
    near(T.spin.sagM, (T.pressurePa * T.R * T.R) / (4 * T.spin.tensionNm), 1e-9, `${tag}: the dish is p R^2 / 4 T`);
    ok(T.spin.stressLimited ? T.spin.sagFrac >= FILM.sagDesign - 1e-9 : Math.abs(T.spin.sagFrac - FILM.sagDesign) < 1e-9, `${tag}: the dish is the design 5 % unless the allowable limits the spin (then it is larger and said so)`);
    /* angular momentum: I omega is the release momentum plus what the hub added, never less */
    let prevOmega = Infinity;
    for (const k of [0, 0.2, 0.4, 0.6, 0.62]) {
      const s = T.spinAt(k);
      near(s.momentum, s.momentum0 + s.addedNms, 1e-9, `${tag}: I omega = L0 + added at k = ${k}`);
      ok(s.addedNms >= -1e-9, `${tag}: the hub never removes momentum during payout (k = ${k})`);
      ok(s.omegaRadS <= prevOmega + 1e-12, `${tag}: spin falls as the film goes out (k = ${k})`); prevOmega = s.omegaRadS;
      ok(s.tipAccel >= 0.1 - 1e-9, `${tag}: tip acceleration is held at or above 0.1 m/s2 (k = ${k})`);
    }
    const sFree = T.spinAt(0.3);
    ok(sFree.controlled || Math.abs(sFree.omegaRadS - sFree.freeOmega) < 1e-9, `${tag}: spin is either free (I omega constant) or held at the floor`);
    near(T.spinAt(1).omegaRadS, T.spin.omegaRadS, 1e-6, `${tag}: at k = 1 the sail spins at its design rate`);
  }
  /* booms */
  if (T.booms) {
    ok(T.booms.lengthM === T.R && T.booms.massKg === 4 * T.booms.lengthM * T.booms.kgPerM, `${tag}: four booms to the corners`);
    ok(T.booms.f1Hz > 0 && T.booms.deploySeconds === T.booms.lengthM / T.booms.rateMs, `${tag}: boom frequency and extension time are stated`);
  }
  /* readout */
  const r = readout(T, 0.5, { coarse: true });
  ok(r.stage && Number.isFinite(r.timeS) && Number.isFinite(r.deployedAreaM2), `${tag}: the readout is complete at k = 0.5`);

  /* the mechanism against the hull it is mounted on, at every quarter of the deployment: no film panel, tip or line end
     inside a hull body (the canister and the mast carry the drum and are exempt), and the drum itself clear of everything
     but what it stands on. The drawn mechanism is used (the true film wraps its drum thousands of times), in the sail
     node's world frame; the drum is true size. */
  {
    const sailNode = m.solved.nodes.find((n) => n.part.kind === 'sail');
    const rot = (q, v) => { const [x, y, z, w] = q; const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
    const toWorld = (f, p) => { const r2 = rot(f.quaternion, p); return [r2[0] + f.position[0], r2[1] + f.position[1], r2[2] + f.position[2]]; };
    const toLocal = (f, p) => rot([-f.quaternion[0], -f.quaternion[1], -f.quaternion[2], f.quaternion[3]], [p[0] - f.position[0], p[1] - f.position[1], p[2] - f.position[2]]);
    const hull = m.solved.nodes.filter((n) => !['sail', 'sail-canister', 'mast'].includes(n.part.kind)).flatMap((n) => shapesOf(n.part).map((shape) => ({ n, shape })));
    const depthIn = (pWorld) => { let worst = 0, who = null; for (const h of hull) { const d = -sdf(h.shape, toLocal(h.n.world, pWorld)); if (d > worst) { worst = d; who = h.n.name; } } return { worst, who }; };
    const tol = Math.max(0.02, 0.002 * D.R);
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const g = D.geometry(k);
      let worst = { worst: 0, who: null }, n = 0;
      const step = Math.max(1, Math.floor(g.panels.length / 400));
      for (let i = 0; i < g.panels.length; i += step) for (const v of g.panels[i].v) { const d = depthIn(toWorld(sailNode.world, v)); if (d.worst > worst.worst) worst = d; n += 1; }
      for (const t of g.hardware.tips) { const d = depthIn(toWorld(sailNode.world, t.p)); if (d.worst > worst.worst) worst = d; }
      for (const L of g.lines) for (const e of [L.a, L.b]) { const d = depthIn(toWorld(sailNode.world, e)); if (d.worst > worst.worst) worst = d; }
      ok(worst.worst <= tol, `${tag}: at k = ${k} no film panel, tip or line end is inside the hull (${n} points; worst ${worst.worst.toFixed(3)} m in ${worst.who ?? 'nothing'})`);
    }
    /* the drum: a cylinder of the true canister below the film plane */
    if (D.architecture !== 'starchip-disc') {
      const drum = D.drum; let worst = { worst: 0, who: null };
      for (let i = 0; i < 48; i += 1) for (const y of [0, -drum.l / 2, -drum.l]) { const a = (i / 48) * Math.PI * 2; const d = depthIn(toWorld(sailNode.world, [Math.cos(a) * drum.r, y, Math.sin(a) * drum.r])); if (d.worst > worst.worst) worst = d; }
      ok(worst.worst <= Math.max(0.05, 0.02 * drum.r), `${tag}: the drum stands clear of the hull (worst ${worst.worst.toFixed(3)} m in ${worst.who ?? 'nothing'})`);
      ok(T.pack.fits, `${tag}: the true film pack fits its drum (${(T.pack.volumeM3).toPrecision(3)} of ${(T.pack.annulusM3).toPrecision(3)} m3)`);
    }
  }
}

/* ---------- the boom architecture on a class, through the override ---------- */
{
  const m = measures['smallsat-v4'];
  const mm = mechanismsFor(m, { architecture: 'boom-square', pleatCap: 24, segCap: 400 });
  const T = mm.true, D = mm.drawn;
  ok(T.architecture === 'boom-square' && T.booms.family === 'coilable lattice', 'a 263 m boom is a coilable lattice mast, not a TRAC tape');
  ok(T.booms.bucklingMargin < 1, `and its Euler load does not carry the film tension (margin ${T.booms.bucklingMargin.toExponential(2)}): the honest reason the fleet spins`);
  let prev = -1;
  for (const k of KS) {
    const g = D.geometry(k);
    near(g.filmAreaM2, D.areaM2, g.stage.id === 'trim' ? 0.03 : 0.003, `boom-square: film on the booms plus film on the spools is the sail area at k = ${k}`);
    ok(g.extensionM >= prev - 1e-9 && g.extensionM <= D.booms.lengthM + 1e-9, `boom-square: boom length monotone and within spec at k = ${k}`); prev = g.extensionM;
    ok(foldClosure(g).ok, `boom-square: pleats share fold lines at k = ${k}`);
    ok(selfIntersections(g, { limit: 1 }).hits === 0, `boom-square: no film panel crosses another at k = ${k}`);
    const booms = g.hardware.booms;
    for (let i = 0; i < 4; i += 1) {
      const tip = g.hardware.tips[i].p, root = booms[i].root, dir = booms[i].dir;
      near(Math.hypot(tip[0] - root[0] * 0, tip[2] - root[2] * 0), booms[i].lengthM, 1e-9, `boom-square: the film corner rides the boom tip at k = ${k}`);
      ok(Math.abs(dir[0] * tip[2] - dir[2] * tip[0]) < 1e-9 * Math.max(1, D.R), `boom-square: the tip is on the boom line at k = ${k}`);
    }
    const spoolArea = g.hardware.spools.reduce((s, sp) => s + sp.remainingM2, 0);
    near(spoolArea + g.panels.reduce((s, p) => s + p.projArea, 0), D.areaM2, g.stage.id === 'trim' ? 0.03 : 0.003, `boom-square: what is not on the booms is on the spools at k = ${k}`);
  }
  ok(D.geometry(0).hardware.spools.every((s) => s.radiusM < D.drum.r * 0.5), 'boom-square: the stowed rolls fit the cassette');
  ok(T.canRefold && /reel the booms back/.test(T.retract), 'boom-square: booms retract and spools re-roll');
}

/* ---------- a standalone mechanism with explicit inputs ---------- */
{
  const mech = sailMechanism({ architecture: 'reeled-gore', areaM2: 1e4, filmKg: 3.4, drum: { d: 1.2, l: 1.2 }, deliveredW: 1e9, shipKg: 100, offAxisM: 0.2, mastLenM: 5, pleatCap: 24, segCap: 400 });
  ok(mech.N === 6 && Math.abs(mech.R - rimRadius(1e4, 6, 0.6)) < 1e-9, 'a reeled-gore sail is a hexagon around its drum');
  near(mech.pressurePa, (2 * 0.9 * 1e9) / 299792458 / 1e4, 1e-9, 'pressure is thrust over area');
  near(mech.accel, mech.thrustN / 103.4, 1e-9, 'acceleration is thrust over everything it pushes');
  ok(mech.pack.pleatsPerGore % 2 === 0, 'an even pleat count puts a fold line on the gore axis');
  const g = mech.geometry(0.5);
  ok(g.stage.id === 'payout' && g.extensionM > 0 && g.extensionM < mech.stripL, 'half-way the strips are paying out');
  ok(g.tips.length === 6 && g.lines.length === 12, 'six tips, six cords, six tie-lines');
  near(hullSpanOf({ solved: { nodes: [{ part: { dims: { d: 2, l: 4 } }, world: { position: [0, 0, 0] } }] } }), 4, 1e-12, 'hull span reads the solved envelopes');
  ok(drawnSideFor(1000, 10) === 30 && drawnSideFor(1, 10) === 1 && drawnSideFor(1000, 1) === 5, 'drawn side: 3 hull spans, never under 5 m, never over true size');
}

console.log(`centauri sail: ${checks} checks pass`);
