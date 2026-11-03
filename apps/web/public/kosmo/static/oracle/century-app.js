/* ============================================================================
   Century page: fan charts, regime frequencies, and generated reading.
   Depends on century.js (global CENTURY).
   ============================================================================ */
(function () {
  "use strict";

  var C = CENTURY;
  var state = {};
  for (var k in C.DEFAULTS) state[k] = C.DEFAULTS[k];

  var result = null;
  var mc = null;
  var mcTimer = null;

  var COL = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373",
    red: "#c28181", violet: "#a396b3", dim: "#7e8d9e", line: "#232528"
  };

  var REGIME_COLOR = {
    broad: "#a9c0b4", jobless: "#c4a373", demandbound: "#c28181",
    capitalist: "#a396b3", uneven: "#8aa4be", stall: "#7e8d9e", plateau: "#8fb7d9"
  };
  var REGIME_ORDER = ["broad", "jobless", "uneven", "capitalist", "demandbound", "stall", "plateau"];

  /* ------------------------------------------------------------------ utils */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function pct0(x) { return Math.round(x * 100) + "%"; }
  function signedPct(x) { var v = Math.round(x * 100); return (v > 0 ? "+" : "") + v + "%"; }
  function fmtLever(lv, v) {
    switch (lv.fmt) {
      case "pct": return pct0(v) + (lv.suffix || "");
      case "x": return v.toFixed(2).replace(/\.?0+$/, "") + "x" + (lv.suffix || "");
      case "yr": return v.toFixed(0) + "y";
      case "bn": return v.toFixed(1) + "bn";
      case "mult": return v >= 1e6 ? (v / 1e6).toFixed(0) + "M\u00d7"
        : v >= 1e3 ? (v / 1e3).toFixed(0) + "k\u00d7"
          : Math.round(v) + "\u00d7";
      default: return String(v);
    }
  }
  /* v is in thousands of dollars per person. Deep-time runs need exponents,
     otherwise a 43-decade axis is labelled "$100000000M". */
  function perCap(v) {
    if (!isFinite(v)) return "\u2014";
    var d = v * 1000;
    /* Above a billion the axis runs for dozens of decades, so one consistent
       exponent beats a $10B / $1e17 / $1e24 mixture. */
    if (d >= 1e9) return "$" + d.toExponential(0).replace("e+", "e");
    if (d >= 1e6) return "$" + (d / 1e6).toFixed(d >= 1e7 ? 0 : 1) + "M";
    if (d >= 1e3) return "$" + Math.round(d / 1e3) + "k";
    return "$" + Math.round(d);
  }
  function orders(x) {
    if (!isFinite(x) || x <= 0) return "\u2014";
    var l = Math.log10(x);
    return Math.abs(l) >= 4 ? Math.pow(10, Math.round(l)).toExponential(0).replace("e+", "e") : (l).toFixed(1);
  }
  function big(x) {
    if (!isFinite(x)) return "\u2014";
    if (x >= 1e12) return (x / 1e12).toFixed(1) + "T";
    if (x >= 1e9) return (x / 1e9).toFixed(1) + "B";
    if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
    if (x >= 1e3) return Math.round(x).toLocaleString();
    return x.toFixed(x < 10 ? 1 : 0);
  }

  /* -------------------------------------------------------------- fan chart
     Interactive: wheel or two-finger pinch zooms both axes around the pointer,
     dragging pans, double-click resets. The view is stored per chart in axis
     space (log10 for log charts) so zooming is uniform on a log scale.      */
  var FAN = {};

  function axisOf(v, log) { return log ? Math.log10(Math.max(1e-12, v)) : v; }

  function autoView(cfg) {
    var b = cfg.band, log = !!cfg.log;
    var all = b.p10.concat(b.p90).filter(function (v) { return isFinite(v) && v > 0; });
    var lo, hi;
    if (log) {
      lo = Math.log10(Math.min.apply(null, all));
      hi = Math.log10(Math.max.apply(null, all));
      lo = Math.floor(lo); hi = Math.ceil(hi);
      if (hi - lo < 1) hi = lo + 1;
    } else {
      lo = Math.min.apply(null, all); hi = Math.max.apply(null, all);
      var pad = (hi - lo) * 0.08 || 0.1;
      lo = Math.max(0, lo - pad); hi = hi + pad;
    }
    var yrs = cfg.years;
    return { x0: yrs[0], x1: yrs[yrs.length - 1], a0: lo, a1: hi };
  }

  function geom(cfg) {
    var W = cfg.w || 700, H = cfg.h || 268;
    var m = { l: 58, r: 16, t: 14, b: 26 };
    return { W: W, H: H, m: m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }

  function niceStep(raw) {
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    var mm = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return mm * mag;
  }

  function yTicks(v, log) {
    var out = [], span = v.a1 - v.a0, k, d, m;
    if (log) {
      if (span >= 1.2) {
        /* 43 decades in a century-scale chart needs thinning or the labels
           pile on top of each other. */
        var dstep = Math.max(1, Math.ceil(span / 7));
        for (k = Math.ceil(v.a0 / dstep) * dstep; k <= v.a1 + 1e-9; k += dstep) out.push(Math.pow(10, k));
      } else {
        for (d = Math.floor(v.a0) - 1; d <= Math.ceil(v.a1) + 1; d++) {
          for (m = 0; m < 5; m++) {
            var mm = [1, 2, 3, 5, 7][m];
            var a = Math.log10(mm) + d;
            if (a >= v.a0 - 1e-9 && a <= v.a1 + 1e-9) out.push(Math.pow(10, a));
          }
        }
      }
    } else {
      var step = niceStep(span / 4);
      for (k = Math.ceil(v.a0 / step) * step; k <= v.a1 + step * 1e-6; k += step) out.push(k);
    }
    return out;
  }

  function xTicks(y0, y1) {
    var span = y1 - y0;
    var cands = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
    var step = 10000;
    for (var i = 0; i < cands.length; i++) { if (span / cands[i] <= 9) { step = cands[i]; break; } }
    var out = [];
    for (var v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) out.push(v);
    return out;
  }

  function thin(n, cap) {
    var stride = Math.max(1, Math.ceil(n / cap));
    var idx = [];
    for (var i = 0; i < n; i += stride) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  }

  function fanSVG(cfg, view) {
    var g = geom(cfg), m = g.m, W = g.W, H = g.H, iw = g.iw, ih = g.ih;
    var yrs = cfg.years, b = cfg.band, log = !!cfg.log;
    var x0 = view.x0, x1 = view.x1, a0 = view.a0, a1 = view.a1;

    function X(v) { return m.l + (v - x0) / (x1 - x0) * iw; }
    function Y(v) { return m.t + (1 - (axisOf(v, log) - a0) / (a1 - a0)) * ih; }

    var clip = "clip-" + cfg.key;
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';
    out += '<defs><clipPath id="' + clip + '"><rect x="' + m.l + '" y="' + m.t +
      '" width="' + iw + '" height="' + ih + '"/></clipPath></defs>';

    yTicks(view, log).forEach(function (v) {
      var y = Y(v);
      if (y < m.t - 1 || y > m.t + ih + 1) return;
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + COL.line + '" stroke-dasharray="2 4"/>';
      out += '<text x="' + (m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        cfg.fmt(v) + '</text>';
    });

    xTicks(x0, x1).forEach(function (yr) {
      out += '<text x="' + X(yr).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + yr + '</text>';
    });

    out += '<g clip-path="url(#' + clip + ')">';

    var idx = thin(yrs.length, 700);

    function bandPath(lower, upper) {
      var d = "";
      for (var i = 0; i < idx.length; i++) {
        var j = idx[i];
        d += (i ? "L" : "M") + X(yrs[j]).toFixed(1) + " " + Y(upper[j]).toFixed(1);
      }
      for (var k = idx.length - 1; k >= 0; k--) {
        var q = idx[k];
        d += "L" + X(yrs[q]).toFixed(1) + " " + Y(lower[q]).toFixed(1);
      }
      return d + "Z";
    }

    out += '<path d="' + bandPath(b.p10, b.p90) + '" fill="' + cfg.color + '" opacity="0.13"/>';
    out += '<path d="' + bandPath(b.p25, b.p75) + '" fill="' + cfg.color + '" opacity="0.2"/>';

    var d = "";
    for (var i = 0; i < idx.length; i++) {
      var j = idx[i];
      d += (i ? "L" : "M") + X(yrs[j]).toFixed(1) + " " + Y(b.p50[j]).toFixed(1);
    }
    out += '<path d="' + d + '" fill="none" stroke="' + cfg.color + '" stroke-width="2.1" stroke-linejoin="round"/>';

    if (cfg.current) {
      var d2 = "";
      for (var q = 0; q < idx.length; q++) {
        var r = idx[q], v = cfg.current[r];
        if (!isFinite(v)) continue;
        d2 += (d2 ? "L" : "M") + X(yrs[r]).toFixed(1) + " " + Y(v).toFixed(1);
      }
      out += '<path d="' + d2 + '" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.8"/>';
    }

    out += '</g></svg>';
    return out;
  }

  function legendHTML(cfg) {
    return '<div class="fan-legend">' +
      '<span><i style="background:' + cfg.color + ';opacity:.13"></i>10&ndash;90th</span>' +
      '<span><i style="background:' + cfg.color + ';opacity:.28"></i>25&ndash;75th</span>' +
      '<span><i style="background:' + cfg.color + '"></i>median</span>' +
      '<span><i style="background:#fff;opacity:.85"></i>this run</span>' +
      '<span class="zoom-hint">&#8984;/ctrl + scroll or pinch to zoom &middot; drag to pan &middot; double-click to reset</span>' +
      '</div>';
  }

  function drawFan(key) {
    var st = FAN[key];
    var host = document.getElementById(key);
    if (!st || !st.view || !host) return;
    host.innerHTML = fanSVG(st.cfg, st.view) + legendHTML(st.cfg);
    bindFanHover(host, st.cfg, st.view);
  }

  /* The fan needs its own model: a median, two bands and the user's run, over
     an axis that can be zoomed and panned. The card inherits whatever window
     is on screen, and is rebound every time the fan is redrawn. */
  function bindFanHover(host, cfg, view) {
    if (!window.HOV || !cfg || !cfg.band) return;
    var g = geom(cfg);
    var yrs = cfg.years, b = cfg.band, log = !!cfg.log;
    var x0 = view.x0, x1 = view.x1, a0 = view.a0, a1 = view.a1;

    function Y(v) {
      return g.m.t + (1 - (axisOf(v, log) - a0) / (a1 - a0)) * g.ih;
    }

    var series = [];
    if (cfg.current) {
      series.push({
        name: "this run", color: "#ffffff", dash: true, fmt: cfg.fmt,
        val: function (i) { var v = cfg.current[i]; return (v == null || !isFinite(v)) ? null : v; }
      });
    }
    series.push(
      { name: "90th", color: cfg.color, fmt: cfg.fmt, val: function (i) { return b.p90[i]; } },
      { name: "median", color: cfg.color, fmt: cfg.fmt, val: function (i) { return b.p50[i]; } },
      { name: "10th", color: cfg.color, fmt: cfg.fmt, val: function (i) { return b.p10[i]; } }
    );

    HOV.bind(host, {
      W: g.W, H: g.H, top: g.m.t, bottom: g.m.t + g.ih,
      xOf: function (i) { return g.m.l + (yrs[i] - x0) / (x1 - x0) * g.iw; },
      xIndex: function (vx) {
        return HOV.nearest(yrs, x0 + (vx - g.m.l) / g.iw * (x1 - x0));
      },
      label: function (i) { return String(Math.round(yrs[i])); },
      yOf: Y,
      series: series
    });
  }

  /* --- interaction ------------------------------------------------------- */
  function localPt(key, cx, cy) {
    var host = document.getElementById(key);
    var svg = host && host.querySelector("svg");
    var st = FAN[key];
    if (!svg || !st || !st.cfg) return null;
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var g = geom(st.cfg);
    return {
      vx: (cx - r.left) * (g.W / r.width),
      vy: (cy - r.top) * (g.H / r.height),
      g: g, rx: r
    };
  }

  function setView(key, nv) {
    var st = FAN[key];
    if (!st || !st.cfg) return;
    var full = autoView(st.cfg);
    var spanX = nv.x1 - nv.x0;
    var minSpanX = (full.x1 - full.x0) / 500;
    if (!(spanX > 0) || !isFinite(spanX)) return;
    if (spanX < minSpanX) {
      var c = (nv.x0 + nv.x1) / 2;
      nv.x0 = c - minSpanX / 2; nv.x1 = c + minSpanX / 2; spanX = minSpanX;
    }
    if (spanX > full.x1 - full.x0) { nv.x0 = full.x0; nv.x1 = full.x1; }
    if (nv.x0 < full.x0) { nv.x1 += full.x0 - nv.x0; nv.x0 = full.x0; }
    if (nv.x1 > full.x1) { nv.x0 -= nv.x1 - full.x1; nv.x1 = full.x1; }

    /* The value window stays inside the data, exactly as the time window does.
       Allowing it to overshoot by a multiple produced axis ranges ten times
       wider than the data, which is how a chart ends up with 107 gridlines. */
    var fullSpanA = full.a1 - full.a0;
    var spanA = nv.a1 - nv.a0;
    var minSpanA = fullSpanA / 300;
    if (!(spanA > 0) || !isFinite(spanA)) { nv.a0 = full.a0; nv.a1 = full.a1; }
    else if (spanA < minSpanA) {
      var ca = (nv.a0 + nv.a1) / 2;
      nv.a0 = ca - minSpanA / 2; nv.a1 = ca + minSpanA / 2; spanA = minSpanA;
    }
    if (spanA > fullSpanA) { nv.a0 = full.a0; nv.a1 = full.a1; }
    if (nv.a0 < full.a0) { nv.a1 += full.a0 - nv.a0; nv.a0 = full.a0; }
    if (nv.a1 > full.a1) { nv.a0 -= nv.a1 - full.a1; nv.a1 = full.a1; }
    if (nv.a1 <= nv.a0) return;

    st.view = { x0: nv.x0, x1: nv.x1, a0: nv.a0, a1: nv.a1 };
    drawFan(key);
  }

  function zoomAt(key, f, pt) {
    var st = FAN[key];
    if (!st || !st.cfg) return;
    var v = st.view, g = pt.g;
    var fx = v.x0 + (pt.vx - g.m.l) / g.iw * (v.x1 - v.x0);
    var fa = v.a1 - (pt.vy - g.m.t) / g.ih * (v.a1 - v.a0);
    setView(key, {
      x0: fx + (v.x0 - fx) * f, x1: fx + (v.x1 - fx) * f,
      a0: fa + (v.a0 - fa) * f, a1: fa + (v.a1 - fa) * f
    });
  }

  function attachFan(key) {
    var host = document.getElementById(key);
    if (!host || host.__fanBound) return;
    host.__fanBound = true;
    host.classList.add("fan-interactive");

    /* Zoom is an explicit gesture: ctrl/cmd + wheel, or a trackpad pinch, which
       browsers report as ctrl+wheel. A plain wheel belongs to the page. Taking
       it here meant that with the pointer anywhere over the charts — most of
       this page — the page would not scroll at all. */
    host.addEventListener("wheel", function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      var st = FAN[key];
      if (!st || !st.cfg) return;
      e.preventDefault();
      var pt = localPt(key, e.clientX, e.clientY);
      if (!pt) return;
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= pt.rx.height;
      dy = clamp(dy, -160, 160);
      zoomAt(key, Math.exp(dy * 0.012), pt);
    }, { passive: false });

    host.addEventListener("dblclick", function () {
      var st = FAN[key];
      if (!st || !st.cfg) return;
      st.view = autoView(st.cfg);
      drawFan(key);
    });

    /* drag to pan (mouse and pen) */
    var drag = null;
    host.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;
      var st = FAN[key];
      if (!st || !st.cfg) return;
      drag = { x: e.clientX, y: e.clientY, view: st.view, pt: localPt(key, e.clientX, e.clientY) };
      if (!drag.pt) { drag = null; return; }
      host.classList.add("dragging");
      if (host.setPointerCapture) { try { host.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    host.addEventListener("pointermove", function (e) {
      if (!drag || !drag.pt) return;
      e.preventDefault();
      var g = drag.pt.g, p = drag.pt;
      var dxPx = (e.clientX - drag.x) * (g.W / p.rx.width);
      var dyPx = (e.clientY - drag.y) * (g.H / p.rx.height);
      var sx = (drag.view.x1 - drag.view.x0) / g.iw;
      var sa = (drag.view.a1 - drag.view.a0) / g.ih;
      setView(key, {
        x0: drag.view.x0 - dxPx * sx, x1: drag.view.x1 - dxPx * sx,
        a0: drag.view.a0 + dyPx * sa, a1: drag.view.a1 + dyPx * sa
      });
    });
    function endDrag() { drag = null; host.classList.remove("dragging"); }
    host.addEventListener("pointerup", endDrag);
    host.addEventListener("pointercancel", endDrag);
    host.addEventListener("pointerleave", function () { if (drag) endDrag(); });

    /* two-finger pinch */
    var pinch = null;
    host.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 2) { pinch = null; return; }
      var st = FAN[key];
      if (!st || !st.cfg) return;
      var t0 = e.touches[0], t1 = e.touches[1];
      pinch = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        view: st.view
      };
    }, { passive: true });
    host.addEventListener("touchmove", function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var t0 = e.touches[0], t1 = e.touches[1];
      var d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (!pinch.dist || !d) return;
      var cx = (t0.clientX + t1.clientX) / 2, cy = (t0.clientY + t1.clientY) / 2;
      var pt = localPt(key, cx, cy);
      var st = FAN[key];
      if (!pt || !st) return;
      st.view = pinch.view;                    // recompute from the pinch start
      zoomAt(key, clamp(pinch.dist / d, 0.25, 4), pt);
    }, { passive: false });
    host.addEventListener("touchend", function (e) {
      if (e.touches.length < 2) pinch = null;
    });
  }

  function setFan(key, cfg) {
    cfg.key = key;
    var st = FAN[key];
    if (!st) st = FAN[key] = { cfg: null, view: null, n: 0 };
    var sameShape = st.n === cfg.years.length;
    st.cfg = cfg;
    st.n = cfg.years.length;
    if (!st.view || !sameShape) st.view = autoView(cfg);
    attachFan(key);
    drawFan(key);
  }

  /* ----------------------------------------------------------------- levers */
  var leverIndex = {};
  function buildLevers() {
    var host = document.getElementById("leverGroups");
    host.innerHTML = "";
    C.LEVER_GROUPS.forEach(function (g, gi) {
      var det = document.createElement("details");
      det.className = "lgroup";
      /* Closed by default; the chevron is the affordance. */
      det.innerHTML = "<summary>" + g.title + '<i class="caret" aria-hidden="true"></i>' + "</summary><p class='blurb'>" + g.blurb + "</p>";
      g.levers.forEach(function (lv) {
        leverIndex[lv.key] = lv;
        var wrap = el("div", "lever");
        var top = el("div", "lever-top");
        top.appendChild(el("span", "lever-name", lv.label));
        var val = el("span", "lever-val", fmtLever(lv, state[lv.key]));
        val.id = "cval-" + lv.key;
        top.appendChild(val);
        wrap.appendChild(top);
        var input = document.createElement("input");
        input.type = "range";
        input.min = lv.min; input.max = lv.max; input.step = lv.step;
        input.value = state[lv.key];
        input.setAttribute("aria-label", lv.label);
        input.addEventListener("input", function () {
          state[lv.key] = parseFloat(input.value);
          val.textContent = fmtLever(lv, state[lv.key]);
          markCustom();
          update();
        });
        wrap.appendChild(input);
        det.appendChild(wrap);
      });
      host.appendChild(det);
    });
  }

  function syncLeverInputs() {
    C.LEVER_GROUPS.forEach(function (g) {
      g.levers.forEach(function (lv) {
        var input = document.querySelector('input[aria-label="' + lv.label.replace(/"/g, '\\"') + '"]');
        if (input) input.value = state[lv.key];
        var v = document.getElementById("cval-" + lv.key);
        if (v) v.textContent = fmtLever(lv, state[lv.key]);
      });
    });
  }

  /* ---------------------------------------------------------------- presets */
  var activePreset = "reference";
  function buildPresets() {
    var host = document.getElementById("presets");
    host.innerHTML = "";
    C.PRESETS.forEach(function (p) {
      var b = el("button", "preset" + (p.id === activePreset ? " active" : ""), p.name);
      b.type = "button"; b.title = p.blurb; b.dataset.id = p.id;
      b.addEventListener("click", function () { applyPreset(p); });
      host.appendChild(b);
    });
  }
  function applyPreset(p) {
    var keepHorizon = state.horizon;
    for (var key in C.DEFAULTS) state[key] = C.DEFAULTS[key];
    for (var key2 in p.patch) state[key2] = p.patch[key2];
    state.horizon = keepHorizon;   // a scenario is not a horizon
    activePreset = p.id;
    document.querySelectorAll(".preset").forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === p.id);
    });
    syncLeverInputs();
    update();
  }
  function markCustom() {
    if (activePreset === "custom") return;
    activePreset = "custom";
    document.querySelectorAll(".preset").forEach(function (b) { b.classList.remove("active"); });
  }

  /* ------------------------------------------------------------------- KPIs */
  function renderKpis(r, m) {
    var host = document.getElementById("kpis");
    host.innerHTML = "";
    var f = r.final;
    var N = r.years.length - 1;
    var endYear = r.years[N];

    function tile(label, value, cls, note, hero) {
      var d = el("div", "kpi" + (hero ? " hero" : ""));
      d.appendChild(el("div", "klabel", label));
      d.appendChild(el("div", "kval " + (cls || ""), value));
      if (note) d.appendChild(el("div", "knote", note));
      host.appendChild(d);
    }

    var deep = state.horizon > 150;
    tile(deep ? "Landing, 2126" : "End state", r.regime.name,
      r.regime.id === "broad" ? "good" : r.regime.id === "demandbound" ? "bad" : "warn",
      deep && r.terminalRegime ? "by " + endYear + ": " + r.terminalRegime.name.toLowerCase() : "on these settings",
      true);

    tile("Output per person, " + endYear, perCap(f.gdpPerCap),
      f.gdpPerCap > 100 ? "good" : f.gdpPerCap > 40 ? "warn" : "neutral",
      (m ? "median " + perCap(m.gdpPerCap.p50[N]) + " across paths &middot; " : "") +
      signedPct(f.gdpPerCapCAGR) + "/yr");

    tile("Labour share", pct0(f.laborShare),
      f.laborShare < 0.4 ? "bad" : f.laborShare < 0.5 ? "warn" : "good",
      "from " + pct0(f.laborShare0) + (m ? " &middot; median " + pct0(m.laborShare.p50[100]) : ""));

    tile("Unemployment", pct0(f.unemp),
      f.unemp > 0.25 ? "bad" : f.unemp > 0.12 ? "warn" : "good",
      "from 7% structural");

    tile("Compute wall", r.powerBindYear >= 0 ? String(2026 + r.powerBindYear) : "not hit",
      "neutral", "electricity binds compute");

    tile("Demand gap", pct0(f.outputGap),
      f.outputGap > 0.12 ? "bad" : f.outputGap > 0.04 ? "warn" : "good",
      "output below potential");

    if (state.horizon > 150) {
      tile("Growth ends", r.saturateYear >= 0 ? String(2026 + r.saturateYear) : "not yet", "neutral",
        "exergy ceiling binds &middot; " + (r.terminalGrowth * 100).toFixed(1) + "%/yr at " + endYear);
    }
  }

  /* ----------------------------------------------------------------- charts */
  function renderCharts(r, m) {
    var yrs = r.years;
    if (m) {
      setFan("fanGdp", {
        years: yrs, band: m.gdpPerCap, color: COL.mint, log: true,
        fmt: perCap, current: r.series.gdpPerCap
      });
      setFan("fanShare", {
        years: yrs, band: m.laborShare, color: COL.amber, h: 232,
        fmt: function (v) { return Math.round(v * 100) + "%"; }, current: r.series.laborShare
      });
      setFan("fanUnemp", {
        years: yrs, band: m.unemp, color: COL.red, h: 232,
        fmt: function (v) { return Math.round(v * 100) + "%"; }, current: r.series.unemp
      });
    } else {
      ["fanGdp", "fanShare", "fanUnemp"].forEach(function (id) {
        var host = document.getElementById(id);
        if (!host.__fanBound) host.innerHTML = '<p class="muted">sampling&hellip;</p>';
      });
    }
  }

  /* ----------------------------------------------------------- bind panel */
  function renderBind(r) {
    var host = document.getElementById("bindPanel");
    var s = r.series;
    var last = s.compute.length - 1;
    var longRun = state.elecGrowth * state.flopPerJouleGrowth;

    // does raising compute growth change the century at all?
    var lo = C.simulate(Object.assign({}, state, { computeGrowth: 2 }));
    var hi = C.simulate(Object.assign({}, state, { computeGrowth: 8 }));

    var rows = [
      ["Long-run compute growth", longRun.toFixed(2) + "\u00d7/yr",
        "electricity " + state.elecGrowth.toFixed(2) + "\u00d7 &middot; compute per joule " + state.flopPerJouleGrowth.toFixed(2) + "\u00d7"],
      ["Compute by " + s.years[last], Math.max(0, s.compute[last]).toFixed(1) + " orders",
        "of magnitude above today"],
      ["Electricity to compute", pct0(s.elecShareUsed[last]),
        "by " + s.years[last]],
      ["Trained-compute growth", state.computeGrowth.toFixed(1) + "\u00d7/yr",
        r.powerBindYear >= 0 ? "exhausted by " + (2026 + r.powerBindYear) : "still within the ceiling"]
    ];

    var html = "<table class='dr-table'>";
    rows.forEach(function (row) {
      html += "<tr><td>" + row[0] + "</td><td class='num' style='color:#a9c0b4'>" + row[1] +
        "</td><td class='src' style='text-align:right'>" + row[2] + "</td></tr>";
    });
    html += "</table>";
    html += "<p class='regime-note'>" +
      "Raising trained-compute growth from 2\u00d7 to 8\u00d7/yr moves the wall from " +
      (lo.powerBindYear >= 0 ? 2026 + lo.powerBindYear : "never") + " to " +
      (hi.powerBindYear >= 0 ? 2026 + hi.powerBindYear : "never") +
      ", and leaves output per person at " + perCap(hi.final.gdpPerCap) + " versus " +
      perCap(lo.final.gdpPerCap) + ". " +
      "Compared with changing compute per joule or the energy we are willing to allocate, the " +
      "headline compute-growth number barely matters over a century. That is Epoch AI's own " +
      "conclusion \u2014 power binds first \u2014 arrived at from the other direction.</p>";
    host.innerHTML = html;
  }

  /* --------------------------------------------------------- regime panel */
  function renderRegimes(m) {
    var host = document.getElementById("regimePanel");
    if (!m) { host.innerHTML = '<p class="muted">sampling&hellip;</p>'; return; }
    var byId = {};
    m.regimes.forEach(function (x) { byId[x.id] = x.share; });

    var html = "<div class='regime-list'>";
    REGIME_ORDER.forEach(function (id) {
      var share = byId[id] || 0;
      var reg = null;
      ["broad", "jobless", "uneven", "capitalist", "demandbound", "stall"].forEach(function (x) { });
      html += "<div class='regime-row'>" +
        "<span class='rname'>" + prettyRegime(id) + "</span>" +
        "<span class='rtrack'><span class='rfill' style='width:" + (share * 100).toFixed(1) +
        "%;background:" + (REGIME_COLOR[id] || COL.dim) + ";opacity:" + (share > 0 ? 0.75 : 0) + "'></span></span>" +
        "<span class='rpct'>" + Math.round(share * 100) + "%</span>" +
        "</div>";
    });
    html += "</div>";
    html += "<p class='regime-note'>Across " + m.runs + " paths sampling substitution elasticity, " +
      "task creation, capital circulation, population timing and energy trends. " +
      "The model rarely reaches a low labour share <em>without</em> a demand failure, because the two " +
      "are the same mechanism: a collapsed wage share is a collapsed customer base.";
    if (m.saturateShare > 0) {
      html += " Landings are classified at 2126 so they stay comparable across horizons; " +
        Math.round(m.saturateShare * 100) + "% of paths then hit the exergy ceiling, median year " +
        (2026 + m.medianSaturateYear) + ".";
    }
    html += "</p>";
    host.innerHTML = html;
  }

  function prettyRegime(id) {
    return {
      broad: "Broad growth", jobless: "Jobless abundance", uneven: "Uneven abundance",
      capitalist: "Capital-only boom", demandbound: "Demand-bound", stall: "Stagnation",
      plateau: "Thermodynamic plateau"
    }[id] || id;
  }

  /* ---------------------------------------------------------------- verdict */
  function renderVerdict(r, m) {
    var host = document.getElementById("verdict");
    var f = r.final;
    var lines = [];
    var sev = r.regime.id === "broad" ? "green" : r.regime.id === "demandbound" ? "red" : "amber";

    var endYear = r.years[r.years.length - 1];
    lines.push("<span class='tag " + sev + "'>" + r.regime.name + "</span>" +
      r.regime.blurb + " On these settings: output per person reaches <strong>" +
      perCap(f.gdpPerCap) + "</strong> by " + endYear + " (" + signedPct(f.gdpPerCapCAGR) + "/yr), labour's share of income " +
      "<strong>" + pct0(f.laborShare) + "</strong>, unemployment <strong>" + pct0(f.unemp) +
      "</strong>, and the output gap <strong>" + pct0(f.outputGap) + "</strong>.");

    // what binds
    var bind = "";
    if (r.powerBindYear >= 0 && r.powerBindYear < 30) {
      bind = "<strong>What binds is electricity.</strong> At " + state.computeGrowth.toFixed(1) +
        "\u00d7/yr, trained compute exhausts the power that can be directed at it by 2026+" +
        r.powerBindYear + ". From then on compute grows at the ceiling rate \u2014 electricity growth " +
        "(" + state.elecGrowth.toFixed(2) + "\u00d7/yr) times compute per joule (" +
        state.flopPerJouleGrowth.toFixed(2) + "\u00d7/yr) \u2014 which is " +
        (state.elecGrowth * state.flopPerJouleGrowth).toFixed(2) + "\u00d7/yr, not " +
        state.computeGrowth.toFixed(1) + "\u00d7. The century is a story about power and chip efficiency, " +
        "and the argument about algorithmic progress is mostly an argument about the next five years.";
    } else {
      bind = "<strong>Compute is not the binding constraint here.</strong> Growth stays inside the " +
        "electricity ceiling, so capability keeps compounding and the limit becomes institutional: " +
        "deployment lag, task creation and demand.";
    }
    lines.push(bind);

    // the task question
    var task = "<strong>The contested variable is task creation, not capability.</strong> " +
      pct0(f.autoShare) + " of task content is automated by 2126, but " + pct0(f.newTaskShare) +
      " of the task space is new work created along the way. ";
    if (f.newTaskShare < 0.1) {
      task += "With the reinstatement valve all but closed, displacement lands almost entirely on the labour share, and because wages are the consumer's budget, output is then limited by who can afford to buy it. " +
        "This is the Trammell\u2013Korinek case: once machines replicate the underlying capabilities, no new human tasks are generated.";
    } else if (f.newTaskShare > 0.45) {
      task += "Reinstatement keeps pace with displacement, which is roughly what the historical record shows \u2014 of US employment growth between 1980 and 2015, about half came from occupations whose titles or task content were new. " +
        "The open question is whether that mechanism survives machines doing the tasks rather than changing them.";
    } else {
      task += "Reinstatement partially offsets displacement \u2014 the historical pattern, but weaker. Whether it holds is the single parameter this century turns on.";
    }
    lines.push(task);

    // distribution
    var dist = "<strong>Whether capacity and prosperity stay together is a distribution question.</strong> ";
    if (f.outputGap > 0.08) {
      dist += "The economy can produce " + pct0(1 + f.outputGap) + " of what it actually produces. That gap is not a technology failure: it is the arithmetic of a wage share that has fallen faster than capital income has reached household budgets. " +
        "Transfers and broad ownership close it; productivity does not.";
    } else if (f.laborShare < 0.45) {
      dist += "Demand holds because capital income is circulating, so output is not constrained \u2014 but labour has lost its claim on it, and the people who are no longer needed to produce are not the people receiving the income.";
    } else {
      dist += "Labour keeps a meaningful claim on income, so consumption keeps up with capacity and the demand side does not bind. This is the configuration in which the century is benign, and it depends on institutions rather than on the models.";
    }
    lines.push(dist);

    if (m) {
      var lastI = r.years.length - 1;
      var loGdp = m.gdpPerCap.p10[lastI], hiGdp = m.gdpPerCap.p90[lastI];
      lines.push("<strong>How much of this is the model and how much is the assumption.</strong> " +
        "Across " + m.runs + " paths the " + endYear + " outcome spans <strong>" + perCap(loGdp) + "</strong> at the " +
        "10th percentile to <strong>" + perCap(hiGdp) + "</strong> at the 90th, a factor of " +
        Math.round(hiGdp / Math.max(1, loGdp)) + ". That fan is the honest output. The median path is " +
        "not a forecast and should not be quoted as one.");
    }

    host.innerHTML = "<h2>Reading the result</h2>" +
      lines.map(function (l) { return "<p>" + l + "</p>"; }).join("");
  }

  /* ------------------------------------------------------------ citations */
  function renderCites() {
    var items = [
      ["Growth with an endogenous capital share",
        "Trammell &amp; Korinek, <em>Economic Growth under Transformative AI</em> (NBER WP 31815; <em>Annual Review of Economics</em>, 2026). Provides the amplification this model uses: g = g_A / (1&minus;&alpha;). A capital share of 0.33 keeps growth near 2%; 0.95 amplifies the same technology growth twentyfold. Argues the new-task escape valve necessarily closes once machines replicate the underlying human capabilities."],
      ["Task displacement and reinstatement",
        "Acemoglu &amp; Restrepo, <em>Automation and New Tasks</em> (J. Econ. Perspectives, 2019). Automation always lowers the labour share; new task creation always raises it. Their calibration uses a task elasticity of substitution of 0.8 &mdash; the default here. Roughly half of US employment growth 1980&ndash;2015 came from occupations with new titles."],
      ["Capability timing",
        "Davidson, <em>What a Compute-Centric Framework Says About Takeoff Speeds</em> (Open Philanthropy, 2023), and Epoch AI's GATE model (arXiv 2503.04941). Both decompose progress into software, hardware and spending, and both are explicit that a static task space is a limitation."],
      ["Compute and energy trends",
        "Epoch AI: training compute growing ~5&times;/yr since 2020; compute per joule 1.34&times;/yr since 2008; algorithmic efficiency roughly 2.4&ndash;3&times;/yr. LBNL (2024, 2025) and IEA <em>Energy and AI</em> (2025) for data-centre electricity. Epoch's own conclusion is that power is the first binding constraint on scaling."],
      ["Demography",
        "UN World Population Prospects 2024: population peaks near 10.3bn around 2084, working-age populations already shrinking in roughly 100 countries. The labour force here is therefore not fixed, unlike the ten-year model."],
      ["Historical analogue",
        "US agricultural employment fell from 53% of the labour force in 1860 to under 3% by 1980 &mdash; but flat for two decades before takeoff, and roughly a century end to end. The end state was not zero, and the absorbing sector was one that did not exist beforehand."],
      ["Why this is a distribution and not a number",
        "Tetlock's expert-forecasting work found accuracy decaying toward chance by roughly five years; prediction markets show calibration degrading with horizon and almost no resolved questions beyond ten. At century scale the dominant practice (DICE/RICE) moves its own output by 8&ndash;17&times; on the discount rate alone. Pindyck's critique of that literature: the models \"create a perception of knowledge and precision, but that perception is illusory.\""]
    ];
    var host = document.getElementById("cites");
    host.innerHTML = items.map(function (it) {
      return "<div class='cite'><b>" + it[0] + "</b><br>" + it[1] + "</div>";
    }).join("");
  }

  /* -------------------------------------------------------- discount table */
  function renderDiscount(r) {
    var f = r.final;
    var N = r.years.length - 1;
    var rows = [
      ["1.4%", "Stern review", f.pvStern, true],
      [pct0(state.discountRate), "this model", f.pv, false],
      ["4.3%", "Nordhaus / DICE", f.pvNordhaus, true]
    ];
    var base = f.pvNordhaus;
    var html = "<tr><th>Rate</th><th>Source</th><th style='text-align:right'>$100 in " + N +
      " years</th><th style='text-align:right'>Relative value</th></tr>";
    rows.forEach(function (row) {
      var rate = row[0] === "1.4%" ? 0.014 : row[0] === "4.3%" ? 0.043 : state.discountRate;
      var disc = 100 / Math.pow(1 + rate, N);
      html += "<tr" + (row[2] === f.pv ? " class='hi'" : "") + ">" +
        "<td>" + row[0] + "</td><td>" + row[1] + "</td>" +
        "<td class='num'>" + (disc < 0.01 ? "$" + disc.toExponential(1).replace("e-?\.?", "e-") : "$" + disc.toFixed(2)) + "</td>" +
        "<td class='num'>" + (row[2] / Math.max(1e-9, base)).toFixed(1) + "&times;</td></tr>";
    });
    document.getElementById("drTable").innerHTML = html;
  }

  /* ---------------------------------------------------------- deep time */
  function renderDeep(r) {
    var host = document.getElementById("deepPanel");
    if (!host) return;
    var N = r.years.length - 1;
    var endYear = r.years[N];
    if (state.horizon <= 150) {
      host.innerHTML = "<p class='muted'>At a 100-year horizon the physical ceiling never binds \u2014 the century is " +
        "an economic question. Select <b>2276</b> or <b>10,000&nbsp;CE</b> above to see where exponential growth ends.</p>";
      return;
    }
    var s = r.series, L = C.LIMITS;
    var y = function (yy) { return yy >= 0 ? String(2026 + yy) : "beyond " + endYear; };

    var capYear = -1;
    for (var i = 0; i <= N; i++) {
      if (s.power[i] >= L.UNIVERSE_TW * 0.999) { capYear = s.years[i]; break; }
    }

    var rows = [
      ["Efficiency stops being the driver", y(r.saturateYear),
        "capacity outruns the exergy available to drive it"],
      ["Accessible power, " + endYear, orders(s.power[N]) + " TW",
        "from " + L.POWER0_TW + " TW today"],
      ["Earth's solar budget", y(r.crossEarth), "1.7\u00d710\u2075 TW intercepted"],
      ["Solar system's output", y(r.crossSystem), "3.8\u00d710\u00b9\u2074 TW"],
      ["Galaxy's output", y(r.crossGalaxy), "7.6\u00d710\u00b2\u2075 TW"],
      ["Starlight ceiling", capYear >= 0 ? String(capYear) : "not reached",
        "10\u00b3\u2077 TW, the observable universe"],
      ["Growth at " + endYear, (r.terminalGrowth * 100).toFixed(2) + "%/yr",
        r.terminalGrowth < 0.005 ? "flat" : "still compounding"]
    ];

    var html = "<table class='dr-table'>";
    rows.forEach(function (row) {
      html += "<tr><td>" + row[0] + "</td><td class='num' style='color:#8fb7d9'>" + row[1] +
        "</td><td class='src' style='text-align:right'>" + row[2] + "</td></tr>";
    });
    html += "</table>";

    var story;
    if (r.saturateYear < 0) {
      story = "The ceiling does not bind inside this horizon. Growth is still exponential at " + endYear +
        ", which means the physics has not yet had anything to say.";
    } else {
      story = "<strong>Exponential growth ends in " + (2026 + r.saturateYear) + ".</strong> " +
        "Before that date, output is limited by technology and by who can afford to buy it; after it, by joules. " +
        "Everything the AI debate is about \u2014 capability, task creation, the labour share \u2014 is settled " +
        "by then. The remaining " + (endYear - (2026 + r.saturateYear)) + " years are governed by the energy frontier, " +
        "which is why the accessible-power lever matters more than the compute lever at this range. " +
        "At " + state.energyFrontier.toFixed(3) + "\u00d7/yr the frontier reaches starlight around " +
        (capYear >= 0 ? capYear : "a date past the horizon") + " and stops there.";
    }

    host.innerHTML = html + "<p class='regime-note'>" + story + "</p>" +
      "<p class='regime-note'><b>What this is not.</b> Past roughly 2200 the model is a physics extrapolation " +
      "wearing economics as a coat. The ceilings are order-of-magnitude (Earth's intercepted sunlight, the " +
      "Sun's output, the galaxy's, the starlight of the observable universe) and the conversion from watts to " +
      "dollars through an \u201cexergy productivity\u201d term is a fudge with no measurement behind it. " +
      "The date growth stops is meaningful; the terminal number is arithmetic.</p>";
  }

  /* ------------------------------------------------------------ horizon */
  function buildHorizon() {
    var host = document.getElementById("horizon");
    if (!host) return;
    host.innerHTML = "";
    C.HORIZONS.forEach(function (h) {
      /* Deliberately not class "preset": preset handlers toggle .active across
         every .preset button, which would clear the horizon selection. */
      var b = el("button", "hbtn" + (h.years === state.horizon ? " active" : ""), h.name);
      b.type = "button"; b.title = h.note; b.dataset.h = h.years;
      b.addEventListener("click", function () {
        if (state.horizon === h.years) return;
        state.horizon = h.years;
        document.querySelectorAll(".hbtn").forEach(function (x) {
          x.classList.toggle("active", Number(x.dataset.h) === h.years);
        });
        var note = document.getElementById("hbarNote");
        if (note) note.textContent = h.note + (h.years > 150 ? " \u2014 physics, not economics" : "");
        update();
      });
      host.appendChild(b);
    });
  }

  function updateHeadings() {
    var endYear = 2026 + Math.round(state.horizon);
    var sub = document.querySelector(".topbar .sub");
    if (sub) sub.innerHTML = "Where the economy lands, 2026&ndash;" + endYear +
      " &mdash; a distribution of paths, not a forecast";
    var h = document.querySelector("#fanGdpCard h2");
    if (h) h.textContent = "Output per person, 2026\u2013" + endYear;
    var foot = document.getElementById("footRange");
    if (foot) foot.innerHTML = "Long-horizon model &middot; annual steps &middot; 2026&ndash;" + endYear +
      " &middot; Monte Carlo over the contested parameters";
    document.title = "Century \u2014 where the AI economy lands, 2026 to " + endYear;
  }

  /* ----------------------------------------------------------------- update */
  function update() {
    result = C.simulate(state);
    /* A fan sampled at a different horizon has the wrong length; dropping it
       beats indexing past the end of the old band arrays. */
    if (mc && mc.gdpPerCap.p50.length !== result.years.length) mc = null;

    updateHeadings();
    renderKpis(result, mc);
    renderVerdict(result, mc);
    renderCharts(result, mc);
    renderBind(result);
    renderRegimes(mc);
    renderDeep(result);
    renderDiscount(result);

    clearTimeout(mcTimer);
    mcTimer = setTimeout(function () {
      var N = Math.round(state.horizon);
      var runs = N > 2000 ? 60 : N > 400 ? 100 : 160;
      mc = C.monteCarlo(state, runs);
      renderKpis(result, mc);
      renderVerdict(result, mc);
      renderCharts(result, mc);
      renderRegimes(mc);
    }, 180);
  }

  function init() {
    buildLevers();
    buildPresets();
    buildHorizon();
    renderCites();
    document.getElementById("reset").addEventListener("click", function () {
      applyPreset(C.PRESETS[0]);
    });
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
