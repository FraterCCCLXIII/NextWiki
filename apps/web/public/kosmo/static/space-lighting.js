/* space-lighting.js -- the photoreal lighting rig the Centauri viewers share.

   A spacecraft in low orbit is lit by three things: the Sun (hard, warm-white, one direction), the
   Earth (a broad cool-blue fill from below, a quarter of the sky), and nothing else (the black sky, so
   shadows are deep). The station photographs the realism brief was judged against show exactly that:
   crisp self-shadowing under every mounted block, bright white skins against black, blue bounce on the
   undersides, specular glints off anodised trims and solar cells.

   This module builds that without an HDRI download: a procedural environment (a sun disc, an Earth limb
   with a thin atmosphere, a dim star field) run through PMREM for the image-based term, a key light that
   casts shadow maps (soft, with self-shadowing and contact shadows under blocks), a cool fill from the
   Earth side, a rim from behind, and the renderer set to ACES filmic tone mapping with sRGB output.

     const rig = createSpaceLighting(renderer, scene);
     rig.fit(span, centre)          after a model is placed: aims the key and sizes its shadow camera
     enableShadows(root)            every mesh in a model casts and receives

   Pure three; both centauri-view.js and centauri-robotic.html use it so the two pages cannot drift. */

import * as THREE from 'three';

/** A procedural sky: black, a sun, an Earth limb below the horizon, a faint band of stars. Rendered once into a PMREM. */
function skyScene() {
  const sky = new THREE.Scene();
  sky.background = new THREE.Color(0x000000);
  /* the Sun: a small very bright disc high and to one side (the key light's direction) */
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(60, 54, 44) }));
  sun.position.set(28, 36, 24); sky.add(sun);
  /* a soft corona round it, so the specular highlight has a shoulder */
  const halo = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.3), transparent: true, opacity: 0.35, side: THREE.BackSide }));
  halo.position.copy(sun.position); sky.add(halo);
  /* the Earth: a large lit sphere below, its day side toward the sun, a thin blue atmosphere shell */
  const earth = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 32), new THREE.MeshStandardMaterial({ color: 0x5f8fc9, roughness: 1, metalness: 0, emissive: 0x16304f, emissiveIntensity: 0.6 }));
  earth.position.set(0, -78, 0); sky.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(61.5, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.6, 1.2), transparent: true, opacity: 0.18, side: THREE.BackSide }));
  atmo.position.copy(earth.position); sky.add(atmo);
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 3.2); sunLight.position.copy(sun.position); sky.add(sunLight);
  /* a faint grey ceiling so upward-facing panels do not read as pure black in reflections */
  const ceiling = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.07, 0.09), side: THREE.BackSide }));
  sky.add(ceiling);
  return sky;
}

/**
 * Build the rig. Sets tone mapping, colour space and shadow maps on the renderer, the PMREM environment on
 * the scene, and adds key, fill and rim lights. Returns { key, fill, rim, hemi, fit(span, centre), dispose() }.
 */
export function createSpaceLighting(renderer, scene, { exposure = 1.0, envIntensity = 0.9, shadows = true, shadowMapSize = 2048 } = {}) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(skyScene(), 0.02).texture;
    if ('environmentIntensity' in scene) scene.environmentIntensity = envIntensity;
    pm.dispose();
  } catch { /* no environment: the lights carry it */ }
  /* the Earth's blue fill from below and the black sky above: a hemisphere light upside down */
  const hemi = new THREE.HemisphereLight(0x0b1220, 0x5c86c4, 0.45); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3df, 3.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); scene.add(rim);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    key.shadow.bias = -0.00035; key.shadow.normalBias = 0.02;
    key.shadow.radius = 2;
  }
  const target = new THREE.Object3D(); scene.add(target); key.target = target;
  /** Aim the lights at a model of `span` metres centred at `centre`, and size the shadow camera to it. */
  function fit(span, centre = new THREE.Vector3()) {
    const d = Math.max(span, 0.05) * 1.9;
    key.position.copy(centre).add(new THREE.Vector3(d * 0.7, d * 0.9, d * 0.6));
    fill.position.copy(centre).add(new THREE.Vector3(-d * 0.8, -d * 0.35, d * 0.5));
    rim.position.copy(centre).add(new THREE.Vector3(-d * 0.3, d * 0.6, -d));
    target.position.copy(centre);
    if (key.castShadow) {
      const c = key.shadow.camera, half = Math.max(span, 0.05) * 0.62;
      c.left = -half; c.right = half; c.top = half; c.bottom = -half;
      c.near = d * 0.2; c.far = d * 2.2;
      /* depth precision follows the scene: a 1 cm wafer and a 500 m ship both get a bias that is a fraction of their span */
      key.shadow.bias = -Math.max(0.00005, Math.min(0.0008, span * 1e-6));
      key.shadow.normalBias = Math.max(0.005, Math.min(0.6, span * 0.0025));
      c.updateProjectionMatrix();
    }
  }
  return { key, fill, rim, hemi, fit, dispose: () => { for (const l of [hemi, key, fill, rim, target]) scene.remove(l); } };
}

/** Every mesh under `root` casts and receives shadows (thin lines and the sail film only receive). */
export function enableShadows(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const film = !!o.userData.film || o.material?.userData?.surface === 'sail-film';
    o.castShadow = !film && !o.material?.transparent;
    o.receiveShadow = true;
  });
}
