import { db } from "@repo/db";
import {
  wikiPages,
  wikiPageRevisions,
  wikiPageToTag,
  wikiTags,
} from "@repo/db";
import { desc, eq, sql } from "drizzle-orm";
import { lockService } from "~/lib/services";
import { syncPageEmbeddings } from "~/lib/services/ai";
import { Transaction } from "~/types/db";
import { logger } from "@repo/logger";
import { revalidatePath } from "next/cache";

/**
 * Wiki service - handles all wiki-related database operations
 */
export const wikiService = {
  /**
   * Get a wiki page by its path
   */
  async getByPath(path: string) {
    return db.query.wikiPages.findFirst({
      columns: {
        search: false, // Exclude search vector
        lockedById: false, // Exclude raw foreign key if lockedBy object is included
        createdById: false,
        updatedById: false,
      },
      where: eq(wikiPages.path, path),
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true, image: true },
        },
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
  },

  /**
   * Get recently updated wiki pages
   */
  async getRecentPages(limit: number = 3) {
    return db.query.wikiPages.findMany({
      orderBy: [desc(wikiPages.updatedAt)],
      limit,
    });
  },

  /**
   * List wiki pages with sorting and pagination
   */
  async list(options: {
    limit?: number;
    sortBy?: "title" | "updatedAt";
    sortOrder?: "asc" | "desc";
  } = {}) {
    const {
      limit = 100,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = options;

    // Determine order by clause
    const orderByClause =
      sortBy === "title"
        ? sortOrder === "asc"
          ? wikiPages.title
          : desc(wikiPages.title)
        : sortOrder === "asc"
          ? wikiPages.updatedAt
          : desc(wikiPages.updatedAt);

    const pages = await db.query.wikiPages.findMany({
      columns: {
        search: false, // Exclude search vector
        lockedById: false,
        createdById: false,
        updatedById: false,
      },
      orderBy: [orderByClause],
      limit,
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true, image: true },
        },
        updatedBy: {
          columns: { id: true, name: true, email: true, image: true },
        },
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return { pages };
  },

  /**
   * Create a new wiki page
   */
  async create(data: {
    path: string;
    title: string;
    content?: string;
    isPublished?: boolean;
    userId: number;
    tags?: string[];
    editorType?: "markdown" | "html";
    changeSummary?: string;
  }) {
    const {
      path,
      title,
      content,
      isPublished,
      userId,
      tags = [],
      editorType,
      changeSummary,
    } = data;

    // Use a transaction to create the page and associate tags
    const newPage = await db.transaction(async (tx) => {
      // Create the page
      const [page] = await tx
        .insert(wikiPages)
        .values({
          path: path.toLowerCase(),
          title,
          content,
          editorType,
          isPublished: isPublished ?? false,
          createdById: userId,
          updatedById: userId,
        })
        .returning();

      if (!page) {
        throw new Error("Failed to create page");
      }

      // Create initial revision snapshot
      await tx.insert(wikiPageRevisions).values({
        pageId: page.id,
        content: content || "",
        title: title,
        path: path.toLowerCase(),
        editorType: editorType,
        isPublished: isPublished ?? false,
        revisionType: "created",
        revisionMetadata: tags.length > 0 ? { tags } : null,
        changeSummary: changeSummary ?? "Initial page creation",
        createdById: userId,
      });

      // If there are tags to add, process them
      if (tags.length > 0) {
        await this.updatePageTags(tx, page.id, tags);
      }

      return page;
    });

    // After successful transaction, trigger revalidation
    if (newPage) {
      try {
        const validatedPath = newPage.path.startsWith("/")
          ? newPage.path
          : `/${newPage.path}`;
        revalidatePath(validatedPath);
        logger.info(`Revalidated path after creation: ${validatedPath}`);
      } catch (err) {
        logger.error(
          `Error triggering revalidation for created path ${newPage.path}:`,
          err
        );
      }

      try {
        await syncPageEmbeddings({
          pageId: newPage.id,
          content: newPage.content ?? "",
        });
      } catch (err) {
        logger.error(
          `Error syncing embeddings for created page ${newPage.path}:`,
          err
        );
      }
    }

    return newPage;
  },

  /**
   * Update an existing wiki page
   */
  async update(
    id: number,
    data: {
      path: string;
      title: string;
      content?: string;
      isPublished?: boolean;
      userId: number;
      tags?: string[];
      editorType?: "markdown" | "html";
      changeSummary?: string;
    }
  ) {
    const { path, title, content, isPublished, userId, tags, editorType, changeSummary } = data;

    // Use a transaction to update the page and handle tags
    const updatedPageResult = await db.transaction(async (tx) => {
      // Get current page state before updating
      const page = await this.getById(id);
      if (!page) {
        throw new Error("Page not found");
      }
      
      // Determine revision type based on changes
      let revisionType: "updated" | "moved" = "updated";
      if (page.path !== path.toLowerCase()) {
        revisionType = "moved";
      }

      // Generate auto-summary if none provided
      let finalSummary = changeSummary;
      if (!finalSummary) {
        const changes: string[] = [];
        if (page.title !== title) changes.push(`title from "${page.title}" to "${title}"`);
        if (page.path !== path.toLowerCase()) changes.push(`path from "${page.path}" to "${path.toLowerCase()}"`);
        if (page.isPublished !== isPublished) {
          changes.push(isPublished ? "published page" : "unpublished page");
        }
        if (page.content !== content && content !== undefined) changes.push("content");
        
        finalSummary = changes.length > 0 
          ? `Updated ${changes.join(", ")}` 
          : "Updated page";
      }

      // Update the page
      const [updatedPage] = await tx
        .update(wikiPages)
        .set({
          path: path.toLowerCase(),
          title,
          content,
          editorType,
          isPublished,
          updatedById: userId,
          updatedAt: new Date(),
        })
        .where(eq(wikiPages.id, id))
        .returning();

      // If tags were provided, update the page's tags
      if (tags !== undefined) {
        await this.updatePageTags(tx, id, tags);
      }

      if (!updatedPage) {
        throw new Error("Failed to update page");
      }

      // Create a revision with the NEW state (after the update)
      // Ensure we use the updated content, not undefined
      const revisionContent = content !== undefined ? content : (updatedPage.content || "");
      
      logger.info(`Creating revision for page ${id}:`, {
        contentLength: revisionContent.length,
        contentPreview: revisionContent.substring(0, 100),
        changeSummary: finalSummary,
      });
      
      await tx.insert(wikiPageRevisions).values({
        pageId: id,
        content: revisionContent,
        title: title,
        path: path.toLowerCase(),
        editorType: editorType || updatedPage.editorType,
        isPublished: isPublished ?? updatedPage.isPublished ?? false,
        revisionType,
        revisionMetadata: tags && tags.length > 0 ? { tags } : null,
        changeSummary: finalSummary,
        createdById: userId,
      });

      return updatedPage;
    });

    // After successful transaction, trigger revalidation
    if (updatedPageResult) {
      try {
        // Ensure the path starts with a '/' for revalidatePath
        const validatedPath = updatedPageResult.path.startsWith("/")
          ? updatedPageResult.path
          : `/${updatedPageResult.path}`;
        revalidatePath(validatedPath);
        logger.info(`Revalidated path: ${validatedPath}`);
      } catch (err) {
        logger.error(
          `Error triggering revalidation for path ${updatedPageResult.path}:`,
          err
        );
      }

      try {
        await syncPageEmbeddings({
          pageId: updatedPageResult.id,
          content: updatedPageResult.content ?? "",
        });
      } catch (err) {
        logger.error(
          `Error syncing embeddings for updated page ${updatedPageResult.path}:`,
          err
        );
      }
    }

    return updatedPageResult;
  },

  /**
   * Get a wiki page by ID
   */
  async getById(id: number) {
    return db.query.wikiPages.findFirst({
      columns: {
        search: false, // Exclude search vector
        lockedById: false, // Exclude raw foreign key if lockedBy object is included
        createdById: false,
        updatedById: false,
      },
      where: eq(wikiPages.id, id),
      with: {
        createdBy: {
          columns: { id: true, name: true, email: true, image: true },
        },
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
  },

  /**
   * Delete a wiki page
   */
  async delete(id: number) {
    // Get the page path before deleting for revalidation
    const pageToDelete = await this.getById(id);
    const pathToDelete = pageToDelete?.path;

    const [deleted] = await db
      .delete(wikiPages)
      .where(eq(wikiPages.id, id))
      .returning();

    // After successful deletion, trigger revalidation
    if (deleted && pathToDelete) {
      try {
        const validatedPath = pathToDelete.startsWith("/")
          ? pathToDelete
          : `/${pathToDelete}`;
        revalidatePath(validatedPath);
        logger.info(`Revalidated path after deletion: ${validatedPath}`);
      } catch (err) {
        logger.error(
          `Error triggering revalidation for deleted path ${pathToDelete}:`,
          err
        );
      }
    }

    return deleted;
  },

  /**
   * Move multiple pages with proper locking
   */
  async movePages(params: {
    pageIds: number[];
    sourcePath: string;
    targetPath: string;
    operation: "move" | "rename";
    recursive: boolean;
    userId: number;
  }) {
    const { pageIds, sourcePath, targetPath, operation, recursive, userId } =
      params;

    try {
      let updatedPageIds: number[] = [];
      const oldPaths: string[] = []; // Store old paths
      const movedChildOldPaths: string[] = []; // Store old paths of moved children

      await db.transaction(async (tx) => {
        // First fetch all pages to check if they exist and aren't locked by others
        const pagesToMoveData = await Promise.all(
          pageIds.map(async (pageId) => {
            const page = await this.getById(pageId);
            if (!page) {
              throw new Error(`Page with ID ${pageId} not found`);
            }

            // Check if page is locked by another user
            // We'll reuse dbService.locks.isLocked here to be consistent
            const { isLocked, lockedByUserId } =
              await lockService.isLocked(pageId);
            if (isLocked && lockedByUserId !== userId) {
              throw new Error(`Page "${page.title}" is locked by another user`);
            }

            return page;
          })
        );

        // Set a reasonable timeout
        await tx.execute(sql`SET LOCAL statement_timeout = 10000`);

        const updatedPages = [];
        const acquiredLocks = [];

        try {
          // First acquire hardware locks for all pages
          for (const page of pagesToMoveData) {
            oldPaths.push(page.path); // Store old path
            // Lock the page with a hardware lock
            const result = await tx.execute(
              sql`SELECT * FROM wiki_pages WHERE id = ${page.id} FOR UPDATE NOWAIT`
            );

            if (result.rows.length === 0) {
              throw new Error(
                `Failed to acquire lock for page "${page.title}"`
              );
            }

            acquiredLocks.push(page.id);
          }

          // Now safely process each page
          for (const page of pagesToMoveData) {
            // Calculate new path based on operation
            let newPath = page.path;

            if (operation === "move") {
              // For move, replace the source path with target path
              if (page.path.startsWith(sourcePath)) {
                newPath = page.path.replace(sourcePath, targetPath);
              }
            } else if (operation === "rename") {
              // For rename, simply update to the new path
              newPath = targetPath;
            }

            // Check if new path already exists
            const existingPage = await tx.query.wikiPages.findFirst({
              where: eq(wikiPages.path, newPath),
            });

            if (existingPage && existingPage.id !== page.id) {
              throw new Error(`A page already exists at path: ${newPath}`);
            }

            // Create a revision first
            await tx.insert(wikiPageRevisions).values({
              pageId: page.id,
              content: page.content || "",
              createdById: userId,
            });

            // Update the page and release software lock
            const [updatedPage] = await tx
              .update(wikiPages)
              .set({
                path: newPath,
                updatedById: userId,
                updatedAt: new Date(),
                lockedById: null,
                lockedAt: null,
                lockExpiresAt: null,
              })
              .where(eq(wikiPages.id, page.id))
              .returning();

            updatedPages.push(updatedPage);

            // If recursive flag is true, handle child pages
            if (recursive) {
              const childPrefix = page.path.endsWith("/")
                ? page.path
                : `${page.path}/`;

              const childPages = await tx.query.wikiPages.findMany({
                where: (wiki) => sql`${wiki.path} LIKE ${childPrefix + "%"}`,
              });

              // Store old paths of children before locking/moving
              childPages.forEach((child) =>
                movedChildOldPaths.push(child.path)
              );

              // Lock all child pages
              for (const childPage of childPages) {
                const childResult = await tx.execute(
                  sql`SELECT * FROM wiki_pages WHERE id = ${childPage.id} FOR UPDATE NOWAIT`
                );

                if (childResult.rows.length === 0) {
                  throw new Error(
                    `Failed to acquire lock for child page at "${childPage.path}"`
                  );
                }

                acquiredLocks.push(childPage.id);
              }

              // Now process all child pages
              for (const childPage of childPages) {
                const childNewPath = childPage.path.replace(
                  childPrefix,
                  newPath.endsWith("/") ? newPath : `${newPath}/`
                );

                // Check for conflicts
                const existingChildPage = await tx.query.wikiPages.findFirst({
                  where: eq(wikiPages.path, childNewPath),
                });

                if (
                  existingChildPage &&
                  existingChildPage.id !== childPage.id
                ) {
                  throw new Error(
                    `Cannot move recursively: A page already exists at path: ${childNewPath}`
                  );
                }

                // Create revision
                await tx.insert(wikiPageRevisions).values({
                  pageId: childPage.id,
                  content: childPage.content || "",
                  createdById: userId,
                });

                // Update child page
                const [updatedChildPage] = await tx
                  .update(wikiPages)
                  .set({
                    path: childNewPath,
                    updatedById: userId,
                    updatedAt: new Date(),
                    lockedById: null,
                    lockedAt: null,
                    lockExpiresAt: null,
                  })
                  .where(eq(wikiPages.id, childPage.id))
                  .returning();

                updatedPages.push(updatedChildPage);
              }
            }
          }

          // Transaction will automatically commit and release hardware locks
          // Return only the IDs of the updated pages
          updatedPageIds = updatedPages.map((p) => {
            if (!p) {
              throw new Error("Updated page is undefined");
            }
            return p.id;
          });
        } catch (error) {
          // In case of error, explicitly release any software locks
          // that might have been acquired outside this transaction
          for (const pageId of acquiredLocks) {
            await lockService.releaseLock(pageId, userId).catch(() => {
              // Ignore errors in cleanup
              logger.warn(
                `Failed to release lock for page ${pageId} during error recovery`
              );
            });
          }

          throw error;
        }
      });

      // After the transaction, fetch the cleaned-up data for the moved pages
      const finalUpdatedPages = await Promise.all(
        updatedPageIds.map((id: number) => this.getById(id))
      );

      // Combine old paths
      const allOldPaths = [...oldPaths, ...movedChildOldPaths];

      // Trigger revalidation for old and new paths
      const finalPages = finalUpdatedPages.filter(Boolean) as NonNullable<
        (typeof finalUpdatedPages)[number]
      >[];

      const revalidationPromises: Promise<void>[] = [];

      // Revalidate NEW paths
      finalPages.forEach((page) => {
        const validatedPath = page.path.startsWith("/")
          ? page.path
          : `/${page.path}`;
        revalidationPromises.push(
          (async () => {
            try {
              revalidatePath(validatedPath);
              logger.info(`Revalidated new path after move: ${validatedPath}`);
            } catch (err) {
              logger.error(
                `Error revalidating new path ${validatedPath}:`,
                err
              );
            }
          })()
        );
      });

      // Revalidate OLD paths (only if different from new paths)
      const finalNewPaths = new Set(finalPages.map((p) => p.path));
      allOldPaths.forEach((oldPath) => {
        if (!finalNewPaths.has(oldPath)) {
          // Avoid revalidating if path didn't actually change
          const validatedPath = oldPath.startsWith("/")
            ? oldPath
            : `/${oldPath}`;
          revalidationPromises.push(
            (async () => {
              try {
                revalidatePath(validatedPath);
                logger.info(
                  `Revalidated old path after move: ${validatedPath}`
                );
              } catch (err) {
                logger.error(
                  `Error revalidating old path ${validatedPath}:`,
                  err
                );
              }
            })()
          );
        }
      });

      // Wait for all revalidations (optional, can run in background)
      // await Promise.all(revalidationPromises);

      // Return the final updated pages
      return finalPages;
    } catch (error) {
      logger.error("Error in movePages service:", error);
      throw error;
    }
  },

  /**
   * Helper method to update a page's tags
   * @param tx Database transaction
   * @param pageId ID of the page to update tags for
   * @param tagNames Array of tag names to set on the page
   */
  async updatePageTags(tx: Transaction, pageId: number, tagNames: string[]) {
    logger.info(`[UPDATE_TAGS] Starting updatePageTags for page ${pageId}`, {
      tagNames,
      tagCount: tagNames.length,
    });

    // Step 1: Get existing tag IDs for this page
    const existingTagAssociations: Array<{
      tagId: number;
      tag: { id: number; name: string };
    }> = await tx.query.wikiPageToTag.findMany({
      where: eq(wikiPageToTag.pageId, pageId),
      with: {
        tag: true,
      },
    });

    logger.info(`[UPDATE_TAGS] Existing associations:`, {
      count: existingTagAssociations.length,
      associations: existingTagAssociations.map(a => ({
        tagId: a.tagId,
        tagName: a.tag?.name,
      })),
    });

    const existingTagNames = existingTagAssociations.map(
      (assoc) => assoc.tag.name
    );

    // Step 2: Determine which tags to add and which to remove
    const tagsToAdd = tagNames.filter(
      (name) => !existingTagNames.includes(name)
    );
    const tagsToRemove: typeof existingTagAssociations =
      existingTagAssociations.filter(
        (assoc) => !tagNames.includes(assoc.tag.name)
      );

    logger.info(`[UPDATE_TAGS] Tags to add:`, tagsToAdd);
    logger.info(`[UPDATE_TAGS] Tags to remove:`, tagsToRemove.map(a => a.tag.name));

    // Step 3: Remove tags that are no longer associated with the page
    if (tagsToRemove.length > 0) {
      logger.info(`[UPDATE_TAGS] Removing ${tagsToRemove.length} tag associations`);
      for (const assoc of tagsToRemove) {
        logger.info(`[UPDATE_TAGS] Removing association for tag:`, {
          tagId: assoc.tagId,
          tagName: assoc.tag.name,
        });
        await tx
          .delete(wikiPageToTag)
          .where(
            eq(wikiPageToTag.tagId, assoc.tagId) &&
              eq(wikiPageToTag.pageId, pageId)
          );
      }
    }

    // Step 4: Add new tags
    if (tagsToAdd.length > 0) {
      logger.info(`[UPDATE_TAGS] Adding ${tagsToAdd.length} new tag associations`);
      for (const tagName of tagsToAdd) {
        logger.info(`[UPDATE_TAGS] Processing tag: "${tagName}"`);
        
        // Get or create the tag
        let tag = await tx.query.wikiTags.findFirst({
          where: eq(wikiTags.name, tagName),
        });

        logger.info(`[UPDATE_TAGS] Existing tag lookup result:`, {
          found: !!tag,
          tagId: tag?.id,
          tagName: tag?.name,
        });

        if (!tag) {
          // Create new tag if it doesn't exist
          logger.info(`[UPDATE_TAGS] Creating new tag: "${tagName}"`);
          try {
            const newTags = await tx
              .insert(wikiTags)
              .values({ name: tagName })
              .returning();
            
            logger.info(`[UPDATE_TAGS] Insert returned:`, {
              length: newTags.length,
              firstTag: newTags[0],
            });
            
            tag = newTags[0];
            
            logger.info(`[UPDATE_TAGS] Created new tag:`, {
              id: tag?.id,
              name: tag?.name,
            });
          } catch (error) {
            logger.error(`[UPDATE_TAGS] Error creating tag "${tagName}":`, {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
          }
        }

        // Ensure tag exists before creating association
        if (!tag || !tag.id) {
          logger.error(`[UPDATE_TAGS] Failed to get or create tag: "${tagName}"`, {
            tag,
            hasTag: !!tag,
            hasId: tag?.id,
          });
          continue; // Skip this tag and continue with others
        }

        // Add association between page and tag
        logger.info(`[UPDATE_TAGS] Creating association:`, {
          pageId,
          tagId: tag.id,
          tagName: tag.name,
        });
        
        try {
          await tx
            .insert(wikiPageToTag)
            .values({ pageId, tagId: tag.id })
            .onConflictDoNothing(); // Ignore if already exists
          
          logger.info(`[UPDATE_TAGS] Successfully created association for tag "${tagName}"`);
        } catch (error) {
          logger.error(`[UPDATE_TAGS] Error creating association for tag "${tagName}":`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            pageId,
            tagId: tag.id,
          });
          throw error;
        }
      }
    }
    
    logger.info(`[UPDATE_TAGS] Completed updatePageTags for page ${pageId}`);
  },
};
