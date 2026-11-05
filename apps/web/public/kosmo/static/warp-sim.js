// warp-sim.js -- warp-drive spacetimes: metrics, a numerical general-relativity engine, energy
// conditions, horizons, quantum-inequality / Casimir / scalar-field "gap fillers", ray + particle
// tracing and a trip simulator.  No DOM, no Three.js: runs in node (warp-sim.test.mjs) and in
// warp-lab.html.
//
// The idea (Alcubierre 1994)
//   Write spacetime in 3+1 form with a flat, unit-lapse foliation and a shift vector X(x,t):
//        ds^2 = -N^2 c^2 dt^2 + B^2 [ (dx - X_x dt)^2 + (dy - X_y dt)^2 + (dz - X_z dt)^2 ]
//   A bubble of radius R is carried along +x at speed vs (units of c).  Inside it X = vs x^ (the
//   ship is carried by space, never locally faster than light); outside X = 0 (flat space).
//   The Einstein equation G_ab = 8 pi T_ab then says what stress-energy such a geometry needs.
//
// The engine (everything here is computed, nothing is a pasted formula)
//   curvature(g, p)   metric g(t,x,y,z) -> Christoffels -> Riemann -> Ricci -> Einstein tensor,
//                     by central finite differences of the metric (first and second derivatives).
//   sampleField       T_ab = G_ab / 8 pi, then the Eulerian energy density, the Null and Weak
//                     Energy Conditions over sampled observers, and the tidal tensor.
//   energy            integrates rho over the bubble (polar Gauss-Legendre grid) -> E-, E+, net.
//
// Models
//   alcubierre   N = B = 1, X = vs f(r) x^, f a top-hat of the distance r from the bubble centre.
//   natario      divergence-free shift (no expansion/contraction of space -- only shear).
//   vandenbroeck Alcubierre + a conformal "pocket" B = 1 + alpha: a large interior inside a tiny neck.
//   shell        a positive-mass shell (isotropic Schwarzschild-like, N = (2-psi)/psi, B = psi^2)
//                around the Alcubierre shift -- the Bobrick-Martire / Fell-Heisenberg idea: can
//                ordinary matter pay for the shift?  (It can for slow bubbles; the engine shows when.)
//
// Units: the engine runs in geometric units G = c = 1 (lengths in metres); converters give SI.

/* ---------------- constants ---------------- */
export const C = 299792458, G = 6.6743e-11, HBAR = 1.054571817e-34, KB = 1.380649e-23;
export const MSUN = 1.98847e30, LY = 9.4607304725808e15, YEAR = 3.15576e7, AU = 1.495978707e11;
export const PLANCK_L = Math.sqrt(HBAR * G / C ** 3);
export const PLANCK_RHO = C ** 7 / (HBAR * G * G);          // Planck energy density, J/m^3
export const GEO_TO_J = C ** 4 / G;                          // metres (geometric energy) -> joules
export const GEO_TO_KG = C ** 2 / G;                         // metres -> kilograms
export const RHO_TO_SI = C ** 4 / G;                         // 1/m^2 (T_ab) -> J/m^3
const PI = Math.PI;

/* ---------------- shape functions ---------------- */
function sech2(z) { const a = Math.exp(-Math.abs(z)), s = 2 * a / (1 + a * a); return s * s; }

// Wall profiles f(r): 1 inside radius R, 0 outside, transition of "thickness" D.
//   tanh   Alcubierre's own: f = [tanh(s(r+R)) - tanh(s(r-R))] / (2 tanh(sR)),  s = 2/D
//   quintic compact support: exactly 1 inside R-D/2, exactly 0 outside R+D/2, C2 smoothstep between
export function makeShape(kind, R, D) {
  if (kind === 'quintic') {
    return {
      kind, R, D,
      f: r => { const u = Math.min(1, Math.max(0, (R + D / 2 - r) / D)); return u * u * u * (10 - 15 * u + 6 * u * u); },
      df: r => { const u = (R + D / 2 - r) / D; if (u <= 0 || u >= 1) return 0; return -30 * u * u * (1 - u) * (1 - u) / D; },
    };
  }
  const s = 2 / D, nrm = 2 * Math.tanh(s * R);
  return {
    kind: 'tanh', R, D, sigma: s,
    f: r => (Math.tanh(s * (r + R)) - Math.tanh(s * (r - R))) / nrm,
    df: r => s * (sech2(s * (r + R)) - sech2(s * (r - R))) / nrm,
  };
}

/* ---------------- shell potential (positive-energy model) ---------------- */
// Newtonian-like potential factor of a thin Gaussian shell of radius Rs, width w, normalised so
// h -> 1 inside and Rs/r far away.  Tabulated once and read back with a cubic (Catmull-Rom) lookup.
function makeShellPotential(Rs, w) {
  const N = 6000, rmax = Rs + 14 * w + 4 * Rs, dr = rmax / N;
  const g = new Float64Array(N + 1), cum = new Float64Array(N + 1), tail = new Float64Array(N + 1), h = new Float64Array(N + 1);
  let norm = 0;
  for (let i = 0; i <= N; i++) { const r = i * dr; g[i] = Math.exp(-0.5 * ((r - Rs) / w) ** 2); norm += g[i] * dr; }
  let a = 0; for (let i = 0; i <= N; i++) { if (i) a += 0.5 * (g[i] + g[i - 1]) * dr / norm; cum[i] = a; }
  let tl = 0; for (let i = N; i >= 0; i--) { const r = Math.max(i * dr, 1e-9); if (i < N) tl += 0.5 * (g[i] / r + g[i + 1] / Math.max((i + 1) * dr, 1e-9)) * dr / norm; tail[i] = tl; }
  for (let i = 0; i <= N; i++) { const r = Math.max(i * dr, 1e-9); h[i] = Rs * (cum[i] / r + tail[i]); }
  const hmax = h[N];
  return r => {
    if (r >= rmax) return Rs / r * cum[N];
    const q = Math.max(r, 0) / dr, i = Math.min(N - 1, Math.floor(q)), t = q - i;
    const p0 = h[Math.max(0, i - 1)], p1 = h[i], p2 = h[i + 1], p3 = h[Math.min(N, i + 2)];
    return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  };
}

/* ---------------- models ---------------- */
export const MODELS = {
  alcubierre: { name: 'Alcubierre (1994)', note: 'The original: a shift X = vs f(r) x^ . Space contracts in front of the ship and expands behind it. Needs negative energy density almost everywhere in the wall.' },
  natario: { name: 'Natario (2002)', note: 'A divergence-free shift: no contraction or expansion of space, only shear -- like a ship in a flow. Still needs negative energy, but the "expansion" picture is gone.' },
  vandenbroeck: { name: 'Van den Broeck (1999)', note: 'Alcubierre bubble plus a conformal pocket B = 1 + alpha: tiny neck outside, a ship-sized room inside. Cuts the wall area, so the energy drops by orders of magnitude -- but adds its own curvature terms.' },
  shell: { name: 'Positive-energy shell', note: 'Bobrick-Martire / Fell-Heisenberg idea: wrap the bubble in an ordinary positive-mass shell (isotropic Schwarzschild-like lapse and conformal factor). The engine finds how much mass cancels the negative energy.' },
};

export const DEFAULTS = { model: 'alcubierre', vs: 2, R: 50, wall: 10, shape: 'tanh', alpha: 3, mu: 0.2 };

export function makeModel(cfg = {}) {
  const c = { ...DEFAULTS, ...cfg };
  const m = { cfg: c, id: c.model, vs: c.vs, xs: 0 };
  // Van den Broeck: the conformal pocket B (neck radius Rb, interior ship radius (1+alpha) Rb) sits INSIDE the
  // warp wall, where the shift is already uniform, so the two sets of curvature do not overlap.
  const Rb = c.model === 'vandenbroeck' ? (c.rIn !== undefined ? c.rIn / (1 + c.alpha) : c.R) : c.R;
  const R = c.model === 'vandenbroeck' ? Rb + 2 * c.wall : c.R;
  m.R = R; m.Rb = Rb;
  const shape = makeShape(c.shape, R, c.wall);
  m.shape = shape;
  const bumpB = c.model === 'vandenbroeck' ? makeShape(c.shape, Rb, c.wall) : null;
  const pot = c.model === 'shell' ? makeShellPotential(R, Math.max(c.wall / 2.5, R * 1e-3)) : null;
  m.psi = r => 1 + (pot ? c.mu * pot(r) : 0);
  const rad = (x, y, z) => Math.max(Math.hypot(x - m.xs, y, z), 1e-12);
  m.N = (x, y, z) => { if (c.model !== 'shell') return 1; const p = m.psi(rad(x, y, z)); return Math.max(1e-4, (2 - p) / p); };
  m.B = (x, y, z) => { const r = rad(x, y, z); if (c.model === 'vandenbroeck') return 1 + c.alpha * bumpB.f(r); if (c.model === 'shell') { const p = m.psi(r); return p * p; } return 1; };
  // shift vector, in units of c
  m.X = (x, y, z) => {
    const dx = x - m.xs, r = rad(x, y, z), f = shape.f(r), v = m.vs;
    if (c.model === 'natario') {
      const rf = r * shape.df(r), a = v * (f + 0.5 * rf), b = -0.5 * v * rf * dx / (r * r);
      return [a + b * dx, b * y, b * z];
    }
    return [v * f, 0, 0];
  };
  // metric g_ab(t,x,y,z):  g00 = -N^2 + B^2 |X|^2, g0i = -B^2 X_i, gij = B^2 delta_ij
  m.g = (t, x, y, z) => {
    const o = m.xs; m.xs = m.vs * t;
    const n = m.N(x, y, z), b = m.B(x, y, z), X = m.X(x, y, z); m.xs = o;
    const B2 = b * b, g = new Float64Array(16);
    g[0] = -n * n + B2 * (X[0] * X[0] + X[1] * X[1] + X[2] * X[2]);
    for (let i = 0; i < 3; i++) { g[1 + i] = g[4 * (1 + i)] = -B2 * X[i]; g[5 * (1 + i)] = B2; }
    return g;
  };
  return m;
}

/* ---------------- numerical general relativity ---------------- */
function inv4(a) {
  const m = new Float64Array(32);
  for (let i = 0; i < 4; i++) { for (let j = 0; j < 4; j++) m[i * 8 + j] = a[i * 4 + j]; m[i * 8 + 4 + i] = 1; }
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(m[r * 8 + c]) > Math.abs(m[p * 8 + c])) p = r;
    if (p !== c) for (let k = 0; k < 8; k++) { const t = m[c * 8 + k]; m[c * 8 + k] = m[p * 8 + k]; m[p * 8 + k] = t; }
    const d = m[c * 8 + c];
    for (let k = 0; k < 8; k++) m[c * 8 + k] /= d;
    for (let r = 0; r < 4; r++) if (r !== c) { const f = m[r * 8 + c]; if (f) for (let k = 0; k < 8; k++) m[r * 8 + k] -= f * m[c * 8 + k]; }
  }
  const o = new Float64Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[i * 4 + j] = m[i * 8 + 4 + j];
  return o;
}

/** Riemann, Ricci, scalar and Einstein tensors of the metric g(t,x,y,z) at event p, step h. */
export function curvature(gf, p, h) {
  const g0 = gf(p[0], p[1], p[2], p[3]);
  const d1 = new Float64Array(64), d2 = new Float64Array(256);
  const at = (a, sa, b, sb) => { const q = p.slice(); q[a] += sa * h; if (b >= 0) q[b] += sb * h; return gf(q[0], q[1], q[2], q[3]); };
  for (let a = 0; a < 4; a++) {
    const gp = at(a, 1, -1, 0), gm = at(a, -1, -1, 0);
    for (let k = 0; k < 16; k++) { d1[a * 16 + k] = (gp[k] - gm[k]) / (2 * h); d2[(a * 4 + a) * 16 + k] = (gp[k] - 2 * g0[k] + gm[k]) / (h * h); }
  }
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const pp = at(a, 1, b, 1), pm = at(a, 1, b, -1), mp = at(a, -1, b, 1), mm = at(a, -1, b, -1);
    for (let k = 0; k < 16; k++) { const v = (pp[k] - pm[k] - mp[k] + mm[k]) / (4 * h * h); d2[(a * 4 + b) * 16 + k] = v; d2[(b * 4 + a) * 16 + k] = v; }
  }
  const gi = inv4(g0);
  const Gl = new Float64Array(64);                        // Gamma_{e,bc}
  for (let e = 0; e < 4; e++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++)
    Gl[e * 16 + b * 4 + c] = 0.5 * (d1[b * 16 + e * 4 + c] + d1[c * 16 + e * 4 + b] - d1[e * 16 + b * 4 + c]);
  const Gu = new Float64Array(64);                       // Gamma^a_bc
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    let s = 0; for (let e = 0; e < 4; e++) s += gi[a * 4 + e] * Gl[e * 16 + b * 4 + c]; Gu[a * 16 + b * 4 + c] = s;
  }
  const dgi = new Float64Array(64);                      // d_d g^{ae}
  for (let d = 0; d < 4; d++) for (let a = 0; a < 4; a++) for (let e = 0; e < 4; e++) {
    let s = 0; for (let f = 0; f < 4; f++) for (let k = 0; k < 4; k++) s += gi[a * 4 + f] * d1[d * 16 + f * 4 + k] * gi[k * 4 + e];
    dgi[d * 16 + a * 4 + e] = -s;
  }
  const dG = new Float64Array(256);                      // d_d Gamma^a_bc  at [d*64 + a*16 + b*4 + c]
  for (let d = 0; d < 4; d++) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let e = 0; e < 4; e++) {
      const dGl = 0.5 * (d2[(d * 4 + b) * 16 + e * 4 + c] + d2[(d * 4 + c) * 16 + e * 4 + b] - d2[(d * 4 + e) * 16 + b * 4 + c]);
      s += dgi[d * 16 + a * 4 + e] * Gl[e * 16 + b * 4 + c] + gi[a * 4 + e] * dGl;
    }
    dG[d * 64 + a * 16 + b * 4 + c] = s;
  }
  const Rm = new Float64Array(256);                      // R^a_{bcd}
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++) {
    let s = dG[c * 64 + a * 16 + d * 4 + b] - dG[d * 64 + a * 16 + c * 4 + b];
    for (let e = 0; e < 4; e++) s += Gu[a * 16 + c * 4 + e] * Gu[e * 16 + d * 4 + b] - Gu[a * 16 + d * 4 + e] * Gu[e * 16 + c * 4 + b];
    Rm[a * 64 + b * 16 + c * 4 + d] = s;
  }
  const Ric = new Float64Array(16);
  for (let b = 0; b < 4; b++) for (let d = 0; d < 4; d++) { let s = 0; for (let a = 0; a < 4; a++) s += Rm[a * 64 + b * 16 + a * 4 + d]; Ric[b * 4 + d] = s; }
  let Rs = 0; for (let b = 0; b < 4; b++) for (let d = 0; d < 4; d++) Rs += gi[b * 4 + d] * Ric[b * 4 + d];
  const Ein = new Float64Array(16);
  for (let i = 0; i < 16; i++) Ein[i] = Ric[i] - 0.5 * Rs * g0[i];
  return { g: g0, gi, Riem: Rm, Ric, R: Rs, G: Ein };
}

/* ---------------- observers, energy conditions, tidal tensor ---------------- */
function fibonacciSphere(n) {
  const out = [], ga = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const z = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - z * z), a = ga * i; out.push([r * Math.cos(a), r * Math.sin(a), z]); }
  return out;
}
const DIRS = fibonacciSphere(36), BOOSTS = [0.4, 1, 2, 3.5];
const quad = (T, u, v) => { let s = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s += T[a * 4 + b] * u[a] * v[b]; return s; };

/**
 * Everything the engine knows at one event.  Returns SI-free geometric numbers (1/m^2 for T).
 *   rho   Eulerian energy density (n = unit normal to t = const)
 *   nec   min over sampled null directions of T_ab k^a k^b           (NEC needs >= 0)
 *   wec   min over sampled timelike observers (boosts up to rapidity 3.5) of T_ab u^a u^b   (WEC >= 0)
 *   tidal largest |tidal acceleration gradient| felt by an Eulerian observer, 1/m^2 (times c^2 -> 1/s^2)
 */
export function sampleField(m, x, y, z, t = 0, h) {
  const step = h || Math.min(m.cfg.wall, m.R) * 0.04;
  const o = m.xs; m.xs = 0;
  const cur = curvature((tt, xx, yy, zz) => m.g(tt, xx, yy, zz), [t, x, y, z], step);
  const Nl = m.N(x, y, z), Bc = m.B(x, y, z), X = m.X(x, y, z); m.xs = o;
  const T = new Float64Array(16); for (let i = 0; i < 16; i++) T[i] = cur.G[i] / (8 * PI);
  const n = [1 / Nl, X[0] / Nl, X[1] / Nl, X[2] / Nl];
  const rho = quad(T, n, n);
  let nec = Infinity, wec = rho;
  for (const d of DIRS) {
    const e = [0, d[0] / Bc, d[1] / Bc, d[2] / Bc];
    const k = [n[0] + e[0], n[1] + e[1], n[2] + e[2], n[3] + e[3]];
    nec = Math.min(nec, quad(T, k, k));
    for (const eta of BOOSTS) {
      const ch = Math.cosh(eta), sh = Math.sinh(eta);
      const u = [ch * n[0], ch * n[1] + sh * e[1], ch * n[2] + sh * e[2], ch * n[3] + sh * e[3]];
      wec = Math.min(wec, quad(T, u, u));
    }
  }
  // tidal tensor E_ij = R_{a i b j} n^a n^b in the Eulerian orthonormal frame
  const gm = cur.g, Rl = new Float64Array(256);              // R_{abcd} = g_ae R^e_bcd
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c2 = 0; c2 < 4; c2++) for (let d = 0; d < 4; d++) {
    let s = 0; for (let e = 0; e < 4; e++) s += gm[a * 4 + e] * cur.Riem[e * 64 + b * 16 + c2 * 4 + d]; Rl[a * 64 + b * 16 + c2 * 4 + d] = s;
  }
  const Eij = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const basis = [[0, 1 / Bc, 0, 0], [0, 0, 1 / Bc, 0], [0, 0, 0, 1 / Bc]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c2 = 0; c2 < 4; c2++) for (let d = 0; d < 4; d++)
      s += Rl[a * 64 + b * 16 + c2 * 4 + d] * n[a] * basis[i][b] * n[c2] * basis[j][d];
    Eij[i][j] = s;
  }
  let tidal = 0; for (const d of DIRS) { let s = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s += d[i] * Eij[i][j] * d[j]; tidal = Math.max(tidal, Math.abs(s)); }
  // expansion of the Eulerian congruence, theta = div(X) (flat sections)
  return { rho, nec, wec, tidal, T, cur, Ricci: cur.R, Eij, g: cur.g };
}

/* ---------------- energy integrals ---------------- */
const GL = (() => { // Gauss-Legendre nodes/weights on [-1,1], n = 8 and 12
  const mk = n => { const x = [], w = []; for (let i = 0; i < n; i++) { let z = Math.cos(PI * (i + 0.75) / (n + 0.5)), pp; for (let it = 0; it < 60; it++) { let p1 = 1, p2 = 0; for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1); } pp = n * (z * p1 - p2) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; } x.push(z); w.push(2 / ((1 - z * z) * pp * pp)); } return { x, w }; };
  return { 6: mk(6), 8: mk(8), 12: mk(12) };
})();
function segNodes(a, b, n) { const q = GL[n], r = []; for (let i = 0; i < n; i++) r.push({ r: 0.5 * (b - a) * q.x[i] + 0.5 * (a + b), w: 0.5 * (b - a) * q.w[i] }); return r; }

/** radial nodes concentrated on the wall at R */
function radialNodes(R, D, extra = 3) {
  const e = [0, R - 3 * D, R - 1.5 * D, R - 0.5 * D, R, R + 0.5 * D, R + 1.5 * D, R + 3 * D, R + 3 * D + extra * Math.max(D, 0.25 * R)].filter((v, i, a) => v >= 0 && (i === 0 || v > a[i - 1] + 1e-12));
  const out = []; for (let i = 0; i + 1 < e.length; i++) out.push(...segNodes(e[i], e[i + 1], 6)); return out;
}

/** integrate rho, the energy conditions and the tidal field over the bubble */
export function energy(m, opts = {}) {
  const D = m.cfg.wall, R = m.cfg.model === 'shell' ? m.R : m.R;
  const rn = radialNodes(R, D, opts.extra ?? 3), th = GL[12];
  let Eneg = 0, Epos = 0, nNec = 0, wecMin = Infinity, necMin = Infinity, rhoMin = 0, rhoMax = 0, tidal = 0, vNec = 0, vol = 0, Rmax = 0;
  const peak = { r: 0, th: 0 };
  for (const q of rn) for (let j = 0; j < th.x.length; j++) {
    const ang = 0.5 * PI * (th.x[j] + 1), wA = 0.5 * PI * th.w[j];
    const x = q.r * Math.cos(ang), y = q.r * Math.sin(ang);
    const s = sampleField(m, x, y, 0, 0, opts.h);
    const dV = 2 * PI * q.r * q.r * Math.sin(ang) * q.w * wA * m.B(x, y, 0) ** 3;   // ang runs 0..pi, axisymmetric
    const rho = s.rho;
    if (rho < 0) Eneg += rho * dV; else Epos += rho * dV;
    if (rho < rhoMin) { rhoMin = rho; peak.r = q.r; peak.th = ang; }
    rhoMax = Math.max(rhoMax, rho);
    wecMin = Math.min(wecMin, s.wec); necMin = Math.min(necMin, s.nec);
    if (s.nec < -1e-12 * Math.max(1, Math.abs(s.nec))) vNec += dV; vol += dV;
    tidal = Math.max(tidal, s.tidal);
  }
  return { Eneg, Epos, Enet: Eneg + Epos, rhoMin, rhoMax, wecMin, necMin, tidal, necVolumeFraction: vNec / Math.max(vol, 1e-300), peak };
}

/** Energy for walls that are too thin to grid: compute at R/D = 20 and 40 and extrapolate the power law */
export function energyExtrapolated(m) {
  const c = m.cfg;
  if (c.R / c.wall <= 60) return { ...energy(m), extrapolated: false };
  const a = energy(makeModel({ ...c, wall: c.R / 20 })), b = energy(makeModel({ ...c, wall: c.R / 40 }));
  const ex = (u, v) => (Math.abs(u) < 1e-300 || Math.abs(v) < 1e-300) ? 0 : Math.sign(v) * Math.exp(Math.log(Math.abs(v)) + Math.log(Math.abs(v / u)) / Math.log(2) * Math.log((c.R / c.wall) / 40));
  return { Eneg: ex(a.Eneg, b.Eneg), Epos: ex(a.Epos, b.Epos), Enet: ex(a.Enet, b.Enet), rhoMin: ex(a.rhoMin, b.rhoMin), rhoMax: ex(a.rhoMax, b.rhoMax), wecMin: ex(a.wecMin, b.wecMin), necMin: ex(a.necMin, b.necMin), tidal: ex(a.tidal, b.tidal), necVolumeFraction: b.necVolumeFraction, extrapolated: true, exponent: Math.log(Math.abs(b.Eneg / a.Eneg)) / Math.log(2) };
}

/** closed form for Alcubierre: rho = -(vs^2 / 32 pi) (y^2+z^2)/r^2 f'^2   (geometric units, vs in c) */
export function alcubierreRho(vs, shape, x, y, z) {
  const r = Math.hypot(x, y, z); if (r < 1e-12) return 0;
  const d = shape.df(r); return -(vs * vs / (32 * PI)) * (y * y + z * z) / (r * r) * d * d;
}
/** closed form total: E = -(vs^2/12) * integral r^2 f'^2 dr  (geometric metres) */
export function alcubierreEnergy(vs, shape) {
  const R = shape.R, D = shape.D;
  if (D < 1e-5 * R) return -vs * vs * R * R / (18 * D);           // thin-wall limit of the integral: int r^2 f'^2 dr -> 2 R^2 / (3 D)
  const rn = radialNodes(R, D, 4);
  let s = 0; for (const q of rn) { const d = shape.df(q.r); s += q.r * q.r * d * d * q.w; }
  return -(vs * vs / 12) * s;
}

/* ---------------- unit conversions ---------------- */
export const toJoules = Eg => Eg * GEO_TO_J, toKg = Eg => Eg * GEO_TO_KG, toSolar = Eg => Eg * GEO_TO_KG / MSUN;
export const rhoToSI = r => r * RHO_TO_SI;

/* ---------------- horizons + Hawking temperature ---------------- */
/** where the shift reaches c on the axis; surface gravity kappa = (c/2)|d|X|/dx| and T = hbar kappa / 2 pi kB */
export function horizons(m) {
  const R = m.R, D = m.cfg.wall, span = R + 4 * D, N = 4000, xs = [], v = [];
  for (let i = 0; i <= N; i++) { const x = -span + 2 * span * i / N; xs.push(x); v.push(Math.abs(m.X(x, 0, 0)[0]) / (m.N(x, 0, 0)) - 1); }
  const out = [];
  for (let i = 0; i < N; i++) if (v[i] * v[i + 1] < 0) {
    let a = xs[i], b = xs[i + 1];
    for (let k = 0; k < 60; k++) { const mid = 0.5 * (a + b); const fm = Math.abs(m.X(mid, 0, 0)[0]) / m.N(mid, 0, 0) - 1; if (fm * (Math.abs(m.X(a, 0, 0)[0]) / m.N(a, 0, 0) - 1) > 0) a = mid; else b = mid; }
    const x0 = 0.5 * (a + b), e = 1e-5 * D;
    const dv = (Math.abs(m.X(x0 + e, 0, 0)[0]) / m.N(x0 + e, 0, 0) - Math.abs(m.X(x0 - e, 0, 0)[0]) / m.N(x0 - e, 0, 0)) / (2 * e);
    const kappa = 0.5 * C * Math.abs(dv);                                  // 1/s
    out.push({ x: x0, kappa, T: HBAR * kappa / (2 * PI * KB), type: dv < 0 ? 'front (future-trapping)' : 'rear (past)' });
  }
  return out;
}

/* ---------------- exotic physics: can anything pay the bill? ---------------- */
/** Ford-Roman quantum inequality for a wall of thickness D crossing an observer at speed vs.
 *  Returns the largest allowed |rho| and the thickest-allowed wall for the Alcubierre profile. */
export function quantumInequality(vs, rhoPeakSI, D) {
  const tau = D / (Math.max(vs, 1e-3) * C), L = C * tau;
  const bound = 3 * HBAR * C / (32 * PI * PI * L ** 4);                      // J/m^3, Lorentzian sampling
  // Pfenning-Ford: |rho| ~ (c^4/G) vs^2 a0 / D^2 with a0 = 1/(32 pi) in the thin limit  =>  D <= l_P vs sqrt(3 / (32 pi^2 a0))
  const a0 = 1 / (32 * PI), Dmax = PLANCK_L * Math.max(vs, 1e-3) * Math.sqrt(3 / (32 * PI * PI * a0));
  return { bound, ratio: Math.abs(rhoPeakSI) / bound, Dmax, ok: Math.abs(rhoPeakSI) <= bound };
}
/** Casimir energy density between ideal plates at gap d: u = -pi^2 hbar c / (720 d^4) */
export const casimirDensity = d => -PI * PI * HBAR * C / (720 * d ** 4);
export function casimirSupply(rhoSI, wallVolume) {
  const need = Math.abs(rhoSI), d = Math.pow(PI * PI * HBAR * C / (720 * need), 0.25);
  return { gap: d, gapAt1nm: casimirDensity(1e-9), ratio1nm: need / Math.abs(casimirDensity(1e-9)), plateVolume: wallVolume };
}
/** phantom (negative-kinetic) scalar field: rho = -(1/2)(grad phi)^2  =>  |grad phi| = sqrt(2|rho|) in Planck units */
export function phantomField(rhoSI) { return { gradPlanck: Math.sqrt(2 * Math.abs(rhoSI) / PLANCK_RHO), fractionOfPlanck: Math.abs(rhoSI) / PLANCK_RHO }; }

/* ---------------- trips ---------------- */
export const DESTINATIONS = [
  { id: 'moon', name: 'Moon', d: 3.844e8 }, { id: 'mars', name: 'Mars (mean opposition)', d: 0.52 * AU },
  { id: 'jupiter', name: 'Jupiter', d: 4.2 * AU }, { id: 'neptune', name: 'Neptune', d: 29 * AU },
  { id: 'alpha', name: 'Alpha Centauri', d: 4.37 * LY }, { id: 'sirius', name: 'Sirius', d: 8.6 * LY },
  { id: 'galcenter', name: 'Galactic centre', d: 26670 * LY }, { id: 'andromeda', name: 'Andromeda galaxy', d: 2.537e6 * LY },
];
export function tripTime(distance, vs) { return distance / (vs * C); }
export function fmtTime(s) {
  if (!isFinite(s)) return 'forever';
  if (s < 120) return s.toFixed(1) + ' s'; if (s < 7200) return (s / 60).toFixed(1) + ' min'; if (s < 172800) return (s / 3600).toFixed(1) + ' h';
  if (s < 2 * YEAR) return (s / 86400).toFixed(1) + ' days'; return (s / YEAR).toExponential(2).replace('e+0', 'e').replace(/\.00e/, 'e') + ' yr';
}

/* ---------------- rays and test particles ---------------- */
// Hamiltonians in the lab (grid) frame, with covariant momenta p_i:
//   photon        H = X.p + (N/B) |p|                      dx/dt = X + (N/B) p/|p|,   dp/dt = -grad H
//   massive       H = X.p + N sqrt(1 + |p|^2/B^2)          (a test mass in free fall)
export function createWarp(cfg = {}) {
  const m = makeModel(cfg), sim = { m, t: 0, rays: [], dust: [], trace: [], tau: 0 };
  const h = Math.max(1e-3, Math.min(m.cfg.wall, m.R) * 0.02);
  const H = (kind, x, y, z, px, py, pz) => {
    const X = m.X(x, y, z), N = m.N(x, y, z), B = m.B(x, y, z), p2 = px * px + py * py + pz * pz;
    return X[0] * px + X[1] * py + X[2] * pz + (kind === 'ph' ? N / B * Math.sqrt(p2) : N * Math.sqrt(1 + p2 / (B * B)));
  };
  const rhs = (kind, s) => {
    const [x, y, z, px, py, pz] = s, X = m.X(x, y, z), N = m.N(x, y, z), B = m.B(x, y, z), p2 = px * px + py * py + pz * pz;
    const root = kind === 'ph' ? Math.sqrt(p2) : Math.sqrt(1 + p2 / (B * B));
    const k = kind === 'ph' ? N / (B * Math.max(root, 1e-300)) : N / (B * B * root);
    const gx = (H(kind, x + h, y, z, px, py, pz) - H(kind, x - h, y, z, px, py, pz)) / (2 * h);
    const gy = (H(kind, x, y + h, z, px, py, pz) - H(kind, x, y - h, z, px, py, pz)) / (2 * h);
    const gz = (H(kind, x, y, z + h, px, py, pz) - H(kind, x, y, z - h, px, py, pz)) / (2 * h);
    return [X[0] + k * px, X[1] + k * py, X[2] + k * pz, -gx, -gy, -gz];
  };
  const rk4 = (kind, s, dt) => {
    const add = (a, b, f) => a.map((v, i) => v + f * b[i]);
    const k1 = rhs(kind, s), k2 = rhs(kind, add(s, k1, dt / 2)), k3 = rhs(kind, add(s, k2, dt / 2)), k4 = rhs(kind, add(s, k3, dt));
    return s.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  };
  /** energy a comoving observer measures, relative to launch: E = -p_a n^a = N-weighted covariant energy */
  const obsEnergy = (r, kind = 'ph') => { const [x, y, z, px, py, pz] = r.s; return Math.sqrt(px * px + py * py + pz * pz) / m.B(x, y, z) / (kind === 'ph' ? 1 : 1); };
  sim.H = H; sim.rhs = rhs; sim.rk4 = rk4; sim.obsEnergy = obsEnergy;
  /** launch a photon at (x,y,z) heading along unit direction d (lab frame) */
  sim.photon = (x, y, z, d, tag = '') => { const n = Math.hypot(...d), B = m.B(x, y, z); const r = { kind: 'ph', s: [x, y, z, B * d[0] / n, B * d[1] / n, B * d[2] / n], tag, E0: 1, path: [[x, y]], alive: true }; r.E0 = obsEnergy(r); sim.rays.push(r); return r; };
  /** drop a test mass at rest relative to the local Eulerian observer (p_i = 0) */
  sim.drop = (x, y, z, tag = '') => { const r = { kind: 'ms', s: [x, y, z, 0, 0, 0], tag, path: [[x, y]], alive: true }; sim.dust.push(r); return r; };
  sim.step = dt => {
    m.xs += m.vs * dt;                                   // the bubble moves at vs while the lab frame stays put
    for (const r of sim.rays.concat(sim.dust)) {
      if (!r.alive) continue;
      r.s = rk4(r.kind, r.s, dt);
      if (!isFinite(r.s[0] + r.s[1] + r.s[3]) || Math.hypot(r.s[3], r.s[4], r.s[5]) > 1e14) { r.alive = false; r.piled = true; continue; }   // blue-shifted without bound against a horizon: stop integrating
      r.path.push([r.s[0], r.s[1]]); if (r.path.length > 600) r.path.shift();
    }
    sim.t += dt;
  };
  return sim;
}

/** A ship crossing a bubble: send a fan of photons from the bubble centre and from ahead; count which reach the front/rear. */
export function lightPlay(cfg, { n = 24, T } = {}) {
  const sim = createWarp(cfg), R = sim.m.R, vs = sim.m.vs;
  const rays = [];
  for (let i = 0; i < n; i++) { const a = 2 * PI * i / n; rays.push(sim.photon(0, 0, 0, [Math.cos(a), Math.sin(a), 0], 'ship')); }
  const horizon = horizons(sim.m), dt = Math.max(1e-4, sim.m.cfg.wall / 40 / Math.max(vs, 1));
  const steps = Math.ceil((T ?? 6 * R / Math.max(vs, 0.5)) / dt);
  for (let k = 0; k < Math.min(steps, 60000); k++) sim.step(dt);
  let forward = 0, back = 0, trapped = 0;
  for (const r of rays) { const dx = r.s[0] - sim.m.xs; if (Math.hypot(dx, r.s[1], r.s[2]) < 1.3 * (R + sim.m.cfg.wall)) trapped++; else if (dx > 0) forward++; else back++; }
  return { sim, forward, back, trapped, horizon, n };
}

/* ---------------- ship proper time ---------------- */
export function shipClock(m) { return m.N(m.xs, 0, 0); }   // d tau / dt at the bubble centre

/* ---------------- search: how much positive mass pays the bill? ---------------- */
/** scan the shell mass parameter mu; report the net energy density minimum and whether WEC/NEC hold */
export function scanShell(cfg, mus) {
  return mus.map(mu => { const m = makeModel({ ...cfg, model: 'shell', mu }); const e = energy(m, { extra: 3 }); const mass = 2 * mu * m.R; return { mu, ...e, massKg: mass * GEO_TO_KG, massSolar: mass * GEO_TO_KG / MSUN, rS: 2 * mass, clockRate: m.N(0, 0, 0) }; });
}

/** a simple coordinate-descent search over the free parameters minimising |E_neg| (the cost) */
export function optimize(cfg, { iters = 24, free = ['wall', 'alpha'], bounds = {} } = {}) {
  const b = { wall: [cfg.R * 0.05, cfg.R * 3], alpha: [0, 12], mu: [0, 0.9], ...bounds };
  let cur = { ...cfg }, best = Math.abs(energy(makeModel(cur)).Eneg), hist = [{ cfg: { ...cur }, cost: best }];
  let rate = 0.5;
  for (let it = 0; it < iters; it++) {
    let improved = false;
    for (const key of free) {
      for (const sgn of [-1, 1]) {
        const trial = { ...cur }; trial[key] = Math.min(b[key][1], Math.max(b[key][0], cur[key] * (1 + sgn * rate) + (cur[key] === 0 ? sgn * 0.1 : 0)));
        if (trial[key] === cur[key]) continue;
        const cost = Math.abs(energy(makeModel(trial)).Eneg);
        if (cost < best) { best = cost; cur = trial; improved = true; hist.push({ cfg: { ...cur }, cost }); }
      }
    }
    if (!improved) rate *= 0.5; if (rate < 0.01) break;
  }
  return { cfg: cur, cost: best, history: hist };
}
