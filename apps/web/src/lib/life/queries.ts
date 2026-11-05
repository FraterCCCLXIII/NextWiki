import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, taxa, taxonExternalIds, taxonMedia, taxonNames } from "@repo/db";

/** Read-side queries for the Life (species) section. Server-only. */

export type Taxon = typeof taxa.$inferSelect;

export const SPECIES_RANKS = ["species", "subspecies", "variety", "form"] as const;
export const isSpeciesRank = (rank: string) => (SPECIES_RANKS as readonly string[]).includes(rank);

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** '1/5/22/' -> [1, 5, 22] */
export function parsePath(path: string | null | undefined): number[] {
  return (path ?? "")
    .split("/")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

export async function getTaxonBySlug(slug: string): Promise<Taxon | null> {
  const [row] = await db.select().from(taxa).where(eq(taxa.slug, slug)).limit(1);
  return row ?? null;
}

export async function getTaxonById(id: number): Promise<Taxon | null> {
  const [row] = await db.select().from(taxa).where(eq(taxa.id, id)).limit(1);
  return row ?? null;
}

/** Ancestors (root first), excluding the taxon itself. */
export async function getLineage(taxon: Pick<Taxon, "path" | "id">): Promise<Taxon[]> {
  const ids = parsePath(taxon.path).filter((i) => i !== taxon.id);
  if (!ids.length) return [];
  const rows = await db.select().from(taxa).where(inArray(taxa.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((i) => byId.get(i)).filter((r): r is Taxon => !!r);
}

/** Canonical URL path ("/life/animalia/chordata/...") for a lineage plus the taxon. */
export function taxonHref(lineage: Pick<Taxon, "slug">[], taxon: Pick<Taxon, "slug">): string {
  return `/life/${[...lineage, taxon].map((t) => t.slug).join("/")}`;
}

export async function listChildren(parentId: number, opts: { q?: string; rank?: string; limit: number; offset: number }) {
  const conds = [eq(taxa.parentId, parentId), eq(taxa.status, "accepted")];
  if (opts.q) {
    const pat = `%${escapeLike(opts.q)}%`;
    conds.push(or(ilike(taxa.canonicalName, pat), ilike(taxa.commonName, pat))!);
  }
  if (opts.rank) conds.push(eq(taxa.rank, opts.rank));
  const where = and(...conds);
  const [rows, [totalRow], rankRows] = await Promise.all([
    db
      .select()
      .from(taxa)
      .where(where)
      .orderBy(desc(taxa.speciesCount), asc(taxa.canonicalName))
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ total: count() }).from(taxa).where(where),
    db
      .select({ rank: taxa.rank, n: count() })
      .from(taxa)
      .where(and(eq(taxa.parentId, parentId), eq(taxa.status, "accepted")))
      .groupBy(taxa.rank),
  ]);
  return { rows, total: Number(totalRow?.total ?? 0), ranks: rankRows.map((r) => ({ type: r.rank, count: Number(r.n) })) };
}

export async function listSiblings(taxon: Taxon, limit = 12) {
  if (taxon.parentId == null) return [];
  return db
    .select()
    .from(taxa)
    .where(and(eq(taxa.parentId, taxon.parentId), eq(taxa.status, "accepted"), sql`${taxa.id} <> ${taxon.id}`))
    .orderBy(desc(taxa.speciesCount), asc(taxa.canonicalName))
    .limit(limit);
}

export async function listKingdoms() {
  return db
    .select()
    .from(taxa)
    .where(and(eq(taxa.rank, "kingdom"), eq(taxa.status, "accepted")))
    .orderBy(desc(taxa.speciesCount), asc(taxa.canonicalName));
}

export async function searchTaxa(q: string, opts: { limit: number; offset: number }) {
  const pat = `%${escapeLike(q)}%`;
  const altIds = db.select({ id: taxonNames.taxonId }).from(taxonNames).where(ilike(taxonNames.name, pat));
  const where = and(
    eq(taxa.status, "accepted"),
    or(ilike(taxa.canonicalName, pat), ilike(taxa.commonName, pat), inArray(taxa.id, altIds)),
  );
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(taxa)
      .where(where)
      .orderBy(
        // exact/prefix matches first, then bigger groups
        sql`(lower(${taxa.canonicalName}) = lower(${q})) desc`,
        sql`(${taxa.canonicalName} ilike ${escapeLike(q) + "%"}) desc`,
        desc(taxa.speciesCount),
        asc(taxa.canonicalName),
      )
      .limit(opts.limit)
      .offset(opts.offset),
    db.select({ total: count() }).from(taxa).where(where),
  ]);
  return { rows, total: Number(totalRow?.total ?? 0) };
}

export async function getTaxonExtras(taxonId: number) {
  const [externalIds, media] = await Promise.all([
    db.select().from(taxonExternalIds).where(eq(taxonExternalIds.taxonId, taxonId)),
    db.select().from(taxonMedia).where(eq(taxonMedia.taxonId, taxonId)),
  ]);
  return { externalIds, media };
}

const EXTERNAL_LINKS: Record<string, { label: string; url: (id: string) => string }> = {
  gbif: { label: "GBIF", url: (id) => `https://www.gbif.org/species/${id}` },
  wikidata: { label: "Wikidata", url: (id) => `https://www.wikidata.org/wiki/${id}` },
  inaturalist: { label: "iNaturalist", url: (id) => `https://www.inaturalist.org/taxa/${id}` },
  eol: { label: "Encyclopedia of Life", url: (id) => `https://eol.org/pages/${id}` },
  itis: { label: "ITIS", url: (id) => `https://www.itis.gov/servlet/SingleRpt/SingleRpt?search_topic=TSN&search_value=${id}` },
  ncbi: { label: "NCBI Taxonomy", url: (id) => `https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${id}` },
  col: { label: "Catalogue of Life", url: (id) => `https://www.catalogueoflife.org/data/taxon/${id}` },
  iucn: { label: "IUCN Red List", url: (id) => `https://www.iucnredlist.org/species/${id}` },
  pbdb: { label: "Paleobiology DB", url: (id) => `https://paleobiodb.org/classic/basicTaxonInfo?taxon_no=${id}` },
  wikipedia: { label: "Wikipedia", url: (id) => `https://en.wikipedia.org/wiki/${encodeURIComponent(id)}` },
};

export function externalLink(system: string, externalId: string): { label: string; href: string } | null {
  const def = EXTERNAL_LINKS[system.toLowerCase()];
  return def ? { label: def.label, href: def.url(externalId) } : null;
}
