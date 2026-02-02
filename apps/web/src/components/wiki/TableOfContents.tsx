"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Extract headings from the page
    const elements = Array.from(
      document.querySelectorAll("article h1, article h2, article h3, article h4")
    );

    const items: TocItem[] = elements.map((element) => ({
      id: element.id,
      text: element.textContent || "",
      level: parseInt(element.tagName.substring(1)),
    }));

    setHeadings(items);

    // Intersection Observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "-20% 0px -80% 0px",
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  const getIndentation = (level: number) => {
    // H1 = 0rem, H2 = 0.75rem, H3 = 1.5rem, H4 = 2.25rem
    return `${(level - 1) * 0.75}rem`;
  };

  return (
    <nav className="bg-surface-base h-full w-[280px] overflow-y-auto px-6 pb-32 pt-8 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overscroll-behavior:contain]">
      <h3 className="text-text-secondary mb-4 text-xs font-semibold uppercase">
        On This Page
      </h3>
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => {
          const isActive = activeId === heading.id;
          return (
            <li
              key={heading.id}
              className="flex items-start gap-2 overflow-hidden"
              style={{
                paddingLeft: getIndentation(heading.level),
                opacity: 1,
                height: "auto",
              }}
            >
              <div
                className={cn(
                  "bg-foreground mt-[0.5rem] h-1 w-1 flex-shrink-0 transition-opacity",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <a
                href={`#${heading.id}`}
                className={cn(
                  "transition-opacity hover:opacity-100",
                  isActive
                    ? "opacity-100 [text-shadow:0.2px_0_0_currentColor]"
                    : "opacity-50"
                )}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
