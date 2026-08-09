import { supportsFinish, type Finish } from '@/lib/finishes';
import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { CardRow } from '../schema/cards';
import type { BinderRow } from '../schema/collection';

import { hydrateBinder } from './hydrate';

/**
 * The collection: binders, and the cards inside them.
 *
 * What you own of a card is derived, never stored — `SUM(quantity)` across
 * every live binder. So the total and its breakdown can never disagree, and
 * deleting a binder subtracts exactly the copies it held with nothing left to
 * reconcile.
 *
 * Every write funnels through `setCardQuantity`, including the adjust helpers,
 * because "quantity reaches zero" has to delete the row rather than store a
 * zero. A zero row is invisible in the UI and still occupies the unique index,
 * so a later add would collide with something the user cannot see.
 */

const now = () => new Date().toISOString();

export interface Binder extends BinderRow {
  /** Distinct cards in this binder. */
  distinctCards: number;
  /** Total copies — the number a collector actually quotes. */
  totalCards: number;
}


/* ------------------------------------------------------------------ binders */

export function listBinders(): Binder[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      // DISTINCT card_id, not row count: since migration 13 a card held in
      // both finishes is two rows, and "2 cards · 4 copies" for one card in two
      // treatments is simply wrong.
      `SELECT b.*,
              COUNT(DISTINCT bc.card_id)       AS distinct_cards,
              COALESCE(SUM(bc.quantity), 0)    AS total_cards
         FROM binders b
         LEFT JOIN binder_cards bc ON bc.binder_id = b.id
        WHERE b.deleted_at IS NULL
        GROUP BY b.id
        ORDER BY b.sort_order ASC, b.created_at ASC`
    )
    .map((row) => ({
      ...hydrateBinder(row),
      distinctCards: Number(row.distinct_cards ?? 0),
      totalCards: Number(row.total_cards ?? 0),
    }));
}

export function createBinder(input: { name: string; accent?: string | null }): string {
  const id = newId();
  const timestamp = now();
  const next =
    (conn().getFirstSync<{ n: number | null }>(
      'SELECT MAX(sort_order) AS n FROM binders WHERE deleted_at IS NULL'
    )?.n ?? -1) + 1;

  conn().runSync(
    `INSERT INTO binders (id, name, accent, sort_order, created_at, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, input.name.trim() || 'Binder', input.accent ?? null, next, timestamp, timestamp]
  );
  return id;
}

export function renameBinder(binderId: string, name: string, accent?: string | null): void {
  conn().runSync(
    `UPDATE binders SET name = ?, accent = ?, updated_at = ?, dirty = 1 WHERE id = ?`,
    [name.trim() || 'Binder', accent ?? null, now(), binderId]
  );
}

/**
 * Soft delete, and the cards go with it.
 *
 * Deliberately not a hard delete: sync cannot propagate a row that no longer
 * exists. The card rows stay attached to the tombstone rather than being
 * removed, so the binder can come back intact if a later feature offers undo —
 * and because owned totals only count live binders, the copies stop being
 * counted the moment this runs.
 */
export function deleteBinder(binderId: string): void {
  conn().runSync('UPDATE binders SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    now(),
    now(),
    binderId,
  ]);
}

/* -------------------------------------------------------------------- cards */

/**
 * Copies of each card in one binder, by card id.
 *
 * Deliberately no join to `cards` and no hydration. This runs on **every tap**
 * — the grid's badges read it — and an earlier version selected `c.*` and built
 * full card rows to produce the same two columns. Measured at the library's
 * full size that was 75 ms a tap against 2 ms for this; the screen already has
 * the card rows it is rendering, so fetching them again was pure waste.
 */
export interface FinishCounts {
  standard: number;
  foil: number;
  /** Both finishes. What "is this card in the binder" means. */
  total: number;
}

export function binderQuantities(binderId: string): Map<string, FinishCounts> {
  const rows = conn().getAllSync<{ card_id: string; finish: string; n: number }>(
    `SELECT card_id, finish, SUM(quantity) AS n
       FROM binder_cards WHERE binder_id = ?
      GROUP BY card_id, finish`,
    [binderId]
  );

  /*
   * Both finishes in one map rather than a filtered query per finish. The
   * screen needs two different answers from this — which cards are in the
   * binder, and how many of the finish the buttons act on — and deriving them
   * from one read is what stops a foil-only card disappearing from its own
   * binder because the toggle happened to say Standard.
   */
  const counts = new Map<string, FinishCounts>();
  for (const row of rows) {
    const entry = counts.get(row.card_id) ?? { standard: 0, foil: 0, total: 0 };
    const n = Number(row.n);
    if (row.finish === 'foil') entry.foil += n;
    else entry.standard += n;
    entry.total += n;
    counts.set(row.card_id, entry);
  }
  return counts;
}

/**
 * Cards in a binder that the card library cannot currently resolve.
 *
 * These are real cards the player owns whose printing has left the mirror. The
 * grid renders from `cards`, so without this they would silently vanish from
 * their own binder — stored, counted in the totals, and invisible. Same class
 * of defect as the editor never mentioning unresolvable deck cards.
 */
export function missingFromLibrary(binderId: string): { name: string; quantity: number }[] {
  return conn()
    .getAllSync<{ card_name: string | null; n: number }>(
      // Grouped by name: the same card in two finishes is one missing card as
      // far as "what can this screen not draw" is concerned.
      `SELECT bc.card_name, SUM(bc.quantity) AS n
         FROM binder_cards bc
         LEFT JOIN cards c ON c.id = bc.card_id
        WHERE bc.binder_id = ? AND c.id IS NULL
        GROUP BY bc.card_name
        ORDER BY bc.card_name COLLATE NOCASE ASC`,
      [binderId]
    )
    .map((row) => ({ name: row.card_name ?? 'Unknown card', quantity: Number(row.n) }));
}

/** Copies of each card across every live binder, keyed by card id. */
export function ownedCounts(): Map<string, number> {
  const rows = conn().getAllSync<{ card_id: string; n: number }>(
    `SELECT bc.card_id, SUM(bc.quantity) AS n
       FROM binder_cards bc
       JOIN binders b ON b.id = bc.binder_id AND b.deleted_at IS NULL
      GROUP BY bc.card_id`
  );
  return new Map(rows.map((r) => [r.card_id, Number(r.n)]));
}

/**
 * Copies of one card in one binder. Without a finish, both are counted.
 *
 * The two callers want different things and both are right: the adjust path
 * needs one finish's row to write back, the display path wants the card's total
 * regardless of treatment.
 */
export function quantityIn(binderId: string, cardId: string, finish?: Finish): number {
  return Number(
    conn().getFirstSync<{ n: number | null }>(
      finish
        ? 'SELECT SUM(quantity) AS n FROM binder_cards WHERE binder_id = ? AND card_id = ? AND finish = ?'
        : 'SELECT SUM(quantity) AS n FROM binder_cards WHERE binder_id = ? AND card_id = ?',
      finish ? [binderId, cardId, finish] : [binderId, cardId]
    )?.n ?? 0
  );
}

/**
 * Set a card's count in a binder. Zero or less removes the row entirely.
 *
 * Upsert rather than insert-or-update, so two rapid taps cannot collide on the
 * unique index — the same lesson as `deck_version_cards`.
 *
 * Private: every caller adjusts by a delta, and an exported "set to exactly N"
 * with no caller is the shape of the unreachable query functions already
 * recorded as gaps 6 and 7. Export it when a screen types a number in.
 */
function setCardQuantity(
  binderId: string,
  card: CardRow,
  quantity: number,
  finish: Finish
): void {
  const timestamp = now();

  if (quantity <= 0) {
    conn().runSync(
      'DELETE FROM binder_cards WHERE binder_id = ? AND card_id = ? AND finish = ?',
      [binderId, card.id, finish]
    );
    return;
  }

  conn().runSync(
    `INSERT INTO binder_cards
       (id, binder_id, card_id, card_name, riftbound_id, quantity, finish, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(binder_id, card_id, finish) DO UPDATE SET
       quantity   = excluded.quantity,
       card_name  = excluded.card_name,
       updated_at = excluded.updated_at`,
    [
      newId(),
      binderId,
      card.id,
      card.cleanName || card.name,
      card.riftboundId,
      quantity,
      finish,
      timestamp,
      timestamp,
    ]
  );
}

export class FinishNotPrintedError extends Error {
  constructor(
    readonly cardId: string,
    readonly finish: Finish
  ) {
    super(`This card was not printed in ${finish}.`);
    this.name = 'FinishNotPrintedError';
  }
}

/**
 * Add or remove copies of one finish, clamped at zero.
 *
 * Throws rather than substituting. An earlier version quietly filed a foil when
 * asked for a standard Legend — the app recording something the user had not
 * asked for, which in a collection tracker is the one thing it must never do.
 * The grid blocks the tap before it gets here; this is the guarantee that a
 * second screen cannot skip.
 */
export function adjustCardQuantity(
  binderId: string,
  card: CardRow,
  delta: number,
  finish: Finish = 'standard'
): number {
  if (!supportsFinish(card, finish)) throw new FinishNotPrintedError(card.id, finish);

  const next = Math.max(0, quantityIn(binderId, card.id, finish) + delta);
  setCardQuantity(binderId, card, next, finish);
  return next;
}

/*
 * There was a `collectionSummary()` here, returning binder / distinct / total
 * counts in one query. Deleted: the screen already holds `ownedCounts()` for
 * the badges, and `size` and a sum over that map are the same three numbers for
 * free — from the *same* data the badges came from. A second query answering a
 * question the loaded data already answers is a second source of truth, which
 * is exactly what this module was designed to avoid.
 */
