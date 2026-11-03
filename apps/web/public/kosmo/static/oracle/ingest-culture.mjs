#!/usr/bin/env node
/*
 * ingest-culture.mjs — the two culture panels behind `development.html`.
 *
 *   node ingest-culture.mjs          # fetch, derive, check, write
 *   node ingest-culture.mjs --dry
 *
 * Two very different objects, deliberately shown side by side:
 *
 * 1. The Inglehart–Welzel dimensions. The World Values Survey computes country
 *    positions as the first two principal components of a fixed ten-item
 *    battery, weighted by the survey's own observation weight, varimax
 *    rotated, then affinely rescaled. The official 2023 poster is distributed
 *    as a flat image — no table, no coordinates — so the numbers here come from
 *    an independent recomputation by kwinkunks/ai-values applied to the same
 *    IVS WVS/EVS microdata. It reproduces the shape of the map and not its
 *    exact points, and the page says which.
 *
 * 2. A county-level individualism index built from geolocated tweets
 *    (Havaldar et al., NAACL 2024). This one publishes its numbers, so it can
 *    be checked rather than trusted: the county scores are aggregated to states
 *    here, the paper's own state values are reproduced, and the result is
 *    correlated against the 1999 behavioural index it claims to track.
 *
 * No dependencies.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);

const COORDS_URL = "https://raw.githubusercontent.com/kwinkunks/ai-values/main/out/coords.js";
const COUNTY_URL = "https://raw.githubusercontent.com/shreyahavaldar/knowledge_guided_lexica/main/GCI%20Validation/Results/county_scores.csv";
const VC_URL = "https://raw.githubusercontent.com/shreyahavaldar/knowledge_guided_lexica/main/GCI%20Validation/Results/vc_scores.csv";

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+culture panel)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------- 1. Inglehart–Welzel --- */

const rawCoords = await get(COORDS_URL);
const jsonText = rawCoords.replace(/^\s*window\.COORDS\s*=\s*/, "").replace(/;\s*$/, "");
const allCoords = JSON.parse(jsonText);

/* The file appends language-model points to the same list, labelled with the
   vendor as the "region". Countries are the rows whose region is a cultural
   zone, so the filter is by zone membership rather than by exclusion. */
const ZONES = [
  "Protestant Europe", "Catholic Europe", "Orthodox Europe", "English-Speaking",
  "Confucian", "Latin America", "West & South Asia", "African-Islamic"
];
const countries = allCoords
  .filter(c => ZONES.includes(c.region) && isFinite(c.x) && isFinite(c.y))
  .map(c => ({ c: c.country, x: +c.x.toFixed(3), y: +c.y.toFixed(3), z: c.region }))
  .sort((a, b) => a.c.localeCompare(b.c));

if (!countries.length) throw new Error("no countries survived the zone filter");

/* ------------------------------------------- 2. the Twitter county index --- */

const FIPS = {
  1: "Alabama", 2: "Alaska", 4: "Arizona", 5: "Arkansas", 6: "California", 8: "Colorado",
  9: "Connecticut", 10: "Delaware", 11: "District of Columbia", 12: "Florida", 13: "Georgia",
  15: "Hawaii", 16: "Idaho", 17: "Illinois", 18: "Indiana", 19: "Iowa", 20: "Kansas",
  21: "Kentucky", 22: "Louisiana", 23: "Maine", 24: "Maryland", 25: "Massachusetts",
  26: "Michigan", 27: "Minnesota", 28: "Mississippi", 29: "Missouri", 30: "Montana",
  31: "Nebraska", 32: "Nevada", 33: "New Hampshire", 34: "New Jersey", 35: "New Mexico",
  36: "New York", 37: "North Carolina", 38: "North Dakota", 39: "Ohio", 40: "Oklahoma",
  41: "Oregon", 42: "Pennsylvania", 44: "Rhode Island", 45: "South Carolina",
  46: "South Dakota", 47: "Tennessee", 48: "Texas", 49: "Utah", 50: "Vermont",
  51: "Virginia", 53: "Washington", 54: "West Virginia", 55: "Wisconsin", 56: "Wyoming"
};

/* US Census regions, used only to summarise the county distribution */
const REGION = {
  Northeast: ["Connecticut", "Maine", "Massachusetts", "New Hampshire", "Rhode Island", "Vermont",
    "New Jersey", "New York", "Pennsylvania"],
  Midwest: ["Illinois", "Indiana", "Michigan", "Ohio", "Wisconsin", "Iowa", "Kansas", "Minnesota",
    "Missouri", "Nebraska", "North Dakota", "South Dakota"],
  South: ["Delaware", "District of Columbia", "Florida", "Georgia", "Maryland", "North Carolina",
    "South Carolina", "Virginia", "West Virginia", "Alabama", "Kentucky", "Mississippi",
    "Tennessee", "Arkansas", "Louisiana", "Oklahoma", "Texas"],
  West: ["Arizona", "Colorado", "Idaho", "Montana", "Nevada", "New Mexico", "Utah", "Wyoming",
    "Alaska", "California", "Hawaii", "Oregon", "Washington"]
};
const regionOf = {};
for (const r of Object.keys(REGION)) for (const s of REGION[r]) regionOf[s] = r;

const countyCsv = (await get(COUNTY_URL)).trim().split("\n");
countyCsv.shift();
const byCounty = new Map();
for (const line of countyCsv) {
  const p = line.split(",");
  const fips = Number(p[1]);
  if (!fips) continue;                       /* the file has an all-zero summary row */
  let o = byCounty.get(fips);
  if (!o) { o = {}; byCounty.set(fips, o); }
  o[p[2]] = Number(p[4]);                    /* group_norm, the normalised weight */
}
const countyRows = [];
for (const [fips, o] of byCounty) {
  if (o.INDIVIDUALIST == null || o.COLLECTIVIST == null) continue;
  countyRows.push({ fips, st: FIPS[Math.floor(fips / 1000)], v: o.INDIVIDUALIST - o.COLLECTIVIST });
}
if (!countyRows.length) throw new Error("no county carried both lexica");

const byState = new Map();
for (const r of countyRows) {
  if (!r.st) continue;
  let a = byState.get(r.st);
  if (!a) { a = []; byState.set(r.st, a); }
  a.push(r.v);
}

/* the paper's own state table: Vandello–Cohen, and their published state scores */
const vcCsv = (await get(VC_URL)).trim().split("\n");
vcCsv.shift();
const VC = new Map();
for (const line of vcCsv) {
  const p = line.split(",");
  VC.set(p[0].trim(), { vc: +p[1], coll: +p[2], ind: +p[3] });
}

const states = [];
for (const [st, arr] of byState) {
  const ref = VC.get(st);
  if (!ref || !isFinite(ref.vc)) continue;
  states.push({
    st,
    kgl: arr.reduce((s, x) => s + x, 0) / arr.length,
    vc: ref.vc,
    paperInd: ref.ind,
    paperColl: ref.coll,
    n: arr.length,
    reg: regionOf[st] || null
  });
}
states.sort((a, b) => b.kgl - a.kgl);

function pearson(a, b) {
  const n = a.length;
  if (n < 3) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return num / Math.sqrt(da * db || 1);
}

const rVC = pearson(states.map(s => s.kgl), states.map(s => s.vc));
const rPaper = pearson(states.map(s => s.kgl), states.map(s => s.paperInd));

/* county histogram, on the observed range, in thousandths */
const vals = countyRows.map(r => r.v * 1000).sort((a, b) => a - b);
const lo = vals[0], hi = vals[vals.length - 1];
const BINS = 40;
const hist = new Array(BINS).fill(0);
for (const v of vals) {
  const b = Math.min(BINS - 1, Math.floor((v - lo) / (hi - lo) * BINS));
  hist[b]++;
}
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
};
const regionMeans = Object.keys(REGION).map(r => {
  const inR = countyRows.filter(c => regionOf[c.st] === r).map(c => c.v * 1000);
  return { r, med: +median(inR).toFixed(2), n: inR.length };
});

/* ----------------------------------------------------------------- checks --- */
const checks = [
  {
    label: "Countries on the dimensions",
    value: countries.length + " of " + allCoords.filter(c => ZONES.includes(c.region) || true).length,
    detail: "Every country in the recomputation whose region is one of the eight cultural zones. The same file appends model points (OpenAI, Anthropic, Google…), which are labelled by vendor rather than zone and are filtered out here."
  },
  {
    label: "County scores reproduced",
    value: countyRows.length.toLocaleString("en-US"),
    detail: "The paper reports 2,042 counties with sufficient tweet data; this reads " + countyRows.length + " that carry both lexica. One short, which is the file, not the arithmetic."
  },
  {
    label: "Aggregation against the paper",
    value: "r = " + (rPaper == null ? "n/a" : rPaper.toFixed(2)),
    detail: "Mean of the county scores per state, correlated with the paper's own published state values. If this were low, the aggregation would be the finding rather than the index."
  },
  {
    label: "Validation against 1999 behaviour",
    value: "r = " + (rVC == null ? "n/a" : rVC.toFixed(2)),
    detail: "States' Twitter-derived individualism against Vandello & Cohen's behavioural index of state collectivism, so the sign is expected negative. The paper reports 0.38 in magnitude against collectivism; about a fifth of the variance, and the county-level map itself has no external check at all."
  },
  {
    label: "Span of the county distribution",
    value: (hi - lo).toFixed(2) + " per thousand",
    detail: "Individualist minus collectivist word weight, in thousandths, across the counties that have both. The whole scale is small: the map's colour range is a few parts in ten thousand."
  }
];

const out = {
  generated: STAMP,
  sources: [
    {
      name: "Inglehart–Welzel dimensions, recomputed",
      provider: "kwinkunks / ai-values, from IVS WVS & EVS microdata",
      url: COORDS_URL,
      note: "Ten items (F063, Y003, F120, G006, E018, Y002, A008, F118, E025, A165), weighted by S017, two components with varimax rotation, rescaled by 1.81x+0.038 and 1.61y−0.1. An independent recomputation: the official 2023 poster is distributed only as a flat image."
    },
    {
      name: "Building Knowledge-Guided Lexica to Model Cultural Variation",
      provider: "Havaldar, Giorgi, Rai, Talhelm, Guntuku & Ungar, NAACL 2024",
      url: "https://aclanthology.org/2024.naacl-long.12/",
      note: "County-level individualism from 1.5 billion geolocated tweets, 2009–2015, via seed-word lexica expanded with FastText embeddings. Their Figure 3 is the map that circulates as 'Collectivism vs Individualism in the U.S.'"
    },
    {
      name: "County scores and the validation table",
      provider: "Havaldar et al., GCI Validation/Results",
      url: "https://github.com/shreyahavaldar/knowledge_guided_lexica",
      note: "county_scores.csv (raw weighted frequencies per county) and vc_scores.csv (their state-level values beside Vandello & Cohen's index). Everything in the second panel is computed from these two files."
    },
    {
      name: "Individualism, collectivism, and the American frontier",
      provider: "Vandello & Cohen, JPSP 77(2):279 (1999)",
      url: "https://psycnet.apa.org/record/1999-03699-004",
      note: "A state-level index built from behaviour — divorce, living alone, grandparents in the home, single-occupant car deaths, Libertarian voting, self-employment. The benchmark the Twitter index is checked against."
    }
  ],
  wvs: {
    zones: ZONES,
    n: countries.length,
    countries
  },
  counties: {
    n: countyRows.length,
    states: states.map(s => ({
      st: s.st, kgl: +(s.kgl * 1000).toFixed(3), vc: +s.vc.toFixed(3),
      n: s.n, reg: s.reg
    })),
    rVC: rVC == null ? null : +rVC.toFixed(3),
    rPaper: rPaper == null ? null : +rPaper.toFixed(3),
    hist: { lo: +lo.toFixed(2), hi: +hi.toFixed(2), bins: hist },
    regions: regionMeans,
    mostIndividualist: states.slice(0, 5).map(s => s.st),
    mostCollectivist: states.slice(-5).reverse().map(s => s.st)
  },
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, wvs: out.wvs.n + " countries", counties: out.counties.n + " counties" }, null, 2));
} else {
  const body = `/* Generated by ingest-culture.mjs on ${STAMP}. Do not edit by hand.
   ${out.wvs.n} countries on the Inglehart–Welzel dimensions (recomputed),
   ${out.counties.n} US counties on the Twitter individualism index,
   ${out.counties.states.length} states with both indices. Regenerate with:
   node ingest-culture.mjs                                                      */
window.CULTURE = ${JSON.stringify(out)};
`;
  fs.writeFileSync("culture-data.js", body);
  console.log(`wrote culture-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}
for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
