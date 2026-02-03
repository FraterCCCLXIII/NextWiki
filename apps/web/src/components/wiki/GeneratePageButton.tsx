"use client";

import { Button } from "@repo/ui";
import { ClientRequirePermission } from "~/components/auth/permission/client";
import { useTRPC } from "~/server/client";
import { useMutation } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useNotification } from "~/lib/hooks/useNotification";

const titleFromPath = (path: string) => {
  const normalized = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized) return "New Page";
  const segment = normalized.split("/").filter(Boolean).pop() || "New Page";
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

interface GeneratePageButtonProps {
  onGenerate?: () => void;
  isGenerating?: boolean;
  publish?: boolean;
}

export function GeneratePageButton({
  onGenerate,
  isGenerating,
  publish,
}: GeneratePageButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const notification = useNotification();
  const trpc = useTRPC();

  const path = pathname.replace("/", "");
  const title = titleFromPath(pathname);

  const generateMutation = useMutation(
    trpc.ai.draftPage.mutationOptions({
      onSuccess: (data) => {
        notification.success("Draft page generated");
        router.push(`/${data.page.path}?edit=true`);
      },
      onError: (error) => {
        notification.error(`Failed to generate page: ${error.message}`);
      },
    })
  );

  const isPending = isGenerating ?? generateMutation.isPending;
  const handleGenerate = onGenerate ?? (() =>
    generateMutation.mutate({
      path,
      title,
      context: `Generate a full wiki article for "${title}".`,
      publish,
    }));

  return (
    <ClientRequirePermission permission="wiki:page:create">
      <Button
        variant="soft"
        onClick={handleGenerate}
        disabled={isPending}
      >
        {isPending ? "Generating..." : "Generate Page"}
      </Button>
    </ClientRequirePermission>
  );
}
