import type { MatchResult } from '@/db/schema/matches';

/**
 * How far a best-of has got, and whether it is over.
 *
 * A Bo3 that is 2–0 has no third game. The form for it must not be on screen,
 * because a field you can fill in for a game nobody played is an invitation to
 * record something that did not happen — and the match record is the one thing
 * in this app that has to stay true.
 *
 * Pure and separately tested: every rule here is one the log screen enforces
 * while someone is mid-flow, and getting it wrong either hides a game that was
 * played or asks for one that was not.
 */

export interface GameEntry {
  /** Null until answered. */
  result: MatchResult | null;
}

/** Wins needed to take the match. Bo1 → 1, Bo3 → 2, Bo5 → 3. */
export function gamesToWin(bestOf: number | null): number {
  if (!bestOf || bestOf < 1) return 1;
  return Math.ceil(bestOf / 2);
}

export interface MatchProgress {
  /** Games you have taken. */
  won: number;
  lost: number;
  drawn: number;
  /** Games with an answer — draws included. */
  played: number;
  /** No further game can change the outcome. */
  decided: boolean;
  /**
   * The match result implied by the games, or null while it is still open.
   *
   * A decided match is a win or a loss. A *full* best-of that nobody won — every
   * game drawn, or drawn games leaving both short — is a draw: the games are
   * spent and neither side reached the threshold.
   */
  result: MatchResult | null;
}

export function matchProgress(
  games: readonly GameEntry[],
  bestOf: number | null
): MatchProgress {
  const target = gamesToWin(bestOf);
  const limit = bestOf && bestOf > 0 ? bestOf : 1;

  let won = 0;
  let lost = 0;
  let drawn = 0;
  for (const game of games.slice(0, limit)) {
    if (game.result === 'win') won += 1;
    else if (game.result === 'loss') lost += 1;
    else if (game.result === 'draw') drawn += 1;
    else break;
    /*
     * Stop at the decisive game.
     *
     * Answers to later games are kept — correcting an earlier one has to bring
     * them back untouched — but a game played after the match was already won
     * did not happen. Counting it would let a corrected Bo3 read 3–0.
     */
    if (won >= target || lost >= target) break;
  }

  const played = won + lost + drawn;
  const reached = won >= target || lost >= target;
  // Drawn games can exhaust a best-of without either side reaching the target.
  const exhausted = played >= limit;
  const decided = reached || exhausted;

  let result: MatchResult | null = null;
  if (won >= target) result = 'win';
  else if (lost >= target) result = 'loss';
  else if (exhausted) result = won > lost ? 'win' : lost > won ? 'loss' : 'draw';

  return { won, lost, drawn, played, decided, result };
}

/**
 * How many game forms to show.
 *
 * One more than has been answered, until the match is decided — so the next
 * game appears as soon as the last one is filled in, and nothing beyond it is
 * ever on screen. Reverses cleanly: flip game 1 from a win to a loss in a 2–0
 * Bo3 and game 3 comes back, because `played` and `decided` are recomputed from
 * the answers rather than tracked as their own state.
 */
export function visibleGames(games: readonly GameEntry[], bestOf: number | null): number {
  const limit = bestOf && bestOf > 0 ? bestOf : 1;
  const { played, decided } = matchProgress(games, bestOf);
  if (decided) return Math.min(played, limit);
  return Math.min(played + 1, limit);
}

/** `2–1`, or null before a game has been answered. */
export function gameScoreLine(
  games: readonly GameEntry[],
  bestOf: number | null
): string | null {
  const { won, lost, drawn, played } = matchProgress(games, bestOf);
  if (played === 0) return null;
  return drawn > 0 ? `${won}–${lost}–${drawn}` : `${won}–${lost}`;
}
