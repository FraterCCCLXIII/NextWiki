-- Life: species taxonomy (taxa tree + names, media, external ids).
-- Idempotent on purpose, like 0007/0008. Needs pg_trgm for the fuzzy-search indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "taxa" (
  "id" serial PRIMARY KEY NOT NULL,
  "gbif_key" integer,
  "rank" text NOT NULL,
  "parent_id" integer,
  "path" text NOT NULL,
  "scientific_name" text NOT NULL,
  "canonical_name" text NOT NULL,
  "slug" text NOT NULL,
  "status" text DEFAULT 'accepted' NOT NULL,
  "accepted_id" integer,
  "common_name" text,
  "summary" text,
  "image_url" text,
  "image_license" text,
  "image_credit" text,
  "extinct" boolean,
  "child_count" integer DEFAULT 0,
  "species_count" integer DEFAULT 0,
  "source" text DEFAULT 'gbif',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "taxa_gbif_key_unique" UNIQUE ("gbif_key"),
  CONSTRAINT "taxa_slug_unique" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "taxon_names" (
  "id" serial PRIMARY KEY NOT NULL,
  "taxon_id" integer NOT NULL,
  "name" text NOT NULL,
  "lang" text DEFAULT 'en',
  "source" text
);

CREATE TABLE IF NOT EXISTS "taxon_media" (
  "id" serial PRIMARY KEY NOT NULL,
  "taxon_id" integer NOT NULL,
  "url" text NOT NULL,
  "kind" text DEFAULT 'image' NOT NULL,
  "license" text,
  "credit" text,
  "source_url" text
);

CREATE TABLE IF NOT EXISTS "taxon_external_ids" (
  "id" serial PRIMARY KEY NOT NULL,
  "taxon_id" integer NOT NULL,
  "system" text NOT NULL,
  "external_id" text NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "taxa" ADD CONSTRAINT "taxa_parent_id_taxa_id_fk" FOREIGN KEY ("parent_id") REFERENCES "taxa"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "taxa" ADD CONSTRAINT "taxa_accepted_id_taxa_id_fk" FOREIGN KEY ("accepted_id") REFERENCES "taxa"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "taxon_names" ADD CONSTRAINT "taxon_names_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "taxa"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "taxon_media" ADD CONSTRAINT "taxon_media_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "taxa"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "taxon_external_ids" ADD CONSTRAINT "taxon_external_ids_taxon_id_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "taxa"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "taxa_parent_idx" ON "taxa" USING btree ("parent_id");
CREATE INDEX IF NOT EXISTS "taxa_rank_idx" ON "taxa" USING btree ("rank");
CREATE INDEX IF NOT EXISTS "taxa_accepted_idx" ON "taxa" USING btree ("accepted_id");
CREATE INDEX IF NOT EXISTS "taxa_path_idx" ON "taxa" USING btree ("path" text_pattern_ops);
CREATE INDEX IF NOT EXISTS "taxa_canonical_trgm_idx" ON "taxa" USING gin ("canonical_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "taxa_common_trgm_idx" ON "taxa" USING gin ("common_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "taxon_names_taxon_idx" ON "taxon_names" USING btree ("taxon_id");
CREATE UNIQUE INDEX IF NOT EXISTS "taxon_names_uniq_idx" ON "taxon_names" USING btree ("taxon_id","name","lang");
CREATE INDEX IF NOT EXISTS "taxon_names_trgm_idx" ON "taxon_names" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "taxon_media_taxon_idx" ON "taxon_media" USING btree ("taxon_id");
CREATE UNIQUE INDEX IF NOT EXISTS "taxon_media_uniq_idx" ON "taxon_media" USING btree ("taxon_id","url");
CREATE UNIQUE INDEX IF NOT EXISTS "taxon_external_ids_uniq_idx" ON "taxon_external_ids" USING btree ("taxon_id","system");
CREATE INDEX IF NOT EXISTS "taxon_external_ids_lookup_idx" ON "taxon_external_ids" USING btree ("system","external_id");
