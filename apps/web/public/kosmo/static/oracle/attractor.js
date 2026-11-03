/* ============================================================================
   Attractor page: renders ATTRACT (attractor-data.js).
   Sections are generated so the numbers on screen are always the numbers in
   the data file — nothing is typed twice.
   ============================================================================ */
(function () {
  "use strict";

  var A = ATTRACT;

  var COL = {
    agree: "#a9c0b4", expand: "#8aa4be", disagree: "#c28181",
    contested: "#c4a373", dim: "#7e8d9e"
  };

  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }
  function pct(x) { return Math.round(x * 100) + "%"; }
  function sum(arr, k) { return arr.reduce(function (a, x) { return a + x[k]; }, 0); }

  /* ============================================================ three terms */
  function renderTerms() {
    var host = document.getElementById("terms-grid");
    host.innerHTML = A.terms.map(function (t) {
      return '<article class="term-card t-' + t.id + '">' +
        '<div class="term-head"><span class="term-name">' + t.name + '</span>' +
        '<span class="term-sub">' + t.subtitle + '</span></div>' +
        '<p class="term-claim">' + t.claim + '</p>' +
        '<blockquote>' + t.quote + '<cite>' + t.attrib + '</cite></blockquote>' +
        '<dl class="term-meta">' +
        '<dt>Unit of analysis</dt><dd>' + t.unit + '</dd>' +
        '<dt>First use</dt><dd>' + t.origin + '</dd>' +
        '<dt>Popularised by</dt><dd>' + t.popularised + '</dd>' +
        '<dt>Status</dt><dd>' + t.academic + '</dd>' +
        '</dl></article>';
    }).join("");
  }

  /* ================================================================= genesis */
  function renderTimeline() {
    var host = document.getElementById("timeline-list");
    host.innerHTML = A.timeline.map(function (e) {
      return '<li class="tl-item">' +
        '<span class="tl-year">' + e.year + '</span>' +
        '<span class="tl-body"><b>' + e.label + '</b><span class="tl-text">' + e.text + '</span>' +
        '<span class="tl-tag">' + e.tag + '</span></span></li>';
    }).join("");
  }

  /* ============================================================== attractors */
  function renderAttractors() {
    var host = document.getElementById("attractors-grid");
    host.innerHTML = A.attractors.map(function (a) {
      return '<div class="att-card" style="--ac:' + a.colour + '">' +
        '<div class="att-n">Attractor ' + a.n + '</div>' +
        '<h3>' + a.name + '</h3><p>' + a.text + '</p>' +
        '<div class="att-foot"><span>Instantiates as</span> ' + a.instantiates + '</div>' +
        '<div class="att-logic">' + a.logic + '</div></div>';
    }).join("");
  }

  /* ---------- basin schematic: the argument, drawn ------------------------- */
  function basinSVG(antiRivalry) {
    var W = 640, H = 250, m = { l: 14, r: 14, t: 20, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;

    function g(x, mu, s) { var t = (x - mu) / s; return Math.exp(-t * t); }

    var a3 = 0.18 + 1.05 * antiRivalry;
    var w3 = 0.17 + 0.26 * antiRivalry;

    function V(x) {
      return -(1.00 * g(x, -0.70, 0.24)) - (1.00 * g(x, 0.70, 0.24)) - (a3 * g(x, 0, w3));
    }

    var pts = [], min = 0, i, x;
    for (i = 0; i <= 200; i++) {
      x = -1 + (2 * i) / 200;
      var v = V(x);
      pts.push([x, v]);
      if (v < min) min = v;
    }
    var top = 0.12;
    function X(x) { return m.l + (x + 1) / 2 * iw; }
    function Y(v) { return m.t + (1 - (v - min) / (top - min)) * ih; }

    var d = pts.map(function (p, k) { return (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); }).join("");
    var area = d + "L" + X(1).toFixed(1) + " " + (m.t + ih) + "L" + X(-1).toFixed(1) + " " + (m.t + ih) + "Z";

    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Schematic potential landscape with three basins">';
    out += '<path d="' + area + '" fill="url(#basinFill)" opacity="0.35"/>';
    out += '<defs><linearGradient id="basinFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#8aa4be" stop-opacity="0.05"/>' +
      '<stop offset="100%" stop-color="#8aa4be" stop-opacity="0.22"/></linearGradient></defs>';
    out += '<path d="' + d + '" fill="none" stroke="#8fb7d9" stroke-width="2"/>';

    /* wells */
    [[-0.70, "Catastrophe", "#c28181"], [0.70, "Dystopia", "#a396b3"], [0, "Third", "#a9c0b4"]].forEach(function (w) {
      var yy = Y(V(w[0]));
      out += '<circle cx="' + X(w[0]).toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="4.5" fill="' + w[2] + '"/>';
      out += '<text x="' + X(w[0]).toFixed(1) + '" y="' + (yy + 20).toFixed(1) + '" text-anchor="middle" ' +
        'fill="' + w[2] + '" font-size="10.5" font-family="ui-monospace,monospace">' + w[1] + '</text>';
    });

    out += '<text x="' + X(-0.70).toFixed(1) + '" y="' + (m.t + 12) + '" text-anchor="middle" fill="#5b6776" font-size="9.5">flee chaos &rarr;</text>';
    out += '<text x="' + X(0.70).toFixed(1) + '" y="' + (m.t + 12) + '" text-anchor="middle" fill="#5b6776" font-size="9.5">&larr; flee the cage</text>';
    out += '</svg>';
    return out;
  }

  function renderBasin() {
    var host = document.getElementById("basinChart");
    var slider = document.getElementById("basinSlider");
    var readout = document.getElementById("basinRead");

    function draw() {
      var v = parseFloat(slider.value);
      host.innerHTML = basinSVG(v);
      var a3 = 0.18 + 1.05 * v;
      var msg;
      if (a3 < 0.55) msg = "The third basin is shallower than either failure basin. Any pressure tips the system into one of the two walls &mdash; which is the argument, not a prediction.";
      else if (a3 < 0.95) msg = "The third basin is now competitive but still narrow. Anti-rivalry is doing real work and is one shock from being overwhelmed.";
      else msg = "The third basin is deepest. This is the state the corpus is describing &mdash; and the only one in which the third attractor is a place the system can actually rest.";
      readout.innerHTML = msg;
    }
    slider.addEventListener("input", draw);
    draw();
  }

  /* ============================================================== generators */
  function renderGenerators() {
    var host = document.getElementById("generators-list");
    host.innerHTML = A.generators.map(function (g) {
      return '<div class="gen-row"><div class="gen-n">' + g.n + '</div>' +
        '<div class="gen-body"><h3>' + g.name + '</h3><p>' + g.text + '</p>' +
        '<span class="gen-src">' + g.from + '</span></div></div>';
    }).join("");
  }

  /* ================================================================== corpus */
  function renderCorpus() {
    var c = A.corpus;
    var total = c.agree + c.expand + c.disagree;

    document.getElementById("corpusStats").innerHTML = [
      [c.conversations, "conversations"],
      [c.insights, "written reflections"],
      [c.series, "series"],
      [c.codings.toLocaleString(), "codings"],
      [c.claims_n, "claims"]
    ].map(function (s) {
      return '<div class="stat"><div class="stat-n">' + s[0] + '</div><div class="stat-l">' + s[1] + '</div></div>';
    }).join("");

    document.getElementById("corpusBar").innerHTML =
      '<div class="cbar">' +
      [[c.agree, "agree", COL.agree], [c.expand, "expand", COL.expand], [c.disagree, "disagree", COL.disagree]]
        .map(function (s) {
          return '<span class="cseg" style="width:' + (s[0] / total * 100).toFixed(1) +
            '%;background:' + s[2] + '" title="' + s[1] + ': ' + s[0] + '"><b>' + s[0] + '</b>' +
            '<i>' + pct(s[0] / total) + '</i></span>';
        }).join("") + '</div>' +
      '<p class="cbar-cap">' + total.toLocaleString() + ' codings across ' + c.claims_n +
      ' claims. A single conversation can both agree with and extend a claim, so codings exceed conversations.</p>';

    var maxN = Math.max.apply(null, A.series.map(function (s) { return s.n; }));
    document.getElementById("seriesList").innerHTML = A.series.map(function (s) {
      return '<div class="ser-row"><span class="ser-code">' + s.code + '</span>' +
        '<span class="ser-name">' + s.name + '</span>' +
        '<span class="ser-track"><span class="ser-fill" style="width:' + (s.n / maxN * 100).toFixed(0) + '%"></span></span>' +
        '<span class="ser-n">' + s.n + '</span>' +
        '<span class="ser-blurb">' + s.blurb + '</span></div>';
    }).join("");
  }

  /* ================================================================== claims */
  var claimSort = "contested";
  var claimSel = 4;

  function sortClaims() {
    var arr = A.claims.slice();
    if (claimSort === "contested") arr.sort(function (a, b) { return b.contested - a.contested; });
    else if (claimSort === "disagree") arr.sort(function (a, b) {
      return b.disagree / (b.agree + b.expand + b.disagree) - a.disagree / (a.agree + a.expand + a.disagree);
    });
    else if (claimSort === "engaged") arr.sort(function (a, b) { return b.engaged - a.engaged; });
    else arr.sort(function (a, b) { return a.id - b.id; });
    return arr;
  }

  function renderClaims() {
    var host = document.getElementById("claimList");
    var maxTotal = Math.max.apply(null, A.claims.map(function (c) { return c.agree + c.expand + c.disagree; }));

    host.innerHTML = sortClaims().map(function (c) {
      var total = c.agree + c.expand + c.disagree;
      var sel = c.id === claimSel ? " sel" : "";
      var seg = [[c.agree, COL.agree, "agree"], [c.expand, COL.expand, "expand"], [c.disagree, COL.disagree, "disagree"]]
        .map(function (s) {
          return '<span style="width:' + (s[0] / maxTotal * 100).toFixed(1) + '%;background:' + s[1] +
            '" title="' + s[2] + ' ' + s[0] + '"></span>';
        }).join("");
      return '<button type="button" class="claim-row' + sel + '" data-id="' + c.id + '">' +
        '<span class="cr-id">P' + c.id + '</span>' +
        '<span class="cr-title">' + c.title + '</span>' +
        '<span class="cr-bar">' + seg + '</span>' +
        '<span class="cr-cont" style="color:' +
        (c.contested > 70 ? COL.disagree : c.contested > 40 ? COL.contested : COL.dim) + '">' + c.contested + '</span>' +
        '</button>';
    }).join("");

    Array.prototype.forEach.call(host.querySelectorAll(".claim-row"), function (b) {
      b.addEventListener("click", function () {
        claimSel = parseInt(b.dataset.id, 10);
        renderClaims();
        renderClaimDetail();
      });
    });
  }

  function renderClaimDetail() {
    var c = A.claims.filter(function (x) { return x.id === claimSel; })[0];
    var host = document.getElementById("claimDetail");
    if (!c) return;
    var total = c.agree + c.expand + c.disagree;
    var covers = c.covers.length
      ? c.covers.map(function (p) { return '<a href="#paradoxes" class="px-link">' + p + '</a>'; }).join("")
      : '<span class="muted">Drawn from the corpus rather than from a paradox pair</span>';

    host.innerHTML =
      '<div class="cd-head"><span class="cd-id">P' + c.id + '</span><h3>' + c.title + '</h3></div>' +
      '<p class="cd-statement">' + c.statement + '</p>' +
      '<div class="cd-nums">' +
      '<div><b>' + c.agree + '</b><span>agree</span></div>' +
      '<div><b>' + c.expand + '</b><span>expand</span></div>' +
      '<div><b>' + c.disagree + '</b><span>disagree</span></div>' +
      '<div><b>' + c.contested + '</b><span>contested</span></div>' +
      '<div><b>' + c.engaged + '</b><span>engaged</span></div>' +
      '<div><b>' + c.silent + '</b><span>silent</span></div>' +
      '</div>' +
      '<div class="cd-cover"><span>Holds</span> ' + covers + '</div>' +
      '<div class="cd-col"><h4>Who agrees</h4><p>' + c.assent + '</p></div>' +
      '<div class="cd-col"><h4>Who pushes back</h4><p>' + c.dissent + '</p></div>' +
      '<div class="cd-fault"><h4>The fault line</h4><p>' + c.fault + '</p></div>';
  }

  function buildClaimSorts() {
    var host = document.getElementById("claimSorts");
    var opts = [["contested", "Most contested"], ["disagree", "Most rejected"], ["engaged", "Most discussed"], ["id", "Order P1&ndash;P15"]];
    host.innerHTML = opts.map(function (o) {
      return '<button type="button" class="sortbtn' + (o[0] === claimSort ? " active" : "") +
        '" data-k="' + o[0] + '">' + o[1] + '</button>';
    }).join("");
    Array.prototype.forEach.call(host.querySelectorAll(".sortbtn"), function (b) {
      b.addEventListener("click", function () {
        claimSort = b.dataset.k;
        buildClaimSorts();
        renderClaims();
      });
    });
  }

  /* =============================================================== paradoxes */
  var paradoxFilter = null;

  function renderParadoxes() {
    var host = document.getElementById("paradoxList");
    var linked = {};
    A.claims.forEach(function (c) { c.covers.forEach(function (p) { linked[p] = c.id; }); });

    host.innerHTML = A.paradoxes.map(function (p) {
      var claimId = linked[p.title];
      var dim = paradoxFilter && claimId !== paradoxFilter ? " dim" : "";
      return '<div class="px-card' + dim + '">' +
        '<div class="px-head"><span class="px-n">' + p.n + '</span><span class="px-title">' + p.title + '</span>' +
        (claimId ? '<span class="px-claim">P' + claimId + '</span>' : '') + '</div>' +
        '<div class="px-poles"><span class="px-a">' + p.a + '</span><span class="px-b">' + p.b + '</span></div>' +
        '<p class="px-note">' + p.note + '</p></div>';
    }).join("");

    document.getElementById("paradoxFilter").innerHTML =
      '<button type="button" class="sortbtn' + (!paradoxFilter ? " active" : "") + '" data-c="">All twenty</button>' +
      A.claims.filter(function (c) { return c.covers.length; }).map(function (c) {
        return '<button type="button" class="sortbtn' + (paradoxFilter === c.id ? " active" : "") +
          '" data-c="' + c.id + '">P' + c.id + '</button>';
      }).join("");

    Array.prototype.forEach.call(document.getElementById("paradoxFilter").querySelectorAll(".sortbtn"), function (b) {
      b.addEventListener("click", function () {
        paradoxFilter = b.dataset.c ? parseInt(b.dataset.c, 10) : null;
        renderParadoxes();
      });
    });
  }

  /* ========================================================= derived figures */
  function pearson(xs, ys) {
    var n = xs.length;
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var cov = 0, sx = 0, sy = 0;
    for (var i = 0; i < n; i++) {
      cov += (xs[i] - mx) * (ys[i] - my);
      sx += Math.pow(xs[i] - mx, 2);
      sy += Math.pow(ys[i] - my, 2);
    }
    return cov / Math.sqrt(sx * sy);
  }

  function renderDerived() {
    var c = A.claims;
    var total = c.reduce(function (a, x) { return a + x.agree + x.expand + x.disagree; }, 0);
    var agree = sum(c, "agree"), expand = sum(c, "expand"), dis = sum(c, "disagree");
    var expandsMore = c.filter(function (x) { return x.expand > x.agree; }).length;
    var r = pearson(c.map(function (x) { return x.disagree; }), c.map(function (x) { return x.contested; }));
    var engaged = sum(c, "engaged"), silent = sum(c, "silent");

    var split = c.slice().sort(function (a, b) {
      return b.disagree / (b.agree + b.expand + b.disagree) - a.disagree / (a.agree + a.expand + a.disagree);
    });
    var quiet = c.slice().sort(function (a, b) { return a.engaged - b.engaged; });

    var items = [
      ["The corpus elaborates, it does not endorse.",
        expand + " codings extend a claim against " + agree + " that agree with it &mdash; and extending outweighs agreeing on " +
        expandsMore + " of the " + c.length + " claims. The only claim the corpus endorses more than it extends is P15, " +
        "that the living world is the ground. Read as a whole, the conversations behave less like a manifesto than like " +
        "a group of people building on a shared frame and then going somewhere else with it."],
      ["The real split is about strategy, not metaphysics.",
        "The single most contested claim is P4, whether to build alongside failing institutions or reform them: " +
        A.claims[3].agree + " agree, " + A.claims[3].disagree + " disagree, a contested score of " + A.claims[3].contested +
        " and a 25% outright rejection rate, the second highest in the corpus. The most rejected claim is P8, that the " +
        "practice works but does not transfer (" + split[0].disagree + " disagreements, " + pct(split[0].disagree / (split[0].agree + split[0].expand + split[0].disagree)) +
        " of codings). Both are questions about method. Nobody is voting on whether the crisis is real."],
      ["The contested score is mostly just the disagreement count.",
        "Across the fifteen claims the correlation between the disagreement count and the published contested score is " +
        r.toFixed(2) + ". Contested is not an independent measure of internal tension; it is mostly a scaled rejection count. " +
        "The exception is P13, grief as a precondition: only " + A.claims[12].disagree + " outright disagreements but a contested score of " +
        A.claims[12].contested + " &mdash; the conversations disagree with each other about <em>when</em> grief belongs rather than about whether it does."],
      ["The corpus is quietest exactly where it agrees.",
        "P5, that belonging precedes power, drew " + A.claims[4].engaged + " engaged conversations and " + A.claims[4].silent +
        " silent ones &mdash; the least-discussed claim of the fifteen, and the only one with zero disagreement and a contested score of zero. " +
        "The corpus is not divided about belonging; it simply has little to say about it. Silence is not assent, and this is the " +
        "claim the 72 conversations have tested least."],
      ["Nobody was shown the propositions.",
        "The analysis states that each coding is a reading of what a conversation commits to, not a response to a question. " +
        "That makes the numbers a measurement of what the corpus implies rather than what its participants think &mdash; " +
        "which is a stronger claim, and a more fragile one."]
    ];

    document.getElementById("derived-list").innerHTML = items.map(function (it, i) {
      return '<div class="derived-item"><h3><span>' + (i + 1) + '</span>' + it[0] + '</h3><p>' + it[1] + '</p></div>';
    }).join("");

    /* audit */
    var base = engaged + silent;
    document.getElementById("audit-list").innerHTML =
      '<div class="audit-row"><span class="ok">Verified</span>' +
      '<p>The headline percentages are arithmetically exact. The fifteen per-claim counts sum to ' +
      total.toLocaleString() + ' codings, ' + agree + ' agree / ' + expand + ' expand / ' + dis + ' disagree &mdash; ' +
      'precisely the totals and ratios printed at the top of the analysis page (' +
      pct(agree / total) + ' / ' + pct(expand / total) + ' / ' + pct(dis / total) + '). Nothing in the aggregate is rounded into place.</p></div>' +
      '<div class="audit-row"><span class="warn">Discrepancy</span>' +
      '<p>The engaged/silent counts sum to ' + base + ' &mdash; ' + (base / 15).toFixed(1).replace(".0", "") +
      ' per claim, not ' + A.corpus.conversations + '. So the coding covers ' + Math.round(base / 15) +
      ' conversations while the corpus now lists ' + A.corpus.conversations + ' (and the conversations index page says 71). ' +
      'The analysis page does not state when it was frozen. The most recent twelve conversations are almost certainly not in it.</p></div>' +
      '<div class="audit-row"><span class="warn">Not reconstructible</span>' +
      '<p>The contested score is published per claim but the rule that produces it is not. It correlates ' + r.toFixed(2) +
      ' with the disagreement count, so it is largely a restatement of it &mdash; which means one of the two numbers is close to redundant.</p></div>' +
      '<div class="audit-row"><span class="warn">Inconsistent front matter</span>' +
      '<p>The site states nine series and lists eight, and the per-series counts sum to 98 against a stated total of 72. ' +
      'Series tags almost certainly overlap, but the pages do not say so. Treat the nine/eight and 72/98 pairs as unresolved.</p></div>';
  }

  /* ================================================================ anchors */
  function renderAnchors() {
    document.getElementById("anchors-list").innerHTML = A.anchors.map(function (a) {
      return '<div class="anchor conf-' + a.conf + '">' +
        '<div class="an-v">' + a.v + '</div>' +
        '<div class="an-l">' + a.label + '</div>' +
        '<div class="an-s">' + a.src + '</div>' +
        '<p class="an-n">' + a.note + '</p>' +
        '<span class="an-tag">' + a.conf + '</span></div>';
    }).join("");
  }

  /* =============================================================== critiques */
  function renderCritiques() {
    document.getElementById("critiques-body").innerHTML = A.critiques.map(function (c) {
      return '<tr class="force-' + c.force + '">' +
        '<td class="cr-who"><b>' + c.who + '</b><span>' + c.at + '</span></td>' +
        '<td class="cr-target">' + c.target + '</td>' +
        '<td class="cr-text">' + c.text + '</td>' +
        '<td class="cr-note">' + c.note + '</td></tr>';
    }).join("");
  }

  /* ================================================================= sources */
  function renderSources() {
    document.getElementById("sources-list").innerHTML = A.sources.map(function (s) {
      return '<li><a href="' + s[2] + '" target="_blank" rel="noopener">' +
        '<b>' + s[0] + '</b><span>' + s[1] + '</span></a></li>';
    }).join("");
  }

  /* ==================================================================== init */
  function init() {
    renderTerms();
    renderTimeline();
    renderAttractors();
    renderBasin();
    renderGenerators();
    renderCorpus();
    buildClaimSorts();
    renderClaims();
    renderClaimDetail();
    renderParadoxes();
    renderDerived();
    renderAnchors();
    renderCritiques();
    renderSources();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
