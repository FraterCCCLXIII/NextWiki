"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, Textarea, Label } from "@repo/ui";
import { useTRPC } from "~/server/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

interface RevertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: number;
  revisionId: number;
  pagePath: string;
}

export function RevertDialog({
  open,
  onOpenChange,
  pageId,
  revisionId,
  pagePath,
}: RevertDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const revertMutation = useMutation(
    trpc.wiki.revertToRevision.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["pageHistory", pageId] });
        onOpenChange(false);
        router.push(`/${pagePath}`);
        router.refresh();
      },
    })
  );

  const handleRevert = () => {
    revertMutation.mutate({
      pageId,
      revisionId,
      changeSummary: changeSummary || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revert to This Version</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            This will create a new revision that restores the page to the state of
            revision #{revisionId}. The current version and all history will be
            preserved.
          </p>

          <div className="space-y-2">
            <Label htmlFor="changeSummary">
              Change Summary (Optional)
            </Label>
            <Textarea
              id="changeSummary"
              placeholder="Explain why you're reverting this change..."
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              rows={3}
            />
          </div>

          {revertMutation.isError && (
            <div className="rounded-md bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                Failed to revert: {revertMutation.error?.message || "Unknown error"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outlined"
            onClick={() => onOpenChange(false)}
            disabled={revertMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRevert}
            disabled={revertMutation.isPending}
            className="bg-primary-main hover:bg-primary-dark"
          >
            {revertMutation.isPending ? "Reverting..." : "Revert to This Version"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
