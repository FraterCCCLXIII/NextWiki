import { sql } from "drizzle-orm";
import {
  addClaim,
  addExternalId,
  chunk,
  ensureTaxon,
  inBatch,
  linkEntityTaxon,
  slugify,
  upsertEntity,
  upsertSource,
  type Db,
} from "../kosmo/util.js";
import * as schema from "../../schema/index.js";
import { slugifyKey } from "./dates.js";
import { regionFor } from "./normalize.js";
import type { TimelineBundle, TimelineRecord, TimelineSource } from "./types.js";

export const entitySlug = (r: Pick<TimelineRecord, "dataset" | "key">) => `tl-${r.dataset}-${slugifyKey(r.key) || slugify(r.key)}`;

export interface ValidationReport {
  records: number;
  valid: TimelineRecord[];
  problems: { ref: string; reason: string }[];
  minYear: number;
  maxYear: number;
}

/** Drops records the database cannot hold and reports why. */
export function validate(bundle: TimelineBundle): ValidationReport {
  const seen = new Set<string>();
  const valid: TimelineRecord[] = [];
  const problems: { ref: string; reason: string }[] = [...(bundle.skipped ?? [])];
  let minYear = Infinity;
  let maxYear = -Infinity;
  for (const r of bundle.records) {
    const ref = `${r.dataset}:${r.key}`;
    if (!r.name?.trim()) { problems.push({ ref, reason: "empty name" }); continue; }
    if (!Number.isFinite(r.start)) { problems.push({ ref, reason: "start is not a number" }); continue; }
    if (r.end != null && !Number.isFinite(r.end)) { problems.push({ ref, reason: "end is not a number" }); continue; }
    if (r.start < -14e9 || r.start > 3000) { problems.push({ ref, reason: `start ${r.start} outside -14e9..3000` }); continue; }
    if (!r.lane?.trim()) { problems.push({ ref, reason: "empty lane" }); continue; }
    const slug = entitySlug(r);
    if (seen.has(slug)) { problems.push({ ref, reason: "duplicate key" }); continue; }
    seen.add(slug);
    const rec = { ...r };
    if (rec.end != null && rec.end < rec.start) [rec.start, rec.end] = [rec.end, rec.start];
    if (rec.end === rec.start) delete rec.end;
    valid.push(rec);
    minYear = Math.min(minYear, rec.start);
    maxYear = Math.max(maxYear, rec.end ?? rec.start);
  }
  return { records: bundle.records.length, valid, problems, minYear, maxYear };
}

const precisionOf = (r: TimelineRecord) => {
  if (r.startMin != null && r.startMax != null) return Math.max((r.startMax - r.startMin) / 2, 1);
  if (r.approx) return Math.max(Math.abs((r.end ?? r.start) - r.start) * 0.05, Math.abs(r.start) > 1000 ? 50 : 10);
  return 1;
};

/** Writes one dataset: entities, date claims, lane taxa, external ids and relations. Idempotent. */
export async function importBundle(db: Db, source: TimelineSource, bundle: TimelineBundle, report: ValidationReport) {
  const first = report.valid[0];
  if (!first) return { entities: 0, relations: 0 };
  const sourceId = await upsertSource(db, { key: `timeline-${first.dataset}`, title: source.label });
  const rootTaxon = await ensureTaxon(db, { scheme: "history", slug: "timeline-lanes", name: "Timeline lanes" });
  const datasetTaxon = new Map<string, number>();
  const laneTaxon = new Map<string, number>();
  const idByRef = new Map<string, number>();

  for (const batch of chunk(report.valid, 150)) {
    await inBatch(db, async (tx) => {
      for (const r of batch) {
        let dTax = datasetTaxon.get(r.dataset);
        if (!dTax) {
          dTax = await ensureTaxon(tx, { scheme: "history", slug: `lane-${r.dataset}`, name: r.datasetLabel, parentId: rootTaxon });
          datasetTaxon.set(r.dataset, dTax);
        }
        const laneKey = `${r.dataset}|${r.lane}`;
        let lTax = laneTaxon.get(laneKey);
        if (!lTax) {
          lTax = await ensureTaxon(tx, { scheme: "history", slug: `lane-${r.dataset}-${slugifyKey(r.lane) || "x"}`, name: r.lane, parentId: dTax });
          laneTaxon.set(laneKey, lTax);
        }
        const precision = precisionOf(r);
        const id = await upsertEntity(tx, {
          slug: entitySlug(r),
          kind: r.kind,
          name: r.name.slice(0, 400),
          type: r.type ?? null,
          summary: r.summary ?? null,
          sourceId,
          timeStart: r.start,
          timeEnd: r.end ?? null,
          timePrecisionYears: precision,
          timeKind: r.end != null ? "interval" : "instant",
          data: {
            timeline: true,
            dataset: r.dataset,
            datasetLabel: r.datasetLabel,
            lane: r.lane,
            region: regionFor(r.lane, r.region),
            confidence: r.confidence,
            approx: r.approx || undefined,
            lat: r.lat,
            lon: r.lon,
            rank: r.rank,
            sources: r.sources,
            ...(r.data ?? {}),
          },
        });
        idByRef.set(`${r.dataset}:${r.key}`, id);
        await linkEntityTaxon(tx, id, lTax);
        for (const ext of r.externalIds ?? []) await addExternalId(tx, { entityId: id, scheme: ext.scheme, value: ext.value, url: ext.url ?? null, sourceId });
        const qualifiers = { earliest: r.startMin, latest: r.startMax, approx: r.approx || undefined, calendar: "astronomical" };
        await addClaim(tx, { subjectId: id, predicate: "time_start", valueText: "best", valueNum: r.start, valueErr: precision, unit: "year", sourceId, method: "verbatim", qualifiers });
        if (r.end != null) await addClaim(tx, { subjectId: id, predicate: "time_end", valueText: "best", valueNum: r.end, valueErr: precision, unit: "year", sourceId, method: "verbatim", qualifiers: { approx: r.approx || undefined, calendar: "astronomical" } });
      }
    });
  }

  let relations = 0;
  for (const batch of chunk(bundle.relations ?? [], 300)) {
    await inBatch(db, async (tx) => {
      for (const rel of batch) {
        const a = idByRef.get(rel.from);
        const b = idByRef.get(rel.to);
        if (!a || !b || a === b) continue;
        await addClaim(tx, { subjectId: a, predicate: `timeline:${rel.type}`, objectId: b, sourceId, method: "verbatim", qualifiers: { cat: rel.cat, weight: rel.weight } });
        relations++;
      }
    });
  }
  return { entities: report.valid.length, relations };
}

/** Removes everything a dataset previously wrote, so a changed source does not leave stale rows. */
export async function purgeDataset(db: Db, dataset: string) {
  await db.execute(sql`delete from kosmo_entities where slug like ${`tl-${dataset}-%`}`);
}
export { schema };
