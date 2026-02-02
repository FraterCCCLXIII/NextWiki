import Link from "next/link";
import { MainLayout } from "~/components/layout/MainLayout";
import { dbService } from "~/lib/services";
import { formatDistanceToNow } from "date-fns";
import { ClockIcon, UserIcon, FileTextIcon } from "lucide-react";

export const revalidate = 300; // Revalidate every 5 minutes
export const dynamic = "force-static";

export default async function RecentChangesPage() {
  // Get all pages sorted by most recently updated
  const allPages = await dbService.wiki.list({
    limit: 100, // Get up to 100 most recent changes
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Recent Changes</h1>
          <p className="text-text-secondary mt-2 text-sm">
            Chronological list of all wiki page updates
          </p>
        </div>

        {/* Changes List */}
        {allPages.pages.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <FileTextIcon className="text-text-secondary mb-4 h-12 w-12" />
            <h2 className="text-text-primary mb-2 text-xl font-semibold">
              No Pages Yet
            </h2>
            <p className="text-text-secondary mb-6">
              Create your first wiki page to see it listed here.
            </p>
            <Link
              href="/create"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 shadow-sm"
            >
              Create Page
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {allPages.pages.map((page) => (
              <Link
                key={page.id}
                href={`/${page.path}`}
                className="hover:bg-background-level1 block rounded-lg border border-border-light p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-primary mb-1 truncate text-lg font-semibold hover:underline">
                      {page.title}
                    </h3>
                    <p className="text-text-secondary mb-2 truncate text-sm">
                      /{page.path}
                    </p>
                    <div className="text-text-secondary flex flex-wrap items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>
                          Updated{" "}
                          {page.updatedAt
                            ? formatDistanceToNow(new Date(page.updatedAt), {
                                addSuffix: true,
                              })
                            : "unknown"}
                        </span>
                      </div>
                      {page.updatedBy && (
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3.5 w-3.5" />
                          <span>by {page.updatedBy.name || "Unknown"}</span>
                        </div>
                      )}
                      {page.createdAt && page.updatedAt && (
                        <div className="text-text-tertiary">
                          Created{" "}
                          {formatDistanceToNow(new Date(page.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Tags */}
                  {page.tags && page.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {page.tags.slice(0, 3).map((relation) => (
                        <span
                          key={relation.tag.id}
                          className="bg-muted text-text-secondary rounded-full px-2 py-0.5 text-xs"
                        >
                          {relation.tag.name}
                        </span>
                      ))}
                      {page.tags.length > 3 && (
                        <span className="text-text-tertiary text-xs">
                          +{page.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Footer note */}
        {allPages.pages.length > 0 && (
          <div className="text-text-secondary border-t pt-4 text-center text-sm">
            Showing {allPages.pages.length} most recent changes
          </div>
        )}
      </div>
    </MainLayout>
  );
}
