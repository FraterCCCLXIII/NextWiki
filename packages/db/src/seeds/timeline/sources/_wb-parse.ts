import { createHash } from "node:crypto";
import { bce, cleanText, fromHistorical, NOW_YEAR, slugifyKey } from "../dates.js";
import type { TimelineRecord } from "../types.js";

/**
 * Layout-tolerant table reader for the archived Kosmographica workbook sheets.
 * csv-tables' auto-detect needs one date column with 60% of all rows parsing; these sheets have stacked sub-tables,
 * heading rows, eras in a neighbouring column, centuries, prose dates and so on. This module works block by block:
 *
 *  - a block starts at a header row (a row with a date-like label and no parseable date in it);
 *  - single-cell rows are headings; a heading that names exactly one era (BCE or CE) is the default era for bare
 *    numbers below it, otherwise the era in the date column's header is used;
 *  - the date column is the header-named one (or, headerless, the column whose cells parse as dates), optionally with a
 *    separate era column and a second value/era pair for the end;
 *  - the name column is the column whose header looks like a name, else the leftmost text column.
 *
 * Nothing is guessed: a cell that does not parse is logged and the row dropped. A bare number needs an era from the
 * header/heading, a descending range (559-530 is BCE), or a lone year between 1000 and 2026.
 */

export interface WbParsed {
  /** The cell is essentially just the date (no other words except fillers such as "c.", "reign of"). */
  pure?: boolean;
  /** Era of the (last) number, when known; lets a bare start inherit the era of its end column. */
  era?: Era;
  start: number;
  end?: number;
  approx: boolean;
  /** The text carried its own era or century marker. */
  explicit: boolean;
}

export type WbFail = "empty" | "unparseable" | "bare" | "qualified" | "mangled";
export type Era = "BCE" | "CE";

const FILLER = new Set([
  "reign", "reigned", "reigns", "r", "ruled", "fl", "flourished", "born", "b", "died", "d", "lived", "active", "year", "years", "yr", "yrs",
  "circa", "ca", "c", "approx", "approximately", "about", "around", "early", "mid", "late", "of", "the", "in", "to", "and", "onward", "present", "now", "age",
]);
const MONTH = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s*(?:\d{1,2}(?:st|nd|rd|th)?,?\s*)?$/i;
const NUMS = String.raw`\d{1,6}(?:\.\d+)?`;
const RE_CENT = new RegExp(
  String.raw`(?<![\w.])(\d{1,2})(?:st|nd|rd|th)(?:\s*-\s*(\d{1,2})(?:st|nd|rd|th)?)?\s*(?:century|centuries|cent\.?|c\.)(?:\s*(BCE|CE))?(?![\w])`,
  "gi",
);
const RE_MILL = /(?<![\w.])(\d)(?:st|nd|rd|th)\s+millennium(?:\s*(BCE|CE))?(?![\w])/gi;
const RE_DEC = /(?<![\w.])(\d{3,4})s(?:\s*(BCE|CE))?(?![\w])/gi;
const RE_NUM = new RegExp(
  String.raw`(?<![\w.])(-)?(${NUMS})\s*(BCE|CE)?(?:\s*-\s*(-)?(${NUMS})\s*(BCE|CE)?)?(?![\w])`,
  "gi",
);

/** Era markers to BCE/CE, dashes and thousands separators normalised. Exported for tests and diagnostics. */
export function normalizeDateText(raw: string): string {
  let t = cleanText(raw).replace(/[–—−‒―]/g, "-");
  t = t
    .replace(/\bB\.?\s?C\.?\s?E\b\.?/gi, "BCE")
    .replace(/\bB\.\s?C\b\.?/gi, "BCE")
    .replace(/\bBC\b\.?/g, "BCE")
    .replace(/\bC\.\s?E\b\.?/g, "CE")
    .replace(/\bA\.\s?D\b\.?/g, "CE")
    .replace(/\bAD\b/g, "CE")
    .replace(/(\d)\s*(bce|bc)\b\.?/gi, "$1 BCE")
    .replace(/(\d)\s*(ce|ad)\b\.?/gi, "$1 CE");
  // "4th / 3rd century", "3rd or 2nd century", "1st and 4th centuries": a span between two ordinals
  t = t.replace(/(\d(?:st|nd|rd|th))\s*(?:\/|or|and)\s*(?=\d+(?:st|nd|rd|th))/gi, "$1-");
  t = t.replace(/^BCE\s+(\d{1,6})\b(?!\s*-|\s*(?:BCE|CE))/, "$1 BCE");
  t = t.replace(/(?<!\d\s?)\bCE\s+(\d{1,4}(?:\s*-\s*\d{1,4})?)\b/g, "$1 CE");
  for (let i = 0; i < 3; i++) t = t.replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  t = t.replace(/\s+(?:to|through|thru)\s+(?=(?:c\.?\s*|ca\.?\s*|circa\s*)?-?\d)/gi, " - ");
  return t.replace(/\s+/g, " ").trim();
}

interface Atom {
  idx: number;
  len: number;
  kind: "cent" | "mill" | "dec" | "num";
  m: RegExpMatchArray;
}

function atomsOf(t: string): Atom[] {
  const all: Atom[] = [];
  const push = (re: RegExp, kind: Atom["kind"]) => {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) all.push({ idx: m.index!, len: m[0].length, kind, m });
  };
  push(RE_CENT, "cent");
  push(RE_MILL, "mill");
  push(RE_DEC, "dec");
  push(RE_NUM, "num");
  all.sort((a, b) => a.idx - b.idx || b.len - a.len);
  const out: Atom[] = [];
  let end = -1;
  for (const a of all) {
    if (a.idx < end) continue;
    out.push(a);
    end = a.idx + a.len;
  }
  return out;
}

const ok = (n: number) => Number.isInteger(n);
const toYear = (v: number, era: Era): number | null => {
  if (!ok(v) || v < 1) return null;
  if (era === "CE") return v <= 2100 ? v : null;
  return v <= 500000 ? bce(v) : null;
};
const eraOfTag = (s: string | undefined): Era | null => (s ? (s.toUpperCase() === "BCE" ? "BCE" : "CE") : null);

/** Era named by a header or heading when exactly one of BCE/CE appears, else null. */
export function eraFromText(raw: string): Era | null {
  const t = normalizeDateText(raw);
  const has = { BCE: /\bBCE\b/.test(t), CE: /\bCE\b/.test(t.replace(/BCE/g, "")) };
  return has.BCE !== has.CE ? (has.BCE ? "BCE" : "CE") : null;
}

function resolveAtom(a: Atom, t: string, ctx: Era | null, pure: boolean, paren: boolean, weak = false): (WbParsed & { open?: boolean }) | null {
  const m = a.m;
  if (a.kind === "cent") {
    const c1 = Number(m[1]);
    const c2 = Number(m[2] ?? m[1]);
    const era = eraOfTag(m[3]) ?? (m[2] && c1 > c2 ? "BCE" : ctx);
    if (!m[3] && era === "BCE" && c1 < c2) return null;
    if (!era || c1 < 1 || c2 < 1 || c1 > 60 || c2 > 60) return null;
    const hi = Math.max(c1, c2);
    const lo = Math.min(c1, c2);
    const explicit = Boolean(m[3]);
    if (!explicit && !(pure || paren)) return null;
    return era === "BCE"
      ? { start: bce(hi * 100), end: bce((lo - 1) * 100 + 1), approx: true, explicit, era }
      : { start: (lo - 1) * 100 + 1, end: hi * 100, approx: true, explicit, era };
  }
  if (a.kind === "mill") {
    const n = Number(m[1]);
    const era = eraOfTag(m[2]) ?? ctx;
    if (!era || !m[2] && !(pure || paren)) return null;
    return era === "BCE" ? { start: bce(n * 1000), end: bce((n - 1) * 1000 + 1), approx: true, explicit: Boolean(m[2]), era } : { start: (n - 1) * 1000 + 1, end: n * 1000, approx: true, explicit: Boolean(m[2]), era };
  }
  if (a.kind === "dec") {
    const v = Number(m[1]);
    const tag = eraOfTag(m[2]);
    const era = tag ?? ctx ?? (v >= 1000 && v <= 2000 ? "CE" : null);
    if (!era || (!tag && !(pure || paren))) return null;
    const span = v % 100 === 0 ? 99 : 9;
    if (era === "BCE") {
      const s = toYear(v + span, "BCE");
      const e = toYear(v, "BCE");
      return s === null || e === null ? null : { start: s, end: e, approx: true, explicit: Boolean(tag), era };
    }
    const s = toYear(v, "CE");
    const e = toYear(v + span, "CE");
    return s === null || e === null ? null : { start: s, end: e, approx: true, explicit: Boolean(tag), era };
  }
  // numeric
  const neg1 = Boolean(m[1]);
  const a1 = Number(m[2]);
  const ea = eraOfTag(m[3]);
  const hasB = m[5] !== undefined;
  const neg2 = Boolean(m[4]);
  const b1 = hasB ? Number(m[5]) : NaN;
  const eb = eraOfTag(m[6]);
  const before = t.slice(0, a.idx);
  const month = MONTH.test(before);
  const explicit = Boolean(ea || eb || month);
  if (!explicit && !(pure || paren)) return null;

  if (!hasB) {
    let y: number | null = null;
    if (ea) y = toYear(a1, ea);
    else if (neg1 && ok(a1) && a1 >= 1) y = fromHistorical(-a1);
    else if (ctx) y = weak && a1 < 100 ? null : toYear(a1, ctx);
    else if (a1 >= 1000 && a1 <= NOW_YEAR) y = a1;
    if (y === null) return null;
    const tail = t.slice(a.idx + a.len);
    const open = /^\s*(?:onward|onwards|→|->|and later|-\s*(?:present|now))/i.test(tail);
    const r: WbParsed = { start: y, approx: false, explicit, era: y <= 0 ? "BCE" : "CE" };
    if (open && y > 0) r.end = NOW_YEAR;
    return r;
  }
  let eA: Era | null;
  let eB: Era | null;
  if (ea || eb) {
    eB = eb ?? (ea === "BCE" ? (b1 <= a1 ? "BCE" : "CE") : "CE");
    eA = ea ?? (eb === "CE" && a1 > b1 ? "BCE" : eb);
  } else if (neg1 && neg2) {
    const s = ok(a1) && ok(b1) && a1 >= 1 && b1 >= 1 ? [fromHistorical(-a1), fromHistorical(-b1)] : null;
    return s ? { start: Math.min(...s), end: Math.max(...s), approx: false, explicit } : null;
  } else if (a1 > b1) {
    eA = eB = "BCE";
  } else {
    const e = ctx ?? (a1 >= 1000 ? "CE" : null);
    // BCE ranges are written oldest first; an ascending bare pair under a BCE label is ambiguous, not a BCE range
    if (!e || (e === "BCE" && a1 < b1)) return null;
    eA = eB = e;
  }
  const ya = toYear(a1, eA!);
  const yb = toYear(b1, eB!);
  if (ya === null || yb === null) return null;
  return { start: Math.min(ya, yb), end: Math.max(ya, yb), approx: false, explicit, era: eB! };
}

/**
 * Parses one date cell. `ctx` is the era of the header/heading (null when unknown); `era` is the content of a separate era
 * column. Returns a failure code when the text has no usable date.
 */
export function parseDateCell(raw: string, ctx: Era | null, era = "", weak = false): WbParsed | WbFail {
  const base = cleanText(raw);
  if (!base || /^[-?.]+$/.test(base)) return "empty";
  if (/\b\d{4}-\d{2}-\d{2}\b|\d{1,2}:\d{2}:\d{2}/.test(base)) return "mangled";
  let t = normalizeDateText(era ? `${base} ${era}` : base);
  if (/^(?:pre|post|before|after|prior to|by|ante)\b[-\s]/i.test(t)) return "qualified";
  const approx = /(?<![A-Za-z])(?:c|ca|circa|approx|approximately|about|around)\.?\s*(?=-?\d)|~|\?/i.test(t);
  t = t
    .replace(/-\s*\?+/g, "")
    .replace(/(?<![A-Za-z])(?:c|ca|circa|approx|approximately|about|around)\.?\s*(?=-?\d)/gi, "")
    .replace(/[~?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const atoms = atomsOf(t);
  if (!atoms.length) return "unparseable";
  const resolved: { r: WbParsed; a: Atom; qual: boolean; died: boolean }[] = [];
  let sawBare = false;
  for (let k = 0; k < atoms.length; k++) {
    const a = atoms[k]!;
    const rest = (t.slice(0, a.idx) + " " + t.slice(a.idx + a.len)).replace(/\([^)]*\)/g, " ");
    const words = rest.toLowerCase().match(/[a-z]+/g) ?? [];
    const pure = words.every((w) => FILLER.has(w));
    const paren = t[a.idx - 1] === "(" || /\(\s*$/.test(t.slice(0, a.idx));
    let r = resolveAtom(a, t, ctx, pure, paren, weak);
    if (!r) {
      // "1920s-1930s CE", "3rd - 2nd c. BCE": a bare first half takes the era written after the second half
      const nx = atoms[k + 1];
      const joined = nx && /^\s*-\s*$/.test(t.slice(a.idx + a.len, nx.idx));
      const nr = joined ? resolveAtom(nx, t, ctx, pure, paren, weak) : null;
      if (nr?.era && nr.explicit) r = resolveAtom(a, t, nr.era, true, true);
    }
    const before = t.slice(Math.max(0, a.idx - 24), a.idx).toLowerCase();
    const died = /(?:\bdied|\bdeath|\bd\.)\s*(?:c\.?\s*|around\s+)?$/.test(before);
    const qual = /(?:\bafter|\bbefore|\bby|\buntil|\bpre-?|\bpost-?|\bprior to)\s*(?:c\.?\s*|around\s+)?$/.test(before);
    if (r) resolved.push({ r: { ...r, pure }, a, qual: qual || died, died });
    else sawBare = true;
  }
  const usable = resolved.filter((x) => !x.qual);
  const lifespan =
    resolved.length >= 2 && /\b(?:b\.|born)/i.test(t) && resolved.some((x) => x.died) && resolved.filter((x) => !x.died && !x.qual)[0] && resolved.find((x) => x.died);
  if (!usable.length) return resolved.length ? "qualified" : sawBare ? "bare" : "unparseable";
  const first = usable[0]!;
  const out: WbParsed = { ...first.r, approx: first.r.approx || approx };
  delete (out as { open?: boolean }).open;
  if (lifespan && first.r.end === undefined) {
    const d = resolved.find((x) => x.died)!;
    out.start = Math.min(first.r.start, d.r.start);
    out.end = Math.max(first.r.start, d.r.start);
    return out;
  }
  // "3rd c. BCE - 3rd c. CE": two atoms joined by a dash span from the first to the second
  const second = usable[1];
  if (second && /^\s*-\s*$/.test(t.slice(first.a.idx + first.a.len, second.a.idx))) {
    out.start = Math.min(first.r.start, second.r.start);
    out.end = Math.max(first.r.end ?? first.r.start, second.r.end ?? second.r.start);
    out.approx = out.approx || first.r.approx || second.r.approx;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sheet reader
// ---------------------------------------------------------------------------------------------------------------------

const DATE_HDR =
  /\b(?:dates?|years?|periods?|eras?|reign(?:ed)?|when|from|start(?:ed)?|began|founded|century|centuries|time|born|lived|floruit|flourished|age|epoch|bce|bc|ce|ad|birth|approx)\b/i;
const DEATH_HDR = /\b(?:death|died|dies|fate|burial|buried)\b/i;
const BIRTH_OK = /\b(?:birth|born|life|lived|lifespan|dates?|reign)\b/i;
const END_HDR = /^(?:to|end|ended|until|died|death|d\.)\b/i;
const NAME_HDR =
  /\b(?:name|names|event|events|title|figure|figures|person|people|character|characters|work|text|deity|god|king|ruler|emperor|battle|author|philosopher|saint|prophet|culture|civili[sz]ation|cult|religion|school|tradition|temple|site|topic|item|subject|sibyl|stage|dynasty|movement|council|empire)\b/i;
const NAME_HDR_START = /^(?:name|event|title|figure|person|character|work|text|deity|god|king|ruler|emperor|battle|author|philosopher|saint|prophet|culture|civili[sz]ation|cult|religion|school|tradition|temple|site|topic|item|subject|sibyl|stage|dynasty|movement|council|empire|emperor)/i;
const SUMMARY_HDR = /\b(?:description|details?|key|notes?|significance|summary|events?|developments?|importance|role|contribution|teachings?)\b/i;
const REGION_HDR = /\b(?:region|location|place|country|area|where)\b/i;
const TYPE_HDR = /^(?:type|kind|category|class)\b/i;
const ERA_TOKEN = /^(?:BCE|BC|CE|AD|B\.C\.E?\.?|B\.C\.|C\.E\.|A\.D\.)$/i;
const CODE = /^(?:[A-Z]{1,4}-[A-Za-z0-9-]+|[A-Z]{1,3}\d{1,4})$/;
const AUTHOR_YEAR = /\((?:[A-Z][\w.'’-]*(?:\s+(?:et al\.?|and|&|[A-Z][\w.'’-]*))*),?\s+(?:1[0-9]{3}|20[0-2][0-9])[a-z]?(?:[,;)]|\s*:)/;
const NO_VALUE = /^(?:n\/?a|none|null|nan|unknown|tbd|-+|\?+|\[gpt error\].*)$/i;

const norm = (s: string) => cleanText(s).toLowerCase();
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Same key-base rule as csv-tables, so stock-rejected rows of a sheet can be told apart from other sheets'. */
export function sheetKeyBase(rel: string): string {
  const stem = rel.replace(/^.*\//, "").replace(/\.[^.]*$/, "");
  const h = createHash("sha1").update(rel).digest("hex").slice(0, 6);
  return `${slugifyKey(stem).slice(0, 24).replace(/-$/, "") || "table"}-${h}`;
}

export interface WbSkip {
  ref: string;
  reason: string;
  /** row number in the CSV (1-based), for reconciling with csv-tables' own skip list */
  row: number;
  /** Offending text, for the log only. */
  text?: string;
}

export interface WbSheetResult {
  records: (TimelineRecord & { row: number })[];
  skipped: WbSkip[];
  /** Blocks (header row index -> date column header) the reader found, for diagnostics. */
  blocks: string[];
}

interface Block {
  headerRow: number; // index into rows, -1 = headerless
  headers: string[];
  start: number; // first data row index
  end: number; // exclusive
  dates: number[]; // date columns in priority order
  fromEra: number; // separate era column for dates[0], -1 none
  to: number;
  toEra: number;
  ctx: Era | null;
  names: number[];
  summary: number;
  region: number;
  type: number;
  /** Columns of plain integers that mix negative (BCE) and positive (CE) values: "-300", "234". */
  signed: Set<number>;
}

/** A plain integer in a signed-year column: negative is historical BCE, positive is CE. */
function parseSigned(v: string): WbParsed | null {
  if (!/^-?\d{1,5}$/.test(v)) return null;
  const n = Number(v);
  if (n === 0 || n > 2100 || n < -500000) return null;
  return { start: n < 0 ? fromHistorical(n) : n, approx: false, explicit: true };
}

const cellOf = (row: string[], j: number) => (j >= 0 && j < row.length ? cleanText(row[j]) : "");
const nonEmpty = (row: string[]) => row.filter((c) => cleanText(c)).length;

function isPlainLabel(c: string): boolean {
  return c.length > 0 && c.length <= 60 && atomsOf(normalizeDateText(c)).length === 0;
}

function isHeaderRow(row: string[]): boolean {
  if (nonEmpty(row) < 2) return false;
  const cells = row.map((c) => cleanText(c)).filter(Boolean);
  // header labels are short and carry no digits ("fl. 4th century" is data, "Date (BCE)" is a header)
  if (!cells.every((c) => c.length <= 70 && !/\d/.test(c))) return false;
  return cells.some((c) => DATE_HDR.test(c));
}

/** Single-cell (or all-identical-cells) row: a heading or title. */
function headingText(row: string[]): string | null {
  const cells = row.map((c) => cleanText(c)).filter(Boolean);
  if (!cells.length) return null;
  const uniq = new Set(cells.map((c) => c.toLowerCase()));
  if (uniq.size !== 1) return null;
  const only = cells[0]!;
  if (only.length < 3) return null;
  return only;
}

function eraColumns(rows: string[][], start: number, end: number, width: number): boolean[] {
  const out: boolean[] = [];
  for (let c = 0; c < width; c++) {
    const vals = [];
    for (let i = start; i < end; i++) {
      const v = cellOf(rows[i]!, c);
      if (v) vals.push(v);
    }
    out.push(vals.length >= 2 && vals.filter((v) => ERA_TOKEN.test(v)).length >= vals.length * 0.6);
  }
  return out;
}

const pureNumber = (s: string) => /^-?\d{1,6}(?:[.,]\d+)?$/.test(cleanText(s));

/** Builds the column plan of one block. Returns null when no column holds dates. */
function planBlock(rows: string[][], b: Pick<Block, "headerRow" | "headers" | "start" | "end">, hdrCtx: Era | null): Block | null {
  const width = Math.max(...rows.slice(b.start, b.end).map((r) => r.length), b.headers.length, 1);
  const data = rows.slice(b.start, b.end);
  if (data.length < 1) return null;
  const eraCol = eraColumns(rows, b.start, b.end, width);
  const signed = new Set<number>();
  for (let c = 0; c < width; c++) {
    if (!DATE_HDR.test(b.headers[c] ?? "")) continue;
    const vals = data.map((r) => cellOf(r, c)).filter(Boolean);
    const ints = vals.filter((v) => /^-?\d{1,5}$/.test(v));
    if (ints.length >= 8 && ints.length >= vals.length * 0.7 && ints.filter((v) => v.startsWith("-")).length >= 2 && ints.filter((v) => !v.startsWith("-")).length >= 2) signed.add(c);
  }

  // score each column by how many of its non-empty cells parse as dates (walking headings for era context)
  const named = (c: number) => DATE_HDR.test(b.headers[c] ?? "");
  const hits = new Array<number>(width).fill(0);
  const filled = new Array<number>(width).fill(0);
  const lenSum = new Array<number>(width).fill(0);
  let sec: Era | null = null;
  for (let i = b.start; i < b.end; i++) {
    const row = rows[i]!;
    const h = headingText(row);
    if (h !== null) {
      sec = eraFromText(h);
      continue;
    }
    for (let c = 0; c < width; c++) {
      const v = cellOf(row, c);
      if (!v || eraCol[c]) continue;
      const hEra = DATE_HDR.test(b.headers[c] ?? "") ? eraFromText(b.headers[c] ?? "") ?? hdrCtx : null;
      const ctx = hEra ?? (DATE_HDR.test(b.headers[c] ?? "") ? sec : null);
      const weak = !hEra;
      const era = eraCol[c + 1] ? cellOf(row, c + 1) : "";
      if (c + 1 < width && eraCol[c + 1] && !pureNumber(v)) { /* value with its own text: era column ignored */ }
      filled[c]!++;
      lenSum[c]! += v.length;
      const pd = signed.has(c) ? parseSigned(v) : null;
      const pr = pd ?? parseDateCell(v, ctx, pureNumber(v) ? era : "", weak);
      // in unlabelled columns only cells that are essentially a date count ("Unknown (c. 675 BCE)" is a note, not a date)
      if (typeof pr !== "string" && (named(c) || pd || pr.pure)) hits[c]!++;
    }
  }
  const cols = [...Array(width).keys()].filter((c) => !eraCol[c]);
  const good = cols.filter((c) => {
    const f = filled[c]!;
    const h = hits[c]!;
    if (h < 2 && !(h >= 1 && data.length <= 3)) return false;
    // a column that is only about death is not when the thing starts
    if (DEATH_HDR.test(b.headers[c] ?? "") && !BIRTH_OK.test(b.headers[c] ?? "")) return false;
    if (named(c)) return h >= Math.max(2, f * 0.12);
    return h >= 3 && h >= f * 0.5 && lenSum[c]! / Math.max(f, 1) < 45;
  });
  if (!good.length) return null;
  good.sort((x, y) => Number(named(y)) - Number(named(x)) || hits[y]! - hits[x]! || x - y);
  let primary = good[0]!;
  if (!named(primary)) {
    // unlabelled date columns: the leftmost strong one is the start, the next one (within two columns) its end
    const strong = good.filter((c) => hits[c]! >= hits[primary]! * 0.5).sort((x, y) => x - y);
    primary = strong[0]!;
  }
  const dates = [primary, ...good.filter((c) => c !== primary)];

  const fromEra = eraCol[primary + 1] ? primary + 1 : -1;
  let to = -1;
  let toEra = -1;
  if (fromEra >= 0) {
    for (let c = fromEra + 1; c < Math.min(width, fromEra + 3); c++) {
      if (!eraCol[c] && (END_HDR.test(b.headers[c] ?? "") || (c === fromEra + 1 && hits[c]! >= 2 && pureNumber(cellOf(data.find((r) => cellOf(r, c)) ?? [], c))))) {
        to = c;
        if (eraCol[c + 1]) toEra = c + 1;
        break;
      }
    }
  } else {
    // end column named in the header, directly right of the start column
    for (let c = primary + 1; c < Math.min(width, primary + 3); c++) {
      if (END_HDR.test(b.headers[c] ?? "") && !eraCol[c]) {
        to = c;
        break;
      }
    }
  }
  if (to < 0 && !named(primary)) {
    for (let c = primary + 1; c <= Math.min(width - 1, primary + 3); c++) {
      if (!eraCol[c] && !eraCol[c - 1] && good.includes(c) && !(b.headers[c] ?? "")) {
        to = c;
        break;
      }
    }
  }
  if (to < 0 && !named(primary)) {
    // an unlabelled column of plain numbers just left of the date column is its start: "100 | | 400 CE"
    for (let c = primary - 1; c >= Math.max(0, primary - 2); c--) {
      if (eraCol[c] || (b.headers[c] ?? "") || dates.includes(c)) continue;
      const pairs: [number, number, Era][] = [];
      for (const r of data) {
        const lv = cellOf(r, c);
        const rv = parseDateCell(cellOf(r, primary), null);
        if (pureNumber(lv) && /^\d{1,4}$/.test(lv) && typeof rv !== "string" && rv.era) pairs.push([Number(lv), rv.era === "BCE" ? 1 - rv.start : rv.start, rv.era]);
      }
      const vals = new Set(pairs.map((x) => x[0]));
      const sequential = pairs.every((x, i) => i === 0 || x[0] - pairs[i - 1]![0] === 1);
      // the start is not later than the end: bigger BCE magnitude, smaller CE one
      const okp = pairs.filter(([l, rr, e]) => l >= 1 && l <= 2100 && (e === "BCE" ? l >= rr : l <= rr)).length;
      if (pairs.length >= 3 && vals.size >= 3 && !sequential && okp >= pairs.length * 0.8) {
        dates.unshift(c);
        to = primary;
        primary = c;
        dates.splice(dates.indexOf(to), 1);
        break;
      }
    }
  }
  if (to >= 0 && dates.includes(to)) dates.splice(dates.indexOf(to), 1);
  const used = new Set<number>([...dates, fromEra, to, toEra].filter((c) => c >= 0));
  // fill is measured on the rows that carry something in the date column, so heading and note rows do not dilute it
  const dated = data.filter((r) => cellOf(r, primary) && headingText(r) === null);
  if (!dated.length) return null;
  const text = cols
    .filter((c) => !used.has(c))
    .map((c) => {
      const vals = dated.map((r) => cellOf(r, c)).filter(Boolean);
      return { c, fill: vals.length / dated.length, num: vals.filter((v) => pureNumber(v)).length / Math.max(vals.length, 1), len: vals.reduce((n, v) => n + v.length, 0) / Math.max(vals.length, 1) };
    })
    .filter((x) => x.fill >= 0.35 && x.num < 0.3 && x.len >= 2);
  const hdr = (c: number) => b.headers[c] ?? "";
  const names: number[] = [];
  for (const x of text.filter((x) => NAME_HDR_START.test(hdr(x.c)))) names.push(x.c);
  for (const x of text.filter((x) => NAME_HDR.test(hdr(x.c)) && !names.includes(x.c))) names.push(x.c);
  if (!names.length) {
    const lead = text.find((x) => !SUMMARY_HDR.test(hdr(x.c)) && !REGION_HDR.test(hdr(x.c)));
    if (lead) names.push(lead.c);
  }
  const nameSet = new Set(names.slice(0, 3));
  const pick = (re: RegExp) => text.find((x) => re.test(hdr(x.c)) && !nameSet.has(x.c))?.c ?? -1;
  let summary = pick(SUMMARY_HDR);
  if (summary < 0) summary = text.find((x) => !nameSet.has(x.c) && !REGION_HDR.test(hdr(x.c)) && !TYPE_HDR.test(hdr(x.c)))?.c ?? -1;
  return {
    ...b,
    dates,
    fromEra,
    to,
    toEra,
    ctx: hdrCtx,
    signed,
    names: names.slice(0, 3),
    summary,
    region: pick(REGION_HDR),
    type: pick(TYPE_HDR),
  };
}

/** Reads one sheet (already CSV-parsed) into records plus a per-row skip list. */
export function recoverSheet(
  rows: string[][],
  o: { rel: string; dataset: string; datasetLabel: string; lane: string },
): WbSheetResult {
  const keyBase = sheetKeyBase(o.rel);
  const res: WbSheetResult = { records: [], skipped: [], blocks: [] };
  const skip = (i: number, reason: string, text?: string) => res.skipped.push({ ref: `${o.rel}#${i + 1}`, reason, row: i + 1, text });

  // 1. find block boundaries: every header row opens a block
  const headerIdx: number[] = [];
  rows.forEach((r, i) => {
    if (isHeaderRow(r)) headerIdx.push(i);
  });
  const bounds: Pick<Block, "headerRow" | "headers" | "start" | "end">[] = [];
  const headerOf = (i: number): string[] => {
    const lower = rows[i]!.map((c) => cleanText(c));
    const prev = i > 0 && !headerIdx.includes(i - 1) ? rows[i - 1]! : null;
    // two-level header: the row above holds labels (2+ cells, all plain) and is not a heading or data
    if (prev && nonEmpty(prev) >= 2 && prev.every((c) => !cleanText(c) || isPlainLabel(cleanText(c))) && prev.some((c) => cleanText(c))) {
      const width = Math.max(prev.length, lower.length);
      return Array.from({ length: width }, (_, j) => [cleanText(prev[j] ?? ""), lower[j] ?? ""].filter(Boolean).join(" "));
    }
    return lower;
  };
  if (!headerIdx.length || headerIdx[0]! > 0) {
    // headerless lead-in (or fully headerless sheet): data starts at the first row
    const endAt = headerIdx[0] ?? rows.length;
    bounds.push({ headerRow: -1, headers: [], start: 0, end: endAt });
  }
  headerIdx.forEach((h, k) => bounds.push({ headerRow: h, headers: headerOf(h), start: h + 1, end: headerIdx[k + 1] ?? rows.length }));

  let counter = 0;
  for (const bnd of bounds) {
    const hdrCtxs = bnd.headers.map((h) => eraFromText(h));
    // era of the header cell that names the date column; all date-ish headers agreeing gives the block default
    const dateHdrEras = new Set(bnd.headers.filter((h) => DATE_HDR.test(h)).map((h) => eraFromText(h)).filter((e): e is Era => Boolean(e)));
    const hdrCtx = dateHdrEras.size === 1 ? [...dateHdrEras][0]! : null;
    void hdrCtxs;
    const blk = planBlock(rows, bnd, hdrCtx);
    if (bnd.headerRow >= 0 && bnd !== bounds.find((x) => x.headerRow >= 0)) skip(bnd.headerRow, "repeated header row", bnd.headers.join(" | "));
    if (!blk) {
      for (let i = bnd.start; i < bnd.end; i++) {
        const h = headingText(rows[i]!);
        skip(i, h !== null ? "section/heading row" : "no usable date column in block", cellOf(rows[i]!, 0));
      }
      continue;
    }
    res.blocks.push(`${o.rel}#${bnd.headerRow + 1}: date=${blk.dates.map((c) => blk.headers[c] || `col${c}`).join("/")} era=${blk.fromEra} to=${blk.to} ctx=${blk.ctx ?? "-"} name=${blk.names.join(",")}`);
    let sec: Era | null = null;
    let section = "";
    const headerNorm = blk.headers.map(norm);
    for (let i = blk.start; i < blk.end; i++) {
      const row = rows[i]!;
      const h = headingText(row);
      if (h !== null) {
        const e = eraFromText(h);
        // an era-less heading ends the previous heading's era
        sec = e;
        section = h;
        skip(i, "section/heading row", h);
        continue;
      }
      // a later header row for this block that was not detected as a block start (same labels repeated)
      const same = row.filter((c, j) => norm(c) && norm(c) === headerNorm[j]).length;
      if (same >= 2 && same >= nonEmpty(row) * 0.6) {
        skip(i, "repeated header row", cellOf(row, 0));
        continue;
      }
            let parsed: WbParsed | WbFail = "empty";
      let dateText = "";
      for (const dc of blk.dates) {
        const v = cellOf(row, dc);
        if (!v) continue;
        const era = dc === blk.dates[0] && blk.fromEra >= 0 && pureNumber(v) ? cellOf(row, blk.fromEra) : "";
        const named = DATE_HDR.test(blk.headers[dc] ?? "");
        const hEra = named ? eraFromText(blk.headers[dc] ?? "") ?? blk.ctx : null;
        const cctx = hEra ?? (named ? sec : null);
        const weak = !hEra;
        let p: WbParsed | WbFail = (blk.signed.has(dc) ? parseSigned(v) : null) ?? parseDateCell(v, cctx, era, weak);
        const tv = dc === blk.dates[0] && blk.to >= 0 ? cellOf(row, blk.to) : "";
        const te = tv ? (blk.toEra >= 0 && pureNumber(tv) ? cellOf(row, blk.toEra) || era : era) : "";
        const q = tv ? parseDateCell(tv, cctx, te, weak) : "empty";
        if (p === "bare" && typeof q !== "string" && q.era) {
          // "1550 | | 1070 BCE": a bare start takes the era of its end, provided it is not later than the end
          const p2 = parseDateCell(v, q.era, era);
          if (typeof p2 !== "string" && p2.start <= q.start) p = p2;
        }
        if (typeof p !== "string") {
          parsed = p;
          dateText = era ? `${v} ${era}` : v;
          if (typeof q !== "string" && p.end === undefined) {
            parsed = { ...p, start: Math.min(p.start, q.start), end: Math.max(p.start, q.end ?? q.start) };
            dateText = `${dateText} - ${te && pureNumber(tv) ? `${tv} ${te}` : tv}`;
          }
          break;
        }
        if (parsed === "empty" || (parsed === "unparseable" && p !== "unparseable")) parsed = p;
        if (!dateText) dateText = v;
      }
      if (typeof parsed === "string") {
        const why: Record<WbFail, string> = {
          empty: "empty date",
          unparseable: "unparseable date",
          bare: "bare number without era",
          qualified: "qualified date (pre/post/before/after)",
          mangled: "excel-mangled date",
        };
        skip(i, why[parsed], dateText || cellOf(row, blk.dates[0]!));
        continue;
      }
      let name = "";
      for (const nc of blk.names) {
        const v = cleanText(cellOf(row, nc));
        if (v && !NO_VALUE.test(v)) {
          name = v;
          break;
        }
      }
      name = trunc(name, 300);
      if (!name) {
        skip(i, "no name", dateText);
        continue;
      }
      if (name.length < 3 || CODE.test(name) || AUTHOR_YEAR.test(name) || pureNumber(name) || typeof parseDateCell(name, null) !== "string" && name.length < 14) {
        skip(i, "name looks like a code, citation or date", name);
        continue;
      }
      const rec: TimelineRecord & { row: number } = {
        key: `wbp-${keyBase}-r${i + 1}`,
        row: i + 1,
        dataset: o.dataset,
        datasetLabel: o.datasetLabel,
        kind: parsed.end !== undefined && Math.abs(parsed.end - parsed.start) > 60 ? "period" : "event",
        name,
        start: parsed.start,
        lane: o.lane,
        confidence: "low",
        rank: 0.1,
        sources: [],
        data: { date: trunc(dateText, 200), parser: "wb-parse", ...(section ? { section: trunc(section, 120) } : {}) },
      };
      if (parsed.end !== undefined && parsed.end !== parsed.start) rec.end = parsed.end;
      if (parsed.approx) rec.approx = true;
      const sm = trunc(cleanText(cellOf(row, blk.summary)), 600);
      if (sm && sm !== name && !NO_VALUE.test(sm)) rec.summary = sm;
      const rg = cellOf(row, blk.region);
      if (rg && !NO_VALUE.test(rg)) rec.region = trunc(rg, 120);
      const ty = cellOf(row, blk.type);
      if (ty && !NO_VALUE.test(ty)) rec.type = trunc(ty, 60);
      res.records.push(rec);
      counter++;
    }
  }
  void counter;
  return res;
}
