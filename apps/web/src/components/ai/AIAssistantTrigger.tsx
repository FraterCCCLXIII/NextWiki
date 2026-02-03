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

  return (
    <>
      <Button
        type="button"
        variant={isOpen ? "soft" : "ghost"}
        size="icon"
        className="h-9 w-9 rounded-full hover:bg-background-level1 text-text-primary hover:text-text-primary focus-visible:ring-0 focus-visible:ring-offset-0"
        aria-label="Open AI assistant"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
      <AIAssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        pageMetadata={pageMetadata}
        mode={mode}
      />
    </>
  );
}
