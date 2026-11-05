import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaxonList } from "~/components/life/TaxonList";
import { LineageBreadcrumb } from "~/components/life/LineageBreadcrumb";
import { getLineage, searchTaxa, taxonHref } from "~/lib/life/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search life | Kosmographica", robots: { index: false } };

const PAGE_SIZE = 50;

export default async function LifeSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  if (!q) redirect("/life");
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const { rows, total } = await searchTaxa(q, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const items = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      href: taxonHref(await getLineage(r), r),
      name: r.canonicalName ?? r.scientificName,
      commonName: r.commonName,
      rank: r.rank,
      speciesCount: r.speciesCount,
      extinct: r.extinct,
    })),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <LineageBreadcrumb lineage={[]} current="Search" />
      <h1 className="text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">Search</h1>
      <TaxonList rows={items} q={q} page={page} pageSize={PAGE_SIZE} total={total} basePath="/life/search" />
    </div>
  );
}
