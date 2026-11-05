import type { Metadata } from "next";
import { TreeExplorer } from "~/components/life/TreeExplorer";
import { LineageBreadcrumb } from "~/components/life/LineageBreadcrumb";
import { listKingdoms } from "~/lib/life/queries";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Tree of life | Kosmographica" };

export default async function LifeTreePage() {
  const kingdoms = await listKingdoms();
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <LineageBreadcrumb lineage={[]} current="Tree" />
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">Tree of life</h1>
        <p className="text-lg text-kosmo-dim">Expand a group to load its children.</p>
      </header>
      <TreeExplorer
        roots={kingdoms.map((k) => ({
          id: k.id,
          slug: k.slug,
          name: k.canonicalName ?? k.scientificName,
          commonName: k.commonName,
          rank: k.rank,
          childCount: k.childCount ?? 0,
          speciesCount: k.speciesCount ?? 0,
          href: `/life/${k.slug}`,
        }))}
      />
    </div>
  );
}
