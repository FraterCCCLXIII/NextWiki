"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Button,
  Drawer,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from "@repo/ui";
import { ArrowLeft, ArrowUp, Square, Wand2, FileText } from "lucide-react";
import { useTRPC, useTRPCClient } from "~/server/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageMetadata } from "~/components/layout/MainLayout";
import { createClientMarkdownProcessor } from "~/lib/markdown/client-factory";
import { MarkdownProse } from "~/components/wiki/MarkdownProse";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatStorageState = {
  conversationId: string;
  messages: ChatMessage[];
  lastAssistantContent: string | null;
};

const AI_CHAT_STORAGE_KEY = "ai:chat:state";

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
  const [view, setView] = useState<"chat" | "list">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastAssistantContent, setLastAssistantContent] = useState<string | null>(
    null
  );
  const [sessionMetrics, setSessionMetrics] = useState<{
    summaryAgeMinutes: number | null;
    messageCount: number;
    sourceCount: number;
    loopCount: number;
  } | null>(null);
  const markdownConfig = useMemo(() => createClientMarkdownProcessor(), []);
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const createConversationId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [conversationId, setConversationId] = useState<string>(
    createConversationId()
  );
  const hasLoadedStoredState = useRef(false);
  const queryClient = useQueryClient();

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessageIdRef = useRef<string | null>(null);
  const stopRequestedRef = useRef(false);

  const dispatchMutation = useMutation({
    mutationFn: async (input: {
      prompt: string;
      pageId?: number;
      mode: "edit" | "view";
      lastAssistantContent?: string;
      conversationId: string;
    }) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      return trpcClient.ai.dispatch.mutate(input, { signal: controller.signal });
    },
    onSettled: () => {
      abortControllerRef.current = null;
    },
  });
  const summarizeMutation = useMutation(
    trpc.ai.summarizePage.mutationOptions()
  );
  const improveMutation = useMutation(trpc.ai.improvePage.mutationOptions());
  const createConversationMutation = useMutation(
    trpc.ai.createConversation.mutationOptions()
  );
  const conversationListQueryKey = trpc.ai.listConversations.queryKey({
    limit: 30,
  });
  const { data: conversationList } = useQuery(
    trpc.ai.listConversations.queryOptions({ limit: 30 })
  );

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
    if (typeof window === "undefined" || hasLoadedStoredState.current) return;
    const stored = window.localStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<ChatStorageState>;
        if (parsed.conversationId) {
          setConversationId(parsed.conversationId);
        }
        if (Array.isArray(parsed.messages)) {
          const sanitized = parsed.messages.filter(
            (item): item is ChatMessage =>
              Boolean(item) &&
              typeof item.id === "string" &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          );
          if (sanitized.length > 0) {
            setMessages(sanitized);
          }
        }
        if (typeof parsed.lastAssistantContent === "string") {
          setLastAssistantContent(parsed.lastAssistantContent);
        }
      } catch {
        // Ignore invalid stored state.
      }
    }
    hasLoadedStoredState.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedStoredState.current) return;
    const state: ChatStorageState = {
      conversationId,
      messages,
      lastAssistantContent,
    };
    window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(state));
  }, [conversationId, messages, lastAssistantContent]);

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

  const resetConversationState = (nextConversationId: string) => {
    setConversationId(nextConversationId);
    setMessages([]);
    setLastAssistantContent(null);
    setSessionMetrics(null);
  };

  const appendAssistantPlaceholder = (content: string) => {
    const id = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", content },
    ]);
    return id;
  };

  const updateMessageContent = (id: string, content: string) => {
    setMessages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content } : item))
    );
  };

  const handleSend = async () => {
    const trimmed = inputRef.current
      ? serializeInput(inputRef.current).trim()
      : message.trim();
    if (!trimmed) return;
    appendMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
    clearInput();
    const placeholderId = appendAssistantPlaceholder("Thinking...");
    pendingMessageIdRef.current = placeholderId;
    stopRequestedRef.current = false;

    try {
      const response = await dispatchMutation.mutateAsync({
        prompt: trimmed,
        pageId: pageMetadata?.id,
        mode,
        lastAssistantContent: lastAssistantContent ?? undefined,
        conversationId,
      });
      if (stopRequestedRef.current) return;

      if ("sessionMetrics" in response && response.sessionMetrics) {
        setSessionMetrics(response.sessionMetrics);
      }

      if ("liveEdit" in response && response.liveEdit) {
        const liveEdit = response.liveEdit;
        const mode = liveEdit.mode;
        if (mode === "append" || mode === "replace" || mode === "remove") {
          dispatchLiveEdit({ ...liveEdit, mode });
        }
      }

      updateMessageContent(placeholderId, response.message);
      setLastAssistantContent(response.message);
    } catch (error) {
      if (stopRequestedRef.current || isAbortError(error)) {
        return;
      }
      updateMessageContent(
        placeholderId,
        `Error: ${getErrorMessage(
          error,
          "Something went wrong while contacting the AI service."
        )}`
      );
    } finally {
      pendingMessageIdRef.current = null;
      stopRequestedRef.current = false;
    }
  };

  const handleStop = () => {
    if (!isWorking) return;
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    const pendingId = pendingMessageIdRef.current;
    if (pendingId) {
      updateMessageContent(pendingId, "Stopped.");
    }
  };

  const handleSummarize = async () => {
    if (!pageMetadata?.id) return;
    const placeholderId = appendAssistantPlaceholder("Reading...");
    try {
      const response = await summarizeMutation.mutateAsync({
        pageId: pageMetadata.id,
      });
      updateMessageContent(placeholderId, response.summary);
      setLastAssistantContent(response.summary);
    } catch (error) {
      updateMessageContent(
        placeholderId,
        `Error: ${getErrorMessage(error, "Unable to summarize the page right now.")}`
      );
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

    const placeholderId = appendAssistantPlaceholder("Researching...");
    try {
      await improveMutation.mutateAsync({ pageId: pageMetadata.id });
      const message =
        "The page was updated with AI-generated improvements. Review the history for details.";
      updateMessageContent(placeholderId, message);
      setLastAssistantContent(message);
    } catch (error) {
      updateMessageContent(
        placeholderId,
        `Error: ${getErrorMessage(error, "Unable to update the page right now.")}`
      );
    }
  };

  const handleNewConversation = async () => {
    const nextId = createConversationId();
    resetConversationState(nextId);
    await createConversationMutation.mutateAsync({ conversationId: nextId });
    await queryClient.invalidateQueries({ queryKey: conversationListQueryKey });
    setView("chat");
  };

  const handleSelectConversation = async (id: string) => {
    resetConversationState(id);
    const data = await queryClient.fetchQuery(
      trpc.ai.getConversation.queryOptions({ conversationId: id })
    );
    if (data?.messages?.length) {
      const mapped: ChatMessage[] = data.messages.map(
        (item: { role: string; content: string }) => ({
          id: crypto.randomUUID(),
          role: item.role === "assistant" ? "assistant" : "user",
          content:
            item.role === "tool"
              ? `Tool result:\n${item.content}`
              : item.content,
        })
      );
      setMessages(mapped);
      const lastAssistant = mapped
        .slice()
        .reverse()
        .find((item) => item.role === "assistant");
      setLastAssistantContent(lastAssistant?.content ?? null);
    }
    setView("chat");
  };

  const isWorking = dispatchMutation.isPending;
  const isSendDisabled = !message.trim();

  const isAbortError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    if ("name" in error && (error as { name?: string }).name === "AbortError") {
      return true;
    }
    if ("cause" in error) {
      const cause = (error as { cause?: unknown }).cause;
      return (
        !!cause &&
        typeof cause === "object" &&
        "name" in cause &&
        (cause as { name?: string }).name === "AbortError"
      );
    }
    return false;
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-x-hidden">
      <div className="border-border-default flex h-12 items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {view === "chat" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setView("list")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="text-sm font-medium">
            {view === "chat" ? "Conversation" : "Conversations"}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full px-5 py-0">
        {view === "list" ? (
          <div className="space-y-4">
            <div className="text-text-secondary mt-2 text-xs">
              Start a new conversation or pick a previous one.
            </div>
            <div className="space-y-2">
              {(conversationList ?? []).map((item) => (
                <button
                  key={item.conversationId}
                  type="button"
                  onClick={() => handleSelectConversation(item.conversationId)}
                  className="border-border-default hover:bg-background-level1 w-full rounded-md border px-3 py-2 text-left text-sm"
                >
                  <div className="font-medium">
                    {item.lastReferencedPage?.title ??
                      item.lastReferencedPage?.path ??
                      "Conversation"}
                  </div>
                  <div className="text-text-secondary text-xs">
                    {item.summary?.slice(0, 120) || "No summary yet"}
                  </div>
                </button>
              ))}
              {conversationList?.length === 0 && (
                <div className="text-text-secondary text-sm">
                  No previous conversations yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
        {sessionMetrics ? (
          <div className="text-text-secondary mb-3 text-xs">
            Context: {sessionMetrics.messageCount} msgs ·{" "}
            {sessionMetrics.sourceCount} sources · loops {sessionMetrics.loopCount}
            {sessionMetrics.summaryAgeMinutes !== null
              ? ` · summary ${sessionMetrics.summaryAgeMinutes}m`
              : ""}
          </div>
        ) : null}
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
                {item.role === "assistant" ? (
                  <MarkdownProse className="prose-sm [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown
                      remarkPlugins={markdownConfig.remarkPlugins}
                      rehypePlugins={markdownConfig.rehypePlugins}
                      components={markdownConfig.components}
                    >
                      {item.content}
                    </ReactMarkdown>
                  </MarkdownProse>
                ) : (
                  <div className="whitespace-pre-wrap">{item.content}</div>
                )}
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </ScrollArea>
      {view === "list" && (
        <div className="border-border-default flex items-center border-t px-4 py-3">
          <Button className="w-full" onClick={handleNewConversation}>
            New Conversation
          </Button>
        </div>
      )}

      {view === "chat" && (
        <div className="border-border-default border-t">
          <div className="px-2 pt-2">
            <div className="relative">
              <Popover
                open={isMentionOpen}
                onOpenChange={(open) => {
                  if (!open) setIsMentionOpen(false);
                }}
              >
                <PopoverAnchor asChild>
                  <span className="absolute left-3 bottom-2 h-0 w-0" />
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
                            <div className="truncate font-medium">
                              {item.title}
                            </div>
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
                className="custom-scrollbar min-h-[48px] max-h-[12rem] w-full overflow-y-auto bg-transparent px-2 pb-3 pl-3 pr-3 pt-1.5 text-base focus:outline-none md:text-sm whitespace-pre-wrap cursor-text"
              />
              {!message.trim() && (
                <div className="text-text-secondary/70 pointer-events-none absolute left-3 top-1.5 text-sm">
                  Ask the assistant...
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" size="sm" variant="ghost" className="px-1">
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
            <Button
              type="button"
              variant="soft"
              size="icon"
              aria-label={isWorking ? "Stop response" : "Send message"}
              className="h-8 w-8 rounded-full"
              disabled={isWorking ? false : isSendDisabled}
              onClick={isWorking ? handleStop : handleSend}
            >
              {isWorking ? (
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
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
      className="h-[calc(100vh-4rem-2rem)] w-[360px] min-w-[360px] rounded-2xl border border-border-default"
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
