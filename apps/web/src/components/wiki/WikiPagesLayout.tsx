"use client";

import { ReactNode, useEffect } from "react";

interface WikiPagesLayoutProps {
  children: ReactNode;
  title?: string;
  showTitle?: boolean;
}

export function WikiPagesLayout({
  children,
  title = "All Pages",
  showTitle = true,
}: WikiPagesLayoutProps) {

  useEffect(() => {
    const handler = () => {
      // Kept for future compatibility; drawer now self-managed.
    };
    window.addEventListener("ai:view-panel:toggle", handler);
    return () => {
      window.removeEventListener("ai:view-panel:toggle", handler);
    };
  }, []);

  return (
    <div className="relative w-full">
      <div className="mx-auto w-full max-w-4xl px-8 py-6">
        {showTitle && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
        )}
        {children}
      </div>

      <aside className="hidden xl:block absolute right-0 top-0 h-full w-[320px]"></aside>
    </div>
  );
}
