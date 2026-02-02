"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { SearchModal } from "./SearchModal";

export function SearchTrigger() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const searchParams = useSearchParams();
  const currentSearch = searchParams.get("search") || "";

  // Detect OS for keyboard shortcut display
  useEffect(() => {
    setIsMac(
      typeof window !== "undefined" &&
        window.navigator.userAgent.includes("Mac")
    );
  }, []);

  return (
    <>
      <div
        onClick={() => setIsSearchOpen(true)}
        className="bg-background-default dark:bg-background-level1 border-border-default hover:border-border-dark dark:hover:border-border-light text-text-secondary flex w-full cursor-pointer items-center rounded-md border px-3 py-2 text-sm transition-colors"
      >
        <Search className="text-text-secondary mr-2 h-4 w-4" />
        <span className={currentSearch ? "text-text-primary" : ""}>
          {currentSearch || "Search..."}
        </span>
        <div className="ml-auto flex items-center">
          <kbd className="bg-background-level1 text-text-secondary border-border-default hidden sm:flex items-center rounded-md border px-2 py-1 text-xs">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        </div>
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
