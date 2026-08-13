import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Local mirror of the Riftcodex card database.
 *
 * This table is disposable — identical on every device, re-syncable at any
 * time, and never synced through Supabase. It exists because the API cannot
 * filter by type, domain, rarity, or cost (docs/API.md §4), so a usable gallery
 * has to filter locally.
 *
 * The API's nested objects are flattened on write so every filter is a plain
 * indexed column rather than a JSON scan across 1,451 rows.
 */
export const cards = sqliteTable(
  'cards',
  {
    /** Riftcodex ID. Stable primary key. */
    id: text('id').primaryKey(),
    /** e.g. `ogn-011-298`. May contain `*`; NOT unique across alternate printings. */
    riftboundId: text('riftbound_id').notNull(),
    tcgplayerId: text('tcgplayer_id'),

    name: text('name').notNull(),
    /** Better for sorting and fuzzy matching than `name`. */
    cleanName: text('clean_name').notNull(),
    collectorNumber: integer('collector_number'),

    // Flattened from `attributes` — null for Legends and Battlefields.
    energy: integer('energy'),
    might: integer('might'),
    power: integer('power'),

    // Flattened from `classification`.
    type: text('type').notNull(),
    supertype: text('supertype'),
    rarity: text('rarity').notNull(),
    /** JSON array, e.g. `["Fury","Order"]`. */
    domains: text('domains', { mode: 'json' }).$type<string[]>().notNull(),
    /**
     * Sorted CSV of `domains`, e.g. `"Fury,Order"`. Indexed, and the reason the
     * builder's "legal in my Legend's identity" query is a single scan.
     */
    domainKey: text('domain_key').notNull(),

    textPlain: text('text_plain'),
    textRich: text('text_rich'),
    flavour: text('flavour'),
    /** JSON array. Mixed semantics: champion names, regions, unit types. */
    tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),

    setId: text('set_id').notNull(),
    setLabel: text('set_label').notNull(),

    imageUrl: text('image_url'),
    artist: text('artist'),
    /** Screen-reader description, supplied by the API. */
    accessibilityText: text('accessibility_text'),
    orientation: text('orientation').notNull().default('portrait'),

    alternateArt: integer('alternate_art', { mode: 'boolean' }).notNull().default(false),
    signature: integer('signature', { mode: 'boolean' }).notNull().default(false),
    overnumbered: integer('overnumbered', { mode: 'boolean' }).notNull().default(false),
    isNew: integer('is_new', { mode: 'boolean' }).notNull().default(false),

    /** ISO 8601. The incremental-sync key. */
    updatedOn: text('updated_on'),
  },
  (t) => [
    index('cards_type_idx').on(t.type),
    index('cards_domain_key_idx').on(t.domainKey),
    index('cards_set_idx').on(t.setId),
    index('cards_rarity_idx').on(t.rarity),
    index('cards_energy_idx').on(t.energy),
    index('cards_clean_name_idx').on(t.cleanName),
    // The deck builder's hot path: cards of a type within a domain identity.
    index('cards_type_domain_idx').on(t.type, t.domainKey),
  ]
);

/*
 * There was a `sets` table here, mirroring `GET /sets`. Dropped in migration 22.
 *
 * It was written on every sync and read by nothing. The check it appears to
 * exist for does not use it — `syncCards` compares the **live** response's card
 * total against `COUNT(*)` on `cards` — and `setCompletion()` derives per-set
 * progress from `cards` as well. Two copies of a set's card count that could
 * disagree, with no reader to notice.
 */

/** Single-row table tracking the state of the card mirror. */
export const syncMeta = sqliteTable('sync_meta', {
  id: integer('id').primaryKey(),
  lastSyncedAt: text('last_synced_at'),
  cardCount: integer('card_count').notNull().default(0),
  seedVersion: text('seed_version'),
  lastError: text('last_error'),
  /*
   * `api_version` was here from migration 1 and never read or written. The
   * Riftcodex API publishes no version header to put in it (docs/API.md §6),
   * so it was a slot for a fact that does not exist. Dropped in migration 22.
   */
});

export type CardRow = typeof cards.$inferSelect;
export type NewCardRow = typeof cards.$inferInsert;
