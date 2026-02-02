import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { desc, eq, gt, and, sql, ilike, or } from "drizzle-orm";
import { db, wikiPages } from "@repo/db";
import {
  permissionGuestProcedure,
  permissionProtectedProcedure,
  publicProcedure,
  router,
} from "..";
import { dbService, wikiService } from "~/lib/services";
import { logger } from "@repo/logger";
import { compareRevisions, getChangeSummary } from "~/lib/services/revision-diff";
import { wikiPageRevisions } from "@repo/db";

// Wiki page input validation schema
const pageInputSchema = z.object({
  path: z.string().min(1).max(1000),
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Define User schema for output (based on users table)
const userOutputSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  email: z.string().email(), // Kept email, adjust if needed
  image: z.string().nullable(),
  // Omitting password, emailVerified, createdAt, updatedAt for this output
});

// Define Tag schema for output (based on tags table)
const tagOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  // Omitting createdAt
});

// Define WikiPageTag relation schema (based on wikiPageTags table and relations)
const wikiPageTagOutputSchema = z.object({
  // Assuming the relation loads the tag directly
  tag: tagOutputSchema,
  // Omitting pageId, tagId, createdAt from the join table itself
});

// Define the output schema for getByPath (based on wikiPages table and relations)
const wikiPageDetailedOutputSchema = z.object({
  id: z.number(),
  path: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  renderedHtml: z.string().nullable(),
  editorType: z.enum(["markdown", "html"]).nullable(),
  isPublished: z.boolean().nullable(),
  createdAt: z.date().nullable(),
  updatedAt: z.date().nullable(),
  renderedHtmlUpdatedAt: z.date().nullable(),
  // search: tsvector - Cannot easily represent tsvector in Zod/JSON, omitting
  createdById: z.number().nullable(),
  updatedById: z.number().nullable(),
  lockedById: z.number().nullable(),
  lockedAt: z.date().nullable(),
  lockExpiresAt: z.date().nullable(),
  // Relations included in the query
  createdBy: userOutputSchema.nullable(),
  updatedBy: userOutputSchema.nullable(),
  lockedBy: userOutputSchema.nullable(),
  tags: z.array(wikiPageTagOutputSchema),
});

// Define output schema for pageExists
const pageExistsOutputSchema = z.object({ exists: z.boolean() });

// Define a specific output schema for the create endpoint (omitting some IDs)
const wikiPageCreateOutputSchema = wikiPageDetailedOutputSchema.omit({
  createdById: true,
  updatedById: true,
  lockedById: true,
});

// Define a specific output schema for pages returned by lock operations
const wikiPageLockOutputSchema = wikiPageDetailedOutputSchema.omit({
  tags: true,
  createdBy: true,
  updatedBy: true,
  lockedBy: true,
});

// Define a specific output schema for the list endpoint
const wikiPageListOutputSchema = wikiPageDetailedOutputSchema.omit({
  content: true,
  renderedHtml: true,
  renderedHtmlUpdatedAt: true,
  createdById: true,
  updatedById: true,
  lockedById: true,
  createdBy: true,
});

// Define the overall output schema for the list endpoint
const listOutputSchema = z.object({
  pages: z.array(wikiPageListOutputSchema),
  nextCursor: z.number().optional(),
});

// Define a specific output schema for the delete endpoint (includes search)
const wikiPageDeleteOutputSchema = wikiPageLockOutputSchema.extend({
  // .returning() likely includes the search column, even if tsvector
  search: z.string().nullable(),
});

// --- End Zod Schemas ---

export const wikiRouter = router({
  randomNumber: publicProcedure.subscription(async function* (opts?) {
    let idx = 0;
    logger.log("Starting randomNumber subscription...");
    const signal = opts?.signal;

    while (true) {
      if (signal?.aborted) {
        logger.log("Subscription aborted by client.");
        break;
      }

      yield { randomNumber: Math.random(), completed: idx >= 10 };
      idx++;

      if (idx > 10) {
        logger.log("Subscription completing normally (10 iterations).");
        return;
      }

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 500);
          if (signal) {
            signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              reject(new Error("Subscription aborted during wait."));
            });
          }
        });
      } catch (error: unknown) {
        if (
          signal?.aborted ||
          (error instanceof Error && error.message.includes("aborted"))
        ) {
          logger.log("Subscription aborted during 500ms wait.");
          break;
        }
        logger.error("Unexpected error during wait:", error);
        throw error;
      }
    }
  }),

  // Get a page by path
  getByPath: permissionGuestProcedure("wiki:page:read")
    .meta({
      description: "Fetches a specific wiki page by its full path.",
      openapi: {
        method: "GET",
        path: "/wiki/pages/{path}",
        protect: false,
        summary: "Get wiki page by path",
        tags: ["wiki"],
      },
    })
    .input(
      z.object({
        path: z
          .string()
          .describe(
            "The full path to the wiki page (e.g., 'folder/subfolder/page-name')"
          ),
      })
    )
    .output(wikiPageDetailedOutputSchema)
    .query(async ({ input }) => {
      const page = await db.query.wikiPages.findFirst({
        where: eq(wikiPages.path, input.path),
        with: {
          createdBy: true,
          updatedBy: true,
          lockedBy: true,
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      if (!page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return page;
    }),

  // Check if a page exists at a path without throwing an error
  pageExists: permissionProtectedProcedure("wiki:page:read")
    .meta({
      openapi: {
        method: "GET",
        path: "/wiki/pages/exists",
        protect: true,
        summary: "Check if wiki page exists by path",
        tags: ["wiki"],
      },
    })
    .input(z.object({ path: z.string() }))
    .output(pageExistsOutputSchema)
    .query(async ({ input }) => {
      const page = await db.query.wikiPages.findFirst({
        where: eq(wikiPages.path, input.path),
        columns: { id: true },
      });

      return { exists: !!page };
    }),

  // Create a new page
  create: permissionProtectedProcedure("wiki:page:create")
    .meta({
      openapi: {
        method: "POST",
        path: "/wiki/pages",
        protect: true,
        summary: "Create a new wiki page",
        tags: ["wiki"],
      },
    })
    .input(pageInputSchema)
    .output(wikiPageCreateOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { path, title, content, isPublished, tags } = input;
      const userId = parseInt(ctx.session.user.id);

      // Let the service handle the page creation and tag associations
      const createdPage = await wikiService.create({
        path,
        title,
        content,
        isPublished: isPublished ?? false,
        userId,
        tags,
      });

      if (!createdPage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create page",
        });
      }

      // Re-fetch the page using the cleaned-up service method
      const page = await wikiService.getById(createdPage.id);
      if (!page) {
        // Should not happen, but handle defensively
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created page",
        });
      }
      return page; // Return the cleaned-up page data
    }),

  // Acquire a lock on a page for editing
  acquireLock: permissionProtectedProcedure("wiki:page:update")
    .meta({
      openapi: {
        method: "POST",
        path: "/wiki/pages/{id}/acquire-lock",
        protect: true,
        summary: "Acquire edit lock on a wiki page",
        tags: ["wiki"],
      },
    })
    .input(z.object({ id: z.number() }))
    .output(
      z.union([
        // Success case
        z.object({
          success: z.literal(true),
          // Page can potentially be null even on success according to types
          page: wikiPageLockOutputSchema.nullable(),
        }),
        // Failure case (already locked)
        z.object({
          success: z.literal(false),
          // Use the lock-specific page schema
          page: wikiPageLockOutputSchema,
          lockOwner: z.string(),
        }),
        // Note: The NOT_FOUND case throws an error, so it's not part of the success output schema
      ])
    )
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const userId = parseInt(ctx.session.user.id);

      // Try to acquire a lock - this will use hardware locks briefly
      // but will set up a software lock with timeout for the editing session
      const { success, page } = await dbService.locks.acquireLock(id, userId);

      if (!success) {
        // If page is null, it doesn't exist
        if (!page) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found",
          });
        }

        // Get current lock owner info from UI metadata
        const lockedByUser = page.lockedById
          ? await dbService.users.getById(page.lockedById)
          : null;

        // Instead of throwing an error, return the unsuccessful result with page info
        // This allows the client to handle the case more gracefully
        return {
          success: false,
          page,
          lockOwner: lockedByUser?.name || "another user",
        };
      }

      // Return the page with the software lock
      return {
        success: true,
        page,
      };
    }),

  // Release a software lock on a page
  releaseLock: permissionProtectedProcedure("wiki:page:update")
    .meta({
      openapi: {
        method: "POST",
        path: "/wiki/pages/{id}/release-lock",
        protect: true,
        summary: "Release edit lock on a wiki page",
        tags: ["wiki"],
      },
    })
    .input(z.object({ id: z.number() }))
    .output(wikiPageLockOutputSchema) // Output schema without relations
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const userId = parseInt(ctx.session.user.id);

      // Release the software lock if owned by this user
      const success = await dbService.locks.releaseLock(id, userId);

      if (!success) {
        logger.warn(
          `Lock for page ${id} could not be released - may be held by a different user`
        );
      }

      // Get the updated page
      const page = await db.query.wikiPages.findFirst({
        where: eq(wikiPages.id, id),
      });

      if (!page) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      return page;
    }),

  // Refresh a software lock to prevent timeout
  refreshLock: permissionProtectedProcedure("wiki:page:update")
    .meta({
      openapi: {
        method: "POST",
        path: "/wiki/pages/{id}/refresh-lock",
        protect: true,
        summary: "Refresh edit lock on a wiki page",
        tags: ["wiki"],
      },
    })
    .input(z.object({ id: z.number() }))
    .output(z.object({ page: wikiPageLockOutputSchema.nullable() }))
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const userId = parseInt(ctx.session.user.id);

      // Check if the lock is still valid and refresh it
      const { success, page } = await dbService.locks.refreshLock(id, userId);

      if (!success) {
        if (!page) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found",
          });
        }

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You no longer hold the lock on this page",
        });
      }

      return {
        page,
      };
    }),

  // Update an existing page
  update: permissionProtectedProcedure("wiki:page:update")
    .meta({
      openapi: {
        method: "PUT",
        path: "/wiki/pages/{id}",
        protect: true,
        summary: "Update an existing wiki page",
        tags: ["wiki"],
      },
    })
    .input(
      pageInputSchema.extend({
        id: z.number(),
      })
    )
    .output(wikiPageCreateOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, path, title, content, isPublished, tags } = input;
      const userId = parseInt(ctx.session.user.id);

      // First, check if the user has a valid software lock
      const { isLocked, lockedByUserId } = await dbService.locks.isLocked(id);

      if (isLocked && lockedByUserId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This page is currently being edited by another user",
        });
      }

      try {
        // Use the service method which now handles tags as well
        const updatedPageRaw = await wikiService.update(id, {
          path,
          title,
          content,
          isPublished,
          userId,
          tags,
        });

        if (!updatedPageRaw) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update page",
          });
        }

        // Re-fetch the page using the cleaned-up service method
        const page = await wikiService.getById(updatedPageRaw.id);
        if (!page) {
          // Should not happen, but handle defensively
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve updated page",
          });
        }
        return page; // Return the cleaned-up page data
      } catch (error) {
        logger.error("Failed to update page:", error);

        if (
          error instanceof Error &&
          error.message.includes("could not obtain lock")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Could not update page because it's locked by another process",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update page",
        });
      }
    }),

  // List pages (paginated) with lock information
  list: permissionGuestProcedure("wiki:page:read")
    .meta({
      openapi: {
        method: "GET",
        path: "/wiki/pages",
        protect: false,
        summary: "List wiki pages (paginated)",
        tags: ["wiki"],
      },
    })
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        cursor: z.number().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["title", "updatedAt"]).optional().default("updatedAt"),
        sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
        showLockedOnly: z.boolean().optional().default(false),
      })
    )
    .output(listOutputSchema)
    .query(async ({ input }) => {
      const { limit, cursor, search, sortBy, sortOrder, showLockedOnly } =
        input;

      // Build conditions
      let whereConditions = undefined;

      // Handle cursor pagination
      if (cursor) {
        whereConditions = gt(wikiPages.id, cursor);
      }

      // Handle search
      if (search) {
        const searchCondition = or(
          ilike(wikiPages.title, `%${search}%`),
          ilike(wikiPages.title, `%${search}`),
          ilike(wikiPages.title, `${search}%`)
        );
        whereConditions = whereConditions
          ? and(whereConditions, searchCondition)
          : searchCondition;
      }

      // Handle locked pages filter - note this will now just show UI locks
      // not the actual advisory locks
      if (showLockedOnly) {
        const lockCondition = sql`${wikiPages.lockedById} IS NOT NULL`;
        whereConditions = whereConditions
          ? and(whereConditions, lockCondition)
          : lockCondition;
      }

      // Dynamic ordering based on sortBy and sortOrder
      const orderByColumn =
        sortBy === "title" ? wikiPages.title : wikiPages.updatedAt;
      const orderBy = sortOrder === "asc" ? orderByColumn : desc(orderByColumn);

      // Execute query with conditions, ordering, and limit
      const results = await db.query.wikiPages.findMany({
        where: whereConditions,
        orderBy: [orderBy],
        limit: limit + 1,
        columns: {
          id: true,
          path: true,
          title: true,
          content: false,
          renderedHtml: false,
          editorType: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
          renderedHtmlUpdatedAt: false,
          search: false,
          lockedById: false,
          createdById: false,
          updatedById: false,
          lockedAt: true,
          lockExpiresAt: true,
        },
        with: {
          updatedBy: {
            columns: { id: true, name: true, email: true, image: true },
          },
          lockedBy: {
            columns: { id: true, name: true, email: true, image: true },
          },
          tags: {
            with: {
              tag: true,
            },
          },
        },
      });

      // Handle pagination
      let nextCursor: typeof cursor | undefined = undefined;
      const pages = [...results];

      if (pages.length > limit) {
        const nextPage = pages.pop();
        nextCursor = nextPage?.id;
      }

      return {
        pages,
        nextCursor,
      };
    }),

  // Delete a page
  delete: permissionProtectedProcedure("wiki:page:delete")
    .meta({
      openapi: {
        method: "DELETE",
        path: "/wiki/pages/{id}",
        protect: true,
        summary: "Delete a wiki page",
        tags: ["wiki"],
      },
    })
    // Use the specific delete output schema, potentially nullable
    .input(z.object({ id: z.number() }))
    .output(wikiPageDeleteOutputSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const { id } = input;
      const userId = parseInt(ctx.session.user.id);

      // First, check if the user has a valid software lock
      const { isLocked, lockedByUserId } = await dbService.locks.isLocked(id);

      if (isLocked && lockedByUserId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This page is currently being edited by another user",
        });
      }

      // Use a transaction with a hardware lock for the delete operation
      try {
        return await db.transaction(async (tx) => {
          // Set a short timeout for the hardware lock operation
          await tx.execute(sql`SET LOCAL statement_timeout = 3000`);

          // Acquire a hardware lock for the deletion
          const result = await tx.execute(
            sql`SELECT * FROM wiki_pages WHERE id = ${id} FOR UPDATE NOWAIT`
          );

          if (result.rows.length === 0) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Page not found",
            });
          }

          // Delete the page
          const [deleted] = await tx
            .delete(wikiPages)
            .where(eq(wikiPages.id, id))
            .returning();

          // Explicitly return null if deleted is undefined/falsy to match nullable schema
          return deleted || null;
        });
      } catch (error) {
        logger.error("Failed to delete page:", error);

        if (
          error instanceof Error &&
          error.message.includes("could not obtain lock")
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Could not delete page because it's locked by another process",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete page",
        });
      }
    }),

  // Get folder structure
  getFolderStructure: permissionGuestProcedure("wiki:page:read")
    .input(z.void())
    .query(async () => {
      // Get all pages from database
      const pages = await db.query.wikiPages.findMany({
        orderBy: [wikiPages.path],
        columns: {
          id: true,
          path: true,
          title: true,
          updatedAt: true,
          isPublished: true,
        },
      });

      // Build folder structure
      const folderStructure = buildFolderStructure(pages);
      return folderStructure;
    }),

  // Get subfolders for a specific path
  getSubfolders: permissionGuestProcedure("wiki:page:read")
    .input(
      z.object({
        path: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const parentPath = input.path || "";

      // Get all pages from database
      const pages = await db.query.wikiPages.findMany({
        orderBy: [wikiPages.path],
        columns: {
          id: true,
          path: true,
          title: true,
          updatedAt: true,
          isPublished: true,
        },
      });

      // Filter pages by parent path and extract unique direct subfolders
      const subfolders = getSubfoldersForPath(pages, parentPath);
      return subfolders;
    }),

  // Move or rename pages
  movePages: permissionProtectedProcedure("wiki:page:move")
    .input(
      z.object({
        pageIds: z.array(z.number()),
        sourcePath: z.string(),
        targetPath: z.string(),
        operation: z.enum(["move", "rename"]),
        recursive: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { pageIds, sourcePath, targetPath, operation, recursive } = input;
      const userId = parseInt(ctx.session.user.id);

      try {
        // Call the service function instead of implementing the logic here
        const updatedPages = await wikiService.movePages({
          pageIds,
          sourcePath,
          targetPath,
          operation,
          recursive,
          userId,
        });

        return updatedPages;
      } catch (error) {
        // Convert service errors to tRPC errors for proper client-side handling
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: error.message,
            });
          } else if (error.message.includes("locked by another user")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: error.message,
            });
          } else if (error.message.includes("already exists")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: error.message,
            });
          } else if (error.message.includes("Failed to acquire lock")) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Page is locked by another process",
            });
          }
        }

        // Default error handling
        logger.error("Error in movePages:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
        });
      }
    }),

  // Create a new folder (this actually creates an empty index page in the folder)
  createFolder: permissionProtectedProcedure("wiki:page:create")
    .input(
      z.object({
        path: z.string().min(1),
        title: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { path, title } = input;
      const userId = parseInt(ctx.session.user.id);

      // Create directly at the given path, not as an index page
      const folderPath = path.endsWith("/") ? path.slice(0, -1) : path;

      // Check if the page already exists
      const existingPage = await db.query.wikiPages.findFirst({
        where: eq(wikiPages.path, folderPath),
      });

      if (existingPage) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A page already exists at path: ${folderPath}`,
        });
      }

      // Create the page at the requested path
      const [createdFolderPage] = await db
        .insert(wikiPages)
        .values({
          path: folderPath,
          title: title,
          content: `# ${title}\n\n`,
          isPublished: true,
          createdById: userId,
          updatedById: userId,
        })
        .returning();

      if (!createdFolderPage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create folder page",
        });
      }

      // Re-fetch the page using the cleaned-up service method
      const page = await wikiService.getById(createdFolderPage.id);
      if (!page) {
        // Should not happen, but handle defensively
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created folder page",
        });
      }
      return page; // Return the cleaned-up page data
    }),

  /**
   * Get page history - returns all revisions for a page
   */
  getPageHistory: permissionGuestProcedure("wiki:page:read")
    .input(
      z.object({
        pageId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const { pageId, limit, offset } = input;

      const revisions = await db.query.wikiPageRevisions.findMany({
        where: eq(wikiPageRevisions.pageId, pageId),
        orderBy: [desc(wikiPageRevisions.createdAt)],
        limit,
        offset,
        with: {
          createdBy: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });

      // Get total count for pagination
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(wikiPageRevisions)
        .where(eq(wikiPageRevisions.pageId, pageId));

      const total = Number(totalResult[0]?.count || 0);

      return {
        revisions,
        total,
        hasMore: offset + revisions.length < total,
      };
    }),

  /**
   * Get a specific revision by ID
   */
  getRevisionById: permissionGuestProcedure("wiki:page:read")
    .input(z.object({ revisionId: z.number() }))
    .query(async ({ input }) => {
      const revision = await db.query.wikiPageRevisions.findFirst({
        where: eq(wikiPageRevisions.id, input.revisionId),
        with: {
          createdBy: {
            columns: { id: true, name: true, email: true, image: true },
          },
          page: {
            columns: { id: true, path: true, title: true },
          },
        },
      });

      if (!revision) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Revision not found",
        });
      }

      return revision;
    }),

  /**
   * Compare a revision with the current page state
   */
  compareRevisions: permissionGuestProcedure("wiki:page:read")
    .input(
      z.object({
        revisionId: z.number(),
        compareWithCurrent: z.boolean().default(true),
      })
    )
    .query(async ({ input }) => {
      const { revisionId, compareWithCurrent } = input;

      // Get the revision
      const revision = await db.query.wikiPageRevisions.findFirst({
        where: eq(wikiPageRevisions.id, revisionId),
        with: {
          page: true,
          createdBy: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      });

      if (!revision) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Revision not found",
        });
      }

      if (!compareWithCurrent) {
        // If not comparing with current, just return the revision
        return {
          revision,
          comparison: null,
        };
      }

      // Get the previous revision to compare what THIS revision changed
      // Find the revision with the next highest ID for the same page
      const previousRevision = await db.query.wikiPageRevisions.findFirst({
        where: and(
          eq(wikiPageRevisions.pageId, revision.pageId),
          sql`${wikiPageRevisions.id} < ${revisionId}`
        ),
        orderBy: [desc(wikiPageRevisions.id)],
      });

      // Debug logging
      logger.info(`Comparing revision ${revisionId}:`, {
        revisionId: revisionId,
        revisionCreatedAt: revision.createdAt,
        revisionContentLength: revision.content?.length || 0,
        revisionContentPreview: revision.content?.substring(0, 100),
        previousRevisionId: previousRevision?.id,
        previousRevisionContentLength: previousRevision?.content?.length || 0,
        previousRevisionContentPreview: previousRevision?.content?.substring(0, 100),
      });

      if (!previousRevision) {
        // This is the first revision - compare with itself to show only content was added
        // Don't show metadata as "changed" since it was just set initially
        logger.info(`Revision ${revisionId} is the first revision`);
        const comparison = compareRevisions(
          {
            content: "",
            title: revision.title, // Use SAME title to not show as changed
            path: revision.path,   // Use SAME path to not show as changed
            isPublished: revision.isPublished, // Use SAME status
            editorType: revision.editorType,   // Use SAME editor
            revisionMetadata: revision.revisionMetadata, // Use SAME metadata
          },
          {
            content: revision.content, // Only content shows as "added"
            title: revision.title,
            path: revision.path,
            isPublished: revision.isPublished,
            editorType: revision.editorType,
            revisionMetadata: revision.revisionMetadata,
          }
        );

        return {
          revision,
          comparison,
          changeSummary: "Initial page creation",
        };
      }

      // Compare previous revision with this revision to show what changed
      // Handle case where old revisions don't have metadata fields (use current values as fallback)
      const comparison = compareRevisions(
        {
          content: previousRevision.content,
          title: previousRevision.title ?? revision.title, // Fallback if old revision has no title
          path: previousRevision.path ?? revision.path,     // Fallback if old revision has no path
          isPublished: previousRevision.isPublished ?? revision.isPublished,
          editorType: previousRevision.editorType ?? revision.editorType,
          revisionMetadata: previousRevision.revisionMetadata ?? revision.revisionMetadata,
        },
        {
          content: revision.content,
          title: revision.title,
          path: revision.path,
          isPublished: revision.isPublished,
          editorType: revision.editorType,
          revisionMetadata: revision.revisionMetadata,
        }
      );

      return {
        revision,
        comparison,
        changeSummary: getChangeSummary(comparison),
      };
    }),

  /**
   * Revert page to a previous revision
   */
  revertToRevision: permissionProtectedProcedure("wiki:page:update")
    .input(
      z.object({
        pageId: z.number(),
        revisionId: z.number(),
        changeSummary: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { pageId, revisionId, changeSummary } = input;
      const userId = parseInt(ctx.session.user.id);

      logger.info(`[REVERT] Starting revert for page ${pageId} to revision ${revisionId}`);
      logger.info(`[REVERT] User ID: ${userId}`);

      // Get the revision to revert to
      const revision = await db.query.wikiPageRevisions.findFirst({
        where: and(
          eq(wikiPageRevisions.id, revisionId),
          eq(wikiPageRevisions.pageId, pageId)
        ),
      });

      if (!revision) {
        logger.error(`[REVERT] Revision ${revisionId} not found`);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Revision not found",
        });
      }

      logger.info(`[REVERT] Found revision:`, {
        id: revision.id,
        title: revision.title,
        path: revision.path,
        contentLength: revision.content?.length,
        editorType: revision.editorType,
        isPublished: revision.isPublished,
        revisionMetadata: revision.revisionMetadata,
      });

      // Get current page to extract tags
      const currentPage = await wikiService.getById(pageId);
      if (!currentPage) {
        logger.error(`[REVERT] Current page ${pageId} not found`);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found",
        });
      }

      logger.info(`[REVERT] Current page found:`, {
        id: currentPage.id,
        title: currentPage.title,
        path: currentPage.path,
        tagsCount: currentPage.tags?.length || 0,
        tags: currentPage.tags?.map(pt => ({ tagId: pt.tag?.id, tagName: pt.tag?.name })),
      });

      // Extract tags safely
      let tags: string[] = [];
      try {
        // Try to get tags from revision metadata first
        const revisionMetadata = revision.revisionMetadata as Record<string, unknown> | null;
        logger.info(`[REVERT] Revision metadata:`, revisionMetadata);
        
        if (revisionMetadata?.tags && Array.isArray(revisionMetadata.tags)) {
          tags = revisionMetadata.tags as string[];
          logger.info(`[REVERT] Using tags from revision metadata:`, tags);
        } else if (currentPage.tags && Array.isArray(currentPage.tags)) {
          // Fall back to current page tags
          logger.info(`[REVERT] Falling back to current page tags`);
          tags = currentPage.tags
            .filter((pt) => {
              const isValid = pt.tag && pt.tag.name;
              if (!isValid) {
                logger.warn(`[REVERT] Invalid tag entry:`, pt);
              }
              return isValid;
            })
            .map((pt) => pt.tag.name);
          logger.info(`[REVERT] Extracted tags from current page:`, tags);
        } else {
          logger.info(`[REVERT] No tags found, using empty array`);
        }
      } catch (error) {
        logger.error("[REVERT] Error extracting tags:", error);
        tags = []; // Default to empty array if extraction fails
      }

      logger.info(`[REVERT] Final tags to use:`, tags);
      logger.info(`[REVERT] Calling wikiService.update with:`, {
        pageId,
        path: revision.path || currentPage.path,
        title: revision.title || currentPage.title,
        contentLength: revision.content?.length,
        isPublished: revision.isPublished ?? currentPage.isPublished ?? false,
        editorType: revision.editorType,
        tagsCount: tags.length,
        tags,
        userId,
      });

      try {
        const updatedPage = await wikiService.update(pageId, {
          path: revision.path || currentPage.path,
          title: revision.title || currentPage.title,
          content: revision.content,
          isPublished: revision.isPublished ?? currentPage.isPublished ?? false,
          editorType: (revision.editorType as "markdown" | "html" | undefined) || undefined,
          tags,
          userId,
          changeSummary: changeSummary || `Reverted to revision #${revisionId}`,
        });

        if (!updatedPage) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update page during revert",
          });
        }

        logger.info(`[REVERT] Successfully updated page ${pageId}`);
        logger.info(`[REVERT] Updated page:`, {
          id: updatedPage.id,
          title: updatedPage.title,
          path: updatedPage.path,
        });

        // Update the newly created revision to mark it as a restoration
        logger.info(`[REVERT] Marking new revision as 'restored'`);
        await db
          .update(wikiPageRevisions)
          .set({ revisionType: "restored" })
          .where(
            eq(
              wikiPageRevisions.id,
              sql`(SELECT id FROM wiki_page_revisions WHERE page_id = ${pageId} ORDER BY created_at DESC LIMIT 1)`
            )
          );

        logger.info(`[REVERT] Revert completed successfully for page ${pageId}`);
        return updatedPage;
      } catch (error) {
        logger.error(`[REVERT] Error during revert:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          pageId,
          revisionId,
        });
        throw error;
      }
    })
});

// Helper function to build folder structure
export interface FolderNode {
  name: string;
  path: string;
  type: "folder" | "page";
  children: Record<string, FolderNode>;
  id?: number;
  title?: string;
  updatedAt?: Date | null;
  isPublished?: boolean | null;
}

export interface FolderNodeArray extends Omit<FolderNode, "children"> {
  children: FolderNodeArray[];
}

function buildFolderStructure(
  pages: Array<{
    path: string;
    id: number;
    title: string;
    updatedAt: Date | null;
    isPublished: boolean | null;
  }>
) {
  const root: FolderNode = {
    name: "root",
    path: "",
    type: "folder",
    children: {},
  };

  // Process each page
  for (const page of pages) {
    // Split path into segments
    const pathSegments = page.path.split("/").filter(Boolean);

    // Skip empty paths
    if (pathSegments.length === 0) continue;

    // Start from the root
    let current = root;
    let currentPath = "";

    // Handle paths like "index" directly under root
    if (pathSegments.length === 1 && pathSegments[0] === "index") {
      // Set root node properties
      root.id = page.id;
      root.title = page.title;
      root.updatedAt = page.updatedAt;
      root.isPublished = page.isPublished;
      continue;
    }

    // Build each folder level
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      const isLastSegment = i === pathSegments.length - 1;

      if (!segment) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create page",
        });
      }
      // Update current path
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      // Check if this segment exists
      if (!current.children[segment]) {
        // Add new node - treat all segments as potential folders
        current.children[segment] = {
          name: segment,
          path: currentPath,
          type: "page", // Default to page, will be overridden if it has children
          children: {},
          id: isLastSegment ? page.id : undefined,
          title: isLastSegment ? page.title : segment,
          updatedAt: isLastSegment ? page.updatedAt : null,
          isPublished: isLastSegment ? page.isPublished : null,
        };
      } else if (isLastSegment) {
        // Update existing node with page info if this is the target page
        current.children[segment].id = page.id;
        current.children[segment].title = page.title;
        current.children[segment].updatedAt = page.updatedAt;
        current.children[segment].isPublished = page.isPublished;
      }

      // Move to the next level
      current = current.children[segment];

      // Mark as folder if it has children and is not the last segment
      if (!isLastSegment) {
        current.type = "folder";
      }
    }
  }

  // Mark nodes with children as folders
  function markFoldersWithChildren(node: FolderNode) {
    if (Object.keys(node.children).length > 0) {
      node.type = "folder";
    }

    for (const childKey in node.children) {
      if (!node.children[childKey]) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create page",
        });
      }
      markFoldersWithChildren(node.children[childKey]);
    }
  }

  // Apply folder marking
  markFoldersWithChildren(root);

  // Convert children objects to arrays for easier rendering
  function convertToArray(node: FolderNode): FolderNodeArray {
    const result = { ...node } as unknown as FolderNodeArray;

    // Convert children object to array
    result.children = Object.values(node.children)
      .map((child) => {
        return convertToArray(child);
      })
      .sort((a, b) => {
        // Sort folders first, then by name
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.name.localeCompare(b.name);
      });

    return result;
  }

  return convertToArray(root);
}

// Helper function to get subfolders for a path
function getSubfoldersForPath(
  pages: Array<{
    path: string;
    id: number;
    title: string;
    updatedAt: Date | null;
    isPublished: boolean | null;
  }>,
  parentPath: string
) {
  const itemMap = new Map<
    string,
    {
      name: string;
      path: string;
      hasChildren: boolean;
      type: "folder" | "page";
      id?: number;
      title?: string;
      updatedAt?: Date | null;
      isPublished?: boolean | null;
    }
  >();

  // Process each page
  for (const page of pages) {
    if (!page.path.startsWith(parentPath)) continue;

    // Remove parent path to get relative path
    const relativePath = parentPath
      ? page.path.slice(parentPath.length + 1)
      : page.path;
    if (!relativePath) continue;

    // Get the first segment of the relative path
    const firstSegmentMatch = relativePath.match(/^([^/]+)/);
    if (!firstSegmentMatch) continue;

    const firstSegment = firstSegmentMatch[1];
    if (!firstSegment) continue;

    const hasChildren = relativePath.includes("/");
    const isDirectChild = !relativePath
      .slice(firstSegment.length + 1)
      .includes("/");

    // Create the full path for this item
    const fullPath = parentPath
      ? `${parentPath}/${firstSegment}`
      : firstSegment;

    // If this is a direct child (page or folder entry)
    if (isDirectChild && firstSegment === relativePath) {
      // This is a direct page in this folder
      itemMap.set(firstSegment, {
        name: firstSegment,
        path: fullPath,
        hasChildren: false,
        type: "page",
        id: page.id,
        title: page.title,
        updatedAt: page.updatedAt,
        isPublished: page.isPublished,
      });
    } else if (!itemMap.has(firstSegment)) {
      // Add as a folder if not already in the map
      itemMap.set(firstSegment, {
        name: firstSegment,
        path: fullPath,
        hasChildren: hasChildren,
        type: "folder",
      });
    } else {
      // Update hasChildren flag if needed
      const item = itemMap.get(firstSegment)!;
      if (hasChildren) {
        item.hasChildren = true;
        item.type = "folder";
      }
    }
  }

  // Convert map to array
  return Array.from(itemMap.values()).sort((a, b) => {
    // Sort folders first, then by name
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });
}
