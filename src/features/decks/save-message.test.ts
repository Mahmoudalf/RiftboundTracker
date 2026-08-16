import { describe, expect, it } from 'vitest';

import type { SaveOutcome, SaveResult } from '@/db/queries/decks';
import { diffLists } from '@/lib/deck-diff';

import { saveMessage } from './save-message';

const OUTCOMES: SaveOutcome[] = ['no-op', 'forked', 'amended-locked'];

function result(outcome: SaveOutcome, over: Partial<SaveResult> = {}): SaveResult {
  return {
    outcome,
    versionId: 'v',
    versionNumber: 2,
    diff: diffLists({ slots: [] }, { slots: [] }),
    firstFork: false,
    parentGames: 0,
    ...over,
  };
}

describe('saveMessage', () => {
  /*
   * The point of the whole module. Gap 2 was an outcome with no message, so the
   * test that matters is that no outcome can reach the user as silence.
   */
  it('says something for every outcome', () => {
    for (const outcome of OUTCOMES) {
      expect(saveMessage(result(outcome)).length).toBeGreaterThan(0);
    }
  });

  it('names the version it acted on', () => {
    for (const outcome of OUTCOMES) {
      if (outcome === 'no-op') continue; // Nothing was acted on.
      expect(saveMessage(result(outcome))).toContain('v2');
    }
  });

  it('explains the absence of a new version when amending', () => {
    expect(saveMessage(result('forked'))).toContain('untouched');
  });

  it('distinguishes a fork from an amend', () => {
    expect(saveMessage(result('forked'))).not.toBe(saveMessage(result('amended-locked')));
  });
});

describe('the first fork', () => {
  /*
   * The version-lock rule finishing on somebody's own data for the first time.
   * "Your earlier version is untouched" is a policy; naming the games that
   * stayed behind is a fact about their deck, and only the second is worth the
   * one chance this message gets.
   */
  it('names the version left behind and its games', () => {
    const message = saveMessage(result('forked', { firstFork: true, parentGames: 3 }));
    expect(message).toContain('v1');
    expect(message).toContain('3');
  });

  it('uses the singular for one game', () => {
    const message = saveMessage(result('forked', { firstFork: true, parentGames: 1 }));
    expect(message).toContain('1 game');
    expect(message).not.toContain('1 games');
  });

  it('falls back to the standard line for every fork after the first', () => {
    const first = saveMessage(result('forked', { firstFork: true, parentGames: 3 }));
    const later = saveMessage(result('forked', { firstFork: false, parentGames: 3 }));

    expect(later).not.toBe(first);
    expect(later).toContain('untouched');
  });

  it('falls back when the forked version had no games', () => {
    // A version can be locked without ever having been played — the dev lock, or
    // a pre-M4 row. Claiming it "keeps its 0 games" would be a lie about the one
    // thing this message exists to make concrete.
    const message = saveMessage(result('forked', { firstFork: true, parentGames: 0 }));
    expect(message).toContain('untouched');
  });
});
