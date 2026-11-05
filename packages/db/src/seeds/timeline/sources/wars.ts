import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/**
 * Wars, campaigns, battles, sieges, revolts and treaties across civilizations (tools/timeline-wars/index.mjs).
 * Part-of, ended-by, preceded-by, caused and same-conflict links become relations. Rows that carry a Wikidata Q-id
 * supersede the same item in the `wikidata` dataset (see sources/wikidata.ts).
 */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-wars/index.mjs", import.meta.url));

interface Row {
  id: string; name: string; type: string; start: number; end?: number; approx?: boolean; region: string;
  civilizations?: string[]; lat?: number; lon?: number; place?: string; parent?: string;
  sides?: { name: string; belligerents?: string[] }[]; outcome?: string; summary?: string; confidence?: string;
  sources?: string[]; theme?: string; wikidata?: string; parentInferred?: boolean; unlinked?: boolean;
}

const CAT: Record<string, TimelineRelation["cat"]> = { part_of: "other", ended_by: "other", preceded_by: "other", caused: "influence", same_conflict_as: "parallel" };

const source: TimelineSource = {
  id: "wars",
  label: "Wars & battles",
  trustTier: "structured",
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; ROWS: Row[]; LINKS: { from: string; to: string; type: string }[] };
    const records: TimelineRecord[] = [];
    const ids = new Set<string>();
    for (const r of mod.ROWS) {
      if (ids.has(r.id)) continue;
      ids.add(r.id);
      const start = fromHistorical(r.start);
      const end = r.end != null ? fromHistorical(r.end) : undefined;
      const rec: TimelineRecord = {
        key: r.id,
        dataset: "wars",
        datasetLabel: mod.GROUP,
        kind: end != null && end - start > 1 ? "period" : "event",
        type: r.type,
        name: r.name,
        summary: [r.summary, r.outcome && `Outcome: ${r.outcome}`].filter(Boolean).join("\n\n") || undefined,
        start,
        end,
        approx: r.approx || undefined,
        lane: `${r.region}: ${r.type === "treaty" ? "treaties" : r.type === "battle" || r.type === "naval-battle" || r.type === "siege" ? "battles & sieges" : "wars & campaigns"}`,
        region: r.region,
        confidence: r.confidence,
        sources: r.sources,
        rank: r.type === "war" || r.type === "civil-war" || r.type === "conquest" ? 0.6 : r.type === "campaign" ? 0.45 : 0.3,
        data: { civilizations: r.civilizations, sides: r.sides, theme: r.theme, place: r.place, parent: r.parent, parentInferred: r.parentInferred || undefined, unlinkedTreaty: r.unlinked || undefined },
      };
      if (typeof r.lat === "number" && typeof r.lon === "number") { rec.lat = r.lat; rec.lon = r.lon; }
      if (r.wikidata) rec.externalIds = [{ scheme: "wikidata", value: r.wikidata, url: `https://www.wikidata.org/wiki/${r.wikidata}` }];
      records.push(rec);
    }
    const relations: TimelineRelation[] = [];
    const seenRel = new Set<string>();
    const add = (from: string, to: string, type: string) => {
      if (!ids.has(from) || !ids.has(to) || from === to) return;
      const k = `${from}>${to}:${type}`;
      if (seenRel.has(k)) return;
      seenRel.add(k);
      relations.push({ from: `wars:${from}`, to: `wars:${to}`, type, cat: CAT[type] ?? "other" });
    };
    for (const l of mod.LINKS) add(l.from, l.to, l.type);
    for (const r of mod.ROWS) if (r.parent) add(r.id, r.parent, "part_of");
    return { records, relations };
  },
};

export default source;
