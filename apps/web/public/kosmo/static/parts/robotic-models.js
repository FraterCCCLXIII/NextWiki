/* robotic-models.js -- the v5 Centauri ships and their robots, as CAD built from the solved assembly.

   Same rule as centauri-models.js: nothing is posed by hand. parts/robotic.js solves the ship from its
   mates and this module draws what the solver placed, with a builder per new part kind -- a hangar
   whose shell is cut away so the cradles and the robots in them show, a torpor ring with its pods and
   its shielded shelter band, an observation deck with its immersion pods and wall, a fabrication bay
   with its feedstock drums, the compute racks on the outside of the modules, the rails along the hull
   with the crawlers on them -- and a builder per robot class, parametric in the robot's own height so
   a 1.72 m humanoid stands next to the 1.8 m person at true size.

   Everything the v1-v3 catalogue already draws (modules, nodes, radiators, bearings, drives, the ring
   shell) comes from centauri-models.js through centauriPart(), so a v5 ship and a v2 ship are drawn
   by the same hands. Imports three. */

import * as THREE from 'three';
import { measureRobotic, ROBOTS, designById } from './robotic.js';
import { centauriPart, addPortRing, BUILDERS, span } from './centauri-models.js';
import { CO, mat, mesh, cyl, box, tor, sph, put, rod, ringXZ } from './primitives/legacy.js';

const RC = { white: 0xf2f4f7, dark: 0x2b2f36, blue: 0x3a9bff, gold: 0xd8b25a, lens: 0x16212e, glass: 0x27435f, warn: 0xc4642a, deck: 0xe4e0d6, shield: 0x5f6670, screen: 0x7fc3ff, pod: 0xdfe6ee };
const M = {
  white: { metal: 0.25, rough: 0.35 }, dark: { metal: 0.6, rough: 0.4 }, gold: { metal: 0.7, rough: 0.3 }, lens: { metal: 0.9, rough: 0.1 },
  glass: { metal: 0.3, rough: 0.15, alpha: 0.55 }, screen: { metal: 0.1, rough: 0.2, emissive: 0x1d4f7a }, shield: { metal: 0.45, rough: 0.6 }
};
const capsule = (r, h, c, o = {}) => mesh(new THREE.CapsuleGeometry(r, Math.max(h - 2 * r, 1e-4), 6, 14), c, o);
const rbox = (w, h, d, c, o = {}) => { const m = box(w, h, d, c, { mat: o }); return m; };

/* ------------------------------------------------------------------ *
 * Robots: one builder per class, feet (or base) at y = 0, +y up
 * ------------------------------------------------------------------ */

/* A humanoid: pelvis, torso, head with a visor, two arms with elbow joints, two legs with knees. The
   proportions are a person's (shoulder at 0.82 h, hip at 0.5 h, head 0.13 h); `eva` adds a life-pack
   sized backpack of batteries and thermal control, MLI colouring and a hardened sensor head. */
function humanoid(h, eva) {
  const g = new THREE.Group();
  const skin = eva ? RC.gold : RC.white, skinM = eva ? M.gold : M.white;
  const limbR = h * 0.045, jointR = limbR * 1.25;
  const hip = h * 0.5, shoulder = h * 0.82, hipW = h * 0.1, shW = h * 0.14;
  /* legs */
  for (const s of [-1, 1]) {
    const x = s * hipW;
    rod(g, [x, hip - 0.02, 0], [x, hip * 0.52, 0], limbR, skin, { mat: skinM, seg: 12 });
    put(sph(jointR, RC.dark, { mat: M.dark, seg: 12 }), x, hip * 0.52, 0); g.add(g.children[g.children.length - 1]);
    rod(g, [x, hip * 0.52, 0], [x, h * 0.05, 0], limbR * 0.9, skin, { mat: skinM, seg: 12 });
    const foot = rbox(limbR * 2.2, h * 0.04, limbR * 4.2, RC.dark, M.dark); put(foot, x, h * 0.02, limbR * 1.2); g.add(foot);
  }
  /* pelvis, torso, chest plate */
  const pelvis = rbox(hipW * 2.6, h * 0.08, h * 0.12, RC.dark, M.dark); put(pelvis, 0, hip + h * 0.02, 0); g.add(pelvis);
  const torso = capsule(h * 0.1, shoulder - hip - h * 0.02, skin, skinM); put(torso, 0, (shoulder + hip) / 2 + h * 0.01, 0); g.add(torso);
  const chest = rbox(h * 0.17, h * 0.16, h * 0.06, eva ? RC.dark : RC.blue, eva ? M.dark : M.white); put(chest, 0, shoulder - h * 0.1, h * 0.08); g.add(chest);
  const lamp = rbox(h * 0.03, h * 0.02, h * 0.01, RC.screen, M.screen); put(lamp, 0, shoulder - h * 0.06, h * 0.115); g.add(lamp);
  /* shoulders and arms, hanging slightly forward */
  for (const s of [-1, 1]) {
    const x = s * shW;
    put(sph(jointR * 1.1, RC.dark, { mat: M.dark, seg: 12 }), x, shoulder, 0); g.add(g.children[g.children.length - 1]);
    rod(g, [x, shoulder, 0], [x * 1.05, shoulder - h * 0.17, h * 0.02], limbR * 0.9, skin, { mat: skinM, seg: 12 });
    put(sph(jointR, RC.dark, { mat: M.dark, seg: 12 }), x * 1.05, shoulder - h * 0.17, h * 0.02); g.add(g.children[g.children.length - 1]);
    rod(g, [x * 1.05, shoulder - h * 0.17, h * 0.02], [x * 1.05, shoulder - h * 0.33, h * 0.07], limbR * 0.8, skin, { mat: skinM, seg: 12 });
    const hand = rbox(limbR * 1.6, h * 0.06, limbR * 1.2, RC.dark, M.dark); put(hand, x * 1.05, shoulder - h * 0.36, h * 0.08); g.add(hand);
    for (let f = 0; f < 3; f += 1) rod(g, [x * 1.05 + (f - 1) * limbR * 0.55, shoulder - h * 0.39, h * 0.08], [x * 1.05 + (f - 1) * limbR * 0.55, shoulder - h * 0.43, h * 0.09], limbR * 0.2, RC.dark, { mat: M.dark, seg: 6 });
  }
  /* neck, head, visor */
  rod(g, [0, shoulder + h * 0.01, 0], [0, shoulder + h * 0.05, 0], limbR * 0.7, RC.dark, { mat: M.dark, seg: 10 });
  const head = eva ? rbox(h * 0.13, h * 0.13, h * 0.13, RC.dark, M.dark) : sph(h * 0.065, skin, { mat: skinM, seg: 18, rseg: 12 });
  put(head, 0, shoulder + h * 0.115, 0); g.add(head);
  const visor = rbox(h * 0.11, h * 0.035, h * 0.02, RC.lens, M.lens); put(visor, 0, shoulder + h * 0.125, h * 0.06); g.add(visor);
  if (eva) {
    const pack = rbox(h * 0.2, h * 0.3, h * 0.1, RC.white, M.white); put(pack, 0, shoulder - h * 0.14, -h * 0.1); g.add(pack);
    for (let i = 0; i < 3; i += 1) { const fin = rbox(h * 0.2, h * 0.004, h * 0.06, RC.deck, M.white); put(fin, 0, shoulder - h * 0.26 + i * h * 0.1, -h * 0.17); g.add(fin); }
    for (const s of [-1, 1]) { const l = cyl(h * 0.012, h * 0.03, RC.screen, { seg: 10, mat: M.screen }); put(l, s * h * 0.07, shoulder + h * 0.16, h * 0.04); g.add(l); }
  }
  return g;
}

/* An Astrobee-class free-flyer: a cube with a fan ring on four faces, a camera face, a perching arm. */
function freeFlyer(s) {
  const g = new THREE.Group();
  const body = rbox(s, s, s, RC.white, M.white); put(body, 0, s / 2, 0); g.add(body);
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const fan = tor(s * 0.3, s * 0.035, RC.dark, { mat: M.dark });
    fan.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(ax, 0, az));
    put(fan, ax * s * 0.52, s / 2, az * s * 0.52, fan.rotation.x, fan.rotation.y, fan.rotation.z); g.add(fan);
    const grille = cyl(s * 0.27, s * 0.02, RC.lens, { seg: 16, mat: M.lens }); grille.quaternion.copy(fan.quaternion); grille.rotateX(Math.PI / 2); grille.position.set(ax * s * 0.51, s / 2, az * s * 0.51); g.add(grille);
  }
  const face = rbox(s * 0.7, s * 0.5, s * 0.03, RC.lens, M.lens); put(face, 0, s * 0.55, s * 0.5); g.add(face);
  const eye = cyl(s * 0.07, s * 0.05, RC.screen, { seg: 12, mat: M.screen }); put(eye, -s * 0.2, s * 0.6, s * 0.52, Math.PI / 2); g.add(eye);
  rod(g, [0, s * 0.1, -s * 0.5], [0, s * 0.1, -s * 0.9], s * 0.03, RC.dark, { mat: M.dark, seg: 8 });
  const grip = rbox(s * 0.16, s * 0.08, s * 0.1, RC.warn, M.dark); put(grip, 0, s * 0.1, -s * 0.95); g.add(grip);
  return g;
}

/* An AERCam-class EVA inspector: a sphere with twelve cold-gas nozzles, two cameras and a lamp. */
function inspector(d) {
  const g = new THREE.Group(), r = d / 2;
  const body = sph(r, RC.white, { mat: M.white, seg: 24, rseg: 16 }); put(body, 0, r, 0); g.add(body);
  g.add(put(ringXZ(r * 0.98, r * 0.03, RC.dark, r), 0, r, 0));
  for (let i = 0; i < 12; i += 1) {
    const th = (i / 12) * Math.PI * 2, ph = i % 2 ? 0.6 : -0.6;
    const dir = new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph));
    const n = mesh(new THREE.CylinderGeometry(r * 0.03, r * 0.07, r * 0.1, 10, 1, true), RC.dark, M.dark);
    n.position.copy(dir.clone().multiplyScalar(r * 1.02)).add(new THREE.Vector3(0, r, 0));
    n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(n);
  }
  for (const s of [-1, 1]) { const cam = cyl(r * 0.1, r * 0.08, RC.lens, { seg: 12, mat: M.lens }); put(cam, s * r * 0.3, r * 1.05, r * 0.92, Math.PI / 2); g.add(cam); }
  const lamp = cyl(r * 0.08, r * 0.05, RC.screen, { seg: 12, mat: M.screen }); put(lamp, 0, r * 0.8, r * 0.97, Math.PI / 2); g.add(lamp);
  return g;
}

/* A rail crawler, built along +y (radially outward from the hull): the carriage straddles the rail at
   the base, four wheels grip it, a turret carries two jointed arms and a lamp. */
function crawler(l, w) {
  const g = new THREE.Group();
  const base = rbox(w, l * 0.18, w * 0.8, RC.dark, M.dark); put(base, 0, l * 0.09, 0); g.add(base);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const wheel = cyl(l * 0.08, w * 0.08, RC.gold, { seg: 14, mat: M.gold }); put(wheel, x * w * 0.46, l * 0.06, z * w * 0.3, 0, 0, Math.PI / 2); g.add(wheel); }
  const body = rbox(w * 0.8, l * 0.34, w * 0.6, RC.white, M.white); put(body, 0, l * 0.35, 0); g.add(body);
  const stripe = rbox(w * 0.82, l * 0.05, w * 0.62, RC.warn, M.white); put(stripe, 0, l * 0.22, 0); g.add(stripe);
  const turret = cyl(w * 0.22, l * 0.1, RC.dark, { seg: 16, mat: M.dark }); put(turret, 0, l * 0.52, 0); g.add(turret);
  for (const s of [-1, 1]) {
    const x0 = s * w * 0.3;
    rod(g, [x0, l * 0.6, 0], [s * w * 0.7, l * 0.85, w * 0.2], w * 0.05, RC.white, { mat: M.white, seg: 10 });
    put(sph(w * 0.07, RC.dark, { mat: M.dark, seg: 10 }), s * w * 0.7, l * 0.85, w * 0.2); g.add(g.children[g.children.length - 1]);
    rod(g, [s * w * 0.7, l * 0.85, w * 0.2], [s * w * 0.95, l * 1.0, w * 0.55], w * 0.04, RC.white, { mat: M.white, seg: 10 });
    const tool = rbox(w * 0.1, w * 0.1, w * 0.14, RC.gold, M.gold); put(tool, s * w * 0.97, l * 1.01, w * 0.6); g.add(tool);
  }
  const cam = rbox(w * 0.14, w * 0.1, w * 0.1, RC.lens, M.lens); put(cam, 0, l * 0.6, w * 0.3); g.add(cam);
  const lamp = cyl(w * 0.05, w * 0.03, RC.screen, { seg: 10, mat: M.screen }); put(lamp, 0, l * 0.62, w * 0.37, Math.PI / 2); g.add(lamp);
  return g;
}

/* Dextre: a body on a grapple fixture, two 3.5 m arms of two booms each, tool holsters. */
function dextre(h, w) {
  const g = new THREE.Group();
  g.add(put(cyl(w * 0.18, h * 0.08, RC.gold, { seg: 16, mat: M.gold }), 0, 0, 0));
  g.add(put(cyl(w * 0.14, h * 0.5, RC.white, { seg: 16, mat: M.white }), 0, h * 0.08, 0));
  const head = rbox(w * 0.5, h * 0.14, w * 0.4, RC.white, M.white); put(head, 0, h * 0.63, 0); g.add(head);
  for (const s of [-1, 1]) {
    const x0 = s * w * 0.27, y0 = h * 0.6;
    put(sph(w * 0.09, RC.dark, { mat: M.dark, seg: 12 }), x0, y0, 0); g.add(g.children[g.children.length - 1]);
    rod(g, [x0, y0, 0], [s * w * 0.95, y0 - h * 0.25, w * 0.1], w * 0.06, RC.white, { mat: M.white, seg: 12 });
    put(sph(w * 0.08, RC.dark, { mat: M.dark, seg: 12 }), s * w * 0.95, y0 - h * 0.25, w * 0.1); g.add(g.children[g.children.length - 1]);
    rod(g, [s * w * 0.95, y0 - h * 0.25, w * 0.1], [s * w * 0.75, y0 - h * 0.62, w * 0.35], w * 0.05, RC.white, { mat: M.white, seg: 12 });
    const eff = rbox(w * 0.14, w * 0.14, w * 0.2, RC.gold, M.gold); put(eff, s * w * 0.74, y0 - h * 0.66, w * 0.4); g.add(eff);
  }
  for (let i = 0; i < 3; i += 1) { const holster = rbox(w * 0.1, h * 0.1, w * 0.1, RC.dark, M.dark); put(holster, (i - 1) * w * 0.14, h * 0.4, -w * 0.18); g.add(holster); }
  const cam = rbox(w * 0.2, w * 0.1, w * 0.1, RC.lens, M.lens); put(cam, 0, h * 0.68, w * 0.22); g.add(cam);
  return g;
}

/* ERA: two long booms, a central elbow, a wrist and an end-effector at each end so it can walk. */
function era(l, d) {
  const g = new THREE.Group(), r = d * 0.5;
  g.add(put(cyl(r * 0.9, l * 0.05, RC.gold, { seg: 14, mat: M.gold }), 0, 0, 0));
  rod(g, [0, l * 0.05, 0], [l * 0.12, l * 0.5, 0], r * 0.5, RC.white, { mat: M.white, seg: 12 });
  put(sph(r * 0.8, RC.dark, { mat: M.dark, seg: 14 }), l * 0.12, l * 0.5, 0); g.add(g.children[g.children.length - 1]);
  rod(g, [l * 0.12, l * 0.5, 0], [0, l * 0.95, 0], r * 0.45, RC.white, { mat: M.white, seg: 12 });
  g.add(put(cyl(r * 0.8, l * 0.05, RC.gold, { seg: 14, mat: M.gold }), 0, l * 0.95, 0));
  for (const y of [l * 0.25, l * 0.75]) { const cam = rbox(r * 0.5, r * 0.4, r * 0.4, RC.lens, M.lens); put(cam, l * 0.06 * (y < l / 2 ? 1 : 1), y, r * 0.7); g.add(cam); }
  return g;
}

/* A fabrication cell: a glazed build chamber, a feedstock spool and a powder drum beside it, vents. */
function fabCell(l, w) {
  const g = new THREE.Group();
  const frame = rbox(w, l, w, RC.dark, M.dark); put(frame, 0, l / 2, 0); g.add(frame);
  const chamber = rbox(w * 0.84, l * 0.5, w * 0.84, RC.white, M.white); put(chamber, 0, l * 0.6, 0); g.add(chamber);
  const window = rbox(w * 0.6, l * 0.3, w * 0.02, RC.glass, M.glass); put(window, 0, l * 0.62, w * 0.43); g.add(window);
  const glow = rbox(w * 0.3, l * 0.03, w * 0.3, RC.warn, { metal: 0.2, rough: 0.5, emissive: 0x6a2a08 }); put(glow, 0, l * 0.37, 0); g.add(glow);
  const spool = cyl(w * 0.22, w * 0.18, RC.gold, { seg: 18, mat: M.gold }); put(spool, w * 0.62, l * 0.75, 0, 0, 0, Math.PI / 2); g.add(spool);
  const drum = cyl(w * 0.2, l * 0.3, CO.tank, { seg: 16, mat: M.white }); put(drum, -w * 0.62, l * 0.1, 0); g.add(drum);
  for (let i = 0; i < 4; i += 1) { const vent = rbox(w * 0.6, l * 0.012, w * 0.03, RC.deck, M.white); put(vent, 0, l * 0.1 + i * l * 0.05, w * 0.5); g.add(vent); }
  const panel = rbox(w * 0.3, l * 0.12, w * 0.02, RC.screen, M.screen); put(panel, w * 0.25, l * 0.2, w * 0.5); g.add(panel);
  return g;
}

/* A medical robot: a cart with three slim arms over a patient bed line, a display, a drug carousel. */
function medBot(l, w) {
  const g = new THREE.Group();
  const cart = rbox(w, l * 0.3, w * 0.7, RC.white, M.white); put(cart, 0, l * 0.15, 0); g.add(cart);
  const mast = cyl(w * 0.08, l * 0.5, RC.dark, { seg: 12, mat: M.dark }); put(mast, -w * 0.3, l * 0.3, 0); g.add(mast);
  const boom = rbox(w * 1.1, w * 0.08, w * 0.08, RC.white, M.white); put(boom, 0.1 * w, l * 0.8, 0); g.add(boom);
  for (let i = 0; i < 3; i += 1) {
    const x = -w * 0.2 + i * w * 0.3;
    rod(g, [x, l * 0.78, 0], [x + w * 0.05, l * 0.55, w * 0.15], w * 0.03, RC.white, { mat: M.white, seg: 10 });
    put(sph(w * 0.04, RC.dark, { mat: M.dark, seg: 10 }), x + w * 0.05, l * 0.55, w * 0.15); g.add(g.children[g.children.length - 1]);
    rod(g, [x + w * 0.05, l * 0.55, w * 0.15], [x + w * 0.1, l * 0.38, w * 0.3], w * 0.022, RC.white, { mat: M.white, seg: 10 });
  }
  const screen = rbox(w * 0.4, l * 0.18, w * 0.02, RC.screen, M.screen); put(screen, -w * 0.3, l * 0.68, w * 0.1, -0.3); g.add(screen);
  const carousel = cyl(w * 0.18, l * 0.12, RC.gold, { seg: 16, mat: M.gold }); put(carousel, w * 0.3, l * 0.3, -w * 0.15); g.add(carousel);
  return g;
}

/* A stowage robot: a low drive with a lifting mast and a cargo-transfer-bag tote on the forks. */
function cargoBot(l, w) {
  const g = new THREE.Group();
  const drive = rbox(w, l * 0.25, w * 0.9, RC.warn, M.white); put(drive, 0, l * 0.125, 0); g.add(drive);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const wheel = cyl(l * 0.08, w * 0.1, RC.dark, { seg: 14, mat: M.dark }); put(wheel, x * w * 0.4, l * 0.08, z * w * 0.38, 0, 0, Math.PI / 2); g.add(wheel); }
  const mast = rbox(w * 0.14, l * 0.7, w * 0.14, RC.dark, M.dark); put(mast, -w * 0.4, l * 0.6, 0); g.add(mast);
  const forks = rbox(w * 0.8, w * 0.04, w * 0.6, RC.dark, M.dark); put(forks, 0.05 * w, l * 0.45, 0); g.add(forks);
  const tote = rbox(w * 0.7, l * 0.4, w * 0.55, RC.white, M.white); put(tote, 0.1 * w, l * 0.68, 0); g.add(tote);
  const label = rbox(w * 0.3, l * 0.08, w * 0.01, RC.screen, M.screen); put(label, 0.1 * w, l * 0.7, w * 0.28); g.add(label);
  return g;
}

/* A 6U scout: a cubesat with a deployable panel pair and a small dish. */
function scout(l, w) {
  const g = new THREE.Group();
  const body = rbox(w, l, w * 0.5, RC.gold, M.gold); put(body, 0, l / 2, 0); g.add(body);
  for (const s of [-1, 1]) { const panel = rbox(w * 1.4, l * 0.9, w * 0.02, CO.array, { metal: 0.4, rough: 0.3 }); put(panel, s * w * 1.2, l / 2, 0); g.add(panel); }
  const dish = mesh(new THREE.SphereGeometry(w * 0.3, 16, 8, 0, Math.PI * 2, 0, 0.8), RC.white, M.white); put(dish, 0, l * 1.05, 0); g.add(dish);
  return g;
}

function robotCAD(p) {
  const r = ROBOTS[p.robot];
  const l = p.dims.l, d = p.dims.d;
  let g;
  switch (p.robot) {
    case 'humanoid-iva': g = humanoid(l, false); break;
    case 'humanoid-eva': g = humanoid(l, true); break;
    case 'free-flyer-iva': g = freeFlyer(l); break;
    case 'inspector-eva': g = inspector(d); break;
    case 'crawler-rail': g = crawler(l, d); break;
    case 'arm-dextre': g = dextre(l, d); break;
    case 'arm-era': g = era(l, d); break;
    case 'fab-cell': g = fabCell(l, d); break;
    case 'med-bot': g = medBot(l, d); break;
    case 'cargo-bot': g = cargoBot(l, d); break;
    case 'scout': g = scout(l, d); break;
    default: g = humanoid(l, false);
  }
  g.userData.robot = p.robot;
  g.userData.name = r?.name ?? p.name;
  return { group: g };
}

/* ------------------------------------------------------------------ *
 * The v5 modules
 * ------------------------------------------------------------------ */

/* A pressure shell with a wedge cut away so the interior reads: `open` radians missing, centred on
   the part's local +z (where a three.js cylinder's theta starts). A backdrop deck sits behind the
   axis so the cradles and pods have something to stand against. End rings, MLI bands and handrails as
   the catalogue module has. */
function cutawayShell(L, r, open, colour = CO.mli) {
  const g = new THREE.Group();
  const arc = Math.PI * 2 - open;
  const shell = mesh(new THREE.CylinderGeometry(r, r, L, 48, 1, true, open / 2, arc), colour, { metal: 0.18, rough: 0.5 });
  shell.position.y = L / 2;
  g.add(shell);
  const deck = mesh(new THREE.BoxGeometry(r * 1.7, L * 0.98, 0.04), RC.deck, { metal: 0.2, rough: 0.7 });
  deck.position.set(0, L / 2, -r * 0.55);
  g.add(deck);
  for (let i = 1; i < Math.max(2, Math.round(L / 1.5)); i += 1) { const rib = mesh(new THREE.BoxGeometry(r * 1.7, 0.04, 0.08), CO.metal, { metal: 0.5 }); rib.position.set(0, (L * i) / Math.max(2, Math.round(L / 1.5)), -r * 0.52); g.add(rib); }
  g.add(ringXZ(r, Math.max(r * 0.03, 0.02), CO.metal, 0.05), ringXZ(r, Math.max(r * 0.03, 0.02), CO.metal, L - 0.05));
  for (let i = 1; i <= Math.max(1, Math.round(L / 2.3)); i += 1) {
    const band = mesh(new THREE.CylinderGeometry(r * 1.012, r * 1.012, L * 0.03, 48, 1, true, open / 2, arc), CO.gold, { metal: 0.5 });
    band.position.y = (L * i) / (Math.max(1, Math.round(L / 2.3)) + 1);
    g.add(band);
  }
  for (const a of [Math.PI * 0.75, Math.PI * 1.25]) {
    const rail = rod(g, [Math.cos(a) * r * 1.03, L * 0.2, Math.sin(a) * r * 1.03], [Math.cos(a) * r * 1.03, L * 0.8, Math.sin(a) * r * 1.03], r * 0.015, CO.metal);
    rail.userData.handrail = true;
  }
  return g;
}

/* The hangar: cutaway shell, a cradle frame with its charger block and umbilical at every cradle
   port, a dock plate at every dock port, maintenance benches, the quarantine bay's own door, the tool
   store, two external garage doors with their frames, the rail heads at the aft ring. */
function hangarCAD(p) {
  const L = p.dims.l, r = p.dims.d / 2, H = p.hangar ?? {};
  const g = cutawayShell(L, r, Math.PI * 0.75);
  for (const port of p.ports) {
    if (/^cradle-/.test(port.id)) {
      const [x, y, z] = port.at, side = Math.sign(x) || 1;
      const frame = new THREE.Group();
      const back = rbox(0.06, 2.0, 0.7, RC.dark, M.dark); put(back, side * 0.32, 1.0, 0); frame.add(back);
      for (const yy of [0.3, 1.7]) { const clamp = rbox(0.5, 0.05, 0.6, RC.dark, M.dark); put(clamp, side * 0.08, yy, 0); frame.add(clamp); }
      const charger = rbox(0.18, 0.3, 0.3, RC.gold, M.gold); put(charger, side * 0.36, 0.5, 0.45); frame.add(charger);
      const led = rbox(0.02, 0.04, 0.1, RC.screen, M.screen); put(led, side * 0.26, 0.62, 0.45); frame.add(led);
      rod(frame, [side * 0.3, 0.5, 0.45], [side * 0.1, 0.9, 0.1], 0.015, RC.warn, { seg: 6 });
      const plate = rbox(0.04, 1.2, 0.5, RC.deck, M.white); put(plate, side * 0.3, 1.1, -0.3); frame.add(plate);
      frame.position.set(x, y, z);
      g.add(frame);
    } else if (/^dock-/.test(port.id)) {
      const [x, y, z] = port.at;
      const plate = rbox(0.5, 0.04, 0.5, RC.dark, M.dark); put(plate, x, y - 0.02, z); g.add(plate);
      for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) rod(g, [x + dx, y - 0.02, z + dz], [x + dx, y + 0.1, z + dz], 0.015, RC.gold, { seg: 6 });
    }
  }
  /* the aisle strip down the middle, and the maintenance and quarantine bays at the fore end */
  const aisle = rbox(0.02, L * 0.9, (H.aisle ?? 1.2), RC.dark, M.dark); put(aisle, -r * 0.1, L / 2, 0); g.add(aisle);
  for (let i = 0; i < Math.min(H.maint ?? 1, 4); i += 1) {
    const bench = rbox(0.6, 0.5, 1.8, RC.white, M.white); put(bench, -r * 0.55, L - 0.6 - i * 0.6, (i % 2 ? 1 : -1) * r * 0.45); g.add(bench);
    const carousel = cyl(0.25, 0.3, RC.gold, { seg: 14, mat: M.gold }); put(carousel, -r * 0.55, L - 0.6 - i * 0.6, (i % 2 ? 1 : -1) * r * 0.45, 0, 0, Math.PI / 2); g.add(carousel);
  }
  const quarantine = rbox(0.06, 2.4, 2.2, RC.warn, M.white); put(quarantine, -r * 0.3, L - 1.3, -r * 0.5); g.add(quarantine);
  const qdoor = rbox(0.04, 2.0, 1.0, RC.dark, M.dark); put(qdoor, -r * 0.25, L - 1.3, -r * 0.5); g.add(qdoor);
  const tools = rbox(0.5, 1.8, 0.6, RC.dark, M.dark); put(tools, -r * 0.6, 1.2, r * 0.6); g.add(tools);
  for (let i = 0; i < 6; i += 1) { const t = rbox(0.08, 0.3, 0.08, RC.gold, M.gold); put(t, -r * 0.6 + 0.2, 0.6 + i * 0.25, r * 0.6 + (i % 2 ? 0.15 : -0.15)); g.add(t); }
  /* two external garage doors on the -x face, framed, with hinge bars and warning stripes */
  for (let i = 0; i < 2; i += 1) {
    const y = L * (0.3 + 0.4 * i);
    const door = rbox(0.08, Math.min(2.4, L * 0.3), 1.6, CO.hatch, M.white); put(door, -r * 1.02, y, 0); g.add(door);
    const frame = rbox(0.1, Math.min(2.6, L * 0.32), 1.8, CO.metal, M.dark); put(frame, -r * 1.01, y, 0); g.add(frame);
    const stripe = rbox(0.1, 0.08, 1.6, RC.warn, M.white); put(stripe, -r * 1.06, y + Math.min(1.1, L * 0.14), 0); g.add(stripe);
    rod(g, [-r * 1.06, y - 1, 0.9], [-r * 1.06, y + 1, 0.9], 0.03, CO.metal);
  }
  /* rail heads: two blocks at the aft ring where the crawlers pick up power and data */
  for (const s of [-1, 1]) { const head = rbox(0.5, 0.6, 0.8, RC.dark, M.dark); put(head, s * r * 0.75, 0.35, -r * 0.75); g.add(head); const lamp = rbox(0.1, 0.1, 0.1, RC.screen, M.screen); put(lamp, s * r * 0.75, 0.7, -r * 0.75); g.add(lamp); }
  return { group: g };
}

/* The robot lock: a box with its outer hatch framed at 1.2 x 2.2 m, a pressure indicator, grab bars. */
function lockCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, w = p.dims.d;
  g.add(put(rbox(w, L * 0.9, w, CO.mli, M.white), 0, L * 0.45, 0));
  const hatch = rbox(p.hatch?.w ?? 1.2, 0.08, p.hatch?.h ?? 2.2, CO.hatch, M.white); put(hatch, 0, L * 0.92, 0); g.add(hatch);
  const frame = rbox((p.hatch?.w ?? 1.2) + 0.2, 0.06, (p.hatch?.h ?? 2.2) + 0.2, CO.metal, M.dark); put(frame, 0, L * 0.9, 0); g.add(frame);
  const light = rbox(0.12, 0.06, 0.12, RC.screen, M.screen); put(light, w * 0.4, L * 0.96, w * 0.4); g.add(light);
  for (const s of [-1, 1]) rod(g, [s * w * 0.45, L * 0.2, w * 0.52], [s * w * 0.45, L * 0.8, w * 0.52], 0.02, CO.metal);
  g.add(ringXZ(w * 0.52, 0.03, CO.metal, 0.05));
  return { group: g };
}

/* The fab bay: a catalogue module shell with two feedstock drums and a spares pallet on external
   racks, a vent stack, and the cells inside visible through a window strip. */
function fabCAD(p) {
  const L = p.dims.l, r = p.dims.d / 2;
  const g = cutawayShell(L, r, Math.PI * 0.6, CO.shell);
  for (let i = 0; i < 2; i += 1) {
    const drum = cyl(r * 0.22, L * 0.35, CO.tank, { seg: 18, mat: M.white }); put(drum, -r * 0.9, L * (0.2 + i * 0.45), (i ? 1 : -1) * r * 0.55); g.add(drum);
    g.add(put(ringXZ(r * 0.225, 0.02, CO.gold, L * (0.2 + i * 0.45) + L * 0.17), -r * 0.9, 0, (i ? 1 : -1) * r * 0.55));
  }
  const pallet = rbox(0.6, L * 0.4, r * 0.8, RC.dark, M.dark); put(pallet, -r * 1.05, L * 0.5, 0); g.add(pallet);
  for (let i = 0; i < 5; i += 1) { const crate = rbox(0.5, L * 0.07, r * 0.7, RC.white, M.white); put(crate, -r * 1.05, L * 0.32 + i * L * 0.085, 0); g.add(crate); }
  const vent = cyl(r * 0.08, r * 0.5, RC.dark, { seg: 10, mat: M.dark }); put(vent, 0, L * 0.85, r * 0.95, Math.PI / 2); g.add(vent);
  const bench = rbox(0.8, 0.9, 2.4, RC.white, M.white); put(bench, -r * 0.5, L * 0.5, r * 0.4); g.add(bench);
  return { group: g };
}

/* The observation deck: cutaway shell, reclined immersion pods in a row, a curved wall display, the
   data theatre's console, the vault racks, and two cupola-class domes on the outside. */
function obsCAD(p) {
  const L = p.dims.l, r = p.dims.d / 2, O = p.obs ?? { pods: 3 };
  const g = cutawayShell(L, r, Math.PI * 0.7, CO.shell);
  const n = Math.min(O.pods, Math.max(2, Math.floor((L - 1.5) / 1.1)));
  for (let i = 0; i < n; i += 1) {
    const y = 0.9 + i * ((L - 1.8) / Math.max(n - 1, 1));
    const pod = new THREE.Group();
    const shell = mesh(new THREE.CapsuleGeometry(0.42, 1.2, 6, 14), RC.pod, M.white); shell.rotation.z = Math.PI / 2; shell.rotation.y = 0.35; pod.add(shell);
    const canopy = mesh(new THREE.SphereGeometry(0.44, 18, 10, 0, Math.PI), RC.glass, M.glass); canopy.rotation.y = -Math.PI / 2; canopy.position.set(0.4, 0.1, 0); pod.add(canopy);
    const base = rbox(1.4, 0.1, 0.9, RC.dark, M.dark); base.position.set(0, -0.45, 0); pod.add(base);
    const hmd = rbox(0.22, 0.1, 0.16, RC.lens, M.lens); hmd.position.set(0.55, 0.15, 0); pod.add(hmd);
    for (const s of [-1, 1]) { const glove = rbox(0.14, 0.08, 0.1, RC.blue, M.white); glove.position.set(0.1, -0.05, s * 0.3); pod.add(glove); }
    pod.position.set(-r * 0.25, y, (i % 2 ? 1 : -1) * r * 0.42);
    pod.rotation.y = (i % 2 ? 1 : -1) * 0.25;
    g.add(pod);
  }
  /* the wall: a curved display inside the shell on the -z side */
  const wall = mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, L * 0.7, 32, 1, true, Math.PI * 1.05, Math.PI * 0.55), RC.screen, M.screen);
  wall.position.y = L / 2; g.add(wall);
  const console = rbox(1.2, 0.9, 0.5, RC.dark, M.dark); put(console, -r * 0.5, L * 0.5, -r * 0.55); g.add(console);
  for (let i = 0; i < 3; i += 1) { const rack = rbox(0.5, 1.8, 0.6, RC.dark, M.dark); put(rack, -r * 0.65, 1.1, -r * 0.1 + i * 0.7); g.add(rack); const led = rbox(0.02, 1.4, 0.05, RC.screen, M.screen); put(led, -r * 0.39, 1.1, -r * 0.1 + i * 0.7); g.add(led); }
  for (const s of [-1, 1]) {
    const dome = mesh(new THREE.SphereGeometry(r * 0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), RC.glass, M.glass);
    put(dome, 0, L * (0.5 + s * 0.25), r * 0.95, Math.PI / 2); g.add(dome);
    g.add(put(ringXZ(r * 0.32, r * 0.025, CO.metal, 0), 0, L * (0.5 + s * 0.25), r * 0.95, Math.PI / 2));
    for (let k = 0; k < 6; k += 1) { const a = (k / 6) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.31, L * (0.5 + s * 0.25), r * 0.96], [Math.cos(a) * r * 0.05, L * (0.5 + s * 0.25), r * 0.95 + r * 0.31], r * 0.01, CO.metal, { seg: 5 }); }
  }
  return { group: g };
}

/* The seed vault: a module in heavy shield bands, a cryocooler radiator on the outside, LN2 dewars inside. */
function vaultCAD(p) {
  const L = p.dims.l, r = p.dims.d / 2;
  const g = cutawayShell(L, r, Math.PI * 0.55, RC.shield);
  for (let i = 0; i < 4; i += 1) {
    const band = mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, L * 0.12, 48, 1, true, Math.PI * 0.275, Math.PI * 1.45), RC.dark, M.shield);
    band.position.y = L * (0.15 + i * 0.23); g.add(band);
  }
  for (let i = 0; i < 4; i += 1) { const dewar = cyl(0.45, 1.6, CO.tank, { seg: 18, mat: M.white }); put(dewar, -r * 0.45, 0.4 + Math.floor(i / 2) * (L * 0.45), (i % 2 ? 1 : -1) * r * 0.5); g.add(dewar); g.add(put(ringXZ(0.46, 0.03, CO.gold, 1.5), -r * 0.45, 0.4 + Math.floor(i / 2) * (L * 0.45), (i % 2 ? 1 : -1) * r * 0.5)); }
  const rad = rbox(L * 0.6, 0.04, r * 0.9, CO.rad, { metal: 0.3, rough: 0.55 }); put(rad, 0, L * 0.5, -r * 1.3, 0, 0, Math.PI / 2); g.add(rad);
  rod(g, [0, L * 0.5, -r], [0, L * 0.5, -r * 1.3], 0.05, CO.metal);
  const cooler = rbox(0.6, 0.6, 0.5, RC.dark, M.dark); put(cooler, 0, L * 0.5, -r * 1.05); g.add(cooler);
  return { group: g };
}

/* The torpor ring, drawn as a design draft: a translucent pressure shell so the deck reads through
   it, the deck as an opaque annulus, the pods and the cockpits on it inside the shelter, the shelter
   itself as an opaque dark band of shell (the 500 kg/m2 of water-equivalent) over its stretch of the
   ring, six spokes and the hub. The ring lies in its own xz plane with +y the spin axis. */
function torporRingCAD(p) {
  const g = new THREE.Group();
  const D = Math.max(p.dims.l ?? 3, 1), tube = D / 2;
  const R = Math.max(((p.dims.d ?? 40) - D) / 2, tube);
  const ring = p.ring ?? {};
  const shellFrame = new THREE.Group();
  shellFrame.rotation.x = -Math.PI / 2;
  shellFrame.add(mesh(new THREE.TorusGeometry(R, tube, 18, 128), CO.shell, { metal: 0.25, rough: 0.5, alpha: 0.32 }));
  /* the shelter band: opaque, slightly proud of the shell */
  const shelterFrac = Math.min(0.75, (ring.shelterLengthM ?? 0) / (2 * Math.PI * R));
  const shelterArc = shelterFrac * Math.PI * 2;
  if (shelterFrac > 0) {
    shellFrame.add(mesh(new THREE.TorusGeometry(R, tube * 1.04, 18, 96, shelterArc), RC.shield, { metal: 0.45, rough: 0.6 }));
    for (const a of [0, shelterArc]) {
      const cap = mesh(new THREE.CylinderGeometry(tube * 1.05, tube * 1.05, 0.12, 24), RC.dark, M.dark);
      cap.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); cap.rotation.z = a; shellFrame.add(cap);
    }
  }
  g.add(shellFrame);
  /* deck: one annulus per deck, inner wall outward */
  const decks = Math.max(1, Math.floor((D - 1.2) / 3));
  const deckYs = [];
  for (let i = 0; i < decks; i += 1) {
    const y = -tube + 0.6 + i * 3;
    deckYs.push(y);
    const half = Math.sqrt(Math.max(tube * tube - y * y, 0.1));
    const floor = mesh(new THREE.RingGeometry(R - half * 0.95, R + half * 0.95, 128, 1), RC.deck, { metal: 0.2, rough: 0.7 });
    floor.rotation.x = -Math.PI / 2; floor.position.y = y; g.add(floor);
  }
  const deckY = deckYs[0];
  /* pods along the deck inside the shelter; cockpits after them; the awake quarters beyond */
  const pods = Math.min(p.pods ?? 0, 120);
  const rows = pods > 40 ? 2 : 1, perRow = Math.ceil(pods / rows);
  const podArc = Math.max(shelterArc * 0.7, Math.min(Math.PI * 1.2, pods * 1.0 / R));
  for (let i = 0; i < pods; i += 1) {
    const row = i % rows, k = Math.floor(i / rows);
    const a = 0.06 + ((k + 0.5) / Math.max(perRow, 1)) * podArc;
    const rr = R + (rows === 1 ? 0 : (row ? 1 : -1) * Math.min(tube * 0.35, 1.0));
    const pod = mesh(new THREE.CapsuleGeometry(0.4, 1.3, 5, 12), RC.pod, M.white);
    pod.position.set(Math.cos(a) * rr, deckY + 0.5, Math.sin(a) * rr);
    pod.rotation.set(Math.PI / 2, 0, -a);
    g.add(pod);
    const lid = mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), RC.glass, M.glass);
    lid.position.set(Math.cos(a) * rr, deckY + 0.7, Math.sin(a) * rr); lid.scale.set(1, 0.7, 2.4); lid.rotation.y = -a; g.add(lid);
    const base = rbox(1.9, 0.12, 0.95, RC.dark, M.dark); base.position.set(Math.cos(a) * rr, deckY + 0.06, Math.sin(a) * rr); base.rotation.y = -a; g.add(base);
    const monitor = rbox(0.05, 0.3, 0.4, RC.screen, M.screen); monitor.position.set(Math.cos(a) * rr, deckY + 0.9, Math.sin(a) * rr); monitor.rotation.y = -a; g.add(monitor);
  }
  const cockpits = Math.min(p.cockpits ?? 0, 24);
  for (let i = 0; i < cockpits; i += 1) {
    const a = 0.06 + podArc + 0.25 + (i / Math.max(cockpits, 1)) * Math.min(1.2, cockpits * 1.4 / R);
    const seat = rbox(0.7, 1.1, 0.8, RC.dark, M.dark); seat.position.set(Math.cos(a) * R, deckY + 0.55, Math.sin(a) * R); seat.rotation.y = -a; g.add(seat);
    for (const s of [-1, 1]) {
      const armX = Math.cos(a) * R + Math.cos(a + Math.PI / 2) * s * 0.5, armZ = Math.sin(a) * R + Math.sin(a + Math.PI / 2) * s * 0.5;
      const exo = rbox(0.12, 0.7, 0.12, RC.blue, M.white); exo.position.set(armX, deckY + 1.2, armZ); g.add(exo);
    }
    const hmd = rbox(0.3, 0.14, 0.25, RC.lens, M.lens); hmd.position.set(Math.cos(a) * R, deckY + 1.5, Math.sin(a) * R); hmd.rotation.y = -a; g.add(hmd);
    const screen = rbox(1.6, 1.0, 0.06, RC.screen, M.screen); screen.position.set(Math.cos(a) * (R + 0.9), deckY + 1.4, Math.sin(a) * (R + 0.9)); screen.rotation.y = -a + Math.PI / 2; g.add(screen);
  }
  /* awake quarters and the medical bay: bunks and a table beyond the cockpits */
  const awake = Math.min(p.awake ?? 0, 12);
  for (let i = 0; i < awake; i += 1) {
    const a = Math.PI * 1.25 + (i / Math.max(awake, 1)) * Math.min(0.6, awake * 0.9 / R);
    const bunk = rbox(2.0, 0.5, 0.9, RC.white, M.white); bunk.position.set(Math.cos(a) * R, deckY + 0.3, Math.sin(a) * R); bunk.rotation.y = -a; g.add(bunk);
  }
  /* spokes and hub */
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    rod(g, [Math.cos(a) * Math.max(tube * 0.9, 0.4), 0, Math.sin(a) * Math.max(tube * 0.9, 0.4)], [Math.cos(a) * R, 0, Math.sin(a) * R], Math.max(tube * 0.06, 0.1), CO.metal);
  }
  g.add(put(cyl(tube * 0.85, tube * 1.1, CO.shell, { seg: 24 }), 0, -tube * 0.55, 0));
  g.add(ringXZ(tube * 0.55, Math.max(tube * 0.03, 0.02), CO.metal, tube * 0.55));
  return { group: g };
}

/* A structural tank in the thrust path (consumables) or a palletised kit: tank with domes and bands,
   or a ribbed frame carrying crates on its outside. */
function storesCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, r = p.dims.d / 2, dome = Math.min(r * 0.5, L * 0.12);
  g.add(put(cyl(r, L - 2 * dome, CO.tank, { seg: 36 }), 0, dome, 0));
  g.add(put(cyl(r * 0.5, dome, CO.tank, { r2: r, seg: 36 }), 0, 0, 0));
  g.add(put(cyl(r, dome, CO.tank, { r2: r * 0.5, seg: 36 }), 0, L - dome, 0));
  for (let i = 1; i <= 4; i += 1) g.add(ringXZ(r * 1.005, Math.max(r * 0.02, 0.03), CO.gold, dome + ((L - 2 * dome) * i) / 5));
  for (let i = 0; i < 4; i += 1) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; rod(g, [Math.cos(a) * r * 1.02, dome, Math.sin(a) * r * 1.02], [Math.cos(a) * r * 1.02, L - dome, Math.sin(a) * r * 1.02], Math.max(r * 0.012, 0.02), CO.metal, { seg: 5 }); }
  const hatch = cyl(Math.min(r * 0.3, 0.6), 0.1, CO.hatch, { seg: 18 }); put(hatch, 0, L * 0.5, r * 0.98, Math.PI / 2); g.add(hatch);
  return { group: g };
}
function kitCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, r = p.dims.d / 2;
  g.add(put(cyl(r * 0.35, L, CO.metal, { seg: 12 }), 0, 0, 0));
  const rings = Math.max(2, Math.round(L / Math.max(r * 0.6, 2)));
  for (let i = 0; i <= rings; i += 1) {
    const y = (L * i) / rings;
    g.add(ringXZ(r * 0.98, Math.max(r * 0.02, 0.03), CO.metal, y));
    for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.35, y, Math.sin(a) * r * 0.35], [Math.cos(a) * r * 0.98, y, Math.sin(a) * r * 0.98], Math.max(r * 0.01, 0.02), CO.grey, { seg: 5 }); }
  }
  for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; rod(g, [Math.cos(a) * r * 0.98, 0, Math.sin(a) * r * 0.98], [Math.cos(a) * r * 0.98, L, Math.sin(a) * r * 0.98], Math.max(r * 0.012, 0.02), CO.metal, { seg: 6 }); }
  for (let i = 0; i < rings; i += 1) {
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8, y = (L * (i + 0.5)) / rings;
      const crate = box(r * 0.5, (L / rings) * 0.8, r * 0.45, k % 3 ? CO.shell : CO.mli);
      put(crate, Math.cos(a) * r * 0.72, y, Math.sin(a) * r * 0.72, 0, -a, 0); g.add(crate);
    }
  }
  return { group: g };
}

/* The rails: four longitudinal rails following the profile radius, cross ties, diagonal transitions. */
function railsCAD(p) {
  const g = new THREE.Group(), n = p.rails ?? 4, prof = p.profile ?? [{ y0: 0, y1: p.dims.l, r: p.dims.d / 2 }];
  const railR = 0.06;
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * Math.PI * 2 + (p.azimuth0 ?? 0);
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < prof.length; i += 1) {
      const seg = prof[i];
      rod(g, [c * seg.r, seg.y0, s * seg.r], [c * seg.r, seg.y1, s * seg.r], railR, CO.metal, { seg: 6 });
      rod(g, [c * (seg.r - 0.12), seg.y0, s * (seg.r - 0.12)], [c * (seg.r - 0.12), seg.y1, s * (seg.r - 0.12)], railR * 0.6, CO.dark, { seg: 5 });
      if (i < prof.length - 1) {
        const nx = prof[i + 1];
        rod(g, [c * seg.r, seg.y1, s * seg.r], [c * nx.r, nx.y0 + Math.min(2, nx.y1 - nx.y0), s * nx.r], railR, CO.metal, { seg: 6 });
      }
      const ties = Math.max(1, Math.round((seg.y1 - seg.y0) / 8));
      for (let t = 0; t < ties; t += 1) {
        const y = seg.y0 + ((t + 0.5) / ties) * (seg.y1 - seg.y0);
        rod(g, [c * (seg.r - 0.35), y, s * (seg.r - 0.35)], [c * seg.r, y, s * seg.r], railR * 0.5, CO.grey, { seg: 5 });
      }
    }
  }
  return { group: g };
}

/* A compute rack: a dark box with radiator fins on three faces, a cable stub into the module, a lamp. */
function rackCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, w = p.dims.d, k = p.nodes ?? 1;
  const body = rbox(w, L, w * 0.8, RC.dark, M.dark); put(body, 0, L / 2, 0); g.add(body);
  for (let i = 0; i < 6; i += 1) { const fin = rbox(w * 1.1, L * 0.9, 0.015, RC.deck, M.white); put(fin, 0, L / 2, -w * 0.4 - 0.05 - i * 0.07); g.add(fin); }
  for (let i = 0; i < Math.min(k, 8); i += 1) { const led = rbox(0.03, 0.03, 0.02, RC.screen, M.screen); put(led, -w * 0.4 + i * (w * 0.8 / 8), L * 0.9, w * 0.41); g.add(led); }
  g.add(ringXZ(w * 0.25, 0.02, CO.gold, 0.01));
  const shield = rbox(w * 1.05, L * 1.05, 0.04, RC.shield, M.shield); put(shield, 0, L / 2, w * 0.42); g.add(shield);
  return { group: g };
}

/* The scout rack: a dispenser block with a bay per scout, doors ajar, a 6U body visible in each. */
function scoutRackCAD(p) {
  const g = new THREE.Group(), L = p.dims.l, w = p.dims.d, n = p.scouts ?? 4, cols = Math.min(n, 4), rows = Math.ceil(n / cols);
  const body = rbox(w, L, Math.max(0.5, rows * 0.4), RC.dark, M.dark); put(body, 0, L / 2, 0); g.add(body);
  for (let i = 0; i < n; i += 1) {
    const cx = (i % cols - (cols - 1) / 2) * (w / cols), cz = (Math.floor(i / cols) - (rows - 1) / 2) * 0.4;
    const bay = rbox(w / cols * 0.8, L * 0.8, 0.3, RC.lens, M.lens); put(bay, cx, L / 2, cz); g.add(bay);
    const sat = rbox(0.22, 0.34, 0.1, RC.gold, M.gold); put(sat, cx, L / 2, cz + 0.05); g.add(sat);
    const door = rbox(w / cols * 0.8, L * 0.8, 0.02, CO.hatch, M.white); put(door, cx + (w / cols) * 0.38, L / 2, cz + 0.18, 0, 1.1, 0); g.add(door);
  }
  return { group: g };
}

const V5_BUILDERS = {
  robot: robotCAD,
  'robot-hangar': hangarCAD,
  'robot-lock': lockCAD,
  'fab-bay': fabCAD,
  'obs-deck': obsCAD,
  'seed-vault': vaultCAD,
  'torpor-ring': torporRingCAD,
  stores: storesCAD,
  'arrival-kit': kitCAD,
  'rail-network': railsCAD,
  'compute-rack': rackCAD,
  'scout-rack': scoutRackCAD,
  'reactor-fsp': (p) => BUILDERS.reactor(p)
};

function roboticPart(p) {
  const build = V5_BUILDERS[p.kind];
  return build ? build(p) : centauriPart(p);
}

/* ------------------------------------------------------------------ *
 * The ships
 * ------------------------------------------------------------------ */

/** Build one v5 ship from its solved assembly. Same hooks as buildCentauriModel: fitAxis null, label,
 *  setDeploy for the radiators, stages; plus `layers` (robots, rails, racks) the viewer can toggle. */
export function buildRoboticModel(id) {
  const m = measureRobotic(id);
  const g = new THREE.Group();
  const hullStage = new THREE.Group();
  hullStage.userData.stage = 0;
  g.add(hullStage);
  const layers = { robots: new THREE.Group(), rails: new THREE.Group(), racks: new THREE.Group(), radiators: new THREE.Group() };
  for (const l of Object.values(layers)) hullStage.add(l);

  const deployers = [];
  const box3 = new THREE.Box3();
  for (const n of m.solved.nodes) {
    const p = n.part;
    const built = roboticPart(p);
    for (const port of p.ports ?? []) addPortRing(built.group, port);
    const frame = new THREE.Group();
    frame.position.fromArray(n.world.position);
    frame.quaternion.fromArray(n.world.quaternion);
    frame.add(built.group);
    frame.userData.partName = n.name;
    frame.userData.kind = p.kind;
    const host = p.kind === 'robot' ? layers.robots : p.kind === 'rail-network' ? layers.rails : ['compute-rack', 'scout-rack'].includes(p.kind) ? layers.racks : p.kind === 'radiator' ? layers.radiators : hullStage;
    host.add(frame);
    if (built.setDeploy) deployers.push(built.setDeploy);
    frame.updateMatrixWorld(true);
    if (p.kind !== 'rail-network') box3.expandByObject(frame);
  }
  const span3 = box3.getSize(new THREE.Vector3());
  const hullSpan = Math.max(span3.x, span3.y, span3.z, 1e-6);

  g.rotation.set(-Math.PI / 2, -0.42, 0);
  const setDeploy = (k) => { for (const d of deployers) d(k); };
  setDeploy(1);

  const datum = new THREE.Group();
  const cgMark = sph(Math.max(hullSpan * 0.006, 0.05), CO.accent, { metal: 0.2, rough: 0.4 });
  cgMark.position.fromArray(m.geometry.cgHull);
  datum.add(cgMark);
  hullStage.add(datum);

  const pc = m.propulsion.beta * 100;
  g.userData.fitAxis = null;
  g.userData.top = hullSpan;
  g.userData.stages = new Map([[0, hullStage]]);
  g.userData.setDeploy = setDeploy;
  g.userData.layers = layers;
  g.userData.measure = m;
  g.userData.label = `stack ${span(hullSpan)} · ${m.propulsion.drive.short} · ${pc.toFixed(1)} % c · ${m.propulsion.tripYears.toFixed(0)} yr · ${m.robots.count} robots${m.humans.humans ? ` · ${m.humans.humans} sleepers, ${Math.ceil(m.humans.awakeAvg)} awake` : ' · uncrewed'}`;
  return g;
}

/** The robot classes lined up at true scale, each standing beside a 1.8 m person. Returns the group
 *  and the x position and name of each so the viewer can label them. */
export const ROBOT_IDS = Object.keys(ROBOTS);
export function buildRobotGallery(personFn) {
  const g = new THREE.Group();
  const items = [];
  let x = 0;
  for (const id of ROBOT_IDS) {
    const r = ROBOTS[id];
    const p = { kind: 'robot', robot: id, dims: r.dims, name: r.name };
    const built = roboticPart(p);
    const w = Math.max(r.dims.d, 0.6) * (id === 'arm-era' ? 0.4 : 1) + 0.8;
    x += w / 2;
    built.group.position.x = x;
    if (id === 'arm-era') { built.group.rotation.z = -Math.PI / 2.6; built.group.position.y = 0.2; }
    g.add(built.group);
    if (personFn && ['humanoid-iva', 'humanoid-eva', 'crawler-rail', 'arm-dextre', 'fab-cell', 'med-bot'].includes(id)) {
      const person = personFn();
      person.position.x = x + Math.max(r.dims.d, 0.6) / 2 + 0.45;
      g.add(person);
      x += 0.9;
    }
    items.push({ id, name: r.name, x, massKg: r.massKg, heightM: r.dims.l, source: r.source, role: r.role });
    x += w / 2 + 0.6;
  }
  g.position.x = -x / 2;
  g.userData.items = items.map((it) => ({ ...it, x: it.x - x / 2 }));
  g.userData.width = x;
  return g;
}

export { designById };
