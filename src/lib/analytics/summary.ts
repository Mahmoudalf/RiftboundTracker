import type { Result, GameRow } from '@/db/schema/games';
import { t } from '@/i18n';
import { baseName } from '@/lib/card-identity';

import { wilson, type Interval } from './wilson';

/**
 * Analytics over an array of game rows — pure, no SQL, no React.
 *
 * A heavy user has a few thousand games, which is nothing to compute in
 * memory, and pure functions are the only part of this app that can be tested
 * hard. See `docs/DATA-MODEL.md` §4.
 *
 * ## Two rules that are not negotiable
 *
 * **A draw is half a win and half a loss.** Every game is worth a point: 1 for
 * a win, ½ for a draw, 0 for a loss, and the rate is points over games played.
 * It is the scoring every tournament already uses, and it is the only handling
 * where a draw pulls the number toward 50 % instead of toward one side.
 *
 * The two alternatives both take a side, which is why neither survived:
 *
 * | Rule | 6–5–1 reads |
 * | --- | --- |
 * | Draw counts as a loss (draws in the denominator, wins in the numerator) | 50 % |
 * | Draw ignored entirely (the rule until 2026-08-14) | 54.5 % |
 * | **Draw is half of each** | **54.2 %** |
 *
 * Ignoring draws was defensible — it is "of the games that were decided, how
 * many did I win" — but it throws away a real game, and at 10–0–1 it reports
 * 100 % for a deck that has not won everything. Counting a draw as a loss is
 * worse: it is the number this app is meant not to produce, a figure that reads
 * as losing because of a result that was not a loss.
 *
 * **Every rate carries its sample size and interval.** `Rate` cannot be
 * constructed without them, so no screen can render one without — that is the
 * point of returning a struct rather than a number.
 */

/** Below this many games, a rate is shown as provisional. */
export const PROVISIONAL_N = 20;

export interface Rate {
  wins: number;
  losses: number;
  draws: number;
  /**
   * Games that had a winner.
   *
   * Reported because "9–8–3" and "9–8" are different histories, but **no longer
   * the denominator of anything** — that is `total`. Kept as a fact about the
   * record rather than as an input to the rate.
   */
  decided: number;
  /** Every game. The denominator of `rate`. */
  total: number;
  /** Wins plus half a point per draw. The numerator of `rate`. */
  points: number;
  /** Null only at zero games — there is no rate, not a rate of zero. */
  rate: number | null;
  interval: Interval | null;
  provisional: boolean;
}

/**
 * Anything with a result can be rated — a whole game, or one match inside it.
 *
 * Widened from `GameRow` so the hand analytics can rate individual matches. The
 * alternative was a cast, which compiles today only because this function reads
 * nothing but `result`; the first time it read another field the cast would
 * have started lying silently.
 */
export function rateOf(matches: readonly { result: Result }[]): Rate {
  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const match of matches) {
    if (match.result === 'win') wins++;
    else if (match.result === 'loss') losses++;
    else draws++;
  }

  const total = matches.length;
  /*
   * Half a point per draw. Fractional successes are fine for Wilson — the
   * formula only ever uses p̂ and n, and neither wants an integer. The two
   * boundary special-cases inside `wilson` stay correct too: `points === 0` is
   * every game lost and `points === total` is every game won, and a single
   * draw puts the value strictly between them.
   */
  const points = wins + draws / 2;

  return {
    wins,
    losses,
    draws,
    decided: wins + losses,
    total,
    points,
    rate: total === 0 ? null : points / total,
    interval: total === 0 ? null : wilson(points, total),
    provisional: total < PROVISIONAL_N,
  };
}

export interface Segment {
  key: string;
  label: string;
  /** Secondary line — an opponent's Champion, say. */
  sublabel?: string;
  rate: Rate;
}

/** Group games by a key, drop empty groups, and rank by sample size. */
function segment(
  matches: readonly GameRow[],
  keyOf: (match: GameRow) => { key: string; label: string; sublabel?: string } | null
): Segment[] {
  const groups = new Map<string, { label: string; sublabel?: string; rows: GameRow[] }>();

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
 * Every split has one. A play/draw breakdown computed from 3 of 40 games is
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

export function playDrawSplit(matches: readonly GameRow[]): PlayDrawSplit {
  const onPlay = matches.filter((m) => m.onPlay === true);
  const onDraw = matches.filter((m) => m.onPlay === false);

  return {
    onPlay: rateOf(onPlay),
    onDraw: rateOf(onDraw),
    coverage: { recorded: onPlay.length + onDraw.length, total: matches.length },
  };
}

/**
 * How one opposing deck is identified.
 *
 * The opposing **Legend and Chosen Champion together**, which is what
 * identifies a deck in Riftbound, from the stored names rather than card ids so
 * that printings collapse and a card leaving the library changes nothing. Null
 * when no opponent was recorded.
 *
 * Exported because three callers need the same answer — the segment list, the
 * per-matchup play/draw split, and the findings layer's complement. It was
 * derived inline in two of them, which is two definitions of "the same
 * opponent" that could drift apart without anything failing.
 */
export function matchupKey(match: GameRow): string | null {
  // `?? match.oppLabel` was here until migration 22 dropped that column. It
  // was never written, so this has always fallen through to the null branch.
  const legendName = match.oppLegendName;
  if (!legendName) return null;
  const champion = match.oppChampionName ? baseName(match.oppChampionName) : '';
  return `${baseName(legendName).toLowerCase()}|${champion.toLowerCase()}`;
}

/** Performance against each opposing deck. */
export function matchupSegments(matches: readonly GameRow[]): Segment[] {
  return segment(matches, (match) => {
    const key = matchupKey(match);
    const legendName = match.oppLegendName;
    // Both checked rather than asserting the second from the first. `matchupKey`
    // returning non-null does imply a Legend today, but that is a fact about its
    // body, and a `!` here would be a claim the compiler stops rechecking.
    if (!key || !legendName) return null;
    return {
      key,
      label: baseName(legendName),
      sublabel: match.oppChampionName ? baseName(match.oppChampionName) : undefined,
    };
  });
}

/*
 * `matchupPlayDraw()` lived here — the play/draw split inside one matchup, for
 * "does going first matter *here*".
 *
 * Removed with the Analytics redesign. The old panel printed it as three dense
 * lines under the matchup list; the `1_ANALYTIC02` drawer has no row for it, so
 * it lost its only consumer and became gap 15 — the export nothing calls. It
 * goes rather than lingering, for the same reason `championTurnStats` did.
 *
 * The question is a good one and this is a five-line function over `matchupKey`
 * and `playDrawSplit`, both of which are still here. If the design asks for it,
 * it comes straight back.
 */

export function styleSegments(matches: readonly GameRow[]): Segment[] {
  return segment(matches, (match) => ({ key: match.gameStyle, label: match.gameStyle }));
}

export function bestOfSegments(matches: readonly GameRow[]): Segment[] {
  return segment(matches, (match) =>
    match.bestOf === null
      ? null
      : { key: `bo${match.bestOf}`, label: t('analytics.bestOf', { count: match.bestOf }) }
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
export function streaks(newestFirst: readonly GameRow[]): Streaks {
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
