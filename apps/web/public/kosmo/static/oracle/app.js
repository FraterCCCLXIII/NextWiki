/* ============================================================================
   Dashboard shell: levers, charts, and generated analysis.
   Depends on model.js (global SIM).
   ============================================================================ */
(function () {
  "use strict";

  var S = SIM;
  var state = {};
  for (var k in S.DEFAULTS) state[k] = S.DEFAULTS[k];

  var HORIZON = Math.round(state.horizonYears);
  var focusYear = 7;
  var result = null;
  var mc = null;
  var mcTimer = null;

  var C = {
    mint: "#a9c0b4", blue: "#8aa4be", amber: "#c4a373",
    red: "#c28181", violet: "#a396b3", dim: "#7e8d9e", line: "#232528"
  };

  /* ------------------------------------------------------------------ utils */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function pct1(x) { return (x * 100).toFixed(1) + "%"; }
  function pct0(x) { return Math.round(x * 100) + "%"; }
  function signedPct(x) { var v = Math.round(x * 100); return (v > 0 ? "+" : "") + v + "%"; }
  function money(bn) {
    if (Math.abs(bn) >= 1000) return "$" + (bn / 1000).toFixed(1) + "T";
    return "$" + Math.round(bn) + "B";
  }
  function big(x) {
    if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
    if (x >= 1e3) return Math.round(x).toLocaleString();
    return x.toFixed(x < 10 ? 1 : 0);
  }
  function fmtLever(lv, v) {
    switch (lv.fmt) {
      case "pct": return pct0(v) + (lv.suffix || "");
      case "x": return v.toFixed(2).replace(/\.?0+$/, "") + "x" + (lv.suffix || "");
      case "yr": return v.toFixed(1) + "y";
      case "mo": return v.toFixed(0) + "mo";
      case "k": return "$" + v.toFixed(0) + "k" + (lv.suffix || "");
      default: return String(v);
    }
  }

  /* --------------------------------------------------------------- svg core */
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
    var W = cfg.w || 700, H = cfg.h || 248;
    var m = { l: 48, r: cfg.right ? 50 : 16, t: 14, b: 24 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    /* geometry for hover.js */
    cfg.__geom = { W: W, H: H, m: m, iw: iw, ih: ih };
    var yrs = cfg.years;
    var xMin = yrs[0], xMax = yrs[yrs.length - 1];
    function X(v) { return m.l + (v - xMin) / (xMax - xMin) * iw; }
    var ax = { left: cfg.left, right: cfg.right };
    function Y(v, which) {
      var a = ax[which || "left"];
      return m.t + (1 - (v - a.min) / (a.max - a.min)) * ih;
    }

    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';

    // horizontal grid + left ticks
    niceTicks(cfg.left.min, cfg.left.max, 4).forEach(function (v) {
      var y = Y(v);
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) +
        '" stroke="' + C.line + '" stroke-width="1" stroke-dasharray="2 4"/>';
      out += '<text x="' + (m.l - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
        cfg.left.fmt(v) + '</text>';
    });

    if (cfg.right) {
      niceTicks(cfg.right.min, cfg.right.max, 4).forEach(function (v) {
        var y = Y(v, "right");
        out += '<text x="' + (W - m.r + 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="start" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
          cfg.right.fmt(v) + '</text>';
      });
    }

    // x ticks
    yrs.forEach(function (yr, i) {
      if (i % 2 === 0 || i === yrs.length - 1) {
        out += '<text x="' + X(yr).toFixed(1) + '" y="' + (H - 7) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' +
          Math.round(2026 + yr) + '</text>';
      }
    });

    // series
    cfg.series.forEach(function (s) {
      var d = "";
      s.data.forEach(function (v, i) {
        if (v === null || !isFinite(v)) return;
        d += (d ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v, s.axis).toFixed(1);
      });
      if (s.fill) {
        var base = Y(s.baseline !== undefined ? s.baseline : ax[s.axis || "left"].min, s.axis);
        var first = X(yrs[0]), last = X(yrs[yrs.length - 1]);
        out += '<path d="' + d + 'L' + last.toFixed(1) + ' ' + base.toFixed(1) + 'L' + first.toFixed(1) + ' ' + base.toFixed(1) + 'Z" fill="' + s.color + '" opacity="' + (s.fillOpacity || 0.12) + '"/>';
      }
      out += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 1.9) + '"' +
        (s.dash ? ' stroke-dasharray="4 3"' : '') +
        ' stroke-linejoin="round" stroke-linecap="round"/>';
      if (s.dots) {
        s.data.forEach(function (v, i) {
          out += '<circle cx="' + X(yrs[i]).toFixed(1) + '" cy="' + Y(v, s.axis).toFixed(1) + '" r="2" fill="' + s.color + '"/>';
        });
      }
    });

    // zero line if ranges straddle zero
    if (cfg.left.min < 0 && cfg.left.max > 0) {
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#33404f" stroke-width="1"/>';
    }

    out += '</svg>';
    return out;
  }

  /* ------------------------------------------------------------- histogram */
  function histChart(dds, currentDD) {
    var W = 700, H = 248;
    var m = { l: 40, r: 14, t: 14, b: 30 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var lo = -0.8, hi = 0.02, bins = 22;
    var counts = new Array(bins).fill(0);
    dds.forEach(function (d) {
      var v = clamp(d, lo, hi);
      var b = Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins));
      counts[b]++;
    });
    var maxC = Math.max.apply(null, counts) || 1;
    var bw = iw / bins;
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';

    niceTicks(0, maxC, 3).forEach(function (v) {
      var y = m.t + (1 - v / maxC) * ih;
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      out += '<text x="' + (m.l - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + Math.round(v) + '</text>';
    });

    counts.forEach(function (c, i) {
      var v0 = lo + i * (hi - lo) / bins;
      var x = m.l + i * bw;
      var hgt = c / maxC * ih;
      var sev = clamp(-v0 / 0.6, 0, 1);
      var col = sev > 0.55 ? C.red : sev > 0.28 ? C.amber : C.mint;
      if (c === 0) return;
      out += '<rect x="' + (x + 1).toFixed(1) + '" y="' + (m.t + ih - hgt).toFixed(1) + '" width="' + (bw - 2).toFixed(1) +
        '" height="' + hgt.toFixed(1) + '" rx="1.5" fill="' + col + '" opacity="0.75"/>';
    });

    // axis labels
    [-0.8, -0.6, -0.4, -0.2, 0].forEach(function (v) {
      var x = m.l + (v - lo) / (hi - lo) * iw;
      out += '<text x="' + x.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + Math.round(v * 100) + '%</text>';
    });

    function marker(v, col, label, dy) {
      var x = m.l + (clamp(v, lo, hi) - lo) / (hi - lo) * iw;
      out += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + (m.t + ih) + '" stroke="' + col + '" stroke-width="1.4" stroke-dasharray="3 3"/>';
      out += '<text x="' + (x + 4).toFixed(1) + '" y="' + (m.t + 10 + (dy || 0)) + '" fill="' + col + '" font-size="9.5" font-family="ui-monospace,monospace">' + label + '</text>';
    }
    var median = dds[Math.floor(dds.length / 2)];
    marker(median, C.blue, "median", 0);
    marker(currentDD, C.mint, "this run", 12);

    out += '</svg>';

    /* A bucket, not a year: the card reads the bar under the pointer. */
    var total = dds.length || 1;
    var model = {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xOf: function (i) { return m.l + (i + 0.5) * bw; },
      xIndex: function (vx) {
        var i = Math.floor((vx - m.l) / bw);
        return i < 0 || i >= bins ? null : i;
      },
      label: function (i) {
        function f(v) { var r = Math.round(v); return (r > 0 ? "+" : "") + r; }
        var a = (lo + i * (hi - lo) / bins) * 100;
        var b = (lo + (i + 1) * (hi - lo) / bins) * 100;
        return f(a) + "% to " + f(b) + "%";
      },
      rows: function (i) {
        var v0 = lo + i * (hi - lo) / bins;
        var sev = clamp(-v0 / 0.6, 0, 1);
        var col = sev > 0.55 ? C.red : sev > 0.28 ? C.amber : C.mint;
        var c = counts[i];
        return [
          { name: "runs in bucket", color: col, text: c.toLocaleString("en-US") },
          { name: "share of runs", color: col, text: (c / total * 100).toFixed(1) + "%" }
        ];
      }
    };
    return { html: out, model: model };
  }

  /* ------------------------------------------------------- threshold chart */
  function thresholdChart(r) {
    var W = 700, H = 300;
    var m = { l: 34, r: 12, t: 16, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var yrs = r.annual.years;
    var xMax = yrs[yrs.length - 1];
    function X(v) { return m.l + v / xMax * iw; }
    function Y(v) { return m.t + (1 - v) * ih; }

    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">';

    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
      var y = Y(v);
      out += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + C.line + '" stroke-dasharray="2 4"/>';
      out += '<text x="' + (m.l - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" fill="#5b6776" font-size="9" font-family="ui-monospace,monospace">' + v.toFixed(2) + '</text>';
    });
    yrs.forEach(function (yr, i) {
      if (i % 2 === 0) out += '<text x="' + X(yr).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" fill="#5b6776" font-size="9.5" font-family="ui-monospace,monospace">' + Math.round(2026 + yr) + '</text>';
    });

    // sector threshold lines, starting when the frontier clears them
    var labels = [];
    S.SECTORS.forEach(function (s) {
      var cross = r.crossYear[s.id];
      var startX = cross === undefined ? X(xMax) : X(cross);
      var cleared = cross !== undefined;
      out += '<line x1="' + startX.toFixed(1) + '" x2="' + X(xMax).toFixed(1) + '" y1="' + Y(s.threshold).toFixed(1) +
        '" y2="' + Y(s.threshold).toFixed(1) + '" stroke="' + s.color + '" stroke-width="2.2" opacity="' + (cleared ? 0.55 : 0.12) + '"/>';
      if (cleared) labels.push({ x: startX, y: Y(s.threshold), name: s.name.split(/[,&]/)[0].trim() });
    });

    // place labels without letting tight thresholds collide
    labels.sort(function (a, b) { return a.y - b.y; });
    var prevY = -99;
    labels.forEach(function (lb) {
      lb.ly = Math.max(lb.y - 3, prevY + 9.5);
      prevY = lb.ly;
      var lx = clamp(lb.x + 4, m.l + 2, W - m.r - 76);
      out += '<line x1="' + lb.x.toFixed(1) + '" x2="' + (lx - 2).toFixed(1) + '" y1="' + lb.y.toFixed(1) + '" y2="' + (lb.ly + 2.5).toFixed(1) + '" stroke="#2b3746" stroke-width="0.8"/>';
      out += '<text x="' + lx.toFixed(1) + '" y="' + lb.ly.toFixed(1) + '" fill="#93a2b3" font-size="8.5" font-family="' + "-apple-system,system-ui,sans-serif" + '">' + lb.name + '</text>';
    });

    // capability curve on top
    var d = "";
    r.annual.cap.forEach(function (v, i) {
      d += (i ? "L" : "M") + X(yrs[i]).toFixed(1) + " " + Y(v).toFixed(1);
    });
    out += '<path d="' + d + '" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round" opacity="0.9"/>';
    r.annual.cap.forEach(function (v, i) {
      if (i % 2 === 0) out += '<circle cx="' + X(yrs[i]).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="2.4" fill="#ffffff"/>';
    });

    out += '<text x="' + (W - m.r - 4) + '" y="' + Y(r.annual.cap[r.annual.cap.length - 1]) + '" text-anchor="end" fill="#fff" font-size="9" font-family="ui-monospace,monospace" dy="-7">capability</text>';
    out += '</svg>';

    /* Two questions this chart invites: what is capability that year, and which
       sector's threshold is under the pointer? Answer both, and say when that
       sector crossed. */
    var model = {
      W: W, H: H, top: m.t, bottom: m.t + ih,
      xOf: function (i) { return X(yrs[i]); },
      xIndex: function (vx) {
        return HOV.nearest(yrs, (vx - m.l) / iw * xMax);
      },
      label: function (i) { return String(2026 + Math.round(yrs[i])); },
      rows: function (i, vx, vy) {
        var at = 1 - (vy - m.t) / ih;
        var best = null, bd = Infinity;
        S.SECTORS.forEach(function (s) {
          var d = Math.abs(s.threshold - at);
          if (d < bd) { bd = d; best = s; }
        });
        var cross = best ? r.crossYear[best.id] : undefined;
        var rows = [{ name: "capability index", color: C.mint, text: r.annual.cap[i].toFixed(2) }];
        if (best) {
          rows.push({
            name: best.name.split(/[,&]/)[0].trim() + " threshold",
            color: best.color,
            text: best.threshold.toFixed(2)
          });
          rows.push({
            name: "crossed",
            color: best.color,
            text: cross === undefined ? "after " + (2026 + Math.round(xMax)) : String(2026 + Math.round(cross))
          });
        }
        return rows;
      }
    };
    return { html: out, model: model };
  }

  /* ------------------------------------------------------------------ levers */
  var leverIndex = {};
  function buildLevers() {
    var host = document.getElementById("leverGroups");
    host.innerHTML = "";
    S.LEVER_GROUPS.forEach(function (g, gi) {
      var det = document.createElement("details");
      det.className = "lgroup";
      /* Closed by default: the summary is the affordance, and opening one is
         cheap. An open-by-default column fills the sidebar before you have
         read any of it. */
      det.innerHTML = "<summary>" + g.title + '<i class="caret" aria-hidden="true"></i>' + "</summary><p class='blurb'>" + g.blurb + "</p>";

      g.levers.forEach(function (lv) {
        leverIndex[lv.key] = lv;
        var wrap = el("div", "lever");
        var top = el("div", "lever-top");
        top.appendChild(el("span", "lever-name", lv.label));
        var val = el("span", "lever-val", fmtLever(lv, state[lv.key]));
        val.id = "val-" + lv.key;
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
          markCustomPreset();
          update();
        });
        wrap.appendChild(input);
        det.appendChild(wrap);
      });
      host.appendChild(det);
    });
  }

  function syncLeverInputs() {
    S.LEVER_GROUPS.forEach(function (g) {
      g.levers.forEach(function (lv) {
        var input = document.querySelector('input[aria-label="' + lv.label.replace(/"/g, '\\"') + '"]');
        if (input) input.value = state[lv.key];
        var v = document.getElementById("val-" + lv.key);
        if (v) v.textContent = fmtLever(lv, state[lv.key]);
      });
    });
  }

  /* ----------------------------------------------------------------- presets */
  var activePreset = "base";
  function buildPresets() {
    var host = document.getElementById("presets");
    host.innerHTML = "";
    S.PRESETS.forEach(function (p) {
      var b = el("button", "preset" + (p.id === activePreset ? " active" : ""), p.name);
      b.type = "button";
      b.title = p.blurb;
      b.dataset.id = p.id;
      b.addEventListener("click", function () {
        applyPreset(p);
      });
      host.appendChild(b);
    });
  }
  function applyPreset(p) {
    for (var k in S.DEFAULTS) state[k] = S.DEFAULTS[k];
    for (var k2 in p.patch) state[k2] = p.patch[k2];
    activePreset = p.id;
    document.querySelectorAll(".preset").forEach(function (b) {
      b.classList.toggle("active", b.dataset.id === p.id);
    });
    syncLeverInputs();
    update();
  }
  function markCustomPreset() {
    if (activePreset === "custom") return;
    activePreset = "custom";
    document.querySelectorAll(".preset").forEach(function (b) { b.classList.remove("active"); });
  }

  /* -------------------------------------------------------------------- KPIs */
  function renderKpis(r, m) {
    var host = document.getElementById("kpis");
    host.innerHTML = "";
    var f = r.final;
    var crashRisk = m ? m.pCrash35 : null;

    function tile(label, value, cls, note, hero) {
      var d = el("div", "kpi" + (hero ? " hero" : ""));
      d.appendChild(el("div", "klabel", label));
      d.appendChild(el("div", "kval " + (cls || ""), value));
      if (note) d.appendChild(el("div", "knote", note));
      host.appendChild(d);
    }

    if (crashRisk !== null) {
      var riskCls = crashRisk > 0.6 ? "bad" : crashRisk > 0.3 ? "warn" : "good";
      var riskWord = crashRisk > 0.6 ? "Severe" : crashRisk > 0.3 ? "Material" : "Contained";
      tile("Crash risk &mdash; 35%+ drawdown", pct0(crashRisk), riskCls,
        riskWord + " &middot; median " + signedPct(m.medianDD) + " over " + m.runs + " paths", true);
    } else {
      tile("Crash risk", "&mdash;", "neutral", "sampling&hellip;", true);
    }

    tile("Peak drawdown", signedPct(f.maxDD), f.maxDD < -0.35 ? "bad" : f.maxDD < -0.18 ? "warn" : "good",
      f.crashMonth >= 0 ? "crosses &minus;20% in " + Math.round(2026 + f.crashMonth / 12) : "no 20% breach");

    tile("Peak unemployment", pct1(f.peakUnemp), f.peakUnemp > 0.15 ? "bad" : f.peakUnemp > 0.09 ? "warn" : "good",
      "from 4.2% &middot; " + (m ? "median " + pct1(m.medianPeakUnemp) : "&nbsp;"));

    tile("Labour share of GDP", pct1(f.laborShare),
      f.laborShare < 0.36 ? "bad" : f.laborShare < 0.42 ? "warn" : "neutral",
      signedPct(f.laborShare - f.laborShare0) + " vs today");

    tile("Equity index", f.index.toFixed(0),
      f.index < 70 ? "bad" : f.index < 100 ? "warn" : "good",
      signedPct(f.index / 100 - 1) + " over " + HORIZON + " years");

    tile("Unit cost of code", big(f.codeCost) + "&times;", "neutral",
      "cheaper over " + HORIZON + " years");
  }

  /* ----------------------------------------------------------------- verdict */
  function renderVerdict(r, m) {
    var host = document.getElementById("verdict");
    var f = r.final;
    var ann = r.annual;
    var lines = [];

    var endCap = ann.cap[ann.cap.length - 1];
    var autoEnd = f.autoFrac;
    var unempEnd = f.unemp;
    var cpiMin = Math.min.apply(null, ann.cpi);
    var marginRise = f.margin - f.margin0;

    /* --- headline judgement --- */
    var severity = f.maxDD < -0.45 ? "red" : f.maxDD < -0.2 ? "amber" : "green";
    var sevWord = f.maxDD < -0.45 ? "a systemic repricing" : f.maxDD < -0.2 ? "a genuine bear market" : "a correction, not a crash";
    var head = "<span class='tag " + severity + "'>" + (m ? pct0(m.pCrash35) + " severe-crash odds" : "&nbsp;") + "</span>" +
      "On these settings the model produces <strong>" + sevWord + "</strong>: " +
      "peak drawdown <strong>" + signedPct(f.maxDD) + "</strong>, " +
      "unemployment reaching <strong>" + pct1(f.peakUnemp) + "</strong>, " +
      "and the index at <strong>" + f.index.toFixed(0) + "</strong> of today in " + HORIZON + " years " +
      "(earnings power &times; multiple).";
    lines.push(head);

    /* --- which channel dominates --- */
    var demandDrag = f.peakUnemp - 0.042;
    var defl = Math.max(0, -cpiMin);
    var dominant = "";
    if (state.pricePassThrough > 0.55 && state.elasticityMult < 0.85) {
      dominant = "<strong>Deflation is doing the damage.</strong> Productivity is being passed into prices faster than cheaper output can expand demand. Nominal revenue shrinks even as unit costs fall, so the margin story never arrives — profit falls on both blades at once. This is the configuration where cheap code is genuinely bearish rather than merely disruptive.";
    } else if (f.peakUnemp > 0.16) {
      dominant = "<strong>Demand destruction is doing the damage.</strong> Automation removes wage income faster than it creates ownership income. Since wages are the consumer's budget, revenue falls across sectors, which justifies further automation, which removes more wage income. The loop is bounded only by wage flexibility, automatic stabilisers and the transfer system — and those are the levers worth pulling.";
    } else if (marginRise > 0.02 && f.peakUnemp > 0.08) {
      dominant = "<strong>This is a distribution story, not an output story.</strong> Output holds up and margins expand while labour's share of GDP falls. Capital wins and labour loses. That is bullish for the index in the near term and unstable in the longer term, because the ultimate customer base is wage income.";
    } else if (f.maxDD > -0.2) {
      dominant = "<strong>The economy absorbs it.</strong> At these settings cheap output expands demand enough — and the displaced workers are reabsorbed fast enough — that earnings growth offsets the multiple compression. Nothing here says this is the likely path; it says this is the configuration required for markets to shrug it off.";
    } else {
      dominant = "<strong>The pressure is balanced.</strong> Margin expansion and demand destruction are roughly cancelling, so the index tracks the labour market rather than leading it.";
    }
    lines.push(dominant);

    /* --- the adoption gap --- */
    var literacy = state.literacy;
    var gap = "<strong>Frontier versus floor.</strong> Capability reaches <strong>" + endCap.toFixed(2) +
      "</strong> by " + (2026 + HORIZON) + " while the share of the workforce that can actually operate agentic automation sits at <strong>" +
      pct0(literacy) + "</strong>. " + pct0(autoEnd) + " of task content is automated by the end of the horizon";
    if (literacy > 0.8) {
      gap += " — and because almost everyone has learned the tooling, the shock arrives compressed into a few years rather than spread over a decade. Compression, not magnitude, is what breaks the demand side: the labour market can reabsorb a slow trickle and cannot reabsorb a wall.";
    } else if (literacy < 0.2) {
      gap += " — held back less by the models than by the fact that most firms and most workers never learn to operate them. This is the single most under-modelled variable in the public debate: a capability curve that runs years ahead of the deployment curve is not a labour-market event, it is a slow repricing.";
    } else {
      gap += ". Adoption is the binding constraint here, and it is also the thing that determines whether the shock is a trickle or a wall.";
    }
    lines.push(gap);

    /* --- what has to be true --- */
    var needed = [];
    if (f.maxDD < -0.2) {
      needed.push("If gains were recycled to households faster (transfers or broad ownership), the demand side would hold");
      if (state.pricePassThrough > 0.5) needed.push("if less of the productivity gain were competed into prices, nominal revenue would stop shrinking");
      if (state.elasticityMult < 1.1) needed.push("if final demand for cheap output were more elastic, volume would absorb the price fall");
    } else {
      needed.push("The benign result depends on reabsorption staying near " + pct0(state.reabsorption) + " of displaced workers per year");
      needed.push("and on demand for cheap output staying elastic enough (currently " + state.elasticityMult.toFixed(2) + "&times;) to absorb the price fall");
    }
    var reverse = "<span class='tag'>what has to be true</span>" + needed.join("; ") + ".";
    lines.push(reverse);

    host.innerHTML = "<h2>Reading the result</h2>" + lines.map(function (l) { return "<p>" + l + "</p>"; }).join("");
  }

  /* ------------------------------------------------------------------ charts */
  function renderCharts(r) {
    var ann = r.annual;
    var yrs = ann.years;

    /* --- equity index + drawdown --- */
    var idxMax = Math.max(110, Math.max.apply(null, ann.index) * 1.08);
    var ddMin = Math.min(-0.6, Math.min.apply(null, ann.drawdown) * 1.15);
    var cIndex = {
      years: yrs,
      left: { min: 0, max: idxMax, fmt: function (v) { return Math.round(v); } },
      right: { min: ddMin, max: 0, fmt: function (v) { return Math.round(v * 100) + "%"; } },
      series: [
        { name: "Drawdown from peak", data: ann.drawdown, color: C.red, axis: "right", fill: true, baseline: 0, fillOpacity: 0.14, width: 1.4 },
        { name: "Equity index", data: ann.index, color: C.mint, axis: "left", width: 2.2, fill: true, baseline: 0, fillOpacity: 0.06 }
      ]
    };
    withHover("chartIndex", cIndex, lineChart(cIndex) +
      legend([["Equity index (left)", C.mint], ["Drawdown from peak (right)", C.red]]), yrs);

    /* --- labour market --- */
    var uMax = Math.max(0.12, Math.max.apply(null, ann.unemp) * 1.15);
    var lsMin = Math.min(0.25, Math.min.apply(null, ann.laborShare) * 0.85);
    var lsMax = Math.max(0.5, Math.max.apply(null, ann.laborShare) * 1.06);
    var cLabour = {
      years: yrs,
      left: { min: 0, max: uMax, fmt: function (v) { return Math.round(v * 100) + "%"; } },
      right: { min: lsMin, max: lsMax, fmt: function (v) { return Math.round(v * 100) + "%"; } },
      series: [
        { name: "Labour share of GDP", data: ann.laborShare, color: C.amber, axis: "right", width: 1.8, dash: true },
        { name: "Unemployment", data: ann.unemp, color: C.red, axis: "left", width: 2.2, fill: true, baseline: 0, fillOpacity: 0.1 }
      ]
    };
    withHover("chartLabour", cLabour, lineChart(cLabour) +
      legend([["Unemployment (left)", C.red], ["Labour share of GDP (right)", C.amber, true]]), yrs);

    /* --- macro --- */
    var gMax = Math.max.apply(null, ann.gdp) * 1.06;
    var gMin = Math.min.apply(null, ann.gdp) * 0.94;
    var capexMax = Math.max.apply(null, ann.capex) * 1.2 || 1;
    var cMacro = {
      years: yrs,
      left: { min: gMin, max: gMax, fmt: function (v) { return "$" + (v / 1000).toFixed(0) + "T"; } },
      right: { min: 0, max: capexMax, fmt: function (v) { return "$" + Math.round(v) + "B"; } },
      series: [
        { name: "AI capex", data: ann.capex, color: C.violet, axis: "right", width: 1.5, dash: true },
        { name: "Consumption", data: ann.consumption, color: C.blue, axis: "left", width: 1.7 },
        { name: "GDP", data: ann.gdp, color: C.mint, axis: "left", width: 2.2 }
      ]
    };
    withHover("chartMacro", cMacro, lineChart(cMacro) +
      legend([["GDP (left)", C.mint], ["Consumption (left)", C.blue], ["AI capex (right)", C.violet, true]]), yrs);

    /* --- threshold ladder --- */
    var th = thresholdChart(r);
    var hTh = document.getElementById("chartThreshold");
    hTh.innerHTML = th.html +
      "<div class='legend'><span style='color:#93a2b3'>Bright bar = sector is inside the frontier from that year. White line = capability index.</span></div>";
    if (window.HOV && th.model) HOV.bind(hTh, th.model);

    /* --- histogram (may be stale until MC lands) --- */
    var curDD = r.final.maxDD;
    if (mc) {
      var hs = histChart(mc.dds, curDD);
      var hHist = document.getElementById("chartHist");
      hHist.innerHTML = hs.html +
        legend([["P(20%+ drawdown) " + pct0(mc.pCrash20), C.amber], ["P(35%+) " + pct0(mc.pCrash35), C.red], ["median " + signedPct(mc.medianDD), C.blue]]);
      if (window.HOV && hs.model) HOV.bind(hHist, hs.model);
    }
  }

  /* Draw a line chart and attach its card in one place, so the three call
     sites cannot drift apart on which cfg was rendered where. */
  function withHover(id, cfg, html, yrs) {
    var host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = html;
    if (!window.HOV || !cfg.__geom) return;
    HOV.bind(host, HOV.linear(cfg, cfg.__geom, {
      label: function (i) { return String(2026 + Math.round(yrs[i])); }
    }));
  }

  function legend(items) {
    return "<div class='legend'>" + items.map(function (it) {
      return "<span style='color:" + it[1] + "'><i style='background:" + it[1] + "'" + (it[2] ? " class='dashed'" : "") + "></i>" +
        "<span style='color:#7e8d9e'>" + it[0] + "</span></span>";
    }).join("") + "</div>";
  }

  /* ------------------------------------------------------------- sector table */
  function renderSectors(r) {
    var host = document.getElementById("sectorTable");
    // snapshots are taken every 3 months, so 4 slots per simulated year
    var slot = clamp(Math.round(focusYear * 4), 0, r.sectorEmpYear.length - 1);
    var empNow = r.sectorEmpYear[slot];
    var autoNow = r.sectorAutoYear[slot];
    var emp0 = r.emp0BySector;

    var rows = S.SECTORS.map(function (s, i) {
      return {
        s: s,
        change: empNow[i] / emp0[i] - 1,
        auto: autoNow[i],
        jobs: empNow[i]
      };
    }).sort(function (a, b) { return a.change - b.change; });

    var html = "<div class='srow head'><span>Sector</span><span>Employment change</span><span class='sval'>Jobs</span><span class='sauto'>Automated</span></div>";
    rows.forEach(function (row) {
      var loss = -row.change;
      var w = clamp(loss / 0.55, 0, 1) * 100;
      var col = loss > 0.3 ? C.red : loss > 0.12 ? C.amber : loss > 0.02 ? "#8fb3d9" : C.mint;
      html += "<div class='srow'>" +
        "<span class='sname'>" + row.s.name + "</span>" +
        "<span class='strack'>" +
        "<span class='sbar' style='left:0;width:" + w.toFixed(1) + "%;background:" + col + ";opacity:.55'></span>" +
        "<span class='sfill' style='left:" + w.toFixed(1) + "%;width:" + (100 - w).toFixed(1) + "%'></span>" +
        "</span>" +
        "<span class='sval' style='color:" + col + "'>" + signedPct(row.change) + "</span>" +
        "<span class='sauto'><span class='sauto-bar' style='width:" + Math.round(row.auto * 22) + "px'></span>" + pct0(row.auto) + "</span>" +
        "</div>";
    });
    host.innerHTML = html;
    document.getElementById("focusYearOut").textContent = String(2026 + Math.round(focusYear));
  }

  /* ------------------------------------------------------------ calibration */
  function provChip(status) {
    var cls = status === "measured" ? "ok" : status === "derived" ? "derv" : "ass";
    return "<span class='prov " + cls + "'>" + status + "</span>";
  }

  function delta(now, was, fmt) {
    if (was === undefined || was === null) return "";
    if (Math.abs(now - was) < 1e-9) return "";
    return "<span class='was'>was " + fmt(was) + "</span>";
  }

  function renderCalibration() {
    var host = document.getElementById("calibBody");
    var stamp = document.getElementById("calibStamp");
    if (!host) return;
    var C = S.CALIBRATION;
    if (!C) {
      stamp.innerHTML = "";
      host.innerHTML = "<p class='muted'>No <code>calibration.js</code> present, so the dashboard is " +
        "running on its original hand-set numbers. Run <code>node ingest.mjs</code> to fetch the measured ones.</p>";
      return;
    }

    var gen = new Date(C.meta.generated);
    stamp.innerHTML = "<span class='stamp-label'>data as of</span>" +
      "<strong>" + gen.toISOString().slice(0, 10) + "</strong>";

    var foot = document.getElementById("footBaseline");
    if (foot) {
      foot.textContent = "Baseline: $" + (C.baseline.gdp / 1000).toFixed(1) + "T GDP, " +
        C.baseline.lf.toFixed(1) + "M labour force, " + (C.baseline.unrate * 100).toFixed(1) +
        "% unemployment — FRED/BEA, ingested " + gen.toISOString().slice(0, 10) + ".";
    }

    var src = Object.keys(C.sources).map(function (k) {
      var s = C.sources[k];
      return "<div class='src'><strong>" + s.name + "</strong>" +
        "<span class='src-vintage'>" + (s.vintage || "") + "</span>" +
        "<a href='" + s.url + "' target='_blank' rel='noopener'>source</a></div>";
    }).join("");

    var chk = C.checks.map(function (c) {
      return "<div class='check " + c.status + "'>" +
        "<span class='cval'>" + c.value + "</span>" +
        "<span class='clabel'>" + c.label + "</span>" +
        "<span class='cdetail'>" + c.detail + "</span></div>";
    }).join("");

    var head = "<tr><th>Sector</th><th>Jobs (M)</th><th>Wage ($k)</th><th>VA share</th>" +
      "<th>Exposure</th><th>Threshold</th><th>Ceiling</th></tr>";
    var body = S.SECTORS.map(function (s) {
      var p = s.prior || {};
      var pc = function (v) { return (v * 100).toFixed(1) + "%"; };
      return "<tr>" +
        "<td class='cname'><span class='dot' style='background:" + s.color + "'></span>" + s.name + "</td>" +
        "<td>" + s.emp.toFixed(1) + delta(s.emp, p.emp, function (v) { return v.toFixed(1); }) + "</td>" +
        "<td>" + s.wage.toFixed(0) + delta(s.wage, p.wage, function (v) { return v.toFixed(0); }) + "</td>" +
        "<td>" + pc(s.revShare) + delta(s.revShare, p.revShare, pc) + "</td>" +
        "<td>" + s.exposure.toFixed(2) + delta(s.exposure, p.exposure, function (v) { return v.toFixed(2); }) + "</td>" +
        "<td>" + s.threshold.toFixed(2) + delta(s.threshold, p.threshold, function (v) { return v.toFixed(2); }) + "</td>" +
        "<td>" + s.ceiling.toFixed(2) + delta(s.ceiling, p.ceiling, function (v) { return v.toFixed(2); }) + "</td>" +
        "</tr>";
    }).join("");

    var prov = Object.keys(C.provenance).map(function (k) {
      var p = C.provenance[k];
      return "<div class='provrow'>" + provChip(p.status) + "<code>" + k + "</code>" +
        "<span class='pdetail'>" + p.detail + "</span></div>";
    }).join("");

    host.innerHTML =
      "<div class='calib-sources'>" + src + "</div>" +
      "<h3>Reconciliation checks</h3>" +
      "<p class='muted'>These are tests that the ingested data is internally consistent and that " +
        "the model's baseline still adds up. A failing check is a bug, not a judgement call.</p>" +
      "<div class='checks'>" + chk + "</div>" +
      "<h3>What moved</h3>" +
      "<p class='muted'>Six parameters per sector now come from measurement rather than intuition. " +
        "The previous hand-set value is shown wherever it changed.</p>" +
      "<div class='calib-scroll'><table class='calib-table'><thead>" + head + "</thead><tbody>" + body + "</tbody></table></div>" +
      "<h3>Provenance by parameter</h3>" +
      "<div class='provlist'>" + prov + "</div>";
  }

  /* ------------------------------------------------------------------ update */
  function update() {
    HORIZON = Math.round(state.horizonYears);
    result = S.simulate(state);
    renderKpis(result, mc);
    renderVerdict(result, mc);
    renderCharts(result);
    renderSectors(result);

    clearTimeout(mcTimer);
    mcTimer = setTimeout(function () {
      mc = S.monteCarlo(state, 180);
      renderKpis(result, mc);
      renderVerdict(result, mc);
      renderCharts(result);
    }, 140);
  }

  /* -------------------------------------------------------------------- init */
  function init() {
    buildLevers();
    buildPresets();
    renderCalibration();

    var fy = document.getElementById("focusYear");
    fy.max = String(Math.round(state.horizonYears));
    fy.value = String(focusYear);
    fy.addEventListener("input", function () {
      focusYear = parseInt(fy.value, 10);
      if (result) renderSectors(result);
    });

    document.getElementById("reset").addEventListener("click", function () {
      var base = S.PRESETS[0];
      applyPreset(base);
    });

    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
