import type { EventType } from '@/db/schema/matches';

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

const MATCH_STYLE_LABELS: Record<EventType, string> = {
  casual: 'Casual',
  skirmish: 'Skirmish',
  'nexus-night': 'Nexus Night',
  locals: 'Locals',
  tournament: 'Tournament',
  online: 'Online',
  testing: 'Testing',
};

/**
 * The stored `event_type` as a player would read it.
 *
 * Falls back to the raw value rather than to a blank: a row written by a newer
 * build than this one should still say *something* rather than silently look
 * like it has no style at all.
 */
export function matchStyleLabel(value: string): string {
  return MATCH_STYLE_LABELS[value as EventType] ?? value;
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
