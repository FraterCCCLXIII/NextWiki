import { cn } from "../../utils";

export type StatTotalsProps = {
  items: { label: string; value: string | number }[];
  className?: string;
};

export function StatTotals({ items, className }: StatTotalsProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-8 gap-y-4", className)}>
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex flex-col gap-1">
          <span className="text-2xl font-semibold leading-none text-kosmo-mint tabular-nums">
            {item.value}
          </span>
          <span className="text-sm uppercase tracking-wide text-kosmo-dim">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
