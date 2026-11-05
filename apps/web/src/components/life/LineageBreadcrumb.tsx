import Link from "next/link";

type Crumb = { slug: string; label: string; rank?: string };

/** Breadcrumb of ancestors, each linking to its canonical /life path. */
export function LineageBreadcrumb({ lineage, current }: { lineage: Crumb[]; current?: string }) {
  let href = "/life";
  return (
    <nav aria-label="Lineage" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-kosmo-dim">
      <Link href="/life" className="hover:text-kosmo-mint">
        Life
      </Link>
      {lineage.map((c) => {
        href = `${href}/${c.slug}`;
        return (
          <span key={c.slug} className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <Link href={href} title={c.rank} className="hover:text-kosmo-mint">
              {c.label}
            </Link>
          </span>
        );
      })}
      {current ? (
        <span className="flex items-center gap-2 text-kosmo-text">
          <span aria-hidden>/</span>
          <span aria-current="page">{current}</span>
        </span>
      ) : null}
    </nav>
  );
}
