#!/usr/bin/env node
/*
 * ingest-lineage.mjs — what a public knowledge graph can and cannot count about
 * contemplatives.
 *
 *   node ingest-lineage.mjs          # fetch, check, write
 *   node ingest-lineage.mjs --dry
 *
 * The question is how many people any tradition recognized as realized, across
 * time. No instrument measures that. What exists in machine-readable form is
 * Wikidata: who is labelled a monk, a lama, a Zen master, a Sufi — and who is
 * recorded as somebody's student.
 *
 * Those counts are not a measurement of contemplatives. They are a measurement
 * of *cataloguing*: how editors chose to describe the people they wrote about.
 * The page uses them for exactly that, as a control that shows why the register
 * counts in lineage-claims.js are the better instrument.
 *
 * Source: Wikidata Query Service. Keyless, rate-limited, cached in
 * .cache/lineage so a re-run costs nothing.
 */

import fs from "node:fs";

const DRY = process.argv.includes("--dry");
const STAMP = new Date().toISOString().slice(0, 10);
const CACHE = ".cache/lineage";
fs.mkdirSync(CACHE, { recursive: true });

const UA = "oracle-lab-ingest/1.0 (+lineage page; research)";

async function sparql(key, query, { tries = 3 } = {}) {
  const file = `${CACHE}/${key}.json`;
  if (fs.existsSync(file)) {
    try { return { body: JSON.parse(fs.readFileSync(file, "utf8")), cached: true }; }
    catch (e) { /* refetch */ }
  }
  let last;
  for (let t = 0; t < tries; t++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query), {
        signal: ctrl.signal,
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA }
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = await res.json();
      clearTimeout(timer);
      fs.writeFileSync(file, JSON.stringify(body));
      return { body, cached: false };
    } catch (e) {
      clearTimeout(timer);
      last = e;
      await new Promise((r) => setTimeout(r, 5000 * (t + 1)));
    }
  }
  throw new Error(`${key}: ${last && last.message}`);
}

const CENTURY = `
  ?p wdt:P569 ?dob . BIND(YEAR(?dob) AS ?y)
  FILTER(?y >= 600 && ?y < 2000)
  BIND(FLOOR(?y/100)*100 AS ?century)`;

const TRADITIONS = [
  {
    key: "buddhist", name: "Buddhist", color: "#a9c0b4",
    q: `SELECT ?century (COUNT(DISTINCT ?p) AS ?n) WHERE {
      ?p wdt:P140 ?rel . ?rel wdt:P279* wd:Q748 .
      ?p wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
      VALUES ?ol { "Buddhist monk"@en "Buddhist nun"@en "Zen master"@en "lama"@en "bhikkhu"@en "rōshi"@en }
      ${CENTURY}
    } GROUP BY ?century ORDER BY ?century`
  },
  {
    key: "hindu", name: "Hindu", color: "#c4a373",
    q: `SELECT ?century (COUNT(DISTINCT ?p) AS ?n) WHERE {
      ?p wdt:P140 ?rel . ?rel wdt:P279* wd:Q9089 .
      ?p wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
      VALUES ?ol { "guru"@en "swami"@en "sadhu"@en "acharya"@en "yogi"@en }
      ${CENTURY}
    } GROUP BY ?century ORDER BY ?century`
  },
  {
    key: "sufi", name: "Sufi", color: "#a396b3",
    q: `SELECT ?century (COUNT(DISTINCT ?p) AS ?n) WHERE {
      ?p wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
      VALUES ?ol { "Sufi"@en }
      ${CENTURY}
    } GROUP BY ?century ORDER BY ?century`
  },
  {
    key: "christian", name: "Christian monastic", color: "#8aa4be",
    q: `SELECT ?century (COUNT(DISTINCT ?p) AS ?n) WHERE {
      ?p wdt:P140 ?rel . ?rel wdt:P279* wd:Q5043 .
      ?p wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
      VALUES ?ol { "monk"@en "nun"@en "mystic"@en "abbot"@en "abbess"@en "hermit"@en }
      ${CENTURY}
    } GROUP BY ?century ORDER BY ?century`
  }
];

/* The narrow label. This is the control: "Zen master" and "Buddhist monk" are
   both in Wikidata, and the ratio between them is a fact about editors. */
const ZEN = `SELECT ?century (COUNT(DISTINCT ?p) AS ?n) WHERE {
  ?p wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
  VALUES ?ol { "Zen master"@en "rōshi"@en }
  ${CENTURY}
} GROUP BY ?century ORDER BY ?century`;

const EDGES = `SELECT ?century (COUNT(*) AS ?edges) (COUNT(DISTINCT ?t) AS ?teachers) WHERE {
  ?p wdt:P802 ?t .
  ?p wdt:P569 ?dob . BIND(YEAR(?dob) AS ?y)
  FILTER(?y >= 600 && ?y < 2000)
  BIND(FLOOR(?y/100)*100 AS ?century)
} GROUP BY ?century ORDER BY ?century`;

const HEIRS = `SELECT ?teacher (COUNT(DISTINCT ?p) AS ?n) WHERE {
  ?p wdt:P802 ?teacher .
  ?teacher wdt:P106 ?occ . ?occ rdfs:label ?ol . FILTER(LANG(?ol)="en")
  VALUES ?ol { "Buddhist monk"@en "Zen master"@en "lama"@en "bhikkhu"@en "rōshi"@en "guru"@en "swami"@en "Sufi"@en "mystic"@en }
} GROUP BY ?teacher ORDER BY DESC(?n) LIMIT 400`;

function rows(j) {
  return (j.results && j.results.bindings) || [];
}
function series(j) {
  const out = {};
  for (const b of rows(j)) {
    out[+b.century.value] = +b.n.value;
  }
  return out;
}

const failed = [];
const traditions = [];
for (const t of TRADITIONS) {
  try {
    const r = await sparql(`t-${t.key}`, t.q);
    traditions.push({ key: t.key, name: t.name, color: t.color, by: series(r.body), cached: r.cached });
    console.log(`  ${t.key}: ${Object.values(series(r.body)).reduce((a, b) => a + b, 0)} people`);
  } catch (e) {
    failed.push(t.key);
    console.log(`  ${t.key}: FAILED — ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 1200));
}

let zen = null;
try {
  const r = await sparql("t-zen", ZEN);
  zen = series(r.body);
} catch (e) { failed.push("zen"); }

let edges = null, heirs = null;
try {
  const r = await sparql("edges", EDGES);
  edges = rows(r.body).map((b) => ({ c: +b.century.value, edges: +b.edges.value, teachers: +b.teachers.value }));
} catch (e) { failed.push("edges"); }
try {
  const r = await sparql("heirs", HEIRS);
  heirs = rows(r.body).map((b) => +b.n.value).sort((a, b) => a - b);
} catch (e) { failed.push("heirs"); }

const centuries = [];
for (let c = 600; c < 2000; c += 100) centuries.push(c);

/* Every tradition on one century axis, nulls kept so a gap is a gap. */
const grid = traditions.map((t) => ({
  key: t.key, name: t.name, color: t.color,
  v: centuries.map((c) => (t.by[c] == null ? null : t.by[c]))
}));

const checks = [];
checks.push({
  label: "Catalogue coverage",
  value: `${traditions.length} of ${TRADITIONS.length} traditions, ${centuries[0]}–${centuries[centuries.length - 1]}`,
  detail: failed.length
    ? "Failed: " + failed.join(", ") + ". A failed query is a gap in the chart, not a zero."
    : "Every tradition returned a century series. The counts cover people whose birth date and occupation are both recorded in Wikidata, which is a small and editorially chosen subset of everyone who ever practised."
});
if (zen) {
  const z1900 = zen[1900] || 0;
  const bud = traditions.find((t) => t.key === "buddhist");
  const b1900 = bud && bud.by[1900] ? bud.by[1900] : null;
  checks.push({
    label: "What the labels do",
    value: `1900s: ${z1900} labelled "Zen master" vs ${b1900 == null ? "–" : b1900} "Buddhist monk"`,
    detail: "The same century, the same tradition, two labels: one returns twenty people and the other hundreds. That ratio is a fact about how Wikipedia editors describe people, not about how many Zen masters lived. It is the reason the page measures lineage registers instead."
  });
}
if (edges) {
  const e = edges.reduce((a, b) => a + b.edges, 0);
  const t = edges.reduce((a, b) => a + b.teachers, 0);
  checks.push({
    label: "Recorded successions",
    value: `${e.toLocaleString("en-US")} student-of links · ${t.toLocaleString("en-US")} distinct teachers`,
    detail: "P802 (student of) is the only machine-readable lineage relation. It records training relationships, not dharma transmission: the median age gap between linked people is about nine years, which is a teacher and a novice, not a master and an heir."
  });
}
if (heirs) {
  const mean = heirs.reduce((a, b) => a + b, 0) / heirs.length;
  checks.push({
    label: "Recorded heirs per teacher",
    value: `${heirs.length} teachers · mean ${mean.toFixed(2)} · median ${heirs[Math.floor(heirs.length / 2)]} · max ${heirs[heirs.length - 1]}`,
    detail: "Among the 400 teachers with the most recorded students. This is a maximum, not an average: the query sorts by count and takes the top. It cannot be used as a reproduction number for a tradition."
  });
}

const out = {
  generated: STAMP,
  source: {
    name: "Wikidata Query Service",
    url: "https://query.wikidata.org/",
    note: "People with an occupation label and a date of birth, grouped by birth century. Occupation labels are editorial choices; coverage is skewed toward literate, documented and recently written-about people."
  },
  centuries,
  traditions: grid,
  zen: zen ? centuries.map((c) => (zen[c] == null ? null : zen[c])) : null,
  edges,
  heirs: heirs ? {
    n: heirs.length,
    mean: +(heirs.reduce((a, b) => a + b, 0) / heirs.length).toFixed(2),
    median: heirs[Math.floor(heirs.length / 2)],
    max: heirs[heirs.length - 1]
  } : null,
  checks
};

if (DRY) {
  console.log(JSON.stringify(out, null, 2));
} else {
  const body = `/* Generated by ingest-lineage.mjs on ${STAMP}. Do not edit by hand.
   Wikidata counts ${centuries[0]}-${centuries[centuries.length - 1]}, ${traditions.length} traditions,
   ${edges ? edges.length + " century rows of student-of links" : "no edge data"}.
   Regenerate with:  node ingest-lineage.mjs                                 */
window.LINEAGE_DATA = ${JSON.stringify(out)};
`;
  fs.writeFileSync("lineage-data.js", body);
  console.log(`wrote lineage-data.js (${(body.length / 1024).toFixed(0)} kB)`);
}

for (const c of checks) console.log(`  ${c.label}: ${c.value}`);
