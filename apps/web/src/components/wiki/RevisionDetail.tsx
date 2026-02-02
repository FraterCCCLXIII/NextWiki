"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/server/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Avatar,
  Badge,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
} from "@repo/ui";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { UnifiedDiff } from "./UnifiedDiff";
import { RevertDialog } from "./RevertDialog";
import { ClientRequirePermission } from "~/components/auth/permission/client";

interface RevisionDetailProps {
  revisionId: number;
  pagePath: string;
}

export function RevisionDetail({ revisionId, pagePath }: RevisionDetailProps) {
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery(
    trpc.wiki.compareRevisions.queryOptions({
      revisionId,
      compareWithCurrent: true,
    })
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card variant="outlined">
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card variant="outlined">
        <CardContent className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load revision details</p>
        </CardContent>
      </Card>
    );
  }

  const { revision, comparison } = data;
  const changeSummary = "changeSummary" in data ? data.changeSummary : undefined;

  const revisionTypeColors: Record<string, "primary" | "secondary" | "accent" | "success" | "info" | "error" | "neutral" | "warning" | "tertiary" | "quaternary"> = {
    created: "success",
    updated: "neutral",
    restored: "warning",
    moved: "primary",
  };

  return (
    <div className="space-y-6">
      {/* Revision Header */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Avatar
                src={revision.createdBy?.image || undefined}
                fallback={revision.createdBy?.name?.[0]?.toUpperCase() || "U"}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-xl">
                    Revision #{revision.id}
                  </CardTitle>
                  {revision.revisionType && (
                    <Badge
                      variant="default"
                      color={revisionTypeColors[revision.revisionType]}
                    >
                      {revision.revisionType}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-text-secondary mb-1">
                  {revision.changeSummary || "No description provided"}
                </p>
                <div className="flex items-center gap-4 text-xs text-text-tertiary">
                  <span>
                    By <strong>{revision.createdBy?.name || "Unknown"}</strong>
                  </span>
                  <span
                    title={format(new Date(revision.createdAt!), "PPpp")}
                  >
                    {formatDistanceToNow(new Date(revision.createdAt!), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/${pagePath}/history`}>
                <Button variant="outlined" size="sm">
                  Back to History
                </Button>
              </Link>
              <ClientRequirePermission permission="wiki:page:update">
                <Button
                  size="sm"
                  onClick={() => setRevertDialogOpen(true)}
                  className="bg-primary-main hover:bg-primary-dark"
                >
                  Revert to This Version
                </Button>
              </ClientRequirePermission>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Changes Summary */}
      {comparison && (
        <Card variant="outlined">
          <CardHeader>
            <CardTitle>Changes Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-text-secondary">{changeSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Detailed Comparison */}
      {comparison && (
        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content Changes</TabsTrigger>
            <TabsTrigger value="metadata">Metadata Changes</TabsTrigger>
            <TabsTrigger value="preview">Preview at This Time</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="mt-4">
            <UnifiedDiff
              diff={comparison.contentDiff}
              title="Content Differences"
            />
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="mt-4">
            <Card variant="outlined">
              <CardContent className="p-6">
                {/* Show message if no metadata changed */}
                {!comparison.titleChanged && 
                 !comparison.pathChanged && 
                 !comparison.publishStatusChanged && 
                 !comparison.editorTypeChanged && 
                 !comparison.tagsChanged && (
                  <p className="text-text-secondary text-center py-4">
                    No metadata changes in this revision
                  </p>
                )}
                
                <div className="space-y-4">
                  {/* Title Changes */}
                  {comparison.titleChanged && (
                    <div>
                      <h4 className="font-semibold text-text-primary mb-2">
                        Title
                      </h4>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 px-3 py-1 rounded">
                          - {comparison.oldTitle}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 px-3 py-1 rounded">
                          + {comparison.newTitle}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Path Changes */}
                  {comparison.pathChanged && (
                    <div>
                      <h4 className="font-semibold text-text-primary mb-2">
                        Path
                      </h4>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 px-3 py-1 rounded">
                          - /{comparison.oldPath}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 px-3 py-1 rounded">
                          + /{comparison.newPath}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Publish Status Changes */}
                  {comparison.publishStatusChanged && (
                    <div>
                      <h4 className="font-semibold text-text-primary mb-2">
                        Publish Status
                      </h4>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 px-3 py-1 rounded">
                          - {comparison.oldPublishStatus ? "Published" : "Draft"}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 px-3 py-1 rounded">
                          + {comparison.newPublishStatus ? "Published" : "Draft"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Editor Type Changes */}
                  {comparison.editorTypeChanged && (
                    <div>
                      <h4 className="font-semibold text-text-primary mb-2">
                        Editor Type
                      </h4>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 px-3 py-1 rounded">
                          - {comparison.oldEditorType || "none"}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 px-3 py-1 rounded">
                          + {comparison.newEditorType || "none"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags Changes */}
                  {comparison.tagsChanged && (
                    <div>
                      <h4 className="font-semibold text-text-primary mb-2">
                        Tags
                      </h4>
                      <div className="space-y-1 font-mono text-sm">
                        <div className="bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100 px-3 py-1 rounded">
                          - {comparison.oldTags?.join(", ") || "none"}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 px-3 py-1 rounded">
                          + {comparison.newTags?.join(", ") || "none"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No Changes */}
                  {!comparison.titleChanged &&
                    !comparison.pathChanged &&
                    !comparison.publishStatusChanged &&
                    !comparison.editorTypeChanged &&
                    !comparison.tagsChanged && (
                      <p className="text-text-secondary">
                        No metadata changes detected
                      </p>
                    )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="mt-4">
            <Card variant="outlined">
              <CardHeader>
                <CardTitle>{revision.title || "Untitled"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap bg-background-level1 p-4 rounded">
                    {revision.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Revert Dialog */}
      {revision.page && (
        <RevertDialog
          open={revertDialogOpen}
          onOpenChange={setRevertDialogOpen}
          pageId={revision.page.id}
          revisionId={revision.id}
          pagePath={pagePath}
        />
      )}
    </div>
  );
}
