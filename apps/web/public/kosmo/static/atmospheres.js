// atmospheres.js — single-scattering atmospheres (Rayleigh + Mie, analytic ray-march) and the Venus / Mars / Titan cloud decks.
// Contract: planet-layers.js. Both layers are created lazily the first time layers.state.atmosphere / .clouds is on and hidden when off.
//
// Atmosphere: a shell sphere a few % of the radius thick (exaggerated so it reads from space; the scale height is scaled with it) is
// ray-marched in VIEW space: camera at the origin, planet centre = modelViewMatrix * (0,0,0,1), radius from the matrix scale, Sun direction
// = ctx.lightView (the very Vector3 the body shader dots with its normals, so the terminators agree). Premultiplied blend: rgb = in-scattered
// light, alpha = 1 - transmittance, so the limb glows and the ground behind is dimmed. From inside the shell the faces are flipped.
// Earth's own cloud shell lives in earth-layers.js (it reads layers.state.clouds itself); the decks for Venus, Mars and Titan are here.
import { layers } from './layers.js';

const ATM_VERT = /* glsl */`
uniform float uRa;
varying vec3 vView; varying vec3 vC; varying float vS;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vC = c.xyz; vS = length(modelViewMatrix[0].xyz) / uRa;          // planet radius in view units (the shell mesh is scaled by uRa)
  gl_Position = projectionMatrix * mv;
}`;

const ATM_FRAG = /* glsl */`
precision highp float;
uniform vec3 uSun, uSigR, uSigM, uSigA, uG;
uniform float uRa, uHn, uMh, uI;
varying vec3 vView; varying vec3 vC; varying float vS;
const int NV = 20; const int NL = 5;
// density-weighted optical depth towards the Sun from p (normalised units, planet radius 1)
vec3 lightTau(vec3 p, vec3 L, float H, float Hm){
  float b = dot(p, L), c = dot(p, p) - uRa * uRa;
  float len = -b + sqrt(max(b * b - c, 0.0));
  vec3 tau = vec3(0.0);
  for (int j = 0; j < NL; j++) {
    vec3 q = p + L * (len * (float(j) + 0.5) / float(NL));
    float h = max(length(q) - 1.0, 0.0);
    tau += (uSigR + uSigA) * exp(-h / H) + uSigM * exp(-h / Hm);
  }
  return tau * (len / float(NL));
}
void main(){
  vec3 d = normalize(vView);
  vec3 o = -vC / vS;                                               // camera in planet radii, centre at the origin
  float b = dot(o, d), oo = dot(o, o);
  float cA = oo - uRa * uRa, discA = b * b - cA;
  if (discA <= 0.0) discard;
  float sA = sqrt(discA);
  float t0 = max(-b - sA, 0.0), t1 = -b + sA;
  if (t1 <= 0.0) discard;
  float cP = oo - 1.0, discP = b * b - cP;
  if (discP > 0.0) { float tp = -b - sqrt(discP); if (tp > 0.0) t1 = min(t1, tp); }
  float len = t1 - t0;
  if (len <= 0.0) discard;
  float ds = len / float(NV);
  vec3 L = normalize(uSun);
  float mu = dot(d, L);
  vec3 pR = vec3(0.75 * (1.0 + mu * mu));
  vec3 g = uG, pM = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, vec3(1.5));
  float Hm = uHn * uMh;
  vec3 tauV = vec3(0.0), sum = vec3(0.0);
  for (int i = 0; i < NV; i++) {
    vec3 p = o + d * (t0 + ds * (float(i) + 0.5));
    float r = length(p), h = max(r - 1.0, 0.0);
    float rhoR = exp(-h / uHn), rhoM = exp(-h / Hm);
    vec3 dtau = ((uSigR + uSigA) * rhoR + uSigM * rhoM) * ds;
    // planet shadow (soft: the real terminator is smeared by refraction and the Sun's disc)
    float pl = dot(p, L); float perp = sqrt(max(dot(p, p) - pl * pl, 0.0));
    float sh = mix(1.0, smoothstep(0.93, 1.07, perp), smoothstep(0.0, -0.12, pl));   // continuous across the terminator plane
    vec3 tauL = lightTau(p, L, uHn, Hm);
    vec3 Tv = exp(-(tauV + 0.5 * dtau));
    sum += Tv * exp(-tauL) * sh * (uSigR * rhoR * pR + uSigM * rhoM * pM) * ds;
    tauV += dtau;
  }
  vec3 col = sum * uI;
  col = 1.0 - exp(-col * 1.35);                                    // soft tone map: stays inside [0, 1]
  vec3 T = exp(-tauV);
  float a = clamp(1.0 - dot(T, vec3(0.3, 0.5, 0.2)), 0.0, 1.0);
  gl_FragColor = vec4(col, a);
}`;

// per-kind scattering. tau0 vectors are VERTICAL optical depths (rgb) at the surface of the exaggerated shell; T = shell thickness in radii,
// hn = scale height as a fraction of T, mh = Mie scale height relative to the Rayleigh one, g = Henyey-Greenstein asymmetry per channel, I = sun gain.
const KIND = {
  earth:  { T: 0.045, hn: 0.26, R: [0.05, 0.115, 0.28], M: [0.035, 0.035, 0.035], A: [0, 0, 0], g: [0.76, 0.76, 0.76], mh: 0.25, I: 0.8 },
  venus:  { T: 0.04, hn: 0.3, R: [0.03, 0.06, 0.12], M: [0.22, 0.19, 0.09], A: [0.0, 0.02, 0.1], g: [0.55, 0.55, 0.55], mh: 1.0, I: 1.1 },
  mars:   { T: 0.04, hn: 0.35, R: [0.02, 0.05, 0.13], M: [0.16, 0.12, 0.07], A: [0.01, 0.04, 0.1], g: [0.55, 0.66, 0.82], mh: 0.9, I: 0.9 },
  titan:  { T: 0.08, hn: 0.2, R: [0.02, 0.04, 0.09], M: [0.6, 0.36, 0.1], A: [0.1, 0.4, 1.1], g: [0.6, 0.6, 0.6], mh: 1.4, I: 0.9 },
  giant:  { T: 0.05, hn: 0.17, R: null, M: [0.02, 0.02, 0.02], A: null, g: [0.2, 0.2, 0.2], mh: 1.0, I: 1.2 },
};

function atmParams(spec, atm) {
  const k = KIND[atm.kind] || KIND.giant, T = k.T, hn = T * k.hn;
  let R = k.R, M = k.M, A = k.A, g = k.g;
  if (atm.kind === 'earth' && atm.rayleigh) { R = atm.rayleigh.map(b => b * atm.H); M = [1, 1, 1].map(() => (atm.mie || 21e-6) * 1200); if (atm.mieG != null) g = [atm.mieG, atm.mieG, atm.mieG]; }
  if (!R) {                                                        // hydrogen giants: scatter in the tint colour; methane eats the red on the ice giants
    const t = atm.tint || [0.7, 0.75, 0.9], ice = /uranus|neptune/i.test(String(spec.name || ''));
    R = t.map(c => c * 0.4); A = t.map(c => (1 - c) * (ice ? 0.35 : 0.06));
  }
  return { T, hn, R, M, A: A || [0, 0, 0], g, mh: k.mh, I: k.I };
}

// ---- cloud decks -------------------------------------------------------------------------------------------------------------------------
const CLOUD_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP; varying vec3 vV; varying vec3 vLo;
uniform vec3 uSun;
void main(){
  vN = normalize(normalMatrix * normal); vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz);
  vec3 m0 = modelViewMatrix[0].xyz, m1 = modelViewMatrix[1].xyz, m2 = modelViewMatrix[2].xyz;
  float s2 = dot(m0, m0);
  vLo = vec3(dot(m0, uSun), dot(m1, uSun), dot(m2, uSun)) / s2;   // the Sun in the cloud layer's own (rotating) frame
  gl_Position = projectionMatrix * mv;
}`;

const CLOUD_FRAG = /* glsl */`
precision highp float;
uniform float uType, uTime, uSeed;
uniform vec3 uSun;
varying vec3 vN; varying vec3 vP; varying vec3 vV; varying vec3 vLo;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.07 + vec3(11.3, 5.1, 7.7); a *= 0.5; } return s; }
// Venus: UV-like streaky banded sulfuric deck. d in 0..1 (bright = high, thick cloud)
float venusD(vec3 q){
  float lat = asin(clamp(q.y, -1.0, 1.0)), lon = atan(q.z, q.x);
  vec3 p = vec3(q.x * 0.8, q.y * 3.6, q.z * 0.8) * 1.5 + uSeed;
  vec3 w = vec3(fbm(p * 0.8 + 1.3), fbm(p * 0.8 + 6.1), fbm(p * 0.8 + 2.9)) - 0.5;
  float d = fbm(p + w * 2.2);
  d += 0.16 * sin(lat * 5.0 + w.x * 5.0) + 0.1 * sin(lat * 13.0 + w.y * 6.0);   // zonal bands
  d += 0.14 * sin(abs(lat) * 3.0 - lon * 0.0 + w.z * 3.0) * smoothstep(0.1, 0.6, abs(lat));   // the 'Y' / chevron shear towards mid latitudes
  return clamp(d, 0.0, 1.0);
}
float marsIce(vec3 q){
  float al = abs(q.y);
  vec3 p = vec3(q.x, q.y * 1.8, q.z) * 3.0 + uSeed;
  vec3 w = vec3(fbm(p * 0.7), fbm(p * 0.7 + 5.0), fbm(p * 0.7 + 9.0)) - 0.5;
  float d = fbm(p + w * 1.4) + 0.3 * smoothstep(0.62, 0.95, al) + 0.09 * smoothstep(0.1, 0.0, al);   // polar hoods, a thin equatorial belt
  return smoothstep(0.64, 0.86, d);
}
float marsDust(vec3 q){ return smoothstep(0.58, 0.82, fbm(q * 1.4 + uSeed + vec3(uTime * 0.0006, 0.0, 0.0))); }
float titanD(vec3 q){
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float w = fbm(q * 2.0 + uSeed);
  return 0.5 + 0.25 * sin(lat * 7.0 + w * 3.0) + 0.25 * (w - 0.5) + 0.2 * smoothstep(0.7, 1.4, lat);   // detached layer: banded, thicker at the north pole
}
void main(){
  vec3 q = normalize(vP), n = normalize(vN), v = normalize(vV), sun = normalize(uSun);
  float ndl = dot(n, sun), ndv = max(dot(n, v), 0.0);
  vec3 ts = vLo - q * dot(vLo, q);                                  // sun direction tangent to the layer, in its own frame
  vec3 col; float a;
  if (uType < 0.5) {                                               // Venus: opaque deck
    float d = venusD(q);
    float dS = venusD(normalize(q + ts * 0.035));                  // the cloud a little sunwards: if it is higher than this one, it shades it
    float shade = 1.0 - 0.45 * clamp((dS - d) * 5.0, 0.0, 1.0);
    vec3 base = mix(vec3(0.74, 0.62, 0.38), vec3(1.0, 0.94, 0.7), smoothstep(0.25, 0.85, d));
    base = mix(base, vec3(0.78, 0.74, 0.72), 0.18 * smoothstep(0.55, 0.15, d));     // faint UV-absorber bluish-grey streaks
    float day = smoothstep(-0.14, 0.55, ndl);
    float lit = 0.015 + 1.05 * day * (0.8 + 0.2 * ndl);
    col = base * lit * shade;
    col += vec3(1.0, 0.6, 0.32) * 0.16 * smoothstep(-0.05, 0.1, ndl) * (1.0 - smoothstep(0.1, 0.38, ndl));   // sunset edge
    a = 1.0;
  } else if (uType < 1.5) {                                        // Mars: thin water-ice clouds and drifting dust haze
    float ice = marsIce(q), dust = marsDust(q) * 0.3;
    float iceS = marsIce(normalize(q + ts * 0.03));
    float shade = 1.0 - 0.35 * clamp((iceS - ice) * 4.0, 0.0, 1.0);
    float day = smoothstep(-0.14, 0.4, ndl);
    vec3 iceCol = mix(vec3(0.9, 0.93, 0.98), vec3(0.7, 0.78, 0.9), 1.0 - day) * shade;
    vec3 dustCol = vec3(0.86, 0.6, 0.36);
    a = clamp(ice * 0.62 + dust * (1.0 - ice * 0.5), 0.0, 0.7);
    col = mix(dustCol, iceCol, ice * 0.62 / max(a, 1e-3)) * (0.02 + 1.0 * day);
    col += vec3(0.5, 0.65, 1.0) * 0.12 * smoothstep(-0.1, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.3, ndl)) * a;   // bluish sunset on Mars
    a *= 1.0 - 0.3 * (1.0 - ndv);
  } else {                                                         // Titan: detached orange haze layer
    float d = titanD(q);
    float graz = 1.0 - ndv;
    a = clamp(0.2 + 0.22 * d + 0.6 * pow(graz, 3.0), 0.0, 0.9);
    float day = smoothstep(-0.38, 0.4, ndl);                       // forward scattering keeps the haze glowing past the terminator
    col = mix(vec3(0.62, 0.34, 0.1), vec3(1.0, 0.64, 0.22), clamp(d, 0.0, 1.0)) * (0.03 + 1.0 * day);
    col += vec3(1.0, 0.5, 0.18) * 0.25 * pow(graz, 2.0) * smoothstep(-0.5, 0.2, ndl);
  }
  gl_FragColor = vec4(col, a);
}`;

export function addAtmosphere(THREE, group, spec, profile, ctx) {
  const atm = profile.atm;
  if (!atm) return null;
  const sunRef = () => ctx.lightView || group.userData.lightView || (group.userData.lightView = (group.userData.lightDir || new THREE.Vector3(0.55, 0.35, 0.76).normalize()).clone());
  const sphere = ctx.sphere || (() => new THREE.SphereGeometry(1, 48, 24));
  const own = [];
  let atmMesh = null, cloudMesh = null, cloudMat = null;
  const kind = atm.kind || 'giant';
  const deckType = kind === 'venus' ? 0 : kind === 'mars' ? 1 : kind === 'titan' ? 2 : -1;     // Earth's deck is earth-layers.js
  let lastSpin = ctx.spin(), cloudAng = 0;
  const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);

  function buildAtmosphere() {
    const P = atmParams(spec, atm), Ra = 1 + P.T, Hn = P.hn;
    const mat = new THREE.ShaderMaterial({
      vertexShader: ATM_VERT, fragmentShader: ATM_FRAG, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uSun: { value: sunRef() },                                  // the shared view-space vector: kept by reference, never copied
        uRa: { value: Ra }, uHn: { value: Hn }, uMh: { value: P.mh }, uI: { value: P.I },
        uSigR: { value: v3(P.R.map(x => x / Hn)) }, uSigM: { value: v3(P.M.map(x => x / (Hn * P.mh))) }, uSigA: { value: v3(P.A.map(x => x / Hn)) }, uG: { value: v3(P.g) },
      },
    });
    const m = new THREE.Mesh(sphere(64), mat);
    m.scale.setScalar(Ra); m.renderOrder = 6; m.frustumCulled = false; m.name = 'atmosphere';
    const wp = new THREE.Vector3(), cp = new THREE.Vector3();
    m.onBeforeRender = (r, sc, cam) => {                            // camera inside the shell: draw the inner faces and ignore depth (the ray-march handles the planet)
      wp.setFromMatrixPosition(m.matrixWorld); cp.setFromMatrixPosition(cam.matrixWorld);
      const inside = wp.distanceTo(cp) < m.matrixWorld.getMaxScaleOnAxis() * 0.999;
      mat.side = inside ? THREE.BackSide : THREE.FrontSide; mat.depthTest = !inside;
    };
    group.add(m); own.push(mat); return m;
  }

  function buildClouds() {
    cloudMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: deckType === 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uType: { value: deckType }, uTime: { value: 0 }, uSeed: { value: 3.7 + deckType * 5.1 }, uSun: { value: sunRef() } },
    });
    const m = new THREE.Mesh(sphere(64), cloudMat);
    m.scale.setScalar(deckType === 0 ? 1.012 : deckType === 1 ? 1.008 : 1.05); m.renderOrder = 4; m.name = 'clouds';
    group.add(m); own.push(cloudMat); return m;
  }

  return {
    tick(t) {
      const st = layers.state;
      if (st.atmosphere) { if (!atmMesh) atmMesh = buildAtmosphere(); atmMesh.visible = true; } else if (atmMesh) atmMesh.visible = false;
      if (deckType >= 0 && st.clouds) {
        if (!cloudMesh) cloudMesh = buildClouds();
        cloudMesh.visible = true; cloudMat.uniforms.uTime.value = t;
        // super-rotation: Venus' deck circles in ~4 days against the 243-day (retrograde) turn of the surface, ~60x faster, same sense. Follow the
        // planet's spin by increments so the wrap of the spin angle never jumps the clouds.
        const s = ctx.spin(); let dth = s - lastSpin; lastSpin = s; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
        cloudAng += dth * (deckType === 0 ? 59.75 : deckType === 1 ? 0.01 : 0.02);
        cloudMesh.rotation.y = cloudAng;
      } else if (cloudMesh) { cloudMesh.visible = false; lastSpin = ctx.spin(); }
    },
    dispose() { for (const m of [atmMesh, cloudMesh]) if (m) m.parent?.remove(m); for (const d of own) d.dispose(); },
  };
}
