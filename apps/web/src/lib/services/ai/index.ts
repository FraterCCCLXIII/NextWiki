"server-only";

import OpenAI from "openai";
import { TRPCError } from "@trpc/server";
import { getSettings } from "~/lib/services/settings";
import { db, users } from "@repo/db";
import { eq } from "drizzle-orm";

const AI_USER_EMAIL = "ai@nextwiki.system";

export type AIRole = "viewer" | "editor" | "admin";

export type AISettings = {
  enabled: boolean;
  provider: "openai";
  openaiApiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
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
    "ai.systemPrompt",
    "ai.userRole",
  ]);

  return {
    enabled: settings["ai.enabled"],
    provider: settings["ai.provider"],
    openaiApiKey: settings["ai.openaiApiKey"],
    model: settings["ai.model"],
    temperature: settings["ai.temperature"],
    maxTokens: settings["ai.maxTokens"],
    systemPrompt: settings["ai.systemPrompt"],
    userRole: settings["ai.userRole"],
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
    .returning({ id: users.id });

  if (!created) {
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
}) {
  const settings = await getAISettings();
  const client = await getOpenAIClient();
  const systemPrompt = input.systemPrompt ?? settings.systemPrompt;

  const response = await client.chat.completions.create({
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
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
