"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useTRPC } from "~/server/client";
import { useQuery } from "@tanstack/react-query";
import { SkeletonText } from "@repo/ui";
import { formatDistanceToNow } from "date-fns";

const RESULTS_PER_PAGE = 20;

export function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search") || "";
  const pageParam = searchParams.get("page");
  const currentPage = pageParam ? parseInt(pageParam, 10) : 1;
  
  const trpc = useTRPC();

  // Fetch search results with pagination
  const { data: searchResults, isLoading } = useQuery(
    trpc.wiki.list.queryOptions({
      limit: RESULTS_PER_PAGE,
      search: searchQuery,
      sortBy: "updatedAt",
      sortOrder: "desc",
      cursor: currentPage > 1 ? (currentPage - 1) * RESULTS_PER_PAGE : undefined,
    })
  );

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("search", searchQuery);
    params.set("page", newPage.toString());
    router.push(`/wiki?${params.toString()}`);
  };

  const totalResults = searchResults?.pages.length || 0;
  const hasMoreResults = totalResults === RESULTS_PER_PAGE;

  return (
    <div className="space-y-6">
      {/* Results count and info */}
      {searchQuery && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              Search Results for &quot;{searchQuery}&quot;
            </h2>
            {!isLoading && (
              <p className="text-text-secondary mt-1 text-sm">
                {totalResults === 0
                  ? "No results found"
                  : `Showing ${(currentPage - 1) * RESULTS_PER_PAGE + 1}-${
                      (currentPage - 1) * RESULTS_PER_PAGE + totalResults
                    } results`}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Search results */}
      {isLoading ? (
        <div className="space-y-4">
          <SkeletonText lines={3} className="mb-4" />
          <SkeletonText lines={3} className="mb-4" />
          <SkeletonText lines={3} className="mb-4" />
        </div>
      ) : searchResults?.pages && searchResults.pages.length > 0 ? (
        <>
          <div className="space-y-3">
            {searchResults.pages.map((page) => (
              <Link
                key={page.id}
                href={`/${page.path}`}
                className="hover:bg-background-level1 block rounded-lg p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-primary mb-1 text-xl font-semibold hover:underline">
                      {page.title}
                    </h3>
                    <p className="text-text-secondary mb-2 truncate text-sm">
                      /{page.path}
                    </p>
                    <div className="text-text-tertiary flex items-center gap-4 text-xs">
                      {page.updatedAt && (
                        <span>
                          Updated{" "}
                          {formatDistanceToNow(new Date(page.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                      {page.updatedBy && (
                        <span>by {page.updatedBy.name || "Unknown"}</span>
                      )}
                    </div>
                  </div>
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
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {(currentPage > 1 || hasMoreResults) && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="hover:bg-background-level1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 rounded-md border border-border-default px-4 py-2 text-sm font-medium transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-text-secondary px-4 text-sm">
                Page {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMoreResults}
                className="hover:bg-background-level1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 rounded-md border border-border-default px-4 py-2 text-sm font-medium transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : searchQuery ? (
        <div className="text-text-secondary flex flex-col items-center justify-center py-16 text-center">
          <SearchIcon className="mb-4 h-16 w-16 opacity-20" />
          <h3 className="mb-2 text-xl font-semibold">No results found</h3>
          <p>Try different keywords or check your spelling</p>
        </div>
      ) : (
        <div className="text-text-secondary py-16 text-center">
          <p>Enter a search query to find pages</p>
        </div>
      )}
    </div>
  );
}
