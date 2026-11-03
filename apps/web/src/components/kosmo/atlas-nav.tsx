"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoOrb } from "@repo/ui";

type NavPage = { href: string; label: string };
type NavGroup = { name: string; pages: NavPage[] };

const GROUPS: NavGroup[] = [
  {
    name: "Atlas",
    pages: [
      { href: "/kosmo", label: "Kosmographica" },
      { href: "/kosmo/tools/timeline", label: "Timeline" },
      { href: "/kosmo/pedia", label: "Kosmopedia" },
    ],
  },
  {
    name: "Study",
    pages: [{ href: "/kosmo/tools/university", label: "University" }],
  },
  {
    name: "Domains",
    pages: [
      { href: "/kosmo/domain/math", label: "Math" },
      { href: "/kosmo/domain/physics", label: "Physics" },
      { href: "/kosmo/domain/philosophy", label: "Philosophy" },
      { href: "/kosmo/domain/models", label: "Models" },
    ],
  },
  {
    name: "Tools",
    pages: [
      { href: "/kosmo/tools/chemistry", label: "Chemistry" },
      { href: "/kosmo/tools/contraption", label: "Simulator" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/kosmo") return pathname === "/kosmo";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const pathname = usePathname() ?? "";
  const hasActive = group.pages.some((p) => isActive(pathname, p.href));
  const [open, setOpen] = useState(true);
  const panelId = `kosmo-nav-${group.name.toLowerCase()}`;

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between py-1 text-left text-[10px] uppercase tracking-[0.16em] select-none ${
          hasActive ? "text-kosmo-mint" : "text-kosmo-dim"
        } hover:text-kosmo-text`}
      >
        <span>{group.name}</span>
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-90" : ""}`}>
          ›
        </span>
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="mt-1 flex flex-col gap-0.5 border-l border-kosmo-line pl-3"
      >
        {group.pages.map((page) => {
          const active = isActive(pathname, page.href);
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded px-2 py-1 text-sm transition-colors ${
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
      className="w-full border-b border-kosmo-line bg-kosmo-bg p-4 md:sticky md:top-0 md:h-[calc(100vh-4rem)] md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r"
    >
      <Link href="/kosmo" className="mb-5 flex items-center gap-2 text-kosmo-text">
        <LogoOrb />
        <span className="flex flex-col leading-tight">
          <span className="text-xs font-semibold tracking-[0.22em] uppercase">Kosmographica</span>
          <span className="text-[10px] text-kosmo-dim">a map of everything, to scale</span>
        </span>
      </Link>
      {GROUPS.map((group) => (
        <NavGroupSection key={group.name} group={group} />
      ))}
    </nav>
  );
}
