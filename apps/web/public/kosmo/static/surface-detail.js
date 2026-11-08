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

  root.traverse((o) => {
    if (!o.isMesh || o.userData.detail) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || (mat.transparent && (mat.opacity ?? 1) < 0.85)) return;   // film and glazing: no rivets
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox) return;
    const bb = new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);   // this mesh only, not its children
    const s = bb.getSize(new THREE.Vector3());
    const dims = [s.x, s.y, s.z];
    if (!Number.isFinite(dims[0] + dims[1] + dims[2])) return;
    if (Math.max(...dims) < span * minFraction) return;                   // greebles and fasteners

    // Axis of revolution: the long span, with the other two within a quarter of each other. A spar
    // or a plate fails this and gets nothing -- that is the whole point of the test.
    let axis = 0;
    if (dims[1] > dims[axis]) axis = 1;
    if (dims[2] > dims[axis]) axis = 2;
    const lat = [0, 1, 2].filter((i) => i !== axis);
    const l0 = dims[lat[0]], l1 = dims[lat[1]];
    if (Math.abs(l0 - l1) > Math.max(l0, l1) * 0.25) return;

    const c = bb.getCenter(new THREE.Vector3());
    /* Read the radius off the vertices, not off the box: a booster's box spans its fins, so the box
       radius would draw the ring frames nine metres out in the air. The profile also rejects parts
       whose surface sits at many radii at once (fins, struts, a conical adapter). */
    const prof = radialProfile(o, c, lat);
    if (!prof) return;
    const radius = prof.median;
    if (radius < span * 0.004) return;                                    // too thin to carry a seam
    if (dims[axis] < radius * 1.2) return;                                // a disc or a sphere, not a body
    if (prof.p90 > radius * 1.25) return;                                 // fins or a cone, not a body

    const eA = AXES[axis];
    const eU = AXES[lat[0]];
    const eV = AXES[lat[1]];
    const qt = new THREE.Quaternion().setFromUnitVectors(TORUS_AXIS, eA);
    const minA = bb.min.getComponent(axis), midA = c.getComponent(axis);

    const rivetR = Math.min(Math.max(radius * 0.01, span * 0.0007), span * 0.0016);
    const seamT = rivetR * 0.55;
    const count = Math.max(8, Math.min(40, Math.round((2 * Math.PI * radius) / (rivetR * 9))));
    const fractions = dims[axis] < radius * 1.6 ? [0.5] : [0.25, 0.5, 0.75];

    for (const f of fractions) {
      const along = minA + dims[axis] * f - midA;
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
