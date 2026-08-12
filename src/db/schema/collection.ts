import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * The collection — what the player physically owns, organised into binders.
 *
 * There is deliberately no `owned_quantity` column anywhere. A card's owned
 * total is the sum of its rows across binders, so the number and its
 * explanation are the same fact: three copies *is* two in the trade binder and
 * one in a deck box. A flat count kept beside binder contents would be two
 * numbers for one thing, and drift is only a matter of time.
 *
 * Precious like decks and matches, disposable like nothing — every table
 * carries the sync columns from the start.
 */

export const binders = sqliteTable(
  'binders',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** A domain name, or null. Binders are picked out of a rail by colour. */
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),

    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
    userId: text('user_id'),
    dirty: integer('dirty', { mode: 'boolean' }).notNull().default(true),
    updatedByDevice: text('updated_by_device'),
  },
  (t) => [index('binders_deleted_idx').on(t.deletedAt)]
);

export const binderCards = sqliteTable(
  'binder_cards',
  {
    id: text('id').primaryKey(),
    binderId: text('binder_id').notNull(),
    cardId: text('card_id').notNull(),
    /**
     * Denormalized, for the same reason as `deck_version_cards.cardName`: the
     * card mirror can be rebuilt and this cannot. A printing leaving the
     * library must not make a card you own unrenderable — you still have it.
     */
    cardName: text('card_name'),
    riftboundId: text('riftbound_id'),
    quantity: integer('quantity').notNull(),
    /**
     * `standard` | `foil` — a row per finish, not a column per finish.
     *
     * Which finishes a card even *has* is not in the card data; see
     * `lib/finishes.ts`, which is the only place that rule lives.
     */
    finish: text('finish').notNull().default('standard'),

    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('binder_cards_binder_idx').on(t.binderId),
    index('binder_cards_card_idx').on(t.cardId),
    uniqueIndex('binder_cards_unique_idx').on(t.binderId, t.cardId, t.finish),
  ]
);

export type BinderRow = typeof binders.$inferSelect;
// No `BinderCardRow`: nothing reads a whole `binder_cards` row. Every query
// projects — quantities by card, or names of what the library cannot resolve.
