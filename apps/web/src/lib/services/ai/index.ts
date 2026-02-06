"server-only";

import OpenAI from "openai";
import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSettings } from "~/lib/services/settings";
import { db, users, wikiPageChunks, wikiPages } from "@repo/db";
import { eq, sql } from "drizzle-orm";

const AI_USER_EMAIL = "ai@nextwiki.system";

export type AIRole = "viewer" | "editor" | "admin";

export type AISettings = {
  enabled: boolean;
  provider: "openai";
  openaiApiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingChunkSize: number;
  embeddingChunkOverlap: number;
  embeddingMaxChunks: number;
  systemPrompt: string;
  userRole: AIRole;
};

export async function getAISettings(): Promise<AISettings> {
  const settings = await getSettings([
    "ai.enabled",
    "ai.provider",
    "ai.openaiApiKey",
    "ai.model",
    "ai.temperature",
    "ai.maxTokens",
    "ai.embeddingModel",
    "ai.embeddingDimensions",
    "ai.embeddingChunkSize",
    "ai.embeddingChunkOverlap",
    "ai.embeddingMaxChunks",
    "ai.systemPrompt",
    "ai.userRole",
  ] as const);

  return {
    enabled: settings["ai.enabled"] as boolean,
    provider: settings["ai.provider"] as "openai",
    openaiApiKey: settings["ai.openaiApiKey"] as string,
    model: settings["ai.model"] as string,
    temperature: settings["ai.temperature"] as number,
    maxTokens: settings["ai.maxTokens"] as number,
    embeddingModel: settings["ai.embeddingModel"] as string,
    embeddingDimensions: settings["ai.embeddingDimensions"] as number,
    embeddingChunkSize: settings["ai.embeddingChunkSize"] as number,
    embeddingChunkOverlap: settings["ai.embeddingChunkOverlap"] as number,
    embeddingMaxChunks: settings["ai.embeddingMaxChunks"] as number,
    systemPrompt: settings["ai.systemPrompt"] as string,
    userRole: settings["ai.userRole"] as AIRole,
  };
}

export async function getOpenAIClient(): Promise<OpenAI> {
  const settings = await getAISettings();
  if (!settings.enabled) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "AI is disabled in settings.",
    });
  }
  if (!settings.openaiApiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "OpenAI API key is missing.",
    });
  }

  return new OpenAI({ apiKey: settings.openaiApiKey });
}

export async function assertAIWriteAllowed() {
  const settings = await getAISettings();
  if (settings.userRole === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "AI write actions are disabled by role settings.",
    });
  }
}

export async function getAIUserId(): Promise<number> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, AI_USER_EMAIL),
    columns: { id: true },
  });

  if (existing?.id) return existing.id;

  const [created] = await db
    .insert(users)
    .values({
      email: AI_USER_EMAIL,
      name: "NextWiki AI",
    })
    .returning();

  if (!created?.id) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create AI service user.",
    });
  }

  return created.id;
}

export async function runChatCompletion(input: {
  systemPrompt?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}) {
  const settings = await getAISettings();
  const client = await getOpenAIClient();
  const systemPrompt = input.systemPrompt ?? settings.systemPrompt;

  const response = await client.chat.completions.create({
    model: input.model ?? settings.model,
    temperature: input.temperature ?? settings.temperature,
    max_tokens: input.maxTokens ?? settings.maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...input.messages,
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI response was empty.",
    });
  }

  return content;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draftPage"),
    args: z.object({
      title: z.string().min(1),
      path: z.string().optional(),
      publish: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal("writeToPage"),
    args: z.object({
      path: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("appendToPage"),
    args: z.object({
      path: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("removeFromPage"),
    args: z.object({
      path: z.string().optional(),
      text: z.string().min(1),
    }),
  }),
  z.object({
    action: z.literal("replaceInPage"),
    args: z.object({
      path: z.string().optional(),
      target: z.string().min(1),
      replacement: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("summarizePage"),
    args: z.object({
      path: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("improvePage"),
    args: z.object({
      path: z.string().optional(),
      goals: z.string().optional(),
    }),
  }),
  z.object({
    action: z.literal("chat"),
    args: z.object({}),
  }),
]);

export type AIAction = z.infer<typeof actionSchema>;

const AI_WRITE_ACTIONS = new Set<AIAction["action"]>([
  "draftPage",
  "writeToPage",
  "appendToPage",
  "removeFromPage",
  "replaceInPage",
  "improvePage",
]);

const WRITE_VERB_PATTERN =
  /\b(edit|update|modify|change|write|add|append|remove|delete|replace|improve|draft|create|rewrite|revise|insert)\b/i;
const WRITE_TARGET_PATTERN =
  /\b(page|wiki|document|doc|entry|article|section|paragraph|line|title|content)\b/i;
const EXPLICIT_PATH_PATTERN = /(^|\s)@?\/[a-z0-9][a-z0-9\-/]*\b/i;

const CREATE_PAGE_PATTERN =
  /\b(new|create|draft|start)\b.*\b(page|wiki|document|doc|entry|article)\b/i;
const EDIT_PAGE_PATTERN =
  /\b(edit|update|modify|change|rewrite|revise|improve|add|append|remove|delete|replace|insert|write)\b.*\b(page|wiki|document|doc|entry|article|section|paragraph|line|title|content)\b/i;

export const isAIWriteAction = (action: AIAction["action"]) =>
  AI_WRITE_ACTIONS.has(action);

export const hasExplicitWriteIntent = (prompt: string) => {
  const normalized = prompt.trim();
  if (!normalized) return false;
  if (CREATE_PAGE_PATTERN.test(normalized)) return true;
  if (EDIT_PAGE_PATTERN.test(normalized)) return true;
  if (WRITE_VERB_PATTERN.test(normalized) && EXPLICIT_PATH_PATTERN.test(normalized)) {
    return true;
  }
  return false;
};

const ACTION_SELECTION_PROMPT = `You are an action router for a wiki assistant.
Return ONLY JSON that matches this schema:
{
  "action": "draftPage" | "writeToPage" | "appendToPage" | "removeFromPage" | "replaceInPage" | "summarizePage" | "improvePage" | "chat",
  "args": {
    // draftPage: { "title": string, "path"?: string, "publish"?: boolean }
    // writeToPage: { "path"?: string }
    // appendToPage: { "path"?: string }
    // removeFromPage: { "path"?: string, "text": string }
    // replaceInPage: { "path"?: string, "target": string, "replacement"?: string }
    // summarizePage: { "path"?: string }
    // improvePage: { "path"?: string, "goals"?: string }
    // chat: {}
  }
}
Rules:
- Prefer "draftPage" when the user asks to create a new page.
- Prefer "writeToPage" when the user explicitly asks to add or update content on a page.
- Use "appendToPage" only when the user wants to add existing assistant content and prior assistant content is available.
- Use "removeFromPage" when the user asks to delete a specific line/phrase.
- Use "replaceInPage" when the user asks to edit or rewrite a specific paragraph or quoted text.
- Use "summarizePage" or "improvePage" for explicit summarize/improve requests.
- Use "chat" for general questions or when intent is unclear.
- Never select a write action unless the user explicitly requested a page edit or creation.
- If the user specified a path like /foo/bar, set args.path to "foo/bar" (no leading slash).
- If the target is the current page, omit args.path.
- If removeFromPage is selected, extract the exact text to remove when possible.`;

const extractJson = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = value.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
};

export async function selectAIAction(input: {
  prompt: string;
  pageContext?: { title: string; path: string };
  explicitPath?: string | null;
  hasAssistantContent: boolean;
  conversationContext?: string;
}) {
  const context = [
    input.pageContext
      ? `Current page:\nTitle: ${input.pageContext.title}\nPath: ${input.pageContext.path}`
      : "Current page: none",
    input.explicitPath ? `Explicit path in prompt: ${input.explicitPath}` : null,
    `Has prior assistant content: ${input.hasAssistantContent ? "yes" : "no"}`,
    input.conversationContext
      ? `Conversation context:\n${input.conversationContext}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await runChatCompletion({
    systemPrompt: ACTION_SELECTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `${context}\n\nUser request:\n${input.prompt}\n\nReturn JSON only.`,
      },
    ],
    temperature: 0.1,
    maxTokens: 300,
  });

  const parseAndValidate = (value: string) => {
    const parsed = extractJson(value);
    if (!parsed) return null;
    const result = actionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  };

  const firstPass = parseAndValidate(response);
  if (firstPass) return firstPass;

  const retry = await runChatCompletion({
    systemPrompt: ACTION_SELECTION_PROMPT,
    messages: [
      {
        role: "user",
        content: `${context}\n\nUser request:\n${input.prompt}\n\nReturn ONLY valid JSON that matches the schema. No prose.`,
      },
    ],
    temperature: 0,
    maxTokens: 300,
  });

  const secondPass = parseAndValidate(retry);
  if (secondPass) return secondPass;

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "AI action selector returned invalid JSON.",
  });
}

const normalizeContent = (content: string) =>
  content.replace(/\r\n/g, "\n").replace(/\s+$/g, "");

const estimateTokenCount = (content: string) =>
  Math.max(1, Math.ceil(content.length / 4));

const chunkContent = (content: string, options: {
  chunkSize: number;
  chunkOverlap: number;
  maxChunks: number;
}) => {
  const normalized = normalizeContent(content);
  if (!normalized.trim()) return [];

  const paragraphs = normalized.split(/\n{2,}/).filter((block) => block.trim());
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
  };

  const appendBlock = (block: string) => {
    const separator = current ? "\n\n" : "";
    const candidate = `${current}${separator}${block}`.trim();
    if (candidate.length <= options.chunkSize) {
      current = candidate;
      return;
    }

    flush();
    const overlap =
      options.chunkOverlap > 0 && current.length > 0
        ? current.slice(-options.chunkOverlap)
        : "";
    current = overlap ? `${overlap}\n\n${block}` : block;
  };

  for (const block of paragraphs) {
    if (block.length > options.chunkSize) {
      const parts = block.match(
        new RegExp(`.{1,${options.chunkSize}}`, "g")
      );
      if (parts) {
        parts.forEach((part) => appendBlock(part));
      }
      continue;
    }
    appendBlock(block);
  }

  flush();
  return chunks.slice(0, options.maxChunks);
};

const hashContent = (content: string) =>
  crypto.createHash("sha256").update(content).digest("hex");

export async function embedTexts(input: string[]) {
  const settings = await getAISettings();
  if (!settings.enabled) return [];
  if (input.length === 0) return [];

  const client = await getOpenAIClient();
  const response = await client.embeddings.create({
    model: settings.embeddingModel,
    input,
  });

  return response.data.map((item) => item.embedding);
}

export async function syncPageEmbeddings(input: {
  pageId: number;
  content: string;
}) {
  const settings = await getAISettings();
  if (!settings.enabled) return;

  const normalized = normalizeContent(input.content);
  if (!normalized.trim()) {
    await db
      .delete(wikiPageChunks)
      .where(eq(wikiPageChunks.pageId, input.pageId));
    return;
  }

  const chunks = chunkContent(normalized, {
    chunkSize: settings.embeddingChunkSize,
    chunkOverlap: settings.embeddingChunkOverlap,
    maxChunks: settings.embeddingMaxChunks,
  });

  const existing = await db.query.wikiPageChunks.findMany({
    where: eq(wikiPageChunks.pageId, input.pageId),
    columns: {
      id: true,
      chunkIndex: true,
      contentHash: true,
    },
  });

  const existingByIndex = new Map(
    existing.map((chunk) => [chunk.chunkIndex, chunk])
  );

  const updatedAt = new Date();
  const changedChunks: Array<{
    chunkIndex: number;
    content: string;
    contentHash: string;
  }> = [];

  chunks.forEach((content, index) => {
    const contentHash = hashContent(content);
    const previous = existingByIndex.get(index);
    if (!previous || previous.contentHash !== contentHash) {
      changedChunks.push({ chunkIndex: index, content, contentHash });
    }
  });

  const embeddings = await embedTexts(
    changedChunks.map((chunk) => chunk.content)
  );

  if (changedChunks.length > 0) {
    if (embeddings.length !== changedChunks.length) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Embedding generation failed to return all vectors.",
      });
    }
    const values = changedChunks.map((chunk, idx) => ({
      pageId: input.pageId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      contentHash: chunk.contentHash,
      embedding: embeddings[idx]!,
      embeddingModel: settings.embeddingModel,
      tokenCount: estimateTokenCount(chunk.content),
      updatedAt,
    }));

    await db
      .insert(wikiPageChunks)
      .values(values)
      .onConflictDoUpdate({
        target: [wikiPageChunks.pageId, wikiPageChunks.chunkIndex],
        set: {
          content: sql`excluded.content`,
          contentHash: sql`excluded.content_hash`,
          embedding: sql`excluded.embedding`,
          embeddingModel: sql`excluded.embedding_model`,
          tokenCount: sql`excluded.token_count`,
          updatedAt,
        },
      });
  }

  const chunkIndexes = chunks.map((_, index) => index);
  if (chunkIndexes.length > 0) {
    const indexesSql = sql.join(
      chunkIndexes.map((index) => sql`${index}`),
      sql`, `
    );
    await db.execute(sql`
      delete from ${wikiPageChunks}
      where ${wikiPageChunks.pageId} = ${input.pageId}
      and ${wikiPageChunks.chunkIndex} not in (${indexesSql})
    `);
  }
}

export type RelevantChunk = {
  pageId: number;
  chunkIndex: number;
  content: string;
  embeddingModel: string;
  tokenCount: number | null;
  distance: number;
  title: string;
  path: string;
};

export async function getRelevantChunks(input: {
  query: string;
  limit?: number;
}): Promise<RelevantChunk[]> {
  const settings = await getAISettings();
  if (!settings.enabled) return [];

  const embeddings = await embedTexts([input.query]);
  const firstEmbedding = embeddings[0];
  if (!firstEmbedding) return [];

  const embeddingLiteral = `[${firstEmbedding.join(",")}]`;
  const limit = input.limit ?? 6;

  const result = await db.execute(sql`
    select
      chunks.page_id,
      chunks.chunk_index,
      chunks.content,
      chunks.embedding_model,
      chunks.token_count,
      (chunks.embedding <=> ${embeddingLiteral}::vector) as distance,
      pages.title as page_title,
      pages.path as page_path
    from ${wikiPageChunks} as chunks
    join ${wikiPages} as pages on pages.id = chunks.page_id
    where chunks.embedding_model = ${settings.embeddingModel}
    order by chunks.embedding <=> ${embeddingLiteral}::vector
    limit ${limit}
  `);

  const rows = result.rows as Array<{
    page_id: number;
    chunk_index: number;
    content: string;
    embedding_model: string;
    token_count: number | null;
    distance: number;
    page_title: string;
    page_path: string;
  }>;

  return rows.map((row) => ({
    pageId: row.page_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    embeddingModel: row.embedding_model,
    tokenCount: row.token_count,
    distance: row.distance,
    title: row.page_title,
    path: row.page_path,
  }));
}
