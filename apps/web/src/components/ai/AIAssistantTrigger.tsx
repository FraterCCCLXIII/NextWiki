"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui";
import { Sparkles } from "lucide-react";
import { AIAssistantDrawer } from "./AIAssistantDrawer";
import type { PageMetadata } from "~/components/layout/MainLayout";

const AI_DRAWER_OPEN_STORAGE_KEY = "ai:drawer:open";

interface AIAssistantTriggerProps {
  pageMetadata?: PageMetadata;
  mode?: "edit" | "view";
}

export function AIAssistantTrigger({
  pageMetadata,
  mode = "view",
}: AIAssistantTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(AI_DRAWER_OPEN_STORAGE_KEY);
    if (stored === "true") {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_DRAWER_OPEN_STORAGE_KEY, String(isOpen));
  }, [isOpen]);

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
