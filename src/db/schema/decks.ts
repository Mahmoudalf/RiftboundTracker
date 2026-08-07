import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * User data — decks and their version history.
 *
 * Unlike the card mirror this is precious: it is the only thing in the database
 * that cannot be regenerated. Every table therefore carries the sync columns
 * (`deletedAt`, `userId`, `dirty`, `updatedByDevice`) from the start, because
 * retrofitting soft deletes onto rows that have already been hard-deleted is
 * not possible — the evidence is gone.
 */

/** Columns every synced user table carries. Spread into each table below. */
const syncColumns = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** Soft delete. Sync cannot propagate a row that no longer exists. */
  deletedAt: text('deleted_at'),
  /** Null until the user signs in; the app is fully functional signed out. */
  userId: text('user_id'),
  dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
  updatedByDevice: text('updated_by_device'),
};

export const decks = sqliteTable(
  'decks',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),

    /** Defines the deck's domain identity. */
    legendCardId: text('legend_card_id'),
    championCardId: text('champion_card_id'),
    /**
     * JSON array, denormalized from the Legend.
     *
     * The deck list renders a domain gradient for every row; joining to `cards`
     * for that would make the list depend on the card mirror being present, and
     * the mirror is disposable.
     */
    domains: text('domains', { mode: 'json' }).$type<string[]>().notNull(),

    format: text('format').notNull().default('constructed'),
    notes: text('notes'),

    currentVersionId: text('current_version_id'),
    archivedAt: text('archived_at'),

    ...syncColumns,
  },
  (t) => [
    index('decks_archived_idx').on(t.archivedAt),
    index('decks_deleted_idx').on(t.deletedAt),
  ]
);

export const deckVersions = sqliteTable(
  'deck_versions',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull(),
    /** 1-based, per deck. */
    versionNumber: integer('version_number').notNull(),
    /** Auto-suggested from the diff ("−2 Bewitching Spirit"), user-editable. */
    label: text('label'),
    notes: text('notes'),
    parentVersionId: text('parent_version_id'),

    /**
     * Non-null once at least one match references this version.
     *
     * The heart of the whole model: a locked version is immutable, so editing it
     * forks a new one and the matches already played stay attached to the list
     * that actually played them.
     */
    lockedAt: text('locked_at'),

    // Denormalized so the version timeline renders without loading card rows.
    mainCount: integer('main_count').notNull().default(0),
    runeCount: integer('rune_count').notNull().default(0),
    battlefieldCount: integer('battlefield_count').notNull().default(0),
    isLegal: integer('is_legal', { mode: 'boolean' }).notNull().default(false),
    /**
     * Which revision of the legality rules wrote the four columns above. Rows
     * stamped with an older revision are recomputed on read — see
     * `RULES_VERSION` in `lib/legality.ts`.
     */
    rulesVersion: integer('rules_version').notNull().default(0),

    ...syncColumns,
  },
  (t) => [
    index('deck_versions_deck_idx').on(t.deckId),
    uniqueIndex('deck_versions_number_idx').on(t.deckId, t.versionNumber),
  ]
);

export const deckVersionCards = sqliteTable(
  'deck_version_cards',
  {
    id: text('id').primaryKey(),
    deckVersionId: text('deck_version_id').notNull(),
    cardId: text('card_id').notNull(),
    /** Denormalized fallback if a printing ever leaves the API. */
    riftboundId: text('riftbound_id').notNull(),
    /**
     * The card's name, denormalized for the same reason.
     *
     * Without it a row whose card has left the mirror is unidentifiable — it
     * cannot be shown to the user, and a save cannot tell that the card being
     * written is the same card, so it stores a second row and the deck quietly
     * gains copies. Null only for rows whose card was already missing when
     * migration 5 ran.
     */
    cardName: text('card_name'),
    quantity: integer('quantity').notNull(),
    /** `legend` | `champion` | `main` | `rune` | `battlefield` | `sideboard` */
    zone: text('zone').notNull(),
  },
  (t) => [
    index('dvc_version_idx').on(t.deckVersionId),
    uniqueIndex('dvc_unique_idx').on(t.deckVersionId, t.cardId, t.zone),
  ]
);

export type DeckRow = typeof decks.$inferSelect;
export type NewDeckRow = typeof decks.$inferInsert;
export type DeckVersionRow = typeof deckVersions.$inferSelect;
export type DeckVersionCardRow = typeof deckVersionCards.$inferSelect;
