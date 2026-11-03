/* ============================================================================
   CENTURY — long-horizon model, 2026 to 2126
   ----------------------------------------------------------------------------
   A DIFFERENT KIND OF MODEL FROM model.js, ON PURPOSE.

   The 10-year model answers "when does the labour shock hit equity prices".
   This one answers "where does the economy land", and it respects three things
   that measured forecasting research establishes:

     1. Point forecasts beyond ~5 years carry little information (Tetlock's
        expert-forecasting study found accuracy decaying to chance by five
        years; there is no scored, resolved dataset at 10-25 years). So this
        model does not report a number for 2126. It reports a distribution of
        paths and an attribution of what the spread depends on.

     2. Century-scale outputs are dominated by the discount rate, which is an
        ethical choice rather than an empirical parameter: Stern's 1.4% values
        $100 in 100 years at $24.90, Nordhaus's 4.3% at $1.48 — a 17x gap.
        The rate is therefore a headline lever, not a constant.

     3. Growth with an endogenous capital share is the right frame
        (Trammell & Korinek): g_Y = g_A / (1 - alpha_eff). A capital share of
        ~0.33 keeps growth near 2%; as automation raises the effective share
        toward 0.95 the same technology growth amplifies toward ~40%. The
        contested parameter is NOT capability — it is whether new tasks keep
        being created (Acemoglu & Restrepo's reinstatement effect).

   Where each piece comes from:
     demography   UN WPP 2024 shape: peak ~2084, then decline
     compute      Epoch AI trends, then bounded by electricity supply
     capability   saturating function of effective compute
     tasks        Acemoglu-Restrepo: automated share b, new-task share n
     growth       Trammell-Korinek amplification on the effective capital share
     demand       wages are the consumer's budget; if capital income does not
                  circulate, output is demand-constrained below potential
     equity       present value at an explicit discount rate, reported at both
                  ends of the Stern-Nordhaus range

   The single most important thing this model says is not about AI. It is that
   measured compute growth (5x/yr) cannot be sustained: electricity grows ~2%/yr
   and compute per joule ~1.34x/yr, so the long-run ceiling on compute growth is
   their product, ~1.37x/yr. At 5x/yr the wall arrives within a few years. That
   is Epoch AI's own conclusion ("power is the first binding constraint"), and it
   means the century is governed by power and chip efficiency, not algorithms.
   ============================================================================ */
var CENTURY = (function () {
  "use strict";

  var DEFAULTS = {
    startYear: 2026,
    horizon: 100,

    /* ---- deep time: the physical ceiling ------------------------------
       Beyond roughly 2200 this stops being an economic forecast and becomes
       a physics extrapolation, so it is worth being explicit about what the
       physics allows. Real output cannot compound forever. It is bounded by
       two things, each with a hard ceiling:

         exergy captured      growth of accessible primary power, capped by
                              the starlight falling on the observable
                              universe (~1e37 W)
         exergy productivity  real output per joule, capped by what a joule
                              can carry before thermodynamics forbids it

       Today the world runs ~20 TW into ~$110T of output, about $5.5 per
       watt-year. The ceiling is 8,000 years of compounding away, but it is
       finite, and where growth stops is the only interesting deep-time
       output.                                                          */
    popFloor: 4.0,                  // billions; post-transition population
    energyFrontier: 1.015,          // x/yr, growth of accessible primary power
    /* Output per unit of exergy. World GDP per watt has risen a few percent a
       year historically, but compute per joule has risen ~34%/yr since 2008
       (Epoch), and an economy made of computation tracks the faster number.
       12%/yr is between the two; setting it to the macro trend instead makes
       the ceiling bind inside the economic horizon, which is the wrong
       century to be talking about physics. */
    energyProductivityGrowth: 1.12,
    energyProductivityMax: 1e6,     // ceiling on output per unit of exergy

    /* ---- demography: UN WPP 2024 shape -------------------------------- */
    pop0: 8.2,             // billions, 2024
    popGrowth0: 0.008,     // current global growth rate per year
    peakYear: 2084,        // UN medium variant peak
    waShare0: 0.635,       // working-age share of population
    waShareEnd: 0.55,      // by 2126, as median age rises
    participation0: 0.63,  // labour force / working-age population
    participationEnd: 0.56,

    /* ---- compute: Epoch AI measurements ------------------------------- */
    computeGrowth: 5.0,        // x/yr, training compute since 2020 (Epoch)
    algoGrowth: 2.6,           // x/yr, algorithmic efficiency
    flopPerJouleGrowth: 1.34,  // x/yr, FLOP/s per watt (Epoch, since 2008)
    elecGrowth: 1.02,          // x/yr, global electricity generation
    computeElecShare: 0.25,    // share of world electricity we are willing to give compute
    capScale: 6.5,             // OOM of effective compute to approach the ceiling

    /* ---- automation and tasks (Acemoglu-Restrepo) --------------------- */
    alpha0: 0.33,          // baseline capital share
    alphaMax: 0.95,        // capital share at near-full automation
    sigma: 0.8,            // elasticity of substitution (A&R calibration; <=1 = complements)
    autoCeiling: 0.95,     // max automatable share of the task space
    autoLag: 14,           // years for deployment to halve the gap
    reinstatement: 0.5,    // strength of new-task creation (0 = valve closed)
    taskSaturation: 0.6,   // how far the task space can grow before reinstatement dulls
    rndFeedback: 0.8,      // automated R&D accelerating technology growth
    gA0: 0.02,             // baseline TFP growth before any AI contribution

    /* ---- labour market and demand ------------------------------------- */
    wageFlex: 0.45,        // 1 = wages absorb everything, 0 = employment does
    cProp: 0.81,           // share of wage income consumed (calibrated so demand closes at t=0)
    capitalToHouseholds: 0.35,  // share of capital income reaching household budgets
    capitalMPC: 0.40,      // capital income is concentrated and saved
    transfers: 0.0,        // transfer programme, as share of output
    invRate: 0.25,         // investment share of output
    govShare: 0.17,
    nxShare: 0.0,
    demandFeedback: 0.55,  // how strongly a demand gap feeds back into employment

    /* ---- valuation ----------------------------------------------------- */
    discountRate: 0.03,    // central; levers expose Stern 0.014 to Nordhaus 0.043
    equityEarningsShare: 0.6,  // share of capital income accruing to listed equity
    terminalMultiple: 18   // exit multiple at the end of the horizon
  };

  var LEVER_GROUPS = [
    {
      title: "Energy & physical limits",
      blurb: "The brake nobody models. Sustained compute growth above electricity growth x efficiency growth is impossible, whatever the algorithms do.",
      levers: [
        { key: "elecGrowth", label: "World electricity growth", min: 1.0, max: 1.06, step: 0.002, fmt: "x", suffix: "/yr" },
        { key: "flopPerJouleGrowth", label: "Compute per joule", min: 1.0, max: 2.0, step: 0.01, fmt: "x", suffix: "/yr" },
        { key: "computeElecShare", label: "Electricity we give compute", min: 0.02, max: 0.5, step: 0.01, fmt: "pct" }
      ]
    },
    {
      title: "Technology",
      blurb: "Epoch AI's measured trends. Note that raising these mostly buys time before the power ceiling binds, not a different century.",
      levers: [
        { key: "computeGrowth", label: "Training compute growth", min: 1.2, max: 8, step: 0.1, fmt: "x", suffix: "/yr" },
        { key: "algoGrowth", label: "Algorithmic efficiency", min: 1.0, max: 10, step: 0.1, fmt: "x", suffix: "/yr" },
        { key: "capScale", label: "OOM of compute to reach ceiling", min: 2, max: 12, step: 0.1, fmt: "x" },
        { key: "gA0", label: "Baseline TFP growth", min: 0.002, max: 0.05, step: 0.001, fmt: "pct" },
        { key: "rndFeedback", label: "Automated R&D feedback", min: 0, max: 2, step: 0.05, fmt: "x" }
      ]
    },
    {
      title: "Automation & tasks",
      blurb: "The contested core. Capability is not the question; whether new tasks keep being created is.",
      levers: [
        { key: "alpha0", label: "Capital share today", min: 0.2, max: 0.45, step: 0.01, fmt: "pct" },
        { key: "alphaMax", label: "Capital share at full automation", min: 0.5, max: 0.98, step: 0.01, fmt: "pct" },
        { key: "sigma", label: "Capital-labour substitution", min: 0.2, max: 3.0, step: 0.05, fmt: "x" },
        { key: "autoCeiling", label: "Automatable share of tasks", min: 0.4, max: 1.0, step: 0.01, fmt: "pct" },
        { key: "autoLag", label: "Deployment lag", min: 2, max: 40, step: 1, fmt: "yr" },
        { key: "reinstatement", label: "New-task creation", min: 0, max: 1.5, step: 0.05, fmt: "x" },
        { key: "taskSaturation", label: "Task-space saturation", min: 0.2, max: 1.0, step: 0.05, fmt: "pct" }
      ]
    },
    {
      title: "Distribution & demand",
      blurb: "Wages are the consumer's budget. If capital income does not circulate, capacity and prosperity diverge.",
      levers: [
        { key: "wageFlex", label: "Wage flexibility", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "capitalToHouseholds", label: "Capital income to households", min: 0, max: 1, step: 0.01, fmt: "pct" },
        { key: "capitalMPC", label: "Spending out of capital income", min: 0.1, max: 1, step: 0.01, fmt: "pct" },
        { key: "transfers", label: "Transfer / dividend programme", min: 0, max: 0.5, step: 0.01, fmt: "pct" },
        { key: "demandFeedback", label: "Demand gap to employment", min: 0, max: 1, step: 0.01, fmt: "pct" }
      ]
    },
    {
      title: "Demography",
      blurb: "UN WPP 2024: population peaks around 2084, the working-age share falls, and 63 countries have already peaked.",
      levers: [
        { key: "popGrowth0", label: "Population growth today", min: 0.0, max: 0.015, step: 0.001, fmt: "pct" },
        { key: "peakYear", label: "Peak population year", min: 2030, max: 2110, step: 1, fmt: "yr" },
        { key: "waShareEnd", label: "Working-age share by 2126", min: 0.42, max: 0.65, step: 0.01, fmt: "pct" },
        { key: "participationEnd", label: "Participation by 2126", min: 0.4, max: 0.75, step: 0.01, fmt: "pct" }
      ]
    },
    {
      title: "Deep time",
      blurb: "Only matters past ~2200, and stops being economics: how much exergy the civilisation can capture, and how much value a joule can carry before thermodynamics forbids it. These set where exponential growth ends.",
      levers: [
        { key: "energyFrontier", label: "Accessible power growth", min: 1.0, max: 1.05, step: 0.001, fmt: "x", suffix: "/yr" },
        { key: "energyProductivityGrowth", label: "Output per unit of exergy", min: 1.0, max: 1.4, step: 0.01, fmt: "x", suffix: "/yr" },
        { key: "energyProductivityMax", label: "Exergy productivity ceiling", min: 10, max: 1e9, step: 10, fmt: "mult" },
        { key: "popFloor", label: "Post-transition population", min: 0.5, max: 12, step: 0.1, fmt: "bn" }
      ]
    },
    {
      title: "Valuation",
      blurb: "At a century the discount rate is an ethical choice, not a fact: it swings present value by more than an order of magnitude.",
      levers: [
        { key: "discountRate", label: "Discount rate", min: 0.005, max: 0.06, step: 0.001, fmt: "pct" },
        { key: "equityEarningsShare", label: "Capital income in listed equity", min: 0.2, max: 1, step: 0.01, fmt: "pct" },
        { key: "terminalMultiple", label: "Terminal earnings multiple", min: 8, max: 30, step: 0.5, fmt: "x" }
      ]
    }
  ];

  var PRESETS = [
    { id: "reference", name: "Reference",
      blurb: "Measured trends, contested task creation at a moderate setting.",
      patch: {} },
    { id: "powerbound", name: "Power-bound",
      blurb: "Compute gets only today's electricity share and efficiency improves slowly. The wall arrives early.",
      patch: { computeElecShare: 0.03, flopPerJouleGrowth: 1.12, elecGrowth: 1.012 } },
    { id: "efficiency", name: "Chip efficiency breakout",
      blurb: "Compute per joule keeps doubling every 18 months for a century. Landauer is still far away.",
      patch: { flopPerJouleGrowth: 1.60, computeElecShare: 0.35 } },
    { id: "valveclosed", name: "New-task valve closes",
      blurb: "Trammell-Korinek's case: once machines replicate the underlying capabilities, no new human tasks are created.",
      patch: { reinstatement: 0.0, sigma: 1.6 } },
    { id: "valveopen", name: "New tasks keep pace",
      blurb: "Acemoglu-Restrepo's historical case: reinstatement matches displacement, roughly as it did until the 1980s.",
      patch: { reinstatement: 1.3, taskSaturation: 0.9 } },
    { id: "circulate", name: "Gains circulate",
      blurb: "Broad ownership and transfers: capital income reaches household budgets.",
      patch: { capitalToHouseholds: 0.85, transfers: 0.18, capitalMPC: 0.75 } },
    { id: "capitalboom", name: "Capital boom, no circulation",
      blurb: "Capacity soars, labour share collapses, and demand cannot keep up with output.",
      patch: { capitalToHouseholds: 0.12, transfers: 0.0, capitalMPC: 0.25 } },
    { id: "slow", name: "Slow deployment",
      blurb: "Capability races ahead of the institutions that would deploy it.",
      patch: { autoLag: 30, autoCeiling: 0.6 } }
  ];

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  var ELEC0_TWH = 30000;           // world electricity generation, TWh/yr
  var COMPUTE_BASE_SHARE = 0.015;  // data centre share of electricity today
  var Y0 = 110;                    // world output, $T
  var LF0 = 3300;                  // world labour force, millions
  var K0 = Y0 * 0.33 / 0.08;       // capital stock, K/Y ~ 4
  var STRUCTURAL_UNEMP = 0.07;     // frictional plus structural floor, today's global rate

  /* Physical ladder. Order-of-magnitude ceilings, used for dating the
     crossings rather than for precision. */
  var POWER0_TW = 20;              // world primary energy today
  var GDP_PER_TW = Y0 / POWER0_TW; // $T of output per TW, today
  var EARTH_SOLAR_TW = 1.74e5;     // sunlight intercepted by Earth
  var SOLAR_SYSTEM_TW = 3.8e14;    // solar luminosity
  var GALAXY_TW = 7.6e25;          // Milky Way luminosity
  var UNIVERSE_TW = 1e37;          // starlight, observable universe (order of magnitude)

  /* Horizon presets. 100 years stays the default and the economic frame;
     anything longer is explicitly labelled a physics extrapolation. */
  var HORIZONS = [
    { years: 100, name: "2126", note: "the economic horizon" },
    { years: 250, name: "2276", note: "institutions and demography" },
    { years: 1000, name: "3026", note: "physical limits start to bind" },
    { years: 7974, name: "10,000 CE", note: "deep time" }
  ];

  /* ------------------------------------------------------------- simulation */
  function simulate(p) {
    var N = Math.round(p.horizon);
    var t, i;

    var peakIn = Math.max(1, p.peakYear - p.startYear);
    var slope = p.popGrowth0 / peakIn;
    /* Transitions that belong to institutional time, not to the horizon.
       Stretching them over 8,000 years was the bug that made long runs
       meaningless; scaling them with the horizon made the same year differ
       between a 100-year and a 250-year run, which is worse. They are fixed
       at a century, so lengthening the horizon never rewrites the past. */
    var transYears = 100;

    function popAt(y) {
      var raw = p.pop0 * Math.exp(p.popGrowth0 * y - 0.5 * slope * y * y);
      return Math.max(p.popFloor, raw);
    }
    function labourForce(y) {
      var f = clamp(y / transYears, 0, 1);
      var wa = p.waShare0 + (p.waShareEnd - p.waShare0) * f;
      var pr = p.participation0 + (p.participationEnd - p.participation0) * f;
      return popAt(y) * 1000 * wa * pr;
    }

    var K = K0;
    var A = 1;
    var auto = 0.02;
    var newTasks = 0;
    var logCompute = 0;
    var empRateRef = null;
    var powerBindYear = -1;
    var saturateYear = -1;
    var earthCross = -1, systemCross = -1, galaxyCross = -1;

    var out = {
      years: [], pop: [], labourForce: [], employment: [], unemp: [], gdp: [], gdpPerCap: [],
      gdpPotential: [], outputGap: [], laborShare: [], autoShare: [], newTaskShare: [],
      compute: [], computeCeiling: [], elecShareUsed: [], growth: [], wage: [], consumption: [],
      capitalShare: [], powerBound: [], investment: [], equityEarnings: [], cap: [],
      power: [], outputCeiling: [], exergyProd: [], saturated: []
    };

    var prevY = null;

    for (t = 0; t <= N; t++) {
      var y = t;

      /* --- compute, bounded by electricity -----------------------------
         The ceiling is the compute that the target electricity share could
         power, in units of today's compute. It grows with generation and
         with compute per joule. That product (~1.37x/yr) is the real
         long-run limit on how fast compute can grow.                       */
      /* All of this is done in log10 because over 8,000 years the raw
         quantities overflow: 1.34^8000 is around 10^1019. Log space is
         algebraically identical and never overflows.                     */
      var logElec = Math.log10(ELEC0_TWH) + y * Math.log10(p.elecGrowth);
      var logCeiling = logElec + Math.log10(p.computeElecShare)
        - Math.log10(ELEC0_TWH * COMPUTE_BASE_SHARE)
        + y * Math.log10(p.flopPerJouleGrowth);

      if (t > 0) {
        logCompute = Math.min(logCompute + Math.log10(p.computeGrowth), logCeiling);
        if (logCompute >= logCeiling - 0.002 && powerBindYear < 0) powerBindYear = y;
      }
      var powerBound = t > 0 && logCompute >= logCeiling - 0.002;
      var compute = Math.pow(10, Math.min(logCompute, 300));

      /* --- accessible exergy and the physical ceiling on real output ---
         Order of magnitude, and it only binds in the far future. At 2026 it
         reproduces today's $110T exactly, so it is inert over the economic
         horizon unless the economy genuinely outgrows its energy supply. */
      var power = Math.min(POWER0_TW * Math.pow(p.energyFrontier, y), UNIVERSE_TW);
      var exergyProd = Math.min(p.energyProductivityMax, Math.pow(p.energyProductivityGrowth, y));
      var Ycap = power * GDP_PER_TW * exergyProd;

      if (earthCross < 0 && power >= EARTH_SOLAR_TW) earthCross = y;
      if (systemCross < 0 && power >= SOLAR_SYSTEM_TW) systemCross = y;
      if (galaxyCross < 0 && power >= GALAXY_TW) galaxyCross = y;

      /* --- capability: saturating function of effective compute -------- */
      var om = logCompute;
      var cap = clamp(1 - Math.exp(-om / p.capScale), 0, 1);

      /* --- deployment -------------------------------------------------- */
      var autoTarget = Math.min(p.autoCeiling, p.autoCeiling * sigmoid((cap - 0.55) / 0.10));
      var adj = 1 - Math.exp(-1 / p.autoLag);
      auto = Math.max(auto, auto + (autoTarget - auto) * adj);

      /* --- new task creation (Acemoglu-Restrepo reinstatement) ---------
         Historically self-stabilising: as labour becomes cheap relative to
         capital, creating new tasks in which labour has a comparative
         advantage becomes more profitable. Whether that survives machines
         replicating the underlying human capabilities is the open question. */
      var capEffPre = p.alpha0 + (p.alphaMax - p.alpha0) * auto;
      var labourPress = clamp((capEffPre - p.alpha0) / Math.max(0.02, p.alphaMax - p.alpha0), 0, 1);
      var satur = clamp(1 - newTasks / Math.max(0.05, p.taskSaturation), 0, 1);
      newTasks = clamp(newTasks + p.reinstatement * labourPress * satur * auto * 0.05, 0, p.alphaMax);

      /* --- effective capital share ------------------------------------- */
      var shareGain = (p.alphaMax - p.alpha0) * clamp(p.sigma / (1 + p.sigma), 0, 1);
      var autoNet = clamp(auto - newTasks, 0, 1);
      var alphaEff = clamp(p.alpha0 + shareGain * autoNet, p.alpha0, 0.985);
      var laborShare = 1 - alphaEff;

      /* --- technology growth and Trammell-Korinek amplification -------- */
      var gA = p.gA0 * (1 + p.rndFeedback * auto);
      var gY = clamp(gA / Math.max(0.015, 1 - alphaEff), -0.05, 0.35);

      /* --- labour force and employment --------------------------------- */
      var LF = labourForce(y);
      var empRate = clamp((1 - STRUCTURAL_UNEMP) * Math.pow(laborShare / (1 - p.alpha0), 1 - p.wageFlex), 0.08, 1 - STRUCTURAL_UNEMP);
      if (empRateRef === null) empRateRef = empRate;

      /* --- potential output --------------------------------------------
         Capacity is the smaller of what the technology and labour force
         allow and what the available exergy can actually drive. Over the
         economic horizon the second term is inert; over deep time it is the
         only thing that matters.                                        */
      var L_eff = LF * empRate;
      var YpotTech = Y0 * A
        * Math.pow(K / K0, alphaEff)
        * Math.pow(Math.max(0.02, (L_eff / LF0) / empRateRef), 1 - alphaEff);
      var Ypot = Math.min(YpotTech, Ycap);
      if (saturateYear < 0 && YpotTech > Ycap * 1.0005 && y > 1) saturateYear = y;

      /* --- demand ------------------------------------------------------ */
      var wageBill = laborShare * Ypot;
      var capitalIncome = alphaEff * Ypot;
      var consumption = p.cProp * wageBill
        + p.capitalToHouseholds * capitalIncome * p.capitalMPC
        + p.transfers * Ypot;
      var investment = p.invRate * Ypot;
      var govt = p.govShare * Ypot;
      var Ydemand = consumption + investment + govt + p.nxShare * Ypot;

      var Y = Math.min(Ypot, Ydemand);
      var outputGap = Ypot > 0 ? clamp(1 - Y / Ypot, 0, 1) : 0;

      /* --- demand gap feeds back into employment ----------------------- */
      if (outputGap > 0.002) {
        empRate = clamp(empRate * (1 - p.demandFeedback * outputGap), 0.05, 1 - STRUCTURAL_UNEMP);
        L_eff = LF * empRate;
        YpotTech = Y0 * A * Math.pow(K / K0, alphaEff)
          * Math.pow(Math.max(0.02, (L_eff / LF0) / empRateRef), 1 - alphaEff);
        Ypot = Math.min(YpotTech, Ycap);
        wageBill = laborShare * Ypot;
        capitalIncome = alphaEff * Ypot;
        consumption = p.cProp * wageBill
          + p.capitalToHouseholds * capitalIncome * p.capitalMPC + p.transfers * Ypot;
        investment = p.invRate * Ypot;
        govt = p.govShare * Ypot;
        Ydemand = consumption + investment + govt + p.nxShare * Ypot;
        Y = Math.min(Ypot, Ydemand);
        outputGap = Ypot > 0 ? clamp(1 - Y / Ypot, 0, 1) : 0;
      }

      /* --- capital accumulation ---------------------------------------- */
      var depreciation = 0.05;
      K = Math.max(0.2 * K0, K * (1 - depreciation) + investment);
      /* A is capped rather than allowed to run to 1e170: past the point where
         the exergy ceiling binds it no longer affects anything, and an
         infinite TFP produces NaNs further down. */
      A = Math.min(1e30, A * (1 + gA));

      /* --- record ------------------------------------------------------ */
      var employed = L_eff;
      var unemp = LF > 0 ? clamp(1 - employed / LF, 0, 0.95) : 0;
      var earnings = alphaEff * Y * p.equityEarningsShare * 1000;   // $bn

      out.years.push(p.startYear + y);
      out.pop.push(popAt(y));
      out.labourForce.push(LF);
      out.employment.push(employed);
      out.unemp.push(unemp);
      out.gdp.push(Y);
      out.gdpPotential.push(Ypot);
      out.outputGap.push(outputGap);
      out.gdpPerCap.push(Y * 1000 / (popAt(y) * 1000));
      out.laborShare.push(laborShare);
      out.autoShare.push(auto);
      out.newTaskShare.push(newTasks);
      out.compute.push(logCompute);
      out.computeCeiling.push(logCeiling);
      out.elecShareUsed.push(Math.min(p.computeElecShare,
        Math.pow(10, Math.log10(COMPUTE_BASE_SHARE) + logCompute - y * Math.log10(p.elecGrowth))));
      out.power.push(power);
      out.outputCeiling.push(Ycap);
      out.exergyProd.push(exergyProd);
      out.saturated.push(YpotTech > Ycap ? 1 : 0);
      out.growth.push(prevY === null ? 0.02 : Y / Math.max(1e-6, prevY) - 1);
      out.wage.push(employed > 0 ? wageBill / employed * 1000 : 0);   // $k per worker-year
      out.consumption.push(consumption);
      out.capitalShare.push(alphaEff);
      out.powerBound.push(powerBound ? 1 : 0);
      out.investment.push(investment);
      out.equityEarnings.push(earnings);
      out.cap.push(cap);
      prevY = Y;
    }

    /* --- present value at three discount rates -------------------------- */
    var pv = 0, pvStern = 0, pvNordhaus = 0;
    for (i = 1; i <= N; i++) {
      pv += out.equityEarnings[i] / Math.pow(1 + p.discountRate, i);
      pvStern += out.equityEarnings[i] / Math.pow(1 + 0.014, i);
      pvNordhaus += out.equityEarnings[i] / Math.pow(1 + 0.043, i);
    }
    var terminal = out.equityEarnings[N] * p.terminalMultiple;
    pv += terminal / Math.pow(1 + p.discountRate, N);
    pvStern += terminal / Math.pow(1 + 0.014, N);
    pvNordhaus += terminal / Math.pow(1 + 0.043, N);

    var last = N;
    var termWindow = Math.min(25, N);
    var termGrowth = N > 0
      ? Math.pow(Math.max(1e-9, out.gdp[last] / Math.max(1e-9, out.gdp[last - termWindow])), 1 / termWindow) - 1
      : 0;

    return {
      years: out.years,
      series: out,
      powerBindYear: powerBindYear,
      saturateYear: saturateYear,
      crossEarth: earthCross,
      crossSystem: systemCross,
      crossGalaxy: galaxyCross,
      terminalGrowth: termGrowth,
      final: {
        gdp: out.gdp[last],
        gdpPerCap: out.gdpPerCap[last],
        gdpPerCapCAGR: Math.pow(Math.max(1e-6, out.gdpPerCap[last] / Math.max(1e-6, out.gdpPerCap[0])), 1 / N) - 1,
        pop: out.pop[last],
        laborShare: out.laborShare[last],
        laborShare0: out.laborShare[0],
        unemp: out.unemp[last],
        autoShare: out.autoShare[last],
        newTaskShare: out.newTaskShare[last],
        outputGap: out.outputGap[last],
        compute: out.compute[last],
        computeCeiling: out.computeCeiling[last],
        capitalShare: out.capitalShare[last],
        power: out.power[last],
        outputCeiling: out.outputCeiling[last],
        exergyProd: out.exergyProd[last],
        saturated: out.saturated[last] === 1,
        pv: pv, pvStern: pvStern, pvNordhaus: pvNordhaus,
        discountSwing: pvNordhaus > 0 ? pvStern / pvNordhaus : 0
      },
      /* Two regimes, because they answer different questions. "landing" is
         how the AI transition resolves as an economic event, always measured
         over the first century so it is comparable across horizons; at 10,000
         CE every path is a plateau by construction and the landing taxonomy
         would carry no information. "terminal" is where it ends up. */
      regime: classify(out, Math.min(N, 100), undefined),
      terminalRegime: classify(out, N, termGrowth)
    };
  }

  /* ------------------------------------------------------------------ regimes */
  function classify(r, N, termGrowth) {
    var gdpPcRatio = r.gdpPerCap[N] / Math.max(1e-6, r.gdpPerCap[0]);
    var ls = r.laborShare[N];
    var gap = r.outputGap[N];
    var unemp = r.unemp[N];

    /* The physics, not the economics, is the binding constraint. Growth has
       stopped because the exergy is exhausted, and no arrangement of
       institutions changes that. */
    if (r.saturated[N] === 1 && (termGrowth === undefined || termGrowth < 0.01)) {
      return { id: "plateau", name: "Thermodynamic plateau",
        blurb: "Output has run into the energy the civilisation can capture. Growth stops not because demand or technology failed but because the joules ran out. Everything after that date is level." };
    }
    if (gap > 0.12) {
      return { id: "demandbound", name: "Demand-bound",
        blurb: "Capacity runs ahead of purchasing power. Output is limited by who can afford to buy it, not by what can be produced." };
    }
    if (gdpPcRatio < 2.0) {
      return { id: "stall", name: "Stagnation",
        blurb: "The century delivers little growth: deployment, energy or demand stop the frontier from mattering." };
    }
    if (ls < 0.35) {
      return { id: "capitalist", name: "Capital-only boom",
        blurb: "Demand holds because gains circulate through capital income, but labour has lost its claim: prosperity accrues to owners of capital." };
    }
    if (unemp > 0.18) {
      return { id: "jobless", name: "Jobless abundance",
        blurb: "Plenty is produced and demand roughly holds, but a large minority of people are not needed to produce it. GDP per person is a poor summary of who benefits." };
    }
    if (ls < 0.45) {
      return { id: "uneven", name: "Uneven abundance",
        blurb: "High output, a materially reduced labour share, no acute demand failure. Managed but distributional." };
    }
    return { id: "broad", name: "Broad growth",
      blurb: "Output per person multiplies while labour retains a meaningful claim on income. The benign path." };
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
    runs = runs || 160;
    var rnd = mulberry32(21260101);
    var store = { gdpPerCap: [], laborShare: [], unemp: [], gdp: [] };
    var regimes = {}, powerYears = [], satYears = [], i, k, key;
    var N = Math.round(base.horizon);

    for (k = 0; k < runs; k++) {
      var p = {};
      for (key in base) p[key] = base[key];
      p.algoGrowth = clamp(base.algoGrowth * Math.exp((rnd() - 0.5) * 1.1), 1.0, 14);
      p.computeGrowth = clamp(base.computeGrowth * Math.exp((rnd() - 0.5) * 0.5), 1.2, 10);
      p.autoCeiling = clamp(base.autoCeiling * (0.85 + rnd() * 0.2), 0.3, 1);

      /* Substitution and reinstatement are not independent draws. They are the
         two sides of one question: can machines do what humans do? If capital
         genuinely substitutes for labour, creating tasks in which labour has a
         comparative advantage gets harder at the same time. Drawing them
         independently suppresses exactly the joint outcome that matters most,
         so a shared latent drives both. */
      var substitutability = rnd();
      p.sigma = clamp(0.3 + substitutability * 2.7, 0.25, 3);
      p.reinstatement = clamp(base.reinstatement * (1.45 - substitutability * 1.25) * (0.75 + rnd() * 0.55), 0, 1.5);
      // the dominant century-scale uncertainty is plain TFP growth, not AI:
      p.gA0 = clamp(base.gA0 * (0.55 + rnd() * 1.35), 0.002, 0.05);
      p.rndFeedback = clamp(base.rndFeedback * (0.2 + rnd() * 1.6), 0, 2);
      p.capitalToHouseholds = clamp(base.capitalToHouseholds * (0.35 + rnd() * 1.5), 0, 1);
      p.elecGrowth = clamp(base.elecGrowth * (0.997 + rnd() * 0.012), 1.0, 1.06);
      p.flopPerJouleGrowth = clamp(base.flopPerJouleGrowth * (0.94 + rnd() * 0.13), 1.0, 2);
      p.alphaMax = clamp(base.alphaMax * (0.9 + rnd() * 0.12), 0.4, 0.98);
      p.peakYear = clamp(base.peakYear + (rnd() - 0.5) * 40, 2030, 2110);
      p.energyFrontier = clamp(base.energyFrontier * (0.985 + rnd() * 0.035), 1.0, 1.05);
      p.energyProductivityGrowth = clamp(base.energyProductivityGrowth * (0.85 + rnd() * 0.4), 1.0, 1.4);
      p.energyProductivityMax = clamp(base.energyProductivityMax * Math.pow(10, (rnd() - 0.5) * 2), 10, 1e9);
      p.popFloor = clamp(base.popFloor * (0.5 + rnd() * 1.4), 0.3, 14);

      var r = simulate(p);
      store.gdpPerCap.push(r.series.gdpPerCap);
      store.laborShare.push(r.series.laborShare);
      store.unemp.push(r.series.unemp);
      store.gdp.push(r.series.gdp);
      regimes[r.regime.id] = (regimes[r.regime.id] || 0) + 1;
      if (r.powerBindYear >= 0) powerYears.push(r.powerBindYear);
      if (r.saturateYear >= 0) satYears.push(r.saturateYear);
    }
    powerYears.sort(function (a, b) { return a - b; });
    satYears.sort(function (a, b) { return a - b; });

    function band(keyName) {
      var rows = store[keyName], n = rows.length, m = rows[0].length;
      var res = { p10: [], p25: [], p50: [], p75: [], p90: [] };
      for (i = 0; i < m; i++) {
        var col = [];
        for (k = 0; k < n; k++) col.push(rows[k][i]);
        col.sort(function (a, b) { return a - b; });
        function q(f) { return col[Math.floor(clamp(f, 0, 1) * (col.length - 1))]; }
        res.p10.push(q(0.10)); res.p25.push(q(0.25)); res.p50.push(q(0.5));
        res.p75.push(q(0.75)); res.p90.push(q(0.9));
      }
      return res;
    }

    var freq = [];
    for (var rid in regimes) freq.push({ id: rid, n: regimes[rid], share: regimes[rid] / runs });
    freq.sort(function (a, b) { return b.n - a.n; });

    return {
      runs: runs,
      gdpPerCap: band("gdpPerCap"),
      laborShare: band("laborShare"),
      unemp: band("unemp"),
      gdp: band("gdp"),
      regimes: freq,
      medianPowerBindYear: powerYears.length ? powerYears[Math.floor(powerYears.length / 2)] : -1,
      powerBoundShare: powerYears.length / runs,
      medianSaturateYear: satYears.length ? satYears[Math.floor(satYears.length / 2)] : -1,
      saturateShare: satYears.length / runs
    };
  }

  return {
    DEFAULTS: DEFAULTS, LEVER_GROUPS: LEVER_GROUPS, PRESETS: PRESETS, HORIZONS: HORIZONS,
    simulate: simulate, monteCarlo: monteCarlo, classify: classify, clamp: clamp,
    LIMITS: { EARTH_SOLAR_TW: EARTH_SOLAR_TW, SOLAR_SYSTEM_TW: SOLAR_SYSTEM_TW,
      GALAXY_TW: GALAXY_TW, UNIVERSE_TW: UNIVERSE_TW, POWER0_TW: POWER0_TW }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = CENTURY;
