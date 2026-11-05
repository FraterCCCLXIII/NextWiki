import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/**
 * Temples and religious sites of all religions (tools/timeline-sites). Taxonomy: Getty AAT type, Wikidata/Pleiades/UNESCO
 * ids as external ids, religion family, site kind and date basis kept in `data`. Stupas are a separate dataset.
 */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-sites/index.mjs", import.meta.url));

interface Row {
  id: string; name: string; alternateNames?: string[]; type: string; typeAat?: { id: string; label: string } | null; siteKind?: string;
  religion?: string; religionQid?: string | null; religionFamily?: string; deity?: string[]; tradition?: string; civilization?: string;
  start: number; end?: number; approx?: boolean; dateBasis?: string | null; periodLabel?: string | null; lat?: number; lon?: number;
  place?: string; country?: string; region?: string; status?: string; description?: string; phases?: string; related?: string[];
  worldHeritage?: boolean; externalIds?: { scheme: string; value: string; url?: string }[];
  image?: { url: string; page: string; credit: string; license: string } | null; sources?: string[]; confidence?: string;
}

const source: TimelineSource = {
  id: "sites",
  label: "Religious sites",
  trustTier: "structured",
  dedupe: true,
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; ROWS: Row[] };
    const records: TimelineRecord[] = [];
    const ids = new Set<string>();
    for (const r of mod.ROWS) {
      if (ids.has(r.id)) continue;
      ids.add(r.id);
      const rec: TimelineRecord = {
        key: r.id,
        dataset: "sites",
        datasetLabel: mod.GROUP,
        kind: r.end != null ? "period" : "event",
        type: r.type,
        name: r.name,
        summary: [r.description, r.phases].filter(Boolean).join("\n\n") || undefined,
        start: fromHistorical(r.start),
        lane: `${r.religionFamily ?? "Unclassified"}: sites`,
        region: r.region,
        confidence: r.confidence,
        sources: r.sources,
        rank: r.worldHeritage ? 0.5 : 0.25,
        data: {
          alternateNames: r.alternateNames, typeAat: r.typeAat ?? undefined, siteKind: r.siteKind, religion: r.religion, religionQid: r.religionQid ?? undefined,
          religionFamily: r.religionFamily, deity: r.deity, tradition: r.tradition, civilization: r.civilization, dateBasis: r.dateBasis ?? undefined,
          periodLabel: r.periodLabel ?? undefined, place: r.place, country: r.country, status: r.status, worldHeritage: r.worldHeritage || undefined,
          image: r.image ?? undefined, related: r.related,
        },
      };
      if (r.end != null) rec.end = fromHistorical(r.end);
      if (r.approx) rec.approx = true;
      if (typeof r.lat === "number" && typeof r.lon === "number") { rec.lat = r.lat; rec.lon = r.lon; }
      if (r.externalIds?.length) rec.externalIds = r.externalIds.map((e) => ({ scheme: e.scheme, value: e.value, url: e.url }));
      records.push(rec);
    }
    const relations: TimelineRelation[] = [];
    for (const r of mod.ROWS) for (const rel of r.related ?? []) if (ids.has(rel) && rel !== r.id) relations.push({ from: `sites:${r.id}`, to: `sites:${rel}`, type: "related_to", cat: "other" });
    return { records, relations };
  },
};

export default source;
