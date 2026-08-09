import type { EventStyle, MatchStyle } from '@/db/schema/matches';

/**
 * Display formatting shared across screens.
 *
 * Here rather than inline so the same value never renders two ways — a date
 * that reads "6 Aug" in one list and "2026-08-06" in another makes the app feel
 * like two apps.
 */

/**
 * A date the way a player would say it.
 *
 * Relative for the last week, because "yesterday" is how you actually think
 * about a match you just played, and absolute after that, because "23 days ago"
 * is arithmetic rather than information.
 */
export function matchDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const MATCH_STYLE_LABELS: Record<MatchStyle, string> = {
  casual: 'Casual',
  online: 'Online',
  tournament: 'Tournament',
  testing: 'Testing',
};

const EVENT_STYLE_LABELS: Record<EventStyle, string> = {
  'nexus-night': 'Nexus Night',
  skirmish: 'Skirmish',
  locals: 'Locals',
  'regional-qualifier': 'Regional Qualifier',
  'regional-final': 'Regional Final',
};

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
export function matchStyleLabel(value: string): string {
  return MATCH_STYLE_LABELS[value as MatchStyle] ?? humanise(value);
}

/** The tier of an event: Nexus Night, Skirmish, Locals, Regional…. */
export function eventStyleLabel(value: string): string {
  return EVENT_STYLE_LABELS[value as EventStyle] ?? humanise(value);
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
