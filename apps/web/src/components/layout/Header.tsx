import { UserMenu } from "../auth/UserMenu";
import { Suspense } from "react";
import { ThemeToggle } from "~/components/layout/theme-toggle";
import { AdminButton } from "~/components/layout/AdminButton";
import { PageMetadata } from "./MainLayout";
import Link from "next/link";
import { WikiLockInfo } from "~/components/wiki/WikiLockInfo";
import { MoveIcon, PencilIcon, Search } from "lucide-react";
import { ClientRequirePermission } from "~/components/auth/permission/client";
import { getSettingValue } from "~/lib/utils/settings";
import { SearchTrigger } from "./SearchTrigger";
import { NavigationDropdown } from "./NavigationDropdown";

export async function Header({
  pageMetadata,
}: {
  pageMetadata?: PageMetadata;
}) {
  const isHomePage = pageMetadata?.path === "index";

  // Get site title and logo from settings
  const siteTitle = await getSettingValue("site.title");
  const siteLogo = await getSettingValue("site.logo");

  return (
    <header
      className={
        "border-border-default flex h-16 items-center justify-between gap-4 px-4"
      }
    >
      <div className="flex items-center flex-shrink-0 gap-2">
        {/* Navigation Dropdown */}
        <NavigationDropdown siteTitle={siteTitle} siteLogo={siteLogo} />

        {/* Page action buttons - moved closer to title */}
        {pageMetadata?.path && pageMetadata.id && (
          <div className="ml-4 flex items-center space-x-2">
            <ClientRequirePermission permission="wiki:page:update">
              <Link
                href={`/${pageMetadata.path}?edit=true`}
                className="text-text-secondary hover:text-primary hover:border-accent/20 flex items-center rounded border border-transparent px-2 py-1 text-xs"
              >
                <PencilIcon className="mr-1 h-3.5 w-3.5" />
                Edit
              </Link>
              {!isHomePage && (
                <Link
                  href={`/${pageMetadata.path}?move=true`}
                  className="text-text-secondary hover:text-primary hover:border-accent/20 flex items-center rounded border border-transparent px-2 py-1 text-xs"
                >
                  <MoveIcon className="mr-1 h-3.5 w-3.5" />
                  Move
                </Link>
              )}
              {pageMetadata.lockedBy && (
                <WikiLockInfo
                  pageId={pageMetadata.id}
                  isLocked={!!pageMetadata.isLocked}
                  lockedByName={pageMetadata.lockedBy?.name || null}
                  lockedUntil={pageMetadata.lockExpiresAt || null}
                  isCurrentUserLockOwner={
                    pageMetadata.isCurrentUserLockOwner || false
                  }
                  editPath={`/${pageMetadata.path}?edit=true`}
                  displayMode="header"
                />
              )}
            </ClientRequirePermission>
          </div>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-2xl mx-auto hidden md:block">
        <SearchTrigger />
      </div>

      <div className="flex items-center space-x-3 flex-shrink-0">
        {/* Tags removed from here */}
        {/* {env.NODE_ENV === "development" && <RandomNumberDisplay />} */}
        <ThemeToggle />
        {/* Wrap client components needing session in Suspense */}
        <Suspense
          fallback={
            <div className="h-9 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700"></div>
          }
        >
          <AdminButton />
        </Suspense>
        <Suspense
          fallback={
            <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
          }
        >
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
