import { promises as fs } from "fs";
import path from "path";
import { StatTotals } from "@repo/ui";
import { PediaTable, type PediaObject } from "~/components/kosmo/pedia-table";

type RawObject = {
  id: string;
  name: string;
  type?: string | null;
  parent?: string | null;
};

async function loadObjects(): Promise<PediaObject[]> {
  const file = path.join(
    process.cwd(),
    "public",
    "kosmo",
    "data",
    "catalog",
    "objects.json",
  );
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as RawObject[];
  // Keep only the fields the table needs so the client payload stays small.
  return raw.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type ?? null,
    parent: o.parent ?? null,
  }));
}

export default async function KosmoPediaPage() {
  const objects = await loadObjects();
  const types = [
    ...new Set(objects.map((o) => o.type).filter((t): t is string => !!t)),
  ].sort();

  return (
    <main className="min-h-screen bg-kosmo-bg text-kosmo-text">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Kosmopedia</h1>
          <p className="text-kosmo-dim">
            A searchable catalog of celestial and other objects.
          </p>
        </header>

        <StatTotals
          items={[
            { label: "objects", value: objects.length },
            { label: "types", value: types.length },
          ]}
        />

        <PediaTable objects={objects} types={types} />
      </div>
    </main>
  );
}
