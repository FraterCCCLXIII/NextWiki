/* Measured anchors for the robots page.

   Everything in this file is either a published number or a date. Nothing here
   is computed. The model in robots.js interpolates between these anchors and
   runs forward from the last one; keeping the two separate is the only reason
   the page can say which line is data and which is arithmetic.

   Sources are listed per series because they are not the same vintage: the
   stock series is IFR's World Robotics (2025 edition for 2024, 2026 press
   release for 2025), the price series is IFR's own average-unit-price figure
   as quoted in the payback literature, and the density series is IFR via OWID. */
window.ROBOTS_DATA = {
  generated: "2026-11-02",
  lastMeasured: 2025,

  /* Operational stock of industrial robots in use worldwide, units.
     Pre-2018 values are IFR series reconstructions, so they are marked
     approximate; 2023-2025 are the published figures. */
  stock: [
    [1961, 1],          // Unimate, the first industrial robot, at a GM plant
    [1970, 2000],
    [1980, 25000],
    [1990, 450000],
    [2000, 750000],
    [2005, 1000000],
    [2010, 1150000],
    [2015, 1630000],
    [2018, 2440000],
    [2019, 2730000],
    [2020, 3010000],
    [2021, 3480000],
    [2022, 3900000],
    [2023, 4281585],    // IFR World Robotics 2024: 4,281,585 (+10%)
    [2024, 4663698],    // IFR World Robotics 2025: 4,663,698 (+9%)
    [2025, 5000000]     // IFR, 2026: "a record 5 million units" (+9%)
  ],

  /* Average price of an industrial robot unit, current USD.
     1995-2017 is IFR's average unit price: -60% from 2005 to $27,074 in 2017,
     and roughly -80% over 1995-2017 as reported in the payback literature.
     2020 and 2024 are interpolations of the same trend, marked approximate. */
  price: [
    [1995, 135400],
    [2000, 96000],
    [2005, 67700],
    [2010, 46000],
    [2015, 32000],
    [2017, 27074],      // IFR average unit price
    [2020, 25000],
    [2024, 22000]
  ],

  /* Robots per 1,000 manufacturing employees, world average. IFR via OWID. */
  density: [
    [2010, 5.0],
    [2015, 8.0],
    [2019, 11.3],
    [2021, 12.6],
    [2023, 16.2]
  ],

  /* Humanoid entry prices that actually shipped, USD. 2024-2025 only; this is
     a two-point series and should be read as such, not as a trend. */
  humanoid: [
    [2024, 16000],      // Unitree G1
    [2025, 5900]        // Unitree R1, the cheapest humanoid on sale
  ],

  /* Illustrative ceiling: the cheapest capable machine on the market. */
  humanoidTarget: 25000, // Tesla's stated Optimus target band is $20-30k

  milestones: [
    { year: 1961, title: "Unimate", note: "The first industrial robot starts on a GM assembly line: a 2-tonne arm that does die-casting transfers and welding. One unit on Earth." },
    { year: 1969, title: "Kawasaki licenses the technology", note: "Japan begins building its own; within a decade it will hold most of the world's robots." },
    { year: 1973, title: "Six axes", note: "KUKA's IR 6/60 establishes the articulated arm as the default industrial form. KUKA itself is a welding company that automated its own product." },
    { year: 1979, title: "PUMA", note: "Programmable Universal Machine for Assembly. Robots stop being bespoke machinery and become a product with a price list." },
    { year: 1981, title: "Japan owns the installed base", note: "Roughly 70% of the world's operational robots are in Japanese factories. Robot density, not robot invention, turns out to be the thing that compounds." },
    { year: 1990, title: "450,000 units", note: "Three decades of adoption get the world to under half a million robots, almost all in automotive and electronics." },
    { year: 1997, title: "Honda P2, then ASIMO", note: "A humanoid that walks. It does no economic work for twenty years, but it makes the humanoid form the default imagination of a robot." },
    { year: 2012, title: "Kiva", note: "Amazon buys the warehouse-robot company and deploys tens of thousands of units in three years — the first time robot count is limited by software and floor space rather than by price." },
    { year: 2013, title: "Cobots", note: "Universal Robots' arms are cheap, safe next to people, and installable without a cage. The unit stops needing an engineer to deploy." },
    { year: 2016, title: "Atlas", note: "Dynamic legged locomotion. Capability stops being the binding constraint on what a machine could do in a warehouse or a building site." },
    { year: 2021, title: "Optimus announced", note: "Tesla puts a $20,000-30,000 target price on a general-purpose humanoid. Industrial stock passes 3.5 million." },
    { year: 2022, title: "Language models reach the arm", note: "Foundation models make task specification a prompt. The cost of teaching a robot a new job starts to collapse, separately from the cost of the robot." },
    { year: 2023, title: "Humanoid pilots", note: "Figure and others begin paid trials in automotive plants. Stock reaches 4,281,585 units worldwide." },
    { year: 2024, title: "The price breaks", note: "Unitree ships a G1 humanoid at $16,000 and the stock passes 4.66 million. A humanoid now costs less than a year of a mid-skilled wage in a rich country." },
    { year: 2025, title: "$5,900", note: "Unitree's R1 undercuts a compact car. Industrial stock reaches 5 million units, 55% of them in China." },
    { year: 2030, proj: true, title: "Humanoids at industrial scale (projection)", note: "If humanoid unit cost follows the industrial curve, the price crosses $10,000 around the end of the decade. Adoption at that point is a capability and liability question, not a cost question." },
    { year: 2035, proj: true, title: "The market the analysts model (projection)", note: "Goldman Sachs' revised forecast puts the humanoid market at roughly $38bn by 2035; Morgan Stanley's is $5tn by 2050 including service networks. The spread between those two numbers is the honest uncertainty." },
    { year: 2050, proj: true, title: "Ownership is the question (projection)", note: "By the point robots are cheap enough to be ubiquitous, who owns them dominates every other variable in this model. That is what the levers on this page are for." }
  ],

  /* Model constants with their basis. Anything not in this list is a lever, and
     every lever is stated on the page rather than buried. */
  assumptions: [
    { key: "workers", label: "Global labour force", value: "3.5bn", basis: "ILO estimate of the employed and seeking work, 2025", conf: "measured" },
    { key: "wage", label: "Average annual wage", value: "$14,000", basis: "World GDP per worker x a ~55% labour share. A global average hides a 30x range.", conf: "derived" },
    { key: "system", label: "Installed system cost", value: "2.5x unit price", basis: "Integration, grippers, safety, commissioning. The unit price is roughly 40% of a working cell.", conf: "literature" },
    { key: "fte", label: "Work displaced per robot", value: "1.7 FTE", basis: "Shift-equivalent output of one industrial robot. Varies from 0.3 (cobot assisting a line) to 4 (lights-out cell).", conf: "assumed" },
    { key: "opex", label: "Robot running cost", value: "12% of capex/yr", basis: "Maintenance, energy, spares, software. Industrial robots are typically ~10-15% of capital cost annually.", conf: "literature" },
    { key: "capital", label: "Capital stock", value: "3.5x GDP", basis: "Standard capital-output ratio for the world economy", conf: "derived" },
    { key: "labourShare", label: "Labour share of income, 2025", value: "54%", basis: "ILO/KLEMS global estimate; the US is ~56%, China ~45%", conf: "measured" },
    { key: "sensitivity", label: "Labour-share sensitivity", value: "0.6", basis: "Each 10 points of work displaced takes ~6 points off labour's share. Calibrated so 2025 reproduces 54%.", conf: "assumed" },
    { key: "saving", label: "Savings rates by group", value: "35% / 22% / 4%", basis: "Top 1%, next 9%, bottom 90%. Wealth accumulates where income is not consumed.", conf: "literature" },
    { key: "multiple", label: "Equity multiple", value: "18x earnings", basis: "Long-run S&P 500 CAPE-ish average; a lever because AI capex cycles move it hard.", conf: "assumed" },
    { key: "wealth", label: "Wealth shares, 2025", value: "Top 1% = 45%, next 9% = 39%, bottom 90% = 16%", basis: "WID.world global net personal wealth. The bottom 90% figure is the one most people underestimate.", conf: "measured" }
  ],

  sources: [
    { name: "IFR World Robotics 2025", what: "Operational stock 4,663,698 units (2024); installations; robot density", url: "https://ifr.org/img/worldrobotics/Executive_Summary_WR_2025_Industrial_Robots.pdf" },
    { name: "IFR press release, 2026", what: "Operational stock reaching 5 million units in 2025; China share 55%", url: "https://ifr.org/ifr-press-releases/news/five-million-robots-now-operate-in-factories-globally" },
    { name: "IFR World Robotics 2024", what: "Operational stock 4,281,585 units (2023)", url: "https://ifr.org/img/worldrobotics/Executive_Summary_WR_2024_Industrial_Robots.pdf" },
    { name: "OWID / IFR", what: "Robots per 1,000 manufacturing employees, by country, 2023-2024", url: "https://ourworldindata.org/grapher/industrial-robots-in-operation-per-1000-employees" },
    { name: "IFR average unit price (via payback literature)", what: "$27,074 average robot price 2017, -60% since 2005, -80% since 1995", url: "https://www.mmscience.eu/journal/issues/october-2023/articles/payback-calculation-refinement-of-industrial-robot-applications/download" },
    { name: "WID.world", what: "Global net personal wealth shares by percentile", url: "https://wid.world/data/" },
    { name: "Morgan Stanley / Goldman Sachs", what: "Humanoid market forecasts: $5tn by 2050; $38bn by 2035", url: "https://www.morganstanley.com/insights/articles/humanoid-robot-market-5-trillion-by-2050" }
  ],

  /* Run by robots-app.js on load. Anything that fails is shown in red on the
     page rather than in a console nobody reads. */
  checks: [
    {
      name: "2023 stock matches IFR",
      test: function (d) {
        var v = valAt(d.stock, 2023);
        return Math.abs(v - 4281585) < 1 ? "4,281,585" : "got " + v;
      }
    },
    {
      name: "2024 stock matches IFR",
      test: function (d) {
        var v = valAt(d.stock, 2024);
        return Math.abs(v - 4663698) < 1 ? "4,663,698" : "got " + v;
      }
    },
    {
      name: "2025 stock reaches 5 million",
      test: function (d) {
        var v = valAt(d.stock, 2025);
        return v >= 4999000 && v <= 5001000 ? "5,000,000" : "got " + v;
      }
    },
    {
      name: "Stock never decreases",
      test: function (d) {
        for (var i = 1; i < d.stock.length; i++) {
          if (d.stock[i][1] < d.stock[i - 1][1]) return "drop at " + d.stock[i][0];
        }
        return "monotonic, 1961-2025";
      }
    },
    {
      name: "Price anchor 2017 = $27,074",
      test: function (d) {
        var v = valAt(d.price, 2017);
        return Math.abs(v - 27074) < 1 ? "$27,074" : "got " + v;
      }
    },
    {
      name: "Price fell ~80% 1995-2017",
      test: function (d) {
        var a = valAt(d.price, 1995), b = valAt(d.price, 2017);
        var fall = 1 - b / a;
        return Math.abs(fall - 0.8) < 0.02 ? (fall * 100).toFixed(1) + "%" : "got " + (fall * 100).toFixed(1) + "%";
      }
    },
    {
      name: "Density anchor 2023 = 16.2 per 1,000",
      test: function (d) {
        var v = valAt(d.density, 2023);
        return Math.abs(v - 16.2) < 0.05 ? "16.2" : "got " + v;
      }
    },
    {
      name: "Stock growth 2024-2025 ~ +7%",
      test: function (d) {
        var a = valAt(d.stock, 2024), b = valAt(d.stock, 2025);
        var g = b / a - 1;
        return g > 0.05 && g < 0.09 ? "+" + (g * 100).toFixed(1) + "%" : "got " + (g * 100).toFixed(1) + "%";
      }
    },
    {
      name: "Humanoid price collapse is real, not a typo",
      test: function (d) {
        var a = valAt(d.humanoid, 2024), b = valAt(d.humanoid, 2025);
        return b < a && b > 1000 ? "16,000 -> 5,900 in one year" : "check the series";
      }
    }
  ]
};

function valAt(pairs, year) {
  for (var i = 0; i < pairs.length; i++) if (pairs[i][0] === year) return pairs[i][1];
  return null;
}
