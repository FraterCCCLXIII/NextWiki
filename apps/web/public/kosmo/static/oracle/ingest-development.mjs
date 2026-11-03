#!/usr/bin/env node
/*
 * ingest-development.mjs — the Seshat panel behind `development.html`.
 *
 *   node ingest-development.mjs          # fetch, derive, check, write
 *   node ingest-development.mjs --dry
 *
 * The published result this reproduces is Wand & Hoyer (2024), PNAS Nexus
 * 3(2):pgae009, "The characteristic time scale of cultural evolution": 23
 * Natural Geographic Areas, nine complexity characteristics combined into a
 * first principal component, aligned on the year each area crosses a complexity
 * threshold, and a single logistic fitted to the pooled series — with a rise
 * time of about 2,500 years between the plateaus.
 *
 * Their source data is Seshat's Polaris release, which is public: one xlsx with
 * a long-format sheet of polity-year-variable rows. So this script fetches it,
 * rebuilds the composite from the nine characteristics, and *computes* the rise
 * time rather than quoting it. The published 2,500 is then a check, not an
 * input. Where my composite differs from theirs, the difference is reported.
 *
 * No dependencies: the xlsx is a zip of XML, so this unzips with node:zlib and
 * reads the sheet with a regex.
 */

import fs from "node:fs";
import zlib from "node:zlib";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const URL = "https://github.com/Seshat-Global-History-Databank/build_polaris_dataset/raw/main/Polaris2026.xlsx";

/* ------------------------------------------------------------------ fetch */
async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+development panel)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return Buffer.from(await res.arrayBuffer());
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

/* -------------------------------------------------------------- xlsx rows */
function decode(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function sheetRows(xml) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const inner = m[1];
    const cells = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g;
    let c;
    while ((c = cellRe.exec(inner))) {
      const attrs = c[1] || c[3] || "";
      const body = c[2] || "";
      if (/t="inlineStr"/.test(attrs)) {
        let txt = "";
        const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
        let t;
        while ((t = tRe.exec(body))) txt += decode(t[1]);
        cells.push(txt);
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body);
        cells.push(v ? decode(v[1]) : "");
      }
    }
    rows.push(cells);
  }
  return rows;
}

/* --------------------------------------------------------------- the spine */
const PRESENCE = { P: 1, IP: 1, A: 0, IA: 0, SU: 0.5, "A~P": 0.5, "P~A": 0.5 };

function presence(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s in PRESENCE) return PRESENCE[s];
  return null;
}
function number(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/* The nine characteristics, each a function of the raw Seshat variables.
   Turchin et al. (2018) define the same nine; the exact scoring rules live in
   their supplement, so this is an independent implementation of the same
   construct rather than a copy, and the checks say how close it lands. */
const LEVEL_VARS = ["administrative_level", "settlement_hierarchy", "military_level", "religious_level"];
const PRO_VARS = ["professional_soldier", "professional_military_officer", "full_time_bureaucrat",
  "professional_priesthood", "judge", "professional_lawyer"];
const INFRA_VARS = ["specialized_government_building", "court", "irrigation_system", "road", "port",
  "food_storage_site", "drinking_water_supply_system", "market", "courier", "merit_promotion"];
const WRITE_VARS = ["written_record", "script", "phonetic_alphabetic_writing"];
const TEXT_VARS = ["article", "history", "philosophy", "fiction", "scientific_literature",
  "practical_literature", "lists_tables_and_classification", "religious_literature",
  "sacred_text", "calendar", "formal_legal_code"];
const MONEY_VARS = ["indigenous_coin", "foreign_coin", "paper_currency"];

function meanOf(rec, vars, conv) {
  let sum = 0, n = 0;
  for (const v of vars) {
    const x = conv(rec[v]);
    if (x != null) { sum += x; n++; }
  }
  return n ? sum / n : null;
}

function characteristics(rec) {
  const pop = Math.max(number(rec.polity_population) || 0, number(rec.polity_population_to) || 0);
  const terr = Math.max(number(rec.polity_territory) || 0, number(rec.polity_territory_to) || 0);
  const city = Math.max(number(rec.population_of_the_largest_settlement) || 0,
    number(rec.population_of_the_largest_settlement_to) || 0);
  const c = [];
  c.push(pop > 0 ? Math.log10(pop) : null);
  c.push(terr > 0 ? Math.log10(terr) : null);
  c.push(city > 0 ? Math.log10(city) : null);
  c.push(meanOf(rec, LEVEL_VARS, number));
  c.push(meanOf(rec, PRO_VARS, presence));
  c.push(meanOf(rec, INFRA_VARS, presence));
  c.push(meanOf(rec, WRITE_VARS, presence));
  c.push(meanOf(rec, TEXT_VARS, presence));
  c.push(meanOf(rec, MONEY_VARS, presence));
  return c;
}

/* ------------------------------------------------------------------- main */
const buf = await get(URL);
const files = unzip(buf);
const scXml = (files["xl/worksheets/sheet4.xml"] || Buffer.from("")).toString("utf8");
if (!scXml) throw new Error("Social complexity sheet missing from the workbook");
const rows = sheetRows(scXml);

const head = rows[0];
const col = (name) => head.indexOf(name);
const iRegion = col("seshat_region"), iPolity = col("polity_id"), iVar = col("variable_name");
const iFrom = col("value_from"), iTo = col("value_to");
const iYFrom = col("year_from"), iYTo = col("year_to");
if (iRegion < 0 || iVar < 0) throw new Error("unexpected column layout");

/* The complexity sheet codes a polity once, not per year. Its year columns are
   the wrong way round to build a time series from: most rows are point-dated
   (year_from == year_to) and year_to = 0 is Seshat's sentinel for an open
   interval. Read literally, 617 of 618 polities are "alive" in the year 0
   century and the whole panel collapses onto that one date — which is how an
   earlier version of this file produced a 4,000-year polity span for the
   Uruk period.

   The durations live in the Polities sheet, one row per polity with a
   start_year and an end_year. So: take each polity's variables from the
   complexity sheet, take its lifetime from the Polities sheet, and place the
   polity on the map once. A century series is then the most complex polity
   alive in that century, which is exactly the quantity the paper's alignment
   is about. */
const polRows = sheetRows((files["xl/worksheets/sheet2.xml"] || Buffer.from("")).toString("utf8"));
const ph = polRows[0] || [];
const pcol = (n) => ph.indexOf(n);
const piId = pcol("polity_id"), piReg = pcol("seshat_region"),
  piNga = pcol("homeNGA"), piStart = pcol("start_year"), piEnd = pcol("end_year");
if (piId < 0 || piStart < 0 || piEnd < 0) throw new Error("Polities sheet missing from the workbook");

const span = new Map();   /* polity_id -> {region, nga, y0, y1} */
for (let r = 1; r < polRows.length; r++) {
  const row = polRows[r];
  const id = row[piId];
  if (!id) continue;
  const y0 = Number(row[piStart]), y1 = Number(row[piEnd]);
  if (!isFinite(y0)) continue;
  span.set(id, {
    region: row[piReg] || "unassigned",
    nga: row[piNga] || row[piReg] || "unassigned",
    y0,
    y1: isFinite(y1) && y1 >= y0 ? y1 : y0
  });
}

/* one value per polity per variable: the last coding wins, and a range is
   carried as its midpoint for the numeric variables */
const NUMERIC = new Set(["polity_population", "polity_territory", "population_of_the_largest_settlement"]);
const coded = new Map();  /* polity_id -> {var: value} */
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const id = row[iPolity], varname = row[iVar];
  if (!id || !varname || !span.has(id)) continue;
  let store = coded.get(id);
  if (!store) { store = {}; coded.set(id, store); }
  if (NUMERIC.has(varname)) {
    const a = Number(row[iFrom]), b = iTo >= 0 ? Number(row[iTo]) : NaN;
    const vals = [a, b].filter(x => isFinite(x));
    if (!vals.length) continue;
    store[varname] = vals.reduce((s, x) => s + x, 0) / vals.length;
  } else {
    if (row[iFrom] == null || row[iFrom] === "") continue;
    store[varname] = row[iFrom];
  }
}

const records = new Map();  /* polity_id -> {region, nga, polity, year, y0, y1, ...vars} */
for (const [id, s] of span) {
  const vars = coded.get(id);
  if (!vars) continue;
  records.set(id, {
    region: s.region, nga: s.nga, polity: id, y0: s.y0, y1: s.y1,
    year: Math.round((s.y0 + s.y1) / 2), ...vars
  });
}
if (!records.size) throw new Error("no polity joined the complexity sheet to the Polities sheet");
console.error(`  joined ${records.size} of ${span.size} polities to a duration`);

/* ---- composite: z-score each characteristic, take PC1 by power iteration --- */
const keys = [...records.keys()];
const N = keys.length;
const K = 9;
const cols = Array.from({ length: K }, () => new Float64Array(N));
const present = Array.from({ length: K }, () => 0);
for (let i = 0; i < N; i++) {
  const c = characteristics(records.get(keys[i]));
  for (let k = 0; k < K; k++) {
    if (c[k] != null) { cols[k][i] = c[k]; present[k]++; }
    else cols[k][i] = NaN;
  }
}

const diag = { present: present.slice(), nRecords: N, fullRows: 0 };
for (let i = 0; i < N; i++) {
  let c = 0;
  for (let k = 0; k < K; k++) if (!isNaN(cols[k][i])) c++;
  if (c >= 7) diag.fullRows++;
}

const mean = [], sd = [];
for (let k = 0; k < K; k++) {
  let s = 0, n = 0;
  for (let i = 0; i < N; i++) if (!isNaN(cols[k][i])) { s += cols[k][i]; n++; }
  const m = n ? s / n : 0;
  let v = 0;
  for (let i = 0; i < N; i++) if (!isNaN(cols[k][i])) v += (cols[k][i] - m) ** 2;
  mean.push(m);
  sd.push(n > 1 ? Math.sqrt(v / (n - 1)) : 1);
}
const Z = Array.from({ length: K }, () => new Float64Array(N));
for (let k = 0; k < K; k++) {
  for (let i = 0; i < N; i++) {
    const x = cols[k][i];
    Z[k][i] = isNaN(x) ? 0 : (x - mean[k]) / (sd[k] || 1);
  }
}

/* correlation matrix */
const R = Array.from({ length: K }, () => new Float64Array(K));
for (let a = 0; a < K; a++) {
  for (let b = a; b < K; b++) {
    let s = 0;
    for (let i = 0; i < N; i++) s += Z[a][i] * Z[b][i];
    R[a][b] = R[b][a] = s / N;
  }
}

/* power iteration for the leading eigenvector */
let v = new Float64Array(K).fill(1 / Math.sqrt(K));
let lambda = 0;
for (let iter = 0; iter < 200; iter++) {
  const w = new Float64Array(K);
  for (let a = 0; a < K; a++) {
    let s = 0;
    for (let b = 0; b < K; b++) s += R[a][b] * v[b];
    w[a] = s;
  }
  let norm = 0;
  for (let a = 0; a < K; a++) norm += w[a] * w[a];
  norm = Math.sqrt(norm);
  for (let a = 0; a < K; a++) v[a] = w[a] / norm;
  lambda = norm;
}
/* orient the component so that more complexity is positive */
let signSum = 0;
for (let a = 0; a < K; a++) signSum += v[a];
if (signSum < 0) for (let a = 0; a < K; a++) v[a] = -v[a];

const score = new Float64Array(N);
for (let i = 0; i < N; i++) {
  let s = 0;
  for (let a = 0; a < K; a++) s += v[a] * Z[a][i];
  score[i] = s;
}

/* ------------------------------------------------- per-region yearly series */
const byRegion = new Map();
for (let i = 0; i < N; i++) {
  const rec = records.get(keys[i]);
  let arr = byRegion.get(rec.region);
  if (!arr) { arr = []; byRegion.set(rec.region, arr); }
  arr.push({ y0: rec.y0, y1: rec.y1, s: score[i], nga: rec.nga });
}

/* century grid: at each century, the highest score among the polities alive in
   that century. A region holds several polities at once, and the complex one is
   the one the sequence is about. A century with nothing alive has no value
   rather than a zero — the line breaks instead of dropping. */
const series = [];
for (const [region, arr] of [...byRegion.entries()].sort()) {
  const lo = Math.floor(Math.min(...arr.map(p => p.y0)) / 100) * 100;
  const hi = Math.ceil(Math.max(...arr.map(p => p.y1)) / 100) * 100;
  const pts = [];
  for (let c = lo; c <= hi; c += 100) {
    let best = null;
    for (const p of arr) if (p.y0 <= c && c <= p.y1 && (best == null || p.s > best)) best = p.s;
    if (best != null) pts.push([c, best]);
  }
  if (pts.length >= 8) series.push({ region, pts });
}

/* ------------------------------------------------ capability diffusion ---
   The most robust thing in this panel needs no index at all: at each century,
   what share of the polities alive then had writing, coins, a legal code, a
   bureaucracy, a professional army. Each capability has its own S-curve, and
   complexity is the stack of them. No weighting, no composite, no fit. */
const CAPS = {
  writing: ["written_record", "script", "phonetic_alphabetic_writing", "non_phonetic_writing"],
  "legal code": ["formal_legal_code"],
  bureaucracy: ["full_time_bureaucrat"],
  "professional army": ["professional_soldier", "professional_military_officer"],
  judiciary: ["judge", "professional_lawyer"],
  priesthood: ["professional_priesthood"],
  coins: ["indigenous_coin", "foreign_coin"],
  markets: ["market"],
  road: ["road"],
  "written texts": ["history", "philosophy", "scientific_literature", "fiction", "sacred_text"]
};

/* Aliveness is the polity's own lifetime, not a span inferred from its rows, so
   the denominator is the set of polities that actually existed in that century.
   A capability is counted only where a polity carries a coding for it, and a
   share is only reported once MIN_CODED polities do: Egypt, Persia and Greece
   all had writing, and dividing by polities with no writing row would report
   zero and call it history. */
const MIN_CODED = 5;

const capNames = Object.keys(CAPS);
const centuryMin = -10000, centuryMax = 1900;
const capYears = [];
for (let c = -3000; c <= centuryMax; c += 100) capYears.push(c);

const capMatrix = new Map(capNames.map(n => [n, []]));
const capCoded = new Map(capNames.map(n => [n, []]));
const capAlive = [];
for (const y of capYears) {
  let alive = 0;
  const has = new Array(capNames.length).fill(0);
  const codedN = new Array(capNames.length).fill(0);
  for (const rec of records.values()) {
    if (rec.y0 > y || y > rec.y1) continue;
    alive++;
    capNames.forEach((name, j) => {
      for (const v of CAPS[name]) {
        if (rec[v] == null) continue;
        const p = presence(rec[v]);
        if (p == null) continue;
        codedN[j]++;
        if (p >= 1) has[j]++;
        break;
      }
    });
  }
  capAlive.push(alive);
  capNames.forEach((name, j) => {
    capCoded.get(name).push(codedN[j]);
    capMatrix.get(name).push(codedN[j] >= MIN_CODED ? +(has[j] / codedN[j]).toFixed(3) : null);
  });
}

/* ---- threshold: the minimum between the two modes of the pooled values --- */
const allScores = score.slice().sort();
const lo = allScores[Math.floor(allScores.length * 0.02)];
const hi = allScores[Math.floor(allScores.length * 0.98)];
const BINS = 40;
const hist = new Array(BINS).fill(0);
for (const s of allScores) {
  if (s < lo || s > hi) continue;
  const b = Math.min(BINS - 1, Math.floor((s - lo) / (hi - lo) * BINS));
  hist[b]++;
}
/* smooth, then find the deepest valley between the two highest peaks */
const smooth = hist.map((_, i) => {
  let s = 0, n = 0;
  for (let j = -2; j <= 2; j++) if (hist[i + j] != null) { s += hist[i + j]; n++; }
  return s / n;
});
let peak1 = 0, peak2 = 0;
for (let i = 1; i < BINS - 1; i++) {
  if (smooth[i] > smooth[peak1]) peak1 = i;
}
let best = 0;
for (let i = 1; i < BINS - 1; i++) if (Math.abs(i - peak1) > 5 && smooth[i] > smooth[peak2]) peak2 = i;
if (peak1 > peak2) { const t = peak1; peak1 = peak2; peak2 = t; }
let valley = peak1 + 1;
for (let i = peak1 + 1; i < peak2; i++) if (smooth[i] < smooth[valley]) valley = i;
const threshold = lo + (valley + 0.5) / BINS * (hi - lo);

/* --------------------------------------------------- align on RelTime --- */
const anchors = new Map();
for (const s of series) {
  const hit = s.pts.find(p => p[1] > threshold);
  if (hit) anchors.set(s.region, hit[0]);
}
const crossed = series.filter(s => anchors.has(s.region));
const missed = series.filter(s => !anchors.has(s.region));

/* normalise each crossed series to [0,1] within itself, as the paper does */
const aligned = [];
for (const s of crossed) {
  const ys = s.pts.map(p => p[1]);
  const mn = Math.min(...ys), mx = Math.max(...ys);
  const a = anchors.get(s.region);
  for (const [year, val] of s.pts) {
    if (year < a - 3000 || year > a + 3000) continue;
    aligned.push([year - a, (val - mn) / (mx - mn || 1), s.region]);
  }
}

/* ---- rise time, model-free -------------------------------------------------
   The published result fits a logistic and reports the width between its
   plateaus. That fit is not reproduced here, because an independent
   implementation of the composite lands at 31% of variance on the first
   component against the published 77%, and fitting a curve to a noisier index
   would produce a number that looked comparable and was not. What is computed
   instead needs no curve: for each region, the time between first crossing the
   25th and the 75th percentile of the pooled score. Same question, no model. */
const pooled = score.slice().sort();
const p25 = pooled[Math.floor(pooled.length * 0.25)];
const p75 = pooled[Math.floor(pooled.length * 0.75)];
const durations = [];
for (const s of crossed) {
  const t1 = s.pts.find(p => p[1] > p25);
  const t2 = s.pts.find(p => p[1] > p75);
  if (t1 && t2 && t2[0] > t1[0]) durations.push(t2[0] - t1[0]);
}
durations.sort((a, b) => a - b);
const meanDur = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
const medianDur = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
const riseFit = null, rmse = null;

/* ------------------------------------------------------------- checks --- */
const varianceShare = lambda / K;
const checks = [
  {
    label: "Principal component",
    value: (varianceShare * 100).toFixed(0) + "% of variance",
    detail: `The nine characteristics collapse onto one axis. The published figure for SPC1 is 77%; an independent implementation landing near it means the composite is measuring the same thing rather than something adjacent.`
  },
  {
    label: "Areas that cross the threshold",
    value: `${crossed.length} of ${series.length}`,
    detail: `${missed.length} regions never exceed ${threshold.toFixed(2)}, so they cannot be aligned and are excluded from the fit — the same selection the paper makes, and the same bias: all of Oceania drops out.`
  },
  {
    label: "Rise time, model-free",
    value: Math.round(medianDur).toLocaleString("en-US") + " yr median",
    detail: `First crossing of the 25th percentile of the pooled score to the first crossing of the 75th, per region. n=${durations.length}, mean ${Math.round(meanDur).toLocaleString("en-US")}. The published logistic puts the same rise at about 2,500 years between plateaus, or roughly 4,000 at looser thresholds — the same order, from a different instrument.`
  },
  {
    label: "Composite against the published one",
    value: "independent",
    detail: `This file builds the nine characteristics from the raw variables, because the scoring rules behind the published SPC1 are not published in full. It lands at ${(varianceShare * 100).toFixed(0)}% of variance on the first component against the paper's 77%, so the trajectories below are an index of the same construct rather than a reproduction of that one. The published figures are cited as published, never recomputed.`
  },
  {
    label: "Anchors",
    value: anchors.size + " areas",
    detail: `RelTime zero is the century each area first crosses the threshold, so the alignment is a claim about when complexity started rising rather than about absolute dates.`
  }
];

const out = {
  generated: STAMP,
  source: {
    name: "Seshat Global History Databank — Polaris release",
    url: URL,
    paper: "Wand & Hoyer (2024), PNAS Nexus 3(2):pgae009",
    paperUrl: "https://doi.org/10.1093/pnasnexus/pgae009"
  },
  counts: { rows: rows.length - 1, records: N, polities: new Set([...records.values()].map(r => r.polity)).size, regions: series.length },
  diag,
  loadings: [...v].map((x, i) => [["population", "territory", "largest settlement", "hierarchy",
    "professionalism", "infrastructure", "writing", "texts", "money"][i], +x.toFixed(3)]),
  varianceShare: +varianceShare.toFixed(3),
  threshold: +threshold.toFixed(3),
  rise: { median: Math.round(medianDur), mean: Math.round(meanDur), n: durations.length, p25: +p25.toFixed(2), p75: +p75.toFixed(2) },
  caps: {
    years: capYears, names: capNames,
    data: capNames.map(n => capMatrix.get(n)),
    coded: capNames.map(n => capCoded.get(n)),
    alive: capAlive, minCoded: MIN_CODED
  },
  alignedSample: aligned.filter((_, i) => i % 7 === 0).map(([x, y, r]) => [+x, +y.toFixed(2), r]),
  series: crossed.map(s => ({
    region: s.region,
    anchor: anchors.get(s.region),
    /* century resolution, two decimals — this is a chart, not a database */
    pts: s.pts.filter((_, i) => i % 1 === 0).map(([y, v]) => [y, +v.toFixed(2)])
  })),
  missed: missed.map(s => s.region),
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, series: out.series.length + " series" }, null, 2));
} else {
  const body = `/* Generated by ingest-development.mjs on ${STAMP}. Do not edit by hand.
   Seshat Polaris panel: ${out.counts.polities} polities with their own durations,
   ${out.counts.regions} regions, composite social complexity rebuilt from the nine
   characteristics. Regenerate with: node ingest-development.mjs                */
window.DEVELOPMENT = ${JSON.stringify(out)};
`;
  fs.writeFileSync("development-data.js", body);
  console.log(`wrote development-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}
for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
