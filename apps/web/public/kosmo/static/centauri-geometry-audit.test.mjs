// centauri-geometry-audit.test.mjs -- does every Centauri ship, in every version, fit together and draw?
//
// Two halves. The first is pure geometry on the solver output (parts/geometry-audit.js): no two unmated
// bodies share volume (true tori for rings, swept annuli for the bola, every wing panel at five fold
// fractions and four sun-tracking rolls), every ring is coaxial and clear inside and out, every mate
// coincides, every hardpoint stands on its surface, nothing floats, nothing is a slab wider and longer
// than anything flown. The second builds the real three.js models headlessly (the vendored three.module.js
// through three-node-resolver.mjs; skipped with a message if the vendor tree is absent): every builder
// returns geometry, no NaN, every part's mesh box sits inside its envelope, the human-scale detail layer is
// present on every ship at its minimum density with real sizes, and the livery plan paints only paintable
// surfaces at square cells. Run by run-tests.mjs, or: node centauri-geometry-audit.test.mjs

import assert from 'node:assert/strict';
import { register } from 'node:module';
import { auditFleet, ALL_SHIP_IDS, SHIP_IDS, deployablePlates, shapesOf, sdf, samples, driveRadiatorPanels, plumeOf, plumeDepth, measureAny as measureAnyShip } from './parts/geometry-audit.js';
import { accordionAngles } from './parts/origami.js';
import { summarize } from './parts/assembly.js';
import { hasThree } from './three-node-resolver.mjs';

let checks = 0;
const ok = (cond, message) => { assert.ok(cond, message); checks += 1; };
const near = (a, b, tol, message) => { assert.ok(Math.abs(a - b) <= Math.abs(b) * tol + 1e-12, `${message}: got ${a}, expected ${b}`); checks += 1; };

/* ---------- the audit primitives ---------- */
ok(sdf({ type: 'torus', R: 10, tube: 2 }, [10, 0, 0]) < 0 && sdf({ type: 'torus', R: 10, tube: 2 }, [0, 0, 0]) > 0 && Math.abs(sdf({ type: 'torus', R: 10, tube: 2 }, [12, 0, 0])) < 1e-12, 'the torus distance is a torus, not a box: the hole is outside');
ok(sdf({ type: 'cyl', r: 1, y0: 0, y1: 2 }, [0, 1, 0]) < 0 && sdf({ type: 'cyl', r: 1, y0: 0, y1: 2 }, [0, 3, 0]) > 0.99, 'cylinder distance');
ok(sdf({ type: 'annulus', rIn: 2, rOut: 3, y0: -0.5, y1: 0.5 }, [0, 0, 0]) > 1.9 && sdf({ type: 'annulus', rIn: 2, rOut: 3, y0: -0.5, y1: 0.5 }, [2.5, 0, 0]) < 0, 'annulus distance: the hole is outside');
ok(samples({ type: 'torus', R: 10, tube: 2 }, 200).every((p) => Math.abs(sdf({ type: 'torus', R: 10, tube: 2 }, p)) < 1e-9), 'torus samples lie on the torus');
{
  const part = { kind: 'solar-array', dims: { l: 34, d: 11 }, standoff: 1.2 };
  const flat = deployablePlates(part, 1, 0), packed = deployablePlates(part, 0, 0);
  ok(flat.length === 8 && flat.every((b) => b.c[1] >= 1.2), 'a deployed wing is eight panels, all beyond the standoff');
  ok(packed.every((b) => b.c[1] >= 1.2 - 1e-9 && b.c[1] <= 1.2 + 34 / 8 + 1e-9), 'a packed wing stacks on its root panel, outward of the mount, never back over the hull');
  ok(accordionAngles(0.5, 8)[0] === 0, 'the root hinge of an accordion never folds');
  const rolled = deployablePlates(part, 1, Math.PI / 2);
  near(Math.abs(rolled[7].ax[0][2]), 1, 1e-9, 'a wing rolled 90 degrees about its root has its width along z');
  ok(shapesOf({ kind: 'centrifuge', dims: { l: 4, d: 115.8 }, ring: { R: 55.9 } })[0].type === 'torus', 'a centrifuge is audited as a torus');
  ok(shapesOf({ kind: 'spin-bola', dims: { l: 4.4, d: 120 }, bola: { R: 55.9, pod: { dims: { l: 8.5, d: 4.4 } }, truss: { widthM: 1.2 } } }).every((s) => s.swept), 'a bola is audited as what it sweeps');
}

/* ---------- every ship in every version ---------- */
const audit = auditFleet();
ok(audit.ships.length === 32 && ALL_SHIP_IDS.length === 32, 'thirty-two ships: 8 v1, 3 v2, 8 v3, 8 v4, 5 v5');
for (const s of audit.ships) {
  const errors = s.findings.filter((f) => f.severity === 'error');
  ok(errors.length === 0, `${s.id} (${s.version}): no geometry errors (${errors.map((f) => `${f.code}: ${f.parts.join('/')}`).join('; ') || 'clean'})`);
  for (const code of ['interpenetration', 'deployable-sweep', 'ring-clearance', 'ring-tilt', 'ring-offset', 'mate-gap', 'mate-normal', 'hardpoint-buried', 'floating', 'giant-slab', 'module-too-thin', 'plume-impingement', 'boom-open-end']) ok(!s.findings.some((f) => f.code === code), `${s.id}: no ${code}`);
}
/* the plume law itself, and the drive radiator layout the drawing and the audit share */
{
  const drive = measureAnyShip('colony-v5').solved.nodes.find((n) => n.part.kind === 'drive').part;
  const plume = plumeOf(drive);
  ok(plume && plume.dir[1] === 1 && plume.exitR >= drive.store.d / 2, 'a magazine drive\u2019s plume opens from its pusher plate aft');
  ok(plumeDepth(plume, [0, drive.dims.l + 10, 0]) > plume.exitR && plumeDepth(plume, [0, drive.dims.l - 1, 0]) === -Infinity && plumeDepth(plume, [plume.exitR + 100, drive.dims.l + 1, 0]) < 0, 'inside the cone is positive, forward of the exit plane is never in it, far outside is negative');
  const panels = driveRadiatorPanels(drive);
  ok(panels.length === 8 && panels.every((q) => q.yc + q.pLen / 2 <= drive.dims.l + 1e-9 && q.pWid <= drive.store.d * 0.9 + 1e-9), `the colony\u2019s 91,000 m2 of drive radiator is eight panels along the store, none past the exit plane (${panels.length})`);
  near(panels.reduce((s, q) => s + q.areaM2, 0) + panels.shortfall, drive.radiator.areaM2, 1e-9, 'the panels carry the law\u2019s area or state the shortfall');
  ok(panels.every((q) => Math.abs(Math.sin(2 * q.az)) < 1e-9), 'eight panels stand at the 0/90/180/270 stations, clear of the 45 degree hull rails');
}
ok(audit.summary.errors === 0, `the fleet audits clean (${audit.summary.errors} errors, ${audit.summary.warns} warnings)`);
ok(audit.summary.warns <= 3 && Object.keys(audit.summary.byCode).every((c) => c === 'module-too-fat'), 'the only warnings are the v1 seed cargo can, which v1 pins as published');

/* ---------- the models, headlessly ---------- */
if (!hasThree()) {
  console.log(`centauri geometry audit: ${checks} checks pass (mesh audit skipped: vendor/three-0.160.0 is not checked out)`);
} else {
  register('./three-node-resolver.mjs', import.meta.url);
  const THREE = await import('three');
  const { buildCentauriModel, centauriPart } = await import('./parts/centauri-models.js');
  const { buildRoboticModel } = await import('./parts/robotic-models.js');
  const { addHumanDetail } = await import('./parts/detail-pass.js');
  const { DETAIL, boltsFor, cylSurface, torusSurface } = await import('./parts/primitives/detail.js');
  const { liveryPlan, LIVERIES, PALETTE, gridFor, cellFor, classOf, liveryFor, PAINTABLE, THERMAL } = await import('./parts/primitives/livery.js');
  const { torusDeckMesh, solarArrayMesh, radiatorMesh } = await import('./parts/primitives/mesh.js');
  const { measureAny } = await import('./parts/geometry-audit.js');
  const { auditModelMeshes } = await import('./centauri-mesh-audit.js');

  /* real sizes, stated once */
  near(DETAIL.handrail.d, 0.038, 1e-9, 'handrail tube is 38 mm'); near(DETAIL.handrail.standoff, 0.055, 1e-9, 'handrail standoff is 55 mm');
  near(DETAIL.ladder.pitch, 0.28, 1e-9, 'ladder rungs at 280 mm'); near(DETAIL.hatch.cbm.w, 1.27, 1e-9, 'a CBM hatch is 1.27 m'); near(DETAIL.hatch.idss.d, 0.8, 1e-9, 'an IDSS passage is 0.8 m');
  near(DETAIL.window.cupola.d, 0.8, 1e-9, 'the Cupola window is 80 cm'); near(DETAIL.window.dragon.d, 0.3, 1e-9, 'a Dragon window is 30 cm');
  ok(boltsFor(1.27, 'cbm') === 16 && boltsFor(1.2, 'idss-1200') === 12 && boltsFor(1.575, 'paf-1575') === 120, 'bolt circles carry the connector’s real count');
  ok(Object.values(DETAIL).every((v) => typeof v !== 'object' || v.source || Object.values(v).some((x) => x?.source) || v.heightM), 'every detail size names its source');
  {
    const s = cylSurface(2.25), a = s.at(0.3, 4, 0.055);
    near(Math.hypot(a.p[0], a.p[2]), 2.305, 1e-9, 'a fitting at a standoff sits that far off the skin');
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(a.q); near(up.dot(new THREE.Vector3(Math.cos(0.3), 0, Math.sin(0.3))), 1, 1e-9, 'its +y is the outward normal');
    const t = torusSurface(55.9, 2).at(1, 0); near(Math.hypot(t.p[0], t.p[2]), 57.9, 1e-9, 'a torus fitting at the equator sits on the outer skin');
  }
  /* the ring primitive: collar round the hub, spokes from collar to tube */
  {
    const ring = torusDeckMesh({ R: 55.9, D: 4, hubR: 2.1, hubL: 1 });
    ok(ring.userData.ring.hubR === 2.1, 'the ring collar takes the mated hub radius');
    const spokes = []; ring.traverse((o) => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && Math.abs(o.scale.y - 1) < 1e-9 && o.geometry.parameters.height > 40) spokes.push(o); });
    ok(spokes.length === 6, 'six spokes');
    for (const sp of spokes) { const L = sp.geometry.parameters.height; near(L, 55.9 - 2 * 0.98 - (2.1 + ring.userData.ring.collarT), 1e-6, 'a spoke runs from the collar to the tube inner wall'); }
    const full = [], cut = []; ring.traverse((o) => { if (o.userData.cutaway === 'full') full.push(o); if (o.userData.cutaway === 'cut') cut.push(o); });
    ok(full.length === 1 && full[0].visible && cut.length >= 2 && cut.every((o) => !o.visible), 'the ring draws whole; the cutaway shell and decks wait for the toggle');
  }
  {
    const w = solarArrayMesh({ L: 34, W: 11, angles: accordionAngles, standoff: 1.2 }), b = new THREE.Box3().setFromObject(w.group);
    near(b.max.y, 35.2, 0.02, 'the blanket runs from the standoff to the standoff plus the wing');
    w.setDeploy(0); w.group.updateMatrixWorld(true); const bp = new THREE.Box3().setFromObject(w.group);
    ok(bp.min.y > -0.01, 'packed, nothing of the wing lies behind its mount');
    const r = radiatorMesh({ panelL: 15.2, panelW: 6.1, angles: accordionAngles, standoff: 0.6 }); r.setDeploy(0); r.group.updateMatrixWorld(true);
    ok(new THREE.Box3().setFromObject(r.group).min.y > -0.01, 'packed, nothing of the radiator lies behind its mount');
  }

  const MIN = (id, kind) => ({ crewed: { handrail: 20, bolt: 64, rivet: 200, 'hatch-door': 1, glazing: 1, nameplate: 2, tether: 4, clamp: 4 }, probe: { bolt: 12, nameplate: 1, target: 0 }, chip: {} })[kind];
  let liveryTotal = 0;
  for (const id of ALL_SHIP_IDS) {
    const v5 = SHIP_IDS.v5.includes(id);
    const g = v5 ? buildRoboticModel(id) : buildCentauriModel(id);
    g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
    const m = g.userData.measure;
    /* every part frame built something finite */
    let bad = 0, frames = 0, emptyFrames = [];
    g.userData.stages.get(0).traverse((o) => {
      if (o.userData?.part) {
        frames += 1;
        const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3());
        if (!(Number.isFinite(s.x) && s.x + s.y + s.z > 1e-6)) emptyFrames.push(o.userData.partName);
      }
      if (o.isMesh) { const p = o.geometry.attributes.position; if (!p || p.count === 0) bad += 1; else { for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 50))) if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))) { bad += 1; break; } } if (!o.geometry.attributes.normal && !o.isLine) bad += 1; }
    });
    ok(frames === m.solved.nodes.filter((n) => n.part.kind !== 'sail').length, `${id}: every placed part (but the film, drawn separately) has a frame (${frames})`);
    ok(bad === 0, `${id}: no empty, NaN or normal-less mesh (${bad})`);
    ok(emptyFrames.length === 0, `${id}: every part draws something (${emptyFrames.join(', ') || 'all'})`);
    /* each part's drawn box sits inside its catalogue envelope, with slack for fittings and standoffs */
    const over = [];
    for (const n of m.solved.nodes) {
      if (['sail', 'landing-gear', 'spin-bola', 'rail-network', 'solar-array', 'radiator', 'grid-fins'].includes(n.part.kind)) continue;
      const frame = []; g.userData.stages.get(0).traverse((o) => { if (o.userData?.partName === n.name) frame.push(o); });
      if (!frame.length) continue;
      const inv = new THREE.Matrix4().copy(frame[0].matrixWorld).invert();
      const box = new THREE.Box3();
      /* each mesh's geometry box taken straight into the part's frame (a world box turned back would inflate every tilted rod) */
      frame[0].traverse((o) => { if (o.isMesh && !o.userData.detail) { o.updateWorldMatrix(true, false); if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const local = new THREE.Matrix4().copy(inv).multiply(o.matrixWorld); const b = o.geometry.boundingBox.clone().applyMatrix4(local); if (Number.isFinite(b.min.x)) box.union(b); } });
      const d = n.part.dims.d, l = n.part.dims.l, y0 = n.part.origin === 'centre' ? -l / 2 : 0;
      /* an engine bell stands proud of the stage or trunk it belongs to (Orion's AJ10 by 1.2 m), a dish's feed proud of its reflector */
      const engines = ['service-module', 'trim-stage', 'lander', 'lander-aero', 'drive', 'dish'].includes(n.part.kind);
      /* the slack is for fittings a part carries outside its envelope (an airlock's gas tanks, a module's racks, a star tracker on the fore face); a mis-scaled or misplaced body is many times this */
      const slackR = Math.max(1.0, d * 0.5), slackY = Math.max(1.0, l * (engines ? 0.55 : 0.3));
      let rMax = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z));
      /* a reactor's heat-pipe radiator wings stand out from its core by the spec's panel width (the geometry audit carries them as bodies) */
      if (n.part.kind === 'reactor' || n.part.kind === 'reactor-fsp') { const rad = n.part.reactor?.radiator; const wing = rad ? rad.panelW * rad.perSide : d * 0.7; rMax = Math.max(0, rMax - wing); }
      /* a drive's radiator panels stand out from the store by up to 1.8 store radii (parts/propulsion.js radiatorFor) */
      if (n.part.kind === 'drive' && n.part.radiator?.areaM2 > 0) rMax = Math.max(0, rMax - Math.min(n.part.store.d * 0.9, n.part.radiator.areaM2 / 4 / Math.max(0.46 * n.part.store.l, 1)));
      if (rMax > d / 2 + slackR || box.min.y < y0 - slackY || box.max.y > y0 + l + slackY) over.push(`${n.name} (${n.part.kind}) r ${rMax.toFixed(1)} vs ${(d / 2).toFixed(1)}, y ${box.min.y.toFixed(1)}..${box.max.y.toFixed(1)} vs ${y0.toFixed(1)}..${(y0 + l).toFixed(1)}`);
    }
    ok(over.length === 0, `${id}: every part's drawing stays inside its envelope (${over.join('; ') || 'all'})`);
    /* the whole hull's box is the solver's hull box, within a part's slack */
    const hullBox = new THREE.Box3().setFromObject(g.userData.stages.get(0)), hs = hullBox.getSize(new THREE.Vector3());
    const summaryHull = summarize(m.solved.nodes.filter((n) => n.part.kind !== 'sail')).bounds;
    /* a drive's radiator panels stand out of its envelope by up to 1.8 store radii each side (the geometry audit carries them as bodies) */
    const driveNode = m.solved.nodes.find((n) => n.part.kind === 'drive' && n.part.radiator?.areaM2 > 0);
    const radAllow = driveNode ? 2 * driveNode.part.store.d * 1.4 : 0;
    ok(hs.x <= (summaryHull.size[0] + radAllow + 3) * 1.3 && hs.z <= (summaryHull.size[2] + radAllow + 3) * 1.3 && hs.y <= (summaryHull.size[1] + 3) * 1.3, `${id}: the drawn hull is no bigger than the solved envelope (${hs.x.toFixed(0)} x ${hs.y.toFixed(0)} x ${hs.z.toFixed(0)} m against ${summaryHull.size.map((v) => v.toFixed(0)).join(' x ')})`);

    /* the attachment audit (centauri-mesh-audit.js): every drawn fitting touches its part or a chain of fittings that does,
       no flat box sits tangent to a curved skin with a slit under it, nothing of one part reaches inside another, every
       side-mounted part's drawn mount reaches its parent, the sail hardware hangs on the drum */
    const ma = auditModelMeshes(g, m);
    for (const code of ['fitting-floating', 'underside-gap', 'fitting-poke', 'part-unseated']) ok(!ma.findings.some((f) => f.code === code), `${id}: no ${code} (${ma.findings.filter((f) => f.code === code).map((f) => f.message.slice(0, 90)).join('; ') || 'clean'})`);
    ok(ma.meshes > 5, `${id}: the mesh audit saw the model (${ma.meshes} meshes in ${ma.frames} frames)`);
    /* sail hardware rings: every torus in the mechanism (the gimbal's outer ring, the drum rings, the reel) is concentric with the
       thrust axis and perpendicular to it, except the gimbal's inner ring, which is on the crossed axis by design */
    if (g.userData.sail && g.userData.sail.architecture !== 'starchip-disc') {   // the released disc has no drum and no rings
      const film = g.userData.stages.get(1); film.updateMatrixWorld(true);
      const filmFrame = film.children[0];
      const normal = new THREE.Vector3(0, 1, 0).transformDirection(filmFrame.matrixWorld), origin = new THREE.Vector3().setFromMatrixPosition(filmFrame.matrixWorld);
      let rings = 0, off = 0;
      film.traverse((o) => {
        if (!o.isMesh || o.geometry.type !== 'TorusGeometry' || o.userData.tethered) return;
        o.updateWorldMatrix(true, false);
        const axis = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld), c = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        const tilt = Math.acos(Math.min(1, Math.abs(axis.dot(normal)))) * 180 / Math.PI;
        const radial = c.clone().sub(origin).projectOnPlane(normal).length();
        rings += 1;
        /* the gimbal trims the drum by 0.02 rad at k = 1 (mechanism gimbalRad), so its rings may tilt that much; anything more is a seating error */
        if (tilt > 0.02 * 180 / Math.PI + 0.5) off += 1;
        if (radial > Math.max(0.01, 0.01 * o.geometry.parameters.radius)) off += 1;
      });
      ok(rings >= 4 && off === 0, `${id}: the sail's ${rings} rings seat concentric and square on the hub (${off} off)`);
    }

    /* the human-scale detail layer */
    const det = addHumanDetail(g, { registration: g.userData.livery.registration }), c = det.userData.counts;
    const crewed = m.solved.nodes.some((n) => (n.part.volume?.pressurised ?? 0) > 20);
    const klass = crewed ? 'crewed' : /wafer/.test(id) ? 'chip' : 'probe';
    const windowed = m.solved.nodes.some((n) => ['pressurised-module', 'obs-deck', 'airlock', 'crew-capsule'].includes(n.part.kind));
    for (const [tag, min] of Object.entries(MIN(id, klass))) { if (tag === 'glazing' && !windowed) continue; ok((c[tag] ?? 0) >= min, `${id}: at least ${min} ${tag} fittings (${c[tag] ?? 0})`); }
    if (/lander/.test(id)) ok((c['ladder-rung'] ?? 0) >= 4, `${id}: a ladder on the lander (${c['ladder-rung'] ?? 0} rungs)`);
    ok(det.children.every((o) => o.userData.detail), `${id}: the detail layer is tagged`);
    /* instance scale carries the real sizes: a handrail is 38 mm, a bolt head 17 mm */
    const rails = det.children.find((o) => o.isInstancedMesh && o.geometry === det.children.find((x) => x.userData.tag === 'tube')?.geometry);
    if (c.handrail) {
      const inst = det.children.find((o) => o.isInstancedMesh && o.material.userData.surface === 'gold' && o.userData.tag === 'tube');
      const mm = new THREE.Matrix4(); inst.getMatrixAt(0, mm); const sc = new THREE.Vector3().setFromMatrixScale(mm);
      near(sc.x * 2, DETAIL.handrail.d, 1e-6, `${id}: a handrail is drawn at 38 mm`);
    }
    if (c.bolt) {
      const inst = det.children.find((o) => o.isInstancedMesh && o.userData.tag === 'hex' && o.material.userData.surface === 'dark');
      const mm = new THREE.Matrix4(); inst.getMatrixAt(0, mm); const sc = new THREE.Vector3().setFromMatrixScale(mm);
      ok(Math.abs(sc.x * 2 - DETAIL.bolt.headAF) < 1e-6 || Math.abs(sc.x * 2 - 0.016) < 1e-6, `${id}: a bolt head is drawn at its real across-flats`);
    }
    ok(det.children.length < 60, `${id}: the detail layer is instanced (${det.children.length} draw calls for ${Object.values(c).reduce((a, b) => a + b, 0)} fittings)`);

    /* the livery plan: only paintable surfaces, square cells, thermal surfaces untouched, the class's livery */
    const plan = liveryPlan(g, g.userData.livery);
    ok(g.userData.livery === liveryFor(id) && LIVERIES[classOf(id)] === g.userData.livery, `${id}: wears the ${g.userData.livery.name} livery of its class`);
    ok(plan.every((p) => !(THERMAL.has(p.surface) && p.pattern !== 'none')), `${id}: no thermal or optical surface is painted`);
    const painted = plan.filter((p) => p.pattern !== 'none');
    liveryTotal += painted.length;
    for (const p of painted.slice(0, 40)) {
      if (!p.grid || p.grid.kind === 'BoxGeometry') continue;
      const cellU = p.grid.circ / p.grid.N, cellV = p.grid.len / p.grid.M;
      ok(Math.abs(cellU / cellV - 1) < 0.6 || p.grid.M === 1, `${id}: ${p.part} ${p.kind} cells are square (${cellU.toFixed(2)} x ${cellV.toFixed(2)} m on ${p.grid.N} x ${p.grid.M})`);
      ok(p.grid.N >= 2, `${id}: ${p.part} has at least two cells round`);
    }
    if (!/wafer/.test(id)) ok(painted.length > 0, `${id}: something is painted (${painted.length} surfaces)`);
    if (crewed) ok(painted.some((p) => ['checker', 'checkerBand', 'chevronBands'].includes(p.pattern)), `${id}: a crewed ship carries a checker or chevron band`);
  }
  ok(liveryTotal > 1000, `the fleet paints ${liveryTotal} surfaces from data`);
  /* the palette and liveries */
  ok(Object.values(PALETTE).every((h) => /^#[0-9a-f]{6}$/.test(h)), 'every paint is a hex colour');
  ok(Object.keys(LIVERIES).length === 8 && Object.values(LIVERIES).every((l) => PALETTE[l.primary] && PALETTE[l.secondary] && PALETTE[l.accent] && l.checker.length === 2 && l.registration && l.rules.default), 'eight liveries, one per class, each complete');
  near(cellFor(4.5), 4.5 * Math.PI / 8, 1e-9, 'a 4.5 m module gets eight cells round'); ok(cellFor(0.3) === 0.35 && cellFor(60) === 6, 'cells are clamped to 0.35-6 m');
  ok(gridFor(new THREE.CylinderGeometry(2.25, 2.25, 8, 48)).N === Math.round((2 * Math.PI * 2.25) / cellFor(4.5)), 'a cylinder’s cell count round comes from its real circumference');
  ok(gridFor(new THREE.TorusGeometry(55.9, 2, 24, 128)).N === Math.round((2 * Math.PI * 55.9) / Math.max(cellFor(4), (2 * Math.PI * 55.9) / 160)), 'a torus\u2019s cell count round the ring comes from its real circumference, capped at 160 cells');
  console.log(`centauri geometry audit: ${checks} checks pass`);
}
