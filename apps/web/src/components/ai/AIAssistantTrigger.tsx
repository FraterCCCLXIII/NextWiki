"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { Sparkles } from "lucide-react";
import { AIAssistantDrawer } from "./AIAssistantDrawer";
import type { PageMetadata } from "~/components/layout/MainLayout";

interface AIAssistantTriggerProps {
  pageMetadata?: PageMetadata;
  mode?: "edit" | "view";
}

export function AIAssistantTrigger({
  pageMetadata,
  mode = "view",
}: AIAssistantTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isViewMode = mode === "view";

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open AI assistant"
        onClick={() => {
          if (isViewMode) {
            window.dispatchEvent(new CustomEvent("ai:view-panel:toggle"));
            return;
          }
          setIsOpen(true);
        }}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
      {!isViewMode && (
        <AIAssistantDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          pageMetadata={pageMetadata}
          mode={mode}
        />
      )}
    </>
  );
}
