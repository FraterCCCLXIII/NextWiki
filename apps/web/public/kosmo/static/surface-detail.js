/* surface-detail.js -- rivets and panel seams, added on top of a finished model.

   The telescope page in SpaceRadio seats thousands of fasteners on a surface with an instanced
   sphere and a cylinder: one draw call, real material, and a scale that comes from the part rather
   than from a constant. This does the same for any Kosmo model, procedural or GLB:

     * every large skin is found by bounding box (small greebles are skipped, or the whole thing
       dissolves into noise),
     * three seam lines are drawn where a real module would have ring frames,
     * rivets sit on those seams at a spacing that follows the model's own size,

   so a 2 m bus and a 60 m stack both read correctly without a per-vehicle table. Everything is
   instanced and grouped under one child, which the viewer toggles; `userData.detail` keeps the
   overlay out of the render-mode pass and out of any future load-path edits. */

import * as THREE from 'three';

const RIVET_MAT = new THREE.MeshStandardMaterial({ color: 0x9aa2a9, metalness: 0.6, roughness: 0.32 });
const SEAM_MAT = new THREE.MeshStandardMaterial({ color: 0x848d95, metalness: 0.55, roughness: 0.4 });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

/**
 * Add rivet rings and seam rings to `root`. Returns the group it created (already a child), so the
 * caller can show/hide it. Calling twice would double the detail, so keep the returned group.
 */
export function addSurfaceDetail(root, { on = true, minFraction = 0.05 } = {}) {
  const group = new THREE.Group();
  group.name = 'surface-detail';
  group.userData.detail = true;

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;

  const rivets = [];
  const seams = [];

  root.traverse((o) => {
    if (!o.isMesh || o.userData.detail) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || (mat.transparent && (mat.opacity ?? 1) < 0.85)) return;   // film and glazing: no rivets
    const bb = new THREE.Box3().setFromObject(o);
    const s = bb.getSize(new THREE.Vector3());
    const big = Math.max(s.x, s.y, s.z);
    if (big < span * minFraction) return;                                  // greebles and fasteners
    const radius = Math.max(s.x, s.z) / 2;
    if (radius < span * 0.012) return;
    const c = bb.getCenter(new THREE.Vector3());
    const count = Math.max(6, Math.min(30, Math.round((radius / span) * 260)));
    const rivetR = span * 0.0022;
    const seamR = span * 0.0011;
    for (const f of [0.16, 0.5, 0.84]) {
      const y = bb.min.y + s.y * f;
      seams.push({ p: new THREE.Vector3(c.x, y, c.z), r: radius, t: seamR });
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        rivets.push({ p: new THREE.Vector3(c.x + Math.cos(a) * radius, y, c.z + Math.sin(a) * radius), s: rivetR });
      }
    }
  });

  if (rivets.length) {
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), RIVET_MAT, rivets.length);
    inst.userData.detail = true;
    rivets.forEach((it, i) => {
      root.worldToLocal(_p.copy(it.p));
      _q.setFromUnitVectors(_up, _up);
      _s.setScalar(it.s);
      inst.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  if (seams.length) {
    const inst = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.012, 4, 40), SEAM_MAT, seams.length);
    inst.userData.detail = true;
    seams.forEach((it, i) => {
      root.worldToLocal(_p.copy(it.p));
      _q.copy(_flat);
      _s.set(it.r, it.r, Math.max(it.t / 0.012, 0.2));
      inst.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  group.visible = on;
  root.add(group);
  return group;
}
