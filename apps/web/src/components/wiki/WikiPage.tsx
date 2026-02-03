"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { ReactNode, useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { WikiSubfolders } from "./WikiSubfolders";
import { Breadcrumbs } from "./Breadcrumbs";
import { useTRPC } from "~/server/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Modal, Popover, PopoverTrigger, PopoverContent, Button } from "@repo/ui";
import { PageLocationEditor } from "./PageLocationEditor";
import { ScrollArea } from "@repo/ui";
import { TableOfContents } from "./TableOfContents";
import { PencilIcon, MoveIcon, MoreVertical } from "lucide-react";
import { ClientRequirePermission } from "~/components/auth/permission/client";
import { HighlightedMarkdown } from "~/lib/markdown/client";

interface WikiPageProps {
  id: number;
  title: string;
  content: ReactNode;
  rawContent?: string;
  createdBy?: { name: string; id: number };
  updatedBy?: { name: string; id: number };
  lockedBy?: { name: string; id: number } | null;
  lockedAt?: Date | null;
  lockExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags?: { id: number; name: string }[];
  path: string;
  currentUserId?: number;
}

export function WikiPage({
  id,
  title,
  content,
  rawContent = "",
  createdBy,
  updatedBy,
  createdAt,
  updatedAt,
  tags = [],
  path,
}: WikiPageProps) {
  const displayTitle = title.replace(/^\/+/, "") || title;
  const router = useRouter();
  const [hasSubpages, setHasSubpages] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [renameConflict, setRenameConflict] = useState(false);
  const [liveContent, setLiveContent] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [baseContent, setBaseContent] = useState(rawContent);
  const trpc = useTRPC();
  const appendMutation = useMutation(trpc.ai.appendToPage.mutationOptions());
  const aiQueueRef = useRef<string[]>([]);
  const aiTypingRef = useRef(false);
  const aiIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const liveContentRef = useRef("");
  const aiBaseContentRef = useRef("");
  const aiTypedContentRef = useRef("");
  const aiIndexRef = useRef(0);
  const aiCurrentSaveRef = useRef<string | null>(null);

  // Create a mutation for updating a wiki page
  const updateMutation = useMutation(
    trpc.wiki.update.mutationOptions({
      onSuccess: () => {
        router.refresh();
      },
    })
  );

  // Handle rename submission
  const renameNode = () => {
    if (!newName.trim()) return;
    setRenameConflict(false);

    // Check if we can update the title
    if (id) {
      updateMutation.mutate({
        id: id,
        path: path,
        title: newName,
        content: undefined, // Keep existing content
        isPublished: undefined, // Keep existing publish state
      });
    }

    setShowRenameModal(false);
  };

  // Check if the current page has subpages
  const { data: folderStructure } = useQuery(
    trpc.wiki.getFolderStructure.queryOptions()
  );

  useEffect(() => {
    // Define the FolderNode interface to match the server type
    interface FolderNode {
      name: string;
      path: string;
      type: "folder" | "page";
      children: FolderNode[];
      id?: number;
      title?: string;
      updatedAt?: Date | string | null;
      isPublished?: boolean | null;
    }

    // Helper function to find node by path
    const findNodeByPath = (
      nodePath: string,
      tree: FolderNode | null
    ): FolderNode | null => {
      if (!tree) return null;
      if (tree.path === nodePath) return tree;

      for (const child of tree.children || []) {
        const found = findNodeByPath(nodePath, child);
        if (found) return found;
      }

      return null;
    };

    if (folderStructure && path) {
      const node = findNodeByPath(path, folderStructure);
      setHasSubpages(
        Boolean(node && node.children && node.children.length > 0)
      );
    }
  }, [folderStructure, path]);

  useEffect(() => {
    setBaseContent(rawContent);
  }, [rawContent]);


  useEffect(() => {
    liveContentRef.current = liveContent;
  }, [liveContent]);

  const startAiTyping = useCallback(() => {
    if (aiTypingRef.current) return;
    const next = aiQueueRef.current.shift();
    if (!next) return;

    const prefix = liveContentRef.current.trim() ? "\n\n" : "";
    const typedContent = `${prefix}${next.trim()}\n`;

    aiBaseContentRef.current = liveContentRef.current;
    aiTypedContentRef.current = typedContent;
    aiIndexRef.current = 0;
    aiCurrentSaveRef.current = next;
    setIsAiTyping(true);
    aiTypingRef.current = true;

    if (aiIntervalRef.current) {
      clearInterval(aiIntervalRef.current);
    }

    aiIntervalRef.current = setInterval(() => {
      const chunkSize = 3;
      aiIndexRef.current = Math.min(
        aiIndexRef.current + chunkSize,
        aiTypedContentRef.current.length
      );
      const nextValue = `${aiBaseContentRef.current}${aiTypedContentRef.current.slice(
        0,
        aiIndexRef.current
      )}`;
      setLiveContent(nextValue);

      if (aiIndexRef.current >= aiTypedContentRef.current.length) {
        if (aiIntervalRef.current) {
          clearInterval(aiIntervalRef.current);
          aiIntervalRef.current = null;
        }
        aiTypingRef.current = false;
        setIsAiTyping(false);
        const saveContent = aiCurrentSaveRef.current;
        if (saveContent) {
          appendMutation.mutate(
            {
              pageId: id,
              path,
              content: saveContent,
              changeSummary: "AI live edit: appended content",
            },
            {
              onSuccess: () => {
                const prefix = baseContent.trim() ? "\n\n" : "";
                setBaseContent(`${baseContent}${prefix}${saveContent}\n`);
                setLiveContent("");
              },
            }
          );
          aiCurrentSaveRef.current = null;
        }

        if (aiQueueRef.current.length > 0) {
          startAiTyping();
        }
      }
    }, 16);
  }, [appendMutation, id, path]);

  const enqueueAiContent = useCallback(
    (contentToAdd: string) => {
      if (!contentToAdd.trim()) return;
      aiQueueRef.current.push(contentToAdd);
      if (!aiTypingRef.current) {
        startAiTyping();
      }
    },
    [startAiTyping]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        content?: string;
        text?: string;
        mode: "append" | "replace" | "remove";
        path?: string;
      }>;
      const detail = customEvent.detail;
      if (detail.path && detail.path !== path) return;
      if (detail.mode === "remove" && detail.text) {
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .replace(/[`*_~>#\[\]\(\)-]+/g, " ")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const normalizedTarget = normalize(detail.text);
        const lines = baseContent.split(/\r?\n/);
        let filtered = lines.filter(
          (line) => normalize(line) !== normalizedTarget
        );
        if (filtered.length === lines.length) {
          filtered = lines.filter(
            (line) => !normalize(line).includes(normalizedTarget)
          );
        }
        const nextContent = filtered.join("\n").trimEnd() + "\n";
        setBaseContent(nextContent);
        setLiveContent("");
        setIsAiTyping(false);
        return;
      }
      if (detail.mode === "replace") {
        if (detail.content) {
          setBaseContent(detail.content);
        }
        setLiveContent("");
        setIsAiTyping(false);
        return;
      }
      if (detail.content) {
        enqueueAiContent(detail.content);
      }
    };

    window.addEventListener("ai:live-edit", handler);
    return () => {
      window.removeEventListener("ai:live-edit", handler);
    };
  }, [enqueueAiContent, path]);

  return (
    <>
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="flex justify-center w-full">
          {/* Left Column: Table of Contents */}
          <aside className="hidden xl:block sticky top-0 h-[calc(100vh-4rem)] flex-shrink-0">
            <TableOfContents />
          </aside>

          {/* Center Column: Main Content */}
          <div className="min-w-0 max-w-4xl flex-1 px-8 py-4">
            {/* Page Title with Actions Dropdown */}
            <div className="mb-6 flex items-start justify-between gap-4">
              <h1
                id="page-title"
                data-wiki-page-title
                className="text-text-primary text-3xl font-bold tracking-tight flex-1"
              >
                {displayTitle}
              </h1>
              <ClientRequirePermission permission="wiki:page:update">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1 bg-background-paper border-border-default">
                    <div className="space-y-0.5">
                      <Link
                        href={`/${path}?edit=true`}
                        className="text-text-primary hover:bg-background-level1 flex items-center rounded-md px-3 py-2 text-sm transition-colors"
                      >
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                      {path !== "index" && (
                        <Link
                          href={`/${path}?move=true`}
                          className="text-text-primary hover:bg-background-level1 flex items-center rounded-md px-3 py-2 text-sm transition-colors"
                        >
                          <MoveIcon className="mr-2 h-4 w-4" />
                          Move
                        </Link>
                      )}
                      <Link
                        href={`/${path}/history`}
                        className="text-text-primary hover:bg-background-level1 flex items-center rounded-md px-3 py-2 text-sm transition-colors"
                      >
                        <svg
                          className="mr-2 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        History
                      </Link>
                    </div>
                  </PopoverContent>
                </Popover>
              </ClientRequirePermission>
            </div>

            {isAiTyping && (
              <div className="mb-3 text-sm text-text-secondary">
                AI is editing...
              </div>
            )}

            {/* Article content - hide first h1 since we show it above */}
            <article className="[&>*:first-child:is(h1)]:hidden">
              {liveContent ? (
                <HighlightedMarkdown
                  content={`${baseContent}${
                    baseContent.trim() ? "\n\n" : ""
                  }${liveContent.trim()}\n`}
                />
              ) : (
                content
              )}
            </article>

            {/* Subpages Section - Moved to bottom */}
            {hasSubpages && (
              <div className="mt-12">
                <WikiSubfolders
                  path={path}
                  maxDepth={3}
                  openDepth={1}
                  showLegend={false}
                />
              </div>
            )}

            {/* Footer: Breadcrumbs, Metadata, and Tags */}
            <div className="mt-12 bg-background-level1 rounded-lg p-6">
              {/* Breadcrumbs */}
              {/* <Breadcrumbs path={path} className="mb-3" /> */}

              {/* Page metadata */}
              <div className="text-muted-foreground flex items-center space-x-4 text-sm">
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mr-1 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}
                  {updatedBy ? ` by ${updatedBy.name}` : ""}
                </div>
                <div>
                  Created {formatDistanceToNow(createdAt, { addSuffix: true })}
                  {createdBy ? ` by ${createdBy.name}` : ""}
                </div>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tags/${tag.name}`}
                      className="bg-background-level2 hover:bg-background-level3 text-text-secondary hover:text-text-primary rounded-full px-2.5 py-0.5 text-xs transition-colors"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Panel */}
          <aside className="hidden xl:block w-[320px] flex-shrink-0"></aside>
        </div>
      </ScrollArea>

      {/* Rename Modal */}
        {showRenameModal && (
          <Modal
            onClose={() => setShowRenameModal(false)}
            size="md"
            closeOnEscape={true}
            showCloseButton={true}
            className="w-full"
          >
            <div className="p-4">
              <h3 className="mb-4 text-lg font-medium">Rename Page</h3>
              <div className="mb-4">
                <label className="text-text-secondary mb-1 block text-sm font-medium">
                  Current Name
                </label>
                <div className="border-border-light bg-background-paper text-text-secondary/50 rounded-md border px-3 py-2 text-sm">
                  {title}
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="newName"
                    className="text-text-secondary mb-1 block text-sm font-medium"
                  >
                    New Name
                  </label>
                  {renameConflict && (
                    <span className="text-sm text-red-500">
                      Name already exists
                    </span>
                  )}
                </div>
                <input
                  id="newName"
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setRenameConflict(false);
                  }}
                  className={`border-border-light bg-background-level1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    renameConflict
                      ? "border-red-500 focus:ring-red-200"
                      : "focus:ring-primary"
                  }`}
                  placeholder="New title"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="text-text-secondary hover:bg-background-level2 border-border-light rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={renameNode}
                  className="bg-primary hover:bg-primary-600 text-primary-foreground hover:bg-primary-dark rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                  disabled={!newName.trim() || renameConflict}
                >
                  Rename
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Move Modal using PageLocationEditor */}
        {showMoveModal && (
          <PageLocationEditor
            mode="move"
            isOpen={showMoveModal}
            onClose={() => {
              setShowMoveModal(false);
            }}
            initialPath={path}
            pageId={id}
            pageTitle={title}
            initialName={title.split("/").pop() || title}
          />
        )}
    </>
  );
}
