/* ============================================================================
   TIMELINE DATA — computation, AI, AGI, superintelligence, singularity
   ----------------------------------------------------------------------------
   Every figure here carries a provenance tag:
     verified   read from a primary or authoritative page
     standard   textbook consensus, not re-verified for this page
     flagged    contested, disputed, or second-hand
   The point of the tags is that a 4,000-year timeline is mostly reconstruction,
   and the honest part of it is knowing which numbers are measured.
   ============================================================================ */
var TL = (function () {
  "use strict";

  var ERAS = [
    { id: "mechanical", name: "Mechanical arithmetic", span: "300 BCE – 1890", accent: "#8fb7d9" },
    { id: "electronic", name: "Electronic computing", span: "1936 – 1971", accent: "#8aa4be" },
    { id: "scaling", name: "The scaling regime", span: "1971 – 2005", accent: "#a396b3" },
    { id: "accelerated", name: "Accelerated", span: "2006 – 2019", accent: "#c4a373" },
    { id: "frontier", name: "The frontier", span: "2020 – 2026", accent: "#a9c0b4" }
  ];

  /* track: compute | ai | theory */
  var EVENTS = [
    { year: "c. 300 BCE", date: -300, track: "compute", era: "mechanical",
      title: "The abacus",
      text: "Roman calculi on a counting board, and the Chinese suanpan and Japanese soroban. A skilled operator does roughly one to five additions a second — the first time arithmetic is offloaded from the mind to a physical substrate.",
      metric: "~1–5 ops/s", conf: "standard" },

    { year: "c. 100 BCE", date: -100, track: "compute", era: "mechanical",
      title: "The Antikythera mechanism",
      text: "At least thirty interlocking bronze gears computing eclipse cycles, the Moon's variable motion and planetary positions. Not a calculator but an analog solver: it models, it does not count.",
      metric: "~69 gear meshes in one train", conf: "flagged" },

    { year: "1614", date: 1614, track: "theory", era: "mechanical",
      title: "Logarithms, and the first algorithm",
      text: "Napier's tables turn multiplication into addition. This is the pattern that recurs for four centuries: the biggest gains are algorithmic before they are mechanical. His bones and Oughtred's slide rule then hold three to four digits of precision for the next 300 years.",
      metric: "multiplication → addition", conf: "verified" },

    { year: "1837", date: 1837, track: "compute", era: "mechanical",
      title: "Babbage's Analytical Engine",
      text: "Separate mill and store, punched-card input, conditional branching — the first architecture to separate program from data, 108 years before EDVAC. Planned at 55,000 parts and never built. Babbage's own tables estimate seven to ten operations a second, which is to say a human turning a crank.",
      metric: "~7–10 ops/s (never benchmarked)", conf: "flagged" },

    { year: "1843", date: 1843, track: "theory", era: "mechanical",
      title: "Lovelace's Note G",
      text: "The Bernoulli-number algorithm for the Analytical Engine — the first published program, and the first published claim about what such a machine cannot do: it 'has no pretensions whatever to originate anything'.",
      metric: "~25 operations", conf: "verified" },

    { year: "1890", date: 1890, track: "compute", era: "mechanical",
      title: "Hollerith's tabulator",
      text: "The US Census took roughly eight years of clerical work to tally in 1880. With punched cards and a tabulating machine, 1890 took about one year for 62.9 million people. Computation becomes an industrial process, and the company that becomes IBM follows.",
      metric: "8 years → 1 year", conf: "standard" },

    { year: "1936", date: 1936, track: "theory", era: "electronic",
      title: "The Turing machine",
      text: "Turing formalises computation as a machine reading and writing symbols on a tape, and proves the halting problem undecidable. Church's lambda calculus proves equivalent, and the Church–Turing thesis claims this captures everything 'effectively calculable'. Every machine below is an implementation of this idea.",
      metric: "universality, and its limits", conf: "verified" },

    { year: "1945", date: 1945, track: "compute", era: "electronic",
      title: "The stored-program architecture",
      text: "Von Neumann's EDVAC report puts instructions and data in the same memory. Everything that follows — software, compilers, general-purpose machines — is a consequence. The credit belongs substantially to Eckert and Mauchly, whose names are not on it.",
      metric: "one memory, program included", conf: "verified" },

    { year: "1946", date: 1946, track: "compute", era: "electronic",
      title: "ENIAC",
      text: "18,000 vacuum tubes, 150 kW, thirty tons. 5,000 additions a second, 357 multiplications, about 500 FLOPS. It cost $487,000 — roughly $7.2 million today — which works out to about $14,600 per operation-per-second, and about one operation per thirty joules.",
      metric: "5,000 add/s · 0.033 ops/J · $14,600 per op/s", conf: "verified" },

    { year: "1947", date: 1947, track: "compute", era: "electronic",
      title: "The transistor",
      text: "Bardeen and Brattain at Bell Labs. Two orders of magnitude less power and three orders less volume than a vacuum tube at comparable speed. The structural win is not speed — it is that the device can now be made small and made many.",
      metric: "~1/100 power, ~1/1000 volume", conf: "standard" },

    { year: "1950", date: 1950, track: "ai", era: "electronic",
      title: "Turing's imitation game",
      text: "'Can machines think?' is replaced by an operational test. The move defines the field's style for seventy years: intelligence is whatever survives an operational criterion, and the criterion keeps moving.",
      metric: "the test replaces the question", conf: "verified" },

    { year: "1956", date: 1956, track: "ai", era: "electronic",
      title: "Dartmouth, and the name",
      text: "McCarthy coins 'artificial intelligence'. The proposal's claim is the founding over-claim: that every feature of intelligence can 'in principle be so precisely described that a machine can be made to simulate it', and that ten people could make significant progress in two months.",
      metric: "'in principle' → 'in two months'", conf: "verified" },

    { year: "1958", date: 1958, track: "compute", era: "electronic",
      title: "The integrated circuit",
      text: "Kilby's germanium oscillator in September 1958; Noyce's manufacturable silicon planar version in 1959. A commercial logic gate cost about $120 in 1961 and about $1 by 1968 — a hundredfold collapse in seven years, faster than the density law that would follow it.",
      metric: "100× cheaper in 7 years", conf: "standard" },

    { year: "1965", date: 1965, track: "compute", era: "electronic",
      title: "Moore's law",
      text: "Five data points and a projection: 'by 1975 economics may dictate squeezing as many as 65,000 components on a single silicon chip.' That is a doubling every twelve months. In 1975 he revises it to 'a doubling every two years' — and Moore never said eighteen months. That figure is Intel's David House, talking about performance, not density.",
      metric: "2× / 12 months, then 2× / 24 months", conf: "verified" },

    { year: "1965", date: 1965, track: "theory", era: "electronic",
      title: "The intelligence explosion",
      text: "I.J. Good: since designing machines is itself an intellectual activity, an ultraintelligent machine could design better machines, and 'the first ultraintelligent machine is the last invention that man need ever make.' He thought this more likely than not within the twentieth century. The loop was real; the bottleneck was not where he thought.",
      metric: "closed loop: design improves design", conf: "verified" },

    { year: "1969", date: 1969, track: "ai", era: "electronic",
      title: "Minsky and Papert, and the first wall",
      text: "A single-layer perceptron cannot compute XOR or parity. The popular story says this killed neural networks; what it actually showed was an optimisation gap, not an expressivity one — nobody could train a multilayer net. Backpropagation in 1986 is the un-doing of this, seventeen years later.",
      metric: "linear separability as the limit", conf: "verified" },

    { year: "1971", date: 1971, track: "compute", era: "scaling",
      title: "The microprocessor",
      text: "Intel 4004: 2,300 transistors on 10 μm, 740 kHz, 60,000 operations a second, $60. It was 180× faster than ENIAC at about one thirty-thousandth the volume and one twenty-five-hundredth the power, and roughly fourteen times cheaper per operation per second.",
      metric: "60,000 ops/s for $60", conf: "verified" },

    { year: "1973", date: 1973, track: "ai", era: "scaling",
      title: "The Lighthill report, and the first winter",
      text: "Commissioned by the UK Science Research Council, it finds AI has failed its 'grandiose objectives' and that its successes are confined to toy problems because of combinatorial explosion. He was substantially right about the complexity wall. The winter that followed is partly a funding story: SIGART membership roughly doubled across the same years.",
      metric: "combinatorial explosion", conf: "verified" },

    { year: "1974", date: 1974, track: "compute", era: "scaling",
      title: "Dennard scaling",
      text: "Shrink the transistor by factor κ and voltage and current scale with it, so power density stays flat: more transistors at the same watts. This is why clock speed could climb from 740 kHz to about 3 GHz. It is also the reason the climb stopped.",
      metric: "constant power density", conf: "verified" },

    { year: "1987", date: 1987, track: "ai", era: "scaling",
      title: "The second winter",
      text: "Expert systems had become a billion-dollar industry on narrow, stable, deep domains — XCON configuring VAX orders, saving a reported $40 million over six years. Then general-purpose RISC workstations running Lisp overtook purpose-built Lisp machines on price-performance. The pattern is the one that matters now: a special-purpose architecture bet killed by general-purpose hardware.",
      metric: "specialised hardware loses", conf: "verified" },

    { year: "1993", date: 1993, track: "theory", era: "scaling",
      title: "Vinge names the Singularity",
      text: "'The precise cause of this change is the imminent creation by technology of entities with greater than human intelligence.' He expects it within thirty years: 'I'll be surprised if this event occurs before 2005 or after 2030.' His sharper point is usually lost — that superhumanity is the essence, 'without that we would get a glut of technical riches, never properly absorbed.'",
      metric: "2005–2030 window", conf: "verified" },

    { year: "1997", date: 1997, track: "ai", era: "scaling",
      title: "Deep Blue",
      text: "Two hundred million positions a second, alpha-beta search and a hand-tuned evaluation beat the world chess champion 3½–2½. A search victory, not a learning victory — which is exactly why it did not generalise to anything else.",
      metric: "~200M positions/s", conf: "standard" },

    { year: "2005", date: 2005, track: "compute", era: "scaling",
      title: "Dennard's law dies",
      text: "Voltage could no longer scale, power density began rising, and clock frequency plateaued at three to four gigahertz — where it has stayed for twenty years. Everything since has come from parallelism and specialisation, not from frequency. Single-thread performance gains fell from about 50% a year to three to five.",
      metric: "clock speed flat since ~2005", conf: "flagged" },

    { year: "2006", date: 2006, track: "compute", era: "accelerated",
      title: "CUDA, and the GPU as a computer",
      text: "NVIDIA exposes the graphics processor for general computation. What had been a chip for shading becomes a chip for arithmetic. The 2006 flagship delivered about 345 GFLOPS for $599 — half a gigaflop per dollar, at a time when that was remarkable.",
      metric: "0.58 GFLOP/s per $", conf: "standard" },

    { year: "2012", date: 2012, track: "ai", era: "accelerated",
      title: "AlexNet",
      text: "Two consumer GPUs, five to six days, sixty million parameters, and a top-5 error of 15.3% against 26.2% for the runner-up. The claim that mattered was not about images: general-purpose GPU compute plus labelled data plus deep nets beats hand-engineered features. Every later item depends on this one.",
      metric: "15.3% vs 26.2% top-5", conf: "verified" },

    { year: "2015", date: 2015, track: "compute", era: "accelerated",
      title: "The TPU",
      text: "A systolic array of 65,536 eight-bit multiply-accumulates: 92 TOPS at about 40 watts, or 2.3 TOPS per watt. Specialisation returns, this time as a deliberate response to the power wall rather than in ignorance of it.",
      metric: "92 TOPS at ~40 W", conf: "verified" },

    { year: "2017", date: 2017, track: "ai", era: "accelerated",
      title: "Attention is all you need",
      text: "The Transformer removes recurrence. The technical unlock is not quality but parallelism: a recurrent net serialises over sequence length, attention does not, so scale becomes a matter of buying accelerators. Everything after 2017 in this timeline is downstream of that one property.",
      metric: "parallelisable by construction", conf: "verified" },

    { year: "2020", date: 2020, track: "ai", era: "frontier",
      title: "GPT-3, and in-context learning",
      text: "175 billion parameters, 3.14×10²³ FLOP of training compute. The paper's claim is few-shot learning: behaviour that emerges from scale with no gradient updates. Also the moment a model became an API, which turned capability into a product surface with a price.",
      metric: "3.14×10²³ FLOP", conf: "verified" },

    { year: "2020", date: 2020.8, track: "ai", era: "frontier",
      title: "AlphaFold 2",
      text: "Median GDT around 92 on CASP14, competitive with experiment, on a problem open for fifty years. The strongest evidence in this whole list that a narrow system can produce a genuine scientific result rather than a demo.",
      metric: "GDT ~92", conf: "verified" },

    { year: "2022", date: 2022.9, track: "ai", era: "frontier",
      title: "ChatGPT",
      text: "Instruction-following and RLHF turn a text predictor into something usable, and a hundred million people arrive in two months. The technical novelty was modest; the demand was the event. Also the point at which capability stopped being measured only by benchmarks and started being measured by adoption.",
      metric: "100M users in ~2 months", conf: "verified" },

    { year: "2023", date: 2023.2, track: "ai", era: "frontier",
      title: "GPT-4",
      text: "About 2×10²⁵ FLOP — roughly sixty times GPT-3 — with multimodal input and human-range performance on professional exams. This is the last model for which 'bigger training run' cleanly equals 'new frontier'.",
      metric: "2×10²⁵ FLOP", conf: "verified" },

    { year: "2024", date: 2024.7, track: "ai", era: "frontier",
      title: "The reasoning turn",
      text: "RL on chain-of-thought makes performance improve with inference-time compute, opening a second scaling axis that is not training FLOP. The binding constraint shifts from text to verifiable reward: maths, code, and anything with a checker.",
      metric: "a second scaling axis", conf: "verified" },

    { year: "2025", date: 2025.5, track: "ai", era: "frontier",
      title: "Gold at the IMO",
      text: "Models reach gold-medal level at the International Mathematical Olympiad in July 2025 — five years before the median expert forecast for that outcome and ten years before the median superforecaster forecast. It is the cleanest single datapoint on which direction expert error has been running.",
      metric: "5 years early vs expert median", conf: "verified" },

    { year: "2026", date: 2026.2, track: "ai", era: "frontier",
      title: "Reasoning by default, and benchmarks running out",
      text: "Reasoning is built into flagship models rather than sold as a separate line; a million-token context is ordinary. Meanwhile MMLU, GSM8K and MATH are saturated, GPQA is compressed to noise at the top, and METR's suite cannot resolve above sixteen hours. Capability keeps rising while the instruments that measured it stop discriminating.",
      metric: "instruments saturating", conf: "verified" },

    /* ------------------------------------------------------------ the life track
       Longevity is the fourth thread and the one this chronology used to omit.
       It matters to everything above because the labour force in 2060 is decided
       by it: a decade of extra working life is a decade of extra taxpayers, and a
       decade of extra dependency costs the same economy twice.                  */

    { year: "1961", date: 1961.5, track: "life", era: "electronic",
      title: "The Hayflick limit",
      text: "Hayflick and Moorhead show that human cells in culture divide about fifty times and then stop. It overturns fifty years of the opposite claim, which rested on Carrel's supposedly immortal chicken-heart cells — those had been fed fresh embryo extract, so the culture was being kept alive by new cells all along. Ageing becomes a counted process inside the cell rather than wear arriving from outside it.",
      metric: "~50 divisions", conf: "standard" },

    { year: "1997", date: 1997.1, track: "life", era: "scaling",
      title: "Dolly, and the reversibility of the adult state",
      text: "A sheep grown from the nucleus of an adult mammary cell. The cloning is the story the newspapers ran; the result that matters is that a differentiated adult nucleus can run a whole organism again. If the adult state can be reset, then ageing is at least partly a programme rather than an accumulation, and that is the founding claim of everything on this track after it.",
      metric: "adult nucleus → whole animal", conf: "verified" },

    { year: "1998", date: 1998.8, track: "life", era: "scaling",
      title: "Immortal cells in a dish, and human stem cells",
      text: "Two papers in the same months. Bodnar and colleagues add telomerase to normal human cells and extend their division count well past the Hayflick limit without malignant transformation; Thomson derives the first human embryonic stem cell lines. The limit is revealed as a mechanism that can be intervened in rather than a law.",
      metric: "telomerase extends the count", conf: "verified" },

    { year: "2006", date: 2006.6, track: "life", era: "accelerated",
      title: "Four genes",
      text: "Yamanaka shows that Oct4, Sox2, Klf4 and c-Myc turn an adult mouse fibroblast into a pluripotent stem cell — human cells follow in 2007. No embryo, no egg, no cloning: a short list of transcription factors and a cell changes identity. Ageing research stops being a study of damage and starts being a study of state.",
      metric: "4 factors, 1 cell type → any", conf: "verified" },

    { year: "2012", date: 2012.6, track: "life", era: "accelerated",
      title: "CRISPR-Cas9 becomes programmable",
      text: "Jinek and colleagues show that a single guide RNA is enough to direct Cas9 to any matching sequence. Editing moves from a bespoke protein engineered per target to an off-the-shelf reagent, and the cost of a gene edit collapses in the way software costs collapsed. Seven years later the first human trials begin; three years after that it is a licensed medicine.",
      metric: "one guide RNA, any target", conf: "verified" },

    { year: "2013", date: 2013.5, track: "life", era: "accelerated",
      title: "A clock for biological age",
      text: "Horvath's estimator reads DNA methylation at a few hundred sites and predicts chronological age within a few years, across tissues and species. This is the unglamorous prerequisite the whole field needed: an intervention cannot be tested against 'ageing' unless ageing can be read as a number that moves faster or slower than the calendar.",
      metric: "methylation → years", conf: "verified" },

    { year: "2015", date: 2015.2, track: "life", era: "accelerated",
      title: "Senolytics",
      text: "Dasatinib with quercetin selectively kills senescent cells in mice — the first pharmacological class aimed at a mechanism of ageing rather than at a disease. It is the cleanest test of the compression hypothesis: if the senescent cells are the thing that makes old tissue old, removing them should buy health span, and if it only buys lifespan the extra years arrive in the state nobody wants.",
      metric: "first class aimed at ageing itself", conf: "standard" },

    { year: "2023", date: 2023.95, track: "life", era: "frontier",
      title: "Gene editing approved as a medicine",
      text: "Casgevy is licensed for sickle cell disease in Britain and the United States, five years after its first human trial. It is not a longevity therapy and does not extend life by a day in a healthy person. It is the regulatory gate that every entry above needs to pass: a heritable edit, made on purpose, approved as a product.",
      metric: "first licensed CRISPR therapy", conf: "verified" },

    /* ------------------------------------------------ algorithmic progress
       Two results on this page are gains in capability at fixed compute rather
       than gains in compute. They are here because the alternative — treating
       capability as a function of FLOP alone — is the error the whole timeline
       is built to avoid.                                                     */

    { year: "2022", date: 2022.2, track: "ai", era: "frontier",
      title: "Chinchilla: most models were badly under-trained",
      text: "DeepMind shows that for a fixed compute budget the field had been spending far too much of it on parameters and far too little on data: roughly twenty tokens per parameter, not three hundred. A 70-billion-parameter Chinchilla beats a 280-billion-parameter Gopher at the same cost. Nothing about the hardware changed and nothing about the architecture changed — the same money bought a better model because of a result about how to spend it.",
      metric: "70B beats 280B at equal compute", conf: "verified" },

    { year: "2025", date: 2025.1, track: "ai", era: "frontier",
      title: "Reasoning at a fraction of the price",
      text: "DeepSeek-R1 reaches near-frontier reasoning benchmark scores with published weights and a stated training cost a small fraction of its comparators'. The cost figure is the lab's own and has been disputed, so treat the multiple as contested and the existence as not: a second axis of progress is now visible in public, and it is efficiency rather than scale.",
      metric: "frontier reasoning, contested cost", conf: "flagged" }
  ];

  /* ------------------------------------------------- training-compute series
     FLOP for the largest known training run by year. Epoch AI figures.       */
  var COMPUTE_POINTS = [
    { year: 2020.4, flop: 3.14e23, label: "GPT-3" },
    { year: 2022.3, flop: 2.5e24, label: "PaLM", conf: "flagged" },
    { year: 2023.2, flop: 2e25, label: "GPT-4" },
    { year: 2023.95, flop: 5e25, label: "Gemini Ultra" },
    { year: 2024.55, flop: 4e25, label: "Llama 3.1 405B" },
    { year: 2025.15, flop: 1e26, label: "GPT-4.5" },
    { year: 2025.6, flop: 5e25, label: "GPT-5", conf: "flagged" }
  ];

  /* Thresholds and ceilings that the projection runs into. */
  var THRESHOLDS = [
    { flop: 1e26, label: "Frontier-model legal threshold", note: "California SB 53 defines a frontier model as >10²⁶ FLOP. GPT-4.5 crossed it." },
    { flop: 2e29, label: "Feasible by 2030", note: "Epoch AI: a 2×10²⁹ FLOP training run is likely feasible by 2030 — equivalent to 'GPT-4 exceeds GPT-2' again." },
    { flop: 3e30, label: "Latency wall (lower)", note: "Epoch's hard cap from interconnect latency absent new topologies: 3×10³⁰ to 1×10³² FLOP." },
    { flop: 1e32, label: "Latency wall (upper)", note: "Above this, synchronising a single training run is physically implausible at known interconnect speeds." }
  ];

  /* ----------------------------------------------------------------- the walls */
  var WALLS = [
    { title: "Power",
      now: "Largest cluster 1.1M H100-equivalents; 1 GW of IT load costs ~$38B and takes ~2.1 years to build.",
      binding: "Power is the first constraint to bite. Epoch puts the 2030 ceiling at 1–3×10²⁹ FLOP for 1–5 GW campuses.",
      verdict: "Binding by 2030 at the current trend." },
    { title: "Data",
      now: "~300 trillion tokens of public human text (90% CI 100T–1T). Essentially all of it is in use already.",
      binding: "Compute-optimal training exhausts it 2026–2032; with 5× overtraining, 2027; with 100×, 2025.",
      verdict: "Binds this decade. Synthetic data and multimodality are the workarounds, and neither is yet a demonstrated substitute." },
    { title: "Chips",
      now: "Five hyperscalers own ~71% of global AI compute.",
      binding: "~100M H100-equivalents dedicated to training would allow ~9×10²⁹ FLOP.",
      verdict: "Less binding than power, more binding than algorithms." },
    { title: "Algorithms",
      now: "Compute needed for fixed performance halves every ~8 months (5–14), i.e. ~2.8×/yr of effective compute.",
      binding: "60–95% of measured progress came from more compute and data; only 5–40% from algorithms, and that share has been falling.",
      verdict: "Helpful, and systematically over-credited." },
    { title: "Latency",
      now: "A single training run must synchronise across the whole cluster.",
      binding: "3×10³⁰–10³² FLOP is a hard ceiling without new interconnect topologies.",
      verdict: "The wall nobody models, and the firmest of the five." }
  ];

  /* ------------------------------------------------------------ the forecasts
     kind: survey | aggregate | model | individual | lab
     Evidence quality matters more than the date.                             */
  var FORECASTS = [
    { who: "Good", what: "ultraintelligent machine", year: 2000, kind: "individual", missed: true,
      note: "Written 1965: 'more probable than not' within the twentieth century. Falsified — and instructive, because the self-improvement loop he described is real." },
    { who: "Kurzweil", what: "human-level AI", year: 2029, kind: "individual",
      note: "Held since the 1990s, reiterated in 2024. Based on the Law of Accelerating Returns, not on any benchmark." },
    { who: "AI lab leaders", what: "AGI", year: 2026, kind: "lab",
      note: "January 2025: 25% by 2026, AGI in 2–5 years. Interested party — selected for optimism and fundraising." },
    { who: "AI 2027", what: "superhuman coder", year: 2027, kind: "model",
      note: "Kokotajlo et al., April 2025. Explicitly a scenario, not a probability-weighted forecast. Its own ASI figure carries an 80% interval from June 2027 to beyond 2100." },
    { who: "AI 2027", what: "superintelligence", year: 2028, kind: "model",
      note: "Median April 2028, with a tail past 2100. One-year takeoff from superhuman coder to ASI." },
    { who: "Samotsvety", what: "AGI", year: 2030, kind: "aggregate",
      note: "Superforecaster group, 2023: ~28% by 2030." },
    { who: "Vinge", what: "greater-than-human intelligence", year: 2030, kind: "individual",
      note: "Written 1993: 'I'll be surprised if this event occurs before 2005 or after 2030.' The window closes this year." },
    { who: "AI Futures Project", what: "superhuman coder", year: 2032, kind: "model",
      note: "December 2025 revision: slipped from 2027 to 2032, three to five years later than their own earlier model." },
    { who: "Metaculus", what: "AGI", year: 2033, kind: "aggregate",
      note: "Community median, February 2026: 25% by 2029, 50% by 2033. The median was ~50 years out in 2020." },
    { who: "Epoch GATE", what: "AGI", year: 2034, kind: "model",
      note: "Median parameters, March 2025. Its authors warn against reading the output as a prediction." },
    { who: "Müller & Bostrom poll", what: "human-level machine intelligence", year: 2040, kind: "survey",
      note: "2012–13, four expert groups: 10% by 2022, 50% by 2040, 90% by 2075." },
    { who: "Kurzweil", what: "the Singularity", year: 2045, kind: "individual",
      note: "The date he set in 2005 and has never moved." },
    { who: "Grace et al. 2023", what: "AGI", year: 2047, kind: "survey",
      note: "2,778 authors in top AI venues: 10% by 2027, 50% by 2047 — thirteen years earlier than the same survey a year before." },
    { who: "XPT superforecasters", what: "AGI", year: 2048, kind: "aggregate",
      note: "Mid-2022: 25% by 2048." },
    { who: "Cotra (Bio Anchors)", what: "transformative AI", year: 2050, kind: "model",
      note: "2020. The most conservative of the quantitative models." },
    { who: "Grace et al. 2022", what: "AGI", year: 2059, kind: "survey",
      note: "50% by 2059 — the same instrument that said 2047 a year later." },
    { who: "Grace et al. 2023", what: "full automation of all occupations", year: 2116, kind: "survey",
      note: "The same 2023 survey, asking the neighbouring question. Seventy years apart from its own AGI answer." }
  ];

  /* --------------------------------------------------------------- definitions */
  var DEFINITIONS = [
    { term: "AGI", who: "Legg &amp; Hutter, 2007",
      what: "Expected performance across <em>all computable environments</em>, weighted by simplicity — a universal measure, not a task list.",
      claim: "A scalar, not a threshold. There is no point at which it is 'reached'.",
      problem: "Almost every survey and every lab uses a different definition: 'can do most human jobs'. The forecasts cite the rigorous definition and measure the loose one." },
    { term: "Superintelligence", who: "Bostrom, 2014",
      what: "An intellect much smarter than the best human brains in practically every field, including scientific creativity, wisdom and social skill.",
      claim: "A degree claim, relative to peak human performance, implementation-agnostic. Excludes collectives — a company is not a superintelligence.",
      problem: "No benchmark can establish 'in practically every field'. It is a comparative judgement, not a measurement." },
    { term: "The Singularity", who: "Vinge, 1993; Kurzweil, 2005",
      what: "For Vinge: greater-than-human intelligence arrives and 'our models must be discarded'. For Kurzweil: the merger of human and machine intelligence, dated 2045.",
      claim: "A claim about <em>predictive discontinuity</em> — that forecasting stops working — plus, in Kurzweil, a claim about merger.",
      problem: "Self-undermining as a forecast: if it is true that models must be discarded, no model can be used to date it. The two definitions are not the same claim at all." }
  ];

  /* ------------------------------------------------------------- track record */
  var TRACK_RECORD = [
    { stat: "9.7% vs 24.6%", label: "Forecasting Research Institute, 2026",
      text: "Superforecasters assigned an average 9.7% probability to benchmark outcomes that actually occurred. Domain experts assigned 24.6%. Both groups were far too pessimistic — but the specialists were much better." },
    { stat: "5 years early", label: "IMO gold, July 2025",
      text: "Frontier models reached gold-medal level at the International Mathematical Olympiad in 2025, against a median expert forecast of 2030 and a median superforecaster forecast of 2035." },
    { stat: "13 years in one year", label: "Grace et al. survey drift",
      text: "The same survey instrument moved its median AGI date from 2059 to 2047 in a single year. That is not a change in the technology; it is a change in the news." },
    { stat: "70 years internally", label: "Framing sensitivity",
      text: "The 2023 survey returns 2047 for 'all tasks' and 2116 for 'all occupations' — arguably the same question, answered seventy years apart. Treat these numbers as soft." },
    { stat: "2 walls", label: "The pattern from both AI winters",
      text: "Each cycle: a real technical result, an unbounded extrapolation of its scope, funding on the extrapolation, then a specific wall. Combinatorial explosion in 1973; brittleness and specialised-hardware economics in 1987. The walls now identified are data and power, and both are physical." }
  ];

  return {
    ERAS: ERAS, EVENTS: EVENTS, COMPUTE_POINTS: COMPUTE_POINTS,
    THRESHOLDS: THRESHOLDS, WALLS: WALLS, FORECASTS: FORECASTS,
    DEFINITIONS: DEFINITIONS, TRACK_RECORD: TRACK_RECORD,
    RATES: {
      trainingCompute: 5.0,        // x/yr, Epoch, since 2020
      algorithmic: 2.8,            // x/yr effective compute
      inferencePrice: 10,          // x/yr, mid-tier constant quality (9-900 range)
      chipPerfPerDollar: 1.49,     // x/yr, Epoch 2026
      chipPerfPerWatt: 1.34        // x/yr, Epoch 2026
    }
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = TL;
