import { describe, expect, it } from 'vitest';

import type { GameRow, Result } from '@/db/schema/games';

import {
  bestOfSegments,
  matchupKey,
  matchupSegments,
  playDrawSplit,
  rateOf,
  separable,
  streaks,
  styleSegments,
} from './summary';
import { gamesNeeded, wilson } from './wilson';

/**
 * The analytics layer.
 *
 * Wilson is checked against externally known values rather than against itself,
 * because a confidence interval that is subtly wrong is worse than none — it
 * looks like rigour.
 */

function match(overrides: Partial<GameRow> & { result: Result }): GameRow {
  return {
    id: Math.random().toString(36).slice(2),
    deckId: 'deck', deckVersionId: 'version', playedAt: '2026-08-01T10:00:00.000Z',
    bestOf: null, matchesWon: null, matchesLost: null, onPlay: null,
    oppLegendCardId: null, oppChampionCardId: null, oppLegendName: null,
    oppChampionName: null, oppDomains: null,
    eventId: null, gameStyle: 'casual',
    notes: null, createdAt: '', updatedAt: '', deletedAt: null,
    userId: null, dirty: true, updatedByDevice: null,
    ...overrides,
  } as GameRow;
}

const wins = (n: number) => Array.from({ length: n }, () => match({ result: 'win' }));
const losses = (n: number) => Array.from({ length: n }, () => match({ result: 'loss' }));

describe('wilson', () => {
  /** Reference values, computed independently of this implementation. */
  it('matches known intervals', () => {
    const seven = wilson(7, 10);
    expect(seven.low).toBeCloseTo(0.3968, 3);
    expect(seven.high).toBeCloseTo(0.8922, 3);

    const half = wilson(50, 100);
    expect(half.low).toBeCloseTo(0.4038, 3);
    expect(half.high).toBeCloseTo(0.5962, 3);
  });

  it('stays sane at the boundaries, where the normal approximation does not', () => {
    // 3–0 is not proof. The textbook interval would say [1, 1].
    const perfect = wilson(3, 3);
    expect(perfect.high).toBe(1);
    expect(perfect.low).toBeGreaterThan(0.3);
    expect(perfect.low).toBeLessThan(0.5);

    const none = wilson(0, 3);
    expect(none.low).toBe(0);
    expect(none.high).toBeLessThan(0.7);
  });

  it('narrows as the sample grows', () => {
    const small = wilson(6, 10);
    const large = wilson(60, 100);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
  });

  it('is defined at zero trials rather than NaN', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe('gamesNeeded', () => {
  it('estimates how many more games would tighten the interval', () => {
    const needed = gamesNeeded(7, 10, 0.2);
    expect(needed).toBeGreaterThan(0);

    // And once it is tight enough, nothing more is needed.
    expect(gamesNeeded(60, 100, 0.2)).toBe(1);
  });

  it('gives up rather than printing a discouraging number', () => {
    expect(gamesNeeded(1, 2, 0.01, 50)).toBeNull();
  });
});

describe('rateOf', () => {
  it('scores a draw as half a win and half a loss', () => {
    const rate = rateOf([...wins(3), ...losses(1), match({ result: 'draw' })]);

    expect(rate.wins).toBe(3);
    expect(rate.draws).toBe(1);
    expect(rate.total).toBe(5);
    // Still reported, just no longer a denominator.
    expect(rate.decided).toBe(4);
    // 3.5 points over 5 games. Excluding the draw would say 75%, and counting
    // it as a loss 60% — both take a side that the result did not.
    expect(rate.points).toBe(3.5);
    expect(rate.rate).toBe(0.7);
  });

  it('puts a game of nothing but draws at exactly even', () => {
    // The case that decided the rule. Ignoring draws left this with no rate at
    // all, which is not what "everybody drew" means.
    const rate = rateOf([match({ result: 'draw' }), match({ result: 'draw' })]);

    expect(rate.rate).toBe(0.5);
    expect(rate.interval).not.toBeNull();
    expect(rate.total).toBe(2);
  });

  it('reads 6–6–1 as exactly even', () => {
    /*
     * The case the rule was chosen from. An equal record with a draw on top is
     * 50 % and nothing else: 6.5 points over 13 games. Counting the draw as a
     * loss would report 46 % for a player who has won and lost the same number
     * of games, which is the skew this rule exists to remove.
     */
    const rate = rateOf([...wins(6), ...losses(6), match({ result: 'draw' })]);

    expect(rate.total).toBe(13);
    expect(rate.rate).toBe(0.5);
  });

  it('leaves a drawless record exactly where it was', () => {
    // The rule change must be invisible to the majority of rows.
    expect(rateOf([...wins(6), ...losses(4)]).rate).toBe(0.6);
  });

  it('keeps the interval honest with fractional points', () => {
    // Wilson only ever uses p̂ and n, so half-points are legal input. The
    // boundary cases must still fire on a whitewash and only on a whitewash.
    expect(rateOf(wins(4)).interval).toMatchObject({ high: 1 });
    expect(rateOf(losses(4)).interval).toMatchObject({ low: 0 });

    const drawn = rateOf([...wins(3), match({ result: 'draw' })]);
    expect(drawn.interval!.high).toBeLessThan(1);
  });

  it('is empty-safe', () => {
    expect(rateOf([])).toMatchObject({ wins: 0, total: 0, rate: null, interval: null });
  });

  it('flags small samples as provisional', () => {
    expect(rateOf(wins(5)).provisional).toBe(true);
    expect(rateOf([...wins(15), ...losses(10)]).provisional).toBe(false);
  });
});

describe('playDrawSplit', () => {
  it('reports coverage, so a split from 2 of 40 cannot pass as the whole picture', () => {
    const matches = [
      match({ result: 'win', onPlay: true }),
      match({ result: 'loss', onPlay: false }),
      ...wins(8), // on-play not recorded
    ];

    const split = playDrawSplit(matches);
    expect(split.coverage).toEqual({ recorded: 2, total: 10 });
    expect(split.onPlay.wins).toBe(1);
    expect(split.onDraw.losses).toBe(1);
  });

  it('treats unrecorded as neither, never as on the draw', () => {
    const split = playDrawSplit(wins(5));
    expect(split.onPlay.total).toBe(0);
    expect(split.onDraw.total).toBe(0);
    expect(split.coverage.recorded).toBe(0);
  });
});

describe('matchupSegments', () => {
  it('groups by Legend and Champion, ordered by how much was played', () => {
    const matches = [
      match({ result: 'win', oppLegendName: 'Yasuo', oppChampionName: 'Unforgiven' }),
      match({ result: 'loss', oppLegendName: 'Yasuo', oppChampionName: 'Unforgiven' }),
      match({ result: 'win', oppLegendName: 'Lux' }),
    ];

    const segments = matchupSegments(matches);
    expect(segments[0]).toMatchObject({ label: 'Yasuo', sublabel: 'Unforgiven' });
    expect(segments[0]!.rate.total).toBe(2);
    expect(segments[1]!.label).toBe('Lux');
  });

  it('collapses printings and ignores matches with no opponent', () => {
    const segments = matchupSegments([
      match({ result: 'win', oppLegendName: 'Yasuo - Windrunner' }),
      match({ result: 'win', oppLegendName: 'Yasuo - Windrunner (Alternate Art)' }),
      match({ result: 'loss' }),
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0]!.rate.total).toBe(2);
  });

  /*
   * `matchupPlayDraw` was tested here and is gone with the Analytics redesign.
   *
   * It answered "does going first matter in *this* matchup", and the old panel
   * printed it as three dense lines under the matchup list. The `1_ANALYTIC02`
   * drawer has no such row, so the function lost its only consumer — gap 15,
   * the export nothing calls. Recorded in the roadmap rather than quietly kept,
   * because the question is a good one and the design may want it back.
   */

  it('identifies an opponent by Legend and Champion together', () => {
    // The key is the shared definition three callers now depend on. Two
    // different Champions behind the same Legend are two different decks.
    const matches = [
      match({ result: 'win', oppLegendName: 'Yasuo', oppChampionName: 'Yasuo — Windrunner' }),
      match({ result: 'loss', oppLegendName: 'Yasuo', oppChampionName: 'Yasuo — Stormcaller' }),
    ];

    expect(matchupSegments(matches)).toHaveLength(2);
    expect(matchupKey(matches[0]!)).not.toBe(matchupKey(matches[1]!));
  });

  it('has no matchup for a game with no opponent recorded', () => {
    expect(matchupKey(match({ result: 'win' }))).toBeNull();
    expect(matchupSegments([match({ result: 'win' })])).toEqual([]);
  });
});

describe('styleSegments and bestOfSegments', () => {
  it('groups by match style', () => {
    const segments = styleSegments([
      match({ result: 'win', gameStyle: 'tournament' }),
      match({ result: 'loss', gameStyle: 'tournament' }),
      match({ result: 'win', gameStyle: 'online' }),
    ]);

    expect(segments[0]).toMatchObject({ key: 'tournament' });
    expect(segments[0]!.rate.total).toBe(2);
  });

  it('skips matches with no format recorded', () => {
    const segments = bestOfSegments([
      match({ result: 'win', bestOf: 3 }),
      match({ result: 'win' }),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.rate.total).toBe(1);
  });
});

describe('streaks', () => {
  /** Every query in this app returns newest-first, so that is the input. */
  const newestFirst = (...results: Result[]) => results.map((result) => match({ result }));

  it('counts the current run, signed', () => {
    expect(streaks(newestFirst('win', 'win', 'loss')).current).toBe(2);
    expect(streaks(newestFirst('loss', 'loss', 'loss', 'win')).current).toBe(-3);
  });

  it('remembers the best and worst runs', () => {
    const run = streaks(newestFirst('win', 'loss', 'loss', 'loss', 'win', 'win'));
    expect(run.longestWin).toBe(2);
    expect(run.longestLoss).toBe(3);
    expect(run.current).toBe(1);
  });

  it('lets a draw break a streak rather than extend or end it', () => {
    // "Five in a row" means five wins; a draw in the middle is not one, and
    // counting it as a loss would be worse.
    const run = streaks(newestFirst('win', 'draw', 'win', 'win'));
    expect(run.current).toBe(1);
    expect(run.longestWin).toBe(2);
    expect(run.longestLoss).toBe(0);
  });

  it('is empty-safe', () => {
    expect(streaks([])).toEqual({ current: 0, longestWin: 0, longestLoss: 0 });
  });
});

describe('separable', () => {
  it('refuses to separate rates whose intervals overlap', () => {
    const a = rateOf([...wins(6), ...losses(4)]);
    const b = rateOf([...wins(4), ...losses(6)]);
    // 60 % against 40 % on ten games each is not a finding.
    expect(separable(a, b)).toBe(false);
  });

  it('separates them once the samples are large enough', () => {
    const a = rateOf([...wins(80), ...losses(20)]);
    const b = rateOf([...wins(20), ...losses(80)]);
    expect(separable(a, b)).toBe(true);
  });

  it('never separates when one side has no games at all', () => {
    expect(separable(rateOf(wins(10)), rateOf([]))).toBe(false);
  });
});
