import { and, asc, desc, eq } from "drizzle-orm";
import { aiConversations, aiMessages, db } from "@repo/db";

export type ConversationMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: Date;
  toolName?: string;
};

export type ConversationPageContext = {
  id?: number;
  title?: string;
  path?: string;
};

export type ConversationSession = {
  conversationId: string;
  userId: number;
  dbId: number;
  messages: ConversationMessage[];
  summary: string | null;
  summaryUpdatedAt: Date | null;
  lastReferencedPage: ConversationPageContext | null;
  lastWriteTarget: ConversationPageContext | null;
  lastRetrievedSources: Array<{
    title: string;
    path: string;
    content: string;
  }>;
  recentEntities: string[];
  loopCount: number;
  updatedAt: Date;
};

export type ConversationContextSnapshot = {
  summary: string | null;
  summaryUpdatedAt: Date | null;
  messages: ConversationMessage[];
  lastReferencedPage: ConversationPageContext | null;
  lastWriteTarget: ConversationPageContext | null;
  lastRetrievedSources: Array<{
    title: string;
    path: string;
    content: string;
  }>;
  recentEntities: string[];
  loopCount: number;
};

export type ConversationSummaryItem = {
  conversationId: string;
  summary: string | null;
  updatedAt: Date | null;
  lastReferencedPage: ConversationPageContext | null;
};

type SummaryInput = {
  existingSummary: string | null;
  messages: ConversationMessage[];
};

type SummaryGenerator = (input: SummaryInput) => Promise<string>;

const sessions = new Map<string, ConversationSession>();

const buildSessionKey = (userId: number, conversationId: string) =>
  `${userId}::${conversationId}`;

const MAX_ENTITIES = 12;
const ENTITY_REGEX = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
const PATH_REGEX = /\/[a-z0-9][a-z0-9\-\/]*/gi;

const extractEntities = (content: string) => {
  const entities = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ENTITY_REGEX.exec(content))) {
    if (match[1]) entities.add(match[1].trim());
  }
  const paths = content.match(PATH_REGEX) ?? [];
  paths.forEach((path) => entities.add(path));
  return Array.from(entities);
};

const mergeEntities = (existing: string[], additions: string[]) => {
  const combined = [...additions, ...existing].filter(Boolean);
  const unique = Array.from(new Set(combined));
  return unique.slice(0, MAX_ENTITIES);
};

const estimateTokenCount = (content: string) =>
  Math.max(1, Math.ceil(content.length / 4));

const estimateContextTokens = (input: {
  summary: string | null;
  messages: ConversationMessage[];
  sources: Array<{ content: string }>;
}) => {
  const summaryTokens = input.summary ? estimateTokenCount(input.summary) : 0;
  const messageTokens = input.messages.reduce(
    (total, message) => total + estimateTokenCount(message.content),
    0
  );
  const sourceTokens = input.sources.reduce(
    (total, source) => total + estimateTokenCount(source.content),
    0
  );
  return summaryTokens + messageTokens + sourceTokens;
};

const loadConversationFromDb = async (
  userId: number,
  conversationId: string
) => {
  const conversation = await db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.userId, userId),
      eq(aiConversations.conversationId, conversationId)
    ),
  });
  if (!conversation) return null;

  const messages = await db.query.aiMessages.findMany({
    where: eq(aiMessages.conversationId, conversation.id),
    orderBy: asc(aiMessages.createdAt),
  });

  return {
    conversation,
    messages,
  };
};

export const listConversationsForUser = async (
  userId: number,
  limit = 25
): Promise<ConversationSummaryItem[]> => {
  const rows = await db.query.aiConversations.findMany({
    where: eq(aiConversations.userId, userId),
    orderBy: desc(aiConversations.updatedAt),
    limit,
  });

  return rows.map((row) => ({
    conversationId: row.conversationId,
    summary: row.summary ?? null,
    updatedAt: row.updatedAt ?? null,
    lastReferencedPage:
      (row.lastReferencedPage as ConversationPageContext | null) ?? null,
  }));
};

export const getConversationForUser = async (
  userId: number,
  conversationId: string
) => {
  const loaded = await loadConversationFromDb(userId, conversationId);
  if (!loaded) return null;

  const { conversation, messages } = loaded;
  return {
    summary: conversation.summary ?? null,
    updatedAt: conversation.updatedAt ?? null,
    lastReferencedPage:
      (conversation.lastReferencedPage as ConversationPageContext | null) ?? null,
    messages: messages.map((message) => ({
      role: message.role as ConversationMessage["role"],
      content: message.content,
      createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
      toolName: message.toolName ?? undefined,
    })),
  };
};

export const ensureConversationForUser = async (
  userId: number,
  conversationId: string
) => {
  const existing = await db.query.aiConversations.findFirst({
    where: and(
      eq(aiConversations.userId, userId),
      eq(aiConversations.conversationId, conversationId)
    ),
  });
  if (existing) return existing;

  const created = await db
    .insert(aiConversations)
    .values({
      userId,
      conversationId,
      lastRetrievedSources: [],
      recentEntities: [],
    })
    .returning();

  return created[0];
};

export const getOrCreateConversationSession = async (
  userId: number,
  conversationId: string
): Promise<ConversationSession> => {
  const key = buildSessionKey(userId, conversationId);
  const existing = sessions.get(key);
  if (existing) return existing;

  const loaded = await loadConversationFromDb(userId, conversationId);
  const dbConversation =
    loaded?.conversation ??
    (
      await db
        .insert(aiConversations)
        .values({
          userId,
          conversationId,
          lastRetrievedSources: [],
          recentEntities: [],
        })
        .returning()
    )[0];

  if (!dbConversation) {
    throw new Error("Failed to create AI conversation session.");
  }

  const session: ConversationSession = {
    conversationId,
    userId,
    dbId: dbConversation.id,
    messages:
      loaded?.messages.map((message) => ({
        role: message.role as ConversationMessage["role"],
        content: message.content,
        createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
        toolName: message.toolName ?? undefined,
      })) ?? [],
    summary: dbConversation.summary ?? null,
    summaryUpdatedAt: dbConversation.summaryUpdatedAt
      ? new Date(dbConversation.summaryUpdatedAt)
      : null,
    lastReferencedPage:
      (dbConversation.lastReferencedPage as ConversationPageContext | null) ??
      null,
    lastWriteTarget:
      (dbConversation.lastWriteTarget as ConversationPageContext | null) ?? null,
    lastRetrievedSources:
      (dbConversation.lastRetrievedSources as Array<{
        title: string;
        path: string;
        content: string;
      }>) ?? [],
    recentEntities:
      (dbConversation.recentEntities as string[] | null) ?? [],
    loopCount: 0,
    updatedAt: new Date(),
  };
  sessions.set(key, session);
  return session;
};

export const appendConversationMessage = async (
  session: ConversationSession,
  message: ConversationMessage
) => {
  session.messages.push(message);
  session.recentEntities = mergeEntities(
    session.recentEntities,
    extractEntities(message.content)
  );
  session.updatedAt = new Date();
  await db.insert(aiMessages).values({
    conversationId: session.dbId,
    role: message.role,
    content: message.content,
    toolName: message.toolName,
    createdAt: message.createdAt,
  });
  await db
    .update(aiConversations)
    .set({
      updatedAt: session.updatedAt,
      recentEntities: session.recentEntities,
    })
    .where(eq(aiConversations.id, session.dbId));
};

export const updateLastReferencedPage = async (
  session: ConversationSession,
  page: ConversationPageContext | null
) => {
  session.lastReferencedPage = page;
  session.updatedAt = new Date();
  await db
    .update(aiConversations)
    .set({
      lastReferencedPage: page,
      updatedAt: session.updatedAt,
    })
    .where(eq(aiConversations.id, session.dbId));
};

export const updateLastWriteTarget = async (
  session: ConversationSession,
  page: ConversationPageContext | null
) => {
  session.lastWriteTarget = page;
  session.updatedAt = new Date();
  await db
    .update(aiConversations)
    .set({
      lastWriteTarget: page,
      updatedAt: session.updatedAt,
    })
    .where(eq(aiConversations.id, session.dbId));
};

export const updateLastRetrievedSources = async (
  session: ConversationSession,
  sources: Array<{ title: string; path: string; content: string }>
) => {
  session.lastRetrievedSources = sources;
  session.updatedAt = new Date();
  await db
    .update(aiConversations)
    .set({
      lastRetrievedSources: sources,
      updatedAt: session.updatedAt,
    })
    .where(eq(aiConversations.id, session.dbId));
};

export const getConversationContextSnapshot = (
  session: ConversationSession,
  options?: {
    recentLimit?: number;
  }
): ConversationContextSnapshot => {
  const recentLimit = options?.recentLimit ?? 10;
  const recentMessages =
    session.messages.length <= recentLimit
      ? session.messages
      : session.messages.slice(-recentLimit);

  return {
    summary: session.summary,
    summaryUpdatedAt: session.summaryUpdatedAt,
    messages: recentMessages,
    lastReferencedPage: session.lastReferencedPage,
    lastWriteTarget: session.lastWriteTarget,
    lastRetrievedSources: session.lastRetrievedSources,
    recentEntities: session.recentEntities,
    loopCount: session.loopCount,
  };
};

export const incrementLoopCount = async (session: ConversationSession) => {
  session.loopCount += 1;
  session.updatedAt = new Date();
  await db
    .update(aiConversations)
    .set({
      updatedAt: session.updatedAt,
    })
    .where(eq(aiConversations.id, session.dbId));
};

const buildSummaryPrompt = (input: SummaryInput) => {
  const history = input.messages
    .map((message) => {
      const label =
        message.role === "tool"
          ? `Tool${message.toolName ? ` (${message.toolName})` : ""}`
          : message.role === "assistant"
            ? "Assistant"
            : "User";
      return `${label}: ${message.content}`;
    })
    .join("\n");

  const existing = input.existingSummary
    ? `Existing summary:\n${input.existingSummary}\n\n`
    : "";

  return `${existing}Summarize the conversation so far with key facts, entities, and user intents. Preserve names, page paths, and decisions. Keep it under 120 words.\n\nConversation:\n${history}`;
};

export const condenseConversationIfNeeded = async (
  session: ConversationSession,
  options: {
    tokenBudget?: number;
    summarizeAfterMessages?: number;
    keepRecentMessages?: number;
    generateSummary: SummaryGenerator;
  }
) => {
  const tokenBudget = options.tokenBudget ?? 2400;
  const summarizeAfterMessages = options.summarizeAfterMessages ?? 16;
  const keepRecentMessages = options.keepRecentMessages ?? 8;
  const estimatedTokens = estimateContextTokens({
    summary: session.summary,
    messages: session.messages,
    sources: session.lastRetrievedSources,
  });
  if (
    session.messages.length <= summarizeAfterMessages &&
    estimatedTokens <= tokenBudget
  ) {
    return;
  }

  const messagesToSummarize = session.messages.slice(
    0,
    Math.max(0, session.messages.length - keepRecentMessages)
  );
  if (messagesToSummarize.length === 0) return;

  const summary = await options.generateSummary({
    existingSummary: session.summary,
    messages: messagesToSummarize,
  });

  session.summary = summary?.trim() || session.summary;
  session.summaryUpdatedAt = new Date();
  session.messages = session.messages.slice(-keepRecentMessages);
  session.updatedAt = new Date();
  await db
    .update(aiConversations)
    .set({
      summary: session.summary,
      summaryUpdatedAt: session.summaryUpdatedAt,
      updatedAt: session.updatedAt,
    })
    .where(eq(aiConversations.id, session.dbId));
};

export const buildSummaryPromptInput = (input: SummaryInput) =>
  buildSummaryPrompt(input);
