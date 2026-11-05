// Settlement simulation: stars on epicyclic galactic orbits carry settlements; colonies launch probes to
// nearby settleable stars within range. Units: pc, Myr. Frame: galactocentric, Sol at (8200, 0, 20).
// Stars follow analytic orbits (differential rotation + radial/vertical epicycles), refreshed every POS_EVERY Myr.

export const PC_PER_LY = 0.3066;
export const C_PC_MYR = 306.6;
export const SOL = { x: 8200, y: 0, z: 20 };
const KMS = 1.0227; // pc/Myr per km/s
const POS_EVERY = 0.5; // Myr between position + spatial-hash refreshes

export const TECH_PRESETS = {
  "slow-ark": { probeSpeedC: 0.001, rangeLy: 10, launchIntervalYr: 5000, lifetimeYr: 1e6 },
  "fusion-sleeper": { probeSpeedC: 0.05, rangeLy: 20, launchIntervalYr: 2000, lifetimeYr: 1e7 },
  "von-neumann": { probeSpeedC: 0.1, rangeLy: 50, launchIntervalYr: 500, lifetimeYr: 1e8 },
  starshot: { probeSpeedC: 0.2, rangeLy: 15, launchIntervalYr: 1000, lifetimeYr: 1e7 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// equatorial J2000 -> galactic (X toward GC, Y toward rotation, Z toward NGP)
const EQ2GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];

function catalogToGalactocentric(s) {
  const d = s.dist_pc, ra = (s.ra_deg * Math.PI) / 180, dec = (s.dec_deg * Math.PI) / 180;
  const e = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const g = EQ2GAL.map((r) => (r[0] * e[0] + r[1] * e[1] + r[2] * e[2]) * d);
  return [SOL.x - g[0], g[1], SOL.z + g[2]];
}

export function generateGalaxy({ n = 20000, seed = 1, catalogStars = [] } = {}) {
  const rng = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rng() + 1e-12)) * Math.cos(2 * Math.PI * rng());
  const cat = catalogStars.filter(
    (s) => s && s.name !== "Sun" && typeof s.dist_pc === "number" && s.dist_pc > 0 && s.dist_pc < 5000 &&
      typeof s.ra_deg === "number" && typeof s.dec_deg === "number",
  );
  const count = n + cat.length + 1;
  const X = new Float32Array(count), Y = new Float32Array(count), Z = new Float32Array(count);
  const VX = new Float32Array(count), VY = new Float32Array(count), VZ = new Float32Array(count);
  const synthetic = new Uint8Array(count), haloFlag = new Uint8Array(count);
  const catalogIndex = new Int32Array(count).fill(-1);
  // orbit params
  const R0 = new Float32Array(count), TH0 = new Float32Array(count), OM = new Float32Array(count);
  const AR = new Float32Array(count), PR = new Float32Array(count), AZ = new Float32Array(count), PZ = new Float32Array(count);

  const place = (i, x, y, z, comp) => {
    const R = Math.hypot(x, y);
    const vc = 220 * KMS; // flat rotation curve
    let om = R > 50 ? vc / R : vc / 50;
    if (comp === 2) om *= rng() < 0.5 ? -0.5 : 0.5; // halo: slow, mixed sense
    if (comp === 1) om *= 0.8 + 0.4 * rng();
    const sigma = comp === 0 ? 15 * KMS : comp === 1 ? 60 * KMS : 100 * KMS;
    const ar = Math.abs(gauss()) * sigma / 0.04, pr = rng() * 2 * Math.PI;
    const az = Math.abs(z) + Math.abs(gauss()) * sigma / 0.08 * 0.5 + 1e-3;
    R0[i] = R - ar * Math.sin(pr); TH0[i] = Math.atan2(y, x); OM[i] = om;
    AR[i] = ar; PR[i] = pr; AZ[i] = az; PZ[i] = Math.asin(Math.max(-1, Math.min(1, z / az)));
    X[i] = x; Y[i] = y; Z[i] = z;
    VX[i] = -om * y; VY[i] = om * x; VZ[i] = 0;
  };

  let i = 0;
  place(i, SOL.x, SOL.y, SOL.z, 0); synthetic[i] = 1; const solIndex = i; i++;
  for (let k = 0; k < n; k++, i++) {
    const u = rng();
    let x, y, z, comp = 0;
    if (u < 0.03) { // halo
      comp = 2; haloFlag[i] = 1;
      const r = 1500 + rng() * 18000, ct = 2 * rng() - 1, ph = rng() * 2 * Math.PI, st = Math.sqrt(1 - ct * ct);
      x = r * st * Math.cos(ph); y = r * st * Math.sin(ph); z = r * ct;
    } else if (u < 0.11) { // bulge
      comp = 1; x = gauss() * 800; y = gauss() * 800; z = gauss() * 600;
    } else { // thin+thick disc
      const R = Math.min(16000, -2600 * (Math.log(rng() + 1e-9) + Math.log(rng() + 1e-9))), ph = rng() * 2 * Math.PI;
      x = R * Math.cos(ph); y = R * Math.sin(ph); z = (rng() < 0.5 ? -1 : 1) * -300 * Math.log(rng() + 1e-9);
    }
    place(i, x, y, z, comp); synthetic[i] = 1;
  }
  for (let k = 0; k < cat.length; k++, i++) {
    const [x, y, z] = catalogToGalactocentric(cat[k]);
    place(i, x, y, z, 0); catalogIndex[i] = catalogStars.indexOf(cat[k]);
  }
  return { count, x: X, y: Y, z: Z, vx: VX, vy: VY, vz: VZ, synthetic, haloFlag, catalogIndex, solIndex,
    orbit: { R0, TH0, OM, AR, PR, AZ, PZ }, seed };
}

const DEFAULTS = {
  probeSpeedC: 0.1, rangeLy: 50, launchIntervalYr: 500, lifetimeYr: 1e8, settleableFraction: 0.1,
  seed: 1, policy: "nearest", score: null, dtMyr: 0.1,
};

export function createSim(galaxy, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const n = galaxy.count, o = galaxy.orbit, rng = mulberry32(p.seed * 7919 + 13);
  const origin = p.originIndex != null ? p.originIndex : galaxy.solIndex;
  const x = Float32Array.from(galaxy.x), y = Float32Array.from(galaxy.y), z = Float32Array.from(galaxy.z);
  const settleable = new Uint8Array(n);
  let meanScore = 1;
  if (p.score) { let s = 0; for (let k = 0; k < n; k++) s += p.score[k]; meanScore = s / n || 1; }
  for (let k = 0; k < n; k++) {
    const prob = p.score ? Math.min(1, (p.settleableFraction * p.score[k]) / meanScore) : p.settleableFraction;
    settleable[k] = rng() < prob ? 1 : 0;
  }
  settleable[origin] = 1; settleable[galaxy.solIndex] = 1; // we exist, so Sol is settleable
  const settledAt = new Float32Array(n).fill(-1), parent = new Int32Array(n).fill(-1), gen = new Uint16Array(n);
  const alive = new Uint8Array(n), targeted = new Uint8Array(n);
  const expiry = new Float64Array(n), nextLaunch = new Float64Array(n);
  const aliveList = [];
  const ships = [];
  // N sim stars stand in for ~2e11 real ones, so physical hop lengths are scaled up by the sample spacing.
  const scale = p.densityScale != null ? p.densityScale : Math.cbrt(2e11 / n);
  const rangePc = Math.max(p.rangeLy * PC_PER_LY * scale, 0.1), r2 = rangePc * rangePc;
  const speed = Math.max(p.probeSpeedC * C_PC_MYR, 1e-6);
  const intervalMyr = Math.max(p.launchIntervalYr / 1e6, 1e-6), lifeMyr = p.lifetimeYr / 1e6;
  const cell = rangePc, inv = 1 / cell;
  const HB = 1 << 17, mask = HB - 1;
  const head = new Int32Array(HB), next = new Int32Array(n);

  const sim = { params: p, galaxy, x, y, z, settleable, settledAt, parent, gen, alive, ships, time: 0, origin, rangePc, scale };
  const hkey = (ix, iy, iz) => ((Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & mask);

  function updatePositions(t) {
    for (let k = 0; k < n; k++) {
      const R = o.R0[k] + o.AR[k] * Math.sin(0.04 * t + o.PR[k]);
      const th = o.TH0[k] + o.OM[k] * t;
      x[k] = R * Math.cos(th); y[k] = R * Math.sin(th);
      z[k] = o.AZ[k] * Math.sin(0.08 * t + o.PZ[k]);
    }
    head.fill(-1);
    for (let k = 0; k < n; k++) {
      if (!settleable[k] || settledAt[k] >= 0) continue;
      const h = hkey(Math.floor(x[k] * inv), Math.floor(y[k] * inv), Math.floor(z[k] * inv));
      next[k] = head[h]; head[h] = k;
    }
  }

  function candidates(i, out) {
    out.length = 0;
    const cx = Math.floor(x[i] * inv), cy = Math.floor(y[i] * inv), cz = Math.floor(z[i] * inv);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (let j = head[hkey(cx + a, cy + b, cz + c)]; j >= 0; j = next[j]) {
        if (settledAt[j] >= 0 || targeted[j] || j === i) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i];
        if (dx * dx + dy * dy + dz * dz <= r2) out.push(j);
      }
    }
    return out;
  }

  function settle(j, from, t) {
    settledAt[j] = t; parent[j] = from; gen[j] = from >= 0 ? gen[from] + 1 : 0;
    alive[j] = 1; expiry[j] = t + lifeMyr; nextLaunch[j] = t + intervalMyr; aliveList.push(j);
  }

  const cand = [];
  let nextPos = 0;
  function pickTarget(i) {
    candidates(i, cand);
    if (!cand.length) return -1;
    if (typeof p.policy === "function") return p.policy(sim, i, cand);
    let best = -1, bv = -Infinity;
    for (const j of cand) {
      const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const v = p.policy === "best" && p.score ? p.score[j] / (1 + d) : -d;
      if (v > bv) { bv = v; best = j; }
    }
    return best;
  }

  sim.step = function (dt = p.dtMyr) {
    const t1 = sim.time + dt;
    if (t1 >= nextPos) { updatePositions(t1); nextPos = t1 + POS_EVERY; }
    for (let k = ships.length - 1; k >= 0; k--) { // land ships
      const s = ships[k];
      if (s.tArrive <= t1) {
        ships[k] = ships[ships.length - 1]; ships.pop();
        targeted[s.to] = 0;
        if (settleable[s.to] && settledAt[s.to] < 0) settle(s.to, s.from, s.tArrive);
      }
    }
    for (let k = aliveList.length - 1; k >= 0; k--) { // expire colonies
      const i = aliveList[k];
      if (t1 >= expiry[i]) { alive[i] = 0; aliveList[k] = aliveList[aliveList.length - 1]; aliveList.pop(); }
    }
    for (let k = 0, m = aliveList.length; k < m; k++) { // launch
      const i = aliveList[k];
      let guard = 0;
      while (nextLaunch[i] <= t1 && guard++ < 2) {
        const j = pickTarget(i);
        if (j < 0) { nextLaunch[i] = t1 + Math.min(intervalMyr, POS_EVERY); break; }
        const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        targeted[j] = 1;
        ships.push({ from: i, to: j, tLaunch: t1, tArrive: t1 + d / scale / speed });
        nextLaunch[i] += intervalMyr;
        if (nextLaunch[i] < t1 - intervalMyr) nextLaunch[i] = t1;
      }
    }
    sim.time = t1;
  };

  sim.run = function (untilMyr, stopFn) {
    const dt = p.dtMyr;
    while (sim.time < untilMyr) {
      sim.step(dt);
      if (!aliveList.length && !ships.length) break;
      if (stopFn && stopFn(sim)) break;
    }
  };

  sim.stats = function () {
    let settledCount = 0; const dists = [];
    for (let k = 0; k < n; k++) if (settledAt[k] >= 0) {
      settledCount++;
      dists.push(Math.hypot(x[k] - x[origin], y[k] - y[origin], z[k] - z[origin]));
    }
    dists.sort((a, b) => a - b);
    const frontier = dists.length ? dists[Math.floor(0.9 * (dists.length - 1))] : 0;
    let settleableCount = 0; for (let k = 0; k < n; k++) settleableCount += settleable[k];
    return { time: sim.time, settledCount, aliveCount: aliveList.length, shipsInFlight: ships.length,
      settleableCount, fractionSettled: settledCount / Math.max(1, settleableCount), frontierRadiusPc: frontier,
      solSettled: settledAt[galaxy.solIndex] >= 0 };
  };

  updatePositions(0); nextPos = POS_EVERY;
  settle(origin, -1, 0);
  return sim;
}

/** P(Sol stays unsettled) over a 2-knob grid, Fermi mode (random settleable non-Sol origin per seed). */
export function factA(galaxy, baseParams, xKey, xVals, yKey, yVals, seeds = 3, untilMyr = 500, onCell) {
  const p = yVals.map(() => xVals.map(() => 0));
  for (let yi = 0; yi < yVals.length; yi++) for (let xi = 0; xi < xVals.length; xi++) {
    let unsettled = 0;
    for (let s = 0; s < seeds; s++) {
      const rng = mulberry32((s + 1) * 1315423911);
      let origin; do { origin = Math.floor(rng() * galaxy.count); } while (origin === galaxy.solIndex);
      const sim = createSim(galaxy, { ...baseParams, [xKey]: xVals[xi], [yKey]: yVals[yi], seed: s + 1, originIndex: origin });
      sim.run(untilMyr, (m) => m.settledAt[galaxy.solIndex] >= 0);
      if (sim.settledAt[galaxy.solIndex] < 0) unsettled++;
    }
    p[yi][xi] = unsettled / seeds;
    if (onCell) onCell(xi, yi, p[yi][xi]);
  }
  return { xKey, yKey, xVals, yVals, p };
}
