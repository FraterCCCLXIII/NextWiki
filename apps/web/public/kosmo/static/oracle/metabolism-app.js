/* ============================================================================
   metabolism-app.js — renderer for `metabolism.html`.

   Five views. The rule this page follows: an index is only ever drawn against
   another series indexed to the same base year, and a share of renewable water
   is never drawn on the same axis as a count of countries. Where a series
   starts late, the axis starts on the data rather than on 1960.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.METABOLISM;
  if (!D) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };

  var state = { smooth: false };

  /* -------------------------------------------------------------- helpers --- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function txt(x, y, s, o) {
    o = o || {};
    return "<text x=\"" + (+x).toFixed(1) + "\" y=\"" + (+y).toFixed(1) + "\"" +
      (o.anchor ? " text-anchor=\"" + o.anchor + "\"" : "") +
      (o.size ? " font-size=\"" + o.size + "\"" : "") +
      (o.fill ? " fill=\"" + o.fill + "\"" : "") +
      " font-family=\"ui-monospace,monospace\">" + esc(s) + "</text>";
  }
  function sup(n) {
    return String(n).replace(/[0-9]/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; });
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

  /* One line chart over the shared year axis. */
  function drawLine(hostId, o) {
    var host = document.getElementById(hostId);
    if (!host) return;

    var i0 = D.years.indexOf(o.from || D.years[0]);
    if (i0 < 0) i0 = 0;
    /* `to` exists because the water series ends in 2022 while the year axis runs
       to 2025: the trailing empty years were dead space and their hover readout
       was blank, which reads as missing data rather than as a later date. */
    var i1 = o.to ? D.years.indexOf(o.to) : D.years.length - 1;
    if (i1 < i0) i1 = D.years.length - 1;
    var yrs = D.years.slice(i0, i1 + 1);
    var n = yrs.length;
    if (n < 2) return;

    var W = o.W || 780, H = o.H || 320;
    var m = { l: 50, r: o.right ? 52 : 18, t: 14, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var L = o.left, R = o.right || null;

    function xOf(i) { return m.l + i / (n - 1) * iw; }
    function yL(v) { return m.t + (1 - (v - L.min) / (L.max - L.min)) * ih; }
    function yR(v) { return m.t + (1 - (v - R.min) / (R.max - R.min)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" + esc(o.aria || "") + "\">";

    L.ticks.forEach(function (v) {
      var y = yL(v);
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, y + 3.5, o.fmtL ? o.fmtL(v) : String(v), { anchor: "end", size: 9, fill: C.dim2 });
    });
    if (R) {
      R.ticks.forEach(function (v) {
        s += txt(m.l + iw + 8, yR(v) + 3.5, o.fmtR ? o.fmtR(v) : String(v), { size: 9, fill: C.dim2 });
      });
    }

    o.series.forEach(function (se) {
      var vals = D.world[se.key].slice(i0, i1 + 1);
      var yOf = se.axis === "right" ? yR : yL;
      if (se.axis === "right" && !R) return;
      var d = "", open = false;
      for (var i = 0; i < vals.length; i++) {
        var v = vals[i];
        /* A series reported every few years is joined across its gaps when the
           caller asks: water withdrawal is a survey that lands in five-year
           steps, and breaking the path at every step drew nothing at all. */
        if (v == null || !isFinite(v)) { if (!se.connect) open = false; continue; }
        d += (open ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1);
        open = true;
      }
      if (d) {
        s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + se.color + "\" stroke-width=\"" +
          (se.width || 1.7) + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" +
          (se.dash ? " stroke-dasharray=\"5 4\"" : "") +
          (se.opacity != null ? " stroke-opacity=\"" + se.opacity + "\"" : "") + "/>";
      }
    });

    var lastLabel = -99;
    for (var i = 0; i < n; i++) {
      var yv = yrs[i];
      if (yv % (o.step || 10) !== 0 || yv === lastLabel) continue;
      lastLabel = yv;
      s += txt(xOf(i), m.t + ih + 16, String(yv), { anchor: "middle", size: 8.5, fill: C.dim2 });
    }
    if (o.xLabel) s += txt(m.l, H - 3, o.xLabel, { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return xOf(i); },
        xIndex: function (vx) {
          var t = (vx - m.l) / iw;
          if (t < -0.02 || t > 1.02) return null;
          /* rounding to n is possible at the right edge, and returning null
             there left the last year of every chart with no readout */
          var i = Math.round(t * (n - 1));
          return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
        },
        label: function (i) { return String(yrs[i]); },
        series: o.series.map(function (se) {
          var ax = se.axis === "right" ? R : L;
          return {
            name: se.name, color: se.color,
            val: function (i) { return D.world[se.key][i0 + i]; },
            yOf: function (v) {
              return se.axis === "right"
                ? m.t + (1 - (v - R.min) / (R.max - R.min)) * ih
                : m.t + (1 - (v - L.min) / (L.max - L.min)) * ih;
            },
            /* a per-series format, because one formatter for two units turns
               8.2 billion people into "8" */
            fmt: se.fmt || o.fmtV
          };
        })
      });
    }
  }

  /* ------------------------------------------------------- 1. food vs people --- */
  function renderFood() {
    drawLine("chartFood", {
      aria: "Calories available and population indexed to 1961",
      left: { min: 0, max: 400, ticks: [0, 100, 200, 300, 400] },
      fmtL: function (v) { return String(v); },
      fmtV: function (v) { return v.toFixed(1); },
      series: [
        { key: "foodIdx", name: "Food available", color: C.mint, width: 2 },
        { key: "popIdx", name: "Population", color: C.amber, width: 1.6 }
      ],
      step: 10,
      xLabel: D.now.baseYear + " = 100 for both series"
    });
    legend("legendFood", [
      { name: "Total calories available", color: C.mint },
      { name: "World population", color: C.amber }
    ]);
  }

  /* ---------------------------------------------------------- 2. undernutrition --- */
  function renderUnder() {
    var first = D.world.under.findIndex(function (v) { return v != null; });
    drawLine("chartUnder", {
      aria: "Prevalence of undernourishment",
      H: 300,
      from: D.years[first >= 0 ? first : 0],
      left: { min: 0, max: 16, ticks: [0, 4, 8, 12, 16] },
      fmtL: function (v) { return v + "%"; },
      fmtV: function (v) { return v.toFixed(1) + "%"; },
      series: [{ key: "under", name: "Undernourished", color: C.red, width: 1.8 }],
      step: 5,
      xLabel: "share of world population below the minimum dietary energy requirement"
    });
  }

  /* --------------------------------------------------------------- 3. health --- */
  function renderHealth() {
    var first = D.world.imm.findIndex(function (v) { return v != null; });
    drawLine("chartHealth", {
      aria: "Measles immunisation and health spending",
      H: 300,
      from: D.years[first >= 0 ? first : 0],
      left: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] },
      fmtL: function (v) { return v + "%"; },
      right: { min: 0, max: 12, ticks: [0, 3, 6, 9, 12] },
      fmtR: function (v) { return v + "%"; },
      fmtV: function (v) { return v.toFixed(1) + "%"; },
      series: [
        { key: "imm", name: "Measles immunisation", color: C.blue, width: 1.8 },
        { key: "hex", name: "Health spending", color: C.violet, width: 1.3, axis: "right", opacity: 0.85 }
      ],
      step: 5,
      xLabel: "left: coverage, % of 1-year-olds · right: spending, % of GDP"
    });
  }

  /* ---------------------------------------------------------------- 4. air --- */
  function renderAir() {
    var first = D.world.airIdx.findIndex(function (v) { return v != null; });
    drawLine("chartAir", {
      aria: "Air passengers carried, indexed",
      left: { min: 0, max: 1600, ticks: [0, 400, 800, 1200, 1600] },
      fmtL: function (v) { return String(v); },
      fmtV: function (v) { return v.toFixed(0); },
      from: D.years[first >= 0 ? first : 0],
      series: [{ key: "airIdx", name: "Passengers", color: C.teal, width: 1.9 }],
      step: 10,
      xLabel: "index, " + D.now.airBase + " = 100 · the 2020 gap is the pandemic"
    });
    legend("legendAir", [{ name: "Passengers carried", color: C.teal }]);
  }

  /* -------------------------------------------------------------- 5. water --- */
  function renderWater() {
    var host = document.getElementById("chartWater");
    if (!host) return;
    var pts = D.scatter.water.points;
    var edges = [0, 5, 10, 20, 40, 80, 120, 100000];
    var labels = ["0–5", "5–10", "10–20", "20–40", "40–80", "80–120", ">120"];
    var counts = new Array(labels.length).fill(0);
    pts.forEach(function (p) {
      for (var i = 0; i < edges.length - 1; i++) {
        if (p.a >= edges[i] && p.a < edges[i + 1]) { counts[i]++; break; }
      }
    });
    var max = Math.max.apply(null, counts);
    var W = 780, H = 300, m = { l: 46, r: 18, t: 18, b: 52 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var bw = iw / counts.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Countries by freshwater withdrawal\">";
    [0, 20, 40, 60].forEach(function (v) {
      var y = m.t + (1 - v / 70) * ih;
      if (v / 70 > 1) return;
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, y + 3.5, v, { anchor: "end", size: 9, fill: C.dim2 });
    });
    counts.forEach(function (c, i) {
      var h = (c / 70) * ih;
      var x = m.l + i * bw + bw * 0.15;
      s += "<rect x=\"" + x.toFixed(1) + "\" y=\"" + (m.t + ih - h).toFixed(1) +
        "\" width=\"" + (bw * 0.7).toFixed(1) + "\" height=\"" + h.toFixed(1) +
        "\" fill=\"" + (i >= 5 ? C.red : i >= 4 ? C.amber : C.blue) + "\" fill-opacity=\"0.55\"/>";
      s += txt(x + bw * 0.35, m.t + ih + 14, labels[i], { anchor: "middle", size: 8.5, fill: C.dim2 });
      if (c) s += txt(x + bw * 0.35, m.t + ih - h - 5, String(c), { anchor: "middle", size: 8.5, fill: C.dim });
    });
    s += txt(m.l + iw / 2, H - 8, "withdrawal as % of internal renewable resources, " + D.scatter.water.year,
      { anchor: "middle", size: 9, fill: C.dim2 });
    s += txt(m.l, m.t - 4, "countries", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return m.l + i * bw + bw / 2; },
        xIndex: function (vx) {
          var i = Math.floor((vx - m.l) / bw);
          return i >= 0 && i < counts.length ? i : null;
        },
        label: function (i) { return labels[i] + "% of renewable water"; },
        rows: function (i) {
          var list = pts.filter(function (p) {
            for (var k = 0; k < edges.length - 1; k++) {
              if (p.a >= edges[k] && p.a < edges[k + 1]) return k === i;
            }
            return false;
          }).sort(function (a, b) { return b.a - a.a; });
          return [{
            name: counts[i] + " countries",
            color: i >= 5 ? C.red : C.amber,
            text: list.length ? "highest: " + list.slice(0, 3).map(function (p) { return p.name; }).join(", ") : "none"
          }];
        }
      });
    }
  }

  /* --------------------------------------------------------------- shells --- */
  /* ============================================ what is taken, from what ==== */

  /* World withdrawal against the water its territory renews each year. The
     reserve is not a tank: it is the annual flow the planet's land generates,
     and it is plotted because it makes the ratio legible — 3,853 out of 42,807. */
  function renderWaterAbs() {
    var w = D.water;
    if (!w || !w.years.length) {
      var h = document.getElementById("chartWaterAbs");
      if (h) h.innerHTML = "<p class='muted'>no water series</p>";
      return;
    }
    var from = w.years[0].year;
    drawLine("chartWaterAbs", {
      aria: "World freshwater withdrawal against internal renewable resources, 1992 to 2022",
      from: from,
      to: w.years[w.years.length - 1].year,
      left: { min: 0, max: 46000, ticks: [0, 10000, 20000, 30000, 40000] },
      fmtL: function (v) { return v === 0 ? "0" : (v / 1000).toFixed(0) + "k"; },
      right: { min: 0, max: 12, ticks: [0, 3, 6, 9, 12] },
      fmtR: function (v) { return v + "%"; },
      fmtV: function (v) { return v.toFixed(1); },
      series: [
        { key: "wRes", name: "Renewed each year", color: C.steel, width: 1.5, dash: true, connect: true },
        { key: "wSum", name: "Withdrawn", color: C.mint, width: 2.2, connect: true },
        { key: "wRatio", name: "Share of renewal", color: C.amber, width: 1.4, axis: "right", connect: true }
      ],
      step: 5,
      xLabel: "left: cubic kilometres a year · right: withdrawal as a share of what renews"
    });
    legend("legendWaterAbs", [
      { name: "Withdrawn", color: C.mint },
      { name: "Internal renewable supply", color: C.steel, dash: true },
      { name: "Share of renewal (right)", color: C.amber }
    ]);
  }

  /* Every country, what it takes against what falls on it. Log-log, because the
     range is six orders of magnitude and the 1:1 line is the only reference that
     matters: above it, a country is living on water that does not renew inside
     its own border. */
  function renderStress() {
    var host = document.getElementById("chartStress");
    if (!host || !D.water || !D.water.stress) return;
    var pts = D.water.stress.points.filter(function (p) { return p.withdrawal > 0 && p.renewable > 0; });
    if (!pts.length) return;

    var W = 900, H = 380;
    var m = { l: 54, r: 20, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var lo = -1.2, hi = 4.2;          /* log10 km³: 0.06 to 16,000 */

    function xOf(v) { return m.l + (Math.log10(Math.max(v, 0.06)) - lo) / (hi - lo) * iw; }
    function yOf(v) { return m.t + (1 - (Math.log10(Math.max(v, 0.06)) - lo) / (hi - lo)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Country freshwater withdrawal against internal renewable supply, 2022\">";
    for (var e = 0; e <= 4; e++) {
      var gx = xOf(Math.pow(10, e)), gy = yOf(Math.pow(10, e));
      s += "<line x1=\"" + gx.toFixed(1) + "\" x2=\"" + gx.toFixed(1) + "\" y1=\"" + (m.t + ih) + "\" y2=\"" + m.t + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 5\" stroke-opacity=\"0.7\"/>";
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + gy.toFixed(1) + "\" y2=\"" + gy.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 5\" stroke-opacity=\"0.7\"/>";
      s += txt(gx, m.t + ih + 16, e === 0 ? "1" : "10" + sup(e), { anchor: "middle", size: 8.5, fill: C.dim2 });
      s += txt(m.l - 7, gy + 3.5, e === 0 ? "1" : "10" + sup(e), { anchor: "end", size: 8.5, fill: C.dim2 });
    }

    /* 1:1 — the line where withdrawal exactly equals renewal. */
    s += "<line x1=\"" + xOf(1) + "\" y1=\"" + yOf(1) + "\" x2=\"" + xOf(1e4) + "\" y2=\"" + yOf(1e4) +
      "\" stroke=\"" + C.dim + "\" stroke-width=\"1.2\" stroke-dasharray=\"6 4\"/>";
    s += txt(xOf(3200), yOf(9000), "takes exactly what renews", { size: 8.5, fill: C.dim });

    pts.forEach(function (p) {
      var over = p.deficit > 0;
      s += "<circle cx=\"" + xOf(p.renewable).toFixed(1) + "\" cy=\"" + yOf(p.withdrawal).toFixed(1) +
        "\" r=\"" + (over ? 3 : 2.2) + "\" fill=\"" + (over ? C.red : C.mint) +
        "\" fill-opacity=\"" + (over ? "0.8" : "0.45") + "\"/>";
    });

    s += txt(m.l + iw, m.t + ih + 30, "renewed inside the border →", { anchor: "end", size: 8.5, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function () { return 0; },
        /* Returns an index, not the point: `label` and `rows` both receive
           whatever `xIndex` returns, so returning the object here made
           pts[object] undefined and the handler threw. */
        xIndex: function (vx, vy) {
          var best = null, bd = 1e9;
          pts.forEach(function (p, k) {
            var dx = xOf(p.renewable) - vx, dy = yOf(p.withdrawal) - vy;
            var dd = dx * dx + dy * dy;
            if (dd < bd) { bd = dd; best = k; }
          });
          return bd < 400 ? best : null;
        },
        label: function (i) { return pts[i].name; },
        /* The first argument is the index, not the point — reading properties
           off it threw inside the pointer handler and left the previous card
           on screen. The index has to be dereferenced here. */
        rows: function (i) {
          var p = pts[i];
          return [
            { name: "Withdraws", color: C.mint, text: p.withdrawal.toFixed(1) + " km³" },
            { name: "Renewed inside", color: C.steel, dash: true, text: p.renewable.toFixed(1) + " km³" },
            { name: p.deficit > 0 ? "Deficit" : "Surplus", color: p.deficit > 0 ? C.red : C.mint, text: Math.abs(p.deficit).toFixed(1) + " km³ · " + p.ratio + "%" }
          ];
        }
      });
    }
  }

  /* The deficit in absolute volume, which is not the same ranking as the ratio:
     a country can be at 7,750% of its own supply and still matter less to the
     global picture than one at 326% in a bigger basin. */
  function renderDeficit() {
    var host = document.getElementById("chartDeficit");
    if (!host || !D.water || !D.water.stress) return;
    var bars = D.water.stress.points.filter(function (p) { return p.deficit > 0; }).slice(0, 10);
    var W = 430, H = 320, m = { l: 104, r: 46, t: 12, b: 30 };
    var iw = W - m.l - m.r, rowH = (H - m.t - m.b) / Math.max(bars.length, 1);
    var max = bars.length ? bars[0].deficit : 1;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Largest absolute water deficits by country\">";
    bars.forEach(function (p, i) {
      var y = m.t + i * rowH;
      var w = Math.max(1.5, (p.deficit / max) * iw);
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + rowH * 0.2).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH * 0.46).toFixed(1) + "\" fill=\"" + C.red + "\" fill-opacity=\"0.65\"/>";
      s += txt(m.l - 6, y + rowH * 0.54, p.name.length > 20 ? p.name.slice(0, 19) + "·" : p.name, { anchor: "end", size: 8, fill: C.dim });
      s += txt(m.l + w + 5, y + rowH * 0.54, p.deficit.toFixed(0), { size: 8, fill: C.dim2 });
    });
    s += txt(m.l, H - 6, "km³ a year taken beyond what renews inside the border, " + D.water.stress.year, { size: 8, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV && bars.length) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + (H - m.t - m.b),
        xOf: function (i) { return m.l + 6; },
        xIndex: function (vx, vy) {
          var i = Math.floor((vy - m.t) / rowH);
          return i >= 0 && i < bars.length ? i : null;
        },
        label: function (i) { return bars[i].name; },
        rows: function (i) {
          var p = bars[i];
          return [
            { name: "Deficit", color: C.red, text: p.deficit.toFixed(1) + " km³ a year" },
            { name: "Against its own supply", color: C.dim, text: p.ratio + "%" },
            { name: "People", color: C.dim, text: p.pop ? (p.pop / 1e6).toFixed(0) + " million" : "–" }
          ];
        }
      });
    }
  }

  /* Food in mass, against the people eating it. */
  function renderCereal() {
    var first = D.world.cerealMt.findIndex(function (v) { return v != null; });
    drawLine("chartCereal", {
      aria: "World cereal production in megatonnes against world population",
      from: D.years[first >= 0 ? first : 0],
      left: { min: 0, max: 3400, ticks: [0, 1000, 2000, 3400] },
      fmtL: function (v) { return String(v); },
      right: { min: 0, max: 9, ticks: [0, 3, 6, 9] },
      fmtR: function (v) { return v + "bn"; },
      fmtV: function (v) { return v.toFixed(0); },
      series: [
        { key: "cerealMt", name: "Cereal production", color: C.mint, width: 2.1,
          fmt: function (v) { return v.toFixed(0) + " Mt"; } },
        { key: "popB", name: "World population", color: C.amber, width: 1.5, axis: "right",
          fmt: function (v) { return v.toFixed(2) + " billion"; } }
      ],
      step: 10,
      xLabel: "left: megatonnes of cereal a year · right: billions of people"
    });
    legend("legendCereal", [
      { name: "Cereal production (left)", color: C.mint },
      { name: "Population (right)", color: C.amber }
    ]);
  }

  /* Calories as a total, not a per-person average: the same numbers multiplied
     by the number of people who need them. */
  function renderCalories() {
    var first = D.world.kcalTotal.findIndex(function (v) { return v != null; });
    if (first < 0) return;
    drawLine("chartCalories", {
      aria: "Total calories supplied against the minimum requirement, trillion kcal a day",
      W: 500, H: 320,
      from: D.years[first],
      left: { min: 0, max: 30, ticks: [0, 10, 20, 30] },
      fmtL: function (v) { return v + "T"; },
      fmtV: function (v) { return v.toFixed(1) + " trillion kcal"; },
      series: [
        { key: "kcalTotal", name: "Supplied", color: C.mint, width: 2.1 },
        { key: "kcalNeed", name: "Required at " + D.kcalFloor, color: C.amber, width: 1.6, dash: true }
      ],
      step: 10,
      xLabel: "trillion kcal a day · required = " + D.kcalFloor + " kcal × everyone alive"
    });
    legend("legendCalories", [
      { name: "Supplied (FAO)", color: C.mint },
      { name: "Minimum requirement", color: C.amber, dash: true }
    ]);
  }

  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var w = D.now;
    var over100 = D.scatter.water.points.filter(function (p) { return p.a >= 100; }).length;
    var cards = [
      ["Food against people", Math.round(w.foodIdx) + " vs " + Math.round(w.popIdx),
        "index, " + w.baseYear + " = 100 — " + Math.round((w.foodIdx / w.popIdx - 1) * 100) +
        "% more food per person, both in " + w.ratioYear, true],
      ["Undernourished", w.under.toFixed(1) + "%",
        "of world population · peak 13.2% in 2002", false],
      ["Measles coverage", w.imm.toFixed(0) + "%",
        "of one-year-olds, a proxy for whether the state can reach a child twice", false],
      ["Drawing down water", over100 + " countries",
        "withdrawing more than 100% of internal renewable supply, " + D.scatter.water.year, false]
    ];

    /* The absolute view, added because four percentages said nothing about
       volume: how much is taken, out of how much renews, in cubic kilometres. */
    if (D.water && D.water.years.length) {
      var w0 = D.water.years[0], wN = D.water.years[D.water.years.length - 1];
      var r0 = D.world.wRatio[D.years.indexOf(w0.year)];
      cards.push(["Water taken of what renews", D.water.worldStress + "%",
        (r0 != null ? r0.toFixed(1) + "% in " + w0.year + " · " : "") +
        wN.withdrawal.toFixed(0) + " km³ out of " + D.world.wRes[D.years.indexOf(wN.year)].toFixed(0), false]);
    }
    var cerealLast = null, cerealFirst = null;
    D.world.cerealPerPerson.forEach(function (v) { if (v != null) { if (cerealFirst == null) cerealFirst = v; cerealLast = v; } });
    if (cerealLast != null) {
      cards.push(["Cereal per person", Math.round(cerealLast) + " kg",
        (cerealFirst != null ? Math.round(cerealFirst) + " kg in 1961 · " : "") + "a year, a flow not a stock", false]);
    }
    if (D.world.kcalTotal) {
      var tN = null, nN = null;
      for (var k = D.world.kcalTotal.length - 1; k >= 0; k--) {
        if (D.world.kcalTotal[k] != null && D.world.kcalNeed[k] != null) { tN = D.world.kcalTotal[k]; nN = D.world.kcalNeed[k]; break; }
      }
      if (tN != null) {
        cards.push(["Calories against the floor", "+" + Math.round((tN / nN - 1) * 100) + "%",
          tN.toFixed(1) + " trillion kcal a day supplied, " + nN.toFixed(1) + " needed at " + D.kcalFloor + " each", false]);
      }
    }
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var w = D.now;
    host.innerHTML = "<h2>What this page shows</h2>" +
      "<p><span class='tag green'>the sixty-year fact</span> Food supply has risen to " +
      Math.round(w.foodIdx) + " on a " + w.baseYear + " base while population has risen to " +
      Math.round(w.popIdx) + ", both in " + w.ratioYear + ". That is " +
      Math.round((w.foodIdx / w.popIdx - 1) * 100) +
      "% more food per person — not the three times more this page used to claim. The earlier chart drew " +
      "the World Bank's food production index, whose World row changes its reporting set and steps 57% in " +
      "a single reported year; it turned a 3.6-fold rise into an eightfold one and made population look flat. " +
      "The corrected line still says the important thing — food has grown faster than mouths for two " +
      "generations — at the size the evidence supports. The constraint moved: not calories, but price, " +
      "distribution and soil.</p>" +
      "<p><span class='tag amber'>the stall</span> Undernourishment fell from double digits to " +
      "single digits and then stopped. At " + w.under.toFixed(1) +
      "% of the world that is still roughly one person in twelve, and the last two decades of " +
      "progress are flat. This is what a system failure looks like when the failure is not scarcity: " +
      "enough food exists, and it does not reach people who cannot pay for it. A lab that models " +
      "aggregate output and not purchasing power will keep missing this.</p>" +
      "<p><span class='tag dim'>the exposure</span> The water tail is the part of this page that " +
      "behaves like a risk rather than a trend. " + D.scatter.water.points.filter(function (p) { return p.a >= 100; }).length +
      " countries withdraw more than their renewable supply, which means groundwater depletion or " +
      "imported water, and those are the countries whose food system is a claim on a river somewhere " +
      "else. Meanwhile air travel is back within a few points of its 2019 peak, which restores the " +
      "pathogen vector to where it was before the only experiment anyone has run on it.</p>" +
      (function () {
        if (!D.water || !D.water.years.length) return "";
        var first = D.water.years[0], lastY = D.water.years[D.water.years.length - 1];
        var tN = null, nN = null;
        for (var k = D.world.kcalTotal.length - 1; k >= 0; k--) {
          if (D.world.kcalTotal[k] != null && D.world.kcalNeed[k] != null) {
            tN = D.world.kcalTotal[k]; nN = D.world.kcalNeed[k]; break;
          }
        }
        return "<p><span class='tag green'>in volumes</span> The world took <b>" +
          lastY.withdrawal.toFixed(0) + " km³</b> of fresh water in " + lastY.year + " out of the <b>" +
          (D.world.wRes[D.years.indexOf(lastY.year)] || 0).toFixed(0) + " km³</b> its land renews in the " +
          "same year &mdash; <b>" + D.water.worldStress + "%</b>, against " +
          (D.world.wRatio[D.years.indexOf(first.year)] || 0).toFixed(1) + "% in " + first.year +
          ". That global number is not alarming and it is also not the number that matters: " +
          D.water.stress.points.filter(function (p) { return p.deficit > 0; }).length +
          " countries of " + D.water.stress.points.length + " take more than their own territory renews, " +
          "led in volume by " + D.water.stress.points.filter(function (p) { return p.deficit > 0; })
            .slice(0, 3).map(function (p) { return p.name + " (" + p.deficit.toFixed(0) + " km³)"; }).join(", ") +
          ".</p>" +
          (tN != null
            ? "<p><span class='tag amber'>and in calories</span> The food system supplies <b>" + tN.toFixed(1) +
              " trillion kcal a day</b> against a requirement of <b>" + nN.toFixed(1) +
              " trillion</b> at FAO's 2,100 kcal floor &mdash; a surplus of " +
              Math.round((tN / nN - 1) * 100) + "%. Hold that next to " + w.under.toFixed(1) +
              "% undernourished and the page's central claim stops being rhetorical: the deficit is " +
              "not in the ground, and a reserve that nobody can buy is not a reserve.</p>"
            : "");
      })();
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-metabolism.mjs</code>, and stored in the data file with the series they describe.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        /* the state is carried through: this map printed every row as ok and
           would have hidden the one check that reports an artifact */
        var st = c.state || "ok";
        return "<div class='check " + st + "'><span class='cval'>" +
          (st === "ok" ? "ok" : st === "warn" ? "!" : "i") + "</span>" +
          "<span class='clabel'>" + c.label + " <b>" + c.value + "</b></span>" +
          "<span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" +
      "<div class='srcline'><b>World Bank</b> — " + esc(D.source.note) +
      "<br><a href='" + D.source.url + "' target='_blank' rel='noopener'>data.worldbank.org</a> · generated " +
      D.generated + "</div>" +
      "<div class='srcline'><b>Why this is here</b> — a civilisation fails through this layer first: not " +
      "because the machines stopped, but because the distribution did.</div>";
  }

  /* ------------------------------------------------------------- controls --- */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g = document.createElement("details");
    g.className = "lgroup";
    g.open = true;
    g.innerHTML = "<summary>Views<i class='caret' aria-hidden='true'></i></summary>";

    var wrap = document.createElement("div");
    wrap.className = "lever";
    var lab = document.createElement("label");
    lab.className = "lever-top";
    lab.innerHTML = "<span class='lever-name'>Start the long series at</span><b class='lever-val' id='v_trim'>1961</b>";
    var sel = document.createElement("select");
    sel.id = "trimSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#1a1a1a;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    [1961, 1980, 2000].forEach(function (y) {
      var o = document.createElement("option");
      o.value = y; o.textContent = y + " → now";
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      state.from = +sel.value;
      document.getElementById("v_trim").textContent = state.from;
      renderFood(); renderAir();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "Trimming the window re-bases only the axis, not the index: 1961 stays 100 " +
      "whichever start year is chosen, so the slope stays comparable between views.";
    g.appendChild(note);

    host.appendChild(g);
  }

  /* ------------------------------------------------------------------ init --- */
  state.from = 1961;
  function drawAll() {
    renderFood(); renderUnder(); renderHealth(); renderAir(); renderWater();
    renderWaterAbs(); renderStress(); renderDeficit(); renderCereal(); renderCalories();
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
      state.from = 1961;
      var sel = document.getElementById("trimSel");
      if (sel) sel.value = "1961";
      var v = document.getElementById("v_trim");
      if (v) v.textContent = "1961";
      renderFood(); renderAir();
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(drawAll, 180);
  });
})();
