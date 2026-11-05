/* Chebyshev ephemeris evaluator for ephemeris.json (baked by tools/bake-ephemeris.mjs).
 * bodyState(id, jd) -> { r:[x,y,z] metres, v:[vx,vy,vz] m/s }
 *   planets: heliocentric, ecliptic J2000; moon: geocentric, ecliptic J2000.
 * covers(id, jd) -> true when the data holds that body at that JD (TDB).
 * Node: loads ephemeris.json synchronously on require.
 * Browser/worker: call load() (done automatically next to this script); until
 * it resolves, covers() is false and callers should use their fallback.
 */
(function (root) {
  'use strict';
  const DAY = 86400;
  const SCRIPT_URL = (function () {
    try {
      const s = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
        || (typeof self !== 'undefined' && self.location && self.location.href) || '';
      return s ? new URL('ephemeris.json', s).href : 'ephemeris.json';
    } catch (e) { return 'ephemeris.json'; }
  })();

  let data = null;
  let loading = null;

  function install(doc) {
    if (!doc || !doc.bodies || !doc.degree) throw Error('Invalid ephemeris document.');
    data = doc;
    return api;
  }

  function load(url) {
    if (data) return Promise.resolve(api);
    if (loading) return loading;
    if (typeof fetch !== 'function') return Promise.reject(Error('fetch unavailable'));
    loading = fetch(url || SCRIPT_URL)
      .then((r) => { if (!r.ok) throw Error('ephemeris.json HTTP ' + r.status); return r.json(); })
      .then(install)
      .catch((e) => { loading = null; throw e; });
    return loading;
  }

  // Node: read the file once, next to this script.
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try {
      const fs = require('fs');
      const path = require('path');
      install(JSON.parse(fs.readFileSync(path.join(__dirname, 'ephemeris.json'), 'utf8')));
    } catch (e) { data = null; }
  }

  function range(id) {
    const b = data && data.bodies[id];
    if (!b) return null;
    return { b, start: b.jd0, end: b.jd0 + b.nseg * b.segDays };
  }

  function covers(id, jd) {
    const g = range(id);
    return !!g && jd >= g.start && jd <= g.end;
  }

  function bodyState(id, jd) {
    const g = range(id);
    if (!g) throw Error('No ephemeris loaded for ' + id + '.');
    if (!(jd >= g.start && jd <= g.end)) throw Error('JD ' + jd + ' outside ephemeris range for ' + id + '.');
    const b = g.b, N = data.degree + 1, seg = b.segDays;
    const t = jd - b.jd0;
    const i = Math.min(b.nseg - 1, Math.max(0, Math.floor(t / seg)));
    const x = Math.max(-1, Math.min(1, (2 * (t - i * seg)) / seg - 1));
    // T_k(x) and dT_k/dx by recurrence.
    const T = new Float64Array(N), dT = new Float64Array(N);
    T[0] = 1; T[1] = x; dT[0] = 0; dT[1] = 1;
    for (let k = 2; k < N; k++) {
      T[k] = 2 * x * T[k - 1] - T[k - 2];
      dT[k] = 2 * T[k - 1] + 2 * x * dT[k - 1] - dT[k - 2];
    }
    const dxdt = 2 / seg; // per day
    const off = i * N;
    const r = [0, 0, 0], v = [0, 0, 0];
    const axes = [b.x, b.y, b.z];
    for (let a = 0; a < 3; a++) {
      const c = axes[a];
      let s = 0, ds = 0;
      for (let k = 0; k < N; k++) {
        const ck = c[off + k];
        s += ck * T[k];
        ds += ck * dT[k];
      }
      r[a] = s;
      v[a] = (ds * dxdt) / DAY; // m/day -> m/s
    }
    return { r, v };
  }

  const api = { load, install, covers, bodyState, get ready() { return !!data; }, get data() { return data; } };

  // Browser or worker: start loading once, quietly.
  if (!(typeof module !== 'undefined' && module.exports) && typeof fetch === 'function' && !data) {
    load().catch(() => {});
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ephemeris = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
