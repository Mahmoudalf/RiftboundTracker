import { describe, expect, it } from 'vitest';

import type { SaveOutcome, SaveResult } from '@/db/queries/decks';
import { diffLists } from '@/lib/deck-diff';

import { saveMessage } from './save-message';

const OUTCOMES: SaveOutcome[] = ['no-op', 'reprinted', 'amended', 'forked', 'amended-locked'];

function result(outcome: SaveOutcome): SaveResult {
  return {
    outcome,
    versionId: 'v',
    versionNumber: 2,
    diff: diffLists({ slots: [] }, { slots: [] }),
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
    expect(saveMessage(result('amended'))).toContain('no new version');
  });

  it('distinguishes a fork from an amend', () => {
    expect(saveMessage(result('forked'))).not.toBe(saveMessage(result('amended')));
  });
});
