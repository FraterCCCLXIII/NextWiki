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
} from "@repo/ui";
import { Loader2 } from "lucide-react";
import { PageHeader } from "~/components/layout/page-header";
import { CategorySettings } from "~/app/admin/settings/components/category-settings";

export function AISettingsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: allSettings, isLoading: isLoadingAll } = useQuery(
    trpc.admin.settings.getAll.queryOptions()
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
    </div>
  );
}
