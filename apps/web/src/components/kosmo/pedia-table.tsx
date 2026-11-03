"use client";

import { useMemo, useState } from "react";
import { DataRow, DataList, Pill } from "@repo/ui";

export type PediaObject = {
  id: string;
  name: string;
  type: string | null;
  parent: string | null;
};

const PAGE_SIZE = 200;

export function PediaTable({
  objects,
  types,
}: {
  objects: PediaObject[];
  types: string[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return objects.filter((o) => {
      if (type !== "all" && o.type !== type) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.parent ?? "").toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    });
  }, [objects, query, type]);

  const visible = filtered.slice(0, limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Search name, parent or id"
          className="w-full rounded-md border border-kosmo-line bg-kosmo-panel px-3 py-2 text-kosmo-text placeholder:text-kosmo-dim focus:outline-none focus:ring-1 focus:ring-kosmo-mint md:flex-1"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          className="rounded-md border border-kosmo-line bg-kosmo-panel px-3 py-2 text-kosmo-text"
        >
          <option value="all">all types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-kosmo-dim">
        {filtered.length.toLocaleString()} of {objects.length.toLocaleString()} objects
      </p>

      <DataList>
        {visible.map((o) => (
          <DataRow key={o.id} label={o.name}>
            <span className="flex items-center gap-2">
              {o.parent ? (
                <span className="text-kosmo-dim">{o.parent}</span>
              ) : null}
              {o.type ? <Pill>{o.type}</Pill> : null}
            </span>
          </DataRow>
        ))}
      </DataList>

      {filtered.length > limit && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            className="rounded-md border border-kosmo-line bg-kosmo-panel px-4 py-2 text-kosmo-mint hover:bg-kosmo-line"
          >
            show more ({(filtered.length - limit).toLocaleString()} left)
          </button>
        </div>
      )}
    </div>
  );
}
