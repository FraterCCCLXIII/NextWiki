"use client";

import { AIAssistantPanel, type AIAssistantToolAccess } from "./AIAssistantDrawer";

interface AIAssistantWidgetMessengerProps {
  toolAccess: AIAssistantToolAccess;
}

export function AIAssistantWidgetMessenger({
  toolAccess,
}: AIAssistantWidgetMessengerProps) {
  return (
    <div className="bg-background-paper text-text-primary h-screen w-screen">
      <AIAssistantPanel
        apiVariant="widget"
        enableConversationHistory={false}
        toolAccess={toolAccess}
        mode="view"
      />
    </div>
  );
}
