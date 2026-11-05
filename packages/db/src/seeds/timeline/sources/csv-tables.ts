import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { bce, cleanText, fromHistorical, parseDateText, slugifyKey, type DefaultEra, type ParsedRange } from "../dates.js";
import { parseCsv } from "./_csv.js";
import { CSV_TABLES, type ColRef, type CsvColumnMap, type CsvTableConfig } from "./csv-config.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * Generic importer for the CSV timeline tables in the research atlas.
 * Configured tables (csv-config.ts) are read with their explicit header and column map.
 * Every other CSV under the sources folder goes through an auto-detect pass: the first date-like
 * header wins, and the table is imported only when at least 60% of its rows parse as dates.
 */

const SOURCES_REL = "evolution-of-god/reference/atlas/sources";
const SKIP_DIRS = new Set(["archive", "ai-revisions", "ocr-text", "passages", "meta"]);
const SKIP_FILE = /(-notes|_audit_report)\.csv$/i;
const MIN_DATE_RATE = 0.6;
const PERIOD_YEARS = 60;
const DATE_HEADER = /\b(dates?|years?|periods?|eras?|reign|when|from|start|century|time)\b/i;
const NUMERIC = /^[-+]?\d[\d,]*(?:\.\d+)?$/;
const APPROX = /^(?:c\.?|ca\.?|circa|~|approx\.?)\s*/i;

const norm = (s: string) => cleanText(s).toLowerCase();
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 6);
const warn = (m: string) => console.warn(`  ! csv-tables: ${m}`);

/**
 * One date cell (or a value+era pair) to an astronomical range. Bare numbers without an era use
 * the table's default era; signed bare numbers are historical (-753 = 753 BCE), as in "Adjusted Year".
 */
export function parseWhen(raw: string, defaultEra: DefaultEra, era = ""): ParsedRange | null {
  const base = cleanText(raw);
  if (!base || /^[-?.]+$/.test(base)) return null;
  const eraText = cleanText(era);
  const bare = base.replace(APPROX, "").trim();
  if (!eraText && NUMERIC.test(bare)) {
    const v = Number(bare.replace(/,/g, ""));
    const approx = bare !== base || base.includes("~");
    if (v < 0) return { start: fromHistorical(v), approx };
    return { start: defaultEra === "BCE" ? bce(v) : v, approx };
  }
  return parseDateText(eraText ? `${base} ${eraText}` : base, defaultEra);
}

/** "36.9177°N, 34.8917°E" -> [lat, lon]. */
function parseLatLon(text: string): [number, number] | null {
  const parts = [...cleanText(text).matchAll(/(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?/gi)];
  if (parts.length < 2) return null;
  const lat = signed(parts[0]!, 90);
  const lon = signed(parts[1]!, 180);
  return lat === null || lon === null ? null : [lat, lon];
}

function signed(m: RegExpMatchArray, limit: number): number | null {
  let v = Number(m[1]);
  const hemi = m[2]?.toUpperCase();
  if (hemi === "S" || hemi === "W") v = -Math.abs(v);
  return Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
}

interface Resolved {
  name: number;
  from: number;
  fromEra: number;
  to: number;
  toEra: number;
  dateEnd: number;
  lane: number;
  region: number;
  summary: number;
  lat: number;
  lon: number;
  type: number;
  split: boolean;
}

/** Maps column references to indexes. Returns an error string naming the first missing column. */
function resolve(headers: string[] | null, map: CsvColumnMap): Resolved | string {
  const missing: string[] = [];
  const find = (ref: ColRef | undefined): number => {
    if (ref === undefined) return -1;
    if (typeof ref === "number") return ref;
    if (!headers) {
      missing.push(`${ref} (headerless table)`);
      return -1;
    }
    const want = norm(ref);
    let i = headers.findIndex((h) => norm(h) === want);
    if (i < 0) i = headers.findIndex((h) => norm(h).startsWith(want));
    if (i < 0) missing.push(ref);
    return i;
  };
  const d = map.date;
  const split = typeof d === "object";
  const res: Resolved = {
    name: find(map.name),
    from: split ? find(d.from) : find(d),
    fromEra: split ? find(d.fromEra) : -1,
    to: split ? find(d.to) : -1,
    toEra: split ? find(d.toEra) : -1,
    dateEnd: find(map.dateEnd),
    lane: find(map.lane),
    region: find(map.region),
    summary: find(map.summary),
    lat: find(map.lat),
    lon: find(map.lon),
    type: find(map.type),
    split,
  };
  return missing.length ? `column not found: ${missing.join(", ")}` : res;
}

interface Ctx {
  rel: string;
  keyBase: string;
  dataset: string;
  datasetLabel: string;
  laneFallback: string;
  defaultEra: DefaultEra;
  headers: string[] | null;
  res: Resolved;
}

/** Turns data rows (from `start` on) into records. Unusable rows go to `skipped` with their file row number. */
function buildRecords(rows: string[][], start: number, ctx: Ctx, records: TimelineRecord[], skipped: { ref: string; reason: string }[]) {
  const { res, headers } = ctx;
  for (let i = start; i < rows.length; i++) {
    const row = rows[i]!;
    const ref = `${ctx.rel}#${i + 1}`;
    const cell = (j: number) => (j >= 0 && j < row.length ? cleanText(row[j]) : "");

    const fromText = cell(res.from);
    if (headers && fromText && norm(fromText) === norm(headers[res.from] ?? "")) {
      skipped.push({ ref, reason: "repeated header row" });
      continue;
    }

    let parsed: ParsedRange | null;
    let end: number | undefined;
    let approx = false;
    let dateText = fromText;
    if (res.split) {
      const fromEra = cell(res.fromEra);
      parsed = parseWhen(fromText, ctx.defaultEra, fromEra);
      const toText = cell(res.to);
      if (parsed && toText) {
        const toEra = cell(res.toEra) || fromEra;
        const e = parseWhen(toText, ctx.defaultEra, toEra);
        if (e) end = e.start;
        dateText = `${fromText} ${fromEra} – ${toText} ${toEra}`.replace(/\s+/g, " ").trim();
      } else dateText = `${fromText} ${fromEra}`.trim();
    } else {
      parsed = parseWhen(fromText, ctx.defaultEra);
    }
    if (!parsed) {
      skipped.push({ ref, reason: fromText || dateText ? "unparseable date" : "empty date" });
      continue;
    }
    const start0 = parsed.start;
    if (end === undefined && parsed.end !== undefined) end = parsed.end;
    if (end === undefined && res.dateEnd >= 0 && cell(res.dateEnd)) {
      const e = parseWhen(cell(res.dateEnd), ctx.defaultEra);
      if (e) end = e.start;
    }
    if (end === start0) end = undefined;
    approx = parsed.approx;

    const name = trunc(cell(res.name), 300);
    if (!name) {
      skipped.push({ ref, reason: "no name" });
      continue;
    }

    const rec: TimelineRecord = {
      key: `${ctx.keyBase}-r${i + 1}`,
      dataset: ctx.dataset,
      datasetLabel: ctx.datasetLabel,
      kind: end !== undefined && Math.abs(end - start0) > PERIOD_YEARS ? "period" : "event",
      name,
      start: start0,
      lane: cell(res.lane) || ctx.laneFallback,
      confidence: "extension",
      sources: [`${SOURCES_REL}/${ctx.rel}`],
      data: { date: dateText },
    };
    if (end !== undefined) rec.end = end;
    if (approx) rec.approx = true;
    const region = cell(res.region);
    if (region) rec.region = region;
    const type = cell(res.type);
    if (type) rec.type = type;
    const summary = trunc(cell(res.summary), 600);
    if (summary) rec.summary = summary;
    if (res.lat >= 0) {
      let lat: number | null = null;
      let lon: number | null = null;
      if (res.lon >= 0) {
        const la = cell(res.lat).match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?/i);
        const lo = cell(res.lon).match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?/i);
        lat = la ? signed(la, 90) : null;
        lon = lo ? signed(lo, 180) : null;
      } else {
        const ll = parseLatLon(cell(res.lat));
        if (ll) [lat, lon] = ll;
      }
      if (lat !== null && lon !== null) {
        rec.lat = lat;
        rec.lon = lon;
      }
    }
    records.push(rec);
  }
}

interface TableText {
  rows: string[][];
  hash: string;
}

function readTable(abs: string): TableText {
  const text = fs.readFileSync(abs, "utf8");
  return { rows: parseCsv(text), hash: createHash("sha1").update(text).digest("hex") };
}

function keyBaseOf(rel: string): string {
  const stem = path.basename(rel, path.extname(rel));
  return `${slugifyKey(stem).slice(0, 24).replace(/-$/, "") || "table"}-${shortHash(rel)}`;
}

export function walk(dir: string, relDir: string, acc: string[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name), rel, acc);
    } else if (ent.isFile() && /\.csv$/i.test(ent.name) && !SKIP_FILE.test(ent.name)) acc.push(rel);
  }
}

/** Finds the header row and date column for an unconfigured table. Returns a reason string on failure. */
function autoDetect(rows: string[][]): { headerIdx: number; headers: string[]; date: number; name: number; summary: number } | string {
  const headerIdx = rows.slice(0, 15).findIndex((r) => r.filter((c) => c.trim()).length >= 2 && r.some((c) => DATE_HEADER.test(cleanText(c))));
  if (headerIdx < 0) return "auto: no date column";
  const headers = rows[headerIdx]!.map((c) => cleanText(c));
  const data = rows.slice(headerIdx + 1);
  if (data.length < 2) return "auto: too few rows";

  const candidates = headers
    .map((h, j) => ({ h, j }))
    .filter(({ h }) => DATE_HEADER.test(h))
    .sort((a, b) => rank(a.h) - rank(b.h) || a.j - b.j);
  const date = candidates.find(({ j }) => {
    const ok = data.filter((r) => parseWhen(r[j] ?? "", "auto") !== null).length;
    return ok >= 2 && ok / data.length >= MIN_DATE_RATE;
  });
  if (!date) return `auto: under ${MIN_DATE_RATE * 100}% of rows parse a date`;

  const textCols = headers
    .map((h, j) => ({ h, j }))
    .filter(({ h, j }) => h && j !== date.j)
    .filter(({ j }) => {
      const vals = data.map((r) => cleanText(r[j] ?? "")).filter(Boolean);
      return vals.length >= data.length / 2 && vals.filter((v) => !NUMERIC.test(v)).length >= vals.length * 0.8;
    })
    .map(({ j }) => j);
  const name = textCols[0];
  if (name === undefined) return "auto: no text name column";
  return { headerIdx, headers, date: date.j, name, summary: textCols[1] ?? -1 };
}

const rank = (h: string) => (/\bdates?\b/i.test(h) ? 0 : /\byears?\b/i.test(h) ? 1 : 2);

const source: TimelineSource = {
  id: "csv-tables",
  label: "Atlas CSV tables (configured and auto-detected)",
  trustTier: "tertiary",

  async load({ root }) {
    const bundle: TimelineBundle = { records: [], skipped: [] };
    const records = bundle.records;
    const skipped = bundle.skipped!;
    const base = path.join(root, SOURCES_REL);
    if (!fs.existsSync(base)) {
      warn(`sources folder not found: ${base}`);
      skipped.push({ ref: base, reason: "sources folder not found" });
      return bundle;
    }
    const seenHash = new Map<string, string>();
    const configured = new Set(CSV_TABLES.map((c) => c.file));

    for (const cfg of CSV_TABLES) {
      try {
        loadConfigured(cfg, base, records, skipped, seenHash);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn(`${cfg.file}: ${msg}`);
        skipped.push({ ref: cfg.file, reason: "read error" });
      }
    }

    const files: string[] = [];
    walk(base, "", files);
    for (const rel of files.sort()) {
      if (configured.has(rel)) continue;
      try {
        loadAuto(rel, base, records, skipped, seenHash);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warn(`${rel}: ${msg}`);
        skipped.push({ ref: rel, reason: "read error" });
      }
    }
    return bundle;
  },
};

function loadConfigured(
  cfg: CsvTableConfig,
  base: string,
  records: TimelineRecord[],
  skipped: { ref: string; reason: string }[],
  seenHash: Map<string, string>,
) {
  const abs = path.join(base, cfg.file);
  if (!fs.existsSync(abs)) {
    warn(`configured file not found: ${cfg.file}`);
    skipped.push({ ref: cfg.file, reason: "config: file not found" });
    return;
  }
  const { rows, hash } = readTable(abs);
  seenHash.set(hash, cfg.file);
  const headers = cfg.header === null ? null : rows[cfg.header]?.map((c) => cleanText(c)) ?? null;
  if (cfg.header !== null && !headers) {
    skipped.push({ ref: cfg.file, reason: "config: header row not found" });
    return;
  }
  const res = resolve(headers, cfg.columns);
  if (typeof res === "string") {
    warn(`${cfg.file}: ${res}`);
    skipped.push({ ref: cfg.file, reason: `config: ${res.split(":")[0]}` });
    return;
  }
  const before = records.length;
  const rowSkips: { ref: string; reason: string }[] = [];
  buildRecords(
    rows,
    cfg.header === null ? 0 : cfg.header + 1,
    {
      rel: cfg.file,
      keyBase: keyBaseOf(cfg.file),
      dataset: cfg.dataset,
      datasetLabel: cfg.label,
      laneFallback: cfg.label,
      defaultEra: cfg.defaultEra,
      headers,
      res,
    },
    records,
    rowSkips,
  );
  skipped.push(...rowSkips);
  if (records.length === before) skipped.push({ ref: cfg.file, reason: "config: no valid rows" });
}

export function loadAuto(
  rel: string,
  base: string,
  records: TimelineRecord[],
  skipped: { ref: string; reason: string }[],
  seenHash: Map<string, string>,
  opts?: { dataset: string; label: string; lane: string; sourceRoot?: string },
) {
  const { rows, hash } = readTable(path.join(base, rel));
  if (seenHash.has(hash)) {
    skipped.push({ ref: rel, reason: "duplicate content" });
    return;
  }
  seenHash.set(hash, rel);
  const det = autoDetect(rows);
  if (typeof det === "string") {
    skipped.push({ ref: rel, reason: det });
    return;
  }
  const folder = rel.includes("/") ? rel.split("/")[0]! : "root";
  const tableRecords: TimelineRecord[] = [];
  const tableSkips: { ref: string; reason: string }[] = [];
  buildRecords(
    rows,
    det.headerIdx + 1,
    {
      rel,
      keyBase: keyBaseOf(rel),
      dataset: opts?.dataset ?? `csv-${folder}`,
      datasetLabel: opts?.label ?? `Atlas CSV: ${folder}`,
      laneFallback: opts?.lane ?? folder,
      defaultEra: "auto",
      headers: det.headers,
      res: {
        name: det.name,
        from: det.date,
        fromEra: -1,
        to: -1,
        toEra: -1,
        dateEnd: -1,
        lane: -1,
        region: -1,
        summary: det.summary,
        lat: -1,
        lon: -1,
        type: -1,
        split: false,
      },
    },
    tableRecords,
    tableSkips,
  );
  if (!tableRecords.length) {
    skipped.push({ ref: rel, reason: "auto: no valid rows" });
    return;
  }
  // auto-detected tables are guesses: keep them out of the way at wide zoom, mark them low confidence, and drop rows
  // whose "name" is an id code or a bibliographic citation
  const CODE = /^[A-Z]{1,4}-[A-Za-z0-9-]+$/;
  const CITATION = /\((?:[^)]*\b)?(1[0-9]{3}|20[0-2][0-9])[a-z]?[,;)]/;
  for (const r of tableRecords) {
    if (r.name.length < 4 || CODE.test(r.name) || CITATION.test(r.name)) { skipped.push({ ref: `${r.dataset}:${r.key}`, reason: "auto: name looks like a code or citation" }); continue; }
    r.confidence = "low";
    r.rank = 0.1;
    records.push(r);
  }
  skipped.push(...tableSkips);
}

export default source;
