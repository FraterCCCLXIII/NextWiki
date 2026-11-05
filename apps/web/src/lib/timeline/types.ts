/** Timeline data model. Years are astronomical (year 0 = 1 BCE), matching kosmo_entities.time_start. */
export type TLKind = "period" | "event" | "figure" | "tradition" | "deity";

export interface TLItem {
  id: string;
  k: TLKind;
  n: string;
  s: number;
  e?: number;
  lane: string;
  grp: string;
  d?: string;
  /** confidence / evidence grade: high|medium|low|speculative or in source|extension|interpretive */
  g?: string;
  grade?: string;
  approx?: boolean;
  reg?: string;
  type?: string;
  src?: string[];
  lat?: number;
  lon?: number;
  /** direct image URL (Wikimedia Commons) */
  img?: string;
  /** wiki page path (with leading slash) when the entity is tied to an article */
  page?: string;
}

export type EdgeCat = "transmission" | "genealogical" | "linguistic" | "parallel" | "influence" | "theological" | "other";

export interface TLEdge {
  a: string;
  b: string;
  t: string;
  cat: EdgeCat;
  w?: number;
}

export interface TLData {
  version: number;
  built: string;
  items: TLItem[];
  edges: TLEdge[];
}

export type ViewId = "lanes" | "branches" | "vertical" | "cards" | "table" | "eras";

export const VIEWS: { id: ViewId; label: string; hint: string }[] = [
  { id: "lanes", label: "Lanes", hint: "Pan and zoom through every lane" },
  { id: "branches", label: "Branches", hint: "Lineages and relations as a time-aligned tree" },
  { id: "vertical", label: "Vertical", hint: "A scrolling chronicle" },
  { id: "cards", label: "Cards", hint: "Browse as cards" },
  { id: "table", label: "Table", hint: "Sortable table" },
  { id: "eras", label: "Eras", hint: "Centuries at a glance" },
];

export interface ViewWindow {
  /** year at the left edge of the plot */
  x0: number;
  /** pixels per year */
  k: number;
}
