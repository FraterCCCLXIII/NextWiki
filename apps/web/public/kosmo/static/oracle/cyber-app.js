/* ============================================================================
   cyber-app.js — renderer for `cyber.html`.

   Five views of one catalogue. The rule this page follows: the opening months
   are marked as a backfill wherever they appear, because a bar chart that shows
   291 in the first month beside 20 in the next invites the wrong conclusion.
   ============================================================================ */
(function () {
  "use strict";

  var D = window.CYBER;
  if (!D) return;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373", red: "#c28181",
    violet: "#a396b3", dim: "#7e8d9e", dim2: "#5b6776", line: "#232528",
    steel: "#8f9aa6", teal: "#7fb3b0"
  };

  var BACKFILL = "2021-11";

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
      (o.rotate ? " transform=\"rotate(" + o.rotate + " " + (+x).toFixed(1) + " " + (+y).toFixed(1) + ")\"" : "") +
      " font-family=\"ui-monospace,monospace\">" + esc(s) + "</text>";
  }

  /* --------------------------------------------------- 1. monthly additions --- */
  function renderFlow() {
    var host = document.getElementById("chartFlow");
    if (!host) return;
    var W = 780, H = 300, m = { l: 46, r: 16, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = D.months.length;
    var max = Math.max.apply(null, D.added);
    var bw = iw / n;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Vulnerabilities added per month\">";
    [0, 100, 200, 300].forEach(function (v) {
      if (v > max) return;
      var y = m.t + (1 - v / (max * 1.05)) * ih;
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, y + 3.5, v, { anchor: "end", size: 9, fill: C.dim2 });
    });

    D.added.forEach(function (v, i) {
      var h = (v / (max * 1.05)) * ih;
      var back = D.months[i] === BACKFILL;
      s += "<rect x=\"" + (m.l + i * bw + bw * 0.12).toFixed(1) + "\" y=\"" + (m.t + ih - h).toFixed(1) +
        "\" width=\"" + Math.max(1, bw * 0.76).toFixed(1) + "\" height=\"" + h.toFixed(1) +
        "\" fill=\"" + (back ? C.amber : C.blue) + "\" fill-opacity=\"" + (back ? "0.75" : "0.55") + "\"/>";
    });

    var lastY = "";
    D.months.forEach(function (k, i) {
      var y = k.slice(0, 4);
      if (y === lastY || k.slice(5, 7) !== "01") return;
      lastY = y;
      s += txt(m.l + i * bw, m.t + ih + 15, y, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 3, "amber: the November 2021 backfill, not a monthly rate", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return m.l + i * bw + bw / 2; },
        xIndex: function (vx) {
          var i = Math.floor((vx - m.l) / bw);
          return i >= 0 && i < n ? i : null;
        },
        label: function (i) { return D.months[i]; },
        rows: function (i) {
          var rows = [{
            name: "Added this month", color: D.months[i] === BACKFILL ? C.amber : C.blue,
            text: String(D.added[i])
          }];
          rows.push({ name: "Cumulative", color: C.dim, text: D.cumulative[i].toLocaleString("en-US") });
          return rows;
        }
      });
    }
  }

  /* -------------------------------------------------------- 2. cumulative --- */
  function renderCum() {
    var host = document.getElementById("chartCum");
    if (!host) return;
    var i0 = D.months.indexOf("2022-01");
    var months = D.months.slice(i0);
    var vals = D.cumulative.slice(i0);
    var base = D.cumulative[i0];
    var shifted = vals.map(function (v) { return v - base; });

    /* single-column cards are ~540px wide, so a 560-unit viewBox is close to
       1:1 and a 320-unit height would render over 500px tall */
    var W = 640, H = 250, m = { l: 52, r: 16, t: 16, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = months.length;
    var max = Math.max.apply(null, shifted);

    function xOf(i) { return m.l + i / (n - 1) * iw; }
    function yOf(v) { return m.t + (1 - v / (max * 1.08)) * ih; }

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Cumulative additions since 2022\">";
    [0, Math.round(max / 2), max].forEach(function (v) {
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + yOf(v).toFixed(1) +
        "\" y2=\"" + yOf(v).toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, yOf(v) + 3.5, v, { anchor: "end", size: 9, fill: C.dim2 });
    });
    var d = "";
    shifted.forEach(function (v, i) { d += (i ? " L" : "M") + xOf(i).toFixed(1) + " " + yOf(v).toFixed(1); });
    s += "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + C.mint + "\" stroke-width=\"1.8\"/>";

    var lastY = "";
    months.forEach(function (k, i) {
      if (k.slice(5, 7) !== "01" || k.slice(0, 4) === lastY) return;
      lastY = k.slice(0, 4);
      s += txt(xOf(i), m.t + ih + 15, lastY, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 3, "added since January 2022", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: xOf,
        xIndex: function (vx) {
          var i = Math.round((vx - m.l) / iw * (n - 1));
          return i >= 0 && i < n ? i : null;
        },
        label: function (i) { return months[i]; },
        rows: function (i) {
          return [
            { name: "Added since 2022", color: C.mint, text: String(shifted[i]) },
            { name: "Total in catalogue", color: C.dim, text: vals[i].toLocaleString("en-US") }
          ];
        }
      });
    }
  }

  /* ------------------------------------------------------------- 3. years --- */
  function renderYear() {
    var host = document.getElementById("chartYear");
    if (!host) return;
    var items = D.years;
    var W = 640, H = 250, m = { l: 48, r: 16, t: 16, b: 34 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = Math.max.apply(null, items.map(function (d) { return d.total; }));
    var bw = iw / items.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Additions and ransomware share by year\">";
    [0, 200, 400, 600].forEach(function (v) {
      if (v > max * 1.05) return;
      var y = m.t + (1 - v / (max * 1.08)) * ih;
      s += "<line x1=\"" + m.l + "\" x2=\"" + (m.l + iw) + "\" y1=\"" + y.toFixed(1) +
        "\" y2=\"" + y.toFixed(1) + "\" stroke=\"" + C.line + "\" stroke-dasharray=\"2 4\" stroke-opacity=\"0.8\"/>";
      s += txt(m.l - 8, y + 3.5, v, { anchor: "end", size: 9, fill: C.dim2 });
    });
    items.forEach(function (d, i) {
      var x = m.l + i * bw;
      var hR = (d.ransom / (max * 1.08)) * ih;
      var hT = (d.total / (max * 1.08)) * ih;
      s += "<rect x=\"" + (x + bw * 0.15).toFixed(1) + "\" y=\"" + (m.t + ih - hT).toFixed(1) +
        "\" width=\"" + (bw * 0.7).toFixed(1) + "\" height=\"" + hT.toFixed(1) +
        "\" fill=\"" + C.blue + "\" fill-opacity=\"0.35\"/>";
      s += "<rect x=\"" + (x + bw * 0.15).toFixed(1) + "\" y=\"" + (m.t + ih - hR).toFixed(1) +
        "\" width=\"" + (bw * 0.7).toFixed(1) + "\" height=\"" + hR.toFixed(1) +
        "\" fill=\"" + C.red + "\" fill-opacity=\"0.7\"/>";
      s += txt(x + bw / 2, m.t + ih + 15, d.y, { anchor: "middle", size: 8.5, fill: C.dim2 });
    });
    s += txt(m.l, H - 3, "red: ransomware-linked · 2021 includes the backfill", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + ih,
        xOf: function (i) { return m.l + i * bw + bw / 2; },
        xIndex: function (vx) {
          var i = Math.floor((vx - m.l) / bw);
          return i >= 0 && i < items.length ? i : null;
        },
        label: function (i) { return items[i].y; },
        rows: function (i) {
          var d = items[i];
          return [
            { name: "Entries added", color: C.blue, text: String(d.total) },
            { name: "Ransomware-linked", color: C.red, text: d.ransom + " (" + Math.round(d.ransom / d.total * 100) + "%)" }
          ];
        }
      });
    }
  }

  /* ----------------------------------------------------------- 4. vendors --- */
  function renderVendors() {
    var host = document.getElementById("chartVendors");
    if (!host) return;
    var items = D.vendors.slice(0, 10);
    var W = 640, H = 44 + items.length * 21, m = { l: 118, r: 40, t: 20, b: 20 };
    var iw = W - m.l - m.r;
    var max = items[0].n;
    var rowH = (H - m.t - m.b) / items.length;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Vendors by exploited vulnerabilities\">";
    items.forEach(function (d, i) {
      var y = m.t + i * rowH;
      var w = (d.n / max) * iw;
      var wr = (d.ransom / max) * iw;
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + 4).toFixed(1) + "\" width=\"" + w.toFixed(1) +
        "\" height=\"" + (rowH - 10).toFixed(1) + "\" fill=\"" + C.blue + "\" fill-opacity=\"0.35\"/>";
      s += "<rect x=\"" + m.l + "\" y=\"" + (y + 4).toFixed(1) + "\" width=\"" + wr.toFixed(1) +
        "\" height=\"" + (rowH - 10).toFixed(1) + "\" fill=\"" + C.red + "\" fill-opacity=\"0.55\"/>";
      s += txt(m.l - 8, y + rowH / 2 + 3, d.name.length > 16 ? d.name.slice(0, 15) + "…" : d.name,
        { anchor: "end", size: 8.5, fill: C.dim });
      s += txt(m.l + w + 5, y + rowH / 2 + 3, String(d.n), { size: 8, fill: C.dim2 });
    });
    s += txt(m.l, H - 5, "entries in the catalogue · red is ransomware-linked", { size: 8.5, fill: C.dim2 });
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
        label: function (i) { return items[i].name; },
        rows: function (i) {
          return [
            { name: "Exploited entries", color: C.blue, text: String(items[i].n) },
            { name: "Ransomware-linked", color: C.red, text: String(items[i].ransom) }
          ];
        }
      });
    }
  }

  /* -------------------------------------------------------------- 5. class --- */
  function renderClass() {
    var host = document.getElementById("chartClass");
    if (!host) return;
    var k = D.classes;
    var total = k.edge + k.other;
    var W = 640, H = 180, m = { l: 20, r: 20, t: 30, b: 42 };
    var iw = W - m.l - m.r;
    var edgeW = (k.edge / total) * iw;

    var s = "<svg viewBox=\"0 0 " + W + " " + H + "\" role=\"img\" aria-label=\"Internet-facing edge devices against the rest\">";
    s += "<rect x=\"" + m.l + "\" y=\"" + m.t + "\" width=\"" + edgeW.toFixed(1) + "\" height=\"46\" fill=\"" +
      C.amber + "\" fill-opacity=\"0.6\"/>";
    s += "<rect x=\"" + (m.l + edgeW).toFixed(1) + "\" y=\"" + m.t + "\" width=\"" + (iw - edgeW).toFixed(1) +
      "\" height=\"46\" fill=\"" + C.blue + "\" fill-opacity=\"0.3\"/>";
    s += txt(m.l + edgeW / 2, m.t + 28, Math.round(k.edge / total * 100) + "%", { anchor: "middle", size: 15, fill: "#e8eef3" });
    s += txt(m.l + edgeW + (iw - edgeW) / 2, m.t + 28, Math.round(k.other / total * 100) + "%", { anchor: "middle", size: 15, fill: C.dim });
    s += txt(m.l + edgeW / 2, m.t - 8, "edge and network", { anchor: "middle", size: 9, fill: C.dim });
    s += txt(m.l + edgeW + (iw - edgeW) / 2, m.t - 8, "everything else", { anchor: "middle", size: 9, fill: C.dim });
    s += txt(m.l, H - 22, k.edge + " edge entries · " + k.other + " others", { size: 9, fill: C.dim2 });
    s += txt(m.l, H - 8, k.edgeRansom + " of the edge entries are ransomware-linked", { size: 9, fill: C.dim2 });
    s += "</svg>";
    host.innerHTML = s;

    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: m.t + 46,
        xOf: function () { return m.l; },
        xIndex: function (vx) { return vx < m.l + edgeW ? 0 : 1; },
        label: function (i) { return i === 0 ? "Internet-facing edge and network products" : "Everything else"; },
        rows: function (i) {
          return [{
            name: "Entries", color: i === 0 ? C.amber : C.blue,
            text: (i === 0 ? k.edge : k.other) + " of " + total
          }];
        }
      });
    }
  }

  /* --------------------------------------------------------------- shells --- */
  function renderKpis() {
    var host = document.getElementById("kpis");
    if (!host) return;
    var total = D.classes.edge + D.classes.other;
    var last12 = D.added.slice(-12).reduce(function (s, n) { return s + n; }, 0);
    var cards = [
      ["Confirmed exploited", total.toLocaleString("en-US"),
        "vulnerabilities in the catalogue · " + D.span.from + " to " + D.span.to, true],
      ["Added in 12 months", String(last12),
        "the flow, once the 2021 backfill is behind it", false],
      ["Ransomware-linked", Math.round(D.classes.ransom / total * 100) + "%",
        "exploitation as a commercial product", false],
      ["Median CVE age", (D.lag.median == null ? "–" : D.lag.median + " yr"),
        "known and patchable before it was used", false]
    ];
    host.innerHTML = cards.map(function (c) {
      return "<div class='kpi" + (c[3] ? " hero" : "") + "'><div class='klabel'>" + c[0] +
        "</div><div class='kval'>" + c[1] + "</div><div class='knote'>" + c[2] + "</div></div>";
    }).join("");
  }

  function renderVerdict() {
    var host = document.getElementById("verdict");
    if (!host) return;
    var total = D.classes.edge + D.classes.other;
    host.innerHTML = "<h2>What this page shows</h2>" +
      "<p><span class='tag green'>the shape of it</span> " + Math.round(D.classes.edge / total * 100) +
      "% of entries are internet-facing products &mdash; VPN concentrators, firewalls, gateways, mail " +
      "and web servers &mdash; and the ten most-cited vendors account for " +
      Math.round(D.top10share * 100) + "% of the catalogue. That combination is what makes cyber a " +
      "systemic variable rather than an IT problem: the exposure is not spread across the economy, it " +
      "is <em>installed</em> on it, in products chosen by procurement and never seen by the people " +
      "whose work runs through them.</p>" +
      "<p><span class='tag amber'>maintenance, not discovery</span> The median exploited vulnerability " +
      "is " + (D.lag.median == null ? "several" : D.lag.median) + " years old at the point it is added " +
      "to this list. Nothing here was unknown; it was unpatched. Ransomware accounts for " +
      Math.round(D.classes.ransom / total * 100) + "% of entries, which is the commercial answer to " +
      "why anybody bothers. A lab that models shocks as exogenous events should notice that this one " +
      "has a patching rate, a purchasing decision and a vendor list &mdash; which means it is, " +
      "unusually, a hazard whose probability is partly a policy variable.</p>" +
      "<p><span class='tag dim'>the honest limit</span> This catalogue is a US government list with a " +
      "legal purpose, so it records what one agency prioritised and what vendors disclosed. Growth in " +
      "it is partly growth in exploitation and partly growth in the habit of cataloguing, and the two " +
      "cannot be separated from these data. It also contains no severity weighting, no victim counts " +
      "and no economic cost, so it cannot be entered into a model as GDP loss. What it can do is " +
      "establish the prior: a hazard that is continuous, cheap to run and concentrated in shared " +
      "infrastructure.</p>";
  }

  function renderChecks() {
    var host = document.getElementById("checks");
    if (!host) return;
    host.innerHTML = "<h2>The checks</h2>" +
      "<p>Run at ingest by <code>node ingest-cyber.mjs</code>, and stored in the data file with the series they describe.</p>" +
      "<div class='checks'>" + D.checks.map(function (c) {
        return "<div class='check ok'><span class='cval'>ok</span><span class='clabel'>" + c.label +
          " <b>" + c.value + "</b></span><span class='cdetail'>" + c.detail + "</span></div>";
      }).join("") + "</div>";
  }

  function renderSources() {
    var host = document.getElementById("sources");
    if (!host) return;
    host.innerHTML = "<h2>Sources</h2>" +
      "<div class='srcline'><b>CISA</b> — " + esc(D.source.note) +
      "<br><a href='" + D.source.url + "' target='_blank' rel='noopener'>Known Exploited Vulnerabilities catalogue</a> · generated " +
      D.generated + "</div>" +
      "<div class='srcline'><b>Why this is here</b> — no model in this lab contains a cyber term. This is " +
      "the published part of the hazard, drawn so that its absence elsewhere is a visible choice.</div>";
  }

  /* ------------------------------------------------------------- controls --- */
  function buildControls() {
    var host = document.getElementById("controls");
    if (!host) return;
    host.innerHTML = "";

    var g = document.createElement("details");
    g.className = "lgroup";
    g.open = true;
    g.innerHTML = "<summary>Reading the series<i class='caret' aria-hidden='true'></i></summary>";

    var note = document.createElement("p");
    note.className = "blurb";
    note.textContent = "The catalogue opened in November 2021 by adding years of already-known " +
      "exploitation in a single month. That bar is flagged amber everywhere it appears, and the " +
      "cumulative chart starts in January 2022 so the growth line is a rate and not an artefact.";
    g.appendChild(note);

    var row = document.createElement("div");
    row.className = "lever";
    row.innerHTML = "<label class='lever-top'><span class='lever-name'>Catalogue version</span>" +
      "<b class='lever-val'>" + esc(D.span.to.slice(0, 7)) + "</b></label>" +
      "<p class='blurb' style='margin-top:4px'>" + D.vendorCount + " distinct vendors across " +
      D.months.length + " months of additions.</p>";
    g.appendChild(row);

    host.appendChild(g);
  }

  /* ------------------------------------------------------------------ init --- */
  renderKpis();
  renderVerdict();
  renderFlow();
  renderCum();
  renderYear();
  renderVendors();
  renderClass();
  renderChecks();
  renderSources();
  buildControls();

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      renderFlow(); renderCum(); renderYear(); renderVendors(); renderClass();
    }, 180);
  });
})();
