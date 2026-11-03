/* ============================================================================
   war-model.js — a compound-hazard model of war, 2025 to 10,000 CE.

   THE PROBLEM THIS SOLVES

   Every other model in this lab forecasts a level: GDP per head, energy, robot
   stock. War has no level. It has a frequency and a size, and those two are
   different distributions. The frequency has fallen a long way since 1945 and
   the size distribution has not moved at all: Clauset fits the same power law
   to 1823-1939 and to 1940-2003. So a model that extrapolates "war deaths per
   year" is fitting a trend to a quantity whose variance is infinite, and the
   answer it gives is decided entirely by whether the sample happened to
   contain a world war.

   This model therefore separates three things that are usually conflated:

     1. ONSET      how often a war starts. A Poisson hazard, measured.
     2. SEVERITY   how big a war is once it starts. Pareto, exponent measured,
                   mean undefined.
     3. ESCALATION what happens above the largest war on record, where the
                   fitted distribution has no data and the physics of soot and
                   famine takes over.

   On top of those sits a fourth, optional process: SETTLEMENT. A settlement is
   the only thing in the model that can produce a war-free century, because
   multiplying a hazard by 0.05 is not the same as removing it. That asymmetry
   is the page's central result and it is a property of the arithmetic, not an
   assumption.

   WHAT IS MEASURED, WHAT IS PUBLISHED, WHAT IS JUDGMENT

     measured    onset rate, x_min, the count of wars above it
     published   the exponent (with its interval), the nuclear fatality bands,
                 the expert probabilities
     judgment    deterrence, the escalation gate, the settlement hazard, and
                 both AI effects. No published effect size exists for any of
                 them, and the page says so on every control that uses one.

   The output is a distribution, never a date.
   ============================================================================ */
window.WARMODEL = (function () {
  "use strict";

  var D = window.WARF_DATA;

  var BASE = D.record.onsetRate.value;          /* 0.5249 wars a year          */
  var XMIN = D.record.xmin.value;               /* 7,061 battle deaths         */
  var TAIL_BASE = D.record.aboveXmin.value / D.record.years;  /* 0.2818 / yr    */

  /* The other channel. UCDP's mean annual battle plus one-sided deaths,
     1989-2024: 99,971. That flow is what an ordinary year of war costs, and
     it is measured rather than modelled. It never produces a century-defining
     event, and leaving it out would make the page's death totals an order of
     magnitude below the only period anyone has counted properly. */
  var BACKGROUND = D.record.backgroundDeaths.value;
  var WWII = D.record.wwii.value;
  var ALPHA = D.record.alpha.value;
  var ALPHA_SD = 0.07;

  /* Above this, the fit has no data behind it and the war is off the chart in
     the literal sense. 25 million is deliberately above WWII: the gate is
     "larger than any war that has happened", not "a world war". */
  var GATE = 25e6;

  var DEFAULTS = {
    startYear: D.startYear,
    endYear: D.endYear,
    paths: 480,
    seed: 20261102,
    sampleAlpha: true,
    onsetMult: 1,
    trend: 0,
    floor: 0.05,
    deterrence: 0.5,
    nuclearGate: 0.35,
    capFrac: 0.6,
    settleRate: 0,
    settleHold: 0.999,
    settleFail: 0.0004,
    aiOnset: 1,
    aiEscalation: 1,
    traumaBoost: 6
  };

  /* ------------------------------------------------------------------ rng ---
     Seeded, so the checks are reproducible and a reload does not redraw the
     future. mulberry32 is not cryptographic and does not need to be. */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(r) {
    var u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function poisson(lam, r) {
    if (!(lam > 0)) return 0;
    if (lam > 8) {
      var g = Math.round(lam + Math.sqrt(lam) * gauss(r));
      return g < 0 ? 0 : g;
    }
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= r(); } while (p > L && k < 40);
    return k - 1;
  }

  /* ----------------------------------------------------------- population ---
     Only used to size the ceiling. A war cannot kill more people than exist,
     and this is the one quantity in the model that is bounded by physics
     rather than by history. */
  function basePop(year) {
    var p = D.population;
    if (year <= 2025) return p.now.value;
    if (year <= p.peakYear) {
      var t = (year - 2025) / (p.peakYear - 2025);
      return p.now.value + (p.peak.value - p.now.value) * t;
    }
    return p.plateau.value;
  }

  /* ---------------------------------------------------------------- hazard ---
     trendFactor applies the annual change, stops at the floor if it is
     declining, and is capped at 6x if it is rising, because a rate that
     compounds for eight millennia reaches numbers that stop meaning anything. */
  function trendFactor(dt, levers) {
    var g = levers.trend * dt;
    var f = Math.exp(g);
    if (f < levers.floor) f = levers.floor;
    if (f > 6) f = 6;
    return f;
  }

  /* The hazard the model runs on is the TAIL hazard — wars above 7,061 deaths —
     because that is the only part of the onset rate the power law describes.
     The remaining 0.24 wars a year are smaller than x_min and contribute to the
     background flow instead. Using 0.52 for the Pareto channel would invent
     three times as many large wars as the fit supports. */
  function hazardAt(dt, levers, settled) {
    var lam = TAIL_BASE * levers.onsetMult * levers.aiOnset * trendFactor(dt, levers);
    if (settled) lam *= (1 - levers.settleHold);
    return lam;
  }

  function flowFactor(dt, levers, settled) {
    var f = levers.onsetMult * levers.aiOnset * trendFactor(dt, levers);
    if (settled) f *= (1 - levers.settleHold);
    return f;
  }

  /* --------------------------------------------------------------- one path ---
     Walks the whole horizon year by year. Everything the charts need is
     accumulated into per-century buckets, which keeps the memory flat and makes
     "per century" questions answerable without storing 8,000 numbers a path. */
  function runPath(p, r, beta, buckets) {
    var start = p.startYear, end = p.endYear;
    var settled = false, firstSettle = false, failedYear = null;
    var traumaUntil = -1;
    var ceilingYears = [];
    var largest = 0, largestYear = null;
    var cumulativeDeaths = 0;
    var nCent = buckets.deaths.length;

    for (var year = start; year <= end; year++) {
      var ci = Math.floor((year - start) / 100);
      if (ci >= nCent) ci = nCent - 1;
      var dt = year - start;
      /* Inheritance of the demographic path, not of the last catastrophe: the
         ceiling is a property of how many people exist, so it must not shrink
         every time it is hit or one bad draw cascades into a world with no
         one in it. */
      var pop = basePop(year);

      /* settlement: forms, holds, can fail */
      if (!settled) {
        var pSet = p.settleRate * (year <= traumaUntil ? 1 + p.traumaBoost : 1);
        if (p.settleRate > 0 && r() < pSet) {
          settled = true;
          if (!firstSettle) { firstSettle = true; buckets.settleYear.push(year); }
        }
      } else if (r() < p.settleFail) {
        settled = false;
        failedYear = year;
        buckets.failures++;
      }

      var lam = hazardAt(dt, p, settled);
      var n = poisson(lam, r);

      /* background conflict: a flow, not an event. Scaled by the same levers,
         but it can never be the largest war of the century and it does not
         count toward the war-free test. */
      buckets.deaths[ci] += BACKGROUND * flowFactor(dt, p, settled);

      for (var w = 0; w < n; w++) {
        /* severity: Pareto with the fitted survival exponent. u^-1/beta is the
           inverse CDF; with beta < 1 the occasional draw is astronomically
           large and gets clipped by the ceiling below, which is the point. */
        var u = r();
        var size = XMIN * Math.pow(u < 1e-12 ? 1e-12 : u, -1 / beta);

        var deaths = size;

        if (size > GATE) {
          /* Deterrence works on the war, and fails on the escalation: a war
             this size is a war that deterrence did not prevent, so the same
             lever that lowered its probability raises what it costs. */
          if (r() < p.deterrence * 0.7) { deaths = 0; }
          else {
            var pN = Math.min(0.95, p.nuclearGate * (0.5 + p.deterrence) * p.aiEscalation);
            if (r() < pN) {
              /* Xia et al.: regional exchange ~2bn at risk, US-Russia ~5bn. */
              var fatal = r() < 0.7 ? 0.2 : 0.5;
              deaths += pop * fatal;
            }
          }
        }

        var cap = p.capFrac * pop;
        if (deaths > cap) deaths = cap;

        if (deaths > 0) {
          cumulativeDeaths += deaths;
          buckets.deaths[ci] += deaths;
          buckets.wars[ci] += 1;
          if (deaths > buckets.maxWar[ci]) buckets.maxWar[ci] = deaths;
          if (deaths > largest) { largest = deaths; largestYear = year; }
          if (deaths >= 5e7) traumaUntil = year + 40;

          /* A war at the ceiling is a civilization-scale event: it re-sets the
             politics, which is Bostrom's ratchet, and the model lets that
             raise the settlement hazard for the next sixty years. */
          if (deaths >= cap * 0.9) {
            ceilingYears.push(year);
            /* first only: "probability by horizon" is a per-path question, so
               counting every event would let a single unlucky path push the
               probability past 100% */
            if (ceilingYears.length === 1) buckets.firstCeiling = year;
            traumaUntil = year + 60;
          }
        }
      }

      if (n > 0) buckets.warsAny[ci] = 1;
      buckets.years[ci] += 1;
    }

    return {
      largest: largest,
      largestYear: largestYear,
      failedYear: failedYear,
      ceilingYears: ceilingYears,
      cumulativeDeaths: cumulativeDeaths
    };
  }

  /* ------------------------------------------------------------- simulate ---
     paths = independent futures. The exponent is redrawn per path when
     sampleAlpha is on, which is how the published ±0.07 turns into a visible
     band: the uncertainty in the answer is mostly uncertainty in the exponent. */
  function simulate(over) {
    var p = {};
    for (var k in DEFAULTS) p[k] = DEFAULTS[k];
    if (over) for (var k2 in over) if (over[k2] != null) p[k2] = over[k2];

    var nCent = Math.ceil((p.endYear - p.startYear) / 100);
    var r = makeRng(p.seed);

    var acc = {
      deaths: zeros(nCent), wars: zeros(nCent), maxWar: zeros(nCent),
      warFreeCent: zeros(nCent), years: zeros(nCent),
      ceilingYears: [], settleYear: [], failures: 0
    };
    var largestAll = [];
    var pathCenturyMax = [];
    var pathCenturyDeaths = [];
    for (var z = 0; z < p.paths; z++) { pathCenturyDeaths.push(zeros(nCent)); pathCenturyMax.push(zeros(nCent)); }

    for (var i = 0; i < p.paths; i++) {
      var beta = ALPHA - 1;
      if (p.sampleAlpha) beta = (ALPHA + ALPHA_SD * gauss(r)) - 1;
      if (beta < 0.2) beta = 0.2;
      if (beta > 1.4) beta = 1.4;

      var buckets = {
        deaths: zeros(nCent), wars: zeros(nCent), maxWar: zeros(nCent),
        warsAny: zeros(nCent), years: zeros(nCent),
        ceilingYears: [], settleYear: [], failures: 0
      };
      var out = runPath(p, r, beta, buckets);

      for (var c = 0; c < nCent; c++) {
        acc.deaths[c] += buckets.deaths[c];
        acc.wars[c] += buckets.wars[c];
        acc.warFreeCent[c] += buckets.warsAny[c] ? 0 : 1;
        acc.years[c] += buckets.years[c];
        acc.maxWar[c] += buckets.maxWar[c];
        pathCenturyDeaths[i][c] = buckets.deaths[c];
        pathCenturyMax[i][c] = buckets.maxWar[c];
      }
      largestAll.push(out.largest);
      if (buckets.firstCeiling != null) acc.ceilingYears.push(buckets.firstCeiling);
      for (var sy = 0; sy < buckets.settleYear.length; sy++) acc.settleYear.push(buckets.settleYear[sy]);
      acc.failures += buckets.failures;
    }

    /* ---- per-century distributions, across paths ---------------------- */
    var n = p.paths;
    var centuryDeaths = { p10: [], p50: [], p90: [] };
    var centuryWars = [], centuryMax = { p50: [], p90: [] }, warFreeP = [], hazard = [];
    for (var c2 = 0; c2 < nCent; c2++) {
      var col = pathCenturyDeaths.map(function (arr) { return arr[c2]; })
        .sort(function (a, b) { return a - b; });
      centuryDeaths.p10.push(quant(col, 0.1));
      centuryDeaths.p50.push(quant(col, 0.5));
      centuryDeaths.p90.push(quant(col, 0.9));

      var mc = pathCenturyMax.map(function (arr) { return arr[c2]; })
        .sort(function (a, b) { return a - b; });
      centuryMax.p50.push(quant(mc, 0.5));
      centuryMax.p90.push(quant(mc, 0.9));

      centuryWars.push(acc.wars[c2] / n);
      warFreeP.push(acc.warFreeCent[c2] / n);
      hazard.push(acc.years[c2] ? acc.wars[c2] / acc.years[c2] : 0);
    }

    var years = [];
    for (var c3 = 0; c3 < nCent; c3++) years.push(p.startYear + c3 * 100);

    /* ---- horizon questions --------------------------------------------
       "The largest war by 2500" is not the largest war of the whole run
       filtered to 2500 — it is a separate statistic per horizon, so it is
       rebuilt from each path's century maxima rather than read off the total. */
    var horizons = [2100, 2200, 2300, 2500, 3000, 4000, 5000, 7000, 10000]
      .filter(function (h) { return h > p.startYear && h <= p.endYear; });
    var hz = horizons.map(function (h) { return Math.floor((h - p.startYear) / 100); });

    var thresholds = [1e7, 5e7, 1e8, 1e9, 3e9];
    var largestByHorizon = hz.map(function (ci) {
      return pathCenturyMax.map(function (arr) {
        var m = 0;
        for (var c = 0; c <= ci && c < arr.length; c++) if (arr[c] > m) m = arr[c];
        return m;
      }).sort(function (a, b) { return a - b; });
    });

    var pAbove = thresholds.map(function (t) {
      return largestByHorizon.map(function (sorted) {
        var k = 0;
        for (var i = 0; i < sorted.length; i++) if (sorted[i] >= t) k++;
        return k / sorted.length;
      });
    });

    var pCeilingBy = hz.map(function (ci) {
      var h = p.startYear + ci * 100;
      return acc.ceilingYears.filter(function (y) { return y <= h; }).length / n;
    });


    var pSettledBy = hz.map(function (ci) {
      var h = p.startYear + ci * 100;
      return acc.settleYear.filter(function (y) { return y <= h; }).length / n;
    });

    return {
      params: p, years: years, endYear: p.endYear,
      centuryDeaths: centuryDeaths,
      centuryWars: centuryWars,
      centuryMax: centuryMax,
      hazard: hazard,
      warFree: warFreeP,
      largestSorted: largestAll.slice().sort(function (a, b) { return a - b; }),
      settleSorted: acc.settleYear.slice().sort(function (a, b) { return a - b; }),
      ceilingYears: acc.ceilingYears.slice().sort(function (a, b) { return a - b; }),
      failures: acc.failures,
      totalDeaths: acc.deaths.reduce(function (a, b) { return a + b; }, 0),
      horizons: horizons,
      horizonIndex: hz,
      largestByHorizon: largestByHorizon,
      thresholds: thresholds,
      pAbove: pAbove,
      pCeilingBy: pCeilingBy,
      pSettledBy: pSettledBy
    };
  }

  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }

  function quant(sorted, q) {
    if (!sorted.length) return 0;
    var i = (sorted.length - 1) * q;
    var lo = Math.floor(i), hi = Math.ceil(i);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  /* --------------------------------------------------------- analytic tail ---
     Everything the page says about "one war of size X every N years" is this
     one line of arithmetic, so it can be checked by hand:

       rate(x) = (51 / 181) * (x / 7,061)^-0.53        wars of at least x / yr
       wait(x) = 1 / rate(x)

     No simulation, no model assumptions beyond the fitted power law. */
  function tailWait(x, beta) {
    if (beta == null) beta = ALPHA - 1;
    if (x < XMIN) return null;
    return 1 / (TAIL_BASE * Math.pow(x / XMIN, -beta));
  }

  function tailRate(x, beta) {
    if (beta == null) beta = ALPHA - 1;
    if (x < XMIN) return null;
    return TAIL_BASE * Math.pow(x / XMIN, -beta);
  }

  /* Expected years until the ceiling binds, at the measured tail. This is the
     number the whole page exists to put on screen: it converts "the tail is
     heavy" into a date without a simulation and without a trend. */
  function ceilingWait(capFrac) {
    var cap = (capFrac == null ? DEFAULTS.capFrac : capFrac) * D.population.plateau.value;
    return tailWait(cap);
  }

  /* -------------------------------------------------------------- checks ---
     The four things that would make this model wrong, tested. Each returns a
     status so the page and the node harness read the same verdict. */
  function calibrate() {
    var beta = ALPHA - 1;
    var checks = [];

    /* 1. the onset rate has to reproduce the record it came from */
    var tailWars = TAIL_BASE * D.record.years;
    var allWars = BASE * D.record.years;
    checks.push({
      label: "Tail rate reproduces the record",
      value: Math.round(tailWars) + " of " + D.record.wars + " wars",
      detail: (TAIL_BASE).toFixed(4) + " tail wars a year x 181 years = " + tailWars.toFixed(1) +
        ", against the 51 wars Clauset counts above 7,061 deaths. The rate is derived from the count, so this is an identity rather than a test — it is here to catch a transcription error in either number, and because the whole page rests on which of the two counts is fed to the power law.",
      status: Math.abs(tailWars - D.record.aboveXmin.value) < 2 ? "ok" : "warn"
    });

    /* 2. the pregnancy test: does the tail reproduce Clauset's 0.43? */
    var expPerCentury = 100 * TAIL_BASE * Math.pow(WWII / XMIN, -beta);
    var pWW = 1 - Math.exp(-expPerCentury);
    var band = [0.23, 0.55];
    checks.push({
      label: "WWII-scale war within a century",
      value: (pWW * 100).toFixed(0) + "%",
      detail: "The model's own arithmetic: " + D.record.aboveXmin.value + " wars above 7,061 in 181 years gives " +
        (TAIL_BASE * 100).toFixed(1) + " tail wars a century, and (16.63M/7,061)^-0.53 leaves " +
        (expPerCentury).toFixed(2) + " of them at WWII scale per century — one every " + Math.round(100 / expPerCentury) +
        " years. Clauset publishes 43%, one every 161. The exponent's own ±0.07 moves this between " +
        (band[0] * 100).toFixed(0) + "% and " + (band[1] * 100).toFixed(0) + "%, and the point estimate is inside that.",
      status: pWW > band[0] && pWW < band[1] ? "ok" : "warn"
    });

    /* 3. the mean has to be undefined, or the whole framing is wrong */
    checks.push({
      label: "Mean war size",
      value: "undefined",
      detail: "The survival exponent is " + beta.toFixed(2) + ", below 1, so the expected war size does not converge. " +
        "Every 'average war' in the record is a statement about the largest war in the sample. This is why the page " +
        "reports medians and intervals and never an average death toll.",
      status: beta < 1 ? "ok" : "warn"
    });

    /* 4. the ceiling has to arrive inside the horizon, or the page has nothing
          to say about deep time */
    var cw = ceilingWait();
    checks.push({
      label: "Time to a civilization-scale war",
      value: cw > 1e6 ? (cw / 1e6).toFixed(1) + "Myr" : Math.round(cw).toLocaleString() + " yr",
      detail: "One war at the " + (DEFAULTS.capFrac * 100) + "% ceiling per " + Math.round(cw).toLocaleString() +
        " years, from the fitted tail alone — no simulation, no trend, no war term beyond the exponent. " +
        (cw < (DEFAULTS.endYear - DEFAULTS.startYear) ? "That is inside the 8,000-year horizon, which is the page's central finding: a rate this low is still a rate that binds." :
          "That is outside the horizon, so the ceiling is not what governs the far future at the base rate."),
      status: cw < 2e6 ? "ok" : "warn"
    });

    /* 5. the page's central claim, stated as arithmetic rather than asserted:
          a declining rate cannot produce a war-free century, only a settlement
          can. P(no war in 100 years) = exp(-100 * rate). */
    var pFreeBase = Math.exp(-100 * TAIL_BASE);
    var decade = TAIL_BASE * Math.exp(-0.015 * 100);
    var pFreeTrend = Math.exp(-100 * decade);
    var held = TAIL_BASE * (1 - 0.999);
    var pFreeHeld = Math.exp(-100 * held);
    checks.push({
      label: "A century with no war above the threshold",
      value: "1 in 10^" + Math.round(-Math.log10(pFreeBase)),
      detail: "At " + TAIL_BASE.toFixed(2) + " wars a year, a hundred war-free years has probability exp(-28), which is " +
        "1 in 10^12. A peace trend of 1.5% a year for a century lowers the rate to " + decade.toFixed(3) +
        " and the chance to 1 in " + Math.round(1 / pFreeTrend) + " — two billion times better, and still not a century " +
        "you could bet on. A settlement that suppresses 99.9% of onsets takes it to " + (pFreeHeld * 100).toFixed(0) +
        "%. Decline and abolition are different operations: one multiplies the hazard, the other divides it.",
      status: pFreeBase < 1e-9 && pFreeHeld > 0.8 ? "ok" : "warn"
    });

    return checks;
  }

  return {
    defaults: DEFAULTS,
    base: { rate: BASE, xmin: XMIN, tailRate: TAIL_BASE, wwii: WWII, alpha: ALPHA, gate: GATE },
    simulate: simulate,
    calibrate: calibrate,
    tailWait: tailWait,
    tailRate: tailRate,
    ceilingWait: ceilingWait,
    hazardAt: hazardAt,
    basePop: basePop,
    quant: quant,
    makeRng: makeRng
  };
})();
