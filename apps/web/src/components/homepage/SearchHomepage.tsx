"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "~/components/layout/theme-toggle";
import { UserMenu } from "~/components/auth/UserMenu";
import { SearchIcon, FileTextIcon, X } from "lucide-react";
import { useTRPC } from "~/server/client";
import { useQuery } from "@tanstack/react-query";
import { AIAssistantTrigger } from "~/components/ai/AIAssistantTrigger";

interface SearchHomepageProps {
  siteTitle?: string;
  siteLogo?: string;
  aiEnabled?: boolean;
}

export function SearchHomepage({
  siteTitle,
  siteLogo,
  aiEnabled = true,
}: SearchHomepageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const trpc = useTRPC();

  // Debounce search input
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch search results
  const { data: searchResults, isLoading } = useQuery(
    trpc.wiki.list.queryOptions(
      {
        limit: 5,
        search: debouncedSearch,
        sortBy: "updatedAt",
        sortOrder: "desc",
      },
      {
        enabled: debouncedSearch.length > 0,
      }
    )
  );

  // Show/hide results based on search query and focus
  useEffect(() => {
    setShowResults(debouncedSearch.length > 0);
    setSelectedIndex(-1);
  }, [debouncedSearch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest("input")
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(false);
      router.push(`/wiki?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResultClick = (path: string) => {
    setShowResults(false);
    router.push(`/${path}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || !searchResults?.pages.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.pages.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults.pages[selectedIndex]) {
          handleResultClick(searchResults.pages[selectedIndex].path);
        } else if (searchQuery.trim()) {
          setShowResults(false);
          router.push(`/wiki?search=${encodeURIComponent(searchQuery.trim())}`);
        }
        break;
      case "Escape":
        setShowResults(false);
        break;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal Top Nav */}
      <header className="flex items-center justify-end gap-3 p-4">
        {aiEnabled && <AIAssistantTrigger mode="view" />}
        <ThemeToggle />
        <UserMenu />
      </header>

      {/* Main Content - Centered */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-32">
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center">
          {siteLogo ? (
            <>
              {/* Light theme logo */}
              <img
                src={siteLogo}
                alt={siteTitle || "Wiki Logo"}
                className="mb-4 h-24 w-24 object-contain dark:hidden"
              />
              {/* Dark theme logo */}
              <img
                src="/assets/images/logo-white.svg"
                alt={siteTitle || "Wiki Logo"}
                className="mb-4 hidden h-24 w-24 object-contain dark:block"
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
              className="text-primary mb-4 h-24 w-24"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          )}
          <h1 className="text-text-primary text-5xl font-light tracking-tight">
            {siteTitle || "NextWiki"}
          </h1>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl">
          <div className="relative">
            <SearchIcon className="text-text-tertiary absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 z-10" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => debouncedSearch.length > 0 && setShowResults(true)}
              placeholder="Search..."
              className="border-border-default focus:border-primary hover:shadow-md focus:shadow-lg w-full rounded-full border bg-background-paper py-4 pl-12 pr-12 text-lg shadow-sm transition-shadow focus:outline-none [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowResults(false);
                }}
                className="text-text-tertiary hover:text-text-primary absolute right-4 top-1/2 -translate-y-1/2 z-10 rounded-full p-1 hover:bg-background-level1 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Typeahead Results Dropdown */}
            {showResults && (
              <div
                ref={resultsRef}
                className="absolute top-full mt-2 w-full rounded-2xl border border-border-default bg-background-paper shadow-lg z-20 max-h-[60vh] overflow-y-auto"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : searchResults?.pages && searchResults.pages.length > 0 ? (
                  <div className="py-2">
                    {searchResults.pages.map((page, index) => (
                      <button
                        key={page.id}
                        onClick={() => handleResultClick(page.path)}
                        className={`w-full text-left px-6 py-3 flex items-start gap-3 transition-colors ${
                          selectedIndex === index
                            ? "bg-background-level1"
                            : "hover:bg-background-level1"
                        }`}
                      >
                        <FileTextIcon className="text-text-secondary h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-text-primary font-medium truncate">
                            {page.title}
                          </div>
                          <div className="text-text-tertiary text-sm truncate">
                            /{page.path}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-secondary py-8 text-center text-sm">
                    No results found for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <a
              href="/wiki"
              className="hover:border-border-default bg-background-level1 hover:shadow-sm rounded-md border border-transparent px-6 py-2 text-sm font-medium transition-all"
            >
              Browse All Pages
            </a>
          </div>
        </form>
      </div>

    </div>
  );
}
