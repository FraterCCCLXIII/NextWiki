-- University lessons: teaching content and review status, one row per curriculum lesson.
-- Stable ids (KU-L00123) come from seeds/kosmo/university/ids.json.
--
-- Idempotent on purpose, like 0007: db:push cannot load this schema through drizzle-kit,
-- so this file is also applied directly with psql to environments that already exist.

CREATE TABLE IF NOT EXISTS "kosmo_lessons" (
  "ku_id" text PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "status" text DEFAULT 'stub' NOT NULL,
  "kind" text,
  "minutes" integer,
  "sections" jsonb,
  "checks" jsonb,
  "sources" jsonb DEFAULT '[]'::jsonb,
  "license" text,
  "original" integer DEFAULT 0,
  "author_name" text,
  "author_kind" text,
  "reviewer_name" text,
  "reviewer_kind" text,
  "reviewed_at" timestamp,
  "content_path" text,
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "kosmo_lessons_entity_id_unique" UNIQUE ("entity_id")
);

DO $$ BEGIN
  ALTER TABLE "kosmo_lessons"
    ADD CONSTRAINT "kosmo_lessons_entity_id_kosmo_entities_id_fk"
    FOREIGN KEY ("entity_id") REFERENCES "kosmo_entities"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "kosmo_lessons_status_idx" ON "kosmo_lessons" ("status");
