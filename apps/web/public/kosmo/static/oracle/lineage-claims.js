/* ============================================================================
   lineage-claims.js — the published counts behind the lineage page.

   Three kinds of record, all of them counts of *recognition*, never of
   realization:

     registers   a tradition's own list of who held the transmission
     censuses    how many people were living inside a monastic institution
     surveys     how many modern adults practised, and how seriously

   Every figure carries its source and its defect. The defects are not
   decoration: a register that records 1,701 names but only 951 with any
   recorded sayings is a different instrument from a census, and both are
   different from a survey that asks people what they did last year.
   ============================================================================ */
window.LINEAGE_CLAIMS = {
  generated: "2026-11-02",

  /* ------------------------------------------------------------- registers ---
     The Chan register is the largest surviving transmission genealogy. Counts
     are of *names in the lineage*, not of awakened people, and the 951/1,701
     split is the part that matters: 750 entries are names without a recorded
     word.                                                                     */
  registers: [
    {
      key: "chan", name: "Chan", color: "#a9c0b4",
      total: 1701, detailed: 951, generations: 52,
      founded: 532, recorded: 1004,
      note: "Jingde chuandeng lu, 1004. 1,701 names in the transmission genealogy, 951 with recorded sayings, 52 generations from the seven past buddhas. From Bodhidharma (d. c. 532) to the register's close is about 24 generations.",
      branch: true
    },
    {
      key: "sringeri", name: "Sringeri Advaita", color: "#c4a373",
      total: 36, detailed: null, generations: 36,
      founded: 820, recorded: 2026,
      note: "36 acharyas and one successor-designate, unbroken since Sureśvarācārya in 820 CE. A single succession: each acharya names one successor. Reign dates before 1380 are traditional, not documentary.",
      branch: false
    },
    {
      key: "karmapa", name: "Karmapa", color: "#a396b3",
      total: 17, detailed: null, generations: 17,
      founded: 1110, recorded: 2026,
      note: "17 Karmapa incarnations since Düsum Khyenpa (1110–1193). A reincarnation line, not a student line: the succession is identified, not trained. The 17th is contested between two claimants.",
      branch: false
    }
  ],

  /* --------------------------------------------------------------- monastics ---
     Share of the surrounding population living as a monastic. The point of the
     chart is the range: three orders of magnitude between Tibetan Buddhist
     density at its peak and Catholic religious density today.               */
  monastic: [
    { name: "Tibet, pre-1959", share: 10.0, count: 110000, pop: 1100000,
      note: "About 110,000 monks and nuns in ~2,000 monasteries, ~10% of the population, per the Chinese government's own 2004 statement. Exile and scholarly sources give higher male ratios; the defensible range is 10–20% of males.", color: "#c4a373" },
    { name: "Myanmar, 2016", share: 1.13, count: 600000, pop: 52900000,
      note: "~282,000 ordained monks, 253,000 novices, 60,000 nuns, per the Sangha Council via the International Crisis Group. The best-sourced monastic census in the set.", color: "#a9c0b4" },
    { name: "Medieval Europe", share: 1.0, count: null, pop: null,
      note: "A widely repeated estimate that monks were about 1% of the medieval population. Thinly sourced; regional peaks were much higher.", color: "#8aa4be" },
    { name: "Thailand, 2024", share: 0.39, count: 277518, pop: 71700000,
      note: "245,645 monks and 31,873 novices, Thai National Statistical Office yearbook. A 1958 census recorded 159,648 monks, so the absolute number rose while the population rose faster.", color: "#7fb3b0" },
    { name: "Catholic religious", year: 2024, share: 0.044, count: 628642, pop: 1422000000,
      note: "2024: 580,131 sisters and 48,511 brothers, Vatican yearbook. Most are active-order religious, not cloistered contemplatives; the Benedictine Confederation reports only ~7,500 monks.", color: "#a396b3" },
    { name: "Korea, Jogye, 2023", share: 0.025, count: 13000, pop: 51700000,
      note: "13,000 monks and nuns in the Jogye Order, about 2,000 of them in intensive retreat at any time.", color: "#c28181" },
    { name: "China, 2017", share: 0.014, count: 200000, pop: 1400000000,
      note: "~200,000 Buddhist monks and nuns including 120,000 Tibetan lamas and nuns, per a State Council fact sheet. A round number repeated for years.", color: "#e2d6ae" }
  ],

  /* ------------------------------------------------------------------ modern ---
     Pew's 2023-24 Religious Landscape Study, 36,908 US adults. Pew publishes
     the meditation item as three frequency bands and never as a topline, so
     'any' here is their sum (23 + 7 + 21), not a published figure, and the page
     says so. Same for 'retreat, annual or more' (3 + 11).                 */
  modern: {
    meditateWeekly: 23,     /* published: at least once a week */
    meditateMonthly: 7,     /* published */
    meditateLessOften: 21,  /* published */
    meditateAny: 51,        /* derived: the three bands summed */
    retreatAnnual: 14,      /* derived: 3 more than once a year + 11 yearly-or-every-few */
    retreatYearly: 3,       /* published: more than once a year */
    retreatNever: 72,       /* published */
    note: "Pew Research Center, Religious Landscape Study 2023-24, n = 36,908. Meditation and retreat are 'for spiritual purposes'; the item excludes prayer. Pew does not publish an 'at least occasionally' topline, so the 51% and 14% used here are arithmetic on its own bands."
  },

  /* ------------------------------------------------- persistent nondual ---
     There is no prevalence estimate. Martin recruited ~1,200 people who claimed
     awakening and belonged to a community that validated it; the published
     analysis rests on the first 50 interviews. That is a sample of claimants,
     not a rate.                                                              */
  nondual: {
    recruited: 1200,
    interviewed: 50,
    note: "Martin, persistent non-symbolic experience. A purposive sample with no denominator: it can tell you what the experience is like, not how many people have it."
  },

  /* --------------------------------------------------------- populations ---
     For converting counts into shares. Historical figures are UN/HYDE
     round numbers; the modern ones are UN WPP.                              */
  population: [
    { year: 600, pop: 200e6 },
    { year: 1000, pop: 310e6 },
    { year: 1500, pop: 500e6 },
    { year: 1800, pop: 1.0e9 },
    { year: 1900, pop: 1.65e9 },
    { year: 2025, pop: 8.2e9 }
  ],

  /* -------------------------------------------------------------- model ---
     Reach assumptions. These are the page's own, and the only numbers on it
     that are not sourced: how many people one recognized teacher trained.    */
  reach: {
    low: 5, central: 20, high: 100,
    note: "Students per recognized teacher. In a monastery the abbot trains the resident monks, so the ratio is bounded below by the size of a typical community and above by a lifetime of teaching. 5–100 is the range; 20 is the central case."
  },

  /* How many serious practitioners cross into persistent nondual awareness is
     not known. The page therefore reports a band, not a number. */
  awakeningRate: { low: 0.001, central: 0.01, high: 0.05 },

  sources: [
    { name: "Jingde chuandeng lu — the Chan transmission register", provider: "1004, Taishō 51.2076",
      url: "https://en.wikipedia.org/wiki/The_Jingde_Record_of_the_Transmission_of_the_Lamp",
      note: "1,701 names, 951 with recorded sayings, 52 generations. The 951/1,701 split is widely reported but not page-verified in a critical edition." },
    { name: "Sringeri Sharada Peetham — the acharya line", provider: "sringeri.net",
      url: "https://www.sringeri.net/jagadgurus",
      note: "36 acharyas and one successor-designate, with reign dates from 820 CE. The early dates are traditional." },
    { name: "Karmapa lineage", provider: "karmapa.org",
      url: "https://www.karmapa.org/karma-kagyu/history-of-the-kagyu-lineage/",
      note: "17 incarnations since 1110; the 17th is contested between two claimants. No canonical count of 'Golden Rosary' holders exists." },
    { name: "Myanmar's Sangha", provider: "International Crisis Group, 2023",
      url: "https://www.crisisgroup.org/rpt/asia/south-east-asia/myanmar/330-silent-sangha-buddhist-monks-post-coup-myanmar",
      note: "~282,000 ordained monks, 253,000 novices and 60,000 nuns, from 2016 Sangha Council data." },
    { name: "Thailand's monastic population", provider: "Thai NSO yearbook, 2024",
      url: "https://blog.modeldiplomat.com/thai-buddhist-monks",
      note: "245,645 monks and 31,873 novices in 2024, against a 1958 census of 159,648 monks." },
    { name: "Tibet before 1959", provider: "Chinese Embassy statement, 2004",
      url: "https://il.china-embassy.gov.cn/eng/zt/xzwt/200409/t20040921_2354364.htm",
      note: "~110,000 monks and nuns, ~10% of the population. An official claim, not an independent census; exile sources give higher ratios." },
    { name: "Catholic Church statistics", provider: "Agenzia Fides / Vatican yearbook, 2024",
      url: "https://www.fides.org/en/stats",
      note: "580,131 sisters, 48,511 brothers, 407,421 priests. Cloistered monks are a small subset." },
    { name: "Pew — spiritual activities", provider: "Pew Research Center, Feb 2025",
      url: "https://www.pewresearch.org/religion/2025/02/26/spiritual-activities/",
      note: "n = 36,908 US adults. Pew publishes meditation as bands — 23% weekly, 7% monthly, 21% less often, 48% never — and retreats as 3% more than once a year, 11% yearly or every few years, 72% never. It publishes no 'at least occasionally' topline; the 51% and 14% on this page are those bands summed." },
    { name: "Martin — persistent non-symbolic experience", provider: "Consciousness Journal, 2020",
      url: "https://digitalcommons.ciis.edu/conscjournal/vol8/iss8/1/",
      note: "~1,200 claimants recruited, ~50 interviewed in depth. No base rate, no population denominator." },
    { name: "Wikidata Query Service", provider: "fetched",
      url: "https://query.wikidata.org/",
      note: "Occupation labels and student-of links by birth century. A catalogue of who editors wrote about, not a census of practitioners." }
  ],

  limits: [
    "**A register counts recognition, not realization.** It records the people a tradition chose to remember as holders of its transmission. It cannot tell you whether they were awake, and it cannot tell you who was awake outside it.",
    "**The Chan count is inflated by its own genre.** Of 1,701 names, only 951 have any recorded sayings; the rest are entries in a genealogy. A lamp record is a claim of continuity, written to prove one.",
    "**Effective branching is an average over centuries, not a rate.** 1,701 names over 24 generations gives 1.36 per generation, but that includes centuries of growth and centuries of quiet. It is not a reproduction number you can project.",
    "**Sringeri's early dates are traditional.** The reign dates before 1380 come from the institution's own list, not from documents. The count of 36 is solid; the 34.5-year generation length is an average of a list that may have been back-filled.",
    "**The Karmapa line is not a student lineage.** Successors are identified as reincarnations, so a 57-year generation length measures how long a life lasts, not how long transmission takes.",
    "**Monastic counts are official claims.** The Tibetan and Chinese figures come from government statements; the Myanmar figure is the best-sourced. None is an independent census, and all count institutions' members, not awakened people.",
    "**Pew measures US adults, and this page adds up its bands.** 51% meditate at any frequency for spiritual reasons — 23% weekly, 7% monthly, 21% less often — but Pew never publishes that sum, so it is arithmetic on their figures rather than a topline. It says nothing about the world, where the share is far lower.",
    "**The last step of the funnel is unmeasured.** There is no population estimate of persistent nondual awareness. Martin's sample is people who claimed it and joined a community that validated the claim; it has no denominator. The page therefore shows a band and says what it depends on.",
    "**Wikidata is a catalogue.** The same tradition yields 20 'Zen masters' and 473 'Buddhist monks' in the same century. That ratio is a fact about editors and is the reason this page does not use those counts as its measurement.",
    "**Nothing here measures 'enlightened fallout' directly.** The page computes how many people a recognized teacher could have trained and how many lineages survive by chance. Those are bounds on transmission, not counts of awakening."
  ]
};
