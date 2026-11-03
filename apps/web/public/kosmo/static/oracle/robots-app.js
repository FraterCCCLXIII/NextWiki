/* Rendering for the robots page: levers, charts, milestones, checks. */
(function () {
  var D = window.ROBOTS_DATA;
  var M = window.ROBOTS;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373",
    red: "#c28181", violet: "#a396b3", dim: "#7e8d9e", line: "#232528"
  };

  var state = M.defaults();
  var readYear = 2100;
  var clipSeq = 0;
  var READ_YEARS = [2050, 2075, 2100];

  /* ---------------------------------------------------------------- helpers */
  function el(t, cls, html) { var d = document.createElement(t); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function nf(x, d) { return x == null || !isFinite(x) ? "—" : Number(x).toFixed(d === undefined ? 0 : d); }
  function pct(x, d) { return x == null || !isFinite(x) ? "—" : (x * 100).toFixed(d === undefined ? 0 : d) + "%"; }
  function millions(x) {
    if (x == null) return "—";
    if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + "M";
    if (x >= 1e3) return (x / 1e3).toFixed(0) + "k";
    return nf(x, 0);
  }
  function money(x) {
    if (x == null) return "—";
    if (x >= 1000) return "$" + (x / 1000).toFixed(x >= 10000 ? 0 : 1) + "k";
    return "$" + nf(x, 0);
  }
  function fmtLever(lv, v) {
    switch (lv.fmt) {
      case "usd": return money(v);
      case "pct": return (v * 100).toFixed(lv.step < 0.01 ? 1 : 0) + "%";
      case "yr": return Math.round(v) + " yr";
      case "fte": return nf(v, 1) + " FTE";
      case "per1000": return Math.round(v) + " / 1,000";
      case "x": return Math.round(v) + "×";
      default: return String(v);
    }
  }

  /* ------------------------------------------------------------------ chart */
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
  function logTicks(min, max) {
    var out = [];
    var decades = Math.log10(max) - Math.log10(min);
    /* Over a span this wide (eight decades of robots) every 2 and 5 would give
       thirty labels, so only the powers of ten are kept. */
    var mults = decades > 4 ? [1] : [1, 2, 5];
    for (var e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
      mults.forEach(function (k) {
        var v = k * Math.pow(10, e);
        if (v >= min * 0.999 && v <= max * 1.001) out.push(v);
      });
    }
    return out;
  }

  function chart(cfg) {
    var W = cfg.w || 700, H = cfg.h || 250;
    var m = { l: 54, r: cfg.right ? 56 : 16, t: 18, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    /* geometry for hover.js: the plot rect and the viewBox, not pixels */
    cfg.__geom = { W: W, H: H, m: m, iw: iw, ih: ih };
    var yrs = cfg.years;
    var xMin = yrs[0], xMax = yrs[yrs.length - 1];
    function X(v) { return m.l + (v - xMin) / (xMax - xMin) * iw; }

    function scale(a) {
      if (a.log) {
        var lo = Math.log10(a.min), hi = Math.log10(a.max);
        return function (v) { return m.t + (1 - (Math.log10(Math.max(v, a.min * 0.4)) - lo) / (hi - lo)) * ih; };
      }
      return function (v) { return m.t + (1 - (v - a.min) / (a.max - a.min)) * ih; };
    }
    var YL = scale(cfg.left), YR = cfg.right ? scale(cfg.right) : null;
    function Y(v, which) { return which === "right" && YR ? YR(v) : YL(v); }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';

    /* frame */
    s += '<rect x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="none" stroke="' + C.line + '" stroke-width="1"/>';

    var ticks = cfg.left.log ? logTicks(cfg.left.min, cfg.left.max) : niceTicks(cfg.left.min, cfg.left.max, 4);
    ticks.forEach(function (v) {
      var y = YL(v);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + C.line + '" stroke-width="1" stroke-dasharray="2 4"/>';
      s += '<text x="' + (m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + cfg.left.fmt(v) + "</text>";
    });

    if (cfg.right) {
      var rt = cfg.right.log ? logTicks(cfg.right.min, cfg.right.max) : niceTicks(cfg.right.min, cfg.right.max, 4);
      rt.forEach(function (v) {
        var y = YR(v);
        s += '<text x="' + (W - m.r + 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="start" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + cfg.right.fmt(v) + "</text>";
      });
    }

    var lastX = -1e9;
    yrs.forEach(function (yr) {
      if (yr % 20 !== 0) return;
      var px = X(yr);
      if (px - lastX < 42) return;
      lastX = px;
      s += '<text x="' + px.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + yr + "</text>";
    });

    /* Everything inside the plot is clipped to the plot. The stylesheet sets
       `overflow: visible` on chart SVGs, so an out-of-range value does not just
       touch the frame — it draws across the card above. */
    var clipId = "rc" + (++clipSeq);
    var body = "";

    /* Stacked areas.

       Each layer accumulates onto the running total of every layer beneath it,
       not onto the immediately preceding one — otherwise a three-layer stack
       doubles up and the top band ends at 155% of a 100% axis. Null means "no
       data", which contributes nothing and does not interrupt the stack. */
    var cum = yrs.map(function () { return 0; });
    (cfg.stack || []).forEach(function (se) {
      var lower = cum.slice();
      var upper = cum.map(function (v, i) {
        var d = se.data[i];
        return d == null ? v : v + d;
      });
      cum = upper;

      var start = -1, end = -1;
      for (var i = 0; i < yrs.length; i++) {
        if (se.data[i] != null) { if (start < 0) start = i; end = i; }
      }
      if (start < 0) return;

      var d2 = "M" + X(yrs[start]).toFixed(1) + " " + YL(upper[start]).toFixed(1);
      for (i = start + 1; i <= end; i++) d2 += "L" + X(yrs[i]).toFixed(1) + " " + YL(upper[i]).toFixed(1);
      for (i = end; i >= start; i--) d2 += "L" + X(yrs[i]).toFixed(1) + " " + YL(lower[i]).toFixed(1);
      d2 += "Z";
      body += '<path d="' + d2 + '" fill="' + se.color + '" opacity="' + (se.opacity || 0.5) + '"/>';
    });

    /* lines */
    (cfg.series || []).forEach(function (se) {
      var d = "", started = false;
      /* a series may carry only dots (the humanoid price points) */
      (se.data || []).forEach(function (v, i) {
        if (v == null || !isFinite(v)) { started = false; return; }
        d += (started ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v, se.axis).toFixed(1);
        started = true;
      });
      if (d) body += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 1.9) + '"' + (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
      (se.dots || []).forEach(function (pt) {
        body += '<circle cx="' + X(pt[0]).toFixed(1) + '" cy="' + Y(pt[1], se.axis).toFixed(1) + '" r="2.8" fill="' + se.color + '"/>';
      });
    });

    /* reference lines */
    (cfg.refs || []).forEach(function (r) {
      var y = Y(r.v, r.axis);
      body += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + (r.color || C.amber) + '" stroke-width="1" stroke-dasharray="5 4" opacity="0.5"/>';
      if (r.label) body += '<text x="' + (W - m.r - 4) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="end" fill="' + (r.color || C.amber) + '" font-size="9" font-family="ui-monospace,monospace" opacity="0.8">' + r.label + "</text>";
    });

    /* the measured / computed seam */
    if (cfg.divider) {
      var dx = X(cfg.divider);
      body += '<line x1="' + dx.toFixed(1) + '" x2="' + dx.toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="#8a97a6" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>';
    }

    /* milestone markers */
    (cfg.marks || []).forEach(function (mk) {
      var mx = X(mk.year);
      if (mx < m.l || mx > W - m.r) return;
      body += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + (m.t + ih - 9) + '" y2="' + (m.t + ih) + '" stroke="#6f7b88" stroke-width="1"/>';
    });

    s += '<defs><clipPath id="' + clipId + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '"/></clipPath></defs>';
    s += '<g clip-path="url(#' + clipId + ')">' + body + "</g></svg>";

    var legend = "";
    if (cfg.legend) {
      var items = (cfg.stack || []).concat(cfg.series || []);
      legend = '<div class="legend">' + items.filter(function (x) { return x.name; }).map(function (x) {
        return '<span><i style="background:' + x.color + '"></i>' + x.name + "</span>";
      }).join("") + "</div>";
    }
    return s + legend;
  }

  function draw(id, cfg) {
    var host = document.getElementById(id);
    if (!host) return;
    cfg.w = 700;
    host.innerHTML = chart(cfg);
    if (window.HOV && cfg.__geom) HOV.bind(host, HOV.linear(cfg, cfg.__geom));
  }

  /* ----------------------------------------------------------------- levers */
  function buildLevers() {
    var host = document.getElementById("leverGroups");
    host.innerHTML = "";
    M.GROUPS.forEach(function (g) {
      /* A <details> per group, closed by default, with the chevron in CSS. */
      var box = el("details", "lgroup");
      box.appendChild(el("summary", null, g + '<i class="caret" aria-hidden="true"></i>'));
      M.LEVERS.filter(function (l) { return l.group === g; }).forEach(function (lv) {
        var row = el("label", "lever");
        row.title = lv.note;
        var top = el("div", "lever-top");
        top.appendChild(el("span", "lever-name", lv.label));
        var val = el("span", "lever-val", fmtLever(lv, state[lv.key]));
        top.appendChild(val);
        row.appendChild(top);
        var inp = el("input");
        inp.type = "range"; inp.min = lv.min; inp.max = lv.max; inp.step = lv.step; inp.value = state[lv.key];
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
    var boxes = document.querySelectorAll("#leverGroups .lever");
    var i = 0;
    M.GROUPS.forEach(function (g) {
      M.LEVERS.filter(function (l) { return l.group === g; }).forEach(function (lv) {
        var row = boxes[i++];
        if (!row) return;
        var inp = row.querySelector("input");
        inp.value = state[lv.key];
        row.querySelector(".lever-val").textContent = fmtLever(lv, state[lv.key]);
      });
    });
  }

  function buildPresets() {
    var host = document.getElementById("presets");
    host.innerHTML = "";
    Object.keys(M.PRESETS).forEach(function (name) {
      var b = el("button", "preset", name);
      b.type = "button";
      b.addEventListener("click", function () {
        state = M.defaults();
        Object.keys(M.PRESETS[name]).forEach(function (k) { state[k] = M.PRESETS[name][k]; });
        document.querySelectorAll("#presets .preset").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        syncLevers();
        schedule();
      });
      host.appendChild(b);
    });
  }

  function buildReadYear() {
    var host = document.getElementById("horizon");
    host.innerHTML = "";
    READ_YEARS.forEach(function (y) {
      var b = el("button", "hbtn" + (y === readYear ? " active" : ""), String(y));
      b.type = "button";
      b.addEventListener("click", function () {
        readYear = y;
        document.querySelectorAll("#horizon .hbtn").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        schedule();
      });
      host.appendChild(b);
    });
  }

  /* ------------------------------------------------------------------- kpis */
  function kpi(label, value, note, cls) {
    var d = el("div", "kpi");
    d.appendChild(el("div", "klabel", label));
    d.appendChild(el("div", "kval " + (cls || ""), value));
    d.appendChild(el("div", "knote", note));
    return d;
  }

  function renderKpis(r) {
    var i = r.years.indexOf(readYear);
    var i25 = r.years.indexOf(2025);
    var host = document.getElementById("kpis");
    host.innerHTML = "";

    host.appendChild(kpi("Robots in use, " + readYear, millions(r.stock[i]),
      (r.stock[i] / 1e6).toFixed(1) + "M units · " + Math.round(r.stock[i] / 3.5e6) + " per 1,000 workers", "neutral"));
    host.appendChild(kpi("Unit price", money(r.price[i]),
      "installed system " + money(r.price[i] * 2.5), "good"));
    var pb = r.payback[i];
    host.appendChild(kpi("Payback against a wage", pb == null ? "—" : pb < 1 ? Math.round(pb * 12) + " mo" : nf(pb, 1) + " yr",
      pb != null && pb < 1 ? "weeks of displaced wages &mdash; price is no longer the constraint" : "below ~3 yr, adoption stops being optional", "warn"));
    host.appendChild(kpi("Work done by machines", pct(r.displaced[i], 1),
      "was " + pct(r.displaced[i25], 1) + " in 2025", ""));
    host.appendChild(kpi("Labour's share of income", pct(r.labourShare[i], 1),
      "was " + pct(r.labourShare[i25], 1) + " in 2025", r.labourShare[i] < 0.45 ? "bad" : "warn"));
    host.appendChild(kpi("Top 1% share of wealth", pct(r.wealth[i][0], 1),
      "was " + pct(0.45) + " in 2025 · Gini " + nf(r.gini[i], 2), "bad"));
  }

  /* ---------------------------------------------------------------- verdict */
  function renderVerdict(r) {
    var i = r.years.indexOf(readYear);
    var i25 = r.years.indexOf(2025);
    var s = r.meta.state;
    var host = document.getElementById("verdict");

    var disp = r.displaced[i], share = r.labourShare[i];
    var w25 = 0.45, wNow = r.wealth[i][0];
    var capTop = r.capitalShare[i];

    var head = disp > 0.3 ? "The machines clear the work faster than the wage bill adjusts."
             : disp > 0.12 ? "The work is being displaced steadily, and the bill is falling with it."
             : "The work is barely displaced at all, and the distribution barely moves.";

    var body = "By " + readYear + " the model has " + millions(r.stock[i]) +
      " robots doing " + pct(disp, 1) + " of the work. Labour's share of income falls to " + pct(share, 1) +
      ", from " + pct(0.54, 1) + " today. The top 1% goes from " + pct(w25, 1) + " of net wealth to " + pct(wNow, 1) +
      ", holding " + pct(capTop, 1) + " of all capital income.";

    var own = s.redist > 0.3
      ? "Redistribution is doing work here: a " + pct(s.redist) + " dividend lifts the bottom 90% share of new capital income, but because dividends are spent rather than saved, it moves the income line far more than the wealth line. Ownership compounds; transfers do not."
      : "With no dividend, the income the machines produce accrues to whoever already owned the capital. That is the whole of the distributional story in one sentence: the robots are not the concentration, the ownership is.";

    var pbTxt = r.payback[i] == null ? "never" : r.payback[i] < 1 ? "about " + Math.round(r.payback[i] * 12) + " months" : r.payback[i].toFixed(1) + " years";
    var cost = "On cost, the machine pays back in " + pbTxt + " at " + money(r.price[i]) + " a unit, against the wage it displaces. The price stopped being the obstacle around 2025; the deployment lag is now the binding constraint, and that is a question about permits, liability and floor space rather than about engineering.";

    host.innerHTML =
      '<h2>' + head + "</h2>" +
      "<p>" + body + "</p>" +
      "<p>" + own + "</p>" +
      "<p>" + cost + "</p>";
  }

  /* ---------------------------------------------------------------- charts */
  function renderCharts(r) {
    var yrs = r.years;

    var marks = D.milestones.map(function (mk) { return { year: mk.year }; });

    /* The axis starts at one robot, because in 1961 there was exactly one. A
       floor in millions pinned the first thirty years to the baseline where
       the line was invisible. */
    draw("chartStock", {
      h: 300,
      years: yrs,
      left: { min: 1, max: 7e8, log: true, fmt: function (v) {
        if (v >= 1e6) return (v / 1e6).toFixed(0) + "M";
        if (v >= 1e3) return (v / 1e3).toFixed(0) + "k";
        return String(v);
      } },
      series: [{ name: "Robots in operation", color: C.mint, data: r.stock, width: 2 }],
      marks: marks,
      divider: 2025,
      legend: true
    });

    var humanoidDots = D.humanoid.map(function (p) { return [p[0], p[1]]; });
    draw("chartPrice", {
      h: 250,
      years: yrs,
      left: { min: 3000, max: 200000, log: true, fmt: function (v) { return v >= 1000 ? "$" + (v / 1000).toFixed(v < 10000 ? 1 : 0) + "k" : "$" + Math.round(v); } },
      series: [
        { name: "Industrial unit price", color: C.amber, data: r.price, width: 2 },
        { name: "Humanoids that shipped", color: C.violet, data: null, dots: humanoidDots }
      ],
      divider: 2025,
      legend: true
    });

    draw("chartPayback", {
      h: 250,
      years: yrs,
      left: { min: 0, max: 20, fmt: function (v) { return v.toFixed(0) + "y"; } },
      series: [{ name: "Payback", color: C.blue, data: r.payback, width: 2 }],
      refs: [
        { v: 3, label: "3-year threshold", color: C.red },
        { v: 1, label: "price stops mattering", color: C.dim }
      ],
      divider: 2025,
      legend: true
    });

    draw("chartLabour", {
      h: 250,
      years: yrs,
      left: { min: 0, max: 30, fmt: function (v) { return v.toFixed(0) + "%"; } },
      right: { min: 25, max: 60, fmt: function (v) { return v.toFixed(0) + "%"; } },
      series: [
        { name: "Work done by machines", color: C.red, data: r.displaced.map(function (v) { return v == null ? null : v * 100; }), width: 2 },
        { name: "Labour share of income", color: C.mint, data: r.labourShare.map(function (v) { return v == null ? null : v * 100; }), axis: "right", width: 2, dash: true }
      ],
      divider: 2025,
      legend: true
    });

    var incomeTotals = r.incTop.map(function (v, i) {
      return v == null ? null : v + r.incNext[i] + r.incRest[i];
    });
    var maxIncome = Math.max.apply(null, incomeTotals.filter(function (v) { return v != null; }));
    draw("chartIncome", {
      h: 250,
      years: yrs,
      left: { min: 0, max: Math.ceil(maxIncome / 50) * 50, fmt: function (v) { return "$" + v.toFixed(0) + "T"; } },
      stack: [
        { name: "Bottom 90%", color: C.blue, data: r.incRest, opacity: 0.35 },
        { name: "Next 9%", color: C.violet, data: r.incNext, opacity: 0.45 },
        { name: "Top 1%", color: C.amber, data: r.incTop, opacity: 0.55 }
      ],
      divider: 2025,
      legend: true
    });

    draw("chartWealth", {
      h: 250,
      years: yrs,
      left: { min: 0, max: 100, fmt: function (v) { return v.toFixed(0) + "%"; } },
      right: { min: 0.7, max: 1, fmt: function (v) { return v.toFixed(2); } },
      stack: [
        { name: "Bottom 90%", color: C.blue, data: r.wealth.map(function (w) { return w[2] * 100; }), opacity: 0.35 },
        { name: "Next 9%", color: C.violet, data: r.wealth.map(function (w) { return w[1] * 100; }), opacity: 0.4 },
        { name: "Top 1%", color: C.amber, data: r.wealth.map(function (w) { return w[0] * 100; }), opacity: 0.45 }
      ],
      series: [{ name: "Gini", color: C.mint, data: r.gini, axis: "right", width: 1.5, dash: true, hideLegend: false }],
      divider: 2025,
      legend: true
    });

    draw("chartMarkets", {
      h: 250,
      years: yrs,
      left: { min: 0, max: 620, fmt: function (v) { return v.toFixed(0); } },
      right: { min: 0, max: 0.3, fmt: function (v) { return v.toFixed(2) + "%"; } },
      series: [
        { name: "Equity index (2025 = 100)", color: C.mint, data: r.equity, width: 2 },
        { name: "Robot capex, % of GDP", color: C.amber, data: r.capex.map(function (v) { return v == null ? null : v * 100; }), axis: "right", width: 1.6, dash: true }
      ],
      divider: 2025,
      legend: true
    });
  }

  /* ------------------------------------------------------------- milestones */
  function renderMilestones() {
    var host = document.getElementById("milestones");
    host.innerHTML = D.milestones.map(function (mk) {
      return '<div class="tl-item' + (mk.proj ? " proj" : "") + '">' +
        '<div class="tl-year">' + mk.year + "</div>" +
        '<div class="tl-body"><h3>' + mk.title + "</h3><p>" + mk.note + "</p></div>" +
        "</div>";
    }).join("");
  }

  function renderAssumptions() {
    var host = document.getElementById("assumptions");
    var rows = D.assumptions.map(function (a) {
      var cls = a.conf === "measured" ? "ok" : a.conf === "derived" ? "derv" : "ass";
      return '<tr><td class="cname">' + a.label + "</td>" +
        '<td>' + a.value + "</td>" +
        '<td style="text-align:left;font-family:var(--sans);color:#b6c3d1">' + a.basis + "</td>" +
        '<td><span class="prov ' + cls + '">' + a.conf + "</span></td></tr>";
    }).join("");
    host.innerHTML = '<div class="calib-scroll"><table class="calib-table" style="min-width:0">' +
      "<thead><tr><th style='text-align:left'>Constant</th><th>Value</th><th style='text-align:left'>Basis</th><th>Provenance</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table></div>";
  }

  function renderChecks() {
    var host = document.getElementById("checkBody");
    var rows = D.checks.map(function (c) {
      var out, ok = true;
      try { out = c.test(D); } catch (e) { out = "error: " + e.message; ok = false; }
      if (/^(got|error)/i.test(String(out))) ok = false;
      return '<div class="check ' + (ok ? "ok" : "warn") + '">' +
        '<span class="cval">' + (ok ? "✓" : "!") + "</span>" +
        '<span class="clabel">' + c.name + "</span>" +
        '<span class="cdetail">' + out + "</span></div>";
    });
    host.innerHTML = '<div class="checks">' + rows.join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sourceBody");
    host.innerHTML = '<div class="srclist">' + D.sources.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener"><b>' + s.name + "</b><span>" + s.what + "</span></a>";
    }).join("") + "</div>";
  }

  /* ------------------------------------------------------------------ render */
  var pending = null;
  function schedule() {
    if (pending) clearTimeout(pending);
    pending = setTimeout(render, 70);
  }

  function render() {
    var r = M.run(state);
    renderKpis(r);
    renderVerdict(r);
    renderCharts(r);
    document.getElementById("hbarNote").textContent =
      r.meta.paybackYear <= 2025 ? "payback already under three years in 2025" : "payback crosses three years in " + r.meta.paybackYear;
    document.getElementById("footNote").textContent =
      "Adoption midpoint " + r.meta.mid + " · ceiling " + Math.round(state.ceiling) + " per 1,000 workers · " + millions(r.meta.target) + " robots at saturation";
  }

  /* ------------------------------------------------------------------ start */
  buildLevers();
  buildPresets();
  buildReadYear();
  renderMilestones();
  renderAssumptions();
  renderChecks();
  renderSources();
  render();

  document.getElementById("reset").addEventListener("click", function () {
    state = M.defaults();
    document.querySelectorAll("#presets .preset").forEach(function (x) { x.classList.remove("active"); });
    syncLevers();
    schedule();
  });
})();
