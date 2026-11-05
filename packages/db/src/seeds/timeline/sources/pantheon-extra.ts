import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/** Extra deities and sacred figures for thin Pantheons lanes (tools/timeline-pantheon-extra.mjs). */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-pantheon-extra.mjs", import.meta.url));

type Row = [name: string, start: number, end: number | null, lane: string, description: string, approx: boolean];
type Meta = { tradition?: string; role?: string; attestation?: string; sources?: string[] };

const source: TimelineSource = {
  id: "pantheon-extra",
  label: "Pantheons (extra)",
  trustTier: "tertiary",
  dedupe: true,
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { ROWS: Row[]; META: Record<string, Meta> };
    const records: TimelineRecord[] = mod.ROWS.map(([name, start, end, lane, summary, approx]) => {
      const m = mod.META[`${lane}|${name}`] ?? {};
      return {
        key: `${slugifyKey(lane)}-${slugifyKey(name)}`,
        dataset: "pantheon-extra",
        datasetLabel: "Pantheons (extra)",
        kind: "event",
        type: m.role ?? "deity",
        name,
        summary: [summary, m.attestation && `Date basis: ${m.attestation}`].filter(Boolean).join("\n\n"),
        start: fromHistorical(start),
        end: end != null ? fromHistorical(end) : undefined,
        approx: approx || undefined,
        lane,
        confidence: "medium",
        rank: 0.3,
        sources: m.sources?.length ? m.sources : ["tools/timeline-pantheon-extra.mjs"],
        data: { tradition: m.tradition },
      };
    });
    return { records };
  },
};

export default source;
