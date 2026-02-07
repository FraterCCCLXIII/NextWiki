CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users" ("id"),
  "conversation_id" varchar(100) NOT NULL,
  "summary" text,
  "summary_updated_at" timestamp,
  "last_referenced_page" jsonb,
  "last_write_target" jsonb,
  "last_retrieved_sources" jsonb,
  "recent_entities" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX "ai_conversations_user_session_idx" ON "ai_conversations" ("user_id", "conversation_id");

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" serial PRIMARY KEY,
  "conversation_id" integer NOT NULL REFERENCES "ai_conversations" ("id"),
  "role" varchar(20) NOT NULL,
  "content" text NOT NULL,
  "tool_name" varchar(100),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX "ai_messages_conversation_idx" ON "ai_messages" ("conversation_id");
CREATE INDEX "ai_messages_created_at_idx" ON "ai_messages" ("created_at");
