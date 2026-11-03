/* Drone anchors — cost, production, milestones.

   Nothing here is fetched. There is no open, machine-readable dataset of weapons
   unit costs: the figures that exist are budget documents, fact sheets and
   analyst estimates, and they disagree with each other for a reason worth
   showing rather than smoothing over.

   The disagreement is definitional. An "MQ-9" costs $14M as a bare airframe,
   $23.5M as an average procurement unit, $34M as an average including spares and
   support, and $56.5M as a four-aircraft system with its ground station. All four
   are published by the US Air Force or the Congressional Research Service. So
   every point below carries a `low`/`high` band and a `confidence` field, and the
   chart plots the band rather than a single dot pretending to precision.

   confidence:
     "published" — a primary document (service fact sheet, CRS, budget) states it
     "reported"  — a named analyst or outlet states it; consistent across sources
     "estimated" — analysts disagree by more than 2×, or the figure is a range
                   imposed by the compiler rather than found in a source
*/
window.DRONES = {
  generated: "2026-11-02",
  lastMeasured: 2025,

  /* ---------------------------------------------------------- unit costs ---
     Cost to field ONE munition or airframe, current USD, in the year given.
     Not cost per flight hour, not life-cycle cost, not cost per kill — none of
     those are published consistently enough to plot. */
  cost: [
    {
      year: 1991, name: "Tomahawk cruise missile", kind: "missile",
      low: 1.3e6, high: 2.0e6, confidence: "reported",
      note: "The baseline this page is measured against: a guided munition that reaches a target hundreds of kilometres away. Procurement-unit cost, current dollars."
    },
    {
      year: 1995, name: "MQ-1 Predator", kind: "recon",
      low: 2.9e6, high: 4.0e6, confidence: "reported",
      note: "Reconnaissance aircraft for its first six years; armed from 2001. Air & Space Forces Magazine cites $2.9M an aircraft, the commonly quoted flyaway figure is $4.0M."
    },
    {
      year: 2007, name: "MQ-9 Reaper", kind: "strike",
      low: 23.5e6, high: 34.0e6, confidence: "published",
      note: "Average procurement unit cost, FY2020 ($23.5M, CRS) against the ~$34M average in 2025 dollars. The Air Force's own $56.5M figure is a four-aircraft system with ground station and satellite link — a different object, and the reason a single 'price' for a drone is meaningless."
    },
    {
      year: 2014, name: "Bayraktar TB2", kind: "strike",
      low: 4.0e6, high: 7.0e6, confidence: "reported",
      note: "The export-price range reported for the aircraft that made armed drones a middle-power weapon. Turkey's own programme cost is not published."
    },
    {
      year: 2021, name: "Shahed-136 / Geran-2", kind: "oneway",
      low: 20e3, high: 50e3, confidence: "reported",
      note: "CSIS Missile Threat's estimate, the figure most analysts converge on. A one-way attack drone: the airframe IS the warhead, so there is no recovery cost and no sustainment tail."
    },
    {
      year: 2023, name: "FPV strike drone", kind: "fpv",
      low: 300, high: 1000, confidence: "reported",
      note: "A racing quadcopter with a shaped charge, assembled in Ukraine from commercial parts. The lower bound is a kit; the upper bound is a finished unit with battery, video link and warhead."
    }
  ],

  /* ----------------------------------------------------- strike cost curve ---
     The number that actually decides what a war costs: dollars per warhead
     delivered to a target. Computed in war-app.js from the table above, not
     stored, so it cannot drift from its own inputs. */

  /* ---------------------------------------------------------- production ---
     Ukrainian declared output of FPV drones. These are government statements,
     not audited deliveries — the distinction matters, and both the page and the
     checks say so. The point of the series is the shape: it roughly doubles
     every year for four years. */
  production: {
    country: "Ukraine",
    unit: "FPV drones a year",
    points: [
      { year: 2022, units: 3000, confidence: "reported", note: "pre-invasion output was a few thousand a year in total, across every type" },
      { year: 2023, units: 800000, confidence: "reported" },
      { year: 2024, units: 2000000, confidence: "reported" },
      { year: 2025, units: 4000000, confidence: "reported", note: "declared production; a second official figure puts capacity at 8–10M" }
    ],
    capacity2025: 8000000
  },

  /* ---------------------------------------------------------- milestones ---
     Dates, not estimates. Each is a moment when a drone changed what a state
     could do, rather than a moment when a drone was invented. */
  milestones: [
    { year: 1917, label: "Sperry Aerial Torpedo", kind: "recon",
      note: "A gyroscope and a barometer flying a biplane into a target. Never used in anger; the idea is a century older than the technology that made it work." },
    { year: 1964, label: "AQM-34 in Vietnam", kind: "recon",
      note: "The first drone flown in sustained combat — reconnaissance over heavily defended airspace where a crewed aircraft would be lost." },
    { year: 1982, label: "Bekaa Valley", kind: "strike",
      note: "Israel flies decoy and ISR drones ahead of the strike package, maps the Syrian air-defence network, and destroys it in hours. Drones stop being sensors and start being a way to win an air campaign." },
    { year: 1991, label: "Surrender to a Pioneer", kind: "recon",
      note: "Iraqi troops on Faylaka Island surrender to a US Navy Pioneer overhead. The first time an enemy laid down arms to something with nobody aboard." },
    { year: 1995, label: "Predator enters service", kind: "recon",
      note: "A reconnaissance aircraft with a satellite link. The operator is in Nevada and the aircraft is over the Balkans, which is the moment the geography of the cockpit detaches from the geography of the war." },
    { year: 2001, label: "First armed Predator strike", kind: "strike",
      note: "A Hellfire from a drone kills a target in Afghanistan. The 'signature strike' era follows: a weapon that can loiter for 20 hours changes the decision loop from hours to whatever the operator wants." },
    { year: 2007, label: "Reaper", kind: "strike",
      note: "More payload, more endurance — and a price that rises with both. The American drone programme goes up-market exactly as the components to go down-market become available." },
    { year: 2011, label: "RQ-170 captured intact", kind: "recon",
      note: "Iran lands a US stealth drone. The point is not the airframe: it is that the technology diffuses, and every state that wanted one now knows what one looks like inside." },
    { year: 2019, label: "Abqaiq", kind: "oneway",
      note: "Eighteen drones and seven cruise missiles remove half of Saudi Arabia's oil output. A $50k airframe against a facility worth tens of billions: the exchange ratio becomes the strategy." },
    { year: 2020, label: "Nagorno-Karabakh", kind: "strike",
      note: "TB2s and loitering munitions destroy armour and air defence faster than they can be replaced. The first war decided by attritable aircraft between two states." },
    { year: 2022, label: "Ukraine, FPV at scale", kind: "fpv",
      note: "The cost curve bends: a $500 quadcopter with a shaped charge becomes the primary anti-armour weapon in a European land war, produced by the million rather than the hundred." },
    { year: 2023, label: "Black Sea naval drones", kind: "oneway",
      note: "Uncrewed surface vessels with no crew to lose push a fleet out of the western Black Sea. Sea denial stops requiring a navy." },
    { year: 2024, label: "Fibre-optic FPV", kind: "fpv",
      note: "A spool of glass fibre replaces the radio link. Electronic warfare stops working against it, and the countermeasure moves from jamming back to kinetics." },
    { year: 2025, label: "Drone-on-drone interception", kind: "fpv",
      note: "Cheap interceptors against cheap attackers, with terminal guidance on the aircraft. Air defence stops being a missile battery and becomes a second drone." }
  ],

  sources: [
    {
      name: "USAF fact sheets, MQ-1 and MQ-9",
      provider: "US Air Force",
      url: "https://www.af.mil/about-us/fact-sheets/display/article/104470/mq-9-reaper/",
      note: "The $56.5M figure is a four-aircraft system with sensors, ground control station and satellite link, in FY2011 dollars. It is the number most often quoted as the price of one aircraft, and it is not."
    },
    {
      name: "MQ-9A Reaper: background and issues",
      provider: "Congressional Research Service, IF13318",
      url: "https://www.everycrsreport.com/reports/IF13318.html",
      note: "Average procurement unit cost $23.5M in FY2020 dollars, $28.7M in 2026 dollars. The most defensible single figure for a Reaper airframe."
    },
    {
      name: "Shahed-131 and -136",
      provider: "CSIS Missile Threat",
      url: "https://missilethreat.csis.org/missile/shahed-131-and-136/",
      note: "The $20,000–50,000 estimate. Iranian production cost is not published; the range is an analyst estimate that has been stable across several institutions."
    },
    {
      name: "Elegy for the Predator",
      provider: "Air & Space Forces Magazine",
      url: "https://www.airandspaceforces.com/article/elegy-for-the-predator/",
      note: "$2.9M an aircraft at the end of the programme, against a $4M figure that is more commonly quoted."
    },
    {
      name: "Ukraine's drone industry",
      provider: "Georgetown Security Studies Review; RNBO (Ukraine's National Security Council)",
      url: "https://gssr.ge.georgetown.edu/the-forum/regions/eurasia/a-first-point-view-examining-ukraines-drone-industry/",
      note: "Production of 'a few thousand' in 2022, more than 2 million in 2024; Ukraine's security council put industrial capacity above 8 million a year in 2026. These are declarations of output, not audited deliveries."
    }
  ],

  checks: [
    { label: "every cost has a band", value: "6 of 6",
      detail: "no single-point price is plotted: each anchor carries the low and high its source supports" },
    { label: "cheapest against dearest", value: "FPV / Reaper",
      detail: "the FPV's upper bound is under one ten-thousandth of the Reaper's lower bound — four orders of magnitude, within one chart, on the same mission type" },
    { label: "definition trap documented", value: "MQ-9",
      detail: "four published figures for one aircraft, from $14M to $56.5M, differing by what is counted rather than by inflation" },
    { label: "production doubling", value: "~×2.0 a year",
      detail: "3k → 800k → 2M → 4M is between 1.9× and 2.7× a year, which is what a supply chain looks like when it is the constraint and money is not" },
    { label: "declared, not audited", value: "4 of 4",
      detail: "the production series is government statements. Nothing here verifies that the units were built, delivered or flown" },
    { label: "milestones are dates", value: "14 of 14",
      detail: "no milestone year is an estimate; the interpretation in each note is the part that is arguable" }
  ]
};
