import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/**
 * World History Timeline (6.xlsm, sheet "Timeline"). The workbook is a drawn grid, so the events
 * are pre-extracted by tools/extract-world-history.py into newline-delimited JSON:
 *   python3 tools/extract-world-history.py   (run from the NextWiki root)
 * Years in the ndjson are already astronomical (year 0 = 1 BCE).
 */
const NDJSON = fileURLToPath(new URL("../../../../data/world-history.ndjson", import.meta.url));
const SOURCE_NAME = "World History Timeline 6.xlsm";
const DATASET = "world-history";
const SPAN_PERIOD_YEARS = 60;

interface Row {
  key: string;
  row: number;
  col: number;
  cell: string;
  lane: string;
  section: string;
  name: string;
  summary: string;
  start: number;
  end: number | null;
  approx: boolean;
  source_area: "grid" | "label";
  column_year: number | null;
  date_text: string | null;
  date_kind: string | null;
  has_span: boolean;
}

function toRecord(r: Row): TimelineRecord {
  const span = r.end != null ? r.end - r.start : 0;
  const rec: TimelineRecord = {
    key: r.key,
    dataset: DATASET,
    datasetLabel: "World History Timeline",
    kind: span > SPAN_PERIOD_YEARS ? "period" : "event",
    name: r.name,
    summary: r.summary !== r.name ? r.summary : undefined,
    start: r.start,
    lane: r.lane,
    confidence: "extension",
    rank: 0.2,
    sources: [SOURCE_NAME],
    data: {
      cell: r.cell,
      section: r.section || undefined,
      columnYear: r.column_year,
      dateText: r.date_text,
      dateKind: r.date_kind,
      sourceArea: r.source_area,
      hasSpanMarker: r.has_span,
    },
  };
  if (r.end != null) rec.end = r.end;
  if (r.approx) rec.approx = true;
  return rec;
}

const source: TimelineSource = {
  id: "world-history",
  label: "World History Timeline",
  async load(): Promise<TimelineBundle> {
    if (!fs.existsSync(NDJSON)) {
      console.warn(
        `world-history: ${NDJSON} not found. Generate it with: python3 tools/extract-world-history.py`,
      );
      return { records: [] };
    }
    const records: TimelineRecord[] = [];
    const seen = new Set<string>();
    const lines = fs.readFileSync(NDJSON, "utf8").split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as Row;
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      records.push(toRecord(row));
    }
    return { records };
  },
};

export default source;
