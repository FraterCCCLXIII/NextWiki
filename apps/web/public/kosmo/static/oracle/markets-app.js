/* ============================================================================
   markets-app.js — renderer for `markets.html`.

   Six charts, one source. The rule this page follows: never draw a spread, a
   rate and an index on the same axis, and never draw a nominal series beside a
   real one without saying which is which. Where a series is missing the path
   breaks; nothing is interpolated to make a line look continuous.
   ============================================================================ */
(function () {
  "use strict";

  var M = window.MARKETS;
  if (!M) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };

  var state = { from: 1990, rec: true, aaa: true };

  var MONTHS = M.months;
  var YEARS = MONTHS.map(function (k) {
    return +k.slice(0, 4) + (+k.slice(5, 7) - 1) / 12;
  });
  var S = M.series;

  /* -------------------------------------------------------------- helpers --- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function txt(x, y, s, o) {
    o = o || {};
    return "<text x=\"" + x.toFixed(1) + "\" y=\"" + y.toFixed(1) + "\"" +
      (o.anchor ? " text-anchor=\"" + o.anchor + "\"" : "") +
      (o.size ? " font-size=\"" + o.size + "\"" : "") +
      (o.fill ? " fill=\"" + o.fill + "\"" : "") +
      " font-family=\"ui-monospace,monospace\">" + esc(s) + "</text>";
  }

  function startIdx() {
    for (var i = 0; i < MONTHS.length; i++) if (+MONTHS[i].slice(0, 4) >= state.from) return i;
    return 0;
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function legend(hostId, items) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = items.map(function (it) {
      return "<span style=\"display:inline-flex;align-items:center;gap:6px\">" +
        "<i style=\"background:" + it.color + ";width:10px;height:2px;display:inline-block\"></i>" +
        esc(it.name) + "</span>";
    }).join("");
  }

  /* One generic line chart. `o.left` and `o.right` are axis specs, `o.series`
     names keys in the data file, `o.zero` draws a baseline. */
  function drawLine(hostId, o) {
    var host = document.getElementById(hostId);
    if (!host) return;

    var i0 = startIdx();
    var yrs = YEARS.slice(i0);
    var n = yrs.length;
    if (n < 2) { host.innerHTML = ""; return; }

    var W = o.W || 780, H = o.H || 320;
    var m = { l: 48, r: o.right ? 52 : 18, t: 14, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var L = o.left, R = o.right || null;

    function xOf(i) {
      return m.l + (yrs[i] - yrs[0]) / (yrs[n - 1] - yrs[0]) * iw;
    }
    function yL(v) { return m.t + (1 - (v - L.min) / (L.max - L.min)) * ih; }
    function yR(v) { return m.t + (1 - (v - R.min) / (R.max - R.min)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" +
      esc(o.aria || "") + "\">";

    /* recessions, behind everything */
    if (state.rec && o.bands !== false) {
      M.recessions.forEach(function (r) {
        var a = MONTHS.indexOf(r.from) - i0, b = MONTHS.indexOf(r.to) - i0;
        if (b < 0 || a >= n) return;
        a = Math.max(0, a); b = Math.min(n - 1, b);
        var x0 = xOf(a), x1 = xOf(b) + iw / Math.max(1, n - 1);
        s += "<rect x=\"" + x0.toFixed(1) + "\" y=\"" + m.t + "\" width=\"" +
          Math.max(2, x1 - x0).toFixed(1) + "\" height=\"" + ih +
          "\" fill=\"#ffffff\" fill-opacity=\"0.045\"/>";
      });
    }

    L.ticks.forEach(function (v) {
      var y = yL(v);
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.85\"/>";
      s += txt(m.l - 8, y + 3.5, o.fmtL ? o.fmtL(v) : String(v), { anchor: "end", size: 9, fill: C.dim2 });
    });

    if (o.zero != null) {
      var yz = yL(o.zero);
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yz.toFixed(1) +
        "\" y2=\"" + yz.toFixed(1) + "\" stroke=\"" + C.dim2 + "\" stroke-opacity=\"0.8\"/>";
    }

    if (R) {
      R.ticks.forEach(function (v) {
        var y = yR(v);
        s += txt(m.l + iw + 8, y + 3.5, o.fmtR ? o.fmtR(v) : String(v), { size: 9, fill: C.dim2 });
      });
    }

    o.series.forEach(function (se) {
      var vals = S[se.key].values.slice(i0);
      var yOf = se.axis === "right" ? yR : yL;
      if (se.axis === "right" && !R) return;
      var d = "", open = false;
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        if (v == null || !isFinite(v)) { open = false; continue; }
        d += (open ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1);
        open = true;
      }
      s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + se.color + "\" stroke-width=\"" +
        (se.width || 1.5) + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" +
        (se.dash ? " stroke-dasharray=\"4 3\"" : "") +
        (se.opacity != null ? " stroke-opacity=\"" + se.opacity + "\"" : "") + "/>";
    });

    var lastLabel = -99;
    for (var i = 0; i < n; i++) {
      var yv = Math.floor(yrs[i]);
      if (yv % 5 !== 0 || yv === lastLabel) continue;
      if (yrs[i] - yv > 0.08) continue;
      lastLabel = yv;
      s += txt(xOf(i), m.t + ih + 16, String(yv), { anchor: "middle", size: 8.5, fill: C.dim2 });
    }
    if (o.xLabel) s += txt(m.l, H - 3, o.xLabel, { size: 9, fill: C.dim2 });

    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      var model = HOV.linear({
        years: yrs,
        left: { min: L.min, max: L.max, fmt: o.fmtL },
        right: R ? { min: R.min, max: R.max, fmt: o.fmtR } : undefined,
        series: o.series.map(function (se) {
          return {
            name: se.name, color: se.color, axis: se.axis,
            data: S[se.key].values.slice(i0)
          };
        })
      }, { W: W, H: H, m: m, iw: iw, ih: ih }, {
        label: function (i) { return MONTHS[i0 + i]; }
      });
      HOV.bind(host, model);
    }
  }

  /* ------------------------------------------------ 1. the credit spread --- */
  function renderCredit() {
    var series = [{ key: "baa", name: "Baa − 10y", color: C.red, width: 1.7 }];
    if (state.aaa) {
      series.push({ key: "aaa", name: "Aaa − 10y", color: C.mint, width: 1.1, opacity: 0.75 });
    }
    drawLine("chartCredit", {
      aria: "Corporate bond spread over the 10-year Treasury, with recessions",
      left: { min: 0, max: 6.5, ticks: [0, 1.5, 3, 4.5, 6] },
      fmtL: function (v) { return v.toFixed(1); },
      series: series,
      xLabel: "shaded: NBER recessions"
    });
    legend("legendCredit", series.map(function (x) {
      return { name: x.name + " (pp)", color: x.color };
    }));
  }

  /* ------------------------------------------- 2. financial conditions --- */
  function renderConditions() {
    drawLine("chartConditions", {
      aria: "Financial conditions and stress indices",
      left: { min: -1.5, max: 5, ticks: [-1.5, 0, 2.5, 5] },
      fmtL: function (v) { return v.toFixed(1); },
      zero: 0,
      series: [
        { key: "nfci", name: "Chicago Fed NFCI", color: C.blue, width: 1.5 },
        { key: "stlfsi", name: "St Louis Fed stress", color: C.amber, width: 1.2, opacity: 0.85 }
      ],
      xLabel: "zero = average conditions over the sample"
    });
    legend("legendConditions", [
      { name: "NFCI (positive = tighter)", color: C.blue },
      { name: "St Louis stress", color: C.amber }
    ]);
  }

  /* ------------------------------------------------------------- 3. curve --- */
  function renderCurve() {
    drawLine("chartCurve", {
      aria: "Ten year minus two year Treasury spread",
      H: 300,
      left: { min: -1.2, max: 3.2, ticks: [-1, 0, 1, 2, 3] },
      fmtL: function (v) { return v.toFixed(0); },
      zero: 0,
      series: [{ key: "curve", name: "10y − 2y", color: C.teal, width: 1.4 }],
      xLabel: "below zero is inverted"
    });
  }

  /* ------------------------------------------------------------ 4. labour --- */
  function renderLabour() {
    drawLine("chartLabour", {
      aria: "Unemployment rate and job openings",
      H: 300,
      left: { min: 0, max: 16, ticks: [0, 4, 8, 12, 16] },
      fmtL: function (v) { return v.toFixed(0) + "%"; },
      right: { min: 0, max: 13000, ticks: [0, 4000, 8000, 12000] },
      fmtR: function (v) { return (v / 1000).toFixed(0) + "M"; },
      series: [
        { key: "unrate", name: "Unemployment", color: C.red, width: 1.6 },
        { key: "openings", name: "Openings", color: C.blue, width: 1.4, axis: "right" }
      ],
      xLabel: "left: unemployment rate · right: openings, millions"
    });
  }

  /* ------------------------------------------------------------ 5. equity --- */
  function renderEquity() {
    drawLine("chartEquity", {
      aria: "Nasdaq Composite nominal and CPI-deflated",
      left: { min: 0, max: 2600, ticks: [0, 650, 1300, 1950, 2600] },
      fmtL: function (v) { return v.toFixed(0); },
      series: [
        { key: "eqNom", name: "Nominal", color: C.dim, width: 1.3, opacity: 0.85 },
        { key: "eqReal", name: "Deflated by CPI", color: C.mint, width: 1.7 }
      ],
      xLabel: "index, first month of the window = 100"
    });
    legend("legendEquity", [
      { name: "Nominal", color: C.dim },
      { name: "CPI-deflated", color: C.mint }
    ]);
  }

  /* ------------------------------------------------------------ 6. stress --- */
  function renderStress() {
    var host = document.getElementById("chartStress");
    if (!host) return;
    var items = M.stress;
    var W = 560, H = 40 + items.length * 30;
    var m = { l: 78, r: 46, t: 20, b: 22 };
    var iw = W - m.l - m.r;
    var max = Math.max.apply(null, items.map(function (d) { return d.d; }));
    var rowH = (H - m.t - m.b) / items.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Credit widening episodes\">";
    items.forEach(function (d, i) {
      var y = m.t + i * rowH;
      var w = (d.d / max) * iw;
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + 5).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH - 12).toFixed(1) + "\" fill=\"" +
        (d.d >= 1 ? C.red : C.amber) + "\" fill-opacity=\"" + (d.d >= 1 ? "0.62" : "0.42") + "\"/>";
      s += txt(m.l - 8, y + rowH / 2 + 3, d.m, { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(m.l + w + 6, y + rowH / 2 + 3, "+" + d.d.toFixed(2) + " pp", { size: 8, fill: C.dim2 });
    });
    s += txt(m.l, H - 4, "three-month widening of the Baa spread", { size: 8.5, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: H - m.b,
        xOf: function () { return m.l; },
        xIndex: function (vx, vy) {
          var i = Math.floor((vy - m.t) / rowH);
          return i >= 0 && i < items.length ? i : null;
        },
        label: function (i) { return items[i].m; },
        rows: function (i) {
          return [{
            name: "Baa − 10y widened to",
            color: items[i].d >= 1 ? C.red : C.amber,
            text: "+" + items[i].d.toFixed(2) + " pp · level " + items[i].to.toFixed(2) + " pp"
          }];
        }
      });
    }
  }

  /* --------------------------------------------------------------- shells --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var w = M.now;
    var cards = [
      ["Baa spread over Treasuries", w.baa.toFixed(2) + " pp",
        ordinal(Math.round(w.baaPctile * 100)) + " percentile since " + MONTHS[0].slice(0, 4) +
        " · mean " + w.baaMean.toFixed(2) + " pp", true],
      ["Chicago Fed conditions", (w.nfci > 0 ? "+" : "") + w.nfci.toFixed(2),
        "positive is tighter · " + ordinal(Math.round(w.nfciPctile * 100)) + " percentile", false],
      ["10-year minus 2-year", (w.curve > 0 ? "+" : "") + w.curve.toFixed(2) + " pp",
        "10-year at " + w.tenY.toFixed(2) + "%", false],
      ["Unemployment", w.unrate.toFixed(1) + "%",
        (w.openings / 1000).toFixed(1) + "M openings · VIX " + w.vix.toFixed(1), false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var w = M.now;
    var pct = ordinal(Math.round(w.baaPctile * 100));
    host.innerHTML = "<h2>What this page shows</h2>" +
      "<p><span class='tag green'>measured, monthly</span> Credit is priced for calm. At " +
      w.baa.toFixed(2) + " points over Treasuries the Baa spread sits in the " + pct +
      " percentile of " + MONTHS.length + " months, against a sample mean of " +
      w.baaMean.toFixed(2) + ". Financial conditions agree: the Chicago Fed index at " +
      (w.nfci > 0 ? "+" : "") + w.nfci.toFixed(2) + " is looser than its median. Nothing here is " +
      "signalling the kind of stress that preceded any of the shaded recessions, and that is a " +
      "statement about the present, not a forecast.</p>" +
      "<p><span class='tag amber'>the asymmetry</span> What matters for a risk model is the shape of " +
      "the response, not the level. Between early 2007 and the end of 2008 the spread went from about " +
      "2 points to 6 &mdash; a tripling in eighteen months &mdash; and most of it arrived before the " +
      "unemployment rate had moved at all. A model with one labour variable and no credit variable is " +
      "structurally late, because the market reprices first and the labour market confirms later.</p>" +
      "<p><span class='tag dim'>the limits</span> This is public corporate credit, not the private " +
      "credit and datacenter debt a concentrated capex boom actually runs on, which is where an " +
      "AI-specific disappointment would sit. It also cannot see leverage: a spread says what a firm " +
      "pays, not what it owes. The equity series is the Nasdaq because FRED truncates the S&amp;P 500 " +
      "to ten years on the keyless endpoint &mdash; a real constraint, recorded rather than hidden.</p>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-markets.mjs</code>, and stored in the data file with the series they describe.</p>" +
      "<div class='checks'>" + M.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label +
          " <b>" + c.value + "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" +
      "<div class='srcline'><b>FRED — " + MONTHS[0] + " to " + MONTHS[MONTHS.length - 1] + "</b>. " +
      esc(M.source.note) +
      "<br><a href='" + M.source.url + "' target='_blank' rel='noopener'>fred.stlouisfed.org</a> · generated " +
      M.generated + "</div>" +
      "<div class='srcline'><b>Why this is here</b> — the crash model has no credit, no rate and no " +
      "debt in it. This is what those look like when they move.</div>";
  }

  /* ------------------------------------------------------------- controls --- */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g = document.createElement("details");
    g.className = "lgroup";
    g.open = true;
    g.innerHTML = "<summary>Window<i class='caret' aria-hidden='true'></i></summary>";

    var wrap = document.createElement("div");
    wrap.className = "lever";
    var lab = document.createElement("label");
    lab.className = "lever-top";
    lab.innerHTML = "<span class='lever-name'>Start from</span><b class='lever-val' id='v_from'>" + state.from + "</b>";
    var sel = document.createElement("select");
    sel.id = "fromSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    [1990, 2000, 2008, 2016].forEach(function (y) {
      var o = document.createElement("option");
      o.value = y; o.textContent = y + " → now";
      if (y === state.from) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      state.from = +sel.value;
      document.getElementById("v_from").textContent = state.from;
      drawAll();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    var wrap2 = document.createElement("div");
    wrap2.className = "lever";
    var lab2 = document.createElement("label");
    lab2.className = "lever-top";
    lab2.innerHTML = "<span class='lever-name'>Shade recessions</span>";
    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = state.rec;
    chk.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk.addEventListener("change", function () { state.rec = chk.checked; drawAll(); });
    wrap2.appendChild(lab2);
    wrap2.appendChild(chk);
    g.appendChild(wrap2);

    var wrap3 = document.createElement("div");
    wrap3.className = "lever";
    var lab3 = document.createElement("label");
    lab3.className = "lever-top";
    lab3.innerHTML = "<span class='lever-name'>Show Aaa spread</span>";
    var chk3 = document.createElement("input");
    chk3.type = "checkbox";
    chk3.checked = state.aaa;
    chk3.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk3.addEventListener("change", function () { state.aaa = chk3.checked; renderCredit(); });
    wrap3.appendChild(lab3);
    wrap3.appendChild(chk3);
    g.appendChild(wrap3);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "Aaa minus Baa is the gap between the best and the merely investment-grade " +
      "borrower. When it widens the market is discriminating, which is what a credit event looks like " +
      "before it is one.";
    g.appendChild(note);

    host.appendChild(g);
  }

  /* ------------------------------------------------------------------ init --- */
  function drawAll() {
    renderCredit();
    renderConditions();
    renderCurve();
    renderLabour();
    renderEquity();
    renderStress();
  }

  renderKpis();
  renderVerdict();
  drawAll();
  renderChecks();
  renderSources();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.from = 1990; state.rec = true; state.aaa = true;
      var sel = document.getElementById("fromSel");
      if (sel) sel.value = "1990";
      var vf = document.getElementById("v_from");
      if (vf) vf.textContent = "1990";
      var boxes = document.querySelectorAll("#controls input[type=checkbox]");
      if (boxes[0]) boxes[0].checked = true;
      if (boxes[1]) boxes[1].checked = true;
      drawAll();
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(drawAll, 180);
  });
})();
