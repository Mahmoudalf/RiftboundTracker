import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { MatchRow, Result } from '../schema/games';

import { hydrateMatch } from './hydrate';

/**
 * The matches inside a game — one play each, scored to 8.
 *
 * A Bo1 game holds one match, a Bo3 up to three. The encounter itself lives in
 * `queries/games.ts`.
 *
 * The log form writes the result, turn order and both Battlefields as the game
 * is recorded. Everything deeper — the opening deal, the score, the turn each
 * Champion landed — is a **second pass over a game already logged**, because
 * that flow has a ten-second budget and none of those answers even exists at
 * the table: you know the score after the match, not during it.
 *
 * Every field is nullable, and half-filled detail is worth keeping: someone who
 * records scores but never opening hands should still get score analytics.
 */

export interface MatchInput {
  matchNumber: number;
  result: Result;
  onPlay?: boolean | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  /** Every card dealt in the opening 4. Null means not recorded. */
  openingHand?: string[] | null;
  /** The subset of `openingHand` that went back. */
  mulliganed?: string[] | null;
  /** What was drawn in their place. */
  replacements?: string[] | null;
  battlefields?: string[] | null;
  /** This match's Battlefields, told apart. */
  battlefieldCardId?: string | null;
  oppBattlefieldCardId?: string | null;
  notes?: string | null;
}

export function listMatches(gameId: string): MatchRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      'SELECT * FROM matches WHERE game_id = ? ORDER BY match_number ASC',
      [gameId]
    )
    .map(hydrateMatch);
}

export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchError';
  }
}

/**
 * Replace every match recorded against a game.
 *
 * Rewrites rather than diffs — a best-of-five is at most five rows, and the
 * editor hands over the whole set. One transaction, so a game is never left
 * holding half of an edit.
 *
 * An empty array clears the detail, which is how a player undoes a
 * mis-remembered match rather than being stuck with it.
 */
export function saveMatches(gameId: string, matches: readonly MatchInput[]): void {
  /*
   * Caught here rather than by the unique index.
   *
   * `matches_number_idx` does stop it, but as a raw
   * "UNIQUE constraint failed" thrown out of the middle of a transaction —
   * true, unreadable, and impossible for a caller to turn into anything a user
   * could act on. The rollback means no rows survive either way; this only
   * changes what the caller is told.
   */
  const numbers = new Set<number>();
  for (const match of matches) {
    if (numbers.has(match.matchNumber)) {
      throw new MatchError(`Match ${match.matchNumber} is listed twice.`);
    }
    numbers.add(match.matchNumber);
  }

  const json = (value: string[] | null | undefined) =>
    value === null || value === undefined ? null : JSON.stringify(value);
  const bool = (value: boolean | null | undefined) =>
    value === null || value === undefined ? null : value ? 1 : 0;

  conn().withTransactionSync(() => {
    conn().runSync('DELETE FROM matches WHERE game_id = ?', [gameId]);

    for (const match of matches) {
      conn().runSync(
        `INSERT INTO matches
           (id, game_id, match_number, result, on_play,
            score_for, score_against,
            opening_hand, mulliganed, replacements, battlefields,
            battlefield_card_id, opp_battlefield_card_id, notes)
         VALUES (?,?,?,?,?, ?,?, ?,?,?,?, ?,?,?)`,
        [
          newId(),
          gameId,
          match.matchNumber,
          match.result,
          bool(match.onPlay),
          match.scoreFor ?? null,
          match.scoreAgainst ?? null,
          json(match.openingHand),
          json(match.mulliganed),
          json(match.replacements),
          json(match.battlefields),
          match.battlefieldCardId ?? null,
          match.oppBattlefieldCardId ?? null,
          match.notes ?? null,
        ]
      );
    }

    // The game's own matches-won summary is derived from the detail whenever
    // the detail exists — two places holding the same fact is how they disagree.
    if (matches.length > 0) {
      const won = matches.filter((m) => m.result === 'win').length;
      const lost = matches.filter((m) => m.result === 'loss').length;
      conn().runSync(
        'UPDATE games SET matches_won = ?, matches_lost = ?, updated_at = ?, dirty = 1 WHERE id = ?',
        [won, lost, new Date().toISOString(), gameId]
      );
    } else {
      conn().runSync(
        'UPDATE games SET matches_won = NULL, matches_lost = NULL, updated_at = ?, dirty = 1 WHERE id = ?',
        [new Date().toISOString(), gameId]
      );
    }
  });
}

/** Every match across a set of games, for analytics. */
export function matchesForGames(gameIds: readonly string[]): MatchRow[] {
  if (gameIds.length === 0) return [];
  const placeholders = gameIds.map(() => '?').join(',');
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT * FROM matches WHERE game_id IN (${placeholders})
        ORDER BY game_id, match_number ASC`,
      [...gameIds]
    )
    .map(hydrateMatch);
}
