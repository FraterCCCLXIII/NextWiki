#!/usr/bin/env node
/*
 * ingest-information.mjs — how much of the world's attention is on the machine,
 * and what the information environment around it looks like.
 *
 *   node ingest-information.mjs          # fetch, derive, check, write
 *   node ingest-information.mjs --dry
 *
 * Four sources, each independently optional. That is deliberate: GDELT throttles
 * hard (one request every five seconds, enforced with a 429 that reads as a
 * 404 on some paths), and the Wikimedia and OWID endpoints never do. A page that
 * fails as a whole because one of four sources was busy would be a worse page
 * than one that names the missing panel and draws the other three, so each
 * source records its own status in `checks` and the app renders from whatever
 * arrived.
 *
 * Sources
 *   GDELT DOC 2.0        share of all monitored news mentioning a phrase, daily
 *   Wikimedia Pageviews  monthly per-article human views, and the enwiki total
 *   Our World in Data    V-Dem freedom of expression index; internet access
 *   Gallup / Pew / Edelman  trust in news, hand-entered, verified points only
 *
 * On the last of those: the "great deal or fair amount of trust in mass media"
 * question that goes back to the 1970s is GALLUP's. Pew's comparable series
 * begins in 2016 and asks "a lot or some trust", which is a different and easier
 * question. They are stored as two series and are never joined, because joining
 * them would invent a discontinuity as if it were a finding.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const UA = "oracle-lab-ingest/1.0 (+information page; hello@example.org)";

const checks = [];
function check(state, label, value, detail) {
  checks.push({ state, label, value, detail });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ fetch --- */

async function getText(url, tries = 3, gap = 4000) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": UA, "Accept": "*/*" }
      });
      if (res.ok) return await res.text();
      last = new Error(`${res.status} ${res.statusText} — ${url}`);
      /* 429 is the documented GDELT throttle; a 404 with a body about request
         limits is the same throttle wearing a different status. */
      if (res.status === 429 || res.status === 404 || res.status === 503) {
        await sleep(gap);
        gap = Math.min(gap * 1.6, 90000);
        continue;
      }
      throw last;
    } catch (e) {
      last = e;
      await sleep(gap);
      gap = Math.min(gap * 1.6, 90000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error("fetch failed: " + url);
}

/* ------------------------------------------------------------------ GDELT --- */

/* GDELT's DOC API returns the share of all monitored articles matching the
   query, as a percentage. That normalisation is the whole reason to use it:
   raw article counts rise with the number of outlets GDELT watches, so only
   the share is comparable across nine years. */
/* The window ends tomorrow, not at a hardcoded date: the first version of this
   stopped at 2026-01-01 because the constant was written once and never moved,
   which left eight months of the most interesting news on file out of the page. */
const NEWS_END = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replace(/-/g, "") + "235959";

async function gdelt(query, mode) {
  const url = "https://api.gdeltproject.org/api/v2/doc/doc"
    + "?query=" + encodeURIComponent(query)
    + "&mode=" + mode
    + "&format=json"
    + "&startdatetime=20170101000000"
    + "&enddatetime=" + NEWS_END;
  const body = await getText(url, 3, 20000);
  const d = JSON.parse(body);
  const line = d && d.timeline && d.timeline[0];
  if (!line || !line.data) throw new Error("GDELT returned no series for " + query);
  return line.data.map((p) => ({
    date: p.date.slice(0, 4) + "-" + p.date.slice(4, 6) + "-" + p.date.slice(6, 8),
    value: +p.value
  }));
}

/* GDELT is the one source here that punishes an impatient ingest, and a page
   rebuild should not cost eight minutes of backoff. Successes land in .cache/
   and are reused for a week; the age is recorded in the status so a stale panel
   says so instead of passing for a fresh one. */
const CACHE = ".cache";
fs.mkdirSync(CACHE, { recursive: true });

async function gdeltCached(key, query, mode, maxAgeDays) {
  const p = CACHE + "/gdelt-" + key + ".json";
  const have = fs.existsSync(p);
  const age = have ? (Date.now() - fs.statSync(p).mtimeMs) / 86400000 : null;
  if (have && age < maxAgeDays) {
    return { rows: JSON.parse(fs.readFileSync(p, "utf8")), how: "cached, " + age.toFixed(2) + " days old" };
  }
  try {
    const rows = await gdelt(query, mode);
    fs.writeFileSync(p, JSON.stringify(rows));
    return { rows, how: "fetched" };
  } catch (e) {
    /* A failed refresh must not remove a panel that already has nine years in
       it. The fallback is used and its staleness printed, so a stale series
       reads as stale rather than as current. */
    if (have) {
      return {
        rows: JSON.parse(fs.readFileSync(p, "utf8")),
        how: "stale snapshot " + age.toFixed(0) + " days old — refresh refused: " + e.message.split(" — ")[0],
        stale: true
      };
    }
    throw e;
  }
}

const news = { ai: [], climate: [], status: {} };
try {
  const g = await gdeltCached("ai-volume", '"artificial intelligence"', "timelinevol", 3);
  news.ai = g.rows;
  news.status.ai = "ok (" + g.how + ")";
} catch (e) {
  news.status.ai = "unavailable: " + e.message.split(" — ")[0];
}

/* The control series. Spaced twelve seconds, not the documented five: the limit
   is a token bucket, and two calls six seconds apart drew a 429 on the first
   attempt at this. */
await sleep(12000);
try {
  const g = await gdeltCached("climate-volume", '"climate change"', "timelinevol", 3);
  news.climate = g.rows;
  news.status.climate = "ok (" + g.how + ")";
} catch (e) {
  news.status.climate = "unavailable: " + e.message.split(" — ")[0];
}

if (news.climate.length) {
  check("ok", "GDELT control series", news.climate.length + " days",
    news.status.climate + " — a phrase that has been news the whole time, so the two shares can be read against each other");
}

function newsStats(rows) {
  if (!rows.length) return null;
  const vals = rows.map((r) => r.value).filter((v) => isFinite(v));
  const max = rows.reduce((a, r) => (r.value > a.value ? r : a), rows[0]);
  return {
    n: rows.length,
    from: rows[0].date,
    to: rows[rows.length - 1].date,
    first: +vals.slice(0, 30).reduce((s, v) => s + v, 0) / Math.min(30, vals.length),
    last: +vals.slice(-30).reduce((s, v) => s + v, 0) / Math.min(30, vals.length),
    max: { date: max.date, value: max.value }
  };
}
news.stats = newsStats(news.ai);
if (news.stats) {
  check("ok", "GDELT: days of news", String(news.stats.n),
    news.stats.from + " to " + news.stats.to + " at daily resolution");
  check("ok", "AI share of all monitored news",
    news.stats.first.toFixed(2) + "% → " + news.stats.last.toFixed(2) + "%",
    "first 30 days of 2017 against the last 30 days on file");
} else {
  check("warn", "GDELT: news share", "not retrieved",
    news.status.ai + " — the panel is drawn from the other three sources only");
}

/* ----------------------------------------------------------------- Wikimedia */

/* A basket rather than one article: any single page's views move with redirects,
   renames and search ranking, and a ten-page sum is much harder to move by
   accident. The denominator is every human view of English Wikipedia, so the
   result is a share of attention and not a volume that grows with the web. */
const BASKET = [
  "Artificial_intelligence",
  "Large_language_model",
  "ChatGPT",
  "OpenAI",
  "Generative_artificial_intelligence",
  "Machine_learning",
  "Deepfake",
  "Automation",
  "Universal_basic_income",
  "Artificial_general_intelligence"
];

const wiki = { months: [], basket: [], byArticle: {}, status: "ok" };

function monthRange(fromY, fromM, toY, toM) {
  const out = [];
  let y = fromY, m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    out.push(y + "-" + String(m).padStart(2, "0"));
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
wiki.months = monthRange(2016, 1, 2026, 11);

async function pageviews(article) {
  const url = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
    + "/en.wikipedia/all-access/user/" + encodeURIComponent(article)
    + "/monthly/2016010100/2026070100";
  try {
    const d = JSON.parse(await getText(url, 3, 3000));
    const by = {};
    for (const it of d.items || []) {
      by[it.timestamp.slice(0, 4) + "-" + it.timestamp.slice(4, 6)] = it.views;
    }
    return by;
  } catch (e) {
    return null;
  }
}

const missing = [];
for (const a of BASKET) {
  const by = await pageviews(a);
  if (!by) { missing.push(a); continue; }
  wiki.byArticle[a] = by;
  await sleep(200);
}
wiki.basket = wiki.months.map((mo) => {
  let s = 0, any = false;
  for (const a of Object.keys(wiki.byArticle)) {
    const v = wiki.byArticle[a][mo];
    if (v != null) { s += v; any = true; }
  }
  return any ? s : null;
});

/* Total human views of English Wikipedia, same months, same definition. */
let total = null;
try {
  const d = JSON.parse(await getText(
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate"
    + "/en.wikipedia/all-access/user/monthly/2016010100/2026070100", 3, 3000));
  const by = {};
  for (const it of d.items || []) {
    by[it.timestamp.slice(0, 4) + "-" + it.timestamp.slice(4, 6)] = it.views;
  }
  total = wiki.months.map((mo) => (by[mo] != null ? by[mo] : null));
} catch (e) {
  wiki.status = "partial: enwiki total unavailable";
}

wiki.total = total;
wiki.share = total
  ? wiki.months.map((mo, i) => {
      const b = wiki.basket[i], t = total[i];
      return b != null && t ? +((b / t) * 100).toFixed(4) : null;
    })
  : null;
/* Percent of eight billion rounds to 0.00 and reads as nothing. Views per ten
   thousand of all English Wikipedia views is the same number, legible. */
wiki.per10k = wiki.share ? wiki.share.map((v) => (v == null ? null : +(v * 100).toFixed(3))) : null;

/* Trim to the months both halves of the share exist, and drop a trailing partial
   month. The per-article endpoint and the aggregate endpoint do not publish on
   the same day, and the per-article one sometimes emits a stub for the month in
   progress: the first run of this ended on a month with 116,000 basket views
   against a full-month median near 3.5 million, which drew as a 97% collapse in
   attention. A month more than half below its own recent median is incomplete,
   whatever its timestamp says. */
function complete(i, arr) {
  const recent = [];
  for (let k = i - 1; k >= 0 && recent.length < 6; k--) if (arr[k] != null) recent.push(arr[k]);
  if (!recent.length || arr[i] == null) return false;
  recent.sort((a, b) => a - b);
  const med = recent[recent.length >> 1];
  return arr[i] >= med * 0.5;
}
let lastFull = -1;
wiki.months.forEach((mo, i) => {
  if (wiki.basket[i] != null && (!wiki.total || wiki.total[i] != null) && complete(i, wiki.basket)) lastFull = i;
});
const dropped = wiki.months.length - lastFull - 1;
for (const k of ["months", "basket", "total", "share", "per10k"]) {
  if (Array.isArray(wiki[k]) && lastFull >= 0) wiki[k] = wiki[k].slice(0, lastFull + 1);
}
wiki.droppedMonths = dropped;

const basketRows = Object.keys(wiki.byArticle).map((a) => {
  const vals = Object.values(wiki.byArticle[a]);
  return { article: a, views: vals.reduce((s, v) => s + v, 0) };
}).sort((a, b) => b.views - a.views);
wiki.basketTotal = basketRows.reduce((s, r) => s + r.views, 0);
wiki.leaders = basketRows.slice(0, 6).map((r) => ({
  article: r.article.replace(/_/g, " "),
  views: r.views,
  share: +((r.views / wiki.basketTotal) * 100).toFixed(1)
}));

const haveBasket = wiki.basket.filter((v) => v != null).length;
check(haveBasket === wiki.months.length ? "ok" : "warn", "Wikimedia: months with a basket total",
  haveBasket + " of " + wiki.months.length,
  Object.keys(wiki.byArticle).length + " of " + BASKET.length + " articles answered"
  + (missing.length ? " (missing: " + missing.join(", ") + ")" : ""));
if (wiki.per10k) {
  const i0 = wiki.per10k.findIndex((v) => v != null);
  const i1 = wiki.per10k.reduce((a, v, i) => (v != null ? i : a), 0);
  check("ok", "AI basket attention, per 10,000 Wikipedia views",
    wiki.per10k[i0].toFixed(2) + " → " + wiki.per10k[i1].toFixed(2),
    wiki.months[i0] + " against " + wiki.months[i1]
    + (dropped ? "; the last " + dropped + " months are incomplete in the source and are not drawn" : ""));
  check("ok", "Largest single article in the basket",
    wiki.leaders[0].share.toFixed(0) + "% of all basket views",
    wiki.leaders[0].article + " — attention to this subject is one page first and a field second");
}

/* ---------------------------------------------------------------- OWID CSVs */

async function csv(url) {
  const text = await getText(url, 3, 3000);
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    /* Entity names occasionally contain a comma. Splitting blind and then merging
       surplus cells from the left keeps the numeric tail aligned. Filtering empty
       cells instead would drop every row whose Code column is blank, which is most
       of them — the first draft of this did exactly that and lost 6,000 rows. */
    const cells = lines[i].split(",");
    while (cells.length > head.length) {
      cells[0] = cells[0] + "," + cells[1];
      cells.splice(1, 1);
    }
    for (let k = 0; k < cells.length; k++) cells[k] = cells[k].replace(/^"|"$/g, "").trim();
    if (cells.length < head.length) continue;
    const obj = {};
    head.forEach((h, k) => { obj[h.trim()] = cells[k]; });
    rows.push(obj);
  }
  return { head: head.map((h) => h.trim()), rows };
}

const foe = { years: [], picks: [], world: [], status: "ok" };
const net = { years: [], picks: [], world: [], status: "ok" };

const COUNTRY_PICKS = ["United States", "China", "India", "Brazil", "Russia", "Germany", "Nigeria", "Japan"];

try {
  const { head, rows } = await csv("https://ourworldindata.org/grapher/freedom-of-expression-index.csv");
  const col = head[head.length - 1].replace("World region according to OWID", "").trim()
    || "Freedom of expression index";
  const byEnt = new Map();
  for (const r of rows) {
    const y = +r.Year;
    const v = parseFloat(r[col]);
    if (!isFinite(y) || !isFinite(v)) continue;
    if (!byEnt.has(r.Entity)) byEnt.set(r.Entity, {});
    byEnt.get(r.Entity)[y] = v;
  }
  const allYears = new Set();
  byEnt.forEach((o) => Object.keys(o).forEach((y) => allYears.add(+y)));
  foe.years = [...allYears].sort((a, b) => a - b);

  for (const name of COUNTRY_PICKS) {
    const o = byEnt.get(name);
    if (!o) continue;
    foe.picks.push({
      name,
      values: foe.years.map((y) => (o[y] != null ? +o[y].toFixed(3) : null))
    });
  }
  /* No World row exists in V-Dem, so the mean is computed across countries. */
  foe.world = foe.years.map((y) => {
    let s = 0, n = 0;
    byEnt.forEach((o, ent) => {
      if (ent === "World" || o[y] == null) return;
      s += o[y]; n++;
    });
    return n ? +(s / n).toFixed(3) : null;
  });
  foe.countries = byEnt.size;
  check("ok", "V-Dem: countries with a freedom-of-expression score",
    String(foe.countries),
    foe.years[0] + " to " + foe.years[foe.years.length - 1] + ", mean across countries (no World row exists)");
} catch (e) {
  foe.status = "unavailable: " + e.message.split(" — ")[0];
  check("warn", "V-Dem freedom of expression", "not retrieved", foe.status);
}

try {
  const { head, rows } = await csv("https://ourworldindata.org/grapher/share-of-individuals-using-the-internet.csv");
  const col = head[head.length - 1];
  const byEnt = new Map();
  for (const r of rows) {
    const y = +r.Year;
    const v = parseFloat(r[col]);
    if (!isFinite(y) || !isFinite(v)) continue;
    if (!byEnt.has(r.Entity)) byEnt.set(r.Entity, {});
    byEnt.get(r.Entity)[y] = v;
  }
  const ys = new Set();
  byEnt.forEach((o) => Object.keys(o).forEach((y) => ys.add(+y)));
  net.years = [...ys].sort((a, b) => a - b);
  for (const name of COUNTRY_PICKS.concat(["World"])) {
    const o = byEnt.get(name);
    if (!o) continue;
    const vals = net.years.map((y) => (o[y] != null ? +o[y].toFixed(2) : null));
    if (name === "World") net.world = vals;
    else net.picks.push({ name, values: vals });
  }
  const w0 = net.world.findIndex((v) => v != null);
  const w1 = net.world.reduce((a, v, i) => (v != null ? i : a), 0);
  check("ok", "World share of people using the internet",
    net.world[w0].toFixed(1) + "% → " + net.world[w1].toFixed(1) + "%",
    net.years[w0] + " to " + net.years[w1] + " (World Bank via OWID)");
} catch (e) {
  net.status = "unavailable: " + e.message.split(" — ")[0];
  check("warn", "Internet access", "not retrieved", net.status);
}

/* ------------------------------------------------------------------- trust --- */

/* Hand-entered, and only points that were read from the pollster's own release.
   The gaps are the honest part: no interpolation, no "approximately", and the
   2016 Gallup reading of 32% followed by 45% in 2018 is real — the series
   bounces, which is why a straight line through it would be a fiction. */
const trust = {
  gallup: {
    wording: "How much trust and confidence do you have in the mass media when it comes to reporting the news fully, accurately and fairly? (great deal or fair amount)",
    source: "Gallup",
    url: "https://news.gallup.com/poll/695762/trust-media-new-low.aspx",
    points: [
      { year: 1972, pct: 68, conf: "verified" },
      { year: 1997, pct: 53, conf: "verified" },
      { year: 2004, pct: 44, conf: "verified" },
      { year: 2016, pct: 32, conf: "verified" },
      { year: 2018, pct: 45, conf: "verified" },
      { year: 2023, pct: 32, conf: "verified" },
      { year: 2024, pct: 31, conf: "verified" },
      { year: 2025, pct: 28, conf: "verified" }
    ],
    split2025: { dem: 51, ind: 27, rep: 8 }
  },
  pew: {
    wording: "How much trust do you have in the information you get from national news organizations? (a lot or some)",
    source: "Pew Research Center",
    url: "https://www.pewresearch.org/short-reads/2025/10/29/how-americans-trust-in-information-from-news-organizations-and-social-media-sites-has-changed-over-time/",
    points: [
      { year: 2016.1, pct: 76, conf: "verified" },
      { year: 2017.2, pct: 72, conf: "verified" },
      { year: 2018.2, pct: 71, conf: "verified" },
      { year: 2019.5, pct: 75, conf: "verified" },
      { year: 2019.9, pct: 65, conf: "verified" },
      { year: 2021.5, pct: 58, conf: "verified" },
      { year: 2022.6, pct: 61, conf: "verified" },
      { year: 2024.7, pct: 59, conf: "verified" },
      { year: 2025.2, pct: 67, conf: "verified" },
      { year: 2025.7, pct: 56, conf: "verified" },
      { year: 2026.7, pct: 62, conf: "verified" }
    ],
    split2026: { dem: 73, rep: 50, social: 38 }
  },
  edelman: {
    wording: "Trust in media as an institution to do what is right (9-point scale, top four boxes)",
    source: "Edelman Trust Barometer",
    url: "https://www.edelman.com/trust/2024/trust-barometer",
    points: [{ year: 2024, pct: 50, conf: "verified" }]
  }
};

const gN = trust.gallup.points.length, pN = trust.pew.points.length;
check("ok", "Trust points entered", gN + " Gallup, " + pN + " Pew",
  "verified against the pollsters' releases; no year is interpolated between them");
const bad = trust.gallup.points.concat(trust.pew.points).filter((p) => !(p.pct >= 0 && p.pct <= 100));
check(bad.length ? "warn" : "ok", "Trust values within range", bad.length ? bad.length + " out of range" : "all in 0–100",
  "a percentage outside 0–100 would mean a transcription error");

/* --------------------------------------------------------------- correlates */

/* The question the page exists to answer is whether the two halves of the
   information environment move together. They are measured in different units
   on different populations, so the only defensible statement is a rank
   correlation over the years both series cover, not a causal claim. */
function pearson(a, b) {
  const xs = [], ys = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] == null || b[i] == null) continue;
    xs.push(a[i]); ys.push(b[i]);
  }
  if (xs.length < 8) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx && dy ? +(num / Math.sqrt(dx * dy)).toFixed(3) : null;
}

let foeNetR = null;
if (foe.status === "ok" && net.status === "ok") {
  const years = foe.years.filter((y) => net.years.includes(y));
  const a = years.map((y) => foe.world[foe.years.indexOf(y)]);
  const b = years.map((y) => net.world[net.years.indexOf(y)]);

  /* Levels and first differences, both computed, because the level correlation
     between two trending series is almost always an artifact of the trends. This
     one came out at -0.92, which would be a dramatic finding if it were real: it
     says freedom of expression collapses as the internet spreads. Differencing
     removes the shared trend and is the only version worth quoting. */
  const pairs = [];
  for (let i = 1; i < years.length; i++) {
    if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
    pairs.push([a[i] - a[i - 1], b[i] - b[i - 1]]);
  }
  foeNetR = {
    r: pearson(a, b),
    n: years.filter((y, i) => a[i] != null && b[i] != null).length,
    diffR: pairs.length >= 8
      ? pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]))
      : null,
    diffN: pairs.length,
    years: [years[0], years[years.length - 1]]
  };
  if (foeNetR.r != null) {
    check("warn", "Freedom of expression against internet access, in levels",
      "r = " + foeNetR.r.toFixed(2) + " (n = " + foeNetR.n + ")",
      "both series trend, so this correlation is mostly the trend; reported only so the next line can be read against it");
  }
  if (foeNetR.diffR != null) {
    check("ok", "The same pair, differenced",
      "r = " + foeNetR.diffR.toFixed(2) + " (n = " + foeNetR.diffN + " year-on-year changes)",
      "with the shared trend removed the relationship is weak: internet adoption did not drive the freedom of expression decline");
  }
}

/* The denominator of the attention share is not constant, and its movement is
   part of the story rather than an inconvenience. */
if (wiki.total) {
  const t0 = wiki.total.find((v) => v != null);
  const tN = wiki.total.reduce((a, v) => (v != null ? v : a), null);
  check("ok", "English Wikipedia views, all articles",
    (t0 / 1e9).toFixed(2) + "B → " + (tN / 1e9).toFixed(2) + "B a month",
    "the audience that the AI share is a share of shrank " + Math.round((1 - tN / t0) * 100) + "% over the same decade");
}

/* ------------------------------------------------------------------- write --- */

const out = {
  asOf: STAMP,
  span: {
    news: news.stats ? news.stats.from + " – " + news.stats.to : null,
    wiki: wiki.months[0] + " – " + wiki.months[wiki.months.length - 1],
    foe: foe.status === "ok" ? foe.years[0] + " – " + foe.years[foe.years.length - 1] : null,
    net: net.status === "ok" ? net.years[0] + " – " + net.years[net.years.length - 1] : null,
    trust: "1972 – 2026"
  },
  news,
  wiki,
  foe,
  net,
  trust,
  foeNetR,
  checks,
  sources: [
    {
      name: "GDELT Project, DOC 2.0 API",
      what: "the share of all monitored news articles mentioning a phrase, daily",
      url: "https://api.gdeltproject.org/api/v2/doc/doc",
      note: "One request every five seconds, enforced with a 429. No key."
    },
    {
      name: "Wikimedia Pageviews API",
      what: "monthly human views per article and for English Wikipedia as a whole",
      url: "https://wikimedia.org/api/rest_v1/",
      note: "No key. 'all-access' includes mobile web, desktop and apps; bots are excluded by the 'user' agent filter."
    },
    {
      name: "V-Dem via Our World in Data",
      what: "freedom of expression index, 1789 to present",
      url: "https://ourworldindata.org/grapher/freedom-of-expression-index",
      note: "No World row; the mean across countries is computed here and labelled as a mean."
    },
    {
      name: "World Bank via Our World in Data",
      what: "share of the population using the internet",
      url: "https://ourworldindata.org/grapher/share-of-individuals-using-the-internet",
      note: "The World aggregate begins in 2005; nothing before that is filled in."
    },
    {
      name: "Gallup, Pew Research Center, Edelman",
      what: "trust in news, hand-entered",
      url: trust.gallup.url,
      note: "Two different questions. Gallup's 'great deal/fair amount' runs from 1972; Pew's 'a lot/some' from 2016. Plotted separately and never joined."
    }
  ]
};

if (!news.stats && foe.status !== "ok" && net.status !== "ok" && !wiki.basketTotal) {
  throw new Error("no source answered — refusing to write an empty data file");
}

const body = "/* Generated by ingest-information.mjs on " + STAMP + ". Do not edit. */\n"
  + "var INFORMATION = " + JSON.stringify(out) + ";\n"
  + "if (typeof window !== 'undefined') window.INFORMATION = INFORMATION;\n";

if (DRY) {
  console.log("dry run: " + body.length + " bytes, " + checks.length + " checks");
} else {
  fs.writeFileSync("information-data.js", body);
  console.log("wrote information-data.js — " + (body.length / 1024).toFixed(0) + " KB, "
    + checks.length + " checks");
}

for (const c of checks) {
  console.log("  [" + c.state + "] " + c.label + ": " + c.value + (c.detail ? "  — " + c.detail : ""));
}
if (news.stats) {
  console.log("  AI share went from " + news.stats.first.toFixed(2) + "% of all news to "
    + news.stats.last.toFixed(2) + "%, peak " + news.stats.max.value.toFixed(2) + "% on " + news.stats.max.date);
}
