import { MainLayout } from "~/components/layout/MainLayout";
import { WikiBrowser } from "~/components/wiki/WikiBrowser";
import { SearchResults } from "~/components/wiki/SearchResults";
import { Suspense } from "react";
import { WikiPagesLayout } from "~/components/wiki/WikiPagesLayout";

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

export default async function WikiPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const hasSearch = Boolean(resolvedSearchParams?.search);

  return (
    <MainLayout>
      <WikiPagesLayout showTitle={!hasSearch} title="All Pages">
        {hasSearch ? <WikiPageContent /> : <WikiBrowser />}
      </WikiPagesLayout>
    </MainLayout>
  );
}
