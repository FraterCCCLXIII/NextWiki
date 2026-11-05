import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { DataList, DataRow, Pill, StatTotals } from "@repo/ui";
import { LineageBreadcrumb } from "~/components/life/LineageBreadcrumb";
import { RankPill } from "~/components/life/RankPill";
import { TaxonList } from "~/components/life/TaxonList";
import {
  externalLink,
  getLineage,
  getTaxonBySlug,
  getTaxonById,
  getTaxonExtras,
  isSpeciesRank,
  listChildren,
  listSiblings,
  taxonHref,
  type Taxon,
} from "~/lib/life/queries";

export const revalidate = 3600;

const PAGE_SIZE = 100;

type Params = Promise<{ taxon: string[] }>;
type SP = Promise<{ q?: string; rank?: string; page?: string }>;

const lastSlug = (segs: string[]) => decodeURIComponent(segs[segs.length - 1] ?? "");

/** Follow synonym links to the accepted taxon. */
async function resolve(slug: string): Promise<Taxon | null> {
  const t = await getTaxonBySlug(slug);
  if (!t) return null;
  if (t.status === "synonym" || t.acceptedId) {
    const accepted = t.acceptedId ? await getTaxonById(t.acceptedId) : null;
    if (accepted) {
      const lineage = await getLineage(accepted);
      permanentRedirect(taxonHref(lineage, accepted));
    }
    return null;
  }
  return t;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { taxon: segs } = await params;
  const t = await getTaxonBySlug(lastSlug(segs));
  if (!t) return {};
  const name = t.canonicalName ?? t.scientificName;
  const title = `${t.commonName ? `${t.commonName} (${name})` : name} | Life`;
  const thin = isSpeciesRank(t.rank) && !t.summary && !t.imageUrl;
  return {
    title,
    description: t.summary?.slice(0, 200) ?? `${name}, a ${t.rank}.`,
    robots: thin || t.status === "synonym" ? { index: false, follow: true } : undefined,
    openGraph: t.imageUrl ? { images: [t.imageUrl] } : undefined,
  };
}

export default async function TaxonPage({ params, searchParams }: { params: Params; searchParams: SP }) {
  const { taxon: segs } = await params;
  const sp = await searchParams;
  const taxon = await resolve(lastSlug(segs));
  if (!taxon) notFound();

  const lineage = await getLineage(taxon);
  const canonical = taxonHref(lineage, taxon);
  const requested = `/life/${segs.map((s) => decodeURIComponent(s)).join("/")}`;
  if (requested !== canonical) redirect(canonical);

  const crumbs = lineage.map((l) => ({ slug: l.slug, label: l.canonicalName ?? l.scientificName, rank: l.rank }));
  const name = taxon.canonicalName ?? taxon.scientificName;

  if (isSpeciesRank(taxon.rank)) {
    return <SpeciesView taxon={taxon} lineage={lineage} crumbs={crumbs} name={name} />;
  }

  const q = (sp.q ?? "").trim();
  const rank = sp.rank?.trim() || null;
  const parsed = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const { rows, total, ranks } = await listChildren(taxon.id, { q, rank: rank ?? undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <LineageBreadcrumb lineage={crumbs} current={name} />
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">
          {taxon.commonName ?? <span className="italic">{name}</span>}
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-lg text-kosmo-dim">
          {taxon.commonName ? <span className="italic">{name}</span> : null}
          <RankPill rank={taxon.rank} />
          {taxon.extinct ? <Pill tone="amber">extinct</Pill> : null}
        </p>
        {taxon.summary ? <p className="max-w-3xl text-lg text-kosmo-text">{taxon.summary}</p> : null}
      </header>

      <StatTotals
        items={[
          { label: "children", value: (taxon.childCount ?? 0).toLocaleString() },
          { label: "species", value: (taxon.speciesCount ?? 0).toLocaleString() },
        ]}
      />

      <TaxonList
        rows={rows.map((r) => ({
          id: r.id,
          href: `${canonical}/${r.slug}`,
          name: r.canonicalName ?? r.scientificName,
          commonName: r.commonName,
          rank: r.rank,
          speciesCount: r.speciesCount,
          extinct: r.extinct,
        }))}
        ranks={ranks}
        activeRank={rank}
        q={q}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        basePath={canonical}
        placeholder={`Search within ${name}`}
      />
    </div>
  );
}

async function SpeciesView({
  taxon,
  lineage,
  crumbs,
  name,
}: {
  taxon: Taxon;
  lineage: Taxon[];
  crumbs: { slug: string; label: string; rank: string }[];
  name: string;
}) {
  const parentHref = lineage.length ? taxonHref(lineage.slice(0, -1), lineage[lineage.length - 1]!) : "/life";
  const [{ externalIds, media }, siblings, children] = await Promise.all([
    getTaxonExtras(taxon.id),
    listSiblings(taxon),
    taxon.childCount ? listChildren(taxon.id, { limit: 50, offset: 0 }).then((r) => r.rows) : Promise.resolve([]),
  ]);
  const links = externalIds
    .map((e) => externalLink(e.system, e.externalId))
    .filter((l): l is { label: string; href: string } => !!l);
  const model = media.find((m) => m.kind === "model");
  const dinoRelated = taxon.extinct && lineage.some((l) => /^(dinosauria|saurischia|ornithischia)$/i.test(l.canonicalName ?? ""));
  const isDino = dinoRelated || /^(dinosauria)$/i.test(name);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <LineageBreadcrumb lineage={crumbs} current={name} />
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">
          <span className="italic">{name}</span>
        </h1>
        <p className="flex flex-wrap items-center gap-2 text-lg text-kosmo-dim">
          {taxon.commonName ? <span>{taxon.commonName}</span> : null}
          <RankPill rank={taxon.rank} />
          {taxon.extinct ? <Pill tone="amber">extinct</Pill> : null}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {taxon.summary ? <p className="max-w-3xl text-lg text-kosmo-text">{taxon.summary}</p> : null}

          {model ? (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-kosmo-text">3D model</h2>
              <a href={model.url} target="_blank" rel="noopener noreferrer" className="text-kosmo-mint hover:underline">
                Open model
              </a>
              {model.credit || model.license ? (
                <p className="text-sm text-kosmo-dim">{[model.credit, model.license].filter(Boolean).join(" · ")}</p>
              ) : null}
            </section>
          ) : null}

          {isDino ? (
            <p className="text-base">
              <Link href="/kosmo/tools/dinosaurs" className="text-kosmo-mint hover:underline">
                Explore dinosaurs in 3D
              </Link>
            </p>
          ) : null}

          {children.length ? (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-kosmo-text">Subtaxa</h2>
              <DataList>
                {children.map((c) => (
                  <DataRow
                    key={c.id}
                    label={
                      <Link href={`${taxonHref(lineage, taxon)}/${c.slug}`} className="text-kosmo-text hover:text-kosmo-mint">
                        <span className="italic">{c.canonicalName ?? c.scientificName}</span>
                      </Link>
                    }
                  >
                    <Pill>{c.rank}</Pill>
                  </DataRow>
                ))}
              </DataList>
            </section>
          ) : null}

          {siblings.length ? (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold text-kosmo-text">Related species</h2>
              <DataList>
                {siblings.map((s) => (
                  <DataRow
                    key={s.id}
                    label={
                      <Link href={`${parentHref}/${s.slug}`} className="text-kosmo-text hover:text-kosmo-mint">
                        <span className="italic">{s.canonicalName ?? s.scientificName}</span>
                        {s.commonName ? <span className="text-kosmo-dim"> · {s.commonName}</span> : null}
                      </Link>
                    }
                  >
                    <Pill>{s.rank}</Pill>
                  </DataRow>
                ))}
              </DataList>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          {taxon.imageUrl ? (
            <figure className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={taxon.imageUrl} alt={taxon.commonName ?? name} className="w-full rounded-md border border-kosmo-line object-cover" />
              {taxon.imageCredit || taxon.imageLicense ? (
                <figcaption className="text-sm text-kosmo-dim">{[taxon.imageCredit, taxon.imageLicense].filter(Boolean).join(" · ")}</figcaption>
              ) : null}
            </figure>
          ) : null}
          <DataList>
            <DataRow label="rank">{taxon.rank}</DataRow>
            {taxon.scientificName !== name ? <DataRow label="authority">{taxon.scientificName}</DataRow> : null}
          </DataList>
          {links.length ? (
            <section className="space-y-1">
              <h2 className="text-base uppercase tracking-wide text-kosmo-dim">External links</h2>
              <ul className="space-y-1">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-kosmo-mint hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
