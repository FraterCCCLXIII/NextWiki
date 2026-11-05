/* ============================================================================
   Timeline page renderer. Depends on timeline-data.js (global TL).
   ============================================================================ */
(function () {
  "use strict";

  var T = TL;
  var NOW = 2026.85;   // November 2026

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  var TRACK_COLOR = { compute: "#8aa4be", ai: "#a9c0b4", theory: "#a396b3", life: "#c4a373" };
  var TRACK_NAME = { compute: "substrate", ai: "capability", theory: "theory", life: "life span" };
  var KIND_COLOR = {
    survey: "#a9c0b4", aggregate: "#8aa4be", model: "#a396b3",
    individual: "#c4a373", lab: "#c28181"
  };

  function pow10(x) { return Math.pow(10, x); }

  /* ============================================================== chronology */
  function renderTimeline() {
    var host = document.getElementById("chrono");
    var html = "";

    T.ERAS.forEach(function (era) {
      var evs = T.EVENTS.filter(function (e) { return e.era === era.id; })
        .sort(function (a, b) { return a.date - b.date; });
      if (!evs.length) return;

      html += '<div class="era-head" style="--era:' + era.accent + '">' +
        '<span class="era-name">' + era.name + '</span>' +
        '<span class="era-span">' + era.span + '</span></div>';

      html += '<ol class="evlist">';
      evs.forEach(function (e) {
        html += '<li class="ev" data-track="' + e.track + '">' +
          '<div class="ev-left">' +
            '<span class="ev-year">' + e.year + '</span>' +
            '<span class="ev-track" style="color:' + TRACK_COLOR[e.track] + '">' + TRACK_NAME[e.track] + '</span>' +
          '</div>' +
          '<div class="ev-body">' +
            '<h3>' + e.title + '</h3>' +
            '<p>' + e.text + '</p>' +
            '<div class="ev-foot">' +
              '<span class="ev-metric">' + (e.metric || "") + '</span>' +
              (e.src ? '<a class="ev-src" href="' + e.src + '" target="_blank" rel="noopener">source</a>' : "") +
              '<span class="ev-conf conf-' + e.conf + '">' + e.conf + '</span>' +
            '</div>' +
          '</div></li>';
      });
      html += '</ol>';
    });

    host.innerHTML = html;
  }

  function buildTrackFilter() {
    var host = document.getElementById("trackFilter");
    var opts = [["all", "Everything"], ["compute", "Substrate"], ["ai", "Capability"],
      ["life", "Life span"], ["theory", "Theory"]];
    host.innerHTML = opts.map(function (o, i) {
      return '<button type="button" class="sortbtn' + (i === 0 ? " active" : "") +
        '" data-t="' + o[0] + '">' + o[1] + '</button>';
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll(".sortbtn"), function (b) {
      b.addEventListener("click", function () {
        var t = b.dataset.t;
        Array.prototype.forEach.call(host.querySelectorAll(".sortbtn"), function (x) {
          x.classList.toggle("active", x === b);
        });
        Array.prototype.forEach.call(document.querySelectorAll(".ev"), function (e) {
          e.classList.toggle("hidden", t !== "all" && e.dataset.track !== t);
        });
      });
    });
  }

  /* =================================================== compute projection chart */
  function renderProjection() {
    var host = document.getElementById("projChart");
    var slider = document.getElementById("rateSlider");
    var readout = document.getElementById("projRead");

    function draw() {
      var rate = parseFloat(slider.value);       // x per year
      var W = 700, H = 320, m = { l: 56, r: 22, t: 18, b: 30 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var x0 = 2019.5, x1 = 2042;
      var yLo = 22, yHi = 33;                    // log10 FLOP

      function X(y) { return m.l + (y - x0) / (x1 - x0) * iw; }
      function Y(l) { return m.t + (1 - (l - yLo) / (yHi - yLo)) * ih; }

      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Training compute over time with projection">';

      /* latency wall shading */
      s += '<rect x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' +
        (Y(30) - m.t).toFixed(1) + '" fill="#c28181" opacity="0.045"/>';
      s += '<text x="' + (m.l + 6) + '" y="' + (m.t + 12) + '" fill="#a35259" font-size="9.5" font-family="ui-monospace,monospace">above 10^30 FLOP — latency-bound</text>';

      /* grid */
      for (var l = yLo; l <= yHi; l += 2) {
        s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(l).toFixed(1) + '" y2="' + Y(l).toFixed(1) +
          '" stroke="#232528" stroke-dasharray="2 4"/>';
        s += '<text x="' + (m.l - 7) + '" y="' + (Y(l) + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">1e' + l + '</text>';
      }
      for (var yr = 2020; yr <= 2040; yr += 5) {
        s += '<text x="' + X(yr).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + yr + '</text>';
      }

      /* thresholds */
      T.THRESHOLDS.forEach(function (th) {
        var lv = Math.log10(th.flop);
        if (lv < yLo || lv > yHi) return;
        s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(lv).toFixed(1) + '" y2="' + Y(lv).toFixed(1) +
          '" stroke="#c4a373" stroke-width="1" stroke-dasharray="5 4" opacity="0.5"/>';
        s += '<text x="' + (W - m.r - 4) + '" y="' + (Y(lv) - 4).toFixed(1) + '" text-anchor="end" fill="#8a7538" font-size="9" font-family="ui-monospace,monospace">' + th.label + '</text>';
      });

      /* historical trend at the measured rate */
      var anchorY = 2020.4, anchorL = Math.log10(3.14e23);
      var lr = Math.log10(rate);
      var measR = Math.log10(T.RATES.trainingCompute);

      var hist = "M" + X(anchorY).toFixed(1) + " " + Y(anchorL).toFixed(1);
      var histEnd = Math.min(2026.4, x1);
      hist += "L" + X(histEnd).toFixed(1) + " " + Y(anchorL + measR * (histEnd - anchorY)).toFixed(1);
      s += '<path d="' + hist + '" fill="none" stroke="#3d5f86" stroke-width="1.6" stroke-dasharray="4 3"/>';

      /* projection at the chosen rate */
      var proj = "M" + X(2026.4).toFixed(1) + " " + Y(anchorL + measR * (2026.4 - anchorY)).toFixed(1);
      for (var yy = 2026.4; yy <= x1; yy += 0.25) {
        var lv2 = anchorL + measR * (2026.4 - anchorY) + lr * (yy - 2026.4);
        proj += "L" + X(yy).toFixed(1) + " " + Y(lv2).toFixed(1);
      }
      var projColor = rate >= measR ? "#a9c0b4" : "#c4a373";
      s += '<path d="' + proj + '" fill="none" stroke="' + projColor + '" stroke-width="2.2" stroke-linejoin="round"/>';

      /* measured points */
      T.COMPUTE_POINTS.forEach(function (p) {
        var lv3 = Math.log10(p.flop);
        s += '<circle cx="' + X(p.year).toFixed(1) + '" cy="' + Y(lv3).toFixed(1) + '" r="3.4" fill="' +
          (p.conf === "flagged" ? "#8a7538" : "#eef4fa") + '"/>';
      });
      /* label a few */
      [[2020.4, "GPT-3", 1], [2023.2, "GPT-4", 1], [2025.15, "GPT-4.5", -1]].forEach(function (lab) {
        var p = T.COMPUTE_POINTS.filter(function (q) { return q.label === lab[1]; })[0];
        if (!p) return;
        s += '<text x="' + X(p.year).toFixed(1) + '" y="' + (Y(Math.log10(p.flop)) + (lab[2] > 0 ? 14 : -8)).toFixed(1) +
          '" text-anchor="middle" fill="#8fa3b8" font-size="9" font-family="ui-monospace,monospace">' + lab[1] + '</text>';
      });

      /* crossing markers for the chosen rate. A threshold already passed by
         measured data is reported as passed, not given a future date. */
      var baseL = anchorL + measR * (2026.4 - anchorY);
      function crossInfo(targetFlop) {
        var need = Math.log10(targetFlop) - baseL;
        if (need <= 0) return { already: true, year: null };
        if (lr <= 0) return { already: false, year: null };
        var y = 2026.4 + need / lr;
        return { already: false, year: y <= x1 ? y : null };
      }
      function crossYear(targetFlop) {
        var c = crossInfo(targetFlop);
        return c.already ? 2026.4 : c.year;
      }

      [[1e26, "#a9c0b4"], [2e29, "#c4a373"]].forEach(function (t) {
        var y = crossYear(t[0]);
        if (y === null) return;
        var lv4 = Math.log10(t[0]);
        s += '<line x1="' + X(y).toFixed(1) + '" x2="' + X(y).toFixed(1) + '" y1="' + Y(lv4).toFixed(1) +
          '" y2="' + (m.t + ih) + '" stroke="' + t[1] + '" stroke-width="1" opacity="0.5"/>';
        s += '<circle cx="' + X(y).toFixed(1) + '" cy="' + Y(lv4).toFixed(1) + '" r="3" fill="' + t[1] + '"/>';
        s += '<text x="' + X(y).toFixed(1) + '" y="' + (m.t + ih - 5) + '" text-anchor="middle" fill="' + t[1] +
          '" font-size="9.5" font-family="ui-monospace,monospace">' + Math.round(y) + '</text>';
      });

      s += '</svg>';
      host.innerHTML = s;

      /* the card reads both curves at a year, and any measured run nearby */
      if (window.HOV) {
        var hy = [];
        for (var yv = 2020; yv <= 2042; yv++) hy.push(yv);
        HOV.bind(host, {
          W: W, H: H, top: m.t, bottom: m.t + ih,
          xOf: function (i) { return X(hy[i]); },
          xIndex: function (vx) {
            return HOV.nearest(hy, x0 + (vx - m.l) / iw * (x1 - x0));
          },
          label: function (i) { return String(hy[i]); },
          rows: function (i) {
            var yr = hy[i], rows = [];
            if (yr <= 2026.4) {
              rows.push({
                name: "measured trend", color: "#3d5f86",
                text: "1e" + (anchorL + measR * (yr - anchorY)).toFixed(1) + " FLOP"
              });
            }
            if (yr >= 2026) {
              rows.push({
                name: "projection, " + rate.toFixed(1) + "\u00d7/yr", color: projColor,
                text: "1e" + (baseL + lr * (yr - 2026.4)).toFixed(1) + " FLOP"
              });
            }
            var near = null, nd = 1e9;
            T.COMPUTE_POINTS.forEach(function (p) {
              var d = Math.abs(p.year - yr);
              if (d < nd) { nd = d; near = p; }
            });
            if (near && nd <= 0.55) {
              rows.push({
                name: near.label || "run",
                color: near.conf === "flagged" ? "#8a7538" : "#eef4fa",
                text: "1e" + Math.log10(near.flop).toFixed(1) + " \u00b7 " + near.year
              });
            }
            return rows;
          }
        });
      }

      var c26 = crossInfo(1e26), c29 = crossInfo(2e29);
      function when(c) {
        return c.already ? "already crossed (2025)" : c.year ? "<b>" + Math.round(c.year) + "</b>" : "beyond this window";
      }
      var txt;
      if (rate >= T.RATES.trainingCompute) {
        txt = 'At <b>' + rate.toFixed(1) + '×/yr</b> — the measured frontier rate since 2020 — the ' +
          '10²⁶ FLOP threshold for a legally-defined frontier model is ' + when(c26) + ', and Epoch&rsquo;s ' +
          '2030 feasibility ceiling of 2×10²⁹ FLOP is reached in ' + when(c29) + '. ' +
          'That is not a forecast of capability. It is arithmetic on a rate that has held for six years ' +
          'and is now meeting power and data limits.';
      } else if (rate >= 2) {
        txt = 'At <b>' + rate.toFixed(1) + '×/yr</b> the curve is slower: 10²⁶ is ' + when(c26) +
          ', and 2×10²⁹ is reached in ' + when(c29) + '. Note how little halving the rate does across five years, ' +
          'and how much it does across fifteen.';
      } else {
        txt = 'At <b>' + rate.toFixed(1) + '×/yr</b> — roughly the pre-deep-learning pace — the ceiling is ' +
          when(c29) + '. 10²⁶ is ' + when(c26) + '. The whole disagreement about AGI timing ' +
          'reduces to which of these curves you believe.';
      }
      readout.innerHTML = txt;
    }

    slider.addEventListener("input", draw);
    draw();
  }

  /* =========================================================== forecast spread */
  function renderForecasts() {
    var host = document.getElementById("forecastChart");
    var rows = T.FORECASTS.slice().sort(function (a, b) { return a.year - b.year; });

    var W = 720, rowH = 26, m = { l: 172, r: 54, t: 34, b: 26 };
    var H = m.t + rows.length * rowH + m.b;
    var x0 = 2025, x1 = 2135;
    var iw = W - m.l - m.r;

    function X(y) { return m.l + (y - x0) / (x1 - x0) * iw; }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Spread of AGI and superintelligence forecasts">';

    /* axis */
    [2030, 2050, 2070, 2090, 2110].forEach(function (y) {
      s += '<line x1="' + X(y).toFixed(1) + '" x2="' + X(y).toFixed(1) + '" y1="' + (m.t - 8) +
        '" y2="' + (H - m.b) + '" stroke="#232528" stroke-dasharray="2 4"/>';
      s += '<text x="' + X(y).toFixed(1) + '" y="' + (m.t - 14) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + y + '</text>';
    });

    /* today */
    s += '<line x1="' + X(NOW).toFixed(1) + '" x2="' + X(NOW).toFixed(1) + '" y1="' + (m.t - 8) +
      '" y2="' + (H - m.b) + '" stroke="#a9c0b4" stroke-width="1.2" opacity="0.6"/>';
    s += '<text x="' + X(NOW).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#a9c0b4" font-size="9" font-family="ui-monospace,monospace">now</text>';

    rows.forEach(function (r, i) {
      var y = m.t + i * rowH + rowH / 2;
      var passed = r.year < NOW;
      var px = clamp(X(r.year), m.l, W - m.r);
      var col = KIND_COLOR[r.kind];

      s += '<text x="' + (m.l - 10) + '" y="' + (y + 3.5) + '" text-anchor="end" fill="' +
        (r.missed ? "#6d7c8c" : "#b6c3d1") + '" font-size="10.5" font-family="ui-monospace,monospace">' + r.who + '</text>';
      s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '" stroke="#141c25"/>';

      if (passed && r.year < x0) {
        s += '<text x="' + (m.l + 2) + '" y="' + (y + 3.5) + '" fill="#6d7c8c" font-size="9.5" font-family="ui-monospace,monospace">' + r.year + ' — passed</text>';
      } else {
        s += '<circle cx="' + px.toFixed(1) + '" cy="' + y + '" r="' + (r.missed ? 3 : 4.2) + '" fill="' + col + '" opacity="' + (r.missed ? 0.4 : 1) + '"/>';
        /* late dates get their description on the left, so it cannot run off
           the edge of the plot */
        var rightSide = px < W * 0.58;
        s += '<text x="' + (px + 9).toFixed(1) + '" y="' + (y + 3.5) + '" fill="' + col +
          '" font-size="9.5" font-family="ui-monospace,monospace">' + r.year + '</text>';
        s += '<text x="' + (rightSide ? (px + 36) : (px - 10)).toFixed(1) + '" y="' + (y + 3.5) +
          '" text-anchor="' + (rightSide ? "start" : "end") + '" fill="#6d7c8c" font-size="9">' + r.what + '</text>';
      }
    });

    s += '</svg>';
    host.innerHTML = s;

    /* a dot plot: the row is chosen by height, the crosshair snaps to its date */
    if (window.HOV) {
      HOV.bind(host, {
        W: W, H: H, top: m.t, bottom: H - m.b,
        xOf: function (k) { return clamp(X(rows[k].year), m.l, W - m.r); },
        xIndex: function (vx, vy) {
          var k = Math.floor((vy - m.t) / rowH);
          return k < 0 || k >= rows.length ? null : k;
        },
        label: function (k) { return rows[k].who; },
        rows: function (k) {
          var r = rows[k];
          return [
            { name: "predicted", color: KIND_COLOR[r.kind], text: r.year },
            { name: r.missed ? "passed, not met" : "still ahead", color: r.missed ? "#6d7c8c" : "#a9c0b4", text: r.kind }
          ];
        }
      });
    }

    /* legend */
    document.getElementById("forecastLegend").innerHTML =
      [["survey", "expert survey"], ["aggregate", "forecaster aggregate"], ["model", "explicit model"],
       ["individual", "individual"], ["lab", "interested party"]].map(function (k) {
        return '<span><i style="background:' + KIND_COLOR[k[0]] + '"></i>' + k[1] + '</span>';
      }).join("") + '<span class="fl-note">position on the axis = predicted year, not confidence</span>';
  }

  /* ============================================================== definitions */
  function renderDefinitions() {
    document.getElementById("defs-list").innerHTML = T.DEFINITIONS.map(function (d) {
      return '<div class="def-card"><div class="def-head"><span class="def-term">' + d.term +
        '</span><span class="def-who">' + d.who + '</span></div>' +
        '<p class="def-what">' + d.what + '</p>' +
        '<p class="def-claim"><span>Kind of claim</span>' + d.claim + '</p>' +
        '<p class="def-problem"><span>Why it resists measurement</span>' + d.problem + '</p></div>';
    }).join("");
  }

  /* ==================================================================== walls */
  function renderWalls() {
    document.getElementById("walls-list").innerHTML = T.WALLS.map(function (w, i) {
      return '<div class="wall"><div class="wall-head"><span class="wall-n">' + (i + 1) + '</span>' +
        '<h3>' + w.title + '</h3></div>' +
        '<p class="wall-now">' + w.now + '</p>' +
        '<p class="wall-bind"><span>Where it binds</span>' + w.binding + '</p>' +
        '<p class="wall-verdict">' + w.verdict + '</p></div>';
    }).join("");
  }

  /* ============================================================= track record */
  function renderTrackRecord() {
    document.getElementById("track-record").innerHTML = T.TRACK_RECORD.map(function (t) {
      return '<div class="tr-item"><div class="tr-stat">' + t.stat + '</div>' +
        '<div class="tr-label">' + t.label + '</div>' +
        '<p class="tr-text">' + t.text + '</p></div>';
    }).join("");
  }

  /* ============================================================ rate table */
  function renderRates() {
    var rows = [
      ["Training compute, frontier models", "5×/yr", "doubling every 5.2 months", "Epoch AI, since 2020; 90% CI 4–6×", "solid"],
      ["Algorithmic efficiency", "~2.8×/yr", "halves every ~8 months (5–14)", "Ho et al., Epoch, 231 language models", "solid"],
      ["Chip performance per dollar", "1.49×/yr", "doubling every 1.7 years", "Epoch, AI chips since 2023", "solid"],
      ["Chip performance per watt", "1.34×/yr", "doubling every 2.4 years", "Epoch, GPUs since 2008", "solid"],
      ["Compute per dollar, long run", "1.35×/yr", "doubling every 2.32 years since 1940", "AI Impacts 2019, via Epoch", "flagged"],
      ["Inference price, constant quality", "9–900×/yr", "range depends on the quality tier", "Stanford AI Index, Epoch, a16z", "flagged"],
      ["Agent task horizon", "~7-month doubling", "196 days full period; 89 days since 2024", "METR, time horizons 1.1", "flagged"],
      ["Total AI chip stock compute", "3.4×/yr", "doubling every 6.8 months", "Epoch, since 2022", "solid"]
    ];
    document.getElementById("rates").innerHTML =
      '<table class="rate-table"><thead><tr><th>Measured quantity</th><th>Rate</th><th>Doubling</th><th>Source</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td class="rt-num">' + r[1] + '</td>' +
          '<td class="rt-dbl">' + r[2] + '</td><td class="rt-src">' + r[3] +
          '<span class="rt-tag ' + r[4] + '">' + r[4] + '</span></td></tr>';
      }).join("") + '</tbody></table>';
  }

  function init() {
    renderTimeline();
    buildTrackFilter();
    renderProjection();
    renderForecasts();
    renderDefinitions();
    renderWalls();
    renderTrackRecord();
    renderRates();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
