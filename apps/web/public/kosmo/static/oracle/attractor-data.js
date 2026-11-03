/* ============================================================================
   ATTRACTOR DATA
   ----------------------------------------------------------------------------
   Two distinct bodies of material, kept apart on purpose:

   1. THE CORPUS — the public aggregate output of "Co-creating the Third
      Attractor" (Daniela Bomatter), 72 conversations, and its analysis page:
      1,210 codings across fifteen propositions. Every count below is copied
      from the published page, not estimated. Where I have computed a new
      statistic from those counts it is labelled "derived".

   2. THE LITERATURE — provenance and definitions of "polycrisis",
      "metacrisis" and "third attractor" from the primary sources, with the
      criticisms each has attracted.

   The page's job is to hold these together without pretending the corpus is
   evidence for the literature or the literature is authority over the corpus.
   ============================================================================ */
var ATTRACT = (function () {
  "use strict";

  /* ---------------------------------------------------------------- corpus */
  var corpus = {
    title: "Co-creating the Third Attractor",
    author: "Daniela Bomatter",
    tagline: "From Meta-Crisis to Meta-Coherence",
    conversations: 72,
    insights: 41,
    series: 9,
    latest: { no: 71, guest: "Ravi Chaudhry", title: "From Capitalism to Peopleism", date: "30 Oct 2026" },
    codings: 1210,
    claims_n: 15,
    agree: 436,
    expand: 623,
    disagree: 151,
    /* The analysis states 60 codings of engaged/silent per claim, though the
       corpus itself lists 72 conversations. See AUDIT below. */
    codingBase: 60
  };

  var series = [
    { code: "AR", name: "The Artists", n: 2,
      blurb: "Art as a way of knowing. What images, music and making reach that argument cannot." },
    { code: "DD", name: "The Deep Divers", n: 14,
      blurb: "The long view. Metatheory, the structures of consciousness, the histories of mind." },
    { code: "EK", name: "The Earth Keepers", n: 14,
      blurb: "Repair at the scale of land and living systems. Regeneration, ecology, our place in the biosphere." },
    { code: "IW", name: "The Inner Workers", n: 17,
      blurb: "Change that starts inside. Presence, coherence and inner development as civilisational infrastructure." },
    { code: "MM", name: "The Map Makers", n: 11,
      blurb: "Frameworks for navigating without a map. Models, stages, integral cartographies." },
    { code: "PI", name: "The Pioneers", n: 9,
      blurb: "Already building it. Practitioners running experiments ahead of the consensus." },
    { code: "SW", name: "The Story Weavers", n: 12,
      blurb: "The stories we live inside. Media, education, myth, and why the inherited story is failing." },
    { code: "SB", name: "The System Builders", n: 19,
      blurb: "The machinery a different future would run on. Money, governance, policy, organisational form." }
  ];

  /* ------------------------------------------------------- the three terms */
  var terms = [
    {
      id: "polycrisis",
      name: "Polycrisis",
      subtitle: "The symptoms, entangled",
      claim: "Multiple crises in multiple global systems become causally entangled, and the harms exceed the sum of what each would do alone.",
      unit: "A world system of systems",
      origin: "Edgar Morin &amp; Anne-Brigitte Kern, <em>Terre-Patrie</em>, 1993 (English 1999)",
      popularised: "Jean-Claude Juncker, 2016 &rarr; EU studies &rarr; Adam Tooze, <em>Financial Times</em>, 28 Oct 2022",
      quote: "&ldquo;In the polycrisis the shocks are disparate, but they interact so that the whole is even more overwhelming than the sum of the parts.&rdquo;",
      attrib: "Adam Tooze, FT, 2022",
      academic: "Lawrence, Janzwood &amp; Homer-Dixon, Cascade Institute, and <em>Global Sustainability</em> (2024)"
    },
    {
      id: "metacrisis",
      name: "Metacrisis",
      subtitle: "The generator of the symptoms",
      claim: "The crises share root causes &mdash; incentive topology, worldview, or both &mdash; and treating them separately cannot work.",
      unit: "Generator functions",
      origin: "Lane &amp; van der Leeuw, 2011 (wide sense); Hedlund &amp; Esbj&ouml;rn-Hargens claim coinage, 2015; Club of Rome&rsquo;s &ldquo;problematique&rdquo;, 1970",
      popularised: "Daniel Schmachtenberger (podcasts, 2017&ndash;2020); Zak Stein; Jonathan Rowson; the Consilience Project",
      quote: "&ldquo;The crisis within and between all the world&rsquo;s major crises, a root cause that is at once singular and plural.&rdquo;",
      attrib: "Jonathan Rowson, Perspectiva, 2023",
      academic: "Contested and mostly non-academic; four independent lineages, no settled metric"
    },
    {
      id: "third",
      name: "Third Attractor",
      subtitle: "The alternative basin",
      claim: "Neither chaotic breakdown nor centralised control. A third stable state that handles power without concentrating it.",
      unit: "A basin of attraction",
      origin: "Schmachtenberger, <em>In Search of the Third Attractor</em>, Rebel Wisdom, 2020",
      popularised: "The Game B / metamodern milieu; this corpus; Alexander Bard&rsquo;s &ldquo;Ecotopia&rdquo;",
      quote: "&ldquo;Flee the chaos and you build the cage. Flee the cage and you invite the chaos. The two failure valleys feed each other.&rdquo;",
      attrib: "Benjamin Life, paraphrasing Schmachtenberger",
      academic: "No peer-reviewed literature; one documented critique (McLeod, &ldquo;politically implausible&rdquo;)"
    }
  ];

  /* ---------------------------------------------------------------- genesis */
  var timeline = [
    { year: "1970", label: "The problematique", text: "The Club of Rome&rsquo;s founding document names a &ldquo;meta-system of problems&rdquo; whose solution lies beyond the concepts we ordinarily use.", tag: "metacrisis precursor" },
    { year: "1976", label: "Crisologie", text: "Morin publishes <em>Pour une crisologie</em> in <em>Communications</em> &mdash; crisis as a general object of study, not an event.", tag: "polycrisis precursor" },
    { year: "1993", label: "Terre-Patrie", text: "Morin &amp; Kern use <em>polycrise</em>: interwoven economic, ecological, social and cultural crises cannot be treated in isolation.", tag: "polycrisis coined" },
    { year: "2011", label: "Social meta-crisis", text: "Lane &amp; van der Leeuw diagnose crises sharing &ldquo;a common origin&hellip; in the way our society organizes its processes of innovation.&rdquo;", tag: "metacrisis, wide sense" },
    { year: "2015", label: "Integral metatheory", text: "Hedlund &amp; Esbj&ouml;rn-Hargens define metacrisis against polycrisis: <em>not just</em> many exterior crises, but their interior, intersubjective context.", tag: "the distinction" },
    { year: "2016", label: "Juncker", text: "&ldquo;They have not only arrived at the same time. They also feed each other.&rdquo; The term enters governance vocabulary.", tag: "polycrisis popularised" },
    { year: "2020", label: "Third attractor", text: "Rebel Wisdom&rsquo;s two-part series with Schmachtenberger sets out catastrophe, dystopia, and the third basin.", tag: "third attractor" },
    { year: "2021", label: "Tasting the Pickle", text: "Rowson&rsquo;s ten flavours of meta-crisis, and the Consilience Project&rsquo;s <em>Challenges to Making Sense of the 21st Century</em>.", tag: "metacrisis popularised" },
    { year: "2022", label: "The world of the polycrisis", text: "Tooze&rsquo;s FT column gives the term its epoch name; the Cascade Institute publishes its first technical definition.", tag: "polycrisis mainstream" },
    { year: "2023", label: "Davos adopts it", text: "WEF&rsquo;s 18th Global Risks Report calls it &ldquo;a cluster of related global risks with compounding effects.&rdquo; Ferguson calls it a mirage.", tag: "backlash begins" },
    { year: "2024", label: "Causal mechanisms", text: "<em>Global Sustainability</em> publishes the entanglement account: polycrisis is &ldquo;no longer a mere buzzword.&rdquo;", tag: "academic consolidation" },
    { year: "2026", label: "72 conversations", text: "This corpus distils fifteen claims, twenty paradoxes and 1,210 codings from practitioners across nine series.", tag: "the corpus" }
  ];

  /* ------------------------------------------------------------ attractors */
  var attractors = [
    {
      n: 1, id: "catastrophe", name: "Catastrophe",
      colour: "#c28181",
      text: "A cascading, decentralised breakdown. Any one of a dozen runaway dynamics &mdash; ecological, financial, military, technological &mdash; is enough to crack the system, and the cracks spread.",
      instantiates: "Regulatory failure in the West",
      logic: "No actor is able to act first, so nobody acts."
    },
    {
      n: 2, id: "dystopia", name: "Dystopia",
      colour: "#a396b3",
      text: "The centralised, total surveillance and control that arises precisely as the attempt to prevent catastrophe &mdash; binding every possible threat by binding everyone.",
      instantiates: "Digital authoritarianism",
      logic: "The cure for chaos is a cage proportionate to the chaos."
    },
    {
      n: 3, id: "third", name: "The Third Attractor",
      colour: "#a9c0b4",
      text: "An antifragile, participatory civilisation: one that grows stronger from its stresses, distributes capacity rather than concentrating it, and metabolises its own risks.",
      instantiates: "Anti-rivalrous coordination",
      logic: "Handles power without concentrating it; handles risk without binding everyone."
    }
  ];

  var generators = [
    { n: 1, name: "Rivalrous games &times; exponential technology",
      text: "Win-lose incentive structures have generated most of what has gone wrong in human history. Speed them up exponentially and the damage becomes existential. Exponential technology cannot be put back in the bag, so the only exit is anti-rivalry.",
      from: "Schmachtenberger, <em>Solving the Generator Function</em>" },
    { n: 2, name: "Complicated systems subsuming their complex substrate",
      text: "Our built world is complicated &mdash; not self-organising, not self-repairing, and increasingly interconnectedly fragile. The biosphere loses its antifragility to the depletion and accumulation of open loops. This is how every previous civilisation failed.",
      from: "ibid." },
    { n: 3, name: "Choice and causation",
      text: "The generator underneath both: science gave us a rigorous theory of causation and therefore enormous power, but no comparably grounded theory of choice. Game theory became the default ethics, and playing it produces generators one and two.",
      from: "ibid." },
    { n: 4, name: "The epistemic commons",
      text: "Schmachtenberger treats information ecology not as a fourth generator but as the infrastructure on which perceiving the other three depends: &ldquo;more and more choices being made, with worse sensemaking to make them&rdquo;.",
      from: "Consilience Project; <em>The War on Sensemaking</em>" }
  ];

  /* ------------------------------------------------------- the fifteen claims
     Counts verbatim from the analysis page. "contested" is the page's own
     diamond score. Assent / dissent / fault-line excerpts are quoted as
     published, including their trailing ellipses.                          */
  var claims = [
    { id: 1, title: "Emergence over design",
      statement: "The third attractor cannot be designed. Any future planned by the same faculties that produced the crisis will reproduce the crisis in a new form. The work is developing the capacity to recognise what is already trying to happen and give it room.",
      engaged: 59, silent: 1, agree: 47, expand: 57, disagree: 12, contested: 41,
      covers: ["Agency and Emergence", "Surrender and Control"],
      assent: "Daniel Pinchbeck (&lsquo;the way is going to find us&rsquo;), Elizabeth Debold (it cannot be engineered), Cordula Frei (the faculty that made the crisis can&rsquo;t design the exit), Peter Merry (non-linear emergence can&rsquo;t be planned; the work is availability), Holly Woods (building from the wounded paradigm reproduces it)&hellip;",
      dissent: "The dissenters almost all hold a specific artefact. David Sloan Wilson: a comprehensive blueprint of core design principles. Dennis Wittrock: protocols, constitutions and binding policy engineered step by step. Bunzl and Bajrami: designed architectures offered as the third attractor itself&hellip;",
      fault: "Whether the faculties that plan are themselves contaminated by the crisis &mdash; so that designing anything reinstates it &mdash; or merely misapplied, so the same capacities, grounded in prior sensing, are exactly the tool required." },

    { id: 2, title: "Interior change comes first",
      statement: "Structural work undertaken by people who have not changed reproduces the old structures under new names. Interior development is the prerequisite, not the parallel track.",
      engaged: 59, silent: 1, agree: 32, expand: 57, disagree: 21, contested: 79,
      covers: ["Inner and Outer", "Transcendence and Descent"],
      assent: "Almost no one holds it in pure sequential form &mdash; John D. Liu is the lone unqualified assent. What the agreeing bloc shares is a mirroring thesis: Violeta Bulc&rsquo;s &lsquo;nothing can be shaped beyond what&rsquo;s inside&rsquo;, Bettina Geiken&rsquo;s outer&hellip;",
      dissent: "Three fronts. Non-translation: Kripal notes cultures positing deep unity still exclude viciously; Wilson calls inner motivation alone &lsquo;narcissistic enlightenment&rsquo;. Reversal: Wittrock argues changed structures produce changed people &mdash; and notes corporations love individual-responsibility-first&hellip;",
      fault: "Whether interior capacity is a gating precondition that must be attained before structural work can hold, or an emergent property of participation in changed structures and incentives." },

    { id: 3, title: "Change begins at human scale",
      statement: "Durable change begins where people know each other personally, and reaches larger scale by connecting local units to each other rather than through central coordination.",
      engaged: 51, silent: 9, agree: 40, expand: 47, disagree: 8, contested: 33,
      covers: ["Local and Global", "Top-Down and Bottom-Up"],
      assent: "One empirical intuition: trust has a size limit. Grace Rachmany (&lsquo;your 20 people&rsquo;), John D. Liu (350&ndash;500, beyond which you cannot know everyone), Catherine Pawasarat (twelve people, then neighbours down the valley), Elke Fein (round tables in small towns)&hellip;",
      dissent: "The generator is a global competition trap requiring simultaneous binding action above nations, making local action a distraction &mdash; Bunzl and Wittrock. Brad Reynolds locates change in individual practice plus Congress, the UN and a global cooperative order&hellip;",
      fault: "Whether the acquaintance limit on trust is a hard constraint that all durable scale must be composed out of, or a merely local fact that binding supra-national levers can act over without anyone knowing each other." },

    { id: 4, title: "Build alongside rather than reform",
      statement: "Existing institutions are too captured to be reformed in the time available. Energy is better spent building parallel structures that function while the old ones decline.",
      engaged: 50, silent: 10, agree: 23, expand: 44, disagree: 22, contested: 98,
      covers: ["Building Parallel and Reforming Existing", "Stability and Transformation"],
      assent: "The clearest voices share a collapse timetable rather than a mere critique of sclerosis: John D. Liu wants functional microcosms prototyped before civilisation collapses (&lsquo;people in suits won&rsquo;t restore hydrology&rsquo;), Freeman and Eden Khan treat the death process as underway&hellip;",
      dissent: "Large, concrete about leverage. Abhishek Thakore&rsquo;s &lsquo;acupressure points&rsquo; &mdash; the policies and money already exist. Rufus Pollock mocking techies who build apps instead of joining parties. Brad Reynolds fixing the UN. Bunzl, Rutte, Wittrock and Gooden working the parliaments&hellip;",
      fault: "Is capture total and the clock short enough that institutional latency is fatal &mdash; or is it differentiated by institution and domain, so some existing bodies still convert pressure into change fast enough to be worth it?" },

    { id: 5, title: "Belonging precedes power",
      statement: "Concentrated power and individual atomisation cause each other. Rebuilding real belonging is therefore a precondition for redistributing power, not a consequence of it.",
      engaged: 24, silent: 36, agree: 13, expand: 17, disagree: 0, contested: 0,
      covers: ["Individual and Collective", "Centralised and Individualised at Once"],
      assent: "A single causal story: atomised people are easy to dominate, so trust and belonging are the first layer to rebuild. Pinchbeck states it most baldly (scared, selfish, atomised people are easy to control); Wolfson pairs centralisation with hyper-individualisation&hellip;",
      dissent: "No voice contradicts the claim outright. The nearest thing is Bunzl, who shares the critique of hyper-individualism but locates the lever in simultaneous governance, implicitly reversing the precedence. Nusrat similarly emphasises ceded power rather than belonging as a staged precondition&hellip;",
      fault: "Whether belonging is a temporal precondition that must be restored before power can move, or a co-designed property of institutions and infrastructure built in the same act as redistributing power." },

    { id: 6, title: "Coordination does not require shared values",
      statement: "A viable shared future does not require people to hold the same values. It requires the skill of translating the same proposal into several value systems and staying in relationship across the difference.",
      engaged: 52, silent: 8, agree: 35, expand: 50, disagree: 13, contested: 54,
      covers: ["Unity and Diversity"],
      assent: "A practitioner&rsquo;s move: stop negotiating metaphysics, pitch the same proposal in each party&rsquo;s own value language. Dave Snowden (&lsquo;find concrete problems held in common across hostile divides&rsquo;), Bunzl (package deals translated into left, right and religious self-interest)&hellip;",
      dissent: "A floor cannot be avoided. Brendan Graham Dempsey holds worldview coherence is constitutive of coordinated emergence (&lsquo;birds of a type flock together&rsquo;). John D. Liu says you can only work with those who share the understanding&hellip;",
      fault: "Whether the &lsquo;towards&rsquo; that makes coordination cohere counts as a shared value that must be held explicitly, or as a structural condition &mdash; a common problem, a translatable direction &mdash; that does the work while values stay plural." },

    { id: 7, title: "A new shared story is necessary",
      statement: "The loss of a coherent shared story is a primary cause of the crisis, and coordination at scale requires building a new one.",
      engaged: 44, silent: 15, agree: 33, expand: 41, disagree: 7, contested: 35,
      covers: ["Grand Vision and Small Stories", "Simplicity and Complexity"],
      assent: "The strongest assenters treat lost story as the mechanism of fragmentation and story-building as the lever: John Churchill (postmodernity killed the big narratives, story is the technology, &lsquo;best story wins&rsquo;), Robb Smith (the crisis is epistemic and identity-based)&hellip;",
      dissent: "Snowden and Wagner make the sharpest case: big narratives are modernist power moves and North Atlantic neocolonialism; the real unit is millions of micro-narratives from which any large story emerges bottom-up. Cordula Frei inverts it entirely &mdash; narratives are what must be shed&hellip;",
      fault: "Whether large-scale coherence can be authored and propagated, or only precipitates upward out of many micro-stories, practices and material arrangements &mdash; and can therefore only be tracked, tended, held lightly." },

    { id: 8, title: "The practice works and does not transfer",
      statement: "The conditions for group intelligence are reliably reproducible through deep listening and held containers. Those conditions do not carry over into ordinary working, deciding and disagreeing.",
      engaged: 34, silent: 26, agree: 14, expand: 33, disagree: 19, contested: 85,
      covers: ["Safety and Edge", "Being and Becoming"],
      assent: "A very specific experience: the container reliably delivers (group non-duality, coherence, emergence, honesty), then reliably fails to survive contact with cooking, cleaning, loaded conflict or the daily hour. Nusrat&rsquo;s &lsquo;laboratory conditions&rsquo;, Pollock&rsquo;s collapse over chores, Debold&rsquo;s &lsquo;pleasant episode&rsquo;&hellip;",
      dissent: "The larger bloc simply reports transfer happening and names it: Rutte (three questions into policing, real estate, marriage counselling), Bulc (art of hosting inside corporate and political decision-making), Fein (ten village projects and the mayor drawn in)&hellip;",
      fault: "Whether &lsquo;the practice&rsquo; means the peak state produced inside the container (which by definition doesn&rsquo;t travel) or a transferable skill and structure that can be enacted in ordinary decision-making. Settle which is being reproduced and the disagreement largely dissolves." },

    { id: 9, title: "Not knowing is a working condition",
      statement: "Uncertainty is permanent rather than a temporary deficiency to be resolved before acting, and the capacity to act well inside it can be trained.",
      engaged: 53, silent: 7, agree: 46, expand: 49, disagree: 1, contested: 4,
      covers: ["Knowing and Not Knowing"],
      assent: "Almost overwhelming and unusually convergent: Diane Musho Hamilton (&lsquo;not knowing rules the day&rsquo;), Elke Fein (principle ten &mdash; &lsquo;know that you know nothing&rsquo;), Kripal (not knowing as the attraction rather than the defect), Wolfson (it never resolves, you get used to it)&hellip;",
      dissent: "Dissent is almost nonexistent &mdash; only Bajrami speaks from settled conviction, which is precisely the posture the claim rejects. The interesting pressure is from inside the assent: Robb Smith insists people also need conviction, hope and agency to move&hellip;",
      fault: "Whether acting well requires some irreducible floor of conviction that unknowing must be converted into, or whether trained capacity to bear the void is itself sufficient ground for action." },

    { id: 10, title: "The AI risk is present tense",
      statement: "The significant risk from artificial intelligence is not superintelligence. It is the erosion already underway of attention, reasoning, relationship and meaningful work.",
      engaged: 45, silent: 15, agree: 27, expand: 43, disagree: 12, contested: 62,
      covers: ["Human Intelligence and Artificial Intelligence"],
      assent: "A single move: displace the doom horizon and count the damage already done. Kripal (collapse of reading and conversation), Jeremy Johnson (&lsquo;colonization of our own subjectivity&rsquo;), Rachmany (a generation&rsquo;s lost capacity for companionship), Kershner (decapacitation of attention)&hellip;",
      dissent: "Three ways. Pollock and Hostetter refuse to give up the existential register &mdash; takeover scenarios are &lsquo;probably real&rsquo;, ungovernable across borders. A different objection accepts the anti-doom half but rejects the erosion half&hellip;",
      fault: "Whether AI&rsquo;s harms are located in what it is doing to human capacities now, or in what it might become and in the consciousness of those who build it &mdash; i.e. whether the erosion thesis is an empirical description or a substitution for the harder question of agency." },

    { id: 11, title: "The horizon is generational",
      statement: "Meaningful work on this operates across generations. Action driven by urgency produces shallow results and exhausted people.",
      engaged: 47, silent: 13, agree: 28, expand: 38, disagree: 7, contested: 40,
      covers: ["Urgency and Long Time"],
      assent: "A horizon that outruns the individual life: Brad Reynolds (&ldquo;it won&rsquo;t happen in our lifetime&rdquo;), Holly Woods (seven generations out), Madhan Mohan (caste took two generations to fade), Rachmany (a 200-year transition, &ldquo;we&rsquo;re in the composting stage&rdquo;)&hellip;",
      dissent: "The dissenters do not deny long arcs; they insist a real clock runs inside them. Dawlabani rejects long horizons outright &mdash; the window is narrow, disasters accelerate, speed of scaling decides. Freeman puts collapse months away&hellip;",
      fault: "Whether urgency is a distortion of consciousness that corrupts the work, or an accurate reading of a real clock that long-horizon patience simply mislabels as panic." },

    { id: 12, title: "Transmission is necessary and costly",
      statement: "Some things cannot be learned alone. Direct transmission from another person is necessary, and the risk of dependency is the price of access to it.",
      engaged: 35, silent: 25, agree: 18, expand: 31, disagree: 8, contested: 62,
      covers: ["Transmission and Autonomy"],
      assent: "An embodied capacity that only passes through presence. Cordula Frei (primordial trust and embodied knowing pass person to person), Nish Dubashia (presence transmits), Madhan Mohan (shown and lived with, not taught), Hostetter (transmission from a more open vessel)&hellip;",
      dissent: "Two arguments. First, the knowing is already internal: Rutte holds nothing needs transmitting; Daniel Oser invokes &lsquo;if you meet the Buddha kill him&rsquo;; Fein says difficult life and relationships are the better trainers&hellip;",
      fault: "Whether dependency is intrinsic to the transmission channel &mdash; so that removing it removes the transmission &mdash; or an avoidable design defect that peer structures, accountability, exit norms or good questions can engineer out." },

    { id: 13, title: "Grief is a precondition",
      statement: "Reckoning with loss and historical harm has to happen before constructive work. Anything built on unmetabolised grief repeats it.",
      engaged: 35, silent: 25, agree: 13, expand: 34, disagree: 8, contested: 76,
      covers: ["Grief and Hope"],
      assent: "A claim about contamination and access: unfaced pain doesn&rsquo;t stay put. Alderman says cutting off feeling makes activists fragile and names ritual grief containers; Merry argues the trans-rational field is inaccessible until the civilizational split and its pain are felt&hellip;",
      dissent: "The dissenters attack the sequencing, not the pain. Snowden refuses grief-first outright &mdash; doom recitals paralyse, attitudes change by doing. Rutte goes further: being overwhelmed by suffering is a kind of arrogance, and action on suffering is what metabolises it&hellip;",
      fault: "Whether unmetabolised grief is a gate that blocks access to constructive capacity, or a load that action itself digests &mdash; i.e. does the metabolising happen in the feeling or in the doing?" },

    { id: 14, title: "Self-interest is manufactured",
      statement: "Human self-interest is produced by systems that reward it rather than being intrinsic to human nature. Change the incentives and behaviour changes.",
      engaged: 53, silent: 7, agree: 32, expand: 51, disagree: 12, contested: 55,
      covers: [],
      fromCorpus: true,
      assent: "The clearest agreement comes from Pinchbeck, Melle, Churchouse, Bunzl and the two Bajrami voices: selfishness is programmed &mdash; by consumer capitalism, by a memetic infection, by money design, by competitive structures that force leaders&rsquo; hands &mdash; and dissolves once rules bind actors simultaneously&hellip;",
      dissent: "Robb Smith flatly rejects it &mdash; humans are intrinsically rivalrous and always will be; what changes is moral self-constraint and material base. Trish Blain denies manufacture from the other direction: expression and growth are intrinsic forces&hellip;",
      fault: "Whether the residue of self-interest that survives after incentives change is an artefact of deeper conditioning (fixable by structure, culture or development) or an irreducible egoic drive that can only be constrained and integrated." },

    { id: 15, title: "The living world is the ground",
      statement: "The living world is not one domain among others. It is the condition for everything else, and any accounting that treats it as an externality is wrong at the root rather than incomplete.",
      engaged: 40, silent: 20, agree: 35, expand: 31, disagree: 1, contested: 6,
      covers: [],
      fromCorpus: true,
      assent: "Overwhelming and unusually convergent: Thakore, Fein, Woods, Freeman, Sloan Wilson, Oser and Hamilton all treat the living world not as a policy area but as the precondition &mdash; &lsquo;we are nature&rsquo;, the burning planet as the number-one purpose, cooperation extended to the whole earth rather than an escape to Mars&hellip;",
      dissent: "Only Steve McIntosh dissents, narrowly: ecological limits are real messages, but making them the root frame installs ecology as omni-cause, whereas noosphere evolution is primary. Kripal relocates the ground: anthropocentrism must go, but consciousness is the ground&hellip;",
      fault: "Whether the living world is itself the ground or the outermost visible layer of a deeper ground (consciousness, noosphere evolution) &mdash; i.e. whether ecology founds the reframe or follows from it." }
  ];

  /* --------------------------------------------------------- the paradoxes */
  var paradoxes = [
    { n: 1, title: "Agency and Emergence", a: "Act as though everything depends on us.", b: "The future will not be built to anyone&rsquo;s design.",
      note: "Agency has not disappeared, it has been distributed &mdash; into teaching, writing, local work and deeper relationships, none of which feels like agency because the feedback is slow." },
    { n: 2, title: "Inner and Outer", a: "New structures inhabited by unchanged people reproduce the old ones.", b: "People who work only on themselves never become anything.",
      note: "Not stages in a sequence but one movement. The practical test is whether inner development changed how you spend, how you eat, and how you treat someone who cannot help you." },
    { n: 3, title: "Individual and Collective", a: "We want to belong.", b: "We want to remain distinct.",
      note: "Collectives that dissolve individuality produce conformity and call it unity. Individuals who refuse the collective produce isolation and call it freedom." },
    { n: 4, title: "Surrender and Control", a: "Let go; stop steering.", b: "We are that larger thing, and the letting go is itself an act.",
      note: "Drop the surrender and the ego quietly reclaims ownership of everything. Drop the agency and we abdicate." },
    { n: 5, title: "Knowing and Not Knowing", a: "Certainty gets things done.", b: "Uncertainty stays honest.",
      note: "Certainty produces the fanatic; uncertainty produces paralysis. Not knowing is a condition to work in, and the capacity can be trained." },
    { n: 6, title: "Unity and Diversity", a: "Everything is connected.", b: "Everything is different.",
      note: "Unity alone makes difference a problem to be smoothed away. Diversity alone leaves nothing to hold anyone together." },
    { n: 7, title: "Top-Down and Bottom-Up", a: "Nothing lasting is built by decree.", b: "Nothing at scale happens without institutions and resources.",
      note: "Almost everyone advocates one and quietly relies on the other." },
    { n: 8, title: "Grand Vision and Small Stories", a: "People cannot feel at home in a world that does not add up.", b: "Any single dominant story is how we arrived here.",
      note: "The big story is assembled from millions of small ones and is not credible without them. The small ones stay invisible to each other without something larger." },
    { n: 9, title: "Human Intelligence and Artificial Intelligence", a: "The technology that could help us think together at a scale we have never managed.", b: "The technology most efficiently degrading our capacity to think at all.",
      note: "The question is not whether to accept or refuse it. It is what to remain capable of doing without it." },
    { n: 10, title: "Being and Becoming", a: "There is nothing to attain.", b: "There is everything to do.",
      note: "Rest entirely in being and suffering becomes something to observe from a distance. Live entirely in becoming and there is no ground beneath any of it." },
    { n: 11, title: "Local and Global", a: "The most credible work is small, local and specific.", b: "The problems that matter most are none of those things.",
      note: "The likely form is regional in materials and food, global in communication and learning." },
    { n: 12, title: "Simplicity and Complexity", a: "The situation is genuinely complicated.", b: "Complicated descriptions do not move anyone.",
      note: "Different skills, often held by different people. Treating either as the whole job produces either paralysis or slogans." },
    { n: 13, title: "Stability and Transformation", a: "Institutions we have lost faith in are still holding things up.", b: "Some of what is failing is the only reason the failure is survivable.",
      note: "The judgment about which is which is the actual work, and it cannot be made in general." },
    { n: 14, title: "Safety and Edge", a: "People disclose and change inside protection.", b: "Containers that only make people comfortable produce sameness.",
      note: "Growth needs enough safety to be possible and enough edge to be worth the trouble." },
    { n: 15, title: "Building Parallel and Reforming Existing", a: "Build new institutions alongside the failing ones.", b: "Governments, corporations and finance are where leverage actually sits.",
      note: "Parallel structures stay small and can become self-congratulatory. Reform work gets absorbed by what it set out to change. Almost nobody argues the other side is wrong." },
    { n: 16, title: "Transcendence and Descent", a: "The further anyone develops, the further down they have to go.", b: "Development that only ascends produces people who are unreliable in ordinary life.",
      note: "Whatever is gained at height has to be brought back into the body, the family, the money and the argument at the kitchen table, or it was not gained." },
    { n: 17, title: "Urgency and Long Time", a: "Everything says act now.", b: "The scale of what is needed is measured in generations.",
      note: "The most convincing hold both: working as though it is late, planting things they will never see." },
    { n: 18, title: "Transmission and Autonomy", a: "Some things cannot be learned from a book.", b: "The history of transmission is also a history of dependency and abuse.",
      note: "This one has to be navigated, not solved." },
    { n: 19, title: "Grief and Hope", a: "Facing what has been lost is a precondition.", b: "Constant contact with loss becomes its own kind of paralysis.",
      note: "Hope that has not passed through grief does not survive contact with the news. Grief that never turns toward the future becomes a place people live." },
    { n: 20, title: "Centralised and Individualised at Once", a: "Too centralised.", b: "Too individualised &mdash; and the two produce each other.",
      note: "Not a trade-off along one axis. Fixing either alone fails, which is why decentralisation campaigns and community-building efforts both stall on their own." }
  ];

  /* ------------------------------------------------ quantitative anchors
     Each carries a confidence flag. "solid" = peer-reviewed or primary
     institutional source; "contested" = live disagreement on the number;
     "movement" = circulates in this literature without a primary citation. */
  var anchors = [
    { v: "1 in 6", label: "existential risk this century", src: "Toby Ord, <em>The Precipice</em>, 2020", conf: "contested",
      note: "Ord&rsquo;s own synthesis; he separately rates nuclear war and climate change at 1 in 1,000 each, and ungoverned AGI at 1 in 10 &mdash; &ldquo;higher than all other sources combined&rdquo;." },
    { v: "5%", label: "median AI-researcher p(doom)", src: "2023 Expert Survey on Progress in AI", conf: "solid",
      note: "Mean 14.4%, median 5%. The 2024 follow-up puts the mean at 18%. Individual estimates run from &lt;0.01% to 99.9% &mdash; five orders of magnitude among credentialed people." },
    { v: "7 of 9", label: "planetary boundaries transgressed", src: "Richardson et al., <em>Science Advances</em> 2023; Stockholm Resilience Centre", conf: "solid",
      note: "The 2023 assessment found six of nine crossed; the Centre&rsquo;s current figure is seven. Both freshwater and biosphere integrity are among them." },
    { v: "12,187", label: "nuclear warheads, early 2026", src: "FAS Nuclear Notebook", conf: "solid",
      note: "~9,745 in military stockpiles, ~3,912 deployed, ~2,100 on high alert. Down from a peak near 70,300 &mdash; but stockpiles are increasing again." },
    { v: "1M", label: "species threatened with extinction", src: "IPBES Global Assessment, 2019", conf: "solid",
      note: "Alongside: 75% of land surface significantly altered, ~66% of ocean area impacted, 680 vertebrate species lost since 1500." },
    { v: "36 Gt/yr", label: "soil eroded from arable land", src: "Borrelli et al., <em>Nature Communications</em> 2017", conf: "contested",
      note: "The widely quoted 75 Gt/yr is a 1990s FAO-era estimate; Borrelli&rsquo;s revised model is roughly half that. The &lsquo;24 Gt&rsquo; figure in circulation is not well anchored." },
    { v: "69%", label: "freshwater withdrawals for agriculture", src: "FAO AQUASTAT via Our World in Data", conf: "solid",
      note: "With 19% industrial and 12% municipal. Several MENA countries withdraw above 100% of renewable supply, meaning aquifer overdraft or desalination." },
    { v: "&lt;0.001%", label: "of gross world product spent on targeted x-risk reduction", src: "Ord, <em>The Precipice</em>, 2020", conf: "contested",
      note: "Against a 1-in-6 century risk. The contrast is the argument; the denominator is a judgement." },
    { v: "&ge;3", label: "interacting systemic risks to constitute a polycrisis", src: "Cascade Institute technical paper v1.1, 2022", conf: "movement",
      note: "The only quantitative threshold in the polycrisis literature &mdash; and it was dropped in v2.0 in favour of &lsquo;causal entanglement&rsquo;. Treat it as superseded by its own authors." }
  ];

  /* -------------------------------------------------------------- criticism */
  var critiques = [
    { who: "Niall Ferguson", at: "Davos, 2023", target: "polycrisis",
      text: "&ldquo;A mirage.&rdquo; Today&rsquo;s troubles are &ldquo;just history happening.&rdquo;",
      force: "weak", note: "Rhetorically effective, analytically thin &mdash; it does not engage the entanglement claim." },
    { who: "Daniel Drezner", at: "Vox, 2023", target: "polycrisis",
      text: "&ldquo;A confusing and redundant neologism.&rdquo; 1914&ndash;1920 combined war, pandemic and inflationary collapse.",
      force: "medium", note: "The strongest historical objection: the felt novelty may be the observer&rsquo;s position, not the system&rsquo;s state." },
    { who: "Jonathan Rowson", at: "Perspectiva, 2023", target: "polycrisis",
      text: "&ldquo;Insidious because it fetishizes complexity, and amounts to a kind of performative lamentation about the world spinning out of control.&rdquo;",
      force: "strong", note: "From inside the metacrisis camp. His charge is that the label is psychoactive: it changes what feels possible." },
    { who: "Postcolonial critique", at: "surveyed in the literature", target: "polycrisis",
      text: "Eurocentric &mdash; developed without the experience of the global South, &ldquo;people who have experienced multiple and interlocking crises for decades&rdquo;.",
      force: "strong", note: "Yuen Yuen Ang&rsquo;s counter-concept &lsquo;polytunity&rsquo; reframes the same condition as a generational opening." },
    { who: "Alastair Benn", at: "Engelsberg Ideas, 2023", target: "polycrisis",
      text: "The felt sense is an artefact of the medium &mdash; &ldquo;the strangeness lies not so much in the events themselves as in the media through which we view them.&rdquo;",
      force: "medium", note: "A media-epistemology objection that the metacrisis camp would happily absorb." },
    { who: "Kenneth McLeod", at: "draft paper", target: "third attractor",
      text: "&ldquo;Schmachtenberger&rsquo;s &lsquo;third attractor&rsquo;, while desirable, seems politically implausible.&rdquo;",
      force: "strong", note: "The transition problem: if attractor 1 is incumbent elite power and attractor 2 is state power, the third must be produced by actors holding neither." },
    { who: "Steve Brett", at: "sympathetic critique", target: "third attractor",
      text: "The proposed cure &mdash; scientific first principles for sensemaking &mdash; &ldquo;is only one particular form of epistemic knowledge, a Western one&rdquo;.",
      force: "strong", note: "If the repair is itself a partial epistemology, the cultural enlightenment risks reproducing the monoculture that generated the crisis." },
    { who: "The deflationary reading", at: "structural", target: "third attractor",
      text: "Negatively defined (not-chaos, not-tyranny) with positive content given as constraints rather than institutions: it names a space, not a mechanism.",
      force: "medium", note: "The advocacy literature&rsquo;s own ten characteristics were produced by &ldquo;an AI summary of overlapping points&rdquo; &mdash; candidly a synthesis of aspirations, not a design." }
  ];

  /* ---------------------------------------------------------------- sources */
  var sources = [
    ["Corpus home", "Co-creating the Third Attractor &mdash; 72 conversations, nine series", "https://3da.manifest-nirvana.com/"],
    ["The analysis", "Fifteen claims, 1,210 codings", "https://3da.manifest-nirvana.com/analysis/"],
    ["Twenty paradoxes", "The synthesis the claims were built on", "https://3da.manifest-nirvana.com/20-paradoxes-to-be-held-to-co-create-the-third-attractor/"],
    ["Insights", "41 reflections, running commentary on the corpus", "https://3da.manifest-nirvana.com/insights/"],
    ["Cascade Institute", "Lawrence, Janzwood &amp; Homer-Dixon, <em>What Is a Global Polycrisis?</em>", "https://cascadeinstitute.org/technical-paper/what-is-a-global-polycrisis/"],
    ["Tooze", "&ldquo;Welcome to the world of the polycrisis&rdquo;, FT, 28 Oct 2022", "https://www.ft.com/content/498398e7-11b1-494b-9cd3-6d669dc3de33"],
    ["L&auml;hde", "&ldquo;The case for polycrisis as a keyword&rdquo;, Aeon, 2023", "https://aeon.co/essays/the-case-for-polycrisis-as-a-keyword-of-our-interconnected-times"],
    ["Rowson", "&ldquo;Prefixing the World&rdquo;, Perspectiva, 2023", "https://perspecteeva.substack.com/p/prefixing-the-world"],
    ["Schmachtenberger", "&ldquo;Solving the Generator Function&rdquo;", "https://civilizationemerging.com/solving-generator-function/"],
    ["Humanetech", "The two attractors, named in writing", "https://www.humanetech.com/podcast/a-problem-well-stated-is-half-solved"],
    ["metacrisis.info", "The symptoms/structure distinction, stated plainly", "https://metacrisis.info/"],
    ["P2P Foundation", "The clearest published summary of the three attractors", "https://wiki.p2pfoundation.net/Daniel_Schmachtenberger_on_the_Three_Civilizational_Attractors_and_the_Metacrisis"]
  ];

  return {
    corpus: corpus, series: series, terms: terms, timeline: timeline,
    attractors: attractors, generators: generators, claims: claims,
    paradoxes: paradoxes, anchors: anchors, critiques: critiques, sources: sources
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = ATTRACT;
