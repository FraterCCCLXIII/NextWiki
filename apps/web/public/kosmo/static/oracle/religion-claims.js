/* ============================================================================
   religion-claims.js — the numbers on the religion page that are published
   rather than fetched.

   Every figure here comes from a report or a paper, with the sample and the
   year attached, because the difference between "28% of Americans are
   unaffiliated" and "28% of respondents in one survey said so" is the whole
   argument. Where a number is a secondary tabulation, or a survey-specific
   estimate that another survey contradicts, the note says so.

   Nothing in this file is computed. The model is in religion-model.js; the
   fetched series are in religion-data.js.
   ============================================================================ */
window.RELIGION_CLAIMS = {
  generated: "2026-11-02",

  /* ------------------------------------------------------- global identity ---
     2,700+ censuses and surveys covering 99.98% of world population, base
     2020, published June 2025. The 2010 column is Pew's own back-subtraction
     from the reported point changes, which is why it is labelled as derived in
     the caption rather than presented as an independent measurement.          */
  composition: {
    yearA: 2010, yearB: 2020,
    affiliated: [76.7, 75.8],
    groups: [
      { name: "Christians", color: "#8aa4be", a: 30.6, b: 28.8 },
      { name: "Muslims", color: "#a9c0b4", a: 23.8, b: 25.6 },
      { name: "unaffiliated", color: "#c4a373", a: 23.3, b: 24.2 },
      { name: "Hindus", color: "#a396b3", a: 14.9, b: 14.9 },
      { name: "Buddhists", color: "#c28181", a: 4.9, b: 4.1 },
      { name: "other religions", color: "#7e8d9e", a: 2.2, b: 2.2 }
    ],
    projected: {
      year: 2060,
      note: "Pew's 2015-base projection is not drawn: it is on a baseline the Center has since revised, and no post-2020 projection currently exists. It said Christians 31→32%, Muslims 24→31%, unaffiliated 16→13%, with Buddhists shrinking in absolute numbers."
    }
  },

  /* -------------------------------------------------------- US switching ---
     Religious Landscape Study 2023-24: 36,908 adults, ABS design, ±0.8 pts.
     The 2007 and 2014 waves were telephone, and Pew warns that the mode change
     makes some comparisons non-equivalent — so the 2007 Christian figure is
     used and the 2007 unaffiliated figure is not, because the Center's own
     pages do not state it and the number that circulates for it conflates a
     global share with a US one.                                               */
  switching: {
    identity: [
      { year: 2007, christian: 78, none: null },
      { year: 2014, christian: 71, none: 23 },
      { year: 2023, christian: 62, none: 29 }
    ],
    retention: [
      { name: "Hindu", v: 82 },
      { name: "Muslim", v: 77 },
      { name: "Jewish", v: 76 },
      { name: "unaffiliated", v: 73 },
      { name: "Protestant", v: 70 },
      { name: "Catholic", v: 57 }
    ],
    ratio: [
      { name: "Catholicism", out: 8.4 },
      { name: "Christianity, all", out: 6.0 },
      { name: "Protestantism", out: 1.8 }
    ],
    formerChristian: 21.9,
    raisedReligiousNowNone: 20.2,
    raisedNoneNowReligious: 3.5,
    switchers: 35
  },

  /* --------------------------------------------------------- belief, US ---
     GSS BELIEF was asked in 1988 and then every wave from 2006. These are the
     1988 and 2022 endpoints; the middle categories are flat across the period
     and no intermediate wave values are drawn, because none were verified.   */
  belief: {
    categories: [
      { name: "knows God exists, no doubts", a: 63, b: 50, color: "#8aa4be" },
      { name: "believes in a higher power", a: 7.4, b: 13.3, color: "#c4a373" },
      { name: "agnostic", a: 3.6, b: 7.4, color: "#a396b3" },
      { name: "does not believe in God", a: 1.5, b: 7.0, color: "#c28181" }
    ],
    middle: [24, 23],
    pew: [
      { year: 2007, v: 92 },
      { year: 2014, v: 89 },
      { year: 2023, v: 83 }
    ],
    pewNote: "Pew asks a different question — belief in God or a universal spirit — so its 92→83 is reported beside the GSS series, never joined to it.",
    spiritual: 70,
    sbnr: 22,
    soul: 83,
    beyond: 81,
    sudden: 45,
    encountered: 30
  },

  /* ----------------------------------------------------------- practices ---
     NHIS complementary-health supplements. The 2012 module changed, which is
     why the same year is reported as 4.1% by the NIH release and 7.5-8.3% by
     other tabulations; the rise to 2017 is therefore partly an artefact and the
     caption says so. Psychedelic figures come from three surveys that disagree
     by up to 50%, and each is drawn with its own denominator.                 */
  practice: {
    meditation: [
      { year: 2012, v: 4.1, src: "NHIS" },
      { year: 2017, v: 14.2, src: "NHIS" },
      { year: 2022, v: 17.3, src: "NHIS", flag: "secondary" }
    ],
    yoga: [
      { year: 2012, v: 9.5, src: "NHIS" },
      { year: 2017, v: 14.3, src: "NHIS" },
      { year: 2022, v: 16.9, src: "NHIS" }
    ],
    psilocybin: [
      { year: 2024, v: 2.8, src: "NSDUH 2024, ages 12+", flag: "ages 12+" },
      { year: 2025, v: 4.26, src: "RAND 2025, adults" }
    ],
    hallucinogen: [
      { year: 2023, v: 9.0, src: "MTF 2023, ages 19-30" },
      { year: 2023, v: 4.0, src: "MTF 2023, ages 35-50" }
    ],
    microdose: { v: 4.0, src: "RAND 2025, ~10M adults" }
  },

  /* --------------------------------------------------- published growth --- */
  published: {
    mindfulnessPapers: { n: 16581, from: 1966, to: 2021, rate: 23.5, doubling: 3.0 },
    meditationPapers1900s: 625
  },

  /* -------------------------------------------------------- thresholds ---
     Centola et al. 2018 found a committed minority of ~25% could overturn an
     established convention in a coordination game. The same authors warn the
     number varies with the setting; an analysis of a real pro-social behaviour
     puts its tipping point at 50-65%.                                         */
  thresholds: {
    lab: 25,
    real: [50, 65],
    note: "25% is a coordination game with a cash incentive to agree. Nobody has measured the tipping point for a worldview, and the one real-behaviour estimate is two to three times higher."
  },

  /* ---------------------------------------------------- the developmental map ---
     Asserted. There is no instrument behind any cell. 0 absent, 1 a seed or a
     lineage, 2 a live minority, 3 the tradition's centre of gravity. The
     "updated" string names the form the next stage takes inside the tradition,
     which is the mechanism the model's update lever stands for.               */
  traditions: {
    stages: ["Traditional", "Modern", "Pluralistic", "Integral", "Nondual"],
    rows: [
      { name: "Christianity", cells: [3, 1, 1, 0, 1],
        updated: "liberal Protestantism → contemplative Christianity → integral Christianity" },
      { name: "Islam", cells: [3, 1, 0, 0, 1],
        updated: "modernist Islam → Sufi nonduality" },
      { name: "Hinduism", cells: [2, 1, 1, 0, 2],
        updated: "reform Hinduism → Advaita → evolutionary nonduality" },
      { name: "Buddhism", cells: [1, 1, 1, 0, 3],
        updated: "modern insight → secular mindfulness → dzogchen and mahamudra" },
      { name: "Judaism", cells: [3, 1, 1, 0, 1],
        updated: "Reconstructionist → Jewish renewal → Kabbalistic nonduality" },
      { name: "Daoism", cells: [2, 0, 0, 0, 2],
        updated: "internal alchemy → nondual cosmology" },
      { name: "secular / none", cells: [0, 3, 2, 1, 0],
        updated: "humanism → metamodern spirituality" },
      { name: "New Age / psychedelic", cells: [1, 1, 2, 1, 1],
        updated: "psychedelic mysticism → nondual integration" },
      { name: "integral / post-trad", cells: [0, 0, 1, 3, 1],
        updated: "integral → metamodern → evolutionary" }
    ],
    note: "A tradition's centre of gravity is not a claim about every adherent. Most Christians are not at the mythic stage and most Buddhists are not nondual; the table records where each tradition's institutions, liturgies and authorities sit, which is what determines what they can transmit."
  },

  /* ---------------------------------------------------------------- vessel ---
     Two things are being separated here, and neither has an instrument:

       carriers   the repeatable, embodied parts of a tradition — assembly,
                  rites of passage, calendar, recitation, music, food, place,
                  burial. They are what a person can keep doing after they stop
                  believing the cosmology, which is why "culturally Catholic"
                  is a coherent sentence and "culturally Arian" is not.

       the centre  the story the carriers are read inside. Moving it does not
                  require discarding the carriers; that is the whole claim.

     Carrier strengths below are judgements on a 0-3 scale, exactly like the
     developmental map, and drawn the same way: dashed, labelled, arguable.  */
  vessel: {
    modes: [
      { key: "personal", name: "Personal", sub: "the witness · continuity of awareness", short: "the witness",
        color: "#c4a373",
        carried: "devotion, confession, solitary prayer, retreat, monastic cell",
        evidence: "practice counts (Pew, NHIS) — the only mode with a survey",
        breaks: "becomes self-improvement: a private attainment with no transmission and no assembly" },
      { key: "impersonal", name: "Impersonal", sub: "emptiness · no-self · awareness without a subject", short: "no-self",
        color: "#a396b3",
        carried: "transmission lineages — Advaita, dzogchen, Chan, Sufi, Christian mysticism",
        evidence: "registers count recognition, not realisation; no prevalence study exists",
        breaks: "becomes a claim rather than a competence: people assert nonduality who have never been trained in it" },
      { key: "collective", name: "Collective", sub: "shared field · we-space · synchrony", short: "the shared field",
        color: "#a9c0b4",
        carried: "assembly, chant, festival, pilgrimage, service — anything that makes many bodies do one thing",
        evidence: "no instrument at all. Group synchrony is measured in the lab; collective awakening is not measured anywhere",
        breaks: "becomes crowd feeling: intensity without insight, and it does not survive the group disbanding" }
    ],

    carriers: [
      { name: "weekly assembly", cells: [1, 1, 3] },
      { name: "rites of passage", cells: [1, 0, 2] },
      { name: "calendar and festival", cells: [1, 0, 3] },
      { name: "recitation and scripture", cells: [2, 3, 2] },
      { name: "music and chant", cells: [2, 1, 3] },
      { name: "food, fast and feast", cells: [3, 1, 2] },
      { name: "pilgrimage and place", cells: [2, 1, 2] },
      { name: "monastic / retreat", cells: [3, 3, 1] },
      { name: "lineage transmission", cells: [2, 3, 0] },
      { name: "service and burial", cells: [1, 0, 3] }
    ],
    carrierNote: "0 absent · 1 weak · 2 live · 3 primary. Judgements, not counts: they say which carrier has historically carried which mode, which is what a reformer needs to know before removing one.",

    /* The failure modes are named because each one is a way of losing the
       tradition while appearing to keep it, and they are not the same loss. */
    regimes: [
      { key: "hold", name: "The vessel holds the old centre", body: "Carriers strong, centre where it was. Stable, and the stable case is the one that ages: the forms keep working while the cosmology they encode stops being believed by anyone under forty. This is the museum, and it is comfortable." },
      { key: "carry", name: "The vessel carries a new centre", body: "Carriers strong, centre moved. The same calendar, the same chant, the same burial, read inside an evolutionary cosmology. Identity survives because nothing a person does on a Sunday had to change; what changed is the story the doing sits in." },
      { key: "outrun", name: "The centre outruns the form", body: "Centre moved, carriers gone. Practice without a body: the fastest-growing religious category in the rich world, and the one with the lowest fertility and the weakest transmission. It produces practitioners and no grandchildren." },
      { key: "fade", name: "Neither", body: "Carriers gone and centre unmoved. Nothing is transmitted because nothing is done, and nothing is imagined because nothing is said. This is not secularisation; it is simply the end of a lineage." }
    ],

    /* How much carrier strength a given centre-shift needs. The curve is the
       page's argument in one line: the further the centre moves, the more the
       form has to carry, because the surrounding culture no longer teaches the
       new centre for free. */
    threshold: { base: 0.35, slope: 0.45 },

    anchors: [
      { name: "US Catholic, 57% retention", k: 0.57, c: 0.18 },
      { name: "US Hindu, 82% retention", k: 0.82, c: 0.10 },
      { name: "US unaffiliated, 73% retention", k: 0.30, c: 0.55 }
    ],

    note: "No instrument measures a tradition's centre of gravity or its carrier strength. The axes are an argument; the anchors are Pew's measured retention rates placed on them by hand, and every one would move if the placement were changed. Retention is not carrier strength — it is the outcome the carrier is supposed to explain — so the anchors are consistency checks, not calibrations."
  },

  sources: [
    { name: "Pew Research Center — Religious Landscape Study 2023-24", provider: "Pew, Feb 2025",
      url: "https://www.pewresearch.org/religion/2025/02/26/religious-switching/",
      note: "36,908 US adults, ABS, ±0.8 pts. Retention by tradition, gross flows, and the 6:1 leave-to-enter ratio." },
    { name: "Pew — How the global religious landscape changed, 2010-2020", provider: "Pew, June 2025",
      url: "https://www.pewresearch.org/religion/2025/06/09/how-the-global-religious-landscape-changed-from-2010-to-2020/",
      note: "2,700+ censuses and surveys, 201 countries. The 2010 column is derived by back-subtracting reported point changes." },
    { name: "Pew — Modeling the future of religion in America", provider: "Pew, Sept 2022",
      url: "https://www.pewresearch.org/religion/2022/09/13/religious-projections-methodology-2/",
      note: "The most explicit published transmission parameters: fertility by group, switching by age band, retention, mother-teen transmission." },
    { name: "Pew — Spirituality among Americans", provider: "Pew, Dec 2023",
      url: "https://www.pewresearch.org/religion/2023/12/07/spirituality-among-americans/",
      note: "n = 11,201. 70% spiritual, 22% spiritual but not religious, 45% report a sudden connection with something beyond the world." },
    { name: "GSS BELIEF, tabulated by Ryan Burge", provider: "GSS / graphsaboutreligion",
      url: "https://www.graphsaboutreligion.com/p/do-educated-people-believe-in-god",
      note: "Endpoints only. GSS asks BELIEF in 1988 and every wave from 2006; no full annual table was verified, so only 1988 and 2022 are drawn." },
    { name: "NCHS Data Brief 501 — yoga, meditation, chiropractic", provider: "CDC, June 2024",
      url: "https://www.cdc.gov/nchs/products/databriefs/db501.htm",
      note: "2022 NHIS. Yoga 16.9% is verified in the brief; meditation 17.3% is a widely repeated secondary figure — a peer-reviewed re-analysis gives 18.3%." },
    { name: "NSDUH 2024 psilocybin estimate", provider: "SAMHSA data, AJPM Focus 2026",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13105262/",
      note: "2.8% of persons 12+ reported past-year psilocybin use, ~8.0 million people. A different denominator from RAND's 4.26% of adults." },
    { name: "RAND Psychedelics Survey 2025", provider: "RAND, Sept 2025",
      url: "https://www.rand.org/pubs/research_reports/RRA4334-1.html",
      note: "n = 10,122 probability-based. Psilocybin 4.26%, microdosing ~4% of adults. RAND flags its own definitional problems." },
    { name: "Baminiwatta & Solangaarachchi — bibliometrics of mindfulness", provider: "Mindfulness, 2021",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8282773/",
      note: "16,581 Web of Science papers 1966-2021; 23.5% a year since 2006, a 3.0-year doubling. The independent check on this page's fitted rate." },
    { name: "Centola, Becker, Brackbill & Baronchelli — tipping points", provider: "Science, 2018",
      url: "https://www.science.org/doi/10.1126/science.aas8827",
      note: "~25% committed minority tipped a coordination game. The authors state the threshold varies with the setting; a real pro-social behaviour is estimated at 50-65%." },
    { name: "Cook-Greuter ego development, via Daniels et al. 2018", provider: "PMC, 2018",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6208876/",
      note: "~80% conventional, ~10% post-conventional in US adults. Cook-Greuter's own text gives 15-20% for post-conventional, which is why the page reports a range." },
    { name: "Martin — 319 adults reporting persistent non-symbolic experience", provider: "Consciousness Journal, 2020",
      url: "https://digitalcommons.ciis.edu/conscjournal/vol8/iss8/1/",
      note: "6-12 hour interviews, grounded theory, five categories of change. A purposive sample of claimants with no population denominator: not a prevalence estimate." },
    { name: "Griffiths et al. — psilocybin mystical-type experience", provider: "Psychopharmacology, 2006",
      url: "https://pubmed.ncbi.nlm.nih.gov/16826400/",
      note: "61% of 36 volunteers met the Pahnke criteria for a complete mystical experience after 30 mg/70 kg. The strongest dose-response evidence for a nondual state, in the smallest kind of sample." },
    { name: "OpenAlex", provider: "fetched",
      url: "https://openalex.org/",
      note: "Works whose title or abstract mentions each term, by publication year. Counts are of works, not of quality; 2025 and 2026 are incomplete." },
    { name: "Wikimedia Pageviews API", provider: "fetched",
      url: "https://wikimedia.org/api/rest_v1/",
      note: "Ten articles, monthly, against total English Wikipedia views. Human traffic only." }
  ],

  limits: [
    "**No instrument measures a stage.** Spiral Dynamics and integral theory have no reliability study and no population prevalence. Every cell of the developmental map is an assertion, drawn hollow for that reason.",
    "**The post-conventional share is one author's estimate, twice.** Cook-Greuter's work is cited both as ~10% and as 15-20% post-conventional, from samples of a few thousand American adults. The page uses 10% as the country-map anchor and shows the range rather than picking the number that suits the argument.",
    "**Identity is not belief is not practice.** The Pew switching data count what people call themselves. A person can stop identifying as Christian and keep praying. The page keeps the three columns separate and never adds them.",
    "**There is no population prevalence for persistent nondual awareness.** Martin's 319 are people who claim it and volunteered to be interviewed. The page therefore shows zero to one percent as an assumption in a model, not a measurement, and the model's initial 0.3% is labelled as such.",
    "**The 2060 projection is not drawn.** Pew's published projection sits on a 2015 baseline the Center has since revised, and no post-2020 projection exists. Quoting it as current would be the most common error on this subject.",
    "**Country estimates are a mapping, not a measurement.** The WVS self-expression axis is not a stage measure; the logistic that turns it into a share is this page's construction, anchored to one US estimate. China's WVS sample is urban and small, so its 63 million is the least trustworthy number on the page and the largest.",
    "**Wikipedia is a shrinking channel.** Total English Wikipedia views fell from 7.67 to 6.10 billion a month in the window, and these articles fell faster. Per-10,000 is the only honest form; a raw view count would read as a collapse in interest when part of it is a collapse in the channel.",
    "**The 2012 meditation figure is partly an artefact.** The NHIS module changed, and other tabulations put 2012 at 7.5-8.3%. The 2012-to-2017 tripling is real in the survey and overstated by the redesign.",
    "**25% is not a law.** Centola's threshold comes from a coordination game with a small cash incentive to agree. The same literature puts a real behaviour at 50-65%, and no one has measured a worldview. The critical-mass chart shows how much the answer depends on the conformity exponent rather than asserting a number.",
    "**The vessel diagram is an argument, not a measurement.** No instrument scores a carrier or a centre of gravity. Its boundary is 0.35 + 0.45 × shift — two numbers this page chose — and its measured anchors are Pew's retention rates placed on the axes by hand. Retention is the outcome the carriers are supposed to explain, so the anchors check consistency rather than calibrating anything. The three modes are a typology; only the personal mode has a survey behind it.",
    "**The model is a scaffold, not a forecast.** Its initial shares, capacity ceilings and broadcast reach are assumptions; only the switching rates and retention are calibrated, to Pew's measured values. It has no regional structure, no migration, no war, and no economic feedback. It is useful for comparing levers and worthless as a prediction.",
    "**The awakening-event model is the weakest thing here.** One event per century at 100 million nondual adults is an arbitrary unit; a factor-of-ten change in it moves the answer tenfold. It is included because the question was asked, and labelled because it cannot be defended."
  ]
};
