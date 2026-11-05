/* vehicle-glb.js -- optional real 3D models for the flight labs.
 *
 * The labs always have a procedural model of every vehicle. If models/spacex/<file>.glb exists (see models/spacex/README.md and manifest.json), this module loads it,
 * scales it to real size, stands it on +y with its base at the origin, removes the parts the lab animates itself (the landing legs, optionally the grid fins) so they
 * do not double up, and hands back a clone. When the file is missing or fails to load every function here quietly returns null and the lab keeps its procedural model.
 *
 *   await preloadVehicleModel('falcon9-block5')                 // once, at start-up (never throws)
 *   const m = vehicleModel('falcon9-block5', { mode: 'firstStage', hide: ['legs'] })   // synchronous, null if not loaded
 *   m.userData.baseY / .length / .diameter / .attribution
 *   attributionHTML(['falcon9-block5'])  -> credit line, or '' when nothing is shown
 *
 * Engines (manifest "engines" section, files under models/spacex/engines/) have their own loader:
 *   await preloadEngineModel('raptor')                           // never throws; false when the file is missing
 *   const e = engineModel('raptor', { exitDiameter: 1.3 })       // synchronous clone or null. Nozzle exit points down -y, origin = top of the engine (throat / gimbal point),
 *                                                                //   centred on x/z of the bell axis, scaled so the bell EXIT is exitDiameter metres wide.
 *   e.userData.height (m, throat to exit), .exitY (= -height), .exitDiameter, .attribution
 *   engineGlbFor('merlin-1d') -> 'merlin-light'                  // lab engine id -> manifest engine id
 *   attributionHTML(['raptor']) also accepts engine ids.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = new URL('./models/spacex/', import.meta.url);
let manifestP = null; const loaded = new Map();   // id -> { scene, entry } | null

export function loadManifest() {
  return manifestP ??= fetch(new URL('manifest.json', BASE), { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null).then(m => m || { vehicles: {}, labs: {} });
}
/** Which manifest vehicle a lab vehicle id (a Landing Lab key, or a Shipyard stage role) maps to. */
export async function glbIdFor(lab, key) { const m = await loadManifest(); return m.labs?.[lab]?.[key] ?? null; }

/** Load (once) and cache the model; resolves to true when it is usable. Never rejects. */
export async function preloadVehicleModel(id) {
  if (loaded.has(id)) return !!loaded.get(id);
  const man = await loadManifest(), entry = man.vehicles?.[id]; let ok = null;
  if (entry) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const f of [entry.file, ...(entry.fallbackFiles || [])].filter(Boolean)) {
      try { const gltf = await loader.loadAsync(new URL(f, BASE).href); fixMaterials(gltf.scene, entry); ok = { scene: gltf.scene, entry, file: f }; break; } catch { /* missing or corrupt: try the next file, then fall back to the procedural model */ }
    }
  }
  loaded.set(id, ok); return !!ok;
}
export const hasVehicleModel = id => !!loaded.get(id);
/** Which file actually loaded for a vehicle (the .web.glb, or an original from fallbackFiles), or null. */
export const vehicleFile = id => loaded.get(id)?.file ?? null;

/** Loader-side material repair (the original files are never edited). Sketchfab exports often carry metalness 1 with no environment map in the labs, which renders pure black:
 *  cap the metalness factor (entry.maxMetalness; default: leave as is), optionally set envMapIntensity, override flat metalness / roughness, scale untextured base colours (entry.colorScale) or lift near-black ones (entry.minBrightness).
 *  Meshes without UVs/normals are handled in vehicleModel. */
function fixMaterials(scene, entry) {
  const cap = entry.maxMetalness ?? 1, seen = new Set();
  scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m || seen.has(m)) continue; seen.add(m);
    if ('metalness' in m) { if (m.metalness > cap) m.metalness = cap; if (entry.envMapIntensity != null && m.envMapIntensity != null) m.envMapIntensity = entry.envMapIntensity; }
    if (entry.metalness != null && 'metalness' in m && !m.metalnessMap) m.metalness = entry.metalness;   // optional hard overrides for flat untextured materials
    if (entry.roughness != null && 'roughness' in m && !m.roughnessMap) m.roughness = entry.roughness;
    if (m.color && entry.colorScale && !m.map) m.color.multiplyScalar(entry.colorScale);   // a flat white 'stainless steel' material blows out under the lights
    if (m.color && entry.minBrightness && !m.map) { const c = m.color, l = Math.max(c.r, c.g, c.b); if (l < entry.minBrightness) c.multiplyScalar(entry.minBrightness / Math.max(l, 1e-3)); } } });
}

/* ---------------- engines ---------------- */
const engLoaded = new Map();   // id -> { tpl, entry, height } | null   (tpl is normalised to a 1 m wide bell exit)
/** Which manifest engine a lab engine id (ship-sim ENGINES key) uses, or null. generic-engine is deliberately not mapped to anything. */
export const ENGINE_GLB = { 'merlin-1d': 'merlin-light', 'merlin-vac': 'merlin-1d-vacuum', 'raptor-2': 'raptor', 'raptor': 'raptor', 'j-2': 'j-2s', 'j-2s': 'j-2s' };
export const engineGlbFor = engineId => ENGINE_GLB[engineId] ?? null;
export const hasEngineModel = id => !!engLoaded.get(id);
export function engineEntry(id) { return engLoaded.get(id)?.entry ?? null; }

/** Load (once), orient (nozzle exit down -y, entry.axis/noseSign/flip say how the file is stored), find the bell exit ring (the lowest `exitBand` fraction of the height) and
 *  normalise to a 1 m wide exit with the origin at the top. Resolves to true when usable; never rejects (a 404 leaves the procedural bell in place). */
export async function preloadEngineModel(id) {
  if (engLoaded.has(id)) return !!engLoaded.get(id);
  const man = await loadManifest(), entry = man.engines?.[id]; let ok = null;
  if (entry?.file) {
    try {
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL(entry.file, BASE).href);
      const root = gltf.scene, wrap = new THREE.Group(); wrap.add(root);
      // entry.axis: the file's long axis; entry.noseSign = +1 when the nozzle exit is at the -axis end (default: exit at the -y end, i.e. already pointing down)
      const down = AXES[entry.axis || 'y'].clone().multiplyScalar(-(entry.noseSign ?? 1));
      root.quaternion.setFromUnitVectors(down, new THREE.Vector3(0, -1, 0)); root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), H = box.max.y - box.min.y, lim = box.min.y + H * (entry.exitBand ?? 0.02), band = new THREE.Box3(), v = new THREE.Vector3();
      root.traverse(o => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y <= lim) band.expandByPoint(v); } });
      const cx = (band.min.x + band.max.x) / 2, cz = (band.min.z + band.max.z) / 2, D = Math.max(band.max.x - band.min.x, band.max.z - band.min.z) || H, k = 1 / D;
      root.scale.setScalar(k); root.position.set(-cx * k, -box.max.y * k, -cz * k);
      root.traverse(o => { if (o.isMesh) { if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); o.frustumCulled = true; } });
      ok = { tpl: wrap, entry, height: H * k, nativeExit: D };
    } catch { /* missing or corrupt: keep the procedural bell */ }
  }
  engLoaded.set(id, ok); return !!ok;
}
/** A clone of the normalised engine. opts.exitDiameter (m, default the entry's exitDiameterM); opts.shadows. Geometry and materials are shared between clones. */
export function engineModel(id, opts = {}) {
  const rec = engLoaded.get(id); if (!rec) return null;
  const D = opts.exitDiameter ?? rec.entry.exitDiameterM ?? 1, g = rec.tpl.clone(true);
  g.scale.setScalar(D);
  if (opts.shadows) g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.userData = { engine: true, id, height: rec.height * D, exitY: -rec.height * D, exitDiameter: D, fitAxis: null, id0: id, attribution: attribution(rec.entry), entry: rec.entry };
  return g;
}
export function vehicleEntry(id) { return loaded.get(id)?.entry ?? null; }

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
/* GLTFLoader sanitises node names (spaces become '_', '.' and a few other characters are dropped), so 'Second Stage' in a manifest regex has to match 'Second_Stage': try the pattern as written and with its spaces as '_'. */
const nameRe = r => [new RegExp(r, 'i'), new RegExp(String(r).replace(/ /g, '_'), 'i')];
function matches(name, list) { return (list || []).some(r => nameRe(r).some(re => re.test(name))); }

/** A normalised clone: long axis +y (nose up), base of the visible geometry at y = 0, centred on x/z, scaled to real size.
 *  opts.mode: a key of entry.modes (e.g. 'firstStage' hides the second stage and fairing; the default is the whole model).
 *  opts.hide: gear groups to remove, named in entry.gear (e.g. ['legs', 'gridFins']); the lab draws and animates its own.
 *  opts.length: override the real length of the visible part in metres (otherwise the mode's lengthM / the entry's lengthM).
 *  opts.diameter: force the body width in metres (non-uniform horizontal scale). entry.widthScale (manifest) does the same by a fixed factor when opts.diameter is not given.
 *  opts.shadows: cast and receive shadows. */
export function vehicleModel(id, opts = {}) {
  const rec = loaded.get(id); if (!rec) return null;
  const { entry } = rec, mode = entry.modes?.[opts.mode] ?? {}, root = rec.scene.clone(true);
  const kill = [...(mode.hideNodes || []), ...(opts.hide || []).flatMap(g => entry.gear?.[g]?.hideNodes || [])];
  if (kill.length) { const dead = []; root.traverse(o => { if (o !== root && o.name && matches(o.name, kill)) dead.push(o); }); dead.forEach(o => o.removeFromParent()); }
  root.traverse(o => { if (o.isMesh) { const g = o.geometry; if (!g.attributes.normal) g.computeVertexNormals(); o.frustumCulled = true; if (opts.shadows) o.castShadow = o.receiveShadow = true; } });
  // entry.assemble: [{ node: regex, move: [x, y, z] }] puts back parts that the author left exploded / laid out beside the vehicle (world metres of the file, before scaling)
  if (entry.assemble?.length) { root.updateMatrixWorld(true); const v = new THREE.Vector3();
    for (const a of entry.assemble) root.traverse(o => { if (o === root || !o.name || !matches(o.name, [a.node]) || !o.parent) return; o.getWorldPosition(v).add(new THREE.Vector3(...a.move)); o.parent.worldToLocal(v); o.position.copy(v); o.updateMatrixWorld(true); }); }
  const wrap = new THREE.Group(); wrap.add(root);
  // orient: map the model's long axis (entry.axis, pointing to the nose when entry.noseSign = +1) onto +y
  const ax = AXES[entry.axis || 'y'].clone().multiplyScalar(entry.noseSign || 1);
  root.quaternion.setFromUnitVectors(ax, AXES.y); root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  // mode.refNode: a node (regex on its name) that defines the scale and the zero of y instead of the whole model, e.g. the first-stage tank without its engines
  let ref = null; if (mode.refNode) root.traverse(o => { if (!ref && o.name && matches(o.name, [mode.refNode])) ref = o; });
  const length = opts.length ?? mode.lengthM ?? entry.lengthM, k = length / (ref ? new THREE.Box3().setFromObject(ref).getSize(new THREE.Vector3()).y : size.y);
  root.scale.multiplyScalar(k); root.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  // entry.centerBand [lo, hi]: centre x/z on the vertices in that fraction of the height (the body), not on the whole box (grid fins, hot-staging ring and stowed legs skew it)
  if (entry.centerBand) { const lo = box.min.y + (box.max.y - box.min.y) * entry.centerBand[0], hi = box.min.y + (box.max.y - box.min.y) * entry.centerBand[1], bb = new THREE.Box3(), p = new THREE.Vector3();
    root.traverse(o => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (p.y >= lo && p.y <= hi) bb.expandByPoint(p); } });
    if (!bb.isEmpty()) { const cc = bb.getCenter(new THREE.Vector3()); c.x = cc.x; c.z = cc.z; } }
  const y0 = ref ? new THREE.Box3().setFromObject(ref).min.y : box.min.y; root.position.set(-c.x, -y0, -c.z);
  // opts.diameter (m): squash / stretch x and z so the body is this wide (the Shipyard stacks the model on lab stages of a given diameter and tank length); y and the base stay put
  if (opts.diameter) { const w = ref ? new THREE.Box3().setFromObject(ref).getSize(new THREE.Vector3()) : new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()), sx = opts.diameter / (Math.max(w.x, w.z) || opts.diameter); wrap.scale.set(sx, 1, sx); }
  // entry.widthScale: optional fixed horizontal squash / stretch about the vertical axis (x and z only; y and the base stay put). Boosters sit at a radial offset, so they scale with the core and stay attached.
  if (!opts.diameter && entry.widthScale && entry.widthScale !== 1) wrap.scale.set(entry.widthScale, 1, entry.widthScale);
  wrap.userData = { glb: true, id, baseY: 0, length, scale: k, diameter: opts.diameter ?? entry.diameterM, attribution: attribution(entry), entry };
  if (entry.noFit) wrap.userData.fitAxis = null;   // the catalogue viewer must not stretch this model to the catalogue height (it is only part of the vehicle, or drawn to a different length)
  return wrap;
}

/** A whole engine cluster for a stage of radius R0 (m): a centre engine + a ring (the labs' procedural layout), Super Heavy's 3 / 10 / 20 Raptors, or a single engine.
 *  `engineId` is the lab's engine id (ship-sim ENGINES key), `count` the number of engines, `exitY` the y of the nozzle EXIT plane in the caller's frame (the engines hang from it
 *  upward by their own height, so the exit plane, and therefore plume and contact height, never moves). Returns a Group with userData.glb = manifest engine id, or null when the
 *  lab engine has no model or its file did not load (the caller then keeps its procedural bells). Clones share geometry and materials. */
export function engineCluster(engineId, count, R0, exitY = 0) {
  const id = engineGlbFor(engineId); if (!id || !hasEngineModel(id)) return null;
  const dReal = engLoaded.get(id).entry.exitDiameterM ?? 1, n = Math.max(1, count | 0 || 1), pos = [], chord = (r, m) => 2 * r * Math.sin(Math.PI / m); let minGap = 1e9;
  if (id === 'raptor' && n === 33) { for (const [r, m, o] of [[0.17 * R0, 3, Math.PI / 2], [0.46 * R0, 10, 0], [0.88 * R0, 20, 0]]) { minGap = Math.min(minGap, chord(r, m)); for (let i = 0; i < m; i++) pos.push([Math.cos(o + i * 2 * Math.PI / m) * r, Math.sin(o + i * 2 * Math.PI / m) * r]); } }
  else if (n === 1) { pos.push([0, 0]); minGap = 1.8 * R0; }
  else { const k = Math.min(n, 9), m = k - 1, rr = R0 * (k === 9 ? 0.66 : 0.58); pos.push([0, 0]); minGap = Math.min(rr, m > 1 ? chord(rr, m) : 1e9, 2 * (R0 * 0.97 - rr));
    for (let i = 0; i < m; i++) { const a = i * 2 * Math.PI / m; pos.push([Math.cos(a) * rr, Math.sin(a) * rr]); } }
  const d = Math.min(dReal, 0.97 * minGap), g = new THREE.Group();
  for (const [x, z] of pos) { const e = engineModel(id, { exitDiameter: d }); e.position.set(x, exitY + e.userData.height, z); g.add(e); }
  g.userData = { glb: id, exitDiameter: d, count: pos.length }; g.name = 'engines'; return g;
}

export function attribution(entry) { return `"${entry.title}" by ${entry.author}, ${entry.license}`; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Credit line for the models that are loaded among `ids` ('' when none). CC BY needs the title, author, licence and a link. */
export function attributionHTML(ids) {
  const seen = new Set(), out = [];
  for (const id of [].concat(ids)) { const e = (loaded.get(id) ?? engLoaded.get(id))?.entry; if (!e || seen.has(e.source)) continue; seen.add(e.source);
    out.push(`3D model <a href="${esc(e.source)}" target="_blank" rel="noopener">${esc(e.title)}</a> by ${e.authorUrl ? `<a href="${esc(e.authorUrl)}" target="_blank" rel="noopener">${esc(e.author)}</a>` : esc(e.author)}, <a href="${esc(e.licenseUrl)}" target="_blank" rel="noopener">${esc(e.license)}</a>${e.modified ? ' (modified: optimised copy)' : ''}${e.note ? ` <span class="glbnote" style="opacity:.8">&ndash; ${esc(e.note)}</span>` : ''}`); }
  return out.join(' · ');
}
