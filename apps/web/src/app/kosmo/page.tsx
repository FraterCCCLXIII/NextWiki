import Link from "next/link";
import { StatTotals, DataList, DataRow } from "@repo/ui";
import { countsByKind, recentPages, wikiHref } from "~/lib/kosmo/queries";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/kosmo/tools/timeline", label: "Timeline", blurb: "The universe, to scale, from the big bang onward." },
  { href: "/kosmo/pedia", label: "Kosmopedia", blurb: "The catalog of everything the atlas covers." },
  { href: "/kosmo/domain/math", label: "Math", blurb: "Numbers, structures and proofs." },
  { href: "/kosmo/domain/physics", label: "Physics", blurb: "Forces, particles and fields." },
  { href: "/kosmo/domain/philosophy", label: "Philosophy", blurb: "Questions that frame the other domains." },
  { href: "/kosmo/domain/models", label: "Models", blurb: "Simplified pictures of how things work." },
  { href: "/kosmo/tools/university", label: "University", blurb: "A guided path of study through the atlas." },
  { href: "/kosmo/tools/chemistry", label: "Chemistry", blurb: "Elements, bonds and reactions." },
  { href: "/kosmo/tools/contraption", label: "Simulator", blurb: "Build and run small physical contraptions." },
];

export default async function KosmoHomePage() {
  const [kinds, recent] = await Promise.all([countsByKind(), recentPages(8)]);
  const total = kinds.reduce((sum, k) => sum + k.count, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-kosmo-text md:text-5xl">Kosmographica</h1>
        <p className="mb-8 text-lg text-kosmo-dim">
          A map of everything, to scale. Pick a section to begin.
        </p>
        <StatTotals
          items={[
            { label: "entries", value: total },
            ...kinds.map((k) => ({ label: k.kind, value: k.count })),
          ]}
        />
      </div>

      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block rounded border border-kosmo-line bg-kosmo-panel p-4 hover:border-kosmo-mint"
            >
              <span className="block font-medium text-kosmo-mint">{s.label}</span>
              <span className="block text-sm text-kosmo-dim">{s.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Recently updated</h2>
          <DataList>
            {recent.map((r) => {
              const href = wikiHref(r.path);
              return (
                <DataRow
                  key={r.slug}
                  label={
                    href ? (
                      <Link href={href} className="hover:text-kosmo-mint">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )
                  }
                >
                  <span className="text-kosmo-dim">
                    {r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 10) : ""}
                  </span>
                </DataRow>
              );
            })}
          </DataList>
        </section>
      )}
    </div>
  );
}
