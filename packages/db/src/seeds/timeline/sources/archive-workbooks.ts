import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";
import { loadAuto, walk } from "./csv-tables.js";

/**
 * Sheets of the archived Kosmographica workbooks (Christodex, Vol 2, Indexes BETA, Greek Philosophers, Daimonologia).
 * The ingest in csv-tables skips archive/ folders and cannot read .xlsx, so tools/extract-archive-workbooks.py exports
 * every sheet to packages/db/data/archive-workbooks/<workbook>/<sheet>.csv and this module runs the same auto-detection
 * on them. One dataset per workbook; the sheet name is the lane. Rows already present in other datasets are removed
 * by the importer (dedupe: true).
 */
const DIR = fileURLToPath(new URL("../../../../data/archive-workbooks", import.meta.url));

const LABELS: Record<string, [dataset: string, label: string]> = {
  "kosmographica-christodex-alpha": ["wb-christodex", "Kosmographica: Christodex (Alpha)"],
  "kosmographica-vol-2": ["wb-kosmographica-vol2", "Kosmographica: Vol 2"],
  "kosmographica-indexes-beta": ["wb-kosmographica-indexes", "Kosmographica: Indexes BETA"],
  "greek-philosophers-list": ["wb-greek-philosophers", "Greek Philosophers List"],
  "interpretatio-universalis-daimonologia": ["wb-daimonologia", "Interpretatio Universalis: Daimonologia"],
};

const prettify = (stem: string) => stem.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const source: TimelineSource = {
  id: "archive-workbooks",
  label: "Archived Kosmographica workbooks",
  trustTier: "tertiary",
  dedupe: true,
  async load(): Promise<TimelineBundle> {
    const records: TimelineRecord[] = [];
    const skipped: { ref: string; reason: string }[] = [];
    if (!fs.existsSync(DIR)) {
      console.warn(`archive-workbooks: ${DIR} not found. Run: python3 tools/extract-archive-workbooks.py`);
      return { records, skipped };
    }
    const files: string[] = [];
    walk(DIR, "", files);
    const seenHash = new Map<string, string>();
    for (const rel of files.sort()) {
      const [wb, file] = rel.split("/") as [string, string];
      const [dataset, label] = LABELS[wb] ?? [`wb-${wb}`, wb];
      const lane = prettify(path.basename(file, ".csv"));
      const before = records.length;
      try {
        loadAuto(rel, DIR, records, skipped, seenHash, { dataset, label, lane });
      } catch (e) {
        skipped.push({ ref: rel, reason: `read error: ${e instanceof Error ? e.message : e}` });
      }
      const where = `packages/db/data/archive-workbooks/${rel} (from ${label})`;
      for (let i = before; i < records.length; i++) records[i]!.sources = [where];
    }
    return { records, skipped };
  },
};

export default source;
