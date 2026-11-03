#!/usr/bin/env node
/*
 * ingest-religion.mjs — how fast contemplative and post-conventional culture
 * is actually spreading, measured three ways.
 *
 *   node ingest-religion.mjs          # fetch, derive, check, write
 *   node ingest-religion.mjs --dry
 *
 * There is no instrument for "integral" or "nondual", so this page does not
 * pretend to measure them. What it can measure is the paper trail and the
 * reading: how many works per year mention a contemplative term, how many
 * people read about it, and — from the World Values Survey axes already in
 * the lab — where the post-conventional pool is demographically concentrated.
 *
 * Sources, all keyless:
 *   OpenAlex     works whose title or abstract mentions a term, by year
 *   Wikimedia    monthly pageviews, per article, against total enwiki views
 *   WVS + Gapminder (local files)  self-expression axis joined to population
 *
 * Everything is cached in .cache/religion so a re-run costs nothing and a
 * rate-limited run still writes what it has, with the gap named in checks.
 */

import fs from "node:fs";
import vm from "node:vm";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const CACHE = ".cache/religion";
fs.mkdirSync(CACHE, { recursive: true });

async function get(url, key, { tries = 3, wait = 4000 } = {}) {
  const file = `${CACHE}/${key}.json`;
  if (fs.existsSync(file)) {
    try {
      return { body: JSON.parse(fs.readFileSync(file, "utf8")), cached: true };
    } catch (e) { /* fall through to a fresh fetch */ }
  }
  let last;
  for (let t = 0; t < tries; t++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "oracle-lab-ingest/1.0 (+religion page; contact: local)" }
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = await res.json();
      fs.writeFileSync(file, JSON.stringify(body));
      clearTimeout(timer);
      return { body, cached: false };
    } catch (e) {
      clearTimeout(timer);
      last = e;
      await new Promise((r) => setTimeout(r, wait * (t + 1)));
    }
  }
  throw new Error(`${key}: ${last && last.message}`);
}

/* ---------------------------------------------------------------- research ---
   OpenAlex indexes title and abstract, so "meditation" here means a paper that
   talks about meditation somewhere — not a paper about meditation. That is the
   right breadth for a question about how much a term is in circulation, and the
   wrong breadth for a question about a field's size. The page says which.

   Terms are single tokens or quoted phrases. "integral theory" and "spiral
   dynamics" are quoted because unquoted "integral" is mostly calculus.        */

const TERMS = [
  { key: "meditation", q: "meditation", label: "meditation", color: "#a9c0b4" },
  { key: "mindfulness", q: "mindfulness", label: "mindfulness", color: "#8aa4be" },
  { key: "psychedelic", q: "psychedelic", label: "psychedelic", color: "#c4a373" },
  { key: "mystical", q: "%22mystical%20experience%22", label: "mystical experience", color: "#c28181" },
  { key: "nondual", q: "nondual", label: "nondual", color: "#a396b3" },
  { key: "integral", q: "%22integral%20theory%22", label: "integral theory", color: "#7fb3b0" },
  { key: "spiral", q: "%22spiral%20dynamics%22", label: "spiral dynamics", color: "#b8a06a" },
  { key: "metamodern", q: "metamodern", label: "metamodern", color: "#8f9aa6" }
];

const FAILED = [];
async function counts(term) {
  const url = `https://api.openalex.org/works?filter=title_and_abstract.search:${term.q}` +
    "&group_by=publication_year";
  const r = await get(url, `oa-${term.key}`);
  const by = {};
  for (const g of r.body.group_by || []) {
    const y = Number(g.key);
    if (Number.isFinite(y)) by[y] = g.count;
  }
  return { by, total: r.body.meta ? r.body.meta.count : null, cached: r.cached };
}

const research = [];
const yMin = 1950;
const yMax = new Date().getFullYear() - 2;   /* current year is always mid-index */

for (const term of TERMS) {
  try {
    const c = await counts(term);
    research.push({ ...term, by: c.by, total: c.total, cached: c.cached });
    console.log(`  openalex ${term.key}: ${c.total} works` + (c.cached ? " (cached)" : ""));
  } catch (e) {
    FAILED.push(term.key);
    console.log(`  openalex ${term.key}: FAILED — ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 350));
}

if (!research.length) throw new Error("no research series available");

const years = [];
for (let y = yMin; y <= yMax; y++) years.push(y);
const series = research.map((t) => ({
  key: t.key, label: t.label, color: t.color, total: t.total,
  v: years.map((y) => (t.by[y] == null ? 0 : t.by[y]))
}));

/* The denominator. Without it, "more papers" could just mean "more papers":
   world research output has grown several-fold over the same window. */
let allWorks = null;
try {
  const r = await get("https://api.openalex.org/works?group_by=publication_year", "oa-all");
  allWorks = {};
  for (const g of r.body.group_by || []) allWorks[Number(g.key)] = g.count;
} catch (e) {
  console.log("  openalex total: FAILED — " + e.message);
}
const allByYear = years.map((y) => (allWorks && allWorks[y] != null ? allWorks[y] : null));
const share = series.map((s) => ({
  key: s.key,
  v: s.v.map((n, i) => (allByYear[i] ? +((n / allByYear[i]) * 1e5).toFixed(2) : null))
}));

function fit(v, from) {
  /* least-squares slope of ln(count) over years with a positive count, then the
     doubling time. Zeros are excluded rather than fitted: a term introduced in
     2010 has no 1990 baseline, and a line through the zeros would report a
     spectacular rate that means nothing. Two windows are reported because they
     disagree in an informative way — a field grows fastest while it is small. */
  const pts = [];
  v.forEach((n, i) => { if (n > 0 && years[i] >= from) pts.push([years[i], Math.log(n)]); });
  if (pts.length < 6) return null;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  const slope = num / den;
  return slope > 0 ? +(Math.LN2 / slope).toFixed(1) : null;
}
const growth = series.map((s) => ({
  key: s.key, label: s.label,
  first: s.v.find((n) => n > 0) || null,
  last: s.v[s.v.length - 1],
  doubling: fit(s.v, 1950),          /* full record */
  doublingRecent: fit(s.v, 2000)     /* the last 25 years */
}));

/* ----------------------------------------------------------------- attention ---
   Reading, not believing. A Wikipedia article is a crude instrument, but the
   denominator is excellent: total English Wikipedia views are published, so a
   share can be computed and the collapse of the base (mobile, AI answers) can
   be seen rather than mistaken for a decline in interest.                     */

const ARTICLES = [
  { a: "Meditation", label: "meditation", group: "new" },
  { a: "Mindfulness", label: "mindfulness", group: "new" },
  { a: "Nonduality", label: "nonduality", group: "new" },
  { a: "Metamodernism", label: "metamodernism", group: "new" },
  { a: "Psychedelic_experience", label: "psychedelic experience", group: "new" },
  { a: "Near-death_experience", label: "near-death experience", group: "new" },
  { a: "Religion", label: "religion", group: "old" },
  { a: "Prayer", label: "prayer", group: "old" },
  { a: "Atheism", label: "atheism", group: "old" },
  { a: "Christianity", label: "christianity", group: "old" }
];

const START = "20150701";
const END = (() => {
  const d = new Date();
  /* last complete month */
  d.setUTCDate(1);
  const e = new Date(d.getTime() - 86400000);
  return e.toISOString().slice(0, 10).replace(/-/g, "");
})();

let totalViews = null;
try {
  const r = await get(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/en.wikipedia/all-access/user/monthly/${START}/${END}`,
    "wm-total");
  totalViews = r.body.items.map((i) => ({ m: i.timestamp.slice(0, 6), v: i.views }));
} catch (e) {
  console.log("  wikimedia total: FAILED — " + e.message);
}

const arts = [];
for (const a of ARTICLES) {
  try {
    const r = await get(
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/` +
      `${encodeURIComponent(a.a)}/monthly/${START}/${END}`, `wm-${a.a}`);
    arts.push({ ...a, views: r.body.items.map((i) => ({ m: i.timestamp.slice(0, 6), v: i.views })) });
    console.log(`  wikimedia ${a.label}: ${arts[arts.length - 1].views.length} months`);
  } catch (e) {
    FAILED.push(a.a);
    console.log(`  wikimedia ${a.a}: FAILED — ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 200));
}

let attention = null;
if (arts.length && totalViews) {
  const months = totalViews.map((t) => t.m).filter((m) => arts[0].views.some((v) => v.m === m));
  const totalBy = new Map(totalViews.map((t) => [t.m, t.v]));
  const seriesOut = arts.map((a) => {
    const by = new Map(a.views.map((v) => [v.m, v.v]));
    let rows = months.map((m) => (by.get(m) == null ? null : by.get(m)));
    /* a partial final month is the defect that keeps reappearing in this lab:
       116k views against a 3.5M median is not a decline, it is a truncated
       window. Drop any month whose total is under half the median total. */
    const med = median(totalViews.map((t) => t.v));
    while (rows.length && (totalBy.get(months[rows.length - 1]) || 0) < med * 0.5) {
      rows.pop();
    }
    return {
      label: a.label, group: a.group,
      views: rows,
      per10k: rows.map((v, i) => {
        const tot = totalBy.get(months[i]);
        return v == null || !tot ? null : +((v / tot) * 1e4).toFixed(3);
      })
    };
  });
  const keep = seriesOut[0].views.length;
  attention = {
    months: months.slice(0, keep),
    total: months.slice(0, keep).map((m) => totalBy.get(m)),
    series: seriesOut.map((s) => ({ ...s, views: s.views.slice(0, keep), per10k: s.per10k.slice(0, keep) }))
  };
}

function median(a) {
  const s = a.filter((v) => v != null).slice().sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}

/* ---------------------------------------------------------------- where ---
   The World Values Survey's self-expression axis is not a stage measure. But it
   is the best-measured cultural variable in the lab, and it correlates with the
   things stage models claim to see. So: map it, anchor the map to the only
   published US estimate (Cook-Greuter's ~10% post-conventional), multiply by
   population, and label the result derived. The point is not the exact count.
   It is that the arithmetic puts the largest pool somewhere most readers of
   integral theory would not guess.                                            */

function loadLocal(file, globalName) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(file, "utf8"), ctx);
  return ctx.window[globalName];
}
const CULT = loadLocal("culture-data.js", "CULTURE");
const GAP = loadLocal("gapminder-data.js", "GAP");

const norm = (s) => s.toLowerCase()
  .replace(/\bthe\b/g, "").replace(/&/g, "and")
  .replace(/[^a-z]/g, "");
const ALIAS = {
  "unitedstatesofamerica": "usa", "unitedstates": "usa", "usa": "usa",
  "southkorea": "kor", "korea": "kor", "northkorea": "prk",
  "russia": "rus", "russianfederation": "rus",
  "iran": "irn", "iranislamicrepublicof": "irn",
  "egypt": "egy", "egyptarabrepublic": "egy",
  "vietnam": "vnm", "vietnamdemocraticrepublic": "vnm",
  "czechrepublic": "cze", "czechia": "cze",
  "slovakrepublic": "svk", "slovakia": "svk",
  "turkey": "tur", "turkiye": "tur",
  "germany": "deu", "westgermany": "deu", "eastgermany": "deu",
  "serbia": "srb", "bosniaandherzegovina": "bih",
  "hongkong": "hkg", "hongkongsar": "hkg",
  "macau": "mac", "macaosar": "mac",
  "dominicanrepublic": "dom", "puertorico": "pri",
  "trinidadandtobago": "tto", "unitedarabemirates": "are",
  "newzealand": "nzl", "southafrica": "zaf",
  "ivorycoast": "civ", "cotedivoire": "civ",
  "macedonia": "mkd", "northmacedonia": "mkd",
  "burkinafaso": "bfa", "capeverde": "cpv",
  "kyrgyzstan": "kgz", "kyrgyzrepublic": "kgz",
  "laos": "lao", "laopeoplesdemocraticrepublic": "lao",
  "moldova": "mda", "republicofmoldova": "mda",
  "tanzania": "tza", "unitedrepublicoftanzania": "tza",
  "venezuela": "ven", "bolivarianrepublicofvenezuela": "ven",
  "syria": "syr", "syrianarabrepublic": "syr",
  "yemen": "yem", "yemenrepublic": "yem",
  "gambia": "gmb", "thegambia": "gmb",
  "bahrain": "bhr", "kuwait": "kwt", "qatar": "qat", "oman": "omn"
};

const gapByIso = new Map();
const gapByName = new Map();
GAP.countries.forEach((c, i) => {
  gapByIso.set(c.id, { c, i });
  gapByName.set(norm(c.name), { c, i });
});

const popYearIdx = GAP.years.length - 1;
const popYear = GAP.years[popYearIdx];

/* x is the survival/self-expression axis in this recomputation (the US sits at
   +1.18 on x and -0.41 on y, which is high self-expression and low
   secular-rational — the opposite of what a casual reading of the axes assumes). */
const X0 = 0, SCALE = 0.5;
const L = (x) => 1 / (1 + Math.exp(-(x - X0) / SCALE));
const US = CULT.wvs.countries.find((c) => /United States/i.test(c.c));
const usShare = 0.10;                      /* Cook-Greuter, US mixed adults */
const usL = US ? L(US.x) : L(1.177);
const shareOf = (x) => (L(x) / usL) * usShare;

const ADULT_SHARE = 0.78;   /* adults as a share of total population, world, 2019 */
const where = [];
let matched = 0;
for (const c of CULT.wvs.countries) {
  const key = norm(c.c);
  const hit = gapByIso.get(ALIAS[key]) || gapByName.get(key) ||
    gapByName.get(norm(c.c).replace(/republic$/, ""));
  const pop = hit ? GAP.pop[hit.i][popYearIdx] : null;
  if (!hit || !pop) continue;   /* unmatched is counted, never invented */
  matched++;
  const sh = shareOf(c.x);
  const adults = pop * ADULT_SHARE;
  where.push({
    c: c.c, iso: hit.c.id, zone: c.z,
    se: +c.x.toFixed(2), trad: +c.y.toFixed(2),
    pop: +(pop / 1e6).toFixed(0),             /* millions of people */
    share: +(sh * 100).toFixed(2),
    adults: +(sh * adults / 1e6).toFixed(2)   /* millions of post-conventional adults */
  });
}
where.sort((a, b) => b.adults - a.adults);

/* ------------------------------------------------------------------- checks ---
   Each check is a claim the page makes in prose. The ingest computes it so the
   prose cannot drift from the data.                                           */

const checks = [];
const medSrc = series.find((s) => s.key === "meditation");
const mindSrc = series.find((s) => s.key === "mindfulness");
checks.push({
  label: "Research series available",
  value: `${series.length} of ${TERMS.length} terms`,
  detail: FAILED.length
    ? "Missing: " + FAILED.join(", ") + ". Each failed term is absent from the chart rather than drawn as a zero."
    : "Every term returned a yearly series from OpenAlex. Counts index title and abstract, so a paper that mentions a term once is counted."
});
if (medSrc) {
  const a = medSrc.v.find((n) => n > 0), b = medSrc.v[medSrc.v.length - 1];
  checks.push({
    label: "Meditation papers, first year to last",
    value: `${a} (${years[medSrc.v.indexOf(a)]}) → ${b} (${years[years.length - 1]})`,
    detail: "Works mentioning meditation in title or abstract, per year. The first non-zero year is not the first paper ever; it is the first year inside the window with an indexed match."
  });
}
if (mindSrc) {
  const y2000 = mindSrc.v[years.indexOf(2000)];
  const yLast = mindSrc.v[mindSrc.v.length - 1];
  checks.push({
    label: "Mindfulness output, 2000 to last",
    value: `${y2000} → ${yLast} (${(yLast / Math.max(1, y2000)).toFixed(0)}×)`,
    detail: "A published bibliometric count (Baminiwatta & Solangaarachchi 2021) gives 23.5% a year for mindfulness publications, a 3.0-year doubling. The fitted rate here is the independent check on that figure."
  });
}
if (allWorks) {
  const cover = allByYear.filter((v) => v != null).length;
  checks.push({
    label: "Research denominator",
    value: `${cover} years, ${(allByYear[allByYear.length - 1] / 1e6).toFixed(2)}M works in ${years[years.length - 1]}`,
    detail: "OpenAlex total works per publication year. Shown so a rising count can be read against rising output overall: the share column is the one that answers whether a term is gaining ground."
  });
} else {
  checks.push({
    label: "Research denominator",
    value: "unavailable",
    detail: "The all-works grouping failed, so the page shows counts and no share. A count without a denominator overstates growth."
  });
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceMonth = (m) => MON[+String(m).slice(4, 6) - 1] + " " + String(m).slice(0, 4);
if (attention) {
  const first = niceMonth(attention.months[0]), last = niceMonth(attention.months[attention.months.length - 1]);
  checks.push({
    label: "Attention window",
    value: `${first} to ${last} · ${attention.months.length} months · ${attention.series.length} of ${ARTICLES.length} articles`,
    detail: "Monthly pageviews for each article against total English Wikipedia views. The final month is dropped if its total falls under half the median, which is the signature of a partial month rather than a collapse in reading." +
      (FAILED.length ? " Unavailable at ingest: " + FAILED.join(", ") + " — omitted from the chart rather than drawn flat." : "")
  });
  const base = attention.total[0], end = attention.total[attention.total.length - 1];
  checks.push({
    label: "The denominator moved",
    value: `${(base / 1e9).toFixed(2)}B → ${(end / 1e9).toFixed(2)}B monthly views`,
    detail: "English Wikipedia's total view count, which is the base of every per-10,000 figure. A rise in a topic's share can be a fall in the base; both lines are drawn so the two cannot be confused."
  });
} else {
  checks.push({ label: "Attention", value: "unavailable", detail: "Wikimedia requests failed; the page omits the panel rather than drawing an empty axis." });
}
checks.push({
  label: "Country pool",
  value: `${matched} of ${CULT.wvs.countries.length} matched`,
  detail: `WVS countries joined to Gapminder population for ${popYear}. Unmatched countries are excluded from the ranking and from the total, so the total is a floor, not an estimate of the world.`
});
const poolTotal = where.reduce((a, w) => a + w.adults, 0);
checks.push({
  label: "Post-conventional pool",
  value: `${poolTotal.toFixed(0)}M adults across ${where.length} countries`,
  detail: `Derived, not measured: a logistic map of the WVS self-expression axis anchored to Cook-Greuter's ~${Math.round(usShare * 100)}% US estimate, times adults (${Math.round(ADULT_SHARE * 100)}% of population). The anchor is one published estimate from one sample; the country ordering is more trustworthy than the level.`
});

/* --------------------------------------------------------------------- out --- */

const out = {
  generated: STAMP,
  source: {
    research: {
      name: "OpenAlex",
      url: "https://openalex.org/",
      note: "Works whose title or abstract contains the term, counted by publication year. Keyless; counts are of works, not of quality or citation."
    },
    attention: {
      name: "Wikimedia Pageviews API",
      url: "https://wikimedia.org/api/rest_v1/",
      note: "Monthly pageviews for ten English Wikipedia articles against total English Wikipedia views. Human traffic only (agent=user)."
    },
    where: {
      name: "World Values Survey axes (via culture-data.js) + Gapminder population",
      url: "https://www.worldvaluessurvey.org/",
      note: "Self-expression coordinate recomputed in ingest-culture.mjs; population from Gapminder's 2019 release. The stage mapping is this page's own construction."
    }
  },
  years,
  research: { series: series.map((s) => ({ key: s.key, label: s.label, color: s.color, total: s.total, v: s.v })), }
  ,
  shareByYear: { years, total: allByYear, series: share },
  growth,
  attention,
  where: {
    year: popYear,
    countries: where,
    total: +poolTotal.toFixed(1),
    us: where.find((w) => w.iso === "usa") || null,
    usShare,
    adultShare: ADULT_SHARE,
    scale: SCALE
  },
  failed: FAILED,
  checks
};

if (DRY) {
  console.log(JSON.stringify({ ...out, research: "omitted", attention: "omitted" }, null, 2));
} else {
  const body = `/* Generated by ingest-religion.mjs on ${STAMP}. Do not edit by hand.
   ${series.length} OpenAlex term series ${years[0]}-${years[years.length - 1]},
   ${attention ? attention.months.length + " months of pageviews, " : ""}${where.length} countries.
   Regenerate with:  node ingest-religion.mjs                               */
window.RELIGION_DATA = ${JSON.stringify(out)};
`;
  fs.writeFileSync("religion-data.js", body);
  console.log(`wrote religion-data.js  (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
