/* ============================================================================
   fuels-app.js — levers, charts and generated reading for fuels.html.
   Depends on fuels-data.js (window.FUELS_DATA) and fuels.js (window.FUELS).
   ============================================================================ */
(function () {
  "use strict";

  var F = window.FUELS;
  var D = F.D;
  var H = F.H;

  var state = {};
  for (var k in F.DEFAULTS) state[k] = F.DEFAULTS[k];

  var horizon = 2200;
  var res = null;
  var ens = null;
  var pending = null;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373",
    red: "#c28181", violet: "#a396b3", dim: "#7e8d9e",
    line: "#232528", teal: "#84aeb2"
  };

  /* --------------------------------------------------------------- helpers */
  function el(t, cls, html) { var d = document.createElement(t); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function nf(x, d) { return Number(x).toFixed(d === undefined ? 0 : d); }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 0 : d) + "%"; }
  function fmtLever(lv, v) {
    switch (lv.fmt) {
      case "pct": return (v * 100).toFixed(lv.step < 0.01 ? 1 : 0) + "%";
      case "usd": return "$" + Math.round(v);
      case "t": return "$" + Math.round(v);
      case "yr": return String(Math.round(v)) + (v >= 2149 && lv.key === "phaseoutYear" ? " (no mandate)" : "");
      case "bn": return nf(v, 1) + "bn";
      case "gj": return nf(v, 0) + " GJ";
      case "gt": return nf(v, 1);
      case "c": return nf(v, 1) + " C";
      case "x": return nf(v, 2) + "x";
      default: return String(v);
    }
  }
  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var out = [], v = Math.ceil(min / step) * step;
    for (; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }
  function autoMax(arrs) {
    var m = 0;
    arrs.forEach(function (a) { a.forEach(function (v) { if (isFinite(v) && v > m) m = v; }); });
    return m;
  }

  var YEAR0 = 1800;
  function yearsAll() {
    var out = [];
    for (var y = YEAR0; y <= horizon; y++) out.push(y);
    return out;
  }
  /* Align measured history (1800-2025) and the computation (2025-horizon) onto
     one array so a chart can draw both without knowing where the seam is. */
  function combine(histArr, modArr) {
    var out = [];
    for (var y = YEAR0; y <= horizon; y++) {
      if (y <= F.HIST_END) out.push(histArr[y - YEAR0]);
      else out.push(modArr[y - F.HIST_END]);
    }
    return out;
  }

  /* ------------------------------------------------------------------ chart */
  function chart(cfg) {
    var W = cfg.w || 700, Hh = cfg.h || 250;
    var m = { l: 50, r: cfg.right ? 52 : 16, t: 16, b: 26 };
    var iw = W - m.l - m.r, ih = Hh - m.t - m.b;
    /* geometry handed to hover.js, which needs the plot rect and viewBox and
       must not guess them from the DOM */
    cfg.__geom = { W: W, H: Hh, m: m, iw: iw, ih: ih };
    var yrs = cfg.years;
    var xMin = yrs[0], xMax = yrs[yrs.length - 1];
    function X(v) { return m.l + (v - xMin) / (xMax - xMin) * iw; }
    function Y(v, which) {
      var a = cfg[which || "left"];
      return m.t + (1 - (v - a.min) / (a.max - a.min)) * ih;
    }

    var s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" role="img">';

    (cfg.shade || []).forEach(function (b) {
      s += '<rect x="' + X(b.from).toFixed(1) + '" y="' + m.t + '" width="' + (X(b.to) - X(b.from)).toFixed(1) +
        '" height="' + ih + '" fill="' + b.color + '"/>';
    });

    niceTicks(cfg.left.min, cfg.left.max, 4).forEach(function (v) {
      var y = Y(v);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-width="1" stroke-dasharray="2 4"/>';
      s += '<text x="' + (m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        cfg.left.fmt(v) + "</text>";
    });

    if (cfg.right) {
      niceTicks(cfg.right.min, cfg.right.max, 4).forEach(function (v) {
        var y = Y(v, "right");
        s += '<text x="' + (W - m.r + 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="start" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
          cfg.right.fmt(v) + "</text>";
      });
    }

    var span = xMax - xMin;
    var step = span <= 160 ? 20 : span <= 380 ? 50 : 100;
    var lastX = -1e9;
    yrs.forEach(function (yr) {
      if (yr % step !== 0) return;
      var px = X(yr);
      if (px - lastX < 40) return;
      if (X(xMax) - px < 26) return;
      lastX = px;
      s += '<text x="' + px.toFixed(1) + '" y="' + (Hh - 7) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        yr + "</text>";
    });
    /* the last year on the axis always gets a label, even when it is off-step */
    if (X(xMax) - lastX > 26) {
      s += '<text x="' + X(xMax).toFixed(1) + '" y="' + (Hh - 7) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        xMax + "</text>";
    }

    /* stacked areas */
    var totals = {};
    (cfg.series || []).forEach(function (se) {
      if (!se.stack) return;
      var base = totals[se.stack] || se.data.map(function () { return 0; });
      var lower = base.slice();
      var upper = se.data.map(function (v, i) { return (base[i] || 0) + Math.max(0, v || 0); });
      totals[se.stack] = upper;
      var d = "";
      upper.forEach(function (v, i) { d += (i ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v).toFixed(1); });
      for (var i = lower.length - 1; i >= 0; i--) d += "L" + X(yrs[i]).toFixed(1) + " " + Y(lower[i]).toFixed(1);
      d += "Z";
      s += '<path d="' + d + '" fill="' + se.color + '" opacity="' + (se.opacity || 0.55) + '"/>';
    });

    /* uncertainty band (two edges) */
    if (cfg.band) {
      var lo = cfg.band.lower, hi = cfg.band.upper, d2 = "", started = false;
      for (var i = 0; i < hi.length; i++) {
        if (hi[i] == null || lo[i] == null) { started = false; continue; }
        d2 += (started ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(hi[i]).toFixed(1);
        started = true;
      }
      for (var j = lo.length - 1; j >= 0; j--) {
        if (lo[j] == null || hi[j] == null) continue;
        d2 += "L" + X(yrs[j]).toFixed(1) + " " + Y(lo[j]).toFixed(1);
      }
      if (d2) s += '<path d="' + d2 + 'Z" fill="' + (cfg.band.color || C.blue) + '" opacity="0.16" stroke="none"/>';
    }

    /* lines */
    (cfg.series || []).forEach(function (se) {
      if (se.stack) return;
      var d = "", started = false;
      se.data.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { started = false; return; }
        d += (started ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v, se.axis).toFixed(1);
        started = true;
      });
      if (se.fill) {
        var base = Y(se.baseline !== undefined ? se.baseline : cfg[se.axis || "left"].min, se.axis);
        s += '<path d="' + d + "L" + X(yrs[yrs.length - 1]).toFixed(1) + " " + base.toFixed(1) + "L" +
          X(yrs[0]).toFixed(1) + " " + base.toFixed(1) + 'Z" fill="' + se.color + '" opacity="' + (se.opacity || 0.10) + '"/>';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 1.9) + '"' +
        (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
    });

    (cfg.refs || []).forEach(function (r) {
      var y = Y(r.v, r.axis);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (r.color || C.amber) + '" stroke-width="1" stroke-dasharray="5 4" opacity="0.5"/>';
      if (r.label) {
        s += '<text x="' + (W - m.r - 3) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="end" fill="' + (r.color || C.amber) +
          '" font-size="9" font-family="ui-monospace,monospace" opacity="0.75">' + r.label + "</text>";
      }
    });

    /* the seam between measured and computed */
    if (cfg.divider && cfg.divider.x >= xMin && cfg.divider.x <= xMax) {
      var dx = X(cfg.divider.x);
      s += '<line x1="' + dx.toFixed(1) + '" x2="' + dx.toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) +
        '" stroke="#8a97a6" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>';
      s += '<text x="' + (dx + 4).toFixed(1) + '" y="' + (m.t + 9) + '" text-anchor="start" fill="#8a97a6" font-size="8.5" font-family="ui-monospace,monospace">computed &rarr;</text>';
    }

    s += "</svg>";

    var legend = "";
    if (cfg.legend) {
      legend = '<div class="legend">' + cfg.series.filter(function (x) { return x.name && !x.hideLegend; }).map(function (x) {
        return '<span><i style="background:' + x.color + '"></i>' + x.name + "</span>";
      }).join("") + "</div>";
    }
    return s + legend;
  }

  function draw(id, cfg) {
    var host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = chart(cfg);
    if (window.HOV && cfg.__geom) HOV.bind(host, HOV.linear(cfg, cfg.__geom));
  }

  /* ----------------------------------------------------------------- levers */
  var GROUPS = ["Policy", "Demand", "Technology", "Climate"];

  function buildLevers() {
    var host = document.getElementById("leverGroups");
    host.innerHTML = "";
    GROUPS.forEach(function (g) {
      /* A <details> per group, closed by default, so the column stays short
         enough that it rarely needs its own scrollbar. */
      var box = el("details", "lgroup");
      box.appendChild(el("summary", null, g + '<i class="caret" aria-hidden="true"></i>'));
      F.LEVERS.filter(function (l) { return l.group === g; }).forEach(function (lv) {
        var row = el("label", "lever");
        row.title = lv.note;
        var top = el("div", "lever-top");
        top.appendChild(el("span", "lever-name", lv.label));
        var val = el("span", "lever-val", fmtLever(lv, state[lv.key]));
        top.appendChild(val);
        row.appendChild(top);
        var inp = el("input");
        inp.type = "range";
        inp.min = lv.min; inp.max = lv.max; inp.step = lv.step; inp.value = state[lv.key];
        inp.setAttribute("aria-label", lv.label);
        inp.addEventListener("input", function () {
          state[lv.key] = parseFloat(inp.value);
          val.textContent = fmtLever(lv, state[lv.key]);
          schedule();
        });
        row.appendChild(inp);
        box.appendChild(row);
      });
      host.appendChild(box);
    });
  }

  function syncLevers() {
    var host = document.getElementById("leverGroups");
    var inputs = host.querySelectorAll("input[type=range]");
    var flat = [];
    GROUPS.forEach(function (g) { F.LEVERS.filter(function (l) { return l.group === g; }).forEach(function (l) { flat.push(l); }); });
    inputs.forEach(function (inp, i) {
      var lv = flat[i];
      inp.value = state[lv.key];
      var val = inp.parentNode.querySelector(".lever-val");
      if (val) val.textContent = fmtLever(lv, state[lv.key]);
    });
  }

  function buildPresets() {
    var host = document.getElementById("presets");
    host.innerHTML = "";
    Object.keys(F.PRESETS).forEach(function (id) {
      var p = F.PRESETS[id];
      var b = el("button", "preset", p.label);
      b.type = "button";
      b.title = p.note;
      b.addEventListener("click", function () {
        for (var kk in F.DEFAULTS) state[kk] = F.DEFAULTS[kk];
        for (var kk2 in p.v) state[kk2] = p.v[kk2];
        host.querySelectorAll(".preset").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        syncLevers();
        render();
      });
      if (id === "current") b.classList.add("on");
      host.appendChild(b);
    });
  }

  function buildHorizon() {
    var host = document.getElementById("horizon");
    host.innerHTML = "";
    [2100, 2200, 2500].forEach(function (y) {
      var b = el("button", "hbtn", String(y));
      b.type = "button";
      if (y === horizon) b.classList.add("on");
      b.addEventListener("click", function () {
        horizon = y;
        host.querySelectorAll(".hbtn").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        document.getElementById("hbarNote").textContent =
          y === 2100 ? "the policy horizon: where targets get judged"
            : y === 2200 ? "past the peak in every scenario on this page"
              : "2500 is past the point where the deep ocean equilibrates";
        render();
      });
      host.appendChild(b);
    });
  }

  /* --------------------------------------------------------------- readings */
  function kpi(label, value, note, cls) {
    var d = el("div", "kpi");
    d.appendChild(el("div", "klabel", label));
    d.appendChild(el("div", "kval" + (cls ? " " + cls : ""), value));
    if (note) d.appendChild(el("div", "knote", note));
    return d;
  }

  function renderKpis() {
    var kv = res.kpis, host = document.getElementById("kpis");
    host.innerHTML = "";
    var cls = kv.peakT > 2 ? "bad" : kv.peakT > 1.6 ? "warn" : "good";
    host.appendChild(kpi("Warming 2100", nf(kv.temp2100, 2) + " C", "measured today: " + nf(kv.temp2025, 2) + " C", cls));
    host.appendChild(kpi("Peak warming", nf(kv.peakT, 2) + " C", "reached " + kv.peakYear, kv.peakT > 2 ? "bad" : "warn"));
    host.appendChild(kpi("Fossil share 2050", nf(kv.fossilShare2050 * 100, 0) + "%",
      "today " + nf(kv.fossilShareNow * 100, 0) + "%", kv.fossilShare2050 > 0.4 ? "bad" : "neutral"));
    host.appendChild(kpi("Net zero", kv.netZero ? String(kv.netZero) : "never",
      kv.netZero ? "first year net emissions hit zero" : "emissions stay positive", kv.netZero && kv.netZero < 2060 ? "good" : "warn"));
    host.appendChild(kpi("Sea level 2100", nf(kv.slr2100, 2) + " m", nf(kv.slr2200, 2) + " m by 2200", kv.slr2100 > 0.7 ? "bad" : "warn"));
    host.appendChild(kpi("CO2 in 2100", nf(kv.conc2100, 0) + " ppm", "today " + nf(H.co2Conc[H.co2Conc.length - 1], 0) + " ppm",
      kv.conc2100 > 500 ? "bad" : "warn"));
  }

  function renderVerdict() {
    var kv = res.kpis, host = document.getElementById("verdict");
    var over = kv.peakT - 1.5;
    var body = "";
    if (kv.peakT < 1.6) {
      body = "This path holds the line. Peak warming of " + nf(kv.peakT, 2) +
        " C arrives in " + kv.peakYear + ", then bends down as the carbon cycle and the deep ocean catch up. " +
        "It requires the mandate, near-total price coverage and " + nf(state.cdr, 1) + " Gt a year of removal, which is the part that has never happened.";
    } else if (kv.peakT < 2.2) {
      body = "This path overshoots and comes back. Peak warming of " + nf(kv.peakT, 2) + " C in " + kv.peakYear +
        " is roughly the 1.8&ndash;2.2 C band that current pledges point at. The overshoot is reversible only on a centuries timescale: " +
        "the concentration chart shows why.";
    } else if (kv.peakT < 3.0) {
      body = "This is the middle of the road, and the middle of the road is " + nf(kv.peakT, 2) +
        " C. Fossil share is still " + pct(kv.fossilShare2050) + " in 2050" +
        (kv.netZero ? " and net zero does not arrive until " + kv.netZero : " and net emissions never reach zero") +
        ". Every tenth of a degree here is bought with a policy that does not currently exist.";
    } else {
      body = "Nothing on this page is holding " + nf(kv.peakT, 2) +
        " C back. Emissions stay positive past 2200, the concentration keeps climbing, and sea level is committed to " +
        nf(kv.slrPeak, 1) + " m and still rising at the end of the simulation. This is not a scenario anyone proposes; it is what the absence of one produces.";
    }
    host.innerHTML =
      '<div class="verdict-head"><span class="vlabel">This scenario</span>' +
      '<strong class="vnum">' + nf(kv.peakT, 2) + " C</strong>" +
      '<span class="vsub">peak warming, ' + kv.peakYear + " &middot; " + nf(over, 2) + " C above the 1.5 C line</span></div>" +
      '<p class="vbody">' + body + "</p>";
  }

  /* ----------------------------------------------------------------- charts */
  function renderCharts() {
    var yrs = yearsAll();
    var k = res.years.indexOf(2025);

    /* 1. energy by source. The axis must scale to the stacked total, not to the
       largest single fuel, or the top of the stack draws outside the plot. */
    var series = F.FUELS.map(function (f) {
      return { name: f.label, color: f.color, data: combine(H[f.key], res.shares[f.key]), stack: "e", opacity: 0.72 };
    });
    var stackTotals = yrs.map(function (_, i) {
      return series.reduce(function (s, x) { return s + (x.data[i] || 0); }, 0);
    });
    draw("chartEnergy", {
      years: yrs, h: 300, divider: { x: 2025 },
      left: { min: 0, max: Math.max(200, autoMax([stackTotals]) * 1.04), fmt: function (v) { return nf(v, 0); } },
      series: series, legend: true
    });

    /* 2. fossil share */
    var sh = yrs.map(function (y, i) {
      var e = 0, fo = 0;
      F.FUELS.forEach(function (f) {
        var v = series[F.FUELS.indexOf(f)].data[i];
        if (v == null) return;
        e += v;
        if (f.ef) fo += v;
      });
      return e > 0 ? (fo / e) * 100 : null;
    });
    draw("chartShare", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 0, max: 100, fmt: function (v) { return nf(v, 1) + "%"; } },
      series: [
        { name: "Fossil", color: C.amber, data: sh, fill: true, width: 2.2 },
        { name: "Zero-carbon", color: C.mint, data: sh.map(function (v) { return v == null ? null : 100 - v; }), width: 1.6, dash: true }
      ],
      refs: [{ v: 50, label: "half", color: C.dim }],
      legend: true
    });

    /* 3. energy per person */
    var perCap = yrs.map(function (y, i) {
      var e = y <= 2025 ? H.total[i] : res.energy[y - F.HIST_END];
      var p = y <= 2025 ? H.population[i] : res.pop[y - F.HIST_END];
      return e * 1e18 / p / 1e9;
    });
    draw("chartPerCap", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 0, max: Math.max(320, autoMax([perCap]) * 1.12), fmt: function (v) { return nf(v, 0); } },
      series: [{ name: "GJ per person", color: C.blue, fill: true, width: 2.2, data: perCap }],
      refs: [{ v: 78, label: "world today", color: C.mint }, { v: 290, label: "US today", color: C.dim }],
      legend: true
    });

    /* 4. emissions */
    draw("chartEmissions", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: -8, max: 46, fmt: function (v) { return nf(v, 0); } },
      series: [
        { name: "Measured", color: C.amber, data: combine(H.co2Total, res.emissions.map(function () { return null; })), width: 2.2 },
        { name: "Computed", color: C.red, data: combine(H.co2Total.map(function () { return null; }), res.emissions), width: 2, dash: true }
      ],
      refs: [{ v: 0, label: "net zero", color: C.mint }],
      legend: true
    });

    /* 5. concentration */
    draw("chartConc", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 260, max: Math.max(520, autoMax([combine(H.co2Conc, res.conc)]) * 1.05), fmt: function (v) { return nf(v, 0); } },
      series: [
        { name: "CO2", color: C.mint, data: combine(H.co2Conc, res.conc), width: 2.3 },
        { name: "Pre-industrial", color: C.dim, data: yrs.map(function () { return 280; }), width: 1, dash: true }
      ],
      refs: [{ v: 350, label: "350", color: C.dim }, { v: 450, label: "450", color: C.amber }, { v: 550, label: "550", color: C.red }],
      legend: true
    });

    /* 6. temperature */
    var allT = combine(H.tempAnom, res.temp);
    var bandHi = combine(H.tempUpper, ens.temp.p90);
    draw("chartTemp", {
      years: yrs, h: 290, divider: { x: 2025 },
      band: { lower: combine(H.tempLower, ens.temp.p10), upper: bandHi, color: C.blue },
      left: { min: -0.4, max: Math.max(2.4, autoMax([allT, bandHi]) * 1.1), fmt: function (v) { return nf(v, 1); } },
      series: [
        { name: "Measured", color: "#dcdfde", data: combine(H.tempAnom, res.temp.map(function () { return null; })), width: 1.6 },
        { name: "Computed", color: C.red, data: combine(H.tempAnom.map(function () { return null; }), res.temp), width: 2.4 }
      ],
      refs: [{ v: 1.5, label: "1.5 C", color: C.mint }, { v: 2.0, label: "2.0 C", color: C.amber }],
      legend: true
    });

    /* 6b. ocean heat. The imbalance is the model's own top-of-atmosphere budget
       (forcing minus the response), accumulated into the stock the ocean holds.
       1 W/m2 for a year over the ocean surface is 16.1 ZJ, so the two axes are the
       rate and its integral rather than two independent quantities. */
    var netT = combine(H.tempAnom.map(function () { return null; }), res.netTOA);
    var ohcZ = combine(H.tempAnom.map(function () { return null; }), res.ohc);
    draw("chartOhc", {
      years: yrs, h: 254, divider: { x: 2025 },
      left: { min: 0, max: Math.max(1.6, autoMax([netT]) * 1.18), fmt: function (v) { return nf(v, 1) + " W/m2"; } },
      right: { min: 0, max: Math.max(400, autoMax([ohcZ]) * 1.1), fmt: function (v) { return nf(v, 0) + " ZJ"; } },
      series: [
        { name: "Imbalance (W/m2)", color: C.amber, data: netT, width: 2.2 },
        { name: "Ocean heat (ZJ)", color: C.teal, data: ohcZ, axis: "right", width: 2 }
      ],
      refs: [{ v: 0.9, label: "CERES ~0.9", color: C.mint }],
      legend: true
    });

    /* 7. population */
    var popProj = {};
    D.populationProjection.forEach(function (p) { popProj[p[0]] = p[1] / 1e9; });
    draw("chartPop", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 0, max: Math.max(11, autoMax([combine(H.population, res.pop)]) / 1e9 * 1.08), fmt: function (v) { return nf(v, 0) + "bn"; } },
      series: [
        { name: "Measured", color: C.blue, data: combine(H.population.map(function (v) { return v / 1e9; }), res.pop.map(function () { return null; })), width: 2.4 },
        { name: "UN projection", color: C.dim, data: yrs.map(function (y) { return popProj[y] != null ? popProj[y] : null; }), dash: true, width: 1.5 },
        { name: "Model after 2100", color: C.violet, data: combine(H.population.map(function () { return null; }), res.pop.map(function (v) { return v / 1e9; })), width: 2 }
      ],
      legend: true
    });

    /* 8. sea level. The stack is the total, so the axis can use the total series. */
    draw("chartSea", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: -0.3, max: Math.max(1.2, autoMax([combine(H.seaLevel, res.slr)]) * 1.08), fmt: function (v) { return nf(v, 1); } },
      series: [
        { name: "Ice sheets", color: "#8aa4be", data: combine(H.seaLevel.map(function () { return null; }), res.slrIce), stack: "s", opacity: 0.7 },
        { name: "Thermal expansion", color: "#6d8194", data: combine(H.seaLevel.map(function () { return null; }), res.slrTherm), stack: "s", opacity: 0.55 },
        { name: "Measured", color: "#dcdfde", data: combine(H.seaLevel, res.slr.map(function () { return null; })), width: 2.2 }
      ],
      refs: [{ v: 0, label: "1993-2012 mean", color: C.dim }],
      legend: true
    });

    /* 8b. measured ice sheet loss. A 2000-2025 window rather than 1800, because
       GRACE only starts in 2002 and the earlier 200 years would be empty. */
    var iceYears = [];
    for (var iy = 2000; iy <= 2025; iy++) iceYears.push(iy);
    var icePick = function (arr) {
      return iceYears.map(function (y) { var v = arr[y - YEAR0]; return v === undefined ? null : v; });
    };
    draw("chartIce", {
      years: iceYears, h: 236,
      left: { min: 0, max: Math.max(2000, autoMax([icePick(H.iceLoss)]) * 1.1), fmt: function (v) { return nf(v, 0) + " Gt"; } },
      series: [
        { name: "Greenland", color: C.blue, data: icePick(H.iceLossGreenland), fill: true, width: 1.9 },
        { name: "Antarctica", color: C.mint, data: icePick(H.iceLossAntarctica), fill: true, width: 1.9, baseline: 0 },
        { name: "Combined", color: "#dcdfde", data: icePick(H.iceLoss), width: 2.4 }
      ],
      legend: true
    });

    /* 9. pH */
    draw("chartPH", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: Math.min(7.6, autoMax([res.pH.map(function (v) { return 8.2 - v; })]) ? 7.6 : 7.6), max: 8.2, fmt: function (v) { return nf(v, 2); } },
      series: [{ name: "Surface ocean pH", color: C.teal, data: combine(H.co2Conc.map(function (c) { return 8.17 - 0.75 * Math.log10(c / 280); }), res.pH), width: 2.3 }],
      refs: [{ v: 8.17, label: "pre-industrial", color: C.dim }],
      legend: true
    });

    /* 10. cumulative vs budget */
    var cum = yrs.map(function (y, i) {
      if (y <= 2025) return null;
      return res.cumEmis[y - F.HIST_END] - res.cumEmis[0];
    });
    draw("chartBudget", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 0, max: Math.max(1200, autoMax([res.cumEmis.map(function (v) { return v - res.cumEmis[0]; })]) * 1.05), fmt: function (v) { return nf(v, 0); } },
      series: [{ name: "Cumulative since 2025", color: C.violet, data: cum, fill: true, width: 2.2 }],
      refs: [
        { v: 200, label: "1.5 C budget (50%)", color: C.mint },
        { v: 500, label: "1.5 C budget (17%)", color: C.amber },
        { v: 1150, label: "2 C budget (67%)", color: C.red }
      ],
      legend: true
    });

    /* 11. damage */
    draw("chartDamage", {
      years: yrs, h: 236, divider: { x: 2025 },
      left: { min: 0, max: Math.max(4, autoMax([res.damage]) * 100 * 1.15), fmt: function (v) { return nf(v, 1) + "%"; } },
      series: [{ name: "Output lost", color: C.red, data: combine(H.tempAnom.map(function () { return null; }), res.damage.map(function (v) { return v * 100; })), fill: true, width: 2.2 }],
      legend: true
    });
  }

  /* ------------------------------------------------------------------ record */
  function firstAt(arr, y) {
    var i = D.years.indexOf(y);
    if (i >= 0 && arr[i] != null) return arr[i];
    for (var j = 0; j < arr.length; j++) if (arr[j] != null) return arr[j];
    return null;
  }

  function renderRecord() {
    var host = document.getElementById("record");
    var e0 = H.total[0], e1 = H.total[H.total.length - 1];
    var p0 = H.population[0], p1 = H.population[H.population.length - 1];
    var c0 = H.co2Conc[0], c1 = H.co2Conc[H.co2Conc.length - 1];
    var g0 = firstAt(H.gdpPc, 1820), g1 = H.gdpPc[D.years.indexOf(2022)];
    var l0 = firstAt(H.lifeExp, 1800), l1 = H.lifeExp[D.years.indexOf(2023)];
    var cal0 = firstAt(H.calories, 1961), cal1 = H.calories[D.years.indexOf(2022)];
    var slr0 = firstAt(H.seaLevel, 1880), slr1 = H.seaLevel[D.years.indexOf(2021)];
    var co2_2024 = H.co2Total[D.years.indexOf(2024)];
    var cum = H.cumCo2[D.years.indexOf(2024)];

    /* the fossil share peak, found rather than asserted */
    var peakFrac = 0, peakYear = 1800;
    for (var i = 0; i < D.years.length; i++) {
      if (!H.total[i]) continue;
      var fr = H.fossil[i] / H.total[i];
      if (fr > peakFrac) { peakFrac = fr; peakYear = D.years[i]; }
    }
    var t1950 = H.tempAnom[D.years.indexOf(1950)];
    var t1850 = H.tempAnom[D.years.indexOf(1850)];
    var t2000 = H.tempAnom[D.years.indexOf(2000)];
    var t2025 = H.tempAnom[D.years.indexOf(2025)];
    var early = t1950 - t1850, recent = t2025 - t2000;

    var items = [
      ["Energy grew " + nf(e1 / e0, 0) + "-fold and population " + nf(p1 / p0, 1) + "-fold",
        "Primary energy went from " + nf(e0, 0) + " to " + nf(e1, 0) + " EJ, and the population from " +
        nf(p0 / 1e9, 2) + "bn to " + nf(p1 / 1e9, 2) + "bn. So energy per person rose only " +
        nf((e1 / p1) / (e0 / p0), 1) + "-fold. Most of the growth is people, not consumption per person &mdash; which is " +
        "why the catch-up question on this page matters so much more than population."],
      ["Fossil share rose from " + nf(H.fossil[0] / e0 * 100, 0) + "% to " + nf(H.fossil[H.fossil.length - 1] / e1 * 100, 0) + "%",
        "It peaked at " + nf(peakFrac * 100, 0) + "% in " + peakYear + " and has come down " + nf((peakFrac - H.fossil[H.fossil.length - 1] / e1) * 100, 0) +
        " points since. No decade in the record holds a decline of more than about three points, which is the " +
        "turnover speed the forward model has to respect."],
      ["CO2 is " + nf((c1 / c0 - 1) * 100, 0) + "% above its 1800 level",
        "From " + nf(c0, 0) + " ppm to " + nf(c1, 1) + " ppm. Roughly half of every tonne emitted is still in the air; " +
        "the rest is in the ocean and the biosphere, which is why the surface ocean has fallen from pH 8.17 to about " +
        nf(8.17 - 0.75 * Math.log10(c1 / 280), 2) + "."],
      ["The last 25 years added " + nf(recent / early, 1) + " times the warming of 1850&ndash;1950",
        "Warming was " + nf(t1850, 2) + " C in 1850, " + nf(t1950, 2) + " C in 1950, " + nf(t2000, 2) +
        " C in 2000 and " + nf(t2025, 2) + " C in 2025. Sea level rose " + nf((slr1 - slr0) * 100, 0) +
        " cm over the period it has been measured, and the rate is still accelerating."],
      ["Emissions are " + nf(co2_2024, 0) + " Gt a year and cumulative is " + nf(cum, 0) + " Gt",
        "2024 was " + nf(co2_2024, 1) + " GtCO2. Everything emitted since 1800 sums to " + nf(cum, 0) +
        " Gt, against a remaining 1.5 C budget of roughly 200 Gt from here. That the second number sets the " +
        "temperature, and not the first, is the whole argument."],
      ["The transition delivered more than energy",
        "GDP per head went from $" + nf(g0, 0) + " to $" + nf(g1, 0) + ", life expectancy from " + nf(l0, 0) + " to " +
        nf(l1, 0) + " years, and food from " + nf(cal0, 0) + " to " + nf(cal1, 0) + " kcal a day. Fossil energy is the " +
        "reason all four numbers moved, which is why the exit from it is contested."]
    ];
    host.innerHTML = items.map(function (it) {
      return '<div class="read-item"><h3>' + it[0] + "</h3><p>" + it[1] + "</p></div>";
    }).join("");
    document.getElementById("recordStamp").innerHTML =
      '<span class="stamp-label">Data through</span>' + D.range[1];
  }

  /* ------------------------------------------------------------- sensitivity */
  function renderSensitivity() {
    var out = F.sensitivity(state, function (r) { return r.temp[r.years.indexOf(2100)]; });
    var host = document.getElementById("sensBody");
    var maxSwing = out.rows[0].swing || 1;
    var html = '<div class="sens">';
    html += '<div class="sens-row" style="color:var(--dim2);font-size:10px;letter-spacing:.08em;text-transform:uppercase;">' +
      '<span>Lever</span><span>Range of 2100 warming</span><span style="text-align:right;">+' +
      nf(0.25 * 100, 0) + "% / &minus;" + nf(0.25 * 100, 0) + "%</span><span style=\"text-align:right;\">swing</span></div>";
    out.rows.forEach(function (r) {
      var w = clamp(r.swing / maxSwing, 0.01, 1) * 100;
      html += '<div class="sens-row"><span class="sens-label">' + r.label + "</span>" +
        '<span class="sens-track"><span class="sens-bar" style="left:0;width:' + w.toFixed(1) + '%"></span></span>' +
        '<span class="sens-nums">' + nf(r.lo, 2) + " &ndash; " + nf(r.hi, 2) + "</span>" +
        '<span class="sens-nums">' + nf(r.swing, 2) + " C</span></div>";
    });
    html += "</div>";
    html += '<p class="regime-note">Base case: <strong>' + nf(out.base, 2) +
      " C</strong> in 2100. A swing of 0.1 C is a rounding error in policy terms; a swing of 0.5 C is the difference between one target and another.</p>";
    host.innerHTML = html;
  }

  /* --------------------------------------------------------- sources, checks */
  function renderSources() {
    var host = document.getElementById("srcBody");
    var rows = D.sources.map(function (s) {
      return "<tr><td><strong>" + s.name + "</strong></td><td>" + s.provider + "</td>" +
        '<td class="src-vintage">' + s.coverage + "</td><td>" + (s.note || "") + "</td></tr>";
    }).join("");
    host.innerHTML =
      '<p class="regime-note" style="margin-top:0;">Ice cores supply CO2 before 1959, where no annual series exists: ' +
      D.constants.iceCore.map(function (a) { return a[0] + " (" + a[1] + ")"; }).join(", ") +
      " ppm. They are the only hardcoded climate numbers in the build.</p>" +
      '<div class="calib-scroll"><table class="calib-table"><thead><tr><th>Series</th><th>Provider</th><th>Coverage</th><th>Note</th></tr></thead><tbody>' +
      rows + "</tbody></table></div>";

    var chk = D.checks.map(function (c) {
      return '<div class="srow" style="grid-template-columns:64px 250px 130px minmax(0,1fr);">' +
        '<span class="' + (c.status === "pass" ? "good" : "bad") + '" style="font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;">' +
        c.status + "</span><span>" + c.label + '</span><span class="src-vintage">' + c.value + "</span>" +
        '<span class="muted" style="font-size:11px;">' + c.detail + "</span></div>";
    }).join("");
    var pass = D.checks.filter(function (c) { return c.status === "pass"; }).length;
    document.getElementById("checkBody").innerHTML =
      '<div class="muted" style="margin-bottom:7px;font-size:11.5px;">' + pass + " of " + D.checks.length +
      " checks pass. The two that matter: the energy series and the emissions series are independent constructions of the same " +
      "quantity and agree within 1%, and the carbon cycle reconstructs the observed CO2 record from emissions alone.</div>" +
      '<div class="checks">' + chk + "</div>";
  }

  /* -------------------------------------------------------------------- main
     A lever drag now costs a 96-run ensemble as well as the single path, so the
     render is debounced: the page follows the slider at ~10 Hz instead of
     blocking on every input event. */
  function schedule() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; render(); }, 90);
  }

  function render() {
    res = F.simulate(state);
    ens = F.ensemble(state, 96);
    res.kpis.fossilShare2050 = (function () {
      var i = res.years.indexOf(2050);
      return (res.shares.coal[i] + res.shares.oil[i] + res.shares.gas[i]) / res.energy[i];
    })();
    renderKpis();
    renderVerdict();
    renderCharts();
    renderSensitivity();
  }

  /* --------------------------------------------------------------------- go */
  buildLevers();
  buildPresets();
  buildHorizon();
  renderRecord();
  renderSources();
  render();

  document.getElementById("reset").addEventListener("click", function () {
    for (var kk in F.DEFAULTS) state[kk] = F.DEFAULTS[kk];
    syncLevers();
    document.querySelectorAll("#presets .preset").forEach(function (x) { x.classList.remove("on"); });
    var first = document.querySelector("#presets .preset");
    if (first) first.classList.add("on");
    render();
  });

  document.getElementById("footStamp").textContent =
    "data " + D.generated + " · " + D.sources.length + " sources · " + D.checks.length + " checks";
})();
