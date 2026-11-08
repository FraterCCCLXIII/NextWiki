/* render-modes.js -- the look, as a switch.

   The models are the same geometry in every mode; only the material pass changes. The modes come
   from the two SpaceRadio pages this was modelled on: the telescope's fresnel atmosphere shader and
   its baked-in fastener materials, and the atlas viewer's ACES + bloom setup. Nothing here touches
   the assemblies -- `studio` restores exactly what the model was built with, so a mode is always
   reversible and physics never depends on it.

   Modes:
     studio     the model's own PBR materials (default)
     clay       one matte material: read the geometry, not the paint
     metal      fully metallic, low roughness, strongest with the room environment
     toon       three-step cel ramp for a drawn look
     technical  cyan wireframe on the model's own silhouette (blueprint)
     hologram   additive fresnel shell with a scanline, reads as a projection
     thermal    false-colour ramp by surface attitude, the shape-reading pass
     wireframe  neutral wireframe

   Pure functions plus one animation hook (`tickRenderModes`), no DOM, so node can exercise it. */

import * as THREE from 'three';

export const RENDER_MODES = [
  { id: 'studio', name: 'Studio (PBR)' },
  { id: 'clay', name: 'Matte clay' },
  { id: 'metal', name: 'Polished metal' },
  { id: 'toon', name: 'Cel shading' },
  { id: 'technical', name: 'Blueprint' },
  { id: 'hologram', name: 'Hologram' },
  { id: 'thermal', name: 'Thermal' },
  { id: 'wireframe', name: 'Wireframe' }
];

const cache = new Map();
const shaderMats = [];

let gradient = null;
function toonGradient() {
  if (gradient) return gradient;
  const steps = new Uint8Array([70, 140, 205, 255]);
  gradient = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const VERT = `
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vP;
  void main() {
    vN = normalize(normalMatrix * normal);
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const HOLOGRAM_FRAG = `
  uniform vec3 uColor;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 0.085 - uTime * 2.6);
    float a = (0.07 + 0.80 * f) * (0.55 + 0.45 * scan);
    gl_FragColor = vec4(uColor * (0.30 + 2.1 * f) * (0.55 + 0.45 * scan), a);
  }
`;

const THERMAL_FRAG = `
  varying vec3 vN;
  varying vec3 vV;
  vec3 ramp(float t) {
    if (t < 0.25) return mix(vec3(0.02, 0.05, 0.36), vec3(0.00, 0.65, 0.95), t / 0.25);
    if (t < 0.50) return mix(vec3(0.00, 0.65, 0.95), vec3(0.16, 0.86, 0.36), (t - 0.25) / 0.25);
    if (t < 0.75) return mix(vec3(0.16, 0.86, 0.36), vec3(0.98, 0.85, 0.16), (t - 0.50) / 0.25);
    return mix(vec3(0.98, 0.85, 0.16), vec3(0.95, 0.12, 0.05), (t - 0.75) / 0.25);
  }
  void main() {
    vec3 n = normalize(vN);
    float t = clamp(dot(n, normalize(vec3(0.35, 0.80, 0.48))) * 0.5 + 0.5, 0.0, 1.0);
    float rim = pow(1.0 - abs(dot(n, normalize(vV))), 1.6);
    gl_FragColor = vec4(ramp(clamp(t + rim * 0.10, 0.0, 1.0)), 1.0);
  }
`;

function build(id) {
  if (id === 'clay') return new THREE.MeshStandardMaterial({ color: 0xd9d3c6, metalness: 0.02, roughness: 0.94 });
  if (id === 'metal') return new THREE.MeshStandardMaterial({ color: 0xb8c3ce, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 });
  if (id === 'toon') return new THREE.MeshToonMaterial({ color: 0xdfe7ee, gradientMap: toonGradient() });
  if (id === 'technical') return new THREE.MeshBasicMaterial({ color: 0x63c9ff, wireframe: true, transparent: true, opacity: 0.92, depthWrite: false });
  if (id === 'wireframe') return new THREE.MeshBasicMaterial({ color: 0xe8eef6, wireframe: true });
  if (id === 'hologram') {
    const m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x6fd3ff) }, uTime: { value: 0 } },
      vertexShader: VERT, fragmentShader: HOLOGRAM_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    shaderMats.push(m);
    return m;
  }
  if (id === 'thermal') {
    const m = new THREE.ShaderMaterial({
      uniforms: {}, vertexShader: VERT, fragmentShader: THERMAL_FRAG, side: THREE.DoubleSide
    });
    return m;
  }
  return null;
}

function materialFor(id) {
  if (!cache.has(id)) cache.set(id, build(id));
  return cache.get(id);
}

/**
 * Apply a mode to a built model. The original material is remembered on each mesh, so `studio`
 * restores it exactly and any mode can be switched for another. Surface-detail overlays (rivets,
 * seams) are left alone: they carry `userData.detail` and belong to the detail toggle.
 */
export function applyRenderMode(root, id) {
  const mode = RENDER_MODES.some((m) => m.id === id) ? id : 'studio';
  root.traverse((o) => {
    if (!o.isMesh || o.userData.detail) return;
    if (mode === 'studio') {
      if (o.userData.origMat) o.material = o.userData.origMat;
      return;
    }
    if (!o.userData.origMat) o.userData.origMat = o.material;
    o.material = materialFor(mode);
  });
}

/** Advance the hologram's scanline. Cheap to call every frame: it does nothing when unused. */
export function tickRenderModes(ms) {
  for (const m of shaderMats) if (m.uniforms?.uTime) m.uniforms.uTime.value = (ms ?? 0) / 1000;
}
