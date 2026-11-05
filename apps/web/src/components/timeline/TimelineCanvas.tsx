"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EDGE_COLOR, formatSpan, formatYear, groupColor, laneColor, tickStep } from "~/lib/timeline/format";
import { AXIS_H, LABEL_W, ROW_H, type Layout } from "~/lib/timeline/layout";
import type { TLEdge, TLItem, ViewWindow } from "~/lib/timeline/types";

export const MIN_YEAR = -320000;
export const MAX_YEAR = 2200;

export const clampView = (v: ViewWindow, plotW: number): ViewWindow => {
  const minK = plotW / (MAX_YEAR - MIN_YEAR);
  const k = Math.min(600, Math.max(minK, v.k));
  const x0 = Math.min(MAX_YEAR - plotW / k, Math.max(MIN_YEAR, v.x0));
  return { x0, k };
};

interface Props {
  layout: Layout;
  edges: TLEdge[];
  view: ViewWindow;
  onView: (v: ViewWindow) => void;
  onSize: (s: { w: number; h: number; labelW: number }) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showLinks: boolean;
  mode: "lanes" | "branches";
  /** bump to reset vertical scroll (e.g. when the layout changes completely) */
  resetKey?: string;
}

interface Hit { x: number; y: number; w: number; h: number; id: string }

const css = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

export function TimelineCanvas({ layout, edges, view, onView, onSize, selectedId, onSelect, showLinks, mode, resetKey }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [scrollY, setScrollY] = useState(0);
  const [hover, setHover] = useState<{ item: TLItem; x: number; y: number } | null>(null);
  const hits = useRef<Hit[]>([]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const labelW = mode === "lanes" ? LABEL_W : 0;
  const labelWRef = useRef(labelW);
  labelWRef.current = labelW;
  const itemsById = useMemo(() => layout.byId, [layout]);

  const maxScroll = Math.max(0, layout.height + 24 - (size.h - AXIS_H));
  useEffect(() => setScrollY((s) => Math.min(Math.max(0, s), maxScroll)), [maxScroll]);
  useEffect(() => setScrollY(0), [resetKey]);

  // size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  useEffect(() => onSize({ w: size.w - labelW, h: size.h, labelW }), [size, labelW, onSize]);

  // ---- drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = size;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = css("--color-kosmo-bg", "#0e0e0f");
    const panel = css("--color-kosmo-panel", "#171718");
    const line = css("--color-kosmo-line", "#242527");
    const line2 = css("--color-kosmo-line2", "#303133");
    const text = css("--color-kosmo-text", "#e8e8e6");
    const dim = css("--color-kosmo-dim", "#8d8e91");
    const dim2 = css("--color-kosmo-dim2", "#67686b");
    const sel = selectedId;
    const hov = hover?.item.id ?? null;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const { x0, k } = view;
    const px = (year: number) => labelW + (year - x0) * k;
    const top = AXIS_H - scrollY;
    const plotL = labelW;
    const rects: Hit[] = [];
    ctx.font = "11px ui-sans-serif, -apple-system, 'Segoe UI', Inter, sans-serif";
    ctx.textBaseline = "middle";

    // lane bands
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, AXIS_H, w, h - AXIS_H);
    ctx.clip();
    layout.bands.forEach((b, i) => {
      const y = top + b.y;
      if (y > h || y + b.h < AXIS_H) return;
      if (i % 2 === 0) { ctx.fillStyle = "rgba(255,255,255,0.018)"; ctx.fillRect(plotL, y, w - plotL, b.h); }
      ctx.fillStyle = line; ctx.fillRect(plotL, y + b.h - 1, w - plotL, 1);
    });

    // vertical grid
    // ticks run in historical numbering (… 1500 BCE, 1000 BCE, 1 CE …): h = -1500 is astronomical -1499
    const step = tickStep(k, 110);
    const toAstro = (hy: number) => (hy < 0 ? hy + 1 : hy);
    const histLeft = x0 <= 0 ? x0 - 1 : x0;
    const first = Math.ceil(histLeft / step) * step;
    ctx.fillStyle = line;
    for (let t = first; px(toAstro(t)) < w; t += step) if (t !== 0) ctx.fillRect(Math.round(px(toAstro(t))), AXIS_H, 1, h - AXIS_H);

    // links (under the nodes)
    const drawLinks = showLinks || mode === "branches";
    if (drawLinks) {
      const near = (id: string) => id === sel || id === hov;
      ctx.lineCap = "round";
      for (const e of edges) {
        const a = layout.byId.get(e.a), b = layout.byId.get(e.b);
        if (!a || !b) continue;
        const xa = px(a.item.e != null && mode === "lanes" ? a.item.s : a.item.s), xb = px(b.item.s);
        if ((xa < plotL - 40 && xb < plotL - 40) || (xa > w + 40 && xb > w + 40)) continue;
        const ya = top + a.y, yb = top + b.y;
        if ((ya < AXIS_H && yb < AXIS_H) || (ya > h && yb > h)) continue;
        const hot = near(e.a) || near(e.b);
        const dimOthers = !!(sel || hov);
        ctx.strokeStyle = EDGE_COLOR[e.cat] ?? dim;
        ctx.globalAlpha = hot ? 0.95 : dimOthers ? 0.1 : mode === "branches" ? 0.55 : 0.28;
        ctx.lineWidth = hot ? 2 : mode === "branches" ? 1.4 : 1;
        ctx.beginPath();
        ctx.moveTo(xa, ya);
        const mx = (xa + xb) / 2;
        ctx.bezierCurveTo(mx, ya, mx, yb, xb, yb);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // nodes
    const rowH = 14;
    for (const n of layout.nodes) {
      const it = n.item;
      const cy = top + n.y;
      if (cy < AXIS_H - rowH || cy > h + rowH) continue;
      const x1 = px(it.s);
      const x2 = it.e != null ? px(it.e) : x1;
      if (x2 < plotL - 4 || x1 > w + 4) {
        // an off-screen long bar can still cover the viewport; handled by the check above (x2 < plotL / x1 > w)
        continue;
      }
      const col = mode === "lanes" ? laneColor(it.lane) : groupColor(it.grp);
      const isSel = it.id === sel, isHov = it.id === hov;
      const lw = x2 - x1;
      if (it.e != null && lw > 7 && mode === "lanes") {
        const bx = Math.max(x1, plotL - 2), bw = Math.min(x2, w + 2) - bx;
        const by = cy - rowH / 2;
        ctx.fillStyle = laneColor(mode === "lanes" ? it.lane : it.grp, isSel || isHov ? 0.5 : 0.24);
        roundRect(ctx, bx, by, bw, rowH, 4); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2 : 1;
        ctx.globalAlpha = isSel ? 1 : 0.85;
        if (it.approx) ctx.setLineDash([3, 3]);
        roundRect(ctx, bx + 0.5, by + 0.5, bw - 1, rowH - 1, 4); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath(); ctx.rect(Math.max(bx, plotL) + 4, by, bw - 8, rowH); ctx.clip();
        ctx.fillStyle = text;
        ctx.fillText(it.n, Math.max(bx, plotL) + 5, cy + 0.5);
        ctx.restore();
        if (x1 < plotL || x2 > w) { /* clipped bars keep their label pinned to the visible edge */ }
        rects.push({ x: bx, y: by, w: bw, h: rowH, id: it.id });
      } else {
        // point (or a very short span): dot + label
        const r = isSel || isHov ? 5.5 : 4;
        if (it.e != null && lw > 1.5) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, cy); ctx.lineTo(x2, cy); ctx.stroke(); }
        ctx.fillStyle = col;
        ctx.beginPath();
        if (it.k === "period" || it.k === "tradition") ctx.rect(x1 - r, cy - r, r * 2, r * 2);
        else if (it.k === "deity") { ctx.moveTo(x1, cy - r - 1); ctx.lineTo(x1 + r + 1, cy); ctx.lineTo(x1, cy + r + 1); ctx.lineTo(x1 - r - 1, cy); ctx.closePath(); }
        else ctx.arc(x1, cy, r, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) { ctx.strokeStyle = text; ctx.lineWidth = 1.5; ctx.stroke(); }
        if (x1 >= plotL - 2) {
          ctx.fillStyle = isSel || isHov ? text : dim;
          const tx = Math.max(x2, x1) + r + 5;
          ctx.fillText(it.n.length > 40 ? it.n.slice(0, 39) + "…" : it.n, tx, cy + 0.5);
        }
        rects.push({ x: x1 - 7, y: cy - 8, w: Math.max(x2 - x1, 0) + 14 + Math.min(it.n.length, 40) * 5.8, h: 16, id: it.id });
      }
    }
    hits.current = rects;
    ctx.restore();

    // lane labels (sticky)
    if (mode === "lanes") {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, AXIS_H, plotL, h - AXIS_H); ctx.clip();
      ctx.fillStyle = panel; ctx.fillRect(0, AXIS_H, plotL, h - AXIS_H);
      let lastGrp = "";
      for (const b of layout.bands) {
        const y = top + b.y;
        if (y > h || y + b.h < AXIS_H) continue;
        const ty = Math.max(y + 12, Math.min(AXIS_H + 12, y + b.h - 10));
        if (b.grp !== lastGrp) { lastGrp = b.grp; }
        ctx.fillStyle = laneColor(b.label);
        ctx.fillRect(0, y + 3, 3, b.h - 7);
        ctx.fillStyle = text;
        ctx.font = "600 11.5px ui-sans-serif, -apple-system, 'Segoe UI', Inter, sans-serif";
        const lbl = fit(ctx, b.label, plotL - 22);
        ctx.fillText(lbl, 12, ty);
        ctx.font = "10px ui-sans-serif, -apple-system, 'Segoe UI', Inter, sans-serif";
        ctx.fillStyle = dim2;
        ctx.fillText(`${b.grp} · ${b.count}`, 12, ty + 13);
        ctx.fillStyle = line; ctx.fillRect(0, y + b.h - 1, plotL, 1);
      }
      ctx.fillStyle = line2; ctx.fillRect(plotL - 1, AXIS_H, 1, h - AXIS_H);
      ctx.restore();
    }

    // axis
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, w, AXIS_H);
    ctx.fillStyle = line2; ctx.fillRect(0, AXIS_H - 1, w, 1);
    ctx.font = "11px ui-sans-serif, -apple-system, 'Segoe UI', Inter, sans-serif";
    ctx.fillStyle = dim;
    for (let t = first; px(toAstro(t)) < w + 50; t += step) {
      if (t === 0) continue;
      const x = Math.round(px(toAstro(t)));
      if (x < plotL - 2) continue;
      ctx.fillStyle = line2; ctx.fillRect(x, AXIS_H - 7, 1, 7);
      ctx.fillStyle = dim;
      ctx.fillText(formatYear(toAstro(t)), x + 4, AXIS_H / 2 - 2);
    }
    if (mode === "lanes") { ctx.fillStyle = panel; ctx.fillRect(0, 0, plotL - 1, AXIS_H - 1); ctx.fillStyle = dim2; ctx.fillText("scroll to zoom · drag to pan", 12, AXIS_H / 2); }

    // the CE/BCE boundary
    const zx = px(0.5);
    if (zx > plotL && zx < w) { ctx.fillStyle = "rgba(196,163,115,0.55)"; ctx.fillRect(Math.round(zx), AXIS_H, 1, h - AXIS_H); }
  }, [size, view, layout, edges, selectedId, hover, showLinks, mode, labelW, scrollY]);

  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [draw]);

  // ---- interaction ----
  const drag = useRef<{ id: number; sx: number; sy: number; x0: number; sc: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; k: number } | null>(null);
  const scrollRef = useRef(scrollY);
  scrollRef.current = scrollY;

  const zoomAt = useCallback((clientX: number, factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const lw = labelWRef.current;
    const v = viewRef.current;
    const plotW = sizeRef.current.w - lw;
    const cx = Math.max(lw, clientX - rect.left);
    const yearAt = v.x0 + (cx - lw) / v.k;
    const k = Math.min(600, Math.max(plotW / (MAX_YEAR - MIN_YEAR), v.k * factor));
    onView(clampView({ k, x0: yearAt - (cx - lw) / k }, plotW));
  }, [onView]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current, lw = labelWRef.current, plotW = sizeRef.current.w - lw;
      if (e.shiftKey) {
        const lh = layoutRef.current.height + 24 - (sizeRef.current.h - AXIS_H);
        setScrollY((s) => Math.min(Math.max(0, lh), Math.max(0, s + (e.deltaY || e.deltaX))));
      } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        onView(clampView({ k: v.k, x0: v.x0 + e.deltaX / v.k }, plotW));
      } else {
        zoomAt(e.clientX, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018)));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onView, zoomAt]);

  const hitAt = (clientX: number, clientY: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    if (y < AXIS_H || x < labelWRef.current) return null;
    const list = hits.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i]!;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { id: r.id, x, y };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    wrapRef.current?.focus({ preventScroll: true });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { d: Math.hypot(p.x - q.x, p.y - q.y), k: viewRef.current.k };
      drag.current = null;
      return;
    }
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: viewRef.current.x0, sc: scrollRef.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      zoomAt((p.x + q.x) / 2, (pinch.current.k * (d / pinch.current.d)) / viewRef.current.k);
      return;
    }
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (d.moved) {
        const v = viewRef.current;
        onView(clampView({ k: v.k, x0: d.x0 - dx / v.k }, sizeRef.current.w - labelWRef.current));
        setScrollY(Math.min(Math.max(0, layoutRef.current.height + 24 - (sizeRef.current.h - AXIS_H)), Math.max(0, d.sc - dy)));
        setHover(null);
      }
      return;
    }
    const hit = hitAt(e.clientX, e.clientY);
    const item = hit ? itemsById.get(hit.id)?.item : undefined;
    setHover((prev) => (item ? { item, x: hit!.x, y: hit!.y } : prev ? null : prev));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      const hit = hitAt(e.clientX, e.clientY);
      onSelect(hit ? hit.id : null);
    }
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const hit = hitAt(e.clientX, e.clientY);
    const n = hit ? itemsById.get(hit.id) : undefined;
    const plotW = size.w - labelW;
    if (n) {
      const it = n.item;
      const span = Math.max((it.e ?? it.s) - it.s, 1);
      const k = Math.min(600, plotW / (span * 3));
      onView(clampView({ k, x0: it.s - (plotW / k - span) / 2 }, plotW));
      onSelect(it.id);
    } else zoomAt(e.clientX, 2);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = view, plotW = size.w - labelW;
    const mid = (labelW + size.w) / 2 + (wrapRef.current?.getBoundingClientRect().left ?? 0);
    if (e.key === "+" || e.key === "=") zoomAt(mid, 1.4);
    else if (e.key === "-") zoomAt(mid, 1 / 1.4);
    else if (e.key === "ArrowLeft") onView(clampView({ k: v.k, x0: v.x0 - plotW / v.k / 6 }, plotW));
    else if (e.key === "ArrowRight") onView(clampView({ k: v.k, x0: v.x0 + plotW / v.k / 6 }, plotW));
    else if (e.key === "ArrowUp") setScrollY((s) => Math.max(0, s - ROW_H * 3));
    else if (e.key === "ArrowDown") setScrollY((s) => Math.min(maxScroll, s + ROW_H * 3));
    else if (e.key === "Escape") onSelect(null);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="application"
      aria-label="Timeline. Scroll to zoom, drag to pan, shift and scroll to move through lanes."
      className="relative h-full w-full cursor-grab touch-none overflow-hidden outline-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHover(null)}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} className="block" />
      {maxScroll > 0 && (
        <div className="pointer-events-none absolute right-1 rounded-full bg-white/15" style={{ top: AXIS_H + (scrollY / maxScroll) * (size.h - AXIS_H - 48) + 2, width: 4, height: 44 }} />
      )}
      {hover && !drag.current && (
        <div
          className="pointer-events-none absolute z-10 max-w-[20rem] rounded-md border border-kosmo-line2 bg-kosmo-panel/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{ left: Math.min(hover.x + 14, size.w - 280), top: Math.min(hover.y + 14, size.h - 90) }}
        >
          <div className="font-semibold text-kosmo-text">{hover.item.n}</div>
          <div className="mt-0.5 text-kosmo-mint">{formatSpan(hover.item)}</div>
          <div className="mt-0.5 text-kosmo-dim">{hover.item.lane}</div>
          {hover.item.d && <div className="mt-1 line-clamp-3 text-kosmo-dim">{hover.item.d}</div>}
        </div>
      )}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, s: string, max: number) {
  if (ctx.measureText(s).width <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, mid) + "…").width <= max) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + "…";
}
