import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, permissionProtectedProcedure } from "..";
import {
  assertAIWriteAllowed,
  getAIUserId,
  runChatCompletion,
} from "~/lib/services/ai";
import { searchService } from "~/lib/services/search";
import { wikiService } from "~/lib/services";
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

const wantsExactQuote = (prompt: string) =>
  /exact words|verbatim|quote|bottom|end of (the )?page|last (line|lines|paragraph)/i.test(
    prompt
  );

export const aiRouter = router({
  chat: permissionProtectedProcedure("wiki:page:read")
    .input(chatInputSchema)
    .mutation(async ({ input }) => {
      const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = [];

      messages.push({
        role: "system",
        content:
          "Use provided sources when answering. If sources are missing or irrelevant, say you could not find a matching page. When possible, provide wiki links as /path.",
      });

      const explicitPath = extractPath(input.prompt);
      const wantsQuote = wantsExactQuote(input.prompt);

      if (input.pageId || explicitPath) {
        const page = input.pageId
          ? await wikiService.getById(input.pageId)
          : await db.query.wikiPages.findFirst({
              where: eq(wikiPages.path, explicitPath!),
            });

        if (page) {
          const content = page.content ?? "";
          const tail = wantsQuote ? content.slice(-800) : content;
          messages.push({
            role: "user",
            content: `Context page:\nTitle: ${page.title}\nPath: ${page.path}\nContent:\n${tail}`,
          });
        }
      } else {
        const searchResults = await searchService.searchPaginated(input.prompt, {
          page: 1,
          pageSize: 3,
        });

        if (searchResults.items.length > 0) {
          const sources = searchResults.items
            .map(
              (item, index) =>
                `${index + 1}. ${item.title} (/` +
                `${item.path})\nExcerpt: ${item.excerpt}`
            )
            .join("\n\n");

          messages.push({
            role: "user",
            content: `Search results:\n${sources}`,
          });

          if (wantsQuote) {
            const top = searchResults.items[0];
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
          }
        }
      }

      messages.push({ role: "user", content: input.prompt });

      const response = await runChatCompletion({ messages });

      return { message: response };
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

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `${goals}Improve the following wiki page. Return only the updated content in the same format, without explanations.\nTitle: ${page.title}\nPath: ${page.path}\nContent:\n${page.content ?? ""}`,
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

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `Write new markdown content to add to the wiki page based on the request below. Return only the new content without commentary.\n\nRequest:\n${input.prompt}\n\nPage title: ${page.title}\nPage path: ${page.path}\nExisting content:\n${page.content ?? ""}`,
          },
        ],
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

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `Write new markdown content to add to the wiki page based on the request below. Return only the new content without commentary.\n\nRequest:\n${input.prompt}\n\nPage title: ${page.title}\nPage path: ${page.path}\nExisting content:\n${page.content ?? ""}`,
          },
        ],
      });

      return { content: response };
    }),

  draftPage: permissionProtectedProcedure("wiki:page:create")
    .input(
      z.object({
        path: z.string().min(1),
        title: z.string().min(1),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await assertAIWriteAllowed();
      const context = input.context
        ? `Context:\n${input.context}\n\n`
        : "";

      const response = await runChatCompletion({
        messages: [
          {
            role: "user",
            content: `${context}Draft a new wiki page in markdown. Return only the content without explanations.\nTitle: ${input.title}\nPath: ${input.path}`,
          },
        ],
      });

      const aiUserId = await getAIUserId();
      const page = await wikiService.create({
        path: input.path,
        title: input.title,
        content: response,
        isPublished: false,
        userId: aiUserId,
        editorType: "markdown",
        changeSummary: "AI draft: initial page creation",
      });

      return { page };
    }),
});
