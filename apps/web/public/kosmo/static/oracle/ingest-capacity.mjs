#!/usr/bin/env node
/*
 * ingest-capacity.mjs — state capacity and legitimacy, 1996 to the latest year.
 *
 *   node ingest-capacity.mjs          # fetch, derive, check, write
 *   node ingest-capacity.mjs --dry
 *
 * The audit's largest remaining hole. Two countries can absorb the same shock
 * and only one collapses, and the difference is not in any of the models in
 * this lab: it is fiscal room, administrative reach, rule of law and the
 * legitimacy that decides whether a policy is obeyed or resisted. The World
 * Bank's Worldwide Governance Indicators are the only free, comparable,
 * annually updated measurement of that, so this page is built on them.
 *
 * What WGI is: six perceptions-based aggregates compiled from ~35 underlying
 * sources (survey firms, think tanks, NGOs, the World Bank itself). They are
 * scored in normal units with mean 0 and standard deviation 1 across the
 * sample, which is why the familiar range is roughly −2.5 to +2.5 and why a
 * score is only meaningful relative to other countries in the same year.
 *
 * What it is not: a measurement of anything that happens inside a country.
 * Perceptions by respondents, most of them foreign, weighted by an
 * undisclosed methodology. The page says so, because a number this consequential
 * deserves its caveat on screen rather than in a footnote.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const API = "https://api.worldbank.org/v2";

const IND = {
  ge: "GOV_WGI_GE.EST",       // government effectiveness
  rl: "GOV_WGI_RL.EST",       // rule of law
  cc: "GOV_WGI_CC.EST",       // control of corruption
  tax: "GC.TAX.TOTL.GD.ZS",   // tax revenue, % of GDP
  debt: "GC.DOD.TOTL.GD.ZS",  // central government debt, % of GDP
  gdppc: "NY.GDP.PCAP.CD",
  pop: "SP.POP.TOTL"
};

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+capacity page)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* The country list is what separates a country from an aggregate. The World
   Bank returns both from the same endpoint and they are indistinguishable by
   code alone — "AFE" looks exactly like a country — so the region decides. */
const cl = await get(`${API}/country?format=json&per_page=400`);
if (!Array.isArray(cl) || !cl[1]) throw new Error("country list unavailable");

const meta = {};
for (const c of cl[1]) {
  if (c.region.id === "NA") continue;          /* aggregates */
  meta[c.id] = {
    name: c.name,
    region: c.region.value,
    income: c.incomeLevel.value
  };
}
const isCountry = (iso) => !!meta[iso];
if (Object.keys(meta).length < 200) throw new Error("country list too short: " + Object.keys(meta).length);

const raw = {};
for (const [k, code] of Object.entries(IND)) {
  const j = await get(`${API}/country/all/indicator/${code}?format=json&per_page=20000&date=1990:2026`);
  if (!Array.isArray(j) || !j[1]) throw new Error("no rows for " + code + " " + JSON.stringify(j).slice(0, 200));
  raw[k] = j[1].filter((r) => isCountry(r.countryiso3code) && r.value != null);
  await new Promise((r) => setTimeout(r, 250));
}

/* ------------------------------------------------------------ shape it --- */
const yearSet = new Set();
for (const k of Object.keys(raw)) for (const r of raw[k]) yearSet.add(+r.date);
const years = [...yearSet].sort((a, b) => a - b);

/* country → indicator → year → value */
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

const series = (o, k) => years.map((y) => (o[k] && o[k][y] != null ? o[k][y] : null));

/* The panel: effectiveness, rule of law, corruption, tax, debt. Five series
   for every country, with nulls where the World Bank has nothing. */
const countries = [];
for (const [iso, o] of byIso) {
  if (!o.ge && !o.rl) continue;
  const ge = series(o, "ge"), rl = series(o, "rl");
  if (!ge.some((v) => v != null) && !rl.some((v) => v != null)) continue;
  countries.push({
    iso,
    name: meta[iso].name,
    region: meta[iso].region,
    income: meta[iso].income,
    ge, rl,
    cc: series(o, "cc"),
    tax: series(o, "tax"),
    debt: series(o, "debt"),
    gdppc: series(o, "gdppc"),
    pop: series(o, "pop")
  });
}
countries.sort((a, b) => a.name.localeCompare(b.name));

const latestYear = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i;
  return -1;
};
const at = (c, k, i) => (i >= 0 && c[k] ? c[k][i] : null);

/* --------------------------------------------------------- world medians --- */
/* A plain median across countries, unweighted. Population weighting would be
   a different and also defensible series, but it moves the line only when
   China or India move, which hides exactly the dispersion this page is about. */
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const world = {
  ge: years.map((y, i) => median(countries.map((c) => at(c, "ge", i)))),
  rl: years.map((y, i) => median(countries.map((c) => at(c, "rl", i)))),
  cc: years.map((y, i) => median(countries.map((c) => at(c, "cc", i))))
};

/* ------------------------------------------------------- divergence --- */
/* Rule of law in 2015 against the latest year, so the bars show direction of
   travel and not just position. 2015 is the last year before the political
   shifts most of this lab is about, and using it makes the chart an argument
   rather than a snapshot. */
const T0 = 2015;
const i0 = years.indexOf(T0);
const moved = [];
for (const c of countries) {
  const a = at(c, "rl", i0);
  const j = latestYear(c.rl);
  const b = at(c, "rl", j);
  if (a == null || b == null || j <= i0) continue;
  moved.push({ iso: c.iso, name: c.name, from: a, to: b, d: +(b - a).toFixed(2), year: years[j] });
}
moved.sort((a, b) => b.d - a.d);

/* ------------------------------------------------------------- scatter --- */
/* The most recent year in which at least 90 countries have both a governance
   score and a tax take, so the scatter is a year and not an average of years. */
let scatYear = years[years.length - 1];
for (let i = years.length - 1; i >= 0; i--) {
  const n = countries.filter((c) => at(c, "ge", i) != null && at(c, "tax", i) != null).length;
  if (n >= 90) { scatYear = years[i]; break; }
}
const si = years.indexOf(scatYear);
const scatter = countries
  .filter((c) => at(c, "ge", si) != null && at(c, "tax", si) != null)
  .map((c) => ({
    iso: c.iso, name: c.name, region: c.region, income: c.income,
    ge: +at(c, "ge", si).toFixed(2),
    tax: +at(c, "tax", si).toFixed(1),
    debt: at(c, "debt", si) == null ? null : +at(c, "debt", si).toFixed(1),
    gdppc: at(c, "gdppc", si) == null ? null : Math.round(at(c, "gdppc", si)),
    pop: at(c, "pop", si) == null ? null : Math.round(at(c, "pop", si))
  }));

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0, k = 0;
  for (let i = 0; i < n; i++) if (a[i] != null && b[i] != null) { ma += a[i]; mb += b[i]; k++; }
  if (k < 3) return null;
  ma /= k; mb /= k;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] == null || b[i] == null) continue;
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : null;
}

const rTaxGe = pearson(scatter.map((d) => d.ge), scatter.map((d) => d.tax));

/* Fiscal room: debt against the governance score is the pair that decides
   whether a country can borrow its way through a shock. */
const debtByIncome = {};
for (const d of scatter) {
  if (d.debt == null) continue;
  (debtByIncome[d.income] = debtByIncome[d.income] || []).push(d.debt);
}
const debtSummary = Object.keys(debtByIncome).map((k) => ({
  income: k,
  n: debtByIncome[k].length,
  med: +median(debtByIncome[k]).toFixed(1)
})).sort((a, b) => a.med - b.med);

const checks = [
  {
    label: "Countries with a governance score",
    value: countries.length + " of " + Object.keys(meta).length + " in the World Bank list",
    detail: "Aggregates (regions, income groups, 'World') are dropped before anything is counted, using each entity's region field rather than guessing from the code. The remainder is every country the WGI covers at least once since " + years[0] + "."
  },
  {
    label: "Years covered",
    value: years[0] + " → " + years[years.length - 1],
    detail: "WGI is biennial until 2002 and annual afterwards, so early years are sparse. Gaps are drawn as gaps; the page never interpolates a governance score, because the whole point of the series is that it moves slowly and then abruptly."
  },
  {
    label: "Effectiveness against tax take",
    value: rTaxGe == null ? "n/a" : "r = " + rTaxGe.toFixed(2) + ", n = " + scatter.length + " (" + scatYear + ")",
    detail: "Correlation across countries between the government-effectiveness estimate and tax revenue as a share of GDP. This is the page's central claim in one number: capacity to govern and capacity to fund are the same variable seen twice. It is a correlation across countries, not evidence about any one of them."
  },
  {
    label: "Countries whose rule of law fell since " + T0,
    value: moved.filter((m) => m.d < -0.1).length + " down · " + moved.filter((m) => m.d > 0.1).length + " up",
    detail: "Movement of at least a tenth of a standard deviation between " + T0 + " and each country's latest year, on a scale whose whole range is about five points. Most countries did not move appreciably, which is the finding: institutional change is slow even where politics is not."
  },
  {
    label: "Median debt by income group",
    value: debtSummary.map((d) => d.income.replace(" income", "").replace(":", "") + " " + d.med + "%").join(" · "),
    detail: "Central government debt as a share of GDP, latest year with both a score and a debt number. Debt is not a collapse mechanism by itself; debt plus a shock plus no room to borrow is."
  }
];

const out = {
  generated: STAMP,
  span: { from: years[0], to: years[years.length - 1] },
  source: {
    name: "World Bank — Worldwide Governance Indicators and World Development Indicators",
    url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
    note: "WGI estimates are perception-based aggregates in normal units (mean 0, sd 1 across the sample), so a score is comparable across countries within a year and only loosely across years. Tax, debt and income are WDI. Both are fetched from the World Bank's open API with no key."
  },
  years,
  world,
  countries: countries.map((c) => ({
    iso: c.iso, name: c.name, region: c.region, income: c.income,
    ge: c.ge.map((v) => (v == null ? null : +v.toFixed(2))),
    rl: c.rl.map((v) => (v == null ? null : +v.toFixed(2))),
    cc: c.cc.map((v) => (v == null ? null : +v.toFixed(2)))
  })),
  scatter: { year: scatYear, points: scatter },
  moved,
  debtByIncome: debtSummary,
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, countries: out.countries.length + " countries", scatter: out.scatter.points.length + " points" }, null, 2));
} else {
  const body = `/* Generated by ingest-capacity.mjs on ${STAMP}. Do not edit by hand.
   ${countries.length} countries, ${years[0]} to ${years[years.length - 1]},
   Worldwide Governance Indicators plus WDI tax, debt and income.
   Regenerate with:  node ingest-capacity.mjs                                  */
window.CAPACITY = ${JSON.stringify(out)};
`;
  fs.writeFileSync("capacity-data.js", body);
  console.log(`wrote capacity-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
console.log("  store size: " + countries.length + " countries × " + years.length + " years");
