#!/usr/bin/env node
/*
 * ingest-freight.mjs — daily chokepoint traffic behind `freight.html`.
 *
 *   node ingest-freight.mjs          # fetch, aggregate, check, write
 *   node ingest-freight.mjs --dry
 *
 * Source: IMF PortWatch, "Daily Chokepoint Transit Calls and Shipment Volume
 * Estimates", published openly on HDX. It is the only dataset in this lab with
 * daily frequency: transit calls and carrying capacity for 28 maritime
 * chokepoints, by vessel type, from 2019 to the current month.
 *
 * Why it matters for the rest of the lab: everything else here is annual or
 * decadal, which is the wrong resolution for the thing that actually happens
 * fast. A strait closing is a same-week event. Food and fuel distribution fails
 * before production does, and this is the distribution.
 *
 * No dependencies.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);

const DAILY_URL = "https://data.humdata.org/dataset/91d28bb8-986d-430c-961c-6a24ecbd66ee/resource/cbd17f06-8ab2-4ba4-a666-f7a4bcc9ea3f/download/daily-chokepoint-transit-calls-and-shipment-volume-estimates.csv";
const META_URL = "https://data.humdata.org/dataset/957b1c2f-a9b9-436c-a576-f7f3ddb9d736/resource/34256433-6d29-4488-9717-ad8b1c8bf8db/download/chokepoints.csv";

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 240000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "oracle-lab-ingest/1.0 (+freight panel)" }
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* the file is CRLF and the last column is named "capacity\r" */
function rows(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  const head = lines[0].split(",");
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    const o = {};
    for (let j = 0; j < head.length; j++) o[head[j]] = p[j];
    out.push(o);
  }
  return out;
}

const [dailyText, metaText] = await Promise.all([get(DAILY_URL), get(META_URL)]);
const daily = rows(dailyText);
const meta = rows(metaText);
if (!daily.length) throw new Error("no rows in the PortWatch file");

const metaByName = new Map(meta.map(m => [m.portname, m]));

/* ------------------------------------------------------------- aggregate ---
   Daily data at 28 chokepoints over 7+ years is ~79k rows. The page plots
   weeks: a 7-day average removes the day-of-week cycle that otherwise makes
   every series look like a saw, and the first and last week are dropped
   because they are partial. */
const weekOf = (iso) => {
  const d = new Date(iso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;              /* Monday = 0 */
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

const byPoint = new Map();   /* name -> week -> {calls, cap, byType{}} */
let minDate = "9999", maxDate = "0000";
for (const r of daily) {
  const date = (r.date || "").slice(0, 10);
  if (!date) continue;
  if (date < minDate) minDate = date;
  if (date > maxDate) maxDate = date;
  const name = r.portname;
  if (!name) continue;
  const wk = weekOf(date);
  let w = byPoint.get(name);
  if (!w) { w = new Map(); byPoint.set(name, w); }
  let a = w.get(wk);
  if (!a) { a = { calls: 0, cap: 0, cont: 0, bulk: 0, gen: 0, tank: 0, roro: 0, n: 0 }; w.set(wk, a); }
  a.calls += Number(r.n_total) || 0;
  a.cap += Number(r.capacity) || 0;
  a.cont += Number(r.n_container) || 0;
  a.bulk += Number(r.n_dry_bulk) || 0;
  a.gen += Number(r.n_general_cargo) || 0;
  a.tank += Number(r.n_tanker) || 0;
  a.roro += Number(r.n_roro) || 0;
  a.n++;
}

const allWeeks = [...new Set(daily.map(r => weekOf((r.date || "").slice(0, 10))))]
  .filter(Boolean).sort();
/* drop the partial head and tail weeks */
const firstFull = allWeeks[1] || allWeeks[0];
const lastFull = allWeeks[allWeeks.length - 2] || allWeeks[allWeeks.length - 1];
const weeks = allWeeks.filter(w => w >= firstFull && w <= lastFull);

const TYPES = [
  { k: "cont", name: "container" },
  { k: "tank", name: "tanker" },
  { k: "bulk", name: "dry bulk" },
  { k: "gen", name: "general cargo" },
  { k: "roro", name: "ro-ro" }
];

const points = [];
for (const [name, w] of byPoint) {
  const calls = [], cap = [];
  const mix = { cont: 0, tank: 0, bulk: 0, gen: 0, roro: 0 };
  let weeksWith = 0;
  for (const wk of weeks) {
    const a = w.get(wk);
    if (!a || !a.n) { calls.push(null); cap.push(null); continue; }
    weeksWith++;
    calls.push(Math.round(a.calls / a.n * 10) / 10);
    cap.push(Math.round(a.cap / a.n));
  }
  /* latest 28 days vs the 2019 mean, on transit calls */
  const i2019 = weeks.map((wk, i) => (wk.startsWith("2019") ? i : -1)).filter(i => i >= 0);
  const base = i2019.length
    ? i2019.map(i => calls[i]).filter(v => v != null)
    : [];
  const baseMean = base.length ? base.reduce((s, x) => s + x, 0) / base.length : null;
  const tail = calls.slice(-4).filter(v => v != null);
  const nowMean = tail.length ? tail.reduce((s, x) => s + x, 0) / tail.length : null;
  for (const wk of weeks.slice(-4)) {
    const a = w.get(wk);
    if (!a) continue;
    for (const t of TYPES) mix[t.k] += a[t.k];
  }
  const mixTotal = Object.values(mix).reduce((s, x) => s + x, 0) || 1;

  const m = metaByName.get(name) || {};
  points.push({
    name,
    lat: m.lat ? +(+m.lat).toFixed(2) : null,
    lon: m.lon ? +(+m.lon).toFixed(2) : null,
    calls, cap,
    base: baseMean == null ? null : +baseMean.toFixed(1),
    now: nowMean == null ? null : +nowMean.toFixed(1),
    change: baseMean && nowMean != null ? +((nowMean / baseMean - 1) * 100).toFixed(1) : null,
    mix: TYPES.map(t => ({ name: t.name, share: +(mix[t.k] / mixTotal).toFixed(3) })),
    capNow: (() => {
      const t = cap.slice(-4).filter(v => v != null);
      return t.length ? Math.round(t.reduce((s, x) => s + x, 0) / t.length) : null;
    })()
  });
}
points.sort((a, b) => (b.capNow || 0) - (a.capNow || 0));

/* ------------------------------------------------------------------ checks --- */
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}
const withBase = points.filter(p => p.change != null);
const worst = withBase.slice().sort((a, b) => a.change - b.change)[0];
const best = withBase.slice().sort((a, b) => b.change - a.change)[0];
const suez = points.find(p => p.name === "Suez Canal");
const panama = points.find(p => p.name === "Panama Canal");
const bab = points.find(p => p.name === "Bab el-Mandeb Strait");

const checks = [
  {
    label: "Coverage",
    value: `${points.length} chokepoints, ${weeks.length} weeks`,
    detail: `Daily records from ${minDate} to ${maxDate}, aggregated to Monday-start weeks. The first and last weeks are dropped because they are partial, which is the only cleaning applied.`
  },
  {
    label: "Units",
    value: "calls per day",
    detail: "Mean daily transit calls in each week, and carrying capacity in the same rows. Not tonnage of cargo carried — the capacity of the ships that passed, which is the closest public proxy for trade at this frequency."
  },
  {
    label: "Largest fall since 2019",
    value: worst ? `${worst.name} ${worst.change}%` : "n/a",
    detail: "Last four weeks against the 2019 mean of the same series. A fall here is either a closure, a diversion, or a drought; the data cannot tell you which, and the page does not pretend it can."
  },
  {
    label: "Largest rise since 2019",
    value: best ? `${best.name} ${best.change > 0 ? "+" : ""}${best.change}%` : "n/a",
    detail: "Usually the mirror image of a fall somewhere else: traffic that leaves one strait arrives at another. The Cape of Good Hope is the standing example."
  },
  {
    label: "The Red Sea, measured",
    value: bab ? `Bab el-Mandeb ${bab.change}%` : "n/a",
    detail: `Bab el-Mandeb at ${bab ? bab.now : "n/a"} calls a day against a 2019 mean of ${bab ? bab.base : "n/a"}. Suez is at ${suez ? suez.change : "n/a"}% and Panama at ${panama ? panama.change : "n/a"}% over the same window, for a completely different reason.`
  }
];

const out = {
  generated: STAMP,
  source: {
    name: "IMF PortWatch — daily chokepoint transit calls and shipment volume",
    url: DAILY_URL,
    meta: META_URL,
    licence: "Open, published on HDX"
  },
  span: { from: weeks[0], to: weeks[weeks.length - 1], weeks: weeks.length, firstDay: minDate, lastDay: maxDate },
  weeks,
  types: TYPES.map(t => t.name),
  points: points.map(p => ({
    name: p.name, lat: p.lat, lon: p.lon,
    calls: p.calls, cap: p.cap,
    base: p.base, now: p.now, change: p.change,
    mix: p.mix, capNow: p.capNow
  })),
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, points: out.points.length + " points" }, null, 2).slice(0, 1200));
} else {
  const body = `/* Generated by ingest-freight.mjs on ${STAMP}. Do not edit by hand.
   IMF PortWatch daily chokepoint traffic, ${points.length} chokepoints,
   ${weeks.length} weeks (${weeks[0]} to ${weeks[weeks.length - 1]}).
   Regenerate with: node ingest-freight.mjs                                     */
window.FREIGHT = ${JSON.stringify(out)};
`;
  fs.writeFileSync("freight-data.js", body);
  console.log(`wrote freight-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}
for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
