#!/usr/bin/env node
/*
 * ingest-gapminder.mjs — the country panel behind `world.html`.
 *
 * Fetches public data and writes `gapminder-data.js`. No dependencies, no API keys.
 *
 *   node ingest-gapminder.mjs          # fetch, derive, check, write gapminder-data.js
 *   node ingest-gapminder.mjs --dry    # fetch, derive, check, write nothing
 *
 * Sources (all keyless, all CC BY)
 *   Gapminder / Systema Globalis    income per person, long series, 1800-2019
 *   Gapminder / life_expectancy     life expectancy at birth, long trend, 1800-2100
 *   Our World in Data / UN WPP+HYDE population by country, 1800-2023
 *   Gapminder / entities            country names, region and income grouping
 *
 * Why three repositories rather than one: the plan assumed Systema Globalis carried
 * everything. It does not. Its life-expectancy file stops in 2013, and it has no
 * country-year population table at all (only age-by-gender splits). Gapminder's
 * dedicated life_expectancy repository runs 1800-2100, and OWID's population series
 * is the one with a country dimension reaching back to 1800. Taking the three files
 * that actually cover the intervals is better than one file that does not.
 *
 * The output is a panel: geo, year, three indicators. Everything the page draws is a
 * slice of it, so a later UN WPP age structure or Ember generation table slots into
 * the same shape without a rewrite.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ fetch */

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+gapminder panel)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const RAW = "https://raw.githubusercontent.com/open-numbers";
const SOURCE_URL = {
  income: `${RAW}/ddf--gapminder--systema_globalis/master/countries-etc-datapoints/ddf--datapoints--income_per_person_long_series--by--geo--time.csv`,
  life: `${RAW}/ddf--gapminder--life_expectancy/master/ddf--datapoints--life_expectancy_at_birth--by--geo--time.csv`,
  pop: "https://ourworldindata.org/grapher/population.csv?csvType=full&useColumnShortNames=true",
  entities: `${RAW}/ddf--gapminder--systema_globalis/master/ddf--entities--geo--country.csv`
};

/* ------------------------------------------------------------------- csv */

/* Quoted fields matter: the entities file has names like "Korea, Rep." and the
   income_mountains rows are JSON blobs. A split on comma would corrupt both. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toTable(text) {
  const rows = parseCsv(text);
  const head = rows.shift().map(s => s.trim());
  const idx = {};
  head.forEach((h, i) => { idx[h] = i; });
  return rows
    .filter(r => r.length >= head.length - 1)
    .map(r => {
      const o = {};
      head.forEach((h, i) => { o[h] = (r[i] === undefined ? "" : r[i]).trim(); });
      return o;
    });
}

/* ------------------------------------------------------------------ years */

/* Decadal before 1950, five-yearly to 2000, annual after. The animation is the
   point, but 200 countries x 224 years is 45k cells per indicator for data whose
   early years are already smoothed estimates. 44 frames is honest and 100 kB.

   The panel ends in 2019 because the income series does. Carrying the frame to
   2023 put population and life expectancy on screen with no x value to place them
   against, which is a chart of nothing — the first run of the page proved it. */
const YEARS = [];
for (let y = 1800; y <= 1950; y += 10) YEARS.push(y);
for (let y = 1960; y <= 2000; y += 5) YEARS.push(y);
for (let y = 2001; y <= 2019; y++) YEARS.push(y);

const START = YEARS[0], END = YEARS[YEARS.length - 1];

/* ------------------------------------------------------------------- load */

console.log("fetching 4 files…");
const [entText, incText, lifeText, popText] = await Promise.all([
  get(SOURCE_URL.entities), get(SOURCE_URL.income),
  get(SOURCE_URL.life), get(SOURCE_URL.pop)
]);
console.log(`  entities ${(entText.length / 1024).toFixed(0)} kB · income ${(incText.length / 1024).toFixed(0)} kB · ` +
            `life ${(lifeText.length / 1024).toFixed(0)} kB · population ${(popText.length / 1024).toFixed(0)} kB`);

/* entities: id, name, region, income group */
const entRows = toTable(entText);
const geo = {};
for (const r of entRows) {
  const id = r.country;
  if (!id) continue;
  const isCountry = r["is--country"] === "TRUE" || r["is--country"] === "true";
  if (!isCountry) continue;
  geo[id] = {
    name: r.name || id,
    region: (r.world_4region || "").trim().toLowerCase() || "other",
    income: (r.income_groups || "").trim()
  };
}

/* indicator CSVs -> { geo: { year: value } } */
function byGeo(table, geoKey, yearKey, valKey) {
  const out = {};
  for (const r of table) {
    const g = r[geoKey], y = +r[yearKey], v = +r[valKey];
    if (!g || !isFinite(y) || !isFinite(v)) continue;
    (out[g] || (out[g] = {}))[y] = v;
  }
  return out;
}

const inc = byGeo(toTable(incText), "geo", "time", "income_per_person_long_series");
const life = byGeo(toTable(lifeText), "geo", "time", "life_expectancy_at_birth");
const popTable = toTable(popText);
const popCol = Object.keys(popTable[0] || {}).find(k => /^population/.test(k)) || "population_historical";
/* OWID uses upper-case ISO3 in `code`, Gapminder uses lower-case geo ids. Joining
   without normalising produced a panel with a population column of zeroes, which
   the reconciliation check caught on the first run. */
const popUpper = byGeo(popTable, "code", "year", popCol);
const pop = {};
for (const k of Object.keys(popUpper)) pop[k.toLowerCase()] = popUpper[k];
const popWorld = pop.owid_wrl || {};

/* --------------------------------------------------------------- assemble */

const REGION_ORDER = ["africa", "americas", "asia", "europe", "other"];

const ids = Object.keys(geo).filter(id => inc[id] || life[id] || pop[id]);
ids.sort((a, b) => geo[a].name.localeCompare(geo[b].name));

const countries = [];
const seriesPop = [], seriesInc = [], seriesLe = [];

for (const id of ids) {
  countries.push({ id, name: geo[id].name, region: REGION_ORDER.indexOf(geo[id].region) === -1 ? 4 : REGION_ORDER.indexOf(geo[id].region) });

  /* Indicator by indicator, so a country with income but no population still
     appears on the axis with a minimum bubble rather than vanishing. */
  seriesInc.push(YEARS.map(y => {
    const v = inc[id] && inc[id][y];
    return v === undefined ? null : Math.round(v);
  }));
  seriesLe.push(YEARS.map(y => {
    const v = life[id] && life[id][y];
    return v === undefined ? null : Math.round(v * 10) / 10;
  }));
  seriesPop.push(YEARS.map(y => {
    const v = pop[id] && pop[id][y];
    return v === undefined ? null : Math.round(v);
  }));
}

/* ------------------------------------------------------------- aggregate */

function weightedMean(values, weights) {
  let s = 0, w = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i], k = weights[i];
    if (v == null || k == null || !isFinite(v) || !isFinite(k) || k <= 0) continue;
    s += v * k; w += k;
  }
  return w > 0 ? s / w : null;
}

function medianOf(values) {
  const v = values.filter(x => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function col(series, yi) { return series.map(s => s[yi]); }

const iLast = YEARS.length - 1;
const i2000 = YEARS.indexOf(2000);
const i1800 = YEARS.indexOf(1800);

const popLast = col(seriesPop, iLast);
const sumPopLast = popLast.reduce((a, v) => a + (v || 0), 0);
const worldPopOwid = popWorld[END];

const leLast = col(seriesLe, iLast);
const meanLeLast = weightedMean(leLast, popLast);

const incLast = col(seriesInc, iLast);
const medIncLast = medianOf(incLast);
const meanIncLast = weightedMean(incLast, popLast);

/* rank correlation between income (log) and life expectancy, 2019 */
function rankCorrelation(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] == null || ys[i] == null || !isFinite(xs[i]) || !isFinite(ys[i]) || xs[i] <= 0) continue;
    pairs.push([Math.log(xs[i]), ys[i]]);
  }
  const n = pairs.length;
  if (n < 10) return null;
  const rank = (arr, k) => {
    const order = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    order.forEach((o, pos) => { r[o[1]] = pos; });
    return r;
  };
  const rx = rank(pairs.map(p => p[0])), ry = rank(pairs.map(p => p[1]));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = rx[i] - (n - 1) / 2, b = ry[i] - (n - 1) / 2;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}

const rankCorr = rankCorrelation(incLast, col(seriesLe, iLast));

/* ----------------------------------------------------------------- checks */

const checks = [];

function check(label, value, detail, ok) {
  checks.push({ label, value, detail, status: ok ? "ok" : "flag" });
}

const nInc = Object.keys(inc).length, nLe = Object.keys(life).length, nPop = Object.keys(pop).length;
check("rows parsed", `${nInc} / ${nLe} / ${nPop}`,
  "countries with income, life-expectancy and population rows respectively", nInc > 150 && nLe > 150 && nPop > 150);

const incYears = Object.values(inc).reduce((a, m) => {
  Object.keys(m).forEach(y => { a.min = Math.min(a.min, +y); a.max = Math.max(a.max, +y); });
  return a;
}, { min: 9e9, max: -9e9 });
check("income series span", `${incYears.min}–${incYears.max}`,
  "the long series stops before the present; the page says so rather than extrapolating", incYears.max <= 2020);

const lifeYears = Object.values(life).reduce((a, m) => {
  Object.keys(m).forEach(y => { a.min = Math.min(a.min, +y); a.max = Math.max(a.max, +y); });
  return a;
}, { min: 9e9, max: -9e9 });
check("life-expectancy span", `${lifeYears.min}–${lifeYears.max}`,
  "Gapminder's long trend, not the IHME file in Systema Globalis that ends in 2013", lifeYears.min <= 1800);

const popDelta = worldPopOwid ? (sumPopLast / worldPopOwid - 1) : null;
check("population reconciles", popDelta === null ? "n/a" : (popDelta * 100).toFixed(1) + "%",
  `sum of ${popLast.filter(v => v != null).length} countries ÷ OWID world row for ${END} (${worldPopOwid ? worldPopOwid.toLocaleString("en-US") : "n/a"})`,
  popDelta === null || Math.abs(popDelta) < 0.02);

check(`world life expectancy, ${END}`, meanLeLast === null ? "n/a" : meanLeLast.toFixed(1) + " y",
  "population-weighted mean of the country rows; UN WPP puts the world at 72.6 in 2019",
  meanLeLast !== null && Math.abs(meanLeLast - 72.6) < 1.5);

check(`median vs mean income, ${END}`,
  medIncLast === null ? "n/a" : `$${Math.round(medIncLast).toLocaleString("en-US")} vs $${Math.round(meanIncLast).toLocaleString("en-US")}`,
  "the median country earns less than the population-weighted mean; that gap is the page's subject",
  medIncLast !== null && medIncLast < meanIncLast);

const inc1800 = col(seriesInc, i1800).filter(v => v != null).length;
check("countries with income in 1800", String(inc1800),
  "the panel is thin at the start, which is why the first frames are sparse", inc1800 > 20);

const allThree2000 = countries.filter((c, k) =>
  seriesInc[k][i2000] != null && seriesLe[k][i2000] != null && seriesPop[k][i2000] != null).length;
check("all three indicators in 2000", `${allThree2000} of ${countries.length}`,
  "the working set for the animation's midpoint", allThree2000 > 150);

const negatives = [seriesInc, seriesLe, seriesPop].some(s =>
  s.some(arr => arr.some(v => v != null && v < 0)));
check("no negative values", negatives ? "found" : "none", "a negative population or price is a parse error", !negatives);

const noRegion = countries.filter(c => c.region === 4).length;
check("region assigned", `${countries.length - noRegion} of ${countries.length}`,
  "Gapminder's four regions; unassigned countries render grey, not dropped", noRegion <= countries.length * 0.1);

check("income vs life expectancy", rankCorr === null ? "n/a" : rankCorr.toFixed(2),
  "rank correlation, 2019 — the relationship the bubble chart shows", rankCorr !== null && rankCorr > 0.5);

/* ----------------------------------------------------------------- output */

const sources = [
  {
    id: "income",
    name: "Income per person, long series",
    provider: "Gapminder / Systema Globalis (built on Maddison and World Bank)",
    url: SOURCE_URL.income,
    coverage: `1800–${incYears.max}, ${nInc} geographies`,
    note: "1990 international dollars, log scale. Stops before the present by design — the long series is a historical reconstruction, not a nowcast."
  },
  {
    id: "life",
    name: "Life expectancy at birth",
    provider: "Gapminder / life_expectancy",
    url: SOURCE_URL.life,
    coverage: `1800–2100, ${nLe} geographies`,
    note: "Historic trend joined to recent releases. The projections past 2023 are not used on this page."
  },
  {
    id: "pop",
    name: "Population by country",
    provider: "UN WPP 2024 + HYDE, via Our World in Data",
    url: SOURCE_URL.pop,
    coverage: `${START}–${END} used, ${nPop} codes available`,
    note: "Bubble area and every weighting on the page. The world row is used only as a reconciliation target."
  },
  {
    id: "entities",
    name: "Country entities, regions and income groups",
    provider: "Gapminder / Systema Globalis",
    url: SOURCE_URL.entities,
    coverage: "current borders, 4 regions",
    note: "Names, ISO3, world_4region. The licence field in the DDF datapackage is empty, so attribution is carried here."
  }
];

const payload = {
  generated: STAMP,
  licence: "CC BY 4.0 — Gapminder (Systema Globalis, life_expectancy) and Our World in Data (UN WPP/HYDE). Attribution required; carry both.",
  range: [START, END],
  years: YEARS,
  regions: ["Africa", "Americas", "Asia", "Europe", "Unassigned"],
  countries,
  pop: seriesPop,
  inc: seriesInc,
  le: seriesLe,
  world: {
    population: YEARS.map((_, i) => {
      const s = col(seriesPop, i).reduce((a, v) => a + (v || 0), 0);
      return s || null;
    }),
    lifeExp: YEARS.map((_, i) => weightedMean(col(seriesLe, i), col(seriesPop, i))),
    meanIncome: YEARS.map((_, i) => weightedMean(col(seriesInc, i), col(seriesPop, i))),
    medianIncome: YEARS.map((_, i) => medianOf(col(seriesInc, i)))
  },
  summary: {
    year: END,
    population: sumPopLast,
    lifeExpectancy: meanLeLast,
    medianIncome: medIncLast,
    meanIncome: meanIncLast,
    incomeLifeRank: rankCorr
  },
  sources,
  checks
};

const js =
  "/* Generated by ingest-gapminder.mjs on " + STAMP + ". Do not edit by hand.\n" +
  "   Country panel for world.html: population, income per person and life expectancy,\n" +
  "   " + START + "-" + END + " in " + YEARS.length + " frames, " + countries.length + " countries.\n" +
  "   " + payload.licence.split(" — ")[0] + ".\n" +
  "   Regenerate with: node ingest-gapminder.mjs                                     */\n" +
  "window.GAP = " + JSON.stringify(payload) + ";\n";

console.log("\nchecks");
for (const c of checks) {
  console.log(`  [${c.status === "ok" ? "ok  " : "FLAG"}] ${c.label}: ${c.value}`);
}

if (DRY) {
  console.log("\n--dry: gapminder-data.js not written");
} else {
  fs.writeFileSync("gapminder-data.js", js);
  console.log(`\nwrote gapminder-data.js (${(js.length / 1024).toFixed(1)} kB)`);
}
