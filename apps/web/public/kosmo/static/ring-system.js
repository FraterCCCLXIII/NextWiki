// ring-system.js — physically structured planetary rings for kosmo-models.js (vanilla three.js, WebGL2).
//
// Three tiers, chosen by camera distance:
//   far   a ring disc shaded per pixel from a radial profile (optical depth, albedo, colour, dust) with single-scattering
//         lighting (lit / unlit side, forward-scatter, opposition surge), the planet's shadow on the rings, the ring shadow on
//         the planet, density waves at computed Lindblad resonances, moon-driven gap-edge waves, Neptune's arcs, and the
//         view-dependent brightness of self-gravity wakes.
//   near  instanced particles, one set per octave of the size distribution (1 cm .. 13 m, n(s) ~ s^-3), generated in the
//         vertex shader from a hash of absolute (shell, index): nothing is stored. Each shell orbits at its own Kepler
//         rate (J2-corrected), so the ring shears. Thinned by tau(r, theta) including the waves, and by a self-gravity-wake
//         density tile baked from a shearing-box N-body run (tools/ring-wakes/shearing-box.mjs).
//   shell a thin sphere that darkens the planet where the rings shade it.
//
// The ring profiles are hand-encoded from published region values (Cassini / Voyager occultation results), not raw PDS
// profiles: radii, gaps and ringlets are real, the fine radial texture between them is seeded noise. Wave amplitudes are
// schematic; their radii and winding follow from the resonance condition m(Omega - n) = kappa and the density-wave dispersion.
const G = 6.6743e-11, TAU2 = Math.PI * 2, DAY = 86400;
const NC = 10, S0 = 0.0125, J = 1024, KPER = 24, NW = 16, NE = 4, NA = 6;   // classes, smallest radius (m), shells, per shell, slots

// ---------------------------------------------------------------------------------------------------
// data (km from the planet's centre)
// ---------------------------------------------------------------------------------------------------
const C = (r, g, b) => { const m = Math.max(r, g, b); return [r / m, g / m, b / m]; };
const ICE = C(0.82, 0.78, 0.72), DUST = C(0.8, 0.8, 0.85), DARK = C(0.5, 0.48, 0.46);
const SYSTEMS = {
  saturn: {
    Req: 60268, GM: 3.7931208e16, J2: 0.016298, rIn: 66900, rOut: 175000, wakes: [[122050, 136774], [92000, 117500]],
    bands: [
      { a: 66900, b: 74510, tau: 0.012, w: 0.3, col: DARK, rough: 0.5, edge: 300 },                         // D
      { a: 74658, b: 91975, tau: 0.095, w: 0.3, col: C(0.55, 0.5, 0.45), rough: 0.55, edge: 60 },            // C
      { a: 91975, b: 98000, tau: 0.8, w: 0.62, col: C(0.8, 0.66, 0.5), rough: 0.4, edge: 25 },               // inner B
      { a: 98000, b: 110000, tau: 3.2, w: 0.7, col: C(0.9, 0.76, 0.58), rough: 0.28, edge: 250 },            // B core
      { a: 110000, b: 117507, tau: 1.7, w: 0.66, col: C(0.87, 0.74, 0.58), rough: 0.3, edge: 300 },          // outer B (Mimas 2:1 edge)
      { a: 117507, b: 122050, tau: 0.11, w: 0.32, col: C(0.52, 0.45, 0.4), rough: 0.5, edge: 20 },           // Cassini Division
      { a: 122050, b: 136774, tau: 0.55, w: 0.58, col: ICE, rough: 0.18, edge: 20 },                         // A
      { a: 136774, b: 139380, tau: 0.002, w: 0.4, col: DUST, dust: 1, edge: 100 },                           // Roche Division
      { a: 166000, b: 175000, tau: 3e-5, w: 0.5, col: DUST, dust: 1, edge: 800 },                            // G
    ],
    ringlets: [
      { c: 140180, w: 30, tau: 0.7, gauss: 1, wv: 0.55, col: ICE }, { c: 140180, w: 700, tau: 0.005, gauss: 1, wv: 0.5, col: DUST, dust: 1 },   // F
      { c: 87510, w: 64, tau: 0.3, col: DARK }, { c: 77870, w: 25, tau: 0.22, col: DARK }, { c: 88700, w: 10, tau: 0.2, col: DARK },        // Maxwell, Titan, Bond
      { c: 117850, w: 18, tau: 0.5, col: DARK }, { c: 119970, w: 120, tau: 0.16, col: DARK },                                              // Huygens, Laplace
    ],
    gaps: [
      { c: 133584, w: 322, tau: 0.03 }, { c: 136506, w: 34, tau: 0.01 },                                     // Encke (Pan), Keeler (Daphnis)
      { c: 117680, w: 400, tau: 0.03 }, { c: 118234, w: 10, tau: 0.01 }, { c: 118630, w: 33, tau: 0.01 }, { c: 118969, w: 38, tau: 0.01 },
      { c: 119967, w: 238, tau: 0.04 }, { c: 120241, w: 10, tau: 0.01 }, { c: 120312, w: 13, tau: 0.01 },
      { c: 77870, w: 150, tau: 0.03 }, { c: 87491, w: 270, tau: 0.03 }, { c: 90200, w: 20, tau: 0.02 },
    ],
    // moons that drive resonance waves: period (days), mass (kg)
    moons: [['Mimas', 0.9424218, 3.7493e19], ['Janus', 0.69466, 1.8975e18], ['Epimetheus', 0.694333, 5.266e17], ['Prometheus', 0.61299, 1.5974e17], ['Pandora', 0.628504, 1.3712e17], ['Atlas', 0.60169, 6.6e15]],
    // gap-edge waves: moon period, edges (km), moon semi-major axis (km), amplitude (km), window (km)
    edges: [{ P: 0.57505, a: 133584, edges: [133423, 133745], amp: 2.5, win: 45 }, { P: 0.59408, a: 136505, edges: [136489, 136523], amp: 1.6, win: 5 }],
    Msat: 5.6834e26, dustBoost: 60,
  },
  uranus: {
    Req: 25559, GM: 5.793939e15, J2: 0.003343, rIn: 37000, rOut: 52000, Msat: 8.681e25, dustBoost: 40,
    bands: [{ a: 37000, b: 39500, tau: 4e-4, w: 0.1, col: DUST, dust: 1, edge: 300 }],
    ringlets: [[41837, 1.5, 0.3], [42235, 2, 0.5], [42571, 2.4, 0.3], [44718, 7.5, 0.7], [45661, 7, 0.5], [47176, 1.5, 0.3], [47627, 3.6, 1.3], [48300, 4.4, 0.7], [50024, 2, 0.1], [51149, 40, 2.0]]
      .map(([c, w, tau]) => ({ c, w, tau, wv: 0.08, col: C(0.45, 0.45, 0.47) })), gaps: [], moons: [], edges: [],
  },
  neptune: {
    Req: 24764, GM: 6.836529e15, J2: 0.003411, rIn: 40000, rOut: 64500, Msat: 1.02413e26, dustBoost: 40,
    bands: [{ a: 40900, b: 42900, tau: 1e-4, w: 0.1, col: DUST, dust: 1, edge: 300 }, { a: 53200, b: 57200, tau: 6e-4, w: 0.1, col: DUST, dust: 1, edge: 400 }],
    ringlets: [{ c: 53200, w: 113, tau: 0.012, wv: 0.08, col: DARK }, { c: 57200, w: 100, tau: 0.008, wv: 0.08, col: DARK },
      { c: 62933, w: 35, tau: 0.12, wv: 0.08, col: C(0.5, 0.45, 0.45), arc: 1 }],
    gaps: [], moons: [], edges: [],
    // Adams ring arcs (approximate longitudes, degrees, relative to the leading arc) held by Galatea's 42:43 resonance
    arcs: { n: 820.1118 * Math.PI / 180 / DAY, list: [[0, 6, 1], [14, 3.5, 0.8], [22, 2.5, 0.8], [31, 2.5, 0.9], [41, 3, 0.7]] },
  },
  jupiter: {
    Req: 71492, GM: 1.26686534e17, J2: 0.014736, rIn: 92000, rOut: 226000, Msat: 1.8982e27, dustBoost: 80,
    bands: [{ a: 92000, b: 122500, tau: 1e-6, w: 0.05, col: DUST, dust: 1, edge: 3000 }, { a: 122500, b: 129000, tau: 5e-6, w: 0.05, col: DARK, dust: 1, edge: 300 },
      { a: 129000, b: 182000, tau: 1e-7, w: 0.05, col: DUST, dust: 1, edge: 2000 }, { a: 129000, b: 226000, tau: 1e-7, w: 0.05, col: DUST, dust: 1, edge: 4000 }],
    ringlets: [], gaps: [], moons: [], edges: [],
  },
};
export const ringSystemKey = name => { const k = String(name || '').toLowerCase(); return SYSTEMS[k] ? k : null; };
function genericSystem(spec, seed) {   // exoplanet rings: a dense band with a gap, from the name's seed
  const R = (spec.radius_m || 7e7) / 1000, r = n => { seed = (Math.imul(seed ^ n, 2654435761) >>> 0); return seed / 4294967296; };
  const a = R * (1.25 + 0.3 * r(1)), b = a + R * (0.6 + 0.8 * r(2)), gc = a + (b - a) * (0.35 + 0.3 * r(3));
  const GM = spec.mass_kg ? G * spec.mass_kg : 1e17;
  return { Req: R, GM, J2: 0.01, rIn: a * 0.97, rOut: b * 1.03, Msat: spec.mass_kg || 1e27, dustBoost: 30, moons: [], edges: [], gaps: [{ c: gc, w: (b - a) * 0.06, tau: 0.02 }],
    bands: [{ a, b, tau: 0.4 + 0.8 * r(4), w: 0.55, col: C(0.8 + 0.1 * r(5), 0.7, 0.6 - 0.2 * r(6)), rough: 0.35, edge: (b - a) * 0.03 }], ringlets: [] };
}

// ---------------------------------------------------------------------------------------------------
// numerics: profile table, resonances
// ---------------------------------------------------------------------------------------------------
const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
function noise1(seed) {
  const tab = new Float32Array(4096); let s = seed >>> 0; for (let i = 0; i < tab.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; tab[i] = s / 2147483648 - 1; }
  const at = x => { const i = Math.floor(x), f = x - i, a = tab[((i % 4096) + 4096) % 4096], b = tab[(((i + 1) % 4096) + 4096) % 4096]; return a + (b - a) * sm(f); };
  return r => 0.5 * at(r / 37) + 0.3 * at(r / 110 + 11) + 0.22 * at(r / 340 + 23) + 0.15 * at(r / 900 + 41);
}
function buildProfile(THREE, sys, seed) {
  const N = 8192, r0 = sys.rIn - 800, r1 = sys.rOut + 800, fn = noise1(seed), H = THREE.DataUtils.toHalfFloat;
  const taus = new Float32Array(N), VW = new Float32Array(N), DW = new Float32Array(N), CR = new Float32Array(N), CG = new Float32Array(N), CB = new Float32Array(N), AR = new Float32Array(N);
  const box = (r, a, b, e) => sm((r - a) / e + 0.5) * (1 - sm((r - b) / e + 0.5));
  for (let i = 0; i < N; i++) {
    const r = r0 + (r1 - r0) * i / (N - 1); let tau = 0, vw = 0, dw = 0, cr = 0, cg = 0, cb = 0, arc = 0;
    const add = (t, w, dust, col, isArc) => { if (t <= 0) return; tau += t; vw += t * w; dw += t * (dust ? 1 : 0); cr += t * col[0]; cg += t * col[1]; cb += t * col[2]; if (isArc) arc = 1; };
    for (const b of sys.bands) { const m = box(r, b.a, b.b, b.edge || 20); if (m > 0) add(b.tau * m * Math.max(0.1, 1 + (b.rough || 0) * fn(r) * 2), b.w, b.dust, b.col); }
    // gaps thin the BANDS (and the material weights with them); ringlets are added afterwards, so a ringlet can live inside a gap
    for (const g of sys.gaps) {
      const m = box(r, g.c - g.w / 2, g.c + g.w / 2, Math.max(2, g.w * 0.05));
      if (m > 0 && tau > 0) { const t1 = Math.max(tau * (1 - m) + g.tau * m, 0), f = t1 / tau; tau = t1; vw *= f; dw *= f; cr *= f; cg *= f; cb *= f; }
    }
    for (const l of sys.ringlets) {
      const m = l.gauss ? Math.exp(-0.5 * ((r - l.c) / (l.w / 2.355)) ** 2) : box(r, l.c - l.w / 2, l.c + l.w / 2, Math.max(1, l.w * 0.1));
      if (m > 0.002) add(l.tau * m, l.wv ?? 0.4, l.dust, l.col, l.arc);
    }
    taus[i] = tau; const k = tau > 0 ? 1 / tau : 0;
    const w = tau > 0 ? vw * k : 0.4, d = tau > 0 ? dw * k : 0;
    VW[i] = w; DW[i] = d; CR[i] = tau > 0 ? cr * k : 0.8; CG[i] = tau > 0 ? cg * k : 0.8; CB[i] = tau > 0 ? cb * k : 0.8; AR[i] = arc;
  }
  // mip chain built by hand: a pixel covering many texels sees the MEAN optical depth (not the mean of its logarithm), weighted colour, widest arc mask
  const levelsA = [], levelsC = []; let T = taus, V = VW, D = DW, R = CR, Gc = CG, B = CB, Ar = AR, n = N;
  for (;;) {
    const a = new Uint16Array(n * 4), c = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) { a[4 * i] = H(Math.log10(Math.max(T[i], 1e-9))); a[4 * i + 1] = H(V[i]); a[4 * i + 2] = H(D[i]); c[4 * i] = H(R[i]); c[4 * i + 1] = H(Gc[i]); c[4 * i + 2] = H(B[i]); c[4 * i + 3] = H(Ar[i]); }
    levelsA.push({ data: a, width: n, height: 1 }); levelsC.push({ data: c, width: n, height: 1 });
    if (n === 1) break; const m = n >> 1, T2 = new Float32Array(m), V2 = new Float32Array(m), D2 = new Float32Array(m), R2 = new Float32Array(m), G2 = new Float32Array(m), B2 = new Float32Array(m), A2 = new Float32Array(m);
    for (let i = 0; i < m; i++) {
      const t0 = T[2 * i], t1 = T[2 * i + 1], ts = t0 + t1, w0 = ts > 0 ? t0 / ts : 0.5, w1 = 1 - w0;
      T2[i] = ts / 2; V2[i] = V[2 * i] * w0 + V[2 * i + 1] * w1; D2[i] = D[2 * i] * w0 + D[2 * i + 1] * w1; R2[i] = R[2 * i] * w0 + R[2 * i + 1] * w1;
      G2[i] = Gc[2 * i] * w0 + Gc[2 * i + 1] * w1; B2[i] = B[2 * i] * w0 + B[2 * i + 1] * w1; A2[i] = Math.max(Ar[2 * i], Ar[2 * i + 1]);
    }
    T = T2; V = V2; D = D2; R = R2; Gc = G2; B = B2; Ar = A2; n = m;
  }
  const mk = lv => { const t = new THREE.DataTexture(lv[0].data, N, 1, THREE.RGBAFormat, THREE.HalfFloatType); t.mipmaps = lv; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = false; t.needsUpdate = true; return t; };
  return { A: mk(levelsA), C: mk(levelsC), r0, r1, texKm: (r1 - r0) / N, tauAt: r => taus[Math.min(N - 1, Math.max(0, Math.round((r - r0) / (r1 - r0) * (N - 1))))] };
}
// J2-corrected orbital and epicyclic frequencies (rad/s) at radius r (m)
const freq = (sys, r) => { const q = 1.5 * sys.J2 * (sys.Req * 1000 / r) ** 2, b = sys.GM / r ** 3; return { om: Math.sqrt(b * (1 + q)), ka: Math.sqrt(b * (1 - q)) }; };
function resonanceWaves(sys, prof) {   // first- and second-order Lindblad resonances m(Omega - n) = j kappa that fall inside the rings
  const out = [];
  for (const [name, P, M] of sys.moons) {
    const n = TAU2 / (P * DAY);
    for (const order of [1, 2]) for (let m = 2; m <= 60; m++) {
      const f = r => { const q = freq(sys, r); return m * (q.om - n) - order * q.ka; };
      let lo = sys.Req * 1000 * 1.05, hi = sys.Req * 1000 * 3.2; if (f(lo) < 0 || f(hi) > 0) continue;
      for (let it = 0; it < 60; it++) { const mid = 0.5 * (lo + hi); if (f(mid) > 0) lo = mid; else hi = mid; }
      const rL = 0.5 * (lo + hi) / 1000; if (rL < 74000 || rL > 136000) continue;
      const tau = Math.min(4, Math.max(0.08, prof.tauAt(rL))), sigma = 700 * tau, q = freq(sys, rL * 1000);
      const c = 3 * (m - 1) * q.om ** 2 / (4 * Math.PI * G * sigma * rL * 1000) * 1e6;   // rad per km^2: tightly wound spiral, phase = c (r - rL)^2
      out.push({ name, m, order, rL, n, c, score: Math.sqrt(M) / (1 + 0.2 * m) / order ** 2, damp: tau > 1 ? 60 : 28 });
    }
  }
  out.sort((p, q) => q.score - p.score); const top = out.slice(0, NW), mx = top[0]?.score || 1;
  for (const w of top) w.amp = 0.12 + 0.5 * (w.score / mx) ** 0.6;
  return top;
}

// ---------------------------------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------------------------------
const COMMON = /* glsl */`
#define NW ${NW}
#define NE ${NE}
#define NA ${NA}
const float TAU2 = 6.28318530718;
uniform sampler2D uProfA, uProfC; uniform vec4 uRange; uniform float uTexKm;
uniform vec4 uWaveA[NW]; uniform vec4 uWaveB[NW];   // (m, rL km, c rad/km2, amp), (damping km, phase0, ., .)
uniform vec4 uEdgeA[NE]; uniform vec4 uEdgeB[NE];   // (centre km, m, amp km, window km), (phase0, sign, ., .)
uniform vec4 uArc[NA]; uniform vec4 uArcInfo;       // (centre rad, half width rad, strength, .), (phase rad, ., ., .)
float arcFactor(float th){ float a = th - uArcInfo.x, f = 0.0;
  for (int i = 0; i < NA; i++) { vec4 q = uArc[i]; if (q.z <= 0.0) continue; float d = abs(mod(a - q.x + 3.14159265, TAU2) - 3.14159265); f = max(f, q.z * smoothstep(q.y, q.y * 0.55, d)); }
  return f; }
// optical depth and material at (r km, prograde angle). px: km covered by one pixel, so waves finer than that fade out instead of aliasing
void ringAt(float rkm, float th, float px, out float tau, out float varpi, out float dust, out vec3 col){
  float rr = rkm;
  for (int i = 0; i < NE; i++) { vec4 e = uEdgeA[i]; if (e.z <= 0.0) continue; vec4 f = uEdgeB[i];
    float ew = (rkm - e.x) / e.w, w = exp(-ew * ew), lam = TAU2 * e.x / e.y;
    rr += f.y * e.z * cos(e.y * th + f.x) * w * (1.0 - smoothstep(0.5, 1.5, px / lam)); }
  float u = clamp((rr - uRange.x) / (uRange.y - uRange.x), 0.0, 1.0);
  float lod = max(0.0, log2(max(px, 1e-3) / uTexKm));   // coarser mips when a pixel spans many texels
  vec4 A = textureLod(uProfA, vec2(u, 0.5), lod), Cc = textureLod(uProfC, vec2(u, 0.5), lod);
  tau = pow(10.0, A.x); varpi = A.y; dust = A.z; col = Cc.rgb;
  if (Cc.a > 0.02) tau *= mix(0.02, 1.0, arcFactor(th));
  float md = 1.0;
  for (int i = 0; i < NW; i++) { vec4 a = uWaveA[i]; if (a.w <= 0.0) continue; float d = rkm - a.y; if (d <= 0.0) continue; vec4 b = uWaveB[i];
    float dd = d / b.x, lam = TAU2 / max(2.0 * a.z * d, 1e-6), env = a.w * (1.0 - exp(-d / 4.0)) * exp(-dd * dd);
    md *= 1.0 + env * (1.0 - smoothstep(0.4, 1.2, px / lam)) * cos(a.x * th + b.y - a.z * d * d); }
  tau *= max(md, 0.02);
}
float planetShadow(vec3 p, vec3 L){ float t = -dot(p, L); if (t < 0.0) return 1.0; float d = length(p + L * t); return smoothstep(0.9988, 1.0012, d); }
`;
const DISC_VERT = /* glsl */`varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FRAG = COMMON + /* glsl */`
varying vec3 vPos;
uniform vec3 uCamL, uSunL; uniform float uRkm, uExposure, uPixelAng, uBoost, uWake;
uniform vec4 uFoot;            // foot point x, z (ring-local units), metres per unit, active
uniform vec4 uCls[${NC}];      // (s_lo m, window m, active, .)
float hg(float g, float c){ float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }
void main(){
  vec3 p = vPos; float rU = length(p.xz), rkm = rU * uRkm, th = atan(-p.z, p.x);
  vec3 Vv = uCamL - p; float dist = length(Vv); vec3 V = Vv / dist, L = uSunL;
  float px = dist * uPixelAng * uRkm;
  float tau, varpi, dust; vec3 col; ringAt(rkm, th, px, tau, varpi, dust, col);
  float mu = max(abs(V.y), 0.015), mu0 = max(abs(L.y), 0.015);
  // self-gravity wakes lean ~20 degrees behind the orbital direction: seen along the crests the ring is more transparent
  if (uWake > 0.0 && dust < 0.5) {
    vec2 rad = vec2(cos(th), -sin(th)), tan_ = vec2(-sin(th), -cos(th)); vec2 vh = normalize(V.xz + 1e-6);
    vec2 crest = normalize(tan_ * cos(0.36) - rad * sin(0.36)); float ca = dot(vh, crest);
    tau *= 1.0 + uWake * smoothstep(0.1, 0.4, tau) * (1.0 - 0.5 * smoothstep(1.5, 3.0, tau)) * (0.3 * (1.0 - 2.0 * ca * ca));
  }
  // near the camera the particle tier supplies the larger bodies: keep only the dust finer than the smallest drawn class
  float fog = 1.0; if (uFoot.w > 0.5) { float rho = length(p.xz - uFoot.xy) * uFoot.z, sc = 1e9;
    for (int i = 0; i < ${NC}; i++) { vec4 c = uCls[i]; if (c.z > 0.5 && c.y > rho) sc = min(sc, c.x); }
    fog = sc > 1e8 ? 1.0 : clamp(log(sc / ${S0}) / log(1024.0), 0.0, 1.0); }
  float alpha = 1.0 - exp(-tau * fog / mu);
  float ts = tau * fog * (dust > 0.5 ? uBoost : 1.0);
  float cosT = dot(-L, V), P;
  if (dust > 0.5) P = 0.2 + 0.8 * hg(0.8, cosT);
  else { float surge = 1.0 + 0.6 / (1.0 + acos(clamp(-cosT, -1.0, 1.0)) / 0.035); P = (0.72 * hg(-0.3, cosT) + 0.28 * hg(0.65, cosT)) * surge; }
  float Is;
  if (V.y * L.y > 0.0) Is = mu0 / (mu + mu0) * (1.0 - exp(-ts * (1.0 / mu + 1.0 / mu0)));
  else if (abs(mu0 - mu) < 2e-3) Is = ts / mu * exp(-ts / mu);
  else Is = mu0 / (mu0 - mu) * (exp(-ts / mu0) - exp(-ts / mu));
  float lit = planetShadow(p, L);
  vec3 rgb = col * varpi * P * Is * lit * uExposure + col * 0.004 * alpha;   // a trace of planetshine
  gl_FragColor = vec4(rgb, alpha);
}`;
const SHELL_FRAG = COMMON + /* glsl */`
varying vec3 vPos; uniform vec3 uSunL; uniform float uRkm;
void main(){
  vec3 n = normalize(vPos); float lit = dot(n, uSunL); if (lit <= 0.0 || abs(uSunL.y) < 1e-3) discard;
  float t = -vPos.y / uSunL.y; if (t <= 0.0) discard;
  vec3 h = vPos + uSunL * t; float rkm = length(h.xz) * uRkm, th = atan(-h.z, h.x);
  float tau, varpi, dust; vec3 col; ringAt(rkm, th, 0.0, tau, varpi, dust, col);
  float a = (1.0 - exp(-tau / abs(uSunL.y))) * smoothstep(0.0, 0.12, lit);
  if (a < 0.003) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a * 0.92);
}`;
const PART_VERT = COMMON + /* glsl */`
uniform sampler2D uPhase, uWakeTex;
uniform vec4 uCls;     // s_lo m, window m, shell spacing m, class index
uniform vec4 uPatch;   // radial offset of shell 0 (m), r0 km, theta0, tau reference
uniform vec4 uPatchI;  // shell index high / low parts
uniform vec4 uWakeP;   // tile Lx, Ly (m), x offset, y offset (m)
uniform vec4 uWakeQ;   // peak (1 / mean) of the tile, enabled
uniform vec3 uSunP, uSunL, uCenterL, uAxR, uAxT; uniform float uRm, uExposure;
varying vec3 vCol; varying float vLit;
uint h32(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float u01(uint x){ return float(h32(x) >> 8) / 16777216.0; }
vec3 rotAx(vec3 v, vec3 a, float c, float s){ return v * c + cross(a, v) * s + a * dot(a, v) * (1.0 - c); }
void main(){
  int id = gl_InstanceID, j = id / ${KPER}, k = id - j * ${KPER};
  float W = uCls.y, lo = uPatchI.y + float(j), carry = floor(lo / 1048576.0); lo -= carry * 1048576.0;
  uint sh = h32(uint(uPatchI.x + carry) * 2654435761U ^ h32(uint(lo)) ^ uint(uCls.w + 1.0) * 0x9E3779B9U), kk = h32(sh ^ uint(k + 1) * 0x85ebca6bU);
  float dx = float(j) * uCls.z + uPatch.x, rkm = uPatch.y + dx * 0.001;
  float y = mod(u01(kk ^ 0x1234567U) * 2.0 * W + texelFetch(uPhase, ivec2(j, int(uCls.w)), 0).r, 2.0 * W) - W;
  float fade = smoothstep(W, 0.85 * W, abs(y)) * smoothstep(W, 0.85 * W, abs(dx));
  vec4 gone = vec4(2.0, 2.0, 2.0, 1.0);
  if (fade < 0.02) { gl_Position = gone; vCol = vec3(0.0); vLit = 0.0; return; }
  float th = uPatch.z + y / (rkm * 1000.0), tau, varpi, dust; vec3 col; ringAt(rkm, th, 0.0, tau, varpi, dust, col);
  if (dust > 0.5) tau = 0.0;
  float dens = tau / uPatch.w;
  if (uWakeQ.y > 0.5) { float wk = texture2D(uWakeTex, vec2((dx + uWakeP.z) / uWakeP.x, (y + uWakeP.w) / uWakeP.y)).r;
    dens *= mix(1.0, wk * uWakeQ.x, smoothstep(0.1, 0.35, tau) * (1.0 - 0.7 * smoothstep(1.5, 3.0, tau))); }
  if (u01(kk ^ 0xabcdefU) > dens) { gl_Position = gone; vCol = vec3(0.0); vLit = 0.0; return; }
  float sLo = uCls.x, s = pow(mix(pow(sLo, -2.0), pow(2.0 * sLo, -2.0), u01(kk ^ 0x777U)), -0.5) * fade;
  float zc = (u01(kk ^ 1U) + u01(kk ^ 2U) + u01(kk ^ 3U) - 1.5) * 6.0;
  vec3 ax = normalize(vec3(u01(kk ^ 4U), u01(kk ^ 5U), u01(kk ^ 6U)) * 2.0 - 1.0 + 1e-4); float ang = u01(kk ^ 7U) * 6.2831853, ca = cos(ang), sa = sin(ang);
  vec3 aniso = vec3(0.7 + 0.3 * u01(kk ^ 8U), 0.7 + 0.3 * u01(kk ^ 9U), 1.0);
  vec3 lp = rotAx(position * aniso * s, ax, ca, sa) + vec3(dx, zc, -y);
  vec3 nrm = rotAx(normal, ax, ca, sa);
  vec3 pL = uCenterL + (uAxR * dx + uAxT * y + vec3(0.0, zc, 0.0)) / uRm;
  vCol = col * varpi * 1.7 * (0.8 + 0.4 * u01(kk ^ 10U)); vLit = 0.03 + 0.97 * max(dot(nrm, uSunP), 0.0) * planetShadow(pL, uSunL);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(lp, 1.0);
}`;
const PART_FRAG = /* glsl */`varying vec3 vCol; varying float vLit; uniform float uExposure; void main(){ gl_FragColor = vec4(vCol * vLit * uExposure, 1.0); }`;

// ---------------------------------------------------------------------------------------------------
// the ringed body: planet mesh + tilted ring frame + shell + disc + particle tier
// ---------------------------------------------------------------------------------------------------
const POLES = { saturn: [40.589, 83.537], jupiter: [268.057, 64.495], uranus: [257.311, -15.175], neptune: [299.36, 43.46] };   // IAU RA, Dec of the north pole (deg)
export const poleEquatorial = name => { const p = POLES[String(name).toLowerCase()]; if (!p) return null; const a = p[0] * Math.PI / 180, d = p[1] * Math.PI / 180; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };

export function createRingedBody(THREE, { spec, group, body, lightDir, seed = 1 }) {
  const key = ringSystemKey(spec.name), sys = key ? SYSTEMS[key] : genericSystem(spec, seed), disposables = [];
  const Rm = (spec.radius_m || sys.Req * 1000), Rkm = Rm / 1000, toU = km => km / Rkm;   // ring-local unit = the model's radius
  const prof = buildProfile(THREE, sys, seed * 7919 + 13); disposables.push(prof.A, prof.C);
  const waves = resonanceWaves(sys, prof);
  const frame = new THREE.Object3D(), spinNode = new THREE.Object3D(), root = new THREE.Object3D();
  frame.add(spinNode); frame.add(root); spinNode.add(body);
  const qPole = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0.18)), Y = new THREE.Vector3(0, 1, 0);

  // shared uniforms
  const U = {
    uProfA: { value: prof.A }, uProfC: { value: prof.C }, uRange: { value: new THREE.Vector4(prof.r0, prof.r1, 0, 0) }, uTexKm: { value: prof.texKm },
    uWaveA: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uWaveB: { value: Array.from({ length: NW }, () => new THREE.Vector4()) },
    uEdgeA: { value: Array.from({ length: NE }, () => new THREE.Vector4()) }, uEdgeB: { value: Array.from({ length: NE }, () => new THREE.Vector4()) },
    uArc: { value: Array.from({ length: NA }, () => new THREE.Vector4()) }, uArcInfo: { value: new THREE.Vector4() },
    uSunL: { value: new THREE.Vector3(0, 1, 0) }, uRkm: { value: Rkm }, uExposure: { value: 1.0 },
  };
  waves.forEach((w, i) => U.uWaveA.value[i].set(w.m, w.rL, w.c, w.amp));
  waves.forEach((w, i) => U.uWaveB.value[i].set(w.damp, 0, 0, 0));
  const edgeDefs = []; (sys.edges || []).forEach(e => e.edges.forEach((ec, k) => { if (edgeDefs.length >= NE) return; const m = TAU2 * e.a / (3 * Math.PI * Math.abs(e.a - ec)); edgeDefs.push({ ...e, ec, m, n: TAU2 / (e.P * DAY), sign: k ? -1 : 1 }); }));
  edgeDefs.forEach((e, i) => { U.uEdgeA.value[i].set(e.ec, e.m, e.amp, e.win); U.uEdgeB.value[i].set(0, e.sign, 0, 0); });
  if (sys.arcs) sys.arcs.list.forEach(([c, hw, s], i) => U.uArc.value[i].set(c * Math.PI / 180, hw * Math.PI / 180, s, 0));
  let simSec = null, lastReal = 0;
  const setPhases = t => {   // pattern phases in double precision on the CPU: m (theta - n t)
    waves.forEach((w, i) => { U.uWaveB.value[i].y = (((-w.m * w.n * t) % TAU2) + TAU2) % TAU2; });
    edgeDefs.forEach((e, i) => { U.uEdgeB.value[i].x = (((-e.m * e.n * t) % TAU2) + TAU2) % TAU2; });
    if (sys.arcs) U.uArcInfo.value.x = (sys.arcs.n * t) % TAU2;
  };

  // far tier: the disc
  const rIn = toU(sys.rIn), rOut = toU(sys.rOut), dg = new THREE.RingGeometry(rIn, rOut, 720, 1); dg.rotateX(-Math.PI / 2); disposables.push(dg);
  const discU = { ...U, uCamL: { value: new THREE.Vector3() }, uPixelAng: { value: 0.001 }, uBoost: { value: sys.dustBoost || 40 }, uWake: { value: sys.wakes ? 1 : 0 },
    uFoot: { value: new THREE.Vector4() }, uCls: { value: Array.from({ length: NC }, () => new THREE.Vector4()) } };
  const discMat = new THREE.ShaderMaterial({ vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, uniforms: discU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }); disposables.push(discMat);
  const disc = new THREE.Mesh(dg, discMat); disc.renderOrder = 3; disc.frustumCulled = false; root.add(disc);

  // the ring's shadow on the planet
  const sg = new THREE.SphereGeometry(1.004, 64, 32), shellMat = new THREE.ShaderMaterial({ vertexShader: DISC_VERT, fragmentShader: SHELL_FRAG, uniforms: { ...U }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  disposables.push(sg, shellMat); const shell = new THREE.Mesh(sg, shellMat); shell.renderOrder = 1; root.add(shell);

  // near tier: one instanced mesh per octave of particle radius
  const ico = new THREE.IcosahedronGeometry(1, 0); disposables.push(ico);
  const phaseData = new Float32Array(J * NC), phaseTex = new THREE.DataTexture(phaseData, J, NC, THREE.RedFormat, THREE.FloatType);
  phaseTex.minFilter = phaseTex.magFilter = THREE.NearestFilter; phaseTex.generateMipmaps = false; disposables.push(phaseTex);
  const wakeTex = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType); wakeTex.needsUpdate = true; disposables.push(wakeTex);
  const wake = { on: 0, peak: 1, lx: 1.5, ly: 4.5 };
  try {
    fetch(new URL('./rings/wake_tile.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || !j.data) return; const bin = atob(j.data), d = new Uint8Array(bin.length); for (let i = 0; i < d.length; i++) d[i] = bin.charCodeAt(i);
      const t = new THREE.DataTexture(d, j.W, j.H, THREE.RedFormat, THREE.UnsignedByteType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
      wakeTex.dispose(); Object.assign(wake, { on: 1, peak: j.peak, lx: j.lx_lambda, ly: j.ly_lambda }); for (const m of parts) m.material.uniforms.uWakeTex.value = t; disposables.push(t);
    }).catch(() => {});
  } catch { /* no wake tile: the ring keeps its profile and waves only */ }
  const partsRoot = new THREE.Group(), parts = [], tauRef = 6;
  const cls = Array.from({ length: NC }, (_, e) => { const lo = S0 * 2 ** e, K = 1 / (Math.PI * Math.log(2 * S0 * 2 ** (NC - 1) / S0)), dens = 0.375 * K * lo ** -2, W = 0.5 * Math.sqrt(J * KPER / (dens * tauRef)); return { e, lo, hi: 2 * lo, W, d: 2 * W / J, on: false }; });
  for (const c of cls) {
    const m = new THREE.ShaderMaterial({ vertexShader: PART_VERT, fragmentShader: PART_FRAG, uniforms: { ...U, uPhase: { value: phaseTex }, uWakeTex: { value: wakeTex }, uCls: { value: new THREE.Vector4(c.lo, c.W, c.d, c.e) },
      uPatch: { value: new THREE.Vector4() }, uPatchI: { value: new THREE.Vector4() }, uWakeP: { value: new THREE.Vector4() }, uWakeQ: { value: new THREE.Vector4() },
      uSunP: { value: new THREE.Vector3() }, uCenterL: { value: new THREE.Vector3() }, uAxR: { value: new THREE.Vector3() }, uAxT: { value: new THREE.Vector3() }, uRm: { value: Rm } } });
    const mesh = new THREE.InstancedMesh(ico, m, J * KPER); mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 0; mesh.count = 0;
    mesh.onBeforeRender = (renderer, scene, camera) => update(renderer, camera); c.mesh = mesh; c.mat = m; parts.push(mesh); partsRoot.add(mesh); disposables.push(m);
  }
  partsRoot.matrixAutoUpdate = false; root.add(partsRoot);

  // per-frame: camera in ring-local coordinates, which classes are resolvable, shell phases
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), mInv = new THREE.Matrix4(), mp = new THREE.Matrix4(), lastKey = { f: -1, c: null }, sz = new THREE.Vector2();
  disc.onBeforeRender = (renderer, scene, camera) => update(renderer, camera);
  function update(renderer, camera) {
    const fid = renderer.info.render.frame; if (lastKey.f === fid && lastKey.c === camera.uuid) return; lastKey.f = fid; lastKey.c = camera.uuid;
    const t = simSec ?? lastReal; setPhases(t);
    root.updateWorldMatrix(true, false); mInv.copy(root.matrixWorld).invert();
    const cam = discU.uCamL.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(mInv);
    U.uSunL.value.copy(lightDir).transformDirection(mInv);
    renderer.getDrawingBufferSize(sz); const fov = (camera.fov || 50) * Math.PI / 180, pa = 2 * Math.tan(fov / 2) / Math.max(1, sz.y); discU.uPixelAng.value = pa;
    for (const c of cls) { c.on = false; c.mesh.count = 0; c.mat.uniforms.uCls.value.w = c.e; discU.uCls.value[c.e].set(c.lo, c.W, 0, 0); }
    discU.uFoot.value.w = 0;
    const rho = Math.hypot(cam.x, cam.z), rkmFoot = rho * Rkm;
    if (rkmFoot < sys.rIn || rkmFoot > sys.rOut) return;
    const dist = Math.hypot(cam.y) * Rm;   // height above the ring plane, metres (the foot point is the nearest ring point)
    let any = false; for (const c of cls) { c.on = dist < c.hi / (0.35 * pa) && dist < 6 * c.W; any ||= c.on; }
    if (!any) return;
    const th0 = Math.atan2(-cam.z, cam.x), er = v1.set(Math.cos(th0), 0, -Math.sin(th0));
    const r0m = rkmFoot * 1000, fr = freq(sys, r0m), tau0 = Math.min(3, Math.max(0.15, prof.tauAt(rkmFoot))), lam = 4 * Math.PI ** 2 * G * 700 * tau0 / fr.ka ** 2;
    const Lxm = wake.lx * lam, Lym = wake.ly * lam, sunL = U.uSunL.value;
    mp.makeBasis(er, Y, new THREE.Vector3(Math.sin(th0), 0, Math.cos(th0))).scale(v2.set(1 / Rm, 1 / Rm, 1 / Rm)).setPosition(cam.x, 0, cam.z);   // metres -> ring-local units, centred on the foot point
    partsRoot.matrix.copy(mp); partsRoot.matrixWorld.multiplyMatrices(root.matrixWorld, partsRoot.matrix);
    const erC = new THREE.Vector3(Math.cos(th0), 0, -Math.sin(th0)), tgC = new THREE.Vector3(-Math.sin(th0), 0, -Math.cos(th0));
    discU.uFoot.value.set(cam.x, cam.z, Rm, 1);
    const tt = simSec ?? lastReal;
    for (const c of cls) {
      discU.uCls.value[c.e].set(c.lo, c.W, c.on ? 1 : 0, 0); if (!c.on) continue;
      const i0 = Math.floor((r0m - c.W) / c.d), u = c.mat.uniforms, W2 = 2 * c.W;
      u.uPatch.value.set(i0 * c.d - r0m, rkmFoot, th0, tauRef); u.uPatchI.value.set(Math.floor(i0 / 1048576), i0 - Math.floor(i0 / 1048576) * 1048576, 0, 0);
      u.uWakeP.value.set(Lxm, Lym, ((r0m % Lxm) + Lxm) % Lxm, ((((th0 - fr.om * tt) * r0m) % Lym) + Lym) % Lym); u.uWakeQ.value.set(wake.peak, wake.on, 0, 0);
      u.uSunP.value.set(sunL.dot(erC), sunL.y, sunL.x * Math.sin(th0) + sunL.z * Math.cos(th0)); u.uCenterL.value.set(cam.x, 0, cam.z); u.uAxR.value.copy(erC); u.uAxT.value.copy(tgC);
      const row = c.e * J; for (let j = 0; j < J; j++) { const rj = (i0 + j) * c.d, om = freq(sys, rj).om; const ph = ((om * tt) % TAU2 - th0) % TAU2; phaseData[row + j] = (((ph * rj) % W2) + W2) % W2; }
      c.mesh.count = J * KPER; c.mesh.matrixWorld.copy(partsRoot.matrixWorld);
    }
    phaseTex.needsUpdate = true;
  }

  const qg = new THREE.Quaternion();
  const api = {
    setPole(v) { if (v && v.lengthSq() > 0) qPole.setFromUnitVectors(Y, v.clone().normalize()); },
    setSimSeconds(s) { simSec = s; },
    setExposure(x) { U.uExposure.value = x; },
    debug: () => ({ sunL: U.uSunL.value.toArray(), camL: discU.uCamL.value.toArray(), sunW: lightDir.toArray(), pole: new THREE.Vector3(0, 1, 0).applyQuaternion(qPole).toArray(), active: cls.map(c => c.on ? 1 : 0).join('') }),
    wavesInfo: waves.map(w => ({ moon: w.name, m: w.m, order: w.order, rKm: +w.rL.toFixed(1) })),
  };
  return {
    frame, api,
    tick(t) {
      lastReal = t; group.updateWorldMatrix(true, false); group.getWorldQuaternion(qg);
      frame.quaternion.copy(qg).invert().multiply(qPole); spinNode.rotation.y = group.rotation.y;
    },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
}
