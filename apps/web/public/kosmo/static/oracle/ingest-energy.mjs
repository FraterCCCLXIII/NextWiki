#!/usr/bin/env node
/*
 * ingest-energy.mjs — the measured history behind `fuels.html`.
 *
 * Fetches public data and writes `fuels-data.js`. No dependencies, no API keys.
 *
 *   node ingest-energy.mjs          # fetch, derive, write fuels-data.js
 *   node ingest-energy.mjs --dry    # fetch, derive, check, write nothing
 *
 * Sources (all keyless)
 *   Our World in Data / Energy Institute   primary energy by source, World, 1800–2025
 *   Our World in Data / UN WPP             population, historical and medium projection
 *   Our World in Data / HadCRUT + NASA     global mean temperature anomaly, with band
 *   Our World in Data / Global Carbon Project  annual CO2 emissions
 *   NOAA GML                               Mauna Loa annual mean CO2, global mean CH4
 *   Our World in Data / Church & White     sea level, quarterly
 *   Our World in Data / NASA JPL GRACE     ice sheet mass balance, Antarctica and Greenland
 *   Our World in Data / Maddison Project   GDP per capita
 *   Our World in Data / UN, FAO            life expectancy, dietary energy supply
 *
 * One table is not fetched: atmospheric CO2 before 1959 comes from Antarctic ice cores,
 * which have no annual API. Those anchors are written out below with their study, and
 * they are the only hardcoded climate numbers in the file.
 *
 * The interesting output is not the data — it is `checks`. Two independent datasets
 * (energy consumption and CO2 emissions) are reconciled against each other, and the
 * carbon-cycle model is asked to reconstruct the observed CO2 record from emissions
 * alone. If either fails, the forward model is wrong and the page should not be trusted.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ fetch */

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* OWID serves long-format CSVs: entity,code,year,<columns>. Every dataset here is
   World, so we filter to one entity and collect the rest column-wise. */
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function owid(text, entity = "World") {
  const rows = parseCSV(text).filter((r) => r.length > 2 && r[0] !== "entity");
  const head = parseCSV(text)[0];
  const out = new Map();
  for (const r of rows) {
    if (r[0] !== entity) continue;
    const year = Number(r[2]);
    if (!isFinite(year)) continue;
    const rec = out.get(year) || {};
    for (let i = 3; i < head.length; i++) {
      const v = r[i] === undefined || r[i] === "" ? null : Number(r[i]);
      rec[head[i]] = v !== null && isFinite(v) ? v : null;
    }
    out.set(year, rec);
  }
  return out;
}

/* NOAA files are '#'-commented with a bare CSV body. */
function noaa(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    rows.push(line.split(",").map((s) => s.trim()));
  }
  return rows;
}

const NUM = (s) => { const v = Number(s); return isFinite(v) ? v : null; };

/* --------------------------------------------------------------- constants */

const TWH_TO_EJ = 0.0036;                 // 1 TWh = 3.6 PJ
const PPM_PER_GTCO2 = 1 / 7.821;          // 1 ppm CO2 = 7.821 GtCO2 = 2.124 GtC

/* IPCC AR5/AR6 default emission factors, kg CO2 per GJ of primary energy. */
const EF = { coal: 94.6, oil: 73.3, gas: 56.1 };

/* Ultimately recoverable resources, EJ. These bound the forward model: it is the
   mechanism by which fossil fuel use falls even with no climate policy at all.
   Coal  ~1.1 Tt proven x 25 GJ/t       = 27,000 EJ
   Oil   ~1.7 Tb proven + unconventional = 12,000 EJ
   Gas   ~200 tcm conventional + tight   = 12,000 EJ                                     */
const URR = { coal: 27000, oil: 12000, gas: 12000 };

/* Ice-core atmospheric CO2, ppm. Sources per row. No annual API exists for these;
   they anchor 1800–1958 and are linearly interpolated onto annual steps. */
const ICE_CORE = [
  [1750, 277, "EPICA Dome C / Law Dome, pre-industrial"],
  [1800, 283, "Law Dome DE08, Etheridge et al. 1996"],
  [1825, 284, "Law Dome"],
  [1850, 285, "Law Dome"],
  [1875, 289, "Law Dome / Siple"],
  [1900, 296, "Law Dome"],
  [1925, 303, "Law Dome / Antarctic composite"],
  [1950, 311, "Law Dome"],
  [1958, 315, "Keeling, Mauna Loa first year"]
];

/* ---------------------------------------------------------------- fetching */

console.log("fetching primary energy by source (OWID / Energy Institute)…");
const energyRaw = await get(
  "https://ourworldindata.org/grapher/global-primary-energy.csv?v=1&csvType=full&useColumnShortNames=true"
);
const energy = owid(energyRaw);

console.log("fetching population, historical and projected (OWID / UN WPP)…");
const popHistRaw = await get(
  "https://ourworldindata.org/grapher/population.csv?v=1&csvType=full&useColumnShortNames=true"
);
const popProjRaw = await get(
  "https://ourworldindata.org/grapher/population-with-un-projections.csv?v=1&csvType=full&useColumnShortNames=true"
);

console.log("fetching temperature anomaly (OWID / HadCRUT + NASA GISS)…");
const tempRaw = await get(
  "https://ourworldindata.org/grapher/temperature-anomaly.csv?v=1&csvType=full&useColumnShortNames=true"
);

console.log("fetching annual CO2 emissions (OWID / Global Carbon Project)…");
const co2Raw = await get(
  "https://ourworldindata.org/grapher/annual-co2-emissions.csv?v=1&csvType=full&useColumnShortNames=true"
);

console.log("fetching Mauna Loa CO2 and global CH4 (NOAA GML)…");
const mloRaw = await get("https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv");
const ch4Raw = await get("https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_annmean_gl.csv");

console.log("fetching sea level (OWID / Church & White, UHSLC)…");
const slrRaw = await get(
  "https://ourworldindata.org/grapher/sea-level-rise.csv?v=1&csvType=full&useColumnShortNames=true"
);

console.log("fetching ice sheet mass balance (OWID / NASA JPL GRACE)…");
const iceRaw = await get(
  "https://ourworldindata.org/grapher/ice-sheet-mass-balance.csv?v=1&csvType=full&useColumnShortNames=true"
);

console.log("fetching GDP per capita, life expectancy, food supply…");
const gdpRaw = await get(
  "https://ourworldindata.org/grapher/gdp-per-capita-maddison.csv?v=1&csvType=full&useColumnShortNames=true"
);
const lifeRaw = await get(
  "https://ourworldindata.org/grapher/life-expectancy.csv?v=1&csvType=full&useColumnShortNames=true"
);
const calRaw = await get(
  "https://ourworldindata.org/grapher/daily-per-capita-caloric-supply.csv?v=1&csvType=full&useColumnShortNames=true"
);

const popHist = owid(popHistRaw);
const popProj = owid(popProjRaw);
const temp = owid(tempRaw);
const co2 = owid(co2Raw);
const gdp = owid(gdpRaw);
const life = owid(lifeRaw);
const cal = owid(calRaw);

/* Sea level is quarterly, and the period column is a string like "1880-Q2", so the
   generic OWID reader cannot use it. Average to years and convert mm -> m relative
   to the published 1993–2012 baseline. */
const slrRows = parseCSV(slrRaw).filter((r) => r[0] === "World" && r[2] !== "quarter");
const slrMap = new Map();
{
  const head = parseCSV(slrRaw)[0];
  const iAvg = head.indexOf("sea_level_average");
  const iCW = head.indexOf("sea_level_church_and_white_2011");
  for (const r of slrRows) {
    const m = /^(\d{4})/.exec(r[2] || "");
    if (!m) continue;
    const y = Number(m[1]);
    const v = (iAvg >= 0 ? NUM(r[iAvg]) : null) ?? (iCW >= 0 ? NUM(r[iCW]) : null);
    if (v === null) continue;
    const acc = slrMap.get(y) || { sum: 0, n: 0 };
    acc.sum += v; acc.n++;
    slrMap.set(y, acc);
  }
}

/* ------------------------------------------------------------ build series */

const START = 1800;
const END = 2025;
const YEARS = [];
for (let y = START; y <= END; y++) YEARS.push(y);

/* Mauna Loa annual means, keyed by year. */
const mlo = new Map();
for (const r of noaa(mloRaw)) {
  const y = Number(r[0]);
  if (isFinite(y) && r[1] !== undefined) { const v = NUM(r[1]); if (v !== null) mlo.set(y, v); }
}
const ch4 = new Map();
for (const r of noaa(ch4Raw)) {
  if (r.length < 2) continue;
  const y = Number(r[0].replace(/^(\d{4}).*/, "$1"));
  const v = NUM(r[1]);
  if (isFinite(y) && v !== null) ch4.set(y, v);
}

/* Ice sheets. Monthly cumulative mass change in Gt, one row per basin, 2002–2020.
   Keep the last observation of each year and flip the sign so the series reads as
   cumulative loss rather than cumulative change. Two basins share a date grid, so a
   missing basin is a genuine zero contribution rather than missing data. */
const ICE_SHEETS = ["Antarctica", "Greenland"];
const iceAnn = { Antarctica: new Map(), Greenland: new Map() };
{
  const rows = parseCSV(iceRaw);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const basin = r[0];
    if (!iceAnn[basin]) continue;
    const m = /^(\d{4})/.exec(r[2] || "");
    const v = NUM(r[3]);
    if (!m || v === null) continue;
    iceAnn[basin].set(Number(m[1]), v);
  }
}
const iceLossBy = (basin) => YEARS.map((y) => {
  const v = iceAnn[basin].get(y);
  return v == null ? null : -v;
});
const iceLossAntarctica = iceLossBy("Antarctica");
const iceLossGreenland = iceLossBy("Greenland");
const iceLoss = YEARS.map((y, i) => {
  const a = iceLossAntarctica[i], g = iceLossGreenland[i];
  if (a == null && g == null) return null;
  return (a || 0) + (g || 0);
});

/* Ice-core anchor interpolation. */
function iceCore(y) {
  if (y <= ICE_CORE[0][0]) return ICE_CORE[0][1];
  for (let i = 1; i < ICE_CORE.length; i++) {
    const [y1, v1] = ICE_CORE[i];
    const [y0, v0] = ICE_CORE[i - 1];
    if (y <= y1) return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
  }
  return ICE_CORE[ICE_CORE.length - 1][1];
}

/* OWID's energy series is decadal before 1965 and annual after. Interpolating the
   gaps is what makes a continuous chart possible, and it is honest: the underlying
   estimates are decadal, so the line between two of them is a straight line by
   construction. Nothing is extrapolated past the end of a series. */
function interp(arr) {
  const out = arr.slice();
  let last = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] != null) {
      if (last >= 0 && i - last > 1) {
        const a = out[last], b = out[i], span = i - last;
        for (let k = 1; k < span; k++) out[last + k] = a + ((b - a) * k) / span;
      }
      last = i;
    }
  }
  return out;
}

const col = (k) => interp(YEARS.map((y) => (energy.get(y) && energy.get(y)[k] != null ? energy.get(y)[k] * TWH_TO_EJ : null)));

const series = {
  coal: col("coal_twh"),
  oil: col("oil_twh"),
  gas: col("gas_twh"),
  nuclear: col("nuclear_twh"),
  hydro: col("hydro_twh"),
  wind: col("wind_twh"),
  solar: col("solar_twh"),
  biofuel: col("biofuels_twh"),
  other: col("other_renewables_twh"),
  biomass: col("traditional_biomass_twh")
};

const Z = (v) => (v == null ? 0 : v);
const total = YEARS.map((_, i) =>
  ["coal", "oil", "gas", "nuclear", "hydro", "wind", "solar", "biofuel", "other", "biomass"]
    .reduce((s, k) => s + Z(series[k][i]), 0)
);
const fossil = YEARS.map((_, i) => Z(series.coal[i]) + Z(series.oil[i]) + Z(series.gas[i]));

/* Population: HYDE/Maddison historical to 1949, then UN estimates, then the UN
   medium projection (which is what makes the post-2025 population path measured
   rather than assumed, up to 2100). */
const population = YEARS.map((y) => {
  if (popProj.has(y)) {
    const r = popProj.get(y);
    const est = r.population__sex_all__age_all__variant_estimates;
    const proj = r.population__sex_all__age_all__variant_medium__projected;
    if (est != null) return est;
    if (proj != null) return proj;
  }
  const h = popHist.get(y);
  return h && h.population_historical != null ? h.population_historical : null;
});

const popProjection = [];
for (let y = 2026; y <= 2100; y++) {
  const r = popProj.get(y);
  const v = r ? r.population__sex_all__age_all__variant_medium__projected : null;
  if (v != null) popProjection.push([y, v]);
}

const tempAnom = YEARS.map((y) => (temp.get(y) ? temp.get(y).near_surface_temperature_anomaly : null));
const tempLower = YEARS.map((y) => (temp.get(y) ? temp.get(y).near_surface_temperature_anomaly_lower : null));
const tempUpper = YEARS.map((y) => (temp.get(y) ? temp.get(y).near_surface_temperature_anomaly_upper : null));

/* GCP total CO2 (fossil + land-use change), tonnes -> GtCO2. */
const co2Total = YEARS.map((y) => {
  const r = co2.get(y);
  return r && r.emissions_total != null ? r.emissions_total / 1e9 : null;
});

/* Fossil CO2 implied by the energy series and IPCC emission factors. This is the
   independent estimate that `checks.energyVsEmissions` reconciles. */
const co2Fossil = YEARS.map((_, i) =>
  (Z(series.coal[i]) * EF.coal + Z(series.oil[i]) * EF.oil + Z(series.gas[i]) * EF.gas) / 1000
);

const gdpPc = interp(YEARS.map((y) => (gdp.get(y) && gdp.get(y).gdp_per_capita != null ? gdp.get(y).gdp_per_capita : null)));
const lifeExp = interp(YEARS.map((y) => (life.get(y) && life.get(y).life_expectancy_0 != null ? life.get(y).life_expectancy_0 : null)));
const calories = interp(YEARS.map((y) => (cal.get(y) && cal.get(y).daily_calories != null ? cal.get(y).daily_calories : null)));

/* CO2 concentration: Mauna Loa where measured, ice cores before. */
const co2Conc = YEARS.map((y) => {
  if (mlo.has(y)) return mlo.get(y);
  const v = iceCore(y);
  return v == null ? null : Math.round(v * 10) / 10;
});
const co2Source = YEARS.map((y) => (mlo.has(y) ? "Mauna Loa" : "ice core"));

const seaLevel = interp(YEARS.map((y) => {
  const a = slrMap.get(y);
  return a ? a.sum / a.n / 1000 : null; // mm -> m
}));

const ch4Series = YEARS.map((y) => (ch4.has(y) ? ch4.get(y) : null));

/* ------------------------------------------------------------- carbon cycle
   Joos et al. (2013) impulse-response, four boxes. Fraction of a CO2 pulse still
   airborne after t years. This is the standard reduced-form used by IPCC AR5 and
   it is what separates a page that models CO2 from one that models emissions and
   pretends the sky is a bucket.                                                */
const IRF = [
  { a: 0.2173, tau: Infinity },
  { a: 0.2240, tau: 394.4 },
  { a: 0.2824, tau: 36.54 },
  { a: 0.2763, tau: 4.304 }
];

/* Run emissions through the IRF. Returns concentration and the box state, which
   fuels.js continues from so the projection joins history without a seam. */
function runCarbon(emissions) {
  const boxes = [0, 0, 0, 0];
  const conc = [];
  for (let i = 0; i < emissions.length; i++) {
    const e = emissions[i] || 0;
    for (let b = 0; b < 4; b++) {
      if (IRF[b].tau === Infinity) boxes[b] += e * IRF[b].a;
      else boxes[b] = boxes[b] * Math.exp(-1 / IRF[b].tau) + e * IRF[b].a;
    }
    const air = boxes.reduce((s, v) => s + v, 0);
    conc.push(280 + air * PPM_PER_GTCO2);
  }
  return { conc, boxes };
}
const carbon = runCarbon(co2Total.map((v) => Z(v)));

let cumulative = 0;
const cumCo2 = co2Total.map((v) => { cumulative += Z(v); return cumulative; });

/* -------------------------------------------------------------------- checks */

const checks = [];
function check(label, ok, value, detail) {
  checks.push({ label, status: ok ? "pass" : "fail", value, detail });
}

/* 1. Total primary energy in the final year. Should be ~620-640 EJ on the
      direct-primary basis (EI reports ~620 EJ for 2024). */
{
  const last = total[total.length - 1];
  check("Primary energy, 2025", last > 550 && last < 720, `${last.toFixed(0)} EJ`,
    "Energy Institute reports ~620-640 EJ on a direct-primary basis.");
}

/* 2. Energy-implied fossil CO2 against the measured GCP series. Total CO2 includes
      land-use change (~3-5 GtCO2/yr), so fossil CO2 should sit below the total by
      roughly that amount. */
{
  const i = YEARS.indexOf(2024);
  const implied = co2Fossil[i], reported = co2Total[i];
  const gap = reported - implied;
  check("Fossil CO2 implied by energy vs reported", Math.abs(gap) < 3.5,
    `${implied.toFixed(1)} Gt vs ${reported.toFixed(1)} Gt`,
    `The two datasets are independent constructions of the same quantity. This series excludes land-use change, so the gap should be small and the energy route slightly high.`);
}
{
  const i = YEARS.indexOf(2021);
  if (i > 0) {
    const implied = co2Fossil[i], reported = co2Total[i];
    check("Same reconciliation, 2021", Math.abs(reported - implied) < 3.5,
      `${implied.toFixed(1)} vs ${reported.toFixed(1)} Gt`,
      "Second year, so a single bad row cannot pass this.");
  }
}

/* 3. Cumulative fossil CO2. GCP puts it near 1,700 GtCO2 for 1751-2022; this
      series carries no land-use change, so that is the figure to match. */
{
  const i = YEARS.indexOf(2024);
  check("Cumulative fossil CO2, 1800-2024", cumCo2[i] > 1650 && cumCo2[i] < 2100,
    `${cumCo2[i].toFixed(0)} GtCO2`,
    "Excludes land-use change; adding it takes the anthropogenic total to roughly 2,500 Gt.");
}

/* 4. The important one. Feed measured emissions through the carbon cycle and ask
      what concentration it produces. If the model cannot reconstruct the Keeling
      curve from emissions alone, its forward projections are worthless. */
{
  const i = YEARS.indexOf(2024);
  const modelled = carbon.conc[i], observed = co2Conc[i];
  const err = modelled - observed;
  check("Carbon cycle reconstructs observed CO2", Math.abs(err) < 25,
    `${modelled.toFixed(0)} vs ${observed.toFixed(1)} ppm`,
    `Error ${err > 0 ? "+" : ""}${err.toFixed(0)} ppm. A four-box impulse response run on emissions alone has no free parameters; ±25 ppm is about the spread between published IRFs.`);
}

/* 5. Energy per person, a sanity check on the population splice: ~75-80 GJ. */
{
  const i = YEARS.indexOf(2024);
  const ep = (total[i] * 1e18) / population[i] / 1e9;
  check("Energy per person, 2024", ep > 65 && ep < 95, `${ep.toFixed(0)} GJ`,
    "Global primary energy per capita has sat near 75-80 GJ for two decades.");
}

/* 6. Solar+wind growth, so the forward model's clean-energy ramp starts from the
      real observed rate rather than a hopeful one. */
{
  const i = YEARS.indexOf(2024);
  const g = (Z(series.solar[i]) + Z(series.wind[i])) / (Z(series.solar[i - 5]) + Z(series.wind[i - 5]));
  const cagr = Math.pow(g, 1 / 5) - 1;
  check("Solar+wind CAGR, 2019-2024", cagr > 0.08 && cagr < 0.35, `${(cagr * 100).toFixed(0)}%/yr`,
    "The ramp rate the forward model must beat to be credible.");
}

/* 7. Population splice continuity where HYDE hands over to UN. */
{
  const a = population[YEARS.indexOf(1949)], b = population[YEARS.indexOf(1950)];
  const jump = Math.abs(b / a - 1);
  check("Population splice 1949/1950", jump < 0.03, `${(jump * 100).toFixed(1)}%`,
    "Two datasets joined at the UN's 1950 start; a step here would show as a kink in the chart.");
}

/* 8. Temperature: the current decade should average near 1.3 C above 1850-1900. */
{
  let s = 0, n = 0;
  for (let y = 2015; y <= 2024; y++) { const v = tempAnom[YEARS.indexOf(y)]; if (v != null) { s += v; n++; } }
  check("Temperature anomaly, 2015-2024 mean", s / n > 1.0 && s / n < 1.6, `${(s / n).toFixed(2)} C`,
    "HadCRUT/NASA blend, relative to 1850-1900.");
}

/* 9. Ice sheets. Published estimates for 2002–2020 are ~4,900 Gt lost from Greenland
      and ~2,500 Gt from Antarctica, so ~7,000-7,500 Gt combined. */
{
  const last = iceLoss.filter((v) => v != null).pop();
  check("Ice sheet loss, 2002–2020", last > 5500 && last < 8500, `${Math.round(last)} Gt`,
    "GRACE gravimetry, both basins summed. Published: Greenland ~4,900, Antarctica ~2,500.");
}

/* 10. The same loss expressed in the unit the sea-level chart uses. 361 Gt of ice
       raises global mean sea level by about 1 mm. */
{
  const last = iceLoss.filter((v) => v != null).pop();
  const mm = last / 361;
  check("Ice loss in sea-level terms", mm > 14 && mm < 24, `${mm.toFixed(1)} mm`,
    "361 Gt ~ 1 mm of global mean sea level; the observed 2002–2020 rise is ~19 mm.");
}

const pass = checks.filter((c) => c.status === "pass").length;
console.log("\n" + "-".repeat(96));
console.log("check                                   status  value                 detail");
console.log("-".repeat(96));
for (const c of checks) {
  console.log(` ${c.label.padEnd(38)} ${c.status.padEnd(6)} ${c.value.padEnd(21)} ${c.detail.slice(0, 60)}`);
}
console.log("-".repeat(96));
console.log(`${pass}/${checks.length} checks pass`);

/* --------------------------------------------------------------------- write */

const sources = [
  { id: "energy", name: "Primary energy by source", provider: "Energy Institute Statistical Review, via Our World in Data", url: "https://ourworldindata.org/grapher/global-primary-energy.csv", coverage: "World, 1800–2025", note: "Pre-1965 from Smil and Etemad & Luciani, spliced by OWID. Renewables and nuclear on a direct-primary basis, so solar is not inflated by the substitution method." },
  { id: "population", name: "Population", provider: "HYDE, Maddison, UN WPP 2024", url: "https://ourworldindata.org/grapher/population-with-un-projections.csv", coverage: "World, to 2100 (medium variant)", note: "Measured to 2025, UN medium projection 2026–2100. The projection is the one place the future is not our invention." },
  { id: "temperature", name: "Global mean temperature anomaly", provider: "HadCRUT5 + NASA GISS, via OWID", url: "https://ourworldindata.org/grapher/temperature-anomaly.csv", coverage: "1850–2025, with uncertainty band", note: "Relative to the 1850–1900 mean." },
  { id: "co2", name: "Annual CO2 emissions", provider: "Global Carbon Project, via OWID", url: "https://ourworldindata.org/grapher/annual-co2-emissions.csv", coverage: "World, 1800–2024", note: "Fossil emissions plus land-use change." },
  { id: "mlo", name: "Atmospheric CO2", provider: "NOAA GML, Mauna Loa", url: "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.csv", coverage: "1959–2025", note: "Ice-core anchors used before 1959; see the table in this file." },
  { id: "ch4", name: "Atmospheric methane", provider: "NOAA GML, global mean", url: "https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_annmean_gl.csv", coverage: "1983–2025", note: "" },
  { id: "slr", name: "Global mean sea level", provider: "Church & White 2011, UHSLC, via OWID", url: "https://ourworldindata.org/grapher/sea-level-rise.csv", coverage: "1880–2024, quarterly", note: "Relative to the 1993–2012 mean." },
  { id: "ice", name: "Ice sheet mass balance", provider: "NASA JPL GRACE/GRACE-FO, via OWID", url: "https://ourworldindata.org/grapher/ice-sheet-mass-balance.csv", coverage: "Antarctica and Greenland, 2002–2020, monthly", note: "Cumulative mass change in Gt, sign flipped to read as loss. This is the measured counterpart to the sea-level chart's ice term." },
  { id: "gdp", name: "GDP per capita", provider: "Maddison Project 2023, via OWID", url: "https://ourworldindata.org/grapher/gdp-per-capita-maddison.csv", coverage: "World, 1820–2022", note: "1990 international dollars, log scale." },
  { id: "life", name: "Life expectancy at birth", provider: "UN WPP, via OWID", url: "https://ourworldindata.org/grapher/life-expectancy.csv", coverage: "World, 1950–2023", note: "" },
  { id: "cal", name: "Dietary energy supply", provider: "FAO, via OWID", url: "https://ourworldindata.org/grapher/daily-per-capita-caloric-supply.csv", coverage: "World, 1961–2022", note: "" }
];

const payload = {
  generated: STAMP,
  range: [START, END],
  sources,
  years: YEARS,
  history: {
    coal: series.coal, oil: series.oil, gas: series.gas, nuclear: series.nuclear,
    hydro: series.hydro, wind: series.wind, solar: series.solar,
    biofuel: series.biofuel, other: series.other, biomass: series.biomass,
    total, fossil,
    co2Fossil, co2Total, cumCo2, co2Conc, co2Source,
    tempAnom, tempLower, tempUpper,
    population, gdpPc, lifeExp, calories, seaLevel, ch4: ch4Series,
    iceLoss, iceLossAntarctica, iceLossGreenland
  },
  populationProjection: popProjection,
  carbonStart: { conc: carbon.conc[carbon.conc.length - 1], boxes: carbon.boxes },
  constants: {
    twhToEj: TWH_TO_EJ, ppmPerGtCo2: PPM_PER_GTCO2, ef: EF, urr: URR,
    irf: IRF, iceCore: ICE_CORE
  },
  checks
};

const js =
  "/* Generated by ingest-energy.mjs on " + STAMP + ". Do not edit by hand.\n" +
  "   Measured history for fuels.html: primary energy by source, emissions, atmospheric\n" +
  "   composition, temperature, population and wellbeing, 1800-2025.\n" +
  "   Regenerate with: node ingest-energy.mjs                                        */\n" +
  "window.FUELS_DATA = " + JSON.stringify(payload) + ";\n";

if (DRY) {
  console.log("\n--dry: fuels-data.js not written");
} else {
  fs.writeFileSync("fuels-data.js", js);
  console.log(`\nwrote fuels-data.js (${(js.length / 1024).toFixed(1)} kB)`);
}
