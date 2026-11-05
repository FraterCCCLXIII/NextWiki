// constellationAt(raDeg, decDeg) -> IAU abbreviation (J2000) using skycultures/boundaries.json.
// Plain JS, no deps. Browser: await constellationAt.load(url?) once, then call constellationAt().
// Method: count crossings of the boundary by the meridian ray running north from the point;
// edges are linear in (RA, Dec). Odd = inside, flipped for polygons that enclose the north pole.
function makeLookup(boundaries) {
  const polys = [];
  for (const abbr of Object.keys(boundaries)) {
    for (const ring of boundaries[abbr]) {
      let w = 0, minD = 90, maxD = -90;
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        let d = b[0] - a[0];
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        w += d;
        if (a[1] < minD) minD = a[1];
        if (a[1] > maxD) maxD = a[1];
      }
      const encloses = Math.abs(w) > 180;
      const north = encloses && minD + maxD > 0;
      polys.push({ abbr, ring, north, minD, maxD, encloses });
    }
  }
  return function (ra, dec) {
    ra = ((ra % 360) + 360) % 360;
    if (dec >= 90) dec = 90 - 1e-9; else if (dec <= -90) dec = -90 + 1e-9;
    for (const p of polys) {
      if (dec > p.maxD) { if (!(p.north)) continue; }
      const ring = p.ring, n = ring.length;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        const a = ring[i], b = ring[(i + 1) % n];
        let d = b[0] - a[0];
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        if (d === 0) continue;
        let t = ra - a[0];
        if (t > 180) t -= 360; else if (t < -180) t += 360;
        // half-open on the lower-RA end so shared vertices count once
        if (d > 0 ? (t >= 0 && t < d) : (t >= d && t < 0)) {
          const decAt = a[1] + (b[1] - a[1]) * (t / d);
          if (decAt > dec) cnt++;
        }
      }
      if (((cnt & 1) === 1) !== p.north) return p.abbr;
    }
    return null;
  };
}
var constellationAt = (function () {
  var impl = null;
  function f(ra, dec) { if (!impl) throw new Error("constellationAt: call constellationAt.load() first"); return impl(ra, dec); }
  f.load = function (url) {
    url = url || new URL("boundaries.json", (document.currentScript && document.currentScript.src) || location.href).href;
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) { impl = makeLookup(j.boundaries); return f; });
  };
  f.init = function (boundaries) { impl = makeLookup(boundaries); return f; };
  return f;
})();
if (typeof module !== "undefined" && module.exports) module.exports = { makeLookup: makeLookup, constellationAt: constellationAt };
if (typeof window !== "undefined") window.constellationAt = constellationAt;
