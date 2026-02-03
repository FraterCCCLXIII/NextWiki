"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Drawer, ScrollArea, Textarea } from "@repo/ui";
import { Sparkles, Send, Wand2, FileText } from "lucide-react";
import { useTRPC } from "~/server/client";
import { useMutation } from "@tanstack/react-query";
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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: string }).message;
    if (message && typeof message === "string") {
      return message;
    }
  }
  return fallback;
};

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pageMetadata?: PageMetadata;
}

export function AIAssistantDrawer({
  isOpen,
  onClose,
  pageMetadata,
}: AIAssistantDrawerProps) {
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
  const summarizeMutation = useMutation(
    trpc.ai.summarizePage.mutationOptions()
  );
  const improveMutation = useMutation(trpc.ai.improvePage.mutationOptions());

  const pageContextLabel = useMemo(() => {
    if (!pageMetadata?.id) return null;
    return pageMetadata.title ?? pageMetadata.path ?? `Page #${pageMetadata.id}`;
  }, [pageMetadata]);

  const appendMessage = (next: ChatMessage) => {
    setMessages((prev) => [...prev, next]);
    if (next.role === "assistant") {
      setLastAssistantContent(next.content);
    }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    appendMessage({ id: crypto.randomUUID(), role: "user", content: trimmed });
    setMessage("");

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
      const targetPath = explicitPath ?? pageMetadata?.path?.replace(/^\/+/, "");
      const targetPageId = explicitPath ? undefined : pageMetadata?.id;

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
        return;
      }

      if (isWriteToPageIntent(trimmed) && (targetPageId || targetPath)) {
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

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="lg">
      <div className="flex h-full flex-col">
        <div className="border-border-default flex items-center gap-2 border-b px-5 py-4">
          <div className="bg-background-level1 text-text-primary flex h-9 w-9 items-center justify-center rounded-full">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-base font-semibold">AI Assistant</div>
            <div className="text-text-secondary text-sm">
              Ask questions or draft content for your wiki.
            </div>
          </div>
        </div>

        <div className="border-border-default flex items-center gap-2 border-b px-5 py-3">
          <Button
            type="button"
            size="sm"
            variant="soft"
            onClick={handleSummarize}
            disabled={!pageMetadata?.id || summarizeMutation.isPending}
          >
            <FileText className="mr-2 h-3.5 w-3.5" />
            Summarize page
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outlined"
            onClick={handleImprove}
            disabled={!pageMetadata?.id || improveMutation.isPending}
          >
            <Wand2 className="mr-2 h-3.5 w-3.5" />
            Improve page
          </Button>
          {pageContextLabel && (
            <Badge variant="outline" className="ml-auto">
              {pageContextLabel}
            </Badge>
          )}
        </div>

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
                      : "bg-background-paper text-text-primary rounded-md border px-3 py-2"
                  }
                >
                  {item.content}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-border-default border-t px-5 py-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask the assistant..."
              className="min-h-[80px]"
            />
            <Button
              type="button"
              variant="soft"
              size="icon"
              aria-label="Send message"
              disabled={
                !message.trim() ||
                chatMutation.isPending ||
                draftPageMutation.isPending ||
                appendPageMutation.isPending ||
                writeToPageMutation.isPending
              }
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
