"use client";

import { useState } from "react";
import { useTRPC } from "~/server/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, Avatar, Badge, Button, Skeleton } from "@repo/ui";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface HistoryListProps {
  pageId: number;
}

export function HistoryList({ pageId }: HistoryListProps) {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const trpc = useTRPC();
  const pathname = usePathname();

  const { data, isLoading, error } = useQuery({
    ...trpc.wiki.getPageHistory.queryOptions({
      pageId,
      limit,
      offset,
    }),
    refetchOnMount: true,
    staleTime: 0, // Consider data immediately stale to ensure fresh history
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} variant="outlined">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <CardContent className="p-4">
          <p className="text-red-600 dark:text-red-400">Failed to load page history</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.revisions.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent className="p-8 text-center">
          <p className="text-text-secondary">No revision history found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {data.revisions.map((revision, index) => {
          const isLatest = offset === 0 && index === 0;
          const revisionTypeColors: Record<string, "primary" | "secondary" | "accent" | "success" | "info" | "error" | "neutral" | "warning" | "tertiary" | "quaternary"> = {
            created: "success",
            updated: "neutral",
            restored: "warning",
            moved: "primary",
          };

          return (
            <Link
              key={revision.id}
              href={`${pathname}/${revision.id}`}
              className="block"
            >
              <Card
                variant="outlined"
                className="transition-all hover:border-border-hover hover:shadow-md"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Author Avatar */}
                    <Avatar
                      src={revision.createdBy?.image || undefined}
                      fallback={
                        revision.createdBy?.name?.[0]?.toUpperCase() || "U"
                      }
                      size="md"
                    />

                    {/* Revision Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-text-primary">
                          {revision.createdBy?.name || "Unknown User"}
                        </span>
                        {isLatest && (
                          <Badge variant="default" color="primary">
                            Latest
                          </Badge>
                        )}
                        {revision.revisionType && (
                          <Badge
                            variant="default"
                            color={revisionTypeColors[revision.revisionType]}
                          >
                            {revision.revisionType}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-text-primary mb-1">
                        {revision.changeSummary || "No description provided"}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <span title={format(new Date(revision.createdAt!), "PPpp")}>
                          {formatDistanceToNow(new Date(revision.createdAt!), {
                            addSuffix: true,
                          })}
                        </span>
                        {revision.title && (
                          <span className="truncate">
                            Title: {revision.title}
                          </span>
                        )}
                        {revision.path && (
                          <span className="truncate">Path: /{revision.path}</span>
                        )}
                      </div>
                    </div>

                    {/* View Icon */}
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-text-secondary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {(data.hasMore || offset > 0) && (
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outlined"
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
          >
            Previous
          </Button>

          <span className="text-sm text-text-secondary">
            Showing {offset + 1} - {offset + data.revisions.length} of {data.total}
          </span>

          <Button
            variant="outlined"
            onClick={() => setOffset(offset + limit)}
            disabled={!data.hasMore}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
