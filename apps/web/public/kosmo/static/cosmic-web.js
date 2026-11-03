// Cosmic web generator: a Gaussian random density field with a CDM power spectrum (BBKS transfer function), evolved with the Zel'dovich
// approximation. Particles drawn from it fall into the structures real surveys show: dense nodes (clusters), filaments, sheets and big voids.
// Pure maths, no DOM: it runs in the browser and in node (see tools/cosmic-web-study.mjs, which measures it against survey statistics).
//
// Units: box side L in Mpc/h, comoving. Defaults follow Planck-like numbers: Gamma = Omega_m h = 0.21, n_s = 0.96, sigma8 = 0.8.

function fft1(re, im, n, inv) {   // in-place radix-2 FFT of length n (a power of two)
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < h; j++) { const a = i + j, b = a + h, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export function fft3(re, im, N, inv) {   // 3D FFT of an N^3 grid stored x-fastest
  const r = new Float64Array(N), m = new Float64Array(N);
  for (let axis = 0; axis < 3; axis++) {
    const stride = axis === 0 ? 1 : axis === 1 ? N : N * N;
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const base = axis === 0 ? a * N + b * N * N : axis === 1 ? a + b * N * N : a + b * N;
      for (let i = 0; i < N; i++) { r[i] = re[base + i * stride]; m[i] = im[base + i * stride]; }
      fft1(r, m, N, inv);
      for (let i = 0; i < N; i++) { re[base + i * stride] = r[i]; im[base + i * stride] = m[i]; }
    }
  }
}

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// BBKS linear transfer function, k in h/Mpc
export function transferBBKS(k, gamma = 0.21) {
  const q = k / gamma; if (q < 1e-8) return 1;
  return Math.log(1 + 2.34 * q) / (2.34 * q) * Math.pow(1 + 3.89 * q + (16.1 * q) ** 2 + (5.46 * q) ** 3 + (6.71 * q) ** 4, -0.25);
}
const powerShape = (k, ns, gamma) => Math.pow(k, ns) * transferBBKS(k, gamma) ** 2;

// sigma(R) of the linear field for the shape above, normalised later to sigma8
function sigmaR(R, ns, gamma) {
  let s = 0; const lo = Math.log(1e-4), hi = Math.log(50), n = 800;
  for (let i = 0; i < n; i++) { const k = Math.exp(lo + (hi - lo) * (i + 0.5) / n), x = k * R, W = x < 1e-3 ? 1 : 3 * (Math.sin(x) - x * Math.cos(x)) / x ** 3; s += powerShape(k, ns, gamma) * W * W * k ** 3 * (hi - lo) / n; }
  return Math.sqrt(s / (2 * Math.PI ** 2));
}

/**
 * makeWeb({ N, L, seed, sigma8, smooth, D }) -> { N, L, delta (linear density, N^3), pos (Float32Array of 3 * N^3, Mpc/h, wrapped into [0, L)), density (cloud-in-cell-free: nearest-cell counts / mean) }
 * smooth: Gaussian smoothing length (Mpc/h) of the initial field, which stops the Zel'dovich map from shell-crossing into noise below the grid scale.
 * D: growth factor multiplier (1 = today). Larger D sharpens filaments into sheets and knots.
 */
export function makeWeb({ N = 64, L = 512, seed = 12345, sigma8 = 0.8, ns = 0.96, gamma = 0.21, smooth = 2.0, D = 1.0, bumps = [] } = {}) {
  const n3 = N * N * N, r = rng(seed), kf = 2 * Math.PI / L;
  const re = new Float64Array(n3), im = new Float64Array(n3);
  for (let i = 0; i < n3; i++) { re[i] = gauss(r); im[i] = 0; }
  fft3(re, im, N, false);   // white noise -> k space (Hermitian, so the inverse stays real)
  const sig8 = sigmaR(8, ns, gamma), amp = sigma8 / sig8;   // normalisation: sigma(8 Mpc/h) = sigma8
  const kk = i => (i <= N / 2 ? i : i - N) * kf;
  const dre = new Float64Array(n3), dim = new Float64Array(n3);
  // constrained seeds: extra overdensities (or voids) added to the initial field, e.g. a supercluster, a great wall, a void field. In the box (Mpc/h), amplitude in
  // units of linear delta, sigma in Mpc/h; kind 'blob' is a Gaussian ball, 'wall' a sheet normal to `axis` that fades over `extent` Mpc/h along the sheet.
  const Er = new Float64Array(n3), Ei = new Float64Array(n3);
  if (bumps.length) {
    const cellW = L / N, per = (d) => { d = Math.abs(d) % L; return d > L / 2 ? L - d : d; };
    for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0; const X = (x + 0.5) * cellW, Y = (y + 0.5) * cellW, Z = (z + 0.5) * cellW;
      for (const b of bumps) {
        const dx = per(X - b.pos[0]), dy = per(Y - b.pos[1]), dz = per(Z - b.pos[2]), sg = b.sigma;
        if (b.kind === 'wall') { const d = [dx, dy, dz], ax = b.axis || 0, t = d[ax], u = d.reduce((q, w, i) => i === ax ? q : q + w * w, 0), ext = b.extent || 150; v += b.amp * Math.exp(-0.5 * t * t / (sg * sg) - 0.5 * u / (ext * ext)); }
        else v += b.amp * Math.exp(-0.5 * (dx * dx + dy * dy + dz * dz) / (sg * sg));
      }
      Er[x + N * (y + N * z)] = v;
    }
    fft3(Er, Ei, N, false);
  }
  const px = [new Float64Array(n3), new Float64Array(n3)], py = [new Float64Array(n3), new Float64Array(n3)], pz = [new Float64Array(n3), new Float64Array(n3)];
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const idx = x + N * (y + N * z), kx = kk(x), ky = kk(y), kz = kk(z), k2 = kx * kx + ky * ky + kz * kz;
    if (k2 === 0) { dre[idx] = 0; dim[idx] = 0; continue; }
    const k = Math.sqrt(k2), P = powerShape(k, ns, gamma) * amp * amp, w = Math.exp(-0.5 * k2 * smooth * smooth);
    // delta(k) = noise(k) * sqrt(P(k) N^3 / L^3) in the DFT convention used here
    const f = Math.sqrt(P * n3 / (L * L * L)) * w, a = re[idx] * f + Er[idx] * w, b = im[idx] * f + Ei[idx] * w;
    dre[idx] = a; dim[idx] = b;
    // displacement psi(k) = i k delta(k) / k^2
    px[0][idx] = -kx * b / k2; px[1][idx] = kx * a / k2; py[0][idx] = -ky * b / k2; py[1][idx] = ky * a / k2; pz[0][idx] = -kz * b / k2; pz[1][idx] = kz * a / k2;
  }
  const delta = new Float64Array(dre), dI = new Float64Array(dim); fft3(delta, dI, N, true);
  fft3(px[0], px[1], N, true); fft3(py[0], py[1], N, true); fft3(pz[0], pz[1], N, true);
  const cell = L / N, pos = new Float32Array(n3 * 3), lat = new Float32Array(n3 * 3), psi = new Float32Array(n3 * 3), count = new Float32Array(n3), cellOf = new Int32Array(n3);
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = x + N * (y + N * z), wrap = v => ((v % L) + L) % L;
    lat[3 * i] = (x + 0.5) * cell; lat[3 * i + 1] = (y + 0.5) * cell; lat[3 * i + 2] = (z + 0.5) * cell; psi[3 * i] = px[0][i]; psi[3 * i + 1] = py[0][i]; psi[3 * i + 2] = pz[0][i];
    const X = wrap(lat[3 * i] + D * px[0][i]), Y = wrap(lat[3 * i + 1] + D * py[0][i]), Z = wrap(lat[3 * i + 2] + D * pz[0][i]);
    pos[3 * i] = X; pos[3 * i + 1] = Y; pos[3 * i + 2] = Z;
    const c = (Math.floor(X / cell) % N) + N * ((Math.floor(Y / cell) % N) + N * (Math.floor(Z / cell) % N)); cellOf[i] = c; count[c]++;
  }
  const rho = new Float32Array(n3); for (let i = 0; i < n3; i++) rho[i] = count[cellOf[i]];   // mass in the cell each particle ends up in (mean = 1)
  return { N, L, delta, pos, lat, psi, rho, count, sigma8, smooth, D };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Survey-style statistics, for comparing a point set in a periodic box against what galaxy surveys measure
// ---------------------------------------------------------------------------------------------------------------------------------
/** Count-in-cells on a g^3 grid: returns { var, skew, voidFrac (cells under 20% of the mean), emptyFrac, topCellShare (share of points in the densest 5% of cells) } */
export function cellStats(pos, L, g) {
  const n = pos.length / 3, c = new Float32Array(g ** 3), cell = L / g;
  for (let i = 0; i < n; i++) c[(Math.floor(pos[3 * i] / cell) % g) + g * ((Math.floor(pos[3 * i + 1] / cell) % g) + g * (Math.floor(pos[3 * i + 2] / cell) % g))]++;
  const mean = n / c.length; let v = 0, s3 = 0, voidC = 0, empty = 0;
  for (const x of c) { const d = x / mean - 1; v += d * d; s3 += d * d * d; if (x < 0.2 * mean) voidC++; if (x === 0) empty++; }
  v /= c.length; s3 /= c.length;
  const sorted = [...c].sort((a, b) => b - a), top = sorted.slice(0, Math.ceil(c.length * 0.05)).reduce((a, b) => a + b, 0) / n;
  return { var: v, sigma: Math.sqrt(v), skew: s3 / v ** 1.5, voidFrac: voidC / c.length, emptyFrac: empty / c.length, topCellShare: top };
}
/** Two-point correlation xi(r) in log bins by grid-accelerated pair counting on a random subset (periodic box). Returns [{ r, xi, pairs }]. */
export function twoPoint(pos, L, { sample = 40000, rMin = 1, rMax = 40, bins = 10, seed = 5 } = {}) {
  const r = rng(seed), n = pos.length / 3, m = Math.min(sample, n), pts = new Float32Array(m * 3);
  for (let i = 0; i < m; i++) { const j = Math.floor(r() * n); pts[3 * i] = pos[3 * j]; pts[3 * i + 1] = pos[3 * j + 1]; pts[3 * i + 2] = pos[3 * j + 2]; }
  const g = Math.max(4, Math.floor(L / rMax)), cell = L / g, grid = Array.from({ length: g ** 3 }, () => []);
  for (let i = 0; i < m; i++) grid[(Math.floor(pts[3 * i] / cell) % g) + g * ((Math.floor(pts[3 * i + 1] / cell) % g) + g * (Math.floor(pts[3 * i + 2] / cell) % g))].push(i);
  const edges = Array.from({ length: bins + 1 }, (_, i) => rMin * Math.pow(rMax / rMin, i / bins)), dd = new Float64Array(bins), half = L / 2, reach = Math.ceil(rMax / cell);
  const md = d => { d = Math.abs(d); return d > half ? L - d : d; };
  for (let cz = 0; cz < g; cz++) for (let cy = 0; cy < g; cy++) for (let cx = 0; cx < g; cx++) {
    const A = grid[cx + g * (cy + g * cz)]; if (!A.length) continue;
    for (let dz = -reach; dz <= reach; dz++) for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const B = grid[((cx + dx + g) % g) + g * (((cy + dy + g) % g) + g * ((cz + dz + g) % g))]; if (!B.length) continue;
      for (const a of A) for (const b of B) { if (b <= a) continue; const d = Math.hypot(md(pts[3 * a] - pts[3 * b]), md(pts[3 * a + 1] - pts[3 * b + 1]), md(pts[3 * a + 2] - pts[3 * b + 2])); if (d < rMin || d >= rMax) continue; let k = Math.floor(Math.log(d / rMin) / Math.log(rMax / rMin) * bins); if (k >= 0 && k < bins) dd[k]++; }
    }
  }
  const out = [], dens = m / L ** 3;
  for (let k = 0; k < bins; k++) { const r0 = edges[k], r1 = edges[k + 1], shell = 4 / 3 * Math.PI * (r1 ** 3 - r0 ** 3), expect = m * dens * shell / 2; out.push({ r: Math.sqrt(r0 * r1), xi: dd[k] / expect - 1, pairs: dd[k] }); }
  return out;
}
/** Log-log slope of xi(r) over the bins with xi > 0 */
export function xiSlope(xi) {
  const p = xi.filter(b => b.xi > 0); if (p.length < 3) return NaN;
  const lx = p.map(b => Math.log(b.r)), ly = p.map(b => Math.log(b.xi)), mx = lx.reduce((a, b) => a + b) / p.length, my = ly.reduce((a, b) => a + b) / p.length;
  let num = 0, den = 0; for (let i = 0; i < p.length; i++) { num += (lx[i] - mx) * (ly[i] - my); den += (lx[i] - mx) ** 2; } return num / den;
}

/**
 * A cloud of n points that samples the web out to radius R (Mpc/h) by tiling the periodic box, each tile turned by its own random axis permutation / mirror
 * so the repeats do not line up. Mass-weighted (every particle has the same mass), so dense nodes and filaments get more points and voids stay empty.
 * Beyond ~300 Mpc/h real structure is nearly homogeneous, and so is this: only the texture inside a tile survives at the largest scales.
 * Returns { n, tile (Int32 x3), perm (Uint8 per point: 0..47), idx (Int32 particle), eval(D, pos, col) }.
 */
export function makeTiledCloud(web, { n = 150000, R = 1000, seed = 99, observer = null, bias = 0 } = {}) {
  const r = rng(seed), L = web.L, n3 = web.N ** 3, tiles = Math.ceil(R / L) + 1;
  const org = new Float32Array(n * 3), perm = new Uint8Array(n), idx = new Int32Array(n);
  const off = observer || [L / 2, L / 2, L / 2];   // the Sun sits at this place inside the home tile
  let i = 0, guard = 0;
  const permOf = (tx, ty, tz) => { let h = (tx * 73856093) ^ (ty * 19349663) ^ (tz * 83492791); h = Math.abs(h) % 48; return h; };
  while (i < n && guard++ < n * 400) {
    const tx = Math.floor(r() * (2 * tiles + 1)) - tiles, ty = Math.floor(r() * (2 * tiles + 1)) - tiles, tz = Math.floor(r() * (2 * tiles + 1)) - tiles, j = Math.floor(r() * n3), pm = permOf(tx, ty, tz);
    if (bias > 0 && r() > Math.min(1, Math.pow(Math.max(web.rho[j], 0.02), bias) / 4)) continue;   // galaxies trace mass with a bias: thin the voids, keep the nodes
    const p = permuted(web, j, pm, 1, L), X = tx * L + p[0] - off[0], Y = ty * L + p[1] - off[1], Z = tz * L + p[2] - off[2];
    if (X * X + Y * Y + Z * Z > R * R) continue;
    org[3 * i] = tx * L - off[0]; org[3 * i + 1] = ty * L - off[1]; org[3 * i + 2] = tz * L - off[2]; perm[i] = pm; idx[i] = j; i++;
  }
  const m = i;
  return {
    n: m, R, L, org, perm, idx,
    /** write positions (Mpc/h about the observer) for growth factor D (1 = today) into out; colours from the static density into col */
    eval(D, out, col, lo = 0, hi = m) {
      for (let k = lo; k < hi; k++) {
        const p = permuted(web, idx[k], perm[k], D, L);
        out[3 * k] = org[3 * k] + p[0]; out[3 * k + 1] = org[3 * k + 1] + p[1]; out[3 * k + 2] = org[3 * k + 2] + p[2];
        if (col) { const d = Math.log10(Math.max(0.05, web.rho[idx[k]])) / 1.6 + 0.35, w = d < 0 ? 0 : d > 1 ? 1 : d; col[3 * k] = 0.45 + 0.55 * w; col[3 * k + 1] = 0.55 + 0.3 * w * (1 - 0.3 * w); col[3 * k + 2] = 1 - 0.6 * w; }
      }
    },
  };
}
const _pp = [0, 0, 0];
function permuted(web, j, pm, D, L) {   // particle j at growth D, turned by orientation pm (0..47: 6 axis orders x 8 mirrors) inside its tile
  let x = web.lat[3 * j] + D * web.psi[3 * j], y = web.lat[3 * j + 1] + D * web.psi[3 * j + 1], z = web.lat[3 * j + 2] + D * web.psi[3 * j + 2];
  x = ((x % L) + L) % L; y = ((y % L) + L) % L; z = ((z % L) + L) % L;
  const ax = [x, y, z], order = ORDERS[pm % 6], mir = pm >> 3 & 7;
  _pp[0] = ax[order[0]]; _pp[1] = ax[order[1]]; _pp[2] = ax[order[2]];
  if (mir & 1) _pp[0] = L - _pp[0]; if (mir & 2) _pp[1] = L - _pp[1]; if (mir & 4) _pp[2] = L - _pp[2];
  return _pp;
}
const ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
