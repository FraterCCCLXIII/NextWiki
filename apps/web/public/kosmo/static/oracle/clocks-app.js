/* ============================================================================
   clocks-app.js — the two measured rates Century sits on.

   Left: how long people live, and how much of that is lived in health.
   Right: how fast training compute has grown, fitted rather than asserted.

   Both charts exist to replace a parameter with a measurement. Century's
   demography comes from the UN's shape and its automation curve from a
   compute-efficiency constant; neither number is visible anywhere on the page
   that depends on it, which is the defect these two views fix.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.CLOCKS;
  if (!D) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    return String(n).replace(/-/g, "⁻").replace(/[0-9]/g, function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; });
  }

  /* --------------------------------------------------------------- life ----- */
  function renderLife() {
    var host = document.getElementById("clockLife");
    if (!host) return;
    /* The year list is every year any country has data for, which starts in
       1543; the World aggregate starts in 1770. Beginning the axis at 1543 drew
       two centuries of empty plot before the first observation. */
    var i0 = D.life.world.findIndex(function (v) { return v != null; });
    if (i0 < 0) i0 = 0;
    var yrs = D.life.years.slice(i0), n = yrs.length;
    var world = D.life.world.slice(i0);
    var W = 900, H = 330;
    var m = { l: 46, r: 58, t: 16, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    function xOf(i) { return m.l + (yrs[i] - yrs[0]) / (yrs[n - 1] - yrs[0]) * iw; }
    function yOf(v) { return m.t + (1 - (v - 0) / 90) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"World life expectancy 1770 to 2023 with healthy life expectancy from 2000\">";
    [0, 30, 60, 90].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yOf(v).toFixed(1) +
        "\" y2=\"" + yOf(v).toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\"/>";
      s += txt(m.l - 7, yOf(v) + 3.5, v + "y", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [1770, 1850, 1900, 1950, 2000, 2023].forEach(function (y) {
      var i = yrs.indexOf(y);
      if (i < 0) return;
      s += txt(xOf(i), m.t + ih + 17, String(y), { anchor: "middle", size: 8.5, fill: C.dim2 });
    });

    function path(vals, colour, dash, width) {
      var d = "", open = false;
      for (var i = 0; i < n; i++) {
        var v = vals[i];
        if (v == null || !isFinite(v)) { open = false; continue; }
        d += (open ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1);
        open = true;
      }
      return d ? "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"" + width +
        "\" stroke-linejoin=\"round\"" + (dash ? " stroke-dasharray=\"5 4\"" : "") + "/>" : "";
    }

    s += path(world, C.mint, false, 2.2);

    /* HALE exists only from 2000, on its own sparse year list. */
    var haleVals = yrs.map(function (y) {
      var k = D.life.haleYears.indexOf(y);
      return k >= 0 ? D.life.hale[k] : null;
    });
    s += path(haleVals, C.amber, true, 1.8);

    /* The gap, drawn once at the last year both exist, because a shaded band
       across three years reads as a series and this is a single comparison. */
    var lastH = D.life.haleYears[D.life.haleYears.length - 1];
    var iH = yrs.indexOf(lastH);
    if (iH >= 0) {
      var le = world[iH], hale = D.life.hale[D.life.hale.length - 1];
      if (le != null && hale != null) {
        var x = xOf(iH);
        s += "<line x1=\"" + x.toFixed(1) + "\" x2=\"" + x.toFixed(1) + "\" y1=\"" + yOf(hale).toFixed(1) +
          "\" y2=\"" + yOf(le).toFixed(1) + "\" stroke=\"" + C.red + "\" stroke-width=\"1.2\" stroke-dasharray=\"3 3\"/>";
        s += txt(x - 6, (yOf(hale) + yOf(le)) / 2, (le - hale).toFixed(1) + "y", { anchor: "end", size: 8.5, fill: C.red });
        s += txt(m.l + iw + 6, yOf(le) - 2, le.toFixed(1), { size: 9, fill: C.mint });
        s += txt(m.l + iw + 6, yOf(hale) + 9, hale.toFixed(1), { size: 9, fill: C.amber });
      }
    }
    s += "</svg>";
    host.innerHTML = s;

    /* Life expectancy before 1900 is recorded for scattered years only, so the
       nearest index is usually a year with no observation and the card came up
       empty over most of the left half of the chart. Snap to the nearest year
       that actually has a figure. */
    var has = [];
    for (var q = 0; q < n; q++) if (world[q] != null) has.push(q);

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: xOf,
        xIndex: function (vx) {
          var t = (vx - m.l) / iw;
          if (t < -0.02 || t > 1.02) return null;
          if (!has.length) return null;
          var yr = yrs[0] + t * (yrs[n - 1] - yrs[0]), best = has[0], bd = 1e9;
          for (var i = 0; i < has.length; i++) {
            var d = Math.abs(yrs[has[i]] - yr);
            if (d < bd) { bd = d; best = has[i]; }
          }
          return best;
        },
        label: function (i) { return String(yrs[i]); },
        series: [
          {
            name: "Life expectancy", color: C.mint,
            val: function (i) { return world[i]; },
            yOf: yOf, fmt: function (v) { return v.toFixed(1) + " years"; }
          },
          {
            name: "Healthy life expectancy", color: C.amber, dash: true,
            val: function (i) {
              var k = D.life.haleYears.indexOf(yrs[i]);
              return k >= 0 ? D.life.hale[k] : null;
            },
            yOf: yOf, fmt: function (v) { return v.toFixed(1) + " years"; }
          }
        ]
      });
    }
  }

  /* --------------------------------------------------------------- gains ---- */
  function renderGains() {
    var host = document.getElementById("clockGains");
    if (!host) return;
    var rows = D.life.gains.filter(function (g) { return +g.decade.slice(0, 4) >= 1950; });
    if (!rows.length) return;

    var W = 430, H = 280;
    var m = { l: 34, r: 12, t: 14, b: 46 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = 0;
    rows.forEach(function (r) { if (r.perYear > max) max = r.perYear; });
    max = max * 1.1;

    var bw = iw / rows.length;
    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Years of life expectancy gained per decade since 1950\">";
    [0, max / 2, max].forEach(function (v) {
      var y = m.t + (1 - v / max) * ih;
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\"/>";
      s += txt(m.l - 6, y + 3.5, v.toFixed(1), { anchor: "end", size: 8.5, fill: C.dim2 });
    });
    rows.forEach(function (r, i) {
      var h = (r.perYear / max) * ih;
      var x = m.l + i * bw + bw * 0.18;
      var w = bw * 0.64;
      s += "<rect x=\"" + x.toFixed(1) + "\" y=\"" + (m.t + ih - h).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + h.toFixed(1) + "\" fill=\"" + (i === rows.length - 1 ? C.red : C.mint) +
        "\" fill-opacity=\"" + (i === rows.length - 1 ? "0.7" : "0.55") + "\"/>";
      s += txt(x + w / 2, m.t + ih + 13, r.decade.slice(0, 4), { anchor: "middle", size: 7.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 5, "years gained per year, by decade", { size: 8, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return m.l + i * bw + bw / 2; },
        xIndex: function (vx) {
          var i = Math.floor((vx - m.l) / bw);
          return i >= 0 && i < rows.length ? i : null;
        },
        label: function (i) { return rows[i].decade; },
        series: [{
          name: "Gained per year", color: C.mint,
          val: function (i) { return rows[i].perYear; },
          yOf: function (v) { return m.t + (1 - v / max) * ih; },
          fmt: function (v) { return v.toFixed(2) + " years a year"; }
        }]
      });
    }
  }

  /* -------------------------------------------------------------- compute --- */
  function renderCompute() {
    var host = document.getElementById("clockCompute");
    if (!host) return;
    var models = D.compute.models.filter(function (mm) { return mm.year >= 2010; });
    if (!models.length) return;

    var W = 900, H = 360;
    var m = { l: 60, r: 70, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var y0 = 2010, y1 = 2027;
    var lo = 14, hi = 27;      /* log10 FLOP */

    function xOf(y) { return m.l + (y - y0) / (y1 - y0) * iw; }
    function yOf(v) { return m.t + (1 - (Math.log10(Math.max(v, 1)) - lo) / (hi - lo)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Training compute of 474 models since 2010 on a logarithmic scale, with the fitted trend\">";
    for (var e = lo; e <= hi; e += 2) {
      var y = yOf(Math.pow(10, e));
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\"/>";
      s += txt(m.l - 7, y + 3.5, "10" + sup(e), { anchor: "end", size: 8.5, fill: C.dim2 });
    }
    [2010, 2014, 2018, 2022, 2026].forEach(function (yr) {
      s += txt(xOf(yr), m.t + ih + 16, String(yr), { anchor: "middle", size: 8.5, fill: C.dim2 });
    });

    models.forEach(function (mm) {
      var px = xOf(Math.min(Math.max(mm.year, y0), y1));
      var py = yOf(mm.flop);
      /* Outside either end of the axis, the point is not drawn rather than
         pinned to the edge: a dot on the floor of a log axis reads as a value
         that is in the data, and with overflow visible it would also paint
         outside the chart box. One run in this range sits just below 10¹⁴. */
      if (py < m.t - 4 || py > m.t + ih + 4) return;
      s += "<circle cx=\"" + px.toFixed(1) + "\" cy=\"" + py.toFixed(1) +
        "\" r=\"2\" fill=\"" + C.blue + "\" fill-opacity=\"0.5\"/>";
    });

    var fit = D.compute.fits.frontier;
    if (fit) {
      var xa = xOf(y0), xb = xOf(y1);
      var ya = yOf(Math.pow(10, fit.a + fit.slope * y0));
      var yb = yOf(Math.pow(10, fit.a + fit.slope * y1));
      s += "<line x1=\"" + xa.toFixed(1) + "\" y1=\"" + ya.toFixed(1) + "\" x2=\"" + xb.toFixed(1) +
        "\" y2=\"" + yb.toFixed(1) + "\" stroke=\"" + C.mint + "\" stroke-width=\"1.8\" stroke-dasharray=\"6 4\"/>";
    }

    var fr = D.compute.frontier.filter(function (p) { return p.year >= y0; });
    if (fr.length > 1) {
      var d = "";
      fr.forEach(function (p, i) {
        d += (i ? " L" : "M") + xOf(p.year).toFixed(1) + " " + yOf(p.flop).toFixed(1);
      });
      s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + C.amber + "\" stroke-width=\"1.4\" stroke-opacity=\"0.9\"/>";
    }

    /* Three labelled runs. The names matter more than the counts: this is the
       frontier the argument is usually about, not the median model. */
    var labelled = ["GPT-3", "GPT-4", "Grok 4"];
    labelled.forEach(function (name) {
      var mm = models.filter(function (p) { return p.name.indexOf(name) === 0; }).slice(-1)[0];
      if (!mm) return;
      var px = xOf(mm.year), py = yOf(mm.flop);
      s += "<circle cx=\"" + px.toFixed(1) + "\" cy=\"" + py.toFixed(1) + "\" r=\"3\" fill=\"" + C.amber + "\"/>";
      s += txt(px + 6, py + 3, name, { size: 8.5, fill: C.amber });
    });

    if (fit) {
      s += txt(m.l + iw + 6, m.t + 14, "doubling", { size: 8.5, fill: C.dim2 });
      s += txt(m.l + iw + 6, m.t + 26, fit.doublingMonths + " months", { size: 9.5, fill: C.mint });
      s += txt(m.l + iw + 6, m.t + 44, fit.xPerYear + "× a year", { size: 9, fill: C.dim });
    }
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      /* A scatter is not indexed by x, so the card reports the exact run under
         the cursor: nearest point in both axes, not nearest year. */
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function () { return 0; },
        xIndex: function (vx, vy) {
          var best = null, bd = 1e9;
          models.forEach(function (mm) {
            var dx = xOf(Math.min(Math.max(mm.year, y0), y1)) - vx;
            var dy = yOf(mm.flop) - vy;
            var d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = mm; }
          });
          return bd < 900 ? best : null;
        },
        label: function (p) { return p.name; },
        rows: function (p) {
          return [
            { name: "Training compute", color: C.amber, text: fmtFlop(p.flop) },
            { name: "Date", color: C.dim, text: p.year.toFixed(1) }
          ];
        }
      });
    }
  }

  function fmtFlop(v) {
    var e = Math.floor(Math.log10(v));
    return (v / Math.pow(10, e)).toFixed(1) + " × 10" + sup(e) + " FLOP";
  }

  /* -------------------------------------------------------------- readout --- */
  function renderReadout() {
    var host = document.getElementById("clockRead");
    if (!host) return;
    var g = D.life.gains;
    var recent = g[g.length - 1];
    var best = g.reduce(function (a, x) { return x.perYear > a.perYear ? x : a; }, g[0]);
    var gap = D.life.gap[D.life.gap.length - 1];
    var fit = D.compute.fits.frontier;
    var longFit = D.compute.fits.allLong;

    var s = "";
    s += "<div class='clockblock'><h3>The body clock</h3>" +
      "<p>World life expectancy went from <b>28.5 years in 1770 to 73.2 in 2023</b>, and the rate of gain has " +
      "been falling for sixty years: <b>+" + (best.perYear * 10).toFixed(1) + " years</b> across the " + best.decade +
      " decade, <b>+" + (recent.perYear * 10).toFixed(1) + " years</b> across " + recent.decade + ". " +
      "That is the shape the longevity argument has to contend with. Every decade of the twentieth century " +
      "bought less life than the one before it, because the cheap wins were water, sanitation, vaccines and " +
      "antibiotics, and each was a one-time purchase.</p>" +
      "<p>Of the " + (D.life.world[D.life.world.length - 1]).toFixed(1) + " years now expected, <b>" +
      gap.toFixed(1) + " are lived in poor health</b> (WHO, 2021). The compression-of-morbidity story &mdash; " +
      "that extra years arrive healthy &mdash; is the one that matters for a model like this, because a decade " +
      "of extra dependency costs the economy far more than a decade of extra work. The data does not yet show " +
      "compression: healthy life expectancy has risen more slowly than life expectancy every year it has been " +
      "measured.</p></div>";

    if (fit) {
      s += "<div class='clockblock'><h3>The machine clock</h3>" +
        "<p>Across <b>" + fit.n + " frontier records</b> since 2010, training compute has doubled every <b>" +
        fit.doublingMonths + " months</b> &mdash; a factor of " + fit.xPerYear + " a year, and a factor of about " +
        "10<sup>10</sup> over the period. The whole field moved at the same rate: fitted over all " +
        D.compute.fits.all.n + " runs from 2010 the answer is also " + D.compute.fits.all.doublingMonths +
        " months. That is not the usual claim and it is worth stating plainly, because it means the frontier is " +
        "not a different phenomenon from the rest of the distribution.</p>" +
        "<p>Over the whole record since 1950 the same fit gives <b>" + longFit.doublingMonths + " months</b>. " +
        "The acceleration is the finding, not the rate. And this is compute, not capability: the rate at which " +
        "<em>less compute is needed for the same result</em> is a separate measurement, roughly a halving every " +
        "eight months, and it is not in this dataset. Century's <code>compute efficiency</code> lever sets the " +
        "second rate; this chart fixes the first.</p></div>";
    }

    host.innerHTML = s;
  }

  function renderChecks() {
    var host = document.getElementById("clockChecks");
    if (!host || !D.checks) return;
    host.innerHTML = "<h3>The checks</h3>" +
      "<p>Run at ingest by <code>node ingest-clocks.mjs</code>. Each one is a statement the data could " +
      "have contradicted, and the two fits are reported separately rather than averaged.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check " + c.state + "'><span class='cval'>" +
          (c.state === "ok" ? "ok" : "!") + "</span><span class='clabel'>" + esc(c.label) +
          " <b>" + esc(c.value) + "</b></span><span class='cdetail'>" + esc(c.detail) + "</span></div>";
      }).join("") + "</div>";
  }

  renderLife();
  renderGains();
  renderCompute();
  renderReadout();
  renderChecks();

  window.addEventListener("resize", function () {
    clearTimeout(window.__clockT);
    window.__clockT = setTimeout(function () {
      renderLife(); renderGains(); renderCompute();
    }, 200);
  });
})();
