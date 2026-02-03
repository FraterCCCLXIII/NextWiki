"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Drawer,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from "@repo/ui";
import { ArrowUp, Wand2, FileText } from "lucide-react";
import { useTRPC } from "~/server/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { PageMetadata } from "~/components/layout/MainLayout";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const slugify = (value: string) => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "new-page";
};

const parseCreatePageIntent = (prompt: string) => {
  const normalized = prompt.trim();
  if (!/create\s+(a\s+)?(new\s+)?page/i.test(normalized)) {
    return null;
  }

  const explicitPath = extractPath(normalized);
  const calledMatch = normalized.match(
    /(?:called|titled|named)\s+["']?([^"']+?)["']?(?:$|[.?!,]| and )/i
  );
  const quotedMatch = normalized.match(/["']([^"']+)["']/);
  const tailFallback = normalized
    .replace(/.*page/i, "")
    .split(" and ")[0]
    .trim();
  const title =
    calledMatch?.[1]?.trim() || quotedMatch?.[1]?.trim() || tailFallback;

  if (!title && !explicitPath) return null;

  if (explicitPath && !title) {
    const segments = explicitPath.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "new-page";
    const inferredTitle = lastSegment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return {
      title: inferredTitle,
      path: explicitPath,
    };
  }

  return {
    title: title!,
    path: explicitPath ?? slugify(title!),
  };
};

const extractPath = (prompt: string) => {
  const match = prompt.match(/\/[a-z0-9][a-z0-9\-\/]*/i);
  if (!match) return null;
  const cleaned = match[0].replace(/[.,!?;:]+$/g, "");
  return cleaned.replace(/^\/+/, "");
};

const isAddThatIntent = (prompt: string) =>
  /add (that|this|it) (to|into|on) (the )?page|add (that|this|it) to \//i.test(
    prompt
  );

const isWriteToPageIntent = (prompt: string) =>
  /(write|add|insert|update).*(page|content)/i.test(prompt);

const parseRemoveLineIntent = (prompt: string) => {
  if (
    !/remove (this|that|the)( bottom)? line|delete (this|that|the)( bottom)? line/i.test(
      prompt
    )
  ) {
    return null;
  }

  const quoted = prompt.match(/["']([^"']+)["']/);
  if (quoted?.[1]?.trim()) {
    return quoted[1].trim();
  }

  const after = prompt
    .replace(/remove (this|that|the)( bottom)? line[:]?/i, "")
    .replace(/delete (this|that|the)( bottom)? line[:]?/i, "")
    .trim();
  return after || null;
};

const dispatchLiveEdit = (detail: {
  content?: string;
  text?: string;
  mode: "append" | "replace" | "remove";
  path?: string;
}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ai:live-edit", {
      detail,
    })
  );
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message && typeof message === "string") {
      return message;
    }
  }
  return fallback;
};

interface AIAssistantPanelProps {
  pageMetadata?: PageMetadata;
  mode?: "edit" | "view";
  onClose?: () => void;
}

export function AIAssistantPanel({
  pageMetadata,
  mode = "view",
  onClose,
}: AIAssistantPanelProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastAssistantContent, setLastAssistantContent] = useState<string | null>(
    null
  );
  const trpc = useTRPC();

  const chatMutation = useMutation(trpc.ai.chat.mutationOptions());
  const draftPageMutation = useMutation(trpc.ai.draftPage.mutationOptions());
  const appendPageMutation = useMutation(trpc.ai.appendToPage.mutationOptions());
  const writeToPageMutation = useMutation(trpc.ai.writeToPage.mutationOptions());
  const generateContentMutation = useMutation(
    trpc.ai.generateContent.mutationOptions()
  );
  const removeLineMutation = useMutation(
    trpc.ai.removeFromPage.mutationOptions()
  );
  const summarizeMutation = useMutation(
    trpc.ai.summarizePage.mutationOptions()
  );
  const improveMutation = useMutation(trpc.ai.improvePage.mutationOptions());

  const pageContextLabel = useMemo(() => {
    if (!pageMetadata?.id) return null;
    return pageMetadata.title ?? pageMetadata.path ?? `Page #${pageMetadata.id}`;
  }, [pageMetadata]);

  const inputRef = useRef<HTMLDivElement>(null);
  const mentionRangeRef = useRef<Range | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionOpen, setIsMentionOpen] = useState(false);

  const { data: mentionResults } = useQuery(
    trpc.search.search.queryOptions(
      {
        query: mentionQuery,
        page: 1,
        pageSize: 6,
      },
      {
        enabled: isMentionOpen && mentionQuery.trim().length >= 1,
        staleTime: 5 * 60 * 1000,
      }
    )
  );
  const mentionItems = mentionResults?.items ?? [];

  const createMentionNode = (title: string, value: string) => {
    const span = document.createElement("span");
    span.dataset.mentionValue = value;
    span.dataset.mentionTitle = title;
    span.setAttribute("data-mention", "true");
    span.contentEditable = "false";
    span.className =
      "border-border-default bg-background-level1 text-text-secondary inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
    span.textContent = `@${title}`;
    return span;
  };

  const serializeInput = (root: HTMLElement) => {
    const walk = (nodes: ChildNode[]): string => {
      let output = "";
      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          output += node.textContent ?? "";
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node as HTMLElement;
        if (element.dataset.mentionValue) {
          output += element.dataset.mentionValue;
          return;
        }
        if (element.tagName === "BR") {
          output += "\n";
          return;
        }
        if (element.tagName === "DIV" || element.tagName === "P") {
          output += walk(Array.from(element.childNodes));
          output += "\n";
          return;
        }
        output += walk(Array.from(element.childNodes));
      });
      return output;
    };

    return walk(Array.from(root.childNodes)).replace(/\n+$/g, "");
  };

  const updateMessageFromInput = () => {
    const root = inputRef.current;
    if (!root) return;
    setMessage(serializeInput(root));
  };

  const isInsideMention = (node: Node | null) => {
    let current: HTMLElement | null =
      node instanceof HTMLElement ? node : node?.parentElement ?? null;
    while (current) {
      if (current.dataset.mentionValue) return true;
      current = current.parentElement;
    }
    return false;
  };

  const getRangeForOffsets = (
    root: HTMLElement,
    startIndex: number,
    endIndex: number
  ) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentIndex = 0;
    let startNode: Text | null = null;
    let endNode: Text | null = null;
    let startOffset = 0;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (isInsideMention(node)) {
        continue;
      }
      const length = node.nodeValue?.length ?? 0;
      const nextIndex = currentIndex + length;

      if (!startNode && nextIndex >= startIndex) {
        startNode = node;
        startOffset = Math.max(0, startIndex - currentIndex);
      }

      if (nextIndex >= endIndex) {
        endNode = node;
        endOffset = Math.max(0, endIndex - currentIndex);
        break;
      }

      currentIndex = nextIndex;
    }

    if (!startNode || !endNode) return null;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    return range;
  };

  const getTextToCaret = (root: HTMLElement, selectionRange: Range) => {
    const caretRange = document.createRange();
    caretRange.selectNodeContents(root);
    caretRange.setEnd(selectionRange.endContainer, selectionRange.endOffset);

    const fragment = caretRange.cloneContents();
    const container = document.createElement("div");
    container.appendChild(fragment);
    container
      .querySelectorAll("[data-mention]")
      .forEach((element) => element.remove());

    return container.textContent ?? "";
  };

  const getMentionMatch = () => {
    const root = inputRef.current;
    if (!root || typeof window === "undefined") return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const selectionRange = selection.getRangeAt(0);
    if (!root.contains(selectionRange.endContainer)) return null;

    const textToCaret = getTextToCaret(root, selectionRange);
    const lastAtIndex = textToCaret.lastIndexOf("@");
    if (lastAtIndex === -1) return null;

    const prefix = textToCaret.slice(0, lastAtIndex);
    if (prefix && !/\s$/.test(prefix)) return null;
    const query = textToCaret.slice(lastAtIndex + 1);
    if (query.includes("\n")) return null;

    const mentionRange = getRangeForOffsets(root, lastAtIndex, textToCaret.length);
    if (!mentionRange) return null;

    return {
      query,
      range: mentionRange,
    };
  };

  const refreshMentionState = () => {
    const match = getMentionMatch();
    if (!match) {
      mentionRangeRef.current = null;
      setIsMentionOpen(false);
      setMentionQuery("");
      return;
    }
    mentionRangeRef.current = match.range;
    setMentionQuery(match.query);
    setIsMentionOpen(true);
  };

  const clearInput = () => {
    const root = inputRef.current;
    if (!root) return;
    root.innerHTML = "";
    mentionRangeRef.current = null;
    setIsMentionOpen(false);
    setMentionQuery("");
    const contextTitle = pageMetadata?.title ?? pageMetadata?.path;
    const contextPath = pageMetadata?.path?.replace(/^\/+/, "");
    if (contextTitle && contextPath) {
      const mention = createMentionNode(contextTitle, `@/${contextPath}`);
      root.appendChild(mention);
      root.appendChild(document.createTextNode(" "));
    }
    updateMessageFromInput();
  };

  const insertMention = (title: string, path: string) => {
    const root = inputRef.current;
    if (!root || typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = mentionRangeRef.current ?? selection.getRangeAt(0);
    const normalizedPath = path.replace(/^\/+/, "");
    const mentionNode = createMentionNode(title, `@/${normalizedPath}`);
    const spacer = document.createTextNode(" ");

    range.deleteContents();
    const fragment = document.createDocumentFragment();
    fragment.appendChild(mentionNode);
    fragment.appendChild(spacer);
    range.insertNode(fragment);

    const nextRange = document.createRange();
    nextRange.setStartAfter(spacer);
    nextRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(nextRange);

    mentionRangeRef.current = null;
    setIsMentionOpen(false);
    setMentionQuery("");
    updateMessageFromInput();
    root.focus();
  };

  const handleInput = () => {
    updateMessageFromInput();
    refreshMentionState();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
      return;
    }

    if (event.key === "Escape" && isMentionOpen) {
      event.preventDefault();
      setIsMentionOpen(false);
      return;
    }

    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const selection = window.getSelection();
    if (!selection || !selection.isCollapsed) return;
    const root = inputRef.current;
    if (!root) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    if (anchorNode.nodeType === Node.TEXT_NODE && event.key === "Backspace") {
      if (selection.anchorOffset !== 0) return;
      const previous = anchorNode.previousSibling;
      if (previous instanceof HTMLElement && previous.dataset.mentionValue) {
        event.preventDefault();
        previous.remove();
        updateMessageFromInput();
      }
      return;
    }

    if (anchorNode.nodeType === Node.ELEMENT_NODE) {
      const element = anchorNode as HTMLElement;
      const index =
        event.key === "Backspace"
          ? selection.anchorOffset - 1
          : selection.anchorOffset;
      const target = element.childNodes[index];
      if (target instanceof HTMLElement && target.dataset.mentionValue) {
        event.preventDefault();
        target.remove();
        updateMessageFromInput();
      }
    }
  };

  const handleInputKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      refreshMentionState();
    }
  };

  const handleInputPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const ensureCaretPosition = () => {
    const root = inputRef.current;
    if (!root || typeof window === "undefined") return;
    const selection = window.getSelection();
    if (!selection) return;
    if (selection.rangeCount > 0 && root.contains(selection.anchorNode)) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleMentionSelect = (title: string, path: string) => {
    insertMention(title, path);
  };

  useEffect(() => {
    if (!pageContextLabel) return;
    const root = inputRef.current;
    if (!root) return;
    if (root.childNodes.length > 0) return;
    const contextTitle = pageMetadata?.title ?? pageMetadata?.path ?? pageContextLabel;
    const contextPath = pageMetadata?.path?.replace(/^\/+/, "");
    if (!contextTitle || !contextPath) return;
    const mention = createMentionNode(contextTitle, `@/${contextPath}`);
    root.appendChild(mention);
    root.appendChild(document.createTextNode(" "));
    updateMessageFromInput();
  }, [pageContextLabel, pageMetadata?.path, pageMetadata?.title]);

  const appendMessage = (next: ChatMessage) => {
    setMessages((prev) => [...prev, next]);
    if (next.role === "assistant") {
      setLastAssistantContent(next.content);
    }
  };

  const handleSend = async () => {
    const trimmed = inputRef.current
      ? serializeInput(inputRef.current).trim()
      : message.trim();
    if (!trimmed) return;
    appendMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
    clearInput();

    try {
      const createIntent = parseCreatePageIntent(trimmed);
      if (createIntent) {
        const result = await draftPageMutation.mutateAsync({
          path: createIntent.path,
          title: createIntent.title,
          context: trimmed,
        });
        appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Created draft page "${result.page.title}" at /${result.page.path}.`,
        });
        return;
      }

      const explicitPath = extractPath(trimmed);
      const normalizedPagePath = pageMetadata?.path?.replace(/^\/+/, "");
      const targetPath = explicitPath ?? normalizedPagePath;
      const targetPageId = explicitPath ? undefined : pageMetadata?.id;
      const isCurrentPageTarget =
        !explicitPath || explicitPath === normalizedPagePath;
      const isEditMode = mode === "edit";
      const removeLine = parseRemoveLineIntent(trimmed);

        if (removeLine && (targetPageId || targetPath)) {
        try {
            if (isCurrentPageTarget && !isEditMode) {
              dispatchLiveEdit({
                text: removeLine,
                mode: "remove",
                path: normalizedPagePath,
              });
            }
          const result = await removeLineMutation.mutateAsync({
            pageId: targetPageId,
            path: targetPath,
            text: removeLine,
          });
          if (isCurrentPageTarget && !isEditMode) {
            dispatchLiveEdit({
              content: result.content,
              mode: "replace",
              path: normalizedPagePath,
            });
          }
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Removed the line from /${result.page.path}. You can undo in history.`,
          });
        } catch (error) {
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${getErrorMessage(
              error,
              "Unable to remove that line."
            )}`,
          });
        }
        return;
      }

      if (isAddThatIntent(trimmed)) {
        if (!lastAssistantContent?.trim()) {
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: "I don’t have any recent content to add to the page.",
          });
          return;
        }

        if (!targetPageId && !targetPath) {
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "Please specify which page to update (e.g., “add that to /zen”).",
          });
          return;
        }

        if (isCurrentPageTarget && targetPageId) {
          dispatchLiveEdit({
            content: lastAssistantContent,
            mode: "append",
            path: normalizedPagePath,
          });
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: isEditMode
              ? "Inserted the content into the editor. Review and save when ready."
              : "Writing to the page now. You can undo via page history.",
          });
          if (!isEditMode) {
            return;
          }
        } else {
          const result = await appendPageMutation.mutateAsync({
            pageId: targetPageId,
            path: targetPath,
            content: lastAssistantContent,
          });

          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Added content to /${result.page.path}.`,
          });
        }
        return;
      }

      if (isWriteToPageIntent(trimmed) && (targetPageId || targetPath)) {
        if (isCurrentPageTarget && targetPageId) {
          const result = await generateContentMutation.mutateAsync({
            pageId: targetPageId,
            path: targetPath,
            prompt: trimmed,
          });
          dispatchLiveEdit({
            content: result.content,
            mode: "append",
            path: normalizedPagePath,
          });
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: isEditMode
              ? "Inserted the content into the editor. Review and save when ready."
              : "Writing to the page now. You can undo via page history.",
          });
          if (!isEditMode) {
            return;
          }
        } else {
          const result = await writeToPageMutation.mutateAsync({
            pageId: targetPageId,
            path: targetPath,
            prompt: trimmed,
          });
          appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Added content to /${result.page.path}.`,
          });
        }
        return;
      }

      const response = await chatMutation.mutateAsync({
        prompt: trimmed,
        pageId: pageMetadata?.id,
      });
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.message,
      });
    } catch (error) {
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${getErrorMessage(
          error,
          "Something went wrong while contacting the AI service."
        )}`,
      });
    }
  };

  const handleSummarize = async () => {
    if (!pageMetadata?.id) return;
    try {
      const response = await summarizeMutation.mutateAsync({
        pageId: pageMetadata.id,
      });
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.summary,
      });
    } catch (error) {
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${getErrorMessage(
          error,
          "Unable to summarize the page right now."
        )}`,
      });
    }
  };

  const handleImprove = async () => {
    if (!pageMetadata?.id) return;
    const proceed =
      typeof window !== "undefined"
        ? window.confirm(
            "This will update the current page with AI-generated edits. Continue?"
          )
        : true;
    if (!proceed) return;

    try {
      await improveMutation.mutateAsync({ pageId: pageMetadata.id });
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "The page was updated with AI-generated improvements. Review the history for details.",
      });
    } catch (error) {
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${getErrorMessage(
          error,
          "Unable to update the page right now."
        )}`,
      });
    }
  };

  const isSendDisabled =
    !message.trim() ||
    chatMutation.isPending ||
    draftPageMutation.isPending ||
    appendPageMutation.isPending ||
    writeToPageMutation.isPending ||
    generateContentMutation.isPending ||
    removeLineMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-x-hidden">
      <ScrollArea className="flex-1 px-5 py-4">
        {messages.length === 0 ? (
          <div className="text-text-secondary text-sm">
            Start a conversation to summarize, improve, or draft wiki content.
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {messages.map((item) => (
              <div
                key={item.id}
                className={
                  item.role === "user"
                    ? "bg-background-level1 text-text-primary rounded-md px-3 py-2"
                    : "bg-background-paper text-text-primary rounded-md px-3 py-2"
                }
              >
                {item.content}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="border-border-default border-t px-2 py-2">
        <div className="relative">
          <Popover
            open={isMentionOpen}
            onOpenChange={(open) => {
              if (!open) setIsMentionOpen(false);
            }}
          >
            <PopoverAnchor asChild>
              <span className="absolute left-3 bottom-11 h-0 w-0" />
            </PopoverAnchor>
            <PopoverContent side="top" align="start" className="w-72 p-2">
              {mentionQuery.trim().length === 0 ? (
                <div className="text-text-secondary px-2 py-2 text-xs">
                  Type to search pages.
                </div>
              ) : mentionItems.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {mentionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="hover:bg-background-level1 text-text-primary flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleMentionSelect(item.title, item.path);
                      }}
                    >
                      <FileText className="text-text-secondary h-4 w-4" />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className="text-text-secondary truncate text-xs">
                          /{item.path}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-text-secondary px-2 py-2 text-xs">
                  No pages found.
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute bottom-1 left-1 px-1"
              >
                Tools
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              className="w-48 p-1 bg-background-paper border-border-default"
            >
              <div className="space-y-0.5">
                <button
                  onClick={handleSummarize}
                  disabled={!pageMetadata?.id || summarizeMutation.isPending}
                  className="text-text-primary hover:bg-background-level1 flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Summarize page
                </button>
                <button
                  onClick={handleImprove}
                  disabled={!pageMetadata?.id || improveMutation.isPending}
                  className="text-text-primary hover:bg-background-level1 flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Improve page
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <div
            ref={inputRef}
            role="textbox"
            aria-multiline="true"
            aria-label="Ask the assistant"
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleInputKeyDown}
            onKeyUp={handleInputKeyUp}
            onPaste={handleInputPaste}
            onClick={ensureCaretPosition}
            onFocus={ensureCaretPosition}
            className="min-h-[72px] w-full bg-transparent px-2 pb-6 pl-3 pr-9 pt-1.5 text-base focus:outline-none md:text-sm whitespace-pre-wrap cursor-text"
          />
          {!message.trim() && (
            <div className="text-text-secondary/70 pointer-events-none absolute left-3 top-1.5 text-sm">
              Ask the assistant...
            </div>
          )}
          <Button
            type="button"
            variant="soft"
            size="icon"
            aria-label="Send message"
            className="absolute bottom-1 right-1 rounded-full"
            disabled={isSendDisabled}
            onClick={handleSend}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pageMetadata?: PageMetadata;
  mode?: "edit" | "view";
}

export function AIAssistantDrawer({
  isOpen,
  onClose,
  pageMetadata,
  mode = "view",
}: AIAssistantDrawerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      showCloseButton={false}
      lockScroll={false}
      disableAnimation={true}
      className="h-[calc(100vh-4rem-2rem)] w-[320px] rounded-2xl border border-border-default"
      overlayClassName="fixed right-0 top-16 bottom-0 z-50 flex justify-end p-4"
    >
      <AIAssistantPanel
        pageMetadata={pageMetadata}
        mode={mode}
        onClose={onClose}
      />
    </Drawer>
  );
}
