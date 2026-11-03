#!/usr/bin/env node
/*
 * ingest-metabolism.mjs — what a population needs to keep living, 1961 to now.
 *
 *   node ingest-metabolism.mjs          # fetch, derive, check, write
 *   node ingest-metabolism.mjs --dry
 *
 * Food, fresh water, arable land, the reach of the health system, and the air
 * traffic that moves a pathogen between them. The pages about the machine ask
 * what production becomes; this one asks what the throughput has to keep doing
 * for there to be anybody to produce for.
 *
 * Source: World Bank World Development Indicators, no key. The global series
 * prefer the Bank's own "World" aggregate and fall back to an unweighted mean
 * across countries where the aggregate does not exist — the fallback is named
 * in the checks rather than hidden, because a mean of countries and a world
 * total are different objects.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const API = "https://api.worldbank.org/v2";

const IND = {
  food: "AG.PRD.FOOD.XD",        // food production index, 2014-2016 = 100
  pop: "SP.POP.TOTL",
  under: "SN.ITK.DEFC.ZS",       // prevalence of undernourishment, %
  imm: "SH.IMM.MEAS",            // measles immunisation, % of 1-year-olds
  hex: "SH.XPD.CHEX.GD.ZS",      // current health expenditure, % of GDP
  air: "IS.AIR.PSGR",            // air passengers carried
  water: "ER.H2O.FWTL.ZS",       // freshwater withdrawal, % of internal resources
  land: "AG.LND.ARBL.HA.PC",     // arable land, hectares per person
  le: "SP.DYN.LE00.IN",          // life expectancy at birth
  wAbs: "ER.H2O.FWTL.K3",        // freshwater withdrawal, billion m³ a year
  wRes: "ER.H2O.INTR.K3",        // internal renewable freshwater, billion m³ a year
  cereal: "AG.PRD.CREL.MT"       // cereal production, metric tonnes
};

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+metabolism page)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const cl = await get(`${API}/country?format=json&per_page=400`);
if (!Array.isArray(cl) || !cl[1]) throw new Error("country list unavailable");
const meta = {};
for (const c of cl[1]) {
  meta[c.id] = { name: c.name, region: c.region.value, income: c.incomeLevel.value, agg: c.region.id === "NA" };
}

const raw = {};
for (const [k, code] of Object.entries(IND)) {
  const j = await get(`${API}/country/all/indicator/${code}?format=json&per_page=25000&date=1960:2026`);
  if (!Array.isArray(j) || !j[1]) throw new Error("no rows for " + code);
  raw[k] = j[1].filter((r) => r.value != null && meta[r.countryiso3code]);
  await new Promise((r) => setTimeout(r, 220));
}

const yearSet = new Set();
for (const k of Object.keys(raw)) for (const r of raw[k]) yearSet.add(+r.date);
const years = [...yearSet].sort((a, b) => a - b);

/* iso → indicator → year → value */
const byIso = new Map();
for (const [k, rows] of Object.entries(raw)) {
  for (const r of rows) {
    const iso = r.countryiso3code;
    let o = byIso.get(iso);
    if (!o) { o = {}; byIso.set(iso, o); }
    if (!o[k]) o[k] = {};
    o[k][+r.date] = +r.value;
  }
}

const seriesOf = (iso, k) => {
  const o = byIso.get(iso);
  if (!o || !o[k]) return years.map(() => null);
  return years.map((y) => (o[k][y] != null ? o[k][y] : null));
};

/* The global series: the World aggregate where it exists, otherwise the mean
   across countries in that year. Which one was used is recorded per series. */
const fallbacks = [];
function global(k) {
  const wld = seriesOf("WLD", k);
  const have = wld.filter((v) => v != null).length;
  if (have >= 8) return { values: wld, how: "World aggregate" };
  const vals = years.map((y, i) => {
    const xs = [];
    for (const [iso, o] of byIso) {
      if (meta[iso].agg) continue;
      if (o[k] && o[k][y] != null) xs.push(o[k][y]);
    }
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  });
  const n = vals.filter((v) => v != null).length;
  if (n) fallbacks.push(k + " (" + n + " years, unweighted mean of countries)");
  return { values: vals, how: "mean of countries" };
}

const world = {};
const how = {};
for (const k of ["food", "pop", "under", "imm", "hex", "air", "water", "land", "le",
                 "wAbs", "wRes", "cereal"]) {
  const g = global(k);
  world[k] = g.values.map((v) => (v == null ? null : +v.toFixed(4)));
  how[k] = g.how;
}

/* Each series is indexed from its own first year unless a base is forced.
   Using one shared base is right for food against population and wrong for air
   traffic, which starts in 1970 — the first version of this divided 1970 levels
   by a 1961 value that did not exist and produced an empty series that still
   passed every check, because nothing was counting the nulls. */
function index(vals, baseAt) {
  const at = baseAt != null ? baseAt : vals.findIndex((v) => v != null);
  const base = at >= 0 ? vals[at] : null;
  return vals.map((v) => (v == null || !base ? null : +((v / base) * 100).toFixed(2)));
}
const airIdx = index(world.air);
const airBase = years[world.air.findIndex((v) => v != null)];

/* ------------------------------------------------- what is taken, and from what

   Water first. Two different objects are compared here and the difference is the
   whole point. Withdrawal is a *flow* removed from rivers, reservoirs and aquifers
   in a year. Internal renewable resources are the *flow* the country's own
   territory generates in the same year — rain and river headwaters inside the
   border. The second is a sustainable ceiling, not a tank that empties: taking
   more than it in a year means mining groundwater, desalinating, or importing the
   difference embedded in food. */

const waterSum = { values: [], count: [] };
for (let i = 0; i < years.length; i++) {
  let s = 0, n = 0;
  for (const [iso, o] of byIso) {
    if (meta[iso].agg) continue;
    if (o.wAbs && o.wAbs[years[i]] != null) { s += o.wAbs[years[i]]; n++; }
  }
  waterSum.values.push(n ? +s.toFixed(1) : null);
  waterSum.count.push(n);
}

/* The Bank publishes a World row only from 2014, so any long series has to be
   built by adding countries up — which is only legitimate if it reproduces the
   published total where both exist. That comparison is run here, not asserted. */
const wAbsWorld = world.wAbs;
const validations = [];
for (let i = 0; i < years.length; i++) {
  if (wAbsWorld[i] != null && waterSum.values[i] != null) {
    validations.push({ year: years[i], published: wAbsWorld[i], summed: waterSum.values[i] });
  }
}
const worstGap = validations.length
  ? validations.reduce((a, v) => {
      const g = Math.abs(v.summed / v.published - 1);
      return g > a.g ? { g, v } : a;
    }, { g: 0, v: validations[0] })
  : null;

/* Only years where the sum covers most of the world are drawn. Before about 1990
   the report count is in the dozens and the total is an artefact of who reported. */
const COVER_MIN = 120;
const waterYears = [];
for (let i = 0; i < years.length; i++) {
  if (waterSum.count[i] >= COVER_MIN && waterSum.values[i] != null) {
    waterYears.push({ year: years[i], withdrawal: waterSum.values[i], countries: waterSum.count[i] });
  }
}

/* The cross-section: every country whose own renewable supply is smaller than
   what it takes out in the latest year that has both numbers for 100+ countries. */
/* The Bank's country labels are legal names and read badly in a sentence:
   "Egypt, Arab Rep." in a list of deficits looks like a data export, which is
   what it is. Display names only — the series are keyed by ISO code throughout. */
const NICE = {
  "Egypt, Arab Rep.": "Egypt", "Yemen, Rep.": "Yemen", "Iran, Islamic Rep.": "Iran",
  "Korea, Rep.": "South Korea", "Korea, Dem. People's Rep.": "North Korea",
  "Russian Federation": "Russia", "Syrian Arab Republic": "Syria", "Venezuela, RB": "Venezuela",
  "Congo, Dem. Rep.": "DR Congo", "Congo, Rep.": "Congo", "Lao PDR": "Laos",
  "Viet Nam": "Vietnam", "Bolivia (Plurinational State of)": "Bolivia", "Slovak Republic": "Slovakia",
  "Czechia": "Czechia", "Tanzania": "Tanzania", "Turkiye": "Turkey", "Türkiye": "Turkey"
};
const nice = (n) => NICE[n] || n;

const iStress = latestPair("wAbs", "wRes");
const stress = { year: years[iStress], points: [] };
for (const [iso, o] of byIso) {
  if (meta[iso].agg) continue;
  const a = o.wAbs && o.wAbs[stress.year], r = o.wRes && o.wRes[stress.year];
  if (a == null || r == null || r <= 0) continue;
  stress.points.push({
    iso,
    name: nice(meta[iso].name),
    region: meta[iso].region,
    withdrawal: +a.toFixed(2),
    renewable: +r.toFixed(2),
    ratio: +((a / r) * 100).toFixed(1),
    deficit: +(a - r).toFixed(2),
    pop: o.pop && o.pop[stress.year] != null ? Math.round(o.pop[stress.year]) : null
  });
}
stress.points.sort((x, y) => y.deficit - x.deficit);
const overdraw = stress.points.filter((p) => p.deficit > 0);
const worldStress = (() => {
  const i = years.indexOf(stress.year);
  const a = world.wAbs[i], r = world.wRes[i];
  return a != null && r != null ? +((a / r) * 100).toFixed(1) : null;
})();

/* Food second. Cereal production is the one absolute mass series the Bank
   publishes with a sixty-year history, and cereals are about half of the
   calories people eat. Calories come from FAO's food balance sheets via OWID and
   are a *supply* figure — what reaches the retail level, not what is eaten. */
const cereal = world.cereal;
const cerealPerPerson = cereal.map((v, i) =>
  (v != null && world.pop[i] ? +((v / world.pop[i]) * 1000).toFixed(1) : null));

async function csvText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "oracle-lab-ingest/1.0" } });
    if (!res.ok) throw new Error(res.status + " — " + url);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const KCAL_FLOOR = 2100;   // FAO's reference minimum dietary energy requirement
const kcalCap = years.map(() => null);
let kcalStatus = "ok";
try {
  const text = await csvText("https://ourworldindata.org/grapher/daily-per-capita-caloric-supply.csv");
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",").map((h) => h.trim());
  const col = head[head.length - 1];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (cells[0] !== "World") continue;
    const y = +cells[2], v = parseFloat(cells[cells.length - 1]);
    if (!isFinite(y) || !isFinite(v)) continue;
    const k = years.indexOf(y);
    if (k >= 0) kcalCap[k] = +v.toFixed(1);
  }
} catch (e) {
  kcalStatus = "unavailable: " + e.message.split(" — ")[0];
}

/* Totals, not averages: people × a per-person figure, in trillion kcal a day.
   The floor is FAO's own reference minimum, applied to the same population, so
   the gap between the two lines is the world's calorie surplus or deficit. */
const kcalYears = kcalCap.filter((v) => v != null).length;
const kcalTotal = kcalCap.map((v, i) =>
  (v != null && world.pop[i] ? +((v * world.pop[i]) / 1e12).toFixed(3) : null));
const kcalNeed = world.pop.map((p) => (p != null ? +((KCAL_FLOOR * p) / 1e12).toFixed(3) : null));

/* Food against people is drawn from *calories available*, not from the Bank's
   food production index. The index is a weighted aggregate and its World row
   breaks where the reporting set changes: it jumps 28.7 → 39.4 in 1993 and
   45.2 → 83.2 between 1995 and 2000, and it stops in 2020. Drawing it produced
   an eightfold rise where the food supply rose 3.6-fold, which is what made the
   population line look flat. Total calories are an absolute quantity from FAO's
   balance sheets, so they can be compared with people without an index
   rebasing underneath them. */
const foodBase = years.findIndex((y, i) => kcalTotal[i] != null && world.pop[i] != null);
const baseYear = years[foodBase];
const foodIdx = index(kcalTotal, foodBase);
const popIdx = index(world.pop, foodBase);

/* The discarded series is measured rather than described, so the check can say
   how big the break is and where. */
const bankFood = world.food;
let worstJump = { pct: 0, from: null, to: null };
let prev = null;
for (let i = 0; i < bankFood.length; i++) {
  if (bankFood[i] == null) continue;
  if (prev != null) {
    /* steps are measured between consecutive *reported* years, because the
       break hides in a gap: the 1990s hole is where the aggregate changes
       composition, not where the harvest changed */
    const pct = (bankFood[i] / bankFood[prev] - 1) * 100;
    if (pct > worstJump.pct) worstJump = { pct, from: years[prev], to: years[i] };
  }
  prev = i;
}
const bankLastYear = prev != null ? years[prev] : null;

/* Country snapshot for the two scatter views. Latest year in which at least
   100 countries have both numbers. */
function latestPair(k1, k2) {
  for (let i = years.length - 1; i >= 0; i--) {
    let n = 0;
    for (const [iso, o] of byIso) {
      if (meta[iso].agg) continue;
      if (o[k1] && o[k1][years[i]] != null && o[k2] && o[k2][years[i]] != null) n++;
    }
    if (n >= 100) return i;
  }
  return years.length - 1;
}
const iWater = latestPair("water", "le");
const iLand = latestPair("land", "le");

function snapshot(i, kA, kB) {
  const out = [];
  for (const [iso, o] of byIso) {
    if (meta[iso].agg) continue;
    if (!o[kA] || o[kA][years[i]] == null || !o[kB] || o[kB][years[i]] == null) continue;
    out.push({
      iso,
      name: meta[iso].name,
      region: meta[iso].region,
      a: +o[kA][years[i]].toFixed(2),
      b: +o[kB][years[i]].toFixed(2),
      pop: o.pop && o.pop[years[i]] != null ? Math.round(o.pop[years[i]]) : null
    });
  }
  return out;
}
const waterPoints = snapshot(iWater, "water", "le");
const landPoints = snapshot(iLand, "land", "le");

const lastOf = (a) => {
  for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return { v: a[i], i };
  return null;
};
const peakOf = (a) => {
  let b = null;
  a.forEach((v, i) => { if (v != null && (!b || v > b.v)) b = { v, i }; });
  return b;
};

const underLast = lastOf(world.under);
const underPeak = peakOf(world.under);
const immLast = lastOf(world.imm);
const airLast = lastOf(world.air);
const airPeak = peakOf(world.air);
const foodLast = lastOf(foodIdx);
const popLast = lastOf(popIdx);

/* The ratio the page headlines must be taken from one year. Food ends a couple
   of years before the population series does, and dividing the last food value
   by the last population value silently compares 2023 with 2025 — the same
   mismatched-pair defect that once turned the calorie surplus into 3% instead
   of 43%. */
let bothYear = years.length - 1;
while (bothYear > 0 && (foodIdx[bothYear] == null || popIdx[bothYear] == null)) bothYear--;
const foodNow = foodIdx[bothYear], popNow = popIdx[bothYear];

const checks = [
  {
    label: "Years covered",
    value: years[0] + " → " + years[years.length - 1] + " (" + years.length + " years)",
    detail: "Food production and population reach back to 1961; water withdrawal is reported roughly every five years, so that series has visible steps rather than a smooth line. Nothing is interpolated between them."
  },
  {
    label: "Series not taken from the World aggregate",
    value: fallbacks.length ? fallbacks.length + "" : "none",
    detail: fallbacks.length
      ? "Fell back to an unweighted mean across countries: " + fallbacks.join(", ") + ". A mean of countries and a world total are different objects — the first treats Luxembourg and India as equal — and the page labels which is drawn."
      : "Every global series is the World Bank's own World aggregate, so no fallback was needed."
  },
  {
    label: "Food against people, first year both exist",
    value: baseYear + " = 100 for both",
    detail: "Total calories available and population, indexed to the same base year. The chart is only a comparison because both denominators are the same year; the levels themselves are not comparable and are not shown here."
  },
  {
    label: "Undernourishment, now and at its peak",
    value: (underLast ? underLast.v.toFixed(1) : "–") + "% now" +
      (underPeak ? " · peak " + underPeak.v.toFixed(1) + "% in " + years[underPeak.i] : ""),
    detail: "Prevalence of undernourishment in the world population. The peak is not a historical famine but a recent one — the series is the clearest evidence that the food system's failure mode is distribution and price, not total output."
  },
  {
    label: "Water: summed countries against the published world total",
    value: worstGap ? (worstGap.g * 100).toFixed(1) + "% worst gap" : "–",
    detail: worstGap
      ? "The Bank publishes a World water total only from 2014. The long series is built by adding countries, which is legitimate only if it reproduces that total: across " +
        validations.length + " overlapping years the worst mismatch is " + (worstGap.g * 100).toFixed(1) +
        "% (" + worstGap.v.year + ": " + worstGap.v.summed.toFixed(0) + " against " + worstGap.v.published.toFixed(0) + " km³)."
      : "No overlap between the country sum and a published world row, so the long water series is not validated and is not drawn."
  },
  {
    label: "Water: years with a usable world sum",
    value: waterYears.length + " years from " + (waterYears.length ? waterYears[0].year : "–") +
      " to " + (waterYears.length ? waterYears[waterYears.length - 1].year : "–"),
    detail: "Drawn only where at least " + COVER_MIN + " countries reported, because a world total that adds up whoever happened to answer is a measure of reporting, not of water. The years before 1990 are on file and are deliberately not plotted."
  },
  {
    label: "Countries taking more than their own renewable supply",
    value: overdraw.length + " of " + stress.points.length + " in " + stress.year,
    detail: overdraw.length
      ? "The largest overdrafts in absolute volume: " + overdraw.slice(0, 3).map(function (p) {
          return p.name + " " + p.deficit.toFixed(1) + " km³";
        }).join(", ") + ". A deficit is met by mining groundwater, desalination, or importing food grown with somebody else's water."
      : "No country in this year withdrew more than its internal renewable supply."
  },
  {
    label: "Cereal production per person",
    value: (() => {
      const a = cerealPerPerson.find((v) => v != null);
      const b = lastOf(cerealPerPerson);
      return b ? (a ? a.toFixed(0) + " → " : "") + b.v.toFixed(0) + " kg a year" : "–";
    })(),
    detail: "World cereal output divided by world population. This is a flow, not a stock: the reserve that actually buffers a bad harvest is grain in store, and stock-to-use ratios are not in this dataset."
  },
  {
    label: "Calories supplied against the minimum requirement",
    value: (() => {
      if (kcalStatus !== "ok") return kcalStatus;
      /* Both sides must come from the same year: the supply series ends a year
         or two before the population series does, and taking the last value of
         each independently invented a 3-point surplus out of a mismatched pair. */
      for (let i = years.length - 1; i >= 0; i--) {
        if (kcalTotal[i] != null && kcalNeed[i] != null) {
          return kcalYears + " years · " + ((kcalTotal[i] / kcalNeed[i] - 1) * 100).toFixed(0) +
            "% above the floor in " + years[i];
        }
      }
      return "no overlapping year";
    })(),
    detail: "Total calories reaching the retail level, in trillion kcal a day, against " + KCAL_FLOOR + " kcal for every person alive — FAO's reference minimum, applied to the same population. Supply is not intake: the FAO figure is food available, and waste sits inside it."
  },
  {
    label: "The discarded food index, and why",
    value: "largest step +" + worstJump.pct.toFixed(0) + "% " + worstJump.from + " → " + worstJump.to +
      " · series stops in " + bankLastYear,
    detail: "The World Bank's World row for the food production index is a weighted aggregate whose reporting set changes: it steps up by more than half in a single reported year and ends in 2020, while country data continues. Indexed and drawn, it produced an eightfold rise where the calories rose 3.6-fold — and made population look flat beside it. The page draws total calories from FAO instead, which are absolute and can be compared with people."
  },
  {
    label: "Air travel against its pre-2020 peak",
    value: airLast && airPeak
      ? (airLast.v / 1e9).toFixed(2) + "bn passengers · " +
        Math.round((airLast.v / airPeak.v - 1) * 100) + "% from the " + years[airPeak.i] + " peak"
      : "–",
    detail: "Passengers carried, the best public measure of how fast a novel pathogen can reach everywhere. The 2020 collapse and recovery is the largest single event in the series and the only natural experiment on that question."
  }
];

const out = {
  generated: STAMP,
  span: { from: years[0], to: years[years.length - 1], n: years.length },
  source: {
    name: "World Bank World Development Indicators",
    url: "https://data.worldbank.org/",
    note: "Population, prevalence of undernourishment, measles immunisation, health expenditure, air passengers carried, freshwater withdrawal as a share of internal resources, and arable land per person come from the World Bank. Food is total calories available from FAO's food balance sheets via Our World in Data, multiplied by population — not the Bank's food production index, whose World row has a composition break. No key."
  },
  years,
  how,
  world: {
    food: world.food, pop: world.pop, under: world.under, imm: world.imm,
    hex: world.hex, air: world.air, water: world.water, land: world.land, le: world.le,
    foodIdx, popIdx, airIdx,
    wAbs: world.wAbs, wRes: world.wRes, cereal, cerealPerPerson,
    kcalCap, kcalTotal, kcalNeed,
    /* Drawn as they are shown: megatonnes, billions of people, cubic kilometres,
       so no chart has to rescale a series on the fly and disagree with the prose. */
    cerealMt: cereal.map((v) => (v == null ? null : +(v / 1e6).toFixed(1))),
    popB: world.pop.map((v) => (v == null ? null : +(v / 1e9).toFixed(3))),
    wSum: waterSum.values,
    wRatio: waterSum.values.map((v, i) =>
      (v != null && world.wRes[i] ? +((v / world.wRes[i]) * 100).toFixed(2) : null))
  },
  /* The water section needs four things the indexed charts above cannot carry:
     a country sum with its coverage, the published total it is checked against,
     and the country-level comparison of what is taken against what renews. */
  water: {
    sum: waterSum,
    years: waterYears,
    published: wAbsWorld,
    reserve: world.wRes,
    coverMin: COVER_MIN,
    stress,
    worldStress
  },
  kcalFloor: KCAL_FLOOR,
  scatter: {
    water: { year: years[iWater], points: waterPoints },
    land: { year: years[iLand], points: landPoints }
  },
  now: {
    airBase,
    under: underLast && +underLast.v.toFixed(1),
    imm: immLast && +immLast.v.toFixed(1),
    air: airLast && Math.round(airLast.v),
    foodIdx: foodNow != null ? +foodNow.toFixed(1) : null,
    popIdx: popNow != null ? +popNow.toFixed(1) : null,
    ratioYear: years[bothYear],
    baseYear
  },
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, years: out.years.length + " years", scatter: "omitted" }, null, 2));
} else {
  const body = `/* Generated by ingest-metabolism.mjs on ${STAMP}. Do not edit by hand.
   ${years.length} years, ${years[0]} to ${years[years.length - 1]},
   nine World Development Indicators, food and population indexed to ${baseYear}.
   Regenerate with:  node ingest-metabolism.mjs                               */
window.METABOLISM = ${JSON.stringify(out)};
`;
  fs.writeFileSync("metabolism-data.js", body);
  console.log(`wrote metabolism-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
console.log("  scatter: water " + waterPoints.length + " countries (" + years[iWater] + "), land " + landPoints.length + " (" + years[iLand] + ")");
