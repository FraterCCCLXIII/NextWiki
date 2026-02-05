CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "wiki_page_chunks" (
  "id" serial PRIMARY KEY,
  "page_id" integer NOT NULL REFERENCES "wiki_pages" ("id"),
  "chunk_index" integer NOT NULL,
  "content" text NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "embedding_model" varchar(100) NOT NULL,
  "token_count" integer,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX "wiki_page_chunks_page_idx" ON "wiki_page_chunks" ("page_id");
CREATE UNIQUE INDEX "wiki_page_chunks_page_chunk_idx" ON "wiki_page_chunks" ("page_id", "chunk_index");
CREATE INDEX "wiki_page_chunks_embedding_idx" ON "wiki_page_chunks" USING ivfflat ("embedding" vector_cosine_ops);
