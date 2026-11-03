/* Published anchors for the war-forecast page.

   Unlike every other data file in this lab, this one is almost entirely
   *literature* rather than measurement. That is the honest situation: nobody
   has a measured series for wars in 3000 CE. What exists is a small number of
   published estimates, each with a stated uncertainty, and a well-identified
   statistical description of the past that can be extrapolated.

   So each entry carries:
     value     the number
     lo / hi   the published uncertainty, where the source gives one
     prov      "measured"   — counted from a dataset
               "published"  — a named source states it
               "derived"    — arithmetic on the two above, shown in the note
               "judgment"   — no published effect size exists; this is a
                              choice, and the page says so where it is used

   The judgment entries are the reason the page reports a distribution and
   never a point forecast. */

window.WARF_DATA = {
  generated: "2026-11-02",
  startYear: 2025,
  endYear: 10000,

  /* ------------------------------------------------------------- the record ---
     Clauset (2018) fit the Correlates of War interstate-war series. Everything
     the model does at the base rate comes from these six numbers. */
  record: {
    dataset: "Correlates of War, interstate wars",
    span: [1823, 2003],
    wars: 95,
    years: 181,
    /* Onset rate is derived, not assumed: 95 wars / 181 years. Clauset's own
       geometric parameter (q = 0.428) implies a mean gap of 1.91 years, and
       181 / 1.91 = 94.8, which is the same 95 wars counted another way. */
    onsetRate: { value: 0.5249, prov: "derived", lo: 0.5249, hi: 0.5249,
      note: "95 wars in 181 years. Clauset's q = 0.428 gives a mean gap of 1.91 years, which returns the same count." },

    /* The other death channel: what an ordinary year of war costs. Measured,
       not modelled — mean annual battle plus one-sided deaths in UCDP,
       1989-2024. It is the only part of this page with no extrapolation in it. */
    backgroundDeaths: { value: 99971, prov: "measured",
      note: "UCDP, 36 years from 1989 to 2024. Median 65,113; the mean is carried up by 1994 (818,208)." },

    /* The tail. Clauset reports the *density* exponent; the survival exponent
       is one less, and that difference decides everything on this page. */
    alpha: { value: 1.53, lo: 1.46, hi: 1.60, prov: "published",
      note: "Power-law density exponent for wars above 7,061 battle deaths, MLE with a bootstrap interval of ±0.07." },
    survivalExponent: { value: 0.53, prov: "derived",
      note: "alpha - 1. P(S > s) = (s / x_min)^-0.53. Below 1, so the mean war size does not exist: every average of war deaths is dominated by whatever the largest war happened to be." },
    xmin: { value: 7061, prov: "published",
      note: "The threshold above which the power law holds. 51 of the 95 wars are above it." },
    aboveXmin: { value: 51, prov: "measured" },
    wwii: { value: 16634907, prov: "published",
      note: "Battle deaths in the largest war in the dataset, which is also the largest war in the record." },
    pWWIIscale100: { value: 0.43, lo: 0.42, hi: 0.44, prov: "published",
      note: "Clauset's own headline: under a stationary model, the chance of at least one war of WWII scale within 100 years. One such war per 161 years on average." },
    longPeace: { value: 64, prov: "measured",
      note: "Years from 1940 to 2003 with five large wars, against 19 in the preceding 117." },
    significanceNeeds: { value: 100, lo: 100, hi: 140, prov: "published",
      note: "Additional years of comparable peace needed before the absence of large wars becomes statistically distinguishable from the stationary model. The observed peace is consistent with either a real change or no change at all." }
  },

  /* The rival reading of the same record. Same heavy tail, different politics. */
  rival: {
    dataset: "565 named conflicts with >3,000 casualties, 1–2015 CE",
    shape: { value: 1.4985, lo: 1.3752, hi: 1.6218, prov: "published",
      note: "Generalised Pareto shape, peaks-over-threshold at 25,000 casualties. Above 1, so the empirical mean is undefined — the authors compute a 'shadow mean' at least 1.5x the sample mean." },
    gap5M: { value: 93.03, lo: 79.0, hi: 140.0, prov: "published",
      note: "Mean years between conflicts killing 5 million or more, with a median absolute deviation larger than the mean. The post-1945 window is short relative to this, which is their whole argument." },
    claim: "No trend in frequency or inter-arrival time is statistically supportable, so the absence of a large war since 1945 carries almost no information."
  },

  richardson: {
    twoLaws: true,
    exponentAbove: { value: 1.5, prov: "published", note: "Richardson's graphical estimate for wars above ~1,000 dead" },
    exponentBelow: { value: 2.4, prov: "published", note: "for quarrels below that threshold — the break is the reason 'war' and 'violence' are different objects" },
    note: "The Quaker who invented the field concluded in 1960 that the variations 'might be merely random, and not evidence of any general trend towards more or fewer fatal quarrels'."
  },

  /* --------------------------------------------------------- escalation ---
     The part the Pareto distribution cannot describe, because it lies outside
     the range any war has reached. Fatalities here are famine, not blast:
     Xia et al. model crop failure from stratospheric soot. */
  nuclear: {
    sootRegions: { value: 5, unit: "Tg", prov: "published",
      note: "A regional exchange (India–Pakistan scale) puts roughly 5 Tg of soot in the stratosphere." },
    sootGlobal: { value: 150, unit: "Tg", prov: "published",
      note: "A US–Russia exchange at current arsenal sizes." },
    famineRegional: { value: 2.0e9, prov: "published",
      note: "Xia et al. 2022, Nature Food: more than 2 billion at risk of starvation after a regional exchange, assuming stored food is eaten." },
    famineGlobal: { value: 5.0e9, prov: "published",
      note: "More than 5 billion after a US–Russia exchange — on a population of about 8 billion. More than 90% of those deaths are in countries that were not parties to the war." },
    nonBelligerentShare: { value: 0.9, prov: "published" },

    /* Expert elicitation. The spread between these is the honest error bar on
       the probability of a nuclear war, and it is a factor of five. */
    expert2045: { value: 0.05, prov: "published",
      note: "Forecasting Research Institute 2024: 110 domain experts, median chance of 10 million or more deaths from nuclear weapons before 2045. Superforecasters put the same question at 1%; the US public at 10%." },
    super2045: { value: 0.01, prov: "published" },
    public2045: { value: 0.10, prov: "published" },
    ps21: { value: 0.05, lo: 0.05, hi: 0.05, prov: "published",
      note: "PS21, 2015: 50 experts, median 5% for a major nuclear conflict within 25 years killing more than WWII." },
    lugar5yr: { value: 0.10, prov: "published",
      note: "Lugar Survey 2005, 79 experts: median 10% within five years, 20% within ten. The most pessimistic of the published surveys, and the one least borne out." },
    tetlock50yr: { value: 0.29, prov: "published",
      note: "Tetlock's 1988 and 1997 expert surveys: median 29% chance of nuclear war within fifty years." },
    ordCentury: { value: 0.001, prov: "published",
      note: "Toby Ord, The Precipice: 1 in 1,000 chance that nuclear war causes an existential catastrophe this century. Ord raised his qualitative assessment in 2024 without publishing a new number." },
    xptCatastrophe: { value: 0.08, lo: 0.04, hi: 0.08, prov: "published",
      note: "Existential Risk Persuasion Tournament: catastrophe (>10% of humanity dead within five years) from nuclear weapons by 2100 — 8% for domain experts, 4% for superforecasters." }
  },

  /* ------------------------------------------------------------ deep time ---
     What the literature will and will not say about 10,000 CE. */
  deepTime: {
    singleton: {
      prov: "published",
      note: "Bostrom: a single decision-making agency at the highest level, able to prevent any internal or external challenge. He puts the hypothesis at 'more likely true than not', and the stability condition is a technology of permanent enforcement that does not exist yet."
    },
    trajectories: {
      prov: "published",
      note: "Baum et al. 2019, Foresight: four classes — status quo, catastrophe, technological transformation, astronomical. Their one firm claim is that status-quo trajectories 'appear unlikely to persist into the distant future'. So extrapolating present institutions for eight millennia is the one option the scenario literature rules out."
    },
    peaceScale: {
      prov: "published",
      note: "Turchin: for any shape, area grows faster than perimeter, and external war scales with perimeter while population scales with area — so violence per head falls roughly as 1/sqrt(N) as polities consolidate. It is a geometric argument, not a moral one, and it extrapolates to a world state."
    },
    changepoints: { prov: "published",
      value: [1830, 1910, 1950, 1994],
      note: "Fagan et al., changepoint analysis of historical battle deaths: four structural breaks, independent of data presentation. Two bracket the world wars." },
    autopWeapons: {
      prov: "published",
      note: "RAND (Laird, 2020) identifies four escalation pathways for autonomous weapons in a nuclear dyad: preemption pressure, loss of political control as machine speed outruns decision speed, misread counterforce strikes, and degraded signalling. No published estimate of the effect size on the probability of war exists — the judgment below is a choice, not a finding."
    }
  },

  /* ------------------------------------------------------- demography ---
     Only used to size the ceiling: no war can kill more people than exist. */
  population: {
    now: { value: 8.2e9, prov: "measured" },
    peak: { value: 1.04e10, prov: "published",
      note: "UN World Population Prospects 2024, medium variant, around 2085." },
    plateau: { value: 1.0e10, prov: "judgment",
      note: "Held flat after 2100. Beyond that every published projection is a guess and the ceiling is insensitive to it." },
    peakYear: 2085
  },

  /* ------------------------------------------------------------ levers ---
     Defaults for the model. `prov` marks which of these are published and
     which are mine. */
  levers: {
    onsetMult: { value: 1.0, prov: "judgment", label: "Onset rate", unit: "x",
      note: "Multiplier on the measured 0.52 wars a year." },
    trend: { value: 0, prov: "judgment", label: "Peace trend", unit: "%/yr",
      note: "Annual change in the onset rate. Zero is Clauset's null: the record is consistent with no trend at all." },
    floor: { value: 0.05, prov: "judgment", label: "Trend floor", unit: "x",
      note: "Where a declining trend stops. Without a floor the model eventually asserts that war is extinct, which is a claim, not an extrapolation." },
    deterrence: { value: 0.5, prov: "judgment", label: "Deterrence", unit: "0-1",
      note: "How much nuclear arsenals suppress the onset of great-power war. The same lever raises the conditional catastrophe probability, because a war that happens anyway is a war that failed deterrence." },
    nuclearGate: { value: 0.35, prov: "judgment", label: "Escalation given a great-power war", unit: "0-1",
      note: "Chance that a war already larger than WWII goes nuclear. Anchored loosely on the expert medians above; no published conditional estimate exists." },
    capFrac: { value: 0.6, prov: "judgment", label: "Ceiling", unit: "of population",
      note: "The most a single war can kill. 0.6 is the US-Russia famine estimate against the population it was computed on." },
    settleRate: { value: 0.0015, prov: "judgment", label: "Settlement hazard", unit: "/yr",
      note: "Chance per year that a durable world order forms. Bostrom's >50% prior folded over eight millennia implies a rate of roughly this order." },
    settleHold: { value: 0.999, prov: "judgment", label: "Hold strength", unit: "suppression",
      note: "How completely a settlement suppresses war. Below 1 the peace leaks." },
    settleFail: { value: 0.0004, prov: "judgment", label: "Settlement failure", unit: "/yr",
      note: "Chance per year that a settlement collapses and war returns." },
    aiOnset: { value: 1.0, prov: "judgment", label: "AI effect on onset", unit: "x" },
    aiEscalation: { value: 1.0, prov: "judgment", label: "AI effect on escalation", unit: "x" },
    traumaBoost: { value: 6, prov: "judgment", label: "War trauma on settlement", unit: "x",
      note: "Bostrom's ratchet: the League of Nations and the UN both grew out of world wars. A catastrophe multiplies the settlement hazard for 40 years." }
  },

  /* --------------------------------------------------------- scenarios ---
     Four readings of the same record. Each is a lever vector, so the presets
     and the sliders cannot disagree. */
  scenarios: [
    {
      id: "stationary", label: "Stationary",
      blurb: "The record repeats. Clauset's null: no trend, no settlement, the 1823–2003 hazard held for eight millennia.",
      levers: { trend: 0, settleRate: 0, deterrence: 0.5, aiOnset: 1.0, aiEscalation: 1.0 }
    },
    {
      id: "peace", label: "Long peace holds",
      blurb: "The post-1945 decline is real and continues at 1.5% a year until it hits a floor at a twentieth of the base rate.",
      levers: { trend: -0.015, floor: 0.05, settleRate: 0.0003, deterrence: 0.65, aiOnset: 0.9, aiEscalation: 1.1 }
    },
    {
      id: "renewal", label: "Great-power renewal",
      blurb: "Multipolarity, cheap autonomy and renewed revisionism: the onset rate climbs for sixty years, and AI makes escalation likelier than it was.",
      levers: { trend: 0.01, floor: 1, settleRate: 0.0004, deterrence: 0.35, aiOnset: 1.35, aiEscalation: 2.0 }
    },
    {
      id: "settlement", label: "War ends",
      blurb: "Institutions consolidate until the hazard goes to zero — the only mechanism in the model that can produce a war-free century.",
      levers: { trend: -0.01, floor: 0.02, settleRate: 0.004, settleHold: 0.9995, deterrence: 0.7, aiOnset: 0.8, aiEscalation: 1.0 }
    }
  ],

  sources: [
    { name: "Trends and fluctuations in the severity of interstate wars", provider: "Clauset, Science Advances 4:eaao3580 (2018)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5834001/",
      note: "The exponent, the onset rate, the 0.43, and the finding that the long peace needs another century before it is distinguishable from noise." },
    { name: "On the statistical properties and tail risk of violent conflicts", provider: "Cirillo & Taleb, Physica A 429:252 (2016)",
      url: "https://arxiv.org/abs/1505.04722",
      note: "The rival reading: 565 conflicts over 2,000 years, a tail with no finite mean, and no trend in frequency or inter-arrival time." },
    { name: "Changepoint analysis of historical battle deaths", provider: "Fagan, Knight, MacKay & Wood, JRSS-A 183:909",
      url: "https://arxiv.org/html/1909.02626v1",
      note: "Four structural breaks — 1830s, 1910, 1950, 1994 — which is the strongest evidence that something changed, alongside the argument that the change is too small to measure yet." },
    { name: "Nuclear war: the effects of a regional or global exchange", provider: "Xia, Robock, Toon et al., Nature Food 3:586 (2022)",
      url: "https://pubmed.ncbi.nlm.nih.gov/37118594/",
      note: "Soot, crop failure and famine: >2 billion at risk from a regional exchange, >5 billion from a US–Russia one, with >90% of deaths in non-belligerents." },
    { name: "Can Humanity Achieve a Century of Nuclear Peace?", provider: "Forecasting Research Institute (2024)",
      url: "https://forecastingresearch.org/research/nuclear-risk",
      note: "151 experts and superforecasters: median 5% and 1% for 10 million nuclear deaths before 2045. Also the historical survey table this page draws on." },
    { name: "The Precipice", provider: "Toby Ord (2020)",
      url: "https://www.tobyord.com/writing/the-precipice-revisited",
      note: "1 in 1,000 for nuclear existential risk this century, against 1 in 6 total. Ord's 2024 reassessment raised the nuclear figure qualitatively without publishing a new one." },
    { name: "What is a Singleton?", provider: "Nick Bostrom (2006)",
      url: "https://nickbostrom.com/fut/singleton",
      note: "The only mechanism in the literature that claims a terminal end to war, and its stability condition: a technology of permanent enforcement." },
    { name: "Long-term trajectories of human civilization", provider: "Baum et al., Foresight 21:53 (2019)",
      url: "https://matthijsmaas.com/publication/2019.-baum-et-al.longtermtrajectories/",
      note: "Status-quo trajectories are unlikely to persist into the distant future. That is the sentence that makes an 8,000-year extrapolation of present institutions the least defensible option on this page." },
    { name: "The Risks of Autonomous Weapons Systems for Crisis Stability", provider: "RAND, Laird (2020)",
      url: "https://www.rand.org/pubs/commentary/2020/06/the-risks-of-autonomous-weapons-systems-for-crisis.html",
      note: "Four named escalation pathways. No effect size — which is why the AI levers here are labelled judgment." }
  ]
};
