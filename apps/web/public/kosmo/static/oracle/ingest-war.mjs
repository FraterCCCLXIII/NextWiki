#!/usr/bin/env node
/*
 * ingest-war.mjs — the conflict panel behind `war.html`.
 *
 *   node ingest-war.mjs          # fetch, derive, check, write war-data.js
 *   node ingest-war.mjs --dry    # fetch, derive, check, write nothing
 *
 * Sources (all keyless)
 *   UCDP/PRIO Armed Conflict 26.1      active conflicts by year, type, intensity, 1946-2024
 *   UCDP Battle-Related Deaths 26.1    battle deaths by conflict-year, low/best/high, 1989-2024
 *   UCDP One-Sided Violence 26.1       civilians killed by one actor, low/best/high, 1989-2024
 *   UNHCR population API               refugees, asylum-seekers, IDPs, 1951-2024
 *   World Bank                         military expenditure, population, GDP per capita
 *
 * The spans do not agree and that is the first thing the page has to say. UCDP's
 * conflict register reaches back to 1946; its death estimates start in 1989,
 * because before that the counts are reconstructions rather than records. Any
 * chart that draws deaths from 1946 is drawing something that does not exist.
 *
 * Three of these arrive as zip archives and the project has no dependencies, so
 * `unzip()` reads the central directory and inflates entries with node:zlib.
 */

import fs from "node:fs";
import zlib from "node:zlib";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ fetch */

async function get(url, binary) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+war panel)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip archive");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nl = buf.readUInt16LE(off + 28);
    const el = buf.readUInt16LE(off + 30);
    const cl = buf.readUInt16LE(off + 32);
    const lo = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nl).toString("utf8");
    const lnl = buf.readUInt16LE(lo + 26);
    const lel = buf.readUInt16LE(lo + 28);
    const start = lo + 30 + lnl + lel;
    const raw = buf.slice(start, start + csize);
    out[name] = method === 0 ? raw : zlib.inflateRawSync(raw);
    off += 46 + nl + el + cl;
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toObjects(text) {
  const rows = parseCsv(text);
  const head = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length > 1).map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = (r[i] === undefined ? "" : r[i]).trim(); });
    return o;
  });
}

function firstCsv(zipBuf) {
  const files = unzip(zipBuf);
  const name = Object.keys(files).find(n => /\.csv$/i.test(n));
  return toObjects(files[name].toString("utf8"));
}

/* --------------------------------------------------------------- constants */

const TYPE_NAME = ["Extrasystemic", "Interstate", "Intrastate", "Internationalised"];
const DEATH_Y0 = 1989;

/* UCDP names countries in prose and sometimes several at once ("India, Pakistan").
   Most resolve through the World Bank list; the rest are here. */
const ALIAS = {
  "United States of America": "USA", "United States": "USA", "Soviet Union": "RUS",
  "Russia (Soviet Union)": "RUS", "Russia": "RUS", "USSR": "RUS",
  "DR Congo (Zaire)": "COD", "Democratic Republic of the Congo": "COD", "Zaire": "COD",
  "Congo, Dem. Rep.": "COD", "Republic of the Congo": "COG", "Congo": "COG",
  "Cambodia (Kampuchea)": "KHM", "Kampuchea": "KHM", "Yemen (North Yemen)": "YEM",
  "Yemen (South Yemen)": "YEM", "South Yemen": "YEM", "North Yemen": "YEM",
  "Korea, Rep.": "KOR", "South Korea": "KOR", "Korea, Dem. People's Rep.": "PRK",
  "North Korea": "PRK", "Iran": "IRN", "Iran, Islamic Rep.": "IRN",
  "Syria": "SYR", "Syrian Arab Republic": "SYR", "Vietnam": "VNM", "Viet Nam": "VNM",
  "Egypt": "EGY", "Egypt, Arab Rep.": "EGY", "Turkey": "TUR", "Türkiye": "TUR",
  "Ivory Coast": "CIV", "Cote d'Ivoire": "CIV", "Côte d'Ivoire": "CIV",
  "Venezuela": "VEN", "Venezuela, RB": "VEN", "Bolivia": "BOL",
  "Tanzania": "TZA", "United Republic of Tanzania": "TZA",
  "Moldova": "MDA", "Moldova, Rep.": "MDA", "Macedonia": "MKD",
  "North Macedonia": "MKD", "Bosnia-Herzegovina": "BIH", "Bosnia and Herzegovina": "BIH",
  "Serbia (Yugoslavia)": "SRB", "Yugoslavia": "SRB", "Yugoslavia (Serbia)": "SRB",
  "Czechoslovakia": "CZE", "Czech Republic": "CZE", "Czechia": "CZE",
  "Myanmar (Burma)": "MMR", "Myanmar": "MMR", "Burma": "MMR",
  "Swaziland": "SWZ", "eSwatini": "SWZ", "Cape Verde": "CPV", "Cabo Verde": "CPV",
  "Micronesia": "FSM", "Micronesia, Fed. Sts.": "FSM", "East Timor": "TLS",
  "Timor-Leste": "TLS", "Kosovo": "XKX", "Taiwan": "TWN",
  "West Germany": "DEU", "East Germany": "DEU", "Germany": "DEU",
  "United Kingdom": "GBR", "Laos": "LAO", "Brunei": "BRN",
  "Congo, Rep.": "COG", "Gambia": "GMB", "Gambia, The": "GMB",
  "Bahamas": "BHS", "Bahamas, The": "BHS", "St. Lucia": "LCA", "Saint Lucia": "LCA",
  "Somalia": "SOM", "Somalia, Fed. Rep.": "SOM", "Kyrgyzstan": "KGZ",
  "Kyrgyz Republic": "KGZ", "Zimbabwe (Rhodesia)": "ZWE", "Rhodesia": "ZWE",
  "Kingdom of eSwatini (Swaziland)": "SWZ", "Madagascar (Malagasy)": "MDG"
};

/* ------------------------------------------------------------------- load */

console.log("fetching 8 resources…");
const [acdZip, brdZip, osZip, unhcrZip, wbCountry, wbMilex, wbGdppc, wbPop] = await Promise.all([
  get("https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-261-csv.zip", true),
  get("https://ucdp.uu.se/downloads/brd/ucdp-brd-conf-261-csv.zip", true),
  get("https://ucdp.uu.se/downloads/nsos/ucdp-onesided-261-csv.zip", true),
  get("https://api.unhcr.org/population/v1/population/?limit=100000&yearFrom=1951&yearTo=2024&coo_all=true&coa_all=true&download=false", true),
  get("https://api.worldbank.org/v2/country?format=json&per_page=400"),
  get("https://api.worldbank.org/v2/country/all/indicator/MS.MIL.XPND.CD?format=json&per_page=20000&date=1960:2024"),
  get("https://api.worldbank.org/v2/country/all/indicator/NY.GDP.PCAP.CD?format=json&per_page=20000&date=1990:2024"),
  get("https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=20000&date=1990:2024")
]);

const acd = firstCsv(acdZip);
const brd = firstCsv(brdZip);
const onesided = firstCsv(osZip);
const unhcr = firstCsv(unhcrZip);

/* The World Bank country endpoint keys ISO3 on `id`, not `iso3Code` — using the
   wrong one silently failed 20% of the UCDP names. */
const wbNames = {};
const realCountries = new Set();
const wbCountries = JSON.parse(wbCountry)[1] || [];
wbCountries.forEach(c => {
  const iso = c.id;
  if (!iso || iso.length !== 3) return;
  wbNames[(c.name || "").trim()] = iso;
  if (c.region && c.region.id !== "NA") realCountries.add(iso);
});

console.log(`  conflicts ${acd.length} rows · battle deaths ${brd.length} · one-sided ${onesided.length} · UNHCR ${unhcr.length}`);

/* --------------------------------------------------------------- mapping */

/* UCDP lists every country a row's violence touched: "Burundi, DR Congo
   (Zaire), Rwanda" is one row covering three. Taking the first would have
   attributed Rwanda's 1994 massacre to Burundi, so each row is split across all
   the countries it names and the deaths are divided between them. */
function isosOf(location) {
  const parts = String(location || "").split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    const iso = ALIAS[p] || wbNames[p];
    if (iso && out.indexOf(iso) === -1) out.push(iso);
  });
  return out;
}

const unmapped = new Set();
brd.concat(onesided).forEach(r => {
  const loc = r.location_inc !== undefined ? r.location_inc : r.location;
  if (!isosOf(loc).length) unmapped.add(loc);
});

/* ------------------------------------------------------------------ years */

const Y0 = 1946, Y1 = 2024;
const YEARS = [];
for (let y = Y0; y <= Y1; y++) YEARS.push(y);
const idx = new Map(YEARS.map((y, i) => [y, i]));

/* ------------------------------------------------------- UCDP: conflicts */

const active = {
  total: YEARS.map(() => 0),
  war: YEARS.map(() => 0),
  minor: YEARS.map(() => 0),
  byType: TYPE_NAME.map(() => YEARS.map(() => 0))
};
const seen = new Set();
acd.forEach(r => {
  const y = +r.year, i = idx.get(y);
  if (i === undefined) return;
  const key = r.conflict_id + ":" + y;
  if (seen.has(key)) return;
  seen.add(key);
  active.total[i] += 1;
  if (+r.intensity_level === 2) active.war[i] += 1; else active.minor[i] += 1;
  const t = +r.type_of_conflict - 1;
  if (t >= 0 && t < 4) active.byType[t][i] += 1;
});

/* -------------------------------------------------- UCDP: battle deaths */

const deaths = {
  best: YEARS.map(y => (y < DEATH_Y0 ? null : 0)),
  low: YEARS.map(y => (y < DEATH_Y0 ? null : 0)),
  high: YEARS.map(y => (y < DEATH_Y0 ? null : 0))
};
const byType = TYPE_NAME.map(() => YEARS.map(y => (y < DEATH_Y0 ? null : 0)));
const countryYear = {};                     /* iso -> { year: battle deaths } */

brd.forEach(r => {
  const y = +r.year, i = idx.get(y);
  if (i === undefined || deaths.best[i] === null) return;
  const bd = +r.bd_best || 0;
  deaths.best[i] += bd;
  deaths.low[i] += +r.bd_low || 0;
  deaths.high[i] += +r.bd_high || 0;
  const t = +r.type_of_conflict - 1;
  if (t >= 0 && t < 4) byType[t][i] += bd;

  const isos = isosOf(r.location_inc);
  if (!isos.length) return;
  const share = bd / isos.length;
  isos.forEach(iso => {
    (countryYear[iso] || (countryYear[iso] = {}))[y] = ((countryYear[iso] || {})[y] || 0) + share;
  });
});

/* -------------------------------------------- UCDP: one-sided violence */

const oneSided = {
  best: YEARS.map(y => (y < DEATH_Y0 ? null : 0)),
  low: YEARS.map(y => (y < DEATH_Y0 ? null : 0)),
  high: YEARS.map(y => (y < DEATH_Y0 ? null : 0))
};
const oneSidedByCountry = {};

onesided.forEach(r => {
  const y = +r.year, i = idx.get(y);
  if (i === undefined || oneSided.best[i] === null) return;
  oneSided.best[i] += +r.best_fatality_estimate || 0;
  oneSided.low[i] += +r.low_fatality_estimate || 0;
  oneSided.high[i] += +r.high_fatality_estimate || 0;
  const isos = isosOf(r.location);
  if (!isos.length) return;
  const share = (+r.best_fatality_estimate || 0) / isos.length;
  isos.forEach(iso => {
    (oneSidedByCountry[iso] || (oneSidedByCountry[iso] = {}))[y] =
      ((oneSidedByCountry[iso] || {})[y] || 0) + share;
  });
});

/* ---------------------------------------------------------------- UNHCR */

function num(v) { const n = +String(v).replace(/,/g, ""); return isFinite(n) ? n : 0; }

const disp = {};
unhcr.forEach(r => {
  const y = +r.Year;
  if (!y) return;
  const d = disp[y] || (disp[y] = { refugees: 0, asylum: 0, idps: 0, stateless: 0 });
  d.refugees += num(r["Refugees under UNHCR's mandate"]);
  d.asylum += num(r["Asylum-seekers"]);
  d.idps += num(r["IDPs of concern to UNHCR"]);
  d.stateless += num(r["Stateless persons"]);
});
const dispYears = Object.keys(disp).map(Number).sort((a, b) => a - b);
const displaced = {
  years: dispYears,
  refugees: dispYears.map(y => disp[y].refugees),
  asylum: dispYears.map(y => disp[y].asylum),
  idps: dispYears.map(y => disp[y].idps),
  stateless: dispYears.map(y => disp[y].stateless)
};

/* ------------------------------------------------------------- World Bank */

function parseWb(text, scale) {
  const rows = JSON.parse(text)[1] || [];
  const out = {};
  rows.forEach(r => {
    if (r.value == null || !r.countryiso3code) return;
    if (!realCountries.has(r.countryiso3code)) return;   /* drops WLD, EUU, ARB… */
    (out[r.countryiso3code] || (out[r.countryiso3code] = {}))[+r.date] = r.value * (scale || 1);
  });
  return out;
}

const milex = parseWb(wbMilex, 1e-9);          /* current US$ → billions */
const gdppc = parseWb(wbGdppc, 1);
const pop = parseWb(wbPop, 1);

const milexYears = [];
for (let y = 1960; y <= 2024; y++) milexYears.push(y);
const milexWorld = milexYears.map(y => {
  let s = 0;
  Object.values(milex).forEach(m => { if (m[y]) s += m[y]; });
  return s || null;
});

const SCATTER_YEARS = [1990, 1995, 2000, 2005, 2010, 2015, 2019, 2023];
const scatter = SCATTER_YEARS.map(y => {
  const rows = [];
  Object.keys(gdppc).forEach(iso => {
    const inc = gdppc[iso][y], p = pop[iso] && pop[iso][y];
    if (!inc || !p) return;
    const d = (countryYear[iso] && countryYear[iso][y]) || 0;
    rows.push([iso, Math.round(d), Math.round(d / p * 1e6) / 10, Math.round(inc)]);
  });
  return { year: y, rows };
});

/* ----------------------------------------------------------------- checks */

const checks = [];
function check(label, value, detail, ok) { checks.push({ label, value, detail, status: ok ? "ok" : "flag" }); }

const mapped = brd.concat(onesided).filter(r => isosOf(r.location_inc !== undefined ? r.location_inc : r.location).length).length;
const total = brd.length + onesided.length;
check("country mapping", (mapped / total * 100).toFixed(1) + "%",
  `${mapped} of ${total} UCDP rows resolve to an ISO3`, mapped / total > 0.97);

check("conflict register", `${Y0}–${Y1}`,
  "UCDP/PRIO ACD 26.1, one row per conflict-year", active.total[idx.get(Y1)] > 0);

check("death estimates start", String(DEATH_Y0),
  "UCDP only publishes battle-death estimates from 1989; earlier counts are reconstructions, so the chart starts there rather than extending the line backwards",
  deaths.best[0] === null && deaths.best[idx.get(DEATH_Y0)] !== null);

const peak = Math.max.apply(null, deaths.best.filter(v => v !== null));
const peakYear = YEARS[deaths.best.indexOf(peak)];
check("deadliest battle-death year", `${peakYear} · ${peak.toLocaleString("en-US")}`,
  "highest annual total of fighting deaths in the 1989–2024 window. Not the deadliest year overall — see the next check",
  peakYear >= 2020);

/* The single most useful number on the page, and the one the battle-death series
   alone gets wrong: add one-sided violence and 1994 stops looking like a footnote
   to the 2020s. If a future release reverses this, the page's thesis is wrong. */
let peakAll = { y: null, v: -1 };
for (let i = 0; i < YEARS.length; i++) {
  if (deaths.best[i] === null) continue;
  const t = (deaths.best[i] || 0) + (oneSided.best[i] || 0);
  if (t > peakAll.v) peakAll = { y: YEARS[i], v: t };
}
check("deadliest year, all UCDP deaths", `${peakAll.y} · ${Math.round(peakAll.v).toLocaleString("en-US")}`,
  "battle deaths plus one-sided violence. The peak is 1994, not the 2020s: the record-high battle-death framing only holds if civilian massacre is left out",
  peakAll.y === 1994);

/* UCDP records the Rwandan civil war's battle toll as 1,882 — the killing was
   overwhelmingly one-sided. If a future release changes that, the page's central
   argument about what the battle series leaves out stops holding. */
const rw94 = Math.round((countryYear.RWA && countryYear.RWA[1994]) || 0);
check("Rwanda 1994, battle deaths", rw94.toLocaleString("en-US"),
  "the civil war's fighting only. This is the number a battle-death chart shows for the genocide, and it is why the page plots one-sided violence beside it",
  rw94 < 5000);

/* UCDP lists one row naming several countries for the 1994 killings, so the
   ingest splits that row evenly. The per-country figure is an attribution, not a
   separate measurement — the page says so rather than pretending to precision. */
const rw94os = Math.round((oneSidedByCountry.RWA && oneSidedByCountry.RWA[1994]) || 0);
check("Rwanda 1994, one-sided", rw94os.toLocaleString("en-US"),
  "civilians killed by an organised actor, split across the three countries UCDP lists in that row; the published estimate is 500k–800k",
  rw94os > 200000);

const boundsOk = deaths.best.every((v, i) => v === null || (v >= deaths.low[i] && v <= deaths.high[i]));
check("bounds nest", boundsOk ? "yes" : "no",
  "every best estimate sits between its published low and high", boundsOk);

const y23 = idx.get(2023);
check("conflicts in 2023", String(active.total[y23]),
  `${active.war[y23]} at war intensity (1,000+ deaths), ${active.minor[y23]} minor — the highest count in the register`,
  active.war[y23] > 8);

const ref23 = displaced.refugees[displaced.years.indexOf(2023)] || 0;
check("refugees, 2023", (ref23 / 1e6).toFixed(1) + "m",
  "UNHCR mandate only. UNRWA's 6m Palestinian refugees and IDMC's wider IDP count are excluded, which is why this is lower than the headline figure",
  ref23 / 1e6 > 28 && ref23 / 1e6 < 35);

const idp23 = displaced.idps[displaced.years.indexOf(2023)] || 0;
check("IDPs of concern, 2023", (idp23 / 1e6).toFixed(1) + "m", "UNHCR's own caseload", idp23 > 50e6);

const m23 = milexWorld[milexYears.indexOf(2023)] || 0;
check("military spending, 2023", "$" + Math.round(m23) + "bn",
  "sum of World Bank country rows, current US$; SIPRI's own world figure is $2,443bn",
  Math.abs(m23 - 2443) < 500);

check("scatter years complete", SCATTER_YEARS.join(", "),
  "each year needs GDP per capita, population and a death count per country",
  scatter.every(s => s.rows.length > 120));

if (unmapped.size) {
  check("unmapped names", String(unmapped.size), [...unmapped].slice(0, 5).join(" · "), unmapped.size === 0);
}

/* ----------------------------------------------------------------- output */

const sources = [
  {
    id: "acd", name: "Armed conflicts",
    provider: "UCDP/PRIO Armed Conflict Dataset 26.1, Uppsala University",
    url: "https://ucdp.uu.se/downloads/",
    coverage: `${Y0}–${Y1}, conflict-year, with type and intensity`,
    note: "A conflict enters at 25 battle deaths in a year. Intensity 2 (1,000+ deaths) is labelled war. This is the only series here that reaches back to 1946."
  },
  {
    id: "brd", name: "Battle-related deaths",
    provider: "UCDP Battle-Related Deaths Dataset 26.1",
    url: "https://ucdp.uu.se/downloads/",
    coverage: `${DEATH_Y0}–${Y1}, conflict-year, low/best/high`,
    note: "Deaths from fighting between organised armed groups. Excludes one-sided violence against civilians and every indirect death — famine, disease, destroyed hospitals — which in most wars are the larger number. Summing conflict-level estimates can double count when one war is registered as several conflicts."
  },
  {
    id: "os", name: "One-sided violence",
    provider: "UCDP One-Sided Violence Dataset 26.1",
    url: "https://ucdp.uu.se/downloads/",
    coverage: `${DEATH_Y0}–${Y1}, actor-year, low/best/high`,
    note: "Civilians deliberately killed by a government or non-state actor. This is where genocide and massacre counts sit, and why a chart of 'battle deaths' alone makes the 1990s look less lethal than they were."
  },
  {
    id: "unhcr", name: "Forced displacement",
    provider: "UNHCR Refugee Data Finder, population API",
    url: "https://api.unhcr.org/population/v1/population/",
    coverage: "1951–2024, origin × asylum",
    note: "Refugees under UNHCR's mandate, asylum-seekers, IDPs of concern to UNHCR, stateless persons. UNRWA and IDMC are separate systems."
  },
  {
    id: "milex", name: "Military expenditure",
    provider: "World Bank (SIPRI as source), MS.MIL.XPND.CD",
    url: "https://data.worldbank.org/indicator/MS.MIL.XPND.CD",
    coverage: "1960–2024, by country, current US$",
    note: "Current dollars, so the series mixes inflation with arsenal growth and is not a real-terms trend."
  },
  {
    id: "income", name: "GDP per capita and population",
    provider: "World Bank, NY.GDP.PCAP.CD and SP.POP.TOTL",
    url: "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
    coverage: "1990–2024, by country, current US$",
    note: "Used only to place countries on the war-versus-income chart, and to turn death counts into rates."
  }
];

const payload = {
  generated: STAMP,
  range: [Y0, Y1],
  deathRange: [DEATH_Y0, Y1],
  years: YEARS,
  deaths,
  oneSided,
  byType,
  byTypeNames: TYPE_NAME,
  active: { total: active.total, war: active.war, minor: active.minor, byType: active.byType },
  countryYear,
  oneSidedByCountry,
  displaced,
  milex: { years: milexYears, world: milexWorld },
  scatter,
  scatterYears: SCATTER_YEARS,
  sources,
  checks
};

const js =
  "/* Generated by ingest-war.mjs on " + STAMP + ". Do not edit by hand.\n" +
  "   Conflict panel for war.html: UCDP conflicts " + Y0 + "-" + Y1 + ", battle deaths and\n" +
  "   one-sided violence " + DEATH_Y0 + "-" + Y1 + ", UNHCR displacement, World Bank spending.\n" +
  "   Regenerate with: node ingest-war.mjs                                          */\n" +
  "window.WAR = " + JSON.stringify(payload) + ";\n";

console.log("\nchecks");
for (const c of checks) console.log(`  [${c.status === "ok" ? "ok  " : "FLAG"}] ${c.label}: ${c.value}`);
if (unmapped.size) console.log("  unmapped:", [...unmapped].join(" | "));

if (DRY) console.log("\n--dry: war-data.js not written");
else {
  fs.writeFileSync("war-data.js", js);
  console.log(`\nwrote war-data.js (${(js.length / 1024).toFixed(1)} kB)`);
}
