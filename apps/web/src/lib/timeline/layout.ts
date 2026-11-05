import type { TLEdge, TLItem } from "./types";

export const LABEL_W = 168;
export const AXIS_H = 34;
export const ROW_H = 22;
export const LANE_PAD = 8;

export interface Node {
  item: TLItem;
  /** y of the node's row centre inside the content (below the axis) */
  y: number;
}
export interface Band {
  key: string;
  label: string;
  grp: string;
  y: number;
  h: number;
  count: number;
}
export interface Layout {
  nodes: Node[];
  byId: Map<string, Node>;
  bands: Band[];
  height: number;
}

const labelPx = (n: string) => Math.min(n.length, 34) * 6.4 + 14;

/** Lanes grouped by dataset, each lane packed greedily into sub-rows at the current zoom. */
export function layoutLanes(items: TLItem[], k: number, groupOrder: string[]): Layout {
  const lanes = new Map<string, TLItem[]>();
  for (const it of items) {
    const key = `${it.grp}\u0000${it.lane}`;
    const list = lanes.get(key);
    if (list) list.push(it);
    else lanes.set(key, [it]);
  }
  const ordered = [...lanes.entries()].sort((a, b) => {
    const ga = groupOrder.indexOf(a[1][0]!.grp), gb = groupOrder.indexOf(b[1][0]!.grp);
    if (ga !== gb) return ga - gb;
    return Math.min(...a[1].map((i) => i.s)) - Math.min(...b[1].map((i) => i.s));
  });
  const nodes: Node[] = [];
  const bands: Band[] = [];
  let y = 0;
  for (const [key, list] of ordered) {
    list.sort((a, b) => a.s - b.s);
    const rowEnds: number[] = [];
    const place: { it: TLItem; row: number }[] = [];
    for (const it of list) {
      const x = it.s * k;
      const span = it.e != null ? (it.e - it.s) * k : 0;
      const w = Math.max(span, it.e != null ? 6 : 10);
      const right = x + Math.max(w, it.e != null && span > labelPx(it.n) ? w : w + labelPx(it.n));
      let row = rowEnds.findIndex((end) => end + 4 <= x);
      if (row < 0) { row = rowEnds.length; rowEnds.push(right); } else rowEnds[row] = right;
      place.push({ it, row });
    }
    const rows = Math.max(1, Math.min(rowEnds.length, 14));
    const h = rows * ROW_H + LANE_PAD * 2;
    for (const p of place) nodes.push({ item: p.it, y: y + LANE_PAD + Math.min(p.row, rows - 1) * ROW_H + ROW_H / 2 });
    bands.push({ key, label: list[0]!.lane, grp: list[0]!.grp, y, h, count: list.length });
    y += h;
  }
  return { nodes, byId: new Map(nodes.map((n) => [n.item.id, n])), bands, height: y };
}

export interface Component {
  id: number;
  size: number;
  label: string;
  rootIds: string[];
  ids: string[];
}

const TREE_CATS = new Set(["transmission", "genealogical", "theological", "linguistic", "influence"]);

/** Connected components of the relation graph, largest first. */
export function graphComponents(items: TLItem[], edges: TLEdge[]): Component[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) { const n = parent.get(x)!; parent.set(x, r); x = n; }
    return r;
  };
  const inDeg = new Map<string, number>();
  for (const e of edges) {
    if (!byId.has(e.a) || !byId.has(e.b) || !TREE_CATS.has(e.cat)) continue;
    for (const id of [e.a, e.b]) if (!parent.has(id)) parent.set(id, id);
    parent.set(find(e.a), find(e.b));
    inDeg.set(e.b, (inDeg.get(e.b) ?? 0) + 1);
  }
  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const r = find(id);
    const g = groups.get(r);
    if (g) g.push(id);
    else groups.set(r, [id]);
  }
  return [...groups.values()]
    .map((ids) => {
      ids.sort((a, b) => byId.get(a)!.s - byId.get(b)!.s);
      const rootIds = ids.filter((id) => !inDeg.get(id));
      const first = byId.get(rootIds[0] ?? ids[0]!)!;
      return { id: 0, size: ids.length, label: `${first.n} — ${ids.length}`, rootIds: rootIds.length ? rootIds : [ids[0]!], ids };
    })
    .filter((c) => c.size >= 3)
    .sort((a, b) => b.size - a.size)
    .map((c, i) => ({ ...c, id: i }));
}

/** Time-aligned tree: x = time, y from a tidy leaf-cursor layout over the first parent of each node. */
export function layoutBranches(items: TLItem[], edges: TLEdge[], comp: Component): Layout {
  const byId = new Map(items.map((i) => [i.id, i]));
  const inComp = new Set(comp.ids);
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const parentOf = new Map<string, string>();
  const sorted = edges.filter((e) => inComp.has(e.a) && inComp.has(e.b) && TREE_CATS.has(e.cat) && e.a !== e.b).sort((p, q) => byId.get(p.b)!.s - byId.get(q.b)!.s);
  for (const e of sorted) {
    if (hasParent.has(e.b)) continue; // first parent only; later parents are drawn as cross links
    // refuse cycles
    let cur: string | undefined = e.a, cyc = false;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) { if (cur === e.b) { cyc = true; break; } guard.add(cur); cur = parentOf.get(cur); }
    if (cyc) continue;
    hasParent.add(e.b);
    parentOf.set(e.b, e.a);
    const list = children.get(e.a);
    if (list) list.push(e.b);
    else children.set(e.a, [e.b]);
  }
  const roots = comp.ids.filter((id) => !hasParent.has(id)).sort((a, b) => byId.get(a)!.s - byId.get(b)!.s);
  const y = new Map<string, number>();
  let leaf = 0;
  const visit = (id: string): number => {
    const cs = children.get(id) ?? [];
    if (!cs.length) { const v = leaf++; y.set(id, v); return v; }
    const ys = cs.map(visit);
    const v = (Math.min(...ys) + Math.max(...ys)) / 2;
    y.set(id, v);
    return v;
  };
  for (const r of roots) visit(r);
  const nodes: Node[] = comp.ids.filter((id) => y.has(id)).map((id) => ({ item: byId.get(id)!, y: y.get(id)! * ROW_H + ROW_H }));
  return { nodes, byId: new Map(nodes.map((n) => [n.item.id, n])), bands: [], height: (leaf + 1) * ROW_H + ROW_H };
}
