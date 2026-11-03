/* ============================================================================
   freight-app.js — renderer for `freight.html`.

   Four charts, all from one daily source. The rule this page follows: a series
   is drawn against its own 2019 baseline, never against another strait's raw
   volume, because the difference between 30 and 300 ships a day is geography
   and the difference from 2019 is history.
   ============================================================================ */
(function () {
  "use strict";

  var F = window.FREIGHT;
  if (!F) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };

  var state = { smooth: 4, all: false, point: null };

  /* ----------------------------------------------------------------- utils --- */
  function txt(x, y, s, o) {
    o = o || {};
    var px = typeof x === "number" ? x.toFixed(1) : x;
    var py = typeof y === "number" ? y.toFixed(1) : y;
    return "<text x=\"" + px + "\" y=\"" + py + "\"" +
      (o.anchor ? " text-anchor=\"" + o.anchor + "\"" : "") +
      (o.size ? " font-size=\"" + o.size + "\"" : "") +
      (o.fill ? " fill=\"" + o.fill + "\"" : "") +
      (o.opacity != null ? " opacity=\"" + o.opacity + "\"" : "") +
      (o.rotate ? " transform=\"rotate(" + o.rotate + " " + px + " " + py + ")\"" : "") +
      " font-family=\"ui-monospace,monospace\">" + s + "</text>";
  }

  function polyline(pts, color, o) {
    o = o || {};
    var d = "", open = false;
    for (var i = 0; i < pts.length; i++) {
      if (!pts[i]) { open = false; continue; }
      d += (open ? " L" : "M") + pts[i][0].toFixed(1) + " " + pts[i][1].toFixed(1);
      open = true;
    }
    return "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"" +
      (o.width || 1.6) + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" +
      (o.opacity != null ? " stroke-opacity=\"" + o.opacity + "\"" : "") + "/>";
  }

  function smooth(arr, w) {
    if (w <= 1) return arr.slice();
    var out = [], sum = 0, q = [];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      q.push(v);
      if (v != null) sum += v; else q.hasNull = true;
      if (q.length > w) {
        var old = q.shift();
        if (old != null) sum -= old;
      }
      var good = q.filter(function (x) { return x != null; }).length;
      out.push(good >= Math.max(2, Math.ceil(w / 2)) ? sum / good : null);
    }
    return out;
  }

  function bindHover(host, cfg) {
    if (!window.HOV) return;
    HOV.bind(host, cfg);
  }

  var MAIN = [
    "Suez Canal", "Panama Canal", "Bab el-Mandeb Strait", "Malacca Strait",
    "Strait of Hormuz", "Cape of Good Hope", "Taiwan Strait", "Bosphorus Strait"
  ];
  var COLORS = [C.mint, C.amber, C.red, C.blue, C.violet, C.teal, C.steel, "#b8a06a"];

  function byName(n) {
    for (var i = 0; i < F.points.length; i++) if (F.points[i].name === n) return F.points[i];
    return null;
  }

  function yearTicks(xsOf, years, count) {
    var s = "";
    var seen = {};
    F.weeks.forEach(function (wk, i) {
      var y = wk.slice(0, 4);
      if (seen[y]) return;
      seen[y] = true;
      var x = xsOf(i);
      s += "<line x1=\"" + x.toFixed(1) + "\" x2=\"" + x.toFixed(1) + "\" y1=\"0\" y2=\"0\" stroke=\"" + C.line + "\"/>";
    });
    return s;
  }

  /* ------------------------------------------------- 1. indexed to 2019 --- */
  function renderIndex() {
    var host = document.getElementById("chartIndex");
    if (!host) return;
    var W = 760, H = 340, m = { l: 44, r: 14, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = F.weeks.length;
    var xs = function (i) { return m.l + i / (n - 1) * iw; };
    var ys = function (v) { return m.t + (1 - (v - 40) / 140) * ih; };

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Transit calls by chokepoint indexed to 2019\">";
    [40, 70, 100, 130, 160].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + ys(v).toFixed(1) + "\" y2=\"" + ys(v).toFixed(1) +
        "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"" + (v === 100 ? "1" : "0.6") + "\"/>";
      s += txt(m.l - 8, (ys(v) + 3.5).toFixed(1), v, { anchor: "end", size: 9, fill: C.dim2 });
    });
    /* one tick per January */
    var lastY = null;
    F.weeks.forEach(function (wk, i) {
      var y = wk.slice(0, 4);
      if (y === lastY) return;
      lastY = y;
      s += txt(xs(i), m.t + ih + 15, y, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l + iw / 2, H - 6, "week of", { anchor: "middle", size: 9, fill: C.dim2 });
    s += txt(12, m.t + ih / 2, "index, 2019 = 100", { anchor: "middle", size: 9, fill: C.dim2, rotate: -90 });

    /* the others first, faint, so the eight named ones sit on top */
    F.points.forEach(function (p) {
      if (MAIN.indexOf(p.name) >= 0) return;
      if (!p.base) return;
      var vals = smooth(p.calls.map(function (v) { return v == null ? null : v / p.base * 100; }), state.smooth);
      var pts = vals.map(function (v, i) { return v == null ? null : [xs(i), ys(v)]; });
      s += polyline(pts, C.dim, { width: 0.7, opacity: state.all ? 0.55 : 0.22 });
    });
    MAIN.forEach(function (name, j) {
      var p = byName(name);
      if (!p || !p.base) return;
      var vals = smooth(p.calls.map(function (v) { return v == null ? null : v / p.base * 100; }), state.smooth);
      var pts = vals.map(function (v, i) { return v == null ? null : [xs(i), ys(v)]; });
      s += polyline(pts, COLORS[j % COLORS.length], { width: 1.7 });
    });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xs: F.weeks.map(function (_, i) { return xs(i); }),
      xOf: xs,
      xIndex: function (vx) {
        var i = Math.round((vx - m.l) / iw * (n - 1));
        return i >= 0 && i < n ? i : null;
      },
      label: function (i) { return "week of " + F.weeks[i]; },
      rows: function (i) {
        var out = [];
        MAIN.forEach(function (name, j) {
          var p = byName(name);
          if (!p || !p.base) return;
          var v = p.calls[i];
          if (v == null) return;
          out.push({ name: name, color: COLORS[j % COLORS.length], text: Math.round(v / p.base * 100) });
        });
        return out.sort(function (a, b) { return b.text - a.text; });
      }
    });

    var leg = document.getElementById("legendIndex");
    if (leg) {
      leg.innerHTML = MAIN.map(function (name, j) {
        return "<span><i style='background:" + COLORS[j % COLORS.length] + "'></i>" + name + "</span>";
      }).join("") + "<span><i style='background:" + C.dim + ";opacity:.5'></i>20 others</span>";
    }
  }

  /* ------------------------------------------------------ 2. the big four --- */
  function renderBig() {
    var host = document.getElementById("chartBig");
    if (!host) return;
    var W = 760, H = 320, m = { l: 44, r: 14, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = F.weeks.length;
    var xs = function (i) { return m.l + i / (n - 1) * iw; };
    var PICK = ["Suez Canal", "Panama Canal", "Bab el-Mandeb Strait", "Cape of Good Hope"];
    var COL = [C.mint, C.blue, C.red, C.amber];
    var max = 0;
    PICK.forEach(function (nm) {
      var p = byName(nm);
      if (!p) return;
      p.calls.forEach(function (v) { if (v != null && v > max) max = v; });
    });
    max = Math.ceil(max * 1.1);
    var ys = function (v) { return m.t + (1 - v / max) * ih; };

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Daily transit calls at four chokepoints\">";
    for (var gv = 0; gv <= max; gv += Math.ceil(max / 5 / 10) * 10) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + ys(gv).toFixed(1) + "\" y2=\"" + ys(gv).toFixed(1) +
        "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.6\"/>";
      s += txt(m.l - 8, (ys(gv) + 3.5).toFixed(1), Math.round(gv), { anchor: "end", size: 9, fill: C.dim2 });
    }
    var lastY = null;
    F.weeks.forEach(function (wk, i) {
      var y = wk.slice(0, 4);
      if (y === lastY) return;
      lastY = y;
      s += txt(xs(i), m.t + ih + 15, y, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(12, m.t + ih / 2, "transit calls per day", { anchor: "middle", size: 9, fill: C.dim2, rotate: -90 });

    PICK.forEach(function (nm, j) {
      var p = byName(nm);
      if (!p) return;
      var vals = smooth(p.calls, state.smooth);
      var pts = vals.map(function (v, i) { return v == null ? null : [xs(i), ys(v)]; });
      s += polyline(pts, COL[j], { width: 1.8 });
    });
    s += "</svg>";
    host.innerHTML = s;

    bindHover(host, {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xs: F.weeks.map(function (_, i) { return xs(i); }),
      xOf: xs,
      xIndex: function (vx) {
        var i = Math.round((vx - m.l) / iw * (n - 1));
        return i >= 0 && i < n ? i : null;
      },
      label: function (i) { return "week of " + F.weeks[i]; },
      rows: function (i) {
        return PICK.map(function (nm, j) {
          var p = byName(nm);
          var v = p && p.calls[i];
          return v == null ? null : { name: nm, color: COL[j], text: Math.round(v) };
        }).filter(Boolean);
      }
    });

    var leg = document.getElementById("legendBig");
    if (leg) {
      leg.innerHTML = PICK.map(function (nm, j) {
        return "<span><i style='background:" + COL[j] + "'></i>" + nm + "</span>";
      }).join("");
    }
  }

  /* ------------------------------------------------------- 3. capacity --- */
  function renderCapacity() {
    var host = document.getElementById("chartCapacity");
    if (!host) return;
    var TOP = F.points.filter(function (p) { return p.capNow; }).slice(0, 10);
    var W = 380, H = 30 * TOP.length + 46, m = { l: 132, r: 26, t: 14, b: 26 };
    var iw = W - m.l - m.r;
    var max = Math.max.apply(null, TOP.map(function (p) { return p.capNow; }));
    var xs = function (v) { return m.l + v / max * iw; };
    var TYPE_COL = [C.blue, C.amber, C.steel, C.teal, C.violet];

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Carrying capacity by chokepoint and vessel type\">";
    TOP.forEach(function (p, i) {
      var y = m.t + i * 30;
      var x = m.l;
      p.mix.forEach(function (seg, j) {
        var w = seg.share * (p.capNow / max * iw);
        s += "<rect x=\"" + x.toFixed(1) + "\" y=\"" + (y + 6) + "\" width=\"" + Math.max(0, w).toFixed(1) +
          "\" height=\"11\" fill=\"" + TYPE_COL[j] + "\" fill-opacity=\"0.75\"/>";
        x += w;
      });
      s += txt(m.l - 8, y + 15, p.name.replace(" Strait", "").replace(" Canal", ""), { anchor: "end", size: 9, fill: C.dim });
      s += txt(max ? (m.l + p.capNow / max * iw + 6) : 0, y + 15, Math.round(p.capNow / 1000) + "k",
        { size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 8, "mean daily capacity, last four weeks", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    var leg = document.getElementById("legendCapacity");
    if (!leg) {
      leg = document.createElement("div");
      leg.id = "legendCapacity";
      leg.className = "legend";
      host.parentNode.appendChild(leg);
    }
    leg.innerHTML = F.types.map(function (t, j) {
      return "<span><i style='background:" + TYPE_COL[j] + "'></i>" + t + "</span>";
    }).join("");
  }

  /* --------------------------------------------------- 4. change since 2019 --- */
  function renderChange() {
    var host = document.getElementById("chartChange");
    if (!host) return;
    var pts = F.points.filter(function (p) { return p.change != null; })
      .slice().sort(function (a, b) { return a.change - b.change; });
    var W = 380, H = 30 * pts.length + 40, m = { l: 118, r: 34, t: 14, b: 22 };
    var iw = W - m.l - m.r;
    var lo = Math.min(-20, Math.min.apply(null, pts.map(function (p) { return p.change; })));
    var hi = Math.max(20, Math.max.apply(null, pts.map(function (p) { return p.change; })));
    var xs = function (v) { return m.l + (v - lo) / (hi - lo) * iw; };

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Change in transit calls against 2019\">";
    s += "<line x1=\"" + xs(0).toFixed(1) + "\" x2=\"" + xs(0).toFixed(1) + "\" y1=\"" + m.t + "\" y2=\"" + (H - m.b) +
      "\" stroke=\"" + C.dim2 + "\"/>";
    pts.forEach(function (p, i) {
      var y = m.t + i * 30;
      var x0 = xs(0), x1 = xs(p.change);
      s += "<rect x=\"" + Math.min(x0, x1).toFixed(1) + "\" y=\"" + (y + 6) + "\" width=\"" + Math.abs(x1 - x0).toFixed(1) +
        "\" height=\"11\" fill=\"" + (p.change < 0 ? C.red : C.mint) + "\" fill-opacity=\"0.72\"/>";
      s += txt(m.l - 8, y + 15, p.name.replace(" Strait", "").replace(" Canal", ""), { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(p.change < 0 ? x1 - 5 : x1 + 5, y + 15, (p.change > 0 ? "+" : "") + Math.round(p.change) + "%",
        { anchor: p.change < 0 ? "end" : "start", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 6, "last four weeks against the 2019 mean", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;
  }

  /* --------------------------------------------------------------- shells --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var tot = F.points.reduce(function (s, p) { return s + (p.now || 0); }, 0);
    var base = F.points.reduce(function (s, p) { return s + (p.base || 0); }, 0);
    var chg = base ? (tot / base - 1) * 100 : 0;
    var down = F.points.filter(function (p) { return p.change != null && p.change <= -10; });
    var bab = byName("Bab el-Mandeb Strait"), pan = byName("Panama Canal");
    var cards = [
      ["Daily transits, all 28", Math.round(tot), (chg >= 0 ? "+" : "") + chg.toFixed(1) + "% against 2019", true],
      ["Bab el-Mandeb", bab ? Math.round(bab.now) : "–", bab ? bab.change + "% against 2019 — the Red Sea diversion" : "", false],
      ["Panama Canal", pan ? Math.round(pan.now) : "–", pan ? pan.change + "% — drought, not war" : "", false],
      ["Straits down 10% or more", down.length, "of 28, last four weeks against 2019", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var bab = byName("Bab el-Mandeb Strait"), suez = byName("Suez Canal"), pan = byName("Panama Canal");
    var cape = byName("Cape of Good Hope");
    var tor = byName("Torres Strait"), kerch = byName("Kerch Strait");
    var s = "<h2>What this page shows</h2>" +
      "<p><span class='tag green'>measured, daily</span> The global network is more brittle than its volume suggests, " +
      "and the brittleness is legible at week resolution. Bab el-Mandeb is at " +
      (bab ? Math.round(bab.now) + " transits a day against a 2019 mean of " + Math.round(bab.base) + " (" + bab.change + "%)" : "n/a") +
      " and Suez at " + (suez ? suez.change : "n/a") + "%. Traffic that leaves the Red Sea arrives at the Cape of Good Hope, " +
      (cape ? "now " + cape.change + "% against 2019" : "") + ". Nothing was produced less; the route simply moved, and the " +
      "cost moved with it.</p>" +
      "<p><span class='tag amber'>a different cause</span> Panama is down " + (pan ? pan.change : "n/a") +
      "% for a reason with nothing to do with conflict: too little rain to fill the locks. Two of the three busiest " +
      "artificial waterways in the world were constrained in the same period by unrelated causes, which is the argument " +
      "for looking at the network rather than at any one event.</p>" +
      "<p><span class='tag dim'>the limits</span> This page measures ships, not cargo value and not price. A chokepoint " +
      "at 100% of 2019 is a normal week; a strait at 40% is a fact about routing, and the cost of that routing lives in " +
      "freight rates this dataset does not carry. The two thinnest series here — Torres Strait and Kerch — move on " +
      "single-digit counts, so their percentages are arithmetic on small numbers, and the page shows them at the bottom " +
      "of the change chart rather than pretending they are comparable.</p>";
    host.innerHTML = s;
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-freight.mjs</code>, and stored in the data file with the series they describe.</p>" +
      "<div class='checks'>" + F.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label +
          " <b>" + c.value + "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" +
      "<div class='srcline'><b>IMF PortWatch</b> — daily chokepoint transit calls and shipment volume estimates. " +
      "Published openly on HDX; " + F.span.weeks + " weeks from " + F.span.from + " to " + F.span.to + "." +
      "<br><a href='" + F.source.url + "' target='_blank' rel='noopener'>dataset</a> · " +
      "<a href='" + F.source.meta + "' target='_blank' rel='noopener'>chokepoint metadata</a></div>" +
      "<div class='srcline'><b>Why this is here</b> — every other page in this lab moves in years or decades. " +
      "Distribution fails before production does, and this is the distribution, measured every day.</div>";
  }

  /* ------------------------------------------------------------- controls --- */
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
    lab.innerHTML = "<span class='lever-name'>Smoothing</span><b class='lever-val' id='v_smooth'>4 weeks</b>";
    var sel = document.createElement("select");
    sel.id = "smoothSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#1a1a1a;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    [[1, "1 week, raw"], [4, "4 weeks"], [13, "13 weeks"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0]; opt.textContent = o[1];
      if (o[0] === state.smooth) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      state.smooth = +sel.value;
      document.getElementById("v_smooth").textContent = state.smooth + " week" + (state.smooth > 1 ? "s" : "");
      renderIndex(); renderBig();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    var wrap2 = document.createElement("div");
    wrap2.className = "lever";
    var lab2 = document.createElement("label");
    lab2.className = "lever-top";
    lab2.innerHTML = "<span class='lever-name'>Show the other 20 straits</span>";
    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = state.all;
    chk.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk.addEventListener("change", function () {
      state.all = chk.checked;
      renderIndex();
    });
    wrap2.appendChild(lab2);
    wrap2.appendChild(chk);
    g.appendChild(wrap2);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "The eight named straits are drawn at full weight; the remaining twenty are faint until switched on.";
    g.appendChild(note);

    host.appendChild(g);
  }

  /* ------------------------------------------------------------------ init --- */
  renderKpis();
  renderVerdict();
  renderIndex();
  renderBig();
  renderCapacity();
  renderChange();
  renderChecks();
  renderSources();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.smooth = 4; state.all = false;
      var sel = document.getElementById("smoothSel");
      if (sel) sel.value = "4";
      var vs = document.getElementById("v_smooth");
      if (vs) vs.textContent = "4 weeks";
      var chk = document.querySelector("#controls input[type=checkbox]");
      if (chk) chk.checked = false;
      renderIndex(); renderBig();
    });
  }

  window.addEventListener("resize", function () {
    clearTimeout(state.rt);
    state.rt = setTimeout(function () {
      renderIndex(); renderBig(); renderCapacity(); renderChange();
    }, 180);
  });
})();
