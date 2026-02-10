"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui";
import { ArrowUp, Sparkles } from "lucide-react";
import { AIAssistantDrawer } from "./AIAssistantDrawer";
import type { PageMetadata } from "~/components/layout/MainLayout";
import { AI_DRAWER_OPEN_STORAGE_KEY, AI_EXTERNAL_PROMPT_EVENT } from "./constants";

interface AIAssistantTriggerProps {
  pageMetadata?: PageMetadata;
  mode?: "edit" | "view";
}

interface FloatingAssistantInputProps {
  isActive: boolean;
}

function FloatingAssistantInput({ isActive }: FloatingAssistantInputProps) {
  const [value, setValue] = useState("");

  const submitPrompt = () => {
    const trimmed = value.trim();
    if (!trimmed || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(AI_EXTERNAL_PROMPT_EVENT, {
        detail: { prompt: trimmed },
      })
    );
    setValue("");
  };

  if (!isActive) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto border-border-default bg-background-paper w-full max-w-3xl rounded-xl border shadow-lg">
        <div className="relative">
          <textarea
            id="chat-assistant-textarea"
            aria-label="Ask a question..."
            autoComplete="off"
            placeholder="Ask a question..."
            className="chat-assistant-input w-full bg-transparent border-0 peer/input text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 !outline-none focus:!outline-none focus:ring-0 py-2.5 pl-3.5 pr-10 font-bodyWeight text-sm"
            style={{ resize: "none", height: "60px" }}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitPrompt();
              }
            }}
          />
          <Button
            type="button"
            variant="soft"
            size="icon"
            aria-label="Send message"
            className="absolute bottom-2 right-2 h-7 w-7 rounded-full"
            disabled={!value.trim()}
            onClick={submitPrompt}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
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
      <FloatingAssistantInput isActive={isOpen} />
    </>
  );
}
