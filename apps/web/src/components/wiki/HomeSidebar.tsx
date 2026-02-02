import Link from "next/link";
import { Card, CardContent, CardTitle } from "@repo/ui";
import { formatDistanceToNow } from "date-fns";
import { WikiFolderTree } from "./WikiFolderTree";

interface RecentPage {
  id: number;
  path: string;
  title: string;
  updatedAt: Date | null;
}

interface Tag {
  tag: {
    id: number;
    name: string;
  };
}

interface HomeSidebarProps {
  recentPages: RecentPage[];
  rootPageTags?: Tag[];
}

export function HomeSidebar({ recentPages, rootPageTags }: HomeSidebarProps) {
  return (
    <section className="flex flex-col gap-3 self-start lg:sticky lg:top-2 lg:col-span-1">
      {/* Combined Dashboard Card */}
      <Card className="border-border-light dark:bg-background-paper bg-background-default">
        <CardContent className="p-2">
          {/* Recently Updated Section */}
          <CardTitle className="mb-1 text-lg font-semibold">
            Recently Updated
          </CardTitle>
          <ul
            className="space-y-0.5 pl-0"
            style={{
              listStyleType: "none",
              paddingLeft: 0,
              marginLeft: 0,
            }}
          >
            {recentPages.map((page) => (
              <li
                key={page.id}
                style={{
                  paddingLeft: 0,
                  marginLeft: 0,
                  listStyleType: "none",
                  listStylePosition: "inside",
                }}
              >
                <Link
                  href={`/${page.path}`}
                  className="dark:bg-background-level1 bg-background-paper hover:bg-muted flex items-center justify-between rounded-md py-1 text-xs"
                >
                  <span className="text-foreground ml-2 font-medium">
                    {page.title}
                  </span>
                  <span className="text-text-secondary mr-2 shrink-0">
                    {page.updatedAt
                      ? `${formatDistanceToNow(page.updatedAt, {
                          addSuffix: true,
                        })}`
                      : "No date"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {recentPages.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No pages updated recently.
            </p>
          )}
          <Link
            href="/recent"
            className="text-foreground mt-2 inline-block text-xs font-medium hover:underline"
          >
            View All
          </Link>

          {/* Divider */}
          <hr className="border-border-light my-3" />

          {/* Wiki Features Section */}
          <CardTitle className="mb-2 text-lg font-semibold">
            Wiki Features
          </CardTitle>
          <div className="grid grid-cols-4 gap-2">
            <Link
              href="/wiki/getting-started"
              className="text-text-secondary hover:bg-muted flex flex-col items-center rounded-md p-1.5 text-center text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Quick Start
            </Link>
            <Link
              href="/create"
              className="text-text-secondary hover:bg-muted flex flex-col items-center rounded-md p-1.5 text-center text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Create Page
            </Link>
            <Link
              href="/tags"
              className="text-text-secondary hover:bg-muted flex flex-col items-center rounded-md p-1.5 text-center text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Browse Tags
            </Link>
            <Link
              href="/profile"
              className="text-text-secondary hover:bg-muted flex flex-col items-center rounded-md p-1.5 text-center text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mb-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Settings
            </Link>
          </div>

          {/* Divider */}
          <hr className="border-border-light my-3" />

          {/* Compact Wiki Browser */}
          <CardTitle className="mb-2 text-lg font-semibold">
            Quick Actions
          </CardTitle>
          <WikiFolderTree
            showRoot={false}
            hideHeader={true}
            card={false}
            mode="navigation"
          />
        </CardContent>
      </Card>

      {/* Tags Card (only if rootPage and tags exist) */}
      {rootPageTags && rootPageTags.length > 0 && (
        <Card className="border-border-light dark:bg-background-paper bg-background-default">
          <CardContent className="p-2">
            <CardTitle className="mb-1 text-lg font-semibold">
              Homepage Tags
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {rootPageTags.map((relation) => (
                <Link
                  key={relation.tag.id}
                  href={`/tags/${relation.tag.name}`}
                  className="bg-muted hover:bg-muted-darker rounded px-2 py-0.5 text-xs"
                >
                  {relation.tag.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
