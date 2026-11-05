// Launch and landing pads for the Shipyard and the Landing lab, built from real facility layouts (metres, approximate public figures).
//
//   launchPad(THREE, kind, { ground })   kind: 'falcon9' | 'electron' | 'saturn' | 'generic'     (Shipyard)
//   landingPad(THREE, kind, { ground })  kind: 'lz' | 'bluepad' | 'olm' | 'lunar'                (Landing lab)
//
// Frame: +y is up, the vehicle's base stands at y = 0 on the launch mount, the surrounding ground is at y = `ground` (-3 m in the Shipyard, whose
// planet sphere sits 3 m below the pad reference; -0.2 in the Landing lab). Structures stand beside the vehicle on the +z side, out of the planar
// flight plane (x-y); flame trenches run along x. Only structure above the ground is drawn, so a mount that really stands 14 m high is shown from its
// deck up (the deck is where the vehicle stands), keeping the tower, arms and masts at their true heights relative to the vehicle.
//
// Core three.js only (no addons): view3d.js loads three lazily so the 2D mode keeps working offline, and this module must not change that.

// ---------- helpers ----------
function mats(THREE) {
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15, ...o });
  return {
    M,
    concrete: concreteMat(THREE),
    deckSteel: M(0x59626b, { roughness: 0.55, metalness: 0.6 }),
    steel: M(0xa9b0b8, { roughness: 0.5, metalness: 0.7 }),
    tower: M(0xc9ccd0, { roughness: 0.6, metalness: 0.45 }),
    towerRed: M(0xb5362b, { roughness: 0.65, metalness: 0.3 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x050506 }),
    white: M(0xf0f2f4, { roughness: 0.5, metalness: 0.3 }),
    paint: new THREE.MeshBasicMaterial({ color: 0xf2f2f2, toneMapped: false }),
    yellow: new THREE.MeshBasicMaterial({ color: 0xe8b923, toneMapped: false })
  };
}

// Poured concrete: speckle plus expansion joints.
function concreteMat(THREE, tint = '#9a9ea3', repeat = 6) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = tint; g.fillRect(0, 0, 256, 256);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? 40 : 230},${rnd() < 0.5 ? 40 : 230},${rnd() < 0.5 ? 40 : 230},${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 3, 1 + rnd() * 3); }
  g.strokeStyle = 'rgba(20,20,22,0.55)'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 254);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 });
}

// One draw call for many boxes / struts. member: { p:[x,y,z], s:[sx,sy,sz], q?:Quaternion }
function instanced(THREE, members, material) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, members.length);
  const o = new THREE.Object3D();
  members.forEach((m, i) => { o.position.set(...m.p); o.scale.set(...m.s); if (m.q) o.quaternion.copy(m.q); else o.quaternion.identity(); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
  mesh.instanceMatrix.needsUpdate = true; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  return mesh;
}

// A strut from A to B with square section t.
function strut(THREE, A, B, t) {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), d = b.clone().sub(a), L = d.length();
  return { p: a.clone().add(b).multiplyScalar(0.5).toArray(), s: [t, L, t], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
}

// A steel lattice tower: four legs, a horizontal frame at every panel, one diagonal per face per panel (alternating).
// base centre (cx, y0, cz), footprint w (x) by d (z), height h, panel height step.
function latticeMembers(THREE, { cx = 0, cz = 0, y0 = 0, w, d, h, step, leg = 0.5, brace = 0.22 }) {
  const m = [], hx = w / 2, hz = d / 2, n = Math.max(1, Math.round(h / step)), dy = h / n;
  const C = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (const [x, z] of C) m.push({ p: [cx + x, y0 + h / 2, cz + z], s: [leg, h, leg] });
  for (let k = 0; k <= n; k++) {
    const y = y0 + k * dy;
    for (let i = 0; i < 4; i++) { const [x1, z1] = C[i], [x2, z2] = C[(i + 1) % 4]; m.push(strut(THREE, [cx + x1, y, cz + z1], [cx + x2, y, cz + z2], brace)); }
    if (k < n) for (let i = 0; i < 4; i++) {
      const [x1, z1] = C[i], [x2, z2] = C[(i + 1) % 4], up = (k + i) % 2 === 0;
      m.push(strut(THREE, [cx + (up ? x1 : x2), y, cz + (up ? z1 : z2)], [cx + (up ? x2 : x1), y + dy, cz + (up ? z2 : z1)], brace));
    }
  }
  return m;
}

function mast(THREE, g, x, z, h, ground, M) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, h, 10), M.steel); pole.position.set(x, ground + h / 2, z); g.add(pole);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 5, 8), M.steel); tip.position.set(x, ground + h + 2.5, z); g.add(tip);
}

// A straight pipe/cable run between two points (a cylinder along the segment).
function pipe(THREE, g, A, B, r, mat) {
  const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(m); return m;
}

function sphereTank(THREE, g, x, z, r, ground, M) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), M.white); s.position.set(x, ground + r + 1.2, z); s.castShadow = s.receiveShadow = true; g.add(s);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, r + 1.2, 6), M.steel); leg.position.set(x + Math.cos(a) * r * 0.7, ground + (r + 1.2) / 2, z + Math.sin(a) * r * 0.7); g.add(leg); }
}

function slab(THREE, g, mat, x, z, w, d, ground, t = 0.3) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mat); m.position.set(x, ground + t / 2 - 0.02, z); m.receiveShadow = true; g.add(m); return m;
}

// Flame trench along x: dark channel between two raised concrete lips.
function trench(THREE, g, M, x0, x1, width, ground, lipH = 1.4) {
  const L = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, width), M.dark); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, ground + 0.34, 0); g.add(floor);
  for (const s of [-1, 1]) { const lip = new THREE.Mesh(new THREE.BoxGeometry(L, lipH, 0.9), M.concrete); lip.position.set(cx, ground + lipH / 2, s * (width / 2 + 0.45)); lip.castShadow = lip.receiveShadow = true; g.add(lip); }
}

// The launch mount: a deck whose top is y = 0, with an exhaust opening under the vehicle and hold-down posts around it.
function mount(THREE, g, M, { w, d, hole, thick, diameter, posts = 4, ground }) {
  const t = Math.min(thick, -ground + 0.2);                      // only what shows above the ground
  const y = -t / 2, hx = (w - hole) / 2, hz = (d - hole) / 2;
  const parts = [
    { p: [-(hole / 2 + hx / 2), y, 0], s: [hx, t, d] }, { p: [hole / 2 + hx / 2, y, 0], s: [hx, t, d] },
    { p: [0, y, -(hole / 2 + hz / 2)], s: [hole, t, hz] }, { p: [0, y, hole / 2 + hz / 2], s: [hole, t, hz] }
  ];
  const deck = instanced(THREE, parts, M.deckSteel); deck.receiveShadow = true; g.add(deck);
  const hole3 = new THREE.Mesh(new THREE.PlaneGeometry(hole, hole), M.dark); hole3.rotation.x = -Math.PI / 2; hole3.position.y = ground + 0.36; g.add(hole3);
  for (let i = 0; i < posts; i++) {
    const a = i / posts * 6.283 + Math.PI / posts, r = diameter * 0.5 + 0.35;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.9, 10), M.steel); p.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r); p.castShadow = true; g.add(p);
  }
}

function markRing(THREE, g, M, r0, r1, y) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), M.paint); ring.rotation.x = -Math.PI / 2; ring.position.y = y; g.add(ring); return ring;
}

// ---------- launch pads (Shipyard) ----------
const LAUNCH = {
  // SpaceX Falcon 9 (SLC-40 / LC-39A style): the strongback (transporter-erector) stands vertical beside the vehicle, four lightning towers, RP-1 and LOX spheres.
  falcon9(THREE, g, M, ground) {
    g.add(slab(THREE, g, M.concrete, 0, 0, 72, 72, ground));
    trench(THREE, g, M, 4, 54, 12, ground);
    mount(THREE, g, M, { w: 10, d: 10, hole: 5, thick: 3, diameter: 3.7, ground });
    g.add(instanced(THREE, latticeMembers(THREE, { cx: 0, cz: 6.6, y0: 0, w: 4.2, d: 4.2, h: 58, step: 4.8, leg: 0.5, brace: 0.2 }), M.tower));
    // service arms: from the tower face (z 4.5) to the vehicle skin (z 1.85), so the tower visibly holds the rocket at every level
    g.add(instanced(THREE, [8, 20, 32, 44, 54].map(y => ({ p: [0, y, 3.2], s: [1.4, 1.2, 2.7] })), M.towerRed));
    // umbilical and cable run up the tower face, and the propellant lines: LOX and RP-1 spheres -> the launch mount (laid on the ground, beside the trench)
    pipe(THREE, g, [-1.2, ground, 4.6], [-1.2, 52, 4.6], 0.22, M.steel); pipe(THREE, g, [1.2, ground, 4.6], [1.2, 52, 4.6], 0.18, M.steel);
    for (const [sx, sz, ex, lane] of [[70, -34, 0.8, 0], [70, -14, -0.8, 0]]) {
      const y = ground + 0.55;
      pipe(THREE, g, [sx - 6, y, sz], [ex, y, sz], 0.3, M.steel);
      pipe(THREE, g, [ex, y, sz], [ex, y, -5], 0.3, M.steel);
    }
    for (const [x, z] of [[-46, -46], [46, -46], [-46, 46], [46, 46]]) mast(THREE, g, x, z, 82, ground, M);
    sphereTank(THREE, g, 70, -34, 7, ground, M); sphereTank(THREE, g, 70, -14, 5.5, ground, M);
    markRing(THREE, g, M, 17, 17.6, ground + 0.34);
  },
  // Rocket Lab Electron (Launch Complex 1, Mahia): a small concrete pad, a low launch mount, the transporter-erector's A-frame, a hangar beside the pad.
  electron(THREE, g, M, ground) {
    g.add(slab(THREE, g, M.concrete, 0, 0, 40, 40, ground));
    trench(THREE, g, M, 2, 24, 5, ground, 1.1);
    mount(THREE, g, M, { w: 5.2, d: 5.2, hole: 2.2, thick: 3, diameter: 1.2, ground });
    g.add(instanced(THREE, latticeMembers(THREE, { cx: 0, cz: 2.6, y0: 0, w: 1.7, d: 1.7, h: 16, step: 3.2, leg: 0.25, brace: 0.12 }), M.tower));
    for (const [x, z] of [[-17, -17], [17, -17], [-17, 17]]) mast(THREE, g, x, z, 38, ground, M);
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 14), M.white); hangar.position.set(-6, ground + 4.5, -34); hangar.castShadow = hangar.receiveShadow = true; g.add(hangar);
    markRing(THREE, g, M, 7, 7.4, ground + 0.34);
  },
  // NASA LC-39A with a Saturn V: the Mobile Launcher (platform 48.8 x 41.1 m with a 13.7 m exhaust opening), the 122 m Launch Umbilical Tower and its nine swing
  // arms, the 17.7 m wide flame trench, lightning masts and the liquid-hydrogen and oxygen spheres.
  saturn(THREE, g, M, ground) {
    g.add(slab(THREE, g, M.concrete, 0, 0, 170, 170, ground, 0.5));
    trench(THREE, g, M, -68, 68, 17.7, ground, 1.8);
    mount(THREE, g, M, { w: 48.8, d: 41.1, hole: 13.7, thick: 3, diameter: 10.1, posts: 8, ground });
    const yellow = instanced(THREE, [{ p: [0, -0.1, 20.7], s: [48.8, 0.25, 0.5] }, { p: [0, -0.1, -20.7], s: [48.8, 0.25, 0.5] }], M.yellow); g.add(yellow);
    g.add(instanced(THREE, latticeMembers(THREE, { cx: 0, cz: 21, y0: 0, w: 12.2, d: 12.2, h: 122, step: 6.1, leg: 1.1, brace: 0.45 }), M.tower));
    const arms = [12, 25, 41, 53, 65, 77, 88, 99, 110].map(y => ({ p: [0, y, 12.2], s: [1.6, 1.6, 15] }));   // from the tower face (z 14.9) to the vehicle skin (z 5.05)
    g.add(instanced(THREE, arms, M.towerRed));
    for (const [x, z] of [[-78, -78], [78, -78], [-78, 78], [78, 78]]) mast(THREE, g, x, z, 105, ground, M);
    sphereTank(THREE, g, -20, -125, 10.5, ground, M); sphereTank(THREE, g, 28, -120, 7.5, ground, M);
    markRing(THREE, g, M, 60, 61, ground + 0.5);
  },
  generic(THREE, g, M, ground) {
    g.add(slab(THREE, g, M.concrete, 0, 0, 44, 44, ground));
    trench(THREE, g, M, 3, 26, 6, ground, 1.1);
    mount(THREE, g, M, { w: 8, d: 8, hole: 3.6, thick: 3, diameter: 3.7, ground });
    g.add(instanced(THREE, latticeMembers(THREE, { cx: 0, cz: 5.5, y0: 0, w: 3.2, d: 3.2, h: 34, step: 4.5, leg: 0.4, brace: 0.17 }), M.tower));
    for (const [x, z] of [[-19, -19], [19, -19]]) mast(THREE, g, x, z, 42, ground, M);
  }
};

export function launchPad(THREE, kind = 'generic', { ground = -3 } = {}) {
  const g = new THREE.Group(); g.name = 'pad:' + kind;
  (LAUNCH[kind] || LAUNCH.generic)(THREE, g, mats(THREE), ground);
  return g;
}

// ---------- landing pads (Landing lab) ----------
const LANDING = {
  // SpaceX landing zone (LZ-1 / LZ-4): a circular concrete pad about 86 m across, painted ring, a target circle with an X, floodlight masts, a service apron.
  lz(THREE, g, M, ground) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(43, 43, 0.5, 96), M.concrete); disc.position.y = ground + 0.1; disc.receiveShadow = true; g.add(disc);
    const y = ground + 0.37;
    markRing(THREE, g, M, 40.4, 41.4, y); markRing(THREE, g, M, 13.4, 14.4, y);
    for (const rot of [Math.PI / 4, -Math.PI / 4]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(80, 0.06, 1.2), M.paint); bar.rotation.y = rot; bar.position.y = y; g.add(bar); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.785; mast(THREE, g, Math.cos(a) * 52, Math.sin(a) * 52, 18, ground, M); }
    slab(THREE, g, M.concrete, 62, 0, 24, 18, ground);
  },
  // Blue Origin landing pad (West Texas): a smaller circular concrete pad with a target ring and an apron.
  bluepad(THREE, g, M, ground) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(27, 27, 0.5, 80), M.concrete); disc.position.y = ground + 0.1; disc.receiveShadow = true; g.add(disc);
    const y = ground + 0.37;
    markRing(THREE, g, M, 24.6, 25.4, y); markRing(THREE, g, M, 9.6, 10.2, y);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(50, 0.06, 0.9), M.paint); bar.position.y = y; g.add(bar); const bar2 = bar.clone(); bar2.rotation.y = Math.PI / 2; g.add(bar2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8), M.yellow); l.position.set(Math.cos(a) * 29, ground + 0.35, Math.sin(a) * 29); g.add(l); }
    slab(THREE, g, M.concrete, 46, 0, 20, 14, ground);
  },
  // Starship / Super Heavy launch and catch site: the Orbital Launch Mount (a ring table about 20 m up on six truss legs, with a flame diverter beneath),
  // and the 146 m launch tower whose two chopstick arms catch the booster (the arms themselves are placed by the lab from the vehicle's catch height).
  olm(THREE, g, M, ground, o = {}) {
    const tableY = o.tableY ?? 20;
    g.add(slab(THREE, g, M.concrete, 0, 0, 120, 120, ground, 0.5));
    const diverter = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 1.6, 48), M.concrete); diverter.position.y = ground + 0.8; g.add(diverter);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, 2.6, 48, 1, false), M.deckSteel); table.position.y = tableY - 1.3; table.castShadow = table.receiveShadow = true; g.add(table);
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, tableY - ground, 10), M.steel); col.position.set(Math.cos(a) * 8.6, ground + (tableY - ground) / 2, Math.sin(a) * 8.6); col.castShadow = true; g.add(col); }
    for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283; const c = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.8), M.steel); c.position.set(Math.cos(a) * 4.9, tableY + 0.5, Math.sin(a) * 4.9); c.rotation.y = -a; g.add(c); }
    const cx = o.towerX ?? -22;
    g.add(instanced(THREE, latticeMembers(THREE, { cx, cz: 0, y0: 0, w: 11, d: 11, h: 146, step: 9, leg: 1.2, brace: 0.5 }), M.tower));
    mast(THREE, g, cx - 26, -26, 70, ground, M);
    sphereTank(THREE, g, 50, -34, 9, ground, M); sphereTank(THREE, g, 50, -10, 7, ground, M);
  },
  // Prepared lunar landing pad: a graded circle of compacted regolith with a fiducial ring and four corner beacons.
  lunar(THREE, g, M, ground) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 0.4, 80), M.M(0x858581, { roughness: 1, metalness: 0 })); disc.position.y = ground + 0.1; disc.receiveShadow = true; g.add(disc);
    markRing(THREE, g, M, 18, 18.5, ground + 0.32);
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.785; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 8), M.steel); b.position.set(Math.cos(a) * 33, ground + 1.5, Math.sin(a) * 33); g.add(b); }
  }
};

export function landingPad(THREE, kind = 'lz', opts = {}) {
  const g = new THREE.Group(); g.name = 'landing:' + kind;
  (LANDING[kind] || LANDING.lz)(THREE, g, mats(THREE), opts.ground ?? -0.2, opts);
  return g;
}
