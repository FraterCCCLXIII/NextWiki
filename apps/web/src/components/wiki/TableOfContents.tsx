"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "~/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
  children?: TocItem[];
}

interface TocNode extends TocItem {
  children: TocNode[];
}

function buildTocTree(headings: TocItem[]): TocNode[] {
  const tree: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading) => {
    const node: TocNode = { ...heading, children: [] };

    // Find the appropriate parent
    while (stack.length > 0) {
      const parent = stack[stack.length - 1];
      if (!parent || parent.level < node.level) break;
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(node);
    } else {
      const parent = stack[stack.length - 1];
      if (parent) {
        parent.children.push(node);
      }
    }

    stack.push(node);
  });

  return tree;
}

function findParentIds(
  tree: TocNode[],
  targetId: string,
  parentIds: string[] = []
): string[] | null {
  for (const item of tree) {
    if (item.id === targetId) {
      return parentIds;
    }
    if (item.children && item.children.length > 0) {
      const found = findParentIds(
        item.children as TocNode[],
        targetId,
        [...parentIds, item.id]
      );
      if (found) return found;
    }
  }
  return null;
}

function getScrollContainer(): HTMLElement | null {
  const article = document.querySelector("article");
  const closestViewport = article?.closest(
    "[data-radix-scroll-area-viewport]"
  ) as HTMLElement | null;
  if (closestViewport) return closestViewport;
  return document.querySelector(
    "[data-radix-scroll-area-viewport]"
  ) as HTMLElement | null;
}

function getTocElements(): HTMLElement[] {
  const pageTitleElement = document.querySelector(
    "[data-wiki-page-title]"
  ) as HTMLElement | null;
  const headingElements = Array.from(
    document.querySelectorAll(
      "article h1[id], article h2[id], article h3[id], article h4[id], article h5[id], article h6[id]"
    )
  ) as HTMLElement[];

  if (pageTitleElement) {
    return [pageTitleElement, ...headingElements];
  }

  return headingElements;
}

function getPageTitleElement(): HTMLElement | null {
  return document.querySelector(
    "[data-wiki-page-title]"
  ) as HTMLElement | null;
}

function TocItemComponent({
  item,
  activeId,
  expandedIds,
  toggleExpanded,
  onActivate,
  onScrollSync,
  level = 0,
  isTopLevel = false,
}: {
  item: TocNode;
  activeId: string;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  onActivate: (id: string) => void;
  onScrollSync: (scrollContainer: HTMLElement | null) => void;
  level?: number;
  isTopLevel?: boolean;
}) {
  const isActive = activeId === item.id;
  const hasChildren = item.children.length > 0;
  // Top-level items are always expanded, others can be toggled
  const isExpanded = isTopLevel || expandedIds.has(item.id);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // Immediately set this as the active item
    onActivate(item.id);

    const element = document.getElementById(item.id);
    let resolvedScrollContainer: HTMLElement | null = null;
    if (element) {
      // Find the ScrollArea viewport (the actual scrollable container)
      const scrollContainer =
        (element.closest(
          "[data-radix-scroll-area-viewport]"
        ) as HTMLElement | null) ?? getScrollContainer();
      resolvedScrollContainer = scrollContainer ?? null;
      if (scrollContainer) {
        // Get the position of the element relative to the scroll container
        const elementRect = element.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const scrollTop = scrollContainer.scrollTop;
        const targetScrollTop = Math.max(
          0,
          scrollTop + elementRect.top - containerRect.top - 80 // 80px offset from top
        );
        // Use auto scroll to avoid observer issues
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: "auto"
        });
      } else {
        // Fallback to regular scrollIntoView
        element.scrollIntoView({ behavior: "auto", block: "start" });
      }
      
      // Update URL without jumping
      window.history.pushState(null, "", `#${item.id}`);
    }

    onScrollSync(resolvedScrollContainer);
  };

  return (
    <li className="overflow-hidden list-none" style={{ listStyle: "none" }}>
      <div className="flex items-center justify-between gap-2">
        <a
          href={`#${item.id}`}
          onClick={handleClick}
          className={cn(
            "min-w-0 flex-1 transition-colors rounded px-1.5 py-1 -ml-1",
            isActive
              ? "text-text-primary font-semibold"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {item.text}
        </a>
        {hasChildren && !isTopLevel && (
          <button
            onClick={() => toggleExpanded(item.id)}
            className="flex-shrink-0 p-0.5 rounded transition-colors"
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
                "text-text-tertiary transition-transform",
                isExpanded ? "rotate-90" : ""
              )}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && isExpanded && item.children && (
        <ul className="ml-2 mt-0.5 space-y-0.5" style={{ listStyle: "none", paddingLeft: 0 }}>
          {item.children.map((child) => (
            <TocItemComponent
              key={child.id}
              item={child as TocNode}
              activeId={activeId}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              onActivate={onActivate}
              onScrollSync={onScrollSync}
              level={level + 1}
              isTopLevel={false}
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
  
  // Use refs to avoid stale closures during scroll updates
  const headingsTreeRef = useRef<TocNode[]>([]);
  const headingElementsRef = useRef<HTMLElement[]>([]);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const activeIdRef = useRef<string>("");
  const scrollRafRef = useRef<number | null>(null);
  const scrollListenerRef = useRef<{
    element: HTMLElement;
    handler: () => void;
  } | null>(null);

  const updateActiveId = useCallback((id: string) => {
    if (!id || activeIdRef.current === id) return;
    activeIdRef.current = id;
    setActiveId(id);
    const parentIds = findParentIds(headingsTreeRef.current, id);
    if (parentIds && parentIds.length > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        parentIds.forEach((parentId) => next.add(parentId));
        return next;
      });
    }
  }, []);

  const updateActiveHeadingFromScroll = useCallback((
    scrollContainerOverride?: HTMLElement | null
  ) => {
    const scrollContainer =
      scrollContainerOverride ?? scrollContainerRef.current;
    let elements = headingElementsRef.current;
    if (elements.length === 0 || elements.some((el) => !el.isConnected)) {
      elements = getTocElements();
      headingElementsRef.current = elements;
      const items: TocItem[] = elements.map((element) => ({
        id: element.id,
        text: element.textContent || "",
        level: parseInt(element.tagName.substring(1)),
      }));
      const tree = buildTocTree(items);
      setHeadings(tree);
      headingsTreeRef.current = tree;
    }
    if (!scrollContainer || elements.length === 0) return;

    const containerRect = scrollContainer.getBoundingClientRect();

    const topOffset = 80;
    const pageTitleElement = getPageTitleElement();
    if (pageTitleElement && scrollContainer.scrollTop <= topOffset) {
      const pageTitleId = pageTitleElement.id;
      if (pageTitleId) {
        updateActiveId(pageTitleId);
        return;
      }
    }
    let bestAboveId: string | null = null;
    let bestAboveDistance = Number.NEGATIVE_INFINITY;
    let bestBelowId: string | null = null;
    let bestBelowDistance = Number.POSITIVE_INFINITY;

    elements.forEach((element) => {
      const distance =
        element.getBoundingClientRect().top - containerRect.top - topOffset;
      if (distance <= 0 && distance > bestAboveDistance) {
        bestAboveDistance = distance;
        bestAboveId = element.id;
      } else if (distance > 0 && distance < bestBelowDistance) {
        bestBelowDistance = distance;
        bestBelowId = element.id;
      }
    });

    const nextId =
      bestAboveId ?? bestBelowId ?? elements[0]?.id ?? activeIdRef.current;
    updateActiveId(nextId);
  }, [updateActiveId]);

  const ensureScrollListener = useCallback((scrollElementOverride?: HTMLElement | null) => {
    const scrollElement = scrollElementOverride ?? getScrollContainer();
    if (!scrollElement) return;
    scrollContainerRef.current = scrollElement;

    if (scrollListenerRef.current?.element === scrollElement) return;

    if (scrollListenerRef.current) {
      scrollListenerRef.current.element.removeEventListener(
        "scroll",
        scrollListenerRef.current.handler
      );
      scrollListenerRef.current = null;
    }

    const handler = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        updateActiveHeadingFromScroll(scrollElement);
      });
    };
    scrollElement.addEventListener("scroll", handler, { passive: true });
    scrollListenerRef.current = { element: scrollElement, handler };
  }, [updateActiveHeadingFromScroll]);

  const syncAfterClick = useCallback((scrollContainerOverride?: HTMLElement | null) => {
    ensureScrollListener(scrollContainerOverride);
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      updateActiveHeadingFromScroll(scrollContainerOverride);
    });
  }, [ensureScrollListener, updateActiveHeadingFromScroll]);

  useEffect(() => {
    // Extract headings from the page - wait a bit for markdown to render
    const extractHeadings = () => {
      const elements = getTocElements();

      const items: TocItem[] = elements.map((element) => ({
        id: element.id,
        text: element.textContent || "",
        level: parseInt(element.tagName.substring(1)),
      }));

      const tree = buildTocTree(items);
      setHeadings(tree);
      headingsTreeRef.current = tree; // Store in ref for observer access
      headingElementsRef.current = elements;
      ensureScrollListener();
      
      return { elements, tree };
    };
    
    // Try immediately
    extractHeadings();
    
    // Also try after a short delay to catch dynamically rendered content
    const timeoutId = setTimeout(() => {
      const delayedResult = extractHeadings();

      if (delayedResult.elements.length === 0) return;

      updateActiveHeadingFromScroll();
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (scrollListenerRef.current) {
        scrollListenerRef.current.element.removeEventListener(
          "scroll",
          scrollListenerRef.current.handler
        );
        scrollListenerRef.current = null;
      }
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [ensureScrollListener, updateActiveHeadingFromScroll]);

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

  // Check if TOC should be hidden (no headings or only one heading with no subheadings)
  const shouldHideToc =
    headings.length === 0 ||
    (headings.length === 1 && headings[0]?.children?.length === 0);

  // Return empty spacer to maintain layout centering
  if (shouldHideToc) {
    return <div className="h-full w-[280px]" aria-hidden="true" />;
  }

  return (
    <nav className="bg-surface-base h-full w-[280px] overflow-y-auto px-6 pb-32 pt-8 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overscroll-behavior:contain]">
      <ul className="space-y-0.5 text-sm" style={{ listStyle: "none", paddingLeft: 0 }}>
        {headings.map((heading) => (
          <TocItemComponent
            key={heading.id}
            item={heading}
            activeId={activeId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onActivate={updateActiveId}
            onScrollSync={syncAfterClick}
            isTopLevel={true}
          />
        ))}
      </ul>
    </nav>
  );
}
