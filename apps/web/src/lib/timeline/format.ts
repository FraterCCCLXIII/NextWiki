import type { TLItem } from "./types";

/** Astronomical year -> human label. 0 = 1 BCE. */
export function formatYear(y: number, precise = false): string {
  const r = Math.round(y);
  if (r <= 0) {
    const n = 1 - r;
    if (n >= 1_000_000) return `${trim(n / 1e6)} Ma`;
    if (n >= 10_000) return `${trim(n / 1000)} ka`;
    return `${n.toLocaleString("en-US")} BCE`;
  }
  return precise || r < 1000 ? `${r} CE` : String(r);
}
const trim = (v: number) => String(Math.round(v * 10) / 10);

export function formatSpan(it: Pick<TLItem, "s" | "e" | "approx">): string {
  const c = it.approx ? "c. " : "";
  if (it.e == null) return `${c}${formatYear(it.s, true)}`;
  const a = formatYear(it.s, true);
  const b = formatYear(it.e, true);
  return `${c}${a} – ${b}`;
}

/** Nice tick step (in years) for a target pixel spacing. */
export function tickStep(k: number, targetPx = 96): number {
  const raw = targetPx / k;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (p * m >= raw) return p * m;
  return p * 10;
}

const PALETTE = [155, 205, 38, 275, 345, 175, 60, 235, 15, 125, 305, 85];
export function hashHue(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return PALETTE[(h >>> 0) % PALETTE.length]!;
}
export const laneColor = (lane: string, a = 1) => `hsla(${hashHue(lane)}, 42%, 68%, ${a})`;

export const KIND_LABEL: Record<string, string> = { period: "Period", event: "Event", figure: "Figure", tradition: "Tradition", deity: "Deity" };

export const GROUP_ORDER = ["Civilisations", "Evolution of God", "Bardiya & Achaemenid", "Pantheons", "Lineages"];
export const GROUP_HUE: Record<string, number> = { Civilisations: 38, "Evolution of God": 155, "Bardiya & Achaemenid": 15, Pantheons: 275, Lineages: 205 };
export const groupColor = (g: string, a = 1) => `hsla(${GROUP_HUE[g] ?? hashHue(g)}, 42%, 68%, ${a})`;

export const EDGE_COLOR: Record<string, string> = {
  transmission: "#a9c0b4",
  genealogical: "#c4a373",
  linguistic: "#8aa4be",
  parallel: "#a396b3",
  influence: "#c28181",
  theological: "#d9c27a",
  other: "#8d8e91",
};
