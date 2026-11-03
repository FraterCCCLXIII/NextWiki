import * as React from "react";
import { cn } from "../../utils";

export type DataRowProps = {
  label: React.ReactNode;
  children: React.ReactNode;
  mono?: boolean;
};

export function DataRow({ label, children, mono = false }: DataRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-kosmo-line py-2 text-base last:border-b-0">
      <span className="shrink-0 text-kosmo-dim">{label}</span>
      <span
        className={cn("min-w-0 text-right text-kosmo-text break-words", mono && "font-mono text-sm")}
      >
        {children}
      </span>
    </div>
  );
}

export type DataListProps = {
  children: React.ReactNode;
};

export function DataList({ children }: DataListProps) {
  return <div className="flex flex-col">{children}</div>;
}
