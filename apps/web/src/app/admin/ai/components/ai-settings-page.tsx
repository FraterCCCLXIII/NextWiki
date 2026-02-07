"use client";

import { useTRPC } from "~/server/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
} from "@repo/ui";
import { Loader2 } from "lucide-react";
import { PageHeader } from "~/components/layout/page-header";
import { CategorySettings } from "~/app/admin/settings/components/category-settings";
import { useSettings } from "~/lib/hooks/use-settings";
import { useMemo, useState } from "react";

export function AISettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [hasCopied, setHasCopied] = useState(false);

  const { data: allSettings, isLoading: isLoadingAll } = useQuery(
    trpc.admin.settings.getAll.queryOptions()
  );
  const { settings: widgetSettings, isLoading: isLoadingWidgetSettings } =
    useSettings([
      "site.url",
      "ai.widget.enabled",
      "ai.widget.tools.create",
      "ai.widget.tools.edit",
      "ai.widget.tools.summarize",
      "ai.widget.tools.search",
    ]);

  const getAllQueryKey = trpc.admin.settings.getAll.queryKey();

  const initializeSettings = useMutation(
    trpc.admin.settings.initialize.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAllQueryKey });
      },
    })
  );

  const noSettings =
    !isLoadingAll && (!allSettings || Object.keys(allSettings).length === 0);
  const embedUrl = useMemo(() => {
    const baseUrl = widgetSettings?.["site.url"] ?? "";
    if (baseUrl) {
      return `${baseUrl.replace(/\/+$/, "")}/widget/ai`;
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}/widget/ai`;
    }
    return "/widget/ai";
  }, [widgetSettings]);
  const embedCode = `<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0;" title="NextWiki AI Widget"></iframe>`;

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title="AI Settings"
        description="AI provider configuration and assistant behavior"
        action={
          <Button
            variant="outlined"
            onClick={() => initializeSettings.mutate()}
            disabled={initializeSettings.isPending || !noSettings}
          >
            {initializeSettings.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Initializing...
              </>
            ) : (
              "Initialize Default Settings"
            )}
          </Button>
        }
      />

      {noSettings && (
        <Alert variant="warning">
          <AlertTitle>No settings found</AlertTitle>
          <AlertDescription>
            No settings have been initialized yet. Click the button above to
            create the default settings.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>
            Configure AI provider credentials, models, and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <CategorySettings category="ai" isLoading={isLoadingAll || noSettings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle>Embeddable AI Widget</CardTitle>
          <CardDescription>
            Enable the widget, configure tools, and copy the embed code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {isLoadingWidgetSettings ? (
            <div className="text-text-secondary text-sm">Loading widget settings...</div>
          ) : widgetSettings?.["ai.widget.enabled"] ? (
            <>
              <div className="text-text-secondary text-sm">
                Paste this iframe snippet into your site:
              </div>
              <CodeBlock language="html" className="bg-background-paper">
                {embedCode}
              </CodeBlock>
              <div className="flex items-center gap-2">
                <Button
                  variant="outlined"
                  onClick={async () => {
                    if (typeof navigator === "undefined") return;
                    await navigator.clipboard.writeText(embedCode);
                    setHasCopied(true);
                    setTimeout(() => setHasCopied(false), 2000);
                  }}
                >
                  {hasCopied ? "Copied" : "Copy embed code"}
                </Button>
                <span className="text-text-secondary text-xs">
                  You can change size via iframe styles.
                </span>
              </div>
            </>
          ) : (
            <div className="text-text-secondary text-sm">
              The widget is currently disabled. Enable it above to get the embed
              code.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
