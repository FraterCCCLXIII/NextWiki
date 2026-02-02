import { UserMenu } from "../auth/UserMenu";
import { Suspense } from "react";
import { ThemeToggle } from "~/components/layout/theme-toggle";
import { PageMetadata } from "./MainLayout";
import { getSettingValue } from "~/lib/utils/settings";
import { SearchTrigger } from "./SearchTrigger";
import { NavigationDropdown } from "./NavigationDropdown";

export async function Header({
  pageMetadata,
}: {
  pageMetadata?: PageMetadata;
}) {
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
            <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
          }
        >
          <UserMenu />
        </Suspense>
      </div>
    </header>
  );
}
