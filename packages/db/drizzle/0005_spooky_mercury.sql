CREATE TABLE "kosmo_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"predicate" text NOT NULL,
	"object_id" integer,
	"value_text" text,
	"value_num" double precision,
	"unit" text,
	"source_id" integer,
	"note" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kosmo_claims_identity_uq" UNIQUE NULLS NOT DISTINCT("subject_id","predicate","object_id","value_text")
);
--> statement-breakpoint
CREATE TABLE "kosmo_entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"summary" text,
	"page_id" integer,
	"data" jsonb DEFAULT '{}'::jsonb,
	"source_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kosmo_entities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kosmo_entity_taxa" (
	"entity_id" integer NOT NULL,
	"taxon_id" integer NOT NULL,
	CONSTRAINT "kosmo_entity_taxa_entity_id_taxon_id_pk" PRIMARY KEY("entity_id","taxon_id")
);
--> statement-breakpoint
CREATE TABLE "kosmo_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "kosmo_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "kosmo_taxa" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "kosmo_taxa_scheme_slug_uq" UNIQUE("scheme","slug")
);
--> statement-breakpoint
ALTER TABLE "kosmo_claims" ADD CONSTRAINT "kosmo_claims_subject_id_kosmo_entities_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."kosmo_entities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_claims" ADD CONSTRAINT "kosmo_claims_object_id_kosmo_entities_id_fk" FOREIGN KEY ("object_id") REFERENCES "public"."kosmo_entities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_claims" ADD CONSTRAINT "kosmo_claims_source_id_kosmo_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."kosmo_sources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_entities" ADD CONSTRAINT "kosmo_entities_page_id_wiki_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_entities" ADD CONSTRAINT "kosmo_entities_source_id_kosmo_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."kosmo_sources"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_entity_taxa" ADD CONSTRAINT "kosmo_entity_taxa_entity_id_kosmo_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."kosmo_entities"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_entity_taxa" ADD CONSTRAINT "kosmo_entity_taxa_taxon_id_kosmo_taxa_id_fk" FOREIGN KEY ("taxon_id") REFERENCES "public"."kosmo_taxa"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "kosmo_taxa" ADD CONSTRAINT "kosmo_taxa_parent_id_kosmo_taxa_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."kosmo_taxa"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "kosmo_claims_subject_id_idx" ON "kosmo_claims" USING btree ("subject_id");
--> statement-breakpoint
CREATE INDEX "kosmo_claims_object_id_idx" ON "kosmo_claims" USING btree ("object_id");
--> statement-breakpoint
CREATE INDEX "kosmo_claims_predicate_idx" ON "kosmo_claims" USING btree ("predicate");
--> statement-breakpoint
CREATE INDEX "kosmo_entities_kind_idx" ON "kosmo_entities" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "kosmo_entities_type_idx" ON "kosmo_entities" USING btree ("type");
--> statement-breakpoint
CREATE INDEX "kosmo_entities_page_id_idx" ON "kosmo_entities" USING btree ("page_id");
