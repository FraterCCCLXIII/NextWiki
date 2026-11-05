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
import { wikiPages } from "./index.js";

type KosmoEntityKind =
  | "object"
  | "domain_node"
  | "concept"
  | "module"
  | "lesson"
  | "event"
  | "period"
  | "stage";

type KosmoTaxonScheme =
  | "astronomy"
  | "physics"
  | "math"
  | "philosophy"
  | "models"
  | "curriculum"
  | "history";

/**
 * How much weight a source carries. `primary` is the archive or agency that
 * measured the value; `structured` is a linked-data mirror (Wikidata);
 * `tertiary` is a general encyclopedia; `generated` is machine-written text
 * that no human has reviewed yet.
 */
export type KosmoTrustTier = "primary" | "structured" | "tertiary" | "generated";

/**
 * How a claim's value reached us. `verbatim` was copied as published;
 * `converted` was recomputed into our units from a published column;
 * `derived` was computed from other claims; `inferred` is a guess we made;
 * `generated` is model output.
 */
export type KosmoClaimMethod =
  | "verbatim"
  | "converted"
  | "derived"
  | "inferred"
  | "generated";

export type KosmoTimeKind = "instant" | "interval" | "recurring";

// Provenance for catalogue rows, imported documents and other source material.
// Licence and retrieval date live here, not in the document, so a credit can be
// rendered for every claim without consulting the page that quotes it.
export const kosmoSources = pgTable("kosmo_sources", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  url: text("url"),
  publisher: text("publisher"),
  license: text("license"),
  licenseUrl: text("license_url"),
  /** When the source was read, for live queries and archives alike. */
  retrievedAt: timestamp("retrieved_at"),
  trustTier: text("trust_tier").$type<KosmoTrustTier>(),
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
    /**
     * Typed time axis, in signed years of the astronomical calendar (year 0 is
     * 1 BCE). One numeric axis for 13.8 Gyr and for a dated battle: the viewer
     * and the timeline query the same column at different precision.
     */
    timeStart: doublePrecision("time_start"),
    timeEnd: doublePrecision("time_end"),
    timePrecisionYears: doublePrecision("time_precision_years"),
    timeKind: text("time_kind").$type<KosmoTimeKind>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("kosmo_entities_kind_idx").on(t.kind),
    index("kosmo_entities_type_idx").on(t.type),
    index("kosmo_entities_page_id_idx").on(t.pageId),
    index("kosmo_entities_time_start_idx").on(t.timeStart),
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
    /** Symmetric uncertainty of valueNum, in the same unit. */
    valueErr: doublePrecision("value_err"),
    unit: text("unit"),
    /** The primary source. Additional sources go in kosmo_claim_sources. */
    sourceId: integer("source_id").references(() => kosmoSources.id),
    method: text("method").$type<KosmoClaimMethod>(),
    /** Free-form context: measurement basis, epoch, disputed, "1-bar level". */
    qualifiers: jsonb("qualifiers").$type<Record<string, unknown>>().default({}),
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

/**
 * Identity beyond our own slug: one row per external scheme. Without this a
 * catalogue can be imported once and never reconciled against a new release,
 * because two rows for Sirius have no shared key.
 */
export const kosmoEntityExternalIds = pgTable(
  "kosmo_entity_external_ids",
  {
    id: serial("id").primaryKey(),
    entityId: integer("entity_id")
      .notNull()
      .references(() => kosmoEntities.id, { onDelete: "cascade" }),
    /** wikidata, wikipedia, exoplanet_archive, simbad, ned, hip, gaia, mpc, ... */
    scheme: text("scheme").notNull(),
    value: text("value").notNull(),
    url: text("url"),
    sourceId: integer("source_id").references(() => kosmoSources.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    unique("kosmo_entity_external_ids_scheme_value_uq").on(t.scheme, t.value),
    index("kosmo_entity_external_ids_entity_id_idx").on(t.entityId),
  ]
);

/**
 * Every source that supports a claim. A catalogue row commonly cites an archive
 * query and an encyclopedia article at once, which one sourceId cannot express.
 */
export const kosmoClaimSources = pgTable(
  "kosmo_claim_sources",
  {
    claimId: integer("claim_id")
      .notNull()
      .references(() => kosmoClaims.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => kosmoSources.id, { onDelete: "cascade" }),
    /** Where inside the source: a URL, a query string, or "field:mass_kg". */
    locator: text("locator"),
    stance: text("stance")
      .$type<"supports" | "disputes" | "mentions">()
      .default("supports"),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.sourceId] })]
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
  claimSources: many(kosmoClaimSources),
  externalIds: many(kosmoEntityExternalIds),
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
    externalIds: many(kosmoEntityExternalIds),
  })
);

export const kosmoClaimsRelations = relations(kosmoClaims, ({ one, many }) => ({
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
  claimSources: many(kosmoClaimSources),
}));

export const kosmoEntityExternalIdsRelations = relations(
  kosmoEntityExternalIds,
  ({ one }) => ({
    entity: one(kosmoEntities, {
      fields: [kosmoEntityExternalIds.entityId],
      references: [kosmoEntities.id],
    }),
    source: one(kosmoSources, {
      fields: [kosmoEntityExternalIds.sourceId],
      references: [kosmoSources.id],
    }),
  })
);

export const kosmoClaimSourcesRelations = relations(
  kosmoClaimSources,
  ({ one }) => ({
    claim: one(kosmoClaims, {
      fields: [kosmoClaimSources.claimId],
      references: [kosmoClaims.id],
    }),
    source: one(kosmoSources, {
      fields: [kosmoClaimSources.sourceId],
      references: [kosmoSources.id],
    }),
  })
);

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

/**
 * Whole data files served to the original Kosmographica HTML pages at their old URLs
 * (the Oracle *-data.js files, university-exams.json). Editable rows, not entity-shaped.
 */
export const kosmoDatasets = pgTable("kosmo_datasets", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inferred types

export type KosmoSource = typeof kosmoSources.$inferSelect;
export type NewKosmoSource = typeof kosmoSources.$inferInsert;

export type KosmoEntity = typeof kosmoEntities.$inferSelect;
export type NewKosmoEntity = typeof kosmoEntities.$inferInsert;

export type KosmoClaim = typeof kosmoClaims.$inferSelect;
export type NewKosmoClaim = typeof kosmoClaims.$inferInsert;

export type KosmoTaxon = typeof kosmoTaxa.$inferSelect;
export type NewKosmoTaxon = typeof kosmoTaxa.$inferInsert;

export type KosmoEntityExternalId = typeof kosmoEntityExternalIds.$inferSelect;
export type NewKosmoEntityExternalId = typeof kosmoEntityExternalIds.$inferInsert;

export type KosmoClaimSource = typeof kosmoClaimSources.$inferSelect;
export type NewKosmoClaimSource = typeof kosmoClaimSources.$inferInsert;

export type KosmoEntityTaxon = typeof kosmoEntityTaxa.$inferSelect;
export type NewKosmoEntityTaxon = typeof kosmoEntityTaxa.$inferInsert;

export type KosmoDataset = typeof kosmoDatasets.$inferSelect;
export type NewKosmoDataset = typeof kosmoDatasets.$inferInsert;
