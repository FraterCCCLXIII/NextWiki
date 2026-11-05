import { NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, taxa } from "@repo/db";
import { getTaxonById, getLineage } from "~/lib/life/queries";

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parentId = Number.parseInt(url.searchParams.get("parentId") ?? "", 10);
  if (!Number.isFinite(parentId)) return NextResponse.json({ error: "parentId required" }, { status: 400 });
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "200", 10) || 200, 1), 500);

  const parent = await getTaxonById(parentId);
  if (!parent) return NextResponse.json({ error: "not found" }, { status: 404 });
  const lineage = await getLineage(parent);
  const base = `/life/${[...lineage, parent].map((t) => t.slug).join("/")}`;

  const rows = await db
    .select()
    .from(taxa)
    .where(and(eq(taxa.parentId, parentId), eq(taxa.status, "accepted")))
    .orderBy(desc(taxa.speciesCount), asc(taxa.canonicalName))
    .limit(limit);

  return NextResponse.json(
    {
      children: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.canonicalName ?? r.scientificName,
        commonName: r.commonName,
        rank: r.rank,
        childCount: r.childCount ?? 0,
        speciesCount: r.speciesCount ?? 0,
        href: `${base}/${r.slug}`,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
