"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, isNavActive, type NavGroup } from "~/lib/kosmo/nav";

function NavGroupSection({ group }: { group: NavGroup }) {
  const pathname = usePathname() ?? "";
  const hasActive = group.pages.some((p) => isNavActive(pathname, p));
  const [open, setOpen] = useState(true);
  const panelId = `kosmo-nav-${group.name.toLowerCase()}`;

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 py-1 text-left text-[12px] uppercase tracking-[0.16em] select-none ${
          hasActive ? "text-kosmo-mint" : "text-kosmo-dim"
        } hover:text-kosmo-text`}
      >
        <span>{group.name}</span>
        {/* the caret sits by the name: it points right when collapsed and down when open */}
        <span aria-hidden="true" className={`text-sm leading-none transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0"
      >
        {group.pages.map((page) => {
          const active = isNavActive(pathname, page);
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`-mx-2 block rounded px-2 py-1 text-base transition-colors ${
                  active
                    ? "bg-kosmo-panel text-kosmo-mint"
                    : "text-kosmo-text hover:bg-kosmo-panel hover:text-kosmo-mint"
                }`}
              >
                {page.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AtlasNav() {
  return (
    <nav
      aria-label="Atlas"
      className="w-full bg-kosmo-bg p-4 md:sticky md:top-0 md:h-[calc(100vh-6.25rem)] md:w-60 md:shrink-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {NAV_GROUPS.map((group) => (
        <NavGroupSection key={group.name} group={group} />
      ))}
    </nav>
  );
}
