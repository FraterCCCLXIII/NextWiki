"use client";

import { MessageCircle } from "lucide-react";

export function AIAssistantWidgetLauncher() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <button
        type="button"
        aria-label="Open AI assistant"
        className="flex h-full w-full items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        style={{
          border: "none",
          backgroundColor: "var(--color-primary-500, #3b82f6)",
          color: "var(--color-primary-foreground, #ffffff)",
        }}
        onClick={() => {
          if (typeof window === "undefined") return;
          window.parent?.postMessage({ type: "nextwiki-widget-toggle" }, "*");
        }}
      >
        <MessageCircle className="h-6 w-6" stroke="currentColor" />
      </button>
    </div>
  );
}
