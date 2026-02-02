import { MainLayout } from "~/components/layout/MainLayout";
import { WikiBrowser } from "~/components/wiki/WikiBrowser";
import { SearchResults } from "~/components/wiki/SearchResults";
import { Suspense } from "react";

function WikiPageContent() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 p-4">
          <div className="animate-pulse">
            <div className="h-8 bg-background-level1 rounded w-48 mb-6"></div>
            <div className="h-12 bg-background-level1 rounded w-full max-w-2xl mb-4"></div>
          </div>
        </div>
      }
    >
      <WikiPageContentInner />
    </Suspense>
  );
}

function WikiPageContentInner() {
  // This will be handled on the client side by SearchResults component
  return <SearchResults />;
}

export default function WikiPagesPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const hasSearch = searchParams?.search;

  return (
    <MainLayout>
      <div className="space-y-6 p-4">
        {!hasSearch && (
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Wiki Pages</h1>
          </div>
        )}

        {hasSearch ? <WikiPageContent /> : <WikiBrowser />}
      </div>
    </MainLayout>
  );
}
