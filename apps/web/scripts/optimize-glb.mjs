#!/usr/bin/env node
/**
 * Shrink a GLB for the web (decimate + meshopt-compress + resize textures) with glTF-Transform.
 *
 *   # one-off: install the tooling OUTSIDE the repo (nothing is added to package.json)
 *   mkdir -p ~/glb-tools && cd ~/glb-tools && npm init -y && npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer
 *
 *   # then, from anywhere
 *   GLB_TOOLS_DIR=~/glb-tools node apps/web/scripts/optimize-glb.mjs <in.glb> [out.glb] [--ratio 0.15] [--error 0.01] [--soup] [--keep-nodes] [--tex 1024]
 *
 *   out defaults to <in>.web.glb next to the input (the original is never modified).
 *
 *   --ratio  target fraction of triangles kept by the simplifier (default 0.25; 1 = no decimation)
 *   --error  max simplification error, relative to the mesh size (default 0.01)
 *   --soup   the model is flat-shaded triangle soup (no shared vertices, typical of OBJ/FBX exports): drop NORMAL, weld by position so the
 *            simplifier can collapse triangles, and let vehicle-glb.js recompute smooth normals on load. Needed for the Starship models.
 *   --metalrough  convert KHR_materials_pbrSpecularGlossiness materials to metallic-roughness (current three.js ignores spec-gloss and renders them black/white)
 *   --keep-nodes  keep the node hierarchy and names (default; pass --flatten to merge nodes and meshes for fewer draw calls, which loses node names)
 *   --tex    max texture size in px (default 1024; textures are re-encoded as WebP when `sharp` is installed, otherwise left alone)
 *
 * Output uses EXT_meshopt_compression + KHR_mesh_quantization; vehicle-glb.js loads it with three's MeshoptDecoder.
 * Command-line alternative without this script: npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --flatten false --join false
 */
import { createRequire } from 'node:module';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), flag = n => args.includes('--' + n), opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const VAL = ['ratio', 'error', 'tex'], pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VAL.includes(args[i - 1].slice(2))));
if (!pos.length) { console.error('usage: optimize-glb.mjs <in.glb> [out.glb] [--ratio 0.25] [--error 0.01] [--soup] [--flatten] [--tex 1024]'); process.exit(1); }
const inFile = path.resolve(pos[0]), outFile = path.resolve(pos[1] || inFile.replace(/\.glb$/i, '') + '.web.glb');
const dir = (process.env.GLB_TOOLS_DIR || process.cwd()).replace(/^~/, process.env.HOME);
const req = createRequire(path.join(path.resolve(dir), 'noop.js'));
let core, fns, ext, mo;
try { core = req('@gltf-transform/core'); fns = req('@gltf-transform/functions'); ext = req('@gltf-transform/extensions'); mo = req('meshoptimizer'); }
catch (e) { console.error('Missing tooling (' + e.message.split('\n')[0] + ').\nInstall it with:  mkdir -p ~/glb-tools && cd ~/glb-tools && npm init -y && npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer\nthen run with GLB_TOOLS_DIR=~/glb-tools'); process.exit(2); }

const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': mo.MeshoptDecoder, 'meshopt.encoder': mo.MeshoptEncoder });
await mo.MeshoptDecoder.ready; await mo.MeshoptEncoder.ready; await mo.MeshoptSimplifier.ready;
const doc = await io.read(inFile), root = doc.getRoot();
const tris = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0), 0);
const before = tris(), ratio = +opt('ratio', 0.25), error = +opt('error', 0.01), hasTex = root.listTextures().length > 0;
const steps = [];
if (flag('metalrough')) steps.push(fns.metalRough());   // KHR_materials_pbrSpecularGlossiness -> metallic-roughness (three.js no longer loads spec-gloss)
if (flag('soup')) { for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { p.setAttribute('NORMAL', null); if (!hasTex) p.setAttribute('TEXCOORD_0', null); } steps.push(fns.weld({ tolerance: 1e-4 })); }
else steps.push(fns.weld());
if (ratio < 1) steps.push(fns.simplify({ simplifier: mo.MeshoptSimplifier, ratio, error, lockBorder: false }));
if (flag('flatten')) steps.push(fns.flatten(), fns.join());
steps.push(fns.prune({ keepLeaves: true }), fns.dedup(), fns.quantize());
if (hasTex) { try { const sharp = req('sharp'); steps.push(fns.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+opt('tex', 1024), +opt('tex', 1024)] })); } catch { console.warn('sharp not installed: textures left as they are'); } }
steps.push(fns.meshopt({ encoder: mo.MeshoptEncoder, level: 'high' }));
await doc.transform(...steps);
await io.write(outFile, doc);
const mb = f => (statSync(f).size / 1048576).toFixed(2) + ' MB';
console.log(`${path.basename(inFile)}  ${mb(inFile)}, ${Math.round(before)} triangles  ->  ${path.basename(outFile)}  ${mb(outFile)}, ${Math.round(tris())} triangles`);
