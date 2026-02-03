"use client";

import Link from "next/link";
import { useTRPC } from "~/server/client";
import { useQuery } from "@tanstack/react-query";
import { LoadingSpinner } from "~/components/ui/LoadingSpinner";

interface FolderNode {
  name: string;
  path: string;
  type: "folder" | "page";
  children: FolderNode[];
  id?: number;
  title?: string;
}

// Recursive component to render folder structure as headers
function FolderSection({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const pages = node.children.filter((child) => child.type === "page");
  const folders = node.children.filter((child) => child.type === "folder");

  // Determine heading level based on depth (h2 for top level, h3 for nested, h4 for deeper)
  const HeadingTag = depth === 0 ? "h2" : depth === 1 ? "h3" : "h4";
  const headingClass = 
    depth === 0 
      ? "text-2xl font-bold text-text-primary mb-4 mt-8 first:mt-0" 
      : depth === 1
      ? "text-xl font-semibold text-text-primary mb-3 mt-6"
      : "text-lg font-medium text-text-primary mb-2 mt-4";

  return (
    <div>
      {/* Folder name as header (skip root) */}
      {depth > 0 && node.type === "folder" && (
        <HeadingTag className={headingClass}>
          <Link 
            href={`/${node.path}`}
            className="hover:text-text-secondary transition-colors cursor-pointer inline-block"
          >
            {node.title || node.name}
          </Link>
        </HeadingTag>
      )}

      {/* Pages in this folder */}
      {pages.length > 0 && (
        <div className="space-y-2 mb-6">
          {pages.map((page) => (
            <div key={page.path}>
              <Link
                href={`/${page.path}`}
                className="text-text-primary hover:underline text-base"
              >
                {page.title || page.name}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Subfolders */}
      {folders.map((folder) => (
        <FolderSection key={folder.path} node={folder} depth={depth + 1} />
      ))}
    </div>
  );
}

export function WikiBrowser() {
  const trpc = useTRPC();

  // Fetch folder structure
  const { data: folderStructure, isLoading } = useQuery(
    trpc.wiki.getFolderStructure.queryOptions()
  );

  return (
    <>
      {/* Wiki folder structure as headers */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner label="Loading wiki structure" />
        </div>
      ) : folderStructure ? (
        <div className="max-w-none">
          {folderStructure.children.map((node) => (
            <FolderSection key={node.path} node={node} depth={0} />
          ))}
        </div>
      ) : (
        <div className="text-text-secondary py-8 text-center">
          No pages found. Create your first page to get started.
        </div>
      )}
    </>
  );
}
