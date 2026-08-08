import type { MatchGameRow } from '@/db/schema/matches';

import { rateOf, type Rate, type Segment } from './summary';

/**
 * Opening hands and mulligans.
 *
 * The question a player actually asks is *"which cards do I keep throwing
 * back?"* — and the honest version of that has a denominator. A card
 * mulliganed twice means nothing until you know whether it was drawn twice or
 * twenty times.
 *
 * So every figure here is a rate over the games where the card **was seen**,
 * with the same interval and provisional treatment as every other statistic in
 * the app. A card in one opening hand is not a pattern.
 */

/** A game only counts once its hand was actually recorded. */
function recorded(games: readonly MatchGameRow[]): MatchGameRow[] {
  return games.filter((g) => g.openingHand !== null || g.mulliganed !== null);
}

export interface HandCoverage {
  recorded: number;
  total: number;
}

export function handCoverage(games: readonly MatchGameRow[]): HandCoverage {
  return { recorded: recorded(games).length, total: games.length };
}

export interface CardHandStat {
  cardId: string;
  /** Games where the card was in the opening seven, kept or thrown. */
  seen: number;
  kept: number;
  mulliganed: number;
  /** Of the games it was seen in, how often it went back. */
  mulliganRate: number;
  /** Performance in games where it was kept. Null when never kept. */
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
  games: readonly MatchGameRow[],
  minimumSeen = 3
): CardHandStat[] {
  const kept = new Map<string, MatchGameRow[]>();
  const thrown = new Map<string, number>();

  for (const game of recorded(games)) {
    for (const id of game.openingHand ?? []) {
      const rows = kept.get(id) ?? [];
      rows.push(game);
      kept.set(id, rows);
    }
    for (const id of game.mulliganed ?? []) {
      thrown.set(id, (thrown.get(id) ?? 0) + 1);
    }
  }

  const ids = new Set([...kept.keys(), ...thrown.keys()]);
  const stats: CardHandStat[] = [];

  for (const cardId of ids) {
    const keptGames = kept.get(cardId) ?? [];
    const mulliganed = thrown.get(cardId) ?? 0;
    const seen = keptGames.length + mulliganed;
    if (seen < minimumSeen) continue;

    stats.push({
      cardId,
      seen,
      kept: keptGames.length,
      mulliganed,
      mulliganRate: mulliganed / seen,
      whenKept: keptGames.length > 0 ? rateOf(keptGames) : null,
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
export function performanceByMulliganCount(games: readonly MatchGameRow[]): Segment[] {
  const buckets = new Map<number, MatchGameRow[]>();

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

/**
 * Average turn the Chosen Champion landed, and how it went.
 *
 * Split at the median rather than at a fixed turn, because "early" depends on
 * the deck — a control deck landing its Champion on turn 6 may be on curve.
 */
export interface ChampionTurnStat {
  recorded: number;
  averageTurn: number | null;
  earlier: Rate;
  later: Rate;
  median: number | null;
}

export function championTurnStats(games: readonly MatchGameRow[]): ChampionTurnStat {
  const withTurn = games.filter((g) => g.championTurn !== null);
  if (withTurn.length === 0) {
    return {
      recorded: 0,
      averageTurn: null,
      median: null,
      earlier: rateOf([]),
      later: rateOf([]),
    };
  }

  const turns = withTurn.map((g) => g.championTurn!).sort((a, b) => a - b);
  const median = turns[Math.floor(turns.length / 2)]!;
  const average = turns.reduce((sum, t) => sum + t, 0) / turns.length;

  return {
    recorded: withTurn.length,
    averageTurn: average,
    median,
    earlier: rateOf(withTurn.filter((g) => g.championTurn! <= median)),
    later: rateOf(withTurn.filter((g) => g.championTurn! > median)),
  };
}

