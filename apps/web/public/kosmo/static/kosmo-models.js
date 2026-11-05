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
uniform vec3 uColor, uColor2; uniform float uShape, uTime, uSeed, uSoft, uAlpha, uSize; varying vec2 vUv;
void main(){
  vec2 q = vUv - 0.5; float r = length(q) * 2.0; float a;
  float rR = r * uSize * 0.5;   // distance from the centre in body radii: the quad is uSize radii wide
  if (uShape < 0.5) a = pow(max(1.0 - r, 0.0), uSoft);
  else if (uShape < 1.5) { a = exp(-pow((r - 0.72) / 0.06, 2.0)) + 0.25 * exp(-pow((r - 0.72) / 0.25, 2.0)); }
  else if (uShape < 2.5) { float n = fbm(vec3(q * 3.0, uSeed + uTime * 0.03)); a = smoothstep(0.0, 1.0, (1.0 - r) * 1.2) * (0.55 + 0.6 * n); a *= smoothstep(1.0, 0.6, r); }
  else if (uShape < 3.5) { a = rR < 1.0 ? 1.0 : exp(-(rR - 1.0) * uSoft); a *= smoothstep(1.0, 0.72, r); }   // limb glow: bright at the edge of the body, fading outward (atmospheres, coronae)
  else { float ang = atan(q.y, q.x); float rays = pow(abs(cos(ang * 3.0 + uSeed)), 22.0) * 0.9 + pow(abs(cos(ang * 5.0 + uSeed * 2.3)), 44.0) * 0.6; a = pow(max(1.0 - r, 0.0), 2.2) * (0.06 + rays); }   // radiating spikes
  vec3 col = mix(uColor2, uColor, clamp(a, 0.0, 1.0));
  float k = a * uAlpha;
  gl_FragColor = uShape > 2.5 ? vec4(col, k) : vec4(col * k, k);   // the new shapes are already additive-weighted by alpha once
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


// Black hole: every pixel traces a light ray backward from the camera through Schwarzschild spacetime (units: horizon radius r_s = 1).
// A photon with impact parameter b obeys  u'' + u = 1.5 u^2  (u = 1/r, phi = angle in the ray's plane; 3M u^2 with M = r_s / 2), so we integrate that.
// Rays that reach u = 1 fall in (the shadow, about 2.6 r_s across the photon sphere); the rest escape bent, and show a procedural sky (Einstein ring and arcs).
// A thin accretion disc from the ISCO (3 r_s) outwards is hit wherever a ray crosses its plane: that gives the far side lensed over and under the hole, and the
// photon ring from light that loops. Doppler beaming (Keplerian orbit speed) and gravitational redshift set the brightness and colour.
const BH_FRAG = /* glsl */`
uniform vec3 uN; uniform float uSize, uTime, uSeed; varying vec2 vUv;
const float RIN = 3.0, ROUT = 8.0;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 skyAt(vec3 d){
  vec3 g = d * 48.0, id = floor(g), f = fract(g) - 0.5;
  float h = h31(id), star = step(0.955, h) * smoothstep(0.42, 0.0, length(f));
  vec3 tint = mix(vec3(1.0, 0.82, 0.65), vec3(0.65, 0.78, 1.0), h31(id + 7.0));
  return tint * star * (0.5 + 2.0 * h31(id + 3.0));
}
vec3 heat(float T){
  T = clamp(T, 0.0, 3.0);
  vec3 c = mix(vec3(0.9, 0.18, 0.02), vec3(1.0, 0.65, 0.25), smoothstep(0.0, 0.6, T));
  c = mix(c, vec3(1.0, 0.95, 0.85), smoothstep(0.5, 1.1, T));
  return mix(c, vec3(0.75, 0.85, 1.0), smoothstep(1.1, 2.0, T));
}
void main(){
  vec2 p = (vUv - 0.5) * uSize; float b = length(p);
  vec3 eb = b > 1e-4 ? vec3(p / b, 0.0) : vec3(1.0, 0.0, 0.0), ez = vec3(0.0, 0.0, 1.0);
  float nb = dot(uN, eb), nz = uN.z;
  vec3 hlp = abs(uN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 a1 = normalize(cross(uN, hlp)), a2 = cross(uN, a1);
  float u = 0.0, up = 1.0 / max(b, 0.05), phi = 0.0, dphi = 0.05;
  float s0 = nz, uPrev = 0.0, upPrev = up, phiPrev = 0.0, T = 1.0;
  vec3 acc = vec3(0.0); bool captured = false;
  for (int i = 0; i < 210; i++) {
    uPrev = u; upPrev = up; phiPrev = phi;
    up += (-u + 1.5 * u * u) * dphi; u += up * dphi; phi += dphi;
    if (u >= 1.0) { captured = true; break; }
    float s = cos(phi) * nz + sin(phi) * nb;                       // height of the ray above the disc plane (times r)
    if (s0 * s < 0.0 && u > 1e-3) {
      float t = s0 / (s0 - s), uc = mix(uPrev, u, t), phc = mix(phiPrev, phi, t), r = 1.0 / uc;
      if (r > RIN && r < ROUT) {
        vec3 ph = cos(phc) * ez + sin(phc) * eb;
        float beta = min(sqrt(0.5 / (r - 1.0)), 0.85);             // circular-orbit speed seen by a static observer, c = 1
        vec3 vdir = normalize(cross(uN, ph));
        float upc = mix(upPrev, up, t);
        vec3 dP = (-upc / (uc * uc)) * ph + r * (-sin(phc) * ez + cos(phc) * eb);
        vec3 k = -normalize(dP);                                   // the way the light travels, toward us
        float gam = inversesqrt(1.0 - beta * beta);
        float g = (1.0 / (gam * (1.0 - beta * dot(vdir, k)))) * sqrt(max(1.0 - 1.0 / r, 0.0));   // Doppler x gravitational redshift
        float Tobs = pow(RIN / r, 0.75) * g;                       // disc temperature falls as r^-3/4
        float azim = atan(dot(ph, a2), dot(ph, a1));
        float band = 0.8 + 0.2 * sin(2.0 * azim + r * 3.0 - uTime * 2.0 / pow(r, 1.5) + uSeed);   // differential rotation
        float edge = smoothstep(RIN, RIN + 0.25, r) * smoothstep(ROUT, ROUT - 1.2, r), al = 0.92 * edge;
        acc += T * heat(Tobs) * pow(Tobs, 3.5) * band * al * 1.6; T *= 1.0 - al;
      }
    }
    s0 = s;
    if (phi > 1.57 && u < 0.002 && up < 0.0) break;                // escaped to infinity
    if (T < 0.02) break;
  }
  vec3 dirOut = cos(phi) * ez + sin(phi) * eb;                      // where on the sky this ray ends up
  float bo = 1.0 - smoothstep(5.5, uSize * 0.5, b);                // replace the real sky near the hole, blend back out to the quad's edge
  vec3 sk = skyAt(dirOut) * bo;                                       // the lensed sky replaces the real one only where it actually has light (stars); black sky stays transparent, so the page background shows through instead of a darker square
  float skL = clamp(max(max(sk.r, sk.g), sk.b) * 4.0, 0.0, 1.0);
  vec3 rgb = captured ? acc : acc + T * sk;
  float alpha = captured ? 1.0 : (1.0 - T) + T * skL;
  gl_FragColor = vec4(rgb, alpha);                                  // premultiplied
}`;

// Points (galaxies, clusters): soft round sprites with size attenuation
const POINT_VERT = /* glsl */`attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uScale; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const POINT_FRAG = /* glsl */`varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = pow(max(1.0 - r, 0.0), 1.8); gl_FragColor = vec4(vC * a, a); }`;

// ---------------------------------------------------------------------------------------------------
// Cells. A cell is drawn with the nebula toolkit: a fresnel shell for the membrane, layered fbm sprites
// for the cytoplasm, and a shaded-grain shader for the organelles. spec.cell picks the kind of cell;
// spec.view = 'exterior' (membrane on) or 'interior' (membrane off, faint boundary wireframe on).
// ---------------------------------------------------------------------------------------------------
const CELL_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP; varying vec3 vW;
void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CELL_SHELL_FRAG = NOISE + /* glsl */`
uniform vec3 uColor, uColor2; uniform float uAlpha, uTime, uSeed, uMode, uPower;
varying vec3 vN; varying vec3 vP; varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec3 eye = normalize(cameraPosition - vW);
  float fres = pow(1.0 - abs(dot(n, eye)), uPower);
  float flow = fbm(normalize(vP) * 2.6 + vec3(uTime * 0.05, uSeed, -uTime * 0.03)) * 0.5 + 0.5;
  float a;
  if (uMode > 0.5 && uMode < 1.5) {            // wall: cellulose or peptidoglycan bands, denser at the rim
    float band = smoothstep(0.55, 1.0, abs(sin(vP.y * 46.0 + flow * 3.0)));
    a = uAlpha * (0.16 + 0.55 * fres + 0.22 * band);
  } else if (uMode > 1.5) {                     // organelle envelope or vacuole: soft edge only
    a = uAlpha * (0.05 + 0.95 * fres) * (0.7 + 0.5 * flow);
  } else {                                      // plasma membrane: lipid flow and a bright rim
    a = uAlpha * (0.06 + 0.94 * fres) * (0.75 + 0.4 * flow);
  }
  vec3 col = mix(uColor2, uColor, clamp(fres + 0.25 * flow, 0.0, 1.0));
  gl_FragColor = vec4(col * (0.85 + 0.6 * flow), a);
}`;
const CELL_BODY_FRAG = NOISE + /* glsl */`
uniform vec3 uColor, uColor2; uniform float uSeed, uTime, uRim;
varying vec3 vN; varying vec3 vP;
void main(){
  vec3 p = normalize(vP) * 3.4 + uSeed;
  float grain = fbm(p + vec3(0.0, 0.0, uTime * 0.02)) * 0.5 + 0.5;
  vec3 col = mix(uColor2, uColor, grain);
  vec3 n = normalize(vN);
  float diff = 0.42 + 0.8 * max(dot(n, normalize(vec3(0.45, 0.65, 0.85))), 0.0);
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.6);
  gl_FragColor = vec4(col * diff + uColor * rim * uRim, 1.0);
}`;

// Legend and model share one colour per part, so a swatch in the UI always matches the mesh.
export const CELL_COLORS = {
  membrane: '#6fd6ff', wall: '#c3d98f', capsule: '#b8a6f0', cytoplasm: '#2f8fb8',
  nucleus: '#9b7bff', nucleolus: '#d6bcff', mitochondrion: '#ff9a4d', chloroplast: '#59d97a',
  er: '#69a8ff', golgi: '#ffd166', lysosome: '#ff6f9c', vacuole: '#7fbfff',
  ribosome: '#e8f1ff', cytoskeleton: '#9fb6d9', flagellum: '#8fd4ff', dna: '#c9a0ff',
  acrosome: '#ffcf7a', granule: '#ff9ec7', myelin: '#cfd8ea', capsid: '#ffb46b', spike: '#ff8f6b',
  silica: '#e6d9a8', bud: '#f2e6c8', zona: '#a9d4ff', corona: '#ffe2b0',
};

// Rounded box (superellipsoid): a sphere of revolution is wrong for a plant cell, this is a squircle.
// e = 1 is an ellipsoid, e → 0 approaches a box with rounded corners.
function superellipsoid(THREE, ax, ay, az, e = 0.4, seg = 28) {
  const cols = seg, rows = Math.max(8, Math.round(seg * 0.7));
  const cp = (w, m) => Math.sign(Math.cos(w)) * Math.pow(Math.abs(Math.cos(w)), m);
  const sp = (w, m) => Math.sign(Math.sin(w)) * Math.pow(Math.abs(Math.sin(w)), m);
  const pos = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = -Math.PI / 2 + Math.PI * j / rows, cv = cp(v, e), sv = sp(v, e);
    for (let i = 0; i <= cols; i++) {
      const u = -Math.PI + 2 * Math.PI * i / cols;
      pos.push(ax * cv * cp(u, e), ay * sv, az * cv * sp(u, e));
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // the two poles are degenerate rings; give their zero normals the direction of the radius
  const nrm = g.attributes.normal, v3 = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    if (nrm.getX(i) ** 2 + nrm.getY(i) ** 2 + nrm.getZ(i) ** 2 > 1e-12) continue;
    v3.fromBufferAttribute(g.attributes.position, i); if (v3.lengthSq() === 0) v3.set(0, 1, 0);
    v3.normalize(); nrm.setXYZ(i, v3.x, v3.y, v3.z);
  }
  return g;
}

// Returns a unit-ish Group with .tick(t), .dispose() and userData { viewRadius, points }.
function buildCell(THREE, spec, seed) {
  const kind = String(spec.cell || 'animal');
  const interior = spec.view === 'interior';
  const root = new THREE.Group();
  const inner = new THREE.Group(), outer = new THREE.Group(), ghost = new THREE.Group();
  root.add(inner, outer, ghost);
  outer.visible = !interior; ghost.visible = interior;
  const R = rng(seed * 3.7 + 11);
  const C = h => new THREE.Color(h);
  const bin = [], tickers = [], matCache = new Map(), geoCache = new Map();
  let pointMat = null, view = [1.3, 1.05];
  const keep = x => { bin.push(x); return x; };

  const bodyMat = (c1, c2, rim = 0.45) => {
    const key = `b|${c1}|${c2}|${rim}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = keep(new THREE.ShaderMaterial({ vertexShader: CELL_VERT, fragmentShader: CELL_BODY_FRAG, uniforms: {
      uColor: { value: C(c1) }, uColor2: { value: C(c2) }, uSeed: { value: seed }, uTime: { value: 0 }, uRim: { value: rim } } }));
    tickers.push(t => { m.uniforms.uTime.value = t; }); matCache.set(key, m); return m;
  };
  const shellMat = (c1, c2, alpha = 0.45, mode = 0, power = 2.4, additive = true) => {
    const key = `s|${c1}|${c2}|${alpha}|${mode}|${power}|${additive}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = keep(new THREE.ShaderMaterial({ vertexShader: CELL_VERT, fragmentShader: CELL_SHELL_FRAG, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: {
        uColor: { value: C(c1) }, uColor2: { value: C(c2) }, uAlpha: { value: alpha }, uTime: { value: 0 }, uSeed: { value: seed }, uMode: { value: mode }, uPower: { value: power } } }));
    tickers.push(t => { m.uniforms.uTime.value = t; }); matCache.set(key, m); return m;
  };
  const sphereGeo = (seg = 20) => {
    const k = `p|${seg}`;
    if (!geoCache.has(k)) geoCache.set(k, keep(new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.6)))));
    return geoCache.get(k);
  };
  const superGeo = (...a) => keep(superellipsoid(THREE, ...a));
  const put = (parent, g, m, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]); mesh.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(mesh); return mesh;
  };
  const blob = (parent, m, pos, s, rot) => put(parent, sphereGeo(20), m, pos, [s, s, s], rot);
  const onSphere = (r = 1) => { const th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1); return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)]; };
  const tube = (parent, pts, radius, c1, c2) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return put(parent, keep(new THREE.TubeGeometry(curve, 48, radius, 6, false)), bodyMat(c1, c2, 0.5));
  };
  // cytoplasm: the nebula's layered fbm cloud sprite, at cell scale
  const cloud = (parent, size, c1, alpha, pos = [0, 0, 0]) => {
    const g = keep(new THREE.PlaneGeometry(size, size)), m = keep(new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: C(c1) }, uColor2: { value: C('#000000') }, uShape: { value: 2 }, uTime: { value: 0 }, uSeed: { value: seed + R() * 40 }, uSoft: { value: 1 }, uAlpha: { value: alpha } } }));
    tickers.push(t => { m.uniforms.uTime.value = t; });
    const s = new THREE.Mesh(g, m); s.position.set(pos[0], pos[1], pos[2]);
    s.onBeforeRender = (r, sc, cam) => { s.quaternion.copy(cam.quaternion); };
    parent.add(s); return s;
  };
  const specks = (parent, n, radius, c1, { flatten = 1, size = 0.028 } = {}) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sizes = new Float32Array(n), c = C(c1);
    for (let i = 0; i < n; i++) {
      const r = radius * Math.cbrt(R()), th = R() * Math.PI * 2, ph = Math.acos(2 * R() - 1);
      pos[3 * i] = r * Math.sin(ph) * Math.cos(th); pos[3 * i + 1] = r * Math.cos(ph) * flatten; pos[3 * i + 2] = r * Math.sin(ph) * Math.sin(th);
      col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
      sizes[i] = size * (0.6 + 0.8 * R());
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    const m = keep(new THREE.ShaderMaterial({ vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 260 } } }));
    pointMat = m; parent.add(new THREE.Points(g, m));
  };
  const filaments = (parent, n, radius, c1, opacity = 0.15) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const d = onSphere(radius), s = onSphere(0.1 + 0.3 * R());
      pts.push(s[0], s[1], s[2], d[0], d[1], d[2]);
    }
    const g = keep(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)));
    parent.add(new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: C(c1), transparent: true, opacity }))));
  };
  const ghostShell = (g, c1 = CELL_COLORS.membrane, opacity = 0.13, scale = [1, 1, 1]) => {
    return put(ghost, g, keep(new THREE.MeshBasicMaterial({ color: C(c1), wireframe: true, transparent: true, opacity })), [0, 0, 0], scale);
  };

  const mitoGeo = keep(new THREE.CapsuleGeometry(0.06, 0.16, 6, 12));
  const addMito = (parent, pos, rot = [0, 0, 0], s = 1) => put(parent, mitoGeo, bodyMat(CELL_COLORS.mitochondrion, '#7a2c0c', 0.7), pos, [s, s, s], rot);
  const addNucleus = (parent, pos = [0, 0, 0], radius = 0.28, lobes = 1) => {
    if (lobes > 1) {                                  // neutrophil nucleus: lobes joined by thin bridges
      for (let i = 0; i < lobes; i++) {
        const a = -0.8 + i * 0.72, p = [pos[0] + Math.cos(a) * radius * 0.7, pos[1] + Math.sin(a) * radius * 0.55, pos[2]];
        put(parent, sphereGeo(20), shellMat(CELL_COLORS.nucleus, '#3b2170', 0.4, 2, 2.0), p, [radius * 0.6, radius * 0.6, radius * 0.6]);
        put(parent, sphereGeo(20), bodyMat(CELL_COLORS.nucleus, '#2c1a52', 0.5), p, [radius * 0.54, radius * 0.54, radius * 0.54]);
        if (i) { const q = [pos[0] + Math.cos(a - 0.36) * radius * 0.5, pos[1] + Math.sin(a - 0.36) * radius * 0.4, pos[2]]; blob(parent, bodyMat(CELL_COLORS.nucleus, '#2c1a52', 0.4), q, radius * 0.26); }
      }
      return;
    }
    put(parent, sphereGeo(24), shellMat(CELL_COLORS.nucleus, '#3b2170', 0.45, 2, 2.0), pos, [radius * 1.1, radius * 1.1, radius * 1.1]);
    put(parent, sphereGeo(24), bodyMat(CELL_COLORS.nucleus, '#2c1a52', 0.5), pos, [radius, radius, radius]);
    put(parent, sphereGeo(14), bodyMat(CELL_COLORS.nucleolus, '#6a3fb0', 0.3), [pos[0] + radius * 0.3, pos[1] + radius * 0.22, pos[2] + radius * 0.08], [radius * 0.32, radius * 0.32, radius * 0.32]);
  };
  const addChloroplast = (parent, pos, rot = [0, 0, 0], s = 1) => {
    const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); g.rotation.set(rot[0], rot[1], rot[2]); parent.add(g);
    put(g, sphereGeo(18), bodyMat(CELL_COLORS.chloroplast, '#14521f', 0.6), [0, 0, 0], [0.2 * s, 0.11 * s, 0.15 * s]);
    for (let k = 0; k < 4; k++) put(g, sphereGeo(10), bodyMat('#2f8f3d', '#0d3a16', 0.2), [(k - 1.5) * 0.075 * s, 0, 0], [0.045 * s, 0.045 * s, 0.045 * s]);
  };

  switch (kind) {
    case 'bacterium': {
      put(outer, keep(new THREE.CapsuleGeometry(0.34, 0.74, 10, 26)), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.5, 0, 2.2), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      put(outer, keep(new THREE.CapsuleGeometry(0.39, 0.74, 10, 26)), shellMat(CELL_COLORS.wall, '#33441f', 0.45, 1, 1.8, false), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      put(outer, keep(new THREE.CapsuleGeometry(0.45, 0.74, 10, 26)), shellMat(CELL_COLORS.capsule, '#241a4a', 0.16, 2, 3.4), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      cloud(inner, 1.5, '#3f8fbf', 0.14, [0, 0, 0]);
      for (let k = 0; k < 3; k++) {                    // nucleoid: a tangled loop of DNA
        const pts = [];
        for (let i = 0; i < 10; i++) { const t = i / 9; pts.push([-0.24 + 0.48 * t, 0.13 * Math.sin(t * 9 + k * 2), 0.13 * Math.cos(t * 7 + k * 3)]); }
        tube(inner, pts, 0.011, CELL_COLORS.dna, '#4a2a7a');
      }
      specks(inner, 340, 0.42, CELL_COLORS.ribosome, { size: 0.022, flatten: 0.8 });
      for (let i = 0; i < 8; i++) {                    // pili around the rod
        const a = i / 8 * Math.PI * 2;
        const p = put(outer, keep(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4)), bodyMat(CELL_COLORS.wall, '#33441f', 0.2), [0.08, 0.34 * Math.cos(a), 0.34 * Math.sin(a)]);
        p.rotation.x = a;
      }
      const flag = new THREE.Group(); flag.position.set(-0.66, 0, 0); outer.add(flag);
      const tail = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24; tail.push([-t * 1.2, 0.16 * Math.sin(t * 7 + seed) * t, 0.16 * Math.cos(t * 8 + seed) * t]); }
      tube(flag, tail, 0.016, CELL_COLORS.flagellum, '#1d4a66');
      tickers.push(t => { flag.rotation.x = t * 1.5; });
      ghostShell(keep(new THREE.CapsuleGeometry(0.34, 0.74, 8, 20)), CELL_COLORS.wall, 0.14, [1, 1, 1]);
      ghost.children[0].rotation.z = Math.PI / 2;
      view = [1.5, 0.95];
      break;
    }
    case 'plant': {
      put(outer, superGeo(1.16, 0.86, 0.96, 0.36, 30), shellMat(CELL_COLORS.wall, '#2c4420', 0.5, 1, 1.7, false));
      put(outer, superGeo(1.09, 0.8, 0.9, 0.42, 26), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.3, 0, 2.8));
      put(inner, superGeo(0.62, 0.5, 0.5, 0.55, 24), shellMat(CELL_COLORS.vacuole, '#0d2f4a', 0.3, 2, 2.0), [0.14, 0.02, 0]);
      cloud(inner, 1.5, '#4f9ad0', 0.12, [0.2, 0.1, 0]);
      addNucleus(inner, [-0.6, 0.26, 0.1], 0.2);
      for (const [x, y, z, a] of [[-0.62, -0.3, 0.18, 0.4], [-0.35, -0.36, -0.22, 1.2], [-0.8, 0.02, -0.12, 2.1], [-0.4, 0.34, -0.3, 0.9], [-0.7, -0.12, 0.3, 2.8], [-0.25, 0.0, 0.42, 1.6]]) addChloroplast(inner, [x, y, z], [a, a * 0.6, a * 0.3]);
      for (let i = 0; i < 4; i++) addMito(inner, [0.5 + R() * 0.2, -0.35 + R() * 0.7, -0.3 + R() * 0.6], [R() * 3, R() * 3, R() * 3], 0.85);
      specks(inner, 160, 0.75, CELL_COLORS.ribosome, { size: 0.022, flatten: 0.7 });
      ghostShell(superGeo(1.12, 0.82, 0.92, 0.36, 18), CELL_COLORS.wall, 0.12);
      view = [1.95, 1.55];
      break;
    }
    case 'yeast': {
      put(outer, sphereGeo(36), shellMat(CELL_COLORS.bud, '#4a3a18', 0.42, 1, 1.7, false), [0, 0, 0], [0.82, 0.96, 0.82]);
      put(outer, sphereGeo(28), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.28, 0, 2.8), [0, 0, 0], [0.77, 0.91, 0.77]);
      put(outer, sphereGeo(20), shellMat(CELL_COLORS.bud, '#4a3a18', 0.45, 1, 1.7, false), [0.72, 0.36, 0.1], [0.27, 0.27, 0.27]);
      put(outer, keep(new THREE.TorusGeometry(0.13, 0.026, 6, 20)), shellMat(CELL_COLORS.bud, '#5a4a24', 0.5, 1, 2.0, false), [0.57, 0.27, 0.08], [1, 1, 1], [0.6, 0.2, -0.7]);
      put(inner, sphereGeo(24), shellMat(CELL_COLORS.vacuole, '#0d2f4a', 0.32, 2, 2.0), [-0.12, 0.06, 0], [0.38, 0.42, 0.38]);
      addNucleus(inner, [0.22, -0.34, 0.12], 0.16);
      for (let i = 0; i < 4; i++) addMito(inner, [(-0.4 + R() * 0.5), (-0.2 + R() * 0.6), (-0.35 + R() * 0.7)], [R() * 3, R() * 3, R() * 3], 0.7);
      cloud(inner, 1.1, '#d8c58a', 0.1, [0.1, 0, 0.1]);
      specks(inner, 120, 0.62, CELL_COLORS.ribosome, { size: 0.02, flatten: 0.9 });
      ghostShell(sphereGeo(18), CELL_COLORS.bud, 0.12, [0.82, 0.96, 0.82]);
      view = [1.55, 1.15];
      break;
    }
    case 'animal': {
      put(outer, sphereGeo(44), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.42, 0, 2.6));
      put(outer, sphereGeo(28), shellMat('#7fe3ff', '#04121f', 0.12, 2, 4.0), [0, 0, 0], [1.05, 1.05, 1.05]);
      cloud(inner, 1.9, '#2f8fb8', 0.16, [-0.1, 0.15, 0.1]);
      cloud(inner, 1.5, '#3a7fd0', 0.14, [0.25, -0.2, -0.15]);
      cloud(inner, 1.2, '#7fd6c0', 0.1, [-0.3, -0.1, 0.2]);
      specks(inner, 260, 0.86, CELL_COLORS.ribosome, { size: 0.026 });
      filaments(inner, 30, 0.92, CELL_COLORS.cytoskeleton);
      addNucleus(inner, [-0.14, 0.12, 0.02], 0.3);
      for (let i = 0; i < 4; i++) {                     // ER cisternae
        const g = keep(new THREE.TorusGeometry(0.42 + i * 0.05, 0.014, 6, 44, Math.PI * (1.0 + 0.4 * R())));
        put(inner, g, bodyMat(CELL_COLORS.er, '#1d3f7a', 0.6), [0, 0, 0], [1, 0.8, 1], [R() * 0.9, R() * 1.6, R() * 1.2]);
      }
      for (const p of [[0.45, 0.3, 0.2], [-0.42, -0.34, 0.24], [0.18, -0.5, -0.28], [0.52, -0.14, -0.3], [-0.2, 0.52, -0.26], [-0.55, 0.05, -0.2], [0.05, 0.28, 0.55]]) addMito(inner, p, [R() * 3, R() * 3, R() * 3], 0.9 + 0.35 * R());
      const golgi = new THREE.Group(); golgi.position.set(0.36, -0.3, 0.16); golgi.rotation.set(0.7, 0.4, 0.2); inner.add(golgi);
      for (let i = 0; i < 5; i++) put(golgi, keep(new THREE.TorusGeometry(0.18 - i * 0.02, 0.013, 6, 30, Math.PI * 1.4)), bodyMat(CELL_COLORS.golgi, '#8a5a0a', 0.6), [0, i * 0.034, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) blob(inner, bodyMat(CELL_COLORS.lysosome, '#7d1740', 0.5), onSphere(0.62), 0.045 + 0.02 * R());
      for (let i = 0; i < 8; i++) blob(inner, shellMat('#bfefff', '#0a2a3a', 0.4, 2, 3.0), onSphere(0.72), 0.03 + 0.02 * R());
      ghostShell(sphereGeo(20));
      view = [1.3, 1.02];
      break;
    }
    case 'whiteblood': {
      const skin = keep(new THREE.SphereGeometry(1, 36, 24)), v = new THREE.Vector3(), pa = skin.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i);
        const n = 1 + 0.11 * Math.sin(v.x * 4 + seed) * Math.cos(v.y * 5) + 0.07 * Math.sin(v.z * 6 + v.x * 3);
        v.multiplyScalar(n); pa.setXYZ(i, v.x, v.y, v.z);
      }
      skin.computeVertexNormals();
      put(outer, skin, shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.44, 0, 2.5));
      for (const d of [[1, 0.2, 0.1], [-0.6, 0.75, -0.2], [0.1, -0.8, 0.6]]) blob(outer, shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.4, 0, 2.6), [d[0] * 0.92, d[1] * 0.92, d[2] * 0.92], 0.34);
      cloud(inner, 1.8, '#7f6fd0', 0.14, [0, 0, 0]);
      addNucleus(inner, [0, 0, 0], 0.26, 3);
      specks(inner, 420, 0.8, CELL_COLORS.granule, { size: 0.03 });
      for (let i = 0; i < 5; i++) addMito(inner, onSphere(0.55), [R() * 3, R() * 3, R() * 3], 0.8);
      ghostShell(sphereGeo(18), CELL_COLORS.membrane, 0.12, [1.02, 1.02, 1.02]);
      view = [1.42, 1.05];
      break;
    }
    case 'neuron': {
      put(outer, sphereGeo(32), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.45, 0, 2.5), [0, 0, 0], [0.33, 0.33, 0.33]);
      const branch = (start, dir, len, depth, rad) => {
        const end = [start[0] + dir[0] * len, start[1] + dir[1] * len, start[2] + dir[2] * len];
        const mid = [(start[0] + end[0]) / 2 + (R() - 0.5) * len * 0.35, (start[1] + end[1]) / 2 + (R() - 0.5) * len * 0.35, (start[2] + end[2]) / 2 + (R() - 0.5) * len * 0.35];
        tube(outer, [start, mid, end], rad, CELL_COLORS.cytoskeleton, '#4a5f80');
        if (depth <= 0) return;
        for (let k = 0; k < 2; k++) {
          const nd = [dir[0] + (R() - 0.5) * 1.1, dir[1] + (R() - 0.5) * 1.1, dir[2] + (R() - 0.5) * 1.1];
          const n = Math.hypot(...nd) || 1;
          branch(end, [nd[0] / n, nd[1] / n, nd[2] / n], len * 0.62, depth - 1, rad * 0.62);
        }
      };
      for (let i = 0; i < 6; i++) {
        const d = onSphere(1);
        branch([d[0] * 0.26, d[1] * 0.26, d[2] * 0.26], [d[0] - 0.55, d[1], d[2]].map(x => x / Math.hypot(d[0] - 0.55, d[1], d[2])), 0.42, 2, 0.045);
      }
      const axon = []; for (let i = 0; i <= 10; i++) { const t = i / 10; axon.push([0.25 + t * 1.1, 0.1 * Math.sin(t * 3), 0.06 * t]); }
      tube(outer, axon, 0.052, CELL_COLORS.cytoskeleton, '#4a5f80');
      for (let i = 0; i < 5; i++) {                     // myelin segments
        const x = 0.45 + i * 0.19; const m = put(outer, keep(new THREE.CapsuleGeometry(0.095, 0.1, 5, 12)), bodyMat(CELL_COLORS.myelin, '#4d5a74', 0.35), [x, 0.035 * Math.sin(x * 3), 0.04], [1, 1, 1], [0, 0, Math.PI / 2]);
        void m;
      }
      for (const d of [[0.35, 0.3, 0], [-0.2, 0.4, 0.1], [0.1, -0.35, 0.2]]) { const t = tube(outer, [[1.36, 0, 0], [1.36 + d[0] * 0.2, d[1] * 0.25, d[2] * 0.25], [1.36 + d[0] * 0.32, d[1] * 0.45, d[2] * 0.45]], 0.022, CELL_COLORS.cytoskeleton, '#4a5f80'); void t; blob(outer, bodyMat(CELL_COLORS.golgi, '#8a5a0a', 0.4), [1.36 + d[0] * 0.34, d[1] * 0.48, d[2] * 0.48], 0.045); }
      addNucleus(inner, [0, 0, 0], 0.17);
      specks(inner, 90, 0.24, CELL_COLORS.ribosome, { size: 0.02 });
      for (let i = 0; i < 4; i++) addMito(inner, onSphere(0.2), [R() * 3, R() * 3, R() * 3], 0.55);
      ghostShell(sphereGeo(18), CELL_COLORS.membrane, 0.16, [0.33, 0.33, 0.33]);
      view = [1.62, 0.6];
      break;
    }
    case 'muscle': {
      put(outer, keep(new THREE.CylinderGeometry(0.3, 0.3, 2.1, 36, 1, true)), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.4, 0, 2.4), [0, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      for (const s of [1, -1]) blob(outer, shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.35, 0, 2.6), [s * 1.05, 0, 0], 0.3);
      for (let i = 0; i < 11; i++) {                    // striations
        const x = -0.95 + i * 0.19;
        put(outer, keep(new THREE.TorusGeometry(0.3, 0.009, 5, 32)), bodyMat(CELL_COLORS.cytoskeleton, '#3d4c66', 0.3), [x, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
      }
      for (let i = 0; i < 10; i++) {                    // myofibrils
        const a = i / 10 * Math.PI * 2, r = 0.15;
        put(inner, keep(new THREE.CylinderGeometry(0.028, 0.028, 2.0, 8)), bodyMat('#d98f6a', '#5a2a16', 0.5), [0, r * Math.cos(a), r * Math.sin(a)], [1, 1, 1], [0, 0, Math.PI / 2]);
      }
      for (let i = 0; i < 3; i++) {                     // peripheral nuclei
        const a = i / 3 * Math.PI * 2;
        put(inner, sphereGeo(18), bodyMat(CELL_COLORS.nucleus, '#2c1a52', 0.5), [-0.55 + i * 0.55, 0.2 * Math.cos(a), 0.2 * Math.sin(a)], [0.15, 0.085, 0.085], [0, 0, Math.PI / 2]);
      }
      for (let i = 0; i < 6; i++) addMito(inner, [-0.8 + R() * 1.6, 0.12 * Math.cos(R() * 6), 0.12 * Math.sin(R() * 6)], [0, R() * 3, R() * 3], 0.7);
      cloud(inner, 1.4, '#d98f6a', 0.1, [0, 0, 0]);
      ghostShell(keep(new THREE.CylinderGeometry(0.3, 0.3, 2.1, 16, 1, true)), CELL_COLORS.membrane, 0.14, [1, 1, 1]);
      ghost.children[0].rotation.z = Math.PI / 2;
      view = [1.2, 1.05];
      break;
    }
    case 'rbc': {
      const h = x => 0.3 * Math.sqrt(Math.max(0, 1 - x * x)) * (1 - 0.62 * Math.exp(-Math.pow(x / 0.34, 2))) + 0.012;
      const pts = [new THREE.Vector2(0, h(0))];
      for (let i = 1; i <= 22; i++) pts.push(new THREE.Vector2(i / 22, h(i / 22)));
      for (let i = 22; i >= 0; i--) pts.push(new THREE.Vector2(i / 22, -h(i / 22)));
      const disc = keep(new THREE.LatheGeometry(pts, 48));
      put(outer, disc, shellMat('#ff7f8f', '#4a0a18', 0.5, 0, 2.2));
      cloud(inner, 1.6, '#c0405a', 0.12, [0, 0, 0]);
      filaments(inner, 22, 0.94, '#ffb3bf', 0.12);
      specks(inner, 300, 0.9, '#ffc2cc', { size: 0.02, flatten: 0.22 });
      ghostShell(keep(new THREE.LatheGeometry(pts, 18)), '#ff9aa8', 0.18);
      view = [1.28, 1.18];
      break;
    }
    case 'sperm': {
      const head = new THREE.Group(); head.position.set(0.5, 0, 0); outer.add(head);
      put(head, sphereGeo(28), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.45, 0, 2.4), [0, 0, 0], [0.3, 0.4, 0.25]);
      put(head, sphereGeo(18), bodyMat(CELL_COLORS.acrosome, '#8a5a12', 0.5), [0.21, 0.06, 0], [0.14, 0.19, 0.16]);
      put(inner, sphereGeo(20), bodyMat(CELL_COLORS.nucleus, '#2c1a52', 0.5), [0.46, 0, 0], [0.22, 0.31, 0.18]);
      put(outer, keep(new THREE.CapsuleGeometry(0.055, 0.2, 6, 12)), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.4, 0, 2.4), [0.2, 0, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
      for (let i = 0; i < 5; i++) put(outer, keep(new THREE.TorusGeometry(0.06, 0.012, 5, 16)), bodyMat(CELL_COLORS.mitochondrion, '#7a2c0c', 0.6), [0.12 + i * 0.045, 0, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
      const tail = []; for (let i = 0; i <= 30; i++) { const t = i / 30; tail.push([0.08 - t * 1.55, 0.09 * Math.sin(t * 14) * t, 0.09 * Math.cos(t * 12) * t]); }
      tube(outer, tail, 0.012, CELL_COLORS.flagellum, '#1d4a66');
      blob(inner, bodyMat(CELL_COLORS.mitochondrion, '#7a2c0c', 0.6), [0.28, 0, 0], 0.05);
      ghostShell(sphereGeo(16), CELL_COLORS.membrane, 0.15, [0.3, 0.4, 0.25]);
      ghost.children[0].position.set(0.5, 0, 0);
      view = [1.3, 0.55];
      break;
    }
    case 'egg': {
      put(outer, sphereGeo(44), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.42, 0, 2.5));
      put(outer, sphereGeo(28), shellMat(CELL_COLORS.zona, '#10243a', 0.28, 2, 3.0), [0, 0, 0], [1.09, 1.09, 1.09]);
      for (let i = 0; i < 42; i++) { const d = onSphere(1.2); blob(outer, bodyMat(CELL_COLORS.corona, '#6a4a1a', 0.4), d, 0.05 + 0.02 * R()); }
      cloud(inner, 1.9, '#c8a05a', 0.12, [0, 0, 0]);
      cloud(inner, 1.4, '#4f9ad0', 0.1, [0.1, -0.15, 0.05]);
      addNucleus(inner, [0.12, 0.06, 0.05], 0.28);
      for (let i = 0; i < 54; i++) { const d = onSphere(0.82); blob(inner, bodyMat(CELL_COLORS.granule, '#7d1740', 0.4), d, 0.022 + 0.012 * R()); }
      for (let i = 0; i < 7; i++) addMito(inner, onSphere(0.55), [R() * 3, R() * 3, R() * 3], 0.9);
      ghostShell(sphereGeo(20));
      view = [1.45, 1.2];
      break;
    }
    case 'diatom': {
      put(outer, keep(new THREE.CylinderGeometry(0.6, 0.6, 0.36, 40, 1, true)), shellMat(CELL_COLORS.silica, '#4a4020', 0.4, 1, 1.8, false));
      for (const s of [1, -1]) {
        put(outer, sphereGeo(30), shellMat(CELL_COLORS.silica, '#4a4020', 0.35, 1, 2.0, false), [0, s * 0.19, 0], [0.62, 0.1, 0.62]);
        put(outer, keep(new THREE.TorusGeometry(0.6, 0.018, 5, 48)), shellMat('#fff3cf', '#5a4a20', 0.4, 1, 1.6, false), [0, s * 0.22, 0]);
        for (let i = 0; i < 12; i++) {                   // radial ribs on the valve
          const a = i / 12 * Math.PI * 2;
          const m = put(outer, keep(new THREE.CylinderGeometry(0.006, 0.006, 0.52, 4)), bodyMat('#f5e8b8', '#6a5a24', 0.2), [0.28 * Math.cos(a), s * 0.285, 0.28 * Math.sin(a)]);
          m.rotation.z = -a; m.rotation.x = Math.PI / 2;
        }
      }
      cloud(inner, 1.2, '#c9a05a', 0.12, [0, 0, 0]);
      addNucleus(inner, [0, 0, 0], 0.16);
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; addChloroplast(inner, [0.34 * Math.cos(a), -0.04, 0.34 * Math.sin(a)], [0, -a, 0], 0.85); }
      put(inner, sphereGeo(20), shellMat(CELL_COLORS.vacuole, '#0d2f4a', 0.28, 2, 2.0), [0, 0.02, 0], [0.22, 0.15, 0.22]);
      ghostShell(keep(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 18, 1, true)), CELL_COLORS.silica, 0.14);
      view = [1.05, 0.95];
      break;
    }
    case 'virus': {
      put(outer, keep(new THREE.IcosahedronGeometry(0.55, 0)), bodyMat(CELL_COLORS.capsid, '#7a3a10', 0.55));
      const ic = keep(new THREE.IcosahedronGeometry(0.55, 0)), ip = ic.attributes.position, seen = new Set();
      for (let i = 0; i < ip.count; i++) {
        const d = [ip.getX(i), ip.getY(i), ip.getZ(i)], n = Math.hypot(...d), key = d.map(x => (x / n).toFixed(3)).join(',');
        if (seen.has(key)) continue; seen.add(key);
        const u = [d[0] / n, d[1] / n, d[2] / n];
        put(outer, keep(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 5)), bodyMat(CELL_COLORS.spike, '#7a2a10', 0.3), [u[0] * 0.62, u[1] * 0.62, u[2] * 0.62], [1, 1, 1]);
        outer.children[outer.children.length - 1].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(u[0], u[1], u[2]));
        blob(outer, bodyMat(CELL_COLORS.spike, '#7a2a10', 0.4), [u[0] * 0.72, u[1] * 0.72, u[2] * 0.72], 0.055);
      }
      const helix = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 5; helix.push([0.15 * Math.cos(a) * (1 - 0.3 * t), -0.3 + 0.6 * t, 0.15 * Math.sin(a) * (1 - 0.3 * t)]); }
      tube(inner, helix, 0.018, CELL_COLORS.dna, '#4a2a7a');
      cloud(inner, 0.8, '#ffb46b', 0.08, [0, 0, 0]);
      ghostShell(keep(new THREE.IcosahedronGeometry(0.57, 0)), CELL_COLORS.capsid, 0.16);
      view = [1.05, 0.85];
      break;
    }
    default: {
      put(outer, sphereGeo(36), shellMat(CELL_COLORS.membrane, '#0d2f4a', 0.42, 0, 2.6));
      cloud(inner, 1.6, '#2f8fb8', 0.14, [0, 0, 0]);
      addNucleus(inner, [0, 0, 0], 0.26);
      specks(inner, 180, 0.8, CELL_COLORS.ribosome, { size: 0.024 });
      ghostShell(sphereGeo(18));
    }
  }

  root.tick = t => { for (const f of tickers) f(t); };
  root.dispose = () => { for (const d of bin) d.dispose?.(); };
  root.userData = { cell: kind, view: interior ? 'interior' : 'exterior', viewRadius: interior ? view[1] : view[0], points: pointMat };
  return root;
}

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
import { createNebula } from './nebula-gen.js';
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
  if (t === 'cell') return 'cell';
  if (t === 'virus') return 'virus';
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
  const kind = classify(spec), seed = seedOf(spec.name), R = rng(seed);
  // nebulae and supernova remnants: raymarched volumes over a shared 3D noise texture (nebula-gen.js); the old sprite stack below stays as the fallback
  if (kind === 'nebula' || kind === 'pnebula' || kind === 'snr') { try { const n = createNebula(THREE, spec); n.userData = { ...(n.userData || {}), kind, spec }; return n; } catch (err) { console.warn('nebula volume failed, using sprites', err); } }
  const group = new THREE.Group();
  group.userData = { kind, spec };
  const tickers = [], disposables = [];
  const C = (r, g, b) => new THREE.Color(r, g, b);
  const sphere = (segments = spec.segments || 64) => { const g = new THREE.SphereGeometry(1, segments, segments / 2); disposables.push(g); return g; };   // spec.segments lowers the mesh detail for scenes with many bodies
  const addSprite = (size, color, color2, shape, soft = 2.5, alpha = 1, depthWrite = false) => {
    const g = new THREE.PlaneGeometry(size, size), m = new THREE.ShaderMaterial({ vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite, blending: THREE.AdditiveBlending, uniforms: { uColor: { value: color }, uColor2: { value: color2 }, uShape: { value: shape }, uTime: { value: 0 }, uSeed: { value: seed }, uSoft: { value: soft }, uAlpha: { value: alpha }, uSize: { value: size } } });
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
    case 'cell': case 'virus': {
      const cell = buildCell(THREE, spec, seed);
      group.add(cell);
      tickers.push(t => cell.tick(t));
      disposables.push({ dispose: () => cell.dispose() });
      group.userData.points = cell.userData.points;
      group.userData.viewRadius = cell.userData.viewRadius;
      break;
    }
    case 'ocean': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 4, c1: C(0.08, 0.25, 0.55), c2: C(0.2, 0.42, 0.18), c3: C(0.55, 0.5, 0.35), atmo: 0.6 }))); addSprite(2.5, C(0.45, 0.65, 1.0), C(0.1, 0.2, 0.5), 3, 11, 0.85); break; }   // Earth-like: blue limb glow
    case 'lava': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 3, c1: C(0.12, 0.08, 0.07), c2: C(1.0, 0.45, 0.1), c3: C(1.0, 0.8, 0.3), atmo: 0 }))); break; }
    case 'icy': { group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 2, c1: C(0.7, 0.74, 0.8), c2: C(0.88, 0.9, 0.95), c3: C(0.5, 0.55, 0.6), atmo: 0 }))); break; }
    case 'gasgiant': { const [c1, c2, c3] = pick(pal.gasgiant); group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 1, c1, c2, c3, atmo: 0.35 }))); const nm = String(spec.name || '').toLowerCase(); if (nm === 'saturn' || nm === 'uranus' || (!SOLAR_NAMES.has(nm) && R() < 0.3)) { /* Jupiter's and Neptune's rings are too faint to draw at this scale */ const rg = new THREE.RingGeometry(nm === 'uranus' ? 1.6 : 1.25, nm === 'uranus' ? 1.75 : 2.3, 96), rm = new THREE.MeshBasicMaterial({ color: c3, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); const ring = new THREE.Mesh(rg, rm); ring.rotation.x = Math.PI / 2 + 0.3; group.add(ring); disposables.push(rg, rm); } addSprite(2.45, c1.clone().lerp(C(1, 1, 1), 0.3), C(0, 0, 0), 3, 12, 0.5); break; }
    case 'rocky': { const [c1, c2, c3] = pick(pal.rocky); group.add(new THREE.Mesh(sphere(), bodyMat({ kind: 0, c1, c2, c3, atmo: spec.type === 'moon' ? 0 : 0.2 }))); if (spec.type !== 'moon') addSprite(2.3, C(0.85, 0.72, 0.6), C(0, 0, 0), 3, 14, 0.3); break; }
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
      const dwarf = kind === 'browndwarf';
      // real light: L = 4 pi R^2 sigma T^4 (or the catalogue's luminosity). The glow follows log L, so red dwarfs are faint and giants blaze.
      const Lw = spec.luminosity_W > 0 ? spec.luminosity_W : spec.radius_m > 0 ? 4 * Math.PI * spec.radius_m ** 2 * 5.670374e-8 * T ** 4 : 3.828e26;
      const glow = Math.min(1.5, Math.max(0.12, 0.62 + 0.14 * Math.min(6, Math.max(-4, Math.log10(Lw / 3.828e26)))));
      addSprite(dwarf ? 5 : 9, c1, C(r * 0.3, g * 0.2, b * 0.2), 3, 2.4, (dwarf ? 0.4 : 0.95) * glow);        // corona: starts bright at the limb, fades outward
      addSprite(dwarf ? 11 : 30, c1, C(0, 0, 0), 3, 0.55, (dwarf ? 0.12 : 0.3) * glow);                       // wide halo of scattered light
      if (!dwarf) addSprite(22, c1.clone().lerp(C(1, 1, 1), 0.6), C(0, 0, 0), 4, 1, 0.5 * glow);            // diffraction-like rays
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
      // a screen-facing quad that ray-traces the hole (see BH_FRAG): shadow, lensed sky, lensed disc, photon ring, Doppler beaming
      const bg = new THREE.PlaneGeometry(22, 22), bm = new THREE.ShaderMaterial({ vertexShader: SPRITE_VERT, fragmentShader: BH_FRAG, transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: { uN: { value: new THREE.Vector3(0, 1, 0) }, uSize: { value: 22 }, uTime: { value: 0 }, uSeed: { value: seed } } });
      const hole = new THREE.Mesh(bg, bm); hole.renderOrder = 10; group.add(hole); disposables.push(bg, bm); tickers.push(t => { bm.uniforms.uTime.value = t; });
      const spin = new THREE.Vector3(0.18, 1, 0.08).normalize(), qi = new THREE.Quaternion();   // the disc's axis in the world; its tilt follows the camera
      hole.onBeforeRender = (r, sc, cam) => { hole.quaternion.copy(cam.quaternion); qi.copy(cam.quaternion).invert(); bm.uniforms.uN.value.copy(spin).applyQuaternion(qi); };
      if (kind === 'quasar') { for (const sgn of [1, -1]) { const cg = new THREE.CylinderGeometry(0.15, 0.6, 9, 16, 1, true), cm = new THREE.MeshBasicMaterial({ color: 0x9fd3ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const jet = new THREE.Mesh(cg, cm); jet.position.y = sgn * 5; jet.rotation.x = sgn > 0 ? 0 : Math.PI; group.add(jet); disposables.push(cg, cm); } addSprite(5, C(0.7, 0.85, 1.0), C(0.1, 0.2, 0.5), 0, 4, 0.9); }
      break;
    }
    case 'galaxy': case 'gcluster': case 'scluster': {
      const n = kind === 'galaxy' ? (spec.points || 9000) : kind === 'gcluster' ? 1500 : 2500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      const nt = spec.notes || '', mo = (/morphology:\s*([^;]+)/i.exec(nt) || [])[1] || '';
      // Hubble type from the catalogue's morphology note (falls back to the first words of the note, then a guess)
      const morph = kind !== 'galaxy' ? '' : /irr|^I[mB]|magellanic|^dI/i.test(mo) || /irregular/i.test(nt.slice(0, 40)) ? 'irr'
        : /^\s*S0|lenticular/i.test(mo + nt.slice(0, 40)) ? 'lent' : /^\s*(E|dE|dSph|cE)|elliptical|spheroidal/i.test(mo + ' ' + nt.slice(0, 40)) || /^M8[67]$/.test(spec.name || '') ? 'ell'
        : /^\s*(SB|SAB)|barred/i.test(mo + nt.slice(0, 60)) ? 'bar' : /^\s*S|spiral/i.test(mo + nt.slice(0, 40)) ? 'spiral' : (R() < 0.25 ? 'ell' : 'spiral');
      const elliptical = morph === 'ell';
      for (let i = 0; i < n; i++) {
        let x, y, z, t;
        if (kind === 'galaxy' && morph === 'irr') {
          const c = Math.floor(R() * 6), cx = Math.sin(c * 12.9) * 0.45, cz = Math.cos(c * 7.3) * 0.45, r = Math.pow(R(), 0.8) * 0.4, th = R() * 2 * Math.PI;
          x = cx + r * Math.cos(th); z = cz + r * Math.sin(th); y = (R() - 0.5) * 0.25; t = 0.1 + 0.5 * R();
        } else if (kind === 'galaxy' && morph === 'lent') {
          const u = R(), r = u > 0.6 ? Math.abs(R() - R()) * 0.25 : Math.min(1, -Math.log(1 - R()) * 0.3), th = R() * 2 * Math.PI;
          x = r * Math.cos(th); z = r * Math.sin(th); y = (R() - 0.5) * (u > 0.6 ? 0.2 : 0.04); t = u > 0.6 ? 0.95 : 0.6 + 0.3 * R();
        } else if (kind === 'galaxy' && morph === 'bar') {
          const u = R(); let x0, z0, tt;
          if (u < 0.35) { const a = (R() - 0.5) * 0.7; x0 = a; z0 = (R() - 0.5) * 0.07; tt = 0.9; }
          else { let r; do { r = -Math.log(1 - R()) * 0.35; } while (r > 1); const arm = Math.floor(R() * 2), th = Math.log(Math.max(r, 0.05) / 0.2) / Math.tan(0.3) + arm * Math.PI + (R() - 0.5) * 0.6, r2 = 0.35 + r * 0.65;
            x0 = r2 * Math.cos(th); z0 = r2 * Math.sin(th); tt = 0.2 + 0.7 * R(); }
          x = x0; z = z0; y = (R() - 0.5) * 0.05; t = tt;
        } else if (kind === 'galaxy' && !elliptical) {
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
      const pts = new THREE.Points(g, m); group.add(pts); disposables.push(g, m); group.userData.points = m; group.userData.morph = morph;
      if (kind === 'galaxy') addSprite(1.2, C(1.0, 0.9, 0.7), C(0.3, 0.2, 0.1), 0, 3, 0.8);
      if (kind === 'gcluster') addSprite(2.4, C(0.6, 0.3, 0.6), C(0, 0, 0), 2, 1, 0.35);   // hot intracluster gas
      if (kind === 'galaxy' && spec.tilt) { pts.rotation.x = Math.acos(2 * R() - 1) - 1.2; pts.rotation.z = R() * 6.28; } tickers.push(t => { pts.rotation.y = t * 0.03; });
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
  group.viewRadius = group.userData.viewRadius || { galaxy: 1.1, gcluster: 1.2, scluster: 1.1, nebula: 1.3, pnebula: 1.3, snr: 1.4, blackhole: 2.2, quasar: 3, pulsar: 2.4, comet: 2.5, star: 1.6, browndwarf: 1.3, whitedwarf: 1.4 }[kind] || 1.15;
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
