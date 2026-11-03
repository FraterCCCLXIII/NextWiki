// Study: how representative are the cosmic-web views of what surveys measure?
//   node tools/cosmic-web-study.mjs
// Compares (a) the original universe cloud (8 plane waves across the whole observable universe) and (b) the new FFT/Zel'dovich web with the
// statistics galaxy surveys give: two-point correlation xi(r) = (r/r0)^-gamma with r0 ~ 5.5 Mpc/h, gamma ~ 1.8 (Zehavi+ 2011; SDSS), sigma(8 Mpc/h) ~ 0.8-1
// (matter ~0.8, galaxies ~1), and the fraction of volume in voids (most of the volume is underdense; filaments hold roughly half the mass).
import * as P from '../apps/web/public/kosmo/static/sim-physics.js';
import { makeWeb, cellStats, twoPoint, xiSlope } from '../apps/web/public/kosmo/static/cosmic-web.js';

const h = 0.7, CHI0_MPC = 14400, line = (...a) => console.log(...a);
const ref = r => Math.pow(r / 5.5, -1.8);   // observed galaxy xi(r), r in Mpc/h
line('REFERENCE (surveys): xi(8)=%s xi(20)=%s xi(40)=%s   sigma8(galaxies)~0.9-1.0   gamma~1.8   r0~5.5 Mpc/h', ref(8).toFixed(2), ref(20).toFixed(3), ref(40).toFixed(3));

// (a) the original generator, exactly as the timeline used it: unit cube -> Zel'dovich with 8 long waves -> scaled by the Hubble radius
{
  const web = P.makeZeldovichField(2.2, [[3, 0, 0], [0, 3, 0], [0, 0, 3], [2, 2, 0], [0, 2, 2], [2, 0, 2], [1, 1, 1], [3, 1, 2]], 3);
  let s = 12345; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const n = 150000, pos = new Float32Array(n * 3), q = { x: 0, y: 0, z: 0 }, o = {}; let i = 0;
  while (i < n) { const x = 2 * rnd() - 1, y = 2 * rnd() - 1, z = 2 * rnd() - 1; if (x * x + y * y + z * z > 1) continue; q.x = 0.5 + 0.5 * x; q.y = 0.5 + 0.5 * y; q.z = 0.5 + 0.5 * z; P.zeldovichDisplace(q, 1, web, o); pos[3 * i] = (o.x - 0.5) * 2; pos[3 * i + 1] = (o.y - 0.5) * 2; pos[3 * i + 2] = (o.z - 0.5) * 2; i++; }
  const kmin = 2 * Math.PI * 1 / (2 * CHI0_MPC * h), kmax = 2 * Math.PI * Math.hypot(3, 1, 2) / (2 * CHI0_MPC * h);
  line('\nORIGINAL universe cloud: 8 plane waves, wavelengths %s-%s Mpc/h (box = observable universe, %s Mpc/h across)', (2 * Math.PI / kmax).toFixed(0), (2 * Math.PI / kmin).toFixed(0), (2 * CHI0_MPC * h).toFixed(0));
  line('  real power lives at 1-300 Mpc/h (peak near 300, turnover k ~ 0.02 h/Mpc), so this cloud has NO structure below ~%s Mpc/h: its "filaments" are Gpc-wide sheets, ~%sx too large.', (2 * Math.PI / kmax).toFixed(0), ((2 * Math.PI / kmax) / 300).toFixed(0));
  const st = cellStats(pos, 2.2, 12); line('  coarse check (12^3 cells over the cloud): sigma=%s skew=%s voidFrac=%s', st.sigma.toFixed(2), st.skew.toFixed(2), st.voidFrac.toFixed(2));
}

// (b) the new generator
for (const cfg of [{ smooth: 2, D: 1 }, { smooth: 4, D: 1 }, { smooth: 4, D: 2 }]) {
  const t0 = Date.now(), w = makeWeb({ N: 64, L: 512, seed: 7, ...cfg }), cs = cellStats(w.pos, w.L, 64), cs2 = cellStats(w.pos, w.L, 32), xi = twoPoint(w.pos, w.L, { rMin: 8, rMax: 64, bins: 6, sample: 30000 }), sl = xiSlope(xi);
  line('\nNEW web N=64 L=512 Mpc/h smooth=%s D=%s (%s ms)', cfg.smooth, cfg.D, Date.now() - t0);
  line('  sigma(8 Mpc/h cells)=%s  skew=%s  voidFrac(<20%% of mean, 8 Mpc/h cells)=%s  densest 5%% of cells hold %s%% of the mass', cs.sigma.toFixed(2), cs.skew.toFixed(2), cs.voidFrac.toFixed(2), (cs.topCellShare * 100).toFixed(0));
  line('  sigma(16 Mpc/h cells)=%s  voidFrac(16)=%s', cs2.sigma.toFixed(2), cs2.voidFrac.toFixed(2));
  line('  xi(r):', xi.map(b => `${b.r.toFixed(0)}:${b.xi.toFixed(2)}`).join(' '), ' slope=' + sl.toFixed(2) + '   target slope -1.8, xi(8)~0.35-0.5, xi(20)~0.1');
}
