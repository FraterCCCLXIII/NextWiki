-- Kosmographica knowledge graph: external identities, source licensing, claim
-- provenance and uncertainty, and the shared time axis.
--
-- Idempotent on purpose: this repo's `db:push` cannot load the schema through
-- drizzle-kit (its bundler does not resolve the `.js` specifiers required by
-- moduleResolution NodeNext), so this file is also applied directly to
-- environments that were created before it existed.

ALTER TABLE "kosmo_sources" ADD COLUMN IF NOT EXISTS "publisher" text;
ALTER TABLE "kosmo_sources" ADD COLUMN IF NOT EXISTS "license" text;
ALTER TABLE "kosmo_sources" ADD COLUMN IF NOT EXISTS "license_url" text;
ALTER TABLE "kosmo_sources" ADD COLUMN IF NOT EXISTS "retrieved_at" timestamp;
ALTER TABLE "kosmo_sources" ADD COLUMN IF NOT EXISTS "trust_tier" text;

ALTER TABLE "kosmo_entities" ADD COLUMN IF NOT EXISTS "time_start" double precision;
ALTER TABLE "kosmo_entities" ADD COLUMN IF NOT EXISTS "time_end" double precision;
ALTER TABLE "kosmo_entities" ADD COLUMN IF NOT EXISTS "time_precision_years" double precision;
ALTER TABLE "kosmo_entities" ADD COLUMN IF NOT EXISTS "time_kind" text;

CREATE INDEX IF NOT EXISTS "kosmo_entities_time_start_idx"
  ON "kosmo_entities" ("time_start");

ALTER TABLE "kosmo_claims" ADD COLUMN IF NOT EXISTS "value_err" double precision;
ALTER TABLE "kosmo_claims" ADD COLUMN IF NOT EXISTS "method" text;
ALTER TABLE "kosmo_claims" ADD COLUMN IF NOT EXISTS "qualifiers" jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "kosmo_entity_external_ids" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "scheme" text NOT NULL,
  "value" text NOT NULL,
  "url" text,
  "source_id" integer,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "kosmo_entity_external_ids_scheme_value_uq"
  ON "kosmo_entity_external_ids" ("scheme","value");
CREATE INDEX IF NOT EXISTS "kosmo_entity_external_ids_entity_id_idx"
  ON "kosmo_entity_external_ids" ("entity_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kosmo_entity_external_ids_entity_id_kosmo_entities_id_fk'
  ) THEN
    ALTER TABLE "kosmo_entity_external_ids"
      ADD CONSTRAINT "kosmo_entity_external_ids_entity_id_kosmo_entities_id_fk"
      FOREIGN KEY ("entity_id") REFERENCES "public"."kosmo_entities"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kosmo_entity_external_ids_source_id_kosmo_sources_id_fk'
  ) THEN
    ALTER TABLE "kosmo_entity_external_ids"
      ADD CONSTRAINT "kosmo_entity_external_ids_source_id_kosmo_sources_id_fk"
      FOREIGN KEY ("source_id") REFERENCES "public"."kosmo_sources"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "kosmo_claim_sources" (
  "claim_id" integer NOT NULL,
  "source_id" integer NOT NULL,
  "locator" text,
  "stance" text DEFAULT 'supports',
  CONSTRAINT "kosmo_claim_sources_claim_id_source_id_pk" PRIMARY KEY("claim_id","source_id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kosmo_claim_sources_claim_id_kosmo_claims_id_fk'
  ) THEN
    ALTER TABLE "kosmo_claim_sources"
      ADD CONSTRAINT "kosmo_claim_sources_claim_id_kosmo_claims_id_fk"
      FOREIGN KEY ("claim_id") REFERENCES "public"."kosmo_claims"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kosmo_claim_sources_source_id_kosmo_sources_id_fk'
  ) THEN
    ALTER TABLE "kosmo_claim_sources"
      ADD CONSTRAINT "kosmo_claim_sources_source_id_kosmo_sources_id_fk"
      FOREIGN KEY ("source_id") REFERENCES "public"."kosmo_sources"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
