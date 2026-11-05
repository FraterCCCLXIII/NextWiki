/* Kosmographica craft layer: hosts the Orbital Flight Deck (./flight/) in a dock inside the space view,
 * keeps one shared craft state, draws the craft in the scene and lets the camera follow it.
 *
 * Host contract (universe-timeline.html): KosmoCraft.init(ctx) once after the scene exists,
 * KosmoCraft.update(k) every frame from updateScene (k = scene units per metre).
 * Deck contract (flight/bridge.js): postMessage {kosmo:'craft', craft} out, {kosmo:'craft-tab', tab} in.
 *
 * Frames. The craft's world position is in galactic metres, like every body in the atlas:
 *   cruise (heliocentric-ecliptic)  -> SUN + eclipticToGalactic(r)
 *   ascent / landing (planet-inertial) -> shown planet position + eclipticToGalactic(R_x(obliquity) r * shownRadius / trueRadius)
 * The planet-local offset is scaled by shown/true radius so a craft at 400 km altitude sits above the
 * (possibly exaggerated) drawn globe instead of inside it.
 */
(function () {
  const TABS = [['deck', 'Flight deck'], ['overview', 'Mission'], ['vehicle', 'Vehicle'], ['launch', 'Launch'], ['budget', 'Budget'], ['catalog', 'Catalog'], ['dynamics', 'Dynamics']];
  const OBLIQUITY = 23.439281 * Math.PI / 180;
  const TRAIL = 240;
  const DECK_RADIUS = { Earth: 6378137 };   // the deck's physics uses WGS-84 for Earth

  const craft = { live: false, phase: null, frame: null, world: null, r: null, v: null, alt: 0, speed: 0, t: 0, duration: 0, running: false, title: '', follow: false, pos: null };
  let ctx = null, root = null, frame = null, marker = null, trail = null, trailPts = [], listeners = [];

  const emit = () => { for (const f of listeners) try { f(craft); } catch (e) { /* listener error */ } };
  const el = (tag, attrs = {}, text) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
  const fmtDist = m => !Number.isFinite(m) ? '—' : m >= 1.496e10 ? (m / 1.496e11).toFixed(3) + ' AU' : m >= 1e6 ? (m / 1e3).toFixed(0) + ' km' : m >= 1e3 ? (m / 1e3).toFixed(1) + ' km' : m.toFixed(0) + ' m';
  const fmtSpeed = v => !Number.isFinite(v) ? '—' : v >= 1e3 ? (v / 1e3).toFixed(2) + ' km/s' : v.toFixed(0) + ' m/s';

  /** Craft state -> galactic metres, or null when there is nothing to draw. */
  function worldOf(c) {
    if (!ctx || !c.r) return null;
    const { P, SUN, layout } = ctx;
    if (c.frame === 'heliocentric-ecliptic') {
      const g = P.eclipticToGalactic(c.r[0], c.r[1], c.r[2]);
      return [SUN[0] + g[0], SUN[1] + g[1], SUN[2] + g[2]];
    }
    if (c.frame === 'planet-inertial') {
      const name = c.world && layout().pos[c.world] ? c.world : 'Earth', pos = layout().pos[name];
      const shown = layout().r[name], truth = DECK_RADIUS[name] || P.ORBITS[name]?.radius || 1737.4e3, s = shown / truth;
      const co = Math.cos(OBLIQUITY), si = Math.sin(OBLIQUITY);   // equatorial -> ecliptic
      const x = c.r[0], y = c.r[1] * co - c.r[2] * si, z = c.r[1] * si + c.r[2] * co;
      const g = P.eclipticToGalactic(x * s, y * s, z * s);
      return [pos[0] + g[0], pos[1] + g[1], pos[2] + g[2]];
    }
    return null;   // 'local-concept' (non-solar destinations) has no place in the atlas yet
  }

  function onMessage(e) {
    if (e.origin !== window.location.origin || e.source !== frame?.contentWindow) return;
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.kosmo === 'craft-ready') { selectTab(currentTab); return; }
    if (d.kosmo !== 'craft' || !d.craft) return;
    const c = d.craft;
    const moved = c.phase !== craft.phase || c.title !== craft.title;
    Object.assign(craft, { live: !!c.r, phase: c.phase, frame: c.frame, world: c.world, r: c.r, v: c.v, alt: c.alt, speed: c.speed, t: c.t, duration: c.duration, running: c.running, title: c.title });
    if (moved) trailPts = [];
    craft.pos = worldOf(craft);
    if (craft.pos && !craft.pos.every(Number.isFinite)) craft.pos = null;
    if (craft.pos) {
      const last = trailPts[trailPts.length - 1];
      if (!last || Math.hypot(craft.pos[0] - last[0], craft.pos[1] - last[1], craft.pos[2] - last[2]) > 0) { trailPts.push(craft.pos); if (trailPts.length > TRAIL) trailPts.shift(); }
    }
    readout(); emit();
  }

  let currentTab = 'deck';
  function selectTab(tab) {
    currentTab = tab;
    for (const b of root.querySelectorAll('.kc-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    frame?.contentWindow?.postMessage({ kosmo: 'craft-tab', tab }, window.location.origin);
  }

  function readout() {
    if (!root) return;
    const r = root.querySelector('.kc-read');
    r.textContent = craft.live
      ? `${craft.phase?.toUpperCase()} · ${craft.world || craft.title || ''} · alt/dist ${fmtDist(craft.alt)} · v ${fmtSpeed(craft.speed)}${craft.pos ? '' : ' · (no atlas position)'}`
      : 'No trajectory yet. Run a segment in the deck.';
  }

  function setFollow(on) {
    craft.follow = on && !!craft.pos;
    if (on && !craft.pos) ctx.toast('Nothing to follow yet: run a segment in the flight deck');
    ctx.setFollow(craft.follow ? () => craft.pos : null);
    root.querySelector('.kc-follow').classList.toggle('on', craft.follow);
    if (craft.follow) frameCraft();
  }

  /** Zoom to a view width that suits the craft's situation (a few altitudes across, or the transfer). */
  function frameCraft() {
    const w = craft.frame === 'planet-inertial' ? Math.max(craft.alt * 6, 2e5) : Math.max(craft.alt * 0.6, 1e9);
    ctx.setZoom(Math.log10(w));
  }

  function buildDock() {
    const css = el('style'); css.textContent = `
      #kcBtn { position: absolute; right: 16px; bottom: 16px; z-index: 7; padding: 6px 12px; font: 12px ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: #c9d6e6; background: #0d0d0d; border: 1px solid rgba(140,190,255,.35); border-radius: 4px; cursor: pointer; }
      #kcBtn:hover, #kcBtn.on { color: #fff; border-color: rgba(140,190,255,.9); }
      #kcDock { position: absolute; right: 16px; bottom: 56px; z-index: 7; width: min(760px, calc(100vw - 32px)); height: min(560px, calc(100vh - 160px)); display: none; flex-direction: column; background: rgba(8,12,18,.92); border: 1px solid rgba(140,190,255,.3); border-radius: 6px; overflow: hidden; backdrop-filter: blur(6px); }
      #kcDock.open { display: flex; }
      #kcDock .kc-bar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.1); font: 11px ui-monospace, Menlo, monospace; color: #c9d6e6; }
      #kcDock .kc-tabs { display: flex; gap: 2px; flex: 1; overflow-x: auto; scrollbar-width: none; }
      #kcDock button { font: inherit; color: #9fb3c8; background: transparent; border: 1px solid transparent; border-radius: 3px; padding: 3px 8px; cursor: pointer; text-transform: uppercase; letter-spacing: .08em; white-space: nowrap; }
      #kcDock button:hover { color: #fff; border-color: rgba(140,190,255,.5); }
      #kcDock button.on { color: #7fc3ff; border-color: #7fc3ff; }
      #kcDock iframe { flex: 1; border: 0; width: 100%; background: #060a10; }
      #kcDock .kc-read { padding: 5px 10px; font: 11px ui-monospace, Menlo, monospace; color: #8fa3b8; border-top: 1px solid rgba(255,255,255,.1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`;
    document.head.appendChild(css);

    const btn = el('button', { id: 'kcBtn', type: 'button', title: 'Craft: mission planner, flight deck and dynamics (C)' }, 'Craft');
    root = el('div', { id: 'kcDock', role: 'dialog', 'aria-label': 'Craft' });
    const bar = el('div', { class: 'kc-bar' });
    const tabs = el('div', { class: 'kc-tabs' });
    for (const [id, label] of TABS) { const b = el('button', { type: 'button', 'data-tab': id }, label); b.addEventListener('click', () => selectTab(id)); tabs.appendChild(b); }
    const follow = el('button', { type: 'button', class: 'kc-follow', title: 'Camera follows the craft' }, 'Follow');
    follow.addEventListener('click', () => setFollow(!craft.follow));
    const frameBtn = el('button', { type: 'button', title: 'Zoom to the craft' }, 'Frame');
    frameBtn.addEventListener('click', () => { if (craft.pos) { if (!craft.follow) setFollow(true); else frameCraft(); } else ctx.toast('Nothing to frame yet'); });
    const close = el('button', { type: 'button', title: 'Close', 'aria-label': 'Close the craft dock' }, '×');
    close.addEventListener('click', () => toggle(false));
    bar.append(tabs, follow, frameBtn, close);
    frame = el('iframe', { title: 'Orbital Flight Deck' });   // src is set on first open, so no need for loading=lazy
    root.append(bar, frame, el('div', { class: 'kc-read' }));
    selectTabUi();
    document.body.append(btn, root);
    btn.addEventListener('click', () => toggle());
    window.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      toggle();
    });
    readout();
  }
  const selectTabUi = () => { root.querySelector('[data-tab="deck"]').classList.add('on'); };

  function toggle(open) {
    const on = open ?? !root.classList.contains('open');
    root.classList.toggle('open', on);
    document.getElementById('kcBtn').classList.toggle('on', on);
    if (on && !frame.src) frame.src = new URL('flight/index.html', document.baseURI).href;
  }

  function buildMarker() {
    const { THREE, scene } = ctx;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    marker = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x7fe3ff, size: 11, sizeAttenuation: false, transparent: true, depthTest: false }));
    marker.frustumCulled = false; marker.renderOrder = 20; marker.visible = false;
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.6, depthTest: false }));
    trail.frustumCulled = false; trail.renderOrder = 19; trail.visible = false;
    scene.add(marker, trail);
  }

  function update(k) {
    if (!marker) return;
    const p = craft.pos, { focus, toScene } = ctx;
    marker.visible = !!p;
    if (!p) { trail.visible = false; return; }
    const o = toScene(p, focus, k), a = marker.geometry.attributes.position;
    a.setXYZ(0, o[0], o[1], o[2]); a.needsUpdate = true;
    const n = trailPts.length, ta = trail.geometry.attributes.position;
    for (let i = 0; i < n; i++) { const s = toScene(trailPts[i], focus, k); ta.setXYZ(i, s[0], s[1], s[2]); }
    ta.needsUpdate = true; trail.geometry.setDrawRange(0, n); trail.visible = n > 1;
  }

  window.KosmoCraft = {
    state: craft,
    init(c) {
      ctx = c; buildMarker(); buildDock();
      window.addEventListener('message', onMessage);
      if (/[#&]craft\b/.test(location.hash)) toggle(true);
    },
    update,
    open: () => toggle(true), close: () => toggle(false),
    follow: setFollow,
    onChange(f) { listeners.push(f); return () => { listeners = listeners.filter(x => x !== f); }; },
  };
})();
