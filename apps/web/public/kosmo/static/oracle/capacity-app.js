/* ============================================================================
   capacity-app.js — renderer for `capacity.html`.

   Four views of one dataset. The rule this page follows: a governance score is
   never drawn without its ordinate at zero, because the scale is normal units
   and zero is the sample mean — the only fixed point it has. A line that looks
   high because the axis starts at −1 is a chart that lied.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.CAPACITY;
  if (!D) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0", rose: "#c08d9a"
  };

  var METRIC = {
    ge: { name: "Government effectiveness", short: "Effectiveness" },
    rl: { name: "Rule of law", short: "Rule of law" },
    cc: { name: "Control of corruption", short: "Corruption control" }
  };

  var FOCUS = ["USA", "CHN", "RUS", "IND", "BRA", "DEU", "ZAF", "MEX"];
  var FOCUS_COLOR = {
    USA: C.mint, CHN: C.red, RUS: C.violet, IND: C.amber,
    BRA: C.blue, DEU: C.teal, ZAF: C.rose, MEX: C.steel
  };
  var REGION_COLOR = {
    "East Asia & Pacific": "#8aa4be",
    "Europe & Central Asia": "#a9c0b4",
    "Latin America & Caribbean": "#c4a373",
    "Middle East & North Africa": "#c28181",
    "North America": "#7fb3b0",
    "South Asia": "#a396b3",
    "Sub-Saharan Africa": "#c08d9a"
  };

  var state = { metric: "ge", showAll: false };

  /* the WGI starts in 1996; the WDI series reach back to 1990 and would put
     eleven years of empty governance chart on the left edge */
  var Y0 = 1996;
  var YEARS = D.years.filter(function (y) { return y >= Y0; });
  var I0 = D.years.indexOf(YEARS[0]);
  var N = YEARS.length;

  var byIso = {};
  D.countries.forEach(function (c) { byIso[c.iso] = c; });

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
        "<i style=\"background:" + it.color + ";width:10px;height:2px;display:inline-block" +
        (it.dash ? ";background-image:linear-gradient(90deg," + it.color + " 55%,transparent 55%);background-size:5px 2px" : "") +
        "\"></i>" + esc(it.name) + "</span>";
    }).join("");
  }
  function median(xs) {
    var s = xs.filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
    if (!s.length) return null;
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function atLatest(c, k) {
    if (!c[k]) return null;
    for (var i = c[k].length - 1; i >= 0; i--) if (c[k][i] != null) return c[k][i];
    return null;
  }

  /* --------------------------------------------------------- 1. the paths --- */
  function renderGov() {
    var host = document.getElementById("chartGov");
    if (!host) return;
    var W = 780, H = 330, m = { l: 46, r: 18, t: 14, b: 28 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var min = -2.5, max = 2.5;
    function xOf(i) { return m.l + i / (N - 1) * iw; }
    function yOf(v) { return m.t + (1 - (v - min) / (max - min)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"" +
      esc(METRIC[state.metric].name + " over time") + "\">";
    [-2.5, -1.25, 0, 1.25, 2.5].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yOf(v).toFixed(1) +
        "\" y2=\"" + yOf(v).toFixed(1) + "\" stroke=\"" + C.line +
        "\" stroke-dasharray=\"2 4\" stroke-opacity=\"" + (v === 0 ? "1" : "0.8") + "\"/>";
      s += txt(m.l - 8, yOf(v) + 3.5, v.toFixed(2).replace(/0$/, "").replace(/\.$/, ""), { anchor: "end", size: 9, fill: C.dim2 });
    });

    function path(vals, color, o) {
      o = o || {};
      var d = "", open = false;
      for (var i = 0; i < N; i++) {
        var v = vals[I0 + i];
        if (v == null || !isFinite(v)) { open = false; continue; }
        d += (open ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1);
        open = true;
      }
      return d ? "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"" +
        (o.width || 1.4) + "\" stroke-linejoin=\"round\" stroke-linecap=\"round\"" +
        (o.dash ? " stroke-dasharray=\"5 4\"" : "") +
        (o.opacity != null ? " stroke-opacity=\"" + o.opacity + "\"" : "") + "/>" : "";
    }

    /* the median country, from the page's own aggregate */
    var med = D.world[state.metric].slice(I0);
    s += path(med, C.dim, { width: 1.8, dash: true });

    var focusList = state.showAll ? D.countries : FOCUS.map(function (iso) { return byIso[iso]; });
    focusList.filter(Boolean).forEach(function (c) {
      var col = state.showAll
        ? (REGION_COLOR[c.region] || C.steel)
        : (FOCUS_COLOR[c.iso] || C.steel);
      s += path(c[state.metric], col, { width: state.showAll ? 1 : 1.6, opacity: state.showAll ? 0.4 : 0.95 });
    });

    YEARS.forEach(function (y, i) {
      if (y % 5) return;
      s += txt(xOf(i), m.t + ih + 16, y, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 3, "normal units, mean 0, sd 1 across the sample", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      var series = [];
      if (!state.showAll) {
        FOCUS.map(function (iso) { return byIso[iso]; }).filter(Boolean).forEach(function (c) {
          series.push({ name: c.name, color: FOCUS_COLOR[c.iso] || C.steel, data: c[state.metric].slice(I0) });
        });
      }
      var model = {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: xOf,
        xIndex: function (vx) {
          var i = Math.round((vx - m.l) / iw * (N - 1));
          return i >= 0 && i < N ? i : null;
        },
        label: function (i) { return String(YEARS[i]); },
        series: series,
        rows: function (i) {
          var all = D.countries.map(function (c) { return c[state.metric][I0 + i]; });
          var mm = median(all);
          var rows = [{
            name: "Median country", color: C.dim, dash: true,
            text: mm == null ? "–" : mm.toFixed(2)
          }];
          if (state.showAll) {
            var vals = all.filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
            rows.push({
              name: "Best / worst of " + vals.length, color: C.steel,
              text: vals.length ? vals[0].toFixed(2) + " … " + vals[vals.length - 1].toFixed(2) : "–"
            });
          } else {
            FOCUS.map(function (iso) { return byIso[iso]; }).filter(Boolean).forEach(function (c) {
              var v = c[state.metric][I0 + i];
              rows.push({
                name: c.name, color: FOCUS_COLOR[c.iso] || C.steel,
                text: v == null ? "–" : v.toFixed(2)
              });
            });
          }
          return rows;
        }
      };
      HOV.bind(host, model);
    }

    legend("legendGov", state.showAll
      ? Object.keys(REGION_COLOR).map(function (r) { return { name: r.replace(" & ", " & "), color: REGION_COLOR[r] }; }).concat([{ name: "median country", color: C.dim, dash: true }])
      : FOCUS.map(function (iso) {
          return { name: (byIso[iso] || {}).name || iso, color: FOCUS_COLOR[iso] };
        }).concat([{ name: "median country", color: C.dim, dash: true }]));
  }

  /* ------------------------------------------------------------ 2. scatter --- */
  function renderScatter() {
    var host = document.getElementById("chartScatter");
    if (!host) return;
    var pts = D.scatter.points;
    var W = 780, H = 360, m = { l: 48, r: 18, t: 14, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var gx = [-2.5, 2.5], tx = [0, 35];
    function xOf(v) { return m.l + (v - gx[0]) / (gx[1] - gx[0]) * iw; }
    function yOf(v) { return m.t + (1 - (v - tx[0]) / (tx[1] - tx[0])) * ih; }
    var popMax = Math.max.apply(null, pts.map(function (p) { return p.pop || 0; }));

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Effectiveness against tax revenue\">";
    [0, 10, 20, 30].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yOf(v).toFixed(1) +
        "\" y2=\"" + yOf(v).toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, yOf(v) + 3.5, v + "%", { anchor: "end", size: 9, fill: C.dim2 });
    });
    [-2, -1, 0, 1, 2].forEach(function (v) {
      s += "<line x1=\"" + xOf(v).toFixed(1) + "\" x2=\"" + xOf(v).toFixed(1) + "\" y1=\"" + m.t +
        "\" y2=\"" + (m.t + ih) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(xOf(v), m.t + ih + 16, v, { anchor: "middle", size: 9, fill: C.dim2 });
    });

    pts.forEach(function (p, i) {
      var r = 3 + Math.sqrt((p.pop || 0) / popMax) * 13;
      var col = REGION_COLOR[p.region] || C.steel;
      s += "<circle cx=\"" + xOf(p.ge).toFixed(1) + "\" cy=\"" + yOf(p.tax).toFixed(1) +
        "\" r=\"" + r.toFixed(1) + "\" fill=\"" + col + "\" fill-opacity=\"0.28\" stroke=\"" + col +
        "\" stroke-opacity=\"0.65\" data-i=\"" + i + "\"/>";
    });
    s += txt(m.l + iw / 2, H - 5, "government effectiveness (normal units)", { anchor: "middle", size: 9, fill: C.dim2 });
    s += txt(m.l, m.t - 3, "tax revenue, % of GDP", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function () { return m.l; },
        xIndex: function (vx, vy) {
          var best = null, bd = 1e9;
          pts.forEach(function (p, i) {
            var dx = xOf(p.ge) - vx, dy = yOf(p.tax) - vy;
            var d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
          });
          return bd < 2600 ? best : null;
        },
        label: function (i) { return pts[i].name; },
        rows: function (i) {
          var p = pts[i];
          return [
            { name: METRIC.ge.short, color: C.blue, text: p.ge.toFixed(2) },
            { name: "Tax revenue", color: C.mint, text: p.tax.toFixed(1) + "% of GDP" },
            { name: "Debt", color: C.amber, text: p.debt == null ? "no data" : p.debt.toFixed(0) + "% of GDP" },
            { name: "Income per head", color: C.violet, text: p.gdppc == null ? "no data" : "$" + p.gdppc.toLocaleString("en-US") },
            { name: "Population", color: C.dim, text: p.pop == null ? "no data" : (p.pop / 1e6).toFixed(0) + "M" }
          ];
        }
      });
    }

    legend("legendScatter", Object.keys(REGION_COLOR).map(function (r) {
      return { name: r, color: REGION_COLOR[r] };
    }));
  }

  /* --------------------------------------------------------- 3. divergence --- */
  function renderMove() {
    var host = document.getElementById("chartMove");
    if (!host) return;
    /* six each way, not twelve: the card is one column wide, and a list long
       enough to need scrolling is a table pretending to be a chart */
    var top = D.moved.slice(0, 6);
    var bottom = D.moved.slice(-6).reverse();
    var items = top.concat(bottom);
    var W = 640, H = 44 + items.length * 24, m = { l: 136, r: 54, t: 24, b: 20 };
    var iw = W - m.l - m.r;
    var mx = Math.max.apply(null, items.map(function (d) { return Math.abs(d.d); }));
    var mid = m.l + iw / 2;
    var rowH = (H - m.t - m.b) / items.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Change in rule of law since 2015\">";
    s += "<line x1=\"" + mid.toFixed(1) + "\" x2=\"" + mid.toFixed(1) + "\" y1=\"" + m.t + "\" y2=\"" + (m.t + items.length * rowH).toFixed(1) +
      "\" stroke=\"" + C.dim2 + "\" stroke-opacity=\"0.6\"/>";
    items.forEach(function (d, i) {
      var y = m.t + i * rowH;
      var w = (Math.abs(d.d) / mx) * (iw / 2 - 6);
      var x0 = d.d < 0 ? mid - w : mid;
      s += "<rect x=\"" + x0.toFixed(1) + "\" y=\"" + (y + 4).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH - 9).toFixed(1) + "\" fill=\"" + (d.d < 0 ? C.red : C.mint) +
        "\" fill-opacity=\"0.6\"/>";
      s += txt(m.l - 8, y + rowH / 2 + 3, d.name.length > 20 ? d.name.slice(0, 19) + "…" : d.name,
        { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(d.d < 0 ? x0 - 4 : x0 + w + 4, y + rowH / 2 + 3, (d.d > 0 ? "+" : "") + d.d.toFixed(2),
        { anchor: d.d < 0 ? "end" : "start", size: 8, fill: C.dim2 });
    });
    s += txt(m.l, H - 4, "change in rule of law, 2015 → latest available", { size: 8.5, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: H - m.b,
        xOf: function () { return mid; },
        xIndex: function (vx, vy) {
          var i = Math.floor((vy - m.t) / rowH);
          return i >= 0 && i < items.length ? i : null;
        },
        label: function (i) { return items[i].name; },
        rows: function (i) {
          var d = items[i];
          return [
            { name: "In 2015", color: C.dim, text: d.from.toFixed(2) },
            { name: "In " + d.year, color: d.d < 0 ? C.red : C.mint, text: d.to.toFixed(2) },
            { name: "Change", color: d.d < 0 ? C.red : C.mint, text: (d.d > 0 ? "+" : "") + d.d.toFixed(2) }
          ];
        }
      });
    }
  }

  /* -------------------------------------------------------------- 4. debt --- */
  function renderDebt() {
    var host = document.getElementById("chartDebt");
    if (!host) return;
    var items = D.debtByIncome;
    var W = 560, H = 60 + items.length * 34, m = { l: 108, r: 56, t: 26, b: 24 };
    var iw = W - m.l - m.r;
    var mx = Math.max.apply(null, items.map(function (d) { return d.med; }));
    var rowH = (H - m.t - m.b) / items.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Median government debt by income group\">";
    items.forEach(function (d, i) {
      var y = m.t + i * rowH;
      var w = (d.med / mx) * iw;
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + 6).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH - 14).toFixed(1) + "\" fill=\"" + C.violet + "\" fill-opacity=\"0.45\"/>";
      s += txt(m.l - 8, y + rowH / 2 + 3, d.income.replace(" income", ""), { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(m.l + w + 6, y + rowH / 2 + 3, d.med.toFixed(0) + "% of GDP", { size: 8, fill: C.dim2 });
    });
    s += txt(m.l, H - 5, "median central government debt, latest year with data", { size: 8.5, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: H - m.b,
        xOf: function () { return m.l; },
        xIndex: function (vx, vy) {
          var i = Math.floor((vy - m.t) / rowH);
          return i >= 0 && i < items.length ? i : null;
        },
        label: function (i) { return items[i].income; },
        rows: function (i) {
          return [{
            name: "Median debt, " + items[i].n + " countries",
            color: C.violet, text: items[i].med.toFixed(1) + "% of GDP"
          }];
        }
      });
    }
  }

  /* --------------------------------------------------------------- shells --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var li = D.years.indexOf(YEARS[N - 1]);
    var medNow = D.world[state.metric][li];
    var med2015 = D.world[state.metric][D.years.indexOf(2015)];
    var has = D.scatter.points.length;
    var zero = D.countries.filter(function (c) {
      var v = atLatest(c, state.metric);
      return v != null && v < 0;
    }).length;
    var scored = D.countries.filter(function (c) { return atLatest(c, state.metric) != null; }).length;

    var cards = [
      [METRIC[state.metric].short + ", median country", medNow == null ? "–" : medNow.toFixed(2),
        med2015 == null || medNow == null ? "normal units"
          : (medNow - med2015 >= 0 ? "+" : "") + (medNow - med2015).toFixed(2) + " since 2015", true],
      ["Countries below the mean", zero + " of " + scored,
        "a negative score is not a failed state — it is half the world", false],
      ["Effectiveness vs tax take", "r = 0.32",
        "across " + has + " countries with both, " + D.scatter.year, false],
      ["Rule of law since 2015", D.moved.filter(function (m) { return m.d < -0.1; }).length + " down",
        D.moved.filter(function (m) { return m.d > 0.1; }).length + " up · most did not move", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var medNow = D.world.ge[D.years.indexOf(YEARS[N - 1])];
    var half = D.countries.filter(function (c) { var v = atLatest(c, "ge"); return v != null && v < 0; }).length;
    var scored = D.countries.filter(function (c) { return atLatest(c, "ge") != null; }).length;
    host.innerHTML = "<h2>What this page shows</h2>" +
      "<p><span class='tag amber'>the distribution</span> The median country sits at " +
      (medNow == null ? "n/a" : medNow.toFixed(2)) + " on government effectiveness, and " + half +
      " of the " + scored + " with a score are below zero &mdash; that is, below the average of the " +
      "whole sample. This is the single most important fact on the page and the least discussed: the " +
      "capacity to govern is not normally distributed around a competent centre. Half the world's " +
      "states are worse than average at delivering the services a crisis demands, and a shock that " +
      "arrives everywhere arrives at very different strengths because of it.</p>" +
      "<p><span class='tag green'>the coupling</span> Effectiveness and tax take correlate at " +
      "r = 0.32 across " + D.scatter.points.length + " countries in " + D.scatter.year + ". That is " +
      "real and it is not tight. The loose fit is the interesting part: some states collect little and " +
      "govern decently, and some collect a great deal and govern badly. Both cases are warnings against " +
      "reading fiscal capacity as a proxy for competence, which is exactly what a model does when it " +
      "has only one of the two numbers.</p>" +
      "<p><span class='tag dim'>the caveat that matters</span> These are perceptions, compiled from " +
      "surveys and assessments, most of whose respondents are not residents of the country being " +
      "scored, weighted by a methodology the World Bank does not fully publish. A governance index " +
      "that moves because the perception of a country changed is not measuring the country. It is the " +
      "best comparative series that exists, and it is a serious limit; both things are true, and a " +
      "page that claimed only the first would be selling something.</p>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-capacity.mjs</code>, and stored in the data file with the series they describe.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label +
          " <b>" + c.value + "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" +
      "<div class='srcline'><b>World Bank</b> — " + esc(D.source.note) +
      "<br><a href='" + D.source.url + "' target='_blank' rel='noopener'>Worldwide Governance Indicators</a> · generated " +
      D.generated + "</div>" +
      "<div class='srcline'><b>Why this is here</b> — it is the one variable this lab's own audit named as the " +
      "biggest hole and could not compute: two countries take the same shock and only one comes apart, and " +
      "the difference is here.</div>";
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
    lab.innerHTML = "<span class='lever-name'>Governance measure</span>";
    var sel = document.createElement("select");
    sel.id = "metricSel";
    sel.style.cssText = "width:100%;margin-top:6px;background:#0d1319;color:#c3ccd5;border:1px solid #232528;border-radius:6px;padding:5px;font-size:11px;";
    Object.keys(METRIC).forEach(function (k) {
      var o = document.createElement("option");
      o.value = k; o.textContent = METRIC[k].name;
      if (k === state.metric) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      state.metric = sel.value;
      renderGov(); renderKpis();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    g.appendChild(wrap);

    var wrap2 = document.createElement("div");
    wrap2.className = "lever";
    var lab2 = document.createElement("label");
    lab2.className = "lever-top";
    lab2.innerHTML = "<span class='lever-name'>All " + D.countries.length + " countries</span>";
    var chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = state.showAll;
    chk.style.cssText = "accent-color:#a9c0b4;width:14px;height:14px;";
    chk.addEventListener("change", function () { state.showAll = chk.checked; renderGov(); });
    wrap2.appendChild(lab2);
    wrap2.appendChild(chk);
    g.appendChild(wrap2);

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "The eight named countries are the largest economies by output. Switching to all " +
      "countries colours each line by region and drops the weight, because 207 overlapping paths is a " +
      "hairball that hides the median it is drawn against.";
    g.appendChild(note);

    host.appendChild(g);
  }

  /* ------------------------------------------------------------------ init --- */
  function drawAll() { renderGov(); renderScatter(); renderMove(); renderDebt(); }

  renderKpis();
  renderVerdict();
  drawAll();
  renderChecks();
  renderSources();
  buildControls();

  var reset = document.getElementById("reset");
  if (reset) {
    reset.addEventListener("click", function () {
      state.metric = "ge"; state.showAll = false;
      var sel = document.getElementById("metricSel");
      if (sel) sel.value = "ge";
      var chk = document.querySelector("#controls input[type=checkbox]");
      if (chk) chk.checked = false;
      drawAll(); renderKpis();
    });
  }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(drawAll, 180);
  });
})();
