"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "~/components/layout/theme-toggle";
import { UserMenu } from "~/components/auth/UserMenu";
import { SearchIcon } from "lucide-react";

interface SearchHomepageProps {
  siteTitle?: string;
  siteLogo?: string;
}

export function SearchHomepage({ siteTitle, siteLogo }: SearchHomepageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/wiki?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Minimal Top Nav */}
      <header className="flex items-center justify-end gap-3 p-4">
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
            <SearchIcon className="text-text-tertiary absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wiki..."
              className="border-border-default focus:border-primary hover:shadow-md focus:shadow-lg w-full rounded-full border bg-background-paper py-4 pl-12 pr-4 text-lg shadow-sm transition-shadow focus:outline-none"
              autoFocus
            />
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
