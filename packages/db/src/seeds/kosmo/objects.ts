import fs from "node:fs";
import path from "node:path";
import {
  addClaim,
  addExternalId,
  chunk,
  reconcileRelation,
  ensurePage,
  ensureTaxon,
  inBatch,
  linkClaimSource,
  linkEntityTaxon,
  slugify,
  upsertEntity,
  upsertSource,
  type Db,
} from "./util.js";
import {
  formatPlanReport,
  planCatalogue,
  type CatalogueRow,
  type ImportPlan,
} from "./plan.js";

const BATCH_SIZE = 250;
const CATALOG_REL = path.join(
  "apps",
  "web",
  "public",
  "kosmo",
  "data",
  "catalog",
  "objects.json",
);

export interface ObjectImportOptions {
  /** Plan and report, write nothing. */
  check?: boolean;
  /** Import only the first n rows (smoke test). */
  limit?: number;
}

function resolveCatalogFile(): string {
  const candidates = [
    process.env.KOSMO_OBJECTS_JSON,
    path.resolve(process.cwd(), CATALOG_REL),
    path.resolve(process.cwd(), "..", "..", CATALOG_REL),
    path.resolve(process.cwd(), "..", CATALOG_REL),
  ].filter((p): p is string => Boolean(p));
  const hit = candidates.find((p) => fs.existsSync(p));
  if (!hit) {
    throw new Error(
      `objects.json not found (tried: ${candidates.join(", ")})`
    );
  }
  return hit;
}

function humanize(s: string): string {
  const spaced = s.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function objectMarkdown(row: CatalogueRow): string {
  return [
    `The Kosmographica object index entry for ${row.name}.`,
    "",
    `{{kosmo:infobox:object:${row.id}}}`,
    "",
    `{{kosmo:links:object:${row.id}}}`,
    "",
  ].join("\n");
}

/** Reads the catalogue and plans it without touching a database. */
export function readCataloguePlan(
  options: ObjectImportOptions = {},
): ImportPlan {
  const file = resolveCatalogFile();
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as CatalogueRow[];
  return planCatalogue(rows, { limit: options.limit });
}

/**
 * Imports the catalogue of astronomical objects as entities, claims, sources,
 * external ids, taxa and wiki pages.
 *
 * Every number becomes a claim with its unit, method and source; parent names
 * become relations only when they resolve to exactly one entity, and a citation
 * list becomes one source row per cited host. `check` prints the same report
 * without writing, which is how an import is reviewed before it runs.
 */
export async function importObjects(
  database: Db,
  userId: number,
  options: ObjectImportOptions = {}
): Promise<ImportPlan> {
  const plan = readCataloguePlan(options);

  console.log(`  -> Catalogue plan\n${indent(formatPlanReport(plan))}`);
  if (options.check) {
    console.log("  -> check only: nothing written");
    return plan;
  }

  // Sources first: every claim and external id points at one.
  const sourceIdByKey = new Map<string, number>();
  for (const source of plan.stats.sources) {
    sourceIdByKey.set(
      source.key,
      await upsertSource(database, {
        key: source.key,
        title: source.key,
        url: source.url,
      })
    );
  }

  const taxonCache = new Map<string, number>();
  const entityIdByObjectId = new Map<string, number>();
  const batches = chunk(plan.entities, BATCH_SIZE);

  // Pass 1: entities, claims, provenance, external ids, taxa and pages.
  let done = 0;
  for (const batch of batches) {
    await inBatch(database, async (tx) => {
      for (const planned of batch) {
        const primarySourceId = planned.sourceKeys.length
          ? (sourceIdByKey.get(planned.sourceKeys[0]!) ?? null)
          : null;

        const entityId = await upsertEntity(tx, {
          slug: planned.slug,
          kind: "object",
          name: planned.name,
          type: planned.type,
          data: planned.data,
          sourceId: primarySourceId,
        });
        entityIdByObjectId.set(planned.objectId, entityId);

        let taxonId = taxonCache.get(planned.type);
        if (taxonId === undefined) {
          taxonId = await ensureTaxon(tx, {
            scheme: "astronomy",
            slug: slugify(planned.type),
            name: humanize(planned.type),
          });
          taxonCache.set(planned.type, taxonId);
        }
        await linkEntityTaxon(tx, entityId, taxonId);

        for (const claim of planned.claims) {
          const claimSourceIds = claim.sourceKeys
            .map((key) => sourceIdByKey.get(key))
            .filter((id): id is number => id !== undefined);

          // Relations are written in pass 2, once every entity has an id.
          if (claim.field === "parent") continue;

          const claimId = await addClaim(tx, {
            subjectId: entityId,
            predicate: claim.predicate,
            objectId: null,
            valueText: claim.valueText ?? null,
            valueNum: claim.valueNum ?? null,
            unit: claim.unit ?? null,
            sourceId: claimSourceIds[0] ?? null,
            method: claim.method,
            qualifiers: claim.qualifiers ?? {},
          });

          for (const sourceId of claimSourceIds) {
            await linkClaimSource(tx, {
              claimId,
              sourceId,
              locator: claim.field,
            });
          }
        }

        for (const ext of planned.externalIds) {
          await addExternalId(tx, {
            entityId,
            scheme: ext.scheme,
            value: ext.value,
            url: ext.url ?? null,
            sourceId: ext.sourceKey
              ? (sourceIdByKey.get(ext.sourceKey) ?? null)
              : null,
          });
        }

        await ensurePage(tx, {
          path: `/kosmo/object/${slugify(planned.objectId)}`,
          title: planned.name.slice(0, 255),
          markdown: objectMarkdown(planned.data),
          userId,
          tags: [planned.type, "kosmo"],
          entityId,
        });
      }
    });
    done += batch.length;
    console.log(`    ↳ objects: ${done}/${plan.entities.length}`);
  }

  // Pass 2: relations, now that every entity id is known. A relation that
  // resolves now replaces any text relation left by an earlier partial import.
  let relations = 0;
  let replacedTextRelations = 0;
  for (const batch of batches) {
    await inBatch(database, async (tx) => {
      for (const planned of batch) {
        const subjectId = entityIdByObjectId.get(planned.objectId);
        if (subjectId === undefined) continue;
        for (const claim of planned.claims) {
          if (claim.field !== "parent") continue;
          const parentEntityId =
            claim.objectId === undefined
              ? undefined
              : entityIdByObjectId.get(claim.objectId);
          if (claim.objectId !== undefined && parentEntityId === undefined) {
            continue;
          }
          const claimSourceIds = claim.sourceKeys
            .map((key) => sourceIdByKey.get(key))
            .filter((id): id is number => id !== undefined);
          // The plan drops the parent name once it resolves, so take it from
          // the catalogue row and clear whatever an older import decided.
          const parentName = String(planned.data.parent ?? "");
          if (parentName.trim()) {
            replacedTextRelations += await reconcileRelation(tx, {
              subjectId,
              predicate: claim.predicate,
              parentName,
              targetEntityId: parentEntityId,
            });
          }
          const claimId = await addClaim(tx, {
            subjectId,
            predicate: claim.predicate,
            objectId: parentEntityId ?? null,
            valueText: claim.valueText ?? null,
            valueNum: null,
            unit: null,
            sourceId: claimSourceIds[0] ?? null,
            method: claim.method,
            qualifiers: claim.qualifiers ?? {},
          });
          for (const sourceId of claimSourceIds) {
            await linkClaimSource(tx, {
              claimId,
              sourceId,
              locator: claim.field,
            });
          }
          relations += 1;
        }
      }
    });
  }

  console.log(
    `  -> Objects import finished: ${entityIdByObjectId.size} entities, ${relations} relations${replacedTextRelations ? ` (${replacedTextRelations} stale text relations replaced)` : ""}, ${sourceIdByKey.size} sources.`
  );
  return plan;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `     ${line}`)
    .join("\n");
}
