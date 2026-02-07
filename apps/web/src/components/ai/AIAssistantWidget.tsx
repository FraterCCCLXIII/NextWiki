"use client";

import { AIAssistantPanel, type AIAssistantToolAccess } from "./AIAssistantDrawer";

interface AIAssistantWidgetProps {
  toolAccess: AIAssistantToolAccess;
}

export function AIAssistantWidget({ toolAccess }: AIAssistantWidgetProps) {
  return (
    <div className="bg-background-paper text-text-primary h-screen w-screen">
      <div className="border-border-default h-full w-full border">
        <AIAssistantPanel
          apiVariant="widget"
          enableConversationHistory={false}
          toolAccess={toolAccess}
          mode="view"
        />
      </div>
    </div>
  );
}
