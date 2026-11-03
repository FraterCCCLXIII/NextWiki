import { eq } from "drizzle-orm";
import type { db } from "../../index.js";
import * as schema from "../../schema/index.js";

export type Db = typeof db;

type EntityKind = schema.NewKosmoEntity["kind"];
type TaxonScheme = schema.NewKosmoTaxon["scheme"];

export const KOSMO_IMPORT_EMAIL = "kosmo-import@system.invalid";
const KOSMO_IMPORT_NAME = "Kosmo Import";

/** Lowercase ASCII slug; diacritics are folded, runs of other chars become "-". */
export function slugify(s: string): string {
  const out = s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "item";
}

/** Splits an array into chunks of at most n items. */
export function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

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

export async function upsertSource(
  database: Db,
  input: { key: string; title: string; url?: string | null }
): Promise<number> {
  const [row] = await database
    .insert(schema.kosmoSources)
    .values({ key: input.key, title: input.title, url: input.url ?? null })
    .onConflictDoUpdate({
      target: schema.kosmoSources.key,
      set: { title: input.title, url: input.url ?? null },
    })
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
      },
    })
    .returning({ id: schema.kosmoEntities.id });
  if (!row) throw new Error(`Failed to upsert entity ${input.slug}`);
  return row.id;
}

/** Adds a claim. Idempotent through the table's unique identity constraint. */
export async function addClaim(
  database: Db,
  input: {
    subjectId: number;
    predicate: string;
    objectId?: number | null;
    valueText?: string | null;
    valueNum?: number | null;
    unit?: string | null;
    sourceId?: number | null;
    note?: string | null;
  }
): Promise<void> {
  await database
    .insert(schema.kosmoClaims)
    .values({
      subjectId: input.subjectId,
      predicate: input.predicate,
      objectId: input.objectId ?? null,
      valueText: input.valueText ?? null,
      valueNum: input.valueNum ?? null,
      unit: input.unit ?? null,
      sourceId: input.sourceId ?? null,
      note: input.note ?? null,
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
