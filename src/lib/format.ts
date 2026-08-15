import type { EventStyle, GameStyle } from '@/db/schema/games';
import { t, useLocale } from '@/i18n';

/**
 * Display formatting shared across screens.
 *
 * Here rather than inline so the same value never renders two ways — a date
 * that reads "6 Aug" in one list and "2026-08-06" in another makes the app feel
 * like two apps. That argument is what makes this the right place to translate
 * these: a style label rendered from three screens must not become three
 * translations.
 *
 * These are plain functions rather than hooks, so they call `t()` imperatively
 * and do **not** subscribe to the locale. Re-rendering on a language change is
 * handled once, at the root — see `app/_layout.tsx`.
 */

/**
 * A date the way a player would say it.
 *
 * Relative for the last week, because "yesterday" is how you actually think
 * about a match you just played, and absolute after that, because "23 days ago"
 * is arithmetic rather than information.
 */
export function gameDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return t('date.today');
  if (days === 1) return t('date.yesterday');
  if (days > 1 && days < 7) return t('date.daysAgo', { days });

  /*
   * The month name comes from the locale the app is set to, not the device's.
   *
   * `undefined` here meant "whatever the phone is", which would have printed a
   * German app's dates in English on an English phone — the one case the
   * in-app language override exists to serve. `pseudo` is not a real BCP-47 tag,
   * so it borrows English formatting; it is testing layout, not calendars.
   */
  const locale = useLocale.getState().locale;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(locale === 'pseudo' ? 'en' : locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/*
 * Slug → catalogue key, rather than slug → English.
 *
 * The indirection is the point: these values are written into the database and
 * must never change, while what they are *called* now varies by language. A map
 * to keys keeps the stored vocabulary and the displayed vocabulary independent.
 */
const MATCH_STYLE_KEYS = {
  casual: 'game.style.casual',
  online: 'game.style.online',
  tournament: 'game.style.tournament',
  testing: 'game.style.testing',
} as const satisfies Record<GameStyle, string>;

const EVENT_STYLE_KEYS = {
  'nexus-night': 'event.style.nexusNight',
  skirmish: 'event.style.skirmish',
  locals: 'event.style.locals',
  'regional-qualifier': 'event.style.regionalQualifier',
  'regional-final': 'event.style.regionalFinal',
} as const satisfies Record<EventStyle, string>;

/**
 * Turn a slug nobody mapped into something readable.
 *
 * Reached by rows written before the style split, which hold values these
 * lists no longer offer. Rewriting that history to fit a newer vocabulary
 * would be worse than rendering it plainly.
 */
function humanise(value: string): string {
  return value
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** How the match was played: Casual, Online, Tournament, Testing. */
export function gameStyleLabel(value: string): string {
  const key = MATCH_STYLE_KEYS[value as GameStyle];
  return key ? t(key) : humanise(value);
}

/**
 * The tier of an event: Nexus Night, Skirmish, Locals, Regional….
 *
 * Null since migration 17 — an event named in the log form has no tier until
 * someone sets one. Reported as "not recorded", the same words every other
 * unanswered field on a match uses, rather than blanked: the difference between
 * a question nobody answered and one the app forgot to ask is the whole reason
 * these fields are nullable.
 */
export function eventStyleLabel(value: string | null): string {
  if (value === null) return t('common.notRecorded');
  const key = EVENT_STYLE_KEYS[value as EventStyle];
  return key ? t(key) : humanise(value);
}

/** `Bo3`, or null when the format was not recorded. */
export function bestOfLabel(bestOf: number | null): string | null {
  return bestOf === null ? null : `Bo${bestOf}`;
}

/**
 * A record — and deliberately *only* a record.
 *
 * This used to append a win rate, computed as `wins / (wins + losses + draws)`
 * while the analytics layer computes `wins / decided`. The same deck therefore
 * showed two different percentages on two screens, and neither carried an
 * interval.
 *
 * So percentages live in exactly one place now: `WinRateBar`, which cannot
 * render one without its sample size and its 95 % interval. A record needs
 * neither — `7–3` is a fact, not an estimate, and it carries its own n.
 *
 * Null at zero rather than "0–0", which would read as a played and lost.
 */
export function recordLine(wins: number, losses: number, draws = 0): string | null {
  if (wins + losses + draws === 0) return null;
  return `${wins}–${losses}${draws > 0 ? `–${draws}` : ''}`;
}
