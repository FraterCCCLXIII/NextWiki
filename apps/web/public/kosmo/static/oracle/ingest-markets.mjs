#!/usr/bin/env node
/*
 * ingest-markets.mjs — the financial channel, monthly, 1990 to now.
 *
 *   node ingest-markets.mjs          # fetch, derive, check, write
 *   node ingest-markets.mjs --dry    # print the checks and stop
 *
 * Why this page exists: `AUDIT.md` found that `model.js` contains no debt, no
 * interest rate and no credit spread. A −40% equity drawdown does not stop at
 * the index in the real world; it triggers margin calls, covenant breaches and
 * a contraction in lending, which cuts spending, which cuts earnings. That
 * amplifier is what this dataset measures, and it is the first channel that
 * could produce a crash the Dark Factory model cannot generate at all.
 *
 * Source: FRED's public graph endpoint. It answers without an API key, which
 * is why this script has no credentials and no dependencies, but only one
 * series per request and — for the ICE BofA spread indices — only the last
 * three years. Those are not used. The Moody's Baa spread and the two Fed
 * financial-conditions indices carry the full history and are the honest
 * substitutes; the truncation is recorded as a check rather than papered over.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const COSD = "1990-01-01";
const COED = new Date().toISOString().slice(0, 10);
const BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=";

const SERIES = [
  { id: "BAA10Y", key: "baa", label: "Baa corporate minus 10-year", unit: "pp" },
  { id: "AAA10Y", key: "aaa", label: "Aaa corporate minus 10-year", unit: "pp" },
  { id: "NFCI", key: "nfci", label: "Chicago Fed financial conditions", unit: "index" },
  { id: "STLFSI4", key: "stlfsi", label: "St Louis Fed financial stress", unit: "index" },
  { id: "T10Y2Y", key: "curve", label: "10-year minus 2-year", unit: "pp" },
  { id: "DGS10", key: "tenY", label: "10-year Treasury yield", unit: "%" },
  { id: "UNRATE", key: "unrate", label: "Unemployment rate", unit: "%" },
  { id: "JTSJOL", key: "openings", label: "Job openings", unit: "thousands" },
  { id: "NASDAQCOM", key: "eq", label: "Nasdaq Composite", unit: "index" },
  { id: "CPIAUCSL", key: "cpi", label: "CPI, all urban consumers", unit: "index" },
  { id: "VIXCLS", key: "vix", label: "VIX", unit: "index" },
  { id: "USREC", key: "rec", label: "NBER recession indicator", unit: "0/1" }
];

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+markets page)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* FRED writes "." for a holiday or a missing print. Those are dropped, never
   read as zero — a spread of 0.00 would be an extreme reading, not a gap. */
function parseCsv(text) {
  const lines = text.trim().split("\n");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 2) continue;
    const v = p[1] === "." || p[1] === "" ? null : Number(p[1]);
    if (v == null || !isFinite(v)) continue;
    out.push({ d: p[0].trim(), v });
  }
  return out;
}

const raw = {};
for (const s of SERIES) {
  const text = await get(`${BASE}${s.id}&cosd=${COSD}&coed=${COED}`);
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("no rows for " + s.id);
  raw[s.id] = rows;
  await sleep(300);
}

/* ---------------------------------------------------------------- monthly --- */
/* Monthly means. Daily resolution matters for the week a market breaks and not
   at all for the questions here, and 12 series × 36 years of days is 90,000
   points the browser would have to draw. A monthly mean also survives the fact
   that the yield series skip weekends and the labour series are already monthly. */

const monthKey = (d) => d.slice(0, 7);

function toMonthly(rows) {
  const acc = new Map();
  for (const r of rows) {
    const k = monthKey(r.d);
    let a = acc.get(k);
    if (!a) { a = { sum: 0, n: 0, last: null }; acc.set(k, a); }
    a.sum += r.v; a.n++; a.last = r.v;
  }
  return acc;
}

const monthly = {};
for (const s of SERIES) monthly[s.id] = toMonthly(raw[s.id]);

/* The window starts where the oldest series starts, not where the youngest
   does. Taking the latest common month would throw away the 1990s — the 1991
   recession, the 1998 credit event — to avoid drawing two gaps in a series
   that begins in 2000. The gaps are the honest trade. */
const firsts = SERIES.map((s) => [...monthly[s.id].keys()].sort()[0]);
const START = firsts.sort()[0];
const END = SERIES
  .map((s) => [...monthly[s.id].keys()].sort().pop())
  .sort()
  .pop();

const months = [];
{
  let y = +START.slice(0, 4), m = +START.slice(5, 7);
  const ey = +END.slice(0, 4), em = +END.slice(5, 7);
  while (y < ey || (y === ey && m <= em)) {
    months.push(y + "-" + String(m).padStart(2, "0"));
    m++; if (m > 12) { m = 1; y++; }
  }
  /* The last month is usually a stub: the daily series have one or two prints
     in it and the monthly ones have none. A month built from two observations
     is not a monthly mean, so the panel ends at the last complete month. */
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (months[months.length - 1] >= thisMonth) months.pop();
}

function seriesOf(id) {
  const mm = monthly[id];
  return months.map((k) => {
    const a = mm.get(k);
    return a ? +(a.sum / a.n).toFixed(4) : null;
  });
}

const S = {};
for (const s of SERIES) S[s.key] = seriesOf(s.id);

/* Recessions as contiguous runs, for shading. A credit spread with no
   recessions marked is a line that happens to go up and down. */
const recessions = [];
{
  let run = null;
  months.forEach((k) => {
    const a = monthly.USREC.get(k);
    const on = a && a.last >= 0.5;
    if (on && !run) run = { from: k, to: k };
    else if (on) run.to = k;
    else if (run) { recessions.push(run); run = null; }
  });
  if (run) recessions.push(run);
}

/* Real equity: nominal divided by the price level, rebased to the first month
   both exist. Without this the chart is a picture of CPI with a stock market
   drawn on top of it.

   The deflator is carried forward where a month is missing. That is not an
   interpolation of the observation — CPI for a month is published a few weeks
   after that month ends, so the last equity print has no CPI yet, and a price
   level is a step series rather than something that changes within the gap. */
const eqFirst = S.eq.findIndex((v) => v != null);
const cpiAtStart = S.cpi[eqFirst];
const eqNom = S.eq.map((v) => (v == null ? null : +((v / S.eq[eqFirst]) * 100).toFixed(2)));
const cpiCarry = [];
{
  let last = null;
  S.cpi.forEach((v) => { if (v != null) last = v; cpiCarry.push(last); });
}
const eqReal = S.eq.map((v, i) =>
  v == null || cpiCarry[i] == null ? null : +((v / cpiCarry[i]) * 100 * (cpiAtStart / S.eq[eqFirst])).toFixed(2));
const cpiFilled = S.cpi.filter((v) => v == null).length;

/* --------------------------------------------------------------- measures --- */
const lastOf = (a) => {
  for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return { v: a[i], i };
  return null;
};
const peakOf = (a) => {
  let best = null;
  a.forEach((v, i) => { if (v != null && (!best || v > best.v)) best = { v, i }; });
  return best;
};
const pctile = (a, v) => {
  const xs = a.filter((x) => x != null);
  if (!xs.length) return null;
  return xs.filter((x) => x <= v).length / xs.length;
};
const mean = (a) => {
  const xs = a.filter((x) => x != null);
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
};

/* Coverage: the honest check the first draft of this script failed. A series
   that FRED truncated to three years still parses, still plots and still looks
   like a history, so the only defence is to count the months it actually has. */
const coverage = SERIES.map((s) => ({
  id: s.id,
  label: s.label,
  n: S[s.key].filter((v) => v != null).length,
  first: (months.find((k, i) => S[s.key][i] != null)) || "—",
  share: +(S[s.key].filter((v) => v != null).length / months.length).toFixed(3)
}));
const late = coverage.filter((c) => c.first !== months[0]);
const thin = coverage.filter((c) => c.share < 0.5);

const baaLast = lastOf(S.baa), baaPeak = peakOf(S.baa);
const aaaLast = lastOf(S.aaa);
const nfciLast = lastOf(S.nfci);
const curveLast = lastOf(S.curve);
const tenLast = lastOf(S.tenY);
const unLast = lastOf(S.unrate);
const oppLast = lastOf(S.openings);
const vixLast = lastOf(S.vix);
const realLast = lastOf(eqReal);
const realPeak = peakOf(eqReal);
const nomLast = lastOf(eqNom);
const nomPeak = peakOf(eqNom);

const inverted = S.curve.filter((v) => v != null && v < 0).length;
const curveKnown = S.curve.filter((v) => v != null).length;

/* Episodes: three-month widenings of the Baa spread of at least 60bp. A short
   ranked list answers "when did credit actually tighten" better than a chart
   the reader has to squint at. */
const episodes = [];
for (let i = 3; i < S.baa.length; i++) {
  if (S.baa[i] == null || S.baa[i - 3] == null) continue;
  const d = S.baa[i] - S.baa[i - 3];
  if (d >= 0.6) episodes.push({ m: months[i], d: +d.toFixed(2), to: +S.baa[i].toFixed(2) });
}
/* keep the peak of each run rather than every month of it */
const stress = [];
episodes.sort((a, b) => a.m.localeCompare(b.m)).forEach((e) => {
  const prev = stress[stress.length - 1];
  if (prev && months.indexOf(e.m) - months.indexOf(prev.m) <= 4) {
    if (e.d > prev.d) stress[stress.length - 1] = e;
  } else stress.push(e);
});

const checks = [
  {
    label: "Months in the panel",
    value: months.length + " (" + months[0] + " → " + months[months.length - 1] + ")",
    detail: "From the first month of the Baa spread to the last complete print. Every series is a monthly mean of daily, weekly or monthly observations."
  },
  {
    label: "Series starting with the panel",
    value: (coverage.length - late.length) + " of " + coverage.length,
    detail: (late.length
      ? "Later starts: " + late.map((c) => c.id + " from " + c.first).join(", ") + ". Those are drawn as gaps, never back-filled."
      : "Every series spans the window.") +
      " The ICE BofA high-yield index would be the better credit series, but FRED's keyless endpoint returns only the last three years of it, so the Baa spread is used instead; nothing here is interpolated."
  },
  {
    label: "Credit spread, now and at its peak",
    value: baaLast.v.toFixed(2) + " pp now" + (baaPeak ? " · " + baaPeak.v.toFixed(2) + " pp in " + months[baaPeak.i] : ""),
    detail: "Moody's seasoned Baa corporate yield less the 10-year Treasury. The peak is the reference any claim about credit stress is measured against; the percentile below puts today's level in that distribution."
  },
  {
    label: "Recessions in the window",
    value: recessions.length + "",
    detail: "Contiguous runs of the NBER indicator, drawn as bands. The page uses them to show whether a credit move anticipated the recession or followed it."
  },
  {
    label: "Months with an inverted curve",
    value: inverted + " of " + curveKnown,
    detail: "10-year minus 2-year below zero. The curve is not a cause of anything; it is the market pricing a policy path, and it inverted before every US recession in this window without exception."
  }
];

const out = {
  generated: STAMP,
  span: { from: months[0], to: months[months.length - 1], n: months.length },
  source: {
    name: "Federal Reserve Bank of St. Louis (FRED)",
    url: "https://fred.stlouisfed.org/",
    note: "Corporate spreads are Moody's seasoned yields less the 10-year Treasury, republished by FRED; the financial-conditions indices are the Chicago and St Louis Fed's own; the recession indicator is NBER's. The Nasdaq Composite is used for the equity series because FRED truncates the S&P 500 to ten years on the keyless endpoint. No API key, one series per request."
  },
  months,
  recessions,
  coverage,
  series: {
    baa: { label: "Baa − 10y", unit: "pp", values: S.baa },
    aaa: { label: "Aaa − 10y", unit: "pp", values: S.aaa },
    nfci: { label: "Chicago Fed NFCI", unit: "index", values: S.nfci },
    stlfsi: { label: "St Louis Fed stress", unit: "index", values: S.stlfsi },
    curve: { label: "10y − 2y", unit: "pp", values: S.curve },
    tenY: { label: "10-year yield", unit: "%", values: S.tenY },
    unrate: { label: "Unemployment", unit: "%", values: S.unrate },
    openings: { label: "Job openings", unit: "thousands", values: S.openings },
    eqNom: { label: "Nasdaq, nominal", unit: "index", values: eqNom },
    eqReal: { label: "Nasdaq, CPI-deflated", unit: "index", values: eqReal },
    vix: { label: "VIX", unit: "index", values: S.vix }
  },
  now: {
    baa: +baaLast.v.toFixed(2),
    baaPctile: +pctile(S.baa, baaLast.v).toFixed(3),
    baaMean: +mean(S.baa).toFixed(2),
    aaa: +aaaLast.v.toFixed(2),
    nfci: +nfciLast.v.toFixed(2),
    nfciPctile: +pctile(S.nfci, nfciLast.v).toFixed(3),
    curve: +curveLast.v.toFixed(2),
    tenY: +tenLast.v.toFixed(2),
    unrate: +unLast.v.toFixed(1),
    openings: Math.round(oppLast.v),
    vix: +vixLast.v.toFixed(1),
    eqReal: +realLast.v.toFixed(1),
    eqRealFromPeak: +(((realLast.v / realPeak.v) - 1) * 100).toFixed(1),
    eqNomFromPeak: nomPeak ? +(((nomLast.v / nomPeak.v) - 1) * 100).toFixed(1) : null,
    peakMonth: months[realPeak.i]
  },
  stress: stress.slice(-8).reverse(),
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, months: out.months.length, series: "omitted" }, null, 2));
} else {
  const body = `/* Generated by ingest-markets.mjs on ${STAMP}. Do not edit by hand.
   ${months.length} months, ${months[0]} to ${months[months.length - 1]},
   ${SERIES.length} FRED series, ${recessions.length} NBER recessions.
   Regenerate with:  node ingest-markets.mjs                                  */
window.MARKETS = ${JSON.stringify(out)};
`;
  fs.writeFileSync("markets-data.js", body);
  console.log(`wrote markets-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
console.log("  coverage: " + coverage.map((c) => c.id + " " + Math.round(c.share * 100) + "%").join(" · "));
console.log(`  now: Baa ${out.now.baa}pp (${Math.round(out.now.baaPctile * 100)}th pct) · NFCI ${out.now.nfci} (${Math.round(out.now.nfciPctile * 100)}th) · curve ${out.now.curve} · VIX ${out.now.vix}`);
console.log("  stress episodes: " + out.stress.map((s) => s.m + " +" + s.d).join(", "));
