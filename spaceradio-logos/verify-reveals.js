/* Paste into the console of sheet.html (or load it with eval(await (await fetch('verify-reveals.js')).text())).
   Clicks every tile, then checks that it has animations, that no animated property reverses, that easings never overshoot,
   that every animation ends on its rest value and that the finished paint list equals the static markup. */
window.verifyReveals = async function (from = 1, to = Object.keys(SR.LOGOS).length) {
  const res = [], num = s => (String(s).match(/-?\d*\.?\d+(?:e-?\d+)?/g) || []).map(Number);
  for (let n = from; n <= to; n++) {
    const tile = document.querySelector(`.tile[data-n="${n}"]`);
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const as = document.getAnimations().filter(a => tile.contains(a.effect.target));
    const rec = { n, count: as.length, reveal: tile.dataset.reveal, bad: [], dur: 0 };
    for (const a of as) {
      const kf = a.effect.getKeyframes().map(k => k.transform ? { ...k, transform: k.transform.replace(/^matrix\([^)]*\)\s*/, '') } : k), tm = a.effect.getTiming(); // a wipe's leading matrix only sets its angle
      rec.dur = Math.max(rec.dur, tm.delay + tm.duration);
      for (const e of [tm.easing, ...kf.map(k => k.easing)]) {
        const m = /cubic-bezier\(([^)]+)\)/.exec(e);
        if (m) { const [, y1, , y2] = m[1].split(',').map(Number); if (y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1) rec.bad.push('overshoot ' + e); }
        else if (e !== 'linear') rec.bad.push('easing ' + e);
      }
      if (tm.iterations !== 1 || tm.direction !== 'normal' || tm.fill !== 'both') rec.bad.push('timing');
      for (const p of Object.keys(kf[0]).filter(k => !['offset', 'computedOffset', 'easing', 'composite'].includes(k))) {
        const vals = kf.map(k => k[p]);
        if (p === 'opacity') { const v = vals.map(Number); for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) rec.bad.push('opacity reverses'); if (v[v.length - 1] !== 1) rec.bad.push('opacity end'); }
        else if (p === 'transform') {
          if (vals.some(x => /scale/.test(x))) { const v = vals.map(x => num(x)[0]); for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) rec.bad.push('mask grow reverses'); if (v[v.length - 1] !== 1) rec.bad.push('mask end'); }
          else { const v = vals.map(x => num(x).reduce((s, q) => s + Math.abs(q), 0)); for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1] + 1e-9) rec.bad.push('translate reverses'); if (v[v.length - 1] !== 0) rec.bad.push('translate end'); }
        } else if (p === 'strokeDashoffset') { const v = vals.map(x => num(x)[0]); for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1]) rec.bad.push('dash reverses'); }
        else rec.bad.push('unexpected property ' + p);
      }
    }
    as.forEach(a => a.finish());
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const svg = tile.querySelector('svg'), L = SR.LOGOS[n];
    const stat = L.p.map(p => p.L ? p.L.map(l => l[0] + '|' + l[1]).join('#') : (p.k === 'p' ? 'pap' : p.f) + '|' + p.d);
    const got = [...svg.querySelectorAll('.pt')].map(el => el.tagName === 'g' ? [...el.children].map(c => c.getAttribute('fill') + '|' + c.getAttribute('d')).join('#') : (el.classList.contains('pp') ? 'pap' : el.getAttribute('fill')) + '|' + el.getAttribute('d'));
    if (JSON.stringify(stat) !== JSON.stringify(got)) rec.bad.push('final paint list differs from static');
    for (const el of svg.querySelectorAll('.pt')) { const cs = getComputedStyle(el); if (cs.opacity !== '1') rec.bad.push('opacity ' + cs.opacity); if (cs.transform !== 'none') { const m = num(cs.transform); if (m.length !== 6 || Math.abs(m[0] - 1) > 1e-9 || Math.abs(m[3] - 1) > 1e-9 || [m[1], m[2], m[4], m[5]].some(v => Math.abs(v) > 1e-6)) rec.bad.push('transform ' + cs.transform); }   /* 1e-15 px of float dust is allowed */ }
    rec.masksLeft = svg.querySelectorAll('[mask]').length;
    rec.allFinished = as.every(a => a.playState === 'finished');
    res.push(rec);
  }
  return res;
};
