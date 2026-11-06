// map3d.js — a 3D map view for the flight deck, drawn with the Kosmographica engine (../kosmo-models.js).
// It listens to the deck's `deck-sample` events (same data as the 2D views) and never touches deck.js internals.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createModel, textures } from '../kosmo-models.js';
import { PLANETS } from '../planet-data.js';
import { BODIES } from '../worlds.js';

const AU_ORBIT = { mercury: 0.387, venus: 0.723, earth: 1, mars: 1.524, jupiter: 5.203, saturn: 9.537, uranus: 19.19, neptune: 30.07 };
// Drawn radii must match the physics trace (body-centred metres on the sim radius), so the rocky bodies use worlds.js `radius`.
// Earth is the equatorial 6378.137 km here, not the 6371 km mean the page used before: the trail starts on the surface.
const PLANET_R = { mercury: BODIES.mercury.radius, venus: BODIES.venus.radius, earth: BODIES.earth.radius, mars: BODIES.mars.radius, jupiter: 71492e3, saturn: 60268e3, uranus: 25559e3, neptune: 24764e3, moon: BODIES.moon.radius };
const AU = 149597870700, RE_KM = 6378;

try {
  const idx = await fetch('../textures/index.json').then((r) => (r.ok ? r.json() : null));
  const fix = (u) => (typeof u === 'string' && !/^(https?:|\/|\.\.)/.test(u) ? '../' + u : u);
  if (idx) for (const [k, v] of Object.entries(idx)) textures.register(k, typeof v === 'string' ? fix(v) : Object.fromEntries(Object.entries(v).map(([a, b]) => [a, fix(b)])));
} catch (e) { console.warn('map3d textures', e); }

const ready = new Promise((res) => { const t = setInterval(() => { const vp = document.querySelector('.mainViewport'); if (vp && document.querySelector('[data-view="map3d"]')) { clearInterval(t); res(vp); } }, 100); });
const viewport = await ready;

const host = document.createElement('div');
host.style.cssText = 'position:absolute;left:0;right:0;top:44px;bottom:44px;display:none;z-index:0';
viewport.appendChild(host);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);
renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
const hint = document.createElement('div');
hint.textContent = 'DRAG TO ORBIT · SCROLL TO ZOOM · RIGHT-DRAG TO PAN';
hint.style.cssText = 'position:absolute;left:0;right:0;bottom:6px;text-align:center;font:8px ui-monospace,monospace;letter-spacing:1px;color:#8a8a8a;pointer-events:none';
host.appendChild(hint);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.0001, 1e6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.AmbientLight(0xffffff, 0.35));

let world = null, key = '', models = [], extent = 1, trailPts = [], lastT = -1, marker = null, trailLine = null, unit = 1, active = false, last = null, frameRaf = 0;
// sim (x, y, z) -> three (x, z, -y): the transfer plane lies flat, z is "up"
const P = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

function dispose() {
  if (!world) return;
  for (const m of models) m.dispose?.();
  world.traverse((o) => { o.geometry?.dispose?.(); if (o.material && !models.some((m) => m.getObjectById?.(o.id))) o.material.dispose?.(); });
  scene.remove(world); world = null; models = [];
}
function body(name, type, radius, at) {
  const m = createModel(THREE, { name, type, radius_m: PLANET_R[name.toLowerCase()], temperature_K: name === 'Sun' ? 5772 : undefined });
  m.scale.setScalar(radius); m.position.copy(at); world.add(m); models.push(m); return m;
}
function ring(r, color, opacity = 0.5) {
  const pts = []; for (let i = 0; i <= 192; i++) { const a = i / 192 * Math.PI * 2; pts.push(P(Math.cos(a) * r, Math.sin(a) * r)); }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  world.add(l); return l;
}
const nearest = (r) => Object.entries(AU_ORBIT).sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0];
const hudText = (id) => document.getElementById('hud-' + id)?.textContent?.trim().toLowerCase() || '';

function build(d) {
  dispose(); trailPts = []; lastT = -1; trailLine = null;
  world = new THREE.Group(); scene.add(world);
  const { phase, mission } = d; const path = window.MissionAPI?.state?.path || [];
  if (phase === 'cruise' && mission) {
    const solar = mission.kind === 'solar';
    unit = solar ? AU : 1000;            // sample.r is metres
    const r1 = mission.r1, r2 = mission.r2;
    extent = Math.max(r1, r2, ...path.map((p) => Math.hypot(p[0], p[1]))) * 1.15 || 1;
    const dark = 0x6b6b6b;
    if (solar) {
      body('Sun', 'star', extent * 0.05, new THREE.Vector3());
      for (const [name, a] of Object.entries(AU_ORBIT)) if (a <= extent * 1.05) ring(a, 0x3a3a3a, 0.35);
      const [n1] = nearest(r1), [n2] = nearest(r2);
      const start = mission.theta ?? 0, a2 = (mission.theta ?? 0) + Math.PI;
      const pa = path[0] || [r1, 0], pb = path.at(-1) || [-r2, 0];
      body(n1, 'planet', extent * 0.03, P(pa[0], pa[1], pa[2] || 0));
      if (n2 !== n1) body(n2, 'planet', extent * 0.03, P(pb[0], pb[1], pb[2] || 0));
    } else {
      body('Earth', 'planet', RE_KM, new THREE.Vector3());
      if (mission.kind === 'moon') { const pb = path.at(-1) || [-r2, 0]; body('Moon', 'moon', 1737, P(pb[0], pb[1], pb[2] || 0)); }
    }
    ring(r1, dark, 0.7); ring(r2, dark, 0.7);
    if (path.length) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.map((p) => P(p[0], p[1], p[2] || 0))), new THREE.LineBasicMaterial({ color: 0xe9bd7e }));
      world.add(line);
    }
    camera.position.set(0, extent * 1.3, extent * 1.9);
  } else {
    // takeoff / landing: the planet at the origin, the trail grows as the segment plays (sample.r is body-centred metres)
    const name = (phase === 'landing' ? hudText('target') : (hudText('mission').split(/→|->/)[0] || 'earth')).trim() || 'earth';
    const R = PLANET_R[name] || PLANETS[name]?.R || BODIES.earth.radius;
    unit = R; extent = 1.5;
    body(name[0].toUpperCase() + name.slice(1), name === 'moon' ? 'moon' : 'planet', 1, new THREE.Vector3());
    camera.position.set(0, 1.4, 3.2);
  }
  const g = new THREE.ConeGeometry(extent * 0.012, extent * 0.04, 12);
  marker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff })); world.add(marker);
  controls.target.set(0, 0, 0); controls.update();
}

function followSample(d) {
  const s = d.sample; if (!s?.r) { marker.visible = false; return; }
  marker.visible = true;
  const p = P(s.r[0] / unit, s.r[1] / unit, (s.r[2] || 0) / unit);
  marker.position.copy(p);
  if (s.v) marker.lookAt(p.clone().add(P(s.v[0], s.v[1], s.v[2] || 0)));
  marker.rotateX(Math.PI / 2);
  if (d.phase !== 'cruise') {
    if (d.time < lastT) trailPts = trailPts.filter((q) => q.t <= d.time);
    lastT = d.time; trailPts.push({ t: d.time, p });
    if (trailLine) { world.remove(trailLine); trailLine.geometry.dispose(); }
    if (trailPts.length > 1) { trailLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(trailPts.map((q) => q.p)), new THREE.LineBasicMaterial({ color: 0xe9bd7e })); world.add(trailLine); }
  }
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
  if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
function frame(now) {
  if (!active) { frameRaf = 0; return; }
  frameRaf = requestAnimationFrame(frame);
  resize();
  const t = now / 1000;
  for (const m of models) { m.userData.lightDir?.set(-1, 0.2, 0.3).normalize(); m.tick?.(t); }
  controls.update(); renderer.render(scene, camera);
}

function sync() {
  const on = document.querySelector('.viewTabs button.active')?.dataset.view === 'map3d';
  const flat = document.getElementById('hud-scene');
  if (on !== active) {
    active = on; host.style.display = on ? 'block' : 'none'; if (flat) flat.style.visibility = on ? 'hidden' : '';
    if (on && !frameRaf) frameRaf = requestAnimationFrame(frame);
    const t = document.getElementById('hud-viewTitle'); if (on && t) t.textContent = '3D MAP · KOSMOGRAPHICA ENGINE';
  }
  const t2 = document.getElementById('hud-viewTitle'); if (on && t2) t2.textContent = '3D MAP · KOSMOGRAPHICA ENGINE';
  if (on && last) {
    const k = `${window.MissionAPI?.state?.path?.length}|${last.phase}|${last.mission?.kind}|${last.mission?.r1}|${last.mission?.r2}|${last.mission?.theta}|${last.title}`;
    if (k !== key) { key = k; build(last); }
    followSample(last);
  }
}
window.addEventListener('deck-sample', (e) => { last = e.detail; sync(); });
document.addEventListener('click', (e) => { if (e.target.closest?.('[data-view]') || e.target.closest?.('[data-phase]')) setTimeout(sync, 60); });
