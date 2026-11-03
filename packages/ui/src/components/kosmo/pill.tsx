import * as React from "react";

import { cn } from "../../utils";

export type PillTone = "mint" | "blue" | "amber" | "red" | "violet" | "dim";

const toneClasses: Record<PillTone, string> = {
  mint: "text-kosmo-mint border-kosmo-mint/30",
  blue: "text-kosmo-blue border-kosmo-blue/30",
  amber: "text-kosmo-amber border-kosmo-amber/30",
  red: "text-kosmo-red border-kosmo-red/30",
  violet: "text-kosmo-violet border-kosmo-violet/30",
  dim: "text-kosmo-dim border-kosmo-dim/30",
};

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: PillTone;
  children?: React.ReactNode;
  className?: string;
}

export function Pill({ tone = "dim", children, className, ...props }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-transparent px-2 py-0.5 text-sm leading-4",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
