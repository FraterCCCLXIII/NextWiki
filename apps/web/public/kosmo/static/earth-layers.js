// Earth-only extras for the 'ocean' model in kosmo-models.js: a drifting cloud shell, night-side city lights
// and an ocean sun-glint. The colour map and the real relief (NASA topography + bathymetry height map) come
// from textures/index.json through the shared body shader; everything here is a transparent shell above it.
//
//   addEarthLayers(THREE, group, { tickers, disposables, lightDir })
//
// All shells share the body's light vector (group.userData.lightDir, same space as the body shader's normal),
// so the terminator, the lights, the glint and the clouds always agree. Maps are optional: each layer skips
// itself (clouds are procedural) if its image fails to load.

import { layers } from './layers.js';
const url = (name) => new URL(`./textures/${name}`, import.meta.url).href;
export const EARTH_MAPS = { lights: url('earth_lights_8k.jpg'), ocean: url('earth_ocean_mask_4k.png') };

const SHELL_VERT = /* glsl */`
varying vec3 vN; varying vec3 vP; varying vec2 vUv; varying vec3 vV;
void main(){ vN = normalize(normalMatrix * normal); vP = position; vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;

// value-noise fbm (no dependency on the shared NOISE chunk)
const NOISE = /* glsl */`
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm5(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.07 + vec3(11.3, 5.1, 7.7); a *= 0.5; } return s; }
`;

const CLOUD_FRAG = NOISE + /* glsl */`
uniform vec3 uLightDir; uniform float uCover, uSeed;
varying vec3 vN; varying vec3 vP; varying vec3 vV;
float gauss(float x, float m, float w){ float d = (x - m) / w; return exp(-d * d); }
void main(){
  vec3 q = normalize(vP);
  float lat = asin(clamp(q.y, -1.0, 1.0)), al = abs(lat);
  // zonal climate: cloudy ITCZ and storm tracks, clear subtropical belts, thin polar cap
  float bias = 0.16 * gauss(lat, 0.0, 0.14) + 0.2 * gauss(al, 0.98, 0.22) - 0.16 * gauss(al, 0.44, 0.13) - 0.1 * smoothstep(1.25, 1.5, al);
  vec3 p = vec3(q.x, q.y * 2.4, q.z) * 2.3 + uSeed;                   // stretched in latitude: cloud streets run east-west
  vec3 w = vec3(fbm5(p * 0.7 + 3.1), fbm5(p * 0.7 + 9.4), fbm5(p * 0.7 + 1.7)) - 0.5;
  float d = fbm5(p + w * 1.6);                                         // domain-warped body: swirls and fronts
  float fine = fbm5(q * 14.0 + w * 2.0);
  float dens = d + bias + (fine - 0.5) * 0.18;
  float a = smoothstep(0.5 - uCover, 0.74 - uCover * 0.6, dens);
  // lighting: bright on the day side, a thin grey-blue underside, soft terminator
  vec3 n = normalize(vN);
  float ndl = dot(n, uLightDir);
  float day = smoothstep(-0.18, 0.3, ndl);
  float thick = smoothstep(0.45, 1.0, a);
  vec3 col = mix(vec3(0.97, 0.98, 1.0), vec3(0.62, 0.67, 0.78), thick * (1.0 - clamp(ndl, 0.0, 1.0)) * 0.6);
  col *= 0.03 + 0.97 * day;
  col += vec3(1.0, 0.55, 0.3) * 0.18 * smoothstep(0.0, 0.12, ndl) * (1.0 - smoothstep(0.12, 0.32, ndl)) * a;   // sunset-lit edge
  float limb = pow(max(1.0 - max(dot(n, vV), 0.0), 1e-4), 3.0);
  gl_FragColor = vec4(col, a * (0.92 - 0.25 * limb));
}`;

const LIGHTS_FRAG = /* glsl */`
uniform sampler2D uLights; uniform vec3 uLightDir; uniform float uGain;
varying vec3 vN; varying vec2 vUv;
void main(){
  float ndl = dot(normalize(vN), uLightDir);
  float night = 1.0 - smoothstep(-0.12, 0.1, ndl);                      // only past the terminator, fading in with depth of night
  vec3 c = texture2D(uLights, vUv).rgb;
  gl_FragColor = vec4(c * night * uGain, 1.0);
}`;

const SPEC_FRAG = /* glsl */`
uniform sampler2D uMask; uniform vec3 uLightDir; uniform float uGain;
varying vec3 vN; varying vec3 vV; varying vec2 vUv;
void main(){
  vec3 n = normalize(vN), v = normalize(vV), l = normalize(uLightDir);
  float ocean = texture2D(uMask, vUv).r;
  float ndl = dot(n, l);
  vec3 h = normalize(l + v);
  float nh = max(dot(n, h), 1e-4);
  float glint = pow(nh, 160.0) * 0.8 + pow(nh, 24.0) * 0.06;            // tight sun glitter plus a broad sheen
  float fres = 0.02 + 0.98 * pow(max(1.0 - max(dot(n, v), 0.0), 1e-4), 5.0);       // Fresnel: grazing angles reflect the sky
  vec3 sheen = vec3(0.28, 0.42, 0.62) * fres * smoothstep(0.0, 0.35, ndl) * 0.55;
  float lit = smoothstep(0.0, 0.2, ndl);
  gl_FragColor = vec4((vec3(1.0, 0.96, 0.88) * glint + sheen) * ocean * lit * uGain, 1.0);
}`;

export function addEarthLayers(THREE, group, { tickers = [], disposables = [], lightDir, sphere } = {}) {
  const ld = lightDir || group.userData.lightDir || new THREE.Vector3(0.55, 0.35, 0.76).normalize();
  const loader = new THREE.TextureLoader();
  const tex = (u, srgb) => { const t = loader.load(u); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; disposables.push(t); return t; };
  const geo = sphere ? sphere() : new THREE.SphereGeometry(1, 64, 32);
  const mk = (frag, uniforms, o = {}) => { const m = new THREE.ShaderMaterial({ vertexShader: SHELL_VERT, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, ...o }); disposables.push(m); return m; };
  const shell = (mat, radius, order) => { const s = new THREE.Mesh(geo, mat); s.scale.setScalar(radius); s.renderOrder = order; group.add(s); return s; };

  const lights = shell(mk(LIGHTS_FRAG, { uLights: { value: tex(EARTH_MAPS.lights, true) }, uLightDir: { value: ld }, uGain: { value: 2.2 } }, { blending: THREE.AdditiveBlending }), 1.002, 1);
  const spec = shell(mk(SPEC_FRAG, { uMask: { value: tex(EARTH_MAPS.ocean, false) }, uLightDir: { value: ld }, uGain: { value: 1.0 } }, { blending: THREE.AdditiveBlending }), 1.003, 2);
  const cloudMat = mk(CLOUD_FRAG, { uLightDir: { value: ld }, uCover: { value: -0.13 }, uSeed: { value: 4.0 } });
  const clouds = shell(cloudMat, 1.011, 3);

  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  tickers.push(() => { clouds.visible = layers.state.clouds !== false; clouds.rotation.y = ((performance.now() / 1000) - t0) * 0.0035; });   // ~30 min per revolution relative to the ground: slow eastward drift
  const api = { clouds, lights, spec, setCloudCover(v) { cloudMat.uniforms.uCover.value = v; }, setLights(v) { lights.material.uniforms.uGain.value = v; lights.visible = v > 0; }, setGlint(v) { spec.material.uniforms.uGain.value = v; spec.visible = v > 0; } };
  group.userData.earth = api;
  return api;
}
