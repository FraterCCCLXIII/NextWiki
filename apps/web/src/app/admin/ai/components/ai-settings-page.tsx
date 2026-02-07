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
  Checkbox,
  CodeBlock,
} from "@repo/ui";
import { Loader2 } from "lucide-react";
import { PageHeader } from "~/components/layout/page-header";
import { CategorySettings } from "~/app/admin/settings/components/category-settings";
import { useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "@repo/types";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}

function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-background-level1 border border-border-default"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background-paper shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function AISettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [hasCopied, setHasCopied] = useState(false);

  const { data: allSettings, isLoading: isLoadingAll } = useQuery(
    trpc.admin.settings.getAll.queryOptions()
  );
  const updateSetting = useMutation(
    trpc.admin.settings.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAllQueryKey });
      },
    })
  );
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
  const widgetSettings = useMemo(() => {
    if (!allSettings) return null;
    const getDefault = <T,>(key: keyof typeof DEFAULT_SETTINGS, fallback: T) =>
      (DEFAULT_SETTINGS[key]?.value as T | undefined) ?? fallback;

    return {
      "site.url": allSettings["site.url"] ?? getDefault("site.url", ""),
      "ai.widget.enabled":
        allSettings["ai.widget.enabled"] ??
        getDefault("ai.widget.enabled", false),
      "ai.widget.tools.create":
        allSettings["ai.widget.tools.create"] ??
        getDefault("ai.widget.tools.create", false),
      "ai.widget.tools.edit":
        allSettings["ai.widget.tools.edit"] ??
        getDefault("ai.widget.tools.edit", false),
      "ai.widget.tools.summarize":
        allSettings["ai.widget.tools.summarize"] ??
        getDefault("ai.widget.tools.summarize", false),
      "ai.widget.tools.search":
        allSettings["ai.widget.tools.search"] ??
        getDefault("ai.widget.tools.search", true),
    };
  }, [allSettings]);
  const widgetBaseUrl = useMemo(() => {
    const baseUrl = widgetSettings?.["site.url"] ?? "";
    if (baseUrl) {
      return baseUrl.replace(/\/+$/, "");
    }
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  }, [widgetSettings]);
  const embedScriptSrc = `${widgetBaseUrl}/ai-widget.js`;
  const embedCode = `<script async src="${embedScriptSrc}" data-nextwiki-widget data-base-url="${widgetBaseUrl}"></script>`;
  const isUpdatingWidgetSettings = updateSetting.isPending;
  const isUpdatingWidgetEnabled =
    updateSetting.isPending &&
    updateSetting.variables?.key === "ai.widget.enabled";

  const updateWidgetSetting = (
    key: keyof NonNullable<typeof widgetSettings>
  ) => {
    if (!widgetSettings) return;
    const nextValue = !widgetSettings[key];
    queryClient.setQueryData(getAllQueryKey, (prev) => ({
      ...(prev ?? {}),
      [key]: nextValue,
    }));
    updateSetting.mutate({
      key,
      value: nextValue,
      reason: "Updated from AI widget settings",
    });
  };

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
          {isLoadingAll ? (
            <div className="text-text-secondary text-sm">Loading widget settings...</div>
          ) : widgetSettings ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <ToggleSwitch
                    checked={widgetSettings["ai.widget.enabled"]}
                    onChange={() => updateWidgetSetting("ai.widget.enabled")}
                    disabled={isUpdatingWidgetEnabled}
                    label="Enable embeddable widget"
                  />
                  <span>Enable embeddable widget</span>
                </div>
                <div className="text-text-secondary text-xs">
                  Tools available in the widget:
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={widgetSettings["ai.widget.tools.search"]}
                      onChange={() => updateWidgetSetting("ai.widget.tools.search")}
                      disabled={isUpdatingWidgetSettings}
                    />
                    Search/query
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={widgetSettings["ai.widget.tools.summarize"]}
                      onChange={() =>
                        updateWidgetSetting("ai.widget.tools.summarize")
                      }
                      disabled={isUpdatingWidgetSettings}
                    />
                    Summarize
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={widgetSettings["ai.widget.tools.create"]}
                      onChange={() => updateWidgetSetting("ai.widget.tools.create")}
                      disabled={isUpdatingWidgetSettings}
                    />
                    Create pages
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={widgetSettings["ai.widget.tools.edit"]}
                      onChange={() => updateWidgetSetting("ai.widget.tools.edit")}
                      disabled={isUpdatingWidgetSettings}
                    />
                    Edit pages
                  </label>
                </div>
              </div>
              {!widgetSettings["ai.widget.enabled"] ? (
                <div className="text-text-secondary text-sm">
                  The widget is currently disabled. Enable it above to get the
                  embed code.
                </div>
              ) : (
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
              )}
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
