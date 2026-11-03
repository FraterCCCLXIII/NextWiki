CREATE TABLE "kosmo_datasets" (
	"key" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
