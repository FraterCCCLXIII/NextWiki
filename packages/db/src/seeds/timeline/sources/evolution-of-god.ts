import fs from "node:fs";
import path from "node:path";
import { cleanText, parseDateText, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * Periods from TABLE 1 ("The master timeline") of the evolution-of-god master timeline.
 * The evidence grade in square brackets maps to record.confidence; when a row mixes grades
 * (e.g. "IN SOURCE → EXTENSION") the weakest one is kept.
 */
const DATASET = "evolution-of-god";
const LABEL = "Evolution of God";
const FILE = "evolution-of-god/reference/master-timeline.md";
const LANE = "Evolution of God";
/** Columns after "Era & dates", in table order. */
const COLUMNS = [
  "Population & material context",
  "Concept of God / the divine",
  "Mediator (Messiah / Christ / intermediary)",
  "Cosmos & afterlife",
];
const GRADE_STRENGTH: Record<string, number> = { "IN SOURCE": 0, EXTENSION: 1, INTERPRETIVE: 2 };
const GRADE_CONFIDENCE: Record<string, string> = { "IN SOURCE": "in-source", EXTENSION: "extension", INTERPRETIVE: "interpretive" };
const GRADE_BASE_RANK: Record<string, number> = { "in-source": 0.8, extension: 0.6, interpretive: 0.4 };

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function uniqueKey(base: string, taken: Set<string>): string {
  let key = base;
  for (let i = 2; taken.has(slugifyKey(key) || key); i++) key = `${base}-${i}`;
  taken.add(slugifyKey(key) || key);
  return key;
}

const source: TimelineSource = {
  id: "evolution-of-god",
  label: LABEL,
  trustTier: "tertiary",
  async load({ root }) {
    const lines = fs.readFileSync(path.join(root, FILE), "utf8").split("\n");
    const start = lines.findIndex((l) => /^#+\s*TABLE\s*1\b/i.test(l));
    if (start < 0) throw new Error(`no "TABLE 1" heading in ${FILE}`);
    let end = lines.findIndex((l, i) => i > start && /^#+\s*TABLE\s*\d/i.test(l));
    if (end < 0) end = lines.length;

    const records: TimelineRecord[] = [];
    const skipped: NonNullable<TimelineBundle["skipped"]> = [];
    const taken = new Set<string>();

    for (let i = start + 1; i < end; i++) {
      const L = lines[i]!;
      if (!L.startsWith("|") || /^\|\s*-/.test(L) || /^\|\s*Era/i.test(L)) continue;
      const cells = L.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 2) continue;

      const eraCell = cells[0]!;
      const name = cleanText(eraCell.match(/\*\*(.+?)\*\*/)?.[1] ?? eraCell.split("(")[0]);
      const dates = eraCell.match(/\(([^)]*)\)/)?.[1] ?? "";
      const range = parseDateText(dates, "auto");
      if (!name) continue;
      if (!range) {
        skipped.push({ ref: `${FILE}:${name}`, reason: `unparseable dates "${dates}"` });
        continue;
      }

      const bracket = eraCell.match(/\[([^\]]+)\]/)?.[1] ?? "";
      const grades = [...bracket.toUpperCase().matchAll(/IN SOURCE|EXTENSION|INTERPRETIVE/g)].map((m) => m[0]);
      const weakest = grades.sort((a, b) => (GRADE_STRENGTH[b] ?? 0) - (GRADE_STRENGTH[a] ?? 0))[0];
      const confidence = weakest ? GRADE_CONFIDENCE[weakest] : undefined;

      const summary = cells
        .slice(1)
        .map((c, j) => (cleanText(c) ? `${COLUMNS[j] ?? "Note"}: ${cleanText(c)}` : ""))
        .filter(Boolean)
        .join("\n\n");

      const span = range.end != null ? range.end - range.start : 0;
      const base = (confidence && GRADE_BASE_RANK[confidence]) || 0.5;

      const key = uniqueKey(`period-${name}`, taken);
      records.push({
        key,
        dataset: DATASET,
        datasetLabel: LABEL,
        kind: "period",
        type: "era",
        name,
        summary: summary ? trunc(summary, 1800) : undefined,
        start: range.start,
        end: range.end,
        approx: range.approx || undefined,
        lane: LANE,
        confidence,
        sources: [FILE],
        rank: Math.min(1, base + 0.2 * Math.min(1, span / 10000)),
        data: { dates, evidenceNote: bracket || undefined },
      });
    }

    return { records, relations: [], skipped };
  },
};

export default source;
