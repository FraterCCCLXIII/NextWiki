import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * Wikidata events (CC0). The first run queries the public SPARQL endpoint and caches the rows in
 * packages/db/data/wikidata-events.json (git-ignored). Later runs read only that cache; delete it to refetch.
 * Never throws: when nothing can be fetched and no cache exists, the bundle is empty and says why in `skipped`.
 */

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "NextWikiTimelineImport/1.0 (research wiki)";
const PAUSE_MS = 2000;
const TIMEOUT_MS = 120_000;
const CACHE_FILE = fileURLToPath(new URL("../../../../data/wikidata-events.json", import.meta.url));

const PREFIXES = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;

interface QuerySpec {
  id: string;
  lane: string;
  /** Finer type recorded on each event: the class the query selects. */
  type: string;
  /** WHERE-clause body binding ?item, ?start and optionally ?end. */
  pattern: string;
  /** Sort by sitelinks before the limit (default true). Windowed queries turn it off to avoid timeouts. */
  ordered?: boolean;
}

const QUERIES: QuerySpec[] = [
  {
    id: "battles",
    lane: "Battles",
    type: "battle",
    pattern: `?item wdt:P31/wdt:P279* wd:Q178561 .
      { ?item wdt:P585 ?start } UNION { ?item wdt:P580 ?start }
      OPTIONAL { ?item wdt:P582 ?end . }`,
  },
  {
    id: "wars",
    lane: "Wars",
    type: "war",
    pattern: `?item wdt:P31/wdt:P279* wd:Q198 .
      { ?item wdt:P580 ?start } UNION { ?item wdt:P585 ?start }
      OPTIONAL { ?item wdt:P582 ?end . }`,
  },
  {
    id: "treaties",
    lane: "Treaties",
    type: "treaty",
    pattern: `?item wdt:P31/wdt:P279* wd:Q131569 .
      { ?item wdt:P585 ?start } UNION { ?item wdt:P571 ?start }
      OPTIONAL { ?item wdt:P582 ?end . }`,
  },
  {
    id: "revolutions",
    lane: "Revolutions",
    type: "revolution",
    pattern: `?item wdt:P31/wdt:P279* wd:Q10931 .
      { ?item wdt:P580 ?start } UNION { ?item wdt:P585 ?start }
      OPTIONAL { ?item wdt:P582 ?end . }`,
  },
  {
    id: "empires",
    lane: "Dynasties & empires",
    type: "empire",
    pattern: `?item wdt:P31/wdt:P279* wd:Q48349 .
      ?item wdt:P571 ?start .
      OPTIONAL { ?item wdt:P576 ?end . }`,
  },
  {
    id: "dynasties",
    lane: "Dynasties & empires",
    type: "dynasty",
    pattern: `?item wdt:P31/wdt:P279* wd:Q164950 .
      ?item wdt:P571 ?start .
      OPTIONAL { ?item wdt:P576 ?end . }`,
  },
  {
    id: "religions",
    lane: "Foundings",
    type: "religion",
    pattern: `?item wdt:P31/wdt:P279* wd:Q9174 .
      ?item wdt:P571 ?start .
      OPTIONAL { ?item wdt:P576 ?end . }`,
  },
  // Discoveries are too many for one request (the endpoint times out or truncates the JSON), so they are
  // fetched in date windows with a sitelinks floor (40) as the notability cut. No ORDER BY, which is what times out.
  ...[
    ["discoveries-before-1900", "-9999-01-01T00:00:00Z", "1900-01-01T00:00:00Z"],
    ["discoveries-1900-1959", "1900-01-01T00:00:00Z", "1960-01-01T00:00:00Z"],
    ["discoveries-1960-2029", "1960-01-01T00:00:00Z", "2030-01-01T00:00:00Z"],
  ].map(([id, lo, hi]): QuerySpec => ({
    id: id!,
    lane: "Discoveries",
    type: "discovery",
    ordered: false,
    pattern: `?item wdt:P61 ?who .
      ?item wdt:P575 ?start .
      FILTER(?start >= "${lo}"^^xsd:dateTime && ?start < "${hi}"^^xsd:dateTime)
      FILTER(?sitelinks >= 40)`,
  })),
];

/** Wraps a WHERE body with the shared notability filter (English Wikipedia article), labels and coordinates. */
const sparql = (pattern: string, ordered: boolean) => `${PREFIXES}
SELECT ?item ?itemLabel ?itemDescription ?start ?end ?coord ?countryLabel ?sitelinks ?article WHERE {
  ${pattern}
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  ?item wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}${ordered ? "\nORDER BY DESC(?sitelinks)" : ""}
LIMIT 3000`;

/** One flattened SPARQL row. Only the fields the records need are kept, so the cache stays small. */
interface Row {
  id: string;
  label?: string;
  desc?: string;
  start?: string;
  end?: string;
  coord?: string;
  country?: string;
  sitelinks: number;
  article?: string;
}

interface Cache {
  fetchedAt: string;
  queries: Record<string, Row[]>;
  failed: Record<string, string>;
}

type Binding = Record<string, { type: string; value: string } | undefined>;

const bindingValue = (b: Binding, k: string) => b[k]?.value;

function toRow(b: Binding): Row | null {
  const item = bindingValue(b, "item");
  if (!item) return null;
  return {
    id: item.split("/").pop() ?? item,
    label: bindingValue(b, "itemLabel"),
    desc: bindingValue(b, "itemDescription"),
    start: bindingValue(b, "start"),
    end: bindingValue(b, "end"),
    coord: bindingValue(b, "coord"),
    country: bindingValue(b, "countryLabel"),
    sitelinks: Number(bindingValue(b, "sitelinks")) || 0,
    article: bindingValue(b, "article"),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function runQuery(query: string): Promise<Row[]> {
  const res = await fetch(`${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Some labels arrive with raw control characters, which JSON forbids inside strings; blank them out.
  const text = (await res.text()).replace(/[\u0000-\u001f]/g, " ");
  const json = JSON.parse(text) as { results?: { bindings?: Binding[] } };
  return (json.results?.bindings ?? []).map(toRow).filter((r): r is Row => r !== null);
}

/** Runs every query with a 2 s pause between them and one retry each. Stops early if the endpoint never answers. */
async function fetchAll(): Promise<Cache> {
  const cache: Cache = { fetchedAt: new Date().toISOString(), queries: {}, failed: {} };
  for (const [i, spec] of QUERIES.entries()) {
    if (i > 0) await sleep(PAUSE_MS);
    if (Object.keys(cache.queries).length === 0 && i >= 2) {
      cache.failed[spec.id] = "skipped: endpoint unreachable";
      continue;
    }
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await sleep(PAUSE_MS);
      try {
        cache.queries[spec.id] = await runQuery(sparql(spec.pattern, spec.ordered !== false));
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) cache.failed[spec.id] = errorText(lastError);
  }
  return cache;
}

function readCache(): Cache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as Cache;
  } catch {
    return null;
  }
}

function writeCache(cache: Cache) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

/**
 * Wikidata times are proleptic Gregorian ISO strings, "-0480-09-23T00:00:00Z" or "1815-06-18T00:00:00Z".
 * The year is already astronomical (year 0 = 1 BCE), so it is used as is.
 * Jan 1 is treated as a year-only placeholder and marked approximate.
 */
function parseTime(s?: string): { year: number; approx: boolean } | null {
  if (!s) return null;
  const m = /^([+-]?)(\d{4,})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const year = (m[1] === "-" ? -1 : 1) * Number(m[2]);
  if (!Number.isFinite(year)) return null;
  return { year, approx: m[3] === "01" && m[4] === "01" };
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function toRecord(row: Row, spec: QuerySpec, start: { year: number; approx: boolean }, end: { year: number } | null): TimelineRecord {
  const rec: TimelineRecord = {
    key: row.id,
    dataset: "wikidata",
    datasetLabel: "Wikidata events",
    kind: end ? "period" : "event",
    type: spec.type,
    name: row.label!,
    start: start.year,
    lane: spec.lane,
    confidence: "high",
    sources: [`https://www.wikidata.org/wiki/${row.id}`],
    externalIds: [{ scheme: "wikidata", value: row.id, url: `https://www.wikidata.org/wiki/${row.id}` }],
    rank: Math.round(Math.min(1, row.sitelinks / 100) * 100) / 100,
  };
  if (row.desc) rec.summary = row.desc;
  if (end) rec.end = end.year;
  if (start.approx) rec.approx = true;
  if (row.country) rec.region = row.country;
  if (row.article) {
    rec.externalIds!.push({ scheme: "wikipedia", value: safeDecode(row.article.split("/wiki/")[1] ?? row.article), url: row.article });
  }
  const point = row.coord ? /Point\((-?[\d.]+)\s+(-?[\d.]+)\)/.exec(row.coord) : null;
  if (point) {
    rec.lon = Number(point[1]);
    rec.lat = Number(point[2]);
  }
  return rec;
}

const source: TimelineSource = {
  id: "wikidata",
  label: "Wikidata events",
  license: "CC0 1.0",
  trustTier: "structured",
  async load(): Promise<TimelineBundle> {
    const skipped: { ref: string; reason: string }[] = [];
    let cache = readCache();
    if (!cache) {
      cache = await fetchAll();
      if (Object.keys(cache.queries).length) writeCache(cache);
    }
    for (const [id, reason] of Object.entries(cache.failed ?? {})) skipped.push({ ref: `wikidata:${id}`, reason: `query failed: ${reason}` });
    if (!Object.keys(cache.queries ?? {}).length) {
      skipped.push({ ref: "wikidata", reason: "no cache and the SPARQL endpoint returned nothing; no records" });
      return { records: [], skipped };
    }

    // items the richer Wars dataset (tools/timeline-wars) already carries under the same Q-id are left to it
    const inWars = new Set<string>();
    try {
      const wars = (await import(pathToFileURL(fileURLToPath(new URL("../../../../../../tools/timeline-wars/index.mjs", import.meta.url))).href)) as { ROWS: { wikidata?: string }[] };
      for (const r of wars.ROWS) if (r.wikidata) inWars.add(r.wikidata);
    } catch { /* wars dataset not built: keep everything */ }

    const records: TimelineRecord[] = [];
    const seen = new Set<string>();
    for (const spec of QUERIES) {
      for (const row of cache.queries[spec.id] ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        if (inWars.has(row.id)) { skipped.push({ ref: `wikidata:${row.id}`, reason: "carried by the wars dataset" }); continue; }
        const ref = `wikidata:${row.id}`;
        if (!row.label || /^Q\d+$/.test(row.label)) {
          skipped.push({ ref, reason: "no English label" });
          continue;
        }
        const start = parseTime(row.start);
        if (!start) {
          skipped.push({ ref, reason: "unparsed start date" });
          continue;
        }
        const end = parseTime(row.end);
        records.push(toRecord(row, spec, start, end));
      }
    }
    return { records, skipped };
  },
};

export default source;
