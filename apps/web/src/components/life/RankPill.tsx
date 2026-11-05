import { Pill } from "@repo/ui";

export function RankPill({ rank }: { rank: string }) {
  return <Pill tone={rank === "species" ? "mint" : "dim"}>{rank}</Pill>;
}
