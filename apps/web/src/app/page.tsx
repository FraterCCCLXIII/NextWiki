import Link from "next/link";
import { MainLayout } from "~/components/layout/MainLayout";
import { HighlightedContent } from "~/lib/markdown/client";
import { Suspense } from "react";
import { getWikiPageByPath } from "./[...path]/page";
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth";
import { getSettingValue } from "~/lib/utils/settings";
import { SearchHomepage } from "~/components/homepage/SearchHomepage";

export const revalidate = 900; // Revalidate every 15 minutes
export const dynamic = "force-static";

export default async function Home() {
  // Get homepage style setting
  const homepageStyle = await getSettingValue("appearance.homepageStyle");
  
  // Get site info for search homepage
  const siteTitle = await getSettingValue("site.title");
  const siteLogo = await getSettingValue("site.logo");

  // If search homepage is enabled, render that instead
  if (homepageStyle === "search") {
    return <SearchHomepage siteTitle={siteTitle} siteLogo={siteLogo} />;
  }

  // Otherwise, show wiki content homepage
  // Fetch the root page ("index")
  const rootPage = await getWikiPageByPath(["index"]);

  const renderedHtml = rootPage?.renderedHtml;

  // Calculate lock status for the home page (if it exists)
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id
    ? parseInt(session.user.id)
    : undefined;
  const isLocked = rootPage
    ? Boolean(
        rootPage.lockedBy &&
          rootPage.lockExpiresAt &&
          new Date(rootPage.lockExpiresAt) > new Date()
      )
    : false;
  const isCurrentUserLockOwner = rootPage
    ? Boolean(
        currentUserId &&
          rootPage.lockedBy &&
          rootPage.lockedBy.id === currentUserId
      )
    : false;
  const formattedLockedBy = rootPage?.lockedBy
    ? { id: rootPage.lockedBy.id, name: rootPage.lockedBy.name || "Unknown" }
    : null;

  return (
    <MainLayout
      pageMetadata={
        rootPage
          ? {
              title: rootPage.title || "NextWiki Home",
              path: "index",
              id: rootPage.id,
              isLocked: isLocked,
              lockedBy: formattedLockedBy,
              lockExpiresAt: rootPage.lockExpiresAt?.toISOString() || null,
              isCurrentUserLockOwner: isCurrentUserLockOwner,
            }
          : undefined
      }
    >
      <div className="relative flex flex-col gap-3 p-3">
        {/* Main Content Area */}
        <div className="mx-auto w-full max-w-4xl">
          {rootPage ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Suspense fallback={<div>Loading content...</div>}>
                <HighlightedContent
                  content={rootPage.content || ""}
                  renderedHtml={renderedHtml}
                />
              </Suspense>
            </div>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <h2 className="text-text-primary mb-4 text-xl font-semibold">
                No Homepage Content Yet
              </h2>
              <p className="text-text-secondary mb-6">
                Create an index page to display welcome information here.
              </p>
              <Link
                href="/create?path=index"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                Create Homepage
              </Link>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
