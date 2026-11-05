import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";
import { loadAuto, walk } from "./csv-tables.js";
import { parseCsv } from "./_csv.js";
import { recoverSheet, sheetKeyBase, type WbSkip } from "./_wb-parse.js";

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
      const stockRecs: TimelineRecord[] = [];
      const stockSkips: { ref: string; reason: string }[] = [];
      try {
        loadAuto(rel, DIR, stockRecs, stockSkips, seenHash, { dataset, label, lane });
      } catch (e) {
        skipped.push({ ref: rel, reason: `read error: ${e instanceof Error ? e.message : e}` });
        continue;
      }
      if (stockSkips.some((s) => s.ref === rel && s.reason === "duplicate content")) {
        skipped.push(...stockSkips);
        continue;
      }
      // second pass: the layout-tolerant reader (_wb-parse) for rows the stock auto-detect dropped or never looked at
      let extra: ReturnType<typeof recoverSheet> | null = null;
      try {
        extra = recoverSheet(parseCsv(fs.readFileSync(path.join(DIR, rel), "utf8")), { rel, dataset, datasetLabel: label, lane });
      } catch (e) {
        skipped.push({ ref: rel, reason: `wb-parse error: ${e instanceof Error ? e.message : e}` });
      }
      const kept = new Set<number>();
      for (const r of stockRecs) {
        const m = /-r(\d+)$/.exec(r.key);
        if (m) kept.add(Number(m[1]));
      }
      const recovered = new Map<number, TimelineRecord>();
      for (const r of extra?.records ?? []) if (!kept.has(r.row)) recovered.set(r.row, r);
      const keyBase = sheetKeyBase(rel);
      const rowOf = (ref: string): number | null => {
        const a = /#(\d+)$/.exec(ref);
        if (a && ref.startsWith(rel + "#")) return Number(a[1]);
        const b = /^[^:]+:(.+)-r(\d+)$/.exec(ref); // "auto: name looks like a code" refs are dataset:key
        return b && b[1] === keyBase ? Number(b[2]) : null;
      };
      const mineByRow = new Map<number, WbSkip>();
      for (const s of extra?.skipped ?? []) mineByRow.set(s.row, s);
      const stockRows = new Set<number>();
      const sheetLevel: { ref: string; reason: string }[] = [];
      const rowLevel: { ref: string; reason: string }[] = [];
      for (const s of stockSkips) {
        const row = rowOf(s.ref);
        if (row === null) {
          sheetLevel.push(s);
          continue;
        }
        stockRows.add(row);
        if (recovered.has(row)) continue;
        const mine = mineByRow.get(row);
        // keep csv-tables' wording where both agree something is wrong; use ours where it knows more (headings, bare numbers, ...)
        rowLevel.push(mine && mine.reason !== "no usable date column in block" ? { ref: s.ref, reason: mine.reason } : s);
      }
      const sheetRejected = sheetLevel.some((s) => s.reason.startsWith("auto:") && !s.reason.includes("code or citation"));
      if (sheetRejected && !recovered.size) {
        skipped.push(...sheetLevel);
        if (extra?.skipped.length) skipped.push({ ref: rel, reason: "wb-parse: no rows with a usable date" });
      } else {
        skipped.push(...sheetLevel.filter((s) => !s.reason.startsWith("auto:") || s.reason.includes("code or citation")));
        if (sheetRejected) for (const s of extra?.skipped ?? []) if (!recovered.has(s.row)) rowLevel.push({ ref: s.ref, reason: s.reason });
      }
      skipped.push(...rowLevel);
      // rows the stock pass never flagged (it started below its header) stay unlisted: they were never candidate rows
      void stockRows;
      records.push(...stockRecs);
      for (const r of recovered.values()) {
        const { row: _row, ...rec } = r as TimelineRecord & { row: number };
        records.push(rec);
      }
      if (process.env.WB_LOG && extra) {
        const lines = extra.skipped.filter((s) => s.text !== undefined).map((s) => JSON.stringify({ ref: s.ref, reason: s.reason, text: s.text }));
        const ok = [...recovered.values()].map((r) => JSON.stringify({ ref: `${rel}#${(r as TimelineRecord & { row: number }).row}`, ok: r.name, date: r.data?.date, start: r.start, end: r.end }));
        fs.appendFileSync(process.env.WB_LOG, [...lines, ...ok].join("\n") + "\n");
      }
      const where = `packages/db/data/archive-workbooks/${rel} (from ${label})`;
      for (let i = before; i < records.length; i++) records[i]!.sources = [where];
    }
    return { records, skipped };
  },
};

export default source;
