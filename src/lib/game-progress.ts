import type { Result } from '@/db/schema/games';

/**
 * How far a best-of has got, and whether it is over.
 *
 * A Bo3 game that is 2–0 has no third match. The form for it must not be on
 * screen, because a field you can fill in for a match nobody played is an
 * invitation to record something that did not happen — and the game record is
 * the one thing in this app that has to stay true.
 *
 * Pure and separately tested: every rule here is one the log screen enforces
 * while someone is mid-flow, and getting it wrong either hides a match that was
 * played or asks for one that was not.
 */

export interface MatchEntry {
  /** Null until answered. */
  result: Result | null;
}

/** Matches needed to take the game. Bo1 → 1, Bo3 → 2, Bo5 → 3. */
export function matchesToWin(bestOf: number | null): number {
  if (!bestOf || bestOf < 1) return 1;
  return Math.ceil(bestOf / 2);
}

export interface GameProgress {
  /** Matches you have taken. */
  won: number;
  lost: number;
  drawn: number;
  /** Matches with an answer — draws included. */
  played: number;
  /** No further match can change the outcome. */
  decided: boolean;
  /**
   * The game result implied by its matches, or null while it is still open.
   *
   * A decided game is a win or a loss. A *full* best-of that nobody won — every
   * match drawn, or drawn matches leaving both short — is a draw: the matches
   * are spent and neither side reached the threshold.
   */
  result: Result | null;
}

export function gameProgress(
  matches: readonly MatchEntry[],
  bestOf: number | null
): GameProgress {
  const target = matchesToWin(bestOf);
  const limit = bestOf && bestOf > 0 ? bestOf : 1;

  let won = 0;
  let lost = 0;
  let drawn = 0;
  for (const match of matches.slice(0, limit)) {
    if (match.result === 'win') won += 1;
    else if (match.result === 'loss') lost += 1;
    else if (match.result === 'draw') drawn += 1;
    else break;
    /*
     * Stop at the decisive match.
     *
     * Answers to later matches are kept — correcting an earlier one has to
     * bring them back untouched — but a match played after the game was
     * already won did not happen. Counting it would let a corrected Bo3 read
     * 3–0.
     */
    if (won >= target || lost >= target) break;
  }

  const played = won + lost + drawn;
  const reached = won >= target || lost >= target;
  // Drawn matches can exhaust a best-of without either side reaching the target.
  const exhausted = played >= limit;
  const decided = reached || exhausted;

  let result: Result | null = null;
  if (won >= target) result = 'win';
  else if (lost >= target) result = 'loss';
  else if (exhausted) result = won > lost ? 'win' : lost > won ? 'loss' : 'draw';

  return { won, lost, drawn, played, decided, result };
}

/**
 * How many match forms to show.
 *
 * One more than has been answered, until the game is decided — so the next
 * match appears as soon as the last one is filled in, and nothing beyond it is
 * ever on screen. Reverses cleanly: flip match 1 from a win to a loss in a 2–0
 * Bo3 and match 3 comes back, because `played` and `decided` are recomputed
 * from the answers rather than tracked as their own state.
 */
export function visibleMatches(matches: readonly MatchEntry[], bestOf: number | null): number {
  const limit = bestOf && bestOf > 0 ? bestOf : 1;
  const { played, decided } = gameProgress(matches, bestOf);
  if (decided) return Math.min(played, limit);
  return Math.min(played + 1, limit);
}

/** `2–1`, or null before a match has been answered. */
export function matchScoreLine(
  matches: readonly MatchEntry[],
  bestOf: number | null
): string | null {
  const { won, lost, drawn, played } = gameProgress(matches, bestOf);
  if (played === 0) return null;
  return drawn > 0 ? `${won}–${lost}–${drawn}` : `${won}–${lost}`;
}
