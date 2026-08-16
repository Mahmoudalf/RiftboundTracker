import { seenFork } from '@/db/queries/settings';
import type { Key } from '@/i18n';

/**
 * Which form of the locked-version banner to draw.
 *
 * The editor tells you, before you touch anything, that saving a version with
 * games on it will fork rather than overwrite. That is the app's one real rule,
 * and the line stating it — `v1 · 1 game tracked — saving will create v2` — is
 * shaped like status. A first-time reader has no reason to parse it as a rule,
 * on the exact screen it exists to prepare them for.
 *
 * So until they have actually seen a fork happen, the same line in the same
 * place says the whole thing; afterwards it collapses to the short form for
 * good. Nothing is dismissed, nothing is overlaid, and the thing that teaches
 * the rule is the thing they will see every time after — just fuller, once.
 *
 * **The switch is on the fork, not on the render**, which is the point of
 * reading `seenFork()` rather than a "banner shown" flag: somebody who reads
 * this, thinks about it and backs out has not seen the rule happen, and is
 * exactly who still needs the long version next time.
 */

/** The three short-form keys, one per shape of the count. */
export type BannerKey =
  | 'editor.lockedBanner.locked'
  | 'editor.lockedBanner.one'
  | 'editor.lockedBanner.other';

/**
 * `explained` is the caller's answer to "has a fork happened yet", passed in so
 * this stays a pure function of it — the editor reads the database once and the
 * decision is testable without one.
 */
export function bannerKeyFor(base: BannerKey, explained: boolean): Key {
  return explained ? base : (`${base}.long` as Key);
}

/** The editor's binding: reads the flag, then decides. */
export function bannerKey(base: BannerKey): Key {
  /*
   * Read live rather than held in state.
   *
   * There is no transient state here to lose, which matters on this screen more
   * than most: choosing a language remounts the navigator, and anything kept in
   * a `useState` here would be destroyed by it. A point lookup on a four-row
   * table is cheaper than the bug that alternative invites.
   */
  return bannerKeyFor(base, seenFork());
}
