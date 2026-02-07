import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "~/lib/auth";
import { authorizationService } from "~/lib/services/authorization";
import { HighlightedContent } from "~/lib/markdown/client";
import { WikiPage } from "~/components/wiki/WikiPage";
import { WidgetLayout } from "~/components/layout/WidgetLayout";
import { getWikiPageByPath } from "~/app/[...path]/page";

export const dynamic = "force-dynamic";

export default async function WidgetPageView({
  params,
}: {
  params: { path: string[] };
}) {
  const session = await getServerSession(authOptions);
  const currentUserId = session?.user?.id
    ? parseInt(session.user.id)
    : undefined;

  const canAccessPage = await authorizationService.hasPermission(
    currentUserId,
    "wiki:page:read"
  );

  if (!canAccessPage) {
    return (
      <WidgetLayout>
        <div className="text-text-secondary p-6 text-sm">
          You do not have permission to view this page.
        </div>
      </WidgetLayout>
    );
  }

  const page = await getWikiPageByPath(params.path || []);

  if (!page) {
    notFound();
  }

  const formattedTags =
    page.tags?.map((relation) => ({
      id: relation.tag.id,
      name: relation.tag.name,
    })) || [];

  const isLocked = Boolean(
    page.lockedBy &&
      page.lockExpiresAt &&
      new Date(page.lockExpiresAt) > new Date()
  );
  const isCurrentUserLockOwner = Boolean(
    currentUserId && page.lockedBy && page.lockedBy.id === currentUserId
  );

  return (
    <WidgetLayout>
      <WikiPage
        id={page.id}
        title={page.title}
        content={
          <Suspense fallback={<div>Loading...</div>}>
            <HighlightedContent
              content={page.content || ""}
              renderedHtml={page.renderedHtml}
            />
          </Suspense>
        }
        rawContent={page.content || ""}
        createdAt={new Date(page.createdAt ?? new Date())}
        updatedAt={new Date(page.updatedAt ?? new Date())}
        createdBy={
          page.createdBy
            ? { id: page.createdBy.id, name: page.createdBy.name || "Unknown" }
            : undefined
        }
        updatedBy={
          page.updatedBy
            ? { id: page.updatedBy.id, name: page.updatedBy.name || "Unknown" }
            : undefined
        }
        lockedBy={
          page.lockedBy
            ? { id: page.lockedBy.id, name: page.lockedBy.name || "Unknown" }
            : null
        }
        lockedAt={page.lockedAt ? new Date(page.lockedAt) : null}
        lockExpiresAt={page.lockExpiresAt ? new Date(page.lockExpiresAt) : null}
        tags={formattedTags}
        path={page.path}
        currentUserId={currentUserId}
      />
    </WidgetLayout>
  );
}
