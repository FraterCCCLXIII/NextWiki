/* centauri-view.js -- the Centauri lab's 3D viewer.

   One canvas, one craft at a time, the same solved assembly the lab measures (parts/centauri-models.js).
   Lighting is HDRI-free: a PMREM room environment for the metals and glazing, a warm key, a cool
   fill, a rim light from behind, ACES tone mapping with a fixed exposure, so a white hull and a black
   TPS tile sit on the same frame without clipping. The render-mode switch (render-modes.js) and the
   instanced rivet pass (surface-detail.js) are the same ones the spacecraft catalogue uses, so the two
   pages cannot drift.

     createCentauriView({ host, modeSelect, rivetsBox, unfoldRange, spinBox }) -> { show(id), screenshot(), setMode(id) } */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCentauriModel } from './parts/centauri-models.js';
import { RENDER_MODES, applyRenderMode, tickRenderModes } from './render-modes.js';
import { addSurfaceDetail } from './surface-detail.js';
import { boostTrackpadZoom } from './zoom-boost.js';

export function createCentauriView({ host, modeSelect, rivetsBox, unfoldRange, spinBox, person = true, onDeploy = null }) {
  /* the sail mechanism player: direction deploy / retract / jettison, speed in multiples of the base sweep, loop */
  const player = { playing: false, loop: false, speed: 1, direction: 'deploy', baseMs: 6000, architecture: null, jettison: 0, lastId: null };
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a10);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1e7);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.zoomSpeed = 2.4;
  boostTrackpadZoom(controls, renderer.domElement, { pinchGain: 0.06, scrollGain: 0.007, maxStep: 0.45 });
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose(); } catch { /* no environment */ }
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x151a22, 0.35));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.8); scene.add(key);
  const front = new THREE.DirectionalLight(0xdfe8ff, 0.9); scene.add(front);
  const fill = new THREE.DirectionalLight(0x9fc8ff, 0.8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(rim);
  const stage = new THREE.Group(); scene.add(stage);
  let model = null, detail = null, ground = null, figure = null, spanM = 10;

  const niceStep = (t) => { const p = 10 ** Math.floor(Math.log10(t)), f = t / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();

  function personFigure() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffb86b, roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.35, 12).translate(0, 0.68, 0), m));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), m); head.position.y = 1.67; g.add(head);
    return g;
  }

  function clear() { for (const c of [...stage.children]) { stage.remove(c); c.traverse((n) => n.geometry?.dispose?.()); } model = detail = ground = figure = null; }

  function show(id) {
    clear();
    player.lastId = id; player.jettison = 0;
    model = buildCentauriModel(id, { sailArchitecture: player.architecture });
    /* the catalogue poses the craft film-on to its camera; here the thrust axis stands on the grid */
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);
    /* frame the hull, not the film: the hull box is what the model reports as its span */
    const hull = new THREE.Box3();
    model.userData.stages.get(0).updateMatrixWorld(true);
    hull.setFromObject(model.userData.stages.get(0));
    const size = hull.getSize(new THREE.Vector3()), centre = hull.getCenter(new THREE.Vector3());
    spanM = Math.max(size.x, size.y, size.z, 0.02);
    model.position.set(-centre.x, -hull.min.y, -centre.z);
    model.userData.box = hull;
    stage.add(model);
    /* rivets and seams make sense on a hull; on a 1 cm wafer they are stacked coins */
    detail = spanM > 0.5 ? addSurfaceDetail(model, { on: rivetsBox?.checked ?? true }) : null;
    const R = Math.max(spanM * 0.9, 1.5);
    ground = new THREE.Group();
    ground.add(new THREE.GridHelper(R * 2, Math.max(8, Math.round((R * 2) / niceStep(R / 5))), 0x33425c, 0x1a2230));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0e16 })); disc.position.y = -0.01; ground.add(disc);
    stage.add(ground);
    /* the person stands beside the hull -- or beside the film, when a true-size film is the bigger of the two (the wafer) */
    const filmR = model.userData.sail && model.userData.sail.ratio < 1.02 ? model.userData.sail.drawn.R : 0;
    if (person && spanM < 400) { figure = personFigure(); figure.position.set(-Math.max(size.x / 2, filmR) - Math.max(0.6, spanM * 0.04), 0, size.z / 2 * 0.6); stage.add(figure); }
    const dist = spanM * 1.9;
    key.position.set(dist, dist * 1.1, dist * 0.8); fill.position.set(-dist, dist * 0.4, dist * 0.6); front.position.set(dist * 0.3, dist * 0.5, dist * 1.4); rim.position.set(-dist * 0.4, dist * 0.8, -dist);
    controls.target.set(0, size.y * 0.5, 0);
    camera.position.set(dist * 0.55, size.y * 0.55 + dist * 0.28, dist * 0.85);
    camera.near = Math.max(0.005, dist / 5000); camera.far = dist * 400; camera.updateProjectionMatrix(); controls.update();
    home = { pos: camera.position.clone(), target: controls.target.clone(), near: camera.near, far: camera.far };
    applyMode(); applyDeploy();
    return model.userData;
  }

  function applyMode() { if (model) applyRenderMode(model, modeSelect?.value ?? 'studio'); }
  function applyDeploy() {
    if (!model) return;
    const k = Number(unfoldRange?.value ?? 1);
    if (player.direction === 'jettison' && model.userData.setJettison) { model.userData.setDeploy?.(1); model.userData.setJettison(k); player.jettison = k; }
    else { model.userData.setJettison?.(0); model.userData.setDeploy?.(k); }
    if (onDeploy) onDeploy(k, model.userData.sail ? { ...model.userData.sail.readout(k), direction: player.direction, jettison: player.direction === 'jettison' ? model.userData.sail.mechanism.jettison(k) : null } : null);
  }
  /** Frame the deployed film rather than the hull. */
  function fitSail() {
    if (!model) return;
    const film = model.userData.stages.get(1); film.updateMatrixWorld(true);
    /* box the visible meshes only: a released dispenser tray or a cut-away film is not what to frame */
    const bb = new THREE.Box3();
    film.traverse((o) => { if (o.isMesh && o.visible && o.parent?.visible !== false) { let vis = true; for (let p = o; p; p = p.parent) if (p.visible === false) { vis = false; break; } if (vis) bb.expandByObject(o); } });
    if (!Number.isFinite(bb.min.x)) return;
    const size = bb.getSize(new THREE.Vector3()), centre = bb.getCenter(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z) * 1.15;
    controls.target.copy(centre);
    camera.position.set(centre.x + d * 0.55, centre.y + d * 0.5, centre.z + d * 0.85);
    camera.near = Math.max(0.005, d / 5000); camera.far = d * 400; camera.updateProjectionMatrix(); controls.update();
  }
  /** Frame the hull again (the framing show() chose). */
  let home = null;
  function fitHull() { if (!home) return; camera.position.copy(home.pos); controls.target.copy(home.target); camera.near = home.near; camera.far = home.far; camera.updateProjectionMatrix(); controls.update(); }
  function applyDetail() { if (detail) detail.visible = !!rivetsBox?.checked; }
  if (modeSelect) { modeSelect.innerHTML = RENDER_MODES.map((m) => `<option value="${m.id}">${m.name}</option>`).join(''); modeSelect.addEventListener('change', applyMode); }
  rivetsBox?.addEventListener('change', applyDetail);
  unfoldRange?.addEventListener('input', applyDeploy);

  let unfoldTween = null, lastNow = null, pingDir = 1;
  function frame(now) {
    requestAnimationFrame(frame); controls.update(); tickRenderModes(now);
    if (spinBox?.checked && model) model.rotation.y += 0.003;
    if (unfoldTween && unfoldRange) { const k = Math.min(1, (now - unfoldTween) / 2800); unfoldRange.value = k; applyDeploy(); if (k >= 1) unfoldTween = null; }
    if (player.playing && unfoldRange && lastNow != null) {
      /* k advances at speed x the base sweep; retract runs k down; loop ping-pongs (or, for a one-shot mechanism, restarts) */
      const dk = ((now - lastNow) / player.baseMs) * player.speed;
      const dir = player.direction === 'retract' ? -1 : 1;
      let k = Number(unfoldRange.value) + dk * dir * pingDir;
      if (k > 1 || k < 0) {
        if (!player.loop) { k = Math.min(1, Math.max(0, k)); player.playing = false; }
        else if (model?.userData.sail && !model.userData.sail.canRefold && player.direction === 'deploy') k = k > 1 ? 0 : 1;   // one-shot: start again
        else { pingDir *= -1; k = Math.min(1, Math.max(0, k)); }
      }
      unfoldRange.value = k; applyDeploy();
    }
    lastNow = now;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    show, setMode: (id) => { if (modeSelect) modeSelect.value = id; applyMode(); },
    unfold: () => { if (unfoldRange) { unfoldRange.value = 0; applyDeploy(); unfoldTween = performance.now(); } },
    /* the mechanism player */
    play: () => { player.playing = true; pingDir = 1; unfoldTween = null; if (unfoldRange && player.direction === 'deploy' && Number(unfoldRange.value) >= 1) unfoldRange.value = 0; if (unfoldRange && player.direction === 'retract' && Number(unfoldRange.value) <= 0) unfoldRange.value = 1; if (unfoldRange && player.direction === 'jettison' && Number(unfoldRange.value) >= 1) unfoldRange.value = 0; },
    pause: () => { player.playing = false; },
    get playing() { return player.playing; },
    setLoop: (v) => { player.loop = !!v; },
    setSpeed: (v) => { player.speed = Math.max(0.05, Number(v) || 1); },
    setDirection: (d) => { player.direction = ['deploy', 'retract', 'jettison'].includes(d) ? d : 'deploy'; applyDeploy(); },
    setSailArchitecture: (a) => { player.architecture = a || null; if (player.lastId) show(player.lastId); },
    fitSail, fitHull, applyDeploy,
    readout: () => (model?.userData.sail ? model.userData.sail.readout(Number(unfoldRange?.value ?? 1)) : null),
    screenshot: () => renderer.domElement.toDataURL('image/png'),
    orbit: (az, el, k = 1) => { const d = camera.position.distanceTo(controls.target) * k; camera.position.set(controls.target.x + d * Math.cos(el) * Math.sin(az), controls.target.y + d * Math.sin(el), controls.target.z + d * Math.cos(el) * Math.cos(az)); controls.update(); },
    get model() { return model; }
  };
}
