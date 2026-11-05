"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GROUP_ORDER, KIND_LABEL, EDGE_COLOR, formatSpan, groupColor, laneColor } from "~/lib/timeline/format";
import { graphComponents, layoutBranches, layoutLanes } from "~/lib/timeline/layout";
import { VIEWS, type TLData, type TLItem, type ViewId, type ViewWindow } from "~/lib/timeline/types";
import { Minimap } from "./Minimap";
import { MAX_YEAR, MIN_YEAR, TimelineCanvas, clampView } from "./TimelineCanvas";
import { CardsView, ErasView, TableView, VerticalView } from "./Views";

const PRESETS: { label: string; from: number; to: number }[] = [
  { label: "Deep time", from: -310000, to: 2100 },
  { label: "Antiquity", from: -3600, to: 700 },
  { label: "Common Era", from: -50, to: 2060 },
];

const fitWindow = (from: number, to: number, plotW: number): ViewWindow => clampView({ x0: from, k: plotW / (to - from) }, plotW);

export function TimelineApp() {
  const [data, setData] = useState<TLData | null>(null);
  const [meta, setMeta] = useState<{ id: string; label: string; count: number }[] | null>(null);
  const [counts, setCounts] = useState({ matched: 0, total: 0 });
  const fetched = useRef<{ from: number; to: number; key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewId>("lanes");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [win, setWin] = useState<ViewWindow>({ x0: -3600, k: 0.1 });
  const [plot, setPlot] = useState({ w: 0, h: 0, labelW: 0 });
  const [showLinks, setShowLinks] = useState(false);
  const [compIdx, setCompIdx] = useState(0);
  const initialised = useRef(false);
  const [showAllSets, setShowAllSets] = useState(false);
  const toggleGroup = (g: string) => setOff((s) => { const next = new Set(s); if (next.has(g)) next.delete(g); else next.add(g); return next; });
  const fromUrl = useRef<{ x0?: number; k?: number }>({});

  // dataset list; falls back to the static JSON when the database has no timeline rows yet
  const staticData = useRef<TLData | null>(null);
  useEffect(() => {
    fetch("/api/kosmo/timeline?meta=1")
      .then((r) => (r.ok ? (r.json() as Promise<{ datasets: { id: string; label: string; count: number }[] }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m) => {
        if (!m.datasets.length) throw new Error("empty");
        setMeta(m.datasets);
      })
      .catch(() => {
        fetch("/timeline/timeline.json")
          .then((r) => (r.ok ? (r.json() as Promise<TLData>) : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((d) => {
            staticData.current = d;
            const c = new Map<string, number>();
            for (const i of d.items) c.set(i.grp, (c.get(i.grp) ?? 0) + 1);
            setMeta([...c.entries()].map(([label, count]) => ({ id: label, label, count })));
            setData(d);
            setCounts({ matched: d.items.length, total: d.items.length });
          })
          .catch((e: Error) => setError(e.message));
      });
  }, []);

  // ---- URL state ----
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get("v") as ViewId | null;
    if (v && VIEWS.some((x) => x.id === v)) setView(v);
    if (p.get("q")) setQ(p.get("q")!);
    if (p.get("sel")) setSelectedId(p.get("sel"));
    if (p.get("off")) setOff(new Set(p.get("off")!.split("|")));
    if (p.get("links") === "1") setShowLinks(true);
    if (p.get("c")) setCompIdx(Number(p.get("c")) || 0);
    const x = Number(p.get("x")), k = Number(p.get("k"));
    if (p.has("x") && p.has("k") && Number.isFinite(x) && k > 0) fromUrl.current = { x0: x, k };
  }, []);
  useEffect(() => {
    if (!initialised.current) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (view !== "lanes") p.set("v", view);
      if (q) p.set("q", q);
      if (selectedId) p.set("sel", selectedId);
      if (off.size) p.set("off", [...off].join("|"));
      if (showLinks) p.set("links", "1");
      if (compIdx) p.set("c", String(compIdx));
      if (view === "lanes" || view === "branches") { p.set("x", String(Math.round(win.x0 * 10) / 10)); p.set("k", win.k.toPrecision(4)); }
      const qs = p.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [view, q, selectedId, off, showLinks, compIdx, win]);

  const items = data?.items;
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const groups = useMemo(() => (meta ?? []).map((m) => [m.label, m.count] as [string, number]).sort((a, b) => b[1] - a[1]), [meta]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => !off.has(i.grp) && (!needle || i.n.toLowerCase().includes(needle) || i.lane.toLowerCase().includes(needle) || (i.d?.toLowerCase().includes(needle) ?? false)));
  }, [items, off, q]);

  const kBucket = Math.pow(2, Math.round(Math.log2(win.k) * 2) / 2);
  const lanes = useMemo(() => layoutLanes(filtered, kBucket, GROUP_ORDER), [filtered, kBucket]);
  const comps = useMemo(() => graphComponents(filtered, data?.edges ?? []), [filtered, data]);
  const comp = comps[Math.min(compIdx, Math.max(0, comps.length - 1))];
  const branches = useMemo(() => (comp ? layoutBranches(filtered, data?.edges ?? [], comp) : null), [comp, filtered, data]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(filtered.map((i) => i.id));
    return (data?.edges ?? []).filter((e) => ids.has(e.a) && ids.has(e.b));
  }, [filtered, data]);

  const onSize = useCallback((s: { w: number; h: number; labelW: number }) => setPlot((p) => (p.w === s.w && p.h === s.h && p.labelW === s.labelW ? p : s)), []);

  // first fit once the canvas has a width
  useEffect(() => {
    if (initialised.current || plot.w < 50) return;
    initialised.current = true;
    setWin(fromUrl.current.x0 != null ? clampView({ x0: fromUrl.current.x0, k: fromUrl.current.k! }, plot.w) : fitWindow(-3600, 2060, plot.w));
  }, [plot.w]);

  // entering Branches (or picking another lineage) frames that lineage's time span
  const fitKey = view === "branches" && comp ? `${comp.id}|${filtered.length}` : "";
  const lastFit = useRef("");
  useEffect(() => {
    if (!initialised.current || !fitKey || plot.w < 50 || fitKey === lastFit.current) return;
    if (lastFit.current === "" && fromUrl.current.x0 != null) { lastFit.current = fitKey; return; }
    lastFit.current = fitKey;
    const byIdLocal = new Map(filtered.map((i) => [i.id, i]));
    const ys = comp!.ids.map((id) => byIdLocal.get(id)).filter(Boolean) as TLItem[];
    if (!ys.length) return;
    const lo = Math.min(...ys.map((i) => i.s)), hi = Math.max(...ys.map((i) => i.e ?? i.s));
    const pad = Math.max(30, (hi - lo) * 0.12);
    setWin(fitWindow(lo - pad, hi + pad * 3, plot.w));
  }, [fitKey, plot.w, comp, filtered]);

  // windowed loading: ask the API for what overlaps the view (plus a margin), thinned by significance
  const reqId = useRef(0);
  useEffect(() => {
    if (!meta || staticData.current || !initialised.current || plot.w < 50) return;
    const tl = view === "lanes" || view === "branches";
    const span = plot.w / win.k;
    const from = tl ? win.x0 - span * 0.3 : -320000;
    const to = tl ? win.x0 + span * 1.3 : 2200;
    const on = meta.filter((m) => !off.has(m.label)).map((m) => m.id);
    const key = `${tl}|${on.join(",")}|${q}`;
    const f = fetched.current;
    if (f && f.key === key) {
      if (!tl) return;
      const ratio = (f.to - f.from) / (span * 1.6);
      if (win.x0 >= f.from && win.x0 + span <= f.to && ratio > 0.6 && ratio < 1.7) return;
    }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ from: String(Math.round(from)), to: String(Math.round(to)), limit: tl ? "2500" : "3000" });
      if (off.size) params.set("datasets", on.join(","));
      if (q.trim()) params.set("q", q.trim());
      fetch(`/api/kosmo/timeline?${params}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ items: TLItem[]; edges: TLData["edges"]; matched: number; total: number }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((w) => {
          if (id !== reqId.current) return;
          fetched.current = { from, to, key };
          setData({ version: 2, built: "", items: w.items, edges: w.edges });
          setCounts({ matched: w.matched, total: w.total });
        })
        .catch((e: Error) => id === reqId.current && setError(e.message))
        .finally(() => id === reqId.current && setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [meta, win, plot.w, view, off, q]);

  const zoomBy = (f: number) => {
    const cx = win.x0 + plot.w / win.k / 2;
    const k = Math.min(600, Math.max(plot.w / (MAX_YEAR - MIN_YEAR), win.k * f));
    setWin(clampView({ k, x0: cx - plot.w / k / 2 }, plot.w));
  };
  const focusItem = (it: TLItem) => {
    if (view !== "lanes" && view !== "branches") return;
    const span = Math.max((it.e ?? it.s) - it.s, 1);
    const wantK = Math.min(600, plot.w / Math.max(span * 3, 40));
    const k = Math.max(Math.min(win.k, wantK) === win.k && span < plot.w / win.k ? win.k : wantK, plot.w / (MAX_YEAR - MIN_YEAR));
    setWin(clampView({ k, x0: it.s + span / 2 - plot.w / k / 2 }, plot.w));
  };
  const select = (id: string | null) => setSelectedId(id);
  const selCache = useRef<TLItem | null>(null);
  const selectedNow = selectedId ? byId.get(selectedId) ?? null : null;
  if (selectedNow) selCache.current = selectedNow;
  const selectedBase = selectedNow ?? (selectedId && selCache.current?.id === selectedId ? selCache.current : null);
  // window payloads carry a 220-character summary; fetch the full text for the open item
  const [fullText, setFullText] = useState<{ id: string; d: string } | null>(null);
  useEffect(() => {
    if (!selectedBase || staticData.current || (selectedBase.d?.length ?? 0) < 215 || fullText?.id === selectedBase.id) return;
    const ctl = new AbortController();
    fetch(`/api/kosmo/entity/${encodeURIComponent(selectedBase.id)}?kind=infobox`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ entity?: { summary?: string | null } }>) : null))
      .then((j) => j?.entity?.summary && setFullText({ id: selectedBase.id, d: j.entity.summary }))
      .catch(() => undefined);
    return () => ctl.abort();
  }, [selectedBase, fullText]);
  const selected = selectedBase && fullText?.id === selectedBase.id ? { ...selectedBase, d: fullText.d } : selectedBase;
  const isTimeline = view === "lanes" || view === "branches";

  const related = useMemo(() => {
    if (!selected || !data) return [];
    return data.edges
      .filter((e) => e.a === selected.id || e.b === selected.id)
      .map((e) => ({ e, other: byId.get(e.a === selected.id ? e.b : e.a), out: e.a === selected.id }))
      .filter((r) => r.other)
      .slice(0, 60);
  }, [selected, data, byId]);

  if (error) return <div className="p-8 text-kosmo-red">Could not load the timeline data ({error}). Run <code>node tools/build-timeline-data.mjs</code>.</div>;

  return (
    <div className="flex h-full min-h-0 flex-col bg-kosmo-bg text-kosmo-text">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-kosmo-line bg-kosmo-panel px-3 py-2">
        <div className="flex items-center gap-1 rounded-lg bg-kosmo-bg p-0.5" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.id} role="tab" aria-selected={view === v.id} title={v.hint} onClick={() => setView(v.id)} className={`rounded-md px-3 py-1 text-[13px] transition-colors ${view === v.id ? "bg-kosmo-line2 text-kosmo-text" : "text-kosmo-dim hover:text-kosmo-text"}`}>
              {v.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events, people, lanes…"
          aria-label="Search the timeline"
          className="h-8 min-w-[10rem] flex-1 rounded-md border border-kosmo-line2 bg-kosmo-bg px-3 text-[13px] text-kosmo-text placeholder:text-kosmo-dim2 focus:border-kosmo-mint focus:outline-none md:max-w-[20rem]"
        />
        {isTimeline && (
          <div className="flex items-center gap-1">
            <button className="h-8 w-8 rounded-md border border-kosmo-line2 text-lg leading-none text-kosmo-dim hover:text-kosmo-text" onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
            <button className="h-8 w-8 rounded-md border border-kosmo-line2 text-lg leading-none text-kosmo-dim hover:text-kosmo-text" onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => setWin(fitWindow(p.from, p.to, plot.w))} className="h-8 rounded-md border border-kosmo-line2 px-2.5 text-[12px] text-kosmo-dim hover:text-kosmo-text">{p.label}</button>
            ))}
          </div>
        )}
        {view === "lanes" && (
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-kosmo-dim">
            <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} className="accent-[#a9c0b4]" /> Relations
          </label>
        )}
        {view === "branches" && (
          <select value={Math.min(compIdx, Math.max(0, comps.length - 1))} onChange={(e) => setCompIdx(Number(e.target.value))} aria-label="Lineage to show" className="h-8 max-w-[18rem] rounded-md border border-kosmo-line2 bg-kosmo-bg px-2 text-[12px] text-kosmo-text">
            {comps.length === 0 && <option>No connected lineages</option>}
            {comps.slice(0, 120).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        )}
        <span className="ml-auto text-[12px] text-kosmo-dim2">{loading ? "loading… " : ""}{filtered.length.toLocaleString()} shown{counts.matched > (items?.length ?? 0) ? ` of ${counts.matched.toLocaleString()} in view — zoom in for more` : ""} · {counts.total.toLocaleString()} total</span>
      </div>
      {/* dataset filter: the biggest few as chips, everything else in a scrolling panel */}
      <div className="border-b border-kosmo-line px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {groups.slice(0, 6).map(([g, n]) => <DatasetChip key={g} g={g} n={n} on={!off.has(g)} toggle={toggleGroup} />)}
          {groups.length > 6 && (
            <button onClick={() => setShowAllSets((v) => !v)} aria-expanded={showAllSets} className="rounded-full border border-kosmo-line2 px-2.5 py-0.5 text-[12px] text-kosmo-dim hover:text-kosmo-text">
              {showAllSets ? "Hide" : `All ${groups.length} datasets`} {showAllSets ? "▴" : "▾"}{off.size ? ` · ${off.size} off` : ""}
            </button>
          )}
          {showLinks || view === "branches" ? (
            <span className="ml-auto hidden items-center gap-3 text-[11px] text-kosmo-dim2 md:flex">
              {(["transmission", "genealogical", "linguistic", "parallel", "influence", "theological"] as const).map((c) => (
                <span key={c} className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: EDGE_COLOR[c] }} />{c}</span>
              ))}
            </span>
          ) : null}
        </div>
        {showAllSets && (
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-kosmo-line bg-kosmo-bg p-2">
            <div className="mb-1.5 flex gap-2 text-[12px]">
              <button onClick={() => setOff(new Set())} className="text-kosmo-mint hover:underline">Select all</button>
              <button onClick={() => setOff(new Set(groups.map(([g]) => g)))} className="text-kosmo-mint hover:underline">Select none</button>
            </div>
            <div className="flex flex-wrap gap-1.5">{groups.map(([g, n]) => <DatasetChip key={g} g={g} n={n} on={!off.has(g)} toggle={toggleGroup} />)}</div>
          </div>
        )}
      </div>

      {/* body */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {!meta ? (
            <div className="grid h-full place-items-center text-kosmo-dim">Loading the timeline…</div>
          ) : (
            <>
              {view === "lanes" && <TimelineCanvas layout={lanes} edges={visibleEdges} view={win} onView={setWin} onSize={onSize} selectedId={selectedId} onSelect={select} showLinks={showLinks} mode="lanes" resetKey={[...off].join()} />}
              {view === "branches" && (branches ? <TimelineCanvas layout={branches} edges={visibleEdges} view={win} onView={setWin} onSize={onSize} selectedId={selectedId} onSelect={select} showLinks mode="branches" resetKey={String(comp?.id)} /> : <div className="grid h-full place-items-center text-kosmo-dim">No connected lineages in the current selection.</div>)}
              {view === "vertical" && <VerticalView items={filtered} selectedId={selectedId} onSelect={select} />}
              {view === "cards" && <CardsView items={filtered} selectedId={selectedId} onSelect={select} />}
              {view === "table" && <TableView items={filtered} selectedId={selectedId} onSelect={select} />}
              {view === "eras" && <ErasView items={filtered} selectedId={selectedId} onSelect={select} />}
            </>
          )}
          {/* detail drawer */}
          {selected && (
            <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[24rem] flex-col border-l border-kosmo-line2 bg-kosmo-panel/97 shadow-2xl backdrop-blur" aria-label="Details">
              <div className="flex items-start gap-3 border-b border-kosmo-line p-4">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: laneColor(selected.lane) }} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-snug">{selected.n}</h2>
                  <p className="mt-0.5 font-mono text-[13px] text-kosmo-mint">{formatSpan(selected)}</p>
                </div>
                <button onClick={() => select(null)} aria-label="Close details" className="rounded p-1 text-kosmo-dim hover:text-kosmo-text">✕</button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Chip>{KIND_LABEL[selected.k]}</Chip>
                  <Chip color={groupColor(selected.grp)}>{selected.grp}</Chip>
                  <Chip>{selected.lane}</Chip>
                  {selected.reg && selected.reg !== selected.lane && <Chip>{selected.reg}</Chip>}
                  {(selected.g || selected.grade) && <Chip>{selected.g ?? selected.grade}</Chip>}
                  {selected.approx && <Chip>approximate dates</Chip>}
                </div>
                {selected.d && <p className="whitespace-pre-wrap leading-relaxed text-kosmo-text/90">{selected.d}</p>}
                {selected.src?.length ? <div><h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-kosmo-dim">Sources</h3><ul className="list-disc space-y-0.5 pl-4 text-kosmo-dim">{selected.src.map((s) => <li key={s}>{s}</li>)}</ul></div> : null}
                {selected.page && <a href={selected.page} className="inline-block rounded-md border border-kosmo-mint/60 px-3 py-1.5 text-[13px] text-kosmo-mint hover:bg-kosmo-bg">Open wiki page →</a>}
                {isTimeline && <button onClick={() => focusItem(selected)} className="rounded-md border border-kosmo-line2 px-3 py-1.5 text-[13px] text-kosmo-mint hover:bg-kosmo-bg">Centre on timeline</button>}
                {related.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-kosmo-dim">Connections ({related.length})</h3>
                    <ul className="space-y-0.5">
                      {related.map((r) => (
                        <li key={r.e.a + r.e.b + r.e.t}>
                          <button onClick={() => { select(r.other!.id); focusItem(r.other!); }} className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left hover:bg-kosmo-bg">
                            <span className="h-0.5 w-3 shrink-0 self-center" style={{ background: EDGE_COLOR[r.e.cat] }} />
                            <span className="shrink-0 text-[11px] text-kosmo-dim2">{r.out ? "→" : "←"} {r.e.t.replace(/_/g, " ")}</span>
                            <span className="truncate text-kosmo-text">{r.other!.n}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
        {isTimeline && meta && <Minimap items={filtered} view={win} plotW={plot.w} onView={(x0) => setWin(clampView({ k: win.k, x0 }, plot.w))} />}
      </div>
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return <span className="rounded-full border border-kosmo-line2 px-2 py-0.5 text-[11px] text-kosmo-dim" style={color ? { borderColor: color } : undefined}>{children}</span>;
}

function DatasetChip({ g, n, on, toggle }: { g: string; n: number; on: boolean; toggle: (g: string) => void }) {
  return (
    <button onClick={() => toggle(g)} aria-pressed={on} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] transition-opacity ${on ? "text-kosmo-text" : "text-kosmo-dim opacity-45"}`} style={{ borderColor: groupColor(g, on ? 0.7 : 0.3) }}>
      <span className="h-2 w-2 rounded-full" style={{ background: groupColor(g) }} />{g}<span className="text-kosmo-dim2">{n.toLocaleString()}</span>
    </button>
  );
}
