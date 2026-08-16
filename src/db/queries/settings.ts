import { conn } from '../connection';

/**
 * Preferences.
 *
 * The `settings` table is key/value, so this module is the schema: every key is
 * declared here and reached only through a typed accessor. `getSetting` and
 * `setSetting` are deliberately **not** exported — a bare string key at a call
 * site is how a key/value store rots into a set of typos nothing can find.
 *
 * Every read has a total fallback. A fresh install has no rows at all, and a
 * build older than a key simply misses it, so "absent" is the normal case
 * rather than an error worth reporting.
 */

/**
 * Every key the app stores. Adding one means adding an accessor below.
 *
 * The strings are a storage format — once shipped they are as permanent as a
 * column name, so they are written out rather than derived from anything.
 */
const KEY = {
  displayName: 'display_name',
  locale: 'locale',
  onboarded: 'onboarded',
  seenFork: 'seen_fork',
} as const;

type SettingKey = (typeof KEY)[keyof typeof KEY];

function getSetting(key: SettingKey): string | null {
  const row = conn().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

function setSetting(key: SettingKey, value: string | null): void {
  // Null clears rather than storing an empty string: "never set" and "set to
  // nothing" have the same meaning for every key here, and one representation
  // means readers need only one check.
  if (value === null) {
    conn().runSync('DELETE FROM settings WHERE key = ?', [key]);
    return;
  }
  conn().runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

/* ------------------------------------------------------------- display name */

/** How long a name may be. Past this it stops being a name and starts being a note. */
export const DISPLAY_NAME_MAX = 40;

/**
 * The player's name, or null if they have not set one.
 *
 * Null rather than a placeholder like "Player": nothing in the app is required
 * to show a name, so every caller can decide for itself whether to omit the
 * line or supply its own wording. A fake default would spread through exports
 * and, later, through sync.
 */
export function displayName(): string | null {
  return getSetting(KEY.displayName);
}

/**
 * Store the player's name. Whitespace-only input clears it.
 *
 * Trimmed on write rather than on read so the stored value is the value —
 * a name that round-trips through an export should not depend on who trimmed it.
 */
export function setDisplayName(name: string | null): void {
  const trimmed = name?.trim() ?? '';
  setSetting(KEY.displayName, trimmed.length === 0 ? null : trimmed.slice(0, DISPLAY_NAME_MAX));
}

/* ------------------------------------------------------------------ locale */

/**
 * The stored language override, if the player has chosen one.
 *
 * Not validated against the locale list here — that list lives in `i18n` and
 * importing it would pull a React Native module into the query layer. The
 * caller checks, and an unrecognised value is treated as no choice at all,
 * which is also what a downgrade to a build that speaks fewer languages needs.
 */
export function storedLocale(): string | null {
  return getSetting(KEY.locale);
}

export function setStoredLocale(locale: string | null): void {
  setSetting(KEY.locale, locale);
}

/* -------------------------------------------------------------- onboarding */

/**
 * Whether the welcome flow has been seen.
 *
 * Absent means "not yet", which is what a fresh install reads and also what a
 * user who cleared the app's data reads — both should see the welcome, so the
 * missing row is the correct answer rather than a case to repair.
 *
 * Stored as its own key rather than inferred from "has a display name" or "has
 * a deck": both are skippable inside the flow, so inferring would replay the
 * welcome forever for anyone who chose to skip.
 */
export function onboardingDone(): boolean {
  return getSetting(KEY.onboarded) === 'true';
}

/**
 * Mark the flow finished. Called when it is dismissed by any route through it,
 * including skipping every optional step — seeing it is what counts.
 */
export function completeOnboarding(): void {
  setSetting(KEY.onboarded, 'true');
}

/* ---------------------------------------------------- the version-lock rule */

/**
 * Whether this player has ever had a version fork out from under them.
 *
 * The editor's locked-version banner carries an extra sentence until this is
 * true, then collapses to its one-line form for good.
 *
 * **Not a dismissal flag, and the difference is the whole point.** It records
 * that the rule has *happened to their data*, not that a control was tapped —
 * so somebody who reads the banner, thinks about it and backs out still gets
 * the long form next time, which is exactly who still needs it. A dismissal
 * flag would be cleared by the one gesture that proves nothing was read.
 */
export function seenFork(): boolean {
  return getSetting(KEY.seenFork) === 'true';
}

/**
 * Called from `saveDeckEdit` at the moment a fork is created.
 *
 * It lives beside the fork rather than at the call site so a second caller
 * cannot forget it — and because "the fork completing" is the event, not "the
 * editor finishing a save".
 */
export function markForkSeen(): void {
  setSetting(KEY.seenFork, 'true');
}
