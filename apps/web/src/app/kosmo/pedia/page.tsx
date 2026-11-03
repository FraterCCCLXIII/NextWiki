import { StatTotals } from "@repo/ui";
import { PediaTable } from "~/components/kosmo/pedia-table";
import { listObjects, listObjectTypes, wikiHref } from "~/lib/kosmo/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

export default async function KosmoPediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const type = sp.type?.trim() || null;
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [{ rows, total }, types] = await Promise.all([
    listObjects({ q, type: type ?? undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    listObjectTypes(),
  ]);

  return (
    <main className="min-h-screen bg-kosmo-bg text-kosmo-text">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Kosmopedia</h1>
          <p className="text-kosmo-dim">A searchable catalog of celestial and other objects.</p>
        </header>

        <StatTotals
          items={[
            { label: "entries", value: total },
            { label: "types", value: types.length },
          ]}
        />

        <PediaTable
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            summary: r.summary,
            href: wikiHref(r.path),
          }))}
          types={types}
          activeType={type}
          q={q}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>
    </main>
  );
}
