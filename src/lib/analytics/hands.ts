import type { MatchRow } from '@/db/schema/games';

import { rateOf, type Coverage, type Rate, type Segment } from './summary';

/**
 * Opening hands and mulligans.
 *
 * The question a player actually asks is *"which cards do I keep throwing
 * back?"* — and the honest version of that has a denominator. A card
 * mulliganed twice means nothing until you know whether it was drawn twice or
 * twenty times.
 *
 * So every figure here is a rate over the matches where the card **was seen**,
 * with the same interval and provisional treatment as every other statistic in
 * the app. A card in one opening hand is not a pattern.
 *
 * ---
 *
 * **What the three arrays mean, because the arithmetic depends on it.**
 * Riftbound deals **4**, lets you recycle **up to 2** to the bottom, then draws
 * you back up — the same rule `lib/goldfish.ts` simulates.
 *
 * - `openingHand` — **all four cards dealt.**
 * - `mulliganed` — the subset of those four that went back.
 * - `replacements` — what was drawn in their place.
 *
 * So `seen = openingHand.length`, and a mulliganed id is a *member* of the
 * opening hand rather than a card outside it. This changed with the design's
 * advanced logging screen: `openingHand` used to hold only the cards **kept**,
 * making `seen = kept + mulliganed` the right sum. The new reading is better —
 * the four dealt cards are one observation, and splitting them across two
 * columns meant neither could be rendered as the hand it was.
 *
 * `replacements` stays out of `seen` deliberately. A card you drew *because* of
 * a mulligan was never part of the keep decision, and counting it would inflate
 * the denominator of every card that happens to replace a thrown one.
 */

/** A match only counts once its hand was actually recorded. */
function recorded(matches: readonly MatchRow[]): MatchRow[] {
  return matches.filter((m) => m.openingHand !== null || m.mulliganed !== null);
}

/**
 * The same shape every other split reports its fill rate with.
 *
 * An alias rather than a second interface — two identical declarations are two
 * things that can drift, and a coverage figure means the same thing here as it
 * does in a play/draw split.
 */
export type HandCoverage = Coverage;

export function handCoverage(games: readonly MatchRow[]): HandCoverage {
  return { recorded: recorded(games).length, total: games.length };
}

export interface CardHandStat {
  cardId: string;
  /** Matches where the card was dealt in the opening 4, kept or thrown. */
  seen: number;
  kept: number;
  mulliganed: number;
  /** Of the matches it was seen in, how often it went back. */
  mulliganRate: number;
  /** Performance in matches where it was kept. Null when never kept. */
  whenKept: Rate | null;
}

/**
 * Per-card keep and mulligan behaviour.
 *
 * Sorted by how often a card is thrown back, but **only among cards seen enough
 * times to mean anything** — otherwise a single mulligan of a card drawn once
 * tops the list at 100 % and buries the card you actually have a problem with.
 */
export function cardHandStats(
  matches: readonly MatchRow[],
  minimumSeen = 3
): CardHandStat[] {
  /** Every match the card was dealt in, and the subset where it went back. */
  const dealtIn = new Map<string, MatchRow[]>();
  const thrown = new Map<string, number>();

  for (const match of recorded(matches)) {
    const mulliganed = new Set(match.mulliganed ?? []);

    /*
     * One pass over the deal, not two.
     *
     * `openingHand` now holds all four dealt and `mulliganed` is a subset of
     * it, so adding the two would count a thrown card twice — once as seen and
     * again as thrown — and report a mulligan rate of 50 % for a card that goes
     * back every single time.
     */
    for (const id of match.openingHand ?? []) {
      const rows = dealtIn.get(id) ?? [];
      rows.push(match);
      dealtIn.set(id, rows);
      if (mulliganed.has(id)) thrown.set(id, (thrown.get(id) ?? 0) + 1);
    }

    /*
     * A card recorded as mulliganed but absent from the deal still counts.
     *
     * It should not happen — the log form only offers the four dealt cards —
     * but rows written before the two columns meant what they mean now hold
     * exactly that shape, and dropping them would silently shrink a sample.
     */
    for (const id of mulliganed) {
      if ((match.openingHand ?? []).includes(id)) continue;
      dealtIn.set(id, dealtIn.get(id) ?? []);
      thrown.set(id, (thrown.get(id) ?? 0) + 1);
    }
  }

  const stats: CardHandStat[] = [];

  for (const [cardId, rows] of dealtIn) {
    const mulliganed = thrown.get(cardId) ?? 0;
    const seen = Math.max(rows.length, mulliganed);
    if (seen < minimumSeen) continue;

    const keptRows = rows.filter((match) => !(match.mulliganed ?? []).includes(cardId));

    stats.push({
      cardId,
      seen,
      kept: seen - mulliganed,
      mulliganed,
      mulliganRate: mulliganed / seen,
      whenKept: keptRows.length > 0 ? rateOf(keptRows) : null,
    });
  }

  return stats.sort((a, b) => b.mulliganRate - a.mulliganRate || b.seen - a.seen);
}

/**
 * How opening hands perform, grouped by how many cards went back.
 *
 * The comparison people expect — does mulliganing actually cost me the game? —
 * and the one most likely to be read as causal when it is not. A hand you
 * mulligan was a bad hand; the mulligan is the response, not the cause.
 */
export function performanceByMulliganCount(games: readonly MatchRow[]): Segment[] {
  const buckets = new Map<number, MatchRow[]>();

  for (const game of recorded(games)) {
    const count = game.mulliganed?.length ?? 0;
    const rows = buckets.get(count) ?? [];
    rows.push(game);
    buckets.set(count, rows);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([count, rows]) => ({
      key: `mull-${count}`,
      label:
        count === 0
          ? 'Kept the opening hand'
          : `${count} card${count === 1 ? '' : 's'} back`,
      rate: rateOf(rows),
    }));
}

/*
 * `championTurnStats()` lived here — average landing turn for each side, split
 * at the deck's own median.
 *
 * Removed with the field in migration 19. It was correct and it was tested, and
 * that is exactly why it went rather than lingering: an exported analytic with
 * no column behind it is what gap 15 named. The reasoning is in the migration —
 * a landing turn without the board it landed on cannot say whether it was early
 * or late, so the average looked like information without being any.
 */

/**
 * A game decided by this many points or fewer was close.
 *
 * Riftbound scores to 8, so 2 is a quarter of the distance — one contested
 * battlefield. Stated as a constant because it is a judgement, not a rule, and
 * the screen that renders it should be able to name the threshold it used.
 */
export const CLOSE_MARGIN = 2;

export interface ScoreStat {
  coverage: Coverage;
  /** Mean points the opponent took off you in games you won. Null if none. */
  concededInWins: number | null;
  /** Mean points you took off them in games you lost. Null if none. */
  scoredInLosses: number | null;
  /** Close games versus the rest, each with its own interval. */
  segments: Segment[];
}

/**
 * How close the games actually were.
 *
 * The result column says you won; it cannot say whether you won 8–7 or 8–0, and
 * a deck that wins narrowly and loses badly is a different deck from one that
 * does the reverse — with the identical record.
 *
 * Both means are reported over **decided games only** and from their own side
 * of the result, because "average points conceded" pools two unlike things if a
 * loss is included: in a loss the opponent scored 8 by definition, and averaging
 * that in measures how often you lose rather than how close it was.
 */
export function scoreStats(games: readonly MatchRow[]): ScoreStat {
  const scored = games.filter((g) => g.scoreFor !== null && g.scoreAgainst !== null);

  const mean = (values: number[]) =>
    values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

  const close: MatchRow[] = [];
  const clear: MatchRow[] = [];
  for (const game of scored) {
    // Draws have a margin of zero and would land in `close` unread — they carry
    // no win or loss, so they would widen the sample without informing it.
    if (game.result === 'draw') continue;
    const margin = Math.abs(game.scoreFor! - game.scoreAgainst!);
    (margin <= CLOSE_MARGIN ? close : clear).push(game);
  }

  const segments: Segment[] = [];
  if (close.length > 0) {
    segments.push({
      key: 'close',
      label: `Decided by ${CLOSE_MARGIN} or fewer`,
      rate: rateOf(close),
    });
  }
  if (clear.length > 0) {
    segments.push({ key: 'clear', label: 'Decided by more', rate: rateOf(clear) });
  }

  return {
    coverage: { recorded: scored.length, total: games.length },
    concededInWins: mean(
      scored.filter((g) => g.result === 'win').map((g) => g.scoreAgainst!)
    ),
    scoredInLosses: mean(
      scored.filter((g) => g.result === 'loss').map((g) => g.scoreFor!)
    ),
    segments,
  };
}

