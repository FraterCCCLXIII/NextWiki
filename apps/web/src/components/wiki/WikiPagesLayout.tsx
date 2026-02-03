"use client";

import { ReactNode, useEffect, useState } from "react";
import { AIAssistantPanel } from "~/components/ai/AIAssistantDrawer";

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
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsAiPanelOpen((prev) => !prev);
    };
    window.addEventListener("ai:view-panel:toggle", handler);
    return () => {
      window.removeEventListener("ai:view-panel:toggle", handler);
    };
  }, []);

  return (
    <div className="flex justify-center w-full">
      <div className="min-w-0 max-w-4xl flex-1 px-8 py-6">
        {showTitle && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
        )}
        {children}
      </div>

      <aside className="hidden xl:block w-[320px] flex-shrink-0">
        {isAiPanelOpen && (
          <div className="sticky top-0 h-[calc(100vh-4rem)] overflow-hidden border-l border-border-default bg-background-paper">
            <div className="h-full overflow-y-auto">
              <AIAssistantPanel mode="view" onClose={() => setIsAiPanelOpen(false)} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
