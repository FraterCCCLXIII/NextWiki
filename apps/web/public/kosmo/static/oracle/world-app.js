/* ============================================================================
   world-app.js — the country panel, drawn four ways.

   Depends on gapminder-data.js (window.GAP) and hover.js (window.HOV).

   This page is not a model. Every number on it is a slice of the panel that
   ingest-gapminder.mjs assembles: 233 countries, 48 frames, three indicators.
   The only things computed here are aggregates of those rows, and each one is
   labelled with what it weights by.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.GAP;
  if (!D) return;

  var NS = "http://www.w3.org/2000/svg";

  /* Region colours are deliberately the same four the other pages use for
     series, so a reader moving between pages is not learning a new palette. */
  var REGION_COLORS = ["#c4a373", "#8aa4be", "#a9c0b4", "#a396b3", "#6f7072"];
  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528"
  };

  var state = {
    yi: D.years.length - 1,
    regions: [true, true, true, true, true],
    /* Off by default: 185 paths across 220 years is a hairball that hides the
       cloud it is supposed to explain. On demand it is the more interesting view. */
    trails: false,
    playing: false
  };

  /* A cloud of 185 circles needs a few names to orient the eye. */
  var LABELS = ["chn", "ind", "usa", "nga", "jpn", "deu", "bra"];

  /* --------------------------------------------------------------- helpers */
  function el(t, cls, html) {
    var d = document.createElement(t);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function nf(x, d) { return Number(x).toFixed(d === undefined ? 0 : d); }

  function money(v) {
    if (v == null || !isFinite(v)) return "–";
    if (v >= 10000) return "$" + Math.round(v / 1000) + "k";
    if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "k";
    return "$" + Math.round(v);
  }
  function people(v) {
    if (v == null || !isFinite(v)) return "–";
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "bn";
    if (v >= 1e6) return (v / 1e6).toFixed(0) + "m";
    if (v >= 1e3) return (v / 1e3).toFixed(0) + "k";
    return String(Math.round(v));
  }

  function inView(k) { return state.regions[D.countries[k].region]; }
  function incAt(k, i) { return D.inc[k][i]; }
  function leAt(k, i) { return D.le[k][i]; }
  function popAt(k, i) { return D.pop[k][i]; }

  function weightedPercentile(values, weights, p) {
    var pairs = [];
    for (var i = 0; i < values.length; i++) {
      var v = values[i], w = weights[i];
      if (v == null || w == null || !isFinite(v) || !isFinite(w) || w <= 0) continue;
      pairs.push([v, w]);
    }
    if (!pairs.length) return null;
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    var total = pairs.reduce(function (a, q) { return a + q[1]; }, 0);
    var target = p * total, acc = 0;
    for (var k = 0; k < pairs.length; k++) {
      acc += pairs[k][1];
      if (acc >= target) return pairs[k][0];
    }
    return pairs[pairs.length - 1][0];
  }

  /* ---------------------------------------------------------- bubble chart */
  var BG = { W: 700, H: 430, m: { l: 56, r: 20, t: 18, b: 38 } };
  var XMIN = 250, XMAX = 140000, YMIN = 20, YMAX = 90;
  var RMAX = 23;                                  /* radius of the largest bubble */
  var POP_REF = 1.45e9;                           /* China + India, roughly */

  function bx(v) {
    var t = (Math.log10(clamp(v, XMIN, XMAX)) - Math.log10(XMIN)) / (Math.log10(XMAX) - Math.log10(XMIN));
    return BG.m.l + t * (BG.W - BG.m.l - BG.m.r);
  }
  function by(v) {
    return BG.m.t + (1 - (clamp(v, YMIN, YMAX) - YMIN) / (YMAX - YMIN)) * (BG.H - BG.m.t - BG.m.b);
  }
  function br(p) {
    if (p == null || !isFinite(p) || p <= 0) return 1.2;
    return Math.max(1.2, RMAX * Math.sqrt(p / POP_REF));
  }

  var bubbles = null;

  function buildBubble() {
    var host = document.getElementById("bubbleChart");
    if (!host) return;

    var W = BG.W, H = BG.H;
    var iw = W - BG.m.l - BG.m.r, ih = H - BG.m.t - BG.m.b;
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Income per person against life expectancy, bubble area is population">';

    /* x grid: log ticks that stay readable at any width */
    [300, 1000, 3000, 10000, 30000, 100000].forEach(function (v) {
      var x = bx(v);
      s += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + BG.m.t +
        '" y2="' + (BG.m.t + ih) + '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += '<text x="' + x.toFixed(1) + '" y="' + (H - BG.m.b + 16) + '" text-anchor="middle" fill="' + C.dim2 +
        '" font-size="9.5" font-family="ui-monospace,monospace">' + money(v) + "</text>";
    });

    /* y grid */
    [20, 30, 40, 50, 60, 70, 80].forEach(function (v) {
      var y = by(v);
      s += '<line x1="' + BG.m.l + '" x2="' + (BG.m.l + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += '<text x="' + (BG.m.l - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="' + C.dim2 +
        '" font-size="9.5" font-family="ui-monospace,monospace">' + v + "</text>";
    });

    s += '<text x="' + (BG.m.l + iw / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="' + C.dim2 +
      '" font-size="9.5" font-family="ui-monospace,monospace">income per person, 1990 international dollars (log scale)</text>';
    s += '<text x="14" y="' + (BG.m.t + ih / 2) + '" text-anchor="middle" fill="' + C.dim2 +
      '" font-size="9.5" font-family="ui-monospace,monospace" transform="rotate(-90 14 ' + (BG.m.t + ih / 2) + ')">life expectancy at birth</text>';

    /* The lower half is empty in 2019 because nobody lives there any more. Naming
       the band is better than letting it read as a rendering gap. */
    var bandTop = by(43), bandBot = by(23);
    s += '<rect x="' + BG.m.l + '" y="' + bandTop.toFixed(1) + '" width="' + iw +
      '" height="' + (bandBot - bandTop).toFixed(1) + '" fill="' + C.mint + '" opacity="0.03"/>';
    s += '<text x="' + (BG.m.l + 8) + '" y="' + ((bandTop + bandBot) / 2).toFixed(1) +
      '" fill="' + C.dim2 + '" font-size="9.5" font-family="ui-monospace,monospace" opacity="0.85">' +
      'every country sat in this band in 1800</text>';

    /* behind everything, so the bubbles read on top of it */
    s += '<text class="yearmark" x="' + (BG.m.l + iw - 6) + '" y="' + (BG.m.t + 40) +
      '" text-anchor="end" font-size="40" font-family="ui-monospace,monospace" fill="#e8e8e6" opacity="0.16"></text>';
    s += '<g class="trails"></g><g class="dots"></g><g class="labels"></g>';
    s += "</svg>";

    host.innerHTML = s;

    bubbles = {
      host: host,
      trails: host.querySelector("g.trails"),
      dots: host.querySelector("g.dots"),
      labels: host.querySelector("g.labels"),
      yearmark: host.querySelector(".yearmark"),
      circles: [],
      paths: [],
      names: {}
    };

    LABELS.forEach(function (id) {
      var k = -1;
      for (var i = 0; i < D.countries.length; i++) if (D.countries[i].id === id) { k = i; break; }
      if (k === -1) return;
      var t = document.createElementNS(NS, "text");
      t.setAttribute("font-size", "9.5");
      t.setAttribute("font-family", "ui-monospace,monospace");
      t.setAttribute("fill", "#c3ccd5");
      t.setAttribute("text-anchor", "middle");
      /* halo, so a name stays readable where it crosses a bubble */
      t.setAttribute("stroke", "#0c0c0d");
      t.setAttribute("stroke-width", "3");
      t.setAttribute("paint-order", "stroke");
      t.setAttribute("stroke-linejoin", "round");
      t.setAttribute("pointer-events", "none");
      t.textContent = D.countries[k].name;
      bubbles.labels.appendChild(t);
      bubbles.names[k] = t;
    });

    D.countries.forEach(function (c, k) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-linejoin", "round");
      p.setAttribute("stroke-linecap", "round");
      bubbles.trails.appendChild(p);
      bubbles.paths.push(p);

      var ci = document.createElementNS(NS, "circle");
      ci.setAttribute("cx", -20);
      ci.setAttribute("cy", -20);
      ci.setAttribute("r", 0);
      bubbles.dots.appendChild(ci);
      bubbles.circles.push(ci);
    });

    HOV.bind(host, bubbleModel());
  }

  function updateBubble() {
    if (!bubbles) return;
    var i = state.yi;

    for (var k = 0; k < D.countries.length; k++) {
      var c = D.countries[k];
      var inc = incAt(k, i), le = leAt(k, i), pop = popAt(k, i);
      var circle = bubbles.circles[k];
      var trail = bubbles.paths[k];
      var col = REGION_COLORS[c.region];

      if (!state.regions[c.region] || inc == null || le == null) {
        circle.setAttribute("r", 0);
        trail.setAttribute("d", "");
        if (bubbles.names[k]) bubbles.names[k].textContent = "";
        continue;
      }

      circle.setAttribute("cx", bx(inc).toFixed(1));
      circle.setAttribute("cy", by(le).toFixed(1));
      circle.setAttribute("r", br(pop).toFixed(2));
      circle.setAttribute("fill", col);
      circle.setAttribute("opacity", "0.5");

      /* names sit just above the bubble, sized to it, so a label never lands
         in the middle of a neighbour */
      if (bubbles.names[k]) {
        var label = bubbles.names[k];
        label.textContent = c.name;
        label.setAttribute("x", bx(inc).toFixed(1));
        label.setAttribute("y", (by(le) - br(pop) - 4).toFixed(1));
      }

      if (state.trails) {
        var d = "";
        for (var j = 0; j <= i; j++) {
          var a = incAt(k, j), b = leAt(k, j);
          if (a == null || b == null) continue;
          d += (d ? "L" : "M") + bx(a).toFixed(1) + " " + by(b).toFixed(1);
        }
        trail.setAttribute("d", d);
        trail.setAttribute("stroke", col);
        trail.setAttribute("stroke-width", "0.8");
        trail.setAttribute("opacity", "0.10");
      } else {
        trail.setAttribute("d", "");
      }
    }

    if (bubbles.yearmark) bubbles.yearmark.textContent = String(D.years[i]);
  }

  function bubbleModel() {
    return {
      W: BG.W, H: BG.H, top: BG.m.t, bottom: BG.H - BG.m.b,
      xOf: function (k) {
        var v = incAt(k, state.yi);
        return v == null ? BG.m.l : bx(v);
      },
      /* nearest bubble by pixel distance, not by x: a scatter has no unique y */
      xIndex: function (vx, vy) {
        var best = null, bd = Infinity, i = state.yi;
        for (var k = 0; k < D.countries.length; k++) {
          if (!inView(k)) continue;
          var inc = incAt(k, i), le = leAt(k, i);
          if (inc == null || le == null) continue;
          var dx = bx(inc) - vx, dy = by(le) - vy;
          var d2 = dx * dx + dy * dy;
          var hit = br(popAt(k, i)) + 5;
          if (d2 < hit * hit && d2 < bd) { bd = d2; best = k; }
        }
        return best;
      },
      label: function (k) { return D.countries[k].name; },
      rows: function (k) {
        var i = state.yi;
        var inc = incAt(k, i), le = leAt(k, i), pop = popAt(k, i);
        var rows = [
          { name: "income per person", color: REGION_COLORS[D.countries[k].region], text: money(inc) },
          { name: "life expectancy", color: C.dim, text: le == null ? "–" : le.toFixed(1) + " y" },
          { name: "population", color: C.dim, text: people(pop) }
        ];
        var inc0 = incAt(k, 0), le0 = leAt(k, 0);
        if (inc0 && inc) rows.push({ name: "income vs 1800", color: C.dim, text: (inc / inc0).toFixed(1) + "×" });
        if (le0 && le) rows.push({ name: "life vs 1800", color: C.dim, text: (le - le0).toFixed(1) + " y" });
        return rows;
      }
    };
  }

  /* ------------------------------------------------------ income mountains */
  var MG = { W: 700, H: 260, m: { l: 46, r: 18, t: 18, b: 40 } };
  var BINS = 42;

  function binOf(v) {
    var t = (Math.log10(clamp(v, XMIN, XMAX)) - Math.log10(XMIN)) / (Math.log10(XMAX) - Math.log10(XMIN));
    return clamp(Math.floor(t * BINS), 0, BINS - 1);
  }

  function mountainsData(i) {
    var bins = new Array(BINS).fill(0);
    for (var k = 0; k < D.countries.length; k++) {
      if (!inView(k)) continue;
      var inc = incAt(k, i), pop = popAt(k, i);
      if (inc == null || pop == null || pop <= 0) continue;
      bins[binOf(inc)] += pop;
    }
    return bins;
  }

  function drawMountains() {
    var host = document.getElementById("mountains");
    if (!host) return;
    var i = state.yi;
    var bins = mountainsData(i);
    var W = MG.W, H = MG.H;
    var iw = W - MG.m.l - MG.m.r, ih = H - MG.m.t - MG.m.b;
    var maxB = Math.max.apply(null, bins) || 1;
    var bw = iw / BINS;

    function bxBin(b) { return MG.m.l + b * bw; }
    function byPop(v) { return MG.m.t + ih - (v / maxB) * ih; }

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Population by income bin">';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var y = MG.m.t + ih - f * ih;
      s += '<line x1="' + MG.m.l + '" x2="' + (MG.m.l + iw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += '<text x="' + (MG.m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="' + C.dim2 +
        '" font-size="9" font-family="ui-monospace,monospace">' + people(maxB * f) + "</text>";
    });

    /* the bars */
    var path = "", started = false;
    bins.forEach(function (v, b) {
      var x0 = bxBin(b), x1 = x0 + bw - 1.2, y0 = byPop(v), y1 = MG.m.t + ih;
      if (v <= 0) return;
      path += "M" + x0.toFixed(1) + " " + y1.toFixed(1) + "L" + x0.toFixed(1) + " " + y0.toFixed(1) +
        "L" + x1.toFixed(1) + " " + y0.toFixed(1) + "L" + x1.toFixed(1) + " " + y1.toFixed(1) + "Z";
      started = true;
    });
    if (started) s += '<path d="' + path + '" fill="' + C.mint + '" opacity="0.42"/>';

    /* x ticks */
    [300, 1000, 3000, 10000, 30000, 100000].forEach(function (v) {
      var x = bxBin(binOf(v) + 0.5);
      s += '<text x="' + x.toFixed(1) + '" y="' + (H - MG.m.b + 15) + '" text-anchor="middle" fill="' + C.dim2 +
        '" font-size="9" font-family="ui-monospace,monospace">' + money(v) + "</text>";
    });
    s += '<text x="' + (MG.m.l + iw / 2) + '" y="' + (H - 4) + '" text-anchor="middle" fill="' + C.dim2 +
      '" font-size="9.5" font-family="ui-monospace,monospace">people by income per person, ' + D.years[i] + "</text>";

    /* mean and median person */
    var total = bins.reduce(function (a, b) { return a + b; }, 0);
    var acc = 0, medianBin = 0;
    for (var b2 = 0; b2 < BINS; b2++) {
      acc += bins[b2];
      if (acc >= total / 2) { medianBin = b2; break; }
    }
    function marker(bin, label, col, dy) {
      var x = bxBin(bin) + bw / 2;
      return '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + MG.m.t +
        '" y2="' + (MG.m.t + ih) + '" stroke="' + col + '" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<text x="' + (x + 4).toFixed(1) + '" y="' + (MG.m.t + 12 + (dy || 0)) + '" fill="' + col +
        '" font-size="9" font-family="ui-monospace,monospace">' + label + "</text>";
    }
    var meanInc = weightedMeanAll(i);
    /* medianBin is already a bin index: feeding it back through binOf placed the
       marker at the axis origin on the first run */
    s += marker(medianBin, "median person", C.blue, 0);
    if (meanInc) s += marker(binOf(meanInc), "mean", C.amber, 12);

    s += "</svg>";
    host.innerHTML = s;

    HOV.bind(host, {
      W: W, H: H, top: MG.m.t, bottom: MG.m.t + ih,
      xOf: function (b) { return bxBin(b) + bw / 2; },
      xIndex: function (vx) {
        var b = Math.floor((vx - MG.m.l) / bw);
        return b < 0 || b >= BINS ? null : b;
      },
      label: function (b) {
        var lo = Math.pow(10, Math.log10(XMIN) + b / BINS * (Math.log10(XMAX) - Math.log10(XMIN)));
        var hi = Math.pow(10, Math.log10(XMIN) + (b + 1) / BINS * (Math.log10(XMAX) - Math.log10(XMIN)));
        return money(lo) + " to " + money(hi);
      },
      rows: function (b) {
        var t = bins.reduce(function (a, q) { return a + q; }, 0) || 1;
        return [
          { name: "people", color: C.mint, text: people(bins[b]) },
          { name: "share of people shown", color: C.dim, text: (bins[b] / t * 100).toFixed(1) + "%" }
        ];
      }
    });
  }

  function weightedMeanAll(i) {
    var s = 0, w = 0;
    for (var k = 0; k < D.countries.length; k++) {
      if (!inView(k)) continue;
      var inc = incAt(k, i), pop = popAt(k, i);
      if (inc == null || pop == null || pop <= 0) continue;
      s += inc * pop; w += pop;
    }
    return w > 0 ? s / w : null;
  }

  /* --------------------------------------------------------------- charts */
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

  function lineChart(cfg) {
    var W = cfg.w || 320, H = cfg.h || 250;
    var m = { l: 46, r: 14, t: 16, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var yrs = cfg.years, n = yrs.length;
    var x0 = yrs[0], x1 = yrs[n - 1];
    var ax = cfg.left;

    function X(v) { return m.l + (v - x0) / (x1 - x0) * iw; }
    function Y(v) {
      if (ax.log) {
        var lo = Math.log10(ax.min), hi = Math.log10(ax.max);
        return m.t + (1 - (Math.log10(clamp(v, ax.min, ax.max)) - lo) / (hi - lo)) * ih;
      }
      return m.t + (1 - (v - ax.min) / (ax.max - ax.min)) * ih;
    }

    cfg.__geom = { W: W, H: H, m: m, iw: iw, ih: ih };

    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img">';

    (cfg.yTicks || []).forEach(function (v) {
      var y = Y(v);
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      s += '<text x="' + (m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="' + C.dim2 +
        '" font-size="9" font-family="ui-monospace,monospace">' + cfg.left.fmt(v) + "</text>";
    });

    (cfg.xTicks || []).forEach(function (yr) {
      if (yr < x0 || yr > x1) return;
      s += '<text x="' + X(yr).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" fill="' + C.dim2 +
        '" font-size="9" font-family="ui-monospace,monospace">' + yr + "</text>";
    });

    cfg.series.forEach(function (se) {
      var d = "", started = false;
      se.data.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { started = false; return; }
        d += (started ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v).toFixed(1);
        started = true;
      });
      if (se.fill) {
        var base = Y(se.baseline !== undefined ? se.baseline : ax.min);
        s += '<path d="' + d + "L" + X(x1).toFixed(1) + " " + base.toFixed(1) + "L" + X(x0).toFixed(1) + " " +
          base.toFixed(1) + 'Z" fill="' + se.color + '" opacity="0.12"/>';
      }
      s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.width || 1.9) + '"' +
        (se.dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
    });

    s += "</svg>";
    return s;
  }

  /* --------------------------------------------------------------- panels */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;

    var i = state.yi;
    var pop = 0, count = 0, leSum = 0, leW = 0, incs = [];
    for (var k = 0; k < D.countries.length; k++) {
      if (!inView(k)) continue;
      var p = popAt(k, i), le = leAt(k, i), inc = incAt(k, i);
      /* drawn, not merely present: the chart needs both axes to place a country */
      if (inc != null && le != null) count++;
      if (p) pop += p;
      if (le != null && p) { leSum += le * p; leW += p; }
      if (inc != null) incs.push(inc);
    }
    incs.sort(function (a, b) { return a - b; });
    var medianCountry = incs.length ? incs[Math.floor(incs.length / 2)] : null;
    var meanPerson = weightedMeanAll(i);
    var leMean = leW ? leSum / leW : null;
    var leMin = Infinity, leMax = -Infinity;
    for (var q = 0; q < D.countries.length; q++) {
      if (!inView(q)) continue;
      var v = leAt(q, i);
      if (v == null) continue;
      if (v < leMin) leMin = v;
      if (v > leMax) leMax = v;
    }

    var cards = [
      ["People in view", people(pop), D.years[i] + ", " + count + " countries", true],
      ["Mean person earns", money(meanPerson), "population-weighted", false],
      ["Median country earns", money(medianCountry), "one country, one vote", false],
      ["Life expectancy", leMean == null ? "–" : leMean.toFixed(1) + " y", "population-weighted", false],
      ["Best and worst country", (leMin === Infinity ? "–" : leMin.toFixed(0) + "–" + leMax.toFixed(0) + " y"), "the range behind the mean", false]
    ];

    host.innerHTML = cards.map(function (c) {
      return '<div class="kpi' + (c[3] ? " hero" : "") + '">' +
        '<div class="klabel">' + c[0] + "</div>" +
        '<div class="kval">' + c[1] + "</div>" +
        '<div class="knote">' + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var i = state.yi, yr = D.years[i];

    var incs = [];
    for (var k = 0; k < D.countries.length; k++) {
      if (!inView(k)) continue;
      var v = incAt(k, i);
      if (v != null) incs.push({ v: v, k: k });
    }
    if (!incs.length) { host.innerHTML = "<p>No income data for " + yr + ".</p>"; return; }
    incs.sort(function (a, b) { return a.v - b.v; });
    var lo = incs[0], hi = incs[incs.length - 1];
    var ratio = hi.v / lo.v;
    var mean = weightedMeanAll(i);
    var med = incs[Math.floor(incs.length / 2)].v;

    var below = 0, popTotal = 0;
    for (var j = 0; j < D.countries.length; j++) {
      if (!inView(j)) continue;
      var p = popAt(j, i), inc = incAt(j, i);
      if (p == null) continue;
      popTotal += p;
      if (inc != null && inc < 2000) below += p;
    }

    var gapPct = mean ? (mean / med - 1) * 100 : 0;
    var gapWhy = Math.abs(gapPct) < 5
      ? "the two are within a few percent here, which means population is spread evenly across the distribution rather than piled at one end"
      : (gapPct > 0
        ? "the average person is richer than the median country, because population is concentrated in countries above the median"
        : "the average person is poorer than the median country, because population is concentrated in the poorer half");

    var body = "In <strong>" + yr + "</strong> the richest country in view earns <strong>" + ratio.toFixed(1) +
      "×</strong> the poorest (" + money(hi.v) + " against " + money(lo.v) + " per person). " +
      "The median country sits at <strong>" + money(med) + "</strong>, the average person lives on <strong>" +
      money(mean) + "</strong> — " + (Math.abs(gapPct) < 5 ? "" : "a gap of " + Math.abs(gapPct).toFixed(0) + "%, and ") +
      gapWhy + ". ";

    if (popTotal > 0) {
      body += "About <strong>" + (below / popTotal * 100).toFixed(0) + "%</strong> of the people shown live in a country under $2,000 a year. ";
    }

    body += "That is the distribution the other pages collapse into a single line, and the reason a shock that is " +
      "absorbable at the mean can still be a crisis at the bottom: the fiscal capacity to run a transfer system, " +
      "the labour share that pays for it, and the age structure that needs it are all functions of where in this " +
      "cloud a country sits.";

    host.innerHTML = "<h2>What " + yr + " looks like from below the average</h2><p>" + body + "</p>";
  }

  function renderCoverage() {
    var host = document.getElementById("coverage");
    if (!host) return;
    var sample = [1800, 1900, 1950, 2000, 2019].map(function (y) { return D.years.indexOf(y); })
      .filter(function (i) { return i >= 0; });

    var rows = sample.map(function (i) {
      var inc = 0, le = 0, pop = 0, all = 0;
      for (var k = 0; k < D.countries.length; k++) {
        var a = incAt(k, i), b = leAt(k, i), c = popAt(k, i);
        if (a != null) inc++;
        if (b != null) le++;
        if (c != null) pop++;
        if (a != null && b != null && c != null) all++;
      }
      return "<tr><td>" + D.years[i] + "</td><td class='rt-num'>" + inc + "</td><td class='rt-num'>" + le +
        "</td><td class='rt-num'>" + pop + "</td><td class='rt-num'>" + all + "</td></tr>";
    }).join("");

    host.innerHTML = "<h2>Coverage, frame by frame</h2>" +
      "<p>Countries with a value in that year. The panel thins out at both ends for different reasons: before " +
      "1950 there were fewer statistical agencies, and after 2019 the income series has no more rows. Where a " +
      "value is missing the country is not drawn — nothing is interpolated.</p>" +
      "<table class='rate-table'><thead><tr><th>Year</th><th>Income</th><th>Life exp.</th><th>Population</th>" +
      "<th>All three</th></tr></thead><tbody>" + rows + "</tbody></table>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    var body = D.checks.map(function (c) {
      return "<div class='check " + (c.status === "ok" ? "ok" : "warn") + "'>" +
        "<span class='cval'>" + (c.status === "ok" ? "ok" : "!!") + "</span>" +
        "<span class='clabel'>" + c.label + " <b>" + c.value + "</b></span>" +
        "<span class='cdetail'>" + c.detail + "</span></div>";
    }).join("");
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest, printed by <code>node ingest-gapminder.mjs</code>, stored in the data file. " +
      "The reconciliation is the load-bearing one: the sum of the country rows has to equal OWID's own world " +
      "row, or the panel is missing a country and every weighted average above is wrong.</p>" +
      "<div class='checks'>" + body + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    var body = D.sources.map(function (s) {
      return "<div class='src'><strong>" + s.name + "</strong>" +
        "<span class='src-vintage'>" + s.provider + " · " + s.coverage + "</span>" +
        "<a href='" + s.url + "' target='_blank' rel='noopener'>source</a>" +
        (s.note ? "<p class='muted'>" + s.note + "</p>" : "") + "</div>";
    }).join("");
    host.innerHTML = "<h2>Sources and licence</h2>" +
      "<p>" + D.licence + "</p>" + body +
      "<p class='muted'>Generated " + D.generated + ". " + D.countries.length + " countries, " +
      D.years.length + " frames, " + D.range[0] + "–" + D.range[1] + ".</p>";
  }

  /* ------------------------------------------------------------ long charts */
  function renderLongRuns() {
    var gapHost = document.getElementById("incomeGap");
    if (gapHost) {
      var cfgGap = {
        years: D.years,
        left: { min: 400, max: 25000, log: true, fmt: function (v) { return money(v); } },
        yTicks: [500, 1000, 2000, 5000, 10000, 20000],
        xTicks: [1800, 1850, 1900, 1950, 2000, 2020],
        series: [
          { name: "median country", data: D.world.medianIncome, color: C.blue, dash: true, width: 1.6 },
          { name: "mean person", data: D.world.meanIncome, color: C.mint, width: 2.2 }
        ]
      };
      gapHost.innerHTML = lineChart(cfgGap);
      if (window.HOV) HOV.bind(gapHost, HOV.linear(cfgGap, cfgGap.__geom));
    }

    var spreadHost = document.getElementById("lifeSpread");
    if (spreadHost) {
      var p10 = [], p50 = [], p90 = [];
      for (var i = 0; i < D.years.length; i++) {
        var vals = [], wts = [];
        for (var k = 0; k < D.countries.length; k++) {
          vals.push(leAt(k, i));
          wts.push(popAt(k, i));
        }
        p10.push(weightedPercentile(vals, wts, 0.1));
        p50.push(weightedPercentile(vals, wts, 0.5));
        p90.push(weightedPercentile(vals, wts, 0.9));
      }
      var cfgSpread = {
        years: D.years,
        left: { min: 20, max: 90, fmt: function (v) { return Math.round(v); } },
        yTicks: [20, 30, 40, 50, 60, 70, 80],
        xTicks: [1800, 1850, 1900, 1950, 2000, 2020],
        series: [
          { name: "90th percentile", data: p90, color: C.amber, width: 1.4 },
          { name: "median", data: p50, color: C.mint, width: 2.2 },
          { name: "10th percentile", data: p10, color: C.red, width: 1.4 }
        ]
      };
      spreadHost.innerHTML = lineChart(cfgSpread);
      if (window.HOV) HOV.bind(spreadHost, HOV.linear(cfgSpread, cfgSpread.__geom));
    }
  }

  /* ------------------------------------------------------------- controls */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    /* year */
    var g = el("details", "lgroup");
    g.setAttribute("open", "");
    g.appendChild(el("summary", null, "Year" + '<i class="caret" aria-hidden="true"></i>'));
    var wrap = el("div", "ctl-year");
    var out = el("div", "ctl-year-out", "<b id='yearOut'>" + D.years[state.yi] + "</b><span id='yearNote'></span>");
    var range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = String(D.years.length - 1);
    range.step = "1";
    range.value = String(state.yi);
    range.id = "yearRange";
    range.setAttribute("aria-label", "Year");
    range.addEventListener("input", function () {
      stop();
      state.yi = +range.value;
      refresh();
    });
    var play = el("button", "ctl-play", "Play");
    play.type = "button";
    play.addEventListener("click", function () { state.playing ? stop() : start(); });
    var row = el("div", "ctl-row");
    row.appendChild(range);
    row.appendChild(play);
    wrap.appendChild(out);
    wrap.appendChild(row);
    g.appendChild(wrap);
    host.appendChild(g);

    /* regions */
    var g2 = el("details", "lgroup");
    g2.setAttribute("open", "");
    g2.appendChild(el("summary", null, "Regions" + '<i class="caret" aria-hidden="true"></i>'));
    var chips = el("div", "chips");
    D.regions.forEach(function (name, idx) {
      var b = el("button", "chip" + (state.regions[idx] ? " on" : ""), name);
      b.type = "button";
      b.style.setProperty("--chip", REGION_COLORS[idx]);
      b.addEventListener("click", function () {
        state.regions[idx] = !state.regions[idx];
        b.classList.toggle("on", state.regions[idx]);
        refresh();
      });
      chips.appendChild(b);
    });
    g2.appendChild(chips);
    host.appendChild(g2);

    /* trails */
    var g3 = el("details", "lgroup");
    g3.setAttribute("open", "");
    g3.appendChild(el("summary", null, "Trails" + '<i class="caret" aria-hidden="true"></i>'));
    var lab = el("label", "ctl-check");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.trails;
    cb.id = "trailToggle";
    cb.addEventListener("change", function () {
      state.trails = cb.checked;
      updateBubble();
    });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, "Show each country's path since 1800"));
    g3.appendChild(lab);
    host.appendChild(g3);
  }

  var timer = null;
  function start() {
    if (state.playing) return;
    if (state.yi >= D.years.length - 1) state.yi = 0;
    state.playing = true;
    syncPlayLabel();
    timer = setInterval(function () {
      if (state.yi >= D.years.length - 1) { stop(); return; }
      state.yi++;
      refresh(true);
    }, 150);
  }
  function stop() {
    state.playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    syncPlayLabel();
  }
  function syncPlayLabel() {
    var b = document.querySelector(".ctl-play");
    if (b) b.textContent = state.playing ? "Pause" : "Play";
  }

  /* ---------------------------------------------------------------- render */
  function refresh(light) {
    updateBubble();
    drawMountains();
    renderKpis();
    renderVerdict();
    var yOut = document.getElementById("yearOut");
    if (yOut) yOut.textContent = String(D.years[state.yi]);
    var note = document.getElementById("yearNote");
    if (note) {
      var inc = 0, tot = 0;
      for (var k = 0; k < D.countries.length; k++) {
        if (!inView(k)) continue;
        tot++;
        if (incAt(k, state.yi) != null && leAt(k, state.yi) != null) inc++;
      }
      note.textContent = inc + " of " + tot + " drawn";
    }
    if (light) return;
    renderLongRuns();
  }

  function renderLegend() {
    var host = document.getElementById("bubbleLegend");
    if (!host) return;
    host.innerHTML = D.regions.map(function (name, i) {
      return '<span style="color:' + REGION_COLORS[i] + '"><i style="background:' + REGION_COLORS[i] +
        ';border-radius:50%;width:9px;height:9px"></i><span style="color:#7e8d9e">' + name + "</span></span>";
    }).join("") + '<span><span style="color:#7e8d9e">area = population</span></span>';
  }

  function boot() {
    buildControls();
    buildBubble();
    renderLegend();
    renderCoverage();
    renderChecks();
    renderSources();
    renderLongRuns();
    refresh();

    var reset = document.getElementById("reset");
    if (reset) {
      reset.addEventListener("click", function () {
        stop();
        state.yi = D.years.length - 1;
        state.regions = [true, true, true, true, true];
        state.trails = false;
        var r = document.getElementById("yearRange");
        if (r) r.value = String(state.yi);
        buildControls();
        refresh();
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
