import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { CardRow } from '../schema/cards';
import type { EventType, MatchResult, MatchRow } from '../schema/matches';

import { hydrateCard, hydrateMatch } from './hydrate';

/**
 * Match reads and writes.
 *
 * The write path is deliberately tiny. Logging has to take under ten seconds
 * from tab bar to confirmation or players stop doing it, and everything that
 * makes a match *interesting* — opponent, on the play, mulligans — is optional
 * at the schema level so the fast path stays two taps.
 *
 * `logMatch()` is also what finally makes the M3 version model do anything: it
 * is the only caller of `lockVersion()`, and until it existed no version in the
 * app could ever become immutable.
 */

export interface LogMatchInput {
  deckId: string;
  deckVersionId: string;
  result: MatchResult;
  /** Defaults to now. Set explicitly when back-filling a tournament. */
  playedAt?: string;
  onPlay?: boolean | null;
  /** Match format: 1, 3 or 5. Null when not recorded. */
  bestOf?: number | null;
  gamesWon?: number | null;
  gamesLost?: number | null;
  oppLegendCardId?: string | null;
  oppChampionCardId?: string | null;
  /** Always write these alongside the ids — see `opponentFields()`. */
  oppLegendName?: string | null;
  oppChampionName?: string | null;
  battlefieldCardId?: string | null;
  battlefieldName?: string | null;
  oppBattlefieldCardId?: string | null;
  oppBattlefieldName?: string | null;
  oppDomains?: string[] | null;
  oppLabel?: string | null;
  eventId?: string | null;
  eventType?: EventType;
  mulligans?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;
  tags?: string[] | null;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Everything worth recording about an opponent Legend, from its card.
 *
 * Exists so a caller cannot store an id without its name. The id alone is a
 * pointer into the card mirror, and the mirror is disposable by design — a
 * printing that leaves it takes the opponent's identity with it, silently, from
 * a record that is supposed to be permanent. Spread this into `logMatch`
 * rather than setting `oppLegendCardId` by hand.
 *
 * Domains come along because they are the fallback the UI renders when the card
 * is gone: a match against an unknown Fury/Chaos deck still says something.
 */
export function opponentFields(
  legend: Pick<CardRow, 'id' | 'name' | 'domains'> | null
): Pick<LogMatchInput, 'oppLegendCardId' | 'oppLegendName' | 'oppDomains'> {
  if (!legend) return { oppLegendCardId: null, oppLegendName: null, oppDomains: null };
  return {
    oppLegendCardId: legend.id,
    oppLegendName: legend.name,
    oppDomains: legend.domains.length > 0 ? legend.domains : null,
  };
}

/** The opponent's Chosen Champion, id and name together for the same reason. */
export function opponentChampionFields(
  champion: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogMatchInput, 'oppChampionCardId' | 'oppChampionName'> {
  if (!champion) return { oppChampionCardId: null, oppChampionName: null };
  return { oppChampionCardId: champion.id, oppChampionName: champion.name };
}

/** Your Battlefield, id and name together. */
export function battlefieldFields(
  battlefield: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogMatchInput, 'battlefieldCardId' | 'battlefieldName'> {
  if (!battlefield) return { battlefieldCardId: null, battlefieldName: null };
  return { battlefieldCardId: battlefield.id, battlefieldName: battlefield.name };
}

/** Theirs. */
export function opponentBattlefieldFields(
  battlefield: Pick<CardRow, 'id' | 'name'> | null
): Pick<LogMatchInput, 'oppBattlefieldCardId' | 'oppBattlefieldName'> {
  if (!battlefield) return { oppBattlefieldCardId: null, oppBattlefieldName: null };
  return {
    oppBattlefieldCardId: battlefield.id,
    oppBattlefieldName: battlefield.name,
  };
}

/**
 * Record a match and lock the version it was played with.
 *
 * Both in one transaction, because a match that exists against an unlocked
 * version is the exact state the version model forbids: the next edit would
 * rewrite the list this result was played with, in place, and the result would
 * silently start describing cards that were never in the deck.
 */
export function logMatch(input: LogMatchInput): string {
  const id = newId();
  const timestamp = now();

  conn().withTransactionSync(() => {
    conn().runSync(
      `INSERT INTO matches
         (id, deck_id, deck_version_id, played_at, result,
          best_of, games_won, games_lost, on_play,
          opp_legend_card_id, opp_champion_card_id,
          opp_legend_name, opp_champion_name, opp_domains, opp_label,
          battlefield_card_id, battlefield_name,
          opp_battlefield_card_id, opp_battlefield_name,
          event_id, event_type, mulligans, duration_seconds, notes, tags,
          created_at, updated_at, dirty)
       VALUES (?,?,?,?,?, ?,?,?,?, ?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?,?,?, ?,?,1)`,
      [
        id,
        input.deckId,
        input.deckVersionId,
        input.playedAt ?? timestamp,
        input.result,
        input.bestOf ?? null,
        input.gamesWon ?? null,
        input.gamesLost ?? null,
        input.onPlay === null || input.onPlay === undefined ? null : input.onPlay ? 1 : 0,
        input.oppLegendCardId ?? null,
        input.oppChampionCardId ?? null,
        input.oppLegendName ?? null,
        input.oppChampionName ?? null,
        input.oppDomains ? JSON.stringify(input.oppDomains) : null,
        input.oppLabel ?? null,
        input.battlefieldCardId ?? null,
        input.battlefieldName ?? null,
        input.oppBattlefieldCardId ?? null,
        input.oppBattlefieldName ?? null,
        input.eventId ?? null,
        input.eventType ?? 'casual',
        input.mulligans ?? null,
        input.durationSeconds ?? null,
        input.notes ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        timestamp,
        timestamp,
      ]
    );

    lockVersionRow(input.deckVersionId, timestamp);

    // The deck sorts by recency in the list, and having just played it is the
    // strongest signal that it is the deck you care about.
    conn().runSync('UPDATE decks SET updated_at = ?, dirty = 1 WHERE id = ?', [
      timestamp,
      input.deckId,
    ]);
  });

  return id;
}

/**
 * Set `locked_at` if it is not already set.
 *
 * Inlined here rather than calling `decks.ts` so the lock lands inside the same
 * transaction as the insert. Never unset: the lock records that real results
 * exist for this exact list, which does not stop being true if the matches are
 * later deleted — an unlocked version would let the list be rewritten under a
 * match that had merely been undone rather than never played.
 */
function lockVersionRow(versionId: string, timestamp: string): void {
  conn().runSync(
    `UPDATE deck_versions SET locked_at = ?, updated_at = ?, dirty = 1
      WHERE id = ? AND locked_at IS NULL`,
    [timestamp, timestamp, versionId]
  );
}

export function getMatch(id: string): MatchRow | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM matches WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
  return row ? hydrateMatch(row) : null;
}

/** Newest first — the order every match list and the undo toast read in. */
export function listMatches(options: { deckId?: string; limit?: number } = {}): MatchRow[] {
  const where = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];
  if (options.deckId) {
    where.push('deck_id = ?');
    params.push(options.deckId);
  }
  // Parameterised rather than interpolated, matching `recentOpponents`. The
  // floored number was never injectable, but two conventions for the same thing
  // means every future reader has to re-derive which one is safe.
  let limit = '';
  if (options.limit !== undefined) {
    limit = ' LIMIT ?';
    params.push(Math.floor(options.limit));
  }

  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT * FROM matches WHERE ${where.join(' AND ')}
        ORDER BY played_at DESC, created_at DESC${limit}`,
      params
    )
    .map(hydrateMatch);
}

export interface DeckRecord {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

/**
 * A deck's record, optionally for one version.
 *
 * Counted in SQL rather than by loading rows: this runs on the deck list, on
 * every timeline node, and inside the undo toast. Full analytics — intervals,
 * splits, streaks — belong in M5 over loaded rows; this is the headline only.
 */
export function deckRecord(deckId: string, versionId?: string): DeckRecord {
  const row = conn().getFirstSync<{
    wins: number;
    losses: number;
    draws: number;
    total: number;
  }>(
    `SELECT
       SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END) AS wins,
       SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses,
       SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws,
       COUNT(*) AS total
     FROM matches
    WHERE deck_id = ? AND deleted_at IS NULL
      ${versionId ? 'AND deck_version_id = ?' : ''}`,
    versionId ? [deckId, versionId] : [deckId]
  );

  return {
    wins: Number(row?.wins ?? 0),
    losses: Number(row?.losses ?? 0),
    draws: Number(row?.draws ?? 0),
    total: Number(row?.total ?? 0),
  };
}

/**
 * The Legends most recently played against, for the opponent chip rail.
 *
 * Ordered by when each was last faced rather than by how often — the opponent
 * you are about to log is far more likely to be the one you just played in the
 * previous round than your all-time most common.
 */
export function recentOpponents(limit = 8): CardRow[] {
  const rows = conn().getAllSync<Record<string, unknown>>(
    `SELECT c.* FROM cards c
       JOIN (SELECT opp_legend_card_id AS id, MAX(played_at) AS last_played
               FROM matches
              WHERE opp_legend_card_id IS NOT NULL AND deleted_at IS NULL
              GROUP BY opp_legend_card_id) m ON m.id = c.id
      ORDER BY m.last_played DESC
      LIMIT ?`,
    [Math.floor(limit)]
  );
  return rows.map(hydrateCard);
}

export function updateMatch(id: string, patch: Partial<LogMatchInput>): void {
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  const put = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`);
    params.push(value);
  };

  if (patch.result !== undefined) put('result', patch.result);
  if (patch.playedAt !== undefined) put('played_at', patch.playedAt);
  if (patch.onPlay !== undefined) {
    put('on_play', patch.onPlay === null ? null : patch.onPlay ? 1 : 0);
  }
  if (patch.bestOf !== undefined) put('best_of', patch.bestOf ?? null);
  if (patch.gamesWon !== undefined) put('games_won', patch.gamesWon ?? null);
  if (patch.gamesLost !== undefined) put('games_lost', patch.gamesLost ?? null);
  if (patch.oppLegendCardId !== undefined) {
    put('opp_legend_card_id', patch.oppLegendCardId ?? null);
  }
  if (patch.oppChampionCardId !== undefined) {
    put('opp_champion_card_id', patch.oppChampionCardId ?? null);
  }
  if (patch.oppLegendName !== undefined) put('opp_legend_name', patch.oppLegendName ?? null);
  if (patch.oppChampionName !== undefined) {
    put('opp_champion_name', patch.oppChampionName ?? null);
  }
  if (patch.oppDomains !== undefined) {
    put('opp_domains', patch.oppDomains ? JSON.stringify(patch.oppDomains) : null);
  }
  if (patch.oppLabel !== undefined) put('opp_label', patch.oppLabel ?? null);
  if (patch.eventId !== undefined) put('event_id', patch.eventId ?? null);
  if (patch.eventType !== undefined) put('event_type', patch.eventType);
  if (patch.mulligans !== undefined) put('mulligans', patch.mulligans ?? null);
  if (patch.durationSeconds !== undefined) {
    put('duration_seconds', patch.durationSeconds ?? null);
  }
  if (patch.notes !== undefined) put('notes', patch.notes ?? null);
  if (patch.tags !== undefined) put('tags', patch.tags ? JSON.stringify(patch.tags) : null);

  if (sets.length === 0) return;

  put('updated_at', now());
  sets.push('dirty = 1');
  params.push(id);

  conn().runSync(`UPDATE matches SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * Soft delete, so sync propagates the deletion.
 *
 * The version stays locked. A match that was logged and then removed is still
 * evidence that this list was played, and unlocking would let a later edit
 * rewrite a list under the remaining results.
 */
export function deleteMatch(id: string): void {
  const timestamp = now();
  conn().runSync(
    'UPDATE matches SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [timestamp, timestamp, id]
  );
}

/**
 * Undo a just-logged match.
 *
 * A hard delete, unlike `deleteMatch`. The undo toast is part of the same
 * gesture as the tap that created the row — the user is correcting a mis-tap,
 * not recording that a match happened and was removed, and a soft-deleted
 * tombstone would sync a phantom to every other device.
 *
 * **Releases the lock when nothing is left.** An earlier revision kept the
 * version locked unconditionally, which meant one mis-tapped result locked a
 * version permanently: the next edit forked a version the user never earned,
 * with no way back. The lock exists to protect results, so when the version has
 * no match rows at all — not even tombstones — it is protecting nothing.
 *
 * The tombstone check is what makes this safe. A match that was really played
 * and then deleted leaves a soft-deleted row behind, so the version stays
 * locked and its list stays immutable; only a version that was never
 * successfully played can be unlocked.
 */
export function undoMatch(id: string): void {
  conn().withTransactionSync(() => {
    const match = conn().getFirstSync<{ deck_version_id: string }>(
      'SELECT deck_version_id FROM matches WHERE id = ?',
      [id]
    );

    conn().runSync('DELETE FROM match_games WHERE match_id = ?', [id]);
    conn().runSync('DELETE FROM matches WHERE id = ?', [id]);

    if (!match) return;

    const remaining =
      conn().getFirstSync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM matches WHERE deck_version_id = ?',
        [match.deck_version_id]
      )?.n ?? 0;

    if (remaining === 0) {
      conn().runSync(
        'UPDATE deck_versions SET locked_at = NULL, updated_at = ?, dirty = 1 WHERE id = ?',
        [now(), match.deck_version_id]
      );
    }
  });
}

