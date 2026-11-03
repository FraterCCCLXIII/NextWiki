/* ============================================================================
   information-app.js — renderer for `information.html`.

   Five line charts over three different x units (days, months, years) and one
   bar chart. They share a single drawing function, because the alternative is
   five copies of the same axis arithmetic drifting apart.

   Two rules this page follows strictly:
     - A share is only ever drawn against the same share of the same corpus.
     - Two survey instruments are never joined into one line, however tempting
       the resulting trend would look.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.INFORMATION;
  if (!D) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0", pink: "#c79aa6"
  };

  var state = { smooth: 28, allCountries: false, showPew: true, showWikiTotal: true };

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
  function legend(hostId, items) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = items.map(function (it) {
      return "<span style=\"display:inline-flex;align-items:center;gap:6px\">" +
        "<i class=\"" + (it.dash ? "dashed" : "") + "\" style=\"background:" + it.color +
        ";width:10px;height:2px;display:inline-block\"></i>" + esc(it.name) +
        (it.note ? " <span style=\"color:" + C.dim2 + "\">" + esc(it.note) + "</span>" : "") +
        "</span>";
    }).join("");
  }

  function rolling(vals, w) {
    if (w <= 1) return vals.slice();
    var out = [], half = w >> 1;
    for (var i = 0; i < vals.length; i++) {
      var s = 0, n = 0;
      for (var k = Math.max(0, i - half); k <= Math.min(vals.length - 1, i + half); k++) {
        if (vals[k] != null && isFinite(vals[k])) { s += vals[k]; n++; }
      }
      out.push(n ? s / n : null);
    }
    return out;
  }

  /* ---------------------------------------------------------- the one chart --- */

  /* o = { xs, series:[{name,values,color,dash,width,axis,dots}], left, right,
           xticks:[{i,label}], W, H, aria, xLabel, yLabel, perYear } */
  function chart(hostId, o) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var xs = o.xs, n = xs.length;
    if (n < 2) { host.innerHTML = "<p class='muted'>no data</p>"; return; }

    var W = o.W || 860, H = o.H || 340;
    var m = { l: 52, r: o.right ? 54 : 16, t: 14, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var L = o.left, R = o.right || null;
    var x0 = xs[0], x1 = xs[n - 1];

    function xOfV(v) { return m.l + (v - x0) / (x1 - x0) * iw; }
    function xOf(i) { return xOfV(xs[i]); }
    function yL(v) {
      if (L.log) {
        var lo = Math.log10(L.min), hi = Math.log10(L.max);
        return m.t + (1 - (Math.log10(Math.max(v, L.min * 0.9)) - lo) / (hi - lo)) * ih;
      }
      return m.t + (1 - (v - L.min) / (L.max - L.min)) * ih;
    }
    function yR(v) { return m.t + (1 - (v - R.min) / (R.max - R.min)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" + esc(o.aria || "") + "\">";

    (L.ticks || []).forEach(function (v) {
      var y = yL(v);
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.75\"/>";
      s += txt(m.l - 8, y + 3.5, L.fmt ? L.fmt(v) : String(v), { anchor: "end", size: 9, fill: C.dim2 });
    });
    if (R) {
      (R.ticks || []).forEach(function (v) {
        var y = yR(v);
        s += txt(m.l + iw + 8, y + 3.5, R.fmt ? R.fmt(v) : String(v), { size: 9, fill: C.dim2 });
      });
    }

    o.series.forEach(function (se) {
      var yOf = se.axis === "right" ? yR : yL;
      if (se.axis === "right" && !R) return;
      var d = "", open = false;
      for (var i = 0; i < n; i++) {
        var v = se.values[i];
        if (v == null || !isFinite(v)) { open = false; continue; }
        d += (open ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1);
        open = true;
      }
      if (d) {
        s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + se.color + "\" stroke-width=\"" +
          (se.width || 1.6) + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" +
          (se.dash ? " stroke-dasharray=\"5 4\"" : "") +
          (se.opacity != null ? " stroke-opacity=\"" + se.opacity + "\"" : "") + "/>";
      }
      if (se.dots) {
        for (var j = 0; j < n; j++) {
          var vv = se.values[j];
          if (vv == null || !isFinite(vv)) continue;
          s += "<circle cx=\"" + xOf(j).toFixed(1) + "\" cy=\"" + yOf(vv).toFixed(1) +
            "\" r=\"2.4\" fill=\"" + se.color + "\"/>";
        }
      }
    });

    (o.xticks || []).forEach(function (t) {
      if (t.i < 0 || t.i >= n) return;
      s += txt(xOf(t.i), m.t + ih + 17, t.label, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    if (o.xLabel) s += txt(W - 8, H - 4, o.xLabel, { anchor: "end", size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: xOf,
        xIndex: function (vx) {
          var t = (vx - m.l) / iw;
          /* a pointer well outside the plot should clear the card, not clamp to
             an edge — but one just inside it must clamp: rounding to the next
             index past the last point returned null, so the rightmost 1% of
             every chart on this page showed no values at all. */
          if (t < -0.02 || t > 1.02) return null;
          var i = Math.round(t * (n - 1));
          return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
        },
        label: function (i) { return o.label ? o.label(i) : String(xs[i]); },
        series: o.series.filter(function (se) { return !se.hidden; }).map(function (se) {
          var ax = se.axis === "right" && R ? R : L;
          return {
            name: se.name,
            color: se.color,
            dash: se.dash,
            val: function (i) {
              var v = se.values[i];
              return v == null || !isFinite(v) ? null : v;
            },
            yOf: se.axis === "right" && R ? yR : yL,
            fmt: (se.axis === "right" && R ? R.fmt : L.fmt) || ax.fmt
          };
        })
      });
    }
  }

  /* ------------------------------------------------------------------- KPIs --- */
  function lastN(vals, k) {
    var out = [];
    for (var i = vals.length - 1; i >= 0 && out.length < k; i--) {
      if (vals[i] != null && isFinite(vals[i])) out.push(vals[i]);
    }
    return out.length ? out.reduce(function (a, b) { return a + b; }, 0) / out.length : null;
  }

  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;

    var aiNow = D.news.stats ? D.news.stats.last : null;
    var aiThen = D.news.stats ? D.news.stats.first : null;
    var cl = D.news.climate.length ? lastN(D.news.climate.map(function (r) { return r.value; }), 30) : null;
    var peak = null, peakAt = null;
    if (D.wiki.per10k) {
      D.wiki.per10k.forEach(function (v, i) {
        if (v != null && (peak == null || v > peak)) { peak = v; peakAt = D.wiki.months[i]; }
      });
    }
    var attNow = D.wiki.per10k ? D.wiki.per10k.reduce(function (a, v) { return v != null ? v : a; }, null) : null;
    var g = D.trust.gallup.points[D.trust.gallup.points.length - 1];

    var cards = [];
    if (aiNow != null) {
      cards.push(["AI, share of all news", aiNow.toFixed(2) + "%",
        "from " + aiThen.toFixed(2) + "% in January 2017 &mdash; &times;" + (aiNow / aiThen).toFixed(1), true]);
    }
    if (aiNow != null && cl != null) {
      cards.push(["Against climate coverage", (aiNow / cl).toFixed(1) + "&times;",
        "climate change sits at " + cl.toFixed(2) + "% of all news", false]);
    }
    if (attNow != null) {
      cards.push(["Attention per 10,000 views", attNow.toFixed(2),
        "peak " + peak.toFixed(1) + " in " + monthName(peakAt), false]);
    }
    cards.push(["US trust in mass media", g.pct + "%",
      g.year + ", the lowest Gallup has recorded", false]);

    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function monthName(mo) {
    if (!mo) return "";
    var names = ["January", "February", "March", "April", "May", "June", "July",
      "August", "September", "October", "November", "December"];
    var p = mo.split("-");
    return names[+p[1] - 1] + " " + p[0];
  }

  /* ------------------------------------------------------------------- news --- */
  function renderNews() {
    var rows = D.news.ai;
    if (!rows.length) {
      var h = document.getElementById("chartNews");
      if (h) h.innerHTML = "<p class='muted'>GDELT did not answer and no snapshot was on file. " +
        "The other panels are unaffected.</p>";
      return;
    }
    var xs = rows.map(function (r, i) { return i; });
    var ai = rolling(rows.map(function (r) { return r.value; }), state.smooth);

    var cl = D.news.climate;
    var clVals = cl.length === rows.length
      ? rolling(cl.map(function (r) { return r.value; }), state.smooth)
      : null;

    /* Year ticks come from the dates themselves rather than from an index
       stride, because a year is not a fixed number of daily records. */
    var ticks = [], lastY = null;
    rows.forEach(function (r, i) {
      var y = r.date.slice(0, 4);
      if (y !== lastY) { ticks.push({ i: i, label: y === String(+y) ? y : y }); lastY = y; }
    });
    ticks = ticks.filter(function (t, i) { return i % 2 === 0 || i === ticks.length - 1; });

    var max = 0;
    ai.concat(clVals || []).forEach(function (v) { if (v != null && v > max) max = v; });
    max = Math.ceil(max * 1.15 * 10) / 10;

    var series = [{ name: "Artificial intelligence", values: ai, color: C.mint, width: 1.8 }];
    if (clVals) series.push({ name: "Climate change", values: clVals, color: C.amber, width: 1.5 });

    chart("chartNews", {
      xs: xs, series: series,
      left: { min: 0, max: max, ticks: [0, max / 4, max / 2, 3 * max / 4, max].map(function (v) { return +v.toFixed(2); }),
        fmt: function (v) { return v.toFixed(1) + "%"; } },
      xticks: ticks,
      label: function (i) { return dayLabel(rows[i].date); },
      aria: "Share of all monitored news mentioning artificial intelligence or climate change, 2017 to 2026",
      W: 900, H: 350, xLabel: "share of all monitored articles"
    });

    legend("legendNews", series.map(function (s) {
      return { name: s.name, color: s.color, note: "" };
    }));

    var note = document.getElementById("noteNews");
    if (note) {
      var lastDate = rows[rows.length - 1].date;
      var stale = D.news.status.ai && D.news.status.ai.indexOf("stale") >= 0;
      note.innerHTML = "<p class='muted'>Series on file: " + rows.length.toLocaleString("en-US") +
        " daily observations, " + rows[0].date + " to " + lastDate + ". " +
        (stale
          ? "The refresh was refused by GDELT's rate limit, so these are the last figures that arrived &mdash; the panel is " +
            "dated rather than current, and says so."
          : "Refreshed from GDELT on " + D.asOf + ".") +
        (cl.length ? "" : " The climate series did not arrive and is not drawn.") + "</p>";
    }
  }

  function dayLabel(iso) {
    var d = new Date(iso + "T00:00:00Z");
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return d.getUTCDate() + " " + names[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  /* -------------------------------------------------------------- attention --- */
  function renderAttention() {
    var months = D.wiki.months;
    var xs = months.map(function (m, i) { return i; });
    var ticks = [];
    months.forEach(function (m, i) {
      if (m.slice(5) === "01") ticks.push({ i: i, label: m.slice(0, 4) });
    });

    var series = [
      { name: "AI basket, per 10,000 views", values: D.wiki.per10k, color: C.mint, width: 1.9 }
    ];
    if (D.wiki.total && state.showWikiTotal) {
      series.push({
        name: "All English Wikipedia views, billions",
        values: D.wiki.total.map(function (v) { return v == null ? null : v / 1e9; }),
        color: C.steel, width: 1.2, dash: true, axis: "right"
      });
    }

    var max = 0;
    D.wiki.per10k.forEach(function (v) { if (v != null && v > max) max = v; });
    max = Math.ceil(max * 1.12);

    chart("chartAttention", {
      xs: xs, series: series,
      left: { min: 0, max: max, ticks: [0, max / 3, 2 * max / 3, max].map(function (v) { return +v.toFixed(1); }),
        fmt: function (v) { return v.toFixed(1); } },
      right: D.wiki.total && state.showWikiTotal
        ? { min: 0, max: 10, ticks: [0, 2.5, 5, 7.5, 10], fmt: function (v) { return v.toFixed(1) + "B"; } }
        : null,
      xticks: ticks,
      /* the label takes the index, not the month string — passing monthName
         directly threw inside the hover handler and silently left the card
         showing whatever the previous chart had put there */
      label: function (i) { return monthName(months[i]); },
      aria: "Attention to ten AI articles per ten thousand English Wikipedia views, monthly, 2016 to 2026",
      W: 900, H: 340
    });

    legend("legendAttention", series.map(function (s) {
      return { name: s.name, color: s.color, dash: s.dash };
    }));
  }

  /* --------------------------------------------------------------- freedom --- */
  var FREEDOM_PICKS = {
    "United States": C.blue, "China": C.red, "Russia": C.violet,
    "Brazil": C.amber, "India": C.teal, "Germany": C.mint,
    "Nigeria": C.pink, "Japan": C.steel
  };
  var FREEDOM_DEFAULT = ["United States", "China", "Russia", "Brazil"];

  function renderFreedom() {
    var years = D.foe.years;
    var xs = years.map(function (y) { return y; });
    var series = [{ name: "Mean across countries", values: D.foe.world, color: C.mint, width: 2.4 }];

    var shown = state.allCountries ? Object.keys(FREEDOM_PICKS) : FREEDOM_DEFAULT;
    D.foe.picks.forEach(function (p) {
      if (shown.indexOf(p.name) < 0) return;
      series.push({ name: p.name, values: p.values, color: FREEDOM_PICKS[p.name] || C.dim, width: 1.1, opacity: 0.85 });
    });

    var ticks = [];
    for (var y = 1800; y <= 2025; y += 25) {
      var i = years.indexOf(y);
      if (i >= 0) ticks.push({ i: i, label: String(y) });
    }

    chart("chartFreedom", {
      xs: xs, series: series,
      left: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: function (v) { return v.toFixed(2); } },
      xticks: ticks,
      label: function (i) { return String(years[i]); },
      aria: "Freedom of expression index by country, 1789 to 2025",
      W: 900, H: 340
    });

    legend("legendFreedom", series.map(function (s) {
      return { name: s.name, color: s.color };
    }));
  }

  /* ----------------------------------------------------------------- reach --- */
  function renderReach() {
    var years = D.net.years;
    var xs = years.map(function (y) { return y; });
    var show = ["United States", "China", "India", "Nigeria"];
    var series = [{ name: "World", values: D.net.world, color: C.mint, width: 2.3 }];
    var colours = { "United States": C.blue, "China": C.red, "India": C.amber, "Nigeria": C.violet };
    D.net.picks.forEach(function (p) {
      if (show.indexOf(p.name) < 0) return;
      series.push({ name: p.name, values: p.values, color: colours[p.name] || C.dim, width: 1.2 });
    });

    chart("chartReach", {
      xs: xs, series: series,
      left: { min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: function (v) { return v.toFixed(0); } },
      xticks: [1990, 2000, 2010, 2020, 2025].map(function (y) {
        return { i: years.indexOf(y), label: String(y) };
      }).filter(function (t) { return t.i >= 0; }),
      label: function (i) { return String(years[i]); },
      aria: "Share of the population using the internet, world and four countries",
      W: 430, H: 300, xLabel: "% of population"
    });

    legend("legendReach", series.map(function (s) { return { name: s.name, color: s.color }; }));
  }

  /* ----------------------------------------------------------------- trust --- */
  function renderTrust() {
    var host = document.getElementById("chartTrust");
    if (!host) return;

    var g = D.trust.gallup.points;
    var p = D.trust.pew.points;
    var e = D.trust.edelman.points;

    var W = 430, H = 300;
    var m = { l: 40, r: 14, t: 14, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var x0 = 1970, x1 = 2028;

    function xOf(y) { return m.l + (y - x0) / (x1 - x0) * iw; }
    function yOf(v) { return m.t + (1 - v / 100) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Trust in news, Gallup and Pew, by year\">";
    [0, 25, 50, 75, 100].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yOf(v).toFixed(1) +
        "\" y2=\"" + yOf(v).toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\"/>";
      s += txt(m.l - 7, yOf(v) + 3.5, v + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [1972, 1990, 2010, 2026].forEach(function (y) {
      s += txt(xOf(y), m.t + ih + 16, String(y), { anchor: "middle", size: 8.5, fill: C.dim2 });
    });

    function path(points, colour, dash) {
      var d = "", open = false;
      points.forEach(function (pt) {
        d += (open ? " L" : "M") + xOf(pt.year).toFixed(1) + " " + yOf(pt.pct).toFixed(1);
        open = true;
      });
      return "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + colour + "\" stroke-width=\"1.6\"" +
        (dash ? " stroke-dasharray=\"5 4\"" : "") + " stroke-linejoin=\"round\"/>";
    }
    function dots(points, colour) {
      return points.map(function (pt) {
        return "<circle cx=\"" + xOf(pt.year).toFixed(1) + "\" cy=\"" + yOf(pt.pct).toFixed(1) +
          "\" r=\"2.6\" fill=\"" + colour + "\"/>";
      }).join("");
    }

    s += path(g, C.blue, false) + dots(g, C.blue);
    if (state.showPew) s += path(p, C.amber, true) + dots(p, C.amber);
    s += dots(e, C.violet);
    s += "</svg>";
    host.innerHTML = s;

    var all = [];
    g.forEach(function (pt) { all.push({ year: pt.year, pct: pt.pct, name: "Gallup, great deal or fair amount", color: C.blue, dash: false }); });
    if (state.showPew) p.forEach(function (pt) { all.push({ year: pt.year, pct: pt.pct, name: "Pew, a lot or some", color: C.amber, dash: true }); });
    e.forEach(function (pt) { all.push({ year: pt.year, pct: pt.pct, name: "Edelman, media as an institution", color: C.violet, dash: false }); });

    if (window.HOV) {
      /* The x grid is the union of years, and each series reads the nearest
         point within half a year; the surveys were not fielded on the same
         dates, so a shared index would join the wrong observations. */
      var grid = all.map(function (a) { return a.year; }).sort(function (a, b) { return a - b; });
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return xOf(grid[i]); },
        xIndex: function (vx) {
          var t = (vx - m.l) / iw;
          if (t < -0.03 || t > 1.03) return null;
          var yr = x0 + t * (x1 - x0), best = 0, bd = 1e9;
          for (var i = 0; i < grid.length; i++) {
            var d = Math.abs(grid[i] - yr);
            if (d < bd) { bd = d; best = i; }
          }
          return best;
        },
        label: function (i) { return String(Math.round(grid[i])); },
        series: all.map(function (a) {
          return {
            name: a.name, color: a.color, dash: a.dash,
            val: function (i) { return Math.abs(a.year - grid[i]) <= 0.51 ? a.pct : null; },
            yOf: yOf,
            fmt: function (v) { return v.toFixed(0) + "%"; }
          };
        })
      });
    }

    legend("legendTrust", [
      { name: "Gallup, since 1972", color: C.blue },
      { name: "Pew, since 2016", color: C.amber, dash: true },
      { name: "Edelman, 2024", color: C.violet }
    ]);
  }

  /* --------------------------------------------------------- concentration --- */
  function renderConcentration() {
    var host = document.getElementById("chartConcentration");
    if (!host || !D.wiki.leaders) return;
    var rows = D.wiki.leaders;
    var W = 430, H = 300;
    var m = { l: 120, r: 34, t: 10, b: 26 };
    var iw = W - m.l - m.r;
    var rowH = (H - m.t - m.b) / rows.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Share of basket views by article\">";
    rows.forEach(function (r, i) {
      var y = m.t + i * rowH;
      var w = Math.max(1, (r.share / 100) * iw);
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + rowH * 0.22).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH * 0.42).toFixed(1) + "\" fill=\"" + (i === 0 ? C.mint : C.steel) +
        "\" fill-opacity=\"" + (i === 0 ? "0.85" : "0.55") + "\"/>";
      s += txt(m.l - 8, y + rowH * 0.52, r.article, { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(m.l + w + 6, y + rowH * 0.52, r.share.toFixed(0) + "%", { size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 6, "share of the ten-article basket's lifetime views", { size: 8, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
  }

  /* ---------------------------------------------------------------- verdict --- */
  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var aiNow = D.news.stats ? D.news.stats.last : null;
    var aiThen = D.news.stats ? D.news.stats.first : null;
    var peak = null, peakAt = null;
    if (D.wiki.per10k) {
      D.wiki.per10k.forEach(function (v, i) {
        if (v != null && (peak == null || v > peak)) { peak = v; peakAt = D.wiki.months[i]; }
      });
    }
    var g = D.trust.gallup.points;
    var last = g[g.length - 1];

    var s = "<h2>What this page shows</h2>";

    if (aiNow != null) {
      s += "<p><span class='tag green'>measured, daily</span> Coverage of artificial intelligence went from " +
        aiThen.toFixed(2) + "% of every monitored news article in January 2017 to " + aiNow.toFixed(2) +
        "% at the end of the series &mdash; a " + (aiNow / aiThen).toFixed(1) +
        "&times; increase in share, so it displaced other subjects rather than riding a growing corpus. " +
        "Climate change, the comparison, moved from 0.59% to 0.70%. The machine now gets roughly two and a half " +
        "times the news share of the climate.</p>";
    }

    if (peak) {
      s += "<p><span class='tag amber'>a spike, then a level</span> Attention to ten AI articles peaked at " +
        peak.toFixed(1) + " views per 10,000 of English Wikipedia in " + monthName(peakAt) +
        ", and has settled near " + (D.wiki.per10k[D.wiki.per10k.length - 1] || 0).toFixed(1) +
        ". That shape &mdash; a step change followed by decay to a plateau several times the old level " +
        "&mdash; is what adoption looks like in reading behaviour, and it is the opposite of a bubble " +
        "deflating to nothing.</p>";
    }

    if (D.wiki.total) {
      var t0 = D.wiki.total[0], tn = D.wiki.total[D.wiki.total.length - 1];
      s += "<p><span class='tag dim'>the denominator</span> English Wikipedia lost " +
        Math.round((1 - tn / t0) * 100) + "% of its monthly audience over the decade " +
        "(" + (t0 / 1e9).toFixed(1) + "B views to " + (tn / 1e9).toFixed(1) +
        "B). Some of the rise in AI's share is therefore the shrinking of the whole, and a page that " +
        "plotted only the numerator would be measuring the numerator.</p>";
    }

    if (last) {
      s += "<p><span class='tag red'>the part that matters for the model</span> Trust in mass media in the " +
        "United States stands at " + last.pct + "% (" + last.year + "), the lowest in the series that began in 1972, " +
        "and the partisan split is 51 / 27 / 8 across Democrats, independents and Republicans. " +
        "An economy whose expectations are made of news is an economy running on an instrument in which " +
        "seven in ten people have little or no confidence. The Dark Factory model has a term for expectations " +
        "and no term for this.</p>";
    }

    var diff = D.foeNetR && D.foeNetR.diffR;
    if (diff != null) {
      s += "<p><span class='tag dim'>what this cannot say</span> Freedom of expression and internet access " +
        "correlate at r = " + (D.foeNetR.r).toFixed(2) + " in levels, which looks like a finding and is not: " +
        "both series trend over the same twenty years. Differenced, the same pair gives r = " +
        diff.toFixed(2) + " on " + D.foeNetR.diffN + " year-on-year changes. Reach and permission are close " +
        "to independent, and this page will not claim otherwise.</p>";
    }

    host.innerHTML = s;
  }

  /* ----------------------------------------------------------------- checks --- */
  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-information.mjs</code>, and stored in the data file alongside " +
      "the series they describe. The two warnings are kept rather than silenced: one is a deliberately " +
      "reported artifact, the other is what a rate-limited refresh looks like.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check " + c.state + "'><span class='cval'>" +
          (c.state === "ok" ? "ok" : c.state === "warn" ? "!" : "i") + "</span>" +
          "<span class='clabel'>" + esc(c.label) + " <b>" + esc(c.value) + "</b></span>" +
          "<span class='cdetail'>" + esc(c.detail) + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" + D.sources.map(function (s) {
      return "<div class='src'><b>" + esc(s.name) + "</b> &mdash; " + esc(s.what) +
        "<p><a href='" + s.url + "' target='_blank' rel='noopener'>" + esc(s.url.replace(/^https?:\/\//, "")) +
        "</a><br>" + esc(s.note) + "</p></div>";
    }).join("") +
      "<div class='src'><b>On the trust series</b> &mdash; the 'great deal or fair amount' question that runs " +
      "from the 1970s is Gallup's, not Pew's; Pew's own series begins in 2016 and asks 'a lot or some', " +
      "which is a looser test and returns higher numbers. Both are plotted, separately, and the page does " +
      "not draw a line between them.<p>Edelman's 2024 figure is trust in media as an institution, a third " +
      "question again, and appears as a single point for that reason.</p></div>";
  }

  /* --------------------------------------------------------------- controls --- */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g = document.createElement("details");
    g.className = "lgroup";
    g.innerHTML = "<summary>Chart views<i class='caret' aria-hidden='true'></i></summary>";

    var wrap = document.createElement("div");
    wrap.className = "lever";
    var lab = document.createElement("label");
    lab.className = "lever-top";
    lab.innerHTML = "<span class='lever-name'>News smoothing</span><b class='lever-val' id='v_smooth'>28 days</b>";
    var sel = document.createElement("select");
    sel.id = "smoothSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    [[1, "1 day, raw"], [28, "28 days"], [91, "91 days"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      if (o[0] === state.smooth) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      state.smooth = +sel.value;
      document.getElementById("v_smooth").textContent =
        state.smooth === 1 ? "raw" : state.smooth + " days";
      renderNews();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    g.appendChild(toggle("All eight countries", "On the freedom of expression chart", state.allCountries, function (v) {
      state.allCountries = v; renderFreedom();
    }));
    g.appendChild(toggle("Pew's trust series", "A different question from Gallup's", state.showPew, function (v) {
      state.showPew = v; renderTrust();
    }));
    g.appendChild(toggle("Wikipedia's own audience", "The denominator, on a second axis", state.showWikiTotal, function (v) {
      state.showWikiTotal = v; renderAttention();
    }));

    host.appendChild(g);
  }

  function toggle(name, note, initial, onchange) {
    var wrap = document.createElement("div");
    wrap.className = "lever";
    var lab = document.createElement("label");
    lab.className = "lever-top";
    lab.innerHTML = "<span class='lever-name'>" + name + "</span>";
    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!initial;
    chk.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk.addEventListener("change", function () { onchange(chk.checked); });
    wrap.appendChild(lab);
    wrap.appendChild(chk);
    var p = document.createElement("p");
    p.className = "blurb";
    p.textContent = note;
    wrap.appendChild(p);
    return wrap;
  }

  /* ------------------------------------------------------------------- init --- */
  renderKpis();
  renderVerdict();
  renderNews();
  renderAttention();
  renderFreedom();
  renderReach();
  renderTrust();
  renderConcentration();
  renderChecks();
  renderSources();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.smooth = 28; state.allCountries = false; state.showPew = true; state.showWikiTotal = true;
      var sel = document.getElementById("smoothSel");
      if (sel) sel.value = "28";
      var vs = document.getElementById("v_smooth");
      if (vs) vs.textContent = "28 days";
      Array.prototype.forEach.call(document.querySelectorAll("#controls input[type=checkbox]"), function (c) {
        c.checked = true;
      });
      var first = document.querySelectorAll("#controls input[type=checkbox]")[0];
      if (first) first.checked = false;
      renderNews(); renderAttention(); renderFreedom(); renderTrust();
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.rt);
    state.rt = setTimeout(function () {
      renderNews(); renderAttention(); renderFreedom(); renderReach(); renderTrust(); renderConcentration();
    }, 200);
  });
})();
