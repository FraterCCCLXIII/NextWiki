// scale-balance.js — pure functions behind the two "see more at once" knobs of the universe map.
//
//   import { compressDistance, compressVector, balanceRadius, layoutSystem } from './scale-balance.js';
//
// 1. Distance compression (gamma). Distances from a host are mapped by a power law around a reference
//    distance d0:   d' = d0 · (d / d0)^gamma,  0 < gamma <= 1.
//    gamma = 1 is the true layout; smaller gamma pulls far bodies in and pushes near ones out, keeping
//    d0 fixed. The map is strictly increasing, so the ORDER of bodies never changes, and it is applied to
//    the length of each radius vector only, so every DIRECTION is kept. Nothing here is physics: it is
//    a cartographic projection, like a log-polar map, and the UI says so whenever gamma < 1.
//
// 2. Size balance (beta). Radii are interpolated in log space between their true value (beta = 1) and a
//    common reference radius rRef (beta = 0):   r' = rRef^(1 - beta) · r^beta.
//    Big bodies shrink toward rRef and small ones grow toward it, so the size ORDER is kept too, while
//    the ratio between the largest and smallest body is raised to the power beta. rRef defaults to a
//    fraction (8 %) of the (compressed) innermost orbit, so at beta = 0 every body is a visible disc.
//
// 3. The clamp. Enlarged bodies must never swallow their neighbours' orbits: layoutSystem caps each
//    radius at `fill` times the gap to the orbit on either side (and to the host's surface), and caps the
//    host at half the innermost orbit. Every result carries exag = r' / r so labels can say "size ×40".

const isNum = x => typeof x === 'number' && Number.isFinite(x);

/** d0 · (d / d0)^gamma; identity for gamma = 1; 0 -> 0. */
export function compressDistance(d, d0, gamma = 1) {
  if (!(d > 0)) return 0;
  if (gamma === 1 || !(d0 > 0)) return d;
  return d0 * Math.pow(d / d0, gamma);
}

/** Inverse of compressDistance (for picking and for turning a wanted screen distance back into metres). */
export function expandDistance(dp, d0, gamma = 1) {
  if (!(dp > 0)) return 0;
  if (gamma === 1 || !(d0 > 0)) return dp;
  return d0 * Math.pow(dp / d0, 1 / gamma);
}

/** Compress the vector from `centre` to `p` (arrays of 3), keeping its direction. Returns a new array. */
export function compressVector(p, centre, d0, gamma = 1) {
  const dx = p[0] - centre[0], dy = p[1] - centre[1], dz = p[2] - centre[2];
  const d = Math.hypot(dx, dy, dz);
  if (!(d > 0)) return [centre[0], centre[1], centre[2]];
  const s = compressDistance(d, d0, gamma) / d;
  return [centre[0] + dx * s, centre[1] + dy * s, centre[2] + dz * s];
}

/** rRef^(1-beta) · r^beta: true at beta = 1, all equal to rRef at beta = 0. */
export function balanceRadius(r, rRef, beta = 1) {
  if (!(r > 0)) return 0;
  if (beta === 1 || !(rRef > 0)) return r;
  return Math.exp((1 - beta) * Math.log(rRef) + beta * Math.log(r));
}

/**
 * Lay out one system (a host with bodies on orbits around it) under the two knobs.
 *
 * bodies: [{ name, r, d }]  true radius and true distance from the host (metres); an optional `a`
 *         (semi-major axis) is used instead of `d` for the neighbour gaps so a body on an eccentric orbit
 *         does not resize as it moves. host: { r } true host radius; pass `fixed: true` with an already
 *         chosen (shown) radius when the host was sized by an outer layout (a planet whose moons are laid out).
 * opts:   gamma, beta (the knobs), size (overall radius multiplier, default 1), d0 (reference distance; default innermost orbit), rRef (default
 *         refFrac · d0'), refFrac (0.08), fill (0.4: fraction of a gap a body may fill), hostFill (0.5).
 *
 * returns { host: { r, exag }, bodies: [{ name, d, r, exag, clamped, scale }], d0, rRef, compressed, balanced }
 *         where `scale` = d' / d for the body (apply it to the true position vector relative to the host).
 */
export function layoutSystem(bodies, host, opts = {}) {
  const gamma = isNum(opts.gamma) ? Math.min(1, Math.max(1e-3, opts.gamma)) : 1;
  const beta = isNum(opts.beta) ? Math.min(1, Math.max(0, opts.beta)) : 1;
  const size = isNum(opts.size) && opts.size > 0 ? opts.size : 1;   // overall enlargement, on top of the balance; still clamped to the gaps below
  const fill = isNum(opts.fill) ? opts.fill : 0.4, hostFill = isNum(opts.hostFill) ? opts.hostFill : 0.5, refFrac = isNum(opts.refFrac) ? opts.refFrac : 0.08;
  const list = bodies.filter(b => b && b.d > 0);
  const gapOf = b => (b.a > 0 ? b.a : b.d);
  const dMin = list.length ? Math.min(...list.map(gapOf)) : 0;
  const d0 = opts.d0 > 0 ? opts.d0 : dMin;
  const hostTrue = host && host.r > 0 ? host.r : 0;

  // distances
  let out = list.map(b => ({ name: b.name, src: b, d: compressDistance(b.d, d0, gamma), g: compressDistance(gapOf(b), d0, gamma), r: 0, exag: 1, clamped: false, scale: 1 }));
  // a host whose size was fixed outside must stay inside its innermost orbit: scale all orbits up together
  if (host && host.fixed && hostTrue > 0 && out.length) {
    const gMin = Math.min(...out.map(o => o.g)), need = hostTrue / hostFill;
    if (gMin < need) { const s = need / gMin; for (const o of out) { o.d *= s; o.g *= s; } }
  }
  for (const o of out) o.scale = o.src.d > 0 ? o.d / o.src.d : 1;

  // radii: log-interpolate toward rRef, then clamp to the gaps
  const gMinShown = out.length ? Math.min(...out.map(o => o.g)) : d0;
  const rRef = opts.rRef > 0 ? opts.rRef : refFrac * gMinShown;
  let hostR = hostTrue;
  if (host && !host.fixed) {
    hostR = balanceRadius(hostTrue, rRef, beta) * size;
    if (out.length && hostR > hostFill * gMinShown) hostR = hostFill * gMinShown;
  }
  const byGap = [...out].sort((p, q) => p.g - q.g);
  for (let i = 0; i < byGap.length; i++) {
    const o = byGap[i], want = balanceRadius(o.src.r, rRef, beta) * size;
    const inner = i === 0 ? o.g - hostR : o.g - byGap[i - 1].g;
    const outer = i === byGap.length - 1 ? Infinity : byGap[i + 1].g - o.g;
    const gap = Math.min(inner > 0 ? inner : Infinity, outer > 0 ? outer : Infinity);   // co-orbital pairs (gap 0) are not clamped against each other
    const cap = fill * gap;
    o.r = Math.min(want, cap);
    o.clamped = want > cap;
    o.exag = o.src.r > 0 ? o.r / o.src.r : 1;
  }
  return {
    host: { r: hostR, exag: hostTrue > 0 ? hostR / hostTrue : 1 },
    bodies: out.map(({ name, d, r, exag, clamped, scale }) => ({ name, d, r, exag, clamped, scale })),
    d0, rRef, gamma, beta, compressed: gamma < 1, balanced: beta < 1,
  };
}

/** "×12" / "×0.3" / "" for the label. */
export function fmtExag(e) {
  if (!(e > 0) || Math.abs(Math.log10(e)) < 0.02) return '';
  return e >= 10 ? `×${Math.round(e)}` : e >= 1 ? `×${e.toFixed(1)}` : `×${e.toPrecision(2)}`;
}

/**
 * Pack many systems into one view: the "compressed sky".
 *
 * items: [{ name, pos: [x, y, z] (true position relative to the anchor, metres), extent }] where extent is
 *        the system's true outer radius (outermost orbit, or the star's radius when it has no planets).
 * opts:  gamma (power law on the distance from the anchor, d0 default 1 pc), beta (balance of system
 *        sizes toward eRef, 0..1), fill (0.42: fraction of the nearest-neighbour gap a system may fill; two neighbours at 0.42 each still leave a gap).
 *
 * Positions are compressed radially around the anchor (order and direction kept, like compressVector).
 * Each system's shown extent is extent' = eRef^(1-beta) · extent^beta, capped at fill × its gap to the
 * nearest other packed system (and to the anchor), so systems never overlap. mag = extent' / extent is
 * the uniform magnification to draw the whole system with.
 *
 * returns { items: [{ name, pos, dist, extent, mag, clamped }], d0, eRef }
 */
export function packSystems(items, opts = {}) {
  const gamma = isNum(opts.gamma) ? Math.min(1, Math.max(1e-3, opts.gamma)) : 1;
  const beta = isNum(opts.beta) ? Math.min(1, Math.max(0, opts.beta)) : 1;
  const fill = isNum(opts.fill) ? opts.fill : 0.42, d0 = opts.d0 > 0 ? opts.d0 : 3.0856775814913673e16;
  const out = items.filter(it => it && it.pos && it.extent > 0).map(it => {
    const d = Math.hypot(it.pos[0], it.pos[1], it.pos[2]), s = d > 0 ? compressDistance(d, d0, gamma) / d : 1;
    return { name: it.name, pos: [it.pos[0] * s, it.pos[1] * s, it.pos[2] * s], dist: d * s, src: it.extent, nn: Infinity, extent: 0, mag: 1, clamped: false };
  });
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    if (a.dist > 0) a.nn = a.dist;                       // the anchor itself (a system at the origin) is a neighbour too
    for (let j = 0; j < out.length; j++) { if (j === i) continue; const b = out[j], g = Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]); if (g > 0 && g < a.nn) a.nn = g; }
  }
  const gaps = out.map(o => o.nn).filter(Number.isFinite).sort((p, q) => p - q);
  const eRef = opts.eRef > 0 ? opts.eRef : gaps.length ? fill * gaps[gaps.length >> 1] : Math.max(...out.map(o => o.src), 1);
  for (const o of out) {
    const want = balanceRadius(o.src, eRef, beta), cap = Number.isFinite(o.nn) ? fill * o.nn : Infinity;
    o.extent = Math.min(want, cap); o.clamped = want > cap; o.mag = o.extent / o.src;
  }
  return { items: out.map(({ name, pos, dist, extent, mag, clamped }) => ({ name, pos, dist, extent, mag, clamped })), d0, eRef, gamma, beta };
}
