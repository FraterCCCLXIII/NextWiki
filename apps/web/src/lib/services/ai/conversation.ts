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
  userId: string;
  messages: ConversationMessage[];
  summary: string | null;
  lastReferencedPage: ConversationPageContext | null;
  lastWriteTarget: ConversationPageContext | null;
  lastRetrievedSources: Array<{
    title: string;
    path: string;
    content: string;
  }>;
  updatedAt: Date;
};

export type ConversationContextSnapshot = {
  summary: string | null;
  messages: ConversationMessage[];
  lastReferencedPage: ConversationPageContext | null;
  lastWriteTarget: ConversationPageContext | null;
  lastRetrievedSources: Array<{
    title: string;
    path: string;
    content: string;
  }>;
};

type SummaryInput = {
  existingSummary: string | null;
  messages: ConversationMessage[];
};

type SummaryGenerator = (input: SummaryInput) => Promise<string>;

const sessions = new Map<string, ConversationSession>();

const buildSessionKey = (userId: string, conversationId: string) =>
  `${userId}::${conversationId}`;

export const getOrCreateConversationSession = (
  userId: string,
  conversationId: string
): ConversationSession => {
  const key = buildSessionKey(userId, conversationId);
  const existing = sessions.get(key);
  if (existing) return existing;

  const session: ConversationSession = {
    conversationId,
    userId,
    messages: [],
    summary: null,
    lastReferencedPage: null,
    lastWriteTarget: null,
    lastRetrievedSources: [],
    updatedAt: new Date(),
  };
  sessions.set(key, session);
  return session;
};

export const appendConversationMessage = (
  session: ConversationSession,
  message: ConversationMessage
) => {
  session.messages.push(message);
  session.updatedAt = new Date();
};

export const updateLastReferencedPage = (
  session: ConversationSession,
  page: ConversationPageContext | null
) => {
  session.lastReferencedPage = page;
  session.updatedAt = new Date();
};

export const updateLastWriteTarget = (
  session: ConversationSession,
  page: ConversationPageContext | null
) => {
  session.lastWriteTarget = page;
  session.updatedAt = new Date();
};

export const updateLastRetrievedSources = (
  session: ConversationSession,
  sources: Array<{ title: string; path: string; content: string }>
) => {
  session.lastRetrievedSources = sources;
  session.updatedAt = new Date();
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
    messages: recentMessages,
    lastReferencedPage: session.lastReferencedPage,
    lastWriteTarget: session.lastWriteTarget,
    lastRetrievedSources: session.lastRetrievedSources,
  };
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
    summarizeAfterMessages?: number;
    keepRecentMessages?: number;
    generateSummary: SummaryGenerator;
  }
) => {
  const summarizeAfterMessages = options.summarizeAfterMessages ?? 16;
  const keepRecentMessages = options.keepRecentMessages ?? 8;
  if (session.messages.length <= summarizeAfterMessages) return;

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
  session.messages = session.messages.slice(-keepRecentMessages);
  session.updatedAt = new Date();
};

export const buildSummaryPromptInput = (input: SummaryInput) =>
  buildSummaryPrompt(input);
