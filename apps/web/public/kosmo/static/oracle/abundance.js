/* ============================================================================
   abundance.js — can a low-employment economy still guarantee the basics?

   Four ledgers, solved together, one year at a time, 2026–2100.

     LABOUR    jobs destroyed by automation, created by new tasks, guaranteed
               by the state
     FISCAL    four tax bases, five guarantees, one debt stock
     HOUSEHOLD wages + capital income + transfers -> consumption + saving
     PHYSICAL  housing units, health spending, clinicians

   The point is that the binding constraint is not capability. It is that the
   income-tax base IS the wage bill, so the base shrinks exactly when the bill
   for the guarantees grows. What survives that squeeze is ownership: a
   sovereign fund holding a share of the capital stock, paying a dividend.

   Everything is in real 2026 dollars. Money in $B, people in millions.
   ============================================================================ */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------- inputs */

  var DEFAULTS = {
    years: 74,                 // 2026 -> 2100

    /* the automation path */
    zMax: 0.70,                // task share done by machines at saturation
    zMid: 24,                  // year of fastest displacement (years after 2026)
    zSteep: 0.17,              // logistic steepness
    exposure: 0.45,            // share of private employment exposed (measured)
    reabsorb: 0.055,           // new-task jobs created per year per displaced worker
    reabsorbDecay: 0.55,       // how fast new-task creation decays with capability
    autoProd: 0.052,           // productivity lift at full automation penetration
    baseProd: 0.012,           // underlying TFP growth
    jgOutput: 0.45,            // share of public-job wages that is real output

    /* the five guarantees */
    ubiMonthly: 1100,          // $ per adult per month, in 2026 dollars
    ubiIndex: 1.0,             // how much the payment keeps pace with productivity
    ubiStart: 1,               // year index the payment starts
    ubiPhaseIn: 6,             // years to full value
    publicShare: 0.62,         // share of health spending the state pays
    healthShare0: 0.166,       // health spending / GDP today (measured)
    healthInfl: 0.010,         // excess growth of health spend over GDP
    healthCoverage: 1.0,       // 1.0 = everyone covered
    healthCap: 0.34,           // rationing binds above this share of GDP
    housingRate: 0.13,         // share of the adequacy gap built per year
    jgTakeup: 0.55,            // share of long-term displaced offered a public job
    jgCap: 0.09,               // public-job ceiling, share of adults
    jgWage: 0.75,              // public-job wage relative to the private average
    savingsBond: 10,           // $k citizen account at 18

    /* the tax system */
    tauL: 0.32,                // effective tax on labour income
    tauK: 0.34,                // effective tax on net capital income
    tauV: 0.12,                // consumption tax
    tauLand: 0.045,            // land value tax
    tauCarbon: 120,            // $ per tonne CO2
    tauWealth: 0.012,          // annual tax on top-decile net worth
    fundContribution: 0.50,    // share of capital-side revenue paid into the fund
    fundCap: 0.55,             // ceiling on the fund's share of the capital stock
    fundPayout: 0.85,          // share of fund income paid out as dividend
    debtCeiling: 1.45,         // debt/GDP at which the closure rule binds

    /* behaviour */
    mpc: 0.90,                 // marginal propensity to consume
    dwlCoef: 2.2,              // deadweight-loss coefficient
    taxCeiling: 0.34           // revenue share above which DWL starts to bite
  };

  var PRESETS = [
    { id: "managed", name: "Managed transition", note: "Tax, build the fund, sequence the guarantees", patch: {} },
    { id: "status", name: "2026 policy", note: "Today's taxes, no UBI, no job guarantee", patch: {
      ubiMonthly: 0, tauL: 0.25, tauK: 0.19, tauV: 0.06, tauLand: 0.023,
      tauWealth: 0, tauCarbon: 60, fundContribution: 0.05, publicShare: 0.44,
      housingRate: 0.03, jgTakeup: 0.10, jgCap: 0.02, savingsBond: 0 } },
    { id: "deficit", name: "UBI on the deficit", note: "Generous, unfunded — watch the debt", patch: {
      ubiMonthly: 1500, tauL: 0.25, tauK: 0.19, tauV: 0.06, tauLand: 0.023,
      tauWealth: 0, fundContribution: 0.08, publicShare: 0.85, housingRate: 0.12 } },
    { id: "fund", name: "Fund first", note: "Buy the capital before the wage base goes", patch: {
      ubiMonthly: 500, tauK: 0.40, tauLand: 0.055, tauWealth: 0.02, tauV: 0.10,
      fundContribution: 0.90, fundCap: 0.65, publicShare: 0.70, housingRate: 0.12,
      ubiStart: 8, ubiPhaseIn: 14 } },
    { id: "care", name: "Care economy", note: "The job guarantee as the main lever", patch: {
      ubiMonthly: 500, jgTakeup: 0.95, jgCap: 0.22, jgWage: 0.85, tauL: 0.34,
      publicShare: 0.85, housingRate: 0.16, fundContribution: 0.35, jgOutput: 0.60 } },
    { id: "slow", name: "Slow automation", note: "The capability curve flattens", patch: {
      zMax: 0.38, zMid: 36, ubiMonthly: 450, tauK: 0.26, fundContribution: 0.30,
      jgTakeup: 0.35 } }
  ];

  /* ------------------------------------------------------------- anchors */
  /* Measured values for 2026, used to make the model reproduce the actual
     economy at t=0. The calibration table in the app prints the residuals. */
  var BASE = {
    gdp: 30000,             // $B
    pop: 342,               // millions
    adults: 262,            // millions, 16+
    households: 132,        // millions
    labourForce: 166,       // millions
    participation: 0.633,   // labour force / adults
    empPrivate: 141,        // millions
    empPublic: 22,          // millions
    sigma0: 0.58,           // compensation share of GDP
    sigmaFloor: 0.20,       // labour share when automation saturates
    kOverY: 3.0,            // net capital stock / GDP
    depreciation: 0.04,     // annual capital consumption rate
    thetaH: 0.85,           // share of domestic capital income reaching households
    landValue: 1.10,        // land value / GDP
    topWealth: 2.20,        // top-decile net worth / GDP
    emissions: 5.0,         // Gt CO2 per year
    healthPc: 14600,        // $ per person per year, all payers
    unitsAdequate: 0.94,    // share of households adequately housed today
    costPerUnit: 420000,    // $ per social-housing unit
    constructionCap: 0.013, // residential construction ceiling, share of GDP
    legacyTransfers: 0.125, // Social Security, Medicare, UI etc / GDP
    otherGovt: 0.060,       // non-health government consumption / GDP
    publicInvest: 0.030,    // public investment / GDP
    netExports: -0.033,     // net exports / GDP
    investRate: 0.200,      // gross private investment / GDP
    debt0: 1.00,            // gross public debt / GDP
    realRate: 0.022,        // real rate on public debt
    govRev0: 0.272,         // total government revenue / GDP (measured)
    fundFlowCap: 0.035,     // ceiling on annual payments into the fund, share of GDP
    householdsPerAdult: 0.503
  };

  /* ------------------------------------------------------------------ run */

  function run(input) {
    var s = {}, k;
    for (k in DEFAULTS) s[k] = (input && input[k] != null) ? input[k] : DEFAULTS[k];
    var N = Math.round(s.years);

    /* --- state --- */
    var Y = BASE.gdp;
    var pop = BASE.pop, adults = BASE.adults, households = BASE.households;
    var empPrivate = BASE.empPrivate, empPublic = BASE.empPublic, empJG = 0;
    var displacedCum = 0;
    var sigma = BASE.sigma0;
    var K = BASE.kOverY * Y;
    var F = 0.02 * K;                    // sovereign fund assets
    var D = BASE.debt0 * Y;
    var adequateUnits = BASE.households * BASE.unitsAdequate;
    var cOverY = 0.66;
    var zPrev = 0, gProd = s.baseProd, gY = 0.021;
    var inflationState = 0, pressure = 0, healthIndex = 1, prodIndex = 1;
    var restructured = null, slackPrev = 0, nonEmpPrev = 0.378;

    var series = {};
    ["year","output","outputPc","sigma","employment","unemployment","nonEmployment",
     "wag","capitalHH","ubi","dividend","legacy","revenue","spending","debt","deficit",
     "inflation","demand","supply","slack","fund","fundShare","fundPerAdult","wageBill",
     "revL","revK","revV","revLand","revC","revW","revTotal","empPrivate","empPublic",
     "empJG","jgCost","health","healthGov","housing","bundle","bundleShare","covHousing",
     "covHealth","covSavings","covJob","adequacy","fundCover","dwl","transferPerAdult",      "disposable","payout","wagePerWorker","fundDivShare","healthPerCapita","debtService",
     "interestRate","construction","cOverY","iOverY","gOverY"
    ].forEach(function (n) { series[n] = []; });

    var checks = null;

    for (var t = 0; t <= N; t++) {

      /* ---- 1. demographics ---- */
      if (t > 0) {
        pop *= (pop < 378 ? 1.0034 : 0.9986);
        adults = pop * 0.765;
        households = adults * BASE.householdsPerAdult;
        prodIndex *= (1 + gProd);
      }

      /* ---- 2. automation ---- */
      var z = s.zMax / (1 + Math.exp(-s.zSteep * (t - s.zMid)));
      var dz = z - zPrev;

      /* ---- 3. supply ---- */
      gProd = s.baseProd + s.autoProd * Math.pow(z, 1.5);
      var gPop = (t > 0 ? (pop < 378 ? 0.0026 : -0.001) : 0.0026);
      /* Public jobs produce real services — care, repair, restoration. Counting
         their cost without their output would double-count the pain. */
      var jgOutput = empJG * wage(sigma, Y, prodIndex) * s.jgWage * s.jgOutput;
      var Ysupply = Y * (1 + gProd + gPop) + (t > 0 ? jgOutput * 0.8 : 0);

      /* ---- 4. factor shares, then labour as an identity ---- */
      /* Employment is not simulated with hiring flows. It is the wage bill
         divided by output per worker:

             workers = (labour's share x output) / (output per worker)

         which means displacement and the falling labour share are the same
         event, measured once. New-task creation pushes the share back up; the
         job guarantee then decides whether the remainder is on a payroll or
         on a transfer. */
      sigma = BASE.sigmaFloor + (BASE.sigma0 - BASE.sigmaFloor) * Math.pow(1 - z, 1.4);
      sigma = clamp(sigma * (1 + 2.2 * (s.reabsorb - 0.055)), 0.06, 0.75);

      var w = wage(sigma, Y, prodIndex);
      var empPublicBase = BASE.empPublic * (pop / BASE.pop);
      var empFromBill = sigma * Y / w;                          // millions
      empPrivate = Math.max(2, empFromBill - empPublicBase);
      empPublic = empPublicBase;

      /* who wants work, and who the state hires when nobody else does */
      var participation = BASE.participation * (1 - 0.28 * Math.max(0, nonEmpPrev - 0.37));
      var labourForce = adults * participation;
      var uncovered = Math.max(0, labourForce * 0.95 - (empPrivate + empPublic));
      var jgTarget = Math.min(uncovered * s.jgTakeup, adults * s.jgCap);
      if (t < s.ubiStart + 2) jgTarget = Math.min(jgTarget, adults * 0.02);
      empJG += (jgTarget - empJG) * 0.34;

      var employed = empPrivate + empPublic + empJG;
      var nonEmployment = 1 - employed / adults;
      var unemployment = clamp(1 - employed / labourForce, 0, 0.60);

      var kOverY = K / Y;
      var deltaShare = BASE.depreciation * kOverY;
      var netCap = Math.max(0.05, (1 - sigma) - deltaShare);   // net capital income
      var wageBill = sigma * Y;

      /* ---- 6. the fund ---- */
      F = Math.min(F, s.fundCap * K);
      var fundShare = clamp(F / K, 0, s.fundCap);
      var fundIncome = fundShare * netCap * Y;
      var payout = clamp(s.fundPayout + pressure * 0.15, 0.3, 0.97);
      var dividend = fundIncome * payout;

      /* ---- 7. the guarantees, costed in real dollars ---- */
      var ubiFrac = clamp((t - s.ubiStart) / Math.max(1, s.ubiPhaseIn), 0, 1);
      // the policy target: a universal payment per adult. ubiIndex decides how much
      // of it keeps pace with productivity rather than being eroded in real terms.
      var biTarget = s.ubiMonthly * 12 * Math.pow(prodIndex, s.ubiIndex) * adults * ubiFrac / 1000;

      healthIndex *= (1 + s.healthInfl);
      var healthRaw = s.healthShare0 * Y * healthIndex * (0.86 + 0.14 * s.healthCoverage);
      var healthTotal = Math.min(healthRaw, s.healthCap * Y);
      var healthGov = healthTotal * s.publicShare;

      var deficiency = Math.max(0, households - adequateUnits);
      var capUnits = (BASE.constructionCap * Y / BASE.costPerUnit) * 1000;
      var built = Math.min(deficiency * s.housingRate, capUnits);
      adequateUnits = (adequateUnits + built) * 0.9975;
      var housingCost = built * BASE.costPerUnit / 1000;

      var jgCost = empJG * w * s.jgWage;   // millions x $k = $B
      var births = pop * 0.011;
      var savingsCost = births * s.savingsBond / 1000;

      var absorption = 0.25 * Math.min(1, s.ubiMonthly / 1000);
      var legacy = (BASE.legacyTransfers - absorption * 0.045) * Y;

      /* The basic income is paid first out of fund income, and only the shortfall
         falls on the budget. This is the whole transition: the dividend replaces
         the tax base as the wage base goes. */
      var fundPaid = Math.min(dividend, biTarget);
      var biFiscal = Math.max(0, biTarget - dividend);

      /* ---- 8. revenue: four bases, one of them dying ---- */
      var revL = s.tauL * sigma;
      var revK = s.tauK * netCap;
      var revV = s.tauV * cOverY;
      var revLand = s.tauLand * BASE.landValue;
      var revC = BASE.emissions * (pop / BASE.pop) * s.tauCarbon / 1000;   // $B
      var revCShare = revC / Y;
      var revW = s.tauWealth * BASE.topWealth;
      var revShareGross = revL + revK + revV + revLand + revCShare + revW;
      var dwl = s.dwlCoef * Math.pow(Math.max(0, revShareGross - s.taxCeiling), 2);
      var revenue = revShareGross * Y * (1 - dwl);

      var debtRatio = D / Y;
      var interestRate = BASE.realRate + 0.02 * Math.pow(Math.max(0, debtRatio - 0.9), 1.4);
      var interest = interestRate * D;

      var otherGovt = BASE.otherGovt * Y;
      var publicInvest = BASE.publicInvest * Y;

      /* ---- 9. fiscal closure: a reaction function, not a wish ---- */
      /* Governments adjust. The adjustment is proportional to how far the primary
         balance is from the level that would stabilise debt, and it is capped by
         what is politically and administratively available. Whatever is left over
         is the deficit, and it compounds. */
      var spending0 = healthGov + housingCost + jgCost + savingsCost + legacy +
        biFiscal + otherGovt + publicInvest + interest;
      var primary0 = revenue - (spending0 - interest);
      /* A standard fiscal reaction: at low debt the state may run a primary
         deficit; above 110% of GDP the required primary balance rises steeply. */
      var targetPrimary = (-0.020 + 0.100 * Math.max(0, debtRatio - 1.10)) * Y;
      var need = Math.max(0, targetPrimary - primary0);
      var pTarget = clamp(need / (0.10 * Y), 0, 1);
      pressure = pressure * 0.55 + pTarget * 0.45;

      var vAdd = 0.12 * pressure;
      var lAdd = 0.05 * pressure;
      var revenueAdj = revenue + (vAdd * cOverY + lAdd * sigma) * Y;
      revV += vAdd * cOverY;
      revL += lAdd * sigma;
      revShareGross += vAdd * cOverY + lAdd * sigma;

      var ubiCut = biFiscal * 0.45 * pressure;
      var legacyCut = legacy * 0.18 * pressure;
      var govCut = otherGovt * 0.30 * pressure;
      var investCut = publicInvest * 0.25 * pressure;
      var healthCut = healthGov * 0.10 * pressure;
      var savingsCut = savingsCost * 0.60 * pressure;

      var ubi = biTarget - ubiCut;
      var spending = healthGov - healthCut + housingCost + jgCost + (savingsCost - savingsCut) +
        (legacy - legacyCut) + ubi - fundPaid + (otherGovt - govCut) +
        (publicInvest - investCut) + interest;
      var revenue = revenueAdj;
      var deficit = spending - revenue;

      /* sovereign debt does not grow for ever: it is restructured */
      if (D / Y > 2.4) { D = 1.05 * Y; restructured = restructured || (2026 + t); }

      /* A state that runs a structural surplus either pays debt down or hands the
         money back. Only the paydown portion reduces the debt; the rest is a
         top-up to the floor, which is what a fund-owning state would do rather
         than retire debt while its citizens sit below the poverty line. */
      var rebate = 0;
      if (deficit < 0) {
        var paydown = Math.min(-deficit, Math.max(0, (D / Y - 0.85)) * Y);
        rebate = -deficit - paydown;
        D = Math.max(0, D + deficit + rebate);
      } else {
        D = D + deficit;
      }

      /* ---- 10. household income ---- */
      var capitalHH = (1 - fundShare) * netCap * Y * BASE.thetaH;
      // net dividend after the slice that funded the basic income
      var dividendResidual = Math.max(0, dividend - fundPaid) + rebate;
      var transferPerAdult = (ubi + dividendResidual + legacy) / adults;
      var disposable = wageBill * (1 - s.tauL) +
        capitalHH + dividendResidual + ubi + legacy -
        s.tauWealth * BASE.topWealth * Y * 0.55;

      /* real-balance effect: when demand is short of supply, prices fall and the
         same transfers and the same cash balances buy more. Without this the
         model has no way out of a demand gap except the debt rule. */
      var realBalance = 1 + 0.55 * Math.max(0, slackPrev);
      var C = s.mpc * disposable * realBalance / (1 + s.mpc * s.tauV);
      cOverY = C / Math.max(1, Y);

      /* ---- 11. demand, and what happens when it falls short ---- */
      var investRate = Math.max(0.09, BASE.investRate - 0.30 * Math.max(0, s.tauK - 0.19) - 0.15 * s.tauWealth);
      var I = investRate * Y;
      var G = (otherGovt - govCut) + (healthGov - healthCut) + housingCost + jgCost + (publicInvest - investCut);
      var Ydemand = C + I + G + BASE.netExports * Y;

      var slack = 1 - Ydemand / Ysupply;
      var newY = (t === 0) ? Y : clamp(Ydemand, Y * 0.90, Ysupply);
      gY = newY / Y - 1;
      slackPrev = slack;
      nonEmpPrev = nonEmployment;

      var excess = Math.max(0, Ydemand / Ysupply - 1);
      inflationState = inflationState * 0.60 + (Math.min(excess, 0.08) * 0.35 + pressure * 0.004) * 0.40;
      var inflation = clamp(inflationState, 0, 0.20);

      /* ---- 12. the fund accumulates ---- */
      var capSideRevenue = (revK + revLand + revW) * Y * (1 - dwl);
      var contribution = Math.min(
        capSideRevenue * s.fundContribution,
        BASE.fundFlowCap * Y
      );
      F = F + contribution + fundIncome * Math.min(1, payout + 0.25 * pressure) * 0 +
        fundIncome * (1 - payout);
      K = K * (1 - BASE.depreciation) + I + (publicInvest - investCut);

      /* ---- 13. record ---- */
      if (t === 0) {
        checks = {
          revenueShare: revenue / Y,
          consumptionShare: C / Y,
          investmentShare: I / Y,
          govShare: G / Y,
          healthShare: healthTotal / Y,
          deficitShare: -deficit / Y,
          labourShare: sigma,
          capitalIncome: netCap,
          identityResidual: (C + I + G + BASE.netExports * Y) / Y - 1
        };
      }

      var bundle = (ubi - fundPaid) + healthGov + housingCost + jgCost + savingsCost;
      var bundleGross = ubi + healthGov + housingCost + jgCost + savingsCost;
      /* The income floor is what a person with no market job and no entitlement
         receives: the basic income plus the dividend. Nothing else is
         unconditional, so nothing else counts. It is measured against the
         official single-adult poverty guideline, which this model grows with
         output — a generous reading that makes the floor harder to reach. */
      var gdpPerAdult = Y / adults;                        // $k per adult
      var floorPerAdult = (ubi + dividendResidual) / adults;   // $B / millions = $k
      /* 0.22 of output per adult is roughly 60% of median personal income —
         the European relative-poverty convention, not the US absolute line. */
      var covFloor = clamp(floorPerAdult / (0.22 * gdpPerAdult), 0, 1);
      var covJob = clamp(employed / (0.55 * adults), 0, 1);
      var covHousing = Math.min(1, adequateUnits / households);
      var stability = clamp(1 - Math.max(0, inflation - 0.02) * 6, 0, 1);
      var solvency = clamp(1 - Math.max(0, debtRatio - 0.9) * 0.7, 0, 1);

      series.year.push(2026 + t);
      series.output.push(Y / 1000);
      series.outputPc.push(Y / pop);
      series.sigma.push(sigma);
      series.employment.push(employed / adults);
      series.unemployment.push(unemployment);
      series.nonEmployment.push(nonEmployment);
      series.wag.push(wageBill / Y);
      series.capitalHH.push(capitalHH / Y);
      series.ubi.push(ubi / Y);
      series.dividend.push(dividend / Y);
      series.legacy.push(legacy / Y);
      series.revenue.push(revenue / Y);
      series.spending.push(spending / Y);
      series.debt.push(debtRatio);
      series.deficit.push(deficit / Y);
      series.inflation.push(inflation);
      series.demand.push(Ydemand / 1000);
      series.supply.push(Ysupply / 1000);
      series.slack.push(slack);
      series.fund.push(F / Y);
      series.fundShare.push(fundShare);
      series.fundPerAdult.push(F / adults);
      series.wageBill.push(wageBill / Y);
      series.revL.push(revL);
      series.revK.push(revK);
      series.revV.push(revV + (pressure > 0.001 ? 0.10 * pressure * cOverY : 0));
      series.revLand.push(revLand);
      series.revC.push(revCShare);
      series.revW.push(revW);
      series.revTotal.push(revShareGross);
      series.empPrivate.push(empPrivate / adults);
      series.empPublic.push(empPublic / adults);
      series.empJG.push(empJG / adults);
      series.jgCost.push(jgCost / Y);
      series.health.push(healthTotal / Y);
      series.healthGov.push(healthGov / Y);
      series.housing.push(housingCost / Y);
      series.bundle.push(bundle / Y);
      series.bundleShare.push(bundleGross / Y);
      series.covHousing.push(covHousing);
      series.covHealth.push(s.healthCoverage);
      series.covSavings.push(covFloor);
      series.floorPerAdult = series.floorPerAdult || [];
      series.floorPerAdult.push(floorPerAdult);
      series.covJob.push(covJob);
      series.adequacy.push(geo([covHousing, s.healthCoverage, covFloor, covJob, stability, solvency]));
      series.fundCover.push(dividend / Math.max(1, bundleGross));
      series.fundPaidShare = series.fundPaidShare || [];
      series.fundPaidShare.push(fundPaid / Y);
      series.dwl.push(dwl);
      series.transferPerAdult.push(transferPerAdult);
      series.disposable.push(disposable / Y);
      series.payout.push(payout);
      series.wagePerWorker.push(w);
      series.fundDivShare.push((dividend + rebate) / Y);
      series.rebate = series.rebate || [];
      series.rebate.push(rebate / Y);
      series.healthPerCapita.push(healthTotal * 1000 / pop);
      series.debtService.push(interest / Y);
      series.interestRate.push(interestRate);
      series.construction.push(built);
      series.cOverY.push(cOverY);
      series.iOverY.push(I / Y);
      series.gOverY.push(G / Y);

      zPrev = z;
      Y = newY;
    }

    /* ------------------------------------------------------------ summary */
    var last = function (a) { return a[a.length - 1]; };
    var at = function (a, i) { return a[clamp(Math.round(i), 0, a.length - 1)]; };
    var peak = function (a) { return Math.max.apply(null, a); };
    var troughIdx = function (a) { return a.indexOf(Math.min.apply(null, a)); };

    var out = {
      series: series,
      defaults: s,
      checks: checks,
      kpis: {
        endEmployment: last(series.employment),
        endNonEmployment: last(series.nonEmployment),
        endSigma: last(series.sigma),
        endAdequacy: last(series.adequacy),
        minAdequacy: Math.min.apply(null, series.adequacy),
        minAdequacyYear: series.year[troughIdx(series.adequacy)],
        peakRevenue: peak(series.revenue),
        peakDebt: peak(series.debt),
        peakInflation: peak(series.inflation),
        peakUnemployment: peak(series.unemployment),
        peakBundle: peak(series.bundle),
        peakBundleGross: peak(series.bundleShare),
        floorValley: Math.min.apply(null, series.covSavings.slice(10)),
        floorValleyYear: 2036 + series.covSavings.slice(10).indexOf(Math.min.apply(null, series.covSavings.slice(10))),
        valleyAfter2030: Math.min.apply(null, series.adequacy.slice(10)),
        valleyYear: 2036 + series.adequacy.slice(10).indexOf(Math.min.apply(null, series.adequacy.slice(10))),
        restructured: restructured,
        endFund: last(series.fund),
        endFundShare: last(series.fundShare),
        endDividend: last(series.dividend),
        at2045: {
          employment: at(series.employment, 19),
          sigma: at(series.sigma, 19),
          bundle: at(series.bundle, 19),
          revenue: at(series.revenue, 19),
          adequacy: at(series.adequacy, 19),
          fund: at(series.fund, 19)
        },
        fundCoversBundleYear: firstYear(series.fundCover, function (v) { return v >= 1; }),
        revenueBreachYear: firstYear(series.revenue, function (v) { return v > 0.46; }),
        debtBreachYear: firstYear(series.debt, function (v) { return v > 1.5; }),
        employmentCliffYear: firstYear(series.employment, function (v) { return v < 0.50; }),
        dividendOvertakesUBIYear: firstYear(series.fundDivShare, function (v, i) { return v > series.ubi[i]; })
      }
    };
    return out;
  }

  /* --------------------------------------------------------------- helpers */

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function wage(sigma, Y, prodIndex) {
    // average total compensation per worker, in $k, grown with productivity
    return (BASE.sigma0 * BASE.gdp / (BASE.empPrivate + BASE.empPublic)) * (prodIndex || 1);
  }

  function geo(parts) {
    var p = 1;
    for (var i = 0; i < parts.length; i++) p *= Math.max(0.001, Math.min(1, parts[i]));
    return Math.pow(p, 1 / parts.length);
  }

  function firstYear(arr, test) {
    for (var i = 0; i < arr.length; i++) if (test(arr[i], i)) return 2026 + i;
    return null;
  }

  /* Each probe runs the model twice with one assumption moved to a plausible
     low and high, and records the end-state abundance index. The swing is the
     honest measure of what the answer depends on. */
  function sensitivity(input) {
    var base = run(input);
    var baseValley = base.kpis.floorValley;

    var probes = [
      { key: "ubiMonthly", label: "UBI level", lo: 300, hi: 1800,
        loLabel: "$300/mo", hiLabel: "$1,800/mo" },
      { key: "tauK", label: "Capital tax", lo: 0.15, hi: 0.50,
        loLabel: "15%", hiLabel: "50%" },
      { key: "fundContribution", label: "Fund seeding", lo: 0.10, hi: 1.0,
        loLabel: "10% of capital tax", hiLabel: "all of it" },
      { key: "zMax", label: "Automation depth", lo: 0.45, hi: 0.90,
        loLabel: "45% of tasks", hiLabel: "90% of tasks" },
      { key: "publicShare", label: "Public health share", lo: 0.45, hi: 1.0,
        loLabel: "45% public", hiLabel: "100% public" },
      { key: "jgCap", label: "Public-job ceiling", lo: 0.02, hi: 0.22,
        loLabel: "2% of adults", hiLabel: "22% of adults" },
      { key: "reabsorb", label: "New-task creation", lo: 0.02, hi: 0.12,
        loLabel: "2%/yr", hiLabel: "12%/yr" },
      { key: "fundCap", label: "Fund ownership ceiling", lo: 0.20, hi: 0.85,
        loLabel: "20% of capital", hiLabel: "85% of capital" }
    ];

    return probes.map(function (p) {
      var lo = {}, hi = {}, k;
      for (k in DEFAULTS) { lo[k] = pick(input, k); hi[k] = pick(input, k); }
      lo[p.key] = p.lo;
      hi[p.key] = p.hi;
      var a = run(lo), b = run(hi);
      // measured at the floor's weakest point, not at the end state, because
      // almost every setting converges by 2100 and the transition is the question
      var ai = a.kpis.floorValley;
      var bi = b.kpis.floorValley;
      return {
        key: p.key, label: p.label,
        lo: ai, hi: bi, base: baseValley,
        swing: Math.abs(bi - ai),
        loLabel: p.loLabel, hiLabel: p.hiLabel,
        yearLo: a.kpis.floorValleyYear, yearHi: b.kpis.floorValleyYear
      };
    }).sort(function (x, y) { return y.swing - x.swing; });
  }

  function pick(input, k) {
    return (input && input[k] != null) ? input[k] : DEFAULTS[k];
  }

  /* Calibration: run today's policy against the measured economy and report the
     residuals. This is the only part of the page that is a check, not a claim. */
  function calibration() {
    var status = {};
    PRESETS[1].patch && Object.keys(PRESETS[1].patch).forEach(function (k) {
      status[k] = PRESETS[1].patch[k];
    });
    var o = run(status);
    var c = o.checks;
    var rows = [
      { name: "Government revenue", model: c.revenueShare, actual: BASE.govRev0, src: "BEA / OMB" },
      { name: "Household consumption", model: c.consumptionShare, actual: 0.68, src: "BEA NIPA" },
      { name: "Gross private investment", model: c.investmentShare, actual: 0.20, src: "BEA NIPA" },
      { name: "Government consumption + investment", model: c.govShare, actual: 0.175, src: "BEA NIPA" },
      { name: "Health spending, all payers", model: c.healthShare, actual: 0.166, src: "CMS NHE" },
      { name: "Labour share of GDP", model: c.labourShare, actual: 0.58, src: "BLS" },
      { name: "Fiscal balance", model: c.deficitShare, actual: -0.061, src: "Treasury MTS" }
    ];
    rows.forEach(function (r) {
      r.error = r.model - r.actual;
      r.ok = Math.abs(r.error) < 0.025;
    });
    return rows;
  }

  global.ABUND = {
    DEFAULTS: DEFAULTS, BASE: BASE, PRESETS: PRESETS,
    run: run, sensitivity: sensitivity, calibration: calibration
  };
})(typeof window !== "undefined" ? window : global);
