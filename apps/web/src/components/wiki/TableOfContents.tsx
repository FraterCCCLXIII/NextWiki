"use client";

import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
  children?: TocItem[];
}

interface TocNode extends TocItem {
  children: TocItem[];
}

function buildTocTree(headings: TocItem[]): TocNode[] {
  const tree: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading) => {
    const node: TocNode = { ...heading, children: [] };

    // Find the appropriate parent
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return tree;
}

function TocItemComponent({
  item,
  activeId,
  expandedIds,
  toggleExpanded,
  level = 0,
}: {
  item: TocNode;
  activeId: string;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  level?: number;
}) {
  const isActive = activeId === item.id;
  const hasChildren = item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);

  return (
    <li className="overflow-hidden">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "bg-foreground mt-[0.5rem] h-1 w-1 flex-shrink-0 transition-opacity",
            isActive ? "opacity-100" : "opacity-0"
          )}
        />
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(item.id)}
              className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors"
              aria-label={isExpanded ? "Collapse section" : "Expand section"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(
                  "text-muted-foreground transition-transform",
                  isExpanded ? "rotate-90" : ""
                )}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          )}
          <a
            href={`#${item.id}`}
            className={cn(
              "min-w-0 flex-1 transition-colors",
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.text}
          </a>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <ul className="ml-4 mt-2 space-y-2 border-l border-border pl-3">
          {item.children.map((child) => (
            <TocItemComponent
              key={child.id}
              item={child}
              activeId={activeId}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocNode[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

    const tree = buildTocTree(items);
    setHeadings(tree);

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

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="bg-surface-base h-full w-[280px] overflow-y-auto px-6 pb-32 pt-8 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overscroll-behavior:contain]">
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => (
          <TocItemComponent
            key={heading.id}
            item={heading}
            activeId={activeId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
          />
        ))}
      </ul>
    </nav>
  );
}
