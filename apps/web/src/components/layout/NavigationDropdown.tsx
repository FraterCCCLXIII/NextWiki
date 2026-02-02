"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Home, BookOpen, Tag, Folder, File, Clock } from "lucide-react";
import { useTRPC } from "~/server/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "~/lib/utils";

interface FolderNode {
  name: string;
  path: string;
  type: "folder" | "page";
  children: FolderNode[];
  id?: number;
  title?: string;
}

function WikiTreeItem({ item, activeItemPath }: { item: FolderNode; activeItemPath: string }) {
  const [isExpanded, setIsExpanded] = useState(activeItemPath.startsWith(`/${item.path}`));
  const isActive = activeItemPath === `/${item.path}`;
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="relative space-y-1">
      <div className="flex items-center">
        <div className="flex min-w-0 flex-1 items-center">
          {hasChildren && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mr-0.5 flex flex-shrink-0 items-center justify-center px-0.5 py-1.5 focus:outline-none"
            >
              {isExpanded ? (
                <ChevronDown className="text-text-tertiary h-4 w-4" />
              ) : (
                <ChevronRight className="text-text-tertiary h-4 w-4" />
              )}
            </button>
          )}
          {!hasChildren && <div className="mr-0.5 w-4 flex-shrink-0" />}
          <Link
            href={`/${item.path}`}
            className={cn(
              "text-text-primary flex min-w-0 flex-1 items-center rounded px-2 py-1.5 text-sm font-medium transition-colors hover:bg-card-hover",
              isActive && "bg-primary/10 text-primary font-semibold"
            )}
          >
            {item.type === "folder" ? (
              <Folder className={cn("text-primary mr-2 h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
            ) : (
              <File className="text-accent-600 dark:text-accent-400 mr-2 h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate">{item.title || item.name}</span>
          </Link>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-4 space-y-1 border-l border-border-light/50 pl-2">
          {item.children.map((child) => (
            <WikiTreeItem key={child.path} item={child} activeItemPath={activeItemPath} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NavigationDropdown({ siteTitle, siteLogo }: { siteTitle?: string; siteLogo?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const pathname = usePathname();
  const trpc = useTRPC();

  const { data: folderStructure, isLoading } = useQuery(
    trpc.wiki.getFolderStructure.queryOptions()
  );

  const tree = folderStructure?.children || [];

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      // Wait for animation to finish before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-text-primary hover:bg-background-level1 transition-colors"
      >
        {siteLogo ? (
          <>
            {/* Light theme logo */}
            <img
              src={siteLogo}
              alt={siteTitle || "Wiki Logo"}
              className="h-6 w-6 object-contain dark:hidden"
            />
            {/* Dark theme logo */}
            <img
              src="/assets/images/logo-white.svg"
              alt={siteTitle || "Wiki Logo"}
              className="hidden h-6 w-6 object-contain dark:block"
            />
          </>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary h-6 w-6"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
        )}
        <span>{siteTitle || "NextWiki"}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {shouldRender && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown content */}
          <div 
            role="menu"
            data-state={isOpen ? "open" : "closed"}
            className="absolute left-0 top-full mt-2 w-80 z-50 rounded-lg border border-border-default bg-background-paper shadow-lg max-h-[80vh] overflow-hidden flex flex-col will-change-[opacity,transform]"
          >
            {/* Navigation Links */}
            <nav className="space-y-1 p-3 border-b border-border-default">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="text-text-primary flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-background-level1"
              >
                <Home className="text-text-primary mr-3 h-4 w-4" />
                Home
              </Link>
              <Link
                href="/wiki"
                onClick={() => setIsOpen(false)}
                className="text-text-primary flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-background-level1"
              >
                <BookOpen className="text-text-primary mr-3 h-4 w-4" />
                All Pages
              </Link>
              <Link
                href="/tags"
                onClick={() => setIsOpen(false)}
                className="text-text-primary flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-background-level1"
              >
                <Tag className="text-text-primary mr-3 h-4 w-4" />
                Tags
              </Link>
              <Link
                href="/recent"
                onClick={() => setIsOpen(false)}
                className="text-text-primary flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-background-level1"
              >
                <Clock className="text-text-primary mr-3 h-4 w-4" />
                Recent Changes
              </Link>
            </nav>

            {/* Wiki Structure */}
            <div className="flex-1 overflow-auto p-3">
              <h3 className="text-text-secondary/80 mb-2 px-2 text-xs font-semibold uppercase">
                Wiki Structure
              </h3>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : tree.length > 0 ? (
                <div className="space-y-1">
                  {tree.map((item) => (
                    <div key={item.path} onClick={() => setIsOpen(false)}>
                      <WikiTreeItem item={item} activeItemPath={pathname} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-secondary text-sm px-2 py-4">No pages found</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
