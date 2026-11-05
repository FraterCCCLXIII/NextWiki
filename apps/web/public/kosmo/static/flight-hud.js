// flight-hud.js -- HUD pieces shared by the Landing Lab and the Shipyard: telemetry table, time-series plots, event log.
//
//   telemetryHTML([[label, value], ...])            -> <tr> rows for a <table class="tele">
//   drawPlots(canvas, hist, panes)                   hist: [{ t, ... }], panes: [{ name, f(point), col, lo, hi? }]
//   createEventLog(el)  .sync(events) .clear()       events: [{ t, txt, kind }] (kind: good | bad | stage)

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const telemetryHTML = rows => rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('');

export function drawPlots(canvas, hist, panes) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height; g.clearRect(0, 0, W, H);
  if (!hist.length) return;
  const T = Math.max(hist[hist.length - 1].t, 10), ph = H / panes.length;
  panes.forEach((pn, i) => {
    const y0 = i * ph + 16, y1 = (i + 1) * ph - 6, vals = hist.map(pn.f), hi = pn.hi ?? Math.max(1, ...vals) * 1.05, lo = pn.lo ?? 0;
    g.fillStyle = '#8a9bb8'; g.font = '20px sans-serif'; g.fillText(pn.name + '  ' + vals[vals.length - 1].toFixed(0), 8, y0 - 2);
    g.strokeStyle = 'rgba(140,170,220,0.14)'; g.beginPath(); g.moveTo(0, y1); g.lineTo(W, y1); g.stroke();
    g.strokeStyle = pn.col; g.lineWidth = 2; g.beginPath();
    hist.forEach((p, k) => { const x = p.t / T * (W - 8) + 4, y = y1 - (pn.f(p) - lo) / (hi - lo) * (y1 - y0); k ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  });
}

export function createEventLog(el, fmt = t => t.toFixed(1) + ' s') {
  let n = 0;
  return {
    clear() { n = 0; el.innerHTML = ''; },
    sync(events) { while (n < events.length) { const ev = events[n++]; el.insertAdjacentHTML('beforeend', `<div class="${esc(ev.kind)}"><span class="t">${fmt(ev.t)}</span>${esc(ev.txt ?? ev.text)}</div>`); el.scrollTop = el.scrollHeight; } },
  };
}
