// Run pnpm db:generate && pnpm db:migrate (or db:push) after pulling this

// Kosmographica knowledge model: one canonical graph (entities + claims) with
// separate taxonomy schemes over it. See KNOWLEDGE-MODEL.md in kosmographica-app.
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  primaryKey,
  index,
  unique,
  jsonb,
  doublePrecision,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
// wikiPages is referenced lazily (thunks below), so the circular import with
// ./index is safe at runtime.
import { wikiPages } from "./index";

type KosmoEntityKind =
  | "object"
  | "domain_node"
  | "concept"
  | "module"
  | "lesson"
  | "event"
  | "stage";

type KosmoTaxonScheme =
  | "astronomy"
  | "physics"
  | "math"
  | "philosophy"
  | "models"
  | "curriculum"
  | "history";

// Provenance for catalogue rows, imported documents and other source material.
export const kosmoSources = pgTable("kosmo_sources", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// The referent: a thing, concept, module, lesson, etc. Not a page.
export const kosmoEntities = pgTable(
  "kosmo_entities",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    kind: text("kind").notNull().$type<KosmoEntityKind>(),
    name: text("name").notNull(),
    type: text("type"),
    summary: text("summary"),
    pageId: integer("page_id").references(() => wikiPages.id, {
      onDelete: "set null",
    }),
    data: jsonb("data").$type<Record<string, unknown>>().default({}),
    sourceId: integer("source_id").references(() => kosmoSources.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("kosmo_entities_kind_idx").on(t.kind),
    index("kosmo_entities_type_idx").on(t.type),
    index("kosmo_entities_page_id_idx").on(t.pageId),
  ]
);

// A statement about an entity. Either points at another entity (objectId) or
// carries a literal value (valueText / valueNum + unit).
export const kosmoClaims = pgTable(
  "kosmo_claims",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => kosmoEntities.id, { onDelete: "cascade" }),
    predicate: text("predicate").notNull(),
    objectId: integer("object_id").references(() => kosmoEntities.id, {
      onDelete: "cascade",
    }),
    valueText: text("value_text"),
    valueNum: doublePrecision("value_num"),
    unit: text("unit"),
    sourceId: integer("source_id").references(() => kosmoSources.id),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("kosmo_claims_subject_id_idx").on(t.subjectId),
    index("kosmo_claims_object_id_idx").on(t.objectId),
    index("kosmo_claims_predicate_idx").on(t.predicate),
    unique("kosmo_claims_identity_uq")
      .on(t.subjectId, t.predicate, t.objectId, t.valueText)
      .nullsNotDistinct(),
  ]
);

// Navigation schemes. Several can coexist; a taxon is not an entity type.
export const kosmoTaxa = pgTable(
  "kosmo_taxa",
  {
    id: serial("id").primaryKey(),
    scheme: text("scheme").notNull().$type<KosmoTaxonScheme>(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").references(
      (): AnyPgColumn => kosmoTaxa.id,
      { onDelete: "set null" }
    ),
    sortOrder: integer("sort_order").default(0),
  },
  (t) => [unique("kosmo_taxa_scheme_slug_uq").on(t.scheme, t.slug)]
);

// Entity <-> taxon many-to-many.
export const kosmoEntityTaxa = pgTable(
  "kosmo_entity_taxa",
  {
    entityId: integer("entity_id")
      .notNull()
      .references(() => kosmoEntities.id, { onDelete: "cascade" }),
    taxonId: integer("taxon_id")
      .notNull()
      .references(() => kosmoTaxa.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.entityId, t.taxonId] })]
);

// Relations

export const kosmoSourcesRelations = relations(kosmoSources, ({ many }) => ({
  entities: many(kosmoEntities),
  claims: many(kosmoClaims),
}));

export const kosmoEntitiesRelations = relations(
  kosmoEntities,
  ({ one, many }) => ({
    page: one(wikiPages, {
      fields: [kosmoEntities.pageId],
      references: [wikiPages.id],
    }),
    source: one(kosmoSources, {
      fields: [kosmoEntities.sourceId],
      references: [kosmoSources.id],
    }),
    outgoingClaims: many(kosmoClaims, { relationName: "claimSubject" }),
    incomingClaims: many(kosmoClaims, { relationName: "claimObject" }),
    taxa: many(kosmoEntityTaxa),
  })
);

export const kosmoClaimsRelations = relations(kosmoClaims, ({ one }) => ({
  subject: one(kosmoEntities, {
    fields: [kosmoClaims.subjectId],
    references: [kosmoEntities.id],
    relationName: "claimSubject",
  }),
  object: one(kosmoEntities, {
    fields: [kosmoClaims.objectId],
    references: [kosmoEntities.id],
    relationName: "claimObject",
  }),
  source: one(kosmoSources, {
    fields: [kosmoClaims.sourceId],
    references: [kosmoSources.id],
  }),
}));

export const kosmoTaxaRelations = relations(kosmoTaxa, ({ one, many }) => ({
  parent: one(kosmoTaxa, {
    fields: [kosmoTaxa.parentId],
    references: [kosmoTaxa.id],
    relationName: "taxonParent",
  }),
  children: many(kosmoTaxa, { relationName: "taxonParent" }),
  entities: many(kosmoEntityTaxa),
}));

export const kosmoEntityTaxaRelations = relations(
  kosmoEntityTaxa,
  ({ one }) => ({
    entity: one(kosmoEntities, {
      fields: [kosmoEntityTaxa.entityId],
      references: [kosmoEntities.id],
    }),
    taxon: one(kosmoTaxa, {
      fields: [kosmoEntityTaxa.taxonId],
      references: [kosmoTaxa.id],
    }),
  })
);

// Inferred types

export type KosmoSource = typeof kosmoSources.$inferSelect;
export type NewKosmoSource = typeof kosmoSources.$inferInsert;

export type KosmoEntity = typeof kosmoEntities.$inferSelect;
export type NewKosmoEntity = typeof kosmoEntities.$inferInsert;

export type KosmoClaim = typeof kosmoClaims.$inferSelect;
export type NewKosmoClaim = typeof kosmoClaims.$inferInsert;

export type KosmoTaxon = typeof kosmoTaxa.$inferSelect;
export type NewKosmoTaxon = typeof kosmoTaxa.$inferInsert;

export type KosmoEntityTaxon = typeof kosmoEntityTaxa.$inferSelect;
export type NewKosmoEntityTaxon = typeof kosmoEntityTaxa.$inferInsert;
