import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, permissionProtectedProcedure, protectedProcedure } from "..";
import {
  assertAIWriteAllowed,
  getAIUserId,
  getRelevantChunks,
  runChatCompletion,
  selectAIAction,
} from "~/lib/services/ai";
import { searchService, type SearchResultItem } from "~/lib/services/search";
import { wikiService } from "~/lib/services";
import { authorizationService } from "~/lib/services/authorization";
import { getSetting } from "~/lib/services/settings";
import { db, wikiPages } from "@repo/db";
import { eq } from "drizzle-orm";

const chatInputSchema = z.object({
  prompt: z.string().min(1),
  pageId: z.number().optional(),
});

const extractPath = (prompt: string) => {
  const match = prompt.match(/\/[a-z0-9][a-z0-9\-\/]*/i);
  if (!match) return null;
  const cleaned = match[0].replace(/[.,!?;:]+$/g, "");
  return cleaned.replace(/^\/+/, "").toLowerCase();
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

const wantsExactQuote = (prompt: string) =>
  /exact words|verbatim|quote|bottom|end of (the )?page|last (line|lines|paragraph)/i.test(
    prompt
  );

const extractSearchQuery = (prompt: string) => {
  const quoted = prompt.match(/["']([^"']+)["']/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const stopwords = new Set([
    "a",
    "about",
    "an",
    "and",
    "are",
    "can",
    "content",
    "does",
    "find",
    "for",
    "from",
    "have",
    "how",
    "i",
    "in",
    "is",
    "it",
    "list",
    "me",
    "of",
    "on",
    "page",
    "pages",
    "please",
    "show",
    "the",
    "this",
    "to",
    "what",
    "wiki",
    "with",
    "you",
  ]);

  const tokens = prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !stopwords.has(token) && token.length > 2);

  if (tokens.length === 0) return prompt.trim();
  return tokens.slice(0, 6).join(" ");
};

const normalizePath = (path: string) => path.replace(/^\/+/, "").toLowerCase();

const formatPath = (path: string) => `/${normalizePath(path)}`;

const scoreFromDistance = (distance: number) =>
  Number.isFinite(distance) ? 1 / (1 + Math.max(0, distance)) : 0;

type ChunkSource = {
  type: "chunk";
  title: string;
  path: string;
  content: string;
  chunkIndex: number;
  score: number;
};

type PageSource = {
  type: "page";
  title: string;
  path: string;
  content: string;
  score: number;
};

type HybridSource = ChunkSource | PageSource;

const buildChunkSources = (chunks: Awaited<ReturnType<typeof getRelevantChunks>>) =>
  chunks.map((chunk) => ({
    type: "chunk" as const,
    title: chunk.title,
    path: chunk.path,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    score: scoreFromDistance(chunk.distance),
  }));

const buildPageSources = (items: SearchResultItem[]) =>
  items.map((item) => ({
    type: "page" as const,
    title: item.title,
    path: item.path,
    content: item.excerpt,
    score: Math.min(1, Math.max(0, item.relevance / 4)),
  }));

const mergeSources = (chunks: ChunkSource[], pages: PageSource[], limit: number) => {
  const combined = [...chunks, ...pages].sort((a, b) => b.score - a.score);
  const seenPaths = new Set<string>();
  const results: HybridSource[] = [];

  for (const source of combined) {
    const key = normalizePath(source.path);
    if (seenPaths.has(key)) continue;
    seenPaths.add(key);
    results.push(source);
    if (results.length >= limit) break;
  }

  return results;
};

const formatSourcesForPrompt = (sources: HybridSource[]) =>
  sources
    .map((source, index) => {
      const label = `Source ${index + 1}: ${source.title} (${formatPath(
        source.path
      )})`;
      if (source.type === "chunk") {
        return `${label} [Chunk ${source.chunkIndex + 1}]\n${source.content}`;
      }
      return `${label} [Excerpt]\n${source.content}`;
    })
    .join("\n\n");

const getChunkSourcesForPrompt = async (prompt: string, limit = 6) => {
  const trimmed = prompt.trim();
  const fallbackQuery = extractSearchQuery(trimmed);
  const queries = fallbackQuery && fallbackQuery !== trimmed
    ? [trimmed, fallbackQuery]
    : [trimmed];

  for (const query of queries) {
    if (!query) continue;
    const chunks = await getRelevantChunks({ query, limit });
    if (chunks.length > 0) return buildChunkSources(chunks);
  }

  return [];
};

const getHybridSourcesForPrompt = async (prompt: string, options?: {
  chunkLimit?: number;
  searchLimit?: number;
  mergedLimit?: number;
}) => {
  const trimmed = prompt.trim();
  const fallbackQuery = extractSearchQuery(trimmed);
  const queries = fallbackQuery && fallbackQuery !== trimmed
    ? [trimmed, fallbackQuery]
    : [trimmed];

  const chunkLimit = options?.chunkLimit ?? 8;
  const searchLimit = options?.searchLimit ?? 3;
  const mergedLimit = options?.mergedLimit ?? 8;

  for (const query of queries) {
    if (!query) continue;
    const [chunks, searchResults] = await Promise.all([
      getRelevantChunks({ query, limit: chunkLimit }),
      searchService.searchPaginated(query, { page: 1, pageSize: searchLimit }),
    ]);
    const sources = mergeSources(
      buildChunkSources(chunks),
      buildPageSources(searchResults.items),
      mergedLimit
    );
    if (sources.length > 0 || searchResults.items.length > 0) {
      return { sources, searchResults };
    }
  }

  return { sources: [], searchResults: { items: [], totalItems: 0 } };
};

const buildChatResponse = async (prompt: string, pageId?: number) => {
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];

  messages.push({
    role: "system",
    content:
      "Use provided sources when answering. If sources are missing or irrelevant, say you could not find a matching page. Cite sources using their /path when possible.",
  });

  const explicitPath = extractPath(prompt);
  const wantsQuote = wantsExactQuote(prompt);

  const pageContext =
    pageId || explicitPath
      ? pageId
        ? await wikiService.getById(pageId)
        : await db.query.wikiPages.findFirst({
            where: eq(wikiPages.path, explicitPath!),
          })
      : null;

  if (pageContext) {
    const page = pageId
      ? pageContext
      : pageContext;
    const content = page.content ?? "";
    const tail = wantsQuote ? content.slice(-800) : content;
    messages.push({
      role: "user",
      content: `Context page:\nTitle: ${page.title}\nPath: ${page.path}\nContent:\n${tail}`,
    });
  }

  const { sources, searchResults } = await getHybridSourcesForPrompt(prompt);
  const normalizedPagePath = pageContext?.path
    ? normalizePath(pageContext.path)
    : null;
  const filteredSources = normalizedPagePath
    ? sources.filter((source) => normalizePath(source.path) !== normalizedPagePath)
    : sources;

  if (filteredSources.length > 0) {
    messages.push({
      role: "user",
      content: `Additional sources:\n${formatSourcesForPrompt(filteredSources)}`,
    });
  }

  if (!pageContext && wantsQuote) {
    const top = searchResults.items[0];
    if (top) {
      const page = await wikiService.getById(top.id);
      if (page) {
        const content = page.content ?? "";
        messages.push({
          role: "user",
          content: `Top result full content tail for exact quoting:\nTitle: ${page.title}\nPath: ${page.path}\nContent tail:\n${content.slice(
            -800
          )}`,
        });
      }
    } else if (sources[0]?.type === "chunk") {
      const topChunk = sources[0];
      messages.push({
        role: "user",
        content: `Top semantic source chunk for quoting:\nTitle: ${topChunk.title}\nPath: ${formatPath(
          topChunk.path
        )}\nContent:\n${topChunk.content}`,
      });
    }
  }

  messages.push({ role: "user", content: prompt });

  return runChatCompletion({ messages });
};

const buildRetrievalContext = async (prompt: string) => {
  const sources = await getChunkSourcesForPrompt(prompt);
  if (sources.length === 0) return "";
  return `Relevant wiki sources:\n${formatSourcesForPrompt(sources)}`;
};

const buildWriteContent = async (input: {
  prompt: string;
  page: { title: string; path: string; content: string | null };
}) => {
  const retrievalContext = await buildRetrievalContext(input.prompt);
  const sourcesBlock = retrievalContext ? `${retrievalContext}\n\n` : "";
  return runChatCompletion({
    messages: [
      {
        role: "user",
        content: `${sourcesBlock}Write new markdown content to add to the wiki page based on the request below. Return only the new content without commentary. Do not wrap the response in code fences.\n\nRequest:\n${input.prompt}\n\nPage title: ${input.page.title}\nPage path: ${input.page.path}\nExisting content:\n${input.page.content ?? ""}`,
      },
    ],
  });
};

const buildDraftContent = async (input: {
  path: string;
  title: string;
  context?: string;
}) => {
  const retrievalQuery =
    input.context?.trim() || `${input.title} ${input.path}`;
  const retrievalContext = await buildRetrievalContext(retrievalQuery);
  const sourcesBlock = retrievalContext ? `${retrievalContext}\n\n` : "";
  const context = input.context ? `Request:\n${input.context}\n\n` : "";
  return runChatCompletion({
    messages: [
      {
        role: "user",
        content: `${sourcesBlock}${context}Draft a new wiki page in markdown. Return only the content without explanations. Do not wrap the response in code fences.\nTitle: ${input.title}\nPath: ${input.path}`,
      },
    ],
  });
};

const buildReplacementContent = async (input: {
  prompt: string;
  target: string;
  page: { title: string; path: string; content: string | null };
}) =>
  runChatCompletion({
    messages: [
      {
        role: "user",
        content: `Replace the target paragraph based on the request below. Return ONLY the replacement paragraph text (no code fences, no commentary).\n\nRequest:\n${input.prompt}\n\nTarget paragraph:\n${input.target}\n\nPage title: ${input.page.title}\nPage path: ${input.page.path}\nPage content:\n${input.page.content ?? ""}`,
      },
    ],
  });

const resolvePageByPath = async (path: string) =>
  wikiService.getByPath(path.toLowerCase());

const collectTags = (page: {
  tags?: Array<{ tag?: { name?: string | null } | null }> | null;
}) =>
  page.tags
    ?.map((pageTag) => pageTag.tag?.name)
    .filter((tag): tag is string => Boolean(tag)) ?? [];

const requirePermission = async (userId: number, permission: string) => {
  const allowed = await authorizationService.hasPermission(
    userId,
    permission as any
  );
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't have the required permission: ${permission}`,
    });
  }
};

export const aiRouter = router({
  chat: permissionProtectedProcedure("wiki:page:read")
    .input(chatInputSchema)
    .mutation(async ({ input }) => {
      const response = await buildChatResponse(input.prompt, input.pageId);

      return { message: response };
    }),

  dispatch: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        pageId: z.number().optional(),
        mode: z.enum(["edit", "view"]).optional(),
        lastAssistantContent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const explicitPath = extractPath(input.prompt);
      const page =
        input.pageId !== undefined
          ? await wikiService.getById(input.pageId)
          : explicitPath
            ? await resolvePageByPath(explicitPath)
            : null;

      const action = await selectAIAction({
        prompt: input.prompt,
        pageContext: page ? { title: page.title, path: page.path } : undefined,
        explicitPath,
        hasAssistantContent: Boolean(input.lastAssistantContent?.trim()),
      });

      const userId = parseInt(ctx.session.user.id);
      const mode = input.mode ?? "view";
      const currentPath = page?.path?.replace(/^\/+/, "");
      const selectedPath =
        "path" in action.args && action.args.path
          ? action.args.path
          : explicitPath ?? undefined;
      const normalizedPath = selectedPath?.replace(/^\/+/, "").toLowerCase();
      const isCurrentPageTarget =
        Boolean(page) && (!normalizedPath || normalizedPath === currentPath);

      if (action.action === "draftPage") {
        await requirePermission(userId, "wiki:page:create");
        await assertAIWriteAllowed();

        const publishGenerated = await getSetting("ai.publishGeneratedPages");
        const path = (normalizedPath ?? slugify(action.args.title)).toLowerCase();
        const response = await buildDraftContent({
          path,
          title: action.args.title,
          context: input.prompt,
        });

        const aiUserId = await getAIUserId();
        const createdPage = await wikiService.create({
          path,
          title: action.args.title,
          content: response,
          isPublished: action.args.publish ?? publishGenerated,
          userId: aiUserId,
          editorType: "markdown",
          changeSummary: "AI draft: initial page creation",
        });

        return {
          action: action.action,
          page: {
            id: createdPage.id,
            path: createdPage.path,
            title: createdPage.title,
          },
          message: `Created draft page \"${createdPage.title}\" at /${createdPage.path}.`,
        };
      }

      if (action.action === "appendToPage") {
        await requirePermission(userId, "wiki:page:update");
        await assertAIWriteAllowed();

        const assistantContent = input.lastAssistantContent?.trim();
        if (!assistantContent) {
          return {
            action: action.action,
            message: "I don’t have any recent content to add to the page.",
          };
        }

        if (!page?.id && !normalizedPath) {
          return {
            action: action.action,
            message: "Please specify which page to update (e.g., “add that to /zen”).",
          };
        }

        if (isCurrentPageTarget && page?.id) {
          return {
            action: action.action,
            liveEdit: {
              content: assistantContent,
              mode: "append",
              path: currentPath,
            },
            message:
              mode === "edit"
                ? "Inserted the content into the editor. Review and save when ready."
                : "Writing to the page now. You can undo via page history.",
          };
        }

        const pageId = isCurrentPageTarget
          ? page?.id
          : (await resolvePageByPath(normalizedPath!))?.id;
        if (!pageId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const targetPage = await wikiService.getById(pageId);
        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const existingContent = targetPage.content ?? "";
        const nextContent = `${existingContent}${
          existingContent.trim() ? "\n\n" : ""
        }${assistantContent}\n`;

        const tags = collectTags(targetPage);
        const aiUserId = await getAIUserId();
        const updatedPage = await wikiService.update(targetPage.id, {
          path: targetPage.path,
          title: targetPage.title,
          content: nextContent,
          isPublished: targetPage.isPublished ?? false,
          editorType: targetPage.editorType ?? undefined,
          tags,
          userId: aiUserId,
          changeSummary: "AI edit: appended content",
        });

        return {
          action: action.action,
          page: {
            id: updatedPage.id,
            path: updatedPage.path,
            title: updatedPage.title,
          },
          message: `Added content to /${updatedPage.path}.`,
        };
      }

      if (action.action === "writeToPage") {
        await requirePermission(userId, "wiki:page:update");
        await assertAIWriteAllowed();

        if (!page?.id && !normalizedPath) {
          return {
            action: action.action,
            message: "Please specify which page to update (e.g., “write to /zen”).",
          };
        }

        const targetPage =
          page?.id && isCurrentPageTarget
            ? page
            : normalizedPath
              ? await resolvePageByPath(normalizedPath)
              : null;

        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const content = await buildWriteContent({
          prompt: input.prompt,
          page: {
            title: targetPage.title,
            path: targetPage.path,
            content: targetPage.content ?? "",
          },
        });

        if (isCurrentPageTarget && page?.id) {
          return {
            action: action.action,
            liveEdit: {
              content,
              mode: "append",
              path: currentPath,
            },
            message:
              mode === "edit"
                ? "Inserted the content into the editor. Review and save when ready."
                : "Writing to the page now. You can undo via page history.",
          };
        }

        const existingContent = targetPage.content ?? "";
        const nextContent = `${existingContent}${
          existingContent.trim() ? "\n\n" : ""
        }${content.trim()}\n`;

        const tags = collectTags(targetPage);
        const aiUserId = await getAIUserId();
        const updatedPage = await wikiService.update(targetPage.id, {
          path: targetPage.path,
          title: targetPage.title,
          content: nextContent,
          isPublished: targetPage.isPublished ?? false,
          editorType: targetPage.editorType ?? undefined,
          tags,
          userId: aiUserId,
          changeSummary: "AI edit: added content",
        });

        return {
          action: action.action,
          page: {
            id: updatedPage.id,
            path: updatedPage.path,
            title: updatedPage.title,
          },
          message: `Added content to /${updatedPage.path}.`,
        };
      }

      if (action.action === "removeFromPage") {
        await requirePermission(userId, "wiki:page:update");
        await assertAIWriteAllowed();

        if (!action.args.text) {
          return {
            action: action.action,
            message: "Please specify the line or text to remove.",
          };
        }

        if (!page?.id && !normalizedPath) {
          return {
            action: action.action,
            message: "Please specify which page to update (e.g., “remove from /zen”).",
          };
        }

        const targetPage =
          page?.id && isCurrentPageTarget
            ? page
            : normalizedPath
              ? await resolvePageByPath(normalizedPath)
              : null;

        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const target = action.args.text.trim();
        const content = targetPage.content ?? "";
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .replace(/[`*_~>#\[\]\(\)-]+/g, " ")
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const normalizedTarget = normalize(target);
        const lines = content.split(/\r?\n/);
        let filtered = lines.filter(
          (line) => normalize(line) !== normalizedTarget
        );

        if (filtered.length === lines.length) {
          filtered = lines.filter(
            (line) => !normalize(line).includes(normalizedTarget)
          );
        }

        let nextContent = filtered.join("\n").trimEnd() + "\n";

        if (filtered.length === lines.length) {
          const normalizedContent = normalize(content);
          if (normalizedContent.includes(normalizedTarget)) {
            const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const flexible = escaped.replace(/\s+/g, "\\s+");
            const regex = new RegExp(flexible, "i");
            nextContent = content.replace(regex, "").trimEnd() + "\n";
          }
        }

        if (filtered.length === lines.length && nextContent === content) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Text not found on page.",
          });
        }

        const tags = collectTags(targetPage);
        const aiUserId = await getAIUserId();
        const updatedPage = await wikiService.update(targetPage.id, {
          path: targetPage.path,
          title: targetPage.title,
          content: nextContent,
          isPublished: targetPage.isPublished ?? false,
          editorType: targetPage.editorType ?? undefined,
          tags,
          userId: aiUserId,
          changeSummary: "AI edit: removed line",
        });

        return {
          action: action.action,
          page: {
            id: updatedPage.id,
            path: updatedPage.path,
            title: updatedPage.title,
          },
          liveEdit:
            isCurrentPageTarget && mode !== "edit"
              ? {
                  content: nextContent,
                  mode: "replace",
                  path: currentPath,
                }
              : undefined,
          message: `Removed the line from /${updatedPage.path}. You can undo in history.`,
        };
      }

      if (action.action === "replaceInPage") {
        await requirePermission(userId, "wiki:page:update");
        await assertAIWriteAllowed();

        if (!action.args.target) {
          return {
            action: action.action,
            message: "Please specify the paragraph or text to replace.",
          };
        }

        if (!page?.id && !normalizedPath) {
          return {
            action: action.action,
            message:
              "Please specify which page to update (e.g., “edit that paragraph on /zen”).",
          };
        }

        const targetPage =
          page?.id && isCurrentPageTarget
            ? page
            : normalizedPath
              ? await resolvePageByPath(normalizedPath)
              : null;

        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const target = action.args.target.trim();
        const replacement =
          action.args.replacement?.trim() ??
          (await buildReplacementContent({
            prompt: input.prompt,
            target,
            page: {
              title: targetPage.title,
              path: targetPage.path,
              content: targetPage.content ?? "",
            },
          })).trim();

        const content = targetPage.content ?? "";
        let nextContent = content;

        if (content.includes(target)) {
          nextContent = content.replace(target, replacement);
        } else {
          const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const flexible = escaped.replace(/\s+/g, "\\s+");
          const regex = new RegExp(flexible, "i");
          if (regex.test(content)) {
            nextContent = content.replace(regex, replacement);
          } else {
            return {
              action: action.action,
              message:
                "I couldn’t find that exact paragraph on the page. Please quote it or paste the exact text to replace.",
            };
          }
        }

        const tags = collectTags(targetPage);
        const aiUserId = await getAIUserId();
        const updatedPage = await wikiService.update(targetPage.id, {
          path: targetPage.path,
          title: targetPage.title,
          content: nextContent,
          isPublished: targetPage.isPublished ?? false,
          editorType: targetPage.editorType ?? undefined,
          tags,
          userId: aiUserId,
          changeSummary: "AI edit: replaced paragraph",
        });

        return {
          action: action.action,
          page: {
            id: updatedPage.id,
            path: updatedPage.path,
            title: updatedPage.title,
          },
          liveEdit:
            isCurrentPageTarget && mode !== "edit"
              ? {
                  content: nextContent,
                  mode: "replace",
                  path: currentPath,
                }
              : undefined,
          message: `Updated the paragraph on /${updatedPage.path}.`,
        };
      }

      if (action.action === "summarizePage") {
        await requirePermission(userId, "wiki:page:read");
        const targetPage =
          page?.id && isCurrentPageTarget
            ? page
            : normalizedPath
              ? await resolvePageByPath(normalizedPath)
              : null;

        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const response = await runChatCompletion({
          messages: [
            {
              role: "user",
              content: `Summarize this wiki page in 5-7 bullet points:\nTitle: ${targetPage.title}\nPath: ${targetPage.path}\nContent:\n${targetPage.content ?? ""}`,
            },
          ],
        });

        return { action: action.action, message: response };
      }

      if (action.action === "improvePage") {
        await requirePermission(userId, "wiki:page:update");
        await assertAIWriteAllowed();
        const targetPage =
          page?.id && isCurrentPageTarget
            ? page
            : normalizedPath
              ? await resolvePageByPath(normalizedPath)
              : null;

        if (!targetPage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
        }

        const goals = action.args.goals
          ? `Goals:\n${action.args.goals}\n\n`
          : "";
        const retrievalQuery = [
          action.args.goals,
          input.prompt,
          targetPage.title,
        ]
          .filter(Boolean)
          .join(" ");
        const retrievalContext = await buildRetrievalContext(retrievalQuery);
        const sourcesBlock = retrievalContext ? `${retrievalContext}\n\n` : "";

        const response = await runChatCompletion({
          messages: [
            {
              role: "user",
              content: `${sourcesBlock}${goals}Improve the following wiki page. Return only the updated content in the same format, without explanations. Do not wrap the response in code fences.\nTitle: ${targetPage.title}\nPath: ${targetPage.path}\nContent:\n${targetPage.content ?? ""}`,
            },
          ],
        });

        const tags = collectTags(targetPage);
        const aiUserId = await getAIUserId();
        const updatedPage = await wikiService.update(targetPage.id, {
          path: targetPage.path,
          title: targetPage.title,
          content: response,
          isPublished: targetPage.isPublished ?? false,
          editorType: targetPage.editorType ?? undefined,
          tags,
          userId: aiUserId,
          changeSummary: "AI edit: improved content",
        });

        return {
          action: action.action,
          page: {
            id: updatedPage.id,
            path: updatedPage.path,
            title: updatedPage.title,
          },
          message:
            "The page was updated with AI-generated improvements. Review the history for details.",
        };
      }

      await requirePermission(userId, "wiki:page:read");
      const response = await buildChatResponse(input.prompt, input.pageId);

      return { action: "chat", message: response };
    }),

  summarizePage: permissionProtectedProcedure("wiki:page:read")
    .input(z.object({ pageId: z.number() }))
    .mutation(async ({ input }) => {
      const page = await wikiService.getById(input.pageId);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `Summarize this wiki page in 5-7 bullet points:\nTitle: ${page.title}\nPath: ${page.path}\nContent:\n${page.content ?? ""}`,
          },
        ],
      });

      return { summary: response };
    }),

  improvePage: permissionProtectedProcedure("wiki:page:update")
    .input(z.object({ pageId: z.number(), goals: z.string().optional() }))
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      const page = await wikiService.getById(input.pageId);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const goals = input.goals
        ? `Goals:\n${input.goals}\n\n`
        : "";
      const retrievalQuery = [input.goals, page.title].filter(Boolean).join(" ");
      const retrievalContext = await buildRetrievalContext(retrievalQuery);
      const sourcesBlock = retrievalContext ? `${retrievalContext}\n\n` : "";

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `${sourcesBlock}${goals}Improve the following wiki page. Return only the updated content in the same format, without explanations. Do not wrap the response in code fences.\nTitle: ${page.title}\nPath: ${page.path}\nContent:\n${page.content ?? ""}`,
          },
        ],
      });

      const tags =
        page.tags
          ?.map((pageTag) => pageTag.tag?.name)
          .filter((tag): tag is string => Boolean(tag)) ?? [];

      const aiUserId = await getAIUserId();
      const updatedPage = await wikiService.update(page.id, {
        path: page.path,
        title: page.title,
        content: response,
        isPublished: page.isPublished ?? false,
        editorType: page.editorType ?? undefined,
        tags,
        userId: aiUserId,
        changeSummary: "AI edit: improved content",
      });

      return { page: updatedPage };
    }),

  appendToPage: permissionProtectedProcedure("wiki:page:update")
    .input(
      z.object({
        pageId: z.number().optional(),
        path: z.string().optional(),
        content: z.string().min(1),
        changeSummary: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      if (!input.pageId && !input.path) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing pageId or path.",
        });
      }

      let pageId = input.pageId;
      if (!pageId && input.path) {
        const resolved = await db.query.wikiPages.findFirst({
          where: eq(wikiPages.path, input.path),
          columns: { id: true },
        });
        if (!resolved?.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
        pageId = resolved.id;
      }

      const page = await wikiService.getById(pageId!);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const existingContent = page.content ?? "";
      const nextContent = `${existingContent}${
        existingContent.trim() ? "\n\n" : ""
      }${input.content.trim()}\n`;

      const tags =
        page.tags
          ?.map((pageTag) => pageTag.tag?.name)
          .filter((tag): tag is string => Boolean(tag)) ?? [];

      const aiUserId = await getAIUserId();
      const updatedPage = await wikiService.update(page.id, {
        path: page.path,
        title: page.title,
        content: nextContent,
        isPublished: page.isPublished ?? false,
        editorType: page.editorType ?? undefined,
        tags,
        userId: aiUserId,
        changeSummary: input.changeSummary ?? "AI edit: appended content",
      });

      return { page: updatedPage };
    }),

  writeToPage: permissionProtectedProcedure("wiki:page:update")
    .input(
      z.object({
        pageId: z.number().optional(),
        path: z.string().optional(),
        prompt: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      if (!input.pageId && !input.path) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing pageId or path.",
        });
      }

      let pageId = input.pageId;
      if (!pageId && input.path) {
        const resolved = await db.query.wikiPages.findFirst({
          where: eq(wikiPages.path, input.path),
          columns: { id: true },
        });
        if (!resolved?.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
        pageId = resolved.id;
      }

      const page = await wikiService.getById(pageId!);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const response = await buildWriteContent({
        prompt: input.prompt,
        page,
      });

      const existingContent = page.content ?? "";
      const nextContent = `${existingContent}${
        existingContent.trim() ? "\n\n" : ""
      }${response.trim()}\n`;

      const tags =
        page.tags
          ?.map((pageTag) => pageTag.tag?.name)
          .filter((tag): tag is string => Boolean(tag)) ?? [];

      const aiUserId = await getAIUserId();
      const updatedPage = await wikiService.update(page.id, {
        path: page.path,
        title: page.title,
        content: nextContent,
        isPublished: page.isPublished ?? false,
        editorType: page.editorType ?? undefined,
        tags,
        userId: aiUserId,
        changeSummary: "AI edit: added content",
      });

      return { page: updatedPage };
    }),

  generateContent: permissionProtectedProcedure("wiki:page:update")
    .input(
      z.object({
        pageId: z.number().optional(),
        path: z.string().optional(),
        prompt: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      if (!input.pageId && !input.path) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing pageId or path.",
        });
      }

      let pageId = input.pageId;
      if (!pageId && input.path) {
        const resolved = await db.query.wikiPages.findFirst({
          where: eq(wikiPages.path, input.path),
          columns: { id: true },
        });
        if (!resolved?.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
        pageId = resolved.id;
      }

      const page = await wikiService.getById(pageId!);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const response = await buildWriteContent({
        prompt: input.prompt,
        page,
      });

      return { content: response };
    }),

  removeFromPage: permissionProtectedProcedure("wiki:page:update")
    .input(
      z.object({
        pageId: z.number().optional(),
        path: z.string().optional(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      if (!input.pageId && !input.path) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing pageId or path.",
        });
      }

      let pageId = input.pageId;
      if (!pageId && input.path) {
        const resolved = await db.query.wikiPages.findFirst({
          where: eq(wikiPages.path, input.path),
          columns: { id: true },
        });
        if (!resolved?.id) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found.",
          });
        }
        pageId = resolved.id;
      }

      const page = await wikiService.getById(pageId!);
      if (!page) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Page not found." });
      }

      const target = input.text.trim();
      const content = page.content ?? "";

      const normalize = (value: string) =>
        value
          .toLowerCase()
          .replace(/[`*_~>#\[\]\(\)-]+/g, " ")
          .replace(/[^\w\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const normalizedTarget = normalize(target);
      const lines = content.split(/\r?\n/);
      let filtered = lines.filter(
        (line) => normalize(line) !== normalizedTarget
      );

      if (filtered.length === lines.length) {
        filtered = lines.filter(
          (line) => !normalize(line).includes(normalizedTarget)
        );
      }

      let nextContent = filtered.join("\n").trimEnd() + "\n";

      if (filtered.length === lines.length) {
        const normalizedContent = normalize(content);
        if (normalizedContent.includes(normalizedTarget)) {
          const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const flexible = escaped.replace(/\s+/g, "\\s+");
          const regex = new RegExp(flexible, "i");
          nextContent = content.replace(regex, "").trimEnd() + "\n";
        }
      }

      if (filtered.length === lines.length && nextContent === content) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Text not found on page.",
        });
      }

      const tags =
        page.tags
          ?.map((pageTag) => pageTag.tag?.name)
          .filter((tag): tag is string => Boolean(tag)) ?? [];

      const aiUserId = await getAIUserId();
      const updatedPage = await wikiService.update(page.id, {
        path: page.path,
        title: page.title,
        content: nextContent,
        isPublished: page.isPublished ?? false,
        editorType: page.editorType ?? undefined,
        tags,
        userId: aiUserId,
        changeSummary: "AI edit: removed line",
      });

      return { page: updatedPage, content: nextContent };
    }),

  draftPage: permissionProtectedProcedure("wiki:page:create")
    .input(
      z.object({
        path: z.string().min(1),
        title: z.string().min(1),
        context: z.string().optional(),
        publish: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      const response = await buildDraftContent({
        path: input.path,
        title: input.title,
        context: input.context,
      });

      const aiUserId = await getAIUserId();
      const page = await wikiService.create({
        path: input.path,
        title: input.title,
        content: response,
        isPublished: input.publish ?? false,
        userId: aiUserId,
        editorType: "markdown",
        changeSummary: "AI draft: initial page creation",
      });

      return { page, content: response };
    }),

  createPageFromContent: permissionProtectedProcedure("wiki:page:create")
    .input(
      z.object({
        path: z.string().min(1),
        title: z.string().min(1),
        content: z.string().min(1),
        publish: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      const aiUserId = await getAIUserId();
      const page = await wikiService.create({
        path: input.path,
        title: input.title,
        content: input.content,
        isPublished: input.publish ?? false,
        userId: aiUserId,
        editorType: "markdown",
        changeSummary: "AI draft: initial page creation",
      });

      return { page };
    }),
});
