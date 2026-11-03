import Link from "next/link";
import { DataRow, DataList, Pill } from "@repo/ui";

export type PediaRow = {
  id: string | number;
  name: string;
  type: string | null;
  summary: string | null;
  href: string | null;
};

export type PediaTypeChip = { type: string; count: number };

export function PediaTable({
  rows,
  types,
  activeType,
  q,
  page,
  pageSize,
  total,
  basePath = "/kosmo/pedia",
}: {
  rows: PediaRow[];
  types: PediaTypeChip[];
  activeType: string | null;
  q: string;
  page: number;
  pageSize: number;
  total: number;
  basePath?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const hrefFor = (next: { q?: string; type?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const nq = next.q ?? q;
    const nt = next.type === undefined ? activeType : next.type;
    const np = next.page ?? 1;
    if (nq) params.set("q", nq);
    if (nt) params.set("type", nt);
    if (np > 1) params.set("page", String(np));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-4">
      <form method="get" action={basePath} className="flex flex-col gap-3 md:flex-row md:items-center">
        {activeType ? <input type="hidden" name="type" value={activeType} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name"
          className="w-full rounded-md border border-kosmo-line bg-kosmo-panel px-3 py-2 text-kosmo-text placeholder:text-kosmo-dim focus:outline-none focus:ring-1 focus:ring-kosmo-mint md:flex-1"
        />
        <button
          type="submit"
          className="rounded-md border border-kosmo-line bg-kosmo-panel px-4 py-2 text-kosmo-mint hover:bg-kosmo-line"
        >
          search
        </button>
      </form>

      <nav className="flex flex-wrap gap-2 text-base">
        <Link
          href={hrefFor({ type: null, page: 1 })}
          className={!activeType ? "text-kosmo-mint" : "text-kosmo-dim hover:text-kosmo-text"}
        >
          all types
        </Link>
        {types.map((t) => (
          <Link
            key={t.type}
            href={hrefFor({ type: t.type, page: 1 })}
            className={activeType === t.type ? "text-kosmo-mint" : "text-kosmo-dim hover:text-kosmo-text"}
          >
            {t.type} ({t.count.toLocaleString()})
          </Link>
        ))}
      </nav>

      <p className="text-base text-kosmo-dim">{total.toLocaleString()} matching entries</p>

      <DataList>
        {rows.map((r) => (
          <DataRow
            key={r.id}
            label={
              r.href ? (
                <Link href={r.href} className="text-kosmo-text hover:text-kosmo-mint">
                  {r.name}
                </Link>
              ) : (
                r.name
              )
            }
          >
            <span className="flex items-center gap-2">
              {r.summary ? <span className="hidden text-kosmo-dim md:inline">{r.summary}</span> : null}
              {r.type ? <Pill>{r.type}</Pill> : null}
            </span>
          </DataRow>
        ))}
      </DataList>

      {pageCount > 1 && (
        <nav className="flex items-center justify-center gap-4 text-base">
          {page > 1 ? (
            <Link href={hrefFor({ page: page - 1 })} className="text-kosmo-mint">
              previous
            </Link>
          ) : null}
          <span className="text-kosmo-dim">
            page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor({ page: page + 1 })} className="text-kosmo-mint">
              next
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
