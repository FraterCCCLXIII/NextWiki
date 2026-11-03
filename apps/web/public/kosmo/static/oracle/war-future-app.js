/* ============================================================================
   war-future-app.js — the renderer for `war-future.html`.

   Four scenarios are simulated once at load so they can be compared on one
   axis. Moving a lever re-runs only the selected scenario, at more paths,
   because the comparison is the slow part and the selected line is the one
   being asked about.

   Nothing here computes a forecast. Every number comes out of war-model.js;
   this file decides where to put the ink.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.WARF_DATA, M = window.WARMODEL;
  if (!D || !M) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6"
  };
  var SC = {
    stationary: C.blue, peace: C.mint, renewal: C.red, settlement: C.amber
  };
  var NS = "http://www.w3.org/2000/svg";
  var T0 = D.startYear, T1 = D.endYear;
  var PATHS_CMP = 220, PATHS_SEL = 320;

  var state = { id: "stationary", overrides: {}, sims: {}, sel: null, timer: null };

  /* ------------------------------------------------------------ formatting --- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function compact(v) {
    if (!isFinite(v)) return "—";
    var a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(1) + "tn";
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "bn";
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    return Math.round(v).toString();
  }
  function int(v) { return Math.round(v).toLocaleString("en-US"); }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 0 : d) + "%"; }
  function yrs(v) {
    if (v == null || !isFinite(v)) return "—";
    if (v >= 1e6) return (v / 1e6).toFixed(1) + " million yr";
    if (v >= 1e4) return int(v) + " yr";
    return int(v) + " yr";
  }

  /* --------------------------------------------------------------- scales ---
     The horizon is 8,000 years, so a linear axis spends 97% of its width on the
     part nobody is asking about. Time is compressed logarithmically after 2025. */
  function lx(year) { return Math.log10(year - T0 + 10) / Math.log10(T1 - T0 + 10); }
  function ux(t) { return Math.pow(10, t * Math.log10(T1 - T0 + 10)) - 10 + T0; }

  var XTICKS = [2050, 2100, 2200, 2500, 3000, 4000, 5000, 7000, 10000];

  function geo(W, H, m) {
    return { W: W, H: H, m: m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }

  function logScale(g, min, max) {
    var lo = Math.log10(min), hi = Math.log10(max);
    return function (v) {
      if (!(v > 0)) return g.m.t + g.ih;
      var t = (Math.log10(clamp(v, min, max)) - lo) / (hi - lo);
      return g.m.t + (1 - t) * g.ih;
    };
  }
  function linScale(g, min, max) {
    return function (v) { return g.m.t + (1 - (clamp(v, min, max) - min) / (max - min)) * g.ih; };
  }
  function timeX(g) { return function (year) { return g.m.l + lx(year) * g.iw; }; }

  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") +
      (o.size ? ' font-size="' + o.size + '"' : "") +
      (o.fill ? ' fill="' + o.fill + '"' : "") +
      (o.weight ? ' font-weight="' + o.weight + '"' : "") +
      (o.rotate ? ' transform="rotate(' + o.rotate + ' ' + x.toFixed(1) + " " + y.toFixed(1) + ')"' : "") +
      ' font-family="ui-monospace,monospace">' + s + "</text>";
  }

  function gridX(g, xf, ticks, y0, y1) {
    var s = "";
    for (var i = 0; i < ticks.length; i++) {
      var x = xf(ticks[i]);
      s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + y0 + '" y2="' + y1 +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(x, y1 + 15, ticks[i] === 10000 ? "10000" : String(ticks[i]), { anchor: "middle", size: 9, fill: C.dim2 });
    }
    return s;
  }

  function path(points, color, o) {
    o = o || {};
    var d = "";
    for (var i = 0; i < points.length; i++) {
      if (!points[i]) continue;
      d += (d ? " L" : "M") + points[i][0].toFixed(1) + " " + points[i][1].toFixed(1);
    }
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (o.width || 1.9) +
      '" stroke-linejoin="round" stroke-linecap="round"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : "") +
      (o.opacity != null ? ' stroke-opacity="' + o.opacity + '"' : "") + "/>";
  }

  /* ---------------------------------------------------------------- hover ---
     One model shape for both chart kinds: a nearest-index test on x, a label,
     and a list of rows. It reuses hover.js so the card looks like every other
     page in the lab. */
  function bindHover(host, cfg) {
    if (!window.HOV) return;
    HOV.bind(host, {
      W: cfg.W, H: cfg.H, top: cfg.top, bottom: cfg.bottom,
      xOf: function (i) { return cfg.xs[i]; },
      xIndex: function (vx) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < cfg.xs.length; i++) {
          var d = Math.abs(cfg.xs[i] - vx);
          if (d < bd) { bd = d; best = i; }
        }
        return bd < 90 ? best : null;
      },
      label: function (i) { return cfg.label(i); },
      rows: function (i) { return cfg.rows(i); }
    });
  }

  /* ------------------------------------------------------- time-series chart --- */
  function timeChart(host, cfg) {
    if (!host) return null;
    var g = geo(720, cfg.H || 320, { l: 62, r: 18, t: 18, b: 36 });
    var ys = cfg.yLog ? logScale(g, cfg.yMin, cfg.yMax) : linScale(g, cfg.yMin, cfg.yMax);
    var xs = timeX(g);
    var s = '<svg viewBox="0 0 ' + g.W + " " + g.H + '" role="img" aria-label="' + (cfg.aria || "") + '">';

    /* horizontal grid + y labels */
    for (var t = 0; t < cfg.yTicks.length; t++) {
      var v = cfg.yTicks[t], y = ys(v);
      s += '<line x1="' + g.m.l + '" x2="' + (g.m.l + g.iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(g.m.l - 8, y + 3.5, cfg.yFmt(v), { anchor: "end", size: 9, fill: C.dim2 });
    }
    s += gridX(g, xs, XTICKS, g.m.t, g.m.t + g.ih);

    /* reference lines */
    (cfg.refs || []).forEach(function (r) {
      var y = ys(r.v);
      s += '<line x1="' + g.m.l + '" x2="' + (g.m.l + g.iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (r.color || C.dim2) + '" stroke-width="1" stroke-dasharray="1 4" opacity="0.8"/>';
      if (r.label) s += txt(g.m.l + 6, y - 5, r.label, { size: 9, fill: r.color || C.dim2 });
    });

    /* series */
    cfg.series.forEach(function (ser) {
      var pts = [];
      for (var i = 0; i < cfg.years.length; i++) {
        var val = ser.data[i];
        pts.push(val > 0 || !cfg.yLog ? [xs(cfg.years[i]), ys(val)] : null);
      }
      if (ser.band) {
        var top = [], bot = [];
        for (var k = 0; k < cfg.years.length; k++) {
          top.push([xs(cfg.years[k]), ys(ser.band.hi[k])]);
          bot.push([xs(cfg.years[k]), ys(ser.band.lo[k])]);
        }
        var d = "M";
        top.forEach(function (p, i2) { d += (i2 ? " L" : "") + p[0].toFixed(1) + " " + p[1].toFixed(1); });
        for (var b = bot.length - 1; b >= 0; b--) d += " L" + bot[b][0].toFixed(1) + " " + bot[b][1].toFixed(1);
        d += " Z";
        s += '<path d="' + d + '" fill="' + ser.color + '" fill-opacity="0.12" stroke="none"/>';
      }
      s += path(pts, ser.color, { width: ser.width, dash: ser.dash, opacity: ser.opacity });
    });

    if (cfg.yLabel) s += txt(14, g.m.t + g.ih / 2, cfg.yLabel, { anchor: "middle", size: 9, fill: C.dim2, rotate: -90 });
    s += "</svg>";
    host.innerHTML = s;

    var xsArr = cfg.years.map(function (y) { return xs(y); });
    bindHover(host, {
      W: g.W, H: g.H, top: g.m.t, bottom: g.m.t + g.ih, xs: xsArr,
      label: function (i) { return cfg.labelAt ? cfg.labelAt(cfg.years[i]) : String(cfg.years[i]); },
      rows: function (i) {
        var out = [];
        cfg.series.forEach(function (ser) {
          var val = ser.data[i];
          if (val == null || !isFinite(val)) return;
          out.push({ name: ser.name, color: ser.color, dash: ser.dash, text: (ser.fmt || cfg.yFmt)(val) });
        });
        return out;
      }
    });
    return g;
  }

  /* ----------------------------------------------- x-by-value, log-log chart ---
     Used for the waiting-time curve, where x is war size rather than a date. */
  function xyChart(host, cfg) {
    if (!host) return;
    var g = geo(720, 300, { l: 68, r: 18, t: 18, b: 40 });
    var ys = logScale(g, cfg.yMin, cfg.yMax);
    var xlo = Math.log10(cfg.xMin), xhi = Math.log10(cfg.xMax);
    var xs = function (v) { return g.m.l + (Math.log10(v) - xlo) / (xhi - xlo) * g.iw; };

    var s = '<svg viewBox="0 0 ' + g.W + " " + g.H + '" role="img" aria-label="' + (cfg.aria || "") + '">';
    cfg.yTicks.forEach(function (v) {
      var y = ys(v);
      s += '<line x1="' + g.m.l + '" x2="' + (g.m.l + g.iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(g.m.l - 8, y + 3.5, cfg.yFmt(v), { anchor: "end", size: 9, fill: C.dim2 });
    });
    cfg.xTicks.forEach(function (v) {
      var x = xs(v);
      s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + g.m.t + '" y2="' + (g.m.t + g.ih) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(x, g.m.t + g.ih + 15, cfg.xFmt(v), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    var pts = cfg.data.map(function (p) { return [xs(p[0]), ys(p[1])]; });
    s += path(pts, cfg.color, { width: 2 });

    (cfg.marks || []).forEach(function (mk) {
      var x = xs(mk.x), y = ys(mk.y);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + (mk.color || cfg.color) + '"/>';
      s += txt(x + 7, y - 6, mk.label, { size: 9.5, fill: "#c3ccd5" });
    });

    s += txt(g.m.l + g.iw / 2, g.H - 6, cfg.xLabel || "", { anchor: "middle", size: 9, fill: C.dim2 });
    if (cfg.yLabel) s += txt(13, g.m.t + g.ih / 2, cfg.yLabel, { anchor: "middle", size: 9, fill: C.dim2, rotate: -90 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: g.W, H: g.H, top: g.m.t, bottom: g.m.t + g.ih,
      xs: cfg.data.map(function (p) { return xs(p[0]); }),
      label: function (i) { return "at least " + compact(cfg.data[i][0]) + " deaths"; },
      rows: function (i) {
        return [{ name: "expected wait", color: cfg.color, text: yrs(cfg.data[i][1]) }];
      }
    });
  }

  /* ------------------------------------------------------------- scenarios --- */
  function params(extra) {
    var p = {};
    for (var k in M.defaults) p[k] = M.defaults[k];
    var sc = D.scenarios.filter(function (s) { return s.id === state.id; })[0];
    if (sc) for (var k2 in sc.levers) p[k2] = sc.levers[k2];
    for (var k3 in state.overrides) p[k3] = state.overrides[k3];
    if (extra) for (var k4 in extra) p[k4] = extra[k4];
    return p;
  }

  function runAll() {
    state.sims = {};
    D.scenarios.forEach(function (s) {
      var q = paramsFor(s.id);
      q.paths = PATHS_CMP;
      state.sims[s.id] = M.simulate(q);
    });
    var q2 = params();
    q2.paths = PATHS_SEL;
    state.sel = M.simulate(q2);
    state.sims[state.id] = state.sel;
  }

  function paramsFor(id) {
    var p = {};
    for (var k in M.defaults) p[k] = M.defaults[k];
    var sc = D.scenarios.filter(function (s) { return s.id === id; })[0];
    if (sc) for (var k2 in sc.levers) p[k2] = sc.levers[k2];
    if (id === state.id) for (var k3 in state.overrides) p[k3] = state.overrides[k3];
    return p;
  }

  /* ------------------------------------------------------------------ KPIs --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var beta = D.record.survivalExponent.value;
    var pWW = 1 - Math.exp(-100 * M.base.tailRate * Math.pow(M.base.wwii / M.base.xmin, -beta));
    var sel = state.sel;
    var cap = M.ceilingWait(sel.params.capFrac);
    var h2500 = sel.horizons.indexOf(2500);
    var max2500 = h2500 >= 0 ? M.quant(sel.largestByHorizon[h2500], 0.5) : 0;
    var pc = h2500 >= 0 ? sel.pCeilingBy[h2500] : 0;
    var wf = sel.warFree[Math.min(4, sel.warFree.length - 1)];

    var cards = [
      ["A war of WWII scale, next century", pct(pWW), "Clauset publishes 43%; the exponent's interval spans 23–55", true],
      ["One war at the ceiling", yrs(cap), "from the fitted tail alone, no simulation", false],
      ["An ordinary year of war", compact(D.record.backgroundDeaths.value), "UCDP mean, 1989–2024, measured", false],
      ["Largest war by 2500", compact(max2500) + " dead", "median under the selected scenario", false],
      ["Civilization-scale war by 2500", pct(pc), "≥ 90% of the ceiling; by 2100 it is " + pct(sel.pCeilingBy[0] || 0), false]
    ];

    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  /* --------------------------------------------------------------- verdict --- */
  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var sc = D.scenarios.filter(function (s) { return s.id === state.id; })[0];
    var sel = state.sel;
    var hi = sel.horizons.indexOf(2500), hi10 = sel.horizons.length - 1;
    var med = M.quant(sel.largestByHorizon[hi], 0.5);
    var p90 = M.quant(sel.largestByHorizon[hi], 0.9);
    var pCeil = sel.pCeilingBy[hi10];
    var pSet = sel.pSettledBy[hi10];
    var wf = sel.warFree[Math.min(9, sel.warFree.length - 1)];

    var settleSentence = pSet < 0.02
      ? "No settlement forms in any run, so no century is ever quiet: at 0.28 wars a year the chance of a hundred war-free years is 1 in 10<sup>12</sup>."
      : "A settlement forms in <strong>" + pct(pSet) + "</strong> of runs, and where it does the war-free century probability rises to <strong>" + pct(wf) + "</strong>.";

    var body =
      "<p><span class='tag amber'>" + sc.label + "</span> " + sc.blurb + "</p>" +
      "<p>Under this scenario the median largest war by 2500 kills <strong>" + compact(med) +
      "</strong>, and the 90th percentile kills <strong>" + compact(p90) + "</strong>. Across the full horizon, a war at the " +
      pct(sel.params.capFrac) + " ceiling — the point where the model stops being able to imagine a bigger one — happens in <strong>" +
      pct(pCeil) + "</strong> of runs.</p>" +
      "<p>" + settleSentence + " That is the arithmetic the page is built to show: a trend changes how often war starts, but only a settlement changes whether a century can pass without one.</p>";

    host.innerHTML = "<h2>What the selected scenario says</h2>" + body;
  }

  /* ---------------------------------------------------------------- charts --- */
  function fmtYears(v) { return yrs(v); }
  function fmtCount(v) { return compact(v); }

  function renderHazard() {
    var years = state.sims.stationary.years;
    timeChart(document.getElementById("chartHazard"), {
      years: years,
      H: 330,
      yLog: true, yMin: 0.002, yMax: 1,
      yTicks: [0.01, 0.03, 0.1, 0.3],
      yFmt: function (v) { return v.toFixed(2); },
      refs: [{ v: M.base.tailRate, label: "measured, 1823–2003", color: C.dim }],
      series: D.scenarios.map(function (s) {
        var sim = state.sims[s.id];
        return {
          name: s.label, color: SC[s.id], data: sim.hazard,
          width: state.id === s.id ? 2.4 : 1.4,
          opacity: state.id === s.id ? 1 : 0.55
        };
      }),
      labelAt: function (y) { return y + "–" + (y + 100); },
      yLabel: "wars per year",
      aria: "Wars above 7,061 deaths per year, four scenarios"
    });

    var leg = document.getElementById("legendHazard");
    if (leg) {
      leg.innerHTML = D.scenarios.map(function (s) {
        return "<span><i style='background:" + SC[s.id] + "'></i>" + s.label + "</span>";
      }).join("");
    }
  }

  function renderWait() {
    var cap = M.defaults.capFrac * D.population.plateau.value;
    var data = [];
    for (var e = 6; e <= Math.log10(cap); e += 0.05) {
      var x = Math.pow(10, e);
      data.push([x, M.tailWait(x)]);
    }
    xyChart(document.getElementById("chartWait"), {
      data: data,
      xMin: 1e6, xMax: 1e10,
      xTicks: [1e6, 1e7, 1e8, 1e9, 1e10],
      xFmt: compact,
      yMin: 1, yMax: 1e5,
      yTicks: [1, 10, 100, 1000, 10000, 100000],
      yFmt: yrs,
      color: C.amber,
      marks: [
        { x: M.base.wwii, y: M.tailWait(M.base.wwii), label: "WWII", color: C.red },
        { x: 1e9, y: M.tailWait(1e9), label: "1bn", color: C.dim },
        { x: cap, y: M.tailWait(cap), label: "ceiling", color: C.violet }
      ],
      xLabel: "war deaths (log scale)",
      yLabel: "expected years between wars",
      aria: "Expected years between wars of at least a given size"
    });
  }

  function renderLargest() {
    var sel = state.sel;
    var qs = [0.5, 0.75, 0.9];
    var cols = [C.mint, C.blue, C.amber];
    var sers = qs.map(function (q, j) {
      var data = sel.largestByHorizon.map(function (sorted) { return M.quant(sorted, q); });
      /* extend the horizon points left to 2025 so the lines start at the axis */
      return {
        name: (q * 100) + "th percentile",
        color: cols[j],
        data: [M.base.xmin].concat(data),
        width: j === 0 ? 2.4 : 1.6,
        dash: j === 0 ? null : "4 3"
      };
    });
    timeChart(document.getElementById("chartLargest"), {
      years: [D.startYear].concat(sel.horizons),
      H: 330,
      yLog: true, yMin: 5e3, yMax: 1e10,
      yTicks: [1e4, 1e6, 1e8, 1e10],
      yFmt: compact,
      refs: [
        { v: M.base.wwii, label: "WWII", color: C.red },
        { v: M.defaults.capFrac * D.population.plateau.value, label: "ceiling", color: C.violet }
      ],
      series: sers,
      yLabel: "deaths in the largest war",
      aria: "Largest war by horizon, three percentiles"
    });
  }

  function renderDeaths() {
    var sel = state.sel;
    timeChart(document.getElementById("chartDeaths"), {
      years: sel.years,
      H: 300,
      yLog: true, yMin: 1e6, yMax: 1e10,
      yTicks: [1e6, 1e8, 1e10],
      yFmt: compact,
      refs: [{ v: 1e7, label: "measured 1989–2024", color: C.dim }],
      series: [{
        name: "90th percentile", color: C.red,
        data: sel.centuryDeaths.p90,
        band: { lo: sel.centuryDeaths.p10, hi: sel.centuryDeaths.p90 },
        width: 1.2, opacity: 0.9
      }, {
        name: "median", color: C.mint, data: sel.centuryDeaths.p50, width: 2.2
      }],
      labelAt: function (y) { return y + "–" + (y + 100); },
      yLabel: "deaths per century",
      aria: "Deaths per century, median and spread"
    });
  }

  function renderThreshold() {
    var sel = state.sel;
    var names = { 1e7: "10M", 5e7: "50M", 1e8: "100M", 1e9: "1bn", 3e9: "3bn" };
    var cols = [C.dim, C.blue, C.mint, C.amber, C.red];
    var sers = sel.thresholds.map(function (t, j) {
      return {
        name: "≥ " + names[t], color: cols[j], data: sel.pAbove[j],
        width: j === sel.thresholds.length - 1 ? 2.4 : 1.5,
        opacity: 0.9
      };
    });
    sers.forEach(function (s2) { s2.data = [0].concat(s2.data); });
    timeChart(document.getElementById("chartThreshold"), {
      years: [D.startYear].concat(sel.horizons),
      H: 300,
      yLog: false, yMin: 0, yMax: 1,
      yTicks: [0, 0.25, 0.5, 0.75, 1],
      yFmt: function (v) { return (v * 100) + "%"; },
      series: sers,
      yLabel: "probability by then",
      aria: "Probability of a war of at least a given size by each date"
    });
  }

  function renderFree() {
    var sel = state.sel;
    timeChart(document.getElementById("chartFree"), {
      years: sel.years,
      H: 300,
      yLog: false, yMin: 0, yMax: 1,
      yTicks: [0, 0.25, 0.5, 0.75, 1],
      yFmt: function (v) { return (v * 100) + "%"; },
      series: [
        { name: "settled", color: C.violet, data: sel.years.map(function (y) {
          var k = sel.settleSorted.filter(function (v) { return v <= y + 100; }).length;
          return k / sel.params.paths;
        }), width: 1.5, dash: "4 3" },
        { name: "century with no war", color: C.mint, data: sel.warFree, width: 2.4 }
      ],
      labelAt: function (y) { return y + "–" + (y + 100); },
      yLabel: "share of futures",
      aria: "Probability a century contains no war, against settlement formation"
    });
  }

  /* ---------------------------------------------------------------- panels --- */
  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    var body = M.calibrate().map(function (c) {
      return "<div class='check " + (c.status === "ok" ? "ok" : "warn") + "'>" +
        "<span class='cval'>" + (c.status === "ok" ? "ok" : "!!") + "</span>" +
        "<span class='clabel'>" + c.label + " <b>" + c.value + "</b></span>" +
        "<span class='cdetail'>" + c.detail + "</span></div>";
    }).join("");
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run by <code>war-model.js</code> on load and by <code>node war-check.mjs</code>. " +
      "The second one is the load-bearing test: the model's own arithmetic has to land inside Clauset's published " +
      "number, or the exponent has been mis-read and every scenario above is wrong in the same direction.</p>" +
      "<div class='checks'>" + body + "</div>";
  }

  function provTag(p) {
    var map = { measured: "green", published: "green", derived: "amber", judgment: "red" };
    return "<span class='tag " + (map[p] || "") + "'>" + p + "</span>";
  }

  function renderParams() {
    var host = document.getElementById("params");
    if (!host) return;
    var rows = [];

    function row(group, name, val, prov, note) {
      rows.push("<tr><td class='muted'>" + group + "</td><td><b>" + name + "</b></td><td class='rt-num'>" + val +
        "</td><td>" + provTag(prov) + "</td><td>" + note + "</td></tr>");
    }

    row("record", "Wars above 7,061 deaths", "51 of 95", "measured", "Correlates of War, 1823–2003");
    row("record", "Onset rate, tail", "0.2818 / yr", "derived", "51 wars in 181 years");
    row("record", "Onset rate, all", "0.5249 / yr", "derived", "95 wars in 181 years");
    row("record", "Survival exponent", "0.53", "published", "α = 1.53 ± 0.07 minus one; below 1, so the mean is undefined");
    row("record", "Background deaths", "99,971 / yr", "measured", "UCDP battle plus one-sided, 1989–2024");
    row("record", "Largest war on record", "16.63M", "published", "WWII battle deaths, the top of the fitted range");
    row("escalation", "Regional exchange", "2.0bn at risk", "published", "Xia et al. 2022, ≥5 Tg soot");
    row("escalation", "US–Russia exchange", "5.0bn at risk", "published", "Xia et al. 2022, ~150 Tg soot");
    row("escalation", "Expert P(10M dead by 2045)", "5%", "published", "FRI 2024, 110 domain experts; superforecasters 1%");
    row("escalation", "Ord, nuclear existential risk", "1 in 1,000 / century", "published", "The Precipice, table 6.1");
    row("levers", "Deterrence", "0.50", "judgment", "no published effect size");
    row("levers", "Escalation given a great-power war", "0.35", "judgment", "anchored on the expert medians, not derived");
    row("levers", "Ceiling", "60% of population", "judgment", "the US–Russia famine estimate, applied to whoever is alive");
    row("levers", "Settlement hazard", "0.15% / yr", "judgment", "Bostrom's >50% prior over eight millennia lands here");
    row("levers", "AI effect on onset / escalation", "×1.0 / ×1.0", "judgment", "RAND names four pathways and gives no magnitudes");

    host.innerHTML = "<h2>Every number, and where it came from</h2>" +
      "<p>Three of these groups are not the same kind of thing. <b>Measured</b> means counted from a dataset. " +
      "<b>Published</b> means a named paper states it, with an interval the page carries through. " +
      "<b>Judgment</b> means no published effect size exists and the number is a choice — those are the levers, " +
      "and they are labelled as such wherever they appear.</p>" +
      "<table class='rate-table'><thead><tr><th>group</th><th>quantity</th><th>value</th><th>source</th><th>note</th></tr></thead><tbody>" +
      rows.join("") + "</tbody></table>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2><p>Nine papers carry this page. The disagreement between the first three is not a " +
      "gap in the literature — it is the literature, and the model is built so that the disagreement is visible rather than resolved.</p>" +
      D.sources.map(function (s) {
        return "<div class='src'><strong>" + s.name + "</strong><span class='src-vintage'>" + s.provider + "</span>" +
          "<a href='" + s.url + "' target='_blank' rel='noopener'>source</a>" +
          "<p class='muted'>" + s.note + "</p></div>";
      }).join("");
  }

  function renderLimits() {
    var host = document.getElementById("limits");
    if (!host) return;
    host.innerHTML = "<h2>What this cannot do</h2>" +
      "<ul class='limits'>" +
      "<li><b>It extrapolates an exponent across six orders of magnitude.</b> The fit covers wars from 7,061 to 16.6 million " +
      "deaths. Every war above 16.6 million on this page is the model continuing a line into a region with no observations. " +
      "That is the single largest caveat here and it is not a small one.</li>" +
      "<li><b>It holds war size fixed while population grows.</b> A real war in 5000 CE would probably be larger in absolute " +
      "terms than the same war in 1823, because there would be more people and more things to destroy. Holding the fitted " +
      "distribution fixed understates the far future rather than overstating it.</li>" +
      "<li><b>It models interstate war only.</b> Civil wars kill more people in total and have never killed ten million in " +
      "one war. They are counted here as a background flow, which is the right shape for the question and the wrong shape " +
      "for a civil-war forecast.</li>" +
      "<li><b>No conflict is modelled between wars.</b> No alliances, no arms races, no trade, no climate, no AI capability " +
      "trajectory — the levers stand in for all of it, and each is a single number where the world has a mechanism.</li>" +
      "<li><b>The settlement is a coin, not a theory.</b> Whether a durable world order can form, and whether it can hold, " +
      "are the two most important questions on the page and the model treats them as constant hazards because nobody has " +
      "produced anything better.</li>" +
      "<li><b>Nothing here is a prediction.</b> The output is a distribution conditional on a scenario. Change the exponent " +
      "by a tenth and the far future changes by orders of magnitude; that sensitivity is the finding, not a defect.</li>" +
      "</ul>";
  }

  /* --------------------------------------------------------------- controls --- */
  var GROUPS = [
    {
      title: "Onset",
      items: [
        { k: "trend", label: "Peace trend", min: -0.03, max: 0.03, step: 0.001, prov: "judgment",
          fmt: function (v) { return (v * 100).toFixed(1) + "%/yr"; },
          note: "Annual change in the onset rate. Zero is Clauset's null." },
        { k: "onsetMult", label: "Onset level", min: 0.2, max: 3, step: 0.05, prov: "judgment",
          fmt: function (v) { return "×" + v.toFixed(2); },
          note: "Multiplies the measured 0.28 tail wars a year." }
      ]
    },
    {
      title: "Severity and escalation",
      items: [
        { k: "nuclearGate", label: "Escalation given a great-power war", min: 0, max: 1, step: 0.01, prov: "judgment",
          fmt: function (v) { return Math.round(v * 100) + "%"; },
          note: "Chance a war already larger than WWII goes nuclear." },
        { k: "deterrence", label: "Deterrence", min: 0, max: 1, step: 0.01, prov: "judgment",
          fmt: function (v) { return Math.round(v * 100) + "%"; },
          note: "Suppresses large wars, and raises what the ones that happen cost." },
        { k: "aiEscalation", label: "AI effect on escalation", min: 0.5, max: 3, step: 0.05, prov: "judgment",
          fmt: function (v) { return "×" + v.toFixed(2); },
          note: "RAND's four pathways, with no published magnitude." },
        { k: "capFrac", label: "Ceiling", min: 0.2, max: 0.9, step: 0.01, prov: "judgment",
          fmt: function (v) { return Math.round(v * 100) + "% of population"; },
          note: "The most one war can kill." }
      ]
    },
    {
      title: "Institutions",
      items: [
        { k: "settleRate", label: "Settlement hazard", min: 0, max: 0.01, step: 0.0002, prov: "judgment",
          fmt: function (v) { return v > 0 ? (v * 100).toFixed(2) + "%/yr" : "never"; },
          note: "Chance per year a durable world order forms." },
        { k: "settleHold", label: "Hold strength", min: 0.9, max: 0.9999, step: 0.0001, prov: "judgment",
          fmt: function (v) { return (v * 100).toFixed(2) + "%"; },
          note: "How much of the war rate a settlement removes." }
      ]
    }
  ];

  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    GROUPS.forEach(function (grp) {
      var d = document.createElement("details");
      d.className = "lgroup";
      d.innerHTML = "<summary>" + grp.title + '<i class="caret" aria-hidden="true"></i></summary>';

      grp.items.forEach(function (it) {
        var wrap = document.createElement("div");
        wrap.className = "lever";
        var lab = document.createElement("label");
        lab.className = "lever-top";
        lab.innerHTML = "<span class='lever-name'>" + it.label + "</span><b class='lever-val' id='v_" + it.k + "'></b>";
        var input = document.createElement("input");
        input.type = "range";
        input.min = String(it.min); input.max = String(it.max); input.step = String(it.step);
        input.id = "s_" + it.k;
        input.setAttribute("aria-label", it.label);
        input.addEventListener("input", function () {
          state.overrides[it.k] = +input.value;
          document.getElementById("v_" + it.k).textContent = it.fmt(+input.value);
          schedule();
        });
        var note = document.createElement("p");
        note.className = "lever-note";
        note.textContent = it.note;
        wrap.appendChild(lab);
        wrap.appendChild(input);
        wrap.appendChild(note);
        d.appendChild(wrap);
      });
      host.appendChild(d);
    });

    syncControls();
  }

  function syncControls() {
    var p = params();
    GROUPS.forEach(function (grp) {
      grp.items.forEach(function (it) {
        var el = document.getElementById("s_" + it.k);
        var lb = document.getElementById("v_" + it.k);
        if (el) el.value = String(p[it.k]);
        if (lb) lb.textContent = it.fmt(p[it.k]);
      });
    });
  }

  function buildScenarios() {
    var host = document.getElementById("scenarios");
    if (!host) return;
    host.className = "chips";
    host.innerHTML = "";
    D.scenarios.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (s.id === state.id ? " on" : "");
      b.style.setProperty("--chip", SC[s.id]);
      b.textContent = s.label;
      b.title = s.blurb;
      b.addEventListener("click", function () {
        state.id = s.id;
        state.overrides = {};
        Array.prototype.forEach.call(host.children, function (c) { c.classList.remove("on"); });
        b.classList.add("on");
        syncControls();
        schedule(true);
      });
      host.appendChild(b);
    });
  }

  function schedule(full) {
    clearTimeout(state.timer);
    state.timer = setTimeout(function () {
      if (full) {
        var q = params();
        q.paths = PATHS_SEL;
        state.sel = M.simulate(q);
        state.sims[state.id] = state.sel;
        renderHazard();
      } else {
        var q2 = params();
        q2.paths = PATHS_SEL;
        state.sel = M.simulate(q2);
        state.sims[state.id] = state.sel;
        renderHazard();
      }
      renderAll();
    }, 90);
  }

  function renderAll() {
    renderKpis();
    renderVerdict();
    renderLargest();
    renderDeaths();
    renderThreshold();
    renderFree();
    renderWait();
  }

  /* ------------------------------------------------------------------ init --- */
  var t0 = Date.now();
  runAll();
  state.ms = Date.now() - t0;

  buildScenarios();
  buildControls();
  renderAll();
  renderHazard();
  renderChecks();
  renderParams();
  renderSources();
  renderLimits();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.overrides = {};
      syncControls();
      schedule(true);
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.resizeT);
    state.resizeT = setTimeout(function () { renderAll(); renderHazard(); }, 180);
  });
})();
