import { describe, expect, it } from 'vitest';

import type { MatchResult } from '@/db/schema/matches';

import { gameScoreLine, gamesToWin, matchProgress, visibleGames } from './match-progress';

/**
 * The rule the log screen enforces mid-flow.
 *
 * The case that matters most is the one that must *not* appear: a Bo3 at 2–0
 * has no game 3, and a form for it would invite recording a game nobody played.
 * The reverse matters just as much — correcting game 1 has to bring game 3 back
 * without disturbing game 2.
 */

const g = (...results: (MatchResult | null)[]) => results.map((result) => ({ result }));

describe('gamesToWin', () => {
  it('is a majority of the format', () => {
    expect(gamesToWin(1)).toBe(1);
    expect(gamesToWin(3)).toBe(2);
    expect(gamesToWin(5)).toBe(3);
  });

  it('treats an unrecorded format as a single game', () => {
    expect(gamesToWin(null)).toBe(1);
    expect(gamesToWin(0)).toBe(1);
  });
});

describe('visibleGames', () => {
  it('opens on one form', () => {
    expect(visibleGames(g(), 3)).toBe(1);
  });

  it('reveals the next game once the last is answered', () => {
    expect(visibleGames(g('win'), 3)).toBe(2);
    expect(visibleGames(g('win', 'loss'), 3)).toBe(3);
  });

  /** The case the user asked for by name. */
  it('never shows game 3 once a Bo3 is 2–0', () => {
    expect(visibleGames(g('win', 'win'), 3)).toBe(2);
    expect(visibleGames(g('loss', 'loss'), 3)).toBe(2);
  });

  it('brings game 3 back if game 1 is corrected', () => {
    expect(visibleGames(g('win', 'win'), 3)).toBe(2);
    // Same array, first game flipped — nothing else touched.
    expect(visibleGames(g('loss', 'win'), 3)).toBe(3);
  });

  it('never exceeds the format', () => {
    expect(visibleGames(g('win', 'loss', 'win'), 3)).toBe(3);
    expect(visibleGames(g('win'), 1)).toBe(1);
    expect(visibleGames(g('draw', 'draw', 'draw'), 3)).toBe(3);
  });

  it('shows one form for a Bo1 and for an unrecorded format', () => {
    expect(visibleGames(g(), 1)).toBe(1);
    expect(visibleGames(g(), null)).toBe(1);
    expect(visibleGames(g('win'), null)).toBe(1);
  });
});

describe('matchProgress', () => {
  it('is undecided while either side can still win', () => {
    expect(matchProgress(g('win'), 3)).toMatchObject({ decided: false, result: null });
    expect(matchProgress(g('win', 'loss'), 3)).toMatchObject({ decided: false, result: null });
  });

  it('derives the result rather than asking for it', () => {
    expect(matchProgress(g('win', 'win'), 3)).toMatchObject({ decided: true, result: 'win' });
    expect(matchProgress(g('loss', 'loss'), 3)).toMatchObject({ decided: true, result: 'loss' });
    expect(matchProgress(g('win', 'loss', 'win'), 3)).toMatchObject({
      decided: true,
      result: 'win',
    });
  });

  it('settles a Bo1 on one game', () => {
    expect(matchProgress(g('loss'), 1)).toMatchObject({ decided: true, result: 'loss' });
  });

  /*
   * Drawn games can spend a best-of without either side reaching the target.
   * The match is over — there are no games left — and neither side won it.
   */
  it('calls a full best-of that nobody won a draw', () => {
    expect(matchProgress(g('draw', 'draw', 'draw'), 3)).toMatchObject({
      decided: true,
      result: 'draw',
    });
    expect(matchProgress(g('win', 'loss', 'draw'), 3)).toMatchObject({
      decided: true,
      result: 'draw',
    });
  });

  it('ignores games beyond the format', () => {
    // A format shortened after the fact must not count games it cannot hold.
    expect(matchProgress(g('win', 'win', 'win'), 1)).toMatchObject({ won: 1, played: 1 });
  });

  /*
   * The log screen keeps every answer so correcting one does not wipe the rest.
   * That means a game entered before a correction can still be sitting there
   * after the match has been won — it must not count.
   */
  it('stops at the decisive game, ignoring answers kept after it', () => {
    expect(matchProgress(g('win', 'win', 'win'), 3)).toMatchObject({ won: 2, played: 2 });
    expect(gameScoreLine(g('win', 'win', 'win'), 3)).toBe('2–0');
    expect(visibleGames(g('win', 'win', 'win'), 3)).toBe(2);
  });

  it('stops at the first unanswered game', () => {
    // Games are sequential; nothing past a gap was played.
    expect(matchProgress(g('win', null, 'win'), 3)).toMatchObject({ won: 1, played: 1 });
    expect(visibleGames(g('win', null, 'win'), 3)).toBe(2);
  });

  it('counts nothing before an answer', () => {
    expect(matchProgress(g(null, null), 3)).toMatchObject({
      won: 0,
      lost: 0,
      played: 0,
      decided: false,
      result: null,
    });
  });
});

describe('gameScoreLine', () => {
  it('reads as a score', () => {
    expect(gameScoreLine(g('win', 'loss'), 3)).toBe('1–1');
    expect(gameScoreLine(g('win', 'win'), 3)).toBe('2–0');
  });

  it('shows draws only when there are some', () => {
    expect(gameScoreLine(g('win', 'draw'), 3)).toBe('1–0–1');
  });

  it('says nothing before the first game', () => {
    expect(gameScoreLine(g(), 3)).toBeNull();
  });
});
