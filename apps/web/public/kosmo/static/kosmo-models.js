// kosmo-models.js — procedural, shader-based 3D models for celestial objects, vanilla three.js.
//
//   import * as THREE from 'three';
//   import { createModel, KosmoViewer, textures } from './kosmo-models.js';
//   const model = createModel(THREE, { type: 'exoplanet', name: 'Kepler-22 b', mass_kg: 2e25 });  // unit radius
//   const viewer = new KosmoViewer(THREE);  viewer.attach(canvas2d, spec, { autoRotate: true });
//
// Design: one shared WebGL renderer draws into any number of ordinary 2D canvases (cards, hero views),
// rendering only the ones on screen. Every body is a unit-radius mesh with a ShaderMaterial, so a caller
// scales it to true size. Each material has a `uMap` slot: register an equirectangular image for a name
// or a type with `textures.register(key, url)` and the shader samples it instead of the procedural surface
// (procedural detail still modulates lighting). Seeds come from the object's name, so a given object
// always looks the same.

// ---------------------------------------------------------------------------------------------------
// GLSL building blocks
// ---------------------------------------------------------------------------------------------------
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;} vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p=p*2.03+vec3(17.1,9.2,3.7);a*=0.5;}return f;}
`;
const BODY_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP; varying vec2 vUv; varying vec3 vW;
void main(){ vN = normalize(normalMatrix * normal); vP = position; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

// Planets, moons, rocky and icy bodies, gas giants. kind: 0 rocky, 1 gas giant, 2 icy, 3 lava, 4 ocean/earthlike
const BODY_FRAG = NOISE + /* glsl */`
uniform float uTime, uSeed, uKind, uHasMap, uAtmo; uniform vec3 uColor, uColor2, uColor3, uLightDir; uniform sampler2D uMap;
varying vec3 vN; varying vec3 vP; varying vec2 vUv; varying vec3 vW;
void main(){
  vec3 p = normalize(vP) * 2.2 + uSeed;
  vec3 col; float h;
  if (uKind > 0.5 && uKind < 1.5) {                       // gas giant: latitude bands warped by noise
    float lat = p.y * 0.45 / 2.2 * 2.2;
    float warp = fbm(p * 1.6 + vec3(uTime * 0.02, 0.0, 0.0)) * 0.35;
    float band = sin((lat + warp) * 11.0 + uSeed) * 0.5 + 0.5;
    float band2 = sin((lat + warp * 0.6) * 27.0 + 1.3) * 0.5 + 0.5;
    col = mix(uColor, uColor2, band); col = mix(col, uColor3, band2 * 0.35);
    float storm = smoothstep(0.55, 0.8, fbm(p * 3.0 + vec3(2.0))); col = mix(col, uColor3 * 1.2, storm * 0.5);
    h = 0.0;
  } else {
    h = fbm(p * 1.3); float ridges = 1.0 - abs(fbm(p * 3.1 + 5.0));
    if (uKind > 3.5) {                                    // ocean world: sea below a shoreline, land above, polar ice
      float land = smoothstep(0.02, 0.12, h);
      col = mix(uColor, mix(uColor2, uColor3, smoothstep(0.1, 0.4, h + ridges * 0.2)), land);
      float ice = smoothstep(0.75, 0.9, abs(normalize(vP).y) + h * 0.2); col = mix(col, vec3(0.92, 0.95, 1.0), ice);
    } else if (uKind > 2.5) {                             // lava: dark crust, glowing cracks
      float crack = smoothstep(0.35, 0.6, ridges * ridges); col = mix(uColor, uColor2, crack) + uColor3 * crack * 0.6;
    } else {                                              // rocky / icy: craters and terrain
      float crater = smoothstep(0.62, 0.7, fbm(p * 6.0 + 9.0));
      col = mix(uColor, uColor2, smoothstep(-0.3, 0.5, h + ridges * 0.3)); col = mix(col, uColor3, crater * 0.6);
      if (uKind > 1.5) col = mix(col, vec3(0.9, 0.95, 1.0), smoothstep(0.1, 0.5, h) * 0.5);
    }
  }
  if (uHasMap > 0.5) { vec3 t = texture2D(uMap, vUv).rgb; col = t * (0.85 + 0.3 * h); }
  vec3 n = normalize(vN); float diff = max(dot(n, uLightDir), 0.0);
  float terminator = smoothstep(-0.15, 0.25, dot(n, uLightDir));
  vec3 lit = col * (0.06 + 0.94 * diff);
  if (uAtmo > 0.0) { float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.5); lit += uColor3 * rim * uAtmo * terminator; }
  gl_FragColor = vec4(lit, 1.0);
}`;

// Stars: limb darkening, granulation, hotter colour towards the centre of cells
const STAR_FRAG = NOISE + /* glsl */`
uniform float uTime, uSeed, uHasMap; uniform vec3 uColor, uColor2; uniform sampler2D uMap;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
void main(){
  vec3 p = normalize(vP) * 6.0 + uSeed;
  float g = fbm(p + vec3(0.0, 0.0, uTime * 0.08)) * 0.5 + 0.5;
  float spots = smoothstep(0.78, 0.86, fbm(p * 0.5 + 3.0 + uTime * 0.01));
  vec3 col = mix(uColor2, uColor, g);
  if (uHasMap > 0.5) col = texture2D(uMap, vUv).rgb * (0.8 + 0.4 * g);
  col = mix(col, col * 0.35, spots * 0.8);
  float mu = max(dot(normalize(vN), vec3(0.0, 0.0, 1.0)), 0.0); float limb = 0.35 + 0.65 * pow(mu, 0.6);
  gl_FragColor = vec4(col * limb * 1.4, 1.0);
}`;

// Additive glow sprite (coronae, photon rings, nebular haze); uShape 0 soft disc, 1 ring, 2 fbm cloud
const SPRITE_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPRITE_FRAG = NOISE + /* glsl */`
uniform vec3 uColor, uColor2; uniform float uShape, uTime, uSeed, uSoft, uAlpha; varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5; float r = length(q) * 2.0; float a;
  if (uShape < 0.5) a = pow(max(1.0 - r, 0.0), uSoft);
  else if (uShape < 1.5) { a = exp(-pow((r - 0.72) / 0.06, 2.0)) + 0.25 * exp(-pow((r - 0.72) / 0.25, 2.0)); }
  else { float n = fbm(vec3(q * 3.0, uSeed + uTime * 0.03)); a = smoothstep(0.0, 1.0, (1.0 - r) * 1.2) * (0.55 + 0.6 * n); a *= smoothstep(1.0, 0.6, r); }
  vec3 col = mix(uColor2, uColor, clamp(a, 0.0, 1.0));
  gl_FragColor = vec4(col * a * uAlpha, a * uAlpha);
}`;

// Accretion disc: thin annulus, temperature falls outward, Doppler beaming brightens the approaching side
const DISC_FRAG = NOISE + /* glsl */`
uniform float uTime, uSeed, uInner, uBeam; uniform vec3 uColor, uColor2; varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5; float r = length(q) * 2.0; float ang = atan(q.y, q.x);
  if (r < uInner || r > 1.0) discard;
  float t = (r - uInner) / (1.0 - uInner);
  float spiral = fbm(vec3(cos(ang) * 2.0, sin(ang) * 2.0, r * 6.0 - uTime * 0.6 + uSeed)) * 0.5 + 0.5;
  float bright = pow(1.0 - t, 1.6) * (0.6 + 0.8 * spiral);
  float doppler = 1.0 + uBeam * cos(ang);
  vec3 col = mix(uColor2, uColor, pow(1.0 - t, 2.0)) * bright * doppler;
  float edge = smoothstep(uInner, uInner + 0.04, r) * smoothstep(1.0, 0.85, r);
  gl_FragColor = vec4(col * edge, edge * (0.5 + 0.5 * bright));
}`;

// Points (galaxies, clusters): soft round sprites with size attenuation
const POINT_VERT = /* glsl */`attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uScale; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const POINT_FRAG = /* glsl */`varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 1.8); gl_FragColor = vec4(vC * a, a); }`;

// ---------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------
export function seedOf(name) { let h = 2166136261; for (const c of String(name || 'x')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 100; }
function rng(seed) { let s = Math.floor(seed * 1e4) >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// black-body colour, sRGB 0..1, from temperature in K (Tanner Helland fit, clamped 1000–40000 K)
export function blackbody(T) {
  const t = Math.min(40000, Math.max(1000, T)) / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = x => Math.min(255, Math.max(0, x)) / 255; return [c(r), c(g), c(b)];
}
const SPECTRAL_T = { O: 35000, B: 15000, A: 8500, F: 6500, G: 5700, K: 4500, M: 3200, L: 1800, T: 1100, W: 50000, D: 12000 };
export function starTemperature(spec) {
  if (spec.temperature_K > 0) return +spec.temperature_K;
  const s = String(spec.spectral_type || '').trim().toUpperCase(); const c = s[0];
  if (SPECTRAL_T[c]) { const d = parseInt(s[1]); const next = { O: 15000, B: 8500, A: 6500, F: 5700, K: 3200, M: 2400, G: 4500 }[c] || SPECTRAL_T[c] * 0.7; return Number.isFinite(d) ? SPECTRAL_T[c] + (next - SPECTRAL_T[c]) * d / 10 : SPECTRAL_T[c]; }
  return 5700;
}
const MEARTH = 5.9722e24, REARTH = 6.371e6, MJUP = 1.89813e27;

// ---------------------------------------------------------------------------------------------------
// texture registry: textures.register('Earth', 'textures/earth.jpg'); textures.register('type:planet', url)
// ---------------------------------------------------------------------------------------------------
export const textures = {
  map: new Map(), cache: new Map(), loader: null,
  register(key, url) { this.map.set(String(key).toLowerCase(), url); },
  urlFor(spec) { return this.map.get(String(spec.name || '').toLowerCase()) || spec.texture || this.map.get(`type:${spec.type}`) || null; },
  load(THREE, url) { if (!this.cache.has(url)) { this.loader ||= new THREE.TextureLoader(); const t = this.loader.load(url); t.colorSpace = THREE.SRGBColorSpace; this.cache.set(url, t); } return this.cache.get(url); },
};

// ---------------------------------------------------------------------------------------------------
// model factory: returns a Group of unit radius with .tick(t) and .dispose()
// ---------------------------------------------------------------------------------------------------
export function classify(spec) {
  const t = String(spec.type || 'other');
  if (t === 'star') { const T = starTemperature(spec); return T < 2500 ? 'browndwarf' : 'star'; }
  if (t === 'white_dwarf') return 'whitedwarf';
  if (t === 'neutron_star' || t === 'pulsar') return 'pulsar';
  if (t === 'black_hole') return 'blackhole';
  if (t === 'quasar') return 'quasar';
  if (t === 'galaxy') return 'galaxy';
  if (t === 'galaxy_cluster' || t === 'star_cluster') return t === 'galaxy_cluster' ? 'gcluster' : 'scluster';
  if (t === 'nebula') return /planetary/i.test(spec.notes || '') ? 'pnebula' : 'nebula';
  if (t === 'supernova_remnant') return 'snr';
  if (t === 'asteroid') return 'asteroid';
  if (t === 'comet') return 'comet';
  if (t === 'planet' || t === 'exoplanet' || t === 'dwarf_planet' || t === 'moon' || t === 'exomoon_candidate') {
    const m = spec.mass_kg, r = spec.radius_m, name = String(spec.name || '').toLowerCase();
    if (name === 'earth') return 'ocean';
    if (name === 'io') return 'lava';
    if ((m && m > 10 * MEARTH) || (r && r > 3 * REARTH)) return 'gasgiant';
    if (spec.period_days && spec.period_days < 3 && (!m || m < 10 * MEARTH)) return 'lava';
    if (name.includes('europa') || name.includes('enceladus') || (spec.semi_major_axis_m > 5 * 1.496e11 && t === 'moon')) return 'icy';
    return 'rocky';
  }
  return 'rocky';
}

const SOLAR_NAMES = new Set(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'moon']);
export function createModel(THREE, spec = {}) {
  const kind = classify(spec), seed = seedOf(spec.name), R = rng(seed), group = new THREE.Group();
  group.userData = { kind, spec };
  const tickers = [], disposables = [];
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const sphere = (segments = spec.segments || 64) => { const g = new THREE.SphereGeometry(1, segments, segments / 2); disposables.push(g); return g; };   // spec.segments lowers the mesh detail for scenes with many bodies
  const addSprite = (size, color, color2, shape, soft = 2.5, alpha = 1, depthWrite = false) => {
    const g = new THREE.PlaneGeometry(size, size), m = new THREE.ShaderMaterial({ vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: color }, uColor2: { value: color2 }, uShape: { value: shape }, uTime: { value: 0 }, uSeed: { value: seed }, uSoft: { value: soft }, uAlpha: { value: alpha } } });
    const s = new THREE.Mesh(g, m); s.onBeforeRender = (r, sc, cam) => { s.quaternion.copy(cam.quaternion); }; group.add(s); disposables.push(g, m); tickers.push(t => { m.uniforms.uTime.value = t; }); return s;
  };
  const bodyMat = (opts) => {
    const url = textures.urlFor(spec), map = url ? textures.load(THREE, url) : null;
    const m = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uKind: { value: opts.kind }, uHasMap: { value: map ? 1 : 0 }, uMap: { value: map || new THREE.Texture() }, uAtmo: { value: opts.atmo || 0 }, uColor: { value: opts.c1 }, uColor2: { value: opts.c2 }, uColor3: { value: opts.c3 }, uLightDir: { value: new THREE.Vector3(0.55, 0.35, 0.76).normalize() } } });
    disposables.push(m); tickers.push(t => { m.uniforms.uTime.value = t; }); group.userData.lightDir = m.uniforms.uLightDir.value; return m;
  };
  const pal = {
    rocky: [[C(0.42, 0.38, 0.34), C(0.62, 0.55, 0.47), C(0.25, 0.22, 0.2)], [C(0.6, 0.45, 0.35), C(0.82, 0.6, 0.42), C(0.35, 0.25, 0.2)], [C(0.5, 0.5, 0.52), C(0.72, 0.72, 0.74), C(0.3, 0.3, 0.32)]],
    gasgiant: [[C(0.85, 0.72, 0.52), C(0.62, 0.48, 0.36), C(0.95, 0.88, 0.75)], [C(0.78, 0.74, 0.6), C(0.92, 0.86, 0.68), C(0.6, 0.5, 0.4)], [C(0.55, 0.78, 0.85), C(0.45, 0.62, 0.8), C(0.8, 0.92, 0.95)], [C(0.35, 0.45, 0.85), C(0.25, 0.3, 0.65), C(0.6, 0.7, 0.95)]],
  };
  const pick = arr => arr[Math.floor(R() * arr.length)];

  switch (kind) {
    case 'ocean': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 4, c1: C(0.08, 0.25, 0.55), c2: C(0.2, 0.42, 0.18), c3: C(0.55, 0.5, 0.35), atmo: 0.6 }))); addSprite(2.3, C(0.4, 0.6, 1.0), C(0, 0, 0), 0, 6, 0.35); break; }
    case 'lava': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 3, c1: C(0.12, 0.08, 0.07), c2: C(1.0, 0.45, 0.1), c3: C(1.0, 0.8, 0.3), atmo: 0 }))); break; }
    case 'icy': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 2, c1: C(0.7, 0.74, 0.8), c2: C(0.88, 0.9, 0.95), c3: C(0.5, 0.55, 0.6), atmo: 0 }))); break; }
    case 'gasgiant': { const [c1, c2, c3] = pick(pal.gasgiant); group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 1, c1, c2, c3, atmo: 0.35 }))); const nm = String(spec.name || '').toLowerCase(); if (nm === 'saturn' || nm === 'uranus' || (!SOLAR_NAMES.has(nm) && R() < 0.3)) { /* Jupiter's and Neptune's rings are too faint to draw at this scale */ const rg = new THREE.RingGeometry(nm === 'uranus' ? 1.6 : 1.25, nm === 'uranus' ? 1.75 : 2.3, 96), rm = new THREE.MeshBasicMaterial({ color: c3, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); const ring = new THREE.Mesh(rg, rm); ring.rotation.x = Math.PI / 2 + 0.3; group.add(ring); disposables.push(rg, rm); } break; }
    case 'rocky': { const [c1, c2, c3] = pick(pal.rocky); group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 0, c1, c2, c3, atmo: spec.type === 'moon' ? 0 : 0.2 }))); break; }
    case 'asteroid': case 'comet': {
      const g = new THREE.IcosahedronGeometry(1, 4); const pos = g.attributes.position; const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = 0.75 + 0.25 * (Math.sin(v.x * 3 + seed) * Math.cos(v.y * 4) + Math.sin(v.z * 5 + v.x * 2)) * 0.6; v.multiplyScalar(n * (kind === 'comet' ? 0.6 : 1)); pos.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); disposables.push(g);
      group.add(new THREE.Mesh(g, bodyMat({ kind: 0, c1: C(0.3, 0.28, 0.26), c2: C(0.5, 0.47, 0.44), c3: C(0.18, 0.17, 0.16) })));
      if (kind === 'comet') { const tail = addSprite(6, C(0.6, 0.8, 1.0), C(0.2, 0.3, 0.5), 2, 2, 0.5); tail.position.set(-2.6, 0.3, 0); tail.scale.set(1, 0.4, 1); }
      break;
    }
    case 'star': case 'browndwarf': {
      const T = starTemperature(spec), [r, g, b] = blackbody(T), c1 = C(r, g, b), c2 = C(r * 0.6, g * 0.45, b * 0.35);
      const url = textures.urlFor(spec), map = url ? textures.load(THREE, url) : null;
      const m = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHasMap: { value: map ? 1 : 0 }, uMap: { value: map || new THREE.Texture() }, uColor: { value: c1 }, uColor2: { value: c2 } } });
      disposables.push(m); tickers.push(t => { m.uniforms.uTime.value = t; });
      group.add(new THREE.Mesh(sphere(), m));
      addSprite(kind === 'browndwarf' ? 2.4 : 3.6, c1, C(r * 0.3, g * 0.2, b * 0.2), 0, 4, kind === 'browndwarf' ? 0.35 : 0.8);
      addSprite(6, c1, C(0, 0, 0), 0, 9, 0.35);
      break;
    }
    case 'whitedwarf': { const c1 = C(0.85, 0.9, 1.0); const m = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHasMap: { value: 0 }, uMap: { value: new THREE.Texture() }, uColor: { value: c1 }, uColor2: { value: C(0.6, 0.7, 1.0) } } }); disposables.push(m); group.add(new THREE.Mesh(sphere(32), m)); addSprite(4, c1, C(0.2, 0.3, 0.6), 0, 5, 0.7); break; }
    case 'pulsar': {
      const c1 = C(0.8, 0.9, 1.0); const m = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHasMap: { value: 0 }, uMap: { value: new THREE.Texture() }, uColor: { value: c1 }, uColor2: { value: C(0.5, 0.6, 1.0) } } }); disposables.push(m);
      group.add(new THREE.Mesh(sphere(32), m)); addSprite(3, c1, C(0.2, 0.3, 0.7), 0, 5, 0.6);
      const beams = new THREE.Group(); beams.rotation.z = 0.6;   // magnetic axis tilted from the spin axis
      for (const sgn of [1, -1]) { const cg = new THREE.ConeGeometry(0.9, 5, 24, 1, true), cm = new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const cone = new THREE.Mesh(cg, cm); cone.position.y = sgn * 3.2; cone.rotation.x = sgn > 0 ? Math.PI : 0; beams.add(cone); disposables.push(cg, cm); }
      group.add(beams); tickers.push(t => { beams.rotation.y = t * 4; });
      // field lines: a few torus arcs
      for (let k = 0; k < 4; k++) { const tg = new THREE.TorusGeometry(1.8 + k * 0.5, 0.012, 6, 64, Math.PI), tm = new THREE.MeshBasicMaterial({ color: 0x5f9bff, transparent: true, opacity: 0.35 }); const a = new THREE.Mesh(tg, tm); a.rotation.y = k * Math.PI / 2; a.rotation.z = 0.6; group.add(a); disposables.push(tg, tm); }
      break;
    }
    case 'blackhole': case 'quasar': {
      const hole = new THREE.Mesh(sphere(48), new THREE.MeshBasicMaterial({ color: 0x000000 })); group.add(hole); disposables.push(hole.material);
      const dg = new THREE.PlaneGeometry(7, 7), dm = new THREE.ShaderMaterial({ vertexShader: SPRITE_VERT, fragmentShader: DISC_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uInner: { value: 0.36 }, uBeam: { value: 0.55 }, uColor: { value: C(1.0, 0.92, 0.75) }, uColor2: { value: C(0.9, 0.35, 0.1) } } });
      const disc = new THREE.Mesh(dg, dm); disc.rotation.x = Math.PI / 2 - 0.35; group.add(disc); disposables.push(dg, dm); tickers.push(t => { dm.uniforms.uTime.value = t; });
      addSprite(2.6, C(1.0, 0.9, 0.7), C(1.0, 0.5, 0.2), 1, 1, 0.9);           // photon ring
      if (kind === 'quasar') { for (const sgn of [1, -1]) { const cg = new THREE.CylinderGeometry(0.15, 0.6, 9, 16, 1, true), cm = new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const jet = new THREE.Mesh(cg, cm); jet.position.y = sgn * 5; jet.rotation.x = sgn > 0 ? 0 : Math.PI; group.add(jet); disposables.push(cg, cm); } addSprite(5, C(0.7, 0.85, 1.0), C(0.1, 0.2, 0.5), 0, 4, 0.9); }
      break;
    }
    case 'galaxy': case 'gcluster': case 'scluster': {
      const n = kind === 'galaxy' ? 9000 : kind === 'gcluster' ? 1500 : 2500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      const elliptical = kind === 'galaxy' && (/elliptical|^M8[67]$|NGC 4[0-9]{3}/i.test(spec.notes || '') || R() < 0.25);
      for (let i = 0; i < n; i++) {
        let x, y, z, t;
        if (kind === 'galaxy' && !elliptical) {
          const u = R(); let r; do { r = -Math.log(1 - R()) * 0.35; } while (r > 1); let th = R() * 2 * Math.PI;
          const arm = Math.floor(R() * 2), thArm = Math.log(Math.max(r, 0.03) / 0.08) / Math.tan(0.28) + arm * Math.PI; if (u < 0.65) th = thArm + (R() - 0.5) * 0.8;
          const bulge = u > 0.88; const rb = bulge ? Math.abs(R() - R()) * 0.22 : r;
          x = rb * Math.cos(th); z = rb * Math.sin(th); y = (R() - 0.5) * (bulge ? 0.18 : 0.05 * (0.4 + r)); t = bulge ? 0.95 : 0.2 + 0.8 * R();
        } else { const r = kind === 'scluster' ? Math.pow(R(), 1.2) / Math.sqrt(1 + 4 * R() * R()) : Math.pow(R(), kind === 'galaxy' ? 2.2 : 1.6); const th = R() * 2 * Math.PI, ph = Math.acos(2 * R() - 1); x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph) * (kind === 'galaxy' ? 0.7 : 0.85); z = r * Math.sin(ph) * Math.sin(th); t = kind === 'gcluster' ? 0.6 : 0.9 - 0.6 * r; }
        pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
        const warm = kind === 'gcluster' ? [1.0, 0.85, 0.6] : [1.0, 0.92, 0.75], cool = kind === 'scluster' ? [0.75, 0.85, 1.0] : [0.6, 0.75, 1.0];
        col[3 * i] = cool[0] + (warm[0] - cool[0]) * t; col[3 * i + 1] = cool[1] + (warm[1] - cool[1]) * t; col[3 * i + 2] = cool[2] + (warm[2] - cool[2]) * t;
        size[i] = kind === 'gcluster' ? 0.03 + 0.05 * R() : 0.015 + 0.03 * R() * R();
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      const m = new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 300 } } });
      const pts = new THREE.Points(g, m); group.add(pts); disposables.push(g, m); group.userData.points = m;
      if (kind === 'galaxy') addSprite(1.2, C(1.0, 0.9, 0.7), C(0.3, 0.2, 0.1), 0, 3, 0.8);
      if (kind === 'gcluster') addSprite(2.4, C(0.6, 0.3, 0.6), C(0, 0, 0), 2, 1, 0.35);   // hot intracluster gas
      tickers.push(t => { pts.rotation.y = t * 0.03; });
      break;
    }
    case 'nebula': case 'pnebula': case 'snr': {
      const base = kind === 'snr' ? [C(0.4, 0.8, 1.0), C(1.0, 0.5, 0.3)] : kind === 'pnebula' ? [C(0.3, 0.9, 0.8), C(0.9, 0.3, 0.5)] : [C(1.0, 0.45, 0.6), C(0.3, 0.6, 0.9)];
      const layers = kind === 'snr' ? 5 : 7;
      for (let k = 0; k < layers; k++) {
        const s = addSprite(1.6 + 0.3 * k, k % 2 ? base[0] : base[1], C(0, 0, 0), kind === 'snr' && k === 0 ? 1 : 2, 1, kind === 'snr' ? 0.35 : 0.3);
        s.material.uniforms.uSeed.value = seed + k * 7.3; s.position.set((R() - 0.5) * 0.4, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4);
        if (kind === 'pnebula') s.scale.set(1, 0.6 + 0.2 * k, 1);
      }
      if (kind === 'pnebula' || kind === 'snr') { const c1 = C(0.8, 0.9, 1.0); const m = new THREE.ShaderMaterial({ vertexShader: BODY_VERT, fragmentShader: STAR_FRAG, uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHasMap: { value: 0 }, uMap: { value: new THREE.Texture() }, uColor: { value: c1 }, uColor2: { value: C(0.5, 0.7, 1.0) } } }); const core = new THREE.Mesh(sphere(16), m); core.scale.setScalar(0.06); group.add(core); disposables.push(m); }
      if (kind === 'nebula') { for (let k = 0; k < 12; k++) { const c1 = C(0.8, 0.9, 1.0); const st = addSprite(0.25, c1, C(0.3, 0.5, 1.0), 0, 3, 0.9); st.position.set((R() - 0.5) * 1.4, (R() - 0.5) * 1.2, (R() - 0.5) * 1.2); } }
      if (kind === 'snr') tickers.push(t => { group.scale.setScalar(1 + 0.02 * Math.sin(t * 0.3)); });
      break;
    }
  }
  group.tick = t => { for (const f of tickers) f(t); };
  group.dispose = () => { for (const d of disposables) d.dispose?.(); };
  group.viewRadius = { galaxy: 1.1, gcluster: 1.2, scluster: 1.1, nebula: 1.3, pnebula: 1.3, snr: 1.4, blackhole: 2.2, quasar: 3, pulsar: 2.4, comet: 2.5, star: 1.6, browndwarf: 1.3, whitedwarf: 1.4 }[kind] || 1.15;
  return group;
}

// ---------------------------------------------------------------------------------------------------
// shared viewer: one renderer, many 2D canvases, render only what is on screen
// ---------------------------------------------------------------------------------------------------
export class KosmoViewer {
  constructor(THREE, { maxPerFrame = 10, pixelRatio = Math.min(devicePixelRatio || 1, 2) } = {}) {
    this.THREE = THREE; this.maxPerFrame = maxPerFrame; this.pr = pixelRatio;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.mounts = new Map(); this.visible = new Set(); this.t0 = performance.now(); this.cursor = 0;
    this.io = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? this.visible.add(e.target) : this.visible.delete(e.target); }, { rootMargin: '120px' });
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }
  attach(canvas, spec, { autoRotate = true, interactive = false, background = null } = {}) {
    this.detach(canvas);
    const THREE = this.THREE, scene = new THREE.Scene(), model = createModel(THREE, spec), cam = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
    if (background) scene.background = new THREE.Color(background);
    scene.add(model); cam.position.set(0, 0.35, model.viewRadius * 3.6); cam.lookAt(0, 0, 0);
    const m = { scene, model, cam, autoRotate, rot: { x: 0.25, y: 0 }, drag: null };
    if (interactive) {
      canvas.style.cursor = 'grab';
      canvas.addEventListener('pointerdown', e => { m.drag = { x: e.clientX, y: e.clientY, rx: m.rot.x, ry: m.rot.y }; m.autoRotate = false; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', e => { if (!m.drag) return; m.rot.y = m.drag.ry + (e.clientX - m.drag.x) * 0.01; m.rot.x = Math.max(-1.4, Math.min(1.4, m.drag.rx + (e.clientY - m.drag.y) * 0.01)); });
      canvas.addEventListener('pointerup', () => { m.drag = null; });
      canvas.addEventListener('wheel', e => { e.preventDefault(); cam.position.z = Math.max(model.viewRadius * 1.4, Math.min(model.viewRadius * 12, cam.position.z * Math.exp(e.deltaY * 0.001))); }, { passive: false });
    }
    this.mounts.set(canvas, m); this.io.observe(canvas); return m;
  }
  detach(canvas) { const m = this.mounts.get(canvas); if (!m) return; this.io.unobserve(canvas); this.visible.delete(canvas); m.model.dispose(); this.mounts.delete(canvas); }
  _loop(now) {
    requestAnimationFrame(this._loop);
    const t = (now - this.t0) / 1000, list = [...this.visible].filter(c => c.isConnected && this.mounts.has(c));
    if (!list.length) return;
    const n = Math.min(this.maxPerFrame, list.length);
    for (let k = 0; k < n; k++) {
      const canvas = list[(this.cursor + k) % list.length], m = this.mounts.get(canvas);
      const w = canvas.clientWidth || 64, h = canvas.clientHeight || 64;
      if (canvas.width !== Math.round(w * this.pr) || canvas.height !== Math.round(h * this.pr)) { canvas.width = Math.round(w * this.pr); canvas.height = Math.round(h * this.pr); }
      this.renderer.setPixelRatio(this.pr); this.renderer.setSize(w, h, false);
      m.cam.aspect = w / h; m.cam.updateProjectionMatrix();
      if (m.autoRotate) m.rot.y = t * 0.25;
      m.model.rotation.set(m.rot.x, m.rot.y, 0); m.model.tick(t);
      if (m.model.userData.points) m.model.userData.points.uniforms.uScale.value = 220 * this.pr * (h / 160);
      this.renderer.render(m.scene, m.cam);
      const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(this.renderer.domElement, 0, this.renderer.domElement.height - canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    }
    this.cursor = (this.cursor + n) % Math.max(1, list.length);
  }
}
