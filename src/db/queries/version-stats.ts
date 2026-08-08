import { rateOf, type Rate } from '@/lib/analytics/summary';
import { cardSetKey } from '@/lib/deck-diff';

import type { MatchRow } from '../schema/matches';

import { listVersions, loadDeckList } from './decks';
import { listMatches } from './matches';

/**
 * Per-version performance, with identical card sets pooled.
 *
 * The pooling is the point. M3 decided that changing a card's art on a locked
 * version forks a new one rather than rewriting the played record — correct,
 * because `deck_version_cards` is evidence of what was physically in the
 * sleeve. The cost of that decision was a split sample: two versions holding
 * the same 40 cards, each with half the matches.
 *
 * This is where the cost is paid back. Versions whose card sets are identical
 * once printings are ignored report as **one** row with one combined interval,
 * because they are one deck to every rule and every statistic. Nothing is
 * rewritten to achieve it; the data stays exactly as it was recorded and the
 * pooling happens at read time.
 */

export interface VersionStat {
  /** Every version pooled into this row, newest first. */
  versionIds: string[];
  versionNumbers: number[];
  label: string | null;
  /** True when more than one version shares this card set. */
  pooled: boolean;
  rate: Rate;
  matches: MatchRow[];
}

export function versionStats(deckId: string): VersionStat[] {
  const versions = listVersions(deckId);
  const matches = listMatches({ deckId });

  const byVersion = new Map<string, MatchRow[]>();
  for (const match of matches) {
    const bucket = byVersion.get(match.deckVersionId) ?? [];
    bucket.push(match);
    byVersion.set(match.deckVersionId, bucket);
  }

  const groups = new Map<string, VersionStat>();

  for (const version of versions) {
    const key = cardSetKey(loadDeckList(version.id));
    const rows = byVersion.get(version.id) ?? [];

    const existing = groups.get(key);
    if (existing) {
      existing.versionIds.push(version.id);
      existing.versionNumbers.push(version.versionNumber);
      existing.matches.push(...rows);
      existing.pooled = true;
      // Keep the earliest label — it named the change that created this list.
      existing.label = version.label ?? existing.label;
      existing.rate = rateOf(existing.matches);
      continue;
    }

    groups.set(key, {
      versionIds: [version.id],
      versionNumbers: [version.versionNumber],
      label: version.label,
      pooled: false,
      rate: rateOf(rows),
      matches: rows,
    });
  }

  // Newest version first, matching the timeline.
  return [...groups.values()].sort(
    (a, b) => Math.max(...b.versionNumbers) - Math.max(...a.versionNumbers)
  );
}

/** How a pooled row names itself: "v3" or "v3 + v4". */
export function versionStatLabel(stat: VersionStat): string {
  return stat.versionNumbers
    .slice()
    .sort((a, b) => a - b)
    .map((n) => `v${n}`)
    .join(' + ');
}
