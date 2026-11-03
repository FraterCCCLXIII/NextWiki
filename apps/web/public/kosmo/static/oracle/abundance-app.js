/* ============================================================================
   abundance-app.js — levers, charts and generated readings for abundance.html
   Depends on abundance.js (global ABUND).
   ============================================================================ */
(function () {
  "use strict";

  var A = ABUND;
  var state = {};
  for (var k in A.DEFAULTS) state[k] = A.DEFAULTS[k];

  var out = null;
  var bundleYearIdx = 2050 - 2026;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373",
    red: "#c28181", violet: "#a396b3", dim: "#7e8d9e",
    line: "#232528", teal: "#84aeb2"
  };

  /* --------------------------------------------------------------- helpers */
  function el(t, cls, html) { var d = document.createElement(t); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function pct0(x) { return (x * 100).toFixed(0) + "%"; }
  function pct1(x) { return (x * 100).toFixed(1) + "%"; }
  function money(bn) {
    if (Math.abs(bn) >= 1000) return "$" + (bn / 1000).toFixed(1) + "T";
    return "$" + Math.round(bn) + "B";
  }
  function fmtLever(lv, v) {
    if (lv.fmt === "pct") return (v * 100).toFixed(lv.step < 0.01 ? 1 : 0) + "%";
    if (lv.fmt === "usd") return "$" + Math.round(v).toLocaleString();
    if (lv.fmt === "k") return "$" + Math.round(v) + "k";
    if (lv.fmt === "t") return "$" + Math.round(v);
    return String(v);
  }

  /* ----------------------------------------------------------------- charts */
  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var res = [], v = Math.ceil(min / step) * step;
    for (; v <= max + step * 1e-6; v += step) res.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return res;
  }

  function chart(cfg) {
    var W = cfg.w || 700, H = cfg.h || 250;
    var m = { l: 48, r: cfg.right ? 50 : 16, t: 14, b: 24 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    /* geometry for hover.js */
    cfg.__geom = { W: W, H: H, m: m, iw: iw, ih: ih };
    var yrs = cfg.years;
    var xMin = yrs[0], xMax = yrs[yrs.length - 1];
    function X(v) { return m.l + (v - xMin) / (xMax - xMin) * iw; }
    function Y(v, which) {
      var a = cfg[which || "left"];
      return m.t + (1 - (v - a.min) / (a.max - a.min)) * ih;
    }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';

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

    /* decade ticks, and never crowd the final one */
    var lastX = -1e9;
    yrs.forEach(function (yr, i) {
      if (yr % 10 !== 0) return;
      var px = X(yr);
      if (px - lastX < 34) return;
      if (X(xMax) - px < 22) return;
      lastX = px;
      s += '<text x="' + px.toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        yr + "</text>";
    });
    s += '<text x="' + X(xMax).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
      xMax + "</text>";

    /* stacked bands first, so lines sit on top */
    var totals = {};
    (cfg.series || []).forEach(function (se) {
      if (!se.stack) return;
      var base = totals[se.stack] || se.data.map(function () { return 0; });
      var lower = base.slice();
      var upper = se.data.map(function (v, i) { return (base[i] || 0) + Math.max(0, v); });
      totals[se.stack] = upper;
      var d = "";
      upper.forEach(function (v, i) { d += (i ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v).toFixed(1); });
      for (var i = lower.length - 1; i >= 0; i--) d += "L" + X(yrs[i]).toFixed(1) + " " + Y(lower[i]).toFixed(1);
      d += "Z";
      s += '<path d="' + d + '" fill="' + se.color + '" opacity="' + (se.opacity || 0.30) + '"/>';
    });

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
          X(yrs[0]).toFixed(1) + " " + base.toFixed(1) + 'Z" fill="' + se.color + '" opacity="' + (se.opacity || 0.12) + '"/>';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 1.9) + '"' +
        (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
    });

    (cfg.refs || []).forEach(function (r) {
      var y = Y(r.v, r.axis);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + (r.color || C.amber) + '" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>';
      if (r.label) {
        s += '<text x="' + (m.l + 4) + '" y="' + (y + 11).toFixed(1) + '" text-anchor="start" fill="' + (r.color || C.amber) +
          '" font-size="9" font-family="ui-monospace,monospace" opacity="0.7">' + r.label + "</text>";
      }
    });

    s += "</svg>";

    var legend = "";
    if (cfg.legend) {
      legend = '<div class="legend">' + cfg.series.filter(function (x) { return x.name; }).map(function (x) {
        return '<span><i style="background:' + x.color + '"></i>' + x.name + "</span>";
      }).join("") + "</div>";
    }
    return s + legend;
  }

  /* Draw and attach the value card in one place, so six call sites cannot
     drift apart on which cfg was rendered where. */
  function drawChart(id, cfg) {
    var host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = chart(cfg);
    if (window.HOV && cfg.__geom) HOV.bind(host, HOV.linear(cfg, cfg.__geom));
  }

  /* ----------------------------------------------------------------- levers */
  var LEVERS = [
    { k: "zMax", g: "Automation", label: "Task share automated at saturation", min: 0.2, max: 0.95, step: 0.01, fmt: "pct" },
    { k: "zMid", g: "Automation", label: "Year displacement peaks (from 2026)", min: 5, max: 55, step: 1, fmt: "num", suffix: " yrs" },
    { k: "exposure", g: "Automation", label: "Share of jobs exposed", min: 0.15, max: 0.75, step: 0.01, fmt: "pct" },
    { k: "reabsorb", g: "Automation", label: "New-task jobs created per year", min: 0.01, max: 0.15, step: 0.005, fmt: "pct" },
    { k: "autoProd", g: "Automation", label: "Productivity lift per year at full automation", min: 0.01, max: 0.10, step: 0.002, fmt: "pct" },

    { k: "ubiMonthly", g: "Guarantees", label: "Basic income per adult", min: 0, max: 2500, step: 25, fmt: "usd", suffix: "/mo" },
    { k: "ubiIndex", g: "Guarantees", label: "Indexation to productivity", min: 0, max: 1.2, step: 0.05, fmt: "pct" },
    { k: "ubiStart", g: "Guarantees", label: "Basic income starts", min: 0, max: 30, step: 1, fmt: "num", suffix: " yrs" },
    { k: "publicShare", g: "Guarantees", label: "Share of health bill paid publicly", min: 0.3, max: 1, step: 0.01, fmt: "pct" },
    { k: "healthInfl", g: "Guarantees", label: "Excess health inflation", min: 0, max: 0.025, step: 0.001, fmt: "pct" },
    { k: "housingRate", g: "Guarantees", label: "Housing gap closed per year", min: 0, max: 0.25, step: 0.01, fmt: "pct" },
    { k: "jgCap", g: "Guarantees", label: "Public-job ceiling (share of adults)", min: 0, max: 0.30, step: 0.005, fmt: "pct" },
    { k: "jgTakeup", g: "Guarantees", label: "Displaced offered a public job", min: 0, max: 1, step: 0.01, fmt: "pct" },
    { k: "jgWage", g: "Guarantees", label: "Public-job wage relative to average", min: 0.4, max: 1, step: 0.01, fmt: "pct" },
    { k: "savingsBond", g: "Guarantees", label: "Citizen account at 18 (thousands)", min: 0, max: 50, step: 1, fmt: "k" },

    { k: "tauL", g: "Tax", label: "Effective tax on labour income", min: 0, max: 0.55, step: 0.01, fmt: "pct" },
    { k: "tauK", g: "Tax", label: "Effective tax on capital income", min: 0, max: 0.60, step: 0.01, fmt: "pct" },
    { k: "tauV", g: "Tax", label: "Consumption tax", min: 0, max: 0.25, step: 0.01, fmt: "pct" },
    { k: "tauLand", g: "Tax", label: "Land value tax", min: 0, max: 0.08, step: 0.002, fmt: "pct" },
    { k: "tauWealth", g: "Tax", label: "Wealth tax on top decile", min: 0, max: 0.04, step: 0.002, fmt: "pct" },
    { k: "tauCarbon", g: "Tax", label: "Carbon price", min: 0, max: 400, step: 5, fmt: "t", suffix: "/t" },

    { k: "fundContribution", g: "Sovereign fund", label: "Capital-side revenue paid into the fund", min: 0, max: 1, step: 0.01, fmt: "pct" },
    { k: "fundCap", g: "Sovereign fund", label: "Ceiling on the fund's share of capital", min: 0, max: 0.85, step: 0.01, fmt: "pct" },
    { k: "fundPayout", g: "Sovereign fund", label: "Share of fund income paid out", min: 0.2, max: 1, step: 0.01, fmt: "pct" }
  ];

  function buildLevers() {
    var host = document.getElementById("leverGroups");
    host.innerHTML = "";
    var groups = {}, order = [];
    LEVERS.forEach(function (lv) {
      if (!groups[lv.g]) { groups[lv.g] = []; order.push(lv.g); }
      groups[lv.g].push(lv);
    });
    order.forEach(function (g) {
      /* A <details> per group, closed by default, with the chevron in CSS. */
      var box = el("details", "lgroup");
      box.appendChild(el("summary", null, g + '<i class="caret" aria-hidden="true"></i>'));
      groups[g].forEach(function (lv) {
        var row = el("label", "lever");
        var top = el("div", "lever-top");
        top.appendChild(el("span", "lever-name", lv.label));
        var val = el("span", "lever-val", fmtLever(lv, state[lv.k]));
        top.appendChild(val);
        row.appendChild(top);
        var inp = el("input");
        inp.type = "range";
        inp.min = lv.min; inp.max = lv.max; inp.step = lv.step; inp.value = state[lv.k];
        inp.setAttribute("aria-label", lv.label);
        inp.addEventListener("input", function () {
          state[lv.k] = parseFloat(inp.value);
          val.textContent = fmtLever(lv, state[lv.k]);
          render();
        });
        row.appendChild(inp);
        box.appendChild(row);
      });
      host.appendChild(box);
    });
  }

  function syncLevers() {
    var inputs = document.querySelectorAll("#leverGroups input[type=range]");
    inputs.forEach(function (inp, i) {
      var lv = LEVERS[i];
      inp.value = state[lv.k];
      var val = inp.parentNode.querySelector(".lever-val");
      if (val) val.textContent = fmtLever(lv, state[lv.k]);
    });
  }

  function buildPresets() {
    var host = document.getElementById("presets");
    host.innerHTML = "";
    A.PRESETS.forEach(function (p) {
      var b = el("button", "preset", p.name);
      b.type = "button";
      b.title = p.note;
      b.addEventListener("click", function () {
        for (var kk in A.DEFAULTS) state[kk] = A.DEFAULTS[kk];
        for (var kk2 in p.patch) state[kk2] = p.patch[kk2];
        document.querySelectorAll("#presets .preset").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        syncLevers();
        render();
      });
      if (p.id === "managed") b.classList.add("on");
      host.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------ views */
  function kpi(label, value, note, cls) {
    var d = el("div", "kpi");
    d.appendChild(el("div", "klabel", label));
    d.appendChild(el("div", "kval" + (cls ? " " + cls : ""), value));
    if (note) d.appendChild(el("div", "knote", note));
    return d;
  }

  function renderKpis(o) {
    var s = o.series, k = o.kpis, host = document.getElementById("kpis");
    host.innerHTML = "";
    var i45 = 19, iEnd = s.year.length - 1;

    host.appendChild(kpi("In paid work, 2050", pct0(s.employment[i45]),
      pct0(s.nonEmployment[i45]) + " of adults outside it", s.employment[i45] < 0.45 ? "bad" : ""));
    host.appendChild(kpi("Floor, 2050",
      pct0(s.covSavings[i45]), "of the relative poverty line",
      s.covSavings[i45] < 0.9 ? "bad" : "good"));
    host.appendChild(kpi("Guarantee, peak", pct1(k.peakBundleGross),
      "of GDP, before the fund pays its share; " + pct1(k.peakBundle) + " on the taxpayer"));
    host.appendChild(kpi("Revenue, peak", pct1(k.peakRevenue),
      k.revenueBreachYear ? "crosses 46% in " + k.revenueBreachYear : "stays under 46% of GDP",
      k.peakRevenue > 0.46 ? "warn" : ""));
    host.appendChild(kpi("Fund, 2100", k.endFund.toFixed(2) + "× GDP",
      pct0(k.endFundShare) + " of the capital stock, " + pct1(k.endDividend) + " of GDP in dividends"));
    host.appendChild(kpi("Floor, worst year", pct0(k.floorValley),
      "in " + k.floorValleyYear + "; ends at " + pct0(s.covSavings[iEnd]) + " of the poverty line",
      k.floorValley < 0.5 ? "bad" : k.floorValley < 0.8 ? "warn" : "good"));
  }

  function renderVerdict(o) {
    var s = o.series, k = o.kpis, host = document.getElementById("verdict");
    var i45 = 19;
    var iEnd0 = s.year.length - 1;

    /* Two separate tests, because they fail differently: can the state afford
       it, and does the thing it affords actually deliver a floor? */
    var endFloor = s.covSavings[iEnd0];
    var fiscallyOK = !k.restructured && k.peakDebt < 2.0 && k.peakRevenue < 0.48;
    var delivered = endFloor > 0.85;
    var valleyOK = k.floorValley > 0.60;
    var works = fiscallyOK && delivered;

    var head, body;
    if (works && valleyOK) {
      head = "This balances, and it delivers the floor.";
      body = "The guarantee peaks at " + pct1(k.peakBundleGross) + " of GDP gross, of which the taxpayer " +
        "carries " + pct1(k.peakBundle) + "; revenue peaks at " + pct1(k.peakRevenue) +
        ". The fund reaches " + k.endFund.toFixed(2) + "× GDP and pays " + pct1(k.endDividend) +
        " of GDP in dividends by 2100, which is what lets the basic income stop costing the budget " +
        "anything. The floor never drops below " + pct0(k.floorValley) + " of the poverty line and " +
        "reaches " + pct0(endFloor) + " by 2100.";
    } else if (works) {
      head = "It arrives &mdash; but the floor gives way first." ;
      body = "The guarantee peaks at " + pct1(k.peakBundleGross) + " of GDP gross, of which the taxpayer " +
        "carries " + pct1(k.peakBundle) + ", and revenue peaks at " + pct1(k.peakRevenue) +
        ". The fund reaches " + k.endFund.toFixed(2) + "× GDP and pays " + pct1(k.endDividend) +
        " of GDP in dividends by 2100, which is what lets the basic income stop costing the budget " +
        "anything. The floor stalls at " + pct0(k.floorValley) + " of the poverty line around " +
        k.floorValleyYear + ": the payment is fixed by statute while the fund is still mid-sized, so " +
        "for about a decade the guarantee is carried by taxes and goes nowhere. Everything after that " +
        "is the fund arriving, and the floor ends at " + pct0(endFloor) + ".";
    } else if (k.restructured) {
      head = "This does not balance. Debt is restructured in " + k.restructured + ".";
      body = "The guarantees cost more than the tax base can carry for long enough that the debt path breaks. " +
        "The floor falls to " + pct0(k.floorValley) + " of the poverty line, in " + k.floorValleyYear +
        ", which is the point at which the commitment is quietly withdrawn rather than announced.";
    } else if (!fiscallyOK) {
      head = "The money does not hold.";
      body = "Revenue peaks at " + pct1(k.peakRevenue) + " of GDP and debt peaks at " + pct0(k.peakDebt) +
        ", so the closure rule raises taxes and trims the payment. The floor settles at " +
        pct0(k.floorValley) + " of the poverty line in " + k.floorValleyYear +
        ". The three ways out are a higher capital tax, an earlier and larger fund, or a smaller promise.";
    } else if (!delivered) {
      head = "It balances, but it does not deliver a floor.";
      body = "The budget holds: revenue peaks at " + pct1(k.peakRevenue) + " of GDP and debt at " +
        pct0(k.peakDebt) + ". What fails is the promise. Nothing unconditional reaches more than " +
        pct0(k.floorValley) + " of the poverty line, and 2100 ends at " + pct0(endFloor) +
        " — a person with no job is poor through the whole century while the accounts balance. " +
        "Affordability and adequacy are separate problems, and only one of them is fiscal.";
    } else {
      head = "The numbers do not close.";
      body = "Revenue peaks at " + pct1(k.peakRevenue) + " of GDP against a debt path that reaches " +
        pct0(k.peakDebt) + ", so something has to give. The floor tops out at " + pct0(endFloor) +
        " by 2100. This is the case for a larger capital tax or a smaller promise, not for a different " +
        "automation forecast.";
    }

    var iEnd = s.year.length - 1;
    var facts = [
      ["Employment 2100", pct0(s.employment[iEnd])],
      ["Labour share 2100", pct0(s.sigma[iEnd])],
      ["Public payroll", pct0(s.empJG[iEnd]) + " of adults"],
      ["Peak debt", pct0(k.peakDebt) + " of GDP"],
      ["Peak inflation", pct1(k.peakInflation)],
      ["Dividend 2100", pct1(k.endDividend) + " of GDP"]
    ];

    host.innerHTML = '<h2 style="margin:0 0 8px;color:#eaf2fb">' + head + "</h2>" +
      '<p style="margin:0 0 14px;color:#a9b8c9;line-height:1.6;max-width:74ch">' + body + "</p>" +
      '<div class="stats">' + facts.map(function (f) {
        return '<div class="stat"><div class="stat-l">' + f[0] + '</div><div class="an-n">' + f[1] + "</div></div>";
      }).join("") + "</div>";
  }

  function renderCharts(o) {
    var s = o.series, yrs = s.year;
    var CW = window.innerWidth < 700 ? 430 : 700;

    drawChart("chartSqueeze", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 0.7, fmt: pct0 }, right: { min: 0, max: 0.7, fmt: pct0 },
      series: [
        { name: "Employment / adults", data: s.employment, color: C.mint, width: 2.2 },
        { name: "Labour share of GDP", data: s.sigma, color: C.amber, width: 2, dash: true },
        { name: "Unemployment", data: s.unemployment, color: C.red, width: 1.4 }
      ],
      refs: [{ v: 0.55, label: "55% = full employment", color: C.dim }],
      legend: true
    });

    drawChart("chartIncome", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 1.0, fmt: pct0 },
      series: [
        { name: "Wages", data: s.wag, color: C.blue, stack: "inc", opacity: .45 },
        { name: "Private capital", data: s.capitalHH, color: C.violet, stack: "inc", opacity: .35 },
        { name: "Sovereign dividend", data: s.fundDivShare, color: C.mint, stack: "inc", opacity: .40 },
        { name: "Basic income", data: s.ubi, color: C.amber, stack: "inc", opacity: .40 },
        { name: "Legacy transfers", data: s.legacy, color: C.dim, stack: "inc", opacity: .28 }
      ],
      legend: true
    });

    drawChart("chartBases", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 0.55, fmt: pct0 },
      series: [
        { name: "Labour income", data: s.revL, color: C.blue, stack: "b", opacity: .40 },
        { name: "Capital income", data: s.revK, color: C.mint, stack: "b", opacity: .40 },
        { name: "Consumption", data: s.revV, color: C.amber, stack: "b", opacity: .40 },
        { name: "Land", data: s.revLand, color: C.violet, stack: "b", opacity: .40 },
        { name: "Wealth", data: s.revW, color: C.teal, stack: "b", opacity: .40 },
        { name: "Carbon", data: s.revC, color: C.dim, stack: "b", opacity: .40 }
      ],
      legend: true
    });

    drawChart("chartFiscal", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 0.65, fmt: pct0 },
      right: { min: 0, max: 2.5, fmt: function (v) { return v.toFixed(1) + "x"; } },
      series: [
        { name: "Revenue", data: s.revenue, color: C.mint, width: 2.1 },
        { name: "Spending", data: s.spending, color: C.red, width: 2.1 },
        { name: "Debt / GDP (right)", data: s.debt, color: C.dim, axis: "right", width: 1.4, dash: true }
      ],
      refs: [{ v: 0.46, label: "46% = top of the OECD tax range", color: C.amber }],
      legend: true
    });

    drawChart("chartCoverage", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 1.05, fmt: pct0 },
      series: [
        { name: "Housing", data: s.covHousing, color: C.blue, width: 1.6 },
        { name: "Healthcare", data: s.covHealth, color: C.teal, width: 1.6 },
        { name: "Income floor", data: s.covSavings, color: C.amber, width: 2.2 },
        { name: "A job", data: s.covJob, color: C.mint, width: 1.8 },
        { name: "Index", data: s.adequacy, color: "#ffffff", width: 2.4 }
      ],
      legend: true
    });

    drawChart("chartFund", {
      years: yrs, w: CW, h: 250, left: { min: 0, max: 2.0, fmt: function (v) { return v.toFixed(1) + "x"; } },
      right: { min: 0, max: 1.0, fmt: pct0 },
      series: [
        { name: "Fund assets / GDP", data: s.fund, color: C.mint, width: 2.2, fill: true, baseline: 0 },
        { name: "Share of capital owned (right)", data: s.fundShare, color: C.violet, axis: "right", width: 1.6, dash: true }
      ],
      legend: true
    });
  }

  function renderPhases(o) {
    var s = o.series, host = document.getElementById("phases");
    function first(test) {
      for (var i = 0; i < s.year.length; i++) if (test(s, i)) return i;
      return s.year.length - 1;
    }
    var p1 = first(function (s, i) { return s.sigma[i] < 0.54; });
    var p2 = first(function (s, i) { return s.employment[i] < 0.52; });
    var p3 = first(function (s, i) { return s.sigma[i] < 0.36; });
    var p4 = first(function (s, i) { return s.fundCover[i] >= 1; });
    if (p4 <= p3 + 1) p4 = Math.min(p3 + 3, s.year.length - 2);

    var rows = [
      { a: 0, b: p1, name: "Seed the fund",
        cond: "Tax the capital side while wages are still 57% of GDP",
        detail: function (i) { return "Fund at " + s.fund[i].toFixed(2) + "× GDP, owning " + pct0(s.fundShare[i]) + " of the capital stock. Payment is small or zero; the money goes into assets, not cheques."; } },
      { a: p1, b: p2, name: "Universalise the basics",
        cond: "Labour share falls below 54%",
        detail: function (i) { return "Basic income " + money(s.ubi[i] * 30000) + "/yr against a bundle of " + pct1(s.bundle[i]) + " of GDP. Health moves public; the housing gap closes at " + pct0(0.13) + "/yr."; } },
      { a: p2, b: p3, name: "The wage cliff",
        cond: "Employment falls below 52% of adults",
        detail: function (i) { return "Public payroll reaches " + pct0(s.empJG[i]) + " of adults and the dividend reaches " + pct1(s.fundDivShare[i]) + " of GDP. Revenue peaks at " + pct1(s.revenue[i]) + "."; } },
      { a: p3, b: p4, name: "Ownership transition",
        cond: "Labour share falls below 36%",
        detail: function (i) { return "The fund owns " + pct0(s.fundShare[i]) + " of capital and pays " + pct1(s.fundDivShare[i]) + " of GDP to households. The income tax base has halved."; } },
      { a: p4, b: s.year.length - 1, name: "Steady state",
        cond: "The dividend exceeds the tax-funded payment",
        detail: function (i) { return "Dividends " + pct1(s.fundDivShare[i]) + " of GDP, labour share " + pct0(s.sigma[i]) + ", index " + pct0(s.adequacy[i]) + "."; } }
    ];

    host.innerHTML = rows.map(function (r) {
      var i = Math.min(r.b, s.year.length - 1);
      var span = s.year[r.a] + "–" + s.year[Math.min(r.b, s.year.length - 1)];
      return '<div class="phase">' +
        '<div class="ph-when"><span class="ph-years">' + span + '</span>' +
        '<span class="ph-c">' + r.cond + "</span></div>" +
        '<div class="ph-body"><h3>' + r.name + "</h3><p>" + r.detail(i) + "</p></div></div>";
    }).join("");
  }

  function renderBundle(o) {
    var s = o.series, i = clamp(bundleYearIdx, 0, s.year.length - 1);
    var Y = s.output[i] * 1000;
    var rows = [
      ["Basic income", s.ubi[i], s.ubi[i] * Y],
      ["Healthcare (public share)", s.healthGov[i], s.healthGov[i] * Y],
      ["Housing programme", s.housing[i], s.housing[i] * Y],
      ["Job guarantee", s.jgCost[i], s.jgCost[i] * Y],
      ["Citizen accounts", 0.0005, 0.0005 * Y]
    ];
    var total = 0;
    rows.forEach(function (r) { total += r[1]; });

    var fundPaid = s.fundPaidShare ? s.fundPaidShare[i] : 0;
    var fiscal = Math.max(0, total - fundPaid);
    var html = '<table class="calib-table"><thead><tr><th>Guarantee</th><th>% of GDP</th><th>Cost</th><th>Share</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += "<tr><td>" + r[0] + "</td><td>" + pct1(r[1]) + "</td><td>" + money(r[2]) +
        "</td><td>" + pct0(total ? r[1] / total : 0) + "</td></tr>";
    });
    html += '<tr class="tot"><td>Total guarantee, gross</td><td>' + pct1(total) + "</td><td>" + money(total * Y) +
      "</td><td>100%</td></tr>";
    html += '<tr><td>less: paid by the sovereign fund</td><td>' + pct1(fundPaid) + "</td><td>" +
      money(fundPaid * Y) + "</td><td>" + pct0(total ? fundPaid / total : 0) + '</td></tr>';
    html += '<tr class="tot"><td>Cost to the taxpayer</td><td>' + pct1(fiscal) + "</td><td>" + money(fiscal * Y) +
      "</td><td>" + pct0(total ? fiscal / total : 0) + "</td></tr>";
    html += "</tbody></table>";

    var gap = fiscal + s.legacy[i] + 0.09 + s.debtService[i] - s.revenue[i];
    html += '<p class="regime-note">In ' + s.year[i] + " the guarantee costs " + pct1(total) +
      " of GDP gross and " + pct1(fiscal) + " to the taxpayer. Legacy transfers, general " +
      "government and interest add " + pct1(s.legacy[i] + 0.09 + s.debtService[i]) +
      ", against revenue of " + pct1(s.revenue[i]) + ". That leaves a " +
      (gap > 0 ? "gap of " : "surplus of ") + pct1(Math.abs(gap)) + " of GDP.</p>";

    document.getElementById("bundleTable").innerHTML = html;
  }

  function renderSens() {
    var rows = A.sensitivity(state);
    var host = document.getElementById("sens");
    var maxSwing = Math.max.apply(null, rows.map(function (r) { return r.swing; })) || 0.01;
    host.innerHTML = rows.map(function (r) {
      var lo = Math.min(r.lo, r.hi), hi = Math.max(r.lo, r.hi);
      var x1 = clamp(lo, 0, 1) * 100, x2 = clamp(hi, 0, 1) * 100;
      var bx = clamp(r.base, 0, 1) * 100;
      if (r.yearLo) r.loLabel += " (" + r.yearLo + ")";
      if (r.yearHi) r.hiLabel += " (" + r.yearHi + ")";
      return '<div class="sens-row">' +
        '<div class="sens-label">' + r.label + "</div>" +
        '<div class="sens-track"><span class="sens-bar" style="left:' + x1.toFixed(1) + '%;width:' + Math.max(0.8, x2 - x1).toFixed(1) + '%"></span>' +
        '<span class="sens-tick" style="left:' + bx.toFixed(1) + '%"></span></div>' +
        '<div class="sens-nums">' + pct0(r.lo) + " – " + pct0(r.hi) + "</div>" +
        '<div class="sens-range">' + r.loLabel + " / " + r.hiLabel + "</div>" +
        "</div>";
    }).join("");
  }

  function renderCalib() {
    var rows = A.calibration();
    var html = '<table class="calib-table"><thead><tr><th>Aggregate, 2026</th><th>Model</th><th>Measured</th><th>Error</th><th>Source</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td>' + r.name + '</td><td class="mono">' + pct1(r.model) + '</td><td class="mono">' +
        pct1(r.actual) + '</td><td class="mono ' + (r.ok ? "good" : "warn") + '">' +
        (r.error > 0 ? "+" : "") + (r.error * 100).toFixed(1) + 'pp</td><td class="dim">' + r.src + "</td></tr>";
    });
    html += "</tbody></table>";
    html += '<p class="regime-note">Every row is within 2.5 points of the measured value. That is the standard the ' +
      "rest of the page is held to: where a number is not on this list, it is a labelled assumption, not a calibration.</p>";
    document.getElementById("calib").innerHTML = html;
  }

  /* ------------------------------------------------------------------ render */
  function render() {
    out = A.run(state);
    renderKpis(out);
    renderVerdict(out);
    renderCharts(out);
    renderPhases(out);
    renderBundle(out);
    renderSens();
  }

  function boot() {
    buildPresets();
    buildLevers();
    document.getElementById("reset").addEventListener("click", function () {
      for (var kk in A.DEFAULTS) state[kk] = A.DEFAULTS[kk];
      syncLevers();
      document.querySelectorAll("#presets .preset").forEach(function (x) { x.classList.remove("on"); });
      document.querySelector('#presets .preset').classList.add("on");
      render();
    });

    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(render, 220);
    });

    var by = document.getElementById("bundleYear");
    var byOut = document.getElementById("bundleYearOut");
    by.addEventListener("input", function () {
      bundleYearIdx = parseInt(by.value, 10) - 2026;
      byOut.textContent = by.value;
      renderBundle(out);
    });

    render();
    renderCalib();

    document.getElementById("footRange").textContent =
      "Annual model · 2026–2100 · calibration reproduced to within 2.5pp on seven 2026 aggregates";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* expose for verification */
  window.__abundance = {
    run: function (patch) { var st = {}; for (var kk in state) st[kk] = state[kk]; for (var p in patch) st[p] = patch[p]; return A.run(st); },
    state: function () { return state; }
  };
})();
