import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "../types.js";

/** Buddhist and Jain stupas with dates, coordinates and Commons images (tools/timeline-stupas.mjs). */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-stupas.mjs", import.meta.url));

interface Row {
  name: string;
  tradition: string;
  start: number;
  end?: number;
  approx?: boolean;
  lat?: number;
  lon?: number;
  place?: string;
  country?: string;
  region?: string;
  desc?: string;
  period?: string;
  image?: { url: string; page: string; credit: string; license: string } | null;
  sources?: string[];
  confidence?: string;
}

const source: TimelineSource = {
  id: "stupas",
  label: "Stupas",
  trustTier: "tertiary",
  dedupe: true,
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; ROWS: Row[] };
    const records: TimelineRecord[] = [];
    const seen = new Set<string>();
    for (const r of mod.ROWS) {
      const key = `${slugifyKey(r.country ?? "")}-${slugifyKey(r.name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rec: TimelineRecord = {
        key,
        dataset: "stupas",
        datasetLabel: mod.GROUP,
        kind: r.end != null ? "period" : "event",
        type: "stupa",
        name: r.name,
        summary: r.desc,
        start: fromHistorical(r.start),
        lane: `${r.tradition} stupas: ${r.country ?? "Unknown"}`,
        region: r.region ?? r.country,
        confidence: r.confidence,
        sources: r.sources,
        rank: 0.4,
        data: { tradition: r.tradition, place: r.place, country: r.country, period: r.period, image: r.image ?? undefined },
      };
      if (r.end != null) rec.end = fromHistorical(r.end);
      if (r.approx) rec.approx = true;
      if (typeof r.lat === "number" && typeof r.lon === "number") { rec.lat = r.lat; rec.lon = r.lon; }
      records.push(rec);
    }
    return { records };
  },
};

export default source;
