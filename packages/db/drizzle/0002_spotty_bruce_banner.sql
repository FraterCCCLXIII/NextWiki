CREATE TYPE "public"."revision_type" AS ENUM('created', 'updated', 'restored', 'moved');--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "path" varchar(1000);--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "editor_type" "editor_type";--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "is_published" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "revision_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "change_summary" text;--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD COLUMN "revision_type" "revision_type" DEFAULT 'updated';