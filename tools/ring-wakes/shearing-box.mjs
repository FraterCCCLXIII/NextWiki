// Shearing-box N-body of a planetary ring patch: self-gravity + inelastic collisions (Hill's equations).
// Lengths in particle radii, time in 1/Omega. Writes a shear-periodic-tileable density map of the
// self-gravity wakes to apps/web/public/kosmo/static/rings/wake_tile.json.
//   node tools/ring-wakes/shearing-box.mjs [out.json]
import { writeFileSync } from 'node:fs';
const TAU = 0.5, RH = 1.0;                       // optical depth, Hill-radius parameter r_h = R_Hill / (2 R_p)
const GM = 12 * RH ** 3;                         // G m_p in R_p^3 Omega^2
const lam = 4 * Math.PI ** 2 * TAU * GM / Math.PI;   // critical wavelength 4 pi^2 G sigma / kappa^2
const Lx = 1.5 * lam, Ly = 3 * Lx;               // Ly = 3 Lx makes snapshots at t = 2k exactly periodic
const N = Math.round(TAU * Lx * Ly / Math.PI);
const DT = 0.05, TEND = 64, EPS2 = 0.3 ** 2, SH = 1.5 * Lx;
let seed = 12345; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N), ax = new Float64Array(N), ay = new Float64Array(N);
for (let i = 0; i < N; i++) { x[i] = (rnd() - 0.5) * Lx; y[i] = (rnd() - 0.5) * Ly; vx[i] = gauss() * 1.5; vy[i] = -1.5 * x[i] + gauss() * 1.5; }
console.error(`N=${N} Lx=${Lx.toFixed(1)} Ly=${Ly.toFixed(1)} lambda_cr=${lam.toFixed(1)}`);
const wrapY = d => d - Ly * Math.round(d / Ly);
function forces(t) {
  const off = SH * t; ax.fill(0); ay.fill(0);
  for (let i = 0; i < N; i++) {
    const xi = x[i], yi = y[i]; let fx = 0, fy = 0;
    for (let j = i + 1; j < N; j++) {
      let dx = x[j] - xi, dy = y[j] - yi;
      if (dx > Lx / 2) { dx -= Lx; dy += off; } else if (dx < -Lx / 2) { dx += Lx; dy -= off; }
      dy = wrapY(dy);
      const r2 = dx * dx + dy * dy + EPS2, inv = GM / (r2 * Math.sqrt(r2));
      const gx = dx * inv, gy = dy * inv; fx += gx; fy += gy; ax[j] -= gx; ay[j] -= gy;
    }
    ax[i] += fx; ay[i] += fy;
  }
  for (let i = 0; i < N; i++) { ax[i] += 2 * vy[i] + 3 * x[i]; ay[i] += -2 * vx[i]; }
}
function boundaries(t) {
  const off = SH * t;
  for (let i = 0; i < N; i++) {
    if (x[i] > Lx / 2) { x[i] -= Lx; y[i] += off; vy[i] += SH; } else if (x[i] < -Lx / 2) { x[i] += Lx; y[i] -= off; vy[i] -= SH; }
    y[i] = wrapY(y[i]);
  }
}
function collide(t) {
  const off = SH * t, cs = 2.5, nx = Math.floor(Lx / cs), ny = Math.floor(Ly / cs), head = new Int32Array(nx * ny).fill(-1), next = new Int32Array(N);
  for (let i = 0; i < N; i++) { const cx = Math.min(nx - 1, Math.floor((x[i] + Lx / 2) / Lx * nx)), cy = Math.min(ny - 1, Math.floor((y[i] + Ly / 2) / Ly * ny)); next[i] = head[cy * nx + cx]; head[cy * nx + cx] = i; }
  for (let i = 0; i < N; i++) {
    const cx = Math.min(nx - 1, Math.floor((x[i] + Lx / 2) / Lx * nx)), cy = Math.min(ny - 1, Math.floor((y[i] + Ly / 2) / Ly * ny));
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      let gx = cx + a, gy = ((cy + b) % ny + ny) % ny, dxo = 0, dyo = 0, dvy = 0;
      if (gx < 0) { gx += nx; dxo = -Lx; dyo = off; dvy = SH; } else if (gx >= nx) { gx -= nx; dxo = Lx; dyo = -off; dvy = -SH; }
      for (let j = head[gy * nx + gx]; j >= 0; j = next[j]) {
        if (j <= i) continue;   // every pair is seen from both sides, in the box and across a boundary
        const dx = x[j] + dxo - x[i]; let dy = wrapY(y[j] + dyo - y[i]);
        const d2 = dx * dx + dy * dy; if (d2 >= 4 || d2 === 0) continue;
        const d = Math.sqrt(d2), nxh = dx / d, nyh = dy / d, rvx = vx[j] - vx[i], rvy = vy[j] + dvy - vy[i], vn = rvx * nxh + rvy * nyh;
        const ov = (2 - d) / 2; x[i] -= nxh * ov; y[i] -= nyh * ov; x[j] += nxh * ov; y[j] += nyh * ov;
        if (vn < 0) { const e = Math.min(0.9, Math.max(0.1, Math.pow(-vn / 0.4, -0.234))), jn = -(1 + e) * vn / 2; vx[i] -= jn * nxh; vy[i] -= jn * nyh; vx[j] += jn * nxh; vy[j] += jn * nyh; }
      }
    }
  }
}
let t = 0; forces(t);
const snaps = [];
for (let s = 0; t < TEND - 1e-9; s++) {
  for (let i = 0; i < N; i++) { vx[i] += 0.5 * DT * ax[i]; vy[i] += 0.5 * DT * ay[i]; x[i] += DT * vx[i]; y[i] += DT * vy[i]; }
  t += DT; boundaries(t); collide(t); boundaries(t); forces(t);
  for (let i = 0; i < N; i++) { vx[i] += 0.5 * DT * ax[i]; vy[i] += 0.5 * DT * ay[i]; }
  if (s % 100 === 0) { let c = 0; for (let i = 0; i < N; i++) c += vx[i] * vx[i] + (vy[i] + 1.5 * x[i]) ** 2; console.error(`t=${t.toFixed(1)} disp=${Math.sqrt(c / N / 2).toFixed(2)}`); }
}
// the snapshot at t = TEND (an even number: exactly shear-periodic) -> Gaussian-smoothed density on a periodic grid
const W = 96, H = 288, sig = 2.2, dens = new Float64Array(W * H);
for (let i = 0; i < N; i++) {
  const gx = (x[i] + Lx / 2) / Lx * W, gy = (y[i] + Ly / 2) / Ly * H, rx = Math.ceil(3 * sig * W / Lx), ry = Math.ceil(3 * sig * H / Ly);
  for (let a = -rx; a <= rx; a++) for (let b = -ry; b <= ry; b++) {
    const px = Math.floor(gx) + a, py = Math.floor(gy) + b, dxr = (px + 0.5 - gx) * Lx / W, dyr = (py + 0.5 - gy) * Ly / H;
    dens[((py % H + H) % H) * W + ((px % W + W) % W)] += Math.exp(-(dxr * dxr + dyr * dyr) / (2 * sig * sig));
  }
}
let mean = 0; for (const v of dens) mean += v; mean /= dens.length;
const u8 = new Uint8Array(W * H); let mx = 0; for (const v of dens) mx = Math.max(mx, v / mean);
for (let i = 0; i < dens.length; i++) u8[i] = Math.round(255 * Math.min(1, dens[i] / mean / mx));
const sd = Math.sqrt(dens.reduce((s, v) => s + (v / mean - 1) ** 2, 0) / dens.length);
const out = process.argv[2] || new URL('../../apps/web/public/kosmo/static/rings/wake_tile.json', import.meta.url).pathname;
writeFileSync(out, JSON.stringify({ W, H, lx_lambda: Lx / lam, ly_lambda: Ly / lam, tau: TAU, rh: RH, n: N, peak: mx, contrast: sd, data: Buffer.from(u8).toString('base64') }));
writeFileSync(out.replace(/\.json$/, '.pgm'), Buffer.concat([Buffer.from(`P5 ${W} ${H} 255\n`), Buffer.from(u8)]));
console.error(`wrote ${out}  contrast=${sd.toFixed(3)} peak=${mx.toFixed(2)}`);
