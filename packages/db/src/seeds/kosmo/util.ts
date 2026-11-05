import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { db } from "../../index.js";
import * as schema from "../../schema/index.js";
import type { KosmoClaimMethod, KosmoTimeKind } from "../../schema/kosmo.js";
import { matchRegistryEntry } from "./sources.js";
import { SOURCE_REGISTRY } from "./sources-registry.js";

// Pure string helpers live in text.ts so plan.ts can be imported without the
// database client; re-exported here because every seed already imports them.
export { slugify, chunk } from "./text.js";

export type Db = typeof db;

type EntityKind = schema.NewKosmoEntity["kind"];
type TaxonScheme = schema.NewKosmoTaxon["scheme"];

export const KOSMO_IMPORT_EMAIL = "kosmo-import@system.invalid";
const KOSMO_IMPORT_NAME = "Kosmo Import";

/**
 * Runs fn inside a transaction. The neon-http driver cannot open transactions,
 * so in that case fn runs directly against the client.
 */
export async function inBatch<T>(
  database: Db,
  fn: (tx: Db) => Promise<T>
): Promise<T> {
  try {
    return await database.transaction(async (tx) => fn(tx as unknown as Db));
  } catch (error) {
    if (error instanceof Error && /transactions? support/i.test(error.message)) {
      return fn(database);
    }
    throw error;
  }
}

/** Best-practice system account for imports. It cannot log in: no password, no account link, no groups. */
export async function ensureImportUser(database: Db): Promise<number> {
  await database
    .insert(schema.users)
    .values({
      name: KOSMO_IMPORT_NAME,
      email: KOSMO_IMPORT_EMAIL,
      password: null,
    })
    .onConflictDoNothing({ target: schema.users.email });

  const [row] = await database
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, KOSMO_IMPORT_EMAIL))
    .limit(1);
  if (!row) throw new Error("Failed to create the Kosmo Import user");
  return row.id;
}

/**
 * Upserts a source. When the key is a registered host, the registry supplies the
 * licence, publisher and trust tier, so a credit can always be rendered.
 */
export async function upsertSource(
  database: Db,
  input: {
    key: string;
    title: string;
    url?: string | null;
    retrievedAt?: Date | null;
  }
): Promise<number> {
  const entry = matchRegistryEntry(input.key, SOURCE_REGISTRY);
  const values = {
    key: input.key,
    title: entry?.name ?? input.title,
    url: input.url ?? null,
    publisher: entry?.publisher ?? null,
    license: entry?.licence ?? null,
    licenseUrl: entry?.licenceUrl ?? null,
    trustTier: entry?.trustTier ?? null,
    retrievedAt:
      input.retrievedAt ??
      (entry?.retrievedAt ? new Date(entry.retrievedAt) : null),
  };
  const [row] = await database
    .insert(schema.kosmoSources)
    .values(values)
    .onConflictDoUpdate({ target: schema.kosmoSources.key, set: values })
    .returning({ id: schema.kosmoSources.id });
  if (!row) throw new Error(`Failed to upsert source ${input.key}`);
  return row.id;
}

/**
 * Inserts or updates an entity by slug. Entities are the dynamic data layer,
 * so their fields are overwritten. pageId is never touched.
 */
export async function upsertEntity(
  database: Db,
  input: {
    slug: string;
    kind: EntityKind;
    name: string;
    type?: string | null;
    summary?: string | null;
    data?: Record<string, unknown> | null;
    sourceId?: number | null;
    timeStart?: number | null;
    timeEnd?: number | null;
    timePrecisionYears?: number | null;
    timeKind?: KosmoTimeKind | null;
  }
): Promise<number> {
  const values = {
    slug: input.slug,
    kind: input.kind,
    name: input.name,
    type: input.type ?? null,
    summary: input.summary ?? null,
    data: input.data ?? {},
    sourceId: input.sourceId ?? null,
    timeStart: input.timeStart ?? null,
    timeEnd: input.timeEnd ?? null,
    timePrecisionYears: input.timePrecisionYears ?? null,
    timeKind: input.timeKind ?? null,
  };
  const [row] = await database
    .insert(schema.kosmoEntities)
    .values(values)
    .onConflictDoUpdate({
      target: schema.kosmoEntities.slug,
      set: {
        kind: values.kind,
        name: values.name,
        type: values.type,
        summary: values.summary,
        data: values.data,
        sourceId: values.sourceId,
        timeStart: values.timeStart,
        timeEnd: values.timeEnd,
        timePrecisionYears: values.timePrecisionYears,
        timeKind: values.timeKind,
      },
    })
    .returning({ id: schema.kosmoEntities.id });
  if (!row) throw new Error(`Failed to upsert entity ${input.slug}`);
  return row.id;
}

/**
 * Adds a claim and returns its id. Idempotent through the table's unique
 * identity constraint; a re-import refreshes provenance and method in place
 * rather than creating a second claim with the same value.
 */
export async function addClaim(
  database: Db,
  input: {
    subjectId: number;
    predicate: string;
    objectId?: number | null;
    valueText?: string | null;
    valueNum?: number | null;
    valueErr?: number | null;
    unit?: string | null;
    sourceId?: number | null;
    method?: KosmoClaimMethod | null;
    qualifiers?: Record<string, unknown> | null;
    note?: string | null;
  }
): Promise<number> {
  const [row] = await database
    .insert(schema.kosmoClaims)
    .values({
      subjectId: input.subjectId,
      predicate: input.predicate,
      objectId: input.objectId ?? null,
      valueText: input.valueText ?? null,
      valueNum: input.valueNum ?? null,
      valueErr: input.valueErr ?? null,
      unit: input.unit ?? null,
      sourceId: input.sourceId ?? null,
      method: input.method ?? null,
      qualifiers: input.qualifiers ?? {},
      note: input.note ?? null,
    })
    .onConflictDoUpdate({
      target: [
        schema.kosmoClaims.subjectId,
        schema.kosmoClaims.predicate,
        schema.kosmoClaims.objectId,
        schema.kosmoClaims.valueText,
      ],
      set: {
        valueNum: input.valueNum ?? null,
        valueErr: input.valueErr ?? null,
        unit: input.unit ?? null,
        sourceId: input.sourceId ?? null,
        method: input.method ?? null,
        qualifiers: input.qualifiers ?? {},
        note: input.note ?? null,
      },
    })
    .returning({ id: schema.kosmoClaims.id });
  if (!row) throw new Error(`Failed to upsert claim ${input.predicate}`);
  return row.id;
}

/**
 * Removes earlier relations that the current plan contradicts: an unlinked
 * `orbits "Sun"` left by a partial import, or a link to the wrong entity when a
 * name was previously matched case-insensitively ("55 Cnc B" the star vs
 * "55 Cnc b" the planet). Only relations naming the same parent are touched, so
 * curated relations to other entities survive.
 */
export async function reconcileRelation(
  database: Db,
  input: {
    subjectId: number;
    predicate: string;
    parentName: string;
    /** The entity the plan now points at, if it resolved. */
    targetEntityId?: number;
  }
): Promise<number> {
  const claims = schema.kosmoClaims;
  // A link that names this parent but is not the planned target is stale.
  const wrongTarget = sql`${claims.objectId} is distinct from ${input.targetEntityId ?? null}
    and ${claims.objectId} in (
      select id from ${schema.kosmoEntities}
      where lower(name) = lower(${input.parentName})
    )`;
  const textForm = and(
    isNull(claims.objectId),
    sql`lower(${claims.valueText}) = lower(${input.parentName})`
  );

  const deleted = await database
    .delete(claims)
    .where(
      and(
        eq(claims.subjectId, input.subjectId),
        eq(claims.predicate, input.predicate),
        input.targetEntityId === undefined
          ? // Unresolved or ambiguous: no link should exist, only text.
            sql`${claims.objectId} in (
              select id from ${schema.kosmoEntities}
              where lower(name) = lower(${input.parentName})
            )`
          : or(textForm, wrongTarget)
      )
    )
    .returning({ id: claims.id });
  return deleted.length;
}

/** Records an additional source for a claim. Idempotent. */
export async function linkClaimSource(
  database: Db,
  input: {
    claimId: number;
    sourceId: number;
    locator?: string | null;
    stance?: "supports" | "disputes" | "mentions";
  }
): Promise<void> {
  await database
    .insert(schema.kosmoClaimSources)
    .values({
      claimId: input.claimId,
      sourceId: input.sourceId,
      locator: input.locator ?? null,
      stance: input.stance ?? "supports",
    })
    .onConflictDoNothing();
}

/** Records an external identity for an entity. Idempotent per (scheme, value). */
export async function addExternalId(
  database: Db,
  input: {
    entityId: number;
    scheme: string;
    value: string;
    url?: string | null;
    sourceId?: number | null;
  }
): Promise<void> {
  await database
    .insert(schema.kosmoEntityExternalIds)
    .values({
      entityId: input.entityId,
      scheme: input.scheme,
      value: input.value,
      url: input.url ?? null,
      sourceId: input.sourceId ?? null,
    })
    .onConflictDoNothing();
}

export async function ensureTaxon(
  database: Db,
  input: {
    scheme: TaxonScheme;
    slug: string;
    name: string;
    parentId?: number | null;
    sortOrder?: number | null;
  }
): Promise<number> {
  const [row] = await database
    .insert(schema.kosmoTaxa)
    .values({
      scheme: input.scheme,
      slug: input.slug,
      name: input.name,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .onConflictDoUpdate({
      target: [schema.kosmoTaxa.scheme, schema.kosmoTaxa.slug],
      set: {
        name: input.name,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    })
    .returning({ id: schema.kosmoTaxa.id });
  if (!row) throw new Error(`Failed to ensure taxon ${input.scheme}/${input.slug}`);
  return row.id;
}

/** Links an entity to a taxon. Idempotent. */
export async function linkEntityTaxon(
  database: Db,
  entityId: number,
  taxonId: number
): Promise<void> {
  await database
    .insert(schema.kosmoEntityTaxa)
    .values({ entityId, taxonId })
    .onConflictDoNothing();
}

/**
 * Creates the wiki page only when no page exists at this path, so editors keep
 * their prose. Existing pages are left untouched apart from linking entityId.
 * Rendered HTML is left null; the app renders pages lazily on first view.
 */
export async function ensurePage(
  database: Db,
  input: {
    path: string;
    title: string;
    markdown: string;
    userId: number;
    tags?: string[];
    entityId?: number;
  }
): Promise<number> {
  const path = input.path.replace(/^\/+/, "");

  const [existing] = await database
    .select({ id: schema.wikiPages.id })
    .from(schema.wikiPages)
    .where(eq(schema.wikiPages.path, path))
    .limit(1);

  let pageId: number;
  if (existing) {
    pageId = existing.id;
  } else {
    const [created] = await database
      .insert(schema.wikiPages)
      .values({
        path,
        title: input.title,
        content: input.markdown,
        editorType: "markdown",
        isPublished: true,
        createdById: input.userId,
        updatedById: input.userId,
      })
      .returning({ id: schema.wikiPages.id });
    if (!created) throw new Error(`Failed to create page ${path}`);
    pageId = created.id;

    await database.insert(schema.wikiPageRevisions).values({
      pageId,
      content: input.markdown,
      title: input.title,
      path,
      editorType: "markdown",
      isPublished: true,
      revisionType: "created",
      createdById: input.userId,
      changeSummary: "Created by the Kosmographica seed",
    });

    const tagNames = [
      ...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean)),
    ];
    const tagIds: number[] = [];
    for (const name of tagNames) {
      await database
        .insert(schema.wikiTags)
        .values({ name })
        .onConflictDoNothing({ target: schema.wikiTags.name });
      const [tag] = await database
        .select({ id: schema.wikiTags.id })
        .from(schema.wikiTags)
        .where(eq(schema.wikiTags.name, name))
        .limit(1);
      if (tag) tagIds.push(tag.id);
    }
    if (tagIds.length > 0) {
      await database
        .insert(schema.wikiPageToTag)
        .values(tagIds.map((tagId) => ({ pageId: pageId, tagId })))
        .onConflictDoNothing();
    }
  }

  if (input.entityId !== undefined) {
    await database
      .update(schema.kosmoEntities)
      .set({ pageId })
      .where(eq(schema.kosmoEntities.id, input.entityId));
  }

  return pageId;
}
