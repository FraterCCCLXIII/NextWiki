// telescope-fx.js - camera-like rendering pieces for point-sprite star / galaxy atlases (three r160, ES module, no dependencies).
//
// PHOTOMETRIC MODEL (one pipeline for everything)
//   * Every source has a TOTAL flux F in "sensor units" (px^2 * linear pixel value).  F = 10^(-0.4 (m - ZP)); m is apparent magnitude.
//   * Inverse-square: F(d) = F1 * (refDist / d)^2 ; angular size = size / d.  A global `dist` multiplier (uDist) scales every d, so one
//     slider "pulls the camera back" for stars and galaxies alike.
//   * A point source is drawn with the SAME PSF (Moffat core + faint halo + optional spikes), peak = F / K.  So all faint stars are the same
//     1-2 px dot; only brightness changes - exactly like a camera.  Bright ones grow because their wings climb above the display threshold.
//   * A resolved galaxy keeps its surface brightness (Euclid) while its size shrinks as 1/d; once its half-light radius is below the PSF the
//     profile is convolved (sizes add in quadrature) and its peak falls as 1/d^2.  No special-casing "point vs sprite": one formula.
//   * Everything is added in a half-float HDR target; `toneMapPass` applies exposure, sky/dust, noise, an asinh (Lupton) stretch, saturation.
//
// EXPORTS
//   Colour/photometry : blackbodyRGB, ZP, magToFlux, cosmoDistances, redshiftedColor, nebulaRGB, NEBULA_GLSL
//   Stars             : telescopeStarMaterial(THREE, opts)           -> PointsMaterial (attrs: position, color, flux, phase, spk)
//   Galaxies (many)   : galaxyInstances(THREE, rows, opts)           -> Mesh (instanced quads, Sersic bulge + exponential disc)
//   Galaxy (one, big) : hubbleGalaxy(THREE, params)                  -> Mesh (layered shader: bulge, bar, disc, arms, knots, dust)
//                       galaxyParamsFromCatalog(row)                 -> params for hubbleGalaxy from {morph, radius_m, incl, pa, bv}
//   Post              : toneMapPass(THREE, renderer, opts)           -> {render(scene,camera), uniforms, setSize, dispose}
//   Exposure          : starPeaks, autoExposure

export const ZP = 13.7;                       // zero point: total flux 1 at m = 13.7  (a m=12 star then has a peak pixel of ~0.6)
export const magToFlux = (m, zp = ZP) => Math.pow(10, -0.4 * (m - zp));
export const PSF_BETA = 2.5;
export const psfAlpha = fwhm => fwhm / 1.1304;                       // Moffat alpha for beta 2.5: fwhm = 2 a sqrt(2^(1/b)-1)
export const psfNorm = fwhm => Math.PI * psfAlpha(fwhm) ** 2 / (PSF_BETA - 1);   // total flux / peak

// ---------------------------------------------------------------- blackbody -> linear sRGB
const g_ = (l, mu, s1, s2) => Math.exp(-0.5 * ((l - mu) / (l < mu ? s1 : s2)) ** 2);   // Wyman et al. 2013 CIE fit
function bbRaw(T) {
  let X = 0, Y = 0, Z = 0;
  for (let l = 380; l <= 780; l += 10) {
    const m = l * 1e-9, P = 1 / (m ** 5 * (Math.exp(1.4388e-2 / (m * T)) - 1));
    X += P * (1.056 * g_(l, 599.8, 37.9, 31) + 0.362 * g_(l, 442, 16, 26.7) - 0.065 * g_(l, 501.1, 20.4, 26.2));
    Y += P * (0.821 * g_(l, 568.8, 46.9, 40.5) + 0.286 * g_(l, 530.9, 16.3, 31.1));
    Z += P * (1.217 * g_(l, 437, 11.8, 36) + 0.681 * g_(l, 459, 26, 13.8));
  }
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z, Y];
}
const BB_N = 256, BB_T0 = 1500, BB_T1 = 40000; let bbLut = null, bbWhite = null;
/** Blackbody colour, linear sRGB, luminance 1. `whiteT` (default 5800 K, a G2 star) is the white balance: that star comes out neutral.
 *  `sat` < 1 desaturates (1 = physical). Writes into `out` (array / vec3) if given. */
export function blackbodyRGB(T, { whiteT = 5800, sat = 1 } = {}, out = [0, 0, 0]) {
  if (!bbLut) { bbLut = new Float32Array(BB_N * 3); for (let i = 0; i < BB_N; i++) { const t = BB_T0 * Math.pow(BB_T1 / BB_T0, i / (BB_N - 1)), c = bbRaw(t); for (let k = 0; k < 3; k++) bbLut[i * 3 + k] = c[k] / c[3]; } }
  if (!bbWhite || bbWhite.T !== whiteT) { const c = bbRaw(whiteT); bbWhite = { T: whiteT, c: [c[0] / c[3], c[1] / c[3], c[2] / c[3]] }; }
  const f = Math.min(Math.max(Math.log(T / BB_T0) / Math.log(BB_T1 / BB_T0), 0), 1) * (BB_N - 1), i = Math.min(Math.floor(f), BB_N - 2), u = f - i;
  let r = 0, gg = 0, b = 0; const w = bbWhite.c;
  for (let k = 0; k < 3; k++) { const v = Math.max((bbLut[i * 3 + k] * (1 - u) + bbLut[i * 3 + 3 + k] * u) / w[k], 0); if (k === 0) r = v; else if (k === 1) gg = v; else b = v; }
  const Y = 0.2126 * r + 0.7152 * gg + 0.0722 * b || 1; r /= Y; gg /= Y; b /= Y;
  out[0] = (1 - sat) + sat * r; out[1] = (1 - sat) + sat * gg; out[2] = (1 - sat) + sat * b; return out;
}

/** Flat LCDM distances in Mpc: {dc, dA, dL}.  Angular size uses dA, flux uses dL, surface brightness dims as (1+z)^-4. */
export function cosmoDistances(z, H0 = 70, Om = 0.3) {
  const N = 200, E = x => Math.sqrt(Om * (1 + x) ** 3 + 1 - Om); let s = 0;
  for (let i = 0; i < N; i++) s += 1 / E((i + 0.5) * z / N);
  const dc = 299792.458 / H0 * s * z / N; return { dc, dA: dc / (1 + z), dL: dc * (1 + z) };
}
/** Colour of a galaxy of rest-frame temperature T at redshift z: Wien shift T/(1+z) (crude k-correction, reddens distant ones). */
export const redshiftedColor = (T, z, o) => blackbodyRGB(T / (1 + z), o);

// ---------------------------------------------------------------- nebula colour (share with the nebula generator)
//   channel strengths (any linear scale):  ha (656 nm), oiii (501 nm), sii (672 nm), refl (reflection, blue scattered starlight)
//   palettes: 'natural' (broadband look), 'sho' (Hubble: S->R, Ha->G, O->B), 'hoo' (Ha->R, OIII->G+B)
const NEB = { ha: [1.0, 0.07, 0.10], oiii: [0.0, 0.62, 0.55], sii: [0.75, 0.0, 0.0], refl: [0.30, 0.50, 1.0] };
export function nebulaRGB(ha, oiii, sii, refl = 0, palette = 'natural', out = [0, 0, 0]) {
  if (palette === 'sho') { out[0] = sii; out[1] = ha; out[2] = oiii; }
  else if (palette === 'hoo') { out[0] = ha; out[1] = oiii; out[2] = oiii; }
  else for (let k = 0; k < 3; k++) out[k] = ha * NEB.ha[k] + oiii * NEB.oiii[k] + sii * NEB.sii[k] + refl * NEB.refl[k];
  return out;
}
export const NEBULA_GLSL = /* glsl */`
vec3 nebulaColor(float ha, float oiii, float sii, float refl, int pal) {
  if (pal == 1) return vec3(sii, ha, oiii);
  if (pal == 2) return vec3(ha, oiii, oiii);
  return ha * vec3(1.0, 0.07, 0.10) + oiii * vec3(0.0, 0.62, 0.55) + sii * vec3(0.75, 0.0, 0.0) + refl * vec3(0.30, 0.50, 1.0);
}`;

const mkU = o => { const u = {}; for (const k in o) u[k] = { value: o[k] }; return u; };

// ---------------------------------------------------------------- STARS
/** PointsMaterial patched to draw camera-like stars.  Geometry attributes: position, color (linear RGB, Y=1, vertexColors), flux (total flux at
 *  uRefDist, via magToFlux), phase (twinkle phase, optional), spk (spike count 0/4/6/8, optional).  Render into the HDR target of toneMapPass.
 *  opts: fwhm (css px, 2.2), haloAmp (0.0012), haloR (css px, 9), spikeAmp (0.06), spikeMin (peak above which spikes appear, 0.25), spike (0 = per-star
 *  `spk`, else force 4/6/8), spikeRot (rad), thresh (display floor, 0.0008), maxPx (css, 260), refDist, dist, exposure.  Live: mat.userData.u.*  */
export function telescopeStarMaterial(THREE, opts = {}) {
  const u = mkU({ uFwhm: 2.2, uK: 1, uHaloAmp: 0.0012, uHaloR: 9, uSpikeAmp: 0.06, uSpikeMin: 0.25, uSpikeN: 0, uSpikeRot: 0.3, uThresh: 0.0008, uMaxPx: 260, uDpr: 1,
    uRefDist: 1000, uDist: 1, uExposure: 1, uTwinkle: 0, uTime: 0, ...opts, ...(opts.fwhm ? { uFwhm: opts.fwhm } : {}) });
  for (const [a, b] of [['fwhm', 'uFwhm'], ['haloAmp', 'uHaloAmp'], ['haloR', 'uHaloR'], ['spikeAmp', 'uSpikeAmp'], ['spikeMin', 'uSpikeMin'], ['spike', 'uSpikeN'], ['spikeRot', 'uSpikeRot'], ['thresh', 'uThresh'], ['maxPx', 'uMaxPx'], ['refDist', 'uRefDist'], ['dist', 'uDist'], ['exposure', 'uExposure']]) if (opts[a] !== undefined) u[b].value = opts[a];
  const mat = new THREE.PointsMaterial({ size: 1, vertexColors: true, sizeAttenuation: false, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  mat.userData.u = u; mat.userData.setPsf = f => { u.uFwhm.value = f; u.uK.value = psfNorm(f); }; mat.userData.setPsf(u.uFwhm.value);
  const decl = 'uniform float uFwhm,uK,uHaloAmp,uHaloR,uSpikeAmp,uSpikeMin,uSpikeN,uSpikeRot,uThresh,uMaxPx,uDpr,uRefDist,uDist,uExposure,uTwinkle,uTime;\n';
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float flux; attribute float phase; attribute float spk;\n' + decl + 'varying float vPk; varying float vHalf; varying float vSpk;\n' + sh.vertexShader.replace('#include <logdepthbuf_vertex>', /* glsl */`
{
  float d_ = max(-mvPosition.z * uDist, 1e-4);
  float f_ = flux * (uRefDist * uRefDist) / (d_ * d_) * uExposure;               // inverse square, exposure
  f_ *= 1.0 + uTwinkle * 0.25 * sin(uTime * 7.3 + phase * 6.2831);                   // scintillation
  float pk_ = f_ / uK;                                                               // peak pixel value of the PSF
  float sp_ = uSpikeN > 0.5 ? uSpikeN : spk;
  float a_ = uFwhm / 1.1304;
  float rc_ = a_ * sqrt(max(pow(pk_ / uThresh, 0.4) - 1.0, 0.0));                   // Moffat core falls below the display floor
  float rh_ = uHaloR * sqrt(max(pow(pk_ * uHaloAmp / uThresh, 0.6667) - 1.0, 0.0)); // wide halo
  float rs_ = (sp_ > 0.5 && pk_ > uSpikeMin) ? 3.0 * uFwhm * (pow(pk_ * uSpikeAmp / uThresh, 0.5556) - 1.0) : 0.0;  // spike length grows with flux
  float R_ = max(max(rc_, rh_), rs_);
  float css_ = clamp(2.0 * R_ + 3.0, 4.0, uMaxPx);
  vPk = pk_; vHalf = 0.5 * css_; vSpk = sp_; gl_PointSize = css_ * uDpr;
  if (pk_ < uThresh * 0.6) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);                  // invisible: cull
}
#include <logdepthbuf_vertex>`);
    sh.fragmentShader = decl + 'varying float vPk; varying float vHalf; varying float vSpk;\n' + sh.fragmentShader.replace('#include <map_particle_fragment>', /* glsl */`
{
  vec2 pp_ = (gl_PointCoord - 0.5) * 2.0 * vHalf; pp_.y = -pp_.y;                  // css px from the star centre (sub-pixel exact)
  float r_ = length(pp_), a_ = uFwhm / 1.1304;
  float I_ = pow(1.0 + r_ * r_ / (a_ * a_), -2.5);                                   // Moffat beta = 2.5 core
  I_ += uHaloAmp * pow(1.0 + r_ * r_ / (uHaloR * uHaloR), -1.5);                     // faint wide halo (bloom only matters when pk is large)
  if (vSpk > 0.5 && vPk > uSpikeMin) {
    float ns_ = vSpk * 0.5;                                                          // number of axes: 2 (4-pt), 3 (6-pt), 4 (8-pt)
    for (int k = 0; k < 4; k++) {
      if (float(k) >= ns_) break;
      float an_ = uSpikeRot + float(k) * 3.14159265 / ns_; vec2 dr_ = vec2(cos(an_), sin(an_));
      float al_ = dot(pp_, dr_), pe_ = dot(pp_, vec2(-dr_.y, dr_.x)), w_ = 0.45 * uFwhm;
      I_ += uSpikeAmp * exp(-0.5 * pe_ * pe_ / (w_ * w_)) * pow(1.0 + abs(al_) / (3.0 * uFwhm), -1.8);
    }
  }
  I_ *= vPk * (1.0 - smoothstep(0.7 * vHalf, vHalf, r_));
  if (I_ < 2e-5) discard;
  diffuseColor.rgb *= I_; diffuseColor.a = 1.0;
}`);
  };
  return mat;
}
/** Peak pixel values of a star set (for autoExposure). flux: Float32Array of flux at refDist. */
export function starPeaks(flux, { fwhm = 2.2, refDist = 1000, dist = 1, distances = null } = {}) {
  const K = psfNorm(fwhm), out = new Float32Array(flux.length);
  for (let i = 0; i < flux.length; i++) { const d = (distances ? distances[i] : refDist) * dist; out[i] = flux[i] * (refDist / d) ** 2 / K; }
  return out;
}
/** Exposure multiplier that keeps the `rank`-th brightest object at the same peak value it had in the reference frame (peaksRef). */
export function autoExposure(peaksNow, peaksRef, rank = 40) {
  const pick = a => { const s = Float32Array.from(a).sort(); return s[Math.max(s.length - 1 - rank, 0)] || 1e-9; };
  return pick(peaksRef) / pick(peaksNow);
}

// ---------------------------------------------------------------- GALAXIES, many (instanced)
const lg = x => { const c = [76.18009173, -86.50532033, 24.01409822, -1.231739516, 0.00120858003, -0.00000536382]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); };
const sersicB = n => 2 * n - 1 / 3 + 0.009876 / n;
/** 1 / (integral of exp(-b((r/re)^(1/n)-1)) over the plane, re = 1, q = 1): converts total flux to surface brightness at re. */
export const sersicInvNorm = n => { const b = sersicB(n); return 1 / (2 * Math.PI * n * Math.exp(b + lg(2 * n)) * Math.pow(b, -2 * n)); };

/** Instanced quads with a Sersic bulge + exponential disc profile, one shader for every distance.
 *  rows[i]: {x,y,z (world pos), re (half-light radius, world units), q (axis ratio 0.1-1), pa (rad, screen), n (Sersic 0.7-4.5),
 *            bt (bulge/total 0-1), flux (total flux at refDist), rgb [r,g,b] (Y=1), arm (0-1, spiral clumpiness, face-on only), dust (0-1)}
 *  Per-instance layout (4 vec4 + vec3 = 15 floats = 60 bytes): iPos vec3 | iA (re,q,pa,n) | iB (bt,flux,arm,dust) | iC (nb = invNorm(n), 0,0,0) | iCol vec3.
 *  opts: fwhm, refDist, dist, exposure, thresh (0.0008), maxQuad (css px, 900). Uniforms live in mesh.material.userData.u; call mesh.userData.setViewport(w,h).
 *  mesh.userData.peaks(camera, viewportH, dist) -> Float32Array of estimated peak pixel values (for autoExposure). */
export function galaxyInstances(THREE, rows, opts = {}) {
  const N = rows.length, g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
  const A = { iPos: new Float32Array(N * 3), iA: new Float32Array(N * 4), iB: new Float32Array(N * 4), iC: new Float32Array(N * 4), iCol: new Float32Array(N * 3) };
  rows.forEach((r, i) => {
    A.iPos.set([r.x, r.y, r.z], i * 3); A.iA.set([r.re, r.q ?? 1, r.pa ?? 0, r.n ?? 1], i * 4);
    A.iB.set([r.bt ?? 0, r.flux, r.arm ?? 0, r.dust ?? 0], i * 4); A.iC.set([sersicInvNorm(r.n ?? 1), 0, 0, 0], i * 4); A.iCol.set(r.rgb || [1, 1, 1], i * 3);
  });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(A.iPos, 3)); for (const k of ['iA', 'iB', 'iC']) g.setAttribute(k, new THREE.InstancedBufferAttribute(A[k], 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(A.iCol, 3)); g.instanceCount = N;
  const u = mkU({ uViewport: new THREE.Vector2(1000, 700), uFwhm: opts.fwhm ?? 2.2, uDist: opts.dist ?? 1, uRefDist: opts.refDist ?? 1000, uExposure: opts.exposure ?? 1, uThresh: opts.thresh ?? 0.0008, uMaxQuad: opts.maxQuad ?? 900 });
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
attribute vec3 iPos; attribute vec4 iA, iB, iC; attribute vec3 iCol;
uniform vec2 uViewport; uniform float uFwhm, uDist, uRefDist, uExposure, uThresh, uMaxQuad;
varying vec2 vP, vC; varying vec4 vS, vT; varying vec3 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  float d = max(-mv.z * uDist, 1e-4), focal = projectionMatrix[1][1] * 0.5 * uViewport.y;     // css px per radian
  float reP = iA.x / d * focal, rho = 0.55 * uFwhm;                                              // PSF blurs the profile: sizes add in quadrature
  float reA = sqrt(reP * reP + rho * rho), reB = sqrt(reP * reP * iA.y * iA.y + rho * rho);
  float F = iB.y * (uRefDist / d) * (uRefDist / d) * uExposure, n = iA.w, b = 2.0 * n - 0.3333 + 0.009876 / n;
  float dens = F / (reA * reB);                                                                  // flux per px^2 at 1 re
  float central = iB.x * iC.x * exp(b) + (1.0 - iB.x) * 0.448;
  vec2 corner = position.xy; vC = corner; vCol = iCol;
  if (dens * central < uThresh * 0.7 || mv.z > 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float sd = log(max(dens * (1.0 - iB.x) * 0.448 / uThresh, 1.0)) / 1.678;                      // radius (in re) where the disc drops under the floor
  float sb = pow(max(1.0 + log(max(dens * iB.x * iC.x / uThresh, 1.0)) / b, 0.0), n);          //  ... and the bulge
  float s = clamp(max(sd, sb), 1.5, 30.0) * 1.05;
  vec2 R = min(vec2(reA, reB) * s, vec2(uMaxQuad));
  vP = corner * R; vS = vec4(reA, reB, n, iB.x); vT = vec4(dens, iB.z, iB.w, iC.x);
  float c = cos(iA.z), sn = sin(iA.z);
  vec2 off = vec2(c * vP.x - sn * vP.y, sn * vP.x + c * vP.y);
  vec4 clip = projectionMatrix * mv; clip.xy += off / (0.5 * uViewport) * clip.w; gl_Position = clip;
}`,
    fragmentShader: /* glsl */`
uniform float uThresh;
varying vec2 vP, vC; varying vec4 vS, vT; varying vec3 vCol;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 u = vP / vS.xy; float s = max(length(u), 1e-4), n = vS.z, bt = vS.w, b = 2.0 * n - 0.3333 + 0.009876 / n;
  float Ib = bt * vT.w * exp(-b * (pow(s, 1.0 / n) - 1.0));                                      // Sersic bulge (normalised)
  float arms = 1.0 + vT.y * (cos(2.0 * (atan(u.y, u.x) - 3.2 * log(s + 0.08))) * smoothstep(0.1, 0.6, s) + 0.5 * (vn(u * 7.0) - 0.5));
  float lane = 1.0 - vT.z * exp(-0.5 * pow(u.y / 0.1, 2.0)) * smoothstep(0.0, 0.4, s);           // edge-on dust lane
  float Id = (1.0 - bt) * 0.448 * exp(-1.678 * s) * max(arms, 0.0) * lane;                       // exponential disc (normalised)
  float I = vT.x * (Ib + Id);
  float fade = 1.0 - smoothstep(0.82, 1.0, max(abs(vC.x), abs(vC.y)));
  I = max(I - uThresh * 0.5, 0.0) * fade; if (I <= 0.0) discard;
  vec3 col = mix(vCol, normalize(vCol * vec3(1.25, 1.0, 0.7) + 0.05) * 1.1, Ib / (Ib + Id + 1e-9));  // bulge is yellower than the disc
  col = mix(col, col * vec3(0.85, 0.95, 1.2), smoothstep(0.8, 3.0, s) * Id / (Ib + Id + 1e-9));       // outer disc bluer
  gl_FragColor = vec4(col * I, 1.0);
}`,
  });
  mat.userData.u = u;
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
  mesh.userData.setViewport = (w, h) => u.uViewport.value.set(w, h);
  mesh.userData.peaks = (camera, vh, dist = 1) => {
    const out = new Float32Array(N), focal = camera.projectionMatrix.elements[5] * 0.5 * vh, fw = u.uFwhm.value, ref = u.uRefDist.value, p = new THREE.Vector3();
    rows.forEach((r, i) => {
      p.set(r.x, r.y, r.z).applyMatrix4(camera.matrixWorldInverse); const d = Math.max(-p.z * dist, 1e-4), reP = r.re / d * focal, rho = 0.55 * fw, q = r.q ?? 1;
      const reA = Math.hypot(reP, rho), reB = Math.hypot(reP * q, rho), F = r.flux * (ref / d) ** 2, n = r.n ?? 1, bt = r.bt ?? 0;
      out[i] = F * (bt * sersicInvNorm(n) * Math.exp(sersicB(n)) + (1 - bt) * 0.448) / (reA * reB);
    }); return out;
  };
  return mesh;
}

// ---------------------------------------------------------------- GALAXY, one large (layered "Hubble image" shader)
// LAYERS (all evaluated per pixel in the fragment shader of ONE camera-facing quad; no point cloud for the smooth light):
//   1 bulge   : spherical Sersic glow, impact parameter on the sky, light in front of the dust plane unattenuated  (smooth, pale gold, no points)
//   2 bar     : planar super-Gaussian ellipse, gold, from the same colour family as the bulge
//   3 disc    : planar exponential glow, yellow-white, fills the gaps between arms, tapers to 0 before the quad edge; brightens with 1/cos(i)
//   4 arm glow: log-spiral cos^p field (m arms, pitch angle, starting at the bar ends / at the ring), broken up by fbm, blue-white
//   5 knots   : procedural cell-noise Gaussians (HII regions / young clusters, 2 scales, a few px to tens of px), probability weighted by the
//               arm field, bluer + some pink; alternatives: an InstancedMesh of billboards fed from the same hash (needed only for interaction)
//   6 dust    : multiplicative absorption exp(-tau * [0.55,0.95,1.7]) (reddish-brown, never black): tau = lanes on the inner (leading) side of
//               the arms + lanes either side of the bar + a ring + a diffuse disc term, all divided by |cos i| along the line of sight
//   7 grain   : pixel-scale multiplicative granularity (unresolved stars); 8 the tone pass does the rest (asinh, noise)
// Plane geometry is exact: the ray of each pixel is intersected with the disc plane in the galaxy frame (matrix uV2L), so inclination,
// bar foreshortening and the dust path length come out right for any tilt.  Units in the shader: R = optical radius (= 1).
const HG_DEFAULTS = {
  type: 0,            // 0 spiral, 1 elliptical, 2 irregular
  R: 1, extent: 1.35, // world radius of the galaxy (optical) and quad half-size in R
  incl: 0, pa: 0,     // degrees, sky-frame (0 = face-on); position angle of the major axis, screen-space, radians-by-degrees
  bulge: 0.5, bulgeR: 0.07, bulgeN: 1.8,           // amplitude at rb, rb in R, Sersic n
  bar: 0.6, barLen: 0.30, barAx: 0.22, barPA: 35,  // strength, half-length (R), axis ratio, angle (deg, in the disc)
  disc: 0.05, discH: 0.30,                         // amplitude (linear units, 0.05 = clearly visible after the stretch), scale length (R)
  arms: 2, pitch: 14, armAmp: 0.05, armSharp: 2.5, ring: 0.0,
  knots: 1.0, dust: 0.9, grain: 0.18, q: 1, seed: 1, exposure: 1,
  colBulge: [1.0, 0.82, 0.56], colDisc: [1.0, 0.89, 0.70], colArm: [0.52, 0.70, 1.0],
};
export function hubbleGalaxy(THREE, params = {}) {
  const P = { ...HG_DEFAULTS, ...params };
  const u = mkU({ uType: P.type, uV2L: new THREE.Matrix3(), uExtent: P.extent, uSeed: P.seed, uExposure: P.exposure, uBulge: P.bulge, uBulgeR: P.bulgeR, uBulgeN: P.bulgeN,
    uBar: P.bar, uBarLen: P.barLen, uBarAx: P.barAx, uBarPA: P.barPA * Math.PI / 180, uArms: P.arms, uPitch: P.pitch * Math.PI / 180, uArmAmp: P.armAmp, uArmSharp: P.armSharp, uRing: P.ring,
    uDisc: P.disc, uDiscH: P.discH, uKnots: P.knots, uDust: P.dust, uGrain: P.grain, uQ: P.q, uPA: P.pa * Math.PI / 180, uR: P.R,
    uColBulge: new THREE.Vector3(...P.colBulge), uColDisc: new THREE.Vector3(...P.colDisc), uColArm: new THREE.Vector3(...P.colArm), uViewport: new THREE.Vector2(1000, 700) });
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
uniform float uExtent, uR; uniform vec2 uViewport; varying vec2 vS; varying float vPx;
void main() {
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float d = max(-mv.z, 1e-4); vPx = uR / d * projectionMatrix[1][1] * 0.5 * uViewport.y;       // css px per R
  vS = position.xy * uExtent; mv.xy += position.xy * uExtent * uR; gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */`
uniform int uType; uniform mat3 uV2L; uniform float uExtent, uSeed, uExposure, uBulge, uBulgeR, uBulgeN, uBar, uBarLen, uBarAx, uBarPA, uArms, uPitch, uArmAmp, uArmSharp, uRing, uDisc, uDiscH, uKnots, uDust, uGrain, uQ, uPA;
uniform vec3 uColBulge, uColDisc, uColArm;
varying vec2 vS; varying float vPx;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
float sers(float r, float rb, float n) { float b = 2.0 * n - 0.3333 + 0.009876 / n; return exp(-b * (pow(max(r, 1e-4) / rb, 1.0 / n) - 1.0)); }
// arm field at disc-plane point p (R units): 0..1, brightest on the arm crest
float armField(vec2 p, float shift) {
  float r = max(length(p), 1e-3), L = uBar > 0.01 ? uBarLen : 0.12, tp = tan(uPitch);
  float phi = atan(p.y, p.x) - log(r / L) / tp - uBarPA;
  float cc = 0.5 + 0.5 * cos(uArms * (phi - shift)), a = 0.65 * pow(cc, uArmSharp) + 0.35 * cc;
  float win = smoothstep(0.85 * L, 1.25 * L, r) * (1.0 - smoothstep(0.72, 1.05, r));
  return a * win * (0.55 + 0.9 * fbm(p * 9.0 + uSeed));
}
// star-forming knots: cell noise, 3x3 neighbours per scale
vec3 knots(vec2 p, float sc, float sizePx, float wArm, float wUni, float amp) {
  vec2 c0 = floor(p * sc); vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = c0 + vec2(float(i), float(j)); vec2 h = h22(id + uSeed * 17.0); float h3 = h21(id * 1.7 + uSeed);
    vec2 q = (id + h) / sc; float w = wArm * armField(q, 0.0) + wUni;
    if (h3 > w * 0.45) continue;
    float sg = min((0.6 + 1.6 * h21(id + 3.1)) * sizePx / vPx, 0.3 / sc), dd = length(p - q);
    float a = amp * (0.15 + 1.4 * pow(h21(id + 9.7), 3.0)) * exp(-0.5 * dd * dd / (sg * sg));
    vec3 kc = h21(id + 5.5) > 0.9 ? vec3(1.0, 0.45, 0.6) : mix(vec3(0.62, 0.78, 1.0), vec3(0.85, 0.92, 1.0), h21(id + 2.2));
    acc += a * kc;
  }
  return acc;
}
void main() {
  vec2 s = vS; float rs = length(s); if (rs > uExtent) discard;
  float edge = 1.0 - smoothstep(0.78 * uExtent, uExtent, rs), kfade = smoothstep(25.0, 140.0, vPx);
  vec3 rgb = vec3(0.0);
  if (uType == 1) {                                                           // ---- grainy elliptical
    float cp = cos(uPA), sp = sin(uPA); vec2 e = vec2(cp * s.x + sp * s.y, -sp * s.x + cp * s.y); e.y /= uQ; float r = length(e);
    float I = uBulge * sers(r, uBulgeR, uBulgeN);
    float gran = 1.0 + uGrain * 2.0 * (vn(s * vPx * 0.7) - 0.5) * (1.0 + 1.5 * smoothstep(0.1, 0.8, r));   // unresolved-star granularity grows outwards
    rgb = I * gran * mix(uColBulge, uColDisc, smoothstep(0.0, 0.6, r)) * edge;
    rgb += knots(s, 20.0, 1.6, 0.0, 0.05 * smoothstep(0.1, 0.5, r) * exp(-r * 2.0), 0.35 * uBulge) * vec3(1.0, 0.9, 0.7) * kfade * edge;   // globular clusters
  } else if (uType == 2) {                                                    // ---- irregular dwarf
    float cp = cos(uPA), sp = sin(uPA); vec2 e = vec2(cp * s.x + sp * s.y, -sp * s.x + cp * s.y); e.y /= uQ; float r = length(e);
    float cl = fbm(e * 5.5 + uSeed), base = exp(-r / uDiscH) * (0.2 + 1.7 * cl * cl);
    vec2 wp = s + 0.25 * (vec2(fbm(e * 3.0 + 1.0), fbm(e * 3.0 + 9.0)) - 0.5);
    rgb = uDisc * 1.6 * base * mix(uColDisc, uColArm, 0.55 * cl) * (1.0 + uGrain * (vn(s * vPx * 0.7) - 0.5)) * edge;
    rgb += knots(wp, 22.0, 2.0, 0.0, 0.55 * exp(-r * 2.8) * cl, 0.5) * uKnots * kfade * edge;
  } else {                                                                    // ---- spiral (barred or not)
    vec3 P0 = uV2L * vec3(s, 0.0), D = uV2L * vec3(0.0, 0.0, -1.0);
    float Dz = abs(D.z) < 0.12 ? (D.z < 0.0 ? -0.12 : 0.12) : D.z, c = abs(Dz);
    vec2 p = P0.xy - P0.z * D.xy / Dz;                                         // point where this pixel's ray crosses the disc plane (R units)
    float r = length(p), cb = cos(uBarPA), sb = sin(uBarPA);
    vec2 pb = vec2(cb * p.x + sb * p.y, -sb * p.x + cb * p.y);                 // bar frame
    float Lb = uBarLen, along = abs(pb.x) / Lb, across = abs(pb.y) / (Lb * uBarAx);
    // smooth light
    float bulge = uBulge * sers(rs, uBulgeR, uBulgeN);
    float bar = uBar * uBulge * 1.1 * exp(-pow(along, 3.2) - across * across) * (0.55 + 0.45 * exp(-along * 1.4));
    float disc = uDisc * exp(-r / uDiscH) * (1.0 - exp(-r / 0.025)) * pow(1.0 / c, 0.6);
    float ar = armField(p, 0.0);
    float ringF = uRing * exp(-0.5 * pow((r - 1.15 * Lb) / (0.07 * Lb + 0.01), 2.0));
    float armG = uArmAmp * (ar + ringF * 0.8) * exp(-r * 1.2) * pow(1.0 / c, 0.4);
    // dust (multiplicative, along the line of sight through the plane)
    float lane = pow(0.5 + 0.5 * cos(uArms * (atan(p.y, p.x) - log(max(r, 1e-3) / (uBar > 0.01 ? uBarLen : 0.12)) / tan(uPitch) - uBarPA - 0.55)), 6.0)
               * smoothstep(0.6 * Lb, 1.2 * Lb, r) * (1.0 - smoothstep(0.7, 1.0, r)) * smoothstep(0.25, 0.6, fbm(p * 12.0 + uSeed * 3.0));
    float barLane = uBar * exp(-pow((pb.y * sign(pb.x) - 0.8 * Lb * uBarAx) / (0.22 * Lb * uBarAx), 2.0)) * step(abs(pb.x), Lb * 1.05) * smoothstep(0.1, 0.4, along)
                  * smoothstep(0.3, 0.6, fbm(p * 14.0 + 3.0));
    float ringLane = exp(-0.5 * pow((r - 0.9 * Lb) / (0.08 * Lb), 2.0)) * 0.5 * fbm(p * 20.0);
    float tau = uDust * (1.5 * lane + 1.3 * barLane + 0.6 * ringLane + 0.35 * exp(-r / 0.6)) / c;
    vec3 T = exp(-tau * vec3(0.55, 0.95, 1.7));
    float Tb = 0.5 + 0.5 * (T.g);                                              // bulge: half of its light is in front of the plane
    float gr = 1.0 + uGrain * 2.0 * (vn(s * vPx * 0.7) - 0.5);
    rgb = bulge * Tb * uColBulge + bar * T * uColBulge * vec3(1.0, 0.96, 0.9);
    rgb += (disc * uColDisc + armG * uColArm) * T * gr;
    vec3 kn = knots(p, 26.0, 0.9, 1.0, 0.0, 0.35) + knots(p, 70.0, 0.6, 1.0, 0.0, 0.18) + knots(p + 5.0, 40.0, 2.0, 0.0, 0.01 * exp(-r * 2.0) * smoothstep(0.1, 0.4, r), 0.3);
    rgb += kn * uKnots * mix(vec3(1.0), T, 0.6) * kfade * pow(1.0 / c, 0.3);
    rgb *= edge;
  }
  gl_FragColor = vec4(rgb * uExposure, 1.0);
}` });
  mat.userData.u = u;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false; mesh.userData.params = P;
  mesh.userData.setViewport = (w, h) => u.uViewport.value.set(w, h);
  /** sky-fixed orientation as catalogued: disc inclination `incl` (0 = face-on) about the major axis, whose position angle on the sky is `pa` (deg). */
  mesh.userData.setViewTilt = (incl, pa) => {
    const i = incl * Math.PI / 180, a = pa * Math.PI / 180, ci = Math.cos(i), si = Math.sin(i), ca = Math.cos(a), sa = Math.sin(a);
    // local -> view = Rz(a) * Rx(i);  shader needs view -> local = transpose
    const m = [ca, -sa * ci, sa * si, sa, ca * ci, -ca * si, 0, si, ci];       // rows of local->view
    const t = new THREE.Matrix3(); t.set(m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]); u.uV2L.value.copy(t); u.uPA.value = a;
  };
  mesh.userData.setViewTilt(P.incl, P.pa);
  return mesh;
}

/** Catalogue row -> hubbleGalaxy params.  row: {morph:'SB(rs)bc' | 'E3' | 'S0' | 'Im' | 'IB(s)m', radius_m (optical radius, any length unit - used as R),
 *  incl (deg, 0 face-on), pa (deg), bv (B-V colour, optional), seed (optional)}.  Returns params incl. R = radius_m. */
export function galaxyParamsFromCatalog(row) {
  const m = String(row.morph || 'Sc').trim(), seed = row.seed ?? ((m.length * 7.13 + (row.radius_m || 1) % 13) % 10);
  const P = { R: row.radius_m || 1, incl: row.incl ?? 0, pa: row.pa ?? 0, seed };
  const bvTint = (T, k = 1) => blackbodyRGB(T, { whiteT: 5800, sat: 0.85 }).map(v => v * k);
  const bvT = row.bv != null ? 4600 * (1 / (0.92 * row.bv + 1.7) + 1 / (0.92 * row.bv + 0.62)) : null;
  if (/^(d?E|cD|dSph|c?E\d?)/.test(m) && !/^(SB|SA|SAB|S0|SB0)/.test(m)) {                       // elliptical
    const e = parseInt(m.replace(/\D/g, '') || '3', 10);
    return { ...P, type: 1, q: 1 - 0.1 * Math.min(e, 7), pa: row.pa ?? 30, bulge: 0.3, bulgeR: 0.11, bulgeN: 3.2, grain: 0.2, colBulge: bvTint(bvT || 4700), colDisc: bvTint((bvT || 4700) * 0.9), extent: 1.6 };
  }
  if (/^(I|Irr|dI|Im|IB|Sm|Sdm|SBm|SBdm)/.test(m) || /^[S].*(m|dm)$/.test(m) && !/^S0/.test(m) && /m$/.test(m)) {   // irregular / Magellanic
    return { ...P, type: 2, q: 0.55 + 0.4 * ((seed * 0.37) % 1), pa: row.pa ?? seed * 40, disc: 0.012, discH: 0.34, grain: 0.3, knots: 1.0, colDisc: bvTint(bvT || 6500, 1), colArm: [0.55, 0.72, 1.0], extent: 1.5 };
  }
  const bar = /^(SB|SBa|SB0)/.test(m) ? 1 : /^SAB/.test(m) ? 0.55 : 0;
  const stage = (m.replace(/\([^)]*\)/g, '').replace(/^(SAB|SB|SA|S)/, '').match(/(ab|bc|cd|dm|a|b|c|d|m)/) || [''])[0];
  const t = { a: 1, ab: 2, b: 3, bc: 4, c: 5, cd: 6, d: 7, dm: 8, m: 9 }[stage] ?? (/^S0/.test(m) ? 0 : 4);
  const ring = /\(r\)|\(rs\)|\(r/.test(m) ? (/\(rs\)/.test(m) ? 0.6 : 1.0) : 0;
  const bt = Math.max(0.03, 0.45 - 0.06 * t);                                                       // bulge-to-total falls along the sequence
  const disc = bvTint(bvT || (7800 - 250 * (9 - t)), 1);
  return { ...P, type: 0, bulge: 0.2 + 1.2 * bt, bulgeR: 0.025 + 0.08 * bt, bulgeN: 1.0 + 1.6 * bt,
    bar, barLen: 0.22 + 0.08 * bar + 0.02 * (6 - Math.min(t, 6)), barAx: 0.3, barPA: (seed * 53) % 180, arms: t >= 8 ? 2 : 2, pitch: 5 + 3.6 * t, armAmp: 0.05 + 0.006 * t, armSharp: 2.6 + 0.1 * t,
    ring, disc: 0.05 + 0.02 * (t > 3 ? 1 : 0), discH: 0.26 + 0.015 * t, knots: 0.7 + 0.08 * t, dust: Math.max(0.15, 1 - Math.abs(t - 4) * 0.15), grain: 0.16,
    colBulge: [1.0, 0.82, 0.56], colDisc: [1.0, 0.9, 0.7].map((v, i) => v * 0.6 + disc[i] * 0.4), colArm: [0.52, 0.70, 1.0] };
}

// ---------------------------------------------------------------- TONE MAP / POST
/** HDR target + full-screen pass.  render(scene, camera): scene -> half-float target (additive) -> screen.
 *  Pipeline per pixel (linear, before the stretch):  x = hdr + dust/IFN glow + optional nebula;  vignette;  shot+read noise;  black level;
 *  Lupton asinh stretch of luminance with colour ratios preserved:  y = asinh(a L)/asinh(a W),  rgb *= y/L;  saturation;  hue-preserving clip with
 *  a smooth roll to white on the brightest cores (this is the "saturation bloom" colour behaviour);  1/255 dither.
 *  opts uniforms (mutable via .uniforms.X.value): uSoft a (300), uWhite W (1.5), uBlack, uSat (1.15), uShot (0.9), uRead (0.0006), uVig,
 *  uDust (0.0035), uBgScale, uBgOffset, uNeb (0), uNebPal (0 natural, 1 sho, 2 hoo), uSky (linear sky pedestal rgb), uSeed.  */
export function toneMapPass(THREE, renderer, opts = {}) {
  const size = new THREE.Vector2(); renderer.getDrawingBufferSize(size);
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const u = mkU({ tHDR: rt.texture, uRes: size.clone(), uTime: 0, uSoft: 300, uWhite: 1.5, uBlack: 0.0, uSat: 1.15, uShot: 0.9, uRead: 0.0006, uVig: 0.25, uDust: 0.0035, uBgScale: 2.2, uBgOffset: new THREE.Vector2(), uNeb: 0, uNebPal: 0, uSky: new THREE.Vector3(0.0006, 0.0005, 0.0005), uGrainOn: 1, ...opts });
  const mat = new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: /* glsl */`
precision highp float;
uniform sampler2D tHDR; uniform vec2 uRes, uBgOffset; uniform float uTime, uSoft, uWhite, uBlack, uSat, uShot, uRead, uVig, uDust, uBgScale, uNeb, uGrainOn; uniform int uNebPal; uniform vec3 uSky;
varying vec2 vUv;
${NEBULA_GLSL}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + 5.3; a *= 0.5; } return s; }
float asnh(float x) { return log(x + sqrt(x * x + 1.0)); }
void main() {
  vec3 x = texture2D(tHDR, vUv).rgb;
  vec2 q = vUv * vec2(uRes.x / uRes.y, 1.0) * uBgScale + uBgOffset;
  // integrated-flux-nebula / galactic cirrus: low-frequency fbm, ridged filaments, brown-grey
  float f = fbm(q), rg = 1.0 - abs(2.0 * fbm(q * 1.9 + 3.1) - 1.0);
  float dust = pow(smoothstep(0.32, 0.85, f), 1.6) * (0.35 + 0.9 * rg * rg);
  x += uDust * dust * vec3(0.62, 0.46, 0.33) + uSky;
  if (uNeb > 0.0) {                                                           // optional emission-nebula layer using the shared palette
    float ha = pow(smoothstep(0.45, 0.9, fbm(q * 0.7 + 11.0)), 1.5), ox = pow(smoothstep(0.5, 0.95, fbm(q * 0.55 + 31.0)), 1.5), si = pow(smoothstep(0.5, 0.95, fbm(q * 0.8 + 51.0)), 1.5), rf = pow(smoothstep(0.55, 0.95, fbm(q * 0.6 + 71.0)), 2.0);
    x += uNeb * 0.02 * nebulaColor(ha, ox, si * 0.6, rf, uNebPal);
  }
  vec2 vc = vUv - 0.5; x *= 1.0 - uVig * dot(vc, vc) * 1.6;
  // sensor noise: shot (sqrt of signal) + read, mostly mono with a little chroma
  float g1 = h21(gl_FragCoord.xy + uTime * 13.1) + h21(gl_FragCoord.xy * 1.37 + uTime * 7.7) + h21(gl_FragCoord.xy * 0.71 + 3.3) - 1.5;
  vec3 gc = vec3(h21(gl_FragCoord.xy + 1.7 + uTime), h21(gl_FragCoord.xy + 5.1 + uTime), h21(gl_FragCoord.xy + 9.3 + uTime)) - 0.5;
  x += uGrainOn * (g1 * 0.8 + gc * 0.5) * (uRead + uShot * 0.012 * sqrt(max(x, 0.0)));
  x = max(x - uBlack, 0.0);
  float L = max(dot(x, vec3(0.2126, 0.7152, 0.0722)), 1e-7);
  float y = asnh(uSoft * L) / asnh(uSoft * uWhite);                             // asinh stretch: log-like above 1/a, linear below
  vec3 o = x * (y / L);
  o = mix(vec3(dot(o, vec3(0.2126, 0.7152, 0.0722))), o, uSat);
  float m = max(o.r, max(o.g, o.b));
  if (m > 1.0) o = mix(o / m, vec3(1.0), 1.0 - exp(-(m - 1.0) * 1.4));         // clip keeps hue, rolls to white
  o += (h21(gl_FragCoord.xy + 0.5) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}` });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const quad = new THREE.Mesh(tri, mat); quad.frustumCulled = false; const sc = new THREE.Scene(); sc.add(quad); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms: u, target: rt,
    setSize() { renderer.getDrawingBufferSize(size); rt.setSize(size.x, size.y); u.uRes.value.copy(size); },
    render(scene, camera) {
      u.uTime.value = (u.uTime.value + 0.017) % 100;
      const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(prev); renderer.render(sc, cam);
    },
    dispose() { rt.dispose(); mat.dispose(); tri.dispose(); },
  };
}
