import { fileURLToPath, pathToFileURL } from "node:url";
import { fromHistorical } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/** Royal houses and monarchs with succession and family links (tools/timeline-royals). Houses and monarchs share one dataset so links resolve. */
const FILE = fileURLToPath(new URL("../../../../../../tools/timeline-royals/index.mjs", import.meta.url));

interface House { id: string; name: string; alternateNames?: string[]; realm?: string; civilization?: string; region?: string; start: number; end?: number; approx?: boolean; capital?: string; lat?: number; lon?: number; parentHouse?: string; summary?: string; wikidata?: string; confidence?: string; sources?: string[] }
interface Monarch { id: string; name: string; regnalName?: string; title?: string; realm?: string; house: string; birth?: number; death?: number; reignStart: number; reignEnd?: number; approx?: boolean; accession?: string; endOfReign?: string; fatherName?: string; motherName?: string; spouseNames?: string[]; legendary?: boolean; summary?: string; wikidata?: string; confidence?: string; sources?: string[] }

const CAT: Record<string, TimelineRelation["cat"]> = { parent_of: "genealogical", spouse_of: "genealogical", sibling_of: "genealogical", member_of_house: "genealogical", branch_of: "genealogical", succeeded_by: "transmission", preceded_by: "transmission", usurped: "other", regent_for: "other" };

const source: TimelineSource = {
  id: "royals",
  label: "Royal houses",
  trustTier: "structured",
  async load(): Promise<TimelineBundle> {
    const mod = (await import(pathToFileURL(FILE).href)) as { GROUP: string; HOUSES: House[]; MONARCHS: Monarch[]; LINKS: { from: string; to: string; type: string }[] };
    const regionOfHouse = new Map(mod.HOUSES.map((h) => [h.id, h.region]));
    const houseName = new Map(mod.HOUSES.map((h) => [h.id, h.name]));
    const records: TimelineRecord[] = [];
    const ids = new Set<string>();

    for (const h of mod.HOUSES) {
      if (ids.has(h.id)) continue;
      ids.add(h.id);
      const rec: TimelineRecord = {
        key: h.id, dataset: "royals", datasetLabel: mod.GROUP, kind: h.end != null ? "period" : "event", type: "royal-house", name: h.name, summary: h.summary,
        start: fromHistorical(h.start), lane: `Royal houses: ${h.region ?? "Unclassified"}`, region: h.region, confidence: h.confidence, sources: h.sources,
        rank: 0.55, data: { realm: h.realm, civilization: h.civilization, capital: h.capital, alternateNames: h.alternateNames, parentHouse: h.parentHouse },
      };
      if (h.end != null) rec.end = fromHistorical(h.end);
      if (h.approx) rec.approx = true;
      if (typeof h.lat === "number" && typeof h.lon === "number") { rec.lat = h.lat; rec.lon = h.lon; }
      if (h.wikidata) rec.externalIds = [{ scheme: "wikidata", value: h.wikidata, url: `https://www.wikidata.org/wiki/${h.wikidata}` }];
      records.push(rec);
    }
    for (const m of mod.MONARCHS) {
      if (ids.has(m.id)) continue;
      ids.add(m.id);
      const region = regionOfHouse.get(m.house);
      const rec: TimelineRecord = {
        key: m.id, dataset: "royals", datasetLabel: mod.GROUP, kind: m.reignEnd != null ? "period" : "event", type: m.legendary ? "legendary-monarch" : "monarch",
        name: m.regnalName && !m.name.includes(m.regnalName) ? `${m.name} (${m.regnalName})` : m.name, summary: m.summary,
        start: fromHistorical(m.reignStart), lane: `Monarchs: ${region ?? "Unclassified"}`, region, confidence: m.confidence, sources: m.sources,
        rank: 0.3,
        data: { title: m.title, realm: m.realm, house: houseName.get(m.house) ?? m.house, houseId: m.house, birth: m.birth, death: m.death, accession: m.accession, endOfReign: m.endOfReign, father: m.fatherName, mother: m.motherName, spouses: m.spouseNames, legendary: m.legendary || undefined },
      };
      if (m.reignEnd != null) rec.end = fromHistorical(m.reignEnd);
      if (m.approx) rec.approx = true;
      if (m.wikidata) rec.externalIds = [{ scheme: "wikidata", value: m.wikidata, url: `https://www.wikidata.org/wiki/${m.wikidata}` }];
      records.push(rec);
    }
    const relations: TimelineRelation[] = [];
    const seen = new Set<string>();
    for (const l of mod.LINKS) {
      if (!ids.has(l.from) || !ids.has(l.to) || l.from === l.to) continue;
      const k = `${l.from}>${l.to}:${l.type}`;
      if (seen.has(k)) continue;
      seen.add(k);
      relations.push({ from: `royals:${l.from}`, to: `royals:${l.to}`, type: l.type, cat: CAT[l.type] ?? "other" });
    }
    return { records, relations };
  },
};

export default source;
