"use client";

import { useEffect, useRef } from "react";
import { GROUP_ORDER, formatYear, groupColor } from "~/lib/timeline/format";
import type { TLItem, ViewWindow } from "~/lib/timeline/types";

// A history-weighted scale: deep time is squeezed so the recorded era stays readable.
const YEARS = [-320000, -10000, -3500, -1000, 1, 1000, 1800, 2200];
const FRACS = [0, 0.1, 0.24, 0.42, 0.6, 0.77, 0.9, 1];
export const toU = (y: number) => {
  if (y <= YEARS[0]!) return 0;
  for (let i = 1; i < YEARS.length; i++) if (y <= YEARS[i]!) return FRACS[i - 1]! + ((y - YEARS[i - 1]!) / (YEARS[i]! - YEARS[i - 1]!)) * (FRACS[i]! - FRACS[i - 1]!);
  return 1;
};
export const fromU = (u: number) => {
  for (let i = 1; i < FRACS.length; i++) if (u <= FRACS[i]!) return YEARS[i - 1]! + ((u - FRACS[i - 1]!) / (FRACS[i]! - FRACS[i - 1]!)) * (YEARS[i]! - YEARS[i - 1]!);
  return YEARS[YEARS.length - 1]!;
};

export function Minimap({ items, view, plotW, onView }: { items: TLItem[]; view: ViewWindow; plotW: number; onView: (x0: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const c = ref.current, w = wrap.current;
    if (!c || !w) return;
    const dpr = window.devicePixelRatio || 1;
    const W = w.clientWidth, H = w.clientHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bins = 240;
    const groups = GROUP_ORDER.filter((g) => items.some((i) => i.grp === g));
    const counts = groups.map(() => new Float32Array(bins));
    for (const it of items) {
      const gi = groups.indexOf(it.grp);
      if (gi < 0) continue;
      const a = Math.floor(toU(it.s) * (bins - 1)), b = Math.floor(toU(it.e ?? it.s) * (bins - 1));
      for (let i = a; i <= b; i++) counts[gi]![i]! += 1;
    }
    let max = 1;
    for (let i = 0; i < bins; i++) max = Math.max(max, counts.reduce((s, c) => s + c[i]!, 0));
    const bw = W / bins;
    for (let i = 0; i < bins; i++) {
      let y = H - 14;
      groups.forEach((g, gi) => {
        const hgt = (Math.sqrt(counts[gi]![i]! / max)) * (H - 20);
        ctx.fillStyle = groupColor(g, 0.65);
        ctx.fillRect(i * bw, y - hgt, bw + 0.5, hgt);
        y -= hgt;
      });
    }
    ctx.font = "10px ui-sans-serif, sans-serif";
    ctx.fillStyle = "#67686b";
    for (const y of [-10000, -3000, -500, 1, 1000, 1800]) { const x = toU(y) * W; ctx.fillRect(x, H - 14, 1, 4); ctx.fillText(formatYear(y), x + 3, H - 3); }
    const l = toU(view.x0) * W, r = toU(view.x0 + plotW / view.k) * W;
    ctx.fillStyle = "rgba(169,192,180,0.14)"; ctx.fillRect(l, 0, Math.max(r - l, 3), H - 14);
    ctx.strokeStyle = "rgba(169,192,180,0.9)"; ctx.lineWidth = 1.5; ctx.strokeRect(l + 0.5, 0.5, Math.max(r - l, 3), H - 15);
  }, [items, view, plotW]);

  // grab offset (in minimap units) from the window's left edge, so gripping anywhere on it moves it without jumping or resizing
  const grab = useRef(0);
  const uAt = (e: React.PointerEvent) => {
    const rect = wrap.current!.getBoundingClientRect();
    return { u: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)), rect };
  };
  const start = (e: React.PointerEvent) => {
    const { u, rect } = uAt(e);
    const l = toU(view.x0), r = toU(view.x0 + plotW / view.k);
    const slack = 8 / rect.width;
    // on the window (or within a few px of its sides): hold it where it was grabbed; elsewhere: centre it on the click
    grab.current = u >= l - slack && u <= r + slack ? u - l : (r - l) / 2;
    move(e);
  };
  const move = (e: React.PointerEvent) => {
    const { u } = uAt(e);
    onView(fromU(Math.min(1, Math.max(0, u - grab.current))));
  };
  return (
    <div
      ref={wrap}
      className="relative h-14 w-full cursor-grab active:cursor-grabbing touch-none select-none border-t border-kosmo-line bg-kosmo-panel"
      onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start(e); }}
      onPointerMove={(e) => dragging.current && move(e)}
      onPointerUp={() => (dragging.current = false)}
      aria-label="Overview. Drag to move through time."
    >
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  );
}
