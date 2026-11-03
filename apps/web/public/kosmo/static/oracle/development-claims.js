/* The curated half of `development.html`.

   This file is the opposite of a data file. Nothing here is measured by me;
   it is a record of what six developmental models claim, what instrument (if
   any) stands behind each, and how much of that has survived peer review.

   The `evidence` field is the page's whole argument, so the scale is explicit:

     2  an instrument exists, its reliability is published, and studies using
        it appear in peer-reviewed journals
     1  an instrument or a published study exists, but with a named gap —
        sample not representative, stage never found, concurrent validity only
     0  no instrument, or no peer-reviewed evidence

   A 0 is not an insult. Spiral Dynamics is a coaching framework with a large
   readership and no psychometric literature, and the page says exactly that
   rather than pretending the categories are incommensurable. */

window.DEV_CLAIMS = {
  generated: "2026-11-02",

  /* --------------------------------------------------------- the models --- */
  models: [
    {
      id: "sd", name: "Spiral Dynamics", short: "Spiral",
      origin: "Beck & Cowan 1996, after Clare W. Graves",
      claim: "Eight colour-coded vMEMEs in two tiers, each a worldview that supersedes the last.",
      measured: false,
      evidence: 0,
      note: "No published instrument, no reliability study, no confirmatory factor analysis, and no test of the invariant sequence. Cowan later declined to extend the colour scheme past Turquoise. Beck is quoted describing the 'Mean Green Meme' as invented rhetoric — 'let's invent the Mean Green Meme. Let's shame it a bit.'",
      url: "https://en.wikipedia.org/wiki/Spiral_Dynamics"
    },
    {
      id: "integral", name: "Integral theory", short: "Integral",
      origin: "Wilber 1995, Sex, Ecology, Spirituality",
      claim: "AQAL: quadrants, levels, lines, states, types. Development is a ladder of levels crossed by semi-independent lines.",
      measured: false,
      evidence: 0,
      note: "The quadrants are a taxonomy and the levels are adopted from the developmental literature rather than measured by it. Ferrer argues the model is neo-perennialist — traditions may reach the summit only by accepting Wilber's itinerary and endpoint — and documents an editorial dispute over critical publication. No AQAL instrument exists.",
      url: "https://en.wikipedia.org/wiki/Integral_theory"
    },
    {
      id: "loevinger", name: "Ego development", short: "Loevinger",
      origin: "Loevinger & Wessler 1970; Hy & Loevinger 1996",
      claim: "Nine stages from Impulsive to Integrated, measured by sentence completion.",
      measured: true,
      evidence: 2,
      note: "The strongest evidence base here: over 350 studies, published reliability and construct validity, non-skippable sequence. Loevinger held that most adults sit at E5 and that E9 is rarely attained. Westen's objection is that scoring rests on verbal material and so confuses structure with content.",
      url: "https://en.wikipedia.org/wiki/Loevinger%27s_stages_of_ego_development"
    },
    {
      id: "kohlberg", name: "Moral development", short: "Kohlberg",
      origin: "Kohlberg 1958; Moral Judgement Interview",
      claim: "Six stages in three levels, scored for the form of justification rather than its content.",
      measured: true,
      evidence: 1,
      note: "Real cross-cultural support for sequence: Snarey's meta-analysis of 45 studies in 27 countries. But Stage 6 was never reliably found, a 'stage 4½' had to be posited to absorb apparent regression, and Shweder's and Haidt's work shows the structure-only model misses moral content that varies by culture. Gilligan's critique is that the scale is androcentric.",
      url: "https://en.wikipedia.org/wiki/Kohlberg%27s_stages_of_moral_development"
    },
    {
      id: "kegan", name: "Orders of consciousness", short: "Kegan",
      origin: "Kegan 1982, 1994; Subject-Object Interview",
      claim: "Five orders from Impulsive to Self-transforming; modern life demands the fourth.",
      measured: true,
      evidence: 1,
      note: "A real interview instrument with a published manual, used in dissertations and coaching research. The headline claim — 'less than half of all adults' reach fourth order — is widely repeated but its sampling basis is not documented in the sources the page could reach.",
      url: "https://en.wikipedia.org/wiki/Robert_Kegan"
    },
    {
      id: "lectical", name: "Hierarchical complexity", short: "Lectical",
      origin: "Fischer; Dawson & Lectica; applied to history by the IAM",
      claim: "A continuous scale in which each level spans 100 points, scored from text by a calibrated rater.",
      measured: true,
      evidence: 1,
      note: "The instrument's convergence with the stage models is published and strong (r = .85 against Kohlberg, 72% of variance, 543 scored performances). The historical application — 165 texts across six corpora — is not peer reviewed, and its dictionary was trained on modern interview material, which is the sharpest objection to scoring an oral tradition with it.",
      url: "https://appliedmetatheory.org/donations/cultural-complexity-index/"
    }
  ],

  /* ------------------------------------------------------- the criteria --- */
  criteria: [
    { id: "instrument", label: "A published instrument" },
    { id: "reliability", label: "Reliability reported" },
    { id: "sample", label: "Representative sample" },
    { id: "peer", label: "Peer-reviewed use" },
    { id: "tested", label: "Predictions tested" }
  ],

  /* evidence[model][criterion] on the same 0/1/2 scale */
  evidence: {
    sd:       [0, 0, 0, 0, 0],
    integral: [0, 0, 0, 0, 0],
    loevinger:[2, 2, 1, 2, 2],
    kohlberg: [2, 2, 1, 2, 1],
    kegan:    [2, 1, 0, 1, 1],
    lectical: [2, 2, 1, 0, 2]
  },

  evidenceNotes: {
    "sd.instrument": "Commercial quizzes exist; none has published psychometrics.",
    "integral.instrument": "None. The levels are borrowed from the other rows.",
    "kegan.sample": "Samples are small and often organisational.",
    "lectical.peer": "The historical application ships as a book and a white paper, not a journal article.",
    "kohlberg.tested": "Stage 6 was never reliably observed."
  },

  /* ------------------------------------------------------ the stage map ---
     Lectical anchors are from the IAM white paper; the mappings between the
     colour bands and the other models are that paper's assertion, not a
     measurement, and the page draws them as assertions. */
  lectical: {
    min: 800, max: 1400,
    bands: [
      { from: 850, to: 900, label: "Magenta", color: "#a396b3" },
      { from: 900, to: 1000, label: "Red", color: "#c28181" },
      { from: 1000, to: 1050, label: "Amber", color: "#c4a373" },
      { from: 1050, to: 1100, label: "Orange", color: "#8aa4be" },
      { from: 1100, to: 1175, label: "Green", color: "#a9c0b4" },
      { from: 1175, to: 1225, label: "Teal", color: "#7fb3b0" },
      { from: 1225, to: 1275, label: "Turquoise", color: "#8fb8c9" }
    ],
    anchors: [
      { score: 875, label: "Magenta" },
      { score: 950, label: "Red" },
      { score: 1025, label: "Amber" },
      { score: 1100, label: "Orange" },
      { score: 1175, label: "Green" },
      { score: 1200, label: "Teal" },
      { score: 1250, label: "Turquoise" }
    ]
  },

  /* rows for the stage-stack chart: where each model's stages sit on the
     Lectical axis, and whether that placement is measured or asserted */
  stack: [
    { model: "Spiral Dynamics", kind: "asserted", marks: [
      { at: 875, label: "Beige" }, { at: 950, label: "Purple/Red" }, { at: 1025, label: "Blue" },
      { at: 1100, label: "Orange" }, { at: 1175, label: "Green" }, { at: 1200, label: "Yellow" },
      { at: 1250, label: "Turquoise" }
    ] },
    { model: "Loevinger", kind: "measured", marks: [
      { at: 900, label: "E3" }, { at: 1025, label: "E4 Conformist" }, { at: 1100, label: "E6" },
      { at: 1175, label: "E8 Autonomous" }, { at: 1250, label: "E9 Integrated" }
    ] },
    { model: "Kohlberg", kind: "measured", marks: [
      { at: 1025, label: "Stage 3" }, { at: 1100, label: "Stage 4" }, { at: 1200, label: "Stage 5" }
    ] },
    { model: "Kegan", kind: "measured", marks: [
      { at: 1025, label: "Order 3" }, { at: 1125, label: "Order 4" }, { at: 1250, label: "Order 5" }
    ] }
  ],

  /* -------------------------------------------------------------- the CCI ---
     Only two of the six corpus means are published on the open web; the range
     and the count are. The page shows what exists and says what does not. */
  cci: {
    texts: 165,
    perCorpus: "25–32",
    min: 814,
    max: 1388,
    publishedMeans: [
      { corpus: "Tribal", score: 946, note: "oral narrative recorded in the modern era, placed at a conventional Paleolithic marker" },
      { corpus: "Postmodern", score: 1326, note: "the top of the six corpora" }
    ],
    missing: "The other four corpus means, per-text scores, and any reliability coefficient for the 165 historical texts are not published on the open web. They are reported as residing in chapter 3 of the book.",
    validation: {
      n: 543,
      kohlberg: 0.85,
      variance: 0.72,
      note: "Convergence of the Lectical scale with the stage models, on interview data — not validation of the historical corpus."
    }
  },

  /* ------------------------------------------------------------ quotes --- */
  anchors: [
    { value: "2,500 yr", label: "rise time, published", note: "Wand & Hoyer: width of the logistic between its plateaus, 3σ, 23 areas" },
    { value: "77%", label: "variance on SPC1", note: "nine complexity characteristics collapse onto one axis" },
    { value: "1,700 yr", label: "rise time, this page", note: "25th to 75th percentile of an independent composite, 17 areas" },
    { value: "814–1388", label: "Lectical span, 165 texts", note: "IAM Cultural Complexity Index, five millennia" }
  ],

  sources: [
    { name: "The characteristic time scale of cultural evolution", provider: "Wand & Hoyer, PNAS Nexus 3(2):pgae009 (2024)",
      url: "https://doi.org/10.1093/pnasnexus/pgae009",
      note: "The 2,500-year figure, the 23 areas, the logistic on RelTime, and the finding that no institutionally continuous sequence lasts long enough to accomplish the transition alone." },
    { name: "Seshat Global History Databank — Polaris release", provider: "Seshat / Evolution Institute",
      url: "https://seshatdatabank.info/data",
      note: "619 polities with their own start and end years, 26,033 coded rows, 26 regions with enough of a run to align. Every measured number on this page comes from here." },
    { name: "The Cultural Complexity Index", provider: "Institute of Applied Metatheory (Dempsey 2026)",
      url: "https://appliedmetatheory.org/donations/cultural-complexity-index/",
      note: "165 texts scored on the Lectical scale, 814 to 1388. Not peer reviewed; the results ship as a book. No country scores exist, and no reliability coefficient is published." },
    { name: "The Cultural Complexity Index Project — methodology", provider: "Brendan Graham Dempsey, Substack",
      url: "https://brendangrahamdempsey.substack.com/p/the-cultural-complexity-index-project",
      note: "The author's own account of what the index scores and how: a continuous Lectical measure applied to historical texts, read as evidence for and against cultural complexification. It is the design statement the institute's page summarises, and it is explicit that the historical application is a research programme rather than a validated instrument." },
    { name: "Sequence representation and cultural systems", provider: "Jon-And et al., BBS 49:e402 (2026)",
      url: "https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/abs/sequence-representation-and-cultural-systems-are-necessary-for-cumulative-culture/2FD341B860FE4CD165C6C8ABB3AF9029",
      note: "A commentary on Chater & Christiansen's 'social tinkering' target article: cumulative culture needs sequence representation and interacting trait systems, not just local improvisation." },
    { name: "Individualism–Collectivism: reconstructing Hofstede's dimension", provider: "Akaliyski, Vignoles, Welzel & Minkov, JPSP 130(2):308 (2026)",
      url: "https://doi.org/10.1037/pspp0000580",
      note: "A 102-country reconstruction of Hofstede's dimension. Included because it is a different kind of object from everything else on the page: a measured, validated, cross-national cultural variable, and a reminder that 'culture' in the quantitative literature usually means something narrower than any stage model means by it." },
    { name: "A systems approach to cultural evolution", provider: "Buskell, Enquist & Jansson, HSS Communications 5:131 (2019)",
      url: "https://doi.org/10.1057/s41599-019-0343-5",
      note: "The modelling framework behind the cultural-systems half of the BBS commentary: traits interact, and the interactions are what stabilise or destabilise a culture." },
    { name: "The validation of a new scoring method for ego development", provider: "O'Fallon et al., Heliyon 6:e03472 (2020)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7090352/",
      note: "73 and 71 inventories, four scorers, weighted kappa. The most recent instrument with published agreement statistics." },
    { name: "Inglehart–Welzel dimensions, recomputed", provider: "kwinkunks / ai-values, from IVS WVS & EVS microdata",
      url: "https://github.com/kwinkunks/ai-values",
      note: "Ten items, weighted by S017, two components with varimax rotation, rescaled. An independent recomputation, because the official 2023 poster is distributed only as a flat image with no table. It reproduces the shape of the map and not its exact points — Denmark sits about a unit lower on the secular axis here than on the poster." },
    { name: "Building Knowledge-Guided Lexica to Model Cultural Variation", provider: "Havaldar et al., NAACL 2024",
      url: "https://aclanthology.org/2024.naacl-long.12/",
      note: "County-level individualism from 1.5 billion geolocated tweets, 2009–2015, counted with seed-word lexica expanded through FastText embeddings. Their Figure 3 is the map that circulates as 'Collectivism vs Individualism in the U.S.'. The county scores are published, so the page checks them rather than trusting them." },
    { name: "Individualism, collectivism, and the American frontier", provider: "Vandello & Cohen, JPSP 77(2):279 (1999)",
      url: "https://psycnet.apa.org/record/1999-03699-004",
      note: "A state index built from behaviour — divorce, living alone, grandparents in the home, single-occupant car deaths, Libertarian voting, self-employment. The only external benchmark the tweet index has, and it is 1990s behaviour against 2009–2015 word use." },
    { name: "What is a Singleton?", provider: "Bostrom (2006)",
      url: "https://nickbostrom.com/fut/singleton",
      note: "Not a developmental model, and included only for one move the page borrows: the claim that a system can lock in a level irreversibly. It is the same ratchet the stage models assume and never test." }
  ],

  /* ------------------------------------------------------------- footer --- */
  limits: [
    "**The composite is mine, not the published one.** The nine characteristics are rebuilt from raw Seshat variables because the scoring rules behind SPC1 are not published in full. It lands at 46% of variance on the first component against the paper's 77%, so the trajectories are an index of the same construct, not a reproduction of theirs.",
    "**Every mapping between models is an assertion.** That Amber is 1025 or that Teal is 1200 comes from a white paper, not from a study. The page draws those as dashes on purpose.",
    "**Stage models have no population data.** The famous figures (1.9% post-autonomous, 'less than half reach fourth order') come from small, deliberately unrepresentative samples, and the page reports them as such rather than as prevalence.",
    "**Seshat is not the world.** 619 polities across 26 alignable regions, weighted toward places with written records. Oral and non-literate societies are underrepresented by construction, which is exactly the bias the CCI's critics also name.",
    "**The tweet index is a weak instrument.** Its county map has never been validated against anything county-level. The one external check is fifty states against a 1999 behavioural index, at about a fifth of the variance, and the corpus ends in 2015 — before the platform changed. It is on the page as an example of a cultural measure with a published pipeline and almost no external check, not as evidence about any county.",
    "**The survey dimensions are recomputed, not transcribed.** The official 2023 poster is a flat image, so the coordinates here come from an independent factor analysis of the same microdata. Some points move by up to a unit; the two-factor structure itself is contested, with Inglehart's own later work favouring a single modernisation factor.",
    "**Development is not progress.** A more complex society is not a better one; the Archaic world produced the first written literature and the first monumental cruelty. Nothing here ranks societies, and the page would be wrong if it did."
  ]
};
