/* ============================================================================
   hover.js — one crosshair and one value card for every chart on the site.

   Each chart has its own renderer (four of them, in different files) but they
   all share the same problem: the SVG is a string of paths with no values in
   the DOM, so a pointer over a line knows nothing about the data behind it.

   The solution is a small contract. A renderer, having already drawn itself,
   hands over a model:

     { W, H,                                  // viewBox, not pixels
       top, bottom,                           // plot rectangle, vertical
       xOf(i) -> svg x,
       xIndex(svgX) -> i | null,
       label(i) -> string,
       yOf(v) -> svg y,                       // default for every series
       series: [{ name, color, dash, val(i), fmt(v), yOf?(v) }],
       rows?(i, svgX, svgY) -> [{ name, color, text, dash }] }

   Everything here is generic over that. `linear()` builds the model for the
   four charts that use a plain year axis; the two odd charts (histogram,
   threshold ladder) and the Century fan build their own.

   The card is a single element reused by every chart, positioned with a
   transform, so hovering never lays out the page.
   ============================================================================ */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var tip = null;
  var listenerAdded = false;

  /* ------------------------------------------------------------- formatting */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* Fallback only: charts almost always supply their own formatter, which
     knows whether the number is a percent, a trillion dollars or a year. */
  function num(v) {
    if (v == null || !isFinite(v)) return "–";
    var a = Math.abs(v);
    if (a === 0) return "0";
    if (a >= 1000) return Math.round(v).toLocaleString("en-US");
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(1).replace(/\.0$/, "");
    if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, "");
    return v.toFixed(a < 0.01 ? 4 : 3).replace(/0+$/, "");
  }

  function tipEl() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "hov-tip";
    tip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tip);
    return tip;
  }

  /* ------------------------------------------------------------ svg overlay */
  function ensureLayer(svg, n) {
    var g = svg.querySelector("g.hov-layer");
    if (!g) {
      g = document.createElementNS(NS, "g");
      g.setAttribute("class", "hov-layer");
      svg.appendChild(g);
      var line = document.createElementNS(NS, "line");
      line.setAttribute("class", "hov-guide");
      g.appendChild(line);
    }
    /* circles are pooled: a pointermove allocates nothing once they exist */
    var dots = g.querySelectorAll("circle.hov-dot");
    for (var i = dots.length; i < n; i++) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("class", "hov-dot");
      c.setAttribute("r", "3");
      g.appendChild(c);
    }
    return { g: g, line: g.firstChild, dots: g.querySelectorAll("circle.hov-dot") };
  }

  function hide() {
    if (tip) tip.classList.remove("on");
    var hosts = document.querySelectorAll(".hov-host.hov-on");
    for (var i = 0; i < hosts.length; i++) hosts[i].classList.remove("hov-on");
  }

  function move(e) {
    var host = e.currentTarget;
    var model = host.__hov;
    if (!model) return hide();
    /* the Century fan uses pointerdown for panning; a crosshair mid-drag is noise */
    if (host.classList.contains("dragging")) return hide();

    var svg = host.querySelector("svg");
    if (!svg) return hide();
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return hide();

    var vx = (e.clientX - r.left) * (model.W / r.width);
    var vy = (e.clientY - r.top) * (model.H / r.height);
    if (vx < 0 || vx > model.W || vy < 0 || vy > model.H) return hide();

    /* vy is passed too: a dot plot picks its row vertically, not horizontally */
    var i = model.xIndex(vx, vy);
    if (i == null || i < 0) return hide();

    var layer = ensureLayer(svg, (model.series || []).length);
    var x = model.xOf(i);

    var rows;
    if (model.rows) {
      rows = model.rows(i, vx, vy) || [];
      layer.line.setAttribute("x1", x); layer.line.setAttribute("x2", x);
      layer.line.setAttribute("y1", model.top); layer.line.setAttribute("y2", model.bottom);
      for (var d = 0; d < layer.dots.length; d++) layer.dots[d].style.display = "none";
    } else {
      rows = [];
      var si = 0;
      (model.series || []).forEach(function (s) {
        var v = s.val(i);
        var dot = layer.dots[si++];
        if (v == null || !isFinite(v)) {
          if (dot) dot.style.display = "none";
          return;
        }
        var y = s.yOf ? s.yOf(v) : (model.yOf ? model.yOf(v) : null);
        if (y == null || !isFinite(y)) {
          if (dot) dot.style.display = "none";
          return;
        }
        if (dot) {
          dot.style.display = "";
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", y);
          dot.setAttribute("fill", s.color);
        }
        rows.push({
          name: s.name,
          color: s.color,
          dash: !!s.dash,
          text: s.text ? s.text(i) : (s.fmt ? s.fmt(v) : num(v))
        });
      });
      layer.line.setAttribute("x1", x); layer.line.setAttribute("x2", x);
      layer.line.setAttribute("y1", model.top);
      layer.line.setAttribute("y2", model.bottom);
    }

    if (!rows.length) return hide();

    var html = '<div class="hov-head">' + esc(model.label(i)) + "</div>";
    rows.forEach(function (row) {
      html += '<div class="hov-row">' +
        '<i' + (row.dash ? ' class="dash"' : "") + ' style="background:' + row.color + '"></i>' +
        '<span class="hov-name">' + esc(row.name) + "</span>" +
        "<b>" + esc(row.text) + "</b></div>";
    });

    var t = tipEl();
    t.innerHTML = html;
    t.classList.add("on");
    host.classList.add("hov-on");

    /* keep the card inside the window without ever covering the cursor */
    var tw = t.offsetWidth, th = t.offsetHeight;
    var left = e.clientX + 16;
    if (left + tw > window.innerWidth - 10) left = e.clientX - tw - 16;
    if (left < 8) left = 8;
    var top = e.clientY - th - 14;
    if (top < 8) top = e.clientY + 18;
    if (top + th > window.innerHeight - 8) top = window.innerHeight - th - 8;
    t.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
  }

  function bind(host, model) {
    if (!host || !model) return;
    host.__hov = model;
    if (!listenerAdded) {
      listenerAdded = true;
      /* the card is position:fixed, so any scroll invalidates where it sits */
      window.addEventListener("scroll", hide, true);
      window.addEventListener("resize", hide);
    }
    if (host.__hovBound) return;
    host.__hovBound = true;
    host.classList.add("hov-host");
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerdown", move);
    host.addEventListener("pointerleave", hide);
    host.addEventListener("pointercancel", hide);
  }

  /* ------------------------------------------------- the plain-year model */
  /* Everything except the histogram, the threshold ladder and the Century fan
     shares one geometry: years along x, values on a left and/or right axis. */
  function nearestIndex(yrs, target) {
    var n = yrs.length, lo = 0, hi = n - 1;
    if (!n) return null;
    if (n === 1) return 0;
    if (target <= yrs[0]) return 0;
    if (target >= yrs[hi]) return hi;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (yrs[mid] <= target) lo = mid; else hi = mid;
    }
    return (target - yrs[lo]) <= (yrs[hi] - target) ? lo : hi;
  }

  function linear(cfg, meta, opts) {
    opts = opts || {};
    var yrs = cfg.years || [];
    var m = meta.m, n = yrs.length;
    var series = [];
    var src = (cfg.series || []).slice();
    if (cfg.stack) src = src.concat(cfg.stack);

    src.forEach(function (se) {
      if (!se.name || !se.data) return;
      var ax = (se.axis === "right" ? cfg.right : cfg.left) || cfg.left;
      if (!ax || !(ax.max > ax.min)) return;
      var lo = ax.log ? Math.log10(ax.min) : 0;
      var hi = ax.log ? Math.log10(ax.max) : 0;
      series.push({
        name: se.name,
        color: se.color,
        dash: !!se.dash,
        val: function (i) {
          var v = se.data[i];
          if (v == null || !isFinite(v)) return null;
          if (ax.log && v <= 0) return null;
          return v;
        },
        /* log axes clamp exactly as the renderer does, or the dot slides off
           the line it belongs to near the floor of the axis */
        yOf: function (v) {
          if (ax.log) {
            return m.t + (1 - (Math.log10(Math.max(v, ax.min * 0.4)) - lo) / (hi - lo)) * meta.ih;
          }
          return m.t + (1 - (v - ax.min) / (ax.max - ax.min)) * meta.ih;
        },
        fmt: ax.fmt
      });
    });

    return {
      W: meta.W,
      H: meta.H,
      top: m.t,
      bottom: m.t + meta.ih,
      xOf: function (i) {
        if (n < 2) return m.l;
        return m.l + (yrs[i] - yrs[0]) / (yrs[n - 1] - yrs[0]) * meta.iw;
      },
      xIndex: function (vx) {
        if (n < 2) return 0;
        var t = (vx - m.l) / meta.iw;
        var target = yrs[0] + t * (yrs[n - 1] - yrs[0]);
        return nearestIndex(yrs, target);
      },
      label: opts.label || function (i) { return String(yrs[i]); },
      yOf: function (v) {
        return m.t + (1 - (v - cfg.left.min) / (cfg.left.max - cfg.left.min)) * meta.ih;
      },
      series: series
    };
  }

  window.HOV = { bind: bind, linear: linear, hide: hide, nearest: nearestIndex, num: num };
})();
