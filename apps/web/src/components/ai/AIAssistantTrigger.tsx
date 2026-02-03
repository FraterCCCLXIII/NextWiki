"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { Sparkles } from "lucide-react";
import { AIAssistantDrawer } from "./AIAssistantDrawer";
import type { PageMetadata } from "~/components/layout/MainLayout";

interface AIAssistantTriggerProps {
  pageMetadata?: PageMetadata;
}

export function AIAssistantTrigger({ pageMetadata }: AIAssistantTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open AI assistant"
        onClick={() => setIsOpen(true)}
      >
        <Sparkles className="h-4 w-4" />
      </Button>
      <AIAssistantDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        pageMetadata={pageMetadata}
      />
    </>
  );
}
