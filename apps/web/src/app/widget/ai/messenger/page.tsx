import { getSetting } from "~/lib/services/settings";
import { AIAssistantWidgetMessenger } from "~/components/ai/AIAssistantWidget";

export const dynamic = "force-dynamic";

export default async function AIWidgetMessengerPage() {
  const [
    widgetEnabled,
    canCreate,
    canEdit,
    canSummarize,
    canSearch,
  ] = await Promise.all([
    getSetting("ai.widget.enabled"),
    getSetting("ai.widget.tools.create"),
    getSetting("ai.widget.tools.edit"),
    getSetting("ai.widget.tools.summarize"),
    getSetting("ai.widget.tools.search"),
  ]);

  if (!widgetEnabled) {
    return (
      <div className="bg-background-paper text-text-primary flex h-screen w-screen items-center justify-center p-6 text-sm">
        The AI widget is currently disabled.
      </div>
    );
  }

  return (
    <AIAssistantWidgetMessenger
      toolAccess={{
        canSearch,
        canSummarize,
        canCreate,
        canEdit,
      }}
    />
  );
}
