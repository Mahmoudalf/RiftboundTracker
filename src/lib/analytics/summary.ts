import type { MatchResult, MatchRow } from '@/db/schema/matches';
import { baseName } from '@/lib/card-identity';

import { wilson, type Interval } from './wilson';

/**
 * Analytics over an array of match rows — pure, no SQL, no React.
 *
 * A heavy user has a few thousand matches, which is nothing to compute in
 * memory, and pure functions are the only part of this app that can be tested
 * hard. See `docs/DATA-MODEL.md` §4.
 *
 * ## Two rules that are not negotiable
 *
 * **Draws are excluded from the win rate.** A rate is "of the matches that were
 * decided, how many did I win", and putting draws in the denominator drags the
 * number down in a way that reads as losing. They stay in the record, which is
 * where they are information.
 *
 * **Every rate carries its sample size and interval.** `Rate` cannot be
 * constructed without them, so no screen can render one without — that is the
 * point of returning a struct rather than a number.
 */

/** Below this many decided matches, a rate is shown as provisional. */
export const PROVISIONAL_N = 20;

export interface Rate {
  wins: number;
  losses: number;
  draws: number;
  /** Wins plus losses. The denominator of `rate`. */
  decided: number;
  /** Every match, draws included. The honest "how much have I played". */
  total: number;
  /** Null at zero decided matches — there is no rate, not a rate of zero. */
  rate: number | null;
  interval: Interval | null;
  provisional: boolean;
}

/**
 * Anything with a result can be rated — matches, and individual games.
 *
 * Widened from `MatchRow` so the hand analytics can rate games directly. The
 * alternative was a cast, which compiles today only because this function reads
 * nothing but `result`; the first time it read another field the cast would
 * have started lying silently.
 */
export function rateOf(matches: readonly { result: MatchResult }[]): Rate {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const match of matches) {
    if (match.result === 'win') wins++;
    else if (match.result === 'loss') losses++;
    else draws++;
  }

  const decided = wins + losses;
  return {
    wins,
    losses,
    draws,
    decided,
    total: matches.length,
    rate: decided === 0 ? null : wins / decided,
    interval: decided === 0 ? null : wilson(wins, decided),
    provisional: decided < PROVISIONAL_N,
  };
}

export interface Segment {
  key: string;
  label: string;
  /** Secondary line — an opponent's Champion, say. */
  sublabel?: string;
  rate: Rate;
}

/** Group matches by a key, drop empty groups, and rank by sample size. */
function segment(
  matches: readonly MatchRow[],
  keyOf: (match: MatchRow) => { key: string; label: string; sublabel?: string } | null
): Segment[] {
  const groups = new Map<string, { label: string; sublabel?: string; rows: MatchRow[] }>();

  for (const match of matches) {
    const identity = keyOf(match);
    if (!identity) continue;
    const entry = groups.get(identity.key) ?? {
      label: identity.label,
      sublabel: identity.sublabel,
      rows: [],
    };
    entry.rows.push(match);
    groups.set(identity.key, entry);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      sublabel: group.sublabel,
      rate: rateOf(group.rows),
    }))
    // Most-played first: a matchup with 12 games is more worth reading than one
    // with 1, and sorting by win rate would put every 1–0 at the top.
    .sort((a, b) => b.rate.total - a.rate.total || a.label.localeCompare(b.label));
}

/**
 * How much of a field was actually filled in.
 *
 * Every split has one. A play/draw breakdown computed from 3 of 40 matches is
 * not wrong, but presenting it without saying so invites a conclusion drawn
 * from 7 % of the data.
 */
export interface Coverage {
  recorded: number;
  total: number;
}

export interface PlayDrawSplit {
  onPlay: Rate;
  onDraw: Rate;
  coverage: Coverage;
}

export function playDrawSplit(matches: readonly MatchRow[]): PlayDrawSplit {
  const onPlay = matches.filter((m) => m.onPlay === true);
  const onDraw = matches.filter((m) => m.onPlay === false);

  return {
    onPlay: rateOf(onPlay),
    onDraw: rateOf(onDraw),
    coverage: { recorded: onPlay.length + onDraw.length, total: matches.length },
  };
}

/**
 * Performance against each opposing deck.
 *
 * Keyed on the opposing **Legend and Chosen Champion together**, which is what
 * identifies a deck in Riftbound, and on the stored names rather than card ids
 * so that printings collapse and a card leaving the library changes nothing.
 */
export function matchupSegments(matches: readonly MatchRow[]): Segment[] {
  return segment(matches, (match) => {
    const legendName = match.oppLegendName ?? match.oppLabel;
    if (!legendName) return null;
    const legend = baseName(legendName);
    const champion = match.oppChampionName ? baseName(match.oppChampionName) : undefined;
    return {
      key: `${legend.toLowerCase()}|${(champion ?? '').toLowerCase()}`,
      label: legend,
      sublabel: champion,
    };
  });
}

/** The play/draw split inside one matchup, for "does going first matter here". */
export function matchupPlayDraw(
  matches: readonly MatchRow[],
  key: string
): PlayDrawSplit | null {
  const rows = matches.filter((match) => {
    const legendName = match.oppLegendName ?? match.oppLabel;
    if (!legendName) return false;
    const champion = match.oppChampionName ? baseName(match.oppChampionName) : '';
    return `${baseName(legendName).toLowerCase()}|${champion.toLowerCase()}` === key;
  });
  return rows.length === 0 ? null : playDrawSplit(rows);
}

export function styleSegments(matches: readonly MatchRow[]): Segment[] {
  return segment(matches, (match) => ({ key: match.eventType, label: match.eventType }));
}

export function bestOfSegments(matches: readonly MatchRow[]): Segment[] {
  return segment(matches, (match) =>
    match.bestOf === null ? null : { key: `bo${match.bestOf}`, label: `Best of ${match.bestOf}` }
  );
}

export interface Streaks {
  /** Signed: positive for wins, negative for losses, 0 for none. */
  current: number;
  longestWin: number;
  longestLoss: number;
}

/**
 * Win and loss streaks, oldest to newest.
 *
 * Draws **break** a streak rather than extending or ending it as a loss — "five
 * in a row" means five wins, and a draw in the middle is not one. It is the
 * least surprising reading, and the alternative silently inflates the number.
 *
 * Expects the newest-first order every query in this app returns, and reverses
 * internally, so callers cannot get it backwards by forgetting to sort.
 */
export function streaks(newestFirst: readonly MatchRow[]): Streaks {
  let current = 0;
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;

  for (let i = newestFirst.length - 1; i >= 0; i--) {
    const result = newestFirst[i]!.result;
    if (result === 'win') run = run > 0 ? run + 1 : 1;
    else if (result === 'loss') run = run < 0 ? run - 1 : -1;
    else run = 0;

    longestWin = Math.max(longestWin, run);
    longestLoss = Math.max(longestLoss, -run);
  }
  current = run;

  return { current, longestWin, longestLoss };
}

/**
 * Whether two rates can be told apart at all.
 *
 * Overlapping Wilson intervals means the data does not separate them, and the
 * only honest verdict is that it does not. Deliberately conservative: interval
 * overlap is a stricter test than a significance test, and erring towards "we
 * cannot tell" is the right direction for a tool people use to make decisions.
 */
export function separable(a: Rate, b: Rate): boolean {
  if (!a.interval || !b.interval) return false;
  return a.interval.high < b.interval.low || b.interval.high < a.interval.low;
}
