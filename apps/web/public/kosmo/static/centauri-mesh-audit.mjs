// centauri-mesh-audit.mjs -- run the mesh attachment audit over the fleet and print the counts.
//   node centauri-mesh-audit.mjs [ship-id ...] [--list] [--json]
// Builds every ship headlessly (three through three-node-resolver.mjs) and prints findings by code and by
// ship; --list prints every finding. The counts are the ones CENTAURI-ATTACH.md records before and after.

import { register } from 'node:module';
import { hasThree } from './three-node-resolver.mjs';
import { ALL_SHIP_IDS, SHIP_IDS, measureAny } from './parts/geometry-audit.js';

if (!hasThree()) { console.log('mesh audit: vendor/three-0.160.0 is not checked out'); process.exit(0); }
register('./three-node-resolver.mjs', import.meta.url);
const { buildCentauriModel } = await import('./parts/centauri-models.js');
const { buildRoboticModel } = await import('./parts/robotic-models.js');
const { auditModelMeshes } = await import('./centauri-mesh-audit.js');

const args = process.argv.slice(2), list = args.includes('--list'), json = args.includes('--json');
const ids = args.filter((a) => !a.startsWith('--'));
const byCode = {}, byShip = {}, all = [];
let meshes = 0, frames = 0;
for (const id of ids.length ? ids : ALL_SHIP_IDS) {
  const g = SHIP_IDS.v5.includes(id) ? buildRoboticModel(id) : buildCentauriModel(id);
  g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
  const r = auditModelMeshes(g, g.userData.measure ?? measureAny(id));
  meshes += r.meshes; frames += r.frames;
  byShip[id] = r.findings.length;
  for (const f of r.findings) { byCode[f.code] = (byCode[f.code] ?? 0) + 1; all.push({ id, ...f }); }
  if (list) for (const f of r.findings) console.log(`${id}  ${f.code}  ${f.message}`);
}
if (json) console.log(JSON.stringify({ byCode, byShip, total: all.length, meshes, frames }, null, 1));
else {
  console.log(`mesh audit: ${all.length} findings over ${meshes} meshes in ${frames} part frames`);
  for (const [c, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(18)} ${n}`);
  console.log(Object.entries(byShip).filter(([, n]) => n).map(([id, n]) => `${id} ${n}`).join(', '));
}
