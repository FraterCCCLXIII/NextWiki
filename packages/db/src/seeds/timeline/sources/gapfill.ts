import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/**
 * Curated context rows shared with the static timeline.json build (tools/timeline-gapfill.mjs).
 * Edit the rows there; both the JSON build and this seed read the same file.
 */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-gapfill.mjs", import.meta.url));

const CIT_FILE = fileURLToPath(new URL("../../../../../../tools/timeline-citations.mjs", import.meta.url));
const JSON_FILE = fileURLToPath(new URL("../../../../../../apps/web/public/timeline/timeline.json", import.meta.url));

type Row = [name: string, start: number, end: number | null, lane: string, description: string, approx: boolean];

const source: TimelineSource = {
  id: "gapfill",
  label: "World context (curated)",
  trustTier: "generated",
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; ROWS: Row[]; EDGES?: [string, string, string, string, string, string][] };
    const cmod = (await import(pathToFileURL(CIT_FILE).href)) as { CITATIONS: Record<string, { checked: string; sources?: string[]; fix?: { start?: number; end?: number; description?: string } }> };
    const records: TimelineRecord[] = [];
    const seen = new Set<string>();
    // skip rows that another dataset already carries under the same name (read from the built timeline.json)
    const have = new Set<string>();
    if (fs.existsSync(JSON_FILE)) {
      const j = JSON.parse(fs.readFileSync(JSON_FILE, "utf8")) as { items: { n: string; grp: string }[] };
      for (const i of j.items) if (i.grp !== mod.GROUP) have.add(i.n.toLowerCase());
    }
    for (const [name, start0, end0, lane, summary0, approx] of mod.ROWS) {
      const cit = cmod.CITATIONS[`${lane}|${name}`];
      const fix = cit?.checked === "corrected" ? cit.fix ?? {} : {};
      const start = fix.start ?? start0;
      const end = "end" in fix ? (fix.end as number | undefined) ?? null : end0;
      const summary = fix.description ?? summary0;
      if (have.has(name.toLowerCase())) continue;
      const key = `${slugifyKey(lane)}-${slugifyKey(name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec: TimelineRecord = {
        key,
        dataset: "gapfill",
        datasetLabel: mod.GROUP,
        kind: end != null ? "period" : "event",
        name,
        summary,
        start: fromHistorical(start),
        lane,
        confidence: cit?.checked === "unverified" ? "low" : "extension",
        rank: 0.3,
        sources: cit?.sources?.length ? cit.sources : ["tools/timeline-gapfill.mjs"],
      };
      if (end != null) rec.end = fromHistorical(end);
      if (approx) rec.approx = true;
      records.push(rec);
    }
    const keyOf = (n: string, lane: string) => `gapfill:${slugifyKey(lane)}-${slugifyKey(n)}`;
    const relations: TimelineRelation[] = [];
    for (const [na, la, nb, lb, type, cat] of mod.EDGES ?? []) {
      if (seen.has(keyOf(na, la).slice(8)) && seen.has(keyOf(nb, lb).slice(8))) relations.push({ from: keyOf(na, la), to: keyOf(nb, lb), type, cat: cat as TimelineRelation["cat"] });
    }
    return { records, relations };
  },
};

export default source;
