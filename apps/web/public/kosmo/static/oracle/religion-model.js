/* ============================================================================
   religion-model.js — a stage-structured model of worldview transmission.

   Nothing here is measured. It is a bookkeeping device for a question that has
   no data: if traditions update, if practice spreads, and if conversion is
   frequency-dependent, when could a post-integral share of the population
   become self-sustaining?

   The structure is deliberately the simplest one that can produce the two
   behaviours the literature agrees on:

     vertical      children inherit their parents' worldview imperfectly, and
                   fertility differs by worldview, so demography alone moves the
                   shares (Pew's finding, and the reason global secularisation
                   is not happening the way the nineteenth century expected)
     horizontal    adults reconsider, and the probability of adopting a
                   worldview rises faster than its prevalence — social proof.
                   That single exponent is what creates a critical mass.

   Where the analytic model has a threshold, this one has broadcast: institutions
   and media transmit a worldview to people who have never met an adherent, so a
   rare stage can grow below its critical mass. That is why the simulation's
   crossings sit earlier than the pure social-proof threshold, and the page says
   so rather than showing one number and calling it the answer.
   ============================================================================ */
(function (root) {
  "use strict";

  var STAGES = [
    { key: "trad", name: "Traditional", sub: "mythic · devotional · communal", color: "#c4a373" },
    { key: "modern", name: "Modern", sub: "rational · legal · individual", color: "#8aa4be" },
    { key: "plural", name: "Pluralistic", sub: "postmodern · constructivist", color: "#a9c0b4" },
    { key: "integral", name: "Integral", sub: "metamodern · systemic", color: "#a396b3" },
    { key: "nondual", name: "Nondual", sub: "evolutionary · post-representational", color: "#e2d6ae" }
  ];

  var BASELINE = {
    start: [0.600, 0.263, 0.113, 0.021, 0.003],
    rho: 0.07,        /* share of adults who reconsider their worldview each year */
    alpha: 1.15,      /* social-proof exponent: >1 means prevalence compounds */
    kappaHigh: 1.35,  /* relative attractiveness of the two highest stages */
    update: 1.0,      /* institutional update: >1 makes the next stage reachable */
    retention: 0.72,  /* baseline probability a child keeps a parent's worldview */
    fertDiff: 0.60,   /* extra relative fertility of the most traditional stage */
    capScale: 1.0,    /* how far education, leisure and practice raise the ceilings */
    horizon: 2200,
    gamma: 2.0,       /* awakening-event scaling with the number of nondual adults */
    eventUnit: 100e6  /* the nondual population at which events/century = 1 at gamma 2 */
  };

  /* Broadcast reach: what a worldview can transmit to someone who has never met
     an adherent — schooling, law, media, publishing, retreats. This is why a
     stage can grow below its social-proof threshold, and why the modern stage
     spreads in countries where religious adherence is still the majority.
     The values are the model's, not a measurement; they are the first thing to
     distrust when the trajectories look wrong. */
  var BASE_REACH = [0.060, 0.080, 0.050, 0.018, 0.008];

  /* Intrinsic adequacy: the developmental claim that a later stage handles more
     complexity. Without this the model has no reason to move at all, because
     conformity alone always favours the incumbent. */
  var KAPPA = [1.00, 1.12, 1.22, 1.70, 1.90];

  /* Intergenerational retention, close to Pew's measured 0.69-0.73 for the two
     largest US groups. The two highest stages keep more of their children
     because the worldview is chosen rather than inherited. */
  var KEEP = [0.74, 0.68, 0.66, 0.78, 0.84];

  /* Capacity: the share of adults who could sustain each stage under current
     schooling, leisure and practice. This is the constraint that conversion
     alone cannot lift — a population can be persuaded that a stage exists
     without being able to live in it. Post-formal development takes years of
     practice and a life with enough slack to do it, which is why the ceilings
     for the top two stages are small. The lever raises them; it does not assume
     they can be raised to 100%. */
  var CAP = [1.00, 0.78, 0.50, 0.20, 0.05];

  var ADULT_POP = 6.4e9;      /* world adults, 2025, for converting shares to heads */

  function adj(i, j) {
    var d = Math.abs(i - j);
    return d === 0 ? 1 : d === 1 ? 1 : d === 2 ? 0.12 : 0.01;
  }

  function normalise(v) {
    var s = 0, i;
    for (i = 0; i < v.length; i++) s += v[i];
    if (!(s > 0)) return v.map(function () { return 0; });
    return v.map(function (x) { return x / s; });
  }

  /* One year. Generational turnover first, then adult reconsideration. Both are
     proportion-preserving: the model asks about shares, not headcount. */
  function step(s, p) {
    var n = s.length, i, j;

    /* --- generational turnover, one thirtieth of the population a year --- */
    var cohort = 1 / 30;
    var w = [];
    for (i = 0; i < n; i++) w.push(s[i] * (1 + p.fertDiff * (1 - i / (n - 1))));
    var tot = w.reduce(function (a, b) { return a + b; }, 0);
    var births = w.map(function (x) { return x / tot; });

    /* children: inherit, or take the ambient culture of their cohort */
    var ambient = normalise(s.map(function (x, k) {
      var reach = BASE_REACH[k] * (k === 0 ? 1 : Math.pow(p.update, k));
      return KAPPA[k] * (reach + Math.pow(x + 1e-9, p.alpha));
    }));
    var kids = [];
    for (j = 0; j < n; j++) {
      var keep = Math.min(0.98, KEEP[j] * (p.retention / 0.72));
      var ceil = j === 0 ? 1 : Math.min(1, CAP[j] * p.capScale);
      var room = Math.max(0, 1 - s[j] / ceil);
      kids.push(births[j] * keep + (1 - keep) * ambient[j] * room);
    }
    kids = normalise(kids);

    var afterBirths = [];
    for (i = 0; i < n; i++) afterBirths.push((1 - cohort) * s[i] + cohort * kids[i]);
    afterBirths = normalise(afterBirths);

    /* --- adult switching: rho reconsider, destination weighted by social proof
           plus broadcast reach, restricted to adjacent stages and damped as the
           destination's capacity fills --- */
    var next = afterBirths.map(function (x) { return (1 - p.rho) * x; });
    for (i = 0; i < n; i++) {
      var from = afterBirths[i];
      if (from <= 0) continue;
      var ws = [], sum = 0;
      for (j = 0; j < n; j++) {
        var ceiling = j === 0 ? 1 : Math.min(1, CAP[j] * p.capScale);
        var sat = Math.max(0.03, 1 - afterBirths[j] / ceiling);
        /* Institutional update is the only route by which a higher stage gets
           broadcast reach of its own: a tradition that reformulates carries the
           next stage into its schools and its liturgy. Without it the top stages
           have reach only among people who already hold them, which is the
           definition of a stage that cannot spread. */
        var reach = BASE_REACH[j] * (j === 0 ? 1 : Math.pow(p.update, j));
        var wj = adj(i, j) * KAPPA[j] * (j === 3 || j === 4 ? p.kappaHigh : 1) *
          (reach + Math.pow(afterBirths[j] + 1e-9, p.alpha)) * sat;
        /* habit: staying is always a little more likely than moving, and the
           update lever tilts movement upward (reformation) or downward (decay) */
        if (j === i) wj *= 1.6;
        else if (j > i) wj *= p.update;
        else wj *= (2 - p.update);
        ws.push(wj); sum += wj;
      }
      for (j = 0; j < n; j++) next[j] += p.rho * from * (ws[j] / sum);
    }
    return normalise(next);
  }

  function run(params) {
    var p = {};
    for (var k in BASELINE) p[k] = BASELINE[k];
    for (var q in params || {}) p[q] = params[q];
    if (p.start) p.start = normalise(p.start.slice());

    var years = [], shares = [];
    var s = (p.start || BASELINE.start).slice();
    for (var y = 2025; y <= p.horizon; y++) {
      years.push(y);
      shares.push(s.map(function (x) { return +x.toFixed(6); }));
      s = step(s, p);
    }

    function crossing(idx, thr) {
      for (var i = 0; i < shares.length; i++) {
        var v = idx === "post" ? shares[i][3] + shares[i][4] : shares[i][idx];
        if (v >= thr) return years[i];
      }
      return null;
    }
    var idx = { trad: 0, modern: 1, plural: 2, integral: 3, nondual: 4 };
    var crossings = {};
    [["integral", 3], ["nondual", 4], ["post", "post"]].forEach(function (pair) {
      var name = pair[0], id = pair[1];
      crossings[name] = {
        5: crossing(id, 0.05),
        10: crossing(id, 0.10),
        25: crossing(id, 0.25),
        50: crossing(id, 0.50)
      };
    });

    /* The nondual population is what the awakening panel scales from. Shares are
       of adults, so heads = share x 6.4bn; the model does not forecast the
       population itself, and says so. */
    var heads = shares.map(function (r) { return r[4] * ADULT_POP; });
    var events = heads.map(function (n) {
      return Math.pow(n / p.eventUnit, p.gamma);     /* per century */
    });

    return {
      params: p, years: years, shares: shares,
      crossings: crossings,
      final: shares[shares.length - 1],
      heads: heads, events: events,
      /* what the model says the post-integral share will be in 2100, which is
         the quantity the sensitivity chart varies */
      at2100: (function () {
        var i = years.indexOf(2100);
        return i < 0 ? null : +(shares[i][3] + shares[i][4]).toFixed(4);
      })()
    };
  }

  /* ---------------------------------------------------------------- threshold ---
     The textbook case, no broadcast, one rare worldview invading a resident one:
        ds/dt = k s^a (1 - s) - d s
     An interior threshold exists only where k s^(a-1) (1 - s) = d. That function
     peaks at s = (a-1)/a, so no critical mass above (a-1)/a is possible at any
     advantage. Setting s* = 0.25 and s* = 0.65 therefore pins down the exponent —
     which is the real content of the finding that a lab game tips at 25% and a
     real behaviour needs 50-65%.                                            */

  function criticalMass(alpha, advantage) {
    if (alpha <= 1) return 0;
    var peak = (alpha - 1) / alpha;
    var tangent = 1 / (Math.pow(peak, alpha - 1) * (1 - peak));
    /* below the tangent there is no share at which the rare worldview grows:
       it declines from every starting point. At the tangent the threshold and
       the equilibrium are the same point, which is the largest critical mass
       this exponent can produce. */
    if (advantage < tangent * 0.999) return null;
    if (advantage <= tangent * 1.001) return peak;
    var lo = 1e-9, hi = peak;
    for (var i = 0; i < 90; i++) {
      var mid = (lo + hi) / 2;
      var f = advantage * Math.pow(mid, alpha - 1) * (1 - mid) - 1;
      if (f > 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  /* the advantage at which a given exponent puts the threshold exactly at s */
  function advantageAt(alpha, s) {
    if (s <= 0 || s >= 1) return null;
    return 1 / (Math.pow(s, alpha - 1) * (1 - s));
  }

  /* ------------------------------------------------------------- the vessel ---
     Where a tradition sits, given how much of its membership is still held by
     the embodied carriers and how far its centre has moved from the inherited
     cosmology. This is a phase diagram, not a simulation: it asserts that the
     carrier strength a tradition needs rises with the centre shift, because a
     moved centre has no ambient support — nobody's schooling, law or media
     teaches it, so the form has to carry what the surrounding culture used to.

     threshold: k*(c) = base + slope * c, with base 0.35 and slope 0.45 from the
     claims file. Nothing derives those two numbers; they are the argument.
     A margin of +/-0.06 is drawn as a corridor so the boundary does not read as
     more precise than it is. */
  function vesselThreshold(c, vessel) {
    var t = (vessel && vessel.threshold) || { base: 0.35, slope: 0.45 };
    return t.base + t.slope * c;
  }

  function vesselRegime(k, c, vessel) {
    var need = vesselThreshold(c, vessel);
    var band = 0.06;
    if (k >= need + band) return c > 0.5 ? "carry" : "hold";
    if (k <= need - band) return c > 0.5 ? "outrun" : "fade";
    return c > 0.5 ? "edge-carry" : "edge-hold";
  }

  var API = {
    STAGES: STAGES, BASELINE: BASELINE, ADULT_POP: ADULT_POP,
    vesselThreshold: vesselThreshold, vesselRegime: vesselRegime,
    run: run, criticalMass: criticalMass, advantageAt: advantageAt,
    /* convenience for the page: the model's own exponent, at the advantage that
       reproduces Centola's 25% */
    implied: function (alpha) { return criticalMass(alpha, advantageAt(alpha, 0.25)); }
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.RELIGION_MODEL = API;
})(typeof self !== "undefined" ? self : this);
