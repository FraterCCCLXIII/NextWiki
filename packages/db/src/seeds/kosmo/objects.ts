import fs from "node:fs";
import path from "node:path";
import {
  addClaim,
  chunk,
  ensurePage,
  ensureTaxon,
  inBatch,
  linkEntityTaxon,
  slugify,
  upsertEntity,
  upsertSource,
  type Db,
} from "./util.js";

const BATCH_SIZE = 500;
const CATALOG_REL = path.join(
  "apps",
  "web",
  "public",
  "kosmo",
  "data",
  "catalog",
  "objects.json"
);
/** Object types that orbit a parent; everything else is linked with part_of. */
const ORBIT_TYPES = new Set([
  "planet",
  "dwarf_planet",
  "moon",
  "exoplanet",
  "exomoon_candidate",
  "asteroid",
  "comet",
]);
const UNIT_SUFFIX = /_(kg|m|W|K|pc|deg|days)$/;

interface RawObject {
  id: string;
  name: string;
  alt_names?: string[] | null;
  type: string;
  parent?: string | null;
  source?: string | null;
  [key: string]: unknown;
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

function unitFor(field: string): string | null {
  const m = field.match(UNIT_SUFFIX);
  return m ? m[1]! : null;
}

function objectMarkdown(row: RawObject): string {
  return [
    `The Kosmographica object index entry for ${row.name}.`,
    "",
    `{{kosmo:infobox:object:${row.id}}}`,
    "",
    `{{kosmo:links:object:${row.id}}}`,
    "",
  ].join("\n");
}

/**
 * Imports the catalogue of astronomical objects as entities, claims, taxa and
 * wiki pages. Pages only get dynamic blocks, so all facts render from the DB.
 */
export async function importObjects(database: Db, userId: number): Promise<void> {
  const file = resolveCatalogFile();
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as RawObject[];
  console.log(`  -> Importing ${rows.length} catalogue objects from ${file}`);

  // Lookup tables for resolving `parent` strings, which may be ids or names.
  const idByName = new Map<string, string>();
  for (const row of rows) {
    const names = [row.name, ...(row.alt_names ?? [])];
    for (const n of names) {
      if (typeof n === "string" && !idByName.has(n.toLowerCase())) {
        idByName.set(n.toLowerCase(), row.id);
      }
    }
  }

  const sourceCache = new Map<string, number>();
  const taxonCache = new Map<string, number>();
  const entityIdByObjectId = new Map<string, number>();

  const batches = chunk(rows, BATCH_SIZE);

  // Pass 1: entities, numeric claims, taxa and pages.
  let done = 0;
  for (const batch of batches) {
    await inBatch(database, async (tx) => {
      for (const row of batch) {
        let sourceId: number | null = null;
        if (row.source) {
          const cached = sourceCache.get(row.source);
          if (cached !== undefined) {
            sourceId = cached;
          } else {
            const isUrl = /^https?:\/\//i.test(row.source);
            sourceId = await upsertSource(tx, {
              key: `objects-source:${row.source}`,
              title: row.source,
              url: isUrl ? row.source : null,
            });
            sourceCache.set(row.source, sourceId);
          }
        }

        const type = row.type || "other";
        const entityId = await upsertEntity(tx, {
          slug: `object:${row.id}`,
          kind: "object",
          name: row.name,
          type,
          data: row,
          sourceId,
        });
        entityIdByObjectId.set(row.id, entityId);

        let taxonId = taxonCache.get(type);
        if (taxonId === undefined) {
          taxonId = await ensureTaxon(tx, {
            scheme: "astronomy",
            slug: slugify(type),
            name: humanize(type),
          });
          taxonCache.set(type, taxonId);
        }
        await linkEntityTaxon(tx, entityId, taxonId);

        for (const [field, value] of Object.entries(row)) {
          if (typeof value === "number" && Number.isFinite(value)) {
            await addClaim(tx, {
              subjectId: entityId,
              predicate: field,
              valueNum: value,
              unit: unitFor(field),
              sourceId,
            });
          }
        }

        await ensurePage(tx, {
          path: `/kosmo/object/${slugify(row.id)}`,
          title: row.name.slice(0, 255),
          markdown: objectMarkdown(row),
          userId,
          tags: [type, "kosmo"],
          entityId,
        });
      }
    });
    done += batch.length;
    console.log(`    ↳ objects: ${done}/${rows.length}`);
  }

  // Pass 2: orbit / part-of relations, now that every entity has an id.
  const resolveParent = (parent: string): string | undefined => {
    if (entityIdByObjectId.has(parent)) return parent;
    const bySlug = slugify(parent);
    if (entityIdByObjectId.has(bySlug)) return bySlug;
    return idByName.get(parent.toLowerCase());
  };

  done = 0;
  for (const batch of batches) {
    await inBatch(database, async (tx) => {
      for (const row of batch) {
        if (!row.parent) continue;
        const subjectId = entityIdByObjectId.get(row.id);
        if (subjectId === undefined) continue;

        const predicate = ORBIT_TYPES.has(row.type) ? "orbits" : "part_of";
        const parentObjectId = resolveParent(row.parent);
        if (parentObjectId !== undefined && parentObjectId !== row.id) {
          await addClaim(tx, {
            subjectId,
            predicate,
            objectId: entityIdByObjectId.get(parentObjectId),
            sourceId: null,
          });
        } else {
          // Unresolved parent: keep the name as text so nothing is lost.
          await addClaim(tx, { subjectId, predicate, valueText: row.parent });
        }
      }
    });
    done += batch.length;
    console.log(`    ↳ parent links: ${done}/${rows.length}`);
  }

  console.log(`  -> Objects import finished (${entityIdByObjectId.size} entities).`);
}
