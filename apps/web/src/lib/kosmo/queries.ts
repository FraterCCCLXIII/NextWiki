import { alias } from "drizzle-orm/pg-core";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull } from "drizzle-orm";
import {
  db,
  kosmoClaims,
  kosmoEntities,
  kosmoEntityTaxa,
  kosmoTaxa,
  wikiPages,
} from "@repo/db";

/**
 * Read-side queries for the Kosmographica catalog. Everything here is
 * server-only; pages call these directly.
 */

type EntityId = (typeof kosmoEntities.$inferSelect)["id"];

/** Wiki paths are stored without a leading slash; links need one. */
export function wikiHref(path: string | null | undefined): string | null {
  return path ? `/${path}` : null;
}

function asData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function getEntityBySlug(slug: string): Promise<{
  id: EntityId;
  slug: string;
  kind: string;
  name: string;
  type: string | null;
  summary: string | null;
  pageId: number | null;
  path: string | null;
  data: Record<string, unknown>;
} | null> {
  const [row] = await db
    .select({
      id: kosmoEntities.id,
      slug: kosmoEntities.slug,
      kind: kosmoEntities.kind,
      name: kosmoEntities.name,
      type: kosmoEntities.type,
      summary: kosmoEntities.summary,
      pageId: kosmoEntities.pageId,
      data: kosmoEntities.data,
      path: wikiPages.path,
    })
    .from(kosmoEntities)
    .leftJoin(wikiPages, eq(kosmoEntities.pageId, wikiPages.id))
    .where(eq(kosmoEntities.slug, slug))
    .limit(1);

  if (!row) return null;
  return { ...row, data: asData(row.data), path: row.path ?? null };
}

export async function getClaims(entityId: EntityId): Promise<
  {
    predicate: string;
    valueText: string | null;
    valueNum: number | null;
    unit: string | null;
    note: string | null;
    object: { slug: string; name: string; path: string | null } | null;
  }[]
> {
  const obj = alias(kosmoEntities, "claim_obj");
  const objPage = alias(wikiPages, "claim_obj_page");

  const rows = await db
    .select({
      predicate: kosmoClaims.predicate,
      valueText: kosmoClaims.valueText,
      valueNum: kosmoClaims.valueNum,
      unit: kosmoClaims.unit,
      note: kosmoClaims.note,
      objectId: kosmoClaims.objectId,
      objectSlug: obj.slug,
      objectName: obj.name,
      objectPath: objPage.path,
    })
    .from(kosmoClaims)
    .leftJoin(obj, eq(kosmoClaims.objectId, obj.id))
    .leftJoin(objPage, eq(obj.pageId, objPage.id))
    .where(eq(kosmoClaims.subjectId, entityId))
    .orderBy(asc(kosmoClaims.predicate), asc(kosmoClaims.id));

  return rows.map((r) => ({
    predicate: r.predicate,
    valueText: r.valueText ?? null,
    valueNum: r.valueNum == null ? null : Number(r.valueNum),
    unit: r.unit ?? null,
    note: r.note ?? null,
    object:
      r.objectId == null || r.objectSlug == null || r.objectName == null
        ? null
        : { slug: r.objectSlug, name: r.objectName, path: r.objectPath ?? null },
  }));
}

/** Entities whose part_of / subfield_of claim points at `entityId`. */
export async function getChildren(entityId: EntityId): Promise<
  { slug: string; name: string; kind: string; path: string | null }[]
> {
  const rows = await db
    .selectDistinct({
      slug: kosmoEntities.slug,
      name: kosmoEntities.name,
      kind: kosmoEntities.kind,
      path: wikiPages.path,
    })
    .from(kosmoClaims)
    .innerJoin(kosmoEntities, eq(kosmoClaims.subjectId, kosmoEntities.id))
    .leftJoin(wikiPages, eq(kosmoEntities.pageId, wikiPages.id))
    .where(
      and(
        eq(kosmoClaims.objectId, entityId),
        inArray(kosmoClaims.predicate, ["part_of", "subfield_of"]),
      ),
    )
    .orderBy(asc(kosmoEntities.name));

  return rows.map((r) => ({ ...r, path: r.path ?? null }));
}

/** Claims that point at `entityId` from other entities. */
export async function getBacklinks(entityId: EntityId): Promise<
  { predicate: string; subject: { slug: string; name: string; path: string | null } }[]
> {
  const subj = alias(kosmoEntities, "backlink_subj");
  const subjPage = alias(wikiPages, "backlink_subj_page");

  const rows = await db
    .select({
      predicate: kosmoClaims.predicate,
      slug: subj.slug,
      name: subj.name,
      path: subjPage.path,
    })
    .from(kosmoClaims)
    .innerJoin(subj, eq(kosmoClaims.subjectId, subj.id))
    .leftJoin(subjPage, eq(subj.pageId, subjPage.id))
    .where(eq(kosmoClaims.objectId, entityId))
    .orderBy(asc(subj.name), asc(kosmoClaims.predicate));

  return rows.map((r) => ({
    predicate: r.predicate,
    subject: { slug: r.slug, name: r.name, path: r.path ?? null },
  }));
}

export type ObjectRow = {
  id: EntityId;
  slug: string;
  kind: string;
  name: string;
  type: string | null;
  summary: string | null;
  path: string | null;
};

/** Paged, searchable entity list for the Kosmopedia table. */
export async function listObjects(opts: {
  q?: string;
  type?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: ObjectRow[]; total: number }> {
  const conditions = [];
  const q = opts.q?.trim();
  if (q) conditions.push(ilike(kosmoEntities.name, `%${escapeLike(q)}%`));
  if (opts.type) conditions.push(eq(kosmoEntities.type, opts.type));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: kosmoEntities.id,
        slug: kosmoEntities.slug,
        kind: kosmoEntities.kind,
        name: kosmoEntities.name,
        type: kosmoEntities.type,
        summary: kosmoEntities.summary,
        path: wikiPages.path,
      })
      .from(kosmoEntities)
      .leftJoin(wikiPages, eq(kosmoEntities.pageId, wikiPages.id))
      .where(where)
      .orderBy(asc(kosmoEntities.name), asc(kosmoEntities.id))
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ value: count() }).from(kosmoEntities).where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, path: r.path ?? null })),
    total: totalRow?.value ?? 0,
  };
}

/** Distinct entity types with how many entities carry each. */
export async function listObjectTypes(): Promise<{ type: string; count: number }[]> {
  const rows = await db
    .select({ type: kosmoEntities.type, value: count() })
    .from(kosmoEntities)
    .where(isNotNull(kosmoEntities.type))
    .groupBy(kosmoEntities.type)
    .orderBy(desc(count()), asc(kosmoEntities.type));

  return rows.flatMap((r) =>
    r.type == null ? [] : [{ type: r.type, count: r.value }],
  );
}

export type DomainNode = {
  name: string;
  status: string | null;
  link: string | null;
  blurb: string | null;
  children: DomainNode[];
};

/**
 * Nested tree for one taxonomy scheme. One query over taxa joined to their
 * entities, assembled in memory. The first linked entity supplies the node's
 * status (data.status), link (wiki path) and blurb (summary); any further
 * linked entities become leaf children.
 */
export async function getDomainTree(scheme: string): Promise<DomainNode[]> {
  const rows = await db
    .select({
      taxonId: kosmoTaxa.id,
      taxonName: kosmoTaxa.name,
      parentId: kosmoTaxa.parentId,
      sortOrder: kosmoTaxa.sortOrder,
      entityName: kosmoEntities.name,
      entitySummary: kosmoEntities.summary,
      entityData: kosmoEntities.data,
      entityPath: wikiPages.path,
    })
    .from(kosmoTaxa)
    .leftJoin(kosmoEntityTaxa, eq(kosmoEntityTaxa.taxonId, kosmoTaxa.id))
    .leftJoin(kosmoEntities, eq(kosmoEntityTaxa.entityId, kosmoEntities.id))
    .leftJoin(wikiPages, eq(kosmoEntities.pageId, wikiPages.id))
    .where(eq(kosmoTaxa.scheme, scheme as (typeof kosmoTaxa.$inferSelect)["scheme"]))
    .orderBy(asc(kosmoTaxa.sortOrder), asc(kosmoTaxa.name), asc(kosmoEntities.name));

  type Acc = {
    key: number;
    parentKey: number | null;
    sortOrder: number;
    filled: boolean;
    node: DomainNode;
  };
  const byId = new Map<number, Acc>();

  for (const r of rows) {
    const key = Number(r.taxonId);
    let acc = byId.get(key);
    if (!acc) {
      acc = {
        key,
        parentKey: r.parentId == null ? null : Number(r.parentId),
        sortOrder: Number(r.sortOrder ?? 0),
        filled: false,
        node: { name: r.taxonName, status: null, link: null, blurb: null, children: [] },
      };
      byId.set(key, acc);
    }
    if (r.entityName == null) continue;

    const data = asData(r.entityData);
    const status = typeof data.status === "string" ? data.status : null;
    const href = wikiHref(r.entityPath);

    if (!acc.filled) {
      // First linked entity fills the node itself.
      acc.filled = true;
      acc.node.status = status;
      acc.node.link = href;
      acc.node.blurb = r.entitySummary ?? null;
    } else {
      acc.node.children.push({
        name: r.entityName,
        status,
        link: href,
        blurb: r.entitySummary ?? null,
        children: [],
      });
    }
  }

  const roots: Acc[] = [];
  for (const acc of byId.values()) {
    const parent = acc.parentKey == null ? undefined : byId.get(acc.parentKey);
    if (parent && parent !== acc) parent.node.children.push(acc.node);
    else roots.push(acc);
  }

  const sortAccs = (list: Acc[]) => list.sort((a, b) => a.sortOrder - b.sortOrder || a.node.name.localeCompare(b.node.name));
  sortAccs(roots);
  for (const acc of byId.values()) {
    acc.node.children.sort((x, y) => x.name.localeCompare(y.name));
  }

  return roots.map((a) => a.node);
}

/** Live counts of entities per kind, for home-page stats. */
export async function countsByKind(): Promise<{ kind: string; count: number }[]> {
  const rows = await db
    .select({ kind: kosmoEntities.kind, value: count() })
    .from(kosmoEntities)
    .groupBy(kosmoEntities.kind)
    .orderBy(asc(kosmoEntities.kind));
  return rows.map((r) => ({ kind: r.kind, count: r.value }));
}

/** Generated pages most recently updated, for the home page. */
export async function recentPages(limit: number): Promise<
  { slug: string; name: string; kind: string; path: string; updatedAt: Date | null }[]
> {
  const rows = await db
    .select({
      slug: kosmoEntities.slug,
      name: kosmoEntities.name,
      kind: kosmoEntities.kind,
      path: wikiPages.path,
      updatedAt: wikiPages.updatedAt,
    })
    .from(kosmoEntities)
    .innerJoin(wikiPages, eq(kosmoEntities.pageId, wikiPages.id))
    .orderBy(desc(wikiPages.updatedAt), asc(kosmoEntities.name))
    .limit(limit);
  return rows;
}
