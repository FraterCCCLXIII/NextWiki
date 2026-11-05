"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Pill } from "@repo/ui";

export type TreeNode = {
  id: number;
  slug: string;
  name: string;
  commonName: string | null;
  rank: string;
  childCount: number;
  speciesCount: number;
  href: string;
};

type Loaded = { status: "loading" } | { status: "error" } | { status: "ok"; children: TreeNode[] };

const ZOOMS = [0.85, 1, 1.2, 1.5];

/** Expand/collapse tree that loads each node's children on demand. */
export function TreeExplorer({ roots }: { roots: TreeNode[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<Record<number, Loaded>>({});
  const [zoom, setZoom] = useState(1);

  const toggle = useCallback(
    async (node: TreeNode) => {
      const isOpen = open.has(node.id);
      setOpen((prev) => {
        const next = new Set(prev);
        if (isOpen) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      if (isOpen || loaded[node.id]?.status === "ok") return;
      setLoaded((p) => ({ ...p, [node.id]: { status: "loading" } }));
      try {
        const res = await fetch(`/api/life/children?parentId=${node.id}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { children: TreeNode[] };
        setLoaded((p) => ({ ...p, [node.id]: { status: "ok", children: json.children } }));
      } catch {
        setLoaded((p) => ({ ...p, [node.id]: { status: "error" } }));
      }
    },
    [open, loaded],
  );

  const renderNodes = (nodes: TreeNode[], level: number) => (
    <ul role={level === 1 ? "tree" : "group"} aria-label={level === 1 ? "Tree of life" : undefined} className={level === 1 ? "" : "ml-5 border-l border-kosmo-line pl-3"}>
      {nodes.map((n) => {
        const expandable = n.childCount > 0;
        const isOpen = open.has(n.id);
        const state = loaded[n.id];
        return (
          <li key={n.id} role="treeitem" aria-expanded={expandable ? isOpen : undefined} aria-level={level}>
            <div className="flex items-baseline gap-2 py-1">
              {expandable ? (
                <button
                  type="button"
                  onClick={() => void toggle(n)}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${n.name}`}
                  className="w-5 shrink-0 text-kosmo-mint hover:text-kosmo-text"
                >
                  {isOpen ? "−" : "+"}
                </button>
              ) : (
                <span className="w-5 shrink-0" aria-hidden />
              )}
              <Link href={n.href} className="text-kosmo-text hover:text-kosmo-mint">
                <span className="italic">{n.name}</span>
                {n.commonName ? <span className="text-kosmo-dim"> · {n.commonName}</span> : null}
              </Link>
              <Pill>{n.rank}</Pill>
              {n.speciesCount ? <span className="text-sm text-kosmo-dim">{n.speciesCount.toLocaleString()} species</span> : null}
            </div>
            {isOpen && state?.status === "loading" ? <p className="ml-5 py-1 text-sm text-kosmo-dim">loading…</p> : null}
            {isOpen && state?.status === "error" ? <p className="ml-5 py-1 text-sm text-kosmo-red">could not load children</p> : null}
            {isOpen && state?.status === "ok" ? renderNodes(state.children, level + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-base text-kosmo-dim" role="group" aria-label="Zoom">
        <span>zoom</span>
        {ZOOMS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            aria-pressed={zoom === z}
            className={zoom === z ? "text-kosmo-mint" : "hover:text-kosmo-text"}
          >
            {Math.round(z * 100)}%
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-kosmo-line bg-kosmo-panel p-4" style={{ fontSize: `${zoom}rem` }}>
        {roots.length ? renderNodes(roots, 1) : <p className="text-kosmo-dim">No taxa have been imported yet.</p>}
      </div>
    </div>
  );
}
