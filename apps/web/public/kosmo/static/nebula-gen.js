// nebula-gen.js — volumetric nebulae for the Kosmo atlas. Same contract as kosmo-models.createModel:
// every factory returns a THREE.Group of unit radius with .tick(t) and .dispose().
//
//   import { createNebula, nebulaParams } from './nebula-gen.js';
//   const m = createNebula(THREE, { name:'Orion Nebula', type:'nebula', notes:'H II region nebula' });
//   scene.add(m);  // each frame: m.tick(t); m.update(camera, renderer)   (update picks the level of detail)
//
// Technique: ONE shared 64^3 tileable noise texture (RGBA8, 1 MB, baked once in ~150 ms) + one raymarch
// fragment shader on a bounding sphere. Emission and dust absorption are marched together and output
// premultiplied (src ONE, dst ONE_MINUS_SRC_ALPHA), so bright gas and dark lanes composite correctly.
// Five modes share the marcher: 0 HII/emission, 1 reflection, 2 dark, 3 planetary, 4 supernova remnant.

// ---------------------------------------------------------------------------------------------------
// catalogue row -> parameters
// ---------------------------------------------------------------------------------------------------
export function hashSeed(name) { let h = 2166136261; for (const c of String(name || 'x')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export const NEB_CLASSES = ['hii', 'reflection', 'dark', 'pn_ring', 'pn_bipolar', 'snr_shell', 'snr_pwn', 'snr_sheet', 'pillars', 'lightecho', 'wall'];

export function classifyNebula(spec) {
  const t = (spec.type || '').toLowerCase(), s = `${spec.name || ''} ${(spec.alt_names || []).join(' ')} ${spec.notes || ''}`.toLowerCase();
  if (spec.cls && NEB_CLASSES.includes(spec.cls)) return spec.cls;
  if (t === 'supernova_remnant' || t === 'snr' || /supernova remnant/.test(s)) {
    if (/crab|pulsar|plerion|vela|3c 58|msh 15|g21\.5|wind nebula/.test(s)) return 'snr_pwn';
    if (/veil|cygnus loop|simeis|sheet|monoceros|ic 443|ic 59|gum/.test(s)) return 'snr_sheet';
    return 'snr_shell';   // Tycho, Kepler, Cas A, SN 1006 ...: Ia and core-collapse shells
  }
  if (/planetary/.test(s) || t === 'pnebula') return /bipolar|butterfly|hourglass|m2-9|ngc 6302|ngc 2346|ngc 6537|hubble 5|cn 1-1|minkowski|ngc 7027|ngc 650|m 76|little dumbbell|calabash|egg|boomerang|ngc 2440/.test(s) ? 'pn_bipolar' : 'pn_ring';
  if (/light echo|v838|v 838|v4334|echo nebula/.test(s)) return 'lightecho';
  if (/dark|horsehead|coalsack|barnard|\bpipe\b|snake|\bldn ?\d|\bb ?\d{1,3}\b|bok globule|cocoon|funnel|dust lane/.test(s)) return 'dark';
  if (/reflection|pleiades|merope|witch head|iris|ngc 1333|ngc 7023|ic 4592|rho oph|antares|ngc 2068|ngc 2071|ngc 1435|ngc 1977|running man|ic 2118|ngc 6726|ngc 4372/.test(s)) return 'reflection';
  if (/pillars|eagle|\bm ?16\b|ngc 6611|carina|ngc 3372|mystic mountain|ngc 2264|cone nebula/.test(s)) return 'pillars';
  if (/orion|\bm ?42\b|ngc 1976|rosette|ngc 2237|lagoon|\bm ?8\b|ngc 6523|cosmic cliffs|ngc 3324|ngc 3603|tarantula|ngc 2070|ngc 346|ngc 604|trifid|\bm ?20\b|ngc 2024|flame nebula|north america|ngc 7000|omega nebula|\bm ?17\b|swan nebula/.test(s)) return 'wall';
  return 'hii';       // 'diffuse nebula (emission/reflection/dark)' with no further hint defaults to emission
}

// Blackbody-ish colour of the ionising / illuminating star (T in kelvin) as linear-ish rgb 0..1
function starColour(T) { const t = T / 100; let r, g, b; r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332); g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -0.0755); b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305; return [r, g, b].map(v => Math.min(1, Math.max(0, v / 255))); }

// All the knobs of the shader in one plain object (also what the lab prints). Deterministic per name.
export function nebulaParams(spec = {}) {
  const cls = classifyNebula(spec), seedI = hashSeed(spec.name), R = rng(seedI);
  const T = spec.temperature_K > 5000 ? spec.temperature_K : (cls.startsWith('pn') ? 70000 : 38000);   // central / ionising star
  const hot = Math.min(1, Math.max(0, (T - 25000) / 80000));   // 0 = B-star (red Halpha dominated), 1 = very hot (OIII/HeII teal)
  const p = {
    cls, seed: seedI, T, starCol: starColour(Math.min(T, 40000)), hot,
    mode: { hii: 0, reflection: 1, dark: 2, pn_ring: 3, pn_bipolar: 3, snr_shell: 4, snr_pwn: 4, snr_sheet: 4, pillars: 5, lightecho: 6, wall: 7 }[cls],
    off: [R() * 40, R() * 40, R() * 40],
    star: [(R() - 0.5) * 0.6, (R() - 0.5) * 0.6, (R() - 0.5) * 0.4],   // position of the ionising/illuminating star(s)
    scale: 0.9 + R() * 0.5, warp: 0.35 + R() * 0.3, fil: 0.35 + R() * 0.5, lo: 0.42, hi: 0.82,
    bright: 1.0, expo: 2.0, dust: 0.0, back: 0.0, nStars: 14,
    shellR: 0.55, shellW: 0.12, elong: 1, lobe: 0.3, lobeR: 0.32, bip: 0, rough: 0.15, filPow: 2, pwn: 0, sync: 0, ionK: 6, oiiiAmt: 0.45 + 0.45 * hot,
    tilt: [R() * 6.28, R() * 6.28], spin: 0.01, sat: 1.1, tone: 0, coreCol: [1, 0.14, 0.1], jets: 0, pil: [],
  };
  switch (cls) {
    case 'hii': p.dust = 1.2; p.bright = 1.5; p.expo = 2.4; p.nStars = 18; break;
    case 'reflection': p.bright = 1.2; p.expo = 2.2; p.scale = 1.0 + R() * 0.4; p.fil = 0.7; p.ionK = 1; p.nStars = 6; p.star = [p.star[0] * 0.5, p.star[1] * 0.5, 0]; break;
    case 'dark': p.dust = 9; p.back = 0.55; p.scale = 0.8 + R() * 0.4; p.fil = 0.25; p.lo = 0.5; p.hi = 0.8; p.nStars = 0; break;
    case 'pn_ring': p.elong = 0.55 + R() * 0.5; p.shellR = 0.42 + R() * 0.12; p.shellW = 0.2 + R() * 0.06; p.bright = 0.55; p.expo = 2.0; p.nStars = 0; p.warp = 0.15; break;
    case 'pn_bipolar': p.bip = 1; p.lobe = 0.3 + R() * 0.1; p.lobeR = 0.27 + R() * 0.07; p.shellW = 0.17; p.bright = 0.55; p.expo = 2.0; p.nStars = 0; p.warp = 0.12; break;
    case 'snr_shell': p.shellR = 0.66; p.shellW = 0.04; p.rough = /type ia|sn ia/i.test(spec.notes || '') ? 0.06 : 0.18; p.filPow = 3.4; p.bright = 2.4; p.expo = 2.2; p.nStars = 0; p.scale = 1.3; break;
    case 'snr_pwn': p.shellR = 0.62; p.shellW = 0.05; p.rough = 0.2; p.pwn = 1; p.sync = 1; p.filPow = 2.6; p.bright = 2.4; p.expo = 2.2; p.nStars = 0; p.scale = 1.4; break;
    case 'snr_sheet': p.shellR = 0.7; p.shellW = 0.04; p.rough = 0.3; p.filPow = 4; p.bright = 3.2; p.expo = 2.2; p.nStars = 0; p.scale = 1.6; p.elong = 0.5; break;
    case 'pillars': {   // 3-5 dust columns of different height rising from a cloud bank; star direction (p.star) is where the rim light comes from
      p.tone = 1; p.sat = 1.25; p.scale = 1.0; p.warp = 0.5; p.fil = 0.5; p.bright = 1.0; p.expo = 2.2; p.nStars = 0; p.spin = 0; p.jets = 2;
      p.star = [0.5 + (R() - 0.5) * 0.2, 0.8, -0.3]; p.tilt = [(R() - 0.5) * 0.7, (R() - 0.5) * 0.9];
      const n = 3 + Math.floor(R() * 2.99), xs = [-0.5, -0.15, 0.2, 0.55, 0.0].slice(0, n);
      for (let i = 0; i < n; i++) p.pil.push([xs[i] * 1.15 + (R() - 0.5) * 0.1, (R() - 0.5) * 0.3, i === 1 ? 0.8 + R() * 0.1 : 0.15 + R() * 0.55, 0.075 + R() * 0.05]);
      break; }
    case 'lightecho': p.tone = 1; p.sat = 1.2; p.shellR = 0.66; p.shellW = 0.09; p.warp = 0.5; p.fil = 0.55; p.lo = 0.34; p.hi = 0.78; p.bright = 1.0; p.expo = 2.2; p.nStars = 0; break;
    case 'wall': p.tone = 1; p.sat = 1.25; p.shellR = 0.66; p.shellW = 0.1; p.warp = 0.5; p.fil = 0.7; p.filPow = 2.0; p.dust = 1.2; p.lo = 0.45; p.hi = 0.8; p.bright = 1.3; p.expo = 2.2; p.nStars = 0; p.star = [(R() - 0.5) * 0.25, (R() - 0.5) * 0.25, 0]; break;
  }
  return p;
}

// Palettes: 'natural' (Hubble visible light: brown dust, teal haze, gold rims; Halpha red / [OIII] teal), 'nircam' (JWST: copper/orange dust on deep blue haze),
// 'hubble' (false colour SII red / Halpha green / OIII blue). true/false are accepted for the old `hubble` flag.
export function palette(kind = 'natural') {
  const k = kind === true ? 'hubble' : kind === false || !kind ? 'natural' : kind;
  if (k === 'hubble') return { ha: [0.25, 0.95, 0.35], oiii: [0.2, 0.45, 1.0], sii: [1.0, 0.25, 0.15], refl: [0.5, 0.65, 1.0], dust: [0.3, 0.18, 0.1],
    rim: [1.0, 0.55, 0.2], body: [0.4, 0.2, 0.1], haze: [0.2, 0.45, 1.0], jet: [1, 0.2, 0.1], echo: [0.8, 0.8, 0.9], glow: [0.3, 0.9, 0.5], fringe: [0.2, 0.45, 1.0] };
  if (k === 'nircam') return { ha: [1.0, 0.22, 0.12], oiii: [0.15, 0.55, 1.0], sii: [0.8, 0.08, 0.04], refl: [0.35, 0.55, 1.0], dust: [0.5, 0.22, 0.08],
    rim: [1.0, 0.52, 0.13], body: [0.6, 0.24, 0.07], haze: [0.06, 0.2, 0.95], jet: [1, 0.08, 0.04], echo: [0.8, 0.7, 0.6], glow: [1.0, 0.25, 0.5], fringe: [0.25, 0.9, 0.55] };
  return { ha: [1.0, 0.16, 0.2], oiii: [0.1, 0.85, 0.78], sii: [0.75, 0.04, 0.05], refl: [0.42, 0.62, 1.0], dust: [0.3, 0.18, 0.1],
    rim: [0.85, 0.58, 0.2], body: [0.35, 0.12, 0.06], haze: [0.1, 0.5, 0.5], jet: [1, 0.25, 0.1], echo: [0.88, 0.74, 0.55], glow: [1.0, 0.2, 0.4], fringe: [0.2, 0.85, 0.5] };
}

// ---------------------------------------------------------------------------------------------------
// shared 3D noise texture
// ---------------------------------------------------------------------------------------------------
let _tex = null;
export function getNoiseTexture(THREE, N = 64) {
  if (_tex) return _tex;
  const mk = (seed, f) => { const r = rng(seed), a = new Float32Array(f * f * f); for (let i = 0; i < a.length; i++) a[i] = r(); return a; };
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const fbm = (freqs, amps, seed) => {
    const out = new Float32Array(N * N * N), tabs = freqs.map((f, i) => mk(seed + i * 977, f));
    freqs.forEach((f, oi) => {
      const tab = tabs[oi], amp = amps[oi], idx = (x, y, z) => ((z % f) * f + (y % f)) * f + (x % f);
      for (let z = 0; z < N; z++) { const zz = z / N * f, z0 = Math.floor(zz), fz = fade(zz - z0);
        for (let y = 0; y < N; y++) { const yy = y / N * f, y0 = Math.floor(yy), fy = fade(yy - y0);
          for (let x = 0; x < N; x++) { const xx = x / N * f, x0 = Math.floor(xx), fx = fade(xx - x0);
            const a = tab[idx(x0, y0, z0)], b = tab[idx(x0 + 1, y0, z0)], c = tab[idx(x0, y0 + 1, z0)], d = tab[idx(x0 + 1, y0 + 1, z0)];
            const e = tab[idx(x0, y0, z0 + 1)], g = tab[idx(x0 + 1, y0, z0 + 1)], h = tab[idx(x0, y0 + 1, z0 + 1)], k = tab[idx(x0 + 1, y0 + 1, z0 + 1)];
            const v0 = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy, v1 = (e + (g - e) * fx) * (1 - fy) + (h + (k - h) * fx) * fy;
            out[(z * N + y) * N + x] += amp * (v0 + (v1 - v0) * fz); } } }
    });
    return out;
  };
  const norm = a => { const s = Float32Array.from(a).sort(), lo = s[Math.floor(s.length * 0.01)], hi = s[Math.floor(s.length * 0.99)]; for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.max(0, (a[i] - lo) / (hi - lo))); return a; };
  const R = norm(fbm([4, 8, 16, 32], [1, 0.5, 0.25, 0.125], 11));
  const G = norm(fbm([4, 8, 16], [1, 0.5, 0.25], 23)); for (let i = 0; i < G.length; i++) G[i] = Math.pow(1 - Math.abs(2 * G[i] - 1), 1.5);   // ridged: thin filaments
  const B = norm(fbm([8, 16, 32], [1, 0.6, 0.35], 37));
  const A = norm(fbm([3, 6, 12, 24], [1, 0.5, 0.25, 0.12], 51));
  const data = new Uint8Array(N * N * N * 4);
  for (let i = 0; i < N * N * N; i++) { data[4 * i] = R[i] * 255; data[4 * i + 1] = G[i] * 255; data[4 * i + 2] = B[i] * 255; data[4 * i + 3] = A[i] * 255; }
  const t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
  return (_tex = t);
}

// ---------------------------------------------------------------------------------------------------
// GLSL (exported so other bodies - discs, protoplanetary discs, comae - can reuse sampleVol-style code)
// ---------------------------------------------------------------------------------------------------
export const NEB_GLSL = /* glsl */`
precision highp float; precision highp sampler3D;
uniform sampler3D uTex;
uniform float uTime, uMode, uWarp, uScale, uFil, uLo, uHi, uBright, uExpo, uDust, uBack, uIonK, uOiiiAmt;
uniform float uShellR, uShellW, uElong, uBip, uLobe, uLobeR, uRough, uFilPow, uPwn, uSync, uNPil, uJetAmt, uSat, uTone;
uniform vec3 uOff, uStar, uHa, uOiii, uSii, uRefl, uStarCol, uRim, uBodyC, uHaze, uJet, uEcho, uGlow, uFringe, uCore;
uniform vec4 uPil[5];
float h12(vec2 p){ vec3 p3=fract(vec3(p.xyx)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }

// pillars: density of opaque dust (columns + cloud bank), 0..1. Columns widen toward the foot, tips are rounded, outline eroded by ridged noise.
float pillDens(vec3 p, float lod, out float ridge){
  vec3 q = p, off = uOff;
  if (lod > 0.5) { vec3 w = texture(uTex, p * 0.9 + off).rgb - 0.5; q.xz += w.xz * uWarp * 0.3; q.y += w.y * 0.08; }
  vec4 a = texture(uTex, q * uScale * 1.4 + off + 1.7);
  ridge = a.g;
  if (lod > 0.5) ridge = ridge * 0.75 + texture(uTex, q * uScale * 3.0 + off + 5.3).g * 0.25;
  float f = 9.0;
  for (int i = 0; i < 5; i++) {
    if (float(i) >= uNPil) break;
    vec4 P = uPil[i];
    q.x -= 0.0; vec2 lean = vec2(sin(P.x * 7.0) * 0.22 * (q.y + 0.62), 0.0);
    float t = clamp((q.y + 0.62) / (P.z + 0.62), 0.0, 1.0);
    float rad = P.w * (0.7 + 1.0 * (1.0 - t) * (1.0 - t) + 0.22 * sin(t * 7.0 + float(i) * 2.3));
    float oy = max(q.y - (P.z - 0.09), 0.0);
    f = min(f, length(vec2(length(q.xz - P.xy - lean), oy * 1.3)) / rad - 1.0);
  }
  f -= (ridge - 0.4) * 0.4;
  float D = 1.0 - smoothstep(-0.12, 0.12, f);
  float bank = 1.0 - smoothstep(-0.15, 0.15, q.y + 0.5 + (a.r - 0.5) * 0.5 + (ridge - 0.5) * 0.15);
  return max(D, bank);
}

// emission em (rgb per unit length) and extinction ext (per unit length) at p inside the unit ball. lod > 0.5 adds domain warp + fine detail taps.
void sampleVol(vec3 p, float lod, out vec3 em, out float ext){
  em = vec3(0.0); ext = 0.0;
  float r = length(p); if (r >= 1.0) return;
  vec3 off = uOff + vec3(0.0, 0.0, uTime * 0.003);
  if (uMode > 4.5) {
    float edge = 1.0 - smoothstep(0.5, 0.98, r + (texture(uTex, p * 1.3 + off + 13.0).a - 0.5) * 0.35); edge *= edge;
    if (uMode < 5.5) {                                   // 5 pillars: opaque dust lit only on the rim facing the star, blue ionised haze behind
      float rg, rg2; float D = pillDens(p, lod, rg) * (1.0 - smoothstep(0.82, 1.0, r));
      vec3 L = normalize(uStar);
      float D2 = pillDens(p + L * 0.13, lod, rg2) * (1.0 - smoothstep(0.82, 1.0, length(p + L * 0.13)));
      float lit = pow(D * (1.0 - D2), 0.8), fine = 0.45 + 1.0 * rg;
      vec3 rimC = mix(uRim, vec3(1.0, 0.86, 0.62), smoothstep(0.6, 1.0, lit) * 0.25);
      em = rimC * lit * fine * uBright * 1.5;
      em += uBodyC * D * pow(rg, 1.6) * 0.45 * (0.6 + 0.4 * smoothstep(-0.6, 0.6, p.y));   // faint scattered copper on the shadowed body
      float hz = smoothstep(0.2, 0.85, texture(uTex, p * 0.75 + off + 3.0).r * 0.6 + texture(uTex, p * 1.6 + off + 8.0).b * 0.4);
      float hv = 0.6 + 0.4 * smoothstep(-0.6, 0.8, p.y);
      em += (uHaze * hz * hv * 0.2 + uRim * 0.16 * hz * exp(-pow((p.y + 0.42) / 0.3, 2.0))) * (1.0 - D);
      for (int i = 0; i < 5; i++) { if (float(i) >= uJetAmt) break; vec4 P = uPil[i];   // red protostar jet at the tip of the first pillars
        vec3 d = p - vec3(P.x + sin(P.x * 7.0) * 0.22 * (P.z + 0.62), P.z - 0.03, P.y + P.w * 0.6); em += uJet * exp(-dot(d * vec3(1.0, 1.4, 1.0), d * vec3(1.0, 1.4, 1.0)) / 0.0011) * 2.4; }
      float edgeD = 1.0 - smoothstep(0.82, 1.0, r); em = rimC * 0.0 + (em - (uHaze * hz * hv * 0.2 + uRim * 0.16 * hz * exp(-pow((p.y + 0.42) / 0.3, 2.0))) * (1.0 - D)) * edgeD + (uHaze * hz * hv * 0.2 + uRim * 0.16 * hz * exp(-pow((p.y + 0.42) / 0.3, 2.0))) * (1.0 - D) * edge; ext = D * 8.0 + hz * 0.25 * edge;
    } else if (uMode < 6.5) {                            // 6 light echo: swirled scattered-light shell with dark cavities, red star in the middle
      vec3 q = p;
      if (lod > 0.5) { vec3 w = texture(uTex, p * 0.5 + off).rgb - 0.5; q += w * uWarp * 1.4; }
      float rq = length(q.xy) + abs(q.z) * 0.5, ang = atan(q.y, q.x) * 0.15915 + rq * 0.45 + 0.5;   // polar coordinates: noise streaks run around the star, swirled
      vec3 pc = vec3(ang, rq * 1.5, q.z * 0.9) + off;
      vec4 a = texture(uTex, pc);
      float st = mix(a.r, a.g, uFil);
      if (lod > 0.5) st = st * 0.7 + texture(uTex, pc * vec3(2.0, 1.4, 1.4) + 2.2).g * 0.3;
      float base = smoothstep(0.1, 0.38, rq) * (1.0 - smoothstep(0.66, 0.98, rq));
      float ring = exp(-pow((rq - uShellR) / uShellW, 2.0)) + 0.6 * exp(-pow((rq - uShellR * 0.55) / (uShellW * 1.4), 2.0));
      float cav = smoothstep(0.42, 0.56, texture(uTex, vec3(p.xy * 0.55, p.z * 0.4) + off + 6.0).a * 0.85 + a.a * 0.15 + (rq - 0.5) * 0.35);
      float dens = (base * smoothstep(uLo, uHi, st) * 0.9 + ring * 0.5 * (0.3 + st)) * cav * edge;
      float lum = 0.3 + 1.0 / (0.5 + rq * rq * 3.0);
      vec3 col = mix(uEcho * vec3(1.1, 0.92, 0.72), uEcho, smoothstep(0.2, 0.5, rq));
      col = mix(col, uHaze * 1.6 + 0.15, smoothstep(0.55, 0.95, rq) * 0.45);
      em = col * dens * (0.35 + 1.0 * a.b) * lum * uBright * 1.1;
      em += uCore * (exp(-r * r * 60.0) * 1.2 + exp(-r * r * 7.0) * 0.22 * (0.5 + a.a * 0.6) * (0.5 + 0.8 * (1.0 - cav)));
      ext = dens * 1.3;
    } else {                                             // 7 wall: ionisation front, orange filaments with green fringes, pink interior glow
      vec3 q = p;
      if (lod > 0.5) q += (texture(uTex, p * 0.6 + off).rgb - 0.5) * uWarp * 1.3;
      vec4 a = texture(uTex, q * uScale + off);
      float rr = length(q - uStar), Rw = uShellR + (texture(uTex, p * 0.5 + off + 11.0).a - 0.5) * 0.55, s = rr - Rw;
      float fil = pow(a.g, uFilPow), f2 = fil;
      if (lod > 0.5) f2 = fil * 0.6 + pow(texture(uTex, q * uScale * 2.0 + off + 4.0).g, uFilPow) * 0.4;
      float gap = smoothstep(0.3, 0.5, texture(uTex, normalize(q - uStar) * 0.8 + off + 15.0).a);   // the wall is a partial shell: gaps let the eye see the glowing interior
      float wall = exp(-pow(s / (uShellW * (0.7 + 0.8 * a.b)), 2.0)) * (0.25 + 1.3 * f2) * (0.06 + 0.94 * gap);
      vec3 col = mix(uHa, uRim, smoothstep(0.55, 1.3, f2 * 0.7 + wall * 0.8));
      col = mix(col, uFringe, smoothstep(0.55, 0.05, wall) * smoothstep(0.05, -0.08, s) * 0.85);
      col = mix(col, vec3(1.0, 0.88, 0.7), smoothstep(0.9, 1.5, wall) * 0.4);
      float dd = smoothstep(0.0, 0.25, s) * smoothstep(uLo, uHi, texture(uTex, q * uScale * 1.1 + off + 7.0).r + 0.1);
      float gl = (1.0 - smoothstep(-0.25, 0.15, s)) * (0.3 + 0.9 * a.a);
      em = col * wall * uBright * 1.5 + uHa * 0.14 * dd * (0.4 + a.a) + uGlow * gl * 0.15 * uBright + uHaze * exp(-rr * rr * 6.0) * 0.14;
      em *= edge; ext = (dd * uDust * 2.0 + wall * 0.8) * edge;
    }
    return;
  }
  vec3 q = p;
  if (lod > 0.5) { vec3 w = texture(uTex, p * 0.7 + off).rgb - 0.5; q += w * uWarp; }
  vec3 sp = q * uScale + off;
  vec4 a = texture(uTex, sp);
  float edge = 1.0 - smoothstep(0.5, 1.0, r);
  if (uMode < 2.5) {                                    // 0 emission, 1 reflection, 2 dark: warped fbm / ridge cloud
    float d = mix(a.r, a.g, uFil);
    if (lod > 0.5) { vec4 c = texture(uTex, sp * 2.7 + 3.1); d += (c.b - 0.5) * 0.4; }
    float rn = r + (a.a - 0.5) * 0.5; edge = 1.0 - smoothstep(0.25, 0.95, rn);   // ragged outer boundary so the bounding sphere never shows
    float dens = smoothstep(uLo, uHi, d + (edge - 0.6) * 0.5) * edge * edge;
    vec3 sd = p - uStar; float s = length(sd);
    if (uMode < 0.5) {
      // ionisation stratification: [OIII] teal next to the hot star, Halpha red in the bulk, [SII] deep red at the rim
      vec3 col = mix(uSii, uHa, smoothstep(1.2, 0.3, s));
      col = mix(col, uOiii, exp(-s * s * uIonK) * uOiiiAmt * (0.4 + a.a));
      col = mix(col, vec3(1.0, 0.8, 0.9), smoothstep(0.7, 1.0, dens) * 0.25);   // hot dense knots go pinkish-white
      em = col * dens * dens * uBright * (0.4 + 1.2 * a.a) + uHa * 0.03 * edge * edge;
      float dust = smoothstep(0.55, 0.85, texture(uTex, q * uScale * 0.9 + off + 7.0).a) * edge;
      ext = dust * uDust * 3.0 + dens * 0.4;
    } else if (uMode < 1.5) {
      em = uRefl * dens * uBright * (0.12 + 1.0 / (0.25 + s * s * 4.0)) + uRefl * 0.02 * edge;   // starlight scattered by dust: ~1/d^2 from the star
      ext = dens * 1.0;
    } else {
      ext = dens * uDust; em = vec3(0.012, 0.008, 0.005) * dens;
    }
    return;
  }
  if (uMode < 3.5) {                                    // 3 planetary nebula: ellipsoid shell or two bubbles (bipolar)
    float s;
    if (uBip > 0.5) s = min(length(p - vec3(0.0, 0.0, uLobe)), length(p + vec3(0.0, 0.0, uLobe))) / uLobeR;
    else s = length(p * vec3(1.0, 1.0, uElong)) / uShellR;
    float cl = smoothstep(0.25, 0.85, mix(a.r, a.g, 0.6));
    float shell = exp(-pow((s - 1.0) / uShellW, 2.0)) * (0.3 + 1.1 * cl);
    float inner = exp(-s * s * 2.0) * (0.15 + 0.3 * a.a);
    float halo = exp(-pow(max(s - 1.0, 0.0) / 0.9, 2.0)) * 0.1 * a.b;
    vec3 col = mix(uOiii * 1.1, uHa, smoothstep(0.35, 1.5, s));   // high-ionisation teal inside, [NII]/Halpha red outside
    em = col * (shell * 1.7 + inner * 0.5 + halo) * uBright * edge;
    return;
  }
  // 4 supernova remnant: thin rough shell + ridged filaments, optional synchrotron pulsar-wind core
  float disp = (a.r - 0.5) * uRough;
  vec3 pp = p * vec3(1.0, 1.0, uElong > 0.0 ? 1.0 : 1.0);
  float r0 = uShellR + disp, sh = exp(-pow((r - r0) / uShellW, 2.0));
  float fil = pow(a.g, uFilPow);
  float pa = texture(uTex, q * 1.7 + off + 2.0).a;
  vec3 col = mix(uHa, uOiii, smoothstep(0.45, 0.7, pa));
  col = mix(col, uSii, smoothstep(0.6, 0.9, texture(uTex, q * 2.3 + off + 5.0).r) * 0.6);
  em = col * sh * (0.15 + fil * 1.7) * uBright * (0.5 + a.b);
  em += uHa * 0.05 * exp(-pow((r - r0) / (uShellW * 4.0), 2.0)) * a.a;                 // diffuse blast-wave halo
  if (uPwn > 0.5) em += vec3(0.45, 0.6, 1.0) * uSync * exp(-pow(r / (uShellR * 0.75), 2.0)) * (0.15 + 0.8 * texture(uTex, q * 1.4 + off + 9.0).g) * 1.2;   // blue synchrotron fill
}
`;

const VERT = /* glsl */`
uniform float uActive; varying vec3 vOP; varying vec3 vRO;
void main(){ vOP = position; vRO = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  gl_Position = uActive > 0.5 ? projectionMatrix * modelViewMatrix * vec4(position, 1.0) : vec4(2.0, 2.0, 2.0, 1.0); }`;

const MARCH_FRAG = NEB_GLSL + /* glsl */`
uniform float uSteps, uDetail, uFrame; varying vec3 vOP; varying vec3 vRO; out vec4 fragColor;
void main(){
  vec3 ro = vRO, rd = normalize(vOP - vRO);
  float b = dot(ro, rd), c = dot(ro, ro) - 1.0, disc = b * b - c;
  if (disc <= 0.0) discard;
  float sq = sqrt(disc), t0 = max(-b - sq, 0.0), t1 = -b + sq;
  float dt = (t1 - t0) / uSteps;
  float t = t0 + dt * h12(gl_FragCoord.xy + uFrame);          // jitter hides banding at low step counts
  vec3 E = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= uSteps || T < 0.03) break;
    vec3 em; float ext; sampleVol(ro + rd * t, uDetail, em, ext);
    E += T * em * dt; T *= exp(-ext * dt); t += dt;
  }
  if (uBack > 0.0) { vec3 pc = ro + rd * max(-b, 0.0); float l = length(pc);       // glowing backdrop that dark clouds silhouette against (IC 434 behind the Horsehead)
    float bg = (1.0 - smoothstep(0.25, 0.95, l)) * (0.5 + 0.8 * texture(uTex, pc * 1.3 + uOff).r); E += T * uHa * uBack * 0.35 * bg; }
  vec3 col;
  if (uTone > 0.5) { vec3 x = E * uExpo * 3.0; col = log(x + sqrt(x * x + 1.0)) / 2.0; }   // asinh stretch: lifts faint haze, keeps highlights coloured
  else col = 1.0 - exp(-E * uExpo);
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, uSat);
  fragColor = vec4(col, 1.0 - T);
}`;

// approach (c) for the lab: view-aligned slices, each evaluates sampleVol once; alpha-blended back to front
const SLICE_VERT = /* glsl */`uniform mat4 uInv; varying vec3 vOP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vOP = (uInv * w).xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SLICE_FRAG = NEB_GLSL + /* glsl */`uniform float uDt, uDetail; varying vec3 vOP; out vec4 fragColor;
void main(){ vec3 em; float ext; sampleVol(vOP, uDetail, em, ext); float a = 1.0 - exp(-ext * uDt);
  vec3 e = 1.0 - exp(-em * uDt * uExpo * 1.0); fragColor = vec4(e, a); if (dot(e, e) + a < 1e-5) discard; }`;

const GLOW_FRAG = /* glsl */`precision highp float; uniform vec3 uC; uniform float uA; varying vec2 vUv;
void main(){ float r = length(vUv - 0.5) * 2.0; float a = exp(-r * r * 4.5) * uA; gl_FragColor = vec4(uC * a, a); }`;
const GLOW_VERT = /* glsl */`uniform float uActive; varying vec2 vUv; void main(){ vUv = uv; gl_Position = uActive > 0.5 ? projectionMatrix * modelViewMatrix * vec4(position, 1.0) : vec4(2.0, 2.0, 2.0, 1.0); }`;
const STAR_VERT = /* glsl */`attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uPx; void main(){ vC = aColor; gl_PointSize = aSize * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STAR_FRAG = /* glsl */`precision highp float; varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 2.2) + 0.5 * exp(-r * r * 30.0); gl_FragColor = vec4(vC * a, a); }`;

// diffraction-spiked star sprites: 4 spikes (Hubble cross) or 8 (JWST-like). Size in px; spike length scales with size, tiny stars are plain dots.
const SF_VERT = /* glsl */`attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vS; uniform float uPx; void main(){ vC = aColor; vS = min(aSize * uPx, 480.0); gl_PointSize = vS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SF_FRAG = /* glsl */`precision highp float; varying vec3 vC; varying float vS; uniform float uSpikes;
float ln(vec2 p, float a, float len, float w){ vec2 d = vec2(cos(a), sin(a)); float al = abs(dot(p, d)), pe = abs(dot(p, vec2(-d.y, d.x))); return exp(-pe * pe / (2.0 * w * w)) * pow(max(1.0 - al / len, 0.0), 1.5); }
void main(){ vec2 p = (gl_PointCoord - 0.5) * vS; float r = length(p), h = vS * 0.5, sp0 = smoothstep(5.0, 18.0, vS);
  float I = exp(-r * r / (1.6 + 0.0004 * h * h)) * (1.0 + 0.3 * sp0) + 0.35 * exp(-r / (0.12 * h + 1.2)) * min(1.0, vS / 12.0);
  float sp = smoothstep(5.0, 18.0, vS);
  if (sp > 0.0) { float s = ln(p, 0.0, h, 0.6) + ln(p, 1.5708, h, 0.6);
    if (uSpikes > 6.0) s += 0.65 * (ln(p, 0.7854, h, 0.7) + ln(p, 2.356, h, 0.7));
    I += s * sp * 1.3; }
  I *= 1.0 - smoothstep(0.85, 1.0, r / h);
  gl_FragColor = vec4(vC * I, I); }`;
function spikeMaterial(THREE, spikes) { return new THREE.ShaderMaterial({ vertexShader: SF_VERT, fragmentShader: SF_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 }, uSpikes: { value: spikes } } }); }

// Optional sharp foreground/background star layer (separate from the nebula, which stays a unit-radius Group). Returns THREE.Points with .dispose().
// o: { cone:true puts all stars in the -z cap (what a camera at +z sees), count:900, spikes:8|4, seed, radius:70, tint:'blue'|'natural', size:1 }; call .setPixelRatio(pr) after creating (default 1).
export function createStarField(THREE, o = {}) {
  const n = o.count || 900, R = rng((o.seed || 7) ^ 0x51ed270b), rad = o.radius || 70, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const z = o.cone ? -(0.75 + 0.25 * R()) : 2 * R() - 1, th = R() * 6.2832, k = Math.sqrt(1 - z * z), rr = rad * (0.9 + 0.2 * R()); pos.set([rr * k * Math.cos(th), rr * k * Math.sin(th), rr * z], 3 * i);
    const u = R(), big = u > 0.975 ? 2 : u > 0.92 ? 1 : 0, sz = big === 2 ? 60 + 50 * R() : big === 1 ? 18 + 18 * R() : 1.8 + 3.0 * R() * R();
    const c = R(), tc = o.tint === 'natural' ? (c < 0.5 ? [1, 0.95, 0.85] : c < 0.8 ? [0.85, 0.9, 1] : [1, 0.75, 0.5]) : (c < 0.65 ? [0.75, 0.85, 1] : c < 0.85 ? [1, 0.97, 0.9] : [1, 0.7, 0.45]);
    const br = big ? 1 : 0.35 + 0.65 * R(); col.set([tc[0] * br, tc[1] * br, tc[2] * br], 3 * i); size[i] = sz * (o.size || 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = spikeMaterial(THREE, o.spikes || 8), pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -1;
  pts.setPixelRatio = v => { m.uniforms.uPx.value = v; }; pts.dispose = () => { g.dispose(); m.dispose(); };
  return pts;
}

// ---------------------------------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------------------------------
// createNebula(THREE, spec, opts) -> Group (unit radius). opts: { pal:'natural'|'nircam'|'hubble' (or hubble:true),  approach:'march'|'slices', slices:36, params:{...overrides} }
export function createNebula(THREE, spec = {}, opts = {}) {
  const P = Object.assign(nebulaParams(spec), opts.params || {}), pal = palette(opts.pal || opts.hubble), group = new THREE.Group(), disposables = [], tickers = [];
  const tex = getNoiseTexture(THREE);
  const V3 = a => new THREE.Vector3(...a);
  const uni = {
    uTex: { value: tex }, uTime: { value: 0 }, uMode: { value: P.mode }, uWarp: { value: P.warp }, uScale: { value: P.scale }, uFil: { value: P.fil }, uLo: { value: P.lo }, uHi: { value: P.hi },
    uBright: { value: P.bright }, uExpo: { value: P.expo }, uDust: { value: P.dust }, uBack: { value: P.back }, uIonK: { value: P.ionK }, uOiiiAmt: { value: P.oiiiAmt },
    uShellR: { value: P.shellR }, uShellW: { value: P.shellW }, uElong: { value: P.elong }, uBip: { value: P.bip }, uLobe: { value: P.lobe }, uLobeR: { value: P.lobeR }, uRough: { value: P.rough },
    uFilPow: { value: P.filPow }, uPwn: { value: P.pwn }, uSync: { value: P.sync }, uNPil: { value: P.pil.length }, uJetAmt: { value: P.jets }, uSat: { value: P.sat }, uTone: { value: P.tone },
    uPil: { value: Array.from({ length: 5 }, (_, i) => new THREE.Vector4(...(P.pil[i] || [0, 0, 0, 0.1]))) },
    uRim: { value: V3(pal.rim) }, uBodyC: { value: V3(pal.body) }, uHaze: { value: V3(pal.haze) }, uJet: { value: V3(pal.jet) }, uEcho: { value: V3(pal.echo) }, uGlow: { value: V3(pal.glow) }, uFringe: { value: V3(pal.fringe) }, uCore: { value: V3(P.coreCol) },
    uOff: { value: V3(P.off) }, uStar: { value: V3(P.star) }, uHa: { value: V3(pal.ha) }, uOiii: { value: V3(pal.oiii) }, uSii: { value: V3(pal.sii) }, uRefl: { value: V3(pal.refl) }, uStarCol: { value: V3(P.starCol) },
  };
  const tilt = new THREE.Group(); tilt.rotation.set(P.tilt[0] * 0.3, P.tilt[1], 0); group.add(tilt);   // random orientation so two bipolar nebulae are not both seen along the same axis
  const approach = opts.approach || 'march';
  let march = null, slices = null;
  const pxOf = (renderer, camera, obj) => {   // projected radius of the unit sphere in device pixels
    const wp = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld), d = Math.max(wp.distanceTo(camera.position), 1e-3);
    const sc = obj.matrixWorld.getMaxScaleOnAxis(), h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    return d < sc * 1.05 ? 1e4 : h * 0.5 * camera.projectionMatrix.elements[5] * sc / d;
  };
  if (approach === 'march') {
    const g = new THREE.SphereGeometry(1.04, 36, 18), m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: MARCH_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: Object.assign({ uActive: { value: 1 }, uSteps: { value: 24 }, uDetail: { value: 1 }, uFrame: { value: 0 } }, uni) });
    march = new THREE.Mesh(g, m); march.frustumCulled = false; tilt.add(march); disposables.push(g, m);
  } else {
    const N = opts.slices || 36, g = new THREE.PlaneGeometry(2.3, 2.3), m = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SLICE_VERT, fragmentShader: SLICE_FRAG, transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: Object.assign({ uInv: { value: new THREE.Matrix4() }, uDt: { value: 2 / N }, uDetail: { value: 1 } }, uni) });
    slices = []; for (let i = 0; i < N; i++) { const s = new THREE.Mesh(g, m); s.frustumCulled = false; s.renderOrder = 10 + i; group.add(s); slices.push(s); }   // renderOrder = back to front
    disposables.push(g, m); slices.mat = m;
  }
  // far LOD: a soft additive glow when the whole object is only a few pixels
  const gg = new THREE.PlaneGeometry(2.4, 2.4), gm = new THREE.ShaderMaterial({ vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Vector3(...(P.mode === 1 ? pal.refl : P.mode === 3 ? pal.oiii : P.mode === 5 ? pal.haze : P.mode === 6 ? pal.echo : P.mode === 7 ? pal.glow : pal.ha)) }, uA: { value: P.mode === 2 ? 0 : 0.5 }, uActive: { value: 0 } } });
  const glow = new THREE.Mesh(gg, gm); glow.frustumCulled = false; group.add(glow); disposables.push(gg, gm);
  // embedded stars: HII regions get an O/B cluster, reflection nebulae one bright star; sizes in px
  let starMat = null;
  if (P.nStars > 0) {
    const R = rng(P.seed ^ 0x9e3779b9), n = P.nStars, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) { const big = i === 0, r = big ? 0 : Math.pow(R(), 0.7) * 0.5, th = R() * 6.28, ph = Math.acos(2 * R() - 1);
      pos[3 * i] = P.star[0] + r * Math.sin(ph) * Math.cos(th); pos[3 * i + 1] = P.star[1] + r * Math.cos(ph); pos[3 * i + 2] = P.star[2] + r * Math.sin(ph) * Math.sin(th);
      const k = big ? 1 : 0.35 + 0.65 * R(), bl = 0.6 + 0.4 * R(); col[3 * i] = (0.7 + 0.3 * (1 - bl)) * k; col[3 * i + 1] = (0.8 + 0.1 * (1 - bl)) * k; col[3 * i + 2] = k; size[i] = big ? 14 : 3 + 7 * R() * R(); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } } });
    const pts = new THREE.Points(sg, starMat); pts.frustumCulled = false; tilt.add(pts); disposables.push(sg, starMat);
  }
  if (P.mode === 3 || (P.mode === 4 && P.pwn)) {   // central star / pulsar
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3)); sg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([0.85, 0.95, 1]), 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([10]), 1));
    starMat = starMat || new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: { value: 1 } } });
    const pts = new THREE.Points(sg, starMat); pts.frustumCulled = false; tilt.add(pts); disposables.push(sg);
  }
  let spikeMat = null;
  if (P.mode === 6) {   // the echo's red central star, with its own cross-shaped diffraction spikes
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3)); sg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([1, 0.35, 0.3]), 3)); sg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([130]), 1));
    spikeMat = spikeMaterial(THREE, 4); const pts = new THREE.Points(sg, spikeMat); pts.frustumCulled = false; pts.renderOrder = 5; tilt.add(pts); disposables.push(sg, spikeMat);
  }
  let frame = 0;
  // LOD: <14 px radius -> glow quad only; 14-60 px -> 10 steps, no warp/detail taps; 60-300 px -> 14 steps; >300 px or camera inside -> 20 steps + full detail.
  group.update = (camera, renderer) => {
    group.updateMatrixWorld(); const px = pxOf(renderer, camera, group), pr = renderer.getPixelRatio?.() || 1;
    const lodSteps = opts.steps || (px < 60 ? 10 : px < 300 ? 14 : 20) + (P.mode === 5 && px >= 60 ? 16 : 0), detail = px < 60 ? 0 : 1, far = px < 14 && !opts.noGlow;
    gm.uniforms.uActive.value = far ? 1 : 0; gg.userData.px = px;
    glow.quaternion.copy(camera.quaternion).premultiply(group.quaternion.clone().invert());   // billboard
    if (starMat) starMat.uniforms.uPx.value = Math.max(0.6, Math.min(1.4, px / 250)) * pr;
    if (spikeMat) spikeMat.uniforms.uPx.value = Math.max(0.5, Math.min(1.6, px / 300)) * pr;
    if (march) { march.material.uniforms.uActive.value = far ? 0 : 1; march.material.uniforms.uSteps.value = lodSteps; march.material.uniforms.uDetail.value = detail; march.material.uniforms.uFrame.value = (frame++ % 64) * 7.31; }
    if (slices) {
      const N = slices.length, fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
      const wp = new THREE.Vector3().setFromMatrixPosition(group.matrixWorld), sc = group.matrixWorld.getMaxScaleOnAxis();
      slices.forEach((s, i) => { const k = (i + 0.5) / N * 2 - 1; s.position.copy(wp).addScaledVector(fwd, k * sc); s.quaternion.copy(camera.quaternion); s.scale.setScalar(sc); s.visible = !far; s.updateMatrixWorld(); });
      slices.mat.uniforms.uInv.value.copy(tilt.matrixWorld).invert(); slices.mat.uniforms.uDt.value = 2 / N; slices.mat.uniforms.uDetail.value = detail;
    }
    return px;
  };
  group.tick = t => { uni.uTime.value = t; for (const f of tickers) f(t); tilt.rotation.y = P.tilt[1] + t * P.spin; };
  group.dispose = () => { for (const d of disposables) d.dispose?.(); };
  group.userData = { params: P, uniforms: uni, kind: 'nebula', cls: P.cls };
  group.viewRadius = 1.4;
  return group;
}
