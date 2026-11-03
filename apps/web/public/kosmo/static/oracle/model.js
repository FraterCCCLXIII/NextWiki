/* ============================================================================
   AI LABOR DISPLACEMENT & MACRO-FRAGILITY MODEL
   ----------------------------------------------------------------------------
   Deterministic monthly-step macro simulation + Monte Carlo layer.

   Units:  employment = millions of workers
           wages      = $ thousands / year (compensation incl. benefits)
           money      = $ billions
           capability = 0..1 index (0.32 = today's frontier, ~0.9 = senior parity)

   Accounting identities that keep the system bounded:
     labour force          fixed at 162M
     unemployment          = (labour force - employed) / labour force
     employment            <= labour force * (1 - structural minimum)
     demand                bounded by labour income, which is bounded by the
                           labour force and the wage ceiling

   Three competing mechanisms are modelled separately, because their signs
   disagree and that disagreement IS the analytical problem:
     1. margin expansion   labour's share of cost collapses      -> earnings up
     2. demand destruction wages are the consumer's budget       -> revenue down
     3. reflexivity        AI capex is part of GDP               -> amplifier
   ============================================================================ */
var SIM = (function () {
  "use strict";

  /* ---------------------------------------------------------------- sectors
     exposure   share of task content that current-gen AI can in principle do
     threshold  capability index required before automation actually bites
     ceiling    max share of the work automated even at full capability
                (regulation, liability, physical presence, trust)
     priceEl    own-price elasticity: >1 => cheaper output grows revenue (Jevons)
     wageEl     sensitivity of sector revenue to aggregate demand
     revShare   baseline share of GDP
  ------------------------------------------------------------------------- */
  var SECTORS = [
    { id: "software",    name: "Software & IT services",    emp: 4.5,  wage: 190, exposure: 0.86, threshold: 0.40, ceiling: 0.93, priceEl: 1.25, wageEl: 1.05, revShare: 0.075, capexEl: 0.30, color: "#8aa4be" },
    { id: "support",     name: "Support & back office",     emp: 6.0,  wage: 58,  exposure: 0.91, threshold: 0.28, ceiling: 0.91, priceEl: 0.85, wageEl: 1.00, revShare: 0.045, color: "#2f6fd0" },
    { id: "finance",     name: "Finance & insurance",       emp: 8.0,  wage: 125, exposure: 0.76, threshold: 0.44, ceiling: 0.78, priceEl: 0.75, wageEl: 1.15, revShare: 0.150, color: "#a9c0b4" },
    { id: "media",       name: "Media, content & design",   emp: 3.5,  wage: 100, exposure: 0.82, threshold: 0.32, ceiling: 0.82, priceEl: 1.10, wageEl: 1.10, revShare: 0.045, color: "#57d6a8" },
    { id: "legal",       name: "Legal & professional svcs", emp: 5.0,  wage: 155, exposure: 0.72, threshold: 0.52, ceiling: 0.62, priceEl: 0.70, wageEl: 1.00, revShare: 0.055, color: "#4fc3a1" },
    { id: "consulting",  name: "Management consulting",     emp: 4.0,  wage: 170, exposure: 0.80, threshold: 0.50, ceiling: 0.72, priceEl: 0.75, wageEl: 1.05, revShare: 0.060, color: "#3fb894" },
    { id: "manufacturing",name:"Manufacturing",             emp: 12.5, wage: 84,  exposure: 0.36, threshold: 0.88, ceiling: 0.48, priceEl: 0.95, wageEl: 0.95, revShare: 0.120, capexEl: 0.16, color: "#a396b3" },
    { id: "logistics",   name: "Logistics & transport",     emp: 8.0,  wage: 64,  exposure: 0.46, threshold: 0.86, ceiling: 0.58, priceEl: 0.90, wageEl: 0.95, revShare: 0.075, capexEl: 0.10, color: "#ad86e8" },
    { id: "healthcare",  name: "Healthcare & social care",  emp: 22.0, wage: 92,  exposure: 0.42, threshold: 0.82, ceiling: 0.32, priceEl: 0.35, wageEl: 0.75, revShare: 0.170, color: "#c4a373" },
    { id: "education",   name: "Education",                 emp: 13.0, wage: 80,  exposure: 0.52, threshold: 0.70, ceiling: 0.42, priceEl: 0.35, wageEl: 0.70, revShare: 0.060, color: "#f5b93f" },
    { id: "construction",name: "Construction & trades",     emp: 9.5,  wage: 84,  exposure: 0.22, threshold: 0.95, ceiling: 0.26, priceEl: 0.80, wageEl: 0.90, revShare: 0.050, capexEl: 0.22, color: "#9678d6" },
    { id: "government",  name: "Government & public sector", emp: 23.0, wage: 90, exposure: 0.46, threshold: 0.66, ceiling: 0.40, priceEl: 0.30, wageEl: 0.60, revShare: 0.090, color: "#e0a736" },
    { id: "hospitality", name: "Hospitality & food service", emp: 14.0, wage: 46, exposure: 0.26, threshold: 0.90, ceiling: 0.30, priceEl: 0.85, wageEl: 1.10, revShare: 0.045, color: "#8a6ecb" },
    { id: "retail",      name: "Retail & e-commerce ops",    emp: 15.0, wage: 52,  exposure: 0.52, threshold: 0.60, ceiling: 0.56, priceEl: 0.95, wageEl: 1.05, revShare: 0.110, color: "#d9a23a" },
    { id: "agriculture", name: "Agriculture & mining",      emp: 3.0,  wage: 58,  exposure: 0.26, threshold: 0.94, ceiling: 0.32, priceEl: 0.70, wageEl: 0.85, revShare: 0.020, color: "#7d64bd" },
    { id: "energy",      name: "Energy & utilities",        emp: 2.0,  wage: 105, exposure: 0.30, threshold: 0.92, ceiling: 0.32, priceEl: 0.60, wageEl: 0.85, revShare: 0.030, capexEl: 0.22, color: "#6f59a8" },
    { id: "realestate",  name: "Real estate & facilities",  emp: 4.0,  wage: 70,  exposure: 0.48, threshold: 0.58, ceiling: 0.46, priceEl: 0.80, wageEl: 1.00, revShare: 0.040, color: "#c4903a" }
  ];

  /* --------------------------------------------------- measured calibration
     `calibration.js` is generated by `ingest.mjs` from live BLS, BEA, OEWS and
     O*NET data. Where it is present it replaces the hand-set employment, wages,
     value-added share, exposure, threshold and ceiling for every sector.

     priceEl, wageEl and capexEl stay as they are: no public series measures them,
     and pretending otherwise would be the same error in a new costume.

     The literals above remain the fallback, so the page still runs if the
     generated file is missing, and every sector records both values so the UI can
     show what the ingestion moved.
  ------------------------------------------------------------------------- */
  var CALIB = (typeof CALIBRATION !== "undefined") ? CALIBRATION : null;
  if (!CALIB && typeof require === "function") {
    try { CALIB = require("./calibration.js"); } catch (e) { CALIB = null; }
  }
  if (CALIB && CALIB.sectors) {
    var byId = {};
    for (var ci = 0; ci < CALIB.sectors.length; ci++) byId[CALIB.sectors[ci].id] = CALIB.sectors[ci];
    for (var si = 0; si < SECTORS.length; si++) {
      var c = byId[SECTORS[si].id];
      if (!c) continue;
      SECTORS[si].prior = {
        emp: SECTORS[si].emp, wage: SECTORS[si].wage, revShare: SECTORS[si].revShare,
        exposure: SECTORS[si].exposure, threshold: SECTORS[si].threshold, ceiling: SECTORS[si].ceiling
      };
      SECTORS[si].emp = c.emp;
      SECTORS[si].wage = c.wage;
      SECTORS[si].revShare = c.revShare;
      SECTORS[si].exposure = c.exposure;
      SECTORS[si].threshold = c.threshold;
      SECTORS[si].ceiling = c.ceiling;
      SECTORS[si].calibrated = true;
    }
  }

  var DEFAULTS = {
    horizonYears: 10,

    /* capability & compute */
    computeGrowth: 1.45,       // installed compute multiple per year
    algoGrowth: 1.65,          // algorithmic efficiency multiple per year
    fullCapMultiple: 300,      // effective-compute multiple needed to reach capMax
    cap0: 0.32,                // capability index today
    capMax: 0.97,              // asymptote (1.0 = most senior human work)

    /* diffusion & literacy */
    literacy: 0.10,            // share of the workforce that learns agentic workflows
    diffusionScale: 1.8,       // spread of adoption around the midpoint, years
    orgFriction: 0.45,         // institutional drag on deployment
    automationCap: 0.95,       // hard cap on automatable share per sector

    /* labour market */
    reabsorption: 0.35,        // share of displaced workers rehired per year
    aiOpsIntensity: 0.09,      // oversight jobs created per automated job
    adjMonths: 9,              // hiring / firing lag
    marginReversion: 0.8,      // competitive erosion of excess margins

    /* software cost & deflation */
    softwareCostDecline: 0.55, // unit cost of code falls this much per year
    pricePassThrough: 0.50,    // share of productivity gain passed into prices
    elasticityMult: 1.0,       // multiplier on all sector price elasticities
    aiCogs: 0.05,              // inference cost as share of revenue at full automation
    inferenceDecline: 0.50,    // inference cost decline per year

    /* macro & policy */
    mpc: 0.65,                 // elasticity of consumption to household income
    wageFlex: 0.35,            // how far real wages fall as unemployment rises
    policyPut: 0.55,           // monetary / fiscal offset as unemployment rises
    capitalToHouseholds: 0.35, // share of profits that reaches household budgets
    ubi: 0.0,                  // share of the labour force receiving a transfer
    ubiAmount: 12,             // $k per year per recipient
    wealthEffect: 1.0,         // strength of the equity-wealth -> spending channel
    aiCapex: 0.022,            // AI datacenter capex, share of GDP

    /* market pricing */
    basePE: 22,
    earnGrowthWeight: 0.90,
    unempSens: 1.6,
    deflationSens: 0.5,
    marketConcentration: 0.65
  };

  var LEVER_GROUPS = [
    {
      title: "Capability & compute",
      blurb: "How fast the frontier moves, and how much compute the economy can actually point at work.",
      levers: [
        { key: "computeGrowth", label: "Datacenter compute growth", min: 1.0, max: 2.2, step: 0.05, fmt: "x", suffix: "/yr" },
        { key: "algoGrowth", label: "Algorithmic efficiency", min: 1.0, max: 2.5, step: 0.05, fmt: "x", suffix: "/yr" },
        { key: "fullCapMultiple", label: "Compute multiple to reach ~90% capability", min: 30, max: 3000, step: 10, fmt: "x" },
        { key: "cap0", label: "Capability today", min: 0.15, max: 0.55, step: 0.01, fmt: "pct" },
        { key: "capMax", label: "Capability ceiling", min: 0.6, max: 1.0, step: 0.01, fmt: "pct" }
      ]
    },
    {
      title: "Diffusion & literacy",
      blurb: "The frontier is not the economy. This is the gap between what models can do and what firms and workers actually deploy.",
      levers: [
        { key: "literacy", label: "Share who learn agentic automation", min: 0.02, max: 1.0, step: 0.01, fmt: "pct" },
        { key: "diffusionScale", label: "Diffusion spread (higher = slower)", min: 0.6, max: 5.0, step: 0.1, fmt: "yr" },
        { key: "orgFriction", label: "Institutional / org friction", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "automationCap", label: "Hard cap on automation", min: 0.3, max: 1.0, step: 0.01, fmt: "pct" }
      ]
    },
    {
      title: "Cost of software",
      blurb: "The deflation channel. Cheaper code only stays bullish if demand is elastic enough to absorb it.",
      levers: [
        { key: "softwareCostDecline", label: "Unit cost of code falls", min: 0.1, max: 0.9, step: 0.01, fmt: "pct", suffix: "/yr" },
        { key: "pricePassThrough", label: "Productivity passed to prices", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "elasticityMult", label: "Demand elasticity multiplier", min: 0.4, max: 2.0, step: 0.05, fmt: "x" },
        { key: "inferenceDecline", label: "Inference cost falls", min: 0.1, max: 0.9, step: 0.01, fmt: "pct", suffix: "/yr" },
        { key: "aiCogs", label: "Inference load at full automation", min: 0, max: 0.35, step: 0.005, fmt: "pct" }
      ]
    },
    {
      title: "Labour market",
      blurb: "How much displacement becomes permanent unemployment, and how many oversight jobs appear.",
      levers: [
        { key: "adjMonths", label: "Hiring / firing lag", min: 1, max: 24, step: 1, fmt: "mo" },
        { key: "reabsorption", label: "Displaced rehired elsewhere", min: 0, max: 0.8, step: 0.01, fmt: "pct", suffix: "/yr" },
        { key: "aiOpsIntensity", label: "Oversight jobs per automated job", min: 0, max: 0.5, step: 0.01, fmt: "pct" },
        { key: "marginReversion", label: "Competition erodes excess margins", min: 0, max: 2, step: 0.05, fmt: "x" }
      ]
    },
    {
      title: "Macro & policy",
      blurb: "The demand side. Wages are the consumer's budget, so labour's share of income is everyone else's revenue.",
      levers: [
        { key: "mpc", label: "Spending response to household income", min: 0.3, max: 1.1, step: 0.01, fmt: "pct" },
        { key: "wageFlex", label: "Wage flexibility to unemployment", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "capitalToHouseholds", label: "Profits reaching household budgets", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "policyPut", label: "Policy offset (rates / fiscal)", min: 0, max: 1.5, step: 0.05, fmt: "x" },
        { key: "ubi", label: "Transfer coverage (UBI / wage subsidy)", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "ubiAmount", label: "Transfer size", min: 0, max: 40, step: 1, fmt: "k" },
        { key: "wealthEffect", label: "Equity wealth into spending", min: 0, max: 2.5, step: 0.05, fmt: "x" },
        { key: "aiCapex", label: "AI capex share of GDP", min: 0, max: 0.08, step: 0.001, fmt: "pct" }
      ]
    },
    {
      title: "Market pricing",
      blurb: "How the equity market turns earnings and fear into a multiple.",
      levers: [
        { key: "basePE", label: "Baseline P/E", min: 10, max: 35, step: 0.5, fmt: "x" },
        { key: "earnGrowthWeight", label: "Multiple response to earnings growth", min: 0, max: 2.5, step: 0.05, fmt: "x" },
        { key: "unempSens", label: "Multiple response to unemployment", min: 0, max: 5, step: 0.1, fmt: "x" },
        { key: "deflationSens", label: "Multiple response to deflation", min: 0, max: 3, step: 0.1, fmt: "x" },
        { key: "marketConcentration", label: "Index concentration in AI winners", min: 0, max: 1, step: 0.01, fmt: "pct" }
      ]
    }
  ];

  var PRESETS = [
    { id: "base", name: "Base case", blurb: "Fast compute, slow diffusion: the economy mostly does not use the frontier.", patch: {} },
    { id: "everyone", name: "Everyone learns agents", blurb: "Literacy goes to ~100% within a few years. The question you asked.", patch: { literacy: 0.98, diffusionScale: 1.0, orgFriction: 0.15 } },
    { id: "stall", name: "Diffusion stall", blurb: "Capability keeps rising; the economy never adopts it.", patch: { literacy: 0.12, diffusionScale: 3.6, orgFriction: 0.7 } },
    { id: "takeoff", name: "Fast takeoff", blurb: "Capability blowout plus rapid adoption.", patch: { computeGrowth: 1.85, algoGrowth: 2.1, fullCapMultiple: 60, literacy: 0.7, diffusionScale: 1.2, orgFriction: 0.2 } },
    { id: "jevons", name: "Elastic demand (Jevons)", blurb: "Cheap code creates more demand than it destroys.", patch: { elasticityMult: 1.8, pricePassThrough: 0.85 } },
    { id: "deflation", name: "Inelastic demand", blurb: "Cheap code cannibalises revenue: margins rise on a shrinking base.", patch: { elasticityMult: 0.55, pricePassThrough: 0.8, deflationSens: 1.4 } },
    { id: "newdeal", name: "UBI + redistribution", blurb: "Heavy transfers and broad capital ownership, on a slower adoption curve. Protects jobs, not valuations.", patch: { ubi: 0.6, ubiAmount: 16, mpc: 0.78, diffusionScale: 2.6, literacy: 0.25, capitalToHouseholds: 0.6 } },
    { id: "darkfactory", name: "Dark factories everywhere", blurb: "Autonomous pipelines in every firm, near-zero marginal cost of output.", patch: { literacy: 1.0, diffusionScale: 0.8, orgFriction: 0.05, automationCap: 1.0, elasticityMult: 1.2, aiCogs: 0.02, inferenceDecline: 0.65 } }
  ];

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  var LF = (CALIB && CALIB.baseline && CALIB.baseline.lf) || 162;      // labour force, millions
  var GDP0 = (CALIB && CALIB.baseline && CALIB.baseline.gdp) || 30000; // baseline GDP, $bn
  var STRUCTURAL_UNEMP = 0.035;  // frictional floor
  var CONS_SHARE = 0.66, INV_SHARE = 0.20, GOV_SHARE = 0.17, NX_SHARE = -0.03;
  var AIOPS_WAGE = 78;       // $k, average wage of oversight / AI-operations roles
  var PE_ANCHOR = 22;        // long-run earnings multiple the index is priced against

  var REVSHARE_SUM = SECTORS.reduce(function (a, s) { return a + s.revShare; }, 0);

  /* ------------------------------------------------------------- simulation */
  function simulate(p) {
    var M = Math.round(p.horizonYears * 12);
    var nS = SECTORS.length;
    var i, t, s;

    /* ---- baseline calibration ---- */
    var rev0 = [], labor0 = [], other0 = [], compute0 = [];
    for (i = 0; i < nS; i++) {
      rev0[i] = GDP0 * SECTORS[i].revShare / REVSHARE_SUM;
      labor0[i] = SECTORS[i].emp * SECTORS[i].wage;
      compute0[i] = 0.018 * rev0[i];
      // other costs absorb whatever is left after labour, compute and an 11% margin.
      // A negative value means the activity is subsidised (public funding).
      other0[i] = rev0[i] - labor0[i] - compute0[i] - 0.11 * rev0[i];
    }
    var laborIncome0 = 0, earnings0 = 0;
    for (i = 0; i < nS; i++) {
      laborIncome0 += labor0[i];
      earnings0 += rev0[i] - labor0[i] - other0[i] - compute0[i];
    }
    var householdIncome0 = laborIncome0 + earnings0 * p.capitalToHouseholds * 0.40;
    var avgWage0 = laborIncome0 / 156;

    var emp = SECTORS.map(function (x) { return x.emp; });
    var emp0 = emp.slice();
    var empWeights = SECTORS.map(function (x) { return x.emp; });
    var totalEmpWeight = empWeights.reduce(function (a, b) { return a + b; }, 0);
    var aiOps = 0;

    /* market baseline */
    var concFactor = 0.58 + 0.42 * p.marketConcentration;
    var mktEarn0 = earnings0 * concFactor;

    /* state */
    var indexPeak = 100, minDD = 0, crashMonth = -1;
    var earnHist = [], priceHist = [], indexLag = 100;
    var growthSmooth = 0, profitSmooth = 1, cpiYoY = 0;
    var peakUnemp = STRUCTURAL_UNEMP;
    var demandIndex = 1;
    var profitLag = earnings0, unempLag = 0.042, mktEarn0 = null, marginRef = null;

    var out = {
      years: [], cap: [], diff: [], unemp: [], laborShare: [], index: [], drawdown: [],
      gdp: [], consumption: [], capex: [], cpi: [], profit: [], margin: [], autoFrac: [],
      laborIncome: [], aiOps: [], employed: [], pe: [], priceIndex: [], earnings: [],
      revenue: [], concFactor: [],
      sectorEmpYear: [], sectorAutoYear: [], crossYear: {}
    };

    for (t = 0; t <= M; t++) {
      var yr = t / 12;

      /* --- capability: effective compute in log space, saturating --------- */
      var lc = yr * (Math.log(p.computeGrowth) + Math.log(p.algoGrowth));
      var cap = clamp(
        p.cap0 + (p.capMax - p.cap0) * (1 - Math.exp(-lc / Math.log(p.fullCapMultiple))),
        0, 1
      );

      /* --- diffusion: literacy moves the midpoint of an S-curve ----------- */
      var t50 = 9 - 7 * clamp(p.literacy, 0, 1);
      var diff = sigmoid((yr - t50) / Math.max(0.3, p.diffusionScale));

      /* --- sector production targets -------------------------------------
         Cheaper code is cheaper automation: every 10x fall in the unit cost
         of building software lowers the barrier to deploying it, on top of
         whatever the workforce does. This is the "orders of magnitude"
         channel and it is separate from capability.                        */
      var codeCheapness = Math.pow(1 / Math.max(0.1, 1 - p.softwareCostDecline), yr);
      var deployBoost = clamp(1 + 0.15 * Math.log10(codeCheapness), 1, 1.9);

      var targets = new Array(nS);
      var autoWeighted = 0;
      for (i = 0; i < nS; i++) {
        s = SECTORS[i];
        var gate = sigmoid((cap - s.threshold) / 0.07);
        var pressure = s.exposure * gate * diff * (1 - p.orgFriction * 0.4) * deployBoost;
        var autoFrac = clamp(pressure * s.ceiling + s.exposure * 0.015, 0, p.automationCap);

        if (out.crossYear[s.id] === undefined && cap >= s.threshold) out.crossYear[s.id] = yr;

        // productivity gain passed into prices; cheaper output lifts volume
        var priceLevel = clamp(1 - p.pricePassThrough * autoFrac, 0.05, 1.15);
        var elasticity = s.priceEl * p.elasticityMult;
        var volume = clamp(Math.pow(priceLevel, -elasticity), 0.25, 3.2);

        targets[i] = { autoFrac: autoFrac, priceLevel: priceLevel, volume: volume };
        autoWeighted += autoFrac * empWeights[i];
      }
      var autoAvg = autoWeighted / totalEmpWeight;

      /* --- household income and the demand side ---------------------------
         Two income channels feed spending: wages and distributed capital
         income. Whether profits flow back to household budgets is the single
         most important stabiliser in the model. Automatic stabilisers
         (unemployment insurance, progressive tax) are modelled explicitly,
         because without them any displacement becomes a death spiral.        */
      // wages adjust to unemployment: the classic stabiliser, and the reason
      // "jobs disappear forever" is a modelling choice, not a fact
      var wageFactor = 1 - p.wageFlex * clamp((unempLag - 0.045) * 2.2, 0, 0.38);

      var laborIncome = aiOps * AIOPS_WAGE * wageFactor;
      for (i = 0; i < nS; i++) laborIncome += emp[i] * SECTORS[i].wage * wageFactor;

      var capitalIncome = profitLag * p.capitalToHouseholds;
      // Capital income supports spending far less than wages do: it is
      // concentrated in households with a low marginal propensity to consume,
      // and it is saved rather than spent. Without this discount the model
      // manufactures an artificial profit-to-demand bubble.
      var CAPITAL_MPC = 0.40;
      var householdIncome = laborIncome + capitalIncome * CAPITAL_MPC;

      var transfers = p.ubi * LF * p.ubiAmount;
      var stabilizer = 0.30 * Math.max(0, unempLag - 0.045) * LF * avgWage0;
      var wealth = p.wealthEffect * clamp(indexLag / 100 - 1, -0.6, 1.2) * 0.03 * GDP0;
      var consumption = CONS_SHARE * GDP0
        * Math.pow(Math.max(0.15, householdIncome / householdIncome0), p.mpc)
        + transfers * 0.9 + stabilizer * 0.8 + wealth;

      // precautionary saving: past roughly 6% unemployment households cut
      // spending faster than their income falls. This nonlinearity is what
      // turns a jobs shock into a demand collapse.
      var precaution = clamp(1 - 0.9 * Math.max(0, unempLag - 0.06), 0.55, 1);
      consumption *= precaution;
      consumption = clamp(consumption, 0.15 * GDP0, 2.2 * CONS_SHARE * GDP0);
      // firms and households respond to smoothed demand, not one month's noise
      var demandNow = consumption / (CONS_SHARE * GDP0);
      demandIndex = demandIndex * 0.86 + demandNow * 0.14;

      /* --- AI capex: scales with adoption, cut when profitability fades --- */
      var capexExtra = GDP0 * p.aiCapex * clamp(autoAvg * 1.7, 0, 1.5)
        * clamp(0.35 + 0.65 * profitSmooth, 0.35, 1.3);
      var investment = INV_SHARE * GDP0 + capexExtra;

      /* --- revenue and costs ---------------------------------------------- */
      var revNow = 0, laborNow = 0, computeNow = 0, otherNow = 0, profitNow = 0;
      var priceLevelAvg = 0;
      var inferenceEff = Math.pow(1 / Math.max(0.1, 1 - p.inferenceDecline), yr);

      for (i = 0; i < nS; i++) {
        s = SECTORS[i];
        var tg = targets[i];
        var sectorDemand = Math.pow(demandIndex, s.wageEl);
        // AI datacenter buildout is itself demand for these sectors. When the
        // buildout is cut, their revenue goes with it: the second leg down.
        var capexRev = capexExtra * (s.capexEl || 0);
        var rev = rev0[i] * tg.priceLevel * tg.volume * sectorDemand + capexRev;
        var laborCost = emp[i] * s.wage * wageFactor;
        var computeCost = (compute0[i] * 0.6) + (rev0[i] * p.aiCogs * tg.autoFrac / inferenceEff);
        // non-labour costs are mostly variable: they fall with real output,
        // with a fixed floor. Without this, margins go absurdly negative.
        var outputRatio = clamp(tg.volume * sectorDemand, 0.3, 2.5);
        // non-labour inputs deflate along with output prices, so a fall in
        // the price level does not mechanically destroy margins
        var otherCost = other0[i] * (0.25 + 0.75 * outputRatio)
          * (0.45 + 0.55 * tg.priceLevel) + capexRev * 0.52;

        revNow += rev;
        laborNow += laborCost;
        computeNow += computeCost;
        otherNow += otherCost;
        profitNow += rev - laborCost - computeCost - otherCost;
        priceLevelAvg += tg.priceLevel * (rev0[i] / GDP0);
      }
      var grossMargin = revNow > 0 ? profitNow / revNow : 0;
      if (marginRef === null) marginRef = Math.max(0.05, grossMargin);
      // margins revert toward their starting level: excess margins attract
      // entry, depressed margins invite consolidation and price repair
      var erosion = clamp(p.marginReversion * (grossMargin - marginRef), -0.45, 0.5);
      var profitAdj = profitNow * (1 - erosion);
      var margin = revNow > 0 ? profitAdj / revNow : 0;

      /* --- labour demand, capped by the labour force ---------------------- */
      var adj = 1 - Math.exp(-1 / p.adjMonths);
      var demand = new Array(nS);
      var demandSum = aiOps;
      for (i = 0; i < nS; i++) {
        s = SECTORS[i];
        var tg2 = targets[i];
        // labour demand = baseline jobs x (unautomated share) x volume effect
        var d = emp0[i] * (1 - tg2.autoFrac) * Math.pow(tg2.volume, 0.4)
          * Math.pow(demandIndex, s.wageEl * 0.6)
          * Math.pow(wageFactor, -0.55);   // cheaper labour restores demand for it
        demand[i] = Math.max(0, d);
        demandSum += demand[i];
      }
      // AI-operations jobs to supervise the automated base, plus whatever
      // share of the displaced the economy manages to re-employ elsewhere
      var automatedEquivalents = 0, displacedCount = 0;
      for (i = 0; i < nS; i++) {
        automatedEquivalents += emp0[i] * targets[i].autoFrac;
        displacedCount += Math.max(0, emp0[i] - demand[i] * 1);
      }
      var aiOpsTarget = p.aiOpsIntensity * automatedEquivalents
        + p.reabsorption * displacedCount;
      demandSum += aiOpsTarget;

      // impossible to employ more than the labour force allows
      var empCap = LF * (1 - STRUCTURAL_UNEMP);
      var scale = demandSum > empCap ? empCap / demandSum : 1;

      for (i = 0; i < nS; i++) {
        var next = emp[i] + (demand[i] * scale - emp[i]) * adj;
        next = Math.max(next, emp0[i] * 0.02);
        emp[i] = next;
      }
      aiOps = Math.max(0, Math.min(aiOps + (aiOpsTarget * scale - aiOps) * adj, empCap));

      /* --- unemployment is an identity, not an accumulator ---------------- */
      var employed = aiOps;
      for (i = 0; i < nS; i++) employed += emp[i];
      var unemp = clamp(1 - employed / LF, 0, 0.6);
      peakUnemp = Math.max(peakUnemp, unemp);

      /* --- GDP ------------------------------------------------------------ */
      // countercyclical public spending: automatic stabilisers plus the
      // emergency programmes that always appear in a real downturn
      var govSpend = GOV_SHARE * GDP0
        * (0.82 + 0.18 * demandIndex + 0.9 * Math.max(0, unemp - 0.045));
      var gdp = consumption + investment + govSpend + NX_SHARE * GDP0;
      var laborShare = laborIncome / Math.max(1, gdp);

      /* --- price level / CPI ---------------------------------------------- */
      var priceIndex = 0.85 * priceLevelAvg * 1.05 + 0.15;
      if (priceHist.length >= 12) cpiYoY = priceIndex / priceHist[priceHist.length - 12] - 1;
      priceHist.push(priceIndex);

      /* --- equity market -------------------------------------------------- */
      var mktEarn = profitAdj * concFactor;
      if (mktEarn0 === null) mktEarn0 = Math.max(1, mktEarn);
      earnHist.push(mktEarn);
      var growthYoY = earnHist.length > 12 ? mktEarn / Math.max(1, earnHist[earnHist.length - 13]) - 1 : 0;
      growthSmooth = growthSmooth * 0.88 + clamp(growthYoY, -0.5, 0.5) * 0.12;
      profitSmooth = profitSmooth * 0.9 + clamp(profitAdj / Math.max(1, earnings0), 0, 1.6) * 0.1;

      var uGap = Math.max(0, unemp - 0.05);
      var defl = Math.max(0, -cpiYoY);
      var pe0 = p.basePE;
      // policy easing lifts the multiple into weakness; deflation caps it
      var policyEase = p.policyPut * clamp(uGap * 3.2, 0, 0.55) * clamp(1 - defl * 12, 0, 1);
      var pe = pe0
        * clamp(1 + p.earnGrowthWeight * growthSmooth, 0.55, 1.5)
        * clamp(1 - p.unempSens * uGap + policyEase, 0.3, 1.6)
        * clamp(1 - p.deflationSens * defl * 5, 0.55, 1.1);
      pe = clamp(pe, 6.5, 48);

      // a concentrated index is a long-duration index: it pays a premium when
      // growth is strong and de-rates harder when it turns
      var concPremium = 1 + p.marketConcentration * 0.45 * clamp(growthSmooth * 4, -1, 1);

      // anchored to a long-run multiple, so a richly priced starting market
      // begins with more air beneath it and a deeper drawdown
      var index = 100 * clamp(mktEarn / mktEarn0, 0.05, 40) * (pe / PE_ANCHOR) * concPremium;
      index = Math.max(index, 4);
      indexLag = index;
      profitLag = profitAdj;
      unempLag = unemp;
      indexPeak = Math.max(indexPeak, index);
      var dd = index / indexPeak - 1;
      minDD = Math.min(minDD, dd);
      if (dd <= -0.20 && crashMonth < 0) crashMonth = t;

      /* --- record ---------------------------------------------------------- */
      out.years.push(yr);
      out.cap.push(cap);
      out.diff.push(diff);
      out.unemp.push(unemp);
      out.laborShare.push(laborShare);
      out.index.push(index);
      out.drawdown.push(dd);
      out.gdp.push(gdp);
      out.consumption.push(consumption);
      out.capex.push(capexExtra);
      out.cpi.push(cpiYoY);
      out.profit.push(profitNow);
      out.margin.push(margin);
      out.autoFrac.push(autoAvg);
      out.laborIncome.push(laborIncome);
      out.aiOps.push(aiOps);
      out.employed.push(employed);
      out.pe.push(pe);
      out.priceIndex.push(priceIndex);
      out.earnings.push(mktEarn);
      // recorded so a crash can be attributed exactly: the index is
      // earnings x multiple x concentration, and earnings are
      // margin x revenue x concentration factor
      out.revenue.push(revNow);
      out.concFactor.push(concFactor);

      if (t % 3 === 0) {
        out.sectorEmpYear.push(emp.slice());
        out.sectorAutoYear.push(targets.map(function (x) { return x.autoFrac; }));
      }
    }

    /* --- annual downsample for charts ------------------------------------- */
    var annual = {};
    ["cap", "diff", "unemp", "laborShare", "index", "drawdown", "gdp", "consumption",
      "capex", "cpi", "profit", "margin", "autoFrac", "aiOps", "pe", "employed",
      "revenue"].forEach(function (k) {
      annual[k] = [];
    });
    annual.years = [];
    for (t = 0; t <= M; t += 12) {
      annual.years.push(out.years[t]);
      for (var k in annual) if (k !== "years") annual[k].push(out[k][t]);
    }
    out.annual = annual;

    var employedEnd = aiOps;
    for (i = 0; i < nS; i++) employedEnd += emp[i];

    out.maxDD = minDD;
    out.peakUnemp = peakUnemp;
    out.crashMonth = crashMonth;
    out.empBySector = emp;
    out.emp0BySector = emp0;
    out.final = {
      index: out.index[M],
      drawdown: out.drawdown[M],
      maxDD: minDD,
      unemp: out.unemp[M],
      peakUnemp: peakUnemp,
      laborShare: out.laborShare[M],
      laborShare0: out.laborShare[0],
      gdp: out.gdp[M],
      gdp0: out.gdp[0],
      employment: employedEnd,
      employment0: emp0.reduce(function (a, b) { return a + b; }, 0),
      aiOps: aiOps,
      autoFrac: out.autoFrac[M],
      cap: out.cap[M],
      margin: out.margin[M],
      margin0: out.margin[0],
      profit: out.profit[M],
      profit0: out.profit[0],
      capex: out.capex[M],
      crashMonth: crashMonth,
      codeCost: Math.pow(1 / Math.max(0.1, 1 - p.softwareCostDecline), p.horizonYears)
    };
    return out;
  }

  /* ------------------------------------------------------------ Monte Carlo */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function monteCarlo(base, runs) {
    runs = runs || 180;
    var rnd = mulberry32(20261101);
    var dds = [], peakU = [], crashM = [];
    for (var k = 0; k < runs; k++) {
      var p = {};
      for (var key in base) p[key] = base[key];
      p.algoGrowth = base.algoGrowth * Math.exp((rnd() - 0.5) * 0.55);
      p.computeGrowth = base.computeGrowth * Math.exp((rnd() - 0.5) * 0.35);
      p.literacy = clamp(base.literacy * (0.4 + rnd() * 1.25), 0.02, 1);
      p.diffusionScale = clamp(base.diffusionScale * (0.65 + rnd() * 0.8), 0.4, 6);
      p.elasticityMult = clamp(base.elasticityMult * (0.65 + rnd() * 0.7), 0.3, 2.2);
      p.aiCapex = clamp(base.aiCapex * (0.4 + rnd() * 1.35), 0, 0.09);
      p.mpc = clamp(base.mpc * (0.85 + rnd() * 0.25), 0.3, 1.1);
      p.capMax = clamp(base.capMax * (0.92 + rnd() * 0.1), 0.55, 1);

      var r = simulate(p);
      dds.push(r.maxDD);
      peakU.push(r.peakUnemp);
      crashM.push(r.crashMonth);
    }
    dds.sort(function (a, b) { return a - b; });
    peakU.sort(function (a, b) { return a - b; });
    function pct(arr, q) { return arr[Math.floor(clamp(q, 0, 1) * (arr.length - 1))]; }
    function share(arr, f) { return arr.filter(f).length / arr.length; }

    return {
      runs: runs,
      dds: dds,
      medianDD: pct(dds, 0.5),
      p10DD: pct(dds, 0.1),
      p90DD: pct(dds, 0.9),
      pCrash20: share(dds, function (d) { return d <= -0.20; }),
      pCrash25: share(dds, function (d) { return d <= -0.25; }),
      pCrash35: share(dds, function (d) { return d <= -0.35; }),
      pCrash50: share(dds, function (d) { return d <= -0.50; }),
      medianPeakUnemp: pct(peakU, 0.5),
      p90PeakUnemp: pct(peakU, 0.9),
      pCrashEarly: share(crashM, function (m) { return m >= 0 && m <= 36; })
    };
  }

  return {
    SECTORS: SECTORS, DEFAULTS: DEFAULTS, LEVER_GROUPS: LEVER_GROUPS,
    PRESETS: PRESETS, simulate: simulate, monteCarlo: monteCarlo, clamp: clamp,
    CALIBRATION: CALIB, BASELINE: { lf: LF, gdp: GDP0 }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SIM;
