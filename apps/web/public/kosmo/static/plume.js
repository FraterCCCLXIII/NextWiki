// plume.js -- the exhaust of the Shipyard's engines: a soft, turbulent, additive flame instead of a lathe cone.
// createPlume(THREE, { R0, engines }) returns a Group named 'plume' (hidden until it is given thrust); its
// userData.update({ time, throttle, length, width, density, vacuum }) poses it each frame.
//
// The flame is two quads crossed on the engine axis, shaded entirely in the fragment shader: a tight column that swells
// off the bell and frays into a ragged tail, plus a wider, dimmer wake around it; the shock diamonds of an over-expanded
// sea-level plume fade out as the air thins, and thin air turns the wake pale blue. The edges come from the shader (a
// radial falloff, a windowed billboard and a scrolling turbulence field), so there is no hard cone silhouette, and each
// bell carries its own small glow so a cluster reads as several lit nozzles. No dynamic geometry, and only the glows
// use a texture.

const VERT = `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAG = `#include <common>
#include <logdepthbuf_pars_fragment>
varying vec2 vUv;
uniform float uTime, uThrottle, uVac, uDensity, uJet, uGain, uOpacity, uSeed;

float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.07 + 17.3; a *= 0.5; } return s; }

void main() {
  #include <logdepthbuf_fragment>
  bool wake = uJet > 0.5;                          // the dim envelope around the bright flame
  float t = clamp(1.0 - vUv.y, 0.0, 1.0);          // 0 at the nozzle exit, 1 at the tip
  float xr = (vUv.x - 0.5) * 2.0;                  // -1..1 across the plume

  // outline: a tight column at the bell that swells over the first third, then frays into a broad wake. The width
  // wobbles along the axis, so the silhouette is lumpy rather than a turned cone; thin air lets it balloon.
  float grow = smoothstep(0.0, 0.32, t);
  float w = mix(0.13, 0.78, grow) * (1.0 - 0.34 * smoothstep(0.45, 1.0, t));
  w *= 1.0 + uVac * (0.35 + 0.95 * smoothstep(0.10, 0.85, t));
  float wob = 0.62 + 0.85 * fbm(vec2(t * (wake ? 2.6 : 4.2) - uTime * (wake ? 1.1 : 1.8), uSeed * 11.0));
  w = max(0.04, w * wob * (wake ? 1.25 : 1.0));

  // turbulence: scrolling, sheared noise that bends the axis and breaks the edges into tongues
  float speed = wake ? 2.6 : 4.2;
  float turb = fbm(vec2(xr * 2.4 + uSeed * 7.0, t * speed - uTime * speed * 0.75));
  float lump = fbm(vec2(xr * 0.85 - uSeed * 3.0, t * 2.0 - uTime * 1.4));
  float x = xr + (turb - 0.5) * (0.16 + 0.40 * uVac) * grow + (lump - 0.5) * (wake ? 0.42 : 0.28) * grow;
  float rr = abs(x) / w;

  // the luminous body: dense on the axis with a soft halo, and turbulent cells that brighten and darken it
  float body = exp(-rr * rr * (wake ? 1.2 : 1.8));
  float billow = 0.30 + 1.45 * fbm(vec2(xr * 3.4 - uSeed * 5.0, t * 5.0 - uTime * 5.5));
  float axial = smoothstep(0.02, 0.16, t) * pow(max(1.0 - t, 0.0), wake ? 0.55 : 0.85);
  float win = 1.0 - smoothstep(0.74, 1.0, abs(xr));   // fade at the billboard's edge, or the quad shows as a rectangle

  // shock diamonds: the standing waves of an over-expanded sea-level plume, gone once the air is thin. Their spacing
  // drifts with the turbulence so they do not line up as a bead chain.
  float diaWarp = fbm(vec2(t * 2.2, uSeed)) * 1.6 - 0.8;
  float diamonds = pow(0.5 + 0.5 * cos(t * 26.0 - 0.8 + diaWarp), 10.0) * exp(-rr * rr * 16.0)
                 * smoothstep(0.02, 0.10, t) * (1.0 - smoothstep(0.28, 0.60, t)) * uDensity * (wake ? 0.0 : 1.0);

  float core = exp(-rr * rr * (wake ? 2.0 : 2.6));
  vec3 deep = vec3(1.00, 0.14, 0.010);             // sooty outer edge
  vec3 mid = vec3(1.00, 0.38, 0.030);              // the orange body
  vec3 hot = vec3(1.00, 0.84, 0.52);               // the yellow-white core
  vec3 wakeCol = vec3(0.48, 0.60, 1.00);           // a thin-air plume goes pale blue-white
  vec3 col = mix(deep, mid, smoothstep(0.04, 0.65, body));
  if (wake) col = mix(vec3(1.00, 0.20, 0.015), vec3(1.00, 0.40, 0.040), smoothstep(0.10, 0.75, body));
  col = mix(col, hot, clamp(core * 0.55 + diamonds * 0.30, 0.0, 1.0));
  // flame tongues: hot clumps that travel down the plume, so the bright core is broken rather than a drawn line
  float tongue = pow(fbm(vec2(xr * 1.6 + uSeed * 3.0, t * 3.2 - uTime * 3.0)), 2.2);
  col += hot * tongue * (1.0 - smoothstep(0.0, 0.75, t)) * 0.6;
  col = mix(col, mix(wakeCol, hot, core * 0.18), uVac * (wake ? 0.85 : 0.55));

  // torn edges: the noise gates the opacity more strongly at the edges, so the outside breaks into separate tongues
  float grain = fbm(vec2(xr * 7.0 + uSeed * 13.0, t * 9.5 - uTime * 8.5));
  float rag = smoothstep(0.12, 0.72, grain * (0.55 + 0.6 * (1.0 - body)));

  float flicker = 1.0 + 0.06 * sin(uTime * 61.0 + uSeed * 4.0) + 0.04 * sin(uTime * 137.0 + uSeed);
  float intensity = uGain * (0.30 + 0.70 * uThrottle) * flicker * (1.0 - 0.35 * uVac);
  float alpha = body * billow * axial * win * uOpacity * mix(1.0, rag, wake ? 0.75 : 0.32) * (1.0 + 0.35 * uVac);

  gl_FragColor = vec4(col * intensity * (1.0 + diamonds), clamp(alpha * (1.0 + diamonds * 0.5), 0.0, 1.0));
}`;

let glowTexture = null;
function glowMap(THREE) {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,232,196,0.55)');
  grd.addColorStop(0.22, 'rgba(255,190,110,0.30)');
  grd.addColorStop(0.55, 'rgba(255,120,45,0.09)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function flameMaterial(THREE, { wake, seed, gain, opacity }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uThrottle: { value: 0 }, uVac: { value: 0 }, uDensity: { value: 1 },
      uJet: { value: wake ? 1 : 0 }, uGain: { value: gain }, uOpacity: { value: opacity }, uSeed: { value: seed },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
}

/**
 * The plume for a stage of radius R0 (m). `engines` are [x, z] offsets of the nozzle exits in the model's frame
 * (the group sits on the exit plane itself, so y = 0 here). Returns a Group named 'plume' with userData.update.
 */
export function createPlume(THREE, { R0 = 1, engines = [[0, 0]] } = {}) {
  const group = new THREE.Group();
  group.name = 'plume';
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);   // top edge on the exit plane, hanging down -y
  const crossed = (material, parent) => { for (const ry of [0, Math.PI / 2]) { const m = new THREE.Mesh(quad, material); m.rotation.y = ry; parent.add(m); } };

  // the bright flame, and the wider, dimmer wake that gives it its billowing bulk
  const bodyMat = flameMaterial(THREE, { wake: false, seed: 1.7, gain: 2.6, opacity: 0.85 });
  const wakeMat = flameMaterial(THREE, { wake: true, seed: 8.9, gain: 1.8, opacity: 0.45 });
  const body = new THREE.Group(), wake = new THREE.Group();
  crossed(bodyMat, body);
  crossed(wakeMat, wake);
  group.add(wake, body);

  // the hot exit of each bell: a small soft glow, so a cluster reads as several lit nozzles
  const ventMat = new THREE.SpriteMaterial({ map: glowMap(THREE), color: 0xffd7a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  const vents = new THREE.Group();
  for (const [x, z] of (engines.length ? engines : [[0, 0]])) {
    const s = new THREE.Sprite(ventMat);
    s.position.set(x, 0, z);
    vents.add(s);
  }
  group.add(vents);

  // the nozzle glow: the hot, soft flare of the whole engine bay (the bloom pass picks it up)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(THREE), color: 0xffb877, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  glow.position.y = -R0 * 0.25;
  group.add(glow);

  group.userData.update = ({ time = 0, throttle = 1, length = R0 * 10, width = R0 * 4, density = 1, vacuum = false } = {}) => {
    const th = Math.max(0, Math.min(1, throttle)), vac = vacuum ? 1 : 0, dens = Math.max(0, Math.min(1, density));
    for (const m of [bodyMat, wakeMat]) { const u = m.uniforms; u.uTime.value = time; u.uThrottle.value = th; u.uVac.value = vac; u.uDensity.value = dens; }
    body.scale.set(width * 0.55, Math.max(length * 0.86, 0.001), width * 0.55);
    wake.scale.set(width, Math.max(length, 0.001), width);
    for (const s of vents.children) s.scale.setScalar(R0 * (0.42 + 0.16 * th) * (vac ? 1.25 : 1));
    ventMat.opacity = 0.25 + 0.4 * th;
    glow.scale.setScalar(R0 * (1.2 + 0.7 * th) * (vac ? 1.2 : 1));
    glow.material.opacity = 0.10 + 0.20 * th;
  };
  group.userData.update({});
  return group;
}
