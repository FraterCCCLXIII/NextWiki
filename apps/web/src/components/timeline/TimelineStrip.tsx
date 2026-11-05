"use client";

import { useEffect, useState } from "react";
import { formatSpan, formatYear, laneColor } from "~/lib/timeline/format";
import type { TLItem } from "~/lib/timeline/types";

interface Around { item: TLItem; from: number; to: number; items: TLItem[] }

/** `{{kosmo:timeline:<slug>}}`: where this entity sits in time, with its neighbours, linking into the full Timeline. */
export function TimelineStrip({ slug }: { slug: string }) {
  const [data, setData] = useState<Around | null | "missing">(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/kosmo/timeline?around=${encodeURIComponent(slug)}`, { signal: ctl.signal })
      .then((r): Promise<Around | "missing"> => (r.ok ? (r.json() as Promise<Around>) : Promise.resolve("missing" as const)))
      .then(setData)
      .catch(() => !ctl.signal.aborted && setData("missing"));
    return () => ctl.abort();
  }, [slug]);
  if (data === null) return <div className="my-6 h-24 animate-pulse rounded-md border border-kosmo-line bg-kosmo-panel" />;
  if (data === "missing") return <p className="my-4 text-base text-kosmo-dim">No timeline entry for {slug}.</p>;
  const { item, from, to, items } = data;
  const x = (y: number) => ((y - from) / (to - from)) * 100;
  const link = `/kosmo/timeline?sel=${encodeURIComponent(item.id)}&x=${Math.round(from)}&k=${(1000 / (to - from)).toPrecision(3)}`;
  // simple greedy rows so neighbouring labels do not collide
  const rows: number[] = [];
  const placed = [item, ...items].sort((a, b) => a.s - b.s).map((it) => {
    const left = x(it.s);
    const right = Math.max(x(it.e ?? it.s), left) + 14 + Math.min(it.n.length, 22) * 0.55;
    let r = rows.findIndex((end) => end + 1 < left);
    if (r < 0) { r = rows.length; rows.push(right); } else rows[r] = right;
    return { it, r, left, w: it.e != null ? Math.max(x(it.e) - left, 0.6) : 0 };
  });
  return (
    <section className="my-6 rounded-md border border-kosmo-line bg-kosmo-panel p-4 text-kosmo-text" aria-label="On the timeline">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div><div className="text-[11px] uppercase tracking-[0.16em] text-kosmo-dim">On the timeline</div><div className="font-semibold">{item.n} <span className="font-mono text-sm font-normal text-kosmo-mint">{formatSpan(item)}</span></div></div>
        <a href={link} className="shrink-0 text-sm text-kosmo-mint hover:underline">Open in Timeline →</a>
      </header>
      <div className="relative" style={{ height: 22 * Math.min(rows.length, 6) + 22 }}>
        <div className="absolute inset-x-0 top-0 flex justify-between text-[10px] text-kosmo-dim2"><span>{formatYear(from)}</span><span>{formatYear(to)}</span></div>
        {placed.filter((p) => p.r < 6).map(({ it, r, left, w }) => {
          const on = it.id === item.id;
          return (
            <a key={it.id} href={it.page ?? `/kosmo/timeline?sel=${encodeURIComponent(it.id)}`} title={`${it.n} · ${formatSpan(it)}`} className="absolute flex items-center gap-1.5 whitespace-nowrap text-[11px] hover:text-kosmo-text" style={{ left: `${Math.max(0, left)}%`, top: 18 + r * 22, color: on ? "inherit" : undefined }}>
              {w > 0 ? <span className="h-2.5 rounded-sm" style={{ width: `${w}vw`, maxWidth: "60vw", minWidth: 6, background: laneColor(it.lane, on ? 0.9 : 0.4) }} /> : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: laneColor(it.lane, on ? 1 : 0.6) }} />}
              <span className={on ? "font-semibold text-kosmo-text" : "text-kosmo-dim"}>{it.n.length > 28 ? it.n.slice(0, 27) + "…" : it.n}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
