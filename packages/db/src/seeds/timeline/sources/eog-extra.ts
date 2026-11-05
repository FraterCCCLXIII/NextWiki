import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/** Finer-grained rows from evolution-of-god/reference/master-timeline.md (tools/timeline-eog-extra.mjs). */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-eog-extra.mjs", import.meta.url));

interface Row { id: string; name: string; start: number; end?: number; approx?: boolean; lane: string; era: string; eraId: string; description: string; grade: string; source: string }

const source: TimelineSource = {
  id: "eog-extra",
  label: "Evolution of God: detail rows",
  trustTier: "tertiary",
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; ROWS: Row[]; LINKS: { from: string; to: string; type: string }[] };
    const records: TimelineRecord[] = mod.ROWS.map((r) => ({
      key: r.id,
      dataset: "eog-extra",
      datasetLabel: "Evolution of God: detail",
      kind: r.end != null ? "period" : "event",
      name: r.name,
      summary: r.description,
      start: fromHistorical(r.start),
      end: r.end != null ? fromHistorical(r.end) : undefined,
      approx: r.approx || undefined,
      lane: r.lane,
      confidence: r.grade.toLowerCase().replace(/ /g, "-"),
      sources: [`evolution-of-god/reference/${r.source}`],
      data: { era: r.era, eraId: r.eraId, grade: r.grade },
    }));
    return { records };
  },
};

export default source;
