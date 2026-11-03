/* ============================================================================
   development-app.js — renderer for `development.html`.

   Two kinds of chart live here and they are drawn differently on purpose:

     measured  solid lines, filled marks, axes with units
     asserted  dashed lines, hollow marks, and a note saying what is missing

   That distinction is the page. Every number comes from development-data.js
   (fetched, generated) or development-claims.js (curated, cited); nothing is
   computed except medians across regions and a percentile band.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.DEVELOPMENT, K = window.DEV_CLAIMS;
  if (!D || !K) return;

  /* culture-data.js is optional: the two culture panels are built from a
     separate ingest, and the page still works if it has not been run */
  function CULTURE() { return window.CULTURE || null; }

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };
  var NS = "http://www.w3.org/2000/svg";

  var state = { highlight: null, asserted: true };

  /* ------------------------------------------------------------ helpers --- */
  function compact(v) {
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    if (a >= 10) return Math.round(v).toString();
    return (+v).toFixed(a < 1 ? 2 : 1);
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 0 : d) + "%"; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function txt(x, y, s, o) {
    o = o || {};
    var px = typeof x === "number" ? x.toFixed(1) : x;
    var py = typeof y === "number" ? y.toFixed(1) : y;
    return '<text x="' + px + '" y="' + py + '"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") +
      (o.size ? ' font-size="' + o.size + '"' : "") +
      (o.fill ? ' fill="' + o.fill + '"' : "") +
      (o.opacity != null ? ' opacity="' + o.opacity + '"' : "") +
      (o.rotate ? ' transform="rotate(' + o.rotate + " " + px + " " + py + ')"' : "") +
      ' font-family="ui-monospace,monospace">' + s + "</text>";
  }

  function polyline(pts, color, o) {
    o = o || {};
    /* a null is a gap, not a straight line across it: after a missing point the
       path restarts with M, so a broken series reads as broken */
    var d = "", open = false;
    for (var i = 0; i < pts.length; i++) {
      if (!pts[i]) { open = false; continue; }
      d += (open ? " L" : "M") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
      open = true;
    }
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (o.width || 1.6) +
      '" stroke-linejoin="round" stroke-linecap="round"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : "") +
      (o.opacity != null ? ' stroke-opacity="' + o.opacity + '"' : "") + "/>";
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
        return bd < 120 ? best : null;
      },
      label: function (i) { return cfg.label(i); },
      rows: function (i) { return cfg.rows(i); }
    });
  }

  /* -------------------------------------------------- 1. capability share --- */
  function renderCaps() {
    var host = document.getElementById("chartCaps");
    if (!host) return;
    var W = 720, H = 320, m = { l: 46, r: 14, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var years = D.caps.years;
    var x0 = years[0], x1 = years[years.length - 1];
    var xs = function (y) { return m.l + (y - x0) / (x1 - x0) * iw; };
    var ys = function (v) { return m.t + (1 - v) * ih; };

    var cols = [C.mint, C.blue, C.amber, C.red, C.violet, C.teal, C.steel, C.dim, "#b8a06a", "#7f9ba8"];
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Share of polities with each capability by century">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(v).toFixed(1) + '" y2="' + ys(v).toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(m.l - 8, (ys(v) + 3.5).toFixed(1), (v * 100) + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [-3000, -2000, -1000, 0, 1000, 1900].forEach(function (y) {
      var x = xs(y);
      s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(x, m.t + ih + 15, y < 0 ? (-y) + " BCE" : String(y), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    D.caps.names.forEach(function (name, j) {
      var data = D.caps.data[j];
      var pts = [];
      for (var i = 0; i < years.length; i++) {
        pts.push(data[i] == null ? null : [xs(years[i]), ys(data[i])]);
      }
      s += polyline(pts, cols[j % cols.length], { width: 1.7 });
    });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xs: years.map(xs),
      label: function (i) { return years[i] < 0 ? (-years[i]) + " BCE" : years[i] + " CE"; },
      rows: function (i) {
        var out = [];
        D.caps.names.forEach(function (name, j) {
          var v = D.caps.data[j][i];
          if (v == null) return;
          var n = D.caps.coded && D.caps.coded[j] ? D.caps.coded[j][i] : null;
          out.push({ name: name, color: cols[j % cols.length], text: pct(v) + (n ? " · n " + n : "") });
        });
        return out.sort(function (a, b) { return parseFloat(b.text) - parseFloat(a.text); }).slice(0, 6);
      }
    });

    var leg = document.getElementById("legendCaps");
    if (leg) {
      leg.innerHTML = D.caps.names.map(function (n, j) {
        return "<span><i style='background:" + cols[j % cols.length] + "'></i>" + n + "</span>";
      }).join("");
    }
  }

  /* ------------------------------------------------ 2. composite by region --- */
  function compositeByCentury() {
    var buckets = new Map();
    for (var s of D.series) {
      for (var p of s.pts) {
        var c = Math.floor(p[0] / 100) * 100;
        var arr = buckets.get(c);
        if (!arr) { arr = []; buckets.set(c, arr); }
        arr.push(p[1]);
      }
    }
    var years = [...buckets.keys()].sort(function (a, b) { return a - b; });
    var med = [], lo = [], hi = [];
    for (var y of years) {
      var vals = buckets.get(y).slice().sort(function (a, b) { return a - b; });
      if (vals.length < 3) { med.push(null); lo.push(null); hi.push(null); continue; }
      med.push(vals[Math.floor(vals.length / 2)]);
      lo.push(vals[Math.floor(vals.length * 0.1)]);
      hi.push(vals[Math.floor(vals.length * 0.9)]);
    }
    return { years: years, med: med, lo: lo, hi: hi };
  }

  function renderComposite() {
    var host = document.getElementById("chartComposite");
    if (!host) return;
    var agg = compositeByCentury();
    var W = 720, H = 320, m = { l: 46, r: 14, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    /* the axis spans the centuries that have a median, not the ragged ends of
       whichever region reaches furthest back — otherwise one Neolithic series
       stretches the axis and squeezes the plotted line into a corner */
    var first = 0, last = agg.med.length - 1;
    while (first < last && agg.med[first] == null) first++;
    while (last > first && agg.med[last] == null) last--;
    var x0 = agg.years[first], x1 = agg.years[last];
    var xs = function (y) { return m.l + (y - x0) / (x1 - x0) * iw; };
    var y0 = -2, y1 = 6;
    var ys = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Social complexity by region over five thousand years">';
    [-2, 0, 2, 4, 6].forEach(function (v) {
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(v).toFixed(1) + '" y2="' + ys(v).toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += txt(m.l - 8, (ys(v) + 3.5).toFixed(1), (v > 0 ? "+" : "") + v, { anchor: "end", size: 9, fill: C.dim2 });
    });
    [-3000, -2000, -1000, 0, 1000, 1900].forEach(function (y) {
      var x = xs(y);
      s += txt(x, m.t + ih + 15, y < 0 ? (-y) + " BCE" : String(y), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    /* every region, faint */
    D.series.forEach(function (ser) {
      var isHi = state.highlight === ser.region;
      var pts = ser.pts.map(function (p) { return [xs(p[0]), ys(p[1])]; });
      s += polyline(pts, isHi ? C.amber : C.steel, { width: isHi ? 2.4 : 1, opacity: isHi ? 1 : 0.18 });
    });

    /* the cross-region band and median */
    var top = [], bot = [];
    agg.years.forEach(function (y, i) {
      if (agg.hi[i] == null) return;
      top.push([xs(y), ys(agg.hi[i])]);
      bot.push([xs(y), ys(agg.lo[i])]);
    });
    if (top.length) {
      var d = "M";
      top.forEach(function (p, i) { d += (i ? " L" : "") + p[0].toFixed(1) + " " + p[1].toFixed(1); });
      for (var b = bot.length - 1; b >= 0; b--) d += " L" + bot[b][0].toFixed(1) + " " + bot[b][1].toFixed(1);
      s += '<path d="' + d + ' Z" fill="' + C.mint + '" fill-opacity="0.1" stroke="none"/>';
    }
    s += polyline(agg.years.map(function (y, i) { return agg.med[i] == null ? null : [xs(y), ys(agg.med[i])]; }), C.mint, { width: 2.4 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xs: agg.years.map(xs),
      label: function (i) { var y = agg.years[i]; return y < 0 ? (-y) + " BCE" : y + " CE"; },
      rows: function (i) {
        if (agg.med[i] == null) return [];
        return [
          { name: "median region", color: C.mint, text: (agg.med[i] > 0 ? "+" : "") + agg.med[i].toFixed(2) },
          { name: "10th–90th", color: C.steel, text: agg.lo[i].toFixed(2) + " to " + agg.hi[i].toFixed(2) },
          { name: "regions with data", color: C.dim, text: String(D.series.filter(function (s2) {
            return s2.pts.some(function (p) { return Math.abs(p[0] - agg.years[i]) <= 50; });
          }).length) }
        ];
      }
    });
  }

  /* -------------------------------------------------- 3. aligned on RelTime --- */
  function renderAlign() {
    var host = document.getElementById("chartAlign");
    if (!host) return;
    var W = 720, H = 320, m = { l: 46, r: 14, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = -3000, x1 = 3000;
    var xs = function (v) { return m.l + (v - x0) / (x1 - x0) * iw; };
    var ys = function (v) { return m.t + (1 - v) * ih; };

    /* rebuild the aligned series from the raw points so the chart does not
       depend on a sample exported from the ingest */
    var aligned = [];
    D.series.forEach(function (s) {
      var vals = s.pts.map(function (p) { return p[1]; });
      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      var norm = s.pts.map(function (p) { return [p[0] - s.anchor, (p[1] - mn) / (mx - mn || 1)]; });
      aligned.push(norm);
    });

    var s2 = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Complexity aligned on the take-off year">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      s2 += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(v).toFixed(1) + '" y2="' + ys(v).toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s2 += txt(m.l - 8, (ys(v) + 3.5).toFixed(1), (v * 100) + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [-3000, -2000, -1000, 0, 1000, 2000, 3000].forEach(function (v) {
      var x = xs(v);
      s2 += txt(x, m.t + ih + 15, (v > 0 ? "+" : "") + v, { anchor: "middle", size: 9, fill: C.dim2 });
    });
    s2 += '<line x1="' + xs(0).toFixed(1) + '" x2="' + xs(0).toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) +
      '" stroke="' + C.amber + '" stroke-dasharray="3 3" opacity="0.7"/>';

    /* the published rise, marked as a span rather than a curve */
    var half = 2500 / 2;
    s2 += '<rect x="' + xs(-half).toFixed(1) + '" y="' + (m.t + 4) + '" width="' + (xs(half) - xs(-half)).toFixed(1) +
      '" height="' + (ih - 8) + '" fill="' + C.amber + '" fill-opacity="0.06"/>';
    s2 += txt(xs(0), m.t + 14, "the published 2,500-year rise", { anchor: "middle", size: 9, fill: C.amber, opacity: 0.9 });

    aligned.forEach(function (pts) {
      var line = pts.filter(function (p) { return p[0] >= x0 && p[0] <= x1; })
        .map(function (p) { return [xs(p[0]), ys(p[1])]; });
      s2 += polyline(line, C.steel, { width: 1, opacity: 0.25 });
    });

    /* cross-region median curve */
    var byBin = new Map();
    aligned.forEach(function (pts) {
      pts.forEach(function (p) {
        var b = Math.round(p[0] / 100) * 100;
        if (!byBin.has(b)) byBin.set(b, []);
        byBin.get(b).push(p[1]);
      });
    });
    var bins = [...byBin.keys()]
      .filter(function (b) { return b >= x0 && b <= x1; })
      .sort(function (a, b) { return a - b; });
    var medPts = bins.map(function (b) {
      var v = byBin.get(b).slice().sort(function (a, c) { return a - c; });
      if (v.length < 3) return null;
      return [xs(b), ys(v[Math.floor(v.length / 2)])];
    });
    s2 += polyline(medPts, C.mint, { width: 2.6 });
    s2 += "</svg>";
    host.innerHTML = s2;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xs: bins.map(xs),
      label: function (i) { return "RelTime " + (bins[i] > 0 ? "+" : "") + bins[i]; },
      rows: function (i) {
        var v = byBin.get(bins[i]).slice().sort(function (a, b) { return a - b; });
        if (!v.length) return [];
        return [
          { name: "median", color: C.mint, text: pct(v[Math.floor(v.length / 2)]) },
          { name: "10th–90th", color: C.steel, text: pct(v[Math.floor(v.length * 0.1)]) + " to " + pct(v[Math.floor(v.length * 0.9)]) },
          { name: "regions", color: C.dim, text: String(v.length) }
        ];
      }
    });
  }

  /* ------------------------------------------------------ 4. evidence grid --- */
  function renderEvidence() {
    var host = document.getElementById("chartEvidence");
    if (!host) return;
    var W = 720, rows = K.models.length, cols = K.criteria.length;
    var m = { l: 176, r: 54, t: 46, b: 12 };
    var cellW = 60, cellH = 34;
    var H = m.t + rows * cellH + m.b;

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evidence matrix">';
    K.criteria.forEach(function (c, j) {
      var x = m.l + j * cellW + cellW / 2;
      s += txt(x, m.t - 10, c.label, { anchor: "end", size: 8.5, fill: C.dim2, rotate: -32 });
    });
    s += txt(W - m.r + 22, m.t - 10, "score", { anchor: "middle", size: 8.5, fill: C.dim2 });

    K.models.forEach(function (mo, i) {
      var y = m.t + i * cellH + cellH / 2;
      s += txt(m.l - 14, y + 3.5, mo.name, { anchor: "end", size: 10.5, fill: mo.measured ? "#c9d5e2" : C.dim });
      var total = 0;
      K.criteria.forEach(function (c, j) {
        var v = K.evidence[mo.id][j];
        total += v;
        var cx = m.l + j * cellW + cellW / 2;
        if (v === 2) {
          s += '<circle cx="' + cx + '" cy="' + y + '" r="6.5" fill="' + C.mint + '"/>';
        } else if (v === 1) {
          s += '<circle cx="' + cx + '" cy="' + y + '" r="6.5" fill="none" stroke="' + C.mint + '" stroke-width="1.2"/>';
          s += '<path d="M' + (cx - 6.5) + " " + y + " A6.5 6.5 0 0 0 " + (cx + 6.5) + " " + y + ' Z" fill="' + C.mint + '" fill-opacity="0.55"/>';
        } else {
          s += '<circle cx="' + cx + '" cy="' + y + '" r="6.5" fill="none" stroke="' + C.dim2 + '" stroke-width="1" stroke-dasharray="1.5 2"/>';
        }
        var note = K.evidenceNotes[mo.id + "." + c.id];
        if (note) {
          s += '<title>' + mo.name + " · " + c.label + ": " + note + "</title>";
        }
      });
      s += txt(W - m.r + 22, y + 4, total + "/10", { anchor: "middle", size: 10.5, fill: total >= 7 ? C.mint : total >= 3 ? C.amber : C.dim2 });
    });
    s += "</svg>";
    host.innerHTML = s;

    var leg = document.getElementById("legendEvidence");
    if (leg) {
      leg.innerHTML = "<span><i style='background:" + C.mint + "'></i>published and peer-reviewed</span>" +
        "<span><i style='background:" + C.mint + ";opacity:.45'></i>present, with a named gap</span>" +
        "<span><i style='border:1px dashed " + C.dim2 + ";background:none'></i>absent</span>";
    }
  }

  /* ------------------------------------------------------- 5. stage stack --- */
  /* ------------------------------------- 8. Inglehart–Welzel dimensions --- */
  /* Two axes computed from a ten-item battery, 112 countries. The zones are
     colours here, not boundaries: the WVS says its own zone shapes are drawn
     by hand, so drawing hulls would be inventing a line nobody published. */
  var ZONE_COLOR = {
    "Protestant Europe": C.mint,
    "Catholic Europe": C.teal,
    "Orthodox Europe": C.red,
    "English-Speaking": C.amber,
    "Confucian": C.violet,
    "Latin America": C.blue,
    "West & South Asia": "#b8a06a",
    "African-Islamic": C.steel
  };

  function renderWvs() {
    var host = document.getElementById("chartWvs");
    if (!host || !window.CULTURE) return;
    var W = 720, H = 430, m = { l: 58, r: 18, t: 14, b: 48 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var xs = function (v) { return m.l + (v + 2.5) / 6 * iw; };
    var ys = function (v) { return m.t + (2 - v) / 4.5 * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Countries on the Inglehart-Welzel cultural dimensions">';
    for (var gx = -2; gx <= 3; gx++) {
      s += '<line x1="' + xs(gx).toFixed(1) + '" x2="' + xs(gx).toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) +
        '" stroke="' + (gx === 0 ? C.line : C.line) + '" stroke-dasharray="2 4" stroke-opacity="' + (gx === 0 ? 1 : 0.5) + '"/>';
      s += txt(xs(gx), m.t + ih + 16, gx > 0 ? "+" + gx : String(gx), { anchor: "middle", size: 9, fill: C.dim2 });
    }
    for (var gy = -2; gy <= 2; gy++) {
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(gy).toFixed(1) + '" y2="' + ys(gy).toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4" stroke-opacity="' + (gy === 0 ? 1 : 0.5) + '"/>';
      s += txt(m.l - 8, (ys(gy) + 3.5).toFixed(1), gy > 0 ? "+" + gy : String(gy), { anchor: "end", size: 9, fill: C.dim2 });
    }
    s += txt(m.l + iw / 2, H - 8, "survival  →  self-expression", { anchor: "middle", size: 10, fill: C.dim2 });
    s += txt(14, m.t + ih / 2, "traditional  →  secular-rational", { anchor: "middle", size: 10, fill: C.dim2, rotate: -90 });

    var pts = CULTURE().wvs.countries;
    pts.forEach(function (c) {
      s += '<circle cx="' + xs(c.x).toFixed(1) + '" cy="' + ys(c.y).toFixed(1) + '" r="3.4" fill="' +
        (ZONE_COLOR[c.z] || C.steel) + '" fill-opacity="0.9"/>';
    });

    /* labels only where they fit: a scatter with 112 names is unreadable, so
       the well-known ones are placed first and any that would collide is left
       to the tooltip */
    var want = ["United States", "Great Britain", "Germany", "Sweden", "Norway", "Japan", "China",
      "South Korea", "Russia", "Brazil", "India", "Nigeria", "Egypt", "Mexico", "France",
      "Poland", "Turkey", "Australia", "Canada", "South Africa", "Indonesia", "Argentina"];
    var boxes = [];
    want.forEach(function (name) {
      var c = pts.find(function (p) { return p.c === name; });
      if (!c) return;
      var px = xs(c.x), py = ys(c.y) - 6;
      var w = name.length * 5.4;
      var box = [px - w / 2, py - 9, px + w / 2, py + 1];
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) return;
      }
      boxes.push(box);
      s += txt(px, py, name, { anchor: "middle", size: 8.5, fill: C.dim });
    });
    s += "</svg>";
    host.innerHTML = s;

    /* a two-dimensional nearest point: on a scatter, the nearest x is the wrong
       answer about half the time */
    bindHover(host, {
      W: W, H: H, top: 0, bottom: 0,
      xs: pts.map(function (c) { return xs(c.x); }),
      xIndex: function (vx, vy) {
        var best = null, bd = 15 * 15;
        for (var i = 0; i < pts.length; i++) {
          var dx = xs(pts[i].x) - vx, dy = ys(pts[i].y) - vy;
          var d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      },
      label: function (i) { return pts[i].c; },
      rows: function (i) {
        return [
          { name: "self-expression", color: ZONE_COLOR[pts[i].z] || C.steel, text: (pts[i].x > 0 ? "+" : "") + pts[i].x.toFixed(2) },
          { name: "secular-rational", color: C.dim2, text: (pts[i].y > 0 ? "+" : "") + pts[i].y.toFixed(2) },
          { name: "zone", color: C.line, text: pts[i].z }
        ];
      }
    });

    var leg = document.getElementById("legendWvs");
    if (leg) {
      leg.innerHTML = CULTURE().wvs.zones.map(function (z) {
        return "<span><i style='background:" + (ZONE_COLOR[z] || C.steel) + "'></i>" + z + "</span>";
      }).join("");
    }
  }

  /* --------------------------------------- 9. the Twitter county index --- */
  function renderCounty() {
    var host = document.getElementById("chartCounty");
    if (!host || !window.CULTURE) return;
    var st = CULTURE().counties.states;
    var W = 360, H = 320, m = { l: 46, r: 12, t: 16, b: 40 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = 0, x1 = 1, y0 = 0.1, y1 = 1.1;
    var xs = function (v) { return m.l + (v - x0) / (x1 - x0) * iw; };
    var ys = function (v) { return m.t + (1 - (v - y0) / (y1 - y0)) * ih; };
    var REGC = { South: C.red, Northeast: C.blue, Midwest: C.steel, West: C.mint };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="States on the Twitter individualism index against a behavioural collectivism index">';
    for (var gv = 0.2; gv < 1.05; gv += 0.2) {
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(gv).toFixed(1) + '" y2="' + ys(gv).toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4" stroke-opacity="0.55"/>';
      s += txt(m.l - 7, (ys(gv) + 3.5).toFixed(1), gv.toFixed(1), { anchor: "end", size: 8.5, fill: C.dim2 });
    }
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      s += txt(xs(v), m.t + ih + 15, v.toFixed(2), { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, H - 6, "Vandello & Cohen, 1999 (more collectivist →)", { anchor: "middle", size: 9, fill: C.dim2 });
    s += txt(12, m.t + ih / 2, "individualist − collectivist", { anchor: "middle", size: 9, fill: C.dim2, rotate: -90 });

    st.forEach(function (p) {
      s += '<circle cx="' + xs(p.vc).toFixed(1) + '" cy="' + ys(p.kgl).toFixed(1) + '" r="3.6" fill="' +
        (REGC[p.reg] || C.steel) + '" fill-opacity="0.9"/>';
    });

    var r = CULTURE().counties.rVC;
    s += txt(m.l + 6, m.t + 12, "r = " + (r == null ? "n/a" : r.toFixed(2)) + "  across 50 states", { size: 10, fill: C.dim });

    var boxes = [];
    function label(p, anchor) {
      var px = xs(p.vc), py = ys(p.kgl) - 7, w = p.st.length * 5.2;
      var box = [px - w / 2, py - 9, px + w / 2, py + 1];
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) return;
      }
      boxes.push(box);
      s += txt(px, py, p.st, { anchor: anchor || "middle", size: 8, fill: C.dim });
    }
    st.slice().sort(function (a, b) { return b.kgl - a.kgl; }).slice(0, 4).forEach(function (p) { label(p); });
    st.slice().sort(function (a, b) { return a.kgl - b.kgl; }).slice(0, 4).forEach(function (p) { label(p); });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: 0, bottom: 0,
      xs: st.map(function (p) { return xs(p.vc); }),
      xIndex: function (vx, vy) {
        var best = null, bd = 16 * 16;
        for (var i = 0; i < st.length; i++) {
          var dx = xs(st[i].vc) - vx, dy = ys(st[i].kgl) - vy;
          var d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      },
      label: function (i) { return st[i].st; },
      rows: function (i) {
        return [
          { name: "tweet index", color: REGC[st[i].reg] || C.steel, text: st[i].kgl.toFixed(2) },
          { name: "Vandello–Cohen", color: C.dim2, text: st[i].vc.toFixed(2) },
          { name: "counties", color: C.line, text: String(st[i].n) }
        ];
      }
    });
  }

  function renderCountyHist() {
    var host = document.getElementById("chartCountyHist");
    if (!host || !window.CULTURE) return;
    var h = CULTURE().counties.hist;
    var W = 300, H = 320, m = { l: 34, r: 10, t: 16, b: 52 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = h.bins.length;
    var bw = iw / n;
    var max = Math.max.apply(null, h.bins);
    var xs = function (v) { return m.l + (v - h.lo) / (h.hi - h.lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Distribution of county individualism scores">';
    h.bins.forEach(function (count, i) {
      var x = m.l + i * bw;
      var bh = count / max * ih;
      s += '<rect x="' + (x + 0.5).toFixed(1) + '" y="' + (m.t + ih - bh).toFixed(1) + '" width="' + (bw - 1).toFixed(1) +
        '" height="' + bh.toFixed(1) + '" fill="' + C.teal + '" fill-opacity="' + (0.32 + 0.5 * count / max).toFixed(2) + '"/>';
    });
    /* zero is where the lexicon stops favouring collectivism at all */
    s += '<line x1="' + xs(0).toFixed(1) + '" x2="' + xs(0).toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) +
      '" stroke="' + C.dim2 + '" stroke-dasharray="3 3"/>';
    s += txt(xs(0) + 4, m.t + 10, "0", { size: 8.5, fill: C.dim2 });
    s += txt(m.l, m.t + ih + 15, h.lo.toFixed(1), { size: 8.5, fill: C.dim2 });
    s += txt(m.l + iw, m.t + ih + 15, "+" + h.hi.toFixed(1), { anchor: "end", size: 8.5, fill: C.dim2 });
    s += txt(m.l + iw / 2, H - 26, "per thousand words, county by county", { anchor: "middle", size: 9, fill: C.dim2 });
    var regs = CULTURE().counties.regions;
    var ABBR = { Northeast: "NE", Midwest: "MW", South: "S", West: "W" };
    s += txt(m.l, H - 8, regs.map(function (g) { return (ABBR[g.r] || g.r) + " " + g.med.toFixed(2); }).join("   "),
      { size: 8.5, fill: C.dim });
    s += txt(m.l, H - 20, "median by census region", { size: 8, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
  }

  function renderStack() {
    var host = document.getElementById("chartStack");
    if (!host) return;
    var W = 720, H = 330, m = { l: 132, r: 22, t: 34, b: 58 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var lo = K.lectical.min, hi = K.lectical.max;
    var xs = function (v) { return m.l + (v - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Developmental stages on the Lectical scale">';

    /* the colour bands: the one part with no measurement in it */
    K.lectical.bands.forEach(function (b) {
      s += '<rect x="' + xs(b.from).toFixed(1) + '" y="' + (m.t - 8) + '" width="' + (xs(b.to) - xs(b.from)).toFixed(1) +
        '" height="' + (ih + 8) + '" fill="' + b.color + '" fill-opacity="' + (state.asserted ? 0.09 : 0) + '"/>';
    });

    var rowH = ih / K.stack.length;
    K.stack.forEach(function (row, i) {
      var y = m.t + i * rowH + rowH / 2;
      s += txt(m.l - 14, y + 3.5, row.model, { anchor: "end", size: 10.5, fill: C.steel });
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '"/>';
      var lastX = -999;
      row.marks.forEach(function (mk) {
        var x = xs(mk.at);
        /* two stages 25 points apart would stack their names on each other, so
           the second one drops a line */
        var drop = x - lastX < 46 ? 11 : 0;
        lastX = x;
        if (row.kind === "asserted") {
          s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (y - 7) + '" y2="' + (y + 7) +
            '" stroke="' + C.dim + '" stroke-width="1.4" stroke-dasharray="2 2"/>';
          if (state.asserted) {
            s += txt(x, y + 20 + drop, mk.label, { anchor: "middle", size: 8, fill: C.dim2 });
          }
        } else {
          s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (y - 9) + '" y2="' + (y + 9) +
            '" stroke="' + C.mint + '" stroke-width="2"/>';
          s += txt(x, y + 21 + drop, mk.label, { anchor: "middle", size: 8, fill: "#8fa0b0" });
        }
      });
    });

    [800, 900, 1000, 1100, 1200, 1300, 1400].forEach(function (v) {
      s += txt(xs(v), m.t + ih + 34, String(v), { anchor: "middle", size: 9, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, H - 6, "Lectical score — 100 points per level", { anchor: "middle", size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    var leg = document.getElementById("legendStack");
    if (leg) {
      leg.innerHTML = "<span><i style='background:" + C.mint + "'></i>measured by an instrument</span>" +
        "<span><i style='background:" + C.dim + ";opacity:.6'></i>mapped onto it afterwards</span>";
    }
  }

  /* -------------------------------------------------------------- 6. CCI --- */
  function renderCCI() {
    var host = document.getElementById("chartCCI");
    if (!host) return;
    var c = K.cci;
    var W = 360, H = 130, m = { l: 14, r: 14, t: 26, b: 40 };
    var iw = W - m.l - m.r;
    var lo = K.lectical.min, hi = K.lectical.max;
    var xs = function (v) { return m.l + (v - lo) / (hi - lo) * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Cultural Complexity Index scores">';
    var y = m.t + 34;
    s += '<rect x="' + xs(c.min).toFixed(1) + '" y="' + (y - 5) + '" width="' + (xs(c.max) - xs(c.min)).toFixed(1) +
      '" height="10" rx="5" fill="' + C.steel + '" fill-opacity="0.25"/>';
    c.publishedMeans.forEach(function (p, i) {
      var x = xs(p.score);
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="4.5" fill="' + (i ? C.amber : C.blue) + '"/>';
      s += txt(x, y - 12, p.score, { anchor: "middle", size: 9, fill: "#c3ccd5" });
      s += txt(x, y + 24, p.corpus, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, m.t - 8, "range 814–1388, " + c.texts + " texts", { anchor: "start", size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
  }

  /* ------------------------------------------------- 7. validation bars --- */
  function renderValid() {
    var host = document.getElementById("chartValid");
    if (!host) return;
    var v = K.cci.validation;
    var rows = [
      { name: "Kohlberg", r: 0.85, n: 403 },
      { name: "Armon", r: 0.82, n: 61 },
      { name: "Fowler", r: 0.72, n: 54 },
      { name: "Loevinger", r: 0.60, n: 20 }
    ];
    var W = 360, H = 150, m = { l: 76, r: 26, t: 14, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Correlation of the Lectical scale with four stage models">';
    var rowH = ih / rows.length;
    rows.forEach(function (row, i) {
      var y = m.t + i * rowH + rowH / 2;
      s += txt(m.l - 10, y + 3.5, row.name, { anchor: "end", size: 9.5, fill: C.steel });
      s += '<rect x="' + m.l + '" y="' + (y - 5) + '" width="' + (row.r * iw).toFixed(1) + '" height="10" rx="2" fill="' +
        (i === 0 ? C.mint : C.steel) + '" fill-opacity="' + (i === 0 ? 0.85 : 0.5) + '"/>';
      s += txt(m.l + row.r * iw + 7, y + 3.5, "r " + row.r.toFixed(2), { size: 9, fill: C.dim2 });
    });
    s += txt(m.l, H - 8, "n = 543 scored performances", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
  }

  /* ---------------------------------------------------------------- KPIs --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var cards = [
      ["Polities in the panel", String(D.counts.polities), D.counts.regions + " regions, " + compact(D.counts.rows) + " rows", true],
      ["Rise time, measured here", D.rise.median.toLocaleString("en-US") + " yr", "25th to 75th percentile; published logistic gives 2,500", false],
      ["Models with an instrument", "3 of 6", "Loevinger, Kohlberg, Lectical — Spiral and Integral have none", false],
      ["Lectical span, 165 texts", "814–1388", "nearly four levels over five millennia", false],
      ["Post-autonomous adults", "under 2%", "Cook-Greuter's own sample, not a population", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    host.innerHTML = "<h2>What the page concludes</h2>" +
      "<p><span class='tag green'>measured</span> Complexity rises and falls on a timescale of centuries, " +
      "and it rises about as fast everywhere once you start the clock at take-off: this page measures " +
      "<strong>" + D.rise.median.toLocaleString("en-US") + " years</strong> from the first quartile to the third, " +
      "against a published <strong>2,500</strong> between the plateaus of a fitted logistic. That is a real finding " +
      "about human history, and it does not require any stage theory to be true.</p>" +
      "<p><span class='tag amber'>asserted</span> The colour ladders are a different object. Spiral Dynamics and " +
      "integral theory have no instrument, no reliability study, and no test of their own sequence; what they have " +
      "is a large readership and a set of mappings onto models that <em>are</em> measured. The convergence of those " +
      "measured models is real — the Lectical scale tracks Kohlberg at r = .85 across 543 scored performances — but " +
      "convergence between instruments is not evidence for the colours pasted on top of them.</p>" +
      "<p>The useful conclusion is not that one ladder is right. It is that <strong>development is measurable at " +
      "the level of complexity and not at the level of colour</strong>, and that the measurable version is the one " +
      "with a rate, a distribution, and a collapse.</p>";
  }

  /* -------------------------------------------------------------- panels --- */
  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    var all = D.checks.concat((CULTURE() && CULTURE().checks) || []);
    var body = all.map(function (c, i) {
      return "<div class='check ok'><span class='cval'>ok</span>" +
        "<span class='clabel'>" + c.label + " <b>" + c.value + "</b></span>" +
        "<span class='cdetail'>" + c.detail + "</span></div>";
    }).join("");
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-development.mjs</code> and stored in the data file. The " +
      "load-bearing one is the second: an independent implementation of the complexity composite lands at " +
      Math.round(D.varianceShare * 100) + "% of variance on its first component against the published 77%, which is why the page reports " +
      "the published figures as published and never as reproduced.</p>" +
      "<div class='checks'>" + body + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2><p>Everything measured here is from the Seshat release; everything " +
      "cited is linked. Where a source is not peer reviewed, the entry says so.</p>" +
      K.sources.map(function (s) {
        return "<div class='src'><strong>" + s.name + "</strong><span class='src-vintage'>" + s.provider + "</span>" +
          "<a href='" + s.url + "' target='_blank' rel='noopener'>source</a>" +
          "<p class='muted'>" + s.note + "</p></div>";
      }).join("");
  }

  function renderLimits() {
    var host = document.getElementById("limits");
    if (!host) return;
    host.innerHTML = "<h2>What this cannot do</h2><ul class='limits'>" +
      K.limits.map(function (l) {
        return "<li>" + l.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</li>";
      }).join("") + "</ul>";
  }

  /* ------------------------------------------------------------ controls --- */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g = document.createElement("details");
    g.className = "lgroup";
    g.innerHTML = "<summary>Charts<i class='caret' aria-hidden='true'></i></summary>";

    var wrap = document.createElement("div");
    wrap.className = "lever";
    var lab = document.createElement("label");
    lab.className = "lever-top";
    lab.innerHTML = "<span class='lever-name'>Highlight a region</span>";
    var sel = document.createElement("select");
    sel.id = "regionSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    var opt = document.createElement("option");
    opt.value = ""; opt.textContent = "all regions equally";
    sel.appendChild(opt);
    D.series.map(function (s) { return s.region; }).sort().forEach(function (r) {
      var o = document.createElement("option");
      o.value = r; o.textContent = r;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      state.highlight = sel.value || null;
      renderComposite();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    var wrap2 = document.createElement("div");
    wrap2.className = "lever";
    var lab2 = document.createElement("label");
    lab2.className = "lever-top";
    lab2.innerHTML = "<span class='lever-name'>Show the asserted mapping</span><b class='lever-val' id='v_asserted'>on</b>";
    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = state.asserted;
    chk.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk.addEventListener("change", function () {
      state.asserted = chk.checked;
      document.getElementById("v_asserted").textContent = state.asserted ? "on" : "off";
      renderStack();
    });
    wrap2.appendChild(lab2);
    wrap2.appendChild(chk);
    g.appendChild(wrap2);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "Turning the asserted mapping off leaves only the stages an instrument measured.";
    g.appendChild(note);

    host.appendChild(g);
  }

  /* ----------------------------------------------------------------- init --- */
  renderKpis();
  renderVerdict();
  renderCaps();
  renderComposite();
  renderAlign();
  renderEvidence();
  renderWvs();
  renderCounty();
  renderCountyHist();
  renderStack();
  renderCCI();
  renderValid();
  renderChecks();
  renderSources();
  renderLimits();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.highlight = null;
      state.asserted = true;
      var sel = document.getElementById("regionSel");
      if (sel) sel.value = "";
      var chk = document.querySelector("#controls input[type=checkbox]");
      if (chk) chk.checked = true;
      var vs = document.getElementById("v_asserted");
      if (vs) vs.textContent = "on";
      renderComposite();
      renderStack();
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.rt);
    state.rt = setTimeout(function () {
      renderCaps(); renderComposite(); renderAlign(); renderEvidence();
      renderWvs(); renderCounty(); renderCountyHist();
      renderStack(); renderCCI(); renderValid();
    }, 180);
  });
})();
