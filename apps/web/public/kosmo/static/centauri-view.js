/* centauri-view.js -- the Centauri lab's 3D viewer.

   One canvas, one craft at a time, the same solved assembly the lab measures (parts/centauri-models.js).
   Lighting is HDRI-free: a PMREM room environment for the metals and glazing, a warm key, a cool
   fill, a rim light from behind, ACES tone mapping with a fixed exposure, so a white hull and a black
   TPS tile sit on the same frame without clipping. The render-mode switch (render-modes.js) and the
   instanced rivet pass (surface-detail.js) are the same ones the spacecraft catalogue uses, so the two
   pages cannot drift.

     createCentauriView({ host, modeSelect, rivetsBox, detailBox, liveryBox, cutawayBox, unfoldRange, spinBox }) -> { show(id), screenshot(), setMode(id), orbit(), setView() } */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCentauriModel } from './parts/centauri-models.js';
import { RENDER_MODES, applyRenderMode, tickRenderModes } from './render-modes.js';
import { addSurfaceDetail } from './surface-detail.js';
import { boostTrackpadZoom } from './zoom-boost.js';
import { addHumanDetail } from './parts/detail-pass.js';

export function createCentauriView({ host, modeSelect, rivetsBox, detailBox, liveryBox, cutawayBox, unfoldRange, spinBox, person = true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a10);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1e7);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.zoomSpeed = 2.4;
  boostTrackpadZoom(controls, renderer.domElement, { pinchGain: 0.25, scrollGain: 0.009, maxStep: 0.8 });
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose(); } catch { /* no environment */ }
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x151a22, 0.35));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.8); scene.add(key);
  const front = new THREE.DirectionalLight(0xdfe8ff, 0.9); scene.add(front);
  const fill = new THREE.DirectionalLight(0x9fc8ff, 0.8); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(rim);
  const stage = new THREE.Group(); scene.add(stage);
  let model = null, detail = null, human = null, ground = null, figure = null, spanM = 10;

  const niceStep = (t) => { const p = 10 ** Math.floor(Math.log10(t)), f = t / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();

  function personFigure() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xffb86b, roughness: 0.6 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 1.35, 12).translate(0, 0.68, 0), m));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), m); head.position.y = 1.67; g.add(head);
    return g;
  }

  function clear() { for (const c of [...stage.children]) { stage.remove(c); c.traverse((n) => { if (!n.isInstancedMesh && !n.userData.detail) n.geometry?.dispose?.(); }); } model = detail = human = ground = figure = null; }

  function show(id) {
    clear();
    model = buildCentauriModel(id);
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
    /* the human-scale fittings: handrails, hatches, windows, bolts, ladders, placed from the parts' surfaces */
    human = spanM > 0.5 ? addHumanDetail(model, { registration: model.userData.livery?.registration }) : null;
    if (human) human.visible = detailBox?.checked ?? true;
    model.userData.setCutaway?.(!!cutawayBox?.checked);
    const R = Math.max(spanM * 0.9, 1.5);
    ground = new THREE.Group();
    ground.add(new THREE.GridHelper(R * 2, Math.max(8, Math.round((R * 2) / niceStep(R / 5))), 0x33425c, 0x1a2230));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a0e16 })); disc.position.y = -0.01; ground.add(disc);
    stage.add(ground);
    if (person && spanM < 400) { figure = personFigure(); figure.position.set(-size.x / 2 - Math.max(0.6, spanM * 0.04), 0, size.z / 2 * 0.6); stage.add(figure); }
    const dist = spanM * 1.9;
    key.position.set(dist, dist * 1.1, dist * 0.8); fill.position.set(-dist, dist * 0.4, dist * 0.6); front.position.set(dist * 0.3, dist * 0.5, dist * 1.4); rim.position.set(-dist * 0.4, dist * 0.8, -dist);
    controls.target.set(0, size.y * 0.5, 0);
    camera.position.set(dist * 0.55, size.y * 0.55 + dist * 0.28, dist * 0.85);
    camera.near = Math.max(0.005, dist / 5000); camera.far = dist * 400; camera.updateProjectionMatrix(); controls.update();
    applyMode(); applyDeploy();
    return model.userData;
  }

  function applyMode() { if (model) applyRenderMode(model, modeSelect?.value ?? 'studio', { livery: !!liveryBox?.checked }); }
  function applyHuman() { if (human) human.visible = !!detailBox?.checked; }
  function applyCutaway() { model?.userData.setCutaway?.(!!cutawayBox?.checked); }
  function applyDeploy() { model?.userData.setDeploy?.(Number(unfoldRange?.value ?? 1)); }
  function applyDetail() { if (detail) detail.visible = !!rivetsBox?.checked; }
  if (modeSelect) { modeSelect.innerHTML = RENDER_MODES.map((m) => `<option value="${m.id}">${m.name}</option>`).join(''); modeSelect.addEventListener('change', applyMode); }
  rivetsBox?.addEventListener('change', applyDetail);
  detailBox?.addEventListener('change', applyHuman);
  liveryBox?.addEventListener('change', applyMode);
  cutawayBox?.addEventListener('change', applyCutaway);
  unfoldRange?.addEventListener('input', applyDeploy);

  let unfoldTween = null;
  function frame(now) {
    requestAnimationFrame(frame); controls.update(); tickRenderModes(now);
    if (spinBox?.checked && model) model.rotation.y += 0.003;
    if (unfoldTween && unfoldRange) { const k = Math.min(1, (now - unfoldTween) / 2800); unfoldRange.value = k; applyDeploy(); if (k >= 1) unfoldTween = null; }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    show, setMode: (id) => { if (modeSelect) modeSelect.value = id; applyMode(); },
    unfold: () => { if (unfoldRange) { unfoldRange.value = 0; applyDeploy(); unfoldTween = performance.now(); } },
    screenshot: () => renderer.domElement.toDataURL('image/png'),
    orbit: (az, el, k = 1) => { const d = camera.position.distanceTo(controls.target) * k; camera.position.set(controls.target.x + d * Math.cos(el) * Math.sin(az), controls.target.y + d * Math.sin(el), controls.target.z + d * Math.cos(el) * Math.cos(az)); controls.update(); },
    /* named views for the QA screenshots: overview, plan (from +y), side (orthographic-like, far and narrow), close-ups on a part kind, a section */
    setView: (name, opts = {}) => {
      if (!model) return;
      const box = model.userData.box, size = box.getSize(new THREE.Vector3()), c = new THREE.Vector3(0, size.y * 0.5, 0);
      const R = Math.max(size.x, size.y, size.z);
      const place = (dir, dist, target = c, fov = 38) => { camera.fov = fov; camera.updateProjectionMatrix(); controls.target.copy(target); camera.position.copy(target).addScaledVector(dir.normalize(), dist); controls.update(); };
      if (name === 'overview') place(new THREE.Vector3(0.55, 0.33, 0.85), R * 1.9);
      else if (name === 'plan') place(new THREE.Vector3(0.001, 1, 0.001), R * 6, c, 12);
      else if (name === 'side') place(new THREE.Vector3(1, 0.001, 0.001), R * 6, c, 12);
      else if (name === 'front') place(new THREE.Vector3(0.001, 0.001, 1), R * 6, c, 12);
      else if (name === 'aft') place(new THREE.Vector3(0.3, -0.6, 0.75), R * 1.6);
      else if (name === 'close') {
        /* the first frame of the requested kind (or the biggest pressurised body) */
        let target = null, pick = null;
        model.traverse((o) => { if (!pick && o.userData?.kind && (opts.kind ? o.userData.kind === opts.kind : /module|node|hangar|capsule|bus|lander|ring|centrifuge/.test(o.userData.kind))) pick = o; });
        if (pick) { const b = new THREE.Box3().setFromObject(pick); target = b.getCenter(new THREE.Vector3()); const s = b.getSize(new THREE.Vector3()); place(new THREE.Vector3(0.7, 0.35, 0.65), Math.max(s.x, s.y, s.z) * (opts.k ?? 1.6), target); }
        else place(new THREE.Vector3(0.7, 0.35, 0.65), R * 0.6);
      } else if (name === 'section') { model.userData.setCutaway?.(true); place(new THREE.Vector3(0.2, 0.9, 0.4), R * 1.4); }
      else if (name === 'ring') { let pick = null; model.traverse((o) => { if (!pick && o.userData?.kind && /centrifuge|habitat-ring|torpor-ring|spin-bola/.test(o.userData.kind)) pick = o; }); if (pick) { const b = new THREE.Box3().setFromObject(pick); const s = b.getSize(new THREE.Vector3()); place(new THREE.Vector3(0.5, 0.75, 0.45), Math.max(s.x, s.z) * 1.1, b.getCenter(new THREE.Vector3())); } else place(new THREE.Vector3(0.5, 0.75, 0.45), R * 1.4); }
      camera.near = Math.max(0.005, camera.position.distanceTo(controls.target) / 5000); camera.far = camera.position.distanceTo(controls.target) * 400; camera.updateProjectionMatrix();
    },
    render: () => renderer.render(scene, camera),
    get human() { return human; },
    get model() { return model; }
  };
}
