import type { Coverage } from "~/lib/kosmo/university";

type Status = "stub" | "drafted" | "reviewed";

const LABEL: Record<Status, string> = {
  stub: "Outline only",
  drafted: "Draft, not yet reviewed",
  reviewed: "Reviewed",
};
const TONE: Record<Status, string> = {
  stub: "border-kosmo-line2 text-kosmo-dim2",
  drafted: "border-kosmo-amber/60 text-kosmo-amber",
  reviewed: "border-kosmo-mint/60 text-kosmo-mint",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${TONE[status]}`}>
      {LABEL[status]}
    </span>
  );
}

/** Reviewed / drafted / stub as one stacked bar, with the counts spelled out beside it. */
export function CoverageBar({ coverage, compact = false }: { coverage: Coverage; compact?: boolean }) {
  const { total, reviewed, drafted, stub } = coverage;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <div className="min-w-0">
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-kosmo-line"
        role="img"
        aria-label={`${reviewed} reviewed, ${drafted} drafted, ${stub} outline only, of ${total} lessons`}
      >
        <div className="bg-kosmo-mint" style={{ width: `${pct(reviewed)}%` }} />
        <div className="bg-kosmo-amber" style={{ width: `${pct(drafted)}%` }} />
      </div>
      {!compact && (
        <div className="mt-1.5 text-xs text-kosmo-dim">
          <span className="text-kosmo-mint">{reviewed} reviewed</span>
          {" · "}
          <span className="text-kosmo-amber">{drafted} drafted</span>
          {" · "}
          {stub} outline only
          {" · "}
          {total} lessons
        </div>
      )}
    </div>
  );
}
