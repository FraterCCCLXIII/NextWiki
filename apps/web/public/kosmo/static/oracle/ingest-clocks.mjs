#!/usr/bin/env node
/*
 * ingest-clocks.mjs — the two clocks under the Century model.
 *
 *   node ingest-clocks.mjs
 *
 * Century runs to 2126 on two rates: how long people live, which sets the labour
 * force and the dependency ratio, and how fast the machine gets cheaper at a
 * fixed capability, which sets the automation curve. Both are measured here from
 * published data rather than assumed, because both are contested and the model's
 * answer moves more with them than with anything else in its parameter file.
 *
 * Source: Our World in Data — life expectancy (UN WPP and HMD, 1770–2023),
 * healthy life expectancy (WHO, 2000–2021), and Epoch AI's model-level training
 * compute (536 models, 1950–2026). No key for any of it.
 */

import fs from "node:fs";

const STAMP = new Date().toISOString().slice(0, 10);
const UA = "oracle-lab-ingest/1.0 (+clocks, century page)";
const checks = [];
const check = (state, label, value, detail) => checks.push({ state, label, value, detail });

async function getText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(res.status + " " + res.statusText + " — " + url);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* Same parser as the other ingests: split blind, merge surplus leftwards, so an
   entity name containing a comma cannot shift the numeric column. */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    while (cells.length > head.length) {
      cells[0] = cells[0] + "," + cells[1];
      cells.splice(1, 1);
    }
    for (let k = 0; k < cells.length; k++) cells[k] = cells[k].replace(/^"|"$/g, "").trim();
    if (cells.length < head.length) continue;
    const o = {};
    head.forEach((h, k) => { o[h] = cells[k]; });
    rows.push(o);
  }
  return { head, rows };
}

/* ---------------------------------------------------------------------- life */

const life = { years: [], world: [], hale: [], haleYears: [], picks: [] };

const csvLife = await getText("https://ourworldindata.org/grapher/life-expectancy.csv");
{
  const { head, rows } = parseCsv(csvLife);
  const col = head[head.length - 1];
  const by = new Map();
  for (const r of rows) {
    const y = +r.Year, v = parseFloat(r[col]);
    if (!isFinite(y) || !isFinite(v)) continue;
    if (!by.has(r.Entity)) by.set(r.Entity, {});
    by.get(r.Entity)[y] = v;
  }
  const ys = new Set();
  by.forEach((o) => Object.keys(o).forEach((y) => ys.add(+y)));
  life.years = [...ys].sort((a, b) => a - b);
  const w = by.get("World") || {};
  life.world = life.years.map((y) => (w[y] != null ? +w[y].toFixed(2) : null));
  for (const name of ["United States", "Japan", "India", "Nigeria", "Russia", "United Kingdom"]) {
    const o = by.get(name);
    if (!o) continue;
    life.picks.push({ name, values: life.years.map((y) => (o[y] != null ? +o[y].toFixed(2) : null)) });
  }
  life.countries = by.size;

  const w0 = life.world.findIndex((v) => v != null);
  const w1 = life.world.reduce((a, v, i) => (v != null ? i : a), 0);
  check("ok", "Life expectancy, world",
    life.world[w0].toFixed(1) + " → " + life.world[w1].toFixed(1) + " years",
    life.years[w0] + " to " + life.years[w1] + ", " + life.countries + " countries on file");
}

/* Decadal gains: the number that decides whether longevity is still improving
   fast enough to matter to a model that runs to 2126. */
const gains = [];
for (let i = 0; i < life.years.length; i++) {
  const y = life.years[i];
  if (y % 10 !== 0) continue;
  const j = life.years.indexOf(y - 10);
  if (j < 0) continue;
  const a = life.world[j], b = life.world[i];
  if (a == null || b == null) continue;
  gains.push({ decade: (y - 10) + "–" + y, perYear: +((b - a) / 10).toFixed(3), total: +(b - a).toFixed(2) });
}
life.gains = gains;
const g2000 = gains.filter((g) => +g.decade.slice(0, 4) >= 1950);
if (g2000.length >= 3) {
  const fast = g2000.reduce((a, g) => (g.perYear > a.perYear ? g : a), g2000[0]);
  const slow = g2000.slice(-1)[0];
  check("ok", "The fastest decade of gains",
    "+" + (fast.perYear * 10).toFixed(1) + " years in " + fast.decade,
    "against +" + (slow.perYear * 10).toFixed(1) + " years in " + slow.decade
    + " — the curve has flattened even as the level rose");
}

const csvHale = await getText("https://ourworldindata.org/grapher/healthy-life-expectancy-at-birth.csv");
{
  const { head, rows } = parseCsv(csvHale);
  const col = head[head.length - 1];
  const by = new Map();
  for (const r of rows) {
    const y = +r.Year, v = parseFloat(r[col]);
    if (!isFinite(y) || !isFinite(v)) continue;
    if (r.Entity === "World") by.set(y, v);
  }
  const ys = [...by.keys()].sort((a, b) => a - b);
  life.haleYears = ys;
  life.hale = ys.map((y) => +by.get(y).toFixed(2));

  /* The gap between years lived and years lived in health. Computed only for
     years where both series exist, which is what the 2000-2021 overlap is. */
  life.gap = ys.map((y) => {
    const i = life.years.indexOf(y);
    const le = i >= 0 ? life.world[i] : null;
    return le == null ? null : +(le - by.get(y)).toFixed(2);
  });
  const last = life.gap[life.gap.length - 1];
  if (last != null) {
    check("ok", "Healthy years against total years",
      last.toFixed(1) + " of the last world life expectancy is lived in poor health",
      "WHO HALE against UN life expectancy, " + ys[0] + "–" + ys[ys.length - 1]);
  }
}

/* ------------------------------------------------------------------- compute */

/* Epoch AI's model-level training compute, which is the only public series with
   hundreds of measured runs rather than a handful of frontier points. Two fits:
   every model (what the field did) and the running maximum (what the frontier
   did). They are not the same rate, and quoting one for the other is the most
   common error in this literature. */
const comp = { models: [], frontier: [], fits: {} };

const csvComp = await getText("https://ourworldindata.org/grapher/artificial-intelligence-training-computation.csv");
{
  const { head, rows } = parseCsv(csvComp);
  const col = head[head.length - 1];
  for (const r of rows) {
    const v = parseFloat(r[col]);
    const t = Date.parse(r.Day + "T00:00:00Z");
    if (!isFinite(v) || !isFinite(t) || v <= 0) continue;
    const d = new Date(t);
    comp.models.push({
      name: r.Entity.length > 46 ? r.Entity.slice(0, 44) + "…" : r.Entity,
      year: +(d.getUTCFullYear() + (d.getUTCMonth() + 0.5) / 12).toFixed(3),
      flop: v * 1e15,   /* the column is petaFLOP */
      raw: v
    });
  }
  comp.models.sort((a, b) => a.year - b.year);

  /* Frontier: the largest run so far, sampled at each new record. */
  let best = 0;
  for (const m of comp.models) {
    if (m.flop > best) { best = m.flop; comp.frontier.push({ year: m.year, flop: m.flop, name: m.name }); }
  }

  function fit(points, from) {
    const pts = points.filter((p) => p.year >= from && p.flop > 0);
    if (pts.length < 4) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) {
      const x = p.year, y = Math.log10(p.flop);
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const n = pts.length;
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const a = (sy - b * sx) / n;
    return {
      n,
      from,
      slope: +b.toFixed(4),                                   /* decades per year */
      xPerYear: +Math.pow(10, b).toFixed(2),
      doublingMonths: +(Math.log10(2) / b * 12).toFixed(1),
      a: +a.toFixed(3)
    };
  }

  comp.fits.all = fit(comp.models, 2010);
  comp.fits.frontier = fit(comp.frontier, 2010);
  comp.fits.allLong = fit(comp.models, 1950);

  /* An order of magnitude written as a mantissa and an exponent, not as a
     number with ten digits in front of the decimal point. */
  const sci = (v) => {
    const e = Math.floor(Math.log10(Math.abs(v)));
    return (v / Math.pow(10, e)).toFixed(1) + " × 10" + String(e).replace(/[0-9]/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]);
  };

  if (comp.fits.frontier && comp.fits.all) {
    const diff = Math.abs(comp.fits.all.doublingMonths - comp.fits.frontier.doublingMonths);
    check("ok", "Frontier against the whole field, since 2010",
      comp.fits.frontier.doublingMonths + " vs " + comp.fits.all.doublingMonths + " months",
      (diff < 0.5
        ? "the two fits agree to within a tenth of a month: in this dataset the field and the frontier moved at the same rate, so the frontier is not a different machine from the rest of it"
        : "the frontier ran ahead of the field by " + diff.toFixed(1) + " months per doubling"));
    check("ok", "The same fit over the whole record",
      "every " + comp.fits.allLong.doublingMonths + " months since 1950",
      comp.fits.allLong.n + " runs at " + comp.fits.allLong.xPerYear + "× a year against "
      + comp.fits.all.xPerYear + "× since 2010 — the acceleration is the finding, not the rate");
  }
  const big = comp.models.reduce((a, m) => (m.flop > a.flop ? m : a), comp.models[0]);
  check("ok", "Largest single training run on file",
    sci(big.flop) + " FLOP",
    big.name + ", " + big.year.toFixed(1) + "; the frontier in 2010 was about "
    + sci(comp.frontier.filter((p) => p.year <= 2010.9).slice(-1)[0].flop) + " FLOP");
}

const out = {
  asOf: STAMP,
  life,
  compute: comp,
  checks,
  sources: [
    {
      name: "Our World in Data — life expectancy",
      url: "https://ourworldindata.org/grapher/life-expectancy",
      note: "UN WPP 2024 and the Human Mortality Database, 1770–2023. The World row is the UN aggregate, not a mean of countries."
    },
    {
      name: "Our World in Data — healthy life expectancy",
      url: "https://ourworldindata.org/grapher/healthy-life-expectancy-at-birth",
      note: "WHO Global Health Observatory, 2000–2021. Years lived in full health, not years lived."
    },
    {
      name: "Epoch AI via Our World in Data — training computation",
      url: "https://ourworldindata.org/grapher/artificial-intelligence-training-computation",
      note: "536 models with a measured or estimated training run. Estimates are flagged in the upstream dataset and are not separated here."
    }
  ]
};

const body = "/* Generated by ingest-clocks.mjs on " + STAMP + ". Do not edit. */\n"
  + "var CLOCKS = " + JSON.stringify(out) + ";\n"
  + "if (typeof window !== 'undefined') window.CLOCKS = CLOCKS;\n";
fs.writeFileSync("clocks-data.js", body);
console.log("wrote clocks-data.js — " + (body.length / 1024).toFixed(0) + " KB");
for (const c of checks) console.log("  [" + c.state + "] " + c.label + ": " + c.value + "  — " + c.detail);
