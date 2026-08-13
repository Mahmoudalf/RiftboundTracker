import { cardKey } from '@/lib/card-identity';

import { conn } from '../connection';

/**
 * How much of a deck you actually own.
 *
 * Copies are shared, because physical cards are: three Vi cannot be sleeved in
 * two decks at once. So ownership is allocated across decks rather than
 * answered per deck in isolation — a deck reports what is *left* for it after
 * the decks ahead of it have taken their copies.
 *
 * **The order is by deck creation, oldest first.** It has to be something, and
 * it has to be stable: `updated_at` moves every time a match is logged, which
 * would make these numbers drift for reasons that have nothing to do with cards
 * changing hands.
 *
 * Two rules follow from the physical object:
 *
 * - **A printing is a printing.** A deck listing "Poppy - Paragon" is satisfied
 *   by "Poppy - Paragon (Alternate Art)", and by a foil, because it is the same
 *   card to the rules. Matching is on `cardKey()`, the same
 *   printing-collapsed identity the 3-copy limit counts against.
 * - **Archived decks claim nothing.** Archiving is how you say you are not
 *   playing something; its cards go back in the pool.
 *
 * Nothing here blocks anything. A deck you own none of still saves, still logs
 * matches, and still reports its record — it just says 0/59.
 */

export interface CardShortfall {
  name: string;
  /** Copies the deck lists. */
  need: number;
  /** Copies still available to it once earlier decks have taken theirs. */
  have: number;
}

/**
 * What the builder shows on a card.
 *
 * Both numbers, because `available: 0` alone cannot say whether you own none of
 * a card or own three that are all sleeved in other decks — the same figure,
 * and completely different advice.
 */
export interface CardAvailability {
  /** Copies you hold across live binders, both finishes. */
  owned: number;
  /** Of those, how many no older deck has claimed. */
  available: number;
}

export interface DeckCoverage {
  /** Copies of this deck's cards you own and that nothing older has claimed. */
  owned: number;
  /** Copies the deck lists, across every zone. */
  required: number;
  /** Only the cards that come up short, worst first. */
  shortfalls: CardShortfall[];
}

interface Need {
  deckId: string;
  key: string;
  name: string;
  quantity: number;
}

/**
 * Copies owned per printing-collapsed card, summed across live binders and both
 * finishes.
 *
 * The card's live name is preferred over the denormalized one so a row written
 * before migration 14 still keys correctly; the stored name is the fallback for
 * printings the mirror no longer has.
 */
function ownedByKey(): Map<string, number> {
  const rows = conn().getAllSync<{ stored: string | null; live: string | null; n: number }>(
    `SELECT bc.card_name AS stored, c.name AS live, SUM(bc.quantity) AS n
       FROM binder_cards bc
       JOIN binders b ON b.id = bc.binder_id AND b.deleted_at IS NULL
       LEFT JOIN cards c ON c.id = bc.card_id
      GROUP BY bc.card_id`
  );

  const owned = new Map<string, number>();
  for (const row of rows) {
    const name = row.live ?? row.stored;
    if (!name) continue;
    const key = cardKey({ name });
    owned.set(key, (owned.get(key) ?? 0) + Number(row.n));
  }
  return owned;
}

/** Every live deck's card requirements, oldest deck first. */
function needsByDeck(): Need[] {
  return conn()
    .getAllSync<{
      deck_id: string;
      stored: string | null;
      live: string | null;
      quantity: number;
    }>(
      `SELECT d.id AS deck_id, dvc.card_name AS stored, c.name AS live, dvc.quantity
         FROM decks d
         JOIN deck_version_cards dvc ON dvc.deck_version_id = d.current_version_id
         LEFT JOIN cards c ON c.id = dvc.card_id
        WHERE d.deleted_at IS NULL AND d.archived_at IS NULL
        -- rowid, not id, as the tie-break. created_at is millisecond
        -- resolution, so two decks made in quick succession share a timestamp,
        -- and breaking that tie on a random uuid makes the allocation order --
        -- and therefore the numbers a user reads -- arbitrary. rowid is
        -- insertion order and cannot tie.
        ORDER BY d.created_at ASC, d.rowid ASC`
    )
    .flatMap((row) => {
      const name = row.live ?? row.stored;
      if (!name) return [];
      return [
        {
          deckId: row.deck_id,
          key: cardKey({ name }),
          name,
          quantity: Number(row.quantity),
        },
      ];
    });
}

/**
 * Copies free for one deck to use, per printing-collapsed card.
 *
 * The builder's per-tile answer to "can I actually sleeve this?". It is the
 * same allocation `deckCoverage` performs, stopped one step earlier: the pool
 * as it stands when this deck's turn comes, before this deck takes anything.
 *
 * **This deck's own claims are not deducted**, and that is the whole point of
 * the number. Owning 3 and already listing 2 here means 3 are available *to
 * this deck* — the two in the list are not spoken for by anyone else. Deducting
 * them would make the badge fall as you build and read as though adding a card
 * consumed a copy you no longer had, when the copy is sitting in this very
 * deck.
 *
 * Decks **newer** than this one do not deduct either, for the same reason they
 * do not in `deckCoverage`: they draw from what is left after this one, so they
 * cannot reduce what this one may claim.
 *
 * A deck with no cards yet appears in no requirement row, so it is treated as
 * last — a deck you have just created sees exactly what every existing deck has
 * left over, which is the honest answer while it is still empty.
 */
export function availableForDeck(deckId: string): Map<string, CardAvailability> {
  const owned = ownedByKey();
  const pool = new Map(owned);
  const needs = needsByDeck();

  // Allocation order, oldest deck first, derived from the row order rather
  // than re-sorted here — one definition of "who goes first", in the query.
  const position = new Map<string, number>();
  for (const need of needs) {
    if (!position.has(need.deckId)) position.set(need.deckId, position.size);
  }

  const mine = position.get(deckId) ?? position.size;

  for (const need of needs) {
    if (need.deckId === deckId) continue;
    if ((position.get(need.deckId) ?? 0) > mine) continue;

    const have = pool.get(need.key) ?? 0;
    pool.set(need.key, Math.max(0, have - need.quantity));
  }

  const result = new Map<string, CardAvailability>();
  for (const [key, total] of owned) {
    result.set(key, { owned: total, available: pool.get(key) ?? 0 });
  }
  return result;
}

/**
 * How a card's availability reads in the builder.
 *
 * One function so the list row and the gallery tile cannot word the same fact
 * differently.
 *
 * Both numbers are shown because `available` alone is ambiguous in the way that
 * matters: 0 free means "buy one" when you own none and "unsleeve the other
 * deck" when you own three, and those are opposite actions.
 *
 * **Callers must skip this entirely when the collection is empty** — the map is
 * keyed on cards you hold, so with nothing catalogued every one of ~900
 * candidates would read "Not owned", which is noise rather than information.
 * `availableForDeck(...).size === 0` is that check.
 */
export function availabilityLabel(entry: CardAvailability | undefined): string {
  if (!entry || entry.owned === 0) return 'Not owned';
  return `${entry.available} of ${entry.owned} free`;
}

export function deckCoverage(deckId: string): DeckCoverage {
  const pool = ownedByKey();
  const needs = needsByDeck();

  let owned = 0;
  let required = 0;
  const shortfalls: CardShortfall[] = [];

  for (const need of needs) {
    const available = pool.get(need.key) ?? 0;
    // Older decks draw from the same pool first, so by the time this deck is
    // reached the pool already reflects what they took.
    const taken = Math.min(available, need.quantity);
    pool.set(need.key, available - taken);

    if (need.deckId !== deckId) continue;

    required += need.quantity;
    owned += taken;
    if (taken < need.quantity) {
      shortfalls.push({ name: need.name, need: need.quantity, have: taken });
    }
  }

  shortfalls.sort((a, b) => b.need - b.have - (a.need - a.have) || a.name.localeCompare(b.name));
  return { owned, required, shortfalls };
}
