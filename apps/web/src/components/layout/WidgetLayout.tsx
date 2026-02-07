"use client";

import { WidgetHeader } from "./WidgetHeader";

interface WidgetLayoutProps {
  children: React.ReactNode;
}

export function WidgetLayout({ children }: WidgetLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      <WidgetHeader />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
