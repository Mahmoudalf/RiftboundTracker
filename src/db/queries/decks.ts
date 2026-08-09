import { cardKey } from '@/lib/card-identity';
import { diffLists, suggestLabelFromDiff, type DeckDiff } from '@/lib/deck-diff';
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

export interface MissingCard {
  cardId: string;
  /** Null only for rows written before migration 5 whose card was already gone. */
  name: string | null;
  quantity: number;
  zone: DeckZone;
}

/**
 * Cards in a version the mirror can no longer resolve.
 *
 * Named rather than merely counted: "1 card is missing" tells the user nothing
 * they can act on, and the card is still in the deck — it is the *library* that
 * lost it. With the name they can see whether it matters and re-add it.
 */
export function missingCards(versionId: string): MissingCard[] {
  return conn()
    .getAllSync<{
      card_id: string;
      card_name: string | null;
      quantity: number;
      zone: string;
    }>(
      `SELECT card_id, card_name, quantity, zone FROM deck_version_cards dvc
        WHERE dvc.deck_version_id = ?
          AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = dvc.card_id)`,
      [versionId]
    )
    .map((row) => ({
      cardId: row.card_id,
      name: row.card_name,
      quantity: Number(row.quantity),
      zone: row.zone as DeckZone,
    }));
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
 * Two kinds of row survive a rewrite, for different reasons.
 *
 * Rows whose card is **currently in the mirror** are always replaced: the
 * editor could see them, so `slots` is the complete truth about them.
 *
 * Rows whose card the mirror cannot resolve are kept. `loadDeckList` drops
 * those, so they never reach the editor and cannot be in `slots`; deleting them
 * here would erase a card from the deck because of a card-library resync, which
 * is not something the user did.
 *
 * The exception is the case that made this subtle. If the user writes a card
 * that a preserved row already holds — re-adding Statikk Shock after the
 * alternate-art printing they had left the library — the preserved row is
 * dropped, because the user has just restated what that card's presence should
 * be. Without this the version stores both, and the deck silently holds six
 * copies by name the moment the old printing comes back. Matching is by name,
 * which is why `card_name` exists; rows predating migration 5 have none and
 * fall back to being preserved unconditionally.
 */
function writeSlots(versionId: string, slots: readonly DeckSlot[]): void {
  conn().runSync(
    `DELETE FROM deck_version_cards
      WHERE deck_version_id = ?
        AND card_id IN (SELECT id FROM cards)`,
    [versionId]
  );

  const written = new Set(slots.filter((s) => s.quantity > 0).map((s) => `${s.zone} ${cardKey(s.card)}`));

  const preserved = conn().getAllSync<{ id: string; card_name: string | null; zone: string }>(
    'SELECT id, card_name, zone FROM deck_version_cards WHERE deck_version_id = ?',
    [versionId]
  );
  for (const row of preserved) {
    if (!row.card_name) continue;
    if (written.has(`${row.zone} ${cardKey({ name: row.card_name })}`)) {
      conn().runSync('DELETE FROM deck_version_cards WHERE id = ?', [row.id]);
    }
  }

  for (const slot of slots) {
    if (slot.quantity <= 0) continue;
    /*
     * Upsert rather than insert, so `UNIQUE(deck_version_id, card_id, zone)`
     * cannot be violated by construction.
     *
     * The collision is reachable: a card the editor is holding in its draft can
     * leave the mirror mid-session, and the delete above spares rows whose card
     * the mirror cannot resolve — so the old row survives and the new one lands
     * on the same key. The name-matched cleanup above happens to catch that
     * today, but only because both mechanisms exist; relying on one to cover
     * the other is an argument, and this is a guarantee.
     */
    conn().runSync(
      `INSERT INTO deck_version_cards
         (id, deck_version_id, card_id, riftbound_id, card_name, quantity, zone)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(deck_version_id, card_id, zone) DO UPDATE SET
         riftbound_id = excluded.riftbound_id,
         card_name    = excluded.card_name,
         quantity     = excluded.quantity`,
      [
        newId(),
        versionId,
        slot.card.id,
        slot.card.riftboundId,
        slot.card.name,
        slot.quantity,
        slot.zone,
      ]
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

/**
 * Sync the deck row's denormalized Legend, Champion, and domains.
 *
 * Both fields have the same hazard, and it took two passes to cover both. A
 * `DeckList` is what the mirror could *resolve*, not what the version holds, so
 * an absent slot means one of two very different things — the card is not in
 * the deck, or the card library cannot currently see it. Writing null on the
 * second reading loses data because of a resync the user did not ask for.
 *
 * For the Legend that is fatal: `domains` goes with it, the deck turns grey in
 * the list, and there is nothing left to reconstruct it from. For the Champion
 * it is milder but the same mistake, so both are settled the same way — by
 * asking `deck_version_cards`, which knows what the version holds regardless of
 * what the mirror can resolve.
 */
function syncDeckIdentity(deckId: string, versionId: string, list: DeckList): void {
  const legend = list.slots.find((s) => s.zone === 'legend')?.card ?? null;
  const champion = list.slots.find((s) => s.zone === 'champion')?.card ?? null;

  if (!legend) {
    conn().runSync(`UPDATE decks SET updated_at = ?, dirty = 1 WHERE id = ?`, [now(), deckId]);
    return;
  }

  // No resolved Champion. Is there one at all?
  const hasChampionRow =
    champion !== null ||
    (conn().getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM deck_version_cards
        WHERE deck_version_id = ? AND zone = 'champion'`,
      [versionId]
    )?.n ?? 0) > 0;

  if (champion || !hasChampionRow) {
    conn().runSync(
      `UPDATE decks
          SET legend_card_id = ?, champion_card_id = ?, domains = ?,
              updated_at = ?, dirty = 1
        WHERE id = ?`,
      [legend.id, champion?.id ?? null, JSON.stringify(legend.domains), now(), deckId]
    );
  } else {
    // A Champion is in the version but its printing is not in the mirror.
    // Leave the denormalized id alone; it returns intact when the mirror does.
    conn().runSync(
      `UPDATE decks
          SET legend_card_id = ?, domains = ?, updated_at = ?, dirty = 1
        WHERE id = ?`,
      [legend.id, JSON.stringify(legend.domains), now(), deckId]
    );
  }
}

/**
 * What a save actually did.
 *
 * - `no-op` — the list is byte-identical. Nothing was written.
 * - `reprinted` — same cards, different art, on a version with no matches.
 * - `amended` — the version had no matches, so it was edited directly.
 * - `forked` — the version was locked, so a new one now carries the change.
 * - `amended-locked` — the escape hatch. A locked version was rewritten at the
 *   user's explicit instruction, and its matches now describe the edited list.
 */
export type SaveOutcome = 'no-op' | 'reprinted' | 'amended' | 'forked' | 'amended-locked';

export interface SaveResult {
  outcome: SaveOutcome;
  /** The version the deck points at afterwards — a new id only when forked. */
  versionId: string;
  versionNumber: number;
  diff: DeckDiff;
}

export interface SaveOptions {
  /** Overrides the label suggested from the diff. Forks only. */
  label?: string;
  /**
   * Rewrite a locked version in place instead of forking.
   *
   * The escape hatch from `DATA-MODEL.md` §3, for a genuinely mis-entered list.
   * The UI must state the consequence before setting this: the matches already
   * logged against the version will describe the edited list.
   */
  amendLocked?: boolean;
}

/**
 * Save a decklist. The one entry point for every edit to a deck's cards.
 *
 * Implements the version rule from `DATA-MODEL.md` §3 — *a deck version becomes
 * immutable the moment its first match is logged* — so a match can never end up
 * attributed to a list it was not played with.
 *
 * Three things decide the outcome, in order:
 *
 * 1. **Nothing changed** → write nothing. Opening the editor and backing out
 *    must never appear in the deck's history. This is the guard that keeps the
 *    timeline readable, and the one most likely to make the feature feel broken
 *    if it fails.
 * 2. **Unlocked** → edit in place. No matches exist, so there is no history to
 *    protect and no reason to spend a version number.
 * 3. **Locked** → fork. The old version keeps its matches, exactly as played.
 *
 * An art swap is not special-cased. An earlier revision wrote printing changes
 * in place even on a locked version, reasoning that the two lists are the same
 * list to the rules and that forking would split the sample for no analytical
 * gain. The first half is true; the conclusion was wrong. `deck_version_cards`
 * is not only the rules-level definition of a list — it is the record of what
 * was physically in the sleeve, which is what a match detail screen renders,
 * what collection tracking checks ownership against, and what a deck export
 * emits. Rewriting `card_id` on a version matches were played with makes all
 * three describe cards the player did not have at the time.
 *
 * The sample-splitting problem is real but belongs in the analytics layer,
 * where two versions with `diff.cardSetIdentical` can be pooled at read time.
 * That is recoverable. A falsified record is not.
 */
export function saveDeckEdit(
  versionId: string,
  list: DeckList,
  options: SaveOptions = {}
): SaveResult {
  const version = getVersion(versionId);
  if (!version) throw new Error(`No such deck version: ${versionId}`);

  const diff = diffLists(loadDeckList(versionId), list);

  if (diff.isEmpty) {
    return {
      outcome: 'no-op',
      versionId,
      versionNumber: version.versionNumber,
      diff,
    };
  }

  const inPlace = !version.lockedAt || options.amendLocked === true;

  if (inPlace) {
    conn().withTransactionSync(() => {
      writeSlots(versionId, list.slots);
      syncVersionCounts(versionId, list);
      syncDeckIdentity(version.deckId, versionId, list);
    });

    const outcome: SaveOutcome = version.lockedAt
      ? 'amended-locked'
      : diff.cardSetIdentical
        ? 'reprinted'
        : 'amended';

    return { outcome, versionId, versionNumber: version.versionNumber, diff };
  }

  const forked = forkVersion(version.deckId, versionId, list, {
    label: options.label ?? suggestLabelFromDiff(diff) ?? undefined,
  });

  return {
    outcome: 'forked',
    versionId: forked.versionId,
    versionNumber: forked.versionNumber,
    diff,
  };
}

/**
 * Create the next version of a deck from an edited list and point the deck at
 * it. The parent is left completely untouched.
 *
 * `version_number` comes from the current maximum rather than from the parent,
 * so the numbers stay contiguous and unique per deck (invariant 4) even if a
 * version was archived or the fork came from an older node.
 */
function forkVersion(
  deckId: string,
  parentVersionId: string,
  list: DeckList,
  meta: { label?: string }
): { versionId: string; versionNumber: number } {
  const versionId = newId();
  const timestamp = now();

  let versionNumber = 1;

  conn().withTransactionSync(() => {
    versionNumber =
      (conn().getFirstSync<{ n: number | null }>(
        'SELECT MAX(version_number) AS n FROM deck_versions WHERE deck_id = ?',
        [deckId]
      )?.n ?? 0) + 1;

    conn().runSync(
      `INSERT INTO deck_versions
         (id, deck_id, version_number, label, parent_version_id,
          created_at, updated_at, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [versionId, deckId, versionNumber, meta.label ?? null, parentVersionId, timestamp, timestamp]
    );

    // Cards the mirror cannot currently resolve are invisible to the editor and
    // so are absent from `list`. Carrying their rows across keeps a fork from
    // quietly deleting cards because of a card-library resync — the same reason
    // `writeSlots` will not delete them either.
    const unresolved = conn().getAllSync<{
      card_id: string;
      riftbound_id: string;
      card_name: string | null;
      quantity: number;
      zone: string;
    }>(
      `SELECT card_id, riftbound_id, card_name, quantity, zone FROM deck_version_cards
        WHERE deck_version_id = ?
          AND card_id NOT IN (SELECT id FROM cards)`,
      [parentVersionId]
    );
    for (const row of unresolved) {
      conn().runSync(
        `INSERT INTO deck_version_cards
           (id, deck_version_id, card_id, riftbound_id, card_name, quantity, zone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          versionId,
          row.card_id,
          row.riftbound_id,
          row.card_name,
          row.quantity,
          row.zone,
        ]
      );
    }

    writeSlots(versionId, list.slots);
    syncVersionCounts(versionId, list);

    conn().runSync(
      'UPDATE decks SET current_version_id = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [versionId, timestamp, deckId]
    );
    syncDeckIdentity(deckId, versionId, list);
  });

  return { versionId, versionNumber };
}

/**
 * Mark a version immutable. Called by match logging (M4) on the first match.
 *
 * Idempotent, and deliberately never unset: the lock records that real results
 * exist for this exact list, which does not stop being true if the matches are
 * later deleted.
 */
export function lockVersion(versionId: string): void {
  conn().runSync(
    `UPDATE deck_versions SET locked_at = ?, updated_at = ?, dirty = 1
      WHERE id = ? AND locked_at IS NULL`,
    [now(), now(), versionId]
  );
}

export function setVersionLabel(versionId: string, label: string): void {
  conn().runSync(
    'UPDATE deck_versions SET label = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [label.trim() || null, now(), versionId]
  );
}

export function setVersionNotes(versionId: string, notes: string): void {
  conn().runSync(
    'UPDATE deck_versions SET notes = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [notes.trim() || null, now(), versionId]
  );
}

/**
 * Matches logged per version, keyed by version id.
 *
 * Through M3 this guarded on the `matches` table existing and returned an empty
 * map if it did not, so the version timeline could ship before match logging
 * did. The guard is gone with migration 6: `migrate()` runs to `LATEST_VERSION`
 * at module load, before any query can execute, so the table is always there by
 * the time this runs. A branch that can never be taken is one nobody can reason
 * about, and it would have quietly returned "no matches" if it ever did fire.
 */
export function versionMatchCounts(deckId: string): Map<string, number> {

  const rows = conn().getAllSync<{ deck_version_id: string; n: number }>(
    `SELECT deck_version_id, COUNT(*) AS n FROM matches
      WHERE deck_id = ? AND deleted_at IS NULL
      GROUP BY deck_version_id`,
    [deckId]
  );
  return new Map(rows.map((r) => [r.deck_version_id, r.n]));
}

/**
 * The diff between a version and the one it was forked from.
 *
 * Null for the first version, which has nothing to be compared against.
 */
export function versionDiff(versionId: string): DeckDiff | null {
  const version = getVersion(versionId);
  if (!version?.parentVersionId) return null;
  if (!getVersion(version.parentVersionId)) return null;
  return diffLists(loadDeckList(version.parentVersionId), loadDeckList(versionId));
}

/** The diff between any two versions, newest-second. */
export function compareVersions(aVersionId: string, bVersionId: string): DeckDiff {
  return diffLists(loadDeckList(aVersionId), loadDeckList(bVersionId));
}

/**
 * Make an older version current again, without deleting anything.
 *
 * Editing from here forks off that node rather than off the newest one, which
 * is how a player backs out of a change that turned out to be wrong while
 * keeping the record of having tried it.
 */
export function setCurrentVersion(deckId: string, versionId: string): void {
  const version = getVersion(versionId);
  if (!version || version.deckId !== deckId) {
    throw new Error(`Version ${versionId} does not belong to deck ${deckId}`);
  }
  conn().runSync(
    'UPDATE decks SET current_version_id = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [versionId, now(), deckId]
  );
  syncDeckIdentity(deckId, versionId, loadDeckList(versionId));
}

export class VersionHasMatchesError extends Error {
  constructor(readonly versionId: string) {
    super('This version has matches logged against it, so it cannot be deleted.');
    this.name = 'VersionHasMatchesError';
  }
}

/**
 * Delete a version that never played a game.
 *
 * A version with matches is never deletable (invariant 2) — deleting it would
 * orphan every match that references it, and those matches are the only record
 * of results that actually happened.
 */
export function deleteVersion(versionId: string): void {
  const version = getVersion(versionId);
  if (!version) return;
  if (version.lockedAt) throw new VersionHasMatchesError(versionId);

  const siblings = listVersions(version.deckId).filter((v) => v.id !== versionId);
  if (siblings.length === 0) throw new Error('A deck must keep at least one version.');

  const timestamp = now();
  conn().withTransactionSync(() => {
    conn().runSync(
      'UPDATE deck_versions SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      [timestamp, timestamp, versionId]
    );
    // Anything forked from it re-parents to its parent, so the timeline stays
    // connected rather than growing an orphan branch.
    conn().runSync(
      'UPDATE deck_versions SET parent_version_id = ?, dirty = 1 WHERE parent_version_id = ?',
      [version.parentVersionId, versionId]
    );

    const deck = getDeck(version.deckId);
    if (deck?.currentVersionId === versionId) {
      /*
       * Fall back to the highest-numbered version that remains.
       *
       * Chosen explicitly rather than taken from `listVersions`' ordering,
       * which happens to be `version_number DESC` today — a fallback that
       * silently depends on another function's ORDER BY is a fallback nobody
       * decided on. The parent is the other candidate and is worse: after a
       * sibling fork the parent may be v1 while v2 still exists, and dropping
       * the user two versions back is not what deleting v3 meant.
       */
      const next = siblings.reduce((best, v) =>
        v.versionNumber > best.versionNumber ? v : best
      );
      conn().runSync(
        'UPDATE decks SET current_version_id = ?, updated_at = ?, dirty = 1 WHERE id = ?',
        [next.id, timestamp, version.deckId]
      );
      syncDeckIdentity(version.deckId, next.id, loadDeckList(next.id));
    }
  });
}

export function renameDeck(deckId: string, name: string): void {
  conn().runSync('UPDATE decks SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    // Trimmed like the other setters. The sheet blocks an empty name, but not
    // trailing spaces, and " Vi " sorts and reads as a different deck.
    name.trim(),
    now(),
    deckId,
  ]);
}

/**
 * Blank clears the note, matching `setVersionNotes` and `setVersionLabel`.
 *
 * This one stored the raw string, so an emptied field left `''` behind — which
 * renders as a note the user deliberately wrote nothing in, and is not the same
 * thing as having no note. Only reachable now that a screen calls it.
 */
export function setDeckNotes(deckId: string, notes: string): void {
  conn().runSync('UPDATE decks SET notes = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    notes.trim() || null,
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
    /*
     * Matches go too.
     *
     * They did not before, and the deck's results outlived the deck: `listDecks`
     * hid the deck while `listMatches()` kept returning its matches, so a
     * deleted deck's games stayed in the cross-deck Stats totals with no deck
     * to attribute them to. Soft, like everything else here, so the deletion
     * propagates rather than reappearing on the next sync.
     */
    conn().runSync(
      `UPDATE matches SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE deck_id = ? AND deleted_at IS NULL`,
      [timestamp, timestamp, deckId]
    );
  });
}

