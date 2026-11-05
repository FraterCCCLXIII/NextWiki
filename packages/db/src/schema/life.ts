// Life: a species / taxonomy database (GBIF-shaped backbone tree + names, media, external ids).
// Migration: drizzle/0009_life_taxa.sql (also creates the pg_trgm extension and trigram indexes).
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type TaxonRank =
  | "kingdom" | "phylum" | "class" | "order" | "family" | "genus" | "species" | "subspecies"
  | (string & {});
export type TaxonStatus = "accepted" | "synonym";
export type TaxonMediaKind = "image" | "model" | "sound";
export type TaxonExternalSystem = "gbif" | "wikidata" | "inaturalist" | "col" | "ncbi" | "iucn" | "pbdb";

/** One node of the tree of life. `path` is the ancestor ids joined by '/', trailing slash included, e.g. '1/5/22/'. */
export const taxa = pgTable(
  "taxa",
  {
    id: serial("id").primaryKey(),
    gbifKey: integer("gbif_key").unique(),
    rank: text("rank").notNull().$type<TaxonRank>(),
    parentId: integer("parent_id").references((): AnyPgColumn => taxa.id, { onDelete: "set null" }),
    /** Ancestor ids joined by '/', root first, excluding the row itself ('' for a root). Descendants: path LIKE '<path><id>/%'. */
    path: text("path").notNull(),
    scientificName: text("scientific_name").notNull(),
    canonicalName: text("canonical_name").notNull(),
    slug: text("slug").notNull().unique(),
    status: text("status").notNull().default("accepted").$type<TaxonStatus>(),
    acceptedId: integer("accepted_id").references((): AnyPgColumn => taxa.id, { onDelete: "set null" }),
    commonName: text("common_name"),
    summary: text("summary"),
    imageUrl: text("image_url"),
    imageLicense: text("image_license"),
    imageCredit: text("image_credit"),
    extinct: boolean("extinct"),
    childCount: integer("child_count").default(0),
    speciesCount: integer("species_count").default(0),
    source: text("source").default("gbif"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("taxa_parent_idx").on(t.parentId),
    index("taxa_rank_idx").on(t.rank),
    index("taxa_accepted_idx").on(t.acceptedId),
    index("taxa_path_idx").using("btree", t.path.op("text_pattern_ops")),
    index("taxa_canonical_trgm_idx").using("gin", t.canonicalName.op("gin_trgm_ops")),
    index("taxa_common_trgm_idx").using("gin", t.commonName.op("gin_trgm_ops")),
  ]
);

export const taxonNames = pgTable(
  "taxon_names",
  {
    id: serial("id").primaryKey(),
    taxonId: integer("taxon_id").notNull().references(() => taxa.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    lang: text("lang").default("en"),
    source: text("source"),
  },
  (t) => [
    index("taxon_names_taxon_idx").on(t.taxonId),
    uniqueIndex("taxon_names_uniq_idx").on(t.taxonId, t.name, t.lang),
    index("taxon_names_trgm_idx").using("gin", t.name.op("gin_trgm_ops")),
  ]
);

export const taxonMedia = pgTable(
  "taxon_media",
  {
    id: serial("id").primaryKey(),
    taxonId: integer("taxon_id").notNull().references(() => taxa.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    kind: text("kind").notNull().default("image").$type<TaxonMediaKind>(),
    license: text("license"),
    credit: text("credit"),
    sourceUrl: text("source_url"),
  },
  (t) => [
    index("taxon_media_taxon_idx").on(t.taxonId),
    uniqueIndex("taxon_media_uniq_idx").on(t.taxonId, t.url),
  ]
);

export const taxonExternalIds = pgTable(
  "taxon_external_ids",
  {
    id: serial("id").primaryKey(),
    taxonId: integer("taxon_id").notNull().references(() => taxa.id, { onDelete: "cascade" }),
    system: text("system").notNull().$type<TaxonExternalSystem>(),
    externalId: text("external_id").notNull(),
  },
  (t) => [
    uniqueIndex("taxon_external_ids_uniq_idx").on(t.taxonId, t.system),
    index("taxon_external_ids_lookup_idx").on(t.system, t.externalId),
  ]
);

export const taxaRelations = relations(taxa, ({ one, many }) => ({
  parent: one(taxa, { fields: [taxa.parentId], references: [taxa.id], relationName: "taxonParent" }),
  children: many(taxa, { relationName: "taxonParent" }),
  names: many(taxonNames),
  media: many(taxonMedia),
  externalIds: many(taxonExternalIds),
}));
export const taxonNamesRelations = relations(taxonNames, ({ one }) => ({
  taxon: one(taxa, { fields: [taxonNames.taxonId], references: [taxa.id] }),
}));
export const taxonMediaRelations = relations(taxonMedia, ({ one }) => ({
  taxon: one(taxa, { fields: [taxonMedia.taxonId], references: [taxa.id] }),
}));
export const taxonExternalIdsRelations = relations(taxonExternalIds, ({ one }) => ({
  taxon: one(taxa, { fields: [taxonExternalIds.taxonId], references: [taxa.id] }),
}));

export type Taxon = typeof taxa.$inferSelect;
export type NewTaxon = typeof taxa.$inferInsert;
export type TaxonName = typeof taxonNames.$inferSelect;
export type NewTaxonName = typeof taxonNames.$inferInsert;
export type TaxonMedia = typeof taxonMedia.$inferSelect;
export type NewTaxonMedia = typeof taxonMedia.$inferInsert;
export type TaxonExternalId = typeof taxonExternalIds.$inferSelect;
export type NewTaxonExternalId = typeof taxonExternalIds.$inferInsert;
