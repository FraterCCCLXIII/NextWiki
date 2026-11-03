/* Robot economics model.

   Three separable pieces, in this order:

     1. COST      A unit price that declines toward a floor. Anchored to IFR's
                  published average unit price, extended with the decline rate
                  as a lever.
     2. ADOPTION  An S-curve whose midpoint is set by when the machine pays back
                  faster than a threshold, plus a deployment lag. Price decides
                  when adoption becomes possible; the lag decides when it happens.
     3. DISTRIBUTION  Labour share falls with displaced work; capital income is
                  split by ownership; wealth accumulates from saving.

   Everything downstream of (1) is arithmetic on the anchors in robots-data.js.
   What is not arithmetic is stated as a lever, because there is no measured
   global series for "share of robot capital owned by the top 1%". */
window.ROBOTS = (function () {
  var D = window.ROBOTS_DATA;
  var START = 1961;
  var HIST = D.lastMeasured;         // 2025
  var WORKS = 3.5e9;                 // global labour force
  var CAPITAL_RATIO = 3.5;           // capital stock / GDP
  var SYSTEM = 2.5;                  // installed system cost / unit price
  var OPEX = 0.12;                   // annual running cost / capex
  var WAGE0 = 14000;                 // global average wage, 2025
  var GDP0 = 110e12;                 // world GDP, 2025
  var SHARE0 = 0.54;                 // labour share of income, 2025
  var WEALTH0 = { top1: 0.45, next9: 0.39, rest: 0.16 };
  var SAVE = { top1: 0.35, next9: 0.22, rest: 0.04 };

  var LEVERS = [
    { key: "humanoidCost", group: "Cost", label: "Humanoid price today", min: 6000, max: 60000, step: 500, def: 16000, fmt: "usd",
      note: "The cheapest capable general-purpose unit on sale in 2025 was $5,900 (Unitree R1); the G1 was $16,000. Tesla's stated target is $20,000-30,000." },
    { key: "costDecline", group: "Cost", label: "Cost decline", min: 0.02, max: 0.35, step: 0.01, def: 0.15, fmt: "pct",
      note: "Annual decline in unit price. Industrial robots fell about 8% a year between 1995 and 2017; consumer electronics has run faster." },
    { key: "costFloor", group: "Cost", label: "Cost floor", min: 2000, max: 20000, step: 500, def: 5000, fmt: "usd",
      note: "The materials and assembly floor. A machine that cannot go below this never becomes free, which matters for the far end of the chart." },
    { key: "ceiling", group: "Deployment", label: "Deployment ceiling", min: 20, max: 400, step: 5, def: 140, fmt: "per1000",
      note: "Robots per 1,000 workers once adoption saturates. This is a task-coverage question, not a price question: 140 means 14% of jobs have a machine." },
    { key: "lag", group: "Deployment", label: "Deployment lag", min: 0, max: 25, step: 1, def: 8, fmt: "yr",
      note: "Years between a robot becoming cheaper than the labour it replaces and it actually being installed. Capital cycles, liability, regulation, floor space." },
    { key: "speed", group: "Deployment", label: "Adoption speed", min: 3, max: 30, step: 1, def: 9, fmt: "yr",
      note: "Width of the S-curve. Narrow means a rush, wide means a decades-long drift." },
    { key: "fte", group: "Deployment", label: "Work per robot", min: 0.3, max: 4, step: 0.1, def: 1.7, fmt: "fte",
      note: "Full-time equivalents of output displaced by one unit. 0.3 for a cobot assisting a line, 4 for a lights-out cell." },
    { key: "ownTop1", group: "Distribution", label: "Top 1% share of new capital", min: 0.2, max: 0.98, step: 0.01, def: 0.85, fmt: "pct",
      note: "Who captures capital income above its 2025 level. There is no measured global series for this; it is the single most consequential lever on the page." },
    { key: "redist", group: "Distribution", label: "Robot dividend to households", min: 0, max: 0.9, step: 0.05, def: 0, fmt: "pct",
      note: "Share of new capital income paid out to the bottom 90% as a dividend, fund return or basic income. Alaska's oil fund is the working precedent." },
    { key: "wageGrowth", group: "Distribution", label: "Wage growth", min: 0, max: 0.06, step: 0.005, def: 0.02, fmt: "pct",
      note: "Nominal wage growth. Faster wages make robots pay back sooner, which is the feedback that makes cheap machines self-reinforcing." },
    { key: "multiple", group: "Markets", label: "Equity multiple at 2100", min: 8, max: 40, step: 1, def: 18, fmt: "x",
      note: "Price / earnings on capital income at the horizon. Today's is 18x; the market re-rates linearly toward this as the labour share's loss shows up as earnings growth." },
    { key: "gdpGrowth", group: "Markets", label: "Real GDP growth", min: 0, max: 0.045, step: 0.0025, def: 0.02, fmt: "pct",
      note: "Baseline growth before automation. Robots add output; whether that shows up as GDP or as lower prices depends on competition." }
  ];

  var GROUPS = ["Cost", "Deployment", "Distribution", "Markets"];

  var PRESETS = {
    "Base case": {},
    "Cheap robots, concentrated": { costDecline: 0.22, ceiling: 220, lag: 5, ownTop1: 0.94, multiple: 26 },
    "Cheap robots, broad ownership": { costDecline: 0.22, ceiling: 220, lag: 5, ownTop1: 0.45, redist: 0.55, multiple: 20 },
    "Slow takeoff": { costDecline: 0.08, ceiling: 70, lag: 18, speed: 20, fte: 1.2, multiple: 14 },
    "Robot tax and dividend": { costDecline: 0.18, ceiling: 170, lag: 8, ownTop1: 0.8, redist: 0.7, multiple: 17 }
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* Linear interpolation in log space between published anchors. */
  function interpLog(pairs, year) {
    if (year <= pairs[0][0]) return pairs[0][1];
    if (year >= pairs[pairs.length - 1][0]) return pairs[pairs.length - 1][1];
    for (var i = 1; i < pairs.length; i++) {
      if (year <= pairs[i][0]) {
        var y0 = pairs[i - 1][0], y1 = pairs[i][0];
        var v0 = Math.log(pairs[i - 1][1]), v1 = Math.log(pairs[i][1]);
        return Math.exp(v0 + (v1 - v0) * (year - y0) / (y1 - y0));
      }
    }
    return pairs[pairs.length - 1][1];
  }
  function interpLin(pairs, year) {
    if (year <= pairs[0][0]) return pairs[0][1];
    if (year >= pairs[pairs.length - 1][0]) return pairs[pairs.length - 1][1];
    for (var i = 1; i < pairs.length; i++) {
      if (year <= pairs[i][0]) {
        var y0 = pairs[i - 1][0], y1 = pairs[i][0];
        var t = (year - y0) / (y1 - y0);
        return pairs[i - 1][1] + (pairs[i][1] - pairs[i - 1][1]) * t;
      }
    }
    return pairs[pairs.length - 1][1];
  }

  /* Discrete Gini over three population groups.

     The Lorenz curve has to be walked bottom-up — the 90% are poorest, the 1%
     richest — or the cumulative shares exceed 1 and the index goes negative.
     `shares` arrives richest-first, so it is reversed here. */
  function gini3(shares) {
    var pops = [0.90, 0.09, 0.01];
    var vals = [shares[2], shares[1], shares[0]];
    var area = 0, cx = 0, cy = 0;
    for (var i = 0; i < 3; i++) {
      var nx = cx + pops[i], ny = cy + vals[i];
      area += 0.5 * (nx - cx) * (ny + cy);
      cx = nx; cy = ny;
    }
    return clamp(1 - 2 * area, 0, 1);
  }

  function defaults() {
    var s = {};
    LEVERS.forEach(function (l) { s[l.key] = l.def; });
    return s;
  }

  function run(state) {
    var st = Object.assign(defaults(), state || {});
    var years = [], stock = [], price = [], payback = [], displaced = [],
        labourShare = [], wealth = [], gini = [], equity = [], capex = [],
        power = [], capitalShare = [], capitalIncomeArr = [],
        incTop = [], incNext = [], incRest = [];

    var wage = WAGE0;
    var gdp = GDP0;
    var W = { top1: WEALTH0.top1, next9: WEALTH0.next9, rest: WEALTH0.rest };

    /* when does the machine pay back inside the threshold? */
    var paybackYear = null;
    for (var y = HIST; y <= 2100; y++) {
      var unit = Math.max(st.costFloor, st.humanoidCost * Math.pow(1 - st.costDecline, y - HIST));
      var w = WAGE0 * Math.pow(1 + st.wageGrowth, y - HIST);
      var system = unit * SYSTEM;
      var annualValue = st.fte * w;
      var opex = system * OPEX;
      var pb = system / Math.max(1, annualValue - opex);
      if (paybackYear === null && pb <= 3) paybackYear = y;
    }
    if (paybackYear === null) paybackYear = 2095;

    /* The logistic's halfway point is the payback crossing, plus the deployment
       lag, plus half the S-curve. Anchoring it at only the crossing made the
       curve reach half its ceiling within a decade of a five-million-unit base,
       which is a 50x expansion nobody has ever run. */
    var mid = paybackYear + st.lag + st.speed;
    var target = WORKS * st.ceiling / 1000;      // robots at saturation
    var s0 = 5000000;                            // measured stock, 2025
    var A = Math.max(1e-6, (target - s0) / s0);
    var k = mid > HIST + 2 ? Math.log(A) / (mid - HIST) : 0.3;

    /* Capital income in 2025, computed the same way the loop computes it, so the
       equity index is exactly 100 at the seam whatever the displacement lever
       is set to. Using the round 54% share instead left it at 99.8. */
    var disp2025 = clamp(5000000 * st.fte / WORKS, 0, 0.95);
    var capIncomeBase = GDP0 * (1 - (SHARE0 - 0.6 * disp2025));

    for (var yr = START; yr <= 2100; yr++) {
      years.push(yr);

      /* ---- stock: measured to 2025, logistic after ---- */
      var s;
      if (yr <= HIST) {
        s = interpLog(D.stock, yr);
      } else {
        s = target / (1 + A * Math.exp(-k * (yr - HIST)));
      }
      stock.push(s);

      /* ---- unit cost: measured history, then the lever ---- */
      var unitCost;
      if (yr <= 2025) unitCost = interpLog(D.price, yr);
      else unitCost = Math.max(st.costFloor, st.humanoidCost * Math.pow(1 - st.costDecline, yr - HIST));
      price.push(yr >= 1995 ? unitCost : null);

      /* ---- economics ---- */
      if (yr > HIST) { wage = WAGE0 * Math.pow(1 + st.wageGrowth, yr - HIST); gdp = GDP0 * Math.pow(1 + st.gdpGrowth, yr - HIST); }

      var disp = clamp(s * st.fte / WORKS, 0, 0.95);
      displaced.push(yr >= 1995 ? disp : null);

      var share = clamp(SHARE0 - 0.6 * disp, 0.22, 0.62);
      labourShare.push(yr >= 1995 ? share : null);

      var systemCost = unitCost * SYSTEM;
      /* The wage a machine displaces is not the wage on today's trend line: it is
         what a worker earns once labour's share has fallen. Without this the
         payback ratio collapses to weeks by 2100, because it keeps comparing a
         cheap machine against a wage that the machine itself is supposed to be
         pushing down. */
      var wageEff = wage * (share / SHARE0);
      var annualValue = st.fte * wageEff;
      var net = annualValue - systemCost * OPEX;
      /* Before about 2010 a robot did not pay back at a global average wage;
         it paid back at a German or Japanese wage, which is exactly where the
         stock was. Those years are left empty rather than drawn as 240,000. */
      var pbYears = yr >= 1995 && net > 0 ? systemCost / net : null;
      /* Beyond twenty years the number is not a payback, it is a statement that
         the machine never repaid itself at this wage. Drawn as a gap instead. */
      payback.push(pbYears !== null && pbYears > 20 ? null : pbYears);

      var capIncome = gdp * (1 - share);
      capitalIncomeArr.push(yr >= 1995 ? capIncome : null);

      /* who gets the capital income above the 2025 level */
      var extra = Math.max(0, capIncome - capIncomeBase);
      var topCap = WEALTH0.top1 * capIncomeBase + st.ownTop1 * extra;
      var nextCap = WEALTH0.next9 * capIncomeBase + (1 - st.ownTop1) * 0.8 * extra;
      var restCap = WEALTH0.rest * capIncomeBase + (1 - st.ownTop1) * 0.2 * extra;

      /* Redistribution moves a share of the new capital income to the bottom
         90%, funded mostly by the top. */
      var paid = st.redist * st.ownTop1 * extra;
      topCap -= paid * 0.8;
      nextCap -= paid * 0.2;
      restCap += paid;

      /* Household income is wages plus capital income. Savings come out of the
         total, so the 90% can accumulate from wages even as capital income
         concentrates — without this the bottom 90% only ever shrink. */
      var labourIncome = gdp * share;
      var topInc = 0.05 * labourIncome + topCap;
      var nextInc = 0.15 * labourIncome + nextCap;
      var restInc = 0.80 * labourIncome + restCap;

      /* Wealth accumulates from saving, only from 2025, where the measured
         shares are. Running the same flow back to 1961 drifted the top 1% from
         45% to 63% before the model had started. The 0.05 keeps the
         distribution from moving faster than any observed century. */
      if (yr > HIST) {
        var flows = [topInc * SAVE.top1, nextInc * SAVE.next9, restInc * SAVE.rest];
        var keys = ["top1", "next9", "rest"];
        var cur = [W.top1, W.next9, W.rest];
        var sumW = 0, nextW = [0, 0, 0];
        for (var i = 0; i < 3; i++) {
          nextW[i] = cur[i] + (flows[i] / gdp) * 0.05;
          sumW += nextW[i];
        }
        W = { top1: nextW[0] / sumW, next9: nextW[1] / sumW, rest: nextW[2] / sumW };
      }

      wealth.push([W.top1, W.next9, W.rest]);
      gini.push(yr >= 1995 ? gini3([W.top1, W.next9, W.rest]) : null);

      /* Markets: capital income capitalised, indexed to 2025.

         The multiple is a horizon assumption, not today's: it starts at 18x in
         2025 and re-rates linearly to the lever by 2100. Holding it constant
         would have made the index start above 100 whenever the lever was not
         the default, and would have given the lever nothing to do. */
      var t = clamp((yr - HIST) / (2100 - HIST), 0, 1);
      var mult = 18 + (st.multiple - 18) * t;
      var eq = capIncome * mult / (capIncomeBase * 18);
      equity.push(yr >= 1995 ? eq * 100 : null);

      var prev = yr > START ? stock[stock.length - 2] : s;
      var capexPct = yr >= 1995 ? Math.max(0, s - prev) * systemCost / gdp : null;
      capex.push(capexPct);

      capitalShare.push(yr >= 1995 ? topCap / capIncome : null);
      power.push(yr >= 1995 ? (topCap / capIncome) / (WEALTH0.top1) * 100 : null);
      incTop.push(yr >= 1995 ? topInc / 1e12 : null);
      incNext.push(yr >= 1995 ? nextInc / 1e12 : null);
      incRest.push(yr >= 1995 ? restInc / 1e12 : null);
    }

    return {
      years: years, stock: stock, price: price, payback: payback,
      displaced: displaced, labourShare: labourShare, wealth: wealth,
      gini: gini, equity: equity, capex: capex, power: power,
      capitalShare: capitalShare, capitalIncome: capitalIncomeArr,
      incTop: incTop, incNext: incNext, incRest: incRest,
      meta: { paybackYear: paybackYear, mid: mid, target: target, state: st, at: function (y) { return years.indexOf(y); } }
    };
  }

  return { LEVERS: LEVERS, GROUPS: GROUPS, PRESETS: PRESETS, defaults: defaults, run: run, HIST: HIST, START: START };
})();
