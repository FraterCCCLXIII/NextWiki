import Link from "next/link";
import { DataList, DataRow, Pill } from "@repo/ui";

export type TaxonRow = {
  id: number;
  href: string;
  name: string;
  commonName: string | null;
  rank: string;
  speciesCount: number | null;
  extinct?: boolean | null;
};

export type RankChip = { type: string; count: number };

/** Search form, rank chips, list and pagination, following PediaTable. */
export function TaxonList({
  rows,
  ranks = [],
  activeRank = null,
  q = "",
  page,
  pageSize,
  total,
  basePath,
  placeholder = "Search by scientific or common name",
}: {
  rows: TaxonRow[];
  ranks?: RankChip[];
  activeRank?: string | null;
  q?: string;
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  placeholder?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hrefFor = (next: { rank?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const nr = next.rank === undefined ? activeRank : next.rank;
    const np = next.page ?? 1;
    if (q) params.set("q", q);
    if (nr) params.set("rank", nr);
    if (np > 1) params.set("page", String(np));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-4">
      <form method="get" action={basePath} className="flex flex-col gap-3 md:flex-row md:items-center">
        {activeRank ? <input type="hidden" name="rank" value={activeRank} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          aria-label="Search"
          className="w-full rounded-md border border-kosmo-line bg-kosmo-panel px-3 py-2 text-kosmo-text placeholder:text-kosmo-dim focus:outline-none focus:ring-1 focus:ring-kosmo-mint md:flex-1"
        />
        <button type="submit" className="rounded-md border border-kosmo-line bg-kosmo-panel px-4 py-2 text-kosmo-mint hover:bg-kosmo-line">
          search
        </button>
      </form>

      {ranks.length > 1 && (
        <nav className="flex flex-wrap gap-2 text-base">
          <Link href={hrefFor({ rank: null })} className={!activeRank ? "text-kosmo-mint" : "text-kosmo-dim hover:text-kosmo-text"}>
            all ranks
          </Link>
          {ranks.map((r) => (
            <Link
              key={r.type}
              href={hrefFor({ rank: r.type })}
              className={activeRank === r.type ? "text-kosmo-mint" : "text-kosmo-dim hover:text-kosmo-text"}
            >
              {r.type} ({r.count.toLocaleString()})
            </Link>
          ))}
        </nav>
      )}

      <p className="text-base text-kosmo-dim">{total.toLocaleString()} matching taxa</p>

      <DataList>
        {rows.map((r) => (
          <DataRow
            key={r.id}
            label={
              <Link href={r.href} className="text-kosmo-text hover:text-kosmo-mint">
                <span className="italic">{r.name}</span>
                {r.commonName ? <span className="text-kosmo-dim"> · {r.commonName}</span> : null}
              </Link>
            }
          >
            <span className="flex items-center gap-2">
              {r.speciesCount ? <span className="hidden text-kosmo-dim md:inline">{r.speciesCount.toLocaleString()} species</span> : null}
              {r.extinct ? <Pill tone="amber">extinct</Pill> : null}
              <Pill>{r.rank}</Pill>
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
