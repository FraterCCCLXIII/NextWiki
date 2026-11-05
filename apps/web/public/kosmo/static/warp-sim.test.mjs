// Headless regression checks for warp-sim.js.  Run:  node warp-sim.test.mjs
import { makeModel, sampleField, energy, alcubierreRho, alcubierreEnergy, curvature, horizons, quantumInequality, casimirSupply, createWarp, lightPlay, scanShell, makeShape, PLANCK_L, C, G, GEO_TO_KG, MSUN } from './warp-sim.js';

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failed++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-30);

// 1. flat space has no curvature
{ const m = makeModel({ model: 'alcubierre', vs: 0, R: 10, wall: 2 });
  const s = sampleField(m, 3, 1, 0); check('vs = 0: spacetime is flat (rho = 0)', Math.abs(s.rho) < 1e-9, s.rho.toExponential(2)); }

// 2. the engine reproduces Alcubierre's analytic energy density point by point
{ const m = makeModel({ model: 'alcubierre', vs: 2, R: 10, wall: 3 });
  for (const [x, y, z] of [[8, 4, 0], [10, 2, 3], [11, 6, 0], [-9, 5, 1]]) {
    const num = sampleField(m, x, y, z).rho, ana = alcubierreRho(2, m.shape, x, y, z);
    check(`Alcubierre rho at (${x},${y},${z}) matches the closed form`, near(num, ana, 2e-3), `${num.toExponential(3)} vs ${ana.toExponential(3)}`);
  } }

// 3. rho is negative everywhere in the wall (WEC violated) and zero on the axis
{ const m = makeModel({ model: 'alcubierre', vs: 2, R: 10, wall: 3 });
  const off = sampleField(m, 10, 3, 0), axis = sampleField(m, 10, 0, 0);
  check('Alcubierre wall has negative energy density', off.rho < 0 && off.wec < 0);
  check('...and violates the null energy condition', off.nec < -1e-8, off.nec.toExponential(2));
  check('rho vanishes on the motion axis', Math.abs(axis.rho) < 1e-8); }

// 4. total energy: grid integral equals -(vs^2/12) integral r^2 f'^2 dr, and scales as vs^2
{ const a = makeModel({ model: 'alcubierre', vs: 1, R: 10, wall: 3 }), b = makeModel({ model: 'alcubierre', vs: 3, R: 10, wall: 3 });
  const Ea = energy(a).Eneg, Eb = energy(b).Eneg, Ec = alcubierreEnergy(1, a.shape);
  check('energy integral matches the closed form', near(Ea, Ec, 0.01), `${Ea.toFixed(4)} vs ${Ec.toFixed(4)} m`);
  check('energy scales as vs^2', near(Eb / Ea, 9, 0.01), (Eb / Ea).toFixed(3));
  check('the energy is all negative (no positive part)', energy(a).Epos > -1e-9 && energy(a).Epos < 1e-6 * Math.abs(Ea)); }

// 5. Natario: space neither expands nor contracts, energy density is never positive
{ const m = makeModel({ model: 'natario', vs: 2, R: 10, wall: 3 });
  const h = 1e-4, X = (x, y, z) => m.X(x, y, z);
  const div = (x, y, z) => (X(x + h, y, z)[0] - X(x - h, y, z)[0] + X(x, y + h, z)[1] - X(x, y - h, z)[1] + X(x, y, z + h)[2] - X(x, y, z - h)[2]) / (2 * h);
  check('Natario shift is divergence-free', Math.abs(div(8.5, 3, 1)) < 1e-6 && Math.abs(div(11, 2, 5)) < 1e-6, div(8.5, 3, 1).toExponential(1));
  check('Natario interior moves with the ship (X = vs x^)', near(X(0, 0, 0)[0], 2, 1e-6) && Math.abs(X(1, 1, 0)[1]) < 1e-3);
  const e = energy(m); check('Natario energy is negative', e.Eneg < 0 && e.rhoMax < 1e-9, e.Eneg.toFixed(3));
  const al = energy(makeModel({ model: 'alcubierre', vs: 2, R: 10, wall: 3 }));
  check('Natario and Alcubierre differ in the energy they need', Math.abs(e.Eneg / al.Eneg - 1) > 0.02, (e.Eneg / al.Eneg).toFixed(3)); }

// 6. the engine on a known vacuum solution: isotropic Schwarzschild has G_ab = 0
{ const mu = 0.1, M2 = mu * 20;       // psi = 1 + M/(2r), take M/2 = 3
  const g = (t, x, y, z) => { const r = Math.hypot(x, y, z), psi = 1 + 3 / r, N = (2 - psi) / psi, B2 = psi ** 4, o = new Float64Array(16); o[0] = -N * N; o[5] = o[10] = o[15] = B2; return o; };
  const c = curvature(g, [0, 30, 10, 5], 0.05);
  let mx = 0; for (let i = 0; i < 16; i++) mx = Math.max(mx, Math.abs(c.G[i]));
  check('vacuum Schwarzschild: Einstein tensor vanishes (engine self-test)', mx < 1e-7, mx.toExponential(2));
  // and the Kretschmann-like Riemann is nonzero (tidal field exists)
  let rm = 0; for (let i = 0; i < 256; i++) rm = Math.max(rm, Math.abs(c.Riem[i])); check('...while the Riemann tensor does not', rm > 1e-5, rm.toExponential(2)); }

// 7. Van den Broeck: a large interior in a tiny neck needs far less negative energy than an Alcubierre bubble the size of the room
{ const room = 100, alpha = 9;
  const big = energy(makeModel({ model: 'alcubierre', vs: 1, R: room, wall: 1 })).Eneg;
  const vdb = energy(makeModel({ model: 'vandenbroeck', vs: 1, rIn: room, alpha, wall: 1 }));
  const smallA = energy(makeModel({ model: 'alcubierre', vs: 1, R: room / (1 + alpha), wall: 1 })).Eneg;
  check('Van den Broeck pocket: neck radius is room/(1+alpha)', near(makeModel({ model: 'vandenbroeck', vs: 1, rIn: room, alpha, wall: 1 }).Rb, room / (1 + alpha), 1e-9));
  check('the warp wall of the neck costs (Rb/R)^2 of the room-sized bubble (area law)', near(smallA / big, 1 / (1 + alpha) ** 2, 0.1), (smallA / big).toFixed(4));
  check('the pocket itself carries positive mass (net energy > 0)', vdb.Enet > 0 && vdb.Epos > 0, vdb.Enet.toFixed(1) + ' m');
  console.log('      VdB: E- =', vdb.Eneg.toFixed(2), 'E+ =', vdb.Epos.toFixed(2), 'net', vdb.Enet.toFixed(2), 'm; bare neck bubble E- =', smallA.toFixed(2)); }

// 8. positive-energy shell: mass raises rho; enough mass removes the negative-energy region
{ const cfg = { model: 'shell', vs: 0.3, R: 20, wall: 6 };
  const rows = scanShell(cfg, [0, 0.05, 0.15, 0.3]);
  check('shell with mu = 0 is plain Alcubierre (negative energy only)', rows[0].Epos < 1e-6 * Math.abs(rows[0].Eneg) + 1e-9 && rows[0].Eneg < 0);
  check('shell with mass carries positive energy', rows[2].Epos > 0, rows[2].Epos.toFixed(3));
  check('ADM-style mass of the shell is 2 mu R in geometric units', near(rows[2].massKg, 2 * 0.15 * 20 * GEO_TO_KG, 1e-9));
  check('a massive shell slows the clocks inside it', rows[3].clockRate < 1 && rows[3].clockRate > 0, rows[3].clockRate.toFixed(3)); }

// 9. horizons: none below c, a pair above; Hawking temperature is finite and large for thin walls
{ const slow = horizons(makeModel({ model: 'alcubierre', vs: 0.8, R: 10, wall: 2 })), fast = horizons(makeModel({ model: 'alcubierre', vs: 2, R: 10, wall: 2 }));
  check('vs < c: no horizons', slow.length === 0); check('vs > c: two horizons (front and rear wall)', fast.length === 2, fast.map(h => h.x.toFixed(1)).join(', '));
  const thin = horizons(makeModel({ model: 'alcubierre', vs: 2, R: 10, wall: 0.2 }));
  check('thinner wall -> hotter horizon (surface gravity ~ 1/D)', thin[0].T > 5 * fast[0].T, `${fast[0].T.toExponential(2)} K -> ${thin[0].T.toExponential(2)} K`); }

// 10. quantum inequalities: the allowed wall is about a Planck length, the energy needed is astronomical
{ const q = quantumInequality(1, -1e50, 1e-35); check('QI: maximal wall thickness is of order the Planck length', q.Dmax > 0.1 * PLANCK_L && q.Dmax < 10 * PLANCK_L, (q.Dmax / PLANCK_L).toFixed(2) + ' l_P');
  const c = casimirSupply(-1e9, 1); check('Casimir gap for 1e9 J/m^3 is a few hundred pm', c.gap > 1e-10 && c.gap < 2e-9, (c.gap * 1e9).toFixed(3) + ' nm'); }

// 11. rays: space is carried -- light cannot cross an Alcubierre wall from inside when vs > c
{ const fast = lightPlay({ model: 'alcubierre', vs: 2, R: 6, wall: 1.5 }, { n: 16, T: 40 });
  check('superluminal bubble: ship light cannot get out ahead (forward rays pile up inside)', fast.forward === 0, `forward ${fast.forward}, back ${fast.back}, inside ${fast.trapped}`);
  const slow = lightPlay({ model: 'alcubierre', vs: 0.4, R: 6, wall: 1.5 }, { n: 16, T: 40 });
  check('subluminal bubble: light escapes both ways', slow.forward > 0 && slow.back > 0, `forward ${slow.forward}, back ${slow.back}`); }

// 12. a test mass dropped inside the bubble rides along with it
{ const sim = createWarp({ model: 'alcubierre', vs: 2, R: 10, wall: 3 }); const d = sim.drop(0, 0, 0);
  for (let i = 0; i < 400; i++) sim.step(0.05);
  check('a mass at rest inside the bubble is carried at vs', Math.abs(d.s[0] - sim.m.xs) < 0.5, `offset ${(d.s[0] - sim.m.xs).toFixed(3)} m after ${sim.t.toFixed(0)} light-metres`);
  const out = sim.drop(sim.m.xs + 60, 0, 0); for (let i = 0; i < 100; i++) sim.step(0.05); check('a mass far outside stays put', Math.abs(out.s[0] - (sim.m.xs + 60 - sim.m.vs * 5)) < 1);
}

{ const R = 50, vs = 2, thin = alcubierreEnergy(vs, makeShape('tanh', R, 1e-3)), ref = -vs * vs * R * R / (18 * 1e-3);
  check('thin-wall Alcubierre energy -> -vs^2 R^2 / (18 D)', near(thin, ref, 1e-3), `${thin.toExponential(3)} vs ${ref.toExponential(3)}`);
  const pf = alcubierreEnergy(vs, makeShape('tanh', R, PLANCK_L)) * GEO_TO_KG;
  check('Pfenning-Ford: a 50 m bubble with a Planck-thick wall weighs about -10^65 kg', pf < -1e63 && pf > -1e67, pf.toExponential(2) + ' kg'); }

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
