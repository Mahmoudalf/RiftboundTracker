import { newId } from '@/lib/id';
import {
  checkLegality,
  RULES_VERSION,
  type DeckList,
  type DeckSlot,
  type DeckZone,
} from '@/lib/legality';

import { conn } from '../connection';
import type { CardRow } from '../schema/cards';
import type { DeckRow, DeckVersionRow } from '../schema/decks';

import { hydrateCard, hydrateDeck, hydrateDeckVersion } from './hydrate';

/**
 * Deck reads and writes.
 *
 * The version rules live here rather than in the UI so every entry point obeys
 * them — the editor, decklist import, and (in M4) the match logger all go
 * through the same functions.
 */

export interface DeckSummary {
  deck: DeckRow;
  /** The version the deck currently points at. Null only if data is corrupt. */
  version: DeckVersionRow | null;
  versionCount: number;
}

export interface CreateDeckInput {
  name: string;
  legend: CardRow;
  champion: CardRow | null;
  /**
   * The full decklist, when the build flow has one ready.
   *
   * The wizard holds everything in a draft and commits at the end, so the deck,
   * its first version, and all ~57 cards land in a single transaction. Omit it
   * and the version starts with just the Legend and Champion.
   */
  slots?: readonly DeckSlot[];
}

function now(): string {
  return new Date().toISOString();
}

export function listDecks(includeArchived = false): DeckSummary[] {
  refreshStaleVersions();

  const rows = conn().getAllSync<Record<string, unknown>>(
    `SELECT d.*,
            (SELECT COUNT(*) FROM deck_versions v
              WHERE v.deck_id = d.id AND v.deleted_at IS NULL) AS version_count
       FROM decks d
      WHERE d.deleted_at IS NULL
        ${includeArchived ? '' : 'AND d.archived_at IS NULL'}
      ORDER BY d.updated_at DESC`
  );

  return rows.map((row) => {
    const deck = hydrateDeck(row);
    return {
      deck,
      version: deck.currentVersionId ? getVersion(deck.currentVersionId) : null,
      versionCount: Number(row.version_count ?? 0),
    };
  });
}

export function getDeck(id: string): DeckRow | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM decks WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return row ? hydrateDeck(row) : null;
}

export function getVersion(id: string): DeckVersionRow | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM deck_versions WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return row ? hydrateDeckVersion(row) : null;
}

export function listVersions(deckId: string): DeckVersionRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT * FROM deck_versions
        WHERE deck_id = ? AND deleted_at IS NULL
        ORDER BY version_number DESC`,
      [deckId]
    )
    .map(hydrateDeckVersion);
}

/**
 * Load a version's cards as a `DeckList`, joined to the card mirror.
 *
 * Cards missing from the mirror are dropped rather than faked. That only
 * happens if a printing leaves the API or the mirror is mid-resync, and a
 * decklist that silently gained a placeholder card would report the wrong
 * legality — better to show 39/40 and be honestly wrong about the count than to
 * invent a card.
 */
export function loadDeckList(versionId: string): DeckList {
  const rows = conn().getAllSync<Record<string, unknown>>(
    `SELECT c.*, dvc.quantity AS dvc_quantity, dvc.zone AS dvc_zone
       FROM deck_version_cards dvc
       JOIN cards c ON c.id = dvc.card_id
      WHERE dvc.deck_version_id = ?`,
    [versionId]
  );

  const slots: DeckSlot[] = rows.map((row) => ({
    card: hydrateCard(row),
    quantity: Number(row.dvc_quantity),
    zone: String(row.dvc_zone) as DeckZone,
  }));

  return { slots };
}

/** Cards in a version that are no longer in the mirror, for an honest warning. */
export function missingCardCount(versionId: string): number {
  return (
    conn().getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM deck_version_cards dvc
        WHERE dvc.deck_version_id = ?
          AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = dvc.card_id)`,
      [versionId]
    )?.n ?? 0
  );
}

/**
 * Create a deck and its first version.
 *
 * Both rows are written in one transaction because a deck whose
 * `current_version_id` points at nothing has no editable state — the builder
 * would open on a deck it cannot save into.
 */
export function createDeck(input: CreateDeckInput): { deckId: string; versionId: string } {
  const deckId = newId();
  const versionId = newId();
  const timestamp = now();

  let slots: DeckSlot[];
  if (input.slots) {
    slots = [...input.slots];
  } else {
    slots = [{ card: input.legend, quantity: 1, zone: 'legend' }];
    if (input.champion) slots.push({ card: input.champion, quantity: 1, zone: 'champion' });
  }

  conn().withTransactionSync(() => {
    conn().runSync(
      `INSERT INTO decks
         (id, name, legend_card_id, champion_card_id, domains, format,
          current_version_id, created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, 'constructed', ?, ?, ?, 1)`,
      [
        deckId,
        input.name,
        input.legend.id,
        input.champion?.id ?? null,
        JSON.stringify(input.legend.domains),
        versionId,
        timestamp,
        timestamp,
      ]
    );

    conn().runSync(
      `INSERT INTO deck_versions
         (id, deck_id, version_number, created_at, updated_at, dirty)
       VALUES (?, ?, 1, ?, ?, 1)`,
      [versionId, deckId, timestamp, timestamp]
    );

    writeSlots(versionId, slots);
    syncVersionCounts(versionId, { slots });
  });

  return { deckId, versionId };
}

/**
 * Replace a version's cards. Rewrites rather than diffs — at most 57 rows.
 *
 * Only rows for cards **currently in the mirror** are deleted. `loadDeckList`
 * drops any card the mirror no longer has, so those never reach the editor and
 * cannot be in `slots`; deleting them here would erase a card from the deck
 * because of a card-library resync, which is not something the user did. The
 * surviving row still carries `card_id` and `riftbound_id`, so the card returns
 * intact once the mirror does.
 */
function writeSlots(versionId: string, slots: readonly DeckSlot[]): void {
  conn().runSync(
    `DELETE FROM deck_version_cards
      WHERE deck_version_id = ?
        AND card_id IN (SELECT id FROM cards)`,
    [versionId]
  );

  for (const slot of slots) {
    if (slot.quantity <= 0) continue;
    conn().runSync(
      `INSERT INTO deck_version_cards
         (id, deck_version_id, card_id, riftbound_id, quantity, zone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), versionId, slot.card.id, slot.card.riftboundId, slot.quantity, slot.zone]
    );
  }
}

/** Refresh the denormalized counts the deck list and timeline render from. */
function syncVersionCounts(versionId: string, list: DeckList): void {
  const result = checkLegality(list);
  conn().runSync(
    `UPDATE deck_versions
        SET main_count = ?, rune_count = ?, battlefield_count = ?,
            is_legal = ?, rules_version = ?, updated_at = ?, dirty = 1
      WHERE id = ?`,
    [
      result.counts.main,
      result.counts.rune,
      result.counts.battlefield,
      result.legal ? 1 : 0,
      RULES_VERSION,
      now(),
      versionId,
    ]
  );
}

/**
 * Recompute any version whose cached legality predates the current rules.
 *
 * The four denormalized columns are a cache of `checkLegality`, so a change to
 * the rules silently invalidates every stored row — a deck saved as "Legal"
 * under the old reading would keep claiming it. Rows carry the revision that
 * wrote them and are refreshed here on the next read.
 *
 * Skipped entirely when the card mirror is empty. `loadDeckList` joins to
 * `cards`, so recomputing mid-resync would see an empty list and cache "0/40,
 * illegal" over a perfectly good deck — trading a stale verdict for a
 * fabricated one.
 *
 * Does not touch `updated_at` or `dirty`: nothing the user did changed, and
 * marking every version dirty would push a meaningless write to every device.
 */
function refreshStaleVersions(): void {
  const mirrorPopulated =
    (conn().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM cards')?.n ?? 0) > 0;
  if (!mirrorPopulated) return;

  const stale = conn().getAllSync<{ id: string }>(
    `SELECT id FROM deck_versions
      WHERE rules_version < ? AND deleted_at IS NULL`,
    [RULES_VERSION]
  );
  if (stale.length === 0) return;

  conn().withTransactionSync(() => {
    for (const { id } of stale) {
      const result = checkLegality(loadDeckList(id));
      conn().runSync(
        `UPDATE deck_versions
            SET main_count = ?, rune_count = ?, battlefield_count = ?,
                is_legal = ?, rules_version = ?
          WHERE id = ?`,
        [
          result.counts.main,
          result.counts.rune,
          result.counts.battlefield,
          result.legal ? 1 : 0,
          RULES_VERSION,
          id,
        ]
      );
    }
  });
}

export class VersionLockedError extends Error {
  constructor(readonly versionId: string) {
    super('This version has matches attached and cannot be edited in place.');
    this.name = 'VersionLockedError';
  }
}

/**
 * Save a decklist into an existing version, in place.
 *
 * Throws on a locked version rather than writing. Nothing can lock a version
 * until match logging exists (M4), so today this is unreachable — which is
 * exactly why it is worth having now. Fork-on-save (M3) replaces the throw with
 * a new version; until then, silently rewriting a list that matches were played
 * on is the one failure this model must never have.
 */
export function saveDeckList(versionId: string, list: DeckList): void {
  const version = getVersion(versionId);
  if (!version) throw new Error(`No such deck version: ${versionId}`);
  if (version.lockedAt) throw new VersionLockedError(versionId);

  conn().withTransactionSync(() => {
    writeSlots(versionId, list.slots);
    syncVersionCounts(versionId, list);

    // The Legend and Champion live on the deck too, denormalized for the list
    // screen; a build session can change either, so keep them in step.
    //
    // A list with **no** legend slot leaves the deck's Legend alone rather than
    // nulling it. The editor offers no way to remove a Legend, so an absent one
    // means `loadDeckList` could not find its printing in the mirror — and
    // writing null there would take the deck's domains with it, turning the
    // deck grey in the list with nothing left to reconstruct it from.
    const legend = list.slots.find((s) => s.zone === 'legend')?.card ?? null;
    const champion = list.slots.find((s) => s.zone === 'champion')?.card ?? null;

    if (legend) {
      conn().runSync(
        `UPDATE decks
            SET legend_card_id = ?, champion_card_id = ?, domains = ?,
                updated_at = ?, dirty = 1
          WHERE id = ?`,
        [
          legend.id,
          champion?.id ?? null,
          JSON.stringify(legend.domains),
          now(),
          version.deckId,
        ]
      );
    } else {
      conn().runSync(`UPDATE decks SET updated_at = ?, dirty = 1 WHERE id = ?`, [
        now(),
        version.deckId,
      ]);
    }
  });
}

export function renameDeck(deckId: string, name: string): void {
  conn().runSync('UPDATE decks SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    name,
    now(),
    deckId,
  ]);
}

export function setDeckNotes(deckId: string, notes: string): void {
  conn().runSync('UPDATE decks SET notes = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    notes,
    now(),
    deckId,
  ]);
}

export function archiveDeck(deckId: string, archived: boolean): void {
  conn().runSync(
    'UPDATE decks SET archived_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [archived ? now() : null, now(), deckId]
  );
}

/**
 * Soft delete. The row stays so sync can propagate the deletion to other
 * devices; a hard delete would simply reappear on the next pull.
 */
export function deleteDeck(deckId: string): void {
  const timestamp = now();
  conn().withTransactionSync(() => {
    conn().runSync(
      'UPDATE decks SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [timestamp, timestamp, deckId]
    );
    conn().runSync(
      `UPDATE deck_versions SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE deck_id = ? AND deleted_at IS NULL`,
      [timestamp, timestamp, deckId]
    );
  });
}

export function countDecks(): number {
  return (
    conn().getFirstSync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM decks WHERE deleted_at IS NULL AND archived_at IS NULL'
    )?.n ?? 0
  );
}
