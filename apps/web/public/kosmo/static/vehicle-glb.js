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
  // opts.explode: regroup the model for the catalogue's exploded-view slider (entry.explode, see below). Never done unless asked, so the labs get the untouched model.
  if (opts.explode && entry.explode?.parts?.length) { try { buildExplode(wrap, rec, id, entry.explode); } catch (e) { console.warn('explode setup failed for ' + id, e); } }
  return wrap;
}

/* ---------------- exploded view ----------------
 * entry.explode = { split?: [regex], parts: [ { name, stage: n | booster: true, nodes?: [regex], y?: [lo, hi], x?, z?, r?: [lo, hi] } ] }
 * The model's meshes (and, for the nodes named in `split`, the connected triangle islands of a merged mesh) are the "items". Each item goes to the FIRST part whose conditions it meets:
 * `ex.axis` [x, z] (default the origin) is where the vehicle's vertical axis is in that frame (the Shuttle's stack is not centred on its box); `ex.cut` [y, ...] and `ex.cutMin` cut tall one-piece islands into sections.
 * `nodes` match the item's own node name or any ancestor's (same space/underscore rule as hideNodes); y / x / z / r (distance from the vertical axis) are metres in the normalised
 * model frame (base at y = 0, centred on the axis) and are tested on the item's bounding-box centre. Items no part claims join the stage whose height range is nearest.
 * stage parts become Groups in userData.stages (Map n -> Group, stage numbers renumbered 0..N-1 bottom to top; the page lifts stage n by n * step), every `booster: true` part (one per distinct
 * name) becomes a child of a Group with userData.boosters = true, carrying userData.dir = [dx, dz] (unit vector, axis to the booster) and userData.base; userData.top = model height in metres.
 * World transforms are kept (Object3D.attach), so with the sliders at 0 nothing moves. */
const _v = new THREE.Vector3(), _b = new THREE.Box3();
function nameChain(o, stop) { const a = []; for (; o && o !== stop; o = o.parent) if (o.name) a.push(o.name); return a; }

/** Connected components of the triangles (vertices welded by position). Returns { count, tri: Int32Array island id per triangle, boxes: [Box3 in geometry space] }. */
function islandsOf(geom) {
  const pos = geom.attributes.position, n = pos.count, ix = geom.index ? geom.index.array : null, nt = ix ? ix.length / 3 : n / 3;
  const par = new Int32Array(n); for (let i = 0; i < n; i++) par[i] = i;
  const find = a => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; }, uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const seen = new Map();
  for (let i = 0; i < n; i++) { const k = pos.getX(i) + ',' + pos.getY(i) + ',' + pos.getZ(i), j = seen.get(k); if (j === undefined) seen.set(k, i); else uni(i, j); }
  const vi = (t, c) => ix ? ix[t * 3 + c] : t * 3 + c;
  for (let t = 0; t < nt; t++) { uni(vi(t, 0), vi(t, 1)); uni(vi(t, 1), vi(t, 2)); }
  const ids = new Map(), tri = new Int32Array(nt), boxes = [];
  for (let t = 0; t < nt; t++) { const r = find(vi(t, 0)); let id = ids.get(r); if (id === undefined) { id = boxes.length; ids.set(r, id); boxes.push(new THREE.Box3()); }
    tri[t] = id; for (let c = 0; c < 3; c++) boxes[id].expandByPoint(_v.fromBufferAttribute(pos, vi(t, c))); }
  return { count: boxes.length, tri, boxes };
}
/** A new geometry holding only the triangles t with pick[t] === part (all attributes copied, vertices renumbered). */
function subGeometry(geom, tri, part) {
  const ix = geom.index ? geom.index.array : null, n = geom.attributes.position.count, map = new Int32Array(n).fill(-1), out = []; let nv = 0;
  for (let t = 0; t < tri.length; t++) if (tri[t] === part) for (let c = 0; c < 3; c++) { const v = ix ? ix[t * 3 + c] : t * 3 + c; if (map[v] < 0) map[v] = nv++; out.push(map[v]); }
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geom.attributes)) {   // the optimised files store attributes interleaved: copy the raw components into plain arrays
    const src = a.isInterleavedBufferAttribute ? a.data.array : a.array, stride = a.isInterleavedBufferAttribute ? a.data.stride : a.itemSize, off = a.isInterleavedBufferAttribute ? a.offset : 0, arr = new src.constructor(nv * a.itemSize);
    for (let v = 0; v < n; v++) if (map[v] >= 0) for (let c = 0; c < a.itemSize; c++) arr[map[v] * a.itemSize + c] = src[v * stride + off + c];
    g.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
  g.setIndex(new THREE.BufferAttribute(nv > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  return g;
}
function ruleFor(parts, names, c, r) {
  for (let i = 0; i < parts.length; i++) { const p = parts[i];
    if (p.nodes && !names.some(n => matches(n, p.nodes))) continue;
    if (p.y && !(c.y >= p.y[0] && c.y < p.y[1])) continue;
    if (p.x && !(c.x >= p.x[0] && c.x < p.x[1])) continue;
    if (p.z && !(c.z >= p.z[0] && c.z < p.z[1])) continue;
    if (p.r && !(r >= p.r[0] && r < p.r[1])) continue;
    return i; }
  return -1;
}
/** Clip the triangles `tris` of `g` (vertex data decoded to floats) against the horizontal planes y = planes[i] of the normalised frame (matrix mw takes geometry space there).
 *  Returns one Float32Array per band (planes.length + 1; interleaved vertex data of all attributes in Object.keys order, non-indexed triangles). Used to cut tall single-piece meshes into tank/stage sections. */
function clipBands(g, tris, mw, planes) {
  const names = Object.keys(g.attributes), attrs = names.map(n => g.attributes[n]), sizes = attrs.map(a => a.itemSize), W = sizes.reduce((x, y) => x + y, 0);
  const po = sizes.slice(0, names.indexOf('position')).reduce((x, y) => x + y, 0), no = names.includes('normal') ? sizes.slice(0, names.indexOf('normal')).reduce((x, y) => x + y, 0) : -1, e = mw.elements, ix = g.index ? g.index.array : null;
  const vert = v => { const o = new Float32Array(W); let k = 0; for (let i = 0; i < attrs.length; i++) { const a = attrs[i]; o[k++] = a.getX(v); if (sizes[i] > 1) o[k++] = a.getY(v); if (sizes[i] > 2) o[k++] = a.getZ(v); if (sizes[i] > 3) o[k++] = a.getW(v); } return o; };
  const yOf = o => e[1] * o[po] + e[5] * o[po + 1] + e[9] * o[po + 2] + e[13];
  const bands = planes.map(() => []).concat([[]]), emit = (b, poly) => { for (let i = 1; i + 1 < poly.length; i++) bands[b].push(poly[0], poly[i], poly[i + 1]); };
  for (const t of tris) {
    let poly = [0, 1, 2].map(c => vert(ix ? ix[t * 3 + c] : t * 3 + c)), done = false;
    for (let b = 0; b < planes.length && !done; b++) {
      const P = planes[b], lo = [], hi = [];
      for (let i = 0; i < poly.length; i++) { const c = poly[i], n = poly[(i + 1) % poly.length], yc = yOf(c), yn = yOf(n);
        (yc < P ? lo : hi).push(c);
        if ((yc < P) !== (yn < P)) { const f = (P - yc) / (yn - yc), m = new Float32Array(W); for (let k = 0; k < W; k++) m[k] = c[k] + (n[k] - c[k]) * f; if (no >= 0) { const l = Math.hypot(m[no], m[no + 1], m[no + 2]) || 1; m[no] /= l; m[no + 1] /= l; m[no + 2] /= l; } lo.push(m); hi.push(m); } }
      if (lo.length >= 3) emit(b, lo);
      poly = hi; if (poly.length < 3) done = true;
    }
    if (!done) emit(planes.length, poly);
  }
  return bands.map(list => { const out = new Float32Array(list.length * W); list.forEach((v, i) => out.set(v, i * W)); return out; });
}
/** Float32 non-indexed geometry from clipBands output chunks (same attribute layout as `like`). */
function geometryFromChunks(like, chunks) {
  const names = Object.keys(like.attributes), sizes = names.map(n => like.attributes[n].itemSize), W = sizes.reduce((x, y) => x + y, 0), n = chunks.reduce((x, c) => x + c.length / W, 0), g = new THREE.BufferGeometry();
  let off = 0; names.forEach((name, i) => { const arr = new Float32Array(n * sizes[i]); let v = 0; for (const c of chunks) for (let j = 0; j < c.length / W; j++, v++) for (let k = 0; k < sizes[i]; k++) arr[v * sizes[i] + k] = c[j * W + off + k]; g.setAttribute(name, new THREE.BufferAttribute(arr, sizes[i])); off += sizes[i]; });
  return g;
}
const islandCache = new WeakMap();
/** Items of the model with their centre in the normalised frame: [{ obj, names, c: Vector3, box, rule }]. Merged meshes named in ex.split are replaced by one mesh per rule (shared material), cached per vehicle.
 *  Islands taller than ex.cutMin (default 6 m) that cross one of the ex.cut planes (metres of y) and whose centre falls in a part flagged `cut: true` are clipped into sections at those planes (open at the cut, so their material is drawn two-sided). */
function explodeItems(wrap, rec, id, ex) {
  wrap.updateMatrixWorld(true);
  const sx = wrap.scale.x || 1, sz = wrap.scale.z || 1, ax = ex.axis || [0, 0], parts = ex.parts, items = [], meshes = [], planes = [...(ex.cut || [])].sort((p, q) => p - q), cutMin = ex.cutMin ?? 6;
  wrap.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cache = rec.xcache ??= new Map(), mats = rec.xmat ??= new Map(); let si = 0;
  const shift = c => { c.x = c.x / sx - ax[0]; c.z = c.z / sz - ax[1]; return c; }, centre = box => shift(box.getCenter(new THREE.Vector3()));
  for (const m of meshes) {
    const names = nameChain(m, wrap), doSplit = ex.split && matches(names[0] || '', ex.split) && !Array.isArray(m.material) && m.geometry.attributes.position && !m.geometry.groups?.length;
    if (!doSplit) { items.push({ obj: m, names, c: centre(_b.setFromObject(m)), box: _b.clone(), rule: -1 }); continue; }
    const key = id + '#' + (si++), g = m.geometry; let res = cache.get(key);
    if (!res) {   // first time: find the islands, give each to a part by its centre (tall ones are cut into sections first), build one geometry per part
      let isl = islandCache.get(g); if (!isl) islandCache.set(g, isl = islandsOf(g));
      const mw = m.matrixWorld, rule = new Int32Array(isl.count), cutIsl = new Uint8Array(isl.count), pick = new Int32Array(isl.tri.length); res = [];
      for (let i = 0; i < isl.count; i++) { _b.copy(isl.boxes[i]).applyMatrix4(mw);
        const c = centre(_b), r0 = ex.probe ? i : ruleFor(parts, names, c, Math.hypot(c.x, c.z));
        if (!ex.probe && parts[r0]?.cut && planes.some(P => _b.min.y < P && _b.max.y > P) && _b.max.y - _b.min.y > cutMin) { cutIsl[i] = 1; rule[i] = -2; continue; }
        rule[i] = r0; }
      for (let t = 0; t < pick.length; t++) pick[t] = cutIsl[isl.tri[t]] ? -2 : rule[isl.tri[t]];
      for (const r of new Set(rule)) if (r !== -2) res.push({ rule: r, geometry: subGeometry(g, pick, r) });
      if (cutIsl.some(Boolean)) {
        const byIsl = new Map(); for (let t = 0; t < pick.length; t++) if (pick[t] === -2) { const i = isl.tri[t]; if (!byIsl.has(i)) byIsl.set(i, []); byIsl.get(i).push(t); }
        const acc = new Map(), names2 = Object.keys(g.attributes), po = names2.slice(0, names2.indexOf('position')).reduce((q, n) => q + g.attributes[n].itemSize, 0), W = names2.reduce((q, n) => q + g.attributes[n].itemSize, 0);
        for (const tris of byIsl.values()) for (const chunk of clipBands(g, tris, mw, planes)) {
          if (!chunk.length) continue; _b.makeEmpty(); for (let j = 0; j < chunk.length; j += W) _b.expandByPoint(_v.set(chunk[j + po], chunk[j + po + 1], chunk[j + po + 2]).applyMatrix4(mw));
          const c = centre(_b), r = ruleFor(parts, names, c, Math.hypot(c.x, c.z)); if (!acc.has(r)) acc.set(r, []); acc.get(r).push(chunk); }
        for (const [r, chunks] of acc) res.push({ rule: r, geometry: geometryFromChunks(g, chunks), cut: true });
      }
      res.islands = isl.count; cache.set(key, res);
    }
    const par = m.parent; if (!par) continue;
    for (const { rule, geometry, cut } of res) {
      let material = m.material; if (cut) { if (!mats.has(material)) { const c = material.clone(); c.side = THREE.DoubleSide; mats.set(material, c); } material = mats.get(material); }
      const mm = new THREE.Mesh(geometry, material); mm.name = m.name + '/part' + rule + (cut ? 'c' : ''); mm.matrix.copy(m.matrix); mm.matrix.decompose(mm.position, mm.quaternion, mm.scale);
      mm.castShadow = m.castShadow; mm.receiveShadow = m.receiveShadow; mm.frustumCulled = true; par.add(mm); mm.updateMatrixWorld(true); items.push({ obj: mm, names, c: centre(_b.setFromObject(mm)), box: _b.clone(), rule, split: true }); }
    m.removeFromParent();
  }
  return items;
}
function buildExplode(wrap, rec, id, ex) {
  const parts = ex.parts, items = explodeItems(wrap, rec, id, ex);
  for (const it of items) if (it.rule < 0) it.rule = ruleFor(parts, it.names, it.c, Math.hypot(it.c.x, it.c.z));
  const stageNos = [...new Set(parts.filter(p => p.stage != null).map(p => p.stage))].sort((a, b) => a - b), slot = new Map(stageNos.map((s, i) => [s, i]));
  // unclaimed items join the stage with the nearest height range
  const rng = new Map(); for (const it of items) { const p = parts[it.rule]; if (p?.stage == null) continue; const r = rng.get(p.stage) ?? [1e9, -1e9]; r[0] = Math.min(r[0], it.c.y); r[1] = Math.max(r[1], it.c.y); rng.set(p.stage, r); }
  const stageOf = it => { const p = parts[it.rule]; if (p?.stage != null) return p.stage; let best = stageNos[0], bd = 1e18; for (const [s, [lo, hi]] of rng) { const d = it.c.y < lo ? lo - it.c.y : it.c.y > hi ? it.c.y - hi : 0; if (d < bd) { bd = d; best = s; } } return best; };
  const stages = new Map(), boosters = new Map(), boosterRoot = new THREE.Group(); boosterRoot.userData.boosters = true; boosterRoot.name = 'boosters'; wrap.add(boosterRoot);   // in the tree from the start so attach() sees the same parent transform (widthScale)
  for (const it of items) {
    const p = parts[it.rule];
    if (p?.booster) { let b = boosters.get(p.name); if (!b) { b = { g: new THREE.Group(), n: 0, sum: new THREE.Vector3() }; b.g.name = p.name; boosters.set(p.name, b); boosterRoot.add(b.g); } b.g.attach(it.obj); b.sum.add(it.c); b.n++; }
    else { const s = stageOf(it); let g = stages.get(s); if (!g) { g = new THREE.Group(); g.name = parts.find(q => q.stage === s)?.name || 'stage ' + s; g.userData.stage = slot.get(s); stages.set(s, g); wrap.add(g); } g.attach(it.obj); }
  }
  const map = new Map(); for (const s of stageNos) if (stages.has(s)) map.set(map.size, stages.get(s)); map.forEach((g, i) => { g.userData.stage = i; });
  if (!boosters.size) wrap.remove(boosterRoot); else { for (const b of boosters.values()) { const c = b.sum.multiplyScalar(1 / b.n), l = Math.hypot(c.x, c.z); b.g.userData.dir = l > 0.05 ? [c.x / l, c.z / l] : [0, 0]; b.g.userData.base = b.g.position.clone(); } }
  const top = new THREE.Box3().setFromObject(wrap).max.y;
  Object.assign(wrap.userData, { stages: map, top, explode: true });
}

/** Development aid: the exploded-view items of a vehicle (before any rule is applied, split merged meshes at once) as plain rows, to author entry.explode.parts from.
 *  explodeProbe('falcon-heavy', ['^Object_2$']) -> [{ name, path, y: [lo, hi], r, c: [x, y, z], tris }] in metres of the normalised frame. */
export function explodeProbe(id, splitNodes = [], mode = 'full') {
  const rec = loaded.get(id); if (!rec) return null;
  const w = vehicleModel(id, { mode }); if (!w) return null;
  const items = explodeItems(w, { xcache: new Map() }, id, { split: splitNodes, probe: true, parts: [{ name: 'all', stage: 0 }] });
  return items.map(it => ({ name: it.obj.name, path: it.names.slice(1).reverse().join('>'), y: [+it.box.min.y.toFixed(2), +it.box.max.y.toFixed(2)], r: +Math.hypot(it.c.x, it.c.z).toFixed(2), c: [it.c.x, it.c.y, it.c.z].map(v => +v.toFixed(2)), tris: (it.obj.geometry.index?.count ?? it.obj.geometry.attributes.position.count) / 3 | 0, w: [+(it.box.max.x - it.box.min.x).toFixed(2), +(it.box.max.z - it.box.min.z).toFixed(2)] }));
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
