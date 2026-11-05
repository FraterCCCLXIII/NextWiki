"use client";

import { useMemo, useState } from "react";
import { KIND_LABEL, formatSpan, formatYear, groupColor, laneColor } from "~/lib/timeline/format";
import type { TLItem } from "~/lib/timeline/types";

interface ViewProps {
  items: TLItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const Badge = ({ it }: { it: TLItem }) => (
  <span className="rounded-full border border-kosmo-line2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-kosmo-dim" style={{ borderColor: groupColor(it.grp, 0.5) }}>
    {KIND_LABEL[it.k] ?? it.k}
  </span>
);

const bucketOf = (y: number) => {
  if (y < -10000) return { key: -1e9, label: "Before 10,000 BCE" };
  if (y < -1000) { const m = Math.floor(y / 1000) * 1000; return { key: m, label: `${formatYear(m)} – ${formatYear(m + 999)}` }; }
  if (y < 1) { const c = Math.floor(y / 100) * 100; return { key: c, label: `${formatYear(c)} – ${formatYear(c + 99)}` }; }
  const c = Math.floor((y - 1) / 100) * 100 + 1;
  return { key: c, label: `${c} – ${c + 99} CE` };
};

/** Scrolling chronicle with a spine, grouped by millennium / century. */
export function VerticalView({ items, selectedId, onSelect }: ViewProps) {
  const [limit, setLimit] = useState(400);
  const rows = useMemo(() => {
    const out: ({ head: string } | { it: TLItem })[] = [];
    let last = Number.NaN;
    for (const it of items.slice(0, limit)) {
      const b = bucketOf(it.s);
      if (b.key !== last) { out.push({ head: b.label }); last = b.key; }
      out.push({ it });
    }
    return out;
  }, [items, limit]);
  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-10">
      <div className="relative mx-auto max-w-[48rem] border-l border-kosmo-line2 pl-6">
        {rows.map((r, i) =>
          "head" in r ? (
            <h3 key={"h" + i} className="sticky top-0 z-10 -ml-6 bg-kosmo-bg/95 py-2 pl-6 text-xs font-semibold uppercase tracking-[0.18em] text-kosmo-mint backdrop-blur">{r.head}</h3>
          ) : (
            <button
              key={r.it.id}
              onClick={() => onSelect(r.it.id)}
              className={`relative mb-3 block w-full rounded-lg border px-4 py-3 text-left transition-colors [content-visibility:auto] ${selectedId === r.it.id ? "border-kosmo-mint bg-kosmo-panel" : "border-kosmo-line bg-kosmo-panel/60 hover:border-kosmo-line2"}`}
            >
              <span className="absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-kosmo-bg" style={{ background: laneColor(r.it.lane) }} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-kosmo-mint">{formatSpan(r.it)}</span>
                <Badge it={r.it} />
                <span className="text-[11px] text-kosmo-dim2">{r.it.lane}</span>
              </div>
              <div className="mt-1 font-medium text-kosmo-text">{r.it.n}</div>
              {r.it.d && <p className="mt-1 line-clamp-2 text-sm text-kosmo-dim">{r.it.d}</p>}
            </button>
          )
        )}
        {limit < items.length && (
          <button onClick={() => setLimit((l) => l + 400)} className="mb-6 rounded-md border border-kosmo-line2 px-4 py-2 text-sm text-kosmo-dim hover:text-kosmo-text">Show more ({items.length - limit} left)</button>
        )}
        {!items.length && <p className="py-10 text-kosmo-dim">Nothing matches these filters.</p>}
      </div>
    </div>
  );
}

export function CardsView({ items, selectedId, onSelect }: ViewProps) {
  const [limit, setLimit] = useState(120);
  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <div className="mx-auto grid max-w-[80rem] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.slice(0, limit).map((it) => (
          <button
            key={it.id}
            onClick={() => onSelect(it.id)}
            className={`flex flex-col rounded-xl border p-4 text-left transition-colors [content-visibility:auto] ${selectedId === it.id ? "border-kosmo-mint bg-kosmo-panel" : "border-kosmo-line bg-kosmo-panel/60 hover:border-kosmo-line2"}`}
          >
            <div className="mb-2 h-1 w-10 rounded-full" style={{ background: laneColor(it.lane) }} />
            <span className="font-mono text-xs text-kosmo-mint">{formatSpan(it)}</span>
            <span className="mt-1 font-medium leading-snug text-kosmo-text">{it.n}</span>
            <span className="mt-1 text-[11px] text-kosmo-dim2">{it.lane}</span>
            {it.d && <p className="mt-2 line-clamp-4 text-sm text-kosmo-dim">{it.d}</p>}
            <div className="mt-auto pt-3"><Badge it={it} /></div>
          </button>
        ))}
      </div>
      {limit < items.length && (
        <div className="mt-6 text-center"><button onClick={() => setLimit((l) => l + 120)} className="rounded-md border border-kosmo-line2 px-4 py-2 text-sm text-kosmo-dim hover:text-kosmo-text">Show more ({items.length - limit} left)</button></div>
      )}
      {!items.length && <p className="py-10 text-center text-kosmo-dim">Nothing matches these filters.</p>}
    </div>
  );
}

type SortKey = "n" | "s" | "e" | "lane" | "grp" | "k" | "g";
export function TableView({ items, selectedId, onSelect }: ViewProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "s", dir: 1 });
  const [limit, setLimit] = useState(300);
  const sorted = useMemo(() => {
    const val = (it: TLItem): string | number => (sort.key === "e" ? (it.e ?? it.s) : sort.key === "g" ? (it.g ?? it.grade ?? "") : (it[sort.key] ?? ""));
    return [...items].sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [items, sort]);
  const th = (key: SortKey, label: string) => (
    <th className="sticky top-0 cursor-pointer select-none bg-kosmo-panel px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-kosmo-dim hover:text-kosmo-text" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
    </th>
  );
  return (
    <div className="h-full overflow-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead><tr>{th("n", "Name")}{th("s", "Start")}{th("e", "End")}{th("lane", "Lane")}{th("grp", "Dataset")}{th("k", "Kind")}{th("g", "Grade")}</tr></thead>
        <tbody>
          {sorted.slice(0, limit).map((it) => (
            <tr key={it.id} onClick={() => onSelect(it.id)} className={`cursor-pointer border-t border-kosmo-line hover:bg-kosmo-panel ${selectedId === it.id ? "bg-kosmo-panel" : ""}`}>
              <td className="px-3 py-1.5 text-kosmo-text">{it.n}</td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-kosmo-mint">{it.approx ? "c. " : ""}{formatYear(it.s, true)}</td>
              <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-kosmo-dim">{it.e != null ? formatYear(it.e, true) : "—"}</td>
              <td className="px-3 py-1.5 text-kosmo-dim">{it.lane}</td>
              <td className="px-3 py-1.5 text-kosmo-dim">{it.grp}</td>
              <td className="px-3 py-1.5 text-kosmo-dim">{KIND_LABEL[it.k]}</td>
              <td className="px-3 py-1.5 text-kosmo-dim">{it.g ?? it.grade ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {limit < sorted.length && <div className="p-4 text-center"><button onClick={() => setLimit((l) => l + 400)} className="rounded-md border border-kosmo-line2 px-4 py-2 text-sm text-kosmo-dim hover:text-kosmo-text">Show more ({sorted.length - limit} left)</button></div>}
    </div>
  );
}

const ERAS: { label: string; from: number; to: number }[] = [
  { label: "Before 10,000 BCE", from: -1e9, to: -10000 },
  { label: "10,000–3500 BCE", from: -10000, to: -3499 },
  ...[[3500, 3000], [3000, 2500], [2500, 2000], [2000, 1500], [1500, 1000], [1000, 500], [500, 0]].map(([from, to]) => ({ label: `${from?.toLocaleString("en-US")}–${to} BCE`, from: 1 - from!, to: 1 - to! + (to === 0 ? 1 : 0) })),
  { label: "1–500 CE", from: 1, to: 501 }, { label: "500–1000", from: 501, to: 1001 }, { label: "1000–1500", from: 1001, to: 1501 }, { label: "1500–1800", from: 1501, to: 1801 }, { label: "1800–now", from: 1801, to: 1e9 },
];
/** Heat map of how much each dataset says about every era; click a cell to list it. */
export function ErasView({ items, selectedId, onSelect }: ViewProps) {
  const [cell, setCell] = useState<{ g: string; e: number } | null>(null);
  const groups = useMemo(() => [...new Set(items.map((i) => i.grp))], [items]);
  const grid = useMemo(() => {
    const m = new Map<string, TLItem[]>();
    for (const it of items) ERAS.forEach((er, ei) => { if (it.s < er.to && (it.e ?? it.s) >= er.from) { const k = `${it.grp}|${ei}`; const l = m.get(k); if (l) l.push(it); else m.set(k, [it]); } });
    return m;
  }, [items]);
  const max = Math.max(1, ...[...grid.values()].map((l) => l.length));
  const list = cell ? (grid.get(`${cell.g}|${cell.e}`) ?? []) : [];
  return (
    <div className="h-full overflow-auto p-4 md:p-8">
      <div className="mx-auto max-w-[80rem]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-1 text-xs">
            <thead><tr><th />{ERAS.map((e) => <th key={e.label} className="px-1 pb-1 text-center font-normal text-kosmo-dim2">{e.label}</th>)}</tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g}>
                  <th className="whitespace-nowrap pr-3 text-right font-medium text-kosmo-dim">{g}</th>
                  {ERAS.map((_, ei) => {
                    const n = grid.get(`${g}|${ei}`)?.length ?? 0;
                    const on = cell?.g === g && cell.e === ei;
                    return (
                      <td key={ei}>
                        <button disabled={!n} onClick={() => setCell(on ? null : { g, e: ei })} className={`flex h-14 w-full items-center justify-center rounded-md font-mono transition-colors ${on ? "ring-2 ring-kosmo-text" : ""} ${n ? "cursor-pointer text-kosmo-text hover:brightness-125" : "bg-kosmo-panel/40 text-kosmo-dim2"}`} style={n ? { background: groupColor(g, 0.1 + 0.6 * Math.sqrt(n / max)) } : undefined}>
                          {n || ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cell ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-kosmo-mint">{cell.g} · {ERAS[cell.e]!.label} <span className="text-kosmo-dim">({list.length})</span></h3>
            <ul className="grid gap-1 md:grid-cols-2">
              {list.slice(0, 200).map((it) => (
                <li key={it.id}><button onClick={() => onSelect(it.id)} className={`flex w-full items-baseline gap-3 rounded-md px-3 py-1.5 text-left hover:bg-kosmo-panel ${selectedId === it.id ? "bg-kosmo-panel" : ""}`}><span className="shrink-0 font-mono text-xs text-kosmo-mint">{formatSpan(it)}</span><span className="truncate text-kosmo-text">{it.n}</span></button></li>
              ))}
            </ul>
          </div>
        ) : <p className="mt-6 text-sm text-kosmo-dim">Pick a cell to list what each dataset records for that era.</p>}
      </div>
    </div>
  );
}
