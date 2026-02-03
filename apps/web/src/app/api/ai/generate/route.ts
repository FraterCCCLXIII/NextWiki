"use server";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import OpenAI from "openai";
import { authOptions } from "~/lib/auth";
import { authorizationService } from "~/lib/services/authorization";
import { getAISettings } from "~/lib/services/ai";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ? parseInt(session.user.id) : undefined;

  const canCreate = await authorizationService.hasPermission(
    userId,
    "wiki:page:create"
  );
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body?.title ?? "");
  if (!title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  const settings = await getAISettings();
  if (!settings.enabled || !settings.openaiApiKey) {
    return NextResponse.json(
      { error: "AI is not configured" },
      { status: 400 }
    );
  }

  const client = new OpenAI({ apiKey: settings.openaiApiKey });
  const stream = await client.chat.completions.create({
    model: settings.model,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
    stream: true,
    messages: [
      {
        role: "system",
        content: settings.systemPrompt,
      },
      {
        role: "user",
        content: `Draft a new wiki page in markdown. Return only the content without explanations.\nTitle: ${title}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (error) {
        controller.error(error);
        return;
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
