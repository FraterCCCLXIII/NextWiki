// view3d.js -- the shared photoreal 3D view for the Landing Lab and the Shipyard.
//
//   createView3D({ host, cam: () => ({ N, mm, auto }), dark: () => boolean })
//     .init()           load three.js and build the renderer (call once, before the first draw)
//     .draw(sim, trail) render one frame for a simulation object; `sim` needs { veh, s, E, deck(t), done } as landing-sim.js provides,
//                       `trail` is an array of { x, y } points
//     .invalidate()     rebuild the scene on the next draw (after a vehicle or background change)
//     .resetFocus()     forget a manual focus distance
//   mountViewControls(el, { onMode, onChange }) builds the 2D/3D toggle, the black-studio switch and the camera card (aperture, focal length,
//   autofocus) and returns { cam, dark, is3d, setMode, note }.
//
// Rendering: Preetham sky + image-based light, animated ocean, PBR materials, sun shadows that follow the stage, ACES tone mapping,
// bloom on the exhaust, and a thin-lens camera (f-stop -> depth of field and exposure, focal length -> field of view).
// Everything needs three.js through an import map ("three" and "three/addons/").

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function createView3D(opts) {
  let T3 = null;
async function init3() {
  if (T3) return T3;
  const THREE = await import('three');
  const [{ OrbitControls }, { Sky }, { Water }, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { BokehPass }, { OutputPass }] = await Promise.all([
    import('three/addons/controls/OrbitControls.js'), import('three/addons/objects/Sky.js'), import('three/addons/objects/Water.js'), import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'), import('three/addons/postprocessing/UnrealBloomPass.js'), import('three/addons/postprocessing/BokehPass.js'), import('three/addons/postprocessing/OutputPass.js')]);
  const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
  const host = opts.host, renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.35; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true; host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam3 = new THREE.PerspectiveCamera(40, 1, 0.5, 1e6), controls = new OrbitControls(cam3, renderer.domElement);
  controls.enableDamping = true; controls.maxDistance = 30000; controls.minDistance = 1.5; controls.zoomSpeed = 3.5;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  const renderPass = new RenderPass(scene, cam3), bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.3, 0.5, 2.2), bokeh = new BokehPass(scene, cam3, { focus: 100, aperture: 0, maxblur: 0.01 });
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(bokeh); composer.addPass(new OutputPass());
  const sun = new THREE.DirectionalLight(0xfff2dd, 3.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
  // wave normal map, generated here (a fetched texture would add a network dependency and CORS failures)
  const normals = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const u = x / 256 * 6.283, w = y / 256 * 6.283, i = (y * 256 + x) * 4; im.data[i] = 128 + 50 * Math.sin(3 * u + 2 * Math.sin(w)) + 30 * Math.sin(7 * w + u); im.data[i + 1] = 128 + 50 * Math.sin(4 * w + 2 * Math.sin(u)) + 30 * Math.sin(6 * u - w); im.data[i + 2] = 255; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  T3 = { RoomEnvironment, fill, rim, THREE, renderer, scene, cam3, controls, composer, bloom, bokeh, sun, Sky, Water, normals, built: null, prev: null, pmrem: new THREE.PMREMGenerator(renderer) };
  controls.addEventListener('start', () => { controls.userZoomed = true; }); addEventListener('resize', resize3); resize3(); return T3;
}
function resize3() { if (!T3) return; const w = innerWidth, h = innerHeight; T3.renderer.setSize(w, h); T3.composer.setSize(w, h); T3.cam3.aspect = w / h; T3.cam3.updateProjectionMatrix(); }
// small procedural textures: soot / panel lines on the stage, regolith or asphalt noise on the ground
function canvasTex(THREE, w, h, paint, repeat) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (repeat) t.repeat.set(repeat[0], repeat[1]); return t; }
const noisePaint = (base, amp) => (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = Math.floor(128 + (Math.random() - 0.5) * amp); g.fillStyle = `rgba(${v},${v},${v},0.18)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2 + Math.random() * 6); } };
function build3(sim) {
  const { THREE, scene, sun } = T3, v = sim.veh, moon = v.world === 'moon', kind = v.target.kind, R = v.diameter / 2;
  if (T3.world) { scene.remove(T3.world); T3.world.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
  if (T3.sky) { scene.remove(T3.sky); T3.sky = null; }
  T3.water = null; scene.environment = null; scene.fog = null; scene.background = null;
  const W = new THREE.Group(); T3.world = W; scene.add(W);
  const PM = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.6, metalness: 0.1, ...o });
  // --- lighting and sky ---
  const dark = opts.dark(), sunElev = moon ? 22 : 38, sunAz = 130, sunDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - sunElev) * Math.PI / 180, sunAz * Math.PI / 180);
  T3.sunDir = sunDir; T3.dark = dark; sun.intensity = dark ? 4.5 : moon ? 5 : 3.2; sun.color.set(moon ? 0xffffff : 0xfff0dc);
  if (!moon && !dark) {
    const sky = new T3.Sky(); sky.scale.setScalar(450000); const u = sky.material.uniforms; u.turbidity.value = 3.5; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82; u.sunPosition.value.copy(sunDir);
    scene.add(sky); T3.sky = sky; T3.skyU = u;
    const env = new THREE.Scene(); const sky2 = new T3.Sky(); sky2.scale.setScalar(450000); Object.assign(sky2.material.uniforms.turbidity, { value: 3.5 }); sky2.material.uniforms.rayleigh.value = 1.6; sky2.material.uniforms.mieCoefficient.value = 0.004; sky2.material.uniforms.mieDirectionalG.value = 0.82; sky2.material.uniforms.sunPosition.value.copy(sunDir); env.add(sky2);
    scene.environment = T3.pmrem.fromScene(env, 0.04).texture; scene.fog = new THREE.FogExp2(0xa9c4de, 0.00006);
  } else if (dark) {
    scene.background = new THREE.Color(0x000000); scene.add(T3.fillLight = T3.fillLight || new THREE.HemisphereLight(0x222233, 0x111111, 0.15)); T3.fillLight.intensity = 0.5;
    scene.environment = T3.pmrem.fromScene(new T3.RoomEnvironment(), 0.04).texture;      // neutral softbox studio light for the metal
  } else {
    const pts = []; for (let i = 0; i < 2500; i++) { const a = Math.random() * 6.283, b = Math.acos(Math.random() * 0.98); pts.push(Math.cos(a) * Math.sin(b) * 300000, Math.cos(b) * 300000, Math.sin(a) * Math.sin(b) * 300000); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); W.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 260, sizeAttenuation: true, fog: false })));
    scene.background = new THREE.Color(0x000000); scene.add(T3.fillLight = T3.fillLight || new THREE.HemisphereLight(0x222233, 0x111111, 0.15));
  }
  // --- ground / sea / pad / ship / tower ---
  const poolTex = canvasTex(THREE, 512, 512, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#202022'); gr.addColorStop(0.35, '#131314'); gr.addColorStop(0.7, '#050505'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  poolTex.wrapS = poolTex.wrapT = THREE.ClampToEdgeWrapping;
  const darkGround = y => { const bg = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), new THREE.MeshBasicMaterial({ color: 0x000000 })); bg.rotation.x = -Math.PI / 2; bg.position.y = y - 0.05; W.add(bg); const pool = new THREE.Mesh(new THREE.CircleGeometry(900, 96), new THREE.MeshBasicMaterial({ map: poolTex })); pool.rotation.x = -Math.PI / 2; pool.position.y = y; pool.receiveShadow = true; W.add(pool); };
  if (dark) darkGround(kind === 'ship' ? -3.2 : -0.2);
  if (kind === 'ship') {
    if (dark) { /* black studio: no sea */ }
    else if (T3.normals) { const water = new T3.Water(new THREE.PlaneGeometry(200000, 200000), { textureWidth: 1024, textureHeight: 1024, waterNormals: T3.normals, sunDirection: sunDir.clone(), sunColor: 0xffeedd, waterColor: 0x0a4668, distortionScale: 3.0, fog: !!scene.fog, size: 1.4 }); water.rotation.x = -Math.PI / 2; water.position.y = -3.2; W.add(water); T3.water = water; }
    else if (!dark) { const sea = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), PM(0x08354f, { roughness: 0.15, metalness: 0.3, clearcoat: 1 })); sea.rotation.x = -Math.PI / 2; sea.position.y = -3.2; W.add(sea); }
    const ship = new THREE.Group(); T3.deck = ship; W.add(ship);
    const steel = canvasTex(THREE, 512, 512, noisePaint('#3a4048', 80), [6, 3]);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(92, 4, 52), PM(0xffffff, { map: steel, roughness: 0.55, metalness: 0.5 })); deck.position.y = -2; deck.castShadow = deck.receiveShadow = true; ship.add(deck);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(90, 6, 50), PM(0x1d2228, { roughness: 0.6, metalness: 0.4 })); hull.position.y = -7; ship.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(92.2, 0.9, 52.2), PM(0xb02a22, { roughness: 0.6 })); stripe.position.y = -4.2; ship.add(stripe);
    for (const [x, z] of [[-44, -24], [-44, 24], [44, -24], [44, 24]]) { const thr = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 3, 20), PM(0x2a3037, { metalness: 0.6 })); thr.position.set(x * 0.92, 1.4, z * 0.92); thr.castShadow = true; ship.add(thr); }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 10), PM(0xdfe3e8, { roughness: 0.5 })); bridge.position.set(-46, 6, 0); bridge.castShadow = true; ship.add(bridge);
    const mark = new THREE.Mesh(new THREE.RingGeometry(14, 15, 64), new THREE.MeshBasicMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide, toneMapped: false })); mark.rotation.x = -Math.PI / 2; mark.position.y = 0.05; ship.add(mark);
    const x = new THREE.Mesh(new THREE.BoxGeometry(18, 0.1, 1), new THREE.MeshBasicMaterial({ color: 0xf2f2f2, toneMapped: false })); x.position.y = 0.06; ship.add(x); const x2 = x.clone(); x2.rotation.y = Math.PI / 2; ship.add(x2);
  } else {
    const gtex = canvasTex(THREE, 512, 512, noisePaint(moon ? '#6b6b6b' : '#59634a', moon ? 120 : 70), [900, 900]);
    if (!dark) { const ground = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), PM(0xffffff, { map: gtex, roughness: 1, metalness: 0 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.2; ground.receiveShadow = true; W.add(ground); }
    if (kind === 'catch') {
      const steel = PM(0x7c838d, { metalness: 0.7, roughness: 0.4 }); const tw = new THREE.Mesh(new THREE.BoxGeometry(8, 130, 8), steel); tw.position.set(-(R + 8), 65, 0); tw.castShadow = tw.receiveShadow = true; W.add(tw);
      for (const z of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(R + 9, 2.2, 2.2), steel); arm.position.set(-(R + 8) / 2 - 2, v.target.deckY - 1, z * (R + 1)); arm.castShadow = true; W.add(arm); }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 1.2, 48), PM(0x9a9fa4, { roughness: 0.9 })); base.position.y = 0.4; base.receiveShadow = true; W.add(base);
    } else { const pad = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 0.8, 64), PM(0xffffff, { map: canvasTex(THREE, 512, 512, noisePaint(moon ? '#8c8c8c' : '#a3a7aa', 40), [4, 4]), roughness: 0.85 })); pad.position.y = 0.2; pad.receiveShadow = true; W.add(pad); const h = new THREE.Mesh(new THREE.RingGeometry(6, 7, 48), new THREE.MeshBasicMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide, toneMapped: false })); h.rotation.x = -Math.PI / 2; h.position.y = 0.62; W.add(h); }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(v.target.radius - 0.5, v.target.radius, 64), new THREE.MeshBasicMaterial({ color: 0x7fe0a0, side: THREE.DoubleSide, transparent: true, opacity: 0.8, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = kind === 'catch' ? v.target.deckY : (kind === 'ship' ? 0.15 : 0.7); W.add(ring); T3.ring = ring;
  // --- the stage: CoM at the group origin, body axis +y ---
  const rock = new THREE.Group(); T3.rock = rock; W.add(rock);
  const skin = canvasTex(THREE, 256, 1024, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(0.82, '#e6e9ec'); gr.addColorStop(1, '#3b3835'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, w, h * 0.05); g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 2; for (let y = 40; y < h; y += 86) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(30,25,20,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, h * (0.55 + 0.45 * Math.random()), 3, 18); } });
  skin.wrapS = THREE.RepeatWrapping; skin.repeat.set(1, 1);
  const bodyMat = PM(0xffffff, { map: skin, metalness: 0.55, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, v.length, 48, 1), bodyMat); body.position.y = v.length / 2 - v.comHeight; body.castShadow = body.receiveShadow = true; rock.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, R * 0.9, 48), PM(0x1f2226, { metalness: 0.7, roughness: 0.5 })); skirt.position.y = -v.comHeight + R * 0.45; skirt.castShadow = true; rock.add(skirt);
  const engBell = PM(0x2b2420, { metalness: 0.9, roughness: 0.35 });
  const nEng = Math.min(v.engines, 9), ring9 = nEng > 1 ? R * 0.55 : 0;
  for (let i = 0; i < nEng; i++) { const a = i * 6.283 / Math.max(nEng - (nEng > 7 ? 1 : 0), 1), r = (nEng > 7 && i === nEng - 1) ? 0 : ring9; const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * (nEng > 1 ? 0.2 : 0.4), R * 0.45, 20), engBell); b.position.set(Math.cos(a) * r, -v.comHeight - R * 0.1, Math.sin(a) * r); b.castShadow = true; rock.add(b); }
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R, v.length * 0.012, 48), PM(0x24282d, { metalness: 0.5 })); nose.position.y = v.length - v.comHeight; rock.add(nose);
  // --- control surfaces, by vehicle: lattice grid fins (Falcon, Super Heavy), fixed tail fins + drag-brake ring (New Shepard), strakes + flaps (New Glenn) ---
  const style = { falcon9: 'grid', falcon9lz: 'grid', superheavy: 'grid', newshepard: 'tail', newglenn: 'strake' }[v.id] || (v.finArea > 0 ? 'grid' : 'none');
  const top = v.length - v.comHeight, bot = -v.comHeight, finMat = PM(0x59616b, { metalness: 0.85, roughness: 0.38 }), darkMat = PM(0x23272c, { metalness: 0.6, roughness: 0.5 }), chrome = PM(0xd9dde2, { metalness: 1, roughness: 0.18 });
  T3.fins = [];
  const plate = (pts, depth, mat) => { const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; };
  if (style === 'grid') for (let a = 0; a < 4; a++) {
    const ang = a * Math.PI / 2, pivot = new THREE.Group(); pivot.position.set(Math.cos(ang) * R, top - R * 1.5, Math.sin(ang) * R); pivot.rotation.y = -ang;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.07, R * 0.07, R * 0.5, 12), chrome); shaft.rotation.z = Math.PI / 2; shaft.position.x = R * 0.2; pivot.add(shaft);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(R * 0.22, R * 0.4, R * 0.32), darkMat); mount.position.x = R * 0.05; mount.castShadow = true; pivot.add(mount);
    const fin = new THREE.Group(); fin.position.x = R * 0.5; const fw = R * 0.78, fh = R * 0.62, fd = R * 0.12, t = R * 0.045;   // fin plane is y (span) x z (chord); thin along x
    for (const [w, h, x, y] of [[fd, t * 1.6, 0, fh / 2], [fd, t * 1.6, 0, -fh / 2], [fd, fh, 0, 0]]) { }
    const bar = (sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), finMat); m.position.set(px, py, pz); m.castShadow = true; fin.add(m); };
    bar(fd, t * 2, fw, 0, fh / 2, 0); bar(fd, t * 2, fw, 0, -fh / 2, 0); bar(fd, fh, t * 2, 0, 0, fw / 2); bar(fd, fh, t * 2, 0, 0, -fw / 2);
    for (let i = 1; i < 6; i++) { bar(fd * 0.9, t, fw, 0, -fh / 2 + fh * i / 6, 0); bar(fd * 0.9, fh, t, 0, 0, -fw / 2 + fw * i / 6); }
    fin.rotation.y = 0; pivot.add(fin); rock.add(pivot); T3.fins.push(pivot); pivot.userData.axis = 'x';
  }
  if (style === 'tail') {
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2, f = plate([[0, 0], [0, v.length * 0.2], [R * 0.95, v.length * 0.07], [R * 0.95, 0]], R * 0.07, finMat); f.position.set(Math.cos(ang) * R, bot + R * 0.1, Math.sin(ang) * R); f.rotation.y = -ang; rock.add(f); }
    const ringG = new THREE.Group(); ringG.position.y = top - v.length * 0.1; rock.add(ringG); T3.brakes = [];
    for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4, hinge = new THREE.Group(); hinge.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R); hinge.rotation.y = -ang; const pet = new THREE.Mesh(new THREE.BoxGeometry(R * 0.02, v.length * 0.1, R * 0.38), PM(0xc8ccd2, { metalness: 0.5, roughness: 0.45 })); pet.position.y = -v.length * 0.05; pet.castShadow = true; hinge.add(pet); ringG.add(hinge); T3.brakes.push(hinge); }
    const bandR = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.03, R * 1.03, v.length * 0.012, 48), darkMat); bandR.position.y = 0; ringG.add(bandR);
  }
  if (style === 'strake') {
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2 + Math.PI / 4, st = plate([[0, 0], [R * 0.45, v.length * 0.1], [R * 0.45, v.length * 0.5], [0, v.length * 0.52]], R * 0.06, finMat); st.position.set(Math.cos(ang) * R, top - v.length * 0.6, Math.sin(ang) * R); st.rotation.y = -ang; rock.add(st); }
    for (let a = 0; a < 4; a++) { const ang = a * Math.PI / 2, pv = new THREE.Group(); pv.position.set(Math.cos(ang) * R, top - R * 0.9, Math.sin(ang) * R); pv.rotation.y = -ang; const fl = plate([[0, 0], [R * 0.9, R * 0.2], [R * 0.9, R * 1.0], [0, R * 1.1]], R * 0.07, finMat); fl.position.y = -R * 0.5; pv.add(fl); rock.add(pv); T3.fins.push(pv); pv.userData.axis = 'z'; }
  }
  if (v.target.kind === 'catch') for (const sgn of [-1, 1]) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.07, R * 0.09, R * 0.55, 16), chrome); pin.rotation.x = Math.PI / 2; pin.position.set(0, top - R * 2.4, sgn * (R + R * 0.2)); pin.castShadow = true; rock.add(pin); const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.15, R * 0.15, R * 0.06, 16), darkMat); cap.rotation.x = Math.PI / 2; cap.position.set(0, top - R * 2.4, sgn * (R + R * 0.5)); rock.add(cap); }
  // --- landing legs: hinge brackets, a telescoping main strut (outer sleeve + chrome piston), a brace and an actuator, an aero fairing, a ball-jointed foot pad ---
  T3.legs = []; if (v.legRadius > 0) for (let a = 0; a < 4; a++) {
    const L = { ang: a * Math.PI / 2 + Math.PI / 4 }, cyl = (mat, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, seg), mat); m.castShadow = true; rock.add(m); return m; };
    L.sleeve = cyl(PM(0x8f979f, { metalness: 0.8, roughness: 0.4 })); L.piston = cyl(chrome); L.brace = cyl(PM(0x7b838b, { metalness: 0.8, roughness: 0.45 })); L.actOut = cyl(PM(0x6c747c, { metalness: 0.8, roughness: 0.4 })); L.actIn = cyl(chrome);
    L.fair = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), PM(0xe9edf1, { metalness: 0.35, roughness: 0.4 })); L.fair.castShadow = true; rock.add(L.fair);
    L.hinge = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), darkMat); L.hinge.castShadow = true; rock.add(L.hinge); L.hinge2 = L.hinge.clone(); rock.add(L.hinge2);
    L.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), chrome); rock.add(L.ball);
    L.pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 0.28, 24), darkMat); L.pad.castShadow = L.pad.receiveShadow = true; rock.add(L.pad);
    L.crush = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), PM(0xc9a23a, { metalness: 0.2, roughness: 0.7 })); rock.add(L.crush);
    T3.legs.push(L);
  }
  // exhaust plume: three nested additive lathe shells (glow, flame, core) that start at the nozzle exit and are clipped at the ground
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); T3.clip = clip;
  const prof = (r0, bulge) => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(r0 * (0.55 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.2)) * (1 - t) + 0.001, -t)); } return pts; };
  const flame = new THREE.Group(); T3.flameParts = [];
  for (const [r, bulge, col, op] of [[R * 0.62, 0.55, 0xff5a1a, 0.28], [R * 0.5, 0.35, 0xffaa40, 0.5], [R * 0.3, 0.2, 0xfff4d0, 0.9]]) {
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof(r, bulge), 24), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: [clip], fog: false }));
    m.material.color.multiplyScalar(3); flame.add(m); T3.flameParts.push(m);
  }
  flame.position.y = -v.comHeight - R * 0.45; flame.visible = false; rock.add(flame); T3.flame = flame;
  T3.flameLight = new THREE.PointLight(0xff9a50, 0, 0, 1.6); W.add(T3.flameLight);
  const blast = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); blast.material.color.multiplyScalar(2); blast.rotation.x = -Math.PI / 2; blast.visible = false; W.add(blast); T3.blast = blast;
  const trailG = new THREE.BufferGeometry(); trailG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 4000), 3)); trailG.setDrawRange(0, 0);
  const trail3 = new THREE.Line(trailG, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55, fog: false })); trail3.frustumCulled = false; W.add(trail3); T3.trail = trail3;
  T3.built = sim; T3.first = true;
}
function draw3(sim, trail) {
  if (!T3) return;
  const { THREE, composer, cam3, controls } = T3, v = sim.veh, s = sim.s, cs = opts.cam();
  if (T3.built !== sim) build3(sim);
  const rock = T3.rock, deckY = sim.deck(s.t) - v.target.deckY;
  rock.position.set(s.x, s.y, 0); rock.rotation.z = -s.th;
  if (T3.deck) T3.deck.position.y = deckY;
  if (T3.water) { T3.water.material.uniforms['time'].value = s.t * 0.6 + performance.now() / 4000; }
  if (T3.fins) T3.fins.forEach((f, i) => { const k = (i % 2 ? 1 : -1) * s.fin * 0.6; if (f.userData.axis === 'x') f.children[2].rotation.x = k; else f.rotation.z = k * 0.5; });
  const R = v.diameter / 2, vac = v.world === 'moon' || s.y > 60000, fl = s.thrust > 1 ? clamp(s.thrust / (v.engines * v.eng.thrustVac), 0, 1.2) : 0;
  T3.flame.visible = fl > 0;
  const base = new THREE.Vector3(0, -v.comHeight - R * 0.45, 0).applyEuler(rock.rotation).add(rock.position), gY0 = v.target.kind === 'catch' ? 0 : sim.deck(s.t);
  T3.clip.constant = -(gY0 + 0.05);                                   // nothing of the plume is drawn below the deck or ground
  let L = 0;
  if (fl > 0) {
    const fk = 0.85 + 0.15 * Math.sin(s.t * 70) + 0.07 * Math.sin(s.t * 173);
    L = v.length * (0.35 + 0.55 * fl) * fk * (vac ? 0.8 : 1);
    T3.flameParts.forEach((m, i) => { m.scale.set(1 + (vac ? 1.2 : 0.15 * i) + 0.06 * Math.sin(s.t * 90 + i), L * (1 - 0.18 * i), 1 + (vac ? 1.2 : 0)); m.rotation.y = s.t * 3 + i; });
    T3.flame.rotation.z = -s.gimbal;
  }
  T3.flameLight.intensity = fl > 0 ? 4e5 * fl * (v.diameter / 3.7) ** 2 : 0; T3.flameLight.position.set(base.x, Math.max(base.y - L * 0.3, gY0 + 1.5), 0);
  const hgt = base.y - gY0; T3.blast.visible = fl > 0 && hgt < L * 1.15 && !vac;
  if (T3.blast.visible) { const k = 1 - clamp(hgt / (L * 1.15), 0, 1); T3.blast.position.set(base.x, gY0 + 0.3, 0); T3.blast.scale.setScalar(v.diameter * (0.8 + 2.2 * k)); T3.blast.material.opacity = 0.15 + 0.4 * k * fl; }
  const dep = sim.E.on || s.y - v.yf < 400 ? 1 : 0.06, hinge = Math.min(0.16 * v.length, 9), th3 = Math.max(0.28, R * 0.085), Y = new THREE.Vector3(0, 1, 0);
  const link = (m, P, Q, rad) => { const d = Q.clone().sub(P), len = Math.max(d.length(), 1e-4); m.position.copy(P).addScaledVector(d, 0.5); m.scale.set(rad, len, rad); m.quaternion.setFromUnitVectors(Y, d.normalize()); };
  for (const L of T3.legs) {
    const a = L.ang, ca = Math.cos(a), sa = Math.sin(a), rf = R + (v.legRadius - R) * dep, fy = -v.comHeight + 0.55;
    const A = new THREE.Vector3(ca * R * 1.03, -v.comHeight + hinge, sa * R * 1.03), F = new THREE.Vector3(ca * rf, fy, sa * rf), B = new THREE.Vector3(ca * R * 1.03, -v.comHeight + hinge * 0.35, sa * R * 1.03);
    const M = A.clone().lerp(F, 0.5), P2 = A.clone().lerp(F, 0.62);
    link(L.sleeve, A, M, th3 * 1.35); link(L.piston, M.clone().lerp(A, 0.2), F, th3 * 0.8);
    link(L.brace, B, P2, th3 * 0.7);
    const act = B.clone().lerp(P2, 0.5); link(L.actOut, B, act, th3 * 0.62); link(L.actIn, act.clone().lerp(B, 0.15), P2, th3 * 0.4);
    // fairing: a flat panel lying along the upper strut on the outer face
    const dirS = F.clone().sub(A).normalize(), fairLen = A.distanceTo(F) * 0.55, mid = A.clone().addScaledVector(dirS, fairLen / 2);
    L.fair.position.copy(mid).add(new THREE.Vector3(ca, 0, sa).multiplyScalar(th3 * 1.1)); L.fair.scale.set(th3 * 0.4, fairLen, th3 * 3.4); L.fair.quaternion.setFromUnitVectors(Y, dirS); L.fair.rotateY(-a);
    L.hinge.position.copy(A); L.hinge.scale.set(th3 * 2.2, th3 * 2.6, th3 * 3.2); L.hinge.rotation.set(0, -a, 0);
    L.hinge2.position.copy(B); L.hinge2.scale.set(th3 * 1.8, th3 * 1.8, th3 * 2.6); L.hinge2.rotation.set(0, -a, 0);
    L.ball.position.copy(F); L.ball.scale.setScalar(th3 * 1.25);
    L.pad.position.set(F.x, -v.comHeight + 0.14, F.z); L.pad.scale.set(th3 * 3.4, 1, th3 * 3.4);
    L.crush.position.copy(F).lerp(M, 0.18); L.crush.scale.set(th3 * 0.95, th3 * 1.4, th3 * 0.95); L.crush.quaternion.setFromUnitVectors(Y, dirS);
  }
  if (T3.brakes) T3.brakes.forEach(h => { h.rotation.z = -(sim.E.on || s.y - v.yf < 4000 ? 0.45 : 0.04); });
  // trail
  const pa = T3.trail.geometry.attributes.position, n = Math.min(trail.length, 4000); for (let i = 0; i < n; i++) pa.setXYZ(i, trail[i].x, trail[i].y, 0); pa.needsUpdate = true; T3.trail.geometry.setDrawRange(0, n);
  // sun shadows follow the stage
  const sun = T3.sun, sc = Math.max(v.length * 1.4, 40); sun.target.position.set(s.x, Math.max(gY0, s.y - v.comHeight * 0.5), 0); sun.position.copy(sun.target.position).addScaledVector(T3.sunDir, 600);
  Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 10, far: 1500 }); sun.shadow.camera.updateProjectionMatrix();
  T3.fill.intensity = T3.rim.intensity = 0;
  if (T3.dark) { const c = cam3.position, t = rock.position, dir = new THREE.Vector3().subVectors(c, t).setY(0).normalize(); T3.fill.intensity = 2.2; T3.rim.intensity = 3.5; T3.fill.target.position.copy(t); T3.rim.target.position.copy(t);
    T3.fill.position.copy(t).addScaledVector(dir, 400).add(new THREE.Vector3(-dir.z, 150, dir.x).multiplyScalar(250)); T3.rim.position.copy(t).addScaledVector(dir, -400).add(new THREE.Vector3(0, 250, 0)); }
  // --- thin-lens camera: focal length -> field of view (24 mm sensor height), chase distance scales with it ---
  cam3.fov = 2 * Math.atan(12 / cs.mm) * 180 / Math.PI; cam3.updateProjectionMatrix();
  // frame the whole stage by default: aim at the middle of the body and back off until its full length fits (with room for the header and panels)
  const tgt = new THREE.Vector3(s.x, s.y + (v.length / 2 - v.comHeight) * Math.cos(s.th), 0), tanHalf = Math.tan(cam3.fov * Math.PI / 360);
  const fitDist = (v.length * 0.5 * 1.55) / tanHalf, dist = Math.max(fitDist, clamp((s.y - v.yf) * 0.25, 0, 3000) * (cs.mm / 35));
  if (T3.first) { cam3.position.set(s.x + dist * 0.9, s.y + dist * 0.25, dist * 1.1); controls.target.copy(tgt); T3.first = false; T3.prev = tgt.clone(); }
  const d = tgt.clone().sub(T3.prev || tgt); cam3.position.add(d); controls.target.add(d); T3.prev = tgt.clone();
  const off = cam3.position.clone().sub(controls.target), cur = off.length(); if (!controls.userZoomed) { off.setLength(sim.done ? dist : cur + (dist - cur) * 0.2); cam3.position.copy(controls.target).add(off); }
  cam3.near = Math.max(0.3, cur * 0.01); cam3.far = 1e6; controls.update();
  // focus on the stage; aperture N -> depth of field (blur ~ 1/N) and exposure (~ 1/N^2, softened by auto-ISO)
  const focus = cam3.position.distanceTo(rock.position), camOffsetFocus = cs.auto ? focus : T3.manualFocus ?? focus; T3.manualFocus = camOffsetFocus;
  // blur grows with the lens (focal length squared), with a wider aperture (1/N) and as the subject gets closer
  T3.bokeh.uniforms['focus'].value = camOffsetFocus; T3.bokeh.uniforms['aperture'].value = clamp(8e-5 * (2.8 / cs.N) * (cs.mm / 35) ** 2 * (100 / Math.max(camOffsetFocus, 5)) ** 2, 0, 6e-4);
  T3.bokeh.uniforms['maxblur'].value = 0.012;
  T3.renderer.toneMappingExposure = (T3.dark ? 0.75 : v.world === 'moon' ? 0.7 : 0.35) * Math.pow(5.6 / cs.N, 0.6);
  T3.bloom.strength = 0.25 + 0.3 * Math.min(fl, 1);
  composer.render();
}

  return {
    init: init3,
    draw: draw3,
    resize: resize3,
    invalidate() { if (T3) T3.built = null; },
    resetFocus() { if (T3) T3.manualFocus = null; },
    get ready() { return !!T3; },
  };
}

export function mountViewControls(el, { onMode = () => {}, onChange = () => {} } = {}) {
  el.innerHTML = `<div><span class="dim small">view </span><button data-m="2d" class="on">2D</button><button data-m="3d">3D</button><span class="v3note dim small"></span>
    <label class="chk" style="margin:4px 0 0"><input type="checkbox" class="dark"> black studio background</label></div>
    <div class="cam3 card f" style="display:none;margin:6px 0 0">
      <label>Aperture <b class="fstopV"></b></label><input type="range" class="fstop" min="1.4" max="22" step="0.1" value="2.8">
      <label>Focal length <b class="focalV"></b></label><input type="range" class="focal" min="14" max="800" step="1" value="35">
      <label class="chk"><input type="checkbox" class="afocus" checked> autofocus on the stage</label></div>`;
  const q = c => el.querySelector(c); let is3d = false;
  const fmt = () => { q('.fstopV').textContent = 'f/' + (+q('.fstop').value).toFixed(1); q('.focalV').textContent = q('.focal').value + ' mm'; };
  for (const c of ['.fstop', '.focal']) q(c).addEventListener('input', () => { fmt(); onChange('camera'); });
  q('.afocus').addEventListener('change', () => onChange('focus')); q('.dark').addEventListener('change', () => onChange('dark'));
  const api = {
    cam: () => ({ N: +q('.fstop').value, mm: +q('.focal').value, auto: q('.afocus').checked }), dark: () => q('.dark').checked, is3d: () => is3d,
    note: t => { q('.v3note').textContent = t ? ' ' + t : ''; },
    async setMode(m3) { if (m3) { const ok = await onMode(true); if (ok === false) return; } else onMode(false); is3d = m3; q('.cam3').style.display = m3 ? 'block' : 'none'; for (const b of el.querySelectorAll('button[data-m]')) b.classList.toggle('on', (b.dataset.m === '3d') === m3); },
  };
  for (const b of el.querySelectorAll('button[data-m]')) b.onclick = () => api.setMode(b.dataset.m === '3d');
  fmt(); return api;
}
