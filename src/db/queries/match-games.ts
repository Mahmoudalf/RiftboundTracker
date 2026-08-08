import { newId } from '@/lib/id';

import { conn } from '../connection';
import type { MatchGameRow, MatchResult } from '../schema/matches';

import { hydrateMatchGame } from './hydrate';

/**
 * Per-game detail — the opt-in second tier of match logging.
 *
 * Deliberately **not** on the log sheet. That flow has a ten-second budget and
 * every field on it competes with that; recording an opening hand card by card
 * while an opponent waits to shuffle is the opposite of the design. This is a
 * separate pass over a match already logged, which is also when the detail is
 * actually available — you know the score after the game, not during it.
 *
 * Every field is nullable, and half-filled detail is worth keeping: someone who
 * records scores but never opening hands should still get score analytics.
 */

export interface MatchGameInput {
  gameNumber: number;
  result: MatchResult;
  onPlay?: boolean | null;
  scoreFor?: number | null;
  scoreAgainst?: number | null;
  championTurn?: number | null;
  oppChampionTurn?: number | null;
  /** Card ids kept after mulligan. Null means not recorded. */
  openingHand?: string[] | null;
  /** Card ids thrown back. Null means not recorded. */
  mulliganed?: string[] | null;
  battlefields?: string[] | null;
  notes?: string | null;
}

export function listMatchGames(matchId: string): MatchGameRow[] {
  return conn()
    .getAllSync<Record<string, unknown>>(
      'SELECT * FROM match_games WHERE match_id = ? ORDER BY game_number ASC',
      [matchId]
    )
    .map(hydrateMatchGame);
}

/**
 * Replace every game recorded against a match.
 *
 * Rewrites rather than diffs — a best-of-five is at most five rows, and the
 * editor hands over the whole set. One transaction, so a match is never left
 * holding half of an edit.
 *
 * An empty array clears the detail, which is how a player undoes a
 * mis-remembered game rather than being stuck with it.
 */
export class MatchGameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchGameError';
  }
}

export function saveMatchGames(matchId: string, games: readonly MatchGameInput[]): void {
  /*
   * Caught here rather than by the unique index.
   *
   * `match_games_number_idx` does stop it, but as a raw
   * "UNIQUE constraint failed" thrown out of the middle of a transaction —
   * true, unreadable, and impossible for a caller to turn into anything a user
   * could act on. The rollback means no rows survive either way; this only
   * changes what the caller is told.
   */
  const numbers = new Set<number>();
  for (const game of games) {
    if (numbers.has(game.gameNumber)) {
      throw new MatchGameError(`Game ${game.gameNumber} is listed twice.`);
    }
    numbers.add(game.gameNumber);
  }

  const json = (value: string[] | null | undefined) =>
    value === null || value === undefined ? null : JSON.stringify(value);
  const bool = (value: boolean | null | undefined) =>
    value === null || value === undefined ? null : value ? 1 : 0;

  conn().withTransactionSync(() => {
    conn().runSync('DELETE FROM match_games WHERE match_id = ?', [matchId]);

    for (const game of games) {
      conn().runSync(
        `INSERT INTO match_games
           (id, match_id, game_number, result, on_play,
            score_for, score_against, champion_turn, opp_champion_turn,
            opening_hand, mulliganed, battlefields, notes)
         VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?,?)`,
        [
          newId(),
          matchId,
          game.gameNumber,
          game.result,
          bool(game.onPlay),
          game.scoreFor ?? null,
          game.scoreAgainst ?? null,
          game.championTurn ?? null,
          game.oppChampionTurn ?? null,
          json(game.openingHand),
          json(game.mulliganed),
          json(game.battlefields),
          game.notes ?? null,
        ]
      );
    }

    // The match's own games-won summary is derived from the detail whenever the
    // detail exists — two places holding the same fact is how they disagree.
    if (games.length > 0) {
      const won = games.filter((g) => g.result === 'win').length;
      const lost = games.filter((g) => g.result === 'loss').length;
      conn().runSync(
        'UPDATE matches SET games_won = ?, games_lost = ?, updated_at = ?, dirty = 1 WHERE id = ?',
        [won, lost, new Date().toISOString(), matchId]
      );
    } else {
      conn().runSync(
        'UPDATE matches SET games_won = NULL, games_lost = NULL, updated_at = ?, dirty = 1 WHERE id = ?',
        [new Date().toISOString(), matchId]
      );
    }
  });
}

/** Every game across a set of matches, for analytics. */
export function gamesForMatches(matchIds: readonly string[]): MatchGameRow[] {
  if (matchIds.length === 0) return [];
  const placeholders = matchIds.map(() => '?').join(',');
  return conn()
    .getAllSync<Record<string, unknown>>(
      `SELECT * FROM match_games WHERE match_id IN (${placeholders})
        ORDER BY match_id, game_number ASC`,
      [...matchIds]
    )
    .map(hydrateMatchGame);
}
