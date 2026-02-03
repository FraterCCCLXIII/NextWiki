"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui";
import { useTRPC } from "~/server/client";
import { useMutation } from "@tanstack/react-query";
import { useNotification } from "~/lib/hooks/useNotification";
import { CreatePageButton } from "~/components/wiki/CreatePageButton";
import { GeneratePageButton } from "~/components/wiki/GeneratePageButton";
import { HighlightedMarkdown } from "~/lib/markdown/client";

interface EmptyPageGeneratorProps {
  showGenerate: boolean;
  publishOnGenerate: boolean;
}

export function EmptyPageGenerator({
  showGenerate,
  publishOnGenerate,
}: EmptyPageGeneratorProps) {
  const pathname = usePathname();
  const notification = useNotification();
  const trpc = useTRPC();
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedPath = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const titleFromPath = useCallback(() => {
    if (!normalizedPath) return "New Page";
    const segment = normalizedPath.split("/").filter(Boolean).pop() || "New Page";
    return segment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }, [normalizedPath]);

  const createMutation = useMutation(
    trpc.ai.createPageFromContent.mutationOptions({
      onSuccess: () => {
        notification.success("Page generated and published");
      },
      onError: (error) => {
        notification.error(`Failed to save page: ${error.message}`);
      },
    })
  );

  useEffect(() => {
    if (!generatedContent) return;
    setStreamedContent("");
    setIsStreaming(true);
    const chunkSize = 3;
    let index = 0;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      index = Math.min(index + chunkSize, generatedContent.length);
      setStreamedContent(generatedContent.slice(0, index));
      if (index >= generatedContent.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsStreaming(false);
      }
    }, 16);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [generatedContent]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedContent(null);
    setStreamedContent("");

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleFromPath(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to stream content");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      setIsStreaming(true);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamedContent(fullText);
      }

      setIsStreaming(false);
      setGeneratedContent(fullText);
      await createMutation.mutateAsync({
        path: normalizedPath,
        title: titleFromPath(),
        content: fullText,
        publish: publishOnGenerate,
      });
    } catch (error) {
      notification.error("Failed to generate page content");
    } finally {
      setIsGenerating(false);
    }
  };

  if (generatedContent) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {isStreaming && (
          <div className="text-text-secondary text-sm">AI is writing...</div>
        )}
        <HighlightedMarkdown content={streamedContent || generatedContent} />
        <div className="pt-4">
          <Link href={`/${normalizedPath}`}>
            <Button variant="outlined">View Published Page</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 text-center">
        <div className="text-text-secondary text-sm">Generating page...</div>
        <div className="rounded-lg border border-dashed border-border-default bg-background-level1 p-6 text-left">
          <div className="text-text-secondary text-sm">AI is writing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-text-secondary mb-4 text-5xl font-bold">404</div>
      <h1 className="mb-2 text-2xl font-bold">Page Not Found</h1>
      <p className="text-text-secondary mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="space-x-4">
        <Link href="/wiki">
          <Button variant="outlined">Browse All Pages</Button>
        </Link>
        <CreatePageButton />
        {showGenerate && (
          <GeneratePageButton
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            publish={publishOnGenerate}
          />
        )}
      </div>
    </div>
  );
}
