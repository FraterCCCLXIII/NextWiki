/* primitives/legacy.js -- the colour-keyed helpers the v3 catalogue CAD was written with.

   v4 rebuilt parts/centauri-models.js on primitives/mesh.js, whose helpers take a surface *kind*
   ('white', 'mli', ...) from primitives/materials.js. parts/robotic-models.js (v5) was written against
   the older helpers, which take a hex colour and a { metal, rough, emissive, alpha } option bag. These
   are those helpers, kept in one place so v5 draws exactly what it drew, and so a later pass can move
   it onto the surface presets one builder at a time. Imports three. */

import * as THREE from 'three';

export const CO = {
  shell: 0xe9edf2, mli: 0xd9cfae, metal: 0xc3c8cf, dark: 0x4a4f57, glass: 0x27435f,
  film: 0x9fd0ff, array: 0x1d2c55, rad: 0xe4e0d6, gold: 0xc9a24b, grey: 0x9aa3ad,
  tank: 0xb9c0c8, accent: 0xc4642a, hatch: 0x8d959e
};

/* Which surface each legacy colour stands for, so the livery and detail passes can treat a v5 hull like a
   v4 hull: shells are paintable, tanks are paintable, gold MLI and dark fittings are not. */
const SURFACE_OF = { [CO.shell]: 'white', [CO.tank]: 'tank', [CO.mli]: 'offwhite', [CO.metal]: 'grey', [CO.hatch]: 'hatch', [CO.gold]: 'gold', [CO.dark]: 'dark', [CO.grey]: 'grey', [CO.rad]: 'radiator', [CO.glass]: 'glass', [CO.array]: 'cell', [CO.film]: 'film', 0xf2f4f7: 'white', 0xdfe6ee: 'white' };

const cache = new Map();
export function mat(c, o = {}) {
  const k = `${c}|${o.metal ?? ''}|${o.rough ?? ''}|${o.emissive ?? ''}|${o.alpha ?? ''}`;
  if (!cache.has(k)) {
    const m = new THREE.MeshStandardMaterial({
      color: c, metalness: o.metal ?? 0.18, roughness: o.rough ?? 0.5, emissive: o.emissive ?? 0x000000,
      side: THREE.DoubleSide, transparent: o.alpha != null, opacity: o.alpha ?? 1
    });
    m.userData.surface = o.alpha != null ? 'glass' : (SURFACE_OF[c] ?? 'dark');
    cache.set(k, m);
  }
  return cache.get(k);
}
export const mesh = (g, c, o) => new THREE.Mesh(g, mat(c, o));

/* ---- primitives, metres, +y up, base at y = 0 ---- */
export const cyl = (r, h, c, o = {}) => { const g = new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg ?? 24, 1, !!o.open); g.translate(0, h / 2, 0); return mesh(g, c, o.mat); };
export const box = (w, h, d, c, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), c, o.mat);
export const tor = (r, tube, c, o = {}) => mesh(new THREE.TorusGeometry(r, tube, o.rad ?? 10, o.tseg ?? 48), c, o.mat);
export const sph = (r, c, o = {}) => mesh(new THREE.SphereGeometry(r, o.seg ?? 20, o.rseg ?? 14), c, o.mat);
export const put = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

export function rod(g, a, b, r, c, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B) || 1e-6;
  const m = cyl(r, L, c, { seg: o.seg ?? 8, mat: o.mat });
  m.position.copy(A);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.add(m);
  return m;
}

/* A ring lying in the part's xz plane (normal +y): end domes, hatch frames, ribs. */
export function ringXZ(r, tube, c, y = 0) {
  const m = tor(r, tube, c, { metal: 0.55, rough: 0.35 });
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  return m;
}
