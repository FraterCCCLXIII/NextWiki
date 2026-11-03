"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";
import { ORACLE_GROUPS } from "~/lib/kosmo/oracle-nav";

/**
 * Left rail for the Oracle lab pages: the lab's five groups as a vertical list.
 * Replaces the horizontal two-row nav the original pages carried (stashed in
 * docs/kosmo-legacy-top-nav). Renders only on /kosmo/tools/oracle*.
 */
export function OracleRail() {
  const pathname = usePathname() ?? "";
  if (!/^\/kosmo\/tools\/oracle(?:-|$)/.test(pathname)) return null;

  return (
    <nav
      aria-label="Oracle sections"
      className="w-full shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-kosmo-bg p-4 md:sticky md:top-0 md:h-[calc(100vh-6.25rem)] md:w-48"
    >
      <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.28em] text-kosmo-text">
        Oracle
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-4 md:block md:space-y-5">
        {ORACLE_GROUPS.map((group) => (
          <div key={group.name}>
            <p className="mb-1.5 text-[12px] uppercase tracking-[0.24em] text-kosmo-dim2">
              {group.name}
            </p>
            <ul className="m-0 list-none space-y-0.5 p-0">
              {group.pages.map((page) => {
                const href = `/kosmo/tools/${page.slug}`;
                const active = pathname === href;
                return (
                  <li key={page.slug}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block py-1 text-[14px] uppercase tracking-[0.14em] transition-colors",
                        active
                          ? "text-kosmo-text underline decoration-kosmo-dim2 underline-offset-[6px]"
                          : "text-kosmo-dim hover:text-kosmo-text"
                      )}
                    >
                      {page.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
