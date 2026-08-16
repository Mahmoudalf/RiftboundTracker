import type { SaveResult } from '@/db/queries/decks';
import { t } from '@/i18n';

/**
 * What to tell the user a save just did.
 *
 * Four of the five outcomes used to say nothing at all — only a fork spoke. So
 * the most common case by far, editing a deck whose current version has no
 * matches yet, looked exactly like a save that failed: back on deck detail, same
 * version number, no new entry in the timeline. The behaviour was right and the
 * silence made it read as a bug.
 *
 * Each message names the version it acted on and, where the outcome is
 * surprising, why. "No new version" is only surprising if you do not know the
 * rule, and the rule is worth learning once from a line of text rather than
 * inferring from an absence.
 *
 * **This file was English until 2026-08-16.** It lives in `src/features/`, which
 * the untranslated-prose gate does not scan, so three user-facing strings sat
 * through a migration that reported zero. The blind spot is recorded in the
 * roadmap; the strings are fixed here.
 */
export function saveMessage(result: SaveResult): string {
  switch (result.outcome) {
    case 'no-op':
      return t('save.noChanges');

    case 'forked':
      /*
       * The first fork names the games that stayed behind.
       *
       * This is the moment the version-lock rule finishes executing on somebody
       * else's data for the first time, and a count is what makes it concrete:
       * "your earlier version is untouched" is a policy, "v1 keeps its 3 games"
       * is a fact about their deck. Every fork after says the shorter thing,
       * because by then the rule has been watched happening.
       */
      if (result.firstFork && result.parentGames > 0) {
        return t(result.parentGames === 1 ? 'save.forkedFirst.one' : 'save.forkedFirst.other', {
          version: result.versionNumber,
          parent: result.versionNumber - 1,
          count: result.parentGames,
        });
      }
      return t('save.forked', { version: result.versionNumber });

    case 'amended-locked':
      return t('save.amended', { version: result.versionNumber });
  }
}
