// scale.js — the scale carousel: /kosmo/tools/scale
//
// Budget rules this file is built around:
//   · one WebGLRenderer, one scene, one camera for the whole view
//   · at most ONE live object in the scene — a new object is only built after the previous one is released
//   · raw GLBs live in a 3-deep LRU; eviction disposes geometry, materials and textures
//   · procedural models are disposed with the object that owns them
//   · no downloaded planet maps, no shadows, no post-processing, pixel ratio capped at 2
//   · the render loop is 30 fps and stops completely when the stage is off-screen or the tab is hidden
//   · the timeline, ladder and ruler canvases redraw only on change (the ruler follows the 30 fps loop)
//
// Everything numeric about the objects lives in scale-catalog.js (DOM-free, unit-tested).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createModel } from './kosmo-models.js';
import {
  SCALE_ENTRIES, REFERENCE_MARKS, ERA_BANDS, TIMELINE_PRESETS, PRESENT_YEAR,
  sortBySize, filterByTime, aliveAt, yearToSlider, sliderToYear, nearestIndex,
  formatLength, formatYear, formatSpan, niceTicks,
} from './scale-catalog.js';

const ALL = sortBySize(SCALE_ENTRIES);
const SURFACE_GROUPS = new Set(['Dinosaur', 'Rocket', 'Engine']);
const RAW_LIMIT = 3;               // raw GLBs kept for instant back-and-forth
const AXES = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const MANIFEST_BASE = new URL('models/spacex/', document.baseURI);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const $ = (id) => document.getElementById(id);
const stageWrap = $('stageWrap');
const stageCanvas = $('stage');
const loading = $('loading');
const loadingText = $('loadingText');
const hudGroup = $('hudGroup');
const hudIndex = $('hudIndex');
const hudName = $('hudName');
const hudBlurb = $('hudBlurb');
const hudExtent = $('hudExtent');
const hudWhen = $('hudWhen');
const hudSource = $('hudSource');
const counts = $('counts');
const timeToggle = $('timeToggle');
const timePanel = $('timePanel');
const timeInput = $('time');
const timeReadout = $('timeReadout');
const presetsEl = $('presets');
const tlCanvas = $('tl');
const ladderCanvas = $('ladder');
const rulerCanvas = $('ruler');
const rulerNote = $('rulerNote');
const prevBtn = $('prev');
const nextBtn = $('next');

const state = {
  year: PRESENT_YEAR,
  filtered: [],
  index: 0,
  selected: null,
  yaw: 0,
  pitch: 0.06,
  credit: '',
  failed: false,
};

let renderer = null;
let scene = null;
let camera = null;
let ground = null;
let groundGrid = null;
let stars = null;
let dirLight = null;
let current = null;               // { entry, built } — the only object in the scene
let token = 0;
let selectTimer = 0;
let rulerMax = null;
let growT = 1;
let visible = true;
let raf = 0;
let lastFrame = 0;
let lastRender = 0;
let t0 = performance.now();
let lastInteract = 0;
let drag = null;
let wheelAcc = 0;
let tlDrag = false;
let reduced = false;

const rawCache = new Map();       // url -> { root, refs, last, promise }
let manifestPromise = null;
let dinoCreditsPromise = null;

// ── small helpers ───────────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const escAttr = esc;
const clamp01 = (v) => clamp(v, 0, 1);

function setLoading(on, text) {
  if (on) {
    if (text) loadingText.textContent = text;
    loading.hidden = false;
    stageWrap.setAttribute('aria-busy', 'true');
  } else {
    loading.hidden = true;
    stageWrap.removeAttribute('aria-busy');
  }
}

function setupCanvas(canvas) {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.max(1, Math.round(w * dpr));
  const ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// ── renderer and fixed scene furniture ──────────────────────────────────────────────────────────
function initThree() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: stageCanvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('[scale] WebGL unavailable', err);
    renderer = null;
    stageWrap.classList.add('failed');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
  camera.position.set(0, 0.3, 5);

  scene.add(new THREE.HemisphereLight(0xb9c7d8, 0x181c21, 1.1));
  dirLight = new THREE.DirectionalLight(0xfff2df, 2.6);
  dirLight.position.set(4, 6, 7);
  scene.add(dirLight);
  const rim = new THREE.DirectionalLight(0x7f9fc9, 1.1);
  rim.position.set(-6, 2, -5);
  scene.add(rim);

  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 0.94, metalness: 0.0, transparent: true, opacity: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  groundGrid = new THREE.GridHelper(2, 24, 0x2b323b, 0x1a1f25);
  groundGrid.material.transparent = true;
  groundGrid.material.opacity = 0.55;
  groundGrid.material.depthWrite = false;
  scene.add(groundGrid);
  ground.visible = false;
  groundGrid.visible = false;

  stars = makeStars();
  scene.add(stars);

  // A tiny studio environment gives the GLB metal something to reflect; generated once, then freed.
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    pmrem.dispose();
    room.traverse((o) => {
      o.geometry?.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material?.dispose();
    });
  } catch (err) {
    console.warn('[scale] environment skipped', err);
  }

  resize();
  return true;
}

function makeStars() {
  const n = 1100;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 16 + Math.random() * 20;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xc9d4e4, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  return points;
}

function fitCamera(fitRadius) {
  if (!camera) return;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(0.35, camera.aspect));
  const dist = (Math.max(fitRadius, 1e-9) * 1.22) / Math.sin(Math.max(0.05, Math.min(vFov, hFov) / 2));
  const elev = clamp(0.18 + state.pitch, -0.55, 0.95);
  camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
  camera.near = Math.max(dist / 500, fitRadius / 2000, 1e-6);
  camera.far = dist * 8 + fitRadius * 16 + 40;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function resize() {
  const w = stageWrap.clientWidth || 1;
  const h = stageWrap.clientHeight || 1;
  if (renderer) renderer.setSize(w, h, false);
  if (camera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (current) fitCamera(current.built.fitRadius);
  }
  drawTimeline();
  drawLadder();
}

// ── GLB pipeline: fetch once, clone, normalise, release ────────────────────────────────────────
function loadManifest() {
  manifestPromise ??= fetch(new URL('manifest.json', MANIFEST_BASE))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return manifestPromise;
}

function dinoCredits() {
  dinoCreditsPromise ??= fetch(new URL('models/dinosaurs/CREDITS.json', document.baseURI))
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return dinoCreditsPromise;
}

async function resolveModel(entry) {
  const m = entry.model;
  if (m.kind === 'vehicle' || m.kind === 'engine') {
    const man = await loadManifest();
    const rec = (m.kind === 'vehicle' ? man?.vehicles : man?.engines)?.[m.id];
    if (!rec?.file) throw new Error(`manifest has no ${m.kind} ${m.id}`);
    return { url: new URL(rec.file, MANIFEST_BASE).href, rec, upright: true, lengthM: m.lengthM || rec.lengthM };
  }
  return { url: new URL(m.url, document.baseURI).href, rec: null, upright: m.upright !== false, lengthM: m.lengthM };
}

function getRaw(url, onProgress) {
  let rec = rawCache.get(url);
  if (!rec) {
    rec = { root: null, refs: 0, last: performance.now(), promise: null };
    rawCache.set(url, rec);
    rec.promise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        url,
        (gltf) => { rec.root = gltf.scene; rec.last = performance.now(); resolve(gltf.scene); },
        (ev) => { if (ev.total > 0 && onProgress) onProgress(ev.loaded / ev.total); },
        (err) => { rawCache.delete(url); reject(err); },
      );
    });
  }
  rec.last = performance.now();
  return rec.promise;
}

function releaseRaw(url) {
  const rec = rawCache.get(url);
  if (!rec) return;
  rec.refs = Math.max(0, rec.refs - 1);
  rec.last = performance.now();
  trimRaw();
}

function trimRaw() {
  if (rawCache.size <= RAW_LIMIT) return;
  const idle = [...rawCache.entries()]
    .filter(([, rec]) => rec.root && rec.refs === 0)
    .sort((a, b) => a[1].last - b[1].last);
  while (rawCache.size > RAW_LIMIT && idle.length) {
    const [url, rec] = idle.shift();
    disposeScene(rec.root);
    rawCache.delete(url);
  }
}

function disposeScene(root) {
  const mats = new Set();
  const textures = new Set();
  root.traverse((o) => {
    o.geometry?.dispose();
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || mats.has(m)) continue;
      mats.add(m);
      for (const key of Object.keys(m)) {
        const v = m[key];
        if (v && v.isTexture) textures.add(v);
      }
      for (const key of Object.keys(m.uniforms || {})) {
        const v = m.uniforms[key]?.value;
        if (v && v.isTexture) textures.add(v);
      }
      m.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}

function normalize(root, { rec, upright, lengthM }) {
  const wrap = new THREE.Group();
  wrap.add(root);
  if (upright) {
    const axis = AXES[(rec?.axis || 'y').toLowerCase()] || AXES.y;
    const dir = axis.clone().multiplyScalar(rec?.noseSign ?? 1);
    root.quaternion.setFromUnitVectors(dir, new THREE.Vector3(0, 1, 0));
  } else {
    // Some scanned models are Z-up; if the tallest axis is clearly Y, tip them onto Y-up.
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    const s = b.getSize(new THREE.Vector3());
    if (s.y > s.x * 1.15 && s.y > s.z * 1.15) { root.rotation.x = -Math.PI / 2; root.updateMatrixWorld(true); }
  }
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  let size = box.getSize(new THREE.Vector3());
  const native = upright ? size.y : Math.max(size.x, size.y, size.z);
  if (!(native > 1e-7) || !(lengthM > 0)) throw new Error('model has no measurable extent');
  root.scale.multiplyScalar(lengthM / native);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);

  const b2 = new THREE.Box3().setFromObject(wrap);
  const c2 = b2.getCenter(new THREE.Vector3());
  wrap.position.sub(c2);
  const s2 = b2.getSize(new THREE.Vector3());
  return { wrap, fitRadius: Math.max(s2.x, s2.y, s2.z) / 2 || 1, bottom: -s2.y / 2 };
}

async function loadModel(entry, onProgress) {
  const ref = await resolveModel(entry);
  const rawRoot = await getRaw(ref.url, onProgress);
  const rec = rawCache.get(ref.url);
  if (rec) rec.refs += 1;
  let normalized;
  try {
    normalized = normalize(rawRoot.clone(true), ref);
  } catch (err) {
    if (rec) rec.refs = Math.max(0, rec.refs - 1);
    throw err;
  }
  trimRaw();
  return {
    group: normalized.wrap,
    fitRadius: normalized.fitRadius,
    bottom: normalized.bottom,
    rawUrl: ref.url,
    shared: true,
    tick: null,
    dispose: null,
  };
}

function buildWeb(entry) {
  const group = new THREE.Group();
  const disposables = [];
  const n = 520;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = 0.84 + Math.random() * 0.16;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(th) * s * r;
    pos[i * 3 + 1] = u * r * 0.9;
    pos[i * 3 + 2] = Math.sin(th) * s * r;
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const cloudMat = new THREE.PointsMaterial({ color: 0xd6e1f2, size: 0.011, transparent: true, opacity: 0.75, depthWrite: false });
  const cloud = new THREE.Points(cloudGeo, cloudMat);
  group.add(cloud);
  disposables.push(cloudGeo, cloudMat);

  const shellGeo = new THREE.IcosahedronGeometry(1, 3);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0x8ea6c8, wireframe: true, transparent: true, opacity: 0.075, depthWrite: false });
  group.add(new THREE.Mesh(shellGeo, shellMat));
  disposables.push(shellGeo, shellMat);

  const coreGeo = new THREE.SphereGeometry(0.985, 32, 20);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x0d1a28, transparent: true, opacity: 0.34, side: THREE.BackSide, depthWrite: false });
  group.add(new THREE.Mesh(coreGeo, coreMat));
  disposables.push(coreGeo, coreMat);

  return {
    group, fitRadius: 1.2, bottom: -1.2, shared: false,
    tick: (t) => { cloud.rotation.y = t * 0.02; },
    dispose: () => { for (const d of disposables) d.dispose(); },
  };
}

function buildPlaceholder() {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.8, 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x6f7f8f, wireframe: true, transparent: true, opacity: 0.5 });
  group.add(new THREE.Mesh(geo, mat));
  return {
    group, fitRadius: 1.1, bottom: -1, shared: false, failed: true,
    tick: (t) => { group.rotation.x = Math.sin(t * 0.3) * 0.15; },
    dispose: () => { geo.dispose(); mat.dispose(); },
  };
}

async function buildEntry(entry, onProgress) {
  const m = entry.model;
  if (m.kind === 'proc') {
    const model = createModel(THREE, { ...m.spec });
    const group = new THREE.Group();
    group.add(model);
    return {
      group,
      fitRadius: model.viewRadius || 1.15,
      bottom: -(model.viewRadius || 1.15),
      shared: false,
      tick: (t) => model.tick?.(t),
      dispose: () => model.dispose?.(),
    };
  }
  if (m.kind === 'web') return buildWeb(entry);
  if (m.kind === 'glb' || m.kind === 'vehicle' || m.kind === 'engine') return loadModel(entry, onProgress);
  throw new Error(`unknown model kind ${m.kind}`);
}

function releaseBuilt(built) {
  if (!built) return;
  built.group.removeFromParent();
  if (built.shared) {
    if (built.rawUrl) releaseRaw(built.rawUrl);
  } else {
    if (built.dispose) built.dispose();
  }
}

// ── credits ─────────────────────────────────────────────────────────────────────────────────────
function creditLine(title, author, authorUrl, license, source) {
  const who = author ? (authorUrl ? `<a href="${escAttr(authorUrl)}" target="_blank" rel="noopener">${esc(author)}</a>` : esc(author)) : '';
  const bits = [`3D model${title ? ` “${esc(title)}”` : ''}${who ? ` by ${who}` : ''}`];
  if (license) bits.push(esc(license));
  if (source) bits.push(`<a href="${escAttr(source)}" target="_blank" rel="noopener">model page</a>`);
  return bits.join(', ');
}

async function creditFor(entry) {
  const m = entry.model;
  if (m.kind === 'vehicle' || m.kind === 'engine') {
    const man = await loadManifest();
    const rec = (m.kind === 'vehicle' ? man?.vehicles : man?.engines)?.[m.id];
    if (!rec) return '';
    return creditLine(rec.title || entry.name, rec.author, rec.authorUrl, rec.license, rec.source);
  }
  if (m.kind === 'glb' && m.uid) {
    const credits = await dinoCredits();
    const c = credits[m.uid];
    if (!c) return '';
    return creditLine(c.name || entry.name, c.author, c.authorUrl, c.license, c.source);
  }
  return '';
}

function renderSource(entry) {
  if (!entry || state.selected?.id !== entry.id) return;
  const parts = [];
  if (entry.source) parts.push(`<a href="${escAttr(entry.source)}" target="_blank" rel="noopener">${esc(entry.sourceLabel || 'source')}</a>`);
  if (state.credit) parts.push(state.credit);
  if (state.failed) parts.push('3D model unavailable — placeholder shown');
  hudSource.innerHTML = parts.join(' · ');
}

// ── selection and HUD ──────────────────────────────────────────────────────────────────────────
function updateHud(entry, i) {
  hudGroup.textContent = entry.group;
  hudIndex.textContent = `${i + 1} / ${state.filtered.length}`;
  hudName.textContent = entry.name;
  hudBlurb.textContent = entry.blurb;
  hudExtent.textContent = `${formatLength(entry.extent)} ${entry.extentLabel}`;
  hudWhen.textContent = formatSpan(entry.from, entry.to);
  rulerNote.textContent = 'drawn to fit · the bar gives the true extent';
  hudSource.textContent = '';
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i >= state.filtered.length - 1;
}

function applySelection(entry, built) {
  if (current) releaseBuilt(current.built);
  current = { entry, built };
  state.failed = !!built.failed;

  if (!renderer || !scene) return;
  built.group.rotation.y = state.yaw;
  built.group.scale.setScalar(0.94);
  growT = 0;
  scene.add(built.group);

  const surface = SURFACE_GROUPS.has(entry.group);
  ground.visible = surface;
  groundGrid.visible = surface;
  if (surface) {
    const r = Math.max(built.fitRadius, 1e-6);
    const y = (built.bottom ?? -r) - r * 0.015;
    ground.position.set(0, y, 0);
    ground.scale.set(r * 4.4, r * 4.4, 1);
    groundGrid.position.set(0, y + r * 0.004, 0);
    groundGrid.scale.set(r * 2.2, 1, r * 2.2);
  }
  stars.visible = entry.extent > 1e6;

  state.yaw = 0;
  fitCamera(built.fitRadius);
  drawRuler(performance.now() / 1000);
}

async function select(index, { pushHash = true } = {}) {
  if (!state.filtered.length) return;
  const i = clamp(Math.round(index), 0, state.filtered.length - 1);
  const entry = state.filtered[i];
  const same = state.selected?.id === entry.id && current?.entry.id === entry.id;

  state.index = i;
  state.selected = entry;
  updateHud(entry, i);
  if (same) {
    // The filter changed but this object is still the one on stage: refresh the counters, keep the object.
    renderSource(entry);
    drawLadder();
    return;
  }

  state.credit = '';
  state.failed = false;
  const my = ++token;

  renderSource(entry);
  creditFor(entry).then((html) => {
    if (my !== token) return;
    state.credit = html;
    renderSource(entry);
  });
  drawLadder();
  if (pushHash) setHash(entry.id);

  const slow = entry.model.kind !== 'proc' && entry.model.kind !== 'web';
  if (slow) setLoading(true, 'Loading the 3D model');
  else if (!renderer) setLoading(true, 'Preparing the scale');

  let built;
  try {
    built = await buildEntry(entry, (p) => {
      if (my === token) loadingText.textContent = `Loading the 3D model ${Math.round(clamp01(p) * 100)}%`;
    });
  } catch (err) {
    console.warn('[scale] could not build', entry.id, err);
    if (my !== token) return;
    built = buildPlaceholder();
  }

  if (my !== token) { releaseBuilt(built); return; }
  applySelection(entry, built);
  if (built.failed) {
    state.failed = true;
    renderSource(entry);
  }
  setLoading(false);
  if (!renderer) {
    stageWrap.classList.add('failed');
    loadingText.textContent = '3D unavailable in this browser';
  }
}

function step(delta) {
  if (!state.filtered.length) return;
  const next = clamp(state.index + delta, 0, state.filtered.length - 1);
  if (next !== state.index) select(next, { pushHash: true });
}

function setHash(id) {
  try {
    history.replaceState(null, '', `#${id}`);
  } catch { /* sandboxed iframes can refuse history writes */ }
  if (window.parent !== window) {
    try { window.parent.postMessage({ kosmo: 'hash', h: `#${id}` }, window.location.origin); } catch { /* ignore */ }
  }
}

// ── timeline filter ────────────────────────────────────────────────────────────────────────────
function buildPresets() {
  for (const p of TIMELINE_PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = p.label;
    b.dataset.year = String(p.year);
    b.addEventListener('click', () => setTime(p.year, true));
    presetsEl.appendChild(b);
  }
}

function updateCounts() {
  counts.textContent = `${state.filtered.length} of ${ALL.length} objects`;
}

function applyFilter() {
  const prevEntry = state.selected;
  state.filtered = filterByTime(ALL, state.year);
  updateCounts();
  if (!state.filtered.length) {
    state.index = 0;
  } else {
    const idx = prevEntry ? nearestIndex(state.filtered, prevEntry) : 0;
    state.index = clamp(idx, 0, state.filtered.length - 1);
  }
  if (state.selected && state.filtered.some((e) => e.id === state.selected.id)) {
    state.index = state.filtered.findIndex((e) => e.id === state.selected.id);
  }
  prevBtn.disabled = state.index <= 0;
  nextBtn.disabled = state.index >= state.filtered.length - 1;
  if (!state.filtered.length) {
    // Nothing exists at this time: clear the stage rather than leave the previous object behind.
    token += 1;
    clearTimeout(selectTimer);
    if (current) { releaseBuilt(current.built); current = null; }
    state.selected = null;
    hudGroup.textContent = '';
    hudIndex.textContent = '';
    hudName.textContent = 'Nothing here yet';
    hudBlurb.textContent = 'No indexed object existed at this point on the timeline.';
    hudExtent.textContent = '';
    hudWhen.textContent = formatYear(state.year);
    hudSource.textContent = '';
    if (renderer) stars.visible = true;
    setLoading(false);
  }
  drawTimeline();
  drawLadder();
  clearTimeout(selectTimer);
  selectTimer = setTimeout(() => {
    if (state.filtered.length) select(state.index, { pushHash: false });
  }, 190);
}

function setTime(year, isPreset) {
  state.year = year;
  timeInput.value = String(Math.round(yearToSlider(year) * 1000));
  timeReadout.textContent = formatYear(year);
  presetsEl.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('on', isPreset && Number(b.dataset.year) === year);
  });
  applyFilter();
}

function revealEntry(entry) {
  if (!state.filtered.some((e) => e.id === entry.id)) {
    const mid = entry.from != null && entry.to != null ? (entry.from + entry.to) / 2 : (entry.to ?? entry.from ?? PRESENT_YEAR);
    setTime(mid, false);
    clearTimeout(selectTimer);
  }
  const i = state.filtered.findIndex((e) => e.id === entry.id);
  if (i >= 0) select(i, { pushHash: false });
}

// ── 2D: timeline ──────────────────────────────────────────────────────────────────────────────
function drawTimeline() {
  const { ctx, w, h } = setupCanvas(tlCanvas);
  if (w < 8 || h < 8) return;
  const pad = 2;
  const inner = w - pad * 2;
  const xOf = (t) => pad + clamp01(t) * inner;
  const baseY = h - 12;
  const maxBarH = Math.max(10, h - 44);

  // era bands
  ERA_BANDS.forEach((band, i) => {
    const x0 = xOf(yearToSlider(band.from));
    const x1 = xOf(yearToSlider(band.to));
    const left = Math.min(x0, x1);
    const width = Math.abs(x1 - x0);
    if (width < 0.6) return;
    ctx.fillStyle = band.name === 'Big Bang' ? 'rgba(196,163,115,0.12)' : i % 2 ? 'rgba(255,255,255,0.026)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(left, 13, width, h - 25);
    if (width > 62) {
      ctx.fillStyle = 'rgba(232,232,230,0.34)';
      ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fitText(ctx, band.name, width - 8), left + width / 2, 22);
    }
  });

  // histogram of the whole index, so the filter's effect is visible
  const n = Math.max(48, Math.min(200, Math.round(w / 4)));
  const barW = inner / n;
  const countsByBin = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const year = sliderToYear((i + 0.5) / n);
    for (const e of ALL) if (aliveAt(e, year)) countsByBin[i] += 1;
  }
  const peak = Math.max(1, ...countsByBin);
  const selected = state.selected;
  for (let i = 0; i < n; i++) {
    const x = pad + i * barW;
    const bh = (countsByBin[i] / peak) * maxBarH;
    const year = sliderToYear((i + 0.5) / n);
    const inSpan = selected ? aliveAt(selected, year) : false;
    ctx.fillStyle = inSpan ? 'rgba(196,163,115,0.5)' : 'rgba(169,192,180,0.2)';
    ctx.fillRect(x + 0.3, baseY - bh, Math.max(0.8, barW - 0.9), bh);
  }

  // baseline
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, baseY + 0.5);
  ctx.lineTo(w - pad, baseY + 0.5);
  ctx.stroke();

  // the selected object's existence window
  if (selected) {
    const from = selected.from ?? -13.8e9;
    const to = selected.to ?? PRESENT_YEAR;
    const x0 = xOf(yearToSlider(from));
    const x1 = xOf(yearToSlider(to));
    ctx.strokeStyle = 'rgba(196,163,115,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.min(x0, x1), 8.5);
    ctx.lineTo(Math.max(x0, x1), 8.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(196,163,115,0.95)';
    ctx.fillRect(Math.min(x0, x1) - 0.75, 6.5, 1.5, 4);
    ctx.fillRect(Math.max(x0, x1) - 0.75, 6.5, 1.5, 4);
  }

  // cursor
  const cx = xOf(yearToSlider(state.year));
  ctx.strokeStyle = 'rgba(232,232,230,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, 4);
  ctx.lineTo(cx + 0.5, h - 4);
  ctx.stroke();
  ctx.fillStyle = '#e8e8e6';
  ctx.beginPath();
  ctx.arc(cx, 4, 2, 0, Math.PI * 2);
  ctx.fill();
}

// ── 2D: global size ladder ────────────────────────────────────────────────────────────────────
function ladderRange() {
  const list = state.filtered;
  if (!list.length) return { maxLog: 1, minLog: 0 };
  return { maxLog: Math.log10(list[0].extent) + 0.3, minLog: Math.log10(list[list.length - 1].extent) - 0.3 };
}

function drawLadder() {
  const { ctx, w, h } = setupCanvas(ladderCanvas);
  if (w < 8 || h < 8) return;
  const pad = 8;
  const list = state.filtered;
  ctx.textBaseline = 'alphabetic';

  if (!list.length) {
    ctx.fillStyle = 'rgba(141,142,145,0.9)';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No objects in this index existed at that time', w / 2, h / 2 + 4);
    return;
  }

  const { maxLog, minLog } = ladderRange();
  const span = Math.max(0.5, maxLog - minLog);
  const xOf = (m) => pad + clamp01((maxLog - Math.log10(m)) / span) * (w - pad * 2);
  const pxPerDecade = (w - pad * 2) / span;
  const labelEvery = Math.max(1, Math.ceil(42 / pxPerDecade));
  const y = h - 19;

  for (let d = Math.ceil(minLog); d <= Math.floor(maxLog); d++) {
    const x = xOf(Math.pow(10, d));
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 16);
    ctx.lineTo(x + 0.5, y + 5);
    ctx.stroke();
    if ((Math.floor(maxLog) - d) % labelEvery === 0) {
      ctx.fillStyle = 'rgba(141,142,145,0.85)';
      ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatLength(Math.pow(10, d)), x, h - 3);
    }
  }

  // reference marks (a person, Everest, Earth) where they are useful
  for (const mark of REFERENCE_MARKS) {
    if (mark.extent >= Math.pow(10, maxLog) || mark.extent <= Math.pow(10, minLog)) continue;
    const x = xOf(mark.extent);
    ctx.strokeStyle = 'rgba(196,163,115,0.28)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 10);
    ctx.lineTo(x + 0.5, y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // baseline
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(pad, y + 0.5);
  ctx.lineTo(w - pad, y + 0.5);
  ctx.stroke();

  const curId = state.selected?.id;
  for (const e of list) {
    const x = xOf(e.extent);
    const active = e.id === curId;
    ctx.fillStyle = active ? '#e8e8e6' : (e.tint || '#9fb8ab');
    ctx.globalAlpha = active ? 1 : 0.5;
    ctx.beginPath();
    ctx.arc(x, y, active ? 3.2 : 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (active) {
      ctx.strokeStyle = 'rgba(196,163,115,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(232,232,230,0.95)';
      ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = clamp(x, 60, w - 60) === x ? 'center' : x < 60 ? 'left' : 'right';
      const label = fitText(ctx, e.name, 160);
      const lx = x < 60 ? x - 4 : x > w - 60 ? x + 4 : x;
      ctx.fillText(label, lx, 12);
    }
  }

  // direction hints
  ctx.fillStyle = 'rgba(103,104,107,0.8)';
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LARGEST', pad, 9);
  ctx.textAlign = 'right';
  ctx.fillText('SMALLEST', w - pad, 9);
}

// ── 2D: the fluctuating focus ruler ───────────────────────────────────────────────────────────
function drawRuler(now) {
  const { ctx, w, h } = setupCanvas(rulerCanvas);
  if (w < 20 || h < 20) return;
  const entry = state.selected;
  if (!entry) return;

  const target = entry.extent * 1.35;
  if (rulerMax == null) rulerMax = target;
  else rulerMax += (target - rulerMax) * 0.14;
  if (Number.isNaN(rulerMax) || rulerMax <= 0) rulerMax = target;

  const wobble = reduced ? 0 : Math.sin(now * 1.35) * 0.0045 + Math.sin(now * 0.57 + 1.2) * 0.0035;
  const maxShown = rulerMax * (1 + wobble);
  const pad = 12;
  const xOf = (m) => pad + clamp01(m / maxShown) * (w - pad * 2);
  const baseY = h - 22;
  const { ticks, step } = niceTicks(rulerMax, Math.max(4, Math.min(7, Math.floor(w / 110))));

  // minor ticks
  const minor = step / 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let v = minor; v < maxShown; v += minor) {
    if (Math.abs(v / step - Math.round(v / step)) < 1e-6) continue;
    const x = xOf(v);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, baseY - 3);
    ctx.lineTo(x + 0.5, baseY);
    ctx.stroke();
  }

  // major ticks and labels
  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const v of ticks) {
    const x = xOf(v);
    ctx.strokeStyle = 'rgba(232,232,230,0.32)';
    ctx.beginPath();
    ctx.moveTo(x + 0.5, baseY - 7);
    ctx.lineTo(x + 0.5, baseY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(141,142,145,0.95)';
    ctx.fillText(v === 0 ? '0' : formatLength(v), clamp(x, 18, w - 18), baseY + 13);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(pad, baseY + 0.5);
  ctx.lineTo(w - pad, baseY + 0.5);
  ctx.stroke();

  // the measured extent: a bar that breathes, with a live readout above it
  const shown = entry.extent * (1 + wobble * 2.2);
  const x0 = xOf(0);
  const x1 = Math.max(x0 + 1.5, xOf(shown));
  const barY = Math.round(h * 0.31);
  ctx.fillStyle = 'rgba(169,192,180,0.16)';
  ctx.fillRect(x0, barY, x1 - x0, 9);
  ctx.strokeStyle = 'rgba(169,192,180,0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 + 0.5, barY - 5);
  ctx.lineTo(x0 + 0.5, barY + 14);
  ctx.moveTo(x1 - 0.5, barY - 5);
  ctx.lineTo(x1 - 0.5, barY + 14);
  ctx.stroke();

  const label = formatLength(entry.extent);
  const textX = clamp((x0 + x1) / 2, 46, w - 46);
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#e8e8e6';
  ctx.textAlign = 'center';
  ctx.fillText(label, textX, barY - 9);
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(103,104,107,0.95)';
  ctx.fillText(entry.extentLabel, textX, barY + 30);

  // reference mark, if it falls comfortably inside the ruler
  for (const mark of REFERENCE_MARKS) {
    const ratio = mark.extent / maxShown;
    if (ratio < 0.03 || ratio > 0.96) continue;
    const x = xOf(mark.extent);
    ctx.strokeStyle = 'rgba(196,163,115,0.5)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x + 0.5, barY - 2);
    ctx.lineTo(x + 0.5, baseY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(196,163,115,0.9)';
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mark.label, clamp(x, 22, w - 22), barY + 27);
  }
}

// ── render loop ───────────────────────────────────────────────────────────────────────────────
function startLoop() {
  if (raf) return;
  lastFrame = performance.now();
  raf = requestAnimationFrame(tick);
}

function stopLoop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function updateLoop() {
  if (visible && !document.hidden) startLoop();
  else stopLoop();
}

function tick(now) {
  raf = 0;
  if (!visible || document.hidden || !renderer) return;
  raf = requestAnimationFrame(tick);
  if (now - lastRender < 33) return;
  const dtRaw = (now - lastFrame) / 1000;
  const dt = clamp(Number.isFinite(dtRaw) ? dtRaw : 0.033, 0.001, 0.06);
  lastFrame = now;
  lastRender = now;
  const t = (now - t0) / 1000;

  if (!reduced && now - lastInteract > 3200 && !drag) state.yaw += dt * 0.13;
  if (growT < 1) {
    growT = Math.min(1, growT + dt * 3.4);
    if (current) current.built.group.scale.setScalar(0.94 + 0.06 * (1 - Math.pow(1 - growT, 3)));
  }
  if (current) {
    current.built.group.rotation.y = state.yaw;
    current.built.tick?.(t);
  }
  drawRuler(t);
  renderer.render(scene, camera);
}

// ── interaction ───────────────────────────────────────────────────────────────────────────────
function bindStage() {
  const mark = () => { lastInteract = performance.now(); };

  stageCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch, moved: 0, t: performance.now() };
    stageCanvas.setPointerCapture?.(e.pointerId);
    stageWrap.classList.add('drag');
    mark();
  });
  stageCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    state.yaw = drag.yaw + dx * 0.007;
    state.pitch = clamp(drag.pitch - dy * 0.004, -0.5, 0.75);
    if (current) fitCamera(current.built.fitRadius);
    mark();
  });
  const endDrag = (e) => {
    if (!drag) return;
    stageWrap.classList.remove('drag');
    const dx = e.clientX - drag.x;
    const elapsed = performance.now() - drag.t;
    if (drag.moved > 34 && elapsed < 550) step(dx > 0 ? -1 : 1);
    drag = null;
    mark();
  };
  stageCanvas.addEventListener('pointerup', endDrag);
  stageCanvas.addEventListener('pointercancel', () => { drag = null; stageWrap.classList.remove('drag'); });
  stageCanvas.addEventListener('dblclick', () => {
    state.yaw = 0;
    state.pitch = 0.06;
    if (current) fitCamera(current.built.fitRadius);
  });
  stageCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    mark();
    if (Math.abs(wheelAcc) > 55) {
      step(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0;
    }
  }, { passive: false });

  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  window.addEventListener('keydown', (e) => {
    const tag = e.target instanceof Element ? e.target.tagName : '';
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(state.filtered.length - 1); }
  });
}

function bindTimeline() {
  timeInput.addEventListener('input', () => setTime(sliderToYear(Number(timeInput.value) / 1000), false));

  const seek = (e) => {
    const r = tlCanvas.getBoundingClientRect();
    if (!r.width) return;
    const t = clamp01((e.clientX - r.left - 2) / (r.width - 4));
    setTime(sliderToYear(t), false);
  };
  tlCanvas.addEventListener('pointerdown', (e) => {
    tlDrag = true;
    tlCanvas.setPointerCapture?.(e.pointerId);
    seek(e);
  });
  tlCanvas.addEventListener('pointermove', (e) => { if (tlDrag) seek(e); });
  const stop = () => { tlDrag = false; };
  tlCanvas.addEventListener('pointerup', stop);
  tlCanvas.addEventListener('pointercancel', stop);

  timeToggle.addEventListener('click', () => {
    const open = timePanel.hidden;
    timePanel.hidden = !open;
    timeToggle.setAttribute('aria-expanded', String(open));
    requestAnimationFrame(resize);
  });
}

function bindLadder() {
  ladderCanvas.addEventListener('pointerdown', (e) => {
    const list = state.filtered;
    if (!list.length) return;
    const r = ladderCanvas.getBoundingClientRect();
    if (!r.width) return;
    const pad = 8;
    const { maxLog, minLog } = ladderRange();
    const frac = clamp01((e.clientX - r.left - pad) / (r.width - pad * 2));
    const log = maxLog - frac * (maxLog - minLog);
    const fake = { extent: Math.pow(10, log) };
    select(nearestIndex(list, fake), { pushHash: true });
  });
}

// ── boot ──────────────────────────────────────────────────────────────────────────────────────
function readHash() {
  try { return decodeURIComponent(window.location.hash.replace(/^#/, '')); } catch { return ''; }
}

function boot() {
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => { reduced = e.matches; });

  buildPresets();
  bindStage();
  bindTimeline();
  bindLadder();
  initThree();

  const small = window.matchMedia?.('(max-width: 760px), (max-height: 620px)').matches;
  if (small) {
    timePanel.hidden = true;
    timeToggle.setAttribute('aria-expanded', 'false');
  }

  timeInput.value = '1000';
  timeReadout.textContent = formatYear(PRESENT_YEAR);
  state.filtered = filterByTime(ALL, state.year);
  updateCounts();
  drawTimeline();
  drawLadder();

  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    updateLoop();
  }, { threshold: 0 });
  io.observe(stageWrap);
  document.addEventListener('visibilitychange', updateLoop);
  new ResizeObserver(resize).observe($('app'));
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => {
    const entry = ALL.find((e) => e.id === readHash());
    if (entry) revealEntry(entry);
  });

  const hashEntry = ALL.find((e) => e.id === readHash());
  if (hashEntry) revealEntry(hashEntry);
  else select(0, { pushHash: false });

  updateLoop();
  if (!renderer) {
    setLoading(true, '3D unavailable in this browser');
    setTimeout(() => setLoading(false), 2600);
  }
}

boot();
