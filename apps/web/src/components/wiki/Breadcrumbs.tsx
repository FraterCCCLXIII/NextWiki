"use client";

import Link from "next/link";
import { ChevronRightIcon, HomeIcon } from "lucide-react";

interface BreadcrumbsProps {
  path: string;
  className?: string;
  currentPage?: string;
}

export function Breadcrumbs({ path, className = "", currentPage }: BreadcrumbsProps) {
  // If path is empty, just show home
  if (!path) {
    return (
      <div className={`flex items-center text-sm ${className}`}>
        <Link
          href="/"
          className="text-text-primary hover:text-text-secondary flex items-center hover:underline"
        >
          <HomeIcon className="mr-1 h-4 w-4" />
          <span>Home</span>
        </Link>
      </div>
    );
  }

  // Split path into segments
  const segments = path.split("/").filter(Boolean);

  // Create breadcrumb items
  const items = [
    // Home link
    {
      label: <HomeIcon className="h-4 w-4" />,
      path: "/",
      key: "home",
      isLast: false,
    },
    // Generate path segments
    ...segments.map((segment, index) => {
      // Build the path up to this segment
      const segmentPath = "/" + segments.slice(0, index + 1).join("/");
      return {
        label: segment,
        path: segmentPath,
        key: segmentPath,
        isLast: !currentPage && index === segments.length - 1,
      };
    }),
  ];

  // Add current page if provided (non-clickable)
  if (currentPage) {
    items.push({
      label: currentPage,
      path: "", // No path for current page
      key: "current",
      isLast: true,
    });
  }

  return (
    <div className={`flex flex-wrap items-center text-sm ${className}`}>
      {items.map((item, index) => (
        <div key={item.key} className="flex items-center">
          {index > 0 && (
            <ChevronRightIcon className="text-secondary mx-1.5 h-4 w-4" />
          )}

          {item.isLast && !item.path ? (
            // Current page - non-clickable
            <span className="text-secondary-600 font-medium">
              {item.label}
            </span>
          ) : (
            // Clickable breadcrumb
            <Link
              href={item.path}
              className={`hover:underline ${
                item.isLast
                  ? "text-secondary-600 font-medium"
                  : "text-secondary-600 hover:text-secondary-400"
              }`}
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
