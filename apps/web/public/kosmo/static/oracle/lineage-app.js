/* ============================================================================
   lineage-app.js — renderer for lineage.html.

   The registers are measured, the branching rate is arithmetic on them, and the
   reach is a stated assumption. Each chart says which of the three it is.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.LINEAGE_DATA, K = window.LINEAGE_CLAIMS, M = window.LINEAGE_MODEL;
  if (!D || !K || !M) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0", gold: "#e2d6ae"
  };

  var state = { students: 20, weekly: 0.05, rate: 0.01, highlight: null };

  function compact(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    if (a >= 10) return Math.round(v).toString();
    if (a >= 1) return (+v).toFixed(1);
    return (+v).toFixed(a >= 0.01 ? 3 : 4);
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function txt(x, y, s, o) {
    o = o || {};
    var px = typeof x === "number" ? x.toFixed(1) : x;
    var py = typeof y === "number" ? y.toFixed(1) : y;
    return '<text x="' + px + '" y="' + py + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") +
      (o.size ? ' font-size="' + o.size + '"' : "") +
      (o.fill ? ' fill="' + o.fill + '"' : "") +
      (o.opacity != null ? ' opacity="' + o.opacity + '"' : "") +
      ' font-family="ui-monospace,monospace">' + s + "</text>";
  }
  function grid(x1, y1, x2, y2) {
    return '<line x1="' + x1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y1="' + y1.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
  }
  function polyline(pts, color, o) {
    o = o || {};
    var d = "", open = false;
    for (var i = 0; i < pts.length; i++) {
      if (!pts[i]) { open = false; continue; }
      d += (open ? " L" : "M") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
      open = true;
    }
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (o.width || 1.7) +
      '" stroke-linejoin="round" stroke-linecap="round"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : "") + '"/>';
  }
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
        return bd < cfg.tol ? best : null;
      },
      label: function (i) { return cfg.label(i); },
      rows: function (i) { return cfg.rows(i); }
    });
  }
  function bindRows(host, cfg) {
    if (!window.HOV) return;
    HOV.bind(host, {
      W: cfg.W, H: cfg.H, top: cfg.top, bottom: cfg.bottom,
      xOf: function () { return cfg.x; },
      xIndex: function (vx, vy) {
        var i = Math.floor((vy - cfg.top) / cfg.rowH);
        return i >= 0 && i < cfg.n ? i : null;
      },
      label: function (i) { return cfg.label(i); },
      rows: function (i) { return cfg.rows(i); }
    });
  }

  var computed = K.registers.map(function (r) {
    var b = M.branching(r);
    return { reg: r, R: b.R, gens: b.generations, genLen: b.generationLength, ext: M.extinction(b.R) };
  });

  /* --------------------------------------------------------- 1. registers --- */
  function renderRegisters() {
    var host = document.getElementById("chartRegisters");
    if (!host) return;
    var rows = computed.slice().sort(function (a, b) { return b.reg.total - a.reg.total; });
    var W = 720, H = 300, m = { l: 132, r: 92, t: 26, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rowH = ih / rows.length;
    var lo = 1, hi = 3.4;                       /* log10 names, 10 to 2500 */
    var xs = function (v) { return m.l + (Math.log(v) / Math.LN10 - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Names recorded in three transmission registers, log scale">';
    [10, 100, 1000].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 15, compact(v), { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (c, i) {
      var y = m.t + rowH * i + rowH * 0.26, h = rowH * 0.48;
      var r = c.reg;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.total) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + r.color + '" fill-opacity="0.16" stroke="' + r.color +
        '" stroke-opacity="0.5"/>';
      if (r.detailed) {
        s += '<rect x="' + m.l + '" y="' + (y + h * 0.22).toFixed(1) + '" width="' + (xs(r.detailed) - m.l).toFixed(1) +
          '" height="' + (h * 0.56).toFixed(1) + '" fill="' + r.color + '" fill-opacity="0.22" stroke="' + r.color +
          '" stroke-opacity="0.6" stroke-dasharray="2 2"/>';
      }
      s += txt(m.l - 10, y + h * 0.72, r.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += txt(xs(r.total) + 8, y + h * 0.72, r.total.toLocaleString("en-US") + (r.detailed ? " · " + r.detailed : ""),
        { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 8, "names in the register · log scale · the inner bar is names with a recorded word",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].reg.name; },
      rows: function (i) {
        var c = rows[i];
        return [
          { name: "names", color: c.reg.color, text: c.reg.total.toLocaleString("en-US") },
          { name: "generations", color: C.dim, text: String(c.reg.generations) },
          { name: "years", color: C.dim2, text: (c.reg.recorded - c.reg.founded).toLocaleString("en-US") },
          { name: "branching", color: C.amber, text: c.R.toFixed(2) + " per generation" }
        ];
      }
    });
  }

  /* ---------------------------------------------------------- 2. branching --- */
  function renderBranch() {
    var host = document.getElementById("chartBranch");
    if (!host) return;
    var W = 720, H = 320, m = { l: 46, r: 92, t: 22, b: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = 0, x1 = 65, y0 = 0.9, y1 = 1.5;
    var xs = function (v) { return m.l + (v - x0) / (x1 - x0) * iw; };
    var ys = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Branching rate against generation length for three lineages">';
    [1.0, 1.1, 1.2, 1.3, 1.4, 1.5].forEach(function (v) {
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, v.toFixed(1), { anchor: "end", size: 9, fill: C.dim2 });
    });
    s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(1) + '" y2="' + ys(1) +
      '" stroke="' + C.red + '" stroke-opacity="0.6" stroke-dasharray="6 4"/>';
    s += txt(m.l + 4, ys(1) - 5, "R = 1 — one successor per holder, no growth",
      { size: 8.5, fill: C.red, opacity: 0.8 });
    [0, 15, 30, 45, 60].forEach(function (v) {
      s += txt(xs(v), m.t + ih + 15, v + "y", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, m.t + ih + 30, "generation length", { anchor: "middle", size: 9, fill: C.dim2 });

    computed.forEach(function (c) {
      var x = xs(c.genLen), y = ys(c.R);
      var r = c.reg.branch ? 7 : 5;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + c.reg.color +
        '" fill-opacity="0.3" stroke="' + c.reg.color + '"/>';
      s += txt(x + 11, y + 3.5, c.reg.name, { size: 9.5, fill: c.reg.color });
    });
    s += txt(m.l, m.t - 7, "measured from the registers · branch size is the number of names",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 60,
      xs: computed.map(function (c) { return xs(c.genLen); }),
      label: function (i) { return computed[i].reg.name; },
      rows: function (i) {
        var c = computed[i];
        return [
          { name: "branching", color: c.reg.color, text: c.R.toFixed(3) + " per generation" },
          { name: "generation", color: C.dim, text: c.genLen.toFixed(1) + " years" },
          { name: "names", color: C.dim2, text: c.reg.total.toLocaleString("en-US") },
          { name: "chance extinction", color: C.red, text: (c.ext * 100).toFixed(0) + "%" }
        ];
      }
    });
  }

  /* --------------------------------------------------------------- 3. fan --- */
  function renderFan() {
    var host = document.getElementById("chartFan");
    if (!host) return;
    var W = 720, H = 340, m = { l: 46, r: 100, t: 20, b: 36 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var gmax = 40;
    var xs = function (g) { return m.l + g / gmax * iw; };
    var yTop = Math.log(6000) / Math.LN10;
    var ys = function (n) { return m.t + (1 - Math.log(Math.max(1, n)) / Math.LN10 / yTop) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Cumulative names by generation under different branching rates">';
    [1, 10, 100, 1000].forEach(function (v) {
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, compact(v), { anchor: "end", size: 9, fill: C.dim2 });
    });
    [0, 10, 20, 30, 40].forEach(function (g) {
      s += txt(xs(g), m.t + ih + 15, String(g), { anchor: "middle", size: 9, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, m.t + ih + 29, "generations", { anchor: "middle", size: 9, fill: C.dim2 });

    var legend = [];
    var curves = [
      { R: 0.9, color: C.dim2, label: "0.9" },
      { R: 1.0, color: C.blue, label: "1.0 — a chain" },
      { R: 1.1, color: C.mint, label: "1.1" },
      { R: 1.363, color: C.amber, label: "1.36 — Chan" }
    ];
    curves.forEach(function (c) {
      var pts = [];
      for (var g = 0; g <= gmax; g++) {
        var n = c.R === 1 ? g + 1 : Math.pow(c.R, g);
        pts.push([xs(g), ys(n)]);
      }
      s += polyline(pts, c.color, { width: 1.8, dash: c.R <= 1 ? "5 3" : null });
      legend.push({ label: c.label, color: c.color });
    });

    computed.filter(function (c) { return c.reg.branch; }).forEach(function (c) {
      s += '<circle cx="' + xs(c.gens).toFixed(1) + '" cy="' + ys(c.reg.total).toFixed(1) +
        '" r="4.5" fill="' + C.amber + '"/>';
      s += txt(xs(c.gens) - 8, ys(c.reg.total) - 8, "1,701 names at generation " + c.gens,
        { anchor: "end", size: 8.5, fill: C.amber });
    });
    s += txt(m.l, m.t - 5, "cumulative names from one founder · modelled from the measured rates",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
    var leg = document.getElementById("legendFan");
    if (leg) {
      leg.innerHTML = legend.map(function (x) {
        return "<span><i style='background:" + x.color + "'></i>R " + x.label + "</span>";
      }).join("");
    }

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 12,
      xs: (function () { var o = []; for (var g = 0; g <= gmax; g++) o.push(xs(g)); return o; })(),
      label: function (i) { return "generation " + i; },
      rows: function (i) {
        return curves.map(function (c) {
          var n = c.R === 1 ? i + 1 : Math.pow(c.R, i);
          return { name: "R " + c.R.toFixed(2), color: c.color, text: Math.round(n).toLocaleString("en-US") };
        });
      }
    });
  }

  /* ---------------------------------------------------------- 4. monastic --- */
  function renderMonastic() {
    var host = document.getElementById("chartMonastic");
    if (!host) return;
    var rows = K.monastic.slice().sort(function (a, b) { return b.share - a.share; });
    var W = 720, H = 330, m = { l: 138, r: 84, t: 24, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rowH = ih / rows.length;
    var lo = Math.log(0.01) / Math.LN10, hi = Math.log(20) / Math.LN10;
    var xs = function (v) { return m.l + (Math.log(v) / Math.LN10 - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Monastics as a share of the surrounding population, log scale">';
    [0.01, 0.1, 1, 10].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, v + "%", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.25, h = rowH * 0.5;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.share) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + r.color + '" fill-opacity="0.16" stroke="' + r.color +
        '" stroke-opacity="0.5"/>';
      s += txt(m.l - 9, y + h * 0.75, r.name, { anchor: "end", size: 9.5, fill: "#9fb0c0" });
      s += txt(xs(r.share) + 7, y + h * 0.75, r.share < 0.1 ? r.share.toFixed(3) : r.share.toFixed(2), { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 6, "monastics as a share of the population · log scale", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].name + (rows[i].year ? ", " + rows[i].year : ""); },
      rows: function (i) {
        var r = rows[i];
        return [
          { name: "share", color: r.color, text: r.share + "%" },
          { name: "count", color: C.dim, text: r.count ? r.count.toLocaleString("en-US") : "–" },
          { name: "population", color: C.dim2, text: r.pop ? compact(r.pop) : "–" }
        ];
      }
    });
  }

  /* --------------------------------------------------------- 5. catalogue --- */
  function renderCatalogue() {
    var host = document.getElementById("chartCatalogue");
    if (!host) return;
    var W = 720, H = 320, m = { l: 44, r: 118, t: 20, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var years = D.centuries, y0 = years[0], y1 = years[years.length - 1];
    var xs = function (y) { return m.l + (y - y0) / (y1 - y0) * iw; };
    var ymax = 1;
    D.traditions.forEach(function (t) { t.v.forEach(function (v) { if (v > ymax) ymax = v; }); });
    if (D.zen) D.zen.forEach(function (v) { if (v > ymax) ymax = v; });
    ymax = Math.ceil(ymax / 200) * 200;
    var ys = function (v) { return m.t + (1 - v / ymax) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Wikidata counts of labelled contemplatives by birth century">';
    for (var g = 0; g <= 4; g++) {
      var v = ymax * g / 4;
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, Math.round(v), { anchor: "end", size: 9, fill: C.dim2 });
    }
    [700, 1000, 1300, 1600, 1900].forEach(function (y, i, arr) {
      s += txt(xs(y), m.t + ih + 15, y + "s",
        { anchor: i === arr.length - 1 ? "end" : "middle", size: 9, fill: C.dim2 });
    });
    var legend = [];
    D.traditions.forEach(function (t) {
      var pts = t.v.map(function (v, i) { return v == null ? null : [xs(years[i]), ys(v)]; });
      s += polyline(pts, t.color, { width: 1.7 });
      legend.push({ name: t.name, color: t.color });
    });
    if (D.zen) {
      var pts = D.zen.map(function (v, i) { return v == null ? null : [xs(years[i]), ys(v)]; });
      s += polyline(pts, C.dim, { width: 1.3, dash: "4 3" });
      legend.push({ name: "Zen master", color: C.dim });
    }
    s += txt(m.l, m.t - 5, "people labelled with a contemplative occupation, by birth century · a catalogue, not a census",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
    var leg = document.getElementById("legendCatalogue");
    if (leg) {
      leg.innerHTML = legend.map(function (x) {
        return "<span><i style='background:" + x.color + "'></i>" + x.name + "</span>";
      }).join("");
    }

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 30,
      xs: years.map(xs),
      label: function (i) { return years[i] + "s"; },
      rows: function (i) {
        var out = [];
        D.traditions.forEach(function (t) {
          if (t.v[i] == null) return;
          out.push({ name: t.name, color: t.color, text: String(t.v[i]) });
        });
        if (D.zen && D.zen[i] != null) out.push({ name: "Zen master", color: C.dim, text: String(D.zen[i]) });
        return out.sort(function (a, b) { return +b.text - +a.text; });
      }
    });
  }

  /* ------------------------------------------------------------ 6. funnel --- */
  function renderFunnel() {
    var host = document.getElementById("chartFunnel");
    if (!host) return;
    var Mn = K.modern;
    var rows = [
      { name: "meditate, any", v: Mn.meditateAny, color: C.mint, measured: true, derived: true },
      { name: "meditate weekly+", v: Mn.meditateWeekly, color: C.blue, measured: true },
      { name: "retreat, yearly+", v: Mn.retreatAnnual, color: C.teal, measured: true, derived: true },
      { name: "retreat, >1× a year", v: Mn.retreatYearly, color: C.amber, measured: true },
      { name: "persistent nondual", v: 0.0023, color: C.red, measured: false, band: [0.00023, 0.115] }
    ];
    var W = 720, H = 300, m = { l: 150, r: 96, t: 24, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rowH = ih / rows.length;
    var lo = Math.log(0.0001) / Math.LN10, hi = Math.log(100) / Math.LN10;
    var xs = function (v) { return m.l + (Math.log(v) / Math.LN10 - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="The practice funnel for US adults, log scale">';
    [0.001, 0.01, 0.1, 1, 10, 100].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, v + "%", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.26, h = rowH * 0.48;
      if (r.measured) {
        s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.v) - m.l).toFixed(1) +
          '" height="' + h.toFixed(1) + '" fill="' + r.color + '" fill-opacity="' + (r.derived ? "0.09" : "0.16") +
          '" stroke="' + r.color + '" stroke-opacity="0.5"' + (r.derived ? ' stroke-dasharray="2 3"' : "") + '"/>';
        s += txt(xs(r.v) + 7, y + h * 0.75, r.v + "%", { size: 9.5, fill: "#c3ccd5" });
      } else {
        /* the measured bars stop here: this row is a modelled band, drawn hollow
           and dashed so it cannot be mistaken for a survey result */
        s += '<rect x="' + xs(r.band[0]).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (xs(r.band[1]) - xs(r.band[0])).toFixed(1) +
          '" height="' + h.toFixed(1) + '" fill="' + r.color + '" fill-opacity="0.08" stroke="' + r.color +
          '" stroke-opacity="0.55" stroke-dasharray="3 3"/>';
        s += txt(xs(r.band[1]) + 7, y + h * 0.75, "0.0002–0.12%", { size: 9, fill: r.color });
      }
      s += txt(m.l - 9, y + h * 0.75, r.name, { anchor: "end", size: 9.5, fill: "#9fb0c0" });
    });
    s += txt(m.l, m.t - 5, "US adults · log scale · dashed edge = Pew's bands summed, no topline published",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].name; },
      rows: function (i) {
        var r = rows[i];
        if (r.measured) {
          var out = [{ name: "share of adults", color: r.color, text: r.v + "%" }];
          if (r.derived) out.push({ name: "figure is", color: C.dim2, text: "Pew bands, summed" });
          return out;
        }
        return [
          { name: "modelled band", color: r.color, text: "0.0002% – 0.12%" },
          { name: "source", color: C.dim, text: "no prevalence study" }
        ];
      }
    });
  }

  /* ----------------------------------------------------------- 7. fallout --- */
  function renderFallout() {
    var host = document.getElementById("chartFallout");
    if (!host) return;
    var chan = K.registers[0];
    var students = [5, state.students, 100];
    var W = 720, H = 320, m = { l: 52, r: 96, t: 20, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = chan.founded, x1 = chan.recorded;
    var xs = function (y) { return m.l + (y - x0) / (x1 - x0) * iw; };
    var max = chan.total * 100;
    var ys = function (v) { return m.t + (1 - v / max) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="People directly trained by Chan masters, 532 to 1004, under three reach assumptions">';
    for (var g = 0; g <= 4; g++) {
      var v = max * g / 4;
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, compact(v), { anchor: "end", size: 9, fill: C.dim2 });
    }
    [550, 700, 850, 1000].forEach(function (y) {
      s += txt(xs(y), m.t + ih + 15, String(y), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    var cols = [C.dim, C.mint, C.amber];
    students.forEach(function (st, si) {
      var pts = [];
      for (var y = x0; y <= x1; y += 4) {
        var frac = (y - x0) / (x1 - x0);
        var names = Math.pow(chan.total, frac);   /* the register's own growth */
        pts.push([xs(y), ys(names * st)]);
      }
      s += polyline(pts, cols[si], { width: si === 1 ? 2 : 1.4, dash: si === 1 ? null : "5 3" });
      s += txt(m.l + iw + 8, ys(chan.total * st) + 3, st + " each", { size: 9, fill: cols[si] });
    });
    s += txt(m.l, m.t - 5, "cumulative people taught, at 5, 20 and 100 students per recognised master",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 30,
      xs: (function () { var o = []; for (var y = x0; y <= x1; y += 4) o.push(xs(y)); return o; })(),
      label: function (i) { return String(x0 + i * 4); },
      rows: function (i) {
        var frac = (i * 4) / (x1 - x0);
        var names = Math.pow(chan.total, frac);
        return students.map(function (st, si) {
          return { name: st + " students each", color: cols[si], text: compact(names * st) };
        });
      }
    });
  }

  /* ------------------------------------------------------------ 8. bounds --- */
  function renderBounds() {
    var host = document.getElementById("chartBounds");
    if (!host) return;
    var adults = 6.4e9;
    var rates = [
      { key: "low", label: "0.1% of practitioners", v: 0.001, color: C.dim },
      { key: "central", label: "1%", v: 0.01, color: C.amber },
      { key: "high", label: "5%", v: 0.05, color: C.red }
    ];
    var rows = rates.map(function (r) {
      var b = M.band(adults, state.weekly, r.v);
      return { label: r.label, color: r.color, aware: b.aware, weekly: b.weekly };
    });
    var W = 720, H = 260, m = { l: 150, r: 120, t: 22, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rowH = ih / rows.length;
    var lo = Math.log(1e4) / Math.LN10, hi = Math.log(1e9) / Math.LN10;
    var xs = function (v) { return m.l + (Math.log(Math.max(1e4, v)) / Math.LN10 - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Estimated adults with persistent nondual awareness, three assumptions">';
    [1e4, 1e5, 1e6, 1e7, 1e8].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, compact(v), { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.3, h = rowH * 0.4;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.aware) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + r.color + '" fill-opacity="0.14" stroke="' + r.color +
        '" stroke-opacity="0.5"/>';
      s += txt(m.l - 9, y + h * 0.8, r.label, { anchor: "end", size: 9.5, fill: "#9fb0c0" });
      s += txt(xs(r.aware) + 7, y + h * 0.8, compact(r.aware) + " adults", { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 6, "world adults with persistent nondual awareness, modelled · not a survey",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].label; },
      rows: function (i) {
        var r = rows[i];
        return [
          { name: "adults", color: r.color, text: compact(r.aware) },
          { name: "weekly practitioners", color: C.dim, text: compact(r.weekly) },
          { name: "share of adults", color: C.dim2, text: (r.aware / adults * 100).toFixed(4) + "%" }
        ];
      }
    });
  }

  /* --------------------------------------------------------------- panels --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var chan = computed[0];
    var cards = [
      ["Chan register", "1,701", "names in the transmission genealogy, 1004 · 951 with any recorded sayings", true],
      ["Branching", chan.R.toFixed(2), "names per generation, from 1,701 over 24 generations · 52% of such lines die by chance", false],
      ["Sringeri acharyas", "36", "single succession since 820 CE · 34.5 years per generation, exactly replacement", false],
      ["Tibet, pre-1959", "10%", "of the population in monastic orders · Myanmar today 1.1%, Catholic religious 0.04%", false],
      ["US adults who meditate", "51%", "at any frequency for spiritual reasons, from Pew's own bands (23% weekly + 7% monthly + 21% less often); Pew publishes no topline", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var chan = computed[0], sri = computed[1], kar = computed[2];
    var worldLow = M.band(6.4e9, state.weekly, 0.001).aware;
    var worldHigh = M.band(6.4e9, state.weekly, 0.05).aware;
    host.innerHTML = "<h2>What the page concludes</h2>" +
      "<p><span class='tag green'>measured</span> The only records that can be counted across centuries are transmission registers, " +
      "and they measure recognition. The Chan lamp record names <b>1,701</b> people across <b>52</b> generations, of whom <b>951</b> " +
      "have a recorded word. The Sringeri line has had <b>36</b> acharyas in twelve centuries. The Karmapa has had <b>17</b> incarnations " +
      "in nine. Those are three different instruments measuring three different things, and all three count names a tradition chose to keep.</p>" +
      "<p><span class='tag amber'>derived</span> The difference between them is architecture, not depth. Chan branched: " +
      "<b>" + chan.R.toFixed(2) + "</b> names per generation, one founder becoming 1,701 over 24 generations. Sringeri and the Karmapa line " +
      "did not branch at all — each holder named exactly one successor, so <b>R = 1.00</b> and the line grows by one per generation. " +
      "A tradition that transmits to one heir produces a chain; a tradition that transmits to several produces a tree, and only the tree " +
      "can produce a thousand recognised masters. That is a statement about institutions, not about realisation.</p>" +
      "<p><span class='tag red'>chance</span> Even the tree is fragile. With a Poisson offspring distribution and a mean of " +
      "<b>" + chan.R.toFixed(2) + "</b>, <b>" + (chan.ext * 100).toFixed(0) + "%</b> of lineages die out by chance regardless of how realised " +
      "their founders were. A mean of 1.00 — the single-succession case — gives extinction probability <b>1</b>: the line survives only because " +
      "an institution guarantees the next holder. Continuity here is a constitutional fact, not a statistical one.</p>" +
      "<p><span class='tag green'>the reach</span> A recognised teacher trained a bounded number of people. At " + state.students +
      " students each, the entire Chan register touches about <b>" + compact(1701 * state.students) + "</b> people over 472 years — " +
      "<b>" + ((1701 * state.students) / M.populationAt(1000) * 100).toFixed(3) + "%</b> of the world's population in 1000. Direct transmission " +
      "is a thin channel even in its most productive tradition.</p>" +
      "<p><span class='tag dim'>unmeasured</span> What that means for nondual awareness today cannot be counted. The funnel runs from " +
      "51% of US adults who meditate at any frequency (Pew's own bands summed — it publishes no topline) to 3% who retreat more than once a year, and then stops: no survey has a denominator for persistent awakening. " +
      "Under " + (state.weekly * 100).toFixed(0) + "% of the world's adults practising weekly and 0.1–5% of them reporting it, the band is " +
      "<b>" + compact(worldLow) + " to " + compact(worldHigh) + "</b> people. That is a span of two orders of magnitude, and it is the honest width " +
      "of the evidence.</p>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2><p>Run at ingest by <code>node ingest-lineage.mjs</code>. The first two are the measurement; " +
      "the rest are the reason the page does not use the knowledge graph for its main claim.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label + " <b>" + c.value +
          "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2><p>Register counts come from the traditions' own lists; monastic counts from censuses and official " +
      "statements; the modern funnel from a single 36,908-adult survey. Each entry names its defect.</p>" +
      K.sources.map(function (s) {
        return "<div class='src'><strong>" + s.name + "</strong><span class='src-vintage'>" + s.provider + "</span>" +
          "<a href='" + s.url + "' target='_blank' rel='noopener'>source</a><p class='muted'>" + s.note + "</p></div>";
      }).join("");
  }

  function renderLimits() {
    var host = document.getElementById("limits");
    if (!host) return;
    host.innerHTML = "<h2>What this cannot do</h2><ul class='limits'>" +
      K.limits.map(function (l) { return "<li>" + l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</li>"; }).join("") +
      "</ul>";
  }

  /* ------------------------------------------------------------- controls --- */
  function slider(group, key, label, min, max, step, fmt) {
    var wrap = document.createElement("div");
    wrap.className = "lever";
    var top = document.createElement("label");
    top.className = "lever-top";
    var val = document.createElement("b");
    val.className = "lever-val";
    val.dataset.k = key;
    val.textContent = fmt(state[key]);
    top.innerHTML = "<span class='lever-name'>" + label + "</span>";
    top.appendChild(val);
    var input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = state[key];
    input.dataset.k = key;
    input.style.cssText = "width:100%;margin-top:6px;accent-color:#a9c0b4;";
    input.addEventListener("input", function () {
      state[key] = parseFloat(input.value);
      val.textContent = fmt(state[key]);
      refresh();
    });
    wrap.appendChild(top);
    wrap.appendChild(input);
    group.appendChild(wrap);
  }

  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g1 = document.createElement("details");
    g1.className = "lgroup";
    g1.open = true;
    g1.innerHTML = "<summary>Reach<i class='caret' aria-hidden='true'></i></summary>";
    slider(g1, "students", "students per recognised teacher", 5, 100, 5, function (v) { return String(v); });
    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "The one number on the page that is not sourced. A monastery bounds it below; a lifetime of teaching bounds it above.";
    g1.appendChild(note);
    host.appendChild(g1);

    var g2 = document.createElement("details");
    g2.className = "lgroup";
    g2.innerHTML = "<summary>The unmeasured step<i class='caret' aria-hidden='true'></i></summary>";
    slider(g2, "weekly", "world adults practising weekly", 0.01, 0.25, 0.005, function (v) { return (v * 100).toFixed(1) + "%"; });
    slider(g2, "rate", "of those, reporting nondual", 0.001, 0.05, 0.001, function (v) { return (v * 100).toFixed(1) + "%"; });
    host.appendChild(g2);

    var p = document.createElement("p");
    p.className = "aside-note";
    p.innerHTML = "The registers and the censuses do not move when you drag these. They set the modelled reach at the bottom of the page, " +
      "and the two of them span two orders of magnitude by themselves.";
    host.appendChild(p);
  }

  function refresh() {
    renderFallout();
    renderBounds();
    renderVerdict();
  }

  /* ----------------------------------------------------------------- init --- */
  renderKpis();
  renderVerdict();
  renderRegisters();
  renderBranch();
  renderFan();
  renderMonastic();
  renderCatalogue();
  renderFunnel();
  renderFallout();
  renderBounds();
  renderChecks();
  renderSources();
  renderLimits();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.students = 20; state.weekly = 0.05; state.rate = 0.01;
      var inputs = document.querySelectorAll("#controls input[type=range]");
      for (var i = 0; i < inputs.length; i++) {
        var k = inputs[i].dataset.k;
        inputs[i].value = state[k];
        var val = document.querySelector(".lever-val[data-k='" + k + "']");
        if (val) {
          val.textContent = k === "students" ? String(state[k])
            : (state[k] * 100).toFixed(1) + "%";
        }
      }
      refresh();
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.rt);
    state.rt = setTimeout(function () {
      renderRegisters(); renderBranch(); renderFan(); renderMonastic();
      renderCatalogue(); renderFunnel(); renderFallout(); renderBounds();
    }, 200);
  });
})();
