"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { cn } from "~/lib/utils";
import { useTRPC } from "~/server/client";
import { NextWikiLogo } from "./NextWikiLogo";
import { NAV_GROUPS, isNavActive } from "~/lib/kosmo/nav";
import { ORACLE_GROUPS } from "~/lib/kosmo/oracle-nav";

const itemClass =
  "block w-full cursor-pointer rounded-md px-2 py-1.5 text-[15px] leading-snug text-kosmo-text outline-none transition-colors focus:bg-kosmo-bg focus:text-kosmo-mint data-[highlighted]:bg-kosmo-bg data-[highlighted]:text-kosmo-mint";

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.24em] text-kosmo-dim2">
      {children}
    </p>
  );
}

function MenuLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <DropdownMenuItem asChild className={cn(itemClass, active && "text-kosmo-mint")}>
      <Link href={href} aria-current={active ? "page" : undefined}>
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

// The old NextWiki dropdown's links, now a column of this menu.
const WIKI_LINKS = [
  { href: "/", label: "Home" },
  { href: "/wiki", label: "All pages" },
  { href: "/tags", label: "Tags" },
  { href: "/recent", label: "Recent changes" },
];
const CONTENTS_LIMIT = 15;

/**
 * Header menu: the left nav's groups across the top, the Oracle's five groups in a row
 * underneath, so every page is one click away without scrolling.
 */
export function KosmoMenu({ siteLogo }: { siteLogo?: string | null }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  // the folder tree is big now (every catalogue object has a page), so fetch it only once the menu opens
  const { data: folders, isLoading } = useQuery({ ...trpc.wiki.getFolderStructure.queryOptions(), enabled: open });
  const contents = (folders?.children ?? []).slice(0, CONTENTS_LIMIT);
  const mainGroups = NAV_GROUPS.filter((g) => g.name !== "Lab");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-background-level1"
        >
          <NextWikiLogo src={siteLogo} className="mr-2 h-6 w-6 shrink-0" />
          <span>Kosmographica</span>
          <ChevronDown className="ml-2 h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={10}
        className="max-h-[80vh] w-[min(920px,calc(100vw-2rem))] rounded-xl border border-kosmo-line2 bg-kosmo-panel p-5 shadow-2xl kosmo-scroll"
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-5">
          {mainGroups.map((group) => (
            <div key={group.name}>
              <GroupLabel>{group.name}</GroupLabel>
              {group.pages.map((page) => (
                <MenuLink
                  key={page.href}
                  href={page.href}
                  label={page.label}
                  active={isNavActive(pathname, page)}
                />
              ))}
            </div>
          ))}
          <div>
            <GroupLabel>Wiki</GroupLabel>
            {WIKI_LINKS.map((link) => (
              <MenuLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-kosmo-line2 pt-4">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.28em] text-kosmo-text">
            Oracle
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-5">
            {ORACLE_GROUPS.map((group) => (
              <div key={group.name}>
                <GroupLabel>{group.name}</GroupLabel>
                {group.pages.map((page) => {
                  const href = `/kosmo/tools/${page.slug}`;
                  return (
                    <MenuLink key={page.slug} href={href} label={page.label} active={pathname === href} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-kosmo-line2 pt-4">
          <GroupLabel>Wiki contents</GroupLabel>
          {isLoading ? (
            <p className="px-2 py-1 text-sm text-kosmo-dim">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-8 sm:grid-cols-5">
              {contents.map((item) => (
                <MenuLink
                  key={item.path}
                  href={`/${item.path}`}
                  label={item.title || item.name}
                  active={pathname === `/${item.path}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center border-t border-kosmo-line2 pt-3">
          <DropdownMenuItem asChild className={cn(itemClass, "flex w-auto items-center gap-2 text-kosmo-dim")}>
            <Link href="/about">
              <NextWikiLogo src={siteLogo} className="h-4 w-4" />
              <span>About</span>
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
