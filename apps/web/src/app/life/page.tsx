import Link from "next/link";
import type { Metadata } from "next";
import { StatTotals } from "@repo/ui";
import { TaxonCard } from "~/components/life/TaxonCard";
import { listKingdoms } from "~/lib/life/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Life | Kosmographica",
  description: "Browse the tree of life: kingdoms, groups and species.",
};

export default async function LifePage() {
  const kingdoms = await listKingdoms();
  const species = kingdoms.reduce((n, k) => n + (k.speciesCount ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">Life</h1>
        <p className="text-lg text-kosmo-dim">A browsable catalog of species and the groups they belong to.</p>
      </header>

      <StatTotals
        items={[
          { label: "kingdoms", value: kingdoms.length },
          { label: "species", value: species.toLocaleString() },
        ]}
      />

      <form method="get" action="/life/search" className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          name="q"
          placeholder="Search by scientific or common name"
          aria-label="Search species"
          className="w-full rounded-md border border-kosmo-line bg-kosmo-panel px-3 py-2 text-kosmo-text placeholder:text-kosmo-dim focus:outline-none focus:ring-1 focus:ring-kosmo-mint md:flex-1"
        />
        <button type="submit" className="rounded-md border border-kosmo-line bg-kosmo-panel px-4 py-2 text-kosmo-mint hover:bg-kosmo-line">
          search
        </button>
        <Link href="/life/tree" className="rounded-md border border-kosmo-line bg-kosmo-panel px-4 py-2 text-kosmo-text hover:bg-kosmo-line">
          tree explorer
        </Link>
      </form>

      {kingdoms.length === 0 ? (
        <p className="text-base text-kosmo-dim">No taxa have been imported yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kingdoms.map((k) => (
            <TaxonCard
              key={k.id}
              t={{
                href: `/life/${k.slug}`,
                name: k.canonicalName ?? k.scientificName,
                commonName: k.commonName,
                rank: k.rank,
                speciesCount: k.speciesCount,
                imageUrl: k.imageUrl,
                extinct: k.extinct,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
