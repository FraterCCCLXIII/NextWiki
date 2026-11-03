"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, isNavActive, type NavGroup } from "~/lib/kosmo/nav";
import { useScrollFade } from "~/lib/hooks/use-scroll-fade";

function NavGroupSection({ group, hueBase }: { group: NavGroup; hueBase: number }) {
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
        } kosmo-rainbow`}
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
        {group.pages.map((page, i) => {
          const active = isNavActive(pathname, page);
          const hue = (hueBase + i * 47) % 360; // every word gets its own colour gradient
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                style={{ "--h": hue } as React.CSSProperties}
                className="kosmo-navword -mx-2 block rounded px-2 py-1 text-base text-kosmo-text"
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
  const fadeRef = useScrollFade<HTMLElement>();
  return (
    <nav
      ref={fadeRef}
      aria-label="Atlas"
      className="kosmo-atlas-nav w-full bg-kosmo-bg p-4 md:sticky md:top-0 md:h-[calc(100vh-6.25rem)] md:w-max md:min-w-40 md:shrink-0 md:overflow-y-auto kosmo-scroll scroll-fade"
    >
      {NAV_GROUPS.map((group, gi) => (
        <NavGroupSection key={group.name} group={group} hueBase={(gi * 97 + 12) % 360} />
      ))}
    </nav>
  );
}
