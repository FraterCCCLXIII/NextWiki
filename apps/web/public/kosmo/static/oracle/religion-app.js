/* ============================================================================
   religion-app.js — renderer for religion.html.

   Three kinds of object, drawn differently on purpose:

     fetched    solid lines, filled marks — research counts, pageviews, and the
                country pool derived from the WVS axes
     published  marks at reported points only, never interpolated — Pew, GSS,
                NHIS, NSDUH, RAND
     asserted   dashed borders, hollow cells — every part of the developmental
                map, and every trajectory the model produces

   Nothing on this page is drawn as a measurement unless it is one. The model is
   in religion-model.js and is labelled wherever it appears.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.RELIGION_DATA, K = window.RELIGION_CLAIMS, M = window.RELIGION_MODEL;
  if (!D || !K || !M) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0", gold: "#e2d6ae"
  };

  var state = { p: {}, horizon: 2200, scenario: "baseline", carrier: 0.62, centre: 0.25 };
  for (var k in M.BASELINE) state.p[k] = M.BASELINE[k];
  state.p.start = M.BASELINE.start.slice();

  var SCENARIOS = {
    baseline: { label: "Baseline — institutions as they are", set: {} },
    update: { label: "Traditions update", set: { update: 1.4 } },
    reform: { label: "Reformation plus capacity", set: { update: 1.7, capScale: 2.0 } },
    stalled: { label: "Institutions stall", set: { update: 0.75, alpha: 1.5 } },
    revival: { label: "Traditional revival", set: { update: 0.8, alpha: 1.45, fertDiff: 1.2 } }
  };

  /* ------------------------------------------------------------ helpers --- */
  function compact(v) {
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "B";
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    if (a >= 10) return Math.round(v).toString();
    if (a >= 1) return (+v).toFixed(1);
    return (+v).toFixed(a >= 0.01 ? 2 : 3);
  }
  function pct(v, d) { return v == null ? "–" : (v * 100).toFixed(d == null ? 1 : d) + "%"; }
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
      (o.weight ? ' font-weight="' + o.weight + '"' : "") +
      ' font-family="ui-monospace,monospace">' + s + "</text>";
  }

  function grid(x1, y1, x2, y2, dash) {
    return '<line x1="' + x1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y1="' + y1.toFixed(1) +
      '" y2="' + y2.toFixed(1) + '" stroke="' + C.line + '" stroke-dasharray="' + (dash || "2 4") + '"/>';
  }

  function polyline(pts, color, o) {
    o = o || {};
    /* a null is a gap, not a straight line across it */
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
        return bd < cfg.tol ? best : null;
      },
      label: function (i) { return cfg.label(i); },
      rows: function (i) { return cfg.rows(i); }
    });
  }

  /* rows are picked by vertical position: bar charts and matrices have no x
     index to snap to, and passing vx would put the card on the wrong row */
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

  /* ------------------------------------------------------- 1. composition --- */
  function renderComposition() {
    var host = document.getElementById("chartComposition");
    if (!host) return;
    var W = 720, H = 300, m = { l: 118, r: 66, t: 16, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var g = K.composition.groups, xmax = 34;
    var xs = function (v) { return m.l + v / xmax * iw; };
    var rowH = ih / g.length;
    var ys = function (i) { return m.t + rowH * (i + 0.5); };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="World religious composition, 2010 and 2020">';
    [0, 10, 20, 30].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 15, v + "%", { anchor: "middle", size: 9, fill: C.dim2 });
    });

    g.forEach(function (d, i) {
      var y = ys(i);
      s += txt(m.l - 10, y + 3.5, d.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += '<line x1="' + xs(d.a).toFixed(1) + '" x2="' + xs(d.b).toFixed(1) + '" y1="' + y.toFixed(1) +
        '" y2="' + y.toFixed(1) + '" stroke="' + d.color + '" stroke-width="2" stroke-opacity="0.35"/>';
      s += '<circle cx="' + xs(d.a).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="none" stroke="' +
        d.color + '" stroke-width="1.3" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + xs(d.b).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.2" fill="' + d.color + '"/>';
      var right = Math.max(xs(d.a), xs(d.b));
      var delta = d.b - d.a;
      s += txt(right + 9, y + 3.5, d.b.toFixed(1) + "%", { size: 10, fill: "#c3ccd5" });
      s += txt(right + 44, y + 3.5, (delta > 0 ? "+" : delta < 0 ? "−" : "±") + Math.abs(delta).toFixed(1),
        { size: 9, fill: delta > 0 ? C.mint : delta < 0 ? C.red : C.dim2 });
    });
    s += txt(m.l, m.t - 4, "2010 ○ → 2020 ●", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: g.length, x: m.l + iw,
      label: function (i) { return g[i].name; },
      rows: function (i) {
        var d = g[i];
        return [
          { name: "2010", color: d.color, dash: true, text: d.a.toFixed(1) + "%" },
          { name: "2020", color: d.color, text: d.b.toFixed(1) + "%" },
          { name: "change", color: C.dim, text: (d.b - d.a > 0 ? "+" : "") + (d.b - d.a).toFixed(1) + " pts" }
        ];
      }
    });
  }

  /* ---------------------------------------------------------- 2. switching --- */
  function renderRetention() {
    var host = document.getElementById("chartRetention");
    if (!host) return;
    var W = 720, H = 276, m = { l: 104, r: 52, t: 14, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rows = K.switching.retention.slice().sort(function (a, b) { return b.v - a.v; });
    var rowH = ih / rows.length, xmax = 100;
    var xs = function (v) { return m.l + v / xmax * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Retention by tradition, US">';
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, v + "%", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.16, h = rowH * 0.66;
      var col = r.v >= 75 ? C.mint : r.v >= 65 ? C.blue : C.amber;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.v) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + col + '" fill-opacity="0.16" stroke="' + col +
        '" stroke-opacity="0.45"/>';
      s += txt(m.l - 9, y + h * 0.72, r.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += txt(xs(r.v) + 7, y + h * 0.72, r.v + "%", { size: 10, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 3, "share of people raised in a tradition who still identify with it", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.5,
      label: function (i) { return rows[i].name; },
      rows: function (i) {
        var r = rows[i];
        return [
          { name: "retained", color: r.v >= 75 ? C.mint : r.v >= 65 ? C.blue : C.amber, text: r.v + "%" },
          { name: "lost", color: C.dim, text: (100 - r.v) + "%" }
        ];
      }
    });
  }

  function renderRatio() {
    var host = document.getElementById("chartRatio");
    if (!host) return;
    var W = 720, H = 276, m = { l: 120, r: 60, t: 14, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var rows = K.switching.ratio.slice().sort(function (a, b) { return b.out - a.out; });
    var rowH = ih / rows.length, xmax = 9;
    var xs = function (v) { return m.l + v / xmax * iw; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="People leaving for each person joining, US">';
    [0, 3, 6, 9].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, v + "×", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.16, h = rowH * 0.66;
      var col = r.out > 4 ? C.red : r.out > 2 ? C.amber : C.mint;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.out) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + col + '" fill-opacity="0.16" stroke="' + col +
        '" stroke-opacity="0.45"/>';
      s += txt(m.l - 9, y + h * 0.72, r.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += txt(xs(r.out) + 7, y + h * 0.72, r.out.toFixed(1) + "×", { size: 10, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 3, "people who leave for each one who joins", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].name; },
      rows: function (i) { return [{ name: "leave : join", color: C.red, text: rows[i].out.toFixed(1) + " : 1" }]; }
    });
  }

  /* ------------------------------------------------------------- 3. belief --- */
  function renderBelief() {
    var host = document.getElementById("chartBelief");
    if (!host) return;
    var W = 720, H = 300, m = { l: 182, r: 64, t: 22, b: 32 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var cats = K.belief.categories, xmax = 70;
    var xs = function (v) { return m.l + v / xmax * iw; };
    var rowH = ih / cats.length;
    var ys = function (i) { return m.t + rowH * (i + 0.5); };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Belief in God in the United States, 1988 and 2022">';
    [0, 20, 40, 60].forEach(function (v) {
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 15, v + "%", { anchor: "middle", size: 9, fill: C.dim2 });
    });
    cats.forEach(function (d, i) {
      var y = ys(i);
      s += txt(m.l - 10, y + 3.5, d.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += '<line x1="' + xs(d.a).toFixed(1) + '" x2="' + xs(d.b).toFixed(1) + '" y1="' + y.toFixed(1) +
        '" y2="' + y.toFixed(1) + '" stroke="' + d.color + '" stroke-width="2" stroke-opacity="0.4"/>';
      s += '<circle cx="' + xs(d.a).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.4" fill="none" stroke="' +
        d.color + '" stroke-width="1.3" stroke-dasharray="2 2"/>';
      s += '<circle cx="' + xs(d.b).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.2" fill="' + d.color + '"/>';
      s += txt(xs(d.b) + 9, y + 3.5, d.a.toFixed(1) + " → " + d.b.toFixed(1), { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 6, "GSS, 1988 ○ → 2022 ●  ·  middle categories flat at " +
      K.belief.middle[0] + "% and " + K.belief.middle[1] + "%", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: cats.length, x: m.l + iw * 0.4,
      label: function (i) { return cats[i].name; },
      rows: function (i) {
        var d = cats[i], ch = d.b - d.a;
        return [
          { name: "1988", color: d.color, dash: true, text: d.a.toFixed(1) + "%" },
          { name: "2022", color: d.color, text: d.b.toFixed(1) + "%" },
          { name: "change", color: ch > 0 ? C.amber : C.red,
            text: (ch > 0 ? "+" : "") + ch.toFixed(1) + " pts" }
        ];
      }
    });
  }

  /* ----------------------------------------------------------- 4. practice --- */
  function renderPractice() {
    var host = document.getElementById("chartPractice");
    if (!host) return;
    var P = K.practice;
    var series = [
      { name: "meditation", color: C.mint, pts: P.meditation, line: true },
      { name: "yoga", color: C.blue, pts: P.yoga, line: true },
      { name: "psilocybin, past yr", color: C.amber, pts: P.psilocybin, line: false },
      { name: "any hallucinogen", color: C.red, pts: P.hallucinogen, line: false }
    ];
    var years = [];
    series.forEach(function (s) { s.pts.forEach(function (p) { if (years.indexOf(p.year) < 0) years.push(p.year); }); });
    years.sort(function (a, b) { return a - b; });
    var W = 720, H = 320, m = { l: 44, r: 148, t: 16, b: 32 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = 2010, x1 = 2026, ymax = 20;
    var xs = function (y) { return m.l + (y - x0) / (x1 - x0) * iw; };
    var ys = function (v) { return m.t + (1 - v / ymax) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Prevalence of contemplative and psychedelic practice in the United States">';
    [0, 5, 10, 15, 20].forEach(function (v) {
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, v + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [2012, 2017, 2022, 2025].forEach(function (y) {
      s += txt(xs(y), m.t + ih + 15, String(y), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    series.forEach(function (ser, si) {
      if (ser.line) {
        var pts = ser.pts.map(function (p) { return [xs(p.year), ys(p.v)]; });
        s += polyline(pts, ser.color, { width: 1.8 });
      }
      ser.pts.forEach(function (p) {
        var open = p.flag || !ser.line;
        s += '<circle cx="' + xs(p.year).toFixed(1) + '" cy="' + ys(p.v).toFixed(1) + '" r="4"' +
          (open ? ' fill="none" stroke="' + ser.color + '" stroke-width="1.4"'
                : ' fill="' + ser.color + '"') + "/>";
      });
      var last = ser.pts[ser.pts.length - 1];
      var off = [-6, 9, -16, 17][si % 4];
      s += txt(m.l + iw + 10, ys(last.v) + off, ser.name + " " + last.v + "%",
        { size: 9, fill: ser.color });
    });
    s += txt(m.l, m.t - 4, "adults, past 12 months  ·  hollow marks are single surveys with their own denominator",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 40,
      xs: years.map(xs),
      label: function (i) { return String(years[i]); },
      rows: function (i) {
        var y = years[i], out = [];
        series.forEach(function (ser) {
          ser.pts.forEach(function (p) {
            if (p.year === y) out.push({ name: ser.name + (p.flag ? " (" + p.flag + ")" : ""),
              color: ser.color, text: p.v + "%" });
          });
        });
        if (y === 2025 && P.microdose) out.push({ name: "microdosing", color: C.violet, text: P.microdose.v + "%" });
        return out;
      }
    });
  }

  /* ----------------------------------------------------------- 5. research --- */
  function renderResearch() {
    var host = document.getElementById("chartResearch");
    if (!host) return;
    var W = 720, H = 360, m = { l: 48, r: 18, t: 16, b: 32 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var years = D.years, y0 = years[0], y1 = years[years.length - 1];
    var xs = function (y) { return m.l + (y - y0) / (y1 - y0) * iw; };
    var lo = 0, hi = 4.4;                       /* log10 counts, 1 to ~25k */
    var ys = function (n) { return m.t + (1 - (Math.log(Math.max(1, n)) / Math.LN10 - lo) / (hi - lo)) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Works per year mentioning each contemplative term, log scale">';
    [1, 10, 100, 1000, 10000].forEach(function (v) {
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, compact(v), { anchor: "end", size: 9, fill: C.dim2 });
    });
    [1950, 1975, 2000, 2024].forEach(function (y) {
      s += txt(xs(y), m.t + ih + 15, String(y), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    D.research.series.forEach(function (ser) {
      var pts = ser.v.map(function (n, i) { return n > 0 ? [xs(years[i]), ys(n)] : null; });
      s += polyline(pts, ser.color, { width: 1.7 });
    });
    s += txt(m.l, m.t - 4, "works whose title or abstract mentions the term, by publication year · log scale",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
    /* eight labels on a log axis collide wherever two terms have similar
       counts, so the names live in a legend and the values live in the card */
    var leg = document.getElementById("legendResearch");
    if (leg) {
      leg.innerHTML = D.research.series.map(function (ser) {
        return "<span><i style='background:" + ser.color + "'></i>" + ser.label + "</span>";
      }).join("");
    }

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 30,
      xs: years.map(xs),
      label: function (i) { return String(years[i]); },
      rows: function (i) {
        var out = [];
        D.research.series.forEach(function (ser) {
          if (!ser.v[i]) return;
          var sh = D.shareByYear.series.find(function (x) { return x.key === ser.key; });
          var per = sh && sh.v[i] != null ? " · " + sh.v[i].toFixed(1) + "/100k" : "";
          out.push({ name: ser.label, color: ser.color, text: compact(ser.v[i]) + per });
        });
        return out.sort(function (a, b) { return parseFloat(b.text) - parseFloat(a.text); }).slice(0, 7);
      }
    });
  }

  /* ---------------------------------------------------------- 6. attention --- */
  var MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* the pageviews API returns YYYYMM, not YYYY-MM: splitting on a hyphen gave
     an undefined month and a label that read "201507" in the corner */
  function monthLabel(mo) {
    var s = String(mo).replace("-", "");
    var y = s.slice(0, 4), m = +s.slice(4, 6);
    return MONTH[m - 1] + " " + y;
  }
  function monthShort(mo) {
    var s = String(mo).replace("-", "");
    var y = s.slice(0, 4), m = +s.slice(4, 6);
    return MONTH[m - 1] + " '" + y.slice(2);
  }

  function renderAttention() {
    var host = document.getElementById("chartAttention");
    if (!host || !D.attention) return;
    var A = D.attention;
    var W = 720, H = 340, m = { l: 44, r: 16, t: 16, b: 32 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = A.months.length;
    var xs = function (i) { return m.l + (i / (n - 1)) * iw; };
    var hi = 0;
    A.series.forEach(function (s) { s.per10k.forEach(function (v) { if (v > hi) hi = v; }); });
    var ymax = Math.ceil(hi * 10) / 10;
    var ys = function (v) { return m.t + (1 - v / ymax) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Wikipedia pageviews per 10,000 English Wikipedia views, by topic">';
    for (var g = 0; g <= 4; g++) {
      var v = ymax * g / 4;
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, v.toFixed(2), { anchor: "end", size: 9, fill: C.dim2 });
    }
    [0, 36, 72, 108, 135].forEach(function (i) {
      if (i >= n) return;
      var anchor = i === 0 ? "start" : i >= 135 ? "end" : "middle";
      s += txt(xs(i), m.t + ih + 15, monthShort(A.months[i]), { anchor: anchor, size: 9, fill: C.dim2 });
    });

    var palette = [C.mint, C.blue, C.violet, C.gold, C.teal, C.amber];
    var newCount = 0, legend = [];
    A.series.forEach(function (ser) {
      var isNew = ser.group === "new";
      var col = isNew ? palette[newCount++ % palette.length] : C.dim2;
      var pts = ser.per10k.map(function (v, i) { return v == null ? null : [xs(i), ys(v)]; });
      s += polyline(pts, col, { width: isNew ? 1.6 : 1.1, opacity: isNew ? 1 : 0.7 });
      legend.push({ label: ser.label, color: col });
    });
    s += txt(m.l, m.t - 4, "views per 10,000 English Wikipedia views · bright is the contemplative basket, grey is established religion",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
    var leg = document.getElementById("legendAttention");
    if (leg) {
      leg.innerHTML = legend.map(function (x) {
        return "<span><i style='background:" + x.color + "'></i>" + x.label + "</span>";
      }).join("");
    }

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 40,
      xs: A.months.map(function (_, i) { return xs(i); }),
      label: function (i) { return monthLabel(A.months[i]); },
      rows: function (i) {
        return A.series.map(function (ser) {
          return { name: ser.label, color: ser.group === "new" ? C.mint : C.dim2,
            text: ser.per10k[i] == null ? "–" : ser.per10k[i].toFixed(3) };
        }).sort(function (a, b) { return parseFloat(b.text) - parseFloat(a.text); }).slice(0, 7);
      }
    });
  }

  /* -------------------------------------------------------------- 7. where --- */
  function renderWhere() {
    var host = document.getElementById("chartWhere");
    if (!host) return;
    var rows = D.where.countries.slice(0, 15);
    var W = 720, H = 360, m = { l: 116, r: 96, t: 18, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var xmax = Math.ceil(rows[0].adults / 10) * 10;
    var xs = function (v) { return m.l + v / xmax * iw; };
    var rowH = ih / rows.length;

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Countries by estimated post-conventional adult population">';
    for (var g = 0; g <= 4; g++) {
      var v = xmax * g / 4;
      s += grid(xs(v), m.t, xs(v), m.t + ih);
      s += txt(xs(v), m.t + ih + 14, Math.round(v) + "M", { anchor: "middle", size: 9, fill: C.dim2 });
    }
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.18, h = rowH * 0.62;
      s += '<rect x="' + m.l + '" y="' + y.toFixed(1) + '" width="' + (xs(r.adults) - m.l).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + (r.iso === "usa" ? C.blue : C.mint) + '" fill-opacity="0.16" stroke="' +
        (r.iso === "usa" ? C.blue : C.mint) + '" stroke-opacity="0.45"/>';
      s += txt(m.l - 9, y + h * 0.78, r.c, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += txt(xs(r.adults) + 7, y + h * 0.78, r.adults.toFixed(0) + "M · " + r.share.toFixed(1) + "%",
        { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 5, "estimated post-conventional adults, " + D.where.year +
      " — derived from the WVS self-expression axis, not measured", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.4,
      label: function (i) { return rows[i].c; },
      rows: function (i) {
        var r = rows[i];
        return [
          { name: "post-conventional adults", color: C.mint, text: r.adults.toFixed(1) + "M" },
          { name: "share of adults", color: C.blue, text: r.share.toFixed(2) + "%" },
          { name: "population", color: C.dim, text: r.pop + "M" },
          { name: "zone", color: C.dim2, text: r.zone }
        ];
      }
    });
  }

  /* ------------------------------------------------------------- 8. ladder --- */
  function renderLadder() {
    var host = document.getElementById("chartLadder");
    if (!host) return;
    var T = K.traditions;
    var W = 720, H = 400, m = { l: 150, r: 18, t: 34, b: 18 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var cols = T.stages, rows = T.rows;
    var colW = iw / cols.length, rowH = ih / rows.length;

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Traditions against developmental stages, asserted">';
    cols.forEach(function (c, j) {
      s += txt(m.l + colW * (j + 0.5), m.t - 10, c, { anchor: "middle", size: 9, fill: "#8b9aab" });
    });
    var stageCol = ["#c4a373", "#8aa4be", "#a9c0b4", "#a396b3", "#e2d6ae"];

    rows.forEach(function (r, i) {
      var y = m.t + rowH * i;
      s += txt(m.l - 10, y + rowH * 0.62, r.name, { anchor: "end", size: 10, fill: "#9fb0c0" });
      r.cells.forEach(function (v, j) {
        var x = m.l + colW * j;
        s += '<rect x="' + (x + 2).toFixed(1) + '" y="' + (y + 2).toFixed(1) + '" width="' + (colW - 4).toFixed(1) +
          '" height="' + (rowH - 4).toFixed(1) + '" fill="' + stageCol[j] + '" fill-opacity="' + (0.05 + v * 0.14).toFixed(2) +
          '" stroke="' + stageCol[j] + '" stroke-opacity="' + (v ? 0.45 : 0.16) + '" stroke-dasharray="3 3"/>';
        if (v) {
          s += txt(x + colW / 2, y + rowH * 0.62, v === 3 ? "centre" : v === 2 ? "live" : "seed",
            { anchor: "middle", size: 8.5, fill: stageCol[j], opacity: 0.9 });
        }
      });
    });
    s += txt(m.l, m.t - 26, "asserted · no instrument · dashed borders mean the cell is a judgement, not a count",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    var leg = document.getElementById("legendLadder");
    if (leg) {
      leg.innerHTML = [
        ["centre of gravity", 0.47], ["live minority", 0.33],
        ["a lineage", 0.19], ["absent", 0.05]
      ].map(function (x) {
        return "<span><i style='background:rgba(169,192,180," + x[1] + ")'></i>" + x[0] + "</span>";
      }).join("");
    }

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.5,
      label: function (i) { return rows[i].name; },
      rows: function (i) {
        var r = rows[i], out = [];
        cols.forEach(function (c, j) {
          out.push({ name: c, color: stageCol[j],
            text: r.cells[j] === 3 ? "centre of gravity" : r.cells[j] === 2 ? "live minority"
              : r.cells[j] === 1 ? "a lineage" : "absent" });
        });
        out.push({ name: "next form", color: C.dim, text: r.updated });
        return out;
      }
    });
  }

  /* --------------------------------------------------------- 8b. vessel --- */
  /* A phase diagram, not a time series: the two axes are the argument, and
     only the boundary has a formula. Shading is drawn as cells so the map
     reads as four regions rather than a gradient, and the measured retention
     anchors sit on it as hollow points, not as calibration. */
  var VESSEL_COL = { carry: C.mint, hold: C.amber, outrun: C.blue, fade: C.dim };
  var VESSEL_KEYS = { carry: "carry", hold: "hold", outrun: "outrun", fade: "fade",
    "edge-carry": "carry", "edge-hold": "hold" };

  function vesselRegimeName(key) {
    var V = K.vessel;
    for (var i = 0; i < V.regimes.length; i++) if (V.regimes[i].key === key) return V.regimes[i];
    return V.regimes[0];
  }

  function renderVessel() {
    var host = document.getElementById("chartVessel");
    if (!host) return;
    var V = K.vessel;
    var W = 720, H = 360, m = { l: 54, r: 18, t: 34, b: 46 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var xs = function (c) { return m.l + c * iw; };
    var ys = function (k) { return m.t + (1 - k) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Where a tradition sits: carrier strength against centre of gravity">';

    /* region shading: 36 x 28 cells, each labelled once at its centre later */
    var nx = 36, ny = 28;
    for (var i = 0; i < nx; i++) {
      for (var j = 0; j < ny; j++) {
        var c = (i + 0.5) / nx, k = (j + 0.5) / ny;
        var rk = VESSEL_KEYS[M.vesselRegime(k, c, V)];
        s += '<rect x="' + xs(c - 0.5 / nx).toFixed(1) + '" y="' + ys(k + 0.5 / ny).toFixed(1) +
          '" width="' + (iw / nx + 0.4).toFixed(1) + '" height="' + (ih / ny + 0.4).toFixed(1) +
          '" fill="' + VESSEL_COL[rk] + '" fill-opacity="0.055"/>';
      }
    }

    /* the boundary, and its corridor */
    var curve = [], up = [], dn = [];
    for (var t = 0; t <= 1.0001; t += 0.02) {
      var need = M.vesselThreshold(t, V);
      curve.push([xs(t), ys(need)]);
      up.push([xs(t), ys(Math.min(1, need + 0.06))]);
      dn.push([xs(t), ys(Math.max(0, need - 0.06))]);
    }
    s += polyline(dn, C.dim2, { width: 6, opacity: 0.10 });
    s += polyline(curve, C.mint, { width: 1.6, dash: "5 4" });

    [0, 0.5, 1].forEach(function (v) {
      s += txt(xs(v), m.t + ih + 16, v === 0 ? "inherited" : v === 1 ? "evolutionary" : "moved",
        { anchor: v === 0 ? "start" : v === 1 ? "end" : "middle", size: 9, fill: C.dim2 });
    });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      s += txt(m.l - 8, ys(v) + 3, Math.round(v * 100) + "%", { anchor: "end", size: 8.5, fill: C.dim2 });
    });
    s += txt(W - m.r, H - 6, "centre of gravity", { anchor: "end", size: 9, fill: C.dim2 });
    s += txt(12, m.t - 14, "carrier strength", { size: 9, fill: C.dim2, anchor: "start" });

    /* the four region names, placed in the middle of each region */
    var SHORT = { carry: "carries a new centre", hold: "holds the old centre",
      outrun: "outruns the form", fade: "neither" };
    [[0.70, 0.88, "carry"], [0.26, 0.88, "hold"], [0.72, 0.22, "outrun"], [0.24, 0.18, "fade"]].forEach(function (p) {
      s += txt(xs(p[0]), ys(p[1]), SHORT[p[2]],
        { anchor: "middle", size: 9, fill: VESSEL_COL[p[2]], opacity: 0.85 });
    });

    /* measured retention anchors, hollow, with the retention itself as label */
    (V.anchors || []).forEach(function (a) {
      s += '<circle cx="' + xs(a.c).toFixed(1) + '" cy="' + ys(a.k).toFixed(1) +
        '" r="3.6" fill="none" stroke="#c3ccd5" stroke-opacity="0.75"/>';
      s += txt(xs(a.c) + 7, ys(a.k) + 3, a.name.replace(/^US /, ""), { size: 8.5, fill: "#8b9aab" });
    });

    /* the live marker: where the levers put this tradition */
    var kk = state.carrier, cc = state.centre;
    var reg = M.vesselRegime(kk, cc, V);
    var col = VESSEL_COL[VESSEL_KEYS[reg]];
    s += '<circle cx="' + xs(cc).toFixed(1) + '" cy="' + ys(kk).toFixed(1) + '" r="7" fill="none" stroke="' + col + '" stroke-width="1.5"/>';
    s += '<circle cx="' + xs(cc).toFixed(1) + '" cy="' + ys(kk).toFixed(1) + '" r="2.6" fill="' + col + '"/>';
    s += txt(m.l, m.t - 4, "asserted map · boundary = 0.35 + 0.45 × shift, and both numbers are this page's choice",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    var note = document.getElementById("vesselNote");
    if (note) {
      var need = M.vesselThreshold(cc, V);
      var r = vesselRegimeName(VESSEL_KEYS[reg]);
      note.innerHTML = "<b>" + r.name + "</b> <span class='tag dim'>" + Math.round(cc * 100) +
        "% shift · " + Math.round(kk * 100) + "% carried</span><br>" + r.body +
        "<br><span class='blurb'>At a " + Math.round(cc * 100) + "% shift the boundary sits at <b>" +
        Math.round(need * 100) + "%</b> carrier strength, with a ±6-point corridor either side of it.</span>";
    }

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: ih / 12, n: 12, x: m.l + iw * 0.5,
      label: function (i) { return "carrier " + Math.round((1 - (i + 0.5) / 12) * 100) + "%"; },
      rows: function (i) {
        var krow = 1 - (i + 0.5) / 12, out = [];
        [[0.08, "inherited"], [0.42, "moved"], [0.9, "evolutionary"]].forEach(function (pair) {
          var key = VESSEL_KEYS[M.vesselRegime(krow, pair[0], V)];
          out.push({ name: pair[1], color: VESSEL_COL[key], text: vesselRegimeName(key).name.replace(/^The vessel /, "") });
        });
        return out;
      }
    });
  }

  /* ------------------------------------------------- 8c. what carries what --- */
  function renderCarriers() {
    var host = document.getElementById("chartCarriers");
    if (!host) return;
    var V = K.vessel, modes = V.modes, rows = V.carriers;
    var W = 720, H = 380, m = { l: 168, r: 14, t: 48, b: 22 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var colW = iw / modes.length, rowH = ih / rows.length;

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Which carriers have historically carried which mode of awakening, asserted">';
    modes.forEach(function (md, j) {
      var cx = m.l + colW * (j + 0.5);
      s += txt(cx, m.t - 22, md.name, { anchor: "middle", size: 10, fill: md.color });
      s += txt(cx, m.t - 9, md.short, { anchor: "middle", size: 8, fill: C.dim2 });
    });

    rows.forEach(function (r, i) {
      var y = m.t + rowH * i;
      s += txt(m.l - 10, y + rowH * 0.62, r.name, { anchor: "end", size: 9.5, fill: "#9fb0c0" });
      r.cells.forEach(function (v, j) {
        var x = m.l + colW * j, col = modes[j].color;
        s += '<rect x="' + (x + 2).toFixed(1) + '" y="' + (y + 2).toFixed(1) + '" width="' + (colW - 4).toFixed(1) +
          '" height="' + (rowH - 4).toFixed(1) + '" fill="' + col + '" fill-opacity="' + (0.04 + v * 0.13).toFixed(2) +
          '" stroke="' + col + '" stroke-opacity="' + (v ? 0.45 : 0.14) + '" stroke-dasharray="3 3"/>';
        if (v) {
          s += txt(x + colW / 2, y + rowH * 0.62, v === 3 ? "primary" : v === 2 ? "live" : "weak",
            { anchor: "middle", size: 8, fill: col, opacity: 0.9 });
        }
      });
    });
    s += txt(m.l, m.t - 34, "asserted · dashed borders mean the cell is a judgement, not a count",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    var leg = document.getElementById("legendCarriers");
    if (leg) {
      leg.innerHTML = modes.map(function (md) {
        return "<span><i style='background:" + md.color + "'></i>" + md.name + " — " + md.evidence + "</span>";
      }).join("");
    }

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.5,
      label: function (i) { return rows[i].name; },
      rows: function (i) {
        return modes.map(function (md, j) {
          var v = rows[i].cells[j];
          return { name: md.name, color: md.color,
            text: v === 3 ? "primary carrier" : v === 2 ? "live carrier" : v === 1 ? "weak" : "does not carry it" };
        });
      }
    });
  }

  /* -------------------------------------------------------- 9. the model --- */
  function runModel(extra) {
    var p = {};
    for (var k in state.p) p[k] = state.p[k];
    p.horizon = state.horizon;
    if (extra) for (var j in extra) p[j] = extra[j];
    return M.run(p);
  }

  function renderStages() {
    var host = document.getElementById("chartStages");
    if (!host) return;
    var r = runModel();
    var W = 720, H = 380, m = { l: 40, r: 116, t: 18, b: 32 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var y0 = r.years[0], y1 = r.years[r.years.length - 1];
    var xs = function (y) { return m.l + (y - y0) / (y1 - y0) * iw; };
    var ymax = 0;
    r.shares.forEach(function (row) { row.forEach(function (v) { if (v > ymax) ymax = v; }); });
    ymax = Math.max(0.25, Math.ceil(ymax * 10) / 10);
    var ys = function (v) { return m.t + (1 - v / ymax) * ih; };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Model trajectories of each stage, 2025 to horizon">';
    for (var g = 0; g <= 4; g++) {
      var v = ymax * g / 4;
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, (v * 100).toFixed(0) + "%", { anchor: "end", size: 9, fill: C.dim2 });
    }
    if (ys(0.25) < m.t + ih && ys(0.25) > m.t) {
      s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(0.25).toFixed(1) + '" y2="' + ys(0.25).toFixed(1) +
        '" stroke="' + C.amber + '" stroke-opacity="0.5" stroke-dasharray="6 4"/>';
      s += txt(m.l + 4, ys(0.25) - 4, "25% — the committed-minority threshold", { size: 8.5, fill: C.amber, opacity: 0.8 });
    }
    [y0, 2050, 2100, 2150, y1].filter(function (y, i, a) { return y >= y0 && y <= y1 && a.indexOf(y) === i; })
      .forEach(function (y) {
        s += txt(xs(y), m.t + ih + 15, String(y), { anchor: "middle", size: 9, fill: C.dim2 });
      });

    M.STAGES.forEach(function (st, si) {
      var pts = r.shares.map(function (row, i) { return [xs(r.years[i]), ys(row[si])]; });
      s += polyline(pts, st.color, { width: 1.9 });
      var last = r.shares[r.shares.length - 1][si];
      s += txt(m.l + iw + 8, ys(last) + 3, st.name + " " + (last * 100).toFixed(1) + "%", { size: 9, fill: st.color });
    });
    s += txt(m.l, m.t - 5, "modelled shares of adults · dashed rule at the tipping threshold · not a forecast",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 26,
      xs: r.years.map(xs),
      label: function (i) { return String(r.years[i]); },
      rows: function (i) {
        return M.STAGES.map(function (st, si) {
          return { name: st.name, color: st.color, text: (r.shares[i][si] * 100).toFixed(2) + "%" };
        });
      }
    });
  }

  function renderCritical() {
    var host = document.getElementById("chartCritical");
    if (!host) return;
    var W = 720, H = 340, m = { l: 44, r: 18, t: 18, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var a0 = 1.05, a1 = 2.6, ymax = 0.7;
    var xs = function (a) { return m.l + (a - a0) / (a1 - a0) * iw; };
    var ys = function (v) { return m.t + (1 - v / ymax) * ih; };
    var advs = [
      { v: 3.5, color: C.amber, label: "3.5×" },
      { v: 4, color: C.blue, label: "4×" },
      { v: 6, color: C.mint, label: "6×" },
      { v: 8, color: C.violet, label: "8×" }
    ];

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Critical mass as a function of the conformity exponent">';
    /* the empirical anchors, drawn as bands rather than points */
    var real = K.thresholds.real;
    s += '<rect x="' + m.l + '" y="' + ys(real[1] / 100).toFixed(1) + '" width="' + iw + '" height="' +
      (ys(real[0] / 100) - ys(real[1] / 100)).toFixed(1) + '" fill="' + C.red + '" fill-opacity="0.07"/>';
    s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + ys(K.thresholds.lab / 100).toFixed(1) +
      '" y2="' + ys(K.thresholds.lab / 100).toFixed(1) + '" stroke="' + C.amber + '" stroke-dasharray="6 4" stroke-opacity="0.6"/>';
    s += txt(m.l + iw - 4, ys(K.thresholds.lab / 100) - 5, "25% · Centola, coordination game",
      { anchor: "end", size: 8.5, fill: C.amber, opacity: 0.85 });
    s += txt(m.l + iw - 4, ys(real[0] / 100) - 5, "50–65% · a real behaviour", { anchor: "end", size: 8.5, fill: C.red, opacity: 0.85 });

    [0, 0.2, 0.4, 0.6].forEach(function (v) {
      s += grid(m.l, ys(v), m.l + iw, ys(v));
      s += txt(m.l - 8, ys(v) + 3.5, (v * 100).toFixed(0) + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [1.2, 1.4, 1.6, 1.8, 2.0, 2.4].forEach(function (a) {
      s += txt(xs(a), m.t + ih + 15, a.toFixed(1), { anchor: "middle", size: 9, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, m.t + ih + 28, "conformity exponent α", { anchor: "middle", size: 9, fill: C.dim2 });

    var grid2 = [];
    advs.forEach(function (adv) {
      var pts = [];
      for (var a = a0; a <= a1 + 1e-9; a += 0.01) {
        var v = M.criticalMass(a, adv.v);
        pts.push(v == null ? null : [xs(a), ys(v)]);
        grid2.push({ a: +a.toFixed(2), adv: adv.v, v: v });
      }
      s += polyline(pts, adv.color, { width: 1.7 });
    });
    s += txt(m.l, m.t - 5, "s* = the share below which a worldview declines from every start · advantage = κ/δ",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
    var leg = document.getElementById("legendCritical");
    if (leg) {
      leg.innerHTML = advs.map(function (a) {
        return "<span><i style='background:" + a.color + "'></i>" + a.label + " advantage (κ/δ)</span>";
      }).join("");
    }

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 24,
      xs: (function () { var out = []; for (var a = a0; a <= a1 + 1e-9; a += 0.01) out.push(xs(a)); return out; })(),
      label: function (i) { return "α " + (a0 + i * 0.01).toFixed(2); },
      rows: function (i) {
        var a = a0 + i * 0.01;
        return advs.map(function (adv) {
          var v = M.criticalMass(a, adv.v);
          return { name: adv.label + " advantage", color: adv.color,
            text: v == null ? "no threshold — declines" : (v * 100).toFixed(1) + "%" };
        });
      }
    });
  }

  function renderEvents() {
    var host = document.getElementById("chartEvents");
    if (!host) return;
    var W = 720, H = 340, m = { l: 48, r: 96, t: 18, b: 36 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n0 = 1e6, n1 = 2e9;
    var xs = function (n) { return m.l + (Math.log(n / n0) / Math.LN10) / (Math.log(n1 / n0) / Math.LN10) * iw; };
    var e0 = 1e-3, e1 = 1e5;
    var ys = function (e) { return m.t + (1 - (Math.log(e / e0) / Math.LN10) / (Math.log(e1 / e0) / Math.LN10)) * ih; };
    var gammas = [
      { g: 1.0, color: C.blue },
      { g: 1.5, color: C.mint },
      { g: 2.0, color: C.amber }
    ];

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Expected collective awakening events per century against the number of nondual adults">';
    [1e-3, 1e-2, 1e-1, 1, 10, 100, 1000, 10000].forEach(function (e) {
      s += grid(m.l, ys(e), m.l + iw, ys(e));
      s += txt(m.l - 8, ys(e) + 3.5, e >= 1 ? compact(e) : String(e), { anchor: "end", size: 9, fill: C.dim2 });
    });
    [1e6, 1e7, 1e8, 1e9].forEach(function (n) {
      s += txt(xs(n), m.t + ih + 15, compact(n), { anchor: "middle", size: 9, fill: C.dim2 });
    });

    gammas.forEach(function (gm) {
      var pts = [];
      for (var e = Math.log(n0); e <= Math.log(n1); e += 0.08) {
        var n = Math.exp(e);
        pts.push([xs(n), ys(Math.pow(n / state.p.eventUnit, gm.g))]);
      }
      s += polyline(pts, gm.color, { width: 1.7 });
      s += txt(m.l + iw + 8, ys(Math.pow(n1 / state.p.eventUnit, gm.g)) + 3, "γ " + gm.g.toFixed(1),
        { size: 9, fill: gm.color });
    });

    var base = runModel();
    var i2100 = base.years.indexOf(2100);
    if (i2100 >= 0) {
      var nb = base.heads[i2100], ev = Math.pow(nb / state.p.eventUnit, 2);
      s += '<circle cx="' + xs(nb).toFixed(1) + '" cy="' + ys(ev).toFixed(1) + '" r="4" fill="' + C.amber + '"/>';
      s += txt(xs(nb) - 8, ys(ev) - 8, "baseline 2100", { anchor: "end", size: 8.5, fill: C.amber });
    }
    s += txt(m.l, m.t - 5, "events per century against nondual adults · the unit is an assumption, not an estimate",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, tol: 26,
      xs: (function () { var out = []; for (var e = Math.log(n0); e <= Math.log(n1); e += 0.08) out.push(xs(Math.exp(e))); return out; })(),
      label: function (i) { return compact(Math.exp(Math.log(n0) + i * 0.08)) + " nondual adults"; },
      rows: function (i) {
        var n = Math.exp(Math.log(n0) + i * 0.08);
        return gammas.map(function (gm) {
          return { name: "γ " + gm.g.toFixed(1), color: gm.color,
            text: compact(Math.pow(n / state.p.eventUnit, gm.g)) + " / century" };
        });
      }
    });
  }

  function renderTornado() {
    var host = document.getElementById("chartSens");
    if (!host) return;
    var base = runModel();
    var levers = [
      { k: "update", label: "institutional update", lo: 0.7, hi: 1.3 },
      { k: "alpha", label: "conformity exponent", lo: 0.7, hi: 1.3 },
      { k: "kappaHigh", label: "top-stage attractiveness", lo: 0.7, hi: 1.3 },
      { k: "retention", label: "child retention", lo: 0.85, hi: 1.15 },
      { k: "fertDiff", label: "fertility differential", lo: 0.5, hi: 1.5 },
      { k: "rho", label: "reconsideration rate", lo: 0.7, hi: 1.3 },
      { k: "capScale", label: "capacity ceiling", lo: 0.7, hi: 1.4 }
    ];
    var rows = levers.map(function (l) {
      var a = runModel(make({ k: l.k, v: state.p[l.k] * l.lo }));
      var b = runModel(make({ k: l.k, v: state.p[l.k] * l.hi }));
      return { label: l.label, lo: a.at2100, hi: b.at2100 };
    }).sort(function (x, y) { return Math.abs(y.hi - y.lo) - Math.abs(x.hi - x.lo); });

    function make(o) { var p = {}; p[o.k] = o.v; return p; }

    var W = 720, H = 300, m = { l: 206, r: 78, t: 18, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var all = [base.at2100];
    rows.forEach(function (r) { all.push(r.lo, r.hi); });
    var x0 = Math.min(0, Math.min.apply(null, all)) * 1.1;
    var x1 = Math.max.apply(null, all) * 1.15;
    var xs = function (v) { return m.l + (v - x0) / (x1 - x0) * iw; };
    var rowH = ih / rows.length;

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Sensitivity of the 2100 post-integral share to each lever">';
    s += '<line x1="' + xs(base.at2100).toFixed(1) + '" x2="' + xs(base.at2100).toFixed(1) + '" y1="' + m.t +
      '" y2="' + (m.t + ih) + '" stroke="' + C.dim + '" stroke-dasharray="3 3"/>';
    rows.forEach(function (r, i) {
      var y = m.t + rowH * i + rowH * 0.24, h = rowH * 0.52;
      var a = Math.min(r.lo, r.hi), b = Math.max(r.lo, r.hi);
      var col = (r.hi - r.lo) >= 0 ? C.mint : C.red;
      s += '<rect x="' + xs(a).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, (xs(b) - xs(a))).toFixed(1) +
        '" height="' + h.toFixed(1) + '" fill="' + col + '" fill-opacity="0.22" stroke="' + col + '" stroke-opacity="0.5"/>';
      s += txt(m.l - 9, y + h * 0.78, r.label, { anchor: "end", size: 10, fill: "#9fb0c0" });
      s += txt(xs(b) + 6, y + h * 0.78, (b * 100).toFixed(1) + "%", { size: 9, fill: "#c3ccd5" });
    });
    s += txt(m.l, m.t - 5, "post-integral share in 2100 when each lever moves ±30% (fertility ×0.5–1.5, capacity ×0.7–1.4)",
      { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    bindRows(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih, rowH: rowH, n: rows.length, x: m.l + iw * 0.5,
      label: function (i) { return rows[i].label; },
      rows: function (i) {
        var r = rows[i];
        return [
          { name: "low setting", color: C.dim, text: (r.lo * 100).toFixed(1) + "%" },
          { name: "baseline", color: C.dim2, text: (base.at2100 * 100).toFixed(1) + "%" },
          { name: "high setting", color: C.mint, text: (r.hi * 100).toFixed(1) + "%" }
        ];
      }
    });
  }

  /* --------------------------------------------------------- 10. the table --- */
  function renderModelTable() {
    var host = document.getElementById("modelTable");
    if (!host) return;
    var r = runModel();
    var rows = [
      ["post-integral ≥ 5%", r.crossings.post[5]],
      ["post-integral ≥ 10%", r.crossings.post[10]],
      ["post-integral ≥ 25%", r.crossings.post[25]],
      ["integral alone ≥ 10%", r.crossings.integral[10]],
      ["nondual ≥ 1%", (function () {
        for (var i = 0; i < r.shares.length; i++) if (r.shares[i][4] >= 0.01) return r.years[i];
        return null;
      })()],
      ["nondual ≥ 5%", r.crossings.nondual[5]]
    ];
    host.innerHTML = "<table class='mtable'><thead><tr><th>crossing</th><th>year</th></tr></thead><tbody>" +
      rows.map(function (x) {
        return "<tr><td>" + x[0] + "</td><td>" + (x[1] == null ? "<span class='muted'>not by " + state.horizon + "</span>" : x[1]) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  function renderModelNote() {
    var host = document.getElementById("modelNote");
    if (!host) return;
    /* The first two paragraphs describe the textbook baseline and the same
       model with one lever moved — they must not follow the controls, or the
       sentence "it does not reach 10%" ends up above a number that is 40%.
       The live line at the end is the only part that tracks the sidebar. */
    var trueBase = M.run({ horizon: state.horizon });
    var upd = M.run({ horizon: state.horizon, update: 1.4 });
    var both = M.run({ horizon: state.horizon, update: 1.7, capScale: 2.0 });
    var alphaUp = M.run({ horizon: state.horizon, alpha: 1.5 });
    var cur = runModel();
    function at(r) { return r.at2100 * 100; }
    function start(r) { return (r.shares[0][3] + r.shares[0][4]) * 100; }
    host.innerHTML =
      "<p><span class='tag amber'>model</span> The assumed starting point is " +
      M.STAGES.map(function (st, i) {
        return (trueBase.shares[0][i] * 100).toFixed(1) + "% " + st.name.toLowerCase();
      }).join(", ") +
      ", and the ceilings are 20% for integral and 5% for nondual. At those settings the post-integral share rises from " +
      "<b>" + start(trueBase).toFixed(1) + "%</b> to <b>" +
      at(trueBase).toFixed(1) + "%</b> by 2100 and <b>" + ((trueBase.final[3] + trueBase.final[4]) * 100).toFixed(1) +
      "%</b> by " + state.horizon + ". It does not reach 10%, let alone 25%: the model is not conversion-limited, it is transmission-limited. " +
      "The two highest stages have no schools, no liturgies and no states, so their reach is confined to people who already hold them.</p>" +
      "<p>Raise institutional update to 1.4× — traditions reformulating so that the next stage is carried in their own institutions — and the crossing moves to <b>" +
      (upd.crossings.post[10] || "beyond " + state.horizon) + "</b>. Raise update to 1.7× and double the capacity ceiling and the 2100 share becomes <b>" +
      at(both).toFixed(1) + "%</b>. Raise the conformity exponent instead and it moves the other way: at α = 1.5 the 2100 share falls to <b>" +
      at(alphaUp).toFixed(1) + "%</b>. Virality and conformity are not the same lever and they do not point the same way.</p>" +
      "<p class='live'><span class='tag green'>current</span> With the settings in the sidebar: post-integral in 2100 is <b>" +
      at(cur).toFixed(1) + "%</b>, and the 25% crossing is <b>" +
      (cur.crossings.post[25] || "not before " + state.horizon) + "</b>.</p>";
  }

  /* ---------------------------------------------------------------- panels --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var g = K.composition.groups;
    var none = g.find(function (x) { return x.name === "unaffiliated"; });
    var med = K.practice.meditation[K.practice.meditation.length - 1];
    var mind = D.growth.find(function (x) { return x.key === "mindfulness"; });
    var top = D.where.countries[0], us = D.where.us;
    var cards = [
      ["World unaffiliated", none.b.toFixed(1) + "%",
        (none.b - none.a >= 0 ? "+" : "") + (none.b - none.a).toFixed(1) + " pts since 2010 · " +
        (none.b / 100 * 8.2).toFixed(1) + "bn people", true],
      ["US Christian", "62%", "from 78% in 2007 · six people leave for every one who joins", false],
      ["Meditation, US adults", med.v + "%", "from 4.1% in 2012 · the 2012 module changed", false],
      ["Mindfulness papers", mind.last.toLocaleString("en-US"),
        "from " + mind.first + " in 1950 · " + mind.doublingRecent + "-year doubling now", false],
      ["Post-conventional pool", D.where.total.toFixed(0) + "M",
        "adults, derived · largest in " + top.c + " (" + top.adults.toFixed(0) + "M), US " + (us ? us.adults.toFixed(0) : "–") + "M", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var base = runModel();
    host.innerHTML = "<h2>What the page concludes</h2>" +
      "<p><span class='tag green'>measured</span> The demography is unambiguous and does not support the simplest version of either story. " +
      "Christianity fell from 78% to 62% of US adults while the unaffiliated rose to 29%, and the world's religiously unaffiliated share rose only " +
      "0.9 points in a decade, because they have fewer children. Switching dominates composition in rich countries; fertility dominates it globally. " +
      "Both are true at once, which is why a single headline about religion declining is always wrong somewhere.</p>" +
      "<p><span class='tag green'>measured</span> The practices are spreading much faster than the identities. Meditation went from 4.1% to 17.3% of US adults " +
      "in a decade, and works mentioning mindfulness rose 49-fold since 2000 — a " + (D.growth.find(function (x) { return x.key === "mindfulness"; }).doublingRecent) +
      "-year doubling, against the 3.0 years a published bibliometric study reports for the whole record. The gap between those two rates is the finding: " +
      "a field grows fastest while it is small.</p>" +
      "<p><span class='tag amber'>asserted</span> Nothing measured here is a stage. The developmental ladder, the traditions matrix and every trajectory in the " +
      "model are constructions. What the model does say is specific: at baseline the post-integral share reaches <b>" + base.at2100 * 100 +
      "%</b> by 2100 and stalls, not because conversion is too slow but because the highest stages have no institutions to transmit them. " +
      "The lever that moves the date is institutional update, not virality — and raising conformity instead moves it backwards.</p>" +
      "<p>Where that would happen is arithmetic rather than prophecy: the largest absolute pools are in " +
      D.where.countries.slice(0, 3).map(function (c) { return c.c + " (" + c.adults.toFixed(0) + "M)"; }).join(", ") +
      ", not in the countries with the highest share. A stage that spreads person to person needs bodies before it needs percentages.</p>" +
      "<p>The critical mass is therefore not a percentage waiting to be reached. It is the point at which a stage acquires the capacity to reproduce itself " +
      "in the next generation, and the arithmetic of that is a capacity question before it is a persuasion question.</p>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-religion.mjs</code> and stored in <code>religion-data.js</code>. Each is a claim the prose makes, computed " +
      "rather than written: the paper count, the attention window, the denominator, and how many countries actually joined.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label + " <b>" + c.value +
          "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2><p>Measured series are linked to the report or release they come from. Where the number is a secondary " +
      "tabulation or a survey that another survey contradicts, the note says which.</p>" +
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

  /* -------------------------------------------------------------- controls --- */
  function slider(group, key, label, min, max, step, fmt) {
    var wrap = document.createElement("div");
    wrap.className = "lever";
    var top = document.createElement("label");
    top.className = "lever-top";
    var val = document.createElement("b");
    val.className = "lever-val";
    val.textContent = fmt(state.p[key]);
    val.dataset.k = key;
    top.innerHTML = "<span class='lever-name'>" + label + "</span>";
    top.appendChild(val);
    var input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = state.p[key];
    input.dataset.k = key;
    input.style.cssText = "width:100%;margin-top:6px;accent-color:#a9c0b4;";
    input.addEventListener("input", function () {
      state.p[key] = parseFloat(input.value);
      val.textContent = fmt(state.p[key]);
      refreshModel();
    });
    wrap.appendChild(top);
    wrap.appendChild(input);
    group.appendChild(wrap);
  }

  /* the two vessel levers live on `state`, not in `state.p`, because they drive
     a phase diagram rather than the stage model. Same widget, same contract. */
  function topSlider(group, key, label, min, max, step, fmt) {
    var wrap = document.createElement("div");
    wrap.className = "lever";
    var top = document.createElement("label");
    top.className = "lever-top";
    var val = document.createElement("b");
    val.className = "lever-val";
    val.dataset.t = key;
    val.textContent = fmt(state[key]);
    top.innerHTML = "<span class='lever-name'>" + label + "</span>";
    top.appendChild(val);
    var input = document.createElement("input");
    input.type = "range";
    input.min = min; input.max = max; input.step = step;
    input.value = state[key];
    input.dataset.t = key;
    input.style.cssText = "width:100%;margin-top:6px;accent-color:#a9c0b4;";
    input.addEventListener("input", function () {
      state[key] = parseFloat(input.value);
      val.textContent = fmt(state[key]);
      renderVessel();
    });
    wrap.appendChild(top);
    wrap.appendChild(input);
    group.appendChild(wrap);
  }

  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g0 = document.createElement("details");
    g0.className = "lgroup";
    g0.open = true;
    g0.innerHTML = "<summary>Scenario<i class='caret' aria-hidden='true'></i></summary>";
    var row = document.createElement("div");
    row.className = "lever";
    var sel = document.createElement("select");
    sel.id = "scenarioSel";
    sel.style.cssText = "width:100%;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:6px;font-size:11px;";
    Object.keys(SCENARIOS).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = SCENARIOS[k].label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      state.scenario = sel.value;
      for (var k in M.BASELINE) state.p[k] = M.BASELINE[k];
      state.p.start = M.BASELINE.start.slice();
      var set = SCENARIOS[sel.value].set;
      for (var s in set) state.p[s] = set[s];
      syncSliders();
      refreshModel();
    });
    row.appendChild(sel);
    g0.appendChild(row);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "Scenarios set the levers below; every lever can then be moved on its own.";
    g0.appendChild(note);
    host.appendChild(g0);

    var g1 = document.createElement("details");
    g1.className = "lgroup";
    g1.innerHTML = "<summary>Transmission<i class='caret' aria-hidden='true'></i></summary>";
    slider(g1, "rho", "reconsideration rate", 0.02, 0.2, 0.005, function (v) { return (v * 100).toFixed(0) + "%/yr"; });
    slider(g1, "alpha", "conformity exponent α", 1.0, 2.2, 0.05, function (v) { return v.toFixed(2); });
    slider(g1, "kappaHigh", "attractiveness of the top stages", 0.8, 2.5, 0.05, function (v) { return v.toFixed(2) + "×"; });
    slider(g1, "retention", "child retention", 0.5, 0.95, 0.01, function (v) { return (v * 100).toFixed(0) + "%"; });
    host.appendChild(g1);

    var g2 = document.createElement("details");
    g2.className = "lgroup";
    g2.innerHTML = "<summary>Institutions<i class='caret' aria-hidden='true'></i></summary>";
    slider(g2, "update", "institutional update", 0.5, 2.0, 0.05, function (v) { return v.toFixed(2) + "×"; });
    slider(g2, "capScale", "capacity ceiling", 0.5, 2.5, 0.05, function (v) { return v.toFixed(2) + "×"; });
    slider(g2, "fertDiff", "fertility differential", 0, 1.5, 0.05, function (v) { return "+" + v.toFixed(2); });
    host.appendChild(g2);

    var gv = document.createElement("details");
    gv.className = "lgroup";
    gv.innerHTML = "<summary>The vessel<i class='caret' aria-hidden='true'></i></summary>";
    topSlider(gv, "carrier", "carrier strength", 0.1, 0.95, 0.01, function (v) { return (v * 100).toFixed(0) + "%"; });
    topSlider(gv, "centre", "centre of gravity moved", 0, 1, 0.01, function (v) { return (v * 100).toFixed(0) + "%"; });
    var gvnote = document.createElement("p");
    gvnote.className = "blurb";
    gvnote.textContent = "These two move the phase diagram only. Both axes are asserted: no instrument scores a tradition's centre.";
    gv.appendChild(gvnote);
    host.appendChild(gv);

    var g3 = document.createElement("details");
    g3.className = "lgroup";
    g3.innerHTML = "<summary>Horizon<i class='caret' aria-hidden='true'></i></summary>";
    var hrow = document.createElement("div");
    hrow.className = "lever";
    var hsel = document.createElement("select");
    hsel.id = "horizonSel";
    hsel.style.cssText = "width:100%;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:6px;font-size:11px;";
    [2100, 2200, 2400].forEach(function (h) {
      var o = document.createElement("option");
      o.value = h; o.textContent = "to " + h;
      if (h === state.horizon) o.selected = true;
      hsel.appendChild(o);
    });
    hsel.addEventListener("change", function () {
      state.horizon = parseInt(hsel.value, 10);
      refreshModel();
    });
    hrow.appendChild(hsel);
    g3.appendChild(hrow);
    host.appendChild(g3);

    var p = document.createElement("p");
    p.className = "aside-note";
    p.innerHTML = "The four modelled charts are a scaffold, not a forecast: initial shares, capacity ceilings and broadcast reach are assumptions. " +
      "Only the switching and retention rates are calibrated, to Pew's measured values.";
    host.appendChild(p);
  }

  function syncSliders() {
    var inputs = document.querySelectorAll("#controls input[type=range]");
    for (var i = 0; i < inputs.length; i++) {
      var k = inputs[i].dataset.k;
      /* the two vessel sliders belong to `state`, not `state.p`: skip them here
         or a scenario change would write undefined into their value */
      if (!k) continue;
      inputs[i].value = state.p[k];
      var val = document.querySelector("#controls .lever-val[data-k='" + k + "']");
      if (val) val.textContent = fmtFor(k, state.p[k]);
    }
    function fmtFor(k, v) {
      if (k === "alpha" || k === "kappaHigh") return k === "alpha" ? v.toFixed(2) : v.toFixed(2) + "×";
      if (k === "rho" || k === "retention") return (v * 100).toFixed(0) + "%";
      if (k === "update" || k === "capScale") return v.toFixed(2) + "×";
      return "+" + v.toFixed(2);
    }
  }

  function refreshModel() {
    renderStages();
    renderCritical();
    renderEvents();
    renderTornado();
    renderModelTable();
    renderModelNote();
  }

  /* ------------------------------------------------------------------ init --- */
  renderKpis();
  renderVerdict();
  renderComposition();
  renderRetention();
  renderRatio();
  renderBelief();
  renderPractice();
  renderResearch();
  renderAttention();
  renderWhere();
  renderLadder();
  renderVessel();
  renderCarriers();
  renderChecks();
  renderSources();
  renderLimits();
  buildControls();
  refreshModel();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      for (var k in M.BASELINE) state.p[k] = M.BASELINE[k];
      state.p.start = M.BASELINE.start.slice();
      state.horizon = 2200;
      state.scenario = "baseline";
      state.carrier = 0.62;
      state.centre = 0.25;
      var tinputs = document.querySelectorAll("#controls input[data-t]");
      for (var ti = 0; ti < tinputs.length; ti++) {
        var tk = tinputs[ti].dataset.t;
        tinputs[ti].value = state[tk];
        var tval = document.querySelector("#controls .lever-val[data-t='" + tk + "']");
        if (tval) tval.textContent = tk === "carrier" ? (state[tk] * 100).toFixed(0) + "%" : (state[tk] * 100).toFixed(0) + "%";
      }
      renderVessel();
      var sel = document.getElementById("scenarioSel");
      if (sel) sel.value = "baseline";
      var hs = document.getElementById("horizonSel");
      if (hs) hs.value = "2200";
      syncSliders();
      refreshModel();
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.rt);
    state.rt = setTimeout(function () {
      renderComposition(); renderRetention(); renderRatio(); renderBelief();
      renderPractice(); renderResearch(); renderAttention(); renderWhere();
      renderLadder(); renderStages(); renderCritical(); renderEvents(); renderTornado();
      renderVessel(); renderCarriers();
    }, 200);
  });
})();
