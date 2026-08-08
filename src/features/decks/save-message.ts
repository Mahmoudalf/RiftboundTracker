import type { SaveResult } from '@/db/queries/decks';

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
 */
export function saveMessage(result: SaveResult): string {
  const v = `v${result.versionNumber}`;

  switch (result.outcome) {
    case 'no-op':
      return 'No changes to save';
    case 'amended':
      return `${v} updated · no matches on it yet, so no new version`;
    case 'reprinted':
      return `${v} updated · same cards, different printing`;
    case 'forked':
      return `Saved as ${v} · your earlier version is untouched`;
    case 'amended-locked':
      return `${v} overwritten · its matches now count for this list`;
  }
}
