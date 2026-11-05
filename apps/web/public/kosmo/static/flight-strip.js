// flight-strip.js -- the bottom HUD strip shared by the Landing Lab and the Shipyard: speed and altitude gauges on the left, a curved
// mission timeline with milestones and the T+ clock in the middle, a g-force gauge and an engine cluster on the right.
//
//   const strip = createFlightStrip(el, { title, onScrub(t, { final }), onLive() });
//   strip.update({ warp: 'linear' | 'sqrt', t, head, duration, speed, alt, g, gMax, engines: { total, lit, throttle (0..1) }, milestones: [{ t, label }], title, live });
//
// The timeline is scrubbable: drag along the arc, click a milestone, or use the arrow keys while it has focus (Shift = 10 s).  The strip does
// not move any simulation itself -- it reports the time the user asks for through onScrub(t, { final }) (final = the pointer was released)
// and the host jumps there (both simulators are deterministic, so the host can rebuild the state by re-running to that time).
// `t` is the time being shown, `head` the furthest time ever simulated (the live edge), `duration` the length of the timeline.
// Layout: the strip is --strip-h tall (default 112 px) and sits at the bottom of the page; pages reserve that height so nothing overlaps it.

const CSS = `
.fstrip { position: absolute; left: 0; right: 0; bottom: 0; height: var(--strip-h, 112px); z-index: 5; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 24px 10px;
  background: linear-gradient(180deg, rgba(5,6,8,0) 0%, rgba(5,6,8,0.72) 30%, rgba(5,6,8,0.9) 100%); color: #e8eef7; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; user-select: none; }
.fstrip .grp { display: flex; align-items: center; gap: 14px; }
.fstrip .gauge { position: relative; width: 96px; height: 96px; flex: none; }
.fstrip .gauge svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.fstrip .gauge .lab { position: absolute; left: 0; right: 0; top: 22px; text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.8; }
.fstrip .gauge .val { position: absolute; left: 0; right: 0; top: 33px; text-align: center; font-size: 23px; line-height: 26px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; white-space: nowrap; }
.fstrip .gauge .unit { position: absolute; left: 0; right: 0; top: 62px; text-align: center; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.8; }
.fstrip .mid { position: relative; height: 100%; min-width: 0; margin: 0 22px; }
.fstrip .mid svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; cursor: ew-resize; touch-action: none; outline: none; }
.fstrip .mid:focus-within .arc-base { stroke: rgba(255,255,255,0.42); }
.fstrip .clock { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; pointer-events: none; }
.fstrip .clock .t { font-size: 38px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; line-height: 1; }
.fstrip .clock .t small { font-size: 22px; margin-right: 3px; opacity: 0.85; }
.fstrip .clock .ttl { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.72; margin-top: 3px; }
.fstrip .badge { position: absolute; left: calc(50% + 130px); bottom: 16px; display: flex; gap: 6px; align-items: center; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; }
.fstrip .badge .st { padding: 2px 7px; border: 1px solid rgba(255,255,255,0.35); border-radius: 4px; }
.fstrip .badge .st.replay { border-color: #ffb86b; color: #ffb86b; } .fstrip .badge .st.live { border-color: #7fe0a0; color: #7fe0a0; }
.fstrip .badge button { background: none; color: #7fc3ff; border: 1px solid rgba(127,195,255,0.5); border-radius: 4px; padding: 1px 8px; font: inherit; cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; }
.fstrip .cluster { width: 96px; height: 96px; flex: none; }
.fstrip text { font-family: inherit; }
@media (max-width: 900px) { .fstrip .gauge { width: 70px; height: 70px; } .fstrip .gauge .val { font-size: 20px; top: 22px; } .fstrip .gauge .lab { top: 11px; } .fstrip .gauge .unit { top: 46px; } .fstrip .cluster { display: none; } .fstrip .clock .t { font-size: 28px; } }
`;

const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const el = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent?.appendChild(n); return n; };
export const fmtClock = t => { const s = Math.max(0, Math.floor(t)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return [h, m, s % 60].map(x => String(x).padStart(2, '0')).join(':'); };

/** Dot positions (unit circle, y down) for an engine cluster of n engines: a centre engine and concentric rings, like a real engine bay. */
export function clusterLayout(n) {
  n = Math.max(1, Math.round(n)); if (n === 1) return [[0, 0, 0]];
  const pts = [[0, 0, 0]]; let left = n - 1, ring = 1;
  const cap = [6, 12, 18, 24];
  if (n <= 9) { // 1 + up to 8 on one ring (the Falcon octaweb)
    for (let i = 0; i < left; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / left; pts.push([Math.cos(a) * 0.62, Math.sin(a) * 0.62, 1]); } return pts;
  }
  const rings = []; let k = 0; while (left > 0) { const m = Math.min(left, cap[k] ?? 30); rings.push(m); left -= m; k++; }
  rings.forEach((m, r) => { for (let i = 0; i < m; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / m + (r % 2 ? Math.PI / m : 0); pts.push([Math.cos(a) * (0.3 + 0.62 * (r + 1) / rings.length), Math.sin(a) * (0.3 + 0.62 * (r + 1) / rings.length), r + 1]); } });
  return pts;
}
/** Which dots light first: the centre, then rings pairing opposite engines, so 3 lit looks like the real boostback/landing pattern. */
function lightOrder(pts) {
  const order = [0], rest = pts.map((p, i) => i).slice(1); const used = new Set();
  for (const i of rest) { if (used.has(i)) continue; used.add(i); order.push(i); let best = -1, bd = -1; for (const j of rest) { if (used.has(j)) continue; const d = Math.hypot(pts[i][0] + pts[j][0], pts[i][1] + pts[j][1]); if (best < 0 || d < bd) { best = j; bd = d; } } if (best >= 0 && pts[best][2] === pts[i][2]) { used.add(best); order.push(best); } }
  return order;
}

function gauge(parent, label, unit) {
  const box = document.createElement('div'); box.className = 'gauge';
  box.innerHTML = `<svg viewBox="0 0 100 100"><path class="trk" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3.2" stroke-linecap="round"/><path class="fil" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/></svg>
    <div class="lab">${label}</div><div class="val">0</div><div class="unit">${unit}</div>`;
  parent.appendChild(box);
  const a0 = 135, sweep = 270, pt = (a, r = 44) => [50 + r * Math.cos(a * Math.PI / 180), 50 + r * Math.sin(a * Math.PI / 180)];
  const arc = f => { const [x0, y0] = pt(a0), [x1, y1] = pt(a0 + sweep * f); return `M${x0.toFixed(2)},${y0.toFixed(2)} A44,44 0 ${sweep * f > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
  const trk = box.querySelector('.trk'), fil = box.querySelector('.fil'), val = box.querySelector('.val'), un = box.querySelector('.unit');
  trk.setAttribute('d', arc(0.999));
  return { set(frac, text, u) { fil.setAttribute('d', frac > 0.002 ? arc(clamp(frac, 0.002, 0.999)) : ''); val.textContent = text; val.style.fontSize = text.length > 5 ? '17px' : text.length > 4 ? '20px' : ''; if (u) un.textContent = u; } };
}

export function createFlightStrip(host, opts = {}) {
  if (!document.getElementById('fstrip-css')) { const st = document.createElement('style'); st.id = 'fstrip-css'; st.textContent = CSS; document.head.appendChild(st); }
  host.classList.add('fstrip'); host.innerHTML = '';
  const left = document.createElement('div'); left.className = 'grp'; host.appendChild(left);
  const gSpeed = gauge(left, 'SPEED', 'KM/H'), gAlt = gauge(left, 'ALTITUDE', 'KM');
  const mid = document.createElement('div'); mid.className = 'mid'; host.appendChild(mid);
  const right = document.createElement('div'); right.className = 'grp'; host.appendChild(right);
  const gG = gauge(right, 'G-FORCE', 'G');
  const clu = document.createElementNS(NS, 'svg'); clu.setAttribute('class', 'cluster'); clu.setAttribute('viewBox', '-1.25 -1.25 2.5 2.5'); right.appendChild(clu);

  // timeline: an arc that bows upward; points along it are looked up from sampled path lengths
  const W = 1000, H = 110, svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', tabindex: 0, role: 'slider', 'aria-label': 'Mission timeline' }, mid);
  const d = `M 70,${H - 30} Q ${W / 2},${H - 120} ${W - 70},${H - 30}`;
  const base = el('path', { d, class: 'arc-base', fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 2 }, svg);
  const prog = el('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, svg);
  const marks = el('g', {}, svg), headTick = el('line', { stroke: '#7fe0a0', 'stroke-width': 2, opacity: 0.0 }, svg), cursor = el('g', {}, svg);
  el('line', { x1: 0, y1: -9, x2: 0, y2: 9, stroke: '#fff', 'stroke-width': 3 }, cursor); el('circle', { r: 4.2, fill: '#050608', stroke: '#fff', 'stroke-width': 2 }, cursor);
  const total = prog.getTotalLength ? 1 : 1; let L = 1; const samples = [];
  const place = f => { const p = prog.getPointAtLength(f * L), q = prog.getPointAtLength(clamp(f * L + 1.5, 0, L)), r = prog.getPointAtLength(clamp(f * L - 1.5, 0, L)); return { x: p.x, y: p.y, ang: Math.atan2(q.y - r.y, q.x - r.x) * 180 / Math.PI }; };
  const clock = document.createElement('div'); clock.className = 'clock'; clock.innerHTML = '<div class="t"><small>T+</small><span>00:00:00</span></div><div class="ttl"></div>'; mid.appendChild(clock);
  const badge = document.createElement('div'); badge.className = 'badge'; badge.innerHTML = '<span class="st live">live</span><button type="button" hidden>to live</button>'; mid.appendChild(badge);

  let S = { t: 0, head: 0, duration: 30, milestones: [] }, dragging = false;
  const toF = t => { const x = clamp(t / S.duration, 0, 1); return S.warp === 'sqrt' ? Math.sqrt(x) : x; };       // time -> position on the arc (sqrt keeps a long mission's first minutes readable)
  const toT = f => (S.warp === 'sqrt' ? f * f : f) * S.duration;
  const rebuildSamples = () => { L = prog.getTotalLength(); samples.length = 0; for (let i = 0; i <= 240; i++) { const p = prog.getPointAtLength(i / 240 * L); samples.push(p.x); } };
  const fracAtX = clientX => { const r = svg.getBoundingClientRect(), x = (clientX - r.left) / r.width * W; let best = 0, bd = 1e9; samples.forEach((sx, i) => { const dd = Math.abs(sx - x); if (dd < bd) { bd = dd; best = i; } }); return best / 240; };
  const report = (t, final) => { opts.onScrub?.(clamp(t, 0, Math.max(S.head, S.duration)), { final }); };
  svg.addEventListener('pointerdown', e => { dragging = true; svg.setPointerCapture(e.pointerId); report(toT(fracAtX(e.clientX)), false); });
  svg.addEventListener('pointermove', e => { if (dragging) report(toT(fracAtX(e.clientX)), false); });
  const end = e => { if (!dragging) return; dragging = false; report(toT(fracAtX(e.clientX)), true); };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', () => { dragging = false; });
  svg.addEventListener('keydown', e => { const step = e.shiftKey ? 10 : 1; if (e.key === 'ArrowLeft') { report(S.t - step, true); e.preventDefault(); } else if (e.key === 'ArrowRight') { report(S.t + step, true); e.preventDefault(); } else if (e.key === 'Home') { report(0, true); e.preventDefault(); } else if (e.key === 'End') { report(S.head, true); e.preventDefault(); } });
  badge.querySelector('button').onclick = () => { opts.onLive?.(); };

  let cl = [], litOrder = [], clKey = '';
  function drawCluster(total, lit, thr = 1) {
    const key = String(total); if (key !== clKey) { clKey = key; clu.innerHTML = ''; cl = clusterLayout(total); litOrder = lightOrder(cl); const r = total > 20 ? 0.075 : total > 9 ? 0.12 : 0.17;
      el('circle', { cx: 0, cy: 0, r: 1.12, fill: 'none', stroke: 'rgba(255,255,255,0.28)', 'stroke-width': 0.05 }, clu); el('path', { class: 'thr', fill: 'none', stroke: '#fff', 'stroke-width': 0.09, 'stroke-linecap': 'round' }, clu); cl.forEach(p => el('circle', { cx: p[0], cy: p[1], r, class: 'dot', fill: '#4a4d52' }, clu)); }
    const on = new Set(litOrder.slice(0, clamp(lit, 0, cl.length))); [...clu.querySelectorAll('.dot')].forEach((c, i) => { c.setAttribute('fill', on.has(i) ? '#fff' : '#4a4d52'); c.setAttribute('opacity', on.has(i) ? 0.55 + 0.45 * clamp(thr, 0, 1) : 1); });
    // throttle arc around the cluster, like the one on the broadcast graphic: sweeps clockwise from the lower left
    const f = clamp(thr, 0, 1) * (on.size ? 1 : 0), a0 = 125 * Math.PI / 180, a1 = a0 + f * 1.5 * Math.PI, R = 1.12; clu.querySelector('.thr').setAttribute('d', f > 0.01 ? `M${(R * Math.cos(a0)).toFixed(3)},${(R * Math.sin(a0)).toFixed(3)} A${R},${R} 0 ${f * 1.5 > 1 ? 1 : 0} 1 ${(R * Math.cos(a1)).toFixed(3)},${(R * Math.sin(a1)).toFixed(3)}` : '');
  }

  const api = {
    update(u) {
      S = { ...S, ...u, milestones: u.milestones ?? S.milestones }; if (!(S.duration > 1)) S.duration = 30; S.head = Math.max(S.head ?? 0, S.t);
      if (!samples.length) rebuildSamples();
      const f = toF(S.t), fh = toF(S.head);
      prog.setAttribute('stroke-dasharray', `${f * L} ${L}`);
      const c = place(f); cursor.setAttribute('transform', `translate(${c.x},${c.y}) rotate(${c.ang})`);
      const h = place(fh); headTick.setAttribute('x1', h.x); headTick.setAttribute('x2', h.x); headTick.setAttribute('y1', h.y - 7); headTick.setAttribute('y2', h.y + 7); headTick.setAttribute('opacity', S.head - S.t > 0.5 ? 0.9 : 0);
      // milestones: labels are laid out in up to three rows so neighbours never overlap; a label that still does not fit is dropped (the dot stays)
      marks.innerHTML = '';
      const rows = [[], [], []], ROWY = [-15, -37, -59], CH = 10.5;
      const ms = [...S.milestones].sort((a, b) => a.t - b.t);
      for (const m of ms) {
        const mf = toF(m.t), p = place(mf), passed = m.t <= S.t + 1e-6, label = m.label.toUpperCase(), w = label.length * CH + 12;
        const anchor = p.x + w / 2 > W - 10 ? 'end' : p.x - w / 2 < 10 ? 'start' : 'middle', x0 = anchor === 'end' ? p.x - w : anchor === 'start' ? p.x : p.x - w / 2;
        let row = rows.findIndex(r => r.every(([a, b]) => x0 > b + 6 || x0 + w < a - 6));
        const g = el('g', { transform: `translate(${p.x},${p.y})`, style: 'cursor:pointer' }, marks);
        el('circle', { r: 12, fill: 'transparent' }, g); el('circle', { r: 4.6, fill: '#050608', stroke: passed ? '#fff' : 'rgba(255,255,255,0.4)', 'stroke-width': 2 }, g);
        if (row >= 0) {
          rows[row].push([x0, x0 + w]);
          if (row > 0) el('line', { x1: 0, y1: -5, x2: 0, y2: ROWY[row] + 4, stroke: passed ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', 'stroke-width': 1 }, g);
          const tx = el('text', { x: 0, y: ROWY[row], 'text-anchor': anchor, fill: passed ? '#fff' : 'rgba(255,255,255,0.4)', 'font-size': 15, 'font-weight': 800, 'letter-spacing': 0.5 }, g); tx.textContent = label;
        } else { const t = el('title', {}, g); t.textContent = m.label; }
        g.addEventListener('pointerdown', ev => { ev.stopPropagation(); opts.onScrub?.(m.t, { final: true }); });
      }
      clock.querySelector('.t span').textContent = fmtClock(S.t); clock.querySelector('.ttl').textContent = S.title ?? opts.title ?? '';
      const live = S.live ?? (S.head - S.t < 0.35), st = badge.querySelector('.st'); st.textContent = live ? 'live' : 'replay'; st.className = 'st ' + (live ? 'live' : 'replay'); badge.querySelector('button').hidden = live;
      svg.setAttribute('aria-valuenow', S.t.toFixed(1)); svg.setAttribute('aria-valuemax', S.duration.toFixed(1));
      // gauges
      const sp = S.speed ?? 0; gSpeed.set(Math.sqrt(clamp(sp / (S.speedMax ?? 30000), 0, 1)), Math.round(sp).toLocaleString('en-US'));
      const alt = S.alt ?? 0, big = alt >= 10000; gAlt.set(Math.sqrt(clamp(alt / (S.altMax ?? 400000), 0, 1)), big ? (alt / 1000).toFixed(alt >= 1e5 ? 0 : 1) : Math.round(alt).toLocaleString('en-US'), big ? 'KM' : 'M');
      gG.set(clamp((S.g ?? 0) / (S.gMax ?? 6), 0, 1), (S.g ?? 0).toFixed(1));
      if (S.engines) drawCluster(S.engines.total, S.engines.lit, S.engines.throttle ?? 1);
    },
  };
  return api;
}
