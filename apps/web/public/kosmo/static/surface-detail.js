/* surface-detail.js -- rivets and panel seams, added on top of a finished model.

   The telescope page in SpaceRadio seats thousands of fasteners on a surface with an instanced
   sphere and a cylinder: one draw call, real material, and a scale that comes from the part rather
   than from a constant. This does the same for any Kosmo model, procedural or GLB, but it only
   touches parts that are actually bodies of revolution:

     * a part is a candidate only when two of its bounding-box spans agree (a round cross-section)
       and the third is longer than either -- a tank, a module, a mast, not a spar, a plate or a
       flat ring, whose "radius" would be half a length and would draw a hoop in mid-air,
     * the radius is read off the vertices, not the box, because a booster's box spans its fins,
     * seam rings are placed along that part's own axis, perpendicular to it, so a horizontal
       cylinder gets rings across its length and not around its bounding box,
     * rivets sit on those seams at a spacing and size that follow the part's radius,

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
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const TORUS_AXIS = new THREE.Vector3(0, 0, 1);   // TorusGeometry lies in its own XY plane

/**
 * Median and 90th-percentile distance of a mesh's vertices from its own axis, in world units. A
 * clean body of revolution has p90 close to the median; anything with fins, struts or a taper does
 * not, and is left alone.
 */
function radialProfile(mesh, centre, lat) {
  const pos = mesh.geometry?.attributes?.position;
  if (!pos) return null;
  const stride = Math.max(1, Math.floor(pos.count / 800));
  const rs = [];
  for (let i = 0; i < pos.count; i += stride) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    const du = _p.getComponent(lat[0]) - centre.getComponent(lat[0]);
    const dv = _p.getComponent(lat[1]) - centre.getComponent(lat[1]);
    const r = Math.hypot(du, dv);
    if (Number.isFinite(r)) rs.push(r);
  }
  if (rs.length < 8) return null;
  rs.sort((a, b) => a - b);
  return { median: rs[Math.floor(rs.length / 2)], p90: rs[Math.floor(rs.length * 0.9)] };
}

/**
 * Add rivet rings and seam rings to `root`. Returns the group it created (already a child), so the
 * caller can show/hide it. Calling twice would double the detail, so keep the returned group.
 *
 * `minFraction` is the smallest part, as a fraction of the model span, worth detailing: below that
 * a part is a greeble or a fastener and rings on it would only add noise.
 */
export function addSurfaceDetail(root, { on = true, minFraction = 0.04 } = {}) {
  const group = new THREE.Group();
  group.name = 'surface-detail';
  group.userData.detail = true;

  root.updateMatrixWorld(true);
  /* The model's own `userData.box` is the hull (the viewer frames it); a raw Box3 would also take
     in a deployed sail and make every threshold a sail-length. */
  const own = root.userData.box;
  const size = own && Number.isFinite(own.min.x) ? own.getSize(new THREE.Vector3()) : new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;

  const rivets = [];
  const seams = [];
  let parts = 0;

  /* QA pass: a candidate is a mesh whose GEOMETRY says it is a cylinder -- CylinderGeometry with equal
     radii, or a hull-segment barrel -- read through its own transform. The bounding-box inference that
     stood here hooped the 16U box bus, the grid fins, the leg struts and the pusher-plate magazine (at
     the wrong centre), which is exactly the "rings at weird angles" a reviewer sees. Instanced meshes,
     glazing, film and anything under the detail layer are left alone. */
  const _rq = new THREE.Quaternion(), _rp = new THREE.Vector3(), _rs = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.detail) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || (mat.transparent && (mat.opacity ?? 1) < 0.85)) return;   // film and glazing: no rivets
    const P = o.geometry?.parameters;
    if (!P || o.geometry.type !== 'CylinderGeometry') return;
    const rT = P.radiusTop ?? 0, rB = P.radiusBottom ?? 0;
    if (Math.abs(rT - rB) > Math.max(rT, rB) * 0.1 || (P.thetaLength ?? Math.PI * 2) < Math.PI * 1.9) return; // cones and part shells: no seams
    o.matrixWorld.decompose(_rp, _rq, _rs);
    const radius = Math.max(rT, rB) * Math.max(_rs.x, _rs.z), length = P.height * _rs.y;
    if (!Number.isFinite(radius + length) || radius < span * 0.004 || radius < 0.25) return;   // too thin to carry a seam
    if (length < radius * 1.2) return;                                  // a disc, not a body
    if (Math.max(2 * radius, length) < span * minFraction) return;      // greebles and fasteners
    const eA = new THREE.Vector3(0, 1, 0).applyQuaternion(_rq).normalize();
    const eU = new THREE.Vector3(1, 0, 0).applyQuaternion(_rq).normalize();
    const eV = new THREE.Vector3().crossVectors(eA, eU).normalize();
    const qt = new THREE.Quaternion().setFromUnitVectors(TORUS_AXIS, eA);
    /* the geometry's own centre along its axis (the builders translate barrels to base at y = 0) */
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    const c = new THREE.Vector3((gb.min.x + gb.max.x) / 2, (gb.min.y + gb.max.y) / 2, (gb.min.z + gb.max.z) / 2).applyMatrix4(o.matrixWorld);

    const rivetR = Math.min(Math.max(radius * 0.01, span * 0.0007), span * 0.0016);
    const seamT = rivetR * 0.55;
    const count = Math.max(8, Math.min(40, Math.round((2 * Math.PI * radius) / (rivetR * 9))));
    const fractions = length < radius * 1.6 ? [0.5] : [0.25, 0.5, 0.75];

    for (const f of fractions) {
      const along = (f - 0.5) * length;
      const seamP = c.clone().addScaledVector(eA, along);
      if (!Number.isFinite(seamP.x + seamP.y + seamP.z)) continue;
      seams.push({ p: seamP, q: qt, r: radius, t: seamT });
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        const p = seamP.clone()
          .addScaledVector(eU, Math.cos(a) * radius)
          .addScaledVector(eV, Math.sin(a) * radius);
        if (Number.isFinite(p.x + p.y + p.z)) rivets.push({ p, r: rivetR });
      }
    }
    parts += 1;
  });

  if (rivets.length) {
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), RIVET_MAT, rivets.length);
    inst.userData.detail = true;
    rivets.forEach((it, i) => {
      root.worldToLocal(_p.copy(it.p));
      _q.identity();
      _s.set(it.r, it.r * 0.6, it.r);      // a dome head, not a bead
      inst.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  if (seams.length) {
    const inst = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.012, 4, 48), SEAM_MAT, seams.length);
    inst.userData.detail = true;
    seams.forEach((it, i) => {
      root.worldToLocal(_p.copy(it.p));
      _q.copy(it.q);
      _s.set(it.r, it.r, Math.max(it.t / 0.012, 0.05));
      inst.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  group.userData.parts = parts;
  group.userData.rivets = rivets.length;
  group.userData.seams = seams.length;
  group.visible = on;
  root.add(group);
  return group;
}
