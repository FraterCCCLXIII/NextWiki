"use client";

import Link from "next/link";
import { ChevronDown, Orbit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { KOSMO_TOOLS } from "~/lib/kosmo/tools";

const ATLAS_LINKS = [
  { href: "/kosmo", label: "Kosmographica" },
  { href: "/kosmo/pedia", label: "Kosmopedia" },
  { href: "/kosmo/domain/math", label: "Mathematics" },
  { href: "/kosmo/domain/physics", label: "Physics" },
  { href: "/kosmo/domain/philosophy", label: "Philosophy" },
  { href: "/kosmo/domain/models", label: "Models" },
];

const toolsIn = (group: "atlas" | "oracle") =>
  Object.entries(KOSMO_TOOLS)
    .filter(([, tool]) => tool.group === group)
    .map(([slug, tool]) => ({ href: `/kosmo/tools/${slug}`, label: tool.title }));

export function KosmoMenu() {
  const atlasTools = toolsIn("atlas");
  const oracleTools = toolsIn("oracle");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center space-x-2 rounded-md px-3 py-2 text-base font-medium text-text-primary transition-colors hover:bg-background-level1"
        >
          <Orbit className="h-4 w-4" />
          <span>Kosmographica</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[80vh] w-64 overflow-y-auto">
        <DropdownMenuLabel>Atlas</DropdownMenuLabel>
        {ATLAS_LINKS.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Original pages</DropdownMenuLabel>
        {atlasTools.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Oracle</DropdownMenuLabel>
        {oracleTools.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
