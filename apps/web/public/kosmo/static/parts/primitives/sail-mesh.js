/* primitives/sail-mesh.js -- the sail mechanism as geometry.

   Everything here is drawn from parts/sail-mechanics.js: the film is the panel list of the mechanism
   at the current k (a pleat slice is a quad, the vertex buffer is rewritten on every setDeploy), the
   drum, doors, core spool, reels, booms, spools, tip masses, vanes, beacons, tie-lines and the hub
   gimbal are posed from its `hardware`, so the picture cannot disagree with the numbers. The film has
   its own physical material (an aluminised dielectric: metallic, slightly translucent, with an
   iridescence option), because a film is not a painted surface. Every other piece takes its skin from
   primitives/materials.js by kind through `skins`, so the shared livery layer (checkers, hazard bands,
   primaries) dresses the hardware without this file knowing a colour.

     sailMechanismMesh(mech, { trueMech, ratio, skins, iridescent, segCap }) -> { group, setDeploy(k), setJettison(j), readout(k) }

   The group is in the sail part's frame: film in XZ at y = 0, +y the thrust axis, drum below. */

import * as THREE from 'three';
import { surface } from './materials.js';
import { cyl, box, sph, tor, ringXZ, rod, navLights, trussMesh, put } from './mesh.js';
import { readout as mechReadout } from '../sail-mechanics.js';

const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

export const SAIL_SKINS = { drum: 'stainless', door: 'white', core: 'dark', ring: 'gold', latch: 'accent', tip: 'gold', vane: 'gold', boom: 'grey', spool: 'dark', gimbal: 'grey', tray: 'grey', reel: 'hatch' };

let filmMat = null, filmMatIri = null;
/** The film: aluminised / dielectric multilayer. Reflective, a little translucent, double-sided. Not a livery surface. */
export function filmMaterial({ iridescent = false } = {}) {
  if (iridescent && filmMatIri) return filmMatIri;
  if (!iridescent && filmMat) return filmMat;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xeef2f8, metalness: 0.92, roughness: 0.22, clearcoat: 0.25, clearcoatRoughness: 0.3,
    transparent: true, opacity: 0.88, side: THREE.DoubleSide, envMapIntensity: 1.3,
    iridescence: iridescent ? 0.65 : 0, iridescenceIOR: 1.45, iridescenceThicknessRange: [140, 460]
  });
  m.userData.surface = 'sail-film';
  if (iridescent) filmMatIri = m; else filmMat = m;
  return m;
}

/** TRAC cross-section (two lenticular flanges on a web) or a slit STEM tube, swept along +y for `length`. */
function boomMesh(kind, length, width, skin) {
  if (/lattice/.test(kind)) return trussMesh({ lengthM: Math.max(length, 1e-6), widthM: width, kind: skin, section: 'square' });
  const shape = new THREE.Shape();
  const w = width / 2, h = width * 0.35;
  if (/STEM/.test(kind)) {
    for (let i = 0; i <= 24; i += 1) { const a = -Math.PI * 0.85 + (i / 24) * Math.PI * 1.7; const p = [Math.cos(a) * w, Math.sin(a) * w]; if (i === 0) shape.moveTo(p[0], p[1]); else shape.lineTo(p[0], p[1]); }
    for (let i = 24; i >= 0; i -= 1) { const a = -Math.PI * 0.85 + (i / 24) * Math.PI * 1.7; shape.lineTo(Math.cos(a) * w * 0.9, Math.sin(a) * w * 0.9); }
  } else {
    /* TRAC: a bonded web with two tape-spring flanges opening in a flattened V */
    const t = width * 0.05;
    const pts = [[-t, -h], [t, -h], [t, 0], [w, h], [w - 1.6 * t, h + 1.4 * t], [0, 2.5 * t], [-w + 1.6 * t, h + 1.4 * t], [-w, h], [-t, 0]];
    pts.forEach((p, i) => (i === 0 ? shape.moveTo(p[0], p[1]) : shape.lineTo(p[0], p[1])));
    shape.closePath();
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(length, 1e-6), bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2);   // extrude along +z -> +y
  return new THREE.Mesh(g, surface(skin, { repeat: [1, 1] }));
}

/**
 * Build the mechanism. `mech` is the mechanism to draw (the drawn-scale one); `trueMech` the real one,
 * whose numbers the readout prints.
 */
export function sailMechanismMesh(mech, { trueMech = null, ratio = 1, skins = {}, iridescent = false, filmDetail = true } = {}) {
  const S = { ...SAIL_SKINS, ...skins };
  const root = new THREE.Group();
  const film = new THREE.Group(), hardware = new THREE.Group(), lines = new THREE.Group();
  root.add(hardware, film, lines);
  const R = mech.R, drum = mech.drum, arch = mech.architecture;
  const tiny = Math.max(R * 1e-4, 1e-6);

  /* ---- the film: one indexed buffer, rewritten per k ---- */
  const g1 = mech.geometry(1);
  const nPanels = g1.panels.length;
  const pos = new Float32Array(nPanels * 4 * 3);
  const idx = new Uint32Array(nPanels * 6);
  for (let i = 0; i < nPanels; i += 1) { const b = i * 4, o = i * 6; idx[o] = b; idx[o + 1] = b + 1; idx[o + 2] = b + 2; idx[o + 3] = b; idx[o + 4] = b + 2; idx[o + 5] = b + 3; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const filmMesh = new THREE.Mesh(geo, filmMaterial({ iridescent })); filmMesh.frustumCulled = false; filmMesh.userData.film = true;
  film.add(filmMesh);
  /* creases: the fold line of every slice (edge 0-3) and the gore boundary (edge 1-2) */
  const creasePos = new Float32Array(nPanels * 2 * 2 * 3);
  const creaseGeo = new THREE.BufferGeometry(); creaseGeo.setAttribute('position', new THREE.BufferAttribute(creasePos, 3));
  const creases = new THREE.LineSegments(creaseGeo, new THREE.LineBasicMaterial({ color: 0xbfd6ee, transparent: true, opacity: 0.28 })); creases.frustumCulled = false;
  if (filmDetail) film.add(creases);

  /* ---- hardware ---- */
  const H = g1.hardware;
  const parts = { doors: [], tips: [], vanes: [], booms: [], spools: [], tray: null, gimbal: null, drumGroup: null, reelRing: null, beacons: null };
  const drumGroup = new THREE.Group(); hardware.add(drumGroup); parts.drumGroup = drumGroup;
  if (arch !== 'starchip-disc') {
    const r = drum.r, l = drum.l, N = mech.N;
    /* bottom plate, core spool, top ring with the reel drive, latches, gimbal rings at the base */
    drumGroup.add(put(cyl(r, Math.max(l * 0.03, 1e-4), S.drum, { seg: 48 }), 0, -l, 0));
    drumGroup.add(put(cyl(drum.rCore, l * 0.98, S.core, { seg: 24 }), 0, -l * 0.99, 0));
    drumGroup.add(ringXZ(r * 0.99, Math.max(r * 0.035, 1e-4), S.ring, -l * 0.01));
    drumGroup.add(ringXZ(r * 0.99, Math.max(r * 0.035, 1e-4), S.ring, -l * 0.99));
    if (mech.canRefold) { const reel = ringXZ(drum.rCore * 1.25, Math.max(drum.rCore * 0.18, 1e-4), S.reel, -l * 0.5); parts.reelRing = reel; drumGroup.add(reel); }
    /* doors: N petals, the wall itself, hinged at the bottom rim */
    for (let i = 0; i < N; i += 1) {
      const hinge = new THREE.Group();
      const az = (i + 0.5) * (TAU / N);
      hinge.position.set(r * Math.cos(az), -l, r * Math.sin(az));
      hinge.rotation.y = -az;
      /* a slice of the wall (three's cylinder theta = 0 is +z; turned so the slice's centre line is +x), its
         bottom edge moved onto the hinge frame's origin */
      const petal = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l * 0.97, 16, 1, true, -(TAU / N) * 0.47, (TAU / N) * 0.94), surface(S.door, { repeat: [1, 1] }));
      petal.geometry.translate(0, l * 0.485, 0);
      petal.geometry.rotateY(Math.PI / 2);
      petal.geometry.translate(-r, 0, 0);
      hinge.add(petal);
      const latch = box(Math.max(r * 0.08, 1e-4), Math.max(l * 0.06, 1e-4), Math.max(r * 0.12, 1e-4), S.latch); latch.position.set(0, l * 0.95, 0); hinge.add(latch);
      drumGroup.add(hinge); parts.doors.push(hinge);
    }
    /* hub gimbal: two rings on crossed axes under the drum, the load path to the mast. The outer ring is carried on a
       bearing housing bolted to the drum's bottom plate; the inner ring turns on two trunnions inside it; a mast-root
       flange below closes the load path to the hardpoint (CENTAURI-ATTACH.md: the rings hung in the air) */
    const gim = new THREE.Group(), gy = Math.max(r * 0.12, 1e-4);
    const housing = cyl(r * 0.62, gy, S.gimbal, { seg: 32 }); housing.position.y = -l - gy; drumGroup.add(housing);
    gim.add(ringXZ(r * 0.6, Math.max(r * 0.05, 1e-4), S.gimbal, 0));
    const inner = tor(r * 0.45, Math.max(r * 0.045, 1e-4), S.gimbal); inner.rotation.x = Math.PI / 2; inner.rotation.z = Math.PI / 2; gim.add(inner);
    for (const sx of [-1, 1]) { const trunnion = cyl(Math.max(r * 0.04, 1e-4), r * 0.16, S.core, { seg: 10 }); trunnion.rotation.z = Math.PI / 2; trunnion.position.set(sx * r * 0.52, 0, 0); gim.add(trunnion); }
    const flange = cyl(r * 0.5, Math.max(r * 0.04, 1e-4), S.gimbal, { seg: 32 }); flange.position.y = -Math.max(r * 0.09, 1e-4); gim.add(flange);
    gim.position.y = -l - gy;
    hardware.add(gim); parts.gimbal = gim;
    /* a few reel-drive motors on the top ring */
    for (let k = 0; k < Math.min(N, 6); k += 1) { const a = (k / N) * TAU; const mot = cyl(Math.max(r * 0.06, 1e-4), Math.max(l * 0.08, 1e-4), S.core, { seg: 10 }); put(mot, Math.cos(a) * r * 0.8, -l * 0.1, Math.sin(a) * r * 0.8); drumGroup.add(mot); }
  } else {
    /* the dispenser tray the disc is released from: a frame with a slot, on the mother ship */
    const t = H.tray;
    const tray = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.RingGeometry(t.R * 0.98, t.R * 1.08, 48), surface(S.tray, { repeat: [1, 1] })); frame.rotation.x = -Math.PI / 2; frame.position.y = -t.h; tray.add(frame);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(t.R * 0.98, 48), surface(S.core, { repeat: [1, 1] })); floor.rotation.x = -Math.PI / 2; floor.position.y = -t.h * 1.5; tray.add(floor);
    for (let k = 0; k < 4; k += 1) { const a = (k / 4) * TAU + Math.PI / 4; const post = box(t.R * 0.04, t.h * 2.2, t.R * 0.04, S.tray); put(post, Math.cos(a) * t.R * 1.03, -t.h * 0.4, Math.sin(a) * t.R * 1.03); tray.add(post); }
    hardware.add(tray); parts.tray = tray;
  }
  /* tips: mass, vane, beacon. A tip mass is hardware, so it is sized against the drum (and stows inside it), not against a drawn-down film */
  const tipR = Math.max(Math.min(R * 0.008, arch === 'starchip-disc' ? R * 0.008 : drum.r * 0.1), tiny * 4);
  for (let i = 0; i < H.tips.length; i += 1) {
    const tg = new THREE.Group();
    tg.add(sph(tipR, S.tip));
    const vane = new THREE.Group(); const plate = box(R * 0.05, Math.max(R * 0.001, tiny), R * 0.025, S.vane); plate.position.x = R * 0.03; vane.add(plate); vane.position.y = tipR; tg.add(vane);
    tg.add(navLights([{ p: [0, tipR * 1.6, 0], kind: i % 2 ? 'navRed' : 'navGreen', r: tipR * 0.45 }]));
    tg.traverse((o) => { if (o.isMesh) o.userData.tethered = true; });   // held by the film and its tie-lines, not by the drum
    film.add(tg); parts.tips.push(tg); parts.vanes.push(vane);   // tips travel with the film (and with a jettison)
  }
  /* booms and spools (boom-square) */
  if (H.booms) {
    const width = Math.max(mech.R * 0.012, tiny * 6);
    for (const b of H.booms) {
      const bg = new THREE.Group();
      const mesh = boomMesh(b.kind, 1, width, S.boom); bg.add(mesh);
      const deployer = cyl(width * 1.6, width * 2.2, S.spool, { seg: 16 }); deployer.rotation.z = Math.PI / 2; deployer.position.set(0, 0, 0); bg.add(deployer);
      bg.position.fromArray(b.root);
      bg.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...b.dir).normalize());
      hardware.add(bg); parts.booms.push({ group: bg, mesh });
    }
    for (const sp of H.spools) {
      const sg = new THREE.Group();
      const roll = cyl(1, sp.lengthM, S.spool, { seg: 20 }); roll.position.y = -sp.lengthM / 2; sg.add(roll);
      sg.position.fromArray(sp.p);
      sg.quaternion.setFromUnitVectors(Y, new THREE.Vector3(...sp.axis).normalize());
      hardware.add(sg); parts.spools.push({ group: sg, roll });
    }
  }
  /* tie-lines and halyards as line segments with a catenary droop when slack */
  const lineGeo = new THREE.BufferGeometry();
  const maxLines = g1.lines.length, lineSegs = 12;
  const linePos = new Float32Array(maxLines * lineSegs * 2 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMesh = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xe8eef6, transparent: true, opacity: 0.7 })); lineMesh.frustumCulled = false;
  lines.add(lineMesh);

  let lastK = 1, jett = 0;
  function write(k) {
    lastK = k;
    const g = mech.geometry(k);
    /* film */
    let n = 0;
    for (const p of g.panels) for (const v of p.v) { pos[n] = v[0]; pos[n + 1] = v[1]; pos[n + 2] = v[2]; n += 3; }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingBox(); geo.computeBoundingSphere();
    if (filmDetail) {
      let c = 0;
      for (const p of g.panels) {
        const a = p.v[0], b = p.v[3], c1 = p.v[1], d = p.v[2];
        creasePos[c] = a[0]; creasePos[c + 1] = a[1] + tiny; creasePos[c + 2] = a[2]; creasePos[c + 3] = b[0]; creasePos[c + 4] = b[1] + tiny; creasePos[c + 5] = b[2];
        creasePos[c + 6] = c1[0]; creasePos[c + 7] = c1[1] + tiny; creasePos[c + 8] = c1[2]; creasePos[c + 9] = d[0]; creasePos[c + 10] = d[1] + tiny; creasePos[c + 11] = d[2];
        c += 12;
      }
      creaseGeo.attributes.position.needsUpdate = true; creaseGeo.computeBoundingBox(); creaseGeo.computeBoundingSphere();
    }
    /* hardware poses */
    const Hk = g.hardware;
    Hk.doors.forEach((d, i) => { const h = parts.doors[i]; if (h) h.rotation.z = -d.angle; });
    Hk.tips.forEach((t, i) => { const tg = parts.tips[i]; if (!tg) return; tg.position.fromArray(t.p); const az = Math.atan2(t.p[2], t.p[0]); tg.rotation.y = -az; const v = Hk.vanes[i]; if (v && parts.vanes[i]) parts.vanes[i].rotation.x = v.deflectRad; });
    if (Hk.booms) Hk.booms.forEach((b, i) => { const bm = parts.booms[i]; if (bm) bm.mesh.scale.y = Math.max(b.lengthM, 1e-6); });
    if (Hk.spools) Hk.spools.forEach((s, i) => { const sp = parts.spools[i]; if (sp) sp.roll.scale.set(Math.max(s.radiusM, 1e-6), 1, Math.max(s.radiusM, 1e-6)); });
    if (Hk.tray && parts.tray) { parts.tray.position.y = Hk.tray.y; parts.tray.visible = Hk.tray.present; }
    if (parts.gimbal) parts.gimbal.rotation.z = Hk.gimbalRad;
    /* the reel turns about its own axis, which after ringXZ's rotation.x is local z (rotation.y tilted it 22 degrees off the hub) */
    if (parts.reelRing) parts.reelRing.rotation.z = (g.extensionM / Math.max(drum.rCore, 1e-6)) % TAU;
    /* lines. A cord that runs along a strip is the strip (not drawn). A tie-line or halyard is stowed along the
       film until the pleats open; once out it is drawn straight, with a small free-floating wobble while slack --
       there is no gravity to hang a catenary in. */
    let q = 0;
    const show = (L) => !(L.along === 'strip') && (L.id.startsWith('halyard') ? g.extensionM > 0 : g.pleatOpen > 0.02);
    for (const L of g.lines) {
      if (!show(L)) continue;
      const slack = Math.max(0, L.paidM - L.geomM);
      const wobble = L.state === 'taut' ? 0 : Math.min(slack * 0.5, R * 0.01);
      for (let s = 0; s < lineSegs; s += 1) {
        const t0 = s / lineSegs, t1 = (s + 1) / lineSegs;
        for (const t of [t0, t1]) {
          const x = L.a[0] + (L.b[0] - L.a[0]) * t, y = L.a[1] + (L.b[1] - L.a[1]) * t + wobble * Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI), z = L.a[2] + (L.b[2] - L.a[2]) * t;
          linePos[q] = x; linePos[q + 1] = y; linePos[q + 2] = z; q += 3;
        }
      }
    }
    for (; q < linePos.length; q += 1) linePos[q] = 0;
    lineGeo.setDrawRange(0, q / 3);
    lineGeo.attributes.position.needsUpdate = true; lineGeo.computeBoundingBox(); lineGeo.computeBoundingSphere();
    lines.visible = q > 0;
    /* vanes stay folded along the tip mass until the film is open; the beacons light once the doors are open */
    for (const v of parts.vanes) v.visible = g.pleatOpen > 0.5 || arch === 'starchip-disc';
    root.userData.state = { k, stage: g.stage.id, stageName: g.stage.name };
  }
  /* a cut-away: the film, its tips and its lines separate forward along the thrust axis; the drum stays on the mast */
  function applyJettison() {
    const J = mech.jettison(jett);
    film.position.y = J.separationM; lines.position.y = J.separationM;
    film.rotation.y = jett * 0.15;   // a little residual spin as it goes
    root.userData.jettison = { j: jett, ...J };
  }
  function setDeploy(k) { write(k); applyJettison(); }
  function setJettison(j) { jett = Math.max(0, Math.min(1, j)); applyJettison(); }

  setDeploy(1);
  root.userData.setDeploy = setDeploy;
  root.userData.setJettison = setJettison;
  root.userData.mechanism = mech;
  root.userData.trueMechanism = trueMech ?? mech;
  root.userData.readout = (k = lastK) => ({ ...mechReadout(trueMech ?? mech, k, { coarse: true }), drawnRatio: ratio, architecture: arch, panels: nPanels });
  return { group: root, setDeploy, setJettison, readout: root.userData.readout };
}
