import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { cleanText, fromHistorical, slugifyKey } from "../dates.js";
import type { TimelineBundle, TimelineRecord, TimelineRelation, TimelineSource } from "../types.js";

/**
 * Sacred-Lineage (data/dev.db, read through the sqlite3 CLI, read-only queries).
 * Figures with a birth year become events with a lifespan; traditions with a founding year become
 * events in the "Traditions" lane; relationships between dated figures become relations.
 * Record keys are `m<masterId>` and `t<traditionId>`, so they stay stable across re-imports.
 */
const DATASET = "lineages";
const LABEL = "Lineages";
const DB = "Sacred-Lineage/data/dev.db";
const TRADITIONS_LANE = "Traditions";

interface Master {
  id: number;
  name: string | null;
  overview: string | null;
  year_born: number;
  year_died: number | null;
  location: string | null;
  date_born: string | null;
  source_catalog: string | null;
}
interface Tradition {
  id: number;
  name: string;
  description: string | null;
  region: string | null;
  year_founded: number;
  active_period_end: number | null;
}
interface Charted {
  mid: number;
  chart: string;
}
interface Rel {
  a: number;
  b: number;
  tkey: string | null;
  tname: string | null;
}

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Relationship types whose meaning is influence, debate or criticism rather than transmission. */
const isInfluence = (s: string) => /influenc|debat|critic/i.test(s);

function query<T>(db: string, sql: string): T[] {
  const out = execFileSync("sqlite3", ["-json", db, sql], { maxBuffer: 1 << 28 }).toString().trim();
  return out ? (JSON.parse(out) as T[]) : [];
}

const source: TimelineSource = {
  id: "lineages",
  label: LABEL,
  trustTier: "structured",
  async load({ root }) {
    const db = path.join(root, DB);

    const charts = query<Charted>(
      db,
      `select ml.master_id mid, c.name chart from master_lineages ml
         join lineage_charts c on c.id = ml.lineage_id
         order by ml.is_root desc, ml.id`,
    );
    const assignMod = (await import(pathToFileURL(fileURLToPath(new URL("../../../../../../tools/timeline-lineage-assignments.mjs", import.meta.url))).href)) as { ASSIGNMENTS: { masterId: number; lane: string; confidence: string }[] };
    const assigned = new Map(assignMod.ASSIGNMENTS.filter((a) => a.confidence !== "low").map((a) => [a.masterId, a.lane]));
    const chartOf = new Map<number, string>();
    for (const c of charts) if (!chartOf.has(c.mid)) chartOf.set(c.mid, cleanText(c.chart));

    const figures = query<Master>(
      db,
      `select id, name, overview, year_born, year_died, location, date_born, source_catalog
         from masters where year_born is not null order by id`,
    );
    const traditions = query<Tradition>(
      db,
      `select id, name, description, region, year_founded, active_period_end
         from traditions where year_founded is not null order by id`,
    );
    const rels = query<Rel>(
      db,
      `select r.parent_master_id a, r.child_master_id b, t.key tkey, t.name tname
         from relationships r left join relationship_types t on t.id = r.relationship_type_id`,
    );

    const records: TimelineRecord[] = [];
    const skipped: NonNullable<TimelineBundle["skipped"]> = [];
    const figureIds = new Set<number>();

    for (const f of figures) {
      const start = fromHistorical(f.year_born);
      const end = f.year_died != null && f.year_died >= f.year_born ? fromHistorical(f.year_died) : undefined;
      const name = cleanText(f.name);
      if (!name) {
        skipped.push({ ref: `masters:${f.id}`, reason: "empty name" });
        continue;
      }
      figureIds.add(f.id);
      records.push({
        key: `m${f.id}`,
        dataset: DATASET,
        datasetLabel: LABEL,
        kind: "event",
        type: "figure",
        name,
        summary: f.overview ? trunc(cleanText(f.overview), 900) : undefined,
        start,
        end,
        approx: /c\.|ca\.|~|\?/.test(f.date_born ?? "") || undefined,
        lane: chartOf.get(f.id) ?? assigned.get(f.id) ?? "Unassigned lineage",
        region: cleanText(f.location) || undefined,
        sources: [DB, ...(f.source_catalog ? [cleanText(f.source_catalog)] : [])],
        data: { dateBorn: f.date_born ?? undefined },
      });
    }

    for (const t of traditions) {
      const name = cleanText(t.name);
      if (!name) {
        skipped.push({ ref: `traditions:${t.id}`, reason: "empty name" });
        continue;
      }
      records.push({
        key: `t${t.id}`,
        dataset: DATASET,
        datasetLabel: LABEL,
        kind: "event",
        type: "tradition",
        name,
        summary: t.description ? trunc(cleanText(t.description), 600) : undefined,
        start: fromHistorical(t.year_founded),
        end: t.active_period_end != null ? fromHistorical(t.active_period_end) : undefined,
        lane: TRADITIONS_LANE,
        region: cleanText(t.region) || undefined,
        sources: [DB],
        rank: 0.6,
      });
    }

    // Relationships between dated figures, de-duplicated across lineage charts.
    const relations: TimelineRelation[] = [];
    const degree = new Map<number, number>();
    const seen = new Set<string>();
    for (const r of rels) {
      if (!figureIds.has(r.a) || !figureIds.has(r.b) || r.a === r.b) continue;
      const type = r.tkey ?? "related";
      const sig = `${r.a}>${r.b}:${type}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      degree.set(r.a, (degree.get(r.a) ?? 0) + 1);
      degree.set(r.b, (degree.get(r.b) ?? 0) + 1);
      relations.push({
        from: `${DATASET}:m${r.a}`,
        to: `${DATASET}:m${r.b}`,
        type,
        cat: isInfluence(`${r.tkey ?? ""} ${r.tname ?? ""}`) ? "influence" : "transmission",
      });
    }

    // Figures with more recorded links rank higher on the timeline.
    for (const rec of records) {
      if (rec.type !== "figure") continue;
      const id = Number(rec.key.slice(1));
      rec.rank = Math.min(1, 0.2 + 0.08 * (degree.get(id) ?? 0));
    }

    return { records, relations, skipped };
  },
};

export default source;
